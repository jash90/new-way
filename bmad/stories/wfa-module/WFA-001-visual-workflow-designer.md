# WFA-001: Visual Workflow Designer

> **Story ID**: WFA-001
> **Epic**: Workflow Automation Engine (WFA)
> **Priority**: P0 (Critical)
> **Points**: 13
> **Status**: 📋 Ready for Development
> **Sprint**: Phase 5, Week 17

---

## 📋 User Story

**As an** accountant,
**I want** a visual drag-and-drop workflow designer,
**So that** I can create automation processes without coding knowledge.

---

## ✅ Acceptance Criteria

### Scenario 1: Canvas Interaction
```gherkin
Given I am on the workflow designer page
When I create a new workflow
Then I should see an empty canvas with grid guides
And I should see a node palette on the left side
And I should see a property panel on the right side
And the canvas should support zoom (25%-400%) and pan operations
```

### Scenario 2: Node Placement
```gherkin
Given I am on the workflow designer canvas
When I drag a node type from the palette
And I drop it onto the canvas
Then a new node should be created at the drop location
And the node should display its default icon and label
And the node should show connection ports (input/output)
And the node should be selected with visible handles
```

### Scenario 3: Node Connection
```gherkin
Given I have two nodes on the canvas
When I drag from an output port to an input port
Then a visual connection line should follow my cursor
When I release over a valid input port
Then a permanent connection should be created
And the connection should be styled with an arrow
And invalid connections should be prevented with visual feedback
```

### Scenario 4: Node Configuration
```gherkin
Given I have a node selected on the canvas
When I click the node or double-click to open properties
Then the property panel should display the node's configuration
And I should be able to edit node-specific settings
And changes should be reflected immediately on the canvas
And required fields should be clearly marked
```

### Scenario 5: Undo/Redo Operations
```gherkin
Given I have made changes to the workflow
When I click the undo button or press Ctrl+Z
Then the last change should be reverted
And redo should restore the undone change
And the history should support at least 50 operations
```

### Scenario 6: Workflow Validation
```gherkin
Given I have designed a workflow
When I click the validate button
Then the system should check for:
  - At least one trigger node
  - All required node properties filled
  - No disconnected nodes
  - No circular dependencies
  - Valid connection types
And validation errors should be highlighted on affected nodes
And a summary of issues should be displayed
```

### Scenario 7: Preview Mode
```gherkin
Given I have a valid workflow
When I click the preview button
Then I should see a read-only view of the workflow
And I should be able to simulate execution with test data
And execution path should be highlighted step by step
And I should see sample outputs at each step
```

### Scenario 8: Save and Auto-save
```gherkin
Given I am editing a workflow
When I make changes to the workflow
Then the system should auto-save every 30 seconds
And manual save should be available via Ctrl+S
And I should see a "saving..." indicator during save
And unsaved changes should trigger a warning when leaving
```

---

## 🔧 Technical Specification

### Database Schema

