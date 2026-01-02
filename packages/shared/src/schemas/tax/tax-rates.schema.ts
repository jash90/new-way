// TAX-002: Tax Rates and Rules Management Schema
// Manages Polish tax rates for VAT, CIT, PIT, ZUS, FP, FGSP

import { z } from 'zod';

// ===========================================================================
// ENUMS AND BASE TYPES
// ===========================================================================

/**
 * Tax types supported in the Polish tax system
 */
export const taxTypeSchema = z.enum(['VAT', 'CIT', 'PIT', 'ZUS', 'FP', 'FGSP']);
export type TaxType = z.infer<typeof taxTypeSchema>;

/**
 * Who the rate applies to
 */
export const appliesTo = z.enum(['employee', 'employer', 'self_employed', 'all']);
export type AppliesTo = z.infer<typeof appliesTo>;

/**
 * VAT rate codes as per Polish law
 */
export const vatRateCodeSchema = z.enum(['23', '8', '5', '0', 'ZW', 'NP']);
export type VATRateCode = z.infer<typeof vatRateCodeSchema>;

/**
 * CIT rate codes
 */
export const citRateCodeSchema = z.enum(['STANDARD', 'SMALL']);
export type CITRateCode = z.infer<typeof citRateCodeSchema>;

/**
 * PIT rate codes
 */
export const pitRateCodeSchema = z.enum(['FLAT', 'PROG_12', 'PROG_32', 'RYCZALT_3', 'RYCZALT_5_5', 'RYCZALT_8_5', 'RYCZALT_12', 'RYCZALT_14', 'RYCZALT_15', 'RYCZALT_17']);
export type PITRateCode = z.infer<typeof pitRateCodeSchema>;

/**
 * ZUS contribution codes
 */
export const zusRateCodeSchema = z.enum([
  'EMERY_EE', 'EMERY_ER',  // Emerytalne (pension) - employee/employer
  'RENT_EE', 'RENT_ER',    // Rentowe (disability) - employee/employer
  'CHOR_EE',               // Chorobowe (sickness) - employee only
  'WYPAD_ER',              // Wypadkowe (accident) - employer only
  'ZDROW',                 // Zdrowotne (health)
  'FP',                    // Fundusz Pracy (labor fund)
  'FGSP',                  // FGŚP (guaranteed employee benefits fund)
]);
export type ZUSRateCode = z.infer<typeof zusRateCodeSchema>;

/**
 * PIT tax calculation options
 */
export const pitCalculationOptionSchema = z.enum(['progressive', 'flat', 'lump_sum']);
export type PITCalculationOption = z.infer<typeof pitCalculationOptionSchema>;

/**
 * Activity types for lump sum (ryczałt) taxation
 */
export const activityTypeSchema = z.enum([
  'it_services',
  'other_services',
  'trade',
  'manufacturing',
  'rental_income',
  'liberal_professions',
  'health_services',
  'construction',
]);
export type ActivityType = z.infer<typeof activityTypeSchema>;

/**
 * ZUS contributor type
 */
export const zusContributorTypeSchema = z.enum(['employee', 'employer', 'self_employed']);
export type ZUSContributorType = z.infer<typeof zusContributorTypeSchema>;

/**
 * ZUS type for self-employed
 */
export const zusSelfEmployedTypeSchema = z.enum(['standard', 'preferential', 'ulga_na_start']);
export type ZUSSelfEmployedType = z.infer<typeof zusSelfEmployedTypeSchema>;

// ===========================================================================
// TAX RATE ENTITY
// ===========================================================================

/**
 * Tax rate entity schema
 */
export const taxRateSchema = z.object({
  id: z.string().uuid(),
  taxType: taxTypeSchema,
  rateCode: z.string().min(1).max(20),
  rateName: z.string().min(1).max(100),
  rateValue: z.number().min(0).max(100), // Percentage value
  appliesTo: appliesTo.nullable().optional(),
  activityType: activityTypeSchema.nullable().optional(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable().optional(),
  legalBasis: z.string().max(200).nullable().optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().uuid().nullable().optional(),
});

export type TaxRate = z.infer<typeof taxRateSchema>;

// ===========================================================================
// TAX THRESHOLD ENTITY (for progressive scales)
// ===========================================================================

/**
 * Tax threshold entity for progressive tax scales
 */
export const taxThresholdSchema = z.object({
  id: z.string().uuid(),
  taxType: taxTypeSchema,
  thresholdName: z.string().min(1).max(50),
  lowerBound: z.number().nullable().optional(),
  upperBound: z.number().nullable().optional(),
  rate: z.number().min(0).max(100),
  baseAmount: z.number().nullable().optional(), // Fixed amount for bracket
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable().optional(),
  legalBasis: z.string().max(200).nullable().optional(),
  createdAt: z.string().datetime(),
});

export type TaxThreshold = z.infer<typeof taxThresholdSchema>;

// ===========================================================================
// ZUS CONTRIBUTION BASE ENTITY
// ===========================================================================

/**
 * ZUS contribution bases entity
 */
export const zusContributionBaseSchema = z.object({
  id: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12).nullable().optional(),
  minimumWage: z.number().positive(),
  averageWage: z.number().positive().nullable().optional(),
  declaredBaseMin: z.number().positive().nullable().optional(), // 60% of average wage
  declaredBaseStandard: z.number().positive().nullable().optional(),
  healthBase: z.number().positive().nullable().optional(), // 75% of minimum wage
  preferentialBaseMax: z.number().positive().nullable().optional(),
  annualContributionLimit: z.number().positive().nullable().optional(), // 30x average wage
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
});

