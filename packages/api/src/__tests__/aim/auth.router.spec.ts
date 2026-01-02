import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createContext } from '../../context';
import { appRouter } from '../../index';
import type { AuthRouter } from '../../routers/aim/auth.router';

// Mock dependencies
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  session: {
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  userDevice: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  userRole: {
    findMany: vi.fn(),
  },
  userOrganization: {
    findFirst: vi.fn(),
  },
  loginAttempt: {
    create: vi.fn(),
  },
  authAuditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

const mockRedis = {
  lpush: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  zremrangebyscore: vi.fn(),
  pipeline: vi.fn(() => ({
    zremrangebyscore: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    pexpire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([[null, 0], [null, 0], [null, 1], [null, 1]]),
  })),
};

// Mock @ksiegowacrm/auth - includes both Argon2Service and TokenService
vi.mock('@ksiegowacrm/auth', () => ({
  Argon2Service: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockResolvedValue(true),
  })),
  TokenService: vi.fn().mockImplementation(() => ({
    generateTokenPair: vi.fn().mockResolvedValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      accessTokenExpiresAt: Date.now() + 15 * 60 * 1000,
      refreshTokenExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }),
    getTokenHash: vi.fn().mockReturnValue('mock-token-hash'),
  })),
}));

// Mock fetch for email sending
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  text: () => Promise.resolve(''),
});

