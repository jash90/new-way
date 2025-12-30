# WFA-005: Versioning & Deployment

> **Story ID**: WFA-005
> **Epic**: Workflow Automation Engine (WFA)
> **Priority**: P1 (Essential)
> **Story Points**: 8
> **Phase**: 5 (Week 19)
> **Status**: 📋 Specified

---

## User Story

**As an** accountant managing automated workflows,
**I want** workflow versioning and safe deployment capabilities
**So that** I can safely update workflows without disrupting running processes and rollback if needed.

---

## Acceptance Criteria

### AC1: Automatic Version Creation
```gherkin
Feature: Automatic Version Creation
  Scenario: Create new version on workflow modification
    Given I have a published workflow "monthly-closing" version 3
    When I make changes to the workflow definition
    And I save the workflow
    Then a new version 4 is automatically created
    And version 3 remains unchanged and accessible
    And the version history shows all 4 versions
    And the change diff is recorded in audit log

  Scenario: Version with changelog
    Given I am editing workflow "invoice-processing"
    When I save changes with description "Added VAT validation step"
    Then the version includes the changelog entry
    And the entry shows who made changes and when
```

### AC2: Version Comparison
```gherkin
Feature: Version Comparison
  Scenario: Compare two workflow versions
    Given workflow "document-approval" has versions 1 through 5
    When I select version 2 and version 5 for comparison
    Then I see a visual diff of node changes
    And I see added/removed/modified nodes highlighted
    And I see configuration changes for each node
    And I see trigger changes if any

  Scenario: Compare with current draft
    Given workflow "payment-processing" has published version 3
    And I have unpublished changes in draft
    When I compare draft with published version
    Then I see all pending changes
    And I can revert specific changes
```

### AC3: Draft/Published States
```gherkin
Feature: Draft and Published States
  Scenario: Work with draft state
    Given workflow "tax-filing" is published and active
    When I edit the workflow
    Then my changes are saved as draft
    And the published version continues to execute
    And other users see "draft available" indicator
    And I can discard draft without affecting published version

  Scenario: Publish draft
    Given I have a validated draft for "jpk-generation"
    And all validation rules pass
    When I publish the draft
    Then the draft becomes the new published version
    And the version number increments
    And running executions complete on previous version
    And new executions use the new version
```

### AC4: Rollback to Previous Version
```gherkin
Feature: Version Rollback
  Scenario: Rollback to specific version
    Given workflow "client-onboarding" is at version 5
    And version 3 was the last stable version
    When I initiate rollback to version 3
    Then I see rollback confirmation with impact analysis
    And after confirmation, version 3 becomes the active version
    And a new version 6 is created from version 3
    And rollback is recorded in deployment history

  Scenario: Quick rollback on failure
    Given workflow "bank-reconciliation" was just deployed
    And executions are failing with high error rate
    When I click "Quick Rollback"
    Then the previous stable version is restored within 30 seconds
    And affected users receive notification
    And incident is logged automatically
```

### AC5: Staged Deployment
```gherkin
Feature: Staged Deployment
  Scenario: Deploy to staging environment first
    Given workflow "payment-automation" has new version ready
    When I select "Staged Deployment"
    Then I can deploy to staging environment first
    And I can run test executions in staging
    And I can promote to production after validation
    And deployment gates check validation results

  Scenario: Canary deployment
    Given workflow "document-processing" needs careful rollout
    When I configure canary deployment at 10%
    Then 10% of executions use new version
    And 90% use previous stable version
    And metrics compare both versions
    And I can gradually increase percentage or rollback
```

### AC6: A/B Testing Support
```gherkin
Feature: A/B Testing for Workflows
  Scenario: Configure A/B test
    Given I have two versions of "approval-routing"
    When I configure A/B test with 50/50 split
    Then executions are randomly assigned to versions
    And I see separate metrics for each version
    And test runs for configured duration
    And winner is automatically promoted after test period

  Scenario: Monitor A/B test performance
    Given A/B test is running for "notification-workflow"
    When I view test dashboard
    Then I see success rates for both versions
    And I see execution times comparison
    And I see error rates and types
    And I can manually end test and select winner
```

### AC7: Deployment History
```gherkin
Feature: Deployment History
  Scenario: View deployment timeline
    Given workflow "month-end-closing" has deployment history
    When I open deployment history
    Then I see chronological list of deployments
    And each entry shows version, deployer, timestamp
    And each entry shows environment and status
    And I can filter by date range and environment

  Scenario: Deployment audit report
    Given I need compliance report for "tax-filing" workflow
    When I generate deployment audit report
    Then report includes all deployments in period
    And shows who approved each deployment
    And shows pre/post deployment validation results
    And is exportable as PDF for auditors
```

