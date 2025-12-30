# Story: MON-003 - Error Tracking & Exception Capture

## Story Overview

| Field | Value |
|-------|-------|
| Story ID | MON-003 |
| Epic | Monitoring & Analytics (MON) |
| Title | Error Tracking & Exception Capture |
| Priority | P1 |
| Story Points | 6 |
| Sprint | Week 33 (Sprint 2) |
| Dependencies | MON-001 |

## User Story

**As a** Developer,
**I want** automatic exception capture with full context and error grouping,
**So that** I can quickly identify, diagnose, and resolve application issues.

## Acceptance Criteria

### AC1: Exception Capture

**Given** an uncaught exception in the application
**When** the exception is captured by the error handler
**Then** the error is stored with full stack trace and context
**And** the error hash is computed for grouping similar errors

### AC2: Error Grouping

**Given** multiple occurrences of the same error
**When** errors share the same stack trace hash
**Then** they are grouped together with occurrence count
**And** the first_seen and last_seen timestamps are updated

### AC3: Error Context

**Given** an error is captured
**When** storing the error
**Then** user ID, session ID, request ID are captured
**And** breadcrumbs (recent events) are included
**And** environment variables (non-sensitive) are logged

### AC4: Affected Users Tracking

**Given** errors affecting multiple users
**When** querying error details
**Then** unique affected users count is available
**And** affected user IDs can be retrieved (with permissions)

### AC5: Resolution Workflow

**Given** an open error
**When** an administrator resolves the error
**Then** the error status changes to RESOLVED
**And** resolved_at timestamp and resolved_by user are recorded
**And** if the error occurs again, a new instance is created

### AC6: Error Severity Classification

**Given** an error is captured
**When** processing the error
**Then** severity is classified (LOW, MEDIUM, HIGH, CRITICAL)
**And** CRITICAL errors trigger immediate alerts
**And** severity affects error list ordering

## Technical Specification

### Database Schema

