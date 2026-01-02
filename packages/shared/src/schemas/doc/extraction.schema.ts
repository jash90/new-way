// DOC-003: AI Data Extraction Schemas
// AI-powered structured data extraction from documents

import { z } from 'zod';
import { documentCategorySchema } from './document.schema';

// =========================================================================
// ENUMS
// =========================================================================

/**
 * AI extraction model options
 */
export const aiModelSchema = z.enum([
  'GPT_4_VISION',
  'GPT_4_TURBO',
  'CLAUDE_3_OPUS',
  'CLAUDE_3_SONNET',
  'CLAUDE_3_HAIKU',
  'GEMINI_PRO',
  'CUSTOM',
]);
export type AiModel = z.infer<typeof aiModelSchema>;

/**
 * Extraction template types for different document categories
 */
export const extractionTemplateTypeSchema = z.enum([
  'INVOICE',
  'RECEIPT',
  'CONTRACT',
  'BANK_STATEMENT',
  'TAX_DOCUMENT',
  'PAYROLL',
  'PURCHASE_ORDER',
  'DELIVERY_NOTE',
  'CREDIT_NOTE',
  'CUSTOM',
]);
export type ExtractionTemplateType = z.infer<typeof extractionTemplateTypeSchema>;

/**
 * Field types for extracted data
 */
export const extractionFieldTypeSchema = z.enum([
  'STRING',
  'NUMBER',
  'CURRENCY',
  'DATE',
  'BOOLEAN',
  'ARRAY',
  'OBJECT',
  'NIP',         // Polish tax ID
  'REGON',       // Polish business registry number
  'KRS',         // Polish court registry number
  'IBAN',        // International bank account
  'PERCENTAGE',
  'ADDRESS',
  'PHONE',
  'EMAIL',
]);
export type ExtractionFieldType = z.infer<typeof extractionFieldTypeSchema>;

/**
 * Extraction job status
 */
export const extractionJobStatusSchema = z.enum([
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'REQUIRES_REVIEW',
]);
export type ExtractionJobStatus = z.infer<typeof extractionJobStatusSchema>;

/**
 * Extraction priority
 */
export const extractionPrioritySchema = z.enum([
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
]);
export type ExtractionPriority = z.infer<typeof extractionPrioritySchema>;

// =========================================================================
// FIELD DEFINITION SCHEMAS
// =========================================================================

/**
 * Extraction field definition for templates
 */
export const extractionFieldDefSchema = z.object({
  name: z.string().min(1).max(100),
  displayName: z.string().min(1).max(200),
  type: extractionFieldTypeSchema,
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  validation: z.object({
    pattern: z.string().optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    allowedValues: z.array(z.string()).optional(),
  }).optional(),
  description: z.string().max(500).optional(),
  extractionHints: z.array(z.string()).optional(), // Hints for AI model
});
export type ExtractionFieldDef = z.infer<typeof extractionFieldDefSchema>;

/**
 * Extracted field result with confidence
 */
export const extractedFieldSchema = z.object({
  name: z.string(),
  value: z.unknown(),
  rawValue: z.string().optional(), // Original text from document
  confidence: z.number().min(0).max(1),
  boundingBox: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    page: z.number().int().positive(),
  }).optional(),
  validationPassed: z.boolean().optional(),
  validationErrors: z.array(z.string()).optional(),
});
export type ExtractedField = z.infer<typeof extractedFieldSchema>;

// =========================================================================
// TEMPLATE SCHEMAS
// =========================================================================

/**
 * Extraction template entity
 */
export const extractionTemplateSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  templateType: extractionTemplateTypeSchema,
  documentCategory: documentCategorySchema.optional(),
  fields: z.array(extractionFieldDefSchema),
  aiModel: aiModelSchema.default('CLAUDE_3_SONNET'),
  systemPrompt: z.string().max(5000).optional(), // Custom AI instructions
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid(),
  usageCount: z.number().int().nonnegative().default(0),
});
export type ExtractionTemplate = z.infer<typeof extractionTemplateSchema>;

// =========================================================================
// EXTRACTION RESULT SCHEMAS
// =========================================================================

/**
 * Invoice-specific extracted data
 */
export const invoiceExtractionDataSchema = z.object({
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  seller: z.object({
    name: z.string().optional(),
    nip: z.string().optional(),
    regon: z.string().optional(),
    address: z.string().optional(),
    bankAccount: z.string().optional(),
    bankName: z.string().optional(),
  }).optional(),
  buyer: z.object({
    name: z.string().optional(),
    nip: z.string().optional(),
    regon: z.string().optional(),
    address: z.string().optional(),
  }).optional(),
  lineItems: z.array(z.object({
    description: z.string().optional(),
    quantity: z.number().optional(),
    unit: z.string().optional(),
    unitPrice: z.number().optional(),
    netAmount: z.number().optional(),
    vatRate: z.number().optional(),
    vatAmount: z.number().optional(),
    grossAmount: z.number().optional(),
  })).optional(),
  netTotal: z.number().optional(),
  vatTotal: z.number().optional(),
  grossTotal: z.number().optional(),
  currency: z.string().optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});
