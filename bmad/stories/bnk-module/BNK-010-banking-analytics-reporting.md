# BNK-010: Banking Analytics & Reporting

> **Story ID**: BNK-010
> **Epic**: Banking Integration Layer (BNK)
> **Priority**: P2 (Nice to Have)
> **Points**: 5
> **Status**: 📋 Ready for Development
> **Phase**: Week 24

---

## User Story

**As an** accountant,
**I want to** access analytics and reports on banking operations,
**So that** I can optimize cash management, identify issues, and make data-driven financial decisions.

---

## Acceptance Criteria

### AC1: Cash Flow Analysis

```gherkin
Feature: Cash Flow Analysis
  As an accountant
  I need to analyze cash flow patterns
  So that I can predict and optimize liquidity

  Background:
    Given the client has connected bank accounts
    And has transaction history for analysis

  Scenario: Daily cash flow summary
    Given transactions for the last 30 days
    When I request daily cash flow analysis
    Then I should see daily inflows and outflows
    And net cash flow per day
    And running balance projection
    And trend indicators (up/down/stable)

  Scenario: Cash flow forecasting
    Given historical transaction patterns
    When I request cash flow forecast
    Then the system should predict next 30 days
    Based on recurring transactions
    And seasonal patterns
    And provide confidence intervals

  Scenario: Cash flow by category
    Given categorized transactions
    When I analyze cash flow by category
    Then I should see breakdown by expense category
    And income sources
    And category trends over time
```

### AC2: Payment Success Metrics

```gherkin
Feature: Payment Success Metrics
  As an accountant
  I need to track payment success rates
  So that I can identify and resolve payment issues

  Scenario: Payment success rate dashboard
    Given payment history for the period
    When viewing payment metrics
    Then I should see overall success rate
    And success rate by payment type
    And success rate by bank provider
    And failure reason breakdown

  Scenario: Payment timing analysis
    Given completed payments
    When analyzing payment timing
    Then I should see average processing time
    And time to first response
    And time to final settlement
    And comparison with benchmarks

  Scenario: Failed payment analysis
    Given failed payments in the period
    When viewing failure analytics
    Then I should see failure reasons
    And affected amounts
    And retry success rates
    And recommended actions
```

### AC3: Reconciliation Statistics

```gherkin
Feature: Reconciliation Statistics
  As an accountant
  I need to track reconciliation efficiency
  So that I can improve matching accuracy

  Scenario: Auto-reconciliation rate
    Given reconciliation sessions
    When viewing reconciliation stats
    Then I should see auto-match percentage
    And manual match percentage
    And unmatched percentage
    And average confidence scores

  Scenario: Reconciliation trend analysis
    Given reconciliation history over time
    When analyzing trends
    Then I should see improvement over time
    And identify problematic patterns
    And suggest rule optimizations

  Scenario: Exception analysis
    Given reconciliation exceptions
    When viewing exception stats
    Then I should see exception categories
    And resolution times
    And recurring exception patterns
```

### AC4: Bank Fee Analysis

```gherkin
Feature: Bank Fee Analysis
  As an accountant
  I need to track bank fees and charges
  So that I can optimize banking costs

  Scenario: Fee breakdown by type
    Given transactions with fee information
    When analyzing bank fees
    Then I should see fees by type (transfer, maintenance, etc.)
    And fees by bank account
    And fees by provider
    And month-over-month comparison

  Scenario: Fee optimization suggestions
    Given fee history and patterns
    When requesting optimization analysis
    Then the system should suggest cost savings
    Based on payment type changes
    And timing optimizations
    And provider comparisons

  Scenario: Hidden fee detection
    Given transaction amounts and descriptions
    When scanning for hidden fees
    Then the system should identify potential hidden charges
    And flag unusual deductions
    And calculate total hidden costs
```

### AC5: Connection Health Reports

```gherkin
Feature: Connection Health Reports
  As an administrator
  I need connection health reports
  So that I can ensure reliable banking integration

  Scenario: Connection uptime report
    Given active bank connections
    When generating health report
    Then I should see uptime percentage per connection
    And downtime incidents
    And sync success rates
    And last successful sync times

  Scenario: Provider comparison report
    Given multiple bank providers
    When comparing provider performance
    Then I should see response time comparison
    And reliability comparison
    And feature availability comparison
    And recommendation for optimization
```

### AC6: API Usage Tracking

```gherkin
Feature: API Usage Tracking
  As an administrator
  I need to track API usage
  So that I can manage costs and plan capacity

  Scenario: API call volume tracking
    Given API usage over time
    When viewing usage dashboard
    Then I should see total API calls
    And calls by operation type
    And calls by provider
    And trend analysis

  Scenario: Rate limit monitoring
    Given provider rate limits
    When monitoring usage
    Then I should see current usage vs limits
    And historical peak usage
    And alerts for approaching limits

  Scenario: Cost estimation
    Given API pricing information
    When calculating costs
    Then I should see estimated costs by provider
    And cost trends
    And budget vs actual comparison
```

### AC7: Export Capabilities

```gherkin
Feature: Analytics Export
  As an accountant
  I need to export analytics data
  So that I can create custom reports and share insights

  Scenario: Export to Excel
    Given any analytics view
    When I request Excel export
    Then the system should generate XLSX file
    With formatted data tables
    And charts where applicable
    And proper Polish formatting

  Scenario: Export to PDF
    Given any analytics dashboard
    When I request PDF export
    Then the system should generate PDF report
    With company branding
    And professional formatting
    And chart visualizations

  Scenario: Scheduled report delivery
    Given report configuration
    When schedule is set
    Then the system should generate reports automatically
    And send via email
    And archive for future reference
```

---

## Technical Specification

### Database Schema