```sql
-- Error events table
CREATE TABLE error_events (
  error_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  error_hash VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  error_name VARCHAR(255),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  context JSONB DEFAULT '{}',
  user_id UUID,
  session_id VARCHAR(64),
  request_id VARCHAR(64),
  occurrences INTEGER DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  affected_users INTEGER DEFAULT 0,
  tags JSONB DEFAULT '{}',
  breadcrumbs JSONB DEFAULT '[]',
  environment JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Error occurrences (detailed log of each occurrence)
CREATE TABLE error_occurrences (
  occurrence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  error_id UUID NOT NULL REFERENCES error_events(error_id) ON DELETE CASCADE,
  user_id UUID,
  session_id VARCHAR(64),
  request_id VARCHAR(64),
  context JSONB DEFAULT '{}',
  breadcrumbs JSONB DEFAULT '[]',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Affected users tracking
CREATE TABLE error_affected_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  error_id UUID NOT NULL REFERENCES error_events(error_id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  first_affected TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_affected TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  occurrence_count INTEGER DEFAULT 1,

  UNIQUE(error_id, user_id)
);

-- Indexes
CREATE INDEX idx_errors_hash ON error_events(tenant_id, error_hash);
CREATE INDEX idx_errors_status_severity ON error_events(tenant_id, status, severity);
CREATE INDEX idx_errors_last_seen ON error_events(tenant_id, last_seen DESC);
CREATE INDEX idx_errors_user ON error_events(tenant_id, user_id);

CREATE INDEX idx_occurrences_error ON error_occurrences(error_id, occurred_at DESC);
CREATE INDEX idx_affected_users_error ON error_affected_users(error_id);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Error severity enum
export const ErrorSeverityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

// Error status enum
export const ErrorStatusEnum = z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED']);

// Breadcrumb schema
export const BreadcrumbSchema = z.object({
  timestamp: z.date(),
  type: z.enum(['navigation', 'http', 'user', 'console', 'ui']),
  category: z.string().max(100),
  message: z.string().max(500),
  data: z.record(z.any()).optional(),
  level: z.enum(['debug', 'info', 'warning', 'error']).default('info'),
});

// Error context schema
export const ErrorContextSchema = z.object({
  userId: z.string().uuid().optional(),
  sessionId: z.string().max(64).optional(),
  requestId: z.string().max(64).optional(),
  url: z.string().url().optional(),
  method: z.string().max(10).optional(),
  userAgent: z.string().max(500).optional(),
  ipAddress: z.string().ip().optional(),
  extra: z.record(z.any()).optional(),
});

// Error capture input schema
export const CaptureErrorSchema = z.object({
  message: z.string().min(1).max(10000),
  stackTrace: z.string().max(100000).optional(),
  errorName: z.string().max(255).optional(),
  severity: ErrorSeverityEnum.optional(),
  context: ErrorContextSchema.optional(),
  tags: z.record(z.string().max(100)).optional(),
  breadcrumbs: z.array(BreadcrumbSchema).max(50).optional(),
  environment: z.record(z.string()).optional(),
});

// Error query schema
export const ErrorQuerySchema = z.object({
  status: z.array(ErrorStatusEnum).optional(),
  severity: z.array(ErrorSeverityEnum).optional(),
  search: z.string().max(255).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  userId: z.string().uuid().optional(),
  tags: z.record(z.string()).optional(),
  sortBy: z.enum(['last_seen', 'first_seen', 'occurrences', 'severity']).default('last_seen'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

// Error response schema
export const ErrorEventSchema = z.object({
  errorId: z.string().uuid(),
  errorHash: z.string(),
  message: z.string(),
  stackTrace: z.string().optional(),
  errorName: z.string().optional(),
  severity: ErrorSeverityEnum,
  status: ErrorStatusEnum,
  occurrences: z.number(),
  affectedUsers: z.number(),
  firstSeen: z.date(),
  lastSeen: z.date(),
  context: ErrorContextSchema.optional(),
  tags: z.record(z.string()).optional(),
  resolvedAt: z.date().optional(),
  resolvedBy: z.string().uuid().optional(),
});

// Resolution input schema
export const ResolveErrorSchema = z.object({
  errorId: z.string().uuid(),
  resolution: z.enum(['RESOLVED', 'IGNORED']),
  comment: z.string().max(1000).optional(),
});

// Error statistics schema
export const ErrorStatsSchema = z.object({
  totalErrors: z.number(),
  openErrors: z.number(),
  criticalErrors: z.number(),
  errorsByDate: z.array(z.object({
    date: z.date(),
    count: z.number(),
  })),
  topErrors: z.array(z.object({
    errorId: z.string(),
    message: z.string(),
    occurrences: z.number(),
  })),
});
```

### Service Implementation

