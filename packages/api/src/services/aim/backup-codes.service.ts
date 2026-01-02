import { TRPCError } from '@trpc/server';
import type { PrismaClient, MfaBackupCode } from '@prisma/client';
import type Redis from 'ioredis';
import { createDecipheriv } from 'crypto';
import type { AuditLogger } from '../../utils/audit-logger';
import type { TotpService } from '@ksiegowacrm/auth';
import type {
  BackupCodesStatus,
  PaginatedUsedBackupCodes,
  UsedBackupCodeEntry,
  ExportBackupCodesResult,
  VerifyBackupCodeDirectResult,
  BackupCodesExportFormat,
} from '@ksiegowacrm/shared';

// Encryption key for MFA secrets (should be from environment in production)
const MFA_ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY || 'default-32-byte-key-for-dev-only!';

// Constants
const BACKUP_CODES_COUNT = 10;
const SHOULD_REGENERATE_THRESHOLD = 2;
const PDF_LINK_EXPIRY_SECONDS = 5 * 60; // 5 minutes

interface Argon2Service {
  verify(hash: string, password: string): Promise<boolean>;
}

export interface BackupCodesResult {
  codes: string[];
  generatedAt: string;
  warning: string;
}

export class BackupCodesService {
  private readonly prisma: PrismaClient;
  private readonly _redis: Redis;
  private readonly auditLogger: AuditLogger;
  private readonly totpService: TotpService;
  private readonly argon2Service: Argon2Service;

  constructor(
    prisma: PrismaClient,
    redis: Redis,
    auditLogger: AuditLogger,
    totpService: TotpService,
    argon2Service: Argon2Service,
  ) {
    this.prisma = prisma;
    this._redis = redis;
    this.auditLogger = auditLogger;
    this.totpService = totpService;
    this.argon2Service = argon2Service;

    // Suppress unused warning - redis reserved for future caching
    void this._redis;
  }

  /**
   * Get detailed backup codes status
   */
  async getStatus(userId: string): Promise<BackupCodesStatus> {
    // Check if MFA is configured and enabled
    const config = await this.prisma.mfaConfiguration.findUnique({
      where: { userId },
    });

    if (!config || !config.isEnabled) {
      return {
        isEnabled: false,
        totalCodes: 0,
        remainingCodes: 0,
        usedCodes: 0,
        lastUsedAt: null,
        generatedAt: null,
        shouldRegenerate: false,
      };
    }

    // Get backup codes counts
    const totalCodes = await this.prisma.mfaBackupCode.count({
      where: { userId },
    });

    const remainingCodes = await this.prisma.mfaBackupCode.count({
      where: { userId, usedAt: null },
    });

    const usedCodes = totalCodes - remainingCodes;

    // Get last used backup code
    const lastUsedCode = await this.prisma.mfaBackupCode.findFirst({
      where: { userId, usedAt: { not: null } },
      orderBy: { usedAt: 'desc' },
      select: { usedAt: true },
    });

    // Get first backup code to determine generation date
    const firstCode = await this.prisma.mfaBackupCode.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    return {
      isEnabled: true,
      totalCodes,
      remainingCodes,
      usedCodes,
      lastUsedAt: lastUsedCode?.usedAt?.toISOString() ?? null,
      generatedAt: firstCode?.createdAt?.toISOString() ?? null,
      shouldRegenerate: remainingCodes <= SHOULD_REGENERATE_THRESHOLD,
    };
  }

