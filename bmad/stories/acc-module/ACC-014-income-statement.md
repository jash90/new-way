# ACC-014: Income Statement (Rachunek Zysków i Strat - RZiS)

> **Story ID**: ACC-014
> **Epic**: ACC - Accounting Engine Module
> **Priority**: P0 (Critical)
> **Points**: 13
> **Status**: 📋 Ready for Development
> **Sprint**: Week 11

---

## User Story

**As an** accountant managing Polish companies,
**I want to** generate an Income Statement (Rachunek Zysków i Strat) compliant with Polish accounting standards,
**So that** I can report profitability and submit required financial statements to authorities.

---

## Dependencies

### Requires
- **ACC-001**: Chart of Accounts Management (account structure)
- **ACC-008**: General Ledger (account balances and transactions)
- **ACC-012**: Trial Balance (balance verification)

### Enables
- **ACC-015**: JPK-KR Export (complete financial statement data)
- **TAX-xxx**: Corporate Income Tax (CIT) calculations

---

## Acceptance Criteria

### AC1: Income Statement Generation (Porównawczy / Kalkulacyjny)

```gherkin
Feature: Income Statement Generation
  As an accountant
  I need to generate Income Statement per Polish standards
  So that I can report company profitability

  Background:
    Given I am authenticated as an accountant
    And organization "Test Sp. z o.o." has chart of accounts
    And accounting period "2024" has posted journal entries

  Scenario: Generate comparative Income Statement (Rachunek porównawczy)
    Given organization uses comparative format (wariant porównawczy)
    And revenue accounts have transactions totaling "250,000.00 PLN"
    And cost accounts (klasa 4) have transactions totaling "180,000.00 PLN"
    When I generate Income Statement for period "2024-01-01" to "2024-12-31"
    Then Income Statement contains section "A. Przychody netto ze sprzedaży i zrównane z nimi"
    And Income Statement contains section "B. Koszty działalności operacyjnej"
    And net profit (Zysk netto) equals "70,000.00 PLN"
    And all sections follow Załącznik nr 1 structure

  Scenario: Generate cost-by-function Income Statement (Rachunek kalkulacyjny)
    Given organization uses cost-by-function format (wariant kalkulacyjny)
    And revenue accounts have transactions
    And cost accounts (klasa 5) have functional allocations
    When I generate Income Statement for period "2024-01-01" to "2024-12-31"
    Then Income Statement contains section "A. Przychody netto ze sprzedaży produktów"
    And Income Statement contains section "B. Koszty sprzedanych produktów"
    And contains "Koszty sprzedaży" and "Koszty ogólnego zarządu"
    And net profit equals calculated difference

  Scenario: Generate with prior period comparison
    Given I have completed periods "2023" and "2024"
    When I generate Income Statement with comparison enabled
    Then report shows columns for both periods
    And shows variance amounts and percentages
    And highlights significant changes (>10%)
```

### AC2: Income Statement Structure (Załącznik nr 1)

```gherkin
Feature: Polish Income Statement Structure
  As an accountant
  I need Income Statement to follow official Polish template
  So that reports meet regulatory requirements

  Scenario: Validate comparative format structure
    When I generate comparative Income Statement
    Then report contains following sections in order:
      | Section | Name                                                |
      | A       | Przychody netto ze sprzedaży i zrównane z nimi     |
      | A.I     | Przychody netto ze sprzedaży produktów             |
      | A.II    | Zmiana stanu produktów                              |
      | A.III   | Koszt wytworzenia produktów na własne potrzeby      |
      | A.IV    | Przychody netto ze sprzedaży towarów i materiałów   |
      | B       | Koszty działalności operacyjnej                     |
      | B.I     | Amortyzacja                                         |
      | B.II    | Zużycie materiałów i energii                        |
      | B.III   | Usługi obce                                         |
      | B.IV    | Podatki i opłaty                                    |
      | B.V     | Wynagrodzenia                                       |
      | B.VI    | Ubezpieczenia społeczne i inne świadczenia          |
      | B.VII   | Pozostałe koszty rodzajowe                          |
      | B.VIII  | Wartość sprzedanych towarów i materiałów            |
      | C       | Zysk (strata) ze sprzedaży (A-B)                    |
      | D       | Pozostałe przychody operacyjne                      |
      | E       | Pozostałe koszty operacyjne                         |
      | F       | Zysk (strata) z działalności operacyjnej (C+D-E)   |
      | G       | Przychody finansowe                                 |
      | H       | Koszty finansowe                                    |
      | I       | Zysk (strata) brutto (F+G-H)                       |
      | J       | Podatek dochodowy                                   |
      | K       | Pozostałe obowiązkowe zmniejszenia zysku            |
      | L       | Zysk (strata) netto (I-J-K)                        |
    And each section calculates automatically from mapped accounts

  Scenario: Validate cost-by-function structure
    When I generate cost-by-function Income Statement
    Then report contains following sections:
      | Section | Name                                    |
      | A       | Przychody netto ze sprzedaży produktów |
      | B       | Koszty sprzedanych produktów           |
      | C       | Zysk (strata) brutto ze sprzedaży      |
      | D       | Koszty sprzedaży                        |
      | E       | Koszty ogólnego zarządu                 |
      | F       | Zysk (strata) ze sprzedaży             |
    And subsequent sections follow same pattern as comparative
```

### AC3: Account Mapping Configuration

```gherkin
Feature: Account to Income Statement Line Mapping
  As an accountant
  I need to map accounts to Income Statement lines
  So that data flows correctly into reports

  Scenario: Default Polish account mapping
    Given organization uses Polish chart of accounts template
    When Income Statement is generated
    Then accounts 700-* map to "Przychody ze sprzedaży produktów"
    And accounts 401 map to "Amortyzacja"
    And accounts 402 map to "Zużycie materiałów i energii"
    And accounts 403 map to "Usługi obce"
    And accounts 404 map to "Podatki i opłaty"
    And accounts 405 map to "Wynagrodzenia"
    And accounts 406 map to "Ubezpieczenia społeczne"
    And accounts 409 map to "Pozostałe koszty rodzajowe"
    And accounts 750 map to "Pozostałe przychody operacyjne"
    And accounts 751 map to "Pozostałe koszty operacyjne"
    And accounts 760 map to "Przychody finansowe"
    And accounts 761 map to "Koszty finansowe"

  Scenario: Custom account mapping
    Given I want to override default mapping
    When I configure account "702" to map to "A.III" line
    And I save mapping configuration
    Then account 702 transactions appear in "Koszt wytworzenia na własne potrzeby"
    And mapping persists across report generations
```

### AC4: Export Formats