### AC8: Deployment Validation
```gherkin
Feature: Deployment Validation
  Scenario: Pre-deployment validation
    Given workflow "invoice-processing" is ready to deploy
    When deployment validation runs
    Then all trigger configurations are verified
    And external API connections are tested
    And required permissions are checked
    And estimated resource impact is calculated
    And validation report is generated

  Scenario: Block invalid deployment
    Given workflow has validation errors
    When I attempt to deploy
    Then deployment is blocked
    And I see specific validation failures
    And I see guidance on fixing issues
    And deployment gate prevents bypass
```

---

## Technical Specification

### Database Schema

```sql
-- Workflow versions table
CREATE TABLE workflow_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    version_number INTEGER NOT NULL,
    definition JSONB NOT NULL,
    canvas_data JSONB NOT NULL,
    nodes JSONB NOT NULL,
    edges JSONB NOT NULL,
    triggers JSONB NOT NULL,
    variables JSONB,
    changelog TEXT,
    change_summary JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    parent_version_id UUID REFERENCES workflow_versions(id),
    is_current BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    published_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    UNIQUE(workflow_id, version_number)
);

-- Version comparison cache
CREATE TABLE version_diffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    from_version INTEGER NOT NULL,
    to_version INTEGER NOT NULL,
    diff_data JSONB NOT NULL,
    nodes_added JSONB DEFAULT '[]',
    nodes_removed JSONB DEFAULT '[]',
    nodes_modified JSONB DEFAULT '[]',
    edges_changed JSONB DEFAULT '[]',
    config_changes JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workflow_id, from_version, to_version)
);

-- Deployment records
CREATE TABLE workflow_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    version_id UUID NOT NULL REFERENCES workflow_versions(id),
    version_number INTEGER NOT NULL,
    environment VARCHAR(50) NOT NULL,
    deployment_type VARCHAR(50) NOT NULL DEFAULT 'standard',
    deployment_config JSONB DEFAULT '{}',
    validation_results JSONB,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    rollback_from_id UUID REFERENCES workflow_deployments(id),
    rollback_reason TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    deployed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- A/B test configurations
CREATE TABLE workflow_ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version_a_id UUID NOT NULL REFERENCES workflow_versions(id),
    version_b_id UUID NOT NULL REFERENCES workflow_versions(id),
    traffic_split_a INTEGER NOT NULL DEFAULT 50,
    traffic_split_b INTEGER NOT NULL DEFAULT 50,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    winner_version_id UUID REFERENCES workflow_versions(id),
    winner_reason TEXT,
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Canary deployment tracking
CREATE TABLE canary_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES workflow_deployments(id),
    current_percentage INTEGER NOT NULL DEFAULT 0,
    target_percentage INTEGER NOT NULL DEFAULT 100,
    step_size INTEGER NOT NULL DEFAULT 10,
    step_interval_minutes INTEGER NOT NULL DEFAULT 30,
    health_check_threshold DECIMAL(5,4) DEFAULT 0.99,
    current_metrics JSONB DEFAULT '{}',
    baseline_metrics JSONB DEFAULT '{}',
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    last_step_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deployment gates
CREATE TABLE deployment_gates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    gate_type VARCHAR(50) NOT NULL,
    gate_config JSONB NOT NULL,
    is_required BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_diffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE canary_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_gates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization isolation for workflow_versions"
    ON workflow_versions FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY "Organization isolation for workflow_deployments"
    ON workflow_deployments FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY "Organization isolation for workflow_ab_tests"
    ON workflow_ab_tests FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Indexes
CREATE INDEX idx_workflow_versions_workflow ON workflow_versions(workflow_id);
CREATE INDEX idx_workflow_versions_current ON workflow_versions(workflow_id, is_current) WHERE is_current = TRUE;
CREATE INDEX idx_workflow_versions_status ON workflow_versions(workflow_id, status);
CREATE INDEX idx_workflow_deployments_workflow ON workflow_deployments(workflow_id);
CREATE INDEX idx_workflow_deployments_environment ON workflow_deployments(environment, status);
CREATE INDEX idx_workflow_ab_tests_status ON workflow_ab_tests(status) WHERE status = 'running';
CREATE INDEX idx_canary_deployments_active ON canary_deployments(status) WHERE status = 'active';
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Version status enum
export const versionStatusSchema = z.enum([
  'draft',
  'pending_review',
  'approved',
  'published',
  'deprecated',
  'archived'
]);

// Environment enum
export const deploymentEnvironmentSchema = z.enum([
  'development',
  'staging',
  'production'
]);

// Deployment type enum
export const deploymentTypeSchema = z.enum([
  'standard',
  'staged',
  'canary',
  'blue_green',
  'rollback'
]);

// Deployment status enum
export const deploymentStatusSchema = z.enum([
  'pending',
  'validating',
  'approved',
  'deploying',
  'deployed',
  'failed',
  'rolled_back',
  'cancelled'
]);

// Create version schema
export const createVersionSchema = z.object({
  workflowId: z.string().uuid(),
  definition: z.record(z.unknown()),
  canvasData: z.record(z.unknown()),
  nodes: z.array(z.record(z.unknown())),
  edges: z.array(z.record(z.unknown())),
  triggers: z.array(z.record(z.unknown())),
  variables: z.record(z.unknown()).optional(),
  changelog: z.string().min(10, 'Opis zmian musi mieć co najmniej 10 znaków').optional(),
  parentVersionId: z.string().uuid().optional()
});

// Version diff schema
export const versionDiffSchema = z.object({
  workflowId: z.string().uuid(),
  fromVersion: z.number().int().positive(),
  toVersion: z.number().int().positive()
});

// Deployment request schema
export const createDeploymentSchema = z.object({
  workflowId: z.string().uuid(),
  versionId: z.string().uuid(),
  environment: deploymentEnvironmentSchema,
  deploymentType: deploymentTypeSchema.default('standard'),
  deploymentConfig: z.object({
    requireApproval: z.boolean().default(true),
    notifyOnComplete: z.boolean().default(true),
    validateBeforeDeploy: z.boolean().default(true),
    canaryConfig: z.object({
      initialPercentage: z.number().min(1).max(50).default(10),
      stepSize: z.number().min(1).max(25).default(10),
      stepIntervalMinutes: z.number().min(5).max(1440).default(30),
      healthThreshold: z.number().min(0.9).max(1).default(0.99)
    }).optional(),
    abTestConfig: z.object({
      name: z.string().min(3),
      trafficSplitA: z.number().min(10).max(90).default(50),
      durationDays: z.number().min(1).max(30).default(7)
    }).optional()
  }).optional()
});

// Rollback request schema
export const rollbackRequestSchema = z.object({
  workflowId: z.string().uuid(),
  targetVersionNumber: z.number().int().positive(),
  reason: z.string().min(10, 'Powód wycofania musi mieć co najmniej 10 znaków'),
  isEmergency: z.boolean().default(false)
});

// A/B test schema
export const createAbTestSchema = z.object({
  workflowId: z.string().uuid(),
  name: z.string().min(3).max(255),
  description: z.string().optional(),
  versionAId: z.string().uuid(),
  versionBId: z.string().uuid(),
  trafficSplitA: z.number().min(10).max(90).default(50),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  successMetrics: z.array(z.enum([
    'success_rate',
    'execution_time',
    'error_rate',
    'throughput'
  ])).default(['success_rate', 'execution_time'])
});

// Deployment gate schema
export const deploymentGateSchema = z.object({
  workflowId: z.string().uuid(),
  gateType: z.enum([
    'manual_approval',
    'test_pass',
    'security_scan',
    'performance_threshold',
    'error_rate_threshold',
    'custom'
  ]),
  gateConfig: z.object({
    threshold: z.number().optional(),
    requiredApprovers: z.array(z.string().uuid()).optional(),
    minApprovals: z.number().int().positive().optional(),
    customScript: z.string().optional(),
    timeoutMinutes: z.number().int().positive().default(60)
  }),
  isRequired: z.boolean().default(true)
});

// Polish language messages
export const versioningMessages = {
  versionCreated: 'Utworzono nową wersję workflow',
  versionPublished: 'Wersja została opublikowana',
  deploymentStarted: 'Rozpoczęto wdrożenie',
  deploymentCompleted: 'Wdrożenie zakończone pomyślnie',
  deploymentFailed: 'Wdrożenie nie powiodło się',
  rollbackCompleted: 'Przywrócono poprzednią wersję',
  abTestStarted: 'Rozpoczęto test A/B',
  abTestCompleted: 'Test A/B zakończony',
  validationFailed: 'Walidacja nie powiodła się',
  approvalRequired: 'Wymagana zgoda na wdrożenie',
  canaryPromoted: 'Wdrożenie canary promowane do pełnego ruchu'
} as const;

export type VersionStatus = z.infer<typeof versionStatusSchema>;
export type DeploymentEnvironment = z.infer<typeof deploymentEnvironmentSchema>;
export type DeploymentType = z.infer<typeof deploymentTypeSchema>;
export type DeploymentStatus = z.infer<typeof deploymentStatusSchema>;
export type CreateVersionInput = z.infer<typeof createVersionSchema>;
export type CreateDeploymentInput = z.infer<typeof createDeploymentSchema>;
export type RollbackRequestInput = z.infer<typeof rollbackRequestSchema>;
export type CreateAbTestInput = z.infer<typeof createAbTestSchema>;
```

