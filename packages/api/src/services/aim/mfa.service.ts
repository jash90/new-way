import { TRPCError } from '@trpc/server';
import type { PrismaClient, MfaConfiguration as _MfaConfiguration, MfaBackupCode, MfaChallenge as _MfaChallenge } from '@prisma/client';

// Suppress unused type import warnings - types used for Prisma operations
void (0 as unknown as _MfaConfiguration);
void (0 as unknown as _MfaChallenge);
import type Redis from 'ioredis';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import type { AuditLogger } from '../../utils/audit-logger';
import type { TotpService } from '@ksiegowacrm/auth';

// Encryption key for MFA secrets (should be from environment in production)
const MFA_ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY || 'default-32-byte-key-for-dev-only!';

// Constants
const SETUP_TOKEN_EXPIRY_SECONDS = 10 * 60; // 10 minutes
const CHALLENGE_EXPIRY_SECONDS = 5 * 60; // 5 minutes
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 30 * 60; // 30 minutes
const BACKUP_CODES_COUNT = 10;

export interface MfaStatusResult {
  isEnabled: boolean;
  isVerified: boolean;
  lastUsedAt: string | null;
  backupCodesRemaining: number;
  createdAt: string | null;
}

export interface MfaSetupResult {
  setupToken: string;
  qrCodeDataUrl: string;
  otpauthUrl: string;
  expiresAt: string;
}

export interface MfaEnableResult {
  success: boolean;
  backupCodes: string[];
  message: string;
}

export interface MfaChallengeResult {
  challengeToken: string;
  type: 'totp' | 'backup_code';
  expiresAt: string;
  attemptsRemaining: number;
}

export interface MfaVerificationResult {
  success: boolean;
  userId: string;
  completedAt: string;
}

export interface BackupCodesResult {
  codes: string[];
  generatedAt: string;
  warning: string;
}

interface Argon2Service {
  verify(hash: string, password: string): Promise<boolean>;
}

export class MfaService {
  private readonly prisma: PrismaClient;
  private readonly redis: Redis;
  private readonly auditLogger: AuditLogger;
  private readonly totpService: TotpService;
  private readonly argon2Service: Argon2Service;

  constructor(
    prisma: PrismaClient,
    redis: Redis,
    auditLogger: AuditLogger,
    totpService: TotpService,
    argon2Service: Argon2Service
  ) {
    this.prisma = prisma;
    this.redis = redis;
    this.auditLogger = auditLogger;
    this.totpService = totpService;
    this.argon2Service = argon2Service;
  }

  /**
   * Get MFA status for a user
   */
  async getMfaStatus(userId: string): Promise<MfaStatusResult> {
    const config = await this.prisma.mfaConfiguration.findUnique({
      where: { userId },
    });

    if (!config) {
      return {
        isEnabled: false,
        isVerified: false,
        lastUsedAt: null,
        backupCodesRemaining: 0,
        createdAt: null,
      };
    }

    const backupCodesRemaining = await this.prisma.mfaBackupCode.count({
      where: { userId, usedAt: null },
    });

    return {
      isEnabled: config.isEnabled,
      isVerified: config.verifiedAt !== null,
      lastUsedAt: config.lastUsedAt?.toISOString() ?? null,
      backupCodesRemaining,
      createdAt: config.createdAt.toISOString(),
    };
  }