```sql
-- Workflow definitions
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    created_by UUID NOT NULL REFERENCES users(id),

    -- Basic info
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Designer state
    canvas_data JSONB NOT NULL DEFAULT '{
        "nodes": [],
        "edges": [],
        "viewport": {"x": 0, "y": 0, "zoom": 1}
    }',

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'paused', 'archived')),

    -- Settings
    settings JSONB NOT NULL DEFAULT '{
        "timeout": 3600000,
        "retryOnFailure": true,
        "maxRetries": 3,
        "notifyOnFailure": true
    }',

    -- Versioning
    version INTEGER NOT NULL DEFAULT 1,
    published_version INTEGER,

    -- Metadata
    tags TEXT[] DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_executed_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT unique_workflow_name_per_org UNIQUE (organization_id, name)
);

-- Workflow nodes (denormalized for flexibility)
CREATE TABLE workflow_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

    -- Node identification
    node_id VARCHAR(100) NOT NULL, -- Canvas node ID
    node_type VARCHAR(50) NOT NULL,

    -- Position
    position_x DECIMAL(10, 2) NOT NULL,
    position_y DECIMAL(10, 2) NOT NULL,
    width DECIMAL(10, 2) DEFAULT 200,
    height DECIMAL(10, 2) DEFAULT 100,

    -- Configuration
    label VARCHAR(255),
    config JSONB NOT NULL DEFAULT '{}',

    -- Validation
    is_valid BOOLEAN DEFAULT true,
    validation_errors JSONB DEFAULT '[]',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_node_in_workflow UNIQUE (workflow_id, node_id)
);

-- Workflow edges (connections)
CREATE TABLE workflow_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

    -- Connection
    edge_id VARCHAR(100) NOT NULL,
    source_node_id VARCHAR(100) NOT NULL,
    source_handle VARCHAR(50) DEFAULT 'output',
    target_node_id VARCHAR(100) NOT NULL,
    target_handle VARCHAR(50) DEFAULT 'input',

    -- Styling
    edge_type VARCHAR(20) DEFAULT 'smoothstep',
    label VARCHAR(100),
    animated BOOLEAN DEFAULT false,

    -- Conditional routing
    condition JSONB, -- For conditional branches

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_edge_in_workflow UNIQUE (workflow_id, edge_id)
);

-- Auto-save drafts
CREATE TABLE workflow_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),

    -- Draft data
    canvas_data JSONB NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',

    CONSTRAINT unique_draft_per_user UNIQUE (workflow_id, user_id)
);

-- Workflow change history (for undo/redo)
CREATE TABLE workflow_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),

    -- Change info
    operation VARCHAR(50) NOT NULL, -- 'add_node', 'remove_node', 'move_node', etc.
    before_state JSONB,
    after_state JSONB,

    -- Ordering
    sequence_number INTEGER NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workflows_organization ON workflows(organization_id);
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflow_nodes_workflow ON workflow_nodes(workflow_id);
CREATE INDEX idx_workflow_edges_workflow ON workflow_edges(workflow_id);
CREATE INDEX idx_workflow_history_workflow ON workflow_history(workflow_id);
CREATE INDEX idx_workflow_drafts_expires ON workflow_drafts(expires_at);

-- RLS Policies
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflows_organization_isolation ON workflows
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY workflow_nodes_isolation ON workflow_nodes
    USING (workflow_id IN (
        SELECT id FROM workflows
        WHERE organization_id = current_setting('app.current_organization_id')::UUID
    ));

CREATE POLICY workflow_edges_isolation ON workflow_edges
    USING (workflow_id IN (
        SELECT id FROM workflows
        WHERE organization_id = current_setting('app.current_organization_id')::UUID
    ));
```

### Node Types Configuration

