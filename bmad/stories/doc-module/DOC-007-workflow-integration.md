# DOC-007: Workflow Integration

> **Story ID**: DOC-007
> **Epic**: Document Intelligence Module (DOC)
> **Priority**: P1 (Essential)
> **Story Points**: 8
> **Status**: 📋 Ready for Development
> **Phase**: Week 15

---

## User Story

**As an** accountant,
**I want** documents to trigger automated workflows,
**So that** document processing is streamlined and consistent across the organization.

---

## Acceptance Criteria

### Scenario 1: Document Approval Workflow
```gherkin
Given a new invoice document with amount > 10,000 PLN is uploaded
When the document classification is completed
Then a multi-level approval workflow should be automatically triggered
And the document status should change to "pending_approval"
And the appropriate approver(s) should be notified based on approval rules
And the approval request should include document summary and extracted data
```

### Scenario 2: Automatic Accounting Entry Creation
```gherkin
Given a fully approved invoice document
When the approval workflow is completed successfully
Then the system should automatically create a draft accounting entry
And the entry should use extracted data (amounts, dates, VAT rates)
And the entry should be linked to the source document
And the accountant should be notified to review the draft entry
```

### Scenario 3: Notification Triggers
```gherkin
Given a document workflow event occurs (upload, approval needed, rejected, approved)
When the event matches configured notification rules
Then notifications should be sent via configured channels (email, in-app, SMS)
And notifications should include relevant document details
And notification delivery should be logged
And recipients should be able to take action directly from notifications
```

### Scenario 4: Workflow Status Tracking
```gherkin
Given a document with an active workflow
When a user views the document details
Then all workflow stages should be visible with timestamps
And current stage and pending actions should be highlighted
And estimated completion time should be displayed
And workflow history should be accessible
```

### Scenario 5: Approval History and Audit Trail
```gherkin
Given a document that has gone through approval workflow
When the approval history is queried
Then all approval decisions should be displayed with:
  - Approver identity
  - Decision (approved/rejected/delegated)
  - Timestamp
  - Comments/justification
  - IP address and device info
And the history should be immutable and tamper-evident
```

### Scenario 6: Workflow Templates
```gherkin
Given an accountant needs to create a new document workflow
When they access the workflow template library
Then they should see pre-configured templates for common Polish accounting scenarios:
  - Faktura kosztowa (Cost invoice approval)
  - Faktura sprzedażowa (Sales invoice processing)
  - Umowa (Contract approval)
  - Rachunek (Receipt processing)
And they should be able to customize templates
And templates should support conditional branching
```

### Scenario 7: Escalation Rules
```gherkin
Given an approval request has been pending for longer than the configured SLA
When the escalation threshold is reached (e.g., 48 hours)
Then the request should be automatically escalated to the next level approver
And the original approver should be notified of the escalation
And an audit entry should be created for the escalation
And the escalation chain should be configurable per workflow type
```

### Scenario 8: Parallel and Sequential Approval Paths
```gherkin
Given a complex document requiring multiple approvals
When the workflow is configured with parallel and sequential paths
Then parallel approvers should be notified simultaneously
And sequential stages should only activate when previous stages complete
And "all must approve" vs "any must approve" rules should be respected
And workflow progress should accurately reflect completion percentage
```

---

## Technical Specification

### Database Schema

