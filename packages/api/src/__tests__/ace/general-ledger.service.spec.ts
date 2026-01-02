import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeneralLedgerService } from '../../services/ace/general-ledger.service';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../lib/audit-logger';

// ===========================================================================
// MOCKS
// ===========================================================================

const mockPrisma = {
  generalLedger: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  accountBalances: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  chartOfAccounts: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  accountingPeriods: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  fiscalYears: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  journalEntries: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  journalLines: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn((fn) => fn(mockPrisma)),
} as unknown as PrismaClient;

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
} as unknown as Redis;

const mockAuditLogger = {
  log: vi.fn(),
} as unknown as AuditLogger;

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_ORG_ID = 'org-123';
const TEST_USER_ID = 'user-456';
const TEST_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_PERIOD_ID = '660e8400-e29b-41d4-a716-446655440002';
const TEST_ENTRY_ID = '770e8400-e29b-41d4-a716-446655440003';
const TEST_FISCAL_YEAR_ID = '880e8400-e29b-41d4-a716-446655440004';

const testAccount = {
  id: TEST_ACCOUNT_ID,
  organizationId: TEST_ORG_ID,
  accountCode: '100',
  accountName: 'Kasa',
  accountType: 'ASSET',
  normalBalance: 'DEBIT' as const,
  isActive: true,
};

const testPeriod = {
  id: TEST_PERIOD_ID,
  fiscalYearId: TEST_FISCAL_YEAR_ID,
  periodName: 'Styczeń 2024',
  periodNumber: 1,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  status: 'OPEN',
};

const testFiscalYear = {
  id: TEST_FISCAL_YEAR_ID,
  organizationId: TEST_ORG_ID,
  yearName: 'FY 2024',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  status: 'OPEN',
};

const testGLRecords = [
  {
    id: 'gl-1',
    organizationId: TEST_ORG_ID,
    entryId: TEST_ENTRY_ID,
    lineId: 'line-1',
    accountId: TEST_ACCOUNT_ID,
    periodId: TEST_PERIOD_ID,
    entryDate: new Date('2024-01-05'),
    entryNumber: 'JE/2024/01/001',
    entryType: 'STANDARD',
    debitAmount: 5000,
    creditAmount: 0,
    description: 'Opening cash balance',
    reference: 'OB-001',
    costCenterId: null,
    projectId: null,
    postedAt: new Date('2024-01-05T10:00:00Z'),
    createdAt: new Date('2024-01-05T10:00:00Z'),
    costCenter: null,
    project: null,
  },
  {
    id: 'gl-2',
    organizationId: TEST_ORG_ID,
    entryId: 'entry-2',
    lineId: 'line-2',
    accountId: TEST_ACCOUNT_ID,
    periodId: TEST_PERIOD_ID,
    entryDate: new Date('2024-01-15'),
    entryNumber: 'JE/2024/01/002',
    entryType: 'STANDARD',
    debitAmount: 1000,
    creditAmount: 0,
    description: 'Cash withdrawal from bank',
    reference: null,
    costCenterId: null,
    projectId: null,
    postedAt: new Date('2024-01-15T14:00:00Z'),
    createdAt: new Date('2024-01-15T14:00:00Z'),
    costCenter: null,
    project: null,
  },
  {
    id: 'gl-3',
    organizationId: TEST_ORG_ID,
    entryId: 'entry-3',
    lineId: 'line-3',
    accountId: TEST_ACCOUNT_ID,
    periodId: TEST_PERIOD_ID,
    entryDate: new Date('2024-01-20'),
    entryNumber: 'JE/2024/01/003',
    entryType: 'STANDARD',
    debitAmount: 0,
    creditAmount: 2000,
    description: 'Cash payment to supplier',
    reference: 'INV-001',
    costCenterId: null,
    projectId: null,
    postedAt: new Date('2024-01-20T09:00:00Z'),
    createdAt: new Date('2024-01-20T09:00:00Z'),
    costCenter: null,
    project: null,
  },
];

const testAccountBalance = {
  id: 'balance-1',
  accountId: TEST_ACCOUNT_ID,
  periodId: TEST_PERIOD_ID,
  openingBalance: 0,
  debitMovements: 6000,
  creditMovements: 2000,
  closingBalance: 4000,
  lastUpdated: new Date(),
};

// ===========================================================================
// TESTS
// ===========================================================================

