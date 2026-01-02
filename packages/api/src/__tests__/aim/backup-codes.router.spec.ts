import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createContext } from '../../context';
import { appRouter } from '../../index';

// ==========================================================================
// MOCKS - Use vi.hoisted() to ensure mocks are available when vi.mock runs
// ==========================================================================

const mockBackupCodesServiceMethods = vi.hoisted(() => ({
  getStatus: vi.fn(),
  listUsedCodes: vi.fn(),
  exportCodes: vi.fn(),
  verifyDirect: vi.fn(),
  regenerateCodes: vi.fn(),
}));

// Mock BackupCodesService module
vi.mock('../../services/aim/backup-codes.service', () => ({
  BackupCodesService: vi.fn(() => mockBackupCodesServiceMethods),
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
    verifyToken: vi.fn(),
    verifyBackupCode: vi.fn(),
    generateBackupCodes: vi.fn(),
    hashBackupCode: vi.fn(),
  })),
  totpService: {
    verifyToken: vi.fn(),
    verifyBackupCode: vi.fn(),
    generateBackupCodes: vi.fn(),
    hashBackupCode: vi.fn(),
  },
}));

// Alias for cleaner access in tests
const mocks = {
  backupCodesGetStatus: mockBackupCodesServiceMethods.getStatus,
  backupCodesListUsedCodes: mockBackupCodesServiceMethods.listUsedCodes,
  backupCodesExportCodes: mockBackupCodesServiceMethods.exportCodes,
  backupCodesVerifyDirect: mockBackupCodesServiceMethods.verifyDirect,
  backupCodesRegenerateCodes: mockBackupCodesServiceMethods.regenerateCodes,
};

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  mfaConfiguration: {
    findUnique: vi.fn(),
  },
  mfaBackupCode: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
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

