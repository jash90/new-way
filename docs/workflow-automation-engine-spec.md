# Workflow Automation Engine (WAE) - Complete Technical Specification

## A. Module Overview

### Purpose
The Workflow Automation Engine (WAE) is responsible for automating repetitive tasks and business processes across the organization. It provides a centralized platform for designing, executing, monitoring, and managing automated workflows using n8n as the core execution engine.

### Scope
The module handles the following functionalities:
- Visual workflow design and configuration
- Workflow execution and orchestration
- Real-time workflow monitoring and status tracking
- Integration with all system modules via REST APIs
- Scheduled and event-driven workflow triggers
- Error handling and retry mechanisms
- Workflow versioning and deployment management
- Performance analytics and optimization
- Audit trail and compliance logging
- Template management for common workflows

### Dependencies
- **Core API Gateway**: For accessing all module APIs
- **Authentication Service**: For workflow execution authorization
- **Database Service**: For workflow persistence
- **Message Queue Service**: For asynchronous task processing
- **Notification Module**: For sending workflow notifications
- **File Storage Service**: For workflow artifacts and logs
- **Monitoring Service**: For metrics and alerting

### Consumers
- **Task Management Module**: Creates tasks from workflow outputs
- **Notification Module**: Receives workflow status updates
- **Client Portal**: Views workflow execution history
- **Admin Dashboard**: Manages workflow configurations
- **Reporting Module**: Accesses workflow analytics
- **Compliance Module**: Audits workflow executions

## B. Technical Specification

### 1. Technology Stack

**Primary Framework**: Node.js with TypeScript
- Justification: Native compatibility with n8n, excellent async handling

**Workflow Engine**: n8n (self-hosted)
- Justification: Open-source, extensible, visual workflow builder

**Database**: PostgreSQL 14+
- Main entities: workflows, executions, templates, triggers
- Justification: ACID compliance, JSON support for workflow definitions

**Caching**: Redis 7+
- Cache workflow definitions, execution states, frequently accessed templates
- Justification: High-performance in-memory storage, pub/sub for events

**Message Queue**: RabbitMQ
- Justification: Reliable message delivery, workflow event distribution

**Security**: 
- OAuth 2.0 for API authentication
- AES-256 encryption for sensitive workflow data
- TLS 1.3 for all communications

### 2. Key Interfaces

```typescript
// Main service interface
export interface IWorkflowAutomationService {
  // Workflow lifecycle management
  createWorkflow(workflow: WorkflowDefinitionDTO): Promise<WorkflowResponse>;
  updateWorkflow(id: string, updates: Partial<WorkflowDefinitionDTO>): Promise<WorkflowResponse>;
  deleteWorkflow(id: string): Promise<void>;
  deployWorkflow(id: string, environment: Environment): Promise<DeploymentResponse>;
  
  // Execution management
  executeWorkflow(id: string, params?: ExecutionParams): Promise<ExecutionResponse>;
  pauseExecution(executionId: string): Promise<void>;
  resumeExecution(executionId: string): Promise<void>;
  cancelExecution(executionId: string): Promise<void>;
  
  // Monitoring and analytics
  getExecutionStatus(executionId: string): Promise<ExecutionStatus>;
  getWorkflowMetrics(id: string, timeRange: TimeRange): Promise<WorkflowMetrics>;
  getExecutionHistory(workflowId: string, filters: ExecutionFilters): Promise<ExecutionHistory[]>;
  
  // Template management
  createTemplate(template: WorkflowTemplateDTO): Promise<TemplateResponse>;
  instantiateTemplate(templateId: string, params: TemplateParams): Promise<WorkflowResponse>;
}

// Data Transfer Objects
export interface WorkflowDefinitionDTO {
  name: string;
  description: string;
  category: WorkflowCategory;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  variables: WorkflowVariable[];
  errorHandling: ErrorHandlingStrategy;
  retryPolicy: RetryPolicy;
  timeout: number;
  tags: string[];
  permissions: WorkflowPermissions;
}

export interface WorkflowTrigger {
  type: 'manual' | 'scheduled' | 'webhook' | 'event' | 'api';
  config: TriggerConfig;
  conditions?: TriggerCondition[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  config: StepConfiguration;
  inputs: StepInput[];
  outputs: StepOutput[];
  errorHandler?: ErrorHandler;
  retryConfig?: StepRetryConfig;
  conditions?: StepCondition[];
  timeout?: number;
}

export interface ExecutionParams {
  inputData?: Record<string, any>;
  priority?: ExecutionPriority;
  scheduledAt?: Date;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface ExecutionResponse {
  executionId: string;
  workflowId: string;
  status: ExecutionStatus;
  startedAt: Date;
  estimatedCompletion?: Date;
  outputs?: Record<string, any>;
  errors?: ExecutionError[];
}

// Event interfaces
export interface WorkflowEvent {
  id: string;
  type: WorkflowEventType;
  workflowId: string;
  executionId?: string;
  timestamp: Date;
  data: Record<string, any>;
  userId: string;
  correlationId: string;
}

export type WorkflowEventType = 
  | 'workflow.created'
  | 'workflow.updated'
  | 'workflow.deployed'
  | 'execution.started'
  | 'execution.completed'
  | 'execution.failed'
  | 'execution.paused'
  | 'step.started'
  | 'step.completed'
  | 'step.failed';

// Configuration interfaces
export interface WorkflowEngineConfig {
  n8n: N8NConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  rabbitmq: RabbitMQConfig;
  execution: ExecutionConfig;
  monitoring: MonitoringConfig;
  security: SecurityConfig;
}

export interface N8NConfig {
  host: string;
  port: number;
  apiKey: string;
  webhookUrl: string;
  executionMode: 'regular' | 'queue';
  maxConcurrentExecutions: number;
}
```

### 3. API Endpoints

```typescript
// RESTful API endpoints
export const workflowRoutes = {
  // Workflow management
  'POST   /api/v1/workflows': 'Create new workflow',
  'GET    /api/v1/workflows': 'List all workflows',
  'GET    /api/v1/workflows/:id': 'Get workflow details',
  'PUT    /api/v1/workflows/:id': 'Update workflow',
  'DELETE /api/v1/workflows/:id': 'Delete workflow',
  'POST   /api/v1/workflows/:id/duplicate': 'Duplicate workflow',
  'POST   /api/v1/workflows/:id/deploy': 'Deploy workflow',
  'POST   /api/v1/workflows/:id/validate': 'Validate workflow',
  
  // Execution management
  'POST   /api/v1/workflows/:id/execute': 'Execute workflow',
  'GET    /api/v1/executions': 'List executions',
  'GET    /api/v1/executions/:id': 'Get execution details',
  'POST   /api/v1/executions/:id/pause': 'Pause execution',
  'POST   /api/v1/executions/:id/resume': 'Resume execution',
  'POST   /api/v1/executions/:id/cancel': 'Cancel execution',
  'GET    /api/v1/executions/:id/logs': 'Get execution logs',
  
  // Template management
  'GET    /api/v1/templates': 'List workflow templates',
  'POST   /api/v1/templates': 'Create template',
  'GET    /api/v1/templates/:id': 'Get template details',
  'POST   /api/v1/templates/:id/instantiate': 'Create workflow from template',
  
  // Monitoring and analytics
  'GET    /api/v1/workflows/:id/metrics': 'Get workflow metrics',
  'GET    /api/v1/workflows/:id/history': 'Get execution history',
  'GET    /api/v1/analytics/performance': 'Get performance analytics',
  'GET    /api/v1/health': 'Health check endpoint',
  
  // Webhook endpoints
  'POST   /api/v1/webhooks/:workflowId': 'Trigger workflow via webhook',
  'GET    /api/v1/webhooks/:workflowId/status': 'Get webhook status'
};
```