```sql
-- Analytics snapshots
CREATE TABLE banking_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Time period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  granularity VARCHAR(20) NOT NULL CHECK (granularity IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY')),

  -- Cash flow metrics
  total_inflows DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_outflows DECIMAL(15,2) NOT NULL DEFAULT 0,
  net_cash_flow DECIMAL(15,2) NOT NULL DEFAULT 0,
  opening_balance DECIMAL(15,2),
  closing_balance DECIMAL(15,2),

  -- Transaction metrics
  transaction_count INTEGER NOT NULL DEFAULT 0,
  avg_transaction_amount DECIMAL(15,2),
  largest_inflow DECIMAL(15,2),
  largest_outflow DECIMAL(15,2),

  -- Category breakdown
  inflows_by_category JSONB NOT NULL DEFAULT '{}',
  outflows_by_category JSONB NOT NULL DEFAULT '{}',

  -- Currency (PLN default)
  currency CHAR(3) NOT NULL DEFAULT 'PLN',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, period_start, period_end, granularity, currency)
);

-- Payment metrics
CREATE TABLE payment_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Time period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Success metrics
  total_payments INTEGER NOT NULL DEFAULT 0,
  successful_payments INTEGER NOT NULL DEFAULT 0,
  failed_payments INTEGER NOT NULL DEFAULT 0,
  pending_payments INTEGER NOT NULL DEFAULT 0,
  cancelled_payments INTEGER NOT NULL DEFAULT 0,

  -- Amount metrics
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  successful_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  failed_amount DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Timing metrics (milliseconds)
  avg_processing_time_ms INTEGER,
  min_processing_time_ms INTEGER,
  max_processing_time_ms INTEGER,
  p50_processing_time_ms INTEGER,
  p95_processing_time_ms INTEGER,

  -- Breakdown by type
  metrics_by_type JSONB NOT NULL DEFAULT '{}',
  metrics_by_provider JSONB NOT NULL DEFAULT '{}',

  -- Failure analysis
  failure_reasons JSONB NOT NULL DEFAULT '{}',

  currency CHAR(3) NOT NULL DEFAULT 'PLN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, period_start, period_end, currency)
);

-- Reconciliation analytics
CREATE TABLE reconciliation_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Time period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Match metrics
  total_transactions INTEGER NOT NULL DEFAULT 0,
  auto_matched INTEGER NOT NULL DEFAULT 0,
  manual_matched INTEGER NOT NULL DEFAULT 0,
  unmatched INTEGER NOT NULL DEFAULT 0,

  -- Match types
  exact_matches INTEGER NOT NULL DEFAULT 0,
  fuzzy_matches INTEGER NOT NULL DEFAULT 0,
  ai_matches INTEGER NOT NULL DEFAULT 0,
  rule_matches INTEGER NOT NULL DEFAULT 0,

  -- Confidence metrics
  avg_confidence DECIMAL(5,4),
  high_confidence_matches INTEGER NOT NULL DEFAULT 0,
  low_confidence_matches INTEGER NOT NULL DEFAULT 0,

  -- Amount metrics
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  matched_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  unmatched_amount DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Exception metrics
  total_exceptions INTEGER NOT NULL DEFAULT 0,
  resolved_exceptions INTEGER NOT NULL DEFAULT 0,
  avg_resolution_time_hours DECIMAL(10,2),

  currency CHAR(3) NOT NULL DEFAULT 'PLN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, period_start, period_end, currency)
);

-- Bank fee tracking
CREATE TABLE bank_fee_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES bank_accounts(id),

  -- Time period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Fee totals
  total_fees DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Fee breakdown
  transfer_fees DECIMAL(15,2) NOT NULL DEFAULT 0,
  maintenance_fees DECIMAL(15,2) NOT NULL DEFAULT 0,
  card_fees DECIMAL(15,2) NOT NULL DEFAULT 0,
  foreign_exchange_fees DECIMAL(15,2) NOT NULL DEFAULT 0,
  other_fees DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Detailed breakdown
  fee_breakdown JSONB NOT NULL DEFAULT '{}',

  -- Provider info
  provider_code VARCHAR(50),
  bank_name VARCHAR(255),

  currency CHAR(3) NOT NULL DEFAULT 'PLN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, account_id, period_start, period_end, currency)
);

-- API usage tracking
CREATE TABLE api_usage_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Time bucket
  bucket_start TIMESTAMPTZ NOT NULL,
  bucket_end TIMESTAMPTZ NOT NULL,

  -- Call metrics
  total_calls INTEGER NOT NULL DEFAULT 0,
  successful_calls INTEGER NOT NULL DEFAULT 0,
  failed_calls INTEGER NOT NULL DEFAULT 0,
  rate_limited_calls INTEGER NOT NULL DEFAULT 0,

  -- By operation
  calls_by_operation JSONB NOT NULL DEFAULT '{}',

  -- By provider
  calls_by_provider JSONB NOT NULL DEFAULT '{}',

  -- Cost estimation
  estimated_cost_pln DECIMAL(10,2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, bucket_start)
);

-- Scheduled reports
CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),

  -- Report configuration
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN (
    'CASH_FLOW', 'PAYMENT_METRICS', 'RECONCILIATION',
    'BANK_FEES', 'API_USAGE', 'COMPREHENSIVE'
  )),
  report_name VARCHAR(255) NOT NULL,

  -- Schedule
  schedule_cron VARCHAR(100) NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Warsaw',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,

  -- Period configuration
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY')),
  look_back_periods INTEGER NOT NULL DEFAULT 1,

  -- Export configuration
  export_format VARCHAR(10) NOT NULL DEFAULT 'PDF' CHECK (export_format IN ('PDF', 'XLSX', 'CSV')),
  include_charts BOOLEAN NOT NULL DEFAULT true,

  -- Delivery configuration
  delivery_method VARCHAR(20) NOT NULL DEFAULT 'EMAIL' CHECK (delivery_method IN ('EMAIL', 'DOWNLOAD', 'BOTH')),
  recipients TEXT[] NOT NULL DEFAULT '{}',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Report archive
CREATE TABLE report_archive (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scheduled_report_id UUID REFERENCES scheduled_reports(id),

  -- Report details
  report_type VARCHAR(50) NOT NULL,
  report_name VARCHAR(255) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- File info
  file_path TEXT NOT NULL,
  file_format VARCHAR(10) NOT NULL,
  file_size_bytes INTEGER NOT NULL,

  -- Generation info
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID REFERENCES users(id),
  generation_time_ms INTEGER,

  -- Delivery status
  delivery_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING', 'DELIVERED', 'FAILED')),
  delivered_at TIMESTAMPTZ,
  delivery_error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_banking_snapshots_org_period ON banking_analytics_snapshots(organization_id, period_start DESC);
CREATE INDEX idx_payment_analytics_org_period ON payment_analytics(organization_id, period_start DESC);
CREATE INDEX idx_reconciliation_analytics_org ON reconciliation_analytics(organization_id, period_start DESC);
CREATE INDEX idx_api_usage_org_bucket ON api_usage_analytics(organization_id, bucket_start DESC);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = true;
CREATE INDEX idx_report_archive_org_type ON report_archive(organization_id, report_type, generated_at DESC);

-- Row Level Security
ALTER TABLE banking_analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_fee_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization analytics"
  ON banking_analytics_snapshots FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
  ));

-- Similar policies for other analytics tables...
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Date range for analytics
export const DateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
  message: 'Data początkowa musi być wcześniejsza niż końcowa',
});

export const GranularitySchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']);

export const ReportTypeSchema = z.enum([
  'CASH_FLOW',
  'PAYMENT_METRICS',
  'RECONCILIATION',
  'BANK_FEES',
  'API_USAGE',
  'COMPREHENSIVE',
]);

export const ExportFormatSchema = z.enum(['PDF', 'XLSX', 'CSV']);

// Cash flow analysis request
export const CashFlowAnalysisSchema = z.object({
  dateRange: DateRangeSchema,
  granularity: GranularitySchema.default('DAILY'),
  accountIds: z.array(z.string().uuid()).optional(),
  categories: z.array(z.string()).optional(),
  includeForecast: z.boolean().default(false),
  forecastDays: z.number().int().min(7).max(90).default(30),
});

// Payment metrics request
export const PaymentMetricsSchema = z.object({
  dateRange: DateRangeSchema,
  paymentTypes: z.array(z.string()).optional(),
  providerCodes: z.array(z.string()).optional(),
  includeFailureAnalysis: z.boolean().default(true),
});

// Reconciliation stats request
export const ReconciliationStatsSchema = z.object({
  dateRange: DateRangeSchema,
  accountIds: z.array(z.string().uuid()).optional(),
  includeTrends: z.boolean().default(true),
});

// Bank fee analysis request
export const BankFeeAnalysisSchema = z.object({
  dateRange: DateRangeSchema,
  accountIds: z.array(z.string().uuid()).optional(),
  includeOptimizations: z.boolean().default(true),
});

// API usage request
export const ApiUsageSchema = z.object({
  dateRange: DateRangeSchema,
  providerCodes: z.array(z.string()).optional(),
  operationTypes: z.array(z.string()).optional(),
});

// Export request
export const ExportRequestSchema = z.object({
  reportType: ReportTypeSchema,
  dateRange: DateRangeSchema,
  format: ExportFormatSchema,
  includeCharts: z.boolean().default(true),
  language: z.enum(['pl', 'en']).default('pl'),
});

// Scheduled report configuration
export const ScheduledReportSchema = z.object({
  reportType: ReportTypeSchema,
  reportName: z.string().min(1).max(255),
  scheduleCron: z.string()
    .regex(/^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$/,
      'Nieprawidłowy format cron'),
  timezone: z.string().default('Europe/Warsaw'),
  periodType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY']),
  lookBackPeriods: z.number().int().min(1).max(12).default(1),
  exportFormat: ExportFormatSchema.default('PDF'),
  includeCharts: z.boolean().default(true),
  deliveryMethod: z.enum(['EMAIL', 'DOWNLOAD', 'BOTH']).default('EMAIL'),
  recipients: z.array(z.string().email()).min(1),
});

// Cash flow forecast result
export const CashFlowForecastSchema = z.object({
  date: z.string(),
  predictedInflows: z.number(),
  predictedOutflows: z.number(),
  predictedNetFlow: z.number(),
  predictedBalance: z.number(),
  confidenceLevel: z.number().min(0).max(1),
  basedOn: z.array(z.string()),
});

export type CashFlowAnalysis = z.infer<typeof CashFlowAnalysisSchema>;
export type PaymentMetrics = z.infer<typeof PaymentMetricsSchema>;
export type ReconciliationStats = z.infer<typeof ReconciliationStatsSchema>;
export type BankFeeAnalysis = z.infer<typeof BankFeeAnalysisSchema>;
export type ApiUsage = z.infer<typeof ApiUsageSchema>;
export type ExportRequest = z.infer<typeof ExportRequestSchema>;
export type ScheduledReport = z.infer<typeof ScheduledReportSchema>;
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  CashFlowAnalysisSchema,
  PaymentMetricsSchema,
  ReconciliationStatsSchema,
  BankFeeAnalysisSchema,
  ApiUsageSchema,
  ExportRequestSchema,
  ScheduledReportSchema,
} from './schemas';
import { AnalyticsService } from './analytics.service';
import { ReportGeneratorService } from './report-generator.service';

export const analyticsRouter = router({
  // Cash flow analysis
  getCashFlowAnalysis: protectedProcedure
    .input(CashFlowAnalysisSchema)
    .query(async ({ ctx, input }) => {
      const analyticsService = new AnalyticsService(ctx.db);
      return analyticsService.getCashFlowAnalysis(
        ctx.organizationId,
        input
      );
    }),

  // Cash flow forecast
  getCashFlowForecast: protectedProcedure
    .input(z.object({
      accountIds: z.array(z.string().uuid()).optional(),
      forecastDays: z.number().int().min(7).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const analyticsService = new AnalyticsService(ctx.db);
      return analyticsService.forecastCashFlow(
        ctx.organizationId,
        input.accountIds,
        input.forecastDays
      );
    }),

  // Payment metrics
  getPaymentMetrics: protectedProcedure
    .input(PaymentMetricsSchema)
    .query(async ({ ctx, input }) => {
      const analyticsService = new AnalyticsService(ctx.db);
      return analyticsService.getPaymentMetrics(
        ctx.organizationId,
        input
      );
    }),

  // Reconciliation statistics
  getReconciliationStats: protectedProcedure
    .input(ReconciliationStatsSchema)
    .query(async ({ ctx, input }) => {
      const analyticsService = new AnalyticsService(ctx.db);
      return analyticsService.getReconciliationStats(
        ctx.organizationId,
        input
      );
    }),

  // Bank fee analysis
  getBankFeeAnalysis: protectedProcedure
    .input(BankFeeAnalysisSchema)
    .query(async ({ ctx, input }) => {
      const analyticsService = new AnalyticsService(ctx.db);
      return analyticsService.getBankFeeAnalysis(
        ctx.organizationId,
        input
      );
    }),

  // Fee optimization suggestions
  getFeeOptimizations: protectedProcedure
    .query(async ({ ctx }) => {
      const analyticsService = new AnalyticsService(ctx.db);
      return analyticsService.getFeeOptimizationSuggestions(ctx.organizationId);
    }),

  // API usage analytics
  getApiUsage: protectedProcedure
    .input(ApiUsageSchema)
    .query(async ({ ctx, input }) => {
      const analyticsService = new AnalyticsService(ctx.db);
      return analyticsService.getApiUsage(
        ctx.organizationId,
        input
      );
    }),

  // Connection health summary
  getConnectionHealth: protectedProcedure
    .query(async ({ ctx }) => {
      const analyticsService = new AnalyticsService(ctx.db);
      return analyticsService.getConnectionHealthSummary(ctx.organizationId);
    }),

  // Export report
  exportReport: protectedProcedure
    .input(ExportRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const reportService = new ReportGeneratorService(ctx.db, ctx.storage);

      const report = await reportService.generateReport(
        ctx.organizationId,
        input,
        ctx.userId
      );

      // Audit log
      await ctx.auditLog.log({
        action: 'REPORT_EXPORTED',
        resourceType: 'ANALYTICS_REPORT',
        resourceId: report.id,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        details: {
          reportType: input.reportType,
          format: input.format,
          dateRange: input.dateRange,
        },
      });

      return report;
    }),

  // Schedule report
  scheduleReport: protectedProcedure
    .input(ScheduledReportSchema)
    .mutation(async ({ ctx, input }) => {
      const reportService = new ReportGeneratorService(ctx.db, ctx.storage);

      const scheduled = await reportService.scheduleReport(
        ctx.organizationId,
        input,
        ctx.userId
      );

      // Audit log
      await ctx.auditLog.log({
        action: 'REPORT_SCHEDULED',
        resourceType: 'SCHEDULED_REPORT',
        resourceId: scheduled.id,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        details: {
          reportType: input.reportType,
          schedule: input.scheduleCron,
        },
      });

      return scheduled;
    }),

  // Get scheduled reports
  getScheduledReports: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.scheduledReports.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { createdAt: 'desc' },
      });
    }),

  // Update scheduled report
  updateScheduledReport: protectedProcedure
    .input(z.object({
      reportId: z.string().uuid(),
      updates: ScheduledReportSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      const reportService = new ReportGeneratorService(ctx.db, ctx.storage);
      return reportService.updateScheduledReport(
        input.reportId,
        input.updates,
        ctx.userId
      );
    }),

  // Delete scheduled report
  deleteScheduledReport: protectedProcedure
    .input(z.object({
      reportId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.scheduledReports.delete({
        where: { id: input.reportId },
      });

      return { success: true };
    }),

  // Get report archive
  getReportArchive: protectedProcedure
    .input(z.object({
      reportType: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { organizationId: ctx.organizationId };
      if (input.reportType) {
        where.reportType = input.reportType;
      }

      const [reports, total] = await Promise.all([
        ctx.db.reportArchive.findMany({
          where,
          orderBy: { generatedAt: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.db.reportArchive.count({ where }),
      ]);

      return { reports, total };
    }),

  // Download archived report
  downloadReport: protectedProcedure
    .input(z.object({
      reportId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const report = await ctx.db.reportArchive.findUnique({
        where: { id: input.reportId },
      });

      if (!report || report.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono raportu',
        });
      }

      // Generate signed URL for download
      const downloadUrl = await ctx.storage.getSignedUrl(report.filePath, 3600);

      return { downloadUrl, filename: `${report.reportName}.${report.fileFormat.toLowerCase()}` };
    }),

  // Dashboard summary
  getDashboardSummary: protectedProcedure
    .query(async ({ ctx }) => {
      const analyticsService = new AnalyticsService(ctx.db);
      return analyticsService.getDashboardSummary(ctx.organizationId);
    }),
});
```

