// DOC-004: Document Classification Schema
// Automatic document type detection and categorization

import { z } from 'zod';
import { documentCategorySchema } from './document.schema';

// =========================================================================
// ENUMS
// =========================================================================

/**
 * Classification method used
 */
export const classificationMethodSchema = z.enum([
  'AI', // AI-based classification
  'RULE_BASED', // Rule-based classification
  'MANUAL', // Manual classification
  'HYBRID', // Combination of methods
]);
export type ClassificationMethod = z.infer<typeof classificationMethodSchema>;

/**
 * Classification status
 */
export const classificationStatusSchema = z.enum([
  'PENDING', // Waiting for classification
  'IN_PROGRESS', // Classification in progress
  'COMPLETED', // Successfully classified
  'FAILED', // Classification failed
  'NEEDS_REVIEW', // Requires manual review
]);
export type ClassificationStatus = z.infer<typeof classificationStatusSchema>;

/**
 * Classification priority
 */
export const classificationPrioritySchema = z.enum([
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
]);
export type ClassificationPriority = z.infer<typeof classificationPrioritySchema>;

/**
 * Document sub-types for more specific classification
 */
export const documentSubTypeSchema = z.enum([
  // Invoice sub-types
  'INVOICE_VAT',
  'INVOICE_PROFORMA',
  'INVOICE_CORRECTION',
  'INVOICE_ADVANCE',
  'INVOICE_MARGIN',
  'INVOICE_SELF_BILLING',

  // Receipt sub-types
  'RECEIPT_STANDARD',
  'RECEIPT_FISCAL',
  'RECEIPT_EXPENSE',

  // Contract sub-types
  'CONTRACT_EMPLOYMENT',
  'CONTRACT_SERVICE',
  'CONTRACT_LEASE',
  'CONTRACT_NDA',
  'CONTRACT_COOPERATION',

  // Bank statement sub-types
  'STATEMENT_ACCOUNT',
  'STATEMENT_CARD',
  'STATEMENT_LOAN',

  // Tax document sub-types
  'TAX_PIT',
  'TAX_CIT',
  'TAX_VAT',
  'TAX_ZUS',
  'TAX_ASSESSMENT',

  // Other sub-types
  'OTHER',
]);
export type DocumentSubType = z.infer<typeof documentSubTypeSchema>;

// =========================================================================
// CLASSIFICATION RESULT
// =========================================================================

/**
 * Classification prediction with confidence
 */
export const classificationPredictionSchema = z.object({
  category: documentCategorySchema,
  subType: documentSubTypeSchema.optional(),
  confidence: z.number().min(0).max(1),
  keywords: z.array(z.string()).optional(),
  reasoning: z.string().optional(),
});
export type ClassificationPrediction = z.infer<typeof classificationPredictionSchema>;

/**
 * Full classification result
 */
export const classificationResultSchema = z.object({
  documentId: z.string().uuid(),
  classificationId: z.string().uuid(),
  method: classificationMethodSchema,
  status: classificationStatusSchema,

  // Primary prediction
  primaryPrediction: classificationPredictionSchema,

  // Alternative predictions (for ambiguous documents)
  alternativePredictions: z.array(classificationPredictionSchema).optional(),

  // Features extracted for classification
  extractedFeatures: z.object({
    hasInvoiceNumber: z.boolean().optional(),
    hasNip: z.boolean().optional(),
    hasBankAccount: z.boolean().optional(),
    hasDate: z.boolean().optional(),
    hasSignature: z.boolean().optional(),
    hasStamp: z.boolean().optional(),
    language: z.string().optional(),
    pageCount: z.number().int().positive().optional(),
    keywordsFound: z.array(z.string()).optional(),
  }).optional(),

  // Processing metadata
  processingTimeMs: z.number().int().nonnegative().optional(),
  modelUsed: z.string().optional(),
  modelVersion: z.string().optional(),

  // Timestamps
  createdAt: z.date(),
  completedAt: z.date().optional(),
});
export type ClassificationResult = z.infer<typeof classificationResultSchema>;

// =========================================================================
// CLASSIFICATION RULES
// =========================================================================

/**
 * Classification rule definition
 */
export const classificationRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),

  // Rule conditions
  conditions: z.object({
    keywords: z.array(z.string()).optional(),
    patterns: z.array(z.string()).optional(), // Regex patterns
    mimeTypes: z.array(z.string()).optional(),
    fileExtensions: z.array(z.string()).optional(),
    minFileSize: z.number().int().nonnegative().optional(),
    maxFileSize: z.number().int().nonnegative().optional(),
    requiredFields: z.array(z.string()).optional(),
  }),

  // Rule result
  resultCategory: documentCategorySchema,
  resultSubType: documentSubTypeSchema.optional(),

  // Rule metadata
  priority: z.number().int().min(0).max(100).default(50),
  isActive: z.boolean().default(true),

  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type ClassificationRule = z.infer<typeof classificationRuleSchema>;

