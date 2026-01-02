import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../../trpc';
import {
  sessionRefreshSchema,
  sessionRevokeSchema,
  sessionRevokeAllSchema,
} from '@ksiegowacrm/shared';
import { SessionService } from '../../services/aim/session.service';
import { AuditLogger } from '../../utils/audit-logger';
import type { TokenServiceInterface, Argon2ServiceInterface } from '../../services/aim/session.service';

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
    tokenFamily?: string;
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: number;
    refreshTokenExpiresAt: number;
  }> {
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

  async verifyRefreshToken(token: string): Promise<{
    valid: boolean;
    payload?: {
      userId: string;
      sessionId: string;
      tokenFamily?: string;
    };
    error?: string;
  }> {
    const { TokenService: RealTokenService } = await import('@ksiegowacrm/auth');
    const tokenService = new RealTokenService({
      privateKey: process.env.JWT_PRIVATE_KEY || '',
      publicKey: process.env.JWT_PUBLIC_KEY || '',
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      issuer: 'ksiegowacrm',
      audience: 'ksiegowacrm-api',
    });
    try {
      // Real TokenService throws on invalid token, returns DecodedToken on success
      const decoded = await tokenService.verifyRefreshToken(token);
      return {
        valid: true,
        payload: {
          userId: decoded.userId,
          sessionId: decoded.sessionId,
          tokenFamily: (decoded as any).tokenFamily,
        },
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'TOKEN_INVALID',
      };
    }
  }

  getTokenHash(token: string): string {
    const { createHash } = require('crypto');
    return createHash('sha256').update(token).digest('hex');
  }

  async decodeToken(token: string): Promise<any> {
    const { TokenService: RealTokenService } = await import('@ksiegowacrm/auth');
    const tokenService = new RealTokenService({
      privateKey: process.env.JWT_PRIVATE_KEY || '',
      publicKey: process.env.JWT_PUBLIC_KEY || '',
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      issuer: 'ksiegowacrm',
      audience: 'ksiegowacrm-api',
    });
    // Use decodeToken if available, otherwise return null
    if ('decodeToken' in tokenService && typeof tokenService.decodeToken === 'function') {
      return tokenService.decodeToken(token);
    }
    return null;
  }
}

/**
 * Argon2 Service implementation
 */
class Argon2Service implements Argon2ServiceInterface {
  async verify(hash: string, password: string) {
    const { Argon2Service: RealArgon2Service } = await import('@ksiegowacrm/auth');
    const argon2 = new RealArgon2Service();
    return argon2.verify(hash, password);
  }

  async hash(password: string) {
    const { Argon2Service: RealArgon2Service } = await import('@ksiegowacrm/auth');
    const argon2 = new RealArgon2Service();
    return argon2.hash(password);
  }
}

/**
 * Session Router (AIM-005)
 * Handles session management, token refresh, session listing and revocation
 */
export const sessionRouter = router({
  /**
   * Refresh tokens (public procedure)
   * Implements token rotation - blacklists old refresh token
   */
  refresh: publicProcedure
    .input(sessionRefreshSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, ipAddress, userAgent } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const tokenService = new TokenService();
      const argon2Service = new Argon2Service();
      const sessionService = new SessionService(
        prisma,
        redis,
        tokenService,
        auditLogger,
        argon2Service
      );

      try {
        const result = await sessionService.refreshToken({
          refreshToken: input.refreshToken,
          ipAddress,
          userAgent,
        });

        return {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          accessTokenExpiresAt: result.accessTokenExpiresAt,
          refreshTokenExpiresAt: result.refreshTokenExpiresAt,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas odświeżania tokenu',
        });
      }
    }),

  /**
   * List all active sessions for the current user (protected procedure)
   * Returns sessions with device info and masked IP addresses
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const tokenService = new TokenService();
    const argon2Service = new Argon2Service();
    const sessionService = new SessionService(
      prisma,
      redis,
      tokenService,
      auditLogger,
      argon2Service
    );

    try {
      const sessions = await sessionService.getUserSessions({
        userId: session!.userId,
        currentSessionId: session!.sessionId,
      });

      return sessions;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas pobierania sesji',
      });
    }
  }),

  /**
   * Revoke a specific session (protected procedure)
   */
  revoke: protectedProcedure
    .input(sessionRevokeSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session, ipAddress } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const tokenService = new TokenService();
      const argon2Service = new Argon2Service();
      const sessionService = new SessionService(
        prisma,
        redis,
        tokenService,
        auditLogger,
        argon2Service
      );

      try {
        await sessionService.revokeSession({
          userId: session!.userId,
          sessionId: input.sessionId,
          reason: 'USER_REVOKED',
          ipAddress,
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas unieważniania sesji',
        });
      }
    }),

  /**
   * Revoke all sessions except current (protected procedure)
   * Requires password confirmation for security
   */
  revokeAll: protectedProcedure
    .input(sessionRevokeAllSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session, ipAddress } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const tokenService = new TokenService();
      const argon2Service = new Argon2Service();
      const sessionService = new SessionService(
        prisma,
        redis,
        tokenService,
        auditLogger,
        argon2Service
      );

      try {
        const result = await sessionService.revokeAllSessions({
          userId: session!.userId,
          currentSessionId: session!.sessionId,
          password: input.password,
          ipAddress,
        });

        return {
          success: true,
          revokedCount: result.revokedCount,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas unieważniania sesji',
        });
      }
    }),

  /**
   * Session heartbeat - extends session on user activity (protected procedure)
   * Returns timeout warning if approaching inactivity limit
   */
  heartbeat: protectedProcedure.mutation(async ({ ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const tokenService = new TokenService();
    const argon2Service = new Argon2Service();
    const sessionService = new SessionService(
      prisma,
      redis,
      tokenService,
      auditLogger,
      argon2Service
    );

    try {
      // First check timeout status
      const timeoutResult = await sessionService.checkSessionTimeout({
        sessionId: session!.sessionId,
      });

      if (!timeoutResult.valid) {
        return {
          valid: false,
          reason: timeoutResult.reason,
        };
      }

      // Extend session
      await sessionService.extendSession({
        sessionId: session!.sessionId,
        userId: session!.userId,
      });

      return {
        valid: true,
        showWarning: timeoutResult.showWarning,
        remainingMinutes: timeoutResult.remainingMinutes,
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas weryfikacji sesji',
      });
    }
  }),

  /**
   * Validate session and return user context (protected procedure)
   */
  validate: protectedProcedure.query(async ({ ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const tokenService = new TokenService();
    const argon2Service = new Argon2Service();
    const sessionService = new SessionService(
      prisma,
      redis,
      tokenService,
      auditLogger,
      argon2Service
    );

    try {
      const result = await sessionService.validateSession({
        sessionId: session!.sessionId,
        accessToken: '', // Token already validated by middleware
      });

      return result;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas walidacji sesji',
      });
    }
  }),
});

export type SessionRouter = typeof sessionRouter;
