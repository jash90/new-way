import { z } from 'zod';

// ===========================================
// CRM-006: Custom Fields System
// ===========================================

// Enums
export const customFieldTypeSchema = z.enum([
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
  'CURRENCY',
]);

export const fieldVisibilitySchema = z.enum([
  'ALL',
  'INTERNAL',
  'PORTAL',
  'ADMIN_ONLY',
]);

export const entityTypeSchema = z.enum([
  'CLIENT',
  'CONTACT',
  'DOCUMENT',
]);

export type CustomFieldType = z.infer<typeof customFieldTypeSchema>;
export type FieldVisibility = z.infer<typeof fieldVisibilitySchema>;
export type EntityType = z.infer<typeof entityTypeSchema>;

// ===========================================
// FIELD TYPE CONFIGS
// ===========================================

// Text field config
export const textFieldConfigSchema = z.object({
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).max(10000).optional(),
  pattern: z.string().optional(),
  patternMessage: z.string().optional(),
});

// Number field config
export const numberFieldConfigSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  precision: z.number().int().min(0).max(10).optional(),
  step: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
});

// Currency field config
export const currencyFieldConfigSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  currency: z.string().length(3).default('PLN'),
  precision: z.number().int().min(0).max(4).default(2),
});

// Date field config
export const dateFieldConfigSchema = z.object({
  minDate: z.string().datetime().optional(),
  maxDate: z.string().datetime().optional(),
  disableFuture: z.boolean().optional(),
  disablePast: z.boolean().optional(),
});

// Select/Multiselect field config
export const selectOptionSchema = z.object({
  value: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isDefault: z.boolean().optional(),
  isDisabled: z.boolean().optional(),
});

export const selectFieldConfigSchema = z.object({
  options: z.array(selectOptionSchema).min(1).max(100),
  allowOther: z.boolean().optional(),
});

export const multiselectFieldConfigSchema = z.object({
  options: z.array(selectOptionSchema).min(1).max(100),
  minSelected: z.number().int().min(0).optional(),
  maxSelected: z.number().int().min(1).optional(),
  allowOther: z.boolean().optional(),
});

// Email field config
export const emailFieldConfigSchema = z.object({
  allowMultiple: z.boolean().optional(),
  validateDomain: z.boolean().optional(),
  allowedDomains: z.array(z.string()).optional(),
});

// Phone field config
export const phoneFieldConfigSchema = z.object({
  defaultCountryCode: z.string().default('+48'),
  allowInternational: z.boolean().default(true),
});

// URL field config
export const urlFieldConfigSchema = z.object({
  allowedProtocols: z.array(z.enum(['http', 'https', 'ftp'])).default(['https']),
  validateAccessibility: z.boolean().optional(),
});

// Checkbox field config
export const checkboxFieldConfigSchema = z.object({
  defaultValue: z.boolean().optional(),
  trueLabel: z.string().max(100).optional(),
  falseLabel: z.string().max(100).optional(),
});

// Union of all field configs
export const fieldConfigSchema = z.union([
  textFieldConfigSchema,
  numberFieldConfigSchema,
  currencyFieldConfigSchema,
  dateFieldConfigSchema,
  selectFieldConfigSchema,
  multiselectFieldConfigSchema,
  emailFieldConfigSchema,
  phoneFieldConfigSchema,
  urlFieldConfigSchema,
  checkboxFieldConfigSchema,
  z.object({}), // Empty config for simple types
]);

export type SelectOption = z.infer<typeof selectOptionSchema>;
export type FieldConfig = z.infer<typeof fieldConfigSchema>;

// ===========================================
// VALIDATION RULES
// ===========================================

export const validationRuleSchema = z.object({
  type: z.enum(['required', 'pattern', 'custom', 'unique', 'range']),
  value: z.unknown().optional(),
  message: z.string().max(500),
});

export type ValidationRule = z.infer<typeof validationRuleSchema>;

// ===========================================
// INPUT SCHEMAS
// ===========================================

// Create Field Definition
export const createFieldDefinitionSchema = z.object({
  name: z.string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9_]*$/, 'Name must start with lowercase letter and contain only lowercase letters, numbers, and underscores'),
  label: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  fieldType: customFieldTypeSchema,
  config: fieldConfigSchema.optional(),
  isRequired: z.boolean().default(false),
  validationRules: z.array(validationRuleSchema).optional(),
  displayOrder: z.number().int().min(0).default(0),
  groupName: z.string().max(100).optional(),
  visibility: fieldVisibilitySchema.default('ALL'),
  placeholder: z.string().max(200).optional(),
  helpText: z.string().max(1000).optional(),
  entityType: entityTypeSchema.default('CLIENT'),
});

