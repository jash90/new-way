/**
 * ACC-005: Opening Balance Service Tests
 * TDD tests for opening balance operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpeningBalanceService } from '../../services/ace/opening-balance.service';
import { Decimal } from 'decimal.js';
import { TRPCError } from '@trpc/server';

// Mock Prisma client
const mockPrisma = {
  openingBalanceBatch: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  openingBalanceItem: {
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  },
  fiscalYear: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  accountingPeriod: {
    findFirst: vi.fn(),
  },
  chartOfAccount: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  journalEntry: {
    create: vi.fn(),
    count: vi.fn(),
  },
  journalLine: {
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

// Test data
const testOrganizationId = 'org-123';
const testUserId = 'user-123';
const testFiscalYearId = 'fy-2024';
const testBatchId = 'batch-123';
const testAccountId = 'account-100';

const testFiscalYear = {
  id: testFiscalYearId,
  organizationId: testOrganizationId,
  yearCode: '2024',
  name: 'Fiscal Year 2024',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  status: 'open',
};

const testPeriod = {
  id: 'period-1',
  fiscalYearId: testFiscalYearId,
  periodNumber: 1,
  name: 'January 2024',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  status: 'open',
};

const testAccount = {
  id: testAccountId,
  organizationId: testOrganizationId,
  accountCode: '100',
  accountName: 'Kasa',
  accountType: 'asset',
  normalBalance: 'debit',
};

const testBatch = {
  id: testBatchId,
  organizationId: testOrganizationId,
  fiscalYearId: testFiscalYearId,
  status: 'draft',
  totalDebit: new Decimal(0),
  totalCredit: new Decimal(0),
  isBalanced: true,
  postedAt: null,
  postedBy: null,
  journalEntryId: null,
  createdAt: new Date(),
  createdBy: testUserId,
  updatedAt: new Date(),
};

describe('OpeningBalanceService', () => {
  let service: OpeningBalanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OpeningBalanceService(
      mockPrisma as any,
      mockRedis as any,
      mockAuditLogger as any,
      testUserId,
      testOrganizationId
    );
  });

  // =========================================================================
  // BATCH OPERATIONS
  // =========================================================================

  describe('createBatch', () => {
    it('should create a new opening balance batch', async () => {
      mockPrisma.fiscalYear.findFirst.mockResolvedValue(testFiscalYear);
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue(null);
      mockPrisma.openingBalanceBatch.create.mockResolvedValue(testBatch);

      const result = await service.createBatch({
        fiscalYearId: testFiscalYearId,
        notes: 'Initial opening balances',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('draft');
      expect(mockPrisma.openingBalanceBatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: testOrganizationId,
          fiscalYearId: testFiscalYearId,
          status: 'draft',
          createdBy: testUserId,
        }),
      });
    });

    it('should throw error if fiscal year not found', async () => {
      mockPrisma.fiscalYear.findFirst.mockResolvedValue(null);

      await expect(
        service.createBatch({ fiscalYearId: 'invalid-fy' })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error if fiscal year is not open', async () => {
      // Service uses findFirst with status: 'open', so closed year returns null
      mockPrisma.fiscalYear.findFirst.mockResolvedValue(null);

      await expect(
        service.createBatch({ fiscalYearId: testFiscalYearId })
      ).rejects.toThrow();
    });

    it('should throw error if posted batch already exists', async () => {
      mockPrisma.fiscalYear.findFirst.mockResolvedValue(testFiscalYear);
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue({
        ...testBatch,
        status: 'posted',
      });

      await expect(
        service.createBatch({ fiscalYearId: testFiscalYearId })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('getBatch', () => {
    it('should return batch with items and fiscal year', async () => {
      const batchWithItems = {
        ...testBatch,
        fiscalYear: testFiscalYear,
        items: [
          {
            id: 'item-1',
            batchId: testBatchId,
            accountId: testAccountId,
            openingDebit: new Decimal(5000),
            openingCredit: new Decimal(0),
            notes: null,
            account: testAccount,
          },
        ],
      };
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue(batchWithItems);

      const result = await service.getBatch({ batchId: testBatchId });

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.fiscalYear).toBeDefined();
    });

    it('should throw error if batch not found', async () => {
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue(null);

      await expect(
        service.getBatch({ batchId: 'invalid-batch' })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('listBatches', () => {
    it('should return all batches for organization', async () => {
      mockPrisma.openingBalanceBatch.findMany.mockResolvedValue([
        { ...testBatch, fiscalYear: testFiscalYear, _count: { items: 5 } },
      ]);
      mockPrisma.openingBalanceBatch.count.mockResolvedValue(1);

      const result = await service.listBatches({});

      expect(result.batches).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by fiscal year', async () => {
      mockPrisma.openingBalanceBatch.findMany.mockResolvedValue([]);
      mockPrisma.openingBalanceBatch.count.mockResolvedValue(0);

      await service.listBatches({ fiscalYearId: testFiscalYearId });

      expect(mockPrisma.openingBalanceBatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fiscalYearId: testFiscalYearId,
          }),
        })
      );
    });

    it('should filter by status', async () => {
      mockPrisma.openingBalanceBatch.findMany.mockResolvedValue([]);
      mockPrisma.openingBalanceBatch.count.mockResolvedValue(0);

      await service.listBatches({ status: 'draft' });

      expect(mockPrisma.openingBalanceBatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'draft',
          }),
        })
      );
    });
  });

  describe('deleteBatch', () => {
    it('should delete draft batch', async () => {
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue(testBatch);
      mockPrisma.openingBalanceBatch.delete.mockResolvedValue(testBatch);

      const result = await service.deleteBatch({ batchId: testBatchId });

      expect(result.success).toBe(true);
      expect(result.deletedId).toBe(testBatchId);
    });

    it('should throw error when deleting posted batch', async () => {
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue({
        ...testBatch,
        status: 'posted',
      });

      await expect(
        service.deleteBatch({ batchId: testBatchId })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error if batch not found', async () => {
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteBatch({ batchId: 'invalid-batch' })
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // ITEM OPERATIONS
  // =========================================================================

  describe('addItems', () => {
    it('should add items to batch', async () => {
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue(testBatch);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([testAccount]);
      const now = new Date();
      mockPrisma.openingBalanceItem.upsert.mockResolvedValue({
        id: 'item-1',
        batchId: testBatchId,
        accountId: testAccountId,
        openingDebit: new Decimal(5000),
        openingCredit: new Decimal(0),
        notes: null,
        createdAt: now,
        updatedAt: now,
      });
      mockPrisma.openingBalanceItem.aggregate.mockResolvedValue({
        _sum: { openingDebit: new Decimal(5000), openingCredit: new Decimal(0) },
      });

      const result = await service.addItems({
        batchId: testBatchId,
        items: [
          { accountId: testAccountId, openingDebit: 5000, openingCredit: 0 },
        ],
      });

      expect(result.added + result.updated).toBeGreaterThan(0);
    });

    it('should throw error if batch not in draft status', async () => {
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue({
        ...testBatch,
        status: 'posted',
      });

      await expect(
        service.addItems({
          batchId: testBatchId,
          items: [
            { accountId: testAccountId, openingDebit: 5000, openingCredit: 0 },
          ],
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error if account not found', async () => {
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue(testBatch);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([]);

      await expect(
        service.addItems({
          batchId: testBatchId,
          items: [
            { accountId: 'invalid-account', openingDebit: 5000, openingCredit: 0 },
          ],
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should upsert if account already has item in batch', async () => {
      const createdAt = new Date('2024-01-01');
      const updatedAt = new Date('2024-01-02'); // Different time = update
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue(testBatch);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([testAccount]);
      mockPrisma.openingBalanceItem.upsert.mockResolvedValue({
        id: 'item-1',
        batchId: testBatchId,
        accountId: testAccountId,
        openingDebit: new Decimal(10000),
        openingCredit: new Decimal(0),
        notes: null,
        createdAt,
        updatedAt,
      });
      mockPrisma.openingBalanceItem.aggregate.mockResolvedValue({
        _sum: { openingDebit: new Decimal(10000), openingCredit: new Decimal(0) },
      });

      const result = await service.addItems({
        batchId: testBatchId,
        items: [
          { accountId: testAccountId, openingDebit: 10000, openingCredit: 0 },
        ],
      });

      expect(mockPrisma.openingBalanceItem.upsert).toHaveBeenCalled();
    });
  });

  describe('updateItem', () => {
    it('should update item amounts', async () => {
      const existingItem = {
        id: 'item-1',
        batchId: testBatchId,
        accountId: testAccountId,
        openingDebit: new Decimal(5000),
        openingCredit: new Decimal(0),
        batch: testBatch,
      };
      mockPrisma.openingBalanceItem.findFirst.mockResolvedValue(existingItem);
      mockPrisma.openingBalanceItem.update.mockResolvedValue({
        ...existingItem,
        openingDebit: new Decimal(7500),
      });
      mockPrisma.openingBalanceItem.aggregate.mockResolvedValue({
        _sum: { openingDebit: new Decimal(7500), openingCredit: new Decimal(0) },
      });

      const result = await service.updateItem({
        itemId: 'item-1',
        openingDebit: 7500,
      });

      expect(result).toBeDefined();
      expect(mockPrisma.openingBalanceItem.update).toHaveBeenCalled();
    });

    it('should throw error if item not found', async () => {
      mockPrisma.openingBalanceItem.findFirst.mockResolvedValue(null);

      await expect(
        service.updateItem({ itemId: 'invalid-item', openingDebit: 5000 })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error if batch is not draft', async () => {
      mockPrisma.openingBalanceItem.findFirst.mockResolvedValue({
        id: 'item-1',
        batchId: testBatchId,
        batch: { ...testBatch, status: 'posted' },
      });

      await expect(
        service.updateItem({ itemId: 'item-1', openingDebit: 5000 })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('removeItems', () => {
    it('should remove items from batch', async () => {
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue(testBatch);
      mockPrisma.openingBalanceItem.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.openingBalanceItem.aggregate.mockResolvedValue({
        _sum: { openingDebit: new Decimal(0), openingCredit: new Decimal(0) },
      });

      const result = await service.removeItems({
        batchId: testBatchId,
        itemIds: ['item-1', 'item-2'],
      });

      expect(result.removed).toBe(2);
    });

    it('should throw error if batch not found', async () => {
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue(null);

      await expect(
        service.removeItems({
          batchId: 'invalid-batch',
          itemIds: ['item-1'],
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // VALIDATION
  // =========================================================================

  describe('validateBatch', () => {
    it('should return valid for balanced batch', async () => {
      const balancedItems = [
        {
          id: 'item-1',
          accountId: 'acc-1',
          openingDebit: new Decimal(10000),
          openingCredit: new Decimal(0),
          account: { ...testAccount, accountCode: '100', accountName: 'Kasa', normalBalance: 'debit' },
        },
        {
          id: 'item-2',
          accountId: 'acc-2',
          openingDebit: new Decimal(0),
          openingCredit: new Decimal(10000),
          account: { ...testAccount, accountCode: '800', accountName: 'Kapitał', normalBalance: 'credit' },
        },
      ];

      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue({
        ...testBatch,
        items: balancedItems,
      });

      const result = await service.validateBatch({ batchId: testBatchId });

      expect(result.isValid).toBe(true);
      expect(result.isBalanced).toBe(true);
      expect(result.difference).toBe(0);
    });

    it('should return invalid for unbalanced batch', async () => {
      const unbalancedItems = [
        {
          id: 'item-1',
          accountId: 'acc-1',
          openingDebit: new Decimal(10000),
          openingCredit: new Decimal(0),
          account: { ...testAccount, normalBalance: 'debit' },
        },
        {
          id: 'item-2',
          accountId: 'acc-2',
          openingDebit: new Decimal(0),
          openingCredit: new Decimal(7000),
          account: { ...testAccount, normalBalance: 'credit' },
        },
      ];

      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue({
        ...testBatch,
        items: unbalancedItems,
      });

      const result = await service.validateBatch({ batchId: testBatchId });

      expect(result.isValid).toBe(false);
      expect(result.isBalanced).toBe(false);
      expect(result.difference).toBe(3000);
    });

    it('should return warnings for abnormal balances', async () => {
      // Debit account with credit balance
      const abnormalItems = [
        {
          id: 'item-1',
          accountId: 'acc-1',
          openingDebit: new Decimal(0),
          openingCredit: new Decimal(5000),
          account: { ...testAccount, accountCode: '100', accountName: 'Kasa', normalBalance: 'debit' },
        },
      ];

      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue({
        ...testBatch,
        items: abnormalItems,
      });

      const result = await service.validateBatch({ batchId: testBatchId });

      expect(result.warnings).toHaveLength(1);
      // Message format: "Credit balance on debit-normal account"
      expect(result.warnings[0].message).toContain('debit-normal');
    });

    it('should return error for empty batch', async () => {
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue({
        ...testBatch,
        items: [],
      });

      const result = await service.validateBatch({ batchId: testBatchId });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No items in batch');
    });
  });

  // =========================================================================
  // POSTING
  // =========================================================================

  describe('postOpeningBalances', () => {
    beforeEach(() => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testPeriod);
      // generateEntryNumber uses fiscalYear.findUnique and journalEntry.count
      mockPrisma.fiscalYear.findUnique.mockResolvedValue(testFiscalYear);
      mockPrisma.journalEntry.count.mockResolvedValue(0);
    });

    it('should create journal entry and update batch status', async () => {
      const balancedItems = [
        {
          id: 'item-1',
          accountId: 'acc-1',
          openingDebit: new Decimal(10000),
          openingCredit: new Decimal(0),
          account: testAccount,
        },
        {
          id: 'item-2',
          accountId: 'acc-2',
          openingDebit: new Decimal(0),
          openingCredit: new Decimal(10000),
          account: { ...testAccount, id: 'acc-2', normalBalance: 'credit' },
        },
      ];

      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue({
        ...testBatch,
        items: balancedItems,
        fiscalYear: testFiscalYear,
      });
      mockPrisma.journalEntry.create.mockResolvedValue({
        id: 'je-1',
        entryNumber: 'OB/2024/001',
      });
      mockPrisma.openingBalanceBatch.update.mockResolvedValue({
        ...testBatch,
        status: 'posted',
        journalEntryId: 'je-1',
        postedAt: new Date(),
        postedBy: testUserId,
      });

      const result = await service.postOpeningBalances({
        batchId: testBatchId,
        entryDescription: 'Opening balances 2024',
      });

      expect(result.success).toBe(true);
      expect(result.journalEntryId).toBe('je-1');
    });

    it('should throw error for unbalanced batch without force flag', async () => {
      const unbalancedItems = [
        {
          id: 'item-1',
          accountId: 'acc-1',
          openingDebit: new Decimal(10000),
          openingCredit: new Decimal(0),
          account: testAccount,
        },
      ];

      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue({
        ...testBatch,
        items: unbalancedItems,
        fiscalYear: testFiscalYear,
      });

      await expect(
        service.postOpeningBalances({
          batchId: testBatchId,
          forceUnbalanced: false,
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should allow posting unbalanced batch with force flag', async () => {
      const unbalancedItems = [
        {
          id: 'item-1',
          accountId: 'acc-1',
          openingDebit: new Decimal(10000),
          openingCredit: new Decimal(0),
          account: testAccount,
        },
      ];

      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue({
        ...testBatch,
        items: unbalancedItems,
        fiscalYear: testFiscalYear,
      });
      mockPrisma.journalEntry.create.mockResolvedValue({
        id: 'je-1',
        entryNumber: 'OB/2024/001',
      });
      mockPrisma.openingBalanceBatch.update.mockResolvedValue({
        ...testBatch,
        status: 'posted',
        journalEntryId: 'je-1',
      });

      const result = await service.postOpeningBalances({
        batchId: testBatchId,
        forceUnbalanced: true,
      });

      expect(result.success).toBe(true);
    });

    it('should throw error if batch already posted', async () => {
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue({
        ...testBatch,
        status: 'posted',
      });

      await expect(
        service.postOpeningBalances({ batchId: testBatchId })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error if no opening period found', async () => {
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue({
        ...testBatch,
        items: [{ id: 'item-1', openingDebit: new Decimal(1000), openingCredit: new Decimal(1000), account: testAccount }],
        fiscalYear: testFiscalYear,
      });
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(null);

      await expect(
        service.postOpeningBalances({ batchId: testBatchId })
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // SUMMARY
  // =========================================================================

  describe('getSummary', () => {
    it('should return comprehensive batch summary', async () => {
      const items = [
        {
          id: 'item-1',
          accountId: 'acc-1',
          openingDebit: new Decimal(10000),
          openingCredit: new Decimal(0),
          account: { ...testAccount, accountType: 'asset' },
        },
        {
          id: 'item-2',
          accountId: 'acc-2',
          openingDebit: new Decimal(0),
          openingCredit: new Decimal(10000),
          account: { ...testAccount, id: 'acc-2', accountType: 'equity' },
        },
      ];

      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue({
        ...testBatch,
        items,
        fiscalYear: testFiscalYear,
      });

      const result = await service.getSummary({ batchId: testBatchId });

      expect(result.totalDebit).toBe(10000);
      expect(result.totalCredit).toBe(10000);
      expect(result.isBalanced).toBe(true);
      expect(result.itemCount).toBe(2);
      expect(result.byAccountType).toBeDefined();
    });

    it('should group by account type correctly', async () => {
      const items = [
        {
          id: 'item-1',
          accountId: 'acc-1',
          openingDebit: new Decimal(5000),
          openingCredit: new Decimal(0),
          account: { ...testAccount, accountType: 'asset' },
        },
        {
          id: 'item-2',
          accountId: 'acc-2',
          openingDebit: new Decimal(3000),
          openingCredit: new Decimal(0),
          account: { ...testAccount, id: 'acc-2', accountType: 'asset' },
        },
        {
          id: 'item-3',
          accountId: 'acc-3',
          openingDebit: new Decimal(0),
          openingCredit: new Decimal(8000),
          account: { ...testAccount, id: 'acc-3', accountType: 'equity' },
        },
      ];

      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue({
        ...testBatch,
        items,
        fiscalYear: testFiscalYear,
      });

      const result = await service.getSummary({ batchId: testBatchId });

      const assetGroup = result.byAccountType.find(g => g.accountType === 'asset');
      const equityGroup = result.byAccountType.find(g => g.accountType === 'equity');

      expect(assetGroup?.debitTotal).toBe(8000);
      expect(assetGroup?.accountCount).toBe(2);
      expect(equityGroup?.creditTotal).toBe(8000);
      expect(equityGroup?.accountCount).toBe(1);
    });
  });

  // =========================================================================
  // IMPORT (BASIC TESTS - Excel parsing would need mocking)
  // =========================================================================

  describe('importFromFile', () => {
    it('should validate batch exists and is draft', async () => {
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue(null);

      await expect(
        service.importFromFile({
          batchId: testBatchId,
          fileContent: 'base64content',
          fileName: 'test.xlsx',
          fileType: 'xlsx',
          columnMapping: {
            accountCodeColumn: 'A',
            debitColumn: 'B',
            creditColumn: 'C',
          },
          skipRows: 1,
          createMissingAccounts: false,
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // CACHE INVALIDATION
  // =========================================================================

  describe('cache invalidation', () => {
    it('should invalidate cache on batch creation', async () => {
      mockPrisma.fiscalYear.findFirst.mockResolvedValue(testFiscalYear);
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue(null);
      mockPrisma.openingBalanceBatch.create.mockResolvedValue(testBatch);
      mockRedis.keys.mockResolvedValue(['key1', 'key2']);

      await service.createBatch({ fiscalYearId: testFiscalYearId });

      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should invalidate cache on item update', async () => {
      const existingItem = {
        id: 'item-1',
        batchId: testBatchId,
        accountId: testAccountId,
        openingDebit: new Decimal(5000),
        openingCredit: new Decimal(0),
        batch: testBatch,
      };
      mockPrisma.openingBalanceItem.findFirst.mockResolvedValue(existingItem);
      mockPrisma.openingBalanceItem.update.mockResolvedValue(existingItem);
      mockPrisma.openingBalanceItem.aggregate.mockResolvedValue({
        _sum: { openingDebit: new Decimal(5000), openingCredit: new Decimal(0) },
      });
      mockRedis.keys.mockResolvedValue(['key1']);

      await service.updateItem({ itemId: 'item-1', openingDebit: 7500 });

      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // AUDIT LOGGING
  // =========================================================================

  describe('audit logging', () => {
    it('should log batch creation', async () => {
      mockPrisma.fiscalYear.findFirst.mockResolvedValue(testFiscalYear);
      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue(null);
      mockPrisma.openingBalanceBatch.create.mockResolvedValue(testBatch);

      await service.createBatch({ fiscalYearId: testFiscalYearId });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'OPENING_BALANCE_BATCH_CREATED',
        })
      );
    });

    it('should log posting', async () => {
      const balancedItems = [
        {
          id: 'item-1',
          accountId: 'acc-1',
          openingDebit: new Decimal(1000),
          openingCredit: new Decimal(0),
          account: testAccount,
        },
        {
          id: 'item-2',
          accountId: 'acc-2',
          openingDebit: new Decimal(0),
          openingCredit: new Decimal(1000),
          account: { ...testAccount, normalBalance: 'credit' },
        },
      ];

      mockPrisma.openingBalanceBatch.findFirst.mockResolvedValue({
        ...testBatch,
        items: balancedItems,
        fiscalYear: testFiscalYear,
      });
      mockPrisma.accountingPeriod.findFirst.mockResolvedValue(testPeriod);
      mockPrisma.journalEntry.create.mockResolvedValue({ id: 'je-1', entryNumber: 'OB/2024/001' });
      mockPrisma.openingBalanceBatch.update.mockResolvedValue({
        ...testBatch,
        status: 'posted',
      });

      await service.postOpeningBalances({ batchId: testBatchId });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'OPENING_BALANCES_POSTED',
        })
      );
    });
  });
});
