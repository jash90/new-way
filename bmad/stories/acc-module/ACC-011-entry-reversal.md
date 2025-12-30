# ACC-011: Entry Reversal

## Story Information
| Field | Value |
|-------|-------|
| **Story ID** | ACC-011 |
| **Epic** | ACC - Accounting Engine |
| **Title** | Entry Reversal |
| **Priority** | P1 |
| **Points** | 5 |
| **Status** | Draft |
| **Sprint** | Week 10 |
| **Dependencies** | ACC-006 (Journal Entries), ACC-008 (General Ledger) |

---

## User Story

**As a** księgowy (accountant),
**I want to** reverse posted journal entries when corrections are needed,
**So that** I can correct errors while maintaining a complete audit trail and following proper accounting practices.

---

## Acceptance Criteria

### AC1: Standard Entry Reversal
```gherkin
Feature: Standard Entry Reversal

Scenario: Reverse a posted entry
  Given I am an authenticated accountant
  And I have a posted journal entry "JE-2024-00100" with:
    | Account     | Debit  | Credit |
    | 400-001     | 5000   | 0      |
    | 202-001     | 0      | 5000   |
  When I select "Reverse Entry"
  And I provide reversal date "2024-03-15"
  And I provide reason "Duplicate entry correction"
  And I confirm the reversal
  Then a new reversing entry "JE-2024-00150" is created with:
    | Account     | Debit  | Credit |
    | 400-001     | 0      | 5000   |
    | 202-001     | 5000   | 0      |
  And the original entry status changes to "REVERSED"
  And both entries are linked for audit trail
  And the general ledger reflects zero net effect

Scenario: Reverse entry in different period
  Given I have a posted entry dated "2024-02-28"
  And the February period is soft-closed
  When I reverse the entry with date "2024-03-05"
  Then the reversing entry is posted to March period
  And both entries are properly dated

Scenario: Attempt to reverse an already reversed entry
  Given I have an entry with status "REVERSED"
  When I try to reverse it again
  Then I see an error "Entry has already been reversed"
  And no new entry is created

Scenario: Reverse entry in closed period
  Given I have a posted entry dated "2024-01-15"
  And the January period is closed
  When I try to reverse the entry
  Then I see a warning "Original entry is in a closed period"
  And I am prompted to provide a reversal date in an open period
```

### AC2: Automatic Reversal Options
```gherkin
Feature: Automatic Reversal Options

Scenario: Create auto-reversing entry
  Given I am creating an accrual entry for month-end
  When I mark the entry as "Auto-reverse on"
  And I set auto-reverse date to "2024-04-01" (first day of next month)
  And I post the entry
  Then the entry is saved with auto-reverse flag
  And on April 1st, the system automatically creates a reversing entry

Scenario: View pending auto-reversals
  Given I have 5 entries scheduled for auto-reversal
  When I navigate to "Pending Reversals" view
  Then I see all entries with their scheduled reversal dates
  And I can cancel auto-reversal for any entry

Scenario: Process auto-reversals
  Given the date is "2024-04-01"
  And there are 3 entries scheduled for auto-reversal today
  When the auto-reversal job runs
  Then 3 reversing entries are created
  And the original entries are marked as "REVERSED"
  And notifications are sent to entry creators
```

### AC3: Reversal Validation
```gherkin
Feature: Reversal Validation

Scenario: Validate reversal date is after original date
  Given I have a posted entry dated "2024-03-15"
  When I try to reverse with date "2024-03-10"
  Then I see an error "Reversal date must be on or after original entry date"

Scenario: Validate reversal period is open
  Given I have a posted entry
  And I select reversal date "2024-01-31"
  And the January period is closed
  Then I see an error "Selected period is closed"
  And I cannot proceed with the reversal

Scenario: Validate user has reversal permission
  Given I am a junior accountant without reversal permissions
  When I try to reverse an entry
  Then I see an error "You do not have permission to reverse entries"
  And I can request approval from a senior accountant
```

### AC4: Partial Reversal (Correction Entry)
```gherkin
Feature: Correction Entry

Scenario: Create correction entry for partial reversal
  Given I have a posted entry with amount 10,000
  And the correct amount should have been 8,000
  When I select "Create Correction Entry"
  And I enter the corrected amounts
  Then a correction entry is created for the difference (2,000)
  And both entries are linked
  And the net effect reflects the correct amount (8,000)

Scenario: Correct entry with different accounts
  Given I have a posted entry that used wrong accounts
  When I create a correction entry
  And I specify the correct accounts
  Then the correction entry reverses the wrong accounts
  And posts to the correct accounts
  And maintains audit trail
```

