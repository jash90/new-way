import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc';
import { logoutAllRequestSchema } from '@ksiegowacrm/shared';
import { LogoutService } from '../../services/aim/logout.service';
import { AuditLogger } from '../../utils/audit-logger';
import type { TokenServiceInterface, Argon2ServiceInterface } from '../../services/aim/logout.service';

/**
 * Token Service implementation for logout
 */
class TokenService implements TokenServiceInterface {
  getTokenHash(token: string): string {
    const { createHash } = require('crypto');
    return createHash('sha256').update(token).digest('hex');
  }

  async decodeToken(token: string): Promise<{
    userId: string;
    sessionId: string;
    exp?: number;
  } | null> {
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
      // Use decodeToken if available, otherwise try to verify
      if ('decodeToken' in tokenService && typeof tokenService.decodeToken === 'function') {
        return tokenService.decodeToken(token);
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Argon2 Service implementation
 */
class Argon2Service implements Argon2ServiceInterface {
  async verify(hash: string, password: string): Promise<boolean> {
    const { Argon2Service: RealArgon2Service } = await import('@ksiegowacrm/auth');
    const argon2 = new RealArgon2Service();
    return argon2.verify(hash, password);
  }
}

/**
 * Logout Router (AIM-006)
 * Handles secure logout operations
 */
export const logoutRouter = router({
  /**
   * Logout from current session (protected procedure)
   * Implements graceful degradation - returns success even if server-side logout fails
   */
  logout: protectedProcedure
    .input(z.object({}).optional())
    .mutation(async ({ ctx }) => {
      const { prisma, redis, session, ipAddress, accessToken } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const tokenService = new TokenService();
      const argon2Service = new Argon2Service();
      const logoutService = new LogoutService(
        prisma,
        redis,
        tokenService,
        auditLogger,
        argon2Service
      );

      try {
        const result = await logoutService.logout({
          sessionId: session!.sessionId,
          userId: session!.userId,
          accessToken: accessToken || '',
          ipAddress,
        });

        return {
          success: result.success,
          message: result.message,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        // Graceful degradation - still return success for local logout
        return {
          success: true,
          message: 'Wylogowano lokalnie',
          serverLogoutFailed: true,
        };
      }
    }),

  /**
   * Logout from all devices (protected procedure)
   * Requires password confirmation for security
   */
  logoutAll: protectedProcedure
    .input(logoutAllRequestSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session, ipAddress } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const tokenService = new TokenService();
      const argon2Service = new Argon2Service();
      const logoutService = new LogoutService(
        prisma,
        redis,
        tokenService,
        auditLogger,
        argon2Service
      );

      try {
        const result = await logoutService.logoutAllDevices({
          userId: session!.userId,
          currentSessionId: session!.sessionId,
          password: input.password,
          ipAddress,
        });

        return {
          success: result.success,
          revokedCount: result.revokedCount,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas wylogowywania ze wszystkich urządzeń',
        });
      }
    }),
});

export type LogoutRouter = typeof logoutRouter;