## C. Implementation Details

### 1. Main Service Implementation

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { N8NClient } from './clients/n8n.client';
import { RedisService } from './services/redis.service';
import { MetricsService } from './services/metrics.service';

@Injectable()
export class WorkflowAutomationService implements IWorkflowAutomationService {
  private readonly logger = new Logger(WorkflowAutomationService.name);
  
  constructor(
    @InjectRepository(WorkflowEntity)
    private readonly workflowRepository: Repository<WorkflowEntity>,
    @InjectRepository(ExecutionEntity)
    private readonly executionRepository: Repository<ExecutionEntity>,
    private readonly n8nClient: N8NClient,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
    private readonly dataSource: DataSource,
    private readonly validationService: WorkflowValidationService,
    private readonly authService: AuthenticationService
  ) {}

  async createWorkflow(dto: WorkflowDefinitionDTO): Promise<WorkflowResponse> {
    const startTime = Date.now();
    const correlationId = this.generateCorrelationId();
    
    try {
      // Input validation
      await this.validationService.validateWorkflowDefinition(dto);
      
      // Check permissions
      await this.authService.checkPermission('workflow.create', dto.permissions);
      
      // Start transaction
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      
      try {
        // Create workflow entity
        const workflow = new WorkflowEntity();
        workflow.id = this.generateWorkflowId();
        workflow.name = dto.name;
        workflow.description = dto.description;
        workflow.category = dto.category;
        workflow.definition = JSON.stringify(dto);
        workflow.status = WorkflowStatus.DRAFT;
        workflow.version = 1;
        workflow.createdBy = await this.authService.getCurrentUserId();
        workflow.tags = dto.tags;
        
        // Save to database
        await queryRunner.manager.save(workflow);
        
        // Convert to n8n format
        const n8nWorkflow = await this.convertToN8nFormat(dto, workflow.id);
        
        // Create in n8n
        const n8nResponse = await this.n8nClient.createWorkflow(n8nWorkflow);
        workflow.n8nWorkflowId = n8nResponse.id;
        
        await queryRunner.manager.save(workflow);
        
        // Cache workflow definition
        await this.redisService.setWithTTL(
          `workflow:${workflow.id}`,
          JSON.stringify(workflow),
          3600 // 1 hour TTL
        );
        
        // Emit event
        await this.eventEmitter.emit('workflow.created', {
          id: this.generateEventId(),
          type: 'workflow.created',
          workflowId: workflow.id,
          timestamp: new Date(),
          data: { name: workflow.name, category: workflow.category },
          userId: workflow.createdBy,
          correlationId
        });
        
        // Commit transaction
        await queryRunner.commitTransaction();
        
        // Log audit
        await this.logAuditEvent('WORKFLOW_CREATED', workflow.id, dto);
        
        // Record metrics
        this.metricsService.recordCounter('workflows.created', 1);
        this.metricsService.recordHistogram('workflows.creation.duration', Date.now() - startTime);
        
        this.logger.log(`Workflow created successfully: ${workflow.id}`);
        
        return this.toWorkflowResponse(workflow);
        
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
      
    } catch (error) {
      this.logger.error(`Failed to create workflow: ${error.message}`, error.stack);
      this.metricsService.recordCounter('workflows.creation.errors', 1);
      throw new WorkflowCreationException(error.message, correlationId);
    }
  }

  async executeWorkflow(id: string, params?: ExecutionParams): Promise<ExecutionResponse> {
    const startTime = Date.now();
    const correlationId = params?.correlationId || this.generateCorrelationId();
    
    try {
      // Validate workflow exists and is active
      const workflow = await this.getWorkflowWithValidation(id);
      
      // Check execution permissions
      await this.authService.checkPermission('workflow.execute', workflow.permissions);
      
      // Check rate limits
      await this.checkExecutionRateLimit(id);
      
      // Create execution record
      const execution = new ExecutionEntity();
      execution.id = this.generateExecutionId();
      execution.workflowId = workflow.id;
      execution.status = ExecutionStatus.PENDING;
      execution.inputData = params?.inputData || {};
      execution.priority = params?.priority || ExecutionPriority.NORMAL;
      execution.correlationId = correlationId;
      execution.startedBy = await this.authService.getCurrentUserId();
      execution.scheduledAt = params?.scheduledAt || new Date();
      
      await this.executionRepository.save(execution);
      
      // Emit execution started event
      await this.eventEmitter.emit('execution.started', {
        id: this.generateEventId(),
        type: 'execution.started',
        workflowId: workflow.id,
        executionId: execution.id,
        timestamp: new Date(),
        data: { priority: execution.priority },
        userId: execution.startedBy,
        correlationId
      });
      
      // Execute workflow based on priority
      if (execution.priority === ExecutionPriority.HIGH) {
        await this.executeHighPriorityWorkflow(workflow, execution);
      } else {
        await this.queueWorkflowExecution(workflow, execution);
      }
      
      // Record metrics
      this.metricsService.recordCounter('workflows.executions.started', 1);
      this.metricsService.recordHistogram('workflows.execution.queue.time', Date.now() - startTime);
      
      return {
        executionId: execution.id,
        workflowId: workflow.id,
        status: execution.status,
        startedAt: execution.scheduledAt,
        estimatedCompletion: this.calculateEstimatedCompletion(workflow, execution.priority)
      };
      
    } catch (error) {
      this.logger.error(`Failed to execute workflow ${id}: ${error.message}`, error.stack);
      this.metricsService.recordCounter('workflows.execution.errors', 1);
      throw new WorkflowExecutionException(error.message, id, correlationId);
    }
  }

  private async executeHighPriorityWorkflow(workflow: WorkflowEntity, execution: ExecutionEntity): Promise<void> {
    try {
      // Update status
      execution.status = ExecutionStatus.RUNNING;
      execution.startedAt = new Date();
      await this.executionRepository.save(execution);
      
      // Execute in n8n
      const n8nExecution = await this.n8nClient.executeWorkflow(
        workflow.n8nWorkflowId,
        {
          data: execution.inputData,
          executionId: execution.id
        }
      );
      
      // Monitor execution
      this.startExecutionMonitoring(execution.id, n8nExecution.id);
      
    } catch (error) {
      execution.status = ExecutionStatus.FAILED;
      execution.error = error.message;
      await this.executionRepository.save(execution);
      throw error;
    }
  }

  private async queueWorkflowExecution(workflow: WorkflowEntity, execution: ExecutionEntity): Promise<void> {
    const queueMessage = {
      executionId: execution.id,
      workflowId: workflow.id,
      n8nWorkflowId: workflow.n8nWorkflowId,
      inputData: execution.inputData,
      priority: execution.priority,
      correlationId: execution.correlationId
    };
    
    await this.messageQueue.publish('workflow.execution.queue', queueMessage);
  }

  private async startExecutionMonitoring(executionId: string, n8nExecutionId: string): Promise<void> {
    const monitoringInterval = setInterval(async () => {
      try {
        const n8nStatus = await this.n8nClient.getExecutionStatus(n8nExecutionId);
        const execution = await this.executionRepository.findOne({ where: { id: executionId } });
        
        if (!execution) {
          clearInterval(monitoringInterval);
          return;
        }
        
        // Update execution status
        execution.status = this.mapN8nStatusToExecutionStatus(n8nStatus.status);
        
        if (n8nStatus.finished) {
          execution.completedAt = new Date();
          execution.outputs = n8nStatus.data;
          clearInterval(monitoringInterval);
          
          // Emit completion event
          await this.eventEmitter.emit('execution.completed', {
            id: this.generateEventId(),
            type: 'execution.completed',
            workflowId: execution.workflowId,
            executionId: execution.id,
            timestamp: new Date(),
            data: { outputs: execution.outputs },
            userId: execution.startedBy,
            correlationId: execution.correlationId
          });
        }
        
        if (n8nStatus.error) {
          execution.error = n8nStatus.error;
          clearInterval(monitoringInterval);
          
          // Handle error with retry logic
          await this.handleExecutionError(execution, n8nStatus.error);
        }
        
        await this.executionRepository.save(execution);
        
      } catch (error) {
        this.logger.error(`Monitoring error for execution ${executionId}: ${error.message}`);
      }
    }, 5000); // Check every 5 seconds
  }

  private async handleExecutionError(execution: ExecutionEntity, error: any): Promise<void> {
    const workflow = await this.workflowRepository.findOne({ where: { id: execution.workflowId } });
    const definition = JSON.parse(workflow.definition) as WorkflowDefinitionDTO;
    
    execution.retryCount = (execution.retryCount || 0) + 1;
    
    if (execution.retryCount <= definition.retryPolicy.maxRetries) {
      // Schedule retry
      const delay = this.calculateRetryDelay(execution.retryCount, definition.retryPolicy);
      
      setTimeout(async () => {
        await this.retryWorkflowExecution(execution);
      }, delay);
      
      this.logger.log(`Scheduling retry ${execution.retryCount} for execution ${execution.id} in ${delay}ms`);
    } else {
      // Max retries exceeded
      execution.status = ExecutionStatus.FAILED;
      await this.executionRepository.save(execution);
      
      // Trigger error handling workflow if configured
      if (definition.errorHandling.errorWorkflowId) {
        await this.triggerErrorWorkflow(definition.errorHandling.errorWorkflowId, execution, error);
      }
      
      // Emit failure event
      await this.eventEmitter.emit('execution.failed', {
        id: this.generateEventId(),
        type: 'execution.failed',
        workflowId: execution.workflowId,
        executionId: execution.id,
        timestamp: new Date(),
        data: { error: error.message, retryCount: execution.retryCount },
        userId: execution.startedBy,
        correlationId: execution.correlationId
      });
    }
  }

  private calculateRetryDelay(retryCount: number, retryPolicy: RetryPolicy): number {
    switch (retryPolicy.strategy) {
      case 'exponential':
        return Math.min(
          retryPolicy.initialDelay * Math.pow(2, retryCount - 1),
          retryPolicy.maxDelay
        );
      case 'linear':
        return Math.min(
          retryPolicy.initialDelay * retryCount,
          retryPolicy.maxDelay
        );
      case 'fixed':
      default:
        return retryPolicy.initialDelay;
    }
  }
}
```

### 2. Core Methods

```typescript
export class WorkflowOrchestrator {
  async deployWorkflow(id: string, environment: Environment): Promise<DeploymentResponse> {
    const deployment = await this.dataSource.transaction(async manager => {
      // Validate workflow is ready for deployment
      const workflow = await manager.findOne(WorkflowEntity, { where: { id } });
      
      if (!workflow) {
        throw new WorkflowNotFoundException(id);
      }
      
      if (workflow.status === WorkflowStatus.DRAFT) {
        throw new InvalidWorkflowStateException('Cannot deploy draft workflow');
      }
      
      // Validate workflow definition
      const validationResult = await this.validationService.validateForDeployment(workflow);
      
      if (!validationResult.isValid) {
        throw new WorkflowValidationException(validationResult.errors);
      }
      
      // Create deployment record
      const deployment = new DeploymentEntity();
      deployment.id = this.generateDeploymentId();
      deployment.workflowId = workflow.id;
      deployment.environment = environment;
      deployment.version = workflow.version;
      deployment.deployedBy = await this.authService.getCurrentUserId();
      deployment.status = DeploymentStatus.IN_PROGRESS;
      
      await manager.save(deployment);
      
      // Activate in n8n
      await this.n8nClient.activateWorkflow(workflow.n8nWorkflowId);
      
      // Update workflow status
      workflow.status = WorkflowStatus.ACTIVE;
      workflow.lastDeployedAt = new Date();
      workflow.lastDeployedVersion = workflow.version;
      await manager.save(workflow);
      
      // Update deployment status
      deployment.status = DeploymentStatus.SUCCESS;
      deployment.completedAt = new Date();
      await manager.save(deployment);
      
      // Clear cache
      await this.redisService.delete(`workflow:${workflow.id}`);
      
      return deployment;
    });
    
    // Emit deployment event
    await this.eventEmitter.emit('workflow.deployed', {
      id: this.generateEventId(),
      type: 'workflow.deployed',
      workflowId: id,
      timestamp: new Date(),
      data: { environment, version: deployment.version },
      userId: deployment.deployedBy,
      correlationId: this.generateCorrelationId()
    });
    
    return {
      deploymentId: deployment.id,
      workflowId: deployment.workflowId,
      environment: deployment.environment,
      status: deployment.status,
      deployedAt: deployment.completedAt
    };
  }

