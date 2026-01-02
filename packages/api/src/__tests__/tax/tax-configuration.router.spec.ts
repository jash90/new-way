import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appRouter } from '../../index';

// ===========================================================================
// MOCKS
// ===========================================================================

const mocks = vi.hoisted(() => ({
  createConfiguration: vi.fn(),
  getConfiguration: vi.fn(),
  getConfigurationByClient: vi.fn(),
  listConfigurations: vi.fn(),
  updateConfiguration: vi.fn(),
  deleteConfiguration: vi.fn(),
  addRepresentative: vi.fn(),
  updateRepresentative: vi.fn(),
  removeRepresentative: vi.fn(),
  listRepresentatives: vi.fn(),
  getConfigurationHistory: vi.fn(),
  restoreConfiguration: vi.fn(),
  validateConfiguration: vi.fn(),
  checkSmallTaxpayerStatus: vi.fn(),
  checkEstonianCitEligibility: vi.fn(),
}));

vi.mock('../../services/tax/tax-configuration.service', () => ({
  TaxConfigurationService: vi.fn().mockImplementation(() => mocks),
}));

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_ORG_ID = '22222222-2222-2222-2222-222222222222';
const CONFIG_ID = '33333333-3333-3333-3333-333333333333';
const CLIENT_ID = '44444444-4444-4444-4444-444444444444';
const REPRESENTATIVE_ID = '55555555-5555-5555-5555-555555555555';
const AUDIT_ENTRY_ID = '66666666-6666-6666-6666-666666666666';

const createAuthenticatedContext = () => ({
  session: {
    userId: TEST_USER_ID,
    organizationId: TEST_ORG_ID,
    email: 'test@example.com',
    role: 'user',
  },
  prisma: {} as any,
  redis: {} as any,
  auditLogger: { log: vi.fn() } as any,
});

const createUnauthenticatedContext = () => ({
  session: null,
  prisma: {} as any,
  redis: {} as any,
  auditLogger: { log: vi.fn() } as any,
});

