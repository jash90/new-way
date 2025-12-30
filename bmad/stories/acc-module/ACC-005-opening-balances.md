# ACC-005: Opening Balances

> **Story ID**: ACC-005
> **Title**: Opening Balances
> **Epic**: Accounting Engine (ACC)
> **Priority**: P1
> **Points**: 5
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant onboarding a new client,
**I want to** enter opening balances for all accounts,
**So that** I can start tracking from a specific date with accurate historical balances.

---

## Acceptance Criteria

### AC1: Enter Opening Balances
```gherkin
Feature: Opening Balance Entry

Scenario: Enter opening balance for single account
  Given account "100 - Kasa" exists
  And fiscal year 2024 is open
  When I enter opening balance of 5000 PLN debit
  Then the account should show balance of 5000 PLN
  And an opening balance entry should be created

Scenario: Enter opening balances in batch
  Given I have a list of accounts with balances from previous system
  When I upload opening balances via import
  Then all account balances should be set correctly
  And the trial balance should be balanced (debits = credits)
```

### AC2: Validate Balance Entry
```gherkin
Feature: Opening Balance Validation

Scenario: Validate debits equal credits
  Given I am entering opening balances
  When total debits are 100,000 PLN
  And total credits are 95,000 PLN
  Then I should see warning "Trial balance is out of balance by 5,000 PLN"
  And I should not be able to finalize until balanced

Scenario: Validate against account normal balance
  Given account "200 - Bank" has normal balance DEBIT
  When I enter a credit opening balance
  Then I should see warning "Credit balance on debit-normal account"
  But entry should be allowed with acknowledgment
```

### AC3: Opening Balance Journal Entry
```gherkin
Feature: Opening Balance Entry Creation

Scenario: Create opening balance entry
  Given opening balances have been entered and validated
  When I finalize opening balances
  Then a journal entry of type "OPENING" should be created
  And entry date should be first day of fiscal year
  And entry should be automatically posted

Scenario: Modify opening balances
  Given opening balances have been finalized
  When I need to adjust an opening balance
  Then I should create a correcting entry (not modify original)
  And audit trail should show both entries
```

### AC4: Import from Previous System
```gherkin
Feature: Opening Balance Import

Scenario: Import from Excel
  Given I have an Excel file with account codes and balances
  When I upload the file
  Then system should match accounts by code
  And preview should show matched vs unmatched accounts
  And I should be able to create missing accounts

Scenario: Import from trial balance report
  Given I have a trial balance PDF from previous accountant
  When I upload for OCR processing
  Then system should extract account data
  And I should review and confirm extracted values
```

---

## Technical Specification

### Database Schema

```sql
-- Opening balance batches
CREATE TABLE opening_balance_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id),

  -- Batch info
  batch_name VARCHAR(255) NOT NULL,
  effective_date DATE NOT NULL,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  -- DRAFT, VALIDATED, FINALIZED

  -- Validation results
  total_debits DECIMAL(19,4) NOT NULL DEFAULT 0,
  total_credits DECIMAL(19,4) NOT NULL DEFAULT 0,
  is_balanced BOOLEAN GENERATED ALWAYS AS (total_debits = total_credits) STORED,

  -- Import source
  import_source VARCHAR(50), -- MANUAL, EXCEL, CSV, OCR
  import_file_id UUID REFERENCES documents(id),

  -- Finalization
  journal_entry_id UUID REFERENCES journal_entries(id),
  finalized_at TIMESTAMP WITH TIME ZONE,
  finalized_by UUID REFERENCES users(id),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),

  CONSTRAINT valid_batch_status CHECK (status IN ('DRAFT', 'VALIDATED', 'FINALIZED'))
);

-- Opening balance line items
CREATE TABLE opening_balance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES opening_balance_batches(id) ON DELETE CASCADE,

  -- Account reference
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),

  -- Balance
  debit_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  credit_amount DECIMAL(19,4) NOT NULL DEFAULT 0,

  -- Validation
  has_warning BOOLEAN DEFAULT FALSE,
  warning_message TEXT,
  warning_acknowledged BOOLEAN DEFAULT FALSE,

  -- Multi-currency support
  currency VARCHAR(3) NOT NULL DEFAULT 'PLN',
  exchange_rate DECIMAL(19,6) DEFAULT 1,
  base_debit_amount DECIMAL(19,4), -- In base currency (PLN)
  base_credit_amount DECIMAL(19,4),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_amounts CHECK (
    (debit_amount >= 0 AND credit_amount >= 0) AND
    NOT (debit_amount > 0 AND credit_amount > 0)
  ),
  UNIQUE(batch_id, account_id)
);

-- Indexes
CREATE INDEX idx_ob_batches_org ON opening_balance_batches(organization_id);
CREATE INDEX idx_ob_batches_year ON opening_balance_batches(fiscal_year_id);
CREATE INDEX idx_ob_items_batch ON opening_balance_items(batch_id);
CREATE INDEX idx_ob_items_account ON opening_balance_items(account_id);

-- RLS Policies
ALTER TABLE opening_balance_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_balance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY ob_batches_org_isolation ON opening_balance_batches
  USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY ob_items_org_isolation ON opening_balance_items
  USING (batch_id IN (
    SELECT id FROM opening_balance_batches
    WHERE organization_id = current_setting('app.organization_id')::UUID
  ));
```

