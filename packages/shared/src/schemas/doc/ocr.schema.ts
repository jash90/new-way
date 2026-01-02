// DOC-002: OCR Processing Schemas
// OCR extraction, text recognition, and confidence scoring

import { z } from 'zod';
import { documentCategorySchema } from './document.schema';

// =========================================================================
// ENUMS
// =========================================================================

/**
 * Extraction type for document processing
 */
export const extractionTypeSchema = z.enum([
  'OCR',
  'AI_EXTRACTION',
  'CLASSIFICATION',
  'COMBINED',
]);
export type ExtractionType = z.infer<typeof extractionTypeSchema>;

/**
 * Extraction status for processing operations
 */
export const extractionStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'PARTIAL',
]);
export type ExtractionStatus = z.infer<typeof extractionStatusSchema>;

/**
 * OCR engine options
 */
export const ocrEngineSchema = z.enum([
  'TESSERACT',
  'GOOGLE_VISION',
  'AWS_TEXTRACT',
  'AZURE_COGNITIVE',
  'CUSTOM',
]);
export type OcrEngine = z.infer<typeof ocrEngineSchema>;

/**
 * Supported OCR languages (ISO 639-1 codes)
 */
export const ocrLanguageSchema = z.enum([
  'pl', // Polish
  'en', // English
  'de', // German
  'fr', // French
  'es', // Spanish
  'it', // Italian
  'pt', // Portuguese
  'nl', // Dutch
  'cs', // Czech
  'sk', // Slovak
  'uk', // Ukrainian
  'ru', // Russian
  'auto', // Auto-detect
]);
export type OcrLanguage = z.infer<typeof ocrLanguageSchema>;

/**
 * OCR processing priority
 */
export const ocrPrioritySchema = z.enum([
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
]);
export type OcrPriority = z.infer<typeof ocrPrioritySchema>;

// =========================================================================
// ENTITY SCHEMAS
// =========================================================================

/**
 * OCR result with extracted text and confidence
 */
export const ocrResultSchema = z.object({
  rawText: z.string(),
  confidence: z.number().min(0).max(1),
  language: ocrLanguageSchema,
  engine: ocrEngineSchema,
  pageCount: z.number().int().positive().optional(),
  wordCount: z.number().int().nonnegative().optional(),
  characterCount: z.number().int().nonnegative().optional(),
  processingTimeMs: z.number().int().nonnegative(),
});
export type OcrResult = z.infer<typeof ocrResultSchema>;

/**
 * OCR page result for multi-page documents
 */
export const ocrPageResultSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string(),
  confidence: z.number().min(0).max(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  orientation: z.number().int().min(0).max(360).optional(),
  blocks: z.array(z.object({
    text: z.string(),
    confidence: z.number().min(0).max(1),
    boundingBox: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }).optional(),
    type: z.enum(['TEXT', 'TABLE', 'FORM', 'BARCODE', 'HANDWRITING']).optional(),
  })).optional(),
});
export type OcrPageResult = z.infer<typeof ocrPageResultSchema>;

/**
 * Document extraction record
 */
export const documentExtractionSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  extractionType: extractionTypeSchema,
  status: extractionStatusSchema,

  // OCR results
  rawText: z.string().nullable(),
  ocrConfidence: z.number().min(0).max(1).nullable(),
  ocrLanguage: ocrLanguageSchema.nullable(),
  ocrEngine: ocrEngineSchema.nullable(),

  // AI extraction results
  extractedData: z.record(z.unknown()).nullable(),
  extractionConfidence: z.number().min(0).max(1).nullable(),
  extractionModel: z.string().nullable(),

  // Classification results
  classifiedCategory: documentCategorySchema.nullable(),
  classificationConfidence: z.number().min(0).max(1).nullable(),
  classificationAlternatives: z.array(z.object({
    category: documentCategorySchema,
    confidence: z.number().min(0).max(1),
  })).nullable(),

  // Processing metadata
  processingTimeMs: z.number().int().nonnegative().nullable(),
  errorMessage: z.string().nullable(),
  errorCode: z.string().nullable(),

  // User feedback
  userValidated: z.boolean(),
  userCorrectedData: z.record(z.unknown()).nullable(),
  validatedBy: z.string().uuid().nullable(),
  validatedAt: z.date().nullable(),

  // Timestamps
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type DocumentExtraction = z.infer<typeof documentExtractionSchema>;

// =========================================================================
// INPUT SCHEMAS
// =========================================================================

/**
 * Request OCR processing for a document
 */
export const requestOcrInputSchema = z.object({
  documentId: z.string().uuid(),
  versionNumber: z.number().int().positive().optional(),
  language: ocrLanguageSchema.default('auto'),
  engine: ocrEngineSchema.default('TESSERACT'),
  priority: ocrPrioritySchema.default('NORMAL'),
  options: z.object({
    enhanceImage: z.boolean().default(true),
    detectOrientation: z.boolean().default(true),
    deskew: z.boolean().default(true),
    removeNoise: z.boolean().default(true),
    detectTables: z.boolean().default(false),
    detectForms: z.boolean().default(false),
    extractBarcodes: z.boolean().default(false),
  }).optional(),
});
export type RequestOcrInput = z.infer<typeof requestOcrInputSchema>;

/**
 * Get OCR result for a document
 */
export const getOcrResultInputSchema = z.object({
  documentId: z.string().uuid(),
  versionNumber: z.number().int().positive().optional(),
  extractionId: z.string().uuid().optional(),
});
export type GetOcrResultInput = z.infer<typeof getOcrResultInputSchema>;

/**
 * Get extraction history for a document
 */
export const getExtractionHistoryInputSchema = z.object({
  documentId: z.string().uuid(),
  extractionType: extractionTypeSchema.optional(),
  status: extractionStatusSchema.optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});