```sql
-- Workflow Definitions
CREATE TABLE document_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Basic Info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    workflow_type VARCHAR(50) NOT NULL, -- 'approval', 'processing', 'review', 'custom'
    document_types TEXT[], -- Which document types trigger this workflow

    -- Configuration
    config JSONB NOT NULL DEFAULT '{}',
    -- {
    --   trigger_conditions: { document_type: [...], amount_threshold: ..., tags: [...] },
    --   stages: [...],
    --   escalation_rules: {...},
    --   notifications: {...},
    --   auto_actions: {...}
    -- }

    -- Activation
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- Higher = evaluated first

    -- Polish accounting specifics
    creates_accounting_entry BOOLEAN DEFAULT false,
    entry_template_id UUID REFERENCES accounting_entry_templates(id),

    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_workflow_type CHECK (workflow_type IN ('approval', 'processing', 'review', 'custom'))
);

-- Workflow Stages
CREATE TABLE workflow_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES document_workflows(id) ON DELETE CASCADE,

    -- Stage Info
    stage_order INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    stage_type VARCHAR(50) NOT NULL, -- 'approval', 'review', 'action', 'notification', 'condition'

    -- Execution
    execution_mode VARCHAR(20) DEFAULT 'sequential', -- 'sequential', 'parallel'
    approval_mode VARCHAR(20) DEFAULT 'any', -- 'any', 'all', 'majority', 'threshold'
    approval_threshold DECIMAL(5,2), -- For 'threshold' mode (e.g., 0.75 = 75%)

    -- Assignees
    assignee_type VARCHAR(50) NOT NULL, -- 'user', 'role', 'department', 'dynamic', 'document_owner'
    assignee_ids UUID[], -- User IDs for 'user' type
    assignee_roles VARCHAR(100)[], -- Role names for 'role' type
    dynamic_assignee_rule JSONB, -- Rule for dynamic assignment

    -- SLA
    sla_hours INTEGER DEFAULT 24,
    escalation_enabled BOOLEAN DEFAULT true,
    escalation_target_type VARCHAR(50), -- 'user', 'role', 'manager'
    escalation_target_id UUID,

    -- Conditions
    entry_conditions JSONB, -- Conditions to enter this stage
    skip_conditions JSONB, -- Conditions to skip this stage

    -- Actions
    on_enter_actions JSONB, -- Actions when entering stage
    on_complete_actions JSONB, -- Actions when completing stage
    on_reject_actions JSONB, -- Actions on rejection

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(workflow_id, stage_order)
);

-- Workflow Instances (Active workflows on documents)
CREATE TABLE workflow_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- References
    workflow_id UUID NOT NULL REFERENCES document_workflows(id),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

    -- Status
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'cancelled', 'failed'
    current_stage_id UUID REFERENCES workflow_stages(id),
    progress_percentage DECIMAL(5,2) DEFAULT 0,

    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    due_at TIMESTAMPTZ, -- Overall workflow deadline

    -- Context
    context_data JSONB DEFAULT '{}', -- Workflow-specific data
    initiator_id UUID REFERENCES users(id),

    -- Results
    final_outcome VARCHAR(50), -- 'approved', 'rejected', 'cancelled'
    outcome_reason TEXT,

    -- Polish accounting results
    accounting_entry_id UUID, -- Created entry if applicable

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_instance_status CHECK (status IN ('active', 'completed', 'cancelled', 'failed'))
);

-- Stage Instances (Active stages within workflow instances)
CREATE TABLE stage_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES workflow_stages(id),

    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'active', 'completed', 'skipped', 'escalated'

    -- Timing
    activated_at TIMESTAMPTZ,
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Outcome
    outcome VARCHAR(50), -- 'approved', 'rejected', 'delegated'
    outcome_data JSONB,

    -- Escalation
    escalation_count INTEGER DEFAULT 0,
    last_escalated_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval Tasks
CREATE TABLE approval_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- References
    stage_instance_id UUID NOT NULL REFERENCES stage_instances(id) ON DELETE CASCADE,
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id),
    document_id UUID NOT NULL REFERENCES documents(id),

    -- Assignee
    assignee_id UUID NOT NULL REFERENCES users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),

    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'delegated', 'escalated', 'expired'

    -- Decision
    decision VARCHAR(50), -- 'approved', 'rejected', 'delegated'
    decision_at TIMESTAMPTZ,
    decision_comment TEXT,

    -- Delegation
    delegated_to_id UUID REFERENCES users(id),
    delegation_reason TEXT,

    -- SLA
    due_at TIMESTAMPTZ NOT NULL,
    reminder_sent_at TIMESTAMPTZ,
    escalated_at TIMESTAMPTZ,

    -- Audit
    decision_ip_address INET,
    decision_user_agent TEXT,
    decision_device_fingerprint VARCHAR(64),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Notifications
CREATE TABLE workflow_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- References
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id),
    stage_instance_id UUID REFERENCES stage_instances(id),
    approval_task_id UUID REFERENCES approval_tasks(id),

    -- Recipient
    recipient_id UUID NOT NULL REFERENCES users(id),

    -- Notification
    notification_type VARCHAR(50) NOT NULL, -- 'approval_request', 'reminder', 'escalation', 'completed', 'rejected'
    channel VARCHAR(20) NOT NULL, -- 'email', 'in_app', 'sms', 'push'

    -- Content
    subject VARCHAR(500),
    body TEXT,
    action_url TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'read', 'failed'
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,

    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Templates (Pre-configured workflows)
CREATE TABLE workflow_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Template Info
    name VARCHAR(255) NOT NULL,
    name_pl VARCHAR(255), -- Polish name
    description TEXT,
    description_pl TEXT, -- Polish description
    category VARCHAR(100), -- 'invoice', 'contract', 'receipt', 'payroll', 'general'

    -- Template Configuration
    template_config JSONB NOT NULL,
    -- {
    --   workflow_type: 'approval',
    --   document_types: ['INVOICE'],
    --   stages: [...],
    --   triggers: {...},
    --   notifications: {...}
    -- }

    -- Metadata
    is_system_template BOOLEAN DEFAULT false, -- Built-in templates
    icon VARCHAR(100),
    preview_image_url TEXT,

    -- Usage Stats
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Audit Log
CREATE TABLE workflow_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- References
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id),
    stage_instance_id UUID REFERENCES stage_instances(id),
    approval_task_id UUID REFERENCES approval_tasks(id),

    -- Event
    event_type VARCHAR(100) NOT NULL,
    -- 'workflow_started', 'stage_entered', 'stage_completed', 'approval_requested',
    -- 'approval_completed', 'delegated', 'escalated', 'notification_sent',
    -- 'workflow_completed', 'workflow_cancelled', 'entry_created'

    event_data JSONB NOT NULL DEFAULT '{}',

    -- Actor
    actor_id UUID REFERENCES users(id),
    actor_ip_address INET,
    actor_user_agent TEXT,

    -- Immutability
    event_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for tamper detection
    previous_hash VARCHAR(64), -- Hash chain

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounting Entry Templates (for auto-creation)
CREATE TABLE accounting_entry_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Template Info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    document_type VARCHAR(50) NOT NULL,

    -- Mapping Configuration
    entry_mapping JSONB NOT NULL,
    -- {
    --   debit_account_selector: { type: 'fixed', account_id: '...' } | { type: 'from_document', field: 'category' },
    --   credit_account_selector: {...},
    --   amount_field: 'gross_amount',
    --   date_field: 'document_date',
    --   description_template: 'Faktura {document_number} od {seller_name}',
    --   vat_handling: 'split' | 'gross' | 'net',
    --   auto_book: false
    -- }

    -- Validation
    requires_review BOOLEAN DEFAULT true,
    validation_rules JSONB,

    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workflow_instances_document ON workflow_instances(document_id);
CREATE INDEX idx_workflow_instances_status ON workflow_instances(status, organization_id);
CREATE INDEX idx_workflow_instances_current_stage ON workflow_instances(current_stage_id);
CREATE INDEX idx_stage_instances_workflow ON stage_instances(workflow_instance_id);
CREATE INDEX idx_approval_tasks_assignee ON approval_tasks(assignee_id, status);
CREATE INDEX idx_approval_tasks_due ON approval_tasks(due_at) WHERE status = 'pending';
CREATE INDEX idx_workflow_notifications_recipient ON workflow_notifications(recipient_id, status);
CREATE INDEX idx_workflow_audit_instance ON workflow_audit_log(workflow_instance_id);
CREATE INDEX idx_workflow_audit_created ON workflow_audit_log(created_at);

-- RLS Policies
ALTER TABLE document_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_entry_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_org_isolation ON document_workflows
    FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);

CREATE POLICY instance_org_isolation ON workflow_instances
    FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);

CREATE POLICY tasks_org_isolation ON approval_tasks
    FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);

CREATE POLICY notifications_org_isolation ON workflow_notifications
    FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);

CREATE POLICY audit_org_isolation ON workflow_audit_log
    FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);

-- Trigger for workflow progress calculation
CREATE OR REPLACE FUNCTION calculate_workflow_progress()
RETURNS TRIGGER AS $$
DECLARE
    total_stages INTEGER;
    completed_stages INTEGER;
    new_progress DECIMAL(5,2);
BEGIN
    SELECT COUNT(*) INTO total_stages
    FROM stage_instances
    WHERE workflow_instance_id = NEW.workflow_instance_id;

    SELECT COUNT(*) INTO completed_stages
    FROM stage_instances
    WHERE workflow_instance_id = NEW.workflow_instance_id
    AND status IN ('completed', 'skipped');

    IF total_stages > 0 THEN
        new_progress := (completed_stages::DECIMAL / total_stages) * 100;
    ELSE
        new_progress := 0;
    END IF;

    UPDATE workflow_instances
    SET progress_percentage = new_progress,
        updated_at = NOW()
    WHERE id = NEW.workflow_instance_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_workflow_progress
    AFTER UPDATE OF status ON stage_instances
    FOR EACH ROW
    EXECUTE FUNCTION calculate_workflow_progress();
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// ============ Workflow Configuration ============

export const triggerConditionSchema = z.object({
  document_types: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  amount_min: z.number().optional(),
  amount_max: z.number().optional(),
  custom_conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'contains', 'greaterThan', 'lessThan', 'between', 'in', 'notIn']),
    value: z.any()
  })).optional()
});

export const stageAssigneeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('user'),
    user_ids: z.array(z.string().uuid())
  }),
  z.object({
    type: z.literal('role'),
    roles: z.array(z.string())
  }),
  z.object({
    type: z.literal('department'),
    department_ids: z.array(z.string().uuid())
  }),
  z.object({
    type: z.literal('document_owner')
  }),
  z.object({
    type: z.literal('manager'),
    of: z.enum(['document_owner', 'department'])
  }),
  z.object({
    type: z.literal('dynamic'),
    rule: z.object({
      source: z.enum(['document_field', 'extracted_data', 'custom']),
      field: z.string(),
      fallback_user_id: z.string().uuid().optional()
    })
  })
]);

export const stageActionSchema = z.object({
  type: z.enum([
    'send_notification',
    'update_document_status',
    'create_accounting_entry',
    'assign_tag',
    'trigger_webhook',
    'execute_custom_action'
  ]),
  config: z.record(z.any())
});

export const workflowStageSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  stage_type: z.enum(['approval', 'review', 'action', 'notification', 'condition']),
  execution_mode: z.enum(['sequential', 'parallel']).default('sequential'),
  approval_mode: z.enum(['any', 'all', 'majority', 'threshold']).default('any'),
  approval_threshold: z.number().min(0).max(1).optional(),
  assignee: stageAssigneeSchema,
  sla_hours: z.number().int().min(1).max(720).default(24), // Max 30 days
  escalation_enabled: z.boolean().default(true),
  escalation_target: stageAssigneeSchema.optional(),
  entry_conditions: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.any()
  })).optional(),
  skip_conditions: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.any()
  })).optional(),
  on_enter_actions: z.array(stageActionSchema).optional(),
  on_complete_actions: z.array(stageActionSchema).optional(),
  on_reject_actions: z.array(stageActionSchema).optional()
});

export const notificationConfigSchema = z.object({
  channels: z.object({
    email: z.boolean().default(true),
    in_app: z.boolean().default(true),
    sms: z.boolean().default(false),
    push: z.boolean().default(false)
  }),
  templates: z.object({
    approval_request: z.object({
      subject: z.string(),
      body_template: z.string()
    }).optional(),
    reminder: z.object({
      subject: z.string(),
      body_template: z.string(),
      send_after_hours: z.number().default(12)
    }).optional(),
    escalation: z.object({
      subject: z.string(),
      body_template: z.string()
    }).optional(),
    completed: z.object({
      subject: z.string(),
      body_template: z.string()
    }).optional(),
    rejected: z.object({
      subject: z.string(),
      body_template: z.string()
    }).optional()
  })
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  workflow_type: z.enum(['approval', 'processing', 'review', 'custom']),
  document_types: z.array(z.string()),
  trigger_conditions: triggerConditionSchema,
  stages: z.array(workflowStageSchema).min(1).max(20),
  notifications: notificationConfigSchema,
  creates_accounting_entry: z.boolean().default(false),
  entry_template_id: z.string().uuid().optional(),
  is_active: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(0)
});

export const updateWorkflowSchema = createWorkflowSchema.partial().extend({
  id: z.string().uuid()
});

// ============ Approval Actions ============

export const approvalDecisionSchema = z.object({
  task_id: z.string().uuid(),
  decision: z.enum(['approved', 'rejected', 'delegated']),
  comment: z.string().max(2000).optional(),
  delegated_to_id: z.string().uuid().optional()
}).refine(
  (data) => {
    if (data.decision === 'delegated' && !data.delegated_to_id) {
      return false;
    }
    return true;
  },
  { message: 'Delegated decision requires delegated_to_id' }
);

export const bulkApprovalSchema = z.object({
  task_ids: z.array(z.string().uuid()).min(1).max(100),
  decision: z.enum(['approved', 'rejected']),
  comment: z.string().max(2000).optional()
});

// ============ Workflow Instance ============

export const startWorkflowSchema = z.object({
  document_id: z.string().uuid(),
  workflow_id: z.string().uuid().optional(), // If not provided, auto-select based on triggers
  context_data: z.record(z.any()).optional()
});

export const cancelWorkflowSchema = z.object({
  workflow_instance_id: z.string().uuid(),
  reason: z.string().min(1).max(500)
});

// ============ Workflow Templates ============

export const workflowTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  name_pl: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  description_pl: z.string().optional(),
  category: z.enum(['invoice', 'contract', 'receipt', 'payroll', 'general']),
  template_config: createWorkflowSchema.omit({ is_active: true, priority: true }),
  icon: z.string().max(100).optional()
});

// ============ Accounting Entry Template ============

export const accountSelectorSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('fixed'),
    account_id: z.string().uuid()
  }),
  z.object({
    type: z.literal('from_document'),
    field: z.string(),
    mapping: z.record(z.string().uuid()) // field value -> account_id
  }),
  z.object({
    type: z.literal('from_category'),
    default_account_id: z.string().uuid()
  })
]);

export const accountingEntryTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  document_type: z.string(),
  entry_mapping: z.object({
    debit_account_selector: accountSelectorSchema,
    credit_account_selector: accountSelectorSchema,
    amount_field: z.string().default('gross_amount'),
    date_field: z.string().default('document_date'),
    description_template: z.string(),
    vat_handling: z.enum(['split', 'gross', 'net']).default('split'),
    auto_book: z.boolean().default(false)
  }),
  requires_review: z.boolean().default(true),
  validation_rules: z.array(z.object({
    field: z.string(),
    rule: z.string(),
    error_message: z.string()
  })).optional()
});

// ============ Query Schemas ============

export const listWorkflowsQuerySchema = z.object({
  workflow_type: z.enum(['approval', 'processing', 'review', 'custom']).optional(),
  document_type: z.string().optional(),
  is_active: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20)
});

export const listPendingApprovalsSchema = z.object({
  assignee_id: z.string().uuid().optional(), // If not provided, current user
  status: z.enum(['pending', 'overdue', 'all']).default('pending'),
  document_type: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20)
});

export const workflowHistoryQuerySchema = z.object({
  workflow_instance_id: z.string().uuid().optional(),
  document_id: z.string().uuid().optional(),
  event_types: z.array(z.string()).optional(),
  from_date: z.coerce.date().optional(),
  to_date: z.coerce.date().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50)
});
```

### Implementation

