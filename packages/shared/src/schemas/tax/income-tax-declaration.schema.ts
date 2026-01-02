// TAX-005: Income Tax Declaration Schema
// Manages CIT (Corporate Income Tax) and PIT (Personal Income Tax) declarations for Polish tax compliance

import { z } from 'zod';

// ===========================================================================
// ENUMS
// ===========================================================================

/**
 * Income tax type
 */
export const incomeTaxTypeSchema = z.enum([
  'CIT',  // Corporate Income Tax (podatek dochodowy od osób prawnych)
  'PIT',  // Personal Income Tax (podatek dochodowy od osób fizycznych)
]);

export type IncomeTaxType = z.infer<typeof incomeTaxTypeSchema>;

/**
 * Declaration type
 */
export const declarationTypeSchema = z.enum([
  'ANNUAL',        // Roczna deklaracja
  'ADVANCE',       // Zaliczka miesięczna/kwartalna
  'CORRECTION',    // Korekta
  'FINAL',         // Deklaracja końcowa (przy likwidacji)
]);

export type DeclarationType = z.infer<typeof declarationTypeSchema>;

/**
 * CIT form types (Polish tax forms)
 */
export const citFormTypeSchema = z.enum([
  'CIT-8',      // Main annual CIT declaration
  'CIT-8AB',    // CIT declaration for tax capital groups
  'CIT-8E',     // Estonian CIT declaration
  'CIT-10Z',    // Withholding tax declaration
  'CIT-2R',     // Monthly advance payment information
  'CIT-6R',     // Dividend withholding declaration
  'CIT-8S',     // Solidarity surcharge declaration
]);

export type CITFormType = z.infer<typeof citFormTypeSchema>;

/**
 * PIT form types (Polish tax forms)
 */
export const pitFormTypeSchema = z.enum([
  'PIT-36',     // Business income (progressive scale)
  'PIT-36L',    // Business income (flat rate 19%)
  'PIT-28',     // Lump sum tax (ryczałt)
  'PIT-37',     // Employment income
  'PIT-38',     // Capital gains
  'PIT-39',     // Real estate income
  'PIT-5L',     // Monthly advance for flat rate
  'PIT-5',      // Monthly advance for progressive scale
]);

export type PITFormType = z.infer<typeof pitFormTypeSchema>;

/**
 * Tax calculation method
 */
export const taxCalculationMethodSchema = z.enum([
  'PROGRESSIVE',     // Skala podatkowa (12%/32%)
  'FLAT_19',         // Podatek liniowy 19%
  'LUMP_SUM',        // Ryczałt od przychodów
  'CIT_STANDARD',    // Standard CIT 19%
  'CIT_SMALL',       // Small taxpayer CIT 9%
  'CIT_ESTONIAN',    // Estonian CIT
  'CIT_SOLIDARITY',  // CIT with solidarity surcharge
]);

export type TaxCalculationMethod = z.infer<typeof taxCalculationMethodSchema>;

/**
 * Declaration status
 */
export const declarationStatusSchema = z.enum([
  'DRAFT',           // In progress
  'CALCULATED',      // Calculations complete
  'PENDING_REVIEW',  // Awaiting approval
  'APPROVED',        // Approved for submission
  'SUBMITTED',       // Submitted to tax authority
  'ACCEPTED',        // Accepted by tax authority
  'REJECTED',        // Rejected by tax authority
  'CORRECTED',       // Replaced by correction
]);

export type DeclarationStatus = z.infer<typeof declarationStatusSchema>;

/**
 * Advance payment period
 */
export const advancePeriodTypeSchema = z.enum([
  'MONTHLY',     // Monthly advance payments
  'QUARTERLY',   // Quarterly advance payments (for small taxpayers)
]);

export type AdvancePeriodType = z.infer<typeof advancePeriodTypeSchema>;

// ===========================================================================
// ENTITY SCHEMAS
// ===========================================================================

/**
 * Income Tax Declaration entity
 */
