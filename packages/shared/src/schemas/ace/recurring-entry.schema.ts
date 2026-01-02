import { z } from 'zod';

// ===========================================================================
// ENUMS
// ===========================================================================

/**
 * Frequency types for recurring entries
 */
export const frequencySchema = z.enum([
  'DAILY',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'YEARLY',
  'CUSTOM',
]);
export type Frequency = z.infer<typeof frequencySchema>;

/**
 * Schedule status
 */
export const scheduleStatusSchema = z.enum([
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'EXPIRED',
  'ERROR',
]);
export type ScheduleStatus = z.infer<typeof scheduleStatusSchema>;

/**
 * End of month handling options
 */
export const endOfMonthHandlingSchema = z.enum([
  'LAST_DAY',      // Use last day of month
  'SKIP',          // Skip if day doesn't exist
  'FIRST_OF_NEXT', // Use first day of next month
]);
export type EndOfMonthHandling = z.infer<typeof endOfMonthHandlingSchema>;

/**
 * Weekend adjustment options
 */
export const weekendAdjustmentSchema = z.enum([
  'PREVIOUS', // Move to previous business day
  'NEXT',     // Move to next business day
  'NONE',     // Don't adjust
]);
export type WeekendAdjustment = z.infer<typeof weekendAdjustmentSchema>;

/**
 * Execution type
 */
export const executionTypeSchema = z.enum([
  'AUTOMATIC',
  'MANUAL',
  'BATCH',
  'MISSED',
]);
export type ExecutionType = z.infer<typeof executionTypeSchema>;

/**
 * Execution status
 */
export const executionStatusSchema = z.enum([
  'SUCCESS',
  'FAILED',
  'SKIPPED',
]);
export type ExecutionStatus = z.infer<typeof executionStatusSchema>;

// ===========================================================================
// INPUT SCHEMAS
// ===========================================================================

/**
 * Create recurring schedule input
 */
export const createRecurringScheduleSchema = z.object({
  scheduleName: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  templateId: z.string().uuid(),

  // Frequency configuration
  frequency: frequencySchema,
  frequencyInterval: z.number().int().positive().default(1),

  // Day specification
  dayOfWeek: z.number().int().min(0).max(6).optional(), // For WEEKLY (0=Sunday)
  dayOfMonth: z.number().int().min(1).max(31).optional(), // For MONTHLY
  monthOfYear: z.number().int().min(1).max(12).optional(), // For YEARLY
  endOfMonthHandling: endOfMonthHandlingSchema.default('LAST_DAY'),

  // Weekend/holiday handling
  skipWeekends: z.boolean().default(false),
  skipHolidays: z.boolean().default(false),
  weekendAdjustment: weekendAdjustmentSchema.default('PREVIOUS'),

  // Date range
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  maxOccurrences: z.number().int().positive().optional(),

  // Generation options
  autoPost: z.boolean().default(false),
  defaultVariableValues: z.record(z.string(), z.union([z.string(), z.number(), z.coerce.date()])).optional(),

  // Notifications
  notifyOnSuccess: z.boolean().default(true),
  notifyOnFailure: z.boolean().default(true),
  notificationEmails: z.array(z.string().email()).optional(),
}).refine(
  (data) => {
    if (data.frequency === 'WEEKLY' && data.dayOfWeek === undefined) {
      return false;
    }
    if ((data.frequency === 'MONTHLY' || data.frequency === 'QUARTERLY') && data.dayOfMonth === undefined) {
      return false;
    }
    if (data.frequency === 'YEARLY' && (data.dayOfMonth === undefined || data.monthOfYear === undefined)) {
      return false;
    }
    return true;
  },
  { message: 'Day specification required for selected frequency' }
).refine(
  (data) => {
    if (data.endDate && data.endDate <= data.startDate) {
      return false;
    }
    return true;
  },
  { message: 'End date must be after start date' }
);
export type CreateRecurringScheduleInput = z.infer<typeof createRecurringScheduleSchema>;

/**
 * Update schedule input
 */
export const updateRecurringScheduleSchema = z.object({
  scheduleId: z.string().uuid(),
  scheduleName: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),

  frequency: frequencySchema.optional(),
  frequencyInterval: z.number().int().positive().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  monthOfYear: z.number().int().min(1).max(12).optional(),
  endOfMonthHandling: endOfMonthHandlingSchema.optional(),

  skipWeekends: z.boolean().optional(),
  skipHolidays: z.boolean().optional(),
  weekendAdjustment: weekendAdjustmentSchema.optional(),

  endDate: z.coerce.date().nullable().optional(),
  maxOccurrences: z.number().int().positive().nullable().optional(),

  autoPost: z.boolean().optional(),
  defaultVariableValues: z.record(z.string(), z.union([z.string(), z.number(), z.coerce.date()])).optional(),

  notifyOnSuccess: z.boolean().optional(),
  notifyOnFailure: z.boolean().optional(),
  notificationEmails: z.array(z.string().email()).optional(),
});
export type UpdateRecurringScheduleInput = z.infer<typeof updateRecurringScheduleSchema>;

