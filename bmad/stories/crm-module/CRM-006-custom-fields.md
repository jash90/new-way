# CRM-006: Custom Fields System

> **Story ID**: CRM-006
> **Epic**: Core CRM Module (CRM)
> **Priority**: P2
> **Story Points**: 5
> **Status**: 📋 Ready for Development
> **Phase**: Week 6

---

## User Story

**As an** accountant,
**I want to** define flexible custom fields for clients,
**So that** I can store industry-specific data that isn't covered by standard fields.

---

## Acceptance Criteria

### AC1: Custom Field Definition

```gherkin
Feature: Custom Field Definition
  As an accountant
  I want to define custom fields for my organization
  So that I can capture industry-specific client data

  Scenario: Create text custom field
    Given I am an admin user
    When I create a custom field with:
      | Property | Value |
      | name | contract_type |
      | label | Typ umowy |
      | type | TEXT |
      | required | false |
      | maxLength | 100 |
    Then the field should be available for all clients
    And it should appear in the client edit form

  Scenario: Create dropdown custom field
    Given I am an admin user
    When I create a custom field with:
      | Property | Value |
      | name | industry_sector |
      | label | Branża |
      | type | SELECT |
      | options | ["IT", "Handel", "Produkcja", "Usługi", "Inne"] |
    Then clients should be able to select from the predefined options

  Scenario: Create multi-select custom field
    Given I am an admin user
    When I create a custom field with:
      | Property | Value |
      | name | services_used |
      | label | Usługi |
      | type | MULTISELECT |
      | options | ["Księgowość", "Kadry", "VAT", "CIT", "Doradztwo"] |
    Then clients should be able to select multiple options

  Scenario: Create date custom field
    Given I am an admin user
    When I create a custom field with:
      | Property | Value |
      | name | contract_end_date |
      | label | Data końca umowy |
      | type | DATE |
    Then the field should show a date picker

  Scenario: Create number custom field with validation
    Given I am an admin user
    When I create a custom field with:
      | Property | Value |
      | name | monthly_fee |
      | label | Miesięczna opłata |
      | type | NUMBER |
      | min | 0 |
      | max | 100000 |
      | decimalPlaces | 2 |
      | unit | PLN |
    Then the field should validate numeric input
    And it should display the unit suffix
```

### AC2: Field Types Support

```gherkin
Feature: Field Types
  As an accountant
  I want various field types available
  So that I can capture different data formats

  Scenario Outline: Supported field types
    Given I am creating a custom field
    When I select type "<type>"
    Then I should see configuration options for "<options>"
    And the field should render as "<component>"

    Examples:
      | type | options | component |
      | TEXT | maxLength, placeholder, pattern | text input |
      | TEXTAREA | maxLength, rows | textarea |
      | NUMBER | min, max, decimalPlaces, unit | number input |
      | DATE | minDate, maxDate | date picker |
      | DATETIME | minDate, maxDate | datetime picker |
      | SELECT | options | dropdown |
      | MULTISELECT | options, maxSelections | multi-select |
      | CHECKBOX | defaultValue | checkbox |
      | EMAIL | - | email input |
      | PHONE | - | phone input |
      | URL | - | URL input |
      | CURRENCY | currency, min, max | currency input |
```

### AC3: Field Configuration

```gherkin
Feature: Field Configuration
  As an admin
  I want to configure field behavior
  So that I can control how data is collected

  Scenario: Set field as required
    Given a custom field "contract_number" exists
    When I mark it as required
    Then clients cannot be saved without this field
    And the field should show a required indicator (*)

  Scenario: Set field visibility
    Given a custom field exists
    When I set visibility to "INTERNAL"
    Then the field should not be visible in the client portal
    And it should be visible to internal users

  Scenario: Set field order
    Given multiple custom fields exist
    When I drag "contract_end_date" above "contract_type"
    Then the fields should display in the new order

  Scenario: Group fields by category
    Given multiple custom fields exist
    When I assign "contract_type" and "contract_end_date" to group "Umowa"
    Then these fields should be displayed together under "Umowa" header

  Scenario: Set default value
    Given a custom field "status_type" with options
    When I set default value to "Standard"
    Then new clients should have "Standard" pre-selected
```

### AC4: Field Values Management

```gherkin
Feature: Custom Field Values
  As an accountant
  I want to set custom field values for clients
  So that I can store industry-specific information

  Scenario: Set single value
    Given a client "ABC Sp. z o.o." exists
    And a custom field "contract_type" exists
    When I set "contract_type" to "Umowa ryczałtowa"
    Then the value should be saved
    And it should appear in client details

  Scenario: Set multi-select values
    Given a client exists
    And a multiselect field "services_used" exists
    When I select ["Księgowość", "VAT", "Kadry"]
    Then all three values should be saved

  Scenario: Clear optional field value
    Given a client with custom field value
    When I clear the field value
    Then the field should be empty
    And no validation error should occur

  Scenario: Validate required field
    Given a required custom field "client_category" exists
    When I try to save a client without this field
    Then I should see error "Pole 'Kategoria klienta' jest wymagane"

  Scenario: Bulk update custom field values
    Given 10 clients are selected
    And a custom field "account_manager" exists
    When I bulk set "account_manager" to "Jan Kowalski"
    Then all 10 clients should have this value
```

### AC5: Search and Filter by Custom Fields

```gherkin
Feature: Custom Field Search and Filter
  As an accountant
  I want to search and filter clients by custom fields
  So that I can find clients with specific attributes

  Scenario: Filter by select field
    Given clients have different "industry_sector" values
    When I filter by "industry_sector" = "IT"
    Then I should see only clients in IT sector

  Scenario: Filter by date range
    Given clients have "contract_end_date" values
    When I filter by contract ending within 30 days
    Then I should see clients with contracts expiring soon

  Scenario: Filter by number range
    Given clients have "monthly_fee" values
    When I filter by monthly_fee between 1000 and 5000
    Then I should see clients within that fee range

  Scenario: Include custom fields in search
    Given custom field values are indexed
    When I search for "ryczałt"
    Then clients with "contract_type" containing "ryczałt" should appear

  Scenario: Create saved filter with custom fields
    Given I create a filter combining standard and custom fields
    When I save it as "Klienci IT z wysoką opłatą"
    Then I should be able to quickly apply this filter later
```

### AC6: Custom Field Administration

```gherkin
Feature: Field Administration
  As an admin
  I want to manage custom fields lifecycle
  So that I can maintain data quality

  Scenario: Edit custom field
    Given a custom field "contract_type" exists
    When I change the label to "Rodzaj umowy"
    Then the new label should appear everywhere
    And existing values should be preserved

  Scenario: Add option to select field
    Given a select field "industry_sector" exists
    When I add option "Fintech" to the list
    Then "Fintech" should be available for selection
    And existing values should remain valid

  Scenario: Remove option from select field
    Given a select field with option "Inne" used by 5 clients
    When I try to remove "Inne" option
    Then I should see warning "Ta opcja jest używana przez 5 klientów"
    And I should be asked to migrate values or proceed

  Scenario: Archive custom field
    Given a custom field with values
    When I archive the field
    Then it should no longer appear in forms
    But existing values should be preserved in the database
    And historical data should remain accessible

  Scenario: Delete unused custom field
    Given a custom field with no values
    When I delete the field
    Then it should be permanently removed
    And it should not appear in any forms or reports
```