export const incomeTaxDeclarationSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),

  // Declaration info
  taxType: incomeTaxTypeSchema,
  declarationType: declarationTypeSchema,
  formType: z.string(), // CIT-8, PIT-36, etc.
  taxYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12).nullable(),
  periodQuarter: z.number().int().min(1).max(4).nullable(),

  // Financial data
  totalRevenue: z.string(), // Decimal as string
  totalCosts: z.string(),
  taxableIncome: z.string(),
  taxLoss: z.string(),

  // Tax calculation
  calculationMethod: taxCalculationMethodSchema,
  taxRate: z.string(),
  taxDue: z.string(),
  taxPaid: z.string(), // Advances already paid
  taxToPay: z.string(), // Remaining to pay
  taxToRefund: z.string(), // Refund due

  // Deductions and allowances
  deductions: z.record(z.string(), z.string()).nullable(), // Named deductions
  allowances: z.record(z.string(), z.string()).nullable(), // Named allowances
  lossCarryForward: z.string().nullable(), // Loss from previous years

  // Status and workflow
  status: declarationStatusSchema,
  calculatedAt: z.date().nullable(),
  calculatedBy: z.string().uuid().nullable(),
  submittedAt: z.date().nullable(),
  submittedBy: z.string().uuid().nullable(),
  submissionReference: z.string().nullable(), // e-Deklaracje reference
  upoReference: z.string().nullable(), // UPO (official receipt)

  // Correction info
  correctsDeclarationId: z.string().uuid().nullable(),
  correctionReason: z.string().nullable(),
  correctionNumber: z.number().int().nullable(),

  // Audit
  createdAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  updatedAt: z.date(),
});

export type IncomeTaxDeclaration = z.infer<typeof incomeTaxDeclarationSchema>;

/**
 * Tax advance payment entity
 */
export const taxAdvancePaymentSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),

  taxType: incomeTaxTypeSchema,
  taxYear: z.number().int(),
  periodType: advancePeriodTypeSchema,
  periodNumber: z.number().int(), // Month (1-12) or Quarter (1-4)

  // Calculation
  cumulativeRevenue: z.string(),
  cumulativeCosts: z.string(),
  cumulativeIncome: z.string(),
  taxDue: z.string(),
  previousAdvances: z.string(),
  currentAdvance: z.string(),

  // Payment status
  dueDate: z.date(),
  paidAmount: z.string().nullable(),
  paidDate: z.date().nullable(),
  isPaid: z.boolean(),

  // Linked declaration
  declarationId: z.string().uuid().nullable(),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TaxAdvancePayment = z.infer<typeof taxAdvancePaymentSchema>;

/**
 * Loss carry forward record
 */
export const lossCarryForwardSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),

  taxType: incomeTaxTypeSchema,
  lossYear: z.number().int(),
  originalAmount: z.string(),
  usedAmount: z.string(),
  remainingAmount: z.string(),
  expiryYear: z.number().int(), // 5 years after loss year

  // Usage history
  usageHistory: z.array(z.object({
    usedInYear: z.number().int(),
    amount: z.string(),
    declarationId: z.string().uuid(),
  })),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type LossCarryForward = z.infer<typeof lossCarryForwardSchema>;

// ===========================================================================
// INPUT SCHEMAS - CIT CALCULATIONS
// ===========================================================================

/**
 * Calculate CIT input
 */
export const calculateCITSchema = z.object({
  clientId: z.string().uuid(),
  taxYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12).optional(),
  periodQuarter: z.number().int().min(1).max(4).optional(),

  revenue: z.string().refine((val) => !isNaN(parseFloat(val)), {
    message: 'Revenue must be a valid number',
  }),
  costs: z.string().refine((val) => !isNaN(parseFloat(val)), {
    message: 'Costs must be a valid number',
  }),

  // Adjustments
  nonDeductibleCosts: z.string().optional(),
  taxExemptRevenue: z.string().optional(),

  // Options
  useSmallTaxpayerRate: z.boolean().default(false),
  useEstonianCIT: z.boolean().default(false),
  applyLossCarryForward: z.boolean().default(true),
});

export type CalculateCITInput = z.infer<typeof calculateCITSchema>;

/**
 * Calculate PIT input for income tax declaration
 */
export const calculatePITDeclarationSchema = z.object({
  clientId: z.string().uuid(),
  taxYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12).optional(),
  periodQuarter: z.number().int().min(1).max(4).optional(),

  revenue: z.string().refine((val) => !isNaN(parseFloat(val)), {
    message: 'Revenue must be a valid number',
  }),
  costs: z.string().refine((val) => !isNaN(parseFloat(val)), {
    message: 'Costs must be a valid number',
  }),

  // Tax method
  taxMethod: z.enum(['progressive', 'flat', 'lump_sum']),
  lumpSumRateCode: z.string().optional(), // For lump sum taxation

  // Social security
  zusContributions: z.string().optional(),
  healthInsurance: z.string().optional(),

  // Deductions
  jointFiling: z.boolean().default(false),
  spouseIncome: z.string().optional(),
  childReliefCount: z.number().int().min(0).max(10).default(0),

  applyLossCarryForward: z.boolean().default(true),
});

export type CalculatePITDeclarationInput = z.infer<typeof calculatePITDeclarationSchema>;

// ===========================================================================
// INPUT SCHEMAS - DECLARATION MANAGEMENT
// ===========================================================================

