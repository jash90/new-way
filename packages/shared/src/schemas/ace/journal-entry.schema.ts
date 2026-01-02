/**
 * ACC-006: Journal Entry Creation
 * Zod schemas for journal entry operations
 */

import { z } from 'zod';

// ===========================================================================
// ENUMS
// ===========================================================================

export const journalEntryTypeSchema = z.enum([
  'STANDARD',
  'ADJUSTMENT',
  'CLOSING',
  'OPENING',
  'REVERSAL',
  'RECURRING',
]);
export type JournalEntryType = z.infer<typeof journalEntryTypeSchema>;

export const journalEntryStatusSchema = z.enum([
  'DRAFT',
  'PENDING',
  'POSTED',
  'REVERSED',
]);
export type JournalEntryStatus = z.infer<typeof journalEntryStatusSchema>;

// Entry type prefixes for numbering
export const ENTRY_TYPE_PREFIXES: Record<JournalEntryType, string> = {
  STANDARD: 'JE',
  ADJUSTMENT: 'AJ',
  CLOSING: 'CL',
  OPENING: 'OB',
  REVERSAL: 'RV',
  RECURRING: 'RC',
};

// ===========================================================================
// JOURNAL LINE SCHEMAS
// ===========================================================================

/**
 * Journal line input for creating/updating entries
 */
export const journalLineInputSchema = z
  .object({
    accountId: z.string().uuid(),
    debitAmount: z.number().nonnegative().default(0),
    creditAmount: z.number().nonnegative().default(0),
    description: z.string().max(500).optional(),
    currency: z.string().length(3).default('PLN'),
    exchangeRate: z.number().positive().default(1),
    costCenterId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    taxCode: z.string().max(20).optional(),
    taxAmount: z.number().optional(),
  })
  .refine((data) => !(data.debitAmount > 0 && data.creditAmount > 0), {
    message: 'Line cannot have both debit and credit amounts',
  })
  .refine((data) => data.debitAmount > 0 || data.creditAmount > 0, {
    message: 'Line must have either debit or credit amount',
  });
export type JournalLineInput = z.infer<typeof journalLineInputSchema>;

/**
 * Journal line entity (response)
 */
export const journalLineSchema = z.object({
  id: z.string().uuid(),
  entryId: z.string().uuid(),
  lineNumber: z.number().int().positive(),
  accountId: z.string().uuid(),
  accountCode: z.string(),
  accountName: z.string(),
  debitAmount: z.number(),
  creditAmount: z.number(),
  baseDebitAmount: z.number().nullable(),
  baseCreditAmount: z.number().nullable(),
  currency: z.string(),
  exchangeRate: z.number(),
  description: z.string().nullable(),
  costCenterId: z.string().uuid().nullable(),
  costCenterName: z.string().nullable(),
  projectId: z.string().uuid().nullable(),
  projectName: z.string().nullable(),
  taxCode: z.string().nullable(),
  taxAmount: z.number().nullable(),
  isReconciled: z.boolean(),
  reconciledAt: z.date().nullable(),
  createdAt: z.date(),
});
export type JournalLine = z.infer<typeof journalLineSchema>;

// ===========================================================================
// JOURNAL ENTRY ENTITY SCHEMAS
// ===========================================================================

/**
 * Journal entry entity (response)
 */
export const journalEntrySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  periodId: z.string().uuid(),
  fiscalYearId: z.string().uuid(),
  entryNumber: z.string(),
  entryDate: z.date(),
  entryType: journalEntryTypeSchema,
  status: journalEntryStatusSchema,
  description: z.string(),
  reference: z.string().nullable(),
  sourceDocumentId: z.string().uuid().nullable(),
  reversedEntryId: z.string().uuid().nullable(),
  templateId: z.string().uuid().nullable(),
  recurringEntryId: z.string().uuid().nullable(),
  totalDebit: z.number(),
  totalCredit: z.number(),
  isBalanced: z.boolean(),
  lineCount: z.number().int(),
  baseCurrency: z.string(),
  requiresApproval: z.boolean(),
  approvedAt: z.date().nullable(),
  approvedBy: z.string().uuid().nullable(),
  postedAt: z.date().nullable(),
  postedBy: z.string().uuid().nullable(),
  reversedAt: z.date().nullable(),
  reversedBy: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
  createdAt: z.date(),
  createdBy: z.string().uuid(),
  updatedAt: z.date(),
});
export type JournalEntry = z.infer<typeof journalEntrySchema>;

