/**
 * ACC-005: Opening Balances
 * Zod schemas for opening balance operations
 */

import { z } from 'zod';

// ===========================================================================
// ENUMS
// ===========================================================================

export const openingBalanceStatusSchema = z.enum(['draft', 'verified', 'posted']);
export type OpeningBalanceStatus = z.infer<typeof openingBalanceStatusSchema>;

export const importSourceSchema = z.enum(['MANUAL', 'EXCEL', 'CSV']);
export type ImportSource = z.infer<typeof importSourceSchema>;

// ===========================================================================
// ENTITY SCHEMAS
// ===========================================================================

/**
 * Opening balance batch entity
 */
export const openingBalanceBatchSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  fiscalYearId: z.string().uuid(),
  status: openingBalanceStatusSchema,
  totalDebit: z.number(),
  totalCredit: z.number(),
  isBalanced: z.boolean(),
  postedAt: z.date().nullable(),
  postedBy: z.string().uuid().nullable(),
  journalEntryId: z.string().uuid().nullable(),
  createdAt: z.date(),
  createdBy: z.string().uuid(),
  updatedAt: z.date(),
});
export type OpeningBalanceBatch = z.infer<typeof openingBalanceBatchSchema>;

/**
 * Opening balance item entity
 */
export const openingBalanceItemSchema = z.object({
  id: z.string().uuid(),
  batchId: z.string().uuid(),
  accountId: z.string().uuid(),
  openingDebit: z.number(),
  openingCredit: z.number(),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type OpeningBalanceItem = z.infer<typeof openingBalanceItemSchema>;

/**
 * Opening balance item with account details
 */
export const openingBalanceItemWithAccountSchema = openingBalanceItemSchema.extend({
  account: z.object({
    accountCode: z.string(),
    accountName: z.string(),
    accountType: z.string(),
    normalBalance: z.string(),
  }),
});
export type OpeningBalanceItemWithAccount = z.infer<typeof openingBalanceItemWithAccountSchema>;

// ===========================================================================
// BATCH OPERATIONS
// ===========================================================================

/**
 * Create opening balance batch
 */
export const createOpeningBalanceBatchSchema = z.object({
  fiscalYearId: z.string().uuid(),
  notes: z.string().optional(),
});
export type CreateOpeningBalanceBatchInput = z.infer<typeof createOpeningBalanceBatchSchema>;

/**
 * Get opening balance batch
 */
export const getOpeningBalanceBatchSchema = z.object({
  batchId: z.string().uuid(),
});
export type GetOpeningBalanceBatchInput = z.infer<typeof getOpeningBalanceBatchSchema>;

/**
 * List opening balance batches
 */
export const listOpeningBalanceBatchesSchema = z.object({
  fiscalYearId: z.string().uuid().optional(),
  status: openingBalanceStatusSchema.optional(),
  includeItems: z.boolean().optional().default(false),
});
export type ListOpeningBalanceBatchesInput = z.infer<typeof listOpeningBalanceBatchesSchema>;

/**
 * Delete opening balance batch
 */
export const deleteOpeningBalanceBatchSchema = z.object({
  batchId: z.string().uuid(),
});
export type DeleteOpeningBalanceBatchInput = z.infer<typeof deleteOpeningBalanceBatchSchema>;

// ===========================================================================
// ITEM OPERATIONS
// ===========================================================================

/**
 * Single opening balance item input
 */
export const openingBalanceItemInputSchema = z.object({
  accountId: z.string().uuid(),
  openingDebit: z.number().nonnegative().default(0),
  openingCredit: z.number().nonnegative().default(0),
  notes: z.string().optional(),
}).refine(
  (data) => !(data.openingDebit > 0 && data.openingCredit > 0),
  { message: 'Cannot have both debit and credit amounts for the same account' }
);
export type OpeningBalanceItemInput = z.infer<typeof openingBalanceItemInputSchema>;

/**
 * Add items to batch
 */
export const addOpeningBalanceItemsSchema = z.object({
  batchId: z.string().uuid(),
  items: z.array(openingBalanceItemInputSchema).min(1),
});
export type AddOpeningBalanceItemsInput = z.infer<typeof addOpeningBalanceItemsSchema>;

/**
 * Update single item
 */
export const updateOpeningBalanceItemSchema = z.object({
  itemId: z.string().uuid(),
  openingDebit: z.number().nonnegative().optional(),
  openingCredit: z.number().nonnegative().optional(),
  notes: z.string().nullable().optional(),
}).refine(
  (data) => {
    if (data.openingDebit !== undefined && data.openingCredit !== undefined) {
      return !(data.openingDebit > 0 && data.openingCredit > 0);
    }
    return true;
  },
  { message: 'Cannot have both debit and credit amounts for the same account' }
);
export type UpdateOpeningBalanceItemInput = z.infer<typeof updateOpeningBalanceItemSchema>;

/**
 * Remove items from batch
 */
export const removeOpeningBalanceItemsSchema = z.object({
  batchId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).min(1),
});
export type RemoveOpeningBalanceItemsInput = z.infer<typeof removeOpeningBalanceItemsSchema>;

/**
 * Get items for batch
 */
export const getOpeningBalanceItemsSchema = z.object({
  batchId: z.string().uuid(),
  includeZeroBalances: z.boolean().optional().default(true),
});
export type GetOpeningBalanceItemsInput = z.infer<typeof getOpeningBalanceItemsSchema>;

// ===========================================================================
// VALIDATION & POSTING
// ===========================================================================

/**
 * Validate batch
 */
export const validateOpeningBalanceBatchSchema = z.object({
  batchId: z.string().uuid(),
});
export type ValidateOpeningBalanceBatchInput = z.infer<typeof validateOpeningBalanceBatchSchema>;

/**
 * Validation result
 */
export const validationResultSchema = z.object({
  isValid: z.boolean(),
  isBalanced: z.boolean(),
  totalDebit: z.number(),
  totalCredit: z.number(),
  difference: z.number(),
  itemCount: z.number(),
  warnings: z.array(z.object({
    itemId: z.string().uuid(),
    accountCode: z.string(),
    accountName: z.string(),
    message: z.string(),
  })),
  errors: z.array(z.string()),
});
export type ValidationResult = z.infer<typeof validationResultSchema>;

/**
 * Post opening balances
 */
export const postOpeningBalancesSchema = z.object({
  batchId: z.string().uuid(),
  forceUnbalanced: z.boolean().optional().default(false),
  entryDescription: z.string().optional().default('Opening balances'),
});
export type PostOpeningBalancesInput = z.infer<typeof postOpeningBalancesSchema>;

/**
 * Post result
 */
export const postResultSchema = z.object({
  success: z.boolean(),
  batchId: z.string().uuid(),
  journalEntryId: z.string().uuid().nullable(),
  entryNumber: z.string().nullable(),
  postedAt: z.date().nullable(),
  totalDebit: z.number(),
  totalCredit: z.number(),
  itemCount: z.number(),
});
export type PostResult = z.infer<typeof postResultSchema>;

// ===========================================================================
// IMPORT OPERATIONS
// ===========================================================================

/**
 * Column mapping for import
 */
export const columnMappingSchema = z.object({
  accountCodeColumn: z.string(),
  accountNameColumn: z.string().optional(),
  debitColumn: z.string(),
  creditColumn: z.string(),
});
export type ColumnMapping = z.infer<typeof columnMappingSchema>;

/**
 * Import from file
 */
export const importOpeningBalancesSchema = z.object({
  batchId: z.string().uuid(),
  fileContent: z.string(), // Base64 encoded
  fileName: z.string(),
  fileType: z.enum(['xlsx', 'csv']),
  columnMapping: columnMappingSchema,
  skipRows: z.number().int().nonnegative().default(1),
  createMissingAccounts: z.boolean().default(false),
});
export type ImportOpeningBalancesInput = z.infer<typeof importOpeningBalancesSchema>;

/**
 * Import preview result
 */
export const importPreviewSchema = z.object({
  totalRows: z.number(),
  matched: z.array(z.object({
    rowNumber: z.number(),
    accountId: z.string().uuid(),
    accountCode: z.string(),
    accountName: z.string(),
    debitAmount: z.number(),
    creditAmount: z.number(),
  })),
  unmatched: z.array(z.object({
    rowNumber: z.number(),
    accountCode: z.string(),
    debitAmount: z.number(),
    creditAmount: z.number(),
  })),
  errors: z.array(z.object({
    rowNumber: z.number(),
    message: z.string(),
  })),
});
export type ImportPreview = z.infer<typeof importPreviewSchema>;

/**
 * Import result
 */
export const importResultSchema = z.object({
  success: z.boolean(),
  totalRows: z.number(),
  importedCount: z.number(),
  skippedCount: z.number(),
  errorCount: z.number(),
  errors: z.array(z.string()),
});
export type ImportResult = z.infer<typeof importResultSchema>;

// ===========================================================================
// SUMMARY & REPORTS
// ===========================================================================

/**
 * Get batch summary
 */
export const getOpeningBalanceSummarySchema = z.object({
  batchId: z.string().uuid(),
});
export type GetOpeningBalanceSummaryInput = z.infer<typeof getOpeningBalanceSummarySchema>;

/**
 * Batch summary
 */
export const openingBalanceSummarySchema = z.object({
  batch: openingBalanceBatchSchema,
  fiscalYear: z.object({
    id: z.string().uuid(),
    yearCode: z.string(),
    name: z.string(),
    startDate: z.date(),
  }),
  totalDebit: z.number(),
  totalCredit: z.number(),
  difference: z.number(),
  isBalanced: z.boolean(),
  itemCount: z.number(),
  warningCount: z.number(),
  byAccountType: z.array(z.object({
    accountType: z.string(),
    debitTotal: z.number(),
    creditTotal: z.number(),
    accountCount: z.number(),
  })),
});
export type OpeningBalanceSummary = z.infer<typeof openingBalanceSummarySchema>;

// ===========================================================================
// RESULT TYPES
// ===========================================================================

export const createBatchResultSchema = openingBalanceBatchSchema;
export type CreateBatchResult = z.infer<typeof createBatchResultSchema>;

export const getBatchResultSchema = openingBalanceBatchSchema.extend({
  items: z.array(openingBalanceItemWithAccountSchema),
  fiscalYear: z.object({
    id: z.string().uuid(),
    yearCode: z.string(),
    name: z.string(),
  }),
  itemCount: z.number(),
  warningCount: z.number(),
});
export type GetBatchResult = z.infer<typeof getBatchResultSchema>;

export const listBatchesResultSchema = z.object({
  batches: z.array(openingBalanceBatchSchema.extend({
    fiscalYear: z.object({
      yearCode: z.string(),
      name: z.string(),
    }),
    itemCount: z.number(),
  })),
  total: z.number(),
});
export type ListBatchesResult = z.infer<typeof listBatchesResultSchema>;

export const addItemsResultSchema = z.object({
  added: z.number(),
  updated: z.number(),
  items: z.array(openingBalanceItemSchema),
});
export type AddItemsResult = z.infer<typeof addItemsResultSchema>;

export const removeItemsResultSchema = z.object({
  removed: z.number(),
});
export type RemoveItemsResult = z.infer<typeof removeItemsResultSchema>;

export const deleteBatchResultSchema = z.object({
  success: z.boolean(),
  deletedId: z.string().uuid(),
});
export type DeleteBatchResult = z.infer<typeof deleteBatchResultSchema>;
