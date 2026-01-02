/**
 * ACC-011: Entry Reversal Router Tests
 * TDD tests for entry reversal router endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { router } from '../../trpc';
import { entryReversalRouter } from '../../routers/ace/entry-reversal.router';
import { createCallerFactory } from '../../trpc';

// Mock the EntryReversalService
import { EntryReversalService } from '../../services/ace/entry-reversal.service';

vi.mock('../../services/ace/entry-reversal.service');

const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_ENTRY_ID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_REVERSING_ENTRY_ID = '550e8400-e29b-41d4-a716-446655440003';
const TEST_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440004';

const mockContext = {
  prisma: {},
  redis: {},
  auditLogger: { log: vi.fn() },
  session: {
    userId: TEST_USER_ID,
    organizationId: TEST_ORG_ID,
  },
};

const testReverseResult = {
  reversingEntry: {
    id: TEST_REVERSING_ENTRY_ID,
    entryNumber: 'RV-2024-00001',
    entryDate: new Date('2024-01-15'),
    description: 'Reversal of JE-2024-00001: Reason',
    status: 'POSTED',
    entryType: 'REVERSAL',
  },
  originalEntry: {
    id: TEST_ENTRY_ID,
    entryNumber: 'JE-2024-00001',
    status: 'REVERSED',
  },
};

const testScheduleResult = {
  id: TEST_ENTRY_ID,
  entryNumber: 'JE-2024-00001',
  autoReverseDate: new Date('2024-02-01'),
  reversalType: 'AUTO_SCHEDULED',
};

const testCorrectionResult = {
  correctionEntry: {
    id: TEST_REVERSING_ENTRY_ID,
    entryNumber: 'AJ-2024-00001',
    entryDate: new Date('2024-01-15'),
    description: 'Correction of JE-2024-00001: Reason',
    status: 'DRAFT',
    entryType: 'ADJUSTMENT',
  },
  originalEntry: {
    id: TEST_ENTRY_ID,
    entryNumber: 'JE-2024-00001',
  },
  netEffect: {
    totalDebit: 100,
    totalCredit: 100,
  },
};

const testReversalLink = {
  originalEntryId: TEST_ENTRY_ID,
  originalEntryNumber: 'JE-2024-00001',
  originalEntryDate: new Date('2024-01-01'),
  originalDescription: 'Test entry',
  reversingEntryId: TEST_REVERSING_ENTRY_ID,
  reversingEntryNumber: 'RV-2024-00001',
  reversalDate: new Date('2024-01-15'),
  reversalType: 'STANDARD',
  reversalReason: 'Error correction',
  reversedAt: new Date('2024-01-15'),
  reversedBy: {
    id: TEST_USER_ID,
    name: 'Test User',
    email: 'test@example.com',
  },
};

const testReversalDetails = {
  originalEntry: {
    id: TEST_ENTRY_ID,
    entryNumber: 'JE-2024-00001',
    entryDate: new Date('2024-01-01'),
    description: 'Test entry',
    status: 'REVERSED',
    entryType: 'STANDARD',
    lines: [
      {
        id: 'line-1',
        lineNumber: 1,
        accountId: TEST_ACCOUNT_ID,
        accountCode: '100',
        accountName: 'Cash',
        debitAmount: 1000,
        creditAmount: 0,
        description: null,
      },
    ],
    totalDebit: 1000,
    totalCredit: 1000,
  },
  reversingEntry: {
    id: TEST_REVERSING_ENTRY_ID,
    entryNumber: 'RV-2024-00001',
    entryDate: new Date('2024-01-15'),
    description: 'Reversal of JE-2024-00001',
    status: 'POSTED',
    entryType: 'REVERSAL',
    lines: [
      {
        id: 'line-2',
        lineNumber: 1,
        accountId: TEST_ACCOUNT_ID,
        accountCode: '100',
        accountName: 'Cash',
        debitAmount: 0,
        creditAmount: 1000,
        description: null,
      },
    ],
    totalDebit: 1000,
    totalCredit: 1000,
  },
  reversalInfo: {
    reversalType: 'STANDARD',
    reversalReason: 'Error correction',
    reversedAt: new Date('2024-01-15'),
    reversedBy: {
      id: TEST_USER_ID,
      name: 'Test User',
      email: 'test@example.com',
    },
    autoReverseDate: null,
  },
  netEffect: {
    totalDebit: 0,
    totalCredit: 0,
    isBalanced: true,
  },
};

const testPendingAutoReversal = {
  id: TEST_ENTRY_ID,
  entryNumber: 'JE-2024-00001',
  entryDate: new Date('2024-01-01'),
  description: 'Test entry',
  autoReverseDate: new Date('2024-02-01'),
  createdBy: {
    id: TEST_USER_ID,
    name: 'Test User',
    email: 'test@example.com',
  },
  template: null,
};

describe('EntryReversalRouter', () => {
  const createCaller = createCallerFactory(router({ entryReversal: entryReversalRouter }));
  const caller = createCaller(mockContext);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // REVERSAL OPERATIONS
  // ===========================================================================

  describe('reverseEntry', () => {
    it('should reverse a posted entry', async () => {
      vi.mocked(EntryReversalService.prototype.reverseEntry).mockResolvedValue(testReverseResult);

      const result = await caller.entryReversal.reverseEntry({
        entryId: TEST_ENTRY_ID,
        reversalDate: new Date('2024-01-15'),
        reason: 'Error in original entry',
      });

      expect(result).toBeDefined();
      expect(result.reversingEntry.entryType).toBe('REVERSAL');
      expect(result.originalEntry.status).toBe('REVERSED');
      expect(EntryReversalService.prototype.reverseEntry).toHaveBeenCalled();
    });

    it('should reverse with auto-post disabled', async () => {
      vi.mocked(EntryReversalService.prototype.reverseEntry).mockResolvedValue({
        ...testReverseResult,
        reversingEntry: { ...testReverseResult.reversingEntry, status: 'DRAFT' },
      });

      const result = await caller.entryReversal.reverseEntry({
        entryId: TEST_ENTRY_ID,
        reversalDate: new Date('2024-01-15'),
        reason: 'Error correction',
        autoPost: false,
      });

      expect(result.reversingEntry.status).toBe('DRAFT');
    });
  });

  describe('scheduleAutoReversal', () => {
    it('should schedule an entry for auto-reversal', async () => {
      vi.mocked(EntryReversalService.prototype.scheduleAutoReversal).mockResolvedValue(testScheduleResult);

      const result = await caller.entryReversal.scheduleAutoReversal({
        entryId: TEST_ENTRY_ID,
        autoReverseDate: new Date('2024-02-01'),
      });

      expect(result).toBeDefined();
      expect(result.reversalType).toBe('AUTO_SCHEDULED');
      expect(EntryReversalService.prototype.scheduleAutoReversal).toHaveBeenCalled();
    });
  });

  describe('cancelAutoReversal', () => {
    it('should cancel a scheduled auto-reversal', async () => {
      vi.mocked(EntryReversalService.prototype.cancelAutoReversal).mockResolvedValue({
        success: true,
        entryId: TEST_ENTRY_ID,
        entryNumber: 'JE-2024-00001',
      });

      const result = await caller.entryReversal.cancelAutoReversal({
        entryId: TEST_ENTRY_ID,
      });

      expect(result.success).toBe(true);
      expect(EntryReversalService.prototype.cancelAutoReversal).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // CORRECTION ENTRIES
  // ===========================================================================

  describe('createCorrection', () => {
    it('should create a correction entry', async () => {
      vi.mocked(EntryReversalService.prototype.createCorrection).mockResolvedValue(testCorrectionResult);

      const result = await caller.entryReversal.createCorrection({
        originalEntryId: TEST_ENTRY_ID,
        correctionDate: new Date('2024-01-15'),
        reason: 'Amount correction',
        correctedLines: [
          {
            accountId: TEST_ACCOUNT_ID,
            debitAmount: 100,
            creditAmount: 0,
            description: 'Corrected debit',
          },
          {
            accountId: '660e8400-e29b-41d4-a716-446655440005',
            debitAmount: 0,
            creditAmount: 100,
            description: 'Corrected credit',
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result.correctionEntry.entryType).toBe('ADJUSTMENT');
      expect(EntryReversalService.prototype.createCorrection).toHaveBeenCalled();
    });

    it('should create a correction with auto-post', async () => {
      vi.mocked(EntryReversalService.prototype.createCorrection).mockResolvedValue({
        ...testCorrectionResult,
        correctionEntry: { ...testCorrectionResult.correctionEntry, status: 'POSTED' },
      });

      const result = await caller.entryReversal.createCorrection({
        originalEntryId: TEST_ENTRY_ID,
        correctionDate: new Date('2024-01-15'),
        reason: 'Amount correction',
        correctedLines: [
          {
            accountId: TEST_ACCOUNT_ID,
            debitAmount: 100,
            creditAmount: 0,
          },
          {
            accountId: '660e8400-e29b-41d4-a716-446655440005',
            debitAmount: 0,
            creditAmount: 100,
          },
        ],
        autoPost: true,
      });

      expect(result.correctionEntry.status).toBe('POSTED');
    });
  });

  // ===========================================================================
  // LIST AND QUERY ENDPOINTS
  // ===========================================================================

  describe('listReversals', () => {
    it('should list reversals with pagination', async () => {
      vi.mocked(EntryReversalService.prototype.listReversals).mockResolvedValue({
        reversals: [testReversalLink],
        total: 1,
        hasMore: false,
      });

      const result = await caller.entryReversal.listReversals({
        limit: 10,
        offset: 0,
      });

      expect(result.reversals).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(EntryReversalService.prototype.listReversals).toHaveBeenCalled();
    });

    it('should filter by date range', async () => {
      vi.mocked(EntryReversalService.prototype.listReversals).mockResolvedValue({
        reversals: [testReversalLink],
        total: 1,
        hasMore: false,
      });

      await caller.entryReversal.listReversals({
        fromDate: new Date('2024-01-01'),
        toDate: new Date('2024-01-31'),
        limit: 10,
        offset: 0,
      });

      expect(EntryReversalService.prototype.listReversals).toHaveBeenCalledWith(
        expect.objectContaining({
          fromDate: expect.any(Date),
          toDate: expect.any(Date),
        })
      );
    });

    it('should filter by reversal type', async () => {
      vi.mocked(EntryReversalService.prototype.listReversals).mockResolvedValue({
        reversals: [testReversalLink],
        total: 1,
        hasMore: false,
      });

      await caller.entryReversal.listReversals({
        type: 'STANDARD',
        limit: 10,
        offset: 0,
      });

      expect(EntryReversalService.prototype.listReversals).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'STANDARD' })
      );
    });
  });

  describe('getReversalDetails', () => {
    it('should get comprehensive reversal details', async () => {
      vi.mocked(EntryReversalService.prototype.getReversalDetails).mockResolvedValue(testReversalDetails);

      const result = await caller.entryReversal.getReversalDetails({
        entryId: TEST_ENTRY_ID,
      });

      expect(result).toBeDefined();
      expect(result.originalEntry).toBeDefined();
      expect(result.reversingEntry).toBeDefined();
      expect(result.reversalInfo).toBeDefined();
      expect(result.netEffect.isBalanced).toBe(true);
    });
  });

  describe('listPendingAutoReversals', () => {
    it('should list pending auto-reversals', async () => {
      vi.mocked(EntryReversalService.prototype.listPendingAutoReversals).mockResolvedValue({
        pending: [testPendingAutoReversal],
        total: 1,
        hasMore: false,
      });

      const result = await caller.entryReversal.listPendingAutoReversals({
        limit: 10,
        offset: 0,
      });

      expect(result.pending).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by date range', async () => {
      vi.mocked(EntryReversalService.prototype.listPendingAutoReversals).mockResolvedValue({
        pending: [testPendingAutoReversal],
        total: 1,
        hasMore: false,
      });

      await caller.entryReversal.listPendingAutoReversals({
        fromDate: new Date('2024-01-01'),
        toDate: new Date('2024-03-01'),
        limit: 10,
        offset: 0,
      });

      expect(EntryReversalService.prototype.listPendingAutoReversals).toHaveBeenCalledWith(
        expect.objectContaining({
          fromDate: expect.any(Date),
          toDate: expect.any(Date),
        })
      );
    });
  });

  // ===========================================================================
  // AUTO-REVERSAL PROCESSING
  // ===========================================================================

  describe('processAutoReversals', () => {
    it('should process due auto-reversals', async () => {
      vi.mocked(EntryReversalService.prototype.processAutoReversals).mockResolvedValue({
        processed: 2,
        successful: 2,
        failed: 0,
        results: [
          {
            date: new Date('2024-02-01'),
            success: true,
            entryId: TEST_ENTRY_ID,
            reversingEntryId: TEST_REVERSING_ENTRY_ID,
          },
          {
            date: new Date('2024-02-01'),
            success: true,
            entryId: 'entry-2',
            reversingEntryId: 'reversing-2',
          },
        ],
        dryRun: false,
      });

      const result = await caller.entryReversal.processAutoReversals({});

      expect(result.processed).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should support dry-run mode', async () => {
      vi.mocked(EntryReversalService.prototype.processAutoReversals).mockResolvedValue({
        processed: 2,
        successful: 2,
        failed: 0,
        results: [
          {
            date: new Date('2024-02-01'),
            success: true,
            entryId: TEST_ENTRY_ID,
          },
        ],
        dryRun: true,
      });

      const result = await caller.entryReversal.processAutoReversals({
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
    });

    it('should process for specific date', async () => {
      vi.mocked(EntryReversalService.prototype.processAutoReversals).mockResolvedValue({
        processed: 1,
        successful: 1,
        failed: 0,
        results: [
          {
            date: new Date('2024-02-15'),
            success: true,
            entryId: TEST_ENTRY_ID,
            reversingEntryId: TEST_REVERSING_ENTRY_ID,
          },
        ],
        dryRun: false,
      });

      await caller.entryReversal.processAutoReversals({
        forDate: new Date('2024-02-15'),
      });

      expect(EntryReversalService.prototype.processAutoReversals).toHaveBeenCalledWith(
        expect.objectContaining({ forDate: expect.any(Date) })
      );
    });
  });
});