/**
 * Journal entry with lines (detailed response)
 */
export const journalEntryWithLinesSchema = journalEntrySchema.extend({
  lines: z.array(journalLineSchema),
  period: z
    .object({
      id: z.string().uuid(),
      periodNumber: z.number(),
      name: z.string(),
      startDate: z.date(),
      endDate: z.date(),
      status: z.string(),
    })
    .optional(),
  fiscalYear: z
    .object({
      id: z.string().uuid(),
      yearCode: z.string(),
      name: z.string(),
    })
    .optional(),
  reversedEntry: z
    .object({
      id: z.string().uuid(),
      entryNumber: z.string(),
    })
    .nullable()
    .optional(),
  createdByUser: z
    .object({
      name: z.string(),
      email: z.string(),
    })
    .optional(),
  postedByUser: z
    .object({
      name: z.string(),
      email: z.string(),
    })
    .nullable()
    .optional(),
});
export type JournalEntryWithLines = z.infer<typeof journalEntryWithLinesSchema>;

// ===========================================================================
// CREATE ENTRY
// ===========================================================================

/**
 * Create journal entry input
 */
export const createJournalEntrySchema = z
  .object({
    entryDate: z.coerce.date(),
    description: z.string().min(1).max(1000),
    entryType: journalEntryTypeSchema.default('STANDARD'),
    reference: z.string().max(100).optional(),
    sourceDocumentId: z.string().uuid().optional(),
    reversedEntryId: z.string().uuid().optional(),
    templateId: z.string().uuid().optional(),
    requiresApproval: z.boolean().default(false),
    notes: z.string().max(2000).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
    lines: z.array(journalLineInputSchema).min(2), // Minimum 2 lines for double-entry
  })
  .refine(
    (data) => {
      const totalDebits = data.lines.reduce((sum, l) => sum + l.debitAmount, 0);
      const totalCredits = data.lines.reduce(
        (sum, l) => sum + l.creditAmount,
        0
      );
      return Math.abs(totalDebits - totalCredits) < 0.01; // Allow small rounding
    },
    { message: 'Entry must be balanced (total debits = total credits)' }
  );
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;

/**
 * Create entry result
 */
export const createJournalEntryResultSchema = journalEntryWithLinesSchema;
export type CreateJournalEntryResult = z.infer<
  typeof createJournalEntryResultSchema
>;

// ===========================================================================
// GET ENTRY
// ===========================================================================

/**
 * Get journal entry by ID
 */
export const getJournalEntrySchema = z.object({
  entryId: z.string().uuid(),
  includeLines: z.boolean().default(true),
});
export type GetJournalEntryInput = z.infer<typeof getJournalEntrySchema>;

// ===========================================================================
// UPDATE ENTRY
// ===========================================================================

/**
 * Update draft journal entry
 */
export const updateJournalEntrySchema = z
  .object({
    entryId: z.string().uuid(),
    entryDate: z.coerce.date().optional(),
    description: z.string().min(1).max(1000).optional(),
    reference: z.string().max(100).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
    lines: z.array(journalLineInputSchema).min(2).optional(),
  })
  .refine(
    (data) => {
      if (!data.lines) return true;
      const totalDebits = data.lines.reduce((sum, l) => sum + l.debitAmount, 0);
      const totalCredits = data.lines.reduce(
        (sum, l) => sum + l.creditAmount,
        0
      );
      return Math.abs(totalDebits - totalCredits) < 0.01;
    },
    { message: 'Entry must be balanced (total debits = total credits)' }
  );
export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>;

/**
 * Update entry result
 */
export const updateJournalEntryResultSchema = journalEntryWithLinesSchema;
export type UpdateJournalEntryResult = z.infer<
  typeof updateJournalEntryResultSchema
>;

// ===========================================================================
// DELETE ENTRY
// ===========================================================================

/**
 * Delete draft journal entry
 */
export const deleteJournalEntrySchema = z.object({
  entryId: z.string().uuid(),
});
export type DeleteJournalEntryInput = z.infer<typeof deleteJournalEntrySchema>;

/**
 * Delete entry result
 */
export const deleteJournalEntryResultSchema = z.object({
  success: z.boolean(),
  deletedId: z.string().uuid(),
  entryNumber: z.string(),
});
export type DeleteJournalEntryResult = z.infer<
  typeof deleteJournalEntryResultSchema
>;

// ===========================================================================
// POST ENTRY
// ===========================================================================

/**
 * Post journal entry to general ledger
 */
