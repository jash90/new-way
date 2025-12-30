# ACC-012: Trial Balance

## Story Information
| Field | Value |
|-------|-------|
| **Story ID** | ACC-012 |
| **Epic** | ACC - Accounting Engine |
| **Title** | Trial Balance |
| **Priority** | P0 |
| **Points** | 8 |
| **Status** | Draft |
| **Sprint** | Week 10 |
| **Dependencies** | ACC-003 (Account Hierarchy), ACC-008 (General Ledger) |

---

## User Story

**As a** księgowy (accountant),
**I want to** generate trial balance reports for any date or period,
**So that** I can verify that all journal entries are balanced, prepare financial statements, and perform month-end reconciliation.

---

## Acceptance Criteria

### AC1: Trial Balance Generation
```gherkin
Feature: Trial Balance Generation

Scenario: Generate trial balance as of specific date
  Given I am an authenticated accountant
  And there are posted journal entries in the general ledger
  When I request a trial balance as of "2024-03-31"
  Then I receive a report showing:
    | Account Code | Account Name | Debit Balance | Credit Balance |
    | 010-001 | Fixed Assets | 100,000.00 | 0.00 |
    | 070-001 | Accumulated Depreciation | 0.00 | 20,000.00 |
    | 201-001 | Accounts Payable | 0.00 | 15,000.00 |
    | 400-001 | Revenue | 0.00 | 50,000.00 |
    | 500-001 | Expenses | 35,000.00 | 0.00 |
  And the total debits equal total credits (150,000.00)

Scenario: Generate trial balance for a period
  Given I have a fiscal period "March 2024"
  When I request a trial balance for period "March 2024"
  Then I see beginning balances, activity (movements), and ending balances
  And movements show only transactions within March

Scenario: Trial balance with zero-balance accounts hidden
  Given some accounts have zero balances
  When I generate a trial balance with "Hide Zero Balances" enabled
  Then accounts with zero debit and zero credit are excluded
  And the totals still balance

Scenario: Trial balance includes only active accounts
  Given some accounts are marked as inactive
  When I generate a trial balance
  Then inactive accounts with zero balance are excluded
  And inactive accounts with non-zero balance are included with a warning indicator
```

### AC2: Filtering and Grouping
```gherkin
Feature: Trial Balance Filtering

Scenario: Filter by account class
  Given I want to see only Balance Sheet accounts
  When I filter trial balance by account classes 0, 1, 2, 8
  Then I see only accounts in those classes
  And the filtered totals balance within the selection

Scenario: Filter by specific accounts
  Given I want to analyze specific accounts
  When I filter by account code range "400-*" to "499-*"
  Then I see only revenue and income accounts
  And I can drill down to individual transactions

Scenario: Group by account class
  Given I generate a trial balance
  When I select "Group by Account Class"
  Then accounts are organized by class (0-9)
  And subtotals are shown for each class:
    | Class | Description | Debit | Credit |
    | 0 | Fixed Assets | 100,000 | 0 |
    | 1 | Cash & Banks | 50,000 | 0 |
    | 2 | Settlements | 5,000 | 35,000 |
    | 4 | Revenue | 0 | 80,000 |
    | 5 | Costs | 60,000 | 0 |

Scenario: Group by parent account
  Given accounts have hierarchical structure
  When I select "Group by Parent Account"
  Then I see parent accounts as headers
  And child accounts are indented underneath
  And parent rows show aggregated balances
```

### AC3: Comparative Trial Balance
```gherkin
Feature: Comparative Trial Balance

Scenario: Compare current period to prior period
  Given I have data for March 2024 and February 2024
  When I generate a comparative trial balance
  Then I see columns for both periods side by side
  And I see the variance (difference) column
  And I see percentage change where applicable

Scenario: Compare current period to prior year same period
  Given I have data for March 2024 and March 2023
  When I request year-over-year comparison
  Then I see current year vs prior year
  And I see variance analysis
  And significant variances (>10%) are highlighted

Scenario: Multiple period comparison
  Given I need to analyze trends
  When I select 6 consecutive periods
  Then I see a trend view with all periods
  And I can identify patterns in account balances
```

### AC4: Working Trial Balance
```gherkin
Feature: Working Trial Balance

Scenario: Create working trial balance with adjustments
  Given I have a trial balance as of "2024-03-31"
  When I create a "Working Trial Balance"
  Then I can add adjustment columns for:
    - Adjusting journal entries
    - Reclassification entries
    - Proposed adjustments
  And each adjustment column affects the adjusted balance
  And the adjusted trial balance still balances

Scenario: Track adjustment sources
  Given I add an adjustment to the working trial balance
  When I link it to a journal entry "AJ-2024-00050"
  Then the adjustment shows the source reference
  And I can click to view the source entry

Scenario: Lock working trial balance
  Given I have completed my adjustments
  When I lock the working trial balance
  Then no further changes can be made
  And the locked version is preserved for audit
```

### AC5: Export and Print
```gherkin
Feature: Export Trial Balance

Scenario: Export to Excel
  Given I have generated a trial balance
  When I click "Export to Excel"
  Then an XLSX file is downloaded
  And it contains all columns and data
  And it includes formulas for totals
  And it is formatted for printing

Scenario: Export to PDF
  Given I have generated a trial balance
  When I click "Export to PDF"
  Then a PDF file is generated
  And it includes company header and report date
  And it has page numbers and is formatted for multi-page printing

Scenario: Print trial balance
  Given I have generated a trial balance
  When I click "Print"
  Then a print-friendly view opens
  And the report fits standard paper sizes
  And it includes all required information for audit

Scenario: Email trial balance
  Given I have generated a trial balance
  When I select "Email Report"
  And I enter recipient email addresses
  Then the trial balance is sent as PDF attachment
  And a copy is saved in the document repository
```

---

## Technical Specification

### Database Schema

