import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { appRouter } from '../../index';

// Mock the password-reset.service module
vi.mock('../../services/aim/password-reset.service', () => {
  const mockRequestPasswordReset = vi.fn();
  const mockResetPassword = vi.fn();
  const mockValidateResetToken = vi.fn();

  return {
    PasswordResetService: vi.fn().mockImplementation(() => ({
      requestPasswordReset: mockRequestPasswordReset,
      resetPassword: mockResetPassword,
      validateResetToken: mockValidateResetToken,
    })),
    __mocks: {
      requestPasswordReset: mockRequestPasswordReset,
      resetPassword: mockResetPassword,
      validateResetToken: mockValidateResetToken,
    },
  };
});

// Import mocks after vi.mock
const { __mocks: serviceMocks } = await import('../../services/aim/password-reset.service') as any;

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  lpush: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
};

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  passwordResetToken: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  passwordHistory: {
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  session: {
    updateMany: vi.fn(),
  },
};

// Mock AuditLogger
const mockAuditLogger = {
  log: vi.fn().mockResolvedValue(undefined),
};

describe('Password Reset Router', () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset service mocks
    serviceMocks.requestPasswordReset.mockReset();
    serviceMocks.resetPassword.mockReset();
    serviceMocks.validateResetToken.mockReset();

    caller = appRouter.createCaller({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      auditLogger: mockAuditLogger as any,
      user: null, // Public procedures don't require auth
      ipAddress: '192.168.1.1',
      userAgent: 'Test Browser',
      correlationId: 'test-correlation-id',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('aim.passwordReset.requestReset', () => {
    const validEmail = 'test@example.com';

    it('should accept valid email and return success message', async () => {
      serviceMocks.requestPasswordReset.mockResolvedValue({
        success: true,
        message: 'Jeśli konto istnieje, wysłaliśmy link do resetowania hasła.',
      });

      const result = await caller.aim.passwordReset.requestReset({
        email: validEmail,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('link do resetowania hasła');
      expect(serviceMocks.requestPasswordReset).toHaveBeenCalledWith({
        email: validEmail.toLowerCase(),
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser',
        correlationId: 'test-correlation-id',
      });
    });

    it('should normalize email to lowercase', async () => {
      serviceMocks.requestPasswordReset.mockResolvedValue({
        success: true,
        message: 'Jeśli konto istnieje, wysłaliśmy link do resetowania hasła.',
      });

      await caller.aim.passwordReset.requestReset({
        email: 'TEST@EXAMPLE.COM',
      });

      expect(serviceMocks.requestPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
        })
      );
    });

    it('should return same response for non-existent email (enumeration prevention)', async () => {
      serviceMocks.requestPasswordReset.mockResolvedValue({
        success: true,
        message: 'Jeśli konto istnieje, wysłaliśmy link do resetowania hasła.',
      });

      const result = await caller.aim.passwordReset.requestReset({
        email: 'nonexistent@example.com',
      });

      // Should always return success to prevent enumeration
      expect(result.success).toBe(true);
      expect(result.message).toContain('Jeśli konto istnieje');
    });

    it('should reject invalid email format', async () => {
      await expect(
        caller.aim.passwordReset.requestReset({
          email: 'invalid-email',
        })
      ).rejects.toThrow();
    });

    it('should reject empty email', async () => {
      await expect(
        caller.aim.passwordReset.requestReset({
          email: '',
        })
      ).rejects.toThrow();
    });

    it('should include IP address and user agent in request', async () => {
      serviceMocks.requestPasswordReset.mockResolvedValue({
        success: true,
        message: 'Jeśli konto istnieje, wysłaliśmy link do resetowania hasła.',
      });

      await caller.aim.passwordReset.requestReset({
        email: validEmail,
      });

      expect(serviceMocks.requestPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '192.168.1.1',
          userAgent: 'Test Browser',
          correlationId: 'test-correlation-id',
        })
      );
    });
  });

  describe('aim.passwordReset.reset', () => {
    const validToken = 'a'.repeat(64); // 64-character token
    const validPassword = 'SecurePassword123!';
    const validInput = {
      token: validToken,
      password: validPassword,
      confirmPassword: validPassword,
    };

    it('should reset password with valid token and password', async () => {
      serviceMocks.resetPassword.mockResolvedValue({
        success: true,
        message: 'Hasło zostało zmienione pomyślnie.',
      });

      const result = await caller.aim.passwordReset.reset(validInput);

      expect(result.success).toBe(true);
      expect(result.message).toContain('pomyślnie');
      expect(serviceMocks.resetPassword).toHaveBeenCalledWith({
        token: validToken,
        password: validPassword,
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser',
        correlationId: 'test-correlation-id',
      });
    });

    it('should reject token shorter than 64 characters', async () => {
      await expect(
        caller.aim.passwordReset.reset({
          ...validInput,
          token: 'a'.repeat(63),
        })
      ).rejects.toThrow();
    });

    it('should reject token longer than 64 characters', async () => {
      await expect(
        caller.aim.passwordReset.reset({
          ...validInput,
          token: 'a'.repeat(65),
        })
      ).rejects.toThrow();
    });

    it('should reject password shorter than 12 characters', async () => {
      await expect(
        caller.aim.passwordReset.reset({
          ...validInput,
          password: 'Short1!',
          confirmPassword: 'Short1!',
        })
      ).rejects.toThrow();
    });

    it('should reject password without uppercase letter', async () => {
      await expect(
        caller.aim.passwordReset.reset({
          ...validInput,
          password: 'securepassword123!',
          confirmPassword: 'securepassword123!',
        })
      ).rejects.toThrow();
    });

    it('should reject password without lowercase letter', async () => {
      await expect(
        caller.aim.passwordReset.reset({
          ...validInput,
          password: 'SECUREPASSWORD123!',
          confirmPassword: 'SECUREPASSWORD123!',
        })
      ).rejects.toThrow();
    });

    it('should reject password without digit', async () => {
      await expect(
        caller.aim.passwordReset.reset({
          ...validInput,
          password: 'SecurePasswordNoDigit!',
          confirmPassword: 'SecurePasswordNoDigit!',
        })
      ).rejects.toThrow();
    });

    it('should reject password without special character', async () => {
      await expect(
        caller.aim.passwordReset.reset({
          ...validInput,
          password: 'SecurePassword123',
          confirmPassword: 'SecurePassword123',
        })
      ).rejects.toThrow();
    });

    it('should reject mismatched passwords', async () => {
      await expect(
        caller.aim.passwordReset.reset({
          ...validInput,
          password: 'SecurePassword123!',
          confirmPassword: 'DifferentPassword123!',
        })
      ).rejects.toThrow(/identyczne/i);
    });

    it('should handle invalid token error from service', async () => {
      serviceMocks.resetPassword.mockRejectedValue({
        code: 'BAD_REQUEST',
        message: 'Nieprawidłowy lub już użyty token.',
      });

      await expect(caller.aim.passwordReset.reset(validInput)).rejects.toThrow();
    });

    it('should handle expired token error from service', async () => {
      serviceMocks.resetPassword.mockRejectedValue({
        code: 'BAD_REQUEST',
        message: 'Token resetowania hasła wygasł.',
      });

      await expect(caller.aim.passwordReset.reset(validInput)).rejects.toThrow();
    });

    it('should handle password reuse error from service', async () => {
      serviceMocks.resetPassword.mockRejectedValue({
        code: 'BAD_REQUEST',
        message: 'To hasło było już używane wcześniej.',
      });

      await expect(caller.aim.passwordReset.reset(validInput)).rejects.toThrow();
    });
  });

  describe('aim.passwordReset.validateToken', () => {
    const validToken = 'b'.repeat(64);

    it('should return valid for valid, unused, non-expired token', async () => {
      serviceMocks.validateResetToken.mockResolvedValue({
        valid: true,
      });

      const result = await caller.aim.passwordReset.validateToken({
        token: validToken,
      });

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return invalid with TOKEN_INVALID reason for bad token', async () => {
      serviceMocks.validateResetToken.mockResolvedValue({
        valid: false,
        reason: 'TOKEN_INVALID',
      });

      const result = await caller.aim.passwordReset.validateToken({
        token: validToken,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('TOKEN_INVALID');
    });

    it('should return invalid with TOKEN_EXPIRED reason for expired token', async () => {
      serviceMocks.validateResetToken.mockResolvedValue({
        valid: false,
        reason: 'TOKEN_EXPIRED',
      });

      const result = await caller.aim.passwordReset.validateToken({
        token: validToken,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('TOKEN_EXPIRED');
    });

    it('should return invalid with TOKEN_USED reason for already used token', async () => {
      serviceMocks.validateResetToken.mockResolvedValue({
        valid: false,
        reason: 'TOKEN_USED',
      });

      const result = await caller.aim.passwordReset.validateToken({
        token: validToken,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('TOKEN_USED');
    });

    it('should reject token with invalid length', async () => {
      await expect(
        caller.aim.passwordReset.validateToken({
          token: 'short',
        })
      ).rejects.toThrow();
    });
  });
});