export type ZUSContributionBase = z.infer<typeof zusContributionBaseSchema>;

// ===========================================================================
// TAX RATE AUDIT ENTITY
// ===========================================================================

/**
 * Tax rate audit action types
 */
export const taxRateAuditActionSchema = z.enum(['created', 'updated', 'deactivated']);
export type TaxRateAuditAction = z.infer<typeof taxRateAuditActionSchema>;

/**
 * Tax rate audit entity
 */
export const taxRateAuditSchema = z.object({
  id: z.string().uuid(),
  rateId: z.string().uuid(),
  action: taxRateAuditActionSchema,
  oldValue: z.record(z.unknown()).nullable().optional(),
  newValue: z.record(z.unknown()).nullable().optional(),
  changeReason: z.string().nullable().optional(),
  userId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export type TaxRateAudit = z.infer<typeof taxRateAuditSchema>;

// ===========================================================================
// GET RATES SCHEMAS
// ===========================================================================

/**
 * Get rates input schema
 */
export const getRatesSchema = z.object({
  taxType: taxTypeSchema,
  asOfDate: z.string().datetime().optional(),
  includeInactive: z.boolean().default(false),
});

export type GetRatesInput = z.infer<typeof getRatesSchema>;

/**
 * Get rate by code input schema
 */
export const getRateByCodeSchema = z.object({
  taxType: taxTypeSchema,
  rateCode: z.string().min(1).max(20),
  asOfDate: z.string().datetime().optional(),
});

export type GetRateByCodeInput = z.infer<typeof getRateByCodeSchema>;

/**
 * Get rates result
 */
export const getRatesResultSchema = z.object({
  rates: z.array(taxRateSchema),
  asOfDate: z.string().datetime(),
  totalCount: z.number().int().min(0),
});

export type GetRatesResult = z.infer<typeof getRatesResultSchema>;

// ===========================================================================
// GET THRESHOLDS SCHEMAS
// ===========================================================================

/**
 * Get thresholds input schema
 */
export const getThresholdsSchema = z.object({
  taxType: taxTypeSchema,
  asOfDate: z.string().datetime().optional(),
});

export type GetThresholdsInput = z.infer<typeof getThresholdsSchema>;

/**
 * Get thresholds result
 */
export const getThresholdsResultSchema = z.object({
  thresholds: z.array(taxThresholdSchema),
  asOfDate: z.string().datetime(),
});

export type GetThresholdsResult = z.infer<typeof getThresholdsResultSchema>;

// ===========================================================================
// GET ZUS BASES SCHEMAS
// ===========================================================================

/**
 * Get ZUS bases input schema
 */
export const getZUSBasesSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12).optional(),
});

export type GetZUSBasesInput = z.infer<typeof getZUSBasesSchema>;

/**
 * Get ZUS bases result
 */
export const getZUSBasesResultSchema = z.object({
  base: zusContributionBaseSchema.nullable(),
  year: z.number().int(),
  month: z.number().int().nullable(),
});

export type GetZUSBasesResult = z.infer<typeof getZUSBasesResultSchema>;

// ===========================================================================
// VAT CALCULATION SCHEMAS
// ===========================================================================

/**
 * VAT calculation input schema
 */
export const calculateVATSchema = z.object({
  netAmount: z.number().positive(),
  rateCode: vatRateCodeSchema,
  transactionDate: z.string().datetime().optional(),
});

export type CalculateVATInput = z.infer<typeof calculateVATSchema>;

/**
 * VAT calculation result schema
 */
export const calculateVATResultSchema = z.object({
  netAmount: z.number(),
  vatRate: z.number(),
  vatAmount: z.number(),
  grossAmount: z.number(),
  rateCode: z.string(),
  rateName: z.string(),
  effectiveDate: z.string().datetime(),
});

export type CalculateVATResult = z.infer<typeof calculateVATResultSchema>;

