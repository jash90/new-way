# WFA-002: Trigger Configuration

> **Story ID**: WFA-002
> **Epic**: Workflow Automation Engine (WFA)
> **Priority**: P0 (Critical)
> **Points**: 8
> **Status**: 📋 Ready for Development
> **Sprint**: Phase 5, Week 17

---

## 📋 User Story

**As an** accountant,
**I want** to configure various trigger types for workflows,
**So that** automation processes start automatically when specific conditions are met.

---

## ✅ Acceptance Criteria

### Scenario 1: Manual Trigger
```gherkin
Given I have a workflow with a manual trigger
When I click the "Run Workflow" button
Then the workflow should start immediately
And I should see a confirmation message
And the execution should be visible in the monitoring panel
```

### Scenario 2: Scheduled Trigger
```gherkin
Given I configure a scheduled trigger for a workflow
When I set the schedule using cron expression or visual builder
Then I should see the next execution time preview
And the workflow should execute at the scheduled time
And timezone should be correctly handled (Europe/Warsaw default)
```

### Scenario 3: Webhook Trigger
```gherkin
Given I configure a webhook trigger
When I save the workflow
Then I should receive a unique webhook URL
And the URL should support authentication options (none, basic, bearer)
When an HTTP request is sent to this URL
Then the workflow should trigger with the request payload as input
```

### Scenario 4: Event Trigger
```gherkin
Given I configure an event trigger
When I select an event type from the available list:
  - client.created
  - document.uploaded
  - invoice.processed
  - payment.received
  - deadline.approaching
Then the workflow should trigger when that event occurs in the system
And event data should be available as workflow input
```

### Scenario 5: Document Trigger
```gherkin
Given I configure a document upload trigger
When I specify:
  - Document types (INVOICE, RECEIPT, CONTRACT)
  - Minimum confidence score (0.8 default)
  - Client filter (optional)
Then the workflow should trigger on matching document uploads
And document metadata should be available in the workflow
```

### Scenario 6: Threshold Trigger
```gherkin
Given I configure a threshold trigger
When I set:
  - Field to monitor (e.g., invoice_amount)
  - Threshold value (e.g., 15000 PLN)
  - Comparison operator (>, >=, <, <=, ==)
Then the workflow should trigger when the threshold is crossed
And this should apply to White List verification requirements
```

### Scenario 7: Deadline Trigger
```gherkin
Given I configure a deadline trigger
When I set:
  - Deadline type (VAT_FILING, JPK_SUBMISSION, etc.)
  - Days before deadline (e.g., 7, 3, 1)
  - Client filter (optional)
Then the workflow should trigger at the specified days before deadline
And deadline details should be available as workflow input
```

### Scenario 8: Trigger Testing
```gherkin
Given I have configured any trigger type
When I click the "Test Trigger" button
Then the system should simulate the trigger
And show me what data would be passed to the workflow
And allow me to start a test execution with sample data
```

---

## 🔧 Technical Specification

### Database Schema

