/**
 * ACC-012: Trial Balance Schemas
 * Provides schema definitions for trial balance generation and working trial balances
 */

import { z } from 'zod';

// ===========================================================================
// ENUMS
// ===========================================================================

/**
 * Trial balance grouping options
 */
export const groupBySchema = z.enum(['NONE', 'CLASS', 'PARENT']);

export type GroupBy = z.infer<typeof groupBySchema>;

/**
 * Working trial balance status
 */
export const wtbStatusSchema = z.enum(['DRAFT', 'LOCKED', 'ARCHIVED']);

export type WTBStatus = z.infer<typeof wtbStatusSchema>;

/**
 * Adjustment column types
 */
export const adjustmentTypeSchema = z.enum(['ADJUSTING', 'RECLASSIFICATION', 'PROPOSED']);

export type AdjustmentType = z.infer<typeof adjustmentTypeSchema>;

/**
 * Export format options
 */
export const exportFormatSchema = z.enum(['XLSX', 'PDF', 'CSV']);

export type ExportFormat = z.infer<typeof exportFormatSchema>;

/**
 * Page orientation for exports
 */
export const pageOrientationSchema = z.enum(['PORTRAIT', 'LANDSCAPE']);

export type PageOrientation = z.infer<typeof pageOrientationSchema>;

// ===========================================================================
// INPUT SCHEMAS
// ===========================================================================

/**
 * Generate trial balance input schema
 */
export const generateTrialBalanceSchema = z.object({
  asOfDate: z.coerce.date({ required_error: 'As of date is required' }),
  periodId: z.string().uuid().optional(),

  // Filtering
  accountClassFilter: z.array(z.number().int().min(0).max(9)).optional(),
  accountCodeFrom: z.string().max(50).optional(),
  accountCodeTo: z.string().max(50).optional(),
  accountIds: z.array(z.string().uuid()).optional(),

  // Display options
  includeZeroBalances: z.boolean().default(false),
  includeInactiveAccounts: z.boolean().default(true),
  groupBy: groupBySchema.default('NONE'),

  // Movement options (for period TB)
  includeOpeningBalance: z.boolean().default(true),
  includeMovements: z.boolean().default(true),
});

export type GenerateTrialBalanceInput = z.infer<typeof generateTrialBalanceSchema>;

/**
 * Comparative trial balance input schema
 */
export const comparativeTrialBalanceSchema = z.object({
  currentAsOfDate: z.coerce.date({ required_error: 'Current as of date is required' }),
  comparePeriods: z
    .array(
      z.object({
        asOfDate: z.coerce.date(),
        label: z.string().max(50),
      })
    )
    .min(1, 'At least one comparison period is required')
    .max(6, 'Maximum 6 comparison periods allowed'),

  includeVariance: z.boolean().default(true),
  includePercentageChange: z.boolean().default(true),
  highlightThreshold: z.number().min(0).max(100).default(10),

  // Filtering
  accountClassFilter: z.array(z.number().int().min(0).max(9)).optional(),
  includeZeroBalances: z.boolean().default(false),
  groupBy: groupBySchema.default('NONE'),
});

export type ComparativeTrialBalanceInput = z.infer<typeof comparativeTrialBalanceSchema>;

/**
 * Create working trial balance input schema
 */
export const createWorkingTBSchema = z.object({
  wtbName: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional(),
  fiscalYearId: z.string().uuid({ message: 'Fiscal year ID must be a valid UUID' }),
  periodId: z.string().uuid().optional(),
  asOfDate: z.coerce.date({ required_error: 'As of date is required' }),
  includeZeroBalances: z.boolean().default(false),
  groupBy: groupBySchema.default('NONE'),
});

export type CreateWorkingTBInput = z.infer<typeof createWorkingTBSchema>;

/**
 * Get working trial balance input schema
 */
export const getWorkingTBSchema = z.object({
  wtbId: z.string().uuid({ message: 'WTB ID must be a valid UUID' }),
});

export type GetWorkingTBInput = z.infer<typeof getWorkingTBSchema>;

/**
 * List working trial balances input schema
 */
