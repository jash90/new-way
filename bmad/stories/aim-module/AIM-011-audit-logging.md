# 📋 Story: AIM-011 - Comprehensive Security Audit Logging

> **Story ID**: `AIM-011`
> **Epic**: AIM-EPIC-001
> **Status**: 🟢 Ready for Development
> **Points**: 8
> **Priority**: P0

---

## 📖 User Story

**As a** system administrator
**I want** all security events to be logged immutably
**So that** I can audit access and investigate incidents

---

## ✅ Acceptance Criteria

### AC1: Authentication Event Logging
```gherkin
Given a user attempts to login
When the login succeeds or fails
Then an audit log entry is created automatically
And the entry contains user_id, ip_address, user_agent, timestamp
And the entry cannot be modified or deleted
And the event_type is "LOGIN_SUCCESS" or "LOGIN_FAILED"
```

### AC2: Session Event Logging
```gherkin
Given a user's session is created or revoked
When the session state changes
Then an audit log entry is created with session details
And it includes session_id, device_id, and expiration info
And the entry is linked via correlation_id for tracing
```

### AC3: Password Change Logging
```gherkin
Given a user changes or resets their password
When the password operation completes
Then audit entries are created for:
  | Event Type               |
  | PASSWORD_CHANGED         |
  | PASSWORD_RESET_REQUESTED |
  | PASSWORD_RESET_COMPLETED |
And the entries do not contain any password values
And they include the change reason and initiator
```

### AC4: MFA Event Logging
```gherkin
Given a user interacts with MFA features
When MFA is enabled, disabled, verified, or fails
Then the appropriate audit entry is created:
  | Event Type   | Trigger                |
  | MFA_ENABLED  | User activates MFA     |
  | MFA_DISABLED | User deactivates MFA   |
  | MFA_VERIFIED | Successful MFA check   |
  | MFA_FAILED   | Failed MFA attempt     |
And entries include the MFA method used
```

### AC5: Account Status Logging
```gherkin
Given an account status changes
When the account is locked or unlocked
Then an audit entry captures:
  | Event Type      | Trigger                    |
  | ACCOUNT_LOCKED  | Max failed attempts or admin action |
  | ACCOUNT_UNLOCKED| Admin action or timeout    |
And the entry includes the reason and actor
```

### AC6: Permission Change Logging
```gherkin
Given user permissions or roles change
When roles are assigned, removed, or permissions modified
Then audit entries are created for:
  | Event Type         | Description                  |
  | PERMISSION_CHANGED | Individual permission update |
  | ROLE_ASSIGNED      | Role granted to user         |
  | ROLE_REMOVED       | Role revoked from user       |
And entries include before/after state snapshots
```

### AC7: Admin Audit Log Viewing
```gherkin
Given I am an authenticated admin
When I navigate to the audit logs page
Then I see a paginated list of audit entries
And I can filter by:
  | Filter     | Options                          |
  | User       | User ID or email                 |
  | Event Type | Dropdown of all event types      |
  | Date Range | Start date to end date           |
  | Result     | Success or Failure               |
  | IP Address | Specific IP or CIDR range        |
And I can sort by timestamp ascending or descending
```

### AC8: Audit Log Export
```gherkin
Given I am viewing filtered audit logs
When I click "Export" button
Then I can choose format:
  | Format | Description           |
  | CSV    | Comma-separated       |
  | JSON   | Full structured data  |
  | PDF    | Formatted report      |
And the export includes all filtered entries
And the export file is audit-logged as "AUDIT_EXPORT"
And a compliance timestamp is included
```

### AC9: Immutability Enforcement
```gherkin
Given audit logs exist in the database
When any attempt is made to UPDATE or DELETE entries
Then the operation is blocked at database level
And an alert is triggered for tampering attempt
And the tampering attempt itself is logged separately
```

### AC10: Log Retention Compliance
```gherkin
Given audit logs older than 2 years exist
When the archival job runs daily
Then logs older than 2 years are moved to cold storage
And logs are retained for 10 years total (Polish law)
And archived logs remain queryable via API
And original entries are marked as archived, not deleted
```

### AC11: Correlation ID Tracking
```gherkin
Given a user action spans multiple system events
When related events occur (e.g., login → session → MFA)
Then all events share the same correlation_id
And I can view the complete event chain
And the chain shows chronological order
```

### AC12: Anomaly Detection Alerting
```gherkin
Given suspicious patterns occur:
  | Pattern                           | Threshold      |
  | Failed logins from same IP        | >10 in 1 hour  |
  | Logins from new country           | Any            |
  | Multiple password resets          | >3 in 24 hours |
  | Admin role assignments            | Any            |
  | Off-hours admin access            | 22:00-06:00    |
When the pattern is detected
Then an alert is generated immediately
And notification is sent to security admins
And the alert includes relevant audit entries
```

---

## 🔧 Technical Specification

### Database Schema

```sql
-- =====================================================
-- Audit Logs Table (Immutable)
-- =====================================================

-- Event type enum
CREATE TYPE audit_event_type AS ENUM (
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'PASSWORD_CHANGED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'MFA_VERIFIED',
  'MFA_FAILED',
  'MFA_CHALLENGE_CREATED',
  'SESSION_CREATED',
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'ACCOUNT_LOCKED',
  'ACCOUNT_UNLOCKED',
  'PERMISSION_CHANGED',
  'ROLE_ASSIGNED',
  'ROLE_REMOVED',
  'PROFILE_UPDATED',
  'EMAIL_CHANGED',
  'AUDIT_EXPORT',
  'ADMIN_ACTION',
  'SECURITY_ALERT',
  'TAMPERING_ATTEMPT'
);

-- Result type enum
CREATE TYPE audit_result AS ENUM (
  'SUCCESS',
  'FAILURE',
  'BLOCKED',
  'PENDING'
);

-- Main audit logs table
CREATE TABLE auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event identification
  event_type audit_event_type NOT NULL,
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),

  -- Actor information (who performed the action)
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_session_id UUID,
  actor_ip_address INET NOT NULL,
  actor_user_agent TEXT,
  actor_device_id VARCHAR(255),
  actor_geo_country VARCHAR(2),
  actor_geo_city VARCHAR(100),

  -- Target information (what was affected)
  target_type VARCHAR(50), -- 'user', 'session', 'role', 'permission'
  target_id VARCHAR(255),
  target_email VARCHAR(255), -- Denormalized for query performance

  -- Result
  result audit_result NOT NULL DEFAULT 'SUCCESS',
  failure_reason VARCHAR(255),

  -- Metadata (event-specific details)
  metadata JSONB NOT NULL DEFAULT '{}',

  -- State changes (for before/after comparison)
  state_before JSONB,
  state_after JSONB,

  -- Archival tracking
  is_archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMP,
  archive_location VARCHAR(500),

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Partitioning key (for performance)
  partition_date DATE GENERATED ALWAYS AS (DATE(created_at)) STORED
) PARTITION BY RANGE (partition_date);

-- Create monthly partitions for current and next 12 months
CREATE TABLE auth_audit_logs_2024_12 PARTITION OF auth_audit_logs
  FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE auth_audit_logs_2025_01 PARTITION OF auth_audit_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
-- ... (automated partition creation via cron job)

-- Indexes for common queries
CREATE INDEX idx_audit_logs_user_id ON auth_audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_event_type ON auth_audit_logs(event_type);
CREATE INDEX idx_audit_logs_created_at ON auth_audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_correlation_id ON auth_audit_logs(correlation_id);
CREATE INDEX idx_audit_logs_target_id ON auth_audit_logs(target_id);
CREATE INDEX idx_audit_logs_ip_address ON auth_audit_logs(actor_ip_address);
CREATE INDEX idx_audit_logs_result ON auth_audit_logs(result) WHERE result = 'FAILURE';

-- Full-text search index on metadata
CREATE INDEX idx_audit_logs_metadata_gin ON auth_audit_logs USING GIN (metadata);

-- =====================================================
-- Immutability Enforcement
-- =====================================================

-- Prevent UPDATE on audit logs
CREATE OR REPLACE FUNCTION prevent_audit_log_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Log tampering attempt
  INSERT INTO auth_audit_logs (
    event_type,
    actor_ip_address,
    target_type,
    target_id,
    result,
    failure_reason,
    metadata
  ) VALUES (
    'TAMPERING_ATTEMPT',
    inet_client_addr(),
    'audit_log',
    OLD.id::text,
    'BLOCKED',
    'UPDATE_ATTEMPT',
    jsonb_build_object(
      'attempted_changes', row_to_json(NEW),
      'original_values', row_to_json(OLD),
      'blocked_at', CURRENT_TIMESTAMP
    )
  );

  RAISE EXCEPTION 'Audit logs are immutable. UPDATE operations are not allowed.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_prevent_audit_update
  BEFORE UPDATE ON auth_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_update();

-- Prevent DELETE on audit logs (except archival)
CREATE OR REPLACE FUNCTION prevent_audit_log_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow archival process to delete (via special role)
  IF current_user != 'audit_archiver' THEN
    -- Log tampering attempt
    INSERT INTO auth_audit_logs (
      event_type,
      actor_ip_address,
      target_type,
      target_id,
      result,
      failure_reason,
      metadata
    ) VALUES (
      'TAMPERING_ATTEMPT',
      inet_client_addr(),
      'audit_log',
      OLD.id::text,
      'BLOCKED',
      'DELETE_ATTEMPT',
      jsonb_build_object(
        'attempted_delete', row_to_json(OLD),
        'blocked_at', CURRENT_TIMESTAMP
      )
    );

    RAISE EXCEPTION 'Audit logs are immutable. DELETE operations are not allowed.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_prevent_audit_delete
  BEFORE DELETE ON auth_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_delete();

-- =====================================================
-- Materialized Views for Common Queries
-- =====================================================

-- Daily login statistics
CREATE MATERIALIZED VIEW mv_daily_login_stats AS
SELECT
  DATE(created_at) AS log_date,
  event_type,
  result,
  COUNT(*) AS event_count,
  COUNT(DISTINCT actor_user_id) AS unique_users,
  COUNT(DISTINCT actor_ip_address) AS unique_ips
FROM auth_audit_logs
WHERE event_type IN ('LOGIN_SUCCESS', 'LOGIN_FAILED')
GROUP BY DATE(created_at), event_type, result
WITH DATA;

CREATE UNIQUE INDEX idx_mv_daily_login_stats
  ON mv_daily_login_stats(log_date, event_type, result);

-- User activity summary
CREATE MATERIALIZED VIEW mv_user_activity_summary AS
SELECT
  actor_user_id,
  DATE(created_at) AS activity_date,
  COUNT(*) FILTER (WHERE event_type = 'LOGIN_SUCCESS') AS successful_logins,
  COUNT(*) FILTER (WHERE event_type = 'LOGIN_FAILED') AS failed_logins,
  COUNT(*) FILTER (WHERE event_type = 'MFA_VERIFIED') AS mfa_verifications,
  MAX(created_at) AS last_activity
FROM auth_audit_logs
WHERE actor_user_id IS NOT NULL
GROUP BY actor_user_id, DATE(created_at)
WITH DATA;

CREATE UNIQUE INDEX idx_mv_user_activity
  ON mv_user_activity_summary(actor_user_id, activity_date);

-- Security alerts summary
CREATE MATERIALIZED VIEW mv_security_alerts AS
SELECT
  actor_ip_address,
  actor_geo_country,
  event_type,
  result,
  COUNT(*) AS occurrence_count,
  MIN(created_at) AS first_occurrence,
  MAX(created_at) AS last_occurrence
FROM auth_audit_logs
WHERE result = 'FAILURE'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY actor_ip_address, actor_geo_country, event_type, result
HAVING COUNT(*) > 5
WITH DATA;

-- Refresh materialized views function
CREATE OR REPLACE FUNCTION refresh_audit_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_login_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_activity_summary;
  REFRESH MATERIALIZED VIEW mv_security_alerts;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Security Alerts Table
-- =====================================================

CREATE TABLE security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Related audit entries
  audit_log_ids UUID[] NOT NULL DEFAULT '{}',
  correlation_id UUID,

  -- Target
  target_user_id UUID REFERENCES users(id),
  target_ip_address INET,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE')),
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,

  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_security_alerts_status ON security_alerts(status) WHERE status NOT IN ('RESOLVED', 'FALSE_POSITIVE');
CREATE INDEX idx_security_alerts_severity ON security_alerts(severity) WHERE severity IN ('HIGH', 'CRITICAL');
CREATE INDEX idx_security_alerts_created_at ON security_alerts(created_at DESC);
```