---

## Technical Specification

### Database Schema

```sql
-- Custom field definitions
CREATE TABLE custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Field identification
    name VARCHAR(100) NOT NULL,
    label VARCHAR(200) NOT NULL,
    description TEXT,

    -- Field type and configuration
    field_type VARCHAR(30) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',

    -- Validation rules
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    validation_rules JSONB DEFAULT '{}',

    -- Display settings
    display_order INTEGER NOT NULL DEFAULT 0,
    group_name VARCHAR(100),
    visibility VARCHAR(20) NOT NULL DEFAULT 'ALL',
    placeholder VARCHAR(200),
    help_text TEXT,

    -- Entity scope
    entity_type VARCHAR(50) NOT NULL DEFAULT 'CLIENT',

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES users(id),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),

    -- Constraints
    CONSTRAINT unique_field_name_per_org UNIQUE (organization_id, name, entity_type),
    CONSTRAINT valid_field_type CHECK (
        field_type IN (
            'TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'DATETIME',
            'SELECT', 'MULTISELECT', 'CHECKBOX', 'EMAIL', 'PHONE',
            'URL', 'CURRENCY'
        )
    ),
    CONSTRAINT valid_visibility CHECK (
        visibility IN ('ALL', 'INTERNAL', 'PORTAL', 'ADMIN_ONLY')
    )
);

-- Custom field values
CREATE TABLE custom_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Value storage (use appropriate column based on type)
    value_text TEXT,
    value_number DECIMAL(18, 4),
    value_date DATE,
    value_datetime TIMESTAMPTZ,
    value_boolean BOOLEAN,
    value_json JSONB,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),

    -- Constraints
    CONSTRAINT unique_field_value_per_entity UNIQUE (field_id, entity_id)
);

-- Indexes
CREATE INDEX idx_cfd_organization ON custom_field_definitions(organization_id);
CREATE INDEX idx_cfd_entity_type ON custom_field_definitions(entity_type);
CREATE INDEX idx_cfd_active ON custom_field_definitions(is_active, is_archived);
CREATE INDEX idx_cfd_group ON custom_field_definitions(organization_id, group_name);

CREATE INDEX idx_cfv_field ON custom_field_values(field_id);
CREATE INDEX idx_cfv_entity ON custom_field_values(entity_type, entity_id);
CREATE INDEX idx_cfv_organization ON custom_field_values(organization_id);
CREATE INDEX idx_cfv_text_search ON custom_field_values USING GIN(to_tsvector('polish', value_text));
CREATE INDEX idx_cfv_json ON custom_field_values USING GIN(value_json);

-- Row Level Security
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY cfd_isolation ON custom_field_definitions
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY cfv_isolation ON custom_field_values
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Comments
COMMENT ON TABLE custom_field_definitions IS 'Custom field schema definitions per organization';
COMMENT ON TABLE custom_field_values IS 'Actual custom field values for entities';
COMMENT ON COLUMN custom_field_definitions.config IS 'Type-specific configuration (options, min/max, etc.)';
COMMENT ON COLUMN custom_field_definitions.validation_rules IS 'Additional validation rules in JSON format';
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Field types enum
export const CustomFieldTypeSchema = z.enum([
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'DATE',
  'DATETIME',
  'SELECT',
  'MULTISELECT',
  'CHECKBOX',
  'EMAIL',
  'PHONE',
  'URL',
  'CURRENCY'
]);

// Visibility enum
export const FieldVisibilitySchema = z.enum([
  'ALL',        // Visible to everyone
  'INTERNAL',   // Only internal users
  'PORTAL',     // Only in client portal
  'ADMIN_ONLY'  // Only admins
]);

// Entity type enum
export const EntityTypeSchema = z.enum([
  'CLIENT',
  'CONTACT',
  'DOCUMENT'
]);

// Type-specific configurations
const TextFieldConfigSchema = z.object({
  maxLength: z.number().min(1).max(10000).optional(),
  pattern: z.string().optional(),
  patternMessage: z.string().optional()
});

const TextareaFieldConfigSchema = z.object({
  maxLength: z.number().min(1).max(50000).optional(),
  rows: z.number().min(2).max(20).default(4)
});

const NumberFieldConfigSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  decimalPlaces: z.number().min(0).max(6).default(0),
  unit: z.string().max(20).optional()
});

const DateFieldConfigSchema = z.object({
  minDate: z.string().optional(),
  maxDate: z.string().optional()
});

const SelectFieldConfigSchema = z.object({
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
    color: z.string().optional()
  })).min(1).max(100),
  defaultValue: z.string().optional()
});

const MultiselectFieldConfigSchema = z.object({
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
    color: z.string().optional()
  })).min(1).max(100),
  maxSelections: z.number().min(1).max(50).optional(),
  defaultValues: z.array(z.string()).optional()
});

const CurrencyFieldConfigSchema = z.object({
  currency: z.string().length(3).default('PLN'),
  min: z.number().optional(),
  max: z.number().optional()
});

// Combined config schema based on type
export const FieldConfigSchema = z.union([
  TextFieldConfigSchema,
  TextareaFieldConfigSchema,
  NumberFieldConfigSchema,
  DateFieldConfigSchema,
  SelectFieldConfigSchema,
  MultiselectFieldConfigSchema,
  CurrencyFieldConfigSchema,
  z.object({}) // For types without special config (CHECKBOX, EMAIL, PHONE, URL)
]);

// Validation rules schema
export const ValidationRulesSchema = z.object({
  customValidator: z.string().optional(), // JavaScript expression for custom validation
  conditionalRequired: z.object({
    dependsOn: z.string(),
    condition: z.enum(['equals', 'notEquals', 'exists', 'notExists']),
    value: z.unknown().optional()
  }).optional()
});

// Create field definition input
export const CreateCustomFieldSchema = z.object({
  name: z.string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9_]*$/, 'Nazwa musi zaczynać się od małej litery i zawierać tylko małe litery, cyfry i podkreślenia'),
  label: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  fieldType: CustomFieldTypeSchema,
  config: FieldConfigSchema.optional().default({}),
  isRequired: z.boolean().default(false),
  validationRules: ValidationRulesSchema.optional(),
  displayOrder: z.number().int().min(0).default(0),
  groupName: z.string().max(100).optional(),
  visibility: FieldVisibilitySchema.default('ALL'),
  placeholder: z.string().max(200).optional(),
  helpText: z.string().max(500).optional(),
  entityType: EntityTypeSchema.default('CLIENT')
});

// Update field definition input
export const UpdateCustomFieldSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  config: FieldConfigSchema.optional(),
  isRequired: z.boolean().optional(),
  validationRules: ValidationRulesSchema.optional(),
  displayOrder: z.number().int().min(0).optional(),
  groupName: z.string().max(100).nullable().optional(),
  visibility: FieldVisibilitySchema.optional(),
  placeholder: z.string().max(200).optional(),
  helpText: z.string().max(500).optional()
});

// Set field value input
export const SetCustomFieldValueSchema = z.object({
  fieldId: z.string().uuid(),
  entityId: z.string().uuid(),
  entityType: EntityTypeSchema,
  value: z.unknown() // Validated based on field type
});

// Bulk set values input
export const BulkSetFieldValuesSchema = z.object({
  fieldId: z.string().uuid(),
  entityIds: z.array(z.string().uuid()).min(1).max(1000),
  entityType: EntityTypeSchema,
  value: z.unknown()
});

// Field definition response
export const CustomFieldDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  fieldType: CustomFieldTypeSchema,
  config: z.record(z.unknown()),
  isRequired: z.boolean(),
  validationRules: z.record(z.unknown()).nullable(),
  displayOrder: z.number(),
  groupName: z.string().nullable(),
  visibility: FieldVisibilitySchema,
  placeholder: z.string().nullable(),
  helpText: z.string().nullable(),
  entityType: EntityTypeSchema,
  isActive: z.boolean(),
  isArchived: z.boolean(),
  createdAt: z.string().datetime(),
  usageCount: z.number().optional()
});

// Field value response
export const CustomFieldValueSchema = z.object({
  fieldId: z.string().uuid(),
  fieldName: z.string(),
  fieldLabel: z.string(),
  fieldType: CustomFieldTypeSchema,
  value: z.unknown(),
  displayValue: z.string().nullable(),
  updatedAt: z.string().datetime()
});

// Export types
export type CustomFieldType = z.infer<typeof CustomFieldTypeSchema>;
export type FieldVisibility = z.infer<typeof FieldVisibilitySchema>;
export type EntityType = z.infer<typeof EntityTypeSchema>;
export type CreateCustomField = z.infer<typeof CreateCustomFieldSchema>;
export type UpdateCustomField = z.infer<typeof UpdateCustomFieldSchema>;
export type SetCustomFieldValue = z.infer<typeof SetCustomFieldValueSchema>;
export type BulkSetFieldValues = z.infer<typeof BulkSetFieldValuesSchema>;
export type CustomFieldDefinition = z.infer<typeof CustomFieldDefinitionSchema>;
export type CustomFieldValue = z.infer<typeof CustomFieldValueSchema>;
```

