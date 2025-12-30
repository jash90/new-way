# HRP-011: HR Analytics & Reporting

> **Story ID**: HRP-011
> **Epic**: [HR & Payroll Module](./epic.md)
> **Priority**: P2 (Important)
> **Points**: 5
> **Status**: 📋 Ready for Development
> **Phase**: Week 28

---

## User Story

**As an** HR manager,
**I want** analytics and reports on HR metrics,
**So that** I can make data-driven decisions about workforce management and planning.

---

## Acceptance Criteria

### AC1: Headcount Analytics Dashboard
```gherkin
Given I am an HR manager viewing the analytics dashboard
When I access the headcount section
Then I see current total headcount
And I see headcount broken down by:
  - Department
  - Location
  - Contract type
  - Employment status
And I see historical headcount trends
And I can select different time periods for comparison
```

### AC2: Turnover Rate Analysis
```gherkin
Given I am analyzing workforce turnover
When I view turnover reports
Then I see overall turnover rate (monthly/quarterly/annual)
And I see voluntary vs involuntary turnover breakdown
And I see turnover by department and position
And I see average tenure before departure
And I see common termination reasons
And the turnover rate is calculated as:
  | Formula | (Separations / Average Headcount) × 100 |
```

### AC3: Leave Utilization Reports
```gherkin
Given I need to analyze leave patterns
When I access leave utilization reports
Then I see average leave days taken per employee
And I see leave type breakdown (annual, sick, parental)
And I see departments with highest/lowest utilization
And I see outstanding leave balances at risk of expiry
And I see seasonal patterns in leave requests
And I see sick leave trends for health monitoring
```

### AC4: Payroll Cost Analysis
```gherkin
Given I need to understand labor costs
When I view payroll cost reports
Then I see total payroll cost by period
And I see cost breakdown:
  - Gross salaries
  - ZUS employer contributions
  - PPK employer contributions
  - Benefits costs
  - Overtime costs
And I see cost per employee (average)
And I see cost per department
And I see year-over-year cost comparison
And I see budget vs actual analysis
```

### AC5: Custom Report Builder
```gherkin
Given I need a custom report
When I use the report builder
Then I can select from available data fields:
  - Employee demographics
  - Contract information
  - Payroll data
  - Leave data
  - Time tracking data
And I can apply filters and groupings
And I can define calculated fields
And I can save report templates for reuse
And I can schedule automatic report generation
```

### AC6: Export Capabilities
```gherkin
Given I have generated a report
When I want to export data
Then I can export to:
  - Excel (.xlsx)
  - CSV
  - PDF
And exported data respects my current filters
And sensitive data is appropriately masked
And export includes metadata (date, filters, user)
And large exports are processed asynchronously
```

---

## Technical Specification

### Database Schema

