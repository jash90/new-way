# ACC-013: Balance Sheet (Bilans)

> **Story ID**: ACC-013
> **Epic**: [ACC - Accounting Engine](./epic.md)
> **Title**: Balance Sheet (Bilans)
> **Priority**: P0
> **Points**: 13
> **Status**: 📋 Ready
> **Sprint**: Week 11
> **Dependencies**: ACC-012 (Trial Balance)

---

## User Story

**As an** accountant,
**I want to** generate a balance sheet (bilans) in Polish standard format,
**So that** I can report the financial position of a company at a specific date.

---

## Acceptance Criteria

### AC1: Balance Sheet Generation

```gherkin
Feature: Balance Sheet Generation
  As an accountant
  I need to generate balance sheets in Polish format
  So that I can report financial position

  Background:
    Given I am logged in as "accountant@ksiegowa.pl"
    And organization "TestOrg" has posted journal entries
    And the accounting period "January 2024" exists

  Scenario: Generate balance sheet for a specific date
    Given the trial balance is balanced for "2024-01-31"
    When I request balance sheet for date "2024-01-31"
    Then the system generates a balance sheet
    And the assets total equals liabilities plus equity total
    And the balance sheet follows Polish "Ustawa o rachunkowości" format

  Scenario: Generate balance sheet with comparative period
    Given balance sheet data exists for "2023-12-31"
    When I request balance sheet for "2024-01-31" with comparative period "2023-12-31"
    Then I receive balance sheet with two columns
    And each column shows balances for respective dates
    And variances are calculated automatically

  Scenario: Balance sheet reflects all posted entries
    Given journal entry JE-2024-01-001 was posted with:
      | Account | Debit  | Credit |
      | 100     | 10000  | 0      |
      | 200     | 0      | 10000  |
    When I generate balance sheet for "2024-01-31"
    Then account 100 appears under assets with balance 10000
    And account 200 appears under liabilities with balance 10000
```

### AC2: Polish Bilans Format (Załącznik nr 1)

```gherkin
Feature: Polish Balance Sheet Format
  The balance sheet must follow Załącznik nr 1 to Ustawa o rachunkowości

  Scenario: Balance sheet structure follows Polish standards
    When I generate a balance sheet
    Then the structure includes:
      | Section | Polish Name | Category |
      | A | Aktywa trwałe | Assets |
      | A.I | Wartości niematerialne i prawne | Assets |
      | A.II | Rzeczowe aktywa trwałe | Assets |
      | A.III | Należności długoterminowe | Assets |
      | A.IV | Inwestycje długoterminowe | Assets |
      | A.V | Długoterminowe rozliczenia międzyokresowe | Assets |
      | B | Aktywa obrotowe | Assets |
      | B.I | Zapasy | Assets |
      | B.II | Należności krótkoterminowe | Assets |
      | B.III | Inwestycje krótkoterminowe | Assets |
      | B.IV | Krótkoterminowe rozliczenia międzyokresowe | Assets |
      | A | Kapitał własny | Equity & Liabilities |
      | A.I | Kapitał podstawowy | Equity |
      | A.II | Kapitał zapasowy | Equity |
      | A.VI | Zysk (strata) netto | Equity |
      | B | Zobowiązania i rezerwy | Liabilities |
      | B.I | Rezerwy na zobowiązania | Liabilities |
      | B.II | Zobowiązania długoterminowe | Liabilities |
      | B.III | Zobowiązania krótkoterminowe | Liabilities |

  Scenario: Account class mapping to balance sheet positions
    Given account "010" is class 0 (Fixed Assets)
    And account "130" is class 1 (Cash)
    And account "200" is class 2 (Receivables/Payables)
    And account "801" is class 8 (Equity)
    When I generate balance sheet
    Then account "010" maps to position "A.II - Rzeczowe aktywa trwałe"
    And account "130" maps to position "B.III - Inwestycje krótkoterminowe"
    And account "200" with debit balance maps to "B.II - Należności"
    And account "200" with credit balance maps to "B.III.2 - Zobowiązania"
    And account "801" maps to position "A.I - Kapitał podstawowy"
```

### AC3: Balance Sheet Export

```gherkin
Feature: Balance Sheet Export
  As an accountant
  I need to export balance sheets in various formats

  Scenario: Export balance sheet to Excel
    Given a generated balance sheet for "2024-01-31"
    When I export to Excel format
    Then I receive an .xlsx file
    And the file contains proper Polish headers
    And amounts are formatted with Polish locale (space as thousand separator)
    And the file includes organization header with NIP

  Scenario: Export balance sheet to PDF
    Given a generated balance sheet for "2024-01-31"
    When I export to PDF format
    Then I receive a .pdf file
    And the layout matches official "Bilans" template
    And the PDF includes signatures section
    And Polish characters are properly rendered

  Scenario: Export comparative balance sheet
    Given a comparative balance sheet for "2024-01-31" vs "2023-12-31"
    When I export to PDF format
    Then the PDF shows both periods side by side
    And includes variance column with percentages
```

### AC4: Net Income Integration

```gherkin
Feature: Net Income in Balance Sheet
  Balance sheet must include profit/loss from income statement

  Scenario: Current year profit reflected in equity
    Given income statement shows net profit of 50000 PLN for January 2024
    When I generate balance sheet for "2024-01-31"
    Then the equity section shows "Zysk (strata) netto: 50000"
    And total equity includes this profit

  Scenario: Prior year retained earnings
    Given retained earnings account 820 has balance 100000
    And current year profit is 50000
    When I generate balance sheet for "2024-01-31"
    Then equity shows "Zysk (strata) z lat ubiegłych: 100000"
    And "Zysk (strata) netto: 50000"
    And total equity is 150000 plus other equity components
```

---

## Technical Specification

### Database Schema