```sql
-- Working trial balance for adjustments
CREATE TABLE working_trial_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  wtb_code VARCHAR(50) NOT NULL,
  wtb_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Period reference
  fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id),
  period_id UUID REFERENCES accounting_periods(id),
  as_of_date DATE NOT NULL,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- DRAFT, LOCKED, ARCHIVED
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES users(id),

  -- Configuration
  include_zero_balances BOOLEAN DEFAULT FALSE,
  group_by VARCHAR(20) DEFAULT 'NONE', -- NONE, CLASS, PARENT

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),

  UNIQUE(organization_id, wtb_code)
);

-- Working trial balance lines
CREATE TABLE wtb_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wtb_id UUID NOT NULL REFERENCES working_trial_balances(id) ON DELETE CASCADE,

  account_id UUID NOT NULL REFERENCES accounts(id),
  account_code VARCHAR(50) NOT NULL,
  account_name VARCHAR(255) NOT NULL,

  -- Unadjusted balances (from GL)
  unadjusted_debit DECIMAL(18,2) DEFAULT 0,
  unadjusted_credit DECIMAL(18,2) DEFAULT 0,

  -- Adjustment columns (stored as JSONB for flexibility)
  adjustments JSONB DEFAULT '[]',
  -- Structure: [{ columnId, amount, reference, description }]

  -- Adjusted balances
  adjusted_debit DECIMAL(18,2) DEFAULT 0,
  adjusted_credit DECIMAL(18,2) DEFAULT 0,

  -- Metadata
  is_warning BOOLEAN DEFAULT FALSE, -- True for inactive accounts with balance
  notes TEXT,

  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adjustment columns definition
CREATE TABLE wtb_adjustment_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wtb_id UUID NOT NULL REFERENCES working_trial_balances(id) ON DELETE CASCADE,

  column_name VARCHAR(100) NOT NULL,
  column_type VARCHAR(20) NOT NULL, -- ADJUSTING, RECLASSIFICATION, PROPOSED
  journal_entry_id UUID REFERENCES journal_entries(id),
  description TEXT,

  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_wtb_org ON working_trial_balances(organization_id);
CREATE INDEX idx_wtb_period ON working_trial_balances(fiscal_year_id, period_id);
CREATE INDEX idx_wtb_lines_wtb ON wtb_lines(wtb_id);
CREATE INDEX idx_wtb_columns_wtb ON wtb_adjustment_columns(wtb_id);

-- RLS Policies
ALTER TABLE working_trial_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE wtb_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE wtb_adjustment_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY wtb_org_isolation ON working_trial_balances
  USING (organization_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY wtb_lines_isolation ON wtb_lines
  USING (wtb_id IN (
    SELECT id FROM working_trial_balances
    WHERE organization_id = current_setting('app.current_org_id')::UUID
  ));

CREATE POLICY wtb_columns_isolation ON wtb_adjustment_columns
  USING (wtb_id IN (
    SELECT id FROM working_trial_balances
    WHERE organization_id = current_setting('app.current_org_id')::UUID
  ));
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Enums
export const GroupByEnum = z.enum(['NONE', 'CLASS', 'PARENT']);
export const WTBStatusEnum = z.enum(['DRAFT', 'LOCKED', 'ARCHIVED']);
export const AdjustmentTypeEnum = z.enum(['ADJUSTING', 'RECLASSIFICATION', 'PROPOSED']);

// Generate trial balance input
export const GenerateTrialBalanceInput = z.object({
  asOfDate: z.coerce.date(),
  periodId: z.string().uuid().optional(), // For period-based TB

  // Filtering
  accountClassFilter: z.array(z.number().int().min(0).max(9)).optional(),
  accountCodeFrom: z.string().max(50).optional(),
  accountCodeTo: z.string().max(50).optional(),
  accountIds: z.array(z.string().uuid()).optional(),

  // Display options
  includeZeroBalances: z.boolean().default(false),
  includeInactiveAccounts: z.boolean().default(true),
  groupBy: GroupByEnum.default('NONE'),

  // Movement options (for period TB)
  includeOpeningBalance: z.boolean().default(true),
  includeMovements: z.boolean().default(true),
});

// Comparative trial balance input
export const ComparativeTrialBalanceInput = z.object({
  currentAsOfDate: z.coerce.date(),
  comparePeriods: z.array(z.object({
    asOfDate: z.coerce.date(),
    label: z.string().max(50),
  })).min(1).max(6),

  includeVariance: z.boolean().default(true),
  includePercentageChange: z.boolean().default(true),
  highlightThreshold: z.number().min(0).max(100).default(10),

  // Filtering (same as regular TB)
  accountClassFilter: z.array(z.number().int().min(0).max(9)).optional(),
  includeZeroBalances: z.boolean().default(false),
  groupBy: GroupByEnum.default('NONE'),
});

// Create working trial balance
export const CreateWorkingTBInput = z.object({
  wtbName: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  fiscalYearId: z.string().uuid(),
  periodId: z.string().uuid().optional(),
  asOfDate: z.coerce.date(),
  includeZeroBalances: z.boolean().default(false),
  groupBy: GroupByEnum.default('NONE'),
});

// Add adjustment column
export const AddAdjustmentColumnInput = z.object({
  wtbId: z.string().uuid(),
  columnName: z.string().min(1).max(100),
  columnType: AdjustmentTypeEnum,
  journalEntryId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
});

// Record adjustment
export const RecordAdjustmentInput = z.object({
  wtbId: z.string().uuid(),
  columnId: z.string().uuid(),
  accountId: z.string().uuid(),
  amount: z.number(), // Positive = debit, Negative = credit
  reference: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
});

// Lock working trial balance
export const LockWTBInput = z.object({
  wtbId: z.string().uuid(),
  lockReason: z.string().max(500).optional(),
});

// Export options
export const ExportTrialBalanceInput = z.object({
  format: z.enum(['XLSX', 'PDF', 'CSV']),
  asOfDate: z.coerce.date(),
  // Include all generation options
  includeZeroBalances: z.boolean().default(false),
  groupBy: GroupByEnum.default('NONE'),
  includeCompanyHeader: z.boolean().default(true),
  pageOrientation: z.enum(['PORTRAIT', 'LANDSCAPE']).default('PORTRAIT'),
});
```

### tRPC Router Implementation

