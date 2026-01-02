/**
 * ACC-005: Opening Balance Service
 * Manages opening balance batches and items for fiscal year initialization
 */

import { TRPCError } from '@trpc/server';
import { Decimal } from 'decimal.js';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

// Transaction client type for Prisma $transaction callback
type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
import type {
  CreateOpeningBalanceBatchInput,
  GetOpeningBalanceBatchInput,
  ListOpeningBalanceBatchesInput,
  DeleteOpeningBalanceBatchInput,
  AddOpeningBalanceItemsInput,
  UpdateOpeningBalanceItemInput,
  RemoveOpeningBalanceItemsInput,
  GetOpeningBalanceItemsInput,
  ValidateOpeningBalanceBatchInput,
  PostOpeningBalancesInput,
  ImportOpeningBalancesInput,
  GetOpeningBalanceSummaryInput,
  CreateBatchResult,
  GetBatchResult,
  ListBatchesResult,
  DeleteBatchResult,
  AddItemsResult,
  RemoveItemsResult,
  ValidationResult,
  PostResult,
  ImportResult,
  OpeningBalanceSummary,
  OpeningBalanceItem,
} from '@ksiegowacrm/shared';

interface AuditLogger {
  log: (entry: {
    action: string;
    entityType: string;
    entityId: string;
    details?: Record<string, unknown>;
  }) => void;
}