```sql
-- Balance sheet report persistence (optional, for saved reports)
CREATE TABLE balance_sheet_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Report parameters
  report_date DATE NOT NULL,
  comparative_date DATE,
  report_name VARCHAR(255),

  -- Calculated totals
  total_assets DECIMAL(15,2) NOT NULL,
  total_liabilities DECIMAL(15,2) NOT NULL,
  total_equity DECIMAL(15,2) NOT NULL,

  -- Report data (full structure as JSONB)
  report_data JSONB NOT NULL,

  -- Export info
  exported_formats TEXT[] DEFAULT '{}',
  last_exported_at TIMESTAMP,

  -- Status
  is_final BOOLEAN DEFAULT FALSE,
  finalized_at TIMESTAMP,
  finalized_by UUID REFERENCES users(id),

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),

  -- Constraints
  UNIQUE(organization_id, report_date, comparative_date)
);

-- Balance sheet line mapping configuration
CREATE TABLE balance_sheet_line_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Line identification
  line_code VARCHAR(20) NOT NULL,  -- e.g., "A.I", "A.II.1"
  line_name_pl VARCHAR(255) NOT NULL,
  line_name_en VARCHAR(255),
  parent_line_code VARCHAR(20),

  -- Classification
  section VARCHAR(20) NOT NULL CHECK (section IN ('ASSETS', 'EQUITY', 'LIABILITIES')),
  line_order INTEGER NOT NULL,
  indent_level INTEGER NOT NULL DEFAULT 0,

  -- Account mapping
  account_class_pattern VARCHAR(50),  -- e.g., "0%", "1%", "8%"
  account_codes TEXT[],               -- Specific accounts
  balance_type VARCHAR(10) CHECK (balance_type IN ('DEBIT', 'CREDIT', 'BOTH')),

  -- Display
  is_header BOOLEAN DEFAULT FALSE,
  is_total BOOLEAN DEFAULT FALSE,
  show_zero_balance BOOLEAN DEFAULT FALSE,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(organization_id, line_code)
);

-- Indexes
CREATE INDEX idx_bsr_org_date ON balance_sheet_reports(organization_id, report_date);
CREATE INDEX idx_bslc_org ON balance_sheet_line_config(organization_id);
CREATE INDEX idx_bslc_section ON balance_sheet_line_config(section);

-- Row Level Security
ALTER TABLE balance_sheet_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_sheet_line_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY balance_sheet_reports_isolation ON balance_sheet_reports
  USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY balance_sheet_line_config_isolation ON balance_sheet_line_config
  USING (organization_id = current_setting('app.organization_id')::UUID);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// =====================================
// Polish Balance Sheet Structure
// =====================================

export const BalanceSheetSectionEnum = z.enum(['ASSETS', 'EQUITY', 'LIABILITIES']);
export type BalanceSheetSection = z.infer<typeof BalanceSheetSectionEnum>;

export const BalanceSheetLineSchema = z.object({
  lineCode: z.string().max(20),
  lineNamePl: z.string().max(255),
  lineNameEn: z.string().max(255).optional(),
  section: BalanceSheetSectionEnum,
  indentLevel: z.number().int().min(0).max(5),
  currentPeriod: z.number(),
  priorPeriod: z.number().optional(),
  variance: z.number().optional(),
  variancePercent: z.number().optional(),
  isHeader: z.boolean().default(false),
  isTotal: z.boolean().default(false),
  accounts: z.array(z.string()).optional(), // Contributing account codes
});
export type BalanceSheetLine = z.infer<typeof BalanceSheetLineSchema>;

export const BalanceSheetSchema = z.object({
  organizationId: z.string().uuid(),
  organizationName: z.string(),
  nip: z.string().length(10),
  reportDate: z.coerce.date(),
  comparativeDate: z.coerce.date().optional(),

  // Assets section (Aktywa)
  assets: z.object({
    fixedAssets: z.object({
      intangibleAssets: BalanceSheetLineSchema,
      tangibleAssets: BalanceSheetLineSchema,
      longTermReceivables: BalanceSheetLineSchema,
      longTermInvestments: BalanceSheetLineSchema,
      longTermPrepayments: BalanceSheetLineSchema,
      total: BalanceSheetLineSchema,
    }),
    currentAssets: z.object({
      inventory: BalanceSheetLineSchema,
      shortTermReceivables: BalanceSheetLineSchema,
      shortTermInvestments: BalanceSheetLineSchema,
      cash: BalanceSheetLineSchema,
      shortTermPrepayments: BalanceSheetLineSchema,
      total: BalanceSheetLineSchema,
    }),
    totalAssets: BalanceSheetLineSchema,
  }),

  // Equity section (Kapitał własny)
  equity: z.object({
    shareCapital: BalanceSheetLineSchema,
    supplementaryCapital: BalanceSheetLineSchema,
    revaluationReserve: BalanceSheetLineSchema,
    otherReserves: BalanceSheetLineSchema,
    priorYearsProfitLoss: BalanceSheetLineSchema,
    currentYearProfitLoss: BalanceSheetLineSchema,
    totalEquity: BalanceSheetLineSchema,
  }),

  // Liabilities section (Zobowiązania)
  liabilities: z.object({
    provisions: BalanceSheetLineSchema,
    longTermLiabilities: BalanceSheetLineSchema,
    shortTermLiabilities: BalanceSheetLineSchema,
    accruals: BalanceSheetLineSchema,
    totalLiabilities: BalanceSheetLineSchema,
  }),

  // Control totals
  totalEquityAndLiabilities: BalanceSheetLineSchema,
  isBalanced: z.boolean(),
  balanceDifference: z.number(),

  // Metadata
  generatedAt: z.coerce.date(),
  generatedBy: z.string().uuid(),
});
export type BalanceSheet = z.infer<typeof BalanceSheetSchema>;

// =====================================
// Input Schemas
// =====================================

export const GenerateBalanceSheetInput = z.object({
  reportDate: z.coerce.date(),
  comparativeDate: z.coerce.date().optional(),
  includeDrafts: z.boolean().default(false),
  excludeZeroBalances: z.boolean().default(true),
  detailLevel: z.enum(['SUMMARY', 'DETAILED', 'FULL']).default('DETAILED'),
});
export type GenerateBalanceSheetInput = z.infer<typeof GenerateBalanceSheetInput>;

export const ExportBalanceSheetInput = z.object({
  reportDate: z.coerce.date(),
  comparativeDate: z.coerce.date().optional(),
  format: z.enum(['EXCEL', 'PDF', 'CSV', 'XML']),
  language: z.enum(['PL', 'EN']).default('PL'),
  includeNotes: z.boolean().default(true),
  includeSignatures: z.boolean().default(true),
});
export type ExportBalanceSheetInput = z.infer<typeof ExportBalanceSheetInput>;

export const SaveBalanceSheetInput = z.object({
  reportDate: z.coerce.date(),
  comparativeDate: z.coerce.date().optional(),
  reportName: z.string().max(255).optional(),
  markAsFinal: z.boolean().default(false),
});
export type SaveBalanceSheetInput = z.infer<typeof SaveBalanceSheetInput>;

// =====================================
// Output Schemas
// =====================================

export const BalanceSheetExportOutput = z.object({
  fileName: z.string(),
  fileContent: z.string(), // Base64 encoded
  mimeType: z.string(),
  fileSize: z.number(),
});
export type BalanceSheetExportOutput = z.infer<typeof BalanceSheetExportOutput>;
```