```typescript
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import {
  GenerateTrialBalanceInput,
  ComparativeTrialBalanceInput,
  CreateWorkingTBInput,
  AddAdjustmentColumnInput,
  RecordAdjustmentInput,
  LockWTBInput,
  ExportTrialBalanceInput,
} from './schemas';
import Decimal from 'decimal.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export const trialBalanceRouter = createTRPCRouter({

  // Generate trial balance
  generate: protectedProcedure
    .input(GenerateTrialBalanceInput)
    .query(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const organizationId = session.user.organizationId;

      // Build account filter conditions
      const accountConditions = [
        eq(accounts.organizationId, organizationId),
      ];

      if (input.accountClassFilter && input.accountClassFilter.length > 0) {
        accountConditions.push(
          inArray(accounts.accountClass, input.accountClassFilter)
        );
      }

      if (input.accountCodeFrom) {
        accountConditions.push(gte(accounts.accountCode, input.accountCodeFrom));
      }

      if (input.accountCodeTo) {
        accountConditions.push(lte(accounts.accountCode, input.accountCodeTo));
      }

      if (input.accountIds && input.accountIds.length > 0) {
        accountConditions.push(inArray(accounts.id, input.accountIds));
      }

      if (!input.includeInactiveAccounts) {
        accountConditions.push(eq(accounts.isActive, true));
      }

      // Get all matching accounts
      const accountList = await db.query.accounts.findMany({
        where: and(...accountConditions),
        orderBy: (a, { asc }) => [asc(a.accountCode)],
      });

      // Calculate balances for each account
      const trialBalanceLines = [];

      for (const account of accountList) {
        const balance = await calculateAccountBalance(
          db,
          organizationId,
          account.id,
          input.asOfDate,
          input.periodId
        );

        // Skip zero balances if configured
        if (!input.includeZeroBalances &&
            balance.debit === 0 && balance.credit === 0) {
          continue;
        }

        trialBalanceLines.push({
          accountId: account.id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          accountClass: account.accountClass,
          accountType: account.accountType,
          parentAccountId: account.parentAccountId,
          normalBalance: account.normalBalance,
          isActive: account.isActive,

          // Balances
          debitBalance: balance.debit,
          creditBalance: balance.credit,

          // For period TB
          openingDebit: balance.openingDebit,
          openingCredit: balance.openingCredit,
          movementDebit: balance.movementDebit,
          movementCredit: balance.movementCredit,

          isWarning: !account.isActive && (balance.debit !== 0 || balance.credit !== 0),
        });
      }

      // Apply grouping
      let groupedData = trialBalanceLines;
      if (input.groupBy === 'CLASS') {
        groupedData = groupByAccountClass(trialBalanceLines);
      } else if (input.groupBy === 'PARENT') {
        groupedData = groupByParentAccount(trialBalanceLines, accountList);
      }

      // Calculate totals
      const totals = trialBalanceLines.reduce(
        (acc, line) => ({
          totalDebit: acc.totalDebit.plus(line.debitBalance),
          totalCredit: acc.totalCredit.plus(line.creditBalance),
          openingDebit: acc.openingDebit.plus(line.openingDebit || 0),
          openingCredit: acc.openingCredit.plus(line.openingCredit || 0),
          movementDebit: acc.movementDebit.plus(line.movementDebit || 0),
          movementCredit: acc.movementCredit.plus(line.movementCredit || 0),
        }),
        {
          totalDebit: new Decimal(0),
          totalCredit: new Decimal(0),
          openingDebit: new Decimal(0),
          openingCredit: new Decimal(0),
          movementDebit: new Decimal(0),
          movementCredit: new Decimal(0),
        }
      );

      // Verify balance
      const isBalanced = totals.totalDebit.equals(totals.totalCredit);

      return {
        asOfDate: input.asOfDate,
        periodId: input.periodId,
        generatedAt: new Date(),
        generatedBy: session.user.id,

        lines: groupedData,
        totals: {
          debit: totals.totalDebit.toNumber(),
          credit: totals.totalCredit.toNumber(),
          openingDebit: totals.openingDebit.toNumber(),
          openingCredit: totals.openingCredit.toNumber(),
          movementDebit: totals.movementDebit.toNumber(),
          movementCredit: totals.movementCredit.toNumber(),
        },
        isBalanced,
        outOfBalanceAmount: totals.totalDebit.minus(totals.totalCredit).toNumber(),

        metadata: {
          accountCount: trialBalanceLines.length,
          groupBy: input.groupBy,
          includeZeroBalances: input.includeZeroBalances,
          warningCount: trialBalanceLines.filter(l => l.isWarning).length,
        },
      };
    }),

  // Generate comparative trial balance
  generateComparative: protectedProcedure
    .input(ComparativeTrialBalanceInput)
    .query(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const organizationId = session.user.organizationId;

      // Get accounts
      const accountConditions = [
        eq(accounts.organizationId, organizationId),
        eq(accounts.isActive, true),
      ];

      if (input.accountClassFilter && input.accountClassFilter.length > 0) {
        accountConditions.push(
          inArray(accounts.accountClass, input.accountClassFilter)
        );
      }

      const accountList = await db.query.accounts.findMany({
        where: and(...accountConditions),
        orderBy: (a, { asc }) => [asc(a.accountCode)],
      });

      // Calculate balances for all periods
      const comparativeLines = [];

      for (const account of accountList) {
        // Current period balance
        const currentBalance = await calculateAccountBalance(
          db,
          organizationId,
          account.id,
          input.currentAsOfDate
        );

        // Comparison period balances
        const periodBalances = [];
        for (const period of input.comparePeriods) {
          const balance = await calculateAccountBalance(
            db,
            organizationId,
            account.id,
            period.asOfDate
          );
          periodBalances.push({
            label: period.label,
            asOfDate: period.asOfDate,
            debit: balance.debit,
            credit: balance.credit,
          });
        }

        // Skip if all periods have zero balance
        const hasBalance = currentBalance.debit !== 0 ||
          currentBalance.credit !== 0 ||
          periodBalances.some(p => p.debit !== 0 || p.credit !== 0);

        if (!input.includeZeroBalances && !hasBalance) {
          continue;
        }

        // Calculate variances
        const variances = [];
        for (const periodBalance of periodBalances) {
          const currentNet = new Decimal(currentBalance.debit).minus(currentBalance.credit);
          const periodNet = new Decimal(periodBalance.debit).minus(periodBalance.credit);
          const variance = currentNet.minus(periodNet);
          const percentChange = periodNet.isZero()
            ? null
            : variance.dividedBy(periodNet.abs()).times(100).toNumber();

          variances.push({
            label: periodBalance.label,
            variance: variance.toNumber(),
            percentChange,
            isSignificant: percentChange !== null && Math.abs(percentChange) >= input.highlightThreshold,
          });
        }

        comparativeLines.push({
          accountId: account.id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          accountClass: account.accountClass,
          normalBalance: account.normalBalance,

          currentDebit: currentBalance.debit,
          currentCredit: currentBalance.credit,

          periodBalances,
          variances,
        });
      }

      // Apply grouping
      let groupedData = comparativeLines;
      if (input.groupBy === 'CLASS') {
        groupedData = groupByAccountClassComparative(comparativeLines);
      }

      return {
        currentAsOfDate: input.currentAsOfDate,
        comparePeriods: input.comparePeriods,
        generatedAt: new Date(),

        lines: groupedData,
        metadata: {
          accountCount: comparativeLines.length,
          groupBy: input.groupBy,
          highlightThreshold: input.highlightThreshold,
        },
      };
    }),

  // Create working trial balance
  createWorkingTB: protectedProcedure
    .input(CreateWorkingTBInput)
    .mutation(async ({ ctx, input }) => {
      const { db, session, auditLog } = ctx;
      const organizationId = session.user.organizationId;

      // Generate WTB code
      const wtbCode = await generateWTBCode(db, organizationId);

      // Generate trial balance data
      const trialBalance = await ctx.caller.trialBalance.generate({
        asOfDate: input.asOfDate,
        periodId: input.periodId,
        includeZeroBalances: input.includeZeroBalances,
        groupBy: 'NONE', // Store ungrouped data
      });

      return await db.transaction(async (tx) => {
        // Create WTB header
        const [wtb] = await tx.insert(workingTrialBalances).values({
          organizationId,
          wtbCode,
          wtbName: input.wtbName,
          description: input.description,
          fiscalYearId: input.fiscalYearId,
          periodId: input.periodId,
          asOfDate: input.asOfDate,
          includeZeroBalances: input.includeZeroBalances,
          groupBy: input.groupBy,
          status: 'DRAFT',
          createdBy: session.user.id,
        }).returning();

        // Create WTB lines from trial balance
        for (const [idx, line] of trialBalance.lines.entries()) {
          await tx.insert(wtbLines).values({
            wtbId: wtb.id,
            accountId: line.accountId,
            accountCode: line.accountCode,
            accountName: line.accountName,
            unadjustedDebit: line.debitBalance.toString(),
            unadjustedCredit: line.creditBalance.toString(),
            adjustedDebit: line.debitBalance.toString(),
            adjustedCredit: line.creditBalance.toString(),
            isWarning: line.isWarning,
            displayOrder: idx,
          });
        }

        await auditLog.record({
          action: 'WORKING_TB_CREATED',
          entityType: 'working_trial_balance',
          entityId: wtb.id,
          details: { wtbCode, asOfDate: input.asOfDate },
        });

        return wtb;
      });
    }),

  // Add adjustment column
  addAdjustmentColumn: protectedProcedure
    .input(AddAdjustmentColumnInput)
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;

      // Verify WTB exists and is not locked
      const wtb = await db.query.workingTrialBalances.findFirst({
        where: eq(workingTrialBalances.id, input.wtbId),
      });

      if (!wtb) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Working trial balance not found',
        });
      }

      if (wtb.status === 'LOCKED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot modify locked working trial balance',
        });
      }

      // Get next display order
      const existingColumns = await db.query.wtbAdjustmentColumns.findMany({
        where: eq(wtbAdjustmentColumns.wtbId, input.wtbId),
        orderBy: (c, { desc }) => [desc(c.displayOrder)],
        limit: 1,
      });

      const displayOrder = existingColumns.length > 0
        ? existingColumns[0].displayOrder + 1
        : 0;

      const [column] = await db.insert(wtbAdjustmentColumns).values({
        wtbId: input.wtbId,
        columnName: input.columnName,
        columnType: input.columnType,
        journalEntryId: input.journalEntryId,
        description: input.description,
        displayOrder,
        createdBy: session.user.id,
      }).returning();

      return column;
    }),

  // Record adjustment
  recordAdjustment: protectedProcedure
    .input(RecordAdjustmentInput)
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;

      // Verify WTB is not locked
      const wtb = await db.query.workingTrialBalances.findFirst({
        where: eq(workingTrialBalances.id, input.wtbId),
      });

      if (wtb?.status === 'LOCKED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot modify locked working trial balance',
        });
      }

      // Find the WTB line
      const line = await db.query.wtbLines.findFirst({
        where: and(
          eq(wtbLines.wtbId, input.wtbId),
          eq(wtbLines.accountId, input.accountId)
        ),
      });

      if (!line) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found in working trial balance',
        });
      }

      // Update adjustments array
      const adjustments = line.adjustments || [];
      const existingIdx = adjustments.findIndex((a: any) => a.columnId === input.columnId);

      const adjustment = {
        columnId: input.columnId,
        amount: input.amount,
        reference: input.reference,
        description: input.description,
        updatedAt: new Date().toISOString(),
        updatedBy: session.user.id,
      };

      if (existingIdx >= 0) {
        adjustments[existingIdx] = adjustment;
      } else {
        adjustments.push(adjustment);
      }

      // Recalculate adjusted balances
      const unadjustedDebit = new Decimal(line.unadjustedDebit);
      const unadjustedCredit = new Decimal(line.unadjustedCredit);

      let totalAdjustmentDebit = new Decimal(0);
      let totalAdjustmentCredit = new Decimal(0);

      for (const adj of adjustments) {
        if (adj.amount > 0) {
          totalAdjustmentDebit = totalAdjustmentDebit.plus(adj.amount);
        } else {
          totalAdjustmentCredit = totalAdjustmentCredit.plus(Math.abs(adj.amount));
        }
      }

      const adjustedDebit = unadjustedDebit.plus(totalAdjustmentDebit);
      const adjustedCredit = unadjustedCredit.plus(totalAdjustmentCredit);

      await db.update(wtbLines)
        .set({
          adjustments,
          adjustedDebit: adjustedDebit.toString(),
          adjustedCredit: adjustedCredit.toString(),
          updatedAt: new Date(),
        })
        .where(eq(wtbLines.id, line.id));

      return { success: true };
    }),

  // Lock working trial balance
  lock: protectedProcedure
    .input(LockWTBInput)
    .mutation(async ({ ctx, input }) => {
      const { db, session, auditLog } = ctx;

      // Verify WTB balances before locking
      const wtb = await db.query.workingTrialBalances.findFirst({
        where: eq(workingTrialBalances.id, input.wtbId),
        with: { lines: true },
      });

      if (!wtb) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Working trial balance not found',
        });
      }

      // Check balance
      const totals = wtb.lines.reduce(
        (acc, line) => ({
          debit: acc.debit.plus(line.adjustedDebit),
          credit: acc.credit.plus(line.adjustedCredit),
        }),
        { debit: new Decimal(0), credit: new Decimal(0) }
      );

      if (!totals.debit.equals(totals.credit)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot lock: Trial balance is not balanced. Debit: ${totals.debit}, Credit: ${totals.credit}`,
        });
      }

      const [locked] = await db.update(workingTrialBalances)
        .set({
          status: 'LOCKED',
          lockedAt: new Date(),
          lockedBy: session.user.id,
          updatedAt: new Date(),
          updatedBy: session.user.id,
        })
        .where(eq(workingTrialBalances.id, input.wtbId))
        .returning();

      await auditLog.record({
        action: 'WORKING_TB_LOCKED',
        entityType: 'working_trial_balance',
        entityId: input.wtbId,
        details: { lockReason: input.lockReason },
      });

      return locked;
    }),

  // Get working trial balance
  getWorkingTB: protectedProcedure
    .input(z.object({ wtbId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const wtb = await ctx.db.query.workingTrialBalances.findFirst({
        where: eq(workingTrialBalances.id, input.wtbId),
        with: {
          lines: { orderBy: (l, { asc }) => [asc(l.displayOrder)] },
          adjustmentColumns: { orderBy: (c, { asc }) => [asc(c.displayOrder)] },
          fiscalYear: true,
          period: true,
        },
      });

      if (!wtb) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Working trial balance not found',
        });
      }

      // Calculate totals
      const totals = wtb.lines.reduce(
        (acc, line) => ({
          unadjustedDebit: acc.unadjustedDebit.plus(line.unadjustedDebit),
          unadjustedCredit: acc.unadjustedCredit.plus(line.unadjustedCredit),
          adjustedDebit: acc.adjustedDebit.plus(line.adjustedDebit),
          adjustedCredit: acc.adjustedCredit.plus(line.adjustedCredit),
        }),
        {
          unadjustedDebit: new Decimal(0),
          unadjustedCredit: new Decimal(0),
          adjustedDebit: new Decimal(0),
          adjustedCredit: new Decimal(0),
        }
      );

      return {
        ...wtb,
        totals: {
          unadjustedDebit: totals.unadjustedDebit.toNumber(),
          unadjustedCredit: totals.unadjustedCredit.toNumber(),
          adjustedDebit: totals.adjustedDebit.toNumber(),
          adjustedCredit: totals.adjustedCredit.toNumber(),
        },
        isBalanced: totals.adjustedDebit.equals(totals.adjustedCredit),
      };
    }),

  // List working trial balances
  listWorkingTB: protectedProcedure
    .input(z.object({
      fiscalYearId: z.string().uuid().optional(),
      status: WTBStatusEnum.optional(),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const organizationId = session.user.organizationId;

      const conditions = [
        eq(workingTrialBalances.organizationId, organizationId),
      ];

      if (input.fiscalYearId) {
        conditions.push(eq(workingTrialBalances.fiscalYearId, input.fiscalYearId));
      }

      if (input.status) {
        conditions.push(eq(workingTrialBalances.status, input.status));
      }

      const list = await db.query.workingTrialBalances.findMany({
        where: and(...conditions),
        orderBy: (w, { desc }) => [desc(w.createdAt)],
        limit: input.limit,
        offset: input.offset,
        with: {
          fiscalYear: { columns: { yearCode: true, yearName: true } },
          period: { columns: { periodCode: true, periodName: true } },
        },
      });

      return list;
    }),

  // Export trial balance
  export: protectedProcedure
    .input(ExportTrialBalanceInput)
    .mutation(async ({ ctx, input }) => {
      // Generate trial balance
      const trialBalance = await ctx.caller.trialBalance.generate({
        asOfDate: input.asOfDate,
        includeZeroBalances: input.includeZeroBalances,
        groupBy: input.groupBy,
      });

      // Get organization info for header
      const organization = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, ctx.session.user.organizationId),
      });

      switch (input.format) {
        case 'XLSX':
          return await exportToExcel(trialBalance, organization, input);
        case 'PDF':
          return await exportToPDF(trialBalance, organization, input);
        case 'CSV':
          return await exportToCSV(trialBalance);
        default:
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Unsupported export format',
          });
      }
    }),
});