export type InvoiceExtractionData = z.infer<typeof invoiceExtractionDataSchema>;

/**
 * Receipt-specific extracted data
 */
export const receiptExtractionDataSchema = z.object({
  receiptNumber: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  merchant: z.object({
    name: z.string().optional(),
    nip: z.string().optional(),
    address: z.string().optional(),
  }).optional(),
  items: z.array(z.object({
    name: z.string().optional(),
    quantity: z.number().optional(),
    unitPrice: z.number().optional(),
    totalPrice: z.number().optional(),
    vatRate: z.number().optional(),
  })).optional(),
  subtotal: z.number().optional(),
  vatBreakdown: z.array(z.object({
    rate: z.number(),
    netAmount: z.number(),
    vatAmount: z.number(),
  })).optional(),
  total: z.number().optional(),
  paymentMethod: z.string().optional(),
  cashier: z.string().optional(),
});
export type ReceiptExtractionData = z.infer<typeof receiptExtractionDataSchema>;

/**
 * Bank statement extracted data
 */
export const bankStatementExtractionDataSchema = z.object({
  accountNumber: z.string().optional(),
  accountHolder: z.string().optional(),
  bankName: z.string().optional(),
  statementPeriod: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }).optional(),
  openingBalance: z.number().optional(),
  closingBalance: z.number().optional(),
  transactions: z.array(z.object({
    date: z.string().optional(),
    description: z.string().optional(),
    reference: z.string().optional(),
    debit: z.number().optional(),
    credit: z.number().optional(),
    balance: z.number().optional(),
    category: z.string().optional(),
  })).optional(),
  totalDebits: z.number().optional(),
  totalCredits: z.number().optional(),
});
export type BankStatementExtractionData = z.infer<typeof bankStatementExtractionDataSchema>;

/**
 * Generic extraction result
 */
export const extractionResultSchema = z.object({
  extractionId: z.string().uuid(),
  documentId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  templateType: extractionTemplateTypeSchema.optional(),
  aiModel: aiModelSchema,
  fields: z.array(extractedFieldSchema),
  structuredData: z.record(z.unknown()),
  overallConfidence: z.number().min(0).max(1),
  processingTimeMs: z.number().int().nonnegative(),
  tokenUsage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    estimatedCost: z.number().nonnegative().optional(),
  }).optional(),
  rawAiResponse: z.string().optional(), // For debugging
  warnings: z.array(z.string()).optional(),
  requiresReview: z.boolean().default(false),
  reviewNotes: z.string().optional(),
});
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

// =========================================================================
// INPUT SCHEMAS
// =========================================================================

/**
 * Request AI extraction input
 */
export const requestExtractionInputSchema = z.object({
  documentId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  templateType: extractionTemplateTypeSchema.optional(),
  aiModel: aiModelSchema.optional(),
  priority: extractionPrioritySchema.default('NORMAL'),
  customFields: z.array(extractionFieldDefSchema).optional(),
  customPrompt: z.string().max(5000).optional(),
  includeOcrText: z.boolean().default(true), // Use OCR text if available
  language: z.string().default('pl'),
  options: z.object({
    extractLineItems: z.boolean().default(true),
    extractSignatures: z.boolean().default(false),
    extractTables: z.boolean().default(true),
    validateNip: z.boolean().default(true),
    validateIban: z.boolean().default(true),
    detectCurrency: z.boolean().default(true),
  }).optional(),
});
export type RequestExtractionInput = z.infer<typeof requestExtractionInputSchema>;

/**
 * Get extraction result input
 */
export const getExtractionResultInputSchema = z.object({
  extractionId: z.string().uuid(),
  includeRawResponse: z.boolean().default(false),
});
export type GetExtractionResultInput = z.infer<typeof getExtractionResultInputSchema>;

/**
 * List extractions input
 */
export const listExtractionsInputSchema = z.object({
  documentId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  status: extractionJobStatusSchema.optional(),
  requiresReview: z.boolean().optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  maxConfidence: z.number().min(0).max(1).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});
export type ListExtractionsInput = z.infer<typeof listExtractionsInputSchema>;

/**
 * Update extraction input (manual corrections)
 */
export const updateExtractionInputSchema = z.object({
  extractionId: z.string().uuid(),
  corrections: z.record(z.unknown()),
  markAsReviewed: z.boolean().default(true),
  reviewNotes: z.string().max(2000).optional(),
});
export type UpdateExtractionInput = z.infer<typeof updateExtractionInputSchema>;

/**
 * Re-extract with different settings
 */
