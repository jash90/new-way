import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generalLedgerRouter } from '../../routers/ace/general-ledger.router';
import { GeneralLedgerService } from '../../services/ace/general-ledger.service';
import { router, createCallerFactory } from '../../trpc';
import type { Context } from '../../trpc';

// ===========================================================================
// MOCKS
// ===========================================================================

vi.mock('../../services/ace/general-ledger.service');

const mockSession = {
  userId: 'user-123',
  organizationId: 'org-456',
  email: 'test@example.com',
  role: 'admin' as const,
  permissions: ['*'],
};

const mockContext: Context = {
  prisma: {} as any,
  redis: {} as any,
  auditLogger: { log: vi.fn() } as any,
  session: mockSession,
};

const createCaller = createCallerFactory(router({ generalLedger: generalLedgerRouter }));
const caller = createCaller(mockContext);

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_PERIOD_ID = '660e8400-e29b-41d4-a716-446655440002';
const TEST_ENTRY_ID = '770e8400-e29b-41d4-a716-446655440003';

const testLedgerEntry = {
  id: 'gl-1',
  entryDate: new Date('2024-01-15'),
  entryNumber: 'PK/01/2024/0001',
  entryType: 'STANDARD',
  entryId: TEST_ENTRY_ID,
  description: 'Test entry',
  reference: 'INV-001',
  debitAmount: 1000,
  creditAmount: 0,
  runningBalance: 1000,
  costCenterName: null,
  projectName: null,
  postedAt: new Date('2024-01-15'),
};

const testAccountLedger = {
  account: {
    id: TEST_ACCOUNT_ID,
    accountCode: '100-000',
    accountName: 'Cash',
    accountType: 'ASSET',
    normalBalance: 'DEBIT' as const,
  },
  period: {
    name: 'January 2024',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
  },
  openingBalance: 0,
  entries: [testLedgerEntry],
  totals: {
    debitTotal: 1000,
    creditTotal: 0,
    netMovement: 1000,
    closingBalance: 1000,
  },
  pagination: {
    total: 1,
    limit: 100,
    offset: 0,
    hasMore: false,
  },
};

const testGLReport = {
  reportTitle: 'General Ledger Report',
  period: 'January 2024',
  generatedAt: new Date('2024-01-31'),
  accounts: [
    {
      accountId: TEST_ACCOUNT_ID,
      accountCode: '100-000',
      accountName: 'Cash',
      accountType: 'ASSET',
      openingBalance: 0,
      debitMovements: 5000,
      creditMovements: 2000,
      closingBalance: 3000,
      entryCount: 10,
    },
  ],
  groupedByType: {
    ASSET: [
      {
        accountId: TEST_ACCOUNT_ID,
        accountCode: '100-000',
        accountName: 'Cash',
        accountType: 'ASSET',
        openingBalance: 0,
        debitMovements: 5000,
        creditMovements: 2000,
        closingBalance: 3000,
        entryCount: 10,
      },
    ],
  },
  totals: {
    totalDebits: 5000,
    totalCredits: 2000,
    accountCount: 1,
    entryCount: 10,
  },
};

const testAccountBalance = {
  accountId: TEST_ACCOUNT_ID,
  accountCode: '100-000',
  accountName: 'Cash',
  asOfDate: new Date('2024-01-31'),
  debitTotal: 5000,
  creditTotal: 2000,
  balance: 3000,
};

const testAccountBalances = [
  {
    accountId: TEST_ACCOUNT_ID,
    accountCode: '100-000',
    accountName: 'Cash',
    accountType: 'ASSET',
    openingBalance: 0,
    debitMovements: 5000,
    creditMovements: 2000,
    closingBalance: 3000,
  },
];

const testRecalculateResult = {
  success: true,
  accountId: TEST_ACCOUNT_ID,
  periodId: TEST_PERIOD_ID,
  openingBalance: 0,
  debitMovements: 5000,
  creditMovements: 2000,
  closingBalance: 3000,
};

const testPostResult = {
  success: true,
  entryId: TEST_ENTRY_ID,
  recordsCreated: 2,
  balancesUpdated: 2,
};

const testBatchRecalculateResult = {
  success: true,
  accountsProcessed: 5,
  errors: [],
};

// ===========================================================================
// TESTS
// ===========================================================================