const sampleTaxConfiguration = {
  id: CONFIG_ID,
  clientId: CLIENT_ID,
  organizationId: TEST_ORG_ID,
  vatStatus: 'active' as const,
  vatPeriod: 'monthly' as const,
  vatExemptionReason: null,
  vatRegistrationDate: new Date('2020-01-01'),
  incomeTaxForm: 'CIT' as const,
  incomeTaxRate: 19,
  isSmallTaxpayer: false,
  estonianCitEnabled: false,
  estonianCitStartDate: null,
  pitTaxOption: null,
  accountingYearStart: '01-01',
  zusType: 'standard' as const,
  zusContributionBase: null,
  zusAccidentRate: 1.67,
  zusFpEnabled: true,
  zusFgspEnabled: true,
  zusUlgaExpiryDate: null,
  submissionMethod: 'automatic' as const,
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

describe('TaxConfigurationRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // AUTHENTICATION
  // ===========================================================================

  describe('authentication', () => {
    it('should reject unauthenticated requests', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.tax.configuration.get({ id: CONFIG_ID, includeRepresentatives: false })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // CREATE CONFIGURATION
  // ===========================================================================

  describe('create', () => {
    const createResult = {
      success: true,
      configuration: sampleTaxConfiguration,
      message: 'Konfiguracja podatkowa została utworzona',
    };

    beforeEach(() => {
      mocks.createConfiguration.mockResolvedValue(createResult);
    });

    it('should create tax configuration', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.create({
        clientId: CLIENT_ID,
        vatStatus: 'active',
        vatPeriod: 'monthly',
        incomeTaxForm: 'CIT',
      });

      expect(result.success).toBe(true);
      expect(result.configuration).toEqual(sampleTaxConfiguration);
      expect(mocks.createConfiguration).toHaveBeenCalled();
    });

    it('should create configuration with all VAT options', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.configuration.create({
        clientId: CLIENT_ID,
        vatStatus: 'active',
        vatPeriod: 'quarterly',
        vatRegistrationDate: new Date('2020-01-01'),
        isSmallTaxpayer: true,
        incomeTaxForm: 'CIT',
      });

      expect(mocks.createConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({
          vatPeriod: 'quarterly',
          isSmallTaxpayer: true,
        })
      );
    });

    it('should create configuration with Estonian CIT', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.configuration.create({
        clientId: CLIENT_ID,
        vatStatus: 'active',
        vatPeriod: 'monthly',
        incomeTaxForm: 'CIT',
        estonianCitEnabled: true,
        estonianCitStartDate: new Date('2024-01-01'),
      });

      expect(mocks.createConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({
          estonianCitEnabled: true,
        })
      );
    });

    it('should create configuration with ZUS settings', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.configuration.create({
        clientId: CLIENT_ID,
        vatStatus: 'not_registered',
        incomeTaxForm: 'PIT',
        pitTaxOption: 'progressive',
        zusType: 'preferential',
        zusFpEnabled: false,
        zusFgspEnabled: false,
      });

      expect(mocks.createConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({
          zusType: 'preferential',
          zusFpEnabled: false,
        })
      );
    });

    it('should validate client ID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.create({
          clientId: 'invalid-uuid',
          vatStatus: 'active',
          vatPeriod: 'monthly',
          incomeTaxForm: 'CIT',
        })
      ).rejects.toThrow();
    });

    it('should validate VAT status enum', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.create({
          clientId: CLIENT_ID,
          vatStatus: 'unknown_status' as any,
          incomeTaxForm: 'CIT',
        })
      ).rejects.toThrow();
    });

    it('should validate income tax form enum', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.create({
          clientId: CLIENT_ID,
          vatStatus: 'active',
          vatPeriod: 'monthly',
          incomeTaxForm: 'INVALID' as any,
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // GET CONFIGURATION
  // ===========================================================================

  describe('get', () => {
    beforeEach(() => {
      mocks.getConfiguration.mockResolvedValue(sampleTaxConfiguration);
    });

    it('should get configuration by id', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.get({ id: CONFIG_ID, includeRepresentatives: false });

      expect(result).toEqual(sampleTaxConfiguration);
      expect(mocks.getConfiguration).toHaveBeenCalledWith({ id: CONFIG_ID, includeRepresentatives: false });
    });

    it('should get configuration with representatives', async () => {
      const configWithReps = {
        ...sampleTaxConfiguration,
        representatives: [sampleRepresentative],
      };
      mocks.getConfiguration.mockResolvedValue(configWithReps);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.get({ id: CONFIG_ID, includeRepresentatives: true });

      expect(result.representatives).toHaveLength(1);
      expect(mocks.getConfiguration).toHaveBeenCalledWith({ id: CONFIG_ID, includeRepresentatives: true });
    });

    it('should return null for non-existent configuration', async () => {
      mocks.getConfiguration.mockResolvedValue(null);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.get({ id: CONFIG_ID, includeRepresentatives: false });

      expect(result).toBeNull();
    });

    it('should validate UUID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.get({ id: 'invalid-uuid', includeRepresentatives: false })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // GET BY CLIENT
  // ===========================================================================

  describe('getByClient', () => {
    beforeEach(() => {
      mocks.getConfigurationByClient.mockResolvedValue(sampleTaxConfiguration);
    });

    it('should get configuration by client id', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.getByClient({
        clientId: CLIENT_ID,
        includeRepresentatives: false,
        includeInactive: false,
      });

      expect(result).toEqual(sampleTaxConfiguration);
      expect(mocks.getConfigurationByClient).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        includeRepresentatives: false,
        includeInactive: false,
      });
    });

    it('should include inactive when requested', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.configuration.getByClient({
        clientId: CLIENT_ID,
        includeRepresentatives: false,
        includeInactive: true,
      });

      expect(mocks.getConfigurationByClient).toHaveBeenCalledWith(
        expect.objectContaining({ includeInactive: true })
      );
    });

    it('should validate client ID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.getByClient({
          clientId: 'invalid-uuid',
          includeRepresentatives: false,
          includeInactive: false,
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // LIST CONFIGURATIONS
  // ===========================================================================

  describe('list', () => {
    const listResult = {
      items: [sampleTaxConfiguration],
      total: 1,
      limit: 20,
      offset: 0,
    };

    beforeEach(() => {
      mocks.listConfigurations.mockResolvedValue(listResult);
    });

    it('should list configurations', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.list({
        limit: 20,
        offset: 0,
        includeRepresentatives: false,
      });

      expect(result).toEqual(listResult);
      expect(mocks.listConfigurations).toHaveBeenCalled();
    });

    it('should filter by VAT status', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.configuration.list({
        vatStatus: 'active',
        limit: 20,
        offset: 0,
        includeRepresentatives: false,
      });

      expect(mocks.listConfigurations).toHaveBeenCalledWith(
        expect.objectContaining({ vatStatus: 'active' })
      );
    });

    it('should filter by income tax form', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.configuration.list({
        incomeTaxForm: 'CIT',
        limit: 20,
        offset: 0,
        includeRepresentatives: false,
      });

      expect(mocks.listConfigurations).toHaveBeenCalledWith(
        expect.objectContaining({ incomeTaxForm: 'CIT' })
      );
    });

    it('should filter by ZUS type', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.configuration.list({
        zusType: 'standard',
        limit: 20,
        offset: 0,
        includeRepresentatives: false,
      });

      expect(mocks.listConfigurations).toHaveBeenCalledWith(
        expect.objectContaining({ zusType: 'standard' })
      );
    });

    it('should support search parameter', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.configuration.list({
        search: 'Test Company',
        limit: 20,
        offset: 0,
        includeRepresentatives: false,
      });

      expect(mocks.listConfigurations).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Test Company' })
      );
    });

    it('should validate limit range', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.list({ limit: 0, offset: 0, includeRepresentatives: false })
      ).rejects.toThrow();

      await expect(
        caller.tax.configuration.list({ limit: 101, offset: 0, includeRepresentatives: false })
      ).rejects.toThrow();
    });

    it('should validate offset range', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.list({ limit: 20, offset: -1, includeRepresentatives: false })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // UPDATE CONFIGURATION
  // ===========================================================================

  describe('update', () => {
    const updateResult = {
      success: true,
      configuration: { ...sampleTaxConfiguration, vatPeriod: 'quarterly' as const },
      changedFields: ['vatPeriod'],
      message: 'Konfiguracja podatkowa została zaktualizowana',
    };

    beforeEach(() => {
      mocks.updateConfiguration.mockResolvedValue(updateResult);
    });

    it('should update configuration', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.update({
        id: CONFIG_ID,
        data: { vatPeriod: 'quarterly' },
      });

      expect(result.success).toBe(true);
      expect(result.changedFields).toContain('vatPeriod');
      expect(mocks.updateConfiguration).toHaveBeenCalled();
    });

    it('should include change reason', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.configuration.update({
        id: CONFIG_ID,
        data: { vatPeriod: 'quarterly' },
        changeReason: 'Zmiana na mały podatnik',
      });

      expect(mocks.updateConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({ changeReason: 'Zmiana na mały podatnik' })
      );
    });

    it('should validate UUID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.update({
          id: 'invalid-uuid',
          data: { vatPeriod: 'quarterly' },
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // DELETE CONFIGURATION
  // ===========================================================================

  describe('delete', () => {
    const deleteResult = {
      success: true,
      message: 'Konfiguracja podatkowa została dezaktywowana',
    };

    beforeEach(() => {
      mocks.deleteConfiguration.mockResolvedValue(deleteResult);
    });

    it('should soft delete configuration', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.delete({
        id: CONFIG_ID,
        reason: 'Zakończenie współpracy',
      });

      expect(result.success).toBe(true);
      expect(mocks.deleteConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({ id: CONFIG_ID, reason: 'Zakończenie współpracy' })
      );
    });

    it('should hard delete when requested', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.configuration.delete({
        id: CONFIG_ID,
        reason: 'Usunięcie danych',
        hardDelete: true,
      });

      expect(mocks.deleteConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({ hardDelete: true })
      );
    });

    it('should require reason', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.delete({
          id: CONFIG_ID,
          reason: '', // Empty reason
        })
      ).rejects.toThrow();
    });

    it('should validate UUID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.delete({
          id: 'invalid-uuid',
          reason: 'Test',
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // TAX REPRESENTATIVES
  // ===========================================================================

  describe('addRepresentative', () => {
    const addResult = {
      success: true,
      representative: sampleRepresentative,
      message: 'Pełnomocnik został dodany',
    };

    beforeEach(() => {
      mocks.addRepresentative.mockResolvedValue(addResult);
    });

    it('should add representative', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.addRepresentative({
        clientId: CLIENT_ID,
        representativeNip: '9876543210',
        representativeName: 'Jan Kowalski',
        authorizationScope: ['VAT', 'CIT'],
        validFrom: new Date('2024-01-01'),
      });

      expect(result.success).toBe(true);
      expect(result.representative).toEqual(sampleRepresentative);
      expect(mocks.addRepresentative).toHaveBeenCalled();
    });

    it('should add representative with UPL-1 reference', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.configuration.addRepresentative({
        clientId: CLIENT_ID,
        representativeNip: '9876543210',
        representativeName: 'Jan Kowalski',
        authorizationScope: ['VAT'],
        upl1Reference: 'UPL-1/2024/001',
        validFrom: new Date('2024-01-01'),
      });

      expect(mocks.addRepresentative).toHaveBeenCalledWith(
        expect.objectContaining({ upl1Reference: 'UPL-1/2024/001' })
      );
    });

    it('should validate NIP format (10 digits)', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.addRepresentative({
          clientId: CLIENT_ID,
          representativeNip: '12345', // Too short
          representativeName: 'Jan Kowalski',
          authorizationScope: ['VAT'],
          validFrom: new Date('2024-01-01'),
        })
      ).rejects.toThrow();
    });

    it('should validate authorization scope enum', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.addRepresentative({
          clientId: CLIENT_ID,
          representativeNip: '9876543210',
          representativeName: 'Jan Kowalski',
          authorizationScope: ['INVALID' as any],
          validFrom: new Date('2024-01-01'),
        })
      ).rejects.toThrow();
    });
  });

  describe('updateRepresentative', () => {
    const updateResult = {
      success: true,
      representative: { ...sampleRepresentative, representativeName: 'Updated Name' },
      message: 'Pełnomocnik został zaktualizowany',
    };

    beforeEach(() => {
      mocks.updateRepresentative.mockResolvedValue(updateResult);
    });

    it('should update representative', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.updateRepresentative({
        id: REPRESENTATIVE_ID,
        data: { representativeName: 'Updated Name' },
      });

      expect(result.success).toBe(true);
      expect(result.representative.representativeName).toBe('Updated Name');
    });

    it('should validate UUID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.updateRepresentative({
          id: 'invalid-uuid',
          data: { representativeName: 'Test' },
        })
      ).rejects.toThrow();
    });
  });

  describe('removeRepresentative', () => {
    const removeResult = {
      success: true,
      message: 'Pełnomocnik został usunięty',
    };

    beforeEach(() => {
      mocks.removeRepresentative.mockResolvedValue(removeResult);
    });

    it('should remove representative', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.removeRepresentative({
        id: REPRESENTATIVE_ID,
        reason: 'Zakończenie współpracy',
      });

      expect(result.success).toBe(true);
      expect(mocks.removeRepresentative).toHaveBeenCalledWith({
        id: REPRESENTATIVE_ID,
        reason: 'Zakończenie współpracy',
      });
    });

    it('should validate UUID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.removeRepresentative({
          id: 'invalid-uuid',
          reason: 'Test',
        })
      ).rejects.toThrow();
    });
  });

  describe('listRepresentatives', () => {
    const listResult = {
      items: [sampleRepresentative],
      total: 1,
    };

    beforeEach(() => {
      mocks.listRepresentatives.mockResolvedValue(listResult);
    });

    it('should list representatives', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.listRepresentatives({
        clientId: CLIENT_ID,
        includeInactive: false,
      });

      expect(result).toEqual(listResult);
      expect(mocks.listRepresentatives).toHaveBeenCalled();
    });

    it('should filter by scope', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.configuration.listRepresentatives({
        clientId: CLIENT_ID,
        scope: 'VAT',
        includeInactive: false,
      });

      expect(mocks.listRepresentatives).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'VAT' })
      );
    });

    it('should validate client ID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.listRepresentatives({
          clientId: 'invalid-uuid',
          includeInactive: false,
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // CONFIGURATION HISTORY
  // ===========================================================================

  describe('getHistory', () => {
    const historyResult = {
      items: [
        {
          id: AUDIT_ENTRY_ID,
          action: 'UPDATE' as const,
          fieldChanged: 'vatPeriod',
          oldValue: 'monthly',
          newValue: 'quarterly',
          changeReason: 'Zmiana na mały podatnik',
          userName: 'Test User',
          userEmail: 'user@example.com',
          createdAt: new Date('2024-06-01'),
        },
      ],
      nextCursor: null,
      total: 1,
    };

    beforeEach(() => {
      mocks.getConfigurationHistory.mockResolvedValue(historyResult);
    });

    it('should get configuration history', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.getHistory({
        configurationId: CONFIG_ID,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].fieldChanged).toBe('vatPeriod');
      expect(mocks.getConfigurationHistory).toHaveBeenCalled();
    });

    it('should filter by date range', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await caller.tax.configuration.getHistory({
        configurationId: CONFIG_ID,
        startDate,
        endDate,
        limit: 20,
      });

      expect(mocks.getConfigurationHistory).toHaveBeenCalledWith(
        expect.objectContaining({ startDate, endDate })
      );
    });

    it('should filter by field name', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.configuration.getHistory({
        configurationId: CONFIG_ID,
        fieldName: 'vatPeriod',
        limit: 20,
      });

      expect(mocks.getConfigurationHistory).toHaveBeenCalledWith(
        expect.objectContaining({ fieldName: 'vatPeriod' })
      );
    });

    it('should filter by action type', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.configuration.getHistory({
        configurationId: CONFIG_ID,
        action: 'UPDATE',
        limit: 20,
      });

      expect(mocks.getConfigurationHistory).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE' })
      );
    });

    it('should support cursor pagination', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());
      const cursorId = '77777777-7777-7777-7777-777777777777';

      await caller.tax.configuration.getHistory({
        configurationId: CONFIG_ID,
        cursor: cursorId,
        limit: 20,
      });

      expect(mocks.getConfigurationHistory).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: cursorId })
      );
    });

    it('should validate configuration ID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.getHistory({
          configurationId: 'invalid-uuid',
          limit: 20,
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // RESTORE CONFIGURATION
  // ===========================================================================

  describe('restore', () => {
    const restoreResult = {
      success: true,
      configuration: sampleTaxConfiguration,
      restoredField: 'vatPeriod',
      message: 'Pole vatPeriod zostało przywrócone',
    };

    beforeEach(() => {
      mocks.restoreConfiguration.mockResolvedValue(restoreResult);
    });

    it('should restore configuration field', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.restore({
        configurationId: CONFIG_ID,
        auditEntryId: AUDIT_ENTRY_ID,
        restoreReason: 'Błędna zmiana',
      });

      expect(result.success).toBe(true);
      expect(result.restoredField).toBe('vatPeriod');
      expect(mocks.restoreConfiguration).toHaveBeenCalled();
    });

    it('should require restore reason', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.restore({
          configurationId: CONFIG_ID,
          auditEntryId: AUDIT_ENTRY_ID,
          restoreReason: '', // Empty reason
        })
      ).rejects.toThrow();
    });

    it('should validate UUID formats', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.restore({
          configurationId: 'invalid-uuid',
          auditEntryId: AUDIT_ENTRY_ID,
          restoreReason: 'Test',
        })
      ).rejects.toThrow();

      await expect(
        caller.tax.configuration.restore({
          configurationId: CONFIG_ID,
          auditEntryId: 'invalid-uuid',
          restoreReason: 'Test',
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  describe('validate', () => {
    const validResult = {
      isValid: true,
      issues: [],
    };

    beforeEach(() => {
      mocks.validateConfiguration.mockResolvedValue(validResult);
    });

    it('should validate configuration', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.validate({
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

    it('should return validation issues', async () => {
      const invalidResult = {
        isValid: false,
        issues: [
          {
            field: 'vatPeriod',
            message: 'Okres rozliczeniowy VAT jest wymagany dla czynnych podatników VAT',
            severity: 'error' as const,
          },
        ],
      };
      mocks.validateConfiguration.mockResolvedValue(invalidResult);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.validate({
        clientId: CLIENT_ID,
        data: {
          vatStatus: 'active',
          incomeTaxForm: 'CIT',
        },
      });

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
    });

    it('should validate client ID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.validate({
          clientId: 'invalid-uuid',
          data: { vatStatus: 'active', incomeTaxForm: 'CIT' },
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // CHECK SMALL TAXPAYER STATUS
  // ===========================================================================

  describe('checkSmallTaxpayerStatus', () => {
    const eligibleResult = {
      isEligible: true,
      revenue: 5000000,
      threshold: 9218000,
      currency: 'PLN',
      year: 2023,
      message: 'Klient kwalifikuje się jako mały podatnik',
    };

    beforeEach(() => {
      mocks.checkSmallTaxpayerStatus.mockResolvedValue(eligibleResult);
    });

    it('should check small taxpayer status', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.checkSmallTaxpayerStatus({
        clientId: CLIENT_ID,
      });

      expect(result.isEligible).toBe(true);
      expect(result.revenue).toBe(5000000);
      expect(result.threshold).toBe(9218000);
    });

    it('should check for specific year', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.tax.configuration.checkSmallTaxpayerStatus({
        clientId: CLIENT_ID,
        year: 2022,
      });

      expect(mocks.checkSmallTaxpayerStatus).toHaveBeenCalledWith(
        expect.objectContaining({ year: 2022 })
      );
    });

    it('should validate client ID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.checkSmallTaxpayerStatus({
          clientId: 'invalid-uuid',
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // CHECK ESTONIAN CIT ELIGIBILITY
  // ===========================================================================

  describe('checkEstonianCitEligibility', () => {
    const eligibleResult = {
      isEligible: true,
      requirements: {
        isPolishCompany: true,
        noPartnershipIncome: true,
        employmentLevel: true,
        hasQualifiedRevenue: true,
      },
      legalForm: 'sp_zoo',
      message: 'Klient spełnia wymogi estońskiego CIT',
    };

    beforeEach(() => {
      mocks.checkEstonianCitEligibility.mockResolvedValue(eligibleResult);
    });

    it('should check Estonian CIT eligibility', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.checkEstonianCitEligibility({
        clientId: CLIENT_ID,
      });

      expect(result.isEligible).toBe(true);
      expect(result.requirements.isPolishCompany).toBe(true);
      expect(result.legalForm).toBe('sp_zoo');
    });

    it('should return not eligible for wrong legal form', async () => {
      const notEligibleResult = {
        isEligible: false,
        requirements: {
          isPolishCompany: false,
          noPartnershipIncome: true,
          employmentLevel: false,
          hasQualifiedRevenue: true,
        },
        legalForm: 'sole_proprietorship',
        message: 'Klient nie spełnia wszystkich wymogów estońskiego CIT',
      };
      mocks.checkEstonianCitEligibility.mockResolvedValue(notEligibleResult);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.tax.configuration.checkEstonianCitEligibility({
        clientId: CLIENT_ID,
      });

      expect(result.isEligible).toBe(false);
      expect(result.requirements.isPolishCompany).toBe(false);
    });

    it('should validate client ID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.tax.configuration.checkEstonianCitEligibility({
          clientId: 'invalid-uuid',
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // INPUT VALIDATION EDGE CASES
  // ===========================================================================

  describe('input validation edge cases', () => {
    it('should accept valid VAT status values', async () => {
      mocks.listConfigurations.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });

      const caller = appRouter.createCaller(createAuthenticatedContext());
      // Schema values: 'active', 'exempt', 'not_registered', 'invalid'
      const statuses = ['active', 'exempt', 'not_registered', 'invalid'] as const;

      for (const status of statuses) {
        await expect(
          caller.tax.configuration.list({ vatStatus: status, limit: 20, offset: 0, includeRepresentatives: false })
        ).resolves.toBeDefined();
      }
    });

    it('should accept valid income tax form values', async () => {
      mocks.listConfigurations.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });

      const caller = appRouter.createCaller(createAuthenticatedContext());
      // Schema values: 'CIT', 'PIT' (RYCZALT and KARTA are covered by pitTaxOption)
      const forms = ['CIT', 'PIT'] as const;

      for (const form of forms) {
        await expect(
          caller.tax.configuration.list({ incomeTaxForm: form, limit: 20, offset: 0, includeRepresentatives: false })
        ).resolves.toBeDefined();
      }
    });

    it('should accept valid ZUS type values', async () => {
      mocks.listConfigurations.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });

      const caller = appRouter.createCaller(createAuthenticatedContext());
      // Schema values: 'standard', 'preferential', 'ulga_na_start', 'employer', 'none'
      const types = ['standard', 'preferential', 'ulga_na_start', 'employer', 'none'] as const;

      for (const type of types) {
        await expect(
          caller.tax.configuration.list({ zusType: type, limit: 20, offset: 0, includeRepresentatives: false })
        ).resolves.toBeDefined();
      }
    });

    it('should accept valid authorization scope values', async () => {
      mocks.addRepresentative.mockResolvedValue({
        success: true,
        representative: sampleRepresentative,
        message: 'OK',
      });

      const caller = appRouter.createCaller(createAuthenticatedContext());
      const scopes = [['VAT'], ['CIT'], ['PIT'], ['ZUS'], ['VAT', 'CIT', 'PIT', 'ZUS']] as const;

      for (const scope of scopes) {
        await expect(
          caller.tax.configuration.addRepresentative({
            clientId: CLIENT_ID,
            representativeNip: '9876543210',
            representativeName: 'Test',
            authorizationScope: scope as ['VAT' | 'CIT' | 'PIT' | 'ZUS', ...('VAT' | 'CIT' | 'PIT' | 'ZUS')[]],
            validFrom: new Date('2024-01-01'),
          })
        ).resolves.toBeDefined();
      }
    });
  });
});
