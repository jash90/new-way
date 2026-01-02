import { z } from 'zod';

// ===========================================================================
// ENUMS AND CONSTANTS
// ===========================================================================

/**
 * Normal balance types for accounts
 */
export const normalBalanceSchema = z.enum(['DEBIT', 'CREDIT']);
export type NormalBalance = z.infer<typeof normalBalanceSchema>;

/**
 * Export formats supported
 */
export const exportFormatSchema = z.enum(['xlsx', 'pdf', 'csv']);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

/**
 * Order direction for ledger entries
 */
export const ledgerOrderBySchema = z.enum(['date_asc', 'date_desc']);
export type LedgerOrderBy = z.infer<typeof ledgerOrderBySchema>;

// ===========================================================================
// INPUT SCHEMAS
// ===========================================================================

/**
 * Query parameters for account ledger
 */
export const getAccountLedgerSchema = z.object({
  accountId: z.string().uuid(),
  periodId: z.string().uuid().optional(),
  fiscalYearId: z.string().uuid().optional(),
  dateRange: z.object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  }).optional(),
  entryTypes: z.array(z.string()).optional(),
  search: z.string().optional(),
  costCenterId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  includeRunningBalance: z.boolean().default(true),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
  orderBy: ledgerOrderBySchema.default('date_asc'),
});
export type GetAccountLedgerInput = z.infer<typeof getAccountLedgerSchema>;

/**
 * Full GL report parameters
 */
export const getFullGLReportSchema = z.object({
  periodId: z.string().uuid().optional(),
  fiscalYearId: z.string().uuid().optional(),
  dateRange: z.object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  }).optional(),
  accountTypes: z.array(z.string()).optional(),
  includeZeroBalance: z.boolean().default(false),
  groupByType: z.boolean().default(true),
});
export type GetFullGLReportInput = z.infer<typeof getFullGLReportSchema>;

/**
 * Export parameters
 */
export const exportGLSchema = getFullGLReportSchema.extend({
  format: exportFormatSchema.default('xlsx'),
  separateSheets: z.boolean().default(true),
});
export type ExportGLInput = z.infer<typeof exportGLSchema>;

/**
 * Get account balance for specific date
 */
export const getAccountBalanceSchema = z.object({
  accountId: z.string().uuid(),
  asOfDate: z.coerce.date(),
});
export type GetAccountBalanceInput = z.infer<typeof getAccountBalanceSchema>;

/**
 * Get multiple account balances
 */
export const getAccountBalancesSchema = z.object({
  accountIds: z.array(z.string().uuid()),
  periodId: z.string().uuid(),
});
export type GetAccountBalancesInput = z.infer<typeof getAccountBalancesSchema>;

/**
 * Recalculate balance parameters
 */
export const recalculateBalanceSchema = z.object({
  accountId: z.string().uuid(),
  periodId: z.string().uuid(),
});
export type RecalculateBalanceInput = z.infer<typeof recalculateBalanceSchema>;

/**
 * Post journal entry to GL
 */
export const postToGLSchema = z.object({
  entryId: z.string().uuid(),
});
export type PostToGLInput = z.infer<typeof postToGLSchema>;

/**
 * Batch recalculate balances
 */
export const batchRecalculateBalancesSchema = z.object({
  periodId: z.string().uuid(),
  accountIds: z.array(z.string().uuid()).optional(),
});
export type BatchRecalculateBalancesInput = z.infer<typeof batchRecalculateBalancesSchema>;

// ===========================================================================
// ENTITY SCHEMAS
// ===========================================================================

/**
 * General ledger entry record
 */
export const generalLedgerRecordSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  entryId: z.string().uuid(),
  lineId: z.string().uuid(),
  accountId: z.string().uuid(),
  periodId: z.string().uuid(),
  entryDate: z.coerce.date(),
  entryNumber: z.string(),
  entryType: z.string(),
  debitAmount: z.number(),
  creditAmount: z.number(),
  description: z.string().nullable(),
  reference: z.string().nullable(),
  costCenterId: z.string().uuid().nullable(),
  projectId: z.string().uuid().nullable(),
  postedAt: z.coerce.date(),
  createdAt: z.coerce.date(),
});
export type GeneralLedgerRecord = z.infer<typeof generalLedgerRecordSchema>;

/**
 * Account balance record
 */
export const accountBalanceRecordSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  periodId: z.string().uuid(),
  openingBalance: z.number(),
  debitMovements: z.number(),
  creditMovements: z.number(),
  closingBalance: z.number(),
  lastUpdated: z.coerce.date(),
});
export type AccountBalanceRecord = z.infer<typeof accountBalanceRecordSchema>;

// ===========================================================================
// RESPONSE SCHEMAS
// ===========================================================================

/**
 * Ledger entry response (with optional running balance)
 */
