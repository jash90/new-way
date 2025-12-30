# WFA-006: Real-Time Monitoring

> **Story ID**: WFA-006
> **Epic**: Workflow Automation Engine (WFA)
> **Priority**: P0 (Critical)
> **Story Points**: 8
> **Phase**: 5 (Week 19)
> **Status**: 📋 Specified

---

## User Story

**As an** accountant managing automated workflows,
**I want** real-time monitoring of workflow executions
**So that** I can track progress, identify issues quickly, and ensure all processes complete successfully.

---

## Acceptance Criteria

### AC1: Live Execution Status
```gherkin
Feature: Live Execution Status
  Scenario: View real-time execution status
    Given workflow "invoice-processing" is currently executing
    When I open the monitoring dashboard
    Then I see the execution status updated in real-time
    And I see which step is currently executing
    And I see the execution progress percentage
    And status changes appear within 1 second

  Scenario: Multiple concurrent executions
    Given 5 instances of "document-approval" are running
    When I view the workflow monitor
    Then I see all 5 executions in the list
    And each shows independent progress
    And I can filter by execution status
```

### AC2: Step-by-Step Progress
```gherkin
Feature: Step-by-Step Progress Tracking
  Scenario: View detailed step progress
    Given workflow "month-end-closing" with 12 steps is executing
    When I expand the execution details
    Then I see all 12 steps with status indicators
    And completed steps show green checkmark with duration
    And current step shows spinning indicator with elapsed time
    And pending steps show grey indicators
    And failed steps show red X with error preview

  Scenario: Step input/output inspection
    Given step "VAT Calculation" has completed
    When I click on the step details
    Then I see the input data received by the step
    And I see the output data produced
    And I see the step duration and resource usage
    And I can copy data for debugging
```

### AC3: Execution Timeline
```gherkin
Feature: Execution Timeline Visualization
  Scenario: View execution timeline
    Given workflow "payment-processing" completed with 8 steps
    When I view the execution timeline
    Then I see a Gantt-style timeline of all steps
    And parallel steps are shown on separate rows
    And I see total execution duration
    And I can hover over steps for details

  Scenario: Identify bottlenecks from timeline
    Given workflow has execution history
    When I analyze the timeline
    Then I see which steps took longest
    And I see wait times between steps
    And I can compare with average execution times
```

### AC4: Resource Utilization
```gherkin
Feature: Resource Utilization Monitoring
  Scenario: Monitor system resources
    Given multiple workflows are executing
    When I view resource utilization panel
    Then I see CPU usage for workflow engine
    And I see memory consumption
    And I see active database connections
    And I see message queue depth
    And metrics refresh every 5 seconds

  Scenario: Resource alerts
    Given CPU usage exceeds 80% threshold
    When threshold is breached
    Then I see warning indicator on dashboard
    And I receive notification if configured
    And I can see which workflows are consuming most resources
```

### AC5: Queue Depth Monitoring
```gherkin
Feature: Queue Depth Monitoring
  Scenario: View execution queue status
    Given there are pending workflow executions
    When I check the queue monitor
    Then I see total pending executions count
    And I see breakdown by priority (HIGH, NORMAL, LOW)
    And I see average wait time
    And I see oldest queued execution
    And I see queue processing rate

  Scenario: Queue backlog alert
    Given queue depth exceeds 100 pending items
    When backlog threshold is breached
    Then dashboard shows queue warning
    And I see estimated clearance time
    And I can prioritize critical workflows
```

### AC6: Alerting Integration
```gherkin
Feature: Alerting System Integration
  Scenario: Configure execution alerts
    Given I am setting up monitoring for "tax-filing" workflow
    When I configure alerts
    Then I can set alert for execution failure
    And I can set alert for execution duration > threshold
    And I can set alert for consecutive failures
    And I can choose notification channels (email, Slack, SMS)

  Scenario: Receive alert notification
    Given workflow "jpk-generation" has failed 3 times consecutively
    And consecutive failure alert is configured
    When third failure occurs
    Then alert is triggered immediately
    And I receive notification on configured channels
    And alert includes execution details and error info
    And I can acknowledge or escalate from notification
```

### AC7: Performance Metrics
```gherkin
Feature: Performance Metrics Dashboard
  Scenario: View workflow performance metrics
    Given workflow "document-classification" has execution history
    When I open performance metrics
    Then I see success rate percentage
    And I see average execution time
    And I see p50, p95, p99 latency percentiles
    And I see executions per hour/day/week
    And I can select different time ranges

  Scenario: Compare performance over time
    Given I am analyzing "invoice-processing" performance
    When I select "Last 30 days" view
    Then I see trend graph of execution times
    And I see trend of success rates
    And I can identify performance degradation
    And I can export metrics data
```