  /**
   * Initiate MFA setup - generates TOTP secret and QR code
   */
  async initiateSetup(userId: string, password: string): Promise<MfaSetupResult> {
    // Get user and verify password
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Użytkownik nie został znaleziony',
      });
    }

    // Check account status
    if (user.status !== 'active') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Konto jest nieaktywne lub zablokowane',
      });
    }

    // Verify password
    const isValidPassword = await this.argon2Service.verify(user.passwordHash, password);
    if (!isValidPassword) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Nieprawidłowe hasło',
      });
    }

    // Check existing MFA configuration
    const existingConfig = await this.prisma.mfaConfiguration.findUnique({
      where: { userId },
    });

    if (existingConfig?.isEnabled) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'MFA jest już aktywne dla tego konta',
      });
    }

    // If unverified config exists, delete it
    if (existingConfig && !existingConfig.isEnabled) {
      await this.prisma.mfaConfiguration.delete({
        where: { userId },
      });
    }

    // Generate TOTP secret
    const { secret, qrCodeDataUrl, otpauthUrl } = await this.totpService.generateSecret(user.email);

    // Generate setup token
    const setupToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SETUP_TOKEN_EXPIRY_SECONDS * 1000);

    // Store setup data in Redis
    const setupData = JSON.stringify({
      secret,
      userId,
    });
    await this.redis.setex(
      `mfa:setup:${setupToken}`,
      SETUP_TOKEN_EXPIRY_SECONDS,
      setupData
    );

    // Log audit event
    await this.auditLogger.log({
      eventType: 'MFA_SETUP_INITIATED',
      userId,
      metadata: {},
    });

    return {
      setupToken,
      qrCodeDataUrl,
      otpauthUrl,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Verify setup and enable MFA
   */
  async verifySetup(setupToken: string, code: string): Promise<MfaEnableResult> {
    // Validate code format
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nieprawidłowy format kodu TOTP',
      });
    }

    // Get setup data from Redis
    const setupDataJson = await this.redis.get(`mfa:setup:${setupToken}`);
    if (!setupDataJson) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Token konfiguracji wygasł lub jest nieprawidłowy',
      });
    }

    const setupData = JSON.parse(setupDataJson) as { secret: string; userId: string };

    // Verify TOTP code
    const isValidCode = this.totpService.verifyToken(setupData.secret, code);
    if (!isValidCode) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nieprawidłowy kod weryfikacyjny',
      });
    }

    // Encrypt secret
    const encryptedSecret = this.encryptSecret(setupData.secret);

    // Generate backup codes
    const backupCodes = this.totpService.generateBackupCodes(BACKUP_CODES_COUNT);
    const hashedBackupCodes: { userId: string; codeHash: string }[] = [];

    for (const code of backupCodes) {
      const hash = await this.totpService.hashBackupCode(code);
      hashedBackupCodes.push({
        userId: setupData.userId,
        codeHash: hash,
      });
    }

    // Create MFA configuration and backup codes
    await this.prisma.$transaction(async (tx) => {
      await tx.mfaConfiguration.create({
        data: {
          userId: setupData.userId,
          secretEncrypted: encryptedSecret,
          isEnabled: true,
          verifiedAt: new Date(),
        },
      });

      await tx.mfaBackupCode.createMany({
        data: hashedBackupCodes,
      });
    });

    // Delete setup token from Redis
    await this.redis.del(`mfa:setup:${setupToken}`);

    // Log audit event
    await this.auditLogger.log({
      eventType: 'MFA_ENABLED',
      userId: setupData.userId,
      metadata: { backupCodesGenerated: BACKUP_CODES_COUNT },
    });

    return {
      success: true,
      backupCodes,
      message: 'MFA zostało aktywowane. Zapisz kody zapasowe w bezpiecznym miejscu.',
    };
  }

  /**
   * Disable MFA for a user
   */
  async disableMfa(userId: string, password: string, code: string): Promise<{ success: boolean }> {
    // Get user and verify password
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Użytkownik nie został znaleziony',
      });
    }

    // Verify password
    const isValidPassword = await this.argon2Service.verify(user.passwordHash, password);
    if (!isValidPassword) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Nieprawidłowe hasło',
      });
    }

    // Get MFA configuration
    const config = await this.prisma.mfaConfiguration.findUnique({
      where: { userId },
    });

    if (!config || !config.isEnabled) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'MFA nie jest aktywne dla tego konta',
      });
    }

    // Verify TOTP code
    const secret = this.decryptSecret(config.secretEncrypted);
    const isValidCode = this.totpService.verifyToken(secret, code);
    if (!isValidCode) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nieprawidłowy kod TOTP',
      });
    }

    // Delete MFA configuration, backup codes, and challenges
    await this.prisma.$transaction(async (tx) => {
      await tx.mfaBackupCode.deleteMany({ where: { userId } });
      await tx.mfaChallenge.deleteMany({ where: { userId } });
      await tx.mfaConfiguration.delete({ where: { userId } });
    });

    // Log audit event
    await this.auditLogger.log({
      eventType: 'MFA_DISABLED',
      userId,
      metadata: {},
    });

    return { success: true };
  }

  /**
   * Create MFA challenge for login verification
   */
  async createChallenge(userId: string, ipAddress: string): Promise<MfaChallengeResult> {
    // Get MFA configuration
    const config = await this.prisma.mfaConfiguration.findUnique({
      where: { userId },
    });

    if (!config || !config.isEnabled) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'MFA nie jest aktywne dla tego konta',
      });
    }

    // Check if locked
    if (config.lockedUntil && config.lockedUntil > new Date()) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'MFA jest zablokowane. Spróbuj później.',
      });
    }

    // Clear expired lockout if any
    if (config.lockedUntil && config.lockedUntil <= new Date()) {
      await this.prisma.mfaConfiguration.update({
        where: { userId },
        data: { lockedUntil: null, failedAttempts: 0 },
      });
    }

    // Delete expired challenges
    await this.prisma.mfaChallenge.deleteMany({
      where: {
        userId,
        expiresAt: { lt: new Date() },
      },
    });

    // Generate challenge token
    const challengeToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_SECONDS * 1000);

    // Create challenge
    const challenge = await this.prisma.mfaChallenge.create({
      data: {
        userId,
        challengeToken,
        type: 'totp',
        attempts: 0,
        maxAttempts: 3,
        expiresAt,
        ipAddress,
      },
    });

    return {
      challengeToken: challenge.challengeToken,
      type: 'totp',
      expiresAt: challenge.expiresAt.toISOString(),
      attemptsRemaining: challenge.maxAttempts - challenge.attempts,
    };
  }

  /**
   * Verify TOTP code for challenge
   */
  async verifyTotp(challengeToken: string, code: string): Promise<MfaVerificationResult> {
    // Validate code format
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nieprawidłowy format kodu TOTP',
      });
    }

    // Get challenge
    const challenge = await this.prisma.mfaChallenge.findUnique({
      where: { challengeToken },
    });

    if (!challenge) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Wyzwanie MFA nie zostało znalezione',
      });
    }

    // Check if expired
    if (challenge.expiresAt < new Date()) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Wyzwanie MFA wygasło',
      });
    }

    // Check if already completed
    if (challenge.completedAt) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Wyzwanie MFA zostało już wykorzystane',
      });
    }

    // Check max attempts
    if (challenge.attempts >= challenge.maxAttempts) {
      await this.prisma.mfaChallenge.delete({ where: { id: challenge.id } });
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Przekroczono limit prób. Spróbuj ponownie.',
      });
    }

    // Get MFA configuration
    const config = await this.prisma.mfaConfiguration.findUnique({
      where: { userId: challenge.userId },
    });

    if (!config) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Konfiguracja MFA nie została znaleziona',
      });
    }

    // Decrypt secret and verify code
    const secret = this.decryptSecret(config.secretEncrypted);
    const isValidCode = this.totpService.verifyToken(secret, code);

    if (!isValidCode) {
      // Increment attempts
      await this.prisma.mfaChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });

      // Increment failed attempts on config
      const updatedConfig = await this.prisma.mfaConfiguration.update({
        where: { userId: challenge.userId },
        data: { failedAttempts: { increment: 1 } },
      });

      // Check if should lock
      if (updatedConfig.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        await this.prisma.mfaConfiguration.update({
          where: { userId: challenge.userId },
          data: { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_SECONDS * 1000) },
        });
      }

      // Log failed attempt
      await this.auditLogger.log({
        eventType: 'MFA_VERIFICATION_FAILED',
        userId: challenge.userId,
        metadata: { attempts: challenge.attempts + 1 },
      });

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nieprawidłowy kod TOTP',
      });
    }

    // Mark challenge as completed
    const completedAt = new Date();
    await this.prisma.mfaChallenge.update({
      where: { id: challenge.id },
      data: { completedAt },
    });

    // Update MFA config
    await this.prisma.mfaConfiguration.update({
      where: { userId: challenge.userId },
      data: { lastUsedAt: completedAt, failedAttempts: 0 },
    });

    // Log success
    await this.auditLogger.log({
      eventType: 'MFA_VERIFIED',
      userId: challenge.userId,
      metadata: { method: 'totp' },
    });

    return {
      success: true,
      userId: challenge.userId,
      completedAt: completedAt.toISOString(),
    };
  }

  /**
   * Verify backup code for challenge
   */
  async verifyBackupCode(challengeToken: string, code: string): Promise<MfaVerificationResult> {
    // Get challenge
    const challenge = await this.prisma.mfaChallenge.findUnique({
      where: { challengeToken },
    });

    if (!challenge) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Wyzwanie MFA nie zostało znalezione',
      });
    }

    // Check if expired
    if (challenge.expiresAt < new Date()) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Wyzwanie MFA wygasło',
      });
    }

    // Check if already completed
    if (challenge.completedAt) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Wyzwanie MFA zostało już wykorzystane',
      });
    }

    // Get unused backup codes
    const backupCodes = await this.prisma.mfaBackupCode.findMany({
      where: { userId: challenge.userId, usedAt: null },
    });

    // Find matching backup code
    let matchingCode: MfaBackupCode | null = null;
    for (const bc of backupCodes) {
      const isMatch = await this.totpService.verifyBackupCode(bc.codeHash, code.toUpperCase());
      if (isMatch) {
        matchingCode = bc;
        break;
      }
    }

    if (!matchingCode) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nieprawidłowy kod zapasowy',
      });
    }

    // Mark backup code as used
    await this.prisma.mfaBackupCode.update({
      where: { id: matchingCode.id },
      data: { usedAt: new Date() },
    });

    // Mark challenge as completed
    const completedAt = new Date();
    await this.prisma.mfaChallenge.update({
      where: { id: challenge.id },
      data: { completedAt },
    });

    // Count remaining backup codes
    const remainingCodes = await this.prisma.mfaBackupCode.count({
      where: { userId: challenge.userId, usedAt: null },
    });

    // Log audit event
    await this.auditLogger.log({
      eventType: 'MFA_BACKUP_CODE_USED',
      userId: challenge.userId,
      metadata: { backupCodesRemaining: remainingCodes },
    });

    return {
      success: true,
      userId: challenge.userId,
      completedAt: completedAt.toISOString(),
    };
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(
    userId: string,
    password: string,
    code: string
  ): Promise<BackupCodesResult> {
    // Get user and verify password
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Użytkownik nie został znaleziony',
      });
    }

    // Verify password
    const isValidPassword = await this.argon2Service.verify(user.passwordHash, password);
    if (!isValidPassword) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Nieprawidłowe hasło',
      });
    }

    // Get MFA configuration
    const config = await this.prisma.mfaConfiguration.findUnique({
      where: { userId },
    });

    if (!config || !config.isEnabled) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'MFA nie jest aktywne dla tego konta',
      });
    }

    // Verify TOTP code
    const secret = this.decryptSecret(config.secretEncrypted);
    const isValidCode = this.totpService.verifyToken(secret, code);
    if (!isValidCode) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nieprawidłowy kod TOTP',
      });
    }

    // Generate new backup codes
    const backupCodes = this.totpService.generateBackupCodes(BACKUP_CODES_COUNT);
    const hashedBackupCodes: { userId: string; codeHash: string }[] = [];

    for (const code of backupCodes) {
      const hash = await this.totpService.hashBackupCode(code);
      hashedBackupCodes.push({
        userId,
        codeHash: hash,
      });
    }

    // Delete old and create new backup codes
    await this.prisma.$transaction(async (tx) => {
      await tx.mfaBackupCode.deleteMany({ where: { userId } });
      await tx.mfaBackupCode.createMany({ data: hashedBackupCodes });
    });

    // Log audit event
    await this.auditLogger.log({
      eventType: 'MFA_BACKUP_CODES_REGENERATED',
      userId,
      metadata: { codesGenerated: BACKUP_CODES_COUNT },
    });

    return {
      codes: backupCodes,
      generatedAt: new Date().toISOString(),
      warning: 'Zapisz te kody w bezpiecznym miejscu. Poprzednie kody są już nieaktywne.',
    };
  }

  /**
   * Encrypt secret using AES-256-GCM
   */
  private encryptSecret(secret: string): string {
    const iv = randomBytes(16);
    const key = Buffer.from(MFA_ENCRYPTION_KEY.padEnd(32).slice(0, 32));
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt secret using AES-256-GCM
   */
  private decryptSecret(encryptedSecret: string): string {
    const parts = encryptedSecret.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted secret format');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex as string, 'hex' as BufferEncoding);
    const authTag = Buffer.from(authTagHex as string, 'hex' as BufferEncoding);
    const key = Buffer.from(MFA_ENCRYPTION_KEY.padEnd(32).slice(0, 32), 'utf8' as BufferEncoding);

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted as string, 'hex' as BufferEncoding, 'utf8' as BufferEncoding);
    decrypted += decipher.final('utf8' as BufferEncoding);

    return decrypted;
  }
}