export const postJournalEntrySchema = z.object({
  entryId: z.string().uuid(),
  postDate: z.coerce.date().optional(), // Override entry date for posting
  bypassApproval: z.boolean().default(false),
});
export type PostJournalEntryInput = z.infer<typeof postJournalEntrySchema>;

/**
 * Post entry result
 */
export const postJournalEntryResultSchema = z.object({
  success: z.boolean(),
  entryId: z.string().uuid(),
  entryNumber: z.string(),
  status: journalEntryStatusSchema,
  postedAt: z.date(),
  postedBy: z.string().uuid(),
  totalDebit: z.number(),
  totalCredit: z.number(),
  lineCount: z.number().int(),
  glEntriesCreated: z.number().int(),
});
export type PostJournalEntryResult = z.infer<
  typeof postJournalEntryResultSchema
>;

// ===========================================================================
// QUERY ENTRIES
// ===========================================================================

/**
 * Query journal entries with filters
 */
export const queryJournalEntriesSchema = z.object({
  periodId: z.string().uuid().optional(),
  fiscalYearId: z.string().uuid().optional(),
  dateRange: z
    .object({
      from: z.coerce.date(),
      to: z.coerce.date(),
    })
    .optional(),
  status: z.array(journalEntryStatusSchema).optional(),
  entryType: z.array(journalEntryTypeSchema).optional(),
  accountId: z.string().uuid().optional(), // Filter by account in lines
  search: z.string().max(100).optional(), // Full-text search
  minAmount: z.number().nonnegative().optional(),
  maxAmount: z.number().nonnegative().optional(),
  tags: z.array(z.string()).optional(),
  createdBy: z.string().uuid().optional(),
  includeLines: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  orderBy: z
    .enum(['date_asc', 'date_desc', 'number_asc', 'number_desc', 'created_desc'])
    .default('date_desc'),
});
export type QueryJournalEntriesInput = z.infer<
  typeof queryJournalEntriesSchema
>;

/**
 * Query entries result
 */
export const queryJournalEntriesResultSchema = z.object({
  entries: z.array(journalEntryWithLinesSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  hasMore: z.boolean(),
});
export type QueryJournalEntriesResult = z.infer<
  typeof queryJournalEntriesResultSchema
>;

// ===========================================================================
// STATISTICS
// ===========================================================================

/**
 * Get entry statistics input
 */
export const getJournalEntryStatsSchema = z.object({
  periodId: z.string().uuid().optional(),
  fiscalYearId: z.string().uuid().optional(),
});
export type GetJournalEntryStatsInput = z.infer<
  typeof getJournalEntryStatsSchema
>;

/**
 * Entry statistics result
 */
export const journalEntryStatsSchema = z.object({
  totalEntries: z.number().int(),
  draftEntries: z.number().int(),
  pendingEntries: z.number().int(),
  postedEntries: z.number().int(),
  reversedEntries: z.number().int(),
  byType: z.record(journalEntryTypeSchema, z.number().int()),
  totalDebit: z.number(),
  totalCredit: z.number(),
  lastEntryDate: z.date().nullable(),
  lastPostedDate: z.date().nullable(),
});
export type JournalEntryStats = z.infer<typeof journalEntryStatsSchema>;

// ===========================================================================
// VALIDATION
// ===========================================================================

/**
 * Validate entry before posting
 */
export const validateJournalEntrySchema = z.object({
  entryId: z.string().uuid(),
});
export type ValidateJournalEntryInput = z.infer<
  typeof validateJournalEntrySchema
>;

/**
 * Validation result
 */
export const journalEntryValidationResultSchema = z.object({
  isValid: z.boolean(),
  isBalanced: z.boolean(),
  totalDebit: z.number(),
  totalCredit: z.number(),
  difference: z.number(),
  lineCount: z.number().int(),
  canPost: z.boolean(),
  errors: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      field: z.string().optional(),
      lineNumber: z.number().int().optional(),
    })
  ),
  warnings: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      lineNumber: z.number().int().optional(),
      accountCode: z.string().optional(),
    })
  ),
});
export type JournalEntryValidationResult = z.infer<
  typeof journalEntryValidationResultSchema
>;

// ===========================================================================
// COPY ENTRY
// ===========================================================================

/**
 * Copy/duplicate journal entry
 */
export const copyJournalEntrySchema = z.object({
  sourceEntryId: z.string().uuid(),
  entryDate: z.coerce.date().optional(), // New entry date (defaults to today)
  description: z.string().max(1000).optional(), // Override description
  adjustAmounts: z.boolean().default(false), // Allow amount adjustments
});
export type CopyJournalEntryInput = z.infer<typeof copyJournalEntrySchema>;

