/**
 * ACC-015: JPK-KR Export (Jednolity Plik Kontrolny - Księgi Rachunkowe) Schemas
 * Provides schema definitions for Polish tax authority electronic reporting
 * Compliant with Ministry of Finance JPK_KR specification
 */

import { z } from 'zod';

// ===========================================================================
// ENUMS
// ===========================================================================

/**
 * JPK file types supported by the system
 */
export const jpkTypeSchema = z.enum(['JPK_KR', 'JPK_VAT', 'JPK_FA', 'JPK_MAG']);

export type JpkType = z.infer<typeof jpkTypeSchema>;

/**
 * Submission type for JPK files
 * - ORIGINAL: First submission for the period
 * - CORRECTION: Correction to a previously submitted file
 */
export const jpkSubmissionTypeSchema = z.enum(['ORIGINAL', 'CORRECTION']);

export type JpkSubmissionType = z.infer<typeof jpkSubmissionTypeSchema>;

/**
 * JPK generation and submission status
 */
export const jpkStatusSchema = z.enum([
  'DRAFT',
  'VALIDATING',
  'VALID',
  'INVALID',
  'GENERATED',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
]);

export type JpkStatus = z.infer<typeof jpkStatusSchema>;

/**
 * Validation severity levels
 */
export const jpkValidationSeveritySchema = z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL']);

export type JpkValidationSeverity = z.infer<typeof jpkValidationSeveritySchema>;

/**
 * Account types for JPK classification
 */
export const jpkAccountTypeSchema = z.enum([
  'Aktywne', // Active (debit normal balance)
  'Pasywne', // Passive (credit normal balance)
  'Aktywno-Pasywne', // Active-Passive (can be either)
  'Wynikowe', // Result/Income-Expense
]);

export type JpkAccountType = z.infer<typeof jpkAccountTypeSchema>;

// ===========================================================================
// INPUT SCHEMAS
// ===========================================================================

/**
 * Generate JPK_KR input schema
 */
export const generateJpkKrSchema = z.object({
  periodStart: z.coerce.date({ required_error: 'Period start date is required' }),
  periodEnd: z.coerce.date({ required_error: 'Period end date is required' }),
  submissionType: jpkSubmissionTypeSchema.default('ORIGINAL'),
  correctionNumber: z.number().int().min(0).optional(),
  includeDraftEntries: z.boolean().default(false),
  includeBalanceSheet: z.boolean().default(false),
  includeIncomeStatement: z.boolean().default(false),
  signFile: z.boolean().default(false),
});

export type GenerateJpkKrInput = z.infer<typeof generateJpkKrSchema>;

/**
 * Pre-validate JPK_KR input schema
 */
export const preValidateJpkKrSchema = z.object({
  periodStart: z.coerce.date({ required_error: 'Period start date is required' }),
  periodEnd: z.coerce.date({ required_error: 'Period end date is required' }),
});

export type PreValidateJpkKrInput = z.infer<typeof preValidateJpkKrSchema>;

/**
 * Validate JPK schema input
 */
export const validateJpkSchema = z.object({
  jpkLogId: z.string().uuid({ message: 'JPK Log ID must be a valid UUID' }),
});

export type ValidateJpkInput = z.infer<typeof validateJpkSchema>;

/**
 * Download JPK file input schema
 */
export const downloadJpkSchema = z.object({
  jpkLogId: z.string().uuid({ message: 'JPK Log ID must be a valid UUID' }),
});

export type DownloadJpkInput = z.infer<typeof downloadJpkSchema>;

/**
 * Get JPK log details input schema
 */
export const getJpkLogSchema = z.object({
  jpkLogId: z.string().uuid({ message: 'JPK Log ID must be a valid UUID' }),
});

export type GetJpkLogInput = z.infer<typeof getJpkLogSchema>;

/**
 * List JPK logs input schema
 */
export const listJpkLogsSchema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100).optional(),
  status: jpkStatusSchema.optional(),
  jpkType: jpkTypeSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListJpkLogsInput = z.infer<typeof listJpkLogsSchema>;

/**
 * Update account mapping input schema
 */
export const updateAccountMappingSchema = z.object({
  accountId: z.string().uuid({ message: 'Account ID must be a valid UUID' }),
  jpkAccountType: jpkAccountTypeSchema,
  jpkCategoryCode: z.string().max(20).optional(),
  jpkTeamCode: z.string().max(10),
});

export type UpdateAccountMappingInput = z.infer<typeof updateAccountMappingSchema>;

/**
 * Mark JPK as submitted input schema
 */
export const markJpkSubmittedSchema = z.object({
  jpkLogId: z.string().uuid({ message: 'JPK Log ID must be a valid UUID' }),
  submissionReference: z.string().max(100).optional(),
});

export type MarkJpkSubmittedInput = z.infer<typeof markJpkSubmittedSchema>;

// ===========================================================================
// ENTITY SCHEMAS
// ===========================================================================