```typescript
// Node type definitions for the palette
export const NODE_TYPES = {
  // Triggers
  triggers: [
    {
      type: 'manual_trigger',
      label: 'Manual Trigger',
      icon: 'PlayCircle',
      description: 'Start workflow manually',
      category: 'trigger',
      inputs: 0,
      outputs: 1,
      config: {}
    },
    {
      type: 'scheduled_trigger',
      label: 'Schedule',
      icon: 'Clock',
      description: 'Run on a schedule',
      category: 'trigger',
      inputs: 0,
      outputs: 1,
      config: {
        schedule: { type: 'cron', required: true },
        timezone: { type: 'timezone', default: 'Europe/Warsaw' }
      }
    },
    {
      type: 'webhook_trigger',
      label: 'Webhook',
      icon: 'Webhook',
      description: 'Receive HTTP requests',
      category: 'trigger',
      inputs: 0,
      outputs: 1,
      config: {
        method: { type: 'select', options: ['GET', 'POST', 'PUT'], default: 'POST' },
        authentication: { type: 'select', options: ['none', 'basic', 'bearer'] }
      }
    },
    {
      type: 'document_trigger',
      label: 'Document Upload',
      icon: 'FileUp',
      description: 'When document is uploaded',
      category: 'trigger',
      inputs: 0,
      outputs: 1,
      config: {
        documentTypes: { type: 'multiselect', options: ['INVOICE', 'RECEIPT', 'CONTRACT'] },
        minConfidence: { type: 'number', min: 0, max: 1, default: 0.8 }
      }
    },
    {
      type: 'event_trigger',
      label: 'Event',
      icon: 'Zap',
      description: 'React to system events',
      category: 'trigger',
      inputs: 0,
      outputs: 1,
      config: {
        eventType: { type: 'select', options: ['client.created', 'invoice.processed', 'payment.received'] }
      }
    }
  ],

  // Actions
  actions: [
    {
      type: 'document_processor',
      label: 'Process Document',
      icon: 'FileText',
      description: 'OCR and data extraction',
      category: 'action',
      inputs: 1,
      outputs: 1,
      config: {
        extractionTemplate: { type: 'template_select' },
        validationRules: { type: 'json' }
      }
    },
    {
      type: 'approval_request',
      label: 'Request Approval',
      icon: 'UserCheck',
      description: 'Send approval request',
      category: 'action',
      inputs: 1,
      outputs: 2, // approved, rejected
      config: {
        assignee: { type: 'user_select', required: true },
        timeout: { type: 'duration', default: '48h' },
        escalateTo: { type: 'user_select' }
      }
    },
    {
      type: 'accounting_entry',
      label: 'Create Entry',
      icon: 'BookOpen',
      description: 'Create journal entry',
      category: 'action',
      inputs: 1,
      outputs: 1,
      config: {
        template: { type: 'entry_template_select' },
        autoPost: { type: 'boolean', default: false }
      }
    },
    {
      type: 'notification',
      label: 'Send Notification',
      icon: 'Bell',
      description: 'Send email/SMS/app notification',
      category: 'action',
      inputs: 1,
      outputs: 1,
      config: {
        channels: { type: 'multiselect', options: ['email', 'sms', 'app', 'slack'] },
        template: { type: 'notification_template' },
        recipients: { type: 'recipient_select' }
      }
    },
    {
      type: 'api_call',
      label: 'HTTP Request',
      icon: 'Globe',
      description: 'Call external API',
      category: 'action',
      inputs: 1,
      outputs: 2, // success, error
      config: {
        url: { type: 'string', required: true },
        method: { type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'] },
        headers: { type: 'key_value' },
        body: { type: 'json' }
      }
    },
    {
      type: 'tax_calculator',
      label: 'Calculate Tax',
      icon: 'Calculator',
      description: 'VAT/CIT/PIT calculation',
      category: 'action',
      inputs: 1,
      outputs: 1,
      config: {
        taxType: { type: 'select', options: ['VAT', 'CIT', 'PIT', 'ZUS'] }
      }
    }
  ],

  // Logic
  logic: [
    {
      type: 'condition',
      label: 'If/Else',
      icon: 'GitBranch',
      description: 'Conditional branching',
      category: 'logic',
      inputs: 1,
      outputs: 2, // true, false
      config: {
        condition: { type: 'expression', required: true }
      }
    },
    {
      type: 'switch',
      label: 'Switch',
      icon: 'GitMerge',
      description: 'Multi-path branching',
      category: 'logic',
      inputs: 1,
      outputs: 'dynamic',
      config: {
        cases: { type: 'case_list' },
        defaultCase: { type: 'boolean', default: true }
      }
    },
    {
      type: 'delay',
      label: 'Delay',
      icon: 'Timer',
      description: 'Wait for duration',
      category: 'logic',
      inputs: 1,
      outputs: 1,
      config: {
        duration: { type: 'duration', required: true },
        resumeAt: { type: 'datetime' }
      }
    },
    {
      type: 'loop',
      label: 'Loop',
      icon: 'Repeat',
      description: 'Iterate over items',
      category: 'logic',
      inputs: 1,
      outputs: 2, // each item, completed
      config: {
        itemsPath: { type: 'jsonpath', required: true },
        batchSize: { type: 'number', default: 1 }
      }
    },
    {
      type: 'merge',
      label: 'Merge',
      icon: 'Combine',
      description: 'Combine multiple paths',
      category: 'logic',
      inputs: 'dynamic',
      outputs: 1,
      config: {
        mode: { type: 'select', options: ['wait_all', 'first', 'append'] }
      }
    }
  ],

  // Data transformation
  data: [
    {
      type: 'transform',
      label: 'Transform Data',
      icon: 'Shuffle',
      description: 'Map and transform data',
      category: 'data',
      inputs: 1,
      outputs: 1,
      config: {
        mapping: { type: 'mapping_editor' }
      }
    },
    {
      type: 'filter',
      label: 'Filter',
      icon: 'Filter',
      description: 'Filter items',
      category: 'data',
      inputs: 1,
      outputs: 2, // passed, filtered
      config: {
        condition: { type: 'expression', required: true }
      }
    },
    {
      type: 'aggregate',
      label: 'Aggregate',
      icon: 'Layers',
      description: 'Aggregate data',
      category: 'data',
      inputs: 1,
      outputs: 1,
      config: {
        operation: { type: 'select', options: ['sum', 'avg', 'count', 'min', 'max'] },
        field: { type: 'jsonpath' }
      }
    }
  ]
} as const;
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Canvas viewport
export const viewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().min(0.25).max(4)
});

// Node position
export const positionSchema = z.object({
  x: z.number(),
  y: z.number()
});

// Node schema
export const workflowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  position: positionSchema,
  data: z.object({
    label: z.string().optional(),
    config: z.record(z.unknown()).default({})
  }),
  width: z.number().optional(),
  height: z.number().optional(),
  selected: z.boolean().optional(),
  dragging: z.boolean().optional()
});

// Edge schema
export const workflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  type: z.enum(['default', 'smoothstep', 'step', 'straight']).default('smoothstep'),
  label: z.string().optional(),
  animated: z.boolean().optional(),
  data: z.object({
    condition: z.string().optional()
  }).optional()
});

// Canvas data schema
export const canvasDataSchema = z.object({
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
  viewport: viewportSchema.optional()
});

// Workflow settings
export const workflowSettingsSchema = z.object({
  timeout: z.number().min(1000).max(86400000).default(3600000), // 1s - 24h
  retryOnFailure: z.boolean().default(true),
  maxRetries: z.number().min(0).max(10).default(3),
  retryDelay: z.number().min(1000).max(3600000).default(5000),
  notifyOnFailure: z.boolean().default(true),
  notifyOnSuccess: z.boolean().default(false),
  notificationRecipients: z.array(z.string().uuid()).optional(),
  executionPriority: z.enum(['low', 'normal', 'high']).default('normal')
});

// Create workflow input
export const createWorkflowSchema = z.object({
  name: z.string()
    .min(3, 'Nazwa musi mieć co najmniej 3 znaki')
    .max(255, 'Nazwa może mieć maksymalnie 255 znaków')
    .regex(/^[a-zA-Z0-9\s\-_ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+$/, 'Nazwa zawiera niedozwolone znaki'),
  description: z.string().max(2000).optional(),
  canvasData: canvasDataSchema.optional(),
  settings: workflowSettingsSchema.optional(),
  tags: z.array(z.string().max(50)).max(10).optional()
});

// Update workflow input
export const updateWorkflowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).max(255).optional(),
  description: z.string().max(2000).optional(),
  canvasData: canvasDataSchema.optional(),
  settings: workflowSettingsSchema.partial().optional(),
  tags: z.array(z.string().max(50)).max(10).optional()
});

// Validation result
export const validationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.object({
    nodeId: z.string().optional(),
    edgeId: z.string().optional(),
    field: z.string().optional(),
    message: z.string(),
    severity: z.enum(['error', 'warning'])
  }))
});

// Node config validation (dynamic based on node type)
export const nodeConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('scheduled_trigger'),
    schedule: z.string().min(1, 'Harmonogram jest wymagany'),
    timezone: z.string().default('Europe/Warsaw')
  }),
  z.object({
    type: z.literal('approval_request'),
    assignee: z.string().uuid('Wybierz osobę zatwierdzającą'),
    timeout: z.string().optional(),
    escalateTo: z.string().uuid().optional()
  }),
  z.object({
    type: z.literal('condition'),
    condition: z.string().min(1, 'Warunek jest wymagany')
  }),
  z.object({
    type: z.literal('api_call'),
    url: z.string().url('Podaj prawidłowy URL'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
    headers: z.record(z.string()).optional(),
    body: z.string().optional()
  }),
  // Add more node type schemas as needed
  z.object({
    type: z.string(),
    // Generic config for unknown types
  }).passthrough()
]);

// History operation
export const historyOperationSchema = z.object({
  operation: z.enum([
    'add_node', 'remove_node', 'move_node', 'update_node',
    'add_edge', 'remove_edge', 'update_edge',
    'update_settings', 'bulk_update'
  ]),
  beforeState: z.unknown(),
  afterState: z.unknown()
});
```

