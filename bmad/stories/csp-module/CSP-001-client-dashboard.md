# CSP-001: Client Dashboard

## Story Overview

| Field | Value |
|-------|-------|
| Story ID | CSP-001 |
| Epic | Client Self-Service Portal |
| Priority | P0 |
| Story Points | 8 |
| Status | Draft |
| Dependencies | AIM (Authentication), CRM (Client Data) |

## User Story

**As a** business owner or financial manager,
**I want to** see a comprehensive dashboard with my financial KPIs, charts, and upcoming deadlines,
**So that** I can monitor my business health at a glance without contacting my accountant.

## Acceptance Criteria

### AC1: Dashboard Overview
```gherkin
Feature: Client Dashboard Overview

  Scenario: View dashboard with KPIs
    Given I am logged into the client portal
    When I navigate to the dashboard
    Then I should see the following KPIs:
      | KPI | Description |
      | Total Revenue | Year-to-date revenue |
      | Total Expenses | Year-to-date expenses |
      | Net Profit | Revenue minus expenses |
      | Profit Margin | Net profit percentage |
      | Outstanding Invoices | Unpaid invoice amount |
      | Cash Balance | Current bank balance |
    And each KPI should show comparison to previous period
    And each KPI should indicate trend direction (up/down/stable)
```

### AC2: Revenue Chart
```gherkin
Feature: Revenue Visualization

  Scenario: View revenue trend chart
    Given I am on the client dashboard
    When I view the revenue chart
    Then I should see monthly revenue for the current year
    And I can toggle between chart types (line, bar)
    And I can compare with previous year
    And I can hover for detailed values

  Scenario: Filter revenue by date range
    Given I am viewing the revenue chart
    When I select a custom date range
    Then the chart should update to show selected period
    And the KPIs should recalculate for the period
```

### AC3: Expense Breakdown
```gherkin
Feature: Expense Analysis

  Scenario: View expense categories
    Given I am on the client dashboard
    When I view the expense breakdown
    Then I should see a pie/donut chart with expense categories
    And I can click a category to see detailed breakdown
    And I should see percentage of total for each category

  Scenario: Expense category drill-down
    Given I am viewing the expense breakdown
    When I click on a category
    Then I should see a list of transactions in that category
    And I can export the list to Excel/CSV
```

### AC4: Tax Calendar
```gherkin
Feature: Tax Calendar Widget

  Scenario: View upcoming tax deadlines
    Given I am on the client dashboard
    When I view the tax calendar
    Then I should see upcoming tax deadlines for the next 90 days
    And deadlines should be color-coded by urgency:
      | Days Until | Color |
      | 0-7 | Red (urgent) |
      | 8-30 | Orange (upcoming) |
      | 31-90 | Green (future) |
    And I should see Polish tax deadlines:
      | Deadline | Description |
      | 25th monthly | VAT-7 declaration |
      | 20th monthly | ZUS contributions |
      | 20th monthly | PIT-4R advances |
      | 31st January | PIT-11 distribution |
      | 31st March | CIT-8 annual |
```

### AC5: Recent Activity Feed
```gherkin
Feature: Activity Feed

  Scenario: View recent portal activity
    Given I am on the client dashboard
    When I view the activity feed
    Then I should see the last 10 activities
    And activities should include:
      | Type | Description |
      | Document uploads | Files you uploaded |
      | Document downloads | Files you downloaded |
      | Report views | Reports you accessed |
      | Messages | Messages sent/received |
    And I can click "View All" to see full activity history
```

### AC6: Pending Tasks Widget
```gherkin
Feature: Pending Tasks

  Scenario: View pending tasks
    Given I am on the client dashboard
    When I view the pending tasks widget
    Then I should see tasks assigned to me by the accountant
    And each task should show:
      | Field | Example |
      | Title | Submit VAT invoices |
      | Due Date | 2024-01-25 |
      | Priority | High |
      | Status | Pending |
    And I can mark tasks as completed
    And I can click to upload required documents
```