```sql
-- Workflow triggers
CREATE TABLE workflow_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

    -- Trigger type
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN (
        'manual', 'scheduled', 'webhook', 'event',
        'document', 'threshold', 'deadline', 'api'
    )),

    -- Trigger configuration
    config JSONB NOT NULL DEFAULT '{}',

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- For webhooks
    webhook_url VARCHAR(500) UNIQUE,
    webhook_secret VARCHAR(255),

    -- For scheduled
    cron_expression VARCHAR(100),
    next_execution_at TIMESTAMPTZ,
    last_execution_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scheduled trigger jobs
CREATE TABLE trigger_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_id UUID NOT NULL REFERENCES workflow_triggers(id) ON DELETE CASCADE,

    -- Schedule details
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Warsaw',

    -- Execution tracking
    next_run_at TIMESTAMPTZ NOT NULL,
    last_run_at TIMESTAMPTZ,
    last_run_status VARCHAR(20),

    -- Holiday/weekend handling
    skip_weekends BOOLEAN DEFAULT false,
    skip_holidays BOOLEAN DEFAULT false,
    holiday_calendar VARCHAR(50) DEFAULT 'PL', -- Polish holidays

    -- Overlap prevention
    allow_overlap BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event subscriptions
CREATE TABLE trigger_event_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_id UUID NOT NULL REFERENCES workflow_triggers(id) ON DELETE CASCADE,

    -- Event details
    event_type VARCHAR(100) NOT NULL,
    event_source VARCHAR(100), -- Module that emits event

    -- Filters
    filter_conditions JSONB DEFAULT '{}',

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook requests log
CREATE TABLE webhook_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_id UUID NOT NULL REFERENCES workflow_triggers(id),

    -- Request details
    method VARCHAR(10) NOT NULL,
    headers JSONB NOT NULL DEFAULT '{}',
    body JSONB,
    query_params JSONB DEFAULT '{}',

    -- Response
    response_status INTEGER,
    response_body JSONB,

    -- Processing
    processed_at TIMESTAMPTZ,
    execution_id UUID REFERENCES workflow_executions(id),
    error_message TEXT,

    -- Metadata
    ip_address INET,
    user_agent TEXT,

    -- Timestamps
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deadline configurations
CREATE TABLE trigger_deadlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_id UUID NOT NULL REFERENCES workflow_triggers(id) ON DELETE CASCADE,

    -- Deadline type
    deadline_type VARCHAR(50) NOT NULL CHECK (deadline_type IN (
        'VAT_FILING', 'JPK_V7M', 'JPK_V7K', 'CIT_ADVANCE',
        'PIT_ADVANCE', 'ZUS_DRA', 'ANNUAL_CIT', 'ANNUAL_PIT',
        'FINANCIAL_STATEMENTS', 'CUSTOM'
    )),

    -- Alert configuration
    days_before INTEGER[] NOT NULL DEFAULT '{7, 3, 1}',

    -- Filters
    client_filter JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_triggers_workflow ON workflow_triggers(workflow_id);
CREATE INDEX idx_triggers_type ON workflow_triggers(trigger_type);
CREATE INDEX idx_triggers_webhook_url ON workflow_triggers(webhook_url) WHERE webhook_url IS NOT NULL;
CREATE INDEX idx_schedules_next_run ON trigger_schedules(next_run_at) WHERE next_run_at IS NOT NULL;
CREATE INDEX idx_event_subs_event ON trigger_event_subscriptions(event_type);
CREATE INDEX idx_webhook_requests_trigger ON webhook_requests(trigger_id);
CREATE INDEX idx_webhook_requests_received ON webhook_requests(received_at);

-- RLS Policies
ALTER TABLE workflow_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trigger_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE trigger_event_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE trigger_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY triggers_org_isolation ON workflow_triggers
    USING (workflow_id IN (
        SELECT id FROM workflows
        WHERE organization_id = current_setting('app.current_organization_id')::UUID
    ));
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Base trigger schema
export const baseTriggerSchema = z.object({
  workflowId: z.string().uuid(),
  isActive: z.boolean().default(true)
});

// Manual trigger
export const manualTriggerSchema = baseTriggerSchema.extend({
  triggerType: z.literal('manual'),
  config: z.object({
    requireConfirmation: z.boolean().default(true),
    confirmationMessage: z.string().optional()
  })
});

// Scheduled trigger
export const scheduledTriggerSchema = baseTriggerSchema.extend({
  triggerType: z.literal('scheduled'),
  config: z.object({
    cronExpression: z.string()
      .regex(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/,
        'Nieprawidłowe wyrażenie cron'),
    timezone: z.string().default('Europe/Warsaw'),
    skipWeekends: z.boolean().default(false),
    skipHolidays: z.boolean().default(false),
    holidayCalendar: z.enum(['PL', 'EU']).default('PL'),
    allowOverlap: z.boolean().default(false)
  })
});

// Visual schedule builder (alternative to cron)
export const visualScheduleSchema = z.object({
  type: z.enum(['once', 'daily', 'weekly', 'monthly', 'custom']),
  time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Nieprawidłowy format czasu'),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(), // 0=Sunday
  daysOfMonth: z.array(z.number().min(1).max(31)).optional(),
  months: z.array(z.number().min(1).max(12)).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

// Webhook trigger
export const webhookTriggerSchema = baseTriggerSchema.extend({
  triggerType: z.literal('webhook'),
  config: z.object({
    method: z.enum(['GET', 'POST', 'PUT']).default('POST'),
    authentication: z.enum(['none', 'basic', 'bearer', 'api_key']).default('none'),
    authConfig: z.object({
      username: z.string().optional(),
      password: z.string().optional(),
      token: z.string().optional(),
      apiKeyHeader: z.string().optional(),
      apiKeyValue: z.string().optional()
    }).optional(),
    allowedIps: z.array(z.string()).optional(),
    rateLimitPerMinute: z.number().min(1).max(1000).default(60),
    validatePayload: z.boolean().default(true),
    payloadSchema: z.record(z.unknown()).optional()
  })
});

// Event trigger
export const eventTriggerSchema = baseTriggerSchema.extend({
  triggerType: z.literal('event'),
  config: z.object({
    eventType: z.enum([
      'client.created',
      'client.updated',
      'document.uploaded',
      'document.processed',
      'invoice.created',
      'invoice.approved',
      'payment.received',
      'payment.sent',
      'deadline.approaching',
      'tax.calculated',
      'jpk.generated',
      'error.occurred'
    ]),
    filters: z.object({
      clientId: z.string().uuid().optional(),
      documentType: z.array(z.string()).optional(),
      minAmount: z.number().optional(),
      maxAmount: z.number().optional(),
      tags: z.array(z.string()).optional()
    }).optional()
  })
});

// Document trigger
export const documentTriggerSchema = baseTriggerSchema.extend({
  triggerType: z.literal('document'),
  config: z.object({
    documentTypes: z.array(z.enum([
      'INVOICE', 'RECEIPT', 'CONTRACT', 'BANK_STATEMENT',
      'TAX_DECLARATION', 'PAYROLL', 'CORRESPONDENCE', 'OTHER'
    ])).min(1, 'Wybierz co najmniej jeden typ dokumentu'),
    minConfidence: z.number().min(0).max(1).default(0.8),
    clientFilter: z.string().uuid().optional(),
    tagFilter: z.array(z.string()).optional(),
    onlyNewDocuments: z.boolean().default(true)
  })
});

// Threshold trigger
export const thresholdTriggerSchema = baseTriggerSchema.extend({
  triggerType: z.literal('threshold'),
  config: z.object({
    field: z.enum([
      'invoice_amount', 'payment_amount', 'account_balance',
      'outstanding_receivables', 'outstanding_payables',
      'daily_transactions', 'vat_due'
    ]),
    operator: z.enum(['>', '>=', '<', '<=', '==']),
    value: z.number(),
    currency: z.enum(['PLN', 'EUR', 'USD', 'GBP']).default('PLN'),
    aggregation: z.enum(['single', 'daily', 'weekly', 'monthly']).default('single'),
    clientFilter: z.string().uuid().optional(),
    // Special handling for White List requirement (>15,000 PLN)
    whiteListCheck: z.boolean().default(false)
  })
});

// Deadline trigger
export const deadlineTriggerSchema = baseTriggerSchema.extend({
  triggerType: z.literal('deadline'),
  config: z.object({
    deadlineType: z.enum([
      'VAT_FILING',      // 25th of month
      'JPK_V7M',         // 25th of month
      'JPK_V7K',         // 25th after quarter
      'CIT_ADVANCE',     // 20th of month
      'PIT_ADVANCE',     // 20th of month
      'ZUS_DRA',         // 15th/20th of month
      'ANNUAL_CIT',      // March 31
      'ANNUAL_PIT',      // April 30
      'FINANCIAL_STATEMENTS', // June 30
      'CUSTOM'
    ]),
    daysBefore: z.array(z.number().min(1).max(30)).default([7, 3, 1]),
    customDeadline: z.string().datetime().optional(), // For CUSTOM type
    clientFilter: z.string().uuid().optional(),
    excludeClients: z.array(z.string().uuid()).optional(),
    notifyTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).default('09:00')
  })
});

// Union of all trigger types
export const triggerSchema = z.discriminatedUnion('triggerType', [
  manualTriggerSchema,
  scheduledTriggerSchema,
  webhookTriggerSchema,
  eventTriggerSchema,
  documentTriggerSchema,
  thresholdTriggerSchema,
  deadlineTriggerSchema
]);

// Trigger test input
export const testTriggerSchema = z.object({
  triggerId: z.string().uuid(),
  testData: z.record(z.unknown()).optional(),
  executeWorkflow: z.boolean().default(false)
});
```

