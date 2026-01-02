/**
 * ACC-012: Trial Balance Router Tests
 * TDD tests for trial balance router endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { router } from '../../trpc';
import { trialBalanceRouter } from '../../routers/ace/trial-balance.router';
import { createCallerFactory } from '../../trpc';

// Mock the TrialBalanceService using prototype pattern
import { TrialBalanceService } from '../../services/ace/trial-balance.service';

vi.mock('../../services/ace/trial-balance.service');

const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_WTB_ID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_COLUMN_ID = '550e8400-e29b-41d4-a716-446655440003';
const TEST_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440004';
const TEST_FISCAL_YEAR_ID = '550e8400-e29b-41d4-a716-446655440005';
const TEST_PERIOD_ID = '550e8400-e29b-41d4-a716-446655440006';

const mockContext = {
  prisma: {},
  redis: {},
  auditLogger: { log: vi.fn() },
  session: {
    userId: TEST_USER_ID,
    organizationId: TEST_ORG_ID,
  },
};

const testTrialBalanceLine = {
  accountId: TEST_ACCOUNT_ID,
  accountCode: '100',
  accountName: 'Cash',
  accountClass: 1,
  accountType: 'ASSET',
  parentAccountId: null,
  normalBalance: 'DEBIT' as const,
  isActive: true,
  debitBalance: 10000,
  creditBalance: 0,
  isWarning: false,
};

const testTrialBalanceResult = {
  asOfDate: new Date('2024-01-31'),
  periodId: null,
  generatedAt: new Date(),
  generatedBy: TEST_USER_ID,
  lines: [testTrialBalanceLine],
  totals: {
    debit: 10000,
    credit: 10000,
  },
  isBalanced: true,
  outOfBalanceAmount: 0,
  metadata: {
    accountCount: 1,
    groupBy: 'NONE' as const,
    includeZeroBalances: false,
    warningCount: 0,
  },
};

const testComparativeResult = {
  currentAsOfDate: new Date('2024-01-31'),
  comparePeriods: [{ asOfDate: new Date('2023-12-31'), label: 'Dec 2023' }],
  generatedAt: new Date(),
  lines: [
    {
      accountId: TEST_ACCOUNT_ID,
      accountCode: '100',
      accountName: 'Cash',
      accountClass: 1,
      normalBalance: 'DEBIT' as const,
      currentDebit: 10000,
      currentCredit: 0,
      periodBalances: [{ label: 'Dec 2023', asOfDate: new Date('2023-12-31'), debit: 8000, credit: 0 }],
      variances: [{ label: 'Dec 2023', variance: 2000, percentChange: 25, isSignificant: true }],
    },
  ],
  metadata: {
    accountCount: 1,
    groupBy: 'NONE' as const,
    highlightThreshold: 10,
  },
};

const testWorkingTB = {
  id: TEST_WTB_ID,
  organizationId: TEST_ORG_ID,
  wtbCode: 'WTB-2024-00001',
  wtbName: 'Year-End 2024',
  description: 'Year-end working trial balance',
  fiscalYearId: TEST_FISCAL_YEAR_ID,
  periodId: TEST_PERIOD_ID,
  asOfDate: new Date('2024-12-31'),
  status: 'DRAFT' as const,
  lockedAt: null,
  lockedBy: null,
  includeZeroBalances: false,
  groupBy: 'NONE' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: {
    id: TEST_USER_ID,
    name: 'Test User',
    email: 'test@example.com',
  },
};

const testWTBLine = {
  id: 'line-1',
  wtbId: TEST_WTB_ID,
  accountId: TEST_ACCOUNT_ID,
  accountCode: '100',
  accountName: 'Cash',
  unadjustedDebit: 10000,
  unadjustedCredit: 0,
  adjustments: [],
  adjustedDebit: 10000,
  adjustedCredit: 0,
  isWarning: false,
  notes: null,
  displayOrder: 1,
};

const testAdjustmentColumn = {
  id: TEST_COLUMN_ID,
  wtbId: TEST_WTB_ID,
  columnName: 'Audit Adjustments',
  columnType: 'ADJUSTING' as const,
  journalEntryId: null,
  description: 'Auditor-proposed adjustments',
  displayOrder: 1,
  createdAt: new Date(),
  createdBy: {
    id: TEST_USER_ID,
    name: 'Test User',
    email: 'test@example.com',
  },
};

const testGetWTBResult = {
  ...testWorkingTB,
  lines: [testWTBLine],
  adjustmentColumns: [testAdjustmentColumn],
  fiscalYear: {
    id: TEST_FISCAL_YEAR_ID,
    yearCode: 'FY2024',
    yearName: 'Fiscal Year 2024',
  },
  period: {
    id: TEST_PERIOD_ID,
    periodCode: 'P12',
    periodName: 'December 2024',
  },
  totals: {
    unadjustedDebit: 10000,
    unadjustedCredit: 10000,
    adjustedDebit: 10000,
    adjustedCredit: 10000,
  },
  isBalanced: true,
};

describe('TrialBalanceRouter', () => {
  const createCaller = createCallerFactory(router({ trialBalance: trialBalanceRouter }));
  const caller = createCaller(mockContext);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // TRIAL BALANCE GENERATION
  // ===========================================================================

  describe('generate', () => {
    it('should generate a trial balance as of a date', async () => {
      vi.mocked(TrialBalanceService.prototype.generate).mockResolvedValue(testTrialBalanceResult);

      const result = await caller.trialBalance.generate({
        asOfDate: new Date('2024-01-31'),
      });

      expect(result).toBeDefined();
      expect(result.lines).toHaveLength(1);
      expect(result.isBalanced).toBe(true);
      expect(TrialBalanceService.prototype.generate).toHaveBeenCalled();
    });

    it('should generate with account class filter', async () => {
      vi.mocked(TrialBalanceService.prototype.generate).mockResolvedValue(testTrialBalanceResult);

      await caller.trialBalance.generate({
        asOfDate: new Date('2024-01-31'),
        accountClassFilter: [1, 2],
      });

      expect(TrialBalanceService.prototype.generate).toHaveBeenCalledWith(
        expect.objectContaining({ accountClassFilter: [1, 2] })
      );
    });

    it('should generate with grouping', async () => {
      vi.mocked(TrialBalanceService.prototype.generate).mockResolvedValue({
        ...testTrialBalanceResult,
        metadata: { ...testTrialBalanceResult.metadata, groupBy: 'CLASS' as const },
      });

      const result = await caller.trialBalance.generate({
        asOfDate: new Date('2024-01-31'),
        groupBy: 'CLASS',
      });

      expect(result.metadata.groupBy).toBe('CLASS');
    });

    it('should include zero balances when requested', async () => {
      vi.mocked(TrialBalanceService.prototype.generate).mockResolvedValue({
        ...testTrialBalanceResult,
        metadata: { ...testTrialBalanceResult.metadata, includeZeroBalances: true },
      });

      await caller.trialBalance.generate({
        asOfDate: new Date('2024-01-31'),
        includeZeroBalances: true,
      });

      expect(TrialBalanceService.prototype.generate).toHaveBeenCalledWith(
        expect.objectContaining({ includeZeroBalances: true })
      );
    });

    it('should filter by account code range', async () => {
      vi.mocked(TrialBalanceService.prototype.generate).mockResolvedValue(testTrialBalanceResult);

      await caller.trialBalance.generate({
        asOfDate: new Date('2024-01-31'),
        accountCodeFrom: '100',
        accountCodeTo: '199',
      });

      expect(TrialBalanceService.prototype.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          accountCodeFrom: '100',
          accountCodeTo: '199',
        })
      );
    });
  });

  describe('generateComparative', () => {
    it('should generate a comparative trial balance', async () => {
      vi.mocked(TrialBalanceService.prototype.generateComparative).mockResolvedValue(testComparativeResult);

      const result = await caller.trialBalance.generateComparative({
        currentAsOfDate: new Date('2024-01-31'),
        comparePeriods: [{ asOfDate: new Date('2023-12-31'), label: 'Dec 2023' }],
      });

      expect(result).toBeDefined();
      expect(result.lines[0].variances).toHaveLength(1);
      expect(TrialBalanceService.prototype.generateComparative).toHaveBeenCalled();
    });

    it('should generate with variance threshold', async () => {
      vi.mocked(TrialBalanceService.prototype.generateComparative).mockResolvedValue(testComparativeResult);

      await caller.trialBalance.generateComparative({
        currentAsOfDate: new Date('2024-01-31'),
        comparePeriods: [{ asOfDate: new Date('2023-12-31'), label: 'Dec 2023' }],
        highlightThreshold: 20,
      });

      expect(TrialBalanceService.prototype.generateComparative).toHaveBeenCalledWith(
        expect.objectContaining({ highlightThreshold: 20 })
      );
    });

    it('should compare multiple periods', async () => {
      const multiPeriodResult = {
        ...testComparativeResult,
        comparePeriods: [
          { asOfDate: new Date('2023-12-31'), label: 'Dec 2023' },
          { asOfDate: new Date('2023-09-30'), label: 'Sep 2023' },
        ],
      };
      vi.mocked(TrialBalanceService.prototype.generateComparative).mockResolvedValue(multiPeriodResult);

      const result = await caller.trialBalance.generateComparative({
        currentAsOfDate: new Date('2024-01-31'),
        comparePeriods: [
          { asOfDate: new Date('2023-12-31'), label: 'Dec 2023' },
          { asOfDate: new Date('2023-09-30'), label: 'Sep 2023' },
        ],
      });

      expect(result.comparePeriods).toHaveLength(2);
    });
  });

  // ===========================================================================
  // WORKING TRIAL BALANCE MANAGEMENT
  // ===========================================================================

  describe('createWorkingTB', () => {
    it('should create a working trial balance', async () => {
      vi.mocked(TrialBalanceService.prototype.createWorkingTB).mockResolvedValue(testWorkingTB);

      const result = await caller.trialBalance.createWorkingTB({
        wtbName: 'Year-End 2024',
        fiscalYearId: TEST_FISCAL_YEAR_ID,
        asOfDate: new Date('2024-12-31'),
      });

      expect(result).toBeDefined();
      expect(result.wtbCode).toBe('WTB-2024-00001');
      expect(result.status).toBe('DRAFT');
      expect(TrialBalanceService.prototype.createWorkingTB).toHaveBeenCalled();
    });

    it('should create with description', async () => {
      vi.mocked(TrialBalanceService.prototype.createWorkingTB).mockResolvedValue(testWorkingTB);

      await caller.trialBalance.createWorkingTB({
        wtbName: 'Year-End 2024',
        description: 'Year-end working trial balance',
        fiscalYearId: TEST_FISCAL_YEAR_ID,
        asOfDate: new Date('2024-12-31'),
      });

      expect(TrialBalanceService.prototype.createWorkingTB).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Year-end working trial balance' })
      );
    });
  });

  describe('getWorkingTB', () => {
    it('should get a working trial balance with lines and columns', async () => {
      vi.mocked(TrialBalanceService.prototype.getWorkingTB).mockResolvedValue(testGetWTBResult);

      const result = await caller.trialBalance.getWorkingTB({
        wtbId: TEST_WTB_ID,
      });

      expect(result).toBeDefined();
      expect(result.lines).toHaveLength(1);
      expect(result.adjustmentColumns).toHaveLength(1);
      expect(result.fiscalYear).toBeDefined();
      expect(result.isBalanced).toBe(true);
    });
  });

  describe('listWorkingTB', () => {
    it('should list working trial balances with pagination', async () => {
      vi.mocked(TrialBalanceService.prototype.listWorkingTB).mockResolvedValue({
        workingTrialBalances: [
          {
            ...testWorkingTB,
            fiscalYear: { yearCode: 'FY2024', yearName: 'Fiscal Year 2024' },
            period: { periodCode: 'P12', periodName: 'December 2024' },
          },
        ],
        total: 1,
        hasMore: false,
      });

      const result = await caller.trialBalance.listWorkingTB({
        limit: 10,
        offset: 0,
      });

      expect(result.workingTrialBalances).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(TrialBalanceService.prototype.listWorkingTB).toHaveBeenCalled();
    });

    it('should filter by fiscal year', async () => {
      vi.mocked(TrialBalanceService.prototype.listWorkingTB).mockResolvedValue({
        workingTrialBalances: [],
        total: 0,
        hasMore: false,
      });

      await caller.trialBalance.listWorkingTB({
        fiscalYearId: TEST_FISCAL_YEAR_ID,
        limit: 10,
        offset: 0,
      });

      expect(TrialBalanceService.prototype.listWorkingTB).toHaveBeenCalledWith(
        expect.objectContaining({ fiscalYearId: TEST_FISCAL_YEAR_ID })
      );
    });

    it('should filter by status', async () => {
      vi.mocked(TrialBalanceService.prototype.listWorkingTB).mockResolvedValue({
        workingTrialBalances: [],
        total: 0,
        hasMore: false,
      });

      await caller.trialBalance.listWorkingTB({
        status: 'LOCKED',
        limit: 10,
        offset: 0,
      });

      expect(TrialBalanceService.prototype.listWorkingTB).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'LOCKED' })
      );
    });

    it('should search by name', async () => {
      vi.mocked(TrialBalanceService.prototype.listWorkingTB).mockResolvedValue({
        workingTrialBalances: [],
        total: 0,
        hasMore: false,
      });

      await caller.trialBalance.listWorkingTB({
        search: 'Year-End',
        limit: 10,
        offset: 0,
      });

      expect(TrialBalanceService.prototype.listWorkingTB).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Year-End' })
      );
    });
  });

  // ===========================================================================
  // ADJUSTMENT COLUMNS AND ADJUSTMENTS
  // ===========================================================================

  describe('addAdjustmentColumn', () => {
    it('should add an adjustment column to WTB', async () => {
      vi.mocked(TrialBalanceService.prototype.addAdjustmentColumn).mockResolvedValue(testAdjustmentColumn);

      const result = await caller.trialBalance.addAdjustmentColumn({
        wtbId: TEST_WTB_ID,
        columnName: 'Audit Adjustments',
        columnType: 'ADJUSTING',
      });

      expect(result).toBeDefined();
      expect(result.columnName).toBe('Audit Adjustments');
      expect(result.columnType).toBe('ADJUSTING');
      expect(TrialBalanceService.prototype.addAdjustmentColumn).toHaveBeenCalled();
    });

    it('should add column with journal entry link', async () => {
      const journalEntryId = '550e8400-e29b-41d4-a716-446655440007';
      vi.mocked(TrialBalanceService.prototype.addAdjustmentColumn).mockResolvedValue({
        ...testAdjustmentColumn,
        journalEntryId,
      });

      const result = await caller.trialBalance.addAdjustmentColumn({
        wtbId: TEST_WTB_ID,
        columnName: 'AJE-1',
        columnType: 'ADJUSTING',
        journalEntryId,
      });

      expect(result.journalEntryId).toBe(journalEntryId);
    });

    it('should add reclassification column', async () => {
      vi.mocked(TrialBalanceService.prototype.addAdjustmentColumn).mockResolvedValue({
        ...testAdjustmentColumn,
        columnType: 'RECLASSIFICATION' as const,
      });

      const result = await caller.trialBalance.addAdjustmentColumn({
        wtbId: TEST_WTB_ID,
        columnName: 'Reclass-1',
        columnType: 'RECLASSIFICATION',
      });

      expect(result.columnType).toBe('RECLASSIFICATION');
    });
  });

  describe('recordAdjustment', () => {
    it('should record an adjustment on a line', async () => {
      vi.mocked(TrialBalanceService.prototype.recordAdjustment).mockResolvedValue({
        success: true,
        line: {
          ...testWTBLine,
          adjustments: [
            {
              columnId: TEST_COLUMN_ID,
              amount: 500,
              reference: 'AJE-001',
              description: 'Audit adjustment',
              updatedAt: new Date().toISOString(),
              updatedBy: TEST_USER_ID,
            },
          ],
          adjustedDebit: 10500,
          adjustedCredit: 0,
        },
      });

      const result = await caller.trialBalance.recordAdjustment({
        wtbId: TEST_WTB_ID,
        columnId: TEST_COLUMN_ID,
        accountId: TEST_ACCOUNT_ID,
        amount: 500,
      });

      expect(result.success).toBe(true);
      expect(result.line.adjustments).toHaveLength(1);
      expect(result.line.adjustedDebit).toBe(10500);
    });

    it('should record a credit adjustment (negative amount)', async () => {
      vi.mocked(TrialBalanceService.prototype.recordAdjustment).mockResolvedValue({
        success: true,
        line: {
          ...testWTBLine,
          adjustments: [
            {
              columnId: TEST_COLUMN_ID,
              amount: -500,
              reference: null,
              description: null,
              updatedAt: new Date().toISOString(),
              updatedBy: TEST_USER_ID,
            },
          ],
          adjustedDebit: 9500,
          adjustedCredit: 0,
        },
      });

      const result = await caller.trialBalance.recordAdjustment({
        wtbId: TEST_WTB_ID,
        columnId: TEST_COLUMN_ID,
        accountId: TEST_ACCOUNT_ID,
        amount: -500,
      });

      expect(result.line.adjustedDebit).toBe(9500);
    });

    it('should record adjustment with reference and description', async () => {
      vi.mocked(TrialBalanceService.prototype.recordAdjustment).mockResolvedValue({
        success: true,
        line: testWTBLine,
      });

      await caller.trialBalance.recordAdjustment({
        wtbId: TEST_WTB_ID,
        columnId: TEST_COLUMN_ID,
        accountId: TEST_ACCOUNT_ID,
        amount: 500,
        reference: 'AJE-001',
        description: 'Revenue recognition adjustment',
      });

      expect(TrialBalanceService.prototype.recordAdjustment).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'AJE-001',
          description: 'Revenue recognition adjustment',
        })
      );
    });
  });

  // ===========================================================================
  // LOCK AND DELETE
  // ===========================================================================

  describe('lock', () => {
    it('should lock a working trial balance', async () => {
      const lockedWTB = {
        ...testWorkingTB,
        status: 'LOCKED' as const,
        lockedAt: new Date(),
        lockedBy: {
          id: TEST_USER_ID,
          name: 'Test User',
          email: 'test@example.com',
        },
      };
      vi.mocked(TrialBalanceService.prototype.lock).mockResolvedValue(lockedWTB);

      const result = await caller.trialBalance.lock({
        wtbId: TEST_WTB_ID,
      });

      expect(result.status).toBe('LOCKED');
      expect(result.lockedAt).toBeDefined();
      expect(result.lockedBy).toBeDefined();
    });

    it('should lock with reason', async () => {
      vi.mocked(TrialBalanceService.prototype.lock).mockResolvedValue({
        ...testWorkingTB,
        status: 'LOCKED' as const,
        lockedAt: new Date(),
        lockedBy: {
          id: TEST_USER_ID,
          name: 'Test User',
          email: 'test@example.com',
        },
      });

      await caller.trialBalance.lock({
        wtbId: TEST_WTB_ID,
        lockReason: 'Approved by audit committee',
      });

      expect(TrialBalanceService.prototype.lock).toHaveBeenCalledWith(
        expect.objectContaining({ lockReason: 'Approved by audit committee' })
      );
    });
  });

  describe('delete', () => {
    it('should delete a working trial balance', async () => {
      vi.mocked(TrialBalanceService.prototype.delete).mockResolvedValue({
        success: true,
        wtbId: TEST_WTB_ID,
        wtbCode: 'WTB-2024-00001',
      });

      const result = await caller.trialBalance.delete({
        wtbId: TEST_WTB_ID,
      });

      expect(result.success).toBe(true);
      expect(result.wtbId).toBe(TEST_WTB_ID);
      expect(TrialBalanceService.prototype.delete).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // EXPORT
  // ===========================================================================

  describe('export', () => {
    it('should export trial balance to Excel', async () => {
      vi.mocked(TrialBalanceService.prototype.export).mockResolvedValue({
        filename: 'trial-balance-2024-01-31.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        data: 'base64-encoded-data',
      });

      const result = await caller.trialBalance.export({
        asOfDate: new Date('2024-01-31'),
        format: 'XLSX',
      });

      expect(result.filename).toContain('.xlsx');
      expect(result.contentType).toContain('spreadsheetml');
    });

    it('should export trial balance to PDF', async () => {
      vi.mocked(TrialBalanceService.prototype.export).mockResolvedValue({
        filename: 'trial-balance-2024-01-31.pdf',
        contentType: 'application/pdf',
        data: 'base64-encoded-data',
      });

      const result = await caller.trialBalance.export({
        asOfDate: new Date('2024-01-31'),
        format: 'PDF',
      });

      expect(result.filename).toContain('.pdf');
      expect(result.contentType).toBe('application/pdf');
    });

    it('should export trial balance to CSV', async () => {
      vi.mocked(TrialBalanceService.prototype.export).mockResolvedValue({
        filename: 'trial-balance-2024-01-31.csv',
        contentType: 'text/csv',
        data: 'base64-encoded-data',
      });

      const result = await caller.trialBalance.export({
        asOfDate: new Date('2024-01-31'),
        format: 'CSV',
      });

      expect(result.filename).toContain('.csv');
      expect(result.contentType).toBe('text/csv');
    });

    it('should export with landscape orientation', async () => {
      vi.mocked(TrialBalanceService.prototype.export).mockResolvedValue({
        filename: 'trial-balance-2024-01-31.pdf',
        contentType: 'application/pdf',
        data: 'base64-encoded-data',
      });

      await caller.trialBalance.export({
        asOfDate: new Date('2024-01-31'),
        format: 'PDF',
        pageOrientation: 'LANDSCAPE',
      });

      expect(TrialBalanceService.prototype.export).toHaveBeenCalledWith(
        expect.objectContaining({ pageOrientation: 'LANDSCAPE' })
      );
    });

    it('should export with company header', async () => {
      vi.mocked(TrialBalanceService.prototype.export).mockResolvedValue({
        filename: 'trial-balance-2024-01-31.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        data: 'base64-encoded-data',
      });

      await caller.trialBalance.export({
        asOfDate: new Date('2024-01-31'),
        format: 'XLSX',
        includeCompanyHeader: true,
      });

      expect(TrialBalanceService.prototype.export).toHaveBeenCalledWith(
        expect.objectContaining({ includeCompanyHeader: true })
      );
    });
  });
});