// ===========================================================================
// ENTRY NUMBER GENERATION
// ===========================================================================

/**
 * Get next entry number (preview)
 */
export const getNextEntryNumberSchema = z.object({
  entryType: journalEntryTypeSchema.default('STANDARD'),
  entryDate: z.coerce.date(),
});
export type GetNextEntryNumberInput = z.infer<typeof getNextEntryNumberSchema>;

/**
 * Next entry number result
 */
export const nextEntryNumberResultSchema = z.object({
  entryNumber: z.string(),
  prefix: z.string(),
  year: z.number().int(),
  month: z.number().int(),
  sequence: z.number().int(),
});
export type NextEntryNumberResult = z.infer<typeof nextEntryNumberResultSchema>;

// ===========================================================================
// ATTACHMENT OPERATIONS
// ===========================================================================

/**
 * Attach document to entry
 */
export const attachDocumentSchema = z.object({
  entryId: z.string().uuid(),
  documentId: z.string().uuid(),
});
export type AttachDocumentInput = z.infer<typeof attachDocumentSchema>;

/**
 * Detach document from entry
 */
export const detachDocumentSchema = z.object({
  entryId: z.string().uuid(),
});
export type DetachDocumentInput = z.infer<typeof detachDocumentSchema>;

// ===========================================================================
// BULK OPERATIONS
// ===========================================================================

/**
 * Bulk post entries
 */
export const bulkPostEntriesSchema = z.object({
  entryIds: z.array(z.string().uuid()).min(1).max(100),
  bypassApproval: z.boolean().default(false),
});
export type BulkPostEntriesInput = z.infer<typeof bulkPostEntriesSchema>;

/**
 * Bulk post result
 */
export const bulkPostEntriesResultSchema = z.object({
  totalRequested: z.number().int(),
  successCount: z.number().int(),
  failureCount: z.number().int(),
  results: z.array(
    z.object({
      entryId: z.string().uuid(),
      entryNumber: z.string(),
      success: z.boolean(),
      error: z.string().optional(),
    })
  ),
});
export type BulkPostEntriesResult = z.infer<typeof bulkPostEntriesResultSchema>;

/**
 * Bulk delete draft entries
 */
export const bulkDeleteEntriesSchema = z.object({
  entryIds: z.array(z.string().uuid()).min(1).max(100),
});
export type BulkDeleteEntriesInput = z.infer<typeof bulkDeleteEntriesSchema>;

/**
 * Bulk delete result
 */
export const bulkDeleteEntriesResultSchema = z.object({
  totalRequested: z.number().int(),
  deletedCount: z.number().int(),
  skippedCount: z.number().int(),
  results: z.array(
    z.object({
      entryId: z.string().uuid(),
      entryNumber: z.string(),
      deleted: z.boolean(),
      reason: z.string().optional(),
    })
  ),
});
export type BulkDeleteEntriesResult = z.infer<
  typeof bulkDeleteEntriesResultSchema
>;

// ===========================================================================
// HELPER FUNCTIONS
// ===========================================================================

/**
 * Get entry prefix for entry type
 */
export function getEntryPrefix(entryType: JournalEntryType): string {
  return ENTRY_TYPE_PREFIXES[entryType] || 'JE';
}

/**
 * Format entry number
 */
export function formatEntryNumber(
  prefix: string,
  year: number,
  month: number,
  sequence: number
): string {
  const monthStr = String(month).padStart(2, '0');
  const seqStr = String(sequence).padStart(4, '0');
  return `${prefix}/${year}/${monthStr}/${seqStr}`;
}

/**
 * Parse entry number
 */
export function parseEntryNumber(entryNumber: string): {
  prefix: string;
  year: number;
  month: number;
  sequence: number;
} | null {
  const match = entryNumber.match(/^([A-Z]+)\/(\d{4})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  return {
    prefix: match[1]!,
    year: parseInt(match[2]!, 10),
    month: parseInt(match[3]!, 10),
    sequence: parseInt(match[4]!, 10),
  };
}

/**
 * Calculate entry totals
 */
export function calculateEntryTotals(lines: JournalLineInput[]): {
  totalDebit: number;
  totalCredit: number;
  difference: number;
  isBalanced: boolean;
} {
  const totalDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference < 0.01;

  return { totalDebit, totalCredit, difference, isBalanced };
}