### tRPC Router Implementation

```typescript
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  CreateCustomFieldSchema,
  UpdateCustomFieldSchema,
  SetCustomFieldValueSchema,
  BulkSetFieldValuesSchema,
  CustomFieldDefinitionSchema,
  CustomFieldValueSchema,
  EntityTypeSchema
} from './schemas';

export const customFieldsRouter = router({
  // Get all field definitions for entity type
  getFieldDefinitions: protectedProcedure
    .input(z.object({
      entityType: EntityTypeSchema.default('CLIENT'),
      includeArchived: z.boolean().default(false)
    }))
    .output(z.array(CustomFieldDefinitionSchema))
    .query(async ({ ctx, input }) => {
      const { db, user } = ctx;

      const where: any = {
        organizationId: user.organizationId,
        entityType: input.entityType,
        isActive: true
      };

      if (!input.includeArchived) {
        where.isArchived = false;
      }

      const fields = await db.customFieldDefinition.findMany({
        where,
        orderBy: [
          { groupName: 'asc' },
          { displayOrder: 'asc' },
          { createdAt: 'asc' }
        ]
      });

      // Get usage counts
      const usageCounts = await db.customFieldValue.groupBy({
        by: ['fieldId'],
        where: {
          fieldId: { in: fields.map(f => f.id) }
        },
        _count: { id: true }
      });

      const usageMap = new Map(usageCounts.map(u => [u.fieldId, u._count.id]));

      return fields.map(f => ({
        id: f.id,
        name: f.name,
        label: f.label,
        description: f.description,
        fieldType: f.fieldType,
        config: f.config as Record<string, unknown>,
        isRequired: f.isRequired,
        validationRules: f.validationRules as Record<string, unknown> | null,
        displayOrder: f.displayOrder,
        groupName: f.groupName,
        visibility: f.visibility,
        placeholder: f.placeholder,
        helpText: f.helpText,
        entityType: f.entityType,
        isActive: f.isActive,
        isArchived: f.isArchived,
        createdAt: f.createdAt.toISOString(),
        usageCount: usageMap.get(f.id) || 0
      }));
    }),

  // Create new field definition (admin only)
  createFieldDefinition: adminProcedure
    .input(CreateCustomFieldSchema)
    .output(CustomFieldDefinitionSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      // Check for duplicate name
      const existing = await db.customFieldDefinition.findFirst({
        where: {
          organizationId: user.organizationId,
          name: input.name,
          entityType: input.entityType,
          isArchived: false
        }
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Pole o nazwie "${input.name}" już istnieje`
        });
      }

      // Get max display order
      const maxOrder = await db.customFieldDefinition.aggregate({
        where: {
          organizationId: user.organizationId,
          entityType: input.entityType
        },
        _max: { displayOrder: true }
      });

      const field = await db.customFieldDefinition.create({
        data: {
          organizationId: user.organizationId,
          name: input.name,
          label: input.label,
          description: input.description,
          fieldType: input.fieldType,
          config: input.config,
          isRequired: input.isRequired,
          validationRules: input.validationRules,
          displayOrder: input.displayOrder || (maxOrder._max.displayOrder || 0) + 10,
          groupName: input.groupName,
          visibility: input.visibility,
          placeholder: input.placeholder,
          helpText: input.helpText,
          entityType: input.entityType,
          createdBy: user.id,
          updatedBy: user.id
        }
      });

      // Create audit log
      await createAuditLog(db, {
        eventType: 'CUSTOM_FIELD_CREATED',
        entityType: 'CUSTOM_FIELD_DEFINITION',
        entityId: field.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: {
          name: input.name,
          fieldType: input.fieldType
        }
      });

      return mapFieldDefinition(field);
    }),

  // Update field definition (admin only)
  updateFieldDefinition: adminProcedure
    .input(UpdateCustomFieldSchema)
    .output(CustomFieldDefinitionSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      const existing = await db.customFieldDefinition.findFirst({
        where: {
          id: input.id,
          organizationId: user.organizationId
        }
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pole niestandardowe nie zostało znalezione'
        });
      }

      // Build update data
      const updateData: any = {
        updatedAt: new Date(),
        updatedBy: user.id
      };

      if (input.label !== undefined) updateData.label = input.label;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.config !== undefined) updateData.config = input.config;
      if (input.isRequired !== undefined) updateData.isRequired = input.isRequired;
      if (input.validationRules !== undefined) updateData.validationRules = input.validationRules;
      if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder;
      if (input.groupName !== undefined) updateData.groupName = input.groupName;
      if (input.visibility !== undefined) updateData.visibility = input.visibility;
      if (input.placeholder !== undefined) updateData.placeholder = input.placeholder;
      if (input.helpText !== undefined) updateData.helpText = input.helpText;

      const field = await db.customFieldDefinition.update({
        where: { id: input.id },
        data: updateData
      });

      // Create audit log
      await createAuditLog(db, {
        eventType: 'CUSTOM_FIELD_UPDATED',
        entityType: 'CUSTOM_FIELD_DEFINITION',
        entityId: field.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { changes: Object.keys(updateData) }
      });

      return mapFieldDefinition(field);
    }),

  // Archive field definition (admin only)
  archiveFieldDefinition: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      const field = await db.customFieldDefinition.findFirst({
        where: {
          id: input.id,
          organizationId: user.organizationId,
          isArchived: false
        }
      });

      if (!field) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pole niestandardowe nie zostało znalezione'
        });
      }

      await db.customFieldDefinition.update({
        where: { id: input.id },
        data: {
          isArchived: true,
          archivedAt: new Date(),
          archivedBy: user.id,
          isActive: false,
          updatedAt: new Date(),
          updatedBy: user.id
        }
      });

      // Create audit log
      await createAuditLog(db, {
        eventType: 'CUSTOM_FIELD_ARCHIVED',
        entityType: 'CUSTOM_FIELD_DEFINITION',
        entityId: field.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { fieldName: field.name }
      });

      return { success: true };
    }),

  // Delete field definition (admin only, only if no values)
  deleteFieldDefinition: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      const field = await db.customFieldDefinition.findFirst({
        where: {
          id: input.id,
          organizationId: user.organizationId
        }
      });

      if (!field) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pole niestandardowe nie zostało znalezione'
        });
      }

      // Check for existing values
      const valueCount = await db.customFieldValue.count({
        where: { fieldId: input.id }
      });

      if (valueCount > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Nie można usunąć pola - jest używane przez ${valueCount} rekordów. Zarchiwizuj pole zamiast usuwać.`
        });
      }

      await db.customFieldDefinition.delete({
        where: { id: input.id }
      });

      // Create audit log
      await createAuditLog(db, {
        eventType: 'CUSTOM_FIELD_DELETED',
        entityType: 'CUSTOM_FIELD_DEFINITION',
        entityId: field.id,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: { fieldName: field.name }
      });

      return { success: true };
    }),

  // Reorder fields (admin only)
  reorderFields: adminProcedure
    .input(z.object({
      entityType: EntityTypeSchema,
      fieldOrders: z.array(z.object({
        id: z.string().uuid(),
        displayOrder: z.number().int().min(0)
      }))
    }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      await db.$transaction(
        input.fieldOrders.map(fo =>
          db.customFieldDefinition.update({
            where: { id: fo.id },
            data: {
              displayOrder: fo.displayOrder,
              updatedAt: new Date(),
              updatedBy: user.id
            }
          })
        )
      );

      return { success: true };
    }),

  // Get values for entity
  getEntityValues: protectedProcedure
    .input(z.object({
      entityType: EntityTypeSchema,
      entityId: z.string().uuid()
    }))
    .output(z.array(CustomFieldValueSchema))
    .query(async ({ ctx, input }) => {
      const { db, user } = ctx;

      // Get field definitions with values
      const fields = await db.customFieldDefinition.findMany({
        where: {
          organizationId: user.organizationId,
          entityType: input.entityType,
          isActive: true,
          isArchived: false
        },
        include: {
          values: {
            where: { entityId: input.entityId }
          }
        },
        orderBy: [
          { groupName: 'asc' },
          { displayOrder: 'asc' }
        ]
      });

      return fields.map(field => {
        const value = field.values[0];
        const rawValue = extractValue(field.fieldType, value);

        return {
          fieldId: field.id,
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.fieldType,
          value: rawValue,
          displayValue: formatDisplayValue(field, rawValue),
          updatedAt: value?.updatedAt?.toISOString() || field.createdAt.toISOString()
        };
      });
    }),

  // Set field value
  setFieldValue: protectedProcedure
    .input(SetCustomFieldValueSchema)
    .output(CustomFieldValueSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      // Get field definition
      const field = await db.customFieldDefinition.findFirst({
        where: {
          id: input.fieldId,
          organizationId: user.organizationId,
          isActive: true,
          isArchived: false
        }
      });

      if (!field) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pole niestandardowe nie zostało znalezione'
        });
      }

      // Validate value
      const validationResult = validateFieldValue(field, input.value);
      if (!validationResult.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: validationResult.error || 'Nieprawidłowa wartość'
        });
      }

      // Prepare value columns
      const valueData = prepareValueData(field.fieldType, input.value);

      // Upsert value
      const value = await db.customFieldValue.upsert({
        where: {
          fieldId_entityId: {
            fieldId: input.fieldId,
            entityId: input.entityId
          }
        },
        create: {
          fieldId: input.fieldId,
          entityType: input.entityType,
          entityId: input.entityId,
          organizationId: user.organizationId,
          ...valueData,
          createdBy: user.id,
          updatedBy: user.id
        },
        update: {
          ...valueData,
          updatedAt: new Date(),
          updatedBy: user.id
        }
      });

      // Create timeline event
      await recordCustomFieldSet(db, {
        entityType: input.entityType,
        entityId: input.entityId,
        organizationId: user.organizationId,
        fieldName: field.name,
        fieldLabel: field.label,
        value: input.value,
        userId: user.id
      });

      return {
        fieldId: field.id,
        fieldName: field.name,
        fieldLabel: field.label,
        fieldType: field.fieldType,
        value: input.value,
        displayValue: formatDisplayValue(field, input.value),
        updatedAt: value.updatedAt.toISOString()
      };
    }),

  // Bulk set field value
  bulkSetFieldValue: protectedProcedure
    .input(BulkSetFieldValuesSchema)
    .output(z.object({
      successCount: z.number(),
      failedCount: z.number(),
      errors: z.array(z.object({
        entityId: z.string(),
        error: z.string()
      }))
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      // Get field definition
      const field = await db.customFieldDefinition.findFirst({
        where: {
          id: input.fieldId,
          organizationId: user.organizationId,
          isActive: true,
          isArchived: false
        }
      });

      if (!field) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pole niestandardowe nie zostało znalezione'
        });
      }

      // Validate value once
      const validationResult = validateFieldValue(field, input.value);
      if (!validationResult.valid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: validationResult.error || 'Nieprawidłowa wartość'
        });
      }

      const valueData = prepareValueData(field.fieldType, input.value);
      const errors: { entityId: string; error: string }[] = [];
      let successCount = 0;

      // Process in batches
      const batchSize = 100;
      for (let i = 0; i < input.entityIds.length; i += batchSize) {
        const batch = input.entityIds.slice(i, i + batchSize);

        try {
          await db.$transaction(
            batch.map(entityId =>
              db.customFieldValue.upsert({
                where: {
                  fieldId_entityId: {
                    fieldId: input.fieldId,
                    entityId
                  }
                },
                create: {
                  fieldId: input.fieldId,
                  entityType: input.entityType,
                  entityId,
                  organizationId: user.organizationId,
                  ...valueData,
                  createdBy: user.id,
                  updatedBy: user.id
                },
                update: {
                  ...valueData,
                  updatedAt: new Date(),
                  updatedBy: user.id
                }
              })
            )
          );
          successCount += batch.length;
        } catch (error) {
          batch.forEach(entityId => {
            errors.push({
              entityId,
              error: 'Błąd zapisu wartości'
            });
          });
        }
      }

      // Create audit log for bulk operation
      await createAuditLog(db, {
        eventType: 'CUSTOM_FIELD_BULK_SET',
        entityType: 'CUSTOM_FIELD_VALUE',
        entityId: input.fieldId,
        userId: user.id,
        organizationId: user.organizationId,
        metadata: {
          fieldName: field.name,
          entityCount: successCount,
          failedCount: errors.length
        }
      });

      return {
        successCount,
        failedCount: errors.length,
        errors
      };
    }),

  // Clear field value
  clearFieldValue: protectedProcedure
    .input(z.object({
      fieldId: z.string().uuid(),
      entityId: z.string().uuid()
    }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      // Get field to verify it's not required
      const field = await db.customFieldDefinition.findFirst({
        where: {
          id: input.fieldId,
          organizationId: user.organizationId
        }
      });

      if (!field) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pole niestandardowe nie zostało znalezione'
        });
      }

      if (field.isRequired) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nie można wyczyścić wymaganego pola'
        });
      }

      await db.customFieldValue.deleteMany({
        where: {
          fieldId: input.fieldId,
          entityId: input.entityId
        }
      });

      return { success: true };
    }),

  // Get option usage count (for select/multiselect fields)
  getOptionUsage: adminProcedure
    .input(z.object({
      fieldId: z.string().uuid()
    }))
    .output(z.array(z.object({
      option: z.string(),
      count: z.number()
    })))
    .query(async ({ ctx, input }) => {
      const { db, user } = ctx;

      const field = await db.customFieldDefinition.findFirst({
        where: {
          id: input.fieldId,
          organizationId: user.organizationId,
          fieldType: { in: ['SELECT', 'MULTISELECT'] }
        }
      });

      if (!field) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pole nie zostało znalezione lub nie jest typu wyboru'
        });
      }

      const values = await db.customFieldValue.findMany({
        where: { fieldId: input.fieldId },
        select: { valueText: true, valueJson: true }
      });

      const optionCounts = new Map<string, number>();

      for (const v of values) {
        if (field.fieldType === 'SELECT' && v.valueText) {
          optionCounts.set(v.valueText, (optionCounts.get(v.valueText) || 0) + 1);
        } else if (field.fieldType === 'MULTISELECT' && v.valueJson) {
          const selected = v.valueJson as string[];
          for (const opt of selected) {
            optionCounts.set(opt, (optionCounts.get(opt) || 0) + 1);
          }
        }
      }

      return Array.from(optionCounts.entries())
        .map(([option, count]) => ({ option, count }))
        .sort((a, b) => b.count - a.count);
    })
});

// Helper functions
function extractValue(fieldType: string, value: any): unknown {
  if (!value) return null;

  switch (fieldType) {
    case 'TEXT':
    case 'TEXTAREA':
    case 'EMAIL':
    case 'PHONE':
    case 'URL':
    case 'SELECT':
      return value.valueText;
    case 'NUMBER':
    case 'CURRENCY':
      return value.valueNumber ? Number(value.valueNumber) : null;
    case 'DATE':
      return value.valueDate?.toISOString().split('T')[0] || null;
    case 'DATETIME':
      return value.valueDatetime?.toISOString() || null;
    case 'CHECKBOX':
      return value.valueBoolean ?? false;
    case 'MULTISELECT':
      return value.valueJson || [];
    default:
      return null;
  }
}

function prepareValueData(fieldType: string, value: unknown): Record<string, any> {
  const data: Record<string, any> = {
    valueText: null,
    valueNumber: null,
    valueDate: null,
    valueDatetime: null,
    valueBoolean: null,
    valueJson: null
  };

  if (value === null || value === undefined) return data;

  switch (fieldType) {
    case 'TEXT':
    case 'TEXTAREA':
    case 'EMAIL':
    case 'PHONE':
    case 'URL':
    case 'SELECT':
      data.valueText = String(value);
      break;
    case 'NUMBER':
    case 'CURRENCY':
      data.valueNumber = Number(value);
      break;
    case 'DATE':
      data.valueDate = new Date(value as string);
      break;
    case 'DATETIME':
      data.valueDatetime = new Date(value as string);
      break;
    case 'CHECKBOX':
      data.valueBoolean = Boolean(value);
      break;
    case 'MULTISELECT':
      data.valueJson = value;
      break;
  }

  return data;
}

function validateFieldValue(field: any, value: unknown): { valid: boolean; error?: string } {
  // Required check
  if (field.isRequired && (value === null || value === undefined || value === '')) {
    return { valid: false, error: `Pole "${field.label}" jest wymagane` };
  }

  // Skip validation for empty optional values
  if (value === null || value === undefined || value === '') {
    return { valid: true };
  }

  const config = field.config as Record<string, any>;

  switch (field.fieldType) {
    case 'TEXT':
    case 'TEXTAREA':
      if (config.maxLength && String(value).length > config.maxLength) {
        return { valid: false, error: `Maksymalna długość to ${config.maxLength} znaków` };
      }
      if (config.pattern) {
        const regex = new RegExp(config.pattern);
        if (!regex.test(String(value))) {
          return { valid: false, error: config.patternMessage || 'Nieprawidłowy format' };
        }
      }
      break;

    case 'NUMBER':
    case 'CURRENCY':
      const num = Number(value);
      if (isNaN(num)) {
        return { valid: false, error: 'Wartość musi być liczbą' };
      }
      if (config.min !== undefined && num < config.min) {
        return { valid: false, error: `Minimalna wartość to ${config.min}` };
      }
      if (config.max !== undefined && num > config.max) {
        return { valid: false, error: `Maksymalna wartość to ${config.max}` };
      }
      break;

    case 'EMAIL':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(value))) {
        return { valid: false, error: 'Nieprawidłowy adres email' };
      }
      break;

    case 'PHONE':
      const phoneRegex = /^[\d\s\-\+\(\)]{6,20}$/;
      if (!phoneRegex.test(String(value))) {
        return { valid: false, error: 'Nieprawidłowy numer telefonu' };
      }
      break;

    case 'URL':
      try {
        new URL(String(value));
      } catch {
        return { valid: false, error: 'Nieprawidłowy adres URL' };
      }
      break;

    case 'SELECT':
      const options = config.options as { value: string }[];
      if (!options?.some(o => o.value === value)) {
        return { valid: false, error: 'Nieprawidłowa opcja' };
      }
      break;

    case 'MULTISELECT':
      const multiOptions = config.options as { value: string }[];
      const selected = value as string[];
      if (!Array.isArray(selected)) {
        return { valid: false, error: 'Wartość musi być tablicą' };
      }
      if (config.maxSelections && selected.length > config.maxSelections) {
        return { valid: false, error: `Maksymalnie można wybrać ${config.maxSelections} opcji` };
      }
      for (const s of selected) {
        if (!multiOptions?.some(o => o.value === s)) {
          return { valid: false, error: `Nieprawidłowa opcja: ${s}` };
        }
      }
      break;
  }

  return { valid: true };
}

function formatDisplayValue(field: any, value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const config = field.config as Record<string, any>;

  switch (field.fieldType) {
    case 'CHECKBOX':
      return value ? 'Tak' : 'Nie';
    case 'NUMBER':
      const num = Number(value);
      const formatted = config.decimalPlaces !== undefined
        ? num.toFixed(config.decimalPlaces)
        : String(num);
      return config.unit ? `${formatted} ${config.unit}` : formatted;
    case 'CURRENCY':
      return `${Number(value).toFixed(2)} ${config.currency || 'PLN'}`;
    case 'DATE':
      return new Date(value as string).toLocaleDateString('pl-PL');
    case 'DATETIME':
      return new Date(value as string).toLocaleString('pl-PL');
    case 'MULTISELECT':
      return (value as string[]).join(', ');
    case 'SELECT':
      const options = config.options as { value: string; label: string }[];
      const option = options?.find(o => o.value === value);
      return option?.label || String(value);
    default:
      return String(value);
  }
}

function mapFieldDefinition(field: any): CustomFieldDefinition {
  return {
    id: field.id,
    name: field.name,
    label: field.label,
    description: field.description,
    fieldType: field.fieldType,
    config: field.config as Record<string, unknown>,
    isRequired: field.isRequired,
    validationRules: field.validationRules as Record<string, unknown> | null,
    displayOrder: field.displayOrder,
    groupName: field.groupName,
    visibility: field.visibility,
    placeholder: field.placeholder,
    helpText: field.helpText,
    entityType: field.entityType,
    isActive: field.isActive,
    isArchived: field.isArchived,
    createdAt: field.createdAt.toISOString()
  };
}
```

---

## Test Specification

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateFieldValue,
  prepareValueData,
  formatDisplayValue,
  extractValue
} from './custom-fields.utils';