export class OpeningBalanceService {
  private readonly CACHE_PREFIX = 'opening-balance';
  private readonly _CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly auditLogger: AuditLogger,
    private readonly userId: string,
    private readonly organizationId: string
  ) {
    // Suppress unused warnings for reserved properties
    void this._CACHE_TTL;
  }

  // =========================================================================
  // BATCH OPERATIONS
  // =========================================================================

  /**
   * Create a new opening balance batch
   */
  async createBatch(input: CreateOpeningBalanceBatchInput): Promise<CreateBatchResult> {
    // Verify fiscal year exists and is open
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: {
        id: input.fiscalYearId,
        organizationId: this.organizationId,
        status: 'open',
      },
    });

    if (!fiscalYear) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Fiscal year not found or not open',
      });
    }

    // Check if posted batch already exists for this fiscal year
    const existingPosted = await this.prisma.openingBalanceBatch.findFirst({
      where: {
        organizationId: this.organizationId,
        fiscalYearId: input.fiscalYearId,
        status: 'posted',
      },
    });

    if (existingPosted) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Opening balances already posted for this fiscal year. Create adjustment entries instead.',
      });
    }

    const batch = await this.prisma.openingBalanceBatch.create({
      data: {
        organizationId: this.organizationId,
        fiscalYearId: input.fiscalYearId,
        status: 'draft',
        totalDebit: 0,
        totalCredit: 0,
        isBalanced: true,
        createdBy: this.userId,
      },
    });

    await this.invalidateCache();

    this.auditLogger.log({
      action: 'OPENING_BALANCE_BATCH_CREATED',
      entityType: 'OpeningBalanceBatch',
      entityId: batch.id,
      details: { fiscalYearId: input.fiscalYearId },
    });

    return this.mapBatchToResult(batch);
  }

  /**
   * Get opening balance batch with items
   */
  async getBatch(input: GetOpeningBalanceBatchInput): Promise<GetBatchResult> {
    const batch = await this.prisma.openingBalanceBatch.findFirst({
      where: {
        id: input.batchId,
        organizationId: this.organizationId,
      },
      include: {
        fiscalYear: {
          select: {
            id: true,
            yearCode: true,
            name: true,
          },
        },
        items: {
          include: {
            account: {
              select: {
                accountCode: true,
                accountName: true,
                accountType: true,
                normalBalance: true,
              },
            },
          },
          orderBy: {
            account: { accountCode: 'asc' },
          },
        },
      },
    });

    if (!batch) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Opening balance batch not found',
      });
    }

    // Count warnings (abnormal balances)
    const warningCount = batch.items.filter(item => {
      const isDebit = new Decimal(item.openingDebit.toString()).greaterThan(0);
      const expectedDebit = item.account.normalBalance === 'debit';
      const hasBalance = new Decimal(item.openingDebit.toString()).plus(item.openingCredit.toString()).greaterThan(0);
      return hasBalance && isDebit !== expectedDebit;
    }).length;

    return {
      id: batch.id,
      organizationId: batch.organizationId,
      fiscalYearId: batch.fiscalYearId,
      status: batch.status as 'draft' | 'verified' | 'posted',
      totalDebit: Number(batch.totalDebit),
      totalCredit: Number(batch.totalCredit),
      isBalanced: batch.isBalanced,
      postedAt: batch.postedAt,
      postedBy: batch.postedBy,
      journalEntryId: batch.journalEntryId,
      createdAt: batch.createdAt,
      createdBy: batch.createdBy,
      updatedAt: batch.updatedAt,
      fiscalYear: batch.fiscalYear,
      items: batch.items.map(item => ({
        id: item.id,
        batchId: item.batchId,
        accountId: item.accountId,
        openingDebit: Number(item.openingDebit),
        openingCredit: Number(item.openingCredit),
        notes: item.notes,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        account: item.account,
      })),
      itemCount: batch.items.length,
      warningCount,
    };
  }

  /**
   * List opening balance batches
   */
  async listBatches(input: ListOpeningBalanceBatchesInput): Promise<ListBatchesResult> {
    const where: Record<string, unknown> = {
      organizationId: this.organizationId,
    };

    if (input.fiscalYearId) {
      where.fiscalYearId = input.fiscalYearId;
    }

    if (input.status) {
      where.status = input.status;
    }

    const [batches, total] = await Promise.all([
      this.prisma.openingBalanceBatch.findMany({
        where,
        include: {
          fiscalYear: {
            select: {
              yearCode: true,
              name: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.openingBalanceBatch.count({ where }),
    ]);

    return {
      batches: batches.map(batch => ({
        id: batch.id,
        organizationId: batch.organizationId,
        fiscalYearId: batch.fiscalYearId,
        status: batch.status as 'draft' | 'verified' | 'posted',
        totalDebit: Number(batch.totalDebit),
        totalCredit: Number(batch.totalCredit),
        isBalanced: batch.isBalanced,
        postedAt: batch.postedAt,
        postedBy: batch.postedBy,
        journalEntryId: batch.journalEntryId,
        createdAt: batch.createdAt,
        createdBy: batch.createdBy,
        updatedAt: batch.updatedAt,
        fiscalYear: batch.fiscalYear,
        itemCount: batch._count.items,
      })),
      total,
    };
  }

  /**
   * Delete opening balance batch
   */
  async deleteBatch(input: DeleteOpeningBalanceBatchInput): Promise<DeleteBatchResult> {
    const batch = await this.prisma.openingBalanceBatch.findFirst({
      where: {
        id: input.batchId,
        organizationId: this.organizationId,
      },
    });

    if (!batch) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Opening balance batch not found',
      });
    }

    if (batch.status === 'posted') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Cannot delete posted opening balance batch',
      });
    }

    await this.prisma.openingBalanceBatch.delete({
      where: { id: input.batchId },
    });

    await this.invalidateCache();

    this.auditLogger.log({
      action: 'OPENING_BALANCE_BATCH_DELETED',
      entityType: 'OpeningBalanceBatch',
      entityId: input.batchId,
    });

    return {
      success: true,
      deletedId: input.batchId,
    };
  }

  // =========================================================================
  // ITEM OPERATIONS
  // =========================================================================

  /**
   * Add items to batch
   */
  async addItems(input: AddOpeningBalanceItemsInput): Promise<AddItemsResult> {
    // Verify batch exists and is draft
    const batch = await this.prisma.openingBalanceBatch.findFirst({
      where: {
        id: input.batchId,
        organizationId: this.organizationId,
      },
    });

    if (!batch) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Opening balance batch not found',
      });
    }

    if (batch.status !== 'draft') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Can only add items to draft batches',
      });
    }

    // Verify all accounts exist
    const accountIds = input.items.map(item => item.accountId);
    const accounts = await this.prisma.chartOfAccount.findMany({
      where: {
        id: { in: accountIds },
        organizationId: this.organizationId,
      },
    });

    if (accounts.length !== accountIds.length) {
      const foundIds = new Set(accounts.map(a => a.id));
      const missingIds = accountIds.filter(id => !foundIds.has(id));
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Accounts not found: ${missingIds.join(', ')}`,
      });
    }

    // Upsert items
    const items: OpeningBalanceItem[] = [];
    let added = 0;
    let updated = 0;

    for (const itemInput of input.items) {
      const result = await this.prisma.openingBalanceItem.upsert({
        where: {
          batchId_accountId: {
            batchId: input.batchId,
            accountId: itemInput.accountId,
          },
        },
        create: {
          batchId: input.batchId,
          accountId: itemInput.accountId,
          openingDebit: itemInput.openingDebit,
          openingCredit: itemInput.openingCredit,
          notes: itemInput.notes,
        },
        update: {
          openingDebit: itemInput.openingDebit,
          openingCredit: itemInput.openingCredit,
          notes: itemInput.notes,
        },
      });

      items.push({
        id: result.id,
        batchId: result.batchId,
        accountId: result.accountId,
        openingDebit: Number(result.openingDebit),
        openingCredit: Number(result.openingCredit),
        notes: result.notes,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      });

      // Count as added if created, updated if updated
      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        added++;
      } else {
        updated++;
      }
    }

    // Update batch totals
    await this.updateBatchTotals(input.batchId);
    await this.invalidateCache();

    this.auditLogger.log({
      action: 'OPENING_BALANCE_ITEMS_ADDED',
      entityType: 'OpeningBalanceBatch',
      entityId: input.batchId,
      details: { added, updated },
    });

    return { added, updated, items };
  }

  /**
   * Update single item
   */
  async updateItem(input: UpdateOpeningBalanceItemInput): Promise<OpeningBalanceItem> {
    const item = await this.prisma.openingBalanceItem.findFirst({
      where: {
        id: input.itemId,
      },
      include: {
        batch: true,
      },
    });

    if (!item) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Opening balance item not found',
      });
    }

    if (item.batch.organizationId !== this.organizationId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }

    if (item.batch.status !== 'draft') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Can only update items in draft batches',
      });
    }

    const updateData: Record<string, unknown> = {};

    if (input.openingDebit !== undefined) {
      updateData.openingDebit = input.openingDebit;
    }
    if (input.openingCredit !== undefined) {
      updateData.openingCredit = input.openingCredit;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    const updated = await this.prisma.openingBalanceItem.update({
      where: { id: input.itemId },
      data: updateData,
    });

    // Update batch totals
    await this.updateBatchTotals(item.batchId);
    await this.invalidateCache();

    this.auditLogger.log({
      action: 'OPENING_BALANCE_ITEM_UPDATED',
      entityType: 'OpeningBalanceItem',
      entityId: input.itemId,
    });

    return {
      id: updated.id,
      batchId: updated.batchId,
      accountId: updated.accountId,
      openingDebit: Number(updated.openingDebit),
      openingCredit: Number(updated.openingCredit),
      notes: updated.notes,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Remove items from batch
   */
  async removeItems(input: RemoveOpeningBalanceItemsInput): Promise<RemoveItemsResult> {
    const batch = await this.prisma.openingBalanceBatch.findFirst({
      where: {
        id: input.batchId,
        organizationId: this.organizationId,
      },
    });

    if (!batch) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Opening balance batch not found',
      });
    }

    if (batch.status !== 'draft') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Can only remove items from draft batches',
      });
    }

    const result = await this.prisma.openingBalanceItem.deleteMany({
      where: {
        id: { in: input.itemIds },
        batchId: input.batchId,
      },
    });

    // Update batch totals
    await this.updateBatchTotals(input.batchId);
    await this.invalidateCache();

    this.auditLogger.log({
      action: 'OPENING_BALANCE_ITEMS_REMOVED',
      entityType: 'OpeningBalanceBatch',
      entityId: input.batchId,
      details: { removed: result.count },
    });

    return { removed: result.count };
  }

  /**
   * Get items for batch
   */
  async getItems(input: GetOpeningBalanceItemsInput): Promise<OpeningBalanceItem[]> {
    const where: Record<string, unknown> = {
      batchId: input.batchId,
      batch: {
        organizationId: this.organizationId,
      },
    };

    if (!input.includeZeroBalances) {
      where.OR = [
        { openingDebit: { gt: 0 } },
        { openingCredit: { gt: 0 } },
      ];
    }

    const items = await this.prisma.openingBalanceItem.findMany({
      where,
      include: {
        account: {
          select: {
            accountCode: true,
            accountName: true,
          },
        },
      },
      orderBy: {
        account: { accountCode: 'asc' },
      },
    });

    return items.map(item => ({
      id: item.id,
      batchId: item.batchId,
      accountId: item.accountId,
      openingDebit: Number(item.openingDebit),
      openingCredit: Number(item.openingCredit),
      notes: item.notes,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  // =========================================================================
  // VALIDATION
  // =========================================================================

  /**
   * Validate batch for posting
   */
  async validateBatch(input: ValidateOpeningBalanceBatchInput): Promise<ValidationResult> {
    const batch = await this.prisma.openingBalanceBatch.findFirst({
      where: {
        id: input.batchId,
        organizationId: this.organizationId,
      },
      include: {
        items: {
          include: {
            account: {
              select: {
                accountCode: true,
                accountName: true,
                normalBalance: true,
              },
            },
          },
        },
      },
    });

    if (!batch) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Opening balance batch not found',
      });
    }

    const warnings: ValidationResult['warnings'] = [];
    const errors: string[] = [];

    // Check for empty batch
    if (batch.items.length === 0) {
      errors.push('No items in batch');
    }

    // Calculate totals
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const item of batch.items) {
      const debit = new Decimal(item.openingDebit.toString());
      const credit = new Decimal(item.openingCredit.toString());

      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);

      // Check for abnormal balance direction
      const isDebit = debit.greaterThan(0);
      const expectedDebit = item.account.normalBalance === 'debit';
      const hasBalance = debit.plus(credit).greaterThan(0);

      if (hasBalance && isDebit !== expectedDebit) {
        warnings.push({
          itemId: item.id,
          accountCode: item.account.accountCode,
          accountName: item.account.accountName,
          message: `${isDebit ? 'Debit' : 'Credit'} balance on ${item.account.normalBalance}-normal account`,
        });
      }
    }

    const difference = totalDebit.minus(totalCredit).abs().toNumber();
    const isBalanced = totalDebit.equals(totalCredit);

    // Update batch status if valid
    if (errors.length === 0 && isBalanced) {
      await this.prisma.openingBalanceBatch.update({
        where: { id: input.batchId },
        data: { status: 'verified' },
      });
    }

    return {
      isValid: errors.length === 0 && isBalanced,
      isBalanced,
      totalDebit: totalDebit.toNumber(),
      totalCredit: totalCredit.toNumber(),
      difference,
      itemCount: batch.items.length,
      warnings,
      errors,
    };
  }

  // =========================================================================
  // POSTING
  // =========================================================================

  /**
   * Post opening balances to create journal entry
   */
  async postOpeningBalances(input: PostOpeningBalancesInput): Promise<PostResult> {
    const batch = await this.prisma.openingBalanceBatch.findFirst({
      where: {
        id: input.batchId,
        organizationId: this.organizationId,
      },
      include: {
        items: {
          include: {
            account: true,
          },
        },
        fiscalYear: true,
      },
    });

    if (!batch) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Opening balance batch not found',
      });
    }

    if (batch.status === 'posted') {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Opening balances already posted',
      });
    }

    // Calculate totals
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const item of batch.items) {
      totalDebit = totalDebit.plus(item.openingDebit.toString());
      totalCredit = totalCredit.plus(item.openingCredit.toString());
    }

    const isBalanced = totalDebit.equals(totalCredit);

    if (!isBalanced && !input.forceUnbalanced) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Trial balance is out of balance by ${totalDebit.minus(totalCredit).abs().toFixed(2)}. Use forceUnbalanced=true to override.`,
      });
    }

    // Find opening period
    const openingPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        fiscalYearId: batch.fiscalYearId,
        periodNumber: 1,
      },
    });

    if (!openingPeriod) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Opening period not found for fiscal year',
      });
    }

    // Create journal entry
    const result = await this.prisma.$transaction(async (tx) => {
      // Generate entry number
      const entryNumber = await this.generateEntryNumber(tx, batch.fiscalYearId);

      // Create journal entry
      // Note: Type assertion needed due to Prisma transaction client type inference limitations
      const journalEntry = await tx.journalEntry.create({
        data: {
          organizationId: this.organizationId,
          periodId: openingPeriod.id,
          fiscalYearId: batch.fiscalYearId,
          entryNumber,
          entryDate: batch.fiscalYear.startDate,
          description: input.entryDescription || 'Opening balances',
          entryType: 'OPENING',
          status: 'POSTED',
          totalDebit: totalDebit.toNumber(),
          totalCredit: totalCredit.toNumber(),
          postedAt: new Date(),
          postedBy: this.userId,
          lines: {
            create: batch.items
              .filter(item =>
                new Decimal(item.openingDebit.toString()).greaterThan(0) ||
                new Decimal(item.openingCredit.toString()).greaterThan(0)
              )
              .map((item, index) => ({
                lineNumber: index + 1,
                accountId: item.accountId,
                debitAmount: item.openingDebit,
                creditAmount: item.openingCredit,
                description: `Opening balance: ${item.account.accountName}`,
              })),
          },
        } as any,
      });

      // Update batch status
      await tx.openingBalanceBatch.update({
        where: { id: input.batchId },
        data: {
          status: 'posted',
          journalEntryId: journalEntry.id,
          postedAt: new Date(),
          postedBy: this.userId,
          totalDebit: totalDebit.toNumber(),
          totalCredit: totalCredit.toNumber(),
          isBalanced,
        },
      });

      return journalEntry;
    });

    await this.invalidateCache();

    this.auditLogger.log({
      action: 'OPENING_BALANCES_POSTED',
      entityType: 'OpeningBalanceBatch',
      entityId: input.batchId,
      details: {
        journalEntryId: result.id,
        entryNumber: result.entryNumber,
        totalDebit: totalDebit.toNumber(),
        totalCredit: totalCredit.toNumber(),
      },
    });

    return {
      success: true,
      batchId: input.batchId,
      journalEntryId: result.id,
      entryNumber: result.entryNumber,
      postedAt: new Date(),
      totalDebit: totalDebit.toNumber(),
      totalCredit: totalCredit.toNumber(),
      itemCount: batch.items.length,
    };
  }

  // =========================================================================
  // IMPORT
  // =========================================================================

  /**
   * Import opening balances from file
   */
  async importFromFile(input: ImportOpeningBalancesInput): Promise<ImportResult> {
    // Verify batch exists and is draft
    const batch = await this.prisma.openingBalanceBatch.findFirst({
      where: {
        id: input.batchId,
        organizationId: this.organizationId,
        status: 'draft',
      },
    });

    if (!batch) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Draft batch not found',
      });
    }

    // Note: Full Excel/CSV parsing implementation would require xlsx library
    // This is a placeholder that shows the structure
    throw new TRPCError({
      code: 'NOT_IMPLEMENTED',
      message: 'File import not yet implemented. Use addItems for manual entry.',
    });
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================

  /**
   * Get comprehensive batch summary
   */
  async getSummary(input: GetOpeningBalanceSummaryInput): Promise<OpeningBalanceSummary> {
    const batch = await this.prisma.openingBalanceBatch.findFirst({
      where: {
        id: input.batchId,
        organizationId: this.organizationId,
      },
      include: {
        fiscalYear: {
          select: {
            id: true,
            yearCode: true,
            name: true,
            startDate: true,
          },
        },
        items: {
          include: {
            account: {
              select: {
                accountType: true,
                normalBalance: true,
              },
            },
          },
        },
      },
    });

    if (!batch) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Opening balance batch not found',
      });
    }

    // Calculate totals
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);
    let warningCount = 0;

    // Group by account type
    const byTypeMap = new Map<string, { debitTotal: Decimal; creditTotal: Decimal; accountCount: number }>();

    for (const item of batch.items) {
      const debit = new Decimal(item.openingDebit.toString());
      const credit = new Decimal(item.openingCredit.toString());

      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);

      // Check for warnings
      const isDebit = debit.greaterThan(0);
      const expectedDebit = item.account.normalBalance === 'debit';
      const hasBalance = debit.plus(credit).greaterThan(0);
      if (hasBalance && isDebit !== expectedDebit) {
        warningCount++;
      }

      // Group by account type
      const type = item.account.accountType;
      const existing = byTypeMap.get(type) || { debitTotal: new Decimal(0), creditTotal: new Decimal(0), accountCount: 0 };
      byTypeMap.set(type, {
        debitTotal: existing.debitTotal.plus(debit),
        creditTotal: existing.creditTotal.plus(credit),
        accountCount: existing.accountCount + 1,
      });
    }

    const byAccountType = Array.from(byTypeMap.entries()).map(([accountType, data]) => ({
      accountType,
      debitTotal: data.debitTotal.toNumber(),
      creditTotal: data.creditTotal.toNumber(),
      accountCount: data.accountCount,
    }));

    return {
      batch: {
        id: batch.id,
        organizationId: batch.organizationId,
        fiscalYearId: batch.fiscalYearId,
        status: batch.status as 'draft' | 'verified' | 'posted',
        totalDebit: Number(batch.totalDebit),
        totalCredit: Number(batch.totalCredit),
        isBalanced: batch.isBalanced,
        postedAt: batch.postedAt,
        postedBy: batch.postedBy,
        journalEntryId: batch.journalEntryId,
        createdAt: batch.createdAt,
        createdBy: batch.createdBy,
        updatedAt: batch.updatedAt,
      },
      fiscalYear: batch.fiscalYear,
      totalDebit: totalDebit.toNumber(),
      totalCredit: totalCredit.toNumber(),
      difference: totalDebit.minus(totalCredit).abs().toNumber(),
      isBalanced: totalDebit.equals(totalCredit),
      itemCount: batch.items.length,
      warningCount,
      byAccountType,
    };
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  private async updateBatchTotals(batchId: string): Promise<void> {
    const aggregation = await this.prisma.openingBalanceItem.aggregate({
      where: { batchId },
      _sum: {
        openingDebit: true,
        openingCredit: true,
      },
    });

    const totalDebit = new Decimal(aggregation._sum.openingDebit?.toString() || '0');
    const totalCredit = new Decimal(aggregation._sum.openingCredit?.toString() || '0');

    await this.prisma.openingBalanceBatch.update({
      where: { id: batchId },
      data: {
        totalDebit: totalDebit.toNumber(),
        totalCredit: totalCredit.toNumber(),
        isBalanced: totalDebit.equals(totalCredit),
      },
    });
  }

  private async generateEntryNumber(tx: TransactionClient, fiscalYearId: string): Promise<string> {
    const fiscalYear = await tx.fiscalYear.findUnique({
      where: { id: fiscalYearId },
    });

    if (!fiscalYear) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Fiscal year not found',
      });
    }

    const count = await tx.journalEntry.count({
      where: {
        fiscalYearId,
        entryType: 'OPENING',
      },
    });

    return `OB/${fiscalYear.yearCode}/${String(count + 1).padStart(3, '0')}`;
  }

  private async invalidateCache(): Promise<void> {
    const keys = await this.redis.keys(`${this.CACHE_PREFIX}:${this.organizationId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private mapBatchToResult(batch: any): CreateBatchResult {
    return {
      id: batch.id,
      organizationId: batch.organizationId,
      fiscalYearId: batch.fiscalYearId,
      status: batch.status,
      totalDebit: Number(batch.totalDebit),
      totalCredit: Number(batch.totalCredit),
      isBalanced: batch.isBalanced,
      postedAt: batch.postedAt,
      postedBy: batch.postedBy,
      journalEntryId: batch.journalEntryId,
      createdAt: batch.createdAt,
      createdBy: batch.createdBy,
      updatedAt: batch.updatedAt,
    };
  }
}
