/**
 * ACC-014: Income Statement (Rachunek Zysków i Strat - RZiS) Schemas
 * Provides schema definitions for Polish income statement generation following Ustawa o rachunkowości
 */

import { z } from 'zod';

// ===========================================================================
// ENUMS
// ===========================================================================

/**
 * Income statement variant types
 * - COMPARATIVE: Wariant porównawczy (costs by nature - klasa 4)
 * - COST_BY_FUNCTION: Wariant kalkulacyjny (costs by function - klasa 5)
 */
export const statementVariantSchema = z.enum(['COMPARATIVE', 'COST_BY_FUNCTION']);

export type StatementVariant = z.infer<typeof statementVariantSchema>;

/**
 * Report status
 */
export const isReportStatusSchema = z.enum(['DRAFT', 'FINAL', 'APPROVED', 'ARCHIVED']);

export type ISReportStatus = z.infer<typeof isReportStatusSchema>;

/**
 * Export format options
 */
export const isExportFormatSchema = z.enum(['EXCEL', 'PDF', 'CSV', 'XML']);

export type ISExportFormat = z.infer<typeof isExportFormatSchema>;

/**
 * Report language options
 */
export const isReportLanguageSchema = z.enum(['PL', 'EN']);

export type ISReportLanguage = z.infer<typeof isReportLanguageSchema>;

// ===========================================================================
// INPUT SCHEMAS
// ===========================================================================

/**
 * Generate income statement input schema
 */
export const generateIncomeStatementSchema = z.object({
  periodStart: z.coerce.date({ required_error: 'Period start date is required' }),
  periodEnd: z.coerce.date({ required_error: 'Period end date is required' }),
  statementVariant: statementVariantSchema.default('COMPARATIVE'),
  comparisonEnabled: z.boolean().default(false),
  comparisonPeriodStart: z.coerce.date().optional(),
  comparisonPeriodEnd: z.coerce.date().optional(),
  includeDrafts: z.boolean().default(false),
  reportName: z.string().max(255).optional(),
});

export type GenerateIncomeStatementInput = z.infer<typeof generateIncomeStatementSchema>;

/**
 * Export income statement input schema
 */
export const exportIncomeStatementSchema = z.object({
  reportId: z.string().uuid({ message: 'Report ID must be a valid UUID' }),
  format: isExportFormatSchema,
  language: isReportLanguageSchema.default('PL'),
  includeCompanyHeader: z.boolean().default(true),
  includeSignatures: z.boolean().default(true),
});

export type ExportIncomeStatementInput = z.infer<typeof exportIncomeStatementSchema>;

/**
 * Save income statement input schema
 */
export const saveIncomeStatementSchema = z.object({
  periodStart: z.coerce.date({ required_error: 'Period start date is required' }),
  periodEnd: z.coerce.date({ required_error: 'Period end date is required' }),
  statementVariant: statementVariantSchema.default('COMPARATIVE'),
  comparisonPeriodStart: z.coerce.date().optional(),
  comparisonPeriodEnd: z.coerce.date().optional(),
  reportName: z.string().max(255).optional(),
  markAsFinal: z.boolean().default(false),
});

export type SaveIncomeStatementInput = z.infer<typeof saveIncomeStatementSchema>;

/**
 * Get saved income statement input schema
 */
export const getIncomeStatementSchema = z.object({
  reportId: z.string().uuid({ message: 'Report ID must be a valid UUID' }),
});

export type GetIncomeStatementInput = z.infer<typeof getIncomeStatementSchema>;

/**
 * List income statement reports input schema
 */
export const listIncomeStatementsSchema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100).optional(),
  status: isReportStatusSchema.optional(),
  statementVariant: statementVariantSchema.optional(),
  search: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListIncomeStatementsInput = z.infer<typeof listIncomeStatementsSchema>;

/**
 * Delete income statement report input schema
 */
export const deleteIncomeStatementSchema = z.object({
  reportId: z.string().uuid({ message: 'Report ID must be a valid UUID' }),
});

export type DeleteIncomeStatementInput = z.infer<typeof deleteIncomeStatementSchema>;

/**
 * Approve income statement input schema
 */
export const approveIncomeStatementSchema = z.object({
  reportId: z.string().uuid({ message: 'Report ID must be a valid UUID' }),
});

export type ApproveIncomeStatementInput = z.infer<typeof approveIncomeStatementSchema>;

// ===========================================================================
// ENTITY SCHEMAS
// ===========================================================================

/**
 * Income statement line schema
 */
export const incomeStatementLineSchema = z.object({
  lineCode: z.string().max(20),
  lineNamePl: z.string().max(255),
  lineNameEn: z.string().max(255).optional(),
  indentLevel: z.number().int().min(0).max(5),
  currentAmount: z.number(),
  priorAmount: z.number().optional(),
  variance: z.number().optional(),
  variancePercent: z.number().optional(),
  isHeader: z.boolean().default(false),
  isSubtotal: z.boolean().default(false),
  isTotal: z.boolean().default(false),
  accounts: z.array(z.string()).optional(),
});