```gherkin
Feature: Income Statement Export
  As an accountant
  I need to export Income Statement in various formats
  So that I can share with stakeholders and authorities

  Scenario: Export to Excel (XLSX)
    When I export Income Statement as Excel
    Then file contains formatted worksheet "RZiS"
    And includes header with company name and period
    And columns are properly sized
    And numbers use Polish formatting (1 234,56 zł)
    And file opens correctly in Microsoft Excel

  Scenario: Export to PDF
    When I export Income Statement as PDF
    Then PDF uses A4 page size
    And includes company letterhead if configured
    And uses Polish fonts (DejaVu Sans)
    And includes page numbers and generation timestamp
    And is suitable for official submissions

  Scenario: Export to XML (JPK compatible)
    When I export Income Statement as XML
    Then XML follows JPK_SF schema
    And contains all required elements
    And validates against official XSD
    And is ready for JPK submission

  Scenario: Export to CSV
    When I export Income Statement as CSV
    Then file contains all line items
    And uses semicolon separator
    And encoding is UTF-8 with BOM
    And is importable to other accounting software
```

### AC5: Validation and Integrity

```gherkin
Feature: Income Statement Validation
  As an accountant
  I need validation to ensure data integrity
  So that reports are accurate and reliable

  Scenario: Validate calculation accuracy
    Given revenue section totals "250,000.00 PLN"
    And cost section totals "180,000.00 PLN"
    When I validate Income Statement calculations
    Then "Zysk ze sprzedaży" equals "70,000.00 PLN"
    And each subtotal matches sum of child items
    And final "Zysk netto" is mathematically correct

  Scenario: Validate account completeness
    Given chart of accounts has 45 revenue/expense accounts
    When I generate Income Statement
    Then all 45 accounts are mapped to report lines
    And no orphan accounts exist
    And warning shown if unmapped accounts found

  Scenario: Validate against trial balance
    Given Trial Balance shows total revenues "250,000.00 PLN"
    And Trial Balance shows total expenses "200,000.00 PLN"
    When I generate Income Statement
    Then revenue total matches Trial Balance
    And expense total matches Trial Balance
    And reconciliation report available

  Scenario: Handle period not closed warning
    Given period "2024-12" is still open
    When I generate Income Statement including December
    Then warning banner shows "Period contains draft entries"
    And report marked as "PRELIMINARY"
    And draft amounts shown separately if requested
```

---

## Technical Specification

### Database Schema

```sql
-- =====================================
-- Income Statement Reports Table
-- =====================================
CREATE TABLE income_statement_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Report identification
  report_number VARCHAR(50) NOT NULL,
  report_name VARCHAR(255) NOT NULL,

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  fiscal_year INTEGER NOT NULL,

  -- Report type
  statement_variant VARCHAR(20) NOT NULL CHECK (statement_variant IN ('COMPARATIVE', 'COST_BY_FUNCTION')),

  -- Comparison
  comparison_enabled BOOLEAN DEFAULT FALSE,
  comparison_period_start DATE,
  comparison_period_end DATE,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  is_preliminary BOOLEAN DEFAULT FALSE,

  -- Totals (denormalized for quick access)
  total_revenue DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_costs DECIMAL(15,2) NOT NULL DEFAULT 0,
  operating_profit DECIMAL(15,2) NOT NULL DEFAULT 0,
  gross_profit DECIMAL(15,2) NOT NULL DEFAULT 0,
  net_profit DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Comparison totals
  prev_total_revenue DECIMAL(15,2),
  prev_total_costs DECIMAL(15,2),
  prev_net_profit DECIMAL(15,2),

  -- Report data (full structure)
  report_data JSONB NOT NULL,

  -- Metadata
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  generated_by UUID NOT NULL REFERENCES users(id),
  approved_at TIMESTAMP,
  approved_by UUID REFERENCES users(id),

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, report_number)
);

-- =====================================
-- Income Statement Line Configuration
-- =====================================
CREATE TABLE income_statement_line_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Line identification
  line_code VARCHAR(20) NOT NULL,
  line_name VARCHAR(255) NOT NULL,
  line_name_pl VARCHAR(255) NOT NULL,

  -- Hierarchy
  parent_line_code VARCHAR(20),
  display_order INTEGER NOT NULL,
  indent_level INTEGER NOT NULL DEFAULT 0,

  -- Statement variant
  statement_variant VARCHAR(20) NOT NULL,

  -- Calculation
  calculation_type VARCHAR(20) NOT NULL DEFAULT 'SUM',
  sign_convention VARCHAR(10) NOT NULL DEFAULT 'POSITIVE',

  -- Display
  is_header BOOLEAN DEFAULT FALSE,
  is_subtotal BOOLEAN DEFAULT FALSE,
  is_total BOOLEAN DEFAULT FALSE,
  show_zero BOOLEAN DEFAULT TRUE,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, statement_variant, line_code)
);

-- =====================================
-- Account to Income Statement Mapping
-- =====================================
CREATE TABLE income_statement_account_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Mapping
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  line_config_id UUID NOT NULL REFERENCES income_statement_line_config(id),

  -- Options
  sign_multiplier INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, account_id)
);

-- Indexes
CREATE INDEX idx_isr_org_period ON income_statement_reports(organization_id, period_start, period_end);
CREATE INDEX idx_isr_status ON income_statement_reports(status);
CREATE INDEX idx_islc_org_variant ON income_statement_line_config(organization_id, statement_variant);
CREATE INDEX idx_isam_account ON income_statement_account_mapping(account_id);
```

### Zod Schemas