### Service Implementation

```typescript
// src/server/services/workflow-designer.service.ts
import { TRPCError } from '@trpc/server';
import { db } from '@/server/db';
import { eq, and, desc } from 'drizzle-orm';
import {
  workflows,
  workflowNodes,
  workflowEdges,
  workflowDrafts,
  workflowHistory
} from '@/server/db/schema';
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  canvasDataSchema,
  validationResultSchema
} from './workflow-designer.schemas';
import { WorkflowValidator } from './workflow-validator';
import { auditLog } from '@/server/services/audit.service';

export class WorkflowDesignerService {
  private validator: WorkflowValidator;

  constructor() {
    this.validator = new WorkflowValidator();
  }

  /**
   * Create a new workflow
   */
  async create(
    input: z.infer<typeof createWorkflowSchema>,
    context: { userId: string; organizationId: string }
  ) {
    const validated = createWorkflowSchema.parse(input);

    // Check for duplicate name
    const existing = await db.query.workflows.findFirst({
      where: and(
        eq(workflows.organizationId, context.organizationId),
        eq(workflows.name, validated.name)
      )
    });

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Workflow o tej nazwie już istnieje'
      });
    }

    // Create workflow
    const [workflow] = await db.insert(workflows).values({
      organizationId: context.organizationId,
      createdBy: context.userId,
      name: validated.name,
      description: validated.description,
      canvasData: validated.canvasData || { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
      settings: validated.settings || {},
      tags: validated.tags || [],
      status: 'draft'
    }).returning();

    // Audit log
    await auditLog({
      action: 'workflow.created',
      entityType: 'workflow',
      entityId: workflow.id,
      userId: context.userId,
      organizationId: context.organizationId,
      details: { name: workflow.name }
    });

    return workflow;
  }

  /**
   * Update workflow canvas data
   */
  async updateCanvas(
    workflowId: string,
    canvasData: z.infer<typeof canvasDataSchema>,
    context: { userId: string; organizationId: string }
  ) {
    const validated = canvasDataSchema.parse(canvasData);

    // Get current workflow
    const workflow = await this.getById(workflowId, context);

    // Store history for undo
    await db.insert(workflowHistory).values({
      workflowId: workflow.id,
      userId: context.userId,
      operation: 'bulk_update',
      beforeState: workflow.canvasData,
      afterState: validated,
      sequenceNumber: await this.getNextHistorySequence(workflowId)
    });

    // Update workflow
    const [updated] = await db.update(workflows)
      .set({
        canvasData: validated,
        updatedAt: new Date()
      })
      .where(eq(workflows.id, workflowId))
      .returning();

    return updated;
  }

  /**
   * Add a node to the workflow
   */
  async addNode(
    workflowId: string,
    node: z.infer<typeof workflowNodeSchema>,
    context: { userId: string; organizationId: string }
  ) {
    const workflow = await this.getById(workflowId, context);
    const canvasData = workflow.canvasData as z.infer<typeof canvasDataSchema>;

    // Check for duplicate node ID
    if (canvasData.nodes.some(n => n.id === node.id)) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Węzeł o tym ID już istnieje'
      });
    }

    // Add node
    const newCanvasData = {
      ...canvasData,
      nodes: [...canvasData.nodes, node]
    };

    // Store history
    await this.addHistory(workflowId, context.userId, 'add_node', null, node);

    // Update workflow
    return this.updateCanvas(workflowId, newCanvasData, context);
  }

  /**
   * Remove a node from the workflow
   */
  async removeNode(
    workflowId: string,
    nodeId: string,
    context: { userId: string; organizationId: string }
  ) {
    const workflow = await this.getById(workflowId, context);
    const canvasData = workflow.canvasData as z.infer<typeof canvasDataSchema>;

    const node = canvasData.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Węzeł nie znaleziony'
      });
    }

    // Remove node and connected edges
    const newCanvasData = {
      ...canvasData,
      nodes: canvasData.nodes.filter(n => n.id !== nodeId),
      edges: canvasData.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    };

    // Store history
    await this.addHistory(workflowId, context.userId, 'remove_node', node, null);

    return this.updateCanvas(workflowId, newCanvasData, context);
  }

  /**
   * Add an edge between nodes
   */
  async addEdge(
    workflowId: string,
    edge: z.infer<typeof workflowEdgeSchema>,
    context: { userId: string; organizationId: string }
  ) {
    const workflow = await this.getById(workflowId, context);
    const canvasData = workflow.canvasData as z.infer<typeof canvasDataSchema>;

    // Validate connection
    const sourceNode = canvasData.nodes.find(n => n.id === edge.source);
    const targetNode = canvasData.nodes.find(n => n.id === edge.target);

    if (!sourceNode || !targetNode) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Węzeł źródłowy lub docelowy nie istnieje'
      });
    }

    // Check for circular dependency
    if (this.wouldCreateCycle(canvasData.edges, edge)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'To połączenie utworzyłoby cykl'
      });
    }

    // Add edge
    const newCanvasData = {
      ...canvasData,
      edges: [...canvasData.edges, edge]
    };

    // Store history
    await this.addHistory(workflowId, context.userId, 'add_edge', null, edge);

    return this.updateCanvas(workflowId, newCanvasData, context);
  }

  /**
   * Validate workflow
   */
  async validate(
    workflowId: string,
    context: { userId: string; organizationId: string }
  ): Promise<z.infer<typeof validationResultSchema>> {
    const workflow = await this.getById(workflowId, context);
    return this.validator.validate(workflow.canvasData as z.infer<typeof canvasDataSchema>);
  }

  /**
   * Undo last operation
   */
  async undo(
    workflowId: string,
    context: { userId: string; organizationId: string }
  ) {
    const lastHistory = await db.query.workflowHistory.findFirst({
      where: eq(workflowHistory.workflowId, workflowId),
      orderBy: desc(workflowHistory.sequenceNumber)
    });

    if (!lastHistory || !lastHistory.beforeState) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Brak operacji do cofnięcia'
      });
    }

    // Restore previous state
    await db.update(workflows)
      .set({
        canvasData: lastHistory.beforeState as object,
        updatedAt: new Date()
      })
      .where(eq(workflows.id, workflowId));

    // Remove history entry
    await db.delete(workflowHistory)
      .where(eq(workflowHistory.id, lastHistory.id));

    return this.getById(workflowId, context);
  }

  /**
   * Auto-save draft
   */
  async autoSave(
    workflowId: string,
    canvasData: z.infer<typeof canvasDataSchema>,
    context: { userId: string; organizationId: string }
  ) {
    const validated = canvasDataSchema.parse(canvasData);

    await db.insert(workflowDrafts)
      .values({
        workflowId,
        userId: context.userId,
        canvasData: validated,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      })
      .onConflictDoUpdate({
        target: [workflowDrafts.workflowId, workflowDrafts.userId],
        set: {
          canvasData: validated,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

    return { success: true };
  }

  /**
   * Get workflow by ID
   */
  async getById(
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

  // Private helper methods
  private wouldCreateCycle(
    existingEdges: z.infer<typeof workflowEdgeSchema>[],
    newEdge: z.infer<typeof workflowEdgeSchema>
  ): boolean {
    const edges = [...existingEdges, newEdge];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outgoing = edges.filter(e => e.source === nodeId);
      for (const edge of outgoing) {
        if (!visited.has(edge.target)) {
          if (hasCycle(edge.target)) return true;
        } else if (recursionStack.has(edge.target)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    return hasCycle(newEdge.source);
  }

  private async getNextHistorySequence(workflowId: string): Promise<number> {
    const lastHistory = await db.query.workflowHistory.findFirst({
      where: eq(workflowHistory.workflowId, workflowId),
      orderBy: desc(workflowHistory.sequenceNumber)
    });
    return (lastHistory?.sequenceNumber || 0) + 1;
  }

  private async addHistory(
    workflowId: string,
    userId: string,
    operation: string,
    before: unknown,
    after: unknown
  ) {
    await db.insert(workflowHistory).values({
      workflowId,
      userId,
      operation,
      beforeState: before,
      afterState: after,
      sequenceNumber: await this.getNextHistorySequence(workflowId)
    });
  }
}
```