```typescript
// src/modules/doc/services/workflow.service.ts

import { db } from '@/lib/db';
import { createHash } from 'crypto';
import { z } from 'zod';
import type {
  CreateWorkflowInput,
  WorkflowInstance,
  ApprovalTask,
  StageInstance,
  WorkflowAuditEntry
} from '../types/workflow.types';

// Polish workflow templates
const POLISH_WORKFLOW_TEMPLATES = {
  FAKTURA_KOSZTOWA: {
    name: 'Faktura kosztowa - zatwierdzanie',
    name_pl: 'Faktura kosztowa - zatwierdzanie',
    description: 'Workflow for cost invoice approval with multi-level authorization',
    category: 'invoice',
    template_config: {
      workflow_type: 'approval',
      document_types: ['INVOICE'],
      trigger_conditions: {
        custom_conditions: [
          { field: 'extracted_data.invoice_type', operator: 'equals', value: 'purchase' }
        ]
      },
      stages: [
        {
          name: 'Weryfikacja merytoryczna',
          stage_type: 'approval',
          assignee: { type: 'role', roles: ['department_manager'] },
          sla_hours: 24,
          on_complete_actions: [
            { type: 'send_notification', config: { template: 'stage_completed' } }
          ]
        },
        {
          name: 'Zatwierdzenie księgowe',
          stage_type: 'approval',
          assignee: { type: 'role', roles: ['accountant'] },
          sla_hours: 24,
          entry_conditions: [
            { field: 'previous_stage', operator: 'equals', value: 'approved' }
          ]
        },
        {
          name: 'Zatwierdzenie zarządu',
          stage_type: 'approval',
          assignee: { type: 'role', roles: ['director', 'ceo'] },
          sla_hours: 48,
          skip_conditions: [
            { field: 'extracted_data.gross_amount', operator: 'lessThan', value: 10000 }
          ]
        }
      ],
      creates_accounting_entry: true
    }
  },

  FAKTURA_SPRZEDAZOWA: {
    name: 'Faktura sprzedażowa - przetwarzanie',
    name_pl: 'Faktura sprzedażowa - przetwarzanie',
    description: 'Automated processing workflow for sales invoices',
    category: 'invoice',
    template_config: {
      workflow_type: 'processing',
      document_types: ['INVOICE'],
      trigger_conditions: {
        custom_conditions: [
          { field: 'extracted_data.invoice_type', operator: 'equals', value: 'sales' }
        ]
      },
      stages: [
        {
          name: 'Weryfikacja danych',
          stage_type: 'review',
          assignee: { type: 'role', roles: ['accountant'] },
          sla_hours: 8
        },
        {
          name: 'Księgowanie',
          stage_type: 'action',
          on_enter_actions: [
            { type: 'create_accounting_entry', config: { auto_book: false } }
          ]
        }
      ],
      creates_accounting_entry: true
    }
  },

  UMOWA: {
    name: 'Umowa - zatwierdzanie',
    name_pl: 'Umowa - zatwierdzanie',
    description: 'Contract approval workflow with legal review',
    category: 'contract',
    template_config: {
      workflow_type: 'approval',
      document_types: ['CONTRACT'],
      stages: [
        {
          name: 'Weryfikacja prawna',
          stage_type: 'review',
          assignee: { type: 'role', roles: ['legal'] },
          sla_hours: 72
        },
        {
          name: 'Zatwierdzenie kierownika',
          stage_type: 'approval',
          assignee: { type: 'manager', of: 'document_owner' },
          sla_hours: 48
        },
        {
          name: 'Zatwierdzenie zarządu',
          stage_type: 'approval',
          assignee: { type: 'role', roles: ['director', 'ceo'] },
          approval_mode: 'all',
          sla_hours: 72
        }
      ]
    }
  },

  RACHUNEK: {
    name: 'Rachunek - szybkie przetwarzanie',
    name_pl: 'Rachunek - szybkie przetwarzanie',
    description: 'Fast-track processing for receipts',
    category: 'receipt',
    template_config: {
      workflow_type: 'processing',
      document_types: ['RECEIPT'],
      stages: [
        {
          name: 'Automatyczna weryfikacja',
          stage_type: 'action',
          on_enter_actions: [
            { type: 'update_document_status', config: { status: 'verified' } }
          ],
          skip_conditions: [
            { field: 'extracted_data.total_amount', operator: 'greaterThan', value: 500 }
          ]
        },
        {
          name: 'Ręczna weryfikacja',
          stage_type: 'review',
          assignee: { type: 'role', roles: ['accountant'] },
          sla_hours: 24,
          entry_conditions: [
            { field: 'extracted_data.total_amount', operator: 'greaterThan', value: 500 }
          ]
        }
      ],
      creates_accounting_entry: true
    }
  }
};

export class WorkflowService {
  // ============ Workflow Definition Management ============

  static async createWorkflow(
    input: CreateWorkflowInput,
    organizationId: string,
    userId: string
  ) {
    const workflow = await db.transaction(async (tx) => {
      // Create workflow
      const [workflowRecord] = await tx
        .insert(documentWorkflows)
        .values({
          organization_id: organizationId,
          name: input.name,
          description: input.description,
          workflow_type: input.workflow_type,
          document_types: input.document_types,
          config: {
            trigger_conditions: input.trigger_conditions,
            notifications: input.notifications
          },
          is_active: input.is_active,
          priority: input.priority,
          creates_accounting_entry: input.creates_accounting_entry,
          entry_template_id: input.entry_template_id,
          created_by: userId
        })
        .returning();

      // Create stages
      for (let i = 0; i < input.stages.length; i++) {
        const stage = input.stages[i];
        await tx.insert(workflowStages).values({
          workflow_id: workflowRecord.id,
          stage_order: i + 1,
          name: stage.name,
          description: stage.description,
          stage_type: stage.stage_type,
          execution_mode: stage.execution_mode,
          approval_mode: stage.approval_mode,
          approval_threshold: stage.approval_threshold,
          assignee_type: stage.assignee.type,
          assignee_ids: stage.assignee.type === 'user' ? stage.assignee.user_ids : null,
          assignee_roles: stage.assignee.type === 'role' ? stage.assignee.roles : null,
          dynamic_assignee_rule: stage.assignee.type === 'dynamic' ? stage.assignee.rule : null,
          sla_hours: stage.sla_hours,
          escalation_enabled: stage.escalation_enabled,
          escalation_target_type: stage.escalation_target?.type,
          escalation_target_id: this.extractEscalationTargetId(stage.escalation_target),
          entry_conditions: stage.entry_conditions,
          skip_conditions: stage.skip_conditions,
          on_enter_actions: stage.on_enter_actions,
          on_complete_actions: stage.on_complete_actions,
          on_reject_actions: stage.on_reject_actions
        });
      }

      return workflowRecord;
    });

    return workflow;
  }

  static async getWorkflowById(workflowId: string, organizationId: string) {
    const workflow = await db.query.documentWorkflows.findFirst({
      where: and(
        eq(documentWorkflows.id, workflowId),
        eq(documentWorkflows.organization_id, organizationId)
      ),
      with: {
        stages: {
          orderBy: [asc(workflowStages.stage_order)]
        },
        entry_template: true
      }
    });

    return workflow;
  }

  static async listWorkflows(
    organizationId: string,
    query: z.infer<typeof listWorkflowsQuerySchema>
  ) {
    const conditions = [eq(documentWorkflows.organization_id, organizationId)];

    if (query.workflow_type) {
      conditions.push(eq(documentWorkflows.workflow_type, query.workflow_type));
    }
    if (query.document_type) {
      conditions.push(
        sql`${documentWorkflows.document_types} @> ARRAY[${query.document_type}]::text[]`
      );
    }
    if (query.is_active !== undefined) {
      conditions.push(eq(documentWorkflows.is_active, query.is_active));
    }

    const offset = (query.page - 1) * query.limit;

    const [workflows, countResult] = await Promise.all([
      db.query.documentWorkflows.findMany({
        where: and(...conditions),
        orderBy: [desc(documentWorkflows.priority), asc(documentWorkflows.name)],
        limit: query.limit,
        offset,
        with: {
          stages: {
            orderBy: [asc(workflowStages.stage_order)]
          }
        }
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(documentWorkflows)
        .where(and(...conditions))
    ]);

    return {
      workflows,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: Number(countResult[0].count),
        pages: Math.ceil(Number(countResult[0].count) / query.limit)
      }
    };
  }

  // ============ Workflow Instance Management ============

  static async startWorkflow(
    documentId: string,
    workflowId: string | null,
    organizationId: string,
    userId: string,
    contextData?: Record<string, any>
  ): Promise<WorkflowInstance> {
    return await db.transaction(async (tx) => {
      // Get document with extracted data
      const document = await tx.query.documents.findFirst({
        where: eq(documents.id, documentId),
        with: {
          extraction_result: true
        }
      });

      if (!document) {
        throw new Error('Dokument nie został znaleziony');
      }

      // Find matching workflow if not specified
      let workflow;
      if (workflowId) {
        workflow = await tx.query.documentWorkflows.findFirst({
          where: and(
            eq(documentWorkflows.id, workflowId),
            eq(documentWorkflows.organization_id, organizationId),
            eq(documentWorkflows.is_active, true)
          ),
          with: { stages: { orderBy: [asc(workflowStages.stage_order)] } }
        });
      } else {
        workflow = await this.findMatchingWorkflow(document, organizationId, tx);
      }

      if (!workflow) {
        throw new Error('Nie znaleziono pasującego workflow dla tego dokumentu');
      }

      // Create workflow instance
      const [instance] = await tx
        .insert(workflowInstances)
        .values({
          organization_id: organizationId,
          workflow_id: workflow.id,
          document_id: documentId,
          status: 'active',
          initiator_id: userId,
          context_data: contextData || {}
        })
        .returning();

      // Create stage instances
      for (const stage of workflow.stages) {
        await tx.insert(stageInstances).values({
          workflow_instance_id: instance.id,
          stage_id: stage.id,
          status: 'pending'
        });
      }

      // Activate first stage
      await this.activateNextStage(instance.id, tx);

      // Audit log
      await this.createAuditEntry(tx, {
        organization_id: organizationId,
        workflow_instance_id: instance.id,
        event_type: 'workflow_started',
        event_data: {
          document_id: documentId,
          workflow_name: workflow.name,
          initiated_by: userId
        },
        actor_id: userId
      });

      return instance;
    });
  }

  private static async findMatchingWorkflow(
    document: any,
    organizationId: string,
    tx: any
  ) {
    const workflows = await tx.query.documentWorkflows.findMany({
      where: and(
        eq(documentWorkflows.organization_id, organizationId),
        eq(documentWorkflows.is_active, true),
        sql`${documentWorkflows.document_types} @> ARRAY[${document.document_type}]::text[]`
      ),
      orderBy: [desc(documentWorkflows.priority)],
      with: { stages: { orderBy: [asc(workflowStages.stage_order)] } }
    });

    // Find first workflow that matches trigger conditions
    for (const workflow of workflows) {
      const config = workflow.config as any;
      if (this.evaluateTriggerConditions(config.trigger_conditions, document)) {
        return workflow;
      }
    }

    return null;
  }

  private static evaluateTriggerConditions(
    conditions: any,
    document: any
  ): boolean {
    if (!conditions) return true;

    // Check amount thresholds
    if (conditions.amount_min !== undefined) {
      const amount = document.extraction_result?.extracted_data?.gross_amount || 0;
      if (amount < conditions.amount_min) return false;
    }
    if (conditions.amount_max !== undefined) {
      const amount = document.extraction_result?.extracted_data?.gross_amount || 0;
      if (amount > conditions.amount_max) return false;
    }

    // Check tags
    if (conditions.tags?.length > 0) {
      const documentTags = document.tags || [];
      if (!conditions.tags.some((t: string) => documentTags.includes(t))) {
        return false;
      }
    }

    // Check custom conditions
    if (conditions.custom_conditions) {
      for (const condition of conditions.custom_conditions) {
        const value = this.getNestedValue(document, condition.field);
        if (!this.evaluateCondition(condition.operator, value, condition.value)) {
          return false;
        }
      }
    }

    return true;
  }

  private static async activateNextStage(
    instanceId: string,
    tx: any
  ) {
    // Get workflow instance with stages
    const instance = await tx.query.workflowInstances.findFirst({
      where: eq(workflowInstances.id, instanceId),
      with: {
        stage_instances: {
          with: { stage: true },
          orderBy: [asc(stageInstances.stage_id)]
        },
        workflow: { with: { stages: { orderBy: [asc(workflowStages.stage_order)] } } }
      }
    });

    // Find next pending stage
    const nextStageInstance = instance.stage_instances.find(
      (si: any) => si.status === 'pending'
    );

    if (!nextStageInstance) {
      // All stages completed - complete workflow
      await this.completeWorkflow(instance, tx);
      return;
    }

    const stage = nextStageInstance.stage;

    // Check entry conditions
    if (stage.entry_conditions) {
      const shouldEnter = this.evaluateStageConditions(
        stage.entry_conditions,
        instance
      );
      if (!shouldEnter) {
        // Check skip conditions
        if (stage.skip_conditions && this.evaluateStageConditions(stage.skip_conditions, instance)) {
          await tx
            .update(stageInstances)
            .set({ status: 'skipped', completed_at: new Date() })
            .where(eq(stageInstances.id, nextStageInstance.id));

          // Move to next stage
          return await this.activateNextStage(instanceId, tx);
        }
      }
    }

    // Activate stage
    const dueAt = new Date();
    dueAt.setHours(dueAt.getHours() + (stage.sla_hours || 24));

    await tx
      .update(stageInstances)
      .set({
        status: 'active',
        activated_at: new Date(),
        due_at: dueAt
      })
      .where(eq(stageInstances.id, nextStageInstance.id));

    // Update workflow instance current stage
    await tx
      .update(workflowInstances)
      .set({ current_stage_id: stage.id })
      .where(eq(workflowInstances.id, instanceId));

    // Execute on_enter_actions
    if (stage.on_enter_actions) {
      await this.executeActions(stage.on_enter_actions, instance, tx);
    }

    // Create approval tasks if approval stage
    if (stage.stage_type === 'approval' || stage.stage_type === 'review') {
      await this.createApprovalTasks(instance, nextStageInstance, stage, tx);
    }

    // Audit log
    await this.createAuditEntry(tx, {
      organization_id: instance.organization_id,
      workflow_instance_id: instanceId,
      stage_instance_id: nextStageInstance.id,
      event_type: 'stage_entered',
      event_data: {
        stage_name: stage.name,
        due_at: dueAt
      }
    });
  }

  private static async createApprovalTasks(
    instance: any,
    stageInstance: any,
    stage: any,
    tx: any
  ) {
    const assignees = await this.resolveAssignees(stage, instance, tx);

    const dueAt = new Date();
    dueAt.setHours(dueAt.getHours() + (stage.sla_hours || 24));

    for (const assigneeId of assignees) {
      const [task] = await tx
        .insert(approvalTasks)
        .values({
          organization_id: instance.organization_id,
          stage_instance_id: stageInstance.id,
          workflow_instance_id: instance.id,
          document_id: instance.document_id,
          assignee_id: assigneeId,
          due_at: dueAt
        })
        .returning();

      // Send notification
      await this.sendApprovalNotification(task, instance, stage, tx);
    }
  }

  private static async resolveAssignees(
    stage: any,
    instance: any,
    tx: any
  ): Promise<string[]> {
    switch (stage.assignee_type) {
      case 'user':
        return stage.assignee_ids || [];

      case 'role':
        const roleUsers = await tx.query.userRoles.findMany({
          where: and(
            eq(userRoles.organization_id, instance.organization_id),
            inArray(userRoles.role_name, stage.assignee_roles || [])
          )
        });
        return roleUsers.map((ur: any) => ur.user_id);

      case 'document_owner':
        const doc = await tx.query.documents.findFirst({
          where: eq(documents.id, instance.document_id)
        });
        return doc?.created_by ? [doc.created_by] : [];

      case 'manager':
        // Get manager of document owner or department
        const document = await tx.query.documents.findFirst({
          where: eq(documents.id, instance.document_id),
          with: { created_by_user: { with: { department: true } } }
        });
        if (document?.created_by_user?.department?.manager_id) {
          return [document.created_by_user.department.manager_id];
        }
        return [];

      case 'dynamic':
        const rule = stage.dynamic_assignee_rule;
        if (rule?.source === 'document_field') {
          const doc = await tx.query.documents.findFirst({
            where: eq(documents.id, instance.document_id),
            with: { extraction_result: true }
          });
          const value = this.getNestedValue(doc, rule.field);
          if (value) return [value];
        }
        return rule?.fallback_user_id ? [rule.fallback_user_id] : [];

      default:
        return [];
    }
  }

  // ============ Approval Processing ============

  static async processApprovalDecision(
    taskId: string,
    decision: 'approved' | 'rejected' | 'delegated',
    userId: string,
    comment?: string,
    delegatedToId?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    return await db.transaction(async (tx) => {
      // Get task with full context
      const task = await tx.query.approvalTasks.findFirst({
        where: and(
          eq(approvalTasks.id, taskId),
          eq(approvalTasks.assignee_id, userId),
          eq(approvalTasks.status, 'pending')
        ),
        with: {
          stage_instance: { with: { stage: true } },
          workflow_instance: {
            with: {
              workflow: true,
              document: true
            }
          }
        }
      });

      if (!task) {
        throw new Error('Zadanie zatwierdzenia nie zostało znalezione lub nie jest przypisane do Ciebie');
      }

      // Handle delegation
      if (decision === 'delegated') {
        if (!delegatedToId) {
          throw new Error('Wymagane jest wskazanie osoby, do której delegujemy');
        }

        await tx
          .update(approvalTasks)
          .set({
            status: 'delegated',
            delegated_to_id: delegatedToId,
            delegation_reason: comment,
            updated_at: new Date()
          })
          .where(eq(approvalTasks.id, taskId));

        // Create new task for delegated user
        const [newTask] = await tx
          .insert(approvalTasks)
          .values({
            organization_id: task.organization_id,
            stage_instance_id: task.stage_instance_id,
            workflow_instance_id: task.workflow_instance_id,
            document_id: task.document_id,
            assignee_id: delegatedToId,
            due_at: task.due_at
          })
          .returning();

        // Audit and notify
        await this.createAuditEntry(tx, {
          organization_id: task.organization_id,
          workflow_instance_id: task.workflow_instance_id,
          stage_instance_id: task.stage_instance_id,
          approval_task_id: taskId,
          event_type: 'delegated',
          event_data: {
            from_user_id: userId,
            to_user_id: delegatedToId,
            reason: comment
          },
          actor_id: userId,
          actor_ip_address: ipAddress,
          actor_user_agent: userAgent
        });

        return { success: true, delegated_to: delegatedToId };
      }

      // Process approval/rejection
      await tx
        .update(approvalTasks)
        .set({
          status: 'completed',
          decision,
          decision_at: new Date(),
          decision_comment: comment,
          decision_ip_address: ipAddress,
          decision_user_agent: userAgent,
          updated_at: new Date()
        })
        .where(eq(approvalTasks.id, taskId));

      // Audit log
      await this.createAuditEntry(tx, {
        organization_id: task.organization_id,
        workflow_instance_id: task.workflow_instance_id,
        stage_instance_id: task.stage_instance_id,
        approval_task_id: taskId,
        event_type: 'approval_completed',
        event_data: {
          decision,
          comment,
          document_id: task.document_id
        },
        actor_id: userId,
        actor_ip_address: ipAddress,
        actor_user_agent: userAgent
      });

      // Check if stage is complete
      await this.checkStageCompletion(task.stage_instance, tx);

      return { success: true, decision };
    });
  }

  private static async checkStageCompletion(
    stageInstance: any,
    tx: any
  ) {
    const stage = stageInstance.stage;

    // Get all tasks for this stage
    const tasks = await tx.query.approvalTasks.findMany({
      where: eq(approvalTasks.stage_instance_id, stageInstance.id)
    });

    const completedTasks = tasks.filter((t: any) => t.status === 'completed');
    const approvedTasks = completedTasks.filter((t: any) => t.decision === 'approved');
    const rejectedTasks = completedTasks.filter((t: any) => t.decision === 'rejected');

    let stageOutcome: 'approved' | 'rejected' | null = null;

    switch (stage.approval_mode) {
      case 'any':
        if (approvedTasks.length > 0) stageOutcome = 'approved';
        else if (completedTasks.length === tasks.length) stageOutcome = 'rejected';
        break;

      case 'all':
        if (rejectedTasks.length > 0) stageOutcome = 'rejected';
        else if (approvedTasks.length === tasks.length) stageOutcome = 'approved';
        break;

      case 'majority':
        if (completedTasks.length === tasks.length) {
          stageOutcome = approvedTasks.length > rejectedTasks.length ? 'approved' : 'rejected';
        }
        break;

      case 'threshold':
        const threshold = stage.approval_threshold || 0.5;
        if (completedTasks.length === tasks.length) {
          stageOutcome = (approvedTasks.length / tasks.length) >= threshold ? 'approved' : 'rejected';
        }
        break;
    }

    if (stageOutcome) {
      await this.completeStage(stageInstance, stageOutcome, tx);
    }
  }

  private static async completeStage(
    stageInstance: any,
    outcome: 'approved' | 'rejected',
    tx: any
  ) {
    const stage = stageInstance.stage;

    await tx
      .update(stageInstances)
      .set({
        status: 'completed',
        outcome,
        completed_at: new Date()
      })
      .where(eq(stageInstances.id, stageInstance.id));

    // Execute completion actions
    if (outcome === 'approved' && stage.on_complete_actions) {
      const instance = await tx.query.workflowInstances.findFirst({
        where: eq(workflowInstances.id, stageInstance.workflow_instance_id)
      });
      await this.executeActions(stage.on_complete_actions, instance, tx);
    }

    if (outcome === 'rejected' && stage.on_reject_actions) {
      const instance = await tx.query.workflowInstances.findFirst({
        where: eq(workflowInstances.id, stageInstance.workflow_instance_id)
      });
      await this.executeActions(stage.on_reject_actions, instance, tx);

      // Reject entire workflow
      await this.rejectWorkflow(stageInstance.workflow_instance_id, tx);
      return;
    }

    // Audit log
    await this.createAuditEntry(tx, {
      organization_id: stageInstance.organization_id,
      workflow_instance_id: stageInstance.workflow_instance_id,
      stage_instance_id: stageInstance.id,
      event_type: 'stage_completed',
      event_data: { outcome, stage_name: stage.name }
    });

    // Move to next stage
    await this.activateNextStage(stageInstance.workflow_instance_id, tx);
  }

  private static async completeWorkflow(instance: any, tx: any) {
    const workflow = instance.workflow;

    await tx
      .update(workflowInstances)
      .set({
        status: 'completed',
        final_outcome: 'approved',
        completed_at: new Date(),
        progress_percentage: 100
      })
      .where(eq(workflowInstances.id, instance.id));

    // Create accounting entry if configured
    if (workflow.creates_accounting_entry && workflow.entry_template_id) {
      const entryId = await this.createAccountingEntry(instance, workflow, tx);
      await tx
        .update(workflowInstances)
        .set({ accounting_entry_id: entryId })
        .where(eq(workflowInstances.id, instance.id));
    }

    // Update document status
    await tx
      .update(documents)
      .set({
        status: 'PROCESSED',
        processed_at: new Date()
      })
      .where(eq(documents.id, instance.document_id));

    // Audit log
    await this.createAuditEntry(tx, {
      organization_id: instance.organization_id,
      workflow_instance_id: instance.id,
      event_type: 'workflow_completed',
      event_data: { outcome: 'approved', workflow_name: workflow.name }
    });

    // Send completion notification
    await this.sendCompletionNotification(instance, 'approved', tx);
  }

  private static async rejectWorkflow(instanceId: string, tx: any) {
    const instance = await tx.query.workflowInstances.findFirst({
      where: eq(workflowInstances.id, instanceId),
      with: { workflow: true }
    });

    await tx
      .update(workflowInstances)
      .set({
        status: 'completed',
        final_outcome: 'rejected',
        completed_at: new Date()
      })
      .where(eq(workflowInstances.id, instanceId));

    // Update document status
    await tx
      .update(documents)
      .set({ status: 'REJECTED' })
      .where(eq(documents.id, instance.document_id));

    // Cancel pending tasks
    await tx
      .update(approvalTasks)
      .set({ status: 'expired' })
      .where(and(
        eq(approvalTasks.workflow_instance_id, instanceId),
        eq(approvalTasks.status, 'pending')
      ));

    // Audit log
    await this.createAuditEntry(tx, {
      organization_id: instance.organization_id,
      workflow_instance_id: instanceId,
      event_type: 'workflow_completed',
      event_data: { outcome: 'rejected', workflow_name: instance.workflow.name }
    });

    // Send rejection notification
    await this.sendCompletionNotification(instance, 'rejected', tx);
  }

  // ============ Accounting Entry Creation ============

  private static async createAccountingEntry(
    instance: any,
    workflow: any,
    tx: any
  ): Promise<string> {
    const template = await tx.query.accountingEntryTemplates.findFirst({
      where: eq(accountingEntryTemplates.id, workflow.entry_template_id)
    });

    if (!template) {
      throw new Error('Nie znaleziono szablonu wpisu księgowego');
    }

    const document = await tx.query.documents.findFirst({
      where: eq(documents.id, instance.document_id),
      with: { extraction_result: true }
    });

    const extractedData = document.extraction_result?.extracted_data || {};
    const mapping = template.entry_mapping;

    // Resolve accounts
    const debitAccountId = await this.resolveAccount(
      mapping.debit_account_selector,
      document,
      tx
    );
    const creditAccountId = await this.resolveAccount(
      mapping.credit_account_selector,
      document,
      tx
    );

    // Get amount
    const amount = this.getNestedValue(extractedData, mapping.amount_field) || 0;

    // Get date
    const entryDate = this.getNestedValue(extractedData, mapping.date_field) || new Date();

    // Generate description
    const description = this.interpolateTemplate(
      mapping.description_template,
      extractedData
    );

    // Create journal entry
    const [entry] = await tx
      .insert(journalEntries)
      .values({
        organization_id: instance.organization_id,
        entry_date: entryDate,
        description,
        source_document_id: document.id,
        status: mapping.auto_book ? 'posted' : 'draft',
        created_by: instance.initiator_id
      })
      .returning();

    // Create line items
    const lineItems = [];

    // Handle VAT splitting for Polish invoices
    if (mapping.vat_handling === 'split' && extractedData.vat_amount) {
      const netAmount = extractedData.net_amount || (amount - extractedData.vat_amount);
      const vatAmount = extractedData.vat_amount;

      // Net amount
      lineItems.push({
        entry_id: entry.id,
        account_id: debitAccountId,
        debit_amount: netAmount,
        credit_amount: 0,
        description: `${description} (netto)`
      });

      // VAT
      const vatAccountId = await this.getVATAccount(instance.organization_id, tx);
      lineItems.push({
        entry_id: entry.id,
        account_id: vatAccountId,
        debit_amount: vatAmount,
        credit_amount: 0,
        description: `VAT - ${description}`
      });

      // Credit (gross)
      lineItems.push({
        entry_id: entry.id,
        account_id: creditAccountId,
        debit_amount: 0,
        credit_amount: amount,
        description
      });
    } else {
      // Simple debit/credit
      lineItems.push({
        entry_id: entry.id,
        account_id: debitAccountId,
        debit_amount: amount,
        credit_amount: 0,
        description
      });

      lineItems.push({
        entry_id: entry.id,
        account_id: creditAccountId,
        debit_amount: 0,
        credit_amount: amount,
        description
      });
    }

    await tx.insert(journalEntryLines).values(lineItems);

    // Audit log
    await this.createAuditEntry(tx, {
      organization_id: instance.organization_id,
      workflow_instance_id: instance.id,
      event_type: 'entry_created',
      event_data: {
        entry_id: entry.id,
        amount,
        debit_account_id: debitAccountId,
        credit_account_id: creditAccountId
      }
    });

    return entry.id;
  }

  // ============ Notifications ============

  private static async sendApprovalNotification(
    task: any,
    instance: any,
    stage: any,
    tx: any
  ) {
    const workflow = instance.workflow;
    const document = instance.document;
    const config = workflow.config?.notifications || {};

    const channels = config.channels || { email: true, in_app: true };

    const subject = config.templates?.approval_request?.subject ||
      `[Wymagana akcja] ${workflow.name} - ${document.name}`;

    const body = config.templates?.approval_request?.body_template ||
      `Dokument "${document.name}" oczekuje na Twoją decyzję w etapie "${stage.name}".`;

    if (channels.email) {
      await tx.insert(workflowNotifications).values({
        organization_id: instance.organization_id,
        workflow_instance_id: instance.id,
        stage_instance_id: task.stage_instance_id,
        approval_task_id: task.id,
        recipient_id: task.assignee_id,
        notification_type: 'approval_request',
        channel: 'email',
        subject,
        body,
        action_url: `/documents/${document.id}/workflow`
      });
    }

    if (channels.in_app) {
      await tx.insert(workflowNotifications).values({
        organization_id: instance.organization_id,
        workflow_instance_id: instance.id,
        stage_instance_id: task.stage_instance_id,
        approval_task_id: task.id,
        recipient_id: task.assignee_id,
        notification_type: 'approval_request',
        channel: 'in_app',
        subject,
        body,
        action_url: `/documents/${document.id}/workflow`
      });
    }
  }

  private static async sendCompletionNotification(
    instance: any,
    outcome: 'approved' | 'rejected',
    tx: any
  ) {
    const workflow = instance.workflow;
    const config = workflow.config?.notifications || {};

    const template = outcome === 'approved'
      ? config.templates?.completed
      : config.templates?.rejected;

    const subject = template?.subject ||
      (outcome === 'approved'
        ? `[Zatwierdzono] ${workflow.name}`
        : `[Odrzucono] ${workflow.name}`);

    await tx.insert(workflowNotifications).values({
      organization_id: instance.organization_id,
      workflow_instance_id: instance.id,
      recipient_id: instance.initiator_id,
      notification_type: outcome === 'approved' ? 'completed' : 'rejected',
      channel: 'email',
      subject,
      body: template?.body_template || `Workflow "${workflow.name}" został zakończony z wynikiem: ${outcome}.`,
      action_url: `/documents/${instance.document_id}`
    });
  }

  // ============ Escalation Processing ============

  static async processEscalations() {
    const overdueTasks = await db.query.approvalTasks.findMany({
      where: and(
        eq(approvalTasks.status, 'pending'),
        lt(approvalTasks.due_at, new Date())
      ),
      with: {
        stage_instance: { with: { stage: true } },
        workflow_instance: true
      }
    });

    for (const task of overdueTasks) {
      const stage = task.stage_instance.stage;

      if (!stage.escalation_enabled) continue;

      await db.transaction(async (tx) => {
        // Mark task as escalated
        await tx
          .update(approvalTasks)
          .set({
            status: 'escalated',
            escalated_at: new Date()
          })
          .where(eq(approvalTasks.id, task.id));

        // Update stage instance
        await tx
          .update(stageInstances)
          .set({
            status: 'escalated',
            escalation_count: sql`escalation_count + 1`,
            last_escalated_at: new Date()
          })
          .where(eq(stageInstances.id, task.stage_instance_id));

        // Create escalation task
        const escalationTarget = await this.resolveEscalationTarget(stage, task, tx);

        if (escalationTarget) {
          const newDueAt = new Date();
          newDueAt.setHours(newDueAt.getHours() + (stage.sla_hours || 24));

          await tx.insert(approvalTasks).values({
            organization_id: task.organization_id,
            stage_instance_id: task.stage_instance_id,
            workflow_instance_id: task.workflow_instance_id,
            document_id: task.document_id,
            assignee_id: escalationTarget,
            due_at: newDueAt
          });

          // Send escalation notifications
          await this.sendEscalationNotifications(task, escalationTarget, tx);
        }

        // Audit log
        await this.createAuditEntry(tx, {
          organization_id: task.organization_id,
          workflow_instance_id: task.workflow_instance_id,
          stage_instance_id: task.stage_instance_id,
          approval_task_id: task.id,
          event_type: 'escalated',
          event_data: {
            original_assignee: task.assignee_id,
            escalated_to: escalationTarget
          }
        });
      });
    }
  }

  // ============ User Queries ============

  static async getPendingApprovals(
    userId: string,
    organizationId: string,
    query: z.infer<typeof listPendingApprovalsSchema>
  ) {
    const conditions = [
      eq(approvalTasks.organization_id, organizationId),
      eq(approvalTasks.assignee_id, query.assignee_id || userId)
    ];

    if (query.status === 'pending') {
      conditions.push(eq(approvalTasks.status, 'pending'));
    } else if (query.status === 'overdue') {
      conditions.push(
        eq(approvalTasks.status, 'pending'),
        lt(approvalTasks.due_at, new Date())
      );
    }

    const offset = (query.page - 1) * query.limit;

    const [tasks, countResult] = await Promise.all([
      db.query.approvalTasks.findMany({
        where: and(...conditions),
        orderBy: [asc(approvalTasks.due_at)],
        limit: query.limit,
        offset,
        with: {
          workflow_instance: {
            with: {
              workflow: true,
              document: {
                with: {
                  extraction_result: true
                }
              }
            }
          },
          stage_instance: { with: { stage: true } }
        }
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(approvalTasks)
        .where(and(...conditions))
    ]);

    return {
      tasks: tasks.map(task => ({
        id: task.id,
        document: {
          id: task.workflow_instance.document.id,
          name: task.workflow_instance.document.name,
          type: task.workflow_instance.document.document_type,
          extracted_data: task.workflow_instance.document.extraction_result?.extracted_data
        },
        workflow: {
          id: task.workflow_instance.workflow.id,
          name: task.workflow_instance.workflow.name
        },
        stage: {
          name: task.stage_instance.stage.name,
          type: task.stage_instance.stage.stage_type
        },
        due_at: task.due_at,
        is_overdue: new Date(task.due_at) < new Date(),
        assigned_at: task.assigned_at
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: Number(countResult[0].count),
        pages: Math.ceil(Number(countResult[0].count) / query.limit)
      }
    };
  }

  static async getWorkflowHistory(
    organizationId: string,
    query: z.infer<typeof workflowHistoryQuerySchema>
  ) {
    const conditions = [eq(workflowAuditLog.organization_id, organizationId)];

    if (query.workflow_instance_id) {
      conditions.push(eq(workflowAuditLog.workflow_instance_id, query.workflow_instance_id));
    }
    if (query.event_types?.length) {
      conditions.push(inArray(workflowAuditLog.event_type, query.event_types));
    }
    if (query.from_date) {
      conditions.push(gte(workflowAuditLog.created_at, query.from_date));
    }
    if (query.to_date) {
      conditions.push(lte(workflowAuditLog.created_at, query.to_date));
    }

    const offset = (query.page - 1) * query.limit;

    const entries = await db.query.workflowAuditLog.findMany({
      where: and(...conditions),
      orderBy: [desc(workflowAuditLog.created_at)],
      limit: query.limit,
      offset,
      with: {
        actor: {
          columns: { id: true, email: true, full_name: true }
        }
      }
    });

    return entries;
  }

  // ============ Template Management ============

  static async getWorkflowTemplates(category?: string) {
    const conditions = [];
    if (category) {
      conditions.push(eq(workflowTemplates.category, category));
    }

    const templates = await db.query.workflowTemplates.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(workflowTemplates.usage_count)]
    });

    return templates;
  }

  static async createWorkflowFromTemplate(
    templateId: string,
    organizationId: string,
    userId: string,
    customizations?: Partial<CreateWorkflowInput>
  ) {
    const template = await db.query.workflowTemplates.findFirst({
      where: eq(workflowTemplates.id, templateId)
    });

    if (!template) {
      throw new Error('Szablon workflow nie został znaleziony');
    }

    const config = template.template_config as any;
    const input = {
      ...config,
      ...customizations,
      name: customizations?.name || template.name
    };

    const workflow = await this.createWorkflow(input, organizationId, userId);

    // Update template usage count
    await db
      .update(workflowTemplates)
      .set({ usage_count: sql`usage_count + 1` })
      .where(eq(workflowTemplates.id, templateId));

    return workflow;
  }

  // ============ Utility Methods ============

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private static evaluateCondition(
    operator: string,
    fieldValue: any,
    conditionValue: any
  ): boolean {
    switch (operator) {
      case 'equals': return fieldValue === conditionValue;
      case 'contains': return String(fieldValue).includes(String(conditionValue));
      case 'greaterThan': return Number(fieldValue) > Number(conditionValue);
      case 'lessThan': return Number(fieldValue) < Number(conditionValue);
      case 'between':
        return Number(fieldValue) >= conditionValue.min &&
               Number(fieldValue) <= conditionValue.max;
      case 'in': return conditionValue.includes(fieldValue);
      case 'notIn': return !conditionValue.includes(fieldValue);
      default: return false;
    }
  }

  private static evaluateStageConditions(conditions: any[], instance: any): boolean {
    for (const condition of conditions) {
      const value = this.getNestedValue(instance, condition.field);
      if (!this.evaluateCondition(condition.operator, value, condition.value)) {
        return false;
      }
    }
    return true;
  }

  private static interpolateTemplate(template: string, data: any): string {
    return template.replace(/\{(\w+(?:\.\w+)*)\}/g, (match, path) => {
      const value = this.getNestedValue(data, path);
      return value !== undefined ? String(value) : match;
    });
  }

  private static async resolveAccount(
    selector: any,
    document: any,
    tx: any
  ): Promise<string> {
    switch (selector.type) {
      case 'fixed':
        return selector.account_id;
      case 'from_document':
        const value = this.getNestedValue(document, selector.field);
        return selector.mapping?.[value] || selector.default_account_id;
      case 'from_category':
        // Get account from category mapping
        return selector.default_account_id;
      default:
        throw new Error('Nieznany typ selektora konta');
    }
  }

  private static async getVATAccount(
    organizationId: string,
    tx: any
  ): Promise<string> {
    const vatAccount = await tx.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.organization_id, organizationId),
        eq(chartOfAccounts.account_code, '221') // Standard Polish VAT account
      )
    });

    if (!vatAccount) {
      throw new Error('Nie znaleziono konta VAT (221)');
    }

    return vatAccount.id;
  }

  private static extractEscalationTargetId(target: any): string | undefined {
    if (!target) return undefined;
    if (target.type === 'user' && target.user_ids?.length) {
      return target.user_ids[0];
    }
    return undefined;
  }

  private static async resolveEscalationTarget(
    stage: any,
    task: any,
    tx: any
  ): Promise<string | null> {
    if (!stage.escalation_target_type) return null;

    switch (stage.escalation_target_type) {
      case 'user':
        return stage.escalation_target_id || null;
      case 'role':
        const roleUsers = await tx.query.userRoles.findMany({
          where: eq(userRoles.role_name, stage.escalation_target_id)
        });
        return roleUsers[0]?.user_id || null;
      case 'manager':
        const user = await tx.query.users.findFirst({
          where: eq(users.id, task.assignee_id),
          with: { department: true }
        });
        return user?.department?.manager_id || null;
      default:
        return null;
    }
  }

  private static async sendEscalationNotifications(
    task: any,
    escalatedToId: string,
    tx: any
  ) {
    // Notify original assignee
    await tx.insert(workflowNotifications).values({
      organization_id: task.organization_id,
      workflow_instance_id: task.workflow_instance_id,
      stage_instance_id: task.stage_instance_id,
      approval_task_id: task.id,
      recipient_id: task.assignee_id,
      notification_type: 'escalation',
      channel: 'email',
      subject: '[Eskalacja] Przekroczono termin zatwierdzenia',
      body: 'Twoje zadanie zatwierdzenia zostało eskalowane z powodu przekroczenia terminu.'
    });

    // Notify escalation target
    await tx.insert(workflowNotifications).values({
      organization_id: task.organization_id,
      workflow_instance_id: task.workflow_instance_id,
      stage_instance_id: task.stage_instance_id,
      approval_task_id: task.id,
      recipient_id: escalatedToId,
      notification_type: 'escalation',
      channel: 'email',
      subject: '[Eskalacja] Wymagana pilna akcja',
      body: 'Zadanie zatwierdzenia zostało eskalowane do Ciebie. Wymagana pilna akcja.',
      action_url: `/documents/${task.document_id}/workflow`
    });
  }

  private static async executeActions(
    actions: any[],
    instance: any,
    tx: any
  ) {
    for (const action of actions) {
      switch (action.type) {
        case 'send_notification':
          // Handle notification action
          break;
        case 'update_document_status':
          await tx
            .update(documents)
            .set({ status: action.config.status })
            .where(eq(documents.id, instance.document_id));
          break;
        case 'assign_tag':
          await tx.insert(documentTagAssignments).values({
            document_id: instance.document_id,
            tag_id: action.config.tag_id,
            assigned_by: instance.initiator_id
          });
          break;
        case 'trigger_webhook':
          // Queue webhook call
          break;
        case 'execute_custom_action':
          // Handle custom actions
          break;
      }
    }
  }

  private static async createAuditEntry(
    tx: any,
    data: Omit<WorkflowAuditEntry, 'id' | 'event_hash' | 'previous_hash' | 'created_at'>
  ) {
    // Get previous hash for chain
    const lastEntry = await tx.query.workflowAuditLog.findFirst({
      where: eq(workflowAuditLog.organization_id, data.organization_id),
      orderBy: [desc(workflowAuditLog.created_at)]
    });

    const previousHash = lastEntry?.event_hash || null;

    // Calculate event hash
    const hashData = JSON.stringify({
      ...data,
      previous_hash: previousHash,
      timestamp: new Date().toISOString()
    });
    const eventHash = createHash('sha256').update(hashData).digest('hex');

    await tx.insert(workflowAuditLog).values({
      ...data,
      event_hash: eventHash,
      previous_hash: previousHash
    });
  }
}
```