  async getWorkflowMetrics(id: string, timeRange: TimeRange): Promise<WorkflowMetrics> {
    // Validate workflow exists
    const workflow = await this.workflowRepository.findOne({ where: { id } });
    
    if (!workflow) {
      throw new WorkflowNotFoundException(id);
    }
    
    // Get execution statistics
    const executions = await this.executionRepository
      .createQueryBuilder('execution')
      .where('execution.workflowId = :workflowId', { workflowId: id })
      .andWhere('execution.startedAt >= :start', { start: timeRange.start })
      .andWhere('execution.startedAt <= :end', { end: timeRange.end })
      .getMany();
    
    // Calculate metrics
    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(e => e.status === ExecutionStatus.SUCCESS).length;
    const failedExecutions = executions.filter(e => e.status === ExecutionStatus.FAILED).length;
    const averageDuration = this.calculateAverageDuration(executions);
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;
    
    // Get performance percentiles
    const durations = executions
      .filter(e => e.completedAt && e.startedAt)
      .map(e => e.completedAt.getTime() - e.startedAt.getTime())
      .sort((a, b) => a - b);
    
    const p50 = this.getPercentile(durations, 50);
    const p95 = this.getPercentile(durations, 95);
    const p99 = this.getPercentile(durations, 99);
    
    // Get error analysis
    const errorAnalysis = await this.analyzeErrors(executions.filter(e => e.error));
    
    return {
      workflowId: id,
      timeRange,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate,
      averageDuration,
      performanceMetrics: {
        p50,
        p95,
        p99,
        min: Math.min(...durations),
        max: Math.max(...durations)
      },
      errorAnalysis,
      executionsByStatus: this.groupExecutionsByStatus(executions),
      executionsByHour: this.groupExecutionsByHour(executions),
      topErrors: this.getTopErrors(executions)
    };
  }
}
```

### 3. Helper Methods

```typescript
export class WorkflowHelpers {
  private convertToN8nFormat(definition: WorkflowDefinitionDTO, workflowId: string): N8NWorkflow {
    const nodes: N8NNode[] = [];
    const connections: N8NConnection = {};
    
    // Create start node
    const startNode: N8NNode = {
      id: 'start_node',
      name: 'Start',
      type: this.mapTriggerTypeToN8nNode(definition.trigger.type),
      position: [250, 300],
      parameters: this.mapTriggerConfigToN8nParams(definition.trigger.config)
    };
    nodes.push(startNode);
    
    // Convert workflow steps to n8n nodes
    let previousNodeId = 'start_node';
    definition.steps.forEach((step, index) => {
      const nodeId = `node_${step.id}`;
      const node: N8NNode = {
        id: nodeId,
        name: step.name,
        type: this.mapStepTypeToN8nNode(step.type),
        position: [250 + (index + 1) * 200, 300],
        parameters: this.mapStepConfigToN8nParams(step.config),
        continueOnFail: step.errorHandler?.continueOnFail || false,
        retryOnFail: step.retryConfig?.enabled || false,
        maxTries: step.retryConfig?.maxAttempts || 1,
        waitBetweenTries: step.retryConfig?.delay || 1000
      };
      
      nodes.push(node);
      
      // Create connections
      if (!connections[previousNodeId]) {
        connections[previousNodeId] = { main: [[]] };
      }
      connections[previousNodeId].main[0].push({ node: nodeId, type: 'main', index: 0 });
      
      previousNodeId = nodeId;
    });
    
    return {
      name: definition.name,
      nodes,
      connections,
      settings: {
        executionOrder: 'v1',
        saveExecutionProgress: true,
        saveDataSuccessExecution: 'all',
        saveDataErrorExecution: 'all',
        errorWorkflow: definition.errorHandling.errorWorkflowId,
        timezone: 'Europe/Warsaw',
        executionTimeout: definition.timeout
      },
      staticData: {
        workflowId,
        version: '1.0.0'
      },
      tags: definition.tags.map(tag => ({ name: tag }))
    };
  }