```typescript
import { z } from 'zod';
import Decimal from 'decimal.js';

// =====================================
// Enums
// =====================================

export const StatementVariantEnum = z.enum(['COMPARATIVE', 'COST_BY_FUNCTION']);
export type StatementVariant = z.infer<typeof StatementVariantEnum>;

export const CalculationTypeEnum = z.enum(['SUM', 'DIFFERENCE', 'FORMULA']);
export type CalculationType = z.infer<typeof CalculationTypeEnum>;

export const ReportStatusEnum = z.enum(['DRAFT', 'FINAL', 'APPROVED', 'ARCHIVED']);
export type ReportStatus = z.infer<typeof ReportStatusEnum>;

// =====================================
// Income Statement Line Schema
// =====================================

export const IncomeStatementLineSchema = z.object({
  lineCode: z.string().max(20),
  lineName: z.string().max(255),
  lineNamePl: z.string().max(255),
  indentLevel: z.number().int().min(0).max(5),

  // Current period values
  currentAmount: z.instanceof(Decimal),

  // Prior period values (if comparison enabled)
  priorAmount: z.instanceof(Decimal).optional(),
  variance: z.instanceof(Decimal).optional(),
  variancePercent: z.number().optional(),

  // Display flags
  isHeader: z.boolean().default(false),
  isSubtotal: z.boolean().default(false),
  isTotal: z.boolean().default(false),

  // Child lines
  children: z.array(z.lazy(() => IncomeStatementLineSchema)).optional()
});

export type IncomeStatementLine = z.infer<typeof IncomeStatementLineSchema>;

// =====================================
// Income Statement Schema
// =====================================

export const IncomeStatementSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),

  // Identification
  reportNumber: z.string().max(50),
  reportName: z.string().max(255),

  // Period
  periodStart: z.date(),
  periodEnd: z.date(),
  fiscalYear: z.number().int(),

  // Type
  statementVariant: StatementVariantEnum,

  // Comparison
  comparisonEnabled: z.boolean().default(false),
  comparisonPeriodStart: z.date().optional(),
  comparisonPeriodEnd: z.date().optional(),

  // Status
  status: ReportStatusEnum.default('DRAFT'),
  isPreliminary: z.boolean().default(false),

  // Sections (Comparative Format)
  sections: z.object({
    // A. Przychody netto ze sprzedaży i zrównane z nimi
    revenueSection: IncomeStatementLineSchema,

    // B. Koszty działalności operacyjnej
    operatingCostsSection: IncomeStatementLineSchema,

    // C. Zysk (strata) ze sprzedaży
    salesProfit: IncomeStatementLineSchema,

    // D. Pozostałe przychody operacyjne
    otherOperatingRevenue: IncomeStatementLineSchema,

    // E. Pozostałe koszty operacyjne
    otherOperatingCosts: IncomeStatementLineSchema,

    // F. Zysk (strata) z działalności operacyjnej
    operatingProfit: IncomeStatementLineSchema,

    // G. Przychody finansowe
    financialRevenue: IncomeStatementLineSchema,

    // H. Koszty finansowe
    financialCosts: IncomeStatementLineSchema,

    // I. Zysk (strata) brutto
    grossProfit: IncomeStatementLineSchema,

    // J. Podatek dochodowy
    incomeTax: IncomeStatementLineSchema,

    // K. Pozostałe obowiązkowe zmniejszenia zysku
    otherDeductions: IncomeStatementLineSchema,

    // L. Zysk (strata) netto
    netProfit: IncomeStatementLineSchema
  }),

  // Summary totals
  totals: z.object({
    totalRevenue: z.instanceof(Decimal),
    totalCosts: z.instanceof(Decimal),
    operatingProfit: z.instanceof(Decimal),
    grossProfit: z.instanceof(Decimal),
    netProfit: z.instanceof(Decimal),

    // Prior period (if comparison)
    prevTotalRevenue: z.instanceof(Decimal).optional(),
    prevTotalCosts: z.instanceof(Decimal).optional(),
    prevNetProfit: z.instanceof(Decimal).optional()
  }),

  // Metadata
  generatedAt: z.date(),
  generatedBy: z.string().uuid(),
  approvedAt: z.date().optional(),
  approvedBy: z.string().uuid().optional()
});

export type IncomeStatement = z.infer<typeof IncomeStatementSchema>;

// =====================================
// Input Schemas
// =====================================

export const GenerateIncomeStatementInputSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  statementVariant: StatementVariantEnum.default('COMPARATIVE'),
  comparisonEnabled: z.boolean().default(false),
  comparisonPeriodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  comparisonPeriodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  includeDraftEntries: z.boolean().default(false),
  reportName: z.string().max(255).optional()
});

export type GenerateIncomeStatementInput = z.infer<typeof GenerateIncomeStatementInputSchema>;

export const ExportIncomeStatementInputSchema = z.object({
  reportId: z.string().uuid(),
  format: z.enum(['xlsx', 'pdf', 'csv', 'xml']),
  includeCompanyHeader: z.boolean().default(true),
  language: z.enum(['pl', 'en']).default('pl'),
  paperSize: z.enum(['A4', 'Letter']).default('A4')
});

export type ExportIncomeStatementInput = z.infer<typeof ExportIncomeStatementInputSchema>;

// =====================================
// Account Mapping Schema
// =====================================

export const AccountMappingInputSchema = z.object({
  accountId: z.string().uuid(),
  lineCode: z.string().max(20),
  signMultiplier: z.number().int().min(-1).max(1).default(1)
});

export type AccountMappingInput = z.infer<typeof AccountMappingInputSchema>;

export const UpdateMappingsInputSchema = z.object({
  statementVariant: StatementVariantEnum,
  mappings: z.array(AccountMappingInputSchema)
});

export type UpdateMappingsInput = z.infer<typeof UpdateMappingsInputSchema>;
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  GenerateIncomeStatementInputSchema,
  ExportIncomeStatementInputSchema,
  UpdateMappingsInputSchema,
  IncomeStatementSchema,
  StatementVariantEnum
} from './income-statement.schemas';
import { IncomeStatementService } from './income-statement.service';
import { AuditService } from '../audit/audit.service';

export const incomeStatementRouter = router({
  /**
   * Generate Income Statement for specified period
   */
  generate: protectedProcedure
    .input(GenerateIncomeStatementInputSchema)
    .output(IncomeStatementSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.auth;

      // Validate period
      const periodStart = new Date(input.periodStart);
      const periodEnd = new Date(input.periodEnd);

      if (periodEnd < periodStart) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Period end date must be after start date'
        });
      }

      // Generate statement
      const service = new IncomeStatementService(ctx.db, ctx.cache);

      const statement = await service.generateIncomeStatement({
        organizationId,
        periodStart,
        periodEnd,
        statementVariant: input.statementVariant,
        comparisonEnabled: input.comparisonEnabled,
        comparisonPeriodStart: input.comparisonPeriodStart
          ? new Date(input.comparisonPeriodStart)
          : undefined,
        comparisonPeriodEnd: input.comparisonPeriodEnd
          ? new Date(input.comparisonPeriodEnd)
          : undefined,
        includeDraftEntries: input.includeDraftEntries,
        reportName: input.reportName,
        generatedBy: userId
      });

      // Audit log
      await AuditService.log({
        action: 'INCOME_STATEMENT_GENERATED',
        entityType: 'IncomeStatementReport',
        entityId: statement.id,
        organizationId,
        userId,
        metadata: {
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          variant: input.statementVariant,
          netProfit: statement.totals.netProfit.toString()
        }
      });

      return statement;
    }),

  /**
   * Export Income Statement to various formats
   */
  export: protectedProcedure
    .input(ExportIncomeStatementInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.auth;

      const service = new IncomeStatementService(ctx.db, ctx.cache);

      // Get report
      const report = await service.getReport(input.reportId, organizationId);

      if (!report) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Income Statement report not found'
        });
      }

      // Generate export
      let fileBuffer: Buffer;
      let fileName: string;
      let contentType: string;

      switch (input.format) {
        case 'xlsx':
          fileBuffer = await service.exportToExcel(report, {
            includeCompanyHeader: input.includeCompanyHeader,
            language: input.language
          });
          fileName = `RZiS_${report.fiscalYear}.xlsx`;
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;

        case 'pdf':
          fileBuffer = await service.exportToPdf(report, {
            includeCompanyHeader: input.includeCompanyHeader,
            language: input.language,
            paperSize: input.paperSize
          });
          fileName = `RZiS_${report.fiscalYear}.pdf`;
          contentType = 'application/pdf';
          break;

        case 'csv':
          fileBuffer = await service.exportToCsv(report, {
            language: input.language
          });
          fileName = `RZiS_${report.fiscalYear}.csv`;
          contentType = 'text/csv';
          break;

        case 'xml':
          fileBuffer = await service.exportToXml(report);
          fileName = `RZiS_${report.fiscalYear}.xml`;
          contentType = 'application/xml';
          break;
      }

      // Audit log
      await AuditService.log({
        action: 'INCOME_STATEMENT_EXPORTED',
        entityType: 'IncomeStatementReport',
        entityId: report.id,
        organizationId,
        userId,
        metadata: { format: input.format }
      });

      // Return base64 encoded file
      return {
        fileName,
        contentType,
        data: fileBuffer.toString('base64')
      };
    }),

  /**
   * Save generated report
   */
  save: protectedProcedure
    .input(z.object({
      reportId: z.string().uuid(),
      status: ReportStatusEnum.optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.auth;

      const service = new IncomeStatementService(ctx.db, ctx.cache);

      const savedReport = await service.saveReport(
        input.reportId,
        organizationId,
        input.status || 'FINAL',
        userId
      );

      await AuditService.log({
        action: 'INCOME_STATEMENT_SAVED',
        entityType: 'IncomeStatementReport',
        entityId: savedReport.id,
        organizationId,
        userId,
        metadata: { status: savedReport.status }
      });

      return savedReport;
    }),

  /**
   * List saved Income Statement reports
   */
  list: protectedProcedure
    .input(z.object({
      fiscalYear: z.number().int().optional(),
      status: ReportStatusEnum.optional(),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0)
    }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.auth;

      const service = new IncomeStatementService(ctx.db, ctx.cache);

      const { reports, total } = await service.listReports({
        organizationId,
        fiscalYear: input.fiscalYear,
        status: input.status,
        limit: input.limit,
        offset: input.offset
      });

      return {
        reports,
        total,
        hasMore: input.offset + reports.length < total
      };
    }),

  /**
   * Get account mappings for Income Statement
   */
  getMappings: protectedProcedure
    .input(z.object({
      statementVariant: StatementVariantEnum
    }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.auth;

      const service = new IncomeStatementService(ctx.db, ctx.cache);

      return service.getAccountMappings(organizationId, input.statementVariant);
    }),

  /**
   * Update account mappings
   */
  updateMappings: protectedProcedure
    .input(UpdateMappingsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.auth;

      const service = new IncomeStatementService(ctx.db, ctx.cache);

      await service.updateAccountMappings(
        organizationId,
        input.statementVariant,
        input.mappings
      );

      await AuditService.log({
        action: 'INCOME_STATEMENT_MAPPING_UPDATED',
        entityType: 'IncomeStatementMapping',
        entityId: organizationId,
        organizationId,
        userId,
        metadata: {
          variant: input.statementVariant,
          mappingCount: input.mappings.length
        }
      });

      return { success: true };
    }),

  /**
   * Get line configuration
   */
  getLineConfig: protectedProcedure
    .input(z.object({
      statementVariant: StatementVariantEnum
    }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.auth;

      const service = new IncomeStatementService(ctx.db, ctx.cache);

      return service.getLineConfiguration(organizationId, input.statementVariant);
    }),

  /**
   * Validate report against trial balance
   */
  validateAgainstTrialBalance: protectedProcedure
    .input(z.object({
      reportId: z.string().uuid()
    }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.auth;

      const service = new IncomeStatementService(ctx.db, ctx.cache);

      return service.validateAgainstTrialBalance(input.reportId, organizationId);
    })
});
```