```sql
-- Analytics aggregation tables (materialized for performance)
CREATE TABLE hr_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  snapshot_date DATE NOT NULL,
  snapshot_type VARCHAR(50) NOT NULL, -- 'DAILY', 'WEEKLY', 'MONTHLY'

  -- Headcount metrics
  total_headcount INTEGER NOT NULL,
  active_employees INTEGER NOT NULL,
  on_leave_employees INTEGER NOT NULL,
  terminated_mtd INTEGER NOT NULL,
  hired_mtd INTEGER NOT NULL,

  -- Cost metrics
  total_gross_salary DECIMAL(15,2),
  total_employer_zus DECIMAL(15,2),
  total_employer_ppk DECIMAL(15,2),
  total_benefits_cost DECIMAL(15,2),
  total_overtime_cost DECIMAL(15,2),

  -- Computed at snapshot time
  avg_salary DECIMAL(15,2),
  avg_tenure_days INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, snapshot_date, snapshot_type)
);

CREATE INDEX idx_hr_snapshots_tenant_date ON hr_analytics_snapshots(tenant_id, snapshot_date DESC);
CREATE INDEX idx_hr_snapshots_type ON hr_analytics_snapshots(snapshot_type);

-- Department-level analytics
CREATE TABLE hr_department_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES hr_analytics_snapshots(id) ON DELETE CASCADE,
  department_id UUID NOT NULL,
  department_name VARCHAR(255) NOT NULL,

  headcount INTEGER NOT NULL,
  avg_salary DECIMAL(15,2),
  total_cost DECIMAL(15,2),
  avg_tenure_days INTEGER,
  turnover_rate DECIMAL(5,2),
  leave_utilization_rate DECIMAL(5,2),
  overtime_hours DECIMAL(10,2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dept_analytics_snapshot ON hr_department_analytics(snapshot_id);

-- Turnover tracking
CREATE TABLE hr_turnover_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),

  hire_date DATE NOT NULL,
  termination_date DATE NOT NULL,
  tenure_days INTEGER GENERATED ALWAYS AS (termination_date - hire_date) STORED,

  termination_type VARCHAR(50) NOT NULL, -- 'VOLUNTARY', 'INVOLUNTARY', 'END_OF_CONTRACT', 'RETIREMENT'
  termination_reason VARCHAR(255),
  department_at_termination VARCHAR(255),
  position_at_termination VARCHAR(255),
  salary_at_termination DECIMAL(15,2),

  exit_interview_completed BOOLEAN DEFAULT false,
  exit_interview_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_turnover_tenant_date ON hr_turnover_records(tenant_id, termination_date);
CREATE INDEX idx_turnover_type ON hr_turnover_records(termination_type);

-- Saved report configurations
CREATE TABLE hr_report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_by UUID NOT NULL REFERENCES users(id),

  name VARCHAR(255) NOT NULL,
  description TEXT,
  report_type VARCHAR(50) NOT NULL, -- 'HEADCOUNT', 'TURNOVER', 'LEAVE', 'PAYROLL', 'CUSTOM'

  -- Report configuration
  config JSONB NOT NULL,
  /* Example config:
  {
    "fields": ["employee_name", "department", "salary", "hire_date"],
    "filters": [
      {"field": "status", "operator": "eq", "value": "ACTIVE"}
    ],
    "groupBy": ["department"],
    "sortBy": [{"field": "salary", "direction": "DESC"}],
    "calculations": [
      {"name": "avg_salary", "function": "AVG", "field": "salary"}
    ],
    "dateRange": {"type": "LAST_12_MONTHS"}
  }
  */

  is_public BOOLEAN DEFAULT false, -- Shared with other HR managers

  -- Scheduling
  schedule_enabled BOOLEAN DEFAULT false,
  schedule_cron VARCHAR(100), -- Cron expression for scheduling
  schedule_recipients JSONB, -- Email addresses to send to
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_templates_tenant ON hr_report_templates(tenant_id);
CREATE INDEX idx_report_templates_schedule ON hr_report_templates(schedule_enabled, next_run_at) WHERE schedule_enabled = true;

-- Report generation history
CREATE TABLE hr_report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  template_id UUID REFERENCES hr_report_templates(id),
  executed_by UUID REFERENCES users(id),

  report_type VARCHAR(50) NOT NULL,
  config_snapshot JSONB NOT NULL, -- Config at time of execution

  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'

  -- Results
  row_count INTEGER,
  file_path VARCHAR(500),
  file_size_bytes INTEGER,
  export_format VARCHAR(20), -- 'XLSX', 'CSV', 'PDF'

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,

  -- Delivery
  delivered_to JSONB, -- Recipients if scheduled
  delivered_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_exec_tenant ON hr_report_executions(tenant_id, created_at DESC);
CREATE INDEX idx_report_exec_status ON hr_report_executions(status) WHERE status IN ('PENDING', 'PROCESSING');

-- Row Level Security
ALTER TABLE hr_analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_department_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_turnover_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_report_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_snapshots ON hr_analytics_snapshots
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_dept_analytics ON hr_department_analytics
  FOR ALL USING (snapshot_id IN (
    SELECT id FROM hr_analytics_snapshots WHERE tenant_id = current_setting('app.tenant_id')::uuid
  ));

CREATE POLICY tenant_isolation_turnover ON hr_turnover_records
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_templates ON hr_report_templates
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation_executions ON hr_report_executions
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Date range for reports
export const dateRangeSchema = z.object({
  type: z.enum([
    'LAST_7_DAYS',
    'LAST_30_DAYS',
    'LAST_90_DAYS',
    'LAST_12_MONTHS',
    'YEAR_TO_DATE',
    'CUSTOM'
  ]),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).refine(
  (data) => {
    if (data.type === 'CUSTOM') {
      return data.startDate && data.endDate;
    }
    return true;
  },
  { message: 'Custom date range requires start and end dates' }
);

// Filter operators
export const filterOperatorSchema = z.enum([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
  'in', 'nin', 'contains', 'startsWith', 'endsWith'
]);

// Report filter
export const reportFilterSchema = z.object({
  field: z.string().min(1),
  operator: filterOperatorSchema,
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.array(z.number())
  ]),
});

// Sort configuration
export const sortConfigSchema = z.object({
  field: z.string().min(1),
  direction: z.enum(['ASC', 'DESC']),
});

// Calculation definition
export const calculationSchema = z.object({
  name: z.string().min(1).max(50),
  function: z.enum(['SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'COUNT_DISTINCT']),
  field: z.string().min(1),
});

// Report configuration
export const reportConfigSchema = z.object({
  fields: z.array(z.string()).min(1),
  filters: z.array(reportFilterSchema).default([]),
  groupBy: z.array(z.string()).default([]),
  sortBy: z.array(sortConfigSchema).default([]),
  calculations: z.array(calculationSchema).default([]),
  dateRange: dateRangeSchema,
  limit: z.number().int().min(1).max(10000).default(1000),
});

// Create report template
export const createReportTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  reportType: z.enum(['HEADCOUNT', 'TURNOVER', 'LEAVE', 'PAYROLL', 'CUSTOM']),
  config: reportConfigSchema,
  isPublic: z.boolean().default(false),
  scheduleEnabled: z.boolean().default(false),
  scheduleCron: z.string().max(100).optional(),
  scheduleRecipients: z.array(z.string().email()).optional(),
}).refine(
  (data) => {
    if (data.scheduleEnabled) {
      return data.scheduleCron && data.scheduleRecipients?.length > 0;
    }
    return true;
  },
  { message: 'Scheduled reports require cron expression and recipients' }
);

// Execute report
export const executeReportSchema = z.object({
  templateId: z.string().uuid().optional(),
  config: reportConfigSchema.optional(),
  exportFormat: z.enum(['XLSX', 'CSV', 'PDF']).default('XLSX'),
}).refine(
  (data) => data.templateId || data.config,
  { message: 'Either templateId or config must be provided' }
);

// Headcount request
export const headcountRequestSchema = z.object({
  dateRange: dateRangeSchema,
  groupBy: z.enum(['DEPARTMENT', 'LOCATION', 'CONTRACT_TYPE', 'STATUS']).optional(),
  includeHistory: z.boolean().default(true),
});

// Turnover request
export const turnoverRequestSchema = z.object({
  dateRange: dateRangeSchema,
  groupBy: z.enum(['DEPARTMENT', 'POSITION', 'TERMINATION_TYPE', 'TENURE_BRACKET']).optional(),
  includeReasons: z.boolean().default(true),
});

// Leave utilization request
export const leaveUtilizationRequestSchema = z.object({
  dateRange: dateRangeSchema,
  groupBy: z.enum(['DEPARTMENT', 'LEAVE_TYPE', 'EMPLOYEE']).optional(),
  includeExpiring: z.boolean().default(true),
});

// Payroll cost request
export const payrollCostRequestSchema = z.object({
  dateRange: dateRangeSchema,
  groupBy: z.enum(['DEPARTMENT', 'COST_TYPE', 'EMPLOYEE']).optional(),
  includeBudgetComparison: z.boolean().default(false),
});
```

### Core Services

