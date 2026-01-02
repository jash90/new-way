import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// Mock dependencies
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  session: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  blacklistedToken: {
    create: vi.fn(),
    createMany: vi.fn(),
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
  keys: vi.fn(),
};

const mockTokenService = {
  getTokenHash: vi.fn(),
  decodeToken: vi.fn(),
};

const mockArgon2Service = {
  verify: vi.fn(),
};

const mockAuditLogger = {
  log: vi.fn(),
};

// Import after mocks are set up
import { LogoutService } from '../../services/aim/logout.service';

describe('LogoutService', () => {
  let logoutService: LogoutService;

  // Use valid UUIDs
  const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440001';
  const OTHER_SESSION_ID = '550e8400-e29b-41d4-a716-446655440002';
  const THIRD_SESSION_ID = '550e8400-e29b-41d4-a716-446655440003';

  const mockUser = {
    id: USER_ID,
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    status: 'ACTIVE',
  };

  const mockSession = {
    id: SESSION_ID,
    userId: USER_ID,
    tokenHash: 'access-token-hash',
    refreshTokenHash: 'refresh-token-hash',
    tokenFamily: 'family-123',
    isActive: true,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    user: mockUser,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    vi.clearAllMocks();

    // Default mock implementations
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.keys.mockResolvedValue([]);

    mockTokenService.getTokenHash.mockReturnValue('token-hash');
    mockTokenService.decodeToken.mockResolvedValue({
      userId: USER_ID,
      sessionId: SESSION_ID,
      exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes from now
    });

    mockArgon2Service.verify.mockResolvedValue(true);

    logoutService = new LogoutService(
      mockPrisma as any,
      mockRedis as any,
      mockTokenService as any,
      mockAuditLogger as any,
      mockArgon2Service as any
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Single Session Logout
  // =========================================================================
  describe('logout (single session)', () => {
    it('should invalidate the current session', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Act
      const result = await logoutService.logout({
        sessionId: SESSION_ID,
        userId: USER_ID,
        accessToken: 'valid-access-token',
        ipAddress: '192.168.1.100',
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
          revokeReason: 'USER_LOGOUT',
        }),
      });
    });

    it('should blacklist the access token', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockTokenService.decodeToken.mockResolvedValue({
        userId: USER_ID,
        sessionId: SESSION_ID,
        exp: Math.floor(Date.now() / 1000) + 900,
      });

      // Act
      await logoutService.logout({
        sessionId: SESSION_ID,
        userId: USER_ID,
        accessToken: 'valid-access-token',
        ipAddress: '192.168.1.100',
      });

      // Assert
      expect(mockPrisma.blacklistedToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tokenHash: expect.any(String),
          reason: 'USER_LOGOUT',
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should blacklist the refresh token', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Act
      await logoutService.logout({
        sessionId: SESSION_ID,
        userId: USER_ID,
        accessToken: 'valid-access-token',
        ipAddress: '192.168.1.100',
      });

      // Assert
      // Should have two blacklist calls - one for access token, one for refresh token
      expect(mockPrisma.blacklistedToken.create).toHaveBeenCalledTimes(2);
    });

    it('should invalidate Redis session cache', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Act
      await logoutService.logout({
        sessionId: SESSION_ID,
        userId: USER_ID,
        accessToken: 'valid-access-token',
        ipAddress: '192.168.1.100',
      });

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining(SESSION_ID)
      );
    });

    it('should create an audit log entry', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Act
      await logoutService.logout({
        sessionId: SESSION_ID,
        userId: USER_ID,
        accessToken: 'valid-access-token',
        ipAddress: '192.168.1.100',
      });

      // Assert
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'USER_LOGOUT',
          userId: USER_ID,
          ipAddress: '192.168.1.100',
        })
      );
    });

    it('should handle session not found gracefully', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue(null);

      // Act
      const result = await logoutService.logout({
        sessionId: SESSION_ID,
        userId: USER_ID,
        accessToken: 'valid-access-token',
        ipAddress: '192.168.1.100',
      });

      // Assert - should still succeed (graceful degradation)
      expect(result.success).toBe(true);
      expect(result.message).toContain('wylogowano');
    });

    it('should handle already revoked session', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        revokedAt: new Date('2025-01-14'),
      });

      // Act
      const result = await logoutService.logout({
        sessionId: SESSION_ID,
        userId: USER_ID,
        accessToken: 'valid-access-token',
        ipAddress: '192.168.1.100',
      });

      // Assert - should still succeed
      expect(result.success).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockRejectedValue(new Error('DB connection failed'));

      // Act
      const result = await logoutService.logout({
        sessionId: SESSION_ID,
        userId: USER_ID,
        accessToken: 'valid-access-token',
        ipAddress: '192.168.1.100',
      });

      // Assert - local logout should still succeed
      expect(result.success).toBe(true);
      expect(result.serverLogoutFailed).toBe(true);
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockRedis.del.mockRejectedValue(new Error('Redis connection failed'));

      // Act
      const result = await logoutService.logout({
        sessionId: SESSION_ID,
        userId: USER_ID,
        accessToken: 'valid-access-token',
        ipAddress: '192.168.1.100',
      });

      // Assert - should still succeed
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // Logout All Devices
  // =========================================================================
  describe('logoutAllDevices', () => {
    const otherSessions = [
      { ...mockSession, id: OTHER_SESSION_ID },
      { ...mockSession, id: THIRD_SESSION_ID },
    ];

    it('should require password verification', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockArgon2Service.verify.mockResolvedValue(false);

      // Act & Assert
      await expect(
        logoutService.logoutAllDevices({
          userId: USER_ID,
          currentSessionId: SESSION_ID,
          password: 'wrong-password',
          ipAddress: '192.168.1.100',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should revoke all sessions except current', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.session.findMany.mockResolvedValue(otherSessions);
      mockArgon2Service.verify.mockResolvedValue(true);

      // Act
      const result = await logoutService.logoutAllDevices({
        userId: USER_ID,
        currentSessionId: SESSION_ID,
        password: 'correct-password',
        ipAddress: '192.168.1.100',
      });

      // Assert
      expect(result.revokedCount).toBe(2);
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: {
          userId: USER_ID,
          id: { not: SESSION_ID },
          revokedAt: null,
        },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
          revokeReason: 'LOGOUT_ALL_DEVICES',
        }),
      });
    });

    it('should blacklist all tokens from other sessions', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.session.findMany.mockResolvedValue(otherSessions);
      mockArgon2Service.verify.mockResolvedValue(true);

      // Act
      await logoutService.logoutAllDevices({
        userId: USER_ID,
        currentSessionId: SESSION_ID,
        password: 'correct-password',
        ipAddress: '192.168.1.100',
      });

      // Assert
      expect(mockPrisma.blacklistedToken.createMany).toHaveBeenCalled();
    });

    it('should invalidate Redis cache for all sessions', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.session.findMany.mockResolvedValue(otherSessions);
      mockArgon2Service.verify.mockResolvedValue(true);
      mockRedis.keys.mockResolvedValue([
        `session:${OTHER_SESSION_ID}`,
        `session:${THIRD_SESSION_ID}`,
      ]);

      // Act
      await logoutService.logoutAllDevices({
        userId: USER_ID,
        currentSessionId: SESSION_ID,
        password: 'correct-password',
        ipAddress: '192.168.1.100',
      });

      // Assert
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should create audit log for logout all devices', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.session.findMany.mockResolvedValue(otherSessions);
      mockArgon2Service.verify.mockResolvedValue(true);

      // Act
      await logoutService.logoutAllDevices({
        userId: USER_ID,
        currentSessionId: SESSION_ID,
        password: 'correct-password',
        ipAddress: '192.168.1.100',
      });

      // Assert
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'LOGOUT_ALL_DEVICES',
          userId: USER_ID,
          metadata: expect.objectContaining({
            revokedSessionCount: 2,
          }),
        })
      );
    });

    it('should return zero count when no other sessions exist', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.session.findMany.mockResolvedValue([]);
      mockArgon2Service.verify.mockResolvedValue(true);

      // Act
      const result = await logoutService.logoutAllDevices({
        userId: USER_ID,
        currentSessionId: SESSION_ID,
        password: 'correct-password',
        ipAddress: '192.168.1.100',
      });

      // Assert
      expect(result.revokedCount).toBe(0);
    });

    it('should throw when user not found', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        logoutService.logoutAllDevices({
          userId: USER_ID,
          currentSessionId: SESSION_ID,
          password: 'any-password',
          ipAddress: '192.168.1.100',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // Force Logout (Admin Action)
  // =========================================================================
  describe('forceLogout', () => {
    it('should revoke session without password', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Act
      const result = await logoutService.forceLogout({
        sessionId: SESSION_ID,
        adminUserId: 'admin-user-id',
        reason: 'SECURITY_CONCERN',
        ipAddress: '192.168.1.100',
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
          revokeReason: 'ADMIN_FORCE_LOGOUT',
        }),
      });
    });

    it('should create audit log with admin info', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Act
      await logoutService.forceLogout({
        sessionId: SESSION_ID,
        adminUserId: 'admin-user-id',
        reason: 'SECURITY_CONCERN',
        ipAddress: '192.168.1.100',
      });

      // Assert
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ADMIN_FORCE_LOGOUT',
          userId: USER_ID,
          metadata: expect.objectContaining({
            adminUserId: 'admin-user-id',
            reason: 'SECURITY_CONCERN',
          }),
        })
      );
    });

    it('should throw when session not found', async () => {
      // Arrange
      mockPrisma.session.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        logoutService.forceLogout({
          sessionId: 'non-existent-session',
          adminUserId: 'admin-user-id',
          reason: 'SECURITY_CONCERN',
          ipAddress: '192.168.1.100',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // Token Cleanup
  // =========================================================================
  describe('cleanupExpiredTokens', () => {
    it('should delete expired blacklisted tokens', async () => {
      // Arrange
      const deleteMany = vi.fn().mockResolvedValue({ count: 5 });
      mockPrisma.blacklistedToken = { ...mockPrisma.blacklistedToken, deleteMany };

      // Act
      const result = await logoutService.cleanupExpiredTokens();

      // Assert
      expect(deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
      expect(result.deletedCount).toBe(5);
    });
  });
});
