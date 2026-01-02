import { z } from 'zod';

// ===========================================================================
// ENUMS
// ===========================================================================

/**
 * Template status
 */
export const templateStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);
export type TemplateStatus = z.infer<typeof templateStatusSchema>;

/**
 * Amount type for template lines
 */
export const amountTypeSchema = z.enum(['FIXED', 'VARIABLE', 'FORMULA']);
export type AmountType = z.infer<typeof amountTypeSchema>;

/**
 * Variable type for template variables
 */
export const variableTypeSchema = z.enum(['STRING', 'NUMBER', 'DATE', 'ACCOUNT']);
export type VariableType = z.infer<typeof variableTypeSchema>;

/**
 * Entry type enum
 */
export const templateEntryTypeSchema = z.enum([
  'STANDARD',
  'ADJUSTING',
  'CLOSING',
  'OPENING',
  'REVERSING',
]);
export type TemplateEntryType = z.infer<typeof templateEntryTypeSchema>;

// ===========================================================================
// INPUT SCHEMAS
// ===========================================================================

/**
 * Template line input
 */
export const templateLineInputSchema = z.object({
  lineNumber: z.number().int().positive(),
  accountId: z.string().uuid().optional(),
  accountPattern: z.string().max(50).optional(),

  amountType: amountTypeSchema.default('FIXED'),
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
export type TemplateLineInput = z.infer<typeof templateLineInputSchema>;

/**
 * Template variable definition
 */
export const templateVariableInputSchema = z.object({
  variableName: z.string().min(1).max(100).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  variableType: variableTypeSchema,
  displayLabel: z.string().min(1).max(255),
  isRequired: z.boolean().default(true),
  defaultValue: z.string().optional(),
  validationPattern: z.string().optional(),
  displayOrder: z.number().int().default(0),
});
export type TemplateVariableInput = z.infer<typeof templateVariableInputSchema>;

/**
 * Create template input
 */
export const createEntryTemplateSchema = z.object({
  templateName: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  categoryId: z.string().uuid().optional(),
  entryType: templateEntryTypeSchema.default('STANDARD'),
  defaultDescription: z.string().max(1000).optional(),

  lines: z.array(templateLineInputSchema).min(2),
  variables: z.array(templateVariableInputSchema).optional(),

  sourceEntryId: z.string().uuid().optional(),
});
export type CreateEntryTemplateInput = z.infer<typeof createEntryTemplateSchema>;

/**
 * Create template from existing entry
 */
export const createTemplateFromEntrySchema = z.object({
  entryId: z.string().uuid(),
  templateName: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  categoryId: z.string().uuid().optional(),
});
export type CreateTemplateFromEntryInput = z.infer<typeof createTemplateFromEntrySchema>;

/**
 * Update template input
 */
export const updateEntryTemplateSchema = z.object({
  templateId: z.string().uuid(),
  templateName: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  entryType: templateEntryTypeSchema.optional(),
  defaultDescription: z.string().max(1000).optional(),

  lines: z.array(templateLineInputSchema).min(2).optional(),
  variables: z.array(templateVariableInputSchema).optional(),

  changeDescription: z.string().max(500).optional(),
});
export type UpdateEntryTemplateInput = z.infer<typeof updateEntryTemplateSchema>;

/**
 * Get template by ID
 */
export const getEntryTemplateSchema = z.object({
  templateId: z.string().uuid(),
});
export type GetEntryTemplateInput = z.infer<typeof getEntryTemplateSchema>;

/**
 * Archive template
 */
export const archiveEntryTemplateSchema = z.object({
  templateId: z.string().uuid(),
});
export type ArchiveEntryTemplateInput = z.infer<typeof archiveEntryTemplateSchema>;

/**
 * Restore archived template
 */
export const restoreEntryTemplateSchema = z.object({
  templateId: z.string().uuid(),
});
export type RestoreEntryTemplateInput = z.infer<typeof restoreEntryTemplateSchema>;

/**
 * Delete template
 */
export const deleteEntryTemplateSchema = z.object({
  templateId: z.string().uuid(),
});
export type DeleteEntryTemplateInput = z.infer<typeof deleteEntryTemplateSchema>;

/**
 * Generate entry from template
 */
export const generateEntryFromTemplateSchema = z.object({
  templateId: z.string().uuid(),
  entryDate: z.coerce.date(),
  variableValues: z.record(z.string(), z.union([z.string(), z.number(), z.coerce.date()])).optional(),
  overrideAmounts: z.array(z.object({
    lineNumber: z.number().int().positive(),
    debitAmount: z.number().min(0).optional(),
    creditAmount: z.number().min(0).optional(),
  })).optional(),
  customDescription: z.string().max(1000).optional(),
});
export type GenerateEntryFromTemplateInput = z.infer<typeof generateEntryFromTemplateSchema>;

/**
 * Batch generate entries from template
 */
export const batchGenerateEntriesSchema = z.object({
  templateId: z.string().uuid(),
  entries: z.array(z.object({
    entryDate: z.coerce.date(),
    variableValues: z.record(z.string(), z.union([z.string(), z.number(), z.coerce.date()])).optional(),
    customDescription: z.string().max(1000).optional(),
  })).min(1).max(12),
});
export type BatchGenerateEntriesInput = z.infer<typeof batchGenerateEntriesSchema>;

/**
 * List templates filter
 */
export const listEntryTemplatesSchema = z.object({
  status: templateStatusSchema.optional(),
  categoryId: z.string().uuid().optional(),
  entryType: templateEntryTypeSchema.optional(),
  search: z.string().max(100).optional(),
  favoritesOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});
export type ListEntryTemplatesInput = z.infer<typeof listEntryTemplatesSchema>;

/**
 * Toggle favorite
 */
export const toggleTemplateFavoriteSchema = z.object({
  templateId: z.string().uuid(),
});
export type ToggleTemplateFavoriteInput = z.infer<typeof toggleTemplateFavoriteSchema>;

/**
 * Get template versions
 */
export const getTemplateVersionsSchema = z.object({
  templateId: z.string().uuid(),
});
export type GetTemplateVersionsInput = z.infer<typeof getTemplateVersionsSchema>;

/**
 * Create category
 */
export const createTemplateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  displayOrder: z.number().int().default(0),
});
export type CreateTemplateCategoryInput = z.infer<typeof createTemplateCategorySchema>;