describe('GeneralLedgerService', () => {
  let service: GeneralLedgerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GeneralLedgerService(
      mockPrisma,
      mockRedis,
      mockAuditLogger,
      TEST_USER_ID,
      TEST_ORG_ID
    );
  });

  // =========================================================================
  // GET ACCOUNT LEDGER
  // =========================================================================

  describe('getAccountLedger', () => {
    it('should return ledger entries with running balance', async () => {
      mockPrisma.chartOfAccounts.findFirst = vi.fn().mockResolvedValue(testAccount);
      mockPrisma.generalLedger.findMany = vi.fn().mockResolvedValue(testGLRecords);
      mockPrisma.generalLedger.count = vi.fn().mockResolvedValue(3);
      mockPrisma.generalLedger.aggregate = vi.fn().mockResolvedValue({
        _sum: { debitAmount: 0, creditAmount: 0 },
      });

      const result = await service.getAccountLedger({
        accountId: TEST_ACCOUNT_ID,
        includeRunningBalance: true,
        orderBy: 'date_asc', // Required for running balance calculation
      });

      expect(result.account.id).toBe(TEST_ACCOUNT_ID);
      expect(result.account.accountCode).toBe('100');
      expect(result.entries.length).toBe(3);
      expect(result.entries[0].runningBalance).toBeDefined();
      expect(result.entries[2].runningBalance).toBe(4000); // 5000 + 1000 - 2000
      expect(result.totals.closingBalance).toBe(4000);
    });

    it('should filter by date range', async () => {
      mockPrisma.chartOfAccounts.findFirst = vi.fn().mockResolvedValue(testAccount);
      mockPrisma.generalLedger.findMany = vi.fn().mockResolvedValue([testGLRecords[1]]);
      mockPrisma.generalLedger.count = vi.fn().mockResolvedValue(1);
      mockPrisma.generalLedger.aggregate = vi.fn().mockResolvedValue({
        _sum: { debitAmount: 5000, creditAmount: 0 },
      });

      const result = await service.getAccountLedger({
        accountId: TEST_ACCOUNT_ID,
        dateRange: {
          from: new Date('2024-01-10'),
          to: new Date('2024-01-18'),
        },
      });

      expect(result.entries.length).toBe(1);
      expect(result.openingBalance).toBe(5000);
      expect(mockPrisma.generalLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entryDate: {
              gte: new Date('2024-01-10'),
              lte: new Date('2024-01-18'),
            },
          }),
        })
      );
    });

    it('should filter by period', async () => {
      mockPrisma.chartOfAccounts.findFirst = vi.fn().mockResolvedValue(testAccount);
      mockPrisma.accountingPeriods.findFirst = vi.fn().mockResolvedValue(testPeriod);
      mockPrisma.generalLedger.findMany = vi.fn().mockResolvedValue(testGLRecords);
      mockPrisma.generalLedger.count = vi.fn().mockResolvedValue(3);
      mockPrisma.generalLedger.aggregate = vi.fn().mockResolvedValue({
        _sum: { debitAmount: 0, creditAmount: 0 },
      });

      const result = await service.getAccountLedger({
        accountId: TEST_ACCOUNT_ID,
        periodId: TEST_PERIOD_ID,
      });

      expect(result.period).toBeDefined();
      expect(result.period?.name).toBe('Styczeń 2024');
      expect(mockPrisma.generalLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            periodId: TEST_PERIOD_ID,
          }),
        })
      );
    });

    it('should filter by entry types', async () => {
      mockPrisma.chartOfAccounts.findFirst = vi.fn().mockResolvedValue(testAccount);
      mockPrisma.generalLedger.findMany = vi.fn().mockResolvedValue([testGLRecords[0]]);
      mockPrisma.generalLedger.count = vi.fn().mockResolvedValue(1);
      mockPrisma.generalLedger.aggregate = vi.fn().mockResolvedValue({
        _sum: { debitAmount: 0, creditAmount: 0 },
      });

      await service.getAccountLedger({
        accountId: TEST_ACCOUNT_ID,
        entryTypes: ['ADJUSTMENT'],
      });

      expect(mockPrisma.generalLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entryType: { in: ['ADJUSTMENT'] },
          }),
        })
      );
    });

    it('should search in description and reference', async () => {
      mockPrisma.chartOfAccounts.findFirst = vi.fn().mockResolvedValue(testAccount);
      mockPrisma.generalLedger.findMany = vi.fn().mockResolvedValue([testGLRecords[2]]);
      mockPrisma.generalLedger.count = vi.fn().mockResolvedValue(1);
      mockPrisma.generalLedger.aggregate = vi.fn().mockResolvedValue({
        _sum: { debitAmount: 0, creditAmount: 0 },
      });

      await service.getAccountLedger({
        accountId: TEST_ACCOUNT_ID,
        search: 'invoice',
      });

      expect(mockPrisma.generalLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ description: expect.any(Object) }),
              expect.objectContaining({ reference: expect.any(Object) }),
              expect.objectContaining({ entryNumber: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    it('should handle pagination', async () => {
      mockPrisma.chartOfAccounts.findFirst = vi.fn().mockResolvedValue(testAccount);
      mockPrisma.generalLedger.findMany = vi.fn().mockResolvedValue([testGLRecords[1]]);
      mockPrisma.generalLedger.count = vi.fn().mockResolvedValue(3);
      mockPrisma.generalLedger.aggregate = vi.fn().mockResolvedValue({
        _sum: { debitAmount: 0, creditAmount: 0 },
      });

      const result = await service.getAccountLedger({
        accountId: TEST_ACCOUNT_ID,
        limit: 1,
        offset: 1,
      });

      expect(result.entries.length).toBe(1);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.limit).toBe(1);
      expect(result.pagination.offset).toBe(1);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should throw if account not found', async () => {
      mockPrisma.chartOfAccounts.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.getAccountLedger({ accountId: 'invalid-id' })
      ).rejects.toThrow('Account not found');
    });

    it('should calculate running balance for credit-normal accounts', async () => {
      const creditAccount = { ...testAccount, normalBalance: 'CREDIT' as const };
      const creditRecords = [
        { ...testGLRecords[0], debitAmount: 0, creditAmount: 5000 },
        { ...testGLRecords[1], debitAmount: 0, creditAmount: 1000 },
        { ...testGLRecords[2], debitAmount: 2000, creditAmount: 0 },
      ];

      mockPrisma.chartOfAccounts.findFirst = vi.fn().mockResolvedValue(creditAccount);
      mockPrisma.generalLedger.findMany = vi.fn().mockResolvedValue(creditRecords);
      mockPrisma.generalLedger.count = vi.fn().mockResolvedValue(3);
      mockPrisma.generalLedger.aggregate = vi.fn().mockResolvedValue({
        _sum: { debitAmount: 0, creditAmount: 0 },
      });

      const result = await service.getAccountLedger({
        accountId: TEST_ACCOUNT_ID,
        includeRunningBalance: true,
        orderBy: 'date_asc', // Required for running balance calculation
      });

      // For credit-normal: balance = credits - debits
      expect(result.entries[0].runningBalance).toBe(5000);
      expect(result.entries[1].runningBalance).toBe(6000);
      expect(result.entries[2].runningBalance).toBe(4000);
    });
  });

  // =========================================================================
  // GET FULL GL REPORT
  // =========================================================================

  describe('getFullReport', () => {
    const testAccounts = [
      testAccount,
      {
        id: 'acc-2',
        organizationId: TEST_ORG_ID,
        accountCode: '200',
        accountName: 'Bank',
        accountType: 'ASSET',
        normalBalance: 'DEBIT' as const,
        isActive: true,
      },
      {
        id: 'acc-3',
        organizationId: TEST_ORG_ID,
        accountCode: '300',
        accountName: 'Zobowiązania',
        accountType: 'LIABILITY',
        normalBalance: 'CREDIT' as const,
        isActive: true,
      },
    ];

    it('should return full GL report with all accounts', async () => {
      mockPrisma.chartOfAccounts.findMany = vi.fn().mockResolvedValue(testAccounts);
      mockPrisma.accountingPeriods.findFirst = vi.fn().mockResolvedValue(testPeriod);
      mockPrisma.generalLedger.aggregate = vi.fn()
        .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } }) // opening for acc1
        .mockResolvedValueOnce({ _sum: { debitAmount: 6000, creditAmount: 2000 }, _count: 3 }) // movements for acc1
        .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } }) // opening for acc2
        .mockResolvedValueOnce({ _sum: { debitAmount: 10000, creditAmount: 5000 }, _count: 5 }) // movements for acc2
        .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } }) // opening for acc3
        .mockResolvedValueOnce({ _sum: { debitAmount: 1000, creditAmount: 8000 }, _count: 4 }); // movements for acc3

      const result = await service.getFullReport({
        periodId: TEST_PERIOD_ID,
        groupByType: true,
      });

      expect(result.reportTitle).toBe('General Ledger Report');
      expect(result.accounts.length).toBe(3);
      expect(result.groupedByType).toBeDefined();
      expect(result.groupedByType?.ASSET).toHaveLength(2);
      expect(result.groupedByType?.LIABILITY).toHaveLength(1);
      expect(result.totals.accountCount).toBe(3);
      expect(result.totals.entryCount).toBe(12);
    });

    it('should exclude zero balance accounts when requested', async () => {
      mockPrisma.chartOfAccounts.findMany = vi.fn().mockResolvedValue(testAccounts);
      mockPrisma.accountingPeriods.findFirst = vi.fn().mockResolvedValue(testPeriod);
      mockPrisma.generalLedger.aggregate = vi.fn()
        .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
        .mockResolvedValueOnce({ _sum: { debitAmount: 6000, creditAmount: 2000 }, _count: 3 })
        .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
        .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 }, _count: 0 }) // zero activity
        .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
        .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 }, _count: 0 }); // zero activity

      const result = await service.getFullReport({
        periodId: TEST_PERIOD_ID,
        includeZeroBalance: false,
      });

      expect(result.accounts.length).toBe(1);
      expect(result.accounts[0].accountCode).toBe('100');
    });

    it('should filter by account types', async () => {
      mockPrisma.chartOfAccounts.findMany = vi.fn().mockResolvedValue([testAccounts[0], testAccounts[1]]);
      mockPrisma.accountingPeriods.findFirst = vi.fn().mockResolvedValue(testPeriod);
      mockPrisma.generalLedger.aggregate = vi.fn()
        .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
        .mockResolvedValueOnce({ _sum: { debitAmount: 6000, creditAmount: 2000 }, _count: 3 })
        .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
        .mockResolvedValueOnce({ _sum: { debitAmount: 10000, creditAmount: 5000 }, _count: 5 });

      await service.getFullReport({
        periodId: TEST_PERIOD_ID,
        accountTypes: ['ASSET'],
      });

      expect(mockPrisma.chartOfAccounts.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountType: { in: ['ASSET'] },
          }),
        })
      );
    });

    it('should handle date range for report', async () => {
      mockPrisma.chartOfAccounts.findMany = vi.fn().mockResolvedValue([testAccount]);
      mockPrisma.generalLedger.aggregate = vi.fn()
        .mockResolvedValueOnce({ _sum: { debitAmount: 5000, creditAmount: 0 } })
        .mockResolvedValueOnce({ _sum: { debitAmount: 1000, creditAmount: 2000 }, _count: 2 });

      const result = await service.getFullReport({
        dateRange: {
          from: new Date('2024-01-10'),
          to: new Date('2024-01-31'),
        },
      });

      expect(result.accounts[0].openingBalance).toBe(5000);
    });

    it('should handle fiscal year filter', async () => {
      mockPrisma.chartOfAccounts.findMany = vi.fn().mockResolvedValue([testAccount]);
      mockPrisma.fiscalYears.findFirst = vi.fn().mockResolvedValue(testFiscalYear);
      mockPrisma.generalLedger.aggregate = vi.fn()
        .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
        .mockResolvedValueOnce({ _sum: { debitAmount: 50000, creditAmount: 20000 }, _count: 30 });

      const result = await service.getFullReport({
        fiscalYearId: TEST_FISCAL_YEAR_ID,
      });

      expect(result.period).toBe('FY 2024');
      expect(mockPrisma.fiscalYears.findFirst).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // GET ACCOUNT BALANCE
  // =========================================================================

  describe('getAccountBalance', () => {
    it('should return balance as of specific date', async () => {
      mockPrisma.chartOfAccounts.findFirst = vi.fn().mockResolvedValue(testAccount);
      mockPrisma.generalLedger.aggregate = vi.fn().mockResolvedValue({
        _sum: { debitAmount: 6000, creditAmount: 2000 },
      });

      const result = await service.getAccountBalance({
        accountId: TEST_ACCOUNT_ID,
        asOfDate: new Date('2024-01-31'),
      });

      expect(result.accountId).toBe(TEST_ACCOUNT_ID);
      expect(result.accountCode).toBe('100');
      expect(result.debitTotal).toBe(6000);
      expect(result.creditTotal).toBe(2000);
      expect(result.balance).toBe(4000); // debit normal: debits - credits
    });

    it('should calculate balance for credit-normal account', async () => {
      const creditAccount = { ...testAccount, normalBalance: 'CREDIT' as const };
      mockPrisma.chartOfAccounts.findFirst = vi.fn().mockResolvedValue(creditAccount);
      mockPrisma.generalLedger.aggregate = vi.fn().mockResolvedValue({
        _sum: { debitAmount: 2000, creditAmount: 8000 },
      });

      const result = await service.getAccountBalance({
        accountId: TEST_ACCOUNT_ID,
        asOfDate: new Date('2024-01-31'),
      });

      expect(result.balance).toBe(6000); // credit normal: credits - debits
    });

    it('should throw if account not found', async () => {
      mockPrisma.chartOfAccounts.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.getAccountBalance({
          accountId: 'invalid-id',
          asOfDate: new Date(),
        })
      ).rejects.toThrow('Account not found');
    });
  });

  // =========================================================================
  // GET ACCOUNT BALANCES (MULTIPLE)
  // =========================================================================

  describe('getAccountBalances', () => {
    it('should return balances for multiple accounts', async () => {
      const balances = [
        testAccountBalance,
        {
          ...testAccountBalance,
          id: 'balance-2',
          accountId: 'acc-2',
          openingBalance: 10000,
          debitMovements: 5000,
          creditMovements: 3000,
          closingBalance: 12000,
          account: {
            accountCode: '200',
            accountName: 'Bank',
            accountType: 'ASSET',
            normalBalance: 'DEBIT',
          },
        },
      ];

      mockPrisma.accountBalances.findMany = vi.fn().mockResolvedValue(
        balances.map((b, i) => ({
          ...b,
          account: i === 0
            ? { accountCode: '100', accountName: 'Kasa', accountType: 'ASSET', normalBalance: 'DEBIT' }
            : { accountCode: '200', accountName: 'Bank', accountType: 'ASSET', normalBalance: 'DEBIT' },
        }))
      );

      const result = await service.getAccountBalances({
        accountIds: [TEST_ACCOUNT_ID, 'acc-2'],
        periodId: TEST_PERIOD_ID,
      });

      expect(result.length).toBe(2);
      expect(result[0].accountCode).toBe('100');
      expect(result[0].closingBalance).toBe(4000);
      expect(result[1].accountCode).toBe('200');
      expect(result[1].closingBalance).toBe(12000);
    });
  });

  // =========================================================================
  // RECALCULATE BALANCE
  // =========================================================================

  describe('recalculateBalance', () => {
    it('should recalculate and update balance for account/period', async () => {
      mockPrisma.chartOfAccounts.findFirst = vi.fn().mockResolvedValue(testAccount);
      mockPrisma.accountingPeriods.findFirst = vi.fn().mockResolvedValue(testPeriod);
      mockPrisma.generalLedger.aggregate = vi.fn()
        .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } }) // prior movements
        .mockResolvedValueOnce({ _sum: { debitAmount: 6000, creditAmount: 2000 } }); // period movements

      mockPrisma.accountBalances.upsert = vi.fn().mockResolvedValue({
        id: 'balance-new',
        accountId: TEST_ACCOUNT_ID,
        periodId: TEST_PERIOD_ID,
        openingBalance: 0,
        debitMovements: 6000,
        creditMovements: 2000,
        closingBalance: 4000,
        lastUpdated: new Date(),
      });

      const result = await service.recalculateBalance({
        accountId: TEST_ACCOUNT_ID,
        periodId: TEST_PERIOD_ID,
      });

      expect(result.success).toBe(true);
      expect(result.openingBalance).toBe(0);
      expect(result.debitMovements).toBe(6000);
      expect(result.creditMovements).toBe(2000);
      expect(result.closingBalance).toBe(4000);
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should calculate opening balance from prior activity', async () => {
      mockPrisma.chartOfAccounts.findFirst = vi.fn().mockResolvedValue(testAccount);
      mockPrisma.accountingPeriods.findFirst = vi.fn().mockResolvedValue({
        ...testPeriod,
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-29'),
      });
      mockPrisma.generalLedger.aggregate = vi.fn()
        .mockResolvedValueOnce({ _sum: { debitAmount: 10000, creditAmount: 3000 } }) // prior movements -> OB = 7000
        .mockResolvedValueOnce({ _sum: { debitAmount: 5000, creditAmount: 2000 } }); // period movements

      mockPrisma.accountBalances.upsert = vi.fn().mockResolvedValue({
        id: 'balance-new',
        accountId: TEST_ACCOUNT_ID,
        periodId: TEST_PERIOD_ID,
        openingBalance: 7000,
        debitMovements: 5000,
        creditMovements: 2000,
        closingBalance: 10000,
        lastUpdated: new Date(),
      });

      const result = await service.recalculateBalance({
        accountId: TEST_ACCOUNT_ID,
        periodId: TEST_PERIOD_ID,
      });

      expect(result.openingBalance).toBe(7000);
      expect(result.closingBalance).toBe(10000);
    });

    it('should throw if account not found', async () => {
      mockPrisma.chartOfAccounts.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.recalculateBalance({
          accountId: 'invalid-id',
          periodId: TEST_PERIOD_ID,
        })
      ).rejects.toThrow('Account not found');
    });

    it('should throw if period not found', async () => {
      mockPrisma.chartOfAccounts.findFirst = vi.fn().mockResolvedValue(testAccount);
      mockPrisma.accountingPeriods.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.recalculateBalance({
          accountId: TEST_ACCOUNT_ID,
          periodId: 'invalid-period',
        })
      ).rejects.toThrow('Period not found');
    });
  });

  // =========================================================================
  // POST TO GL
  // =========================================================================

  describe('postToGL', () => {
    const testEntry = {
      id: TEST_ENTRY_ID,
      organizationId: TEST_ORG_ID,
      periodId: TEST_PERIOD_ID,
      entryNumber: 'JE/2024/01/001',
      entryDate: new Date('2024-01-15'),
      entryType: 'STANDARD',
      status: 'PENDING',
      description: 'Test entry',
      reference: null,
      period: testPeriod,
    };

    const testLines = [
      {
        id: 'line-1',
        entryId: TEST_ENTRY_ID,
        lineNumber: 1,
        accountId: TEST_ACCOUNT_ID,
        debitAmount: 1000,
        creditAmount: 0,
        description: 'Debit line',
        account: testAccount,
      },
      {
        id: 'line-2',
        entryId: TEST_ENTRY_ID,
        lineNumber: 2,
        accountId: 'acc-2',
        debitAmount: 0,
        creditAmount: 1000,
        description: 'Credit line',
        account: { ...testAccount, id: 'acc-2', accountCode: '200' },
      },
    ];

    it('should post journal entry to general ledger', async () => {
      mockPrisma.journalEntries.findFirst = vi.fn().mockResolvedValue(testEntry);
      mockPrisma.journalLines.findMany = vi.fn().mockResolvedValue(testLines);
      mockPrisma.generalLedger.createMany = vi.fn().mockResolvedValue({ count: 2 });
      mockPrisma.journalEntries.update = vi.fn().mockResolvedValue({
        ...testEntry,
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: TEST_USER_ID,
      });
      mockPrisma.accountBalances.upsert = vi.fn().mockResolvedValue({});
      mockRedis.keys = vi.fn().mockResolvedValue([]);

      const result = await service.postToGL({ entryId: TEST_ENTRY_ID });

      expect(result.success).toBe(true);
      expect(result.recordsCreated).toBe(2);
      expect(mockPrisma.generalLedger.createMany).toHaveBeenCalled();
      expect(mockPrisma.journalEntries.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEST_ENTRY_ID },
          data: expect.objectContaining({
            status: 'POSTED',
          }),
        })
      );
    });

    it('should throw if entry not found', async () => {
      mockPrisma.journalEntries.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.postToGL({ entryId: 'invalid-id' })
      ).rejects.toThrow('Journal entry not found');
    });

    it('should throw if entry already posted', async () => {
      mockPrisma.journalEntries.findFirst = vi.fn().mockResolvedValue({
        ...testEntry,
        status: 'POSTED',
      });

      await expect(
        service.postToGL({ entryId: TEST_ENTRY_ID })
      ).rejects.toThrow('Entry is already posted');
    });

    it('should throw if period is closed', async () => {
      mockPrisma.journalEntries.findFirst = vi.fn().mockResolvedValue({
        ...testEntry,
        period: { ...testPeriod, status: 'CLOSED' },
      });

      await expect(
        service.postToGL({ entryId: TEST_ENTRY_ID })
      ).rejects.toThrow('Cannot post to closed period');
    });
  });

  // =========================================================================
  // BATCH RECALCULATE BALANCES
  // =========================================================================

  describe('batchRecalculateBalances', () => {
    it('should recalculate balances for all accounts in period', async () => {
      mockPrisma.accountingPeriods.findFirst = vi.fn().mockResolvedValue(testPeriod);
      mockPrisma.chartOfAccounts.findMany = vi.fn().mockResolvedValue([
        testAccount,
        { ...testAccount, id: 'acc-2', accountCode: '200' },
      ]);
      mockPrisma.generalLedger.aggregate = vi.fn().mockResolvedValue({
        _sum: { debitAmount: 5000, creditAmount: 2000 },
      });
      mockPrisma.accountBalances.upsert = vi.fn().mockResolvedValue({});

      const result = await service.batchRecalculateBalances({
        periodId: TEST_PERIOD_ID,
      });

      expect(result.success).toBe(true);
      expect(result.accountsProcessed).toBe(2);
      expect(mockPrisma.accountBalances.upsert).toHaveBeenCalledTimes(2);
    });

    it('should recalculate only specified accounts', async () => {
      mockPrisma.accountingPeriods.findFirst = vi.fn().mockResolvedValue(testPeriod);
      mockPrisma.chartOfAccounts.findMany = vi.fn().mockResolvedValue([testAccount]);
      mockPrisma.generalLedger.aggregate = vi.fn().mockResolvedValue({
        _sum: { debitAmount: 5000, creditAmount: 2000 },
      });
      mockPrisma.accountBalances.upsert = vi.fn().mockResolvedValue({});

      const result = await service.batchRecalculateBalances({
        periodId: TEST_PERIOD_ID,
        accountIds: [TEST_ACCOUNT_ID],
      });

      expect(result.accountsProcessed).toBe(1);
      expect(mockPrisma.chartOfAccounts.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: [TEST_ACCOUNT_ID] },
          }),
        })
      );
    });

    it('should report errors for failed accounts', async () => {
      mockPrisma.accountingPeriods.findFirst = vi.fn().mockResolvedValue(testPeriod);
      mockPrisma.chartOfAccounts.findMany = vi.fn().mockResolvedValue([
        testAccount,
        { ...testAccount, id: 'acc-2', accountCode: '200' },
      ]);
      mockPrisma.generalLedger.aggregate = vi.fn()
        .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
        .mockResolvedValueOnce({ _sum: { debitAmount: 5000, creditAmount: 2000 } })
        .mockResolvedValueOnce({ _sum: { debitAmount: 0, creditAmount: 0 } })
        .mockRejectedValueOnce(new Error('Database error'));
      mockPrisma.accountBalances.upsert = vi.fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Upsert failed'));

      const result = await service.batchRecalculateBalances({
        periodId: TEST_PERIOD_ID,
      });

      expect(result.success).toBe(false);
      expect(result.accountsProcessed).toBe(1);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBe(1);
    });
  });

  // =========================================================================
  // OPENING BALANCE CALCULATION
  // =========================================================================

  describe('calculateOpeningBalance', () => {
    it('should sum prior movements for debit-normal account', async () => {
      mockPrisma.generalLedger.aggregate = vi.fn().mockResolvedValue({
        _sum: { debitAmount: 10000, creditAmount: 3000 },
      });

      const balance = await service['calculateOpeningBalance'](
        TEST_ACCOUNT_ID,
        'DEBIT',
        new Date('2024-02-01')
      );

      expect(balance).toBe(7000); // 10000 - 3000
    });

    it('should sum prior movements for credit-normal account', async () => {
      mockPrisma.generalLedger.aggregate = vi.fn().mockResolvedValue({
        _sum: { debitAmount: 2000, creditAmount: 8000 },
      });

      const balance = await service['calculateOpeningBalance'](
        TEST_ACCOUNT_ID,
        'CREDIT',
        new Date('2024-02-01')
      );

      expect(balance).toBe(6000); // 8000 - 2000
    });

    it('should return zero if no prior movements', async () => {
      mockPrisma.generalLedger.aggregate = vi.fn().mockResolvedValue({
        _sum: { debitAmount: null, creditAmount: null },
      });

      const balance = await service['calculateOpeningBalance'](
        TEST_ACCOUNT_ID,
        'DEBIT',
        new Date('2024-01-01')
      );

      expect(balance).toBe(0);
    });
  });
});