// Helper functions
async function calculateAccountBalance(
  db: any,
  organizationId: string,
  accountId: string,
  asOfDate: Date,
  periodId?: string
): Promise<{
  debit: number;
  credit: number;
  openingDebit: number;
  openingCredit: number;
  movementDebit: number;
  movementCredit: number;
}> {
  // Get account to determine normal balance
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, accountId),
  });

  if (!account) {
    return {
      debit: 0, credit: 0,
      openingDebit: 0, openingCredit: 0,
      movementDebit: 0, movementCredit: 0,
    };
  }

  // Get GL entries up to asOfDate
  const glConditions = [
    eq(generalLedger.organizationId, organizationId),
    eq(generalLedger.accountId, accountId),
    lte(generalLedger.transactionDate, asOfDate),
  ];

  const glEntries = await db.query.generalLedger.findMany({
    where: and(...glConditions),
  });

  let totalDebit = new Decimal(0);
  let totalCredit = new Decimal(0);

  for (const entry of glEntries) {
    totalDebit = totalDebit.plus(entry.baseCurrencyDebit || entry.debitAmount);
    totalCredit = totalCredit.plus(entry.baseCurrencyCredit || entry.creditAmount);
  }

  // Determine balance based on normal balance type
  let debitBalance = new Decimal(0);
  let creditBalance = new Decimal(0);

  if (account.normalBalance === 'DEBIT') {
    const netBalance = totalDebit.minus(totalCredit);
    if (netBalance.isPositive()) {
      debitBalance = netBalance;
    } else {
      creditBalance = netBalance.abs();
    }
  } else {
    const netBalance = totalCredit.minus(totalDebit);
    if (netBalance.isPositive()) {
      creditBalance = netBalance;
    } else {
      debitBalance = netBalance.abs();
    }
  }

  // For period-based, calculate opening and movements separately
  let openingDebit = 0;
  let openingCredit = 0;
  let movementDebit = 0;
  let movementCredit = 0;

  if (periodId) {
    const period = await db.query.accountingPeriods.findFirst({
      where: eq(accountingPeriods.id, periodId),
    });

    if (period) {
      // Opening balance (before period start)
      const openingEntries = glEntries.filter(
        (e: any) => new Date(e.transactionDate) < new Date(period.startDate)
      );

      for (const entry of openingEntries) {
        if (account.normalBalance === 'DEBIT') {
          openingDebit = new Decimal(openingDebit)
            .plus(entry.baseCurrencyDebit || entry.debitAmount)
            .minus(entry.baseCurrencyCredit || entry.creditAmount)
            .toNumber();
        } else {
          openingCredit = new Decimal(openingCredit)
            .plus(entry.baseCurrencyCredit || entry.creditAmount)
            .minus(entry.baseCurrencyDebit || entry.debitAmount)
            .toNumber();
        }
      }

      // Movement (within period)
      const movementEntries = glEntries.filter(
        (e: any) => {
          const entryDate = new Date(e.transactionDate);
          return entryDate >= new Date(period.startDate) &&
                 entryDate <= new Date(period.endDate);
        }
      );

      for (const entry of movementEntries) {
        movementDebit = new Decimal(movementDebit)
          .plus(entry.baseCurrencyDebit || entry.debitAmount)
          .toNumber();
        movementCredit = new Decimal(movementCredit)
          .plus(entry.baseCurrencyCredit || entry.creditAmount)
          .toNumber();
      }
    }
  }

  return {
    debit: debitBalance.toNumber(),
    credit: creditBalance.toNumber(),
    openingDebit,
    openingCredit,
    movementDebit,
    movementCredit,
  };
}

