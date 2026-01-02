// TAX-003: Tax Deadline Management Schemas
// Manages Polish tax deadlines, calendar, reminders, and holiday adjustments

import { z } from 'zod';

// =========================================================================
// ENUMS
// =========================================================================

/**
 * Tax type for deadline categorization
 */
export const deadlineTaxTypeSchema = z.enum(['VAT', 'CIT', 'PIT', 'ZUS', 'OTHER']);
export type DeadlineTaxType = z.infer<typeof deadlineTaxTypeSchema>;

/**
 * Deadline status
 */
export const deadlineStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'SUBMITTED',
  'CONFIRMED',
  'OVERDUE',
  'EXEMPT',
  'CANCELLED',
]);
export type DeadlineStatus = z.infer<typeof deadlineStatusSchema>;

/**
 * Reminder level for deadline notifications
 */
export const reminderLevelSchema = z.enum(['EARLY', 'STANDARD', 'URGENT', 'CRITICAL']);
export type ReminderLevel = z.infer<typeof reminderLevelSchema>;

/**
 * Notification channel
 */
export const notificationChannelSchema = z.enum(['EMAIL', 'SMS', 'IN_APP', 'PUSH']);
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

/**
 * Reminder status
 */
export const reminderStatusSchema = z.enum([
  'PENDING',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
  'SNOOZED',
]);
export type ReminderStatus = z.infer<typeof reminderStatusSchema>;

/**
 * Deadline type codes (Polish tax system)
 */
export const deadlineTypeCodeSchema = z.enum([
  'JPK_V7M', // Monthly VAT Declaration
  'JPK_V7K', // Quarterly VAT Declaration
  'VAT_PAYMENT', // VAT Payment
  'CIT_ADVANCE', // CIT Advance Payment
  'PIT_ADVANCE', // PIT Advance Payment
  'ZUS_DRA_EMP', // ZUS Declaration (employers)
  'ZUS_DRA_SELF', // ZUS Declaration (self-employed)
  'CIT_8', // Annual CIT Declaration
  'PIT_36', // Annual PIT Declaration
]);
export type DeadlineTypeCode = z.infer<typeof deadlineTypeCodeSchema>;

// =========================================================================
// ENTITY SCHEMAS
// =========================================================================

/**
 * Tax deadline type definition
 */
export const taxDeadlineTypeSchema = z.object({
  id: z.string().uuid(),
  code: deadlineTypeCodeSchema,
  name: z.string().min(1).max(200),
  namePl: z.string().min(1).max(200),
  taxType: deadlineTaxTypeSchema,
  description: z.string().nullish(),
  legalBasis: z.string().nullish(),
  penaltyDescription: z.string().nullish(),
  penaltyDailyRate: z.number().min(0).nullish(),
  baseDay: z.number().int().min(1).max(31),
  appliesToMonthly: z.boolean().default(false),
  appliesToQuarterly: z.boolean().default(false),
  appliesToAnnual: z.boolean().default(false),
  requiresEmployees: z.boolean().default(false),
  requiresVatPayer: z.boolean().default(false),
  requiresCitPayer: z.boolean().default(false),
  requiresPitPayer: z.boolean().default(false),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type TaxDeadlineType = z.infer<typeof taxDeadlineTypeSchema>;

/**
 * Polish holiday
 */
export const polishHolidaySchema = z.object({
  id: z.string().uuid(),
  date: z.date(),
  name: z.string().min(1).max(200),
  nameEn: z.string().max(200).nullish(),
  isMoveable: z.boolean().default(false),
  year: z.number().int().min(2000).max(2100),
  createdAt: z.date(),
});
export type PolishHoliday = z.infer<typeof polishHolidaySchema>;

/**
 * Client tax deadline
 */
export const clientTaxDeadlineSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),
  deadlineTypeId: z.string().uuid(),
  periodYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12).nullish(),
  periodQuarter: z.number().int().min(1).max(4).nullish(),
  baseDeadlineDate: z.date(),
  adjustedDeadlineDate: z.date(),
  adjustmentReason: z.string().max(200).nullish(),
  status: deadlineStatusSchema.default('PENDING'),
  submissionDate: z.date().nullish(),
  confirmationNumber: z.string().max(100).nullish(),
  confirmationDate: z.date().nullish(),
  notes: z.string().nullish(),
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type ClientTaxDeadline = z.infer<typeof clientTaxDeadlineSchema>;