### AC5: Reversal Reports and Audit
```gherkin
Feature: Reversal Reports

Scenario: View reversal history
  Given I have multiple reversed entries
  When I navigate to "Reversal History" report
  Then I see a list of all reversals
  And I can filter by date range, user, or reason
  And I can see original and reversing entry pairs

Scenario: Audit trail for reversals
  Given I reverse an entry
  When I view the audit trail
  Then I see:
    | Action | User | Date | Details |
    | ENTRY_REVERSED | accountant@company.com | 2024-03-15 | Original: JE-2024-00100, Reversal: JE-2024-00150, Reason: Duplicate entry |
  And the trail is immutable
```

---

## Technical Specification

### Database Schema

```sql
-- Extend journal_entries table for reversal tracking
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS
  reversal_type VARCHAR(20), -- STANDARD, AUTO_SCHEDULED, CORRECTION
  reversed_entry_id UUID REFERENCES journal_entries(id),
  reversing_entry_id UUID REFERENCES journal_entries(id),
  auto_reverse_date DATE,
  reversal_reason TEXT,
  reversed_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES users(id);

-- Create index for reversal queries
CREATE INDEX idx_entries_reversed_entry ON journal_entries(reversed_entry_id) WHERE reversed_entry_id IS NOT NULL;
CREATE INDEX idx_entries_auto_reverse ON journal_entries(auto_reverse_date) WHERE auto_reverse_date IS NOT NULL AND status = 'POSTED';

-- Reversal history view
CREATE VIEW reversal_history AS
SELECT
  o.id AS original_entry_id,
  o.entry_number AS original_entry_number,
  o.entry_date AS original_date,
  o.description AS original_description,
  r.id AS reversing_entry_id,
  r.entry_number AS reversing_entry_number,
  r.entry_date AS reversal_date,
  o.reversal_reason,
  o.reversed_at,
  u.name AS reversed_by_name,
  o.organization_id
FROM journal_entries o
JOIN journal_entries r ON o.reversing_entry_id = r.id
LEFT JOIN users u ON o.reversed_by = u.id
WHERE o.status = 'REVERSED';
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Reversal type enum
export const ReversalTypeEnum = z.enum([
  'STANDARD',      // Manual reversal
  'AUTO_SCHEDULED', // Auto-reversal on date
  'CORRECTION'     // Partial correction
]);

// Reverse entry input
export const ReverseEntryInput = z.object({
  entryId: z.string().uuid(),
  reversalDate: z.coerce.date(),
  reason: z.string().min(1).max(1000),
  autoPost: z.boolean().default(true), // Auto-post the reversing entry
});

// Schedule auto-reversal
export const ScheduleAutoReversalInput = z.object({
  entryId: z.string().uuid(),
  autoReverseDate: z.coerce.date(),
});

// Cancel auto-reversal
export const CancelAutoReversalInput = z.object({
  entryId: z.string().uuid(),
});

// Create correction entry
export const CreateCorrectionInput = z.object({
  originalEntryId: z.string().uuid(),
  correctionDate: z.coerce.date(),
  reason: z.string().min(1).max(1000),
  correctedLines: z.array(z.object({
    originalLineId: z.string().uuid().optional(),
    accountId: z.string().uuid(),
    debitAmount: z.number().min(0),
    creditAmount: z.number().min(0),
    description: z.string().max(500).optional(),
  })).min(2),
}).refine(
  (data) => {
    const totalDebits = data.correctedLines.reduce((sum, l) => sum + l.debitAmount, 0);
    const totalCredits = data.correctedLines.reduce((sum, l) => sum + l.creditAmount, 0);
    return Math.abs(totalDebits - totalCredits) < 0.01;
  },
  { message: 'Correction entry must be balanced' }
);

// List reversals filter
export const ListReversalsInput = z.object({
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  reversedBy: z.string().uuid().optional(),
  type: ReversalTypeEnum.optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

// Pending auto-reversals filter
export const PendingAutoReversalsInput = z.object({
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});
```

### tRPC Router Implementation