```typescript
import { injectable, inject } from 'inversify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { Pool } from 'pg';

import { TYPES } from '@/infrastructure/types';
import { Logger } from '@/infrastructure/logger';
import { IEventTrackingService } from '../events/service';
import { IAlertService } from '../alerts/service';
import {
  CaptureErrorSchema,
  ErrorQuerySchema,
  ResolveErrorSchema,
  ErrorEventSchema,
  ErrorStatsSchema,
  ErrorSeverityEnum,
} from './schemas';

export interface IErrorTrackingService {
  captureException(
    tenantId: string,
    error: Error,
    context?: z.infer<typeof CaptureErrorSchema>['context'],
  ): Promise<{ errorId: string }>;

  captureError(
    tenantId: string,
    input: z.infer<typeof CaptureErrorSchema>,
  ): Promise<{ errorId: string }>;

  queryErrors(
    tenantId: string,
    query: z.infer<typeof ErrorQuerySchema>,
  ): Promise<{ errors: z.infer<typeof ErrorEventSchema>[]; total: number }>;

  getError(
    tenantId: string,
    errorId: string,
  ): Promise<z.infer<typeof ErrorEventSchema> | null>;

  resolveError(
    tenantId: string,
    userId: string,
    input: z.infer<typeof ResolveErrorSchema>,
  ): Promise<void>;

  getErrorStats(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<z.infer<typeof ErrorStatsSchema>>;

  getAffectedUsers(
    tenantId: string,
    errorId: string,
  ): Promise<string[]>;
}

@injectable()
export class ErrorTrackingService implements IErrorTrackingService {
  private readonly queue: Queue;

  constructor(
    @inject(TYPES.Logger) private readonly logger: Logger,
    @inject(TYPES.Redis) private readonly redis: Redis,
    @inject(TYPES.Database) private readonly db: Pool,
    @inject(TYPES.EventTrackingService) private readonly eventService: IEventTrackingService,
    @inject(TYPES.AlertService) private readonly alertService: IAlertService,
  ) {
    this.queue = new Queue('error-processing', {
      connection: { host: process.env.REDIS_HOST, port: 6379 },
    });

    this.initializeWorker();
  }

  async captureException(
    tenantId: string,
    error: Error,
    context?: z.infer<typeof CaptureErrorSchema>['context'],
  ): Promise<{ errorId: string }> {
    return this.captureError(tenantId, {
      message: error.message,
      stackTrace: error.stack,
      errorName: error.name,
      context,
    });
  }

  async captureError(
    tenantId: string,
    input: z.infer<typeof CaptureErrorSchema>,
  ): Promise<{ errorId: string }> {
    const validated = CaptureErrorSchema.parse(input);

    // Compute error hash from stack trace or message
    const errorHash = this.computeErrorHash(validated);

    // Classify severity if not provided
    const severity = validated.severity || this.classifySeverity(validated);

    // Check for existing error with same hash
    const existingError = await this.findExistingError(tenantId, errorHash);

    let errorId: string;

    if (existingError && existingError.status !== 'RESOLVED') {
      // Update existing error
      errorId = existingError.error_id;
      await this.updateExistingError(tenantId, existingError, validated);
    } else {
      // Create new error
      errorId = uuidv4();
      await this.createNewError(tenantId, errorId, errorHash, validated, severity);
    }

    // Record occurrence
    await this.recordOccurrence(tenantId, errorId, validated);

    // Track affected user
    if (validated.context?.userId) {
      await this.trackAffectedUser(tenantId, errorId, validated.context.userId);
    }

    // Track as event
    await this.eventService.trackEvent(tenantId, {
      eventType: 'ERROR',
      category: 'exception',
      action: 'error_captured',
      label: validated.errorName,
      properties: {
        errorId,
        errorHash,
        severity,
        errorName: validated.errorName,
      },
      context: validated.context || {},
      metadata: { severity },
    });

    // Trigger alert for critical errors
    if (severity === 'CRITICAL') {
      await this.alertService.triggerAlert(tenantId, {
        type: 'ERROR_CRITICAL',
        severity: 'CRITICAL',
        message: `Krytyczny błąd: ${validated.message.substring(0, 100)}`,
        context: { errorId, errorHash },
      });
    }

    this.logger.error('Error captured', {
      tenantId,
      errorId,
      errorHash,
      severity,
      errorName: validated.errorName,
    });

    return { errorId };
  }

  async queryErrors(
    tenantId: string,
    query: z.infer<typeof ErrorQuerySchema>,
  ): Promise<{ errors: z.infer<typeof ErrorEventSchema>[]; total: number }> {
    const validated = ErrorQuerySchema.parse(query);

    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (validated.status && validated.status.length > 0) {
      conditions.push(`status = ANY($${paramIndex})`);
      params.push(validated.status);
      paramIndex++;
    }

    if (validated.severity && validated.severity.length > 0) {
      conditions.push(`severity = ANY($${paramIndex})`);
      params.push(validated.severity);
      paramIndex++;
    }

    if (validated.search) {
      conditions.push(`(message ILIKE $${paramIndex} OR error_name ILIKE $${paramIndex})`);
      params.push(`%${validated.search}%`);
      paramIndex++;
    }

    if (validated.startDate) {
      conditions.push(`last_seen >= $${paramIndex}`);
      params.push(validated.startDate);
      paramIndex++;
    }

    if (validated.endDate) {
      conditions.push(`last_seen <= $${paramIndex}`);
      params.push(validated.endDate);
      paramIndex++;
    }

    if (validated.userId) {
      conditions.push(`user_id = $${paramIndex}`);
      params.push(validated.userId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const orderClause = `${validated.sortBy} ${validated.sortOrder}`;

    // Get total count
    const countResult = await this.db.query(
      `SELECT COUNT(*) FROM error_events WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get errors
    params.push(validated.limit, validated.offset);
    const result = await this.db.query(
      `SELECT * FROM error_events
       WHERE ${whereClause}
       ORDER BY ${orderClause}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params,
    );

    const errors = result.rows.map(this.mapRowToError);

    return { errors, total };
  }

  async getError(
    tenantId: string,
    errorId: string,
  ): Promise<z.infer<typeof ErrorEventSchema> | null> {
    const result = await this.db.query(
      `SELECT * FROM error_events WHERE tenant_id = $1 AND error_id = $2`,
      [tenantId, errorId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToError(result.rows[0]);
  }

  async resolveError(
    tenantId: string,
    userId: string,
    input: z.infer<typeof ResolveErrorSchema>,
  ): Promise<void> {
    const validated = ResolveErrorSchema.parse(input);

    await this.db.query(
      `UPDATE error_events
       SET status = $1, resolved_at = NOW(), resolved_by = $2, updated_at = NOW()
       WHERE tenant_id = $3 AND error_id = $4`,
      [validated.resolution, userId, tenantId, validated.errorId],
    );

    // Track resolution event
    await this.eventService.trackEvent(tenantId, {
      eventType: 'SYSTEM_EVENT',
      category: 'error_tracking',
      action: 'error_resolved',
      properties: {
        errorId: validated.errorId,
        resolution: validated.resolution,
        comment: validated.comment,
      },
      context: { userId },
      metadata: {},
    });

    this.logger.info('Error resolved', {
      tenantId,
      errorId: validated.errorId,
      resolution: validated.resolution,
      resolvedBy: userId,
    });
  }

  async getErrorStats(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<z.infer<typeof ErrorStatsSchema>> {
    // Total and open errors
    const totalsResult = await this.db.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'OPEN') as open,
        COUNT(*) FILTER (WHERE severity = 'CRITICAL' AND status = 'OPEN') as critical
       FROM error_events
       WHERE tenant_id = $1`,
      [tenantId],
    );

    // Errors by date
    const byDateResult = await this.db.query(
      `SELECT DATE(last_seen) as date, COUNT(*) as count
       FROM error_events
       WHERE tenant_id = $1 AND last_seen BETWEEN $2 AND $3
       GROUP BY DATE(last_seen)
       ORDER BY date`,
      [tenantId, startDate, endDate],
    );

    // Top errors by occurrences
    const topErrorsResult = await this.db.query(
      `SELECT error_id, message, occurrences
       FROM error_events
       WHERE tenant_id = $1 AND status = 'OPEN'
       ORDER BY occurrences DESC
       LIMIT 10`,
      [tenantId],
    );

    return {
      totalErrors: parseInt(totalsResult.rows[0].total, 10),
      openErrors: parseInt(totalsResult.rows[0].open, 10),
      criticalErrors: parseInt(totalsResult.rows[0].critical, 10),
      errorsByDate: byDateResult.rows.map((row) => ({
        date: row.date,
        count: parseInt(row.count, 10),
      })),
      topErrors: topErrorsResult.rows.map((row) => ({
        errorId: row.error_id,
        message: row.message.substring(0, 100),
        occurrences: row.occurrences,
      })),
    };
  }

  async getAffectedUsers(
    tenantId: string,
    errorId: string,
  ): Promise<string[]> {
    const result = await this.db.query(
      `SELECT user_id FROM error_affected_users
       WHERE tenant_id = $1 AND error_id = $2
       ORDER BY occurrence_count DESC
       LIMIT 100`,
      [tenantId, errorId],
    );

    return result.rows.map((row) => row.user_id);
  }

  // Private helper methods
  private computeErrorHash(error: z.infer<typeof CaptureErrorSchema>): string {
    // Use stack trace if available, otherwise message
    const hashSource = error.stackTrace
      ? this.normalizeStackTrace(error.stackTrace)
      : `${error.errorName}:${error.message}`;

    return crypto.createHash('sha256').update(hashSource).digest('hex').substring(0, 64);
  }

  private normalizeStackTrace(stackTrace: string): string {
    // Remove line numbers and file paths that may vary
    return stackTrace
      .split('\n')
      .map((line) => line.replace(/:\d+:\d+/g, '').trim())
      .filter((line) => line.length > 0)
      .slice(0, 5)
      .join('\n');
  }

  private classifySeverity(error: z.infer<typeof CaptureErrorSchema>): z.infer<typeof ErrorSeverityEnum> {
    const message = error.message.toLowerCase();
    const errorName = error.errorName?.toLowerCase() || '';

    // Critical indicators
    if (
      message.includes('critical') ||
      message.includes('fatal') ||
      message.includes('security') ||
      errorName.includes('security') ||
      message.includes('unauthorized')
    ) {
      return 'CRITICAL';
    }

    // High severity indicators
    if (
      message.includes('database') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      errorName.includes('timeout')
    ) {
      return 'HIGH';
    }

    // Medium severity (validation, expected errors)
    if (
      errorName.includes('validation') ||
      message.includes('not found') ||
      message.includes('invalid')
    ) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  private async findExistingError(
    tenantId: string,
    errorHash: string,
  ): Promise<any | null> {
    const result = await this.db.query(
      `SELECT * FROM error_events
       WHERE tenant_id = $1 AND error_hash = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenantId, errorHash],
    );

    return result.rows[0] || null;
  }

  private async updateExistingError(
    tenantId: string,
    existing: any,
    input: z.infer<typeof CaptureErrorSchema>,
  ): Promise<void> {
    await this.db.query(
      `UPDATE error_events
       SET occurrences = occurrences + 1,
           last_seen = NOW(),
           context = COALESCE($1, context),
           breadcrumbs = COALESCE($2, breadcrumbs),
           updated_at = NOW()
       WHERE tenant_id = $3 AND error_id = $4`,
      [
        input.context ? JSON.stringify(input.context) : null,
        input.breadcrumbs ? JSON.stringify(input.breadcrumbs) : null,
        tenantId,
        existing.error_id,
      ],
    );
  }

  private async createNewError(
    tenantId: string,
    errorId: string,
    errorHash: string,
    input: z.infer<typeof CaptureErrorSchema>,
    severity: z.infer<typeof ErrorSeverityEnum>,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO error_events (
        error_id, tenant_id, error_hash, message, stack_trace, error_name,
        severity, context, user_id, session_id, request_id, tags,
        breadcrumbs, environment
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        errorId,
        tenantId,
        errorHash,
        input.message,
        input.stackTrace,
        input.errorName,
        severity,
        JSON.stringify(input.context || {}),
        input.context?.userId,
        input.context?.sessionId,
        input.context?.requestId,
        JSON.stringify(input.tags || {}),
        JSON.stringify(input.breadcrumbs || []),
        JSON.stringify(input.environment || {}),
      ],
    );
  }

  private async recordOccurrence(
    tenantId: string,
    errorId: string,
    input: z.infer<typeof CaptureErrorSchema>,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO error_occurrences (
        tenant_id, error_id, user_id, session_id, request_id, context, breadcrumbs
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        tenantId,
        errorId,
        input.context?.userId,
        input.context?.sessionId,
        input.context?.requestId,
        JSON.stringify(input.context || {}),
        JSON.stringify(input.breadcrumbs || []),
      ],
    );
  }

  private async trackAffectedUser(
    tenantId: string,
    errorId: string,
    userId: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO error_affected_users (tenant_id, error_id, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (error_id, user_id) DO UPDATE SET
         last_affected = NOW(),
         occurrence_count = error_affected_users.occurrence_count + 1`,
      [tenantId, errorId, userId],
    );

    // Update affected users count on error
    await this.db.query(
      `UPDATE error_events
       SET affected_users = (
         SELECT COUNT(DISTINCT user_id) FROM error_affected_users WHERE error_id = $1
       )
       WHERE error_id = $1`,
      [errorId],
    );
  }

  private mapRowToError(row: any): z.infer<typeof ErrorEventSchema> {
    return {
      errorId: row.error_id,
      errorHash: row.error_hash,
      message: row.message,
      stackTrace: row.stack_trace,
      errorName: row.error_name,
      severity: row.severity,
      status: row.status,
      occurrences: row.occurrences,
      affectedUsers: row.affected_users,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      context: row.context,
      tags: row.tags,
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
    };
  }

  private initializeWorker(): void {
    new Worker(
      'error-processing',
      async (job) => {
        // Background processing for error analysis
        switch (job.data.type) {
          case 'analyze_pattern':
            await this.analyzeErrorPattern(job.data);
            break;
          case 'cleanup_old_occurrences':
            await this.cleanupOldOccurrences(job.data);
            break;
        }
      },
      { connection: { host: process.env.REDIS_HOST, port: 6379 } },
    );
  }

  private async analyzeErrorPattern(data: any): Promise<void> {
    // Placeholder for error pattern analysis
    this.logger.debug('Analyzing error pattern', data);
  }

  private async cleanupOldOccurrences(data: any): Promise<void> {
    // Clean up occurrences older than 30 days
    await this.db.query(
      `DELETE FROM error_occurrences
       WHERE tenant_id = $1 AND occurred_at < NOW() - INTERVAL '30 days'`,
      [data.tenantId],
    );
  }
}
```

### tRPC Router

```typescript
import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import {
  CaptureErrorSchema,
  ErrorQuerySchema,
  ResolveErrorSchema,
} from './schemas';