### Zod Schemas

```typescript
import { z } from 'zod';
import { Decimal } from 'decimal.js';

// Batch status enum
export const BatchStatusEnum = z.enum(['DRAFT', 'VALIDATED', 'FINALIZED']);
export const ImportSourceEnum = z.enum(['MANUAL', 'EXCEL', 'CSV', 'OCR']);

// Create batch
export const CreateOpeningBalanceBatchInput = z.object({
  fiscalYearId: z.string().uuid(),
  batchName: z.string().min(1).max(255),
  effectiveDate: z.coerce.date(),
  notes: z.string().optional(),
});

// Single balance item
export const OpeningBalanceItemInput = z.object({
  accountId: z.string().uuid(),
  debitAmount: z.number().nonnegative().default(0),
  creditAmount: z.number().nonnegative().default(0),
  currency: z.string().length(3).default('PLN'),
  exchangeRate: z.number().positive().default(1),
  notes: z.string().optional(),
}).refine(
  (data) => !(data.debitAmount > 0 && data.creditAmount > 0),
  { message: 'Cannot have both debit and credit amounts' }
);

// Add items to batch
export const AddOpeningBalanceItemsInput = z.object({
  batchId: z.string().uuid(),
  items: z.array(OpeningBalanceItemInput).min(1),
});

// Update single item
export const UpdateOpeningBalanceItemInput = z.object({
  itemId: z.string().uuid(),
  debitAmount: z.number().nonnegative().optional(),
  creditAmount: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  exchangeRate: z.number().positive().optional(),
  notes: z.string().optional(),
  acknowledgeWarning: z.boolean().optional(),
});

// Import from file
export const ImportOpeningBalancesInput = z.object({
  batchId: z.string().uuid(),
  fileContent: z.string(), // Base64 encoded
  fileName: z.string(),
  fileType: z.enum(['xlsx', 'csv']),
  columnMapping: z.object({
    accountCode: z.string(),
    accountName: z.string().optional(),
    debitColumn: z.string(),
    creditColumn: z.string(),
    currencyColumn: z.string().optional(),
  }),
  skipRows: z.number().int().nonnegative().default(1), // Header row
  createMissingAccounts: z.boolean().default(false),
});

// Finalize batch
export const FinalizeOpeningBalancesInput = z.object({
  batchId: z.string().uuid(),
  forceUnbalanced: z.boolean().default(false), // For special cases
  entryDescription: z.string().default('Opening balances'),
});

// Response schemas
export const OpeningBalanceBatchSchema = z.object({
  id: z.string().uuid(),
  fiscalYearId: z.string().uuid(),
  batchName: z.string(),
  effectiveDate: z.date(),
  status: BatchStatusEnum,
  totalDebits: z.number(),
  totalCredits: z.number(),
  isBalanced: z.boolean(),
  difference: z.number(),
  itemCount: z.number(),
  warningCount: z.number(),
});

export const OpeningBalanceItemSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  accountCode: z.string(),
  accountName: z.string(),
  accountType: z.string(),
  normalBalance: z.string(),
  debitAmount: z.number(),
  creditAmount: z.number(),
  currency: z.string(),
  exchangeRate: z.number(),
  hasWarning: z.boolean(),
  warningMessage: z.string().nullable(),
  warningAcknowledged: z.boolean(),
});

export type OpeningBalanceBatch = z.infer<typeof OpeningBalanceBatchSchema>;
export type OpeningBalanceItem = z.infer<typeof OpeningBalanceItemSchema>;
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { Decimal } from 'decimal.js';
import * as XLSX from 'xlsx';
import {
  CreateOpeningBalanceBatchInput,
  AddOpeningBalanceItemsInput,
  UpdateOpeningBalanceItemInput,
  ImportOpeningBalancesInput,
  FinalizeOpeningBalancesInput,
} from './schemas';

export const openingBalanceRouter = router({
  // Create new opening balance batch
  createBatch: protectedProcedure
    .input(CreateOpeningBalanceBatchInput)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.session;

      // Verify fiscal year exists and is open
      const fiscalYear = await ctx.db.fiscalYears.findFirst({
        where: {
          id: input.fiscalYearId,
          organizationId,
          status: 'OPEN',
        },
      });

      if (!fiscalYear) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Fiscal year not found or not open',
        });
      }

      // Check if finalized batch already exists
      const existingFinalized = await ctx.db.openingBalanceBatches.findFirst({
        where: {
          fiscalYearId: input.fiscalYearId,
          status: 'FINALIZED',
        },
      });

      if (existingFinalized) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Opening balances already finalized for this fiscal year. Create adjustment entries instead.',
        });
      }

      const batch = await ctx.db.openingBalanceBatches.create({
        data: {
          organizationId,
          fiscalYearId: input.fiscalYearId,
          batchName: input.batchName,
          effectiveDate: input.effectiveDate,
          notes: input.notes,
          status: 'DRAFT',
          createdBy: userId,
        },
      });

      return batch;
    }),

  // Get batch with items
  getBatch: protectedProcedure
    .input(z.object({ batchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      const batch = await ctx.db.openingBalanceBatches.findFirst({
        where: {
          id: input.batchId,
          organizationId,
        },
        include: {
          items: {
            include: {
              account: {
                select: {
                  accountCode: true,
                  accountName: true,
                  accountType: true,
                  normalBalance: true,
                },
              },
            },
            orderBy: {
              account: { accountCode: 'asc' },
            },
          },
          fiscalYear: true,
        },
      });

      if (!batch) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Opening balance batch not found',
        });
      }

      // Calculate totals
      const totals = batch.items.reduce(
        (acc, item) => ({
          debits: acc.debits.plus(item.debitAmount),
          credits: acc.credits.plus(item.creditAmount),
          warnings: acc.warnings + (item.hasWarning && !item.warningAcknowledged ? 1 : 0),
        }),
        { debits: new Decimal(0), credits: new Decimal(0), warnings: 0 }
      );

      return {
        ...batch,
        totalDebits: totals.debits.toNumber(),
        totalCredits: totals.credits.toNumber(),
        difference: totals.debits.minus(totals.credits).abs().toNumber(),
        isBalanced: totals.debits.equals(totals.credits),
        warningCount: totals.warnings,
        itemCount: batch.items.length,
        items: batch.items.map(item => ({
          ...item,
          accountCode: item.account.accountCode,
          accountName: item.account.accountName,
          accountType: item.account.accountType,
          normalBalance: item.account.normalBalance,
        })),
      };
    }),

  // Add balance items
  addItems: protectedProcedure
    .input(AddOpeningBalanceItemsInput)
    .mutation(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      // Verify batch is draft
      const batch = await ctx.db.openingBalanceBatches.findFirst({
        where: {
          id: input.batchId,
          organizationId,
          status: 'DRAFT',
        },
      });

      if (!batch) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Draft batch not found',
        });
      }

      // Get accounts for validation
      const accountIds = input.items.map(i => i.accountId);
      const accounts = await ctx.db.chartOfAccounts.findMany({
        where: {
          id: { in: accountIds },
          organizationId,
        },
      });

      const accountMap = new Map(accounts.map(a => [a.id, a]));

      // Prepare items with validation
      const itemsToCreate = input.items.map(item => {
        const account = accountMap.get(item.accountId);

        if (!account) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Account ${item.accountId} not found`,
          });
        }

        // Check for balance direction warning
        let hasWarning = false;
        let warningMessage = null;

        const isDebit = item.debitAmount > 0;
        const expectedDebit = account.normalBalance === 'DEBIT';

        if (isDebit !== expectedDebit && (item.debitAmount > 0 || item.creditAmount > 0)) {
          hasWarning = true;
          warningMessage = `${isDebit ? 'Debit' : 'Credit'} balance on ${account.normalBalance.toLowerCase()}-normal account`;
        }

        // Calculate base currency amounts
        const baseDebit = new Decimal(item.debitAmount).times(item.exchangeRate);
        const baseCredit = new Decimal(item.creditAmount).times(item.exchangeRate);

        return {
          batchId: input.batchId,
          accountId: item.accountId,
          debitAmount: item.debitAmount,
          creditAmount: item.creditAmount,
          currency: item.currency,
          exchangeRate: item.exchangeRate,
          baseDebitAmount: baseDebit.toNumber(),
          baseCreditAmount: baseCredit.toNumber(),
          hasWarning,
          warningMessage,
          notes: item.notes,
        };
      });

      // Create items (upsert to handle duplicates)
      const created = await ctx.db.$transaction(
        itemsToCreate.map(item =>
          ctx.db.openingBalanceItems.upsert({
            where: {
              batch_account_unique: {
                batchId: item.batchId,
                accountId: item.accountId,
              },
            },
            create: item,
            update: {
              debitAmount: item.debitAmount,
              creditAmount: item.creditAmount,
              currency: item.currency,
              exchangeRate: item.exchangeRate,
              baseDebitAmount: item.baseDebitAmount,
              baseCreditAmount: item.baseCreditAmount,
              hasWarning: item.hasWarning,
              warningMessage: item.warningMessage,
              notes: item.notes,
            },
          })
        )
      );

      // Update batch totals
      await updateBatchTotals(ctx.db, input.batchId);

      return { created: created.length };
    }),

  // Update single item
  updateItem: protectedProcedure
    .input(UpdateOpeningBalanceItemInput)
    .mutation(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      // Verify item belongs to draft batch in org
      const item = await ctx.db.openingBalanceItems.findFirst({
        where: {
          id: input.itemId,
          batch: {
            organizationId,
            status: 'DRAFT',
          },
        },
        include: {
          account: true,
        },
      });

      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Item not found or batch not editable',
        });
      }

      const updateData: any = {};

      if (input.debitAmount !== undefined) {
        updateData.debitAmount = input.debitAmount;
      }
      if (input.creditAmount !== undefined) {
        updateData.creditAmount = input.creditAmount;
      }
      if (input.currency !== undefined) {
        updateData.currency = input.currency;
      }
      if (input.exchangeRate !== undefined) {
        updateData.exchangeRate = input.exchangeRate;
      }
      if (input.notes !== undefined) {
        updateData.notes = input.notes;
      }
      if (input.acknowledgeWarning) {
        updateData.warningAcknowledged = true;
      }

      // Recalculate base amounts if needed
      const debit = input.debitAmount ?? item.debitAmount;
      const credit = input.creditAmount ?? item.creditAmount;
      const rate = input.exchangeRate ?? item.exchangeRate;

      updateData.baseDebitAmount = new Decimal(debit).times(rate).toNumber();
      updateData.baseCreditAmount = new Decimal(credit).times(rate).toNumber();

      // Re-validate warning
      const isDebit = debit > 0;
      const expectedDebit = item.account.normalBalance === 'DEBIT';

      if (isDebit !== expectedDebit && (debit > 0 || credit > 0)) {
        updateData.hasWarning = true;
        updateData.warningMessage = `${isDebit ? 'Debit' : 'Credit'} balance on ${item.account.normalBalance.toLowerCase()}-normal account`;
        if (!input.acknowledgeWarning) {
          updateData.warningAcknowledged = false;
        }
      } else {
        updateData.hasWarning = false;
        updateData.warningMessage = null;
      }

      const updated = await ctx.db.openingBalanceItems.update({
        where: { id: input.itemId },
        data: updateData,
      });

      // Update batch totals
      await updateBatchTotals(ctx.db, item.batchId);

      return updated;
    }),

  // Import from file
  importFromFile: protectedProcedure
    .input(ImportOpeningBalancesInput)
    .mutation(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      // Verify batch
      const batch = await ctx.db.openingBalanceBatches.findFirst({
        where: {
          id: input.batchId,
          organizationId,
          status: 'DRAFT',
        },
      });

      if (!batch) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Draft batch not found',
        });
      }

      // Parse file
      const buffer = Buffer.from(input.fileContent, 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Skip header rows
      const rows = data.slice(input.skipRows);

      // Get column indices
      const headers = data[input.skipRows - 1] as string[];
      const codeIdx = headers.indexOf(input.columnMapping.accountCode);
      const debitIdx = headers.indexOf(input.columnMapping.debitColumn);
      const creditIdx = headers.indexOf(input.columnMapping.creditColumn);

      if (codeIdx === -1 || debitIdx === -1 || creditIdx === -1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Required columns not found in file',
        });
      }

      // Get existing accounts
      const accounts = await ctx.db.chartOfAccounts.findMany({
        where: { organizationId },
      });
      const accountByCode = new Map(accounts.map(a => [a.accountCode, a]));

      // Process rows
      const results = {
        matched: [] as any[],
        unmatched: [] as any[],
        errors: [] as string[],
      };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] as any[];
        const code = String(row[codeIdx]).trim();
        const debit = parseFloat(row[debitIdx]) || 0;
        const credit = parseFloat(row[creditIdx]) || 0;

        if (!code) continue;

        const account = accountByCode.get(code);

        if (account) {
          results.matched.push({
            accountId: account.id,
            accountCode: code,
            accountName: account.accountName,
            debitAmount: debit,
            creditAmount: credit,
          });
        } else {
          results.unmatched.push({
            rowNumber: i + input.skipRows + 1,
            accountCode: code,
            debitAmount: debit,
            creditAmount: credit,
          });
        }
      }

      // Create items for matched accounts
      if (results.matched.length > 0) {
        await ctx.trpc.openingBalance.addItems({
          batchId: input.batchId,
          items: results.matched.map(m => ({
            accountId: m.accountId,
            debitAmount: m.debitAmount,
            creditAmount: m.creditAmount,
          })),
        });
      }

      // Update batch with import info
      await ctx.db.openingBalanceBatches.update({
        where: { id: input.batchId },
        data: {
          importSource: input.fileType.toUpperCase(),
        },
      });

      return {
        totalRows: rows.length,
        matched: results.matched.length,
        unmatched: results.unmatched.length,
        unmatchedAccounts: results.unmatched,
      };
    }),

  // Validate batch
  validateBatch: protectedProcedure
    .input(z.object({ batchId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      const batch = await ctx.db.openingBalanceBatches.findFirst({
        where: {
          id: input.batchId,
          organizationId,
        },
        include: {
          items: {
            include: { account: true },
          },
        },
      });

      if (!batch) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Batch not found',
        });
      }

      const issues: string[] = [];

      // Check balance
      const totals = batch.items.reduce(
        (acc, item) => ({
          debits: acc.debits.plus(item.baseDebitAmount || item.debitAmount),
          credits: acc.credits.plus(item.baseCreditAmount || item.creditAmount),
        }),
        { debits: new Decimal(0), credits: new Decimal(0) }
      );

      if (!totals.debits.equals(totals.credits)) {
        issues.push(
          `Trial balance out of balance by ${totals.debits.minus(totals.credits).abs().toFixed(2)} PLN`
        );
      }

      // Check unacknowledged warnings
      const unacknowledgedWarnings = batch.items.filter(
        i => i.hasWarning && !i.warningAcknowledged
      );

      if (unacknowledgedWarnings.length > 0) {
        issues.push(
          `${unacknowledgedWarnings.length} unacknowledged warnings`
        );
      }

      // Check for zero balance batch
      if (batch.items.length === 0) {
        issues.push('No opening balance items');
      }

      // Update status if valid
      const newStatus = issues.length === 0 ? 'VALIDATED' : 'DRAFT';

      await ctx.db.openingBalanceBatches.update({
        where: { id: input.batchId },
        data: {
          status: newStatus,
          totalDebits: totals.debits.toNumber(),
          totalCredits: totals.credits.toNumber(),
        },
      });

      return {
        isValid: issues.length === 0,
        issues,
        totals: {
          debits: totals.debits.toNumber(),
          credits: totals.credits.toNumber(),
          difference: totals.debits.minus(totals.credits).abs().toNumber(),
        },
      };
    }),

  // Finalize batch - create journal entry
  finalizeBatch: protectedProcedure
    .input(FinalizeOpeningBalancesInput)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.session;

      const batch = await ctx.db.openingBalanceBatches.findFirst({
        where: {
          id: input.batchId,
          organizationId,
        },
        include: {
          items: {
            include: { account: true },
          },
          fiscalYear: true,
        },
      });

      if (!batch) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Batch not found',
        });
      }

      if (batch.status === 'FINALIZED') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Batch already finalized',
        });
      }

      // Validate balance unless forced
      const totals = batch.items.reduce(
        (acc, item) => ({
          debits: acc.debits.plus(item.baseDebitAmount || item.debitAmount),
          credits: acc.credits.plus(item.baseCreditAmount || item.creditAmount),
        }),
        { debits: new Decimal(0), credits: new Decimal(0) }
      );

      if (!totals.debits.equals(totals.credits) && !input.forceUnbalanced) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Trial balance out of balance by ${totals.debits.minus(totals.credits).abs().toFixed(2)}. Use forceUnbalanced=true to override.`,
        });
      }

      // Get opening period
      const openingPeriod = await ctx.db.accountingPeriods.findFirst({
        where: {
          fiscalYearId: batch.fiscalYearId,
          periodNumber: 1,
        },
      });

      if (!openingPeriod) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Opening period not found',
        });
      }

      // Create journal entry
      const result = await ctx.db.$transaction(async (tx) => {
        // Generate entry number
        const entryNumber = await generateEntryNumber(tx, organizationId, 'OB');

        // Create journal entry
        const journalEntry = await tx.journalEntries.create({
          data: {
            organizationId,
            periodId: openingPeriod.id,
            entryNumber,
            entryDate: batch.effectiveDate,
            description: input.entryDescription,
            entryType: 'OPENING',
            status: 'POSTED',
            postedAt: new Date(),
            postedBy: userId,
            lines: {
              create: batch.items
                .filter(item => item.debitAmount > 0 || item.creditAmount > 0)
                .map((item, index) => ({
                  lineNumber: index + 1,
                  accountId: item.accountId,
                  debitAmount: item.baseDebitAmount || item.debitAmount,
                  creditAmount: item.baseCreditAmount || item.creditAmount,
                  description: `Opening balance: ${item.account.accountName}`,
                  currency: item.currency,
                  exchangeRate: item.exchangeRate,
                })),
            },
          },
        });

        // Update account balances
        for (const item of batch.items) {
          if (item.debitAmount > 0 || item.creditAmount > 0) {
            await tx.accountBalances.upsert({
              where: {
                account_period_unique: {
                  accountId: item.accountId,
                  periodId: openingPeriod.id,
                },
              },
              create: {
                accountId: item.accountId,
                periodId: openingPeriod.id,
                openingBalance: new Decimal(item.baseDebitAmount || item.debitAmount)
                  .minus(item.baseCreditAmount || item.creditAmount),
                debitMovements: item.baseDebitAmount || item.debitAmount,
                creditMovements: item.baseCreditAmount || item.creditAmount,
                closingBalance: new Decimal(item.baseDebitAmount || item.debitAmount)
                  .minus(item.baseCreditAmount || item.creditAmount),
              },
              update: {
                openingBalance: new Decimal(item.baseDebitAmount || item.debitAmount)
                  .minus(item.baseCreditAmount || item.creditAmount),
                debitMovements: { increment: item.baseDebitAmount || item.debitAmount },
                creditMovements: { increment: item.baseCreditAmount || item.creditAmount },
              },
            });
          }
        }

        // Update batch
        const finalizedBatch = await tx.openingBalanceBatches.update({
          where: { id: input.batchId },
          data: {
            status: 'FINALIZED',
            journalEntryId: journalEntry.id,
            finalizedAt: new Date(),
            finalizedBy: userId,
          },
        });

        // Audit log
        await tx.auditLogs.create({
          data: {
            organizationId,
            userId,
            action: 'OPENING_BALANCES_FINALIZED',
            entityType: 'OPENING_BALANCE_BATCH',
            entityId: input.batchId,
            newValues: {
              journalEntryId: journalEntry.id,
              totalDebits: totals.debits.toString(),
              totalCredits: totals.credits.toString(),
            },
          },
        });

        return {
          batch: finalizedBatch,
          journalEntry,
        };
      });

      return result;
    }),

  // List batches
  listBatches: protectedProcedure
    .input(z.object({
      fiscalYearId: z.string().uuid().optional(),
      status: BatchStatusEnum.optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      const where: any = { organizationId };

      if (input.fiscalYearId) {
        where.fiscalYearId = input.fiscalYearId;
      }
      if (input.status) {
        where.status = input.status;
      }

      const batches = await ctx.db.openingBalanceBatches.findMany({
        where,
        include: {
          fiscalYear: true,
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return batches.map(b => ({
        ...b,
        itemCount: b._count.items,
        isBalanced: new Decimal(b.totalDebits).equals(b.totalCredits),
        difference: new Decimal(b.totalDebits).minus(b.totalCredits).abs().toNumber(),
      }));
    }),
});

// Helper: Update batch totals
async function updateBatchTotals(db: any, batchId: string): Promise<void> {
  const items = await db.openingBalanceItems.findMany({
    where: { batchId },
  });

  const totals = items.reduce(
    (acc: any, item: any) => ({
      debits: acc.debits.plus(item.baseDebitAmount || item.debitAmount),
      credits: acc.credits.plus(item.baseCreditAmount || item.creditAmount),
    }),
    { debits: new Decimal(0), credits: new Decimal(0) }
  );

  await db.openingBalanceBatches.update({
    where: { id: batchId },
    data: {
      totalDebits: totals.debits.toNumber(),
      totalCredits: totals.credits.toNumber(),
    },
  });
}
```