### Service Implementation

```typescript
// src/server/services/trigger.service.ts
import { TRPCError } from '@trpc/server';
import { db } from '@/server/db';
import { eq, and } from 'drizzle-orm';
import {
  workflowTriggers,
  triggerSchedules,
  triggerEventSubscriptions,
  triggerDeadlines,
  webhookRequests
} from '@/server/db/schema';
import { triggerSchema, testTriggerSchema } from './trigger.schemas';
import { CronParser } from './cron-parser';
import { EventBus } from './event-bus';
import { SchedulerService } from './scheduler.service';
import { auditLog } from '@/server/services/audit.service';
import crypto from 'crypto';

export class TriggerService {
  private cronParser: CronParser;
  private eventBus: EventBus;
  private scheduler: SchedulerService;

  constructor() {
    this.cronParser = new CronParser();
    this.eventBus = EventBus.getInstance();
    this.scheduler = new SchedulerService();
  }

  /**
   * Create a trigger for a workflow
   */
  async create(
    input: z.infer<typeof triggerSchema>,
    context: { userId: string; organizationId: string }
  ) {
    const validated = triggerSchema.parse(input);

    // Verify workflow ownership
    await this.verifyWorkflowAccess(validated.workflowId, context);

    // Type-specific processing
    let additionalData: Record<string, unknown> = {};

    switch (validated.triggerType) {
      case 'webhook':
        additionalData = {
          webhookUrl: this.generateWebhookUrl(validated.workflowId),
          webhookSecret: this.generateWebhookSecret()
        };
        break;

      case 'scheduled':
        additionalData = {
          cronExpression: validated.config.cronExpression,
          nextExecutionAt: this.cronParser.getNextExecution(
            validated.config.cronExpression,
            validated.config.timezone
          )
        };
        break;
    }

    // Create trigger
    const [trigger] = await db.insert(workflowTriggers).values({
      workflowId: validated.workflowId,
      triggerType: validated.triggerType,
      config: validated.config,
      isActive: validated.isActive,
      ...additionalData
    }).returning();

    // Type-specific setup
    await this.setupTriggerType(trigger, validated, context);

    // Audit log
    await auditLog({
      action: 'trigger.created',
      entityType: 'workflow_trigger',
      entityId: trigger.id,
      userId: context.userId,
      organizationId: context.organizationId,
      details: { triggerType: validated.triggerType }
    });

    return trigger;
  }

  /**
   * Setup type-specific trigger components
   */
  private async setupTriggerType(
    trigger: typeof workflowTriggers.$inferSelect,
    input: z.infer<typeof triggerSchema>,
    context: { userId: string; organizationId: string }
  ) {
    switch (input.triggerType) {
      case 'scheduled':
        await db.insert(triggerSchedules).values({
          triggerId: trigger.id,
          cronExpression: input.config.cronExpression,
          timezone: input.config.timezone,
          nextRunAt: this.cronParser.getNextExecution(
            input.config.cronExpression,
            input.config.timezone
          ),
          skipWeekends: input.config.skipWeekends,
          skipHolidays: input.config.skipHolidays,
          holidayCalendar: input.config.holidayCalendar,
          allowOverlap: input.config.allowOverlap
        });

        // Register with scheduler
        await this.scheduler.registerTrigger(trigger.id);
        break;

      case 'event':
        await db.insert(triggerEventSubscriptions).values({
          triggerId: trigger.id,
          eventType: input.config.eventType,
          filterConditions: input.config.filters || {}
        });

        // Subscribe to event bus
        this.eventBus.subscribe(input.config.eventType, trigger.id);
        break;

      case 'deadline':
        await db.insert(triggerDeadlines).values({
          triggerId: trigger.id,
          deadlineType: input.config.deadlineType,
          daysBefore: input.config.daysBefore,
          clientFilter: input.config.clientFilter ? { clientId: input.config.clientFilter } : {}
        });

        // Register with deadline monitor
        await this.scheduler.registerDeadlineTrigger(trigger.id);
        break;
    }
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(
    webhookUrl: string,
    request: {
      method: string;
      headers: Record<string, string>;
      body: unknown;
      queryParams: Record<string, string>;
      ipAddress: string;
      userAgent: string;
    }
  ) {
    // Find trigger by webhook URL
    const trigger = await db.query.workflowTriggers.findFirst({
      where: and(
        eq(workflowTriggers.webhookUrl, webhookUrl),
        eq(workflowTriggers.isActive, true)
      )
    });

    if (!trigger) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Webhook nie znaleziony'
      });
    }

    // Validate authentication
    await this.validateWebhookAuth(trigger, request.headers);

    // Validate IP if configured
    const config = trigger.config as z.infer<typeof webhookTriggerSchema>['config'];
    if (config.allowedIps?.length > 0) {
      if (!config.allowedIps.includes(request.ipAddress)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'IP nie jest dozwolony'
        });
      }
    }

    // Log webhook request
    const [webhookRequest] = await db.insert(webhookRequests).values({
      triggerId: trigger.id,
      method: request.method,
      headers: request.headers,
      body: request.body,
      queryParams: request.queryParams,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent
    }).returning();

    // Start workflow execution
    try {
      const execution = await this.executeWorkflow(trigger.workflowId, {
        triggerType: 'webhook',
        triggerId: trigger.id,
        webhookData: {
          method: request.method,
          headers: request.headers,
          body: request.body,
          queryParams: request.queryParams
        }
      });

      // Update webhook request with execution ID
      await db.update(webhookRequests)
        .set({
          executionId: execution.id,
          processedAt: new Date()
        })
        .where(eq(webhookRequests.id, webhookRequest.id));

      return { success: true, executionId: execution.id };

    } catch (error) {
      await db.update(webhookRequests)
        .set({
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          processedAt: new Date()
        })
        .where(eq(webhookRequests.id, webhookRequest.id));

      throw error;
    }
  }

  /**
   * Test trigger with sample data
   */
  async testTrigger(
    input: z.infer<typeof testTriggerSchema>,
    context: { userId: string; organizationId: string }
  ) {
    const trigger = await this.getById(input.triggerId, context);

    // Generate sample data based on trigger type
    const sampleData = input.testData || this.generateSampleData(trigger);

    // Preview what would be passed to workflow
    const preview = {
      triggerType: trigger.triggerType,
      triggerId: trigger.id,
      timestamp: new Date().toISOString(),
      data: sampleData
    };

    if (input.executeWorkflow) {
      // Actually execute the workflow with test data
      const execution = await this.executeWorkflow(trigger.workflowId, {
        ...preview,
        isTest: true
      });

      return {
        preview,
        executionId: execution.id,
        message: 'Workflow uruchomiony w trybie testowym'
      };
    }

    return {
      preview,
      executionId: null,
      message: 'Podgląd danych wejściowych (workflow nie został uruchomiony)'
    };
  }

  /**
   * Get next execution times for scheduled trigger
   */
  async getNextExecutions(
    triggerId: string,
    count: number = 5,
    context: { userId: string; organizationId: string }
  ) {
    const trigger = await this.getById(triggerId, context);

    if (trigger.triggerType !== 'scheduled') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Tylko zaplanowane triggery mają harmonogram'
      });
    }

    const schedule = await db.query.triggerSchedules.findFirst({
      where: eq(triggerSchedules.triggerId, triggerId)
    });

    if (!schedule) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Harmonogram nie znaleziony'
      });
    }

    return this.cronParser.getNextExecutions(
      schedule.cronExpression,
      schedule.timezone,
      count,
      {
        skipWeekends: schedule.skipWeekends,
        skipHolidays: schedule.skipHolidays,
        holidayCalendar: schedule.holidayCalendar
      }
    );
  }

  /**
   * Convert visual schedule to cron expression
   */
  visualScheduleToCron(schedule: z.infer<typeof visualScheduleSchema>): string {
    const [hour, minute] = schedule.time.split(':').map(Number);

    switch (schedule.type) {
      case 'daily':
        return `${minute} ${hour} * * *`;

      case 'weekly':
        const days = schedule.daysOfWeek?.join(',') || '1-5'; // Default weekdays
        return `${minute} ${hour} * * ${days}`;

      case 'monthly':
        const daysOfMonth = schedule.daysOfMonth?.join(',') || '1';
        return `${minute} ${hour} ${daysOfMonth} * *`;

      case 'once':
        // For one-time execution, we'll handle differently
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Jednorazowe wykonania nie używają wyrażeń cron'
        });

      default:
        return `${minute} ${hour} * * *`;
    }
  }

  // Private helper methods
  private generateWebhookUrl(workflowId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    return `/api/webhooks/${token}`;
  }

  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async validateWebhookAuth(
    trigger: typeof workflowTriggers.$inferSelect,
    headers: Record<string, string>
  ) {
    const config = trigger.config as z.infer<typeof webhookTriggerSchema>['config'];

    switch (config.authentication) {
      case 'basic':
        const authHeader = headers['authorization'];
        if (!authHeader?.startsWith('Basic ')) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Brak autoryzacji Basic' });
        }
        // Validate credentials...
        break;

      case 'bearer':
        const bearerToken = headers['authorization']?.replace('Bearer ', '');
        if (bearerToken !== config.authConfig?.token) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Nieprawidłowy token' });
        }
        break;

      case 'api_key':
        const apiKey = headers[config.authConfig?.apiKeyHeader?.toLowerCase() || 'x-api-key'];
        if (apiKey !== config.authConfig?.apiKeyValue) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Nieprawidłowy klucz API' });
        }
        break;
    }
  }

  private generateSampleData(
    trigger: typeof workflowTriggers.$inferSelect
  ): Record<string, unknown> {
    switch (trigger.triggerType) {
      case 'document':
        return {
          documentId: '00000000-0000-0000-0000-000000000000',
          documentType: 'INVOICE',
          fileName: 'faktura_test.pdf',
          confidence: 0.95,
          extractedData: {
            vendorNip: '1234567890',
            amount: 1230.00,
            vatAmount: 230.00,
            issueDate: '2024-01-15'
          }
        };

      case 'event':
        return {
          eventType: (trigger.config as any).eventType,
          timestamp: new Date().toISOString(),
          entityId: '00000000-0000-0000-0000-000000000000',
          data: {}
        };

      case 'deadline':
        return {
          deadlineType: (trigger.config as any).deadlineType,
          deadlineDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          daysRemaining: 7,
          clients: [
            { id: '00000000-0000-0000-0000-000000000000', name: 'Test Client' }
          ]
        };

      default:
        return { test: true, timestamp: new Date().toISOString() };
    }
  }

  private async executeWorkflow(
    workflowId: string,
    input: Record<string, unknown>
  ) {
    // Import workflow execution service
    const { WorkflowExecutionService } = await import('./workflow-execution.service');
    const executionService = new WorkflowExecutionService();

    return executionService.execute(workflowId, input);
  }

  private async getById(
    triggerId: string,
    context: { userId: string; organizationId: string }
  ) {
    const trigger = await db.query.workflowTriggers.findFirst({
      where: eq(workflowTriggers.id, triggerId),
      with: {
        workflow: true
      }
    });

    if (!trigger || trigger.workflow.organizationId !== context.organizationId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Trigger nie znaleziony'
      });
    }

    return trigger;
  }

  private async verifyWorkflowAccess(
    workflowId: string,
    context: { userId: string; organizationId: string }
  ) {
    const workflow = await db.query.workflows.findFirst({
      where: and(
        eq(workflows.id, workflowId),
        eq(workflows.organizationId, context.organizationId)
      )
    });

    if (!workflow) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Workflow nie znaleziony'
      });
    }

    return workflow;
  }
}
```

