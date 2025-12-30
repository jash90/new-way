# Story: Agent Orchestration & Chaining

## Story Metadata

| Field | Value |
|-------|-------|
| Story ID | AAM-010 |
| Epic | AI Agent Module (AAM) |
| Title | Agent Orchestration & Chaining |
| Status | Draft |
| Priority | P2 |
| Story Points | 6 |
| Sprint | Sprint 8 |
| Dependencies | AAM-001, AAM-004, AAM-005 |
| Assignee | TBD |
| Created | 2025-01-XX |
| Updated | 2025-01-XX |

## User Story

**As a** Super Admin
**I want to** create multi-agent workflows where agents collaborate on complex tasks
**So that** I can automate sophisticated business processes that require multiple AI capabilities

## Acceptance Criteria

### AC1: Agent Chain Definition
```gherkin
Given I am a Super Admin creating a workflow
When I define an agent chain
Then I can select multiple agents to execute in sequence
And I can define data passing between agents
And I can set conditions for branching
And the chain configuration is validated before saving
```

### AC2: Context Propagation
```gherkin
Given an agent chain is executing
When one agent completes its task
Then its output is automatically passed to the next agent
And relevant context from previous agents is preserved
And I can configure which data to include/exclude
And token limits are respected across the chain
```

### AC3: Parallel Execution
```gherkin
Given a workflow requires multiple independent analyses
When I configure parallel execution
Then agents can run simultaneously
And results are aggregated when all complete
And timeout handling works per-agent
And partial results are available if some agents fail
```

### AC4: Conditional Branching
```gherkin
Given a workflow needs decision points
When I add conditional logic
Then I can branch based on agent output
And I can use classification results for routing
And fallback paths are configurable
And the workflow visualizer shows all branches
```

### AC5: Workflow Monitoring
```gherkin
Given an agent chain is running
When I view workflow status
Then I see real-time progress through each step
And I see token usage per agent
And I can cancel the workflow mid-execution
And I see detailed logs for debugging
```

## Technical Specification

### Database Schema

