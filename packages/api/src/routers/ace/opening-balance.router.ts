import { router, protectedProcedure } from '../../trpc';
import { OpeningBalanceService } from '../../services/ace/opening-balance.service';
import {
  createOpeningBalanceBatchSchema,
  getOpeningBalanceBatchSchema,
  listOpeningBalanceBatchesSchema,
  deleteOpeningBalanceBatchSchema,
  addOpeningBalanceItemsSchema,
  updateOpeningBalanceItemSchema,
  removeOpeningBalanceItemsSchema,
  getOpeningBalanceItemsSchema,
  validateOpeningBalanceBatchSchema,
  postOpeningBalancesSchema,
  getOpeningBalanceSummarySchema,
} from '@ksiegowacrm/shared';

/**
 * ACC-005: Opening Balance Router
 * Manages opening balance batches for fiscal year initialization
 */
export const openingBalanceRouter = router({
  // =========================================================================
  // BATCH OPERATIONS
  // =========================================================================

  /**
   * Create a new opening balance batch
   * Creates a draft batch for the specified fiscal year
   */
  createBatch: protectedProcedure
    .input(createOpeningBalanceBatchSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new OpeningBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.createBatch(input);
    }),

  /**
   * Get opening balance batch with items
   * Returns batch details including all balance items
   */
  getBatch: protectedProcedure
    .input(getOpeningBalanceBatchSchema)
    .query(async ({ ctx, input }) => {
      const service = new OpeningBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getBatch(input);
    }),

  /**
   * List opening balance batches
   * Filters by fiscal year and/or status
   */
  listBatches: protectedProcedure
    .input(listOpeningBalanceBatchesSchema)
    .query(async ({ ctx, input }) => {
      const service = new OpeningBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.listBatches(input);
    }),

  /**
   * Delete opening balance batch
   * Only draft batches can be deleted
   */
  deleteBatch: protectedProcedure
    .input(deleteOpeningBalanceBatchSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new OpeningBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.deleteBatch(input);
    }),

  // =========================================================================
  // ITEM OPERATIONS
  // =========================================================================

  /**
   * Add items to batch
   * Upserts items - updates if account already exists in batch
   */
  addItems: protectedProcedure
    .input(addOpeningBalanceItemsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new OpeningBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.addItems(input);
    }),

  /**
   * Update single item
   * Updates debit/credit amounts or notes
   */
  updateItem: protectedProcedure
    .input(updateOpeningBalanceItemSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new OpeningBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.updateItem(input);
    }),

  /**
   * Remove items from batch
   * Deletes specified items from draft batch
   */
  removeItems: protectedProcedure
    .input(removeOpeningBalanceItemsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new OpeningBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.removeItems(input);
    }),

  /**
   * Get items for batch
   * Optionally excludes zero balance items
   */
  getItems: protectedProcedure
    .input(getOpeningBalanceItemsSchema)
    .query(async ({ ctx, input }) => {
      const service = new OpeningBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getItems(input);
    }),

  // =========================================================================
  // VALIDATION & POSTING
  // =========================================================================

  /**
   * Validate batch for posting
   * Checks balance, warns about abnormal directions
   */
  validateBatch: protectedProcedure
    .input(validateOpeningBalanceBatchSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new OpeningBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.validateBatch(input);
    }),

  /**
   * Post opening balances
   * Creates journal entry and updates batch status
   */
  postOpeningBalances: protectedProcedure
    .input(postOpeningBalancesSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new OpeningBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.postOpeningBalances(input);
    }),

  // =========================================================================
  // SUMMARY
  // =========================================================================

  /**
   * Get comprehensive batch summary
   * Includes totals, warnings, and breakdown by account type
   */
  getSummary: protectedProcedure
    .input(getOpeningBalanceSummarySchema)
    .query(async ({ ctx, input }) => {
      const service = new OpeningBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getSummary(input);
    }),
});

export type OpeningBalanceRouter = typeof openingBalanceRouter;