```typescript
// src/server/services/hr-analytics.service.ts
import { TRPCError } from '@trpc/server';
import { db } from '../db';
import { eq, and, between, desc, sql, count, avg, sum } from 'drizzle-orm';
import {
  hrAnalyticsSnapshots,
  hrDepartmentAnalytics,
  hrTurnoverRecords,
  hrReportTemplates,
  hrReportExecutions,
  employees,
  payrollRecords,
  leaveRequests,
  leaveEntitlements,
  contracts,
} from '../db/schema';
import { ReportExportService } from './report-export.service';
import { QueueService } from './queue.service';

export class HRAnalyticsService {
  constructor(
    private readonly exportService: ReportExportService,
    private readonly queueService: QueueService
  ) {}

  // ============================================
  // HEADCOUNT ANALYTICS
  // ============================================

  async getHeadcountAnalytics(
    tenantId: string,
    params: {
      dateRange: DateRange;
      groupBy?: 'DEPARTMENT' | 'LOCATION' | 'CONTRACT_TYPE' | 'STATUS';
      includeHistory: boolean;
    }
  ): Promise<HeadcountAnalytics> {
    const { startDate, endDate } = this.resolveDateRange(params.dateRange);

    // Current headcount
    const currentHeadcount = await db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where status = 'ACTIVE')`,
        onLeave: sql<number>`count(*) filter (where status = 'ON_LEAVE')`,
        suspended: sql<number>`count(*) filter (where status = 'SUSPENDED')`,
      })
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, tenantId),
          sql`status != 'TERMINATED'`
        )
      );

    // Headcount by grouping
    let breakdown: HeadcountBreakdown[] = [];
    if (params.groupBy) {
      breakdown = await this.getHeadcountBreakdown(tenantId, params.groupBy);
    }

    // Historical trend
    let history: HeadcountHistory[] = [];
    if (params.includeHistory) {
      history = await db
        .select({
          date: hrAnalyticsSnapshots.snapshotDate,
          totalHeadcount: hrAnalyticsSnapshots.totalHeadcount,
          activeEmployees: hrAnalyticsSnapshots.activeEmployees,
          hiredMtd: hrAnalyticsSnapshots.hiredMtd,
          terminatedMtd: hrAnalyticsSnapshots.terminatedMtd,
        })
        .from(hrAnalyticsSnapshots)
        .where(
          and(
            eq(hrAnalyticsSnapshots.tenantId, tenantId),
            eq(hrAnalyticsSnapshots.snapshotType, 'DAILY'),
            between(hrAnalyticsSnapshots.snapshotDate, startDate, endDate)
          )
        )
        .orderBy(hrAnalyticsSnapshots.snapshotDate);
    }

    // Month-to-date changes
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const mtdChanges = await db
      .select({
        hired: sql<number>`count(*) filter (where hire_date >= ${monthStart})`,
        terminated: sql<number>`count(*) filter (where termination_date >= ${monthStart})`,
      })
      .from(employees)
      .where(eq(employees.tenantId, tenantId));

    return {
      current: {
        total: currentHeadcount[0]?.total ?? 0,
        active: currentHeadcount[0]?.active ?? 0,
        onLeave: currentHeadcount[0]?.onLeave ?? 0,
        suspended: currentHeadcount[0]?.suspended ?? 0,
      },
      breakdown,
      history,
      mtdChanges: {
        hired: mtdChanges[0]?.hired ?? 0,
        terminated: mtdChanges[0]?.terminated ?? 0,
        netChange: (mtdChanges[0]?.hired ?? 0) - (mtdChanges[0]?.terminated ?? 0),
      },
    };
  }

  private async getHeadcountBreakdown(
    tenantId: string,
    groupBy: string
  ): Promise<HeadcountBreakdown[]> {
    const groupColumn = {
      DEPARTMENT: employees.department,
      LOCATION: employees.location,
      CONTRACT_TYPE: sql`(
        SELECT c.contract_type
        FROM contracts c
        WHERE c.employee_id = employees.id
        AND c.status = 'ACTIVE'
        LIMIT 1
      )`,
      STATUS: employees.status,
    }[groupBy];

    const results = await db
      .select({
        group: groupColumn,
        count: count(),
        avgSalary: avg(employees.baseSalary),
      })
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, tenantId),
          sql`status != 'TERMINATED'`
        )
      )
      .groupBy(groupColumn)
      .orderBy(desc(count()));

    return results.map((r) => ({
      name: r.group as string,
      count: Number(r.count),
      avgSalary: r.avgSalary ? Number(r.avgSalary) : undefined,
    }));
  }

  // ============================================
  // TURNOVER ANALYTICS
  // ============================================

  async getTurnoverAnalytics(
    tenantId: string,
    params: {
      dateRange: DateRange;
      groupBy?: 'DEPARTMENT' | 'POSITION' | 'TERMINATION_TYPE' | 'TENURE_BRACKET';
      includeReasons: boolean;
    }
  ): Promise<TurnoverAnalytics> {
    const { startDate, endDate } = this.resolveDateRange(params.dateRange);

    // Get separations in period
    const separations = await db
      .select({
        total: count(),
        voluntary: sql<number>`count(*) filter (where termination_type = 'VOLUNTARY')`,
        involuntary: sql<number>`count(*) filter (where termination_type = 'INVOLUNTARY')`,
        endOfContract: sql<number>`count(*) filter (where termination_type = 'END_OF_CONTRACT')`,
        retirement: sql<number>`count(*) filter (where termination_type = 'RETIREMENT')`,
        avgTenureDays: avg(hrTurnoverRecords.tenureDays),
      })
      .from(hrTurnoverRecords)
      .where(
        and(
          eq(hrTurnoverRecords.tenantId, tenantId),
          between(hrTurnoverRecords.terminationDate, startDate, endDate)
        )
      );

    // Calculate average headcount for period
    const avgHeadcount = await this.getAverageHeadcount(tenantId, startDate, endDate);

    // Turnover rate calculation
    const totalSeparations = separations[0]?.total ?? 0;
    const turnoverRate = avgHeadcount > 0
      ? (totalSeparations / avgHeadcount) * 100
      : 0;

    // Breakdown by group
    let breakdown: TurnoverBreakdown[] = [];
    if (params.groupBy) {
      breakdown = await this.getTurnoverBreakdown(tenantId, startDate, endDate, params.groupBy);
    }

    // Termination reasons
    let reasons: TerminationReason[] = [];
    if (params.includeReasons) {
      const reasonResults = await db
        .select({
          reason: hrTurnoverRecords.terminationReason,
          count: count(),
        })
        .from(hrTurnoverRecords)
        .where(
          and(
            eq(hrTurnoverRecords.tenantId, tenantId),
            between(hrTurnoverRecords.terminationDate, startDate, endDate),
            sql`termination_reason IS NOT NULL`
          )
        )
        .groupBy(hrTurnoverRecords.terminationReason)
        .orderBy(desc(count()))
        .limit(10);

      reasons = reasonResults.map((r) => ({
        reason: r.reason as string,
        count: Number(r.count),
      }));
    }

    // Monthly trend
    const monthlyTrend = await db
      .select({
        month: sql<string>`to_char(termination_date, 'YYYY-MM')`,
        count: count(),
      })
      .from(hrTurnoverRecords)
      .where(
        and(
          eq(hrTurnoverRecords.tenantId, tenantId),
          between(hrTurnoverRecords.terminationDate, startDate, endDate)
        )
      )
      .groupBy(sql`to_char(termination_date, 'YYYY-MM')`)
      .orderBy(sql`to_char(termination_date, 'YYYY-MM')`);

    return {
      summary: {
        totalSeparations,
        voluntary: separations[0]?.voluntary ?? 0,
        involuntary: separations[0]?.involuntary ?? 0,
        endOfContract: separations[0]?.endOfContract ?? 0,
        retirement: separations[0]?.retirement ?? 0,
        avgTenureDays: Math.round(Number(separations[0]?.avgTenureDays) || 0),
        turnoverRate: Math.round(turnoverRate * 100) / 100,
      },
      breakdown,
      reasons,
      monthlyTrend: monthlyTrend.map((t) => ({
        month: t.month,
        count: Number(t.count),
      })),
    };
  }

  private async getTurnoverBreakdown(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    groupBy: string
  ): Promise<TurnoverBreakdown[]> {
    let groupColumn: any;

    if (groupBy === 'TENURE_BRACKET') {
      groupColumn = sql`
        CASE
          WHEN tenure_days < 90 THEN 'Mniej niż 3 miesiące'
          WHEN tenure_days < 180 THEN '3-6 miesięcy'
          WHEN tenure_days < 365 THEN '6-12 miesięcy'
          WHEN tenure_days < 730 THEN '1-2 lata'
          WHEN tenure_days < 1825 THEN '2-5 lat'
          ELSE 'Powyżej 5 lat'
        END
      `;
    } else {
      groupColumn = {
        DEPARTMENT: hrTurnoverRecords.departmentAtTermination,
        POSITION: hrTurnoverRecords.positionAtTermination,
        TERMINATION_TYPE: hrTurnoverRecords.terminationType,
      }[groupBy];
    }

    const results = await db
      .select({
        group: groupColumn,
        count: count(),
        avgTenure: avg(hrTurnoverRecords.tenureDays),
      })
      .from(hrTurnoverRecords)
      .where(
        and(
          eq(hrTurnoverRecords.tenantId, tenantId),
          between(hrTurnoverRecords.terminationDate, startDate, endDate)
        )
      )
      .groupBy(groupColumn)
      .orderBy(desc(count()));

    return results.map((r) => ({
      name: r.group as string,
      count: Number(r.count),
      avgTenureDays: Math.round(Number(r.avgTenure) || 0),
    }));
  }

  // ============================================
  // LEAVE UTILIZATION
  // ============================================

  async getLeaveUtilization(
    tenantId: string,
    params: {
      dateRange: DateRange;
      groupBy?: 'DEPARTMENT' | 'LEAVE_TYPE' | 'EMPLOYEE';
      includeExpiring: boolean;
    }
  ): Promise<LeaveUtilizationAnalytics> {
    const { startDate, endDate } = this.resolveDateRange(params.dateRange);

    // Overall utilization
    const utilization = await db
      .select({
        totalEntitled: sum(leaveEntitlements.totalEntitlement),
        totalUsed: sum(leaveEntitlements.usedDays),
        totalRemaining: sum(leaveEntitlements.remainingDays),
      })
      .from(leaveEntitlements)
      .innerJoin(employees, eq(employees.id, leaveEntitlements.employeeId))
      .where(
        and(
          eq(employees.tenantId, tenantId),
          eq(leaveEntitlements.year, new Date().getFullYear())
        )
      );

    const totalEntitled = Number(utilization[0]?.totalEntitled) || 0;
    const totalUsed = Number(utilization[0]?.totalUsed) || 0;
    const utilizationRate = totalEntitled > 0 ? (totalUsed / totalEntitled) * 100 : 0;

    // Leave type breakdown
    const byType = await db
      .select({
        leaveType: leaveEntitlements.leaveType,
        totalDays: sum(leaveEntitlements.usedDays),
        avgDays: avg(leaveEntitlements.usedDays),
      })
      .from(leaveEntitlements)
      .innerJoin(employees, eq(employees.id, leaveEntitlements.employeeId))
      .where(
        and(
          eq(employees.tenantId, tenantId),
          eq(leaveEntitlements.year, new Date().getFullYear())
        )
      )
      .groupBy(leaveEntitlements.leaveType);

    // Sick leave patterns (for health monitoring)
    const sickLeavePattern = await db
      .select({
        month: sql<string>`to_char(start_date, 'YYYY-MM')`,
        totalDays: sum(leaveRequests.workingDays),
        requestCount: count(),
      })
      .from(leaveRequests)
      .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
      .where(
        and(
          eq(employees.tenantId, tenantId),
          eq(leaveRequests.leaveType, 'CHOROBOWY'),
          eq(leaveRequests.status, 'APPROVED'),
          between(leaveRequests.startDate, startDate, endDate)
        )
      )
      .groupBy(sql`to_char(start_date, 'YYYY-MM')`)
      .orderBy(sql`to_char(start_date, 'YYYY-MM')`);

    // Expiring leave (must be used by Sept 30 of following year)
    let expiringLeave: ExpiringLeaveInfo[] = [];
    if (params.includeExpiring) {
      const expiryDate = new Date();
      expiryDate.setMonth(8, 30); // September 30
      if (expiryDate < new Date()) {
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      }

      const expiring = await db
        .select({
          employeeId: employees.id,
          employeeName: sql<string>`first_name || ' ' || last_name`,
          remainingDays: leaveEntitlements.remainingDays,
          expiryDate: sql<Date>`${expiryDate}`,
        })
        .from(leaveEntitlements)
        .innerJoin(employees, eq(employees.id, leaveEntitlements.employeeId))
        .where(
          and(
            eq(employees.tenantId, tenantId),
            eq(leaveEntitlements.year, new Date().getFullYear() - 1),
            sql`remaining_days > 0`,
            sql`carry_over_days > 0`
          )
        )
        .orderBy(desc(leaveEntitlements.remainingDays))
        .limit(20);

      expiringLeave = expiring.map((e) => ({
        employeeId: e.employeeId,
        employeeName: e.employeeName,
        remainingDays: Number(e.remainingDays),
        expiryDate: e.expiryDate,
      }));
    }

    return {
      summary: {
        totalEntitled,
        totalUsed,
        totalRemaining: Number(utilization[0]?.totalRemaining) || 0,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
      },
      byType: byType.map((t) => ({
        leaveType: t.leaveType,
        totalDays: Number(t.totalDays) || 0,
        avgDays: Math.round((Number(t.avgDays) || 0) * 100) / 100,
      })),
      sickLeavePattern: sickLeavePattern.map((p) => ({
        month: p.month,
        totalDays: Number(p.totalDays) || 0,
        requestCount: Number(p.requestCount),
      })),
      expiringLeave,
    };
  }

  // ============================================
  // PAYROLL COST ANALYSIS
  // ============================================

  async getPayrollCostAnalysis(
    tenantId: string,
    params: {
      dateRange: DateRange;
      groupBy?: 'DEPARTMENT' | 'COST_TYPE' | 'EMPLOYEE';
      includeBudgetComparison: boolean;
    }
  ): Promise<PayrollCostAnalytics> {
    const { startDate, endDate } = this.resolveDateRange(params.dateRange);

    // Total costs
    const costs = await db
      .select({
        grossSalary: sum(payrollRecords.grossSalary),
        employerZus: sum(payrollRecords.employerZusTotal),
        employerPpk: sum(payrollRecords.employerPpk),
        benefits: sum(payrollRecords.benefitsTotal),
        overtime: sum(payrollRecords.overtimeAmount),
        totalCost: sql<number>`
          sum(gross_salary) +
          sum(employer_zus_total) +
          sum(COALESCE(employer_ppk, 0)) +
          sum(COALESCE(benefits_total, 0))
        `,
      })
      .from(payrollRecords)
      .innerJoin(employees, eq(employees.id, payrollRecords.employeeId))
      .where(
        and(
          eq(employees.tenantId, tenantId),
          between(payrollRecords.periodStart, startDate, endDate)
        )
      );

    // Cost per employee
    const employeeCount = await db
      .select({ count: sql<number>`count(distinct employee_id)` })
      .from(payrollRecords)
      .innerJoin(employees, eq(employees.id, payrollRecords.employeeId))
      .where(
        and(
          eq(employees.tenantId, tenantId),
          between(payrollRecords.periodStart, startDate, endDate)
        )
      );

    const totalCost = Number(costs[0]?.totalCost) || 0;
    const numEmployees = Number(employeeCount[0]?.count) || 1;
    const avgCostPerEmployee = totalCost / numEmployees;

    // Monthly trend
    const monthlyTrend = await db
      .select({
        month: sql<string>`to_char(period_start, 'YYYY-MM')`,
        grossSalary: sum(payrollRecords.grossSalary),
        employerZus: sum(payrollRecords.employerZusTotal),
        totalCost: sql<number>`
          sum(gross_salary) +
          sum(employer_zus_total) +
          sum(COALESCE(employer_ppk, 0)) +
          sum(COALESCE(benefits_total, 0))
        `,
      })
      .from(payrollRecords)
      .innerJoin(employees, eq(employees.id, payrollRecords.employeeId))
      .where(
        and(
          eq(employees.tenantId, tenantId),
          between(payrollRecords.periodStart, startDate, endDate)
        )
      )
      .groupBy(sql`to_char(period_start, 'YYYY-MM')`)
      .orderBy(sql`to_char(period_start, 'YYYY-MM')`);

    // Cost breakdown
    const costBreakdown = [
      { category: 'Wynagrodzenia brutto', amount: Number(costs[0]?.grossSalary) || 0 },
      { category: 'Składki ZUS (pracodawca)', amount: Number(costs[0]?.employerZus) || 0 },
      { category: 'PPK (pracodawca)', amount: Number(costs[0]?.employerPpk) || 0 },
      { category: 'Świadczenia i benefity', amount: Number(costs[0]?.benefits) || 0 },
      { category: 'Nadgodziny', amount: Number(costs[0]?.overtime) || 0 },
    ];

    // Year-over-year comparison
    const previousYearStart = new Date(startDate);
    previousYearStart.setFullYear(previousYearStart.getFullYear() - 1);
    const previousYearEnd = new Date(endDate);
    previousYearEnd.setFullYear(previousYearEnd.getFullYear() - 1);

    const previousYearCosts = await db
      .select({
        totalCost: sql<number>`
          sum(gross_salary) +
          sum(employer_zus_total) +
          sum(COALESCE(employer_ppk, 0)) +
          sum(COALESCE(benefits_total, 0))
        `,
      })
      .from(payrollRecords)
      .innerJoin(employees, eq(employees.id, payrollRecords.employeeId))
      .where(
        and(
          eq(employees.tenantId, tenantId),
          between(payrollRecords.periodStart, previousYearStart, previousYearEnd)
        )
      );

    const previousYearTotal = Number(previousYearCosts[0]?.totalCost) || 0;
    const yoyChange = previousYearTotal > 0
      ? ((totalCost - previousYearTotal) / previousYearTotal) * 100
      : 0;

    return {
      summary: {
        totalCost,
        grossSalary: Number(costs[0]?.grossSalary) || 0,
        employerZus: Number(costs[0]?.employerZus) || 0,
        employerPpk: Number(costs[0]?.employerPpk) || 0,
        benefits: Number(costs[0]?.benefits) || 0,
        overtime: Number(costs[0]?.overtime) || 0,
        avgCostPerEmployee: Math.round(avgCostPerEmployee * 100) / 100,
      },
      costBreakdown,
      monthlyTrend: monthlyTrend.map((t) => ({
        month: t.month,
        grossSalary: Number(t.grossSalary) || 0,
        employerZus: Number(t.employerZus) || 0,
        totalCost: Number(t.totalCost) || 0,
      })),
      yearOverYear: {
        currentPeriod: totalCost,
        previousPeriod: previousYearTotal,
        changePercent: Math.round(yoyChange * 100) / 100,
      },
    };
  }

  // ============================================
  // CUSTOM REPORT BUILDER
  // ============================================

  async executeCustomReport(
    tenantId: string,
    userId: string,
    params: {
      templateId?: string;
      config?: ReportConfig;
      exportFormat: 'XLSX' | 'CSV' | 'PDF';
    }
  ): Promise<{ executionId: string; status: string }> {
    let config: ReportConfig;

    if (params.templateId) {
      const template = await db.query.hrReportTemplates.findFirst({
        where: and(
          eq(hrReportTemplates.id, params.templateId),
          eq(hrReportTemplates.tenantId, tenantId)
        ),
      });

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Szablon raportu nie został znaleziony',
        });
      }

      config = template.config as ReportConfig;
    } else if (params.config) {
      config = params.config;
    } else {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Wymagany templateId lub config',
      });
    }

    // Create execution record
    const [execution] = await db
      .insert(hrReportExecutions)
      .values({
        tenantId,
        templateId: params.templateId || null,
        executedBy: userId,
        reportType: 'CUSTOM',
        configSnapshot: config,
        status: 'PENDING',
        exportFormat: params.exportFormat,
      })
      .returning();

    // Queue the report generation
    await this.queueService.addJob('hr-report-generation', {
      executionId: execution.id,
      tenantId,
      config,
      exportFormat: params.exportFormat,
    });

    return {
      executionId: execution.id,
      status: 'PENDING',
    };
  }

  async getReportExecutionStatus(
    tenantId: string,
    executionId: string
  ): Promise<ReportExecutionStatus> {
    const execution = await db.query.hrReportExecutions.findFirst({
      where: and(
        eq(hrReportExecutions.id, executionId),
        eq(hrReportExecutions.tenantId, tenantId)
      ),
    });

    if (!execution) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Wykonanie raportu nie zostało znalezione',
      });
    }

    return {
      id: execution.id,
      status: execution.status,
      rowCount: execution.rowCount,
      filePath: execution.filePath,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      durationMs: execution.durationMs,
      errorMessage: execution.errorMessage,
    };
  }

  // ============================================
  // SNAPSHOT GENERATION (Scheduled job)
  // ============================================

  async generateDailySnapshot(tenantId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get current metrics
    const headcount = await db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where status = 'ACTIVE')`,
        onLeave: sql<number>`count(*) filter (where status = 'ON_LEAVE')`,
      })
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, tenantId),
          sql`status != 'TERMINATED'`
        )
      );

    // Get month-to-date changes
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const mtdChanges = await db
      .select({
        hired: sql<number>`count(*) filter (where hire_date >= ${monthStart})`,
        terminated: sql<number>`count(*) filter (where termination_date >= ${monthStart})`,
      })
      .from(employees)
      .where(eq(employees.tenantId, tenantId));

    // Get cost metrics for current month
    const costs = await db
      .select({
        grossSalary: sum(payrollRecords.grossSalary),
        employerZus: sum(payrollRecords.employerZusTotal),
        employerPpk: sum(payrollRecords.employerPpk),
        benefits: sum(payrollRecords.benefitsTotal),
        overtime: sum(payrollRecords.overtimeAmount),
      })
      .from(payrollRecords)
      .innerJoin(employees, eq(employees.id, payrollRecords.employeeId))
      .where(
        and(
          eq(employees.tenantId, tenantId),
          sql`period_start >= ${monthStart}`
        )
      );

    // Calculate averages
    const averages = await db
      .select({
        avgSalary: avg(employees.baseSalary),
        avgTenure: sql<number>`avg(extract(day from now() - hire_date))`,
      })
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, tenantId),
          sql`status = 'ACTIVE'`
        )
      );

    // Insert snapshot
    await db
      .insert(hrAnalyticsSnapshots)
      .values({
        tenantId,
        snapshotDate: today,
        snapshotType: 'DAILY',
        totalHeadcount: headcount[0]?.total ?? 0,
        activeEmployees: headcount[0]?.active ?? 0,
        onLeaveEmployees: headcount[0]?.onLeave ?? 0,
        terminatedMtd: mtdChanges[0]?.terminated ?? 0,
        hiredMtd: mtdChanges[0]?.hired ?? 0,
        totalGrossSalary: costs[0]?.grossSalary?.toString() ?? '0',
        totalEmployerZus: costs[0]?.employerZus?.toString() ?? '0',
        totalEmployerPpk: costs[0]?.employerPpk?.toString() ?? '0',
        totalBenefitsCost: costs[0]?.benefits?.toString() ?? '0',
        totalOvertimeCost: costs[0]?.overtime?.toString() ?? '0',
        avgSalary: averages[0]?.avgSalary?.toString() ?? '0',
        avgTenureDays: Math.round(Number(averages[0]?.avgTenure) || 0),
      })
      .onConflictDoUpdate({
        target: [hrAnalyticsSnapshots.tenantId, hrAnalyticsSnapshots.snapshotDate, hrAnalyticsSnapshots.snapshotType],
        set: {
          totalHeadcount: headcount[0]?.total ?? 0,
          activeEmployees: headcount[0]?.active ?? 0,
          updatedAt: new Date(),
        },
      });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private resolveDateRange(dateRange: DateRange): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (dateRange.type) {
      case 'LAST_7_DAYS':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'LAST_30_DAYS':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'LAST_90_DAYS':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'LAST_12_MONTHS':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case 'YEAR_TO_DATE':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'CUSTOM':
        startDate = new Date(dateRange.startDate!);
        endDate = new Date(dateRange.endDate!);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }

  private async getAverageHeadcount(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const snapshots = await db
      .select({
        avgHeadcount: avg(hrAnalyticsSnapshots.totalHeadcount),
      })
      .from(hrAnalyticsSnapshots)
      .where(
        and(
          eq(hrAnalyticsSnapshots.tenantId, tenantId),
          between(hrAnalyticsSnapshots.snapshotDate, startDate, endDate)
        )
      );

    return Number(snapshots[0]?.avgHeadcount) || 0;
  }
}
```

