import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JournalEntry, JournalEntryWithLines } from '@ksiegowacrm/shared';

// ===========================================================================
// MOCKS
// ===========================================================================

const mocks = vi.hoisted(() => ({
  createEntry: vi.fn(),
  getEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
  postEntry: vi.fn(),
  queryEntries: vi.fn(),
  validateEntry: vi.fn(),
  getStats: vi.fn(),
  copyEntry: vi.fn(),
  getNextEntryNumber: vi.fn(),
  attachDocument: vi.fn(),
  detachDocument: vi.fn(),
  bulkPostEntries: vi.fn(),
  bulkDeleteEntries: vi.fn(),
}));

vi.mock('../../services/ace/journal-entry.service', () => ({
  JournalEntryService: vi.fn().mockImplementation(() => mocks),
}));

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_USER_ID = 'user-123';
const TEST_ORG_ID = 'org-456';
const TEST_ENTRY_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_ENTRY_ID_2 = '550e8400-e29b-41d4-a716-446655440010';
const TEST_ENTRY_ID_3 = '550e8400-e29b-41d4-a716-446655440011';
const TEST_PERIOD_ID = '660e8400-e29b-41d4-a716-446655440002';
const TEST_FISCAL_YEAR_ID = '770e8400-e29b-41d4-a716-446655440003';
const TEST_ACCOUNT_ID = '880e8400-e29b-41d4-a716-446655440004';
const TEST_ACCOUNT_ID_2 = '880e8400-e29b-41d4-a716-446655440005';
const TEST_DOCUMENT_ID = '990e8400-e29b-41d4-a716-446655440006';

const sampleEntry: JournalEntry = {
  id: TEST_ENTRY_ID,
  organizationId: TEST_ORG_ID,
  periodId: TEST_PERIOD_ID,
  fiscalYearId: TEST_FISCAL_YEAR_ID,
  entryNumber: 'JE/2024/01/0001',
  entryDate: new Date('2024-01-15'),
  entryType: 'STANDARD',
  status: 'DRAFT',
  description: 'Test entry',
  reference: 'INV-001',
  sourceDocumentId: null,
  reversedEntryId: null,
  templateId: null,
  recurringEntryId: null,
  totalDebit: 1000,
  totalCredit: 1000,
  isBalanced: true,
  lineCount: 2,
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
  createdAt: new Date('2024-01-15'),
  createdBy: TEST_USER_ID,
  updatedAt: new Date('2024-01-15'),
};

const sampleEntryWithLines: JournalEntryWithLines = {
  ...sampleEntry,
  lines: [
    {
      id: 'line-1',
      entryId: TEST_ENTRY_ID,
      lineNumber: 1,
      accountId: TEST_ACCOUNT_ID,
      accountCode: '100',
      accountName: 'Kasa',
      debitAmount: 1000,
      creditAmount: 0,
      baseDebitAmount: 1000,
      baseCreditAmount: 0,
      currency: 'PLN',
      exchangeRate: 1,
      description: 'Cash received',
      costCenterId: null,
      costCenterName: null,
      projectId: null,
      projectName: null,
      taxCode: null,
      taxAmount: null,
      isReconciled: false,
      reconciledAt: null,
      createdAt: new Date('2024-01-15'),
    },
    {
      id: 'line-2',
      entryId: TEST_ENTRY_ID,
      lineNumber: 2,
      accountId: TEST_ACCOUNT_ID_2,
      accountCode: '700',
      accountName: 'Przychody ze sprzedaży',
      debitAmount: 0,
      creditAmount: 1000,
      baseDebitAmount: 0,
      baseCreditAmount: 1000,
      currency: 'PLN',
      exchangeRate: 1,
      description: 'Sales revenue',
      costCenterId: null,
      costCenterName: null,
      projectId: null,
      projectName: null,
      taxCode: null,
      taxAmount: null,
      isReconciled: false,
      reconciledAt: null,
      createdAt: new Date('2024-01-15'),
    },
  ],
  period: {
    id: TEST_PERIOD_ID,
    periodNumber: 1,
    name: 'Styczeń 2024',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
    status: 'open',
  },
  fiscalYear: {
    id: TEST_FISCAL_YEAR_ID,
    yearCode: '2024',
    name: 'Rok 2024',
  },
};

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

// ===========================================================================
// TESTS
// ===========================================================================