/**
 * Update category
 */
export const updateTemplateCategorySchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  displayOrder: z.number().int().optional(),
});
export type UpdateTemplateCategoryInput = z.infer<typeof updateTemplateCategorySchema>;

/**
 * Delete category
 */
export const deleteTemplateCategorySchema = z.object({
  categoryId: z.string().uuid(),
});
export type DeleteTemplateCategoryInput = z.infer<typeof deleteTemplateCategorySchema>;

// ===========================================================================
// ENTITY SCHEMAS
// ===========================================================================

/**
 * Template category entity
 */
export const templateCategorySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  displayOrder: z.number(),
  isSystem: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdBy: z.string().uuid().nullable(),
});
export type TemplateCategory = z.infer<typeof templateCategorySchema>;

/**
 * Template line entity
 */
export const templateLineSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  lineNumber: z.number(),
  accountId: z.string().uuid().nullable(),
  accountPattern: z.string().nullable(),
  amountType: amountTypeSchema,
  fixedDebitAmount: z.number(),
  fixedCreditAmount: z.number(),
  variableName: z.string().nullable(),
  formula: z.string().nullable(),
  description: z.string().nullable(),
  currencyCode: z.string(),
  taxCodeId: z.string().uuid().nullable(),
  displayOrder: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type TemplateLine = z.infer<typeof templateLineSchema>;

/**
 * Template variable entity
 */
