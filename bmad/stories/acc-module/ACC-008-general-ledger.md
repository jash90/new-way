# ACC-008: General Ledger

> **Story ID**: ACC-008
> **Title**: General Ledger
> **Epic**: Accounting Engine (ACC)
> **Priority**: P0
> **Points**: 13
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant reviewing financial records,
**I want to** view the general ledger showing all postings to each account,
**So that** I can analyze account activity and verify transaction accuracy.

---

## Acceptance Criteria

### AC1: View Account Ledger
```gherkin
Feature: Account Ledger View

Scenario: View single account ledger
  Given account "100 - Kasa" has posted entries
  When I view the general ledger for account "100"
  Then I should see all postings to this account
  And each posting should show:
    | Field          | Example                    |
    | Date           | 2024-01-15                 |
    | Entry Number   | JE/2024/01/001             |
    | Description    | Cash withdrawal from bank  |
    | Debit          | 1,000.00                   |
    | Credit         |                            |
    | Running Balance| 5,000.00                   |
  And postings should be ordered by date

Scenario: Filter by date range
  Given I am viewing ledger for account "100"
  When I filter by date range January 1-31, 2024
  Then I should only see postings within that range
  And opening balance should reflect prior activity
```

### AC2: Ledger Totals and Balance
```gherkin
Feature: Ledger Calculations

Scenario: Calculate running balance
  Given account "100" has the following postings:
    | Date       | Debit | Credit |
    | 2024-01-01 | 5000  |        |
    | 2024-01-15 | 1000  |        |
    | 2024-01-20 |       | 2000   |
  When I view the ledger
  Then running balances should be:
    | Date       | Running Balance |
    | 2024-01-01 | 5000            |
    | 2024-01-15 | 6000            |
    | 2024-01-20 | 4000            |

Scenario: Show period totals
  Given I am viewing January 2024 ledger
  Then I should see:
    | Metric         | Value    |
    | Opening Balance| 3,000.00 |
    | Total Debits   | 6,000.00 |
    | Total Credits  | 2,000.00 |
    | Closing Balance| 7,000.00 |
```

### AC3: Full General Ledger Report
```gherkin
Feature: Full GL Report

Scenario: Generate complete general ledger
  Given I want to see all account activity
  When I generate the full general ledger report
  Then I should see all accounts with activity
  And accounts should be grouped by type
  And each account should show its ledger summary

Scenario: Export general ledger
  Given I have generated the GL report
  When I export to Excel
  Then the file should contain all account ledgers
  And each account should be on a separate sheet
  And totals should match the on-screen report
```

### AC4: Drill-Down to Journal Entry
```gherkin
Feature: Entry Drill-Down

Scenario: Navigate to source entry
  Given I am viewing account ledger
  When I click on entry number "JE/2024/01/001"
  Then I should be taken to the journal entry detail
  And I should be able to see all lines of that entry
```

### AC5: Ledger Search and Filter
```gherkin
Feature: Ledger Search

Scenario: Search by description
  Given I am viewing account "200 - Bank" ledger
  When I search for "invoice"
  Then I should see only entries containing "invoice" in description

Scenario: Filter by entry type
  Given I am viewing the ledger
  When I filter by entry type "ADJUSTMENT"
  Then I should see only adjusting entries
```

---

## Technical Specification

### Database Schema