### tRPC Router Implementation

```typescript
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { Decimal } from 'decimal.js';
import { db } from '../db';
import { eq, and, lte, sql } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import {
  GenerateBalanceSheetInput,
  ExportBalanceSheetInput,
  SaveBalanceSheetInput,
  BalanceSheet,
  BalanceSheetLine,
} from './schemas';

// Polish balance sheet line configuration (Załącznik nr 1)
const POLISH_BALANCE_SHEET_LINES = {
  assets: {
    // A. Aktywa trwałe
    fixedAssets: {
      code: 'A',
      namePl: 'Aktywa trwałe',
      children: {
        intangibleAssets: { code: 'A.I', namePl: 'Wartości niematerialne i prawne', accountPattern: '02%' },
        tangibleAssets: { code: 'A.II', namePl: 'Rzeczowe aktywa trwałe', accountPattern: '0[1345]%' },
        longTermReceivables: { code: 'A.III', namePl: 'Należności długoterminowe', accountPattern: null },
        longTermInvestments: { code: 'A.IV', namePl: 'Inwestycje długoterminowe', accountPattern: '03%' },
        longTermPrepayments: { code: 'A.V', namePl: 'Długoterminowe rozliczenia międzyokresowe', accountPattern: null },
      },
    },
    // B. Aktywa obrotowe
    currentAssets: {
      code: 'B',
      namePl: 'Aktywa obrotowe',
      children: {
        inventory: { code: 'B.I', namePl: 'Zapasy', accountPattern: '3%' },
        shortTermReceivables: { code: 'B.II', namePl: 'Należności krótkoterminowe', accountPattern: '2%', balanceType: 'DEBIT' },
        shortTermInvestments: { code: 'B.III', namePl: 'Inwestycje krótkoterminowe', accountPattern: '14%' },
        cash: { code: 'B.III.1c', namePl: 'Środki pieniężne w kasie i na rachunkach', accountPattern: '1[0123]%' },
        shortTermPrepayments: { code: 'B.IV', namePl: 'Krótkoterminowe rozliczenia międzyokresowe', accountPattern: '64%' },
      },
    },
  },
  equityAndLiabilities: {
    // A. Kapitał własny
    equity: {
      code: 'A',
      namePl: 'Kapitał (fundusz) własny',
      children: {
        shareCapital: { code: 'A.I', namePl: 'Kapitał (fundusz) podstawowy', accountPattern: '801%' },
        supplementaryCapital: { code: 'A.II', namePl: 'Kapitał (fundusz) zapasowy', accountPattern: '802%' },
        revaluationReserve: { code: 'A.III', namePl: 'Kapitał (fundusz) z aktualizacji wyceny', accountPattern: '803%' },
        otherReserves: { code: 'A.IV', namePl: 'Pozostałe kapitały (fundusze) rezerwowe', accountPattern: '804%' },
        priorYearsProfitLoss: { code: 'A.V', namePl: 'Zysk (strata) z lat ubiegłych', accountPattern: '82%' },
        currentYearProfitLoss: { code: 'A.VI', namePl: 'Zysk (strata) netto', accountPattern: '860%' },
      },
    },
    // B. Zobowiązania i rezerwy
    liabilities: {
      code: 'B',
      namePl: 'Zobowiązania i rezerwy na zobowiązania',
      children: {
        provisions: { code: 'B.I', namePl: 'Rezerwy na zobowiązania', accountPattern: '83%' },
        longTermLiabilities: { code: 'B.II', namePl: 'Zobowiązania długoterminowe', accountPattern: null },
        shortTermLiabilities: { code: 'B.III', namePl: 'Zobowiązania krótkoterminowe', accountPattern: '2%', balanceType: 'CREDIT' },
        accruals: { code: 'B.IV', namePl: 'Rozliczenia międzyokresowe', accountPattern: '84%' },
      },
    },
  },
};

export const balanceSheetRouter = router({
  // =====================================
  // Generate Balance Sheet
  // =====================================
  generate: protectedProcedure
    .input(GenerateBalanceSheetInput)
    .output(BalanceSheetSchema)
    .query(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.session;

      // Get organization info
      const organization = await db.query.organizations.findFirst({
        where: eq(organizations.id, organizationId),
      });

      if (!organization) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Organization not found',
        });
      }

      // Get all active accounts with their balances
      const accountBalances = await getAccountBalancesAtDate(
        organizationId,
        input.reportDate,
        input.includeDrafts
      );

      // Get comparative period balances if requested
      let comparativeBalances: Map<string, Decimal> | undefined;
      if (input.comparativeDate) {
        comparativeBalances = await getAccountBalancesAtDate(
          organizationId,
          input.comparativeDate,
          false
        );
      }

      // Calculate net income from income statement accounts
      const netIncome = await calculateNetIncome(
        organizationId,
        input.reportDate,
        input.includeDrafts
      );

      // Build balance sheet structure
      const balanceSheet = buildBalanceSheet(
        organization,
        input.reportDate,
        input.comparativeDate,
        accountBalances,
        comparativeBalances,
        netIncome,
        userId
      );

      // Validate balance (Assets = Equity + Liabilities)
      const totalAssets = new Decimal(balanceSheet.assets.totalAssets.currentPeriod);
      const totalEquityAndLiabilities = new Decimal(balanceSheet.totalEquityAndLiabilities.currentPeriod);

      balanceSheet.isBalanced = totalAssets.equals(totalEquityAndLiabilities);
      balanceSheet.balanceDifference = totalAssets.sub(totalEquityAndLiabilities).toNumber();

      // Log audit event
      await ctx.audit.log({
        action: 'BALANCE_SHEET_GENERATED',
        entityType: 'BalanceSheet',
        entityId: `${organizationId}-${input.reportDate.toISOString()}`,
        metadata: {
          reportDate: input.reportDate.toISOString(),
          comparativeDate: input.comparativeDate?.toISOString(),
          isBalanced: balanceSheet.isBalanced,
          totalAssets: totalAssets.toString(),
        },
      });

      return balanceSheet;
    }),

  // =====================================
  // Export Balance Sheet
  // =====================================
  export: protectedProcedure
    .input(ExportBalanceSheetInput)
    .output(BalanceSheetExportOutput)
    .mutation(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      // Generate balance sheet first
      const balanceSheet = await ctx.caller.balanceSheet.generate({
        reportDate: input.reportDate,
        comparativeDate: input.comparativeDate,
        includeDrafts: false,
      });

      let fileContent: Buffer;
      let fileName: string;
      let mimeType: string;

      const dateStr = input.reportDate.toISOString().split('T')[0];

      switch (input.format) {
        case 'EXCEL':
          fileContent = await generateExcelBalanceSheet(balanceSheet, input);
          fileName = `Bilans_${dateStr}.xlsx`;
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;

        case 'PDF':
          fileContent = await generatePDFBalanceSheet(balanceSheet, input);
          fileName = `Bilans_${dateStr}.pdf`;
          mimeType = 'application/pdf';
          break;

        case 'CSV':
          fileContent = generateCSVBalanceSheet(balanceSheet, input);
          fileName = `Bilans_${dateStr}.csv`;
          mimeType = 'text/csv';
          break;

        case 'XML':
          fileContent = generateXMLBalanceSheet(balanceSheet);
          fileName = `Bilans_${dateStr}.xml`;
          mimeType = 'application/xml';
          break;
      }

      // Log export
      await ctx.audit.log({
        action: 'BALANCE_SHEET_EXPORTED',
        entityType: 'BalanceSheet',
        entityId: `${organizationId}-${input.reportDate.toISOString()}`,
        metadata: {
          format: input.format,
          fileName,
        },
      });

      return {
        fileName,
        fileContent: fileContent.toString('base64'),
        mimeType,
        fileSize: fileContent.length,
      };
    }),

  // =====================================
  // Save Balance Sheet Report
  // =====================================
  save: protectedProcedure
    .input(SaveBalanceSheetInput)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.session;

      // Generate balance sheet
      const balanceSheet = await ctx.caller.balanceSheet.generate({
        reportDate: input.reportDate,
        comparativeDate: input.comparativeDate,
        includeDrafts: false,
      });

      // Validate before saving as final
      if (input.markAsFinal && !balanceSheet.isBalanced) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot mark unbalanced balance sheet as final',
        });
      }

      // Upsert report
      const [saved] = await db
        .insert(balanceSheetReports)
        .values({
          organizationId,
          reportDate: input.reportDate,
          comparativeDate: input.comparativeDate,
          reportName: input.reportName || `Bilans ${input.reportDate.toISOString().split('T')[0]}`,
          totalAssets: balanceSheet.assets.totalAssets.currentPeriod,
          totalLiabilities: balanceSheet.liabilities.totalLiabilities.currentPeriod,
          totalEquity: balanceSheet.equity.totalEquity.currentPeriod,
          reportData: balanceSheet,
          isFinal: input.markAsFinal,
          finalizedAt: input.markAsFinal ? new Date() : null,
          finalizedBy: input.markAsFinal ? userId : null,
          createdBy: userId,
        })
        .onConflictDoUpdate({
          target: [balanceSheetReports.organizationId, balanceSheetReports.reportDate, balanceSheetReports.comparativeDate],
          set: {
            reportName: input.reportName,
            totalAssets: balanceSheet.assets.totalAssets.currentPeriod,
            totalLiabilities: balanceSheet.liabilities.totalLiabilities.currentPeriod,
            totalEquity: balanceSheet.equity.totalEquity.currentPeriod,
            reportData: balanceSheet,
            isFinal: input.markAsFinal,
            finalizedAt: input.markAsFinal ? new Date() : null,
            finalizedBy: input.markAsFinal ? userId : null,
          },
        })
        .returning();

      await ctx.audit.log({
        action: input.markAsFinal ? 'BALANCE_SHEET_FINALIZED' : 'BALANCE_SHEET_SAVED',
        entityType: 'BalanceSheetReport',
        entityId: saved.id,
        metadata: {
          reportDate: input.reportDate.toISOString(),
          isFinal: input.markAsFinal,
        },
      });

      return saved;
    }),

  // =====================================
  // List Saved Reports
  // =====================================
  list: protectedProcedure
    .input(z.object({
      year: z.number().int().optional(),
      isFinal: z.boolean().optional(),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      const conditions = [eq(balanceSheetReports.organizationId, organizationId)];

      if (input.year) {
        conditions.push(
          sql`EXTRACT(YEAR FROM ${balanceSheetReports.reportDate}) = ${input.year}`
        );
      }

      if (input.isFinal !== undefined) {
        conditions.push(eq(balanceSheetReports.isFinal, input.isFinal));
      }

      const reports = await db.query.balanceSheetReports.findMany({
        where: and(...conditions),
        orderBy: desc(balanceSheetReports.reportDate),
        limit: input.limit,
        offset: input.offset,
      });

      const totalCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(balanceSheetReports)
        .where(and(...conditions));

      return {
        reports,
        pagination: {
          total: totalCount[0].count,
          limit: input.limit,
          offset: input.offset,
          hasMore: input.offset + reports.length < totalCount[0].count,
        },
      };
    }),
});

// =====================================
// Helper Functions
// =====================================

async function getAccountBalancesAtDate(
  organizationId: string,
  date: Date,
  includeDrafts: boolean
): Promise<Map<string, { balance: Decimal; normalBalance: 'DEBIT' | 'CREDIT' }>> {
  const statusFilter = includeDrafts
    ? sql`je.status IN ('POSTED', 'DRAFT')`
    : sql`je.status = 'POSTED'`;

  const results = await db.execute(sql`
    SELECT
      coa.account_code,
      coa.normal_balance,
      COALESCE(SUM(jl.debit), 0) as total_debit,
      COALESCE(SUM(jl.credit), 0) as total_credit
    FROM chart_of_accounts coa
    LEFT JOIN journal_lines jl ON jl.account_id = coa.id
    LEFT JOIN journal_entries je ON jl.journal_entry_id = je.id
      AND je.entry_date <= ${date}
      AND ${statusFilter}
    WHERE coa.organization_id = ${organizationId}
      AND coa.is_active = true
      AND coa.is_header_account = false
    GROUP BY coa.id, coa.account_code, coa.normal_balance
  `);

  const balances = new Map<string, { balance: Decimal; normalBalance: 'DEBIT' | 'CREDIT' }>();

  for (const row of results.rows) {
    const totalDebit = new Decimal(row.total_debit || 0);
    const totalCredit = new Decimal(row.total_credit || 0);
    const balance = row.normal_balance === 'DEBIT'
      ? totalDebit.sub(totalCredit)
      : totalCredit.sub(totalDebit);

    balances.set(row.account_code, {
      balance,
      normalBalance: row.normal_balance,
    });
  }

  return balances;
}

async function calculateNetIncome(
  organizationId: string,
  date: Date,
  includeDrafts: boolean
): Promise<Decimal> {
  // Get start of fiscal year
  const fiscalYearStart = new Date(date.getFullYear(), 0, 1);

  const statusFilter = includeDrafts
    ? sql`je.status IN ('POSTED', 'DRAFT')`
    : sql`je.status = 'POSTED'`;

  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN coa.account_type = 'REVENUE' THEN jl.credit - jl.debit ELSE 0 END), 0) as total_revenue,
      COALESCE(SUM(CASE WHEN coa.account_type IN ('OPERATING_EXPENSES', 'COST_OF_GOODS_SOLD', 'OTHER_EXPENSES', 'TAX_EXPENSE')
        THEN jl.debit - jl.credit ELSE 0 END), 0) as total_expenses
    FROM journal_lines jl
    INNER JOIN journal_entries je ON jl.journal_entry_id = je.id
    INNER JOIN chart_of_accounts coa ON jl.account_id = coa.id
    WHERE je.organization_id = ${organizationId}
      AND je.entry_date >= ${fiscalYearStart}
      AND je.entry_date <= ${date}
      AND ${statusFilter}
      AND coa.account_code LIKE '7%' OR coa.account_code LIKE '4%' OR coa.account_code LIKE '5%'
  `);

  const totalRevenue = new Decimal(result.rows[0].total_revenue || 0);
  const totalExpenses = new Decimal(result.rows[0].total_expenses || 0);

  return totalRevenue.sub(totalExpenses);
}