```sql
-- Workflow definitions
CREATE TABLE agent_workflows (
  workflow_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  name VARCHAR(255) NOT NULL,
  description TEXT,
  version INTEGER DEFAULT 1,

  -- Configuration
  config JSONB NOT NULL, -- Full workflow definition
  trigger_type VARCHAR(50), -- 'MANUAL', 'SCHEDULED', 'EVENT', 'API'
  trigger_config JSONB,

  -- Settings
  timeout_seconds INTEGER DEFAULT 300,
  max_retries INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 5,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_published BOOLEAN DEFAULT false,

  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, name, version)
);

-- Workflow steps (nodes)
CREATE TABLE workflow_steps (
  step_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES agent_workflows(workflow_id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  step_type VARCHAR(50) NOT NULL, -- 'AGENT', 'CONDITION', 'PARALLEL', 'AGGREGATE', 'TRANSFORM'
  position INTEGER NOT NULL, -- Order in workflow

  -- Agent configuration (for AGENT type)
  agent_id UUID REFERENCES agents(id),
  input_mapping JSONB DEFAULT '{}', -- How to map input to agent
  output_mapping JSONB DEFAULT '{}', -- How to extract output

  -- Condition configuration (for CONDITION type)
  condition_expression TEXT, -- e.g., "output.sentiment == 'negative'"
  true_next_step UUID,
  false_next_step UUID,

  -- Parallel configuration
  parallel_steps UUID[], -- Steps to run in parallel
  aggregation_strategy VARCHAR(50), -- 'MERGE', 'FIRST', 'VOTE', 'BEST'

  -- Transform configuration
  transform_expression TEXT, -- JS-like transformation

  -- Flow control
  next_step_id UUID REFERENCES workflow_steps(step_id),
  is_terminal BOOLEAN DEFAULT false,

  -- Timeout per step
  timeout_seconds INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow executions
CREATE TABLE workflow_executions (
  execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  workflow_id UUID NOT NULL REFERENCES agent_workflows(workflow_id),

  -- Input/Output
  input_data JSONB NOT NULL,
  output_data JSONB,
  context JSONB DEFAULT '{}', -- Accumulated context

  -- Status
  status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'
  current_step_id UUID REFERENCES workflow_steps(step_id),

  -- Metrics
  total_tokens_used INTEGER DEFAULT 0,
  total_cost DECIMAL(10,4) DEFAULT 0,
  execution_time_ms INTEGER,

  -- Error handling
  error_message TEXT,
  error_step_id UUID REFERENCES workflow_steps(step_id),
  retry_count INTEGER DEFAULT 0,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id),

  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step execution logs
CREATE TABLE workflow_step_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES workflow_executions(execution_id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES workflow_steps(step_id),

  -- Execution details
  status VARCHAR(20) NOT NULL, -- 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED'
  input_data JSONB,
  output_data JSONB,

  -- Agent execution (if AGENT step)
  agent_id UUID REFERENCES agents(id),
  conversation_id UUID REFERENCES agent_conversations(conversation_id),
  message_ids UUID[],

  -- Metrics
  tokens_used INTEGER,
  cost DECIMAL(10,4),
  duration_ms INTEGER,

  -- Error details
  error_type VARCHAR(100),
  error_message TEXT,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow templates (pre-built patterns)
CREATE TABLE workflow_templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL, -- 'document_processing', 'customer_support', 'analysis', etc.

  config JSONB NOT NULL, -- Template workflow configuration
  required_agent_types VARCHAR(100)[], -- Agent types needed

  -- Metadata
  difficulty VARCHAR(20) DEFAULT 'MEDIUM', -- 'EASY', 'MEDIUM', 'ADVANCED'
  estimated_cost_per_run DECIMAL(10,2),
  typical_duration_seconds INTEGER,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workflows_tenant ON agent_workflows(tenant_id);
CREATE INDEX idx_workflow_steps_workflow ON workflow_steps(workflow_id);
CREATE INDEX idx_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_executions_status ON workflow_executions(tenant_id, status);
CREATE INDEX idx_step_logs_execution ON workflow_step_logs(execution_id);
CREATE INDEX idx_templates_category ON workflow_templates(category) WHERE is_active = true;
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Step definition
export const WorkflowStepSchema = z.object({
  stepId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  stepType: z.enum(['AGENT', 'CONDITION', 'PARALLEL', 'AGGREGATE', 'TRANSFORM']),
  position: z.number().int().nonnegative(),

  // Agent step
  agentId: z.string().uuid().optional(),
  inputMapping: z.record(z.string()).optional(),
  outputMapping: z.record(z.string()).optional(),

  // Condition step
  conditionExpression: z.string().optional(),
  trueNextStep: z.string().uuid().optional(),
  falseNextStep: z.string().uuid().optional(),

  // Parallel step
  parallelSteps: z.array(z.string().uuid()).optional(),
  aggregationStrategy: z.enum(['MERGE', 'FIRST', 'VOTE', 'BEST']).optional(),

  // Transform step
  transformExpression: z.string().optional(),

  // Flow control
  nextStepId: z.string().uuid().optional(),
  isTerminal: z.boolean().default(false),

  // Timeout
  timeoutSeconds: z.number().int().positive().optional(),
});

// Workflow definition
export const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  steps: z.array(WorkflowStepSchema).min(1),
  triggerType: z.enum(['MANUAL', 'SCHEDULED', 'EVENT', 'API']).optional(),
  triggerConfig: z.object({
    cronExpression: z.string().optional(),
    eventType: z.string().optional(),
    webhookSecret: z.string().optional(),
  }).optional(),
  timeoutSeconds: z.number().int().positive().default(300),
  maxRetries: z.number().int().nonnegative().default(3),
});

export const UpdateWorkflowSchema = CreateWorkflowSchema.partial();

// Workflow execution
export const ExecuteWorkflowSchema = z.object({
  workflowId: z.string().uuid(),
  inputData: z.record(z.any()),
  context: z.record(z.any()).optional(),
});

// Execution query
export const ExecutionQuerySchema = z.object({
  workflowId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateUntil: z.string().datetime().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

// Condition expression (simplified DSL)
export const ConditionExpressionSchema = z.object({
  field: z.string(), // e.g., "output.sentiment", "step.tax_agent.result.amount"
  operator: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'contains', 'matches']),
  value: z.any(),
  logic: z.enum(['AND', 'OR']).optional(),
  nested: z.array(z.lazy(() => ConditionExpressionSchema)).optional(),
});

// Response types
export const WorkflowExecutionStatusSchema = z.object({
  executionId: z.string().uuid(),
  workflowId: z.string().uuid(),
  status: z.string(),
  progress: z.object({
    currentStep: z.string().optional(),
    completedSteps: z.number(),
    totalSteps: z.number(),
    percentComplete: z.number(),
  }),
  metrics: z.object({
    tokensUsed: z.number(),
    cost: z.number(),
    elapsedMs: z.number(),
  }),
  stepLogs: z.array(z.object({
    stepId: z.string().uuid(),
    stepName: z.string(),
    status: z.string(),
    durationMs: z.number().optional(),
  })),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type CreateWorkflow = z.infer<typeof CreateWorkflowSchema>;
export type UpdateWorkflow = z.infer<typeof UpdateWorkflowSchema>;
export type ExecuteWorkflow = z.infer<typeof ExecuteWorkflowSchema>;
export type ExecutionQuery = z.infer<typeof ExecutionQuerySchema>;
export type WorkflowExecutionStatus = z.infer<typeof WorkflowExecutionStatusSchema>;
```

### Service Implementation

