/**
 * ACC-013: Balance Sheet (Bilans) Schemas
 * Provides schema definitions for Polish balance sheet generation following Ustawa o rachunkowości
 */

import { z } from 'zod';

// ===========================================================================
// ENUMS
// ===========================================================================

/**
 * Balance sheet section types
 */
export const balanceSheetSectionSchema = z.enum(['ASSETS', 'EQUITY', 'LIABILITIES']);

export type BalanceSheetSection = z.infer<typeof balanceSheetSectionSchema>;

/**
 * Balance sheet detail level
 */
export const detailLevelSchema = z.enum(['SUMMARY', 'DETAILED', 'FULL']);

export type DetailLevel = z.infer<typeof detailLevelSchema>;

/**
 * Export format options
 */
export const bsExportFormatSchema = z.enum(['EXCEL', 'PDF', 'CSV', 'XML']);

export type BSExportFormat = z.infer<typeof bsExportFormatSchema>;

/**
 * Report language options
 */
export const reportLanguageSchema = z.enum(['PL', 'EN']);

export type ReportLanguage = z.infer<typeof reportLanguageSchema>;

// ===========================================================================
// INPUT SCHEMAS
// ===========================================================================

/**
 * Generate balance sheet input schema
 */
export const generateBalanceSheetSchema = z.object({
  reportDate: z.coerce.date({ required_error: 'Report date is required' }),
  comparativeDate: z.coerce.date().optional(),
  includeDrafts: z.boolean().default(false),
  excludeZeroBalances: z.boolean().default(true),
  detailLevel: detailLevelSchema.default('DETAILED'),
});

export type GenerateBalanceSheetInput = z.infer<typeof generateBalanceSheetSchema>;

/**
 * Export balance sheet input schema
 */
export const exportBalanceSheetSchema = z.object({
  reportDate: z.coerce.date({ required_error: 'Report date is required' }),
  comparativeDate: z.coerce.date().optional(),
  format: bsExportFormatSchema,
  language: reportLanguageSchema.default('PL'),
  includeNotes: z.boolean().default(true),
  includeSignatures: z.boolean().default(true),
});

export type ExportBalanceSheetInput = z.infer<typeof exportBalanceSheetSchema>;

/**
 * Save balance sheet input schema
 */
export const saveBalanceSheetSchema = z.object({
  reportDate: z.coerce.date({ required_error: 'Report date is required' }),
  comparativeDate: z.coerce.date().optional(),
  reportName: z.string().max(255).optional(),
  markAsFinal: z.boolean().default(false),
});

export type SaveBalanceSheetInput = z.infer<typeof saveBalanceSheetSchema>;

/**
 * Get saved balance sheet input schema
 */
export const getBalanceSheetSchema = z.object({
  reportId: z.string().uuid({ message: 'Report ID must be a valid UUID' }),
});

export type GetBalanceSheetInput = z.infer<typeof getBalanceSheetSchema>;

/**
 * List balance sheet reports input schema
 */
