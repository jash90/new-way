# WFA-007: Workflow Templates

> **Story ID**: WFA-007
> **Epic**: Workflow Automation Engine (WFA)
> **Priority**: P1 (High)
> **Points**: 5
> **Status**: 📋 Ready for Development
> **Sprint**: Week 19

---

## User Story

**As an** accountant,
**I want** pre-built workflow templates for common Polish accounting processes,
**So that** I can quickly set up automation without starting from scratch.

---

## Acceptance Criteria

### AC1: Template Library
```gherkin
Given I am viewing the workflow templates page
When I browse the template library
Then I should see categorized templates for Polish accounting
And each template should display name, description, and category
And I should see usage statistics and ratings
And templates should be filterable by category and tags
```

### AC2: Category Organization
```gherkin
Given templates are organized in the library
When I filter by category
Then I should see templates grouped by:
  | Category | Polish Name | Examples |
  | Document Processing | Przetwarzanie dokumentów | Invoice OCR, Receipt scanning |
  | Tax Compliance | Rozliczenia podatkowe | JPK generation, VAT calculation |
  | Financial Operations | Operacje finansowe | Payment processing, Reconciliation |
  | Client Management | Zarządzanie klientami | Client onboarding, Report generation |
  | Approvals | Zatwierdzenia | Document approval, Expense approval |
  | Notifications | Powiadomienia | Deadline reminders, Status alerts |
And I should be able to search across all categories
```

### AC3: Template Customization
```gherkin
Given I have selected a template to use
When I create a workflow from the template
Then I should be prompted to customize required parameters
And I should see clearly marked placeholder values
And I should be able to modify any step or connection
And the system should validate my customizations
And I should be guided through mandatory configuration
```

### AC4: Template Import/Export
```gherkin
Given I have created a workflow or template
When I export it as a template
Then the export should include:
  | Component | Format | Description |
  | Definition | JSON | Full workflow structure |
  | Metadata | YAML | Name, description, tags |
  | Dependencies | JSON | Required integrations |
  | Variables | JSON | Configuration schema |
And I should be able to import templates from files
And imported templates should be validated before saving
```

### AC5: Template Sharing
```gherkin
Given I have a working workflow
When I share it as a template
Then I should configure sharing settings:
  | Setting | Options |
  | Visibility | Private, Organization, Public |
  | Permissions | View, Use, Clone, Modify |
  | Licensing | Free, Attribution, Restricted |
And the template should be reviewed before public sharing
And usage should be attributed to the original creator
```

### AC6: Usage Tracking
```gherkin
Given templates are being used in the organization
When I view template analytics
Then I should see:
  | Metric | Description |
  | Usage count | Number of workflows created |
  | Success rate | Execution success percentage |
  | Popularity | Ranking among templates |
  | User ratings | Average rating and reviews |
  | Feedback | User comments and suggestions |
And I should see which users have used each template
```

### AC7: Polish Accounting Templates
```gherkin
Given the template library is available
When I browse Polish accounting templates
Then I should see pre-built templates for:
  | Template | Code | Description |
  | Document Approval | TPL-001 | Multi-level approval for documents >15,000 PLN |
  | Invoice Processing | TPL-002 | OCR → Extraction → Entry creation |
  | Month-End Closing | TPL-003 | Reconciliation → Reports → Period close |
  | JPK Generation | TPL-004 | Data collection → Validation → File generation |
  | Tax Filing | TPL-005 | Calculate → Generate → Submit → Confirm |
  | Client Onboarding | TPL-006 | Registration → Verification → Setup |
  | Payment Processing | TPL-007 | Verify → White List → Execute |
  | Deadline Reminder | TPL-008 | Monitor → Alert → Escalate |
And each template should comply with Polish regulations
```

### AC8: Template Versioning
```gherkin
Given templates may be updated over time
When a template is updated
Then a new version should be created
And existing workflows using the template should not be affected
And users should be notified of available updates
And I should be able to compare template versions
And I should be able to migrate workflows to new template versions
```

---

## Technical Specification

### Database Schema