### Core Service Implementation

```typescript
// src/modules/wfa/services/versioning.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { diff } from 'deep-diff';

@Injectable()
export class VersioningService {
  private readonly logger = new Logger(VersioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async createVersion(
    workflowId: string,
    input: CreateVersionInput,
    userId: string,
    organizationId: string
  ): Promise<WorkflowVersion> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } }
    });

    if (!workflow) {
      throw new WorkflowNotFoundException(workflowId);
    }

    const nextVersionNumber = (workflow.versions[0]?.versionNumber || 0) + 1;

    const version = await this.prisma.workflowVersion.create({
      data: {
        workflowId,
        organizationId,
        versionNumber: nextVersionNumber,
        definition: input.definition,
        canvasData: input.canvasData,
        nodes: input.nodes,
        edges: input.edges,
        triggers: input.triggers,
        variables: input.variables,
        changelog: input.changelog,
        parentVersionId: input.parentVersionId,
        status: 'draft',
        createdBy: userId
      }
    });

    // Generate diff from previous version
    if (workflow.versions[0]) {
      await this.generateVersionDiff(
        workflowId,
        workflow.versions[0].versionNumber,
        nextVersionNumber
      );
    }

    await this.eventEmitter.emit('workflow.version.created', {
      workflowId,
      versionId: version.id,
      versionNumber: nextVersionNumber,
      userId,
      timestamp: new Date()
    });

    this.logger.log(`Created version ${nextVersionNumber} for workflow ${workflowId}`);
    return version;
  }

  async compareVersions(
    workflowId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<VersionDiff> {
    // Check cache first
    const cached = await this.prisma.versionDiff.findUnique({
      where: {
        workflowId_fromVersion_toVersion: {
          workflowId,
          fromVersion,
          toVersion
        }
      }
    });

    if (cached) {
      return cached;
    }

    // Generate diff
    const [versionA, versionB] = await Promise.all([
      this.prisma.workflowVersion.findFirst({
        where: { workflowId, versionNumber: fromVersion }
      }),
      this.prisma.workflowVersion.findFirst({
        where: { workflowId, versionNumber: toVersion }
      })
    ]);

    if (!versionA || !versionB) {
      throw new VersionNotFoundException(workflowId, fromVersion, toVersion);
    }

    const diffResult = this.calculateDiff(versionA, versionB);

    // Cache the diff
    const savedDiff = await this.prisma.versionDiff.create({
      data: {
        workflowId,
        fromVersion,
        toVersion,
        ...diffResult
      }
    });

    return savedDiff;
  }

  private calculateDiff(versionA: WorkflowVersion, versionB: WorkflowVersion): DiffResult {
    const nodesA = new Map(versionA.nodes.map((n: any) => [n.id, n]));
    const nodesB = new Map(versionB.nodes.map((n: any) => [n.id, n]));

    const nodesAdded: any[] = [];
    const nodesRemoved: any[] = [];
    const nodesModified: any[] = [];

    // Find added and modified nodes
    for (const [id, nodeB] of nodesB) {
      const nodeA = nodesA.get(id);
      if (!nodeA) {
        nodesAdded.push(nodeB);
      } else {
        const changes = diff(nodeA, nodeB);
        if (changes) {
          nodesModified.push({ nodeId: id, changes });
        }
      }
    }

    // Find removed nodes
    for (const [id, nodeA] of nodesA) {
      if (!nodesB.has(id)) {
        nodesRemoved.push(nodeA);
      }
    }

    // Calculate edge changes
    const edgesChanged = diff(versionA.edges, versionB.edges) || [];

    // Calculate config changes
    const configChanges = diff(versionA.definition, versionB.definition) || [];

    return {
      diffData: { nodesAdded, nodesRemoved, nodesModified, edgesChanged, configChanges },
      nodesAdded,
      nodesRemoved,
      nodesModified,
      edgesChanged,
      configChanges
    };
  }

  async publishVersion(
    workflowId: string,
    versionId: string,
    userId: string
  ): Promise<WorkflowVersion> {
    return await this.prisma.$transaction(async (tx) => {
      // Mark all other versions as not current
      await tx.workflowVersion.updateMany({
        where: { workflowId, isCurrent: true },
        data: { isCurrent: false }
      });

      // Publish the target version
      const version = await tx.workflowVersion.update({
        where: { id: versionId },
        data: {
          status: 'published',
          isCurrent: true,
          publishedAt: new Date(),
          publishedBy: userId
        }
      });

      // Update workflow to reference current version
      await tx.workflow.update({
        where: { id: workflowId },
        data: {
          currentVersionId: versionId,
          updatedAt: new Date()
        }
      });

      await this.eventEmitter.emit('workflow.version.published', {
        workflowId,
        versionId,
        versionNumber: version.versionNumber,
        userId,
        timestamp: new Date()
      });

      return version;
    });
  }

  async rollbackToVersion(
    workflowId: string,
    targetVersionNumber: number,
    reason: string,
    userId: string,
    isEmergency: boolean = false
  ): Promise<RollbackResult> {
    const targetVersion = await this.prisma.workflowVersion.findFirst({
      where: { workflowId, versionNumber: targetVersionNumber }
    });

    if (!targetVersion) {
      throw new VersionNotFoundException(workflowId, targetVersionNumber, targetVersionNumber);
    }

    const currentVersion = await this.prisma.workflowVersion.findFirst({
      where: { workflowId, isCurrent: true }
    });

    return await this.prisma.$transaction(async (tx) => {
      // Create new version from target
      const latestVersion = await tx.workflowVersion.findFirst({
        where: { workflowId },
        orderBy: { versionNumber: 'desc' }
      });

      const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

      const newVersion = await tx.workflowVersion.create({
        data: {
          workflowId,
          organizationId: targetVersion.organizationId,
          versionNumber: newVersionNumber,
          definition: targetVersion.definition,
          canvasData: targetVersion.canvasData,
          nodes: targetVersion.nodes,
          edges: targetVersion.edges,
          triggers: targetVersion.triggers,
          variables: targetVersion.variables,
          changelog: `Rollback to version ${targetVersionNumber}: ${reason}`,
          parentVersionId: targetVersion.id,
          status: 'published',
          isCurrent: true,
          publishedAt: new Date(),
          publishedBy: userId,
          createdBy: userId
        }
      });

      // Mark previous current as not current
      if (currentVersion) {
        await tx.workflowVersion.update({
          where: { id: currentVersion.id },
          data: { isCurrent: false }
        });
      }

      // Record rollback deployment
      const deployment = await tx.workflowDeployment.create({
        data: {
          workflowId,
          organizationId: targetVersion.organizationId,
          versionId: newVersion.id,
          versionNumber: newVersionNumber,
          environment: 'production',
          deploymentType: 'rollback',
          rollbackReason: reason,
          status: 'deployed',
          deployedAt: new Date(),
          completedAt: new Date(),
          createdBy: userId,
          ...(isEmergency ? { approvedBy: userId, approvedAt: new Date() } : {})
        }
      });

      await this.eventEmitter.emit('workflow.rollback.completed', {
        workflowId,
        fromVersionNumber: currentVersion?.versionNumber,
        toVersionNumber: targetVersionNumber,
        newVersionNumber,
        reason,
        isEmergency,
        userId,
        timestamp: new Date()
      });

      return {
        newVersion,
        deployment,
        rolledBackFromVersion: currentVersion?.versionNumber,
        rolledBackToVersion: targetVersionNumber
      };
    });
  }
}
```