### tRPC Router

```typescript
// src/server/api/routers/workflow-designer.router.ts
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { WorkflowDesignerService } from '@/server/services/workflow-designer.service';
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  canvasDataSchema,
  workflowNodeSchema,
  workflowEdgeSchema
} from '@/server/services/workflow-designer.schemas';
import { z } from 'zod';

const service = new WorkflowDesignerService();

export const workflowDesignerRouter = createTRPCRouter({
  // Create workflow
  create: protectedProcedure
    .input(createWorkflowSchema)
    .mutation(async ({ input, ctx }) => {
      return service.create(input, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Get workflow by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return service.getById(input.id, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // List workflows
  list: protectedProcedure
    .input(z.object({
      status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ input, ctx }) => {
      return service.list(input, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Update canvas
  updateCanvas: protectedProcedure
    .input(z.object({
      workflowId: z.string().uuid(),
      canvasData: canvasDataSchema
    }))
    .mutation(async ({ input, ctx }) => {
      return service.updateCanvas(input.workflowId, input.canvasData, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Add node
  addNode: protectedProcedure
    .input(z.object({
      workflowId: z.string().uuid(),
      node: workflowNodeSchema
    }))
    .mutation(async ({ input, ctx }) => {
      return service.addNode(input.workflowId, input.node, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Remove node
  removeNode: protectedProcedure
    .input(z.object({
      workflowId: z.string().uuid(),
      nodeId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      return service.removeNode(input.workflowId, input.nodeId, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Add edge
  addEdge: protectedProcedure
    .input(z.object({
      workflowId: z.string().uuid(),
      edge: workflowEdgeSchema
    }))
    .mutation(async ({ input, ctx }) => {
      return service.addEdge(input.workflowId, input.edge, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Validate workflow
  validate: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return service.validate(input.workflowId, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Undo operation
  undo: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return service.undo(input.workflowId, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    }),

  // Auto-save
  autoSave: protectedProcedure
    .input(z.object({
      workflowId: z.string().uuid(),
      canvasData: canvasDataSchema
    }))
    .mutation(async ({ input, ctx }) => {
      return service.autoSave(input.workflowId, input.canvasData, {
        userId: ctx.session.user.id,
        organizationId: ctx.session.user.organizationId
      });
    })
});
```