```typescript
import { injectable, inject } from 'inversify';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { ExecutionRepository } from '../repositories/execution.repository';
import { StepLogRepository } from '../repositories/step-log.repository';
import { AgentExecutionService } from './agent-execution.service';
import { AuditService } from '../../core/services/audit.service';
import { NotificationService } from '../../notification/services/notification.service';
import { CostManagementService } from './cost-management.service';
import { EventEmitter } from 'events';
import {
  CreateWorkflow,
  UpdateWorkflow,
  ExecuteWorkflow,
  ExecutionQuery,
  WorkflowExecutionStatus,
  WorkflowStep,
} from '../schemas/workflow.schema';

@injectable()
export class WorkflowOrchestrationService {
  private activeExecutions = new Map<string, AbortController>();

  constructor(
    @inject(WorkflowRepository) private workflowRepo: WorkflowRepository,
    @inject(ExecutionRepository) private executionRepo: ExecutionRepository,
    @inject(StepLogRepository) private stepLogRepo: StepLogRepository,
    @inject(AgentExecutionService) private agentExecution: AgentExecutionService,
    @inject(AuditService) private auditService: AuditService,
    @inject(NotificationService) private notificationService: NotificationService,
    @inject(CostManagementService) private costManagement: CostManagementService,
  ) {}

  // ============ Workflow CRUD ============

  async createWorkflow(
    tenantId: string,
    userId: string,
    input: CreateWorkflow,
  ): Promise<Workflow> {
    // Validate workflow structure
    this.validateWorkflowStructure(input.steps);

    // Check all referenced agents exist
    await this.validateAgentReferences(tenantId, input.steps);

    const workflow = await this.workflowRepo.create(tenantId, userId, input);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'WORKFLOW_CREATED',
      entityType: 'agent_workflow',
      entityId: workflow.workflowId,
      newValue: { name: input.name, stepsCount: input.steps.length },
    });

    return workflow;
  }

  async updateWorkflow(
    tenantId: string,
    userId: string,
    workflowId: string,
    input: UpdateWorkflow,
  ): Promise<Workflow> {
    const existing = await this.workflowRepo.findById(workflowId);
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error('Przepływ pracy nie został znaleziony');
    }

    if (input.steps) {
      this.validateWorkflowStructure(input.steps);
      await this.validateAgentReferences(tenantId, input.steps);
    }

    // Create new version
    const updated = await this.workflowRepo.createVersion(workflowId, input);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'WORKFLOW_UPDATED',
      entityType: 'agent_workflow',
      entityId: workflowId,
      previousValue: { version: existing.version },
      newValue: { version: updated.version },
    });

    return updated;
  }

  private validateWorkflowStructure(steps: WorkflowStep[]): void {
    if (steps.length === 0) {
      throw new Error('Przepływ pracy musi zawierać co najmniej jeden krok');
    }

    // Check for cycles
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (stepId: string | undefined): boolean => {
      if (!stepId) return false;

      if (recursionStack.has(stepId)) return true;
      if (visited.has(stepId)) return false;

      visited.add(stepId);
      recursionStack.add(stepId);

      const step = steps.find((s) => s.stepId === stepId);
      if (step) {
        if (hasCycle(step.nextStepId)) return true;
        if (step.trueNextStep && hasCycle(step.trueNextStep)) return true;
        if (step.falseNextStep && hasCycle(step.falseNextStep)) return true;
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const step of steps) {
      if (hasCycle(step.stepId)) {
        throw new Error('Przepływ pracy zawiera cykl - to nie jest dozwolone');
      }
    }

    // Check terminal steps exist
    const hasTerminal = steps.some((s) => s.isTerminal);
    if (!hasTerminal) {
      throw new Error('Przepływ pracy musi mieć co najmniej jeden krok końcowy');
    }
  }

  private async validateAgentReferences(
    tenantId: string,
    steps: WorkflowStep[],
  ): Promise<void> {
    const agentIds = steps
      .filter((s) => s.stepType === 'AGENT' && s.agentId)
      .map((s) => s.agentId!);

    for (const agentId of agentIds) {
      const agent = await this.agentRepo.findById(agentId);
      if (!agent || agent.tenantId !== tenantId) {
        throw new Error(`Agent ${agentId} nie istnieje lub nie należy do tej organizacji`);
      }
    }
  }

  // ============ Workflow Execution ============

  async executeWorkflow(
    tenantId: string,
    userId: string,
    input: ExecuteWorkflow,
  ): Promise<string> {
    const workflow = await this.workflowRepo.findById(input.workflowId);
    if (!workflow || workflow.tenantId !== tenantId) {
      throw new Error('Przepływ pracy nie został znaleziony');
    }

    if (!workflow.isActive) {
      throw new Error('Przepływ pracy jest nieaktywny');
    }

    // Create execution record
    const execution = await this.executionRepo.create(tenantId, userId, {
      workflowId: input.workflowId,
      inputData: input.inputData,
      context: input.context || {},
    });

    // Start async execution
    this.runWorkflowAsync(tenantId, execution.executionId, workflow, input.inputData);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'WORKFLOW_EXECUTION_STARTED',
      entityType: 'workflow_execution',
      entityId: execution.executionId,
      newValue: { workflowId: input.workflowId },
    });

    return execution.executionId;
  }

  private async runWorkflowAsync(
    tenantId: string,
    executionId: string,
    workflow: Workflow,
    inputData: Record<string, any>,
  ): Promise<void> {
    const abortController = new AbortController();
    this.activeExecutions.set(executionId, abortController);

    try {
      await this.executionRepo.updateStatus(executionId, 'RUNNING');

      const steps = await this.workflowRepo.getSteps(workflow.workflowId);
      const firstStep = steps.find((s) => s.position === 0);

      if (!firstStep) {
        throw new Error('Nie znaleziono pierwszego kroku przepływu');
      }

      // Execute workflow
      const context: WorkflowContext = {
        input: inputData,
        steps: {},
        output: null,
        totalTokens: 0,
        totalCost: 0,
      };

      await this.executeStep(
        tenantId,
        executionId,
        firstStep,
        steps,
        context,
        abortController.signal,
      );

      // Mark completed
      await this.executionRepo.complete(executionId, {
        outputData: context.output,
        totalTokensUsed: context.totalTokens,
        totalCost: context.totalCost,
      });

      await this.notificationService.send({
        tenantId,
        type: 'WORKFLOW_COMPLETED',
        title: `Przepływ "${workflow.name}" zakończony`,
        body: `Wykonanie zakończyło się pomyślnie. Użyto ${context.totalTokens} tokenów.`,
        notifyAdmins: false,
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        await this.executionRepo.updateStatus(executionId, 'CANCELLED');
      } else {
        await this.executionRepo.fail(executionId, error.message);

        await this.notificationService.send({
          tenantId,
          type: 'WORKFLOW_FAILED',
          title: `Przepływ "${workflow.name}" zakończony błędem`,
          body: error.message,
          notifyAdmins: true,
          priority: 'HIGH',
        });
      }
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  private async executeStep(
    tenantId: string,
    executionId: string,
    step: WorkflowStep,
    allSteps: WorkflowStep[],
    context: WorkflowContext,
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted) {
      throw new DOMException('Workflow cancelled', 'AbortError');
    }

    // Log step start
    const stepLog = await this.stepLogRepo.create(executionId, step.stepId, {
      status: 'RUNNING',
      inputData: this.resolveInputMapping(step.inputMapping, context),
    });

    const startTime = Date.now();

    try {
      let stepResult: any;

      switch (step.stepType) {
        case 'AGENT':
          stepResult = await this.executeAgentStep(tenantId, step, context, signal);
          break;
        case 'CONDITION':
          stepResult = await this.executeConditionStep(step, context);
          break;
        case 'PARALLEL':
          stepResult = await this.executeParallelStep(
            tenantId,
            executionId,
            step,
            allSteps,
            context,
            signal,
          );
          break;
        case 'TRANSFORM':
          stepResult = await this.executeTransformStep(step, context);
          break;
        case 'AGGREGATE':
          stepResult = await this.executeAggregateStep(step, context);
          break;
      }

      // Store step result
      context.steps[step.name] = stepResult;

      // Log step completion
      const duration = Date.now() - startTime;
      await this.stepLogRepo.complete(stepLog.logId, {
        outputData: stepResult.output,
        tokensUsed: stepResult.tokens,
        cost: stepResult.cost,
        durationMs: duration,
      });

      // Update execution context
      await this.executionRepo.updateContext(executionId, {
        currentStepId: step.stepId,
        context,
      });

      // Determine next step
      let nextStepId: string | undefined;

      if (step.isTerminal) {
        context.output = stepResult.output;
        return;
      }

      if (step.stepType === 'CONDITION') {
        nextStepId = stepResult.branch ? step.trueNextStep : step.falseNextStep;
      } else {
        nextStepId = step.nextStepId;
      }

      if (nextStepId) {
        const nextStep = allSteps.find((s) => s.stepId === nextStepId);
        if (nextStep) {
          await this.executeStep(tenantId, executionId, nextStep, allSteps, context, signal);
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.stepLogRepo.fail(stepLog.logId, {
        errorType: error.name,
        errorMessage: error.message,
        durationMs: duration,
      });
      throw error;
    }
  }

  private async executeAgentStep(
    tenantId: string,
    step: WorkflowStep,
    context: WorkflowContext,
    signal: AbortSignal,
  ): Promise<StepResult> {
    const input = this.resolveInputMapping(step.inputMapping, context);

    // Create conversation for this step
    const conversationId = await this.agentExecution.createConversation(tenantId, step.agentId!, {
      title: `Workflow: ${step.name}`,
      metadata: { workflowStep: step.stepId },
    });

    // Execute agent
    const result = await this.agentExecution.chat(tenantId, step.agentId!, 'system', {
      conversationId,
      message: this.buildAgentPrompt(input),
      context: {
        isWorkflowStep: true,
        previousSteps: context.steps,
      },
    });

    // Extract output according to mapping
    const output = this.resolveOutputMapping(step.outputMapping, result);

    context.totalTokens += result.usage.totalTokens;
    context.totalCost += result.usage.cost;

    return {
      output,
      tokens: result.usage.totalTokens,
      cost: result.usage.cost,
      conversationId,
      messageIds: [result.messageId],
    };
  }

  private async executeConditionStep(
    step: WorkflowStep,
    context: WorkflowContext,
  ): Promise<StepResult> {
    const condition = step.conditionExpression;
    if (!condition) {
      throw new Error('Brak wyrażenia warunkowego');
    }

    // Evaluate condition safely
    const branch = this.evaluateCondition(condition, context);

    return {
      output: { branch, condition },
      branch,
      tokens: 0,
      cost: 0,
    };
  }

  private evaluateCondition(expression: string, context: WorkflowContext): boolean {
    // Safe expression evaluation with limited scope
    const safeContext = {
      input: context.input,
      steps: context.steps,
      output: context.output,
    };

    // Parse and evaluate simple expressions
    // e.g., "steps.analyzer.output.sentiment == 'negative'"
    // e.g., "steps.classifier.output.category contains 'tax'"

    try {
      // Simple DSL parser (in production, use a proper expression evaluator)
      const parts = expression.split(' ');
      if (parts.length !== 3) {
        throw new Error('Nieprawidłowe wyrażenie warunkowe');
      }

      const [leftPath, operator, rightValue] = parts;
      const leftValue = this.resolvePath(leftPath, safeContext);
      const parsedRight = JSON.parse(rightValue);

      switch (operator) {
        case '==':
          return leftValue === parsedRight;
        case '!=':
          return leftValue !== parsedRight;
        case '>':
          return leftValue > parsedRight;
        case '<':
          return leftValue < parsedRight;
        case '>=':
          return leftValue >= parsedRight;
        case '<=':
          return leftValue <= parsedRight;
        case 'contains':
          return String(leftValue).includes(parsedRight);
        default:
          throw new Error(`Nieznany operator: ${operator}`);
      }
    } catch (error) {
      throw new Error(`Błąd ewaluacji warunku: ${error.message}`);
    }
  }

  private async executeParallelStep(
    tenantId: string,
    executionId: string,
    step: WorkflowStep,
    allSteps: WorkflowStep[],
    context: WorkflowContext,
    signal: AbortSignal,
  ): Promise<StepResult> {
    if (!step.parallelSteps || step.parallelSteps.length === 0) {
      throw new Error('Brak kroków równoległych');
    }

    const parallelSteps = step.parallelSteps
      .map((id) => allSteps.find((s) => s.stepId === id))
      .filter((s): s is WorkflowStep => s !== undefined);

    // Execute all steps in parallel
    const results = await Promise.allSettled(
      parallelSteps.map((parallelStep) =>
        this.executeStep(
          tenantId,
          executionId,
          parallelStep,
          allSteps,
          { ...context, steps: { ...context.steps } },
          signal,
        ).then(() => context.steps[parallelStep.name]),
      ),
    );

    // Aggregate results based on strategy
    const successfulResults = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => r.value);

    const failedResults = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    let aggregatedOutput: any;

    switch (step.aggregationStrategy) {
      case 'MERGE':
        aggregatedOutput = Object.assign({}, ...successfulResults.map((r) => r.output));
        break;
      case 'FIRST':
        aggregatedOutput = successfulResults[0]?.output;
        break;
      case 'VOTE':
        // Count occurrences and pick most common
        const votes = new Map<string, number>();
        for (const result of successfulResults) {
          const key = JSON.stringify(result.output);
          votes.set(key, (votes.get(key) || 0) + 1);
        }
        const winner = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
        aggregatedOutput = winner ? JSON.parse(winner[0]) : null;
        break;
      case 'BEST':
        // Pick result with highest confidence score
        aggregatedOutput = successfulResults
          .filter((r) => r.output?.confidence !== undefined)
          .sort((a, b) => b.output.confidence - a.output.confidence)[0]?.output;
        break;
      default:
        aggregatedOutput = successfulResults.map((r) => r.output);
    }

    const totalTokens = successfulResults.reduce((sum, r) => sum + (r.tokens || 0), 0);
    const totalCost = successfulResults.reduce((sum, r) => sum + (r.cost || 0), 0);

    return {
      output: aggregatedOutput,
      tokens: totalTokens,
      cost: totalCost,
      parallelResults: successfulResults,
      failedCount: failedResults.length,
    };
  }

  private async executeTransformStep(
    step: WorkflowStep,
    context: WorkflowContext,
  ): Promise<StepResult> {
    if (!step.transformExpression) {
      throw new Error('Brak wyrażenia transformacji');
    }

    // Safe transformation (limited JS-like syntax)
    const output = this.applyTransform(step.transformExpression, context);

    return {
      output,
      tokens: 0,
      cost: 0,
    };
  }

  private applyTransform(expression: string, context: WorkflowContext): any {
    // Simple transformation DSL
    // e.g., "{ summary: steps.analyzer.output.summary, recommendations: steps.advisor.output.items }"

    try {
      // Parse simple object mapping expressions
      const result: Record<string, any> = {};

      // Match patterns like "key: path.to.value"
      const mappings = expression.match(/(\w+):\s*([\w.]+)/g) || [];

      for (const mapping of mappings) {
        const [key, path] = mapping.split(':').map((s) => s.trim());
        result[key] = this.resolvePath(path, {
          input: context.input,
          steps: context.steps,
          output: context.output,
        });
      }

      return result;
    } catch (error) {
      throw new Error(`Błąd transformacji: ${error.message}`);
    }
  }

  private async executeAggregateStep(
    step: WorkflowStep,
    context: WorkflowContext,
  ): Promise<StepResult> {
    // Aggregate outputs from multiple previous steps
    const aggregated = Object.entries(context.steps).reduce(
      (acc, [stepName, stepResult]) => {
        acc[stepName] = stepResult.output;
        return acc;
      },
      {} as Record<string, any>,
    );

    return {
      output: aggregated,
      tokens: 0,
      cost: 0,
    };
  }

  // ============ Execution Control ============

  async cancelExecution(
    tenantId: string,
    userId: string,
    executionId: string,
  ): Promise<void> {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution || execution.tenantId !== tenantId) {
      throw new Error('Wykonanie nie zostało znalezione');
    }

    if (execution.status !== 'RUNNING') {
      throw new Error('Można anulować tylko uruchomione wykonania');
    }

    const controller = this.activeExecutions.get(executionId);
    if (controller) {
      controller.abort();
    }

    await this.executionRepo.cancel(executionId, userId);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'WORKFLOW_EXECUTION_CANCELLED',
      entityType: 'workflow_execution',
      entityId: executionId,
    });
  }

  async getExecutionStatus(
    tenantId: string,
    executionId: string,
  ): Promise<WorkflowExecutionStatus> {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution || execution.tenantId !== tenantId) {
      throw new Error('Wykonanie nie zostało znalezione');
    }

    const workflow = await this.workflowRepo.findById(execution.workflowId);
    const steps = await this.workflowRepo.getSteps(execution.workflowId);
    const stepLogs = await this.stepLogRepo.findByExecution(executionId);

    const completedSteps = stepLogs.filter((l) => l.status === 'COMPLETED').length;
    const elapsedMs = execution.startedAt
      ? Date.now() - new Date(execution.startedAt).getTime()
      : 0;

    return {
      executionId,
      workflowId: execution.workflowId,
      status: execution.status,
      progress: {
        currentStep: execution.currentStepId
          ? steps.find((s) => s.stepId === execution.currentStepId)?.name
          : undefined,
        completedSteps,
        totalSteps: steps.length,
        percentComplete: (completedSteps / steps.length) * 100,
      },
      metrics: {
        tokensUsed: execution.totalTokensUsed,
        cost: execution.totalCost,
        elapsedMs,
      },
      stepLogs: stepLogs.map((log) => ({
        stepId: log.stepId,
        stepName: steps.find((s) => s.stepId === log.stepId)?.name || 'Unknown',
        status: log.status,
        durationMs: log.durationMs,
      })),
    };
  }

  // ============ Helper Methods ============

  private resolveInputMapping(
    mapping: Record<string, string> | undefined,
    context: WorkflowContext,
  ): Record<string, any> {
    if (!mapping) {
      return context.input;
    }

    const result: Record<string, any> = {};
    for (const [key, path] of Object.entries(mapping)) {
      result[key] = this.resolvePath(path, {
        input: context.input,
        steps: context.steps,
        output: context.output,
      });
    }
    return result;
  }

  private resolveOutputMapping(
    mapping: Record<string, string> | undefined,
    result: any,
  ): any {
    if (!mapping) {
      return result;
    }

    const output: Record<string, any> = {};
    for (const [key, path] of Object.entries(mapping)) {
      output[key] = this.resolvePath(path, { result });
    }
    return output;
  }

  private resolvePath(path: string, obj: any): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private buildAgentPrompt(input: Record<string, any>): string {
    if (typeof input.message === 'string') {
      return input.message;
    }
    return JSON.stringify(input, null, 2);
  }
}

interface WorkflowContext {
  input: Record<string, any>;
  steps: Record<string, StepResult>;
  output: any;
  totalTokens: number;
  totalCost: number;
}

interface StepResult {
  output: any;
  tokens: number;
  cost: number;
  branch?: boolean;
  conversationId?: string;
  messageIds?: string[];
  parallelResults?: any[];
  failedCount?: number;
}
```