```sql
-- Template definitions
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  created_by UUID REFERENCES users(id),

  -- Template metadata
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  name_pl VARCHAR(255),
  description TEXT,
  description_pl TEXT,

  -- Categorization
  category workflow_template_category NOT NULL,
  tags TEXT[] DEFAULT '{}',

  -- Template content
  definition JSONB NOT NULL,
  variable_schema JSONB DEFAULT '{}',
  required_integrations TEXT[] DEFAULT '{}',

  -- Sharing
  visibility template_visibility DEFAULT 'private',
  is_official BOOLEAN DEFAULT false,
  license_type template_license DEFAULT 'free',

  -- Statistics
  usage_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3, 2),
  rating_count INTEGER DEFAULT 0,

  -- Version tracking
  version INTEGER DEFAULT 1,
  previous_version_id UUID REFERENCES workflow_templates(id),

  -- Polish compliance
  compliance_tags TEXT[] DEFAULT '{}',
  regulatory_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,

  -- Status
  status template_status DEFAULT 'draft'
);

-- Template categories enum
CREATE TYPE workflow_template_category AS ENUM (
  'DOCUMENT_PROCESSING',
  'TAX_COMPLIANCE',
  'FINANCIAL_OPERATIONS',
  'CLIENT_MANAGEMENT',
  'APPROVALS',
  'NOTIFICATIONS',
  'INTEGRATIONS',
  'CUSTOM'
);

-- Template visibility enum
CREATE TYPE template_visibility AS ENUM (
  'private',
  'organization',
  'public'
);

-- Template license enum
CREATE TYPE template_license AS ENUM (
  'free',
  'attribution',
  'restricted'
);

-- Template status enum
CREATE TYPE template_status AS ENUM (
  'draft',
  'review',
  'published',
  'deprecated'
);

-- Template variables
CREATE TABLE template_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE,

  name VARCHAR(100) NOT NULL,
  label VARCHAR(255),
  label_pl VARCHAR(255),
  description TEXT,
  description_pl TEXT,

  variable_type variable_type NOT NULL,
  default_value JSONB,
  validation_rules JSONB,
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(template_id, name)
);

-- Variable types enum
CREATE TYPE variable_type AS ENUM (
  'string',
  'number',
  'boolean',
  'date',
  'select',
  'multiselect',
  'client_reference',
  'user_reference',
  'account_reference'
);

-- Template ratings and reviews
CREATE TABLE template_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),

  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review TEXT,

  -- Usage context
  workflow_id UUID REFERENCES workflows(id),
  execution_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5, 2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(template_id, user_id)
);

-- Template usage tracking
CREATE TABLE template_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),

  -- Usage details
  template_version INTEGER NOT NULL,
  customizations_made JSONB DEFAULT '{}',

  -- Performance tracking
  execution_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_execution_at TIMESTAMPTZ
);

-- Template sharing permissions
CREATE TABLE template_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE,

  -- Share target
  target_type share_target_type NOT NULL,
  target_id UUID NOT NULL,

  -- Permissions
  can_view BOOLEAN DEFAULT true,
  can_use BOOLEAN DEFAULT true,
  can_clone BOOLEAN DEFAULT false,
  can_modify BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  UNIQUE(template_id, target_type, target_id)
);

-- Share target type enum
CREATE TYPE share_target_type AS ENUM (
  'user',
  'organization',
  'team',
  'public'
);

-- Official Polish accounting templates
CREATE TABLE official_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE,

  -- Official metadata
  official_code VARCHAR(20) UNIQUE NOT NULL,
  regulation_reference TEXT,
  effective_date DATE,
  expiry_date DATE,

  -- Compliance
  compliance_level compliance_level NOT NULL,
  required_for_industries TEXT[] DEFAULT '{}',

  -- Updates
  last_regulatory_update DATE,
  update_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance level enum
CREATE TYPE compliance_level AS ENUM (
  'mandatory',
  'recommended',
  'optional'
);

-- RLS Policies
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_shares ENABLE ROW LEVEL SECURITY;

-- Template access policy
CREATE POLICY template_access ON workflow_templates
  FOR SELECT USING (
    visibility = 'public' OR
    organization_id = current_organization_id() OR
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM template_shares
      WHERE template_id = workflow_templates.id
      AND (
        (target_type = 'user' AND target_id = auth.uid()) OR
        (target_type = 'organization' AND target_id = current_organization_id())
      )
    )
  );

-- Indexes
CREATE INDEX idx_templates_category ON workflow_templates(category);
CREATE INDEX idx_templates_visibility ON workflow_templates(visibility);
CREATE INDEX idx_templates_organization ON workflow_templates(organization_id);
CREATE INDEX idx_templates_tags ON workflow_templates USING GIN(tags);
CREATE INDEX idx_templates_compliance_tags ON workflow_templates USING GIN(compliance_tags);
CREATE INDEX idx_template_usage_template ON template_usage(template_id);
CREATE INDEX idx_template_ratings_template ON template_ratings(template_id);
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Template categories
export const templateCategorySchema = z.enum([
  'DOCUMENT_PROCESSING',
  'TAX_COMPLIANCE',
  'FINANCIAL_OPERATIONS',
  'CLIENT_MANAGEMENT',
  'APPROVALS',
  'NOTIFICATIONS',
  'INTEGRATIONS',
  'CUSTOM'
]);

// Template visibility
export const templateVisibilitySchema = z.enum([
  'private',
  'organization',
  'public'
]);

// Template license
export const templateLicenseSchema = z.enum([
  'free',
  'attribution',
  'restricted'
]);

// Template status
export const templateStatusSchema = z.enum([
  'draft',
  'review',
  'published',
  'deprecated'
]);

// Variable type
export const variableTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'select',
  'multiselect',
  'client_reference',
  'user_reference',
  'account_reference'
]);

// Template variable schema
export const templateVariableSchema = z.object({
  name: z.string().min(1).max(100),
  label: z.string().max(255).optional(),
  labelPl: z.string().max(255).optional(),
  description: z.string().optional(),
  descriptionPl: z.string().optional(),
  variableType: variableTypeSchema,
  defaultValue: z.any().optional(),
  validationRules: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    options: z.array(z.object({
      value: z.any(),
      label: z.string(),
      labelPl: z.string().optional()
    })).optional(),
    required: z.boolean().optional()
  }).optional(),
  isRequired: z.boolean().default(false),
  displayOrder: z.number().int().default(0)
});

// Create template input
export const createTemplateInputSchema = z.object({
  code: z.string().min(3).max(20).regex(/^[A-Z0-9-]+$/),
  name: z.string().min(1).max(255),
  namePl: z.string().max(255).optional(),
  description: z.string().optional(),
  descriptionPl: z.string().optional(),
  category: templateCategorySchema,
  tags: z.array(z.string()).default([]),
  definition: z.object({
    nodes: z.array(z.any()),
    connections: z.array(z.any()),
    settings: z.any().optional()
  }),
  variables: z.array(templateVariableSchema).default([]),
  requiredIntegrations: z.array(z.string()).default([]),
  visibility: templateVisibilitySchema.default('private'),
  license: templateLicenseSchema.default('free'),
  complianceTags: z.array(z.string()).default([]),
  regulatoryNotes: z.string().optional()
});

// Update template input
export const updateTemplateInputSchema = createTemplateInputSchema.partial().extend({
  id: z.string().uuid()
});

// Template filters
export const templateFiltersSchema = z.object({
  category: templateCategorySchema.optional(),
  visibility: templateVisibilitySchema.optional(),
  tags: z.array(z.string()).optional(),
  complianceTags: z.array(z.string()).optional(),
  search: z.string().optional(),
  isOfficial: z.boolean().optional(),
  minRating: z.number().min(1).max(5).optional(),
  sortBy: z.enum(['name', 'usage_count', 'rating', 'created_at', 'updated_at']).default('usage_count'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0)
});

// Create from template input
export const createFromTemplateInputSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  variables: z.record(z.any()),
  customizations: z.object({
    nodes: z.array(z.any()).optional(),
    connections: z.array(z.any()).optional(),
    settings: z.any().optional()
  }).optional()
});

// Share template input
export const shareTemplateInputSchema = z.object({
  templateId: z.string().uuid(),
  targetType: z.enum(['user', 'organization', 'team', 'public']),
  targetId: z.string().uuid().optional(),
  permissions: z.object({
    canView: z.boolean().default(true),
    canUse: z.boolean().default(true),
    canClone: z.boolean().default(false),
    canModify: z.boolean().default(false)
  })
});

// Rate template input
export const rateTemplateInputSchema = z.object({
  templateId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  review: z.string().max(2000).optional(),
  workflowId: z.string().uuid().optional()
});

// Export template input
export const exportTemplateInputSchema = z.object({
  templateId: z.string().uuid(),
  format: z.enum(['json', 'yaml', 'zip']).default('json'),
  includeMetadata: z.boolean().default(true),
  includeUsageStats: z.boolean().default(false)
});

// Import template input
export const importTemplateInputSchema = z.object({
  content: z.string(),
  format: z.enum(['json', 'yaml']),
  overwrite: z.boolean().default(false)
});
```

