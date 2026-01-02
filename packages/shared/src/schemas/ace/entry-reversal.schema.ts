/**
 * ACC-011: Entry Reversal Schemas
 * Provides schema definitions for entry reversal operations
 */

import { z } from 'zod';

// ===========================================================================
// ENUMS
// ===========================================================================

/**
 * Reversal type enumeration
 */
export const reversalTypeSchema = z.enum([
  'STANDARD', // Manual full reversal
  'AUTO_SCHEDULED', // Scheduled for automatic reversal
  'CORRECTION', // Partial correction/adjustment
]);

export type ReversalType = z.infer<typeof reversalTypeSchema>;

// ===========================================================================
// INPUT SCHEMAS
// ===========================================================================

/**
 * Reverse entry input schema
 */
export const reverseEntrySchema = z.object({
  entryId: z.string().uuid({ message: 'Entry ID must be a valid UUID' }),
  reversalDate: z.coerce.date({ required_error: 'Reversal date is required' }),
  reason: z
    .string()
    .min(1, 'Reason is required')
    .max(1000, 'Reason must be 1000 characters or less'),
  autoPost: z.boolean().default(true),
});

export type ReverseEntryInput = z.infer<typeof reverseEntrySchema>;

/**
 * Schedule auto-reversal input schema
 */
export const scheduleAutoReversalSchema = z.object({
  entryId: z.string().uuid({ message: 'Entry ID must be a valid UUID' }),
  autoReverseDate: z.coerce.date({ required_error: 'Auto-reverse date is required' }),
});

export type ScheduleAutoReversalInput = z.infer<typeof scheduleAutoReversalSchema>;

/**
 * Cancel auto-reversal input schema
 */
export const cancelAutoReversalSchema = z.object({
  entryId: z.string().uuid({ message: 'Entry ID must be a valid UUID' }),
});

export type CancelAutoReversalInput = z.infer<typeof cancelAutoReversalSchema>;

/**
 * Correction line schema
 */
export const correctionLineSchema = z.object({
  originalLineId: z.string().uuid().optional(),
  accountId: z.string().uuid({ message: 'Account ID must be a valid UUID' }),
  debitAmount: z.number().min(0, 'Debit amount must be non-negative'),
  creditAmount: z.number().min(0, 'Credit amount must be non-negative'),
  description: z.string().max(500).optional(),
});

export type CorrectionLine = z.infer<typeof correctionLineSchema>;

/**
 * Create correction entry input schema
 */
export const createCorrectionSchema = z
  .object({
    originalEntryId: z.string().uuid({ message: 'Original entry ID must be a valid UUID' }),
    correctionDate: z.coerce.date({ required_error: 'Correction date is required' }),
    reason: z
      .string()
      .min(1, 'Reason is required')
      .max(1000, 'Reason must be 1000 characters or less'),
    correctedLines: z.array(correctionLineSchema).min(2, 'At least two lines are required'),
    autoPost: z.boolean().default(false),
  })
  .refine(
    (data) => {
      const totalDebits = data.correctedLines.reduce((sum, l) => sum + l.debitAmount, 0);
      const totalCredits = data.correctedLines.reduce((sum, l) => sum + l.creditAmount, 0);
      return Math.abs(totalDebits - totalCredits) < 0.01;
    },
    { message: 'Correction entry must be balanced (total debits must equal total credits)' }
  );

export type CreateCorrectionInput = z.infer<typeof createCorrectionSchema>;

/**
 * List reversals input schema
 */
