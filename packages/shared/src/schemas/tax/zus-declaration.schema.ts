// TAX-006: ZUS Declaration Schema
// Manages ZUS (Social Security) declarations for Polish tax compliance
// Supports DRA, RCA, RSA, RZA forms for various contributor types

import { z } from 'zod';

// ===========================================================================
// ENUMS AND BASE TYPES
// ===========================================================================

/**
 * ZUS declaration form types
 */
export const zusFormTypeSchema = z.enum([
  'DRA',   // Monthly declaration - main declaration
  'RCA',   // Report for each insured person - full contributions
  'RSA',   // Report for insured in special situations (benefits)
  'RZA',   // Report for health insurance only contributors
  'ZUA',   // Registration of insured person
  'ZCNA',  // Registration of family member
  'ZWUA',  // Deregistration of insured person
]);
export type ZUSFormType = z.infer<typeof zusFormTypeSchema>;

/**
 * Contributor type for ZUS
 */
export const zusContributorTypeSchema = z.enum([
  'EMPLOYEE',           // Pracownik (employee on umowa o pracę)
  'SELF_EMPLOYED',      // Działalność gospodarcza (B2B)
  'CIVIL_CONTRACT',     // Umowa zlecenie/dzieło
  'BOARD_MEMBER',       // Członek zarządu
  'STUDENT_EMPLOYEE',   // Student pracownik (<26 lat)
  'PENSIONER_EMPLOYEE', // Emeryt pracujący
  'FAMILY_MEMBER',      // Osoba współpracująca
]);
export type ZUSContributorType = z.infer<typeof zusContributorTypeSchema>;

/**
 * ZUS contribution scheme for self-employed
 */
export const zusContributionSchemeSchema = z.enum([
  'STANDARD',           // Standard - 60% average wage base
  'PREFERENTIAL',       // Preferencyjny - 30% minimum wage (first 24 months)
  'ULGA_NA_START',      // Ulga na start - only health insurance (first 6 months)
  'MALY_ZUS_PLUS',      // Mały ZUS Plus - based on income
  'LARGE_EMPLOYER',     // Duży pracodawca
]);
export type ZUSContributionScheme = z.infer<typeof zusContributionSchemeSchema>;

/**
 * ZUS declaration status
 */
export const zusDeclarationStatusSchema = z.enum([
  'DRAFT',              // Draft - being prepared
  'CALCULATED',         // Calculated - ready for review
  'VALIDATED',          // Validated - checked for errors
  'SUBMITTED',          // Submitted to ZUS
  'ACCEPTED',           // Accepted by ZUS
  'REJECTED',           // Rejected by ZUS
  'CORRECTED',          // Correction submitted
]);
export type ZUSDeclarationStatus = z.infer<typeof zusDeclarationStatusSchema>;

/**
 * ZUS contribution insurance code (tytuł ubezpieczenia)
 */
export const zusInsuranceCodeSchema = z.enum([
  '0110',  // Employee - full employment
  '0120',  // Employee - part-time
  '0411',  // Civil contract - zlecenie
  '0510',  // Self-employed - standard
  '0570',  // Self-employed - preferential
  '0580',  // Mały ZUS Plus
  '0590',  // Ulga na start
  '0610',  // Board member
  '0811',  // Student <26
  '2550',  // Pensioner working
]);
export type ZUSInsuranceCode = z.infer<typeof zusInsuranceCodeSchema>;

/**
 * Benefit type for RSA form
 */
export const zusBenefitTypeSchema = z.enum([
  'L4_EMPLOYER',        // Sick leave paid by employer (first 33/14 days)
  'L4_ZUS',             // Sick leave paid by ZUS (after 33/14 days)
  'MACIERZYNSKI',       // Maternity leave
  'RODZICIELSKI',       // Parental leave
  'OJCOWSKI',           // Paternity leave
  'OPIEKA',             // Childcare leave
  'REHABILITACYJNY',    // Rehabilitation benefit
]);
export type ZUSBenefitType = z.infer<typeof zusBenefitTypeSchema>;

// ===========================================================================
// CONTRIBUTION RATE CONSTANTS - 2024
// ===========================================================================