function buildBalanceSheet(
  organization: Organization,
  reportDate: Date,
  comparativeDate: Date | undefined,
  accountBalances: Map<string, { balance: Decimal; normalBalance: 'DEBIT' | 'CREDIT' }>,
  comparativeBalances: Map<string, { balance: Decimal; normalBalance: 'DEBIT' | 'CREDIT' }> | undefined,
  netIncome: Decimal,
  userId: string
): BalanceSheet {
  // Helper to create a line
  const createLine = (
    code: string,
    namePl: string,
    accountPattern: string | null,
    balanceType?: 'DEBIT' | 'CREDIT'
  ): BalanceSheetLine => {
    let currentAmount = new Decimal(0);
    let priorAmount = new Decimal(0);
    const contributingAccounts: string[] = [];

    for (const [accountCode, data] of accountBalances) {
      if (matchesPattern(accountCode, accountPattern, balanceType, data.normalBalance)) {
        currentAmount = currentAmount.add(data.balance);
        contributingAccounts.push(accountCode);
      }
    }

    if (comparativeBalances) {
      for (const [accountCode, data] of comparativeBalances) {
        if (matchesPattern(accountCode, accountPattern, balanceType, data.normalBalance)) {
          priorAmount = priorAmount.add(data.balance);
        }
      }
    }

    const variance = currentAmount.sub(priorAmount).toNumber();
    const variancePercent = priorAmount.isZero()
      ? 0
      : currentAmount.sub(priorAmount).div(priorAmount.abs()).mul(100).toNumber();

    return {
      lineCode: code,
      lineNamePl: namePl,
      section: code.startsWith('A') ? 'ASSETS' : code.startsWith('B') ? 'LIABILITIES' : 'EQUITY',
      indentLevel: code.split('.').length - 1,
      currentPeriod: currentAmount.toNumber(),
      priorPeriod: comparativeBalances ? priorAmount.toNumber() : undefined,
      variance: comparativeBalances ? variance : undefined,
      variancePercent: comparativeBalances ? variancePercent : undefined,
      isHeader: false,
      isTotal: false,
      accounts: contributingAccounts.length > 0 ? contributingAccounts : undefined,
    };
  };

  // Build full structure following Polish standards
  // ... (implementation continues with full structure)

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    nip: organization.nip,
    reportDate,
    comparativeDate,
    assets: {
      fixedAssets: {
        intangibleAssets: createLine('A.I', 'Wartości niematerialne i prawne', '02%'),
        tangibleAssets: createLine('A.II', 'Rzeczowe aktywa trwałe', '0[1345]%'),
        longTermReceivables: createLine('A.III', 'Należności długoterminowe', null),
        longTermInvestments: createLine('A.IV', 'Inwestycje długoterminowe', '03%'),
        longTermPrepayments: createLine('A.V', 'Długoterminowe rozliczenia międzyokresowe', null),
        total: { /* calculated total */ } as BalanceSheetLine,
      },
      currentAssets: {
        inventory: createLine('B.I', 'Zapasy', '3%'),
        shortTermReceivables: createLine('B.II', 'Należności krótkoterminowe', '2%', 'DEBIT'),
        shortTermInvestments: createLine('B.III', 'Inwestycje krótkoterminowe', '14%'),
        cash: createLine('B.III.1c', 'Środki pieniężne', '1[0123]%'),
        shortTermPrepayments: createLine('B.IV', 'Krótkoterminowe rozliczenia międzyokresowe', '64%'),
        total: { /* calculated total */ } as BalanceSheetLine,
      },
      totalAssets: { /* sum of fixed + current */ } as BalanceSheetLine,
    },
    equity: {
      shareCapital: createLine('A.I', 'Kapitał podstawowy', '801%'),
      supplementaryCapital: createLine('A.II', 'Kapitał zapasowy', '802%'),
      revaluationReserve: createLine('A.III', 'Kapitał z aktualizacji wyceny', '803%'),
      otherReserves: createLine('A.IV', 'Pozostałe kapitały rezerwowe', '804%'),
      priorYearsProfitLoss: createLine('A.V', 'Zysk/strata z lat ubiegłych', '82%'),
      currentYearProfitLoss: {
        lineCode: 'A.VI',
        lineNamePl: 'Zysk (strata) netto',
        section: 'EQUITY',
        indentLevel: 1,
        currentPeriod: netIncome.toNumber(),
        isHeader: false,
        isTotal: false,
      },
      totalEquity: { /* sum of equity components */ } as BalanceSheetLine,
    },
    liabilities: {
      provisions: createLine('B.I', 'Rezerwy na zobowiązania', '83%'),
      longTermLiabilities: createLine('B.II', 'Zobowiązania długoterminowe', null),
      shortTermLiabilities: createLine('B.III', 'Zobowiązania krótkoterminowe', '2%', 'CREDIT'),
      accruals: createLine('B.IV', 'Rozliczenia międzyokresowe', '84%'),
      totalLiabilities: { /* sum */ } as BalanceSheetLine,
    },
    totalEquityAndLiabilities: { /* equity + liabilities */ } as BalanceSheetLine,
    isBalanced: false, // calculated after
    balanceDifference: 0, // calculated after
    generatedAt: new Date(),
    generatedBy: userId,
  };
}

