import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appRouter } from '../../index';

// ===========================================================================
// MOCKS
// ===========================================================================

const mocks = vi.hoisted(() => ({
  createFiscalYear: vi.fn(),
  getFiscalYear: vi.fn(),
  listFiscalYears: vi.fn(),
  updateFiscalYear: vi.fn(),
  openFiscalYear: vi.fn(),
  closeFiscalYear: vi.fn(),
  lockFiscalYear: vi.fn(),
  setCurrentFiscalYear: vi.fn(),
  deleteFiscalYear: vi.fn(),
  getCurrentFiscalYear: vi.fn(),
  getFiscalYearStatistics: vi.fn(),
  listFiscalPeriods: vi.fn(),
  closeFiscalPeriod: vi.fn(),
  reopenFiscalPeriod: vi.fn(),
}));

vi.mock('../../services/ace/fiscal-year.service', () => ({
  FiscalYearService: vi.fn().mockImplementation(() => mocks),
}));

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_ORG_ID = '22222222-2222-2222-2222-222222222222';
const FISCAL_YEAR_ID = '33333333-3333-3333-3333-333333333333';
const FISCAL_PERIOD_ID = '44444444-4444-4444-4444-444444444444';

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

const sampleFiscalYear = {
  id: FISCAL_YEAR_ID,
  organizationId: TEST_ORG_ID,
  name: 'Rok obrotowy 2024',
  code: '2024',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  status: 'draft' as const,
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
  id: FISCAL_PERIOD_ID,
  fiscalYearId: FISCAL_YEAR_ID,
  name: 'Styczeń 2024',
  periodNumber: 1,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  status: 'open' as const,
  closedAt: null,
  closedBy: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('FiscalYearRouter', () => {
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
        caller.ace.fiscalYear.get({ id: FISCAL_YEAR_ID, includePeriods: false })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // CREATE
  // ===========================================================================

  describe('create', () => {
    beforeEach(() => {
      mocks.createFiscalYear.mockResolvedValue(sampleFiscalYear);
    });

    it('should create fiscal year', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.ace.fiscalYear.create({
        name: 'Rok obrotowy 2024',
        code: '2024',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        generatePeriods: true,
      });

      expect(result).toEqual(sampleFiscalYear);
      expect(mocks.createFiscalYear).toHaveBeenCalled();
    });

    it('should create fiscal year without period generation', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.ace.fiscalYear.create({
        name: 'Rok obrotowy 2024',
        code: '2024',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        generatePeriods: false,
      });

      expect(mocks.createFiscalYear).toHaveBeenCalledWith(
        expect.objectContaining({ generatePeriods: false })
      );
    });

    it('should validate date range', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.ace.fiscalYear.create({
          name: 'Rok obrotowy 2024',
          code: '2024',
          startDate: new Date('2024-12-31'),
          endDate: new Date('2024-01-01'), // End before start
          generatePeriods: true,
        })
      ).rejects.toThrow();
    });

    it('should validate name length', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.ace.fiscalYear.create({
          name: '', // Empty name
          code: '2024',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          generatePeriods: true,
        })
      ).rejects.toThrow();
    });

    it('should validate code length', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.ace.fiscalYear.create({
          name: 'Rok obrotowy 2024',
          code: 'a'.repeat(21), // Code too long (max 20)
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          generatePeriods: true,
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // GET
  // ===========================================================================

  describe('get', () => {
    beforeEach(() => {
      mocks.getFiscalYear.mockResolvedValue(sampleFiscalYear);
    });

    it('should get fiscal year by id', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.ace.fiscalYear.get({ id: FISCAL_YEAR_ID, includePeriods: false });

      expect(result).toEqual(sampleFiscalYear);
      expect(mocks.getFiscalYear).toHaveBeenCalledWith({ id: FISCAL_YEAR_ID, includePeriods: false });
    });

    it('should get fiscal year with periods', async () => {
      const fiscalYearWithPeriods = {
        ...sampleFiscalYear,
        periods: [sampleFiscalPeriod],
      };
      mocks.getFiscalYear.mockResolvedValue(fiscalYearWithPeriods);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.ace.fiscalYear.get({ id: FISCAL_YEAR_ID, includePeriods: true });

      expect(result.periods).toHaveLength(1);
      expect(mocks.getFiscalYear).toHaveBeenCalledWith({ id: FISCAL_YEAR_ID, includePeriods: true });
    });

    it('should validate UUID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.ace.fiscalYear.get({ id: 'invalid-uuid', includePeriods: false })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // LIST
  // ===========================================================================

  describe('list', () => {
    const listResult = {
      items: [sampleFiscalYear],
      total: 1,
      limit: 20,
      offset: 0,
    };

    beforeEach(() => {
      mocks.listFiscalYears.mockResolvedValue(listResult);
    });

    it('should list fiscal years', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.ace.fiscalYear.list({});

      expect(result).toEqual(listResult);
      expect(mocks.listFiscalYears).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.ace.fiscalYear.list({ status: 'open' });

      expect(mocks.listFiscalYears).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'open' })
      );
    });

    it('should accept pagination parameters', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.ace.fiscalYear.list({ limit: 10, offset: 20 });

      expect(mocks.listFiscalYears).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 20 })
      );
    });

    it('should validate status enum', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.ace.fiscalYear.list({ status: 'invalid' as any })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // UPDATE
  // ===========================================================================

  describe('update', () => {
    beforeEach(() => {
      mocks.updateFiscalYear.mockResolvedValue(sampleFiscalYear);
    });

    it('should update fiscal year name', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.ace.fiscalYear.update({
        id: FISCAL_YEAR_ID,
        name: 'Rok obrotowy 2024 (zmieniony)',
      });

      expect(result).toEqual(sampleFiscalYear);
      expect(mocks.updateFiscalYear).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Rok obrotowy 2024 (zmieniony)' })
      );
    });

    it('should update fiscal year code', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.ace.fiscalYear.update({
        id: FISCAL_YEAR_ID,
        code: '2024/2025',
      });

      expect(mocks.updateFiscalYear).toHaveBeenCalledWith(
        expect.objectContaining({ code: '2024/2025' })
      );
    });

    it('should validate UUID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.ace.fiscalYear.update({
          id: 'invalid-uuid',
          name: 'Test',
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // OPEN FISCAL YEAR
  // ===========================================================================

  describe('open', () => {
    const openResult = {
      success: true,
      fiscalYear: { ...sampleFiscalYear, status: 'open' as const },
      message: 'Rok obrotowy został otwarty',
    };

    beforeEach(() => {
      mocks.openFiscalYear.mockResolvedValue(openResult);
    });

    it('should open fiscal year', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.ace.fiscalYear.open({ id: FISCAL_YEAR_ID });

      expect(result.success).toBe(true);
      expect(result.fiscalYear.status).toBe('open');
      expect(mocks.openFiscalYear).toHaveBeenCalledWith({ id: FISCAL_YEAR_ID });
    });

    it('should validate UUID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.ace.fiscalYear.open({ id: 'invalid-uuid' })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // CLOSE FISCAL YEAR
  // ===========================================================================

  describe('close', () => {
    const closeResult = {
      success: true,
      fiscalYear: { ...sampleFiscalYear, status: 'closed' as const },
      message: 'Rok obrotowy został zamknięty',
    };

    beforeEach(() => {
      mocks.closeFiscalYear.mockResolvedValue(closeResult);
    });

    it('should close fiscal year', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.ace.fiscalYear.close({ id: FISCAL_YEAR_ID });

      expect(result.success).toBe(true);
      expect(result.fiscalYear.status).toBe('closed');
      expect(mocks.closeFiscalYear).toHaveBeenCalled();
    });

    it('should force close when specified', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.ace.fiscalYear.close({
        id: FISCAL_YEAR_ID,
        forceClose: true,
      });

      expect(mocks.closeFiscalYear).toHaveBeenCalledWith(
        expect.objectContaining({ forceClose: true })
      );
    });
  });

  // ===========================================================================
  // LOCK FISCAL YEAR
  // ===========================================================================

  describe('lock', () => {
    const lockResult = {
      success: true,
      fiscalYear: { ...sampleFiscalYear, status: 'locked' as const },
      message: 'Rok obrotowy został zablokowany',
    };

    beforeEach(() => {
      mocks.lockFiscalYear.mockResolvedValue(lockResult);
    });

    it('should lock fiscal year', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.ace.fiscalYear.lock({ id: FISCAL_YEAR_ID });

      expect(result.success).toBe(true);
      expect(result.fiscalYear.status).toBe('locked');
      expect(mocks.lockFiscalYear).toHaveBeenCalled();
    });

    it('should accept reason parameter', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.ace.fiscalYear.lock({
        id: FISCAL_YEAR_ID,
        reason: 'Po audycie zewnętrznym',
      });

      expect(mocks.lockFiscalYear).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Po audycie zewnętrznym' })
      );
    });
  });

  // ===========================================================================
  // SET CURRENT FISCAL YEAR
  // ===========================================================================

  describe('setCurrent', () => {
    const setCurrentResult = {
      success: true,
      fiscalYear: { ...sampleFiscalYear, isCurrent: true },
      previousCurrentId: null,
      message: 'Ustawiono bieżący rok obrotowy',
    };

    beforeEach(() => {
      mocks.setCurrentFiscalYear.mockResolvedValue(setCurrentResult);
    });

    it('should set current fiscal year', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.ace.fiscalYear.setCurrent({ id: FISCAL_YEAR_ID });

      expect(result.success).toBe(true);
      expect(result.fiscalYear.isCurrent).toBe(true);
      expect(mocks.setCurrentFiscalYear).toHaveBeenCalledWith({ id: FISCAL_YEAR_ID });
    });

    it('should return previous current id', async () => {
      const resultWithPrevious = {
        ...setCurrentResult,
        previousCurrentId: '55555555-5555-5555-5555-555555555555',
      };
      mocks.setCurrentFiscalYear.mockResolvedValue(resultWithPrevious);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.ace.fiscalYear.setCurrent({ id: FISCAL_YEAR_ID });

      expect(result.previousCurrentId).toBe('55555555-5555-5555-5555-555555555555');
    });
  });

  // ===========================================================================
  // DELETE FISCAL YEAR
  // ===========================================================================

  describe('delete', () => {
    const deleteResult = {
      success: true,
      message: 'Rok obrotowy został usunięty',
    };

    beforeEach(() => {
      mocks.deleteFiscalYear.mockResolvedValue(deleteResult);
    });

    it('should delete fiscal year', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.ace.fiscalYear.delete({ id: FISCAL_YEAR_ID });

      expect(result.success).toBe(true);
      expect(mocks.deleteFiscalYear).toHaveBeenCalledWith({ id: FISCAL_YEAR_ID });
    });

    it('should validate UUID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.ace.fiscalYear.delete({ id: 'invalid-uuid' })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // GET CURRENT FISCAL YEAR
  // ===========================================================================

  describe('getCurrent', () => {
    beforeEach(() => {
      mocks.getCurrentFiscalYear.mockResolvedValue({ ...sampleFiscalYear, isCurrent: true });
    });

    it('should get current fiscal year', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.ace.fiscalYear.getCurrent({});

      expect(result.isCurrent).toBe(true);
      expect(mocks.getCurrentFiscalYear).toHaveBeenCalled();
    });

    it('should include periods when requested', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.ace.fiscalYear.getCurrent({ includePeriods: true });

      expect(mocks.getCurrentFiscalYear).toHaveBeenCalledWith(
        expect.objectContaining({ includePeriods: true })
      );
    });

    it('should return null when no current fiscal year', async () => {
      mocks.getCurrentFiscalYear.mockResolvedValue(null);

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.ace.fiscalYear.getCurrent({});

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // GET STATISTICS
  // ===========================================================================

  describe('getStatistics', () => {
    const statisticsResult = {
      fiscalYearId: FISCAL_YEAR_ID,
      totalPeriods: 12,
      openPeriods: 6,
      closedPeriods: 5,
      lockedPeriods: 1,
      journalEntriesCount: 1500,
      totalDebit: 1000000,
      totalCredit: 1000000,
      isBalanced: true,
    };

    beforeEach(() => {
      mocks.getFiscalYearStatistics.mockResolvedValue(statisticsResult);
    });

    it('should get fiscal year statistics', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.ace.fiscalYear.getStatistics({ id: FISCAL_YEAR_ID });

      expect(result).toEqual(statisticsResult);
      expect(result.isBalanced).toBe(true);
      expect(mocks.getFiscalYearStatistics).toHaveBeenCalledWith({ id: FISCAL_YEAR_ID });
    });

    it('should validate UUID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.ace.fiscalYear.getStatistics({ id: 'invalid-uuid' })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // LIST FISCAL PERIODS
  // ===========================================================================

  describe('listPeriods', () => {
    const listPeriodsResult = {
      items: [sampleFiscalPeriod],
      total: 1,
    };

    beforeEach(() => {
      mocks.listFiscalPeriods.mockResolvedValue(listPeriodsResult);
    });

    it('should list fiscal periods', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.ace.fiscalYear.listPeriods({ fiscalYearId: FISCAL_YEAR_ID });

      expect(result).toEqual(listPeriodsResult);
      expect(mocks.listFiscalPeriods).toHaveBeenCalledWith({ fiscalYearId: FISCAL_YEAR_ID });
    });

    it('should filter by status', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.ace.fiscalYear.listPeriods({
        fiscalYearId: FISCAL_YEAR_ID,
        status: 'closed',
      });

      expect(mocks.listFiscalPeriods).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'closed' })
      );
    });

    it('should validate UUID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.ace.fiscalYear.listPeriods({ fiscalYearId: 'invalid-uuid' })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // CLOSE FISCAL PERIOD
  // ===========================================================================

  describe('closePeriod', () => {
    const closePeriodResult = {
      success: true,
      period: { ...sampleFiscalPeriod, status: 'closed' as const },
      message: 'Okres został zamknięty',
    };

    beforeEach(() => {
      mocks.closeFiscalPeriod.mockResolvedValue(closePeriodResult);
    });

    it('should close fiscal period', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.ace.fiscalYear.closePeriod({ id: FISCAL_PERIOD_ID });

      expect(result.success).toBe(true);
      expect(result.period.status).toBe('closed');
      expect(mocks.closeFiscalPeriod).toHaveBeenCalledWith({ id: FISCAL_PERIOD_ID });
    });

    it('should validate UUID format', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.ace.fiscalYear.closePeriod({ id: 'invalid-uuid' })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // REOPEN FISCAL PERIOD
  // ===========================================================================

  describe('reopenPeriod', () => {
    const reopenPeriodResult = {
      success: true,
      period: { ...sampleFiscalPeriod, status: 'open' as const },
      message: 'Okres został ponownie otwarty',
    };

    beforeEach(() => {
      mocks.reopenFiscalPeriod.mockResolvedValue(reopenPeriodResult);
    });

    it('should reopen fiscal period', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.ace.fiscalYear.reopenPeriod({
        id: FISCAL_PERIOD_ID,
        reason: 'Korekta faktury',
      });

      expect(result.success).toBe(true);
      expect(result.period.status).toBe('open');
      expect(mocks.reopenFiscalPeriod).toHaveBeenCalled();
    });

    it('should require reason parameter', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.ace.fiscalYear.reopenPeriod({
          id: FISCAL_PERIOD_ID,
          reason: '', // Empty reason
        })
      ).rejects.toThrow();
    });

    it('should validate reason max length', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.ace.fiscalYear.reopenPeriod({
          id: FISCAL_PERIOD_ID,
          reason: 'a'.repeat(501), // Reason too long (max 500)
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // INPUT VALIDATION EDGE CASES
  // ===========================================================================

  describe('input validation', () => {
    it('should validate limit range in list', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.ace.fiscalYear.list({ limit: 0 })
      ).rejects.toThrow();

      await expect(
        caller.ace.fiscalYear.list({ limit: 101 })
      ).rejects.toThrow();
    });

    it('should validate offset range in list', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.ace.fiscalYear.list({ offset: -1 })
      ).rejects.toThrow();
    });

    it('should accept valid fiscal year statuses', async () => {
      mocks.listFiscalYears.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const statuses = ['draft', 'open', 'closed', 'locked'] as const;

      for (const status of statuses) {
        await expect(
          caller.ace.fiscalYear.list({ status })
        ).resolves.toBeDefined();
      }
    });

    it('should accept valid fiscal period statuses', async () => {
      mocks.listFiscalPeriods.mockResolvedValue({ items: [], total: 0 });

      const caller = appRouter.createCaller(createAuthenticatedContext());

      const statuses = ['open', 'closed', 'locked'] as const;

      for (const status of statuses) {
        await expect(
          caller.ace.fiscalYear.listPeriods({ fiscalYearId: FISCAL_YEAR_ID, status })
        ).resolves.toBeDefined();
      }
    });
  });
});