/**
 * JPK Header (Naglowek) schema
 */
export const jpkHeaderSchema = z.object({
  kodFormularza: z.literal('JPK_KR'),
  wariantFormularza: z.number().int().positive(),
  celZlozenia: z.enum(['1', '2']), // 1 = original, 2 = correction
  numerKorekty: z.number().int().min(0).optional(),
  dataWytworzeniaJPK: z.coerce.date(),
  dataOd: z.coerce.date(),
  dataDo: z.coerce.date(),
  nazwaSystemu: z.string().max(255),
});

export type JpkHeader = z.infer<typeof jpkHeaderSchema>;

/**
 * Organization data (Podmiot1) schema
 */
export const jpkSubjectSchema = z.object({
  nip: z.string().regex(/^\d{10}$/, 'NIP must be exactly 10 digits'),
  pelnaNazwa: z.string().max(500),
  regon: z
    .string()
    .regex(/^\d{9}$|^\d{14}$/)
    .optional(),
  kodKraju: z.literal('PL'),
  wojewodztwo: z.string().max(100),
  powiat: z.string().max(100),
  gmina: z.string().max(100),
  miejscowosc: z.string().max(100),
  ulica: z.string().max(100).optional(),
  nrDomu: z.string().max(20),
  nrLokalu: z.string().max(20).optional(),
  kodPocztowy: z.string().regex(/^\d{2}-\d{3}$/, 'Postal code must be in format XX-XXX'),
  poczta: z.string().max(100),
});

export type JpkSubject = z.infer<typeof jpkSubjectSchema>;

/**
 * Chart of Accounts entry (ZOiS) schema
 */
export const jpkAccountSchema = z.object({
  kodKonta: z.string().max(20),
  opisKonta: z.string().max(255),
  typKonta: jpkAccountTypeSchema,
  kodZespolu: z.string().max(1), // Account class 0-9
  kodKategorii: z.string().max(20).optional(),
  bilansowe: z.boolean(),
  opis: z.string().max(500).optional(),
});

export type JpkAccount = z.infer<typeof jpkAccountSchema>;

/**
 * Journal entry (Dziennik) schema
 */
export const jpkJournalEntrySchema = z.object({
  lpZapisuDziennika: z.number().int().positive(), // Sequential number
  nrZapisuDziennika: z.string().max(50), // Entry number
  opisDziennika: z.string().max(500), // Description
  dataOperacji: z.coerce.date(), // Operation date
  dataDowodu: z.coerce.date(), // Document date
  dataKsiegowania: z.coerce.date(), // Posting date
  kodOperatora: z.string().max(50), // User code
  opisOperatora: z.string().max(255).optional(), // User name
  kwotaOperacji: z.number(), // Operation amount (total debit/credit)
});

export type JpkJournalEntry = z.infer<typeof jpkJournalEntrySchema>;

/**
 * Ledger posting (KontoZapis) schema
 */
export const jpkLedgerPostingSchema = z.object({
  lpZapisu: z.number().int().positive(), // Line number
  nrZapisu: z.string().max(50), // Entry reference
  kodKontaWn: z.string().max(20).optional(), // Debit account
  kwotaWn: z.number().min(0).optional(), // Debit amount
  kodKontaMa: z.string().max(20).optional(), // Credit account
  kwotaMa: z.number().min(0).optional(), // Credit amount
  opisZapisu: z.string().max(500).optional(), // Description
});

export type JpkLedgerPosting = z.infer<typeof jpkLedgerPostingSchema>;

/**
 * Validation result schema
 */
export const jpkValidationResultSchema = z.object({
  step: z.number().int(),
  type: z.string(),
  passed: z.boolean(),
  severity: jpkValidationSeveritySchema,
  message: z.string(),
  elementPath: z.string().optional(),
  lineNumber: z.number().int().optional(),
  details: z.record(z.any()).optional(),
});

export type JpkValidationResult = z.infer<typeof jpkValidationResultSchema>;

/**
 * Pre-validation report schema
 */
export const jpkPreValidationReportSchema = z.object({
  isValid: z.boolean(),
  canGenerate: z.boolean(),
  results: z.array(jpkValidationResultSchema),
  summary: z.object({
    totalChecks: z.number().int(),
    passed: z.number().int(),
    warnings: z.number().int(),
    errors: z.number().int(),
  }),
});

export type JpkPreValidationReport = z.infer<typeof jpkPreValidationReportSchema>;

/**
 * JPK generation log schema
 */