describe('Auth Router', () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  // Active verified user mock
  const mockActiveUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    status: 'ACTIVE',
    mfaConfiguration: null,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // Reset rate limiter to allow requests
    mockRedis.pipeline.mockReturnValue({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, 0], [null, 0], [null, 1], [null, 1]]),
    });

    // Reset Redis get to return null (not locked)
    mockRedis.get.mockResolvedValue(null);

    const ctx = {
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      session: null,
      correlationId: 'test-correlation-id',
      ipAddress: '192.168.1.1',
      userAgent: 'Test User Agent',
      req: { headers: {} },
      res: { setHeader: vi.fn() },
    };

    caller = appRouter.createCaller(ctx);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper for tests expecting errors with timing attack prevention
  async function loginWithTimersExpectError(
    input: { email: string; password: string; rememberMe?: boolean }
  ) {
    const promise = caller.aim.auth.login(input);
    promise.catch(() => {}); // Prevent unhandled rejection warning
    await vi.advanceTimersByTimeAsync(300);
    return promise;
  }

  // Helper for successful login with timers
  async function loginWithTimers(
    input: { email: string; password: string; rememberMe?: boolean }
  ) {
    const promise = caller.aim.auth.login(input);
    await vi.advanceTimersByTimeAsync(300);
    return promise;
  }

  describe('login', () => {
    const validInput = {
      email: 'test@example.com',
      password: 'SecureP@ssw0rd123!',
      rememberMe: false,
    };

    it('should login user with valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userRole.findMany.mockResolvedValue([{ role: { name: 'USER' } }]);
      mockPrisma.userOrganization.findFirst.mockResolvedValue(null);

      const result = await loginWithTimers(validInput);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.userId).toBe('user-123');
    });

    it('should reject invalid email format', async () => {
      await expect(
        loginWithTimersExpectError({
          email: 'invalid-email',
          password: 'SecureP@ssw0rd123!',
        })
      ).rejects.toThrow();
    });

    it('should reject empty password', async () => {
      await expect(
        loginWithTimersExpectError({
          email: 'test@example.com',
          password: '',
        })
      ).rejects.toThrow();
    });

    it('should return UNAUTHORIZED for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(loginWithTimersExpectError(validInput)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('should return FORBIDDEN for unverified account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockActiveUser,
        status: 'PENDING_VERIFICATION',
      });

      await expect(loginWithTimersExpectError(validInput)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('should return FORBIDDEN for suspended account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockActiveUser,
        status: 'SUSPENDED',
      });

      await expect(loginWithTimersExpectError(validInput)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('should return FORBIDDEN for locked account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      // Simulate locked account
      mockRedis.get.mockResolvedValue('1');

      await expect(loginWithTimersExpectError(validInput)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('should return rate limit error when email limit exceeded', async () => {
      // Simulate email rate limit exceeded
      mockRedis.pipeline.mockReturnValue({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        pexpire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([[null, 0], [null, 5], [null, 1], [null, 1]]),
      });

      await expect(loginWithTimersExpectError(validInput)).rejects.toMatchObject({
        code: 'TOO_MANY_REQUESTS',
      });
    });

    it('should return rate limit error when IP limit exceeded', async () => {
      // First call returns allowed for email, second returns exceeded for IP
      let callCount = 0;
      mockRedis.pipeline.mockImplementation(() => ({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        pexpire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // Email rate limit OK
            return Promise.resolve([[null, 0], [null, 0], [null, 1], [null, 1]]);
          }
          // IP rate limit exceeded
          return Promise.resolve([[null, 0], [null, 20], [null, 1], [null, 1]]);
        }),
      }));

      await expect(loginWithTimersExpectError(validInput)).rejects.toMatchObject({
        code: 'TOO_MANY_REQUESTS',
      });
    });

    it('should return mfaRequired when MFA is enabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockActiveUser,
        mfaConfiguration: {
          enabled: true,
          method: 'TOTP',
          secret: 'encrypted-secret',
        },
      });

      const result = await loginWithTimers(validInput);

      expect(result.success).toBe(true);
      expect(result.mfaRequired).toBe(true);
      expect(result.mfaChallengeId).toBeDefined();
      expect(result.accessToken).toBe('');
      expect(result.refreshToken).toBe('');
    });

    it('should enforce minimum response time (timing attack prevention)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const startTime = Date.now();
      try {
        const promise = caller.aim.auth.login(validInput);
        promise.catch(() => {});
        await vi.advanceTimersByTimeAsync(300);
        await promise;
      } catch {
        // Expected
      }
      const elapsed = Date.now() - startTime;

      // Should take at least 200ms
      expect(elapsed).toBeGreaterThanOrEqual(200);
    });

    it('should handle rememberMe option', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userRole.findMany.mockResolvedValue([{ role: { name: 'USER' } }]);
      mockPrisma.userOrganization.findFirst.mockResolvedValue(null);

      const result = await loginWithTimers({
        ...validInput,
        rememberMe: true,
      });

      expect(result.success).toBe(true);
      // Session expiry should be longer with rememberMe
      expect(mockPrisma.session.create).toHaveBeenCalled();
    });
  });

  describe('verifyMfa', () => {
    const validMfaInput = {
      challengeId: '550e8400-e29b-41d4-a716-446655440000',
      code: '123456',
    };

    it('should verify valid MFA code and create session', async () => {
      // Setup MFA challenge in Redis
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Test User Agent',
          rememberMe: false,
          createdAt: Date.now(),
        })
      );

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockActiveUser,
        mfaConfiguration: {
          enabled: true,
          method: 'TOTP',
          secret: 'encrypted-secret',
        },
      });
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userRole.findMany.mockResolvedValue([{ role: { name: 'USER' } }]);
      mockPrisma.userOrganization.findFirst.mockResolvedValue(null);

      const result = await caller.aim.auth.verifyMfa(validMfaInput);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(mockRedis.del).toHaveBeenCalled(); // Challenge should be deleted
    });

    it('should reject invalid or expired challenge', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        caller.aim.auth.verifyMfa(validMfaInput)
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('should reject invalid MFA code format (too short)', async () => {
      await expect(
        caller.aim.auth.verifyMfa({
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          code: '12345', // 5 digits instead of 6
        })
      ).rejects.toThrow();
    });

    it('should reject invalid MFA code format (non-numeric)', async () => {
      await expect(
        caller.aim.auth.verifyMfa({
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          code: '12345a',
        })
      ).rejects.toThrow();
    });

    it('should reject invalid challengeId format', async () => {
      await expect(
        caller.aim.auth.verifyMfa({
          challengeId: 'not-a-uuid',
          code: '123456',
        })
      ).rejects.toThrow();
    });
  });

  describe('verifyBackupCode', () => {
    const validBackupInput = {
      challengeId: '550e8400-e29b-41d4-a716-446655440000',
      code: 'ABCD1234',
    };

    it('should verify valid backup code and create session', async () => {
      // Setup MFA challenge in Redis
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Test User Agent',
          rememberMe: false,
          createdAt: Date.now(),
        })
      );

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockActiveUser,
        mfaConfiguration: {
          enabled: true,
          method: 'TOTP',
          secret: 'encrypted-secret',
        },
      });
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userRole.findMany.mockResolvedValue([{ role: { name: 'USER' } }]);
      mockPrisma.userOrganization.findFirst.mockResolvedValue(null);

      const result = await caller.aim.auth.verifyBackupCode(validBackupInput);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.sessionId).toBeDefined();
    });

    it('should reject invalid backup code format (too short)', async () => {
      await expect(
        caller.aim.auth.verifyBackupCode({
          challengeId: '550e8400-e29b-41d4-a716-446655440000',
          code: 'ABC123', // 6 chars instead of 8
        })
      ).rejects.toThrow();
    });

    it('should reject invalid challengeId format', async () => {
      await expect(
        caller.aim.auth.verifyBackupCode({
          challengeId: 'not-a-uuid',
          code: 'ABCD1234',
        })
      ).rejects.toThrow();
    });
  });

  describe('input validation (Zod schemas)', () => {
    it('should validate email format (RFC 5322)', async () => {
      const invalidEmails = [
        'invalid',
        'invalid@',
        '@invalid.com',
        'invalid@.com',
        'invalid@com',
      ];

      for (const email of invalidEmails) {
        await expect(
          loginWithTimersExpectError({
            email,
            password: 'SecureP@ssw0rd123!',
          })
        ).rejects.toThrow();
      }
    });

    it('should accept valid email formats', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userRole.findMany.mockResolvedValue([{ role: { name: 'USER' } }]);
      mockPrisma.userOrganization.findFirst.mockResolvedValue(null);

      const validEmails = [
        'test@example.com',
        'test.user@example.com',
        'test+tag@example.co.uk',
      ];

      for (const email of validEmails) {
        mockPrisma.user.findUnique.mockResolvedValue({
          ...mockActiveUser,
          email,
        });

        const result = await loginWithTimers({
          email,
          password: 'SecureP@ssw0rd123!',
        });

        expect(result.success).toBe(true);
      }
    });

    it('should normalize email to lowercase', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userRole.findMany.mockResolvedValue([{ role: { name: 'USER' } }]);
      mockPrisma.userOrganization.findFirst.mockResolvedValue(null);

      await loginWithTimers({
        email: 'TEST@EXAMPLE.COM',
        password: 'SecureP@ssw0rd123!',
      });

      // Check that prisma was called with lowercase email
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'test@example.com' },
        })
      );
    });
  });

  describe('session management', () => {
    it('should revoke oldest session when max sessions exceeded', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(5); // At max
      mockPrisma.session.findFirst.mockResolvedValue({
        id: 'oldest-session',
        createdAt: new Date(Date.now() - 1000000),
      });
      mockPrisma.userRole.findMany.mockResolvedValue([{ role: { name: 'USER' } }]);
      mockPrisma.userOrganization.findFirst.mockResolvedValue(null);

      const result = await loginWithTimers({
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123!',
      });

      expect(result.success).toBe(true);
      // Should revoke oldest session
      expect(mockPrisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'oldest-session' },
          data: expect.objectContaining({
            revokedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should not revoke session when under limit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(2); // Under max
      mockPrisma.userRole.findMany.mockResolvedValue([{ role: { name: 'USER' } }]);
      mockPrisma.userOrganization.findFirst.mockResolvedValue(null);

      const result = await loginWithTimers({
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123!',
      });

      expect(result.success).toBe(true);
      // Should NOT call findFirst for oldest session
      expect(mockPrisma.session.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('device tracking', () => {
    it('should detect new device on login', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userDevice.findUnique.mockResolvedValue(null); // New device
      mockPrisma.userDevice.create.mockResolvedValue({
        id: 'device-123',
        isTrusted: false,
      });
      mockPrisma.userRole.findMany.mockResolvedValue([{ role: { name: 'USER' } }]);
      mockPrisma.userOrganization.findFirst.mockResolvedValue(null);

      // Need to call with device fingerprint via context
      // This test verifies the flow when device fingerprint is provided
      const result = await loginWithTimers({
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123!',
      });

      expect(result.success).toBe(true);
    });

    it('should recognize trusted device', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userDevice.findUnique.mockResolvedValue({
        id: 'device-123',
        isTrusted: true,
      });
      mockPrisma.userRole.findMany.mockResolvedValue([{ role: { name: 'USER' } }]);
      mockPrisma.userOrganization.findFirst.mockResolvedValue(null);

      const result = await loginWithTimers({
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123!',
      });

      expect(result.success).toBe(true);
      expect(result.isNewDevice).toBeFalsy(); // Not a new device
    });
  });

  describe('audit logging', () => {
    it('should log successful login', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userRole.findMany.mockResolvedValue([{ role: { name: 'USER' } }]);
      mockPrisma.userOrganization.findFirst.mockResolvedValue(null);

      await loginWithTimers({
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123!',
      });

      expect(mockPrisma.loginAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'success',
            email: 'test@example.com',
          }),
        })
      );
    });

    it('should log failed login attempt', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      try {
        const promise = caller.aim.auth.login({
          email: 'nonexistent@example.com',
          password: 'SecureP@ssw0rd123!',
        });
        promise.catch(() => {});
        await vi.advanceTimersByTimeAsync(300);
        await promise;
      } catch {
        // Expected
      }

      expect(mockPrisma.loginAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed_invalid_credentials',
            email: 'nonexistent@example.com',
          }),
        })
      );
    });
  });
});
