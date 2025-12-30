# ACC-006: Journal Entry Creation

> **Story ID**: ACC-006
> **Title**: Journal Entry Creation
> **Epic**: Accounting Engine (ACC)
> **Priority**: P0
> **Points**: 13
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant recording transactions,
**I want to** create journal entries with multiple debit and credit lines,
**So that** I can properly record financial transactions in the accounting system.

---

## Acceptance Criteria

### AC1: Create Basic Journal Entry
```gherkin
Feature: Journal Entry Creation

Scenario: Create simple two-line entry
  Given I am on the journal entry form
  When I create an entry with:
    | Account     | Debit  | Credit |
    | 100 - Kasa  | 1000   |        |
    | 200 - Bank  |        | 1000   |
  And I set date to "2024-01-15"
  And I provide description "Cash withdrawal"
  Then the entry should be created with status "DRAFT"
  And entry number should be auto-generated

Scenario: Create multi-line entry
  Given I am creating an entry for office supplies purchase
  When I create an entry with:
    | Account              | Debit  | Credit |
    | 401 - Office Supplies| 500    |        |
    | 222 - VAT Naliczony  | 115    |        |
    | 200 - Bank           |        | 615    |
  Then total debits should equal total credits
  And entry should be saved successfully
```

### AC2: Entry Numbering
```gherkin
Feature: Entry Numbering

Scenario: Auto-generate entry number
  Given current period has 50 entries
  When I create a new entry
  Then entry number should be "JE/2024/01/051"
  And number should follow organization's format

Scenario: Support custom numbering prefixes
  Given organization has custom prefix "PK"
  When I create a polecenie księgowania
  Then entry number should be "PK/2024/01/001"
```

### AC3: Entry Types
```gherkin
Feature: Entry Types

Scenario: Record different entry types
  Given the following entry types exist:
    | Type      | Code | Description                |
    | Standard  | JE   | Regular journal entry      |
    | Adjustment| AJ   | Adjusting entry            |
    | Closing   | CL   | Closing entry              |
    | Opening   | OB   | Opening balance            |
    | Reversal  | RV   | Reversal entry             |
  When I create an entry of type "Adjustment"
  Then the entry should be tagged as adjusting
  And numbering should use "AJ" prefix
```

### AC4: Draft and Post Workflow
```gherkin
Feature: Entry Workflow

Scenario: Save as draft
  Given I am creating a complex entry
  When I save without posting
  Then entry status should be "DRAFT"
  And I should be able to edit all fields

Scenario: Post entry
  Given I have a draft entry that passes validation
  When I click "Post"
  Then entry status should change to "POSTED"
  And general ledger should be updated
  And account balances should reflect the entry
  And entry should become read-only

Scenario: Prevent editing posted entry
  Given entry "JE/2024/01/001" is posted
  When I try to modify the amount
  Then I should see error "Cannot modify posted entry"
  And entry should remain unchanged
```

### AC5: Attachments and References
```gherkin
Feature: Entry Documentation

Scenario: Attach source document
  Given I am creating entry for invoice payment
  When I attach document "FV/2024/001.pdf"
  Then the document should be linked to entry
  And I should be able to view document from entry

Scenario: Reference related entries
  Given I am creating a reversal entry
  When I reference original entry "JE/2024/01/001"
  Then the reference should be stored
  And both entries should show the relationship
```

---

## Technical Specification

### Database Schema

