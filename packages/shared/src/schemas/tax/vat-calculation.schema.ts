// TAX-004: VAT Calculation Engine Schemas
// Manages Polish VAT calculations, EU transactions, corrections, and settlements

import { z } from 'zod';

// =========================================================================
// ENUMS
// =========================================================================

/**
 * VAT transaction types
 */
export const vatTransactionTypeSchema = z.enum([
  'DOMESTIC_SALE',       // Sprzedaż krajowa
  'DOMESTIC_PURCHASE',   // Zakup krajowy
  'WDT',                 // Wewnątrzwspólnotowa dostawa towarów
  'WNT',                 // Wewnątrzwspólnotowe nabycie towarów
  'IMPORT_GOODS',        // Import towarów
  'IMPORT_SERVICES',     // Import usług
  'EXPORT',              // Eksport towarów
  'OSS_SALE',            // Sprzedaż w procedurze OSS
  'REVERSE_CHARGE',      // Odwrotne obciążenie
  'CORRECTION',          // Korekta
]);
export type VatTransactionType = z.infer<typeof vatTransactionTypeSchema>;

/**
 * VAT direction (input/output)
 */
export const vatDirectionSchema = z.enum(['INPUT', 'OUTPUT', 'BOTH']);
export type VatDirection = z.infer<typeof vatDirectionSchema>;

/**
 * VAT rate codes
 */
export const vatRateCodeSchema = z.enum([
  'STANDARD',        // 23%
  'REDUCED_8',       // 8%
  'REDUCED_5',       // 5%
  'ZERO',            // 0% (export, WDT)
  'EXEMPT',          // Zwolniony (zw)
  'REVERSE_CHARGE',  // Odwrotne obciążenie (np)
]);
export type VatRateCode = z.infer<typeof vatRateCodeSchema>;

/**
 * VAT transaction status
 */
export const vatTransactionStatusSchema = z.enum([
  'ACTIVE',
  'CORRECTED',
  'CANCELLED',
  'PENDING_VERIFICATION',
]);
export type VatTransactionStatus = z.infer<typeof vatTransactionStatusSchema>;

/**
 * VAT period status
 */
export const vatPeriodStatusSchema = z.enum([
  'DRAFT',
  'CALCULATED',
  'SUBMITTED',
  'ACCEPTED',
  'CORRECTED',
]);
export type VatPeriodStatus = z.infer<typeof vatPeriodStatusSchema>;

/**
 * VAT period type
 */
export const vatPeriodTypeSchema = z.enum(['MONTHLY', 'QUARTERLY']);
export type VatPeriodType = z.infer<typeof vatPeriodTypeSchema>;

/**
 * Carry forward status
 */
export const carryForwardStatusSchema = z.enum([
  'ACTIVE',
  'PARTIALLY_APPLIED',
  'FULLY_APPLIED',
  'REFUNDED',
  'EXPIRED',
]);
export type CarryForwardStatus = z.infer<typeof carryForwardStatusSchema>;

/**
 * GTU codes (Grupy Towarów i Usług)
 */
export const gtuCodeSchema = z.enum([
  'GTU_01', // Alkohol
  'GTU_02', // Paliwa
  'GTU_03', // Oleje
  'GTU_04', // Wyroby tytoniowe
  'GTU_05', // Odpady
  'GTU_06', // Urządzenia elektroniczne
  'GTU_07', // Pojazdy i części
  'GTU_08', // Metale szlachetne
  'GTU_09', // Produkty medyczne
  'GTU_10', // Budynki i grunty
  'GTU_11', // Usługi niematerialne
  'GTU_12', // Usługi transportowe
  'GTU_13', // Usługi budowlane
]);
export type GtuCode = z.infer<typeof gtuCodeSchema>;

/**
 * Procedure codes
 */
export const procedureCodeSchema = z.enum([
  'SW',   // Sprzedaż wysyłkowa
  'EE',   // Usługi telekomunikacyjne
  'TP',   // Transakcja powiązana
  'TT_WNT', // Wewnątrzwspólnotowe nabycie trójstronne
  'TT_D', // Dostawa trójstronna
  'MR_T', // Marża - towary
  'MR_UZ', // Marża - usługi turystyki
  'I_42', // Import zwolniony art. 33a
  'I_63', // Import zwolniony art. 63
  'B_SPV', // Bony jednego przeznaczenia
  'B_SPV_DOSTAWA', // Dostawa bonów SPV
  'B_MPV_PROWIZJA', // Bony różnego przeznaczenia
  'MPP',  // Mechanizm podzielonej płatności
]);
export type ProcedureCode = z.infer<typeof procedureCodeSchema>;