export type CreateFieldDefinitionInput = z.infer<typeof createFieldDefinitionSchema>;

// Update Field Definition
export const updateFieldDefinitionSchema = z.object({
  fieldId: z.string().uuid(),
  label: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  config: fieldConfigSchema.optional(),
  isRequired: z.boolean().optional(),
  validationRules: z.array(validationRuleSchema).optional().nullable(),
  displayOrder: z.number().int().min(0).optional(),
  groupName: z.string().max(100).optional().nullable(),
  visibility: fieldVisibilitySchema.optional(),
  placeholder: z.string().max(200).optional().nullable(),
  helpText: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type UpdateFieldDefinitionInput = z.infer<typeof updateFieldDefinitionSchema>;

// Get Field Definitions
export const getFieldDefinitionsSchema = z.object({
  entityType: entityTypeSchema.optional(),
  groupName: z.string().max(100).optional(),
  includeArchived: z.boolean().default(false),
  includeInactive: z.boolean().default(false),
});

export type GetFieldDefinitionsInput = z.infer<typeof getFieldDefinitionsSchema>;

// Archive Field Definition
export const archiveFieldDefinitionSchema = z.object({
  fieldId: z.string().uuid(),
});

export type ArchiveFieldDefinitionInput = z.infer<typeof archiveFieldDefinitionSchema>;

// Delete Field Definition
export const deleteFieldDefinitionSchema = z.object({
  fieldId: z.string().uuid(),
  force: z.boolean().default(false), // Force delete even if values exist
});

export type DeleteFieldDefinitionInput = z.infer<typeof deleteFieldDefinitionSchema>;

// Reorder Fields
export const reorderFieldsSchema = z.object({
  entityType: entityTypeSchema,
  fieldOrders: z.array(z.object({
    fieldId: z.string().uuid(),
    displayOrder: z.number().int().min(0),
  })).min(1),
});

export type ReorderFieldsInput = z.infer<typeof reorderFieldsSchema>;

// ===========================================
// FIELD VALUE SCHEMAS
// ===========================================

// Base value type that can hold any field value
export const fieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.date(),
  z.array(z.string()), // For multiselect
  z.null(),
]);

export type FieldValue = z.infer<typeof fieldValueSchema>;

// Set Field Value
export const setFieldValueSchema = z.object({
  fieldId: z.string().uuid(),
  entityType: entityTypeSchema,
  entityId: z.string().uuid(),
  value: fieldValueSchema,
});

export type SetFieldValueInput = z.infer<typeof setFieldValueSchema>;

// Bulk Set Field Values (for one entity)
export const bulkSetEntityValuesSchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().uuid(),
  values: z.array(z.object({
    fieldId: z.string().uuid(),
    value: fieldValueSchema,
  })).min(1),
});

export type BulkSetEntityValuesInput = z.infer<typeof bulkSetEntityValuesSchema>;

// Bulk Set Field Value (for multiple entities)
export const bulkSetFieldValueSchema = z.object({
  fieldId: z.string().uuid(),
  entityType: entityTypeSchema,
  entityIds: z.array(z.string().uuid()).min(1).max(100),
  value: fieldValueSchema,
});

export type BulkSetFieldValueInput = z.infer<typeof bulkSetFieldValueSchema>;

// Get Entity Values
export const getEntityValuesSchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().uuid(),
});

export type GetEntityValuesInput = z.infer<typeof getEntityValuesSchema>;

// Clear Field Value
export const clearFieldValueSchema = z.object({
  fieldId: z.string().uuid(),
  entityId: z.string().uuid(),
});

export type ClearFieldValueInput = z.infer<typeof clearFieldValueSchema>;

// Get Option Usage (for SELECT/MULTISELECT fields)
export const getOptionUsageSchema = z.object({
  fieldId: z.string().uuid(),
});

export type GetOptionUsageInput = z.infer<typeof getOptionUsageSchema>;

// ===========================================
// OUTPUT SCHEMAS
// ===========================================