export const ZUS_RATES_2024 = {
  // Pension (emerytalne) - 19.52% total
  PENSION_EMPLOYEE: 9.76,     // 9.76% employee
  PENSION_EMPLOYER: 9.76,     // 9.76% employer

  // Disability (rentowe) - 8% total
  DISABILITY_EMPLOYEE: 1.5,   // 1.5% employee
  DISABILITY_EMPLOYER: 6.5,   // 6.5% employer

  // Sickness (chorobowe) - 2.45% employee only
  SICKNESS_EMPLOYEE: 2.45,

  // Accident (wypadkowe) - 0.67%-3.33% employer only, default 1.67%
  ACCIDENT_EMPLOYER_DEFAULT: 1.67,
  ACCIDENT_EMPLOYER_MIN: 0.67,
  ACCIDENT_EMPLOYER_MAX: 3.33,

  // Health (zdrowotne) - 9% of gross for employees
  HEALTH_EMPLOYEE: 9.0,
  HEALTH_SELF_EMPLOYED_MIN: 9.0,

  // Labor Fund (Fundusz Pracy) - 2.45% employer only (if salary >= min wage)
  LABOR_FUND: 2.45,

  // FGSP (Guaranteed Employee Benefits) - 0.1% employer only
  FGSP: 0.1,
} as const;

export const ZUS_BASES_2024 = {
  MINIMUM_WAGE: 4242,                     // from 2024-01-01
  MINIMUM_WAGE_JULY: 4300,                // from 2024-07-01
  PROJECTED_AVERAGE_WAGE: 7824,           // Prognozowane przeciętne wynagrodzenie
  STANDARD_BASE: 4694.40,                 // 60% of projected average wage
  PREFERENTIAL_BASE: 1272.60,             // 30% of minimum wage (for preferential)
  ANNUAL_LIMIT_MULTIPLIER: 30,            // 30x projected average wage for pension/disability
  HEALTH_MIN_BASE_RATE: 0.75,             // 75% of minimum wage for health minimum base
} as const;

// ===========================================================================
// ENTITY SCHEMAS
// ===========================================================================

/**
 * Individual contribution breakdown
 */
export const zusContributionBreakdownSchema = z.object({
  pensionEmployee: z.string(),     // Decimal string
  pensionEmployer: z.string(),
  disabilityEmployee: z.string(),
  disabilityEmployer: z.string(),
  sicknessEmployee: z.string(),
  accidentEmployer: z.string(),
  healthEmployee: z.string(),
  laborFundEmployer: z.string(),
  fgspEmployer: z.string(),
  totalEmployee: z.string(),
  totalEmployer: z.string(),
  totalContributions: z.string(),
});
export type ZUSContributionBreakdown = z.infer<typeof zusContributionBreakdownSchema>;

/**
 * ZUS insured person record (for RCA/RSA forms)
 */