// =========================================================================
// INPUT SCHEMAS
// =========================================================================

/**
 * Request classification for a document
 */
export const requestClassificationInputSchema = z.object({
  documentId: z.string().uuid(),
  method: classificationMethodSchema.default('AI'),
  priority: classificationPrioritySchema.default('NORMAL'),
  forceReclassify: z.boolean().default(false), // Reclassify even if already done
  includeAlternatives: z.boolean().default(true), // Include alternative predictions
  minConfidence: z.number().min(0).max(1).default(0.7), // Minimum confidence threshold
});
export type RequestClassificationInput = z.infer<typeof requestClassificationInputSchema>;

/**
 * Get classification result
 */
export const getClassificationResultInputSchema = z.object({
  classificationId: z.string().uuid(),
});
export type GetClassificationResultInput = z.infer<typeof getClassificationResultInputSchema>;

/**
 * Get classification by document ID
 */
export const getDocumentClassificationInputSchema = z.object({
  documentId: z.string().uuid(),
  includeHistory: z.boolean().default(false),
});
export type GetDocumentClassificationInput = z.infer<typeof getDocumentClassificationInputSchema>;

/**
 * Override classification (manual)
 */
export const overrideClassificationInputSchema = z.object({
  documentId: z.string().uuid(),
  category: documentCategorySchema,
  subType: documentSubTypeSchema.optional(),
  notes: z.string().max(1000).optional(),
});
export type OverrideClassificationInput = z.infer<typeof overrideClassificationInputSchema>;

/**
 * Batch classification request
 */
export const batchClassificationInputSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(100),
  method: classificationMethodSchema.default('AI'),
  priority: classificationPrioritySchema.default('NORMAL'),
  options: z.object({
    stopOnError: z.boolean().default(false),
    skipAlreadyClassified: z.boolean().default(true),
  }).optional(),
});
export type BatchClassificationInput = z.infer<typeof batchClassificationInputSchema>;

/**
 * List classifications
 */
export const listClassificationsInputSchema = z.object({
  documentId: z.string().uuid().optional(),
  category: documentCategorySchema.optional(),
  status: classificationStatusSchema.optional(),
  method: classificationMethodSchema.optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  maxConfidence: z.number().min(0).max(1).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});
export type ListClassificationsInput = z.infer<typeof listClassificationsInputSchema>;

// =========================================================================
// RULE MANAGEMENT INPUT SCHEMAS
// =========================================================================

/**
 * Create classification rule
 */
export const createClassificationRuleInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  conditions: z.object({
    keywords: z.array(z.string()).optional(),
    patterns: z.array(z.string()).optional(),
    mimeTypes: z.array(z.string()).optional(),
    fileExtensions: z.array(z.string()).optional(),
    minFileSize: z.number().int().nonnegative().optional(),
    maxFileSize: z.number().int().nonnegative().optional(),
    requiredFields: z.array(z.string()).optional(),
  }),
  resultCategory: documentCategorySchema,
  resultSubType: documentSubTypeSchema.optional(),
  priority: z.number().int().min(0).max(100).default(50),
  isActive: z.boolean().default(true),
});
export type CreateClassificationRuleInput = z.infer<typeof createClassificationRuleInputSchema>;

/**
 * Update classification rule
 */