---

## 🧪 Test Specification

### Unit Tests

```typescript
describe('WorkflowDesignerService', () => {
  describe('create', () => {
    it('should create a new workflow with default canvas', async () => {
      const input = { name: 'Test Workflow' };
      const result = await service.create(input, context);

      expect(result.name).toBe('Test Workflow');
      expect(result.status).toBe('draft');
      expect(result.canvasData.nodes).toHaveLength(0);
    });

    it('should reject duplicate workflow names', async () => {
      await service.create({ name: 'Duplicate' }, context);
      await expect(service.create({ name: 'Duplicate' }, context))
        .rejects.toThrow('Workflow o tej nazwie już istnieje');
    });
  });

  describe('addNode', () => {
    it('should add a node to the canvas', async () => {
      const workflow = await createTestWorkflow();
      const node = createTestNode('trigger');

      const result = await service.addNode(workflow.id, node, context);

      expect(result.canvasData.nodes).toHaveLength(1);
    });

    it('should reject duplicate node IDs', async () => {
      const workflow = await createTestWorkflow();
      const node = createTestNode('trigger');

      await service.addNode(workflow.id, node, context);
      await expect(service.addNode(workflow.id, node, context))
        .rejects.toThrow('Węzeł o tym ID już istnieje');
    });
  });

  describe('addEdge', () => {
    it('should connect two nodes', async () => {
      const workflow = await createWorkflowWithNodes();
      const edge = createTestEdge('node1', 'node2');

      const result = await service.addEdge(workflow.id, edge, context);

      expect(result.canvasData.edges).toHaveLength(1);
    });

    it('should reject circular dependencies', async () => {
      const workflow = await createWorkflowWithCircularSetup();
      const edge = createTestEdge('node3', 'node1'); // Would create cycle

      await expect(service.addEdge(workflow.id, edge, context))
        .rejects.toThrow('To połączenie utworzyłoby cykl');
    });
  });

  describe('validate', () => {
    it('should pass for valid workflow', async () => {
      const workflow = await createValidWorkflow();

      const result = await service.validate(workflow.id, context);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail without trigger node', async () => {
      const workflow = await createWorkflowWithoutTrigger();

      const result = await service.validate(workflow.id, context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ message: expect.stringContaining('trigger') })
      );
    });
  });

  describe('undo', () => {
    it('should restore previous state', async () => {
      const workflow = await createTestWorkflow();
      const node = createTestNode('trigger');

      await service.addNode(workflow.id, node, context);
      const afterUndo = await service.undo(workflow.id, context);

      expect(afterUndo.canvasData.nodes).toHaveLength(0);
    });
  });
});
```

