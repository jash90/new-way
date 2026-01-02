import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OpeningBalanceBatch, OpeningBalanceItem } from '@ksiegowacrm/shared';
import { Decimal } from 'decimal.js';

// ===========================================================================
// MOCKS
// ===========================================================================

const mocks = vi.hoisted(() => ({
  createBatch: vi.fn(),
  getBatch: vi.fn(),
  listBatches: vi.fn(),
  deleteBatch: vi.fn(),
  addItems: vi.fn(),
  updateItem: vi.fn(),
  removeItems: vi.fn(),
  getItems: vi.fn(),
  validateBatch: vi.fn(),
  postOpeningBalances: vi.fn(),
  importFromFile: vi.fn(),
  getSummary: vi.fn(),
}));

vi.mock('../../services/ace/opening-balance.service', () => ({
  OpeningBalanceService: vi.fn().mockImplementation(() => mocks),
}));

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_USER_ID = 'user-123';
const TEST_ORG_ID = 'org-456';
const TEST_BATCH_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_FISCAL_YEAR_ID = '660e8400-e29b-41d4-a716-446655440001';
const TEST_ACCOUNT_ID = '770e8400-e29b-41d4-a716-446655440001';
const TEST_ITEM_ID = '880e8400-e29b-41d4-a716-446655440001';

const sampleBatch: OpeningBalanceBatch = {
  id: TEST_BATCH_ID,
  organizationId: TEST_ORG_ID,
  fiscalYearId: TEST_FISCAL_YEAR_ID,
  status: 'draft',
  totalDebit: 0,
  totalCredit: 0,
  isBalanced: true,
  postedAt: null,
  postedBy: null,
  journalEntryId: null,
  createdAt: new Date('2024-01-01'),
  createdBy: TEST_USER_ID,
  updatedAt: new Date('2024-01-01'),
};