### Deployment Service Implementation

```typescript
// src/modules/wfa/services/deployment.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { N8nService } from './n8n.service';
import { ValidationService } from './validation.service';

@Injectable()
export class DeploymentService {
  private readonly logger = new Logger(DeploymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly n8nService: N8nService,
    private readonly validationService: ValidationService
  ) {}

  async createDeployment(
    input: CreateDeploymentInput,
    userId: string,
    organizationId: string
  ): Promise<WorkflowDeployment> {
    const version = await this.prisma.workflowVersion.findUnique({
      where: { id: input.versionId },
      include: { workflow: true }
    });

    if (!version) {
      throw new VersionNotFoundException(input.workflowId, 0, 0);
    }

    // Validate before deployment
    if (input.deploymentConfig?.validateBeforeDeploy !== false) {
      const validationResult = await this.validationService.validateForDeployment(version);
      if (!validationResult.isValid) {
        throw new DeploymentValidationException(validationResult.errors);
      }
    }

    const deployment = await this.prisma.workflowDeployment.create({
      data: {
        workflowId: input.workflowId,
        organizationId,
        versionId: input.versionId,
        versionNumber: version.versionNumber,
        environment: input.environment,
        deploymentType: input.deploymentType,
        deploymentConfig: input.deploymentConfig,
        status: input.deploymentConfig?.requireApproval ? 'pending' : 'validating',
        createdBy: userId
      }
    });

    // Handle different deployment types
    if (input.deploymentType === 'canary' && input.deploymentConfig?.canaryConfig) {
      await this.initializeCanaryDeployment(deployment, input.deploymentConfig.canaryConfig);
    }

    if (!input.deploymentConfig?.requireApproval) {
      await this.executeDeployment(deployment.id);
    }

    await this.eventEmitter.emit('workflow.deployment.created', {
      deploymentId: deployment.id,
      workflowId: input.workflowId,
      versionNumber: version.versionNumber,
      environment: input.environment,
      userId,
      timestamp: new Date()
    });

    return deployment;
  }

  async executeDeployment(deploymentId: string): Promise<void> {
    const deployment = await this.prisma.workflowDeployment.findUnique({
      where: { id: deploymentId },
      include: { version: true, workflow: true }
    });

    if (!deployment) {
      throw new DeploymentNotFoundException(deploymentId);
    }

    try {
      await this.prisma.workflowDeployment.update({
        where: { id: deploymentId },
        data: { status: 'deploying', deployedAt: new Date() }
      });

      // Sync with n8n
      await this.n8nService.deployWorkflow(
        deployment.workflow.n8nWorkflowId,
        deployment.version.definition,
        deployment.environment
      );

      // Activate in n8n
      await this.n8nService.activateWorkflow(deployment.workflow.n8nWorkflowId);

      await this.prisma.workflowDeployment.update({
        where: { id: deploymentId },
        data: { status: 'deployed', completedAt: new Date() }
      });

      // Publish the version if not already published
      if (deployment.version.status !== 'published') {
        await this.prisma.workflowVersion.update({
          where: { id: deployment.versionId },
          data: {
            status: 'published',
            isCurrent: true,
            publishedAt: new Date(),
            publishedBy: deployment.createdBy
          }
        });
      }

      await this.eventEmitter.emit('workflow.deployment.completed', {
        deploymentId,
        workflowId: deployment.workflowId,
        versionNumber: deployment.versionNumber,
        environment: deployment.environment,
        timestamp: new Date()
      });

    } catch (error) {
      await this.prisma.workflowDeployment.update({
        where: { id: deploymentId },
        data: { status: 'failed' }
      });

      await this.eventEmitter.emit('workflow.deployment.failed', {
        deploymentId,
        workflowId: deployment.workflowId,
        error: error.message,
        timestamp: new Date()
      });

      throw error;
    }
  }

  private async initializeCanaryDeployment(
    deployment: WorkflowDeployment,
    config: CanaryConfig
  ): Promise<void> {
    await this.prisma.canaryDeployment.create({
      data: {
        deploymentId: deployment.id,
        currentPercentage: config.initialPercentage,
        targetPercentage: 100,
        stepSize: config.stepSize,
        stepIntervalMinutes: config.stepIntervalMinutes,
        healthCheckThreshold: config.healthThreshold,
        status: 'active'
      }
    });
  }

  async promoteCanaryDeployment(deploymentId: string): Promise<void> {
    const canary = await this.prisma.canaryDeployment.findFirst({
      where: { deploymentId }
    });

    if (!canary || canary.status !== 'active') {
      throw new CanaryDeploymentException('Canary deployment not active');
    }

    const newPercentage = Math.min(
      canary.currentPercentage + canary.stepSize,
      canary.targetPercentage
    );

    await this.prisma.canaryDeployment.update({
      where: { id: canary.id },
      data: {
        currentPercentage: newPercentage,
        lastStepAt: new Date(),
        status: newPercentage >= 100 ? 'completed' : 'active',
        completedAt: newPercentage >= 100 ? new Date() : null
      }
    });

    if (newPercentage >= 100) {
      await this.eventEmitter.emit('workflow.canary.promoted', {
        deploymentId,
        timestamp: new Date()
      });
    }
  }
}
```