/**
 * Refund option
 */
export const refundOptionSchema = z.enum([
  'BANK_TRANSFER',      // Przelew na konto (60 dni)
  'OFFSET_NEXT_PERIOD', // Przeniesienie na kolejny okres
  'ACCELERATED_25D',    // Przyspieszony zwrot (25 dni)
  'ACCELERATED_40D',    // Przyspieszony zwrot (40 dni)
]);
export type RefundOption = z.infer<typeof refundOptionSchema>;

// =========================================================================
// ENTITY SCHEMAS
// =========================================================================

/**
 * VAT transaction entity
 */
export const vatTransactionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),
  documentId: z.string().uuid().nullish(),
  journalEntryId: z.string().uuid().nullish(),

  // Transaction details
  transactionType: vatTransactionTypeSchema,
  vatDirection: vatDirectionSchema,

  // Amounts
  netAmount: z.string(), // Decimal as string
  vatRateCode: vatRateCodeSchema,
  vatRateValue: z.string(), // Decimal as string (e.g., "23.00")
  vatAmount: z.string(),
  grossAmount: z.string(),

  // Currency handling
  currency: z.string().length(3).default('PLN'),
  exchangeRate: z.string().default('1.000000'),
  netAmountPln: z.string(),
  vatAmountPln: z.string(),
  grossAmountPln: z.string(),

  // Period
  taxPeriodYear: z.number().int().min(2020).max(2100),
  taxPeriodMonth: z.number().int().min(1).max(12),
  transactionDate: z.date(),

  // Counterparty
  counterpartyName: z.string().max(500).nullish(),
  counterpartyNip: z.string().max(20).nullish(),
  counterpartyCountry: z.string().length(2).nullish(),
  counterpartyVatId: z.string().max(20).nullish(),

  // EU specific
  isEuTransaction: z.boolean().default(false),
  euVatIdVerified: z.boolean().nullish(),
  euVatIdVerificationDate: z.date().nullish(),
  destinationCountry: z.string().length(2).nullish(),

  // Correction reference
  isCorrection: z.boolean().default(false),
  correctsTransactionId: z.string().uuid().nullish(),
  correctionReason: z.string().nullish(),

  // JPK reporting
  jpkDocumentType: z.string().max(10).nullish(),
  gtuCodes: z.array(gtuCodeSchema).nullish(),
  procedureCodes: z.array(procedureCodeSchema).nullish(),

  // Split payment
  splitPaymentRequired: z.boolean().default(false),

  // Status
  status: vatTransactionStatusSchema.default('ACTIVE'),

  // Metadata
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type VatTransaction = z.infer<typeof vatTransactionSchema>;

/**
 * VAT period summary entity
 */
export const vatPeriodSummarySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),

  // Period
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  periodType: vatPeriodTypeSchema,
  quarter: z.number().int().min(1).max(4).nullish(),

  // Output VAT (VAT należny)
  outputVat23: z.string().default('0.00'),
  outputVat8: z.string().default('0.00'),
  outputVat5: z.string().default('0.00'),
  outputVat0: z.string().default('0.00'),
  outputVatWdt: z.string().default('0.00'),
  outputVatExport: z.string().default('0.00'),
  outputVatReverseCharge: z.string().default('0.00'),
  outputVatTotal: z.string().default('0.00'),

  // Input VAT (VAT naliczony)
  inputVatDeductible: z.string().default('0.00'),
  inputVatNonDeductible: z.string().default('0.00'),
  inputVatFixedAssets: z.string().default('0.00'),
  inputVatWnt: z.string().default('0.00'),
  inputVatImport: z.string().default('0.00'),
  inputVatTotal: z.string().default('0.00'),

  // Settlement
  vatDue: z.string().default('0.00'),
  vatRefund: z.string().default('0.00'),
  carryForwardFromPrevious: z.string().default('0.00'),
  carryForwardToNext: z.string().default('0.00'),
  finalVatDue: z.string().default('0.00'),
  finalVatRefund: z.string().default('0.00'),

  // Refund preference
  refundOption: refundOptionSchema.nullish(),

  // Status
  status: vatPeriodStatusSchema.default('DRAFT'),
  jpkFileId: z.string().uuid().nullish(),
  submissionDate: z.date().nullish(),
  upoNumber: z.string().max(100).nullish(),

  // Metadata
  calculatedAt: z.date().nullish(),
  calculatedBy: z.string().uuid().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type VatPeriodSummary = z.infer<typeof vatPeriodSummarySchema>;