---

## Test Specifications

### Unit Tests

```typescript
describe('Opening Balances', () => {
  describe('Balance validation', () => {
    it('should detect unbalanced trial balance', () => {
      const items = [
        { debitAmount: 10000, creditAmount: 0 },
        { debitAmount: 5000, creditAmount: 0 },
        { debitAmount: 0, creditAmount: 12000 },
      ];

      const debits = items.reduce((sum, i) => sum + i.debitAmount, 0);
      const credits = items.reduce((sum, i) => sum + i.creditAmount, 0);

      expect(debits).toBe(15000);
      expect(credits).toBe(12000);
      expect(debits - credits).toBe(3000);
    });

    it('should detect normal balance warnings', () => {
      const account = { normalBalance: 'DEBIT' };
      const item = { debitAmount: 0, creditAmount: 5000 };

      const isDebit = item.debitAmount > 0;
      const expectedDebit = account.normalBalance === 'DEBIT';

      expect(isDebit !== expectedDebit).toBe(true);
    });
  });

  describe('Multi-currency handling', () => {
    it('should convert to base currency', () => {
      const debit = new Decimal(1000); // EUR
      const exchangeRate = new Decimal(4.35); // PLN/EUR

      const baseCurrencyAmount = debit.times(exchangeRate);

      expect(baseCurrencyAmount.toNumber()).toBe(4350);
    });
  });
});
```