// ===========================================================================
// PIT CALCULATION SCHEMAS
// ===========================================================================

/**
 * PIT calculation input schema
 */
export const calculatePITSchema = z.object({
  annualIncome: z.number().min(0),
  taxOption: pitCalculationOptionSchema,
  activityType: activityTypeSchema.optional(), // Required for lump_sum
  deductions: z.number().min(0).default(0),
  taxYear: z.number().int().min(2000).max(2100),
}).refine(
  (data) => data.taxOption !== 'lump_sum' || data.activityType !== undefined,
  { message: 'Activity type is required for lump sum taxation', path: ['activityType'] }
);

export type CalculatePITInput = z.infer<typeof calculatePITSchema>;

/**
 * PIT bracket result schema
 */
export const pitBracketResultSchema = z.object({
  threshold: z.string(),
  income: z.number(),
  rate: z.number(),
  tax: z.number(),
});

export type PITBracketResult = z.infer<typeof pitBracketResultSchema>;

/**
 * PIT calculation result schema
 */
export const calculatePITResultSchema = z.object({
  annualIncome: z.number(),
  taxableIncome: z.number(),
  taxOption: pitCalculationOptionSchema,
  brackets: z.array(pitBracketResultSchema),
  totalTax: z.number(),
  effectiveRate: z.number(),
  taxYear: z.number().int(),
});

export type CalculatePITResult = z.infer<typeof calculatePITResultSchema>;

// ===========================================================================
// ZUS CALCULATION SCHEMAS
// ===========================================================================

/**
 * ZUS calculation input schema
 */
export const calculateZUSSchema = z.object({
  contributorType: zusContributorTypeSchema,
  zusType: zusSelfEmployedTypeSchema.optional(),
  grossSalary: z.number().positive().optional(),
  declaredBase: z.number().positive().optional(),
  accidentRate: z.number().min(0.67).max(3.33).optional(), // Wypadkowe varies by employer
  calculationMonth: z.number().int().min(1).max(12),
  calculationYear: z.number().int().min(2000).max(2100),
}).refine(
  (data) => {
    // Employee must have gross salary
    if (data.contributorType === 'employee' && !data.grossSalary) {
      return false;
    }
    return true;
  },
  { message: 'Gross salary is required for employee contributions', path: ['grossSalary'] }
);

export type CalculateZUSInput = z.infer<typeof calculateZUSSchema>;

/**
 * Individual ZUS contribution result
 */
export const zusContributionDetailSchema = z.object({
  employee: z.number(),
  employer: z.number(),
  total: z.number(),
});

export type ZUSContributionDetail = z.infer<typeof zusContributionDetailSchema>;

/**
 * ZUS contributions breakdown
 */
export const zusContributionsSchema = z.object({
  emerytalne: zusContributionDetailSchema,   // Pension
  rentowe: zusContributionDetailSchema,       // Disability
  chorobowe: zusContributionDetailSchema,     // Sickness
  wypadkowe: zusContributionDetailSchema,     // Accident
  zdrowotne: zusContributionDetailSchema,     // Health
  fp: zusContributionDetailSchema,            // Labor fund
  fgsp: zusContributionDetailSchema,          // Guaranteed employee benefits
});

export type ZUSContributions = z.infer<typeof zusContributionsSchema>;

/**
 * ZUS calculation result schema
 */
export const calculateZUSResultSchema = z.object({
  contributorType: zusContributorTypeSchema,
  contributionBase: z.number(),
  contributions: zusContributionsSchema,
  totalEmployee: z.number(),
  totalEmployer: z.number(),
  totalContributions: z.number(),
  netSalary: z.number().optional(), // Only for employees
});

export type CalculateZUSResult = z.infer<typeof calculateZUSResultSchema>;

// ===========================================================================
// ADMIN - UPDATE RATE SCHEMAS
// ===========================================================================

/**
 * Update tax rate input schema (admin only)
 */
export const updateTaxRateSchema = z.object({
  rateId: z.string().uuid(),
  rateValue: z.number().min(0).max(100).optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
  legalBasis: z.string().max(200).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  changeReason: z.string().min(1).max(500),
});

export type UpdateTaxRateInput = z.infer<typeof updateTaxRateSchema>;

/**
 * Update tax rate result
 */
export const updateTaxRateResultSchema = z.object({
  rate: taxRateSchema,
  audit: taxRateAuditSchema,
});

export type UpdateTaxRateResult = z.infer<typeof updateTaxRateResultSchema>;

// ===========================================================================
// ADMIN - CREATE RATE SCHEMAS
// ===========================================================================

/**
 * Create tax rate input schema (admin only)
 */