// Field Definition Output
export const fieldDefinitionOutputSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  fieldType: customFieldTypeSchema,
  config: z.record(z.unknown()),
  isRequired: z.boolean(),
  validationRules: z.array(validationRuleSchema).nullable(),
  displayOrder: z.number(),
  groupName: z.string().nullable(),
  visibility: fieldVisibilitySchema,
  placeholder: z.string().nullable(),
  helpText: z.string().nullable(),
  entityType: z.string(),
  isActive: z.boolean(),
  isArchived: z.boolean(),
  archivedAt: z.date().nullable(),
  archivedBy: z.string().uuid().nullable(),
  createdAt: z.date(),
  createdBy: z.string().uuid(),
  updatedAt: z.date(),
  updatedBy: z.string().uuid().nullable(),
});

export type FieldDefinitionOutput = z.infer<typeof fieldDefinitionOutputSchema>;

// Field Value Output
export const fieldValueOutputSchema = z.object({
  id: z.string().uuid(),
  fieldId: z.string().uuid(),
  fieldName: z.string(),
  fieldLabel: z.string(),
  fieldType: customFieldTypeSchema,
  entityType: z.string(),
  entityId: z.string().uuid(),
  value: fieldValueSchema,
  displayValue: z.string(), // Formatted value for display
  createdAt: z.date(),
  createdBy: z.string().uuid(),
  updatedAt: z.date(),
  updatedBy: z.string().uuid().nullable(),
});

export type FieldValueOutput = z.infer<typeof fieldValueOutputSchema>;

// Entity Custom Fields (all values for an entity)
export const entityCustomFieldsOutputSchema = z.object({
  entityType: z.string(),
  entityId: z.string().uuid(),
  values: z.array(fieldValueOutputSchema),
  groups: z.record(z.string(), z.array(fieldValueOutputSchema)),
});

export type EntityCustomFieldsOutput = z.infer<typeof entityCustomFieldsOutputSchema>;

// Option Usage Output
export const optionUsageOutputSchema = z.object({
  fieldId: z.string().uuid(),
  fieldName: z.string(),
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
    usageCount: z.number().int(),
    percentage: z.number(),
  })),
  totalUsage: z.number().int(),
});

export type OptionUsageOutput = z.infer<typeof optionUsageOutputSchema>;

// ===========================================
// RESULT SCHEMAS
// ===========================================

export const fieldDefinitionCreateResultSchema = z.object({
  success: z.boolean(),
  fieldDefinition: fieldDefinitionOutputSchema,
  message: z.string().optional(),
});

export type FieldDefinitionCreateResult = z.infer<typeof fieldDefinitionCreateResultSchema>;

export const fieldDefinitionUpdateResultSchema = z.object({
  success: z.boolean(),
  fieldDefinition: fieldDefinitionOutputSchema,
  message: z.string().optional(),
});

export type FieldDefinitionUpdateResult = z.infer<typeof fieldDefinitionUpdateResultSchema>;

export const fieldDefinitionArchiveResultSchema = z.object({
  success: z.boolean(),
  fieldDefinition: fieldDefinitionOutputSchema,
  valuesPreserved: z.number().int(),
  message: z.string(),
});

export type FieldDefinitionArchiveResult = z.infer<typeof fieldDefinitionArchiveResultSchema>;

export const fieldDefinitionDeleteResultSchema = z.object({
  success: z.boolean(),
  deletedValuesCount: z.number().int(),
  message: z.string(),
});

export type FieldDefinitionDeleteResult = z.infer<typeof fieldDefinitionDeleteResultSchema>;

export const fieldValueSetResultSchema = z.object({
  success: z.boolean(),
  fieldValue: fieldValueOutputSchema,
  message: z.string().optional(),
});

export type FieldValueSetResult = z.infer<typeof fieldValueSetResultSchema>;

export const bulkSetResultSchema = z.object({
  success: z.boolean(),
  updatedCount: z.number().int(),
  failedCount: z.number().int(),
  errors: z.array(z.object({
    entityId: z.string().uuid(),
    error: z.string(),
  })).optional(),
  message: z.string(),
});

export type BulkSetResult = z.infer<typeof bulkSetResultSchema>;

export const reorderFieldsResultSchema = z.object({
  success: z.boolean(),
  updatedCount: z.number().int(),
  message: z.string(),
});

export type ReorderFieldsResult = z.infer<typeof reorderFieldsResultSchema>;

export const fieldDefinitionListResultSchema = z.object({
  fieldDefinitions: z.array(fieldDefinitionOutputSchema),
  total: z.number().int(),
  byGroup: z.record(z.string(), z.array(fieldDefinitionOutputSchema)),
});

export type FieldDefinitionListResult = z.infer<typeof fieldDefinitionListResultSchema>;