### tRPC Router

```typescript
// src/server/routers/hr-analytics.router.ts
import { router, hrManagerProcedure, adminProcedure } from '../trpc';
import { z } from 'zod';
import {
  headcountRequestSchema,
  turnoverRequestSchema,
  leaveUtilizationRequestSchema,
  payrollCostRequestSchema,
  createReportTemplateSchema,
  executeReportSchema,
} from '../schemas/hr-analytics.schema';

export const hrAnalyticsRouter = router({
  // Headcount analytics
  getHeadcount: hrManagerProcedure
    .input(headcountRequestSchema)
    .query(async ({ ctx, input }) => {
      return ctx.hrAnalyticsService.getHeadcountAnalytics(
        ctx.tenantId,
        input
      );
    }),

  // Turnover analytics
  getTurnover: hrManagerProcedure
    .input(turnoverRequestSchema)
    .query(async ({ ctx, input }) => {
      return ctx.hrAnalyticsService.getTurnoverAnalytics(
        ctx.tenantId,
        input
      );
    }),

  // Leave utilization
  getLeaveUtilization: hrManagerProcedure
    .input(leaveUtilizationRequestSchema)
    .query(async ({ ctx, input }) => {
      return ctx.hrAnalyticsService.getLeaveUtilization(
        ctx.tenantId,
        input
      );
    }),

  // Payroll cost analysis
  getPayrollCosts: hrManagerProcedure
    .input(payrollCostRequestSchema)
    .query(async ({ ctx, input }) => {
      return ctx.hrAnalyticsService.getPayrollCostAnalysis(
        ctx.tenantId,
        input
      );
    }),

  // Report templates
  createTemplate: hrManagerProcedure
    .input(createReportTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.hrAnalyticsService.createReportTemplate(
        ctx.tenantId,
        ctx.userId,
        input
      );
    }),

  getTemplates: hrManagerProcedure
    .input(z.object({
      reportType: z.string().optional(),
      includePublic: z.boolean().default(true),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.hrAnalyticsService.getReportTemplates(
        ctx.tenantId,
        ctx.userId,
        input
      );
    }),

  // Execute reports
  executeReport: hrManagerProcedure
    .input(executeReportSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.hrAnalyticsService.executeCustomReport(
        ctx.tenantId,
        ctx.userId,
        input
      );
    }),

  getReportStatus: hrManagerProcedure
    .input(z.object({ executionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.hrAnalyticsService.getReportExecutionStatus(
        ctx.tenantId,
        input.executionId
      );
    }),

  downloadReport: hrManagerProcedure
    .input(z.object({ executionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.hrAnalyticsService.getReportDownloadUrl(
        ctx.tenantId,
        input.executionId
      );
    }),

  // Dashboard summary
  getDashboardSummary: hrManagerProcedure
    .query(async ({ ctx }) => {
      const [headcount, turnover, leave, costs] = await Promise.all([
        ctx.hrAnalyticsService.getHeadcountAnalytics(ctx.tenantId, {
          dateRange: { type: 'LAST_30_DAYS' },
          includeHistory: false,
        }),
        ctx.hrAnalyticsService.getTurnoverAnalytics(ctx.tenantId, {
          dateRange: { type: 'LAST_12_MONTHS' },
          includeReasons: false,
        }),
        ctx.hrAnalyticsService.getLeaveUtilization(ctx.tenantId, {
          dateRange: { type: 'YEAR_TO_DATE' },
          includeExpiring: true,
        }),
        ctx.hrAnalyticsService.getPayrollCostAnalysis(ctx.tenantId, {
          dateRange: { type: 'LAST_12_MONTHS' },
          includeBudgetComparison: false,
        }),
      ]);

      return {
        headcount: headcount.current,
        mtdChanges: headcount.mtdChanges,
        turnoverRate: turnover.summary.turnoverRate,
        leaveUtilization: leave.summary.utilizationRate,
        expiringLeaveCount: leave.expiringLeave.length,
        totalPayrollCost: costs.summary.totalCost,
        yoyChange: costs.yearOverYear.changePercent,
      };
    }),

  // Admin: Generate snapshots (for scheduled job)
  generateSnapshot: adminProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.hrAnalyticsService.generateDailySnapshot(input.tenantId);
      return { success: true };
    }),
});
```