### Service Implementation

```typescript
// src/modules/accounting/income-statement/income-statement.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Redis } from 'ioredis';
import Decimal from 'decimal.js';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { XMLBuilder } from 'fast-xml-parser';

import {
  IncomeStatement,
  IncomeStatementLine,
  StatementVariant,
  GenerateIncomeStatementInput
} from './income-statement.schemas';
import { IncomeStatementReport } from './entities/income-statement-report.entity';
import { IncomeStatementLineConfig } from './entities/income-statement-line-config.entity';
import { IncomeStatementAccountMapping } from './entities/income-statement-account-mapping.entity';
import { ChartOfAccount } from '../entities/chart-of-account.entity';
import { JournalLine } from '../entities/journal-line.entity';
import { TrialBalanceService } from '../trial-balance/trial-balance.service';

@Injectable()
export class IncomeStatementService {
  private readonly logger = new Logger(IncomeStatementService.name);
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private readonly dataSource: DataSource,
    private readonly cache: Redis,
    private readonly reportRepo: Repository<IncomeStatementReport>,
    private readonly lineConfigRepo: Repository<IncomeStatementLineConfig>,
    private readonly mappingRepo: Repository<IncomeStatementAccountMapping>,
    private readonly trialBalanceService: TrialBalanceService
  ) {}

  async generateIncomeStatement(
    params: GenerateIncomeStatementInput & {
      organizationId: string;
      generatedBy: string;
    }
  ): Promise<IncomeStatement> {
    const {
      organizationId,
      periodStart,
      periodEnd,
      statementVariant,
      comparisonEnabled,
      comparisonPeriodStart,
      comparisonPeriodEnd,
      includeDraftEntries,
      generatedBy
    } = params;

    this.logger.log(`Generating Income Statement for ${organizationId}`, {
      periodStart,
      periodEnd,
      variant: statementVariant
    });

    // Get line configuration
    const lineConfig = await this.getLineConfiguration(
      organizationId,
      statementVariant
    );

    // Get account mappings
    const mappings = await this.getAccountMappings(
      organizationId,
      statementVariant
    );

    // Calculate current period amounts
    const currentAmounts = await this.calculatePeriodAmounts(
      organizationId,
      periodStart,
      periodEnd,
      mappings,
      includeDraftEntries
    );

    // Calculate prior period amounts if comparison enabled
    let priorAmounts: Map<string, Decimal> | undefined;
    if (comparisonEnabled && comparisonPeriodStart && comparisonPeriodEnd) {
      priorAmounts = await this.calculatePeriodAmounts(
        organizationId,
        comparisonPeriodStart,
        comparisonPeriodEnd,
        mappings,
        false
      );
    }

    // Build sections
    const sections = this.buildSections(
      lineConfig,
      currentAmounts,
      priorAmounts,
      statementVariant
    );

    // Calculate totals
    const totals = this.calculateTotals(sections);

    // Generate report number
    const reportNumber = await this.generateReportNumber(
      organizationId,
      periodEnd.getFullYear()
    );

    // Create statement object
    const statement: IncomeStatement = {
      id: crypto.randomUUID(),
      organizationId,
      reportNumber,
      reportName: params.reportName || `Rachunek Zysków i Strat ${periodEnd.getFullYear()}`,
      periodStart,
      periodEnd,
      fiscalYear: periodEnd.getFullYear(),
      statementVariant,
      comparisonEnabled,
      comparisonPeriodStart,
      comparisonPeriodEnd,
      status: 'DRAFT',
      isPreliminary: includeDraftEntries,
      sections,
      totals,
      generatedAt: new Date(),
      generatedBy
    };

    // Save to database
    await this.saveReportToDb(statement);

    this.logger.log(`Income Statement generated: ${reportNumber}`, {
      netProfit: totals.netProfit.toString()
    });

    return statement;
  }

  private async calculatePeriodAmounts(
    organizationId: string,
    periodStart: Date,
    periodEnd: Date,
    mappings: IncomeStatementAccountMapping[],
    includeDraftEntries: boolean
  ): Promise<Map<string, Decimal>> {
    const amounts = new Map<string, Decimal>();

    // Group mappings by line code
    const mappingsByLine = new Map<string, string[]>();
    for (const mapping of mappings) {
      const accountIds = mappingsByLine.get(mapping.lineConfigId) || [];
      accountIds.push(mapping.accountId);
      mappingsByLine.set(mapping.lineConfigId, accountIds);
    }

    // Query amounts for each line
    for (const [lineConfigId, accountIds] of mappingsByLine) {
      const query = this.dataSource
        .createQueryBuilder()
        .select('COALESCE(SUM(jl.credit) - SUM(jl.debit), 0)', 'amount')
        .from(JournalLine, 'jl')
        .innerJoin('jl.journalEntry', 'je')
        .where('jl.account_id IN (:...accountIds)', { accountIds })
        .andWhere('je.organization_id = :organizationId', { organizationId })
        .andWhere('je.entry_date >= :periodStart', { periodStart })
        .andWhere('je.entry_date <= :periodEnd', { periodEnd });

      if (!includeDraftEntries) {
        query.andWhere('je.status = :status', { status: 'POSTED' });
      }

      const result = await query.getRawOne();
      amounts.set(lineConfigId, new Decimal(result.amount || 0));
    }

    return amounts;
  }

  private buildSections(
    lineConfig: IncomeStatementLineConfig[],
    currentAmounts: Map<string, Decimal>,
    priorAmounts: Map<string, Decimal> | undefined,
    variant: StatementVariant
  ): IncomeStatement['sections'] {
    // Build hierarchical structure based on line configuration
    const buildLine = (config: IncomeStatementLineConfig): IncomeStatementLine => {
      const currentAmount = currentAmounts.get(config.id) || new Decimal(0);
      const priorAmount = priorAmounts?.get(config.id);

      let variance: Decimal | undefined;
      let variancePercent: number | undefined;

      if (priorAmount && !priorAmount.isZero()) {
        variance = currentAmount.minus(priorAmount);
        variancePercent = variance.div(priorAmount.abs()).mul(100).toNumber();
      }

      return {
        lineCode: config.lineCode,
        lineName: config.lineName,
        lineNamePl: config.lineNamePl,
        indentLevel: config.indentLevel,
        currentAmount,
        priorAmount,
        variance,
        variancePercent,
        isHeader: config.isHeader,
        isSubtotal: config.isSubtotal,
        isTotal: config.isTotal
      };
    };

    // Build each main section
    const getSectionLine = (code: string) => {
      const config = lineConfig.find(c => c.lineCode === code);
      return config ? buildLine(config) : this.createEmptyLine(code);
    };

    return {
      revenueSection: getSectionLine('A'),
      operatingCostsSection: getSectionLine('B'),
      salesProfit: getSectionLine('C'),
      otherOperatingRevenue: getSectionLine('D'),
      otherOperatingCosts: getSectionLine('E'),
      operatingProfit: getSectionLine('F'),
      financialRevenue: getSectionLine('G'),
      financialCosts: getSectionLine('H'),
      grossProfit: getSectionLine('I'),
      incomeTax: getSectionLine('J'),
      otherDeductions: getSectionLine('K'),
      netProfit: getSectionLine('L')
    };
  }

  private calculateTotals(
    sections: IncomeStatement['sections']
  ): IncomeStatement['totals'] {
    const totalRevenue = sections.revenueSection.currentAmount
      .plus(sections.otherOperatingRevenue.currentAmount)
      .plus(sections.financialRevenue.currentAmount);

    const totalCosts = sections.operatingCostsSection.currentAmount
      .plus(sections.otherOperatingCosts.currentAmount)
      .plus(sections.financialCosts.currentAmount)
      .plus(sections.incomeTax.currentAmount)
      .plus(sections.otherDeductions.currentAmount);

    return {
      totalRevenue,
      totalCosts,
      operatingProfit: sections.operatingProfit.currentAmount,
      grossProfit: sections.grossProfit.currentAmount,
      netProfit: sections.netProfit.currentAmount
    };
  }

  async exportToExcel(
    report: IncomeStatement,
    options: { includeCompanyHeader: boolean; language: 'pl' | 'en' }
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('RZiS');

    // Header
    if (options.includeCompanyHeader) {
      worksheet.addRow([report.reportName]);
      worksheet.addRow([`Okres: ${report.periodStart.toLocaleDateString('pl-PL')} - ${report.periodEnd.toLocaleDateString('pl-PL')}`]);
      worksheet.addRow([]);
    }

    // Column headers
    const headers = ['Pozycja', 'Bieżący okres'];
    if (report.comparisonEnabled) {
      headers.push('Poprzedni okres', 'Zmiana', 'Zmiana %');
    }
    worksheet.addRow(headers);

    // Add data rows
    const addSectionRows = (section: IncomeStatementLine, prefix: string = '') => {
      const row = [
        `${prefix}${section.lineNamePl}`,
        this.formatAmount(section.currentAmount)
      ];

      if (report.comparisonEnabled) {
        row.push(
          section.priorAmount ? this.formatAmount(section.priorAmount) : '-',
          section.variance ? this.formatAmount(section.variance) : '-',
          section.variancePercent ? `${section.variancePercent.toFixed(1)}%` : '-'
        );
      }

      const excelRow = worksheet.addRow(row);

      // Style based on line type
      if (section.isHeader || section.isTotal) {
        excelRow.font = { bold: true };
      }
      if (section.isTotal) {
        excelRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
      }
    };

    // Add all sections
    Object.values(report.sections).forEach(section => {
      addSectionRows(section);
    });

    // Style columns
    worksheet.columns.forEach((col, idx) => {
      col.width = idx === 0 ? 50 : 20;
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async exportToPdf(
    report: IncomeStatement,
    options: { includeCompanyHeader: boolean; language: 'pl' | 'en'; paperSize: 'A4' | 'Letter' }
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: options.paperSize,
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Use Polish-compatible font
      doc.font('Helvetica');

      // Title
      doc.fontSize(16).text(report.reportName, { align: 'center' });
      doc.fontSize(12).text(
        `Okres: ${report.periodStart.toLocaleDateString('pl-PL')} - ${report.periodEnd.toLocaleDateString('pl-PL')}`,
        { align: 'center' }
      );
      doc.moveDown(2);

      // Table content
      const startY = doc.y;
      const lineHeight = 20;
      let currentY = startY;

      const drawLine = (section: IncomeStatementLine, indent: number = 0) => {
        const x = 50 + (indent * 20);

        if (section.isTotal) {
          doc.rect(50, currentY - 2, 500, lineHeight).fill('#E0E0E0');
          doc.fill('black');
        }

        doc.fontSize(section.isTotal ? 11 : 10)
           .font(section.isTotal || section.isHeader ? 'Helvetica-Bold' : 'Helvetica')
           .text(section.lineNamePl, x, currentY, { width: 300, continued: false });

        doc.text(
          this.formatAmount(section.currentAmount),
          400,
          currentY,
          { width: 100, align: 'right' }
        );

        currentY += lineHeight;
      };

      // Draw all sections
      Object.values(report.sections).forEach(section => {
        drawLine(section, section.indentLevel);
      });

      // Footer
      doc.fontSize(8)
         .text(
           `Wygenerowano: ${new Date().toLocaleString('pl-PL')}`,
           50,
           doc.page.height - 50
         );

      doc.end();
    });
  }

  async exportToXml(report: IncomeStatement): Promise<Buffer> {
    const xmlBuilder = new XMLBuilder({
      ignoreAttributes: false,
      format: true
    });

    const xmlData = {
      RachunekZyskowIStrat: {
        '@_xmlns': 'http://jpk.mf.gov.pl/wzor/2024/03/01/03011/',
        NaglowekRaportu: {
          NazwaRaportu: report.reportName,
          OkresOd: report.periodStart.toISOString().split('T')[0],
          OkresDo: report.periodEnd.toISOString().split('T')[0],
          DataWygenerowania: new Date().toISOString()
        },
        PozycjeRZiS: Object.entries(report.sections).map(([key, section]) => ({
          KodPozycji: section.lineCode,
          NazwaPozycji: section.lineNamePl,
          KwotaBiezaca: section.currentAmount.toFixed(2),
          KwotaPoprzednia: section.priorAmount?.toFixed(2) || '0.00'
        })),
        Podsumowanie: {
          SumaPrzychodow: report.totals.totalRevenue.toFixed(2),
          SumaKosztow: report.totals.totalCosts.toFixed(2),
          ZyskNetto: report.totals.netProfit.toFixed(2)
        }
      }
    };

    const xml = xmlBuilder.build(xmlData);
    return Buffer.from(xml, 'utf-8');
  }

  async exportToCsv(
    report: IncomeStatement,
    options: { language: 'pl' | 'en' }
  ): Promise<Buffer> {
    const rows: string[] = [];

    // BOM for Excel compatibility
    rows.push('\ufeff');

    // Headers
    rows.push('Kod;Nazwa pozycji;Kwota bieżąca;Kwota poprzednia');

    // Data
    Object.values(report.sections).forEach(section => {
      rows.push([
        section.lineCode,
        `"${section.lineNamePl}"`,
        section.currentAmount.toFixed(2).replace('.', ','),
        (section.priorAmount?.toFixed(2) || '0.00').replace('.', ',')
      ].join(';'));
    });

    return Buffer.from(rows.join('\n'), 'utf-8');
  }

  private formatAmount(amount: Decimal): string {
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ').replace('.', ',') + ' zł';
  }

  private createEmptyLine(code: string): IncomeStatementLine {
    return {
      lineCode: code,
      lineName: '',
      lineNamePl: '',
      indentLevel: 0,
      currentAmount: new Decimal(0),
      isHeader: false,
      isSubtotal: false,
      isTotal: false
    };
  }

  private async generateReportNumber(
    organizationId: string,
    fiscalYear: number
  ): Promise<string> {
    const count = await this.reportRepo.count({
      where: { organizationId, fiscalYear }
    });
    return `RZiS-${fiscalYear}-${String(count + 1).padStart(4, '0')}`;
  }
}
```

