import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { randomBytes, createHash } from 'crypto';
import { Argon2Service } from '@ksiegowacrm/auth';
import type { AuditLogger } from '../../utils/audit-logger';

export interface RegisterParams {
  email: string;
  password: string;
  ipAddress: string;
  userAgent?: string;
  correlationId: string;
}

export interface VerifyEmailParams {
  token: string;
  ipAddress: string;
  userAgent?: string;
  correlationId: string;
}

export interface ResendVerificationParams {
  email: string;
  ipAddress: string;
  userAgent?: string;
  correlationId: string;
}

/**
 * Registration Service (AIM-001)
 * Handles user registration, email verification
 */
export class RegistrationService {
  private prisma: PrismaClient;
  private redis: Redis;
  private auditLogger: AuditLogger;
  private argon2: Argon2Service;

  constructor(prisma: PrismaClient, redis: Redis, auditLogger: AuditLogger) {
    this.prisma = prisma;
    this.redis = redis;
    this.auditLogger = auditLogger;
    this.argon2 = new Argon2Service();
  }

  /**
   * Register a new user
   */
  async register(params: RegisterParams): Promise<{ userId: string }> {
    const { email, password, ipAddress, userAgent, correlationId } = params;
    const normalizedEmail = email.toLowerCase();

    // Check password against HaveIBeenPwned (k-anonymity model)
    const isBreached = await this.checkPasswordBreach(password);
    if (isBreached) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'To hasło zostało ujawnione w wycieku danych. Użyj innego hasła.',
      });
    }

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      // Don't reveal if email exists - use generic message
      // But still send a "someone tried to register" email to the existing user
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nie można utworzyć konta z podanym adresem email.',
      });
    }

    // Hash password with Argon2id
    const passwordHash = await this.argon2.hash(password);

    // Generate email verification token (32 bytes = 64 hex chars)
    const verificationToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(verificationToken).digest('hex');

    // Create user and verification token in transaction
    const user = await this.prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          status: 'pending_verification',
        },
      });

      // Create empty profile
      await tx.userProfile.create({
        data: {
          userId: newUser.id,
        },
      });

      // Create verification token
      await tx.emailVerification.create({
        data: {
          userId: newUser.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      // Assign default USER role
      const userRole = await tx.role.findFirst({
        where: { name: 'USER' },
      });

      if (userRole) {
        await tx.userRole.create({
          data: {
            userId: newUser.id,
            roleId: userRole.id,
          },
        });
      }

      return newUser;
    });

    // Log registration event
    await this.auditLogger.logRegistration({
      userId: user.id,
      email: normalizedEmail,
      ipAddress,
      userAgent,
      correlationId,
    });

    // Send verification email (async, don't block response)
    this.sendVerificationEmail(normalizedEmail, verificationToken).catch(console.error);

    // Log email sent event
    await this.auditLogger.log({
      eventType: 'EMAIL_VERIFICATION_SENT',
      userId: user.id,
      ipAddress,
      userAgent,
      metadata: { email: normalizedEmail },
      correlationId,
    });

    return { userId: user.id };
  }

  /**
   * Verify email address with token
   */
  async verifyEmail(params: VerifyEmailParams): Promise<{ userId: string }> {
    const { token, ipAddress, userAgent, correlationId } = params;

    // Hash the token to compare with stored hash
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Find verification record
    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        tokenHash,
        usedAt: null,
      },
      include: {
        user: true,
      },
    });

    if (!verification) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nieprawidłowy lub wygasły link weryfikacyjny.',
      });
    }

    // Check if token is expired
    if (verification.expiresAt < new Date()) {
      await this.auditLogger.log({
        eventType: 'EMAIL_VERIFICATION_FAILED',
        userId: verification.userId,
        ipAddress,
        userAgent,
        metadata: { reason: 'TOKEN_EXPIRED' },
        correlationId,
      });

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Link weryfikacyjny wygasł. Poproś o nowy link.',
      });
    }

    // Mark token as used and update user status
    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerification.update({
        where: { id: verification.id },
        data: { usedAt: new Date() },
      });

      await tx.user.update({
        where: { id: verification.userId },
        data: {
          status: 'active',
          emailVerifiedAt: new Date(),
        },
      });
    });

    // Log successful verification
    await this.auditLogger.log({
      eventType: 'EMAIL_VERIFIED',
      userId: verification.userId,
      ipAddress,
      userAgent,
      metadata: { email: verification.user.email },
      correlationId,
    });

    return { userId: verification.userId };
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(params: ResendVerificationParams): Promise<void> {
    const { email, ipAddress, userAgent, correlationId } = params;
    const normalizedEmail = email.toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.status !== 'pending_verification') {
      // Don't reveal if email exists or status
      return;
    }

    // Invalidate existing tokens
    await this.prisma.emailVerification.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(), // Mark as used to invalidate
      },
    });

    // Generate new token
    const verificationToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(verificationToken).digest('hex');

    await this.prisma.emailVerification.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Send verification email
    await this.sendVerificationEmail(normalizedEmail, verificationToken);

    // Log event
    await this.auditLogger.log({
      eventType: 'EMAIL_VERIFICATION_SENT',
      userId: user.id,
      ipAddress,
      userAgent,
      metadata: { email: normalizedEmail, resend: true },
      correlationId,
    });
  }

  /**
   * Check password against HaveIBeenPwned API using k-anonymity
   */
  private async checkPasswordBreach(password: string): Promise<boolean> {
    const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    try {
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'User-Agent': 'KsięgowaCRM-Security-Check' },
      });

      if (!response.ok) {
        // If API is unavailable, allow registration but log warning
        console.warn('HaveIBeenPwned API unavailable');
        return false;
      }

      const text = await response.text();
      const hashes = text.split('\n');

      for (const line of hashes) {
        const [hashSuffix] = line.split(':');
        if (hashSuffix && hashSuffix.trim() === suffix) {
          return true; // Password is breached
        }
      }

      return false;
    } catch {
      // If API call fails, allow registration but log warning
      console.warn('Failed to check password breach');
      return false;
    }
  }

  /**
   * Send verification email
   */
  private async sendVerificationEmail(email: string, token: string): Promise<void> {
    // TODO: Implement actual email sending
    // For now, log the token in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Verification link for ${email}: /verify-email?token=${token}`);
    }

    // Queue email for sending via job queue
    await this.redis.lpush(
      'email:queue',
      JSON.stringify({
        type: 'EMAIL_VERIFICATION',
        to: email,
        data: {
          verificationUrl: `${process.env.APP_URL}/verify-email?token=${token}`,
        },
      })
    );
  }
}