```sql
-- General ledger (denormalized for fast queries)
CREATE TABLE general_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Source references
  entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  line_id UUID NOT NULL REFERENCES journal_lines(id) ON DELETE CASCADE,

  -- Account
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),

  -- Period
  period_id UUID NOT NULL REFERENCES accounting_periods(id),

  -- Transaction data
  entry_date DATE NOT NULL,
  entry_number VARCHAR(50) NOT NULL,
  entry_type VARCHAR(20) NOT NULL,

  -- Amounts
  debit_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  credit_amount DECIMAL(19,4) NOT NULL DEFAULT 0,

  -- Description
  description TEXT,
  reference VARCHAR(100),

  -- Cost tracking
  cost_center_id UUID REFERENCES cost_centers(id),
  project_id UUID REFERENCES projects(id),

  -- Posting timestamp
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- For JPK and audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_gl_amounts CHECK (
    (debit_amount >= 0 AND credit_amount >= 0) AND
    NOT (debit_amount > 0 AND credit_amount > 0)
  )
);

-- Account balances (materialized for performance)
CREATE TABLE account_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  period_id UUID NOT NULL REFERENCES accounting_periods(id),

  -- Balances
  opening_balance DECIMAL(19,4) NOT NULL DEFAULT 0,
  debit_movements DECIMAL(19,4) NOT NULL DEFAULT 0,
  credit_movements DECIMAL(19,4) NOT NULL DEFAULT 0,
  closing_balance DECIMAL(19,4) NOT NULL DEFAULT 0,

  -- Calculated closing = opening + debits - credits (for debit-normal)
  -- or opening - debits + credits (for credit-normal)

  -- Metadata
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(account_id, period_id)
);

-- Indexes for GL performance
CREATE INDEX idx_gl_org_account ON general_ledger(organization_id, account_id);
CREATE INDEX idx_gl_account_date ON general_ledger(account_id, entry_date);
CREATE INDEX idx_gl_period ON general_ledger(period_id);
CREATE INDEX idx_gl_entry ON general_ledger(entry_id);
CREATE INDEX idx_gl_entry_number ON general_ledger(entry_number);
CREATE INDEX idx_gl_posted_at ON general_ledger(posted_at);

-- Full text search on description
CREATE INDEX idx_gl_description_search
  ON general_ledger USING GIN (to_tsvector('polish', description));

-- Account balance indexes
CREATE INDEX idx_balances_account ON account_balances(account_id);
CREATE INDEX idx_balances_period ON account_balances(period_id);

-- RLS
ALTER TABLE general_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY gl_org_isolation ON general_ledger
  USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY balances_org_isolation ON account_balances
  USING (account_id IN (
    SELECT id FROM chart_of_accounts
    WHERE organization_id = current_setting('app.organization_id')::UUID
  ));
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Query parameters for ledger
export const GetAccountLedgerInput = z.object({
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
  orderBy: z.enum(['date_asc', 'date_desc']).default('date_asc'),
});

// Full GL report parameters
export const GetFullGLReportInput = z.object({
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

// Export parameters
export const ExportGLInput = z.object({
  ...GetFullGLReportInput.shape,
  format: z.enum(['xlsx', 'pdf', 'csv']).default('xlsx'),
  separateSheets: z.boolean().default(true),
});

// Ledger entry response
export const LedgerEntrySchema = z.object({
  id: z.string().uuid(),
  entryDate: z.date(),
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
  postedAt: z.date(),
});

// Account ledger response
export const AccountLedgerSchema = z.object({
  account: z.object({
    id: z.string().uuid(),
    accountCode: z.string(),
    accountName: z.string(),
    accountType: z.string(),
    normalBalance: z.enum(['DEBIT', 'CREDIT']),
  }),
  period: z.object({
    name: z.string(),
    startDate: z.date(),
    endDate: z.date(),
  }).optional(),
  openingBalance: z.number(),
  entries: z.array(LedgerEntrySchema),
  totals: z.object({
    debitTotal: z.number(),
    creditTotal: z.number(),
    netMovement: z.number(),
    closingBalance: z.number(),
  }),
  pagination: z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  }),
});

// GL summary for report
export const GLAccountSummarySchema = z.object({
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

export const FullGLReportSchema = z.object({
  reportTitle: z.string(),
  period: z.string(),
  generatedAt: z.date(),
  accounts: z.array(GLAccountSummarySchema),
  groupedByType: z.record(z.array(GLAccountSummarySchema)).optional(),
  totals: z.object({
    totalDebits: z.number(),
    totalCredits: z.number(),
    accountCount: z.number(),
    entryCount: z.number(),
  }),
});

export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;
export type AccountLedger = z.infer<typeof AccountLedgerSchema>;
export type GLAccountSummary = z.infer<typeof GLAccountSummarySchema>;
export type FullGLReport = z.infer<typeof FullGLReportSchema>;
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { Decimal } from 'decimal.js';
import * as XLSX from 'xlsx';
import {
  GetAccountLedgerInput,
  GetFullGLReportInput,
  ExportGLInput,
} from './schemas';

export const generalLedgerRouter = router({
  // Get ledger for single account
  getAccountLedger: protectedProcedure
    .input(GetAccountLedgerInput)
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      // Get account details
      const account = await ctx.db.chartOfAccounts.findFirst({
        where: { id: input.accountId, organizationId },
      });

      if (!account) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found',
        });
      }

      // Build query conditions
      const where: any = {
        organizationId,
        accountId: input.accountId,
      };

      let periodInfo = null;

      if (input.periodId) {
        where.periodId = input.periodId;
        periodInfo = await ctx.db.accountingPeriods.findFirst({
          where: { id: input.periodId },
        });
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

      if (input.entryTypes && input.entryTypes.length > 0) {
        where.entryType = { in: input.entryTypes };
      }

      if (input.search) {
        where.OR = [
          { description: { contains: input.search, mode: 'insensitive' } },
          { reference: { contains: input.search, mode: 'insensitive' } },
          { entryNumber: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      if (input.costCenterId) {
        where.costCenterId = input.costCenterId;
      }

      if (input.projectId) {
        where.projectId = input.projectId;
      }

      // Calculate opening balance
      const openingBalance = await calculateOpeningBalance(
        ctx.db,
        organizationId,
        input.accountId,
        account.normalBalance,
        input.dateRange?.from || periodInfo?.startDate
      );

      // Fetch ledger entries
      const [entries, total] = await Promise.all([
        ctx.db.generalLedger.findMany({
          where,
          include: {
            costCenter: { select: { name: true } },
            project: { select: { name: true } },
          },
          orderBy: input.orderBy === 'date_asc'
            ? [{ entryDate: 'asc' }, { postedAt: 'asc' }]
            : [{ entryDate: 'desc' }, { postedAt: 'desc' }],
          skip: input.offset,
          take: input.limit,
        }),
        ctx.db.generalLedger.count({ where }),
      ]);

      // Calculate running balance if requested
      let entriesWithBalance = entries;

      if (input.includeRunningBalance && input.orderBy === 'date_asc') {
        let runningBalance = new Decimal(openingBalance);

        entriesWithBalance = entries.map(entry => {
          const movement = account.normalBalance === 'DEBIT'
            ? new Decimal(entry.debitAmount).minus(entry.creditAmount)
            : new Decimal(entry.creditAmount).minus(entry.debitAmount);

          runningBalance = runningBalance.plus(movement);

          return {
            ...entry,
            runningBalance: runningBalance.toNumber(),
          };
        });
      }

      // Calculate totals
      const totals = entries.reduce(
        (acc, entry) => ({
          debitTotal: acc.debitTotal.plus(entry.debitAmount),
          creditTotal: acc.creditTotal.plus(entry.creditAmount),
        }),
        { debitTotal: new Decimal(0), creditTotal: new Decimal(0) }
      );

      const netMovement = account.normalBalance === 'DEBIT'
        ? totals.debitTotal.minus(totals.creditTotal)
        : totals.creditTotal.minus(totals.debitTotal);

      const closingBalance = new Decimal(openingBalance).plus(netMovement);

      return {
        account: {
          id: account.id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          accountType: account.accountType,
          normalBalance: account.normalBalance,
        },
        period: periodInfo ? {
          name: periodInfo.periodName,
          startDate: periodInfo.startDate,
          endDate: periodInfo.endDate,
        } : undefined,
        openingBalance,
        entries: entriesWithBalance.map(e => ({
          id: e.id,
          entryDate: e.entryDate,
          entryNumber: e.entryNumber,
          entryType: e.entryType,
          entryId: e.entryId,
          description: e.description,
          reference: e.reference,
          debitAmount: e.debitAmount,
          creditAmount: e.creditAmount,
          runningBalance: e.runningBalance,
          costCenterName: e.costCenter?.name || null,
          projectName: e.project?.name || null,
          postedAt: e.postedAt,
        })),
        totals: {
          debitTotal: totals.debitTotal.toNumber(),
          creditTotal: totals.creditTotal.toNumber(),
          netMovement: netMovement.toNumber(),
          closingBalance: closingBalance.toNumber(),
        },
        pagination: {
          total,
          limit: input.limit,
          offset: input.offset,
          hasMore: input.offset + entries.length < total,
        },
      };
    }),

  // Get full GL report
  getFullReport: protectedProcedure
    .input(GetFullGLReportInput)
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      // Get all accounts with activity
      const accountsWhere: any = { organizationId, isActive: true };
      if (input.accountTypes && input.accountTypes.length > 0) {
        accountsWhere.accountType = { in: input.accountTypes };
      }

      const accounts = await ctx.db.chartOfAccounts.findMany({
        where: accountsWhere,
        orderBy: { accountCode: 'asc' },
      });

      // Determine date range
      let dateFrom: Date;
      let dateTo: Date;
      let periodName: string;

      if (input.dateRange) {
        dateFrom = input.dateRange.from;
        dateTo = input.dateRange.to;
        periodName = `${dateFrom.toLocaleDateString('pl-PL')} - ${dateTo.toLocaleDateString('pl-PL')}`;
      } else if (input.periodId) {
        const period = await ctx.db.accountingPeriods.findFirst({
          where: { id: input.periodId },
        });
        dateFrom = period!.startDate;
        dateTo = period!.endDate;
        periodName = period!.periodName;
      } else if (input.fiscalYearId) {
        const year = await ctx.db.fiscalYears.findFirst({
          where: { id: input.fiscalYearId },
        });
        dateFrom = year!.startDate;
        dateTo = year!.endDate;
        periodName = year!.yearName;
      } else {
        // Default to current month
        const now = new Date();
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        periodName = dateFrom.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
      }

      // Get balances and movements for each account
      const accountSummaries: any[] = [];

      for (const account of accounts) {
        const openingBalance = await calculateOpeningBalance(
          ctx.db,
          organizationId,
          account.id,
          account.normalBalance,
          dateFrom
        );

        const movements = await ctx.db.generalLedger.aggregate({
          where: {
            organizationId,
            accountId: account.id,
            entryDate: { gte: dateFrom, lte: dateTo },
          },
          _sum: {
            debitAmount: true,
            creditAmount: true,
          },
          _count: true,
        });

        const debitMovements = movements._sum.debitAmount || 0;
        const creditMovements = movements._sum.creditAmount || 0;
        const entryCount = movements._count;

        const netMovement = account.normalBalance === 'DEBIT'
          ? new Decimal(debitMovements).minus(creditMovements)
          : new Decimal(creditMovements).minus(debitMovements);

        const closingBalance = new Decimal(openingBalance).plus(netMovement);

        // Skip zero balance accounts if not included
        if (!input.includeZeroBalance &&
            closingBalance.isZero() &&
            debitMovements === 0 &&
            creditMovements === 0) {
          continue;
        }

        accountSummaries.push({
          accountId: account.id,
          accountCode: account.accountCode,
          accountName: account.accountName,
          accountType: account.accountType,
          openingBalance,
          debitMovements,
          creditMovements,
          closingBalance: closingBalance.toNumber(),
          entryCount,
        });
      }

      // Group by account type if requested
      let groupedByType: Record<string, any[]> | undefined;

      if (input.groupByType) {
        groupedByType = {};
        for (const summary of accountSummaries) {
          if (!groupedByType[summary.accountType]) {
            groupedByType[summary.accountType] = [];
          }
          groupedByType[summary.accountType].push(summary);
        }
      }

      // Calculate totals
      const totals = accountSummaries.reduce(
        (acc, summary) => ({
          totalDebits: acc.totalDebits.plus(summary.debitMovements),
          totalCredits: acc.totalCredits.plus(summary.creditMovements),
          entryCount: acc.entryCount + summary.entryCount,
        }),
        { totalDebits: new Decimal(0), totalCredits: new Decimal(0), entryCount: 0 }
      );

      return {
        reportTitle: 'General Ledger Report',
        period: periodName,
        generatedAt: new Date(),
        accounts: accountSummaries,
        groupedByType,
        totals: {
          totalDebits: totals.totalDebits.toNumber(),
          totalCredits: totals.totalCredits.toNumber(),
          accountCount: accountSummaries.length,
          entryCount: totals.entryCount,
        },
      };
    }),

  // Export GL to file
  exportGL: protectedProcedure
    .input(ExportGLInput)
    .mutation(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      // Get full report data
      const report = await ctx.trpc.generalLedger.getFullReport({
        periodId: input.periodId,
        fiscalYearId: input.fiscalYearId,
        dateRange: input.dateRange,
        accountTypes: input.accountTypes,
        includeZeroBalance: input.includeZeroBalance,
        groupByType: input.groupByType,
      });

      if (input.format === 'xlsx') {
        const workbook = XLSX.utils.book_new();

        // Summary sheet
        const summaryData = report.accounts.map(a => ({
          'Konto': a.accountCode,
          'Nazwa': a.accountName,
          'Typ': a.accountType,
          'BO': a.openingBalance,
          'Obroty Wn': a.debitMovements,
          'Obroty Ma': a.creditMovements,
          'BZ': a.closingBalance,
          'Liczba zapisów': a.entryCount,
        }));

        const summarySheet = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Podsumowanie');

        // Individual account sheets if requested
        if (input.separateSheets) {
          for (const accountSummary of report.accounts.slice(0, 50)) { // Limit sheets
            const ledger = await ctx.trpc.generalLedger.getAccountLedger({
              accountId: accountSummary.accountId,
              periodId: input.periodId,
              fiscalYearId: input.fiscalYearId,
              dateRange: input.dateRange,
              limit: 1000,
            });

            const ledgerData = ledger.entries.map(e => ({
              'Data': e.entryDate,
              'Numer': e.entryNumber,
              'Opis': e.description,
              'Wn': e.debitAmount || '',
              'Ma': e.creditAmount || '',
              'Saldo': e.runningBalance,
            }));

            const sheetName = accountSummary.accountCode.substring(0, 31);
            const ledgerSheet = XLSX.utils.json_to_sheet(ledgerData);
            XLSX.utils.book_append_sheet(workbook, ledgerSheet, sheetName);
          }
        }

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Store file
        const fileName = `GL_${report.period.replace(/\s/g, '_')}_${Date.now()}.xlsx`;
        const file = await ctx.storage.upload({
          organizationId,
          fileName,
          content: buffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        return {
          fileId: file.id,
          fileName,
          downloadUrl: file.url,
        };
      }

      // PDF generation would use different library (PDFKit)
      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: `Export format ${input.format} not yet implemented`,
      });
    }),

  // Get account balance for specific date
  getAccountBalance: protectedProcedure
    .input(z.object({
      accountId: z.string().uuid(),
      asOfDate: z.coerce.date(),
    }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      const account = await ctx.db.chartOfAccounts.findFirst({
        where: { id: input.accountId, organizationId },
      });

      if (!account) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found',
        });
      }

      // Sum all movements up to date
      const movements = await ctx.db.generalLedger.aggregate({
        where: {
          organizationId,
          accountId: input.accountId,
          entryDate: { lte: input.asOfDate },
        },
        _sum: {
          debitAmount: true,
          creditAmount: true,
        },
      });

      const debits = new Decimal(movements._sum.debitAmount || 0);
      const credits = new Decimal(movements._sum.creditAmount || 0);

      const balance = account.normalBalance === 'DEBIT'
        ? debits.minus(credits)
        : credits.minus(debits);

      return {
        accountId: input.accountId,
        accountCode: account.accountCode,
        accountName: account.accountName,
        asOfDate: input.asOfDate,
        debitTotal: debits.toNumber(),
        creditTotal: credits.toNumber(),
        balance: balance.toNumber(),
      };
    }),

  // Get multiple account balances (for reports)
  getAccountBalances: protectedProcedure
    .input(z.object({
      accountIds: z.array(z.string().uuid()),
      periodId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      const balances = await ctx.db.accountBalances.findMany({
        where: {
          accountId: { in: input.accountIds },
          periodId: input.periodId,
          account: { organizationId },
        },
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
      });

      return balances.map(b => ({
        accountId: b.accountId,
        accountCode: b.account.accountCode,
        accountName: b.account.accountName,
        accountType: b.account.accountType,
        openingBalance: b.openingBalance,
        debitMovements: b.debitMovements,
        creditMovements: b.creditMovements,
        closingBalance: b.closingBalance,
      }));
    }),

  // Recalculate account balance (maintenance)
  recalculateBalance: protectedProcedure
    .input(z.object({
      accountId: z.string().uuid(),
      periodId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.session;

      const account = await ctx.db.chartOfAccounts.findFirst({
        where: { id: input.accountId, organizationId },
      });

      if (!account) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found',
        });
      }

      const period = await ctx.db.accountingPeriods.findFirst({
        where: { id: input.periodId },
      });

      if (!period) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Period not found',
        });
      }

      // Calculate opening balance from prior period
      const openingBalance = await calculateOpeningBalance(
        ctx.db,
        organizationId,
        input.accountId,
        account.normalBalance,
        period.startDate
      );

      // Sum movements in period
      const movements = await ctx.db.generalLedger.aggregate({
        where: {
          organizationId,
          accountId: input.accountId,
          periodId: input.periodId,
        },
        _sum: {
          debitAmount: true,
          creditAmount: true,
        },
      });

      const debitMovements = movements._sum.debitAmount || 0;
      const creditMovements = movements._sum.creditAmount || 0;

      const netMovement = account.normalBalance === 'DEBIT'
        ? new Decimal(debitMovements).minus(creditMovements)
        : new Decimal(creditMovements).minus(debitMovements);

      const closingBalance = new Decimal(openingBalance).plus(netMovement);

      // Update balance record
      const updated = await ctx.db.accountBalances.upsert({
        where: {
          account_period_unique: {
            accountId: input.accountId,
            periodId: input.periodId,
          },
        },
        create: {
          accountId: input.accountId,
          periodId: input.periodId,
          openingBalance,
          debitMovements,
          creditMovements,
          closingBalance: closingBalance.toNumber(),
        },
        update: {
          openingBalance,
          debitMovements,
          creditMovements,
          closingBalance: closingBalance.toNumber(),
          lastUpdated: new Date(),
        },
      });

      // Audit log
      await ctx.db.auditLogs.create({
        data: {
          organizationId,
          userId,
          action: 'BALANCE_RECALCULATED',
          entityType: 'ACCOUNT_BALANCE',
          entityId: updated.id,
          newValues: {
            accountCode: account.accountCode,
            periodName: period.periodName,
            closingBalance: closingBalance.toString(),
          },
        },
      });

      return updated;
    }),
});

// Helper: Calculate opening balance for a date
async function calculateOpeningBalance(
  db: any,
  organizationId: string,
  accountId: string,
  normalBalance: 'DEBIT' | 'CREDIT',
  asOfDate?: Date
): Promise<number> {
  if (!asOfDate) return 0;

  const priorMovements = await db.generalLedger.aggregate({
    where: {
      organizationId,
      accountId,
      entryDate: { lt: asOfDate },
    },
    _sum: {
      debitAmount: true,
      creditAmount: true,
    },
  });

  const debits = new Decimal(priorMovements._sum.debitAmount || 0);
  const credits = new Decimal(priorMovements._sum.creditAmount || 0);

  const balance = normalBalance === 'DEBIT'
    ? debits.minus(credits)
    : credits.minus(debits);

  return balance.toNumber();
}
```

