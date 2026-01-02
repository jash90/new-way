/**
 * Audit log event types for AIM module
 * Per AIM-011 specification
 */
export type AuditEventType =
  // Registration events
  | 'USER_REGISTERED'
  | 'EMAIL_VERIFICATION_SENT'
  | 'EMAIL_VERIFIED'
  | 'EMAIL_VERIFICATION_FAILED'

  // Authentication events
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGIN_BLOCKED'
  | 'LOGOUT'
  | 'LOGOUT_ALL'
  | 'FORCE_LOGOUT'

  // Password events
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_SUCCESS'
  | 'PASSWORD_RESET_FAILED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_CHANGE_FAILED'

  // Session events
  | 'SESSION_CREATED'
  | 'SESSION_REFRESHED'
  | 'SESSION_REVOKED'
  | 'SESSION_EXPIRED'

  // MFA events
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'MFA_CHALLENGE_CREATED'
  | 'MFA_CHALLENGE_SUCCESS'
  | 'MFA_CHALLENGE_FAILED'
  | 'MFA_BACKUP_CODE_USED'
  | 'MFA_BACKUP_CODES_REGENERATED'

  // RBAC events
  | 'ROLE_ASSIGNED'
  | 'ROLE_REVOKED'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_REVOKED'
  | 'ROLE_CREATED'
  | 'ROLE_UPDATED'
  | 'ROLE_DELETED'

  // Profile events
  | 'PROFILE_UPDATED'
  | 'PROFILE_VIEWED'

  // Security events
  | 'SUSPICIOUS_ACTIVITY_DETECTED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_REACTIVATED'
  | 'NEW_DEVICE_LOGIN'
  | 'RATE_LIMIT_EXCEEDED';

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id: string;
  eventType: AuditEventType;
  userId: string | null;
  targetUserId: string | null;
  organizationId: string | null;
  ipAddress: string;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  correlationId: string;
  timestamp: Date;
}

/**
 * Audit log filter options
 */
export interface AuditLogFilter {
  userId?: string;
  targetUserId?: string;
  organizationId?: string;
  eventTypes?: AuditEventType[];
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  correlationId?: string;
}

/**
 * Audit log export format
 */
export type AuditExportFormat = 'json' | 'csv' | 'pdf';
