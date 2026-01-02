import { describe, it, expect, beforeEach, vi } from 'vitest';
import { inferProcedureInput } from '@trpc/server';
import { createContext } from '../../context';
import { appRouter } from '../../index';
import type { RegistrationRouter } from '../../routers/aim/registration.router';

// Mock dependencies
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

const mockRedis = {
  lpush: vi.fn(),
  pipeline: vi.fn(() => ({
    zremrangebyscore: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    pexpire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([[null, 0], [null, 0], [null, 1], [null, 1]]),
  })),
  zremrangebyscore: vi.fn(),
  del: vi.fn(),
};

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  text: () => Promise.resolve(''),
});

describe('Registration Router', () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    vi.clearAllMocks();

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

  describe('register', () => {
    const validInput = {
      email: 'test@example.com',
      password: 'SecureP@ssw0rd123!',
      confirmPassword: 'SecureP@ssw0rd123!',
      acceptTerms: true as const,
      acceptPrivacyPolicy: true as const,
    };

    it('should register user with valid input', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: 'PENDING_VERIFICATION',
      });
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-user', name: 'USER' });

      const result = await caller.aim.registration.register(validInput);

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-123');
    });

    it('should reject mismatched passwords', async () => {
      await expect(
        caller.aim.registration.register({
          ...validInput,
          confirmPassword: 'DifferentP@ssw0rd123!',
        })
      ).rejects.toThrow();
    });

    it('should reject weak password', async () => {
      await expect(
        caller.aim.registration.register({
          ...validInput,
          password: 'weak',
          confirmPassword: 'weak',
        })
      ).rejects.toThrow();
    });

    it('should reject invalid email format', async () => {
      await expect(
        caller.aim.registration.register({
          ...validInput,
          email: 'invalid-email',
        })
      ).rejects.toThrow();
    });

    it('should reject without terms acceptance', async () => {
      await expect(
        caller.aim.registration.register({
          ...validInput,
          acceptTerms: false as any,
        })
      ).rejects.toThrow();
    });

    it('should reject without privacy policy acceptance', async () => {
      await expect(
        caller.aim.registration.register({
          ...validInput,
          acceptPrivacyPolicy: false as any,
        })
      ).rejects.toThrow();
    });

    it('should return rate limit error when exceeded', async () => {
      // Simulate rate limit exceeded
      mockRedis.pipeline.mockReturnValue({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        pexpire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([[null, 0], [null, 5], [null, 1], [null, 1]]), // 5 existing requests
      });

      await expect(caller.aim.registration.register(validInput)).rejects.toMatchObject({
        code: 'TOO_MANY_REQUESTS',
      });
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const token = 'a'.repeat(64);
      mockPrisma.emailVerification.findFirst.mockResolvedValue({
        id: 'verification-123',
        userId: 'user-123',
        tokenHash: expect.any(String),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        usedAt: null,
        user: { email: 'test@example.com' },
      });

      const result = await caller.aim.registration.verifyEmail({ token });

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-123');
    });

    it('should reject invalid token', async () => {
      mockPrisma.emailVerification.findFirst.mockResolvedValue(null);

      await expect(
        caller.aim.registration.verifyEmail({ token: 'a'.repeat(64) })
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('should reject token with wrong length', async () => {
      await expect(
        caller.aim.registration.verifyEmail({ token: 'short' })
      ).rejects.toThrow();
    });
  });

  describe('resendVerification', () => {
    it('should return success message regardless of email existence', async () => {
      // Ensure rate limit allows request (count = 0)
      mockRedis.pipeline.mockReturnValue({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        pexpire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([[null, 0], [null, 0], [null, 1], [null, 1]]),
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await caller.aim.registration.resendVerification({
        email: 'nonexistent@example.com',
      });

      // Should not reveal email existence
      expect(result.success).toBe(true);
      expect(result.message).toContain('Jeśli konto istnieje');
    });

    it('should rate limit resend requests', async () => {
      // Set rate limit to exceeded (count = 5 >= maxRequests = 3)
      mockRedis.pipeline.mockReturnValue({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        pexpire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([[null, 0], [null, 5], [null, 1], [null, 1]]),
      });

      await expect(
        caller.aim.registration.resendVerification({ email: 'test@example.com' })
      ).rejects.toMatchObject({
        code: 'TOO_MANY_REQUESTS',
      });
    });
  });

  describe('checkEmailAvailability', () => {
    it('should return available for non-existent email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await caller.aim.registration.checkEmailAvailability({
        email: 'new@example.com',
      });

      expect(result.available).toBe(true);
    });

    it('should return not available for existing email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-123' });

      const result = await caller.aim.registration.checkEmailAvailability({
        email: 'existing@example.com',
      });

      expect(result.available).toBe(false);
    });

    it('should enforce minimum response time (timing attack prevention)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const startTime = Date.now();
      await caller.aim.registration.checkEmailAvailability({
        email: 'test@example.com',
      });
      const elapsed = Date.now() - startTime;

      // Should take at least 200ms
      expect(elapsed).toBeGreaterThanOrEqual(200);
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
          caller.aim.registration.register({
            email,
            password: 'SecureP@ssw0rd123!',
            confirmPassword: 'SecureP@ssw0rd123!',
            acceptTerms: true,
            acceptPrivacyPolicy: true,
          })
        ).rejects.toThrow();
      }
    });

    it('should validate password complexity', async () => {
      const weakPasswords = [
        'short', // Too short
        'nouppercase123!', // No uppercase
        'NOLOWERCASE123!', // No lowercase
        'NoNumbers!!', // No digits
        'NoSpecialChars123', // No special chars
      ];

      for (const password of weakPasswords) {
        await expect(
          caller.aim.registration.register({
            email: 'test@example.com',
            password,
            confirmPassword: password,
            acceptTerms: true,
            acceptPrivacyPolicy: true,
          })
        ).rejects.toThrow();
      }
    });
  });
});