export const templateVariableSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  variableName: z.string(),
  variableType: variableTypeSchema,
  displayLabel: z.string(),
  isRequired: z.boolean(),
  defaultValue: z.string().nullable(),
  validationPattern: z.string().nullable(),
  displayOrder: z.number(),
});
export type TemplateVariable = z.infer<typeof templateVariableSchema>;

/**
 * Entry template entity
 */
export const entryTemplateSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  templateCode: z.string(),
  templateName: z.string(),
  description: z.string().nullable(),
  categoryId: z.string().uuid().nullable(),
  entryType: templateEntryTypeSchema,
  defaultDescription: z.string().nullable(),
  status: templateStatusSchema,
  version: z.number(),
  sourceEntryId: z.string().uuid().nullable(),
  usageCount: z.number(),
  lastUsedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  archivedAt: z.coerce.date().nullable(),
  archivedBy: z.string().uuid().nullable(),
});
export type EntryTemplate = z.infer<typeof entryTemplateSchema>;

/**
 * Entry template with lines and variables
 */
export const entryTemplateWithDetailsSchema = entryTemplateSchema.extend({
  lines: z.array(templateLineSchema),
  variables: z.array(templateVariableSchema),
  category: templateCategorySchema.nullable().optional(),
});
export type EntryTemplateWithDetails = z.infer<typeof entryTemplateWithDetailsSchema>;

/**
 * Template version entity
 */
export const templateVersionSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  versionNumber: z.number(),
  templateData: z.record(z.any()),
  changeDescription: z.string().nullable(),
  createdAt: z.coerce.date(),
  createdBy: z.string().uuid().nullable(),
});
export type TemplateVersion = z.infer<typeof templateVersionSchema>;

// ===========================================================================
// RESULT SCHEMAS
// ===========================================================================

/**
 * List templates result
 */
export const listEntryTemplatesResultSchema = z.object({
  templates: z.array(entryTemplateSchema.extend({
    isFavorite: z.boolean(),
    category: templateCategorySchema.nullable().optional(),
  })),
  total: z.number(),
  hasMore: z.boolean(),
});
export type ListEntryTemplatesResult = z.infer<typeof listEntryTemplatesResultSchema>;

/**
 * Archive template result
 */
export const archiveEntryTemplateResultSchema = entryTemplateSchema;
export type ArchiveEntryTemplateResult = z.infer<typeof archiveEntryTemplateResultSchema>;

/**
 * Restore template result
 */
export const restoreEntryTemplateResultSchema = entryTemplateSchema;
export type RestoreEntryTemplateResult = z.infer<typeof restoreEntryTemplateResultSchema>;

/**
 * Delete template result
 */
export const deleteEntryTemplateResultSchema = z.object({
  success: z.boolean(),
  templateId: z.string().uuid(),
});
export type DeleteEntryTemplateResult = z.infer<typeof deleteEntryTemplateResultSchema>;

/**
 * Toggle favorite result
 */
export const toggleFavoriteResultSchema = z.object({
  isFavorite: z.boolean(),
});
export type ToggleFavoriteResult = z.infer<typeof toggleFavoriteResultSchema>;

/**
 * Batch generate result
 */
export const batchGenerateResultSchema = z.object({
  total: z.number(),
  successful: z.number(),
  failed: z.number(),
  results: z.array(z.object({
    success: z.boolean(),
    entryId: z.string().uuid().optional(),
    date: z.coerce.date().optional(),
    error: z.string().optional(),
  })),
});
export type BatchGenerateResult = z.infer<typeof batchGenerateResultSchema>;

/**
 * List categories result
 */
export const listTemplateCategoriesResultSchema = z.array(templateCategorySchema);
export type ListTemplateCategoriesResult = z.infer<typeof listTemplateCategoriesResultSchema>;

/**
 * Get template versions result
 */
export const getTemplateVersionsResultSchema = z.array(templateVersionSchema.extend({
  createdByUser: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }).nullable().optional(),
}));
export type GetTemplateVersionsResult = z.infer<typeof getTemplateVersionsResultSchema>;