  private validateWorkflowDefinition(definition: WorkflowDefinitionDTO): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Validate basic properties
    if (!definition.name || definition.name.length < 3) {
      errors.push({ field: 'name', message: 'Workflow name must be at least 3 characters' });
    }
    
    if (!definition.trigger) {
      errors.push({ field: 'trigger', message: 'Workflow must have a trigger' });
    }
    
    if (!definition.steps || definition.steps.length === 0) {
      errors.push({ field: 'steps', message: 'Workflow must have at least one step' });
    }
    
    // Validate trigger configuration
    if (definition.trigger) {
      const triggerErrors = this.validateTrigger(definition.trigger);
      errors.push(...triggerErrors);
    }
    
    // Validate steps
    definition.steps?.forEach((step, index) => {
      const stepErrors = this.validateStep(step, index);
      errors.push(...stepErrors);
    });
    
    // Validate step connections
    const connectionErrors = this.validateStepConnections(definition.steps);
    errors.push(...connectionErrors);
    
    // Validate variables
    if (definition.variables) {
      const variableErrors = this.validateVariables(definition.variables);
      errors.push(...variableErrors);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async checkExecutionRateLimit(workflowId: string): Promise<void> {
    const key = `rate_limit:workflow:${workflowId}`;
    const limit = 100; // 100 executions per hour
    const window = 3600; // 1 hour in seconds
    
    const current = await this.redisService.incr(key);
    
    if (current === 1) {
      await this.redisService.expire(key, window);
    }
    
    if (current > limit) {
      throw new RateLimitExceededException(`Workflow ${workflowId} has exceeded rate limit`);
    }
  }

  private calculateEstimatedCompletion(workflow: WorkflowEntity, priority: ExecutionPriority): Date {
    // Get average execution time from metrics
    const avgExecutionTime = this.metricsService.getAverageExecutionTime(workflow.id);
    
    // Get current queue depth
    const queueDepth = this.getQueueDepth(priority);
    
    // Calculate estimated wait time based on priority
    let waitTime = 0;
    switch (priority) {
      case ExecutionPriority.HIGH:
        waitTime = 0; // Immediate execution
        break;
      case ExecutionPriority.NORMAL:
        waitTime = queueDepth * 5000; // 5 seconds per queued item
        break;
      case ExecutionPriority.LOW:
        waitTime = queueDepth * 10000; // 10 seconds per queued item
        break;
    }
    
    const estimatedMs = Date.now() + waitTime + avgExecutionTime;
    return new Date(estimatedMs);
  }

  private generateCorrelationId(): string {
    return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateWorkflowId(): string {
    return `workflow_${uuidv4()}`;
  }

  private generateExecutionId(): string {
    return `exec_${uuidv4()}`;
  }

  private generateEventId(): string {
    return `event_${uuidv4()}`;
  }
}
```

### 4. Event Definitions

```typescript
export enum WorkflowEventType {
  WORKFLOW_CREATED = 'workflow.created',
  WORKFLOW_UPDATED = 'workflow.updated',
  WORKFLOW_DELETED = 'workflow.deleted',
  WORKFLOW_DEPLOYED = 'workflow.deployed',
  WORKFLOW_ACTIVATED = 'workflow.activated',
  WORKFLOW_DEACTIVATED = 'workflow.deactivated',
  
  EXECUTION_STARTED = 'execution.started',
  EXECUTION_COMPLETED = 'execution.completed',
  EXECUTION_FAILED = 'execution.failed',
  EXECUTION_PAUSED = 'execution.paused',
  EXECUTION_RESUMED = 'execution.resumed',
  EXECUTION_CANCELLED = 'execution.cancelled',
  EXECUTION_RETRIED = 'execution.retried',
  
  STEP_STARTED = 'step.started',
  STEP_COMPLETED = 'step.completed',
  STEP_FAILED = 'step.failed',
  STEP_SKIPPED = 'step.skipped',
  
  TRIGGER_ACTIVATED = 'trigger.activated',
  TRIGGER_DEACTIVATED = 'trigger.deactivated',
  TRIGGER_FIRED = 'trigger.fired'
}

@EventSubscriber()
export class WorkflowEventSubscriber {
  @OnEvent('workflow.*')
  async handleWorkflowEvent(event: WorkflowEvent) {
    // Log event
    await this.auditLogger.log({
      eventType: event.type,
      workflowId: event.workflowId,
      executionId: event.executionId,
      timestamp: event.timestamp,
      userId: event.userId,
      correlationId: event.correlationId,
      data: event.data
    });
    
    // Update metrics
    this.metricsService.recordCounter(`events.${event.type}`, 1);
    
    // Send notifications if configured
    await this.notificationService.sendWorkflowNotification(event);
  }
}
```

### 5. Custom Exceptions

```typescript
export class WorkflowException extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any,
    public readonly correlationId?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class WorkflowNotFoundException extends WorkflowException {
  constructor(workflowId: string) {
    super(
      `Workflow not found: ${workflowId}`,
      'WORKFLOW_NOT_FOUND',
      { workflowId }
    );
  }
}

export class WorkflowValidationException extends WorkflowException {
  constructor(errors: ValidationError[]) {
    super(
      'Workflow validation failed',
      'WORKFLOW_VALIDATION_ERROR',
      { errors }
    );
  }
}

export class WorkflowExecutionException extends WorkflowException {
  constructor(message: string, workflowId: string, correlationId: string) {
    super(
      message,
      'WORKFLOW_EXECUTION_ERROR',
      { workflowId },
      correlationId
    );
  }
}

export class InvalidWorkflowStateException extends WorkflowException {
  constructor(message: string) {
    super(message, 'INVALID_WORKFLOW_STATE');
  }
}

export class RateLimitExceededException extends WorkflowException {
  constructor(message: string) {
    super(message, 'RATE_LIMIT_EXCEEDED');
  }
}

export class WorkflowTimeoutException extends WorkflowException {
  constructor(executionId: string, timeout: number) {
    super(
      `Workflow execution timeout: ${executionId}`,
      'WORKFLOW_TIMEOUT',
      { executionId, timeout }
    );
  }
}
```

## D. Database Schema

```sql
-- Workflow definition table
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  definition JSONB NOT NULL,
  n8n_workflow_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  version INTEGER NOT NULL DEFAULT 1,
  tags TEXT[],
  permissions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,
  updated_by UUID,
  last_deployed_at TIMESTAMP WITH TIME ZONE,
  last_deployed_version INTEGER,
  is_template BOOLEAN DEFAULT FALSE,
  parent_workflow_id UUID REFERENCES workflows(id),
  CONSTRAINT workflows_name_version_unique UNIQUE (name, version)
);

-- Execution history table
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  n8n_execution_id VARCHAR(255),
  status VARCHAR(50) NOT NULL,
  input_data JSONB,
  outputs JSONB,
  error TEXT,
  priority VARCHAR(20) DEFAULT 'NORMAL',
  correlation_id VARCHAR(255),
  retry_count INTEGER DEFAULT 0,
  started_by UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

-- Step execution details
CREATE TABLE step_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  step_id VARCHAR(255) NOT NULL,
  step_name VARCHAR(255),
  status VARCHAR(50) NOT NULL,
  input_data JSONB,
  output_data JSONB,
  error TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  retry_count INTEGER DEFAULT 0
);

-- Workflow templates
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  template_definition JSONB NOT NULL,
  parameters JSONB,
  tags TEXT[],
  is_public BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL
);

