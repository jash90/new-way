import { router, protectedProcedure } from '../../trpc';
import { RecurringEntryService } from '../../services/ace/recurring-entry.service';
import {
  createRecurringScheduleSchema,
  updateRecurringScheduleSchema,
  getRecurringScheduleSchema,
  pauseRecurringScheduleSchema,
  resumeRecurringScheduleSchema,
  deleteRecurringScheduleSchema,
  manualGenerateSchema,
  batchGenerateMissedSchema,
  listRecurringSchedulesSchema,
  previewUpcomingSchema,
  getExecutionHistorySchema,
  addHolidaySchema,
  deleteHolidaySchema,
  listHolidaysSchema,
  processDueSchedulesSchema,
} from '@ksiegowacrm/shared';

/**
 * ACC-010: Recurring Entries Router
 * Provides recurring schedule CRUD, entry generation, and scheduling operations
 */
export const recurringEntryRouter = router({
  // =========================================================================
  // SCHEDULE CRUD
  // =========================================================================

  /**
   * Create a new recurring schedule
   * Supports various frequencies: daily, weekly, monthly, quarterly, yearly
   */
  createSchedule: protectedProcedure
    .input(createRecurringScheduleSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new RecurringEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.createSchedule(input);
    }),

  /**
   * Get schedule with full details
   */
  getSchedule: protectedProcedure
    .input(getRecurringScheduleSchema)
    .query(async ({ ctx, input }) => {
      const service = new RecurringEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getSchedule(input);
    }),

  /**
   * Update recurring schedule configuration
   */
  updateSchedule: protectedProcedure
    .input(updateRecurringScheduleSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new RecurringEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.updateSchedule(input);
    }),

  /**
   * Pause an active schedule
   * Prevents automatic entry generation until resumed
   */
  pauseSchedule: protectedProcedure
    .input(pauseRecurringScheduleSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new RecurringEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.pauseSchedule(input);
    }),

  /**
   * Resume a paused schedule
   * Optionally generates entries missed during pause period
   */
  resumeSchedule: protectedProcedure
    .input(resumeRecurringScheduleSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new RecurringEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.resumeSchedule(input);
    }),

  /**
   * Delete a recurring schedule
   * Does not delete previously generated entries
   */
  deleteSchedule: protectedProcedure
    .input(deleteRecurringScheduleSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new RecurringEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.deleteSchedule(input);
    }),

  // =========================================================================
  // LIST AND SEARCH
  // =========================================================================

  /**
   * List schedules with filtering and pagination
   * Supports filtering by status, template, search text, and upcoming days
   */
  listSchedules: protectedProcedure
    .input(listRecurringSchedulesSchema)
    .query(async ({ ctx, input }) => {
      const service = new RecurringEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.listSchedules(input);
    }),

  // =========================================================================
  // ENTRY GENERATION
  // =========================================================================

  /**
   * Manually generate an entry from schedule
   * Useful for ad-hoc generation outside the scheduled dates
   */
  manualGenerate: protectedProcedure
    .input(manualGenerateSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new RecurringEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.manualGenerate(input);
    }),

  /**
   * Batch generate missed entries for a date range
   * Creates entries as drafts for review
   */
  batchGenerateMissed: protectedProcedure
    .input(batchGenerateMissedSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new RecurringEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.batchGenerateMissed(input);
    }),

  // =========================================================================
  // PREVIEW AND HISTORY
  // =========================================================================

  /**
   * Preview upcoming scheduled entries
   * Shows projected entries without creating them
   */
  previewUpcoming: protectedProcedure
    .input(previewUpcomingSchema)
    .query(async ({ ctx, input }) => {
      const service = new RecurringEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.previewUpcoming(input);
    }),

  /**
   * Get execution history for a schedule
   * Shows past executions with success/failure status
   */
  getExecutionHistory: protectedProcedure
    .input(getExecutionHistorySchema)
    .query(async ({ ctx, input }) => {
      const service = new RecurringEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getExecutionHistory(input);
    }),

  // =========================================================================
  // HOLIDAY MANAGEMENT
  // =========================================================================

  /**
   * Add a holiday to the calendar
   * Holidays can be skipped in schedule execution
   */
  addHoliday: protectedProcedure
    .input(addHolidaySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new RecurringEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.addHoliday(input);
    }),

  /**
   * Delete a holiday from the calendar
   */
  deleteHoliday: protectedProcedure
    .input(deleteHolidaySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new RecurringEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.deleteHoliday(input);
    }),

  /**
   * List holidays for a specific year
   */
  listHolidays: protectedProcedure
    .input(listHolidaysSchema)
    .query(async ({ ctx, input }) => {
      const service = new RecurringEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.listHolidays(input);
    }),

  // =========================================================================
  // SCHEDULER OPERATIONS
  // =========================================================================

  /**
   * Process all due schedules
   * Called by scheduler job to generate entries for schedules due today
   */
  processDueSchedules: protectedProcedure
    .input(processDueSchedulesSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new RecurringEntryService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.processDueSchedules(input);
    }),
});

export type RecurringEntryRouter = typeof recurringEntryRouter;