export const zusInsuredPersonSchema = z.object({
  id: z.string().uuid(),
  declarationId: z.string().uuid(),
  personId: z.string().uuid().optional(),      // Link to employee/person record

  // Personal identification
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(100),
  pesel: z.string().length(11),
  nip: z.string().length(10).optional(),

  // Insurance data
  insuranceCode: zusInsuranceCodeSchema,
  contributorType: zusContributorTypeSchema,

  // Contribution bases
  pensionBase: z.string(),           // Podstawa emerytalna
  disabilityBase: z.string(),        // Podstawa rentowa
  sicknessBase: z.string(),          // Podstawa chorobowa
  accidentBase: z.string(),          // Podstawa wypadkowa
  healthBase: z.string(),            // Podstawa zdrowotna

  // Calculated contributions
  contributions: zusContributionBreakdownSchema,

  // Benefit/leave information (for RSA)
  benefitType: zusBenefitTypeSchema.optional(),
  benefitDays: z.number().int().min(0).optional(),
  benefitAmount: z.string().optional(),

  // Status
  isActive: z.boolean().default(true),
  notes: z.string().optional(),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ZUSInsuredPerson = z.infer<typeof zusInsuredPersonSchema>;

/**
 * ZUS Declaration entity (DRA form)
 */
export const zusDeclarationSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),

  // Declaration period
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),

  // Form type and status
  formType: zusFormTypeSchema,
  status: zusDeclarationStatusSchema,

  // Correction info
  isCorrection: z.boolean().default(false),
  correctionNumber: z.number().int().min(1).optional(),
  originalDeclarationId: z.string().uuid().optional(),
  correctionReason: z.string().optional(),

  // Payer (employer) identification
  payerNip: z.string().length(10),
  payerRegon: z.string().min(9).max(14).optional(),
  payerName: z.string().min(1).max(200),

  // Number of insured persons
  insuredCount: z.number().int().min(0),
  employeeCount: z.number().int().min(0),
  selfEmployedCount: z.number().int().min(0),

  // Accident rate for employer
  accidentRate: z.string(),  // Default 1.67%, can vary 0.67%-3.33%

  // Aggregated totals
  totalPensionBase: z.string(),
  totalDisabilityBase: z.string(),
  totalSicknessBase: z.string(),
  totalHealthBase: z.string(),

  // Total contributions
  totalContributions: zusContributionBreakdownSchema,

  // Payment info
  dueDate: z.string().datetime(),
  paidAmount: z.string().optional(),
  paidAt: z.string().datetime().optional(),
  paymentReference: z.string().optional(),

  // Submission info
  submittedAt: z.string().datetime().optional(),
  zusReferenceNumber: z.string().optional(),  // Numer ewidencyjny ZUS
  zusConfirmationNumber: z.string().optional(),

  // Metadata
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ZUSDeclaration = z.infer<typeof zusDeclarationSchema>;

/**
 * ZUS payment record
 */
export const zusPaymentSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  declarationId: z.string().uuid().optional(),

  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),

  // Payment amounts by fund
  pensionAmount: z.string(),
  disabilityAmount: z.string(),
  sicknessAmount: z.string(),
  accidentAmount: z.string(),
  healthAmount: z.string(),
  laborFundAmount: z.string(),
  fgspAmount: z.string(),
  totalAmount: z.string(),

  // Payment details
  paymentDate: z.string().datetime(),
  paymentReference: z.string(),
  bankAccount: z.string().optional(),

  // Status
  isPaid: z.boolean().default(false),
  isOverdue: z.boolean().default(false),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ZUSPayment = z.infer<typeof zusPaymentSchema>;

// ===========================================================================
// CALCULATION INPUT SCHEMAS
// ===========================================================================

/**
 * Calculate ZUS contributions for an employee
 */
export const calculateEmployeeZUSSchema = z.object({
  clientId: z.string().uuid(),
  personId: z.string().uuid().optional(),

  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),

  // Gross salary components
  grossSalary: z.number().positive(),
  bonus: z.number().min(0).default(0),
  overtime: z.number().min(0).default(0),
  otherIncome: z.number().min(0).default(0),

  // Employee details
  contributorType: zusContributorTypeSchema,
  insuranceCode: zusInsuranceCodeSchema.optional(),

  // Special conditions
  isStudent: z.boolean().default(false),   // Student <26
  isPensioner: z.boolean().default(false), // Working pensioner
  accidentRate: z.number().min(0.67).max(3.33).default(1.67),

  // Year-to-date data for annual limit check
  ytdPensionBase: z.number().min(0).default(0),  // Cumulative pension/disability base

  // Benefit/leave info
  benefitType: zusBenefitTypeSchema.optional(),
  benefitDays: z.number().int().min(0).optional(),
  sickLeaveDays: z.number().int().min(0).default(0), // Days on L4
});
export type CalculateEmployeeZUSInput = z.infer<typeof calculateEmployeeZUSSchema>;

/**
 * Calculate ZUS contributions for self-employed
 */