### tRPC Router

```typescript
// src/modules/doc/routers/workflow.router.ts

import { router, protectedProcedure } from '@/lib/trpc';
import { z } from 'zod';
import { WorkflowService } from '../services/workflow.service';
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  approvalDecisionSchema,
  bulkApprovalSchema,
  startWorkflowSchema,
  cancelWorkflowSchema,
  workflowTemplateSchema,
  accountingEntryTemplateSchema,
  listWorkflowsQuerySchema,
  listPendingApprovalsSchema,
  workflowHistoryQuerySchema
} from '../schemas/workflow.schemas';

export const workflowRouter = router({
  // ============ Workflow Definition ============

  create: protectedProcedure
    .input(createWorkflowSchema)
    .mutation(async ({ input, ctx }) => {
      return await WorkflowService.createWorkflow(
        input,
        ctx.organizationId,
        ctx.userId
      );
    }),

  update: protectedProcedure
    .input(updateWorkflowSchema)
    .mutation(async ({ input, ctx }) => {
      return await WorkflowService.updateWorkflow(
        input,
        ctx.organizationId
      );
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return await WorkflowService.getWorkflowById(
        input.id,
        ctx.organizationId
      );
    }),

  list: protectedProcedure
    .input(listWorkflowsQuerySchema)
    .query(async ({ input, ctx }) => {
      return await WorkflowService.listWorkflows(
        ctx.organizationId,
        input
      );
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return await WorkflowService.deleteWorkflow(
        input.id,
        ctx.organizationId
      );
    }),

  // ============ Workflow Instance ============

  start: protectedProcedure
    .input(startWorkflowSchema)
    .mutation(async ({ input, ctx }) => {
      return await WorkflowService.startWorkflow(
        input.document_id,
        input.workflow_id || null,
        ctx.organizationId,
        ctx.userId,
        input.context_data
      );
    }),

  cancel: protectedProcedure
    .input(cancelWorkflowSchema)
    .mutation(async ({ input, ctx }) => {
      return await WorkflowService.cancelWorkflow(
        input.workflow_instance_id,
        input.reason,
        ctx.organizationId,
        ctx.userId
      );
    }),

  getInstanceStatus: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return await WorkflowService.getInstanceStatus(
        input.id,
        ctx.organizationId
      );
    }),

  getDocumentWorkflow: protectedProcedure
    .input(z.object({ document_id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return await WorkflowService.getDocumentWorkflow(
        input.document_id,
        ctx.organizationId
      );
    }),

  // ============ Approval Actions ============

  decide: protectedProcedure
    .input(approvalDecisionSchema)
    .mutation(async ({ input, ctx }) => {
      return await WorkflowService.processApprovalDecision(
        input.task_id,
        input.decision,
        ctx.userId,
        input.comment,
        input.delegated_to_id,
        ctx.ipAddress,
        ctx.userAgent
      );
    }),

  bulkDecide: protectedProcedure
    .input(bulkApprovalSchema)
    .mutation(async ({ input, ctx }) => {
      const results = [];
      for (const taskId of input.task_ids) {
        try {
          const result = await WorkflowService.processApprovalDecision(
            taskId,
            input.decision,
            ctx.userId,
            input.comment,
            undefined,
            ctx.ipAddress,
            ctx.userAgent
          );
          results.push({ task_id: taskId, success: true, result });
        } catch (error) {
          results.push({ task_id: taskId, success: false, error: error.message });
        }
      }
      return results;
    }),

  getPendingApprovals: protectedProcedure
    .input(listPendingApprovalsSchema)
    .query(async ({ input, ctx }) => {
      return await WorkflowService.getPendingApprovals(
        ctx.userId,
        ctx.organizationId,
        input
      );
    }),

  getApprovalStats: protectedProcedure
    .query(async ({ ctx }) => {
      return await WorkflowService.getApprovalStats(
        ctx.userId,
        ctx.organizationId
      );
    }),

  // ============ History & Audit ============

  getHistory: protectedProcedure
    .input(workflowHistoryQuerySchema)
    .query(async ({ input, ctx }) => {
      return await WorkflowService.getWorkflowHistory(
        ctx.organizationId,
        input
      );
    }),

  getAuditTrail: protectedProcedure
    .input(z.object({
      workflow_instance_id: z.string().uuid()
    }))
    .query(async ({ input, ctx }) => {
      return await WorkflowService.getWorkflowHistory(
        ctx.organizationId,
        { workflow_instance_id: input.workflow_instance_id }
      );
    }),

  // ============ Templates ============

  getTemplates: protectedProcedure
    .input(z.object({
      category: z.string().optional()
    }))
    .query(async ({ input }) => {
      return await WorkflowService.getWorkflowTemplates(input.category);
    }),

  createFromTemplate: protectedProcedure
    .input(z.object({
      template_id: z.string().uuid(),
      customizations: createWorkflowSchema.partial().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      return await WorkflowService.createWorkflowFromTemplate(
        input.template_id,
        ctx.organizationId,
        ctx.userId,
        input.customizations
      );
    }),

  saveAsTemplate: protectedProcedure
    .input(z.object({
      workflow_id: z.string().uuid(),
      template_data: workflowTemplateSchema
    }))
    .mutation(async ({ input, ctx }) => {
      return await WorkflowService.saveWorkflowAsTemplate(
        input.workflow_id,
        input.template_data,
        ctx.organizationId
      );
    }),

  // ============ Accounting Entry Templates ============

  createEntryTemplate: protectedProcedure
    .input(accountingEntryTemplateSchema)
    .mutation(async ({ input, ctx }) => {
      return await WorkflowService.createEntryTemplate(
        input,
        ctx.organizationId,
        ctx.userId
      );
    }),

  listEntryTemplates: protectedProcedure
    .input(z.object({
      document_type: z.string().optional()
    }))
    .query(async ({ input, ctx }) => {
      return await WorkflowService.listEntryTemplates(
        ctx.organizationId,
        input.document_type
      );
    })
});
```