```sql
-- Journal entry headers
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  period_id UUID NOT NULL REFERENCES accounting_periods(id),

  -- Entry identification
  entry_number VARCHAR(50) NOT NULL,
  entry_date DATE NOT NULL,

  -- Entry type and status
  entry_type VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
  -- STANDARD, ADJUSTMENT, CLOSING, OPENING, REVERSAL, RECURRING
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  -- DRAFT, PENDING, POSTED, REVERSED

  -- Description
  description TEXT NOT NULL,
  reference VARCHAR(100), -- External reference (invoice number, etc.)

  -- Source document
  source_document_id UUID REFERENCES documents(id),

  -- Related entries
  reversed_entry_id UUID REFERENCES journal_entries(id),
  template_id UUID REFERENCES entry_templates(id),
  recurring_entry_id UUID REFERENCES recurring_entries(id),

  -- Workflow
  posted_at TIMESTAMP WITH TIME ZONE,
  posted_by UUID REFERENCES users(id),
  reversed_at TIMESTAMP WITH TIME ZONE,
  reversed_by UUID REFERENCES users(id),

  -- Approval workflow (optional)
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES users(id),

  -- Multi-currency
  base_currency VARCHAR(3) NOT NULL DEFAULT 'PLN',

  -- Metadata
  notes TEXT,
  tags TEXT[], -- For categorization
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),

  CONSTRAINT valid_entry_type CHECK (entry_type IN (
    'STANDARD', 'ADJUSTMENT', 'CLOSING', 'OPENING', 'REVERSAL', 'RECURRING'
  )),
  CONSTRAINT valid_status CHECK (status IN ('DRAFT', 'PENDING', 'POSTED', 'REVERSED')),
  UNIQUE(organization_id, entry_number)
);

-- Journal entry lines
CREATE TABLE journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,

  -- Line identification
  line_number INTEGER NOT NULL,

  -- Account
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),

  -- Amounts (always in positive, direction determined by debit/credit)
  debit_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  credit_amount DECIMAL(19,4) NOT NULL DEFAULT 0,

  -- Multi-currency
  currency VARCHAR(3) NOT NULL DEFAULT 'PLN',
  exchange_rate DECIMAL(19,6) DEFAULT 1,
  base_debit_amount DECIMAL(19,4), -- Amount in base currency
  base_credit_amount DECIMAL(19,4),

  -- Description per line
  description TEXT,

  -- Cost tracking
  cost_center_id UUID REFERENCES cost_centers(id),
  project_id UUID REFERENCES projects(id),

  -- Tax tracking
  tax_code VARCHAR(20),
  tax_amount DECIMAL(19,4),

  -- Reconciliation
  is_reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at TIMESTAMP WITH TIME ZONE,
  bank_transaction_id UUID REFERENCES bank_transactions(id),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_amounts CHECK (
    (debit_amount >= 0 AND credit_amount >= 0) AND
    NOT (debit_amount > 0 AND credit_amount > 0)
  ),
  UNIQUE(entry_id, line_number)
);

-- Entry number sequences
CREATE TABLE entry_number_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Sequence definition
  entry_type VARCHAR(20) NOT NULL,
  prefix VARCHAR(10) NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER, -- NULL for yearly sequences
  last_number INTEGER NOT NULL DEFAULT 0,

  -- Format pattern (e.g., "{prefix}/{year}/{month:02d}/{number:04d}")
  number_format VARCHAR(100) NOT NULL,

  UNIQUE(organization_id, entry_type, year, month)
);

-- Indexes
CREATE INDEX idx_journal_entries_org ON journal_entries(organization_id);
CREATE INDEX idx_journal_entries_period ON journal_entries(period_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);
CREATE INDEX idx_journal_entries_type ON journal_entries(entry_type);
CREATE INDEX idx_journal_entries_number ON journal_entries(entry_number);
CREATE INDEX idx_journal_lines_entry ON journal_lines(entry_id);
CREATE INDEX idx_journal_lines_account ON journal_lines(account_id);

-- Full text search on description
CREATE INDEX idx_journal_entries_description_search
  ON journal_entries USING GIN (to_tsvector('polish', description));

-- RLS Policies
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY journal_entries_org_isolation ON journal_entries
  USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY journal_lines_org_isolation ON journal_lines
  USING (entry_id IN (
    SELECT id FROM journal_entries
    WHERE organization_id = current_setting('app.organization_id')::UUID
  ));
```

### Zod Schemas