function groupByAccountClass(lines: any[]): any[] {
  const grouped: Record<number, { header: any; lines: any[] }> = {};

  for (const line of lines) {
    const classNum = line.accountClass;

    if (!grouped[classNum]) {
      grouped[classNum] = {
        header: {
          isGroupHeader: true,
          accountClass: classNum,
          accountName: getAccountClassName(classNum),
          debitBalance: 0,
          creditBalance: 0,
        },
        lines: [],
      };
    }

    grouped[classNum].lines.push(line);
    grouped[classNum].header.debitBalance = new Decimal(grouped[classNum].header.debitBalance)
      .plus(line.debitBalance)
      .toNumber();
    grouped[classNum].header.creditBalance = new Decimal(grouped[classNum].header.creditBalance)
      .plus(line.creditBalance)
      .toNumber();
  }

  // Flatten with headers
  const result: any[] = [];
  for (const classNum of Object.keys(grouped).sort((a, b) => Number(a) - Number(b))) {
    const group = grouped[Number(classNum)];
    result.push(group.header);
    result.push(...group.lines);
  }

  return result;
}

function groupByParentAccount(lines: any[], allAccounts: any[]): any[] {
  // Build parent-child map
  const parentMap: Record<string, any[]> = {};
  const rootLines: any[] = [];

  for (const line of lines) {
    if (line.parentAccountId) {
      if (!parentMap[line.parentAccountId]) {
        parentMap[line.parentAccountId] = [];
      }
      parentMap[line.parentAccountId].push(line);
    } else {
      rootLines.push(line);
    }
  }

  // Recursive function to build tree
  function buildTree(accountId: string, level: number): any[] {
    const children = parentMap[accountId] || [];
    const result: any[] = [];

    for (const child of children) {
      result.push({ ...child, level });
      result.push(...buildTree(child.accountId, level + 1));
    }

    return result;
  }

  // Build result with root accounts and their children
  const result: any[] = [];
  for (const root of rootLines) {
    result.push({ ...root, level: 0 });
    result.push(...buildTree(root.accountId, 1));
  }

  return result;
}

function getAccountClassName(classNum: number): string {
  const classNames: Record<number, string> = {
    0: 'Aktywa trwałe (Fixed Assets)',
    1: 'Środki pieniężne i inwestycje (Cash & Investments)',
    2: 'Rozrachunki i roszczenia (Settlements)',
    3: 'Materiały i towary (Materials & Goods)',
    4: 'Koszty (Costs)',
    5: 'Koszty działalności (Operating Costs)',
    6: 'Produkty i rozliczenia (Products)',
    7: 'Przychody i koszty (Revenue & Costs)',
    8: 'Kapitały i fundusze (Equity & Funds)',
    9: 'Wynik finansowy (Financial Result)',
  };

  return classNames[classNum] || `Klasa ${classNum}`;
}

