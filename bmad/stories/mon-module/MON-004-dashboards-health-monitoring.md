# Story: MON-004 - Real-Time Dashboards & Health Monitoring

## Story Overview

| Field | Value |
|-------|-------|
| Story ID | MON-004 |
| Epic | Monitoring & Analytics (MON) |
| Title | Real-Time Dashboards & Health Monitoring |
| Priority | P1 |
| Story Points | 5 |
| Sprint | Week 33 (Sprint 2) |
| Dependencies | MON-002 |

## User Story

**As a** System Administrator,
**I want** real-time dashboards showing system health and performance metrics,
**So that** I can proactively monitor the platform and respond to issues immediately.

## Acceptance Criteria

### AC1: System Health Overview

**Given** a logged-in administrator
**When** accessing the health dashboard
**Then** overall system status (healthy/degraded/critical) is displayed
**And** all monitored services show their current status
**And** the dashboard updates in real-time (every 30 seconds)

### AC2: Service Health Details

**Given** a specific service on the dashboard
**When** viewing service details
**Then** response time, CPU usage, memory usage, and error rate are shown
**And** dependency health is displayed
**And** historical trend (last 24h) is available

### AC3: Real-Time Metrics Visualization

**Given** metrics data for a specific metric
**When** viewing on the dashboard
**Then** real-time line charts show the metric over time
**And** users can select different time ranges (1h, 6h, 24h, 7d)
**And** charts update automatically every 30 seconds

### AC4: Health Check Execution

**Given** the system monitoring service
**When** health checks are executed
**Then** all configured services are pinged
**And** results are stored with timestamp
**And** alerts are triggered if thresholds are exceeded

### AC5: Dashboard Customization

**Given** an administrator
**When** customizing their dashboard
**Then** they can add/remove/rearrange widgets
**And** widget configurations are saved per user
**And** default dashboard templates are available

### AC6: Real-Time Notifications

**Given** an active dashboard session
**When** a service status changes
**Then** users receive in-app notification immediately
**And** WebSocket pushes update the dashboard
**And** notification history is accessible

## Technical Specification

### Database Schema