/**
 * Get schedule by ID
 */
export const getRecurringScheduleSchema = z.object({
  scheduleId: z.string().uuid(),
});
export type GetRecurringScheduleInput = z.infer<typeof getRecurringScheduleSchema>;

/**
 * Pause schedule
 */
export const pauseRecurringScheduleSchema = z.object({
  scheduleId: z.string().uuid(),
});
export type PauseRecurringScheduleInput = z.infer<typeof pauseRecurringScheduleSchema>;

/**
 * Resume schedule
 */
export const resumeRecurringScheduleSchema = z.object({
  scheduleId: z.string().uuid(),
  generateMissed: z.boolean().default(false),
});
export type ResumeRecurringScheduleInput = z.infer<typeof resumeRecurringScheduleSchema>;

/**
 * Delete schedule
 */
export const deleteRecurringScheduleSchema = z.object({
  scheduleId: z.string().uuid(),
});
export type DeleteRecurringScheduleInput = z.infer<typeof deleteRecurringScheduleSchema>;

/**
 * Manual generation input
 */
export const manualGenerateSchema = z.object({
  scheduleId: z.string().uuid(),
  entryDate: z.coerce.date().optional(), // Defaults to today
  variableOverrides: z.record(z.string(), z.union([z.string(), z.number(), z.coerce.date()])).optional(),
  autoPost: z.boolean().optional(), // Override schedule setting
});
export type ManualGenerateInput = z.infer<typeof manualGenerateSchema>;

/**
 * Batch generate missed entries
 */
export const batchGenerateMissedSchema = z.object({
  scheduleId: z.string().uuid(),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  createAsDraft: z.boolean().default(true), // Always draft for review
});
export type BatchGenerateMissedInput = z.infer<typeof batchGenerateMissedSchema>;

/**
 * List schedules filter
 */
export const listRecurringSchedulesSchema = z.object({
  status: scheduleStatusSchema.optional(),
  templateId: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  upcomingDays: z.number().int().min(1).max(365).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});
export type ListRecurringSchedulesInput = z.infer<typeof listRecurringSchedulesSchema>;

/**
 * Preview upcoming entries
 */
export const previewUpcomingSchema = z.object({
  scheduleId: z.string().uuid().optional(), // If not provided, show all
  fromDate: z.coerce.date().optional(), // Default: today
  toDate: z.coerce.date(), // Required
});
export type PreviewUpcomingInput = z.infer<typeof previewUpcomingSchema>;

/**
 * Get execution history
 */
export const getExecutionHistorySchema = z.object({
  scheduleId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});
export type GetExecutionHistoryInput = z.infer<typeof getExecutionHistorySchema>;

/**
 * Add holiday
 */
export const addHolidaySchema = z.object({
  holidayDate: z.coerce.date(),
  holidayName: z.string().min(1).max(255),
  isBankingHoliday: z.boolean().default(true),
  countryCode: z.string().length(2).default('PL'),
});
export type AddHolidayInput = z.infer<typeof addHolidaySchema>;

/**
 * Delete holiday
 */
export const deleteHolidaySchema = z.object({
  holidayId: z.string().uuid(),
});
export type DeleteHolidayInput = z.infer<typeof deleteHolidaySchema>;

/**
 * List holidays
 */
export const listHolidaysSchema = z.object({
  year: z.number().int().min(2000).max(2100),
});
export type ListHolidaysInput = z.infer<typeof listHolidaysSchema>;

/**
 * Process due schedules (scheduler job)
 */
export const processDueSchedulesSchema = z.object({
  forDate: z.coerce.date().optional(), // Defaults to today
});
export type ProcessDueSchedulesInput = z.infer<typeof processDueSchedulesSchema>;

// ===========================================================================
// ENTITY SCHEMAS
// ===========================================================================

/**
 * Recurring entry schedule entity
 */
export const recurringScheduleSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  scheduleCode: z.string(),
  scheduleName: z.string(),
  description: z.string().nullable(),
  templateId: z.string().uuid(),

  frequency: frequencySchema,
  frequencyInterval: z.number(),
  dayOfWeek: z.number().nullable(),
  dayOfMonth: z.number().nullable(),
  monthOfYear: z.number().nullable(),
  endOfMonthHandling: endOfMonthHandlingSchema,

  skipWeekends: z.boolean(),
  skipHolidays: z.boolean(),
  weekendAdjustment: weekendAdjustmentSchema,

  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable(),
  nextRunDate: z.coerce.date(),
  lastRunDate: z.coerce.date().nullable(),

  autoPost: z.boolean(),
  maxOccurrences: z.number().nullable(),
  occurrencesCount: z.number(),
  defaultVariableValues: z.record(z.string(), z.any()),

  status: scheduleStatusSchema,
  pausedAt: z.coerce.date().nullable(),
  pausedBy: z.string().uuid().nullable(),
  errorMessage: z.string().nullable(),
  retryCount: z.number(),
  maxRetries: z.number(),

  notifyOnSuccess: z.boolean(),
  notifyOnFailure: z.boolean(),
  notificationEmails: z.array(z.string()).nullable(),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});