describe('Backup Codes Router', () => {
  let userCaller: ReturnType<typeof appRouter.createCaller>;

  // UUIDs
  const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440002';
  const ORG_ID = '550e8400-e29b-41d4-a716-446655440030';
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

  const mockStatusResponse = {
    isEnabled: true,
    totalCodes: 10,
    remainingCodes: 8,
    usedCodes: 2,
    lastUsedAt: '2025-01-15T11:00:00.000Z',
    generatedAt: '2025-01-15T10:00:00.000Z',
    shouldRegenerate: false,
  };

  const mockUsedCodesResponse = {
    items: [
      {
        id: 'bc-1',
        usedAt: '2025-01-15T11:00:00.000Z',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 Chrome/120.0',
      },
      {
        id: 'bc-2',
        usedAt: '2025-01-15T10:30:00.000Z',
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0 Firefox/121.0',
      },
    ],
    total: 2,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  };

  const mockExportResponse = {
    format: 'text' as const,
    content: 'Backup codes content...',
    filename: 'backup-codes-2025-01-15.txt',
    mimeType: 'text/plain',
    generatedAt: '2025-01-15T12:00:00.000Z',
    warning: 'Zapisz te kody w bezpiecznym miejscu.',
  };

  const mockVerifyDirectResponse = {
    success: true,
    remainingCodes: 7,
    shouldRegenerate: false,
    verifiedAt: '2025-01-15T12:00:00.000Z',
  };

  const mockRegenerateResponse = {
    codes: [
      'NEWC1234',
      'NEWD5678',
      'NEWE9012',
      'NEWF3456',
      'NEWG7890',
      'NEWH1234',
      'NEWI5678',
      'NEWJ9012',
      'NEWK3456',
      'NEWL7890',
    ],
    generatedAt: '2025-01-15T12:00:00.000Z',
    warning: 'Zapisz te kody w bezpiecznym miejscu. Poprzednie kody są już nieaktywne.',
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

    // Default mocks for BackupCodesService methods
    mocks.backupCodesGetStatus.mockResolvedValue(mockStatusResponse);
    mocks.backupCodesListUsedCodes.mockResolvedValue(mockUsedCodesResponse);
    mocks.backupCodesExportCodes.mockResolvedValue(mockExportResponse);
    mocks.backupCodesVerifyDirect.mockResolvedValue(mockVerifyDirectResponse);
    mocks.backupCodesRegenerateCodes.mockResolvedValue(mockRegenerateResponse);
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
        url: '/api/trpc/aim.backupCodes',
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
        url: '/api/trpc/aim.backupCodes',
        method: 'POST',
      } as any,
      res: {} as any,
    });
  }

  // ==========================================================================
  // AUTHENTICATION TESTS
  // ==========================================================================

  describe('Authentication', () => {
    it('should require authentication for getStatus', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(unauthCaller.aim.backupCodes.getStatus()).rejects.toThrow();
    });

    it('should require authentication for listUsedCodes', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(unauthCaller.aim.backupCodes.listUsedCodes({})).rejects.toThrow();
    });

    it('should require authentication for exportCodes', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.aim.backupCodes.export({
          password: VALID_PASSWORD,
          totpCode: VALID_TOTP_CODE,
          format: 'text',
        }),
      ).rejects.toThrow();
    });

    it('should require authentication for verifyDirect', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.aim.backupCodes.verifyDirect({ code: VALID_BACKUP_CODE }),
      ).rejects.toThrow();
    });

    it('should require authentication for regenerateCodes', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.aim.backupCodes.regenerate({
          password: VALID_PASSWORD,
          totpCode: VALID_TOTP_CODE,
        }),
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // GET STATUS TESTS
  // ==========================================================================

  describe('getStatus', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should return backup codes status', async () => {
      const result = await userCaller.aim.backupCodes.getStatus();

      expect(result).toEqual(mockStatusResponse);
      expect(mocks.backupCodesGetStatus).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('should return disabled status when MFA is not configured', async () => {
      mocks.backupCodesGetStatus.mockResolvedValue({
        isEnabled: false,
        totalCodes: 0,
        remainingCodes: 0,
        usedCodes: 0,
        lastUsedAt: null,
        generatedAt: null,
        shouldRegenerate: false,
      });

      const result = await userCaller.aim.backupCodes.getStatus();

      expect(result.isEnabled).toBe(false);
      expect(result.totalCodes).toBe(0);
    });

    it('should indicate when regeneration is needed', async () => {
      mocks.backupCodesGetStatus.mockResolvedValue({
        ...mockStatusResponse,
        remainingCodes: 2,
        shouldRegenerate: true,
      });

      const result = await userCaller.aim.backupCodes.getStatus();

      expect(result.shouldRegenerate).toBe(true);
    });
  });

  // ==========================================================================
  // LIST USED CODES TESTS
  // ==========================================================================

  describe('listUsedCodes', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should return paginated list of used backup codes', async () => {
      const result = await userCaller.aim.backupCodes.listUsedCodes({});

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(mocks.backupCodesListUsedCodes).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({ page: 1, limit: 10 }),
      );
    });

    it('should pass custom pagination parameters', async () => {
      await userCaller.aim.backupCodes.listUsedCodes({
        pagination: { page: 2, limit: 5 },
      });

      expect(mocks.backupCodesListUsedCodes).toHaveBeenCalledWith(TEST_USER_ID, { page: 2, limit: 5 });
    });

    it('should return empty list when no codes have been used', async () => {
      mocks.backupCodesListUsedCodes.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      });

      const result = await userCaller.aim.backupCodes.listUsedCodes({});

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should throw error when MFA is not enabled', async () => {
      mocks.backupCodesListUsedCodes.mockRejectedValue(
        new TRPCError({
          code: 'NOT_FOUND',
          message: 'MFA nie jest aktywne dla tego konta',
        }),
      );

      await expect(userCaller.aim.backupCodes.listUsedCodes({})).rejects.toThrow(TRPCError);

      await expect(userCaller.aim.backupCodes.listUsedCodes({})).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  // ==========================================================================
  // EXPORT CODES TESTS
  // ==========================================================================

  describe('export', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should export backup codes in text format', async () => {
      const result = await userCaller.aim.backupCodes.export({
        password: VALID_PASSWORD,
        totpCode: VALID_TOTP_CODE,
        format: 'text',
      });

      expect(result.format).toBe('text');
      expect(result.mimeType).toBe('text/plain');
      expect(result.content).toBeTruthy();
      expect(mocks.backupCodesExportCodes).toHaveBeenCalledWith(
        TEST_USER_ID,
        expect.objectContaining({
          password: VALID_PASSWORD,
          totpCode: VALID_TOTP_CODE,
          format: 'text',
        }),
      );
    });

    it('should export backup codes in PDF format', async () => {
      mocks.backupCodesExportCodes.mockResolvedValue({
        format: 'pdf' as const,
        content: 'base64-encoded-pdf-content',
        filename: 'backup-codes-2025-01-15.pdf',
        mimeType: 'application/pdf',
        generatedAt: '2025-01-15T12:00:00.000Z',
        expiresAt: '2025-01-15T12:05:00.000Z',
        warning: 'Zapisz te kody w bezpiecznym miejscu.',
      });

      const result = await userCaller.aim.backupCodes.export({
        password: VALID_PASSWORD,
        totpCode: VALID_TOTP_CODE,
        format: 'pdf',
      });

      expect(result.format).toBe('pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.expiresAt).toBeTruthy();
    });

    it('should throw error when password is invalid', async () => {
      mocks.backupCodesExportCodes.mockRejectedValue(
        new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Nieprawidłowe hasło',
        }),
      );

      await expect(
        userCaller.aim.backupCodes.export({
          password: 'wrong-password',
          totpCode: VALID_TOTP_CODE,
          format: 'text',
        }),
      ).rejects.toThrow(TRPCError);

      await expect(
        userCaller.aim.backupCodes.export({
          password: 'wrong-password',
          totpCode: VALID_TOTP_CODE,
          format: 'text',
        }),
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('should throw error when TOTP code is invalid', async () => {
      mocks.backupCodesExportCodes.mockRejectedValue(
        new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nieprawidłowy kod TOTP',
        }),
      );

      await expect(
        userCaller.aim.backupCodes.export({
          password: VALID_PASSWORD,
          totpCode: '000000',
          format: 'text',
        }),
      ).rejects.toThrow(TRPCError);

      await expect(
        userCaller.aim.backupCodes.export({
          password: VALID_PASSWORD,
          totpCode: '000000',
          format: 'text',
        }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('should throw error when MFA is not enabled', async () => {
      mocks.backupCodesExportCodes.mockRejectedValue(
        new TRPCError({
          code: 'NOT_FOUND',
          message: 'MFA nie jest aktywne dla tego konta',
        }),
      );

      await expect(
        userCaller.aim.backupCodes.export({
          password: VALID_PASSWORD,
          totpCode: VALID_TOTP_CODE,
          format: 'text',
        }),
      ).rejects.toThrow(TRPCError);
    });
  });

  // ==========================================================================
  // VERIFY DIRECT TESTS
  // ==========================================================================

  describe('verifyDirect', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should verify valid backup code', async () => {
      const result = await userCaller.aim.backupCodes.verifyDirect({
        code: VALID_BACKUP_CODE,
      });

      expect(result.success).toBe(true);
      expect(result.remainingCodes).toBe(7);
      expect(result.shouldRegenerate).toBe(false);
      expect(mocks.backupCodesVerifyDirect).toHaveBeenCalledWith(
        TEST_USER_ID,
        VALID_BACKUP_CODE,
        expect.any(String), // IP address
        expect.any(String), // User agent
      );
    });

    it('should indicate when regeneration is needed after verification', async () => {
      mocks.backupCodesVerifyDirect.mockResolvedValue({
        success: true,
        remainingCodes: 2,
        shouldRegenerate: true,
        verifiedAt: '2025-01-15T12:00:00.000Z',
      });

      const result = await userCaller.aim.backupCodes.verifyDirect({
        code: VALID_BACKUP_CODE,
      });

      expect(result.shouldRegenerate).toBe(true);
    });

    it('should throw error when backup code is invalid', async () => {
      mocks.backupCodesVerifyDirect.mockRejectedValue(
        new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nieprawidłowy kod zapasowy',
        }),
      );

      await expect(
        userCaller.aim.backupCodes.verifyDirect({ code: 'INVALID1' }),
      ).rejects.toThrow(TRPCError);

      await expect(
        userCaller.aim.backupCodes.verifyDirect({ code: 'INVALID1' }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('should throw error when MFA is not enabled', async () => {
      mocks.backupCodesVerifyDirect.mockRejectedValue(
        new TRPCError({
          code: 'NOT_FOUND',
          message: 'MFA nie jest aktywne dla tego konta',
        }),
      );

      await expect(
        userCaller.aim.backupCodes.verifyDirect({ code: VALID_BACKUP_CODE }),
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error when no unused backup codes exist', async () => {
      mocks.backupCodesVerifyDirect.mockRejectedValue(
        new TRPCError({
          code: 'NOT_FOUND',
          message: 'Brak dostępnych kodów zapasowych',
        }),
      );

      await expect(
        userCaller.aim.backupCodes.verifyDirect({ code: VALID_BACKUP_CODE }),
      ).rejects.toThrow(TRPCError);
    });

    it('should convert lowercase code to uppercase', async () => {
      await userCaller.aim.backupCodes.verifyDirect({
        code: 'abcd1234',
      });

      // The code should be transformed to uppercase by Zod schema
      expect(mocks.backupCodesVerifyDirect).toHaveBeenCalledWith(
        TEST_USER_ID,
        'ABCD1234',
        expect.any(String),
        expect.any(String),
      );
    });
  });

  // ==========================================================================
  // REGENERATE CODES TESTS
  // ==========================================================================

  describe('regenerate', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should regenerate backup codes', async () => {
      const result = await userCaller.aim.backupCodes.regenerate({
        password: VALID_PASSWORD,
        totpCode: VALID_TOTP_CODE,
      });

      expect(result.codes).toHaveLength(10);
      expect(result.generatedAt).toBe('2025-01-15T12:00:00.000Z');
      expect(result.warning).toBeTruthy();
      expect(mocks.backupCodesRegenerateCodes).toHaveBeenCalledWith(
        TEST_USER_ID,
        VALID_PASSWORD,
        VALID_TOTP_CODE,
      );
    });

    it('should throw error when password is invalid', async () => {
      mocks.backupCodesRegenerateCodes.mockRejectedValue(
        new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Nieprawidłowe hasło',
        }),
      );

      await expect(
        userCaller.aim.backupCodes.regenerate({
          password: 'wrong-password',
          totpCode: VALID_TOTP_CODE,
        }),
      ).rejects.toThrow(TRPCError);

      await expect(
        userCaller.aim.backupCodes.regenerate({
          password: 'wrong-password',
          totpCode: VALID_TOTP_CODE,
        }),
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('should throw error when TOTP code is invalid', async () => {
      mocks.backupCodesRegenerateCodes.mockRejectedValue(
        new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nieprawidłowy kod TOTP',
        }),
      );

      await expect(
        userCaller.aim.backupCodes.regenerate({
          password: VALID_PASSWORD,
          totpCode: '000000',
        }),
      ).rejects.toThrow(TRPCError);

      await expect(
        userCaller.aim.backupCodes.regenerate({
          password: VALID_PASSWORD,
          totpCode: '000000',
        }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('should throw error when MFA is not enabled', async () => {
      mocks.backupCodesRegenerateCodes.mockRejectedValue(
        new TRPCError({
          code: 'NOT_FOUND',
          message: 'MFA nie jest aktywne dla tego konta',
        }),
      );

      await expect(
        userCaller.aim.backupCodes.regenerate({
          password: VALID_PASSWORD,
          totpCode: VALID_TOTP_CODE,
        }),
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error when user not found', async () => {
      mocks.backupCodesRegenerateCodes.mockRejectedValue(
        new TRPCError({
          code: 'NOT_FOUND',
          message: 'Użytkownik nie został znaleziony',
        }),
      );

      await expect(
        userCaller.aim.backupCodes.regenerate({
          password: VALID_PASSWORD,
          totpCode: VALID_TOTP_CODE,
        }),
      ).rejects.toThrow(TRPCError);
    });
  });
});