```typescript
import { z } from 'zod';
import { Decimal } from 'decimal.js';

// Enums
export const EntryTypeEnum = z.enum([
  'STANDARD', 'ADJUSTMENT', 'CLOSING', 'OPENING', 'REVERSAL', 'RECURRING'
]);
export const EntryStatusEnum = z.enum(['DRAFT', 'PENDING', 'POSTED', 'REVERSED']);

// Journal line input
export const JournalLineInput = z.object({
  accountId: z.string().uuid(),
  debitAmount: z.number().nonnegative().default(0),
  creditAmount: z.number().nonnegative().default(0),
  description: z.string().optional(),
  currency: z.string().length(3).default('PLN'),
  exchangeRate: z.number().positive().default(1),
  costCenterId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  taxCode: z.string().max(20).optional(),
  taxAmount: z.number().optional(),
}).refine(
  (data) => !(data.debitAmount > 0 && data.creditAmount > 0),
  { message: 'Line cannot have both debit and credit amounts' }
).refine(
  (data) => data.debitAmount > 0 || data.creditAmount > 0,
  { message: 'Line must have either debit or credit amount' }
);

// Create journal entry
export const CreateJournalEntryInput = z.object({
  entryDate: z.coerce.date(),
  description: z.string().min(1).max(1000),
  entryType: EntryTypeEnum.default('STANDARD'),
  reference: z.string().max(100).optional(),
  sourceDocumentId: z.string().uuid().optional(),
  reversedEntryId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  requiresApproval: z.boolean().default(false),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  lines: z.array(JournalLineInput).min(2), // Minimum 2 lines for double-entry
}).refine(
  (data) => {
    const totalDebits = data.lines.reduce((sum, l) => sum + l.debitAmount, 0);
    const totalCredits = data.lines.reduce((sum, l) => sum + l.creditAmount, 0);
    return Math.abs(totalDebits - totalCredits) < 0.01; // Allow small rounding
  },
  { message: 'Entry must be balanced (total debits = total credits)' }
);

// Update draft entry
export const UpdateJournalEntryInput = z.object({
  entryId: z.string().uuid(),
  entryDate: z.coerce.date().optional(),
  description: z.string().min(1).max(1000).optional(),
  reference: z.string().max(100).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  lines: z.array(JournalLineInput).min(2).optional(),
});

// Post entry
export const PostEntryInput = z.object({
  entryId: z.string().uuid(),
  postDate: z.coerce.date().optional(), // Override entry date for posting
  bypassApproval: z.boolean().default(false),
});

// Query entries
export const QueryEntriesInput = z.object({
  periodId: z.string().uuid().optional(),
  fiscalYearId: z.string().uuid().optional(),
  dateRange: z.object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  }).optional(),
  status: z.array(EntryStatusEnum).optional(),
  entryType: z.array(EntryTypeEnum).optional(),
  accountId: z.string().uuid().optional(), // Filter by account in lines
  search: z.string().optional(), // Full-text search
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  tags: z.array(z.string()).optional(),
  createdBy: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  orderBy: z.enum(['date_asc', 'date_desc', 'number_asc', 'number_desc', 'created_desc']).default('date_desc'),
});

// Response schemas
export const JournalLineSchema = z.object({
  id: z.string().uuid(),
  lineNumber: z.number(),
  accountId: z.string().uuid(),
  accountCode: z.string(),
  accountName: z.string(),
  debitAmount: z.number(),
  creditAmount: z.number(),
  currency: z.string(),
  exchangeRate: z.number(),
  description: z.string().nullable(),
  costCenterName: z.string().nullable(),
  projectName: z.string().nullable(),
});

export const JournalEntrySchema = z.object({
  id: z.string().uuid(),
  entryNumber: z.string(),
  entryDate: z.date(),
  entryType: EntryTypeEnum,
  status: EntryStatusEnum,
  description: z.string(),
  reference: z.string().nullable(),
  totalDebits: z.number(),
  totalCredits: z.number(),
  isBalanced: z.boolean(),
  lineCount: z.number(),
  lines: z.array(JournalLineSchema).optional(),
  createdAt: z.date(),
  createdBy: z.string(),
  postedAt: z.date().nullable(),
  postedBy: z.string().nullable(),
});

export type JournalEntry = z.infer<typeof JournalEntrySchema>;
export type JournalLine = z.infer<typeof JournalLineSchema>;
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { Decimal } from 'decimal.js';
import {
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  PostEntryInput,
  QueryEntriesInput,
} from './schemas';

export const journalEntryRouter = router({
  // Create new journal entry
  create: protectedProcedure
    .input(CreateJournalEntryInput)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.session;

      // Find period for entry date
      const period = await ctx.db.accountingPeriods.findFirst({
        where: {
          organizationId,
          startDate: { lte: input.entryDate },
          endDate: { gte: input.entryDate },
          periodType: 'REGULAR',
        },
      });

      if (!period) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No accounting period found for entry date',
        });
      }

      if (period.status === 'CLOSED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot create entry in closed period',
        });
      }

      // Validate accounts exist and allow posting
      const accountIds = input.lines.map(l => l.accountId);
      const accounts = await ctx.db.chartOfAccounts.findMany({
        where: {
          id: { in: accountIds },
          organizationId,
          isActive: true,
        },
      });

      if (accounts.length !== new Set(accountIds).size) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'One or more accounts not found or inactive',
        });
      }

      const nonPostableAccounts = accounts.filter(a => !a.allowsPosting);
      if (nonPostableAccounts.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot post to header accounts: ${nonPostableAccounts.map(a => a.accountCode).join(', ')}`,
        });
      }

      // Generate entry number
      const entryNumber = await generateEntryNumber(
        ctx.db,
        organizationId,
        input.entryType,
        input.entryDate
      );

      // Create entry
      const entry = await ctx.db.$transaction(async (tx) => {
        // Calculate base currency amounts
        const linesWithBase = input.lines.map((line, index) => ({
          lineNumber: index + 1,
          accountId: line.accountId,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount,
          baseDebitAmount: new Decimal(line.debitAmount).times(line.exchangeRate).toNumber(),
          baseCreditAmount: new Decimal(line.creditAmount).times(line.exchangeRate).toNumber(),
          currency: line.currency,
          exchangeRate: line.exchangeRate,
          description: line.description,
          costCenterId: line.costCenterId,
          projectId: line.projectId,
          taxCode: line.taxCode,
          taxAmount: line.taxAmount,
        }));

        const journalEntry = await tx.journalEntries.create({
          data: {
            organizationId,
            periodId: period.id,
            entryNumber,
            entryDate: input.entryDate,
            entryType: input.entryType,
            status: 'DRAFT',
            description: input.description,
            reference: input.reference,
            sourceDocumentId: input.sourceDocumentId,
            reversedEntryId: input.reversedEntryId,
            templateId: input.templateId,
            requiresApproval: input.requiresApproval,
            notes: input.notes,
            tags: input.tags,
            createdBy: userId,
            lines: {
              create: linesWithBase,
            },
          },
          include: {
            lines: {
              include: {
                account: {
                  select: {
                    accountCode: true,
                    accountName: true,
                  },
                },
              },
            },
          },
        });

        // Audit log
        await tx.auditLogs.create({
          data: {
            organizationId,
            userId,
            action: 'JOURNAL_ENTRY_CREATED',
            entityType: 'JOURNAL_ENTRY',
            entityId: journalEntry.id,
            newValues: {
              entryNumber,
              entryType: input.entryType,
              description: input.description,
              lineCount: input.lines.length,
            },
          },
        });

        return journalEntry;
      });

      return formatEntry(entry);
    }),

  // Get single entry
  getEntry: protectedProcedure
    .input(z.object({ entryId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      const entry = await ctx.db.journalEntries.findFirst({
        where: {
          id: input.entryId,
          organizationId,
        },
        include: {
          lines: {
            include: {
              account: {
                select: {
                  accountCode: true,
                  accountName: true,
                  accountType: true,
                },
              },
              costCenter: { select: { name: true } },
              project: { select: { name: true } },
            },
            orderBy: { lineNumber: 'asc' },
          },
          period: true,
          sourceDocument: true,
          reversedEntry: { select: { entryNumber: true } },
          createdByUser: { select: { name: true, email: true } },
          postedByUser: { select: { name: true, email: true } },
        },
      });

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Journal entry not found',
        });
      }

      return formatEntry(entry);
    }),

  // Update draft entry
  update: protectedProcedure
    .input(UpdateJournalEntryInput)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.session;

      // Verify entry exists and is editable
      const existing = await ctx.db.journalEntries.findFirst({
        where: {
          id: input.entryId,
          organizationId,
        },
        include: { lines: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Journal entry not found',
        });
      }

      if (existing.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only draft entries can be modified',
        });
      }

      // Update entry
      const updated = await ctx.db.$transaction(async (tx) => {
        const updateData: any = {};

        if (input.entryDate) {
          // Check new date has valid period
          const period = await tx.accountingPeriods.findFirst({
            where: {
              organizationId,
              startDate: { lte: input.entryDate },
              endDate: { gte: input.entryDate },
              status: { not: 'CLOSED' },
            },
          });

          if (!period) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'No open period for new entry date',
            });
          }

          updateData.entryDate = input.entryDate;
          updateData.periodId = period.id;
        }

        if (input.description) updateData.description = input.description;
        if (input.reference !== undefined) updateData.reference = input.reference;
        if (input.notes !== undefined) updateData.notes = input.notes;
        if (input.tags) updateData.tags = input.tags;

        // Update lines if provided
        if (input.lines) {
          // Delete existing lines
          await tx.journalLines.deleteMany({
            where: { entryId: input.entryId },
          });

          // Create new lines
          const linesWithBase = input.lines.map((line, index) => ({
            entryId: input.entryId,
            lineNumber: index + 1,
            accountId: line.accountId,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            baseDebitAmount: new Decimal(line.debitAmount).times(line.exchangeRate).toNumber(),
            baseCreditAmount: new Decimal(line.creditAmount).times(line.exchangeRate).toNumber(),
            currency: line.currency,
            exchangeRate: line.exchangeRate,
            description: line.description,
            costCenterId: line.costCenterId,
            projectId: line.projectId,
            taxCode: line.taxCode,
            taxAmount: line.taxAmount,
          }));

          await tx.journalLines.createMany({
            data: linesWithBase,
          });
        }

        const entry = await tx.journalEntries.update({
          where: { id: input.entryId },
          data: {
            ...updateData,
            updatedAt: new Date(),
          },
          include: {
            lines: {
              include: {
                account: {
                  select: { accountCode: true, accountName: true },
                },
              },
            },
          },
        });

        // Audit log
        await tx.auditLogs.create({
          data: {
            organizationId,
            userId,
            action: 'JOURNAL_ENTRY_UPDATED',
            entityType: 'JOURNAL_ENTRY',
            entityId: input.entryId,
            oldValues: {
              description: existing.description,
              entryDate: existing.entryDate,
            },
            newValues: {
              description: entry.description,
              entryDate: entry.entryDate,
            },
          },
        });

        return entry;
      });

      return formatEntry(updated);
    }),

  // Delete draft entry
  delete: protectedProcedure
    .input(z.object({ entryId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.session;

      const entry = await ctx.db.journalEntries.findFirst({
        where: {
          id: input.entryId,
          organizationId,
        },
      });

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Journal entry not found',
        });
      }

      if (entry.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only draft entries can be deleted',
        });
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.journalEntries.delete({
          where: { id: input.entryId },
        });

        await tx.auditLogs.create({
          data: {
            organizationId,
            userId,
            action: 'JOURNAL_ENTRY_DELETED',
            entityType: 'JOURNAL_ENTRY',
            entityId: input.entryId,
            oldValues: {
              entryNumber: entry.entryNumber,
              description: entry.description,
            },
          },
        });
      });

      return { success: true };
    }),

  // Post entry to general ledger
  post: protectedProcedure
    .input(PostEntryInput)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.session;

      const entry = await ctx.db.journalEntries.findFirst({
        where: {
          id: input.entryId,
          organizationId,
        },
        include: {
          lines: true,
          period: true,
        },
      });

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Journal entry not found',
        });
      }

      if (entry.status === 'POSTED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Entry is already posted',
        });
      }

      if (entry.status === 'REVERSED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot post reversed entry',
        });
      }

      // Check period status
      if (entry.period.status === 'CLOSED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot post to closed period',
        });
      }

      // Check approval requirement
      if (entry.requiresApproval && !entry.approvedAt && !input.bypassApproval) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Entry requires approval before posting',
        });
      }

      // Validate balance
      const totalDebits = entry.lines.reduce(
        (sum, l) => sum.plus(l.baseDebitAmount || l.debitAmount),
        new Decimal(0)
      );
      const totalCredits = entry.lines.reduce(
        (sum, l) => sum.plus(l.baseCreditAmount || l.creditAmount),
        new Decimal(0)
      );

      if (!totalDebits.equals(totalCredits)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Entry is not balanced',
        });
      }

      // Post entry
      const posted = await ctx.db.$transaction(async (tx) => {
        // Update entry status
        const updatedEntry = await tx.journalEntries.update({
          where: { id: input.entryId },
          data: {
            status: 'POSTED',
            postedAt: new Date(),
            postedBy: userId,
          },
        });

        // Update account balances
        for (const line of entry.lines) {
          const debitAmount = new Decimal(line.baseDebitAmount || line.debitAmount);
          const creditAmount = new Decimal(line.baseCreditAmount || line.creditAmount);

          await tx.accountBalances.upsert({
            where: {
              account_period_unique: {
                accountId: line.accountId,
                periodId: entry.periodId,
              },
            },
            create: {
              accountId: line.accountId,
              periodId: entry.periodId,
              openingBalance: new Decimal(0),
              debitMovements: debitAmount.toNumber(),
              creditMovements: creditAmount.toNumber(),
              closingBalance: debitAmount.minus(creditAmount).toNumber(),
            },
            update: {
              debitMovements: { increment: debitAmount.toNumber() },
              creditMovements: { increment: creditAmount.toNumber() },
              closingBalance: {
                increment: debitAmount.minus(creditAmount).toNumber(),
              },
            },
          });
        }

        // Create general ledger entries
        await tx.generalLedger.createMany({
          data: entry.lines.map(line => ({
            organizationId,
            entryId: entry.id,
            lineId: line.id,
            accountId: line.accountId,
            periodId: entry.periodId,
            entryDate: entry.entryDate,
            debitAmount: line.baseDebitAmount || line.debitAmount,
            creditAmount: line.baseCreditAmount || line.creditAmount,
            description: line.description || entry.description,
            reference: entry.reference,
          })),
        });

        // Audit log
        await tx.auditLogs.create({
          data: {
            organizationId,
            userId,
            action: 'JOURNAL_ENTRY_POSTED',
            entityType: 'JOURNAL_ENTRY',
            entityId: input.entryId,
            newValues: {
              entryNumber: entry.entryNumber,
              totalDebits: totalDebits.toString(),
              totalCredits: totalCredits.toString(),
            },
          },
        });

        return updatedEntry;
      });

      return posted;
    }),

  // Query entries
  query: protectedProcedure
    .input(QueryEntriesInput)
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      const where: any = { organizationId };

      if (input.periodId) {
        where.periodId = input.periodId;
      }

      if (input.fiscalYearId) {
        where.period = { fiscalYearId: input.fiscalYearId };
      }

      if (input.dateRange) {
        where.entryDate = {
          gte: input.dateRange.from,
          lte: input.dateRange.to,
        };
      }

      if (input.status && input.status.length > 0) {
        where.status = { in: input.status };
      }

      if (input.entryType && input.entryType.length > 0) {
        where.entryType = { in: input.entryType };
      }

      if (input.accountId) {
        where.lines = {
          some: { accountId: input.accountId },
        };
      }

      if (input.search) {
        where.OR = [
          { description: { contains: input.search, mode: 'insensitive' } },
          { entryNumber: { contains: input.search, mode: 'insensitive' } },
          { reference: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      if (input.tags && input.tags.length > 0) {
        where.tags = { hasSome: input.tags };
      }

      if (input.createdBy) {
        where.createdBy = input.createdBy;
      }

      // Order by
      const orderByMap: Record<string, any> = {
        date_asc: { entryDate: 'asc' },
        date_desc: { entryDate: 'desc' },
        number_asc: { entryNumber: 'asc' },
        number_desc: { entryNumber: 'desc' },
        created_desc: { createdAt: 'desc' },
      };

      const [entries, total] = await Promise.all([
        ctx.db.journalEntries.findMany({
          where,
          include: {
            lines: {
              include: {
                account: {
                  select: { accountCode: true, accountName: true },
                },
              },
            },
            createdByUser: { select: { name: true } },
          },
          orderBy: orderByMap[input.orderBy],
          skip: input.offset,
          take: input.limit,
        }),
        ctx.db.journalEntries.count({ where }),
      ]);

      return {
        entries: entries.map(formatEntry),
        total,
        limit: input.limit,
        offset: input.offset,
        hasMore: input.offset + entries.length < total,
      };
    }),

  // Get entry statistics
  getStats: protectedProcedure
    .input(z.object({
      periodId: z.string().uuid().optional(),
      fiscalYearId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      const where: any = { organizationId };

      if (input.periodId) {
        where.periodId = input.periodId;
      }

      if (input.fiscalYearId) {
        where.period = { fiscalYearId: input.fiscalYearId };
      }

      const [
        totalEntries,
        draftEntries,
        postedEntries,
        entriesByType,
      ] = await Promise.all([
        ctx.db.journalEntries.count({ where }),
        ctx.db.journalEntries.count({ where: { ...where, status: 'DRAFT' } }),
        ctx.db.journalEntries.count({ where: { ...where, status: 'POSTED' } }),
        ctx.db.journalEntries.groupBy({
          by: ['entryType'],
          where,
          _count: true,
        }),
      ]);

      return {
        totalEntries,
        draftEntries,
        postedEntries,
        reversedEntries: totalEntries - draftEntries - postedEntries,
        byType: entriesByType.reduce((acc, item) => {
          acc[item.entryType] = item._count;
          return acc;
        }, {} as Record<string, number>),
      };
    }),
});

