import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createContext } from '../../context';
import { appRouter } from '../../index';

// Mock dependencies
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
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
    zremrangebyscore: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    pexpire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
};

// Mock @ksiegowacrm/auth
vi.mock('@ksiegowacrm/auth', () => ({
  Argon2Service: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue('hashed-password'),
  })),
  TokenService: vi.fn().mockImplementation(() => ({
    generateTokenPair: vi.fn().mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      accessTokenExpiresAt: Date.now() + 15 * 60 * 1000,
      refreshTokenExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }),
    verifyRefreshToken: vi.fn().mockResolvedValue({
      valid: true,
      payload: {
        userId: 'user-123',
        sessionId: 'session-123',
        tokenFamily: 'family-123',
      },
    }),
    getTokenHash: vi.fn().mockReturnValue('mock-token-hash'),
    verifyAccessToken: vi.fn().mockResolvedValue({
      valid: true,
      payload: {
        userId: 'user-123',
        sessionId: 'session-123',
      },
    }),
  })),
}));

describe('Session Router', () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  // Use valid UUIDs
  const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440001';
  const OTHER_SESSION_ID = '550e8400-e29b-41d4-a716-446655440002';
  const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440003';

  const mockUser = {
    id: USER_ID,
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    status: 'ACTIVE',
  };

  const mockSession = {
    id: SESSION_ID,
    userId: USER_ID,
    tokenHash: 'token-hash-123',
    refreshTokenHash: 'refresh-hash-123',
    tokenFamily: 'family-123',
    deviceFingerprint: 'device-fp-123',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    ipAddress: '192.168.1.100',
    city: 'Warsaw',
    country: 'Poland',
    isActive: true,
    isRemembered: false,
    lastActivityAt: new Date('2025-01-15T11:30:00.000Z'),
    expiresAt: new Date('2025-01-22T12:00:00.000Z'),
    revokedAt: null,
    revokeReason: null,
    createdAt: new Date('2025-01-15T10:00:00.000Z'),
    user: {
      id: USER_ID,
      email: 'test@example.com',
      userRoles: [{ role: { name: 'USER' } }],
    },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    vi.clearAllMocks();

    // Reset rate limiter
    mockRedis.pipeline.mockReturnValue({
      del: vi.fn().mockReturnThis(),
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    });

    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.expire.mockResolvedValue(1);

    // Default mocks
    mockPrisma.userRole.findMany.mockResolvedValue([
      { role: { name: 'USER' } },
    ]);
    mockPrisma.userOrganization.findFirst.mockResolvedValue(null);
    mockPrisma.blacklistedToken.findUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Helper to create authenticated context
  function createAuthenticatedContext() {
    const ctx = createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
        },
        url: '/api/trpc/session.list',
        method: 'POST',
      } as any,
      res: {} as any,
    });

    // Add user to context for protected routes
    return {
      ...ctx,
      user: {
        id: USER_ID,
        email: 'test@example.com',
        roles: ['USER'],
      },
      session: {
        sessionId: SESSION_ID,
        userId: USER_ID,
        email: 'test@example.com',
        roles: ['USER'],
        organizationId: '',
      },
    };
  }

  // Helper to create unauthenticated context
  function createPublicContext() {
    return createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
        },
        url: '/api/trpc/session.refresh',
        method: 'POST',
      } as any,
      res: {} as any,
    });
  }

  // =========================================================================
  // Token Refresh (Public Procedure)
  // =========================================================================
  describe('session.refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      // Arrange
      caller = appRouter.createCaller(createPublicContext());
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await caller.aim.session.refresh({
        refreshToken: 'valid-refresh-token',
      });

      // Assert
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.accessToken).toBe('new-access-token');
    });

    it('should reject invalid refresh token', async () => {
      // Arrange
      caller = appRouter.createCaller(createPublicContext());

      // Mock the TokenService to return invalid
      const { TokenService } = await import('@ksiegowacrm/auth');
      (TokenService as any).mockImplementation(() => ({
        verifyRefreshToken: vi.fn().mockResolvedValue({
          valid: false,
          error: 'TOKEN_EXPIRED',
        }),
        getTokenHash: vi.fn().mockReturnValue('invalid-hash'),
      }));

      // Act & Assert
      await expect(
        caller.aim.session.refresh({
          refreshToken: 'invalid-token',
        })
      ).rejects.toThrow();
    });

    it('should reject blacklisted refresh token', async () => {
      // Arrange
      caller = appRouter.createCaller(createPublicContext());
      mockPrisma.blacklistedToken.findUnique.mockResolvedValue({
        id: 'bl-1',
        tokenHash: 'mock-token-hash',
        expiresAt: new Date('2025-01-20'),
        reason: 'TOKEN_ROTATED',
        createdAt: new Date(),
      });

      // Act & Assert
      await expect(
        caller.aim.session.refresh({
          refreshToken: 'blacklisted-token',
        })
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // List Sessions (Protected Procedure)
  // =========================================================================
  describe('session.list', () => {
    it('should return all active sessions for user', async () => {
      // Arrange
      caller = appRouter.createCaller(createAuthenticatedContext());
      mockPrisma.session.findMany.mockResolvedValue([
        mockSession,
        { ...mockSession, id: OTHER_SESSION_ID, ipAddress: '10.0.0.50' },
      ]);

      // Act
      const result = await caller.aim.session.list();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('device');
      expect(result[0]).toHaveProperty('ipAddress');
    });

    it('should mask IP addresses in response', async () => {
      // Arrange
      caller = appRouter.createCaller(createAuthenticatedContext());
      mockPrisma.session.findMany.mockResolvedValue([mockSession]);

      // Act
      const result = await caller.aim.session.list();

      // Assert
      expect(result[0].ipAddress).toBe('***.***.***.100');
    });

    it('should indicate current session', async () => {
      // Arrange
      caller = appRouter.createCaller(createAuthenticatedContext());
      mockPrisma.session.findMany.mockResolvedValue([
        mockSession,
        { ...mockSession, id: OTHER_SESSION_ID },
      ]);

      // Act
      const result = await caller.aim.session.list();

      // Assert
      const currentSession = result.find(s => s.isCurrent);
      expect(currentSession).toBeDefined();
      expect(currentSession?.id).toBe(SESSION_ID);
    });
  });

  // =========================================================================
  // Revoke Session (Protected Procedure)
  // =========================================================================
  describe('session.revoke', () => {
    it('should revoke specific session', async () => {
      // Arrange
      caller = appRouter.createCaller(createAuthenticatedContext());
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        id: OTHER_SESSION_ID,
      });

      // Act
      const result = await caller.aim.session.revoke({
        sessionId: OTHER_SESSION_ID,
      });

      // Assert
      expect(result.success).toBe(true);
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: OTHER_SESSION_ID },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
          revokeReason: expect.any(String),
        }),
      });
    });

    it('should not allow revoking another users session', async () => {
      // Arrange
      caller = appRouter.createCaller(createAuthenticatedContext());
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        id: OTHER_SESSION_ID,
        userId: OTHER_USER_ID,
      });

      // Act & Assert
      await expect(
        caller.aim.session.revoke({
          sessionId: OTHER_SESSION_ID,
        })
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // Revoke All Sessions (Protected Procedure)
  // =========================================================================
  describe('session.revokeAll', () => {
    it('should require password confirmation', async () => {
      // Arrange
      caller = appRouter.createCaller(createAuthenticatedContext());
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Mock password verification to fail
      const { Argon2Service } = await import('@ksiegowacrm/auth');
      (Argon2Service as any).mockImplementation(() => ({
        verify: vi.fn().mockResolvedValue(false),
      }));

      // Act & Assert
      await expect(
        caller.aim.session.revokeAll({
          password: 'wrong-password',
        })
      ).rejects.toThrow();
    });

    it('should revoke all sessions except current with valid password', async () => {
      // Arrange - Reset to default mock that returns true
      const { Argon2Service } = await import('@ksiegowacrm/auth');
      (Argon2Service as any).mockImplementation(() => ({
        verify: vi.fn().mockResolvedValue(true),
        hash: vi.fn().mockResolvedValue('hashed-password'),
      }));

      caller = appRouter.createCaller(createAuthenticatedContext());
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.session.findMany.mockResolvedValue([
        { ...mockSession, id: '550e8400-e29b-41d4-a716-446655440010' },
        { ...mockSession, id: '550e8400-e29b-41d4-a716-446655440011' },
      ]);

      // Act
      const result = await caller.aim.session.revokeAll({
        password: 'correct-password',
      });

      // Assert
      expect(result.revokedCount).toBe(2);
    });
  });

  // =========================================================================
  // Extend Session / Heartbeat (Protected Procedure)
  // =========================================================================
  describe('session.heartbeat', () => {
    it('should extend session on heartbeat', async () => {
      // Arrange
      caller = appRouter.createCaller(createAuthenticatedContext());
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Act
      const result = await caller.aim.session.heartbeat();

      // Assert
      expect(result.valid).toBe(true);
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
        data: {
          lastActivityAt: expect.any(Date),
        },
      });
    });

    it('should return warning when approaching timeout', async () => {
      // Arrange
      caller = appRouter.createCaller(createAuthenticatedContext());
      // Last activity 56 mins ago (4 mins remaining)
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        lastActivityAt: new Date('2025-01-15T11:04:00.000Z'),
      });

      // Act
      const result = await caller.aim.session.heartbeat();

      // Assert
      expect(result.showWarning).toBe(true);
      expect(result.remainingMinutes).toBeLessThanOrEqual(5);
    });
  });

  // =========================================================================
  // Session Validation
  // =========================================================================
  describe('session.validate', () => {
    it('should validate active session', async () => {
      // Arrange
      caller = appRouter.createCaller(createAuthenticatedContext());
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Act
      const result = await caller.aim.session.validate();

      // Assert
      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
    });

    it('should return invalid for revoked session', async () => {
      // Arrange
      caller = appRouter.createCaller(createAuthenticatedContext());
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        revokedAt: new Date('2025-01-14'),
      });

      // Act
      const result = await caller.aim.session.validate();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('SESSION_REVOKED');
    });
  });
});
