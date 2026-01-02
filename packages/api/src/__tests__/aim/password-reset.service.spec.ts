import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { PasswordResetService } from '../../services/aim/password-reset.service';

// Mock Argon2Service
const mockArgon2Instance = {
  hash: vi.fn().mockResolvedValue('$argon2id$hashed_password'),
  verify: vi.fn().mockResolvedValue(false), // Default: password doesn't match history
};

vi.mock('@ksiegowacrm/auth', () => ({
  Argon2Service: vi.fn().mockImplementation(() => mockArgon2Instance),
}));

// Mock crypto
vi.mock('crypto', async () => {
  const actual = await vi.importActual('crypto');
  return {
    ...actual,
    randomBytes: vi.fn().mockReturnValue({
      toString: () => 'a'.repeat(64),
    }),
    createHash: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        digest: () => 'mocked_token_hash',
      }),
    }),
  };
});

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  passwordResetToken: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  passwordHistory: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  session: {
    updateMany: vi.fn(),
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
};

const mockAuditLogger = {
  log: vi.fn(),
};

// Helper to call async function with fake timers
async function callWithTimers<T>(promiseFn: () => Promise<T>, advanceMs: number = 200): Promise<T> {
  const promise = promiseFn();
  await vi.advanceTimersByTimeAsync(advanceMs);
  return promise;
}