### tRPC Router

```typescript
// src/server/api/routers/trigger.router.ts
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/api/trpc';
import { TriggerService } from '@/server/services/trigger.service';
import {
  triggerSchema,
  testTriggerSchema,
  visualScheduleSchema
} from '@/server/services/trigger.schemas';
import { z } from 'zod';

const service = new TriggerService();

export const triggerRouter = createTRPCRouter({
  // Create trigger
  create: protectedProcedure
    .input(triggerSchema)
    .mutation(async ({ input, ctx }) => {
      return service.create(input, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Update trigger
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      config: z.record(z.unknown()),
      isActive: z.boolean().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      return service.update(input.id, input, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Delete trigger
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return service.delete(input.id, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Get trigger by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return service.getById(input.id, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Get triggers for workflow
  getByWorkflow: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return service.getByWorkflow(input.workflowId, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Test trigger
  test: protectedProcedure
    .input(testTriggerSchema)
    .mutation(async ({ input, ctx }) => {
      return service.testTrigger(input, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Get next scheduled executions
  getNextExecutions: protectedProcedure
    .input(z.object({
      triggerId: z.string().uuid(),
      count: z.number().min(1).max(20).default(5)
    }))
    .query(async ({ input, ctx }) => {
      return service.getNextExecutions(input.triggerId, input.count, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Convert visual schedule to cron
  visualToCron: protectedProcedure
    .input(visualScheduleSchema)
    .query(async ({ input }) => {
      return { cronExpression: service.visualScheduleToCron(input) };
    }),

  // Parse cron expression for preview
  parseCron: protectedProcedure
    .input(z.object({
      cronExpression: z.string(),
      timezone: z.string().default('Europe/Warsaw')
    }))
    .query(async ({ input }) => {
      return service.parseCron(input.cronExpression, input.timezone);
    }),

  // Webhook endpoint (public, authentication via webhook secret)
  webhook: publicProcedure
    .input(z.object({
      token: z.string(),
      method: z.string(),
      headers: z.record(z.string()),
      body: z.unknown(),
      queryParams: z.record(z.string()),
      ipAddress: z.string(),
      userAgent: z.string()
    }))
    .mutation(async ({ input }) => {
      return service.processWebhook(`/api/webhooks/${input.token}`, {
        method: input.method,
        headers: input.headers,
        body: input.body,
        queryParams: input.queryParams,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent
      });
    }),

  // Get available event types
  getEventTypes: protectedProcedure
    .query(async () => {
      return [
        { value: 'client.created', label: 'Utworzono klienta', category: 'CRM' },
        { value: 'client.updated', label: 'Zaktualizowano klienta', category: 'CRM' },
        { value: 'document.uploaded', label: 'Wgrano dokument', category: 'Dokumenty' },
        { value: 'document.processed', label: 'Przetworzono dokument', category: 'Dokumenty' },
        { value: 'invoice.created', label: 'Utworzono fakturę', category: 'Faktury' },
        { value: 'invoice.approved', label: 'Zatwierdzono fakturę', category: 'Faktury' },
        { value: 'payment.received', label: 'Otrzymano płatność', category: 'Płatności' },
        { value: 'payment.sent', label: 'Wysłano płatność', category: 'Płatności' },
        { value: 'deadline.approaching', label: 'Zbliża się termin', category: 'Terminy' },
        { value: 'tax.calculated', label: 'Obliczono podatek', category: 'Podatki' },
        { value: 'jpk.generated', label: 'Wygenerowano JPK', category: 'JPK' },
        { value: 'error.occurred', label: 'Wystąpił błąd', category: 'System' }
      ];
    }),

  // Get deadline types
  getDeadlineTypes: protectedProcedure
    .query(async () => {
      return [
        { value: 'VAT_FILING', label: 'Rozliczenie VAT', defaultDay: 25 },
        { value: 'JPK_V7M', label: 'JPK_V7M (miesięczny)', defaultDay: 25 },
        { value: 'JPK_V7K', label: 'JPK_V7K (kwartalny)', defaultDay: 25 },
        { value: 'CIT_ADVANCE', label: 'Zaliczka CIT', defaultDay: 20 },
        { value: 'PIT_ADVANCE', label: 'Zaliczka PIT', defaultDay: 20 },
        { value: 'ZUS_DRA', label: 'Deklaracja ZUS', defaultDay: 15 },
        { value: 'ANNUAL_CIT', label: 'CIT roczny', defaultDay: 31, defaultMonth: 3 },
        { value: 'ANNUAL_PIT', label: 'PIT roczny', defaultDay: 30, defaultMonth: 4 },
        { value: 'FINANCIAL_STATEMENTS', label: 'Sprawozdanie finansowe', defaultDay: 30, defaultMonth: 6 },
        { value: 'CUSTOM', label: 'Własny termin', custom: true }
      ];
    })
});
```