-- Deployment history
CREATE TABLE workflow_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  environment VARCHAR(50) NOT NULL,
  version INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL,
  deployment_config JSONB,
  deployed_by UUID NOT NULL,
  deployed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  rollback_from UUID REFERENCES workflow_deployments(id)
);

-- Workflow triggers
CREATE TABLE workflow_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  trigger_type VARCHAR(50) NOT NULL,
  trigger_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workflow variables
CREATE TABLE workflow_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  variable_name VARCHAR(255) NOT NULL,
  variable_type VARCHAR(50) NOT NULL,
  default_value TEXT,
  is_required BOOLEAN DEFAULT FALSE,
  is_secret BOOLEAN DEFAULT FALSE,
  description TEXT,
  CONSTRAINT workflow_variables_unique UNIQUE (workflow_id, variable_name)
);

-- Audit log
CREATE TABLE workflow_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  workflow_id UUID,
  execution_id UUID,
  user_id UUID NOT NULL,
  correlation_id VARCHAR(255),
  event_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_category ON workflows(category);
CREATE INDEX idx_workflows_tags ON workflows USING GIN(tags);
CREATE INDEX idx_workflows_created_by ON workflows(created_by);

CREATE INDEX idx_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_executions_status ON workflow_executions(status);
CREATE INDEX idx_executions_correlation_id ON workflow_executions(correlation_id);
CREATE INDEX idx_executions_started_at ON workflow_executions(started_at);
CREATE INDEX idx_executions_started_by ON workflow_executions(started_by);

CREATE INDEX idx_step_executions_execution_id ON step_executions(execution_id);
CREATE INDEX idx_step_executions_status ON step_executions(status);

CREATE INDEX idx_deployments_workflow_id ON workflow_deployments(workflow_id);
CREATE INDEX idx_deployments_environment ON workflow_deployments(environment);

CREATE INDEX idx_triggers_workflow_id ON workflow_triggers(workflow_id);
CREATE INDEX idx_triggers_type ON workflow_triggers(trigger_type);
CREATE INDEX idx_triggers_active ON workflow_triggers(is_active);

CREATE INDEX idx_audit_log_workflow_id ON workflow_audit_log(workflow_id);
CREATE INDEX idx_audit_log_execution_id ON workflow_audit_log(execution_id);
CREATE INDEX idx_audit_log_user_id ON workflow_audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON workflow_audit_log(created_at);
CREATE INDEX idx_audit_log_event_type ON workflow_audit_log(event_type);
```

## E. Configuration

```typescript
export interface WorkflowEngineConfig {
  n8n: {
    host: string;
    port: number;
    apiKey: string;
    webhookUrl: string;
    executionMode: 'regular' | 'queue';
    maxConcurrentExecutions: number;
    pruneExecutionHistory: boolean;
    executionHistoryRetentionDays: number;
  };
  
  database: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl: boolean;
    poolSize: number;
    connectionTimeout: number;
  };
  
  redis: {
    host: string;
    port: number;
    password: string;
    database: number;
    keyPrefix: string;
    ttl: {
      workflowDefinition: number;
      executionState: number;
      rateLimiting: number;
    };
  };
  
  rabbitmq: {
    url: string;
    exchange: string;
    queues: {
      highPriority: string;
      normalPriority: string;
      lowPriority: string;
    };
    prefetchCount: number;
    reconnectAttempts: number;
  };
  
  execution: {
    defaultTimeout: number;
    maxRetries: number;
    retryDelay: number;
    rateLimits: {
      perWorkflow: number;
      perUser: number;
      global: number;
    };
    priorityWeights: {
      high: number;
      normal: number;
      low: number;
    };
  };
  
  monitoring: {
    metricsEnabled: boolean;
    metricsPort: number;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    auditLogEnabled: boolean;
    performanceTracking: boolean;
  };
  
  security: {
    encryptionKey: string;
    jwtSecret: string;
    apiKeyHeader: string;
    corsOrigins: string[];
    rateLimiting: {
      windowMs: number;
      maxRequests: number;
    };
  };
}