describe('generalLedgerRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // ACCOUNT LEDGER
  // =========================================================================

  describe('getAccountLedger', () => {
    it('should return account ledger with entries', async () => {
      vi.mocked(GeneralLedgerService.prototype.getAccountLedger).mockResolvedValue(testAccountLedger);

      const result = await caller.generalLedger.getAccountLedger({
        accountId: TEST_ACCOUNT_ID,
      });

      expect(result.account.id).toBe(TEST_ACCOUNT_ID);
      expect(result.entries).toHaveLength(1);
      expect(result.totals.closingBalance).toBe(1000);
      expect(GeneralLedgerService.prototype.getAccountLedger).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: TEST_ACCOUNT_ID,
        })
      );
    });

    it('should filter by period', async () => {
      vi.mocked(GeneralLedgerService.prototype.getAccountLedger).mockResolvedValue(testAccountLedger);

      await caller.generalLedger.getAccountLedger({
        accountId: TEST_ACCOUNT_ID,
        periodId: TEST_PERIOD_ID,
      });

      expect(GeneralLedgerService.prototype.getAccountLedger).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: TEST_ACCOUNT_ID,
          periodId: TEST_PERIOD_ID,
        })
      );
    });

    it('should filter by date range', async () => {
      vi.mocked(GeneralLedgerService.prototype.getAccountLedger).mockResolvedValue(testAccountLedger);

      const dateRange = {
        from: new Date('2024-01-01'),
        to: new Date('2024-01-31'),
      };

      await caller.generalLedger.getAccountLedger({
        accountId: TEST_ACCOUNT_ID,
        dateRange,
      });

      expect(GeneralLedgerService.prototype.getAccountLedger).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: TEST_ACCOUNT_ID,
          dateRange: expect.objectContaining({
            from: expect.any(Date),
            to: expect.any(Date),
          }),
        })
      );
    });

    it('should support search and entry type filters', async () => {
      vi.mocked(GeneralLedgerService.prototype.getAccountLedger).mockResolvedValue(testAccountLedger);

      await caller.generalLedger.getAccountLedger({
        accountId: TEST_ACCOUNT_ID,
        entryTypes: ['STANDARD', 'ADJUSTMENT'],
        search: 'invoice',
      });

      expect(GeneralLedgerService.prototype.getAccountLedger).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: TEST_ACCOUNT_ID,
          entryTypes: ['STANDARD', 'ADJUSTMENT'],
          search: 'invoice',
        })
      );
    });

    it('should support pagination', async () => {
      vi.mocked(GeneralLedgerService.prototype.getAccountLedger).mockResolvedValue(testAccountLedger);

      await caller.generalLedger.getAccountLedger({
        accountId: TEST_ACCOUNT_ID,
        limit: 50,
        offset: 100,
      });

      expect(GeneralLedgerService.prototype.getAccountLedger).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: TEST_ACCOUNT_ID,
          limit: 50,
          offset: 100,
        })
      );
    });

    it('should support order by option', async () => {
      vi.mocked(GeneralLedgerService.prototype.getAccountLedger).mockResolvedValue(testAccountLedger);

      await caller.generalLedger.getAccountLedger({
        accountId: TEST_ACCOUNT_ID,
        orderBy: 'date_desc',
      });

      expect(GeneralLedgerService.prototype.getAccountLedger).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: TEST_ACCOUNT_ID,
          orderBy: 'date_desc',
        })
      );
    });
  });

  // =========================================================================
  // FULL GL REPORT
  // =========================================================================

  describe('getFullReport', () => {
    it('should return full GL report', async () => {
      vi.mocked(GeneralLedgerService.prototype.getFullReport).mockResolvedValue(testGLReport);

      const result = await caller.generalLedger.getFullReport({
        periodId: TEST_PERIOD_ID,
      });

      expect(result.reportTitle).toBe('General Ledger Report');
      expect(result.accounts).toHaveLength(1);
      expect(result.totals.totalDebits).toBe(5000);
      expect(GeneralLedgerService.prototype.getFullReport).toHaveBeenCalledWith(
        expect.objectContaining({
          periodId: TEST_PERIOD_ID,
        })
      );
    });

    it('should filter by account types', async () => {
      vi.mocked(GeneralLedgerService.prototype.getFullReport).mockResolvedValue(testGLReport);

      await caller.generalLedger.getFullReport({
        periodId: TEST_PERIOD_ID,
        accountTypes: ['ASSET', 'LIABILITY'],
      });

      expect(GeneralLedgerService.prototype.getFullReport).toHaveBeenCalledWith(
        expect.objectContaining({
          periodId: TEST_PERIOD_ID,
          accountTypes: ['ASSET', 'LIABILITY'],
        })
      );
    });

    it('should include zero balance accounts when requested', async () => {
      vi.mocked(GeneralLedgerService.prototype.getFullReport).mockResolvedValue(testGLReport);

      await caller.generalLedger.getFullReport({
        periodId: TEST_PERIOD_ID,
        includeZeroBalance: true,
      });

      expect(GeneralLedgerService.prototype.getFullReport).toHaveBeenCalledWith(
        expect.objectContaining({
          periodId: TEST_PERIOD_ID,
          includeZeroBalance: true,
        })
      );
    });

    it('should group by type when requested', async () => {
      vi.mocked(GeneralLedgerService.prototype.getFullReport).mockResolvedValue(testGLReport);

      await caller.generalLedger.getFullReport({
        periodId: TEST_PERIOD_ID,
        groupByType: true,
      });

      expect(GeneralLedgerService.prototype.getFullReport).toHaveBeenCalledWith(
        expect.objectContaining({
          periodId: TEST_PERIOD_ID,
          groupByType: true,
        })
      );
    });

    it('should filter by date range', async () => {
      vi.mocked(GeneralLedgerService.prototype.getFullReport).mockResolvedValue(testGLReport);

      const dateRange = {
        from: new Date('2024-01-01'),
        to: new Date('2024-03-31'),
      };

      await caller.generalLedger.getFullReport({ dateRange });

      expect(GeneralLedgerService.prototype.getFullReport).toHaveBeenCalledWith(
        expect.objectContaining({
          dateRange: expect.objectContaining({
            from: expect.any(Date),
            to: expect.any(Date),
          }),
        })
      );
    });
  });

  // =========================================================================
  // ACCOUNT BALANCE
  // =========================================================================

  describe('getAccountBalance', () => {
    it('should return account balance as of date', async () => {
      vi.mocked(GeneralLedgerService.prototype.getAccountBalance).mockResolvedValue(testAccountBalance);

      const result = await caller.generalLedger.getAccountBalance({
        accountId: TEST_ACCOUNT_ID,
        asOfDate: new Date('2024-01-31'),
      });

      expect(result.accountId).toBe(TEST_ACCOUNT_ID);
      expect(result.balance).toBe(3000);
      expect(GeneralLedgerService.prototype.getAccountBalance).toHaveBeenCalled();
    });
  });

  describe('getAccountBalances', () => {
    it('should return multiple account balances', async () => {
      vi.mocked(GeneralLedgerService.prototype.getAccountBalances).mockResolvedValue(testAccountBalances);

      const result = await caller.generalLedger.getAccountBalances({
        accountIds: [TEST_ACCOUNT_ID],
        periodId: TEST_PERIOD_ID,
      });

      expect(result).toHaveLength(1);
      expect(result[0].closingBalance).toBe(3000);
      expect(GeneralLedgerService.prototype.getAccountBalances).toHaveBeenCalledWith({
        accountIds: [TEST_ACCOUNT_ID],
        periodId: TEST_PERIOD_ID,
      });
    });
  });

  // =========================================================================
  // RECALCULATE BALANCE
  // =========================================================================

  describe('recalculateBalance', () => {
    it('should recalculate balance for account/period', async () => {
      vi.mocked(GeneralLedgerService.prototype.recalculateBalance).mockResolvedValue(testRecalculateResult);

      const result = await caller.generalLedger.recalculateBalance({
        accountId: TEST_ACCOUNT_ID,
        periodId: TEST_PERIOD_ID,
      });

      expect(result.success).toBe(true);
      expect(result.closingBalance).toBe(3000);
      expect(GeneralLedgerService.prototype.recalculateBalance).toHaveBeenCalledWith({
        accountId: TEST_ACCOUNT_ID,
        periodId: TEST_PERIOD_ID,
      });
    });
  });

  describe('batchRecalculateBalances', () => {
    it('should batch recalculate balances for period', async () => {
      vi.mocked(GeneralLedgerService.prototype.batchRecalculateBalances).mockResolvedValue(testBatchRecalculateResult);

      const result = await caller.generalLedger.batchRecalculateBalances({
        periodId: TEST_PERIOD_ID,
      });

      expect(result.success).toBe(true);
      expect(result.accountsProcessed).toBe(5);
      expect(GeneralLedgerService.prototype.batchRecalculateBalances).toHaveBeenCalledWith({
        periodId: TEST_PERIOD_ID,
      });
    });

    it('should recalculate specific accounts when provided', async () => {
      vi.mocked(GeneralLedgerService.prototype.batchRecalculateBalances).mockResolvedValue(testBatchRecalculateResult);

      await caller.generalLedger.batchRecalculateBalances({
        periodId: TEST_PERIOD_ID,
        accountIds: [TEST_ACCOUNT_ID],
      });

      expect(GeneralLedgerService.prototype.batchRecalculateBalances).toHaveBeenCalledWith({
        periodId: TEST_PERIOD_ID,
        accountIds: [TEST_ACCOUNT_ID],
      });
    });
  });

  // =========================================================================
  // POST TO GL
  // =========================================================================

  describe('postToGL', () => {
    it('should post journal entry to general ledger', async () => {
      vi.mocked(GeneralLedgerService.prototype.postToGL).mockResolvedValue(testPostResult);

      const result = await caller.generalLedger.postToGL({
        entryId: TEST_ENTRY_ID,
      });

      expect(result.success).toBe(true);
      expect(result.recordsCreated).toBe(2);
      expect(result.balancesUpdated).toBe(2);
      expect(GeneralLedgerService.prototype.postToGL).toHaveBeenCalledWith({
        entryId: TEST_ENTRY_ID,
      });
    });
  });
});