### AC8: Real-Time Dashboard
```gherkin
Feature: Comprehensive Monitoring Dashboard
  Scenario: View main monitoring dashboard
    Given I am a workflow administrator
    When I open the monitoring dashboard
    Then I see summary widgets for all active workflows
    And I see currently running executions count
    And I see failed executions requiring attention
    And I see system health status
    And I see recent alerts
    And dashboard auto-refreshes every 5 seconds

  Scenario: Customize dashboard layout
    Given I want to focus on specific workflows
    When I customize the dashboard
    Then I can add/remove widgets
    And I can resize and rearrange widgets
    And I can save my layout as default
    And I can create multiple dashboard views
```

---

## Technical Specification

### Database Schema

```sql
-- Execution metrics table (time-series optimized)
CREATE TABLE execution_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES workflows(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    metric_type VARCHAR(50) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metadata JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step metrics
CREATE TABLE step_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    step_execution_id UUID NOT NULL REFERENCES step_executions(id) ON DELETE CASCADE,
    execution_id UUID NOT NULL REFERENCES workflow_executions(id),
    step_id VARCHAR(255) NOT NULL,
    duration_ms INTEGER NOT NULL,
    cpu_usage_percent DECIMAL(5,2),
    memory_usage_mb INTEGER,
    input_size_bytes INTEGER,
    output_size_bytes INTEGER,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alert configurations
CREATE TABLE monitoring_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    alert_type VARCHAR(50) NOT NULL,
    alert_name VARCHAR(255) NOT NULL,
    conditions JSONB NOT NULL,
    notification_channels JSONB NOT NULL DEFAULT '[]',
    cooldown_minutes INTEGER DEFAULT 15,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Alert history
CREATE TABLE alert_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES monitoring_alerts(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES workflows(id),
    execution_id UUID REFERENCES workflow_executions(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dashboard configurations
CREATE TABLE user_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    layout JSONB NOT NULL DEFAULT '{}',
    widgets JSONB NOT NULL DEFAULT '[]',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Resource metrics (system-level)
CREATE TABLE resource_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    tags JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Queue snapshots
CREATE TABLE queue_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    queue_name VARCHAR(100) NOT NULL,
    pending_count INTEGER NOT NULL DEFAULT 0,
    processing_count INTEGER NOT NULL DEFAULT 0,
    pending_by_priority JSONB DEFAULT '{}',
    oldest_message_age_seconds INTEGER,
    average_wait_seconds INTEGER,
    processing_rate_per_minute DECIMAL(10,2),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE execution_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization isolation for execution_metrics"
    ON execution_metrics FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY "Organization isolation for monitoring_alerts"
    ON monitoring_alerts FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY "Organization isolation for alert_history"
    ON alert_history FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY "User dashboards isolation"
    ON user_dashboards FOR ALL
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Indexes for time-series queries
CREATE INDEX idx_execution_metrics_workflow_time
    ON execution_metrics(workflow_id, recorded_at DESC);
CREATE INDEX idx_execution_metrics_org_time
    ON execution_metrics(organization_id, recorded_at DESC);
CREATE INDEX idx_step_metrics_execution
    ON step_metrics(execution_id);
CREATE INDEX idx_alert_history_org_time
    ON alert_history(organization_id, triggered_at DESC);
CREATE INDEX idx_alert_history_status
    ON alert_history(status) WHERE status = 'active';
CREATE INDEX idx_resource_metrics_time
    ON resource_metrics(organization_id, recorded_at DESC);
CREATE INDEX idx_queue_snapshots_time
    ON queue_snapshots(organization_id, recorded_at DESC);

-- Partitioning for metrics tables (optional, for scale)
-- CREATE TABLE execution_metrics_y2024m12 PARTITION OF execution_metrics
--     FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Alert types
export const alertTypeSchema = z.enum([
  'execution_failed',
  'execution_timeout',
  'consecutive_failures',
  'high_error_rate',
  'slow_execution',
  'queue_backlog',
  'resource_threshold',
  'custom'
]);

// Alert severity
export const alertSeveritySchema = z.enum([
  'info',
  'warning',
  'error',
  'critical'
]);

// Notification channels
export const notificationChannelSchema = z.object({
  type: z.enum(['email', 'slack', 'sms', 'webhook', 'in_app']),
  config: z.record(z.unknown())
});

// Alert condition schema
export const alertConditionSchema = z.object({
  metric: z.string(),
  operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'ne']),
  threshold: z.number(),
  timeWindowMinutes: z.number().min(1).max(1440).optional(),
  consecutiveCount: z.number().min(1).max(100).optional()
});

// Create alert schema
export const createAlertSchema = z.object({
  workflowId: z.string().uuid().optional(), // null = all workflows
  alertType: alertTypeSchema,
  alertName: z.string().min(3).max(255),
  conditions: z.array(alertConditionSchema).min(1),
  notificationChannels: z.array(notificationChannelSchema).min(1),
  cooldownMinutes: z.number().min(5).max(1440).default(15),
  severity: alertSeveritySchema.default('warning')
});

// Dashboard widget schema
export const dashboardWidgetSchema = z.object({
  id: z.string(),
  type: z.enum([
    'active_executions',
    'execution_chart',
    'success_rate',
    'performance_metrics',
    'queue_status',
    'resource_usage',
    'alert_list',
    'workflow_health',
    'step_breakdown',
    'timeline'
  ]),
  title: z.string(),
  config: z.record(z.unknown()).optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number()
  })
});

// Create dashboard schema
export const createDashboardSchema = z.object({
  name: z.string().min(3).max(255),
  layout: z.object({
    columns: z.number().min(1).max(12).default(12),
    rowHeight: z.number().min(50).max(200).default(100)
  }),
  widgets: z.array(dashboardWidgetSchema),
  isDefault: z.boolean().default(false)
});

// Metrics query schema
export const metricsQuerySchema = z.object({
  workflowId: z.string().uuid().optional(),
  executionId: z.string().uuid().optional(),
  metricTypes: z.array(z.string()).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  aggregation: z.enum(['none', 'avg', 'sum', 'min', 'max', 'count']).default('none'),
  interval: z.enum(['1m', '5m', '15m', '1h', '1d']).optional()
});

// Real-time subscription schema
export const subscriptionSchema = z.object({
  type: z.enum([
    'execution_updates',
    'step_updates',
    'metrics_stream',
    'alerts',
    'queue_status'
  ]),
  filters: z.object({
    workflowId: z.string().uuid().optional(),
    executionId: z.string().uuid().optional(),
    status: z.array(z.string()).optional()
  }).optional()
});

// Polish language messages
export const monitoringMessages = {
  executionStarted: 'Wykonanie workflow rozpoczęte',
  executionCompleted: 'Wykonanie workflow zakończone pomyślnie',
  executionFailed: 'Wykonanie workflow nie powiodło się',
  stepCompleted: 'Krok zakończony',
  stepFailed: 'Krok nie powiódł się',
  alertTriggered: 'Wyzwolono alert',
  alertAcknowledged: 'Alert został potwierdzony',
  queueBacklog: 'Wykryto zaległości w kolejce',
  resourceWarning: 'Ostrzeżenie o zasobach systemu',
  performanceDegraded: 'Wykryto spadek wydajności'
} as const;

export type AlertType = z.infer<typeof alertTypeSchema>;
export type AlertSeverity = z.infer<typeof alertSeveritySchema>;
export type CreateAlertInput = z.infer<typeof createAlertSchema>;
export type DashboardWidget = z.infer<typeof dashboardWidgetSchema>;
export type CreateDashboardInput = z.infer<typeof createDashboardSchema>;
export type MetricsQuery = z.infer<typeof metricsQuerySchema>;
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;
```