// Configuration with defaults
export const defaultConfig: WorkflowEngineConfig = {
  n8n: {
    host: process.env.N8N_HOST || 'localhost',
    port: parseInt(process.env.N8N_PORT || '5678'),
    apiKey: process.env.N8N_API_KEY || '',
    webhookUrl: process.env.N8N_WEBHOOK_URL || 'http://localhost:3000/webhooks',
    executionMode: 'queue',
    maxConcurrentExecutions: 10,
    pruneExecutionHistory: true,
    executionHistoryRetentionDays: 30
  },
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'workflow_engine',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    poolSize: 20,
    connectionTimeout: 30000
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || '',
    database: 0,
    keyPrefix: 'wae:',
    ttl: {
      workflowDefinition: 3600,
      executionState: 7200,
      rateLimiting: 60
    }
  },
  
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost',
    exchange: 'workflow_exchange',
    queues: {
      highPriority: 'workflow_high_priority',
      normalPriority: 'workflow_normal_priority',
      lowPriority: 'workflow_low_priority'
    },
    prefetchCount: 10,
    reconnectAttempts: 5
  },
  
  execution: {
    defaultTimeout: 300000, // 5 minutes
    maxRetries: 3,
    retryDelay: 5000,
    rateLimits: {
      perWorkflow: 100,
      perUser: 500,
      global: 5000
    },
    priorityWeights: {
      high: 1.0,
      normal: 0.5,
      low: 0.1
    }
  },
  
  monitoring: {
    metricsEnabled: true,
    metricsPort: 9090,
    logLevel: 'info',
    auditLogEnabled: true,
    performanceTracking: true
  },
  
  security: {
    encryptionKey: process.env.ENCRYPTION_KEY || '',
    jwtSecret: process.env.JWT_SECRET || '',
    apiKeyHeader: 'X-API-Key',
    corsOrigins: ['http://localhost:3000'],
    rateLimiting: {
      windowMs: 60000,
      maxRequests: 100
    }
  }
};
```

## F. Testing Strategy

### 1. Unit Tests

```typescript
describe('WorkflowAutomationService', () => {
  let service: WorkflowAutomationService;
  let mockRepository: MockType<Repository<WorkflowEntity>>;
  let mockN8nClient: MockType<N8NClient>;
  let mockRedisService: MockType<RedisService>;
  let mockEventEmitter: MockType<EventEmitter2>;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WorkflowAutomationService,
        {
          provide: getRepositoryToken(WorkflowEntity),
          useFactory: repositoryMockFactory
        },
        {
          provide: N8NClient,
          useFactory: () => createMock<N8NClient>()
        },
        {
          provide: RedisService,
          useFactory: () => createMock<RedisService>()
        },
        {
          provide: EventEmitter2,
          useFactory: () => createMock<EventEmitter2>()
        }
      ]
    }).compile();
    
    service = module.get<WorkflowAutomationService>(WorkflowAutomationService);
    mockRepository = module.get(getRepositoryToken(WorkflowEntity));
    mockN8nClient = module.get(N8NClient);
    mockRedisService = module.get(RedisService);
    mockEventEmitter = module.get(EventEmitter2);
  });
  
  describe('createWorkflow', () => {
    it('should create workflow successfully', async () => {
      // Arrange
      const dto: WorkflowDefinitionDTO = {
        name: 'Test Workflow',
        description: 'Test description',
        category: WorkflowCategory.DOCUMENT_PROCESSING,
        trigger: {
          type: 'manual',
          config: {}
        },
        steps: [
          {
            id: 'step1',
            name: 'Test Step',
            type: StepType.HTTP_REQUEST,
            config: { url: 'https://api.test.com' },
            inputs: [],
            outputs: []
          }
        ],
        variables: [],
        errorHandling: { strategy: 'continue' },
        retryPolicy: { strategy: 'exponential', maxRetries: 3, initialDelay: 1000, maxDelay: 30000 },
        timeout: 60000,
        tags: ['test'],
        permissions: { execute: ['user'] }
      };
      
      mockRepository.save.mockResolvedValue({ id: 'workflow-123', ...dto });
      mockN8nClient.createWorkflow.mockResolvedValue({ id: 'n8n-123' });
      mockRedisService.setWithTTL.mockResolvedValue(true);
      
      // Act
      const result = await service.createWorkflow(dto);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('workflow-123');
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
      expect(mockN8nClient.createWorkflow).toHaveBeenCalledTimes(1);
      expect(mockRedisService.setWithTTL).toHaveBeenCalledWith(
        expect.stringContaining('workflow:'),
        expect.any(String),
        3600
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'workflow.created',
        expect.objectContaining({
          type: 'workflow.created',
          workflowId: 'workflow-123'
        })
      );
    });
    
    it('should handle validation errors', async () => {
      // Arrange
      const invalidDto: WorkflowDefinitionDTO = {
        name: '', // Invalid: empty name
        steps: [] // Invalid: no steps
      } as WorkflowDefinitionDTO;
      
      // Act & Assert
      await expect(service.createWorkflow(invalidDto)).rejects.toThrow(WorkflowValidationException);
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockN8nClient.createWorkflow).not.toHaveBeenCalled();
    });
    
    it('should rollback transaction on n8n failure', async () => {
      // Arrange
      const dto = createValidWorkflowDto();
      mockRepository.save.mockResolvedValueOnce({ id: 'workflow-123' });
      mockN8nClient.createWorkflow.mockRejectedValue(new Error('N8N connection failed'));
      
      // Act & Assert
      await expect(service.createWorkflow(dto)).rejects.toThrow(WorkflowCreationException);
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('executeWorkflow', () => {
    it('should execute high priority workflow immediately', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      const params: ExecutionParams = {
        inputData: { test: 'data' },
        priority: ExecutionPriority.HIGH,
        correlationId: 'corr-123'
      };
      
      const mockWorkflow = {
        id: workflowId,
        n8nWorkflowId: 'n8n-123',
        status: WorkflowStatus.ACTIVE
      };
      
      mockRepository.findOne.mockResolvedValue(mockWorkflow);
      mockN8nClient.executeWorkflow.mockResolvedValue({ id: 'exec-n8n-123' });
      
      // Act
      const result = await service.executeWorkflow(workflowId, params);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.executionId).toBeDefined();
      expect(result.status).toBe(ExecutionStatus.PENDING);
      expect(mockN8nClient.executeWorkflow).toHaveBeenCalledWith(
        'n8n-123',
        expect.objectContaining({ data: params.inputData })
      );
    });
    
    it('should queue normal priority workflow', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      const params: ExecutionParams = {
        priority: ExecutionPriority.NORMAL
      };
      
      const mockWorkflow = {
        id: workflowId,
        n8nWorkflowId: 'n8n-123',
        status: WorkflowStatus.ACTIVE
      };
      
      mockRepository.findOne.mockResolvedValue(mockWorkflow);
      
      // Act
      const result = await service.executeWorkflow(workflowId, params);
      
      // Assert
      expect(result.status).toBe(ExecutionStatus.PENDING);
      expect(mockMessageQueue.publish).toHaveBeenCalledWith(
        'workflow.execution.queue',
        expect.objectContaining({
          workflowId,
          priority: ExecutionPriority.NORMAL
        })
      );
    });
    
    it('should enforce rate limiting', async () => {
      // Arrange
      const workflowId = 'workflow-123';
      mockRedisService.incr.mockResolvedValue(101); // Over limit
      
      // Act & Assert
      await expect(service.executeWorkflow(workflowId)).rejects.toThrow(RateLimitExceededException);
    });
  });
});
```

### 2. Integration Tests

```typescript
describe('Workflow API Integration Tests', () => {
  let app: INestApplication;
  let authToken: string;
  
  beforeAll(async () => {
    app = await createTestApplication();
    authToken = await getAuthToken(app);
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  describe('POST /api/v1/workflows', () => {
    it('should create workflow end-to-end', async () => {
      // Arrange
      const workflowData = {
        name: 'Integration Test Workflow',
        description: 'Testing complete workflow creation',
        category: 'testing',
        trigger: {
          type: 'webhook',
          config: {
            path: '/test-webhook'
          }
        },
        steps: [
          {
            id: 'http-step',
            name: 'HTTP Request',
            type: 'http',
            config: {
              method: 'GET',
              url: 'https://jsonplaceholder.typicode.com/posts/1'
            }
          }
        ]
      };
      
      // Act
      const response = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set('Authorization', `Bearer ${authToken}`)
        .send(workflowData)
        .expect(201);
      
      // Assert
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(workflowData.name);
      expect(response.body.status).toBe('DRAFT');
      
      // Verify workflow exists in database
      const workflow = await getWorkflowFromDatabase(response.body.id);
      expect(workflow).toBeDefined();
      
      // Verify workflow exists in n8n
      const n8nWorkflow = await getN8nWorkflow(workflow.n8nWorkflowId);
      expect(n8nWorkflow).toBeDefined();
      
      // Verify cache entry
      const cached = await getCachedWorkflow(response.body.id);
      expect(cached).toBeDefined();
    });
    
    it('should execute deployed workflow', async () => {
      // Arrange
      const workflowId = await createAndDeployTestWorkflow();
      
      // Act
      const response = await request(app.getHttpServer())
        .post(`/api/v1/workflows/${workflowId}/execute`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          inputData: { message: 'test' }
        })
        .expect(200);
      
      // Assert
      expect(response.body).toHaveProperty('executionId');
      expect(response.body.status).toBe('PENDING');
      
      // Wait for execution to complete
      await waitForExecutionCompletion(response.body.executionId);
      
      // Verify execution results
      const execution = await getExecutionFromDatabase(response.body.executionId);
      expect(execution.status).toBe('SUCCESS');
      expect(execution.outputs).toBeDefined();
    });
  });
});
```

### 3. Test Coverage Requirements

- Unit test coverage: Minimum 85%
- Integration test coverage: Minimum 70%
- Critical path coverage: 100%
- Error handling coverage: 100%

## G. Monitoring & Observability

### 1. Metrics

```typescript
export class WorkflowMetricsCollector {
  private readonly prometheusRegistry: Registry;
  
  // Performance metrics
  private readonly executionDuration: Histogram<string>;
  private readonly stepDuration: Histogram<string>;
  private readonly queueWaitTime: Histogram<string>;
  
  // Business metrics
  private readonly executionCounter: Counter<string>;
  private readonly errorCounter: Counter<string>;
  private readonly retryCounter: Counter<string>;
  
  // System metrics
  private readonly activeExecutions: Gauge<string>;
  private readonly queueDepth: Gauge<string>;
  private readonly workflowCount: Gauge<string>;
  
  constructor() {
    this.prometheusRegistry = new Registry();
    
    this.executionDuration = new Histogram({
      name: 'workflow_execution_duration_seconds',
      help: 'Duration of workflow executions',
      labelNames: ['workflow_id', 'status'],
      buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300]
    });
    
    this.stepDuration = new Histogram({
      name: 'workflow_step_duration_seconds',
      help: 'Duration of individual workflow steps',
      labelNames: ['workflow_id', 'step_type'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10]
    });
    
    this.executionCounter = new Counter({
      name: 'workflow_executions_total',
      help: 'Total number of workflow executions',
      labelNames: ['workflow_id', 'status', 'trigger_type']
    });
    
    this.errorCounter = new Counter({
      name: 'workflow_errors_total',
      help: 'Total number of workflow errors',
      labelNames: ['workflow_id', 'error_type', 'step_id']
    });
    
    this.activeExecutions = new Gauge({
      name: 'workflow_active_executions',
      help: 'Number of currently active workflow executions',
      labelNames: ['priority']
    });
    
    // Register all metrics
    [
      this.executionDuration,
      this.stepDuration,
      this.executionCounter,
      this.errorCounter,
      this.activeExecutions
    ].forEach(metric => this.prometheusRegistry.registerMetric(metric));
  }
}
```

### 2. Logging Strategy

```typescript
export class WorkflowLogger {
  private readonly logger: winston.Logger;
  
  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'workflow-engine' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'logs/workflow-error.log',
          level: 'error'
        }),
        new winston.transports.File({
          filename: 'logs/workflow-combined.log'
        })
      ]
    });
  }
  
  logWorkflowEvent(event: WorkflowEvent): void {
    this.logger.info('Workflow event', {
      eventType: event.type,
      workflowId: event.workflowId,
      executionId: event.executionId,
      correlationId: event.correlationId,
      userId: event.userId,
      timestamp: event.timestamp,
      data: event.data
    });
  }
  
  logExecutionStart(execution: ExecutionEntity): void {
    this.logger.info('Workflow execution started', {
      executionId: execution.id,
      workflowId: execution.workflowId,
      priority: execution.priority,
      correlationId: execution.correlationId,
      inputData: this.sanitizeData(execution.inputData)
    });
  }
  
  logExecutionError(execution: ExecutionEntity, error: Error): void {
    this.logger.error('Workflow execution failed', {
      executionId: execution.id,
      workflowId: execution.workflowId,
      error: error.message,
      stack: error.stack,
      retryCount: execution.retryCount,
      correlationId: execution.correlationId
    });
  }
}
```

### 3. Health Checks

```typescript
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private redis: RedisHealthIndicator,
    private n8nHealthCheck: N8NHealthIndicator
  ) {}
  
  @Get()
  @HealthCheck()
  async check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
      () => this.n8nHealthCheck.isHealthy('n8n'),
      () => this.checkQueueHealth(),
      () => this.checkExecutionCapacity()
    ]);
  }
  
  private async checkQueueHealth(): Promise<HealthIndicatorResult> {
    const queueDepth = await this.getQueueDepth();
    const isHealthy = queueDepth < 1000;
    
    return {
      queue: {
        status: isHealthy ? 'up' : 'down',
        depth: queueDepth,
        threshold: 1000
      }
    };
  }
  
  private async checkExecutionCapacity(): Promise<HealthIndicatorResult> {
    const activeExecutions = await this.getActiveExecutionCount();
    const maxCapacity = 100;
    const utilizationPercent = (activeExecutions / maxCapacity) * 100;
    
    return {
      execution_capacity: {
        status: utilizationPercent < 90 ? 'up' : 'down',
        active: activeExecutions,
        max: maxCapacity,
        utilization: `${utilizationPercent.toFixed(2)}%`
      }
    };
  }
}
```

### 4. Alerts

```yaml
# Prometheus alert rules
groups:
  - name: workflow_alerts
    interval: 30s
    rules:
      - alert: HighWorkflowErrorRate
        expr: rate(workflow_errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High workflow error rate detected
          description: "Error rate is {{ $value }} errors per second"
      
      - alert: WorkflowExecutionTimeout
        expr: workflow_execution_duration_seconds > 300
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: Workflow execution timeout
          description: "Workflow {{ $labels.workflow_id }} execution taking > 5 minutes"
      
      - alert: QueueBacklog
        expr: workflow_queue_depth > 500
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Workflow queue backlog detected
          description: "Queue depth is {{ $value }}"
      
      - alert: N8NServiceDown
        expr: up{job="n8n"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: N8N service is down
          description: "N8N service has been down for more than 1 minute"
```

## H. Security Considerations

### 1. Authentication & Authorization

```typescript
export class WorkflowAuthorizationService {
  async checkWorkflowPermission(
    workflowId: string,
    permission: WorkflowPermission,
    userId: string
  ): Promise<boolean> {
    const workflow = await this.workflowRepository.findOne({ where: { id: workflowId } });
    
    if (!workflow) {
      throw new WorkflowNotFoundException(workflowId);
    }
    
    // Check ownership
    if (workflow.createdBy === userId) {
      return true;
    }
    
    // Check explicit permissions
    const userPermissions = await this.getUserWorkflowPermissions(userId, workflowId);
    
    return userPermissions.includes(permission);
  }
  
  async validateApiKey(apiKey: string): Promise<boolean> {
    const hashedKey = this.hashApiKey(apiKey);
    const keyRecord = await this.apiKeyRepository.findOne({ where: { hashedKey } });
    
    if (!keyRecord || keyRecord.expiresAt < new Date()) {
      return false;
    }
    
    // Update last used timestamp
    keyRecord.lastUsedAt = new Date();
    await this.apiKeyRepository.save(keyRecord);
    
    return true;
  }
}
```

### 2. Data Validation

```typescript
export class WorkflowInputValidator {
  validateWorkflowInput(data: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Sanitize strings to prevent XSS
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }
    
    // Validate object properties
    if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        // Check for dangerous keys
        if (this.isDangerousKey(key)) {
          errors.push({
            field: key,
            message: 'Potentially dangerous property name'
          });
          continue;
        }
        
        // Recursively validate nested objects
        if (typeof value === 'object') {
          const nestedResult = this.validateWorkflowInput(value);
          if (!nestedResult.isValid) {
            errors.push(...nestedResult.errors);
          }
        }
        
        // Validate string values
        if (typeof value === 'string') {
          if (this.containsSqlInjection(value)) {
            errors.push({
              field: key,
              message: 'Potential SQL injection detected'
            });
          }
          
          if (this.containsScriptInjection(value)) {
            errors.push({
              field: key,
              message: 'Potential script injection detected'
            });
          }
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  private sanitizeString(str: string): string {
    return str
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }
}
```

### 3. Rate Limiting

```typescript
export class WorkflowRateLimiter {
  async checkRateLimit(
    identifier: string,
    limit: number,
    window: number
  ): Promise<RateLimitResult> {
    const key = `rate_limit:${identifier}`;
    const current = await this.redisService.incr(key);
    
    if (current === 1) {
      await this.redisService.expire(key, window);
    }
    
    const ttl = await this.redisService.ttl(key);
    
    return {
      allowed: current <= limit,
      limit,
      remaining: Math.max(0, limit - current),
      reset: Date.now() + (ttl * 1000)
    };
  }
}
```

### 4. Encryption

```typescript
export class WorkflowEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  
  constructor(private readonly config: SecurityConfig) {
    this.key = Buffer.from(config.encryptionKey, 'hex');
  }
  
  encryptSensitiveData(data: any): EncryptedData {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64')
    };
  }
  
  decryptSensitiveData(encryptedData: EncryptedData): any {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(encryptedData.iv, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'base64'));
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedData.encrypted, 'base64')),
      decipher.final()
    ]);
    
    return JSON.parse(decrypted.toString('utf8'));
  }
}
```

### 5. Audit Trail

```typescript
export class WorkflowAuditService {
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const auditEntry = new WorkflowAuditLog();
    auditEntry.eventType = event.type;
    auditEntry.workflowId = event.workflowId;
    auditEntry.userId = event.userId;
    auditEntry.ipAddress = event.ipAddress;
    auditEntry.userAgent = event.userAgent;
    auditEntry.eventData = event.data;
    auditEntry.correlationId = event.correlationId;
    