/**
 * VAT carry forward entity
 */
export const vatCarryForwardSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),

  // Source period
  sourceYear: z.number().int(),
  sourceMonth: z.number().int(),
  sourceSummaryId: z.string().uuid(),

  // Amount
  originalAmount: z.string(),
  remainingAmount: z.string(),

  // Status
  status: carryForwardStatusSchema.default('ACTIVE'),

  createdAt: z.date(),
  updatedAt: z.date(),
});
export type VatCarryForward = z.infer<typeof vatCarryForwardSchema>;

/**
 * EU VAT verification cache
 */
export const euVatVerificationSchema = z.object({
  id: z.string().uuid(),
  vatId: z.string().max(20),
  countryCode: z.string().length(2),
  isValid: z.boolean(),
  companyName: z.string().max(500).nullish(),
  companyAddress: z.string().nullish(),
  verifiedAt: z.date(),
  expiresAt: z.date(),
  requestId: z.string().max(100).nullish(),
});
export type EuVatVerification = z.infer<typeof euVatVerificationSchema>;

// =========================================================================
// INPUT SCHEMAS - Calculation
// =========================================================================

/**
 * Calculate VAT from net or gross amount
 */
export const calculateVatInputSchema = z.object({
  netAmount: z.string().optional(),
  grossAmount: z.string().optional(),
  vatRateCode: vatRateCodeSchema,
  currency: z.string().length(3).default('PLN'),
  exchangeRate: z.string().optional(),
  transactionDate: z.date(),
}).refine(data => data.netAmount || data.grossAmount, {
  message: 'Either netAmount or grossAmount must be provided',
});
export type CalculateVatInput = z.infer<typeof calculateVatInputSchema>;

/**
 * Record VAT transaction
 */
export const recordVatTransactionSchema = z.object({
  clientId: z.string().uuid(),
  documentId: z.string().uuid().optional(),
  transactionType: vatTransactionTypeSchema,
  netAmount: z.string(),
  vatRateCode: vatRateCodeSchema,
  currency: z.string().length(3).default('PLN'),
  exchangeRate: z.string().optional(),
  transactionDate: z.date(),
  periodYear: z.number().int().min(2020).max(2100),
  periodMonth: z.number().int().min(1).max(12),
  counterpartyName: z.string().max(500).optional(),
  counterpartyNip: z.string().max(20).optional(),
  counterpartyVatId: z.string().max(20).optional(),
  gtuCodes: z.array(gtuCodeSchema).optional(),
  procedureCodes: z.array(procedureCodeSchema).optional(),
  splitPaymentRequired: z.boolean().optional(),
});
export type RecordVatTransactionInput = z.infer<typeof recordVatTransactionSchema>;

/**
 * Process WNT (Intra-Community Acquisition)
 */
export const processWntSchema = z.object({
  clientId: z.string().uuid(),
  supplierVatId: z.string().min(8).max(20),
  supplierName: z.string().max(500).optional(),
  netAmount: z.string(),
  currency: z.string().length(3),
  exchangeRate: z.string(),
  transactionDate: z.date(),
  periodYear: z.number().int(),
  periodMonth: z.number().int(),
  description: z.string().max(1000).optional(),
});
export type ProcessWntInput = z.infer<typeof processWntSchema>;

/**
 * Process WDT (Intra-Community Supply)
 */
export const processWdtSchema = z.object({
  clientId: z.string().uuid(),
  customerVatId: z.string().min(8).max(20),
  customerName: z.string().max(500).optional(),
  netAmount: z.string(),
  currency: z.string().length(3).default('PLN'),
  transactionDate: z.date(),
  periodYear: z.number().int(),
  periodMonth: z.number().int(),
  description: z.string().max(1000).optional(),
});
export type ProcessWdtInput = z.infer<typeof processWdtSchema>;

/**
 * Process import of services
 */