```typescript
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import {
  ReverseEntryInput,
  ScheduleAutoReversalInput,
  CancelAutoReversalInput,
  CreateCorrectionInput,
  ListReversalsInput,
  PendingAutoReversalsInput,
} from './schemas';
import Decimal from 'decimal.js';

export const reversalRouter = createTRPCRouter({

  // Reverse an entry
  reverse: protectedProcedure
    .input(ReverseEntryInput)
    .mutation(async ({ ctx, input }) => {
      const { db, session, auditLog } = ctx;
      const organizationId = session.user.organizationId;

      // Fetch original entry with lines
      const originalEntry = await db.query.journalEntries.findFirst({
        where: eq(journalEntries.id, input.entryId),
        with: { lines: true },
      });

      if (!originalEntry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Entry not found',
        });
      }

      // Validate entry can be reversed
      if (originalEntry.status !== 'POSTED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot reverse entry with status ${originalEntry.status}`,
        });
      }

      if (originalEntry.status === 'REVERSED' || originalEntry.reversingEntryId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Entry has already been reversed',
        });
      }

      // Validate reversal date
      if (input.reversalDate < originalEntry.entryDate) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Reversal date must be on or after original entry date',
        });
      }

      // Validate reversal period is open
      const reversalPeriod = await findPeriodForDate(db, organizationId, input.reversalDate);
      if (!reversalPeriod) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No fiscal period found for reversal date',
        });
      }

      if (reversalPeriod.status === 'CLOSED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Selected period is closed',
        });
      }

      return await db.transaction(async (tx) => {
        // Create reversing entry with swapped debits/credits
        const reversedLines = originalEntry.lines.map((line, idx) => ({
          lineNumber: idx + 1,
          accountId: line.accountId,
          debitAmount: parseFloat(line.creditAmount), // Swap
          creditAmount: parseFloat(line.debitAmount), // Swap
          description: `Reversal: ${line.description || ''}`,
          currencyCode: line.currencyCode,
          exchangeRate: line.exchangeRate,
          baseCurrencyDebit: parseFloat(line.baseCurrencyCredit),
          baseCurrencyCredit: parseFloat(line.baseCurrencyDebit),
        }));

        // Generate new entry number
        const entryNumber = await generateEntryNumber(
          tx,
          organizationId,
          'REVERSING',
          input.reversalDate
        );

        // Create the reversing entry
        const [reversingEntry] = await tx.insert(journalEntries).values({
          organizationId,
          fiscalYearId: reversalPeriod.fiscalYearId,
          periodId: reversalPeriod.id,
          entryNumber,
          entryDate: input.reversalDate,
          description: `Reversal of ${originalEntry.entryNumber}: ${input.reason}`,
          entryType: 'REVERSING',
          status: 'DRAFT',
          reversedEntryId: originalEntry.id,
          reversalType: 'STANDARD',
          createdBy: session.user.id,
        }).returning();

        // Create reversing entry lines
        for (const line of reversedLines) {
          await tx.insert(journalEntryLines).values({
            entryId: reversingEntry.id,
            ...line,
          });
        }

        // Auto-post if requested
        if (input.autoPost) {
          await postEntry(tx, reversingEntry.id, session.user.id);
        }

        // Update original entry
        await tx.update(journalEntries)
          .set({
            status: 'REVERSED',
            reversingEntryId: reversingEntry.id,
            reversalReason: input.reason,
            reversedAt: new Date(),
            reversedBy: session.user.id,
            updatedAt: new Date(),
            updatedBy: session.user.id,
          })
          .where(eq(journalEntries.id, input.entryId));

        // Audit log
        await auditLog.record({
          action: 'ENTRY_REVERSED',
          entityType: 'journal_entry',
          entityId: input.entryId,
          details: {
            originalEntryNumber: originalEntry.entryNumber,
            reversingEntryNumber: entryNumber,
            reversalDate: input.reversalDate,
            reason: input.reason,
          },
        });

        return reversingEntry;
      });
    }),

  // Schedule auto-reversal
  scheduleAutoReversal: protectedProcedure
    .input(ScheduleAutoReversalInput)
    .mutation(async ({ ctx, input }) => {
      const { db, session, auditLog } = ctx;

      const entry = await db.query.journalEntries.findFirst({
        where: eq(journalEntries.id, input.entryId),
      });

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Entry not found',
        });
      }

      if (entry.status !== 'POSTED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only posted entries can be scheduled for auto-reversal',
        });
      }

      if (input.autoReverseDate <= entry.entryDate) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Auto-reverse date must be after entry date',
        });
      }

      const [updated] = await db.update(journalEntries)
        .set({
          autoReverseDate: input.autoReverseDate,
          reversalType: 'AUTO_SCHEDULED',
          updatedAt: new Date(),
          updatedBy: session.user.id,
        })
        .where(eq(journalEntries.id, input.entryId))
        .returning();

      await auditLog.record({
        action: 'AUTO_REVERSAL_SCHEDULED',
        entityType: 'journal_entry',
        entityId: input.entryId,
        details: {
          entryNumber: entry.entryNumber,
          autoReverseDate: input.autoReverseDate,
        },
      });

      return updated;
    }),

  // Cancel auto-reversal
  cancelAutoReversal: protectedProcedure
    .input(CancelAutoReversalInput)
    .mutation(async ({ ctx, input }) => {
      const { db, session, auditLog } = ctx;

      const [updated] = await db.update(journalEntries)
        .set({
          autoReverseDate: null,
          reversalType: null,
          updatedAt: new Date(),
          updatedBy: session.user.id,
        })
        .where(eq(journalEntries.id, input.entryId))
        .returning();

      await auditLog.record({
        action: 'AUTO_REVERSAL_CANCELLED',
        entityType: 'journal_entry',
        entityId: input.entryId,
      });

      return updated;
    }),

  // Create correction entry
  createCorrection: protectedProcedure
    .input(CreateCorrectionInput)
    .mutation(async ({ ctx, input }) => {
      const { db, session, auditLog } = ctx;
      const organizationId = session.user.organizationId;

      // Fetch original entry
      const originalEntry = await db.query.journalEntries.findFirst({
        where: eq(journalEntries.id, input.originalEntryId),
        with: { lines: true },
      });

      if (!originalEntry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Original entry not found',
        });
      }

      if (originalEntry.status !== 'POSTED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only create corrections for posted entries',
        });
      }

      // Validate correction period
      const period = await findPeriodForDate(db, organizationId, input.correctionDate);
      if (!period || period.status === 'CLOSED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Correction period is closed or not found',
        });
      }

      return await db.transaction(async (tx) => {
        // Generate entry number
        const entryNumber = await generateEntryNumber(
          tx,
          organizationId,
          'ADJUSTING',
          input.correctionDate
        );

        // Create correction entry
        const [correctionEntry] = await tx.insert(journalEntries).values({
          organizationId,
          fiscalYearId: period.fiscalYearId,
          periodId: period.id,
          entryNumber,
          entryDate: input.correctionDate,
          description: `Correction of ${originalEntry.entryNumber}: ${input.reason}`,
          entryType: 'ADJUSTING',
          status: 'DRAFT',
          reversedEntryId: originalEntry.id,
          reversalType: 'CORRECTION',
          reversalReason: input.reason,
          createdBy: session.user.id,
        }).returning();

        // Create correction lines
        for (const [idx, line] of input.correctedLines.entries()) {
          await tx.insert(journalEntryLines).values({
            entryId: correctionEntry.id,
            lineNumber: idx + 1,
            accountId: line.accountId,
            debitAmount: line.debitAmount.toString(),
            creditAmount: line.creditAmount.toString(),
            description: line.description || 'Correction',
          });
        }

        // Link original to correction
        await tx.update(journalEntries)
          .set({
            reversalType: 'CORRECTION',
            // Don't change status - original stays POSTED
            updatedAt: new Date(),
            updatedBy: session.user.id,
          })
          .where(eq(journalEntries.id, input.originalEntryId));

        await auditLog.record({
          action: 'CORRECTION_ENTRY_CREATED',
          entityType: 'journal_entry',
          entityId: correctionEntry.id,
          details: {
            originalEntryId: input.originalEntryId,
            originalEntryNumber: originalEntry.entryNumber,
            reason: input.reason,
          },
        });

        return correctionEntry;
      });
    }),

  // List reversals
  listReversals: protectedProcedure
    .input(ListReversalsInput)
    .query(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const organizationId = session.user.organizationId;

      const conditions = [
        eq(journalEntries.organizationId, organizationId),
        eq(journalEntries.status, 'REVERSED'),
      ];

      if (input.fromDate) {
        conditions.push(gte(journalEntries.reversedAt, input.fromDate));
      }

      if (input.toDate) {
        conditions.push(lte(journalEntries.reversedAt, input.toDate));
      }

      if (input.reversedBy) {
        conditions.push(eq(journalEntries.reversedBy, input.reversedBy));
      }

      if (input.type) {
        conditions.push(eq(journalEntries.reversalType, input.type));
      }

      const reversals = await db.query.journalEntries.findMany({
        where: and(...conditions),
        orderBy: (e, { desc }) => [desc(e.reversedAt)],
        limit: input.limit,
        offset: input.offset,
        with: {
          reversingEntry: {
            columns: {
              id: true,
              entryNumber: true,
              entryDate: true,
            },
          },
          reversedByUser: {
            columns: { id: true, name: true, email: true },
          },
        },
      });

      const total = await db.select({ count: count() })
        .from(journalEntries)
        .where(and(...conditions));

      return {
        reversals,
        total: total[0].count,
        hasMore: input.offset + reversals.length < total[0].count,
      };
    }),

  // List pending auto-reversals
  listPendingAutoReversals: protectedProcedure
    .input(PendingAutoReversalsInput)
    .query(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const organizationId = session.user.organizationId;

      const conditions = [
        eq(journalEntries.organizationId, organizationId),
        eq(journalEntries.status, 'POSTED'),
        isNotNull(journalEntries.autoReverseDate),
      ];

      if (input.fromDate) {
        conditions.push(gte(journalEntries.autoReverseDate, input.fromDate));
      }

      if (input.toDate) {
        conditions.push(lte(journalEntries.autoReverseDate, input.toDate));
      }

      const pending = await db.query.journalEntries.findMany({
        where: and(...conditions),
        orderBy: (e, { asc }) => [asc(e.autoReverseDate)],
        limit: input.limit,
        offset: input.offset,
      });

      return pending;
    }),

  // Get reversal details
  getReversalDetails: protectedProcedure
    .input(z.object({ entryId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const entry = await ctx.db.query.journalEntries.findFirst({
        where: eq(journalEntries.id, input.entryId),
        with: {
          lines: true,
          reversingEntry: {
            with: { lines: true },
          },
          reversedEntry: {
            with: { lines: true },
          },
          reversedByUser: true,
        },
      });

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Entry not found',
        });
      }

      return entry;
    }),
});