// Helper: Generate entry number
async function generateEntryNumber(
  db: any,
  organizationId: string,
  entryType: string,
  entryDate: Date
): Promise<string> {
  const year = entryDate.getFullYear();
  const month = entryDate.getMonth() + 1;

  // Get or create sequence
  const sequence = await db.entryNumberSequences.upsert({
    where: {
      org_type_year_month_unique: {
        organizationId,
        entryType,
        year,
        month,
      },
    },
    create: {
      organizationId,
      entryType,
      year,
      month,
      prefix: getEntryPrefix(entryType),
      lastNumber: 1,
      numberFormat: '{prefix}/{year}/{month:02d}/{number:04d}',
    },
    update: {
      lastNumber: { increment: 1 },
    },
  });

  const number = sequence.lastNumber;
  const prefix = sequence.prefix;

  return `${prefix}/${year}/${String(month).padStart(2, '0')}/${String(number).padStart(4, '0')}`;
}

function getEntryPrefix(entryType: string): string {
  const prefixes: Record<string, string> = {
    STANDARD: 'JE',
    ADJUSTMENT: 'AJ',
    CLOSING: 'CL',
    OPENING: 'OB',
    REVERSAL: 'RV',
    RECURRING: 'RC',
  };
  return prefixes[entryType] || 'JE';
}