---

## Test Specifications

### Unit Tests

```typescript
// src/modules/doc/services/__tests__/workflow.service.test.ts

describe('WorkflowService', () => {
  describe('createWorkflow', () => {
    it('should create workflow with stages in correct order', async () => {
      const input = {
        name: 'Test Workflow',
        workflow_type: 'approval',
        document_types: ['INVOICE'],
        trigger_conditions: { amount_min: 1000 },
        stages: [
          { name: 'Stage 1', stage_type: 'approval', assignee: { type: 'role', roles: ['accountant'] }, sla_hours: 24 },
          { name: 'Stage 2', stage_type: 'approval', assignee: { type: 'role', roles: ['manager'] }, sla_hours: 48 }
        ],
        notifications: { channels: { email: true, in_app: true } }
      };

      const result = await WorkflowService.createWorkflow(input, mockOrgId, mockUserId);

      expect(result).toBeDefined();
      expect(result.stages).toHaveLength(2);
      expect(result.stages[0].stage_order).toBe(1);
      expect(result.stages[1].stage_order).toBe(2);
    });

    it('should reject workflow with no stages', async () => {
      const input = {
        name: 'Empty Workflow',
        workflow_type: 'approval',
        document_types: ['INVOICE'],
        stages: [],
        notifications: {}
      };

      await expect(WorkflowService.createWorkflow(input, mockOrgId, mockUserId))
        .rejects.toThrow();
    });
  });

  describe('startWorkflow', () => {
    it('should auto-select workflow based on trigger conditions', async () => {
      // Create workflow with amount threshold
      await createTestWorkflow({ trigger_conditions: { amount_min: 10000 } });

      // Create document with amount above threshold
      const document = await createTestDocument({
        extraction_result: { extracted_data: { gross_amount: 15000 } }
      });

      const instance = await WorkflowService.startWorkflow(
        document.id,
        null, // No workflow specified - auto-select
        mockOrgId,
        mockUserId
      );

      expect(instance).toBeDefined();
      expect(instance.status).toBe('active');
    });

    it('should activate first stage and create approval tasks', async () => {
      const workflow = await createTestWorkflow({
        stages: [
          { name: 'Approval', stage_type: 'approval', assignee: { type: 'user', user_ids: [mockUserId] } }
        ]
      });

      const instance = await WorkflowService.startWorkflow(
        mockDocumentId,
        workflow.id,
        mockOrgId,
        mockUserId
      );

      const tasks = await db.query.approvalTasks.findMany({
        where: eq(approvalTasks.workflow_instance_id, instance.id)
      });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].status).toBe('pending');
      expect(tasks[0].assignee_id).toBe(mockUserId);
    });
  });

  describe('processApprovalDecision', () => {
    it('should complete stage when all approvers approve (all mode)', async () => {
      const instance = await createTestInstance({
        approval_mode: 'all',
        assignees: [mockUserId, mockUser2Id]
      });

      // First approval
      await WorkflowService.processApprovalDecision(
        instance.tasks[0].id,
        'approved',
        mockUserId
      );

      // Stage still active (waiting for second approval)
      const stageAfterFirst = await getStageInstance(instance.id);
      expect(stageAfterFirst.status).toBe('active');

      // Second approval
      await WorkflowService.processApprovalDecision(
        instance.tasks[1].id,
        'approved',
        mockUser2Id
      );

      // Stage now completed
      const stageAfterSecond = await getStageInstance(instance.id);
      expect(stageAfterSecond.status).toBe('completed');
      expect(stageAfterSecond.outcome).toBe('approved');
    });

    it('should complete stage when any approver approves (any mode)', async () => {
      const instance = await createTestInstance({
        approval_mode: 'any',
        assignees: [mockUserId, mockUser2Id]
      });

      await WorkflowService.processApprovalDecision(
        instance.tasks[0].id,
        'approved',
        mockUserId
      );

      const stage = await getStageInstance(instance.id);
      expect(stage.status).toBe('completed');
      expect(stage.outcome).toBe('approved');
    });

    it('should handle delegation correctly', async () => {
      const instance = await createTestInstance({ assignees: [mockUserId] });

      await WorkflowService.processApprovalDecision(
        instance.tasks[0].id,
        'delegated',
        mockUserId,
        'Delegating to manager',
        mockUser2Id
      );

      // Original task marked as delegated
      const originalTask = await db.query.approvalTasks.findFirst({
        where: eq(approvalTasks.id, instance.tasks[0].id)
      });
      expect(originalTask.status).toBe('delegated');
      expect(originalTask.delegated_to_id).toBe(mockUser2Id);

      // New task created for delegatee
      const newTask = await db.query.approvalTasks.findFirst({
        where: and(
          eq(approvalTasks.workflow_instance_id, instance.id),
          eq(approvalTasks.assignee_id, mockUser2Id)
        )
      });
      expect(newTask).toBeDefined();
      expect(newTask.status).toBe('pending');
    });
  });

  describe('evaluateTriggerConditions', () => {
    it('should match document by amount threshold', () => {
      const conditions = { amount_min: 5000, amount_max: 50000 };
      const document = { extraction_result: { extracted_data: { gross_amount: 10000 } } };

      const result = WorkflowService['evaluateTriggerConditions'](conditions, document);
      expect(result).toBe(true);
    });

    it('should reject document below minimum amount', () => {
      const conditions = { amount_min: 5000 };
      const document = { extraction_result: { extracted_data: { gross_amount: 1000 } } };

      const result = WorkflowService['evaluateTriggerConditions'](conditions, document);
      expect(result).toBe(false);
    });

    it('should match custom conditions', () => {
      const conditions = {
        custom_conditions: [
          { field: 'extraction_result.extracted_data.invoice_type', operator: 'equals', value: 'purchase' }
        ]
      };
      const document = { extraction_result: { extracted_data: { invoice_type: 'purchase' } } };

      const result = WorkflowService['evaluateTriggerConditions'](conditions, document);
      expect(result).toBe(true);
    });
  });

  describe('createAccountingEntry', () => {
    it('should create entry with VAT split for Polish invoices', async () => {
      const instance = await createTestInstance({
        creates_accounting_entry: true,
        entry_template: {
          entry_mapping: {
            debit_account_selector: { type: 'fixed', account_id: mockDebitAccountId },
            credit_account_selector: { type: 'fixed', account_id: mockCreditAccountId },
            vat_handling: 'split',
            description_template: 'Faktura {document_number}'
          }
        }
      });

      // Complete workflow
      await completeAllStages(instance.id);

      // Check created entry
      const updatedInstance = await db.query.workflowInstances.findFirst({
        where: eq(workflowInstances.id, instance.id)
      });

      expect(updatedInstance.accounting_entry_id).toBeDefined();

      const entryLines = await db.query.journalEntryLines.findMany({
        where: eq(journalEntryLines.entry_id, updatedInstance.accounting_entry_id)
      });

      // Should have 3 lines: net debit, VAT debit, gross credit
      expect(entryLines).toHaveLength(3);
    });
  });

  describe('processEscalations', () => {
    it('should escalate overdue tasks', async () => {
      // Create instance with past due date
      const instance = await createTestInstance({
        due_at: new Date(Date.now() - 86400000) // 1 day ago
      });

      await WorkflowService.processEscalations();

      const task = await db.query.approvalTasks.findFirst({
        where: eq(approvalTasks.workflow_instance_id, instance.id)
      });

      expect(task.status).toBe('escalated');

      // Check new task created for escalation target
      const newTasks = await db.query.approvalTasks.findMany({
        where: eq(approvalTasks.workflow_instance_id, instance.id)
      });
      expect(newTasks.length).toBeGreaterThan(1);
    });
  });
});
```