export const reExtractInputSchema = z.object({
  extractionId: z.string().uuid(),
  aiModel: aiModelSchema.optional(),
  templateId: z.string().uuid().optional(),
  customPrompt: z.string().max(5000).optional(),
  priority: extractionPrioritySchema.default('NORMAL'),
});
export type ReExtractInput = z.infer<typeof reExtractInputSchema>;

/**
 * Batch extraction input
 */
export const batchExtractionInputSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(50),
  templateId: z.string().uuid().optional(),
  templateType: extractionTemplateTypeSchema.optional(),
  aiModel: aiModelSchema.optional(),
  priority: extractionPrioritySchema.default('NORMAL'),
  options: z.object({
    stopOnError: z.boolean().default(false),
    parallelProcessing: z.boolean().default(true),
    maxConcurrent: z.number().int().min(1).max(10).default(5),
  }).optional(),
});
export type BatchExtractionInput = z.infer<typeof batchExtractionInputSchema>;

// =========================================================================
// TEMPLATE MANAGEMENT INPUT SCHEMAS
// =========================================================================

/**
 * Create extraction template input
 */
export const createExtractionTemplateInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  templateType: extractionTemplateTypeSchema,
  documentCategory: documentCategorySchema.optional(),
  fields: z.array(extractionFieldDefSchema).min(1),
  aiModel: aiModelSchema.default('CLAUDE_3_SONNET'),
  systemPrompt: z.string().max(5000).optional(),
  isDefault: z.boolean().default(false),
});
export type CreateExtractionTemplateInput = z.infer<typeof createExtractionTemplateInputSchema>;

/**
 * Update extraction template input
 */
export const updateExtractionTemplateInputSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  fields: z.array(extractionFieldDefSchema).optional(),
  aiModel: aiModelSchema.optional(),
  systemPrompt: z.string().max(5000).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateExtractionTemplateInput = z.infer<typeof updateExtractionTemplateInputSchema>;

/**
 * Get extraction template input
 */
export const getExtractionTemplateInputSchema = z.object({
  templateId: z.string().uuid(),
});
export type GetExtractionTemplateInput = z.infer<typeof getExtractionTemplateInputSchema>;

/**
 * List extraction templates input
 */
export const listExtractionTemplatesInputSchema = z.object({
  templateType: extractionTemplateTypeSchema.optional(),
  documentCategory: documentCategorySchema.optional(),
  isActive: z.boolean().optional(),
  search: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});
export type ListExtractionTemplatesInput = z.infer<typeof listExtractionTemplatesInputSchema>;

/**
 * Delete extraction template input
 */
export const deleteExtractionTemplateInputSchema = z.object({
  templateId: z.string().uuid(),
});
export type DeleteExtractionTemplateInput = z.infer<typeof deleteExtractionTemplateInputSchema>;

// =========================================================================
// OUTPUT SCHEMAS
// =========================================================================

/**
 * Extraction job response
 */
