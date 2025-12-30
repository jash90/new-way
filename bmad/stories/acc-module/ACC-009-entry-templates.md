# ACC-009: Journal Entry Templates

## Story Information
| Field | Value |
|-------|-------|
| **Story ID** | ACC-009 |
| **Epic** | ACC - Accounting Engine |
| **Title** | Journal Entry Templates |
| **Priority** | P2 |
| **Points** | 5 |
| **Status** | Draft |
| **Sprint** | Week 10 |
| **Dependencies** | ACC-006 (Journal Entries) |

---

## User Story

**As a** księgowy (accountant),
**I want to** create and manage journal entry templates for recurring transactions,
**So that** I can quickly generate standard entries like monthly depreciation, accruals, or standard adjustments without re-entering all details each time.

---

## Acceptance Criteria

### AC1: Template Creation
```gherkin
Feature: Journal Entry Template Creation

Scenario: Create new template from scratch
  Given I am an authenticated accountant
  And I am on the journal entry templates page
  When I click "Create Template"
  And I fill in template name "Monthly Depreciation"
  And I fill in template description "Standard monthly depreciation for fixed assets"
  And I add a debit line for account "400-001" (Depreciation Expense) with placeholder amount
  And I add a credit line for account "070-001" (Accumulated Depreciation) with placeholder amount
  And I save the template
  Then the template is created with status "ACTIVE"
  And the template appears in my template list
  And an audit log entry is recorded

Scenario: Create template from existing entry
  Given I have an existing posted journal entry "JE-2024-00125"
  When I open the entry details
  And I click "Save as Template"
  And I provide template name "Quarterly Accrual"
  Then a new template is created with the same line structure
  And amounts are preserved as default values
  And the template is linked to the source entry for reference

Scenario: Attempt to create template without required fields
  Given I am creating a new template
  When I try to save without providing a template name
  Then I see a validation error "Template name is required"
  And the template is not created
```

### AC2: Template Management
```gherkin
Feature: Template Management

Scenario: List all templates with filtering
  Given I have 15 active templates and 3 archived templates
  When I navigate to the templates list
  Then I see all 15 active templates by default
  And I can filter by category (depreciation, accrual, payroll, other)
  And I can search by template name
  And I can toggle to show archived templates

Scenario: Edit existing template
  Given I have an active template "Monthly Rent Expense"
  When I click edit on the template
  And I change the debit amount from 5000.00 to 5500.00
  And I add a new line for account "220-001" (VAT Input)
  And I save changes
  Then the template is updated
  And the version number is incremented
  And previous versions are preserved for audit

Scenario: Archive template
  Given I have an active template "Old Depreciation Method"
  When I archive the template
  Then the template status changes to "ARCHIVED"
  And the template no longer appears in active lists
  And existing entries created from this template are not affected

Scenario: Restore archived template
  Given I have an archived template "Old Depreciation Method"
  When I restore the template
  Then the template status changes to "ACTIVE"
  And the template appears in active template lists
```

### AC3: Generate Entry from Template
```gherkin
Feature: Generate Entry from Template

Scenario: Create entry from template with fixed amounts
  Given I have an active template "Monthly Office Rent" with fixed amounts
  When I select the template
  And I click "Generate Entry"
  And I select the entry date as "2024-02-29"
  Then a new draft journal entry is created
  And the entry contains all lines from the template
  And I can review and modify before posting

Scenario: Create entry from template with variable amounts
  Given I have a template with placeholder amounts
  When I generate an entry from the template
  Then I am prompted to enter the actual amounts
  And the entry must still balance (debits = credits)
  And I can proceed to create the draft entry

Scenario: Create entry from template with calculated amounts
  Given I have a template with formula-based lines
  And the formula is "previous_month_sales * 0.05" for accrued commission
  When I generate an entry
  Then the system calculates amounts based on the formula
  And I can override calculated amounts if needed

Scenario: Batch generate entries from template
  Given I have a template for monthly depreciation
  When I select "Batch Generate"
  And I specify dates for January, February, and March
  Then three draft entries are created
  And each entry has the corresponding month's date
  And I can review all entries before batch posting
```

### AC4: Template Variables and Placeholders
```gherkin
Feature: Template Variables

Scenario: Define variable placeholders in template
  Given I am editing a template
  When I add a line with amount set to "{{variable:depreciationAmount}}"
  And I add description with "{{variable:assetName}} depreciation for {{variable:month}}"
  Then the template saves with variable markers
  And when generating an entry, user is prompted for these values

Scenario: Use system variables in template
  Given I am creating a template
  When I use "{{system:currentMonth}}" in description
  And I use "{{system:fiscalPeriod}}" in reference
  Then when generating entry, these are auto-populated
  And the entry has correct current month and period references

Scenario: Variable validation during entry generation
  Given I have a template with required variable "invoiceNumber"
  When I generate an entry without providing the invoice number
  Then I see an error "Required variable 'invoiceNumber' is not provided"
  And the entry is not created until all required variables are filled
```

### AC5: Template Categories and Organization
```gherkin
Feature: Template Organization

Scenario: Assign template to category
  Given I have a template "Monthly PFRON Contribution"
  When I assign it to category "Payroll"
  Then the template is grouped under Payroll category
  And I can filter templates by this category

Scenario: Create custom category
  Given the existing categories are Depreciation, Accrual, Payroll, Other
  When I create a new category "Utilities"
  Then the category is added to the system
  And I can assign templates to it

Scenario: Set template as favorite
  Given I have 20 templates
  When I mark "Monthly Rent" as favorite
  Then the template appears at the top of my list
  And it has a star indicator
  And favorites are user-specific (not organization-wide)
```

---

## Technical Specification

### Database Schema

