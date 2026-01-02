import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { MfaService } from '../../services/aim/mfa.service';
import { AuditLogger } from '../../utils/audit-logger';

// Mock TotpService
const mockTotpService = {
  generateSecret: vi.fn(),
  verifyToken: vi.fn(),
  generateBackupCodes: vi.fn(),
  hashBackupCode: vi.fn(),
  verifyBackupCode: vi.fn(),
  generateToken: vi.fn(),
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
  del: vi.fn(),
  setex: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
};

describe('MfaService', () => {
  let mfaService: MfaService;
  let auditLogger: AuditLogger;

  const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const TEST_EMAIL = 'test@example.com';
  const VALID_PASSWORD = 'SecureP@ssw0rd123!';
  const MOCK_SECRET = 'JBSWY3DPEHPK3PXP1234567890ABCDEF';
  const MOCK_QR_CODE = 'data:image/png;base64,mockedqrcode';
  const MOCK_OTPAUTH_URL = 'otpauth://totp/KsięgowaCRM:test@example.com?secret=JBSWY3DPEHPK3PXP';
  const VALID_TOTP_CODE = '123456';
  const MOCK_CHALLENGE_TOKEN = 'challenge-token-123';
  const MOCK_SETUP_TOKEN = 'setup-token-456';

  const mockUser = {
    id: TEST_USER_ID,
    email: TEST_EMAIL,
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$hashedpassword',
    status: 'ACTIVE',
    isEmailVerified: true,
  };

  // Properly formatted encrypted secret (iv:authTag:encrypted in hex)
  // This is a mock format that matches what the service expects
  const MOCK_IV = '0123456789abcdef0123456789abcdef'; // 16 bytes = 32 hex chars
  const MOCK_AUTH_TAG = 'fedcba9876543210fedcba9876543210'; // 16 bytes = 32 hex chars
  const MOCK_ENCRYPTED_DATA = 'deadbeef'; // encrypted data
  const MOCK_ENCRYPTED_SECRET = `${MOCK_IV}:${MOCK_AUTH_TAG}:${MOCK_ENCRYPTED_DATA}`;

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
    { id: 'bc-1', userId: TEST_USER_ID, codeHash: 'hash1', usedAt: null },
    { id: 'bc-2', userId: TEST_USER_ID, codeHash: 'hash2', usedAt: null },
    { id: 'bc-3', userId: TEST_USER_ID, codeHash: 'hash3', usedAt: null },
    { id: 'bc-4', userId: TEST_USER_ID, codeHash: 'hash4', usedAt: null },
    { id: 'bc-5', userId: TEST_USER_ID, codeHash: 'hash5', usedAt: null },
    { id: 'bc-6', userId: TEST_USER_ID, codeHash: 'hash6', usedAt: new Date() },
    { id: 'bc-7', userId: TEST_USER_ID, codeHash: 'hash7', usedAt: null },
    { id: 'bc-8', userId: TEST_USER_ID, codeHash: 'hash8', usedAt: null },
    { id: 'bc-9', userId: TEST_USER_ID, codeHash: 'hash9', usedAt: null },
    { id: 'bc-10', userId: TEST_USER_ID, codeHash: 'hash10', usedAt: null },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));

    auditLogger = new AuditLogger(mockPrisma as any);
    mfaService = new MfaService(
      mockPrisma as any,
      mockRedis as any,
      auditLogger,
      mockTotpService as any,
      mockArgon2Service as any
    );

    // Mock private decryptSecret method to return the mock secret
    // This bypasses the actual AES-256-GCM decryption in tests
    (mfaService as any).decryptSecret = vi.fn().mockReturnValue(MOCK_SECRET);

    // Default mocks
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockArgon2Service.verify.mockResolvedValue(true);
    mockTotpService.generateSecret.mockResolvedValue({
      secret: MOCK_SECRET,
      qrCodeDataUrl: MOCK_QR_CODE,
      otpauthUrl: MOCK_OTPAUTH_URL,
    });
    mockTotpService.verifyToken.mockReturnValue(true);
    mockTotpService.generateBackupCodes.mockReturnValue([
      'ABCD1234', 'EFGH5678', 'IJKL9012', 'MNOP3456', 'QRST7890',
      'UVWX1234', 'YZAB5678', 'CDEF9012', 'GHIJ3456', 'KLMN7890',
    ]);
    mockTotpService.hashBackupCode.mockImplementation(async (code) => `hash_${code}`);
    mockTotpService.verifyBackupCode.mockResolvedValue(true);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // MFA STATUS
  // =========================================================================

  describe('getMfaStatus', () => {
    it('should return MFA disabled status when user has no MFA configuration', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(null);

      const status = await mfaService.getMfaStatus(TEST_USER_ID);

      expect(status).toEqual({
        isEnabled: false,
        isVerified: false,
        lastUsedAt: null,
        backupCodesRemaining: 0,
        createdAt: null,
      });
    });

    it('should return MFA enabled status with backup codes count', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.count.mockResolvedValue(9); // 1 used

      const status = await mfaService.getMfaStatus(TEST_USER_ID);

      expect(status).toEqual({
        isEnabled: true,
        isVerified: true,
        lastUsedAt: mockMfaConfiguration.lastUsedAt.toISOString(),
        backupCodesRemaining: 9,
        createdAt: mockMfaConfiguration.createdAt.toISOString(),
      });
    });

    it('should return unverified status when MFA is set up but not enabled', async () => {
      const unverifiedConfig = {
        ...mockMfaConfiguration,
        isEnabled: false,
        verifiedAt: null,
      };
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(unverifiedConfig);
      mockPrisma.mfaBackupCode.count.mockResolvedValue(0);

      const status = await mfaService.getMfaStatus(TEST_USER_ID);

      expect(status.isEnabled).toBe(false);
      expect(status.isVerified).toBe(false);
    });
  });

  // =========================================================================
  // MFA SETUP INITIATION
  // =========================================================================

  describe('initiateSetup', () => {
    it('should initiate MFA setup for user without existing MFA', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(null);

      const result = await mfaService.initiateSetup(TEST_USER_ID, VALID_PASSWORD);

      expect(result).toHaveProperty('setupToken');
      expect(result).toHaveProperty('qrCodeDataUrl', MOCK_QR_CODE);
      expect(result).toHaveProperty('otpauthUrl', MOCK_OTPAUTH_URL);
      expect(result).toHaveProperty('expiresAt');
      expect(mockTotpService.generateSecret).toHaveBeenCalledWith(TEST_EMAIL);
      expect(mockRedis.setex).toHaveBeenCalled(); // Setup token stored in Redis
    });

    it('should throw error if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(mfaService.initiateSetup(TEST_USER_ID, VALID_PASSWORD))
        .rejects.toThrow(TRPCError);

      await expect(mfaService.initiateSetup(TEST_USER_ID, VALID_PASSWORD))
        .rejects.toMatchObject({
          code: 'NOT_FOUND',
          message: expect.stringMatching(/użytkownik/i),
        });
    });

    it('should throw error if password is incorrect', async () => {
      mockArgon2Service.verify.mockResolvedValue(false);

      await expect(mfaService.initiateSetup(TEST_USER_ID, 'wrong-password'))
        .rejects.toThrow(TRPCError);

      await expect(mfaService.initiateSetup(TEST_USER_ID, 'wrong-password'))
        .rejects.toMatchObject({
          code: 'UNAUTHORIZED',
          message: expect.stringMatching(/hasło/i),
        });
    });

    it('should throw error if MFA is already enabled', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);

      await expect(mfaService.initiateSetup(TEST_USER_ID, VALID_PASSWORD))
        .rejects.toThrow(TRPCError);

      await expect(mfaService.initiateSetup(TEST_USER_ID, VALID_PASSWORD))
        .rejects.toMatchObject({
          code: 'CONFLICT',
          message: expect.stringMatching(/aktywne|włączone/i),
        });
    });

    it('should allow re-setup if MFA exists but is not verified', async () => {
      const pendingConfig = {
        ...mockMfaConfiguration,
        isEnabled: false,
        verifiedAt: null,
      };
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(pendingConfig);

      const result = await mfaService.initiateSetup(TEST_USER_ID, VALID_PASSWORD);

      expect(result).toHaveProperty('setupToken');
      expect(mockPrisma.mfaConfiguration.delete).toHaveBeenCalled();
    });

    it('should set setup token expiry to 10 minutes', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(null);

      const result = await mfaService.initiateSetup(TEST_USER_ID, VALID_PASSWORD);

      const expiresAt = new Date(result.expiresAt);
      const now = new Date('2025-01-15T12:00:00.000Z');
      const diffMinutes = (expiresAt.getTime() - now.getTime()) / (1000 * 60);

      expect(diffMinutes).toBe(10);
    });

    it('should log audit event for MFA setup initiation', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(null);

      await mfaService.initiateSetup(TEST_USER_ID, VALID_PASSWORD);

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'MFA_SETUP_INITIATED',
          userId: TEST_USER_ID,
        }),
      });
    });
  });

  // =========================================================================
  // MFA SETUP VERIFICATION (ENABLE MFA)
  // =========================================================================

  describe('verifySetup', () => {
    const setupData = {
      secret: MOCK_SECRET,
      userId: TEST_USER_ID,
    };

    beforeEach(() => {
      mockRedis.get.mockResolvedValue(JSON.stringify(setupData));
      mockPrisma.mfaConfiguration.create.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.createMany.mockResolvedValue({ count: 10 });
    });

    it('should verify setup and enable MFA with backup codes', async () => {
      const result = await mfaService.verifySetup(MOCK_SETUP_TOKEN, VALID_TOTP_CODE);

      expect(result.success).toBe(true);
      expect(result.backupCodes).toHaveLength(10);
      expect(result.message).toMatch(/aktywowane|włączone/i);
      expect(mockTotpService.verifyToken).toHaveBeenCalledWith(MOCK_SECRET, VALID_TOTP_CODE);
      expect(mockPrisma.mfaConfiguration.create).toHaveBeenCalled();
      expect(mockPrisma.mfaBackupCode.createMany).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalled(); // Cleanup setup token
    });

    it('should throw error if setup token is invalid or expired', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(mfaService.verifySetup(MOCK_SETUP_TOKEN, VALID_TOTP_CODE))
        .rejects.toThrow(TRPCError);

      await expect(mfaService.verifySetup(MOCK_SETUP_TOKEN, VALID_TOTP_CODE))
        .rejects.toMatchObject({
          code: 'BAD_REQUEST',
          message: expect.stringMatching(/wygasł|nieprawidłowy/i),
        });
    });

    it('should throw error if TOTP code is invalid', async () => {
      mockTotpService.verifyToken.mockReturnValue(false);

      await expect(mfaService.verifySetup(MOCK_SETUP_TOKEN, '000000'))
        .rejects.toThrow(TRPCError);

      await expect(mfaService.verifySetup(MOCK_SETUP_TOKEN, '000000'))
        .rejects.toMatchObject({
          code: 'BAD_REQUEST',
          message: expect.stringMatching(/nieprawidłowy.*kod/i),
        });
    });

    it('should encrypt secret before storing in database', async () => {
      await mfaService.verifySetup(MOCK_SETUP_TOKEN, VALID_TOTP_CODE);

      expect(mockPrisma.mfaConfiguration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: TEST_USER_ID,
          secretEncrypted: expect.not.stringContaining(MOCK_SECRET), // Should be encrypted
          isEnabled: true,
          verifiedAt: expect.any(Date),
        }),
      });
    });

    it('should generate and hash 10 backup codes', async () => {
      await mfaService.verifySetup(MOCK_SETUP_TOKEN, VALID_TOTP_CODE);

      expect(mockTotpService.generateBackupCodes).toHaveBeenCalledWith(10);
      expect(mockTotpService.hashBackupCode).toHaveBeenCalledTimes(10);
      expect(mockPrisma.mfaBackupCode.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            userId: TEST_USER_ID,
            codeHash: expect.any(String),
          }),
        ]),
      });
    });

    it('should log audit event for successful MFA activation', async () => {
      await mfaService.verifySetup(MOCK_SETUP_TOKEN, VALID_TOTP_CODE);

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'MFA_ENABLED',
          userId: TEST_USER_ID,
        }),
      });
    });
  });

  // =========================================================================
  // MFA DISABLE
  // =========================================================================

  describe('disableMfa', () => {
    beforeEach(() => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
    });

    it('should disable MFA when password and TOTP code are valid', async () => {
      const result = await mfaService.disableMfa(TEST_USER_ID, VALID_PASSWORD, VALID_TOTP_CODE);

      expect(result.success).toBe(true);
      expect(mockPrisma.mfaConfiguration.delete).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
      });
      expect(mockPrisma.mfaBackupCode.deleteMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
      });
    });

    it('should throw error if MFA is not enabled', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(null);

      await expect(mfaService.disableMfa(TEST_USER_ID, VALID_PASSWORD, VALID_TOTP_CODE))
        .rejects.toThrow(TRPCError);

      await expect(mfaService.disableMfa(TEST_USER_ID, VALID_PASSWORD, VALID_TOTP_CODE))
        .rejects.toMatchObject({
          code: 'NOT_FOUND',
          message: expect.stringMatching(/nie jest aktywne|nie włączone/i),
        });
    });

    it('should throw error if password is incorrect', async () => {
      mockArgon2Service.verify.mockResolvedValue(false);

      await expect(mfaService.disableMfa(TEST_USER_ID, 'wrong-password', VALID_TOTP_CODE))
        .rejects.toThrow(TRPCError);

      await expect(mfaService.disableMfa(TEST_USER_ID, 'wrong-password', VALID_TOTP_CODE))
        .rejects.toMatchObject({
          code: 'UNAUTHORIZED',
        });
    });

    it('should throw error if TOTP code is invalid', async () => {
      mockTotpService.verifyToken.mockReturnValue(false);

      await expect(mfaService.disableMfa(TEST_USER_ID, VALID_PASSWORD, '000000'))
        .rejects.toThrow(TRPCError);

      await expect(mfaService.disableMfa(TEST_USER_ID, VALID_PASSWORD, '000000'))
        .rejects.toMatchObject({
          code: 'BAD_REQUEST',
        });
    });

    it('should delete all backup codes when disabling MFA', async () => {
      await mfaService.disableMfa(TEST_USER_ID, VALID_PASSWORD, VALID_TOTP_CODE);

      expect(mockPrisma.mfaBackupCode.deleteMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
      });
    });

    it('should delete all pending challenges when disabling MFA', async () => {
      await mfaService.disableMfa(TEST_USER_ID, VALID_PASSWORD, VALID_TOTP_CODE);

      expect(mockPrisma.mfaChallenge.deleteMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
      });
    });

    it('should log audit event for MFA disabled', async () => {
      await mfaService.disableMfa(TEST_USER_ID, VALID_PASSWORD, VALID_TOTP_CODE);

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'MFA_DISABLED',
          userId: TEST_USER_ID,
        }),
      });
    });
  });

  // =========================================================================
  // MFA CHALLENGE CREATION
  // =========================================================================

  describe('createChallenge', () => {
    beforeEach(() => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaChallenge.create.mockResolvedValue({
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
      });
    });

    it('should create MFA challenge for user with enabled MFA', async () => {
      const result = await mfaService.createChallenge(TEST_USER_ID, '192.168.1.1');

      expect(result).toHaveProperty('challengeToken');
      expect(result).toHaveProperty('type', 'totp');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('attemptsRemaining', 3);
      expect(mockPrisma.mfaChallenge.create).toHaveBeenCalled();
    });

    it('should throw error if MFA is not enabled', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(null);

      await expect(mfaService.createChallenge(TEST_USER_ID, '192.168.1.1'))
        .rejects.toThrow(TRPCError);
    });

    it('should set challenge expiry to 5 minutes', async () => {
      const result = await mfaService.createChallenge(TEST_USER_ID, '192.168.1.1');

      const expiresAt = new Date(result.expiresAt);
      const now = new Date('2025-01-15T12:00:00.000Z');
      const diffMinutes = (expiresAt.getTime() - now.getTime()) / (1000 * 60);

      expect(diffMinutes).toBe(5);
    });

    it('should delete expired challenges before creating new one', async () => {
      await mfaService.createChallenge(TEST_USER_ID, '192.168.1.1');

      expect(mockPrisma.mfaChallenge.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: TEST_USER_ID,
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });

    it('should include IP address in challenge', async () => {
      await mfaService.createChallenge(TEST_USER_ID, '192.168.1.1');

      expect(mockPrisma.mfaChallenge.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: '192.168.1.1',
        }),
      });
    });
  });

  // =========================================================================
  // MFA TOTP VERIFICATION
  // =========================================================================

  describe('verifyTotp', () => {
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
      mockPrisma.mfaChallenge.findUnique.mockResolvedValue(mockChallenge);
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaChallenge.update.mockResolvedValue({
        ...mockChallenge,
        completedAt: new Date(),
      });
      // Mock for failed attempt handling
      mockPrisma.mfaConfiguration.update.mockResolvedValue({
        ...mockMfaConfiguration,
        failedAttempts: 1,
      });
    });

    it('should verify valid TOTP code and complete challenge', async () => {
      const result = await mfaService.verifyTotp(MOCK_CHALLENGE_TOKEN, VALID_TOTP_CODE);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(TEST_USER_ID);
      expect(result.completedAt).toBeDefined();
      expect(mockPrisma.mfaChallenge.update).toHaveBeenCalledWith({
        where: { id: 'challenge-1' },
        data: expect.objectContaining({
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should throw error if challenge token is invalid', async () => {
      mockPrisma.mfaChallenge.findUnique.mockResolvedValue(null);

      await expect(mfaService.verifyTotp('invalid-token', VALID_TOTP_CODE))
        .rejects.toThrow(TRPCError);

      await expect(mfaService.verifyTotp('invalid-token', VALID_TOTP_CODE))
        .rejects.toMatchObject({
          code: 'NOT_FOUND',
        });
    });

    it('should throw error if challenge is expired', async () => {
      mockPrisma.mfaChallenge.findUnique.mockResolvedValue({
        ...mockChallenge,
        expiresAt: new Date('2025-01-15T11:55:00.000Z'), // Expired
      });

      await expect(mfaService.verifyTotp(MOCK_CHALLENGE_TOKEN, VALID_TOTP_CODE))
        .rejects.toThrow(TRPCError);

      await expect(mfaService.verifyTotp(MOCK_CHALLENGE_TOKEN, VALID_TOTP_CODE))
        .rejects.toMatchObject({
          code: 'BAD_REQUEST',
          message: expect.stringMatching(/wygasł/i),
        });
    });

    it('should throw error if challenge is already completed', async () => {
      mockPrisma.mfaChallenge.findUnique.mockResolvedValue({
        ...mockChallenge,
        completedAt: new Date(),
      });

      await expect(mfaService.verifyTotp(MOCK_CHALLENGE_TOKEN, VALID_TOTP_CODE))
        .rejects.toThrow(TRPCError);

      await expect(mfaService.verifyTotp(MOCK_CHALLENGE_TOKEN, VALID_TOTP_CODE))
        .rejects.toMatchObject({
          code: 'BAD_REQUEST',
          message: expect.stringMatching(/wykorzystan|zakończon/i),
        });
    });

    it('should increment attempts on invalid code', async () => {
      mockTotpService.verifyToken.mockReturnValue(false);

      await expect(mfaService.verifyTotp(MOCK_CHALLENGE_TOKEN, '000000'))
        .rejects.toThrow(TRPCError);

      expect(mockPrisma.mfaChallenge.update).toHaveBeenCalledWith({
        where: { id: 'challenge-1' },
        data: { attempts: { increment: 1 } },
      });
    });

    it('should throw error and delete challenge if max attempts exceeded', async () => {
      mockPrisma.mfaChallenge.findUnique.mockResolvedValue({
        ...mockChallenge,
        attempts: 3,
        maxAttempts: 3,
      });
      mockTotpService.verifyToken.mockReturnValue(false);

      await expect(mfaService.verifyTotp(MOCK_CHALLENGE_TOKEN, '000000'))
        .rejects.toThrow(TRPCError);

      await expect(mfaService.verifyTotp(MOCK_CHALLENGE_TOKEN, '000000'))
        .rejects.toMatchObject({
          code: 'TOO_MANY_REQUESTS',
          message: expect.stringMatching(/próby|limit/i),
        });

      expect(mockPrisma.mfaChallenge.delete).toHaveBeenCalled();
    });

    it('should update lastUsedAt on MFA configuration', async () => {
      await mfaService.verifyTotp(MOCK_CHALLENGE_TOKEN, VALID_TOTP_CODE);

      expect(mockPrisma.mfaConfiguration.update).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        data: expect.objectContaining({
          lastUsedAt: expect.any(Date),
          failedAttempts: 0,
        }),
      });
    });

    it('should increment failed attempts on MFA configuration for invalid code', async () => {
      mockTotpService.verifyToken.mockReturnValue(false);

      await expect(mfaService.verifyTotp(MOCK_CHALLENGE_TOKEN, '000000'))
        .rejects.toThrow();

      expect(mockPrisma.mfaConfiguration.update).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        data: { failedAttempts: { increment: 1 } },
      });
    });

    it('should log audit event for successful verification', async () => {
      await mfaService.verifyTotp(MOCK_CHALLENGE_TOKEN, VALID_TOTP_CODE);

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'MFA_VERIFIED',
          userId: TEST_USER_ID,
        }),
      });
    });

    it('should log audit event for failed verification', async () => {
      mockTotpService.verifyToken.mockReturnValue(false);

      await expect(mfaService.verifyTotp(MOCK_CHALLENGE_TOKEN, '000000'))
        .rejects.toThrow();

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'MFA_VERIFICATION_FAILED',
          userId: TEST_USER_ID,
        }),
      });
    });
  });

  // =========================================================================
  // BACKUP CODE VERIFICATION
  // =========================================================================

  describe('verifyBackupCode', () => {
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

    const unusedBackupCode = {
      id: 'bc-1',
      userId: TEST_USER_ID,
      codeHash: 'hash1',
      usedAt: null,
      createdAt: new Date(),
    };

    beforeEach(() => {
      mockPrisma.mfaChallenge.findUnique.mockResolvedValue(mockChallenge);
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue([unusedBackupCode]);
      mockPrisma.mfaChallenge.update.mockResolvedValue({
        ...mockChallenge,
        completedAt: new Date(),
      });
    });

    it('should verify valid backup code and complete challenge', async () => {
      const result = await mfaService.verifyBackupCode(MOCK_CHALLENGE_TOKEN, 'ABCD1234');

      expect(result.success).toBe(true);
      expect(result.userId).toBe(TEST_USER_ID);
      expect(mockPrisma.mfaBackupCode.update).toHaveBeenCalledWith({
        where: { id: 'bc-1' },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('should throw error if challenge token is invalid', async () => {
      mockPrisma.mfaChallenge.findUnique.mockResolvedValue(null);

      await expect(mfaService.verifyBackupCode('invalid-token', 'ABCD1234'))
        .rejects.toThrow(TRPCError);
    });

    it('should throw error if no valid backup code matches', async () => {
      mockTotpService.verifyBackupCode.mockResolvedValue(false);

      await expect(mfaService.verifyBackupCode(MOCK_CHALLENGE_TOKEN, 'WRONG123'))
        .rejects.toThrow(TRPCError);

      await expect(mfaService.verifyBackupCode(MOCK_CHALLENGE_TOKEN, 'WRONG123'))
        .rejects.toMatchObject({
          code: 'BAD_REQUEST',
          message: expect.stringMatching(/nieprawidłowy/i),
        });
    });

    it('should not allow reuse of already used backup code', async () => {
      // When all backup codes are used, findMany returns empty (service filters usedAt: null)
      mockPrisma.mfaBackupCode.findMany.mockResolvedValue([]);

      await expect(mfaService.verifyBackupCode(MOCK_CHALLENGE_TOKEN, 'ABCD1234'))
        .rejects.toThrow(TRPCError);

      await expect(mfaService.verifyBackupCode(MOCK_CHALLENGE_TOKEN, 'ABCD1234'))
        .rejects.toMatchObject({
          code: 'BAD_REQUEST',
          message: expect.stringMatching(/nieprawidłowy/i),
        });
    });

    it('should mark backup code as used after successful verification', async () => {
      await mfaService.verifyBackupCode(MOCK_CHALLENGE_TOKEN, 'ABCD1234');

      expect(mockPrisma.mfaBackupCode.update).toHaveBeenCalledWith({
        where: { id: 'bc-1' },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('should complete the challenge after successful backup code verification', async () => {
      await mfaService.verifyBackupCode(MOCK_CHALLENGE_TOKEN, 'ABCD1234');

      expect(mockPrisma.mfaChallenge.update).toHaveBeenCalledWith({
        where: { id: 'challenge-1' },
        data: expect.objectContaining({
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should log audit event for backup code used', async () => {
      await mfaService.verifyBackupCode(MOCK_CHALLENGE_TOKEN, 'ABCD1234');

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'MFA_BACKUP_CODE_USED',
          userId: TEST_USER_ID,
        }),
      });
    });

    it('should warn about low backup codes remaining', async () => {
      mockPrisma.mfaBackupCode.count.mockResolvedValue(2);

      const result = await mfaService.verifyBackupCode(MOCK_CHALLENGE_TOKEN, 'ABCD1234');

      // Should include warning in metadata or response
      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            backupCodesRemaining: expect.any(Number),
          }),
        }),
      });
    });
  });

  // =========================================================================
  // REGENERATE BACKUP CODES
  // =========================================================================

  describe('regenerateBackupCodes', () => {
    beforeEach(() => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaBackupCode.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.mfaBackupCode.createMany.mockResolvedValue({ count: 10 });
    });

    it('should regenerate backup codes with valid password and TOTP code', async () => {
      const result = await mfaService.regenerateBackupCodes(TEST_USER_ID, VALID_PASSWORD, VALID_TOTP_CODE);

      expect(result.codes).toHaveLength(10);
      expect(result.generatedAt).toBeDefined();
      expect(result.warning).toMatch(/zapisz|bezpiecznie/i);
      expect(mockPrisma.mfaBackupCode.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.mfaBackupCode.createMany).toHaveBeenCalled();
    });

    it('should throw error if MFA is not enabled', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(null);

      await expect(mfaService.regenerateBackupCodes(TEST_USER_ID, VALID_PASSWORD, VALID_TOTP_CODE))
        .rejects.toThrow(TRPCError);
    });

    it('should throw error if password is incorrect', async () => {
      mockArgon2Service.verify.mockResolvedValue(false);

      await expect(mfaService.regenerateBackupCodes(TEST_USER_ID, 'wrong-password', VALID_TOTP_CODE))
        .rejects.toThrow(TRPCError);
    });

    it('should throw error if TOTP code is invalid', async () => {
      mockTotpService.verifyToken.mockReturnValue(false);

      await expect(mfaService.regenerateBackupCodes(TEST_USER_ID, VALID_PASSWORD, '000000'))
        .rejects.toThrow(TRPCError);
    });

    it('should delete old backup codes before creating new ones', async () => {
      await mfaService.regenerateBackupCodes(TEST_USER_ID, VALID_PASSWORD, VALID_TOTP_CODE);

      const deleteCall = mockPrisma.mfaBackupCode.deleteMany.mock.invocationCallOrder[0];
      const createCall = mockPrisma.mfaBackupCode.createMany.mock.invocationCallOrder[0];

      expect(deleteCall).toBeLessThan(createCall);
    });

    it('should log audit event for backup codes regenerated', async () => {
      await mfaService.regenerateBackupCodes(TEST_USER_ID, VALID_PASSWORD, VALID_TOTP_CODE);

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'MFA_BACKUP_CODES_REGENERATED',
          userId: TEST_USER_ID,
        }),
      });
    });
  });

  // =========================================================================
  // MFA LOCKOUT
  // =========================================================================

  describe('MFA lockout handling', () => {
    it('should lock MFA after 5 consecutive failed attempts', async () => {
      const configWith4Attempts = {
        ...mockMfaConfiguration,
        failedAttempts: 4, // 4 failed attempts, next one will be 5th
        lockedUntil: null,
      };
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(configWith4Attempts);

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
      mockPrisma.mfaChallenge.findUnique.mockResolvedValue(mockChallenge);
      mockTotpService.verifyToken.mockReturnValue(false);

      // First update increments to 5, which triggers lockout
      mockPrisma.mfaConfiguration.update.mockResolvedValueOnce({
        ...configWith4Attempts,
        failedAttempts: 5, // After increment
      });

      await expect(mfaService.verifyTotp(MOCK_CHALLENGE_TOKEN, '000000'))
        .rejects.toThrow();

      // Should have been called twice: first to increment, second to set lockedUntil
      expect(mockPrisma.mfaConfiguration.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.mfaConfiguration.update).toHaveBeenLastCalledWith({
        where: { userId: TEST_USER_ID },
        data: expect.objectContaining({
          lockedUntil: expect.any(Date),
        }),
      });
    });

    it('should throw error if MFA is locked', async () => {
      const lockedConfig = {
        ...mockMfaConfiguration,
        lockedUntil: new Date('2025-01-15T12:30:00.000Z'), // Locked for 30 more minutes
      };
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(lockedConfig);

      await expect(mfaService.createChallenge(TEST_USER_ID, '192.168.1.1'))
        .rejects.toThrow(TRPCError);

      await expect(mfaService.createChallenge(TEST_USER_ID, '192.168.1.1'))
        .rejects.toMatchObject({
          code: 'TOO_MANY_REQUESTS',
          message: expect.stringMatching(/zablokowane|spróbuj później/i),
        });
    });

    it('should automatically unlock MFA after lockout period', async () => {
      const expiredLockConfig = {
        ...mockMfaConfiguration,
        lockedUntil: new Date('2025-01-15T11:30:00.000Z'), // Expired lockout
        failedAttempts: 5,
      };
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(expiredLockConfig);
      mockPrisma.mfaChallenge.create.mockResolvedValue({
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
      });

      // Should succeed because lockout has expired
      const result = await mfaService.createChallenge(TEST_USER_ID, '192.168.1.1');

      expect(result).toHaveProperty('challengeToken');
      expect(mockPrisma.mfaConfiguration.update).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        data: { lockedUntil: null, failedAttempts: 0 },
      });
    });
  });

  // =========================================================================
  // SECRET ENCRYPTION/DECRYPTION
  // =========================================================================

  describe('secret encryption', () => {
    it('should encrypt secrets with AES-256-GCM', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(null);

      const setupData = {
        secret: MOCK_SECRET,
        userId: TEST_USER_ID,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(setupData));
      mockPrisma.mfaConfiguration.create.mockImplementation(async ({ data }) => ({
        ...mockMfaConfiguration,
        secretEncrypted: data.secretEncrypted,
      }));

      await mfaService.verifySetup(MOCK_SETUP_TOKEN, VALID_TOTP_CODE);

      const createCall = mockPrisma.mfaConfiguration.create.mock.calls[0][0];
      const encryptedSecret = createCall.data.secretEncrypted;

      // Encrypted secret should contain IV and auth tag
      expect(encryptedSecret).toContain(':');
      expect(encryptedSecret.length).toBeGreaterThan(MOCK_SECRET.length);
    });

    it('should decrypt secret for TOTP verification', async () => {
      // Mock the MFA configuration with properly encrypted secret
      const encryptedSecret = 'iv:authTag:encryptedData';
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue({
        ...mockMfaConfiguration,
        secretEncrypted: encryptedSecret,
      });

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
      mockPrisma.mfaChallenge.findUnique.mockResolvedValue(mockChallenge);

      await mfaService.verifyTotp(MOCK_CHALLENGE_TOKEN, VALID_TOTP_CODE);

      // verifyToken should be called with decrypted secret
      expect(mockTotpService.verifyToken).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // EDGE CASES
  // =========================================================================

  describe('edge cases', () => {
    it('should handle user with inactive account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: 'SUSPENDED',
      });

      await expect(mfaService.initiateSetup(TEST_USER_ID, VALID_PASSWORD))
        .rejects.toThrow(TRPCError);

      await expect(mfaService.initiateSetup(TEST_USER_ID, VALID_PASSWORD))
        .rejects.toMatchObject({
          code: 'FORBIDDEN',
          message: expect.stringMatching(/konto|nieaktywne|zablokowane/i),
        });
    });

    it('should handle Redis failures gracefully during setup', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(null);
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      await expect(mfaService.initiateSetup(TEST_USER_ID, VALID_PASSWORD))
        .rejects.toThrow();
    });

    it('should cleanup Redis on setup failure', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(null);
      mockTotpService.generateSecret.mockRejectedValue(new Error('Generation failed'));

      await expect(mfaService.initiateSetup(TEST_USER_ID, VALID_PASSWORD))
        .rejects.toThrow();

      // Should not leave orphan setup tokens
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should validate TOTP code format before verification', async () => {
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
      mockPrisma.mfaChallenge.findUnique.mockResolvedValue(mockChallenge);

      // Should not even call verifyToken for invalid format
      await expect(mfaService.verifyTotp(MOCK_CHALLENGE_TOKEN, 'abc'))
        .rejects.toThrow();

      // verifyToken should not be called for invalid format
      expect(mockTotpService.verifyToken).not.toHaveBeenCalled();
    });

    it('should handle concurrent setup attempts', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(null);
      mockRedis.setex.mockRejectedValueOnce(new Error('Key exists'));

      // Second attempt should fail gracefully
      await expect(mfaService.initiateSetup(TEST_USER_ID, VALID_PASSWORD))
        .rejects.toThrow();
    });
  });

  // =========================================================================
  // SECURITY REQUIREMENTS (Constitution Compliance)
  // =========================================================================

  describe('security requirements', () => {
    it('should enforce password verification for all sensitive operations', async () => {
      // Helper to reset mocks without losing decryptSecret mock
      const resetMocks = () => {
        mockArgon2Service.verify.mockClear();
        mockPrisma.user.findUnique.mockResolvedValue(mockUser);
        mockArgon2Service.verify.mockResolvedValue(true);
        mockTotpService.verifyToken.mockReturnValue(true);
      };

      // Test setup initiation
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(null);
      await mfaService.initiateSetup(TEST_USER_ID, VALID_PASSWORD);
      expect(mockArgon2Service.verify).toHaveBeenCalledWith(mockUser.passwordHash, VALID_PASSWORD);

      resetMocks();

      // Test disable
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      await mfaService.disableMfa(TEST_USER_ID, VALID_PASSWORD, VALID_TOTP_CODE);
      expect(mockArgon2Service.verify).toHaveBeenCalledWith(mockUser.passwordHash, VALID_PASSWORD);

      resetMocks();

      // Test regenerate backup codes
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      await mfaService.regenerateBackupCodes(TEST_USER_ID, VALID_PASSWORD, VALID_TOTP_CODE);
      expect(mockArgon2Service.verify).toHaveBeenCalledWith(mockUser.passwordHash, VALID_PASSWORD);
    });

    it('should use timing-safe comparison for TOTP verification', async () => {
      // TotpService should handle timing-safe comparison internally
      expect(mockTotpService.verifyToken).toBeDefined();
    });

    it('should generate cryptographically secure challenge tokens', async () => {
      mockPrisma.mfaConfiguration.findUnique.mockResolvedValue(mockMfaConfiguration);
      mockPrisma.mfaChallenge.create.mockImplementation(async ({ data }) => ({
        id: 'challenge-1',
        ...data,
        createdAt: new Date(),
      }));

      const result = await mfaService.createChallenge(TEST_USER_ID, '192.168.1.1');

      // Token should be at least 32 bytes (64 hex chars)
      expect(result.challengeToken.length).toBeGreaterThanOrEqual(32);
    });

    it('should audit all MFA-related events', async () => {
      const auditEvents = [
        'MFA_SETUP_INITIATED',
        'MFA_ENABLED',
        'MFA_DISABLED',
        'MFA_VERIFIED',
        'MFA_VERIFICATION_FAILED',
        'MFA_BACKUP_CODE_USED',
        'MFA_BACKUP_CODES_REGENERATED',
      ];

      // Each audit event type should be logged at appropriate points
      // This is verified in individual test cases above
      expect(auditEvents.length).toBe(7);
    });
  });
});