---

## Test Specification

### Unit Tests

```typescript
describe('HRAnalyticsService', () => {
  describe('getHeadcountAnalytics', () => {
    it('should return correct current headcount', async () => {
      // Setup: Create 10 active, 2 on leave, 3 terminated employees
      const result = await service.getHeadcountAnalytics(tenantId, {
        dateRange: { type: 'LAST_30_DAYS' },
        includeHistory: false,
      });

      expect(result.current.total).toBe(12); // 10 + 2 (excludes terminated)
      expect(result.current.active).toBe(10);
      expect(result.current.onLeave).toBe(2);
    });

    it('should correctly group by department', async () => {
      const result = await service.getHeadcountAnalytics(tenantId, {
        dateRange: { type: 'LAST_30_DAYS' },
        groupBy: 'DEPARTMENT',
        includeHistory: false,
      });

      expect(result.breakdown).toHaveLength(3); // 3 departments
      expect(result.breakdown[0].count).toBeGreaterThan(0);
    });
  });

  describe('getTurnoverAnalytics', () => {
    it('should calculate turnover rate correctly', async () => {
      // Setup: 5 separations in period, average headcount 100
      const result = await service.getTurnoverAnalytics(tenantId, {
        dateRange: { type: 'LAST_12_MONTHS' },
        includeReasons: true,
      });

      expect(result.summary.turnoverRate).toBe(5); // 5/100 * 100 = 5%
    });

    it('should break down by termination type', async () => {
      const result = await service.getTurnoverAnalytics(tenantId, {
        dateRange: { type: 'LAST_12_MONTHS' },
        includeReasons: false,
      });

      const total = result.summary.voluntary +
                   result.summary.involuntary +
                   result.summary.endOfContract +
                   result.summary.retirement;
      expect(total).toBe(result.summary.totalSeparations);
    });
  });

  describe('getLeaveUtilization', () => {
    it('should calculate utilization rate correctly', async () => {
      // Setup: 200 days entitled, 150 days used
      const result = await service.getLeaveUtilization(tenantId, {
        dateRange: { type: 'YEAR_TO_DATE' },
        includeExpiring: false,
      });

      expect(result.summary.utilizationRate).toBe(75); // 150/200 * 100
    });

    it('should identify expiring leave', async () => {
      const result = await service.getLeaveUtilization(tenantId, {
        dateRange: { type: 'YEAR_TO_DATE' },
        includeExpiring: true,
      });

      result.expiringLeave.forEach((leave) => {
        expect(leave.remainingDays).toBeGreaterThan(0);
        expect(new Date(leave.expiryDate).getMonth()).toBe(8); // September
      });
    });
  });

  describe('getPayrollCostAnalysis', () => {
    it('should sum all cost components correctly', async () => {
      const result = await service.getPayrollCostAnalysis(tenantId, {
        dateRange: { type: 'LAST_12_MONTHS' },
        includeBudgetComparison: false,
      });

      const expectedTotal = result.summary.grossSalary +
                           result.summary.employerZus +
                           result.summary.employerPpk +
                           result.summary.benefits;

      // Allow for rounding differences
      expect(Math.abs(result.summary.totalCost - expectedTotal)).toBeLessThan(1);
    });

    it('should calculate year-over-year change', async () => {
      const result = await service.getPayrollCostAnalysis(tenantId, {
        dateRange: { type: 'LAST_12_MONTHS' },
        includeBudgetComparison: false,
      });

      expect(result.yearOverYear.currentPeriod).toBeGreaterThan(0);
      expect(typeof result.yearOverYear.changePercent).toBe('number');
    });
  });

  describe('executeCustomReport', () => {
    it('should queue report generation', async () => {
      const result = await service.executeCustomReport(tenantId, userId, {
        config: {
          fields: ['employee_name', 'department', 'salary'],
          filters: [],
          groupBy: [],
          sortBy: [],
          calculations: [],
          dateRange: { type: 'LAST_30_DAYS' },
        },
        exportFormat: 'XLSX',
      });

      expect(result.executionId).toBeDefined();
      expect(result.status).toBe('PENDING');
    });
  });
});
```

