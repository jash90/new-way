import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { VatService } from '../../services/crm/vat.service';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';

// ===========================================
// MOCK DATA
// ===========================================

const mockUserId = '123e4567-e89b-12d3-a456-426614174001';
const mockOrganizationId = '123e4567-e89b-12d3-a456-426614174002';

const mockCompanyClient = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  type: 'company' as const,
  status: 'active' as const,
  displayName: 'Test Company Sp. z o.o.',
  companyName: 'Test Company Sp. z o.o.',
  nip: '1234563218',
  regon: '123456785',
  email: 'kontakt@testcompany.pl',
  country: 'PL',
  ownerId: mockUserId,
  organizationId: mockOrganizationId,
  vatStatus: null,
  vatValidatedAt: null,
  viesData: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockIndividualClient = {
  id: '123e4567-e89b-12d3-a456-426614174003',
  type: 'individual' as const,
  status: 'active' as const,
  displayName: 'Jan Kowalski',
  firstName: 'Jan',
  lastName: 'Kowalski',
  nip: null,
  country: 'PL',
  ownerId: mockUserId,
  organizationId: mockOrganizationId,
  vatStatus: null,
  vatValidatedAt: null,
  viesData: null,
  createdAt: new Date('2024-01-02'),
  updatedAt: new Date('2024-01-02'),
};

const mockViesResponse = {
  valid: true,
  countryCode: 'PL',
  vatNumber: '1234563218',
  requestDate: '2024-01-15',
  name: 'Test Company Sp. z o.o.',
  address: 'ul. Marszałkowska 100, 00-001 Warszawa',
  traderName: 'Test Company Sp. z o.o.',
  traderCompanyType: 'Spółka z ograniczoną odpowiedzialnością',
  traderAddress: 'ul. Marszałkowska 100, 00-001 Warszawa',
  requestIdentifier: 'req-123456',
};

const mockInvalidViesResponse = {
  valid: false,
  countryCode: 'PL',
  vatNumber: '9999999999',
  requestDate: '2024-01-15',
  name: null,
  address: null,
  traderName: null,
  traderCompanyType: null,
  traderAddress: null,
};

// ===========================================
// MOCKS
// ===========================================

const mockPrisma = {
  client: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  vatValidationHistory: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
} as unknown as PrismaClient;

const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
} as unknown as Redis;

const mockAuditLogger = {
  log: vi.fn(),
} as unknown as AuditLogger;

// Mock VIES API client
const mockViesClient = {
  checkVat: vi.fn(),
};