/**
 * Create declaration
 */
export const createDeclarationSchema = z.object({
  clientId: z.string().uuid(),
  taxType: incomeTaxTypeSchema,
  declarationType: declarationTypeSchema,
  formType: z.string(),
  taxYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12).optional(),
  periodQuarter: z.number().int().min(1).max(4).optional(),
});

export type CreateDeclarationInput = z.infer<typeof createDeclarationSchema>;

/**
 * Update declaration
 */
export const updateDeclarationSchema = z.object({
  declarationId: z.string().uuid(),

  // Financial data
  totalRevenue: z.string().optional(),
  totalCosts: z.string().optional(),

  // Deductions
  deductions: z.record(z.string(), z.string()).optional(),
  allowances: z.record(z.string(), z.string()).optional(),

  // Status
  status: declarationStatusSchema.optional(),
});

export type UpdateDeclarationInput = z.infer<typeof updateDeclarationSchema>;

/**
 * Calculate declaration
 */
export const calculateDeclarationSchema = z.object({
  declarationId: z.string().uuid(),
  recalculate: z.boolean().default(false),
});

export type CalculateDeclarationInput = z.infer<typeof calculateDeclarationSchema>;

/**
 * Submit declaration
 */
export const submitDeclarationSchema = z.object({
  declarationId: z.string().uuid(),
  submissionMethod: z.enum(['e_deklaracje', 'manual']).default('e_deklaracje'),
});

export type SubmitDeclarationInput = z.infer<typeof submitDeclarationSchema>;

/**
 * Create declaration correction
 */
export const createDeclarationCorrectionSchema = z.object({
  originalDeclarationId: z.string().uuid(),
  correctionReason: z.string().min(10).max(500),
});

export type CreateDeclarationCorrectionInput = z.infer<typeof createDeclarationCorrectionSchema>;

/**
 * Get declaration
 */
export const getDeclarationSchema = z.object({
  declarationId: z.string().uuid(),
});

export type GetDeclarationInput = z.infer<typeof getDeclarationSchema>;

/**
 * List declarations
 */
