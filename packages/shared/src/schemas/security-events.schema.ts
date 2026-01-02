import { z } from 'zod';

// ==========================================================================
// SECURITY EVENTS SCHEMAS (AIM-012)
// Security alerts, notifications, and event streaming
// ==========================================================================

/**
 * Alert severity levels (matching Prisma enum)
 */
export const alertSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type AlertSeverity = z.infer<typeof alertSeveritySchema>;

/**
 * Alert status (matching Prisma enum)
 */
export const alertStatusSchema = z.enum(['active', 'acknowledged', 'resolved', 'dismissed']);
export type AlertStatus = z.infer<typeof alertStatusSchema>;

/**
 * Security alert types
 */
export const securityAlertTypeSchema = z.enum([
  // Login security
  'BRUTE_FORCE_DETECTED',
  'SUSPICIOUS_LOGIN_LOCATION',
  'MULTIPLE_FAILED_LOGINS',
  'NEW_DEVICE_LOGIN',
  'CONCURRENT_SESSIONS_EXCEEDED',
  // Account security
  'ACCOUNT_LOCKED',
  'ACCOUNT_UNLOCKED',
  'PASSWORD_BREACH_DETECTED',
  'MFA_DISABLED',
  'SENSITIVE_DATA_ACCESS',
  // Rate limiting
  'RATE_LIMIT_EXCEEDED',
  'API_ABUSE_DETECTED',
  // Session security
  'SESSION_HIJACK_SUSPECTED',
  'TOKEN_REUSE_DETECTED',
  'INVALID_TOKEN_ATTEMPT',
  // Permission security
  'UNAUTHORIZED_ACCESS_ATTEMPT',
  'PRIVILEGE_ESCALATION_ATTEMPT',
  'ROLE_ABUSE_DETECTED',
  // System security
  'CONFIGURATION_CHANGE',
  'ADMIN_ACTION',
  'CRITICAL_ERROR',
]);
export type SecurityAlertType = z.infer<typeof securityAlertTypeSchema>;

/**
 * Notification channel types (matching Prisma enum)
 */
export const notificationChannelSchema = z.enum(['email', 'sms', 'push', 'slack', 'teams']);
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

// ==========================================================================
// LIST SECURITY ALERTS
// ==========================================================================

/**
 * Filter schema for listing security alerts
 */
export const securityAlertFilterSchema = z.object({
  // User filter
  userId: z.string().uuid().optional(),
  // Type filter
  types: z.array(securityAlertTypeSchema).optional(),
  // Severity filter
  severities: z.array(alertSeveritySchema).optional(),
  // Status filter
  statuses: z.array(alertStatusSchema).optional(),
  // Date range
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  // IP address filter
  ipAddress: z.string().max(45).optional(),
  // Search in title/description
  searchTerm: z.string().max(100).optional(),
});
export type SecurityAlertFilter = z.infer<typeof securityAlertFilterSchema>;

/**
 * Pagination schema for security alerts
 */
export const securityAlertPaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'severity', 'status', 'type']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type SecurityAlertPagination = z.infer<typeof securityAlertPaginationSchema>;

/**
 * List security alerts input
 */
export const listSecurityAlertsSchema = z.object({
  filter: securityAlertFilterSchema.optional(),
  pagination: securityAlertPaginationSchema.optional(),
});
export type ListSecurityAlertsInput = z.infer<typeof listSecurityAlertsSchema>;

// ==========================================================================
// GET SINGLE ALERT
// ==========================================================================

/**
 * Get security alert by ID
 */
export const getSecurityAlertSchema = z.object({
  id: z.string().uuid(),
});
export type GetSecurityAlertInput = z.infer<typeof getSecurityAlertSchema>;

// ==========================================================================
// UPDATE ALERT STATUS
// ==========================================================================

/**
 * Acknowledge alert
 */
export const acknowledgeAlertSchema = z.object({
  id: z.string().uuid(),
  notes: z.string().max(1000).optional(),
});
export type AcknowledgeAlertInput = z.infer<typeof acknowledgeAlertSchema>;

/**
 * Resolve alert
 */
export const resolveAlertSchema = z.object({
  id: z.string().uuid(),
  resolution: z.string().min(1).max(2000),
  preventionActions: z.array(z.string().max(500)).optional(),
});
export type ResolveAlertInput = z.infer<typeof resolveAlertSchema>;

/**
 * Dismiss alert
 */
export const dismissAlertSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(1).max(500),
  falsePositive: z.boolean().default(false),
});
export type DismissAlertInput = z.infer<typeof dismissAlertSchema>;

// ==========================================================================
// ALERT STATISTICS
// ==========================================================================

/**
 * Get alert statistics input
 */
export const getAlertStatsSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  userId: z.string().uuid().optional(),
  groupBy: z.enum(['type', 'severity', 'status', 'day', 'week', 'month']).default('type'),
});
export type GetAlertStatsInput = z.infer<typeof getAlertStatsSchema>;

// ==========================================================================
// NOTIFICATION SUBSCRIPTIONS
// ==========================================================================