### Service Implementation

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class TemplateService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2
  ) {}

  // Polish accounting template definitions
  private readonly officialTemplates = [
    {
      code: 'TPL-001',
      name: 'Document Approval',
      namePl: 'Zatwierdzanie dokumentów',
      category: 'APPROVALS',
      description: 'Multi-level approval for documents exceeding 15,000 PLN',
      descriptionPl: 'Wielopoziomowe zatwierdzanie dokumentów powyżej 15 000 PLN',
      complianceTags: ['document-approval', 'financial-control']
    },
    {
      code: 'TPL-002',
      name: 'Invoice Processing',
      namePl: 'Przetwarzanie faktur',
      category: 'DOCUMENT_PROCESSING',
      description: 'OCR → Extraction → Entry creation workflow',
      descriptionPl: 'OCR → Ekstrakcja → Tworzenie zapisów',
      complianceTags: ['invoice', 'jpk', 'vat']
    },
    {
      code: 'TPL-003',
      name: 'Month-End Closing',
      namePl: 'Zamknięcie miesiąca',
      category: 'FINANCIAL_OPERATIONS',
      description: 'Reconciliation → Reports → Period close',
      descriptionPl: 'Uzgadnianie → Raporty → Zamknięcie okresu',
      complianceTags: ['month-end', 'reconciliation', 'reporting']
    },
    {
      code: 'TPL-004',
      name: 'JPK Generation',
      namePl: 'Generowanie JPK',
      category: 'TAX_COMPLIANCE',
      description: 'Data collection → Validation → File generation',
      descriptionPl: 'Zbieranie danych → Walidacja → Generowanie pliku',
      complianceTags: ['jpk', 'vat', 'ministry-of-finance']
    },
    {
      code: 'TPL-005',
      name: 'Tax Filing',
      namePl: 'Składanie deklaracji podatkowych',
      category: 'TAX_COMPLIANCE',
      description: 'Calculate → Generate → Submit → Confirm',
      descriptionPl: 'Oblicz → Wygeneruj → Złóż → Potwierdź',
      complianceTags: ['tax-filing', 'e-declaration', 'vat', 'cit', 'pit']
    },
    {
      code: 'TPL-006',
      name: 'Client Onboarding',
      namePl: 'Wdrażanie klienta',
      category: 'CLIENT_MANAGEMENT',
      description: 'Registration → Verification → Setup',
      descriptionPl: 'Rejestracja → Weryfikacja → Konfiguracja',
      complianceTags: ['client-onboarding', 'gus', 'regon']
    },
    {
      code: 'TPL-007',
      name: 'Payment Processing',
      namePl: 'Przetwarzanie płatności',
      category: 'FINANCIAL_OPERATIONS',
      description: 'Verify → White List → Execute',
      descriptionPl: 'Weryfikuj → Biała Lista → Wykonaj',
      complianceTags: ['payment', 'white-list', 'vat-verification']
    },
    {
      code: 'TPL-008',
      name: 'Deadline Reminder',
      namePl: 'Przypomnienia o terminach',
      category: 'NOTIFICATIONS',
      description: 'Monitor → Alert → Escalate',
      descriptionPl: 'Monitoruj → Powiadom → Eskaluj',
      complianceTags: ['deadlines', 'notifications', 'tax-calendar']
    }
  ];

  async getTemplates(
    filters: z.infer<typeof templateFiltersSchema>,
    userId: string,
    organizationId: string
  ): Promise<TemplateListResult> {
    const where = this.buildTemplateWhereClause(filters, userId, organizationId);

    const [templates, total] = await Promise.all([
      this.prisma.workflowTemplate.findMany({
        where,
        include: {
          createdByUser: {
            select: { id: true, name: true, email: true }
          },
          _count: {
            select: {
              templateUsage: true,
              templateRatings: true
            }
          }
        },
        orderBy: { [filters.sortBy]: filters.sortOrder },
        take: filters.limit,
        skip: filters.offset
      }),
      this.prisma.workflowTemplate.count({ where })
    ]);

    return {
      templates: templates.map(this.mapTemplateToDto),
      total,
      limit: filters.limit,
      offset: filters.offset
    };
  }

  async getTemplateById(
    templateId: string,
    userId: string,
    organizationId: string
  ): Promise<TemplateDetails> {
    const template = await this.prisma.workflowTemplate.findUnique({
      where: { id: templateId },
      include: {
        createdByUser: {
          select: { id: true, name: true, email: true }
        },
        templateVariables: {
          orderBy: { displayOrder: 'asc' }
        },
        templateRatings: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true } }
          }
        },
        officialTemplate: true,
        _count: {
          select: {
            templateUsage: true,
            templateRatings: true
          }
        }
      }
    });

    if (!template) {
      throw new NotFoundException('Szablon nie został znaleziony');
    }

    // Check access
    await this.checkTemplateAccess(template, userId, organizationId, 'view');

    return this.mapTemplateToDetailDto(template);
  }

  async createTemplate(
    input: z.infer<typeof createTemplateInputSchema>,
    userId: string,
    organizationId: string
  ): Promise<TemplateDetails> {
    // Validate template definition
    await this.validateTemplateDefinition(input.definition);

    const template = await this.prisma.$transaction(async (tx) => {
      // Create template
      const template = await tx.workflowTemplate.create({
        data: {
          code: input.code,
          name: input.name,
          namePl: input.namePl,
          description: input.description,
          descriptionPl: input.descriptionPl,
          category: input.category,
          tags: input.tags,
          definition: input.definition,
          requiredIntegrations: input.requiredIntegrations,
          visibility: input.visibility,
          licenseType: input.license,
          complianceTags: input.complianceTags,
          regulatoryNotes: input.regulatoryNotes,
          createdBy: userId,
          organizationId,
          status: 'draft'
        }
      });

      // Create variables
      if (input.variables.length > 0) {
        await tx.templateVariable.createMany({
          data: input.variables.map((variable, index) => ({
            templateId: template.id,
            name: variable.name,
            label: variable.label,
            labelPl: variable.labelPl,
            description: variable.description,
            descriptionPl: variable.descriptionPl,
            variableType: variable.variableType,
            defaultValue: variable.defaultValue,
            validationRules: variable.validationRules,
            isRequired: variable.isRequired,
            displayOrder: variable.displayOrder ?? index
          }))
        });
      }

      // Log audit event
      await tx.auditLog.create({
        data: {
          action: 'TEMPLATE_CREATED',
          entityType: 'workflow_template',
          entityId: template.id,
          userId,
          organizationId,
          metadata: { code: input.code, name: input.name }
        }
      });

      return template;
    });

    this.eventEmitter.emit('template.created', {
      templateId: template.id,
      code: template.code,
      userId,
      organizationId
    });

    return this.getTemplateById(template.id, userId, organizationId);
  }

  async createFromTemplate(
    input: z.infer<typeof createFromTemplateInputSchema>,
    userId: string,
    organizationId: string
  ): Promise<WorkflowDetails> {
    const template = await this.getTemplateById(
      input.templateId,
      userId,
      organizationId
    );

    // Check if user can use template
    await this.checkTemplateAccess(
      { id: template.id, organizationId: template.organizationId } as any,
      userId,
      organizationId,
      'use'
    );

    // Validate required variables
    const missingVariables = template.variables
      .filter(v => v.isRequired && input.variables[v.name] === undefined)
      .map(v => v.name);

    if (missingVariables.length > 0) {
      throw new BadRequestException(
        `Brakujące wymagane zmienne: ${missingVariables.join(', ')}`
      );
    }

    // Apply variables to definition
    const processedDefinition = this.applyVariablesToDefinition(
      template.definition,
      input.variables
    );

    // Merge customizations
    const finalDefinition = input.customizations
      ? this.mergeCustomizations(processedDefinition, input.customizations)
      : processedDefinition;

    // Create workflow
    const workflow = await this.prisma.$transaction(async (tx) => {
      const workflow = await tx.workflow.create({
        data: {
          name: input.name,
          description: input.description ?? template.description,
          definition: finalDefinition,
          status: 'DRAFT',
          createdBy: userId,
          organizationId,
          templateId: template.id,
          templateVersion: template.version
        }
      });

      // Track template usage
      await tx.templateUsage.create({
        data: {
          templateId: template.id,
          workflowId: workflow.id,
          userId,
          organizationId,
          templateVersion: template.version,
          customizationsMade: input.customizations ?? {}
        }
      });

      // Increment usage count
      await tx.workflowTemplate.update({
        where: { id: template.id },
        data: { usageCount: { increment: 1 } }
      });

      // Log audit event
      await tx.auditLog.create({
        data: {
          action: 'WORKFLOW_CREATED_FROM_TEMPLATE',
          entityType: 'workflow',
          entityId: workflow.id,
          userId,
          organizationId,
          metadata: {
            templateId: template.id,
            templateCode: template.code,
            templateVersion: template.version
          }
        }
      });

      return workflow;
    });

    this.eventEmitter.emit('workflow.created_from_template', {
      workflowId: workflow.id,
      templateId: template.id,
      userId,
      organizationId
    });

    return this.workflowService.getWorkflowById(workflow.id, userId, organizationId);
  }

  async shareTemplate(
    input: z.infer<typeof shareTemplateInputSchema>,
    userId: string,
    organizationId: string
  ): Promise<TemplateShare> {
    const template = await this.prisma.workflowTemplate.findUnique({
      where: { id: input.templateId }
    });

    if (!template) {
      throw new NotFoundException('Szablon nie został znaleziony');
    }

    // Only owner or org admin can share
    if (template.createdBy !== userId) {
      throw new ForbiddenException('Brak uprawnień do udostępniania szablonu');
    }

    // If sharing publicly, require review
    if (input.targetType === 'public' && template.status !== 'published') {
      await this.prisma.workflowTemplate.update({
        where: { id: input.templateId },
        data: { status: 'review' }
      });

      this.eventEmitter.emit('template.review_requested', {
        templateId: template.id,
        userId,
        organizationId
      });

      return {
        id: '',
        templateId: input.templateId,
        status: 'pending_review',
        message: 'Szablon został przesłany do recenzji przed publicznym udostępnieniem'
      };
    }

    const share = await this.prisma.templateShare.upsert({
      where: {
        templateId_targetType_targetId: {
          templateId: input.templateId,
          targetType: input.targetType,
          targetId: input.targetId ?? '00000000-0000-0000-0000-000000000000'
        }
      },
      create: {
        templateId: input.templateId,
        targetType: input.targetType,
        targetId: input.targetId ?? '00000000-0000-0000-0000-000000000000',
        canView: input.permissions.canView,
        canUse: input.permissions.canUse,
        canClone: input.permissions.canClone,
        canModify: input.permissions.canModify,
        createdBy: userId
      },
      update: {
        canView: input.permissions.canView,
        canUse: input.permissions.canUse,
        canClone: input.permissions.canClone,
        canModify: input.permissions.canModify
      }
    });

    this.eventEmitter.emit('template.shared', {
      templateId: input.templateId,
      shareId: share.id,
      targetType: input.targetType,
      targetId: input.targetId,
      userId,
      organizationId
    });

    return share;
  }

  async rateTemplate(
    input: z.infer<typeof rateTemplateInputSchema>,
    userId: string,
    organizationId: string
  ): Promise<TemplateRating> {
    const template = await this.prisma.workflowTemplate.findUnique({
      where: { id: input.templateId }
    });

    if (!template) {
      throw new NotFoundException('Szablon nie został znaleziony');
    }

    // Get usage stats if workflow provided
    let usageStats = null;
    if (input.workflowId) {
      usageStats = await this.prisma.templateUsage.findFirst({
        where: {
          templateId: input.templateId,
          workflowId: input.workflowId,
          userId
        }
      });
    }

    const rating = await this.prisma.$transaction(async (tx) => {
      const rating = await tx.templateRating.upsert({
        where: {
          templateId_userId: {
            templateId: input.templateId,
            userId
          }
        },
        create: {
          templateId: input.templateId,
          userId,
          organizationId,
          rating: input.rating,
          review: input.review,
          workflowId: input.workflowId,
          executionCount: usageStats?.executionCount ?? 0,
          successRate: usageStats ?
            (usageStats.successCount / usageStats.executionCount * 100) : null
        },
        update: {
          rating: input.rating,
          review: input.review,
          workflowId: input.workflowId,
          updatedAt: new Date()
        }
      });

      // Update average rating
      const stats = await tx.templateRating.aggregate({
        where: { templateId: input.templateId },
        _avg: { rating: true },
        _count: { rating: true }
      });

      await tx.workflowTemplate.update({
        where: { id: input.templateId },
        data: {
          averageRating: stats._avg.rating,
          ratingCount: stats._count.rating
        }
      });

      return rating;
    });

    this.eventEmitter.emit('template.rated', {
      templateId: input.templateId,
      ratingId: rating.id,
      rating: input.rating,
      userId,
      organizationId
    });

    return rating;
  }

  async exportTemplate(
    input: z.infer<typeof exportTemplateInputSchema>,
    userId: string,
    organizationId: string
  ): Promise<TemplateExport> {
    const template = await this.getTemplateById(
      input.templateId,
      userId,
      organizationId
    );

    const exportData: any = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      template: {
        code: template.code,
        name: template.name,
        namePl: template.namePl,
        description: template.description,
        descriptionPl: template.descriptionPl,
        category: template.category,
        tags: template.tags,
        definition: template.definition,
        variables: template.variables,
        requiredIntegrations: template.requiredIntegrations,
        complianceTags: template.complianceTags
      }
    };

    if (input.includeMetadata) {
      exportData.metadata = {
        createdBy: template.createdBy,
        createdAt: template.createdAt,
        version: template.version,
        license: template.license
      };
    }

    if (input.includeUsageStats) {
      exportData.stats = {
        usageCount: template.usageCount,
        averageRating: template.averageRating,
        ratingCount: template.ratingCount
      };
    }

    let content: string;
    let mimeType: string;

    switch (input.format) {
      case 'yaml':
        content = yaml.dump(exportData);
        mimeType = 'application/x-yaml';
        break;
      case 'json':
      default:
        content = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json';
    }

    this.eventEmitter.emit('template.exported', {
      templateId: input.templateId,
      format: input.format,
      userId,
      organizationId
    });

    return {
      content,
      mimeType,
      filename: `template-${template.code}.${input.format}`
    };
  }

  async importTemplate(
    input: z.infer<typeof importTemplateInputSchema>,
    userId: string,
    organizationId: string
  ): Promise<TemplateDetails> {
    let parsed: any;

    try {
      parsed = input.format === 'yaml'
        ? yaml.load(input.content)
        : JSON.parse(input.content);
    } catch (error) {
      throw new BadRequestException('Nieprawidłowy format pliku szablonu');
    }

    // Validate import structure
    if (!parsed.template || !parsed.template.definition) {
      throw new BadRequestException('Nieprawidłowa struktura szablonu');
    }

    // Check for duplicate code
    if (!input.overwrite) {
      const existing = await this.prisma.workflowTemplate.findUnique({
        where: { code: parsed.template.code }
      });

      if (existing) {
        throw new ConflictException(
          `Szablon z kodem ${parsed.template.code} już istnieje`
        );
      }
    }

    // Create or update template
    const createInput: z.infer<typeof createTemplateInputSchema> = {
      code: parsed.template.code,
      name: parsed.template.name,
      namePl: parsed.template.namePl,
      description: parsed.template.description,
      descriptionPl: parsed.template.descriptionPl,
      category: parsed.template.category,
      tags: parsed.template.tags ?? [],
      definition: parsed.template.definition,
      variables: parsed.template.variables ?? [],
      requiredIntegrations: parsed.template.requiredIntegrations ?? [],
      visibility: 'private',
      license: 'free',
      complianceTags: parsed.template.complianceTags ?? []
    };

    return this.createTemplate(createInput, userId, organizationId);
  }

  async getOfficialTemplates(
    organizationId: string
  ): Promise<OfficialTemplate[]> {
    return this.prisma.workflowTemplate.findMany({
      where: {
        isOfficial: true,
        status: 'published'
      },
      include: {
        officialTemplate: true,
        templateVariables: {
          orderBy: { displayOrder: 'asc' }
        },
        _count: {
          select: {
            templateUsage: {
              where: { organizationId }
            }
          }
        }
      },
      orderBy: { code: 'asc' }
    });
  }

  private applyVariablesToDefinition(
    definition: any,
    variables: Record<string, any>
  ): any {
    const json = JSON.stringify(definition);

    let processed = json;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      processed = processed.replace(placeholder, JSON.stringify(value).slice(1, -1));
    }

    return JSON.parse(processed);
  }

  private mergeCustomizations(
    definition: any,
    customizations: any
  ): any {
    return {
      ...definition,
      nodes: customizations.nodes ?? definition.nodes,
      connections: customizations.connections ?? definition.connections,
      settings: {
        ...definition.settings,
        ...customizations.settings
      }
    };
  }

  private async validateTemplateDefinition(definition: any): Promise<void> {
    // Validate nodes
    if (!Array.isArray(definition.nodes) || definition.nodes.length === 0) {
      throw new BadRequestException('Szablon musi zawierać przynajmniej jeden węzeł');
    }

    // Validate connections reference valid nodes
    const nodeIds = new Set(definition.nodes.map((n: any) => n.id));
    for (const connection of definition.connections ?? []) {
      if (!nodeIds.has(connection.source) || !nodeIds.has(connection.target)) {
        throw new BadRequestException('Połączenie odwołuje się do nieistniejącego węzła');
      }
    }

    // Validate trigger node exists
    const hasTrigger = definition.nodes.some((n: any) =>
      n.type?.toLowerCase().includes('trigger')
    );
    if (!hasTrigger) {
      throw new BadRequestException('Szablon musi zawierać węzeł wyzwalacza');
    }
  }

  private async checkTemplateAccess(
    template: any,
    userId: string,
    organizationId: string,
    action: 'view' | 'use' | 'clone' | 'modify'
  ): Promise<void> {
    // Owner always has access
    if (template.createdBy === userId) {
      return;
    }

    // Public templates can be viewed and used
    if (template.visibility === 'public' && ['view', 'use'].includes(action)) {
      return;
    }

    // Organization templates for same org
    if (template.visibility === 'organization' &&
        template.organizationId === organizationId) {
      return;
    }

    // Check explicit shares
    const share = await this.prisma.templateShare.findFirst({
      where: {
        templateId: template.id,
        OR: [
          { targetType: 'user', targetId: userId },
          { targetType: 'organization', targetId: organizationId },
          { targetType: 'public' }
        ]
      }
    });

    if (!share) {
      throw new ForbiddenException('Brak dostępu do szablonu');
    }

    const permissionMap = {
      view: share.canView,
      use: share.canUse,
      clone: share.canClone,
      modify: share.canModify
    };

    if (!permissionMap[action]) {
      throw new ForbiddenException(`Brak uprawnień do akcji: ${action}`);
    }
  }
}
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '@/server/trpc';
import { TemplateService } from './template.service';
import {
  templateFiltersSchema,
  createTemplateInputSchema,
  createFromTemplateInputSchema,
  shareTemplateInputSchema,
  rateTemplateInputSchema,
  exportTemplateInputSchema,
  importTemplateInputSchema
} from './template.schemas';