### Core Service Implementation

```typescript
// src/modules/wfa/services/monitoring.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from '@/common/redis/redis.service';
import { Server } from 'socket.io';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private io: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly redis: RedisService
  ) {
    this.setupEventListeners();
  }

  setSocketServer(io: Server) {
    this.io = io;
  }

  private setupEventListeners() {
    // Listen for execution events
    this.eventEmitter.on('execution.started', (data) => this.handleExecutionUpdate(data));
    this.eventEmitter.on('execution.completed', (data) => this.handleExecutionUpdate(data));
    this.eventEmitter.on('execution.failed', (data) => this.handleExecutionUpdate(data));
    this.eventEmitter.on('step.started', (data) => this.handleStepUpdate(data));
    this.eventEmitter.on('step.completed', (data) => this.handleStepUpdate(data));
    this.eventEmitter.on('step.failed', (data) => this.handleStepUpdate(data));
  }

  private async handleExecutionUpdate(data: ExecutionEvent) {
    // Broadcast to connected clients
    if (this.io) {
      this.io.to(`workflow:${data.workflowId}`).emit('execution:update', {
        executionId: data.executionId,
        status: data.status,
        timestamp: data.timestamp,
        progress: data.progress
      });

      this.io.to(`execution:${data.executionId}`).emit('execution:update', data);
    }

    // Check alerts
    await this.checkAlerts(data);

    // Record metrics
    await this.recordExecutionMetric(data);
  }

  private async handleStepUpdate(data: StepEvent) {
    if (this.io) {
      this.io.to(`execution:${data.executionId}`).emit('step:update', {
        stepId: data.stepId,
        status: data.status,
        duration: data.duration,
        timestamp: data.timestamp
      });
    }

    // Record step metrics
    if (data.status === 'completed' || data.status === 'failed') {
      await this.recordStepMetric(data);
    }
  }

  async getExecutionStatus(executionId: string): Promise<ExecutionStatusDetails> {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        workflow: true,
        stepExecutions: {
          orderBy: { startedAt: 'asc' }
        }
      }
    });

    if (!execution) {
      throw new ExecutionNotFoundException(executionId);
    }

    const progress = this.calculateProgress(execution.stepExecutions);

    return {
      executionId: execution.id,
      workflowId: execution.workflowId,
      workflowName: execution.workflow.name,
      status: execution.status,
      progress,
      currentStep: this.getCurrentStep(execution.stepExecutions),
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      duration: this.calculateDuration(execution),
      steps: execution.stepExecutions.map(s => ({
        stepId: s.stepId,
        name: s.stepName,
        status: s.status,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        duration: s.durationMs,
        error: s.error
      }))
    };
  }

  private calculateProgress(steps: StepExecution[]): number {
    if (steps.length === 0) return 0;
    const completed = steps.filter(s => s.status === 'completed').length;
    return Math.round((completed / steps.length) * 100);
  }

  private getCurrentStep(steps: StepExecution[]): string | null {
    const running = steps.find(s => s.status === 'running');
    return running?.stepName || null;
  }

  private calculateDuration(execution: WorkflowExecution): number | null {
    if (!execution.startedAt) return null;
    const end = execution.completedAt || new Date();
    return end.getTime() - execution.startedAt.getTime();
  }

  async getWorkflowMetrics(
    workflowId: string,
    query: MetricsQuery
  ): Promise<WorkflowMetrics> {
    const executions = await this.prisma.workflowExecution.findMany({
      where: {
        workflowId,
        startedAt: {
          gte: new Date(query.startTime),
          lte: new Date(query.endTime)
        }
      },
      include: { stepExecutions: true }
    });

    const total = executions.length;
    const successful = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;

    const durations = executions
      .filter(e => e.completedAt && e.startedAt)
      .map(e => e.completedAt!.getTime() - e.startedAt!.getTime())
      .sort((a, b) => a - b);

    return {
      workflowId,
      timeRange: { start: query.startTime, end: query.endTime },
      totalExecutions: total,
      successfulExecutions: successful,
      failedExecutions: failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      averageDuration: durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0,
      percentiles: {
        p50: this.getPercentile(durations, 50),
        p95: this.getPercentile(durations, 95),
        p99: this.getPercentile(durations, 99)
      },
      executionsByStatus: {
        completed: successful,
        failed,
        running: executions.filter(e => e.status === 'running').length,
        pending: executions.filter(e => e.status === 'pending').length
      },
      executionsByHour: this.groupByHour(executions)
    };
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private groupByHour(executions: WorkflowExecution[]): Record<string, number> {
    const groups: Record<string, number> = {};
    executions.forEach(e => {
      if (e.startedAt) {
        const hour = e.startedAt.toISOString().slice(0, 13);
        groups[hour] = (groups[hour] || 0) + 1;
      }
    });
    return groups;
  }

  async getQueueStatus(organizationId: string): Promise<QueueStatus> {
    // Get latest queue snapshot from Redis
    const cached = await this.redis.get(`queue:status:${organizationId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Calculate from database
    const pending = await this.prisma.workflowExecution.count({
      where: { organizationId, status: 'pending' }
    });

    const processing = await this.prisma.workflowExecution.count({
      where: { organizationId, status: 'running' }
    });

    const byPriority = await this.prisma.workflowExecution.groupBy({
      by: ['priority'],
      where: { organizationId, status: 'pending' },
      _count: true
    });

    const oldest = await this.prisma.workflowExecution.findFirst({
      where: { organizationId, status: 'pending' },
      orderBy: { createdAt: 'asc' }
    });

    const status: QueueStatus = {
      pendingCount: pending,
      processingCount: processing,
      pendingByPriority: Object.fromEntries(
        byPriority.map(p => [p.priority, p._count])
      ),
      oldestMessageAge: oldest
        ? Math.round((Date.now() - oldest.createdAt.getTime()) / 1000)
        : 0,
      averageWaitSeconds: await this.calculateAverageWait(organizationId),
      processingRatePerMinute: await this.calculateProcessingRate(organizationId)
    };

    // Cache for 5 seconds
    await this.redis.setex(`queue:status:${organizationId}`, 5, JSON.stringify(status));

    return status;
  }

  private async calculateAverageWait(organizationId: string): Promise<number> {
    const recent = await this.prisma.workflowExecution.findMany({
      where: {
        organizationId,
        status: 'completed',
        startedAt: { gte: new Date(Date.now() - 3600000) } // Last hour
      },
      select: { createdAt: true, startedAt: true }
    });

    if (recent.length === 0) return 0;

    const waits = recent
      .filter(e => e.startedAt)
      .map(e => (e.startedAt!.getTime() - e.createdAt.getTime()) / 1000);

    return Math.round(waits.reduce((a, b) => a + b, 0) / waits.length);
  }

  private async calculateProcessingRate(organizationId: string): Promise<number> {
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const completed = await this.prisma.workflowExecution.count({
      where: {
        organizationId,
        completedAt: { gte: oneMinuteAgo }
      }
    });
    return completed;
  }
}
```

### Alert Service Implementation

```typescript
// src/modules/wfa/services/alert.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { NotificationService } from '@/common/notification/notification.service';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private cooldowns: Map<string, Date> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService
  ) {}

  async createAlert(
    input: CreateAlertInput,
    userId: string,
    organizationId: string
  ): Promise<MonitoringAlert> {
    return this.prisma.monitoringAlert.create({
      data: {
        workflowId: input.workflowId,
        organizationId,
        alertType: input.alertType,
        alertName: input.alertName,
        conditions: input.conditions,
        notificationChannels: input.notificationChannels,
        cooldownMinutes: input.cooldownMinutes,
        isActive: true,
        createdBy: userId
      }
    });
  }

  async checkAlerts(event: ExecutionEvent): Promise<void> {
    const alerts = await this.prisma.monitoringAlert.findMany({
      where: {
        organizationId: event.organizationId,
        isActive: true,
        OR: [
          { workflowId: event.workflowId },
          { workflowId: null } // Global alerts
        ]
      }
    });

    for (const alert of alerts) {
      if (this.shouldTriggerAlert(alert, event)) {
        await this.triggerAlert(alert, event);
      }
    }
  }

  private shouldTriggerAlert(alert: MonitoringAlert, event: ExecutionEvent): boolean {
    // Check cooldown
    const cooldownKey = `${alert.id}:${event.workflowId}`;
    const lastTriggered = this.cooldowns.get(cooldownKey);
    if (lastTriggered) {
      const cooldownEnd = new Date(lastTriggered.getTime() + alert.cooldownMinutes * 60000);
      if (new Date() < cooldownEnd) {
        return false;
      }
    }

    // Check conditions based on alert type
    switch (alert.alertType) {
      case 'execution_failed':
        return event.status === 'failed';

      case 'consecutive_failures':
        return this.checkConsecutiveFailures(alert, event);

      case 'slow_execution':
        return this.checkSlowExecution(alert, event);

      case 'high_error_rate':
        return this.checkHighErrorRate(alert, event);

      default:
        return this.evaluateCustomConditions(alert.conditions, event);
    }
  }

  private async checkConsecutiveFailures(
    alert: MonitoringAlert,
    event: ExecutionEvent
  ): Promise<boolean> {
    if (event.status !== 'failed') return false;

    const threshold = alert.conditions[0]?.consecutiveCount || 3;

    const recentExecutions = await this.prisma.workflowExecution.findMany({
      where: { workflowId: event.workflowId },
      orderBy: { createdAt: 'desc' },
      take: threshold
    });

    return recentExecutions.every(e => e.status === 'failed');
  }

  private checkSlowExecution(alert: MonitoringAlert, event: ExecutionEvent): boolean {
    if (event.status !== 'completed' || !event.duration) return false;

    const threshold = alert.conditions.find(c => c.metric === 'duration')?.threshold;
    return threshold ? event.duration > threshold : false;
  }

  private async checkHighErrorRate(
    alert: MonitoringAlert,
    event: ExecutionEvent
  ): Promise<boolean> {
    const windowMinutes = alert.conditions[0]?.timeWindowMinutes || 60;
    const threshold = alert.conditions[0]?.threshold || 0.1;

    const since = new Date(Date.now() - windowMinutes * 60000);
    const executions = await this.prisma.workflowExecution.findMany({
      where: {
        workflowId: event.workflowId,
        completedAt: { gte: since }
      }
    });

    if (executions.length < 10) return false; // Need minimum sample

    const errorRate = executions.filter(e => e.status === 'failed').length / executions.length;
    return errorRate > threshold;
  }

  private evaluateCustomConditions(conditions: AlertCondition[], event: any): boolean {
    return conditions.every(condition => {
      const value = event[condition.metric];
      switch (condition.operator) {
        case 'gt': return value > condition.threshold;
        case 'gte': return value >= condition.threshold;
        case 'lt': return value < condition.threshold;
        case 'lte': return value <= condition.threshold;
        case 'eq': return value === condition.threshold;
        case 'ne': return value !== condition.threshold;
        default: return false;
      }
    });
  }

  private async triggerAlert(alert: MonitoringAlert, event: ExecutionEvent): Promise<void> {
    // Record cooldown
    const cooldownKey = `${alert.id}:${event.workflowId}`;
    this.cooldowns.set(cooldownKey, new Date());

    // Create alert history record
    const alertRecord = await this.prisma.alertHistory.create({
      data: {
        alertId: alert.id,
        workflowId: event.workflowId,
        executionId: event.executionId,
        organizationId: alert.organizationId,
        severity: this.determineSeverity(alert, event),
        message: this.formatAlertMessage(alert, event),
        context: { event },
        status: 'active',
        triggeredAt: new Date()
      }
    });

    // Send notifications
    for (const channel of alert.notificationChannels) {
      await this.notificationService.send({
        channel: channel.type,
        config: channel.config,
        subject: `[${alertRecord.severity.toUpperCase()}] ${alert.alertName}`,
        message: alertRecord.message,
        metadata: {
          alertId: alert.id,
          alertHistoryId: alertRecord.id,
          workflowId: event.workflowId,
          executionId: event.executionId
        }
      });
    }

    this.logger.warn(`Alert triggered: ${alert.alertName} for workflow ${event.workflowId}`);
  }

  private determineSeverity(alert: MonitoringAlert, event: ExecutionEvent): AlertSeverity {
    // Customize based on conditions
    if (alert.alertType === 'execution_failed') return 'error';
    if (alert.alertType === 'consecutive_failures') return 'critical';
    if (alert.alertType === 'high_error_rate') return 'critical';
    return 'warning';
  }

  private formatAlertMessage(alert: MonitoringAlert, event: ExecutionEvent): string {
    const messages: Record<string, string> = {
      execution_failed: `Workflow "${event.workflowName}" nie powiódł się. Execution ID: ${event.executionId}`,
      consecutive_failures: `Workflow "${event.workflowName}" zanotował serię niepowodzeń`,
      slow_execution: `Workflow "${event.workflowName}" wykonał się wolniej niż oczekiwano (${event.duration}ms)`,
      high_error_rate: `Workflow "${event.workflowName}" ma wysoki współczynnik błędów`,
      queue_backlog: 'Wykryto zaległości w kolejce wykonań workflow'
    };

    return messages[alert.alertType] || `Alert: ${alert.alertName}`;
  }

  async acknowledgeAlert(alertHistoryId: string, userId: string): Promise<void> {
    await this.prisma.alertHistory.update({
      where: { id: alertHistoryId },
      data: {
        status: 'acknowledged',
        acknowledgedBy: userId,
        acknowledgedAt: new Date()
      }
    });
  }

  async resolveAlert(alertHistoryId: string): Promise<void> {
    await this.prisma.alertHistory.update({
      where: { id: alertHistoryId },
      data: {
        status: 'resolved',
        resolvedAt: new Date()
      }
    });
  }
}
```

### WebSocket Gateway for Real-Time Updates

```typescript
// src/modules/wfa/gateways/monitoring.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { MonitoringService } from '../services/monitoring.service';
import { AuthService } from '@/modules/auth/auth.service';