function matchesPattern(
  accountCode: string,
  pattern: string | null,
  balanceType: 'DEBIT' | 'CREDIT' | undefined,
  normalBalance: 'DEBIT' | 'CREDIT'
): boolean {
  if (!pattern) return false;

  // Convert SQL LIKE pattern to regex
  const regex = new RegExp('^' + pattern.replace(/%/g, '.*').replace(/\[/g, '[').replace(/\]/g, ']') + '$');
  if (!regex.test(accountCode)) return false;

  // Filter by balance type if specified
  if (balanceType && normalBalance !== balanceType) return false;

  return true;
}

async function generateExcelBalanceSheet(
  balanceSheet: BalanceSheet,
  input: ExportBalanceSheetInput
): Promise<Buffer> {
  const workbook = XLSX.utils.book_new();

  // Create data rows
  const rows: any[][] = [
    ['BILANS'],
    [`Sporządzony na dzień: ${balanceSheet.reportDate.toLocaleDateString('pl-PL')}`],
    [`Firma: ${balanceSheet.organizationName}`],
    [`NIP: ${balanceSheet.nip}`],
    [],
    input.comparativeDate
      ? ['Pozycja', 'Bieżący okres', 'Poprzedni okres', 'Zmiana', 'Zmiana %']
      : ['Pozycja', 'Kwota'],
    [],
    ['AKTYWA'],
    // ... all asset lines
    [],
    ['PASYWA'],
    ['A. Kapitał własny'],
    // ... all equity lines
    ['B. Zobowiązania'],
    // ... all liability lines
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 50 }, // Position name
    { wch: 15 }, // Current period
    { wch: 15 }, // Prior period
    { wch: 15 }, // Variance
    { wch: 10 }, // Variance %
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Bilans');

  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

async function generatePDFBalanceSheet(
  balanceSheet: BalanceSheet,
  input: ExportBalanceSheetInput
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Register Polish font
    doc.registerFont('DejaVu', 'fonts/DejaVuSans.ttf');
    doc.font('DejaVu');

    // Header
    doc.fontSize(16).text('BILANS', { align: 'center' });
    doc.fontSize(10).text(
      `Sporządzony na dzień ${balanceSheet.reportDate.toLocaleDateString('pl-PL')}`,
      { align: 'center' }
    );
    doc.moveDown();
    doc.text(`Jednostka: ${balanceSheet.organizationName}`);
    doc.text(`NIP: ${balanceSheet.nip}`);
    doc.moveDown(2);

    // Table with balance sheet lines
    // ... (implementation continues)

    // Signatures section
    if (input.includeSignatures) {
      doc.moveDown(4);
      doc.text('_______________________', 100, doc.y);
      doc.text('_______________________', 350, doc.y - 12);
      doc.text('Sporządził', 130, doc.y);
      doc.text('Zatwierdził', 385, doc.y - 12);
    }

    doc.end();
  });
}