export const updateClassificationRuleInputSchema = z.object({
  ruleId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  conditions: z.object({
    keywords: z.array(z.string()).optional(),
    patterns: z.array(z.string()).optional(),
    mimeTypes: z.array(z.string()).optional(),
    fileExtensions: z.array(z.string()).optional(),
    minFileSize: z.number().int().nonnegative().optional(),
    maxFileSize: z.number().int().nonnegative().optional(),
    requiredFields: z.array(z.string()).optional(),
  }).optional(),
  resultCategory: documentCategorySchema.optional(),
  resultSubType: documentSubTypeSchema.optional(),
  priority: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateClassificationRuleInput = z.infer<typeof updateClassificationRuleInputSchema>;

/**
 * Delete classification rule
 */
export const deleteClassificationRuleInputSchema = z.object({
  ruleId: z.string().uuid(),
});
export type DeleteClassificationRuleInput = z.infer<typeof deleteClassificationRuleInputSchema>;

/**
 * List classification rules
 */
export const listClassificationRulesInputSchema = z.object({
  category: documentCategorySchema.optional(),
  isActive: z.boolean().optional(),
  search: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});
export type ListClassificationRulesInput = z.infer<typeof listClassificationRulesInputSchema>;

// =========================================================================
// OUTPUT SCHEMAS
// =========================================================================

/**
 * Classification job response
 */
export const classificationJobResponseSchema = z.object({
  classificationId: z.string().uuid(),
  documentId: z.string().uuid(),
  method: classificationMethodSchema,
  status: classificationStatusSchema,
  estimatedTimeMs: z.number().int().nonnegative().optional(),
  queuePosition: z.number().int().nonnegative().optional(),
});
export type ClassificationJobResponse = z.infer<typeof classificationJobResponseSchema>;

/**
 * Classification result response
 */
export const classificationResultResponseSchema = classificationResultSchema;
export type ClassificationResultResponse = ClassificationResult;

/**
 * Classification list response
 */
export const classificationListResponseSchema = z.object({
  items: z.array(z.object({
    classificationId: z.string().uuid(),
    documentId: z.string().uuid(),
    documentName: z.string(),
    category: documentCategorySchema,
    subType: documentSubTypeSchema.optional(),
    confidence: z.number().min(0).max(1),
    method: classificationMethodSchema,
    status: classificationStatusSchema,
    createdAt: z.date(),
    completedAt: z.date().optional(),
  })),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});
export type ClassificationListResponse = z.infer<typeof classificationListResponseSchema>;

/**
 * Batch classification response
 */
export const batchClassificationResponseSchema = z.object({
  batchId: z.string().uuid(),
  jobs: z.array(classificationJobResponseSchema),
  totalDocuments: z.number().int().positive(),
  queuedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  estimatedTotalTime: z.number().int().nonnegative().optional(),
});
export type BatchClassificationResponse = z.infer<typeof batchClassificationResponseSchema>;

/**
 * Override classification response
 */
export const overrideClassificationResponseSchema = z.object({
  documentId: z.string().uuid(),
  previousCategory: documentCategorySchema.optional(),
  newCategory: documentCategorySchema,
  newSubType: documentSubTypeSchema.optional(),
  overriddenAt: z.date(),
  overriddenBy: z.string(),
});
export type OverrideClassificationResponse = z.infer<typeof overrideClassificationResponseSchema>;

/**
 * Rule list response
 */
export const classificationRuleListResponseSchema = z.object({
  items: z.array(classificationRuleSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});
export type ClassificationRuleListResponse = z.infer<typeof classificationRuleListResponseSchema>;

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: string): string {
  const names: Record<string, string> = {
    INVOICE: 'Faktura',
    RECEIPT: 'Paragon',
    CONTRACT: 'Umowa',
    BANK_STATEMENT: 'Wyciag bankowy',
    TAX_DOCUMENT: 'Dokument podatkowy',
    PAYROLL: 'Lista plac',
    OTHER: 'Inny',
    CORRESPONDENCE: 'Korespondencja',
    REPORT: 'Raport',
  };
  return names[category] || category;
}

/**
 * Get sub-type display name
 */
export function getSubTypeDisplayName(subType: string): string {
  const names: Record<string, string> = {
    INVOICE_VAT: 'Faktura VAT',
    INVOICE_PROFORMA: 'Faktura proforma',
    INVOICE_CORRECTION: 'Faktura korygujaca',
    INVOICE_ADVANCE: 'Faktura zaliczkowa',
    INVOICE_MARGIN: 'Faktura marza',
    INVOICE_SELF_BILLING: 'Samofakturowanie',
    RECEIPT_STANDARD: 'Paragon standardowy',
    RECEIPT_FISCAL: 'Paragon fiskalny',
    RECEIPT_EXPENSE: 'Paragon kosztowy',
    CONTRACT_EMPLOYMENT: 'Umowa o prace',
    CONTRACT_SERVICE: 'Umowa o swiadczenie uslug',
    CONTRACT_LEASE: 'Umowa najmu',
    CONTRACT_NDA: 'Umowa o poufnosci',
    CONTRACT_COOPERATION: 'Umowa o wspolpracy',
    STATEMENT_ACCOUNT: 'Wyciag z konta',
    STATEMENT_CARD: 'Wyciag z karty',
    STATEMENT_LOAN: 'Wyciag kredytowy',
    TAX_PIT: 'Deklaracja PIT',
    TAX_CIT: 'Deklaracja CIT',
    TAX_VAT: 'Deklaracja VAT',
    TAX_ZUS: 'Deklaracja ZUS',
    TAX_ASSESSMENT: 'Decyzja podatkowa',
    OTHER: 'Inny',
  };
  return names[subType] || subType;
}

/**
 * Check if classification confidence is acceptable
 */
export function isClassificationConfidenceAcceptable(
  confidence: number,
  threshold: number = 0.7
): boolean {
  return confidence >= threshold;
}

/**
 * Get confidence level description
 */
export function getConfidenceLevel(confidence: number): string {
  if (confidence >= 0.95) return 'Bardzo wysoka';
  if (confidence >= 0.85) return 'Wysoka';
  if (confidence >= 0.7) return 'Srednia';
  if (confidence >= 0.5) return 'Niska';
  return 'Bardzo niska';
}