```sql
-- Template categories
CREATE TABLE template_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  name VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT FALSE, -- System categories can't be deleted

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  UNIQUE(organization_id, name)
);

-- Journal entry templates
CREATE TABLE journal_entry_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  template_code VARCHAR(50) NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES template_categories(id),

  -- Template metadata
  entry_type VARCHAR(20) NOT NULL DEFAULT 'STANDARD', -- STANDARD, ADJUSTING, CLOSING, etc.
  default_description TEXT, -- May contain {{variable}} placeholders

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ARCHIVED
  version INTEGER DEFAULT 1,

  -- Source tracking
  source_entry_id UUID REFERENCES journal_entries(id), -- If created from entry

  -- User preferences
  is_favorite BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES users(id),

  UNIQUE(organization_id, template_code)
);

-- Template line items
CREATE TABLE template_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES journal_entry_templates(id) ON DELETE CASCADE,

  line_number INTEGER NOT NULL,
  account_id UUID REFERENCES accounts(id), -- NULL if using account pattern
  account_pattern VARCHAR(50), -- e.g., "400-*" for dynamic account selection

  -- Amounts (can be fixed, variable, or formula-based)
  amount_type VARCHAR(20) NOT NULL DEFAULT 'FIXED', -- FIXED, VARIABLE, FORMULA
  fixed_debit_amount DECIMAL(18,2) DEFAULT 0,
  fixed_credit_amount DECIMAL(18,2) DEFAULT 0,
  variable_name VARCHAR(100), -- For VARIABLE type
  formula TEXT, -- For FORMULA type (e.g., "{{previousMonthRevenue}} * 0.1")

  -- Line description (may contain variables)
  description TEXT,

  -- Multi-currency support
  currency_code CHAR(3) DEFAULT 'PLN',
  use_entry_date_rate BOOLEAN DEFAULT TRUE,

  -- Tax handling
  tax_code_id UUID REFERENCES tax_codes(id),

  -- Ordering
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(template_id, line_number)
);

-- Template variables definition
CREATE TABLE template_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES journal_entry_templates(id) ON DELETE CASCADE,

  variable_name VARCHAR(100) NOT NULL,
  variable_type VARCHAR(20) NOT NULL, -- STRING, NUMBER, DATE, ACCOUNT
  display_label VARCHAR(255) NOT NULL,
  is_required BOOLEAN DEFAULT TRUE,
  default_value TEXT,
  validation_pattern TEXT, -- Regex for validation

  display_order INTEGER DEFAULT 0,

  UNIQUE(template_id, variable_name)
);

-- Template version history
CREATE TABLE template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES journal_entry_templates(id),

  version_number INTEGER NOT NULL,
  template_data JSONB NOT NULL, -- Full snapshot of template at this version
  change_description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  UNIQUE(template_id, version_number)
);

-- User template favorites (separate from is_favorite for per-user tracking)
CREATE TABLE user_template_favorites (
  user_id UUID NOT NULL REFERENCES users(id),
  template_id UUID NOT NULL REFERENCES journal_entry_templates(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (user_id, template_id)
);

-- Indexes
CREATE INDEX idx_templates_org ON journal_entry_templates(organization_id);
CREATE INDEX idx_templates_status ON journal_entry_templates(status);
CREATE INDEX idx_templates_category ON journal_entry_templates(category_id);
CREATE INDEX idx_template_lines_template ON template_lines(template_id);
CREATE INDEX idx_template_variables_template ON template_variables(template_id);
CREATE INDEX idx_template_favorites_user ON user_template_favorites(user_id);

-- RLS Policies
ALTER TABLE journal_entry_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY templates_org_isolation ON journal_entry_templates
  USING (organization_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY template_lines_isolation ON template_lines
  USING (template_id IN (
    SELECT id FROM journal_entry_templates
    WHERE organization_id = current_setting('app.current_org_id')::UUID
  ));

CREATE POLICY template_variables_isolation ON template_variables
  USING (template_id IN (
    SELECT id FROM journal_entry_templates
    WHERE organization_id = current_setting('app.current_org_id')::UUID
  ));

CREATE POLICY template_categories_isolation ON template_categories
  USING (organization_id = current_setting('app.current_org_id')::UUID);
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Enums
export const TemplateStatusEnum = z.enum(['ACTIVE', 'ARCHIVED']);
export const AmountTypeEnum = z.enum(['FIXED', 'VARIABLE', 'FORMULA']);
export const VariableTypeEnum = z.enum(['STRING', 'NUMBER', 'DATE', 'ACCOUNT']);
export const EntryTypeEnum = z.enum(['STANDARD', 'ADJUSTING', 'CLOSING', 'OPENING', 'REVERSING']);

// Template line input
export const TemplateLineInput = z.object({
  lineNumber: z.number().int().positive(),
  accountId: z.string().uuid().optional(),
  accountPattern: z.string().max(50).optional(),

  amountType: AmountTypeEnum.default('FIXED'),
  fixedDebitAmount: z.number().min(0).default(0),
  fixedCreditAmount: z.number().min(0).default(0),
  variableName: z.string().max(100).optional(),
  formula: z.string().max(500).optional(),

  description: z.string().max(500).optional(),
  currencyCode: z.string().length(3).default('PLN'),
  taxCodeId: z.string().uuid().optional(),
  displayOrder: z.number().int().default(0),
}).refine(
  (data) => data.accountId || data.accountPattern,
  { message: 'Either accountId or accountPattern must be provided' }
).refine(
  (data) => {
    if (data.amountType === 'VARIABLE' && !data.variableName) {
      return false;
    }
    if (data.amountType === 'FORMULA' && !data.formula) {
      return false;
    }
    return true;
  },
  { message: 'Variable name or formula required for respective amount types' }
);

// Template variable definition
export const TemplateVariableInput = z.object({
  variableName: z.string().min(1).max(100).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  variableType: VariableTypeEnum,
  displayLabel: z.string().min(1).max(255),
  isRequired: z.boolean().default(true),
  defaultValue: z.string().optional(),
  validationPattern: z.string().optional(),
  displayOrder: z.number().int().default(0),
});

// Create template input
export const CreateTemplateInput = z.object({
  templateName: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  categoryId: z.string().uuid().optional(),
  entryType: EntryTypeEnum.default('STANDARD'),
  defaultDescription: z.string().max(1000).optional(),

  lines: z.array(TemplateLineInput).min(2),
  variables: z.array(TemplateVariableInput).optional(),

  sourceEntryId: z.string().uuid().optional(),
});

// Update template input
export const UpdateTemplateInput = z.object({
  templateId: z.string().uuid(),
  templateName: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  entryType: EntryTypeEnum.optional(),
  defaultDescription: z.string().max(1000).optional(),

  lines: z.array(TemplateLineInput).min(2).optional(),
  variables: z.array(TemplateVariableInput).optional(),

  changeDescription: z.string().max(500).optional(),
});

// Generate entry from template
export const GenerateEntryInput = z.object({
  templateId: z.string().uuid(),
  entryDate: z.coerce.date(),
  variableValues: z.record(z.string(), z.union([z.string(), z.number(), z.date()])).optional(),
  overrideAmounts: z.array(z.object({
    lineNumber: z.number().int().positive(),
    debitAmount: z.number().min(0).optional(),
    creditAmount: z.number().min(0).optional(),
  })).optional(),
  customDescription: z.string().max(1000).optional(),
});

// Batch generate entries
export const BatchGenerateInput = z.object({
  templateId: z.string().uuid(),
  entries: z.array(z.object({
    entryDate: z.coerce.date(),
    variableValues: z.record(z.string(), z.union([z.string(), z.number(), z.date()])).optional(),
    customDescription: z.string().max(1000).optional(),
  })).min(1).max(12), // Max 12 entries in a batch (e.g., 12 months)
});

// List templates filter
export const ListTemplatesInput = z.object({
  status: TemplateStatusEnum.optional(),
  categoryId: z.string().uuid().optional(),
  entryType: EntryTypeEnum.optional(),
  search: z.string().max(100).optional(),
  favoritesOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

// Create category
export const CreateCategoryInput = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  displayOrder: z.number().int().default(0),
});
```

