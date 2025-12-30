# WFA-004: Error Handling & Recovery

> **Story ID**: WFA-004
> **Epic**: Workflow Automation Engine (WFA)
> **Priority**: P0 (Critical)
> **Points**: 8
> **Status**: 📋 Ready for Development
> **Sprint**: Phase 5, Week 18

---

## 📋 User Story

**As an** accountant,
**I want** robust error handling in workflows,
**So that** failures are managed gracefully without data loss or manual intervention.

---

## ✅ Acceptance Criteria

### Scenario 1: Automatic Retry with Backoff
```gherkin
Given a workflow step fails with a retryable error
When automatic retry is enabled
Then the system should retry with exponential backoff:
  - 1st retry after 5 seconds
  - 2nd retry after 10 seconds
  - 3rd retry after 20 seconds
And each retry attempt should be logged
And max retries should be configurable (default: 3)
```

### Scenario 2: Circuit Breaker Pattern
```gherkin
Given a workflow step has failed 5 times in 1 minute
When the circuit breaker threshold is exceeded
Then the circuit should open
And subsequent calls should fail immediately
And the circuit should half-open after 60 seconds
And successful execution should close the circuit
```

### Scenario 3: Dead Letter Queue
```gherkin
Given a workflow execution has exhausted all retries
When the execution is moved to the dead letter queue
Then I should see it in the DLQ dashboard
And I should be able to:
  - View the full error context
  - Retry the execution manually
  - Edit the input data and retry
  - Mark as resolved/skipped
And DLQ items should be retained for 30 days
```

### Scenario 4: Manual Retry Interface
```gherkin
Given a workflow execution has failed
When I view the failed execution
Then I should see:
  - The specific step that failed
  - The error message and stack trace
  - Input/output data for each step
And I should be able to:
  - Retry from the failed step
  - Retry the entire workflow
  - Skip the failed step and continue
```

### Scenario 5: Error Notifications
```gherkin
Given a workflow is configured for error notifications
When an execution fails after all retries
Then a notification should be sent:
  - Email to configured recipients
  - In-app notification
  - Slack/Teams webhook (if configured)
And the notification should include:
  - Workflow name and ID
  - Failed step details
  - Error message
  - Link to view execution details
```

### Scenario 6: Partial Execution Recovery
```gherkin
Given a workflow execution failed at step 5 of 8
When I choose to resume execution
Then the system should:
  - Load the saved state from step 4
  - Skip already completed steps
  - Resume from step 5
And all step outputs should be available
```

### Scenario 7: Rollback Capabilities
```gherkin
Given a workflow has "rollback on failure" enabled
And steps 1-3 have completed successfully
When step 4 fails
Then the system should execute compensating actions:
  - Call rollback handler for step 3
  - Call rollback handler for step 2
  - Call rollback handler for step 1
And the rollback progress should be visible
```

### Scenario 8: Error Classification
```gherkin
Given different types of errors can occur
When an error is caught
Then it should be classified as:
  - Transient (network timeout, rate limit) → Auto-retry
  - Permanent (validation error, not found) → No retry
  - Unknown → Configurable behavior
And appropriate handling should be applied based on classification
```

---

## 🔧 Technical Specification

### Database Schema

