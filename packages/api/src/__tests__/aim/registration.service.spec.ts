import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { RegistrationService } from '../../services/aim/registration.service';
import { AuditLogger } from '../../utils/audit-logger';

// Mock Prisma client
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  userProfile: {
    create: vi.fn(),
  },
  emailVerification: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  role: {
    findFirst: vi.fn(),
  },
  userRole: {
    create: vi.fn(),
  },
  authAuditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

// Mock Redis client
const mockRedis = {
  lpush: vi.fn(),
  pipeline: vi.fn(() => ({
    zremrangebyscore: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    pexpire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([[null, 0], [null, 0], [null, 1], [null, 1]]),
  })),
};

// Mock fetch for HaveIBeenPwned API
global.fetch = vi.fn();

describe('RegistrationService', () => {
  let registrationService: RegistrationService;
  let auditLogger: AuditLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    auditLogger = new AuditLogger(mockPrisma as any);
    registrationService = new RegistrationService(
      mockPrisma as any,
      mockRedis as any,
      auditLogger
    );

    // Default mock for HaveIBeenPwned - password not breached
    (global.fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    const validParams = {
      email: 'test@example.com',
      password: 'SecureP@ssw0rd123!',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      correlationId: 'test-correlation-id',
    };

    it('should register a new user successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: 'PENDING_VERIFICATION',
      });
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-user', name: 'USER' });

      const result = await registrationService.register(validParams);

      expect(result.userId).toBe('user-123');
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
            status: 'PENDING_VERIFICATION',
          }),
        })
      );
    });

    it('should normalize email to lowercase', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: 'PENDING_VERIFICATION',
      });
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-user', name: 'USER' });

      await registrationService.register({
        ...validParams,
        email: 'TEST@EXAMPLE.COM',
      });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should reject registration if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com',
      });

      await expect(registrationService.register(validParams)).rejects.toThrow(TRPCError);
      await expect(registrationService.register(validParams)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('should reject breached password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Mock HaveIBeenPwned to return password as breached
      const passwordHash = '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8'; // SHA1 of 'password'
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`${passwordHash.slice(5)}:1234\nOTHERHASH:5678`),
      });

      // Use 'password' which will be found in breach database
      await expect(
        registrationService.register({
          ...validParams,
          password: 'password',
        })
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: expect.stringContaining('ujawnione'),
      });
    });

    it('should hash password with Argon2id', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: 'PENDING_VERIFICATION',
      });
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-user', name: 'USER' });

      await registrationService.register(validParams);

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: expect.stringMatching(/^\$argon2id\$/),
          }),
        })
      );
    });

    it('should create email verification token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: 'PENDING_VERIFICATION',
      });
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-user', name: 'USER' });

      await registrationService.register(validParams);

      expect(mockPrisma.emailVerification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            tokenHash: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        })
      );

      // Verify token expires in ~24 hours
      const createCall = mockPrisma.emailVerification.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt;
      const expectedExpiry = Date.now() + 24 * 60 * 60 * 1000;
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedExpiry + 1000);
    });

    it('should assign default USER role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: 'PENDING_VERIFICATION',
      });
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-user', name: 'USER' });

      await registrationService.register(validParams);

      expect(mockPrisma.userRole.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          roleId: 'role-user',
        },
      });
    });

    it('should log registration audit event', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: 'PENDING_VERIFICATION',
      });
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-user', name: 'USER' });

      await registrationService.register(validParams);

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'USER_REGISTERED',
            userId: 'user-123',
            ipAddress: '192.168.1.1',
          }),
        })
      );
    });

    it('should queue verification email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: 'PENDING_VERIFICATION',
      });
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-user', name: 'USER' });

      await registrationService.register(validParams);

      // Wait for async email queue
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'email:queue',
        expect.stringContaining('EMAIL_VERIFICATION')
      );
    });
  });

  describe('verifyEmail', () => {
    const validParams = {
      token: 'a'.repeat(64), // 64-char hex token
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      correlationId: 'test-correlation-id',
    };

    it('should verify email with valid token', async () => {
      mockPrisma.emailVerification.findFirst.mockResolvedValue({
        id: 'verification-123',
        userId: 'user-123',
        tokenHash: expect.any(String),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
        usedAt: null,
        user: { email: 'test@example.com' },
      });

      const result = await registrationService.verifyEmail(validParams);

      expect(result.userId).toBe('user-123');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          status: 'ACTIVE',
          emailVerifiedAt: expect.any(Date),
        }),
      });
    });

    it('should reject invalid token', async () => {
      mockPrisma.emailVerification.findFirst.mockResolvedValue(null);

      await expect(registrationService.verifyEmail(validParams)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('should reject expired token', async () => {
      mockPrisma.emailVerification.findFirst.mockResolvedValue({
        id: 'verification-123',
        userId: 'user-123',
        tokenHash: expect.any(String),
        expiresAt: new Date(Date.now() - 1000), // Expired
        usedAt: null,
        user: { email: 'test@example.com' },
      });

      await expect(registrationService.verifyEmail(validParams)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: expect.stringContaining('wygasł'),
      });
    });

    it('should mark token as used after verification', async () => {
      mockPrisma.emailVerification.findFirst.mockResolvedValue({
        id: 'verification-123',
        userId: 'user-123',
        tokenHash: expect.any(String),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        usedAt: null,
        user: { email: 'test@example.com' },
      });

      await registrationService.verifyEmail(validParams);

      expect(mockPrisma.emailVerification.update).toHaveBeenCalledWith({
        where: { id: 'verification-123' },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('should log verification audit event', async () => {
      mockPrisma.emailVerification.findFirst.mockResolvedValue({
        id: 'verification-123',
        userId: 'user-123',
        tokenHash: expect.any(String),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        usedAt: null,
        user: { email: 'test@example.com' },
      });

      await registrationService.verifyEmail(validParams);

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'EMAIL_VERIFIED',
            userId: 'user-123',
          }),
        })
      );
    });
  });

  describe('resendVerificationEmail', () => {
    const validParams = {
      email: 'test@example.com',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      correlationId: 'test-correlation-id',
    };

    it('should resend verification email for pending user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: 'PENDING_VERIFICATION',
      });

      await registrationService.resendVerificationEmail(validParams);

      expect(mockPrisma.emailVerification.updateMany).toHaveBeenCalled();
      expect(mockPrisma.emailVerification.create).toHaveBeenCalled();
      expect(mockRedis.lpush).toHaveBeenCalled();
    });

    it('should not reveal non-existent email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Should not throw, just silently return
      await expect(
        registrationService.resendVerificationEmail(validParams)
      ).resolves.toBeUndefined();
    });

    it('should not resend for already verified users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: 'ACTIVE', // Already verified
      });

      await registrationService.resendVerificationEmail(validParams);

      expect(mockPrisma.emailVerification.create).not.toHaveBeenCalled();
    });

    it('should invalidate existing tokens before creating new one', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: 'PENDING_VERIFICATION',
      });

      await registrationService.resendVerificationEmail(validParams);

      expect(mockPrisma.emailVerification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          usedAt: null,
        },
        data: expect.objectContaining({
          usedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('security requirements (Constitution compliance)', () => {
    it('should use Argon2id for password hashing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: 'PENDING_VERIFICATION',
      });
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-user', name: 'USER' });

      await registrationService.register({
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123!',
        ipAddress: '192.168.1.1',
        correlationId: 'test',
      });

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it('should generate 32-byte (256-bit) verification token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: 'PENDING_VERIFICATION',
      });
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-user', name: 'USER' });

      await registrationService.register({
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123!',
        ipAddress: '192.168.1.1',
        correlationId: 'test',
      });

      const verificationCall = mockPrisma.emailVerification.create.mock.calls[0][0];
      // SHA-256 hash of 32-byte token = 64 hex characters
      expect(verificationCall.data.tokenHash).toHaveLength(64);
    });

    it('should store only token hash, not plain token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: 'PENDING_VERIFICATION',
      });
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-user', name: 'USER' });

      await registrationService.register({
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123!',
        ipAddress: '192.168.1.1',
        correlationId: 'test',
      });

      const verificationCall = mockPrisma.emailVerification.create.mock.calls[0][0];
      // Token hash should be hex-only (SHA-256 output)
      expect(verificationCall.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should set 24-hour token expiry', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: 'PENDING_VERIFICATION',
      });
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-user', name: 'USER' });

      const beforeRegister = Date.now();
      await registrationService.register({
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123!',
        ipAddress: '192.168.1.1',
        correlationId: 'test',
      });
      const afterRegister = Date.now();

      const verificationCall = mockPrisma.emailVerification.create.mock.calls[0][0];
      const expiresAt = verificationCall.data.expiresAt.getTime();
      const expectedMin = beforeRegister + 24 * 60 * 60 * 1000;
      const expectedMax = afterRegister + 24 * 60 * 60 * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt).toBeLessThanOrEqual(expectedMax);
    });

    it('should check HaveIBeenPwned with k-anonymity', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: 'PENDING_VERIFICATION',
      });
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-user', name: 'USER' });

      await registrationService.register({
        email: 'test@example.com',
        password: 'SecureP@ssw0rd123!',
        ipAddress: '192.168.1.1',
        correlationId: 'test',
      });

      // Should have called HaveIBeenPwned API
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/api\.pwnedpasswords\.com\/range\/[A-F0-9]{5}$/),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
          }),
        })
      );
    });
  });
});