---

## Test Specifications

### Unit Tests

```typescript
describe('General Ledger', () => {
  describe('calculateOpeningBalance', () => {
    it('should sum prior movements for debit-normal account', async () => {
      // Prior movements: 1000 debit, 300 credit
      const balance = await calculateOpeningBalance(
        mockDb,
        'org-1',
        'account-1',
        'DEBIT',
        new Date('2024-02-01')
      );

      expect(balance).toBe(700); // 1000 - 300
    });

    it('should sum prior movements for credit-normal account', async () => {
      // Prior movements: 500 debit, 1500 credit
      const balance = await calculateOpeningBalance(
        mockDb,
        'org-1',
        'liability-1',
        'CREDIT',
        new Date('2024-02-01')
      );

      expect(balance).toBe(1000); // 1500 - 500
    });
  });

  describe('Running balance calculation', () => {
    it('should calculate running balance correctly', () => {
      const entries = [
        { debitAmount: 1000, creditAmount: 0 },
        { debitAmount: 500, creditAmount: 0 },
        { debitAmount: 0, creditAmount: 300 },
      ];

      let balance = new Decimal(0);
      const withBalance = entries.map(e => {
        balance = balance.plus(e.debitAmount).minus(e.creditAmount);
        return { ...e, runningBalance: balance.toNumber() };
      });

      expect(withBalance[0].runningBalance).toBe(1000);
      expect(withBalance[1].runningBalance).toBe(1500);
      expect(withBalance[2].runningBalance).toBe(1200);
    });
  });
});
```