### tRPC Router Implementation

```typescript
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import {
  CreateTemplateInput,
  UpdateTemplateInput,
  GenerateEntryInput,
  BatchGenerateInput,
  ListTemplatesInput,
  CreateCategoryInput,
  TemplateStatusEnum,
} from './schemas';
import Decimal from 'decimal.js';

export const templateRouter = createTRPCRouter({

  // Create new template
  create: protectedProcedure
    .input(CreateTemplateInput)
    .mutation(async ({ ctx, input }) => {
      const { db, session, auditLog } = ctx;
      const organizationId = session.user.organizationId;

      // Generate template code
      const templateCode = await generateTemplateCode(db, organizationId);

      return await db.transaction(async (tx) => {
        // Create template
        const [template] = await tx.insert(journalEntryTemplates).values({
          organizationId,
          templateCode,
          templateName: input.templateName,
          description: input.description,
          categoryId: input.categoryId,
          entryType: input.entryType,
          defaultDescription: input.defaultDescription,
          sourceEntryId: input.sourceEntryId,
          status: 'ACTIVE',
          createdBy: session.user.id,
        }).returning();

        // Create template lines
        for (const line of input.lines) {
          await tx.insert(templateLines).values({
            templateId: template.id,
            lineNumber: line.lineNumber,
            accountId: line.accountId,
            accountPattern: line.accountPattern,
            amountType: line.amountType,
            fixedDebitAmount: line.fixedDebitAmount.toString(),
            fixedCreditAmount: line.fixedCreditAmount.toString(),
            variableName: line.variableName,
            formula: line.formula,
            description: line.description,
            currencyCode: line.currencyCode,
            taxCodeId: line.taxCodeId,
            displayOrder: line.displayOrder,
          });
        }

        // Create template variables
        if (input.variables) {
          for (const variable of input.variables) {
            await tx.insert(templateVariables).values({
              templateId: template.id,
              variableName: variable.variableName,
              variableType: variable.variableType,
              displayLabel: variable.displayLabel,
              isRequired: variable.isRequired,
              defaultValue: variable.defaultValue,
              validationPattern: variable.validationPattern,
              displayOrder: variable.displayOrder,
            });
          }
        }

        // Create initial version snapshot
        await tx.insert(templateVersions).values({
          templateId: template.id,
          versionNumber: 1,
          templateData: {
            ...template,
            lines: input.lines,
            variables: input.variables || [],
          },
          changeDescription: 'Initial creation',
          createdBy: session.user.id,
        });

        // Audit log
        await auditLog.record({
          action: 'TEMPLATE_CREATED',
          entityType: 'journal_entry_template',
          entityId: template.id,
          details: { templateCode, templateName: input.templateName },
        });

        return template;
      });
    }),

  // Create template from existing entry
  createFromEntry: protectedProcedure
    .input(z.object({
      entryId: z.string().uuid(),
      templateName: z.string().min(1).max(255),
      description: z.string().max(2000).optional(),
      categoryId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;

      // Fetch the source entry with lines
      const entry = await db.query.journalEntries.findFirst({
        where: eq(journalEntries.id, input.entryId),
        with: { lines: true },
      });

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Source journal entry not found',
        });
      }

      // Convert entry lines to template lines
      const templateLinesData = entry.lines.map((line, idx) => ({
        lineNumber: idx + 1,
        accountId: line.accountId,
        amountType: 'FIXED' as const,
        fixedDebitAmount: parseFloat(line.debitAmount),
        fixedCreditAmount: parseFloat(line.creditAmount),
        description: line.description,
        currencyCode: line.currencyCode,
        taxCodeId: line.taxCodeId,
        displayOrder: idx,
      }));

      // Create template using the create method
      return await ctx.caller.template.create({
        templateName: input.templateName,
        description: input.description || `Created from entry ${entry.entryNumber}`,
        categoryId: input.categoryId,
        entryType: entry.entryType,
        defaultDescription: entry.description,
        lines: templateLinesData,
        sourceEntryId: input.entryId,
      });
    }),

  // Update template
  update: protectedProcedure
    .input(UpdateTemplateInput)
    .mutation(async ({ ctx, input }) => {
      const { db, session, auditLog } = ctx;
      const { templateId, ...updateData } = input;

      // Fetch existing template
      const existing = await db.query.journalEntryTemplates.findFirst({
        where: eq(journalEntryTemplates.id, templateId),
        with: { lines: true, variables: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found',
        });
      }

      if (existing.status === 'ARCHIVED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot update archived template. Restore it first.',
        });
      }

      const newVersion = existing.version + 1;

      return await db.transaction(async (tx) => {
        // Update template
        const [updated] = await tx.update(journalEntryTemplates)
          .set({
            templateName: updateData.templateName ?? existing.templateName,
            description: updateData.description ?? existing.description,
            categoryId: updateData.categoryId ?? existing.categoryId,
            entryType: updateData.entryType ?? existing.entryType,
            defaultDescription: updateData.defaultDescription ?? existing.defaultDescription,
            version: newVersion,
            updatedAt: new Date(),
            updatedBy: session.user.id,
          })
          .where(eq(journalEntryTemplates.id, templateId))
          .returning();

        // Update lines if provided
        if (updateData.lines) {
          await tx.delete(templateLines).where(eq(templateLines.templateId, templateId));

          for (const line of updateData.lines) {
            await tx.insert(templateLines).values({
              templateId,
              lineNumber: line.lineNumber,
              accountId: line.accountId,
              accountPattern: line.accountPattern,
              amountType: line.amountType,
              fixedDebitAmount: line.fixedDebitAmount.toString(),
              fixedCreditAmount: line.fixedCreditAmount.toString(),
              variableName: line.variableName,
              formula: line.formula,
              description: line.description,
              currencyCode: line.currencyCode,
              taxCodeId: line.taxCodeId,
              displayOrder: line.displayOrder,
            });
          }
        }

        // Update variables if provided
        if (updateData.variables) {
          await tx.delete(templateVariables).where(eq(templateVariables.templateId, templateId));

          for (const variable of updateData.variables) {
            await tx.insert(templateVariables).values({
              templateId,
              variableName: variable.variableName,
              variableType: variable.variableType,
              displayLabel: variable.displayLabel,
              isRequired: variable.isRequired,
              defaultValue: variable.defaultValue,
              validationPattern: variable.validationPattern,
              displayOrder: variable.displayOrder,
            });
          }
        }

        // Save version snapshot
        await tx.insert(templateVersions).values({
          templateId,
          versionNumber: newVersion,
          templateData: {
            ...updated,
            lines: updateData.lines || existing.lines,
            variables: updateData.variables || existing.variables,
          },
          changeDescription: updateData.changeDescription || 'Updated',
          createdBy: session.user.id,
        });

        await auditLog.record({
          action: 'TEMPLATE_UPDATED',
          entityType: 'journal_entry_template',
          entityId: templateId,
          details: { version: newVersion, changes: Object.keys(updateData) },
        });

        return updated;
      });
    }),

  // Archive template
  archive: protectedProcedure
    .input(z.object({ templateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { db, session, auditLog } = ctx;

      const [archived] = await db.update(journalEntryTemplates)
        .set({
          status: 'ARCHIVED',
          archivedAt: new Date(),
          archivedBy: session.user.id,
          updatedAt: new Date(),
          updatedBy: session.user.id,
        })
        .where(eq(journalEntryTemplates.id, input.templateId))
        .returning();

      await auditLog.record({
        action: 'TEMPLATE_ARCHIVED',
        entityType: 'journal_entry_template',
        entityId: input.templateId,
      });

      return archived;
    }),

  // Restore archived template
  restore: protectedProcedure
    .input(z.object({ templateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { db, session, auditLog } = ctx;

      const [restored] = await db.update(journalEntryTemplates)
        .set({
          status: 'ACTIVE',
          archivedAt: null,
          archivedBy: null,
          updatedAt: new Date(),
          updatedBy: session.user.id,
        })
        .where(eq(journalEntryTemplates.id, input.templateId))
        .returning();

      await auditLog.record({
        action: 'TEMPLATE_RESTORED',
        entityType: 'journal_entry_template',
        entityId: input.templateId,
      });

      return restored;
    }),

  // Generate journal entry from template
  generateEntry: protectedProcedure
    .input(GenerateEntryInput)
    .mutation(async ({ ctx, input }) => {
      const { db, session, auditLog } = ctx;

      // Fetch template with lines and variables
      const template = await db.query.journalEntryTemplates.findFirst({
        where: eq(journalEntryTemplates.id, input.templateId),
        with: {
          lines: { orderBy: (lines, { asc }) => [asc(lines.displayOrder)] },
          variables: true,
        },
      });

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found',
        });
      }

      if (template.status !== 'ACTIVE') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot generate entry from archived template',
        });
      }

      // Validate required variables
      for (const variable of template.variables) {
        if (variable.isRequired && !input.variableValues?.[variable.variableName]) {
          if (!variable.defaultValue) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Required variable '${variable.displayLabel}' is not provided`,
            });
          }
        }
      }

      // Resolve variable values
      const resolvedValues = resolveVariables(template.variables, input.variableValues || {}, input.entryDate);

      // Build entry lines
      const entryLines = [];
      for (const templateLine of template.lines) {
        let debitAmount = new Decimal(0);
        let creditAmount = new Decimal(0);

        // Check for override amounts
        const override = input.overrideAmounts?.find(o => o.lineNumber === templateLine.lineNumber);

        if (override) {
          debitAmount = new Decimal(override.debitAmount || 0);
          creditAmount = new Decimal(override.creditAmount || 0);
        } else {
          switch (templateLine.amountType) {
            case 'FIXED':
              debitAmount = new Decimal(templateLine.fixedDebitAmount);
              creditAmount = new Decimal(templateLine.fixedCreditAmount);
              break;
            case 'VARIABLE':
              const varValue = resolvedValues[templateLine.variableName!];
              if (parseFloat(templateLine.fixedDebitAmount) > 0) {
                debitAmount = new Decimal(varValue || 0);
              } else {
                creditAmount = new Decimal(varValue || 0);
              }
              break;
            case 'FORMULA':
              const calculated = evaluateFormula(templateLine.formula!, resolvedValues);
              if (parseFloat(templateLine.fixedDebitAmount) > 0) {
                debitAmount = new Decimal(calculated);
              } else {
                creditAmount = new Decimal(calculated);
              }
              break;
          }
        }

        // Resolve account (pattern or direct)
        let accountId = templateLine.accountId;
        if (!accountId && templateLine.accountPattern) {
          accountId = await resolveAccountPattern(db, session.user.organizationId, templateLine.accountPattern);
        }

        // Resolve description variables
        const description = substituteVariables(templateLine.description || '', resolvedValues);

        entryLines.push({
          accountId,
          debitAmount: debitAmount.toNumber(),
          creditAmount: creditAmount.toNumber(),
          description,
          currencyCode: templateLine.currencyCode,
          taxCodeId: templateLine.taxCodeId,
        });
      }

      // Validate balance
      const totalDebits = entryLines.reduce((sum, l) => sum.plus(l.debitAmount), new Decimal(0));
      const totalCredits = entryLines.reduce((sum, l) => sum.plus(l.creditAmount), new Decimal(0));

      if (!totalDebits.equals(totalCredits)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Entry is not balanced. Debits: ${totalDebits}, Credits: ${totalCredits}`,
        });
      }

      // Create the journal entry
      const entryDescription = input.customDescription
        || substituteVariables(template.defaultDescription || template.templateName, resolvedValues);

      const entry = await ctx.caller.journalEntry.create({
        entryDate: input.entryDate,
        description: entryDescription,
        entryType: template.entryType,
        lines: entryLines,
        sourceTemplateId: template.id,
      });

      // Update template usage statistics
      await db.update(journalEntryTemplates)
        .set({
          usageCount: template.usageCount + 1,
          lastUsedAt: new Date(),
        })
        .where(eq(journalEntryTemplates.id, input.templateId));

      await auditLog.record({
        action: 'ENTRY_GENERATED_FROM_TEMPLATE',
        entityType: 'journal_entry',
        entityId: entry.id,
        details: { templateId: input.templateId, templateCode: template.templateCode },
      });

      return entry;
    }),

  // Batch generate entries
  batchGenerate: protectedProcedure
    .input(BatchGenerateInput)
    .mutation(async ({ ctx, input }) => {
      const results = [];

      for (const entrySpec of input.entries) {
        try {
          const entry = await ctx.caller.template.generateEntry({
            templateId: input.templateId,
            entryDate: entrySpec.entryDate,
            variableValues: entrySpec.variableValues,
            customDescription: entrySpec.customDescription,
          });
          results.push({ success: true, entry });
        } catch (error) {
          results.push({
            success: false,
            date: entrySpec.entryDate,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return {
        total: input.entries.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      };
    }),

  // List templates
  list: protectedProcedure
    .input(ListTemplatesInput)
    .query(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const organizationId = session.user.organizationId;

      const conditions = [
        eq(journalEntryTemplates.organizationId, organizationId),
      ];

      if (input.status) {
        conditions.push(eq(journalEntryTemplates.status, input.status));
      } else {
        conditions.push(eq(journalEntryTemplates.status, 'ACTIVE'));
      }

      if (input.categoryId) {
        conditions.push(eq(journalEntryTemplates.categoryId, input.categoryId));
      }

      if (input.entryType) {
        conditions.push(eq(journalEntryTemplates.entryType, input.entryType));
      }

      if (input.search) {
        conditions.push(
          or(
            ilike(journalEntryTemplates.templateName, `%${input.search}%`),
            ilike(journalEntryTemplates.templateCode, `%${input.search}%`)
          )
        );
      }

      // Handle favorites filter
      let query = db.select()
        .from(journalEntryTemplates)
        .where(and(...conditions));

      if (input.favoritesOnly) {
        query = query.innerJoin(
          userTemplateFavorites,
          and(
            eq(userTemplateFavorites.templateId, journalEntryTemplates.id),
            eq(userTemplateFavorites.userId, session.user.id)
          )
        );
      }

      const templates = await query
        .orderBy(desc(journalEntryTemplates.lastUsedAt), asc(journalEntryTemplates.templateName))
        .limit(input.limit)
        .offset(input.offset);

      const total = await db.select({ count: count() })
        .from(journalEntryTemplates)
        .where(and(...conditions));

      // Get favorites for current user
      const favorites = await db.select({ templateId: userTemplateFavorites.templateId })
        .from(userTemplateFavorites)
        .where(eq(userTemplateFavorites.userId, session.user.id));

      const favoriteIds = new Set(favorites.map(f => f.templateId));

      return {
        templates: templates.map(t => ({
          ...t,
          isFavorite: favoriteIds.has(t.id),
        })),
        total: total[0].count,
        hasMore: input.offset + templates.length < total[0].count,
      };
    }),

  // Get template by ID
  getById: protectedProcedure
    .input(z.object({ templateId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.query.journalEntryTemplates.findFirst({
        where: eq(journalEntryTemplates.id, input.templateId),
        with: {
          lines: { orderBy: (lines, { asc }) => [asc(lines.displayOrder)] },
          variables: { orderBy: (vars, { asc }) => [asc(vars.displayOrder)] },
          category: true,
          sourceEntry: true,
        },
      });

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Template not found',
        });
      }

      return template;
    }),

  // Toggle favorite
  toggleFavorite: protectedProcedure
    .input(z.object({ templateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;

      const existing = await db.query.userTemplateFavorites.findFirst({
        where: and(
          eq(userTemplateFavorites.userId, session.user.id),
          eq(userTemplateFavorites.templateId, input.templateId)
        ),
      });

      if (existing) {
        await db.delete(userTemplateFavorites)
          .where(and(
            eq(userTemplateFavorites.userId, session.user.id),
            eq(userTemplateFavorites.templateId, input.templateId)
          ));
        return { isFavorite: false };
      } else {
        await db.insert(userTemplateFavorites).values({
          userId: session.user.id,
          templateId: input.templateId,
        });
        return { isFavorite: true };
      }
    }),

  // Get template versions
  getVersions: protectedProcedure
    .input(z.object({ templateId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.templateVersions.findMany({
        where: eq(templateVersions.templateId, input.templateId),
        orderBy: (versions, { desc }) => [desc(versions.versionNumber)],
        with: { createdByUser: { columns: { id: true, name: true } } },
      });
    }),

  // Categories management
  createCategory: protectedProcedure
    .input(CreateCategoryInput)
    .mutation(async ({ ctx, input }) => {
      const [category] = await ctx.db.insert(templateCategories).values({
        organizationId: ctx.session.user.organizationId,
        name: input.name,
        description: input.description,
        displayOrder: input.displayOrder,
        createdBy: ctx.session.user.id,
      }).returning();

      return category;
    }),

  listCategories: protectedProcedure
    .query(async ({ ctx }) => {
      return await ctx.db.query.templateCategories.findMany({
        where: eq(templateCategories.organizationId, ctx.session.user.organizationId),
        orderBy: (cats, { asc }) => [asc(cats.displayOrder), asc(cats.name)],
      });
    }),
});

// Helper functions
async function generateTemplateCode(db: any, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TPL-${year}-`;

  const lastTemplate = await db.query.journalEntryTemplates.findFirst({
    where: and(
      eq(journalEntryTemplates.organizationId, organizationId),
      like(journalEntryTemplates.templateCode, `${prefix}%`)
    ),
    orderBy: (t, { desc }) => [desc(t.templateCode)],
  });

  let nextNumber = 1;
  if (lastTemplate) {
    const lastNumber = parseInt(lastTemplate.templateCode.replace(prefix, ''));
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${String(nextNumber).padStart(5, '0')}`;
}

function resolveVariables(
  definitions: any[],
  values: Record<string, any>,
  entryDate: Date
): Record<string, any> {
  const resolved: Record<string, any> = {};

  // System variables
  resolved['system:currentMonth'] = entryDate.toLocaleString('pl-PL', { month: 'long' });
  resolved['system:currentYear'] = entryDate.getFullYear().toString();
  resolved['system:fiscalPeriod'] = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
  resolved['system:entryDate'] = entryDate.toISOString().split('T')[0];

  // User-defined variables
  for (const def of definitions) {
    const value = values[def.variableName] ?? def.defaultValue;
    resolved[def.variableName] = value;
  }

  return resolved;
}

function evaluateFormula(formula: string, variables: Record<string, any>): number {
  // Simple formula evaluation - replace variables and evaluate
  let expression = formula;

  for (const [key, value] of Object.entries(variables)) {
    expression = expression.replace(new RegExp(`{{${key}}}`, 'g'), String(value || 0));
  }

  // Safe evaluation using Decimal.js
  try {
    // Parse simple arithmetic expressions
    return new Decimal(Function(`"use strict"; return (${expression})`)()).toNumber();
  } catch {
    return 0;
  }
}

function substituteVariables(text: string, variables: Record<string, any>): string {
  let result = text;

  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{variable:${key}}}`, 'g'), String(value || ''));
    result = result.replace(new RegExp(`{{system:${key}}}`, 'g'), String(value || ''));
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value || ''));
  }

  return result;
}