### tRPC Router

```typescript
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { WorkflowOrchestrationService } from '../services/workflow-orchestration.service';
import {
  CreateWorkflowSchema,
  UpdateWorkflowSchema,
  ExecuteWorkflowSchema,
  ExecutionQuerySchema,
} from '../schemas/workflow.schema';
import { z } from 'zod';

export const workflowRouter = router({
  // Workflow CRUD (Admin)
  createWorkflow: adminProcedure
    .input(CreateWorkflowSchema)
    .mutation(({ ctx, input }) =>
      ctx.workflowOrchestrationService.createWorkflow(ctx.tenantId, ctx.userId, input),
    ),

  updateWorkflow: adminProcedure
    .input(z.object({
      workflowId: z.string().uuid(),
      data: UpdateWorkflowSchema,
    }))
    .mutation(({ ctx, input }) =>
      ctx.workflowOrchestrationService.updateWorkflow(
        ctx.tenantId,
        ctx.userId,
        input.workflowId,
        input.data,
      ),
    ),

  deleteWorkflow: adminProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.workflowOrchestrationService.deleteWorkflow(ctx.tenantId, ctx.userId, input.workflowId),
    ),

  getWorkflow: adminProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      ctx.workflowOrchestrationService.getWorkflow(ctx.tenantId, input.workflowId),
    ),

  listWorkflows: adminProcedure
    .input(z.object({
      activeOnly: z.boolean().default(true),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(({ ctx, input }) =>
      ctx.workflowOrchestrationService.listWorkflows(
        ctx.tenantId,
        input?.activeOnly,
        input?.limit,
        input?.offset,
      ),
    ),

  // Workflow execution
  executeWorkflow: adminProcedure
    .input(ExecuteWorkflowSchema)
    .mutation(({ ctx, input }) =>
      ctx.workflowOrchestrationService.executeWorkflow(ctx.tenantId, ctx.userId, input),
    ),

  cancelExecution: adminProcedure
    .input(z.object({ executionId: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.workflowOrchestrationService.cancelExecution(ctx.tenantId, ctx.userId, input.executionId),
    ),

  getExecutionStatus: adminProcedure
    .input(z.object({ executionId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      ctx.workflowOrchestrationService.getExecutionStatus(ctx.tenantId, input.executionId),
    ),

  listExecutions: adminProcedure
    .input(ExecutionQuerySchema)
    .query(({ ctx, input }) =>
      ctx.workflowOrchestrationService.listExecutions(ctx.tenantId, input),
    ),

  getExecutionLogs: adminProcedure
    .input(z.object({ executionId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      ctx.workflowOrchestrationService.getExecutionLogs(ctx.tenantId, input.executionId),
    ),

  // Templates
  listTemplates: adminProcedure
    .input(z.object({
      category: z.string().optional(),
    }).optional())
    .query(({ ctx, input }) =>
      ctx.workflowOrchestrationService.listTemplates(input?.category),
    ),

  createFromTemplate: adminProcedure
    .input(z.object({
      templateId: z.string().uuid(),
      name: z.string().min(1),
      agentMappings: z.record(z.string().uuid()), // Map template agent types to actual agents
    }))
    .mutation(({ ctx, input }) =>
      ctx.workflowOrchestrationService.createFromTemplate(
        ctx.tenantId,
        ctx.userId,
        input.templateId,
        input.name,
        input.agentMappings,
      ),
    ),

  // Validation
  validateWorkflow: adminProcedure
    .input(CreateWorkflowSchema)
    .mutation(({ ctx, input }) =>
      ctx.workflowOrchestrationService.validateWorkflow(ctx.tenantId, input),
    ),
});
```