### Integration Tests

```typescript
describe('Workflow Designer Integration', () => {
  it('should handle complete workflow creation flow', async () => {
    // Create workflow
    const workflow = await caller.workflowDesigner.create({
      name: 'Invoice Processing'
    });

    // Add trigger
    await caller.workflowDesigner.addNode({
      workflowId: workflow.id,
      node: {
        id: 'trigger1',
        type: 'document_trigger',
        position: { x: 100, y: 100 },
        data: { config: { documentTypes: ['INVOICE'] } }
      }
    });

    // Add processor
    await caller.workflowDesigner.addNode({
      workflowId: workflow.id,
      node: {
        id: 'processor1',
        type: 'document_processor',
        position: { x: 300, y: 100 },
        data: { config: {} }
      }
    });

    // Connect nodes
    await caller.workflowDesigner.addEdge({
      workflowId: workflow.id,
      edge: {
        id: 'edge1',
        source: 'trigger1',
        target: 'processor1'
      }
    });

    // Validate
    const validation = await caller.workflowDesigner.validate({
      workflowId: workflow.id
    });

    expect(validation.isValid).toBe(true);
  });
});
```

### E2E Tests

```typescript
describe('Visual Workflow Designer E2E', () => {
  beforeEach(async () => {
    await page.goto('/workflows/new');
  });

  it('should create workflow via drag and drop', async () => {
    // Drag trigger node
    await page.locator('[data-node-type="manual_trigger"]').dragTo(
      page.locator('[data-testid="canvas"]'),
      { targetPosition: { x: 200, y: 200 } }
    );

    // Verify node placed
    await expect(page.locator('[data-node-id]')).toBeVisible();

    // Add another node
    await page.locator('[data-node-type="notification"]').dragTo(
      page.locator('[data-testid="canvas"]'),
      { targetPosition: { x: 400, y: 200 } }
    );

    // Connect nodes
    await page.locator('[data-handle="output"]').first().hover();
    await page.mouse.down();
    await page.locator('[data-handle="input"]').last().hover();
    await page.mouse.up();

    // Verify connection
    await expect(page.locator('[data-edge-id]')).toBeVisible();
  });

  it('should support undo/redo', async () => {
    // Add node
    await page.locator('[data-node-type="manual_trigger"]').dragTo(
      page.locator('[data-testid="canvas"]')
    );

    // Undo
    await page.keyboard.press('Control+z');
    await expect(page.locator('[data-node-id]')).not.toBeVisible();

    // Redo
    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator('[data-node-id]')).toBeVisible();
  });

  it('should validate workflow before save', async () => {
    // Try to save empty workflow
    await page.locator('[data-testid="save-button"]').click();

    // Should show validation error
    await expect(page.locator('[data-testid="validation-error"]'))
      .toContainText('trigger');
  });
});
```

