import { router, protectedProcedure } from '../../trpc';
import { BalanceSheetService } from '../../services/ace/balance-sheet.service';
import {
  generateBalanceSheetSchema,
  exportBalanceSheetSchema,
  saveBalanceSheetSchema,
  getBalanceSheetSchema,
  listBalanceSheetSchema,
  deleteBalanceSheetSchema,
} from '@ksiegowacrm/shared';

/**
 * ACC-013: Balance Sheet (Bilans) Router
 * Provides Polish balance sheet generation, export, and management operations
 */
export const balanceSheetRouter = router({
  // ===========================================================================
  // BALANCE SHEET GENERATION
  // ===========================================================================

  /**
   * Generate a balance sheet as of a specific date
   * Creates Polish Bilans following Ustawa o rachunkowości structure
   */
  generate: protectedProcedure
    .input(generateBalanceSheetSchema)
    .query(async ({ ctx, input }) => {
      const service = new BalanceSheetService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.generate(input);
    }),

  // ===========================================================================
  // BALANCE SHEET EXPORT
  // ===========================================================================

  /**
   * Export balance sheet to various formats
   * Supports EXCEL, PDF, CSV, and XML (Ministry format)
   */
  export: protectedProcedure
    .input(exportBalanceSheetSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new BalanceSheetService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.export(input);
    }),

  // ===========================================================================
  // BALANCE SHEET SAVE & RETRIEVE
  // ===========================================================================

  /**
   * Save a balance sheet report
   * Optionally mark as final (prevents deletion)
   */
  save: protectedProcedure
    .input(saveBalanceSheetSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new BalanceSheetService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.save(input);
    }),

  /**
   * Get a saved balance sheet report with full data
   */
  get: protectedProcedure
    .input(getBalanceSheetSchema)
    .query(async ({ ctx, input }) => {
      const service = new BalanceSheetService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.get(input);
    }),

  // ===========================================================================
  // BALANCE SHEET LIST & DELETE
  // ===========================================================================

  /**
   * List balance sheet reports with filtering and pagination
   */
  list: protectedProcedure
    .input(listBalanceSheetSchema)
    .query(async ({ ctx, input }) => {
      const service = new BalanceSheetService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.list(input);
    }),

  /**
   * Delete a balance sheet report
   * Only non-final reports can be deleted
   */
  delete: protectedProcedure
    .input(deleteBalanceSheetSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new BalanceSheetService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.delete(input);
    }),
});

export type BalanceSheetRouter = typeof balanceSheetRouter;
