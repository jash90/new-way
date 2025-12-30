# WFA-008: Analytics & Reporting

> **Story ID**: WFA-008
> **Epic**: Workflow Automation Engine (WFA)
> **Priority**: P2 (Medium)
> **Points**: 5
> **Status**: 📋 Ready for Development
> **Sprint**: Week 20

---

## User Story

**As an** accountant,
**I want** comprehensive workflow analytics and reporting,
**So that** I can optimize automation performance and demonstrate ROI.

---

## Acceptance Criteria

### AC1: Execution Statistics
```gherkin
Given workflows are being executed
When I view the analytics dashboard
Then I should see execution statistics including:
  | Metric | Description |
  | Total executions | Count of all workflow runs |
  | Success rate | Percentage of successful completions |
  | Failure rate | Percentage of failed executions |
  | Average duration | Mean execution time |
  | Median duration | Median execution time |
  | P95 duration | 95th percentile duration |
And statistics should be filterable by date range
And I should be able to drill down to individual workflows
```

### AC2: Success/Failure Trends
```gherkin
Given historical execution data exists
When I view trend analysis
Then I should see time-series charts showing:
  | Chart | Data | Granularity |
  | Success trend | Success rate over time | Day/Week/Month |
  | Failure trend | Failure rate over time | Day/Week/Month |
  | Execution volume | Number of executions | Hour/Day/Week |
  | Error distribution | Errors by type | Aggregate |
And I should be able to compare periods
And trends should be exportable as images
```

### AC3: Processing Time Analysis
```gherkin
Given workflows have been executed
When I analyze processing times
Then I should see:
  | Analysis | Description |
  | Duration breakdown | Time spent in each step |
  | Bottleneck detection | Steps causing delays |
  | Queue wait time | Time waiting in queue |
  | External call time | Time in API calls |
  | Comparison | Current vs historical |
And I should receive optimization suggestions
And I should be able to set performance alerts
```

### AC4: Resource Consumption
```gherkin
Given workflows consume system resources
When I view resource analytics
Then I should see:
  | Resource | Metrics |
  | CPU | Average usage, peak usage |
  | Memory | Average allocation, peak allocation |
  | API calls | Count, rate limits |
  | Queue depth | Average, peak, wait times |
  | Concurrent executions | Average, peak |
And I should see resource usage per workflow
And I should receive capacity planning recommendations
```

### AC5: Cost Estimation
```gherkin
Given workflows have associated costs
When I view cost analytics
Then I should see:
  | Cost Type | Calculation |
  | Compute cost | Based on execution time and resources |
  | API cost | Based on external API calls |
  | Storage cost | Based on data processed |
  | Total cost | Sum of all costs |
And costs should be broken down by workflow
And I should see cost trends over time
And costs should be shown in PLN
```

### AC6: Optimization Suggestions
```gherkin
Given workflow analytics are available
When I request optimization suggestions
Then I should receive AI-powered recommendations for:
  | Category | Suggestions |
  | Performance | Reduce step count, parallelize operations |
  | Cost | Batch operations, reduce API calls |
  | Reliability | Add error handling, improve retries |
  | Efficiency | Remove unused steps, optimize conditions |
And each suggestion should include:
  | Field | Description |
  | Impact | Expected improvement percentage |
  | Effort | Implementation difficulty |
  | Priority | Recommended priority |
And I should be able to apply suggestions automatically
```

### AC7: Export to PDF/Excel
```gherkin
Given analytics data is available
When I export a report
Then I should be able to export in formats:
  | Format | Content |
  | PDF | Formatted report with charts |
  | Excel | Raw data with pivot tables |
  | CSV | Raw data for external analysis |
And reports should include:
  | Section | Content |
  | Executive summary | Key metrics overview |
  | Detailed metrics | All analytics data |
  | Trends | Time-series visualizations |
  | Recommendations | Optimization suggestions |
And reports should support Polish language
```

### AC8: Scheduled Reports
```gherkin
Given I want regular analytics updates
When I configure scheduled reports
Then I should be able to:
  | Setting | Options |
  | Frequency | Daily, Weekly, Monthly |
  | Recipients | Email addresses |
  | Format | PDF, Excel, Both |
  | Content | Select sections to include |
  | Delivery time | Preferred delivery time |
And reports should be delivered automatically
And I should be able to pause/resume schedules
```

---

## Technical Specification

### Database Schema

