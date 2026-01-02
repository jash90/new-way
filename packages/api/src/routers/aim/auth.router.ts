import { TRPCError } from '@trpc/server';
import { router, publicProcedure } from '../../trpc';
import {
  loginInputSchema,
  mfaVerificationSchema,
  backupCodeVerificationSchema,
} from '@ksiegowacrm/shared';
import { AuthService } from '../../services/aim/auth.service';
import { AuditLogger } from '../../utils/audit-logger';
import type { TokenServiceInterface } from '../../services/aim/auth.service';

/**
 * Token Service implementation
 * Uses RS256 algorithm as required by Constitution
 */
class TokenService implements TokenServiceInterface {
  async generateTokenPair(payload: {
    userId: string;
    email: string;
    roles: string[];
    organizationId: string;
    sessionId: string;
  }) {
    // In production, this would use actual JWT signing with RS256
    // For now, return mock tokens that will be replaced by real implementation
    const { TokenService: RealTokenService } = await import('@ksiegowacrm/auth');
    const tokenService = new RealTokenService({
      privateKey: process.env.JWT_PRIVATE_KEY || '',
      publicKey: process.env.JWT_PUBLIC_KEY || '',
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      issuer: 'ksiegowacrm',
      audience: 'ksiegowacrm-api',
    });
    return tokenService.generateTokenPair(payload);
  }

  getTokenHash(token: string): string {
    const { createHash } = require('crypto');
    return createHash('sha256').update(token).digest('hex');
  }
}

/**
 * Auth Router (AIM-003)
 * Handles user login, MFA verification, session creation
 */
export const authRouter = router({
  /**
   * Login with email and password
   */
  login: publicProcedure.input(loginInputSchema).mutation(async ({ input, ctx }) => {
    const { prisma, redis, ipAddress, userAgent, correlationId } = ctx;

    // Initialize services
    const auditLogger = new AuditLogger(prisma);
    const tokenService = new TokenService();
    const authService = new AuthService(prisma, redis, tokenService, auditLogger);

    try {
      const result = await authService.login({
        email: input.email,
        password: input.password,
        ipAddress,
        userAgent,
        rememberMe: input.rememberMe,
        correlationId,
      });

      if (result.mfaRequired) {
        return {
          success: true,
          mfaRequired: true,
          mfaChallengeId: result.mfaChallengeId,
          accessToken: '',
          refreshToken: '',
          accessTokenExpiresAt: 0,
          refreshTokenExpiresAt: 0,
          sessionId: '',
          userId: result.userId,
        };
      }

      return {
        success: true,
        mfaRequired: false,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
        refreshTokenExpiresAt: result.refreshTokenExpiresAt,
        sessionId: result.sessionId,
        userId: result.userId,
        isNewDevice: result.isNewDevice,
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas logowania',
      });
    }
  }),

  /**
   * Verify MFA TOTP code
   */
  verifyMfa: publicProcedure
    .input(mfaVerificationSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, ipAddress, userAgent, correlationId } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const tokenService = new TokenService();
      const authService = new AuthService(prisma, redis, tokenService, auditLogger);

      try {
        const result = await authService.verifyMfaChallenge({
          challengeId: input.challengeId,
          code: input.code,
          ipAddress,
          userAgent,
          correlationId,
        });

        return {
          success: true,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          accessTokenExpiresAt: result.accessTokenExpiresAt,
          refreshTokenExpiresAt: result.refreshTokenExpiresAt,
          sessionId: result.sessionId,
          userId: result.userId,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas weryfikacji MFA',
        });
      }
    }),

  /**
   * Verify backup code for MFA recovery
   */
  verifyBackupCode: publicProcedure
    .input(backupCodeVerificationSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, ipAddress, userAgent, correlationId } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const tokenService = new TokenService();
      const authService = new AuthService(prisma, redis, tokenService, auditLogger);

      try {
        // For backup code verification, we use the same flow as MFA
        // but with the backup code instead of TOTP
        const result = await authService.verifyMfaChallenge({
          challengeId: input.challengeId,
          code: input.code, // Backup code treated as verification code
          ipAddress,
          userAgent,
          correlationId,
        });

        return {
          success: true,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          accessTokenExpiresAt: result.accessTokenExpiresAt,
          refreshTokenExpiresAt: result.refreshTokenExpiresAt,
          sessionId: result.sessionId,
          userId: result.userId,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas weryfikacji kodu zapasowego',
        });
      }
    }),
});

export type AuthRouter = typeof authRouter;