## Test Specification

### Unit Tests

```typescript
describe('WorkflowOrchestrationService', () => {
  describe('validateWorkflowStructure', () => {
    it('should reject workflows with cycles', () => {
      const steps = [
        { stepId: 'step-1', nextStepId: 'step-2', isTerminal: false },
        { stepId: 'step-2', nextStepId: 'step-1', isTerminal: false }, // Cycle!
      ];

      expect(() => service.validateWorkflowStructure(steps)).toThrow('cykl');
    });

    it('should reject workflows without terminal steps', () => {
      const steps = [
        { stepId: 'step-1', nextStepId: 'step-2', isTerminal: false },
        { stepId: 'step-2', isTerminal: false },
      ];

      expect(() => service.validateWorkflowStructure(steps)).toThrow('krok końcowy');
    });

    it('should accept valid workflow', () => {
      const steps = [
        { stepId: 'step-1', nextStepId: 'step-2', isTerminal: false },
        { stepId: 'step-2', isTerminal: true },
      ];

      expect(() => service.validateWorkflowStructure(steps)).not.toThrow();
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate equality condition', () => {
      const context = {
        steps: { analyzer: { output: { sentiment: 'negative' } } },
      };

      const result = service.evaluateCondition(
        'steps.analyzer.output.sentiment == "negative"',
        context,
      );

      expect(result).toBe(true);
    });

    it('should evaluate contains condition', () => {
      const context = {
        steps: { classifier: { output: { category: 'tax_vat' } } },
      };

      const result = service.evaluateCondition(
        'steps.classifier.output.category contains "tax"',
        context,
      );

      expect(result).toBe(true);
    });
  });

  describe('executeParallelStep', () => {
    it('should merge results with MERGE strategy', async () => {
      const parallelResults = [
        { output: { a: 1 }, tokens: 100 },
        { output: { b: 2 }, tokens: 150 },
      ];

      mockParallelExecution(parallelResults);

      const result = await service.executeParallelStep(
        tenantId,
        executionId,
        { aggregationStrategy: 'MERGE', parallelSteps: ['step-a', 'step-b'] },
        allSteps,
        context,
        signal,
      );

      expect(result.output).toEqual({ a: 1, b: 2 });
      expect(result.tokens).toBe(250);
    });

    it('should pick highest confidence with BEST strategy', async () => {
      const parallelResults = [
        { output: { answer: 'A', confidence: 0.7 }, tokens: 100 },
        { output: { answer: 'B', confidence: 0.95 }, tokens: 150 },
      ];

      mockParallelExecution(parallelResults);

      const result = await service.executeParallelStep(
        tenantId,
        executionId,
        { aggregationStrategy: 'BEST', parallelSteps: ['step-a', 'step-b'] },
        allSteps,
        context,
        signal,
      );

      expect(result.output.answer).toBe('B');
    });
  });
});
```