```sql
-- Analytics aggregations (pre-calculated)
CREATE TABLE workflow_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  workflow_id UUID REFERENCES workflows(id),

  -- Time period
  period_type period_type NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Execution metrics
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  cancelled_executions INTEGER DEFAULT 0,

  -- Duration metrics (milliseconds)
  avg_duration_ms BIGINT,
  min_duration_ms BIGINT,
  max_duration_ms BIGINT,
  median_duration_ms BIGINT,
  p95_duration_ms BIGINT,
  p99_duration_ms BIGINT,
  total_duration_ms BIGINT,

  -- Queue metrics
  avg_queue_time_ms BIGINT,
  max_queue_time_ms BIGINT,

  -- Resource metrics
  avg_cpu_usage DECIMAL(5, 2),
  max_cpu_usage DECIMAL(5, 2),
  avg_memory_mb DECIMAL(10, 2),
  max_memory_mb DECIMAL(10, 2),

  -- API metrics
  total_api_calls INTEGER DEFAULT 0,
  failed_api_calls INTEGER DEFAULT 0,

  -- Cost metrics (PLN grosze)
  compute_cost_gr INTEGER DEFAULT 0,
  api_cost_gr INTEGER DEFAULT 0,
  storage_cost_gr INTEGER DEFAULT 0,
  total_cost_gr INTEGER DEFAULT 0,

  -- Calculated metrics
  success_rate DECIMAL(5, 2),
  failure_rate DECIMAL(5, 2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, workflow_id, period_type, period_start)
);

-- Period type enum
CREATE TYPE period_type AS ENUM (
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'yearly'
);

-- Step-level analytics
CREATE TABLE step_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  workflow_id UUID REFERENCES workflows(id),
  step_id VARCHAR(255) NOT NULL,
  step_name VARCHAR(255),

  -- Time period
  period_type period_type NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,

  -- Execution metrics
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,

  -- Duration metrics (milliseconds)
  avg_duration_ms BIGINT,
  min_duration_ms BIGINT,
  max_duration_ms BIGINT,

  -- Error analysis
  error_counts JSONB DEFAULT '{}',

  -- Bottleneck flag
  is_bottleneck BOOLEAN DEFAULT false,
  bottleneck_score DECIMAL(3, 2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(workflow_id, step_id, period_type, period_start)
);

-- Error analytics
CREATE TABLE error_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  workflow_id UUID REFERENCES workflows(id),

  -- Time period
  period_type period_type NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,

  -- Error classification
  error_type error_type NOT NULL,
  error_code VARCHAR(100),
  error_message TEXT,

  -- Counts
  occurrence_count INTEGER DEFAULT 0,
  affected_executions INTEGER DEFAULT 0,

  -- Impact
  avg_recovery_time_ms BIGINT,
  auto_recovered_count INTEGER DEFAULT 0,
  manual_intervention_count INTEGER DEFAULT 0,

  -- First/last occurrence
  first_occurrence TIMESTAMPTZ,
  last_occurrence TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(workflow_id, error_type, error_code, period_type, period_start)
);

-- Cost analytics
CREATE TABLE cost_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  workflow_id UUID REFERENCES workflows(id),

  -- Time period
  period_type period_type NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,

  -- Cost breakdown (PLN grosze)
  compute_cost_gr INTEGER DEFAULT 0,
  api_call_cost_gr INTEGER DEFAULT 0,
  storage_cost_gr INTEGER DEFAULT 0,
  external_service_cost_gr INTEGER DEFAULT 0,
  total_cost_gr INTEGER DEFAULT 0,

  -- Cost details
  cost_details JSONB DEFAULT '{}',

  -- Comparison
  previous_period_cost_gr INTEGER,
  cost_change_percent DECIMAL(5, 2),

  -- Budget
  budget_limit_gr INTEGER,
  budget_utilization_percent DECIMAL(5, 2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, workflow_id, period_type, period_start)
);

-- Optimization suggestions
CREATE TABLE optimization_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  workflow_id UUID REFERENCES workflows(id),

  -- Suggestion details
  category suggestion_category NOT NULL,
  title VARCHAR(255) NOT NULL,
  title_pl VARCHAR(255),
  description TEXT,
  description_pl TEXT,

  -- Impact assessment
  expected_improvement_percent DECIMAL(5, 2),
  confidence_score DECIMAL(3, 2),
  effort_level effort_level NOT NULL,
  priority suggestion_priority NOT NULL,

  -- Implementation
  implementation_steps JSONB,
  auto_applicable BOOLEAN DEFAULT false,

  -- Status tracking
  status suggestion_status DEFAULT 'pending',
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES users(id),
  result_improvement_percent DECIMAL(5, 2),

  -- Analysis context
  analysis_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suggestion category enum
CREATE TYPE suggestion_category AS ENUM (
  'performance',
  'cost',
  'reliability',
  'efficiency',
  'security'
);

-- Effort level enum
CREATE TYPE effort_level AS ENUM (
  'low',
  'medium',
  'high'
);

-- Suggestion priority enum
CREATE TYPE suggestion_priority AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

-- Suggestion status enum
CREATE TYPE suggestion_status AS ENUM (
  'pending',
  'applied',
  'dismissed',
  'expired'
);

-- Scheduled reports
CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  created_by UUID REFERENCES users(id),

  -- Report configuration
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Scope
  workflow_ids UUID[] DEFAULT '{}',
  include_all_workflows BOOLEAN DEFAULT false,

  -- Schedule
  frequency report_frequency NOT NULL,
  delivery_time TIME DEFAULT '08:00:00',
  timezone VARCHAR(50) DEFAULT 'Europe/Warsaw',
  next_delivery_at TIMESTAMPTZ,

  -- Content
  format report_format NOT NULL,
  sections report_section[] NOT NULL,
  language VARCHAR(2) DEFAULT 'pl',

  -- Recipients
  recipients TEXT[] NOT NULL,
  cc_recipients TEXT[] DEFAULT '{}',

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_delivered_at TIMESTAMPTZ,
  delivery_count INTEGER DEFAULT 0,
  last_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report frequency enum
CREATE TYPE report_frequency AS ENUM (
  'daily',
  'weekly',
  'monthly',
  'quarterly'
);

-- Report format enum
CREATE TYPE report_format AS ENUM (
  'pdf',
  'excel',
  'csv',
  'all'
);

-- Report section enum
CREATE TYPE report_section AS ENUM (
  'executive_summary',
  'execution_metrics',
  'success_trends',
  'failure_analysis',
  'processing_times',
  'resource_usage',
  'cost_analysis',
  'optimization_suggestions',
  'detailed_data'
);

-- Report deliveries
CREATE TABLE report_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_report_id UUID REFERENCES scheduled_reports(id) ON DELETE CASCADE,

  -- Delivery details
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  status delivery_status NOT NULL,
  error_message TEXT,

  -- Report content
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  file_urls JSONB DEFAULT '{}',

  -- Recipients
  sent_to TEXT[],

  -- Metrics snapshot
  metrics_snapshot JSONB
);

-- Delivery status enum
CREATE TYPE delivery_status AS ENUM (
  'pending',
  'generating',
  'sending',
  'delivered',
  'failed'
);

-- RLS Policies
ALTER TABLE workflow_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY analytics_org_access ON workflow_analytics
  FOR ALL USING (organization_id = current_organization_id());

CREATE POLICY step_analytics_org_access ON step_analytics
  FOR ALL USING (organization_id = current_organization_id());

CREATE POLICY error_analytics_org_access ON error_analytics
  FOR ALL USING (organization_id = current_organization_id());

CREATE POLICY cost_analytics_org_access ON cost_analytics
  FOR ALL USING (organization_id = current_organization_id());

CREATE POLICY suggestions_org_access ON optimization_suggestions
  FOR ALL USING (organization_id = current_organization_id());

CREATE POLICY scheduled_reports_org_access ON scheduled_reports
  FOR ALL USING (organization_id = current_organization_id());

-- Indexes
CREATE INDEX idx_analytics_workflow_period ON workflow_analytics(workflow_id, period_type, period_start);
CREATE INDEX idx_analytics_org_period ON workflow_analytics(organization_id, period_type, period_start);
CREATE INDEX idx_step_analytics_workflow ON step_analytics(workflow_id, period_type, period_start);
CREATE INDEX idx_error_analytics_workflow ON error_analytics(workflow_id, period_type, period_start);
CREATE INDEX idx_cost_analytics_org ON cost_analytics(organization_id, period_type, period_start);
CREATE INDEX idx_suggestions_workflow ON optimization_suggestions(workflow_id, status);
CREATE INDEX idx_scheduled_reports_next ON scheduled_reports(next_delivery_at) WHERE is_active = true;
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Period type
export const periodTypeSchema = z.enum([
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'yearly'
]);

// Report format
export const reportFormatSchema = z.enum(['pdf', 'excel', 'csv', 'all']);

// Report frequency
export const reportFrequencySchema = z.enum([
  'daily',
  'weekly',
  'monthly',
  'quarterly'
]);

// Report sections
export const reportSectionSchema = z.enum([
  'executive_summary',
  'execution_metrics',
  'success_trends',
  'failure_analysis',
  'processing_times',
  'resource_usage',
  'cost_analysis',
  'optimization_suggestions',
  'detailed_data'
]);

// Suggestion category
export const suggestionCategorySchema = z.enum([
  'performance',
  'cost',
  'reliability',
  'efficiency',
  'security'
]);

// Analytics query input
export const analyticsQueryInputSchema = z.object({
  workflowId: z.string().uuid().optional(),
  periodType: periodTypeSchema.default('daily'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  includeStepAnalytics: z.boolean().default(false),
  includeErrorAnalytics: z.boolean().default(false),
  includeCostAnalytics: z.boolean().default(false)
});

// Dashboard query input
export const dashboardQueryInputSchema = z.object({
  periodType: periodTypeSchema.default('daily'),
  periods: z.number().int().min(1).max(365).default(30),
  workflowIds: z.array(z.string().uuid()).optional(),
  metrics: z.array(z.string()).optional()
});

// Trend query input
export const trendQueryInputSchema = z.object({
  workflowId: z.string().uuid().optional(),
  metric: z.enum([
    'success_rate',
    'failure_rate',
    'execution_count',
    'avg_duration',
    'total_cost'
  ]),
  periodType: periodTypeSchema.default('daily'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  compareWithPrevious: z.boolean().default(false)
});

// Cost analysis input
export const costAnalysisInputSchema = z.object({
  workflowId: z.string().uuid().optional(),
  periodType: periodTypeSchema.default('monthly'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  groupBy: z.enum(['workflow', 'cost_type', 'day', 'week', 'month']).default('workflow')
});

// Optimization suggestions input
export const optimizationSuggestionsInputSchema = z.object({
  workflowId: z.string().uuid().optional(),
  category: suggestionCategorySchema.optional(),
  minConfidence: z.number().min(0).max(1).default(0.7),
  includeApplied: z.boolean().default(false),
  limit: z.number().min(1).max(50).default(10)
});

// Apply suggestion input
export const applySuggestionInputSchema = z.object({
  suggestionId: z.string().uuid(),
  confirm: z.boolean()
});

// Export report input
export const exportReportInputSchema = z.object({
  workflowId: z.string().uuid().optional(),
  periodType: periodTypeSchema.default('monthly'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  format: reportFormatSchema.default('pdf'),
  sections: z.array(reportSectionSchema).default([
    'executive_summary',
    'execution_metrics',
    'success_trends'
  ]),
  language: z.enum(['pl', 'en']).default('pl')
});

// Create scheduled report input
export const createScheduledReportInputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  workflowIds: z.array(z.string().uuid()).default([]),
  includeAllWorkflows: z.boolean().default(false),
  frequency: reportFrequencySchema,
  deliveryTime: z.string().regex(/^\d{2}:\d{2}$/).default('08:00'),
  timezone: z.string().default('Europe/Warsaw'),
  format: reportFormatSchema.default('pdf'),
  sections: z.array(reportSectionSchema).min(1),
  language: z.enum(['pl', 'en']).default('pl'),
  recipients: z.array(z.string().email()).min(1),
  ccRecipients: z.array(z.string().email()).default([])
});

// Update scheduled report input
export const updateScheduledReportInputSchema = createScheduledReportInputSchema.partial().extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional()
});
```