describe('Custom Fields Utils', () => {
  describe('validateFieldValue', () => {
    it('should validate required field', () => {
      const field = { isRequired: true, label: 'Test', fieldType: 'TEXT', config: {} };

      expect(validateFieldValue(field, null).valid).toBe(false);
      expect(validateFieldValue(field, '').valid).toBe(false);
      expect(validateFieldValue(field, 'value').valid).toBe(true);
    });

    it('should validate text max length', () => {
      const field = {
        isRequired: false,
        label: 'Test',
        fieldType: 'TEXT',
        config: { maxLength: 10 }
      };

      expect(validateFieldValue(field, 'short').valid).toBe(true);
      expect(validateFieldValue(field, 'this is too long').valid).toBe(false);
    });

    it('should validate text pattern', () => {
      const field = {
        isRequired: false,
        label: 'Test',
        fieldType: 'TEXT',
        config: { pattern: '^[A-Z]{2}\\d{3}$', patternMessage: 'Format: XX999' }
      };

      expect(validateFieldValue(field, 'AB123').valid).toBe(true);
      expect(validateFieldValue(field, 'invalid').valid).toBe(false);
    });

    it('should validate number range', () => {
      const field = {
        isRequired: false,
        label: 'Test',
        fieldType: 'NUMBER',
        config: { min: 0, max: 100 }
      };

      expect(validateFieldValue(field, 50).valid).toBe(true);
      expect(validateFieldValue(field, -5).valid).toBe(false);
      expect(validateFieldValue(field, 150).valid).toBe(false);
    });

    it('should validate email format', () => {
      const field = { isRequired: false, label: 'Test', fieldType: 'EMAIL', config: {} };

      expect(validateFieldValue(field, 'test@example.com').valid).toBe(true);
      expect(validateFieldValue(field, 'invalid').valid).toBe(false);
    });

    it('should validate select options', () => {
      const field = {
        isRequired: false,
        label: 'Test',
        fieldType: 'SELECT',
        config: {
          options: [
            { value: 'A', label: 'Option A' },
            { value: 'B', label: 'Option B' }
          ]
        }
      };

      expect(validateFieldValue(field, 'A').valid).toBe(true);
      expect(validateFieldValue(field, 'C').valid).toBe(false);
    });

    it('should validate multiselect max selections', () => {
      const field = {
        isRequired: false,
        label: 'Test',
        fieldType: 'MULTISELECT',
        config: {
          options: [
            { value: 'A', label: 'A' },
            { value: 'B', label: 'B' },
            { value: 'C', label: 'C' }
          ],
          maxSelections: 2
        }
      };

      expect(validateFieldValue(field, ['A', 'B']).valid).toBe(true);
      expect(validateFieldValue(field, ['A', 'B', 'C']).valid).toBe(false);
    });
  });

  describe('prepareValueData', () => {
    it('should prepare text value', () => {
      const result = prepareValueData('TEXT', 'test value');
      expect(result.valueText).toBe('test value');
      expect(result.valueNumber).toBeNull();
    });

    it('should prepare number value', () => {
      const result = prepareValueData('NUMBER', 42.5);
      expect(result.valueNumber).toBe(42.5);
      expect(result.valueText).toBeNull();
    });

    it('should prepare date value', () => {
      const result = prepareValueData('DATE', '2024-01-15');
      expect(result.valueDate).toBeInstanceOf(Date);
    });

    it('should prepare checkbox value', () => {
      const result = prepareValueData('CHECKBOX', true);
      expect(result.valueBoolean).toBe(true);
    });

    it('should prepare multiselect value', () => {
      const result = prepareValueData('MULTISELECT', ['A', 'B']);
      expect(result.valueJson).toEqual(['A', 'B']);
    });
  });

  describe('formatDisplayValue', () => {
    it('should format checkbox as Yes/No in Polish', () => {
      const field = { fieldType: 'CHECKBOX', config: {} };
      expect(formatDisplayValue(field, true)).toBe('Tak');
      expect(formatDisplayValue(field, false)).toBe('Nie');
    });

    it('should format number with decimal places and unit', () => {
      const field = {
        fieldType: 'NUMBER',
        config: { decimalPlaces: 2, unit: 'kg' }
      };
      expect(formatDisplayValue(field, 42.5)).toBe('42.50 kg');
    });

    it('should format currency', () => {
      const field = {
        fieldType: 'CURRENCY',
        config: { currency: 'PLN' }
      };
      expect(formatDisplayValue(field, 1234.5)).toBe('1234.50 PLN');
    });

    it('should format date in Polish locale', () => {
      const field = { fieldType: 'DATE', config: {} };
      const result = formatDisplayValue(field, '2024-01-15');
      expect(result).toMatch(/15/);
      expect(result).toMatch(/2024/);
    });

    it('should format multiselect as comma-separated list', () => {
      const field = { fieldType: 'MULTISELECT', config: {} };
      expect(formatDisplayValue(field, ['A', 'B', 'C'])).toBe('A, B, C');
    });

    it('should format select with label', () => {
      const field = {
        fieldType: 'SELECT',
        config: {
          options: [{ value: 'IT', label: 'Information Technology' }]
        }
      };
      expect(formatDisplayValue(field, 'IT')).toBe('Information Technology');
    });
  });

  describe('extractValue', () => {
    it('should extract text value', () => {
      expect(extractValue('TEXT', { valueText: 'test' })).toBe('test');
    });

    it('should extract number value', () => {
      expect(extractValue('NUMBER', { valueNumber: 42 })).toBe(42);
    });

    it('should extract boolean value', () => {
      expect(extractValue('CHECKBOX', { valueBoolean: true })).toBe(true);
    });

    it('should extract multiselect value', () => {
      expect(extractValue('MULTISELECT', { valueJson: ['A', 'B'] })).toEqual(['A', 'B']);
    });

    it('should return null for missing value', () => {
      expect(extractValue('TEXT', null)).toBeNull();
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestContext, cleanupTestData } from '../test-utils';

describe('Custom Fields Router Integration', () => {
  let ctx: any;
  let adminUser: any;
  let testClient: any;

  beforeAll(async () => {
    ctx = await createTestContext();
    adminUser = await ctx.createAdminUser();
    testClient = await ctx.createTestClient({ companyName: 'Test Client' });
  });

  afterAll(async () => {
    await cleanupTestData(ctx);
  });

  beforeEach(async () => {
    // Clean custom fields
    await ctx.db.customFieldValue.deleteMany({});
    await ctx.db.customFieldDefinition.deleteMany({});
  });

  describe('createFieldDefinition', () => {
    it('should create text field', async () => {
      const result = await ctx.adminCaller.customFields.createFieldDefinition({
        name: 'contract_type',
        label: 'Typ umowy',
        fieldType: 'TEXT',
        config: { maxLength: 100 }
      });

      expect(result.id).toBeTruthy();
      expect(result.name).toBe('contract_type');
      expect(result.fieldType).toBe('TEXT');
      expect(result.isActive).toBe(true);
    });

    it('should create select field with options', async () => {
      const result = await ctx.adminCaller.customFields.createFieldDefinition({
        name: 'industry',
        label: 'Branża',
        fieldType: 'SELECT',
        config: {
          options: [
            { value: 'IT', label: 'IT' },
            { value: 'TRADE', label: 'Handel' }
          ]
        }
      });

      expect(result.config.options).toHaveLength(2);
    });

    it('should reject duplicate field name', async () => {
      await ctx.adminCaller.customFields.createFieldDefinition({
        name: 'test_field',
        label: 'Test',
        fieldType: 'TEXT'
      });

      await expect(
        ctx.adminCaller.customFields.createFieldDefinition({
          name: 'test_field',
          label: 'Test 2',
          fieldType: 'TEXT'
        })
      ).rejects.toThrow('już istnieje');
    });

    it('should validate field name format', async () => {
      await expect(
        ctx.adminCaller.customFields.createFieldDefinition({
          name: 'Invalid Name',
          label: 'Test',
          fieldType: 'TEXT'
        })
      ).rejects.toThrow();
    });
  });

  describe('setFieldValue', () => {
    let textField: any;
    let selectField: any;
    let numberField: any;

    beforeEach(async () => {
      textField = await ctx.adminCaller.customFields.createFieldDefinition({
        name: 'notes',
        label: 'Notatki',
        fieldType: 'TEXT'
      });

      selectField = await ctx.adminCaller.customFields.createFieldDefinition({
        name: 'category',
        label: 'Kategoria',
        fieldType: 'SELECT',
        config: {
          options: [
            { value: 'A', label: 'Kategoria A' },
            { value: 'B', label: 'Kategoria B' }
          ]
        }
      });

      numberField = await ctx.adminCaller.customFields.createFieldDefinition({
        name: 'monthly_fee',
        label: 'Opłata miesięczna',
        fieldType: 'NUMBER',
        config: { min: 0, max: 10000, decimalPlaces: 2 }
      });
    });

    it('should set text value', async () => {
      const result = await ctx.caller.customFields.setFieldValue({
        fieldId: textField.id,
        entityId: testClient.id,
        entityType: 'CLIENT',
        value: 'Test note content'
      });

      expect(result.value).toBe('Test note content');
      expect(result.fieldName).toBe('notes');
    });

    it('should set and update select value', async () => {
      // Set initial value
      await ctx.caller.customFields.setFieldValue({
        fieldId: selectField.id,
        entityId: testClient.id,
        entityType: 'CLIENT',
        value: 'A'
      });

      // Update value
      const result = await ctx.caller.customFields.setFieldValue({
        fieldId: selectField.id,
        entityId: testClient.id,
        entityType: 'CLIENT',
        value: 'B'
      });

      expect(result.value).toBe('B');
      expect(result.displayValue).toBe('Kategoria B');
    });

    it('should reject invalid select option', async () => {
      await expect(
        ctx.caller.customFields.setFieldValue({
          fieldId: selectField.id,
          entityId: testClient.id,
          entityType: 'CLIENT',
          value: 'INVALID'
        })
      ).rejects.toThrow('Nieprawidłowa opcja');
    });

    it('should validate number range', async () => {
      await expect(
        ctx.caller.customFields.setFieldValue({
          fieldId: numberField.id,
          entityId: testClient.id,
          entityType: 'CLIENT',
          value: -100
        })
      ).rejects.toThrow('Minimalna wartość');

      const result = await ctx.caller.customFields.setFieldValue({
        fieldId: numberField.id,
        entityId: testClient.id,
        entityType: 'CLIENT',
        value: 1500.50
      });

      expect(result.value).toBe(1500.50);
    });
  });

  describe('getEntityValues', () => {
    it('should return all field values for entity', async () => {
      const field1 = await ctx.adminCaller.customFields.createFieldDefinition({
        name: 'field1',
        label: 'Field 1',
        fieldType: 'TEXT'
      });

      const field2 = await ctx.adminCaller.customFields.createFieldDefinition({
        name: 'field2',
        label: 'Field 2',
        fieldType: 'NUMBER'
      });

      await ctx.caller.customFields.setFieldValue({
        fieldId: field1.id,
        entityId: testClient.id,
        entityType: 'CLIENT',
        value: 'Text value'
      });

      await ctx.caller.customFields.setFieldValue({
        fieldId: field2.id,
        entityId: testClient.id,
        entityType: 'CLIENT',
        value: 42
      });

      const values = await ctx.caller.customFields.getEntityValues({
        entityType: 'CLIENT',
        entityId: testClient.id
      });

      expect(values).toHaveLength(2);
      expect(values.find(v => v.fieldName === 'field1')?.value).toBe('Text value');
      expect(values.find(v => v.fieldName === 'field2')?.value).toBe(42);
    });

    it('should include fields without values', async () => {
      await ctx.adminCaller.customFields.createFieldDefinition({
        name: 'empty_field',
        label: 'Empty Field',
        fieldType: 'TEXT'
      });

      const values = await ctx.caller.customFields.getEntityValues({
        entityType: 'CLIENT',
        entityId: testClient.id
      });

      expect(values.find(v => v.fieldName === 'empty_field')?.value).toBeNull();
    });
  });

  describe('bulkSetFieldValue', () => {
    it('should set value for multiple entities', async () => {
      const field = await ctx.adminCaller.customFields.createFieldDefinition({
        name: 'manager',
        label: 'Account Manager',
        fieldType: 'TEXT'
      });

      const client2 = await ctx.createTestClient({ companyName: 'Client 2' });
      const client3 = await ctx.createTestClient({ companyName: 'Client 3' });

      const result = await ctx.caller.customFields.bulkSetFieldValue({
        fieldId: field.id,
        entityIds: [testClient.id, client2.id, client3.id],
        entityType: 'CLIENT',
        value: 'Jan Kowalski'
      });

      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
    });
  });

  describe('archiveFieldDefinition', () => {
    it('should archive field and preserve values', async () => {
      const field = await ctx.adminCaller.customFields.createFieldDefinition({
        name: 'to_archive',
        label: 'To Archive',
        fieldType: 'TEXT'
      });

      await ctx.caller.customFields.setFieldValue({
        fieldId: field.id,
        entityId: testClient.id,
        entityType: 'CLIENT',
        value: 'Important data'
      });

      await ctx.adminCaller.customFields.archiveFieldDefinition({ id: field.id });

      // Field should not appear in active fields
      const fields = await ctx.caller.customFields.getFieldDefinitions({
        entityType: 'CLIENT',
        includeArchived: false
      });

      expect(fields.find(f => f.id === field.id)).toBeUndefined();

      // But should appear with includeArchived
      const allFields = await ctx.caller.customFields.getFieldDefinitions({
        entityType: 'CLIENT',
        includeArchived: true
      });

      expect(allFields.find(f => f.id === field.id)).toBeTruthy();
    });
  });

  describe('deleteFieldDefinition', () => {
    it('should delete unused field', async () => {
      const field = await ctx.adminCaller.customFields.createFieldDefinition({
        name: 'to_delete',
        label: 'To Delete',
        fieldType: 'TEXT'
      });

      const result = await ctx.adminCaller.customFields.deleteFieldDefinition({ id: field.id });
      expect(result.success).toBe(true);

      const fields = await ctx.caller.customFields.getFieldDefinitions({
        entityType: 'CLIENT',
        includeArchived: true
      });

      expect(fields.find(f => f.id === field.id)).toBeUndefined();
    });

    it('should reject deletion of field with values', async () => {
      const field = await ctx.adminCaller.customFields.createFieldDefinition({
        name: 'has_values',
        label: 'Has Values',
        fieldType: 'TEXT'
      });

      await ctx.caller.customFields.setFieldValue({
        fieldId: field.id,
        entityId: testClient.id,
        entityType: 'CLIENT',
        value: 'Some value'
      });

      await expect(
        ctx.adminCaller.customFields.deleteFieldDefinition({ id: field.id })
      ).rejects.toThrow('jest używane');
    });
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Custom Fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@example.com');
    await page.fill('[name="password"]', 'adminpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create custom text field', async ({ page }) => {
    await page.goto('/settings/custom-fields');
    await page.click('[data-testid="add-field-button"]');

    await page.fill('[data-testid="field-name"]', 'client_reference');
    await page.fill('[data-testid="field-label"]', 'Numer referencyjny');
    await page.selectOption('[data-testid="field-type"]', 'TEXT');
    await page.fill('[data-testid="field-max-length"]', '50');

    await page.click('[data-testid="save-field-button"]');

    await expect(page.locator('text=Numer referencyjny')).toBeVisible();
  });

  test('should create custom select field with options', async ({ page }) => {
    await page.goto('/settings/custom-fields');
    await page.click('[data-testid="add-field-button"]');

    await page.fill('[data-testid="field-name"]', 'client_tier');
    await page.fill('[data-testid="field-label"]', 'Poziom klienta');
    await page.selectOption('[data-testid="field-type"]', 'SELECT');

    // Add options
    await page.click('[data-testid="add-option-button"]');
    await page.fill('[data-testid="option-value-0"]', 'BASIC');
    await page.fill('[data-testid="option-label-0"]', 'Podstawowy');

    await page.click('[data-testid="add-option-button"]');
    await page.fill('[data-testid="option-value-1"]', 'PREMIUM');
    await page.fill('[data-testid="option-label-1"]', 'Premium');

    await page.click('[data-testid="save-field-button"]');

    await expect(page.locator('text=Poziom klienta')).toBeVisible();
  });

  test('should set custom field value on client', async ({ page }) => {
    // First create a field
    await page.goto('/settings/custom-fields');
    await page.click('[data-testid="add-field-button"]');
    await page.fill('[data-testid="field-name"]', 'e2e_test_field');
    await page.fill('[data-testid="field-label"]', 'E2E Test Field');
    await page.selectOption('[data-testid="field-type"]', 'TEXT');
    await page.click('[data-testid="save-field-button"]');

    // Navigate to client and set value
    await page.goto('/clients/test-client-id/edit');

    // Find custom fields section
    await page.click('[data-testid="custom-fields-tab"]');

    await page.fill('[data-testid="custom-field-e2e_test_field"]', 'Test value from E2E');
    await page.click('[data-testid="save-client-button"]');

    // Verify value is saved
    await page.goto('/clients/test-client-id');
    await expect(page.locator('text=Test value from E2E')).toBeVisible();
  });

  test('should filter clients by custom field', async ({ page }) => {
    await page.goto('/clients');

    await page.click('[data-testid="filter-dropdown"]');
    await page.click('[data-testid="add-custom-field-filter"]');

    await page.selectOption('[data-testid="custom-field-select"]', 'client_tier');
    await page.selectOption('[data-testid="custom-field-value"]', 'PREMIUM');

    await page.click('[data-testid="apply-filters"]');

    // Verify filter is applied
    await expect(page.locator('[data-testid="active-filter-badge"]')).toContainText('Poziom klienta: Premium');
  });

  test('should drag and drop to reorder fields', async ({ page }) => {
    await page.goto('/settings/custom-fields');

    // Create two fields
    for (const name of ['field_a', 'field_b']) {
      await page.click('[data-testid="add-field-button"]');
      await page.fill('[data-testid="field-name"]', name);
      await page.fill('[data-testid="field-label"]', name.toUpperCase());
      await page.selectOption('[data-testid="field-type"]', 'TEXT');
      await page.click('[data-testid="save-field-button"]');
      await page.waitForSelector(`text=${name.toUpperCase()}`);
    }

    // Get field elements
    const fieldB = page.locator('[data-testid="field-item-field_b"]');
    const fieldA = page.locator('[data-testid="field-item-field_a"]');

    // Drag field_b before field_a
    await fieldB.dragTo(fieldA);

    // Verify new order
    const fields = await page.locator('[data-testid^="field-item-"]').allTextContents();
    expect(fields[0]).toContain('FIELD_B');
    expect(fields[1]).toContain('FIELD_A');
  });
});
```

---

## Security Checklist

- [x] Row Level Security enabled on both tables
- [x] Organization isolation via RLS policies
- [x] Admin-only access for field definition management
- [x] Field value validation based on type and configuration
- [x] Input sanitization via Zod schemas
- [x] SQL injection prevented via parameterized queries
- [x] XSS prevention via proper output encoding
- [x] Audit logging for all field definition changes
- [x] Soft delete with archive for data preservation
- [x] Visibility settings respected in queries

---

## Audit Events

| Event Type | Trigger | Data Captured |
|------------|---------|---------------|
| CUSTOM_FIELD_CREATED | New field definition | name, fieldType |
| CUSTOM_FIELD_UPDATED | Field modified | changed fields |
| CUSTOM_FIELD_ARCHIVED | Field archived | fieldName |
| CUSTOM_FIELD_DELETED | Field permanently removed | fieldName |
| CUSTOM_FIELD_BULK_SET | Bulk value update | fieldName, entityCount |

---

## Performance Considerations

- GIN index on `value_text` for full-text search
- GIN index on `value_json` for JSONB queries
- Composite index on `(field_id, entity_id)` for fast lookups
- Batch processing for bulk updates (100 records per transaction)
- Field definitions cached in memory per organization
- Usage counts calculated lazily with caching

---

## Implementation Notes

1. **Field Name Convention**: Use snake_case for field names to ensure consistency and prevent issues with database queries
2. **Archiving vs Deletion**: Prefer archiving over deletion to preserve historical data
3. **Option Management**: When removing select options, require migration strategy for existing values
4. **Visibility**: Respect visibility settings when displaying fields in different contexts (internal vs portal)
5. **Group Display**: Fields without group are displayed after grouped fields

---

*Last updated: December 2024*