```sql
-- Execution errors
CREATE TABLE workflow_execution_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    step_id VARCHAR(100) NOT NULL,

    -- Error details
    error_type VARCHAR(50) NOT NULL CHECK (error_type IN (
        'transient', 'permanent', 'timeout', 'validation',
        'authorization', 'rate_limit', 'external_service', 'internal', 'unknown'
    )),
    error_code VARCHAR(50),
    error_message TEXT NOT NULL,
    stack_trace TEXT,

    -- Context
    input_data JSONB,
    output_data JSONB,
    step_state JSONB,

    -- Retry info
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    last_retry_at TIMESTAMPTZ,

    -- Resolution
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'retrying', 'resolved', 'escalated', 'dead_letter'
    )),
    resolution_type VARCHAR(20),
    resolution_notes TEXT,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dead letter queue
CREATE TABLE dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_id UUID NOT NULL REFERENCES workflow_execution_errors(id),
    workflow_id UUID NOT NULL REFERENCES workflows(id),
    execution_id UUID NOT NULL REFERENCES workflow_executions(id),

    -- Context preservation
    original_input JSONB NOT NULL,
    step_states JSONB NOT NULL, -- All step states up to failure
    failed_step_id VARCHAR(100) NOT NULL,

    -- DLQ status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'resolved', 'skipped', 'expired'
    )),

    -- Processing attempts
    manual_retry_count INTEGER DEFAULT 0,
    last_manual_retry_at TIMESTAMPTZ,

    -- Retention
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Circuit breaker state
CREATE TABLE circuit_breaker_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id),
    step_id VARCHAR(100) NOT NULL,

    -- State
    state VARCHAR(20) NOT NULL DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half_open')),

    -- Metrics
    failure_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    last_failure_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,

    -- Configuration
    failure_threshold INTEGER NOT NULL DEFAULT 5,
    reset_timeout_ms INTEGER NOT NULL DEFAULT 60000,
    half_open_requests INTEGER NOT NULL DEFAULT 3,

    -- State timestamps
    opened_at TIMESTAMPTZ,
    half_opened_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_circuit_per_step UNIQUE (workflow_id, step_id)
);

-- Compensation actions (for rollback)
CREATE TABLE compensation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id),
    step_id VARCHAR(100) NOT NULL,

    -- Compensation logic
    compensation_type VARCHAR(50) NOT NULL CHECK (compensation_type IN (
        'api_call', 'database_operation', 'notification', 'manual', 'none'
    )),
    compensation_config JSONB NOT NULL DEFAULT '{}',

    -- Status tracking
    execution_id UUID REFERENCES workflow_executions(id),
    status VARCHAR(20) DEFAULT 'pending',
    executed_at TIMESTAMPTZ,
    result JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Retry policies
CREATE TABLE retry_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflows(id), -- NULL for default policy
    step_id VARCHAR(100), -- NULL applies to all steps

    -- Retry configuration
    max_retries INTEGER NOT NULL DEFAULT 3,
    initial_delay_ms INTEGER NOT NULL DEFAULT 5000,
    max_delay_ms INTEGER NOT NULL DEFAULT 300000,
    backoff_multiplier DECIMAL(3,1) NOT NULL DEFAULT 2.0,

    -- Error handling
    retry_on_errors TEXT[] DEFAULT '{transient, timeout, rate_limit}',
    no_retry_on_errors TEXT[] DEFAULT '{permanent, validation, authorization}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_policy_per_step UNIQUE (workflow_id, step_id)
);

-- Indexes
CREATE INDEX idx_errors_execution ON workflow_execution_errors(execution_id);
CREATE INDEX idx_errors_status ON workflow_execution_errors(status) WHERE status = 'pending';
CREATE INDEX idx_errors_retry ON workflow_execution_errors(next_retry_at) WHERE status = 'retrying';
CREATE INDEX idx_dlq_workflow ON dead_letter_queue(workflow_id);
CREATE INDEX idx_dlq_status ON dead_letter_queue(status) WHERE status = 'pending';
CREATE INDEX idx_dlq_expires ON dead_letter_queue(expires_at);
CREATE INDEX idx_circuit_workflow ON circuit_breaker_state(workflow_id);

-- RLS Policies
ALTER TABLE workflow_execution_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE dead_letter_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE circuit_breaker_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE compensation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE retry_policies ENABLE ROW LEVEL SECURITY;
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Error types
export const errorTypeSchema = z.enum([
  'transient', 'permanent', 'timeout', 'validation',
  'authorization', 'rate_limit', 'external_service', 'internal', 'unknown'
]);

// Error classification input
export const classifyErrorSchema = z.object({
  errorCode: z.string().optional(),
  errorMessage: z.string(),
  statusCode: z.number().optional(),
  isTimeout: z.boolean().optional(),
  source: z.string().optional()
});

// Retry policy configuration
export const retryPolicySchema = z.object({
  maxRetries: z.number().min(0).max(10).default(3),
  initialDelayMs: z.number().min(1000).max(300000).default(5000),
  maxDelayMs: z.number().min(5000).max(3600000).default(300000),
  backoffMultiplier: z.number().min(1).max(5).default(2),
  retryOnErrors: z.array(errorTypeSchema).default(['transient', 'timeout', 'rate_limit']),
  noRetryOnErrors: z.array(errorTypeSchema).default(['permanent', 'validation', 'authorization'])
});

// Circuit breaker configuration
export const circuitBreakerConfigSchema = z.object({
  failureThreshold: z.number().min(1).max(100).default(5),
  resetTimeoutMs: z.number().min(10000).max(600000).default(60000),
  halfOpenRequests: z.number().min(1).max(10).default(3)
});

// Manual retry input
export const manualRetrySchema = z.object({
  executionId: z.string().uuid(),
  retryType: z.enum(['from_failed', 'full', 'skip_failed']),
  modifiedInput: z.record(z.unknown()).optional(),
  skipSteps: z.array(z.string()).optional()
});

// DLQ processing
export const processDLQSchema = z.object({
  dlqId: z.string().uuid(),
  action: z.enum(['retry', 'retry_modified', 'skip', 'resolve']),
  modifiedInput: z.record(z.unknown()).optional(),
  resolutionNotes: z.string().max(2000).optional()
});

// Error notification configuration
export const errorNotificationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  channels: z.array(z.enum(['email', 'app', 'slack', 'teams'])).default(['email', 'app']),
  recipients: z.array(z.string()).optional(),
  slackWebhookUrl: z.string().url().optional(),
  teamsWebhookUrl: z.string().url().optional(),
  notifyOnFirstFailure: z.boolean().default(false),
  notifyOnRetryExhausted: z.boolean().default(true),
  notifyOnDLQ: z.boolean().default(true)
});

// Compensation action
export const compensationActionSchema = z.object({
  stepId: z.string(),
  compensationType: z.enum(['api_call', 'database_operation', 'notification', 'manual', 'none']),
  config: z.object({
    endpoint: z.string().url().optional(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional(),
    body: z.record(z.unknown()).optional(),
    sqlTemplate: z.string().optional(),
    notificationTemplate: z.string().optional(),
    instructions: z.string().optional()
  })
});
```

