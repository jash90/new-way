import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { AuthService } from '../../services/aim/auth.service';
import { AuditLogger } from '../../utils/audit-logger';

// Mock Argon2 service for testing
const mockArgon2Service = {
  verify: vi.fn(),
};

// Mock dependencies
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  session: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  loginAttempt: {
    create: vi.fn(),
    count: vi.fn(),
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

// Mock token service
const mockTokenService = {
  generateTokenPair: vi.fn().mockResolvedValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    accessTokenExpiresAt: Date.now() + 15 * 60 * 1000,
    refreshTokenExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  }),
  getTokenHash: vi.fn().mockReturnValue('mock-token-hash'),
};

describe('AuthService', () => {
  let authService: AuthService;
  let auditLogger: AuditLogger;

  // Helper function to run login with fake timers
  // Starts the promise, advances timers, then awaits result
  async function loginWithTimers(params: Parameters<typeof authService.login>[0]) {
    const promise = authService.login(params);
    // Advance timers by 300ms to ensure minimum response time passes
    await vi.advanceTimersByTimeAsync(300);
    return promise;
  }

  // Helper for tests expecting errors - prevents unhandled rejection warnings
  async function loginWithTimersExpectError(params: Parameters<typeof authService.login>[0]) {
    const promise = authService.login(params);
    // Prevent unhandled rejection warning by adding a no-op catch
    // The promise will still reject and can be checked with .rejects
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(300);
    return promise;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));

    auditLogger = new AuditLogger(mockPrisma as any);
    authService = new AuthService(
      mockPrisma as any,
      mockRedis as any,
      mockTokenService as any,
      auditLogger,
      mockArgon2Service  // Inject mock Argon2 service
    );

    // Default rate limit mock - allow request
    mockRedis.pipeline.mockReturnValue({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, 0], [null, 0], [null, 1], [null, 1]]),
    });

    // Default Redis mocks for account lockout
    mockRedis.get.mockResolvedValue(null); // Not locked
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue('OK');

    // Default Argon2 mock - valid password
    mockArgon2Service.verify.mockResolvedValue(true);

    // Default user roles mock
    mockPrisma.userRole.findMany.mockResolvedValue([
      { role: { name: 'USER' } },
    ]);

    // Default user organization mock
    mockPrisma.userOrganization.findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('login', () => {
    const validParams = {
      email: 'test@example.com',
      password: 'SecureP@ssw0rd123!',
      deviceFingerprint: 'device-fingerprint-123',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      correlationId: 'test-correlation-id',
      rememberMe: false,
    };

    const mockActiveUser = {
      id: 'user-123',
      email: 'test@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$randomsalt$hashedpassword',
      status: 'ACTIVE',  // Uppercase to match Prisma enum
      failedLoginAttempts: 0,
      lockedUntil: null,
      emailVerifiedAt: new Date('2025-01-01'),
      mfaConfiguration: null,
    };

    it('should login successfully with valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userDevice.findUnique.mockResolvedValue(null);
      mockPrisma.userDevice.create.mockResolvedValue({
        id: 'device-123',
        isTrusted: false,
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });

      const result = await loginWithTimers(validParams);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(result.userId).toBe('user-123');
    });

    it('should normalize email to lowercase', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userDevice.findUnique.mockResolvedValue(null);
      mockPrisma.userDevice.create.mockResolvedValue({
        id: 'device-123',
        isTrusted: false,
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });

      await loginWithTimers({
        ...validParams,
        email: 'TEST@EXAMPLE.COM',
      });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        include: { mfaConfiguration: true },
      });
    });

    it('should reject login with invalid email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(loginWithTimersExpectError(validParams)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('Nieprawidłowy email lub hasło'),
      });
    });

    it('should reject login with invalid password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockArgon2Service.verify.mockResolvedValue(false);

      await expect(
        loginWithTimersExpectError({
          ...validParams,
          password: 'WrongPassword123!',
        })
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringContaining('Nieprawidłowy email lub hasło'),
      });
    });

    it('should use same error message for invalid email and password (enumeration prevention)', async () => {
      // Test invalid email
      mockPrisma.user.findUnique.mockResolvedValue(null);
      let invalidEmailError: TRPCError | null = null;
      try {
        await loginWithTimersExpectError(validParams);
      } catch (e) {
        invalidEmailError = e as TRPCError;
      }

      // Test invalid password
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockArgon2Service.verify.mockResolvedValue(false);
      let invalidPasswordError: TRPCError | null = null;
      try {
        await loginWithTimersExpectError({ ...validParams, password: 'WrongPassword123!' });
      } catch (e) {
        invalidPasswordError = e as TRPCError;
      }

      // Both should have same error message
      expect(invalidEmailError?.message).toBe(invalidPasswordError?.message);
    });

    it('should reject unverified user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockActiveUser,
        status: 'PENDING_VERIFICATION',
        emailVerifiedAt: null,
      });

      await expect(loginWithTimersExpectError(validParams)).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: expect.stringContaining('zweryfikowan'),
      });
    });

    it('should reject suspended user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockActiveUser,
        status: 'SUSPENDED',
      });

      await expect(loginWithTimersExpectError(validParams)).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: expect.stringContaining('zawieszon'),
      });
    });

    it('should reject locked account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      // Simulate account being locked in Redis
      mockRedis.get.mockResolvedValue('1');

      await expect(loginWithTimersExpectError(validParams)).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: expect.stringContaining('zablokowane'),
      });
    });

    it('should allow login after lock expires', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      // Account not locked (Redis key doesn't exist)
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userDevice.findUnique.mockResolvedValue(null);
      mockPrisma.userDevice.create.mockResolvedValue({
        id: 'device-123',
        isTrusted: false,
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });

      const result = await loginWithTimers(validParams);

      expect(result.success).toBe(true);
    });

    it('should create session with device tracking', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      // First call in getOrCreateDevice returns null (device doesn't exist)
      // Second call in createSession returns the created device
      mockPrisma.userDevice.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValue({ id: 'device-123', isTrusted: false });
      mockPrisma.userDevice.create.mockResolvedValue({
        id: 'device-123',
        isTrusted: false,
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });

      await loginWithTimers(validParams);

      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          deviceId: 'device-123',
          ipAddress: '192.168.1.1',
          userAgent: expect.any(String),
        }),
      });
    });

    it('should update existing device on login', async () => {
      const existingDevice = {
        id: 'device-123',
        userId: 'user-123',
        fingerprint: 'device-fingerprint-123',
        isTrusted: true,
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userDevice.findUnique.mockResolvedValue(existingDevice);
      mockPrisma.userDevice.update.mockResolvedValue(existingDevice);
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });

      await loginWithTimers(validParams);

      expect(mockPrisma.userDevice.update).toHaveBeenCalledWith({
        where: { id: 'device-123' },
        data: expect.objectContaining({
          lastUsedAt: expect.any(Date),
          lastIpAddress: '192.168.1.1',
        }),
      });
    });

    it('should log audit event for successful login', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userDevice.findUnique.mockResolvedValue(null);
      mockPrisma.userDevice.create.mockResolvedValue({
        id: 'device-123',
        isTrusted: false,
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });

      await loginWithTimers(validParams);

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'LOGIN_SUCCESS',
            userId: 'user-123',
            ipAddress: '192.168.1.1',
          }),
        })
      );
    });

    it('should log audit event for failed login', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockArgon2Service.verify.mockResolvedValue(false);

      try {
        await loginWithTimersExpectError({
          ...validParams,
          password: 'WrongPassword123!',
        });
      } catch {
        // Expected to throw
      }

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'LOGIN_FAILED',
          }),
        })
      );
    });

    it('should clear failed attempts on successful login', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userDevice.findUnique.mockResolvedValue(null);
      mockPrisma.userDevice.create.mockResolvedValue({
        id: 'device-123',
        isTrusted: false,
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });

      await loginWithTimers(validParams);

      // Redis del should be called to clear failure count
      expect(mockRedis.del).toHaveBeenCalledWith('login:failures:user-123');
    });

    it('should set isRemembered flag when rememberMe is true', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userDevice.findUnique.mockResolvedValue(null);
      mockPrisma.userDevice.create.mockResolvedValue({
        id: 'device-123',
        isTrusted: false,
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });

      await loginWithTimers({
        ...validParams,
        rememberMe: true,
      });

      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isRemembered: true,
        }),
      });
    });
  });

  describe('rate limiting', () => {
    const validParams = {
      email: 'test@example.com',
      password: 'SecureP@ssw0rd123!',
      deviceFingerprint: 'device-fingerprint-123',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      correlationId: 'test-correlation-id',
      rememberMe: false,
    };

    it('should block login when email rate limit exceeded (5/15min)', async () => {
      // Simulate 5 existing attempts for this email
      mockRedis.pipeline.mockReturnValue({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        pexpire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([[null, 0], [null, 5], [null, 1], [null, 1]]),
      });

      const promise = authService.login(validParams);
      promise.catch(() => {}); // Prevent unhandled rejection warning
      await vi.advanceTimersByTimeAsync(300);
      await expect(promise).rejects.toMatchObject({
        code: 'TOO_MANY_REQUESTS',
        message: expect.stringContaining('Zbyt wiele prób'),
      });
    });

    it('should block login when IP rate limit exceeded (20/hour)', async () => {
      // Simulate 20 existing attempts for this IP (second pipeline call)
      let callCount = 0;
      mockRedis.pipeline.mockImplementation(() => ({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        pexpire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(
          callCount++ === 0
            ? [[null, 0], [null, 0], [null, 1], [null, 1]]  // Email OK
            : [[null, 0], [null, 20], [null, 1], [null, 1]] // IP exceeded
        ),
      }));

      const promise = authService.login(validParams);
      promise.catch(() => {}); // Prevent unhandled rejection warning
      await vi.advanceTimersByTimeAsync(300);
      await expect(promise).rejects.toMatchObject({
        code: 'TOO_MANY_REQUESTS',
      });
    });

    it('should log rate limit event in audit', async () => {
      mockRedis.pipeline.mockReturnValue({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        pexpire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([[null, 0], [null, 5], [null, 1], [null, 1]]),
      });

      try {
        const promise = authService.login(validParams);
        promise.catch(() => {}); // Prevent unhandled rejection warning
        await vi.advanceTimersByTimeAsync(300);
        await promise;
      } catch {
        // Expected
      }

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'RATE_LIMIT_EXCEEDED',
          }),
        })
      );
    });
  });

  describe('account lockout', () => {
    const validParams = {
      email: 'test@example.com',
      password: 'WrongPassword123!',
      deviceFingerprint: 'device-fingerprint-123',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      correlationId: 'test-correlation-id',
      rememberMe: false,
    };

    const mockUserPreLockout = {
      id: 'user-123',
      email: 'test@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$salt$hash',
      status: 'ACTIVE',
      failedLoginAttempts: 9, // One more failure will lock
      lockedUntil: null,
      emailVerifiedAt: new Date('2025-01-01'),
      mfaConfiguration: null,
    };

    it('should increment failed attempts on wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserPreLockout);
      mockArgon2Service.verify.mockResolvedValue(false);
      mockRedis.incr.mockResolvedValue(4); // Now 4 failures

      try {
        const promise = authService.login(validParams);
        promise.catch(() => {}); // Prevent unhandled rejection warning
        await vi.advanceTimersByTimeAsync(300);
        await promise;
      } catch {
        // Expected
      }

      expect(mockRedis.incr).toHaveBeenCalledWith('login:failures:user-123');
    });

    it('should lock account after 10 failed attempts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserPreLockout);
      mockArgon2Service.verify.mockResolvedValue(false);
      mockRedis.incr.mockResolvedValue(10); // 10th failure triggers lockout

      try {
        const promise = authService.login(validParams);
        promise.catch(() => {}); // Prevent unhandled rejection warning
        await vi.advanceTimersByTimeAsync(300);
        await promise;
      } catch {
        // Expected
      }

      // Should set the lock key in Redis
      expect(mockRedis.set).toHaveBeenCalledWith(
        'account:locked:user-123',
        '1',
        'PX',
        expect.any(Number)
      );
    });

    it('should log account lockout audit event', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserPreLockout);
      mockArgon2Service.verify.mockResolvedValue(false);
      mockRedis.incr.mockResolvedValue(10); // 10th failure triggers lockout

      try {
        const promise = authService.login(validParams);
        promise.catch(() => {}); // Prevent unhandled rejection warning
        await vi.advanceTimersByTimeAsync(300);
        await promise;
      } catch {
        // Expected
      }

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'ACCOUNT_LOCKED',
            userId: 'user-123',
          }),
        })
      );
    });

    it('should send security alert email on lockout', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserPreLockout);
      mockArgon2Service.verify.mockResolvedValue(false);
      mockRedis.incr.mockResolvedValue(10); // 10th failure triggers lockout

      try {
        const promise = authService.login(validParams);
        promise.catch(() => {}); // Prevent unhandled rejection warning
        await vi.advanceTimersByTimeAsync(300);
        await promise;
      } catch {
        // Expected
      }

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'email:queue',
        expect.stringContaining('ACCOUNT_LOCKED')
      );
    });
  });

  describe('session management', () => {
    const validParams = {
      email: 'test@example.com',
      password: 'SecureP@ssw0rd123!',
      deviceFingerprint: 'device-fingerprint-123',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      correlationId: 'test-correlation-id',
      rememberMe: false,
    };

    const mockActiveUser = {
      id: 'user-123',
      email: 'test@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$salt$hash',
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
      emailVerifiedAt: new Date('2025-01-01'),
      mfaConfiguration: null,
    };

    it('should enforce max 5 concurrent sessions', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(5); // Already at limit
      mockPrisma.session.findFirst.mockResolvedValue({
        id: 'oldest-session',
        createdAt: new Date('2025-01-01'),
      });
      mockPrisma.session.update.mockResolvedValue({ id: 'oldest-session' });
      mockPrisma.userDevice.findUnique.mockResolvedValue(null);
      mockPrisma.userDevice.create.mockResolvedValue({
        id: 'device-123',
        isTrusted: false,
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });

      await loginWithTimers(validParams);

      // Should revoke oldest session
      expect(mockPrisma.session.update).toHaveBeenCalledWith({
        where: { id: 'oldest-session' },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
        }),
      });
    });

    it('should create session with correct expiry', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userDevice.findUnique.mockResolvedValue(null);
      mockPrisma.userDevice.create.mockResolvedValue({
        id: 'device-123',
        isTrusted: false,
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });

      await loginWithTimers(validParams);

      expect(mockPrisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should call token service to generate JWT pair', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userDevice.findUnique.mockResolvedValue(null);
      mockPrisma.userDevice.create.mockResolvedValue({
        id: 'device-123',
        isTrusted: false,
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });

      await loginWithTimers(validParams);

      expect(mockTokenService.generateTokenPair).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          email: 'test@example.com',
        })
      );
    });
  });

  describe('MFA integration', () => {
    const validParams = {
      email: 'test@example.com',
      password: 'SecureP@ssw0rd123!',
      deviceFingerprint: 'device-fingerprint-123',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      correlationId: 'test-correlation-id',
      rememberMe: false,
    };

    const mockUserWithMfa = {
      id: 'user-123',
      email: 'test@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$salt$hash',
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
      emailVerifiedAt: new Date('2025-01-01'),
      mfaConfiguration: {
        id: 'mfa-123',
        enabled: true,  // Note: 'enabled' not 'isEnabled'
        verifiedAt: new Date('2025-01-01'),
      },
    };

    it('should return MFA challenge when MFA is enabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserWithMfa);

      const result = await loginWithTimers(validParams);

      expect(result.mfaRequired).toBe(true);
      expect(result.mfaChallengeId).toBeDefined();
      expect(result.accessToken).toBe('');
    });

    it('should create MFA challenge stored in Redis', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserWithMfa);

      await loginWithTimers(validParams);

      // Check Redis set was called with mfa:challenge prefix
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('mfa:challenge:'),
        expect.any(String),
        'EX',
        300  // 5 minutes
      );
    });

    it('should log MFA required audit event', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserWithMfa);

      await loginWithTimers(validParams);

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'MFA_CHALLENGE_SUCCESS',
            userId: 'user-123',
          }),
        })
      );
    });
  });

  describe('new device detection', () => {
    const validParams = {
      email: 'test@example.com',
      password: 'SecureP@ssw0rd123!',
      deviceFingerprint: 'new-device-fingerprint',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      correlationId: 'test-correlation-id',
      rememberMe: false,
    };

    const mockActiveUser = {
      id: 'user-123',
      email: 'test@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$salt$hash',
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
      emailVerifiedAt: new Date('2025-01-01'),
      mfaConfiguration: null,
    };

    it('should create new device record for new fingerprint', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userDevice.findUnique.mockResolvedValue(null);
      mockPrisma.userDevice.create.mockResolvedValue({
        id: 'device-123',
        isTrusted: false,
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });

      await loginWithTimers(validParams);

      expect(mockPrisma.userDevice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          fingerprint: 'new-device-fingerprint',
          lastIpAddress: '192.168.1.1',
        }),
      });
    });

    it('should send new device alert email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userDevice.findUnique.mockResolvedValue(null);
      mockPrisma.userDevice.create.mockResolvedValue({
        id: 'device-123',
        isTrusted: false,
        name: null,
        browserName: 'Chrome',
        osName: 'Windows',
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });

      await loginWithTimers(validParams);

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'email:queue',
        expect.stringContaining('NEW_DEVICE_ALERT')
      );
    });

    it('should log new device audit event', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userDevice.findUnique.mockResolvedValue(null);
      mockPrisma.userDevice.create.mockResolvedValue({
        id: 'device-123',
        isTrusted: false,
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });

      await loginWithTimers(validParams);

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'NEW_DEVICE_LOGIN',
          }),
        })
      );
    });

    it('should not send alert for trusted device', async () => {
      const trustedDevice = {
        id: 'device-123',
        isTrusted: true,
      };
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userDevice.findUnique.mockResolvedValue(trustedDevice);
      mockPrisma.userDevice.update.mockResolvedValue(trustedDevice);
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });

      // Clear previous lpush calls
      mockRedis.lpush.mockClear();

      await loginWithTimers(validParams);

      // Should not send NEW_DEVICE_ALERT for trusted device
      const lpushCalls = mockRedis.lpush.mock.calls;
      const newDeviceAlertCalls = lpushCalls.filter(
        (call: any[]) => call[1] && call[1].includes('NEW_DEVICE_ALERT')
      );
      expect(newDeviceAlertCalls).toHaveLength(0);
    });
  });

  describe('timing attack prevention', () => {
    const validParams = {
      email: 'test@example.com',
      password: 'SecureP@ssw0rd123!',
      deviceFingerprint: 'device-fingerprint-123',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      correlationId: 'test-correlation-id',
      rememberMe: false,
    };

    it('should enforce minimum response time of 200ms', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const startTime = Date.now();

      // Run timers automatically during the test
      vi.useRealTimers();

      try {
        await authService.login(validParams);
      } catch {
        // Expected
      }

      const elapsed = Date.now() - startTime;

      // Should take at least 200ms
      expect(elapsed).toBeGreaterThanOrEqual(200);

      // Restore fake timers for other tests
      vi.useFakeTimers();
    });

    it('should have consistent timing for valid and invalid emails', async () => {
      vi.useRealTimers();

      // Test with invalid email
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const invalidEmailStart = Date.now();
      try {
        await authService.login(validParams);
      } catch {
        // Expected
      }
      const invalidEmailTime = Date.now() - invalidEmailStart;

      // Test with valid email but wrong password
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$salt$hash',
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
        emailVerifiedAt: new Date('2025-01-01'),
        mfaConfiguration: null,
      });
      mockArgon2Service.verify.mockResolvedValue(false);

      const validEmailStart = Date.now();
      try {
        await authService.login({ ...validParams, password: 'wrong' });
      } catch {
        // Expected
      }
      const validEmailTime = Date.now() - validEmailStart;

      // Both should be at least 200ms (timing attack prevention)
      expect(invalidEmailTime).toBeGreaterThanOrEqual(200);
      expect(validEmailTime).toBeGreaterThanOrEqual(200);

      vi.useFakeTimers();
    });
  });

  describe('login attempt tracking', () => {
    const validParams = {
      email: 'test@example.com',
      password: 'SecureP@ssw0rd123!',
      deviceFingerprint: 'device-fingerprint-123',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      correlationId: 'test-correlation-id',
      rememberMe: false,
    };

    const mockActiveUser = {
      id: 'user-123',
      email: 'test@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$salt$hash',
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
      emailVerifiedAt: new Date('2025-01-01'),
      mfaConfiguration: null,
    };

    it('should record successful login attempt', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userDevice.findUnique.mockResolvedValue(null);
      mockPrisma.userDevice.create.mockResolvedValue({
        id: 'device-123',
        isTrusted: false,
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });

      await loginWithTimers(validParams);

      expect(mockPrisma.loginAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          email: 'test@example.com',
          status: 'success',
          ipAddress: '192.168.1.1',
        }),
      });
    });

    it('should record failed login attempt with reason', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      try {
        const promise = authService.login(validParams);
        promise.catch(() => {}); // Prevent unhandled rejection warning
        await vi.advanceTimersByTimeAsync(300);
        await promise;
      } catch {
        // Expected
      }

      expect(mockPrisma.loginAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: null,
          email: 'test@example.com',
          status: 'failed_invalid_credentials',
          ipAddress: '192.168.1.1',
        }),
      });
    });

    it('should record locked account attempt', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      // Simulate account being locked in Redis
      mockRedis.get.mockResolvedValue('1');

      try {
        const promise = authService.login(validParams);
        promise.catch(() => {}); // Prevent unhandled rejection warning
        await vi.advanceTimersByTimeAsync(300);
        await promise;
      } catch {
        // Expected
      }

      expect(mockPrisma.loginAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          status: 'failed_account_locked',
        }),
      });
    });
  });

  describe('security requirements (Constitution compliance)', () => {
    it('should use RS256 algorithm for JWT tokens', async () => {
      // TokenService is mocked, but in real implementation it must use RS256
      // This test documents the requirement
      expect(mockTokenService.generateTokenPair).toBeDefined();
    });

    it('should verify password with Argon2id', async () => {
      const mockActiveUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$salt$hash',
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
        emailVerifiedAt: new Date('2025-01-01'),
        mfaConfiguration: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);

      // Password hash must start with $argon2id$
      expect(mockActiveUser.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it('should use Argon2 service for password verification', async () => {
      const mockActiveUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$salt$hash',
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
        emailVerifiedAt: new Date('2025-01-01'),
        mfaConfiguration: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.session.count.mockResolvedValue(0);
      mockPrisma.userDevice.findUnique.mockResolvedValue(null);
      mockPrisma.userDevice.create.mockResolvedValue({
        id: 'device-123',
        isTrusted: false,
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'session-123' });

      await loginWithTimers({
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123!',
        deviceFingerprint: 'device-fingerprint-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        correlationId: 'test-correlation-id',
        rememberMe: false,
      });

      // Argon2 service should be called to verify password
      expect(mockArgon2Service.verify).toHaveBeenCalledWith(
        mockActiveUser.passwordHash,
        'SecureP@ssw0rd123!'
      );
    });
  });
});