---

## 🧪 Test Specification

### Unit Tests

```typescript
describe('TriggerService', () => {
  describe('create', () => {
    it('should create manual trigger', async () => {
      const input = {
        workflowId: workflowId,
        triggerType: 'manual' as const,
        config: { requireConfirmation: true }
      };

      const result = await service.create(input, context);

      expect(result.triggerType).toBe('manual');
      expect(result.isActive).toBe(true);
    });

    it('should create webhook trigger with generated URL', async () => {
      const input = {
        workflowId: workflowId,
        triggerType: 'webhook' as const,
        config: { method: 'POST', authentication: 'bearer' }
      };

      const result = await service.create(input, context);

      expect(result.webhookUrl).toMatch(/^\/api\/webhooks\/.+$/);
      expect(result.webhookSecret).toBeDefined();
    });

    it('should create scheduled trigger with next execution time', async () => {
      const input = {
        workflowId: workflowId,
        triggerType: 'scheduled' as const,
        config: { cronExpression: '0 9 * * *', timezone: 'Europe/Warsaw' }
      };

      const result = await service.create(input, context);

      expect(result.nextExecutionAt).toBeDefined();
      expect(new Date(result.nextExecutionAt).getHours()).toBe(9);
    });
  });

  describe('processWebhook', () => {
    it('should process valid webhook request', async () => {
      const trigger = await createWebhookTrigger();

      const result = await service.processWebhook(trigger.webhookUrl, {
        method: 'POST',
        headers: {},
        body: { test: true },
        queryParams: {},
        ipAddress: '127.0.0.1',
        userAgent: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.executionId).toBeDefined();
    });

    it('should reject unauthorized webhook', async () => {
      const trigger = await createWebhookTrigger({ authentication: 'bearer' });

      await expect(service.processWebhook(trigger.webhookUrl, {
        method: 'POST',
        headers: {}, // No auth header
        body: {},
        queryParams: {},
        ipAddress: '127.0.0.1',
        userAgent: 'Test'
      })).rejects.toThrow('Brak autoryzacji');
    });
  });

  describe('visualScheduleToCron', () => {
    it('should convert daily schedule', () => {
      const schedule = { type: 'daily', time: '09:00' };
      expect(service.visualScheduleToCron(schedule)).toBe('0 9 * * *');
    });

    it('should convert weekly schedule', () => {
      const schedule = { type: 'weekly', time: '10:30', daysOfWeek: [1, 3, 5] };
      expect(service.visualScheduleToCron(schedule)).toBe('30 10 * * 1,3,5');
    });
  });
});
```