### Integration Tests

```typescript
describe('General Ledger Router', () => {
  describe('getAccountLedger', () => {
    it('should return ledger with running balance', async () => {
      const result = await caller.generalLedger.getAccountLedger({
        accountId: cashAccountId,
        periodId: januaryPeriodId,
        includeRunningBalance: true,
      });

      expect(result.account.accountCode).toBe('100');
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries[0].runningBalance).toBeDefined();
      expect(result.totals.closingBalance).toBeDefined();
    });

    it('should filter by date range', async () => {
      const result = await caller.generalLedger.getAccountLedger({
        accountId: cashAccountId,
        dateRange: {
          from: new Date('2024-01-15'),
          to: new Date('2024-01-20'),
        },
      });

      result.entries.forEach(entry => {
        expect(new Date(entry.entryDate).getTime())
          .toBeGreaterThanOrEqual(new Date('2024-01-15').getTime());
        expect(new Date(entry.entryDate).getTime())
          .toBeLessThanOrEqual(new Date('2024-01-20').getTime());
      });
    });
  });

  describe('getFullReport', () => {
    it('should return grouped GL report', async () => {
      const result = await caller.generalLedger.getFullReport({
        periodId: januaryPeriodId,
        groupByType: true,
        includeZeroBalance: false,
      });

      expect(result.groupedByType).toBeDefined();
      expect(result.accounts.length).toBeGreaterThan(0);
      expect(result.totals.totalDebits).toBe(result.totals.totalCredits);
    });
  });

  describe('exportGL', () => {
    it('should generate Excel file', async () => {
      const result = await caller.generalLedger.exportGL({
        periodId: januaryPeriodId,
        format: 'xlsx',
      });

      expect(result.fileId).toBeDefined();
      expect(result.fileName).toContain('.xlsx');
    });
  });
});
```

---

## Security Checklist

- [x] Organization isolation via RLS
- [x] Read-only for posted data
- [x] Export audit logging
- [x] Balance recalculation requires permission

---

## Tasks

- [ ] Create database migrations
- [ ] Implement ledger queries with running balance
- [ ] Build opening balance calculation
- [ ] Create full GL report generator
- [ ] Implement Excel export
- [ ] Add drill-down navigation
- [ ] Create UI components
- [ ] Write tests

---

*Last updated: December 2024*