### Service Implementation

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private reportGenerator: ReportGeneratorService,
    private emailService: EmailService,
    private aiService: AIOptimizationService
  ) {}

  async getDashboard(
    input: z.infer<typeof dashboardQueryInputSchema>,
    organizationId: string
  ): Promise<DashboardData> {
    const endDate = new Date();
    const startDate = this.calculateStartDate(endDate, input.periodType, input.periods);

    const [
      summaryMetrics,
      trendData,
      topWorkflows,
      recentErrors,
      costSummary
    ] = await Promise.all([
      this.getSummaryMetrics(organizationId, startDate, endDate, input.workflowIds),
      this.getTrendData(organizationId, input.periodType, startDate, endDate, input.workflowIds),
      this.getTopWorkflows(organizationId, startDate, endDate, 10),
      this.getRecentErrors(organizationId, 10),
      this.getCostSummary(organizationId, startDate, endDate)
    ]);

    return {
      summary: summaryMetrics,
      trends: trendData,
      topWorkflows,
      recentErrors,
      costs: costSummary,
      period: {
        start: startDate,
        end: endDate,
        type: input.periodType
      }
    };
  }

  private async getSummaryMetrics(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    workflowIds?: string[]
  ): Promise<SummaryMetrics> {
    const where: any = {
      organizationId,
      periodStart: { gte: startDate },
      periodEnd: { lte: endDate }
    };

    if (workflowIds?.length) {
      where.workflowId = { in: workflowIds };
    }

    const aggregations = await this.prisma.workflowAnalytics.aggregate({
      where,
      _sum: {
        totalExecutions: true,
        successfulExecutions: true,
        failedExecutions: true,
        totalDurationMs: true,
        totalCostGr: true
      },
      _avg: {
        avgDurationMs: true,
        successRate: true
      }
    });

    const previousPeriod = await this.getPreviousPeriodMetrics(
      organizationId,
      startDate,
      endDate,
      workflowIds
    );

    return {
      totalExecutions: aggregations._sum.totalExecutions ?? 0,
      successfulExecutions: aggregations._sum.successfulExecutions ?? 0,
      failedExecutions: aggregations._sum.failedExecutions ?? 0,
      successRate: aggregations._avg.successRate ?? 0,
      avgDurationMs: aggregations._avg.avgDurationMs ?? 0,
      totalCostPln: (aggregations._sum.totalCostGr ?? 0) / 100,
      comparison: {
        executionsChange: this.calculateChange(
          aggregations._sum.totalExecutions,
          previousPeriod.totalExecutions
        ),
        successRateChange: this.calculateChange(
          aggregations._avg.successRate,
          previousPeriod.successRate
        ),
        durationChange: this.calculateChange(
          aggregations._avg.avgDurationMs,
          previousPeriod.avgDurationMs
        ),
        costChange: this.calculateChange(
          aggregations._sum.totalCostGr,
          previousPeriod.totalCostGr
        )
      }
    };
  }

  async getTrends(
    input: z.infer<typeof trendQueryInputSchema>,
    organizationId: string
  ): Promise<TrendData> {
    const where: any = {
      organizationId,
      periodType: input.periodType,
      periodStart: { gte: input.startDate },
      periodEnd: { lte: input.endDate }
    };

    if (input.workflowId) {
      where.workflowId = input.workflowId;
    }

    const data = await this.prisma.workflowAnalytics.findMany({
      where,
      select: {
        periodStart: true,
        [this.mapMetricToColumn(input.metric)]: true
      },
      orderBy: { periodStart: 'asc' }
    });

    const result: TrendData = {
      metric: input.metric,
      periodType: input.periodType,
      data: data.map(d => ({
        period: d.periodStart,
        value: d[this.mapMetricToColumn(input.metric)]
      }))
    };

    if (input.compareWithPrevious) {
      const periodLength = input.endDate.getTime() - input.startDate.getTime();
      const previousStart = new Date(input.startDate.getTime() - periodLength);
      const previousEnd = input.startDate;

      const previousData = await this.prisma.workflowAnalytics.findMany({
        where: {
          ...where,
          periodStart: { gte: previousStart },
          periodEnd: { lte: previousEnd }
        },
        select: {
          periodStart: true,
          [this.mapMetricToColumn(input.metric)]: true
        },
        orderBy: { periodStart: 'asc' }
      });

      result.previousPeriod = {
        start: previousStart,
        end: previousEnd,
        data: previousData.map(d => ({
          period: d.periodStart,
          value: d[this.mapMetricToColumn(input.metric)]
        }))
      };
    }

    return result;
  }

  async getProcessingTimeAnalysis(
    workflowId: string,
    startDate: Date,
    endDate: Date,
    organizationId: string
  ): Promise<ProcessingTimeAnalysis> {
    // Get step-level analytics
    const stepAnalytics = await this.prisma.stepAnalytics.findMany({
      where: {
        workflowId,
        organizationId,
        periodStart: { gte: startDate, lte: endDate }
      },
      orderBy: { avgDurationMs: 'desc' }
    });

    // Identify bottlenecks
    const totalDuration = stepAnalytics.reduce(
      (sum, s) => sum + (s.avgDurationMs ?? 0),
      0
    );

    const bottlenecks = stepAnalytics
      .filter(s => (s.avgDurationMs ?? 0) / totalDuration > 0.2)
      .map(s => ({
        stepId: s.stepId,
        stepName: s.stepName,
        avgDurationMs: s.avgDurationMs,
        percentageOfTotal: ((s.avgDurationMs ?? 0) / totalDuration) * 100,
        recommendation: this.generateBottleneckRecommendation(s)
      }));

    // Get queue metrics
    const queueMetrics = await this.prisma.workflowAnalytics.aggregate({
      where: {
        workflowId,
        organizationId,
        periodStart: { gte: startDate, lte: endDate }
      },
      _avg: { avgQueueTimeMs: true },
      _max: { maxQueueTimeMs: true }
    });

    return {
      totalAvgDurationMs: totalDuration,
      stepBreakdown: stepAnalytics.map(s => ({
        stepId: s.stepId,
        stepName: s.stepName,
        avgDurationMs: s.avgDurationMs,
        minDurationMs: s.minDurationMs,
        maxDurationMs: s.maxDurationMs,
        executionCount: s.totalExecutions,
        isBottleneck: s.isBottleneck
      })),
      bottlenecks,
      queueAnalysis: {
        avgQueueTimeMs: queueMetrics._avg.avgQueueTimeMs ?? 0,
        maxQueueTimeMs: queueMetrics._max.maxQueueTimeMs ?? 0
      }
    };
  }

  async getCostAnalysis(
    input: z.infer<typeof costAnalysisInputSchema>,
    organizationId: string
  ): Promise<CostAnalysis> {
    const where: any = {
      organizationId,
      periodType: input.periodType,
      periodStart: { gte: input.startDate },
      periodEnd: { lte: input.endDate }
    };

    if (input.workflowId) {
      where.workflowId = input.workflowId;
    }

    const costData = await this.prisma.costAnalytics.findMany({
      where,
      include: {
        workflow: { select: { id: true, name: true } }
      },
      orderBy: { totalCostGr: 'desc' }
    });

    // Aggregate by grouping
    const groupedCosts = this.groupCosts(costData, input.groupBy);

    // Calculate totals
    const totals = costData.reduce(
      (acc, c) => ({
        compute: acc.compute + c.computeCostGr,
        api: acc.api + c.apiCallCostGr,
        storage: acc.storage + c.storageCostGr,
        external: acc.external + c.externalServiceCostGr,
        total: acc.total + c.totalCostGr
      }),
      { compute: 0, api: 0, storage: 0, external: 0, total: 0 }
    );

    // Get previous period for comparison
    const previousPeriodCosts = await this.getPreviousPeriodCosts(
      organizationId,
      input.startDate,
      input.endDate,
      input.workflowId
    );

    return {
      breakdown: {
        computeCostPln: totals.compute / 100,
        apiCostPln: totals.api / 100,
        storageCostPln: totals.storage / 100,
        externalServiceCostPln: totals.external / 100,
        totalCostPln: totals.total / 100
      },
      groupedData: groupedCosts,
      comparison: {
        previousPeriodCostPln: previousPeriodCosts / 100,
        changePercent: this.calculateChange(totals.total, previousPeriodCosts)
      },
      projections: this.calculateCostProjections(costData)
    };
  }

  async getOptimizationSuggestions(
    input: z.infer<typeof optimizationSuggestionsInputSchema>,
    organizationId: string
  ): Promise<OptimizationSuggestion[]> {
    const where: any = {
      organizationId,
      confidenceScore: { gte: input.minConfidence }
    };

    if (input.workflowId) {
      where.workflowId = input.workflowId;
    }

    if (!input.includeApplied) {
      where.status = { in: ['pending'] };
    }

    if (input.category) {
      where.category = input.category;
    }

    const suggestions = await this.prisma.optimizationSuggestion.findMany({
      where,
      include: {
        workflow: { select: { id: true, name: true } }
      },
      orderBy: [
        { priority: 'desc' },
        { expectedImprovementPercent: 'desc' }
      ],
      take: input.limit
    });

    return suggestions.map(s => ({
      id: s.id,
      workflowId: s.workflowId,
      workflowName: s.workflow?.name,
      category: s.category,
      title: s.title,
      titlePl: s.titlePl,
      description: s.description,
      descriptionPl: s.descriptionPl,
      expectedImprovementPercent: s.expectedImprovementPercent,
      confidenceScore: s.confidenceScore,
      effortLevel: s.effortLevel,
      priority: s.priority,
      implementationSteps: s.implementationSteps,
      autoApplicable: s.autoApplicable,
      status: s.status
    }));
  }

  async generateSuggestions(
    workflowId: string,
    organizationId: string
  ): Promise<void> {
    // Get workflow analytics
    const analytics = await this.getWorkflowAnalytics(workflowId, organizationId);

    // Get step analytics
    const stepAnalytics = await this.prisma.stepAnalytics.findMany({
      where: { workflowId, organizationId }
    });

    // Get error patterns
    const errorPatterns = await this.prisma.errorAnalytics.findMany({
      where: { workflowId, organizationId }
    });

    // Generate AI-powered suggestions
    const suggestions = await this.aiService.analyzeAndSuggest({
      workflowId,
      analytics,
      stepAnalytics,
      errorPatterns
    });

    // Store suggestions
    await this.prisma.optimizationSuggestion.createMany({
      data: suggestions.map(s => ({
        organizationId,
        workflowId,
        category: s.category,
        title: s.title,
        titlePl: s.titlePl,
        description: s.description,
        descriptionPl: s.descriptionPl,
        expectedImprovementPercent: s.expectedImprovement,
        confidenceScore: s.confidence,
        effortLevel: s.effort,
        priority: s.priority,
        implementationSteps: s.steps,
        autoApplicable: s.autoApplicable,
        analysisData: s.analysisContext
      }))
    });

    this.eventEmitter.emit('suggestions.generated', {
      workflowId,
      organizationId,
      count: suggestions.length
    });
  }

  async applySuggestion(
    input: z.infer<typeof applySuggestionInputSchema>,
    userId: string,
    organizationId: string
  ): Promise<ApplySuggestionResult> {
    const suggestion = await this.prisma.optimizationSuggestion.findUnique({
      where: { id: input.suggestionId },
      include: { workflow: true }
    });

    if (!suggestion) {
      throw new NotFoundException('Sugestia nie została znaleziona');
    }

    if (suggestion.organizationId !== organizationId) {
      throw new ForbiddenException('Brak dostępu do tej sugestii');
    }

    if (!suggestion.autoApplicable) {
      throw new BadRequestException(
        'Ta sugestia wymaga ręcznej implementacji'
      );
    }

    if (!input.confirm) {
      return {
        requiresConfirmation: true,
        changes: suggestion.implementationSteps,
        expectedImpact: suggestion.expectedImprovementPercent
      };
    }

    // Apply the suggestion
    const result = await this.applyAutomaticSuggestion(
      suggestion,
      userId,
      organizationId
    );

    // Update suggestion status
    await this.prisma.optimizationSuggestion.update({
      where: { id: input.suggestionId },
      data: {
        status: 'applied',
        appliedAt: new Date(),
        appliedBy: userId
      }
    });

    this.eventEmitter.emit('suggestion.applied', {
      suggestionId: input.suggestionId,
      workflowId: suggestion.workflowId,
      userId,
      organizationId
    });

    return {
      success: true,
      appliedChanges: result.changes,
      newWorkflowVersion: result.newVersion
    };
  }

  async exportReport(
    input: z.infer<typeof exportReportInputSchema>,
    userId: string,
    organizationId: string
  ): Promise<ExportedReport> {
    // Gather report data
    const reportData = await this.gatherReportData(
      input,
      organizationId
    );

    // Generate report based on format
    let file: Buffer;
    let mimeType: string;
    let filename: string;

    switch (input.format) {
      case 'pdf':
        file = await this.reportGenerator.generatePdf(reportData, input.language);
        mimeType = 'application/pdf';
        filename = `workflow-report-${format(input.startDate, 'yyyy-MM')}.pdf`;
        break;

      case 'excel':
        file = await this.reportGenerator.generateExcel(reportData, input.language);
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `workflow-report-${format(input.startDate, 'yyyy-MM')}.xlsx`;
        break;

      case 'csv':
        file = await this.reportGenerator.generateCsv(reportData);
        mimeType = 'text/csv';
        filename = `workflow-report-${format(input.startDate, 'yyyy-MM')}.csv`;
        break;

      default:
        throw new BadRequestException('Nieobsługiwany format raportu');
    }

    // Log audit event
    await this.prisma.auditLog.create({
      data: {
        action: 'REPORT_EXPORTED',
        entityType: 'analytics',
        userId,
        organizationId,
        metadata: {
          format: input.format,
          periodStart: input.startDate,
          periodEnd: input.endDate,
          sections: input.sections
        }
      }
    });

    return {
      file,
      mimeType,
      filename
    };
  }

  async createScheduledReport(
    input: z.infer<typeof createScheduledReportInputSchema>,
    userId: string,
    organizationId: string
  ): Promise<ScheduledReport> {
    const nextDelivery = this.calculateNextDelivery(
      input.frequency,
      input.deliveryTime,
      input.timezone
    );

    const report = await this.prisma.scheduledReport.create({
      data: {
        organizationId,
        createdBy: userId,
        name: input.name,
        description: input.description,
        workflowIds: input.workflowIds,
        includeAllWorkflows: input.includeAllWorkflows,
        frequency: input.frequency,
        deliveryTime: input.deliveryTime,
        timezone: input.timezone,
        nextDeliveryAt: nextDelivery,
        format: input.format,
        sections: input.sections,
        language: input.language,
        recipients: input.recipients,
        ccRecipients: input.ccRecipients,
        isActive: true
      }
    });

    this.eventEmitter.emit('scheduled_report.created', {
      reportId: report.id,
      userId,
      organizationId
    });

    return report;
  }

  // Cron job for report delivery
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledReports(): Promise<void> {
    const now = new Date();

    const dueReports = await this.prisma.scheduledReport.findMany({
      where: {
        isActive: true,
        nextDeliveryAt: { lte: now }
      }
    });

    for (const report of dueReports) {
      await this.deliverScheduledReport(report);
    }
  }

  private async deliverScheduledReport(
    report: ScheduledReport
  ): Promise<void> {
    const delivery = await this.prisma.reportDelivery.create({
      data: {
        scheduledReportId: report.id,
        status: 'generating',
        periodStart: this.getPeriodStart(report.frequency),
        periodEnd: new Date()
      }
    });

    try {
      // Generate report
      const reportData = await this.gatherReportData(
        {
          workflowId: report.includeAllWorkflows ? undefined : report.workflowIds[0],
          periodType: this.frequencyToPeriodType(report.frequency),
          startDate: delivery.periodStart,
          endDate: delivery.periodEnd,
          format: report.format as any,
          sections: report.sections as any,
          language: report.language as any
        },
        report.organizationId
      );

      // Generate files
      const files: Record<string, string> = {};

      if (report.format === 'pdf' || report.format === 'all') {
        const pdfBuffer = await this.reportGenerator.generatePdf(
          reportData,
          report.language
        );
        const pdfUrl = await this.storageService.upload(pdfBuffer, 'report.pdf');
        files.pdf = pdfUrl;
      }

      if (report.format === 'excel' || report.format === 'all') {
        const excelBuffer = await this.reportGenerator.generateExcel(
          reportData,
          report.language
        );
        const excelUrl = await this.storageService.upload(excelBuffer, 'report.xlsx');
        files.excel = excelUrl;
      }

      // Update delivery status
      await this.prisma.reportDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'sending',
          fileUrls: files
        }
      });

      // Send emails
      await this.emailService.sendReportEmail({
        to: report.recipients,
        cc: report.ccRecipients,
        subject: report.language === 'pl'
          ? `Raport workflow: ${report.name}`
          : `Workflow Report: ${report.name}`,
        reportName: report.name,
        periodStart: delivery.periodStart,
        periodEnd: delivery.periodEnd,
        fileUrls: files,
        language: report.language
      });

      // Mark as delivered
      await this.prisma.$transaction([
        this.prisma.reportDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'delivered',
            sentTo: report.recipients,
            metricsSnapshot: reportData
          }
        }),
        this.prisma.scheduledReport.update({
          where: { id: report.id },
          data: {
            lastDeliveredAt: new Date(),
            deliveryCount: { increment: 1 },
            nextDeliveryAt: this.calculateNextDelivery(
              report.frequency,
              report.deliveryTime,
              report.timezone
            ),
            lastError: null
          }
        })
      ]);

    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.reportDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'failed',
            errorMessage: error.message
          }
        }),
        this.prisma.scheduledReport.update({
          where: { id: report.id },
          data: {
            lastError: error.message,
            nextDeliveryAt: this.calculateNextDelivery(
              report.frequency,
              report.deliveryTime,
              report.timezone
            )
          }
        })
      ]);
    }
  }

  // Analytics aggregation job
  @Cron(CronExpression.EVERY_HOUR)
  async aggregateHourlyAnalytics(): Promise<void> {
    await this.aggregateAnalytics('hourly');
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async aggregateDailyAnalytics(): Promise<void> {
    await this.aggregateAnalytics('daily');
  }

  @Cron('0 2 * * 1') // Every Monday at 2 AM
  async aggregateWeeklyAnalytics(): Promise<void> {
    await this.aggregateAnalytics('weekly');
  }

  @Cron('0 3 1 * *') // First day of month at 3 AM
  async aggregateMonthlyAnalytics(): Promise<void> {
    await this.aggregateAnalytics('monthly');
  }

  private async aggregateAnalytics(periodType: string): Promise<void> {
    const { start, end } = this.getPeriodBounds(periodType);

    // Get all organizations
    const organizations = await this.prisma.organization.findMany({
      select: { id: true }
    });

    for (const org of organizations) {
      await this.aggregateOrganizationAnalytics(org.id, periodType, start, end);
    }
  }

  private async aggregateOrganizationAnalytics(
    organizationId: string,
    periodType: string,
    start: Date,
    end: Date
  ): Promise<void> {
    // Aggregate execution data
    const executions = await this.prisma.workflowExecution.groupBy({
      by: ['workflowId'],
      where: {
        workflow: { organizationId },
        createdAt: { gte: start, lt: end }
      },
      _count: { id: true },
      _avg: { durationMs: true },
      _min: { durationMs: true },
      _max: { durationMs: true }
    });

    for (const exec of executions) {
      // Get success/failure counts
      const statusCounts = await this.prisma.workflowExecution.groupBy({
        by: ['status'],
        where: {
          workflowId: exec.workflowId,
          createdAt: { gte: start, lt: end }
        },
        _count: { id: true }
      });

      const successCount = statusCounts.find(s => s.status === 'COMPLETED')?._count?.id ?? 0;
      const failedCount = statusCounts.find(s => s.status === 'FAILED')?._count?.id ?? 0;
      const cancelledCount = statusCounts.find(s => s.status === 'CANCELLED')?._count?.id ?? 0;

      // Upsert analytics record
      await this.prisma.workflowAnalytics.upsert({
        where: {
          organizationId_workflowId_periodType_periodStart: {
            organizationId,
            workflowId: exec.workflowId,
            periodType: periodType as any,
            periodStart: start
          }
        },
        create: {
          organizationId,
          workflowId: exec.workflowId,
          periodType: periodType as any,
          periodStart: start,
          periodEnd: end,
          totalExecutions: exec._count.id,
          successfulExecutions: successCount,
          failedExecutions: failedCount,
          cancelledExecutions: cancelledCount,
          avgDurationMs: exec._avg.durationMs,
          minDurationMs: exec._min.durationMs,
          maxDurationMs: exec._max.durationMs,
          successRate: exec._count.id > 0
            ? (successCount / exec._count.id) * 100
            : 0,
          failureRate: exec._count.id > 0
            ? (failedCount / exec._count.id) * 100
            : 0
        },
        update: {
          totalExecutions: exec._count.id,
          successfulExecutions: successCount,
          failedExecutions: failedCount,
          cancelledExecutions: cancelledCount,
          avgDurationMs: exec._avg.durationMs,
          minDurationMs: exec._min.durationMs,
          maxDurationMs: exec._max.durationMs,
          successRate: exec._count.id > 0
            ? (successCount / exec._count.id) * 100
            : 0,
          failureRate: exec._count.id > 0
            ? (failedCount / exec._count.id) * 100
            : 0,
          updatedAt: new Date()
        }
      });
    }
  }

  private calculateChange(current: number | null, previous: number | null): number {
    if (!previous || previous === 0) return 0;
    if (!current) return -100;
    return ((current - previous) / previous) * 100;
  }

  private mapMetricToColumn(metric: string): string {
    const mapping: Record<string, string> = {
      success_rate: 'successRate',
      failure_rate: 'failureRate',
      execution_count: 'totalExecutions',
      avg_duration: 'avgDurationMs',
      total_cost: 'totalCostGr'
    };
    return mapping[metric] ?? metric;
  }
}
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '@/server/trpc';
import { AnalyticsService } from './analytics.service';
import {
  analyticsQueryInputSchema,
  dashboardQueryInputSchema,
  trendQueryInputSchema,
  costAnalysisInputSchema,
  optimizationSuggestionsInputSchema,
  applySuggestionInputSchema,
  exportReportInputSchema,
  createScheduledReportInputSchema,
  updateScheduledReportInputSchema
} from './analytics.schemas';