/**
 * Deadline reminder configuration
 */
export const deadlineReminderConfigSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid().nullish(),
  deadlineTypeId: z.string().uuid().nullish(),
  reminderLevel: reminderLevelSchema,
  daysBefore: z.number().int().min(1).max(90),
  emailEnabled: z.boolean().default(true),
  smsEnabled: z.boolean().default(false),
  inAppEnabled: z.boolean().default(true),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type DeadlineReminderConfig = z.infer<typeof deadlineReminderConfigSchema>;

/**
 * Sent reminder log
 */
export const deadlineReminderSentSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  deadlineId: z.string().uuid(),
  userId: z.string().uuid(),
  reminderLevel: reminderLevelSchema,
  channel: notificationChannelSchema,
  sentAt: z.date(),
  deliveredAt: z.date().nullish(),
  readAt: z.date().nullish(),
  snoozedUntil: z.date().nullish(),
  messageId: z.string().max(200).nullish(),
  status: reminderStatusSchema.default('SENT'),
  errorMessage: z.string().nullish(),
  createdAt: z.date(),
});
export type DeadlineReminderSent = z.infer<typeof deadlineReminderSentSchema>;

// =========================================================================
// INPUT SCHEMAS - Deadline Retrieval
// =========================================================================

/**
 * Get deadlines with filters
 */
export const getDeadlinesSchema = z.object({
  clientId: z.string().uuid().optional(),
  taxType: deadlineTaxTypeSchema.optional(),
  status: deadlineStatusSchema.optional(),
  startDate: z.date(),
  endDate: z.date(),
});
export type GetDeadlinesInput = z.infer<typeof getDeadlinesSchema>;

/**
 * Get calendar view for a month
 */
export const getCalendarSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});
export type GetCalendarInput = z.infer<typeof getCalendarSchema>;

/**
 * Get Polish holidays for a year
 */
export const getHolidaysSchema = z.object({
  year: z.number().int().min(2020).max(2100),
});
export type GetHolidaysInput = z.infer<typeof getHolidaysSchema>;

/**
 * Get deadline by ID
 */
export const getDeadlineByIdSchema = z.object({
  deadlineId: z.string().uuid(),
});
export type GetDeadlineByIdInput = z.infer<typeof getDeadlineByIdSchema>;

/**
 * Get deadline types
 */
export const getDeadlineTypesSchema = z.object({
  taxType: deadlineTaxTypeSchema.optional(),
  isActive: z.boolean().optional(),
});
export type GetDeadlineTypesInput = z.infer<typeof getDeadlineTypesSchema>;

// =========================================================================
// INPUT SCHEMAS - Deadline Management
// =========================================================================

/**
 * Generate deadlines for a client
 */
export const generateDeadlinesSchema = z.object({
  clientId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
});
export type GenerateDeadlinesInput = z.infer<typeof generateDeadlinesSchema>;

/**
 * Update deadline status
 */
export const updateDeadlineStatusSchema = z.object({
  deadlineId: z.string().uuid(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'CONFIRMED', 'EXEMPT', 'CANCELLED']),
  confirmationNumber: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});
export type UpdateDeadlineStatusInput = z.infer<typeof updateDeadlineStatusSchema>;

/**
 * Calculate adjusted deadline date
 */
export const calculateAdjustedDeadlineSchema = z.object({
  baseDate: z.date(),
  year: z.number().int().min(2020).max(2100),
});
export type CalculateAdjustedDeadlineInput = z.infer<typeof calculateAdjustedDeadlineSchema>;

/**
 * Bulk update overdue deadlines
 */
export const updateOverdueDeadlinesSchema = z.object({
  organizationId: z.string().uuid().optional(),
});
export type UpdateOverdueDeadlinesInput = z.infer<typeof updateOverdueDeadlinesSchema>;

// =========================================================================
// INPUT SCHEMAS - Reminder Configuration
// =========================================================================

/**
 * Configure reminder settings
 */
export const configureRemindersSchema = z.object({
  deadlineTypeId: z.string().uuid().optional(),
  reminderLevel: reminderLevelSchema,
  daysBefore: z.number().int().min(1).max(90),
  emailEnabled: z.boolean().default(true),
  smsEnabled: z.boolean().default(false),
  inAppEnabled: z.boolean().default(true),
});
export type ConfigureRemindersInput = z.infer<typeof configureRemindersSchema>;