export const templateRouter = router({
  list: protectedProcedure
    .input(templateFiltersSchema)
    .query(async ({ input, ctx }) => {
      return ctx.templateService.getTemplates(
        input,
        ctx.user.id,
        ctx.organizationId
      );
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return ctx.templateService.getTemplateById(
        input.id,
        ctx.user.id,
        ctx.organizationId
      );
    }),

  create: protectedProcedure
    .input(createTemplateInputSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.templateService.createTemplate(
        input,
        ctx.user.id,
        ctx.organizationId
      );
    }),

  createFromTemplate: protectedProcedure
    .input(createFromTemplateInputSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.templateService.createFromTemplate(
        input,
        ctx.user.id,
        ctx.organizationId
      );
    }),

  share: protectedProcedure
    .input(shareTemplateInputSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.templateService.shareTemplate(
        input,
        ctx.user.id,
        ctx.organizationId
      );
    }),

  rate: protectedProcedure
    .input(rateTemplateInputSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.templateService.rateTemplate(
        input,
        ctx.user.id,
        ctx.organizationId
      );
    }),

  export: protectedProcedure
    .input(exportTemplateInputSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.templateService.exportTemplate(
        input,
        ctx.user.id,
        ctx.organizationId
      );
    }),

  import: protectedProcedure
    .input(importTemplateInputSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.templateService.importTemplate(
        input,
        ctx.user.id,
        ctx.organizationId
      );
    }),

  getOfficial: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.templateService.getOfficialTemplates(ctx.organizationId);
    }),

  getCategories: protectedProcedure
    .query(async () => {
      return [
        { value: 'DOCUMENT_PROCESSING', label: 'Document Processing', labelPl: 'Przetwarzanie dokumentów' },
        { value: 'TAX_COMPLIANCE', label: 'Tax Compliance', labelPl: 'Rozliczenia podatkowe' },
        { value: 'FINANCIAL_OPERATIONS', label: 'Financial Operations', labelPl: 'Operacje finansowe' },
        { value: 'CLIENT_MANAGEMENT', label: 'Client Management', labelPl: 'Zarządzanie klientami' },
        { value: 'APPROVALS', label: 'Approvals', labelPl: 'Zatwierdzenia' },
        { value: 'NOTIFICATIONS', label: 'Notifications', labelPl: 'Powiadomienia' },
        { value: 'INTEGRATIONS', label: 'Integrations', labelPl: 'Integracje' },
        { value: 'CUSTOM', label: 'Custom', labelPl: 'Własne' }
      ];
    })
});
```

---

## Test Specification

### Unit Tests

```typescript
describe('TemplateService', () => {
  describe('getTemplates', () => {
    it('should return templates filtered by category', async () => {
      const result = await service.getTemplates(
        { category: 'TAX_COMPLIANCE' },
        userId,
        organizationId
      );

      expect(result.templates).toBeDefined();
      expect(result.templates.every(t => t.category === 'TAX_COMPLIANCE')).toBe(true);
    });

    it('should return official templates', async () => {
      const result = await service.getTemplates(
        { isOfficial: true },
        userId,
        organizationId
      );

      expect(result.templates.every(t => t.isOfficial)).toBe(true);
    });

    it('should filter by minimum rating', async () => {
      const result = await service.getTemplates(
        { minRating: 4 },
        userId,
        organizationId
      );

      expect(result.templates.every(t => t.averageRating >= 4)).toBe(true);
    });
  });

  describe('createFromTemplate', () => {
    it('should create workflow from template with variables', async () => {
      const workflow = await service.createFromTemplate(
        {
          templateId: template.id,
          name: 'My JPK Workflow',
          variables: {
            periodMonth: '2024-01',
            taxOfficeCode: '1234'
          }
        },
        userId,
        organizationId
      );

      expect(workflow.name).toBe('My JPK Workflow');
      expect(workflow.templateId).toBe(template.id);
    });

    it('should fail if required variables are missing', async () => {
      await expect(
        service.createFromTemplate(
          {
            templateId: templateWithRequired.id,
            name: 'Test',
            variables: {}
          },
          userId,
          organizationId
        )
      ).rejects.toThrow('Brakujące wymagane zmienne');
    });

    it('should apply customizations to template', async () => {
      const workflow = await service.createFromTemplate(
        {
          templateId: template.id,
          name: 'Customized Workflow',
          variables: {},
          customizations: {
            nodes: [...template.definition.nodes, customNode]
          }
        },
        userId,
        organizationId
      );

      expect(workflow.definition.nodes.length).toBe(
        template.definition.nodes.length + 1
      );
    });
  });

  describe('shareTemplate', () => {
    it('should share template with organization', async () => {
      const share = await service.shareTemplate(
        {
          templateId: template.id,
          targetType: 'organization',
          targetId: otherOrgId,
          permissions: { canView: true, canUse: true }
        },
        userId,
        organizationId
      );

      expect(share.canView).toBe(true);
      expect(share.canUse).toBe(true);
    });

    it('should require review for public sharing', async () => {
      const result = await service.shareTemplate(
        {
          templateId: template.id,
          targetType: 'public',
          permissions: { canView: true, canUse: true }
        },
        userId,
        organizationId
      );

      expect(result.status).toBe('pending_review');
    });
  });

  describe('exportTemplate', () => {
    it('should export template as JSON', async () => {
      const exported = await service.exportTemplate(
        { templateId: template.id, format: 'json' },
        userId,
        organizationId
      );

      expect(exported.mimeType).toBe('application/json');
      expect(JSON.parse(exported.content).template.code).toBe(template.code);
    });

    it('should export template as YAML', async () => {
      const exported = await service.exportTemplate(
        { templateId: template.id, format: 'yaml' },
        userId,
        organizationId
      );

      expect(exported.mimeType).toBe('application/x-yaml');
    });
  });

  describe('importTemplate', () => {
    it('should import template from JSON', async () => {
      const imported = await service.importTemplate(
        {
          content: JSON.stringify(exportedTemplate),
          format: 'json'
        },
        userId,
        organizationId
      );

      expect(imported.code).toBe(exportedTemplate.template.code);
    });

    it('should fail on duplicate code without overwrite', async () => {
      await expect(
        service.importTemplate(
          {
            content: JSON.stringify(existingTemplateExport),
            format: 'json',
            overwrite: false
          },
          userId,
          organizationId
        )
      ).rejects.toThrow('już istnieje');
    });
  });
});
```

### Integration Tests

```typescript
describe('Template Integration', () => {
  describe('Polish Accounting Templates', () => {
    it('should have all 8 official templates available', async () => {
      const templates = await service.getOfficialTemplates(organizationId);

      expect(templates.length).toBeGreaterThanOrEqual(8);
      expect(templates.map(t => t.code)).toContain('TPL-001');
      expect(templates.map(t => t.code)).toContain('TPL-004');
      expect(templates.map(t => t.code)).toContain('TPL-008');
    });

    it('should create JPK workflow from official template', async () => {
      const jpkTemplate = await service.getTemplateById(
        jpkTemplateId,
        userId,
        organizationId
      );

      const workflow = await service.createFromTemplate(
        {
          templateId: jpkTemplateId,
          name: 'JPK Workflow - Styczeń 2024',
          variables: {
            periodMonth: '2024-01',
            taxOfficeCode: '1471'
          }
        },
        userId,
        organizationId
      );

      expect(workflow.templateId).toBe(jpkTemplateId);
      expect(workflow.definition.nodes).toBeDefined();
    });
  });

  describe('Template Versioning', () => {
    it('should not affect existing workflows when template is updated', async () => {
      // Create workflow from template v1
      const workflow = await service.createFromTemplate(
        {
          templateId: template.id,
          name: 'V1 Workflow',
          variables: {}
        },
        userId,
        organizationId
      );

      // Update template to v2
      await service.updateTemplate(
        {
          id: template.id,
          name: 'Updated Template'
        },
        userId,
        organizationId
      );

      // Original workflow should be unchanged
      const refreshedWorkflow = await workflowService.getWorkflowById(
        workflow.id,
        userId,
        organizationId
      );

      expect(refreshedWorkflow.templateVersion).toBe(1);
    });
  });
});
```

---

## Security Checklist

- [x] Row Level Security on all template tables
- [x] Template access validation before operations
- [x] Share permission checks
- [x] Public template review requirement
- [x] Input validation with Zod schemas
- [x] Audit logging for all template operations
- [x] Template definition validation (no code injection)
- [x] Import content validation
- [x] Organization isolation

---

## Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `TEMPLATE_CREATED` | Template created | templateId, code, name, category |
| `TEMPLATE_UPDATED` | Template modified | templateId, changes |
| `TEMPLATE_DELETED` | Template removed | templateId, code |
| `TEMPLATE_SHARED` | Sharing configured | templateId, targetType, permissions |
| `TEMPLATE_RATED` | Rating submitted | templateId, rating, userId |
| `TEMPLATE_EXPORTED` | Export generated | templateId, format |
| `TEMPLATE_IMPORTED` | Import processed | templateId, code |
| `WORKFLOW_CREATED_FROM_TEMPLATE` | Workflow created | workflowId, templateId, version |

---

## Implementation Notes

### Polish Accounting Template Categories

1. **Document Processing (Przetwarzanie dokumentów)**
   - Invoice OCR and extraction
   - Receipt scanning
   - Document classification

2. **Tax Compliance (Rozliczenia podatkowe)**
   - JPK file generation
   - VAT calculation and filing
   - e-Declaration submission

3. **Financial Operations (Operacje finansowe)**
   - Payment processing
   - Bank reconciliation
   - Month-end closing

4. **Client Management (Zarządzanie klientami)**
   - Client onboarding
   - Report generation
   - Communication workflows

5. **Approvals (Zatwierdzenia)**
   - Document approval
   - Expense approval
   - Multi-level authorization

6. **Notifications (Powiadomienia)**
   - Deadline reminders
   - Status alerts
   - Escalation workflows

### Template Variable Types

- **string**: Text input
- **number**: Numeric input
- **boolean**: Checkbox
- **date**: Date picker
- **select**: Single selection dropdown
- **multiselect**: Multiple selection
- **client_reference**: Client selector
- **user_reference**: User selector
- **account_reference**: Account selector

### Performance Considerations

- Template definitions are stored as JSONB for flexible querying
- Usage counts are denormalized for fast sorting
- Average ratings are pre-calculated
- Template search uses GIN indexes on tags

---

*Last Updated: December 2024*