export type IncomeStatementLine = z.infer<typeof incomeStatementLineSchema>;

/**
 * Revenue section schema (A. Przychody netto ze sprzedaży i zrównane z nimi)
 */
export const revenueSectionSchema = z.object({
  salesProducts: incomeStatementLineSchema, // A.I - Przychody netto ze sprzedaży produktów
  changeInInventory: incomeStatementLineSchema, // A.II - Zmiana stanu produktów
  manufacturingForOwnUse: incomeStatementLineSchema, // A.III - Koszt wytworzenia produktów na własne potrzeby
  salesGoodsAndMaterials: incomeStatementLineSchema, // A.IV - Przychody netto ze sprzedaży towarów i materiałów
  total: incomeStatementLineSchema, // A - Total
});

export type RevenueSection = z.infer<typeof revenueSectionSchema>;

/**
 * Operating costs section schema (B. Koszty działalności operacyjnej)
 */
export const operatingCostsSectionSchema = z.object({
  depreciation: incomeStatementLineSchema, // B.I - Amortyzacja
  materialsAndEnergy: incomeStatementLineSchema, // B.II - Zużycie materiałów i energii
  externalServices: incomeStatementLineSchema, // B.III - Usługi obce
  taxesAndFees: incomeStatementLineSchema, // B.IV - Podatki i opłaty
  salaries: incomeStatementLineSchema, // B.V - Wynagrodzenia
  socialInsurance: incomeStatementLineSchema, // B.VI - Ubezpieczenia społeczne i inne świadczenia
  otherOperatingCosts: incomeStatementLineSchema, // B.VII - Pozostałe koszty rodzajowe
  costOfGoodsSold: incomeStatementLineSchema, // B.VIII - Wartość sprzedanych towarów i materiałów
  total: incomeStatementLineSchema, // B - Total
});

export type OperatingCostsSection = z.infer<typeof operatingCostsSectionSchema>;

/**
 * Other operating revenue section schema (D. Pozostałe przychody operacyjne)
 */
export const otherOperatingRevenueSectionSchema = z.object({
  gainOnDisposal: incomeStatementLineSchema, // D.I - Zysk z tytułu rozchodu niefinansowych aktywów trwałych
  subsidies: incomeStatementLineSchema, // D.II - Dotacje
  revaluationOfAssets: incomeStatementLineSchema, // D.III - Aktualizacja wartości aktywów niefinansowych
  other: incomeStatementLineSchema, // D.IV - Inne przychody operacyjne
  total: incomeStatementLineSchema, // D - Total
});

export type OtherOperatingRevenueSection = z.infer<typeof otherOperatingRevenueSectionSchema>;

/**
 * Other operating costs section schema (E. Pozostałe koszty operacyjne)
 */
export const otherOperatingCostsSectionSchema = z.object({
  lossOnDisposal: incomeStatementLineSchema, // E.I - Strata z tytułu rozchodu niefinansowych aktywów trwałych
  revaluationOfAssets: incomeStatementLineSchema, // E.II - Aktualizacja wartości aktywów niefinansowych
  other: incomeStatementLineSchema, // E.III - Inne koszty operacyjne
  total: incomeStatementLineSchema, // E - Total
});

export type OtherOperatingCostsSection = z.infer<typeof otherOperatingCostsSectionSchema>;

/**
 * Financial revenue section schema (G. Przychody finansowe)
 */
export const financialRevenueSectionSchema = z.object({
  dividendsAndProfitSharing: incomeStatementLineSchema, // G.I - Dywidendy i udziały w zyskach
  interestIncome: incomeStatementLineSchema, // G.II - Odsetki
  gainOnDisposal: incomeStatementLineSchema, // G.III - Zysk z tytułu rozchodu aktywów finansowych
  revaluationOfInvestments: incomeStatementLineSchema, // G.IV - Aktualizacja wartości aktywów finansowych
  other: incomeStatementLineSchema, // G.V - Inne
  total: incomeStatementLineSchema, // G - Total
});

export type FinancialRevenueSection = z.infer<typeof financialRevenueSectionSchema>;

/**
 * Financial costs section schema (H. Koszty finansowe)
 */
export const financialCostsSectionSchema = z.object({
  interestExpense: incomeStatementLineSchema, // H.I - Odsetki
  lossOnDisposal: incomeStatementLineSchema, // H.II - Strata z tytułu rozchodu aktywów finansowych
  revaluationOfInvestments: incomeStatementLineSchema, // H.III - Aktualizacja wartości aktywów finansowych
  other: incomeStatementLineSchema, // H.IV - Inne
  total: incomeStatementLineSchema, // H - Total
});

export type FinancialCostsSection = z.infer<typeof financialCostsSectionSchema>;

/**
 * Full income statement entity schema (Comparative variant)
 */
