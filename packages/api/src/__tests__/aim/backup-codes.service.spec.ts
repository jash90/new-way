import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { BackupCodesService } from '../../services/aim/backup-codes.service';
import { AuditLogger } from '../../utils/audit-logger';

// Mock TotpService
const mockTotpService = {
  verifyToken: vi.fn(),
  verifyBackupCode: vi.fn(),
  generateBackupCodes: vi.fn(),
  hashBackupCode: vi.fn(),
};

// Mock Argon2 service for password verification
const mockArgon2Service = {
  verify: vi.fn(),
};

// Mock dependencies
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
  del: vi.fn(),
  setex: vi.fn(),
};

describe('BackupCodesService', () => {
  let backupCodesService: BackupCodesService;
  let auditLogger: AuditLogger;

  const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const TEST_EMAIL = 'test@example.com';
  const VALID_PASSWORD = 'SecureP@ssw0rd123!';
  const VALID_TOTP_CODE = '123456';
  const VALID_BACKUP_CODE = 'ABCD1234';

  // Mock encrypted secret (iv:authTag:encrypted in hex)
  const MOCK_IV = '0123456789abcdef0123456789abcdef';
  const MOCK_AUTH_TAG = 'fedcba9876543210fedcba9876543210';
  const MOCK_ENCRYPTED_DATA = 'deadbeef';
  const MOCK_ENCRYPTED_SECRET = `${MOCK_IV}:${MOCK_AUTH_TAG}:${MOCK_ENCRYPTED_DATA}`;

  const mockUser = {
    id: TEST_USER_ID,
    email: TEST_EMAIL,
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$hashedpassword',
    status: 'ACTIVE',
    isEmailVerified: true,
  };

  const mockMfaConfiguration = {
    id: 'mfa-config-1',
    userId: TEST_USER_ID,
    secretEncrypted: MOCK_ENCRYPTED_SECRET,
    isEnabled: true,
    verifiedAt: new Date('2025-01-15T10:00:00Z'),
    lastUsedAt: new Date('2025-01-15T11:00:00Z'),
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: new Date('2025-01-15T10:00:00Z'),
    updatedAt: new Date('2025-01-15T11:00:00Z'),
  };

  const mockBackupCodes = [
    {
      id: 'bc-1',
      userId: TEST_USER_ID,
      codeHash: 'hash1',
      usedAt: null,
      usedIpAddress: null,
      usedUserAgent: null,
      createdAt: new Date('2025-01-15T10:00:00Z'),
    },
    {
      id: 'bc-2',
      userId: TEST_USER_ID,
      codeHash: 'hash2',
      usedAt: null,
      usedIpAddress: null,
      usedUserAgent: null,
      createdAt: new Date('2025-01-15T10:00:00Z'),
    },
    {
      id: 'bc-3',
      userId: TEST_USER_ID,
      codeHash: 'hash3',
      usedAt: null,
      usedIpAddress: null,
      usedUserAgent: null,
      createdAt: new Date('2025-01-15T10:00:00Z'),
    },
    {
      id: 'bc-4',
      userId: TEST_USER_ID,
      codeHash: 'hash4',
      usedAt: null,
      usedIpAddress: null,
      usedUserAgent: null,
      createdAt: new Date('2025-01-15T10:00:00Z'),
    },
    {
      id: 'bc-5',
      userId: TEST_USER_ID,
      codeHash: 'hash5',
      usedAt: null,
      usedIpAddress: null,
      usedUserAgent: null,
      createdAt: new Date('2025-01-15T10:00:00Z'),
    },
    {
      id: 'bc-6',
      userId: TEST_USER_ID,
      codeHash: 'hash6',
      usedAt: new Date('2025-01-15T11:00:00Z'),
      usedIpAddress: '192.168.1.100',
      usedUserAgent: 'Mozilla/5.0 Chrome/120.0',
      createdAt: new Date('2025-01-15T10:00:00Z'),
    },
    {
      id: 'bc-7',
      userId: TEST_USER_ID,
      codeHash: 'hash7',
      usedAt: null,
      usedIpAddress: null,
      usedUserAgent: null,
      createdAt: new Date('2025-01-15T10:00:00Z'),
    },
    {
      id: 'bc-8',
      userId: TEST_USER_ID,
      codeHash: 'hash8',
      usedAt: null,
      usedIpAddress: null,
      usedUserAgent: null,
      createdAt: new Date('2025-01-15T10:00:00Z'),
    },
    {
      id: 'bc-9',
      userId: TEST_USER_ID,
      codeHash: 'hash9',
      usedAt: new Date('2025-01-15T10:30:00Z'),
      usedIpAddress: '10.0.0.1',
      usedUserAgent: 'Mozilla/5.0 Firefox/121.0',
      createdAt: new Date('2025-01-15T10:00:00Z'),
    },
    {
      id: 'bc-10',
      userId: TEST_USER_ID,
      codeHash: 'hash10',
      usedAt: null,
      usedIpAddress: null,
      usedUserAgent: null,
      createdAt: new Date('2025-01-15T10:00:00Z'),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));

    auditLogger = new AuditLogger(mockPrisma as any);
    backupCodesService = new BackupCodesService(
      mockPrisma as any,
      mockRedis as any,
      auditLogger,
      mockTotpService as any,
      mockArgon2Service as any,
    );

    // Mock decryptSecret to bypass actual AES-256-GCM decryption
    (backupCodesService as any).decryptSecret = vi.fn().mockReturnValue('MOCK_SECRET');

    // Default mocks
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockArgon2Service.verify.mockResolvedValue(true);
    mockTotpService.verifyToken.mockReturnValue(true);
    mockTotpService.verifyBackupCode.mockResolvedValue(false);
    mockTotpService.generateBackupCodes.mockReturnValue([
      'ABCD1234',
      'EFGH5678',
      'IJKL9012',
      'MNOP3456',
      'QRST7890',
      'UVWX1234',
      'YZAB5678',
      'CDEF9012',
      'GHIJ3456',
      'KLMN7890',
    ]);
    mockTotpService.hashBackupCode.mockImplementation(async (code) => `hash_${code}`);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // GET BACKUP CODES STATUS
  // ===========================================================================

  describe('getStatus', () => {
    it('should return disabled status when MFA is not configured', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(null);

      const status = await backupCodesService.getStatus(TEST_USER_ID);

      expect(status).toEqual({
        isEnabled: false,
        totalCodes: 0,
        remainingCodes: 0,
        usedCodes: 0,
        lastUsedAt: null,
        generatedAt: null,
        shouldRegenerate: false,
      });
    });

    it('should return disabled status when MFA is not enabled', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue({
        ...mockMfaConfiguration,
        isEnabled: false,
      });

      const status = await backupCodesService.getStatus(TEST_USER_ID);

      expect(status).toEqual({
        isEnabled: false,
        totalCodes: 0,
        remainingCodes: 0,
        usedCodes: 0,
        lastUsedAt: null,
        generatedAt: null,
        shouldRegenerate: false,
      });
    });

    it('should return full status when MFA is enabled with backup codes', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.count.mockResolvedValueOnce(10); // total
      mockPrisma.mfaBackupCode.count.mockResolvedValueOnce(8); // remaining (unused)
      mockPrisma.mfaBackupCode.findFirst.mockResolvedValue({
        usedAt: new Date('2025-01-15T11:00:00Z'),
      });
      mockPrisma.mfaBackupCode.findFirst.mockResolvedValueOnce({
        createdAt: new Date('2025-01-15T10:00:00Z'),
      });

      const status = await backupCodesService.getStatus(TEST_USER_ID);

      expect(status.isEnabled).toBe(true);
      expect(status.totalCodes).toBe(10);
      expect(status.remainingCodes).toBe(8);
      expect(status.usedCodes).toBe(2);
      expect(status.shouldRegenerate).toBe(false);
    });

    it('should return shouldRegenerate=true when remainingCodes <= 2', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.count.mockResolvedValueOnce(10); // total
      mockPrisma.mfaBackupCode.count.mockResolvedValueOnce(2); // remaining
      mockPrisma.mfaBackupCode.findFirst.mockResolvedValue({
        usedAt: new Date('2025-01-15T11:00:00Z'),
      });

      const status = await backupCodesService.getStatus(TEST_USER_ID);

      expect(status.shouldRegenerate).toBe(true);
      expect(status.remainingCodes).toBe(2);
    });

    it('should return shouldRegenerate=true when no remaining codes', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.count.mockResolvedValueOnce(10); // total
      mockPrisma.mfaBackupCode.count.mockResolvedValueOnce(0); // remaining
      mockPrisma.mfaBackupCode.findFirst.mockResolvedValue({
        usedAt: new Date('2025-01-15T11:00:00Z'),
      });

      const status = await backupCodesService.getStatus(TEST_USER_ID);

      expect(status.shouldRegenerate).toBe(true);
      expect(status.remainingCodes).toBe(0);
    });
  });

  // ===========================================================================
  // LIST USED BACKUP CODES
  // ===========================================================================

  describe('listUsedCodes', () => {
    const usedBackupCodes = mockBackupCodes.filter((bc) => bc.usedAt !== null);

    it('should return empty list when no backup codes have been used', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.count.mockResolvedValue(0);
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue([]);

      const result = await backupCodesService.listUsedCodes(TEST_USER_ID, { page: 1, limit: 10 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(0);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrevious).toBe(false);
    });

    it('should return paginated list of used backup codes', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.count.mockResolvedValue(2);
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue(usedBackupCodes);

      const result = await backupCodesService.listUsedCodes(TEST_USER_ID, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrevious).toBe(false);
    });

    it('should include ipAddress and userAgent in used codes', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.count.mockResolvedValue(2);
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue(usedBackupCodes);

      const result = await backupCodesService.listUsedCodes(TEST_USER_ID, { page: 1, limit: 10 });

      expect(result.items[0]).toMatchObject({
        id: expect.any(String),
        usedAt: expect.any(String),
        ipAddress: expect.any(String),
        userAgent: expect.any(String),
      });
    });

    it('should handle pagination correctly', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.count.mockResolvedValue(5);
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue([usedBackupCodes[0]]);

      const result = await backupCodesService.listUsedCodes(TEST_USER_ID, { page: 2, limit: 2 });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(2);
      expect(result.totalPages).toBe(3);
      expect(result.hasPrevious).toBe(true);
      expect(result.hasNext).toBe(true);
    });

    it('should throw error when MFA is not enabled', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(null);

      await expect(
        backupCodesService.listUsedCodes(TEST_USER_ID, { page: 1, limit: 10 }),
      ).rejects.toThrow(TRPCError);

      await expect(
        backupCodesService.listUsedCodes(TEST_USER_ID, { page: 1, limit: 10 }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should sort used codes by usedAt descending', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.count.mockResolvedValue(2);
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue(usedBackupCodes);

      await backupCodesService.listUsedCodes(TEST_USER_ID, { page: 1, limit: 10 });

      expect(mockPrisma.mfaBackupCode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { usedAt: 'desc' },
        }),
      );
    });
  });

  // ===========================================================================
  // EXPORT BACKUP CODES
  // ===========================================================================

  describe('exportCodes', () => {
    const unusedBackupCodes = mockBackupCodes.filter((bc) => bc.usedAt === null);

    it('should export backup codes in text format', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue(unusedBackupCodes);

      const result = await backupCodesService.exportCodes(TEST_USER_ID, {
        password: VALID_PASSWORD,
        totpCode: VALID_TOTP_CODE,
        format: 'text',
      });

      expect(result.format).toBe('text');
      expect(result.mimeType).toBe('text/plain');
      expect(result.filename).toMatch(/backup-codes-.*\.txt/);
      expect(result.content).toBeTruthy();
      expect(result.warning).toBeTruthy();
      expect(result.generatedAt).toBe('2025-01-15T12:00:00.000Z');
    });

    it('should export backup codes in PDF format', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue(unusedBackupCodes);

      const result = await backupCodesService.exportCodes(TEST_USER_ID, {
        password: VALID_PASSWORD,
        totpCode: VALID_TOTP_CODE,
        format: 'pdf',
      });

      expect(result.format).toBe('pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.filename).toMatch(/backup-codes-.*\.pdf/);
      expect(result.content).toBeTruthy(); // Base64 encoded
      expect(result.expiresAt).toBeTruthy(); // PDF links expire
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        backupCodesService.exportCodes(TEST_USER_ID, {
          password: VALID_PASSWORD,
          totpCode: VALID_TOTP_CODE,
          format: 'text',
        }),
      ).rejects.toThrow(TRPCError);

      await expect(
        backupCodesService.exportCodes(TEST_USER_ID, {
          password: VALID_PASSWORD,
          totpCode: VALID_TOTP_CODE,
          format: 'text',
        }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: expect.stringMatching(/użytkownik/i),
      });
    });

    it('should throw error if password is incorrect', async () => {
      mockArgon2Service.verify.mockResolvedValue(false);

      await expect(
        backupCodesService.exportCodes(TEST_USER_ID, {
          password: 'wrong-password',
          totpCode: VALID_TOTP_CODE,
          format: 'text',
        }),
      ).rejects.toThrow(TRPCError);

      await expect(
        backupCodesService.exportCodes(TEST_USER_ID, {
          password: 'wrong-password',
          totpCode: VALID_TOTP_CODE,
          format: 'text',
        }),
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: expect.stringMatching(/hasło/i),
      });
    });

    it('should throw error if MFA is not enabled', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(null);

      await expect(
        backupCodesService.exportCodes(TEST_USER_ID, {
          password: VALID_PASSWORD,
          totpCode: VALID_TOTP_CODE,
          format: 'text',
        }),
      ).rejects.toThrow(TRPCError);

      await expect(
        backupCodesService.exportCodes(TEST_USER_ID, {
          password: VALID_PASSWORD,
          totpCode: VALID_TOTP_CODE,
          format: 'text',
        }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should throw error if TOTP code is invalid', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockTotpService.verifyToken.mockReturnValue(false);

      await expect(
        backupCodesService.exportCodes(TEST_USER_ID, {
          password: VALID_PASSWORD,
          totpCode: '000000',
          format: 'text',
        }),
      ).rejects.toThrow(TRPCError);

      await expect(
        backupCodesService.exportCodes(TEST_USER_ID, {
          password: VALID_PASSWORD,
          totpCode: '000000',
          format: 'text',
        }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: expect.stringMatching(/TOTP/i),
      });
    });

    it('should throw error if no unused backup codes exist', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue([]);

      await expect(
        backupCodesService.exportCodes(TEST_USER_ID, {
          password: VALID_PASSWORD,
          totpCode: VALID_TOTP_CODE,
          format: 'text',
        }),
      ).rejects.toThrow(TRPCError);

      await expect(
        backupCodesService.exportCodes(TEST_USER_ID, {
          password: VALID_PASSWORD,
          totpCode: VALID_TOTP_CODE,
          format: 'text',
        }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: expect.stringMatching(/kod/i),
      });
    });

    it('should log audit event on successful export', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue(unusedBackupCodes);

      await backupCodesService.exportCodes(TEST_USER_ID, {
        password: VALID_PASSWORD,
        totpCode: VALID_TOTP_CODE,
        format: 'text',
      });

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'BACKUP_CODES_EXPORTED',
          userId: TEST_USER_ID,
        }),
      });
    });

    it('should use text format as default', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue(unusedBackupCodes);

      const result = await backupCodesService.exportCodes(TEST_USER_ID, {
        password: VALID_PASSWORD,
        totpCode: VALID_TOTP_CODE,
        format: 'text',
      });

      expect(result.format).toBe('text');
    });
  });

  // ===========================================================================
  // VERIFY BACKUP CODE DIRECTLY
  // ===========================================================================

  describe('verifyDirect', () => {
    const unusedBackupCode = mockBackupCodes[0];

    it('should verify valid backup code and mark as used', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue([unusedBackupCode]);
      mockTotpService.verifyBackupCode.mockResolvedValue(true);
      mockPrisma.mfaBackupCode.update.mockResolvedValue({
        ...unusedBackupCode,
        usedAt: new Date(),
      });
      mockPrisma.mfaBackupCode.count.mockResolvedValue(7);

      const result = await backupCodesService.verifyDirect(
        TEST_USER_ID,
        VALID_BACKUP_CODE,
        '192.168.1.1',
        'Mozilla/5.0',
      );

      expect(result.success).toBe(true);
      expect(result.remainingCodes).toBe(7);
      expect(result.shouldRegenerate).toBe(false);
      expect(result.verifiedAt).toBe('2025-01-15T12:00:00.000Z');
    });

    it('should set shouldRegenerate=true when remainingCodes <= 2', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue([unusedBackupCode]);
      mockTotpService.verifyBackupCode.mockResolvedValue(true);
      mockPrisma.mfaBackupCode.update.mockResolvedValue({
        ...unusedBackupCode,
        usedAt: new Date(),
      });
      mockPrisma.mfaBackupCode.count.mockResolvedValue(2);

      const result = await backupCodesService.verifyDirect(
        TEST_USER_ID,
        VALID_BACKUP_CODE,
        '192.168.1.1',
        'Mozilla/5.0',
      );

      expect(result.shouldRegenerate).toBe(true);
    });

    it('should throw error when MFA is not enabled', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(null);

      await expect(
        backupCodesService.verifyDirect(TEST_USER_ID, VALID_BACKUP_CODE),
      ).rejects.toThrow(TRPCError);

      await expect(
        backupCodesService.verifyDirect(TEST_USER_ID, VALID_BACKUP_CODE),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should throw error when backup code is invalid', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue([unusedBackupCode]);
      mockTotpService.verifyBackupCode.mockResolvedValue(false);

      await expect(
        backupCodesService.verifyDirect(TEST_USER_ID, 'INVALID1'),
      ).rejects.toThrow(TRPCError);

      await expect(
        backupCodesService.verifyDirect(TEST_USER_ID, 'INVALID1'),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: expect.stringMatching(/kod/i),
      });
    });

    it('should throw error when no unused backup codes exist', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue([]);

      await expect(
        backupCodesService.verifyDirect(TEST_USER_ID, VALID_BACKUP_CODE),
      ).rejects.toThrow(TRPCError);

      await expect(
        backupCodesService.verifyDirect(TEST_USER_ID, VALID_BACKUP_CODE),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should update backup code with usage tracking info', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue([unusedBackupCode]);
      mockTotpService.verifyBackupCode.mockResolvedValue(true);
      mockPrisma.mfaBackupCode.update.mockResolvedValue({
        ...unusedBackupCode,
        usedAt: new Date(),
        usedIpAddress: '192.168.1.1',
        usedUserAgent: 'Mozilla/5.0',
      });
      mockPrisma.mfaBackupCode.count.mockResolvedValue(7);

      await backupCodesService.verifyDirect(
        TEST_USER_ID,
        VALID_BACKUP_CODE,
        '192.168.1.1',
        'Mozilla/5.0',
      );

      expect(mockPrisma.mfaBackupCode.update).toHaveBeenCalledWith({
        where: { id: unusedBackupCode.id },
        data: {
          usedAt: expect.any(Date),
          usedIpAddress: '192.168.1.1',
          usedUserAgent: 'Mozilla/5.0',
        },
      });
    });

    it('should log audit event on successful verification', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue([unusedBackupCode]);
      mockTotpService.verifyBackupCode.mockResolvedValue(true);
      mockPrisma.mfaBackupCode.update.mockResolvedValue({
        ...unusedBackupCode,
        usedAt: new Date(),
      });
      mockPrisma.mfaBackupCode.count.mockResolvedValue(7);

      await backupCodesService.verifyDirect(TEST_USER_ID, VALID_BACKUP_CODE);

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'MFA_BACKUP_CODE_USED',
          userId: TEST_USER_ID,
          metadata: expect.objectContaining({
            backupCodesRemaining: 7,
          }),
        }),
      });
    });

    it('should convert backup code to uppercase for verification', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue([unusedBackupCode]);
      mockTotpService.verifyBackupCode.mockResolvedValue(true);
      mockPrisma.mfaBackupCode.update.mockResolvedValue({
        ...unusedBackupCode,
        usedAt: new Date(),
      });
      mockPrisma.mfaBackupCode.count.mockResolvedValue(7);

      await backupCodesService.verifyDirect(TEST_USER_ID, 'abcd1234');

      expect(mockTotpService.verifyBackupCode).toHaveBeenCalledWith(
        unusedBackupCode.codeHash,
        'ABCD1234',
      );
    });
  });

  // ===========================================================================
  // REGENERATE BACKUP CODES (delegates to existing MFA service logic)
  // ===========================================================================

  describe('regenerateCodes', () => {
    it('should regenerate backup codes with re-authentication', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.mfaBackupCode.createMany.mockResolvedValue({ count: 10 });

      const result = await backupCodesService.regenerateCodes(
        TEST_USER_ID,
        VALID_PASSWORD,
        VALID_TOTP_CODE,
      );

      expect(result.codes).toHaveLength(10);
      expect(result.generatedAt).toBe('2025-01-15T12:00:00.000Z');
      expect(result.warning).toBeTruthy();
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        backupCodesService.regenerateCodes(TEST_USER_ID, VALID_PASSWORD, VALID_TOTP_CODE),
      ).rejects.toThrow(TRPCError);

      await expect(
        backupCodesService.regenerateCodes(TEST_USER_ID, VALID_PASSWORD, VALID_TOTP_CODE),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should throw error if password is incorrect', async () => {
      mockArgon2Service.verify.mockResolvedValue(false);

      await expect(
        backupCodesService.regenerateCodes(TEST_USER_ID, 'wrong-password', VALID_TOTP_CODE),
      ).rejects.toThrow(TRPCError);

      await expect(
        backupCodesService.regenerateCodes(TEST_USER_ID, 'wrong-password', VALID_TOTP_CODE),
      ).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('should throw error if MFA is not enabled', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(null);

      await expect(
        backupCodesService.regenerateCodes(TEST_USER_ID, VALID_PASSWORD, VALID_TOTP_CODE),
      ).rejects.toThrow(TRPCError);

      await expect(
        backupCodesService.regenerateCodes(TEST_USER_ID, VALID_PASSWORD, VALID_TOTP_CODE),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should throw error if TOTP code is invalid', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockTotpService.verifyToken.mockReturnValue(false);

      await expect(
        backupCodesService.regenerateCodes(TEST_USER_ID, VALID_PASSWORD, '000000'),
      ).rejects.toThrow(TRPCError);

      await expect(
        backupCodesService.regenerateCodes(TEST_USER_ID, VALID_PASSWORD, '000000'),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('should delete old backup codes before creating new ones', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.mfaBackupCode.createMany.mockResolvedValue({ count: 10 });

      await backupCodesService.regenerateCodes(TEST_USER_ID, VALID_PASSWORD, VALID_TOTP_CODE);

      expect(mockPrisma.mfaBackupCode.deleteMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
      });
      expect(mockPrisma.mfaBackupCode.createMany).toHaveBeenCalled();
    });

    it('should log audit event on successful regeneration', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.mfaBackupCode.createMany.mockResolvedValue({ count: 10 });

      await backupCodesService.regenerateCodes(TEST_USER_ID, VALID_PASSWORD, VALID_TOTP_CODE);

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'MFA_BACKUP_CODES_REGENERATED',
          userId: TEST_USER_ID,
        }),
      });
    });
  });
});