export const listBalanceSheetSchema = z.object({
  year: z.number().int().min(2000).max(2100).optional(),
  isFinal: z.boolean().optional(),
  search: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListBalanceSheetInput = z.infer<typeof listBalanceSheetSchema>;

/**
 * Delete balance sheet report input schema
 */
export const deleteBalanceSheetSchema = z.object({
  reportId: z.string().uuid({ message: 'Report ID must be a valid UUID' }),
});

export type DeleteBalanceSheetInput = z.infer<typeof deleteBalanceSheetSchema>;

// ===========================================================================
// ENTITY SCHEMAS
// ===========================================================================

/**
 * Balance sheet line schema
 */
export const balanceSheetLineSchema = z.object({
  lineCode: z.string().max(20),
  lineNamePl: z.string().max(255),
  lineNameEn: z.string().max(255).optional(),
  section: balanceSheetSectionSchema,
  indentLevel: z.number().int().min(0).max(5),
  currentPeriod: z.number(),
  priorPeriod: z.number().optional(),
  variance: z.number().optional(),
  variancePercent: z.number().optional(),
  isHeader: z.boolean().default(false),
  isTotal: z.boolean().default(false),
  accounts: z.array(z.string()).optional(),
});

export type BalanceSheetLine = z.infer<typeof balanceSheetLineSchema>;

/**
 * Fixed assets section schema
 */
export const fixedAssetsSectionSchema = z.object({
  intangibleAssets: balanceSheetLineSchema,
  tangibleAssets: balanceSheetLineSchema,
  longTermReceivables: balanceSheetLineSchema,
  longTermInvestments: balanceSheetLineSchema,
  longTermPrepayments: balanceSheetLineSchema,
  total: balanceSheetLineSchema,
});

export type FixedAssetsSection = z.infer<typeof fixedAssetsSectionSchema>;

/**
 * Current assets section schema
 */
export const currentAssetsSectionSchema = z.object({
  inventory: balanceSheetLineSchema,
  shortTermReceivables: balanceSheetLineSchema,
  shortTermInvestments: balanceSheetLineSchema,
  cash: balanceSheetLineSchema,
  shortTermPrepayments: balanceSheetLineSchema,
  total: balanceSheetLineSchema,
});

export type CurrentAssetsSection = z.infer<typeof currentAssetsSectionSchema>;

/**
 * Assets section schema
 */
export const assetsSectionSchema = z.object({
  fixedAssets: fixedAssetsSectionSchema,
  currentAssets: currentAssetsSectionSchema,
  totalAssets: balanceSheetLineSchema,
});

export type AssetsSection = z.infer<typeof assetsSectionSchema>;

/**
 * Equity section schema
 */
export const equitySectionSchema = z.object({
  shareCapital: balanceSheetLineSchema,
  supplementaryCapital: balanceSheetLineSchema,
  revaluationReserve: balanceSheetLineSchema,
  otherReserves: balanceSheetLineSchema,
  priorYearsProfitLoss: balanceSheetLineSchema,
  currentYearProfitLoss: balanceSheetLineSchema,
  totalEquity: balanceSheetLineSchema,
});

export type EquitySection = z.infer<typeof equitySectionSchema>;

/**
 * Liabilities section schema
 */
export const liabilitiesSectionSchema = z.object({
  provisions: balanceSheetLineSchema,
  longTermLiabilities: balanceSheetLineSchema,
  shortTermLiabilities: balanceSheetLineSchema,
  accruals: balanceSheetLineSchema,
  totalLiabilities: balanceSheetLineSchema,
});

export type LiabilitiesSection = z.infer<typeof liabilitiesSectionSchema>;

/**
 * Full balance sheet entity schema
 */
export const balanceSheetSchema = z.object({
  organizationId: z.string().uuid(),
  organizationName: z.string(),
  nip: z.string().max(15),
  reportDate: z.coerce.date(),
  comparativeDate: z.coerce.date().optional(),

  // Sections
  assets: assetsSectionSchema,
  equity: equitySectionSchema,
  liabilities: liabilitiesSectionSchema,

  // Control totals
  totalEquityAndLiabilities: balanceSheetLineSchema,
  isBalanced: z.boolean(),
  balanceDifference: z.number(),

  // Metadata
  generatedAt: z.coerce.date(),
  generatedBy: z.string().uuid(),
});

export type BalanceSheet = z.infer<typeof balanceSheetSchema>;

/**
 * Saved balance sheet report schema
 */
export const savedBalanceSheetReportSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  reportDate: z.coerce.date(),
  comparativeDate: z.coerce.date().nullable(),
  reportName: z.string(),
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  totalEquity: z.number(),
  isFinal: z.boolean(),
  finalizedAt: z.coerce.date().nullable(),
  finalizedBy: z
    .object({
      id: z.string().uuid(),
      name: z.string().nullable(),
      email: z.string(),
    })
    .nullable(),
  exportedFormats: z.array(z.string()),
  lastExportedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  createdBy: z
    .object({
      id: z.string().uuid(),
      name: z.string().nullable(),
      email: z.string(),
    })
    .nullable(),
});

export type SavedBalanceSheetReport = z.infer<typeof savedBalanceSheetReportSchema>;

// ===========================================================================
// RESULT SCHEMAS
// ===========================================================================

/**
 * Generate balance sheet result schema
 */
export const balanceSheetResultSchema = balanceSheetSchema;

export type BalanceSheetResult = z.infer<typeof balanceSheetResultSchema>;

/**
 * Export balance sheet result schema
 */
export const exportBalanceSheetResultSchema = z.object({
  fileName: z.string(),
  fileContent: z.string(), // Base64 encoded
  mimeType: z.string(),
  fileSize: z.number(),
});

export type ExportBalanceSheetResult = z.infer<typeof exportBalanceSheetResultSchema>;

/**
 * Save balance sheet result schema
 */
export const saveBalanceSheetResultSchema = savedBalanceSheetReportSchema;

export type SaveBalanceSheetResult = z.infer<typeof saveBalanceSheetResultSchema>;

/**
 * Get balance sheet result schema (includes full report data)
 */
export const getBalanceSheetResultSchema = savedBalanceSheetReportSchema.extend({
  reportData: balanceSheetSchema,
});

export type GetBalanceSheetResult = z.infer<typeof getBalanceSheetResultSchema>;

/**
 * List balance sheet reports result schema
 */
export const listBalanceSheetResultSchema = z.object({
  reports: z.array(savedBalanceSheetReportSchema),
  total: z.number().int().min(0),
  hasMore: z.boolean(),
});

export type ListBalanceSheetResult = z.infer<typeof listBalanceSheetResultSchema>;

/**
 * Delete balance sheet result schema
 */
export const deleteBalanceSheetResultSchema = z.object({
  success: z.boolean(),
  reportId: z.string().uuid(),
  reportName: z.string(),
});

export type DeleteBalanceSheetResult = z.infer<typeof deleteBalanceSheetResultSchema>;