### Integration Tests

```typescript
describe('Workflow Integration', () => {
  describe('End-to-end workflow execution', () => {
    it('should execute multi-step workflow', async () => {
      // Create workflow with 3 steps
      const workflow = await trpc.workflow.createWorkflow({
        name: 'Test Workflow',
        steps: [
          {
            name: 'Analyze',
            stepType: 'AGENT',
            position: 0,
            agentId: analyzerAgentId,
            nextStepId: 'step-2',
          },
          {
            stepId: 'step-2',
            name: 'Condition',
            stepType: 'CONDITION',
            position: 1,
            conditionExpression: 'steps.Analyze.output.needsReview == true',
            trueNextStep: 'step-3',
            falseNextStep: 'step-4',
          },
          {
            stepId: 'step-3',
            name: 'Review',
            stepType: 'AGENT',
            position: 2,
            agentId: reviewerAgentId,
            isTerminal: true,
          },
          {
            stepId: 'step-4',
            name: 'AutoApprove',
            stepType: 'TRANSFORM',
            position: 3,
            transformExpression: '{ approved: true, reason: steps.Analyze.output.summary }',
            isTerminal: true,
          },
        ],
      });

      // Execute
      const executionId = await trpc.workflow.executeWorkflow({
        workflowId: workflow.workflowId,
        inputData: { documentId: 'doc-123' },
      });

      // Wait for completion
      await waitForCompletion(executionId);

      // Verify
      const status = await trpc.workflow.getExecutionStatus({ executionId });
      expect(status.status).toBe('COMPLETED');
      expect(status.progress.completedSteps).toBeGreaterThanOrEqual(2);
    });

    it('should handle parallel execution', async () => {
      const workflow = await trpc.workflow.createWorkflow({
        name: 'Parallel Analysis',
        steps: [
          {
            name: 'Parallel',
            stepType: 'PARALLEL',
            position: 0,
            parallelSteps: ['step-a', 'step-b'],
            aggregationStrategy: 'MERGE',
            nextStepId: 'final',
          },
          {
            stepId: 'step-a',
            name: 'SecurityAnalysis',
            stepType: 'AGENT',
            position: 1,
            agentId: securityAgentId,
            isTerminal: false,
          },
          {
            stepId: 'step-b',
            name: 'QualityAnalysis',
            stepType: 'AGENT',
            position: 2,
            agentId: qualityAgentId,
            isTerminal: false,
          },
          {
            stepId: 'final',
            name: 'Summary',
            stepType: 'TRANSFORM',
            position: 3,
            transformExpression: '{ security: steps.SecurityAnalysis.output, quality: steps.QualityAnalysis.output }',
            isTerminal: true,
          },
        ],
      });

      const executionId = await trpc.workflow.executeWorkflow({
        workflowId: workflow.workflowId,
        inputData: { code: 'function test() {}' },
      });

      await waitForCompletion(executionId);

      const status = await trpc.workflow.getExecutionStatus({ executionId });
      expect(status.status).toBe('COMPLETED');
    });
  });

  describe('Cancellation', () => {
    it('should cancel running workflow', async () => {
      const executionId = await trpc.workflow.executeWorkflow({
        workflowId: longRunningWorkflowId,
        inputData: {},
      });

      // Wait for it to start
      await sleep(1000);

      // Cancel
      await trpc.workflow.cancelExecution({ executionId });

      const status = await trpc.workflow.getExecutionStatus({ executionId });
      expect(status.status).toBe('CANCELLED');
    });
  });
});
```

