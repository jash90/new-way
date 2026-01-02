import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaxConfigurationService } from '../../services/tax/tax-configuration.service';

// ===========================================================================
// MOCKS
// ===========================================================================

const mockPrisma = {
  client: {
    findFirst: vi.fn(),
  },
  taxConfiguration: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  taxRepresentative: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  taxConfigurationAudit: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  journalEntry: {
    aggregate: vi.fn(),
  },
  $transaction: vi.fn((callback: (tx: any) => Promise<any>) => callback(mockPrisma)),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn().mockResolvedValue([]),
};

const mockAuditLogger = {
  log: vi.fn(),
};

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_ORG_ID = '22222222-2222-2222-2222-222222222222';
const CONFIG_ID = '33333333-3333-3333-3333-333333333333';
const CLIENT_ID = '44444444-4444-4444-4444-444444444444';
const REPRESENTATIVE_ID = '55555555-5555-5555-5555-555555555555';
const AUDIT_ENTRY_ID = '66666666-6666-6666-6666-666666666666';

const createService = () =>
  new TaxConfigurationService(
    mockPrisma as any,
    mockRedis as any,
    mockAuditLogger as any,
    TEST_USER_ID,
    TEST_ORG_ID
  );

const sampleClient = {
  id: CLIENT_ID,
  organizationId: TEST_ORG_ID,
  name: 'Test Company Sp. z o.o.',
  nip: '1234567890',
  legalForm: 'sp_zoo',
};