describe('VatService', () => {
  let vatService: VatService;

  beforeEach(() => {
    vi.clearAllMocks();
    vatService = new VatService(
      mockPrisma,
      mockRedis,
      mockAuditLogger,
      mockUserId,
      mockOrganizationId
    );
    // Inject mock VIES client
    (vatService as any).viesClient = mockViesClient;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================
  // VALIDATE VAT NUMBER
  // ===========================================

  describe('validateVat', () => {
    describe('successful validation', () => {
      it('should validate a valid Polish VAT number', async () => {
        mockViesClient.checkVat.mockResolvedValue(mockViesResponse);
        vi.mocked(mockRedis.get).mockResolvedValue(null);

        const result = await vatService.validateVat({
          countryCode: 'PL',
          vatNumber: '1234563218',
        });

        expect(result.valid).toBe(true);
        expect(result.status).toBe('ACTIVE');
        expect(result.countryCode).toBe('PL');
        expect(result.vatNumber).toBe('1234563218');
        expect(result.formattedVatNumber).toBe('PL1234563218');
        expect(result.companyName).toBe('Test Company Sp. z o.o.');
        expect(result.viesData).toEqual(mockViesResponse);
      });

      it('should validate VAT numbers for all EU countries', async () => {
        const euCountries = ['AT', 'BE', 'BG', 'DE', 'FR', 'NL', 'ES', 'IT'];

        for (const countryCode of euCountries) {
          mockViesClient.checkVat.mockResolvedValue({
            ...mockViesResponse,
            countryCode,
          });
          vi.mocked(mockRedis.get).mockResolvedValue(null);

          const result = await vatService.validateVat({
            countryCode: countryCode as any,
            vatNumber: '123456789',
          });

          expect(result.countryCode).toBe(countryCode);
        }
      });

      it('should return cached result if available', async () => {
        const cachedResult = {
          valid: true,
          status: 'ACTIVE',
          countryCode: 'PL',
          vatNumber: '1234563218',
          formattedVatNumber: 'PL1234563218',
          companyName: 'Cached Company',
          companyAddress: 'Cached Address',
          validatedAt: new Date('2024-01-14').toISOString(),
          cached: true,
          viesData: mockViesResponse,
          message: 'Numer VAT jest aktywny (z cache)',
        };

        vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(cachedResult));

        const result = await vatService.validateVat({
          countryCode: 'PL',
          vatNumber: '1234563218',
        });

        expect(result.cached).toBe(true);
        expect(result.companyName).toBe('Cached Company');
        expect(mockViesClient.checkVat).not.toHaveBeenCalled();
      });

      it('should cache successful validation results', async () => {
        mockViesClient.checkVat.mockResolvedValue(mockViesResponse);
        vi.mocked(mockRedis.get).mockResolvedValue(null);

        await vatService.validateVat({
          countryCode: 'PL',
          vatNumber: '1234563218',
        });

        expect(mockRedis.setex).toHaveBeenCalledWith(
          expect.stringContaining('vat:PL:1234563218'),
          86400, // 24 hours
          expect.any(String)
        );
      });

      it('should normalize VAT number before validation', async () => {
        mockViesClient.checkVat.mockResolvedValue(mockViesResponse);
        vi.mocked(mockRedis.get).mockResolvedValue(null);

        const result = await vatService.validateVat({
          countryCode: 'PL',
          vatNumber: '  pl-1234-563-218  ', // With spaces, prefix, and dashes
        });

        expect(result.vatNumber).toBe('1234563218');
        expect(result.formattedVatNumber).toBe('PL1234563218');
      });
    });

    describe('invalid VAT validation', () => {
      it('should return NOT_REGISTERED for invalid VAT number', async () => {
        mockViesClient.checkVat.mockResolvedValue(mockInvalidViesResponse);
        vi.mocked(mockRedis.get).mockResolvedValue(null);

        const result = await vatService.validateVat({
          countryCode: 'PL',
          vatNumber: '9999999999',
        });

        expect(result.valid).toBe(false);
        expect(result.status).toBe('NOT_REGISTERED');
        expect(result.companyName).toBeNull();
      });

      it('should return INVALID for malformed VAT number', async () => {
        vi.mocked(mockRedis.get).mockResolvedValue(null);

        const result = await vatService.validateVat({
          countryCode: 'PL',
          vatNumber: 'ABC', // Invalid format for Poland
        });

        expect(result.valid).toBe(false);
        expect(result.status).toBe('INVALID');
        expect(result.message).toContain('format');
      });

      it('should validate VAT format per country', async () => {
        vi.mocked(mockRedis.get).mockResolvedValue(null);

        // Polish NIP must be 10 digits
        const plResult = await vatService.validateVat({
          countryCode: 'PL',
          vatNumber: '123', // Too short
        });
        expect(plResult.status).toBe('INVALID');

        // German VAT must be 9 digits
        const deResult = await vatService.validateVat({
          countryCode: 'DE',
          vatNumber: '12345678901234', // Too long
        });
        expect(deResult.status).toBe('INVALID');
      });
    });

    describe('error handling', () => {
      it('should return UNKNOWN status on VIES API error', async () => {
        mockViesClient.checkVat.mockRejectedValue(new Error('VIES service unavailable'));
        vi.mocked(mockRedis.get).mockResolvedValue(null);

        const result = await vatService.validateVat({
          countryCode: 'PL',
          vatNumber: '1234563218',
        });

        expect(result.valid).toBe(false);
        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('błąd');
      });

      it('should handle Redis cache errors gracefully', async () => {
        vi.mocked(mockRedis.get).mockRejectedValue(new Error('Redis connection error'));
        mockViesClient.checkVat.mockResolvedValue(mockViesResponse);

        const result = await vatService.validateVat({
          countryCode: 'PL',
          vatNumber: '1234563218',
        });

        expect(result.valid).toBe(true);
        expect(result.cached).toBe(false);
      });

      it('should handle VIES timeout gracefully', async () => {
        mockViesClient.checkVat.mockRejectedValue(new Error('Timeout'));
        vi.mocked(mockRedis.get).mockResolvedValue(null);

        const result = await vatService.validateVat({
          countryCode: 'PL',
          vatNumber: '1234563218',
        });

        expect(result.status).toBe('UNKNOWN');
        expect(result.message).toContain('timeout');
      });
    });
  });

  // ===========================================
  // VALIDATE CLIENT VAT
  // ===========================================

  describe('validateClientVat', () => {
    it('should validate VAT for existing client with NIP', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      mockViesClient.checkVat.mockResolvedValue(mockViesResponse);
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        vatStatus: 'ACTIVE',
        vatValidatedAt: new Date(),
        viesData: mockViesResponse,
      });

      const result = await vatService.validateClientVat({
        clientId: mockCompanyClient.id,
      });

      expect(result.valid).toBe(true);
      expect(result.status).toBe('ACTIVE');
      expect(mockPrisma.client.update).toHaveBeenCalledWith({
        where: { id: mockCompanyClient.id },
        data: expect.objectContaining({
          vatStatus: 'ACTIVE',
          vatValidatedAt: expect.any(Date),
          viesData: mockViesResponse,
        }),
      });
    });

    it('should use client country code if not provided', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        ...mockCompanyClient,
        country: 'DE',
      });
      mockViesClient.checkVat.mockResolvedValue({
        ...mockViesResponse,
        countryCode: 'DE',
      });
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        vatStatus: 'ACTIVE',
      });

      const result = await vatService.validateClientVat({
        clientId: mockCompanyClient.id,
      });

      expect(result.countryCode).toBe('DE');
    });

    it('should use provided VAT number over client NIP', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      mockViesClient.checkVat.mockResolvedValue({
        ...mockViesResponse,
        vatNumber: '9876543210',
      });
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        vatStatus: 'ACTIVE',
      });

      const result = await vatService.validateClientVat({
        clientId: mockCompanyClient.id,
        vatNumber: '9876543210',
      });

      expect(result.vatNumber).toBe('9876543210');
    });

    it('should force re-validation when force=true', async () => {
      const cachedResult = JSON.stringify({
        valid: true,
        status: 'ACTIVE',
        cached: true,
      });

      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      vi.mocked(mockRedis.get).mockResolvedValue(cachedResult);
      mockViesClient.checkVat.mockResolvedValue(mockViesResponse);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        vatStatus: 'ACTIVE',
      });

      const result = await vatService.validateClientVat({
        clientId: mockCompanyClient.id,
        force: true,
      });

      expect(mockViesClient.checkVat).toHaveBeenCalled();
      expect(result.cached).toBe(false);
    });

    it('should throw NOT_FOUND for non-existent client', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(null);

      await expect(
        vatService.validateClientVat({ clientId: 'non-existent-id' })
      ).rejects.toThrow(TRPCError);

      await expect(
        vatService.validateClientVat({ clientId: 'non-existent-id' })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should throw BAD_REQUEST for client without NIP', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        ...mockCompanyClient,
        nip: null,
      });

      await expect(
        vatService.validateClientVat({ clientId: mockCompanyClient.id })
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('should log audit event on successful validation', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      mockViesClient.checkVat.mockResolvedValue(mockViesResponse);
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        vatStatus: 'ACTIVE',
      });

      await vatService.validateClientVat({ clientId: mockCompanyClient.id });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'VAT_VALIDATED',
          resourceId: mockCompanyClient.id,
        })
      );
    });

    it('should create validation history entry', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      mockViesClient.checkVat.mockResolvedValue(mockViesResponse);
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        vatStatus: 'ACTIVE',
      });

      await vatService.validateClientVat({ clientId: mockCompanyClient.id });

      expect(mockPrisma.vatValidationHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientId: mockCompanyClient.id,
          vatNumber: mockCompanyClient.nip,
          countryCode: 'PL',
          status: 'ACTIVE',
          validatedBy: mockUserId,
        }),
      });
    });
  });

  // ===========================================
  // GET VAT STATUS
  // ===========================================

  describe('getVatStatus', () => {
    it('should return VAT status for client with validation', async () => {
      const validatedClient = {
        ...mockCompanyClient,
        vatStatus: 'ACTIVE',
        vatValidatedAt: new Date('2024-01-15'),
        viesData: mockViesResponse,
      };

      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(validatedClient);

      const result = await vatService.getVatStatus({
        clientId: mockCompanyClient.id,
      });

      expect(result.clientId).toBe(mockCompanyClient.id);
      expect(result.vatStatus).toBe('ACTIVE');
      expect(result.vatNumber).toBe(mockCompanyClient.nip);
      expect(result.countryCode).toBe('PL');
      expect(result.validatedAt).toEqual(new Date('2024-01-15'));
      expect(result.canValidate).toBe(true);
    });

    it('should indicate expired status for old validation', async () => {
      const expiredValidation = {
        ...mockCompanyClient,
        vatStatus: 'ACTIVE',
        vatValidatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        viesData: mockViesResponse,
      };

      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(expiredValidation);

      const result = await vatService.getVatStatus({
        clientId: mockCompanyClient.id,
      });

      expect(result.isExpired).toBe(true);
      expect(result.message).toContain('wygasła');
    });

    it('should return canValidate=false for individual clients', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockIndividualClient);

      const result = await vatService.getVatStatus({
        clientId: mockIndividualClient.id,
      });

      expect(result.canValidate).toBe(false);
      expect(result.vatNumber).toBeNull();
    });

    it('should return canValidate=false for clients without NIP', async () => {
      const clientWithoutNip = {
        ...mockCompanyClient,
        nip: null,
      };

      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(clientWithoutNip);

      const result = await vatService.getVatStatus({
        clientId: mockCompanyClient.id,
      });

      expect(result.canValidate).toBe(false);
    });

    it('should throw NOT_FOUND for non-existent client', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(null);

      await expect(
        vatService.getVatStatus({ clientId: 'non-existent-id' })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should return UNKNOWN status for never validated client', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);

      const result = await vatService.getVatStatus({
        clientId: mockCompanyClient.id,
      });

      expect(result.vatStatus).toBe('UNKNOWN');
      expect(result.validatedAt).toBeNull();
    });
  });

  // ===========================================
  // REFRESH VAT STATUS
  // ===========================================

  describe('refreshVatStatus', () => {
    it('should refresh VAT status and invalidate cache', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      mockViesClient.checkVat.mockResolvedValue(mockViesResponse);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        vatStatus: 'ACTIVE',
        vatValidatedAt: new Date(),
      });

      const result = await vatService.refreshVatStatus({
        clientId: mockCompanyClient.id,
      });

      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining('vat:PL:1234563218')
      );
      expect(result.valid).toBe(true);
      expect(result.cached).toBe(false);
    });

    it('should throw NOT_FOUND for non-existent client', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(null);

      await expect(
        vatService.refreshVatStatus({ clientId: 'non-existent-id' })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should throw BAD_REQUEST for client without NIP', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue({
        ...mockCompanyClient,
        nip: null,
      });

      await expect(
        vatService.refreshVatStatus({ clientId: mockCompanyClient.id })
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });
  });

  // ===========================================
  // BATCH VALIDATE VAT
  // ===========================================

  describe('batchValidateVat', () => {
    const clientIds = [
      '123e4567-e89b-12d3-a456-426614174000',
      '123e4567-e89b-12d3-a456-426614174001',
      '123e4567-e89b-12d3-a456-426614174002',
    ];

    it('should validate multiple clients in batch', async () => {
      const mockClients = clientIds.map((id, index) => ({
        ...mockCompanyClient,
        id,
        nip: `123456321${index}`,
      }));

      vi.mocked(mockPrisma.client.findMany).mockResolvedValue(mockClients);
      // Mock findUnique for each validateClientVat call
      vi.mocked(mockPrisma.client.findUnique).mockImplementation(({ where }: any) => {
        const client = mockClients.find(c => c.id === where.id);
        return Promise.resolve(client || null) as any;
      });
      mockViesClient.checkVat.mockResolvedValue(mockViesResponse);
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        vatStatus: 'ACTIVE',
      });

      const result = await vatService.batchValidateVat({
        clientIds,
        force: false,
      });

      expect(result.success).toBe(true);
      expect(result.validated).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it('should skip clients without NIP', async () => {
      const mockClients = [
        { ...mockCompanyClient, id: clientIds[0] },
        { ...mockIndividualClient, id: clientIds[1] },
        { ...mockCompanyClient, id: clientIds[2], nip: null },
      ];

      vi.mocked(mockPrisma.client.findMany).mockResolvedValue(mockClients);
      // Mock findUnique for validateClientVat call (only first client has NIP)
      vi.mocked(mockPrisma.client.findUnique).mockImplementation(({ where }: any) => {
        const client = mockClients.find(c => c.id === where.id);
        return Promise.resolve(client || null) as any;
      });
      mockViesClient.checkVat.mockResolvedValue(mockViesResponse);
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        vatStatus: 'ACTIVE',
      });

      const result = await vatService.batchValidateVat({
        clientIds,
        force: false,
      });

      expect(result.validated).toBe(1);
      expect(result.skipped).toBe(2);
    });

    it('should handle partial failures gracefully', async () => {
      const mockClients = clientIds.map((id, index) => ({
        ...mockCompanyClient,
        id,
        nip: `123456321${index}`,
      }));

      vi.mocked(mockPrisma.client.findMany).mockResolvedValue(mockClients);
      // Mock findUnique for each validateClientVat call
      vi.mocked(mockPrisma.client.findUnique).mockImplementation(({ where }: any) => {
        const client = mockClients.find(c => c.id === where.id);
        return Promise.resolve(client || null) as any;
      });
      vi.mocked(mockRedis.get).mockResolvedValue(null);

      // First two succeed, third has VIES API error (returns UNKNOWN status, not failure)
      mockViesClient.checkVat
        .mockResolvedValueOnce(mockViesResponse)
        .mockResolvedValueOnce(mockViesResponse)
        .mockRejectedValueOnce(new Error('VIES error'));

      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        vatStatus: 'ACTIVE',
      });

      const result = await vatService.batchValidateVat({
        clientIds,
        force: false,
      });

      // VIES errors are handled gracefully - client is still "validated" with UNKNOWN status
      expect(result.success).toBe(true);
      expect(result.validated).toBe(3); // All 3 processed (one with UNKNOWN status)
      expect(result.failed).toBe(0);    // No batch-level failures
      expect(result.results).toHaveLength(3);
      // Verify the third client has UNKNOWN status due to VIES error
      expect(result.results[2].vatStatus).toBe('UNKNOWN');
    });

    it('should respect batch size limit of 50', async () => {
      const tooManyIds = Array.from({ length: 60 }, (_, i) =>
        `123e4567-e89b-12d3-a456-42661417${i.toString().padStart(4, '0')}`
      );

      await expect(
        vatService.batchValidateVat({ clientIds: tooManyIds, force: false })
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('should use cached results when force=false', async () => {
      const mockClients = [{ ...mockCompanyClient, id: clientIds[0] }];
      const cachedResult = JSON.stringify({
        valid: true,
        status: 'ACTIVE',
        countryCode: 'PL',
        vatNumber: '1234563218',
        formattedVatNumber: 'PL1234563218',
        companyName: 'Test Company',
        companyAddress: 'Test Address',
        validatedAt: new Date().toISOString(),
        cached: true,
        viesData: null,
        message: 'Cached',
      });

      vi.mocked(mockPrisma.client.findMany).mockResolvedValue(mockClients);
      // Mock findUnique for validateClientVat call
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockClients[0] as any);
      vi.mocked(mockRedis.get).mockResolvedValue(cachedResult);

      const result = await vatService.batchValidateVat({
        clientIds: [clientIds[0]],
        force: false,
      });

      expect(mockViesClient.checkVat).not.toHaveBeenCalled();
      expect(result.validated).toBe(1);
    });

    it('should force refresh when force=true', async () => {
      const mockClients = [{ ...mockCompanyClient, id: clientIds[0] }];
      const cachedResult = JSON.stringify({
        valid: true,
        status: 'ACTIVE',
        cached: true,
      });

      vi.mocked(mockPrisma.client.findMany).mockResolvedValue(mockClients);
      // Mock findUnique for validateClientVat call
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockClients[0] as any);
      vi.mocked(mockRedis.get).mockResolvedValue(cachedResult);
      mockViesClient.checkVat.mockResolvedValue(mockViesResponse);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        vatStatus: 'ACTIVE',
      });

      const result = await vatService.batchValidateVat({
        clientIds: [clientIds[0]],
        force: true,
      });

      expect(mockViesClient.checkVat).toHaveBeenCalled();
      expect(result.validated).toBe(1);
    });
  });

  // ===========================================
  // VAT FORMAT VALIDATION (Unit Tests)
  // ===========================================

  describe('VAT format validation', () => {
    it('should validate Polish NIP format (10 digits)', async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(null);

      const validResult = await vatService.validateVat({
        countryCode: 'PL',
        vatNumber: '1234563218',
      });
      expect(validResult.status).not.toBe('INVALID');

      const invalidResult = await vatService.validateVat({
        countryCode: 'PL',
        vatNumber: '123456', // Too short
      });
      expect(invalidResult.status).toBe('INVALID');
    });

    it('should validate German VAT format (9 digits)', async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(null);

      const validResult = await vatService.validateVat({
        countryCode: 'DE',
        vatNumber: '123456789',
      });
      expect(validResult.status).not.toBe('INVALID');

      const invalidResult = await vatService.validateVat({
        countryCode: 'DE',
        vatNumber: '12345678', // 8 digits
      });
      expect(invalidResult.status).toBe('INVALID');
    });

    it('should validate Austrian VAT format (U + 8 digits)', async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(null);

      const validResult = await vatService.validateVat({
        countryCode: 'AT',
        vatNumber: 'U12345678',
      });
      expect(validResult.status).not.toBe('INVALID');

      const invalidResult = await vatService.validateVat({
        countryCode: 'AT',
        vatNumber: '12345678', // Missing U prefix
      });
      expect(invalidResult.status).toBe('INVALID');
    });

    it('should validate Dutch VAT format (9 digits + B + 2 digits)', async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(null);

      const validResult = await vatService.validateVat({
        countryCode: 'NL',
        vatNumber: '123456789B01',
      });
      expect(validResult.status).not.toBe('INVALID');

      const invalidResult = await vatService.validateVat({
        countryCode: 'NL',
        vatNumber: '123456789', // Missing B and suffix
      });
      expect(invalidResult.status).toBe('INVALID');
    });

    it('should validate French VAT format (2 chars + 9 digits)', async () => {
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      mockViesClient.checkVat.mockResolvedValue(mockViesResponse);

      // French VAT: 2 alphanumeric chars + 9 digits (e.g., XX123456789)
      const validResult = await vatService.validateVat({
        countryCode: 'FR',
        vatNumber: 'AB123456789', // 2 letters + 9 digits
      });
      expect(validResult.status).not.toBe('INVALID');

      const invalidResult = await vatService.validateVat({
        countryCode: 'FR',
        vatNumber: '12345', // Too short
      });
      expect(invalidResult.status).toBe('INVALID');
    });
  });

  // ===========================================
  // CACHE BEHAVIOR
  // ===========================================

  describe('cache behavior', () => {
    it('should use 24-hour TTL for cache', async () => {
      mockViesClient.checkVat.mockResolvedValue(mockViesResponse);
      vi.mocked(mockRedis.get).mockResolvedValue(null);

      await vatService.validateVat({
        countryCode: 'PL',
        vatNumber: '1234563218',
      });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        86400, // 24 hours in seconds
        expect.any(String)
      );
    });

    it('should invalidate cache on refresh', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      mockViesClient.checkVat.mockResolvedValue(mockViesResponse);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        vatStatus: 'ACTIVE',
      });

      await vatService.refreshVatStatus({ clientId: mockCompanyClient.id });

      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should handle Redis failures gracefully', async () => {
      vi.mocked(mockRedis.get).mockRejectedValue(new Error('Redis down'));
      vi.mocked(mockRedis.setex).mockRejectedValue(new Error('Redis down'));
      mockViesClient.checkVat.mockResolvedValue(mockViesResponse);

      const result = await vatService.validateVat({
        countryCode: 'PL',
        vatNumber: '1234563218',
      });

      expect(result.valid).toBe(true);
      expect(result.cached).toBe(false);
    });
  });

  // ===========================================
  // AUDIT LOGGING
  // ===========================================

  describe('audit logging', () => {
    it('should log VAT validation events', async () => {
      vi.mocked(mockPrisma.client.findUnique).mockResolvedValue(mockCompanyClient);
      mockViesClient.checkVat.mockResolvedValue(mockViesResponse);
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        vatStatus: 'ACTIVE',
      });

      await vatService.validateClientVat({ clientId: mockCompanyClient.id });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'VAT_VALIDATED',
          actorId: mockUserId,
          resourceType: 'client',
          resourceId: mockCompanyClient.id,
        })
      );
    });

    it('should log batch validation completion', async () => {
      const mockClients = [mockCompanyClient];
      vi.mocked(mockPrisma.client.findMany).mockResolvedValue(mockClients);
      mockViesClient.checkVat.mockResolvedValue(mockViesResponse);
      vi.mocked(mockRedis.get).mockResolvedValue(null);
      vi.mocked(mockPrisma.client.update).mockResolvedValue({
        ...mockCompanyClient,
        vatStatus: 'ACTIVE',
      });

      await vatService.batchValidateVat({
        clientIds: [mockCompanyClient.id],
        force: false,
      });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'VAT_BATCH_VALIDATED',
        })
      );
    });
  });
});