### Integration Tests

```typescript
describe('HR Analytics Integration', () => {
  it('should generate daily snapshot correctly', async () => {
    // Setup: Create employees with various statuses and payroll records
    await service.generateDailySnapshot(tenantId);

    const snapshot = await db.query.hrAnalyticsSnapshots.findFirst({
      where: and(
        eq(hrAnalyticsSnapshots.tenantId, tenantId),
        eq(hrAnalyticsSnapshots.snapshotType, 'DAILY')
      ),
      orderBy: desc(hrAnalyticsSnapshots.snapshotDate),
    });

    expect(snapshot).toBeDefined();
    expect(snapshot?.totalHeadcount).toBeGreaterThan(0);
  });

  it('should export report to Excel', async () => {
    const { executionId } = await service.executeCustomReport(tenantId, userId, {
      config: {
        fields: ['employee_name', 'department', 'salary', 'hire_date'],
        filters: [],
        groupBy: [],
        sortBy: [{ field: 'salary', direction: 'DESC' }],
        calculations: [{ name: 'avg_salary', function: 'AVG', field: 'salary' }],
        dateRange: { type: 'YEAR_TO_DATE' },
      },
      exportFormat: 'XLSX',
    });

    // Wait for job to complete
    await waitForJobCompletion(executionId);

    const status = await service.getReportExecutionStatus(tenantId, executionId);
    expect(status.status).toBe('COMPLETED');
    expect(status.filePath).toContain('.xlsx');
    expect(status.rowCount).toBeGreaterThan(0);
  });
});
```