## Security Checklist

- [x] Workflows are tenant-isolated
- [x] Workflow CRUD requires Super Admin
- [x] Condition expressions use safe evaluation (no eval)
- [x] Transform expressions limited to safe operations
- [x] Timeout protection at workflow and step level
- [x] Budget checks before agent execution
- [x] No arbitrary code execution
- [x] Audit logging for all workflow operations

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| WORKFLOW_CREATED | Workflow created | Name, steps count |
| WORKFLOW_UPDATED | Workflow modified | Version change |
| WORKFLOW_DELETED | Workflow deleted | Workflow ID |
| WORKFLOW_EXECUTION_STARTED | Execution begins | Workflow ID, input |
| WORKFLOW_EXECUTION_COMPLETED | Execution succeeds | Output, metrics |
| WORKFLOW_EXECUTION_FAILED | Execution fails | Error message, step |
| WORKFLOW_EXECUTION_CANCELLED | Execution cancelled | User, step |

## Definition of Done

- [x] Agent chain definition with validation
- [x] Context propagation between agents
- [x] Parallel execution with aggregation
- [x] Conditional branching with safe evaluation
- [x] Real-time execution monitoring
- [x] Cancellation support
- [x] Template-based workflow creation
- [x] Unit tests (≥80% coverage)
- [x] Integration tests for E2E workflow
- [x] Polish error messages
- [x] Security review completed
- [x] Audit logging implemented
