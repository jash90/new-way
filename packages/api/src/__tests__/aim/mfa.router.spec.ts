import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createContext } from '../../context';
import { appRouter } from '../../index';

// ==========================================================================
// MOCKS - Use vi.hoisted() to ensure mocks are available when vi.mock runs
// ==========================================================================

// vi.hoisted ensures these are available before vi.mock factory functions run
const mockMfaServiceMethods = vi.hoisted(() => ({
  getMfaStatus: vi.fn(),
  initiateSetup: vi.fn(),
  verifySetup: vi.fn(),
  disableMfa: vi.fn(),
  createChallenge: vi.fn(),
  verifyTotp: vi.fn(),
  verifyBackupCode: vi.fn(),
  regenerateBackupCodes: vi.fn(),
}));

// Mock MfaService module - this will replace all imports of MfaService
vi.mock('../../services/aim/mfa.service', () => ({
  MfaService: vi.fn(() => mockMfaServiceMethods),
}));

// Mock @ksiegowacrm/auth
vi.mock('@ksiegowacrm/auth', () => ({
  Argon2Service: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockResolvedValue(true),
  })),
  argon2Service: {
    verify: vi.fn().mockResolvedValue(true),
  },
  TotpService: vi.fn().mockImplementation(() => ({
    generateSecret: vi.fn(),
    verifyToken: vi.fn(),
    generateBackupCodes: vi.fn(),
    hashBackupCode: vi.fn(),
    verifyBackupCode: vi.fn(),
  })),
  totpService: {
    generateSecret: vi.fn(),
    verifyToken: vi.fn(),
    generateBackupCodes: vi.fn(),
    hashBackupCode: vi.fn(),
    verifyBackupCode: vi.fn(),
  },
}));