---

## Security Checklist

- [ ] Role-based access (HR Manager, Admin only)
- [ ] Tenant isolation via RLS policies
- [ ] Sensitive salary data aggregated (no individual exports without permission)
- [ ] Report access logging
- [ ] Export watermarking with user info
- [ ] Large export rate limiting
- [ ] PII masking in certain report types
- [ ] Audit trail for all report executions

---

## Audit Events

```typescript
const HR_ANALYTICS_AUDIT_EVENTS = {
  REPORT_GENERATED: 'hrp.analytics.report_generated',
  REPORT_EXPORTED: 'hrp.analytics.report_exported',
  TEMPLATE_CREATED: 'hrp.analytics.template_created',
  TEMPLATE_UPDATED: 'hrp.analytics.template_updated',
  TEMPLATE_DELETED: 'hrp.analytics.template_deleted',
  SCHEDULED_REPORT_RUN: 'hrp.analytics.scheduled_run',
  SNAPSHOT_GENERATED: 'hrp.analytics.snapshot_generated',
} as const;
```

---

## Implementation Notes

### Performance Considerations

1. **Materialized Snapshots**: Pre-compute daily snapshots for fast dashboard loading
2. **Async Export**: Queue large report exports to avoid timeout
3. **Caching**: Cache frequently accessed metrics with short TTL
4. **Pagination**: Always paginate large result sets
5. **Aggregation**: Use database-level aggregations, not application-level

### Polish-Specific Metrics

1. **ZUS Costs**: Track employer ZUS separately from employee deductions
2. **PPK**: Employee Capital Plans tracking
3. **Leave Carryover**: Polish law allows carryover until Sept 30
4. **Tax Year**: Polish tax year aligns with calendar year

### Export Formats

1. **Excel**: Full formatting, multiple sheets, charts
2. **CSV**: Simple data export for further processing
3. **PDF**: Formatted reports for sharing/printing

---

*Last Updated: December 2024*