/**
 * Get reminder configurations
 */
export const getReminderConfigsSchema = z.object({
  deadlineTypeId: z.string().uuid().optional(),
});
export type GetReminderConfigsInput = z.infer<typeof getReminderConfigsSchema>;

/**
 * Snooze a reminder
 */
export const snoozeReminderSchema = z.object({
  reminderId: z.string().uuid(),
  snoozeUntil: z.date(),
});
export type SnoozeReminderInput = z.infer<typeof snoozeReminderSchema>;

/**
 * Get pending reminders
 */
export const getPendingRemindersSchema = z.object({
  userId: z.string().uuid().optional(),
});
export type GetPendingRemindersInput = z.infer<typeof getPendingRemindersSchema>;

// =========================================================================
// OUTPUT SCHEMAS
// =========================================================================

/**
 * Calendar summary
 */
export const calendarSummarySchema = z.object({
  total: z.number().int().min(0),
  pending: z.number().int().min(0),
  overdue: z.number().int().min(0),
  submitted: z.number().int().min(0),
  inProgress: z.number().int().min(0),
});
export type CalendarSummary = z.infer<typeof calendarSummarySchema>;

/**
 * Calendar result
 */
export const getCalendarResultSchema = z.object({
  deadlines: z.array(clientTaxDeadlineSchema.extend({
    client: z.object({
      id: z.string().uuid(),
      name: z.string(),
      nip: z.string().nullish(),
    }).optional(),
    deadlineType: taxDeadlineTypeSchema.optional(),
  })),
  holidays: z.array(polishHolidaySchema),
  summary: calendarSummarySchema,
});
export type GetCalendarResult = z.infer<typeof getCalendarResultSchema>;

/**
 * Adjusted deadline result
 */
export const adjustedDeadlineResultSchema = z.object({
  baseDate: z.date(),
  adjustedDate: z.date(),
  reason: z.string().nullish(),
  wasAdjusted: z.boolean(),
});
export type AdjustedDeadlineResult = z.infer<typeof adjustedDeadlineResultSchema>;

/**
 * Generate deadlines result
 */
export const generateDeadlinesResultSchema = z.object({
  generated: z.number().int().min(0),
  deadlineIds: z.array(z.string().uuid()),
  skipped: z.number().int().min(0),
  errors: z.array(z.string()),
});
export type GenerateDeadlinesResult = z.infer<typeof generateDeadlinesResultSchema>;

/**
 * Update overdue result
 */
export const updateOverdueResultSchema = z.object({
  updated: z.number().int().min(0),
  deadlineIds: z.array(z.string().uuid()),
});
export type UpdateOverdueResult = z.infer<typeof updateOverdueResultSchema>;

/**
 * Reminder notification result
 */
export const reminderNotificationResultSchema = z.object({
  emailsSent: z.number().int().min(0),
  smsSent: z.number().int().min(0),
  inAppSent: z.number().int().min(0),
  errors: z.array(z.string()),
});
export type ReminderNotificationResult = z.infer<typeof reminderNotificationResultSchema>;

/**
 * Client deadline with relations
 */
export const clientDeadlineWithRelationsSchema = clientTaxDeadlineSchema.extend({
  client: z.object({
    id: z.string().uuid(),
    name: z.string(),
    nip: z.string().nullish(),
  }).optional(),
  deadlineType: taxDeadlineTypeSchema.optional(),
  daysUntilDue: z.number().int().optional(),
  potentialPenalty: z.number().min(0).optional(),
});
export type ClientDeadlineWithRelations = z.infer<typeof clientDeadlineWithRelationsSchema>;

/**
 * Upcoming deadlines summary
 */
export const upcomingDeadlinesSummarySchema = z.object({
  today: z.array(clientDeadlineWithRelationsSchema),
  thisWeek: z.array(clientDeadlineWithRelationsSchema),
  thisMonth: z.array(clientDeadlineWithRelationsSchema),
  overdue: z.array(clientDeadlineWithRelationsSchema),
  counts: z.object({
    today: z.number().int().min(0),
    thisWeek: z.number().int().min(0),
    thisMonth: z.number().int().min(0),
    overdue: z.number().int().min(0),
  }),
});
export type UpcomingDeadlinesSummary = z.infer<typeof upcomingDeadlinesSummarySchema>;