export const processImportServicesSchema = z.object({
  clientId: z.string().uuid(),
  supplierName: z.string().max(500),
  supplierCountry: z.string().length(2),
  netAmount: z.string(),
  currency: z.string().length(3),
  exchangeRate: z.string(),
  transactionDate: z.date(),
  periodYear: z.number().int(),
  periodMonth: z.number().int(),
  description: z.string().max(1000).optional(),
  isDeductible: z.boolean().default(true),
});
export type ProcessImportServicesInput = z.infer<typeof processImportServicesSchema>;

/**
 * Create VAT correction
 */
export const createVatCorrectionSchema = z.object({
  originalTransactionId: z.string().uuid(),
  netAmountDifference: z.string(), // Can be negative (reduction) or positive (increase)
  reason: z.string().min(10).max(500),
  correctionDate: z.date(),
  periodYear: z.number().int(),
  periodMonth: z.number().int(),
});
export type CreateVatCorrectionInput = z.infer<typeof createVatCorrectionSchema>;

// =========================================================================
// INPUT SCHEMAS - Settlement
// =========================================================================

/**
 * Get VAT settlement for period
 */
export const getVatSettlementSchema = z.object({
  clientId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});
export type GetVatSettlementInput = z.infer<typeof getVatSettlementSchema>;

/**
 * Finalize VAT settlement
 */
export const finalizeVatSettlementSchema = z.object({
  clientId: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int(),
  refundOption: refundOptionSchema.optional(),
  partialRefundAmount: z.string().optional(),
});
export type FinalizeVatSettlementInput = z.infer<typeof finalizeVatSettlementSchema>;

/**
 * Apply carry forward
 */
export const applyCarryForwardSchema = z.object({
  carryForwardId: z.string().uuid(),
  targetYear: z.number().int(),
  targetMonth: z.number().int(),
  amountToApply: z.string(),
});
export type ApplyCarryForwardInput = z.infer<typeof applyCarryForwardSchema>;

// =========================================================================
// INPUT SCHEMAS - Retrieval
// =========================================================================

/**
 * Get VAT transactions
 */
export const getVatTransactionsSchema = z.object({
  clientId: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int(),
  transactionType: vatTransactionTypeSchema.optional(),
  vatDirection: vatDirectionSchema.optional(),
  status: vatTransactionStatusSchema.optional(),
});
export type GetVatTransactionsInput = z.infer<typeof getVatTransactionsSchema>;

/**
 * Get VAT transaction by ID
 */
export const getVatTransactionByIdSchema = z.object({
  transactionId: z.string().uuid(),
});
export type GetVatTransactionByIdInput = z.infer<typeof getVatTransactionByIdSchema>;

/**
 * Verify EU VAT ID
 */
export const verifyEuVatIdSchema = z.object({
  vatId: z.string().min(8).max(20),
  forceRefresh: z.boolean().optional(),
});
export type VerifyEuVatIdInput = z.infer<typeof verifyEuVatIdSchema>;

/**
 * Get carry forwards
 */
export const getCarryForwardsSchema = z.object({
  clientId: z.string().uuid(),
  status: carryForwardStatusSchema.optional(),
});
export type GetCarryForwardsInput = z.infer<typeof getCarryForwardsSchema>;

/**
 * Get period summaries
 */
export const getPeriodSummariesSchema = z.object({
  clientId: z.string().uuid(),
  startYear: z.number().int(),
  startMonth: z.number().int(),
  endYear: z.number().int(),
  endMonth: z.number().int(),
});
export type GetPeriodSummariesInput = z.infer<typeof getPeriodSummariesSchema>;

// =========================================================================
// OUTPUT SCHEMAS
// =========================================================================

/**
 * VAT calculation result
 */
export const vatCalculationResultSchema = z.object({
  netAmount: z.string(),
  vatRate: z.string(),
  vatRateCode: vatRateCodeSchema,
  vatAmount: z.string(),
  grossAmount: z.string(),
  netAmountPln: z.string(),
  vatAmountPln: z.string(),
  grossAmountPln: z.string(),
  exchangeRate: z.string(),
  currency: z.string(),
});
export type VatCalculationResult = z.infer<typeof vatCalculationResultSchema>;

/**
 * Output VAT breakdown
 */