### Integration Tests

```typescript
// src/modules/doc/services/__tests__/workflow.integration.test.ts

describe('Workflow Integration', () => {
  describe('Full Approval Workflow', () => {
    it('should complete multi-stage approval workflow for Polish invoice', async () => {
      // 1. Create workflow from Polish template
      const workflow = await WorkflowService.createWorkflowFromTemplate(
        polishInvoiceTemplateId,
        testOrgId,
        testUserId
      );

      // 2. Upload and process document
      const document = await DocumentService.uploadDocument({
        file: testInvoiceFile,
        organization_id: testOrgId
      });

      await OCRService.processDocument(document.id);
      await ExtractionService.extractData(document.id);

      // 3. Start workflow (auto-triggered)
      const instance = await WorkflowService.startWorkflow(
        document.id,
        workflow.id,
        testOrgId,
        testUserId
      );

      expect(instance.status).toBe('active');

      // 4. Complete first stage (department manager)
      const task1 = await getFirstPendingTask(instance.id);
      await WorkflowService.processApprovalDecision(
        task1.id,
        'approved',
        departmentManagerId,
        'Weryfikacja merytoryczna OK'
      );

      // 5. Complete second stage (accountant)
      const task2 = await getFirstPendingTask(instance.id);
      await WorkflowService.processApprovalDecision(
        task2.id,
        'approved',
        accountantId,
        'Sprawdzono VAT i kwoty'
      );

      // 6. Complete third stage (director)
      const task3 = await getFirstPendingTask(instance.id);
      await WorkflowService.processApprovalDecision(
        task3.id,
        'approved',
        directorId,
        'Zatwierdzam'
      );

      // 7. Verify workflow completed
      const finalInstance = await db.query.workflowInstances.findFirst({
        where: eq(workflowInstances.id, instance.id)
      });

      expect(finalInstance.status).toBe('completed');
      expect(finalInstance.final_outcome).toBe('approved');
      expect(finalInstance.accounting_entry_id).toBeDefined();

      // 8. Verify accounting entry created
      const entry = await db.query.journalEntries.findFirst({
        where: eq(journalEntries.id, finalInstance.accounting_entry_id)
      });

      expect(entry).toBeDefined();
      expect(entry.status).toBe('draft');
      expect(entry.source_document_id).toBe(document.id);

      // 9. Verify audit trail
      const auditEntries = await WorkflowService.getWorkflowHistory(testOrgId, {
        workflow_instance_id: instance.id
      });

      expect(auditEntries.length).toBeGreaterThanOrEqual(7); // start + 3 stages entered + 3 approvals
      expect(auditEntries.map(e => e.event_type)).toContain('workflow_started');
      expect(auditEntries.map(e => e.event_type)).toContain('workflow_completed');
    });

    it('should reject workflow when any stage is rejected', async () => {
      const instance = await createAndStartWorkflow();

      // Approve first stage
      const task1 = await getFirstPendingTask(instance.id);
      await WorkflowService.processApprovalDecision(task1.id, 'approved', testUserId);

      // Reject second stage
      const task2 = await getFirstPendingTask(instance.id);
      await WorkflowService.processApprovalDecision(
        task2.id,
        'rejected',
        testUserId,
        'Nieprawidłowe dane na fakturze'
      );

      // Verify workflow rejected
      const finalInstance = await db.query.workflowInstances.findFirst({
        where: eq(workflowInstances.id, instance.id)
      });

      expect(finalInstance.status).toBe('completed');
      expect(finalInstance.final_outcome).toBe('rejected');

      // Verify document status updated
      const document = await db.query.documents.findFirst({
        where: eq(documents.id, instance.document_id)
      });

      expect(document.status).toBe('REJECTED');
    });
  });

  describe('Stage Skip Conditions', () => {
    it('should skip director approval for invoices under 10,000 PLN', async () => {
      // Create document with low amount
      const document = await createTestDocument({
        extraction_result: { extracted_data: { gross_amount: 5000 } }
      });

      const instance = await WorkflowService.startWorkflow(
        document.id,
        polishInvoiceWorkflowId,
        testOrgId,
        testUserId
      );

      // Complete first two stages
      await completeStage(instance.id, 'approved');
      await completeStage(instance.id, 'approved');

      // Workflow should be complete (director stage skipped)
      const finalInstance = await db.query.workflowInstances.findFirst({
        where: eq(workflowInstances.id, instance.id)
      });

      expect(finalInstance.status).toBe('completed');

      // Verify director stage was skipped
      const stages = await db.query.stageInstances.findMany({
        where: eq(stageInstances.workflow_instance_id, instance.id)
      });

      const directorStage = stages.find(s => s.stage.name === 'Zatwierdzenie zarządu');
      expect(directorStage.status).toBe('skipped');
    });
  });

  describe('Notification Delivery', () => {
    it('should send notifications through configured channels', async () => {
      const instance = await createAndStartWorkflow();

      // Check notifications created
      const notifications = await db.query.workflowNotifications.findMany({
        where: eq(workflowNotifications.workflow_instance_id, instance.id)
      });

      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications.some(n => n.channel === 'email')).toBe(true);
      expect(notifications.some(n => n.channel === 'in_app')).toBe(true);
      expect(notifications.every(n => n.notification_type === 'approval_request')).toBe(true);
    });
  });

  describe('RLS Policies', () => {
    it('should isolate workflows between organizations', async () => {
      // Create workflow in org1
      const workflow1 = await WorkflowService.createWorkflow(
        testWorkflowInput,
        org1Id,
        user1Id
      );

      // Try to access from org2
      const result = await WorkflowService.getWorkflowById(workflow1.id, org2Id);

      expect(result).toBeNull();
    });

    it('should only show pending approvals for current user', async () => {
      // Create instance with tasks for different users
      await createInstanceWithTasks([user1Id, user2Id]);

      // Query as user1
      const user1Approvals = await WorkflowService.getPendingApprovals(
        user1Id,
        testOrgId,
        { status: 'pending' }
      );

      expect(user1Approvals.tasks.every(t => t.assignee_id === user1Id)).toBe(true);
    });
  });
});
```