describe('PasswordResetService', () => {
  let service: PasswordResetService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));

    // Reset Argon2 mock to default behavior
    mockArgon2Instance.hash.mockResolvedValue('$argon2id$hashed_password');
    mockArgon2Instance.verify.mockResolvedValue(false);

    // Reset prisma mocks
    mockPrisma.passwordHistory.count.mockResolvedValue(0);
    mockPrisma.passwordHistory.findMany.mockResolvedValue([]);

    service = new PasswordResetService(
      mockPrisma as any,
      mockRedis as any,
      mockAuditLogger as any
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('requestPasswordReset', () => {
    const baseParams = {
      email: 'user@example.com',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      correlationId: 'test-correlation-id',
    };

    it('should create password reset token for existing active user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        status: 'ACTIVE',
      });

      const result = await callWithTimers(() => service.requestPasswordReset(baseParams));

      expect(result.success).toBe(true);
      expect(result.message).toContain('Jeśli konto istnieje');
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          tokenHash: expect.any(String),
          ipAddress: '192.168.1.1',
        }),
      });
    });

    it('should return success even for non-existent email (enumeration prevention)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await callWithTimers(() => service.requestPasswordReset(baseParams));

      expect(result.success).toBe(true);
      expect(result.message).toContain('Jeśli konto istnieje');
      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('should return success for non-active users (enumeration prevention)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        status: 'PENDING_VERIFICATION',
      });

      const result = await callWithTimers(() => service.requestPasswordReset(baseParams));

      expect(result.success).toBe(true);
      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('should invalidate existing reset tokens before creating new one', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        status: 'ACTIVE',
      });

      await callWithTimers(() => service.requestPasswordReset(baseParams));

      expect(mockPrisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          usedAt: null,
        },
        data: {
          usedAt: expect.any(Date),
        },
      });
    });

    it('should set token expiry to 1 hour', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        status: 'ACTIVE',
      });

      await callWithTimers(() => service.requestPasswordReset(baseParams));

      const createCall = mockPrisma.passwordResetToken.create.mock.calls[0][0];
      const expiresAt = new Date(createCall.data.expiresAt);
      const now = new Date('2024-01-15T10:00:00Z');
      const hourLater = new Date(now.getTime() + 60 * 60 * 1000);

      expect(expiresAt.getTime()).toBe(hourLater.getTime());
    });

    it('should log PASSWORD_RESET_REQUESTED audit event', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        status: 'ACTIVE',
      });

      await callWithTimers(() => service.requestPasswordReset(baseParams));

      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        eventType: 'PASSWORD_RESET_REQUESTED',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: { email: 'user@example.com' },
        correlationId: 'test-correlation-id',
      });
    });

    it('should queue password reset email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        status: 'ACTIVE',
      });

      await callWithTimers(() => service.requestPasswordReset(baseParams));

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'email:queue',
        expect.stringContaining('"type":"PASSWORD_RESET"')
      );
    });

    it('should have consistent timing regardless of user existence (timing attack prevention)', async () => {
      // Test with existing user
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        status: 'ACTIVE',
      });

      const startValid = Date.now();
      await callWithTimers(() => service.requestPasswordReset(baseParams));
      const validDuration = Date.now() - startValid;

      vi.clearAllMocks();

      // Test with non-existent user
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const startInvalid = Date.now();
      await callWithTimers(() => service.requestPasswordReset({ ...baseParams, email: 'nonexistent@example.com' }));
      const invalidDuration = Date.now() - startInvalid;

      // Both should take similar time (min 200ms due to timing protection)
      expect(Math.abs(validDuration - invalidDuration)).toBeLessThan(50);
    });
  });

  describe('resetPassword', () => {
    const baseParams = {
      token: 'a'.repeat(64),
      password: 'NewSecureP@ssw0rd123!',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      correlationId: 'test-correlation-id',
    };

    it('should reset password with valid token', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'token-123',
        userId: 'user-123',
        tokenHash: 'mocked_token_hash',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        user: {
          id: 'user-123',
          email: 'user@example.com',
          passwordHash: '$argon2id$old_password',
        },
      });
      mockPrisma.passwordHistory.findMany.mockResolvedValue([]);
      mockPrisma.passwordHistory.count.mockResolvedValue(0);
      mockArgon2Instance.verify.mockResolvedValue(false); // Password doesn't match history

      const result = await service.resetPassword(baseParams);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Hasło zostało zmienione');
    });

    it('should reject expired token', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'token-123',
        userId: 'user-123',
        tokenHash: 'mocked_token_hash',
        expiresAt: new Date(Date.now() - 60 * 1000), // Expired 1 minute ago
        usedAt: null,
        user: {
          id: 'user-123',
          email: 'user@example.com',
        },
      });

      await expect(service.resetPassword(baseParams)).rejects.toThrow(TRPCError);
      await expect(service.resetPassword(baseParams)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('should reject already used token', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword(baseParams)).rejects.toThrow(TRPCError);
      await expect(service.resetPassword(baseParams)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('should reject invalid token format', async () => {
      const invalidParams = { ...baseParams, token: 'short-token' };

      await expect(service.resetPassword(invalidParams)).rejects.toThrow(TRPCError);
    });

    it('should check password history (last 5 passwords)', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'token-123',
        userId: 'user-123',
        tokenHash: 'mocked_token_hash',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        user: {
          id: 'user-123',
          email: 'user@example.com',
          passwordHash: '$argon2id$current_password',
        },
      });

      // Mock password history
      mockPrisma.passwordHistory.findMany.mockResolvedValue([
        { passwordHash: '$argon2id$old1' },
        { passwordHash: '$argon2id$old2' },
        { passwordHash: '$argon2id$old3' },
        { passwordHash: '$argon2id$old4' },
        { passwordHash: '$argon2id$old5' },
      ]);

      // Mock Argon2 verify to return true for history check (password matches history)
      mockArgon2Instance.verify.mockResolvedValue(true);

      await expect(service.resetPassword(baseParams)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: expect.stringContaining('używane wcześniej'),
      });
    });

    it('should update password and mark token as used', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'token-123',
        userId: 'user-123',
        tokenHash: 'mocked_token_hash',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        user: {
          id: 'user-123',
          email: 'user@example.com',
          passwordHash: '$argon2id$old_password',
        },
      });
      mockPrisma.passwordHistory.findMany.mockResolvedValue([]);
      mockPrisma.passwordHistory.count.mockResolvedValue(0);
      mockArgon2Instance.verify.mockResolvedValue(false);

      await service.resetPassword(baseParams);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          passwordHash: expect.any(String),
          passwordChangedAt: expect.any(Date),
        },
      });

      expect(mockPrisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'token-123' },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('should save current password to history before changing', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'token-123',
        userId: 'user-123',
        tokenHash: 'mocked_token_hash',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        user: {
          id: 'user-123',
          email: 'user@example.com',
          passwordHash: '$argon2id$current_password',
        },
      });
      mockPrisma.passwordHistory.findMany.mockResolvedValue([]);
      mockPrisma.passwordHistory.count.mockResolvedValue(0);
      mockArgon2Instance.verify.mockResolvedValue(false);

      await service.resetPassword(baseParams);

      expect(mockPrisma.passwordHistory.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          passwordHash: '$argon2id$current_password',
        },
      });
    });

    it('should keep only last 5 passwords in history', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'token-123',
        userId: 'user-123',
        tokenHash: 'mocked_token_hash',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        user: {
          id: 'user-123',
          email: 'user@example.com',
          passwordHash: '$argon2id$current_password',
        },
      });

      // Mock verification to return false first (current doesn't match), then check history
      mockArgon2Instance.verify.mockResolvedValue(false);

      // 5 existing passwords in check
      mockPrisma.passwordHistory.findMany
        .mockResolvedValueOnce([]) // First call for password check returns empty (allow)
        .mockResolvedValueOnce([  // Second call for cleanup
          { id: 'h1', createdAt: new Date('2024-01-01') },
          { id: 'h2', createdAt: new Date('2024-01-02') },
          { id: 'h3', createdAt: new Date('2024-01-03') },
          { id: 'h4', createdAt: new Date('2024-01-04') },
          { id: 'h5', createdAt: new Date('2024-01-05') },
        ]);

      // 6 passwords after adding new one (need to delete oldest)
      mockPrisma.passwordHistory.count.mockResolvedValue(6);

      await service.resetPassword(baseParams);

      expect(mockPrisma.passwordHistory.deleteMany).toHaveBeenCalled();
    });

    it('should log PASSWORD_RESET_COMPLETED audit event', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'token-123',
        userId: 'user-123',
        tokenHash: 'mocked_token_hash',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        user: {
          id: 'user-123',
          email: 'user@example.com',
          passwordHash: '$argon2id$old_password',
        },
      });
      mockPrisma.passwordHistory.findMany.mockResolvedValue([]);
      mockPrisma.passwordHistory.count.mockResolvedValue(0);
      mockArgon2Instance.verify.mockResolvedValue(false);

      await service.resetPassword(baseParams);

      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        eventType: 'PASSWORD_RESET_COMPLETED',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: { email: 'user@example.com' },
        correlationId: 'test-correlation-id',
      });
    });

    it('should invalidate all active sessions after password reset', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'token-123',
        userId: 'user-123',
        tokenHash: 'mocked_token_hash',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        user: {
          id: 'user-123',
          email: 'user@example.com',
          passwordHash: '$argon2id$old_password',
        },
      });
      mockPrisma.passwordHistory.findMany.mockResolvedValue([]);
      mockPrisma.passwordHistory.count.mockResolvedValue(0);
      mockArgon2Instance.verify.mockResolvedValue(false);

      await service.resetPassword(baseParams);

      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          isActive: true,
        },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
          revokeReason: 'PASSWORD_RESET',
        },
      });
    });
  });

  describe('validateResetToken', () => {
    it('should return true for valid unexpired token', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'token-123',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
      });

      const result = await service.validateResetToken('a'.repeat(64));

      expect(result.valid).toBe(true);
    });

    it('should return false for expired token', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'token-123',
        expiresAt: new Date(Date.now() - 60 * 1000),
        usedAt: null,
      });

      const result = await service.validateResetToken('a'.repeat(64));

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('TOKEN_EXPIRED');
    });

    it('should return false for already used token', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(null);

      const result = await service.validateResetToken('a'.repeat(64));

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('TOKEN_INVALID');
    });

    it('should return false for invalid token format', async () => {
      const result = await service.validateResetToken('short-token');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('TOKEN_INVALID');
    });
  });
});
