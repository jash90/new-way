import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { randomBytes, createHash } from 'crypto';
import { Argon2Service } from '@ksiegowacrm/auth';
import type { AuditLogger } from '../../utils/audit-logger';

export interface RequestPasswordResetParams {
  email: string;
  ipAddress: string;
  userAgent?: string;
  correlationId: string;
}

export interface ResetPasswordParams {
  token: string;
  password: string;
  ipAddress: string;
  userAgent?: string;
  correlationId: string;
}

interface ValidateTokenResult {
  valid: boolean;
  reason?: 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'TOKEN_USED';
}

// Minimum response time for timing attack prevention (ms)
const MIN_RESPONSE_TIME = 200;

/**
 * Password Reset Service (AIM-004)
 * Handles password reset flow with security considerations:
 * - Email enumeration prevention
 * - Timing attack prevention
 * - Password history check
 * - Token security (64-char, SHA-256 stored, 1-hour expiry)
 */
export class PasswordResetService {
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
   * Request password reset
   * Always returns success to prevent email enumeration
   */
  async requestPasswordReset(
    params: RequestPasswordResetParams
  ): Promise<{ success: boolean; message: string }> {
    const { email, ipAddress, userAgent, correlationId } = params;
    const normalizedEmail = email.toLowerCase();
    const startTime = Date.now();

    try {
      // Find user
      const user = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      // Only create token for active users
      if (user && user.status === 'active') {
        // Invalidate any existing reset tokens
        await this.prisma.passwordResetToken.updateMany({
          where: {
            userId: user.id,
            usedAt: null,
          },
          data: {
            usedAt: new Date(),
          },
        });

        // Generate new token (64 chars = 32 bytes)
        const token = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(token).digest('hex');

        // Create reset token with 1-hour expiry
        await this.prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
            ipAddress,
          },
        });

        // Log audit event
        await this.auditLogger.log({
          eventType: 'PASSWORD_RESET_REQUESTED',
          userId: user.id,
          ipAddress,
          userAgent,
          metadata: { email: normalizedEmail },
          correlationId,
        });

        // Queue password reset email
        await this.redis.lpush(
          'email:queue',
          JSON.stringify({
            type: 'PASSWORD_RESET',
            to: normalizedEmail,
            data: {
              resetUrl: `${process.env.APP_URL || ''}/reset-password?token=${token}`,
            },
          })
        );
      }

      // Ensure consistent timing to prevent timing attacks
      await this.ensureMinResponseTime(startTime);

      return {
        success: true,
        message: 'Jeśli konto istnieje, wysłaliśmy link do resetowania hasła.',
      };
    } catch (error) {
      // Ensure consistent timing even on error
      await this.ensureMinResponseTime(startTime);
      throw error;
    }
  }

  /**
   * Reset password with valid token
   */
  async resetPassword(
    params: ResetPasswordParams
  ): Promise<{ success: boolean; message: string }> {
    const { token, password, ipAddress, userAgent, correlationId } = params;

    // Validate token format (must be 64 chars)
    if (token.length !== 64) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nieprawidłowy token resetowania hasła.',
      });
    }

    // Hash token to compare with stored hash
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Find valid token with user
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
      },
      include: {
        user: true,
      },
    });

    if (!resetToken) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nieprawidłowy lub już użyty token.',
      });
    }

    // Check if token is expired
    if (resetToken.expiresAt < new Date()) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Token resetowania hasła wygasł. Poproś o nowy link.',
      });
    }

    // Check password against history (last 5 passwords)
    const isPasswordReused = await this.checkPasswordHistory(
      resetToken.userId,
      password,
      resetToken.user.passwordHash
    );

    if (isPasswordReused) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'To hasło było już używane wcześniej. Użyj innego hasła.',
      });
    }

    // Hash new password
    const newPasswordHash = await this.argon2.hash(password);

    // Update password and related records in transaction
    await this.prisma.$transaction(async (tx) => {
      // Save current password to history before changing
      await tx.passwordHistory.create({
        data: {
          userId: resetToken.userId,
          passwordHash: resetToken.user.passwordHash,
        },
      });

      // Update user password
      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash: newPasswordHash,
          passwordChangedAt: new Date(),
        },
      });

      // Mark token as used
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });

      // Invalidate all active sessions
      await tx.session.updateMany({
        where: {
          userId: resetToken.userId,
          isActive: true,
        },
        data: {
          isActive: false,
          revokedAt: new Date(),
          revokeReason: 'PASSWORD_RESET',
        },
      });

      // Clean up password history (keep only last 5)
      await this.cleanupPasswordHistory(tx, resetToken.userId);
    });

    // Log audit event
    await this.auditLogger.log({
      eventType: 'PASSWORD_RESET_COMPLETED',
      userId: resetToken.userId,
      ipAddress,
      userAgent,
      metadata: { email: resetToken.user.email },
      correlationId,
    });

    return {
      success: true,
      message: 'Hasło zostało zmienione pomyślnie.',
    };
  }

  /**
   * Validate reset token without using it
   */
  async validateResetToken(token: string): Promise<ValidateTokenResult> {
    // Validate token format
    if (token.length !== 64) {
      return { valid: false, reason: 'TOKEN_INVALID' };
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');

    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
      },
    });

    if (!resetToken) {
      return { valid: false, reason: 'TOKEN_INVALID' };
    }

    if (resetToken.expiresAt < new Date()) {
      return { valid: false, reason: 'TOKEN_EXPIRED' };
    }

    return { valid: true };
  }

  /**
   * Check if password was used before (last 5 passwords)
   */
  private async checkPasswordHistory(
    userId: string,
    newPassword: string,
    currentPasswordHash: string
  ): Promise<boolean> {
    // Check against current password
    const matchesCurrent = await this.argon2.verify(currentPasswordHash, newPassword);
    if (matchesCurrent) {
      return true;
    }

    // Get last 5 passwords from history
    const history = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Check against history
    for (const entry of history) {
      const matches = await this.argon2.verify(entry.passwordHash, newPassword);
      if (matches) {
        return true;
      }
    }

    return false;
  }

  /**
   * Keep only last 5 passwords in history
   */
  private async cleanupPasswordHistory(
    tx: PrismaClient | Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
    userId: string
  ): Promise<void> {
    const count = await tx.passwordHistory.count({
      where: { userId },
    });

    if (count > 5) {
      // Find oldest entries to delete
      const oldest = await tx.passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: count - 5,
      });

      if (oldest.length > 0) {
        await tx.passwordHistory.deleteMany({
          where: {
            id: { in: oldest.map((h) => h.id) },
          },
        });
      }
    }
  }

  /**
   * Ensure minimum response time for timing attack prevention
   */
  private async ensureMinResponseTime(startTime: number): Promise<void> {
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_RESPONSE_TIME) {
      await new Promise((resolve) => setTimeout(resolve, MIN_RESPONSE_TIME - elapsed));
    }
  }
}