### E2E Tests

```typescript
// e2e/workflow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Document Workflow E2E', () => {
  test('complete invoice approval workflow', async ({ page }) => {
    // Login as accountant
    await loginAs(page, 'accountant@test.pl');

    // Upload invoice
    await page.goto('/documents/upload');
    await page.setInputFiles('input[type="file"]', 'fixtures/invoice.pdf');
    await page.click('button:has-text("Prześlij")');

    // Wait for processing
    await expect(page.locator('[data-testid="processing-status"]'))
      .toHaveText('Przetworzono', { timeout: 30000 });

    // Start workflow
    await page.click('button:has-text("Rozpocznij workflow")');
    await page.selectOption('[data-testid="workflow-select"]', 'Faktura kosztowa');
    await page.click('button:has-text("Rozpocznij")');

    // Verify workflow started
    await expect(page.locator('[data-testid="workflow-status"]'))
      .toHaveText('Aktywny');

    // Login as department manager
    await loginAs(page, 'manager@test.pl');

    // Go to pending approvals
    await page.goto('/approvals');
    await expect(page.locator('[data-testid="pending-count"]'))
      .toHaveText('1');

    // Open approval task
    await page.click('[data-testid="approval-task"]:first-child');

    // Verify document details visible
    await expect(page.locator('[data-testid="document-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="extracted-data"]')).toBeVisible();

    // Approve
    await page.fill('[data-testid="approval-comment"]', 'Weryfikacja merytoryczna OK');
    await page.click('button:has-text("Zatwierdź")');

    // Verify success
    await expect(page.locator('[data-testid="toast-success"]'))
      .toContainText('Zatwierdzono');

    // Continue with remaining approvals as other users...
    await loginAs(page, 'accountant@test.pl');
    await approveTask(page);

    await loginAs(page, 'director@test.pl');
    await approveTask(page);

    // Verify workflow completed
    await page.goto('/documents');
    await page.click('[data-testid="document-row"]:first-child');

    await expect(page.locator('[data-testid="workflow-status"]'))
      .toHaveText('Zakończony');
    await expect(page.locator('[data-testid="workflow-outcome"]'))
      .toHaveText('Zatwierdzony');
    await expect(page.locator('[data-testid="accounting-entry-link"]'))
      .toBeVisible();
  });

  test('view workflow history and audit trail', async ({ page }) => {
    await loginAs(page, 'accountant@test.pl');

    // Navigate to completed workflow
    await page.goto('/documents/completed-invoice-id');
    await page.click('[data-testid="workflow-tab"]');

    // Verify history visible
    await expect(page.locator('[data-testid="workflow-history"]')).toBeVisible();

    // Verify all stages shown
    const stages = page.locator('[data-testid="stage-item"]');
    await expect(stages).toHaveCount(3);

    // Verify each stage has timestamp and approver
    for (const stage of await stages.all()) {
      await expect(stage.locator('[data-testid="stage-timestamp"]')).toBeVisible();
      await expect(stage.locator('[data-testid="stage-approver"]')).toBeVisible();
    }

    // View audit log
    await page.click('button:has-text("Dziennik audytu")');

    const auditEntries = page.locator('[data-testid="audit-entry"]');
    await expect(auditEntries.first()).toContainText('workflow_started');
    await expect(auditEntries.last()).toContainText('workflow_completed');
  });

  test('delegate approval task', async ({ page }) => {
    await loginAs(page, 'manager@test.pl');
    await page.goto('/approvals');

    // Open task
    await page.click('[data-testid="approval-task"]:first-child');

    // Click delegate
    await page.click('button:has-text("Deleguj")');

    // Select delegatee
    await page.click('[data-testid="delegatee-select"]');
    await page.click('text=Jan Kowalski');

    // Add reason
    await page.fill('[data-testid="delegation-reason"]', 'Na urlopie do 15.01');

    // Confirm delegation
    await page.click('button:has-text("Potwierdź delegację")');

    // Verify success
    await expect(page.locator('[data-testid="toast-success"]'))
      .toContainText('Delegowano');

    // Verify task no longer in my list
    await expect(page.locator('[data-testid="pending-count"]'))
      .toHaveText('0');
  });

  test('create workflow from Polish template', async ({ page }) => {
    await loginAs(page, 'admin@test.pl');
    await page.goto('/settings/workflows');

    // Click create from template
    await page.click('button:has-text("Nowy workflow")');
    await page.click('button:has-text("Z szablonu")');

    // Select Polish template
    await page.click('[data-testid="template-card"]:has-text("Faktura kosztowa")');

    // Customize
    await page.fill('[data-testid="workflow-name"]', 'Mój workflow faktur');
    await page.click('button:has-text("Dalej")');

    // Adjust stages
    await expect(page.locator('[data-testid="stage-list"]')).toBeVisible();

    // Add approver to first stage
    await page.click('[data-testid="stage-0"] [data-testid="edit-assignees"]');
    await page.click('[data-testid="user-select"]');
    await page.click('text=Anna Nowak');
    await page.click('button:has-text("Zapisz")');

    // Create workflow
    await page.click('button:has-text("Utwórz workflow")');

    // Verify created
    await expect(page.locator('[data-testid="toast-success"]'))
      .toContainText('Utworzono workflow');
    await expect(page.locator('[data-testid="workflow-list"]'))
      .toContainText('Mój workflow faktur');
  });
});
```