### Service Implementation

```typescript
// src/server/services/error-handling.service.ts
import { TRPCError } from '@trpc/server';
import { db } from '@/server/db';
import { eq, and, lt, gt, or } from 'drizzle-orm';
import {
  workflowExecutionErrors,
  deadLetterQueue,
  circuitBreakerState,
  compensationActions,
  retryPolicies,
  workflowExecutions
} from '@/server/db/schema';
import {
  classifyErrorSchema,
  retryPolicySchema,
  manualRetrySchema,
  processDLQSchema,
  errorNotificationConfigSchema
} from './error-handling.schemas';
import { NotificationService } from './notification.service';
import { WorkflowExecutionService } from './workflow-execution.service';
import { auditLog } from '@/server/services/audit.service';

export class ErrorHandlingService {
  private notificationService: NotificationService;
  private executionService: WorkflowExecutionService;

  constructor() {
    this.notificationService = new NotificationService();
    this.executionService = new WorkflowExecutionService();
  }

  /**
   * Handle workflow step error
   */
  async handleError(
    executionId: string,
    stepId: string,
    error: Error,
    context: { input: unknown; state: unknown }
  ): Promise<{ shouldRetry: boolean; nextAction: string }> {
    // Classify the error
    const errorType = this.classifyError(error);

    // Get retry policy
    const policy = await this.getRetryPolicy(executionId, stepId);

    // Get or create error record
    const existingError = await db.query.workflowExecutionErrors.findFirst({
      where: and(
        eq(workflowExecutionErrors.executionId, executionId),
        eq(workflowExecutionErrors.stepId, stepId),
        eq(workflowExecutionErrors.status, 'pending')
      )
    });

    const retryCount = existingError ? existingError.retryCount + 1 : 0;

    // Check circuit breaker
    const circuitState = await this.checkCircuitBreaker(executionId, stepId);
    if (circuitState === 'open') {
      return {
        shouldRetry: false,
        nextAction: 'circuit_open'
      };
    }

    // Determine if should retry
    const shouldRetry = this.shouldRetry(errorType, retryCount, policy);

    if (shouldRetry) {
      const delay = this.calculateBackoff(retryCount, policy);

      // Create/update error record
      const [errorRecord] = existingError
        ? await db.update(workflowExecutionErrors)
            .set({
              retryCount,
              nextRetryAt: new Date(Date.now() + delay),
              status: 'retrying',
              updatedAt: new Date()
            })
            .where(eq(workflowExecutionErrors.id, existingError.id))
            .returning()
        : await db.insert(workflowExecutionErrors)
            .values({
              executionId,
              stepId,
              errorType,
              errorCode: (error as any).code,
              errorMessage: error.message,
              stackTrace: error.stack,
              inputData: context.input,
              stepState: context.state,
              retryCount,
              maxRetries: policy.maxRetries,
              nextRetryAt: new Date(Date.now() + delay),
              status: 'retrying'
            })
            .returning();

      return {
        shouldRetry: true,
        nextAction: `retry_in_${delay}ms`
      };
    }

    // Exhausted retries - move to DLQ
    await this.moveToDLQ(executionId, stepId, error, context);

    // Update circuit breaker
    await this.recordCircuitBreakerFailure(executionId, stepId);

    // Send notification
    await this.sendErrorNotification(executionId, stepId, error);

    return {
      shouldRetry: false,
      nextAction: 'dead_letter_queue'
    };
  }

  /**
   * Classify error type
   */
  private classifyError(error: Error): z.infer<typeof errorTypeSchema> {
    const message = error.message.toLowerCase();
    const code = (error as any).code;
    const statusCode = (error as any).statusCode;

    // Timeout errors
    if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || message.includes('timeout')) {
      return 'timeout';
    }

    // Rate limit errors
    if (statusCode === 429 || message.includes('rate limit') || message.includes('too many requests')) {
      return 'rate_limit';
    }

    // Authorization errors
    if (statusCode === 401 || statusCode === 403 || message.includes('unauthorized') || message.includes('forbidden')) {
      return 'authorization';
    }

    // Validation errors
    if (statusCode === 400 || code === 'VALIDATION_ERROR' || message.includes('validation')) {
      return 'validation';
    }

    // Not found (permanent)
    if (statusCode === 404) {
      return 'permanent';
    }

    // Network/transient errors
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET' ||
        statusCode >= 500 || message.includes('network')) {
      return 'transient';
    }

    // External service errors
    if (message.includes('external') || message.includes('api') || message.includes('service')) {
      return 'external_service';
    }

    return 'unknown';
  }

  /**
   * Check if should retry based on error type and policy
   */
  private shouldRetry(
    errorType: z.infer<typeof errorTypeSchema>,
    retryCount: number,
    policy: z.infer<typeof retryPolicySchema>
  ): boolean {
    if (retryCount >= policy.maxRetries) {
      return false;
    }

    if (policy.noRetryOnErrors.includes(errorType)) {
      return false;
    }

    if (policy.retryOnErrors.includes(errorType)) {
      return true;
    }

    return errorType === 'unknown'; // Default: retry unknown errors
  }

  /**
   * Calculate backoff delay
   */
  private calculateBackoff(
    retryCount: number,
    policy: z.infer<typeof retryPolicySchema>
  ): number {
    const delay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, retryCount);
    // Add jitter (±10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.min(delay + jitter, policy.maxDelayMs);
  }

  /**
   * Get retry policy for step
   */
  private async getRetryPolicy(
    executionId: string,
    stepId: string
  ): Promise<z.infer<typeof retryPolicySchema>> {
    const execution = await db.query.workflowExecutions.findFirst({
      where: eq(workflowExecutions.id, executionId)
    });

    if (!execution) {
      return retryPolicySchema.parse({});
    }

    // Check step-specific policy
    const stepPolicy = await db.query.retryPolicies.findFirst({
      where: and(
        eq(retryPolicies.workflowId, execution.workflowId),
        eq(retryPolicies.stepId, stepId)
      )
    });

    if (stepPolicy) {
      return retryPolicySchema.parse(stepPolicy);
    }

    // Check workflow-level policy
    const workflowPolicy = await db.query.retryPolicies.findFirst({
      where: and(
        eq(retryPolicies.workflowId, execution.workflowId),
        isNull(retryPolicies.stepId)
      )
    });

    if (workflowPolicy) {
      return retryPolicySchema.parse(workflowPolicy);
    }

    // Default policy
    return retryPolicySchema.parse({});
  }

  /**
   * Check circuit breaker state
   */
  private async checkCircuitBreaker(
    executionId: string,
    stepId: string
  ): Promise<'closed' | 'open' | 'half_open'> {
    const execution = await db.query.workflowExecutions.findFirst({
      where: eq(workflowExecutions.id, executionId)
    });

    if (!execution) return 'closed';

    const circuit = await db.query.circuitBreakerState.findFirst({
      where: and(
        eq(circuitBreakerState.workflowId, execution.workflowId),
        eq(circuitBreakerState.stepId, stepId)
      )
    });

    if (!circuit) return 'closed';

    if (circuit.state === 'open') {
      // Check if should transition to half-open
      const resetTime = circuit.openedAt!.getTime() + circuit.resetTimeoutMs;
      if (Date.now() > resetTime) {
        await db.update(circuitBreakerState)
          .set({ state: 'half_open', halfOpenedAt: new Date() })
          .where(eq(circuitBreakerState.id, circuit.id));
        return 'half_open';
      }
    }

    return circuit.state as 'closed' | 'open' | 'half_open';
  }

  /**
   * Record circuit breaker failure
   */
  private async recordCircuitBreakerFailure(
    executionId: string,
    stepId: string
  ) {
    const execution = await db.query.workflowExecutions.findFirst({
      where: eq(workflowExecutions.id, executionId)
    });

    if (!execution) return;

    const [circuit] = await db.insert(circuitBreakerState)
      .values({
        workflowId: execution.workflowId,
        stepId,
        state: 'closed',
        failureCount: 1,
        lastFailureAt: new Date()
      })
      .onConflictDoUpdate({
        target: [circuitBreakerState.workflowId, circuitBreakerState.stepId],
        set: {
          failureCount: sql`${circuitBreakerState.failureCount} + 1`,
          lastFailureAt: new Date(),
          updatedAt: new Date()
        }
      })
      .returning();

    // Check if should open circuit
    if (circuit.failureCount >= circuit.failureThreshold) {
      await db.update(circuitBreakerState)
        .set({ state: 'open', openedAt: new Date() })
        .where(eq(circuitBreakerState.id, circuit.id));
    }
  }

  /**
   * Move execution to dead letter queue
   */
  private async moveToDLQ(
    executionId: string,
    stepId: string,
    error: Error,
    context: { input: unknown; state: unknown }
  ) {
    const execution = await db.query.workflowExecutions.findFirst({
      where: eq(workflowExecutions.id, executionId),
      with: {
        stepExecutions: true
      }
    });

    if (!execution) return;

    // Update error status
    await db.update(workflowExecutionErrors)
      .set({ status: 'dead_letter' })
      .where(and(
        eq(workflowExecutionErrors.executionId, executionId),
        eq(workflowExecutionErrors.stepId, stepId)
      ));

    // Create DLQ entry
    const errorRecord = await db.query.workflowExecutionErrors.findFirst({
      where: and(
        eq(workflowExecutionErrors.executionId, executionId),
        eq(workflowExecutionErrors.stepId, stepId)
      )
    });

    await db.insert(deadLetterQueue).values({
      errorId: errorRecord!.id,
      workflowId: execution.workflowId,
      executionId,
      originalInput: execution.inputData,
      stepStates: execution.stepExecutions.reduce((acc, step) => ({
        ...acc,
        [step.stepId]: step.outputData
      }), {}),
      failedStepId: stepId
    });
  }

  /**
   * Process DLQ item
   */
  async processDLQ(
    input: z.infer<typeof processDLQSchema>,
    context: { userId: string; organizationId: string }
  ) {
    const dlqItem = await db.query.deadLetterQueue.findFirst({
      where: eq(deadLetterQueue.id, input.dlqId),
      with: {
        workflow: true,
        execution: true,
        error: true
      }
    });

    if (!dlqItem || dlqItem.workflow.organizationId !== context.organizationId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Element DLQ nie znaleziony'
      });
    }

    switch (input.action) {
      case 'retry':
        return this.retryFromDLQ(dlqItem, context);

      case 'retry_modified':
        return this.retryFromDLQ(dlqItem, context, input.modifiedInput);

      case 'skip':
        await db.update(deadLetterQueue)
          .set({
            status: 'skipped',
            updatedAt: new Date()
          })
          .where(eq(deadLetterQueue.id, input.dlqId));

        await db.update(workflowExecutionErrors)
          .set({
            status: 'resolved',
            resolutionType: 'skipped',
            resolutionNotes: input.resolutionNotes,
            resolvedBy: context.userId,
            resolvedAt: new Date()
          })
          .where(eq(workflowExecutionErrors.id, dlqItem.errorId));

        return { success: true, action: 'skipped' };

      case 'resolve':
        await db.update(deadLetterQueue)
          .set({ status: 'resolved', updatedAt: new Date() })
          .where(eq(deadLetterQueue.id, input.dlqId));

        await db.update(workflowExecutionErrors)
          .set({
            status: 'resolved',
            resolutionType: 'manual',
            resolutionNotes: input.resolutionNotes,
            resolvedBy: context.userId,
            resolvedAt: new Date()
          })
          .where(eq(workflowExecutionErrors.id, dlqItem.errorId));

        return { success: true, action: 'resolved' };
    }
  }

  /**
   * Retry execution from DLQ
   */
  private async retryFromDLQ(
    dlqItem: typeof deadLetterQueue.$inferSelect & {
      workflow: typeof workflows.$inferSelect;
      execution: typeof workflowExecutions.$inferSelect;
    },
    context: { userId: string; organizationId: string },
    modifiedInput?: Record<string, unknown>
  ) {
    // Create new execution
    const newExecution = await this.executionService.execute(
      dlqItem.workflowId,
      modifiedInput || dlqItem.originalInput,
      {
        resumeFromStep: dlqItem.failedStepId,
        previousStepStates: dlqItem.stepStates
      }
    );

    // Update DLQ status
    await db.update(deadLetterQueue)
      .set({
        status: 'processing',
        manualRetryCount: dlqItem.manualRetryCount + 1,
        lastManualRetryAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(deadLetterQueue.id, dlqItem.id));

    // Audit log
    await auditLog({
      action: 'dlq.retry',
      entityType: 'dead_letter_queue',
      entityId: dlqItem.id,
      userId: context.userId,
      organizationId: context.organizationId,
      details: { newExecutionId: newExecution.id }
    });

    return {
      success: true,
      action: 'retried',
      newExecutionId: newExecution.id
    };
  }

  /**
   * Execute rollback/compensation
   */
  async executeRollback(
    executionId: string,
    failedStepId: string,
    context: { userId: string; organizationId: string }
  ) {
    const execution = await db.query.workflowExecutions.findFirst({
      where: eq(workflowExecutions.id, executionId),
      with: {
        stepExecutions: {
          orderBy: desc(stepExecutions.startedAt)
        },
        workflow: true
      }
    });

    if (!execution || execution.workflow.organizationId !== context.organizationId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Wykonanie nie znalezione'
      });
    }

    // Get compensation actions for completed steps before failure
    const compensations = await db.query.compensationActions.findMany({
      where: eq(compensationActions.workflowId, execution.workflowId)
    });

    const compensationMap = new Map(
      compensations.map(c => [c.stepId, c])
    );

    // Execute compensations in reverse order
    const results = [];
    for (const step of execution.stepExecutions) {
      if (step.stepId === failedStepId) break;
      if (step.status !== 'completed') continue;

      const compensation = compensationMap.get(step.stepId);
      if (!compensation || compensation.compensationType === 'none') {
        continue;
      }

      try {
        const result = await this.executeCompensation(compensation, step.outputData);
        results.push({
          stepId: step.stepId,
          success: true,
          result
        });
      } catch (error) {
        results.push({
          stepId: step.stepId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Audit log
    await auditLog({
      action: 'execution.rollback',
      entityType: 'workflow_execution',
      entityId: executionId,
      userId: context.userId,
      organizationId: context.organizationId,
      details: { results }
    });

    return { success: true, compensations: results };
  }

  /**
   * Execute single compensation action
   */
  private async executeCompensation(
    compensation: typeof compensationActions.$inferSelect,
    stepOutput: unknown
  ): Promise<unknown> {
    switch (compensation.compensationType) {
      case 'api_call':
        const { endpoint, method, body } = compensation.compensationConfig as any;
        const response = await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.interpolateData(body, stepOutput))
        });
        return response.json();

      case 'database_operation':
        // Execute SQL template (safely)
        const { sqlTemplate } = compensation.compensationConfig as any;
        // This would use parameterized queries
        return { executed: true };

      case 'notification':
        const { notificationTemplate } = compensation.compensationConfig as any;
        await this.notificationService.send({
          template: notificationTemplate,
          data: stepOutput
        });
        return { notified: true };

      case 'manual':
        // Just log that manual action is required
        return { requiresManualAction: true, instructions: (compensation.compensationConfig as any).instructions };

      default:
        return null;
    }
  }

  /**
   * Send error notification
   */
  private async sendErrorNotification(
    executionId: string,
    stepId: string,
    error: Error
  ) {
    const execution = await db.query.workflowExecutions.findFirst({
      where: eq(workflowExecutions.id, executionId),
      with: {
        workflow: true
      }
    });

    if (!execution) return;

    const config = execution.workflow.settings as any;
    const notificationConfig = errorNotificationConfigSchema.parse(
      config.errorNotifications || {}
    );

    if (!notificationConfig.enabled || !notificationConfig.notifyOnRetryExhausted) {
      return;
    }

    const notificationData = {
      workflowName: execution.workflow.name,
      workflowId: execution.workflowId,
      executionId,
      failedStep: stepId,
      errorMessage: error.message,
      timestamp: new Date().toISOString(),
      viewUrl: `/workflows/${execution.workflowId}/executions/${executionId}`
    };

    for (const channel of notificationConfig.channels) {
      await this.notificationService.send({
        channel,
        template: 'workflow_error',
        data: notificationData,
        recipients: notificationConfig.recipients,
        webhookUrl: channel === 'slack'
          ? notificationConfig.slackWebhookUrl
          : notificationConfig.teamsWebhookUrl
      });
    }
  }

  private interpolateData(template: any, data: unknown): any {
    if (typeof template === 'string') {
      return template.replace(/\{\{(\w+)\}\}/g, (_, key) => (data as any)?.[key] ?? '');
    }
    if (Array.isArray(template)) {
      return template.map(item => this.interpolateData(item, data));
    }
    if (typeof template === 'object' && template !== null) {
      return Object.fromEntries(
        Object.entries(template).map(([k, v]) => [k, this.interpolateData(v, data)])
      );
    }
    return template;
  }

  /**
   * Get DLQ items
   */
  async getDLQItems(
    options: {
      workflowId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
    context: { userId: string; organizationId: string }
  ) {
    const conditions = [];

    if (options.workflowId) {
      conditions.push(eq(deadLetterQueue.workflowId, options.workflowId));
    }
    if (options.status) {
      conditions.push(eq(deadLetterQueue.status, options.status));
    }

    const items = await db.query.deadLetterQueue.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        workflow: true,
        error: true
      },
      orderBy: desc(deadLetterQueue.createdAt),
      limit: options.limit || 50,
      offset: options.offset || 0
    });

    // Filter by organization
    return items.filter(item => item.workflow.organizationId === context.organizationId);
  }
}
```