// Auto-reversal processor (runs via cron)
export async function processAutoReversals(db: any, auditLog: any, notificationService: any) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find all entries due for auto-reversal today
  const dueEntries = await db.query.journalEntries.findMany({
    where: and(
      eq(journalEntries.status, 'POSTED'),
      lte(journalEntries.autoReverseDate, today),
      isNotNull(journalEntries.autoReverseDate)
    ),
    with: { lines: true },
  });

  const results = [];

  for (const entry of dueEntries) {
    try {
      // Find open period for reversal date
      const period = await findPeriodForDate(db, entry.organizationId, entry.autoReverseDate);

      if (!period || period.status === 'CLOSED') {
        throw new Error(`Period for auto-reversal date ${entry.autoReverseDate} is not available`);
      }

      await db.transaction(async (tx) => {
        // Create reversing entry
        const entryNumber = await generateEntryNumber(
          tx,
          entry.organizationId,
          'REVERSING',
          entry.autoReverseDate
        );

        const reversedLines = entry.lines.map((line: any, idx: number) => ({
          lineNumber: idx + 1,
          accountId: line.accountId,
          debitAmount: parseFloat(line.creditAmount),
          creditAmount: parseFloat(line.debitAmount),
          description: `Auto-reversal: ${line.description || ''}`,
          currencyCode: line.currencyCode,
          exchangeRate: line.exchangeRate,
        }));

        const [reversingEntry] = await tx.insert(journalEntries).values({
          organizationId: entry.organizationId,
          fiscalYearId: period.fiscalYearId,
          periodId: period.id,
          entryNumber,
          entryDate: entry.autoReverseDate,
          description: `Auto-reversal of ${entry.entryNumber}`,
          entryType: 'REVERSING',
          status: 'DRAFT',
          reversedEntryId: entry.id,
          reversalType: 'AUTO_SCHEDULED',
          createdBy: entry.createdBy, // Same as original creator
        }).returning();

        for (const line of reversedLines) {
          await tx.insert(journalEntryLines).values({
            entryId: reversingEntry.id,
            ...line,
          });
        }

        // Post the reversing entry
        await postEntry(tx, reversingEntry.id, entry.createdBy);

        // Update original entry
        await tx.update(journalEntries)
          .set({
            status: 'REVERSED',
            reversingEntryId: reversingEntry.id,
            reversalReason: 'Auto-reversed as scheduled',
            reversedAt: new Date(),
            autoReverseDate: null,
            updatedAt: new Date(),
          })
          .where(eq(journalEntries.id, entry.id));

        // Audit log
        await auditLog.record({
          action: 'ENTRY_AUTO_REVERSED',
          entityType: 'journal_entry',
          entityId: entry.id,
          organizationId: entry.organizationId,
          details: {
            originalEntryNumber: entry.entryNumber,
            reversingEntryNumber: entryNumber,
          },
        });

        results.push({
          entryId: entry.id,
          status: 'success',
          reversingEntryId: reversingEntry.id,
        });
      });

      // Send notification
      await notificationService.send({
        type: 'ENTRY_AUTO_REVERSED',
        recipients: [entry.createdBy],
        data: {
          entryNumber: entry.entryNumber,
        },
      });

    } catch (error) {
      results.push({
        entryId: entry.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Send failure notification
      await notificationService.send({
        type: 'AUTO_REVERSAL_FAILED',
        recipients: [entry.createdBy],
        priority: 'high',
        data: {
          entryNumber: entry.entryNumber,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  return {
    processed: results.length,
    successful: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'failed').length,
    results,
  };
}

// Helper functions
async function postEntry(tx: any, entryId: string, userId: string): Promise<void> {
  // Get entry with lines
  const entry = await tx.query.journalEntries.findFirst({
    where: eq(journalEntries.id, entryId),
    with: { lines: true },
  });

  // Create GL entries
  for (const line of entry.lines) {
    await tx.insert(generalLedger).values({
      organizationId: entry.organizationId,
      accountId: line.accountId,
      fiscalYearId: entry.fiscalYearId,
      periodId: entry.periodId,
      entryId: entry.id,
      entryLineId: line.id,
      transactionDate: entry.entryDate,
      debitAmount: line.debitAmount,
      creditAmount: line.creditAmount,
      baseCurrencyDebit: line.baseCurrencyDebit || line.debitAmount,
      baseCurrencyCredit: line.baseCurrencyCredit || line.creditAmount,
      description: line.description,
      postedAt: new Date(),
      postedBy: userId,
    });
  }

  // Update entry status
  await tx.update(journalEntries)
    .set({
      status: 'POSTED',
      postedAt: new Date(),
      postedBy: userId,
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(eq(journalEntries.id, entryId));
}

async function findPeriodForDate(db: any, organizationId: string, date: Date): Promise<any> {
  return await db.query.accountingPeriods.findFirst({
    where: and(
      eq(accountingPeriods.organizationId, organizationId),
      lte(accountingPeriods.startDate, date),
      gte(accountingPeriods.endDate, date)
    ),
  });
}

async function generateEntryNumber(
  db: any,
  organizationId: string,
  entryType: string,
  entryDate: Date
): Promise<string> {
  const year = entryDate.getFullYear();
  const prefix = entryType === 'REVERSING' ? 'RV' : entryType === 'ADJUSTING' ? 'AJ' : 'JE';
  const fullPrefix = `${prefix}-${year}-`;

  const lastEntry = await db.query.journalEntries.findFirst({
    where: and(
      eq(journalEntries.organizationId, organizationId),
      like(journalEntries.entryNumber, `${fullPrefix}%`)
    ),
    orderBy: (e: any, { desc }: any) => [desc(e.entryNumber)],
  });

  let nextNumber = 1;
  if (lastEntry) {
    const lastNumber = parseInt(lastEntry.entryNumber.replace(fullPrefix, ''));
    nextNumber = lastNumber + 1;
  }

  return `${fullPrefix}${String(nextNumber).padStart(5, '0')}`;
}
```

---

## Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { reversalRouter, processAutoReversals } from './reversal.router';
import { createTestContext, createMockEntry } from '@/test/utils';

describe('Reversal Router', () => {
  let ctx: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    ctx = createTestContext();
  });

  describe('reverse', () => {
    it('should reverse a posted entry', async () => {
      const entry = await createMockEntry(ctx.db, {
        status: 'POSTED',
        lines: [
          { accountId: 'acc-1', debitAmount: '1000', creditAmount: '0' },
          { accountId: 'acc-2', debitAmount: '0', creditAmount: '1000' },
        ],
      });

      const result = await reversalRouter.reverse({
        ctx,
        input: {
          entryId: entry.id,
          reversalDate: new Date('2024-03-15'),
          reason: 'Error correction',
        },
      });

      expect(result.entryType).toBe('REVERSING');
      expect(result.reversedEntryId).toBe(entry.id);

      // Verify original updated
      const updated = await ctx.db.query.journalEntries.findFirst({
        where: eq(journalEntries.id, entry.id),
      });
      expect(updated.status).toBe('REVERSED');
    });

    it('should swap debits and credits', async () => {
      const entry = await createMockEntry(ctx.db, {
        status: 'POSTED',
        lines: [
          { accountId: 'acc-1', debitAmount: '5000', creditAmount: '0' },
          { accountId: 'acc-2', debitAmount: '0', creditAmount: '5000' },
        ],
      });

      const result = await reversalRouter.reverse({
        ctx,
        input: {
          entryId: entry.id,
          reversalDate: new Date(),
          reason: 'Test',
        },
      });

      const reversingEntry = await ctx.db.query.journalEntries.findFirst({
        where: eq(journalEntries.id, result.id),
        with: { lines: true },
      });

      // Original was debit 5000, credit 0 -> reversed should be debit 0, credit 5000
      expect(reversingEntry.lines[0].creditAmount).toBe('5000.00');
      expect(reversingEntry.lines[0].debitAmount).toBe('0.00');
    });

    it('should reject reversal of non-posted entry', async () => {
      const entry = await createMockEntry(ctx.db, { status: 'DRAFT' });

      await expect(reversalRouter.reverse({
        ctx,
        input: {
          entryId: entry.id,
          reversalDate: new Date(),
          reason: 'Test',
        },
      })).rejects.toThrow(/Cannot reverse entry with status DRAFT/);
    });

    it('should reject reversal of already reversed entry', async () => {
      const entry = await createMockEntry(ctx.db, {
        status: 'REVERSED',
        reversingEntryId: 'some-id',
      });

      await expect(reversalRouter.reverse({
        ctx,
        input: {
          entryId: entry.id,
          reversalDate: new Date(),
          reason: 'Test',
        },
      })).rejects.toThrow(/already been reversed/);
    });

    it('should reject reversal date before original', async () => {
      const entry = await createMockEntry(ctx.db, {
        status: 'POSTED',
        entryDate: new Date('2024-03-15'),
      });

      await expect(reversalRouter.reverse({
        ctx,
        input: {
          entryId: entry.id,
          reversalDate: new Date('2024-03-10'),
          reason: 'Test',
        },
      })).rejects.toThrow(/Reversal date must be on or after/);
    });
  });

  describe('scheduleAutoReversal', () => {
    it('should schedule auto-reversal', async () => {
      const entry = await createMockEntry(ctx.db, {
        status: 'POSTED',
        entryDate: new Date('2024-03-01'),
      });

      const result = await reversalRouter.scheduleAutoReversal({
        ctx,
        input: {
          entryId: entry.id,
          autoReverseDate: new Date('2024-04-01'),
        },
      });

      expect(result.autoReverseDate).toEqual(new Date('2024-04-01'));
      expect(result.reversalType).toBe('AUTO_SCHEDULED');
    });

    it('should reject auto-reverse date before entry date', async () => {
      const entry = await createMockEntry(ctx.db, {
        status: 'POSTED',
        entryDate: new Date('2024-03-15'),
      });

      await expect(reversalRouter.scheduleAutoReversal({
        ctx,
        input: {
          entryId: entry.id,
          autoReverseDate: new Date('2024-03-10'),
        },
      })).rejects.toThrow(/must be after entry date/);
    });
  });

  describe('createCorrection', () => {
    it('should create correction entry', async () => {
      const entry = await createMockEntry(ctx.db, {
        status: 'POSTED',
        lines: [
          { accountId: 'acc-1', debitAmount: '10000', creditAmount: '0' },
          { accountId: 'acc-2', debitAmount: '0', creditAmount: '10000' },
        ],
      });

      const result = await reversalRouter.createCorrection({
        ctx,
        input: {
          originalEntryId: entry.id,
          correctionDate: new Date(),
          reason: 'Amount was incorrect, should be 8000',
          correctedLines: [
            { accountId: 'acc-1', debitAmount: 0, creditAmount: 2000 },
            { accountId: 'acc-2', debitAmount: 2000, creditAmount: 0 },
          ],
        },
      });

      expect(result.entryType).toBe('ADJUSTING');
      expect(result.reversalType).toBe('CORRECTION');
    });
  });

  describe('processAutoReversals', () => {
    it('should process due auto-reversals', async () => {
      vi.setSystemTime(new Date('2024-04-01'));

      await createMockEntry(ctx.db, {
        status: 'POSTED',
        autoReverseDate: new Date('2024-04-01'),
      });

      const result = await processAutoReversals(ctx.db, ctx.auditLog, ctx.notificationService);

      expect(result.successful).toBe(1);
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDatabase, seedTestData, cleanupTestDatabase } from '@/test/db-utils';

describe('Entry Reversal Integration', () => {
  let db: TestDatabase;
  let testOrg: Organization;
  let testAccounts: Account[];

  beforeAll(async () => {
    db = await createTestDatabase();
    const seed = await seedTestData(db);
    testOrg = seed.organization;
    testAccounts = seed.accounts;
  });

  afterAll(async () => {
    await cleanupTestDatabase(db);
  });

  it('should complete full reversal lifecycle', async () => {
    // 1. Create and post entry
    const entry = await db.entries.create({
      organizationId: testOrg.id,
      entryDate: new Date('2024-03-01'),
      description: 'Original entry',
      lines: [
        { accountId: testAccounts[0].id, debitAmount: 5000, creditAmount: 0 },
        { accountId: testAccounts[1].id, debitAmount: 0, creditAmount: 5000 },
      ],
    });

    await db.entries.post(entry.id);

    // 2. Verify GL entries exist
    let glEntries = await db.generalLedger.findByEntry(entry.id);
    expect(glEntries).toHaveLength(2);

    // 3. Reverse the entry
    const reversingEntry = await db.reversals.reverse({
      entryId: entry.id,
      reversalDate: new Date('2024-03-15'),
      reason: 'Duplicate entry',
    });

    // 4. Verify reversing entry in GL
    const reversingGlEntries = await db.generalLedger.findByEntry(reversingEntry.id);
    expect(reversingGlEntries).toHaveLength(2);

    // 5. Verify net effect is zero
    const accountBalance = await db.generalLedger.getAccountBalance(testAccounts[0].id);
    expect(accountBalance).toBe(0); // 5000 - 5000 = 0

    // 6. Verify original entry status
    const updatedOriginal = await db.entries.findById(entry.id);
    expect(updatedOriginal.status).toBe('REVERSED');
    expect(updatedOriginal.reversingEntryId).toBe(reversingEntry.id);
  });

  it('should handle auto-reversal correctly', async () => {
    vi.setSystemTime(new Date('2024-03-01'));

    // Create entry with auto-reversal
    const entry = await db.entries.create({
      organizationId: testOrg.id,
      entryDate: new Date('2024-03-01'),
      lines: [
        { accountId: testAccounts[0].id, debitAmount: 1000, creditAmount: 0 },
        { accountId: testAccounts[1].id, debitAmount: 0, creditAmount: 1000 },
      ],
    });

    await db.entries.post(entry.id);

    // Schedule auto-reversal
    await db.reversals.scheduleAutoReversal({
      entryId: entry.id,
      autoReverseDate: new Date('2024-04-01'),
    });

    // Fast forward to April 1st
    vi.setSystemTime(new Date('2024-04-01'));

    // Process auto-reversals
    const result = await db.scheduler.processAutoReversals();

    expect(result.successful).toBe(1);

    // Verify entry was reversed
    const reversedEntry = await db.entries.findById(entry.id);
    expect(reversedEntry.status).toBe('REVERSED');
    expect(reversedEntry.autoReverseDate).toBeNull();
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Entry Reversal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/accounting/entries');
  });

  test('should reverse a posted entry', async ({ page }) => {
    // Click on a posted entry
    await page.click('[data-status="POSTED"]:first-child');

    await page.click('button:has-text("Reverse Entry")');

    await page.fill('input[name="reversalDate"]', '2024-03-15');
    await page.fill('textarea[name="reason"]', 'Duplicate entry correction');

    await page.click('button:has-text("Confirm Reversal")');

    await expect(page.locator('text=Entry reversed successfully')).toBeVisible();
    await expect(page.locator('[data-status="REVERSED"]')).toBeVisible();
  });

  test('should schedule auto-reversal', async ({ page }) => {
    await page.click('[data-status="POSTED"]:first-child');

    await page.click('button:has-text("Schedule Auto-Reversal")');

    await page.fill('input[name="autoReverseDate"]', '2024-04-01');
    await page.click('button:has-text("Schedule")');

    await expect(page.locator('text=Auto-reversal scheduled')).toBeVisible();
    await expect(page.locator('text=Auto-reverse: 2024-04-01')).toBeVisible();
  });

  test('should view reversal history', async ({ page }) => {
    await page.goto('/accounting/reversals');

    await expect(page.locator('[data-testid="reversal-row"]')).toHaveCount.greaterThan(0);

    // Click on a reversal
    await page.click('[data-testid="reversal-row"]:first-child');

    await expect(page.locator('text=Original Entry')).toBeVisible();
    await expect(page.locator('text=Reversing Entry')).toBeVisible();
  });

  test('should create correction entry', async ({ page }) => {
    await page.click('[data-status="POSTED"]:first-child');

    await page.click('button:has-text("Create Correction")');

    // Modify amounts
    await page.fill('[data-testid="line-1-credit"]', '2000');
    await page.fill('[data-testid="line-2-debit"]', '2000');
    await page.fill('textarea[name="reason"]', 'Amount correction');

    await page.click('button:has-text("Create Correction Entry")');

    await expect(page.locator('text=Correction entry created')).toBeVisible();
  });
});
```

---

## Security Checklist

- [x] **Authentication**: All endpoints require authenticated session
- [x] **Authorization**: Users need reversal permissions
- [x] **Audit Trail**: All reversals logged with reason
- [x] **Data Integrity**: Reversing entries maintain balance
- [x] **Period Validation**: Cannot reverse to closed periods
- [x] **Immutability**: Reversed entries cannot be modified
- [x] **Linkage**: Original and reversing entries are always linked

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `ENTRY_REVERSED` | Manual reversal | originalEntryId, reversingEntryId, reason, reversedBy |
| `AUTO_REVERSAL_SCHEDULED` | Schedule auto-reversal | entryId, autoReverseDate |
| `AUTO_REVERSAL_CANCELLED` | Cancel auto-reversal | entryId |
| `ENTRY_AUTO_REVERSED` | Auto-reversal processed | originalEntryId, reversingEntryId |
| `CORRECTION_ENTRY_CREATED` | Correction entry | originalEntryId, correctionEntryId, reason |

---

## Implementation Notes

### Reversal Types
- **STANDARD**: Manual full reversal
- **AUTO_SCHEDULED**: Scheduled for specific date
- **CORRECTION**: Partial correction/adjustment

### GL Impact
- Reversing entry creates opposite GL movements
- Net effect on accounts is zero after reversal
- Account balances updated in real-time

### Period Handling
- Original entry can be in closed period
- Reversing entry must be in open period
- System suggests first open period date

### Auto-Reversal Scheduler
- Runs daily (recommended: 00:00)
- Processes all due auto-reversals
- Sends notifications on success/failure
- Creates reversing entries as POSTED status