export type RecurringSchedule = z.infer<typeof recurringScheduleSchema>;

/**
 * Schedule execution entity
 */
export const scheduleExecutionSchema = z.object({
  id: z.string().uuid(),
  scheduleId: z.string().uuid(),
  executionDate: z.coerce.date(),
  scheduledDate: z.coerce.date(),
  executionType: executionTypeSchema,
  status: executionStatusSchema,
  errorMessage: z.string().nullable(),
  journalEntryId: z.string().uuid().nullable(),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  executionTimeMs: z.number().nullable(),
  variableValuesUsed: z.record(z.string(), z.any()).nullable(),
  createdAt: z.coerce.date(),
});
export type ScheduleExecution = z.infer<typeof scheduleExecutionSchema>;

/**
 * Holiday calendar entity
 */
export const holidaySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  holidayDate: z.coerce.date(),
  holidayName: z.string(),
  isBankingHoliday: z.boolean(),
  countryCode: z.string(),
  createdAt: z.coerce.date(),
  createdBy: z.string().uuid().nullable(),
});
export type Holiday = z.infer<typeof holidaySchema>;

/**
 * Schedule with template
 */
export const recurringScheduleWithTemplateSchema = recurringScheduleSchema.extend({
  template: z.object({
    id: z.string().uuid(),
    templateName: z.string(),
    templateCode: z.string(),
  }).optional(),
  createdByUser: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }).nullable().optional(),
});
export type RecurringScheduleWithTemplate = z.infer<typeof recurringScheduleWithTemplateSchema>;

/**
 * Execution with entry reference
 */
export const executionWithEntrySchema = scheduleExecutionSchema.extend({
  journalEntry: z.object({
    id: z.string().uuid(),
    entryNumber: z.string(),
    status: z.string(),
  }).nullable().optional(),
});
export type ExecutionWithEntry = z.infer<typeof executionWithEntrySchema>;

// ===========================================================================
// RESULT SCHEMAS
// ===========================================================================

/**
 * List schedules result
 */
export const listRecurringSchedulesResultSchema = z.object({
  schedules: z.array(recurringScheduleWithTemplateSchema),
  total: z.number(),
  hasMore: z.boolean(),
});
export type ListRecurringSchedulesResult = z.infer<typeof listRecurringSchedulesResultSchema>;

/**
 * Resume result
 */
export const resumeScheduleResultSchema = z.object({
  schedule: recurringScheduleSchema,
  missedEntriesGenerated: z.number(),
});
export type ResumeScheduleResult = z.infer<typeof resumeScheduleResultSchema>;

/**
 * Batch generate result
 */
export const batchGenerateMissedResultSchema = z.object({
  total: z.number(),
  successful: z.number(),
  failed: z.number(),
  results: z.array(z.object({
    date: z.coerce.date(),
    success: z.boolean(),
    entryId: z.string().uuid().optional(),
    error: z.string().optional(),
  })),
});
export type BatchGenerateMissedResult = z.infer<typeof batchGenerateMissedResultSchema>;

/**
 * Preview upcoming entry
 */
export const upcomingEntrySchema = z.object({
  scheduleId: z.string().uuid(),
  scheduleName: z.string(),
  templateName: z.string(),
  scheduledDate: z.coerce.date(),
  autoPost: z.boolean(),
});
export type UpcomingEntry = z.infer<typeof upcomingEntrySchema>;

/**
 * Preview upcoming result
 */
export const previewUpcomingResultSchema = z.array(upcomingEntrySchema);
export type PreviewUpcomingResult = z.infer<typeof previewUpcomingResultSchema>;

/**
 * Process due schedules result
 */
export const processDueSchedulesResultSchema = z.object({
  processed: z.number(),
  successful: z.number(),
  failed: z.number(),
  results: z.array(z.object({
    scheduleId: z.string().uuid(),
    status: z.enum(['success', 'failed', 'skipped']),
    entryId: z.string().uuid().optional(),
    error: z.string().optional(),
  })),
});
export type ProcessDueSchedulesResult = z.infer<typeof processDueSchedulesResultSchema>;

/**
 * Delete schedule result
 */
export const deleteRecurringScheduleResultSchema = z.object({
  success: z.boolean(),
  scheduleId: z.string().uuid(),
});
export type DeleteRecurringScheduleResult = z.infer<typeof deleteRecurringScheduleResultSchema>;