### Analytics Service Implementation

```typescript
import { Injectable } from '@nestjs/common';
import { Database } from '../database';
import Decimal from 'decimal.js';

@Injectable()
export class AnalyticsService {
  constructor(private readonly db: Database) {}

  // Cash flow analysis
  async getCashFlowAnalysis(
    organizationId: string,
    params: CashFlowAnalysis
  ): Promise<CashFlowResult> {
    const startDate = new Date(params.dateRange.startDate);
    const endDate = new Date(params.dateRange.endDate);

    // Get transactions for the period
    const transactions = await this.db.bankTransactions.findMany({
      where: {
        account: {
          connection: { organizationId },
          ...(params.accountIds?.length && { id: { in: params.accountIds } }),
        },
        transactionDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { transactionDate: 'asc' },
    });

    // Aggregate by granularity
    const aggregated = this.aggregateByGranularity(
      transactions,
      params.granularity
    );

    // Calculate running balance
    let runningBalance = await this.getOpeningBalance(
      organizationId,
      startDate,
      params.accountIds
    );

    const periods = aggregated.map(period => {
      runningBalance = runningBalance.plus(period.netFlow);
      return {
        ...period,
        runningBalance: runningBalance.toNumber(),
      };
    });

    // Category breakdown
    const categoryBreakdown = this.calculateCategoryBreakdown(transactions);

    // Forecast if requested
    let forecast = null;
    if (params.includeForecast) {
      forecast = await this.forecastCashFlow(
        organizationId,
        params.accountIds,
        params.forecastDays
      );
    }

    return {
      periods,
      summary: {
        totalInflows: periods.reduce((sum, p) => sum + p.inflows, 0),
        totalOutflows: periods.reduce((sum, p) => sum + p.outflows, 0),
        netCashFlow: periods.reduce((sum, p) => sum + p.netFlow, 0),
        openingBalance: periods[0]?.runningBalance - periods[0]?.netFlow || 0,
        closingBalance: periods[periods.length - 1]?.runningBalance || 0,
      },
      categoryBreakdown,
      forecast,
      currency: 'PLN',
    };
  }

  // Cash flow forecasting using historical patterns
  async forecastCashFlow(
    organizationId: string,
    accountIds: string[] | undefined,
    days: number
  ): Promise<CashFlowForecast[]> {
    // Get last 90 days of data for pattern analysis
    const historicalStart = new Date();
    historicalStart.setDate(historicalStart.getDate() - 90);

    const transactions = await this.db.bankTransactions.findMany({
      where: {
        account: {
          connection: { organizationId },
          ...(accountIds?.length && { id: { in: accountIds } }),
        },
        transactionDate: { gte: historicalStart },
      },
    });

    // Identify recurring transactions
    const recurringPatterns = this.identifyRecurringPatterns(transactions);

    // Calculate average daily flow
    const dailyAverages = this.calculateDailyAverages(transactions);

    // Generate forecast
    const forecast: CashFlowForecast[] = [];
    let currentBalance = await this.getCurrentBalance(organizationId, accountIds);

    for (let i = 1; i <= days; i++) {
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + i);

      const dayOfWeek = forecastDate.getDay();
      const dayOfMonth = forecastDate.getDate();

      // Predict based on patterns
      let predictedInflows = new Decimal(dailyAverages.avgInflow);
      let predictedOutflows = new Decimal(dailyAverages.avgOutflow);
      const basedOn: string[] = ['historical_average'];

      // Apply recurring patterns
      for (const pattern of recurringPatterns) {
        if (this.patternMatchesDate(pattern, forecastDate)) {
          if (pattern.type === 'CREDIT') {
            predictedInflows = predictedInflows.plus(pattern.amount);
          } else {
            predictedOutflows = predictedOutflows.plus(pattern.amount);
          }
          basedOn.push(pattern.description);
        }
      }

      // Adjust for day of week patterns
      const dayOfWeekMultiplier = dailyAverages.dayOfWeekFactors[dayOfWeek] || 1;
      predictedInflows = predictedInflows.times(dayOfWeekMultiplier);
      predictedOutflows = predictedOutflows.times(dayOfWeekMultiplier);

      const netFlow = predictedInflows.minus(predictedOutflows);
      currentBalance = currentBalance.plus(netFlow);

      forecast.push({
        date: forecastDate.toISOString().split('T')[0],
        predictedInflows: predictedInflows.toDecimalPlaces(2).toNumber(),
        predictedOutflows: predictedOutflows.toDecimalPlaces(2).toNumber(),
        predictedNetFlow: netFlow.toDecimalPlaces(2).toNumber(),
        predictedBalance: currentBalance.toDecimalPlaces(2).toNumber(),
        confidenceLevel: this.calculateConfidence(i, recurringPatterns.length),
        basedOn,
      });
    }

    return forecast;
  }

  // Payment metrics
  async getPaymentMetrics(
    organizationId: string,
    params: PaymentMetrics
  ): Promise<PaymentMetricsResult> {
    const startDate = new Date(params.dateRange.startDate);
    const endDate = new Date(params.dateRange.endDate);

    const payments = await this.db.payments.findMany({
      where: {
        connection: { organizationId },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(params.paymentTypes?.length && { paymentType: { in: params.paymentTypes } }),
        ...(params.providerCodes?.length && { providerCode: { in: params.providerCodes } }),
      },
    });

    // Calculate metrics
    const totalPayments = payments.length;
    const successful = payments.filter(p => p.status === 'COMPLETED');
    const failed = payments.filter(p => p.status === 'FAILED');

    // Timing analysis
    const completedPayments = payments.filter(p => p.status === 'COMPLETED' && p.completedAt);
    const processingTimes = completedPayments.map(p =>
      p.completedAt!.getTime() - p.createdAt.getTime()
    );

    // Failure analysis
    const failureReasons = failed.reduce((acc, p) => {
      const reason = p.failureReason || 'UNKNOWN';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Breakdown by type
    const byType = this.groupPaymentsByField(payments, 'paymentType');
    const byProvider = this.groupPaymentsByField(payments, 'providerCode');

    return {
      summary: {
        totalPayments,
        successfulPayments: successful.length,
        failedPayments: failed.length,
        successRate: totalPayments > 0 ? (successful.length / totalPayments) * 100 : 0,
        totalAmount: payments.reduce((sum, p) => sum + Number(p.amount), 0),
        successfulAmount: successful.reduce((sum, p) => sum + Number(p.amount), 0),
        failedAmount: failed.reduce((sum, p) => sum + Number(p.amount), 0),
      },
      timing: {
        avgProcessingTimeMs: this.average(processingTimes),
        minProcessingTimeMs: Math.min(...processingTimes) || 0,
        maxProcessingTimeMs: Math.max(...processingTimes) || 0,
        p50ProcessingTimeMs: this.percentile(processingTimes, 50),
        p95ProcessingTimeMs: this.percentile(processingTimes, 95),
      },
      byPaymentType: byType,
      byProvider: byProvider,
      failureAnalysis: params.includeFailureAnalysis ? {
        reasons: failureReasons,
        topFailureReason: Object.entries(failureReasons)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || null,
        retrySuccessRate: await this.calculateRetrySuccessRate(organizationId, startDate, endDate),
      } : null,
      currency: 'PLN',
    };
  }

  // Reconciliation statistics
  async getReconciliationStats(
    organizationId: string,
    params: ReconciliationStats
  ): Promise<ReconciliationStatsResult> {
    const startDate = new Date(params.dateRange.startDate);
    const endDate = new Date(params.dateRange.endDate);

    const sessions = await this.db.reconciliationSessions.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        matches: true,
        exceptions: true,
      },
    });

    // Calculate match statistics
    const allMatches = sessions.flatMap(s => s.matches);
    const allExceptions = sessions.flatMap(s => s.exceptions);

    const exactMatches = allMatches.filter(m => m.matchType === 'EXACT');
    const fuzzyMatches = allMatches.filter(m => m.matchType === 'FUZZY');
    const aiMatches = allMatches.filter(m => m.matchType === 'AI');
    const manualMatches = allMatches.filter(m => m.matchType === 'MANUAL');

    const confidenceScores = allMatches.map(m => Number(m.confidence));

    return {
      summary: {
        totalSessions: sessions.length,
        totalTransactions: sessions.reduce((sum, s) => sum + s.totalTransactions, 0),
        autoMatched: exactMatches.length + fuzzyMatches.length + aiMatches.length,
        manualMatched: manualMatches.length,
        unmatched: allExceptions.filter(e => e.status === 'OPEN').length,
        autoMatchRate: allMatches.length > 0
          ? ((exactMatches.length + fuzzyMatches.length + aiMatches.length) / allMatches.length) * 100
          : 0,
      },
      matchTypes: {
        exact: exactMatches.length,
        fuzzy: fuzzyMatches.length,
        ai: aiMatches.length,
        manual: manualMatches.length,
      },
      confidence: {
        average: this.average(confidenceScores),
        highConfidence: confidenceScores.filter(c => c >= 0.9).length,
        mediumConfidence: confidenceScores.filter(c => c >= 0.7 && c < 0.9).length,
        lowConfidence: confidenceScores.filter(c => c < 0.7).length,
      },
      exceptions: {
        total: allExceptions.length,
        resolved: allExceptions.filter(e => e.status === 'RESOLVED').length,
        avgResolutionTimeHours: this.calculateAvgResolutionTime(allExceptions),
        byCategory: this.groupExceptionsByCategory(allExceptions),
      },
      trends: params.includeTrends ? this.calculateReconciliationTrends(sessions) : null,
    };
  }

  // Bank fee analysis
  async getBankFeeAnalysis(
    organizationId: string,
    params: BankFeeAnalysis
  ): Promise<BankFeeResult> {
    const startDate = new Date(params.dateRange.startDate);
    const endDate = new Date(params.dateRange.endDate);

    // Get fee transactions
    const feeTransactions = await this.db.bankTransactions.findMany({
      where: {
        account: {
          connection: { organizationId },
          ...(params.accountIds?.length && { id: { in: params.accountIds } }),
        },
        transactionDate: {
          gte: startDate,
          lte: endDate,
        },
        OR: [
          { description: { contains: 'opłata', mode: 'insensitive' } },
          { description: { contains: 'prowizja', mode: 'insensitive' } },
          { description: { contains: 'fee', mode: 'insensitive' } },
          { category: 'BANK_FEE' },
        ],
      },
      include: {
        account: {
          select: { bankName: true, providerCode: true },
        },
      },
    });

    // Categorize fees
    const feeBreakdown = this.categorizeFees(feeTransactions);

    // Calculate totals by account
    const byAccount = this.groupFeesByAccount(feeTransactions);

    // Calculate totals by provider
    const byProvider = this.groupFeesByProvider(feeTransactions);

    // Month over month comparison
    const monthlyTrend = this.calculateMonthlyFeeTrend(feeTransactions);

    return {
      summary: {
        totalFees: feeTransactions.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0),
        feeCount: feeTransactions.length,
        avgFeeAmount: feeTransactions.length > 0
          ? feeTransactions.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) / feeTransactions.length
          : 0,
      },
      breakdown: feeBreakdown,
      byAccount,
      byProvider,
      monthlyTrend,
      optimizations: params.includeOptimizations
        ? await this.getFeeOptimizationSuggestions(organizationId)
        : null,
      currency: 'PLN',
    };
  }

  // Fee optimization suggestions
  async getFeeOptimizationSuggestions(
    organizationId: string
  ): Promise<FeeOptimization[]> {
    const suggestions: FeeOptimization[] = [];

    // Analyze payment types and suggest cheaper alternatives
    const recentPayments = await this.db.payments.findMany({
      where: {
        connection: { organizationId },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        status: 'COMPLETED',
      },
    });

    // Check for unnecessary instant payments
    const instantPayments = recentPayments.filter(p => p.paymentType === 'SEPA_INSTANT');
    if (instantPayments.length > 10) {
      const potentialSavings = instantPayments.length * 2; // Assume 2 PLN per instant payment
      suggestions.push({
        type: 'PAYMENT_TYPE_OPTIMIZATION',
        title: 'Ogranicz przelewy natychmiastowe',
        description: `Wykonano ${instantPayments.length} przelewów natychmiastowych w ostatnim miesiącu. Rozważ użycie standardowych przelewów dla transakcji niewymagających natychmiastowej realizacji.`,
        potentialSavings,
        impact: 'MEDIUM',
        actionRequired: 'Przegląd harmonogramu płatności',
      });
    }

    // Check for multiple small transfers that could be batched
    const smallTransfers = recentPayments.filter(p =>
      Number(p.amount) < 100 && p.paymentType === 'DOMESTIC'
    );
    if (smallTransfers.length > 20) {
      suggestions.push({
        type: 'BATCH_OPTIMIZATION',
        title: 'Łącz małe przelewy',
        description: `Wykonano ${smallTransfers.length} przelewów poniżej 100 PLN. Rozważ łączenie płatności do tych samych odbiorców.`,
        potentialSavings: smallTransfers.length * 0.5,
        impact: 'LOW',
        actionRequired: 'Przegląd procesu płatności',
      });
    }

    // Check provider fees comparison
    const providerComparison = await this.compareProviderFees(organizationId);
    if (providerComparison.cheaperAlternative) {
      suggestions.push({
        type: 'PROVIDER_OPTIMIZATION',
        title: 'Rozważ zmianę dostawcy',
        description: `Dostawca ${providerComparison.cheaperAlternative.name} oferuje niższe opłaty dla Twojego profilu użytkowania.`,
        potentialSavings: providerComparison.estimatedSavings,
        impact: 'HIGH',
        actionRequired: 'Analiza migracji kont',
      });
    }

    return suggestions;
  }

  // Dashboard summary
  async getDashboardSummary(organizationId: string): Promise<DashboardSummary> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      currentBalance,
      recentTransactions,
      pendingPayments,
      unmatchedCount,
      connectionHealth,
    ] = await Promise.all([
      this.getCurrentTotalBalance(organizationId),
      this.db.bankTransactions.count({
        where: {
          account: { connection: { organizationId } },
          transactionDate: { gte: sevenDaysAgo },
        },
      }),
      this.db.payments.count({
        where: {
          connection: { organizationId },
          status: 'PENDING',
        },
      }),
      this.db.reconciliationExceptions.count({
        where: {
          session: { organizationId },
          status: 'OPEN',
        },
      }),
      this.getConnectionHealthSummary(organizationId),
    ]);

    return {
      balance: {
        current: currentBalance,
        currency: 'PLN',
      },
      transactions: {
        last7Days: recentTransactions,
      },
      payments: {
        pending: pendingPayments,
      },
      reconciliation: {
        unmatched: unmatchedCount,
      },
      connections: connectionHealth,
      lastUpdated: now.toISOString(),
    };
  }

  // Helper methods
  private aggregateByGranularity(
    transactions: any[],
    granularity: string
  ): CashFlowPeriod[] {
    const grouped = new Map<string, { inflows: Decimal; outflows: Decimal; transactions: number }>();

    for (const tx of transactions) {
      const key = this.getPeriodKey(tx.transactionDate, granularity);
      const current = grouped.get(key) || { inflows: new Decimal(0), outflows: new Decimal(0), transactions: 0 };

      if (tx.type === 'CREDIT') {
        current.inflows = current.inflows.plus(tx.amount);
      } else {
        current.outflows = current.outflows.plus(tx.amount);
      }
      current.transactions++;

      grouped.set(key, current);
    }

    return Array.from(grouped.entries()).map(([period, data]) => ({
      period,
      inflows: data.inflows.toNumber(),
      outflows: data.outflows.toNumber(),
      netFlow: data.inflows.minus(data.outflows).toNumber(),
      transactionCount: data.transactions,
    }));
  }

  private getPeriodKey(date: Date, granularity: string): string {
    switch (granularity) {
      case 'DAILY':
        return date.toISOString().split('T')[0];
      case 'WEEKLY':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
      case 'MONTHLY':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case 'QUARTERLY':
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `${date.getFullYear()}-Q${quarter}`;
      case 'YEARLY':
        return String(date.getFullYear());
      default:
        return date.toISOString().split('T')[0];
    }
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private percentile(numbers: number[], p: number): number {
    if (numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculateConfidence(daysAhead: number, patternCount: number): number {
    // Confidence decreases with days ahead and increases with more patterns
    const baseConfidence = 0.9;
    const dayDecay = 0.01 * daysAhead;
    const patternBoost = Math.min(0.1, patternCount * 0.02);
    return Math.max(0.3, Math.min(0.95, baseConfidence - dayDecay + patternBoost));
  }
}
```