---

## Test Specifications

### Unit Tests

```typescript
// src/modules/accounting/income-statement/__tests__/income-statement.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { IncomeStatementService } from '../income-statement.service';
import Decimal from 'decimal.js';

describe('IncomeStatementService', () => {
  let service: IncomeStatementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncomeStatementService,
        // ... mock providers
      ]
    }).compile();

    service = module.get<IncomeStatementService>(IncomeStatementService);
  });

  describe('generateIncomeStatement', () => {
    it('should generate comparative Income Statement', async () => {
      // Arrange
      const params = {
        organizationId: 'org-123',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        statementVariant: 'COMPARATIVE' as const,
        comparisonEnabled: false,
        includeDraftEntries: false,
        generatedBy: 'user-123'
      };

      // Act
      const result = await service.generateIncomeStatement(params);

      // Assert
      expect(result).toBeDefined();
      expect(result.statementVariant).toBe('COMPARATIVE');
      expect(result.sections.netProfit).toBeDefined();
    });

    it('should calculate net profit correctly', async () => {
      // Arrange - mock accounts with known values
      const params = {
        organizationId: 'org-123',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        statementVariant: 'COMPARATIVE' as const,
        comparisonEnabled: false,
        includeDraftEntries: false,
        generatedBy: 'user-123'
      };

      // Mock revenue of 250,000 and costs of 180,000
      jest.spyOn(service as any, 'calculatePeriodAmounts').mockResolvedValue(
        new Map([
          ['revenue-line', new Decimal(250000)],
          ['cost-line', new Decimal(180000)]
        ])
      );

      // Act
      const result = await service.generateIncomeStatement(params);

      // Assert
      expect(result.totals.netProfit.toNumber()).toBe(70000);
    });

    it('should include comparison when enabled', async () => {
      // Arrange
      const params = {
        organizationId: 'org-123',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        statementVariant: 'COMPARATIVE' as const,
        comparisonEnabled: true,
        comparisonPeriodStart: new Date('2023-01-01'),
        comparisonPeriodEnd: new Date('2023-12-31'),
        includeDraftEntries: false,
        generatedBy: 'user-123'
      };

      // Act
      const result = await service.generateIncomeStatement(params);

      // Assert
      expect(result.comparisonEnabled).toBe(true);
      expect(result.sections.netProfit.priorAmount).toBeDefined();
      expect(result.sections.netProfit.variance).toBeDefined();
    });

    it('should mark as preliminary when draft entries included', async () => {
      // Arrange
      const params = {
        organizationId: 'org-123',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        statementVariant: 'COMPARATIVE' as const,
        comparisonEnabled: false,
        includeDraftEntries: true,
        generatedBy: 'user-123'
      };

      // Act
      const result = await service.generateIncomeStatement(params);

      // Assert
      expect(result.isPreliminary).toBe(true);
    });
  });

  describe('exportToExcel', () => {
    it('should generate valid XLSX buffer', async () => {
      // Arrange
      const report = createMockIncomeStatement();
      const options = { includeCompanyHeader: true, language: 'pl' as const };

      // Act
      const buffer = await service.exportToExcel(report, options);

      // Assert
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      // XLSX files start with PK (ZIP format)
      expect(buffer.slice(0, 2).toString()).toBe('PK');
    });
  });

  describe('exportToPdf', () => {
    it('should generate valid PDF buffer', async () => {
      // Arrange
      const report = createMockIncomeStatement();
      const options = {
        includeCompanyHeader: true,
        language: 'pl' as const,
        paperSize: 'A4' as const
      };

      // Act
      const buffer = await service.exportToPdf(report, options);

      // Assert
      expect(buffer).toBeInstanceOf(Buffer);
      // PDF files start with %PDF
      expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('calculateTotals', () => {
    it('should calculate section totals correctly', () => {
      // Arrange
      const sections = {
        revenueSection: { currentAmount: new Decimal(250000) },
        operatingCostsSection: { currentAmount: new Decimal(150000) },
        salesProfit: { currentAmount: new Decimal(100000) },
        otherOperatingRevenue: { currentAmount: new Decimal(10000) },
        otherOperatingCosts: { currentAmount: new Decimal(5000) },
        operatingProfit: { currentAmount: new Decimal(105000) },
        financialRevenue: { currentAmount: new Decimal(2000) },
        financialCosts: { currentAmount: new Decimal(3000) },
        grossProfit: { currentAmount: new Decimal(104000) },
        incomeTax: { currentAmount: new Decimal(19760) },
        otherDeductions: { currentAmount: new Decimal(0) },
        netProfit: { currentAmount: new Decimal(84240) }
      };

      // Act
      const totals = (service as any).calculateTotals(sections);

      // Assert
      expect(totals.totalRevenue.toNumber()).toBe(262000);
      expect(totals.netProfit.toNumber()).toBe(84240);
    });
  });
});

function createMockIncomeStatement(): IncomeStatement {
  return {
    id: 'report-123',
    organizationId: 'org-123',
    reportNumber: 'RZiS-2024-0001',
    reportName: 'Rachunek Zysków i Strat 2024',
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-12-31'),
    fiscalYear: 2024,
    statementVariant: 'COMPARATIVE',
    comparisonEnabled: false,
    status: 'DRAFT',
    isPreliminary: false,
    sections: {
      revenueSection: {
        lineCode: 'A',
        lineName: 'Net sales revenue and equivalents',
        lineNamePl: 'Przychody netto ze sprzedaży i zrównane z nimi',
        indentLevel: 0,
        currentAmount: new Decimal(250000),
        isHeader: true,
        isSubtotal: false,
        isTotal: false
      },
      // ... other sections
      netProfit: {
        lineCode: 'L',
        lineName: 'Net profit (loss)',
        lineNamePl: 'Zysk (strata) netto',
        indentLevel: 0,
        currentAmount: new Decimal(70000),
        isHeader: false,
        isSubtotal: false,
        isTotal: true
      }
    },
    totals: {
      totalRevenue: new Decimal(260000),
      totalCosts: new Decimal(190000),
      operatingProfit: new Decimal(75000),
      grossProfit: new Decimal(72000),
      netProfit: new Decimal(70000)
    },
    generatedAt: new Date(),
    generatedBy: 'user-123'
  };
}
```

