/**
 * ACC-007: Entry Validation and Balancing
 * Zod schemas for validation rules and results
 */

import { z } from 'zod';

// ===========================================================================
// ENUMS
// ===========================================================================

export const validationSeveritySchema = z.enum(['ERROR', 'WARNING', 'INFO']);
export type ValidationSeverity = z.infer<typeof validationSeveritySchema>;

export const validationRuleTypeSchema = z.enum([
  'BALANCE',
  'ACCOUNT',
  'PERIOD',
  'CURRENCY',
  'BUSINESS',
  'CUSTOM',
]);
export type ValidationRuleType = z.infer<typeof validationRuleTypeSchema>;

// ===========================================================================
// VALIDATION RULE SCHEMAS
// ===========================================================================

/**
 * Validation rule entity
 */
export const validationRuleSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  ruleCode: z.string(),
  ruleName: z.string(),
  ruleType: validationRuleTypeSchema,
  isActive: z.boolean(),
  severity: validationSeveritySchema,
  conditions: z.record(z.any()),
  errorMessage: z.string(),
  appliesToEntryTypes: z.array(z.string()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type ValidationRule = z.infer<typeof validationRuleSchema>;

/**
 * Create validation rule input
 */
export const createValidationRuleSchema = z.object({
  ruleCode: z.string().min(1).max(50),
  ruleName: z.string().min(1).max(255),
  ruleType: validationRuleTypeSchema,
  severity: validationSeveritySchema.default('ERROR'),
  conditions: z.record(z.any()),
  errorMessage: z.string().min(1),
  appliesToEntryTypes: z.array(z.string()).optional(),
});
export type CreateValidationRuleInput = z.infer<typeof createValidationRuleSchema>;

/**
 * Update validation rule input
 */
export const updateValidationRuleSchema = z.object({
  ruleId: z.string().uuid(),
  ruleName: z.string().min(1).max(255).optional(),
  severity: validationSeveritySchema.optional(),
  conditions: z.record(z.any()).optional(),
  errorMessage: z.string().min(1).optional(),
  appliesToEntryTypes: z.array(z.string()).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateValidationRuleInput = z.infer<typeof updateValidationRuleSchema>;

/**
 * Get validation rule input
 */
export const getValidationRuleSchema = z.object({
  ruleId: z.string().uuid(),
});
export type GetValidationRuleInput = z.infer<typeof getValidationRuleSchema>;

/**
 * List validation rules input
 */
export const listValidationRulesSchema = z.object({
  ruleType: validationRuleTypeSchema.optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional(),
});
export type ListValidationRulesInput = z.infer<typeof listValidationRulesSchema>;

/**
 * List validation rules result
 */
export const listValidationRulesResultSchema = z.object({
  rules: z.array(validationRuleSchema),
  total: z.number().int(),
});
export type ListValidationRulesResult = z.infer<typeof listValidationRulesResultSchema>;

/**
 * Delete validation rule input
 */
export const deleteValidationRuleSchema = z.object({
  ruleId: z.string().uuid(),
});
export type DeleteValidationRuleInput = z.infer<typeof deleteValidationRuleSchema>;

/**
 * Toggle rule status input
 */
export const toggleValidationRuleSchema = z.object({
  ruleId: z.string().uuid(),
});
export type ToggleValidationRuleInput = z.infer<typeof toggleValidationRuleSchema>;

// ===========================================================================
// VALIDATION RESULT SCHEMAS
// ===========================================================================

/**
 * Single validation result item
 */
export const validationResultItemSchema = z.object({
  ruleCode: z.string(),
  ruleName: z.string(),
  passed: z.boolean(),
  severity: validationSeveritySchema,
  message: z.string(),
  details: z.record(z.any()).optional(),
  lineNumber: z.number().int().optional(),
  accountCode: z.string().optional(),
});
export type ValidationResultItem = z.infer<typeof validationResultItemSchema>;

/**
 * Balance information
 */
export const balanceInfoSchema = z.object({
  totalDebits: z.number(),
  totalCredits: z.number(),
  difference: z.number(),
  isBalanced: z.boolean(),
  currency: z.string(),
});
export type BalanceInfo = z.infer<typeof balanceInfoSchema>;

/**
 * Validation summary
 */
export const validationSummarySchema = z.object({
  totalRules: z.number().int(),
  passed: z.number().int(),
  errors: z.number().int(),
  warnings: z.number().int(),
  infos: z.number().int(),
});
export type ValidationSummary = z.infer<typeof validationSummarySchema>;

/**
 * Full validation response
 */
export const validationResponseSchema = z.object({
  isValid: z.boolean(),
  canPost: z.boolean(),
  results: z.array(validationResultItemSchema),
  summary: validationSummarySchema,
  balanceInfo: balanceInfoSchema,
});
export type ValidationResponse = z.infer<typeof validationResponseSchema>;

// ===========================================================================
// VALIDATE ENTRY INPUT SCHEMAS
// ===========================================================================

/**
 * Entry line for validation
 */
export const validationEntryLineSchema = z.object({
  accountId: z.string().uuid(),
  debitAmount: z.number().nonnegative().default(0),
  creditAmount: z.number().nonnegative().default(0),
  currency: z.string().length(3).default('PLN'),
  exchangeRate: z.number().positive().default(1),
  costCenterId: z.string().uuid().optional(),
  description: z.string().optional(),
});
export type ValidationEntryLine = z.infer<typeof validationEntryLineSchema>;

/**
 * Entry data for inline validation
 */
export const validationEntryDataSchema = z.object({
  entryDate: z.coerce.date(),
  entryType: z.string(),
  lines: z.array(validationEntryLineSchema).min(1),
});
export type ValidationEntryData = z.infer<typeof validationEntryDataSchema>;

/**
 * Validate entry input
 */
export const validateEntryInputSchema = z
  .object({
    entryId: z.string().uuid().optional(),
    entryData: validationEntryDataSchema.optional(),
    storeResult: z.boolean().default(true),
  })
  .refine((data) => data.entryId || data.entryData, {
    message: 'Must provide either entryId or entryData',
  });
export type ValidateEntryInput = z.infer<typeof validateEntryInputSchema>;

// ===========================================================================
// QUICK BALANCE CHECK SCHEMAS
// ===========================================================================

/**
 * Quick balance check line
 */
export const balanceCheckLineSchema = z.object({
  debitAmount: z.number().nonnegative(),
  creditAmount: z.number().nonnegative(),
  currency: z.string().length(3).default('PLN'),
  exchangeRate: z.number().positive().default(1),
});
export type BalanceCheckLine = z.infer<typeof balanceCheckLineSchema>;

/**
 * Quick balance check input
 */
export const checkBalanceInputSchema = z.object({
  lines: z.array(balanceCheckLineSchema).min(1),
});
export type CheckBalanceInput = z.infer<typeof checkBalanceInputSchema>;

/**
 * Quick balance check result
 */
export const checkBalanceResultSchema = z.object({
  totalDebits: z.number(),
  totalCredits: z.number(),
  difference: z.number(),
  isBalanced: z.boolean(),
});
export type CheckBalanceResult = z.infer<typeof checkBalanceResultSchema>;

// ===========================================================================
// VALIDATION HISTORY SCHEMAS
// ===========================================================================

/**
 * Validation result record (stored)
 */
export const validationResultRecordSchema = z.object({
  id: z.string().uuid(),
  entryId: z.string().uuid(),
  validatedAt: z.date(),
  validatedBy: z.string().uuid().nullable(),
  isValid: z.boolean(),
  canPost: z.boolean(),
  results: z.array(validationResultItemSchema),
  errorCount: z.number().int(),
  warningCount: z.number().int(),
  infoCount: z.number().int(),
  validatedByUser: z
    .object({
      name: z.string(),
      email: z.string(),
    })
    .optional(),
});
export type ValidationResultRecord = z.infer<typeof validationResultRecordSchema>;

/**
 * Get validation history input
 */
export const getValidationHistorySchema = z.object({
  entryId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(10),
});
export type GetValidationHistoryInput = z.infer<typeof getValidationHistorySchema>;

/**
 * Get validation history result
 */
export const getValidationHistoryResultSchema = z.object({
  history: z.array(validationResultRecordSchema),
  total: z.number().int(),
});
export type GetValidationHistoryResult = z.infer<typeof getValidationHistoryResultSchema>;

// ===========================================================================
// CORE VALIDATION RULE CODES
// ===========================================================================

export const CORE_VALIDATION_RULES = {
  BALANCE: 'CORE_BALANCE',
  ZERO_ENTRY: 'CORE_ZERO_ENTRY',
  ACCOUNT_EXISTS: 'CORE_ACCOUNT_EXISTS',
  ACCOUNT_ACTIVE: 'CORE_ACCOUNT_ACTIVE',
  ACCOUNT_POSTABLE: 'CORE_ACCOUNT_POSTABLE',
  COST_CENTER_REQUIRED: 'CORE_COST_CENTER_REQUIRED',
  LINE_AMOUNT: 'CORE_LINE_AMOUNT',
  PERIOD_EXISTS: 'CORE_PERIOD_EXISTS',
  PERIOD_OPEN: 'CORE_PERIOD_OPEN',
  PERIOD_SOFT_CLOSED: 'CORE_PERIOD_SOFT_CLOSED',
  MULTI_CURRENCY: 'CORE_MULTI_CURRENCY',
  EXCHANGE_RATE: 'CORE_EXCHANGE_RATE',
} as const;

// ===========================================================================
// DEFAULT BUSINESS RULES
// ===========================================================================

export const DEFAULT_BUSINESS_RULES = [
  {
    ruleCode: 'BUS_VAT_WITH_EXPENSE',
    ruleName: 'VAT Posting Requires Expense',
    ruleType: 'BUSINESS' as const,
    severity: 'WARNING' as const,
    conditions: { rule: 'vat_with_expense', vatAccountPrefix: '22' },
    errorMessage: 'VAT posting without corresponding expense transaction',
    appliesToEntryTypes: ['STANDARD'],
  },
  {
    ruleCode: 'BUS_LARGE_AMOUNT',
    ruleName: 'Large Amount Threshold',
    ruleType: 'BUSINESS' as const,
    severity: 'WARNING' as const,
    conditions: { rule: 'large_amount', threshold: 50000 },
    errorMessage: 'Entry amount exceeds threshold and may require review',
    appliesToEntryTypes: null,
  },
];
