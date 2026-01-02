import { router, protectedProcedure } from '../../trpc';
import { TrialBalanceService } from '../../services/ace/trial-balance.service';
import {
  generateTrialBalanceSchema,
  comparativeTrialBalanceSchema,
  createWorkingTBSchema,
  getWorkingTBSchema,
  listWorkingTBSchema,
  addAdjustmentColumnSchema,
  recordAdjustmentSchema,
  lockWTBSchema,
  deleteWTBSchema,
  exportTrialBalanceSchema,
} from '@ksiegowacrm/shared';

/**
 * ACC-012: Trial Balance Router
 * Provides trial balance generation, working trial balances, and export operations
 */
export const trialBalanceRouter = router({
  // ===========================================================================
  // TRIAL BALANCE GENERATION
  // ===========================================================================

  /**
   * Generate a trial balance as of a specific date
   * Aggregates account balances with optional filtering and grouping
   */
  generate: protectedProcedure
    .input(generateTrialBalanceSchema)
    .query(async ({ ctx, input }) => {
      const service = new TrialBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.generate(input);
    }),

  /**
   * Generate a comparative trial balance
   * Compares current period against multiple historical periods
   */
  generateComparative: protectedProcedure
    .input(comparativeTrialBalanceSchema)
    .query(async ({ ctx, input }) => {
      const service = new TrialBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.generateComparative(input);
    }),

  // ===========================================================================
  // WORKING TRIAL BALANCE MANAGEMENT
  // ===========================================================================

  /**
   * Create a new working trial balance
   * Used for audit adjustments and period-end closing
   */
  createWorkingTB: protectedProcedure
    .input(createWorkingTBSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TrialBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.createWorkingTB(input);
    }),

  /**
   * Get a working trial balance with lines and adjustment columns
   */
  getWorkingTB: protectedProcedure
    .input(getWorkingTBSchema)
    .query(async ({ ctx, input }) => {
      const service = new TrialBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getWorkingTB(input);
    }),

  /**
   * List working trial balances with filtering and pagination
   */
  listWorkingTB: protectedProcedure
    .input(listWorkingTBSchema)
    .query(async ({ ctx, input }) => {
      const service = new TrialBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.listWorkingTB(input);
    }),

  // ===========================================================================
  // ADJUSTMENT COLUMNS AND ADJUSTMENTS
  // ===========================================================================

  /**
   * Add an adjustment column to a working trial balance
   * Supports ADJUSTING, RECLASSIFICATION, and PROPOSED types
   */
  addAdjustmentColumn: protectedProcedure
    .input(addAdjustmentColumnSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TrialBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.addAdjustmentColumn(input);
    }),

  /**
   * Record an adjustment on a WTB line
   * Positive amount = debit, Negative amount = credit
   */
  recordAdjustment: protectedProcedure
    .input(recordAdjustmentSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TrialBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.recordAdjustment(input);
    }),

  // ===========================================================================
  // LOCK AND DELETE
  // ===========================================================================

  /**
   * Lock a working trial balance
   * Prevents further modifications
   */
  lock: protectedProcedure
    .input(lockWTBSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TrialBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.lock(input);
    }),

  /**
   * Delete a working trial balance
   * Only draft WTBs can be deleted
   */
  delete: protectedProcedure
    .input(deleteWTBSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TrialBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.delete(input);
    }),

  // ===========================================================================
  // EXPORT
  // ===========================================================================

  /**
   * Export trial balance to various formats
   * Supports XLSX, PDF, and CSV
   */
  export: protectedProcedure
    .input(exportTrialBalanceSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TrialBalanceService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.export(input);
    }),
});

export type TrialBalanceRouter = typeof trialBalanceRouter;