export const jpkGenerationLogSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  jpkType: jpkTypeSchema,
  fileName: z.string().max(255),
  generationNumber: z.number().int().positive(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  fiscalYear: z.number().int(),
  submissionType: jpkSubmissionTypeSchema,
  correctionNumber: z.number().int().default(0),
  fileSizeBytes: z.number().int(),
  fileHash: z.string().max(64),
  filePath: z.string().max(500).optional(),
  entryCount: z.number().int(),
  lineCount: z.number().int(),
  accountCount: z.number().int(),
  isValid: z.boolean(),
  validationErrors: z.array(z.string()).default([]),
  schemaVersion: z.string().max(20),
  status: jpkStatusSchema,
  generatedAt: z.coerce.date(),
  generatedBy: z.string().uuid(),
  submittedAt: z.coerce.date().nullable(),
  submittedBy: z.string().uuid().nullable(),
  submissionReference: z.string().max(100).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type JpkGenerationLog = z.infer<typeof jpkGenerationLogSchema>;

/**
 * Account mapping for JPK export
 */
export const jpkAccountMappingSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  accountId: z.string().uuid(),
  accountCode: z.string().max(20),
  accountName: z.string().max(255),
  jpkAccountType: jpkAccountTypeSchema,
  jpkCategoryCode: z.string().max(20).nullable(),
  jpkTeamCode: z.string().max(10),
  isConfigured: z.boolean(),
  configurationNotes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type JpkAccountMapping = z.infer<typeof jpkAccountMappingSchema>;

/**
 * Complete JPK_KR data schema
 */
export const jpkKrDataSchema = z.object({
  naglowek: jpkHeaderSchema,
  podmiot1: jpkSubjectSchema,
  zoisList: z.array(jpkAccountSchema),
  dziennikList: z.array(jpkJournalEntrySchema),
  kontoZapisList: z.array(jpkLedgerPostingSchema),
  bilans: z.any().optional(), // Balance sheet data
  rzis: z.any().optional(), // Income statement data
  generatedAt: z.coerce.date(),
  generatedBy: z.string().uuid(),
  validationStatus: jpkStatusSchema,
  validationErrors: z.array(z.string()).optional(),
});

export type JpkKrData = z.infer<typeof jpkKrDataSchema>;

// ===========================================================================
// RESULT SCHEMAS
// ===========================================================================

/**
 * Generate JPK_KR result schema
 */
export const generateJpkKrResultSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  status: jpkStatusSchema,
  isValid: z.boolean(),
  statistics: z.object({
    entryCount: z.number().int(),
    lineCount: z.number().int(),
    accountCount: z.number().int(),
    fileSizeBytes: z.number().int(),
  }),
  validationErrors: z.array(z.string()),
});

export type GenerateJpkKrResult = z.infer<typeof generateJpkKrResultSchema>;

/**
 * Pre-validate result schema
 */
export const preValidateJpkKrResultSchema = jpkPreValidationReportSchema;

export type PreValidateJpkKrResult = z.infer<typeof preValidateJpkKrResultSchema>;

/**
 * Validate schema result
 */
export const validateJpkResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()),
  validatedAt: z.coerce.date(),
});

export type ValidateJpkResult = z.infer<typeof validateJpkResultSchema>;

/**
 * Download JPK file result schema
 */
export const downloadJpkResultSchema = z.object({
  fileName: z.string(),
  contentType: z.literal('application/xml'),
  data: z.string(), // Base64 encoded
  fileSize: z.number().int(),
  hash: z.string(),
});

export type DownloadJpkResult = z.infer<typeof downloadJpkResultSchema>;

/**
 * Get JPK log result schema
 */
export const getJpkLogResultSchema = jpkGenerationLogSchema.extend({
  generatedByUser: z
    .object({
      id: z.string().uuid(),
      name: z.string().nullable(),
      email: z.string(),
    })
    .nullable(),
  submittedByUser: z
    .object({
      id: z.string().uuid(),
      name: z.string().nullable(),
      email: z.string(),
    })
    .nullable(),
});

export type GetJpkLogResult = z.infer<typeof getJpkLogResultSchema>;

/**
 * List JPK logs result schema
 */
export const listJpkLogsResultSchema = z.object({
  logs: z.array(jpkGenerationLogSchema),
  total: z.number().int().min(0),
  hasMore: z.boolean(),
});

export type ListJpkLogsResult = z.infer<typeof listJpkLogsResultSchema>;

/**
 * Get account mappings result schema
 */
export const getAccountMappingsResultSchema = z.object({
  mappings: z.array(jpkAccountMappingSchema),
  total: z.number().int(),
  unmappedCount: z.number().int(),
});

export type GetAccountMappingsResult = z.infer<typeof getAccountMappingsResultSchema>;

/**
 * Update account mapping result schema
 */
export const updateAccountMappingResultSchema = z.object({
  success: z.boolean(),
  mapping: jpkAccountMappingSchema,
});

export type UpdateAccountMappingResult = z.infer<typeof updateAccountMappingResultSchema>;

/**
 * Mark JPK submitted result schema
 */
export const markJpkSubmittedResultSchema = z.object({
  success: z.boolean(),
  jpkLogId: z.string().uuid(),
  submittedAt: z.coerce.date(),
  submissionReference: z.string().nullable(),
});

export type MarkJpkSubmittedResult = z.infer<typeof markJpkSubmittedResultSchema>;
