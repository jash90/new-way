/**
 * ACC-006: Journal Entry Service Tests
 * TDD tests for journal entry operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JournalEntryService } from '../../services/ace/journal-entry.service';
import { Decimal } from 'decimal.js';
import { TRPCError } from '@trpc/server';

// Mock Prisma client
const mockPrisma = {
  journalEntry: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
  journalLine: {
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  },
  entryNumberSequence: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  accountingPeriod: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  fiscalYear: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  chartOfAccount: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  generalLedger: {
    createMany: vi.fn(),
  },
  accountBalance: {
    upsert: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

// Mock Redis client
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn().mockResolvedValue([]),
};

// Mock Audit Logger
const mockAuditLogger = {
  log: vi.fn(),
};

// Test data
const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_ENTRY_ID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_PERIOD_ID = '550e8400-e29b-41d4-a716-446655440003';
const TEST_FISCAL_YEAR_ID = '550e8400-e29b-41d4-a716-446655440004';
const TEST_CASH_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440005';
const TEST_BANK_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440006';
const TEST_EXPENSE_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440007';
const TEST_VAT_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440008';

const testFiscalYear = {
  id: TEST_FISCAL_YEAR_ID,
  organizationId: TEST_ORG_ID,
  yearCode: '2024',
  name: 'Fiscal Year 2024',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  status: 'OPEN',
};

const testPeriod = {
  id: TEST_PERIOD_ID,
  fiscalYearId: TEST_FISCAL_YEAR_ID,
  organizationId: TEST_ORG_ID,
  periodNumber: 1,
  name: 'January 2024',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  status: 'OPEN',
  periodType: 'REGULAR',
  fiscalYear: testFiscalYear,
};

const testCashAccount = {
  id: TEST_CASH_ACCOUNT_ID,
  organizationId: TEST_ORG_ID,
  accountCode: '100',
  accountName: 'Kasa',
  accountType: 'ASSET',
  normalBalance: 'DEBIT',
  isActive: true,
  allowsPosting: true,
};

const testBankAccount = {
  id: TEST_BANK_ACCOUNT_ID,
  organizationId: TEST_ORG_ID,
  accountCode: '131',
  accountName: 'Rachunek bankowy',
  accountType: 'ASSET',
  normalBalance: 'DEBIT',
  isActive: true,
  allowsPosting: true,
};

const testExpenseAccount = {
  id: TEST_EXPENSE_ACCOUNT_ID,
  organizationId: TEST_ORG_ID,
  accountCode: '401',
  accountName: 'Materiały biurowe',
  accountType: 'EXPENSE',
  normalBalance: 'DEBIT',
  isActive: true,
  allowsPosting: true,
};

const testVatAccount = {
  id: TEST_VAT_ACCOUNT_ID,
  organizationId: TEST_ORG_ID,
  accountCode: '222',
  accountName: 'VAT naliczony',
  accountType: 'ASSET',
  normalBalance: 'DEBIT',
  isActive: true,
  allowsPosting: true,
};

const testEntry = {
  id: TEST_ENTRY_ID,
  organizationId: TEST_ORG_ID,
  periodId: TEST_PERIOD_ID,
  fiscalYearId: TEST_FISCAL_YEAR_ID,
  entryNumber: 'JE/2024/01/0001',
  entryDate: new Date('2024-01-15'),
  entryType: 'STANDARD',
  status: 'DRAFT',
  description: 'Cash withdrawal from bank',
  reference: null,
  totalDebit: new Decimal(1000),
  totalCredit: new Decimal(1000),
  baseCurrency: 'PLN',
  requiresApproval: false,
  approvedAt: null,
  approvedBy: null,
  postedAt: null,
  postedBy: null,
  reversedAt: null,
  reversedBy: null,
  notes: null,
  tags: [],
  createdAt: new Date(),
  createdBy: TEST_USER_ID,
  updatedAt: new Date(),
};

const testLines = [
  {
    id: 'line-1',
    entryId: TEST_ENTRY_ID,
    lineNumber: 1,
    accountId: TEST_CASH_ACCOUNT_ID,
    debitAmount: new Decimal(1000),
    creditAmount: new Decimal(0),
    baseDebitAmount: new Decimal(1000),
    baseCreditAmount: new Decimal(0),
    currency: 'PLN',
    exchangeRate: new Decimal(1),
    description: null,
    costCenterId: null,
    projectId: null,
    taxCode: null,
    taxAmount: null,
    isReconciled: false,
    reconciledAt: null,
    createdAt: new Date(),
    account: testCashAccount,
  },
  {
    id: 'line-2',
    entryId: TEST_ENTRY_ID,
    lineNumber: 2,
    accountId: TEST_BANK_ACCOUNT_ID,
    debitAmount: new Decimal(0),
    creditAmount: new Decimal(1000),
    baseDebitAmount: new Decimal(0),
    baseCreditAmount: new Decimal(1000),
    currency: 'PLN',
    exchangeRate: new Decimal(1),
    description: null,
    costCenterId: null,
    projectId: null,
    taxCode: null,
    taxAmount: null,
    isReconciled: false,
    reconciledAt: null,
    createdAt: new Date(),
    account: testBankAccount,
  },
];

describe('JournalEntryService', () => {
  let service: JournalEntryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new JournalEntryService(
      mockPrisma as any,
      mockRedis as any,
      mockAuditLogger as any,
      TEST_USER_ID,
      TEST_ORG_ID
    );
  });

  // =========================================================================
  // CREATE ENTRY
  // =========================================================================

  describe('createEntry', () => {
    beforeEach(() => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testPeriod);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([testCashAccount, testBankAccount]);
      mockPrisma.entryNumberSequence.upsert.mockResolvedValue({
        lastNumber: 1,
        prefix: 'JE',
      });
    });

    it('should create a basic two-line entry', async () => {
      mockPrisma.journalEntry.create.mockResolvedValue({
        ...testEntry,
        lines: testLines,
        period: testPeriod,
      });

      const result = await service.createEntry({
        entryDate: new Date('2024-01-15'),
        description: 'Cash withdrawal from bank',
        entryType: 'STANDARD',
        lines: [
          { accountId: TEST_CASH_ACCOUNT_ID, debitAmount: 1000, creditAmount: 0 },
          { accountId: TEST_BANK_ACCOUNT_ID, debitAmount: 0, creditAmount: 1000 },
        ],
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('DRAFT');
      expect(result.entryNumber).toMatch(/^JE\/2024\/01\/\d{4}$/);
      expect(mockPrisma.journalEntry.create).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'JOURNAL_ENTRY_CREATED',
        })
      );
    });

    it('should create multi-line entry (e.g., purchase with VAT)', async () => {
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([
        testExpenseAccount,
        testVatAccount,
        testBankAccount,
      ]);
      mockPrisma.journalEntry.create.mockResolvedValue({
        ...testEntry,
        description: 'Office supplies purchase',
        totalDebit: new Decimal(615),
        totalCredit: new Decimal(615),
        lines: [
          { ...testLines[0], accountId: TEST_EXPENSE_ACCOUNT_ID, debitAmount: new Decimal(500) },
          { ...testLines[0], accountId: TEST_VAT_ACCOUNT_ID, debitAmount: new Decimal(115), lineNumber: 2 },
          { ...testLines[1], accountId: TEST_BANK_ACCOUNT_ID, creditAmount: new Decimal(615), lineNumber: 3 },
        ],
        period: testPeriod,
      });

      const result = await service.createEntry({
        entryDate: new Date('2024-01-15'),
        description: 'Office supplies purchase',
        lines: [
          { accountId: TEST_EXPENSE_ACCOUNT_ID, debitAmount: 500, creditAmount: 0 },
          { accountId: TEST_VAT_ACCOUNT_ID, debitAmount: 115, creditAmount: 0 },
          { accountId: TEST_BANK_ACCOUNT_ID, debitAmount: 0, creditAmount: 615 },
        ],
      });

      expect(result).toBeDefined();
      expect(result.lineCount).toBe(3);
    });

    it('should throw error for unbalanced entry', async () => {
      await expect(
        service.createEntry({
          entryDate: new Date('2024-01-15'),
          description: 'Unbalanced entry',
          lines: [
            { accountId: TEST_CASH_ACCOUNT_ID, debitAmount: 1000, creditAmount: 0 },
            { accountId: TEST_BANK_ACCOUNT_ID, debitAmount: 0, creditAmount: 500 },
          ],
        })
      ).rejects.toThrow();
    });

    it('should throw error if no period found for date', async () => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(null);

      await expect(
        service.createEntry({
          entryDate: new Date('2025-06-15'),
          description: 'Entry in non-existent period',
          lines: [
            { accountId: TEST_CASH_ACCOUNT_ID, debitAmount: 1000, creditAmount: 0 },
            { accountId: TEST_BANK_ACCOUNT_ID, debitAmount: 0, creditAmount: 1000 },
          ],
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error if period is closed', async () => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue({
        ...testPeriod,
        status: 'CLOSED',
      });

      await expect(
        service.createEntry({
          entryDate: new Date('2024-01-15'),
          description: 'Entry in closed period',
          lines: [
            { accountId: TEST_CASH_ACCOUNT_ID, debitAmount: 1000, creditAmount: 0 },
            { accountId: TEST_BANK_ACCOUNT_ID, debitAmount: 0, creditAmount: 1000 },
          ],
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error if account not found', async () => {
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([testCashAccount]);

      await expect(
        service.createEntry({
          entryDate: new Date('2024-01-15'),
          description: 'Entry with invalid account',
          lines: [
            { accountId: TEST_CASH_ACCOUNT_ID, debitAmount: 1000, creditAmount: 0 },
            { accountId: 'invalid-account-id', debitAmount: 0, creditAmount: 1000 },
          ],
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error if account is inactive', async () => {
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([
        testCashAccount,
        { ...testBankAccount, isActive: false },
      ]);

      await expect(
        service.createEntry({
          entryDate: new Date('2024-01-15'),
          description: 'Entry with inactive account',
          lines: [
            { accountId: TEST_CASH_ACCOUNT_ID, debitAmount: 1000, creditAmount: 0 },
            { accountId: TEST_BANK_ACCOUNT_ID, debitAmount: 0, creditAmount: 1000 },
          ],
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error if posting to header account', async () => {
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([
        testCashAccount,
        { ...testBankAccount, allowsPosting: false },
      ]);

      await expect(
        service.createEntry({
          entryDate: new Date('2024-01-15'),
          description: 'Entry to header account',
          lines: [
            { accountId: TEST_CASH_ACCOUNT_ID, debitAmount: 1000, creditAmount: 0 },
            { accountId: TEST_BANK_ACCOUNT_ID, debitAmount: 0, creditAmount: 1000 },
          ],
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should generate correct entry number with type prefix', async () => {
      mockPrisma.entryNumberSequence.upsert.mockResolvedValue({
        lastNumber: 5,
        prefix: 'AJ',
      });
      mockPrisma.journalEntry.create.mockResolvedValue({
        ...testEntry,
        entryType: 'ADJUSTMENT',
        entryNumber: 'AJ/2024/01/0005',
        lines: testLines,
        period: testPeriod,
      });

      const result = await service.createEntry({
        entryDate: new Date('2024-01-15'),
        description: 'Adjustment entry',
        entryType: 'ADJUSTMENT',
        lines: [
          { accountId: TEST_CASH_ACCOUNT_ID, debitAmount: 1000, creditAmount: 0 },
          { accountId: TEST_BANK_ACCOUNT_ID, debitAmount: 0, creditAmount: 1000 },
        ],
      });

      expect(result.entryNumber).toMatch(/^AJ\/2024\/01\/\d{4}$/);
    });

    it('should support multi-currency entries', async () => {
      mockPrisma.journalEntry.create.mockResolvedValue({
        ...testEntry,
        lines: [
          { ...testLines[0], currency: 'EUR', exchangeRate: new Decimal(4.5), baseDebitAmount: new Decimal(4500) },
          { ...testLines[1], currency: 'PLN', baseCreditAmount: new Decimal(4500) },
        ],
        period: testPeriod,
      });

      const result = await service.createEntry({
        entryDate: new Date('2024-01-15'),
        description: 'Multi-currency entry',
        lines: [
          { accountId: TEST_CASH_ACCOUNT_ID, debitAmount: 4500, creditAmount: 0, currency: 'EUR', exchangeRate: 4.5 },
          { accountId: TEST_BANK_ACCOUNT_ID, debitAmount: 0, creditAmount: 4500, currency: 'PLN' },
        ],
      });

      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // GET ENTRY
  // =========================================================================

  describe('getEntry', () => {
    it('should return entry with lines', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        lines: testLines,
        period: testPeriod,
        fiscalYear: testFiscalYear,
      });

      const result = await service.getEntry({ entryId: TEST_ENTRY_ID });

      expect(result).toBeDefined();
      expect(result.id).toBe(TEST_ENTRY_ID);
      expect(result.lines).toHaveLength(2);
    });

    it('should throw error if entry not found', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(null);

      await expect(
        service.getEntry({ entryId: 'invalid-entry-id' })
      ).rejects.toThrow(TRPCError);
    });

    it('should respect organization isolation', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        lines: testLines,
        period: testPeriod,
        fiscalYear: testFiscalYear,
      });

      await service.getEntry({ entryId: TEST_ENTRY_ID });

      expect(mockPrisma.journalEntry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: TEST_ORG_ID,
          }),
        })
      );
    });
  });

  // =========================================================================
  // UPDATE ENTRY
  // =========================================================================

  describe('updateEntry', () => {
    it('should update draft entry', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        lines: testLines,
      });
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testPeriod);
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...testEntry,
        description: 'Updated description',
        lines: testLines,
        period: testPeriod,
      });

      const result = await service.updateEntry({
        entryId: TEST_ENTRY_ID,
        description: 'Updated description',
      });

      expect(result.description).toBe('Updated description');
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'JOURNAL_ENTRY_UPDATED',
        })
      );
    });

    it('should update entry lines', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        lines: testLines,
      });
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testPeriod);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([testCashAccount, testBankAccount]);
      mockPrisma.journalLine.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.journalLine.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...testEntry,
        lines: [
          { ...testLines[0], debitAmount: new Decimal(2000) },
          { ...testLines[1], creditAmount: new Decimal(2000) },
        ],
        period: testPeriod,
      });

      const result = await service.updateEntry({
        entryId: TEST_ENTRY_ID,
        lines: [
          { accountId: TEST_CASH_ACCOUNT_ID, debitAmount: 2000, creditAmount: 0 },
          { accountId: TEST_BANK_ACCOUNT_ID, debitAmount: 0, creditAmount: 2000 },
        ],
      });

      expect(result).toBeDefined();
      expect(mockPrisma.journalLine.deleteMany).toHaveBeenCalled();
    });

    it('should throw error when updating posted entry', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        status: 'POSTED',
        lines: testLines,
      });

      await expect(
        service.updateEntry({
          entryId: TEST_ENTRY_ID,
          description: 'Cannot update',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error when updating reversed entry', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        status: 'REVERSED',
        lines: testLines,
      });

      await expect(
        service.updateEntry({
          entryId: TEST_ENTRY_ID,
          description: 'Cannot update',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should update period when date changes', async () => {
      const newPeriod = { ...testPeriod, id: 'period-2', periodNumber: 2, name: 'February 2024' };
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        lines: testLines,
      });
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(newPeriod);
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...testEntry,
        entryDate: new Date('2024-02-15'),
        periodId: newPeriod.id,
        lines: testLines,
        period: newPeriod,
      });

      const result = await service.updateEntry({
        entryId: TEST_ENTRY_ID,
        entryDate: new Date('2024-02-15'),
      });

      expect(result.periodId).toBe(newPeriod.id);
    });
  });

  // =========================================================================
  // DELETE ENTRY
  // =========================================================================

  describe('deleteEntry', () => {
    it('should delete draft entry', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(testEntry);
      mockPrisma.journalEntry.delete.mockResolvedValue(testEntry);

      const result = await service.deleteEntry({ entryId: TEST_ENTRY_ID });

      expect(result.success).toBe(true);
      expect(result.deletedId).toBe(TEST_ENTRY_ID);
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'JOURNAL_ENTRY_DELETED',
        })
      );
    });

    it('should throw error when deleting posted entry', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        status: 'POSTED',
      });

      await expect(
        service.deleteEntry({ entryId: TEST_ENTRY_ID })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error if entry not found', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteEntry({ entryId: 'invalid-entry-id' })
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // POST ENTRY
  // =========================================================================

  describe('postEntry', () => {
    beforeEach(() => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        lines: testLines,
        period: testPeriod,
      });
    });

    it('should post entry and update to POSTED status', async () => {
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...testEntry,
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: TEST_USER_ID,
      });
      mockPrisma.generalLedger.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.accountBalance.upsert.mockResolvedValue({});

      const result = await service.postEntry({ entryId: TEST_ENTRY_ID });

      expect(result.success).toBe(true);
      expect(result.status).toBe('POSTED');
      expect(result.postedAt).toBeDefined();
      expect(mockPrisma.generalLedger.createMany).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'JOURNAL_ENTRY_POSTED',
        })
      );
    });

    it('should create general ledger entries', async () => {
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...testEntry,
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: TEST_USER_ID,
      });
      mockPrisma.generalLedger.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.accountBalance.upsert.mockResolvedValue({});

      await service.postEntry({ entryId: TEST_ENTRY_ID });

      expect(mockPrisma.generalLedger.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            entryId: TEST_ENTRY_ID,
            accountId: expect.any(String),
          }),
        ]),
      });
    });

    it('should update account balances', async () => {
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...testEntry,
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: TEST_USER_ID,
      });
      mockPrisma.generalLedger.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.accountBalance.upsert.mockResolvedValue({});

      await service.postEntry({ entryId: TEST_ENTRY_ID });

      expect(mockPrisma.accountBalance.upsert).toHaveBeenCalledTimes(2);
    });

    it('should throw error if entry already posted', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        status: 'POSTED',
        lines: testLines,
        period: testPeriod,
      });

      await expect(
        service.postEntry({ entryId: TEST_ENTRY_ID })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error if entry reversed', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        status: 'REVERSED',
        lines: testLines,
        period: testPeriod,
      });

      await expect(
        service.postEntry({ entryId: TEST_ENTRY_ID })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error if period is closed', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        lines: testLines,
        period: { ...testPeriod, status: 'CLOSED' },
      });

      await expect(
        service.postEntry({ entryId: TEST_ENTRY_ID })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error if entry requires approval', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        requiresApproval: true,
        approvedAt: null,
        lines: testLines,
        period: testPeriod,
      });

      await expect(
        service.postEntry({ entryId: TEST_ENTRY_ID })
      ).rejects.toThrow(TRPCError);
    });

    it('should allow posting with bypassApproval flag', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        requiresApproval: true,
        approvedAt: null,
        lines: testLines,
        period: testPeriod,
      });
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...testEntry,
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: TEST_USER_ID,
      });
      mockPrisma.generalLedger.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.accountBalance.upsert.mockResolvedValue({});

      const result = await service.postEntry({
        entryId: TEST_ENTRY_ID,
        bypassApproval: true,
      });

      expect(result.success).toBe(true);
    });

    it('should throw error for unbalanced entry (data corruption check)', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        lines: [
          { ...testLines[0], debitAmount: new Decimal(1000) },
          { ...testLines[1], creditAmount: new Decimal(500) },
        ],
        period: testPeriod,
      });

      await expect(
        service.postEntry({ entryId: TEST_ENTRY_ID })
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // QUERY ENTRIES
  // =========================================================================

  describe('queryEntries', () => {
    it('should return entries with pagination', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        { ...testEntry, lines: testLines },
      ]);
      mockPrisma.journalEntry.count.mockResolvedValue(1);

      const result = await service.queryEntries({
        limit: 50,
        offset: 0,
        orderBy: 'date_desc',
      });

      expect(result.entries).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by status', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      mockPrisma.journalEntry.count.mockResolvedValue(0);

      await service.queryEntries({
        status: ['POSTED'],
        limit: 50,
        offset: 0,
      });

      expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['POSTED'] },
          }),
        })
      );
    });

    it('should filter by entry type', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      mockPrisma.journalEntry.count.mockResolvedValue(0);

      await service.queryEntries({
        entryType: ['STANDARD', 'ADJUSTMENT'],
        limit: 50,
        offset: 0,
      });

      expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entryType: { in: ['STANDARD', 'ADJUSTMENT'] },
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      mockPrisma.journalEntry.count.mockResolvedValue(0);

      await service.queryEntries({
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-01-31'),
        },
        limit: 50,
        offset: 0,
      });

      expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entryDate: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-01-31'),
            },
          }),
        })
      );
    });

    it('should filter by account in lines', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      mockPrisma.journalEntry.count.mockResolvedValue(0);

      await service.queryEntries({
        accountId: TEST_CASH_ACCOUNT_ID,
        limit: 50,
        offset: 0,
      });

      expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            lines: {
              some: { accountId: TEST_CASH_ACCOUNT_ID },
            },
          }),
        })
      );
    });

    it('should search by description', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      mockPrisma.journalEntry.count.mockResolvedValue(0);

      await service.queryEntries({
        search: 'cash withdrawal',
        limit: 50,
        offset: 0,
      });

      expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ description: expect.anything() }),
            ]),
          }),
        })
      );
    });

    it('should support multiple order by options', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      mockPrisma.journalEntry.count.mockResolvedValue(0);

      await service.queryEntries({
        orderBy: 'number_asc',
        limit: 50,
        offset: 0,
      });

      expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { entryNumber: 'asc' },
        })
      );
    });
  });

  // =========================================================================
  // VALIDATE ENTRY
  // =========================================================================

  describe('validateEntry', () => {
    it('should return valid for balanced entry', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        lines: testLines,
        period: testPeriod,
      });

      const result = await service.validateEntry({ entryId: TEST_ENTRY_ID });

      expect(result.isValid).toBe(true);
      expect(result.isBalanced).toBe(true);
      expect(result.canPost).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for unbalanced entry', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        lines: [
          { ...testLines[0], debitAmount: new Decimal(1000) },
          { ...testLines[1], creditAmount: new Decimal(500) },
        ],
        period: testPeriod,
      });

      const result = await service.validateEntry({ entryId: TEST_ENTRY_ID });

      expect(result.isValid).toBe(false);
      expect(result.isBalanced).toBe(false);
      expect(result.difference).toBe(500);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn for abnormal balance direction', async () => {
      // Debit account with credit balance
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        lines: [
          {
            ...testLines[0],
            debitAmount: new Decimal(0),
            creditAmount: new Decimal(1000),
            account: { ...testCashAccount, normalBalance: 'DEBIT' },
          },
          {
            ...testLines[1],
            debitAmount: new Decimal(1000),
            creditAmount: new Decimal(0),
            account: { ...testBankAccount, normalBalance: 'DEBIT' },
          },
        ],
        period: testPeriod,
      });

      const result = await service.validateEntry({ entryId: TEST_ENTRY_ID });

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should not allow posting if period is closed', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        lines: testLines,
        period: { ...testPeriod, status: 'CLOSED' },
      });

      const result = await service.validateEntry({ entryId: TEST_ENTRY_ID });

      expect(result.canPost).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'PERIOD_CLOSED' })
      );
    });
  });

  // =========================================================================
  // STATISTICS
  // =========================================================================

  describe('getStats', () => {
    it('should return entry statistics', async () => {
      mockPrisma.journalEntry.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(20) // draft
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(70) // posted
        .mockResolvedValueOnce(5); // reversed
      mockPrisma.journalEntry.groupBy.mockResolvedValue([
        { entryType: 'STANDARD', _count: { _all: 80 } },
        { entryType: 'ADJUSTMENT', _count: { _all: 15 } },
        { entryType: 'CLOSING', _count: { _all: 5 } },
      ]);
      mockPrisma.journalEntry.aggregate.mockResolvedValue({
        _sum: { totalDebit: new Decimal(500000), totalCredit: new Decimal(500000) },
        _max: { entryDate: new Date('2024-01-31'), postedAt: new Date('2024-01-30') },
      });

      const result = await service.getStats({});

      expect(result.totalEntries).toBe(100);
      expect(result.draftEntries).toBe(20);
      expect(result.pendingEntries).toBe(5);
      expect(result.postedEntries).toBe(70);
      expect(result.byType).toBeDefined();
    });

    it('should filter stats by period', async () => {
      mockPrisma.journalEntry.count.mockResolvedValue(0);
      mockPrisma.journalEntry.groupBy.mockResolvedValue([]);
      mockPrisma.journalEntry.aggregate.mockResolvedValue({
        _sum: { totalDebit: null, totalCredit: null },
        _max: { entryDate: null, postedAt: null },
      });

      await service.getStats({ periodId: TEST_PERIOD_ID });

      expect(mockPrisma.journalEntry.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            periodId: TEST_PERIOD_ID,
          }),
        })
      );
    });
  });

  // =========================================================================
  // COPY ENTRY
  // =========================================================================

  describe('copyEntry', () => {
    beforeEach(() => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        lines: testLines,
      });
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testPeriod);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([testCashAccount, testBankAccount]);
      mockPrisma.entryNumberSequence.upsert.mockResolvedValue({
        lastNumber: 2,
        prefix: 'JE',
      });
    });

    it('should copy entry with new date', async () => {
      mockPrisma.journalEntry.create.mockResolvedValue({
        ...testEntry,
        id: 'new-entry-id',
        entryNumber: 'JE/2024/01/0002',
        entryDate: new Date('2024-01-20'),
        status: 'DRAFT',
        lines: testLines,
        period: testPeriod,
      });

      const result = await service.copyEntry({
        sourceEntryId: TEST_ENTRY_ID,
        entryDate: new Date('2024-01-20'),
      });

      expect(result.id).not.toBe(TEST_ENTRY_ID);
      expect(result.status).toBe('DRAFT');
    });

    it('should copy entry with default date as today', async () => {
      mockPrisma.journalEntry.create.mockResolvedValue({
        ...testEntry,
        id: 'new-entry-id',
        entryNumber: 'JE/2024/01/0002',
        status: 'DRAFT',
        lines: testLines,
        period: testPeriod,
      });

      const result = await service.copyEntry({
        sourceEntryId: TEST_ENTRY_ID,
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('DRAFT');
    });

    it('should throw error if source entry not found', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(null);

      await expect(
        service.copyEntry({ sourceEntryId: 'invalid-id' })
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // ENTRY NUMBERING
  // =========================================================================

  describe('getNextEntryNumber', () => {
    it('should return next entry number', async () => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testPeriod);
      mockPrisma.entryNumberSequence.findFirst.mockResolvedValue({
        lastNumber: 50,
        prefix: 'JE',
        year: 2024,
        month: 1,
      });

      const result = await service.getNextEntryNumber({
        entryType: 'STANDARD',
        entryDate: new Date('2024-01-15'),
      });

      expect(result.entryNumber).toBe('JE/2024/01/0051');
      expect(result.sequence).toBe(51);
    });

    it('should use correct prefix for entry type', async () => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testPeriod);
      mockPrisma.entryNumberSequence.findFirst.mockResolvedValue({
        lastNumber: 10,
        prefix: 'AJ',
        year: 2024,
        month: 1,
      });

      const result = await service.getNextEntryNumber({
        entryType: 'ADJUSTMENT',
        entryDate: new Date('2024-01-15'),
      });

      expect(result.prefix).toBe('AJ');
      expect(result.entryNumber).toMatch(/^AJ\//);
    });

    it('should start new sequence for new month', async () => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue({
        ...testPeriod,
        periodNumber: 2,
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-29'),
      });
      mockPrisma.entryNumberSequence.findFirst.mockResolvedValue(null);

      const result = await service.getNextEntryNumber({
        entryType: 'STANDARD',
        entryDate: new Date('2024-02-15'),
      });

      expect(result.sequence).toBe(1);
      expect(result.month).toBe(2);
    });
  });

  // =========================================================================
  // BULK OPERATIONS
  // =========================================================================

  describe('bulkPostEntries', () => {
    it('should post multiple entries', async () => {
      const entry2 = { ...testEntry, id: 'entry-2', entryNumber: 'JE/2024/01/0002' };
      const entryWithAccount = {
        ...testEntry,
        lines: testLines.map((l) => ({ ...l, account: testCashAccount })),
        period: testPeriod,
        fiscalYear: testFiscalYear,
      };
      const entry2WithAccount = {
        ...entry2,
        lines: testLines.map((l) => ({ ...l, account: testCashAccount })),
        period: testPeriod,
        fiscalYear: testFiscalYear,
      };

      mockPrisma.journalEntry.findMany.mockResolvedValue([entryWithAccount, entry2WithAccount]);
      mockPrisma.journalEntry.findFirst.mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === TEST_ENTRY_ID) return Promise.resolve(entryWithAccount);
        if (where.id === 'entry-2') return Promise.resolve(entry2WithAccount);
        return Promise.resolve(null);
      });
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...testEntry,
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: TEST_USER_ID,
      });
      mockPrisma.generalLedger.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.accountBalance.upsert.mockResolvedValue({});

      const result = await service.bulkPostEntries({
        entryIds: [TEST_ENTRY_ID, 'entry-2'],
      });

      expect(result.totalRequested).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
    });

    it('should handle partial failures', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        { ...testEntry, lines: testLines, period: testPeriod, fiscalYear: testFiscalYear },
        { ...testEntry, id: 'entry-2', status: 'POSTED', lines: testLines, period: testPeriod, fiscalYear: testFiscalYear },
      ]);
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...testEntry,
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: TEST_USER_ID,
      });
      mockPrisma.generalLedger.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.accountBalance.upsert.mockResolvedValue({});

      const result = await service.bulkPostEntries({
        entryIds: [TEST_ENTRY_ID, 'entry-2'],
      });

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.results[1].error).toBeDefined();
    });
  });

  describe('bulkDeleteEntries', () => {
    it('should delete multiple draft entries', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        testEntry,
        { ...testEntry, id: 'entry-2', entryNumber: 'JE/2024/01/0002' },
      ]);
      mockPrisma.journalEntry.delete.mockResolvedValue(testEntry);

      const result = await service.bulkDeleteEntries({
        entryIds: [TEST_ENTRY_ID, 'entry-2'],
      });

      expect(result.totalRequested).toBe(2);
      expect(result.deletedCount).toBe(2);
    });

    it('should skip non-draft entries', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        testEntry,
        { ...testEntry, id: 'entry-2', status: 'POSTED' },
      ]);
      mockPrisma.journalEntry.delete.mockResolvedValue(testEntry);

      const result = await service.bulkDeleteEntries({
        entryIds: [TEST_ENTRY_ID, 'entry-2'],
      });

      expect(result.deletedCount).toBe(1);
      expect(result.skippedCount).toBe(1);
    });
  });

  // =========================================================================
  // ATTACHMENT OPERATIONS
  // =========================================================================

  describe('attachDocument', () => {
    it('should attach document to entry', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(testEntry);
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...testEntry,
        sourceDocumentId: 'doc-123',
      });

      const result = await service.attachDocument({
        entryId: TEST_ENTRY_ID,
        documentId: 'doc-123',
      });

      expect(result.sourceDocumentId).toBe('doc-123');
    });
  });

  describe('detachDocument', () => {
    it('should detach document from entry', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        sourceDocumentId: 'doc-123',
      });
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...testEntry,
        sourceDocumentId: null,
      });

      const result = await service.detachDocument({ entryId: TEST_ENTRY_ID });

      expect(result.sourceDocumentId).toBeNull();
    });
  });

  // =========================================================================
  // CACHE MANAGEMENT
  // =========================================================================

  describe('cache invalidation', () => {
    beforeEach(() => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testPeriod);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([testCashAccount, testBankAccount]);
      mockPrisma.entryNumberSequence.upsert.mockResolvedValue({
        lastNumber: 1,
        prefix: 'JE',
      });
      mockRedis.keys.mockResolvedValue(['key1', 'key2']);
    });

    it('should invalidate cache on entry creation', async () => {
      mockPrisma.journalEntry.create.mockResolvedValue({
        ...testEntry,
        lines: testLines,
        period: testPeriod,
      });

      await service.createEntry({
        entryDate: new Date('2024-01-15'),
        description: 'Test entry',
        lines: [
          { accountId: TEST_CASH_ACCOUNT_ID, debitAmount: 1000, creditAmount: 0 },
          { accountId: TEST_BANK_ACCOUNT_ID, debitAmount: 0, creditAmount: 1000 },
        ],
      });

      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should invalidate cache on entry update', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        lines: testLines,
      });
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...testEntry,
        description: 'Updated',
        lines: testLines,
        period: testPeriod,
      });

      await service.updateEntry({
        entryId: TEST_ENTRY_ID,
        description: 'Updated',
      });

      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should invalidate cache on entry posting', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        lines: testLines,
        period: testPeriod,
      });
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...testEntry,
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: TEST_USER_ID,
      });
      mockPrisma.generalLedger.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.accountBalance.upsert.mockResolvedValue({});

      await service.postEntry({ entryId: TEST_ENTRY_ID });

      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // AUDIT LOGGING
  // =========================================================================

  describe('audit logging', () => {
    beforeEach(() => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testPeriod);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([testCashAccount, testBankAccount]);
      mockPrisma.entryNumberSequence.upsert.mockResolvedValue({
        lastNumber: 1,
        prefix: 'JE',
      });
    });

    it('should log entry creation with details', async () => {
      mockPrisma.journalEntry.create.mockResolvedValue({
        ...testEntry,
        lines: testLines,
        period: testPeriod,
      });

      await service.createEntry({
        entryDate: new Date('2024-01-15'),
        description: 'Test entry',
        lines: [
          { accountId: TEST_CASH_ACCOUNT_ID, debitAmount: 1000, creditAmount: 0 },
          { accountId: TEST_BANK_ACCOUNT_ID, debitAmount: 0, creditAmount: 1000 },
        ],
      });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'JOURNAL_ENTRY_CREATED',
          entityType: 'JOURNAL_ENTRY',
          entityId: TEST_ENTRY_ID,
          userId: TEST_USER_ID,
          organizationId: TEST_ORG_ID,
          newValues: expect.objectContaining({
            entryNumber: expect.any(String),
            entryType: 'STANDARD',
            lineCount: 2,
          }),
        })
      );
    });

    it('should log entry posting with totals', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue({
        ...testEntry,
        lines: testLines,
        period: testPeriod,
      });
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...testEntry,
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: TEST_USER_ID,
      });
      mockPrisma.generalLedger.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.accountBalance.upsert.mockResolvedValue({});

      await service.postEntry({ entryId: TEST_ENTRY_ID });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'JOURNAL_ENTRY_POSTED',
          newValues: expect.objectContaining({
            entryNumber: testEntry.entryNumber,
            totalDebit: expect.any(String),
            totalCredit: expect.any(String),
          }),
        })
      );
    });

    it('should log entry deletion', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(testEntry);
      mockPrisma.journalEntry.delete.mockResolvedValue(testEntry);

      await service.deleteEntry({ entryId: TEST_ENTRY_ID });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'JOURNAL_ENTRY_DELETED',
          oldValues: expect.objectContaining({
            entryNumber: testEntry.entryNumber,
            description: testEntry.description,
          }),
        })
      );
    });
  });
});
