import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';

// Constants
const MAX_CONCURRENT_SESSIONS = 5;
const INACTIVITY_TIMEOUT_MINUTES = 60;
const WARNING_THRESHOLD_MINUTES = 5;
const SESSION_CACHE_TTL_SECONDS = 3600; // 1 hour

// Interfaces
export interface TokenServiceInterface {
  generateTokenPair(params: {
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
  }>;
  verifyRefreshToken(token: string): Promise<{
    valid: boolean;
    payload?: {
      userId: string;
      sessionId: string;
      tokenFamily?: string;
    };
    error?: string;
  }>;
  getTokenHash(token: string): string;
  decodeToken(token: string): Promise<any>;
}

export interface Argon2ServiceInterface {
  verify(hash: string, password: string): Promise<boolean>;
  hash(password: string): Promise<string>;
}

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
}

export interface SessionInfo {
  id: string;
  isCurrent: boolean;
  device: DeviceInfo;
  ipAddress: string;
  location: string;
  lastActivityAt: Date;
  createdAt: Date;
}

export interface SessionValidationResult {
  valid: boolean;
  reason?: string;
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

export interface SessionTimeoutResult {
  valid: boolean;
  showWarning?: boolean;
  remainingMinutes?: number;
  reason?: string;
}

export class SessionService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private tokenService: TokenServiceInterface,
    private auditLogger: AuditLogger,
    private argon2Service: Argon2ServiceInterface
  ) {}

  /**
   * Refresh tokens with rotation - blacklists old refresh token
   */
  async refreshToken(params: {
    refreshToken: string;
    ipAddress: string;
    userAgent?: string;
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: number;
    refreshTokenExpiresAt: number;
  }> {
    const { refreshToken, ipAddress, userAgent } = params;
    const tokenHash = this.tokenService.getTokenHash(refreshToken);

    // Check if token is already blacklisted (potential reuse attack)
    const isBlacklisted = await this.prisma.blacklistedToken.findUnique({
      where: { tokenHash },
    });

    if (isBlacklisted) {
      // Token reuse detected - invalidate entire token family
      const tokenPayload = await this.tokenService.verifyRefreshToken(refreshToken);

      if (tokenPayload.valid && tokenPayload.payload?.tokenFamily) {
        // Note: tokenFamily field not in Session schema - revoke by session ID instead
        await this.prisma.session.updateMany({
          where: { id: tokenPayload.payload.sessionId },
          data: {
            revokedAt: new Date(),
            revokeReason: 'TOKEN_REUSE_DETECTED',
          },
        });

        await this.auditLogger.log({
          eventType: 'TOKEN_REUSE_DETECTED',
          userId: tokenPayload.payload.userId,
          ipAddress,
          metadata: {
            tokenFamily: tokenPayload.payload.tokenFamily,
          },
        });
      }

      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Token has been revoked',
      });
    }

    // Verify refresh token
    const verificationResult = await this.tokenService.verifyRefreshToken(refreshToken);

    if (!verificationResult.valid) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: verificationResult.error || 'Invalid refresh token',
      });
    }

    const { userId, sessionId, tokenFamily } = verificationResult.payload!;

    // Get session
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Session not found',
      });
    }

    if (session.revokedAt) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Session has been revoked',
      });
    }

    if (session.expiresAt < new Date()) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Session has expired',
      });
    }

    // Get user with roles
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User not found',
      });
    }

    // Get user roles
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    const roles = userRoles.map((ur) => ur.role.name);

    // Note: UserOrganization model not in schema yet - use default org ID
    // TODO: Add UserOrganization model for multi-tenant support
    const organizationId = 'default';

    // Blacklist old refresh token (rotation)
    await this.prisma.blacklistedToken.create({
      data: {
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        reason: 'TOKEN_ROTATED',
      },
    });

    // Generate new token pair
    const newTokens = await this.tokenService.generateTokenPair({
      userId,
      email: user.email,
      roles,
      organizationId,
      sessionId,
      tokenFamily,
    });

    // Update session with new refresh token hash and activity
    const newRefreshTokenHash = this.tokenService.getTokenHash(newTokens.refreshToken);
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        lastActivityAt: new Date(),
        refreshTokenHash: newRefreshTokenHash,
        ipAddress,
        userAgent,
      },
    });

    // Log token refresh
    await this.auditLogger.log({
      eventType: 'TOKEN_REFRESHED',
      userId,
      ipAddress,
      metadata: {
        sessionId,
      },
    });

    return newTokens;
  }

  /**
   * Get all active sessions for a user with device info
   */
  async getUserSessions(params: {
    userId: string;
    currentSessionId: string;
  }): Promise<SessionInfo[]> {
    const { userId, currentSessionId } = params;

    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    return sessions.map((session) => ({
      id: session.id,
      isCurrent: session.id === currentSessionId,
      device: this.parseUserAgent(session.userAgent),
      ipAddress: this.maskIpAddress(session.ipAddress),
      location: this.formatLocation(session.city, session.country),
      lastActivityAt: session.lastActivityAt,
      createdAt: session.createdAt,
    }));
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(params: {
    userId: string;
    sessionId: string;
    reason: string;
    ipAddress?: string;
  }): Promise<void> {
    const { userId, sessionId, reason, ipAddress } = params;

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Session not found',
      });
    }

    if (session.userId !== userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Cannot revoke another user\'s session',
      });
    }

    // Revoke session
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revokeReason: reason,
        isActive: false,
      },
    });

    // Blacklist tokens
    if (session.tokenHash) {
      await this.prisma.blacklistedToken.create({
        data: {
          tokenHash: session.tokenHash,
          expiresAt: session.expiresAt,
          reason: 'SESSION_REVOKED',
        },
      });
    }

    if (session.refreshTokenHash) {
      await this.prisma.blacklistedToken.create({
        data: {
          tokenHash: session.refreshTokenHash,
          expiresAt: session.expiresAt,
          reason: 'SESSION_REVOKED',
        },
      });
    }

    // Clear from Redis cache
    await this.redis.del(`session:${sessionId}`);

    // Audit log
    await this.auditLogger.log({
      eventType: 'SESSION_REVOKED',
      userId,
      ipAddress,
      metadata: {
        sessionId,
        reason,
      },
    });
  }

  /**
   * Revoke all sessions except current (requires password confirmation)
   */
  async revokeAllSessions(params: {
    userId: string;
    currentSessionId: string;
    password: string;
    ipAddress: string;
  }): Promise<{ revokedCount: number }> {
    const { userId, currentSessionId, password, ipAddress } = params;

    // Get user and verify password
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    const isValidPassword = await this.argon2Service.verify(user.passwordHash, password);

    if (!isValidPassword) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Nieprawidłowe hasło',
      });
    }

    // Get sessions to revoke (all except current)
    const sessionsToRevoke = await this.prisma.session.findMany({
      where: {
        userId,
        id: { not: currentSessionId },
        revokedAt: null,
      },
    });

    // Blacklist all tokens from sessions being revoked
    for (const session of sessionsToRevoke) {
      if (session.tokenHash) {
        await this.prisma.blacklistedToken.create({
          data: {
            tokenHash: session.tokenHash,
            expiresAt: session.expiresAt,
            reason: 'USER_REVOKED_ALL',
          },
        });
      }
      if (session.refreshTokenHash) {
        await this.prisma.blacklistedToken.create({
          data: {
            tokenHash: session.refreshTokenHash,
            expiresAt: session.expiresAt,
            reason: 'USER_REVOKED_ALL',
          },
        });
      }

      // Clear from Redis
      await this.redis.del(`session:${session.id}`);
    }

    // Bulk revoke sessions
    await this.prisma.session.updateMany({
      where: {
        userId,
        id: { not: currentSessionId },
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: 'USER_REVOKED_ALL',
        isActive: false,
      },
    });

    // Audit log
    await this.auditLogger.log({
      eventType: 'ALL_SESSIONS_REVOKED',
      userId,
      ipAddress,
      metadata: {
        revokedCount: sessionsToRevoke.length,
        excludedSessionId: currentSessionId,
      },
    });

    return { revokedCount: sessionsToRevoke.length };
  }

  /**
   * Extend session on user activity (heartbeat)
   */
  async extendSession(params: {
    sessionId: string;
    userId: string;
  }): Promise<void> {
    const { sessionId, userId: _userId } = params;

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Session not found',
      });
    }

    if (session.revokedAt) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Session has been revoked',
      });
    }

    if (session.expiresAt < new Date()) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Session has expired',
      });
    }

    // Update last activity
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        lastActivityAt: new Date(),
      },
    });

    // Update Redis cache TTL
    await this.redis.expire(`session:${sessionId}`, SESSION_CACHE_TTL_SECONDS);
  }

  /**
   * Check session timeout status
   */
  async checkSessionTimeout(params: {
    sessionId: string;
  }): Promise<SessionTimeoutResult> {
    const { sessionId } = params;

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return { valid: false, reason: 'SESSION_NOT_FOUND' };
    }

    if (session.revokedAt) {
      return { valid: false, reason: 'SESSION_REVOKED' };
    }

    const now = new Date();
    const lastActivity = session.lastActivityAt;
    const minutesSinceActivity = Math.floor(
      (now.getTime() - lastActivity.getTime()) / (1000 * 60)
    );

    const remainingMinutes = INACTIVITY_TIMEOUT_MINUTES - minutesSinceActivity;

    if (remainingMinutes <= 0) {
      // Session timed out - auto-revoke
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          revokedAt: new Date(),
          revokeReason: 'INACTIVITY_TIMEOUT',
          isActive: false,
        },
      });

      return { valid: false, reason: 'INACTIVITY_TIMEOUT' };
    }

    const showWarning = remainingMinutes <= WARNING_THRESHOLD_MINUTES;

    return {
      valid: true,
      showWarning,
      remainingMinutes,
    };
  }

  /**
   * Enforce concurrent sessions limit (max 5)
   */
  async enforceSessionLimit(params: {
    userId: string;
  }): Promise<{ allowed: boolean; currentCount: number; revokedSessionId?: string }> {
    const { userId } = params;

    const activeSessionsCount = await this.prisma.session.count({
      where: {
        userId,
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
    });

    if (activeSessionsCount < MAX_CONCURRENT_SESSIONS) {
      return {
        allowed: true,
        currentCount: activeSessionsCount,
      };
    }

    // At or over limit - revoke oldest session
    const oldestSession = await this.prisma.session.findFirst({
      where: {
        userId,
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (oldestSession) {
      await this.prisma.session.update({
        where: { id: oldestSession.id },
        data: {
          revokedAt: new Date(),
          revokeReason: 'CONCURRENT_LIMIT_ENFORCED',
          isActive: false,
        },
      });

      // Clear from Redis
      await this.redis.del(`session:${oldestSession.id}`);

      // Audit log
      await this.auditLogger.log({
        eventType: 'CONCURRENT_LIMIT_ENFORCED',
        userId,
        metadata: {
          revokedSessionId: oldestSession.id,
          limit: MAX_CONCURRENT_SESSIONS,
        },
      });

      return {
        allowed: true,
        currentCount: activeSessionsCount,
        revokedSessionId: oldestSession.id,
      };
    }

    return {
      allowed: true,
      currentCount: activeSessionsCount,
    };
  }

  /**
   * Validate session and return user context
   */
  async validateSession(params: {
    sessionId: string;
    accessToken: string;
  }): Promise<SessionValidationResult> {
    const { sessionId, accessToken: _accessToken } = params;

    // Try Redis cache first
    let sessionData: any = null;

    try {
      const cached = await this.redis.get(`session:${sessionId}`);
      if (cached) {
        sessionData = JSON.parse(cached);
      }
    } catch {
      // Redis error - fall through to database
    }

    // If not in cache, check database
    if (!sessionData) {
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          user: {
            include: {
              userRoles: {
                include: {
                  role: true,
                },
              },
            },
          },
        },
      });

      if (!session) {
        return { valid: false, reason: 'SESSION_NOT_FOUND' };
      }

      if (session.revokedAt) {
        return { valid: false, reason: 'SESSION_REVOKED' };
      }

      if (session.expiresAt < new Date()) {
        return { valid: false, reason: 'SESSION_EXPIRED' };
      }

      sessionData = {
        ...session,
        user: session.user,
      };

      // Cache in Redis
      try {
        await this.redis.setex(
          `session:${sessionId}`,
          SESSION_CACHE_TTL_SECONDS,
          JSON.stringify(sessionData)
        );
      } catch {
        // Redis error - continue without caching
      }
    }

    // Validate session state
    if (sessionData.revokedAt) {
      return { valid: false, reason: 'SESSION_REVOKED' };
    }

    if (new Date(sessionData.expiresAt) < new Date()) {
      return { valid: false, reason: 'SESSION_EXPIRED' };
    }

    const roles = sessionData.user?.userRoles?.map((ur: any) => ur.role.name) || [];

    return {
      valid: true,
      user: {
        id: sessionData.userId,
        email: sessionData.user?.email,
        roles,
      },
    };
  }

  /**
   * Check if a token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const tokenHash = this.tokenService.getTokenHash(token);

    // Check Redis cache first
    try {
      const exists = await this.redis.exists(`blacklist:${tokenHash}`);
      if (exists) {
        return true;
      }
    } catch {
      // Redis error - fall through to database
    }

    // Check database
    const blacklisted = await this.prisma.blacklistedToken.findUnique({
      where: { tokenHash },
    });

    return !!blacklisted;
  }

  /**
   * Cleanup expired blacklisted tokens (scheduled task)
   */
  async cleanupExpiredBlacklistedTokens(): Promise<{ deletedCount: number }> {
    const result = await this.prisma.blacklistedToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return { deletedCount: result.count };
  }

  // =========================================================================
  // Private Helper Methods
  // =========================================================================

  /**
   * Parse user agent string to extract device info
   */
  private parseUserAgent(userAgent?: string | null): DeviceInfo {
    if (!userAgent) {
      return { type: 'unknown', browser: 'Unknown', os: 'Unknown' };
    }

    let type: DeviceInfo['type'] = 'desktop';
    let browser = 'Unknown';
    let os = 'Unknown';

    // Detect device type
    if (/iPhone|iPad|iPod|Android|Mobile/i.test(userAgent)) {
      type = /iPad|Tablet/i.test(userAgent) ? 'tablet' : 'mobile';
    }

    // Detect browser (order matters - check more specific patterns first)
    if (/Edg/i.test(userAgent)) {
      browser = 'Edge';
    } else if (/Firefox/i.test(userAgent)) {
      browser = 'Firefox';
    } else if (/Chrome/i.test(userAgent)) {
      browser = 'Chrome';
    } else if (/Safari/i.test(userAgent)) {
      browser = 'Safari';
    }

    // Detect OS (order matters - check more specific patterns first)
    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      os = 'iOS';
    } else if (/Android/i.test(userAgent)) {
      os = 'Android';
    } else if (/Windows/i.test(userAgent)) {
      os = 'Windows';
    } else if (/Mac OS X|Macintosh/i.test(userAgent)) {
      os = 'macOS';
    } else if (/Linux/i.test(userAgent)) {
      os = 'Linux';
    }

    return { type, browser, os };
  }

  /**
   * Mask IP address for privacy (show only last octet)
   */
  private maskIpAddress(ip?: string | null): string {
    if (!ip) {
      return '***.***.***.***';
    }

    const parts = ip.split('.');
    if (parts.length !== 4) {
      return '***.***.***.***';
    }

    return `***.***.***.${parts[3]}`;
  }

  /**
   * Format location string from city and country
   */
  private formatLocation(city?: string | null, country?: string | null): string {
    if (city && country) {
      return `${city}, ${country}`;
    }
    if (country) {
      return country;
    }
    if (city) {
      return city;
    }
    return 'Unknown';
  }
}