```sql
-- Service health records
CREATE TABLE service_health (
  health_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  service_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN')),
  response_time_ms INTEGER,
  cpu_usage FLOAT CHECK (cpu_usage >= 0 AND cpu_usage <= 100),
  memory_usage FLOAT CHECK (memory_usage >= 0 AND memory_usage <= 100),
  disk_usage FLOAT CHECK (disk_usage >= 0 AND disk_usage <= 100),
  active_connections INTEGER,
  error_rate FLOAT CHECK (error_rate >= 0 AND error_rate <= 100),
  dependencies JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  checked_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dashboard configurations
CREATE TABLE dashboard_configs (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  layout JSONB NOT NULL,
  widgets JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN DEFAULT false,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, user_id, name)
);

-- Dashboard widgets
CREATE TABLE dashboard_widgets (
  widget_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  widget_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  configuration JSONB NOT NULL,
  data_source JSONB NOT NULL,
  refresh_interval_seconds INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service configurations
CREATE TABLE service_configs (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  service_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  health_endpoint VARCHAR(500),
  check_interval_seconds INTEGER DEFAULT 60,
  timeout_ms INTEGER DEFAULT 5000,
  thresholds JSONB NOT NULL DEFAULT '{}',
  dependencies JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, service_name)
);

-- Indexes
CREATE INDEX idx_service_health_checked ON service_health(tenant_id, service_name, checked_at DESC);
CREATE INDEX idx_service_health_status ON service_health(tenant_id, status, checked_at DESC);
CREATE INDEX idx_dashboard_configs_user ON dashboard_configs(tenant_id, user_id);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Service status enum
export const ServiceStatusEnum = z.enum(['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN']);

// Widget types enum
export const WidgetTypeEnum = z.enum([
  'health_overview',
  'service_status',
  'metric_chart',
  'error_summary',
  'alert_list',
  'kpi_card',
  'table',
  'heatmap',
]);

// Service health schema
export const ServiceHealthSchema = z.object({
  healthId: z.string().uuid(),
  serviceName: z.string(),
  status: ServiceStatusEnum,
  responseTimeMs: z.number().int().optional(),
  cpuUsage: z.number().min(0).max(100).optional(),
  memoryUsage: z.number().min(0).max(100).optional(),
  diskUsage: z.number().min(0).max(100).optional(),
  activeConnections: z.number().int().optional(),
  errorRate: z.number().min(0).max(100).optional(),
  dependencies: z.record(ServiceStatusEnum).optional(),
  metadata: z.record(z.any()).optional(),
  checkedAt: z.date(),
});

// System health overview schema
export const SystemHealthSchema = z.object({
  overallStatus: ServiceStatusEnum,
  healthyServices: z.number(),
  degradedServices: z.number(),
  unhealthyServices: z.number(),
  services: z.array(ServiceHealthSchema),
  lastUpdated: z.date(),
});

// Widget configuration schema
export const WidgetConfigSchema = z.object({
  widgetId: z.string().uuid().optional(),
  type: WidgetTypeEnum,
  title: z.string().max(255),
  position: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1).max(12),
    h: z.number().int().min(1).max(12),
  }),
  configuration: z.record(z.any()),
  dataSource: z.object({
    type: z.enum(['metrics', 'health', 'errors', 'alerts', 'custom']),
    query: z.record(z.any()).optional(),
    metricNames: z.array(z.string()).optional(),
    serviceNames: z.array(z.string()).optional(),
  }),
  refreshInterval: z.number().int().min(10).max(3600).default(30),
});

// Dashboard config schema
export const DashboardConfigSchema = z.object({
  configId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  layout: z.object({
    columns: z.number().int().min(1).max(12).default(12),
    rowHeight: z.number().int().min(50).max(200).default(100),
  }),
  widgets: z.array(WidgetConfigSchema),
  isDefault: z.boolean().default(false),
  isShared: z.boolean().default(false),
});

// Service config schema
export const ServiceConfigSchema = z.object({
  serviceName: z.string().min(1).max(100),
  displayName: z.string().min(1).max(255),
  healthEndpoint: z.string().url().optional(),
  checkIntervalSeconds: z.number().int().min(10).max(3600).default(60),
  timeoutMs: z.number().int().min(100).max(30000).default(5000),
  thresholds: z.object({
    responseTimeMs: z.number().int().optional(),
    cpuUsage: z.number().min(0).max(100).optional(),
    memoryUsage: z.number().min(0).max(100).optional(),
    errorRate: z.number().min(0).max(100).optional(),
  }),
  dependencies: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
});

// Health check result schema
export const HealthCheckResultSchema = z.object({
  serviceName: z.string(),
  status: ServiceStatusEnum,
  responseTimeMs: z.number().int(),
  details: z.record(z.any()).optional(),
  checkedAt: z.date(),
});

// Dashboard query schema
export const DashboardQuerySchema = z.object({
  timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).default('24h'),
  services: z.array(z.string()).optional(),
  includeHistory: z.boolean().default(true),
});
```

### Service Implementation