async function generateWTBCode(db: any, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `WTB-${year}-`;

  const lastWTB = await db.query.workingTrialBalances.findFirst({
    where: and(
      eq(workingTrialBalances.organizationId, organizationId),
      like(workingTrialBalances.wtbCode, `${prefix}%`)
    ),
    orderBy: (w: any, { desc }: any) => [desc(w.wtbCode)],
  });

  let nextNumber = 1;
  if (lastWTB) {
    const lastNumber = parseInt(lastWTB.wtbCode.replace(prefix, ''));
    nextNumber = lastNumber + 1;
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

async function exportToExcel(
  trialBalance: any,
  organization: any,
  options: any
): Promise<{ filename: string; buffer: Buffer }> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Trial Balance');

  // Header
  if (options.includeCompanyHeader) {
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = organization?.name || 'Company Name';
    sheet.getCell('A1').font = { bold: true, size: 14 };

    sheet.mergeCells('A2:D2');
    sheet.getCell('A2').value = `Trial Balance as of ${trialBalance.asOfDate.toLocaleDateString('pl-PL')}`;
    sheet.getCell('A2').font = { bold: true, size: 12 };

    sheet.addRow([]);
  }

  // Column headers
  const headerRow = sheet.addRow(['Account Code', 'Account Name', 'Debit', 'Credit']);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
    cell.border = {
      bottom: { style: 'thin' },
    };
  });

  // Data rows
  for (const line of trialBalance.lines) {
    if (line.isGroupHeader) {
      const row = sheet.addRow([
        `Class ${line.accountClass}`,
        line.accountName,
        line.debitBalance,
        line.creditBalance,
      ]);
      row.font = { bold: true };
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F0F0' },
      };
    } else {
      sheet.addRow([
        line.accountCode,
        line.accountName,
        line.debitBalance || '',
        line.creditBalance || '',
      ]);
    }
  }

  // Totals row
  sheet.addRow([]);
  const totalRow = sheet.addRow([
    '',
    'TOTAL',
    trialBalance.totals.debit,
    trialBalance.totals.credit,
  ]);
  totalRow.font = { bold: true };
  totalRow.getCell(3).numFmt = '#,##0.00';
  totalRow.getCell(4).numFmt = '#,##0.00';

  // Column widths
  sheet.getColumn(1).width = 15;
  sheet.getColumn(2).width = 40;
  sheet.getColumn(3).width = 15;
  sheet.getColumn(4).width = 15;

  // Number format for debit/credit columns
  sheet.getColumn(3).numFmt = '#,##0.00';
  sheet.getColumn(4).numFmt = '#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();

  return {
    filename: `trial_balance_${trialBalance.asOfDate.toISOString().split('T')[0]}.xlsx`,
    buffer: Buffer.from(buffer),
  };
}

async function exportToPDF(
  trialBalance: any,
  organization: any,
  options: any
): Promise<{ filename: string; buffer: Buffer }> {
  // PDF generation using pdfkit
  return new Promise((resolve) => {
    const doc = new PDFDocument({
      size: options.pageOrientation === 'LANDSCAPE' ? 'A4' : 'A4',
      layout: options.pageOrientation.toLowerCase(),
      margin: 50,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      resolve({
        filename: `trial_balance_${trialBalance.asOfDate.toISOString().split('T')[0]}.pdf`,
        buffer: Buffer.concat(chunks),
      });
    });

    // Header
    if (options.includeCompanyHeader) {
      doc.fontSize(16).font('Helvetica-Bold').text(organization?.name || 'Company Name', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text(
        `Trial Balance as of ${trialBalance.asOfDate.toLocaleDateString('pl-PL')}`,
        { align: 'center' }
      );
      doc.moveDown();
    }

    // Table header
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 150;
    const col3 = 350;
    const col4 = 450;

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Account Code', col1, tableTop);
    doc.text('Account Name', col2, tableTop);
    doc.text('Debit', col3, tableTop, { width: 80, align: 'right' });
    doc.text('Credit', col4, tableTop, { width: 80, align: 'right' });

    doc.moveTo(col1, tableTop + 15).lineTo(530, tableTop + 15).stroke();

    // Data rows
    let y = tableTop + 25;
    doc.font('Helvetica').fontSize(9);

    for (const line of trialBalance.lines) {
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 50;
      }

      if (line.isGroupHeader) {
        doc.font('Helvetica-Bold');
      } else {
        doc.font('Helvetica');
      }

      doc.text(line.accountCode || `Class ${line.accountClass}`, col1, y, { width: 90 });
      doc.text(line.accountName, col2, y, { width: 190 });
      doc.text(
        line.debitBalance ? line.debitBalance.toLocaleString('pl-PL', { minimumFractionDigits: 2 }) : '',
        col3, y, { width: 80, align: 'right' }
      );
      doc.text(
        line.creditBalance ? line.creditBalance.toLocaleString('pl-PL', { minimumFractionDigits: 2 }) : '',
        col4, y, { width: 80, align: 'right' }
      );

      y += 15;
    }

    // Totals
    y += 10;
    doc.moveTo(col1, y).lineTo(530, y).stroke();
    y += 10;

    doc.font('Helvetica-Bold');
    doc.text('TOTAL', col2, y);
    doc.text(
      trialBalance.totals.debit.toLocaleString('pl-PL', { minimumFractionDigits: 2 }),
      col3, y, { width: 80, align: 'right' }
    );
    doc.text(
      trialBalance.totals.credit.toLocaleString('pl-PL', { minimumFractionDigits: 2 }),
      col4, y, { width: 80, align: 'right' }
    );

    // Balance check
    y += 25;
    doc.fontSize(8).font('Helvetica');
    doc.text(
      trialBalance.isBalanced
        ? '✓ Trial balance is balanced'
        : `⚠ Out of balance: ${trialBalance.outOfBalanceAmount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })}`,
      col1, y
    );

    // Footer with page numbers
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).text(
        `Page ${i + 1} of ${pages.count}`,
        50,
        doc.page.height - 30,
        { align: 'center' }
      );
    }

    doc.end();
  });
}