export const ledgerEntrySchema = z.object({
  id: z.string().uuid(),
  entryDate: z.coerce.date(),
  entryNumber: z.string(),
  entryType: z.string(),
  entryId: z.string().uuid(),
  description: z.string().nullable(),
  reference: z.string().nullable(),
  debitAmount: z.number(),
  creditAmount: z.number(),
  runningBalance: z.number().optional(),
  costCenterName: z.string().nullable(),
  projectName: z.string().nullable(),
  postedAt: z.coerce.date(),
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

/**
 * Account info for ledger response
 */
export const ledgerAccountInfoSchema = z.object({
  id: z.string().uuid(),
  accountCode: z.string(),
  accountName: z.string(),
  accountType: z.string(),
  normalBalance: normalBalanceSchema,
});
export type LedgerAccountInfo = z.infer<typeof ledgerAccountInfoSchema>;

/**
 * Period info for ledger response
 */
export const ledgerPeriodInfoSchema = z.object({
  name: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});
export type LedgerPeriodInfo = z.infer<typeof ledgerPeriodInfoSchema>;

/**
 * Ledger totals
 */
export const ledgerTotalsSchema = z.object({
  debitTotal: z.number(),
  creditTotal: z.number(),
  netMovement: z.number(),
  closingBalance: z.number(),
});
export type LedgerTotals = z.infer<typeof ledgerTotalsSchema>;

/**
 * Pagination info
 */
export const paginationInfoSchema = z.object({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  hasMore: z.boolean(),
});
export type PaginationInfo = z.infer<typeof paginationInfoSchema>;

/**
 * Account ledger response
 */
export const accountLedgerSchema = z.object({
  account: ledgerAccountInfoSchema,
  period: ledgerPeriodInfoSchema.optional(),
  openingBalance: z.number(),
  entries: z.array(ledgerEntrySchema),
  totals: ledgerTotalsSchema,
  pagination: paginationInfoSchema,
});
export type AccountLedger = z.infer<typeof accountLedgerSchema>;

/**
 * GL account summary for report
 */
export const glAccountSummarySchema = z.object({
  accountId: z.string().uuid(),
  accountCode: z.string(),
  accountName: z.string(),
  accountType: z.string(),
  openingBalance: z.number(),
  debitMovements: z.number(),
  creditMovements: z.number(),
  closingBalance: z.number(),
  entryCount: z.number(),
});
export type GLAccountSummary = z.infer<typeof glAccountSummarySchema>;

/**
 * Report totals
 */
export const glReportTotalsSchema = z.object({
  totalDebits: z.number(),
  totalCredits: z.number(),
  accountCount: z.number(),
  entryCount: z.number(),
});
export type GLReportTotals = z.infer<typeof glReportTotalsSchema>;

/**
 * Full GL report response
 */
export const fullGLReportSchema = z.object({
  reportTitle: z.string(),
  period: z.string(),
  generatedAt: z.coerce.date(),
  accounts: z.array(glAccountSummarySchema),
  groupedByType: z.record(z.array(glAccountSummarySchema)).optional(),
  totals: glReportTotalsSchema,
});
export type FullGLReport = z.infer<typeof fullGLReportSchema>;

/**
 * Single account balance response
 */
export const accountBalanceResponseSchema = z.object({
  accountId: z.string().uuid(),
  accountCode: z.string(),
  accountName: z.string(),
  asOfDate: z.coerce.date(),
  debitTotal: z.number(),
  creditTotal: z.number(),
  balance: z.number(),
});
export type AccountBalanceResponse = z.infer<typeof accountBalanceResponseSchema>;

/**
 * Multiple account balances response
 */
export const accountBalancesResponseSchema = z.object({
  accountId: z.string().uuid(),
  accountCode: z.string(),
  accountName: z.string(),
  accountType: z.string(),
  openingBalance: z.number(),
  debitMovements: z.number(),
  creditMovements: z.number(),
  closingBalance: z.number(),
});
export type AccountBalancesResponse = z.infer<typeof accountBalancesResponseSchema>;

/**
 * Export result
 */
export const exportResultSchema = z.object({
  fileId: z.string().uuid(),
  fileName: z.string(),
  downloadUrl: z.string().url(),
});
export type ExportResult = z.infer<typeof exportResultSchema>;

/**
 * Recalculate balance result
 */
export const recalculateBalanceResultSchema = z.object({
  success: z.boolean(),
  accountId: z.string().uuid(),
  periodId: z.string().uuid(),
  openingBalance: z.number(),
  debitMovements: z.number(),
  creditMovements: z.number(),
  closingBalance: z.number(),
});
export type RecalculateBalanceResult = z.infer<typeof recalculateBalanceResultSchema>;

/**
 * Post to GL result
 */
export const postToGLResultSchema = z.object({
  success: z.boolean(),
  entryId: z.string().uuid(),
  recordsCreated: z.number(),
  balancesUpdated: z.number(),
});
export type PostToGLResult = z.infer<typeof postToGLResultSchema>;

/**
 * Batch recalculate result
 */
export const batchRecalculateResultSchema = z.object({
  success: z.boolean(),
  accountsProcessed: z.number(),
  errors: z.array(z.object({
    accountId: z.string().uuid(),
    error: z.string(),
  })).optional(),
});
export type BatchRecalculateResult = z.infer<typeof batchRecalculateResultSchema>;