### tRPC Router Implementation

```typescript
// src/server/routers/audit.router.ts
import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { AuditLogService } from '../services/audit-log.service';
import { TRPCError } from '@trpc/server';

// =====================================================
// Zod Schemas
// =====================================================

const AuditEventTypeSchema = z.enum([
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'PASSWORD_CHANGED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'MFA_VERIFIED',
  'MFA_FAILED',
  'MFA_CHALLENGE_CREATED',
  'SESSION_CREATED',
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'ACCOUNT_LOCKED',
  'ACCOUNT_UNLOCKED',
  'PERMISSION_CHANGED',
  'ROLE_ASSIGNED',
  'ROLE_REMOVED',
  'PROFILE_UPDATED',
  'EMAIL_CHANGED',
  'AUDIT_EXPORT',
  'ADMIN_ACTION',
  'SECURITY_ALERT',
  'TAMPERING_ATTEMPT'
]);

const AuditResultSchema = z.enum(['SUCCESS', 'FAILURE', 'BLOCKED', 'PENDING']);

const AuditLogFilterSchema = z.object({
  userId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  eventTypes: z.array(AuditEventTypeSchema).optional(),
  result: AuditResultSchema.optional(),
  ipAddress: z.string().optional(),
  correlationId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  includeArchived: z.boolean().default(false)
});

const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
  sortBy: z.enum(['created_at', 'event_type', 'result']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

const ExportFormatSchema = z.enum(['csv', 'json', 'pdf']);

const SecurityAlertStatusSchema = z.enum([
  'NEW',
  'ACKNOWLEDGED',
  'INVESTIGATING',
  'RESOLVED',
  'FALSE_POSITIVE'
]);

const AlertSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

// =====================================================
// Response Schemas
// =====================================================

const AuditLogEntrySchema = z.object({
  id: z.string().uuid(),
  eventType: AuditEventTypeSchema,
  correlationId: z.string().uuid(),
  actor: z.object({
    userId: z.string().uuid().nullable(),
    sessionId: z.string().uuid().nullable(),
    ipAddress: z.string(),
    userAgent: z.string().nullable(),
    deviceId: z.string().nullable(),
    geoCountry: z.string().nullable(),
    geoCity: z.string().nullable()
  }),
  target: z.object({
    type: z.string().nullable(),
    id: z.string().nullable(),
    email: z.string().nullable()
  }),
  result: AuditResultSchema,
  failureReason: z.string().nullable(),
  metadata: z.record(z.unknown()),
  stateBefore: z.record(z.unknown()).nullable(),
  stateAfter: z.record(z.unknown()).nullable(),
  isArchived: z.boolean(),
  createdAt: z.string().datetime()
});

const AuditLogListResponseSchema = z.object({
  entries: z.array(AuditLogEntrySchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    totalEntries: z.number(),
    totalPages: z.number(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean()
  }),
  filters: AuditLogFilterSchema
});

const SecurityAlertSchema = z.object({
  id: z.string().uuid(),
  alertType: z.string(),
  severity: AlertSeveritySchema,
  title: z.string(),
  description: z.string().nullable(),
  auditLogIds: z.array(z.string().uuid()),
  correlationId: z.string().uuid().nullable(),
  targetUserId: z.string().uuid().nullable(),
  targetIpAddress: z.string().nullable(),
  status: SecurityAlertStatusSchema,
  acknowledgedBy: z.string().uuid().nullable(),
  acknowledgedAt: z.string().datetime().nullable(),
  resolvedBy: z.string().uuid().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  resolutionNotes: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string().datetime()
});

// =====================================================
// Router Definition
// =====================================================

export const auditRouter = router({
  // -------------------------
  // Query: List audit logs (Admin only)
  // -------------------------
  listLogs: adminProcedure
    .input(z.object({
      filters: AuditLogFilterSchema.optional(),
      pagination: PaginationSchema.optional()
    }))
    .output(AuditLogListResponseSchema)
    .query(async ({ ctx, input }) => {
      const auditService = new AuditLogService(ctx.db, ctx.redis);

      const result = await auditService.listAuditLogs({
        filters: input.filters || {},
        pagination: input.pagination || { page: 1, limit: 50, sortBy: 'created_at', sortOrder: 'desc' },
        requestedBy: ctx.user.id,
        ipAddress: ctx.ipAddress
      });

      return result;
    }),

  // -------------------------
  // Query: Get single audit entry (Admin only)
  // -------------------------
  getEntry: adminProcedure
    .input(z.object({
      id: z.string().uuid()
    }))
    .output(AuditLogEntrySchema)
    .query(async ({ ctx, input }) => {
      const auditService = new AuditLogService(ctx.db, ctx.redis);

      const entry = await auditService.getAuditEntry(input.id);

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Wpis audytu nie został znaleziony'
        });
      }

      return entry;
    }),

  // -------------------------
  // Query: Get correlation chain (Admin only)
  // -------------------------
  getCorrelationChain: adminProcedure
    .input(z.object({
      correlationId: z.string().uuid()
    }))
    .output(z.object({
      correlationId: z.string().uuid(),
      entries: z.array(AuditLogEntrySchema),
      timeline: z.array(z.object({
        timestamp: z.string().datetime(),
        eventType: AuditEventTypeSchema,
        result: AuditResultSchema,
        summary: z.string()
      }))
    }))
    .query(async ({ ctx, input }) => {
      const auditService = new AuditLogService(ctx.db, ctx.redis);
      return auditService.getCorrelationChain(input.correlationId);
    }),

  // -------------------------
  // Query: Get user activity (Admin only)
  // -------------------------
  getUserActivity: adminProcedure
    .input(z.object({
      userId: z.string().uuid(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional()
    }))
    .output(z.object({
      userId: z.string().uuid(),
      summary: z.object({
        totalEvents: z.number(),
        successfulLogins: z.number(),
        failedLogins: z.number(),
        mfaVerifications: z.number(),
        passwordChanges: z.number(),
        lastActivity: z.string().datetime().nullable(),
        uniqueIpAddresses: z.number(),
        uniqueDevices: z.number()
      }),
      recentActivity: z.array(AuditLogEntrySchema)
    }))
    .query(async ({ ctx, input }) => {
      const auditService = new AuditLogService(ctx.db, ctx.redis);
      return auditService.getUserActivity(input.userId, {
        dateFrom: input.dateFrom,
        dateTo: input.dateTo
      });
    }),

  // -------------------------
  // Query: Get statistics (Admin only)
  // -------------------------
  getStatistics: adminProcedure
    .input(z.object({
      period: z.enum(['day', 'week', 'month', 'year']).default('day'),
      eventTypes: z.array(AuditEventTypeSchema).optional()
    }))
    .output(z.object({
      period: z.string(),
      totalEvents: z.number(),
      eventsByType: z.array(z.object({
        eventType: AuditEventTypeSchema,
        count: z.number(),
        successRate: z.number()
      })),
      eventsByHour: z.array(z.object({
        hour: z.number(),
        count: z.number()
      })),
      topFailureReasons: z.array(z.object({
        reason: z.string(),
        count: z.number()
      })),
      geographicDistribution: z.array(z.object({
        country: z.string(),
        count: z.number()
      }))
    }))
    .query(async ({ ctx, input }) => {
      const auditService = new AuditLogService(ctx.db, ctx.redis);
      return auditService.getStatistics(input.period, input.eventTypes);
    }),

  // -------------------------
  // Mutation: Export audit logs (Admin only)
  // -------------------------
  exportLogs: adminProcedure
    .input(z.object({
      filters: AuditLogFilterSchema,
      format: ExportFormatSchema,
      includeMetadata: z.boolean().default(true)
    }))
    .output(z.object({
      exportId: z.string().uuid(),
      format: ExportFormatSchema,
      downloadUrl: z.string().url(),
      expiresAt: z.string().datetime(),
      totalEntries: z.number(),
      fileSizeBytes: z.number()
    }))
    .mutation(async ({ ctx, input }) => {
      const auditService = new AuditLogService(ctx.db, ctx.redis);

      const result = await auditService.exportLogs({
        filters: input.filters,
        format: input.format,
        includeMetadata: input.includeMetadata,
        requestedBy: ctx.user.id,
        ipAddress: ctx.ipAddress
      });

      return result;
    }),

  // -------------------------
  // Query: List security alerts (Admin only)
  // -------------------------
  listAlerts: adminProcedure
    .input(z.object({
      status: SecurityAlertStatusSchema.optional(),
      severity: AlertSeveritySchema.optional(),
      limit: z.number().int().min(1).max(100).default(20)
    }))
    .output(z.object({
      alerts: z.array(SecurityAlertSchema),
      counts: z.object({
        new: z.number(),
        acknowledged: z.number(),
        investigating: z.number(),
        critical: z.number(),
        high: z.number()
      })
    }))
    .query(async ({ ctx, input }) => {
      const auditService = new AuditLogService(ctx.db, ctx.redis);
      return auditService.listSecurityAlerts(input);
    }),

  // -------------------------
  // Mutation: Acknowledge alert (Admin only)
  // -------------------------
  acknowledgeAlert: adminProcedure
    .input(z.object({
      alertId: z.string().uuid(),
      notes: z.string().max(1000).optional()
    }))
    .output(SecurityAlertSchema)
    .mutation(async ({ ctx, input }) => {
      const auditService = new AuditLogService(ctx.db, ctx.redis);

      return auditService.acknowledgeAlert({
        alertId: input.alertId,
        acknowledgedBy: ctx.user.id,
        notes: input.notes
      });
    }),

  // -------------------------
  // Mutation: Resolve alert (Admin only)
  // -------------------------
  resolveAlert: adminProcedure
    .input(z.object({
      alertId: z.string().uuid(),
      resolution: z.enum(['RESOLVED', 'FALSE_POSITIVE']),
      notes: z.string().max(2000)
    }))
    .output(SecurityAlertSchema)
    .mutation(async ({ ctx, input }) => {
      const auditService = new AuditLogService(ctx.db, ctx.redis);

      return auditService.resolveAlert({
        alertId: input.alertId,
        resolvedBy: ctx.user.id,
        resolution: input.resolution,
        notes: input.notes
      });
    }),

  // -------------------------
  // Query: My activity (User's own logs)
  // -------------------------
  myActivity: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(50).default(20)
    }))
    .output(z.object({
      recentActivity: z.array(z.object({
        id: z.string().uuid(),
        eventType: AuditEventTypeSchema,
        result: AuditResultSchema,
        ipAddress: z.string(),
        deviceId: z.string().nullable(),
        createdAt: z.string().datetime()
      })),
      activeSessions: z.number(),
      lastLogin: z.string().datetime().nullable()
    }))
    .query(async ({ ctx, input }) => {
      const auditService = new AuditLogService(ctx.db, ctx.redis);
      return auditService.getUserOwnActivity(ctx.user.id, input.limit);
    })
});
```