### Integration Tests

```typescript
// src/modules/accounting/income-statement/__tests__/income-statement.integration.spec.ts

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../../../app.module';
import { setupTestDatabase, cleanupTestDatabase } from '../../../../test/utils';

describe('Income Statement API (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    await setupTestDatabase();

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/trpc/auth.login')
      .send({ email: 'accountant@test.com', password: 'test123' });
    authToken = loginResponse.body.result.data.token;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
    await app.close();
  });

  describe('POST /api/trpc/accounting.incomeStatement.generate', () => {
    it('should generate comparative Income Statement', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/api/trpc/accounting.incomeStatement.generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2024-01-01',
          periodEnd: '2024-12-31',
          statementVariant: 'COMPARATIVE',
          comparisonEnabled: false,
          includeDraftEntries: false
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.result.data).toHaveProperty('id');
      expect(response.body.result.data).toHaveProperty('sections');
      expect(response.body.result.data).toHaveProperty('totals');
      expect(response.body.result.data.status).toBe('DRAFT');
    });

    it('should generate cost-by-function Income Statement', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/api/trpc/accounting.incomeStatement.generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2024-01-01',
          periodEnd: '2024-12-31',
          statementVariant: 'COST_BY_FUNCTION',
          comparisonEnabled: false,
          includeDraftEntries: false
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.result.data.statementVariant).toBe('COST_BY_FUNCTION');
    });

    it('should generate with prior period comparison', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/api/trpc/accounting.incomeStatement.generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2024-01-01',
          periodEnd: '2024-12-31',
          statementVariant: 'COMPARATIVE',
          comparisonEnabled: true,
          comparisonPeriodStart: '2023-01-01',
          comparisonPeriodEnd: '2023-12-31',
          includeDraftEntries: false
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.result.data.comparisonEnabled).toBe(true);
      expect(response.body.result.data.sections.netProfit).toHaveProperty('priorAmount');
    });
  });

  describe('POST /api/trpc/accounting.incomeStatement.export', () => {
    let reportId: string;

    beforeEach(async () => {
      // Generate a report first
      const genResponse = await request(app.getHttpServer())
        .post('/api/trpc/accounting.incomeStatement.generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2024-01-01',
          periodEnd: '2024-12-31',
          statementVariant: 'COMPARATIVE'
        });
      reportId = genResponse.body.result.data.id;
    });

    it('should export to Excel', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/api/trpc/accounting.incomeStatement.export')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reportId,
          format: 'xlsx',
          includeCompanyHeader: true,
          language: 'pl'
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.result.data.contentType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(response.body.result.data.fileName).toContain('.xlsx');
    });

    it('should export to PDF', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/api/trpc/accounting.incomeStatement.export')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reportId,
          format: 'pdf',
          includeCompanyHeader: true,
          language: 'pl',
          paperSize: 'A4'
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.result.data.contentType).toBe('application/pdf');
    });

    it('should export to XML for JPK', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/api/trpc/accounting.incomeStatement.export')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reportId,
          format: 'xml'
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.result.data.contentType).toBe('application/xml');
    });
  });

  describe('Validation', () => {
    it('should validate against trial balance', async () => {
      // Generate report
      const genResponse = await request(app.getHttpServer())
        .post('/api/trpc/accounting.incomeStatement.generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2024-01-01',
          periodEnd: '2024-12-31',
          statementVariant: 'COMPARATIVE'
        });
      const reportId = genResponse.body.result.data.id;

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/trpc/accounting.incomeStatement.validateAgainstTrialBalance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reportId });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.result.data).toHaveProperty('isValid');
      expect(response.body.result.data).toHaveProperty('discrepancies');
    });
  });
});
```