export const calculateSelfEmployedZUSSchema = z.object({
  clientId: z.string().uuid(),

  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),

  // Contribution scheme
  scheme: zusContributionSchemeSchema,

  // For Mały ZUS Plus - previous year's income
  previousYearIncome: z.number().min(0).optional(),
  previousYearDays: z.number().int().min(1).max(366).optional(),

  // Custom base (if declaring higher base)
  customPensionBase: z.number().positive().optional(),
  customHealthBase: z.number().positive().optional(),

  // Optional sickness insurance
  includeSicknessInsurance: z.boolean().default(true),

  // Year-to-date for annual limit
  ytdPensionBase: z.number().min(0).default(0),

  // Health insurance calculation method for tax
  healthDeductionMethod: z.enum(['flat', 'progressive', 'lump_sum']).default('progressive'),
  taxableIncome: z.number().min(0).optional(), // For health deduction calculation
});
export type CalculateSelfEmployedZUSInput = z.infer<typeof calculateSelfEmployedZUSSchema>;

// ===========================================================================
// DECLARATION MANAGEMENT SCHEMAS
// ===========================================================================

/**
 * Create ZUS declaration
 */
export const createZUSDeclarationSchema = z.object({
  clientId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  formType: zusFormTypeSchema.default('DRA'),
  accidentRate: z.number().min(0.67).max(3.33).default(1.67),
});
export type CreateZUSDeclarationInput = z.infer<typeof createZUSDeclarationSchema>;

/**
 * Add insured person to declaration
 */
export const addInsuredPersonSchema = z.object({
  declarationId: z.string().uuid(),
  personId: z.string().uuid().optional(),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(100),
  pesel: z.string().length(11),
  nip: z.string().length(10).optional(),
  insuranceCode: zusInsuranceCodeSchema,
  contributorType: zusContributorTypeSchema,
  grossSalary: z.number().positive(),
  bonus: z.number().min(0).default(0),
  accidentRate: z.number().min(0.67).max(3.33).default(1.67),
  benefitType: zusBenefitTypeSchema.optional(),
  benefitDays: z.number().int().min(0).optional(),
  benefitAmount: z.number().min(0).optional(),
});
export type AddInsuredPersonInput = z.infer<typeof addInsuredPersonSchema>;

/**
 * Update insured person
 */