---

## API Endpoints

```typescript
// tRPC Router
export const versioningRouter = createTRPCRouter({
  // Version management
  createVersion: protectedProcedure
    .input(createVersionSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.versioningService.createVersion(
        input.workflowId,
        input,
        ctx.user.id,
        ctx.organizationId
      );
    }),

  getVersions: protectedProcedure
    .input(z.object({
      workflowId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ ctx, input }) => {
      return ctx.versioningService.getVersions(input.workflowId, input.limit, input.offset);
    }),

  compareVersions: protectedProcedure
    .input(versionDiffSchema)
    .query(async ({ ctx, input }) => {
      return ctx.versioningService.compareVersions(
        input.workflowId,
        input.fromVersion,
        input.toVersion
      );
    }),

  publishVersion: protectedProcedure
    .input(z.object({
      workflowId: z.string().uuid(),
      versionId: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.versioningService.publishVersion(
        input.workflowId,
        input.versionId,
        ctx.user.id
      );
    }),

  rollback: protectedProcedure
    .input(rollbackRequestSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.versioningService.rollbackToVersion(
        input.workflowId,
        input.targetVersionNumber,
        input.reason,
        ctx.user.id,
        input.isEmergency
      );
    }),

  // Deployment management
  createDeployment: protectedProcedure
    .input(createDeploymentSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.deploymentService.createDeployment(
        input,
        ctx.user.id,
        ctx.organizationId
      );
    }),

  approveDeployment: protectedProcedure
    .input(z.object({ deploymentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.deploymentService.approveDeployment(
        input.deploymentId,
        ctx.user.id
      );
    }),

  getDeploymentHistory: protectedProcedure
    .input(z.object({
      workflowId: z.string().uuid(),
      environment: deploymentEnvironmentSchema.optional(),
      limit: z.number().min(1).max(100).default(20)
    }))
    .query(async ({ ctx, input }) => {
      return ctx.deploymentService.getDeploymentHistory(input);
    }),

  // A/B Testing
  createAbTest: protectedProcedure
    .input(createAbTestSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.abTestService.createTest(input, ctx.user.id, ctx.organizationId);
    }),

  getAbTestResults: protectedProcedure
    .input(z.object({ testId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.abTestService.getResults(input.testId);
    }),

  // Canary deployment
  promoteCanary: protectedProcedure
    .input(z.object({ deploymentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.deploymentService.promoteCanaryDeployment(input.deploymentId);
    }),

  rollbackCanary: protectedProcedure
    .input(z.object({
      deploymentId: z.string().uuid(),
      reason: z.string().min(10)
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.deploymentService.rollbackCanaryDeployment(
        input.deploymentId,
        input.reason
      );
    })
});
```

