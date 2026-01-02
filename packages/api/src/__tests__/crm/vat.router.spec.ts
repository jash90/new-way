import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createContext } from '../../context';
import { appRouter } from '../../index';

// ==========================================================================
// MOCKS - Use vi.hoisted() to ensure mocks are available when vi.mock runs
// ==========================================================================

const mockVatServiceMethods = vi.hoisted(() => ({
  validateVat: vi.fn(),
  validateClientVat: vi.fn(),
  getVatStatus: vi.fn(),
  refreshVatStatus: vi.fn(),
  batchValidateVat: vi.fn(),
}));

// Mock VatService module
vi.mock('../../services/crm/vat.service', () => ({
  VatService: vi.fn(() => mockVatServiceMethods),
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
  validateVat: mockVatServiceMethods.validateVat,
  validateClientVat: mockVatServiceMethods.validateClientVat,
  getVatStatus: mockVatServiceMethods.getVatStatus,
  refreshVatStatus: mockVatServiceMethods.refreshVatStatus,
  batchValidateVat: mockVatServiceMethods.batchValidateVat,
};

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  client: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  vatValidationHistory: {
    create: vi.fn(),
    findMany: vi.fn(),
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

describe('VAT Router (CRM-003)', () => {
  // UUIDs
  const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440002';
  const ORG_ID = '550e8400-e29b-41d4-a716-446655440030';
  const CLIENT_ID = '550e8400-e29b-41d4-a716-446655440100';
  const CLIENT_ID_2 = '550e8400-e29b-41d4-a716-446655440101';
  const CLIENT_ID_3 = '550e8400-e29b-41d4-a716-446655440102';
  const NON_EXISTENT_ID = '550e8400-e29b-41d4-a716-446655449999';

  // VIES response data
  const mockViesData = {
    valid: true,
    countryCode: 'PL',
    vatNumber: '1234563218',
    requestDate: '2025-01-15',
    name: 'Test Company Sp. z o.o.',
    address: 'ul. Marszałkowska 100, 00-001 Warszawa',
    traderName: 'Test Company Sp. z o.o.',
    traderCompanyType: 'Spółka z ograniczoną odpowiedzialnością',
    traderAddress: 'ul. Marszałkowska 100, 00-001 Warszawa',
    requestIdentifier: 'req-123456',
  };

  // VAT validation result
  const validVatResult = {
    valid: true,
    status: 'ACTIVE' as const,
    countryCode: 'PL',
    vatNumber: '1234563218',
    formattedVatNumber: 'PL1234563218',
    companyName: 'Test Company Sp. z o.o.',
    companyAddress: 'ul. Marszałkowska 100, 00-001 Warszawa',
    validatedAt: new Date('2025-01-15'),
    cached: false,
    viesData: mockViesData,
    message: 'Numer VAT jest aktywny',
  };

  const invalidVatResult = {
    valid: false,
    status: 'NOT_REGISTERED' as const,
    countryCode: 'PL',
    vatNumber: '9999999999',
    formattedVatNumber: 'PL9999999999',
    companyName: null,
    companyAddress: null,
    validatedAt: new Date('2025-01-15'),
    cached: false,
    viesData: null,
    message: 'Numer VAT nie jest zarejestrowany w VIES',
  };

  // Client VAT status
  const clientVatStatus = {
    clientId: CLIENT_ID,
    vatStatus: 'ACTIVE' as const,
    vatNumber: '1234563218',
    countryCode: 'PL',
    validatedAt: new Date('2025-01-15'),
    viesData: mockViesData,
    isExpired: false,
    canValidate: true,
    message: 'Walidacja VAT jest aktualna',
  };

  // Batch validation result
  const batchResult = {
    success: true,
    results: [
      { clientId: CLIENT_ID, success: true, vatStatus: 'ACTIVE' as const },
      { clientId: CLIENT_ID_2, success: true, vatStatus: 'ACTIVE' as const },
      { clientId: CLIENT_ID_3, success: false, error: 'Brak numeru NIP' },
    ],
    validated: 2,
    failed: 0,
    skipped: 1,
    message: 'Zwalidowano 2 z 3 klientów',
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
    mockPrisma.user.findUnique.mockResolvedValue({
      id: TEST_USER_ID,
      email: 'test@example.com',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$hashedpassword',
      status: 'ACTIVE',
      isEmailVerified: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // CONTEXT HELPERS
  // ===========================================================================

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
        url: '/api/trpc/crm.vat',
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
        url: '/api/trpc/crm.vat',
        method: 'POST',
      } as any,
      res: {} as any,
    });
  }

  // ===========================================================================
  // VALIDATE VAT
  // ===========================================================================

  describe('validateVat', () => {
    it('should validate a valid Polish VAT number', async () => {
      mocks.validateVat.mockResolvedValue(validVatResult);
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.vat.validateVat({
        countryCode: 'PL',
        vatNumber: '1234563218',
      });

      expect(result.valid).toBe(true);
      expect(result.status).toBe('ACTIVE');
      expect(result.countryCode).toBe('PL');
      expect(result.formattedVatNumber).toBe('PL1234563218');
      expect(mocks.validateVat).toHaveBeenCalledWith({
        countryCode: 'PL',
        vatNumber: '1234563218',
      });
    });

    it('should validate German VAT number', async () => {
      mocks.validateVat.mockResolvedValue({
        ...validVatResult,
        countryCode: 'DE',
        vatNumber: '123456789',
        formattedVatNumber: 'DE123456789',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.vat.validateVat({
        countryCode: 'DE',
        vatNumber: '123456789',
      });

      expect(result.valid).toBe(true);
      expect(result.countryCode).toBe('DE');
    });

    it('should return NOT_REGISTERED for invalid VAT', async () => {
      mocks.validateVat.mockResolvedValue(invalidVatResult);
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.vat.validateVat({
        countryCode: 'PL',
        vatNumber: '9999999999',
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe('NOT_REGISTERED');
      expect(result.companyName).toBeNull();
    });

    it('should return INVALID for malformed VAT number', async () => {
      mocks.validateVat.mockResolvedValue({
        ...invalidVatResult,
        status: 'INVALID' as const,
        message: 'Nieprawidłowy format numeru VAT',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.vat.validateVat({
        countryCode: 'PL',
        vatNumber: 'ABCDEF',
      });

      expect(result.status).toBe('INVALID');
    });

    it('should return cached result when available', async () => {
      mocks.validateVat.mockResolvedValue({
        ...validVatResult,
        cached: true,
        message: 'Numer VAT jest aktywny (z cache)',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.vat.validateVat({
        countryCode: 'PL',
        vatNumber: '1234563218',
      });

      expect(result.cached).toBe(true);
    });

    it('should validate all EU country codes', async () => {
      const euCountries = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES',
        'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
        'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'XI'];

      const userCaller = appRouter.createCaller(createUserContext());

      for (const country of euCountries) {
        mocks.validateVat.mockResolvedValue({
          ...validVatResult,
          countryCode: country,
        });

        const result = await userCaller.crm.vat.validateVat({
          countryCode: country as any,
          vatNumber: '123456789',
        });

        expect(result.countryCode).toBe(country);
      }
    });

    it('should reject invalid country code', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.vat.validateVat({
          countryCode: 'XX' as any,
          vatNumber: '123456789',
        })
      ).rejects.toThrow();
    });

    it('should reject empty VAT number', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.vat.validateVat({
          countryCode: 'PL',
          vatNumber: '',
        })
      ).rejects.toThrow();
    });

    it('should reject VAT number that is too short', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.vat.validateVat({
          countryCode: 'PL',
          vatNumber: 'AB',
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // VALIDATE CLIENT VAT
  // ===========================================================================

  describe('validateClientVat', () => {
    it('should validate VAT for existing client', async () => {
      mocks.validateClientVat.mockResolvedValue(validVatResult);
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.vat.validateClientVat({
        clientId: CLIENT_ID,
      });

      expect(result.valid).toBe(true);
      expect(result.status).toBe('ACTIVE');
      expect(mocks.validateClientVat).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        force: false,
      });
    });

    it('should use provided country code over client default', async () => {
      mocks.validateClientVat.mockResolvedValue({
        ...validVatResult,
        countryCode: 'DE',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.vat.validateClientVat({
        clientId: CLIENT_ID,
        countryCode: 'DE',
      });

      expect(result.countryCode).toBe('DE');
      expect(mocks.validateClientVat).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        countryCode: 'DE',
        force: false,
      });
    });

    it('should use provided VAT number over client NIP', async () => {
      mocks.validateClientVat.mockResolvedValue({
        ...validVatResult,
        vatNumber: '9876543210',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.vat.validateClientVat({
        clientId: CLIENT_ID,
        vatNumber: '9876543210',
      });

      expect(result.vatNumber).toBe('9876543210');
    });

    it('should force re-validation when force=true', async () => {
      mocks.validateClientVat.mockResolvedValue({
        ...validVatResult,
        cached: false,
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.vat.validateClientVat({
        clientId: CLIENT_ID,
        force: true,
      });

      expect(result.cached).toBe(false);
      expect(mocks.validateClientVat).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        force: true,
      });
    });

    it('should throw NOT_FOUND for non-existent client', async () => {
      mocks.validateClientVat.mockRejectedValue(
        new TRPCError({ code: 'NOT_FOUND', message: 'Klient nie został znaleziony' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.vat.validateClientVat({ clientId: NON_EXISTENT_ID })
      ).rejects.toThrow('Klient nie został znaleziony');
    });

    it('should throw BAD_REQUEST for client without NIP', async () => {
      mocks.validateClientVat.mockRejectedValue(
        new TRPCError({ code: 'BAD_REQUEST', message: 'Klient nie posiada numeru NIP' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.vat.validateClientVat({ clientId: CLIENT_ID })
      ).rejects.toThrow('Klient nie posiada numeru NIP');
    });

    it('should validate UUID format for clientId', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.vat.validateClientVat({ clientId: 'invalid-uuid' })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // GET VAT STATUS
  // ===========================================================================

  describe('getVatStatus', () => {
    it('should return VAT status for client', async () => {
      mocks.getVatStatus.mockResolvedValue(clientVatStatus);
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.vat.getVatStatus({
        clientId: CLIENT_ID,
      });

      expect(result.clientId).toBe(CLIENT_ID);
      expect(result.vatStatus).toBe('ACTIVE');
      expect(result.canValidate).toBe(true);
      expect(result.isExpired).toBe(false);
      expect(mocks.getVatStatus).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
      });
    });

    it('should indicate expired validation', async () => {
      mocks.getVatStatus.mockResolvedValue({
        ...clientVatStatus,
        isExpired: true,
        message: 'Walidacja VAT wygasła',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.vat.getVatStatus({
        clientId: CLIENT_ID,
      });

      expect(result.isExpired).toBe(true);
    });

    it('should indicate canValidate=false for clients without NIP', async () => {
      mocks.getVatStatus.mockResolvedValue({
        ...clientVatStatus,
        vatNumber: null,
        canValidate: false,
        vatStatus: 'UNKNOWN' as const,
        message: 'Klient nie posiada numeru NIP',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.vat.getVatStatus({
        clientId: CLIENT_ID,
      });

      expect(result.canValidate).toBe(false);
      expect(result.vatNumber).toBeNull();
    });

    it('should return UNKNOWN status for never validated client', async () => {
      mocks.getVatStatus.mockResolvedValue({
        ...clientVatStatus,
        vatStatus: 'UNKNOWN' as const,
        validatedAt: null,
        viesData: null,
        message: 'Klient nie został jeszcze zwalidowany',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.vat.getVatStatus({
        clientId: CLIENT_ID,
      });

      expect(result.vatStatus).toBe('UNKNOWN');
      expect(result.validatedAt).toBeNull();
    });

    it('should throw NOT_FOUND for non-existent client', async () => {
      mocks.getVatStatus.mockRejectedValue(
        new TRPCError({ code: 'NOT_FOUND', message: 'Klient nie został znaleziony' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.vat.getVatStatus({ clientId: NON_EXISTENT_ID })
      ).rejects.toThrow('Klient nie został znaleziony');
    });
  });

  // ===========================================================================
  // REFRESH VAT STATUS
  // ===========================================================================

  describe('refreshVatStatus', () => {
    it('should refresh VAT status for client', async () => {
      mocks.refreshVatStatus.mockResolvedValue({
        ...validVatResult,
        cached: false,
        message: 'Status VAT został odświeżony',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.vat.refreshVatStatus({
        clientId: CLIENT_ID,
      });

      expect(result.cached).toBe(false);
      expect(mocks.refreshVatStatus).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
      });
    });

    it('should throw NOT_FOUND for non-existent client', async () => {
      mocks.refreshVatStatus.mockRejectedValue(
        new TRPCError({ code: 'NOT_FOUND', message: 'Klient nie został znaleziony' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.vat.refreshVatStatus({ clientId: NON_EXISTENT_ID })
      ).rejects.toThrow('Klient nie został znaleziony');
    });

    it('should throw BAD_REQUEST for client without NIP', async () => {
      mocks.refreshVatStatus.mockRejectedValue(
        new TRPCError({ code: 'BAD_REQUEST', message: 'Klient nie posiada numeru NIP' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.vat.refreshVatStatus({ clientId: CLIENT_ID })
      ).rejects.toThrow('Klient nie posiada numeru NIP');
    });

    it('should return fresh data even if cached exists', async () => {
      mocks.refreshVatStatus.mockResolvedValue({
        ...validVatResult,
        cached: false,
        validatedAt: new Date(),
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.vat.refreshVatStatus({
        clientId: CLIENT_ID,
      });

      expect(result.cached).toBe(false);
    });
  });

  // ===========================================================================
  // BATCH VALIDATE VAT
  // ===========================================================================

  describe('batchValidateVat', () => {
    it('should validate multiple clients in batch', async () => {
      mocks.batchValidateVat.mockResolvedValue(batchResult);
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.vat.batchValidateVat({
        clientIds: [CLIENT_ID, CLIENT_ID_2, CLIENT_ID_3],
      });

      expect(result.success).toBe(true);
      expect(result.validated).toBe(2);
      expect(result.skipped).toBe(1);
      expect(result.results).toHaveLength(3);
      expect(mocks.batchValidateVat).toHaveBeenCalledWith({
        clientIds: [CLIENT_ID, CLIENT_ID_2, CLIENT_ID_3],
        force: false,
      });
    });

    it('should use force flag for all clients', async () => {
      mocks.batchValidateVat.mockResolvedValue(batchResult);
      const userCaller = appRouter.createCaller(createUserContext());

      await userCaller.crm.vat.batchValidateVat({
        clientIds: [CLIENT_ID],
        force: true,
      });

      expect(mocks.batchValidateVat).toHaveBeenCalledWith({
        clientIds: [CLIENT_ID],
        force: true,
      });
    });

    it('should handle partial failures gracefully', async () => {
      mocks.batchValidateVat.mockResolvedValue({
        ...batchResult,
        failed: 1,
        results: [
          { clientId: CLIENT_ID, success: true, vatStatus: 'ACTIVE' as const },
          { clientId: CLIENT_ID_2, success: false, error: 'Błąd VIES API' },
        ],
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.vat.batchValidateVat({
        clientIds: [CLIENT_ID, CLIENT_ID_2],
      });

      expect(result.success).toBe(true);
      expect(result.failed).toBe(1);
      expect(result.results.find(r => r.error)).toBeTruthy();
    });

    it('should reject empty clientIds array', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.vat.batchValidateVat({
          clientIds: [],
        })
      ).rejects.toThrow();
    });

    it('should reject more than 50 clientIds', async () => {
      const userCaller = appRouter.createCaller(createUserContext());
      const tooManyIds = Array.from({ length: 60 }, (_, i) =>
        `550e8400-e29b-41d4-a716-44665544${i.toString().padStart(4, '0')}`
      );

      await expect(
        userCaller.crm.vat.batchValidateVat({
          clientIds: tooManyIds,
        })
      ).rejects.toThrow();
    });

    it('should validate UUID format for all clientIds', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.vat.batchValidateVat({
          clientIds: ['invalid-uuid'],
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // AUTHENTICATION REQUIREMENTS
  // ===========================================================================

  describe('authentication', () => {
    it('should require authentication for validateVat', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.crm.vat.validateVat({
          countryCode: 'PL',
          vatNumber: '1234563218',
        })
      ).rejects.toThrow();
    });

    it('should require authentication for validateClientVat', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.crm.vat.validateClientVat({
          clientId: CLIENT_ID,
        })
      ).rejects.toThrow();
    });

    it('should require authentication for getVatStatus', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.crm.vat.getVatStatus({
          clientId: CLIENT_ID,
        })
      ).rejects.toThrow();
    });

    it('should require authentication for refreshVatStatus', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.crm.vat.refreshVatStatus({
          clientId: CLIENT_ID,
        })
      ).rejects.toThrow();
    });

    it('should require authentication for batchValidateVat', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.crm.vat.batchValidateVat({
          clientIds: [CLIENT_ID],
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  describe('error handling', () => {
    it('should handle VIES API errors gracefully', async () => {
      mocks.validateVat.mockResolvedValue({
        valid: false,
        status: 'UNKNOWN' as const,
        countryCode: 'PL',
        vatNumber: '1234563218',
        formattedVatNumber: 'PL1234563218',
        companyName: null,
        companyAddress: null,
        validatedAt: new Date(),
        cached: false,
        viesData: null,
        message: 'Nie można połączyć z VIES API',
      });
      const userCaller = appRouter.createCaller(createUserContext());

      const result = await userCaller.crm.vat.validateVat({
        countryCode: 'PL',
        vatNumber: '1234563218',
      });

      expect(result.status).toBe('UNKNOWN');
      expect(result.message).toContain('VIES');
    });

    it('should handle service errors gracefully', async () => {
      mocks.validateVat.mockRejectedValue(new Error('Database connection failed'));
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.vat.validateVat({
          countryCode: 'PL',
          vatNumber: '1234563218',
        })
      ).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      mocks.validateClientVat.mockRejectedValue(
        new TRPCError({ code: 'TIMEOUT', message: 'Przekroczono limit czasu' })
      );
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.vat.validateClientVat({ clientId: CLIENT_ID })
      ).rejects.toThrow('Przekroczono limit czasu');
    });
  });

  // ===========================================================================
  // INPUT VALIDATION
  // ===========================================================================

  describe('input validation', () => {
    it('should validate VAT number length (min 4 chars)', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.vat.validateVat({
          countryCode: 'PL',
          vatNumber: 'AB', // Too short
        })
      ).rejects.toThrow();
    });

    it('should validate VAT number length (max 15 chars)', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      await expect(
        userCaller.crm.vat.validateVat({
          countryCode: 'PL',
          vatNumber: '1234567890123456789', // Too long
        })
      ).rejects.toThrow();
    });

    it('should normalize VAT number (uppercase, remove spaces)', async () => {
      mocks.validateVat.mockResolvedValue(validVatResult);
      const userCaller = appRouter.createCaller(createUserContext());

      // Use a shorter input within the 15 char limit (raw string is validated before transform)
      await userCaller.crm.vat.validateVat({
        countryCode: 'PL',
        vatNumber: '1234-563-218', // 12 chars with dashes, normalized to 10 digits
      });

      // Validation should pass because normalization happens at schema level
      expect(mocks.validateVat).toHaveBeenCalled();
      // Verify the service receives normalized input
      expect(mocks.validateVat).toHaveBeenCalledWith({
        countryCode: 'PL',
        vatNumber: '1234563218', // Normalized: uppercase, alphanumeric only
      });
    });

    it('should validate EU country code enum', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      // Valid EU codes should work
      const validCodes = ['PL', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT'];
      for (const code of validCodes) {
        mocks.validateVat.mockResolvedValue({ ...validVatResult, countryCode: code });
        await expect(
          userCaller.crm.vat.validateVat({
            countryCode: code as any,
            vatNumber: '123456789',
          })
        ).resolves.toBeDefined();
      }
    });

    it('should reject non-EU country codes', async () => {
      const userCaller = appRouter.createCaller(createUserContext());

      const invalidCodes = ['US', 'UK', 'CH', 'NO', 'RU', 'CN', 'JP'];
      for (const code of invalidCodes) {
        await expect(
          userCaller.crm.vat.validateVat({
            countryCode: code as any,
            vatNumber: '123456789',
          })
        ).rejects.toThrow();
      }
    });
  });
});