export const analyticsRouter = router({
  dashboard: protectedProcedure
    .input(dashboardQueryInputSchema)
    .query(async ({ input, ctx }) => {
      return ctx.analyticsService.getDashboard(input, ctx.organizationId);
    }),

  trends: protectedProcedure
    .input(trendQueryInputSchema)
    .query(async ({ input, ctx }) => {
      return ctx.analyticsService.getTrends(input, ctx.organizationId);
    }),

  processingTime: protectedProcedure
    .input(z.object({
      workflowId: z.string().uuid(),
      startDate: z.coerce.date(),
      endDate: z.coerce.date()
    }))
    .query(async ({ input, ctx }) => {
      return ctx.analyticsService.getProcessingTimeAnalysis(
        input.workflowId,
        input.startDate,
        input.endDate,
        ctx.organizationId
      );
    }),

  costs: protectedProcedure
    .input(costAnalysisInputSchema)
    .query(async ({ input, ctx }) => {
      return ctx.analyticsService.getCostAnalysis(input, ctx.organizationId);
    }),

  suggestions: protectedProcedure
    .input(optimizationSuggestionsInputSchema)
    .query(async ({ input, ctx }) => {
      return ctx.analyticsService.getOptimizationSuggestions(
        input,
        ctx.organizationId
      );
    }),

  generateSuggestions: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.analyticsService.generateSuggestions(
        input.workflowId,
        ctx.organizationId
      );
      return { success: true };
    }),

  applySuggestion: protectedProcedure
    .input(applySuggestionInputSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.analyticsService.applySuggestion(
        input,
        ctx.user.id,
        ctx.organizationId
      );
    }),

  exportReport: protectedProcedure
    .input(exportReportInputSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.analyticsService.exportReport(
        input,
        ctx.user.id,
        ctx.organizationId
      );
    }),

  scheduledReports: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.analyticsService.getScheduledReports(ctx.organizationId);
    }),

  createScheduledReport: protectedProcedure
    .input(createScheduledReportInputSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.analyticsService.createScheduledReport(
        input,
        ctx.user.id,
        ctx.organizationId
      );
    }),

  updateScheduledReport: protectedProcedure
    .input(updateScheduledReportInputSchema)
    .mutation(async ({ input, ctx }) => {
      return ctx.analyticsService.updateScheduledReport(
        input,
        ctx.user.id,
        ctx.organizationId
      );
    }),

  deleteScheduledReport: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.analyticsService.deleteScheduledReport(
        input.id,
        ctx.organizationId
      );
      return { success: true };
    })
});
```

---

## Test Specification

### Unit Tests

```typescript
describe('AnalyticsService', () => {
  describe('getDashboard', () => {
    it('should return dashboard with summary metrics', async () => {
      const result = await service.getDashboard(
        { periodType: 'daily', periods: 30 },
        organizationId
      );

      expect(result.summary).toBeDefined();
      expect(result.summary.totalExecutions).toBeGreaterThanOrEqual(0);
      expect(result.summary.successRate).toBeDefined();
    });

    it('should include period comparison data', async () => {
      const result = await service.getDashboard(
        { periodType: 'daily', periods: 30 },
        organizationId
      );

      expect(result.summary.comparison).toBeDefined();
      expect(result.summary.comparison.executionsChange).toBeDefined();
    });
  });

  describe('getTrends', () => {
    it('should return trend data for specified metric', async () => {
      const result = await service.getTrends(
        {
          metric: 'success_rate',
          periodType: 'daily',
          startDate: subDays(new Date(), 30),
          endDate: new Date()
        },
        organizationId
      );

      expect(result.metric).toBe('success_rate');
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should include previous period when requested', async () => {
      const result = await service.getTrends(
        {
          metric: 'execution_count',
          periodType: 'daily',
          startDate: subDays(new Date(), 30),
          endDate: new Date(),
          compareWithPrevious: true
        },
        organizationId
      );

      expect(result.previousPeriod).toBeDefined();
    });
  });

  describe('getCostAnalysis', () => {
    it('should return cost breakdown', async () => {
      const result = await service.getCostAnalysis(
        {
          periodType: 'monthly',
          startDate: subMonths(new Date(), 3),
          endDate: new Date()
        },
        organizationId
      );

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.totalCostPln).toBeGreaterThanOrEqual(0);
    });

    it('should return costs in PLN', async () => {
      const result = await service.getCostAnalysis(
        {
          periodType: 'monthly',
          startDate: subMonths(new Date(), 1),
          endDate: new Date()
        },
        organizationId
      );

      expect(result.breakdown.computeCostPln).toBeDefined();
      expect(result.breakdown.apiCostPln).toBeDefined();
    });
  });

  describe('getOptimizationSuggestions', () => {
    it('should return suggestions ordered by priority', async () => {
      const result = await service.getOptimizationSuggestions(
        { minConfidence: 0.5 },
        organizationId
      );

      expect(result).toBeDefined();
      if (result.length > 1) {
        expect(
          ['critical', 'high', 'medium', 'low'].indexOf(result[0].priority)
        ).toBeLessThanOrEqual(
          ['critical', 'high', 'medium', 'low'].indexOf(result[1].priority)
        );
      }
    });

    it('should filter by category', async () => {
      const result = await service.getOptimizationSuggestions(
        { category: 'performance' },
        organizationId
      );

      expect(result.every(s => s.category === 'performance')).toBe(true);
    });
  });

  describe('exportReport', () => {
    it('should generate PDF report', async () => {
      const result = await service.exportReport(
        {
          periodType: 'monthly',
          startDate: subMonths(new Date(), 1),
          endDate: new Date(),
          format: 'pdf',
          sections: ['executive_summary', 'execution_metrics'],
          language: 'pl'
        },
        userId,
        organizationId
      );

      expect(result.mimeType).toBe('application/pdf');
      expect(result.file).toBeInstanceOf(Buffer);
    });

    it('should generate Excel report', async () => {
      const result = await service.exportReport(
        {
          periodType: 'monthly',
          startDate: subMonths(new Date(), 1),
          endDate: new Date(),
          format: 'excel',
          sections: ['detailed_data']
        },
        userId,
        organizationId
      );

      expect(result.mimeType).toContain('spreadsheetml');
    });
  });

  describe('createScheduledReport', () => {
    it('should create scheduled report with correct next delivery', async () => {
      const result = await service.createScheduledReport(
        {
          name: 'Weekly Report',
          frequency: 'weekly',
          deliveryTime: '08:00',
          timezone: 'Europe/Warsaw',
          format: 'pdf',
          sections: ['executive_summary'],
          recipients: ['test@example.com']
        },
        userId,
        organizationId
      );

      expect(result.name).toBe('Weekly Report');
      expect(result.nextDeliveryAt).toBeDefined();
      expect(result.isActive).toBe(true);
    });
  });
});
```

### Integration Tests

```typescript
describe('Analytics Integration', () => {
  describe('Analytics Aggregation', () => {
    it('should aggregate hourly analytics correctly', async () => {
      // Create test executions
      await createTestExecutions(workflowId, 10);

      // Trigger aggregation
      await service.aggregateAnalytics('hourly');

      // Verify aggregation
      const analytics = await prisma.workflowAnalytics.findFirst({
        where: {
          workflowId,
          periodType: 'hourly'
        }
      });

      expect(analytics).toBeDefined();
      expect(analytics.totalExecutions).toBe(10);
    });
  });

  describe('Scheduled Report Delivery', () => {
    it('should deliver scheduled report on time', async () => {
      const report = await service.createScheduledReport(
        {
          name: 'Test Report',
          frequency: 'daily',
          deliveryTime: '00:00',
          format: 'pdf',
          sections: ['executive_summary'],
          recipients: ['test@example.com']
        },
        userId,
        organizationId
      );

      // Set next delivery to now
      await prisma.scheduledReport.update({
        where: { id: report.id },
        data: { nextDeliveryAt: new Date() }
      });

      // Process scheduled reports
      await service.processScheduledReports();

      // Check delivery was created
      const delivery = await prisma.reportDelivery.findFirst({
        where: { scheduledReportId: report.id }
      });

      expect(delivery).toBeDefined();
      expect(delivery.status).toBe('delivered');
    });
  });
});
```

---

## Security Checklist

- [x] Row Level Security on all analytics tables
- [x] Organization isolation for all queries
- [x] Input validation with Zod schemas
- [x] Audit logging for report exports
- [x] Secure file storage for generated reports
- [x] Email recipient validation
- [x] Rate limiting on report generation
- [x] Data anonymization options for shared reports

---

## Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `REPORT_EXPORTED` | Manual report export | format, sections, period |
| `SCHEDULED_REPORT_CREATED` | Schedule created | reportId, frequency, recipients |
| `SCHEDULED_REPORT_DELIVERED` | Report delivered | reportId, deliveryId, recipients |
| `SUGGESTION_GENERATED` | AI suggestions created | workflowId, count |
| `SUGGESTION_APPLIED` | Suggestion implemented | suggestionId, changes |
| `SUGGESTION_DISMISSED` | Suggestion rejected | suggestionId, reason |

---

## Implementation Notes

### Cost Calculation

Costs are calculated in Polish grosze (1 PLN = 100 groszy) for precision:

1. **Compute Cost**: Based on execution duration and resource usage
2. **API Cost**: Based on external API calls (varies by service)
3. **Storage Cost**: Based on data processed and stored
4. **External Service Cost**: Third-party service charges

### Report Sections

1. **Executive Summary (Podsumowanie wykonawcze)**
   - Key metrics overview
   - Period comparison
   - Top performers/issues

2. **Execution Metrics (Metryki wykonania)**
   - Total executions by status
   - Success/failure rates
   - Duration statistics

3. **Success Trends (Trendy sukcesu)**
   - Time-series charts
   - Period comparisons
   - Anomaly detection

4. **Failure Analysis (Analiza błędów)**
   - Error distribution
   - Most common failures
   - Recovery statistics

5. **Processing Times (Czasy przetwarzania)**
   - Duration breakdown
   - Bottleneck identification
   - Queue analysis

6. **Resource Usage (Wykorzystanie zasobów)**
   - CPU/Memory metrics
   - API call statistics
   - Queue metrics

7. **Cost Analysis (Analiza kosztów)**
   - Cost breakdown by type
   - Cost by workflow
   - Budget utilization

8. **Optimization Suggestions (Sugestie optymalizacji)**
   - AI-powered recommendations
   - Priority ordering
   - Implementation guides

### AI Optimization Categories

1. **Performance**: Step parallelization, caching, query optimization
2. **Cost**: Batch operations, API call reduction, resource optimization
3. **Reliability**: Error handling, retry strategies, monitoring
4. **Efficiency**: Dead code removal, condition optimization
5. **Security**: Access control, data handling, audit compliance

---

*Last Updated: December 2024*