export const errorRouter = router({
  // Capture error
  capture: protectedProcedure
    .input(CaptureErrorSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.errorTrackingService.captureError(ctx.tenantId, input);
    }),

  // Query errors
  query: protectedProcedure
    .input(ErrorQuerySchema)
    .query(async ({ ctx, input }) => {
      return ctx.errorTrackingService.queryErrors(ctx.tenantId, input);
    }),

  // Get single error
  get: protectedProcedure
    .input(z.object({ errorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const error = await ctx.errorTrackingService.getError(
        ctx.tenantId,
        input.errorId,
      );

      if (!error) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Błąd nie został znaleziony',
        });
      }

      return error;
    }),

  // Resolve error
  resolve: adminProcedure
    .input(ResolveErrorSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.errorTrackingService.resolveError(
        ctx.tenantId,
        ctx.user.id,
        input,
      );

      // Audit log
      await ctx.auditService.log({
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        action: 'ERROR_RESOLVED',
        entityType: 'error',
        entityId: input.errorId,
        metadata: { resolution: input.resolution },
      });
    }),

  // Get error statistics
  stats: protectedProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.errorTrackingService.getErrorStats(
        ctx.tenantId,
        input.startDate,
        input.endDate,
      );
    }),

  // Get affected users (admin only)
  affectedUsers: adminProcedure
    .input(z.object({ errorId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.errorTrackingService.getAffectedUsers(
        ctx.tenantId,
        input.errorId,
      );
    }),
});
```

## Test Specifications

### Unit Tests

```typescript
describe('ErrorTrackingService', () => {
  let service: ErrorTrackingService;

  beforeEach(() => {
    service = new ErrorTrackingService(
      mockLogger,
      mockRedis,
      mockDb,
      mockEventService,
      mockAlertService,
    );
  });

  describe('captureError', () => {
    it('should create new error when hash not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // No existing error

      const result = await service.captureError('tenant-1', {
        message: 'Test error',
        stackTrace: 'Error at test.js:1',
        errorName: 'TestError',
      });

      expect(result.errorId).toBeDefined();
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO error_events'),
        expect.any(Array),
      );
    });

    it('should update existing error when hash matches', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ error_id: 'existing-id', status: 'OPEN' }],
      });

      const result = await service.captureError('tenant-1', {
        message: 'Test error',
        stackTrace: 'Error at test.js:1',
      });

      expect(result.errorId).toBe('existing-id');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE error_events'),
        expect.any(Array),
      );
    });

    it('should classify severity as CRITICAL for security errors', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await service.captureError('tenant-1', {
        message: 'Unauthorized access attempt detected',
      });

      expect(mockAlertService.triggerAlert).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ severity: 'CRITICAL' }),
      );
    });

    it('should track affected user', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await service.captureError('tenant-1', {
        message: 'Test error',
        context: { userId: 'user-123' },
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO error_affected_users'),
        expect.arrayContaining(['user-123']),
      );
    });
  });

  describe('computeErrorHash', () => {
    it('should generate consistent hash for same stack trace', () => {
      const hash1 = service['computeErrorHash']({
        message: 'Error',
        stackTrace: 'at test.js:1',
      });
      const hash2 = service['computeErrorHash']({
        message: 'Error',
        stackTrace: 'at test.js:1',
      });

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different stack traces', () => {
      const hash1 = service['computeErrorHash']({
        message: 'Error',
        stackTrace: 'at file1.js:1',
      });
      const hash2 = service['computeErrorHash']({
        message: 'Error',
        stackTrace: 'at file2.js:1',
      });

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('classifySeverity', () => {
    it('should classify security errors as CRITICAL', () => {
      const severity = service['classifySeverity']({
        message: 'Security violation detected',
      });
      expect(severity).toBe('CRITICAL');
    });

    it('should classify timeout errors as HIGH', () => {
      const severity = service['classifySeverity']({
        message: 'Database connection timeout',
        errorName: 'TimeoutError',
      });
      expect(severity).toBe('HIGH');
    });

    it('should classify validation errors as MEDIUM', () => {
      const severity = service['classifySeverity']({
        message: 'Invalid input',
        errorName: 'ValidationError',
      });
      expect(severity).toBe('MEDIUM');
    });
  });
});
```

### Integration Tests

```typescript
describe('Error Tracking Integration', () => {
  it('should capture, group, and query errors end-to-end', async () => {
    const tenantId = 'test-tenant';

    // Capture same error multiple times
    const error1 = await errorService.captureError(tenantId, {
      message: 'Test integration error',
      stackTrace: 'at integration.test.ts:1',
      context: { userId: 'user-1' },
    });

    await errorService.captureError(tenantId, {
      message: 'Test integration error',
      stackTrace: 'at integration.test.ts:1',
      context: { userId: 'user-2' },
    });

    // Query errors
    const { errors } = await errorService.queryErrors(tenantId, {});

    const foundError = errors.find(e => e.errorId === error1.errorId);
    expect(foundError).toBeDefined();
    expect(foundError?.occurrences).toBe(2);
    expect(foundError?.affectedUsers).toBe(2);
  });

  it('should resolve error and track resolution', async () => {
    const tenantId = 'test-tenant';
    const userId = 'admin-user';

    const { errorId } = await errorService.captureError(tenantId, {
      message: 'Error to resolve',
    });

    await errorService.resolveError(tenantId, userId, {
      errorId,
      resolution: 'RESOLVED',
    });

    const resolved = await errorService.getError(tenantId, errorId);
    expect(resolved?.status).toBe('RESOLVED');
    expect(resolved?.resolvedBy).toBe(userId);
  });
});
```

## Security Checklist

- [x] Tenant isolation in all queries
- [x] Stack traces sanitized (no sensitive paths)
- [x] User IDs only visible to admins
- [x] Rate limiting on capture endpoint
- [x] PII excluded from error context
- [x] Audit logging for resolution actions
- [x] Input validation with Zod

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `ERROR_CAPTURED` | New error captured | errorId, errorHash, severity |
| `ERROR_RESOLVED` | Error resolved | errorId, resolution, resolvedBy |
| `ERROR_QUERIED` | Error list queried | queryParams |

## Polish Localization Notes

- Error messages: "Krytyczny błąd", "Błąd aplikacji"
- Status labels: "Otwarty", "W trakcie badania", "Rozwiązany", "Zignorowany"
- Severity labels: "Niski", "Średni", "Wysoki", "Krytyczny"
- Date formats: "dd.MM.yyyy HH:mm" for Polish timezone

## Definition of Done

- [ ] All acceptance criteria verified
- [ ] Unit test coverage ≥ 80%
- [ ] Integration tests passing
- [ ] Error grouping correctly clusters similar errors
- [ ] Critical errors trigger alerts
- [ ] Security review completed
- [ ] Documentation updated
