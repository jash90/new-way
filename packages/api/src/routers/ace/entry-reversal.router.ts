import { router, protectedProcedure } from '../../trpc';
import { EntryReversalService } from '../../services/ace/entry-reversal.service';
import {
  reverseEntrySchema,
  scheduleAutoReversalSchema,
  cancelAutoReversalSchema,
  createCorrectionSchema,
  listReversalsSchema,
  getReversalDetailsSchema,
  listPendingAutoReversalsSchema,
  processAutoReversalsSchema,
} from '@ksiegowacrm/shared';

/**
 * ACC-011: Entry Reversal Router
 * Provides entry reversal, auto-reversal scheduling, and correction operations
 */
export const entryReversalRouter = router({
  // =========================================================================
  // REVERSAL OPERATIONS
  // =========================================================================

  /**
   * Reverse a posted journal entry
   * Creates a new reversing entry with swapped debits/credits
   */
  reverseEntry: protectedProcedure
    .input(reverseEntrySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EntryReversalService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.reverseEntry(input);
    }),

  /**
   * Schedule an entry for automatic reversal on a future date
   * Useful for accruals and temporary entries
   */
  scheduleAutoReversal: protectedProcedure
    .input(scheduleAutoReversalSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EntryReversalService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.scheduleAutoReversal(input);
    }),

  /**
   * Cancel a scheduled auto-reversal
   * Removes the auto-reversal date without affecting the entry
   */
  cancelAutoReversal: protectedProcedure
    .input(cancelAutoReversalSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EntryReversalService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.cancelAutoReversal(input);
    }),

  // =========================================================================
  // CORRECTION ENTRIES
  // =========================================================================

  /**
   * Create a correction entry for partial adjustments
   * Links to original entry while applying specific corrections
   */
  createCorrection: protectedProcedure
    .input(createCorrectionSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EntryReversalService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.createCorrection(input);
    }),

  // =========================================================================
  // LIST AND QUERY
  // =========================================================================

  /**
   * List reversal entries with filtering and pagination
   * Supports filtering by date, user, and reversal type
   */
  listReversals: protectedProcedure
    .input(listReversalsSchema)
    .query(async ({ ctx, input }) => {
      const service = new EntryReversalService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.listReversals(input);
    }),

  /**
   * Get comprehensive reversal details
   * Shows original entry, reversing entry, and net effect
   */
  getReversalDetails: protectedProcedure
    .input(getReversalDetailsSchema)
    .query(async ({ ctx, input }) => {
      const service = new EntryReversalService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getReversalDetails(input);
    }),

  /**
   * List pending auto-reversals scheduled for future dates
   * Useful for reviewing upcoming automatic reversals
   */
  listPendingAutoReversals: protectedProcedure
    .input(listPendingAutoReversalsSchema)
    .query(async ({ ctx, input }) => {
      const service = new EntryReversalService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.listPendingAutoReversals(input);
    }),

  // =========================================================================
  // AUTO-REVERSAL PROCESSING
  // =========================================================================

  /**
   * Process all due auto-reversals
   * Called by scheduler job or manually to process entries due today
   * Supports dry-run mode for previewing without creating reversals
   */
  processAutoReversals: protectedProcedure
    .input(processAutoReversalsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EntryReversalService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.processAutoReversals(input);
    }),
});

export type EntryReversalRouter = typeof entryReversalRouter;