---

## 🧪 Test Specification

### Unit Tests

```typescript
describe('ErrorHandlingService', () => {
  describe('classifyError', () => {
    it('should classify timeout errors', () => {
      const error = new Error('Connection timeout');
      (error as any).code = 'ETIMEDOUT';

      const result = service.classifyError(error);
      expect(result).toBe('timeout');
    });

    it('should classify rate limit errors', () => {
      const error = new Error('Too many requests');
      (error as any).statusCode = 429;

      const result = service.classifyError(error);
      expect(result).toBe('rate_limit');
    });

    it('should classify validation errors as permanent', () => {
      const error = new Error('Validation failed');
      (error as any).statusCode = 400;

      const result = service.classifyError(error);
      expect(result).toBe('validation');
    });
  });

  describe('calculateBackoff', () => {
    it('should calculate exponential backoff', () => {
      const policy = { initialDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 60000 };

      const delay0 = service.calculateBackoff(0, policy);
      const delay1 = service.calculateBackoff(1, policy);
      const delay2 = service.calculateBackoff(2, policy);

      expect(delay0).toBeCloseTo(1000, -2);
      expect(delay1).toBeCloseTo(2000, -2);
      expect(delay2).toBeCloseTo(4000, -2);
    });

    it('should respect max delay', () => {
      const policy = { initialDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 5000 };

      const delay = service.calculateBackoff(10, policy);
      expect(delay).toBeLessThanOrEqual(5000);
    });
  });

  describe('handleError', () => {
    it('should retry transient errors', async () => {
      const error = new Error('Network error');
      (error as any).code = 'ECONNRESET';

      const result = await service.handleError(executionId, 'step1', error, {});

      expect(result.shouldRetry).toBe(true);
      expect(result.nextAction).toMatch(/retry_in_\d+ms/);
    });

    it('should not retry permanent errors', async () => {
      const error = new Error('Not found');
      (error as any).statusCode = 404;

      const result = await service.handleError(executionId, 'step1', error, {});

      expect(result.shouldRetry).toBe(false);
      expect(result.nextAction).toBe('dead_letter_queue');
    });
  });
});
```

---

## 🔒 Security Checklist

- [ ] DLQ access restricted to authorized users
- [ ] Sensitive data in error context encrypted
- [ ] Rollback actions validated and sanitized
- [ ] Notification webhooks validated
- [ ] SQL in compensation actions parameterized
- [ ] Error messages don't expose internal details
- [ ] Circuit breaker state isolated per organization
- [ ] Audit logging for all error handling actions

---

## 📊 Audit Events

```typescript
const AUDIT_EVENTS = {
  'error.recorded': 'Zarejestrowano błąd wykonania',
  'error.retry_scheduled': 'Zaplanowano ponowną próbę',
  'error.retry_exhausted': 'Wyczerpano limity ponowień',
  'dlq.created': 'Dodano do kolejki DLQ',
  'dlq.retry': 'Ponowiono z kolejki DLQ',
  'dlq.resolved': 'Rozwiązano element DLQ',
  'dlq.skipped': 'Pominięto element DLQ',
  'circuit.opened': 'Otwarto obwód bezpieczeństwa',
  'circuit.closed': 'Zamknięto obwód bezpieczeństwa',
  'execution.rollback': 'Wykonano rollback'
};
```

---

*Story created: December 2024*
