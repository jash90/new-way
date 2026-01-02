import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';

// Interfaces
export interface TokenServiceInterface {
  getTokenHash(token: string): string;
  decodeToken(token: string): Promise<{
    userId: string;
    sessionId: string;
    exp?: number;
  } | null>;
}

export interface Argon2ServiceInterface {
  verify(hash: string, password: string): Promise<boolean>;
}

export interface LogoutResult {
  success: boolean;
  message?: string;
  serverLogoutFailed?: boolean;
}

export interface LogoutAllResult {
  success: boolean;
  revokedCount: number;
}

export interface ForceLogoutResult {
  success: boolean;
}

export interface CleanupResult {
  deletedCount: number;
}

/**
 * LogoutService (AIM-006)
 * Handles secure logout operations with graceful degradation
 */
export class LogoutService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private tokenService: TokenServiceInterface,
    private auditLogger: AuditLogger,
    private argon2Service: Argon2ServiceInterface
  ) {}

  /**
   * Logout from current session
   * Implements graceful degradation - local logout succeeds even if server fails
   */
  async logout(params: {
    sessionId: string;
    userId: string;
    accessToken: string;
    ipAddress: string;
  }): Promise<LogoutResult> {
    const { sessionId, userId, accessToken, ipAddress } = params;
    let serverLogoutFailed = false;

    try {
      // Attempt server-side logout
      await this.performServerLogout(sessionId, userId, accessToken, ipAddress);
    } catch (error) {
      // Log the error but don't fail the logout
      console.error('Server-side logout failed:', error);
      serverLogoutFailed = true;
    }

    // Always try to invalidate Redis cache
    try {
      await this.invalidateSessionCache(sessionId);
    } catch (error) {
      console.error('Redis cache invalidation failed:', error);
    }

    return {
      success: true,
      message: 'Pomyślnie wylogowano',
      serverLogoutFailed,
    };
  }

  /**
   * Perform server-side logout operations
   */
  private async performServerLogout(
    sessionId: string,
    userId: string,
    accessToken: string,
    ipAddress: string
  ): Promise<void> {
    // Find the session
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    // If session not found or already revoked, skip database operations
    if (!session || session.revokedAt) {
      // Still try to blacklist the access token
      await this.blacklistAccessToken(accessToken);
      return;
    }

    // Use transaction for atomicity
    await this.prisma.$transaction(async (tx) => {
      // 1. Revoke the session
      await tx.session.update({
        where: { id: sessionId },
        data: {
          revokedAt: new Date(),
          revokeReason: 'USER_LOGOUT',
        },
      });

      // 2. Blacklist access token
      const accessTokenHash = this.tokenService.getTokenHash(accessToken);
      const decodedToken = await this.tokenService.decodeToken(accessToken);
      const accessTokenExpiry = decodedToken?.exp
        ? new Date(decodedToken.exp * 1000)
        : new Date(Date.now() + 15 * 60 * 1000); // Default 15 minutes

      await tx.blacklistedToken.create({
        data: {
          tokenHash: accessTokenHash,
          reason: 'USER_LOGOUT',
          expiresAt: accessTokenExpiry,
        },
      });

      // 3. Blacklist refresh token (using stored hash from session)
      if (session.refreshTokenHash) {
        await tx.blacklistedToken.create({
          data: {
            tokenHash: session.refreshTokenHash,
            reason: 'USER_LOGOUT',
            expiresAt: session.expiresAt,
          },
        });
      }
    });

    // 4. Create audit log
    await this.auditLogger.log({
      eventType: 'USER_LOGOUT',
      userId,
      ipAddress,
      metadata: {
        sessionId,
      },
    });
  }

  /**
   * Blacklist access token without database transaction
   */
  private async blacklistAccessToken(accessToken: string): Promise<void> {
    try {
      const accessTokenHash = this.tokenService.getTokenHash(accessToken);
      const decodedToken = await this.tokenService.decodeToken(accessToken);
      const accessTokenExpiry = decodedToken?.exp
        ? new Date(decodedToken.exp * 1000)
        : new Date(Date.now() + 15 * 60 * 1000);

      await this.prisma.blacklistedToken.create({
        data: {
          tokenHash: accessTokenHash,
          reason: 'USER_LOGOUT',
          expiresAt: accessTokenExpiry,
        },
      });
    } catch (error) {
      console.error('Failed to blacklist access token:', error);
    }
  }

  /**
   * Invalidate session cache in Redis
   */
  private async invalidateSessionCache(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
  }

  /**
   * Logout from all devices (requires password verification)
   */
  async logoutAllDevices(params: {
    userId: string;
    currentSessionId: string;
    password: string;
    ipAddress: string;
  }): Promise<LogoutAllResult> {
    const { userId, currentSessionId, password, ipAddress } = params;

    // 1. Find user and verify password
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Użytkownik nie został znaleziony',
      });
    }

    const isPasswordValid = await this.argon2Service.verify(
      user.passwordHash,
      password
    );

    if (!isPasswordValid) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Nieprawidłowe hasło',
      });
    }

    // 2. Find all active sessions except current
    const otherSessions = await this.prisma.session.findMany({
      where: {
        userId,
        id: { not: currentSessionId },
        revokedAt: null,
      },
      select: {
        id: true,
        tokenHash: true,
        refreshTokenHash: true,
        expiresAt: true,
      },
    });

    if (otherSessions.length === 0) {
      return { success: true, revokedCount: 0 };
    }

    // 3. Revoke all other sessions
    await this.prisma.$transaction(async (tx) => {
      // Revoke sessions
      await tx.session.updateMany({
        where: {
          userId,
          id: { not: currentSessionId },
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokeReason: 'LOGOUT_ALL_DEVICES',
        },
      });

      // Blacklist all tokens from other sessions
      const tokensToBlacklist = otherSessions.flatMap((session) => {
        const tokens = [];
        if (session.tokenHash) {
          tokens.push({
            tokenHash: session.tokenHash,
            reason: 'LOGOUT_ALL_DEVICES',
            expiresAt: new Date(Date.now() + 15 * 60 * 1000), // Access token expiry
          });
        }
        if (session.refreshTokenHash) {
          tokens.push({
            tokenHash: session.refreshTokenHash,
            reason: 'LOGOUT_ALL_DEVICES',
            expiresAt: session.expiresAt,
          });
        }
        return tokens;
      });

      if (tokensToBlacklist.length > 0) {
        await tx.blacklistedToken.createMany({
          data: tokensToBlacklist,
        });
      }
    });

    // 4. Invalidate Redis cache for all sessions
    try {
      const sessionKeys = await this.redis.keys(`session:*`);
      const keysToDelete = sessionKeys.filter((key) =>
        otherSessions.some((s) => key.includes(s.id))
      );
      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete);
      }
    } catch (error) {
      console.error('Failed to invalidate Redis cache:', error);
    }

    // 5. Create audit log
    await this.auditLogger.log({
      eventType: 'LOGOUT_ALL_DEVICES',
      userId,
      ipAddress,
      metadata: {
        revokedSessionCount: otherSessions.length,
        currentSessionPreserved: currentSessionId,
      },
    });

    return {
      success: true,
      revokedCount: otherSessions.length,
    };
  }

  /**
   * Force logout a session (admin action)
   */
  async forceLogout(params: {
    sessionId: string;
    adminUserId: string;
    reason: string;
    ipAddress: string;
  }): Promise<ForceLogoutResult> {
    const { sessionId, adminUserId, reason, ipAddress } = params;

    // Find the session
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!session) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Sesja nie została znaleziona',
      });
    }

    // Revoke the session
    await this.prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: { id: sessionId },
        data: {
          revokedAt: new Date(),
          revokeReason: 'ADMIN_FORCE_LOGOUT',
        },
      });

      // Blacklist tokens
      const tokensToBlacklist = [];
      if (session.tokenHash) {
        tokensToBlacklist.push({
          tokenHash: session.tokenHash,
          reason: 'ADMIN_FORCE_LOGOUT',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        });
      }
      if (session.refreshTokenHash) {
        tokensToBlacklist.push({
          tokenHash: session.refreshTokenHash,
          reason: 'ADMIN_FORCE_LOGOUT',
          expiresAt: session.expiresAt,
        });
      }

      if (tokensToBlacklist.length > 0) {
        await tx.blacklistedToken.createMany({
          data: tokensToBlacklist,
        });
      }
    });

    // Invalidate Redis cache
    try {
      await this.invalidateSessionCache(sessionId);
    } catch (error) {
      console.error('Failed to invalidate Redis cache:', error);
    }

    // Create audit log
    await this.auditLogger.log({
      eventType: 'ADMIN_FORCE_LOGOUT',
      userId: session.userId,
      ipAddress,
      metadata: {
        adminUserId,
        reason,
        sessionId,
        userEmail: session.user?.email,
      },
    });

    return { success: true };
  }

  /**
   * Cleanup expired blacklisted tokens
   */
  async cleanupExpiredTokens(): Promise<CleanupResult> {
    const result = await this.prisma.blacklistedToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return { deletedCount: result.count };
  }
}