---

## Test Specifications

### Unit Tests

```typescript
describe('VersioningService', () => {
  describe('createVersion', () => {
    it('should create version with incremented version number', async () => {
      // Given existing workflow with version 3
      const workflow = await createTestWorkflow({ versionNumber: 3 });

      // When creating new version
      const version = await versioningService.createVersion(
        workflow.id,
        validVersionInput,
        userId,
        organizationId
      );

      // Then version number should be 4
      expect(version.versionNumber).toBe(4);
      expect(version.status).toBe('draft');
    });

    it('should generate diff from previous version', async () => {
      const workflow = await createTestWorkflow({ versionNumber: 1 });

      await versioningService.createVersion(
        workflow.id,
        modifiedVersionInput,
        userId,
        organizationId
      );

      const diff = await prisma.versionDiff.findFirst({
        where: { workflowId: workflow.id, fromVersion: 1, toVersion: 2 }
      });

      expect(diff).toBeDefined();
      expect(diff.nodesModified).toHaveLength(1);
    });
  });

  describe('rollbackToVersion', () => {
    it('should create new version from target and mark as current', async () => {
      const workflow = await createTestWorkflowWithVersions(5);

      const result = await versioningService.rollbackToVersion(
        workflow.id,
        3,
        'Performance regression',
        userId,
        false
      );

      expect(result.newVersion.versionNumber).toBe(6);
      expect(result.newVersion.isCurrent).toBe(true);
      expect(result.rolledBackToVersion).toBe(3);
    });

    it('should allow emergency rollback without approval', async () => {
      const workflow = await createTestWorkflowWithVersions(3);

      const result = await versioningService.rollbackToVersion(
        workflow.id,
        1,
        'Critical failure',
        userId,
        true // Emergency
      );

      expect(result.deployment.status).toBe('deployed');
      expect(result.deployment.approvedBy).toBe(userId);
    });
  });
});

describe('DeploymentService', () => {
  describe('createDeployment', () => {
    it('should validate workflow before deployment', async () => {
      const invalidVersion = await createInvalidVersion();

      await expect(
        deploymentService.createDeployment(
          { ...validDeploymentInput, versionId: invalidVersion.id },
          userId,
          organizationId
        )
      ).rejects.toThrow(DeploymentValidationException);
    });

    it('should initialize canary deployment when type is canary', async () => {
      const deployment = await deploymentService.createDeployment(
        {
          ...validDeploymentInput,
          deploymentType: 'canary',
          deploymentConfig: {
            canaryConfig: { initialPercentage: 10 }
          }
        },
        userId,
        organizationId
      );

      const canary = await prisma.canaryDeployment.findFirst({
        where: { deploymentId: deployment.id }
      });

      expect(canary).toBeDefined();
      expect(canary.currentPercentage).toBe(10);
    });
  });

  describe('promoteCanaryDeployment', () => {
    it('should increment percentage by step size', async () => {
      const canary = await createTestCanaryDeployment({
        currentPercentage: 30,
        stepSize: 10
      });

      await deploymentService.promoteCanaryDeployment(canary.deploymentId);

      const updated = await prisma.canaryDeployment.findUnique({
        where: { id: canary.id }
      });

      expect(updated.currentPercentage).toBe(40);
    });

    it('should mark as completed when reaching 100%', async () => {
      const canary = await createTestCanaryDeployment({
        currentPercentage: 95,
        stepSize: 10
      });

      await deploymentService.promoteCanaryDeployment(canary.deploymentId);

      const updated = await prisma.canaryDeployment.findUnique({
        where: { id: canary.id }
      });

      expect(updated.currentPercentage).toBe(100);
      expect(updated.status).toBe('completed');
    });
  });
});
```