### Integration Tests

```typescript
describe('Trigger Integration', () => {
  it('should handle complete webhook flow', async () => {
    // Create workflow with webhook trigger
    const workflow = await caller.workflowDesigner.create({ name: 'Webhook Test' });

    const trigger = await caller.trigger.create({
      workflowId: workflow.id,
      triggerType: 'webhook',
      config: {
        method: 'POST',
        authentication: 'api_key',
        authConfig: { apiKeyHeader: 'X-API-Key', apiKeyValue: 'test-key' }
      }
    });

    // Simulate webhook call
    const result = await caller.trigger.webhook({
      token: trigger.webhookUrl.split('/').pop()!,
      method: 'POST',
      headers: { 'x-api-key': 'test-key' },
      body: { invoiceId: '123' },
      queryParams: {},
      ipAddress: '127.0.0.1',
      userAgent: 'Test'
    });

    expect(result.success).toBe(true);

    // Verify execution was created
    const execution = await caller.workflowExecution.getById({
      id: result.executionId
    });
    expect(execution.triggerId).toBe(trigger.id);
  });

  it('should execute scheduled trigger', async () => {
    // Create scheduled trigger
    const workflow = await createTestWorkflow();
    const trigger = await caller.trigger.create({
      workflowId: workflow.id,
      triggerType: 'scheduled',
      config: {
        cronExpression: '* * * * *', // Every minute for testing
        timezone: 'Europe/Warsaw'
      }
    });

    // Wait for scheduler to run
    await new Promise(resolve => setTimeout(resolve, 61000));

    // Check if execution was created
    const executions = await caller.workflowExecution.list({
      workflowId: workflow.id
    });
    expect(executions.length).toBeGreaterThan(0);
  });
});
```