---

## Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsService } from './analytics.service';
import Decimal from 'decimal.js';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      bankTransactions: { findMany: vi.fn(), count: vi.fn() },
      payments: { findMany: vi.fn(), count: vi.fn() },
      reconciliationSessions: { findMany: vi.fn() },
      reconciliationExceptions: { count: vi.fn() },
    };
    service = new AnalyticsService(mockDb);
  });

  describe('getCashFlowAnalysis', () => {
    it('should calculate daily cash flow correctly', async () => {
      mockDb.bankTransactions.findMany.mockResolvedValue([
        { transactionDate: new Date('2024-01-01'), type: 'CREDIT', amount: '1000' },
        { transactionDate: new Date('2024-01-01'), type: 'DEBIT', amount: '300' },
        { transactionDate: new Date('2024-01-02'), type: 'CREDIT', amount: '500' },
      ]);

      const result = await service.getCashFlowAnalysis('org-1', {
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-02' },
        granularity: 'DAILY',
      });

      expect(result.summary.totalInflows).toBe(1500);
      expect(result.summary.totalOutflows).toBe(300);
      expect(result.summary.netCashFlow).toBe(1200);
    });

    it('should aggregate by month correctly', async () => {
      mockDb.bankTransactions.findMany.mockResolvedValue([
        { transactionDate: new Date('2024-01-15'), type: 'CREDIT', amount: '1000' },
        { transactionDate: new Date('2024-02-15'), type: 'CREDIT', amount: '2000' },
      ]);

      const result = await service.getCashFlowAnalysis('org-1', {
        dateRange: { startDate: '2024-01-01', endDate: '2024-02-28' },
        granularity: 'MONTHLY',
      });

      expect(result.periods.length).toBe(2);
      expect(result.periods[0].period).toBe('2024-01');
      expect(result.periods[1].period).toBe('2024-02');
    });
  });

  describe('forecastCashFlow', () => {
    it('should generate forecast for specified days', async () => {
      mockDb.bankTransactions.findMany.mockResolvedValue([
        { transactionDate: new Date(), type: 'CREDIT', amount: '1000', description: 'Wynagrodzenie' },
      ]);

      const forecast = await service.forecastCashFlow('org-1', undefined, 7);

      expect(forecast.length).toBe(7);
      forecast.forEach((day, index) => {
        expect(day.confidenceLevel).toBeGreaterThan(0);
        expect(day.confidenceLevel).toBeLessThanOrEqual(1);
        // Confidence should decrease over time
        if (index > 0) {
          expect(day.confidenceLevel).toBeLessThanOrEqual(forecast[index - 1].confidenceLevel);
        }
      });
    });
  });

  describe('getPaymentMetrics', () => {
    it('should calculate success rate correctly', async () => {
      mockDb.payments.findMany.mockResolvedValue([
        { status: 'COMPLETED', amount: '100', createdAt: new Date(), completedAt: new Date() },
        { status: 'COMPLETED', amount: '200', createdAt: new Date(), completedAt: new Date() },
        { status: 'FAILED', amount: '50', createdAt: new Date(), failureReason: 'INSUFFICIENT_FUNDS' },
      ]);

      const result = await service.getPaymentMetrics('org-1', {
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
      });

      expect(result.summary.totalPayments).toBe(3);
      expect(result.summary.successfulPayments).toBe(2);
      expect(result.summary.failedPayments).toBe(1);
      expect(result.summary.successRate).toBeCloseTo(66.67, 1);
    });

    it('should analyze failure reasons', async () => {
      mockDb.payments.findMany.mockResolvedValue([
        { status: 'FAILED', amount: '100', failureReason: 'INSUFFICIENT_FUNDS' },
        { status: 'FAILED', amount: '100', failureReason: 'INSUFFICIENT_FUNDS' },
        { status: 'FAILED', amount: '100', failureReason: 'INVALID_IBAN' },
      ]);

      const result = await service.getPaymentMetrics('org-1', {
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
        includeFailureAnalysis: true,
      });

      expect(result.failureAnalysis!.reasons['INSUFFICIENT_FUNDS']).toBe(2);
      expect(result.failureAnalysis!.reasons['INVALID_IBAN']).toBe(1);
      expect(result.failureAnalysis!.topFailureReason).toBe('INSUFFICIENT_FUNDS');
    });
  });

  describe('getReconciliationStats', () => {
    it('should calculate auto-match rate', async () => {
      mockDb.reconciliationSessions.findMany.mockResolvedValue([
        {
          totalTransactions: 100,
          matches: [
            { matchType: 'EXACT', confidence: '0.95' },
            { matchType: 'FUZZY', confidence: '0.85' },
            { matchType: 'AI', confidence: '0.90' },
            { matchType: 'MANUAL', confidence: '1.00' },
          ],
          exceptions: [],
        },
      ]);

      const result = await service.getReconciliationStats('org-1', {
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
      });

      expect(result.matchTypes.exact).toBe(1);
      expect(result.matchTypes.fuzzy).toBe(1);
      expect(result.matchTypes.ai).toBe(1);
      expect(result.matchTypes.manual).toBe(1);
      expect(result.summary.autoMatchRate).toBe(75); // 3 out of 4
    });
  });

  describe('getFeeOptimizationSuggestions', () => {
    it('should suggest reducing instant payments', async () => {
      mockDb.payments.findMany.mockResolvedValue(
        Array(15).fill({
          paymentType: 'SEPA_INSTANT',
          status: 'COMPLETED',
          amount: '100',
        })
      );

      const suggestions = await service.getFeeOptimizationSuggestions('org-1');

      const instantSuggestion = suggestions.find(s => s.type === 'PAYMENT_TYPE_OPTIMIZATION');
      expect(instantSuggestion).toBeDefined();
      expect(instantSuggestion!.potentialSavings).toBeGreaterThan(0);
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext } from '../test/context';

describe('Banking Analytics Integration', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();

    // Seed test data
    await ctx.seedBankingData({
      transactions: 100,
      payments: 50,
      reconciliationSessions: 5,
    });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('Cash Flow Analysis', () => {
    it('should generate complete cash flow report', async () => {
      const result = await ctx.trpc.analytics.getCashFlowAnalysis({
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        granularity: 'DAILY',
        includeForecast: true,
        forecastDays: 14,
      });

      expect(result.periods.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.categoryBreakdown).toBeDefined();
      expect(result.forecast).toBeDefined();
      expect(result.forecast!.length).toBe(14);
    });
  });

  describe('Report Export', () => {
    it('should export cash flow report to PDF', async () => {
      const result = await ctx.trpc.analytics.exportReport({
        reportType: 'CASH_FLOW',
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        format: 'PDF',
        includeCharts: true,
        language: 'pl',
      });

      expect(result.id).toBeDefined();
      expect(result.filePath).toContain('.pdf');
      expect(result.fileSize).toBeGreaterThan(0);
    });

    it('should export payment metrics to Excel', async () => {
      const result = await ctx.trpc.analytics.exportReport({
        reportType: 'PAYMENT_METRICS',
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        format: 'XLSX',
      });

      expect(result.filePath).toContain('.xlsx');
    });
  });

  describe('Scheduled Reports', () => {
    it('should create and schedule a recurring report', async () => {
      const scheduled = await ctx.trpc.analytics.scheduleReport({
        reportType: 'COMPREHENSIVE',
        reportName: 'Miesięczny raport bankowy',
        scheduleCron: '0 8 1 * *', // 8 AM on 1st of each month
        timezone: 'Europe/Warsaw',
        periodType: 'MONTHLY',
        lookBackPeriods: 1,
        exportFormat: 'PDF',
        includeCharts: true,
        deliveryMethod: 'EMAIL',
        recipients: ['test@example.com'],
      });

      expect(scheduled.id).toBeDefined();
      expect(scheduled.nextRunAt).toBeDefined();
      expect(scheduled.isActive).toBe(true);
    });
  });

  describe('Dashboard Summary', () => {
    it('should return complete dashboard data', async () => {
      const dashboard = await ctx.trpc.analytics.getDashboardSummary();

      expect(dashboard.balance).toBeDefined();
      expect(dashboard.transactions).toBeDefined();
      expect(dashboard.payments).toBeDefined();
      expect(dashboard.reconciliation).toBeDefined();
      expect(dashboard.connections).toBeDefined();
      expect(dashboard.lastUpdated).toBeDefined();
    });
  });
});
```

---

## Security Checklist

- [ ] Analytics data access restricted by organization
- [ ] Report downloads require authentication
- [ ] Exported reports don't contain sensitive account data
- [ ] Scheduled report recipients validated
- [ ] Row Level Security on all analytics tables
- [ ] Audit trail for report generation and downloads
- [ ] Rate limiting on export operations
- [ ] File storage uses signed URLs with expiration
- [ ] No PII in exported analytics summaries
- [ ] Historical data retention policies enforced

---

## Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `ANALYTICS_QUERIED` | Dashboard/report view | Report type, date range |
| `REPORT_EXPORTED` | Report download | Format, type, size |
| `REPORT_SCHEDULED` | Schedule creation | Schedule, recipients |
| `REPORT_DELIVERED` | Scheduled delivery | Recipient, delivery status |
| `FORECAST_GENERATED` | Cash flow forecast | Forecast days, confidence |
| `OPTIMIZATION_VIEWED` | Fee optimization view | Suggestions shown |

---

## Implementation Notes

### Polish Localization

1. **Report Language**
   - All reports available in Polish
   - Currency formatting: 1 234,56 PLN
   - Date formatting: 31.12.2024
   - Number formatting with Polish conventions

2. **Fee Categories**
   - opłata za prowadzenie (maintenance)
   - prowizja za przelew (transfer fee)
   - opłata za kartę (card fee)
   - opłata za przewalutowanie (FX fee)

### Performance Considerations

- Analytics snapshots pre-computed daily
- Heavy queries run asynchronously
- Report generation uses queue system
- Dashboard data cached with 5-minute TTL
- Large exports generate files in background

### Chart Libraries

- Chart.js for interactive dashboards
- pdfkit for PDF generation
- exceljs for Excel exports
- Chart images embedded in PDF reports

---

## Dependencies

- **BNK-003**: Transaction Import (transaction data)
- **BNK-007**: Transaction Reconciliation (reconciliation data)
- **Infrastructure**: Object storage (S3/GCS), queue system, cron scheduler

---

*Last Updated: December 2024*