  /**
   * List used backup codes with pagination
   */
  async listUsedCodes(
    userId: string,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedUsedBackupCodes> {
    // Check if MFA is configured and enabled
    const config = await this.prisma.mfaConfiguration.findUnique({
      where: { userId },
    });

    if (!config || !config.isEnabled) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'MFA nie jest aktywne dla tego konta',
      });
    }

    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    // Get total count of used codes
    const total = await this.prisma.mfaBackupCode.count({
      where: { userId, usedAt: { not: null } },
    });

    // Get paginated used codes
    const usedCodes = await this.prisma.mfaBackupCode.findMany({
      where: { userId, usedAt: { not: null } },
      orderBy: { usedAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        usedAt: true,
        usedIpAddress: true,
        usedUserAgent: true,
      },
    });

    const totalPages = Math.ceil(total / limit);

    const items: UsedBackupCodeEntry[] = usedCodes.map((code) => ({
      id: code.id,
      usedAt: code.usedAt!.toISOString(),
      ipAddress: code.usedIpAddress,
      userAgent: code.usedUserAgent,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  /**
   * Export backup codes in specified format
   * Requires re-authentication with password and TOTP
   */
  async exportCodes(
    userId: string,
    input: {
      password: string;
      totpCode: string;
      format: BackupCodesExportFormat;
    },
  ): Promise<ExportBackupCodesResult> {
    const { password, totpCode, format } = input;

    // Get and verify user
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
    const isValidCode = this.totpService.verifyToken(secret, totpCode);
    if (!isValidCode) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nieprawidłowy kod TOTP',
      });
    }

    // Get unused backup codes (we need the actual codes, not hashes)
    // Since we store hashes, we cannot retrieve the original codes
    // We need to regenerate and return new codes
    const unusedCodes = await this.prisma.mfaBackupCode.findMany({
      where: { userId, usedAt: null },
      select: { id: true, codeHash: true },
    });

    if (unusedCodes.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Brak dostępnych kodów zapasowych. Wygeneruj nowe kody.',
      });
    }

    // Since we can't retrieve original codes from hashes, we'll indicate
    // that the user should regenerate codes to get new printable ones
    // For now, we'll create a placeholder list indicating the count
    const codeCount = unusedCodes.length;

    // Log audit event
    await this.auditLogger.log({
      eventType: 'BACKUP_CODES_EXPORTED',
      userId,
      metadata: { format, codesCount: codeCount },
    });

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const warning =
      'UWAGA: Te kody są jednorazowe. Każdy kod można użyć tylko raz. Przechowuj je w bezpiecznym miejscu.';

    if (format === 'pdf') {
      // Generate PDF content (Base64 encoded)
      const pdfContent = this.generatePdfContent(codeCount, user.email);
      const expiresAt = new Date(Date.now() + PDF_LINK_EXPIRY_SECONDS * 1000);

      return {
        format: 'pdf',
        content: pdfContent,
        filename: `backup-codes-${timestamp}.pdf`,
        mimeType: 'application/pdf',
        generatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        warning,
      };
    }

    // Text format
    const textContent = this.generateTextContent(codeCount, user.email);

    return {
      format: 'text',
      content: textContent,
      filename: `backup-codes-${timestamp}.txt`,
      mimeType: 'text/plain',
      generatedAt: now.toISOString(),
      warning,
    };
  }

  /**
   * Verify backup code directly (outside MFA challenge flow)
   */
  async verifyDirect(
    userId: string,
    code: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<VerifyBackupCodeDirectResult> {
    // Check if MFA is configured and enabled
    const config = await this.prisma.mfaConfiguration.findUnique({
      where: { userId },
    });

    if (!config || !config.isEnabled) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'MFA nie jest aktywne dla tego konta',
      });
    }

    // Get unused backup codes
    const backupCodes = await this.prisma.mfaBackupCode.findMany({
      where: { userId, usedAt: null },
    });

    if (backupCodes.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Brak dostępnych kodów zapasowych',
      });
    }

    // Find matching backup code
    const normalizedCode = code.toUpperCase();
    let matchingCode: MfaBackupCode | null = null;

    for (const bc of backupCodes) {
      const isMatch = await this.totpService.verifyBackupCode(bc.codeHash, normalizedCode);
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

    // Mark backup code as used with tracking info
    const now = new Date();
    await this.prisma.mfaBackupCode.update({
      where: { id: matchingCode.id },
      data: {
        usedAt: now,
        usedIpAddress: ipAddress ?? null,
        usedUserAgent: userAgent ?? null,
      },
    });

    // Count remaining backup codes
    const remainingCodes = await this.prisma.mfaBackupCode.count({
      where: { userId, usedAt: null },
    });

    // Log audit event
    await this.auditLogger.log({
      eventType: 'MFA_BACKUP_CODE_USED',
      userId,
      metadata: {
        backupCodesRemaining: remainingCodes,
        ipAddress: ipAddress ?? null,
      },
    });

    return {
      success: true,
      remainingCodes,
      shouldRegenerate: remainingCodes <= SHOULD_REGENERATE_THRESHOLD,
      verifiedAt: now.toISOString(),
    };
  }

  /**
   * Regenerate backup codes (requires password and TOTP verification)
   */
  async regenerateCodes(
    userId: string,
    password: string,
    totpCode: string,
  ): Promise<BackupCodesResult> {
    // Get and verify user
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
    const isValidCode = this.totpService.verifyToken(secret, totpCode);
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

    // Delete old and create new backup codes in transaction
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
   * Generate text content for backup codes export
   */
  private generateTextContent(codeCount: number, email: string): string {
    const lines = [
      '═══════════════════════════════════════════════════════════',
      '                    KODY ZAPASOWE MFA                       ',
      '                    KsięgowaCRM                             ',
      '═══════════════════════════════════════════════════════════',
      '',
      `Konto: ${email}`,
      `Data wygenerowania: ${new Date().toLocaleString('pl-PL')}`,
      '',
      '───────────────────────────────────────────────────────────',
      '',
      `Dostępne kody zapasowe: ${codeCount}`,
      '',
      'UWAGA: Aby zobaczyć i wydrukować swoje kody zapasowe,',
      'musisz je najpierw wygenerować ponownie.',
      '',
      'Każdy kod może być użyty tylko raz.',
      '',
      '───────────────────────────────────────────────────────────',
      '',
      'OSTRZEŻENIE:',
      '• Przechowuj te kody w bezpiecznym miejscu',
      '• Nie udostępniaj ich nikomu',
      '• Każdy kod działa tylko raz',
      '• Wygeneruj nowe kody gdy pozostaną tylko 2',
      '',
      '═══════════════════════════════════════════════════════════',
    ];

    return lines.join('\n');
  }

  /**
   * Generate PDF content for backup codes export (Base64 encoded)
   * In a real implementation, this would use a PDF library like pdfkit
   */
  private generatePdfContent(codeCount: number, email: string): string {
    // For now, return Base64-encoded text as a placeholder
    // In production, use pdfkit or similar to generate actual PDF
    const textContent = this.generateTextContent(codeCount, email);
    return Buffer.from(textContent).toString('base64');
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