export const outputVatBreakdownSchema = z.object({
  rate23: z.string(),
  rate8: z.string(),
  rate5: z.string(),
  rate0: z.string(),
  wdt: z.string(),      // Net amount, not VAT
  exports: z.string(),  // Net amount, not VAT
  reverseCharge: z.string(),
  total: z.string(),
});
export type OutputVatBreakdown = z.infer<typeof outputVatBreakdownSchema>;

/**
 * Input VAT breakdown
 */
export const inputVatBreakdownSchema = z.object({
  deductible: z.string(),
  nonDeductible: z.string(),
  fixedAssets: z.string(),
  wnt: z.string(),
  imports: z.string(),
  total: z.string(),
});
export type InputVatBreakdown = z.infer<typeof inputVatBreakdownSchema>;

/**
 * VAT settlement breakdown
 */
export const vatSettlementBreakdownSchema = z.object({
  vatDue: z.string(),
  vatRefund: z.string(),
  carryForwardFromPrevious: z.string(),
  carryForwardToNext: z.string(),
  finalVatDue: z.string(),
  finalVatRefund: z.string(),
});
export type VatSettlementBreakdown = z.infer<typeof vatSettlementBreakdownSchema>;

/**
 * Full VAT settlement result
 */
export const vatSettlementResultSchema = z.object({
  period: z.object({
    year: z.number().int(),
    month: z.number().int(),
    periodType: vatPeriodTypeSchema,
  }),
  outputVat: outputVatBreakdownSchema,
  inputVat: inputVatBreakdownSchema,
  settlement: vatSettlementBreakdownSchema,
  transactionCount: z.number().int(),
  status: vatPeriodStatusSchema,
  refundOptions: z.array(z.object({
    option: refundOptionSchema,
    timeline: z.string(),
    available: z.boolean(),
  })).optional(),
});
export type VatSettlementResult = z.infer<typeof vatSettlementResultSchema>;

/**
 * EU VAT verification result
 */
export const euVatVerificationResultSchema = z.object({
  vatId: z.string(),
  countryCode: z.string(),
  isValid: z.boolean(),
  companyName: z.string().nullish(),
  companyAddress: z.string().nullish(),
  verifiedAt: z.date(),
  expiresAt: z.date(),
  cached: z.boolean(),
});
export type EuVatVerificationResult = z.infer<typeof euVatVerificationResultSchema>;

/**
 * Transaction with calculation result
 */
export const vatTransactionWithCalculationSchema = vatTransactionSchema.extend({
  calculation: vatCalculationResultSchema.optional(),
});
export type VatTransactionWithCalculation = z.infer<typeof vatTransactionWithCalculationSchema>;

/**
 * Correction result
 */
export const vatCorrectionResultSchema = z.object({
  correctionId: z.string().uuid(),
  originalTransactionId: z.string().uuid(),
  netAmountDifference: z.string(),
  vatAmountDifference: z.string(),
  grossAmountDifference: z.string(),
  reason: z.string(),
  periodYear: z.number().int(),
  periodMonth: z.number().int(),
});
export type VatCorrectionResult = z.infer<typeof vatCorrectionResultSchema>;

/**
 * Carry forward with history
 */
export const carryForwardWithHistorySchema = vatCarryForwardSchema.extend({
  applications: z.array(z.object({
    id: z.string().uuid(),
    targetYear: z.number().int(),
    targetMonth: z.number().int(),
    amountApplied: z.string(),
    appliedAt: z.date(),
  })),
});
export type CarryForwardWithHistory = z.infer<typeof carryForwardWithHistorySchema>;

/**
 * OSS transaction summary
 */
export const ossTransactionSummarySchema = z.object({
  destinationCountry: z.string().length(2),
  countryName: z.string(),
  vatRate: z.string(),
  netAmount: z.string(),
  vatAmount: z.string(),
  transactionCount: z.number().int(),
});
export type OssTransactionSummary = z.infer<typeof ossTransactionSummarySchema>;

/**
 * OSS declaration data
 */
export const ossDeclarationDataSchema = z.object({
  quarter: z.number().int().min(1).max(4),
  year: z.number().int(),
  byCountry: z.array(ossTransactionSummarySchema),
  totalNetAmount: z.string(),
  totalVatAmount: z.string(),
  totalTransactionCount: z.number().int(),
});
export type OssDeclarationData = z.infer<typeof ossDeclarationDataSchema>;