export const updateInsuredPersonSchema = z.object({
  insuredPersonId: z.string().uuid(),
  grossSalary: z.number().positive().optional(),
  bonus: z.number().min(0).optional(),
  insuranceCode: zusInsuranceCodeSchema.optional(),
  benefitType: zusBenefitTypeSchema.optional(),
  benefitDays: z.number().int().min(0).optional(),
  benefitAmount: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateInsuredPersonInput = z.infer<typeof updateInsuredPersonSchema>;

/**
 * Remove insured person from declaration
 */
export const removeInsuredPersonSchema = z.object({
  insuredPersonId: z.string().uuid(),
});
export type RemoveInsuredPersonInput = z.infer<typeof removeInsuredPersonSchema>;

/**
 * Calculate declaration totals
 */
export const calculateDeclarationTotalsSchema = z.object({
  declarationId: z.string().uuid(),
  recalculateAll: z.boolean().default(false), // Recalculate all insured persons
});
export type CalculateDeclarationTotalsInput = z.infer<typeof calculateDeclarationTotalsSchema>;

/**
 * Validate declaration before submission
 */
export const validateZUSDeclarationSchema = z.object({
  declarationId: z.string().uuid(),
});
export type ValidateZUSDeclarationInput = z.infer<typeof validateZUSDeclarationSchema>;

/**
 * Submit declaration to ZUS
 */
export const submitZUSDeclarationSchema = z.object({
  declarationId: z.string().uuid(),
  submissionMethod: z.enum(['PUE_ZUS', 'PLATNIK', 'MANUAL']).default('PUE_ZUS'),
});
export type SubmitZUSDeclarationInput = z.infer<typeof submitZUSDeclarationSchema>;

/**
 * Create correction declaration
 */
export const createZUSCorrectionSchema = z.object({
  originalDeclarationId: z.string().uuid(),
  correctionReason: z.string().min(10).max(500),
});
export type CreateZUSCorrectionInput = z.infer<typeof createZUSCorrectionSchema>;

/**
 * Get declaration by ID
 */
export const getZUSDeclarationSchema = z.object({
  declarationId: z.string().uuid(),
  includeInsuredPersons: z.boolean().default(true),
});
export type GetZUSDeclarationInput = z.infer<typeof getZUSDeclarationSchema>;

/**
 * List declarations with filters
 */
export const listZUSDeclarationsSchema = z.object({
  clientId: z.string().uuid().optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
  formType: zusFormTypeSchema.optional(),
  status: zusDeclarationStatusSchema.optional(),
  isCorrection: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type ListZUSDeclarationsInput = z.infer<typeof listZUSDeclarationsSchema>;

/**
 * Delete declaration
 */
export const deleteZUSDeclarationSchema = z.object({
  declarationId: z.string().uuid(),
});
export type DeleteZUSDeclarationInput = z.infer<typeof deleteZUSDeclarationSchema>;

// ===========================================================================
// PAYMENT SCHEMAS
// ===========================================================================

/**
 * Calculate payment amounts
 */
export const calculateZUSPaymentSchema = z.object({
  declarationId: z.string().uuid(),
});
export type CalculateZUSPaymentInput = z.infer<typeof calculateZUSPaymentSchema>;

/**
 * Record payment
 */
export const recordZUSPaymentSchema = z.object({
  declarationId: z.string().uuid(),
  paymentDate: z.string().datetime(),
  paymentReference: z.string().min(1).max(50),
  totalAmount: z.number().positive(),
  bankAccount: z.string().optional(),
});
export type RecordZUSPaymentInput = z.infer<typeof recordZUSPaymentSchema>;

/**
 * Get payment schedule
 */
export const getZUSPaymentScheduleSchema = z.object({
  clientId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
});
export type GetZUSPaymentScheduleInput = z.infer<typeof getZUSPaymentScheduleSchema>;

// ===========================================================================
// HISTORY AND REPORTING SCHEMAS
// ===========================================================================

/**
 * Get contribution history for a person
 */
export const getContributionHistorySchema = z.object({
  personId: z.string().uuid().optional(),
  pesel: z.string().length(11).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(12),
}).refine(data => data.personId || data.pesel, {
  message: 'Either personId or pesel must be provided',
});
export type GetContributionHistoryInput = z.infer<typeof getContributionHistorySchema>;

/**
 * Generate annual ZUS report
 */
export const generateAnnualReportSchema = z.object({
  clientId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  includeDetails: z.boolean().default(true),
});
export type GenerateAnnualReportInput = z.infer<typeof generateAnnualReportSchema>;

// ===========================================================================
// OUTPUT SCHEMAS
// ===========================================================================

/**
 * Employee ZUS calculation result
 */
export const employeeZUSCalculationResultSchema = z.object({
  grossSalary: z.string(),
  totalBonuses: z.string(),
  totalIncome: z.string(),

  // Bases after annual limit check
  pensionBase: z.string(),
  disabilityBase: z.string(),
  sicknessBase: z.string(),
  accidentBase: z.string(),
  healthBase: z.string(),

  // Contributions breakdown
  contributions: zusContributionBreakdownSchema,

  // Net salary calculation helpers
  totalEmployeeContributions: z.string(),
  incomeAfterZUS: z.string(),   // Gross - employee ZUS contributions
  healthDeduction: z.string(),   // 7.75% deductible from tax

  // Annual limit info
  isAnnualLimitReached: z.boolean(),
  annualLimitRemaining: z.string().optional(),

  // Warnings
  warnings: z.array(z.string()),
});
export type EmployeeZUSCalculationResult = z.infer<typeof employeeZUSCalculationResultSchema>;

/**
 * Self-employed ZUS calculation result
 */
export const selfEmployedZUSCalculationResultSchema = z.object({
  scheme: zusContributionSchemeSchema,

  // Bases
  pensionBase: z.string(),
  disabilityBase: z.string(),
  sicknessBase: z.string(),
  accidentBase: z.string(),
  healthBase: z.string(),

  // Contributions (only self-employed pays, no employer split)
  pensionContribution: z.string(),
  disabilityContribution: z.string(),
  sicknessContribution: z.string(),
  accidentContribution: z.string(),
  healthContribution: z.string(),
  laborFundContribution: z.string(),
  totalContribution: z.string(),

  // Health insurance tax deduction
  healthDeductibleFromTax: z.string(),

  // For Mały ZUS Plus
  calculatedBase: z.string().optional(),  // Based on previous year income
  minimumBase: z.string(),
  maximumBase: z.string(),

  // Annual limit info
  isAnnualLimitReached: z.boolean(),

  // Warnings and notes
  warnings: z.array(z.string()),
  eligibilityNotes: z.array(z.string()),
});
export type SelfEmployedZUSCalculationResult = z.infer<typeof selfEmployedZUSCalculationResultSchema>;

/**
 * Validation result for declaration
 */
export const zusValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.object({
    code: z.string(),
    field: z.string().optional(),
    message: z.string(),
    severity: z.enum(['error', 'warning', 'info']),
  })),
  warnings: z.array(z.object({
    code: z.string(),
    field: z.string().optional(),
    message: z.string(),
  })),
});
export type ZUSValidationResult = z.infer<typeof zusValidationResultSchema>;

/**
 * Declaration summary with insured persons
 */
export const zusDeclarationSummarySchema = z.object({
  declaration: zusDeclarationSchema,
  insuredPersons: z.array(zusInsuredPersonSchema),
  validation: zusValidationResultSchema.optional(),
  paymentStatus: z.object({
    dueAmount: z.string(),
    paidAmount: z.string(),
    remainingAmount: z.string(),
    isOverdue: z.boolean(),
    daysUntilDue: z.number().int(),
  }),
});
export type ZUSDeclarationSummary = z.infer<typeof zusDeclarationSummarySchema>;

/**
 * List declarations result
 */
export const listZUSDeclarationsResultSchema = z.object({
  declarations: z.array(zusDeclarationSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalPages: z.number().int().min(0),
});
export type ListZUSDeclarationsResult = z.infer<typeof listZUSDeclarationsResultSchema>;

/**
 * Payment schedule item
 */
export const zusPaymentScheduleItemSchema = z.object({
  month: z.number().int().min(1).max(12),
  dueDate: z.string().datetime(),
  status: z.enum(['pending', 'paid', 'overdue', 'partial']),
  dueAmount: z.string(),
  paidAmount: z.string(),
  declarationId: z.string().uuid().optional(),
});
export type ZUSPaymentScheduleItem = z.infer<typeof zusPaymentScheduleItemSchema>;

/**
 * Annual payment schedule
 */
export const zusPaymentScheduleSchema = z.object({
  clientId: z.string().uuid(),
  year: z.number().int(),
  schedule: z.array(zusPaymentScheduleItemSchema),
  totalDue: z.string(),
  totalPaid: z.string(),
  totalOverdue: z.string(),
});
export type ZUSPaymentSchedule = z.infer<typeof zusPaymentScheduleSchema>;

/**
 * Contribution history entry
 */
export const contributionHistoryEntrySchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  declarationId: z.string().uuid(),
  pensionBase: z.string(),
  disabilityBase: z.string(),
  sicknessBase: z.string(),
  healthBase: z.string(),
  totalContributions: z.string(),
  isPaid: z.boolean(),
});
export type ContributionHistoryEntry = z.infer<typeof contributionHistoryEntrySchema>;

/**
 * Annual ZUS report
 */
export const annualZUSReportSchema = z.object({
  clientId: z.string().uuid(),
  year: z.number().int(),

  // Totals
  totalPensionContributions: z.string(),
  totalDisabilityContributions: z.string(),
  totalSicknessContributions: z.string(),
  totalAccidentContributions: z.string(),
  totalHealthContributions: z.string(),
  totalLaborFundContributions: z.string(),
  totalFGSPContributions: z.string(),
  grandTotal: z.string(),

  // Monthly breakdown
  monthlyData: z.array(z.object({
    month: z.number().int().min(1).max(12),
    insuredCount: z.number().int(),
    totalContributions: z.string(),
    isPaid: z.boolean(),
  })),

  // Payment summary
  totalDue: z.string(),
  totalPaid: z.string(),
  totalOutstanding: z.string(),

  generatedAt: z.string().datetime(),
});
export type AnnualZUSReport = z.infer<typeof annualZUSReportSchema>;