const sampleItem: OpeningBalanceItem = {
  id: TEST_ITEM_ID,
  batchId: TEST_BATCH_ID,
  accountId: TEST_ACCOUNT_ID,
  openingDebit: 10000,
  openingCredit: 0,
  notes: 'Opening balance',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
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

describe('OpeningBalanceRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // CREATE BATCH
  // =========================================================================

  describe('createBatch', () => {
    it('should create opening balance batch', async () => {
      mocks.createBatch.mockResolvedValue(sampleBatch);
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      const result = await caller.createBatch({
        fiscalYearId: TEST_FISCAL_YEAR_ID,
      });

      expect(result).toEqual(sampleBatch);
      expect(mocks.createBatch).toHaveBeenCalledWith(
        expect.objectContaining({ fiscalYearId: TEST_FISCAL_YEAR_ID }),
      );
    });

    it('should reject invalid UUID for fiscalYearId', async () => {
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      await expect(caller.createBatch({ fiscalYearId: 'invalid' })).rejects.toThrow();
    });
  });

  // =========================================================================
  // GET BATCH
  // =========================================================================

  describe('getBatch', () => {
    it('should get batch by ID with items', async () => {
      const batchWithItems = {
        ...sampleBatch,
        items: [{ ...sampleItem, account: { accountCode: '010', accountName: 'Fixed Assets', accountType: 'asset', normalBalance: 'debit' } }],
        fiscalYear: { id: TEST_FISCAL_YEAR_ID, yearCode: '2024', name: 'Rok 2024' },
        itemCount: 1,
        warningCount: 0,
      };
      mocks.getBatch.mockResolvedValue(batchWithItems);
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      const result = await caller.getBatch({ batchId: TEST_BATCH_ID });

      expect(result.items).toHaveLength(1);
      expect(result.fiscalYear).toBeDefined();
      expect(mocks.getBatch).toHaveBeenCalledWith({ batchId: TEST_BATCH_ID });
    });

    it('should reject invalid batch ID', async () => {
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      await expect(caller.getBatch({ batchId: 'invalid' })).rejects.toThrow();
    });
  });

  // =========================================================================
  // LIST BATCHES
  // =========================================================================

  describe('listBatches', () => {
    it('should list all batches', async () => {
      const listResult = {
        batches: [{ ...sampleBatch, fiscalYear: { yearCode: '2024', name: 'Rok 2024' }, itemCount: 0 }],
        total: 1,
      };
      mocks.listBatches.mockResolvedValue(listResult);
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      const result = await caller.listBatches({});

      expect(result.batches).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by fiscal year', async () => {
      const listResult = { batches: [], total: 0 };
      mocks.listBatches.mockResolvedValue(listResult);
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      await caller.listBatches({ fiscalYearId: TEST_FISCAL_YEAR_ID });

      expect(mocks.listBatches).toHaveBeenCalledWith(
        expect.objectContaining({ fiscalYearId: TEST_FISCAL_YEAR_ID }),
      );
    });

    it('should filter by status', async () => {
      const listResult = { batches: [], total: 0 };
      mocks.listBatches.mockResolvedValue(listResult);
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      await caller.listBatches({ status: 'draft' });

      expect(mocks.listBatches).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'draft' }),
      );
    });
  });

  // =========================================================================
  // DELETE BATCH
  // =========================================================================

  describe('deleteBatch', () => {
    it('should delete draft batch', async () => {
      mocks.deleteBatch.mockResolvedValue({ success: true, deletedId: TEST_BATCH_ID });
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      const result = await caller.deleteBatch({ batchId: TEST_BATCH_ID });

      expect(result.success).toBe(true);
      expect(result.deletedId).toBe(TEST_BATCH_ID);
    });
  });

  // =========================================================================
  // ADD ITEMS
  // =========================================================================

  describe('addItems', () => {
    it('should add items to batch', async () => {
      mocks.addItems.mockResolvedValue({ added: 1, updated: 0, items: [sampleItem] });
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      const result = await caller.addItems({
        batchId: TEST_BATCH_ID,
        items: [
          { accountId: TEST_ACCOUNT_ID, openingDebit: 10000, openingCredit: 0 },
        ],
      });

      expect(result.added).toBe(1);
      expect(result.items).toHaveLength(1);
    });

    it('should reject items with both debit and credit', async () => {
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      await expect(caller.addItems({
        batchId: TEST_BATCH_ID,
        items: [
          { accountId: TEST_ACCOUNT_ID, openingDebit: 100, openingCredit: 100 },
        ],
      })).rejects.toThrow();
    });

    it('should update existing items (upsert)', async () => {
      mocks.addItems.mockResolvedValue({ added: 0, updated: 1, items: [sampleItem] });
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      const result = await caller.addItems({
        batchId: TEST_BATCH_ID,
        items: [
          { accountId: TEST_ACCOUNT_ID, openingDebit: 20000, openingCredit: 0 },
        ],
      });

      expect(result.updated).toBe(1);
    });
  });

  // =========================================================================
  // UPDATE ITEM
  // =========================================================================

  describe('updateItem', () => {
    it('should update item debit amount', async () => {
      const updatedItem = { ...sampleItem, openingDebit: 15000 };
      mocks.updateItem.mockResolvedValue(updatedItem);
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      const result = await caller.updateItem({
        itemId: TEST_ITEM_ID,
        openingDebit: 15000,
      });

      expect(result.openingDebit).toBe(15000);
    });

    it('should update item notes', async () => {
      const updatedItem = { ...sampleItem, notes: 'Updated notes' };
      mocks.updateItem.mockResolvedValue(updatedItem);
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      const result = await caller.updateItem({
        itemId: TEST_ITEM_ID,
        notes: 'Updated notes',
      });

      expect(result.notes).toBe('Updated notes');
    });
  });

  // =========================================================================
  // REMOVE ITEMS
  // =========================================================================

  describe('removeItems', () => {
    it('should remove items from batch', async () => {
      mocks.removeItems.mockResolvedValue({ removed: 1 });
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      const result = await caller.removeItems({
        batchId: TEST_BATCH_ID,
        itemIds: [TEST_ITEM_ID],
      });

      expect(result.removed).toBe(1);
    });

    it('should require at least one item ID', async () => {
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      await expect(caller.removeItems({
        batchId: TEST_BATCH_ID,
        itemIds: [],
      })).rejects.toThrow();
    });
  });

  // =========================================================================
  // GET ITEMS
  // =========================================================================

  describe('getItems', () => {
    it('should get items for batch', async () => {
      mocks.getItems.mockResolvedValue([sampleItem]);
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      const result = await caller.getItems({ batchId: TEST_BATCH_ID });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(sampleItem);
    });

    it('should exclude zero balance items when requested', async () => {
      mocks.getItems.mockResolvedValue([sampleItem]);
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      await caller.getItems({ batchId: TEST_BATCH_ID, includeZeroBalances: false });

      expect(mocks.getItems).toHaveBeenCalledWith(
        expect.objectContaining({ includeZeroBalances: false }),
      );
    });
  });

  // =========================================================================
  // VALIDATE BATCH
  // =========================================================================

  describe('validateBatch', () => {
    it('should validate balanced batch', async () => {
      mocks.validateBatch.mockResolvedValue({
        isValid: true,
        isBalanced: true,
        totalDebit: 10000,
        totalCredit: 10000,
        difference: 0,
        itemCount: 2,
        warnings: [],
        errors: [],
      });
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      const result = await caller.validateBatch({ batchId: TEST_BATCH_ID });

      expect(result.isValid).toBe(true);
      expect(result.isBalanced).toBe(true);
    });

    it('should detect unbalanced batch', async () => {
      mocks.validateBatch.mockResolvedValue({
        isValid: false,
        isBalanced: false,
        totalDebit: 10000,
        totalCredit: 5000,
        difference: 5000,
        itemCount: 2,
        warnings: [],
        errors: [],
      });
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      const result = await caller.validateBatch({ batchId: TEST_BATCH_ID });

      expect(result.isBalanced).toBe(false);
      expect(result.difference).toBe(5000);
    });

    it('should return warnings for abnormal balances', async () => {
      mocks.validateBatch.mockResolvedValue({
        isValid: true,
        isBalanced: true,
        totalDebit: 10000,
        totalCredit: 10000,
        difference: 0,
        itemCount: 2,
        warnings: [
          {
            itemId: TEST_ITEM_ID,
            accountCode: '010',
            accountName: 'Fixed Assets',
            message: 'Credit balance on debit-normal account',
          },
        ],
        errors: [],
      });
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      const result = await caller.validateBatch({ batchId: TEST_BATCH_ID });

      expect(result.warnings).toHaveLength(1);
    });
  });

  // =========================================================================
  // POST OPENING BALANCES
  // =========================================================================

  describe('postOpeningBalances', () => {
    it('should post balanced batch', async () => {
      mocks.postOpeningBalances.mockResolvedValue({
        success: true,
        batchId: TEST_BATCH_ID,
        journalEntryId: '990e8400-e29b-41d4-a716-446655440001',
        entryNumber: 'OB/2024/001',
        postedAt: new Date('2024-01-01'),
        totalDebit: 10000,
        totalCredit: 10000,
        itemCount: 2,
      });
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      const result = await caller.postOpeningBalances({ batchId: TEST_BATCH_ID });

      expect(result.success).toBe(true);
      expect(result.journalEntryId).toBeDefined();
      expect(result.entryNumber).toMatch(/^OB\//);
    });

    it('should reject unbalanced batch without force flag', async () => {
      mocks.postOpeningBalances.mockRejectedValue(
        new Error('Trial balance is out of balance')
      );
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      await expect(caller.postOpeningBalances({ batchId: TEST_BATCH_ID }))
        .rejects.toThrow('Trial balance is out of balance');
    });

    it('should allow posting unbalanced batch with forceUnbalanced', async () => {
      mocks.postOpeningBalances.mockResolvedValue({
        success: true,
        batchId: TEST_BATCH_ID,
        journalEntryId: '990e8400-e29b-41d4-a716-446655440001',
        entryNumber: 'OB/2024/001',
        postedAt: new Date('2024-01-01'),
        totalDebit: 10000,
        totalCredit: 5000,
        itemCount: 2,
      });
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      const result = await caller.postOpeningBalances({
        batchId: TEST_BATCH_ID,
        forceUnbalanced: true,
      });

      expect(result.success).toBe(true);
      expect(mocks.postOpeningBalances).toHaveBeenCalledWith(
        expect.objectContaining({ forceUnbalanced: true }),
      );
    });

    it('should accept custom entry description', async () => {
      mocks.postOpeningBalances.mockResolvedValue({
        success: true,
        batchId: TEST_BATCH_ID,
        journalEntryId: '990e8400-e29b-41d4-a716-446655440001',
        entryNumber: 'OB/2024/001',
        postedAt: new Date(),
        totalDebit: 10000,
        totalCredit: 10000,
        itemCount: 2,
      });
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      await caller.postOpeningBalances({
        batchId: TEST_BATCH_ID,
        entryDescription: 'Bilans otwarcia 2024',
      });

      expect(mocks.postOpeningBalances).toHaveBeenCalledWith(
        expect.objectContaining({ entryDescription: 'Bilans otwarcia 2024' }),
      );
    });
  });

  // =========================================================================
  // GET SUMMARY
  // =========================================================================

  describe('getSummary', () => {
    it('should get batch summary', async () => {
      mocks.getSummary.mockResolvedValue({
        batch: sampleBatch,
        fiscalYear: {
          id: TEST_FISCAL_YEAR_ID,
          yearCode: '2024',
          name: 'Rok 2024',
          startDate: new Date('2024-01-01'),
        },
        totalDebit: 10000,
        totalCredit: 10000,
        difference: 0,
        isBalanced: true,
        itemCount: 2,
        warningCount: 0,
        byAccountType: [
          { accountType: 'asset', debitTotal: 10000, creditTotal: 0, accountCount: 1 },
          { accountType: 'equity', debitTotal: 0, creditTotal: 10000, accountCount: 1 },
        ],
      });
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      const result = await caller.getSummary({ batchId: TEST_BATCH_ID });

      expect(result.batch).toBeDefined();
      expect(result.fiscalYear).toBeDefined();
      expect(result.isBalanced).toBe(true);
      expect(result.byAccountType).toHaveLength(2);
    });

    it('should include warning count', async () => {
      mocks.getSummary.mockResolvedValue({
        batch: sampleBatch,
        fiscalYear: {
          id: TEST_FISCAL_YEAR_ID,
          yearCode: '2024',
          name: 'Rok 2024',
          startDate: new Date('2024-01-01'),
        },
        totalDebit: 10000,
        totalCredit: 10000,
        difference: 0,
        isBalanced: true,
        itemCount: 2,
        warningCount: 1,
        byAccountType: [],
      });
      const ctx = createAuthenticatedContext();

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(ctx);

      const result = await caller.getSummary({ batchId: TEST_BATCH_ID });

      expect(result.warningCount).toBe(1);
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

      const { openingBalanceRouter } = await import('../../routers/ace/opening-balance.router');
      const caller = openingBalanceRouter.createCaller(unauthenticatedContext);

      await expect(caller.listBatches({})).rejects.toThrow();
    });
  });
});
