import { router, protectedProcedure } from '../../trpc';
import { IncomeStatementService } from '../../services/ace/income-statement.service';
import {
  generateIncomeStatementSchema,
  exportIncomeStatementSchema,
  saveIncomeStatementSchema,
  getIncomeStatementSchema,
  listIncomeStatementsSchema,
  deleteIncomeStatementSchema,
  approveIncomeStatementSchema,
} from '@ksiegowacrm/shared';

/**
 * ACC-014: Income Statement (Rachunek Zysków i Strat - RZiS) Router
 * Provides Polish income statement generation, export, and management operations
 * following Ustawa o rachunkowości standards
 */
export const incomeStatementRouter = router({
  // ===========================================================================
  // INCOME STATEMENT GENERATION
  // ===========================================================================

  /**
   * Generate an income statement for a specified period
   * Creates Polish RZiS following Ustawa o rachunkowości structure
   * Supports both COMPARATIVE (wariant porównawczy) and COST_BY_FUNCTION (wariant kalkulacyjny) variants
   */
  generate: protectedProcedure
    .input(generateIncomeStatementSchema)
    .query(async ({ ctx, input }) => {
      const service = new IncomeStatementService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.generate(input);
    }),

  // ===========================================================================
  // INCOME STATEMENT EXPORT
  // ===========================================================================

  /**
   * Export income statement to various formats
   * Supports EXCEL, PDF, CSV, and XML (Ministry format)
   * Available in Polish (PL) and English (EN)
   */
  export: protectedProcedure
    .input(exportIncomeStatementSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new IncomeStatementService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.export(input);
    }),

  // ===========================================================================
  // INCOME STATEMENT SAVE & RETRIEVE
  // ===========================================================================

  /**
   * Save an income statement report
   * Optionally mark as final (prevents modification)
   */
  save: protectedProcedure
    .input(saveIncomeStatementSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new IncomeStatementService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.save(input);
    }),

  /**
   * Get a saved income statement report with full data
   */
  get: protectedProcedure
    .input(getIncomeStatementSchema)
    .query(async ({ ctx, input }) => {
      const service = new IncomeStatementService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.get(input);
    }),

  // ===========================================================================
  // INCOME STATEMENT LIST & DELETE
  // ===========================================================================

  /**
   * List income statement reports with filtering and pagination
   */
  list: protectedProcedure
    .input(listIncomeStatementsSchema)
    .query(async ({ ctx, input }) => {
      const service = new IncomeStatementService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.list(input);
    }),

  /**
   * Delete an income statement report
   * Only DRAFT reports can be deleted
   * FINAL and APPROVED reports are protected
   */
  delete: protectedProcedure
    .input(deleteIncomeStatementSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new IncomeStatementService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.delete(input);
    }),

  // ===========================================================================
  // INCOME STATEMENT APPROVAL
  // ===========================================================================

  /**
   * Approve an income statement report
   * Changes status from FINAL to APPROVED
   * Records approver information for audit trail
   */
  approve: protectedProcedure
    .input(approveIncomeStatementSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new IncomeStatementService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.approve(input);
    }),
});

export type IncomeStatementRouter = typeof incomeStatementRouter;