export const extractionJobResponseSchema = z.object({
  jobId: z.string().uuid(),
  extractionId: z.string().uuid(),
  documentId: z.string().uuid(),
  status: extractionJobStatusSchema,
  priority: extractionPrioritySchema,
  templateId: z.string().uuid().optional(),
  aiModel: aiModelSchema,
  queuePosition: z.number().int().nonnegative().optional(),
  estimatedWaitTime: z.number().int().nonnegative().optional(), // seconds
  createdAt: z.date(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
});
export type ExtractionJobResponse = z.infer<typeof extractionJobResponseSchema>;

/**
 * Extraction result response
 */
export const extractionResultResponseSchema = z.object({
  extraction: extractionResultSchema,
  document: z.object({
    id: z.string().uuid(),
    name: z.string(),
    mimeType: z.string(),
    size: z.number().int().nonnegative(),
  }),
  template: extractionTemplateSchema.optional(),
  status: extractionJobStatusSchema,
});
export type ExtractionResultResponse = z.infer<typeof extractionResultResponseSchema>;

/**
 * Extraction list response
 */
export const extractionListResponseSchema = z.object({
  items: z.array(z.object({
    extractionId: z.string().uuid(),
    documentId: z.string().uuid(),
    documentName: z.string(),
    templateType: extractionTemplateTypeSchema.optional(),
    aiModel: aiModelSchema,
    status: extractionJobStatusSchema,
    overallConfidence: z.number().min(0).max(1).optional(),
    requiresReview: z.boolean(),
    createdAt: z.date(),
    completedAt: z.date().optional(),
  })),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});
export type ExtractionListResponse = z.infer<typeof extractionListResponseSchema>;

/**
 * Batch extraction response
 */
export const batchExtractionResponseSchema = z.object({
  batchId: z.string().uuid(),
  jobs: z.array(extractionJobResponseSchema),
  totalDocuments: z.number().int().positive(),
  queuedCount: z.number().int().nonnegative(),
  estimatedTotalTime: z.number().int().nonnegative().optional(), // seconds
});
export type BatchExtractionResponse = z.infer<typeof batchExtractionResponseSchema>;

/**
 * Template list response
 */
export const templateListResponseSchema = z.object({
  items: z.array(extractionTemplateSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});
export type TemplateListResponse = z.infer<typeof templateListResponseSchema>;

/**
 * Update extraction response
 */
export const updateExtractionResponseSchema = z.object({
  extractionId: z.string().uuid(),
  updated: z.boolean(),
  updatedAt: z.date(),
  updatedBy: z.string().uuid(),
  corrections: z.record(z.unknown()),
  previousData: z.record(z.unknown()).optional(),
});
export type UpdateExtractionResponse = z.infer<typeof updateExtractionResponseSchema>;

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

/**
 * Calculate overall confidence from field confidences
 */
export function calculateOverallConfidence(fields: ExtractedField[]): number {
  if (fields.length === 0) return 0;
  const sum = fields.reduce((acc, field) => acc + field.confidence, 0);
  return sum / fields.length;
}

/**
 * Check if extraction requires manual review
 */
export function requiresManualReview(
  overallConfidence: number,
  threshold: number = 0.85,
  requiredFieldsMissing: boolean = false
): boolean {
  return overallConfidence < threshold || requiredFieldsMissing;
}

/**
 * Get AI model display name
 */
export function getAiModelName(model: AiModel): string {
  const names: Record<AiModel, string> = {
    GPT_4_VISION: 'GPT-4 Vision',
    GPT_4_TURBO: 'GPT-4 Turbo',
    CLAUDE_3_OPUS: 'Claude 3 Opus',
    CLAUDE_3_SONNET: 'Claude 3 Sonnet',
    CLAUDE_3_HAIKU: 'Claude 3 Haiku',
    GEMINI_PRO: 'Gemini Pro',
    CUSTOM: 'Custom Model',
  };
  return names[model];
}

/**
 * Get template type display name
 */
export function getTemplateTypeName(type: ExtractionTemplateType): string {
  const names: Record<ExtractionTemplateType, string> = {
    INVOICE: 'Faktura',
    RECEIPT: 'Paragon',
    CONTRACT: 'Umowa',
    BANK_STATEMENT: 'Wyciąg bankowy',
    TAX_DOCUMENT: 'Dokument podatkowy',
    PAYROLL: 'Lista płac',
    PURCHASE_ORDER: 'Zamówienie zakupu',
    DELIVERY_NOTE: 'List przewozowy',
    CREDIT_NOTE: 'Nota kredytowa',
    CUSTOM: 'Własny szablon',
  };
  return names[type];
}

/**
 * Validate Polish NIP number
 */
export function validateNip(nip: string): boolean {
  const cleanNip = nip.replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(cleanNip)) return false;

  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanNip[i], 10) * weights[i];
  }
  const checksum = sum % 11;
  return checksum === parseInt(cleanNip[9], 10);
}

/**
 * Validate Polish REGON number (9 or 14 digits)
 */
export function validateRegon(regon: string): boolean {
  const cleanRegon = regon.replace(/[\s-]/g, '');

  if (cleanRegon.length === 9) {
    const weights = [8, 9, 2, 3, 4, 5, 6, 7];
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += parseInt(cleanRegon[i], 10) * weights[i];
    }
    const checksum = sum % 11 === 10 ? 0 : sum % 11;
    return checksum === parseInt(cleanRegon[8], 10);
  } else if (cleanRegon.length === 14) {
    // First validate 9-digit part
    if (!validateRegon(cleanRegon.substring(0, 9))) return false;

    const weights = [2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8];
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cleanRegon[i], 10) * weights[i];
    }
    const checksum = sum % 11 === 10 ? 0 : sum % 11;
    return checksum === parseInt(cleanRegon[13], 10);
  }

  return false;
}

/**
 * Validate IBAN number
 */
export function validateIban(iban: string): boolean {
  const cleanIban = iban.replace(/[\s-]/g, '').toUpperCase();

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleanIban)) return false;
  if (cleanIban.length < 15 || cleanIban.length > 34) return false;

  // Move first 4 chars to end
  const rearranged = cleanIban.slice(4) + cleanIban.slice(0, 4);

  // Convert letters to numbers (A=10, B=11, etc.)
  let numericString = '';
  for (const char of rearranged) {
    if (/[A-Z]/.test(char)) {
      numericString += (char.charCodeAt(0) - 55).toString();
    } else {
      numericString += char;
    }
  }

  // Calculate modulo 97
  let remainder = 0;
  for (const digit of numericString) {
    remainder = (remainder * 10 + parseInt(digit, 10)) % 97;
  }

  return remainder === 1;
}