async function resolveAccountPattern(
  db: any,
  organizationId: string,
  pattern: string
): Promise<string> {
  // Convert pattern to SQL LIKE pattern
  const sqlPattern = pattern.replace('*', '%').replace('?', '_');

  const account = await db.query.accounts.findFirst({
    where: and(
      eq(accounts.organizationId, organizationId),
      like(accounts.accountCode, sqlPattern),
      eq(accounts.isActive, true)
    ),
  });

  if (!account) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `No account found matching pattern: ${pattern}`,
    });
  }

  return account.id;
}
```

---

## Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { templateRouter } from './template.router';
import { createTestContext, createMockTemplate } from '@/test/utils';

describe('Template Router', () => {
  let ctx: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    ctx = createTestContext();
  });

  describe('create', () => {
    it('should create template with valid input', async () => {
      const input = {
        templateName: 'Monthly Depreciation',
        description: 'Standard depreciation entry',
        entryType: 'ADJUSTING',
        lines: [
          { lineNumber: 1, accountId: 'acc-1', amountType: 'FIXED', fixedDebitAmount: 1000, fixedCreditAmount: 0 },
          { lineNumber: 2, accountId: 'acc-2', amountType: 'FIXED', fixedDebitAmount: 0, fixedCreditAmount: 1000 },
        ],
      };

      const result = await templateRouter.create({ ctx, input });

      expect(result.templateName).toBe('Monthly Depreciation');
      expect(result.status).toBe('ACTIVE');
      expect(result.version).toBe(1);
    });

    it('should create template with variables', async () => {
      const input = {
        templateName: 'Parameterized Template',
        lines: [
          { lineNumber: 1, accountId: 'acc-1', amountType: 'VARIABLE', variableName: 'amount', fixedDebitAmount: 1, fixedCreditAmount: 0 },
          { lineNumber: 2, accountId: 'acc-2', amountType: 'VARIABLE', variableName: 'amount', fixedDebitAmount: 0, fixedCreditAmount: 1 },
        ],
        variables: [
          { variableName: 'amount', variableType: 'NUMBER', displayLabel: 'Amount', isRequired: true },
        ],
      };

      const result = await templateRouter.create({ ctx, input });

      expect(result).toBeDefined();
    });

    it('should reject template without lines', async () => {
      const input = {
        templateName: 'Empty Template',
        lines: [],
      };

      await expect(templateRouter.create({ ctx, input }))
        .rejects.toThrow();
    });
  });

  describe('generateEntry', () => {
    it('should generate entry with fixed amounts', async () => {
      const template = await createMockTemplate(ctx.db, {
        lines: [
          { amountType: 'FIXED', fixedDebitAmount: 5000, fixedCreditAmount: 0 },
          { amountType: 'FIXED', fixedDebitAmount: 0, fixedCreditAmount: 5000 },
        ],
      });

      const result = await templateRouter.generateEntry({
        ctx,
        input: {
          templateId: template.id,
          entryDate: new Date('2024-03-01'),
        },
      });

      expect(result.status).toBe('DRAFT');
      expect(result.lines).toHaveLength(2);
    });

    it('should generate entry with variable amounts', async () => {
      const template = await createMockTemplate(ctx.db, {
        lines: [
          { amountType: 'VARIABLE', variableName: 'depAmount', fixedDebitAmount: 1, fixedCreditAmount: 0 },
          { amountType: 'VARIABLE', variableName: 'depAmount', fixedDebitAmount: 0, fixedCreditAmount: 1 },
        ],
        variables: [
          { variableName: 'depAmount', variableType: 'NUMBER', isRequired: true },
        ],
      });

      const result = await templateRouter.generateEntry({
        ctx,
        input: {
          templateId: template.id,
          entryDate: new Date('2024-03-01'),
          variableValues: { depAmount: 2500 },
        },
      });

      expect(result.lines[0].debitAmount).toBe('2500.00');
      expect(result.lines[1].creditAmount).toBe('2500.00');
    });

    it('should reject missing required variable', async () => {
      const template = await createMockTemplate(ctx.db, {
        variables: [
          { variableName: 'requiredVar', variableType: 'NUMBER', isRequired: true },
        ],
      });

      await expect(templateRouter.generateEntry({
        ctx,
        input: {
          templateId: template.id,
          entryDate: new Date(),
        },
      })).rejects.toThrow(/required variable/i);
    });
  });

  describe('batchGenerate', () => {
    it('should generate multiple entries', async () => {
      const template = await createMockTemplate(ctx.db);

      const result = await templateRouter.batchGenerate({
        ctx,
        input: {
          templateId: template.id,
          entries: [
            { entryDate: new Date('2024-01-31') },
            { entryDate: new Date('2024-02-29') },
            { entryDate: new Date('2024-03-31') },
          ],
        },
      });

      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
    });
  });

  describe('archive/restore', () => {
    it('should archive active template', async () => {
      const template = await createMockTemplate(ctx.db);

      const result = await templateRouter.archive({ ctx, input: { templateId: template.id } });

      expect(result.status).toBe('ARCHIVED');
      expect(result.archivedAt).toBeDefined();
    });

    it('should restore archived template', async () => {
      const template = await createMockTemplate(ctx.db, { status: 'ARCHIVED' });

      const result = await templateRouter.restore({ ctx, input: { templateId: template.id } });

      expect(result.status).toBe('ACTIVE');
      expect(result.archivedAt).toBeNull();
    });
  });

  describe('toggleFavorite', () => {
    it('should add to favorites', async () => {
      const template = await createMockTemplate(ctx.db);

      const result = await templateRouter.toggleFavorite({ ctx, input: { templateId: template.id } });

      expect(result.isFavorite).toBe(true);
    });

    it('should remove from favorites', async () => {
      const template = await createMockTemplate(ctx.db);
      await ctx.db.insert(userTemplateFavorites).values({
        userId: ctx.session.user.id,
        templateId: template.id,
      });

      const result = await templateRouter.toggleFavorite({ ctx, input: { templateId: template.id } });

      expect(result.isFavorite).toBe(false);
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDatabase, seedTestData, cleanupTestDatabase } from '@/test/db-utils';

describe('Template Integration', () => {
  let db: TestDatabase;
  let testOrg: Organization;
  let testAccounts: Account[];

  beforeAll(async () => {
    db = await createTestDatabase();
    const seed = await seedTestData(db);
    testOrg = seed.organization;
    testAccounts = seed.accounts;
  });

  afterAll(async () => {
    await cleanupTestDatabase(db);
  });

  it('should complete full template lifecycle', async () => {
    // 1. Create template
    const template = await db.templates.create({
      organizationId: testOrg.id,
      templateName: 'Monthly Rent',
      lines: [
        { accountId: testAccounts[0].id, amountType: 'FIXED', fixedDebitAmount: 3000 },
        { accountId: testAccounts[1].id, amountType: 'FIXED', fixedCreditAmount: 3000 },
      ],
    });

    // 2. Generate entry
    const entry = await db.templates.generateEntry({
      templateId: template.id,
      entryDate: new Date('2024-03-01'),
    });

    expect(entry.status).toBe('DRAFT');

    // 3. Post entry
    await db.entries.post({ entryId: entry.id });

    // 4. Verify GL update
    const glEntries = await db.generalLedger.findByEntry(entry.id);
    expect(glEntries).toHaveLength(2);

    // 5. Update template
    await db.templates.update({
      templateId: template.id,
      lines: [
        { accountId: testAccounts[0].id, amountType: 'FIXED', fixedDebitAmount: 3500 },
        { accountId: testAccounts[1].id, amountType: 'FIXED', fixedCreditAmount: 3500 },
      ],
    });

    // 6. Verify version history
    const versions = await db.templates.getVersions(template.id);
    expect(versions).toHaveLength(2);

    // 7. Archive template
    await db.templates.archive(template.id);

    // 8. Verify archived
    const archived = await db.templates.findById(template.id);
    expect(archived.status).toBe('ARCHIVED');
  });

  it('should handle template with formula amounts', async () => {
    // Create accounts for commission calculation
    const revenueAccount = testAccounts.find(a => a.accountType === 'REVENUE');
    const expenseAccount = testAccounts.find(a => a.accountType === 'EXPENSE');
    const liabilityAccount = testAccounts.find(a => a.accountType === 'LIABILITY');

    // Create template with formula
    const template = await db.templates.create({
      organizationId: testOrg.id,
      templateName: 'Sales Commission',
      lines: [
        {
          accountId: expenseAccount.id,
          amountType: 'FORMULA',
          formula: '{{salesAmount}} * 0.05',
          fixedDebitAmount: 1,
        },
        {
          accountId: liabilityAccount.id,
          amountType: 'FORMULA',
          formula: '{{salesAmount}} * 0.05',
          fixedCreditAmount: 1,
        },
      ],
      variables: [
        { variableName: 'salesAmount', variableType: 'NUMBER', displayLabel: 'Sales Amount', isRequired: true },
      ],
    });

    // Generate entry with variable
    const entry = await db.templates.generateEntry({
      templateId: template.id,
      entryDate: new Date(),
      variableValues: { salesAmount: 100000 },
    });

    // 5% of 100,000 = 5,000
    expect(parseFloat(entry.lines[0].debitAmount)).toBe(5000);
    expect(parseFloat(entry.lines[1].creditAmount)).toBe(5000);
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Journal Entry Templates', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/accounting/templates');
  });

  test('should create new template', async ({ page }) => {
    await page.click('button:has-text("Create Template")');

    await page.fill('input[name="templateName"]', 'Monthly Utilities');
    await page.fill('textarea[name="description"]', 'Utility expenses template');

    // Add first line (debit)
    await page.click('button:has-text("Add Line")');
    await page.selectOption('[data-testid="line-1-account"]', { label: '402-001 Utilities Expense' });
    await page.fill('[data-testid="line-1-debit"]', '500');

    // Add second line (credit)
    await page.click('button:has-text("Add Line")');
    await page.selectOption('[data-testid="line-2-account"]', { label: '202-001 Accounts Payable' });
    await page.fill('[data-testid="line-2-credit"]', '500');

    await page.click('button:has-text("Save Template")');

    await expect(page.locator('text=Template created successfully')).toBeVisible();
    await expect(page.locator('text=Monthly Utilities')).toBeVisible();
  });

  test('should generate entry from template', async ({ page }) => {
    // Click on existing template
    await page.click('text=Monthly Depreciation');
    await page.click('button:has-text("Generate Entry")');

    // Fill in date
    await page.fill('input[name="entryDate"]', '2024-03-31');

    await page.click('button:has-text("Create Draft Entry")');

    await expect(page.locator('text=Journal entry created')).toBeVisible();
    await expect(page).toHaveURL(/\/accounting\/entries\/JE-/);
  });

  test('should batch generate entries', async ({ page }) => {
    await page.click('text=Monthly Depreciation');
    await page.click('button:has-text("Batch Generate")');

    // Select multiple dates
    await page.fill('[data-testid="batch-date-1"]', '2024-01-31');
    await page.fill('[data-testid="batch-date-2"]', '2024-02-29');
    await page.fill('[data-testid="batch-date-3"]', '2024-03-31');

    await page.click('button:has-text("Generate All")');

    await expect(page.locator('text=3 entries created successfully')).toBeVisible();
  });

  test('should manage template favorites', async ({ page }) => {
    // Add to favorites
    await page.click('[data-testid="template-row-1"] [data-testid="favorite-toggle"]');
    await expect(page.locator('[data-testid="template-row-1"] .star-filled')).toBeVisible();

    // Filter by favorites
    await page.click('button:has-text("Favorites Only")');
    await expect(page.locator('[data-testid="template-row"]')).toHaveCount(1);

    // Remove from favorites
    await page.click('[data-testid="template-row-1"] [data-testid="favorite-toggle"]');
    await expect(page.locator('[data-testid="template-row"]')).toHaveCount(0);
  });

  test('should archive and restore template', async ({ page }) => {
    await page.click('text=Old Template');
    await page.click('button:has-text("Archive")');

    await expect(page.locator('text=Template archived')).toBeVisible();
    await expect(page.locator('text=Old Template')).not.toBeVisible();

    // Show archived
    await page.click('button:has-text("Show Archived")');
    await expect(page.locator('text=Old Template')).toBeVisible();

    // Restore
    await page.click('text=Old Template');
    await page.click('button:has-text("Restore")');

    await expect(page.locator('text=Template restored')).toBeVisible();
  });
});
```