export const incomeStatementSchema = z.object({
  organizationId: z.string().uuid(),
  organizationName: z.string(),
  nip: z.string().max(15),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  fiscalYear: z.number().int(),
  statementVariant: statementVariantSchema,

  // Comparison
  comparisonEnabled: z.boolean().default(false),
  comparisonPeriodStart: z.coerce.date().optional(),
  comparisonPeriodEnd: z.coerce.date().optional(),

  // Sections (Comparative variant - Załącznik nr 1)
  revenueSection: revenueSectionSchema, // A
  operatingCostsSection: operatingCostsSectionSchema, // B
  salesProfit: incomeStatementLineSchema, // C = A - B (Zysk/strata ze sprzedaży)
  otherOperatingRevenue: otherOperatingRevenueSectionSchema, // D
  otherOperatingCosts: otherOperatingCostsSectionSchema, // E
  operatingProfit: incomeStatementLineSchema, // F = C + D - E (Zysk/strata z działalności operacyjnej)
  financialRevenue: financialRevenueSectionSchema, // G
  financialCosts: financialCostsSectionSchema, // H
  grossProfit: incomeStatementLineSchema, // I = F + G - H (Zysk/strata brutto)
  incomeTax: incomeStatementLineSchema, // J (Podatek dochodowy)
  otherDeductions: incomeStatementLineSchema, // K (Pozostałe obowiązkowe zmniejszenia zysku)
  netProfit: incomeStatementLineSchema, // L = I - J - K (Zysk/strata netto)

  // Summary totals
  totals: z.object({
    totalRevenue: z.number(),
    totalCosts: z.number(),
    operatingProfit: z.number(),
    grossProfit: z.number(),
    netProfit: z.number(),
    prevTotalRevenue: z.number().optional(),
    prevTotalCosts: z.number().optional(),
    prevNetProfit: z.number().optional(),
  }),

  // Status
  status: isReportStatusSchema.default('DRAFT'),
  isPreliminary: z.boolean().default(false),

  // Metadata
  generatedAt: z.coerce.date(),
  generatedBy: z.string().uuid(),
  approvedAt: z.coerce.date().optional(),
  approvedBy: z.string().uuid().optional(),
});

export type IncomeStatement = z.infer<typeof incomeStatementSchema>;

/**
 * Saved income statement report schema
 */
export const savedIncomeStatementReportSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  reportNumber: z.string().max(50),
  reportName: z.string().max(255),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  fiscalYear: z.number().int(),
  statementVariant: statementVariantSchema,
  comparisonEnabled: z.boolean(),
  comparisonPeriodStart: z.coerce.date().nullable(),
  comparisonPeriodEnd: z.coerce.date().nullable(),
  totalRevenue: z.number(),
  totalCosts: z.number(),
  operatingProfit: z.number(),
  grossProfit: z.number(),
  netProfit: z.number(),
  status: isReportStatusSchema,
  isPreliminary: z.boolean(),
  approvedAt: z.coerce.date().nullable(),
  approvedBy: z
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

export type SavedIncomeStatementReport = z.infer<typeof savedIncomeStatementReportSchema>;

// ===========================================================================
// RESULT SCHEMAS
// ===========================================================================

/**
 * Generate income statement result schema
 */
export const incomeStatementResultSchema = incomeStatementSchema;

export type IncomeStatementResult = z.infer<typeof incomeStatementResultSchema>;

/**
 * Export income statement result schema
 */
export const exportIncomeStatementResultSchema = z.object({
  fileName: z.string(),
  fileContent: z.string(), // Base64 encoded
  mimeType: z.string(),
  fileSize: z.number(),
});

export type ExportIncomeStatementResult = z.infer<typeof exportIncomeStatementResultSchema>;

/**
 * Save income statement result schema
 */
export const saveIncomeStatementResultSchema = savedIncomeStatementReportSchema;

export type SaveIncomeStatementResult = z.infer<typeof saveIncomeStatementResultSchema>;

/**
 * Get income statement result schema (includes full report data)
 */
export const getIncomeStatementResultSchema = savedIncomeStatementReportSchema.extend({
  reportData: incomeStatementSchema,
});

export type GetIncomeStatementResult = z.infer<typeof getIncomeStatementResultSchema>;

/**
 * List income statement reports result schema
 */
export const listIncomeStatementsResultSchema = z.object({
  reports: z.array(savedIncomeStatementReportSchema),
  total: z.number().int().min(0),
  hasMore: z.boolean(),
});

export type ListIncomeStatementsResult = z.infer<typeof listIncomeStatementsResultSchema>;

/**
 * Delete income statement result schema
 */
export const deleteIncomeStatementResultSchema = z.object({
  success: z.boolean(),
  reportId: z.string().uuid(),
  reportName: z.string(),
});

export type DeleteIncomeStatementResult = z.infer<typeof deleteIncomeStatementResultSchema>;

/**
 * Approve income statement result schema
 */
export const approveIncomeStatementResultSchema = savedIncomeStatementReportSchema;

export type ApproveIncomeStatementResult = z.infer<typeof approveIncomeStatementResultSchema>;