export const listWorkingTBSchema = z.object({
  fiscalYearId: z.string().uuid().optional(),
  status: wtbStatusSchema.optional(),
  search: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListWorkingTBInput = z.infer<typeof listWorkingTBSchema>;

/**
 * Add adjustment column input schema
 */
export const addAdjustmentColumnSchema = z.object({
  wtbId: z.string().uuid({ message: 'WTB ID must be a valid UUID' }),
  columnName: z.string().min(1, 'Column name is required').max(100),
  columnType: adjustmentTypeSchema,
  journalEntryId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
});

export type AddAdjustmentColumnInput = z.infer<typeof addAdjustmentColumnSchema>;

/**
 * Record adjustment input schema
 */
export const recordAdjustmentSchema = z.object({
  wtbId: z.string().uuid({ message: 'WTB ID must be a valid UUID' }),
  columnId: z.string().uuid({ message: 'Column ID must be a valid UUID' }),
  accountId: z.string().uuid({ message: 'Account ID must be a valid UUID' }),
  amount: z.number(), // Positive = debit, Negative = credit
  reference: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
});

export type RecordAdjustmentInput = z.infer<typeof recordAdjustmentSchema>;

/**
 * Lock working trial balance input schema
 */
export const lockWTBSchema = z.object({
  wtbId: z.string().uuid({ message: 'WTB ID must be a valid UUID' }),
  lockReason: z.string().max(500).optional(),
});

export type LockWTBInput = z.infer<typeof lockWTBSchema>;

/**
 * Delete working trial balance input schema
 */
export const deleteWTBSchema = z.object({
  wtbId: z.string().uuid({ message: 'WTB ID must be a valid UUID' }),
});

export type DeleteWTBInput = z.infer<typeof deleteWTBSchema>;

/**
 * Export trial balance input schema
 */
export const exportTrialBalanceSchema = z.object({
  asOfDate: z.coerce.date({ required_error: 'As of date is required' }),
  format: exportFormatSchema,

  // Include generation options
  includeZeroBalances: z.boolean().default(false),
  groupBy: groupBySchema.default('NONE'),
  includeCompanyHeader: z.boolean().default(true),
  pageOrientation: pageOrientationSchema.default('PORTRAIT'),
});

export type ExportTrialBalanceInput = z.infer<typeof exportTrialBalanceSchema>;

// ===========================================================================
// ENTITY SCHEMAS
// ===========================================================================

/**
 * Trial balance line schema
 */
export const trialBalanceLineSchema = z.object({
  accountId: z.string().uuid(),
  accountCode: z.string(),
  accountName: z.string(),
  accountClass: z.number().int().min(0).max(9),
  accountType: z.string(),
  parentAccountId: z.string().uuid().nullable(),
  normalBalance: z.enum(['DEBIT', 'CREDIT']),
  isActive: z.boolean(),

  // Balances
  debitBalance: z.number(),
  creditBalance: z.number(),

  // For period TB
  openingDebit: z.number().optional(),
  openingCredit: z.number().optional(),
  movementDebit: z.number().optional(),
  movementCredit: z.number().optional(),

  // Metadata
  isWarning: z.boolean().optional(),
  isGroupHeader: z.boolean().optional(),
  level: z.number().int().optional(),
});

export type TrialBalanceLine = z.infer<typeof trialBalanceLineSchema>;

/**
 * Trial balance totals schema
 */
export const trialBalanceTotalsSchema = z.object({
  debit: z.number(),
  credit: z.number(),
  openingDebit: z.number().optional(),
  openingCredit: z.number().optional(),
  movementDebit: z.number().optional(),
  movementCredit: z.number().optional(),
});

export type TrialBalanceTotals = z.infer<typeof trialBalanceTotalsSchema>;

/**
 * Comparative line schema
 */
export const comparativeLineSchema = z.object({
  accountId: z.string().uuid(),
  accountCode: z.string(),
  accountName: z.string(),
  accountClass: z.number().int(),
  normalBalance: z.enum(['DEBIT', 'CREDIT']),

  currentDebit: z.number(),
  currentCredit: z.number(),

  periodBalances: z.array(
    z.object({
      label: z.string(),
      asOfDate: z.coerce.date(),
      debit: z.number(),
      credit: z.number(),
    })
  ),

  variances: z.array(
    z.object({
      label: z.string(),
      variance: z.number(),
      percentChange: z.number().nullable(),
      isSignificant: z.boolean(),
    })
  ),
});

export type ComparativeLine = z.infer<typeof comparativeLineSchema>;

/**
 * Working trial balance line schema
 */
export const wtbLineSchema = z.object({
  id: z.string().uuid(),
  wtbId: z.string().uuid(),
  accountId: z.string().uuid(),
  accountCode: z.string(),
  accountName: z.string(),

  unadjustedDebit: z.number(),
  unadjustedCredit: z.number(),

  adjustments: z.array(
    z.object({
      columnId: z.string().uuid(),
      amount: z.number(),
      reference: z.string().nullable(),
      description: z.string().nullable(),
      updatedAt: z.string(),
      updatedBy: z.string().uuid(),
    })
  ),

  adjustedDebit: z.number(),
  adjustedCredit: z.number(),

  isWarning: z.boolean(),
  notes: z.string().nullable(),
  displayOrder: z.number().int(),
});

export type WTBLine = z.infer<typeof wtbLineSchema>;

/**
 * Adjustment column schema
 */
export const adjustmentColumnSchema = z.object({
  id: z.string().uuid(),
  wtbId: z.string().uuid(),
  columnName: z.string(),
  columnType: adjustmentTypeSchema,
  journalEntryId: z.string().uuid().nullable(),
  description: z.string().nullable(),
  displayOrder: z.number().int(),
  createdAt: z.coerce.date(),
  createdBy: z
    .object({
      id: z.string().uuid(),
      name: z.string().nullable(),
      email: z.string(),
    })
    .nullable(),
});

export type AdjustmentColumn = z.infer<typeof adjustmentColumnSchema>;

/**
 * Working trial balance schema
 */
export const workingTrialBalanceSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  wtbCode: z.string(),
  wtbName: z.string(),
  description: z.string().nullable(),

  fiscalYearId: z.string().uuid(),
  periodId: z.string().uuid().nullable(),
  asOfDate: z.coerce.date(),

  status: wtbStatusSchema,
  lockedAt: z.coerce.date().nullable(),
  lockedBy: z
    .object({
      id: z.string().uuid(),
      name: z.string().nullable(),
      email: z.string(),
    })
    .nullable(),

  includeZeroBalances: z.boolean(),
  groupBy: groupBySchema,

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdBy: z
    .object({
      id: z.string().uuid(),
      name: z.string().nullable(),
      email: z.string(),
    })
    .nullable(),
});