const sampleTaxConfiguration = {
  id: CONFIG_ID,
  clientId: CLIENT_ID,
  organizationId: TEST_ORG_ID,
  vatStatus: 'active',
  vatPeriod: 'monthly',
  vatExemptionReason: null,
  vatRegistrationDate: new Date('2020-01-01'),
  incomeTaxForm: 'CIT',
  incomeTaxRate: 19,
  isSmallTaxpayer: false,
  estonianCitEnabled: false,
  estonianCitStartDate: null,
  pitTaxOption: null,
  accountingYearStart: '01-01',
  zusType: 'standard',
  zusContributionBase: null,
  zusAccidentRate: 1.67,
  zusFpEnabled: true,
  zusFgspEnabled: true,
  zusUlgaExpiryDate: null,
  submissionMethod: 'automatic',
  autoUpoDownload: true,
  notificationEmail: 'test@example.com',
  notificationInApp: true,
  approvalRequired: false,
  approvalDaysBefore: 5,
  effectiveFrom: new Date('2024-01-01'),
  effectiveTo: null,
  isActive: true,
  createdBy: TEST_USER_ID,
  updatedBy: TEST_USER_ID,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const sampleRepresentative = {
  id: REPRESENTATIVE_ID,
  clientId: CLIENT_ID,
  representativeNip: '9876543210',
  representativeName: 'Jan Kowalski',
  authorizationScope: ['VAT', 'CIT'],
  upl1Reference: 'UPL-1/2024/001',
  validFrom: new Date('2024-01-01'),
  validTo: null,
  isActive: true,
  createdBy: TEST_USER_ID,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const sampleAuditEntry = {
  id: AUDIT_ENTRY_ID,
  configurationId: CONFIG_ID,
  clientId: CLIENT_ID,
  userId: TEST_USER_ID,
  action: 'UPDATE',
  fieldChanged: 'vatPeriod',
  oldValue: 'monthly',
  newValue: 'quarterly',
  changeReason: 'Zmiana na mały podatnik',
  createdAt: new Date('2024-06-01'),
  user: {
    id: TEST_USER_ID,
    name: 'Test User',
    email: 'user@example.com',
  },
};

describe('TaxConfigurationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // CREATE TAX CONFIGURATION
  // ===========================================================================

  describe('createConfiguration', () => {
    const createInput = {
      clientId: CLIENT_ID,
      vatStatus: 'active' as const,
      vatPeriod: 'monthly' as const,
      vatRegistrationDate: new Date('2020-01-01'),
      incomeTaxForm: 'CIT' as const,
      incomeTaxRate: 19,
      zusType: 'standard' as const,
      submissionMethod: 'automatic' as const,
    };

    beforeEach(() => {
      mockPrisma.client.findFirst.mockResolvedValue(sampleClient);
      mockPrisma.taxConfiguration.findFirst.mockResolvedValue(null);
      mockPrisma.taxConfiguration.create.mockResolvedValue(sampleTaxConfiguration);
      mockPrisma.taxConfigurationAudit.create.mockResolvedValue({});
      mockPrisma.journalEntry.aggregate.mockResolvedValue({ _sum: { credit: 0 } });
    });

    it('should create a tax configuration successfully', async () => {
      const service = createService();

      const result = await service.createConfiguration(createInput);

      expect(result.success).toBe(true);
      expect(result.configuration).toEqual(sampleTaxConfiguration);
      expect(result.message).toBe('Konfiguracja podatkowa została utworzona');
      expect(mockPrisma.taxConfiguration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientId: CLIENT_ID,
          organizationId: TEST_ORG_ID,
          vatStatus: 'active',
          vatPeriod: 'monthly',
          incomeTaxForm: 'CIT',
          createdBy: TEST_USER_ID,
        }),
      });
    });

    it('should throw error if client not found', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      const service = createService();

      await expect(service.createConfiguration(createInput)).rejects.toThrow(
        'Klient nie został znaleziony'
      );
    });

    it('should throw error if active configuration already exists', async () => {
      mockPrisma.taxConfiguration.findFirst.mockResolvedValue(sampleTaxConfiguration);
      const service = createService();

      await expect(service.createConfiguration(createInput)).rejects.toThrow(
        'Aktywna konfiguracja podatkowa już istnieje dla tego klienta'
      );
    });

    it('should throw error for quarterly VAT without small taxpayer status', async () => {
      const inputWithQuarterlyVat = {
        ...createInput,
        vatPeriod: 'quarterly' as const,
        isSmallTaxpayer: false,
      };
      // Client doesn't qualify as small taxpayer (high revenue)
      mockPrisma.journalEntry.aggregate.mockResolvedValue({ _sum: { credit: 15_000_000 } });
      const service = createService();

      await expect(service.createConfiguration(inputWithQuarterlyVat)).rejects.toThrow(
        'Klient nie kwalifikuje się do kwartalnego rozliczenia VAT'
      );
    });

    it('should allow quarterly VAT for small taxpayer', async () => {
      const inputWithQuarterlyVat = {
        ...createInput,
        vatPeriod: 'quarterly' as const,
        isSmallTaxpayer: true,
      };
      const service = createService();

      const result = await service.createConfiguration(inputWithQuarterlyVat);

      expect(result.success).toBe(true);
    });

    it('should throw error for Estonian CIT with ineligible client', async () => {
      const inputWithEstonianCit = {
        ...createInput,
        estonianCitEnabled: true,
      };
      // Client doesn't have valid legal form for Estonian CIT
      mockPrisma.client.findFirst.mockResolvedValue({
        ...sampleClient,
        legalForm: 'sole_proprietorship',
      });
      const service = createService();

      await expect(service.createConfiguration(inputWithEstonianCit)).rejects.toThrow(
        'Klient nie spełnia wymogów estońskiego CIT'
      );
    });

    it('should create audit entry on creation', async () => {
      const service = createService();

      await service.createConfiguration(createInput);

      expect(mockPrisma.taxConfigurationAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          configurationId: CONFIG_ID,
          clientId: CLIENT_ID,
          userId: TEST_USER_ID,
          action: 'CREATE',
        }),
      });
    });

    it('should log audit event on creation', async () => {
      const service = createService();

      await service.createConfiguration(createInput);

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tax_configuration_created',
          userId: TEST_USER_ID,
          organizationId: TEST_ORG_ID,
          resourceType: 'tax_configuration',
        })
      );
    });

    it('should invalidate cache on creation', async () => {
      mockRedis.keys.mockResolvedValue([`tax_config:${TEST_ORG_ID}:list`]);
      const service = createService();

      await service.createConfiguration(createInput);

      expect(mockRedis.keys).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // GET TAX CONFIGURATION
  // ===========================================================================

  describe('getConfiguration', () => {
    beforeEach(() => {
      mockPrisma.taxConfiguration.findUnique.mockResolvedValue(sampleTaxConfiguration);
    });

    it('should get configuration by id', async () => {
      const service = createService();

      const result = await service.getConfiguration({ id: CONFIG_ID, includeRepresentatives: false });

      expect(result).toEqual(sampleTaxConfiguration);
      expect(mockPrisma.taxConfiguration.findUnique).toHaveBeenCalledWith({
        where: { id: CONFIG_ID, organizationId: TEST_ORG_ID },
        include: { representatives: false },
      });
    });

    it('should include representatives when requested', async () => {
      mockPrisma.taxConfiguration.findUnique.mockResolvedValue({
        ...sampleTaxConfiguration,
        representatives: [sampleRepresentative],
      });
      const service = createService();

      const result = await service.getConfiguration({ id: CONFIG_ID, includeRepresentatives: true });

      expect(result?.representatives).toHaveLength(1);
      expect(mockPrisma.taxConfiguration.findUnique).toHaveBeenCalledWith({
        where: { id: CONFIG_ID, organizationId: TEST_ORG_ID },
        include: { representatives: { where: { isActive: true } } },
      });
    });

    it('should return null for non-existent configuration', async () => {
      mockPrisma.taxConfiguration.findUnique.mockResolvedValue(null);
      const service = createService();

      const result = await service.getConfiguration({ id: CONFIG_ID, includeRepresentatives: false });

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // GET TAX CONFIGURATION BY CLIENT
  // ===========================================================================

  describe('getConfigurationByClient', () => {
    beforeEach(() => {
      mockPrisma.taxConfiguration.findFirst.mockResolvedValue(sampleTaxConfiguration);
    });

    it('should get active configuration by client id', async () => {
      const service = createService();

      const result = await service.getConfigurationByClient({
        clientId: CLIENT_ID,
        includeRepresentatives: false,
        includeInactive: false,
      });

      expect(result).toEqual(sampleTaxConfiguration);
      expect(mockPrisma.taxConfiguration.findFirst).toHaveBeenCalledWith({
        where: {
          clientId: CLIENT_ID,
          organizationId: TEST_ORG_ID,
          isActive: true,
        },
        include: { representatives: false },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should include inactive configurations when requested', async () => {
      const service = createService();

      await service.getConfigurationByClient({
        clientId: CLIENT_ID,
        includeRepresentatives: false,
        includeInactive: true,
      });

      expect(mockPrisma.taxConfiguration.findFirst).toHaveBeenCalledWith({
        where: {
          clientId: CLIENT_ID,
          organizationId: TEST_ORG_ID,
        },
        include: { representatives: false },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  // ===========================================================================
  // LIST TAX CONFIGURATIONS
  // ===========================================================================

  describe('listConfigurations', () => {
    const listResult = [sampleTaxConfiguration];

    beforeEach(() => {
      mockPrisma.taxConfiguration.findMany.mockResolvedValue(listResult);
      mockPrisma.taxConfiguration.count.mockResolvedValue(1);
    });

    it('should list configurations with pagination', async () => {
      const service = createService();

      const result = await service.listConfigurations({
        limit: 20,
        offset: 0,
        includeRepresentatives: false,
      });

      expect(result.items).toEqual(listResult);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should filter by VAT status', async () => {
      const service = createService();

      await service.listConfigurations({
        vatStatus: 'active',
        limit: 20,
        offset: 0,
        includeRepresentatives: false,
      });

      expect(mockPrisma.taxConfiguration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ vatStatus: 'active' }),
        })
      );
    });

    it('should filter by income tax form', async () => {
      const service = createService();

      await service.listConfigurations({
        incomeTaxForm: 'CIT',
        limit: 20,
        offset: 0,
        includeRepresentatives: false,
      });

      expect(mockPrisma.taxConfiguration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ incomeTaxForm: 'CIT' }),
        })
      );
    });

    it('should filter by ZUS type', async () => {
      const service = createService();

      await service.listConfigurations({
        zusType: 'standard',
        limit: 20,
        offset: 0,
        includeRepresentatives: false,
      });

      expect(mockPrisma.taxConfiguration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ zusType: 'standard' }),
        })
      );
    });

    it('should filter by active status', async () => {
      const service = createService();

      await service.listConfigurations({
        isActive: true,
        limit: 20,
        offset: 0,
        includeRepresentatives: false,
      });

      expect(mockPrisma.taxConfiguration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      );
    });

    it('should search by client name or NIP', async () => {
      const service = createService();

      await service.listConfigurations({
        search: 'Test',
        limit: 20,
        offset: 0,
        includeRepresentatives: false,
      });

      expect(mockPrisma.taxConfiguration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            client: {
              OR: [
                { name: { contains: 'Test', mode: 'insensitive' } },
                { nip: { contains: 'Test' } },
              ],
            },
          }),
        })
      );
    });
  });

  // ===========================================================================
  // UPDATE TAX CONFIGURATION
  // ===========================================================================

  describe('updateConfiguration', () => {
    beforeEach(() => {
      mockPrisma.taxConfiguration.findUnique.mockResolvedValue(sampleTaxConfiguration);
      mockPrisma.taxConfiguration.update.mockResolvedValue({
        ...sampleTaxConfiguration,
        vatPeriod: 'quarterly',
      });
      mockPrisma.taxConfigurationAudit.create.mockResolvedValue({});
    });

    it('should update configuration successfully', async () => {
      const service = createService();

      const result = await service.updateConfiguration({
        id: CONFIG_ID,
        data: { vatPeriod: 'quarterly' },
        changeReason: 'Zmiana na mały podatnik',
      });

      expect(result.success).toBe(true);
      expect(result.configuration.vatPeriod).toBe('quarterly');
      expect(result.changedFields).toContain('vatPeriod');
    });

    it('should throw error if configuration not found', async () => {
      mockPrisma.taxConfiguration.findUnique.mockResolvedValue(null);
      const service = createService();

      await expect(
        service.updateConfiguration({
          id: CONFIG_ID,
          data: { vatPeriod: 'quarterly' },
        })
      ).rejects.toThrow('Konfiguracja podatkowa nie została znaleziona');
    });

    it('should create audit entries for each changed field', async () => {
      const service = createService();

      await service.updateConfiguration({
        id: CONFIG_ID,
        data: { vatPeriod: 'quarterly' },
        changeReason: 'Test reason',
      });

      expect(mockPrisma.taxConfigurationAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          configurationId: CONFIG_ID,
          action: 'UPDATE',
          fieldChanged: 'vatPeriod',
          oldValue: 'monthly',
          newValue: 'quarterly',
          changeReason: 'Test reason',
        }),
      });
    });

    it('should log audit event on update', async () => {
      const service = createService();

      await service.updateConfiguration({
        id: CONFIG_ID,
        data: { vatPeriod: 'quarterly' },
      });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tax_configuration_updated',
          resourceId: CONFIG_ID,
        })
      );
    });

    it('should invalidate cache on update', async () => {
      mockRedis.keys.mockResolvedValue([`tax_config:${TEST_ORG_ID}:${CONFIG_ID}`]);
      const service = createService();

      await service.updateConfiguration({
        id: CONFIG_ID,
        data: { vatPeriod: 'quarterly' },
      });

      expect(mockRedis.keys).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // DELETE TAX CONFIGURATION
  // ===========================================================================

  describe('deleteConfiguration', () => {
    beforeEach(() => {
      mockPrisma.taxConfiguration.findUnique.mockResolvedValue(sampleTaxConfiguration);
      mockPrisma.taxConfiguration.update.mockResolvedValue({
        ...sampleTaxConfiguration,
        isActive: false,
      });
      mockPrisma.taxConfiguration.delete.mockResolvedValue(sampleTaxConfiguration);
      mockPrisma.taxConfigurationAudit.create.mockResolvedValue({});
    });

    it('should soft delete configuration by default', async () => {
      const service = createService();

      const result = await service.deleteConfiguration({
        id: CONFIG_ID,
        reason: 'Zakończenie współpracy',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Konfiguracja podatkowa została dezaktywowana');
      expect(mockPrisma.taxConfiguration.update).toHaveBeenCalledWith({
        where: { id: CONFIG_ID },
        data: expect.objectContaining({
          isActive: false,
          updatedBy: TEST_USER_ID,
        }),
      });
      expect(mockPrisma.taxConfiguration.delete).not.toHaveBeenCalled();
    });

    it('should hard delete configuration when requested', async () => {
      const service = createService();

      const result = await service.deleteConfiguration({
        id: CONFIG_ID,
        reason: 'Usunięcie danych',
        hardDelete: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Konfiguracja podatkowa została usunięta');
      expect(mockPrisma.taxConfiguration.delete).toHaveBeenCalledWith({
        where: { id: CONFIG_ID },
      });
    });

    it('should throw error if configuration not found', async () => {
      mockPrisma.taxConfiguration.findUnique.mockResolvedValue(null);
      const service = createService();

      await expect(
        service.deleteConfiguration({ id: CONFIG_ID, reason: 'Test' })
      ).rejects.toThrow('Konfiguracja podatkowa nie została znaleziona');
    });

    it('should create audit entry on delete', async () => {
      const service = createService();

      await service.deleteConfiguration({
        id: CONFIG_ID,
        reason: 'Test reason',
      });

      expect(mockPrisma.taxConfigurationAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'DELETE',
          changeReason: 'Test reason',
        }),
      });
    });

    it('should log audit event on delete', async () => {
      const service = createService();

      await service.deleteConfiguration({ id: CONFIG_ID, reason: 'Test' });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tax_configuration_deleted',
        })
      );
    });
  });

  // ===========================================================================
  // TAX REPRESENTATIVES
  // ===========================================================================

  describe('addRepresentative', () => {
    const addInput = {
      clientId: CLIENT_ID,
      representativeNip: '9876543210',
      representativeName: 'Jan Kowalski',
      authorizationScope: ['VAT', 'CIT'] as const,
      upl1Reference: 'UPL-1/2024/001',
      validFrom: new Date('2024-01-01'),
    };

    beforeEach(() => {
      mockPrisma.client.findFirst.mockResolvedValue(sampleClient);
      mockPrisma.taxRepresentative.findFirst.mockResolvedValue(null);
      mockPrisma.taxRepresentative.create.mockResolvedValue(sampleRepresentative);
    });

    it('should add representative successfully', async () => {
      const service = createService();

      const result = await service.addRepresentative(addInput);

      expect(result.success).toBe(true);
      expect(result.representative).toEqual(sampleRepresentative);
      expect(result.message).toBe('Pełnomocnik został dodany');
    });

    it('should throw error if client not found', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      const service = createService();

      await expect(service.addRepresentative(addInput)).rejects.toThrow(
        'Klient nie został znaleziony'
      );
    });

    it('should throw error if representative with same NIP exists', async () => {
      mockPrisma.taxRepresentative.findFirst.mockResolvedValue(sampleRepresentative);
      const service = createService();

      await expect(service.addRepresentative(addInput)).rejects.toThrow(
        'Pełnomocnik o tym NIP już istnieje dla tego klienta'
      );
    });

    it('should log audit event on add', async () => {
      const service = createService();

      await service.addRepresentative(addInput);

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tax_representative_added',
          resourceType: 'tax_representative',
        })
      );
    });
  });

  describe('updateRepresentative', () => {
    beforeEach(() => {
      mockPrisma.taxRepresentative.findUnique.mockResolvedValue({
        ...sampleRepresentative,
        client: sampleClient,
      });
      mockPrisma.taxRepresentative.update.mockResolvedValue({
        ...sampleRepresentative,
        representativeName: 'Updated Name',
      });
    });

    it('should update representative successfully', async () => {
      const service = createService();

      const result = await service.updateRepresentative({
        id: REPRESENTATIVE_ID,
        data: { representativeName: 'Updated Name' },
      });

      expect(result.success).toBe(true);
      expect(result.representative.representativeName).toBe('Updated Name');
    });

    it('should throw error if representative not found', async () => {
      mockPrisma.taxRepresentative.findUnique.mockResolvedValue(null);
      const service = createService();

      await expect(
        service.updateRepresentative({
          id: REPRESENTATIVE_ID,
          data: { representativeName: 'Updated' },
        })
      ).rejects.toThrow('Pełnomocnik nie został znaleziony');
    });

    it('should throw error if representative belongs to different organization', async () => {
      mockPrisma.taxRepresentative.findUnique.mockResolvedValue({
        ...sampleRepresentative,
        client: { ...sampleClient, organizationId: 'different-org' },
      });
      const service = createService();

      await expect(
        service.updateRepresentative({
          id: REPRESENTATIVE_ID,
          data: { representativeName: 'Updated' },
        })
      ).rejects.toThrow('Pełnomocnik nie został znaleziony');
    });
  });

  describe('removeRepresentative', () => {
    beforeEach(() => {
      mockPrisma.taxRepresentative.findUnique.mockResolvedValue({
        ...sampleRepresentative,
        client: sampleClient,
      });
      mockPrisma.taxRepresentative.update.mockResolvedValue({
        ...sampleRepresentative,
        isActive: false,
      });
    });

    it('should remove (deactivate) representative successfully', async () => {
      const service = createService();

      const result = await service.removeRepresentative({
        id: REPRESENTATIVE_ID,
        reason: 'Zakończenie współpracy',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Pełnomocnik został usunięty');
      expect(mockPrisma.taxRepresentative.update).toHaveBeenCalledWith({
        where: { id: REPRESENTATIVE_ID },
        data: expect.objectContaining({
          isActive: false,
        }),
      });
    });

    it('should throw error if representative not found', async () => {
      mockPrisma.taxRepresentative.findUnique.mockResolvedValue(null);
      const service = createService();

      await expect(
        service.removeRepresentative({ id: REPRESENTATIVE_ID, reason: 'Test' })
      ).rejects.toThrow('Pełnomocnik nie został znaleziony');
    });
  });

  describe('listRepresentatives', () => {
    beforeEach(() => {
      mockPrisma.client.findFirst.mockResolvedValue(sampleClient);
      mockPrisma.taxRepresentative.findMany.mockResolvedValue([sampleRepresentative]);
    });

    it('should list active representatives for client', async () => {
      const service = createService();

      const result = await service.listRepresentatives({
        clientId: CLIENT_ID,
        includeInactive: false,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.taxRepresentative.findMany).toHaveBeenCalledWith({
        where: { clientId: CLIENT_ID, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should include inactive representatives when requested', async () => {
      const service = createService();

      await service.listRepresentatives({
        clientId: CLIENT_ID,
        includeInactive: true,
      });

      expect(mockPrisma.taxRepresentative.findMany).toHaveBeenCalledWith({
        where: { clientId: CLIENT_ID },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by authorization scope', async () => {
      const service = createService();

      await service.listRepresentatives({
        clientId: CLIENT_ID,
        scope: 'VAT',
        includeInactive: false,
      });

      expect(mockPrisma.taxRepresentative.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          authorizationScope: { has: 'VAT' },
        }),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw error if client not found', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      const service = createService();

      await expect(
        service.listRepresentatives({ clientId: CLIENT_ID, includeInactive: false })
      ).rejects.toThrow('Klient nie został znaleziony');
    });
  });

  // ===========================================================================
  // CONFIGURATION HISTORY
  // ===========================================================================

  describe('getConfigurationHistory', () => {
    beforeEach(() => {
      mockPrisma.taxConfiguration.findUnique.mockResolvedValue(sampleTaxConfiguration);
      mockPrisma.taxConfigurationAudit.findMany.mockResolvedValue([sampleAuditEntry]);
      mockPrisma.taxConfigurationAudit.count.mockResolvedValue(1);
    });

    it('should get configuration history', async () => {
      const service = createService();

      const result = await service.getConfigurationHistory({
        configurationId: CONFIG_ID,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].action).toBe('UPDATE');
      expect(result.items[0].fieldChanged).toBe('vatPeriod');
      expect(result.total).toBe(1);
    });

    it('should throw error if configuration not found', async () => {
      mockPrisma.taxConfiguration.findUnique.mockResolvedValue(null);
      const service = createService();

      await expect(
        service.getConfigurationHistory({ configurationId: CONFIG_ID, limit: 20 })
      ).rejects.toThrow('Konfiguracja podatkowa nie została znaleziona');
    });

    it('should filter by date range', async () => {
      const service = createService();
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await service.getConfigurationHistory({
        configurationId: CONFIG_ID,
        startDate,
        endDate,
        limit: 20,
      });

      expect(mockPrisma.taxConfigurationAudit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: startDate, lte: endDate },
          }),
        })
      );
    });

    it('should filter by field name', async () => {
      const service = createService();

      await service.getConfigurationHistory({
        configurationId: CONFIG_ID,
        fieldName: 'vatPeriod',
        limit: 20,
      });

      expect(mockPrisma.taxConfigurationAudit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fieldChanged: 'vatPeriod',
          }),
        })
      );
    });

    it('should filter by action type', async () => {
      const service = createService();

      await service.getConfigurationHistory({
        configurationId: CONFIG_ID,
        action: 'UPDATE',
        limit: 20,
      });

      expect(mockPrisma.taxConfigurationAudit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: 'UPDATE',
          }),
        })
      );
    });

    it('should support cursor-based pagination', async () => {
      mockPrisma.taxConfigurationAudit.findMany.mockResolvedValue([
        sampleAuditEntry,
        { ...sampleAuditEntry, id: 'next-id' },
      ]);
      const service = createService();

      const result = await service.getConfigurationHistory({
        configurationId: CONFIG_ID,
        limit: 1,
      });

      expect(result.nextCursor).toBe('next-id');
    });
  });

  // ===========================================================================
  // RESTORE CONFIGURATION
  // ===========================================================================

  describe('restoreConfiguration', () => {
    beforeEach(() => {
      mockPrisma.taxConfiguration.findUnique.mockResolvedValue(sampleTaxConfiguration);
      mockPrisma.taxConfigurationAudit.findUnique.mockResolvedValue(sampleAuditEntry);
      mockPrisma.taxConfiguration.update.mockResolvedValue({
        ...sampleTaxConfiguration,
        vatPeriod: 'monthly', // restored value
      });
      mockPrisma.taxConfigurationAudit.create.mockResolvedValue({});
    });

    it('should restore configuration field from history', async () => {
      const service = createService();

      const result = await service.restoreConfiguration({
        configurationId: CONFIG_ID,
        auditEntryId: AUDIT_ENTRY_ID,
        restoreReason: 'Błędna zmiana',
      });

      expect(result.success).toBe(true);
      expect(result.restoredField).toBe('vatPeriod');
      expect(result.message).toContain('vatPeriod');
    });

    it('should throw error if configuration not found', async () => {
      mockPrisma.taxConfiguration.findUnique.mockResolvedValue(null);
      const service = createService();

      await expect(
        service.restoreConfiguration({
          configurationId: CONFIG_ID,
          auditEntryId: AUDIT_ENTRY_ID,
          restoreReason: 'Test',
        })
      ).rejects.toThrow('Konfiguracja podatkowa nie została znaleziona');
    });

    it('should throw error if audit entry not found', async () => {
      mockPrisma.taxConfigurationAudit.findUnique.mockResolvedValue(null);
      const service = createService();

      await expect(
        service.restoreConfiguration({
          configurationId: CONFIG_ID,
          auditEntryId: AUDIT_ENTRY_ID,
          restoreReason: 'Test',
        })
      ).rejects.toThrow('Wpis audytu nie został znaleziony');
    });

    it('should throw error if audit entry has no field changed', async () => {
      mockPrisma.taxConfigurationAudit.findUnique.mockResolvedValue({
        ...sampleAuditEntry,
        fieldChanged: null,
      });
      const service = createService();

      await expect(
        service.restoreConfiguration({
          configurationId: CONFIG_ID,
          auditEntryId: AUDIT_ENTRY_ID,
          restoreReason: 'Test',
        })
      ).rejects.toThrow('Nie można przywrócić wpisu bez określonego pola');
    });

    it('should create restore audit entry', async () => {
      const service = createService();

      await service.restoreConfiguration({
        configurationId: CONFIG_ID,
        auditEntryId: AUDIT_ENTRY_ID,
        restoreReason: 'Błędna zmiana',
      });

      expect(mockPrisma.taxConfigurationAudit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'RESTORE',
          changeReason: 'Błędna zmiana',
        }),
      });
    });

    it('should log audit event on restore', async () => {
      const service = createService();

      await service.restoreConfiguration({
        configurationId: CONFIG_ID,
        auditEntryId: AUDIT_ENTRY_ID,
        restoreReason: 'Test',
      });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tax_configuration_restored',
        })
      );
    });
  });

  // ===========================================================================
  // VALIDATE CONFIGURATION
  // ===========================================================================

  describe('validateConfiguration', () => {
    beforeEach(() => {
      mockPrisma.client.findFirst.mockResolvedValue(sampleClient);
      mockPrisma.journalEntry.aggregate.mockResolvedValue({ _sum: { credit: 0 } });
    });

    it('should validate valid configuration', async () => {
      const service = createService();

      const result = await service.validateConfiguration({
        clientId: CLIENT_ID,
        data: {
          vatStatus: 'active',
          vatPeriod: 'monthly',
          incomeTaxForm: 'CIT',
        },
      });

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should return error if client not found', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      const service = createService();

      const result = await service.validateConfiguration({
        clientId: CLIENT_ID,
        data: { vatStatus: 'active', incomeTaxForm: 'CIT' },
      });

      expect(result.isValid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: 'clientId',
          severity: 'error',
        })
      );
    });

    it('should require VAT period for active VAT status', async () => {
      const service = createService();

      const result = await service.validateConfiguration({
        clientId: CLIENT_ID,
        data: {
          vatStatus: 'active',
          // vatPeriod is missing
          incomeTaxForm: 'CIT',
        },
      });

      expect(result.isValid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: 'vatPeriod',
          severity: 'error',
        })
      );
    });

    it('should require exemption reason for VAT exempt status', async () => {
      const service = createService();

      const result = await service.validateConfiguration({
        clientId: CLIENT_ID,
        data: {
          vatStatus: 'exempt',
          // vatExemptionReason is missing
          incomeTaxForm: 'CIT',
        },
      });

      expect(result.isValid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: 'vatExemptionReason',
          severity: 'error',
        })
      );
    });

    it('should require PIT tax option for PIT income tax form', async () => {
      const service = createService();

      const result = await service.validateConfiguration({
        clientId: CLIENT_ID,
        data: {
          vatStatus: 'not_registered',
          incomeTaxForm: 'PIT',
          // pitTaxOption is missing
        },
      });

      expect(result.isValid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: 'pitTaxOption',
          severity: 'error',
        })
      );
    });

    it('should validate Estonian CIT only for CIT form', async () => {
      const service = createService();

      const result = await service.validateConfiguration({
        clientId: CLIENT_ID,
        data: {
          vatStatus: 'active',
          vatPeriod: 'monthly',
          incomeTaxForm: 'PIT',
          pitTaxOption: 'progressive',
          estonianCitEnabled: true,
        },
      });

      expect(result.isValid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: 'estonianCitEnabled',
          message: 'Estoński CIT dostępny tylko dla podatników CIT',
          severity: 'error',
        })
      );
    });

    it('should warn about ZUS ulga expiry date', async () => {
      const service = createService();

      const result = await service.validateConfiguration({
        clientId: CLIENT_ID,
        data: {
          vatStatus: 'active',
          vatPeriod: 'monthly',
          incomeTaxForm: 'CIT',
          zusType: 'ulga_na_start',
          // zusUlgaExpiryDate is missing
        },
      });

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: 'zusUlgaExpiryDate',
          severity: 'warning',
        })
      );
    });

    it('should warn about automatic submission with approval required', async () => {
      const service = createService();

      const result = await service.validateConfiguration({
        clientId: CLIENT_ID,
        data: {
          vatStatus: 'active',
          vatPeriod: 'monthly',
          incomeTaxForm: 'CIT',
          submissionMethod: 'automatic',
          approvalRequired: true,
        },
      });

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          field: 'submissionMethod',
          severity: 'warning',
        })
      );
    });
  });

  // ===========================================================================
  // CHECK SMALL TAXPAYER STATUS
  // ===========================================================================

  describe('checkSmallTaxpayerStatus', () => {
    beforeEach(() => {
      mockPrisma.client.findFirst.mockResolvedValue(sampleClient);
    });

    it('should return eligible for low revenue', async () => {
      mockPrisma.journalEntry.aggregate.mockResolvedValue({
        _sum: { credit: 5_000_000 }, // 5M PLN < 9.218M PLN threshold
      });
      const service = createService();

      const result = await service.checkSmallTaxpayerStatus({ clientId: CLIENT_ID });

      expect(result.isEligible).toBe(true);
      expect(result.revenue).toBe(5_000_000);
      expect(result.threshold).toBe(9_218_000);
      expect(result.currency).toBe('PLN');
      expect(result.message).toContain('kwalifikuje się');
    });

    it('should return not eligible for high revenue', async () => {
      mockPrisma.journalEntry.aggregate.mockResolvedValue({
        _sum: { credit: 15_000_000 }, // 15M PLN > 9.218M PLN threshold
      });
      const service = createService();

      const result = await service.checkSmallTaxpayerStatus({ clientId: CLIENT_ID });

      expect(result.isEligible).toBe(false);
      expect(result.revenue).toBe(15_000_000);
      expect(result.message).toContain('nie kwalifikuje się');
    });

    it('should check for specified year', async () => {
      mockPrisma.journalEntry.aggregate.mockResolvedValue({ _sum: { credit: 0 } });
      const service = createService();

      const result = await service.checkSmallTaxpayerStatus({
        clientId: CLIENT_ID,
        year: 2023,
      });

      expect(result.year).toBe(2023);
    });

    it('should throw error if client not found', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      const service = createService();

      await expect(
        service.checkSmallTaxpayerStatus({ clientId: CLIENT_ID })
      ).rejects.toThrow('Klient nie został znaleziony');
    });
  });

  // ===========================================================================
  // CHECK ESTONIAN CIT ELIGIBILITY
  // ===========================================================================

  describe('checkEstonianCitEligibility', () => {
    beforeEach(() => {
      mockPrisma.client.findFirst.mockResolvedValue(sampleClient);
    });

    it('should return eligible for sp. z o.o.', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        ...sampleClient,
        legalForm: 'sp_zoo',
      });
      const service = createService();

      const result = await service.checkEstonianCitEligibility({ clientId: CLIENT_ID });

      expect(result.requirements.isPolishCompany).toBe(true);
      expect(result.legalForm).toBe('sp_zoo');
    });

    it('should return not eligible for sole proprietorship', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        ...sampleClient,
        legalForm: 'sole_proprietorship',
      });
      const service = createService();

      const result = await service.checkEstonianCitEligibility({ clientId: CLIENT_ID });

      expect(result.requirements.isPolishCompany).toBe(false);
      expect(result.isEligible).toBe(false);
      expect(result.message).toContain('nie spełnia');
    });

    it('should return eligible for S.A.', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        ...sampleClient,
        legalForm: 'sa',
      });
      const service = createService();

      const result = await service.checkEstonianCitEligibility({ clientId: CLIENT_ID });

      expect(result.requirements.isPolishCompany).toBe(true);
    });

    it('should throw error if client not found', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      const service = createService();

      await expect(
        service.checkEstonianCitEligibility({ clientId: CLIENT_ID })
      ).rejects.toThrow('Klient nie został znaleziony');
    });
  });

  // ===========================================================================
  // CACHE INVALIDATION
  // ===========================================================================

  describe('cache invalidation', () => {
    beforeEach(() => {
      mockPrisma.client.findFirst.mockResolvedValue(sampleClient);
      mockPrisma.taxConfiguration.findFirst.mockResolvedValue(null);
      mockPrisma.taxConfiguration.create.mockResolvedValue(sampleTaxConfiguration);
      mockPrisma.taxConfigurationAudit.create.mockResolvedValue({});
      mockPrisma.journalEntry.aggregate.mockResolvedValue({ _sum: { credit: 0 } });
    });

    it('should invalidate cache on create', async () => {
      mockRedis.keys.mockResolvedValue([`tax_config:${TEST_ORG_ID}:list`]);
      const service = createService();

      await service.createConfiguration({
        clientId: CLIENT_ID,
        vatStatus: 'active',
        vatPeriod: 'monthly',
        incomeTaxForm: 'CIT',
      });

      expect(mockRedis.keys).toHaveBeenCalledWith(`tax_config:${TEST_ORG_ID}:*`);
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should not call del if no cache keys found', async () => {
      mockRedis.keys.mockResolvedValue([]);
      const service = createService();

      await service.createConfiguration({
        clientId: CLIENT_ID,
        vatStatus: 'active',
        vatPeriod: 'monthly',
        incomeTaxForm: 'CIT',
      });

      expect(mockRedis.keys).toHaveBeenCalled();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });
});