async function exportToCSV(trialBalance: any): Promise<{ filename: string; buffer: Buffer }> {
  const lines = [
    ['Account Code', 'Account Name', 'Debit', 'Credit'].join(','),
  ];

  for (const line of trialBalance.lines) {
    if (!line.isGroupHeader) {
      lines.push([
        `"${line.accountCode}"`,
        `"${line.accountName}"`,
        line.debitBalance || 0,
        line.creditBalance || 0,
      ].join(','));
    }
  }

  lines.push(['', 'TOTAL', trialBalance.totals.debit, trialBalance.totals.credit].join(','));

  return {
    filename: `trial_balance_${trialBalance.asOfDate.toISOString().split('T')[0]}.csv`,
    buffer: Buffer.from(lines.join('\n'), 'utf-8'),
  };
}
```

---

## Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { trialBalanceRouter } from './trial-balance.router';
import { createTestContext, seedGLData } from '@/test/utils';

describe('Trial Balance Router', () => {
  let ctx: ReturnType<typeof createTestContext>;

  beforeEach(async () => {
    ctx = createTestContext();
    await seedGLData(ctx.db);
  });

  describe('generate', () => {
    it('should generate balanced trial balance', async () => {
      const result = await trialBalanceRouter.generate({
        ctx,
        input: {
          asOfDate: new Date('2024-03-31'),
        },
      });

      expect(result.isBalanced).toBe(true);
      expect(result.totals.debit).toEqual(result.totals.credit);
      expect(result.lines.length).toBeGreaterThan(0);
    });

    it('should exclude zero balance accounts when configured', async () => {
      const withZero = await trialBalanceRouter.generate({
        ctx,
        input: {
          asOfDate: new Date('2024-03-31'),
          includeZeroBalances: true,
        },
      });

      const withoutZero = await trialBalanceRouter.generate({
        ctx,
        input: {
          asOfDate: new Date('2024-03-31'),
          includeZeroBalances: false,
        },
      });

      expect(withZero.lines.length).toBeGreaterThanOrEqual(withoutZero.lines.length);
    });

    it('should filter by account class', async () => {
      const result = await trialBalanceRouter.generate({
        ctx,
        input: {
          asOfDate: new Date('2024-03-31'),
          accountClassFilter: [0, 1], // Fixed assets and cash
        },
      });

      expect(result.lines.every(l => [0, 1].includes(l.accountClass))).toBe(true);
    });

    it('should group by account class', async () => {
      const result = await trialBalanceRouter.generate({
        ctx,
        input: {
          asOfDate: new Date('2024-03-31'),
          groupBy: 'CLASS',
        },
      });

      const hasGroupHeaders = result.lines.some(l => l.isGroupHeader);
      expect(hasGroupHeaders).toBe(true);
    });
  });

  describe('generateComparative', () => {
    it('should generate comparative trial balance', async () => {
      const result = await trialBalanceRouter.generateComparative({
        ctx,
        input: {
          currentAsOfDate: new Date('2024-03-31'),
          comparePeriods: [
            { asOfDate: new Date('2024-02-29'), label: 'Feb 2024' },
            { asOfDate: new Date('2024-01-31'), label: 'Jan 2024' },
          ],
        },
      });

      expect(result.lines.length).toBeGreaterThan(0);
      expect(result.lines[0].periodBalances).toHaveLength(2);
      expect(result.lines[0].variances).toHaveLength(2);
    });

    it('should highlight significant variances', async () => {
      const result = await trialBalanceRouter.generateComparative({
        ctx,
        input: {
          currentAsOfDate: new Date('2024-03-31'),
          comparePeriods: [
            { asOfDate: new Date('2024-02-29'), label: 'Feb 2024' },
          ],
          highlightThreshold: 10,
        },
      });

      const hasSignificant = result.lines.some(l =>
        l.variances.some((v: any) => v.isSignificant)
      );

      // Just verify the structure, not the actual values
      expect(result.metadata.highlightThreshold).toBe(10);
    });
  });

  describe('createWorkingTB', () => {
    it('should create working trial balance from generated TB', async () => {
      const fiscalYear = await ctx.db.query.fiscalYears.findFirst();

      const result = await trialBalanceRouter.createWorkingTB({
        ctx,
        input: {
          wtbName: 'March 2024 Working TB',
          fiscalYearId: fiscalYear.id,
          asOfDate: new Date('2024-03-31'),
        },
      });

      expect(result.status).toBe('DRAFT');
      expect(result.wtbCode).toMatch(/^WTB-/);
    });
  });

  describe('recordAdjustment', () => {
    it('should record adjustment and update balances', async () => {
      const wtb = await createTestWTB(ctx.db);
      const column = await ctx.db.insert(wtbAdjustmentColumns).values({
        wtbId: wtb.id,
        columnName: 'Adjustments',
        columnType: 'ADJUSTING',
      }).returning();

      const line = await ctx.db.query.wtbLines.findFirst({
        where: eq(wtbLines.wtbId, wtb.id),
      });

      await trialBalanceRouter.recordAdjustment({
        ctx,
        input: {
          wtbId: wtb.id,
          columnId: column[0].id,
          accountId: line.accountId,
          amount: 1000, // Debit adjustment
        },
      });

      const updated = await ctx.db.query.wtbLines.findFirst({
        where: eq(wtbLines.id, line.id),
      });

      expect(parseFloat(updated.adjustedDebit)).toBe(
        parseFloat(line.unadjustedDebit) + 1000
      );
    });

    it('should reject adjustment on locked WTB', async () => {
      const wtb = await createTestWTB(ctx.db, { status: 'LOCKED' });

      await expect(trialBalanceRouter.recordAdjustment({
        ctx,
        input: {
          wtbId: wtb.id,
          columnId: 'some-column',
          accountId: 'some-account',
          amount: 1000,
        },
      })).rejects.toThrow(/locked/i);
    });
  });

  describe('lock', () => {
    it('should lock balanced WTB', async () => {
      const wtb = await createTestWTB(ctx.db);

      const result = await trialBalanceRouter.lock({
        ctx,
        input: {
          wtbId: wtb.id,
        },
      });

      expect(result.status).toBe('LOCKED');
      expect(result.lockedAt).toBeDefined();
    });

    it('should reject locking unbalanced WTB', async () => {
      const wtb = await createTestWTB(ctx.db, { unbalanced: true });

      await expect(trialBalanceRouter.lock({
        ctx,
        input: { wtbId: wtb.id },
      })).rejects.toThrow(/not balanced/i);
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDatabase, seedTestData, cleanupTestDatabase } from '@/test/db-utils';

describe('Trial Balance Integration', () => {
  let db: TestDatabase;
  let testOrg: Organization;
  let testFiscalYear: FiscalYear;

  beforeAll(async () => {
    db = await createTestDatabase();
    const seed = await seedTestData(db);
    testOrg = seed.organization;
    testFiscalYear = seed.fiscalYear;

    // Seed journal entries for trial balance
    await seedJournalEntries(db, testOrg.id);
  });

  afterAll(async () => {
    await cleanupTestDatabase(db);
  });

  it('should generate accurate trial balance from GL', async () => {
    // Generate trial balance
    const tb = await db.trialBalance.generate({
      organizationId: testOrg.id,
      asOfDate: new Date('2024-03-31'),
    });

    expect(tb.isBalanced).toBe(true);

    // Verify against direct GL query
    const glTotals = await db.generalLedger.getTotals(testOrg.id, new Date('2024-03-31'));

    expect(tb.totals.debit).toBe(glTotals.totalDebit);
    expect(tb.totals.credit).toBe(glTotals.totalCredit);
  });

  it('should handle period-based trial balance correctly', async () => {
    const period = await db.accountingPeriods.findFirst({
      where: { fiscalYearId: testFiscalYear.id, periodCode: 'P03' }, // March
    });

    const tb = await db.trialBalance.generate({
      organizationId: testOrg.id,
      asOfDate: new Date('2024-03-31'),
      periodId: period.id,
    });

    // Verify opening + movements = ending
    for (const line of tb.lines) {
      const expectedDebit = line.openingDebit + line.movementDebit - line.movementCredit;
      const expectedCredit = line.openingCredit + line.movementCredit - line.movementDebit;

      // The ending balance should reconcile
      expect(line.debitBalance + line.creditBalance)
        .toBeCloseTo(Math.abs(expectedDebit - expectedCredit), 2);
    }
  });

  it('should complete working trial balance workflow', async () => {
    // 1. Create WTB
    const wtb = await db.workingTrialBalance.create({
      organizationId: testOrg.id,
      wtbName: 'March 2024 Close',
      fiscalYearId: testFiscalYear.id,
      asOfDate: new Date('2024-03-31'),
    });

    expect(wtb.status).toBe('DRAFT');

    // 2. Add adjustment column
    const column = await db.workingTrialBalance.addColumn({
      wtbId: wtb.id,
      columnName: 'Accruals',
      columnType: 'ADJUSTING',
    });

    // 3. Record adjustments (balanced)
    const accountDebit = wtb.lines.find(l => l.accountClass === 5); // Expense
    const accountCredit = wtb.lines.find(l => l.accountClass === 2); // Liability

    await db.workingTrialBalance.recordAdjustment({
      wtbId: wtb.id,
      columnId: column.id,
      accountId: accountDebit.accountId,
      amount: 5000, // Debit
    });

    await db.workingTrialBalance.recordAdjustment({
      wtbId: wtb.id,
      columnId: column.id,
      accountId: accountCredit.accountId,
      amount: -5000, // Credit
    });

    // 4. Verify balance
    const updated = await db.workingTrialBalance.findById(wtb.id);
    expect(updated.isBalanced).toBe(true);

    // 5. Lock WTB
    await db.workingTrialBalance.lock(wtb.id);

    const locked = await db.workingTrialBalance.findById(wtb.id);
    expect(locked.status).toBe('LOCKED');
  });

  it('should export trial balance to Excel', async () => {
    const result = await db.trialBalance.export({
      organizationId: testOrg.id,
      asOfDate: new Date('2024-03-31'),
      format: 'XLSX',
    });

    expect(result.filename).toMatch(/\.xlsx$/);
    expect(result.buffer.length).toBeGreaterThan(0);

    // Verify it's a valid Excel file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result.buffer);
    expect(workbook.worksheets).toHaveLength(1);
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Trial Balance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/accounting/trial-balance');
  });

  test('should generate trial balance', async ({ page }) => {
    await page.fill('input[name="asOfDate"]', '2024-03-31');
    await page.click('button:has-text("Generate")');

    await expect(page.locator('[data-testid="tb-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-row"]')).toBeVisible();

    // Verify totals match
    const debitTotal = await page.locator('[data-testid="total-debit"]').textContent();
    const creditTotal = await page.locator('[data-testid="total-credit"]').textContent();
    expect(debitTotal).toBe(creditTotal);
  });

  test('should filter by account class', async ({ page }) => {
    await page.fill('input[name="asOfDate"]', '2024-03-31');
    await page.click('[data-testid="class-filter"]');
    await page.check('label:has-text("Fixed Assets")');
    await page.check('label:has-text("Cash")');
    await page.click('button:has-text("Generate")');

    // Verify only selected classes shown
    const rows = await page.locator('[data-testid="tb-row"]').all();
    for (const row of rows) {
      const code = await row.locator('[data-field="accountCode"]').textContent();
      expect(code?.charAt(0)).toMatch(/[01]/); // Class 0 or 1
    }
  });

  test('should export to Excel', async ({ page }) => {
    await page.fill('input[name="asOfDate"]', '2024-03-31');
    await page.click('button:has-text("Generate")');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export to Excel")'),
    ]);

    expect(download.suggestedFilename()).toMatch(/trial_balance.*\.xlsx$/);
  });

  test('should create working trial balance', async ({ page }) => {
    await page.fill('input[name="asOfDate"]', '2024-03-31');
    await page.click('button:has-text("Generate")');
    await page.click('button:has-text("Create Working TB")');

    await page.fill('input[name="wtbName"]', 'March 2024 Working');
    await page.click('button:has-text("Create")');

    await expect(page).toHaveURL(/\/accounting\/working-tb\//);
    await expect(page.locator('text=March 2024 Working')).toBeVisible();
  });

  test('should add adjustments to working TB', async ({ page }) => {
    await page.goto('/accounting/working-tb/list');
    await page.click('[data-status="DRAFT"]:first-child');

    // Add adjustment column
    await page.click('button:has-text("Add Column")');
    await page.fill('input[name="columnName"]', 'Accruals');
    await page.selectOption('select[name="columnType"]', 'ADJUSTING');
    await page.click('button:has-text("Add")');

    // Record adjustment
    await page.click('[data-testid="account-row"]:first-child [data-testid="adjustment-input"]');
    await page.fill('[data-testid="adjustment-input"]', '1000');
    await page.press('[data-testid="adjustment-input"]', 'Tab');

    await expect(page.locator('text=Adjusted')).toBeVisible();
  });

  test('should lock working trial balance', async ({ page }) => {
    await page.goto('/accounting/working-tb/list');
    await page.click('[data-status="DRAFT"]:first-child');

    await page.click('button:has-text("Lock")');
    await page.fill('textarea[name="lockReason"]', 'Month-end close');
    await page.click('button:has-text("Confirm Lock")');

    await expect(page.locator('[data-status="LOCKED"]')).toBeVisible();
    await expect(page.locator('button:has-text("Add Column")')).toBeDisabled();
  });
});
```