export type WorkingTrialBalance = z.infer<typeof workingTrialBalanceSchema>;

// ===========================================================================
// RESULT SCHEMAS
// ===========================================================================

/**
 * Generate trial balance result schema
 */
export const trialBalanceResultSchema = z.object({
  asOfDate: z.coerce.date(),
  periodId: z.string().uuid().nullable(),
  generatedAt: z.coerce.date(),
  generatedBy: z.string().uuid(),

  lines: z.array(trialBalanceLineSchema),
  totals: trialBalanceTotalsSchema,
  isBalanced: z.boolean(),
  outOfBalanceAmount: z.number(),

  metadata: z.object({
    accountCount: z.number().int(),
    groupBy: groupBySchema,
    includeZeroBalances: z.boolean(),
    warningCount: z.number().int(),
  }),
});

export type TrialBalanceResult = z.infer<typeof trialBalanceResultSchema>;

/**
 * Comparative trial balance result schema
 */
export const comparativeTrialBalanceResultSchema = z.object({
  currentAsOfDate: z.coerce.date(),
  comparePeriods: z.array(
    z.object({
      asOfDate: z.coerce.date(),
      label: z.string(),
    })
  ),
  generatedAt: z.coerce.date(),

  lines: z.array(comparativeLineSchema),

  metadata: z.object({
    accountCount: z.number().int(),
    groupBy: groupBySchema,
    highlightThreshold: z.number(),
  }),
});

export type ComparativeTrialBalanceResult = z.infer<typeof comparativeTrialBalanceResultSchema>;

/**
 * Create working trial balance result schema
 */
export const createWorkingTBResultSchema = workingTrialBalanceSchema;

export type CreateWorkingTBResult = z.infer<typeof createWorkingTBResultSchema>;

/**
 * Get working trial balance result schema (with lines and columns)
 */
export const getWorkingTBResultSchema = workingTrialBalanceSchema.extend({
  lines: z.array(wtbLineSchema),
  adjustmentColumns: z.array(adjustmentColumnSchema),
  fiscalYear: z.object({
    id: z.string().uuid(),
    yearCode: z.string(),
    yearName: z.string(),
  }),
  period: z
    .object({
      id: z.string().uuid(),
      periodCode: z.string(),
      periodName: z.string(),
    })
    .nullable(),
  totals: z.object({
    unadjustedDebit: z.number(),
    unadjustedCredit: z.number(),
    adjustedDebit: z.number(),
    adjustedCredit: z.number(),
  }),
  isBalanced: z.boolean(),
});

export type GetWorkingTBResult = z.infer<typeof getWorkingTBResultSchema>;

/**
 * List working trial balances result schema
 */
export const listWorkingTBResultSchema = z.object({
  workingTrialBalances: z.array(
    workingTrialBalanceSchema.extend({
      fiscalYear: z
        .object({
          yearCode: z.string(),
          yearName: z.string(),
        })
        .nullable(),
      period: z
        .object({
          periodCode: z.string(),
          periodName: z.string(),
        })
        .nullable(),
    })
  ),
  total: z.number().int().min(0),
  hasMore: z.boolean(),
});

export type ListWorkingTBResult = z.infer<typeof listWorkingTBResultSchema>;

/**
 * Add adjustment column result schema
 */
export const addAdjustmentColumnResultSchema = adjustmentColumnSchema;

export type AddAdjustmentColumnResult = z.infer<typeof addAdjustmentColumnResultSchema>;

/**
 * Record adjustment result schema
 */
export const recordAdjustmentResultSchema = z.object({
  success: z.boolean(),
  line: wtbLineSchema,
});

export type RecordAdjustmentResult = z.infer<typeof recordAdjustmentResultSchema>;

/**
 * Lock working trial balance result schema
 */
export const lockWTBResultSchema = workingTrialBalanceSchema;

export type LockWTBResult = z.infer<typeof lockWTBResultSchema>;

/**
 * Delete working trial balance result schema
 */
export const deleteWTBResultSchema = z.object({
  success: z.boolean(),
  wtbId: z.string().uuid(),
  wtbCode: z.string(),
});

export type DeleteWTBResult = z.infer<typeof deleteWTBResultSchema>;

/**
 * Export trial balance result schema
 */
export const exportTrialBalanceResultSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
  data: z.string(), // Base64 encoded
});

export type ExportTrialBalanceResult = z.infer<typeof exportTrialBalanceResultSchema>;