### AuditLogService Implementation

```typescript
// src/server/services/audit-log.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import * as geoip from 'geoip-lite';
import { createObjectCsvStringifier } from 'csv-writer';
import PDFDocument from 'pdfkit';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// =====================================================
// Types and Interfaces
// =====================================================

export enum AuditEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  MFA_VERIFIED = 'MFA_VERIFIED',
  MFA_FAILED = 'MFA_FAILED',
  MFA_CHALLENGE_CREATED = 'MFA_CHALLENGE_CREATED',
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
  PERMISSION_CHANGED = 'PERMISSION_CHANGED',
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  ROLE_REMOVED = 'ROLE_REMOVED',
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  EMAIL_CHANGED = 'EMAIL_CHANGED',
  AUDIT_EXPORT = 'AUDIT_EXPORT',
  ADMIN_ACTION = 'ADMIN_ACTION',
  SECURITY_ALERT = 'SECURITY_ALERT',
  TAMPERING_ATTEMPT = 'TAMPERING_ATTEMPT'
}

export enum AuditResult {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  BLOCKED = 'BLOCKED',
  PENDING = 'PENDING'
}

export interface AuditLogEntry {
  eventType: AuditEventType;
  correlationId?: string;
  actor: {
    userId?: string | null;
    sessionId?: string | null;
    ipAddress: string;
    userAgent?: string | null;
    deviceId?: string | null;
  };
  target?: {
    type?: string;
    id?: string;
    email?: string;
  };
  result?: AuditResult;
  failureReason?: string;
  metadata?: Record<string, unknown>;
  stateBefore?: Record<string, unknown>;
  stateAfter?: Record<string, unknown>;
}

export interface AlertThreshold {
  eventType: AuditEventType | AuditEventType[];
  threshold: number;
  timeWindowMinutes: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  groupBy?: 'ip' | 'user' | 'both';
}

// =====================================================
// Audit Log Service
// =====================================================

@Injectable()
export class AuditLogService {
  private readonly ALERT_THRESHOLDS: AlertThreshold[] = [
    {
      eventType: AuditEventType.LOGIN_FAILED,
      threshold: 10,
      timeWindowMinutes: 60,
      severity: 'HIGH',
      groupBy: 'ip'
    },
    {
      eventType: AuditEventType.LOGIN_FAILED,
      threshold: 5,
      timeWindowMinutes: 15,
      severity: 'MEDIUM',
      groupBy: 'user'
    },
    {
      eventType: AuditEventType.PASSWORD_RESET_REQUESTED,
      threshold: 3,
      timeWindowMinutes: 1440, // 24 hours
      severity: 'MEDIUM',
      groupBy: 'user'
    },
    {
      eventType: [AuditEventType.ROLE_ASSIGNED, AuditEventType.PERMISSION_CHANGED],
      threshold: 1,
      timeWindowMinutes: 1,
      severity: 'HIGH',
      groupBy: 'user'
    },
    {
      eventType: AuditEventType.MFA_DISABLED,
      threshold: 1,
      timeWindowMinutes: 1,
      severity: 'MEDIUM',
      groupBy: 'user'
    }
  ];

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @Inject('S3_CLIENT') private readonly s3: S3Client
  ) {}

  // -------------------------
  // Core Logging Method
  // -------------------------
  async log(entry: AuditLogEntry): Promise<string> {
    const id = uuidv4();
    const correlationId = entry.correlationId || uuidv4();

    // Get geo information from IP
    const geo = geoip.lookup(entry.actor.ipAddress);

    const query = `
      INSERT INTO auth_audit_logs (
        id, event_type, correlation_id,
        actor_user_id, actor_session_id, actor_ip_address,
        actor_user_agent, actor_device_id, actor_geo_country, actor_geo_city,
        target_type, target_id, target_email,
        result, failure_reason, metadata,
        state_before, state_after
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16,
        $17, $18
      )
      RETURNING id
    `;

    const values = [
      id,
      entry.eventType,
      correlationId,
      entry.actor.userId || null,
      entry.actor.sessionId || null,
      entry.actor.ipAddress,
      entry.actor.userAgent || null,
      entry.actor.deviceId || null,
      geo?.country || null,
      geo?.city || null,
      entry.target?.type || null,
      entry.target?.id || null,
      entry.target?.email || null,
      entry.result || AuditResult.SUCCESS,
      entry.failureReason || null,
      JSON.stringify(entry.metadata || {}),
      entry.stateBefore ? JSON.stringify(entry.stateBefore) : null,
      entry.stateAfter ? JSON.stringify(entry.stateAfter) : null
    ];

    await this.db.query(query, values);

    // Check for anomalies asynchronously
    this.checkForAnomalies(entry, id).catch(err => {
      console.error('Anomaly detection failed:', err);
    });

    // Update real-time counters in Redis
    await this.updateRealtimeCounters(entry);

    return id;
  }

  // -------------------------
  // Anomaly Detection
  // -------------------------
  private async checkForAnomalies(entry: AuditLogEntry, auditLogId: string): Promise<void> {
    for (const threshold of this.ALERT_THRESHOLDS) {
      const eventTypes = Array.isArray(threshold.eventType)
        ? threshold.eventType
        : [threshold.eventType];

      if (!eventTypes.includes(entry.eventType)) continue;

      const key = this.buildThresholdKey(threshold, entry);
      const windowStart = new Date(Date.now() - threshold.timeWindowMinutes * 60 * 1000);

      // Count recent events matching criteria
      let query: string;
      let values: unknown[];

      if (threshold.groupBy === 'ip') {
        query = `
          SELECT COUNT(*) as count
          FROM auth_audit_logs
          WHERE event_type = ANY($1)
            AND actor_ip_address = $2
            AND created_at > $3
        `;
        values = [eventTypes, entry.actor.ipAddress, windowStart];
      } else if (threshold.groupBy === 'user' && entry.actor.userId) {
        query = `
          SELECT COUNT(*) as count
          FROM auth_audit_logs
          WHERE event_type = ANY($1)
            AND actor_user_id = $2
            AND created_at > $3
        `;
        values = [eventTypes, entry.actor.userId, windowStart];
      } else {
        continue;
      }

      const result = await this.db.query(query, values);
      const count = parseInt(result.rows[0].count, 10);

      if (count >= threshold.threshold) {
        await this.createSecurityAlert({
          alertType: `THRESHOLD_EXCEEDED_${entry.eventType}`,
          severity: threshold.severity,
          title: this.getAlertTitle(entry.eventType, threshold),
          description: this.getAlertDescription(entry, threshold, count),
          auditLogIds: [auditLogId],
          correlationId: entry.correlationId,
          targetUserId: entry.actor.userId,
          targetIpAddress: entry.actor.ipAddress,
          metadata: {
            threshold: threshold.threshold,
            actualCount: count,
            timeWindowMinutes: threshold.timeWindowMinutes,
            eventType: entry.eventType
          }
        });
      }
    }

    // Check for geographic anomaly (login from new country)
    if (entry.eventType === AuditEventType.LOGIN_SUCCESS && entry.actor.userId) {
      await this.checkGeographicAnomaly(entry, auditLogId);
    }

    // Check for off-hours admin access
    if (this.isAdminEvent(entry.eventType)) {
      await this.checkOffHoursAccess(entry, auditLogId);
    }
  }

  private async checkGeographicAnomaly(entry: AuditLogEntry, auditLogId: string): Promise<void> {
    const geo = geoip.lookup(entry.actor.ipAddress);
    if (!geo?.country) return;

    // Get user's known countries from last 90 days
    const knownCountriesQuery = `
      SELECT DISTINCT actor_geo_country
      FROM auth_audit_logs
      WHERE actor_user_id = $1
        AND event_type = 'LOGIN_SUCCESS'
        AND actor_geo_country IS NOT NULL
        AND created_at > NOW() - INTERVAL '90 days'
    `;

    const result = await this.db.query(knownCountriesQuery, [entry.actor.userId]);
    const knownCountries = result.rows.map(r => r.actor_geo_country);

    if (knownCountries.length > 0 && !knownCountries.includes(geo.country)) {
      await this.createSecurityAlert({
        alertType: 'NEW_COUNTRY_LOGIN',
        severity: 'MEDIUM',
        title: `Logowanie z nowego kraju: ${geo.country}`,
        description: `Użytkownik zalogował się z nowego kraju (${geo.country}), który nie był wcześniej używany. Znane kraje: ${knownCountries.join(', ')}`,
        auditLogIds: [auditLogId],
        correlationId: entry.correlationId,
        targetUserId: entry.actor.userId,
        targetIpAddress: entry.actor.ipAddress,
        metadata: {
          newCountry: geo.country,
          knownCountries,
          city: geo.city
        }
      });
    }
  }

  private async checkOffHoursAccess(entry: AuditLogEntry, auditLogId: string): Promise<void> {
    const hour = new Date().getHours();
    const isOffHours = hour >= 22 || hour < 6;

    if (isOffHours) {
      await this.createSecurityAlert({
        alertType: 'OFF_HOURS_ADMIN_ACCESS',
        severity: 'LOW',
        title: `Dostęp administracyjny poza godzinami pracy`,
        description: `Akcja administracyjna (${entry.eventType}) wykonana o godzinie ${hour}:00`,
        auditLogIds: [auditLogId],
        correlationId: entry.correlationId,
        targetUserId: entry.actor.userId,
        targetIpAddress: entry.actor.ipAddress,
        metadata: {
          hour,
          eventType: entry.eventType
        }
      });
    }
  }

  private isAdminEvent(eventType: AuditEventType): boolean {
    return [
      AuditEventType.ROLE_ASSIGNED,
      AuditEventType.ROLE_REMOVED,
      AuditEventType.PERMISSION_CHANGED,
      AuditEventType.ADMIN_ACTION
    ].includes(eventType);
  }

  private buildThresholdKey(threshold: AlertThreshold, entry: AuditLogEntry): string {
    const parts = ['audit', 'threshold', entry.eventType];
    if (threshold.groupBy === 'ip') {
      parts.push('ip', entry.actor.ipAddress);
    } else if (threshold.groupBy === 'user' && entry.actor.userId) {
      parts.push('user', entry.actor.userId);
    }
    return parts.join(':');
  }

  private getAlertTitle(eventType: AuditEventType, threshold: AlertThreshold): string {
    const titles: Record<AuditEventType, string> = {
      [AuditEventType.LOGIN_FAILED]: `Wiele nieudanych prób logowania (>${threshold.threshold})`,
      [AuditEventType.PASSWORD_RESET_REQUESTED]: `Wiele żądań resetowania hasła`,
      [AuditEventType.ROLE_ASSIGNED]: `Przypisanie roli`,
      [AuditEventType.PERMISSION_CHANGED]: `Zmiana uprawnień`,
      [AuditEventType.MFA_DISABLED]: `Wyłączenie MFA`,
      // ... other event types
    } as Record<AuditEventType, string>;

    return titles[eventType] || `Alert bezpieczeństwa: ${eventType}`;
  }

  private getAlertDescription(
    entry: AuditLogEntry,
    threshold: AlertThreshold,
    count: number
  ): string {
    return `Wykryto ${count} zdarzeń typu ${entry.eventType} w ciągu ostatnich ${threshold.timeWindowMinutes} minut. ` +
           `Próg alertu: ${threshold.threshold}. ` +
           `IP: ${entry.actor.ipAddress}. ` +
           (entry.actor.userId ? `Użytkownik: ${entry.actor.userId}` : '');
  }

  // -------------------------
  // Security Alerts
  // -------------------------
  private async createSecurityAlert(alert: {
    alertType: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    title: string;
    description: string;
    auditLogIds: string[];
    correlationId?: string;
    targetUserId?: string | null;
    targetIpAddress?: string | null;
    metadata: Record<string, unknown>;
  }): Promise<string> {
    const id = uuidv4();

    const query = `
      INSERT INTO security_alerts (
        id, alert_type, severity, title, description,
        audit_log_ids, correlation_id,
        target_user_id, target_ip_address,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;

    await this.db.query(query, [
      id,
      alert.alertType,
      alert.severity,
      alert.title,
      alert.description,
      alert.auditLogIds,
      alert.correlationId || null,
      alert.targetUserId || null,
      alert.targetIpAddress || null,
      JSON.stringify(alert.metadata)
    ]);

    // Log the alert creation
    await this.log({
      eventType: AuditEventType.SECURITY_ALERT,
      actor: {
        ipAddress: '127.0.0.1', // System-generated
        userId: null
      },
      target: {
        type: 'security_alert',
        id
      },
      metadata: {
        alertType: alert.alertType,
        severity: alert.severity,
        title: alert.title
      }
    });

    // Send real-time notification via Redis pub/sub
    await this.redis.publish('security:alerts', JSON.stringify({
      id,
      severity: alert.severity,
      title: alert.title,
      createdAt: new Date().toISOString()
    }));

    // For CRITICAL and HIGH alerts, also send email/SMS (implemented elsewhere)
    if (['CRITICAL', 'HIGH'].includes(alert.severity)) {
      await this.redis.lpush('notification:queue', JSON.stringify({
        type: 'security_alert',
        alertId: id,
        severity: alert.severity,
        title: alert.title
      }));
    }

    return id;
  }

  async listSecurityAlerts(options: {
    status?: string;
    severity?: string;
    limit: number;
  }): Promise<{
    alerts: any[];
    counts: Record<string, number>;
  }> {
    let query = `
      SELECT *
      FROM security_alerts
      WHERE 1=1
    `;
    const values: unknown[] = [];
    let paramIndex = 1;

    if (options.status) {
      query += ` AND status = $${paramIndex++}`;
      values.push(options.status);
    }

    if (options.severity) {
      query += ` AND severity = $${paramIndex++}`;
      values.push(options.severity);
    }

    query += ` ORDER BY
      CASE severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        ELSE 4
      END,
      created_at DESC
      LIMIT $${paramIndex}
    `;
    values.push(options.limit);

    const alertsResult = await this.db.query(query, values);

    // Get counts
    const countsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'NEW') as new,
        COUNT(*) FILTER (WHERE status = 'ACKNOWLEDGED') as acknowledged,
        COUNT(*) FILTER (WHERE status = 'INVESTIGATING') as investigating,
        COUNT(*) FILTER (WHERE severity = 'CRITICAL' AND status NOT IN ('RESOLVED', 'FALSE_POSITIVE')) as critical,
        COUNT(*) FILTER (WHERE severity = 'HIGH' AND status NOT IN ('RESOLVED', 'FALSE_POSITIVE')) as high
      FROM security_alerts
    `;
    const countsResult = await this.db.query(countsQuery);

    return {
      alerts: alertsResult.rows.map(this.mapAlertRow),
      counts: {
        new: parseInt(countsResult.rows[0].new, 10),
        acknowledged: parseInt(countsResult.rows[0].acknowledged, 10),
        investigating: parseInt(countsResult.rows[0].investigating, 10),
        critical: parseInt(countsResult.rows[0].critical, 10),
        high: parseInt(countsResult.rows[0].high, 10)
      }
    };
  }

  async acknowledgeAlert(params: {
    alertId: string;
    acknowledgedBy: string;
    notes?: string;
  }): Promise<any> {
    const query = `
      UPDATE security_alerts
      SET
        status = 'ACKNOWLEDGED',
        acknowledged_by = $2,
        acknowledged_at = NOW(),
        metadata = metadata || jsonb_build_object('acknowledge_notes', $3),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, [
      params.alertId,
      params.acknowledgedBy,
      params.notes || null
    ]);

    if (result.rows.length === 0) {
      throw new Error('Alert nie został znaleziony');
    }

    return this.mapAlertRow(result.rows[0]);
  }

  async resolveAlert(params: {
    alertId: string;
    resolvedBy: string;
    resolution: 'RESOLVED' | 'FALSE_POSITIVE';
    notes: string;
  }): Promise<any> {
    const query = `
      UPDATE security_alerts
      SET
        status = $2,
        resolved_by = $3,
        resolved_at = NOW(),
        resolution_notes = $4,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, [
      params.alertId,
      params.resolution,
      params.resolvedBy,
      params.notes
    ]);

    if (result.rows.length === 0) {
      throw new Error('Alert nie został znaleziony');
    }

    return this.mapAlertRow(result.rows[0]);
  }

  // -------------------------
  // Query Methods
  // -------------------------
  async listAuditLogs(params: {
    filters: Record<string, unknown>;
    pagination: {
      page: number;
      limit: number;
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    };
    requestedBy: string;
    ipAddress: string;
  }): Promise<any> {
    const { filters, pagination } = params;
    const offset = (pagination.page - 1) * pagination.limit;

    let query = `
      SELECT *
      FROM auth_audit_logs
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(*) as total
      FROM auth_audit_logs
      WHERE 1=1
    `;

    const values: unknown[] = [];
    const countValues: unknown[] = [];
    let paramIndex = 1;

    // Apply filters
    if (filters.userId) {
      query += ` AND actor_user_id = $${paramIndex}`;
      countQuery += ` AND actor_user_id = $${paramIndex}`;
      values.push(filters.userId);
      countValues.push(filters.userId);
      paramIndex++;
    }

    if (filters.email) {
      query += ` AND target_email ILIKE $${paramIndex}`;
      countQuery += ` AND target_email ILIKE $${paramIndex}`;
      values.push(`%${filters.email}%`);
      countValues.push(`%${filters.email}%`);
      paramIndex++;
    }

    if (filters.eventTypes && Array.isArray(filters.eventTypes) && filters.eventTypes.length > 0) {
      query += ` AND event_type = ANY($${paramIndex})`;
      countQuery += ` AND event_type = ANY($${paramIndex})`;
      values.push(filters.eventTypes);
      countValues.push(filters.eventTypes);
      paramIndex++;
    }

    if (filters.result) {
      query += ` AND result = $${paramIndex}`;
      countQuery += ` AND result = $${paramIndex}`;
      values.push(filters.result);
      countValues.push(filters.result);
      paramIndex++;
    }

    if (filters.ipAddress) {
      query += ` AND actor_ip_address = $${paramIndex}`;
      countQuery += ` AND actor_ip_address = $${paramIndex}`;
      values.push(filters.ipAddress);
      countValues.push(filters.ipAddress);
      paramIndex++;
    }

    if (filters.correlationId) {
      query += ` AND correlation_id = $${paramIndex}`;
      countQuery += ` AND correlation_id = $${paramIndex}`;
      values.push(filters.correlationId);
      countValues.push(filters.correlationId);
      paramIndex++;
    }

    if (filters.dateFrom) {
      query += ` AND created_at >= $${paramIndex}`;
      countQuery += ` AND created_at >= $${paramIndex}`;
      values.push(filters.dateFrom);
      countValues.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      query += ` AND created_at <= $${paramIndex}`;
      countQuery += ` AND created_at <= $${paramIndex}`;
      values.push(filters.dateTo);
      countValues.push(filters.dateTo);
      paramIndex++;
    }

    if (!filters.includeArchived) {
      query += ` AND is_archived = false`;
      countQuery += ` AND is_archived = false`;
    }

    // Add sorting and pagination
    const sortColumn = ['created_at', 'event_type', 'result'].includes(pagination.sortBy)
      ? pagination.sortBy
      : 'created_at';
    query += ` ORDER BY ${sortColumn} ${pagination.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(pagination.limit, offset);

    // Execute queries
    const [entriesResult, countResult] = await Promise.all([
      this.db.query(query, values),
      this.db.query(countQuery, countValues)
    ]);

    const totalEntries = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(totalEntries / pagination.limit);

    return {
      entries: entriesResult.rows.map(this.mapAuditLogRow),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        totalEntries,
        totalPages,
        hasNextPage: pagination.page < totalPages,
        hasPrevPage: pagination.page > 1
      },
      filters
    };
  }

  async getAuditEntry(id: string): Promise<any | null> {
    const query = `SELECT * FROM auth_audit_logs WHERE id = $1`;
    const result = await this.db.query(query, [id]);

    if (result.rows.length === 0) return null;
    return this.mapAuditLogRow(result.rows[0]);
  }

  async getCorrelationChain(correlationId: string): Promise<any> {
    const query = `
      SELECT *
      FROM auth_audit_logs
      WHERE correlation_id = $1
      ORDER BY created_at ASC
    `;

    const result = await this.db.query(query, [correlationId]);
    const entries = result.rows.map(this.mapAuditLogRow);

    const timeline = entries.map(entry => ({
      timestamp: entry.createdAt,
      eventType: entry.eventType,
      result: entry.result,
      summary: this.getEventSummary(entry)
    }));

    return {
      correlationId,
      entries,
      timeline
    };
  }

  async getUserActivity(userId: string, options: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<any> {
    let query = `
      SELECT *
      FROM auth_audit_logs
      WHERE actor_user_id = $1
    `;
    const values: unknown[] = [userId];
    let paramIndex = 2;

    if (options.dateFrom) {
      query += ` AND created_at >= $${paramIndex++}`;
      values.push(options.dateFrom);
    }
    if (options.dateTo) {
      query += ` AND created_at <= $${paramIndex++}`;
      values.push(options.dateTo);
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await this.db.query(query, values);
    const entries = result.rows.map(this.mapAuditLogRow);

    // Calculate summary
    const summary = {
      totalEvents: entries.length,
      successfulLogins: entries.filter(e => e.eventType === 'LOGIN_SUCCESS').length,
      failedLogins: entries.filter(e => e.eventType === 'LOGIN_FAILED').length,
      mfaVerifications: entries.filter(e => e.eventType === 'MFA_VERIFIED').length,
      passwordChanges: entries.filter(e => e.eventType === 'PASSWORD_CHANGED').length,
      lastActivity: entries[0]?.createdAt || null,
      uniqueIpAddresses: new Set(entries.map(e => e.actor.ipAddress)).size,
      uniqueDevices: new Set(entries.filter(e => e.actor.deviceId).map(e => e.actor.deviceId)).size
    };

    return {
      userId,
      summary,
      recentActivity: entries.slice(0, 20)
    };
  }

  async getUserOwnActivity(userId: string, limit: number): Promise<any> {
    const query = `
      SELECT id, event_type, result, actor_ip_address, actor_device_id, created_at
      FROM auth_audit_logs
      WHERE actor_user_id = $1
        AND event_type IN ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGED', 'MFA_VERIFIED')
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.db.query(query, [userId, limit]);

    // Get active sessions count
    const sessionsQuery = `
      SELECT COUNT(*) as count
      FROM sessions
      WHERE user_id = $1 AND is_valid = true AND expires_at > NOW()
    `;
    const sessionsResult = await this.db.query(sessionsQuery, [userId]);

    // Get last login
    const lastLoginQuery = `
      SELECT created_at
      FROM auth_audit_logs
      WHERE actor_user_id = $1 AND event_type = 'LOGIN_SUCCESS'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const lastLoginResult = await this.db.query(lastLoginQuery, [userId]);

    return {
      recentActivity: result.rows.map(row => ({
        id: row.id,
        eventType: row.event_type,
        result: row.result,
        ipAddress: row.actor_ip_address,
        deviceId: row.actor_device_id,
        createdAt: row.created_at.toISOString()
      })),
      activeSessions: parseInt(sessionsResult.rows[0].count, 10),
      lastLogin: lastLoginResult.rows[0]?.created_at?.toISOString() || null
    };
  }

  // -------------------------
  // Statistics
  // -------------------------
  async getStatistics(period: string, eventTypes?: string[]): Promise<any> {
    const periodMap: Record<string, string> = {
      day: '24 hours',
      week: '7 days',
      month: '30 days',
      year: '365 days'
    };

    const interval = periodMap[period] || '24 hours';

    let eventTypeFilter = '';
    if (eventTypes && eventTypes.length > 0) {
      eventTypeFilter = `AND event_type = ANY($1)`;
    }

    // Events by type
    const byTypeQuery = `
      SELECT
        event_type,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE result = 'SUCCESS')::float / NULLIF(COUNT(*), 0) as success_rate
      FROM auth_audit_logs
      WHERE created_at > NOW() - INTERVAL '${interval}'
        ${eventTypeFilter}
      GROUP BY event_type
      ORDER BY count DESC
    `;

    // Events by hour
    const byHourQuery = `
      SELECT
        EXTRACT(HOUR FROM created_at)::int as hour,
        COUNT(*) as count
      FROM auth_audit_logs
      WHERE created_at > NOW() - INTERVAL '${interval}'
        ${eventTypeFilter}
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `;

    // Top failure reasons
    const failureReasonsQuery = `
      SELECT
        COALESCE(failure_reason, 'UNKNOWN') as reason,
        COUNT(*) as count
      FROM auth_audit_logs
      WHERE created_at > NOW() - INTERVAL '${interval}'
        AND result = 'FAILURE'
        ${eventTypeFilter}
      GROUP BY failure_reason
      ORDER BY count DESC
      LIMIT 10
    `;

    // Geographic distribution
    const geoQuery = `
      SELECT
        COALESCE(actor_geo_country, 'UNKNOWN') as country,
        COUNT(*) as count
      FROM auth_audit_logs
      WHERE created_at > NOW() - INTERVAL '${interval}'
        ${eventTypeFilter}
      GROUP BY actor_geo_country
      ORDER BY count DESC
      LIMIT 20
    `;

    const values = eventTypes && eventTypes.length > 0 ? [eventTypes] : [];

    const [byTypeResult, byHourResult, failureResult, geoResult] = await Promise.all([
      this.db.query(byTypeQuery, values),
      this.db.query(byHourQuery, values),
      this.db.query(failureReasonsQuery, values),
      this.db.query(geoQuery, values)
    ]);

    const totalEvents = byTypeResult.rows.reduce((sum, row) => sum + parseInt(row.count, 10), 0);

    return {
      period,
      totalEvents,
      eventsByType: byTypeResult.rows.map(row => ({
        eventType: row.event_type,
        count: parseInt(row.count, 10),
        successRate: parseFloat(row.success_rate) || 0
      })),
      eventsByHour: byHourResult.rows.map(row => ({
        hour: row.hour,
        count: parseInt(row.count, 10)
      })),
      topFailureReasons: failureResult.rows.map(row => ({
        reason: row.reason,
        count: parseInt(row.count, 10)
      })),
      geographicDistribution: geoResult.rows.map(row => ({
        country: row.country,
        count: parseInt(row.count, 10)
      }))
    };
  }

  // -------------------------
  // Export
  // -------------------------
  async exportLogs(params: {
    filters: Record<string, unknown>;
    format: 'csv' | 'json' | 'pdf';
    includeMetadata: boolean;
    requestedBy: string;
    ipAddress: string;
  }): Promise<any> {
    // Get all matching entries (with reasonable limit)
    const entries = await this.listAuditLogs({
      filters: params.filters,
      pagination: { page: 1, limit: 10000, sortBy: 'created_at', sortOrder: 'desc' },
      requestedBy: params.requestedBy,
      ipAddress: params.ipAddress
    });

    const exportId = uuidv4();
    let fileContent: Buffer;
    let contentType: string;
    let fileExtension: string;

    switch (params.format) {
      case 'csv':
        fileContent = await this.generateCsv(entries.entries, params.includeMetadata);
        contentType = 'text/csv';
        fileExtension = 'csv';
        break;
      case 'json':
        fileContent = Buffer.from(JSON.stringify(entries.entries, null, 2));
        contentType = 'application/json';
        fileExtension = 'json';
        break;
      case 'pdf':
        fileContent = await this.generatePdf(entries.entries);
        contentType = 'application/pdf';
        fileExtension = 'pdf';
        break;
    }

    // Upload to S3
    const key = `audit-exports/${exportId}.${fileExtension}`;
    await this.s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      Metadata: {
        exportedBy: params.requestedBy,
        exportedAt: new Date().toISOString(),
        totalEntries: entries.entries.length.toString()
      }
    }));

    // Generate presigned URL (expires in 1 hour)
    const downloadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key }),
      { expiresIn: 3600 }
    );

    // Log the export
    await this.log({
      eventType: AuditEventType.AUDIT_EXPORT,
      actor: {
        userId: params.requestedBy,
        ipAddress: params.ipAddress
      },
      target: {
        type: 'audit_export',
        id: exportId
      },
      metadata: {
        format: params.format,
        filters: params.filters,
        totalEntries: entries.entries.length,
        fileSizeBytes: fileContent.length
      }
    });

    return {
      exportId,
      format: params.format,
      downloadUrl,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      totalEntries: entries.entries.length,
      fileSizeBytes: fileContent.length
    };
  }

  private async generateCsv(entries: any[], includeMetadata: boolean): Promise<Buffer> {
    const headers = [
      { id: 'id', title: 'ID' },
      { id: 'eventType', title: 'Typ zdarzenia' },
      { id: 'createdAt', title: 'Data i czas' },
      { id: 'result', title: 'Wynik' },
      { id: 'actorUserId', title: 'ID użytkownika' },
      { id: 'actorIpAddress', title: 'Adres IP' },
      { id: 'targetType', title: 'Typ celu' },
      { id: 'targetId', title: 'ID celu' },
      { id: 'correlationId', title: 'ID korelacji' }
    ];

    if (includeMetadata) {
      headers.push({ id: 'metadata', title: 'Metadane' });
    }

    const csvWriter = createObjectCsvStringifier({ header: headers });

    const records = entries.map(entry => ({
      id: entry.id,
      eventType: entry.eventType,
      createdAt: entry.createdAt,
      result: entry.result,
      actorUserId: entry.actor.userId || '',
      actorIpAddress: entry.actor.ipAddress,
      targetType: entry.target?.type || '',
      targetId: entry.target?.id || '',
      correlationId: entry.correlationId,
      ...(includeMetadata ? { metadata: JSON.stringify(entry.metadata) } : {})
    }));

    const header = csvWriter.getHeaderString();
    const body = csvWriter.stringifyRecords(records);

    return Buffer.from(header + body, 'utf-8');
  }

  private async generatePdf(entries: any[]): Promise<Buffer> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50 });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Header
      doc.fontSize(20).text('Raport audytu bezpieczeństwa', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Wygenerowano: ${new Date().toLocaleString('pl-PL')}`, { align: 'center' });
      doc.fontSize(10).text(`Liczba wpisów: ${entries.length}`, { align: 'center' });
      doc.moveDown(2);

      // Table header
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text('Data', 50, doc.y, { width: 80, continued: true });
      doc.text('Typ', 130, doc.y, { width: 100, continued: true });
      doc.text('Wynik', 230, doc.y, { width: 60, continued: true });
      doc.text('IP', 290, doc.y, { width: 100, continued: true });
      doc.text('Użytkownik', 390, doc.y, { width: 100 });
      doc.moveDown(0.5);

      // Separator
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      // Entries
      doc.font('Helvetica').fontSize(7);

      for (const entry of entries.slice(0, 100)) { // Limit to 100 for PDF
        if (doc.y > 700) {
          doc.addPage();
          doc.y = 50;
        }

        const date = new Date(entry.createdAt).toLocaleString('pl-PL', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });

        doc.text(date, 50, doc.y, { width: 80, continued: true });
        doc.text(entry.eventType, 130, doc.y, { width: 100, continued: true });
        doc.text(entry.result, 230, doc.y, { width: 60, continued: true });
        doc.text(entry.actor.ipAddress, 290, doc.y, { width: 100, continued: true });
        doc.text(entry.actor.userId || '-', 390, doc.y, { width: 100 });
        doc.moveDown(0.3);
      }

      // Footer
      doc.moveDown(2);
      doc.fontSize(8).text('© KsięgowaCRM - Raport poufny', { align: 'center' });

      doc.end();
    });
  }

  // -------------------------
  // Helper Methods
  // -------------------------
  private async updateRealtimeCounters(entry: AuditLogEntry): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const key = `audit:stats:${today}:${entry.eventType}`;

    await this.redis.incr(key);
    await this.redis.expire(key, 86400 * 7); // 7 days

    if (entry.result === AuditResult.FAILURE) {
      const failKey = `audit:stats:${today}:failures`;
      await this.redis.incr(failKey);
      await this.redis.expire(failKey, 86400 * 7);
    }
  }

  private mapAuditLogRow(row: any): any {
    return {
      id: row.id,
      eventType: row.event_type,
      correlationId: row.correlation_id,
      actor: {
        userId: row.actor_user_id,
        sessionId: row.actor_session_id,
        ipAddress: row.actor_ip_address,
        userAgent: row.actor_user_agent,
        deviceId: row.actor_device_id,
        geoCountry: row.actor_geo_country,
        geoCity: row.actor_geo_city
      },
      target: {
        type: row.target_type,
        id: row.target_id,
        email: row.target_email
      },
      result: row.result,
      failureReason: row.failure_reason,
      metadata: row.metadata,
      stateBefore: row.state_before,
      stateAfter: row.state_after,
      isArchived: row.is_archived,
      createdAt: row.created_at.toISOString()
    };
  }

  private mapAlertRow(row: any): any {
    return {
      id: row.id,
      alertType: row.alert_type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      auditLogIds: row.audit_log_ids,
      correlationId: row.correlation_id,
      targetUserId: row.target_user_id,
      targetIpAddress: row.target_ip_address,
      status: row.status,
      acknowledgedBy: row.acknowledged_by,
      acknowledgedAt: row.acknowledged_at?.toISOString() || null,
      resolvedBy: row.resolved_by,
      resolvedAt: row.resolved_at?.toISOString() || null,
      resolutionNotes: row.resolution_notes,
      metadata: row.metadata,
      createdAt: row.created_at.toISOString()
    };
  }

  private getEventSummary(entry: any): string {
    const summaries: Record<string, string> = {
      LOGIN_SUCCESS: `Pomyślne logowanie z ${entry.actor.ipAddress}`,
      LOGIN_FAILED: `Nieudana próba logowania z ${entry.actor.ipAddress}`,
      LOGOUT: `Wylogowanie`,
      PASSWORD_CHANGED: `Zmiana hasła`,
      PASSWORD_RESET_REQUESTED: `Żądanie resetu hasła`,
      PASSWORD_RESET_COMPLETED: `Zakończenie resetu hasła`,
      MFA_ENABLED: `Włączenie uwierzytelniania dwuskładnikowego`,
      MFA_DISABLED: `Wyłączenie uwierzytelniania dwuskładnikowego`,
      MFA_VERIFIED: `Weryfikacja MFA`,
      MFA_FAILED: `Nieudana weryfikacja MFA`,
      SESSION_CREATED: `Utworzenie sesji`,
      SESSION_REVOKED: `Unieważnienie sesji`,
      ACCOUNT_LOCKED: `Zablokowanie konta`,
      ACCOUNT_UNLOCKED: `Odblokowanie konta`,
      ROLE_ASSIGNED: `Przypisanie roli: ${entry.metadata?.roleName || 'nieznana'}`,
      ROLE_REMOVED: `Usunięcie roli: ${entry.metadata?.roleName || 'nieznana'}`,
      PERMISSION_CHANGED: `Zmiana uprawnień`
    };

    return summaries[entry.eventType] || entry.eventType;
  }
}
```

### React Hook Implementation

```typescript
// src/hooks/useAuditLogs.ts
import { useState, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { useDebounce } from '@/hooks/useDebounce';

export interface AuditLogFilters {
  userId?: string;
  email?: string;
  eventTypes?: string[];
  result?: string;
  ipAddress?: string;
  correlationId?: string;
  dateFrom?: string;
  dateTo?: string;
  includeArchived?: boolean;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy: 'created_at' | 'event_type' | 'result';
  sortOrder: 'asc' | 'desc';
}

export function useAuditLogs() {
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [pagination, setPagination] = useState<PaginationOptions>({
    page: 1,
    limit: 50,
    sortBy: 'created_at',
    sortOrder: 'desc'
  });

  const debouncedFilters = useDebounce(filters, 300);

  // List audit logs
  const logsQuery = trpc.audit.listLogs.useQuery(
    { filters: debouncedFilters, pagination },
    { keepPreviousData: true }
  );

  // Get single entry
  const getEntry = trpc.audit.getEntry.useMutation();

  // Get correlation chain
  const getCorrelationChain = trpc.audit.getCorrelationChain.useMutation();

  // Get user activity
  const getUserActivity = trpc.audit.getUserActivity.useMutation();

  // Get statistics
  const statisticsQuery = trpc.audit.getStatistics.useQuery(
    { period: 'day' },
    { refetchInterval: 60000 } // Refresh every minute
  );

  // Export logs
  const exportMutation = trpc.audit.exportLogs.useMutation();

  // Security alerts
  const alertsQuery = trpc.audit.listAlerts.useQuery(
    { limit: 20 },
    { refetchInterval: 30000 } // Refresh every 30 seconds
  );

  const acknowledgeAlert = trpc.audit.acknowledgeAlert.useMutation({
    onSuccess: () => alertsQuery.refetch()
  });

  const resolveAlert = trpc.audit.resolveAlert.useMutation({
    onSuccess: () => alertsQuery.refetch()
  });

  // User's own activity
  const myActivityQuery = trpc.audit.myActivity.useQuery(
    { limit: 20 }
  );

  // Filter handlers
  const updateFilters = useCallback((newFilters: Partial<AuditLogFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  // Pagination handlers
  const goToPage = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }));
  }, []);

  const changeSort = useCallback((sortBy: PaginationOptions['sortBy']) => {
    setPagination(prev => ({
      ...prev,
      sortBy,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'desc' ? 'asc' : 'desc'
    }));
  }, []);

  // Export handler
  const exportLogs = useCallback(async (format: 'csv' | 'json' | 'pdf') => {
    const result = await exportMutation.mutateAsync({
      filters,
      format,
      includeMetadata: true
    });

    // Open download URL in new tab
    window.open(result.downloadUrl, '_blank');

    return result;
  }, [filters, exportMutation]);

  // View correlation chain
  const viewCorrelation = useCallback(async (correlationId: string) => {
    return getCorrelationChain.mutateAsync({ correlationId });
  }, [getCorrelationChain]);

  return {
    // Data
    logs: logsQuery.data?.entries || [],
    pagination: logsQuery.data?.pagination,
    statistics: statisticsQuery.data,
    alerts: alertsQuery.data?.alerts || [],
    alertCounts: alertsQuery.data?.counts,
    myActivity: myActivityQuery.data,

    // Loading states
    isLoading: logsQuery.isLoading,
    isExporting: exportMutation.isLoading,

    // Errors
    error: logsQuery.error,

    // Filter state
    filters,

    // Actions
    updateFilters,
    clearFilters,
    goToPage,
    changeSort,
    exportLogs,
    viewCorrelation,
    getEntry: getEntry.mutateAsync,
    getUserActivity: getUserActivity.mutateAsync,
    acknowledgeAlert: acknowledgeAlert.mutateAsync,
    resolveAlert: resolveAlert.mutateAsync,

    // Refetch
    refetch: logsQuery.refetch
  };
}
```

---

## 🧪 Test Specification

### Unit Tests

```typescript
// src/server/services/__tests__/audit-log.service.test.ts
import { AuditLogService, AuditEventType, AuditResult } from '../audit-log.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let mockDb: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<Redis>;
  let mockS3: jest.Mocked<S3Client>;

  beforeEach(() => {
    mockDb = createMockPool();
    mockRedis = createMockRedis();
    mockS3 = createMockS3();
    service = new AuditLogService(mockDb, mockRedis, mockS3);
  });

  describe('log', () => {
    it('should create audit log entry with all fields', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'test-id' }] });

      const entry = {
        eventType: AuditEventType.LOGIN_SUCCESS,
        actor: {
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0'
        },
        target: {
          type: 'user',
          id: 'user-123'
        },
        metadata: { sessionId: 'session-456' }
      };

      const id = await service.log(entry);

      expect(id).toBeDefined();
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_audit_logs'),
        expect.arrayContaining([
          expect.any(String), // id
          'LOGIN_SUCCESS',
          expect.any(String), // correlation_id
          'user-123',
          null,
          '192.168.1.1'
        ])
      );
    });

    it('should add geo information from IP address', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'test-id' }] });

      await service.log({
        eventType: AuditEventType.LOGIN_SUCCESS,
        actor: { ipAddress: '8.8.8.8' }
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['US']) // Google DNS is in US
      );
    });

    it('should trigger anomaly detection asynchronously', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'test-id' }] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '15' }] }); // Anomaly count

      await service.log({
        eventType: AuditEventType.LOGIN_FAILED,
        actor: { ipAddress: '192.168.1.1' },
        result: AuditResult.FAILURE
      });

      // Wait for async anomaly detection
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have created security alert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_alerts'),
        expect.any(Array)
      );
    });

    it('should update real-time counters in Redis', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'test-id' }] });

      await service.log({
        eventType: AuditEventType.LOGIN_SUCCESS,
        actor: { ipAddress: '192.168.1.1' }
      });

      expect(mockRedis.incr).toHaveBeenCalledWith(
        expect.stringMatching(/^audit:stats:\d{4}-\d{2}-\d{2}:LOGIN_SUCCESS$/)
      );
    });
  });

  describe('listAuditLogs', () => {
    it('should apply all filters correctly', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ total: '0' }] });

      await service.listAuditLogs({
        filters: {
          userId: 'user-123',
          eventTypes: ['LOGIN_SUCCESS', 'LOGIN_FAILED'],
          result: 'SUCCESS',
          dateFrom: '2024-01-01T00:00:00Z',
          dateTo: '2024-12-31T23:59:59Z'
        },
        pagination: { page: 1, limit: 50, sortBy: 'created_at', sortOrder: 'desc' },
        requestedBy: 'admin-1',
        ipAddress: '127.0.0.1'
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('actor_user_id = $1'),
        expect.arrayContaining(['user-123'])
      );
    });

    it('should calculate pagination correctly', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: Array(50).fill({}) });
      mockDb.query.mockResolvedValueOnce({ rows: [{ total: '150' }] });

      const result = await service.listAuditLogs({
        filters: {},
        pagination: { page: 2, limit: 50, sortBy: 'created_at', sortOrder: 'desc' },
        requestedBy: 'admin-1',
        ipAddress: '127.0.0.1'
      });

      expect(result.pagination).toEqual({
        page: 2,
        limit: 50,
        totalEntries: 150,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true
      });
    });
  });

  describe('getCorrelationChain', () => {
    it('should return all events with same correlation_id', async () => {
      const correlationId = 'corr-123';
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { id: '1', event_type: 'LOGIN_SUCCESS', created_at: new Date('2024-01-01T10:00:00Z') },
          { id: '2', event_type: 'MFA_CHALLENGE_CREATED', created_at: new Date('2024-01-01T10:00:01Z') },
          { id: '3', event_type: 'MFA_VERIFIED', created_at: new Date('2024-01-01T10:00:30Z') }
        ]
      });

      const result = await service.getCorrelationChain(correlationId);

      expect(result.entries).toHaveLength(3);
      expect(result.timeline).toHaveLength(3);
      expect(result.timeline[0].eventType).toBe('LOGIN_SUCCESS');
    });
  });

  describe('exportLogs', () => {
    it('should generate CSV export', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: '1', event_type: 'LOGIN_SUCCESS' }] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ total: '1' }] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'export-id' }] }); // Audit log

      const result = await service.exportLogs({
        filters: {},
        format: 'csv',
        includeMetadata: true,
        requestedBy: 'admin-1',
        ipAddress: '127.0.0.1'
      });

      expect(result.format).toBe('csv');
      expect(result.downloadUrl).toBeDefined();
      expect(mockS3.send).toHaveBeenCalled();
    });

    it('should log the export action', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'export-id' }] });

      await service.exportLogs({
        filters: {},
        format: 'json',
        includeMetadata: false,
        requestedBy: 'admin-1',
        ipAddress: '127.0.0.1'
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_audit_logs'),
        expect.arrayContaining(['AUDIT_EXPORT'])
      );
    });
  });

  describe('anomaly detection', () => {
    it('should create alert for too many failed logins', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'log-1' }] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '15' }] }); // Above threshold
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'alert-1' }] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'log-2' }] }); // Alert logged

      await service.log({
        eventType: AuditEventType.LOGIN_FAILED,
        actor: { ipAddress: '192.168.1.1' },
        result: AuditResult.FAILURE
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_alerts'),
        expect.arrayContaining(['HIGH'])
      );
    });

    it('should detect geographic anomaly', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'log-1' }] });
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // No threshold exceeded
      mockDb.query.mockResolvedValueOnce({
        rows: [{ actor_geo_country: 'PL' }, { actor_geo_country: 'DE' }]
      }); // Known countries
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'alert-1' }] }); // Alert created

      // Login from new country (US via Google DNS IP)
      await service.log({
        eventType: AuditEventType.LOGIN_SUCCESS,
        actor: { userId: 'user-123', ipAddress: '8.8.8.8' },
        result: AuditResult.SUCCESS
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_alerts'),
        expect.arrayContaining(['NEW_COUNTRY_LOGIN'])
      );
    });
  });
});
```

### E2E Tests

```typescript
// e2e/audit-logs.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsAdmin, createTestUser } from './helpers/auth';

test.describe('Audit Logs', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display audit log list with pagination', async ({ page }) => {
    await page.goto('/admin/audit-logs');

    // Wait for logs to load
    await expect(page.locator('[data-testid="audit-log-table"]')).toBeVisible();

    // Check pagination
    await expect(page.locator('[data-testid="pagination-info"]')).toContainText('Strona 1');

    // Navigate to next page
    await page.click('[data-testid="next-page"]');
    await expect(page.locator('[data-testid="pagination-info"]')).toContainText('Strona 2');
  });

  test('should filter by event type', async ({ page }) => {
    await page.goto('/admin/audit-logs');

    // Open filter dropdown
    await page.click('[data-testid="event-type-filter"]');
    await page.click('[data-testid="event-type-LOGIN_SUCCESS"]');

    // Verify filter applied
    await expect(page.locator('[data-testid="active-filters"]')).toContainText('LOGIN_SUCCESS');

    // All visible rows should be login success
    const rows = page.locator('[data-testid="audit-log-row"]');
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i).locator('[data-testid="event-type"]')).toContainText('LOGIN_SUCCESS');
    }
  });

  test('should filter by date range', async ({ page }) => {
    await page.goto('/admin/audit-logs');

    // Set date range
    await page.fill('[data-testid="date-from"]', '2024-01-01');
    await page.fill('[data-testid="date-to"]', '2024-01-31');
    await page.click('[data-testid="apply-filters"]');

    // Verify date filter applied
    await expect(page.locator('[data-testid="active-filters"]')).toContainText('2024-01-01');
  });

  test('should export logs to CSV', async ({ page }) => {
    await page.goto('/admin/audit-logs');

    // Click export button
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-csv"]')
    ]);

    // Verify download
    expect(download.suggestedFilename()).toMatch(/audit.*\.csv$/);
  });

  test('should view correlation chain', async ({ page }) => {
    await page.goto('/admin/audit-logs');

    // Click on correlation link
    await page.click('[data-testid="audit-log-row"]:first-child [data-testid="correlation-link"]');

    // Wait for modal
    await expect(page.locator('[data-testid="correlation-modal"]')).toBeVisible();

    // Verify timeline
    await expect(page.locator('[data-testid="correlation-timeline"]')).toBeVisible();
  });

  test('should display security alerts dashboard', async ({ page }) => {
    await page.goto('/admin/audit-logs/alerts');

    // Check alert counts
    await expect(page.locator('[data-testid="alert-count-new"]')).toBeVisible();
    await expect(page.locator('[data-testid="alert-count-critical"]')).toBeVisible();

    // Check alert list
    await expect(page.locator('[data-testid="alert-list"]')).toBeVisible();
  });

  test('should acknowledge security alert', async ({ page }) => {
    await page.goto('/admin/audit-logs/alerts');

    // Find a NEW alert
    const alert = page.locator('[data-testid="alert-row"][data-status="NEW"]:first-child');

    if (await alert.count() > 0) {
      await alert.click('[data-testid="acknowledge-btn"]');

      // Confirm action
      await page.fill('[data-testid="acknowledge-notes"]', 'Investigating issue');
      await page.click('[data-testid="confirm-acknowledge"]');

      // Verify status changed
      await expect(alert.locator('[data-testid="alert-status"]')).toContainText('ACKNOWLEDGED');
    }
  });

  test('should resolve security alert', async ({ page }) => {
    await page.goto('/admin/audit-logs/alerts');

    // Find an ACKNOWLEDGED alert
    const alert = page.locator('[data-testid="alert-row"][data-status="ACKNOWLEDGED"]:first-child');

    if (await alert.count() > 0) {
      await alert.click('[data-testid="resolve-btn"]');

      // Fill resolution form
      await page.click('[data-testid="resolution-RESOLVED"]');
      await page.fill('[data-testid="resolution-notes"]', 'Issue fixed by blocking IP');
      await page.click('[data-testid="confirm-resolve"]');

      // Verify status changed
      await expect(alert.locator('[data-testid="alert-status"]')).toContainText('RESOLVED');
    }
  });

  test('should verify audit log immutability', async ({ page, request }) => {
    // Attempt to delete via API (should fail)
    const response = await request.delete('/api/audit-logs/some-id', {
      headers: { Authorization: `Bearer ${await getAdminToken()}` }
    });

    expect(response.status()).toBe(403);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining('immutable')
    });
  });

  test('should show user their own activity', async ({ page }) => {
    // Login as regular user
    await loginAsUser(page);

    await page.goto('/account/activity');

    // Should see own activity only
    await expect(page.locator('[data-testid="my-activity-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-sessions"]')).toBeVisible();
    await expect(page.locator('[data-testid="last-login"]')).toBeVisible();

    // Should NOT see admin features
    await expect(page.locator('[data-testid="export-btn"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="user-filter"]')).not.toBeVisible();
  });
});
```

---

## 🔐 Security Checklist

- [ ] Audit logs table has UPDATE/DELETE triggers preventing modification
- [ ] Database role `audit_archiver` is only used by archival service
- [ ] Log entries never contain passwords, tokens, or secrets
- [ ] Metadata is sanitized before storage (no PII in free-form fields)
- [ ] Export function logs who exported what data
- [ ] Real-time counters in Redis use appropriate TTL
- [ ] Geographic data is obtained from IP, not user-provided
- [ ] Alert thresholds are configurable but have safe defaults
- [ ] PDF/CSV exports are stored in secure S3 bucket with expiring URLs
- [ ] Admin access to audit logs is itself audited
- [ ] Correlation IDs are UUIDs, not predictable sequences
- [ ] Materialized views don't expose sensitive data

---

## 📋 Audit Events from This Story

| Event | Trigger | Data |
|-------|---------|------|
| `LOGIN_SUCCESS` | Successful login | user_id, ip_address, device_id |
| `LOGIN_FAILED` | Failed login attempt | email (partial), ip_address, reason |
| `LOGOUT` | User logout | user_id, session_id |
| `PASSWORD_CHANGED` | Password change | user_id, changed_by |
| `PASSWORD_RESET_REQUESTED` | Reset request | email (partial) |
| `PASSWORD_RESET_COMPLETED` | Reset completed | user_id |
| `MFA_ENABLED` | MFA activation | user_id, method |
| `MFA_DISABLED` | MFA deactivation | user_id, disabled_by |
| `MFA_VERIFIED` | MFA verification | user_id, method |
| `MFA_FAILED` | Failed MFA attempt | user_id, method |
| `SESSION_CREATED` | New session | user_id, device_id |
| `SESSION_REVOKED` | Session terminated | user_id, session_id, reason |
| `ACCOUNT_LOCKED` | Account lockout | user_id, reason |
| `ACCOUNT_UNLOCKED` | Account unlock | user_id, unlocked_by |
| `PERMISSION_CHANGED` | Permission update | user_id, before, after |
| `ROLE_ASSIGNED` | Role granted | user_id, role_name, assigned_by |
| `ROLE_REMOVED` | Role revoked | user_id, role_name, removed_by |
| `AUDIT_EXPORT` | Log export | format, filters, count |
| `SECURITY_ALERT` | Alert created | alert_type, severity |
| `TAMPERING_ATTEMPT` | Modification attempt | operation, blocked |

---

## 📝 Implementation Notes

1. **Partitioning**: Use monthly table partitions for performance
2. **Indexing**: Create indexes based on common query patterns
3. **Archival**: Run nightly job to archive old logs
4. **Monitoring**: Set up Grafana dashboard for audit statistics
5. **Retention**: 10 years required by Polish accounting law
6. **Backup**: Separate backup policy for audit logs
7. **Performance**: Use materialized views for dashboards
8. **Alerting**: Configure PagerDuty/Slack for CRITICAL alerts

---

## 🇵🇱 Polish Law Compliance

- **Ustawa o rachunkowości** - 10 year retention for financial records
- **RODO/GDPR** - Personal data must be identifiable for auditing
- **KNF Requirements** - Financial institutions need comprehensive logs
- **JPK Compliance** - Logs must support tax audit queries

---

*Story last updated: December 2024*