### Integration Tests

```typescript
describe('Opening Balance Router', () => {
  describe('createBatch', () => {
    it('should create opening balance batch', async () => {
      const batch = await caller.openingBalance.createBatch({
        fiscalYearId,
        batchName: 'Initial Opening Balances',
        effectiveDate: new Date('2024-01-01'),
      });

      expect(batch.status).toBe('DRAFT');
      expect(batch.batchName).toBe('Initial Opening Balances');
    });

    it('should prevent duplicate finalized batches', async () => {
      await finalizeBatch(batch1Id);

      await expect(
        caller.openingBalance.createBatch({
          fiscalYearId,
          batchName: 'Second Batch',
          effectiveDate: new Date('2024-01-01'),
        })
      ).rejects.toThrow('already finalized');
    });
  });

  describe('addItems', () => {
    it('should add items with validation', async () => {
      const result = await caller.openingBalance.addItems({
        batchId,
        items: [
          { accountId: cashAccountId, debitAmount: 10000, creditAmount: 0 },
          { accountId: equityAccountId, debitAmount: 0, creditAmount: 10000 },
        ],
      });

      expect(result.created).toBe(2);
    });

    it('should flag abnormal balance warnings', async () => {
      // Cash account (debit normal) with credit balance
      await caller.openingBalance.addItems({
        batchId,
        items: [
          { accountId: cashAccountId, debitAmount: 0, creditAmount: 5000 },
        ],
      });

      const batch = await caller.openingBalance.getBatch({ batchId });
      const cashItem = batch.items.find(i => i.accountId === cashAccountId);

      expect(cashItem.hasWarning).toBe(true);
      expect(cashItem.warningMessage).toContain('Credit balance on debit-normal account');
    });
  });

  describe('finalizeBatch', () => {
    it('should create journal entry on finalize', async () => {
      // Add balanced items
      await addBalancedItems(batchId);
      await caller.openingBalance.validateBatch({ batchId });

      const result = await caller.openingBalance.finalizeBatch({
        batchId,
        entryDescription: 'Opening balances 2024',
      });

      expect(result.journalEntry).toBeDefined();
      expect(result.journalEntry.entryType).toBe('OPENING');
      expect(result.batch.status).toBe('FINALIZED');
    });

    it('should reject unbalanced batch without force', async () => {
      await addUnbalancedItems(batchId);

      await expect(
        caller.openingBalance.finalizeBatch({
          batchId,
          forceUnbalanced: false,
        })
      ).rejects.toThrow('out of balance');
    });
  });
});
```

---

## Security Checklist

- [x] Organization isolation via RLS
- [x] Validate account ownership before adding items
- [x] Audit log for all finalization actions
- [x] Prevent modification after finalization
- [x] Currency conversion uses Decimal.js

---

## Audit Events

```typescript
const OPENING_BALANCE_AUDIT_EVENTS = {
  BATCH_CREATED: 'opening_balance.batch_created',
  ITEMS_ADDED: 'opening_balance.items_added',
  ITEMS_IMPORTED: 'opening_balance.items_imported',
  BATCH_VALIDATED: 'opening_balance.batch_validated',
  BATCH_FINALIZED: 'opening_balance.batch_finalized',
  WARNING_ACKNOWLEDGED: 'opening_balance.warning_acknowledged',
};
```

---

## Tasks

- [ ] Create database migrations
- [ ] Implement batch CRUD operations
- [ ] Build validation logic
- [ ] Create Excel/CSV import parser
- [ ] Implement journal entry creation
- [ ] Add multi-currency support
- [ ] Create UI for opening balance entry
- [ ] Write tests

---

*Last updated: December 2024*