describe('JournalEntryRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // CREATE ENTRY
  // =========================================================================

  describe('createEntry', () => {
    it('should create a balanced journal entry', async () => {
      mocks.createEntry.mockResolvedValue(sampleEntryWithLines);
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.createEntry({
        entryDate: new Date('2024-01-15'),
        description: 'Test entry',
        lines: [
          { accountId: TEST_ACCOUNT_ID, debitAmount: 1000, creditAmount: 0 },
          { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 1000 },
        ],
      });

      expect(result).toEqual(sampleEntryWithLines);
      expect(mocks.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Test entry' }),
      );
    });

    it('should reject unbalanced entries at schema level', async () => {
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      await expect(caller.createEntry({
        entryDate: new Date('2024-01-15'),
        description: 'Unbalanced entry',
        lines: [
          { accountId: TEST_ACCOUNT_ID, debitAmount: 1000, creditAmount: 0 },
          { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 500 },
        ],
      })).rejects.toThrow();
    });

    it('should reject entry with less than 2 lines', async () => {
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      await expect(caller.createEntry({
        entryDate: new Date('2024-01-15'),
        description: 'Single line entry',
        lines: [
          { accountId: TEST_ACCOUNT_ID, debitAmount: 1000, creditAmount: 0 },
        ],
      })).rejects.toThrow();
    });

    it('should reject line with both debit and credit', async () => {
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      await expect(caller.createEntry({
        entryDate: new Date('2024-01-15'),
        description: 'Invalid line entry',
        lines: [
          { accountId: TEST_ACCOUNT_ID, debitAmount: 500, creditAmount: 500 },
          { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 1000 },
        ],
      })).rejects.toThrow();
    });

    it('should accept different entry types', async () => {
      mocks.createEntry.mockResolvedValue({ ...sampleEntryWithLines, entryType: 'ADJUSTMENT' });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.createEntry({
        entryDate: new Date('2024-01-15'),
        description: 'Adjustment entry',
        entryType: 'ADJUSTMENT',
        lines: [
          { accountId: TEST_ACCOUNT_ID, debitAmount: 100, creditAmount: 0 },
          { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 100 },
        ],
      });

      expect(result.entryType).toBe('ADJUSTMENT');
    });

    it('should accept optional fields', async () => {
      mocks.createEntry.mockResolvedValue(sampleEntryWithLines);
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      await caller.createEntry({
        entryDate: new Date('2024-01-15'),
        description: 'Entry with all fields',
        reference: 'REF-001',
        notes: 'Some notes',
        tags: ['tag1', 'tag2'],
        requiresApproval: true,
        lines: [
          { accountId: TEST_ACCOUNT_ID, debitAmount: 1000, creditAmount: 0, description: 'Line desc' },
          { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 1000 },
        ],
      });

      expect(mocks.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: 'REF-001',
          notes: 'Some notes',
          tags: ['tag1', 'tag2'],
          requiresApproval: true,
        }),
      );
    });
  });

  // =========================================================================
  // GET ENTRY
  // =========================================================================

  describe('getEntry', () => {
    it('should get entry by ID with lines', async () => {
      mocks.getEntry.mockResolvedValue(sampleEntryWithLines);
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.getEntry({ entryId: TEST_ENTRY_ID });

      expect(result.id).toBe(TEST_ENTRY_ID);
      expect(result.lines).toHaveLength(2);
      expect(mocks.getEntry).toHaveBeenCalledWith({ entryId: TEST_ENTRY_ID, includeLines: true });
    });

    it('should get entry without lines when specified', async () => {
      mocks.getEntry.mockResolvedValue(sampleEntry);
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      await caller.getEntry({ entryId: TEST_ENTRY_ID, includeLines: false });

      expect(mocks.getEntry).toHaveBeenCalledWith({ entryId: TEST_ENTRY_ID, includeLines: false });
    });

    it('should reject invalid entry ID', async () => {
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      await expect(caller.getEntry({ entryId: 'invalid' })).rejects.toThrow();
    });
  });

  // =========================================================================
  // UPDATE ENTRY
  // =========================================================================

  describe('updateEntry', () => {
    it('should update draft entry description', async () => {
      mocks.updateEntry.mockResolvedValue({ ...sampleEntryWithLines, description: 'Updated desc' });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.updateEntry({
        entryId: TEST_ENTRY_ID,
        description: 'Updated desc',
      });

      expect(result.description).toBe('Updated desc');
    });

    it('should update entry date', async () => {
      const newDate = new Date('2024-02-01');
      mocks.updateEntry.mockResolvedValue({ ...sampleEntryWithLines, entryDate: newDate });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.updateEntry({
        entryId: TEST_ENTRY_ID,
        entryDate: newDate,
      });

      expect(result.entryDate).toEqual(newDate);
    });

    it('should update lines with balanced amounts', async () => {
      mocks.updateEntry.mockResolvedValue({
        ...sampleEntryWithLines,
        totalDebit: 2000,
        totalCredit: 2000,
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      await caller.updateEntry({
        entryId: TEST_ENTRY_ID,
        lines: [
          { accountId: TEST_ACCOUNT_ID, debitAmount: 2000, creditAmount: 0 },
          { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 2000 },
        ],
      });

      expect(mocks.updateEntry).toHaveBeenCalled();
    });

    it('should reject unbalanced line updates', async () => {
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      await expect(caller.updateEntry({
        entryId: TEST_ENTRY_ID,
        lines: [
          { accountId: TEST_ACCOUNT_ID, debitAmount: 2000, creditAmount: 0 },
          { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 1000 },
        ],
      })).rejects.toThrow();
    });
  });

  // =========================================================================
  // DELETE ENTRY
  // =========================================================================

  describe('deleteEntry', () => {
    it('should delete draft entry', async () => {
      mocks.deleteEntry.mockResolvedValue({
        success: true,
        deletedId: TEST_ENTRY_ID,
        entryNumber: 'JE/2024/01/0001',
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.deleteEntry({ entryId: TEST_ENTRY_ID });

      expect(result.success).toBe(true);
      expect(result.deletedId).toBe(TEST_ENTRY_ID);
    });
  });

  // =========================================================================
  // POST ENTRY
  // =========================================================================

  describe('postEntry', () => {
    it('should post draft entry to general ledger', async () => {
      mocks.postEntry.mockResolvedValue({
        success: true,
        entryId: TEST_ENTRY_ID,
        entryNumber: 'JE/2024/01/0001',
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: TEST_USER_ID,
        totalDebit: 1000,
        totalCredit: 1000,
        lineCount: 2,
        glEntriesCreated: 2,
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.postEntry({ entryId: TEST_ENTRY_ID });

      expect(result.success).toBe(true);
      expect(result.status).toBe('POSTED');
      expect(result.glEntriesCreated).toBe(2);
    });

    it('should support bypassApproval flag', async () => {
      mocks.postEntry.mockResolvedValue({
        success: true,
        entryId: TEST_ENTRY_ID,
        entryNumber: 'JE/2024/01/0001',
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: TEST_USER_ID,
        totalDebit: 1000,
        totalCredit: 1000,
        lineCount: 2,
        glEntriesCreated: 2,
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      await caller.postEntry({ entryId: TEST_ENTRY_ID, bypassApproval: true });

      expect(mocks.postEntry).toHaveBeenCalledWith(
        expect.objectContaining({ bypassApproval: true }),
      );
    });
  });

  // =========================================================================
  // QUERY ENTRIES
  // =========================================================================

  describe('queryEntries', () => {
    it('should query entries with default params', async () => {
      mocks.queryEntries.mockResolvedValue({
        entries: [sampleEntryWithLines],
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false,
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.queryEntries({});

      expect(result.entries).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by date range', async () => {
      mocks.queryEntries.mockResolvedValue({
        entries: [],
        total: 0,
        limit: 50,
        offset: 0,
        hasMore: false,
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      await caller.queryEntries({
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-01-31'),
        },
      });

      expect(mocks.queryEntries).toHaveBeenCalledWith(
        expect.objectContaining({
          dateRange: expect.objectContaining({
            from: expect.any(Date),
            to: expect.any(Date),
          }),
        }),
      );
    });

    it('should filter by status', async () => {
      mocks.queryEntries.mockResolvedValue({
        entries: [],
        total: 0,
        limit: 50,
        offset: 0,
        hasMore: false,
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      await caller.queryEntries({ status: ['DRAFT', 'PENDING'] });

      expect(mocks.queryEntries).toHaveBeenCalledWith(
        expect.objectContaining({ status: ['DRAFT', 'PENDING'] }),
      );
    });

    it('should filter by entry type', async () => {
      mocks.queryEntries.mockResolvedValue({
        entries: [],
        total: 0,
        limit: 50,
        offset: 0,
        hasMore: false,
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      await caller.queryEntries({ entryType: ['STANDARD', 'ADJUSTMENT'] });

      expect(mocks.queryEntries).toHaveBeenCalledWith(
        expect.objectContaining({ entryType: ['STANDARD', 'ADJUSTMENT'] }),
      );
    });

    it('should support pagination', async () => {
      mocks.queryEntries.mockResolvedValue({
        entries: [],
        total: 100,
        limit: 10,
        offset: 20,
        hasMore: true,
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.queryEntries({ limit: 10, offset: 20 });

      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
      expect(result.hasMore).toBe(true);
    });

    it('should support text search', async () => {
      mocks.queryEntries.mockResolvedValue({
        entries: [],
        total: 0,
        limit: 50,
        offset: 0,
        hasMore: false,
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      await caller.queryEntries({ search: 'invoice' });

      expect(mocks.queryEntries).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'invoice' }),
      );
    });
  });

  // =========================================================================
  // VALIDATE ENTRY
  // =========================================================================

  describe('validateEntry', () => {
    it('should validate entry for posting', async () => {
      mocks.validateEntry.mockResolvedValue({
        isValid: true,
        isBalanced: true,
        totalDebit: 1000,
        totalCredit: 1000,
        difference: 0,
        lineCount: 2,
        canPost: true,
        errors: [],
        warnings: [],
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.validateEntry({ entryId: TEST_ENTRY_ID });

      expect(result.isValid).toBe(true);
      expect(result.canPost).toBe(true);
    });

    it('should return errors for invalid entry', async () => {
      mocks.validateEntry.mockResolvedValue({
        isValid: false,
        isBalanced: false,
        totalDebit: 1000,
        totalCredit: 500,
        difference: 500,
        lineCount: 2,
        canPost: false,
        errors: [{ code: 'UNBALANCED', message: 'Entry is not balanced' }],
        warnings: [],
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.validateEntry({ entryId: TEST_ENTRY_ID });

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  // =========================================================================
  // GET STATS
  // =========================================================================

  describe('getStats', () => {
    it('should get entry statistics', async () => {
      mocks.getStats.mockResolvedValue({
        totalEntries: 50,
        draftEntries: 10,
        pendingEntries: 5,
        postedEntries: 30,
        reversedEntries: 5,
        byType: {
          STANDARD: 40,
          ADJUSTMENT: 5,
          CLOSING: 2,
          OPENING: 1,
          REVERSAL: 2,
          RECURRING: 0,
        },
        totalDebit: 1000000,
        totalCredit: 1000000,
        lastEntryDate: new Date('2024-01-15'),
        lastPostedDate: new Date('2024-01-14'),
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.getStats({});

      expect(result.totalEntries).toBe(50);
      expect(result.postedEntries).toBe(30);
    });

    it('should filter stats by period', async () => {
      mocks.getStats.mockResolvedValue({
        totalEntries: 10,
        draftEntries: 2,
        pendingEntries: 1,
        postedEntries: 6,
        reversedEntries: 1,
        byType: { STANDARD: 10 },
        totalDebit: 100000,
        totalCredit: 100000,
        lastEntryDate: new Date('2024-01-15'),
        lastPostedDate: new Date('2024-01-14'),
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      await caller.getStats({ periodId: TEST_PERIOD_ID });

      expect(mocks.getStats).toHaveBeenCalledWith(
        expect.objectContaining({ periodId: TEST_PERIOD_ID }),
      );
    });
  });

  // =========================================================================
  // COPY ENTRY
  // =========================================================================

  describe('copyEntry', () => {
    it('should copy entry with new date', async () => {
      const copiedEntry = {
        ...sampleEntryWithLines,
        id: 'new-entry-id',
        entryNumber: 'JE/2024/02/0001',
        entryDate: new Date('2024-02-01'),
      };
      mocks.copyEntry.mockResolvedValue(copiedEntry);
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.copyEntry({
        sourceEntryId: TEST_ENTRY_ID,
        entryDate: new Date('2024-02-01'),
      });

      expect(result.id).not.toBe(TEST_ENTRY_ID);
      expect(result.entryNumber).not.toBe(sampleEntry.entryNumber);
    });

    it('should copy with overridden description', async () => {
      mocks.copyEntry.mockResolvedValue({
        ...sampleEntryWithLines,
        id: 'new-entry-id',
        description: 'Copied entry',
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      await caller.copyEntry({
        sourceEntryId: TEST_ENTRY_ID,
        description: 'Copied entry',
      });

      expect(mocks.copyEntry).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Copied entry' }),
      );
    });
  });

  // =========================================================================
  // GET NEXT ENTRY NUMBER
  // =========================================================================

  describe('getNextEntryNumber', () => {
    it('should get next entry number preview', async () => {
      mocks.getNextEntryNumber.mockResolvedValue({
        entryNumber: 'JE/2024/01/0002',
        prefix: 'JE',
        year: 2024,
        month: 1,
        sequence: 2,
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.getNextEntryNumber({
        entryType: 'STANDARD',
        entryDate: new Date('2024-01-15'),
      });

      expect(result.entryNumber).toBe('JE/2024/01/0002');
      expect(result.prefix).toBe('JE');
      expect(result.sequence).toBe(2);
    });

    it('should get different prefix for different entry types', async () => {
      mocks.getNextEntryNumber.mockResolvedValue({
        entryNumber: 'AJ/2024/01/0001',
        prefix: 'AJ',
        year: 2024,
        month: 1,
        sequence: 1,
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.getNextEntryNumber({
        entryType: 'ADJUSTMENT',
        entryDate: new Date('2024-01-15'),
      });

      expect(result.prefix).toBe('AJ');
    });
  });

  // =========================================================================
  // BULK POST ENTRIES
  // =========================================================================

  describe('bulkPostEntries', () => {
    it('should post multiple entries', async () => {
      mocks.bulkPostEntries.mockResolvedValue({
        totalRequested: 3,
        successCount: 2,
        failureCount: 1,
        results: [
          { entryId: TEST_ENTRY_ID, entryNumber: 'JE/2024/01/0001', success: true },
          { entryId: TEST_ENTRY_ID_2, entryNumber: 'JE/2024/01/0002', success: true },
          { entryId: TEST_ENTRY_ID_3, entryNumber: 'JE/2024/01/0003', success: false, error: 'Period closed' },
        ],
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.bulkPostEntries({
        entryIds: [TEST_ENTRY_ID, TEST_ENTRY_ID_2, TEST_ENTRY_ID_3],
      });

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
      expect(result.results).toHaveLength(3);
    });

    it('should reject empty entry list', async () => {
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      await expect(caller.bulkPostEntries({ entryIds: [] })).rejects.toThrow();
    });
  });

  // =========================================================================
  // BULK DELETE ENTRIES
  // =========================================================================

  describe('bulkDeleteEntries', () => {
    it('should delete multiple draft entries', async () => {
      mocks.bulkDeleteEntries.mockResolvedValue({
        totalRequested: 2,
        deletedCount: 2,
        skippedCount: 0,
        results: [
          { entryId: TEST_ENTRY_ID, entryNumber: 'JE/2024/01/0001', deleted: true },
          { entryId: TEST_ENTRY_ID_2, entryNumber: 'JE/2024/01/0002', deleted: true },
        ],
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.bulkDeleteEntries({
        entryIds: [TEST_ENTRY_ID, TEST_ENTRY_ID_2],
      });

      expect(result.deletedCount).toBe(2);
      expect(result.skippedCount).toBe(0);
    });

    it('should skip non-draft entries', async () => {
      mocks.bulkDeleteEntries.mockResolvedValue({
        totalRequested: 2,
        deletedCount: 1,
        skippedCount: 1,
        results: [
          { entryId: TEST_ENTRY_ID, entryNumber: 'JE/2024/01/0001', deleted: true },
          { entryId: TEST_ENTRY_ID_2, entryNumber: 'JE/2024/01/0002', deleted: false, reason: 'Entry is posted' },
        ],
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.bulkDeleteEntries({
        entryIds: [TEST_ENTRY_ID, TEST_ENTRY_ID_2],
      });

      expect(result.deletedCount).toBe(1);
      expect(result.skippedCount).toBe(1);
    });
  });

  // =========================================================================
  // ATTACH/DETACH DOCUMENT
  // =========================================================================

  describe('attachDocument', () => {
    it('should attach document to entry', async () => {
      mocks.attachDocument.mockResolvedValue({
        ...sampleEntryWithLines,
        sourceDocumentId: TEST_DOCUMENT_ID,
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.attachDocument({
        entryId: TEST_ENTRY_ID,
        documentId: TEST_DOCUMENT_ID,
      });

      expect(result.sourceDocumentId).toBe(TEST_DOCUMENT_ID);
    });
  });

  describe('detachDocument', () => {
    it('should detach document from entry', async () => {
      mocks.detachDocument.mockResolvedValue({
        ...sampleEntryWithLines,
        sourceDocumentId: null,
      });
      const ctx = createAuthenticatedContext();

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(ctx);

      const result = await caller.detachDocument({ entryId: TEST_ENTRY_ID });

      expect(result.sourceDocumentId).toBeNull();
    });
  });

  // =========================================================================
  // AUTHENTICATION
  // =========================================================================

  describe('authentication', () => {
    it('should require authentication for all endpoints', async () => {
      const unauthenticatedContext = {
        session: null,
        prisma: {} as any,
        redis: {} as any,
        auditLogger: { log: vi.fn() } as any,
      };

      const { journalEntryRouter } = await import('../../routers/ace/journal-entry.router');
      const caller = journalEntryRouter.createCaller(unauthenticatedContext);

      await expect(caller.queryEntries({})).rejects.toThrow();
    });
  });
});