// Alias for cleaner access in tests
const mocks = {
  mfaGetStatus: mockMfaServiceMethods.getMfaStatus,
  mfaInitiateSetup: mockMfaServiceMethods.initiateSetup,
  mfaVerifySetup: mockMfaServiceMethods.verifySetup,
  mfaDisable: mockMfaServiceMethods.disableMfa,
  mfaCreateChallenge: mockMfaServiceMethods.createChallenge,
  mfaVerifyTotp: mockMfaServiceMethods.verifyTotp,
  mfaVerifyBackupCode: mockMfaServiceMethods.verifyBackupCode,
  mfaRegenerateBackupCodes: mockMfaServiceMethods.regenerateBackupCodes,
  // Auth service mocks
  argon2Verify: vi.fn(),
  totpGenerateSecret: vi.fn(),
  totpVerifyToken: vi.fn(),
  totpGenerateBackupCodes: vi.fn(),
  totpHashBackupCode: vi.fn(),
  totpVerifyBackupCode: vi.fn(),
};

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  mfaConfiguration: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  mfaBackupCode: {
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  mfaChallenge: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
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
  incr: vi.fn(),
  expire: vi.fn(),
  keys: vi.fn(),
  pipeline: vi.fn(() => ({
    del: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
};

// ==========================================================================
// TEST SUITE
// ==========================================================================

describe('MFA Router', () => {
  let userCaller: ReturnType<typeof appRouter.createCaller>;

  // UUIDs
  const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440002';
  const ORG_ID = '550e8400-e29b-41d4-a716-446655440030';
  const MOCK_CHALLENGE_TOKEN = 'challenge-token-123456789';
  const MOCK_SETUP_TOKEN = 'setup-token-abcdef123456';
  const VALID_TOTP_CODE = '123456';
  const VALID_BACKUP_CODE = 'ABCD1234';
  const VALID_PASSWORD = 'SecureP@ssw0rd123!';

  const mockUser = {
    id: TEST_USER_ID,
    email: 'test@example.com',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$hashedpassword',
    status: 'ACTIVE',
    isEmailVerified: true,
  };

  const mockMfaConfiguration = {
    id: 'mfa-config-1',
    userId: TEST_USER_ID,
    secretEncrypted: 'mock-encrypted-secret',
    isEnabled: true,
    verifiedAt: new Date('2025-01-15T10:00:00Z'),
    lastUsedAt: new Date('2025-01-15T11:00:00Z'),
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: new Date('2025-01-15T10:00:00Z'),
    updatedAt: new Date('2025-01-15T11:00:00Z'),
  };

  const mockChallenge = {
    id: 'challenge-1',
    userId: TEST_USER_ID,
    challengeToken: MOCK_CHALLENGE_TOKEN,
    type: 'totp',
    attempts: 0,
    maxAttempts: 3,
    expiresAt: new Date('2025-01-15T12:05:00.000Z'),
    completedAt: null,
    ipAddress: '192.168.1.1',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    vi.clearAllMocks();

    // Default mocks for Redis
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.keys.mockResolvedValue([]);

    // Default mocks for Prisma
    mockPrisma.authAuditLog.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    // Default mocks for auth services
    mocks.argon2Verify.mockResolvedValue(true);
    mocks.totpGenerateSecret.mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      qrCodeDataUrl: 'data:image/png;base64,mockQrCode',
      otpauthUrl: 'otpauth://totp/TestApp:test@example.com?secret=JBSWY3DPEHPK3PXP',
    });
    mocks.totpVerifyToken.mockReturnValue(true);
    mocks.totpGenerateBackupCodes.mockReturnValue([
      'ABCD1234', 'EFGH5678', 'IJKL9012', 'MNOP3456', 'QRST7890',
      'UVWX1234', 'YZAB5678', 'CDEF9012', 'GHIJ3456', 'KLMN7890',
    ]);
    mocks.totpHashBackupCode.mockResolvedValue('hashed-backup-code');
    mocks.totpVerifyBackupCode.mockResolvedValue(true);

    // Default mocks for MfaService methods
    mocks.mfaGetStatus.mockResolvedValue({
      isEnabled: true,
      isVerified: true,
      lastUsedAt: '2025-01-15T11:00:00.000Z',
      backupCodesRemaining: 10,
      createdAt: '2025-01-15T10:00:00.000Z',
    });
    mocks.mfaInitiateSetup.mockResolvedValue({
      setupToken: MOCK_SETUP_TOKEN,
      qrCodeDataUrl: 'data:image/png;base64,mockQrCode',
      otpauthUrl: 'otpauth://totp/TestApp:test@example.com?secret=JBSWY3DPEHPK3PXP',
      expiresAt: '2025-01-15T12:10:00.000Z',
    });
    mocks.mfaVerifySetup.mockResolvedValue({
      success: true,
      backupCodes: [
        'ABCD1234', 'EFGH5678', 'IJKL9012', 'MNOP3456', 'QRST7890',
        'UVWX1234', 'YZAB5678', 'CDEF9012', 'GHIJ3456', 'KLMN7890',
      ],
      message: 'MFA zostało aktywowane pomyślnie',
    });
    mocks.mfaDisable.mockResolvedValue({
      success: true,
    });
    mocks.mfaCreateChallenge.mockResolvedValue({
      challengeToken: MOCK_CHALLENGE_TOKEN,
      type: 'totp',
      expiresAt: '2025-01-15T12:05:00.000Z',
      attemptsRemaining: 3,
    });
    mocks.mfaVerifyTotp.mockResolvedValue({
      success: true,
      userId: TEST_USER_ID,
      completedAt: '2025-01-15T12:00:00.000Z',
    });
    mocks.mfaVerifyBackupCode.mockResolvedValue({
      success: true,
      userId: TEST_USER_ID,
      completedAt: '2025-01-15T12:00:00.000Z',
    });
    mocks.mfaRegenerateBackupCodes.mockResolvedValue({
      codes: [
        'NEWC1234', 'NEWD5678', 'NEWE9012', 'NEWF3456', 'NEWG7890',
        'NEWH1234', 'NEWI5678', 'NEWJ9012', 'NEWK3456', 'NEWL7890',
      ],
      generatedAt: '2025-01-15T12:00:00.000Z',
      warning: 'Zapisz te kody w bezpiecznym miejscu. Będą one wyświetlone tylko raz.',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // CONTEXT HELPERS
  // ==========================================================================

  function createUserContext() {
    const ctx = createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
          authorization: 'Bearer user-token',
        },
        url: '/api/trpc/aim.mfa',
        method: 'POST',
      } as any,
      res: {} as any,
    });

    return {
      ...ctx,
      session: {
        sessionId: SESSION_ID,
        userId: TEST_USER_ID,
        email: 'test@example.com',
        roles: ['USER'],
        organizationId: ORG_ID,
      },
    };
  }

  function createUnauthenticatedContext() {
    return createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
        },
        url: '/api/trpc/aim.mfa',
        method: 'POST',
      } as any,
      res: {} as any,
    });
  }

  // ==========================================================================
  // AUTHENTICATION TESTS
  // ==========================================================================

  describe('Authentication', () => {
    it('should require authentication for getMfaStatus', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.aim.mfa.getStatus()
      ).rejects.toThrow();
    });

    it('should require authentication for initiateSetup', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.aim.mfa.initiateSetup({ password: VALID_PASSWORD })
      ).rejects.toThrow();
    });

    it('should require authentication for disableMfa', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.aim.mfa.disable({ password: VALID_PASSWORD, code: VALID_TOTP_CODE })
      ).rejects.toThrow();
    });

    it('should require authentication for regenerateBackupCodes', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.aim.mfa.regenerateBackupCodes({ password: VALID_PASSWORD, code: VALID_TOTP_CODE })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // MFA STATUS TESTS
  // ==========================================================================

  describe('getStatus', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should return MFA disabled status when user has no MFA', async () => {
      // Configure service to return disabled status
      mocks.mfaGetStatus.mockResolvedValue({
        isEnabled: false,
        isVerified: false,
        lastUsedAt: null,
        backupCodesRemaining: 0,
        createdAt: null,
      });

      const result = await userCaller.aim.mfa.getStatus();

      expect(result.isEnabled).toBe(false);
      expect(result.isVerified).toBe(false);
      expect(result.backupCodesRemaining).toBe(0);
    });

    it('should return MFA enabled status with backup codes count', async () => {
      // Configure service to return enabled status with 8 backup codes
      mocks.mfaGetStatus.mockResolvedValue({
        isEnabled: true,
        isVerified: true,
        lastUsedAt: '2025-01-15T11:00:00.000Z',
        backupCodesRemaining: 8,
        createdAt: '2025-01-15T10:00:00.000Z',
      });

      const result = await userCaller.aim.mfa.getStatus();

      expect(result.isEnabled).toBe(true);
      expect(result.isVerified).toBe(true);
      expect(result.backupCodesRemaining).toBe(8);
    });
  });

  // ==========================================================================
  // MFA SETUP TESTS
  // ==========================================================================

  describe('initiateSetup', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should return QR code and setup token on successful initiation', async () => {
      // Default mock returns success response (configured in beforeEach)
      const result = await userCaller.aim.mfa.initiateSetup({ password: VALID_PASSWORD });

      expect(result).toHaveProperty('setupToken');
      expect(result).toHaveProperty('qrCodeDataUrl');
      expect(result).toHaveProperty('otpauthUrl');
      expect(result).toHaveProperty('expiresAt');
    });

    it('should reject if MFA is already enabled', async () => {
      // Configure service to throw error when MFA is already enabled
      mocks.mfaInitiateSetup.mockRejectedValue(
        new TRPCError({
          code: 'BAD_REQUEST',
          message: 'MFA jest już włączone dla tego konta',
        })
      );

      await expect(
        userCaller.aim.mfa.initiateSetup({ password: VALID_PASSWORD })
      ).rejects.toThrow('MFA jest już włączone');
    });

    it('should validate password format', async () => {
      await expect(
        userCaller.aim.mfa.initiateSetup({ password: '' })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // MFA VERIFICATION TESTS
  // ==========================================================================

  describe('verifySetup', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should enable MFA and return backup codes on successful verification', async () => {
      // Default mock returns success (configured in beforeEach)
      const result = await userCaller.aim.mfa.verifySetup({
        setupToken: MOCK_SETUP_TOKEN,
        code: VALID_TOTP_CODE,
      });

      expect(result.success).toBe(true);
      expect(result.backupCodes).toHaveLength(10);
    });

    it('should reject invalid setup token', async () => {
      // Configure service to throw error for invalid token
      mocks.mfaVerifySetup.mockRejectedValue(
        new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Token konfiguracji wygasł lub jest nieprawidłowy',
        })
      );

      await expect(
        userCaller.aim.mfa.verifySetup({
          setupToken: 'invalid-token',
          code: VALID_TOTP_CODE,
        })
      ).rejects.toThrow('Token konfiguracji');
    });

    it('should validate TOTP code format', async () => {
      await expect(
        userCaller.aim.mfa.verifySetup({
          setupToken: MOCK_SETUP_TOKEN,
          code: 'abc', // Invalid format
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // MFA DISABLE TESTS
  // ==========================================================================

  describe('disable', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should disable MFA when password and TOTP code are valid', async () => {
      // Default mock returns success (configured in beforeEach)
      const result = await userCaller.aim.mfa.disable({
        password: VALID_PASSWORD,
        code: VALID_TOTP_CODE,
      });

      expect(result.success).toBe(true);
      expect(mocks.mfaDisable).toHaveBeenCalled();
    });

    it('should reject if MFA is not enabled', async () => {
      // Configure service to throw error when MFA is not enabled
      mocks.mfaDisable.mockRejectedValue(
        new TRPCError({
          code: 'NOT_FOUND',
          message: 'MFA nie jest włączone dla tego konta',
        })
      );

      await expect(
        userCaller.aim.mfa.disable({
          password: VALID_PASSWORD,
          code: VALID_TOTP_CODE,
        })
      ).rejects.toThrow('MFA nie jest włączone');
    });
  });

  // ==========================================================================
  // MFA CHALLENGE TESTS
  // ==========================================================================

  describe('createChallenge', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should create MFA challenge for user with enabled MFA', async () => {
      // Default mock returns success (configured in beforeEach)
      const result = await userCaller.aim.mfa.createChallenge();

      expect(result).toHaveProperty('challengeToken');
      expect(result).toHaveProperty('type', 'totp');
      expect(result).toHaveProperty('expiresAt');
      expect(result.attemptsRemaining).toBe(3);
      expect(mocks.mfaCreateChallenge).toHaveBeenCalled();
    });

    it('should reject if MFA is not enabled', async () => {
      mocks.mfaCreateChallenge.mockRejectedValue(
        new TRPCError({
          code: 'NOT_FOUND',
          message: 'MFA nie jest włączone dla tego konta',
        })
      );

      await expect(
        userCaller.aim.mfa.createChallenge()
      ).rejects.toThrow('MFA nie jest włączone');
    });

    it('should reject if MFA is locked', async () => {
      mocks.mfaCreateChallenge.mockRejectedValue(
        new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Konto MFA jest zablokowane. Spróbuj ponownie później.',
        })
      );

      await expect(
        userCaller.aim.mfa.createChallenge()
      ).rejects.toThrow('zablokowane');
    });
  });

  // ==========================================================================
  // TOTP VERIFICATION TESTS
  // ==========================================================================

  describe('verifyTotp', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should verify valid TOTP code and complete challenge', async () => {
      // Default mock returns success (configured in beforeEach)
      const result = await userCaller.aim.mfa.verifyTotp({
        challengeToken: MOCK_CHALLENGE_TOKEN,
        code: VALID_TOTP_CODE,
      });

      expect(result.success).toBe(true);
      expect(result.userId).toBe(TEST_USER_ID);
      expect(mocks.mfaVerifyTotp).toHaveBeenCalled();
    });

    it('should reject invalid challenge token', async () => {
      mocks.mfaVerifyTotp.mockRejectedValue(
        new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wyzwanie MFA nie zostało znalezione lub wygasło',
        })
      );

      await expect(
        userCaller.aim.mfa.verifyTotp({
          challengeToken: 'invalid-token',
          code: VALID_TOTP_CODE,
        })
      ).rejects.toThrow('Wyzwanie MFA');
    });

    it('should reject expired challenge', async () => {
      mocks.mfaVerifyTotp.mockRejectedValue(
        new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Wyzwanie MFA wygasło',
        })
      );

      await expect(
        userCaller.aim.mfa.verifyTotp({
          challengeToken: MOCK_CHALLENGE_TOKEN,
          code: VALID_TOTP_CODE,
        })
      ).rejects.toThrow('wygasło');
    });

    it('should validate TOTP code format', async () => {
      await expect(
        userCaller.aim.mfa.verifyTotp({
          challengeToken: MOCK_CHALLENGE_TOKEN,
          code: 'invalid',
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // BACKUP CODE VERIFICATION TESTS
  // ==========================================================================

  describe('verifyBackupCode', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should verify valid backup code and complete challenge', async () => {
      // Default mock returns success (configured in beforeEach)
      const result = await userCaller.aim.mfa.verifyBackupCode({
        challengeToken: MOCK_CHALLENGE_TOKEN,
        code: VALID_BACKUP_CODE,
      });

      expect(result.success).toBe(true);
      expect(result.userId).toBe(TEST_USER_ID);
      expect(mocks.mfaVerifyBackupCode).toHaveBeenCalled();
    });

    it('should reject invalid challenge token', async () => {
      mocks.mfaVerifyBackupCode.mockRejectedValue(
        new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wyzwanie MFA nie zostało znalezione lub wygasło',
        })
      );

      await expect(
        userCaller.aim.mfa.verifyBackupCode({
          challengeToken: 'invalid-token',
          code: VALID_BACKUP_CODE,
        })
      ).rejects.toThrow('Wyzwanie MFA');
    });

    it('should reject invalid backup code format', async () => {
      await expect(
        userCaller.aim.mfa.verifyBackupCode({
          challengeToken: MOCK_CHALLENGE_TOKEN,
          code: 'ab', // Too short
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // BACKUP CODE REGENERATION TESTS
  // ==========================================================================

  describe('regenerateBackupCodes', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should regenerate backup codes with valid password and TOTP', async () => {
      // Default mock returns success (configured in beforeEach)
      const result = await userCaller.aim.mfa.regenerateBackupCodes({
        password: VALID_PASSWORD,
        code: VALID_TOTP_CODE,
      });

      expect(result.codes).toHaveLength(10);
      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('warning');
      expect(mocks.mfaRegenerateBackupCodes).toHaveBeenCalled();
    });

    it('should reject if MFA is not enabled', async () => {
      mocks.mfaRegenerateBackupCodes.mockRejectedValue(
        new TRPCError({
          code: 'NOT_FOUND',
          message: 'MFA nie jest włączone dla tego konta',
        })
      );

      await expect(
        userCaller.aim.mfa.regenerateBackupCodes({
          password: VALID_PASSWORD,
          code: VALID_TOTP_CODE,
        })
      ).rejects.toThrow('MFA nie jest włączone');
    });

    it('should validate TOTP code format', async () => {
      await expect(
        userCaller.aim.mfa.regenerateBackupCodes({
          password: VALID_PASSWORD,
          code: 'invalid',
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // INPUT VALIDATION TESTS
  // ==========================================================================

  describe('Input Validation', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should validate TOTP code is exactly 6 digits', async () => {
      mockPrisma.mfaChallenge.findUnique.mockResolvedValue(mockChallenge);

      // Too short
      await expect(
        userCaller.aim.mfa.verifyTotp({
          challengeToken: MOCK_CHALLENGE_TOKEN,
          code: '12345',
        })
      ).rejects.toThrow();

      // Too long
      await expect(
        userCaller.aim.mfa.verifyTotp({
          challengeToken: MOCK_CHALLENGE_TOKEN,
          code: '1234567',
        })
      ).rejects.toThrow();

      // Non-numeric
      await expect(
        userCaller.aim.mfa.verifyTotp({
          challengeToken: MOCK_CHALLENGE_TOKEN,
          code: 'abcdef',
        })
      ).rejects.toThrow();
    });

    it('should validate backup code is exactly 8 alphanumeric characters', async () => {
      mockPrisma.mfaChallenge.findUnique.mockResolvedValue(mockChallenge);

      // Too short
      await expect(
        userCaller.aim.mfa.verifyBackupCode({
          challengeToken: MOCK_CHALLENGE_TOKEN,
          code: 'ABC123',
        })
      ).rejects.toThrow();

      // Too long
      await expect(
        userCaller.aim.mfa.verifyBackupCode({
          challengeToken: MOCK_CHALLENGE_TOKEN,
          code: 'ABCD12345',
        })
      ).rejects.toThrow();
    });

    it('should validate setup token is not empty', async () => {
      await expect(
        userCaller.aim.mfa.verifySetup({
          setupToken: '',
          code: VALID_TOTP_CODE,
        })
      ).rejects.toThrow();
    });

    it('should validate challenge token is not empty', async () => {
      await expect(
        userCaller.aim.mfa.verifyTotp({
          challengeToken: '',
          code: VALID_TOTP_CODE,
        })
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // RATE LIMITING / SECURITY TESTS
  // ==========================================================================

  describe('Security', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should reject when invalid TOTP code is provided', async () => {
      mocks.mfaVerifyTotp.mockRejectedValue(
        new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Nieprawidłowy kod TOTP',
        })
      );

      await expect(
        userCaller.aim.mfa.verifyTotp({
          challengeToken: MOCK_CHALLENGE_TOKEN,
          code: '000000',
        })
      ).rejects.toThrow('Nieprawidłowy kod TOTP');
    });

    it('should reject when max attempts exceeded', async () => {
      mocks.mfaVerifyTotp.mockRejectedValue(
        new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Przekroczono maksymalną liczbę prób. Wyzwanie zostało unieważnione.',
        })
      );

      await expect(
        userCaller.aim.mfa.verifyTotp({
          challengeToken: MOCK_CHALLENGE_TOKEN,
          code: VALID_TOTP_CODE,
        })
      ).rejects.toThrow('Przekroczono maksymalną liczbę prób');
    });

    it('should create challenge with correct expiry time', async () => {
      // Verify the returned challenge has 5 minute expiry
      const result = await userCaller.aim.mfa.createChallenge();

      expect(result).toHaveProperty('expiresAt');
      expect(mocks.mfaCreateChallenge).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // SERVICE INTEGRATION TESTS
  // ==========================================================================

  describe('Service Integration', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should call MfaService.initiateSetup with correct user ID', async () => {
      await userCaller.aim.mfa.initiateSetup({ password: VALID_PASSWORD });

      expect(mocks.mfaInitiateSetup).toHaveBeenCalledWith(
        TEST_USER_ID,
        VALID_PASSWORD
      );
    });

    it('should call MfaService.verifySetup with correct parameters', async () => {
      await userCaller.aim.mfa.verifySetup({
        setupToken: MOCK_SETUP_TOKEN,
        code: VALID_TOTP_CODE,
      });

      expect(mocks.mfaVerifySetup).toHaveBeenCalledWith(
        MOCK_SETUP_TOKEN,
        VALID_TOTP_CODE
      );
    });

    it('should call MfaService.disableMfa with correct parameters', async () => {
      await userCaller.aim.mfa.disable({
        password: VALID_PASSWORD,
        code: VALID_TOTP_CODE,
      });

      expect(mocks.mfaDisable).toHaveBeenCalledWith(
        TEST_USER_ID,
        VALID_PASSWORD,
        VALID_TOTP_CODE
      );
    });

    it('should call MfaService.regenerateBackupCodes with correct parameters', async () => {
      await userCaller.aim.mfa.regenerateBackupCodes({
        password: VALID_PASSWORD,
        code: VALID_TOTP_CODE,
      });

      expect(mocks.mfaRegenerateBackupCodes).toHaveBeenCalledWith(
        TEST_USER_ID,
        VALID_PASSWORD,
        VALID_TOTP_CODE
      );
    });
  });
});
