import { router, protectedProcedure } from '../../trpc';
import { FiscalYearService } from '../../services/ace/fiscal-year.service';
import {
  createFiscalYearSchema,
  getFiscalYearSchema,
  listFiscalYearsSchema,
  updateFiscalYearSchema,
  openFiscalYearSchema,
  closeFiscalYearSchema,
  lockFiscalYearSchema,
  setCurrentFiscalYearSchema,
  deleteFiscalYearSchema,
  getCurrentFiscalYearSchema,
  getFiscalYearStatisticsSchema,
  listFiscalPeriodsSchema,
  closeFiscalPeriodSchema,
  reopenFiscalPeriodSchema,
} from '@ksiegowacrm/shared';

/**
 * ACE-008: Fiscal Year Management Router
 * Manages fiscal years and periods for accounting operations
 */
export const fiscalYearRouter = router({
  /**
   * Create a new fiscal year
   * Optionally generates 12 monthly periods automatically
   */
  create: protectedProcedure
    .input(createFiscalYearSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new FiscalYearService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.createFiscalYear(input);
    }),

  /**
   * Get fiscal year by ID
   * Optionally includes fiscal periods
   */
  get: protectedProcedure
    .input(getFiscalYearSchema)
    .query(async ({ ctx, input }) => {
      const service = new FiscalYearService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getFiscalYear(input);
    }),

  /**
   * List fiscal years with filtering and pagination
   */
  list: protectedProcedure
    .input(listFiscalYearsSchema)
    .query(async ({ ctx, input }) => {
      const service = new FiscalYearService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.listFiscalYears(input);
    }),

  /**
   * Update fiscal year name and code
   * Only allowed for draft fiscal years
   */
  update: protectedProcedure
    .input(updateFiscalYearSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new FiscalYearService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.updateFiscalYear(input);
    }),

  /**
   * Open fiscal year (draft → open)
   * Enables journal entries to be posted
   */
  open: protectedProcedure
    .input(openFiscalYearSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new FiscalYearService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.openFiscalYear(input);
    }),

  /**
   * Close fiscal year (open → closed)
   * Can force close even with open periods
   */
  close: protectedProcedure
    .input(closeFiscalYearSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new FiscalYearService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.closeFiscalYear(input);
    }),

  /**
   * Lock fiscal year (closed → locked)
   * Permanently prevents modifications (e.g., after audit)
   */
  lock: protectedProcedure
    .input(lockFiscalYearSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new FiscalYearService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.lockFiscalYear(input);
    }),

  /**
   * Set current (active) fiscal year
   * Automatically unsets previous current year
   */
  setCurrent: protectedProcedure
    .input(setCurrentFiscalYearSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new FiscalYearService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.setCurrentFiscalYear(input);
    }),

  /**
   * Delete fiscal year
   * Only allowed for draft years without journal entries
   */
  delete: protectedProcedure
    .input(deleteFiscalYearSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new FiscalYearService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.deleteFiscalYear(input);
    }),

  /**
   * Get current (active) fiscal year
   */
  getCurrent: protectedProcedure
    .input(getCurrentFiscalYearSchema)
    .query(async ({ ctx, input }) => {
      const service = new FiscalYearService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getCurrentFiscalYear(input);
    }),

  /**
   * Get fiscal year statistics
   * Includes journal entry counts, balances, and period status
   */
  getStatistics: protectedProcedure
    .input(getFiscalYearStatisticsSchema)
    .query(async ({ ctx, input }) => {
      const service = new FiscalYearService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getFiscalYearStatistics(input);
    }),

  /**
   * List fiscal periods for a fiscal year
   */
  listPeriods: protectedProcedure
    .input(listFiscalPeriodsSchema)
    .query(async ({ ctx, input }) => {
      const service = new FiscalYearService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.listFiscalPeriods(input);
    }),

  /**
   * Close fiscal period (open → closed)
   */
  closePeriod: protectedProcedure
    .input(closeFiscalPeriodSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new FiscalYearService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.closeFiscalPeriod(input);
    }),

  /**
   * Reopen fiscal period (closed → open)
   * Requires reason for audit trail
   */
  reopenPeriod: protectedProcedure
    .input(reopenFiscalPeriodSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new FiscalYearService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.reopenFiscalPeriod(input);
    }),
});

export type FiscalYearRouter = typeof fiscalYearRouter;