export const listDeclarationsSchema = z.object({
  clientId: z.string().uuid().optional(),
  taxType: incomeTaxTypeSchema.optional(),
  taxYear: z.number().int().optional(),
  status: declarationStatusSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListDeclarationsInput = z.infer<typeof listDeclarationsSchema>;

/**
 * Delete declaration
 */
export const deleteDeclarationSchema = z.object({
  declarationId: z.string().uuid(),
});

export type DeleteDeclarationInput = z.infer<typeof deleteDeclarationSchema>;

// ===========================================================================
// INPUT SCHEMAS - ADVANCE PAYMENTS
// ===========================================================================

/**
 * Calculate advance payment
 */
export const calculateAdvanceSchema = z.object({
  clientId: z.string().uuid(),
  taxType: incomeTaxTypeSchema,
  taxYear: z.number().int().min(2000).max(2100),
  periodType: advancePeriodTypeSchema,
  periodNumber: z.number().int().min(1).max(12),

  cumulativeRevenue: z.string(),
  cumulativeCosts: z.string(),
});

export type CalculateAdvanceInput = z.infer<typeof calculateAdvanceSchema>;

/**
 * Record advance payment
 */
export const recordAdvancePaymentSchema = z.object({
  advanceId: z.string().uuid(),
  paidAmount: z.string(),
  paidDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
});

export type RecordAdvancePaymentInput = z.infer<typeof recordAdvancePaymentSchema>;

/**
 * Get advance schedule
 */
export const getAdvanceScheduleSchema = z.object({
  clientId: z.string().uuid(),
  taxType: incomeTaxTypeSchema,
  taxYear: z.number().int().min(2000).max(2100),
});

export type GetAdvanceScheduleInput = z.infer<typeof getAdvanceScheduleSchema>;

// ===========================================================================
// INPUT SCHEMAS - LOSS CARRY FORWARD
// ===========================================================================

/**
 * Get loss carry forward
 */
export const getLossCarryForwardSchema = z.object({
  clientId: z.string().uuid(),
  taxType: incomeTaxTypeSchema,
});

export type GetLossCarryForwardInput = z.infer<typeof getLossCarryForwardSchema>;

/**
 * Apply loss carry forward
 */
export const applyLossSchema = z.object({
  lossRecordId: z.string().uuid(),
  declarationId: z.string().uuid(),
  amount: z.string(),
});

export type ApplyLossInput = z.infer<typeof applyLossSchema>;

// ===========================================================================
// OUTPUT SCHEMAS
// ===========================================================================

/**
 * CIT calculation result
 */
export const citCalculationResultSchema = z.object({
  revenue: z.string(),
  deductibleCosts: z.string(),
  nonDeductibleCosts: z.string(),
  taxExemptRevenue: z.string(),
  taxableIncome: z.string(),
  taxLoss: z.string(),

  appliedLossCarryForward: z.string(),
  incomeAfterLoss: z.string(),

  taxRate: z.string(),
  taxDue: z.string(),

  // Breakdown
  isSmallTaxpayer: z.boolean(),
  isEstonianCIT: z.boolean(),
  effectiveRate: z.string(),

  // Solidarity surcharge (if applicable)
  solidaritySurcharge: z.string().nullable(),
  totalTax: z.string(),
});

export type CITCalculationResult = z.infer<typeof citCalculationResultSchema>;

/**
 * PIT calculation result
 */
export const pitCalculationResultSchema = z.object({
  revenue: z.string(),
  costs: z.string(),
  income: z.string(),

  // ZUS deductions
  zusDeduction: z.string(),
  healthDeduction: z.string(),

  // Tax base
  taxBase: z.string(),
  appliedLossCarryForward: z.string(),
  taxBaseAfterLoss: z.string(),

  // Tax calculation
  taxMethod: z.string(),
  taxRate: z.string(),
  taxBrackets: z.array(z.object({
    bracket: z.string(),
    rate: z.string(),
    amount: z.string(),
    tax: z.string(),
  })).nullable(),

  taxDue: z.string(),

  // Reliefs
  childRelief: z.string(),
  otherReliefs: z.string(),

  // Final
  taxAfterReliefs: z.string(),
  healthDeductionFromTax: z.string(),
  finalTax: z.string(),

  effectiveRate: z.string(),
});

export type PITCalculationResult = z.infer<typeof pitCalculationResultSchema>;

/**
 * Declaration summary
 */
export const declarationSummarySchema = z.object({
  declaration: incomeTaxDeclarationSchema,
  calculation: z.union([citCalculationResultSchema, pitCalculationResultSchema]).nullable(),
  advancePayments: z.array(taxAdvancePaymentSchema),
  availableLossCarryForward: z.array(lossCarryForwardSchema),
});

export type DeclarationSummary = z.infer<typeof declarationSummarySchema>;

/**
 * Advance schedule
 */
export const advanceScheduleSchema = z.object({
  clientId: z.string().uuid(),
  taxType: incomeTaxTypeSchema,
  taxYear: z.number().int(),
  periodType: advancePeriodTypeSchema,
  advances: z.array(taxAdvancePaymentSchema),
  totalDue: z.string(),
  totalPaid: z.string(),
  totalRemaining: z.string(),
});

export type AdvanceSchedule = z.infer<typeof advanceScheduleSchema>;

/**
 * List declarations result
 */
export const listDeclarationsResultSchema = z.object({
  declarations: z.array(incomeTaxDeclarationSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});

export type ListDeclarationsResult = z.infer<typeof listDeclarationsResultSchema>;

// ===========================================================================
// CONSTANTS
// ===========================================================================

/**
 * Polish CIT rates for 2024
 */
export const CIT_RATES = {
  STANDARD: '0.19',        // 19% standard rate
  SMALL_TAXPAYER: '0.09',  // 9% for small taxpayers
  SOLIDARITY: '0.04',      // 4% solidarity surcharge (on income > 1M PLN)
} as const;

/**
 * Polish PIT rates for 2024
 */
export const PIT_RATES = {
  FIRST_BRACKET: '0.12',    // 12% for income up to threshold
  SECOND_BRACKET: '0.32',   // 32% for income above threshold
  FLAT_RATE: '0.19',        // 19% flat rate for business
  THRESHOLD: '120000',      // PLN - first bracket threshold
} as const;

/**
 * Common lump sum rates
 */
export const LUMP_SUM_RATES = {
  IT_SERVICES: '0.12',      // 12% for IT services
  PROFESSIONAL: '0.15',     // 15% for professional services
  TRADE: '0.055',           // 5.5% for trade
  MANUFACTURING: '0.055',   // 5.5% for manufacturing
  RENTAL: '0.085',          // 8.5% for rental income
  OTHER_SERVICES: '0.085',  // 8.5% for other services
} as const;

/**
 * Small taxpayer revenue limit (for 2024)
 */
export const SMALL_TAXPAYER_LIMIT = '2000000'; // EUR equivalent

/**
 * Tax free amount (kwota wolna od podatku)
 */
export const TAX_FREE_AMOUNT = '30000'; // PLN

/**
 * Health insurance deduction limit
 */
export const HEALTH_DEDUCTION_LIMIT = '11600'; // PLN per year (for flat rate)
