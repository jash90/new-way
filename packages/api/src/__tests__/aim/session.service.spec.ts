import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { SessionService } from '../../services/aim/session.service';
import { AuditLogger } from '../../utils/audit-logger';

// Mock dependencies
const mockPrisma = {
  session: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
  },
  blacklistedToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  userRole: {
    findMany: vi.fn(),
  },
  userOrganization: {
    findFirst: vi.fn(),
  },
  authAuditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  keys: vi.fn(),
  pipeline: vi.fn(() => ({
    del: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
};

const mockTokenService = {
  generateTokenPair: vi.fn().mockResolvedValue({
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
    accessTokenExpiresAt: Date.now() + 15 * 60 * 1000,
    refreshTokenExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  }),
  verifyRefreshToken: vi.fn(),
  getTokenHash: vi.fn().mockReturnValue('mock-token-hash'),
  decodeToken: vi.fn(),
};

const mockArgon2Service = {
  verify: vi.fn(),
  hash: vi.fn(),
};

describe('SessionService', () => {
  let sessionService: SessionService;
  let auditLogger: AuditLogger;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    status: 'ACTIVE',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockSession = {
    id: 'session-123',
    userId: 'user-123',
    tokenHash: 'token-hash-123',
    refreshTokenHash: 'refresh-hash-123',
    tokenFamily: 'family-123',
    deviceFingerprint: 'device-fp-123',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ipAddress: '192.168.1.100',
    city: 'Warsaw',
    country: 'Poland',
    isActive: true,
    isRemembered: false,
    lastActivityAt: new Date('2025-01-15T11:30:00.000Z'),
    expiresAt: new Date('2025-01-22T12:00:00.000Z'),
    revokedAt: null,
    revokeReason: null,
    createdAt: new Date('2025-01-15T12:00:00.000Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));

    auditLogger = new AuditLogger(mockPrisma as any);
    sessionService = new SessionService(
      mockPrisma as any,
      mockRedis as any,
      mockTokenService as any,
      auditLogger,
      mockArgon2Service as any
    );

    // Default mocks
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.exists.mockResolvedValue(0);

    mockPrisma.userRole.findMany.mockResolvedValue([
      { role: { name: 'USER' } },
    ]);
    mockPrisma.userOrganization.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // AC1: Token Refresh with Rotation
  // =========================================================================
  describe('refreshToken', () => {
    it('should refresh tokens and rotate refresh token', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      mockTokenService.verifyRefreshToken.mockResolvedValue({
        valid: true,
        payload: {
          userId: 'user-123',
          sessionId: 'session-123',
          tokenFamily: 'family-123',
        },
      });
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.blacklistedToken.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await sessionService.refreshToken({
        refreshToken,
        ipAddress: '192.168.1.100',
      });

      // Assert
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.refreshToken).not.toBe(refreshToken);
      expect(mockPrisma.blacklistedToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tokenHash: expect.any(String),
          reason: 'TOKEN_ROTATED',
        }),
      });
    });

    it('should reject blacklisted refresh token', async () => {
      // Arrange
      const refreshToken = 'blacklisted-token';
      mockTokenService.getTokenHash.mockReturnValue('blacklisted-hash');
      mockTokenService.verifyRefreshToken.mockResolvedValue({
        valid: true,
        payload: {
          userId: 'user-123',
          sessionId: 'session-123',
          tokenFamily: 'family-123',
        },
      });
      mockPrisma.blacklistedToken.findUnique.mockResolvedValue({
        id: 'bl-1',
        tokenHash: 'blacklisted-hash',
        expiresAt: new Date('2025-01-20'),
        reason: 'TOKEN_ROTATED',
        createdAt: new Date(),
      });

      // Act & Assert
      await expect(
        sessionService.refreshToken({
          refreshToken,
          ipAddress: '192.168.1.100',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should invalidate entire token family on reuse attack', async () => {
      // Arrange - Token that was already rotated (reuse attack)
      const reusedToken = 'reused-refresh-token';
      mockTokenService.verifyRefreshToken.mockResolvedValue({
        valid: true,
        payload: {
          userId: 'user-123',
          sessionId: 'session-123',
          tokenFamily: 'family-123',
        },
      });
      mockTokenService.getTokenHash.mockReturnValue('reused-token-hash');
      // Token is blacklisted - indicates reuse
      mockPrisma.blacklistedToken.findUnique.mockResolvedValue({
        id: 'bl-1',
        tokenHash: 'reused-token-hash',
        expiresAt: new Date('2025-01-20'),
        reason: 'TOKEN_ROTATED',
        createdAt: new Date(),
      });
      mockPrisma.session.findMany.mockResolvedValue([
        { ...mockSession, id: 'session-1' },
        { ...mockSession, id: 'session-2' },
      ]);

      // Act & Assert
      await expect(
        sessionService.refreshToken({
          refreshToken: reusedToken,
          ipAddress: '192.168.1.100',
        })
      ).rejects.toThrow(TRPCError);

      // All sessions with this token family should be revoked
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: { tokenFamily: 'family-123' },
        data: {
          revokedAt: expect.any(Date),
          revokeReason: 'TOKEN_REUSE_DETECTED',
        },
      });
    });

    it('should reject expired refresh token', async () => {
      // Arrange
      const expiredToken = 'expired-refresh-token';
      mockTokenService.verifyRefreshToken.mockResolvedValue({
        valid: false,
        error: 'TOKEN_EXPIRED',
      });

      // Act & Assert
      await expect(
        sessionService.refreshToken({
          refreshToken: expiredToken,
          ipAddress: '192.168.1.100',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should reject if session is revoked', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      mockTokenService.verifyRefreshToken.mockResolvedValue({
        valid: true,
        payload: {
          userId: 'user-123',
          sessionId: 'session-123',
          tokenFamily: 'family-123',
        },
      });
      mockPrisma.blacklistedToken.findUnique.mockResolvedValue(null);
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        revokedAt: new Date('2025-01-14'),
        revokeReason: 'USER_LOGOUT',
      });

      // Act & Assert
      await expect(
        sessionService.refreshToken({
          refreshToken,
          ipAddress: '192.168.1.100',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should update session activity on refresh', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      mockTokenService.verifyRefreshToken.mockResolvedValue({
        valid: true,
        payload: {
          userId: 'user-123',
          sessionId: 'session-123',
          tokenFamily: 'family-123',
        },
      });
      mockTokenService.generateTokenPair.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        accessTokenExpiresAt: Date.now() + 15 * 60 * 1000,
        refreshTokenExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });
      mockTokenService.getTokenHash.mockReturnValue('new-refresh-token-hash');
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.blacklistedToken.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Act
      await sessionService.refreshToken({
        refreshToken,
        ipAddress: '192.168.1.100',
      });

      // Assert
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: {
          lastActivityAt: expect.any(Date),
          refreshTokenHash: 'new-refresh-token-hash',
          ipAddress: '192.168.1.100',
          userAgent: undefined,
        },
      });
    });

    it('should log token refresh audit event', async () => {
      // Arrange
      const refreshToken = 'valid-refresh-token';
      mockTokenService.verifyRefreshToken.mockResolvedValue({
        valid: true,
        payload: {
          userId: 'user-123',
          sessionId: 'session-123',
          tokenFamily: 'family-123',
        },
      });
      mockTokenService.generateTokenPair.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        accessTokenExpiresAt: Date.now() + 15 * 60 * 1000,
        refreshTokenExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.blacklistedToken.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Act
      await sessionService.refreshToken({
        refreshToken,
        ipAddress: '192.168.1.100',
      });

      // Assert
      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'TOKEN_REFRESHED',
          userId: 'user-123',
        }),
      });
    });
  });

  // =========================================================================
  // AC2: Session Listing with Device Info
  // =========================================================================
  describe('getUserSessions', () => {
    const multipleSessions = [
      {
        ...mockSession,
        id: 'session-1',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        createdAt: new Date('2025-01-15T10:00:00.000Z'),
      },
      {
        ...mockSession,
        id: 'session-2',
        ipAddress: '10.0.0.50',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        createdAt: new Date('2025-01-14T08:00:00.000Z'),
      },
      {
        ...mockSession,
        id: 'session-3',
        ipAddress: '172.16.0.25',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        createdAt: new Date('2025-01-13T15:00:00.000Z'),
      },
    ];

    it('should return all active sessions for user', async () => {
      // Arrange
      mockPrisma.session.findMany.mockResolvedValue(multipleSessions);

      // Act
      const result = await sessionService.getUserSessions({
        userId: 'user-123',
        currentSessionId: 'session-1',
      });

      // Assert
      expect(result).toHaveLength(3);
      expect(mockPrisma.session.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          expiresAt: { gt: expect.any(Date) },
          revokedAt: null,
        },
        orderBy: { lastActivityAt: 'desc' },
      });
    });

    it('should mask IP addresses for privacy (show only last octet)', async () => {
      // Arrange
      mockPrisma.session.findMany.mockResolvedValue(multipleSessions);

      // Act
      const result = await sessionService.getUserSessions({
        userId: 'user-123',
        currentSessionId: 'session-1',
      });

      // Assert
      expect(result[0].ipAddress).toBe('***.***.***.100');
      expect(result[1].ipAddress).toBe('***.***.***.50');
      expect(result[2].ipAddress).toBe('***.***.***.25');
    });

    it('should indicate which session is current', async () => {
      // Arrange
      mockPrisma.session.findMany.mockResolvedValue(multipleSessions);

      // Act
      const result = await sessionService.getUserSessions({
        userId: 'user-123',
        currentSessionId: 'session-1',
      });

      // Assert
      expect(result[0].isCurrent).toBe(true);
      expect(result[1].isCurrent).toBe(false);
      expect(result[2].isCurrent).toBe(false);
    });

    it('should parse device info from user agent', async () => {
      // Arrange
      mockPrisma.session.findMany.mockResolvedValue(multipleSessions);

      // Act
      const result = await sessionService.getUserSessions({
        userId: 'user-123',
        currentSessionId: 'session-1',
      });

      // Assert
      expect(result[0].device).toEqual({
        type: 'desktop',
        browser: 'Chrome',
        os: 'Windows',
      });
      expect(result[1].device).toEqual({
        type: 'mobile',
        browser: 'Safari',
        os: 'iOS',
      });
      expect(result[2].device).toEqual({
        type: 'desktop',
        browser: 'Safari',
        os: 'macOS',
      });
    });

    it('should include location information', async () => {
      // Arrange
      mockPrisma.session.findMany.mockResolvedValue(multipleSessions);

      // Act
      const result = await sessionService.getUserSessions({
        userId: 'user-123',
        currentSessionId: 'session-1',
      });

      // Assert
      expect(result[0].location).toBe('Warsaw, Poland');
    });

    it('should return empty array if no active sessions', async () => {
      // Arrange
      mockPrisma.session.findMany.mockResolvedValue([]);

      // Act
      const result = await sessionService.getUserSessions({
        userId: 'user-123',
        currentSessionId: 'session-1',
      });

      // Assert
      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // AC3: Session Revocation
  // =========================================================================
  describe('revokeSession', () => {
    it('should revoke a specific session', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Act
      await sessionService.revokeSession({
        userId: 'user-123',
        sessionId: 'session-123',
        reason: 'USER_LOGOUT',
      });

      // Assert
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: {
          revokedAt: expect.any(Date),
          revokeReason: 'USER_LOGOUT',
          isActive: false,
        },
      });
    });

    it('should blacklist session tokens on revocation', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Act
      await sessionService.revokeSession({
        userId: 'user-123',
        sessionId: 'session-123',
        reason: 'USER_LOGOUT',
      });

      // Assert
      expect(mockPrisma.blacklistedToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tokenHash: 'token-hash-123',
          reason: 'SESSION_REVOKED',
        }),
      });
    });

    it('should clear session from Redis cache', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Act
      await sessionService.revokeSession({
        userId: 'user-123',
        sessionId: 'session-123',
        reason: 'USER_LOGOUT',
      });

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith('session:session-123');
    });

    it('should not allow revoking another users session', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        userId: 'other-user-456',
      });

      // Act & Assert
      await expect(
        sessionService.revokeSession({
          userId: 'user-123',
          sessionId: 'session-123',
          reason: 'USER_LOGOUT',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw if session not found', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        sessionService.revokeSession({
          userId: 'user-123',
          sessionId: 'non-existent',
          reason: 'USER_LOGOUT',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should log session revocation audit event', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Act
      await sessionService.revokeSession({
        userId: 'user-123',
        sessionId: 'session-123',
        reason: 'USER_LOGOUT',
      });

      // Assert
      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'SESSION_REVOKED',
          userId: 'user-123',
          metadata: expect.objectContaining({
            sessionId: 'session-123',
            reason: 'USER_LOGOUT',
          }),
        }),
      });
    });
  });

  describe('revokeAllSessions', () => {
    const userWithPassword = {
      ...mockUser,
      passwordHash: 'hashed-password',
    };

    it('should require password confirmation', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(userWithPassword);
      mockArgon2Service.verify.mockResolvedValue(false);

      // Act & Assert
      await expect(
        sessionService.revokeAllSessions({
          userId: 'user-123',
          currentSessionId: 'session-123',
          password: 'wrong-password',
          ipAddress: '192.168.1.100',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should revoke all sessions except current', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(userWithPassword);
      mockArgon2Service.verify.mockResolvedValue(true);
      // findMany returns sessions to revoke (excluding current)
      mockPrisma.session.findMany.mockResolvedValue([
        { ...mockSession, id: 'session-2' },
        { ...mockSession, id: 'session-3' },
      ]);

      // Act
      const result = await sessionService.revokeAllSessions({
        userId: 'user-123',
        currentSessionId: 'session-1',
        password: 'correct-password',
        ipAddress: '192.168.1.100',
      });

      // Assert
      expect(result.revokedCount).toBe(2);
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          id: { not: 'session-1' },
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
          revokeReason: 'USER_REVOKED_ALL',
          isActive: false,
        },
      });
    });

    it('should blacklist all revoked session tokens', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(userWithPassword);
      mockArgon2Service.verify.mockResolvedValue(true);
      mockPrisma.session.findMany.mockResolvedValue([
        { ...mockSession, id: 'session-2', tokenHash: 'hash-2', refreshTokenHash: 'refresh-2' },
        { ...mockSession, id: 'session-3', tokenHash: 'hash-3', refreshTokenHash: 'refresh-3' },
      ]);

      // Act
      await sessionService.revokeAllSessions({
        userId: 'user-123',
        currentSessionId: 'session-1',
        password: 'correct-password',
        ipAddress: '192.168.1.100',
      });

      // Assert
      expect(mockPrisma.blacklistedToken.create).toHaveBeenCalledTimes(4); // 2 access + 2 refresh tokens
    });

    it('should log bulk revocation audit event', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(userWithPassword);
      mockArgon2Service.verify.mockResolvedValue(true);
      mockPrisma.session.findMany.mockResolvedValue([
        { ...mockSession, id: 'session-2' },
      ]);

      // Act
      await sessionService.revokeAllSessions({
        userId: 'user-123',
        currentSessionId: 'session-1',
        password: 'correct-password',
        ipAddress: '192.168.1.100',
      });

      // Assert
      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'ALL_SESSIONS_REVOKED',
          userId: 'user-123',
          metadata: expect.objectContaining({
            revokedCount: 1,
            excludedSessionId: 'session-1',
          }),
        }),
      });
    });
  });

  // =========================================================================
  // AC4: Inactivity Timeout
  // =========================================================================
  describe('extendSession', () => {
    it('should extend session on user activity', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Act
      await sessionService.extendSession({
        sessionId: 'session-123',
        userId: 'user-123',
      });

      // Assert
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: {
          lastActivityAt: expect.any(Date),
        },
      });
    });

    it('should update Redis session cache TTL', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Act
      await sessionService.extendSession({
        sessionId: 'session-123',
        userId: 'user-123',
      });

      // Assert
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'session:session-123',
        3600 // 1 hour in seconds
      );
    });

    it('should not extend revoked session', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        revokedAt: new Date(),
      });

      // Act & Assert
      await expect(
        sessionService.extendSession({
          sessionId: 'session-123',
          userId: 'user-123',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should not extend expired session', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        expiresAt: new Date('2025-01-10T12:00:00.000Z'), // Already expired
      });

      // Act & Assert
      await expect(
        sessionService.extendSession({
          sessionId: 'session-123',
          userId: 'user-123',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('checkSessionTimeout', () => {
    it('should return valid for active session within timeout', async () => {
      // Arrange - Last activity 30 mins ago (within 1 hour timeout)
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        lastActivityAt: new Date('2025-01-15T11:30:00.000Z'),
      });

      // Act
      const result = await sessionService.checkSessionTimeout({
        sessionId: 'session-123',
      });

      // Assert
      expect(result.valid).toBe(true);
      expect(result.remainingMinutes).toBe(30);
    });

    it('should return warning when approaching timeout (5 min warning)', async () => {
      // Arrange - Last activity 56 mins ago (4 mins remaining)
      vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        lastActivityAt: new Date('2025-01-15T11:04:00.000Z'),
      });

      // Act
      const result = await sessionService.checkSessionTimeout({
        sessionId: 'session-123',
      });

      // Assert
      expect(result.valid).toBe(true);
      expect(result.showWarning).toBe(true);
      expect(result.remainingMinutes).toBe(4);
    });

    it('should return invalid for timed out session', async () => {
      // Arrange - Last activity 61 mins ago (timed out)
      vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        lastActivityAt: new Date('2025-01-15T10:59:00.000Z'),
      });

      // Act
      const result = await sessionService.checkSessionTimeout({
        sessionId: 'session-123',
      });

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INACTIVITY_TIMEOUT');
    });

    it('should auto-revoke timed out session', async () => {
      // Arrange - Timed out session
      vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        lastActivityAt: new Date('2025-01-15T10:30:00.000Z'), // 90 mins ago
      });

      // Act
      await sessionService.checkSessionTimeout({
        sessionId: 'session-123',
      });

      // Assert
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: {
          revokedAt: expect.any(Date),
          revokeReason: 'INACTIVITY_TIMEOUT',
          isActive: false,
        },
      });
    });
  });

  // =========================================================================
  // AC5: Concurrent Sessions Limit
  // =========================================================================
  describe('enforceSessionLimit', () => {
    it('should allow sessions up to limit (5)', async () => {
      // Arrange
      mockPrisma.session.count.mockResolvedValue(4);

      // Act
      const result = await sessionService.enforceSessionLimit({
        userId: 'user-123',
      });

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(4);
    });

    it('should revoke oldest session when at limit', async () => {
      // Arrange
      mockPrisma.session.count.mockResolvedValue(5);
      mockPrisma.session.findFirst.mockResolvedValue({
        ...mockSession,
        id: 'oldest-session',
        createdAt: new Date('2025-01-01'),
      });

      // Act
      const result = await sessionService.enforceSessionLimit({
        userId: 'user-123',
      });

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.revokedSessionId).toBe('oldest-session');
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'oldest-session' },
        data: {
          revokedAt: expect.any(Date),
          revokeReason: 'CONCURRENT_LIMIT_ENFORCED',
          isActive: false,
        },
      });
    });

    it('should log session limit enforcement', async () => {
      // Arrange
      mockPrisma.session.count.mockResolvedValue(5);
      mockPrisma.session.findFirst.mockResolvedValue({
        ...mockSession,
        id: 'oldest-session',
      });

      // Act
      await sessionService.enforceSessionLimit({
        userId: 'user-123',
      });

      // Assert
      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'CONCURRENT_LIMIT_ENFORCED',
          userId: 'user-123',
          metadata: expect.objectContaining({
            revokedSessionId: 'oldest-session',
            limit: 5,
          }),
        }),
      });
    });
  });

  // =========================================================================
  // Session Validation
  // =========================================================================
  describe('validateSession', () => {
    it('should return valid session with user context', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(JSON.stringify({
        ...mockSession,
        user: mockUser,
      }));

      // Act
      const result = await sessionService.validateSession({
        sessionId: 'session-123',
        accessToken: 'valid-access-token',
      });

      // Assert
      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.id).toBe('user-123');
    });

    it('should check database if not in cache', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        user: mockUser,
      });

      // Act
      const result = await sessionService.validateSession({
        sessionId: 'session-123',
        accessToken: 'valid-access-token',
      });

      // Assert
      expect(mockPrisma.session.findUnique).toHaveBeenCalled();
      expect(result.valid).toBe(true);
    });

    it('should cache session in Redis after DB lookup', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        user: mockUser,
      });

      // Act
      await sessionService.validateSession({
        sessionId: 'session-123',
        accessToken: 'valid-access-token',
      });

      // Assert
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'session:session-123',
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should return invalid for revoked session', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        revokedAt: new Date(),
      });

      // Act
      const result = await sessionService.validateSession({
        sessionId: 'session-123',
        accessToken: 'valid-access-token',
      });

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('SESSION_REVOKED');
    });

    it('should return invalid for expired session', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        expiresAt: new Date('2025-01-10'), // Past date
      });

      // Act
      const result = await sessionService.validateSession({
        sessionId: 'session-123',
        accessToken: 'valid-access-token',
      });

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('SESSION_EXPIRED');
    });

    it('should return invalid for non-existent session', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.session.findUnique.mockResolvedValue(null);

      // Act
      const result = await sessionService.validateSession({
        sessionId: 'non-existent',
        accessToken: 'valid-access-token',
      });

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('SESSION_NOT_FOUND');
    });
  });

  // =========================================================================
  // Token Blacklist Management
  // =========================================================================
  describe('isTokenBlacklisted', () => {
    it('should return true for blacklisted token', async () => {
      // Arrange
      mockPrisma.blacklistedToken.findUnique.mockResolvedValue({
        id: 'bl-1',
        tokenHash: 'blacklisted-hash',
        expiresAt: new Date('2025-01-20'),
        reason: 'TOKEN_ROTATED',
        createdAt: new Date(),
      });

      // Act
      const result = await sessionService.isTokenBlacklisted('some-token');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for valid token', async () => {
      // Arrange
      mockPrisma.blacklistedToken.findUnique.mockResolvedValue(null);

      // Act
      const result = await sessionService.isTokenBlacklisted('valid-token');

      // Assert
      expect(result).toBe(false);
    });

    it('should check Redis cache first for performance', async () => {
      // Arrange
      mockRedis.exists.mockResolvedValue(1);

      // Act
      const result = await sessionService.isTokenBlacklisted('cached-token');

      // Assert
      expect(result).toBe(true);
      expect(mockPrisma.blacklistedToken.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredBlacklistedTokens', () => {
    it('should remove expired blacklisted tokens', async () => {
      // Arrange
      mockPrisma.blacklistedToken.deleteMany.mockResolvedValue({ count: 10 });

      // Act
      const result = await sessionService.cleanupExpiredBlacklistedTokens();

      // Assert
      expect(result.deletedCount).toBe(10);
      expect(mockPrisma.blacklistedToken.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });
  });

  // =========================================================================
  // Edge Cases & Error Handling
  // =========================================================================
  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockRejectedValue(new Error('DB connection lost'));

      // Act & Assert
      await expect(
        sessionService.validateSession({
          sessionId: 'session-123',
          accessToken: 'token',
        })
      ).rejects.toThrow();
    });

    it('should handle Redis errors with fallback to database', async () => {
      // Arrange
      mockRedis.get.mockRejectedValue(new Error('Redis unavailable'));
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        user: mockUser,
      });

      // Act
      const result = await sessionService.validateSession({
        sessionId: 'session-123',
        accessToken: 'token',
      });

      // Assert - Should still work via DB
      expect(result.valid).toBe(true);
    });
  });
});