    await this.auditRepository.save(auditEntry);
    
    // Alert on suspicious events
    if (this.isSuspiciousEvent(event)) {
      await this.alertSecurityTeam(event);
    }
  }
  
  private isSuspiciousEvent(event: SecurityEvent): boolean {
    const suspiciousTypes = [
      'UNAUTHORIZED_ACCESS',
      'RATE_LIMIT_EXCEEDED',
      'INVALID_API_KEY',
      'SQL_INJECTION_ATTEMPT',
      'XSS_ATTEMPT'
    ];
    
    return suspiciousTypes.includes(event.type);
  }
}
```

## I. Documentation

### 1. API Documentation

```typescript
// OpenAPI/Swagger specification
export const workflowApiDocs = {
  openapi: '3.0.0',
  info: {
    title: 'Workflow Automation Engine API',
    version: '1.0.0',
    description: 'API for managing and executing automated workflows'
  },
  servers: [
    {
      url: 'https://api.workflow.example.com/v1',
      description: 'Production server'
    }
  ],
  paths: {
    '/workflows': {
      post: {
        summary: 'Create a new workflow',
        operationId: 'createWorkflow',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WorkflowDefinitionDTO'
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Workflow created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WorkflowResponse'
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      WorkflowDefinitionDTO: {
        type: 'object',
        required: ['name', 'trigger', 'steps'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          trigger: { $ref: '#/components/schemas/WorkflowTrigger' },
          steps: {
            type: 'array',
            items: { $ref: '#/components/schemas/WorkflowStep' }
          }
        }
      }
    }
  }
};
```

### 2. Code Comments

```typescript
/**
 * WorkflowAutomationService handles the complete lifecycle of workflow automation.
 * It integrates with n8n for workflow execution and provides enterprise features
 * like versioning, permissions, and audit logging.
 * 
 * @example
 * ```typescript
 * const workflow = await workflowService.createWorkflow({
 *   name: 'Daily Report Generator',
 *   trigger: { type: 'scheduled', config: { cron: '0 9 * * *' } },
 *   steps: [{ type: 'database-query', config: { query: 'SELECT * FROM reports' } }]
 * });
 * ```
 */
export class WorkflowAutomationService {
  /**
   * Creates a new workflow definition and deploys it to n8n.
   * 
   * @param dto - The workflow definition data transfer object
   * @returns Promise resolving to the created workflow response
   * @throws {WorkflowValidationException} If the workflow definition is invalid
   * @throws {WorkflowCreationException} If workflow creation fails
   */
  async createWorkflow(dto: WorkflowDefinitionDTO): Promise<WorkflowResponse> {
    // Implementation
  }
}
```

### 3. README

```markdown
# Workflow Automation Engine

## Overview
The Workflow Automation Engine (WAE) provides automated workflow orchestration capabilities using n8n as the execution engine.

## Features
- Visual workflow designer
- Scheduled and event-driven workflows
- Integration with all system modules
- Real-time monitoring and analytics
- Error handling and retry mechanisms
- Template library

## Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- RabbitMQ 3.12+
- n8n instance

### Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Configure environment variables (see .env.example)
4. Run database migrations: `npm run migrate`
5. Start the service: `npm run start`

## Configuration
See `config/workflow.config.ts` for available configuration options.

## API Documentation
API documentation is available at `/api/docs` when the service is running.

## Testing
- Run unit tests: `npm run test`
- Run integration tests: `npm run test:integration`
- Generate coverage report: `npm run test:coverage`

## Deployment
See deployment guide in `/docs/deployment.md`
```

## J. Deployment Considerations

### 1. Deployment Strategy

```yaml
# Kubernetes deployment configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: workflow-engine
  labels:
    app: workflow-engine
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: workflow-engine
  template:
    metadata:
      labels:
        app: workflow-engine
    spec:
      containers:
      - name: workflow-engine
        image: workflow-engine:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 2. Resource Requirements

- **CPU**: 2-4 cores per instance
- **Memory**: 2-4 GB per instance  
- **Storage**: 50 GB for logs and temporary files
- **Network**: 100 Mbps minimum bandwidth

### 3. Scaling Strategy

```typescript
export class AutoScalingConfig {
  horizontal: {
    minReplicas: 2,
    maxReplicas: 10,
    targetCPUUtilization: 70,
    targetMemoryUtilization: 80,
    scaleUpStabilization: 60,
    scaleDownStabilization: 300
  };
  
  vertical: {
    updateMode: 'Auto',
    resourcePolicy: {
      containerPolicies: [{
        containerName: 'workflow-engine',
        minAllowed: {
          cpu: '500m',
          memory: '512Mi'
        },
        maxAllowed: {
          cpu: '4000m',
          memory: '8Gi'
        }
      }]
    }
  };
}
```

### 4. Dependencies

**External Services SLAs:**
- n8n: 99.9% availability
- PostgreSQL: 99.95% availability
- Redis: 99.9% availability
- RabbitMQ: 99.9% availability

**Disaster Recovery:**
- RPO (Recovery Point Objective): 1 hour
- RTO (Recovery Time Objective): 2 hours
- Backup frequency: Every 6 hours
- Backup retention: 30 days

---

This completes the comprehensive technical specification for the Workflow Automation Engine module. The specification provides production-ready code, detailed implementation guidelines, and covers all aspects from development to deployment.