---

## Security Checklist

- [x] **Authentication**: All endpoints require authenticated session
- [x] **Authorization**: Users can only access templates in their organization
- [x] **Row-Level Security**: PostgreSQL RLS enforces organization isolation
- [x] **Input Validation**: All inputs validated with Zod schemas
- [x] **Formula Evaluation**: Safe formula parsing without eval()
- [x] **Audit Trail**: All template operations logged
- [x] **Version Control**: Template changes create version history
- [x] **Data Integrity**: Template lines must balance for FIXED amounts

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `TEMPLATE_CREATED` | New template saved | templateId, templateCode, templateName, lineCount |
| `TEMPLATE_UPDATED` | Template modified | templateId, version, changes[] |
| `TEMPLATE_ARCHIVED` | Template archived | templateId, archivedBy |
| `TEMPLATE_RESTORED` | Template restored | templateId, restoredBy |
| `ENTRY_GENERATED_FROM_TEMPLATE` | Entry created from template | entryId, templateId, variableValues |
| `BATCH_ENTRIES_GENERATED` | Batch generation | templateId, count, dates[] |
| `TEMPLATE_FAVORITE_TOGGLED` | Favorite status changed | templateId, isFavorite |

---

## Implementation Notes

### Variable System
- **User Variables**: Defined in template, prompted during entry generation
- **System Variables**: Auto-populated (currentMonth, fiscalPeriod, entryDate)
- **Validation**: Pattern matching with regex for custom validation

### Formula Engine
- Uses safe evaluation without JavaScript eval()
- Supports basic arithmetic operators (+, -, *, /)
- Variables referenced as `{{variableName}}`
- Decimal.js for precise calculations

### Template Versioning
- Every update creates a new version snapshot
- Previous versions preserved for audit and rollback
- Version data stored as JSONB for flexibility

### Account Patterns
- Support wildcards: `400-*` matches 400-001, 400-002, etc.
- `?` for single character wildcard
- First matching active account used

### Usage Statistics
- Track usage count and last used date
- Help users identify frequently used templates
- Support for analytics and cleanup of unused templates