export type GetExtractionHistoryInput = z.infer<typeof getExtractionHistoryInputSchema>;

/**
 * Retry failed extraction
 */
export const retryExtractionInputSchema = z.object({
  extractionId: z.string().uuid(),
  options: z.object({
    useAlternateEngine: z.boolean().default(false),
    alternateEngine: ocrEngineSchema.optional(),
    enhancedProcessing: z.boolean().default(true),
  }).optional(),
});
export type RetryExtractionInput = z.infer<typeof retryExtractionInputSchema>;

/**
 * Cancel pending extraction
 */
export const cancelExtractionInputSchema = z.object({
  extractionId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});
export type CancelExtractionInput = z.infer<typeof cancelExtractionInputSchema>;

/**
 * Validate/correct extracted data
 */
export const validateExtractionInputSchema = z.object({
  extractionId: z.string().uuid(),
  corrections: z.record(z.unknown()).optional(),
  approved: z.boolean(),
  notes: z.string().max(1000).optional(),
});
export type ValidateExtractionInput = z.infer<typeof validateExtractionInputSchema>;

/**
 * Batch OCR processing request
 */
export const batchOcrInputSchema = z.object({
  documents: z.array(z.object({
    documentId: z.string().uuid(),
    versionNumber: z.number().int().positive().optional(),
  })).min(1).max(50),
  language: ocrLanguageSchema.default('auto'),
  engine: ocrEngineSchema.default('TESSERACT'),
  priority: ocrPrioritySchema.default('NORMAL'),
});
export type BatchOcrInput = z.infer<typeof batchOcrInputSchema>;

// =========================================================================
// OUTPUT SCHEMAS
// =========================================================================

/**
 * OCR processing response
 */
export const ocrProcessingResponseSchema = z.object({
  extractionId: z.string().uuid(),
  documentId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  status: extractionStatusSchema,
  estimatedTimeMs: z.number().int().nonnegative().optional(),
  queuePosition: z.number().int().nonnegative().optional(),
  message: z.string().optional(),
});
export type OcrProcessingResponse = z.infer<typeof ocrProcessingResponseSchema>;

/**
 * OCR result response
 */
export const ocrResultResponseSchema = z.object({
  extractionId: z.string().uuid(),
  documentId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  status: extractionStatusSchema,
  result: ocrResultSchema.nullable(),
  pages: z.array(ocrPageResultSchema).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }).nullable(),
  createdAt: z.date(),
  completedAt: z.date().nullable(),
});
export type OcrResultResponse = z.infer<typeof ocrResultResponseSchema>;

/**
 * Extraction history response
 */
export const extractionHistoryResponseSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    documentId: z.string().uuid(),
    versionNumber: z.number().int().positive(),
    extractionType: extractionTypeSchema,
    status: extractionStatusSchema,
    confidence: z.number().min(0).max(1).nullable(),
    processingTimeMs: z.number().int().nonnegative().nullable(),
    userValidated: z.boolean(),
    createdAt: z.date(),
    completedAt: z.date().nullable(),
  })),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});
export type ExtractionHistoryResponse = z.infer<typeof extractionHistoryResponseSchema>;

/**
 * Batch OCR response
 */
export const batchOcrResponseSchema = z.object({
  batchId: z.string().uuid(),
  totalDocuments: z.number().int().positive(),
  queued: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  results: z.array(z.object({
    documentId: z.string().uuid(),
    extractionId: z.string().uuid().nullable(),
    status: z.enum(['QUEUED', 'FAILED', 'SKIPPED']),
    error: z.string().nullable(),
  })),
  estimatedCompletionTime: z.date().optional(),
});
export type BatchOcrResponse = z.infer<typeof batchOcrResponseSchema>;

/**
 * OCR Validation response (named to avoid collision with ACE ValidationResponse)
 */
export const ocrValidationResponseSchema = z.object({
  extractionId: z.string().uuid(),
  validated: z.boolean(),
  validatedAt: z.date(),
  validatedBy: z.string().uuid(),
  corrections: z.record(z.unknown()).nullable(),
});
export type OcrValidationResponse = z.infer<typeof ocrValidationResponseSchema>;

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

/**
 * Calculate average confidence from page results
 */
export function calculateAverageConfidence(pages: OcrPageResult[]): number {
  if (pages.length === 0) return 0;
  const sum = pages.reduce((acc, page) => acc + page.confidence, 0);
  return sum / pages.length;
}

/**
 * Check if confidence is acceptable
 */
export function isConfidenceAcceptable(
  confidence: number,
  threshold: number = 0.7
): boolean {
  return confidence >= threshold;
}

/**
 * Get language name from code
 */
export function getLanguageName(code: OcrLanguage): string {
  const languageNames: Record<OcrLanguage, string> = {
    pl: 'Polish',
    en: 'English',
    de: 'German',
    fr: 'French',
    es: 'Spanish',
    it: 'Italian',
    pt: 'Portuguese',
    nl: 'Dutch',
    cs: 'Czech',
    sk: 'Slovak',
    uk: 'Ukrainian',
    ru: 'Russian',
    auto: 'Auto-detect',
  };
  return languageNames[code];
}

/**
 * Get engine display name
 */
export function getEngineName(engine: OcrEngine): string {
  const engineNames: Record<OcrEngine, string> = {
    TESSERACT: 'Tesseract OCR',
    GOOGLE_VISION: 'Google Cloud Vision',
    AWS_TEXTRACT: 'AWS Textract',
    AZURE_COGNITIVE: 'Azure Cognitive Services',
    CUSTOM: 'Custom Engine',
  };
  return engineNames[engine];
}