### E2E Tests

```typescript
// e2e/income-statement.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Income Statement UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'accountant@test.com');
    await page.fill('[data-testid="password"]', 'test123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('should generate Income Statement from UI', async ({ page }) => {
    // Navigate to reports
    await page.click('[data-testid="nav-reports"]');
    await page.click('[data-testid="income-statement-link"]');

    // Fill form
    await page.fill('[data-testid="period-start"]', '2024-01-01');
    await page.fill('[data-testid="period-end"]', '2024-12-31');
    await page.selectOption('[data-testid="statement-variant"]', 'COMPARATIVE');

    // Generate
    await page.click('[data-testid="generate-button"]');

    // Wait for result
    await expect(page.locator('[data-testid="income-statement-result"]')).toBeVisible();
    await expect(page.locator('[data-testid="net-profit-value"]')).toContainText('zł');
  });

  test('should export to Excel', async ({ page }) => {
    // Generate first
    await page.goto('/reports/income-statement');
    await page.fill('[data-testid="period-start"]', '2024-01-01');
    await page.fill('[data-testid="period-end"]', '2024-12-31');
    await page.click('[data-testid="generate-button"]');
    await page.waitForSelector('[data-testid="income-statement-result"]');

    // Export
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-excel-button"]');
    const download = await downloadPromise;

    // Verify
    expect(download.suggestedFilename()).toContain('.xlsx');
  });

  test('should show comparison columns when enabled', async ({ page }) => {
    await page.goto('/reports/income-statement');

    // Enable comparison
    await page.check('[data-testid="enable-comparison"]');
    await page.fill('[data-testid="comparison-start"]', '2023-01-01');
    await page.fill('[data-testid="comparison-end"]', '2023-12-31');

    // Current period
    await page.fill('[data-testid="period-start"]', '2024-01-01');
    await page.fill('[data-testid="period-end"]', '2024-12-31');

    await page.click('[data-testid="generate-button"]');
    await page.waitForSelector('[data-testid="income-statement-result"]');

    // Verify comparison columns visible
    await expect(page.locator('[data-testid="prior-period-column"]')).toBeVisible();
    await expect(page.locator('[data-testid="variance-column"]')).toBeVisible();
  });
});
```

