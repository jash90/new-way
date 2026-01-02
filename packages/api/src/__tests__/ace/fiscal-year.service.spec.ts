import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FiscalYearService } from '../../services/ace/fiscal-year.service';

// ===========================================================================
// MOCKS
// ===========================================================================

const mockPrisma = {
  fiscalYear: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  fiscalPeriod: {
    createMany: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  journalEntry: {
    count: vi.fn(),
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
const FISCAL_YEAR_ID = '33333333-3333-3333-3333-333333333333';
const PERIOD_ID = '44444444-4444-4444-4444-444444444444';

const createService = () =>
  new FiscalYearService(
    mockPrisma as any,
    mockRedis as any,
    mockAuditLogger as any,
    TEST_USER_ID,
    TEST_ORG_ID
  );

const sampleFiscalYear = {
  id: FISCAL_YEAR_ID,
  organizationId: TEST_ORG_ID,
  name: 'Rok obrotowy 2024',
  code: '2024',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  status: 'draft',
  isCurrent: false,
  openedAt: null,
  closedAt: null,
  lockedAt: null,
  openedBy: null,
  closedBy: null,
  lockedBy: null,
  createdBy: TEST_USER_ID,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const sampleFiscalPeriod = {
  id: PERIOD_ID,
  fiscalYearId: FISCAL_YEAR_ID,
  name: 'Styczeń 2024',
  periodNumber: 1,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  status: 'open',
  closedAt: null,
  closedBy: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('FiscalYearService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // CREATE FISCAL YEAR
  // ===========================================================================

  describe('createFiscalYear', () => {
    const createInput = {
      name: 'Rok obrotowy 2024',
      code: '2024',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      generatePeriods: true,
    };

    beforeEach(() => {
      mockPrisma.fiscalYear.findFirst.mockResolvedValue(null);
      mockPrisma.fiscalYear.create.mockResolvedValue(sampleFiscalYear);
      mockPrisma.fiscalPeriod.createMany.mockResolvedValue({ count: 12 });
    });

    it('should create a fiscal year successfully', async () => {
      const service = createService();

      const result = await service.createFiscalYear(createInput);

      expect(result).toEqual(sampleFiscalYear);
      expect(mockPrisma.fiscalYear.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Rok obrotowy 2024',
          code: '2024',
          organizationId: TEST_ORG_ID,
          createdBy: TEST_USER_ID,
        }),
      });
    });

    it('should generate 12 monthly periods when generatePeriods is true', async () => {
      const service = createService();

      await service.createFiscalYear(createInput);

      expect(mockPrisma.fiscalPeriod.createMany).toHaveBeenCalled();
      const createManyCall = mockPrisma.fiscalPeriod.createMany.mock.calls[0][0];
      expect(createManyCall.data).toHaveLength(12);
    });

    it('should not generate periods when generatePeriods is false', async () => {
      const service = createService();

      await service.createFiscalYear({ ...createInput, generatePeriods: false });

      expect(mockPrisma.fiscalPeriod.createMany).not.toHaveBeenCalled();
    });

    it('should throw error if fiscal year with same code exists', async () => {
      mockPrisma.fiscalYear.findFirst.mockResolvedValue(sampleFiscalYear);
      const service = createService();

      await expect(service.createFiscalYear(createInput)).rejects.toThrow(
        'Rok obrotowy o kodzie 2024 już istnieje'
      );
    });

    it('should log audit event on creation', async () => {
      const service = createService();

      await service.createFiscalYear(createInput);

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'fiscal_year_created',
          userId: TEST_USER_ID,
          organizationId: TEST_ORG_ID,
          resourceType: 'fiscal_year',
        })
      );
    });
  });

  // ===========================================================================
  // GET FISCAL YEAR
  // ===========================================================================

  describe('getFiscalYear', () => {
    beforeEach(() => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue(sampleFiscalYear);
    });

    it('should get fiscal year by id', async () => {
      const service = createService();

      const result = await service.getFiscalYear({ id: FISCAL_YEAR_ID, includePeriods: false });

      expect(result).toEqual(sampleFiscalYear);
      expect(mockPrisma.fiscalYear.findUnique).toHaveBeenCalledWith({
        where: { id: FISCAL_YEAR_ID, organizationId: TEST_ORG_ID },
        include: { periods: false },
      });
    });

    it('should include periods when requested', async () => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue({
        ...sampleFiscalYear,
        periods: [sampleFiscalPeriod],
      });
      const service = createService();

      const result = await service.getFiscalYear({ id: FISCAL_YEAR_ID, includePeriods: true });

      expect(result.periods).toHaveLength(1);
      expect(mockPrisma.fiscalYear.findUnique).toHaveBeenCalledWith({
        where: { id: FISCAL_YEAR_ID, organizationId: TEST_ORG_ID },
        include: { periods: true },
      });
    });

    it('should return null for non-existent fiscal year', async () => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue(null);
      const service = createService();

      const result = await service.getFiscalYear({ id: FISCAL_YEAR_ID, includePeriods: false });

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // LIST FISCAL YEARS
  // ===========================================================================

  describe('listFiscalYears', () => {
    const listResult = [sampleFiscalYear];

    beforeEach(() => {
      mockPrisma.fiscalYear.findMany.mockResolvedValue(listResult);
      mockPrisma.fiscalYear.count.mockResolvedValue(1);
    });

    it('should list fiscal years with pagination', async () => {
      const service = createService();

      const result = await service.listFiscalYears({ limit: 20, offset: 0, includePeriods: false });

      expect(result.items).toEqual(listResult);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should filter by status', async () => {
      const service = createService();

      await service.listFiscalYears({ status: 'open', limit: 20, offset: 0, includePeriods: false });

      expect(mockPrisma.fiscalYear.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'open' }),
        })
      );
    });

    it('should order by startDate descending', async () => {
      const service = createService();

      await service.listFiscalYears({ limit: 20, offset: 0, includePeriods: false });

      expect(mockPrisma.fiscalYear.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { startDate: 'desc' },
        })
      );
    });
  });

  // ===========================================================================
  // UPDATE FISCAL YEAR
  // ===========================================================================

  describe('updateFiscalYear', () => {
    beforeEach(() => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue(sampleFiscalYear);
      mockPrisma.fiscalYear.update.mockResolvedValue({
        ...sampleFiscalYear,
        name: 'Updated Name',
      });
    });

    it('should update fiscal year name', async () => {
      const service = createService();

      const result = await service.updateFiscalYear({
        id: FISCAL_YEAR_ID,
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
      expect(mockPrisma.fiscalYear.update).toHaveBeenCalledWith({
        where: { id: FISCAL_YEAR_ID },
        data: expect.objectContaining({ name: 'Updated Name' }),
      });
    });

    it('should throw error if fiscal year not found', async () => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue(null);
      const service = createService();

      await expect(
        service.updateFiscalYear({ id: FISCAL_YEAR_ID, name: 'Updated' })
      ).rejects.toThrow('Rok obrotowy nie został znaleziony');
    });

    it('should throw error if fiscal year is locked', async () => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue({
        ...sampleFiscalYear,
        status: 'locked',
      });
      const service = createService();

      await expect(
        service.updateFiscalYear({ id: FISCAL_YEAR_ID, name: 'Updated' })
      ).rejects.toThrow('Nie można edytować zablokowanego roku obrotowego');
    });
  });

  // ===========================================================================
  // OPEN FISCAL YEAR
  // ===========================================================================

  describe('openFiscalYear', () => {
    beforeEach(() => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue({
        ...sampleFiscalYear,
        status: 'draft',
      });
      mockPrisma.fiscalYear.update.mockResolvedValue({
        ...sampleFiscalYear,
        status: 'open',
        openedAt: new Date(),
        openedBy: TEST_USER_ID,
      });
    });

    it('should open a draft fiscal year', async () => {
      const service = createService();

      const result = await service.openFiscalYear({ id: FISCAL_YEAR_ID });

      expect(result.success).toBe(true);
      expect(result.fiscalYear.status).toBe('open');
      expect(mockPrisma.fiscalYear.update).toHaveBeenCalledWith({
        where: { id: FISCAL_YEAR_ID },
        data: expect.objectContaining({
          status: 'open',
          openedBy: TEST_USER_ID,
        }),
      });
    });

    it('should throw error if fiscal year not found', async () => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue(null);
      const service = createService();

      await expect(service.openFiscalYear({ id: FISCAL_YEAR_ID })).rejects.toThrow(
        'Rok obrotowy nie został znaleziony'
      );
    });

    it('should throw error if fiscal year is already open', async () => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue({
        ...sampleFiscalYear,
        status: 'open',
      });
      const service = createService();

      await expect(service.openFiscalYear({ id: FISCAL_YEAR_ID })).rejects.toThrow(
        'Rok obrotowy jest już otwarty'
      );
    });

    it('should throw error if fiscal year is locked', async () => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue({
        ...sampleFiscalYear,
        status: 'locked',
      });
      const service = createService();

      await expect(service.openFiscalYear({ id: FISCAL_YEAR_ID })).rejects.toThrow(
        'Nie można otworzyć zablokowanego roku obrotowego'
      );
    });
  });

  // ===========================================================================
  // CLOSE FISCAL YEAR
  // ===========================================================================

  describe('closeFiscalYear', () => {
    beforeEach(() => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue({
        ...sampleFiscalYear,
        status: 'open',
      });
      mockPrisma.fiscalPeriod.count.mockResolvedValue(0);
      mockPrisma.fiscalYear.update.mockResolvedValue({
        ...sampleFiscalYear,
        status: 'closed',
        closedAt: new Date(),
        closedBy: TEST_USER_ID,
      });
    });

    it('should close an open fiscal year', async () => {
      const service = createService();

      const result = await service.closeFiscalYear({ id: FISCAL_YEAR_ID, forceClose: false });

      expect(result.success).toBe(true);
      expect(result.fiscalYear.status).toBe('closed');
    });

    it('should throw error if there are open periods and forceClose is false', async () => {
      mockPrisma.fiscalPeriod.count.mockResolvedValue(3);
      const service = createService();

      await expect(
        service.closeFiscalYear({ id: FISCAL_YEAR_ID, forceClose: false })
      ).rejects.toThrow('Nie można zamknąć roku z otwartymi okresami');
    });

    it('should close fiscal year with open periods when forceClose is true', async () => {
      mockPrisma.fiscalPeriod.count.mockResolvedValue(3);
      mockPrisma.fiscalPeriod.updateMany = vi.fn().mockResolvedValue({ count: 3 });
      const service = createService();

      const result = await service.closeFiscalYear({ id: FISCAL_YEAR_ID, forceClose: true });

      expect(result.success).toBe(true);
      expect(mockPrisma.fiscalPeriod.updateMany).toHaveBeenCalled();
    });

    it('should throw error if fiscal year is not open', async () => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue({
        ...sampleFiscalYear,
        status: 'draft',
      });
      const service = createService();

      await expect(
        service.closeFiscalYear({ id: FISCAL_YEAR_ID, forceClose: false })
      ).rejects.toThrow('Tylko otwarty rok obrotowy może zostać zamknięty');
    });
  });

  // ===========================================================================
  // LOCK FISCAL YEAR
  // ===========================================================================

  describe('lockFiscalYear', () => {
    beforeEach(() => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue({
        ...sampleFiscalYear,
        status: 'closed',
      });
      mockPrisma.fiscalYear.update.mockResolvedValue({
        ...sampleFiscalYear,
        status: 'locked',
        lockedAt: new Date(),
        lockedBy: TEST_USER_ID,
      });
    });

    it('should lock a closed fiscal year', async () => {
      const service = createService();

      const result = await service.lockFiscalYear({ id: FISCAL_YEAR_ID });

      expect(result.success).toBe(true);
      expect(result.fiscalYear.status).toBe('locked');
    });

    it('should throw error if fiscal year is not closed', async () => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue({
        ...sampleFiscalYear,
        status: 'open',
      });
      const service = createService();

      await expect(service.lockFiscalYear({ id: FISCAL_YEAR_ID })).rejects.toThrow(
        'Tylko zamknięty rok obrotowy może zostać zablokowany'
      );
    });

    it('should log audit event with reason', async () => {
      const service = createService();

      await service.lockFiscalYear({ id: FISCAL_YEAR_ID, reason: 'Audyt zakończony' });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'fiscal_year_locked',
          metadata: expect.objectContaining({ reason: 'Audyt zakończony' }),
        })
      );
    });
  });

  // ===========================================================================
  // SET CURRENT FISCAL YEAR
  // ===========================================================================

  describe('setCurrentFiscalYear', () => {
    beforeEach(() => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue({
        ...sampleFiscalYear,
        status: 'open',
      });
      mockPrisma.fiscalYear.findFirst.mockResolvedValue({
        ...sampleFiscalYear,
        id: 'previous-id',
        isCurrent: true,
      });
      mockPrisma.fiscalYear.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.fiscalYear.update.mockResolvedValue({
        ...sampleFiscalYear,
        isCurrent: true,
      });
    });

    it('should set fiscal year as current', async () => {
      const service = createService();

      const result = await service.setCurrentFiscalYear({ id: FISCAL_YEAR_ID });

      expect(result.success).toBe(true);
      expect(result.fiscalYear.isCurrent).toBe(true);
      expect(result.previousCurrentId).toBe('previous-id');
    });

    it('should unset previous current fiscal year', async () => {
      const service = createService();

      await service.setCurrentFiscalYear({ id: FISCAL_YEAR_ID });

      expect(mockPrisma.fiscalYear.updateMany).toHaveBeenCalledWith({
        where: { organizationId: TEST_ORG_ID, isCurrent: true },
        data: { isCurrent: false },
      });
    });

    it('should throw error if fiscal year is not open', async () => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue({
        ...sampleFiscalYear,
        status: 'draft',
      });
      const service = createService();

      await expect(service.setCurrentFiscalYear({ id: FISCAL_YEAR_ID })).rejects.toThrow(
        'Tylko otwarty rok obrotowy może być ustawiony jako bieżący'
      );
    });
  });

  // ===========================================================================
  // DELETE FISCAL YEAR
  // ===========================================================================

  describe('deleteFiscalYear', () => {
    beforeEach(() => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue({
        ...sampleFiscalYear,
        status: 'draft',
      });
      mockPrisma.journalEntry.count.mockResolvedValue(0);
      mockPrisma.fiscalYear.delete.mockResolvedValue(sampleFiscalYear);
    });

    it('should delete a draft fiscal year', async () => {
      const service = createService();

      const result = await service.deleteFiscalYear({ id: FISCAL_YEAR_ID });

      expect(result.success).toBe(true);
      expect(mockPrisma.fiscalYear.delete).toHaveBeenCalledWith({
        where: { id: FISCAL_YEAR_ID },
      });
    });

    it('should throw error if fiscal year has journal entries', async () => {
      mockPrisma.journalEntry.count.mockResolvedValue(5);
      const service = createService();

      await expect(service.deleteFiscalYear({ id: FISCAL_YEAR_ID })).rejects.toThrow(
        'Nie można usunąć roku obrotowego zawierającego zapisy księgowe'
      );
    });

    it('should throw error if fiscal year is not in draft status', async () => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue({
        ...sampleFiscalYear,
        status: 'open',
      });
      const service = createService();

      await expect(service.deleteFiscalYear({ id: FISCAL_YEAR_ID })).rejects.toThrow(
        'Można usunąć tylko rok obrotowy w statusie draft'
      );
    });
  });

  // ===========================================================================
  // GET CURRENT FISCAL YEAR
  // ===========================================================================

  describe('getCurrentFiscalYear', () => {
    beforeEach(() => {
      mockPrisma.fiscalYear.findFirst.mockResolvedValue({
        ...sampleFiscalYear,
        isCurrent: true,
      });
    });

    it('should get current fiscal year', async () => {
      const service = createService();

      const result = await service.getCurrentFiscalYear({ includePeriods: false });

      expect(result).not.toBeNull();
      expect(result?.isCurrent).toBe(true);
      expect(mockPrisma.fiscalYear.findFirst).toHaveBeenCalledWith({
        where: { organizationId: TEST_ORG_ID, isCurrent: true },
        include: { periods: false },
      });
    });

    it('should return null if no current fiscal year', async () => {
      mockPrisma.fiscalYear.findFirst.mockResolvedValue(null);
      const service = createService();

      const result = await service.getCurrentFiscalYear({ includePeriods: false });

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // LIST FISCAL PERIODS
  // ===========================================================================

  describe('listFiscalPeriods', () => {
    beforeEach(() => {
      mockPrisma.fiscalPeriod.findMany.mockResolvedValue([sampleFiscalPeriod]);
    });

    it('should list periods for fiscal year', async () => {
      const service = createService();

      const result = await service.listFiscalPeriods({ fiscalYearId: FISCAL_YEAR_ID });

      expect(result.items).toHaveLength(1);
      expect(mockPrisma.fiscalPeriod.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ fiscalYearId: FISCAL_YEAR_ID }),
        orderBy: { periodNumber: 'asc' },
      });
    });

    it('should filter by status', async () => {
      const service = createService();

      await service.listFiscalPeriods({ fiscalYearId: FISCAL_YEAR_ID, status: 'open' });

      expect(mockPrisma.fiscalPeriod.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ status: 'open' }),
        orderBy: { periodNumber: 'asc' },
      });
    });
  });

  // ===========================================================================
  // CLOSE FISCAL PERIOD
  // ===========================================================================

  describe('closeFiscalPeriod', () => {
    beforeEach(() => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue({
        ...sampleFiscalPeriod,
        fiscalYear: { ...sampleFiscalYear, status: 'open', organizationId: TEST_ORG_ID },
      });
      mockPrisma.fiscalPeriod.update.mockResolvedValue({
        ...sampleFiscalPeriod,
        status: 'closed',
        closedAt: new Date(),
        closedBy: TEST_USER_ID,
      });
    });

    it('should close an open period', async () => {
      const service = createService();

      const result = await service.closeFiscalPeriod({ id: PERIOD_ID });

      expect(result.success).toBe(true);
      expect(result.period.status).toBe('closed');
    });

    it('should throw error if period is already closed', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue({
        ...sampleFiscalPeriod,
        status: 'closed',
        fiscalYear: { ...sampleFiscalYear, status: 'open', organizationId: TEST_ORG_ID },
      });
      const service = createService();

      await expect(service.closeFiscalPeriod({ id: PERIOD_ID })).rejects.toThrow(
        'Okres jest już zamknięty'
      );
    });

    it('should throw error if fiscal year is not open', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue({
        ...sampleFiscalPeriod,
        fiscalYear: { ...sampleFiscalYear, status: 'closed', organizationId: TEST_ORG_ID },
      });
      const service = createService();

      await expect(service.closeFiscalPeriod({ id: PERIOD_ID })).rejects.toThrow(
        'Można zamykać okresy tylko w otwartym roku obrotowym'
      );
    });
  });

  // ===========================================================================
  // REOPEN FISCAL PERIOD
  // ===========================================================================

  describe('reopenFiscalPeriod', () => {
    beforeEach(() => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue({
        ...sampleFiscalPeriod,
        status: 'closed',
        fiscalYear: { ...sampleFiscalYear, status: 'open', organizationId: TEST_ORG_ID },
      });
      mockPrisma.fiscalPeriod.update.mockResolvedValue({
        ...sampleFiscalPeriod,
        status: 'open',
        closedAt: null,
        closedBy: null,
      });
    });

    it('should reopen a closed period', async () => {
      const service = createService();

      const result = await service.reopenFiscalPeriod({
        id: PERIOD_ID,
        reason: 'Konieczność korekty',
      });

      expect(result.success).toBe(true);
      expect(result.period.status).toBe('open');
    });

    it('should throw error if period is not closed', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue({
        ...sampleFiscalPeriod,
        status: 'open',
        fiscalYear: { ...sampleFiscalYear, status: 'open', organizationId: TEST_ORG_ID },
      });
      const service = createService();

      await expect(
        service.reopenFiscalPeriod({ id: PERIOD_ID, reason: 'Test' })
      ).rejects.toThrow('Tylko zamknięty okres może zostać ponownie otwarty');
    });

    it('should throw error if period is locked', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue({
        ...sampleFiscalPeriod,
        status: 'locked',
        fiscalYear: { ...sampleFiscalYear, status: 'open', organizationId: TEST_ORG_ID },
      });
      const service = createService();

      await expect(
        service.reopenFiscalPeriod({ id: PERIOD_ID, reason: 'Test' })
      ).rejects.toThrow('Nie można otworzyć zablokowanego okresu');
    });

    it('should log audit event with reason', async () => {
      const service = createService();

      await service.reopenFiscalPeriod({ id: PERIOD_ID, reason: 'Konieczność korekty' });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'fiscal_period_reopened',
          metadata: expect.objectContaining({ reason: 'Konieczność korekty' }),
        })
      );
    });
  });

  // ===========================================================================
  // GET FISCAL YEAR STATISTICS
  // ===========================================================================

  describe('getFiscalYearStatistics', () => {
    beforeEach(() => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue(sampleFiscalYear);
      mockPrisma.fiscalPeriod.count.mockImplementation(({ where }: any) => {
        if (!where.status) return Promise.resolve(12);
        if (where.status === 'open') return Promise.resolve(8);
        if (where.status === 'closed') return Promise.resolve(3);
        if (where.status === 'locked') return Promise.resolve(1);
        return Promise.resolve(0);
      });
      mockPrisma.journalEntry.count.mockResolvedValue(150);
      mockPrisma.journalEntry.aggregate.mockResolvedValue({
        _sum: { debit: 500000, credit: 500000 },
      });
    });

    it('should return fiscal year statistics', async () => {
      const service = createService();

      const result = await service.getFiscalYearStatistics({ id: FISCAL_YEAR_ID });

      expect(result.fiscalYearId).toBe(FISCAL_YEAR_ID);
      expect(result.totalPeriods).toBe(12);
      expect(result.journalEntriesCount).toBe(150);
      expect(result.isBalanced).toBe(true);
    });

    it('should throw error if fiscal year not found', async () => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue(null);
      const service = createService();

      await expect(service.getFiscalYearStatistics({ id: FISCAL_YEAR_ID })).rejects.toThrow(
        'Rok obrotowy nie został znaleziony'
      );
    });

    it('should detect unbalanced entries', async () => {
      mockPrisma.journalEntry.aggregate.mockResolvedValue({
        _sum: { debit: 500000, credit: 499999 },
      });
      const service = createService();

      const result = await service.getFiscalYearStatistics({ id: FISCAL_YEAR_ID });

      expect(result.isBalanced).toBe(false);
    });
  });

  // ===========================================================================
  // CACHE INVALIDATION
  // ===========================================================================

  describe('cache invalidation', () => {
    it('should invalidate cache on create', async () => {
      mockPrisma.fiscalYear.findFirst.mockResolvedValue(null);
      mockPrisma.fiscalYear.create.mockResolvedValue(sampleFiscalYear);
      mockPrisma.fiscalPeriod.createMany.mockResolvedValue({ count: 12 });
      mockRedis.keys.mockResolvedValue([`fiscal_year:${TEST_ORG_ID}:list`]);
      const service = createService();

      await service.createFiscalYear({
        name: 'Test',
        code: '2024',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        generatePeriods: true,
      });

      expect(mockRedis.keys).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should invalidate cache on update', async () => {
      mockPrisma.fiscalYear.findUnique.mockResolvedValue(sampleFiscalYear);
      mockPrisma.fiscalYear.update.mockResolvedValue(sampleFiscalYear);
      mockRedis.keys.mockResolvedValue([`fiscal_year:${TEST_ORG_ID}:${FISCAL_YEAR_ID}`]);
      const service = createService();

      await service.updateFiscalYear({ id: FISCAL_YEAR_ID, name: 'Updated' });

      expect(mockRedis.keys).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });
});