---

## 🔒 Security Checklist

- [ ] All workflow operations require authentication
- [ ] RLS policies enforce organization isolation
- [ ] Node configurations sanitized before storage
- [ ] API URLs validated for allowed domains
- [ ] Credential references encrypted
- [ ] Canvas data validated against schema
- [ ] Rate limiting on auto-save endpoint
- [ ] Audit logging for all modifications
- [ ] XSS prevention in node labels
- [ ] CSRF protection on mutations

---

## 📊 Audit Events

```typescript
const AUDIT_EVENTS = {
  'workflow.created': 'Utworzono nowy workflow',
  'workflow.updated': 'Zaktualizowano workflow',
  'workflow.deleted': 'Usunięto workflow',
  'workflow.node_added': 'Dodano węzeł do workflow',
  'workflow.node_removed': 'Usunięto węzeł z workflow',
  'workflow.edge_added': 'Dodano połączenie w workflow',
  'workflow.validated': 'Zwalidowano workflow',
  'workflow.undo': 'Cofnięto operację w workflow'
};
```

---

## 📝 Implementation Notes

### React Flow Integration
- Use React Flow library for canvas rendering
- Custom node components for each node type
- Custom edge components with labels
- Minimap for large workflows
- Controls for zoom/pan

### Performance Considerations
- Virtualize node rendering for large workflows
- Debounce auto-save (30s minimum)
- Lazy load node property panels
- Optimize history storage (max 50 entries)

### Polish Language
- All UI text in Polish
- Node labels support Polish characters
- Error messages in Polish
- Date/time formatting per Polish locale

---

*Story created: December 2024*