### Integration Tests

```typescript
describe('Versioning & Deployment Integration', () => {
  it('should handle full deployment lifecycle', async () => {
    // Create workflow
    const workflow = await createTestWorkflow();

    // Create and publish version
    const version = await versioningService.createVersion(
      workflow.id,
      validVersionInput,
      userId,
      organizationId
    );

    await versioningService.publishVersion(workflow.id, version.id, userId);

    // Create deployment to staging
    const stagingDeployment = await deploymentService.createDeployment(
      {
        workflowId: workflow.id,
        versionId: version.id,
        environment: 'staging',
        deploymentType: 'standard'
      },
      userId,
      organizationId
    );

    expect(stagingDeployment.status).toBe('deployed');

    // Promote to production
    const prodDeployment = await deploymentService.createDeployment(
      {
        workflowId: workflow.id,
        versionId: version.id,
        environment: 'production',
        deploymentType: 'canary',
        deploymentConfig: {
          canaryConfig: { initialPercentage: 10 }
        }
      },
      userId,
      organizationId
    );

    // Gradually promote canary
    for (let i = 0; i < 9; i++) {
      await deploymentService.promoteCanaryDeployment(prodDeployment.id);
    }

    const canary = await prisma.canaryDeployment.findFirst({
      where: { deploymentId: prodDeployment.id }
    });

    expect(canary.status).toBe('completed');
  });

  it('should handle rollback scenario', async () => {
    const workflow = await createTestWorkflowWithVersions(3);

    // Deploy version 3
    await deploymentService.createDeployment(
      { workflowId: workflow.id, versionId: 'v3', environment: 'production' },
      userId,
      organizationId
    );

    // Simulate failure and rollback
    const result = await versioningService.rollbackToVersion(
      workflow.id,
      2,
      'High error rate detected',
      userId,
      true
    );

    // Verify rollback
    const currentVersion = await prisma.workflowVersion.findFirst({
      where: { workflowId: workflow.id, isCurrent: true }
    });

    expect(currentVersion.versionNumber).toBe(4); // New version from v2
    expect(result.deployment.deploymentType).toBe('rollback');
  });
});
```

