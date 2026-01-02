/**
 * ACC-011: Entry Reversal Service Tests
 * TDD tests for entry reversal operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntryReversalService } from '../../services/ace/entry-reversal.service';
import { Decimal } from 'decimal.js';

// Mock Prisma client
const mockPrisma = {
  journalEntry: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  journalEntryLine: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
  accountingPeriod: {
    findFirst: vi.fn(),
  },
  generalLedgerEntry: {
    createMany: vi.fn(),
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

const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_ENTRY_ID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_PERIOD_ID = '550e8400-e29b-41d4-a716-446655440003';
const TEST_FISCAL_YEAR_ID = '550e8400-e29b-41d4-a716-446655440004';

const testPostedEntry = {
  id: TEST_ENTRY_ID,
  organizationId: TEST_ORG_ID,
  entryNumber: 'JE-2024-00100',
  entryDate: new Date('2024-03-01'),
  description: 'Test entry',
  entryType: 'STANDARD',
  status: 'POSTED',
  periodId: TEST_PERIOD_ID,
  fiscalYearId: TEST_FISCAL_YEAR_ID,
  reversedEntryId: null,
  reversingEntryId: null,
  autoReverseDate: null,
  reversalType: null,
  reversalReason: null,
  reversedAt: null,
  reversedBy: null,
  postedAt: new Date('2024-03-01'),
  postedBy: TEST_USER_ID,
  createdAt: new Date(),
  createdBy: TEST_USER_ID,
};

const testEntryLines = [
  {
    id: '660e8400-e29b-41d4-a716-446655440001',
    entryId: TEST_ENTRY_ID,
    lineNumber: 1,
    accountId: '770e8400-e29b-41d4-a716-446655440001',
    debitAmount: new Decimal(5000),
    creditAmount: new Decimal(0),
    description: 'Revenue account',
    currencyCode: 'PLN',
    exchangeRate: new Decimal(1),
    baseCurrencyDebit: new Decimal(5000),
    baseCurrencyCredit: new Decimal(0),
  },
  {
    id: '660e8400-e29b-41d4-a716-446655440002',
    entryId: TEST_ENTRY_ID,
    lineNumber: 2,
    accountId: '770e8400-e29b-41d4-a716-446655440002',
    debitAmount: new Decimal(0),
    creditAmount: new Decimal(5000),
    description: 'Cash account',
    currencyCode: 'PLN',
    exchangeRate: new Decimal(1),
    baseCurrencyDebit: new Decimal(0),
    baseCurrencyCredit: new Decimal(5000),
  },
];

const testOpenPeriod = {
  id: TEST_PERIOD_ID,
  organizationId: TEST_ORG_ID,
  fiscalYearId: TEST_FISCAL_YEAR_ID,
  periodNumber: 3,
  periodName: 'March 2024',
  startDate: new Date('2024-03-01'),
  endDate: new Date('2024-03-31'),
  status: 'OPEN',
};

describe('EntryReversalService', () => {
  let service: EntryReversalService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EntryReversalService(
      mockPrisma as any,
      mockRedis as any,
      mockAuditLogger as any,
      TEST_USER_ID,
      TEST_ORG_ID
    );
  });

  // ===========================================================================
  // REVERSE ENTRY
  // ===========================================================================

  describe('reverseEntry', () => {
    it('should reverse a posted entry and swap debits/credits', async () => {
      mockPrisma.journalEntry.findUnique.mockResolvedValue({
        ...testPostedEntry,
        lines: testEntryLines,
      });
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testOpenPeriod);
      mockPrisma.journalEntry.count.mockResolvedValue(99);
      // The service uses include: { lines: true } and then calls postToGeneralLedger
      // which accesses entry.lines.map(), so we need to return lines
      mockPrisma.journalEntry.create.mockResolvedValue({
        id: '880e8400-e29b-41d4-a716-446655440001',
        entryNumber: 'RV-2024-00001',
        entryDate: new Date('2024-03-15'),
        description: `Reversal of JE-2024-00100: Error correction`,
        entryType: 'REVERSING',
        status: 'POSTED',
        reversedEntryId: TEST_ENTRY_ID,
        // Lines with swapped debits/credits for reversal
        lines: testEntryLines.map((l, idx) => ({
          ...l,
          id: `reversal-line-${idx}`,
          entryId: '880e8400-e29b-41d4-a716-446655440001',
          debitAmount: l.creditAmount,
          creditAmount: l.debitAmount,
          baseCurrencyDebit: l.baseCurrencyCredit,
          baseCurrencyCredit: l.baseCurrencyDebit,
        })),
      });
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...testPostedEntry,
        status: 'REVERSED',
        reversingEntryId: '880e8400-e29b-41d4-a716-446655440001',
      });

      const result = await service.reverseEntry({
        entryId: TEST_ENTRY_ID,
        reversalDate: new Date('2024-03-15'),
        reason: 'Error correction',
        autoPost: true,
      });

      expect(result.reversingEntry).toBeDefined();
      expect(result.reversingEntry.entryType).toBe('REVERSING');
      expect(result.originalEntry.status).toBe('REVERSED');
      expect(mockPrisma.journalEntry.create).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should reject reversal of non-posted entry', async () => {
      mockPrisma.journalEntry.findUnique.mockResolvedValue({
        ...testPostedEntry,
        status: 'DRAFT',
      });

      await expect(
        service.reverseEntry({
          entryId: TEST_ENTRY_ID,
          reversalDate: new Date('2024-03-15'),
          reason: 'Test',
        })
      ).rejects.toThrow(/Cannot reverse entry with status DRAFT/);
    });

    it('should reject reversal of already reversed entry', async () => {
      mockPrisma.journalEntry.findUnique.mockResolvedValue({
        ...testPostedEntry,
        status: 'REVERSED',
        reversingEntryId: 'some-entry-id',
      });

      await expect(
        service.reverseEntry({
          entryId: TEST_ENTRY_ID,
          reversalDate: new Date('2024-03-15'),
          reason: 'Test',
        })
      ).rejects.toThrow(/Cannot reverse entry with status REVERSED/);
    });

    it('should reject reversal date before original entry date', async () => {
      mockPrisma.journalEntry.findUnique.mockResolvedValue({
        ...testPostedEntry,
        lines: testEntryLines,
      });

      await expect(
        service.reverseEntry({
          entryId: TEST_ENTRY_ID,
          reversalDate: new Date('2024-02-15'), // Before entry date
          reason: 'Test',
        })
      ).rejects.toThrow(/Reversal date must be on or after/);
    });

    it('should reject reversal to closed period', async () => {
      mockPrisma.journalEntry.findUnique.mockResolvedValue({
        ...testPostedEntry,
        lines: testEntryLines,
      });
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue({
        ...testOpenPeriod,
        status: 'CLOSED',
      });

      await expect(
        service.reverseEntry({
          entryId: TEST_ENTRY_ID,
          reversalDate: new Date('2024-03-15'),
          reason: 'Test',
        })
      ).rejects.toThrow(/Selected period is closed/);
    });

    it('should throw error when entry not found', async () => {
      mockPrisma.journalEntry.findUnique.mockResolvedValue(null);

      await expect(
        service.reverseEntry({
          entryId: 'non-existent-id',
          reversalDate: new Date('2024-03-15'),
          reason: 'Test',
        })
      ).rejects.toThrow(/Entry not found/);
    });
  });

  // ===========================================================================
  // SCHEDULE AUTO-REVERSAL
  // ===========================================================================

  describe('scheduleAutoReversal', () => {
    it('should schedule auto-reversal for a posted entry', async () => {
      mockPrisma.journalEntry.findUnique.mockResolvedValue(testPostedEntry);
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...testPostedEntry,
        autoReverseDate: new Date('2024-04-01'),
        reversalType: 'AUTO_SCHEDULED',
      });

      const result = await service.scheduleAutoReversal({
        entryId: TEST_ENTRY_ID,
        autoReverseDate: new Date('2024-04-01'),
      });

      expect(result.autoReverseDate).toEqual(new Date('2024-04-01'));
      expect(result.reversalType).toBe('AUTO_SCHEDULED');
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should reject scheduling for non-posted entry', async () => {
      mockPrisma.journalEntry.findUnique.mockResolvedValue({
        ...testPostedEntry,
        status: 'DRAFT',
      });

      await expect(
        service.scheduleAutoReversal({
          entryId: TEST_ENTRY_ID,
          autoReverseDate: new Date('2024-04-01'),
        })
      ).rejects.toThrow(/Only posted entries can be scheduled/);
    });

    it('should reject auto-reverse date on or before entry date', async () => {
      mockPrisma.journalEntry.findUnique.mockResolvedValue(testPostedEntry);

      await expect(
        service.scheduleAutoReversal({
          entryId: TEST_ENTRY_ID,
          autoReverseDate: new Date('2024-02-28'), // Before entry date
        })
      ).rejects.toThrow(/Auto-reverse date must be after entry date/);
    });
  });

  // ===========================================================================
  // CANCEL AUTO-REVERSAL
  // ===========================================================================

  describe('cancelAutoReversal', () => {
    it('should cancel scheduled auto-reversal', async () => {
      mockPrisma.journalEntry.findUnique.mockResolvedValue({
        ...testPostedEntry,
        autoReverseDate: new Date('2024-04-01'),
        reversalType: 'AUTO_SCHEDULED',
      });
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...testPostedEntry,
        autoReverseDate: null,
        reversalType: null,
      });

      const result = await service.cancelAutoReversal({
        entryId: TEST_ENTRY_ID,
      });

      expect(result.success).toBe(true);
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should throw error when no auto-reversal scheduled', async () => {
      mockPrisma.journalEntry.findUnique.mockResolvedValue(testPostedEntry);

      await expect(
        service.cancelAutoReversal({
          entryId: TEST_ENTRY_ID,
        })
      ).rejects.toThrow(/No auto-reversal scheduled/);
    });
  });

  // ===========================================================================
  // CREATE CORRECTION
  // ===========================================================================

  describe('createCorrection', () => {
    it('should create correction entry for partial amount fix', async () => {
      mockPrisma.journalEntry.findUnique.mockResolvedValue({
        ...testPostedEntry,
        lines: testEntryLines,
      });
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testOpenPeriod);
      mockPrisma.journalEntry.count.mockResolvedValue(49);
      mockPrisma.journalEntry.create.mockResolvedValue({
        id: '880e8400-e29b-41d4-a716-446655440002',
        entryNumber: 'AJ-2024-00001',
        entryDate: new Date('2024-03-15'),
        description: `Correction of JE-2024-00100: Amount was wrong`,
        entryType: 'ADJUSTING',
        status: 'DRAFT',
        reversedEntryId: TEST_ENTRY_ID,
        reversalType: 'CORRECTION',
      });

      const result = await service.createCorrection({
        originalEntryId: TEST_ENTRY_ID,
        correctionDate: new Date('2024-03-15'),
        reason: 'Amount was wrong',
        correctedLines: [
          { accountId: '770e8400-e29b-41d4-a716-446655440001', debitAmount: 0, creditAmount: 2000 },
          { accountId: '770e8400-e29b-41d4-a716-446655440002', debitAmount: 2000, creditAmount: 0 },
        ],
        autoPost: false,
      });

      expect(result.correctionEntry).toBeDefined();
      expect(result.correctionEntry.entryType).toBe('ADJUSTING');
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should reject correction for non-posted entry', async () => {
      mockPrisma.journalEntry.findUnique.mockResolvedValue({
        ...testPostedEntry,
        status: 'DRAFT',
      });

      await expect(
        service.createCorrection({
          originalEntryId: TEST_ENTRY_ID,
          correctionDate: new Date('2024-03-15'),
          reason: 'Test',
          correctedLines: [
            { accountId: 'acc-1', debitAmount: 1000, creditAmount: 0 },
            { accountId: 'acc-2', debitAmount: 0, creditAmount: 1000 },
          ],
        })
      ).rejects.toThrow(/Can only create corrections for posted entries/);
    });

    it('should reject correction to closed period', async () => {
      mockPrisma.journalEntry.findUnique.mockResolvedValue({
        ...testPostedEntry,
        lines: testEntryLines,
      });
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue({
        ...testOpenPeriod,
        status: 'CLOSED',
      });

      await expect(
        service.createCorrection({
          originalEntryId: TEST_ENTRY_ID,
          correctionDate: new Date('2024-03-15'),
          reason: 'Test',
          correctedLines: [
            { accountId: 'acc-1', debitAmount: 1000, creditAmount: 0 },
            { accountId: 'acc-2', debitAmount: 0, creditAmount: 1000 },
          ],
        })
      ).rejects.toThrow(/Correction period is closed/);
    });
  });

  // ===========================================================================
  // LIST REVERSALS
  // ===========================================================================

  describe('listReversals', () => {
    it('should list reversals with pagination', async () => {
      const reversedEntry = {
        ...testPostedEntry,
        status: 'REVERSED',
        reversingEntryId: '880e8400-e29b-41d4-a716-446655440001',
        reversalType: 'STANDARD',
        reversalReason: 'Error correction',
        reversedAt: new Date('2024-03-15'),
        reversedBy: TEST_USER_ID,
        reversingEntry: {
          id: '880e8400-e29b-41d4-a716-446655440001',
          entryNumber: 'RV-2024-00001',
          entryDate: new Date('2024-03-15'),
        },
        reversedByUser: {
          id: TEST_USER_ID,
          name: 'Test User',
          email: 'test@example.com',
        },
      };

      mockPrisma.journalEntry.findMany.mockResolvedValue([reversedEntry]);
      mockPrisma.journalEntry.count.mockResolvedValue(1);

      const result = await service.listReversals({
        limit: 10,
        offset: 0,
      });

      expect(result.reversals).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by date range', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      mockPrisma.journalEntry.count.mockResolvedValue(0);

      await service.listReversals({
        fromDate: new Date('2024-03-01'),
        toDate: new Date('2024-03-31'),
        limit: 10,
        offset: 0,
      });

      expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reversedAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('should filter by reversal type', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      mockPrisma.journalEntry.count.mockResolvedValue(0);

      await service.listReversals({
        type: 'AUTO_SCHEDULED',
        limit: 10,
        offset: 0,
      });

      expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reversalType: 'AUTO_SCHEDULED',
          }),
        })
      );
    });
  });

  // ===========================================================================
  // GET REVERSAL DETAILS
  // ===========================================================================

  describe('getReversalDetails', () => {
    it('should return comprehensive reversal details', async () => {
      const reversedEntry = {
        ...testPostedEntry,
        status: 'REVERSED',
        reversingEntryId: '880e8400-e29b-41d4-a716-446655440001',
        reversalType: 'STANDARD',
        reversalReason: 'Error correction',
        reversedAt: new Date('2024-03-15'),
        reversedBy: TEST_USER_ID,
        lines: testEntryLines.map((l) => ({
          ...l,
          account: {
            id: l.accountId,
            accountCode: '400-001',
            accountName: 'Revenue',
          },
        })),
        reversingEntry: {
          id: '880e8400-e29b-41d4-a716-446655440001',
          entryNumber: 'RV-2024-00001',
          entryDate: new Date('2024-03-15'),
          description: 'Reversal entry',
          entryType: 'REVERSING',
          status: 'POSTED',
          lines: testEntryLines.map((l, idx) => ({
            ...l,
            id: `new-line-${idx}`,
            entryId: '880e8400-e29b-41d4-a716-446655440001',
            debitAmount: l.creditAmount,
            creditAmount: l.debitAmount,
            baseCurrencyDebit: l.baseCurrencyCredit,
            baseCurrencyCredit: l.baseCurrencyDebit,
            account: {
              id: l.accountId,
              accountCode: '400-001',
              accountName: 'Revenue',
            },
          })),
        },
        reversedByUser: {
          id: TEST_USER_ID,
          name: 'Test User',
          email: 'test@example.com',
        },
      };

      mockPrisma.journalEntry.findUnique.mockResolvedValue(reversedEntry);

      const result = await service.getReversalDetails({
        entryId: TEST_ENTRY_ID,
      });

      expect(result.originalEntry).toBeDefined();
      expect(result.reversingEntry).toBeDefined();
      expect(result.reversalInfo.reversalType).toBe('STANDARD');
      expect(result.netEffect.isBalanced).toBe(true);
    });

    it('should throw error when entry not found', async () => {
      mockPrisma.journalEntry.findUnique.mockResolvedValue(null);

      await expect(
        service.getReversalDetails({
          entryId: 'non-existent-id',
        })
      ).rejects.toThrow(/Entry not found/);
    });
  });

  // ===========================================================================
  // LIST PENDING AUTO-REVERSALS
  // ===========================================================================

  describe('listPendingAutoReversals', () => {
    it('should list pending auto-reversals', async () => {
      const pendingEntry = {
        ...testPostedEntry,
        autoReverseDate: new Date('2024-04-01'),
        reversalType: 'AUTO_SCHEDULED',
        createdByUser: {
          id: TEST_USER_ID,
          name: 'Test User',
          email: 'test@example.com',
        },
      };

      mockPrisma.journalEntry.findMany.mockResolvedValue([pendingEntry]);
      mockPrisma.journalEntry.count.mockResolvedValue(1);

      const result = await service.listPendingAutoReversals({
        limit: 10,
        offset: 0,
      });

      expect(result.pending).toHaveLength(1);
      expect(result.pending[0].autoReverseDate).toEqual(new Date('2024-04-01'));
    });

    it('should filter by date range', async () => {
      mockPrisma.journalEntry.findMany.mockResolvedValue([]);
      mockPrisma.journalEntry.count.mockResolvedValue(0);

      await service.listPendingAutoReversals({
        fromDate: new Date('2024-04-01'),
        toDate: new Date('2024-04-30'),
        limit: 10,
        offset: 0,
      });

      expect(mockPrisma.journalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            autoReverseDate: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });
  });

  // ===========================================================================
  // PROCESS AUTO-REVERSALS
  // ===========================================================================

  describe('processAutoReversals', () => {
    it('should process due auto-reversals', async () => {
      const dueEntry = {
        ...testPostedEntry,
        autoReverseDate: new Date('2024-04-01'),
        reversalType: 'AUTO_SCHEDULED',
        lines: testEntryLines,
      };

      mockPrisma.journalEntry.findMany.mockResolvedValue([dueEntry]);
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue({
        ...testOpenPeriod,
        id: 'april-period',
        startDate: new Date('2024-04-01'),
        endDate: new Date('2024-04-30'),
      });
      mockPrisma.journalEntry.count.mockResolvedValue(0);
      // The service uses include: { lines: true } and calls postToGeneralLedger
      mockPrisma.journalEntry.create.mockResolvedValue({
        id: '990e8400-e29b-41d4-a716-446655440001',
        entryNumber: 'RV-2024-00001',
        entryType: 'REVERSING',
        status: 'POSTED',
        lines: testEntryLines.map((l, idx) => ({
          ...l,
          id: `auto-reversal-line-${idx}`,
          entryId: '990e8400-e29b-41d4-a716-446655440001',
          debitAmount: l.creditAmount,
          creditAmount: l.debitAmount,
          baseCurrencyDebit: l.baseCurrencyCredit,
          baseCurrencyCredit: l.baseCurrencyDebit,
        })),
      });
      mockPrisma.journalEntry.update.mockResolvedValue({
        ...dueEntry,
        status: 'REVERSED',
      });

      const result = await service.processAutoReversals({
        forDate: new Date('2024-04-01'),
      });

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should run in dry-run mode without making changes', async () => {
      const dueEntry = {
        ...testPostedEntry,
        autoReverseDate: new Date('2024-04-01'),
        reversalType: 'AUTO_SCHEDULED',
        lines: testEntryLines,
      };

      mockPrisma.journalEntry.findMany.mockResolvedValue([dueEntry]);

      const result = await service.processAutoReversals({
        forDate: new Date('2024-04-01'),
        dryRun: true,
      });

      expect(result.processed).toBe(1);
      expect(result.dryRun).toBe(true);
      expect(mockPrisma.journalEntry.create).not.toHaveBeenCalled();
    });

    it('should handle failures gracefully', async () => {
      const dueEntry = {
        ...testPostedEntry,
        autoReverseDate: new Date('2024-04-01'),
        reversalType: 'AUTO_SCHEDULED',
        lines: testEntryLines,
      };

      mockPrisma.journalEntry.findMany.mockResolvedValue([dueEntry]);
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(null); // No period found

      const result = await service.processAutoReversals({
        forDate: new Date('2024-04-01'),
      });

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results[0].error).toContain('period');
    });
  });
});