export const listReversalsSchema = z.object({
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  reversedBy: z.string().uuid().optional(),
  type: reversalTypeSchema.optional(),
  search: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type ListReversalsInput = z.infer<typeof listReversalsSchema>;

/**
 * Get reversal details input schema
 */
export const getReversalDetailsSchema = z.object({
  entryId: z.string().uuid({ message: 'Entry ID must be a valid UUID' }),
});

export type GetReversalDetailsInput = z.infer<typeof getReversalDetailsSchema>;

/**
 * List pending auto-reversals input schema
 */
export const listPendingAutoReversalsSchema = z.object({
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type ListPendingAutoReversalsInput = z.infer<typeof listPendingAutoReversalsSchema>;

/**
 * Process auto-reversals input schema
 */
export const processAutoReversalsSchema = z.object({
  forDate: z.coerce.date().optional(),
  dryRun: z.boolean().default(false),
});

export type ProcessAutoReversalsInput = z.infer<typeof processAutoReversalsSchema>;

// ===========================================================================
// ENTITY SCHEMAS
// ===========================================================================

/**
 * Reversal link schema - represents the link between original and reversing entries
 */
export const reversalLinkSchema = z.object({
  originalEntryId: z.string().uuid(),
  originalEntryNumber: z.string(),
  originalEntryDate: z.coerce.date(),
  originalDescription: z.string(),
  reversingEntryId: z.string().uuid(),
  reversingEntryNumber: z.string(),
  reversalDate: z.coerce.date(),
  reversalType: reversalTypeSchema,
  reversalReason: z.string().nullable(),
  reversedAt: z.coerce.date().nullable(),
  reversedBy: z
    .object({
      id: z.string().uuid(),
      name: z.string().nullable(),
      email: z.string(),
    })
    .nullable(),
});

export type ReversalLink = z.infer<typeof reversalLinkSchema>;

/**
 * Pending auto-reversal schema
 */
export const pendingAutoReversalSchema = z.object({
  id: z.string().uuid(),
  entryNumber: z.string(),
  entryDate: z.coerce.date(),
  description: z.string(),
  autoReverseDate: z.coerce.date(),
  createdBy: z
    .object({
      id: z.string().uuid(),
      name: z.string().nullable(),
      email: z.string(),
    })
    .nullable(),
  template: z
    .object({
      id: z.string().uuid(),
      templateName: z.string(),
    })
    .nullable(),
});

export type PendingAutoReversal = z.infer<typeof pendingAutoReversalSchema>;

// ===========================================================================
// RESULT SCHEMAS
// ===========================================================================

/**
 * Reverse entry result schema
 */
export const reverseEntryResultSchema = z.object({
  reversingEntry: z.object({
    id: z.string().uuid(),
    entryNumber: z.string(),
    entryDate: z.coerce.date(),
    description: z.string(),
    status: z.string(),
    entryType: z.string(),
  }),
  originalEntry: z.object({
    id: z.string().uuid(),
    entryNumber: z.string(),
    status: z.string(),
  }),
});

export type ReverseEntryResult = z.infer<typeof reverseEntryResultSchema>;

/**
 * Schedule auto-reversal result schema
 */
export const scheduleAutoReversalResultSchema = z.object({
  id: z.string().uuid(),
  entryNumber: z.string(),
  autoReverseDate: z.coerce.date(),
  reversalType: reversalTypeSchema,
});

export type ScheduleAutoReversalResult = z.infer<typeof scheduleAutoReversalResultSchema>;

/**
 * Cancel auto-reversal result schema
 */
export const cancelAutoReversalResultSchema = z.object({
  success: z.boolean(),
  entryId: z.string().uuid(),
  entryNumber: z.string(),
});

export type CancelAutoReversalResult = z.infer<typeof cancelAutoReversalResultSchema>;

/**
 * Create correction result schema
 */
export const createCorrectionResultSchema = z.object({
  correctionEntry: z.object({
    id: z.string().uuid(),
    entryNumber: z.string(),
    entryDate: z.coerce.date(),
    description: z.string(),
    status: z.string(),
    entryType: z.string(),
  }),
  originalEntry: z.object({
    id: z.string().uuid(),
    entryNumber: z.string(),
  }),
  netEffect: z.object({
    totalDebit: z.number(),
    totalCredit: z.number(),
  }),
});

export type CreateCorrectionResult = z.infer<typeof createCorrectionResultSchema>;

/**
 * List reversals result schema
 */
export const listReversalsResultSchema = z.object({
  reversals: z.array(reversalLinkSchema),
  total: z.number().int().min(0),
  hasMore: z.boolean(),
});

export type ListReversalsResult = z.infer<typeof listReversalsResultSchema>;

/**
 * List pending auto-reversals result schema
 */
export const listPendingAutoReversalsResultSchema = z.object({
  pending: z.array(pendingAutoReversalSchema),
  total: z.number().int().min(0),
  hasMore: z.boolean(),
});

export type ListPendingAutoReversalsResult = z.infer<typeof listPendingAutoReversalsResultSchema>;

/**
 * Auto-reversal process result schema
 */
export const autoReversalProcessResultSchema = z.object({
  date: z.coerce.date(),
  success: z.boolean(),
  entryId: z.string().uuid().optional(),
  reversingEntryId: z.string().uuid().optional(),
  error: z.string().optional(),
});

export type AutoReversalProcessResult = z.infer<typeof autoReversalProcessResultSchema>;

/**
 * Process auto-reversals result schema
 */
export const processAutoReversalsResultSchema = z.object({
  processed: z.number().int().min(0),
  successful: z.number().int().min(0),
  failed: z.number().int().min(0),
  results: z.array(autoReversalProcessResultSchema),
  dryRun: z.boolean(),
});

export type ProcessAutoReversalsResult = z.infer<typeof processAutoReversalsResultSchema>;

/**
 * Reversal details result schema - comprehensive view of a reversal
 */
export const reversalDetailsSchema = z.object({
  originalEntry: z.object({
    id: z.string().uuid(),
    entryNumber: z.string(),
    entryDate: z.coerce.date(),
    description: z.string(),
    status: z.string(),
    entryType: z.string(),
    lines: z.array(
      z.object({
        id: z.string().uuid(),
        lineNumber: z.number().int(),
        accountId: z.string().uuid(),
        accountCode: z.string().optional(),
        accountName: z.string().optional(),
        debitAmount: z.number(),
        creditAmount: z.number(),
        description: z.string().nullable(),
      })
    ),
    totalDebit: z.number(),
    totalCredit: z.number(),
  }),
  reversingEntry: z
    .object({
      id: z.string().uuid(),
      entryNumber: z.string(),
      entryDate: z.coerce.date(),
      description: z.string(),
      status: z.string(),
      entryType: z.string(),
      lines: z.array(
        z.object({
          id: z.string().uuid(),
          lineNumber: z.number().int(),
          accountId: z.string().uuid(),
          accountCode: z.string().optional(),
          accountName: z.string().optional(),
          debitAmount: z.number(),
          creditAmount: z.number(),
          description: z.string().nullable(),
        })
      ),
      totalDebit: z.number(),
      totalCredit: z.number(),
    })
    .nullable(),
  reversalInfo: z.object({
    reversalType: reversalTypeSchema.nullable(),
    reversalReason: z.string().nullable(),
    reversedAt: z.coerce.date().nullable(),
    reversedBy: z
      .object({
        id: z.string().uuid(),
        name: z.string().nullable(),
        email: z.string(),
      })
      .nullable(),
    autoReverseDate: z.coerce.date().nullable(),
  }),
  netEffect: z.object({
    totalDebit: z.number(),
    totalCredit: z.number(),
    isBalanced: z.boolean(),
  }),
});

export type ReversalDetails = z.infer<typeof reversalDetailsSchema>;