### AC7: Dashboard Caching & Performance
```gherkin
Feature: Dashboard Performance

  Scenario: Dashboard loads within performance budget
    Given I navigate to the dashboard
    Then the page should load within 2 seconds
    And the initial data should be fetched in parallel
    And dashboard data should be cached for 5 minutes
    And a refresh button should allow manual data refresh
```

## Technical Specification

### Database Schema

```sql
-- Dashboard preferences per client
CREATE TABLE portal_dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  default_date_range VARCHAR(20) DEFAULT 'YTD', -- YTD, MTD, LAST_12_MONTHS, CUSTOM
  visible_widgets JSONB DEFAULT '["kpis", "revenue", "expenses", "calendar", "activity", "tasks"]',
  chart_type VARCHAR(20) DEFAULT 'LINE',
  compare_previous_year BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, client_id)
);

-- Materialized KPI snapshots for performance
CREATE TABLE portal_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  snapshot_date DATE NOT NULL,
  total_revenue DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_expenses DECIMAL(15,2) NOT NULL DEFAULT 0,
  net_profit DECIMAL(15,2) NOT NULL DEFAULT 0,
  profit_margin DECIMAL(5,2),
  outstanding_invoices DECIMAL(15,2) NOT NULL DEFAULT 0,
  outstanding_invoices_count INTEGER DEFAULT 0,
  cash_balance DECIMAL(15,2),
  previous_revenue DECIMAL(15,2),
  previous_expenses DECIMAL(15,2),
  previous_profit DECIMAL(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, client_id, snapshot_date)
);

-- Task assignments from accountant to client
CREATE TABLE portal_client_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  assigned_by UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(20) DEFAULT 'NORMAL', -- LOW, NORMAL, HIGH, URGENT
  due_date DATE,
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, CANCELLED
  document_category VARCHAR(50), -- Category for uploaded documents
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_dashboard_prefs_client ON portal_dashboard_preferences(tenant_id, client_id);
CREATE INDEX idx_kpi_snapshots_client_date ON portal_kpi_snapshots(tenant_id, client_id, snapshot_date DESC);
CREATE INDEX idx_client_tasks_status ON portal_client_tasks(tenant_id, client_id, status) WHERE status = 'PENDING';
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Date range options
export const dateRangeTypeSchema = z.enum([
  'YTD',
  'MTD',
  'LAST_7_DAYS',
  'LAST_30_DAYS',
  'LAST_90_DAYS',
  'LAST_12_MONTHS',
  'CUSTOM'
]);

// Custom date range
export const customDateRangeSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
}).refine(
  (data) => data.end >= data.start,
  { message: 'End date must be after start date' }
);

// Dashboard request
export const getDashboardInputSchema = z.object({
  dateRangeType: dateRangeTypeSchema.default('YTD'),
  customRange: customDateRangeSchema.optional(),
  compareWithPrevious: z.boolean().default(true),
});

// KPI data
export const kpiDataSchema = z.object({
  type: z.string(),
  label: z.string(),
  value: z.number(),
  formattedValue: z.string(),
  previousValue: z.number().nullable(),
  trend: z.enum(['UP', 'DOWN', 'STABLE']),
  trendPercentage: z.number().nullable(),
  comparisonPeriod: z.string().nullable(),
});

// Revenue data point
export const revenueDataPointSchema = z.object({
  period: z.string(),
  date: z.coerce.date(),
  revenue: z.number(),
  previousRevenue: z.number().nullable(),
});

// Expense category
export const expenseCategorySchema = z.object({
  category: z.string(),
  categoryLabel: z.string(),
  amount: z.number(),
  percentage: z.number(),
  transactionCount: z.number(),
});

// Tax deadline
export const taxDeadlineSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  description: z.string(),
  dueDate: z.coerce.date(),
  urgency: z.enum(['URGENT', 'UPCOMING', 'FUTURE']),
  completed: z.boolean(),
});

// Activity item
export const activityItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['DOCUMENT_UPLOAD', 'DOCUMENT_DOWNLOAD', 'REPORT_VIEW', 'MESSAGE_SENT', 'MESSAGE_RECEIVED', 'TASK_COMPLETED']),
  title: z.string(),
  description: z.string().nullable(),
  entityId: z.string().uuid().nullable(),
  timestamp: z.coerce.date(),
  metadata: z.record(z.any()).optional(),
});

// Client task
export const clientTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  dueDate: z.coerce.date().nullable(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  documentCategory: z.string().nullable(),
  assignedBy: z.string(),
  createdAt: z.coerce.date(),
});

// Full dashboard response
export const dashboardDataSchema = z.object({
  clientId: z.string().uuid(),
  companyName: z.string(),
  lastUpdated: z.coerce.date(),
  dateRange: z.object({
    start: z.coerce.date(),
    end: z.coerce.date(),
    type: dateRangeTypeSchema,
  }),
  kpis: z.array(kpiDataSchema),
  revenueData: z.array(revenueDataPointSchema),
  expenseBreakdown: z.array(expenseCategorySchema),
  taxCalendar: z.array(taxDeadlineSchema),
  recentActivity: z.array(activityItemSchema),
  pendingTasks: z.array(clientTaskSchema),
  notificationCount: z.number(),
});

// Update task status
export const updateTaskStatusInputSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED']),
});

// Dashboard preferences update
export const updateDashboardPreferencesSchema = z.object({
  defaultDateRange: dateRangeTypeSchema.optional(),
  visibleWidgets: z.array(z.string()).optional(),
  chartType: z.enum(['LINE', 'BAR']).optional(),
  comparePreviousYear: z.boolean().optional(),
});

export type DashboardData = z.infer<typeof dashboardDataSchema>;
export type KPIData = z.infer<typeof kpiDataSchema>;
export type ClientTask = z.infer<typeof clientTaskSchema>;
```