export const createTaxRateSchema = z.object({
  taxType: taxTypeSchema,
  rateCode: z.string().min(1).max(20),
  rateName: z.string().min(1).max(100),
  rateValue: z.number().min(0).max(100),
  appliesTo: appliesTo.nullable().optional(),
  activityType: activityTypeSchema.nullable().optional(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable().optional(),
  legalBasis: z.string().max(200).nullable().optional(),
  description: z.string().nullable().optional(),
});

export type CreateTaxRateInput = z.infer<typeof createTaxRateSchema>;

/**
 * Create tax rate result
 */
export const createTaxRateResultSchema = z.object({
  rate: taxRateSchema,
  audit: taxRateAuditSchema,
});

export type CreateTaxRateResult = z.infer<typeof createTaxRateResultSchema>;

// ===========================================================================
// GET RATE HISTORY SCHEMAS
// ===========================================================================

/**
 * Get rate history input schema
 */
export const getRateHistorySchema = z.object({
  rateId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

export type GetRateHistoryInput = z.infer<typeof getRateHistorySchema>;

/**
 * Get rate history result
 */
export const getRateHistoryResultSchema = z.object({
  history: z.array(taxRateAuditSchema),
  totalCount: z.number().int().min(0),
  nextCursor: z.string().uuid().nullable(),
});

export type GetRateHistoryResult = z.infer<typeof getRateHistoryResultSchema>;

// ===========================================================================
// RATE CHANGE IMPACT ANALYSIS SCHEMAS
// ===========================================================================

/**
 * Rate change impact analysis input
 */
export const analyzeRateChangeImpactSchema = z.object({
  taxType: taxTypeSchema,
  rateCode: z.string().min(1).max(20),
  newRateValue: z.number().min(0).max(100),
  effectiveFrom: z.string().datetime(),
});

export type AnalyzeRateChangeImpactInput = z.infer<typeof analyzeRateChangeImpactSchema>;

/**
 * Rate change impact result
 */
export const analyzeRateChangeImpactResultSchema = z.object({
  currentRate: taxRateSchema.nullable(),
  proposedRate: z.number(),
  effectiveFrom: z.string().datetime(),
  impactAnalysis: z.object({
    affectedClientsCount: z.number().int().min(0),
    pendingTransactionsCount: z.number().int().min(0),
    openDeclarationsCount: z.number().int().min(0),
  }),
  recommendations: z.array(z.string()),
});

export type AnalyzeRateChangeImpactResult = z.infer<typeof analyzeRateChangeImpactResultSchema>;

// ===========================================================================
// LUMP SUM (RYCZAŁT) RATE LOOKUP
// ===========================================================================

/**
 * Get lump sum rate for activity type
 */
export const getLumpSumRateSchema = z.object({
  activityType: activityTypeSchema,
  asOfDate: z.string().datetime().optional(),
});

export type GetLumpSumRateInput = z.infer<typeof getLumpSumRateSchema>;

/**
 * Lump sum rate result
 */
export const getLumpSumRateResultSchema = z.object({
  activityType: activityTypeSchema,
  rate: z.number(),
  rateCode: z.string(),
  rateName: z.string(),
  legalBasis: z.string().nullable(),
  effectiveFrom: z.string().datetime(),
});

export type GetLumpSumRateResult = z.infer<typeof getLumpSumRateResultSchema>;

// ===========================================================================
// SUMMARY RATES RESPONSE (for UI)
// ===========================================================================

/**
 * All current rates summary for dashboard/UI
 */
export const getCurrentRatesSummarySchema = z.object({
  asOfDate: z.string().datetime().optional(),
});

export type GetCurrentRatesSummaryInput = z.infer<typeof getCurrentRatesSummarySchema>;

/**
 * Current rates summary result
 */
export const getCurrentRatesSummaryResultSchema = z.object({
  asOfDate: z.string().datetime(),
  vatRates: z.array(z.object({
    code: z.string(),
    name: z.string(),
    rate: z.number(),
  })),
  citRates: z.array(z.object({
    code: z.string(),
    name: z.string(),
    rate: z.number(),
  })),
  pitRates: z.array(z.object({
    code: z.string(),
    name: z.string(),
    rate: z.number(),
  })),
  pitThresholds: z.array(z.object({
    name: z.string(),
    lowerBound: z.number().nullable(),
    upperBound: z.number().nullable(),
    rate: z.number(),
  })),
  zusRates: z.array(z.object({
    code: z.string(),
    name: z.string(),
    employeeRate: z.number().nullable(),
    employerRate: z.number().nullable(),
  })),
  zusBases: z.object({
    minimumWage: z.number(),
    averageWage: z.number().nullable(),
    declaredBaseStandard: z.number().nullable(),
    healthBase: z.number().nullable(),
  }).nullable(),
});

export type GetCurrentRatesSummaryResult = z.infer<typeof getCurrentRatesSummaryResultSchema>;
