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
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  blacklistedToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
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
    getTokenHash: vi.fn().mockReturnValue('mock-token-hash'),
    decodeToken: vi.fn().mockResolvedValue({
      userId: 'user-123',
      sessionId: 'session-123',
      exp: Math.floor(Date.now() / 1000) + 900,
    }),
    verifyAccessToken: vi.fn().mockResolvedValue({
      valid: true,
      payload: {
        userId: 'user-123',
        sessionId: 'session-123',
      },
    }),
  })),
}));

describe('Logout Router', () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  // Use valid UUIDs
  const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440001';
  const OTHER_SESSION_ID = '550e8400-e29b-41d4-a716-446655440002';

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
    isActive: true,
    expiresAt: new Date('2025-01-22T12:00:00.000Z'),
    revokedAt: null,
    user: mockUser,
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
    mockRedis.keys.mockResolvedValue([]);

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
  function createAuthenticatedContext(accessToken = 'valid-access-token') {
    const ctx = createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
          authorization: `Bearer ${accessToken}`,
        },
        url: '/api/trpc/logout.logout',
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
      accessToken,
    };
  }

  // =========================================================================
  // Single Logout (Protected Procedure)
  // =========================================================================
  describe('logout.logout', () => {
    it('should logout user from current session', async () => {
      // Arrange
      caller = appRouter.createCaller(createAuthenticatedContext());
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Act
      const result = await caller.aim.logout.logout({});

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

    it('should blacklist tokens on logout', async () => {
      // Arrange
      caller = appRouter.createCaller(createAuthenticatedContext());
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Act
      await caller.aim.logout.logout({});

      // Assert
      expect(mockPrisma.blacklistedToken.create).toHaveBeenCalled();
    });

    it('should invalidate Redis cache', async () => {
      // Arrange
      caller = appRouter.createCaller(createAuthenticatedContext());
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Act
      await caller.aim.logout.logout({});

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining(SESSION_ID)
      );
    });

    it('should succeed even when session not found (graceful)', async () => {
      // Arrange
      caller = appRouter.createCaller(createAuthenticatedContext());
      mockPrisma.session.findUnique.mockResolvedValue(null);

      // Act
      const result = await caller.aim.logout.logout({});

      // Assert
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // Logout All Devices (Protected Procedure)
  // =========================================================================
  describe('logout.logoutAll', () => {
    it('should require password verification', async () => {
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
        caller.aim.logout.logoutAll({
          password: 'wrong-password',
        })
      ).rejects.toThrow();
    });

    it('should revoke all sessions except current with valid password', async () => {
      // Arrange - Reset to default mock that returns true
      const { Argon2Service } = await import('@ksiegowacrm/auth');
      (Argon2Service as any).mockImplementation(() => ({
        verify: vi.fn().mockResolvedValue(true),
      }));

      caller = appRouter.createCaller(createAuthenticatedContext());
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.session.findMany.mockResolvedValue([
        { ...mockSession, id: OTHER_SESSION_ID },
        { ...mockSession, id: '550e8400-e29b-41d4-a716-446655440003' },
      ]);

      // Act
      const result = await caller.aim.logout.logoutAll({
        password: 'correct-password',
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.revokedCount).toBe(2);
    });

    it('should blacklist tokens from all revoked sessions', async () => {
      // Arrange
      const { Argon2Service } = await import('@ksiegowacrm/auth');
      (Argon2Service as any).mockImplementation(() => ({
        verify: vi.fn().mockResolvedValue(true),
      }));

      caller = appRouter.createCaller(createAuthenticatedContext());
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.session.findMany.mockResolvedValue([
        { ...mockSession, id: OTHER_SESSION_ID },
      ]);

      // Act
      await caller.aim.logout.logoutAll({
        password: 'correct-password',
      });

      // Assert
      expect(mockPrisma.blacklistedToken.createMany).toHaveBeenCalled();
    });

    it('should return zero count when no other sessions exist', async () => {
      // Arrange
      const { Argon2Service } = await import('@ksiegowacrm/auth');
      (Argon2Service as any).mockImplementation(() => ({
        verify: vi.fn().mockResolvedValue(true),
      }));

      caller = appRouter.createCaller(createAuthenticatedContext());
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.session.findMany.mockResolvedValue([]);

      // Act
      const result = await caller.aim.logout.logoutAll({
        password: 'correct-password',
      });

      // Assert
      expect(result.revokedCount).toBe(0);
    });
  });

  // =========================================================================
  // Schema Validation
  // =========================================================================
  describe('schema validation', () => {
    it('should accept empty object for single logout', async () => {
      // Arrange
      caller = appRouter.createCaller(createAuthenticatedContext());
      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      // Act
      const result = await caller.aim.logout.logout({});

      // Assert
      expect(result.success).toBe(true);
    });

    it('should require password for logoutAll', async () => {
      // Arrange
      caller = appRouter.createCaller(createAuthenticatedContext());

      // Act & Assert
      await expect(
        caller.aim.logout.logoutAll({
          password: '', // Empty password should fail validation
        })
      ).rejects.toThrow();
    });
  });
});