---

## Security Checklist

- [x] **Authentication**: All endpoints require valid session via `protectedProcedure`
- [x] **Authorization**: RLS policies enforce organization isolation
- [x] **Input Validation**: Zod schemas validate all inputs
- [x] **Audit Trail**: Immutable hash-chained audit log for all workflow events
- [x] **Decision Attribution**: Full capture of approver identity, IP, device
- [x] **Delegation Control**: Delegation requires explicit target and reason
- [x] **Escalation Safety**: Escalations logged and notified to all parties
- [x] **Accounting Entry Security**: Entries created as drafts requiring review
- [x] **Notification Security**: Secure action URLs with proper authentication
- [x] **Template Security**: System templates immutable, custom templates isolated

---

## Audit Events

| Event | Data Captured |
|-------|--------------|
| `workflow_started` | document_id, workflow_name, initiator_id |
| `stage_entered` | stage_name, due_at, assignees |
| `stage_completed` | stage_name, outcome, duration |
| `approval_requested` | task_id, assignee_id, due_at |
| `approval_completed` | decision, comment, decision_ip, decision_device |
| `delegated` | from_user, to_user, reason |
| `escalated` | original_assignee, escalated_to, reason |
| `notification_sent` | recipient, channel, type |
| `workflow_completed` | outcome, duration, entry_id |
| `workflow_cancelled` | reason, cancelled_by |
| `entry_created` | entry_id, amount, accounts |

---

## Implementation Notes

### Polish-Specific Considerations
1. **Workflow Templates**: Pre-configured for Polish accounting scenarios (faktura kosztowa, umowa, rachunek)
2. **VAT Handling**: Automatic split of net/VAT amounts for Polish invoices
3. **Account Mapping**: Integration with Polish chart of accounts (konto 221 for VAT)
4. **Language**: All notifications and UI in Polish
5. **Compliance**: Audit trail meets Polish accounting law requirements (ustawa o rachunkowości)

### Performance Considerations
1. **Escalation Processing**: Run as scheduled job every 15 minutes
2. **Notification Queue**: Async processing with retry logic
3. **Progress Calculation**: Trigger-based for real-time accuracy
4. **Approval Stats**: Cached with 5-minute TTL

### Integration Points
1. **DOC-005**: Extracted data used for trigger conditions and accounting entries
2. **DOC-006**: Tags can trigger workflows, workflows can assign tags
3. **ACC Module**: Accounting entry creation on workflow completion
4. **Notification Service**: Multi-channel delivery (email, in-app, SMS)

---

*Story created: December 2024*
*Last updated: December 2024*