---

## Security Checklist

- [x] RLS policies for all versioning tables
- [x] Deployment approval workflow with proper authorization
- [x] Emergency rollback requires audit logging
- [x] Version changes tracked with user attribution
- [x] Canary deployment health checks prevent bad deployments
- [x] Deployment gates enforce validation requirements
- [x] A/B test access restricted to authorized users
- [x] Rollback reason required and logged

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `workflow.version.created` | New version saved | workflowId, versionNumber, changelog |
| `workflow.version.published` | Version published | workflowId, versionId, publishedBy |
| `workflow.deployment.created` | Deployment initiated | deploymentId, environment, type |
| `workflow.deployment.approved` | Deployment approved | deploymentId, approvedBy |
| `workflow.deployment.completed` | Deployment successful | deploymentId, duration |
| `workflow.deployment.failed` | Deployment failed | deploymentId, error |
| `workflow.rollback.completed` | Rollback executed | workflowId, from/to versions, reason |
| `workflow.canary.promoted` | Canary reached 100% | deploymentId |
| `workflow.abtest.started` | A/B test begun | testId, versions |
| `workflow.abtest.completed` | A/B test finished | testId, winner |

---

## Implementation Notes

### Dependencies
- WFA-001 (Visual Workflow Designer) - canvas data structure
- WFA-004 (Error Handling) - rollback triggers on high error rates

### Performance Considerations
- Version diffs are cached to avoid recalculation
- Canary percentage checks should be < 10ms
- Deployment validation runs in background for large workflows

### Polish Accounting Context
- Deployment gates can require Polish accounting compliance validation
- Rollback audit trails meet Polish regulatory requirements
- Version history retention meets legal document retention requirements (5+ years)

---

*Last Updated: December 2024*