function generateCSVBalanceSheet(balanceSheet: BalanceSheet, input: ExportBalanceSheetInput): Buffer {
  const lines: string[] = [
    '"Pozycja";"Kwota bieżąca";"Kwota poprzednia"',
    // ... all lines
  ];

  return Buffer.from(lines.join('\n'), 'utf-8');
}

function generateXMLBalanceSheet(balanceSheet: BalanceSheet): Buffer {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Bilans>
  <NaglowekRaportu>
    <DataRaportu>${balanceSheet.reportDate.toISOString()}</DataRaportu>
    <NIP>${balanceSheet.nip}</NIP>
    <NazwaJednostki>${balanceSheet.organizationName}</NazwaJednostki>
  </NaglowekRaportu>
  <Aktywa>
    <AktywaTrwale>
      <!-- ... -->
    </AktywaTrwale>
    <AktywaObrotowe>
      <!-- ... -->
    </AktywaObrotowe>
  </Aktywa>
  <Pasywa>
    <KapitalWlasny>
      <!-- ... -->
    </KapitalWlasny>
    <Zobowiazania>
      <!-- ... -->
    </Zobowiazania>
  </Pasywa>
</Bilans>`;

  return Buffer.from(xml, 'utf-8');
}
```

---

## Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Decimal } from 'decimal.js';

describe('BalanceSheetService', () => {
  describe('generate', () => {
    it('should generate balance sheet with correct totals', async () => {
      // Arrange
      const mockAccountBalances = new Map([
        ['100', { balance: new Decimal(50000), normalBalance: 'DEBIT' as const }],
        ['200', { balance: new Decimal(30000), normalBalance: 'CREDIT' as const }],
        ['801', { balance: new Decimal(20000), normalBalance: 'CREDIT' as const }],
      ]);

      vi.spyOn(service, 'getAccountBalancesAtDate').mockResolvedValue(mockAccountBalances);
      vi.spyOn(service, 'calculateNetIncome').mockResolvedValue(new Decimal(0));

      // Act
      const result = await service.generate({
        reportDate: new Date('2024-01-31'),
      });

      // Assert
      expect(result.isBalanced).toBe(true);
      expect(result.assets.totalAssets.currentPeriod).toBe(50000);
      expect(result.totalEquityAndLiabilities.currentPeriod).toBe(50000);
    });

    it('should include net income in equity section', async () => {
      // Arrange
      const netIncome = new Decimal(15000);
      vi.spyOn(service, 'calculateNetIncome').mockResolvedValue(netIncome);

      // Act
      const result = await service.generate({
        reportDate: new Date('2024-01-31'),
      });

      // Assert
      expect(result.equity.currentYearProfitLoss.currentPeriod).toBe(15000);
    });

    it('should calculate variances for comparative report', async () => {
      // Arrange
      const currentBalances = new Map([
        ['100', { balance: new Decimal(60000), normalBalance: 'DEBIT' as const }],
      ]);
      const priorBalances = new Map([
        ['100', { balance: new Decimal(50000), normalBalance: 'DEBIT' as const }],
      ]);

      vi.spyOn(service, 'getAccountBalancesAtDate')
        .mockResolvedValueOnce(currentBalances)
        .mockResolvedValueOnce(priorBalances);

      // Act
      const result = await service.generate({
        reportDate: new Date('2024-01-31'),
        comparativeDate: new Date('2023-12-31'),
      });

      // Assert
      const cashLine = result.assets.currentAssets.cash;
      expect(cashLine.variance).toBe(10000);
      expect(cashLine.variancePercent).toBeCloseTo(20, 1);
    });

    it('should map accounts to correct balance sheet lines', async () => {
      // Arrange
      const balances = new Map([
        ['010', { balance: new Decimal(100000), normalBalance: 'DEBIT' as const }], // Fixed assets
        ['130', { balance: new Decimal(25000), normalBalance: 'DEBIT' as const }],  // Cash
        ['310', { balance: new Decimal(15000), normalBalance: 'DEBIT' as const }],  // Inventory
        ['801', { balance: new Decimal(140000), normalBalance: 'CREDIT' as const }], // Equity
      ]);

      vi.spyOn(service, 'getAccountBalancesAtDate').mockResolvedValue(balances);
      vi.spyOn(service, 'calculateNetIncome').mockResolvedValue(new Decimal(0));

      // Act
      const result = await service.generate({
        reportDate: new Date('2024-01-31'),
      });

      // Assert
      expect(result.assets.fixedAssets.tangibleAssets.currentPeriod).toBe(100000);
      expect(result.assets.currentAssets.cash.currentPeriod).toBe(25000);
      expect(result.assets.currentAssets.inventory.currentPeriod).toBe(15000);
      expect(result.equity.shareCapital.currentPeriod).toBe(140000);
    });
  });

  describe('export', () => {
    it('should export balance sheet to Excel format', async () => {
      // Arrange
      const mockBalanceSheet = createMockBalanceSheet();
      vi.spyOn(service, 'generate').mockResolvedValue(mockBalanceSheet);

      // Act
      const result = await service.export({
        reportDate: new Date('2024-01-31'),
        format: 'EXCEL',
        language: 'PL',
      });

      // Assert
      expect(result.fileName).toMatch(/Bilans_.*\.xlsx/);
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(result.fileContent).toBeTruthy();
    });

    it('should export balance sheet to PDF format', async () => {
      // Arrange
      const mockBalanceSheet = createMockBalanceSheet();
      vi.spyOn(service, 'generate').mockResolvedValue(mockBalanceSheet);

      // Act
      const result = await service.export({
        reportDate: new Date('2024-01-31'),
        format: 'PDF',
        language: 'PL',
        includeSignatures: true,
      });

      // Assert
      expect(result.fileName).toMatch(/Bilans_.*\.pdf/);
      expect(result.mimeType).toBe('application/pdf');
    });
  });
});
```

### Integration Tests

```typescript
describe('Balance Sheet Integration', () => {
  it('should generate balance sheet reflecting all posted entries', async () => {
    // Arrange: Create and post journal entries
    await createAndPostEntry({
      description: 'Cash receipt',
      lines: [
        { accountCode: '130', debit: 10000, credit: 0 },
        { accountCode: '700', debit: 0, credit: 10000 },
      ],
    });

    await createAndPostEntry({
      description: 'Purchase inventory',
      lines: [
        { accountCode: '310', debit: 3000, credit: 0 },
        { accountCode: '130', debit: 0, credit: 3000 },
      ],
    });

    // Act
    const balanceSheet = await caller.balanceSheet.generate({
      reportDate: new Date('2024-01-31'),
    });

    // Assert
    expect(balanceSheet.assets.currentAssets.cash.currentPeriod).toBe(7000); // 10000 - 3000
    expect(balanceSheet.assets.currentAssets.inventory.currentPeriod).toBe(3000);
    expect(balanceSheet.isBalanced).toBe(true);
  });

  it('should exclude draft entries when includeDrafts is false', async () => {
    // Arrange: Create draft entry (not posted)
    await createEntry({
      description: 'Draft entry',
      lines: [
        { accountCode: '130', debit: 5000, credit: 0 },
        { accountCode: '700', debit: 0, credit: 5000 },
      ],
      status: 'DRAFT',
    });

    // Act
    const balanceSheet = await caller.balanceSheet.generate({
      reportDate: new Date('2024-01-31'),
      includeDrafts: false,
    });

    // Assert
    expect(balanceSheet.assets.currentAssets.cash.currentPeriod).toBe(0);
  });

  it('should save and retrieve balance sheet report', async () => {
    // Arrange
    await caller.balanceSheet.save({
      reportDate: new Date('2024-01-31'),
      reportName: 'January 2024 Balance Sheet',
      markAsFinal: true,
    });

    // Act
    const reports = await caller.balanceSheet.list({
      year: 2024,
      isFinal: true,
    });

    // Assert
    expect(reports.reports).toHaveLength(1);
    expect(reports.reports[0].reportName).toBe('January 2024 Balance Sheet');
    expect(reports.reports[0].isFinal).toBe(true);
  });
});
```

### E2E Tests

```typescript
describe('Balance Sheet E2E', () => {
  it('should complete full balance sheet workflow', async () => {
    // 1. Login as accountant
    await page.goto('/login');
    await page.fill('[name="email"]', 'accountant@test.pl');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // 2. Navigate to reports
    await page.click('text=Raporty');
    await page.click('text=Bilans');

    // 3. Generate balance sheet
    await page.fill('[name="reportDate"]', '2024-01-31');
    await page.click('text=Generuj');

    // 4. Verify balance sheet displayed
    await expect(page.locator('text=AKTYWA')).toBeVisible();
    await expect(page.locator('text=PASYWA')).toBeVisible();
    await expect(page.locator('text=Suma aktywów')).toBeVisible();

    // 5. Verify balance
    const assetsTotal = await page.locator('[data-testid="total-assets"]').textContent();
    const liabilitiesTotal = await page.locator('[data-testid="total-liabilities"]').textContent();
    expect(assetsTotal).toBe(liabilitiesTotal);

    // 6. Export to PDF
    await page.click('text=Eksportuj');
    await page.click('text=PDF');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('text=Pobierz'),
    ]);

    expect(download.suggestedFilename()).toMatch(/Bilans.*\.pdf/);
  });
});
```

---

## Security Checklist

- [x] Authentication required for all endpoints
- [x] Organization-level data isolation via RLS
- [x] Input validation with Zod schemas
- [x] Audit logging for all report generation and exports
- [x] Sensitive data (NIP) properly handled
- [x] Export files don't expose internal IDs
- [x] Rate limiting on export endpoints
- [x] PDF/Excel generation sandboxed

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `BALANCE_SHEET_GENERATED` | Report generated | reportDate, isBalanced, totalAssets |
| `BALANCE_SHEET_EXPORTED` | Export requested | format, fileName |
| `BALANCE_SHEET_SAVED` | Report saved | reportId, reportDate |
| `BALANCE_SHEET_FINALIZED` | Report marked final | reportId, finalizedBy |

---

## Implementation Notes

### Polish Accounting Standards
- Follow Załącznik nr 1 to Ustawa o rachunkowości for structure
- Account class mapping: 0=Fixed assets, 1=Cash, 2=Receivables/Payables, 3=Inventory, 8=Equity
- Net income calculated from class 7 (Revenue) minus classes 4,5 (Expenses)

### Performance Considerations
- Cache account balances for repeated queries
- Use materialized views for large organizations
- Paginate account-level detail in exports
- Target <500ms generation time

### Dependencies
- ACC-012 (Trial Balance) for balance calculation logic
- Decimal.js for monetary precision
- XLSX library for Excel export
- PDFKit for PDF generation
- Polish fonts (DejaVu) for proper character rendering

---

*Last updated: December 2024*
