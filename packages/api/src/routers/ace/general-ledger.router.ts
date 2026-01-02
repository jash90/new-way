import { router, protectedProcedure } from '../../trpc';
import { GeneralLedgerService } from '../../services/ace/general-ledger.service';
import {
  getAccountLedgerSchema,
  getFullGLReportSchema,
  getAccountBalanceSchema,
  getAccountBalancesSchema,
  recalculateBalanceSchema,
  postToGLSchema,
  batchRecalculateBalancesSchema,
} from '@ksiegowacrm/shared';

/**
 * ACC-008: General Ledger Router
 * Provides General Ledger viewing, reporting, and maintenance operations
 */
export const generalLedgerRouter = router({
  // =========================================================================
  // ACCOUNT LEDGER
  // =========================================================================

  /**
   * Get ledger entries for a specific account
   * Supports filtering by period, date range, entry types, and search
   * Calculates running balance when requested
   */
  getAccountLedger: protectedProcedure
    .input(getAccountLedgerSchema)
    .query(async ({ ctx, input }) => {
      const service = new GeneralLedgerService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getAccountLedger(input);
    }),

  // =========================================================================
  // FULL GL REPORT
  // =========================================================================

  /**
   * Generate full General Ledger report
   * Summarizes all accounts with movements and balances
   * Supports grouping by account type
   */
  getFullReport: protectedProcedure
    .input(getFullGLReportSchema)
    .query(async ({ ctx, input }) => {
      const service = new GeneralLedgerService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getFullReport(input);
    }),

  // =========================================================================
  // ACCOUNT BALANCES
  // =========================================================================

  /**
   * Get account balance as of a specific date
   */
  getAccountBalance: protectedProcedure
    .input(getAccountBalanceSchema)
    .query(async ({ ctx, input }) => {
      const service = new GeneralLedgerService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getAccountBalance(input);
    }),

  /**
   * Get balances for multiple accounts in a period
   */
  getAccountBalances: protectedProcedure
    .input(getAccountBalancesSchema)
    .query(async ({ ctx, input }) => {
      const service = new GeneralLedgerService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getAccountBalances(input);
    }),

  // =========================================================================
  // BALANCE MAINTENANCE
  // =========================================================================

  /**
   * Recalculate balance for a specific account/period
   * Useful for maintenance and error correction
   */
  recalculateBalance: protectedProcedure
    .input(recalculateBalanceSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new GeneralLedgerService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.recalculateBalance(input);
    }),

  /**
   * Batch recalculate balances for a period
   * Can process all accounts or specific accounts
   */
  batchRecalculateBalances: protectedProcedure
    .input(batchRecalculateBalancesSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new GeneralLedgerService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.batchRecalculateBalances(input);
    }),

  // =========================================================================
  // POSTING
  // =========================================================================

  /**
   * Post a journal entry to the General Ledger
   * Creates GL records and updates account balances
   */
  postToGL: protectedProcedure
    .input(postToGLSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new GeneralLedgerService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.postToGL(input);
    }),
});

export type GeneralLedgerRouter = typeof generalLedgerRouter;