---

## 🔒 Security Checklist

- [ ] Webhook URLs use cryptographic random tokens
- [ ] Webhook secrets stored hashed
- [ ] IP allowlist enforcement
- [ ] Rate limiting on webhook endpoints
- [ ] Authentication validation before processing
- [ ] Event subscriptions scoped to organization
- [ ] Cron expressions validated for safety
- [ ] Audit logging for all trigger operations
- [ ] Sensitive config data encrypted
- [ ] CSRF protection on trigger management

---

## 📊 Audit Events

```typescript
const AUDIT_EVENTS = {
  'trigger.created': 'Utworzono trigger workflow',
  'trigger.updated': 'Zaktualizowano trigger',
  'trigger.deleted': 'Usunięto trigger',
  'trigger.activated': 'Aktywowano trigger',
  'trigger.deactivated': 'Dezaktywowano trigger',
  'trigger.tested': 'Przetestowano trigger',
  'webhook.received': 'Otrzymano żądanie webhook',
  'webhook.failed': 'Błąd przetwarzania webhook',
  'schedule.executed': 'Wykonano zaplanowany trigger',
  'schedule.missed': 'Pominięto zaplanowane wykonanie',
  'event.triggered': 'Uruchomiono trigger zdarzenia',
  'deadline.triggered': 'Uruchomiono trigger terminu'
};
```

---

## 📝 Implementation Notes

### Cron Parser
- Use `cron-parser` library for cron expression parsing
- Support for Polish holidays via `date-holidays` library
- Weekend/holiday skipping with next valid date calculation

### Event Bus Integration
- Use Redis Pub/Sub for event distribution
- Event types registered on trigger creation
- Automatic unsubscription on trigger deletion

### Scheduler Service
- Bull Queue for scheduled job management
- Persistence across restarts
- Missed job detection and recovery

### Polish Tax Deadlines
- Pre-configured deadline types for Polish tax calendar
- Automatic adjustment for weekends/holidays
- Support for custom deadline dates

---

*Story created: December 2024*