---

## Security Checklist

- [x] **Authentication Required**: All endpoints require valid JWT token
- [x] **Organization Isolation**: Reports filtered by organizationId via RLS
- [x] **Role-Based Access**: Only users with `ACCOUNTANT`, `MANAGER`, `ADMIN` roles can generate reports
- [x] **Input Validation**: All inputs validated via Zod schemas
- [x] **SQL Injection Prevention**: Using parameterized queries and TypeORM
- [x] **Audit Trail**: All report generations and exports logged
- [x] **Data Integrity**: Financial calculations use Decimal.js (no floating-point errors)
- [x] **Export Security**: Generated files don't contain sensitive data beyond report scope
- [x] **Rate Limiting**: Report generation endpoints have rate limits

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `INCOME_STATEMENT_GENERATED` | Report generated | Period, variant, totals |
| `INCOME_STATEMENT_EXPORTED` | Report exported | Format, report ID |
| `INCOME_STATEMENT_SAVED` | Report saved | Status, report ID |
| `INCOME_STATEMENT_APPROVED` | Report approved | Approver, timestamp |
| `INCOME_STATEMENT_MAPPING_UPDATED` | Account mapping changed | Variant, mapping count |

---

## Implementation Notes

### Polish Accounting Standards
- Report structure follows **Załącznik nr 1** to Ustawa o rachunkowości
- Two variants supported:
  - **Wariant porównawczy** (Comparative) - costs by nature (klasa 4)
  - **Wariant kalkulacyjny** (Cost-by-function) - costs by function (klasa 5)
- All Polish terminology and line descriptions

### Calculation Logic
1. Revenue accounts (7xx) contribute to Section A
2. Cost accounts (4xx for comparative, 5xx for cost-by-function) contribute to Section B
3. Subtotals calculated automatically: C = A - B
4. Operating profit: F = C + D - E
5. Gross profit: I = F + G - H
6. Net profit: L = I - J - K

### Export Formats
- **Excel**: Uses ExcelJS with Polish number formatting
- **PDF**: Uses PDFKit with DejaVu fonts for Polish characters
- **XML**: JPK_SF compatible format for tax authority submissions
- **CSV**: UTF-8 with BOM, semicolon separator for Polish Excel

---

## Definition of Done

- [ ] All acceptance criteria scenarios pass
- [ ] Unit test coverage ≥ 80%
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Security checklist complete
- [ ] Code review approved
- [ ] Documentation updated
- [ ] Audit events logging verified
- [ ] Export formats validated (Excel opens correctly, PDF renders Polish characters)
- [ ] Polish accounting expert review completed

---

*Story created: 2024-12-29*
*Last updated: 2024-12-29*