// Helper: Format entry for response
function formatEntry(entry: any): any {
  const totalDebits = entry.lines.reduce(
    (sum: Decimal, l: any) => sum.plus(l.baseDebitAmount || l.debitAmount),
    new Decimal(0)
  );
  const totalCredits = entry.lines.reduce(
    (sum: Decimal, l: any) => sum.plus(l.baseCreditAmount || l.creditAmount),
    new Decimal(0)
  );

  return {
    ...entry,
    totalDebits: totalDebits.toNumber(),
    totalCredits: totalCredits.toNumber(),
    isBalanced: totalDebits.equals(totalCredits),
    lineCount: entry.lines.length,
    lines: entry.lines.map((line: any) => ({
      ...line,
      accountCode: line.account?.accountCode,
      accountName: line.account?.accountName,
      costCenterName: line.costCenter?.name,
      projectName: line.project?.name,
    })),
  };
}
```

---

## Test Specifications

### Unit Tests

```typescript
describe('Journal Entry', () => {
  describe('Entry validation', () => {
    it('should require balanced entry', () => {
      const input = {
        entryDate: new Date(),
        description: 'Test',
        lines: [
          { accountId: '1', debitAmount: 1000, creditAmount: 0 },
          { accountId: '2', debitAmount: 0, creditAmount: 500 },
        ],
      };

      const result = CreateJournalEntryInput.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept balanced entry', () => {
      const input = {
        entryDate: new Date(),
        description: 'Test',
        lines: [
          { accountId: '1', debitAmount: 1000, creditAmount: 0 },
          { accountId: '2', debitAmount: 0, creditAmount: 1000 },
        ],
      };

      const result = CreateJournalEntryInput.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject line with both debit and credit', () => {
      const line = {
        accountId: '1',
        debitAmount: 500,
        creditAmount: 500,
      };

      const result = JournalLineInput.safeParse(line);
      expect(result.success).toBe(false);
    });
  });

  describe('Entry numbering', () => {
    it('should generate correct format', () => {
      const number = generateEntryNumberSync('JE', 2024, 1, 51);
      expect(number).toBe('JE/2024/01/0051');
    });

    it('should use correct prefix per type', () => {
      expect(getEntryPrefix('ADJUSTMENT')).toBe('AJ');
      expect(getEntryPrefix('CLOSING')).toBe('CL');
      expect(getEntryPrefix('REVERSAL')).toBe('RV');
    });
  });
});
```

### Integration Tests

```typescript
describe('Journal Entry Router', () => {
  describe('create', () => {
    it('should create draft entry', async () => {
      const entry = await caller.journalEntry.create({
        entryDate: new Date('2024-01-15'),
        description: 'Cash withdrawal from bank',
        lines: [
          { accountId: cashAccountId, debitAmount: 1000, creditAmount: 0 },
          { accountId: bankAccountId, debitAmount: 0, creditAmount: 1000 },
        ],
      });

      expect(entry.status).toBe('DRAFT');
      expect(entry.entryNumber).toMatch(/^JE\/2024\/01\/\d{4}$/);
      expect(entry.lineCount).toBe(2);
    });

    it('should reject entry to closed period', async () => {
      await expect(
        caller.journalEntry.create({
          entryDate: new Date('2023-12-15'), // Closed period
          description: 'Late entry',
          lines: [
            { accountId: cashAccountId, debitAmount: 500, creditAmount: 0 },
            { accountId: bankAccountId, debitAmount: 0, creditAmount: 500 },
          ],
        })
      ).rejects.toThrow('closed period');
    });
  });

  describe('post', () => {
    it('should post entry and update balances', async () => {
      const entry = await createDraftEntry();

      const posted = await caller.journalEntry.post({
        entryId: entry.id,
      });

      expect(posted.status).toBe('POSTED');
      expect(posted.postedAt).toBeDefined();

      // Verify general ledger
      const glEntries = await db.generalLedger.findMany({
        where: { entryId: entry.id },
      });
      expect(glEntries.length).toBe(entry.lineCount);
    });

    it('should reject posting unbalanced entry', async () => {
      // Manually create unbalanced entry (bypass validation)
      const entry = await createUnbalancedEntry();

      await expect(
        caller.journalEntry.post({ entryId: entry.id })
      ).rejects.toThrow('not balanced');
    });
  });

  describe('query', () => {
    it('should filter by status', async () => {
      const result = await caller.journalEntry.query({
        status: ['POSTED'],
        limit: 10,
      });

      expect(result.entries.every(e => e.status === 'POSTED')).toBe(true);
    });

    it('should search by description', async () => {
      const result = await caller.journalEntry.query({
        search: 'cash withdrawal',
        limit: 10,
      });

      expect(result.entries.length).toBeGreaterThan(0);
    });
  });
});
```

---

## Security Checklist

- [x] Organization isolation via RLS
- [x] Validate account ownership before creating lines
- [x] Only draft entries can be modified/deleted
- [x] Posted entries are immutable
- [x] Audit logging for all CRUD operations
- [x] Entry number uniqueness enforced

---

## Audit Events

```typescript
const JOURNAL_ENTRY_AUDIT_EVENTS = {
  CREATED: 'journal_entry.created',
  UPDATED: 'journal_entry.updated',
  DELETED: 'journal_entry.deleted',
  POSTED: 'journal_entry.posted',
  REVERSED: 'journal_entry.reversed',
  APPROVED: 'journal_entry.approved',
  ATTACHMENT_ADDED: 'journal_entry.attachment_added',
};
```

---

## Tasks

- [ ] Create database migrations
- [ ] Implement entry number generation
- [ ] Build validation logic
- [ ] Implement posting workflow
- [ ] Create general ledger update logic
- [ ] Add multi-currency support
- [ ] Create UI forms
- [ ] Write tests

---

*Last updated: December 2024*