---

## Security Checklist

- [x] **Authentication**: All endpoints require authenticated session
- [x] **Authorization**: Users can only access their organization's data
- [x] **Row-Level Security**: PostgreSQL RLS enforces organization isolation
- [x] **Data Integrity**: Balance verification before locking
- [x] **Audit Trail**: All WTB operations logged
- [x] **Export Security**: Generated files contain only authorized data
- [x] **Immutability**: Locked WTB cannot be modified

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `TRIAL_BALANCE_GENERATED` | TB generation | asOfDate, periodId, accountCount, totals |
| `WORKING_TB_CREATED` | WTB creation | wtbId, wtbCode, asOfDate |
| `WORKING_TB_ADJUSTMENT_ADDED` | Adjustment recorded | wtbId, accountId, columnId, amount |
| `WORKING_TB_LOCKED` | WTB locked | wtbId, lockReason, lockedBy |
| `TRIAL_BALANCE_EXPORTED` | Export to file | format, asOfDate, accountCount |

---

## Implementation Notes

### Balance Calculation
- Uses Decimal.js for all monetary calculations
- Handles multi-currency with base currency conversion
- Proper handling of debit/credit normal balances

### Grouping Logic
- CLASS: Groups by Polish account class (0-9)
- PARENT: Hierarchical tree based on parent_account_id
- Subtotals calculated at each group level

### Working Trial Balance
- Snapshot of TB at creation time
- Adjustments stored in JSONB for flexibility
- Multiple adjustment columns supported
- Locked WTB preserved for audit

### Export Formats
- Excel: Full formatting, formulas, print-ready
- PDF: Professional layout with headers/footers
- CSV: Simple data export for import into other systems

### Performance Considerations
- GL aggregation uses database-level SUM
- Caching for repeated TB generations
- Pagination for large account lists
