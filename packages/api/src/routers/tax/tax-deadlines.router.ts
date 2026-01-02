// TAX-003: Tax Deadline Management Router
// Manages Polish tax deadlines, calendar, reminders, and holiday adjustments

import { router, protectedProcedure } from '../../trpc';
import { TaxDeadlinesService } from '../../services/tax';
import {
  getDeadlinesSchema,
  getCalendarSchema,
  getHolidaysSchema,
  getDeadlineByIdSchema,
  getDeadlineTypesSchema,
  generateDeadlinesSchema,
  updateDeadlineStatusSchema,
  calculateAdjustedDeadlineSchema,
  updateOverdueDeadlinesSchema,
  configureRemindersSchema,
  getReminderConfigsSchema,
  snoozeReminderSchema,
  getPendingRemindersSchema,
} from '@ksiegowacrm/shared';

/**
 * Tax Deadlines Router
 * Provides endpoints for managing Polish tax deadlines, calendar, and reminders
 */
export const taxDeadlinesRouter = router({
  // =========================================================================
  // DEADLINE RETRIEVAL ENDPOINTS
  // =========================================================================

  /**
   * Get deadlines with filters
   */
  getDeadlines: protectedProcedure
    .input(getDeadlinesSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxDeadlinesService(ctx.prisma);
      return service.getDeadlines(input);
    }),

  /**
   * Get calendar view for a month
   */
  getCalendar: protectedProcedure
    .input(getCalendarSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxDeadlinesService(ctx.prisma);
      return service.getCalendar(input);
    }),

  /**
   * Get Polish holidays for a year
   */
  getHolidays: protectedProcedure
    .input(getHolidaysSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxDeadlinesService(ctx.prisma);
      return service.getHolidays(input);
    }),

  /**
   * Get deadline by ID
   */
  getDeadlineById: protectedProcedure
    .input(getDeadlineByIdSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxDeadlinesService(ctx.prisma);
      return service.getDeadlineById(input);
    }),

  /**
   * Get deadline types
   */
  getDeadlineTypes: protectedProcedure
    .input(getDeadlineTypesSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxDeadlinesService(ctx.prisma);
      return service.getDeadlineTypes(input);
    }),

  /**
   * Get upcoming deadlines summary
   */
  getUpcomingDeadlines: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new TaxDeadlinesService(ctx.prisma);
      return service.getUpcomingDeadlines();
    }),

  // =========================================================================
  // DEADLINE MANAGEMENT ENDPOINTS
  // =========================================================================

  /**
   * Calculate adjusted deadline date
   */
  calculateAdjustedDeadline: protectedProcedure
    .input(calculateAdjustedDeadlineSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxDeadlinesService(ctx.prisma);
      return service.calculateAdjustedDeadline(input);
    }),

  /**
   * Generate deadlines for a client
   */
  generateDeadlines: protectedProcedure
    .input(generateDeadlinesSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaxDeadlinesService(ctx.prisma);
      // In production, fetch client's tax configuration
      const taxConfig = {
        vatPayerStatus: 'ACTIVE',
        vatPeriod: 'MONTHLY',
        citPayerStatus: 'ACTIVE',
        pitPayerStatus: undefined,
        hasEmployees: true,
      };
      return service.generateDeadlines(
        input,
        ctx.session!.organizationId,
        ctx.session!.userId,
        taxConfig
      );
    }),

  /**
   * Update deadline status
   */
  updateDeadlineStatus: protectedProcedure
    .input(updateDeadlineStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaxDeadlinesService(ctx.prisma);
      return service.updateDeadlineStatus(
        input,
        ctx.session!.organizationId,
        ctx.session!.userId
      );
    }),

  /**
   * Update overdue deadlines
   */
  updateOverdueDeadlines: protectedProcedure
    .input(updateOverdueDeadlinesSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaxDeadlinesService(ctx.prisma);
      return service.updateOverdueDeadlines(input, ctx.session!.organizationId);
    }),

  // =========================================================================
  // REMINDER CONFIGURATION ENDPOINTS
  // =========================================================================

  /**
   * Configure reminder settings
   */
  configureReminders: protectedProcedure
    .input(configureRemindersSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaxDeadlinesService(ctx.prisma);
      return service.configureReminders(
        input,
        ctx.session!.organizationId,
        ctx.session!.userId
      );
    }),

  /**
   * Get reminder configurations
   */
  getReminderConfigs: protectedProcedure
    .input(getReminderConfigsSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxDeadlinesService(ctx.prisma);
      return service.getReminderConfigs(
        input,
        ctx.session!.organizationId,
        ctx.session!.userId
      );
    }),

  /**
   * Snooze a reminder
   */
  snoozeReminder: protectedProcedure
    .input(snoozeReminderSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaxDeadlinesService(ctx.prisma);
      return service.snoozeReminder(input, ctx.session!.userId);
    }),

  /**
   * Get pending reminders
   */
  getPendingReminders: protectedProcedure
    .input(getPendingRemindersSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxDeadlinesService(ctx.prisma);
      return service.getPendingReminders(input, ctx.session!.organizationId);
    }),
});

export type TaxDeadlinesRouter = typeof taxDeadlinesRouter;