/**
 * Create notification subscription
 */
export const createNotificationSubscriptionSchema = z.object({
  channel: notificationChannelSchema,
  endpoint: z.string().min(1).max(500), // email, phone, webhook URL
  eventTypes: z.array(securityAlertTypeSchema).min(1),
  severities: z.array(alertSeveritySchema).optional(), // Filter by severity (default: all)
});
export type CreateNotificationSubscriptionInput = z.infer<typeof createNotificationSubscriptionSchema>;

/**
 * Update notification subscription
 */
export const updateNotificationSubscriptionSchema = z.object({
  id: z.string().uuid(),
  eventTypes: z.array(securityAlertTypeSchema).min(1).optional(),
  severities: z.array(alertSeveritySchema).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateNotificationSubscriptionInput = z.infer<typeof updateNotificationSubscriptionSchema>;

/**
 * Delete notification subscription
 */
export const deleteNotificationSubscriptionSchema = z.object({
  id: z.string().uuid(),
});
export type DeleteNotificationSubscriptionInput = z.infer<typeof deleteNotificationSubscriptionSchema>;

/**
 * List notification subscriptions
 */
export const listNotificationSubscriptionsSchema = z.object({
  channel: notificationChannelSchema.optional(),
  isActive: z.boolean().optional(),
});
export type ListNotificationSubscriptionsInput = z.infer<typeof listNotificationSubscriptionsSchema>;

// ==========================================================================
// OUTPUT SCHEMAS
// ==========================================================================

/**
 * Security alert output
 */
export const securityAlertOutputSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  type: securityAlertTypeSchema,
  severity: alertSeveritySchema,
  status: alertStatusSchema,
  title: z.string(),
  description: z.string(),
  metadata: z.record(z.unknown()),
  ipAddress: z.string().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  resolvedBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  // Related data
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
  }).nullable().optional(),
  escalations: z.array(z.object({
    id: z.string().uuid(),
    level: z.number().int(),
    escalatedAt: z.string().datetime(),
    acknowledgedAt: z.string().datetime().nullable(),
  })).optional(),
});
export type SecurityAlertOutput = z.infer<typeof securityAlertOutputSchema>;

/**
 * Paginated security alerts response
 */
export const paginatedSecurityAlertsSchema = z.object({
  items: z.array(securityAlertOutputSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  totalPages: z.number().int(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
});
export type PaginatedSecurityAlerts = z.infer<typeof paginatedSecurityAlertsSchema>;

/**
 * Alert statistics by type
 */
export const alertStatsByTypeSchema = z.object({
  type: securityAlertTypeSchema,
  count: z.number().int(),
  activeCount: z.number().int(),
  resolvedCount: z.number().int(),
});
export type AlertStatsByType = z.infer<typeof alertStatsByTypeSchema>;

/**
 * Alert statistics by severity
 */
export const alertStatsBySeveritySchema = z.object({
  severity: alertSeveritySchema,
  count: z.number().int(),
  activeCount: z.number().int(),
});
export type AlertStatsBySeverity = z.infer<typeof alertStatsBySeveritySchema>;

/**
 * Alert statistics response
 */
export const alertStatsResponseSchema = z.object({
  totalCount: z.number().int(),
  activeCount: z.number().int(),
  acknowledgedCount: z.number().int(),
  resolvedCount: z.number().int(),
  dismissedCount: z.number().int(),
  criticalActiveCount: z.number().int(),
  highActiveCount: z.number().int(),
  byType: z.array(alertStatsByTypeSchema).optional(),
  bySeverity: z.array(alertStatsBySeveritySchema).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
export type AlertStatsResponse = z.infer<typeof alertStatsResponseSchema>;

/**
 * Notification subscription output
 */
export const notificationSubscriptionOutputSchema = z.object({
  id: z.string().uuid(),
  channel: notificationChannelSchema,
  endpoint: z.string(),
  eventTypes: z.array(securityAlertTypeSchema),
  severities: z.array(alertSeveritySchema).nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type NotificationSubscriptionOutput = z.infer<typeof notificationSubscriptionOutputSchema>;

/**
 * Alert update result
 */
export const alertUpdateResultSchema = z.object({
  success: z.boolean(),
  alert: securityAlertOutputSchema,
  message: z.string(),
});
export type AlertUpdateResult = z.infer<typeof alertUpdateResultSchema>;

/**
 * Dashboard summary (real-time data)
 */
export const securityDashboardSummarySchema = z.object({
  activeAlerts: z.number().int(),
  criticalAlerts: z.number().int(),
  highAlerts: z.number().int(),
  alertsLast24h: z.number().int(),
  alertsLast7d: z.number().int(),
  topAlertTypes: z.array(z.object({
    type: securityAlertTypeSchema,
    count: z.number().int(),
  })),
  recentAlerts: z.array(securityAlertOutputSchema),
  generatedAt: z.string().datetime(),
});
export type SecurityDashboardSummary = z.infer<typeof securityDashboardSummarySchema>;