```typescript
import { injectable, inject } from 'inversify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import * as cron from 'node-cron';
import axios from 'axios';

import { TYPES } from '@/infrastructure/types';
import { Logger } from '@/infrastructure/logger';
import { WebSocketService } from '@/infrastructure/websocket';
import { IMetricsService } from '../metrics/service';
import { IAlertService } from '../alerts/service';
import {
  ServiceHealthSchema,
  SystemHealthSchema,
  DashboardConfigSchema,
  ServiceConfigSchema,
  HealthCheckResultSchema,
  DashboardQuerySchema,
  ServiceStatusEnum,
} from './schemas';

export interface IHealthMonitoringService {
  getSystemHealth(tenantId: string): Promise<z.infer<typeof SystemHealthSchema>>;

  getServiceHealth(
    tenantId: string,
    serviceName: string,
    query: z.infer<typeof DashboardQuerySchema>,
  ): Promise<z.infer<typeof ServiceHealthSchema>[]>;

  executeHealthCheck(
    tenantId: string,
    serviceName?: string,
  ): Promise<z.infer<typeof HealthCheckResultSchema>[]>;

  configureService(
    tenantId: string,
    config: z.infer<typeof ServiceConfigSchema>,
  ): Promise<void>;

  saveDashboardConfig(
    tenantId: string,
    userId: string,
    config: z.infer<typeof DashboardConfigSchema>,
  ): Promise<string>;

  getDashboardConfig(
    tenantId: string,
    userId: string,
    configId?: string,
  ): Promise<z.infer<typeof DashboardConfigSchema> | null>;

  listDashboards(
    tenantId: string,
    userId: string,
  ): Promise<Array<{ configId: string; name: string; isDefault: boolean }>>;
}

@injectable()
export class HealthMonitoringService implements IHealthMonitoringService {
  private healthCheckTasks: Map<string, cron.ScheduledTask> = new Map();

  constructor(
    @inject(TYPES.Logger) private readonly logger: Logger,
    @inject(TYPES.Redis) private readonly redis: Redis,
    @inject(TYPES.Database) private readonly db: Pool,
    @inject(TYPES.WebSocketService) private readonly wsService: WebSocketService,
    @inject(TYPES.MetricsService) private readonly metricsService: IMetricsService,
    @inject(TYPES.AlertService) private readonly alertService: IAlertService,
  ) {
    this.initializeHealthChecks();
  }

  async getSystemHealth(tenantId: string): Promise<z.infer<typeof SystemHealthSchema>> {
    // Get cached system health
    const cacheKey = `mon:${tenantId}:system_health`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Get latest health for all services
    const result = await this.db.query(
      `SELECT DISTINCT ON (service_name) *
       FROM service_health
       WHERE tenant_id = $1
       ORDER BY service_name, checked_at DESC`,
      [tenantId],
    );

    const services = result.rows.map(this.mapRowToServiceHealth);

    const healthyCount = services.filter((s) => s.status === 'HEALTHY').length;
    const degradedCount = services.filter((s) => s.status === 'DEGRADED').length;
    const unhealthyCount = services.filter((s) => s.status === 'UNHEALTHY').length;

    // Determine overall status
    let overallStatus: z.infer<typeof ServiceStatusEnum> = 'HEALTHY';
    if (unhealthyCount > 0) {
      overallStatus = 'UNHEALTHY';
    } else if (degradedCount > 0) {
      overallStatus = 'DEGRADED';
    }

    const systemHealth: z.infer<typeof SystemHealthSchema> = {
      overallStatus,
      healthyServices: healthyCount,
      degradedServices: degradedCount,
      unhealthyServices: unhealthyCount,
      services,
      lastUpdated: new Date(),
    };

    // Cache for 30 seconds
    await this.redis.setex(cacheKey, 30, JSON.stringify(systemHealth));

    return systemHealth;
  }

  async getServiceHealth(
    tenantId: string,
    serviceName: string,
    query: z.infer<typeof DashboardQuerySchema>,
  ): Promise<z.infer<typeof ServiceHealthSchema>[]> {
    const validated = DashboardQuerySchema.parse(query);

    const timeRangeMap = {
      '1h': '1 hour',
      '6h': '6 hours',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
    };

    const result = await this.db.query(
      `SELECT * FROM service_health
       WHERE tenant_id = $1
         AND service_name = $2
         AND checked_at >= NOW() - INTERVAL '${timeRangeMap[validated.timeRange]}'
       ORDER BY checked_at DESC
       LIMIT 1000`,
      [tenantId, serviceName],
    );

    return result.rows.map(this.mapRowToServiceHealth);
  }

  async executeHealthCheck(
    tenantId: string,
    serviceName?: string,
  ): Promise<z.infer<typeof HealthCheckResultSchema>[]> {
    // Get service configurations
    const configResult = await this.db.query(
      `SELECT * FROM service_configs
       WHERE tenant_id = $1 AND enabled = true
       ${serviceName ? 'AND service_name = $2' : ''}`,
      serviceName ? [tenantId, serviceName] : [tenantId],
    );

    const results: z.infer<typeof HealthCheckResultSchema>[] = [];

    for (const config of configResult.rows) {
      const result = await this.checkService(tenantId, config);
      results.push(result);

      // Store health check result
      await this.storeHealthCheck(tenantId, config.service_name, result);

      // Check thresholds and trigger alerts
      await this.evaluateThresholds(tenantId, config, result);

      // Broadcast update via WebSocket
      this.wsService.broadcast(`tenant:${tenantId}:health`, {
        type: 'health_update',
        service: config.service_name,
        status: result.status,
        checkedAt: result.checkedAt,
      });
    }

    // Invalidate system health cache
    await this.redis.del(`mon:${tenantId}:system_health`);

    return results;
  }

  async configureService(
    tenantId: string,
    config: z.infer<typeof ServiceConfigSchema>,
  ): Promise<void> {
    const validated = ServiceConfigSchema.parse(config);

    await this.db.query(
      `INSERT INTO service_configs (
        tenant_id, service_name, display_name, health_endpoint,
        check_interval_seconds, timeout_ms, thresholds, dependencies, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (tenant_id, service_name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        health_endpoint = EXCLUDED.health_endpoint,
        check_interval_seconds = EXCLUDED.check_interval_seconds,
        timeout_ms = EXCLUDED.timeout_ms,
        thresholds = EXCLUDED.thresholds,
        dependencies = EXCLUDED.dependencies,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()`,
      [
        tenantId,
        validated.serviceName,
        validated.displayName,
        validated.healthEndpoint,
        validated.checkIntervalSeconds,
        validated.timeoutMs,
        JSON.stringify(validated.thresholds),
        JSON.stringify(validated.dependencies || []),
        validated.enabled,
      ],
    );

    // Reschedule health check
    this.scheduleHealthCheck(tenantId, validated);

    this.logger.info('Service configured', {
      tenantId,
      serviceName: validated.serviceName,
    });
  }

  async saveDashboardConfig(
    tenantId: string,
    userId: string,
    config: z.infer<typeof DashboardConfigSchema>,
  ): Promise<string> {
    const validated = DashboardConfigSchema.parse(config);
    const configId = validated.configId || uuidv4();

    // If setting as default, unset other defaults
    if (validated.isDefault) {
      await this.db.query(
        `UPDATE dashboard_configs SET is_default = false
         WHERE tenant_id = $1 AND user_id = $2`,
        [tenantId, userId],
      );
    }

    await this.db.query(
      `INSERT INTO dashboard_configs (
        config_id, tenant_id, user_id, name, description,
        layout, widgets, is_default, is_shared
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (tenant_id, user_id, name) DO UPDATE SET
        description = EXCLUDED.description,
        layout = EXCLUDED.layout,
        widgets = EXCLUDED.widgets,
        is_default = EXCLUDED.is_default,
        is_shared = EXCLUDED.is_shared,
        updated_at = NOW()`,
      [
        configId,
        tenantId,
        userId,
        validated.name,
        validated.description,
        JSON.stringify(validated.layout),
        JSON.stringify(validated.widgets),
        validated.isDefault,
        validated.isShared,
      ],
    );

    return configId;
  }

  async getDashboardConfig(
    tenantId: string,
    userId: string,
    configId?: string,
  ): Promise<z.infer<typeof DashboardConfigSchema> | null> {
    let result;

    if (configId) {
      result = await this.db.query(
        `SELECT * FROM dashboard_configs
         WHERE tenant_id = $1 AND (user_id = $2 OR is_shared = true) AND config_id = $3`,
        [tenantId, userId, configId],
      );
    } else {
      // Get default or first dashboard
      result = await this.db.query(
        `SELECT * FROM dashboard_configs
         WHERE tenant_id = $1 AND user_id = $2
         ORDER BY is_default DESC, created_at ASC
         LIMIT 1`,
        [tenantId, userId],
      );
    }

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      configId: row.config_id,
      name: row.name,
      description: row.description,
      layout: row.layout,
      widgets: row.widgets,
      isDefault: row.is_default,
      isShared: row.is_shared,
    };
  }

  async listDashboards(
    tenantId: string,
    userId: string,
  ): Promise<Array<{ configId: string; name: string; isDefault: boolean }>> {
    const result = await this.db.query(
      `SELECT config_id, name, is_default FROM dashboard_configs
       WHERE tenant_id = $1 AND (user_id = $2 OR is_shared = true)
       ORDER BY is_default DESC, name ASC`,
      [tenantId, userId],
    );

    return result.rows.map((row) => ({
      configId: row.config_id,
      name: row.name,
      isDefault: row.is_default,
    }));
  }

  // Private helper methods
  private async checkService(
    tenantId: string,
    config: any,
  ): Promise<z.infer<typeof HealthCheckResultSchema>> {
    const startTime = Date.now();
    let status: z.infer<typeof ServiceStatusEnum> = 'UNKNOWN';
    let details: Record<string, any> = {};

    try {
      if (config.health_endpoint) {
        const response = await axios.get(config.health_endpoint, {
          timeout: config.timeout_ms,
        });

        status = response.status === 200 ? 'HEALTHY' : 'DEGRADED';
        details = response.data;
      } else {
        // Default check - assume healthy if no endpoint
        status = 'HEALTHY';
      }
    } catch (error) {
      const err = error as any;
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        status = 'DEGRADED';
        details = { error: 'Timeout' };
      } else {
        status = 'UNHEALTHY';
        details = { error: err.message };
      }
    }

    const responseTimeMs = Date.now() - startTime;

    // Check response time threshold
    if (
      status === 'HEALTHY' &&
      config.thresholds?.responseTimeMs &&
      responseTimeMs > config.thresholds.responseTimeMs
    ) {
      status = 'DEGRADED';
    }

    return {
      serviceName: config.service_name,
      status,
      responseTimeMs,
      details,
      checkedAt: new Date(),
    };
  }

  private async storeHealthCheck(
    tenantId: string,
    serviceName: string,
    result: z.infer<typeof HealthCheckResultSchema>,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO service_health (
        tenant_id, service_name, status, response_time_ms, checked_at
      ) VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, serviceName, result.status, result.responseTimeMs, result.checkedAt],
    );

    // Record as metric
    await this.metricsService.recordMetric(tenantId, {
      name: 'service.response_time',
      value: result.responseTimeMs,
      type: 'GAUGE',
      tags: { service: serviceName },
    });
  }

  private async evaluateThresholds(
    tenantId: string,
    config: any,
    result: z.infer<typeof HealthCheckResultSchema>,
  ): Promise<void> {
    if (result.status === 'UNHEALTHY') {
      await this.alertService.triggerAlert(tenantId, {
        type: 'SERVICE_UNHEALTHY',
        severity: 'HIGH',
        message: `Usługa ${config.display_name} jest niedostępna`,
        context: {
          serviceName: config.service_name,
          status: result.status,
          responseTimeMs: result.responseTimeMs,
        },
      });
    } else if (result.status === 'DEGRADED') {
      await this.alertService.triggerAlert(tenantId, {
        type: 'SERVICE_DEGRADED',
        severity: 'MEDIUM',
        message: `Usługa ${config.display_name} działa wolniej niż zwykle`,
        context: {
          serviceName: config.service_name,
          status: result.status,
          responseTimeMs: result.responseTimeMs,
        },
      });
    }
  }

  private mapRowToServiceHealth(row: any): z.infer<typeof ServiceHealthSchema> {
    return {
      healthId: row.health_id,
      serviceName: row.service_name,
      status: row.status,
      responseTimeMs: row.response_time_ms,
      cpuUsage: row.cpu_usage,
      memoryUsage: row.memory_usage,
      diskUsage: row.disk_usage,
      activeConnections: row.active_connections,
      errorRate: row.error_rate,
      dependencies: row.dependencies,
      metadata: row.metadata,
      checkedAt: row.checked_at,
    };
  }

  private async initializeHealthChecks(): Promise<void> {
    // Load all tenant service configs and schedule checks
    const result = await this.db.query(
      `SELECT DISTINCT tenant_id FROM service_configs WHERE enabled = true`,
    );

    for (const row of result.rows) {
      await this.scheduleAllChecksForTenant(row.tenant_id);
    }
  }

  private async scheduleAllChecksForTenant(tenantId: string): Promise<void> {
    const result = await this.db.query(
      `SELECT * FROM service_configs WHERE tenant_id = $1 AND enabled = true`,
      [tenantId],
    );

    for (const config of result.rows) {
      this.scheduleHealthCheck(tenantId, config);
    }
  }

  private scheduleHealthCheck(
    tenantId: string,
    config: z.infer<typeof ServiceConfigSchema>,
  ): void {
    const taskKey = `${tenantId}:${config.serviceName}`;

    // Cancel existing task
    const existingTask = this.healthCheckTasks.get(taskKey);
    if (existingTask) {
      existingTask.stop();
    }

    // Schedule new task
    const cronExpression = `*/${Math.max(1, Math.floor(config.checkIntervalSeconds / 60))} * * * *`;

    const task = cron.schedule(cronExpression, async () => {
      try {
        await this.executeHealthCheck(tenantId, config.serviceName);
      } catch (error) {
        this.logger.error('Health check failed', {
          tenantId,
          serviceName: config.serviceName,
          error,
        });
      }
    });

    this.healthCheckTasks.set(taskKey, task);
  }
}
```

### tRPC Router

```typescript
import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '@/server/trpc';
import { observable } from '@trpc/server/observable';
import {
  DashboardConfigSchema,
  ServiceConfigSchema,
  DashboardQuerySchema,
} from './schemas';

export const healthRouter = router({
  // Get system health overview
  getSystemHealth: protectedProcedure.query(async ({ ctx }) => {
    return ctx.healthMonitoringService.getSystemHealth(ctx.tenantId);
  }),

  // Get service health history
  getServiceHealth: protectedProcedure
    .input(z.object({
      serviceName: z.string(),
      query: DashboardQuerySchema,
    }))
    .query(async ({ ctx, input }) => {
      return ctx.healthMonitoringService.getServiceHealth(
        ctx.tenantId,
        input.serviceName,
        input.query,
      );
    }),

  // Execute health check
  executeCheck: adminProcedure
    .input(z.object({ serviceName: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.healthMonitoringService.executeHealthCheck(
        ctx.tenantId,
        input.serviceName,
      );
    }),

  // Configure service
  configureService: adminProcedure
    .input(ServiceConfigSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.healthMonitoringService.configureService(ctx.tenantId, input);

      // Audit log
      await ctx.auditService.log({
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        action: 'SERVICE_CONFIGURED',
        entityType: 'service_config',
        metadata: { serviceName: input.serviceName },
      });
    }),

  // Save dashboard config
  saveDashboard: protectedProcedure
    .input(DashboardConfigSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.healthMonitoringService.saveDashboardConfig(
        ctx.tenantId,
        ctx.user.id,
        input,
      );
    }),

  // Get dashboard config
  getDashboard: protectedProcedure
    .input(z.object({ configId: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.healthMonitoringService.getDashboardConfig(
        ctx.tenantId,
        ctx.user.id,
        input.configId,
      );
    }),

  // List dashboards
  listDashboards: protectedProcedure.query(async ({ ctx }) => {
    return ctx.healthMonitoringService.listDashboards(
      ctx.tenantId,
      ctx.user.id,
    );
  }),

  // Real-time health subscription
  subscribeHealth: protectedProcedure.subscription(({ ctx }) => {
    return observable<any>((emit) => {
      const channel = `tenant:${ctx.tenantId}:health`;

      const handler = (message: string) => {
        emit.next(JSON.parse(message));
      };

      ctx.redis.subscribe(channel);
      ctx.redis.on('message', handler);

      return () => {
        ctx.redis.unsubscribe(channel);
        ctx.redis.off('message', handler);
      };
    });
  }),
});
```

## Test Specifications

### Unit Tests

```typescript
describe('HealthMonitoringService', () => {
  describe('getSystemHealth', () => {
    it('should return cached system health when available', async () => {
      const cachedHealth = { overallStatus: 'HEALTHY', services: [] };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedHealth));

      const result = await service.getSystemHealth('tenant-1');

      expect(result.overallStatus).toBe('HEALTHY');
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should calculate overall status correctly', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({
        rows: [
          { status: 'HEALTHY', service_name: 'api' },
          { status: 'DEGRADED', service_name: 'db' },
        ],
      });

      const result = await service.getSystemHealth('tenant-1');

      expect(result.overallStatus).toBe('DEGRADED');
      expect(result.healthyServices).toBe(1);
      expect(result.degradedServices).toBe(1);
    });
  });

  describe('executeHealthCheck', () => {
    it('should check all services when no service name provided', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { service_name: 'api', health_endpoint: 'http://api/health', timeout_ms: 5000 },
          { service_name: 'db', health_endpoint: 'http://db/health', timeout_ms: 5000 },
        ],
      });

      const results = await service.executeHealthCheck('tenant-1');

      expect(results).toHaveLength(2);
    });

    it('should trigger alert for unhealthy service', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ service_name: 'api', health_endpoint: 'http://invalid/health', timeout_ms: 100 }],
      });

      await service.executeHealthCheck('tenant-1');

      expect(mockAlertService.triggerAlert).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ type: 'SERVICE_UNHEALTHY' }),
      );
    });
  });
});
```

## Security Checklist

- [x] Tenant isolation in all queries
- [x] Admin-only access for service configuration
- [x] Dashboard configs are user-specific
- [x] Health endpoints validated
- [x] WebSocket connections authenticated
- [x] Rate limiting on health checks

## Polish Localization Notes

- Status labels: "Zdrowy", "Zdegradowany", "Niesprawny", "Nieznany"
- Dashboard default name: "Pulpit główny"
- Alert messages in Polish
- Date/time formatting: "dd.MM.yyyy HH:mm:ss" (Europe/Warsaw)

## Definition of Done

- [ ] All acceptance criteria verified
- [ ] Unit test coverage ≥ 80%
- [ ] Integration tests passing
- [ ] WebSocket real-time updates working
- [ ] Dashboard customization functional
- [ ] Security review completed
- [ ] Documentation updated