@WebSocketGateway({
  namespace: '/monitoring',
  cors: { origin: '*' }
})
export class MonitoringGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MonitoringGateway.name);

  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly authService: AuthService
  ) {}

  afterInit(server: Server) {
    this.monitoringService.setSocketServer(server);
    this.logger.log('Monitoring WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      const user = await this.authService.validateToken(token);

      if (!user) {
        client.disconnect();
        return;
      }

      client.data.userId = user.id;
      client.data.organizationId = user.organizationId;

      // Join organization room for global updates
      client.join(`org:${user.organizationId}`);

      this.logger.log(`Client connected: ${client.id}`);
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:workflow')
  handleWorkflowSubscription(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workflowId: string }
  ) {
    client.join(`workflow:${data.workflowId}`);
    this.logger.debug(`Client ${client.id} subscribed to workflow ${data.workflowId}`);
    return { success: true };
  }

  @SubscribeMessage('subscribe:execution')
  handleExecutionSubscription(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { executionId: string }
  ) {
    client.join(`execution:${data.executionId}`);
    this.logger.debug(`Client ${client.id} subscribed to execution ${data.executionId}`);
    return { success: true };
  }

  @SubscribeMessage('unsubscribe:workflow')
  handleWorkflowUnsubscription(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { workflowId: string }
  ) {
    client.leave(`workflow:${data.workflowId}`);
    return { success: true };
  }

  @SubscribeMessage('unsubscribe:execution')
  handleExecutionUnsubscription(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { executionId: string }
  ) {
    client.leave(`execution:${data.executionId}`);
    return { success: true };
  }

  @SubscribeMessage('get:execution:status')
  async handleGetExecutionStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { executionId: string }
  ) {
    const status = await this.monitoringService.getExecutionStatus(data.executionId);
    return { success: true, data: status };
  }

  @SubscribeMessage('get:queue:status')
  async handleGetQueueStatus(@ConnectedSocket() client: Socket) {
    const status = await this.monitoringService.getQueueStatus(
      client.data.organizationId
    );
    return { success: true, data: status };
  }
}
```

---

## API Endpoints

```typescript
// tRPC Router
export const monitoringRouter = createTRPCRouter({
  // Real-time status
  getExecutionStatus: protectedProcedure
    .input(z.object({ executionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.monitoringService.getExecutionStatus(input.executionId);
    }),

  getActiveExecutions: protectedProcedure
    .input(z.object({
      workflowId: z.string().uuid().optional(),
      limit: z.number().min(1).max(100).default(20)
    }))
    .query(async ({ ctx, input }) => {
      return ctx.monitoringService.getActiveExecutions(
        ctx.organizationId,
        input.workflowId,
        input.limit
      );
    }),

  // Metrics
  getWorkflowMetrics: protectedProcedure
    .input(metricsQuerySchema.extend({ workflowId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.monitoringService.getWorkflowMetrics(input.workflowId, input);
    }),

  getSystemMetrics: protectedProcedure
    .input(z.object({
      startTime: z.string().datetime(),
      endTime: z.string().datetime()
    }))
    .query(async ({ ctx, input }) => {
      return ctx.monitoringService.getSystemMetrics(ctx.organizationId, input);
    }),

  // Queue
  getQueueStatus: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.monitoringService.getQueueStatus(ctx.organizationId);
    }),

  // Alerts
  createAlert: protectedProcedure
    .input(createAlertSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.alertService.createAlert(input, ctx.user.id, ctx.organizationId);
    }),

  getAlerts: protectedProcedure
    .input(z.object({
      workflowId: z.string().uuid().optional(),
      isActive: z.boolean().optional()
    }))
    .query(async ({ ctx, input }) => {
      return ctx.alertService.getAlerts(ctx.organizationId, input);
    }),

  updateAlert: protectedProcedure
    .input(z.object({
      alertId: z.string().uuid(),
      updates: createAlertSchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.alertService.updateAlert(input.alertId, input.updates);
    }),

  deleteAlert: protectedProcedure
    .input(z.object({ alertId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.alertService.deleteAlert(input.alertId);
    }),

  getAlertHistory: protectedProcedure
    .input(z.object({
      status: alertSeveritySchema.optional(),
      limit: z.number().min(1).max(100).default(50)
    }))
    .query(async ({ ctx, input }) => {
      return ctx.alertService.getAlertHistory(ctx.organizationId, input);
    }),

  acknowledgeAlert: protectedProcedure
    .input(z.object({ alertHistoryId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.alertService.acknowledgeAlert(input.alertHistoryId, ctx.user.id);
    }),

  // Dashboards
  createDashboard: protectedProcedure
    .input(createDashboardSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.dashboardService.create(input, ctx.user.id, ctx.organizationId);
    }),

  getDashboards: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.dashboardService.getUserDashboards(ctx.user.id);
    }),

  updateDashboard: protectedProcedure
    .input(z.object({
      dashboardId: z.string().uuid(),
      updates: createDashboardSchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.dashboardService.update(input.dashboardId, input.updates);
    })
});
```

---

## Test Specifications

### Unit Tests

```typescript
describe('MonitoringService', () => {
  describe('getExecutionStatus', () => {
    it('should return real-time execution status with progress', async () => {
      const execution = await createTestExecution({
        status: 'running',
        stepCount: 10,
        completedSteps: 5
      });

      const status = await monitoringService.getExecutionStatus(execution.id);

      expect(status.status).toBe('running');
      expect(status.progress).toBe(50);
      expect(status.currentStep).toBeDefined();
      expect(status.steps).toHaveLength(10);
    });

    it('should calculate duration for running execution', async () => {
      const execution = await createTestExecution({
        status: 'running',
        startedAt: new Date(Date.now() - 30000) // 30 seconds ago
      });

      const status = await monitoringService.getExecutionStatus(execution.id);

      expect(status.duration).toBeGreaterThanOrEqual(30000);
      expect(status.duration).toBeLessThan(35000);
    });
  });

  describe('getWorkflowMetrics', () => {
    it('should calculate success rate correctly', async () => {
      await createTestExecutions({
        workflowId: testWorkflowId,
        successful: 8,
        failed: 2
      });

      const metrics = await monitoringService.getWorkflowMetrics(testWorkflowId, {
        startTime: oneHourAgo,
        endTime: now
      });

      expect(metrics.successRate).toBe(80);
      expect(metrics.totalExecutions).toBe(10);
    });

    it('should calculate percentiles correctly', async () => {
      await createTestExecutionsWithDurations([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);

      const metrics = await monitoringService.getWorkflowMetrics(testWorkflowId, timeRange);

      expect(metrics.percentiles.p50).toBe(500);
      expect(metrics.percentiles.p95).toBe(950);
    });
  });

  describe('getQueueStatus', () => {
    it('should return correct queue counts', async () => {
      await createPendingExecutions(10, 'HIGH');
      await createPendingExecutions(20, 'NORMAL');
      await createPendingExecutions(5, 'LOW');

      const status = await monitoringService.getQueueStatus(organizationId);

      expect(status.pendingCount).toBe(35);
      expect(status.pendingByPriority.HIGH).toBe(10);
      expect(status.pendingByPriority.NORMAL).toBe(20);
      expect(status.pendingByPriority.LOW).toBe(5);
    });
  });
});

describe('AlertService', () => {
  describe('checkAlerts', () => {
    it('should trigger alert on execution failure', async () => {
      const alert = await createTestAlert({
        alertType: 'execution_failed',
        workflowId: testWorkflowId
      });

      await alertService.checkAlerts({
        workflowId: testWorkflowId,
        status: 'failed',
        executionId: 'exec-123'
      });

      const history = await prisma.alertHistory.findFirst({
        where: { alertId: alert.id }
      });

      expect(history).toBeDefined();
      expect(history.status).toBe('active');
    });

    it('should respect cooldown period', async () => {
      const alert = await createTestAlert({
        alertType: 'execution_failed',
        cooldownMinutes: 15
      });

      // First trigger
      await alertService.checkAlerts({ ...failedEvent, executionId: 'exec-1' });

      // Second trigger within cooldown - should not create new alert
      await alertService.checkAlerts({ ...failedEvent, executionId: 'exec-2' });

      const historyCount = await prisma.alertHistory.count({
        where: { alertId: alert.id }
      });

      expect(historyCount).toBe(1);
    });

    it('should trigger consecutive failures alert', async () => {
      const alert = await createTestAlert({
        alertType: 'consecutive_failures',
        conditions: [{ consecutiveCount: 3 }]
      });

      // Create 3 failed executions
      await createFailedExecutions(3);

      await alertService.checkAlerts(failedEvent);

      const history = await prisma.alertHistory.findFirst({
        where: { alertId: alert.id }
      });

      expect(history).toBeDefined();
      expect(history.severity).toBe('critical');
    });
  });
});
```

### Integration Tests

```typescript
describe('Monitoring WebSocket Integration', () => {
  let socket: Socket;

  beforeEach(async () => {
    socket = io('http://localhost:3000/monitoring', {
      auth: { token: validAuthToken }
    });
    await waitForConnection(socket);
  });

  afterEach(() => {
    socket.disconnect();
  });

  it('should receive real-time execution updates', async () => {
    const received: any[] = [];

    socket.emit('subscribe:execution', { executionId: testExecutionId });
    socket.on('execution:update', (data) => received.push(data));

    // Simulate execution progress
    await simulateExecutionProgress(testExecutionId);

    await wait(1000);

    expect(received.length).toBeGreaterThan(0);
    expect(received[0]).toHaveProperty('status');
    expect(received[0]).toHaveProperty('progress');
  });

  it('should receive step completion updates', async () => {
    const received: any[] = [];

    socket.emit('subscribe:execution', { executionId: testExecutionId });
    socket.on('step:update', (data) => received.push(data));

    await completeExecutionStep(testExecutionId, 'step-1');

    await wait(500);

    expect(received).toContainEqual(
      expect.objectContaining({
        stepId: 'step-1',
        status: 'completed'
      })
    );
  });
});

describe('Dashboard and Metrics Integration', () => {
  it('should return consistent metrics across endpoints', async () => {
    // Create test data
    await createTestExecutions(100);

    // Get metrics via tRPC
    const trpcMetrics = await caller.getWorkflowMetrics({
      workflowId: testWorkflowId,
      startTime: oneHourAgo,
      endTime: now
    });

    // Get metrics via REST (if applicable)
    const restMetrics = await fetch(
      `/api/monitoring/workflows/${testWorkflowId}/metrics?start=${oneHourAgo}&end=${now}`
    ).then(r => r.json());

    expect(trpcMetrics.totalExecutions).toBe(restMetrics.totalExecutions);
    expect(trpcMetrics.successRate).toBeCloseTo(restMetrics.successRate, 2);
  });
});
```

---

## Security Checklist

- [x] WebSocket connections require authentication
- [x] RLS policies prevent cross-organization data access
- [x] Alert configurations restricted to authorized users
- [x] Sensitive execution data sanitized in logs
- [x] Rate limiting on WebSocket subscriptions
- [x] Dashboard access restricted to creators and admins
- [x] Alert notification channels validated
- [x] Metrics data retention policy enforced

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `monitoring.alert.created` | Alert rule created | alertId, alertType, conditions |
| `monitoring.alert.triggered` | Alert condition met | alertId, executionId, severity |
| `monitoring.alert.acknowledged` | Alert acknowledged | alertHistoryId, userId |
| `monitoring.alert.resolved` | Alert resolved | alertHistoryId |
| `monitoring.dashboard.created` | Dashboard created | dashboardId, widgets |
| `monitoring.dashboard.updated` | Dashboard modified | dashboardId, changes |
| `monitoring.subscription.created` | WebSocket subscription | userId, subscriptionType |

---

## Implementation Notes

### Dependencies
- WFA-003 (Scheduled Execution) - provides execution events
- WFA-004 (Error Handling) - provides error events for alerts

### Performance Considerations
- Metrics aggregation should use materialized views for large datasets
- WebSocket rooms limit concurrent subscriptions per user
- Queue status caching reduces database load
- Consider time-series database for high-volume metrics

### Polish Accounting Context
- Alert messages in Polish for end users
- Monitoring dashboard default widgets include Polish tax deadlines
- Queue monitoring includes priority for tax-related workflows

---

*Last Updated: December 2024*
