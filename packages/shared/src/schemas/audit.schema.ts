import { z } from 'zod';

/**
 * Audit Event Types enum (matching Prisma)
 */
export const auditEventTypeSchema = z.enum([
  // Registration events
  'USER_REGISTERED',
  'REGISTRATION_DUPLICATE_ATTEMPT',
  'EMAIL_VERIFICATION_SENT',
  'EMAIL_VERIFIED',
  'EMAIL_VERIFICATION_FAILED',
  // Login events
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGIN_BLOCKED',
  'LOGIN_MFA_REQUIRED',
  'LOGIN_MFA_SUCCESS',
  'LOGIN_MFA_FAILED',
  // Session events
  'SESSION_CREATED',
  'SESSION_REFRESHED',
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'LOGOUT',
  'LOGOUT_ALL_DEVICES',
  // Password events
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'PASSWORD_CHANGED',
  'PASSWORD_BREACH_DETECTED',
  // MFA events
  'MFA_ENABLED',
  'MFA_DISABLED',
  'MFA_SETUP_INITIATED',
  'MFA_BACKUP_CODE_USED',
  'MFA_BACKUP_CODES_REGENERATED',
  // RBAC events
  'ROLE_CREATED',
  'ROLE_UPDATED',
  'ROLE_DELETED',
  'ROLE_PERMISSIONS_UPDATED',
  'ROLE_ASSIGNED',
  'ROLE_REVOKED',
  'PERMISSION_CHECK_FAILED',
  // Profile events
  'PROFILE_UPDATED',
  'PROFILE_ONBOARDING_COMPLETED',
  // Security events
  'ACCOUNT_LOCKED',
  'ACCOUNT_UNLOCKED',
  'SUSPICIOUS_ACTIVITY',
  'NEW_DEVICE_LOGIN',
  'NEW_LOCATION_LOGIN',
]);

export type AuditEventTypeEnum = z.infer<typeof auditEventTypeSchema>;

/**
 * Export format
 */
export const auditExportFormatSchema = z.enum(['json', 'csv', 'pdf']);
export type AuditExportFormatEnum = z.infer<typeof auditExportFormatSchema>;

/**
 * Sort order
 */
export const auditSortOrderSchema = z.enum(['asc', 'desc']);
export type AuditSortOrderEnum = z.infer<typeof auditSortOrderSchema>;

/**
 * Sort field
 */
export const auditSortFieldSchema = z.enum(['createdAt', 'eventType', 'actorId']);
export type AuditSortFieldEnum = z.infer<typeof auditSortFieldSchema>;

// ==========================================================================
// LIST AUDIT LOGS
// ==========================================================================

/**
 * Filter schema for listing audit logs
 */
export const auditLogFilterSchema = z.object({
  // User filters
  actorId: z.string().uuid().optional(),
  targetId: z.string().uuid().optional(),

  // Event type filter
  eventTypes: z.array(auditEventTypeSchema).optional(),

  // Date range filters
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),

  // Other filters
  ipAddress: z.string().max(45).optional(),
  correlationId: z.string().uuid().optional(),
  success: z.boolean().optional(),

  // Search in metadata
  searchTerm: z.string().max(100).optional(),
});

export type AuditLogFilter = z.infer<typeof auditLogFilterSchema>;

/**
 * Pagination schema
 */
export const auditLogPaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: auditSortFieldSchema.default('createdAt'),
  sortOrder: auditSortOrderSchema.default('desc'),
});

export type AuditLogPagination = z.infer<typeof auditLogPaginationSchema>;

/**
 * List audit logs input schema
 */
export const listAuditLogsSchema = z.object({
  filter: auditLogFilterSchema.optional(),
  pagination: auditLogPaginationSchema.optional(),
});

export type ListAuditLogsInput = z.infer<typeof listAuditLogsSchema>;

// ==========================================================================
// GET SINGLE AUDIT LOG
// ==========================================================================

/**
 * Get audit log by ID schema
 */
export const getAuditLogSchema = z.object({
  id: z.string().uuid(),
});

export type GetAuditLogInput = z.infer<typeof getAuditLogSchema>;

// ==========================================================================
// EXPORT AUDIT LOGS
// ==========================================================================

/**
 * Export audit logs schema
 */
export const exportAuditLogsSchema = z.object({
  filter: auditLogFilterSchema.optional(),
  format: auditExportFormatSchema,
  // Maximum records to export (for safety)
  maxRecords: z.number().int().min(1).max(100000).default(10000),
  // Include sensitive metadata
  includeSensitiveData: z.boolean().default(false),
});

export type ExportAuditLogsInput = z.infer<typeof exportAuditLogsSchema>;

// ==========================================================================
// AUDIT LOG STATISTICS
// ==========================================================================

/**
 * Get audit statistics schema
 */
export const getAuditStatsSchema = z.object({
  // Time range for stats
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  // Group by options
  groupBy: z.enum(['eventType', 'day', 'week', 'month', 'hour']).default('eventType'),
  // Filter by user
  actorId: z.string().uuid().optional(),
});

export type GetAuditStatsInput = z.infer<typeof getAuditStatsSchema>;

// ==========================================================================
// OUTPUT SCHEMAS
// ==========================================================================

/**
 * Single audit log entry output
 */
export const auditLogEntrySchema = z.object({
  id: z.string().uuid(),
  eventType: auditEventTypeSchema,
  actorId: z.string().uuid().nullable(),
  targetType: z.string().nullable(),
  targetId: z.string().uuid().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  correlationId: z.string().uuid().nullable(),
  metadata: z.record(z.unknown()),
  success: z.boolean(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime(),
  // Related data (optional)
  actor: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
  }).nullable().optional(),
  target: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
  }).nullable().optional(),
});

export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

/**
 * Paginated audit logs response
 */
export const paginatedAuditLogsSchema = z.object({
  items: z.array(auditLogEntrySchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  totalPages: z.number().int(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
});

export type PaginatedAuditLogs = z.infer<typeof paginatedAuditLogsSchema>;

/**
 * Audit statistics by event type
 */
export const auditStatsByEventTypeSchema = z.object({
  eventType: auditEventTypeSchema,
  count: z.number().int(),
  successCount: z.number().int(),
  failureCount: z.number().int(),
});

export type AuditStatsByEventType = z.infer<typeof auditStatsByEventTypeSchema>;

/**
 * Audit statistics by time period
 */
export const auditStatsByPeriodSchema = z.object({
  period: z.string(), // e.g., "2025-01-15", "2025-W03", "2025-01"
  count: z.number().int(),
  successCount: z.number().int(),
  failureCount: z.number().int(),
});

export type AuditStatsByPeriod = z.infer<typeof auditStatsByPeriodSchema>;

/**
 * Full audit statistics response
 */
export const auditStatsResponseSchema = z.object({
  totalCount: z.number().int(),
  successCount: z.number().int(),
  failureCount: z.number().int(),
  byEventType: z.array(auditStatsByEventTypeSchema).optional(),
  byPeriod: z.array(auditStatsByPeriodSchema).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type AuditStatsResponse = z.infer<typeof auditStatsResponseSchema>;

/**
 * Export result
 */
export const auditExportResultSchema = z.object({
  format: auditExportFormatSchema,
  recordCount: z.number().int(),
  fileSize: z.number().int(), // in bytes
  downloadUrl: z.string().url().optional(),
  content: z.string().optional(), // For JSON/CSV inline content
  expiresAt: z.string().datetime().optional(),
});

export type AuditExportResult = z.infer<typeof auditExportResultSchema>;