### Service Implementation

```typescript
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@/database/drizzle.provider';
import { DrizzleDB } from '@/database/drizzle.types';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import {
  portalDashboardPreferences,
  portalKpiSnapshots,
  portalClientTasks,
  portalActivityLog,
  clients,
  invoices,
  journalEntries,
  taxDeclarations,
} from '@/database/schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectDrizzle() private db: DrizzleDB,
    private redis: Redis,
    private auditService: AuditService,
  ) {}

  async getDashboard(
    tenantId: string,
    clientId: string,
    options: {
      dateRangeType: string;
      customRange?: { start: Date; end: Date };
      compareWithPrevious: boolean;
    }
  ): Promise<DashboardData> {
    const correlationId = uuidv4();
    const cacheKey = `portal:${tenantId}:${clientId}:dashboard:${options.dateRangeType}`;

    // Check cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Resolve date range
    const dateRange = this.resolveDateRange(options.dateRangeType, options.customRange);

    // Fetch all data in parallel
    const [
      clientProfile,
      kpis,
      revenueData,
      expenseBreakdown,
      taxCalendar,
      recentActivity,
      pendingTasks,
      notificationCount,
    ] = await Promise.all([
      this.getClientProfile(tenantId, clientId),
      this.getKPIs(tenantId, clientId, dateRange, options.compareWithPrevious),
      this.getRevenueData(tenantId, clientId, dateRange, options.compareWithPrevious),
      this.getExpenseBreakdown(tenantId, clientId, dateRange),
      this.getTaxCalendar(tenantId, clientId),
      this.getRecentActivity(tenantId, clientId, 10),
      this.getPendingTasks(tenantId, clientId),
      this.getNotificationCount(tenantId, clientId),
    ]);

    const dashboard: DashboardData = {
      clientId,
      companyName: clientProfile.companyName,
      lastUpdated: new Date(),
      dateRange: {
        start: dateRange.start,
        end: dateRange.end,
        type: options.dateRangeType as any,
      },
      kpis,
      revenueData,
      expenseBreakdown,
      taxCalendar,
      recentActivity,
      pendingTasks,
      notificationCount,
    };

    // Cache for 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(dashboard));

    // Log access
    await this.auditService.log({
      tenantId,
      clientId,
      action: 'DASHBOARD_VIEW',
      correlationId,
      metadata: { dateRange: options.dateRangeType },
    });

    return dashboard;
  }

  private async getKPIs(
    tenantId: string,
    clientId: string,
    dateRange: { start: Date; end: Date },
    compareWithPrevious: boolean
  ): Promise<KPIData[]> {
    // Calculate current period values
    const currentPeriod = await this.db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0)`,
        totalExpenses: sql<number>`COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0)`,
      })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.tenantId, tenantId),
          eq(journalEntries.clientId, clientId),
          gte(journalEntries.entryDate, dateRange.start),
          lte(journalEntries.entryDate, dateRange.end)
        )
      );

    // Get outstanding invoices
    const outstandingInvoices = await this.db
      .select({
        amount: sql<number>`COALESCE(SUM(total_amount - paid_amount), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          eq(invoices.clientId, clientId),
          eq(invoices.status, 'OUTSTANDING')
        )
      );

    // Calculate previous period for comparison
    let previousPeriod = null;
    if (compareWithPrevious) {
      const periodLength = dateRange.end.getTime() - dateRange.start.getTime();
      const previousStart = new Date(dateRange.start.getTime() - periodLength);
      const previousEnd = new Date(dateRange.start.getTime() - 1);

      previousPeriod = await this.db
        .select({
          totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0)`,
          totalExpenses: sql<number>`COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0)`,
        })
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.tenantId, tenantId),
            eq(journalEntries.clientId, clientId),
            gte(journalEntries.entryDate, previousStart),
            lte(journalEntries.entryDate, previousEnd)
          )
        );
    }

    const revenue = currentPeriod[0]?.totalRevenue || 0;
    const expenses = currentPeriod[0]?.totalExpenses || 0;
    const netProfit = revenue - expenses;
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    const previousRevenue = previousPeriod?.[0]?.totalRevenue || 0;
    const previousExpenses = previousPeriod?.[0]?.totalExpenses || 0;
    const previousProfit = previousRevenue - previousExpenses;

    return [
      this.buildKPI('TOTAL_REVENUE', 'Przychody', revenue, previousRevenue, 'PLN'),
      this.buildKPI('TOTAL_EXPENSES', 'Koszty', expenses, previousExpenses, 'PLN'),
      this.buildKPI('NET_PROFIT', 'Zysk netto', netProfit, previousProfit, 'PLN'),
      this.buildKPI('PROFIT_MARGIN', 'Marża zysku', profitMargin, null, '%'),
      this.buildKPI(
        'OUTSTANDING_INVOICES',
        'Zaległe faktury',
        outstandingInvoices[0]?.amount || 0,
        null,
        'PLN',
        outstandingInvoices[0]?.count || 0
      ),
    ];
  }

  private buildKPI(
    type: string,
    label: string,
    value: number,
    previousValue: number | null,
    unit: string,
    count?: number
  ): KPIData {
    let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
    let trendPercentage: number | null = null;

    if (previousValue !== null && previousValue > 0) {
      const change = ((value - previousValue) / previousValue) * 100;
      trendPercentage = Math.round(change * 100) / 100;
      if (change > 1) trend = 'UP';
      else if (change < -1) trend = 'DOWN';
    }

    return {
      type,
      label,
      value,
      formattedValue: this.formatValue(value, unit, count),
      previousValue,
      trend,
      trendPercentage,
      comparisonPeriod: previousValue !== null ? 'poprzedni okres' : null,
    };
  }

  private formatValue(value: number, unit: string, count?: number): string {
    if (unit === 'PLN') {
      const formatted = new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: 'PLN',
        minimumFractionDigits: 2,
      }).format(value);
      return count ? `${formatted} (${count} faktur)` : formatted;
    }
    if (unit === '%') {
      return `${value.toFixed(1)}%`;
    }
    return value.toString();
  }

  private async getTaxCalendar(
    tenantId: string,
    clientId: string
  ): Promise<TaxDeadline[]> {
    const today = new Date();
    const ninetyDaysLater = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Polish tax calendar deadlines
    const polishDeadlines = this.generatePolishTaxDeadlines(today, ninetyDaysLater);

    // Get client-specific pending declarations
    const pendingDeclarations = await this.db
      .select()
      .from(taxDeclarations)
      .where(
        and(
          eq(taxDeclarations.tenantId, tenantId),
          eq(taxDeclarations.clientId, clientId),
          eq(taxDeclarations.status, 'PENDING'),
          gte(taxDeclarations.dueDate, today),
          lte(taxDeclarations.dueDate, ninetyDaysLater)
        )
      )
      .orderBy(taxDeclarations.dueDate);

    const allDeadlines = [
      ...polishDeadlines,
      ...pendingDeclarations.map((d) => ({
        id: d.id,
        type: d.declarationType,
        title: this.getDeclarationTitle(d.declarationType),
        description: `${d.declarationType} za ${d.period}`,
        dueDate: d.dueDate,
        urgency: this.calculateUrgency(d.dueDate),
        completed: false,
      })),
    ];

    return allDeadlines
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 10);
  }

  private generatePolishTaxDeadlines(start: Date, end: Date): TaxDeadline[] {
    const deadlines: TaxDeadline[] = [];
    const current = new Date(start);

    while (current <= end) {
      const year = current.getFullYear();
      const month = current.getMonth();

      // VAT-7 - 25th of each month
      const vat7Date = new Date(year, month, 25);
      if (vat7Date >= start && vat7Date <= end) {
        deadlines.push({
          id: `vat7-${year}-${month}`,
          type: 'VAT-7',
          title: 'VAT-7 Deklaracja',
          description: `Deklaracja VAT za ${this.getPolishMonth(month === 0 ? 11 : month - 1)}`,
          dueDate: vat7Date,
          urgency: this.calculateUrgency(vat7Date),
          completed: false,
        });
      }

      // ZUS - 20th of each month
      const zusDate = new Date(year, month, 20);
      if (zusDate >= start && zusDate <= end) {
        deadlines.push({
          id: `zus-${year}-${month}`,
          type: 'ZUS',
          title: 'Składki ZUS',
          description: `Składki ZUS za ${this.getPolishMonth(month === 0 ? 11 : month - 1)}`,
          dueDate: zusDate,
          urgency: this.calculateUrgency(zusDate),
          completed: false,
        });
      }

      // PIT-4R advances - 20th of each month
      const pit4rDate = new Date(year, month, 20);
      if (pit4rDate >= start && pit4rDate <= end) {
        deadlines.push({
          id: `pit4r-${year}-${month}`,
          type: 'PIT-4R',
          title: 'Zaliczka PIT-4R',
          description: `Zaliczka na podatek za ${this.getPolishMonth(month === 0 ? 11 : month - 1)}`,
          dueDate: pit4rDate,
          urgency: this.calculateUrgency(pit4rDate),
          completed: false,
        });
      }

      current.setMonth(current.getMonth() + 1);
    }

    return deadlines;
  }

  private calculateUrgency(dueDate: Date): 'URGENT' | 'UPCOMING' | 'FUTURE' {
    const today = new Date();
    const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

    if (daysUntil <= 7) return 'URGENT';
    if (daysUntil <= 30) return 'UPCOMING';
    return 'FUTURE';
  }

  private getPolishMonth(month: number): string {
    const months = [
      'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
      'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
    ];
    return months[month];
  }

  async updateTaskStatus(
    tenantId: string,
    clientId: string,
    taskId: string,
    status: 'IN_PROGRESS' | 'COMPLETED'
  ): Promise<ClientTask> {
    const [updated] = await this.db
      .update(portalClientTasks)
      .set({
        status,
        completedAt: status === 'COMPLETED' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(portalClientTasks.id, taskId),
          eq(portalClientTasks.tenantId, tenantId),
          eq(portalClientTasks.clientId, clientId)
        )
      )
      .returning();

    // Invalidate cache
    await this.redis.del(`portal:${tenantId}:${clientId}:dashboard:*`);

    // Log activity
    await this.auditService.log({
      tenantId,
      clientId,
      action: 'TASK_STATUS_UPDATED',
      entityId: taskId,
      metadata: { status },
    });

    return this.mapTaskToDTO(updated);
  }

  async refreshDashboard(tenantId: string, clientId: string): Promise<void> {
    // Invalidate all dashboard cache entries
    const keys = await this.redis.keys(`portal:${tenantId}:${clientId}:dashboard:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private resolveDateRange(
    type: string,
    customRange?: { start: Date; end: Date }
  ): { start: Date; end: Date } {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    switch (type) {
      case 'YTD':
        return { start: new Date(year, 0, 1), end: today };
      case 'MTD':
        return { start: new Date(year, month, 1), end: today };
      case 'LAST_7_DAYS':
        return { start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), end: today };
      case 'LAST_30_DAYS':
        return { start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), end: today };
      case 'LAST_90_DAYS':
        return { start: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000), end: today };
      case 'LAST_12_MONTHS':
        return { start: new Date(year - 1, month, 1), end: today };
      case 'CUSTOM':
        if (!customRange) throw new Error('Custom range required');
        return customRange;
      default:
        return { start: new Date(year, 0, 1), end: today };
    }
  }
}
```

### tRPC Router

```typescript
import { router, clientProcedure } from '../trpc';
import {
  getDashboardInputSchema,
  updateTaskStatusInputSchema,
  updateDashboardPreferencesSchema,
} from './dashboard.schemas';

export const dashboardRouter = router({
  // Get dashboard data
  getDashboard: clientProcedure
    .input(getDashboardInputSchema)
    .query(async ({ ctx, input }) => {
      return ctx.dashboardService.getDashboard(
        ctx.tenantId,
        ctx.clientId,
        {
          dateRangeType: input.dateRangeType,
          customRange: input.customRange,
          compareWithPrevious: input.compareWithPrevious,
        }
      );
    }),

  // Refresh dashboard data
  refresh: clientProcedure
    .mutation(async ({ ctx }) => {
      await ctx.dashboardService.refreshDashboard(ctx.tenantId, ctx.clientId);
      return { success: true };
    }),

  // Update task status
  updateTaskStatus: clientProcedure
    .input(updateTaskStatusInputSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.dashboardService.updateTaskStatus(
        ctx.tenantId,
        ctx.clientId,
        input.taskId,
        input.status
      );
    }),

  // Get/update dashboard preferences
  getPreferences: clientProcedure
    .query(async ({ ctx }) => {
      return ctx.dashboardService.getPreferences(ctx.tenantId, ctx.clientId);
    }),

  updatePreferences: clientProcedure
    .input(updateDashboardPreferencesSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.dashboardService.updatePreferences(
        ctx.tenantId,
        ctx.clientId,
        input
      );
    }),

  // Get expense details for drill-down
  getExpenseDetails: clientProcedure
    .input(z.object({
      category: z.string(),
      dateRangeType: dateRangeTypeSchema,
      customRange: customDateRangeSchema.optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.dashboardService.getExpenseDetails(
        ctx.tenantId,
        ctx.clientId,
        input.category,
        input.dateRangeType,
        input.customRange
      );
    }),
});
```

## Test Specifications

### Unit Tests

```typescript
describe('DashboardService', () => {
  let service: DashboardService;
  let mockDb: jest.Mocked<DrizzleDB>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockRedis = createMockRedis();
    service = new DashboardService(mockDb, mockRedis, mockAuditService);
  });

  describe('getDashboard', () => {
    it('should return cached data if available', async () => {
      const cachedData = { clientId: 'test', kpis: [] };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.getDashboard('tenant-1', 'client-1', {
        dateRangeType: 'YTD',
        compareWithPrevious: true,
      });

      expect(result).toEqual(cachedData);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should fetch fresh data on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDb.select.mockResolvedValue([{ totalRevenue: 100000, totalExpenses: 50000 }]);

      const result = await service.getDashboard('tenant-1', 'client-1', {
        dateRangeType: 'YTD',
        compareWithPrevious: true,
      });

      expect(result.kpis).toBeDefined();
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should calculate KPI trends correctly', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDb.select
        .mockResolvedValueOnce([{ totalRevenue: 100000, totalExpenses: 50000 }])
        .mockResolvedValueOnce([{ totalRevenue: 80000, totalExpenses: 40000 }]);

      const result = await service.getDashboard('tenant-1', 'client-1', {
        dateRangeType: 'YTD',
        compareWithPrevious: true,
      });

      const revenueKpi = result.kpis.find(k => k.type === 'TOTAL_REVENUE');
      expect(revenueKpi?.trend).toBe('UP');
      expect(revenueKpi?.trendPercentage).toBeCloseTo(25);
    });
  });

  describe('getTaxCalendar', () => {
    it('should generate Polish tax deadlines', async () => {
      const result = await service.getTaxCalendar('tenant-1', 'client-1');

      expect(result).toContainEqual(
        expect.objectContaining({ type: 'VAT-7' })
      );
      expect(result).toContainEqual(
        expect.objectContaining({ type: 'ZUS' })
      );
    });

    it('should calculate urgency correctly', async () => {
      const urgentDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      expect(service['calculateUrgency'](urgentDeadline)).toBe('URGENT');

      const upcomingDeadline = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      expect(service['calculateUrgency'](upcomingDeadline)).toBe('UPCOMING');

      const futureDeadline = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      expect(service['calculateUrgency'](futureDeadline)).toBe('FUTURE');
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task and invalidate cache', async () => {
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{ id: 'task-1', status: 'COMPLETED' }]),
          }),
        }),
      });

      await service.updateTaskStatus('tenant-1', 'client-1', 'task-1', 'COMPLETED');

      expect(mockRedis.del).toHaveBeenCalled();
    });
  });
});
```

### Integration Tests

```typescript
describe('Dashboard API Integration', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    authToken = await loginAsPortalClient(app);
  });

  describe('GET /portal/dashboard', () => {
    it('should return dashboard data', async () => {
      const response = await request(app.getHttpServer())
        .get('/portal/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ dateRangeType: 'YTD' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('kpis');
      expect(response.body).toHaveProperty('revenueData');
      expect(response.body).toHaveProperty('taxCalendar');
    });

    it('should respect custom date range', async () => {
      const response = await request(app.getHttpServer())
        .get('/portal/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          dateRangeType: 'CUSTOM',
          'customRange[start]': '2024-01-01',
          'customRange[end]': '2024-06-30',
        });

      expect(response.status).toBe(200);
      expect(response.body.dateRange.type).toBe('CUSTOM');
    });
  });

  describe('POST /portal/dashboard/tasks/:id/status', () => {
    it('should update task status', async () => {
      const response = await request(app.getHttpServer())
        .post('/portal/dashboard/tasks/task-123/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'COMPLETED' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('COMPLETED');
    });
  });
});
```

## Security Checklist

- [ ] Portal authentication required for all endpoints
- [ ] Client can only access own dashboard data (tenant + client isolation)
- [ ] RLS policies enforce data boundaries
- [ ] Task updates limited to own assigned tasks
- [ ] Cache keys include tenant and client IDs
- [ ] Audit logging for dashboard access
- [ ] Rate limiting on refresh endpoint
- [ ] No sensitive data in error messages

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| DASHBOARD_VIEW | Dashboard loaded | dateRange, clientId |
| TASK_STATUS_UPDATED | Task completed | taskId, newStatus |
| PREFERENCES_UPDATED | Settings changed | changedFields |
| EXPENSE_DRILLDOWN | Category clicked | category, dateRange |
| REPORT_EXPORTED | Export requested | exportType, dateRange |

## Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dashboard Load Time | < 2s | Time to first meaningful paint |
| Data Fetch (cached) | < 100ms | API response time |
| Data Fetch (fresh) | < 1.5s | API response time |
| Chart Render | < 500ms | Time to interactive |
| Cache Hit Rate | > 80% | Redis statistics |

## Implementation Notes

1. **Parallel Data Fetching**: All dashboard sections loaded via Promise.all
2. **Materialized KPIs**: Consider daily snapshot jobs for complex calculations
3. **Polish Localization**: All labels, month names, currency formatting in Polish
4. **Tax Calendar**: Hardcoded Polish tax deadlines + dynamic client-specific ones
5. **Responsive Charts**: Use Chart.js or Recharts with responsive container
6. **Error Boundaries**: Isolate widget failures to prevent full dashboard crash
