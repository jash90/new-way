# CRM-011: Client Statistics

> **Story ID**: CRM-011
> **Epic**: Core CRM Module
> **Priority**: P2
> **Points**: 5
> **Status**: 📋 Ready for Development
> **Phase**: Week 8

---

## User Story

**As an** accountant,
**I want** client statistics and analytics,
**So that** I can understand engagement and performance.

---

## Acceptance Criteria

### AC1: Client Overview Dashboard
```gherkin
Feature: Client Statistics Dashboard
  As an accountant
  I want to see aggregated client statistics
  So that I can understand my client portfolio

  Background:
    Given I am logged in as "accountant@firma.pl"
    And I have "viewer" role in organization "Biuro Rachunkowe XYZ"

  Scenario: View portfolio summary
    Given I have 150 clients in my organization
    When I navigate to statistics dashboard
    Then I should see total client count "150"
    And I should see active clients count
    And I should see clients by status breakdown
    And I should see new clients this month
    And I should see churned clients this month

  Scenario: View client distribution by status
    Given I have clients with various statuses
    When I view the status chart
    Then I should see pie chart with status distribution
    And each segment should show count and percentage
    And I can click segment to filter client list

  Scenario: View client growth trend
    Given I have historical client data
    When I view the growth chart
    And I select time range "Last 12 months"
    Then I should see line chart with monthly client count
    And I should see new clients per month
    And I should see churned clients per month
    And net growth should be calculated
```

### AC2: Engagement Analytics
```gherkin
Feature: Client Engagement Analytics
  As an accountant
  I want to analyze client engagement patterns
  So that I can identify clients needing attention

  Scenario: View engagement metrics
    Given I am on the statistics dashboard
    When I view engagement section
    Then I should see average documents per client
    And I should see average timeline events per client
    And I should see clients with no activity in 30 days
    And I should see most active clients list

  Scenario: Identify inactive clients
    Given I have clients with varying activity levels
    When I click "Nieaktywni klienci"
    Then I should see list of clients with no activity in 30+ days
    And list should show last activity date
    And list should show days since last activity
    And I can filter by inactivity period

  Scenario: View activity heatmap
    Given I have timeline data for clients
    When I view the activity heatmap
    Then I should see calendar heatmap of all client activities
    And darker cells should indicate more activity
    And I can hover to see activity count per day
```

### AC3: VAT and Compliance Statistics
```gherkin
Feature: VAT and Compliance Statistics
  As an accountant
  I want to see VAT and compliance statistics
  So that I can monitor regulatory status

  Scenario: View VAT status distribution
    Given I have clients with various VAT statuses
    When I view VAT statistics
    Then I should see VAT payers count
    And I should see VAT exempt count
    And I should see active EU VAT count
    And I should see whitelist verified count
    And I should see whitelist issues count

  Scenario: View tax form distribution
    Given I have clients with various tax forms
    When I view tax form chart
    Then I should see distribution: CIT, PIT, VAT, Flat Tax, Lump Sum
    And each category should show count and percentage

  Scenario: Monitor compliance issues
    Given I have clients with compliance statuses
    When I view compliance overview
    Then I should see clients with invalid VAT
    And I should see clients not on whitelist
    And I should see clients with missing documents
    And I should see clients with expired registrations
```

### AC4: Tag and Category Analytics
```gherkin
Feature: Tag Analytics
  As an accountant
  I want to analyze client distribution by tags
  So that I can understand my client segments

  Scenario: View tag distribution
    Given I have tagged clients
    When I view tag analytics
    Then I should see bar chart of clients per tag
    And tags should be sorted by client count
    And I can click tag to filter client list

  Scenario: View tag trends
    Given I have historical tag assignment data
    When I view tag trends
    And I select tag "VIP"
    Then I should see growth of VIP tag over time
    And I should see when tag assignments spiked

  Scenario: Compare tag performance
    Given I have clients with multiple tags
    When I compare tags "VIP" and "Standard"
    Then I should see comparison metrics
    And metrics should include: avg documents, avg revenue, activity level
```

### AC5: Export and Reports
```gherkin
Feature: Statistics Export
  As an accountant
  I want to export statistics reports
  So that I can share insights with stakeholders

  Scenario: Export statistics to PDF
    Given I am viewing the statistics dashboard
    When I click "Eksportuj raport"
    And I select "PDF" format
    Then a PDF report should be generated
    And include all visible charts and tables
    And include report generation date
    And include organization name

  Scenario: Schedule periodic reports
    Given I am on the reports settings page
    When I create scheduled report "Tygodniowe statystyki"
    And I set frequency to "weekly"
    And I set recipients to "manager@firma.pl"
    Then report should be scheduled
    And I should receive confirmation email
```

---

## Technical Specification

### Database Schema

```sql
-- Statistics cache table for performance
CREATE TABLE client_statistics_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    metric_type VARCHAR(50) NOT NULL,
    metric_date DATE NOT NULL,

    -- Cached values
    metric_value JSONB NOT NULL,

    -- Cache management
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT unique_org_metric_date UNIQUE (organization_id, metric_type, metric_date)
);

-- Daily snapshots for historical tracking
CREATE TABLE client_daily_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    snapshot_date DATE NOT NULL,

    -- Counts
    total_clients INTEGER NOT NULL DEFAULT 0,
    active_clients INTEGER NOT NULL DEFAULT 0,
    inactive_clients INTEGER NOT NULL DEFAULT 0,
    suspended_clients INTEGER NOT NULL DEFAULT 0,
    pending_clients INTEGER NOT NULL DEFAULT 0,
    archived_clients INTEGER NOT NULL DEFAULT 0,

    -- VAT statistics
    vat_active INTEGER NOT NULL DEFAULT 0,
    vat_exempt INTEGER NOT NULL DEFAULT 0,
    vat_not_registered INTEGER NOT NULL DEFAULT 0,
    vat_invalid INTEGER NOT NULL DEFAULT 0,
    whitelist_verified INTEGER NOT NULL DEFAULT 0,
    whitelist_issues INTEGER NOT NULL DEFAULT 0,

    -- Tax form distribution
    tax_form_cit INTEGER NOT NULL DEFAULT 0,
    tax_form_pit INTEGER NOT NULL DEFAULT 0,
    tax_form_vat INTEGER NOT NULL DEFAULT 0,
    tax_form_flat INTEGER NOT NULL DEFAULT 0,
    tax_form_lump INTEGER NOT NULL DEFAULT 0,

    -- Engagement metrics
    clients_with_activity_7d INTEGER NOT NULL DEFAULT 0,
    clients_with_activity_30d INTEGER NOT NULL DEFAULT 0,
    total_timeline_events INTEGER NOT NULL DEFAULT 0,
    total_documents INTEGER NOT NULL DEFAULT 0,

    -- Changes
    new_clients INTEGER NOT NULL DEFAULT 0,
    churned_clients INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_org_snapshot_date UNIQUE (organization_id, snapshot_date)
);

-- Tag statistics tracking
CREATE TABLE tag_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    tag_id UUID NOT NULL REFERENCES tags(id),
    snapshot_date DATE NOT NULL,

    client_count INTEGER NOT NULL DEFAULT 0,

    -- Aggregated metrics for tagged clients
    avg_documents DECIMAL(10, 2),
    avg_timeline_events DECIMAL(10, 2),
    avg_activity_score DECIMAL(10, 2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_tag_snapshot UNIQUE (organization_id, tag_id, snapshot_date)
);

-- Scheduled reports
CREATE TABLE scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,

    -- Schedule configuration
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')),
    day_of_week INTEGER, -- 0-6 for weekly
    day_of_month INTEGER, -- 1-31 for monthly
    time_of_day TIME NOT NULL DEFAULT '08:00:00',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Warsaw',

    -- Report configuration
    report_type VARCHAR(50) NOT NULL DEFAULT 'FULL_STATISTICS',
    include_charts BOOLEAN NOT NULL DEFAULT TRUE,
    include_client_list BOOLEAN NOT NULL DEFAULT FALSE,

    -- Recipients
    recipients TEXT[] NOT NULL DEFAULT '{}',

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_sent_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,

    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE client_statistics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_daily_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY stats_cache_org_isolation ON client_statistics_cache
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY snapshots_org_isolation ON client_daily_snapshots
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY tag_stats_org_isolation ON tag_statistics
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY scheduled_reports_org_isolation ON scheduled_reports
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Indexes
CREATE INDEX idx_stats_cache_org_type ON client_statistics_cache(organization_id, metric_type);
CREATE INDEX idx_stats_cache_expires ON client_statistics_cache(expires_at);
CREATE INDEX idx_snapshots_org_date ON client_daily_snapshots(organization_id, snapshot_date DESC);
CREATE INDEX idx_tag_stats_org_date ON tag_statistics(organization_id, snapshot_date DESC);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = TRUE;
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Time range for statistics
export const TimeRangeSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
  granularity: z.enum(['DAY', 'WEEK', 'MONTH']).default('MONTH'),
});

// Portfolio summary
export const PortfolioSummarySchema = z.object({
  totalClients: z.number(),
  activeClients: z.number(),
  inactiveClients: z.number(),
  suspendedClients: z.number(),
  pendingClients: z.number(),
  archivedClients: z.number(),
  newClientsThisMonth: z.number(),
  churnedClientsThisMonth: z.number(),
  netGrowth: z.number(),
  growthRate: z.number(), // percentage
});

// Status distribution
export const StatusDistributionSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'ARCHIVED']),
  count: z.number(),
  percentage: z.number(),
});

// Growth trend data point
export const GrowthDataPointSchema = z.object({
  date: z.coerce.date(),
  totalClients: z.number(),
  newClients: z.number(),
  churnedClients: z.number(),
  netGrowth: z.number(),
});

// Engagement metrics
export const EngagementMetricsSchema = z.object({
  avgDocumentsPerClient: z.number(),
  avgTimelineEventsPerClient: z.number(),
  clientsActiveIn7Days: z.number(),
  clientsActiveIn30Days: z.number(),
  clientsInactiveOver30Days: z.number(),
  totalTimelineEvents: z.number(),
  totalDocuments: z.number(),
});

// Inactive client
export const InactiveClientSchema = z.object({
  id: z.string().uuid(),
  companyName: z.string(),
  nip: z.string().nullable(),
  status: z.string(),
  lastActivityDate: z.coerce.date().nullable(),
  daysSinceActivity: z.number(),
  lastActivityType: z.string().nullable(),
});

// VAT statistics
export const VatStatisticsSchema = z.object({
  vatActive: z.number(),
  vatExempt: z.number(),
  vatNotRegistered: z.number(),
  vatInvalid: z.number(),
  whitelistVerified: z.number(),
  whitelistIssues: z.number(),
  euVatActive: z.number(),
});

// Tax form distribution
export const TaxFormDistributionSchema = z.object({
  taxForm: z.enum(['CIT', 'PIT', 'VAT', 'FLAT_TAX', 'LUMP_SUM']),
  count: z.number(),
  percentage: z.number(),
});

// Tag statistics
export const TagStatisticsSchema = z.object({
  tagId: z.string().uuid(),
  tagName: z.string(),
  tagColor: z.string().nullable(),
  clientCount: z.number(),
  percentage: z.number(),
  avgDocuments: z.number().nullable(),
  avgTimelineEvents: z.number().nullable(),
});

// Activity heatmap data
export const ActivityHeatmapDataSchema = z.object({
  date: z.string(), // YYYY-MM-DD format
  count: z.number(),
  level: z.number().min(0).max(4), // 0-4 intensity level
});

// Compliance issues
export const ComplianceIssuesSchema = z.object({
  invalidVat: z.number(),
  notOnWhitelist: z.number(),
  missingDocuments: z.number(),
  expiredRegistrations: z.number(),
  total: z.number(),
});

// Scheduled report configuration
export const ScheduledReportConfigSchema = z.object({
  name: z.string().min(3).max(100),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/),
  recipients: z.array(z.string().email()).min(1),
  reportType: z.enum(['FULL_STATISTICS', 'ENGAGEMENT', 'COMPLIANCE', 'GROWTH']).default('FULL_STATISTICS'),
  includeCharts: z.boolean().default(true),
  includeClientList: z.boolean().default(false),
});

// Full statistics response
export const FullStatisticsSchema = z.object({
  portfolio: PortfolioSummarySchema,
  statusDistribution: z.array(StatusDistributionSchema),
  growthTrend: z.array(GrowthDataPointSchema),
  engagement: EngagementMetricsSchema,
  vatStatistics: VatStatisticsSchema,
  taxFormDistribution: z.array(TaxFormDistributionSchema),
  tagStatistics: z.array(TagStatisticsSchema),
  complianceIssues: ComplianceIssuesSchema,
  generatedAt: z.coerce.date(),
});
```

### Service Layer

```typescript
// src/server/services/client-statistics.service.ts
import { db } from '@/server/db';
import { subDays, startOfMonth, endOfMonth, format, eachDayOfInterval, eachMonthOfInterval } from 'date-fns';

interface StatisticsContext {
  organizationId: string;
}

export class ClientStatisticsService {
  // =====================
  // Portfolio Summary
  // =====================

  async getPortfolioSummary(ctx: StatisticsContext): Promise<any> {
    const now = new Date();
    const startOfCurrentMonth = startOfMonth(now);
    const endOfCurrentMonth = endOfMonth(now);

    // Get current counts
    const statusCounts = await db.clients.groupBy({
      by: ['status'],
      where: {
        organizationId: ctx.organizationId,
        isDeleted: false,
      },
      _count: { id: true },
    });

    const statusMap = Object.fromEntries(
      statusCounts.map(s => [s.status, s._count.id])
    );

    const totalClients = Object.values(statusMap).reduce((a, b) => a + b, 0);

    // Get new clients this month
    const newClientsThisMonth = await db.clients.count({
      where: {
        organizationId: ctx.organizationId,
        isDeleted: false,
        createdAt: {
          gte: startOfCurrentMonth,
          lte: endOfCurrentMonth,
        },
      },
    });

    // Get churned clients this month (status changed to ARCHIVED or deleted)
    const churnedClientsThisMonth = await db.clients.count({
      where: {
        organizationId: ctx.organizationId,
        OR: [
          {
            status: 'ARCHIVED',
            updatedAt: {
              gte: startOfCurrentMonth,
              lte: endOfCurrentMonth,
            },
          },
          {
            isDeleted: true,
            deletedAt: {
              gte: startOfCurrentMonth,
              lte: endOfCurrentMonth,
            },
          },
        ],
      },
    });

    // Get previous month total for growth rate
    const previousMonthSnapshot = await db.clientDailySnapshots.findFirst({
      where: {
        organizationId: ctx.organizationId,
        snapshotDate: { lt: startOfCurrentMonth },
      },
      orderBy: { snapshotDate: 'desc' },
    });

    const previousTotal = previousMonthSnapshot?.totalClients || totalClients;
    const growthRate = previousTotal > 0
      ? ((totalClients - previousTotal) / previousTotal) * 100
      : 0;

    return {
      totalClients,
      activeClients: statusMap['ACTIVE'] || 0,
      inactiveClients: statusMap['INACTIVE'] || 0,
      suspendedClients: statusMap['SUSPENDED'] || 0,
      pendingClients: statusMap['PENDING'] || 0,
      archivedClients: statusMap['ARCHIVED'] || 0,
      newClientsThisMonth,
      churnedClientsThisMonth,
      netGrowth: newClientsThisMonth - churnedClientsThisMonth,
      growthRate: Math.round(growthRate * 100) / 100,
    };
  }

  // =====================
  // Status Distribution
  // =====================

  async getStatusDistribution(ctx: StatisticsContext): Promise<any[]> {
    const statusCounts = await db.clients.groupBy({
      by: ['status'],
      where: {
        organizationId: ctx.organizationId,
        isDeleted: false,
      },
      _count: { id: true },
    });

    const total = statusCounts.reduce((sum, s) => sum + s._count.id, 0);

    return statusCounts.map(s => ({
      status: s.status,
      count: s._count.id,
      percentage: total > 0 ? Math.round((s._count.id / total) * 10000) / 100 : 0,
    }));
  }

  // =====================
  // Growth Trend
  // =====================

  async getGrowthTrend(
    ctx: StatisticsContext,
    startDate: Date,
    endDate: Date,
    granularity: 'DAY' | 'WEEK' | 'MONTH'
  ): Promise<any[]> {
    // Get daily snapshots within range
    const snapshots = await db.clientDailySnapshots.findMany({
      where: {
        organizationId: ctx.organizationId,
        snapshotDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { snapshotDate: 'asc' },
    });

    // Group by granularity
    if (granularity === 'MONTH') {
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      return months.map(monthStart => {
        const monthEnd = endOfMonth(monthStart);
        const monthSnapshots = snapshots.filter(s => {
          const date = new Date(s.snapshotDate);
          return date >= monthStart && date <= monthEnd;
        });

        const lastSnapshot = monthSnapshots[monthSnapshots.length - 1];
        const firstSnapshot = monthSnapshots[0];

        return {
          date: format(monthStart, 'yyyy-MM'),
          totalClients: lastSnapshot?.totalClients || 0,
          newClients: monthSnapshots.reduce((sum, s) => sum + s.newClients, 0),
          churnedClients: monthSnapshots.reduce((sum, s) => sum + s.churnedClients, 0),
          netGrowth: (lastSnapshot?.totalClients || 0) - (firstSnapshot?.totalClients || 0),
        };
      });
    }

    // Daily granularity
    return snapshots.map(s => ({
      date: format(new Date(s.snapshotDate), 'yyyy-MM-dd'),
      totalClients: s.totalClients,
      newClients: s.newClients,
      churnedClients: s.churnedClients,
      netGrowth: s.newClients - s.churnedClients,
    }));
  }

  // =====================
  // Engagement Metrics
  // =====================

  async getEngagementMetrics(ctx: StatisticsContext): Promise<any> {
    const now = new Date();
    const days7Ago = subDays(now, 7);
    const days30Ago = subDays(now, 30);

    // Get total clients
    const totalClients = await db.clients.count({
      where: {
        organizationId: ctx.organizationId,
        isDeleted: false,
      },
    });

    // Get clients with activity in last 7 days
    const clientsActiveIn7Days = await db.clientTimeline.findMany({
      where: {
        client: { organizationId: ctx.organizationId },
        createdAt: { gte: days7Ago },
      },
      select: { clientId: true },
      distinct: ['clientId'],
    });

    // Get clients with activity in last 30 days
    const clientsActiveIn30Days = await db.clientTimeline.findMany({
      where: {
        client: { organizationId: ctx.organizationId },
        createdAt: { gte: days30Ago },
      },
      select: { clientId: true },
      distinct: ['clientId'],
    });

    // Get total timeline events
    const totalTimelineEvents = await db.clientTimeline.count({
      where: {
        client: { organizationId: ctx.organizationId },
      },
    });

    // Get total documents (assuming documents table exists)
    const totalDocuments = await db.clientDocuments?.count({
      where: {
        client: { organizationId: ctx.organizationId },
      },
    }) || 0;

    const avgDocumentsPerClient = totalClients > 0 ? totalDocuments / totalClients : 0;
    const avgTimelineEventsPerClient = totalClients > 0 ? totalTimelineEvents / totalClients : 0;

    return {
      avgDocumentsPerClient: Math.round(avgDocumentsPerClient * 100) / 100,
      avgTimelineEventsPerClient: Math.round(avgTimelineEventsPerClient * 100) / 100,
      clientsActiveIn7Days: clientsActiveIn7Days.length,
      clientsActiveIn30Days: clientsActiveIn30Days.length,
      clientsInactiveOver30Days: totalClients - clientsActiveIn30Days.length,
      totalTimelineEvents,
      totalDocuments,
    };
  }

  // =====================
  // Inactive Clients
  // =====================

  async getInactiveClients(
    ctx: StatisticsContext,
    inactivityDays: number = 30,
    limit: number = 50
  ): Promise<any[]> {
    const cutoffDate = subDays(new Date(), inactivityDays);

    // Get clients with their last activity
    const clients = await db.clients.findMany({
      where: {
        organizationId: ctx.organizationId,
        isDeleted: false,
        status: { in: ['ACTIVE', 'INACTIVE'] },
      },
      include: {
        timeline: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Filter and sort by inactivity
    const inactiveClients = clients
      .map(client => {
        const lastActivity = client.timeline[0]?.createdAt;
        const daysSinceActivity = lastActivity
          ? Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
          : Infinity;

        return {
          id: client.id,
          companyName: client.companyName,
          nip: client.nip,
          status: client.status,
          lastActivityDate: lastActivity || null,
          daysSinceActivity,
          lastActivityType: client.timeline[0]?.eventType || null,
        };
      })
      .filter(c => c.daysSinceActivity >= inactivityDays)
      .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity)
      .slice(0, limit);

    return inactiveClients;
  }

  // =====================
  // VAT Statistics
  // =====================

  async getVatStatistics(ctx: StatisticsContext): Promise<any> {
    const vatCounts = await db.clients.groupBy({
      by: ['vatStatus'],
      where: {
        organizationId: ctx.organizationId,
        isDeleted: false,
      },
      _count: { id: true },
    });

    const vatMap = Object.fromEntries(
      vatCounts.map(v => [v.vatStatus, v._count.id])
    );

    // Get whitelist status
    const whitelistVerified = await db.clients.count({
      where: {
        organizationId: ctx.organizationId,
        isDeleted: false,
        whiteListStatus: 'VERIFIED',
      },
    });

    const whitelistIssues = await db.clients.count({
      where: {
        organizationId: ctx.organizationId,
        isDeleted: false,
        whiteListStatus: { in: ['NOT_FOUND', 'INVALID'] },
      },
    });

    // Get EU VAT active
    const euVatActive = await db.clients.count({
      where: {
        organizationId: ctx.organizationId,
        isDeleted: false,
        vatEu: { not: null },
        viesStatus: 'VALID',
      },
    });

    return {
      vatActive: vatMap['ACTIVE'] || 0,
      vatExempt: vatMap['EXEMPT'] || 0,
      vatNotRegistered: vatMap['NOT_REGISTERED'] || 0,
      vatInvalid: vatMap['INVALID'] || 0,
      whitelistVerified,
      whitelistIssues,
      euVatActive,
    };
  }

  // =====================
  // Tax Form Distribution
  // =====================

  async getTaxFormDistribution(ctx: StatisticsContext): Promise<any[]> {
    const taxFormCounts = await db.clients.groupBy({
      by: ['taxForm'],
      where: {
        organizationId: ctx.organizationId,
        isDeleted: false,
        taxForm: { not: null },
      },
      _count: { id: true },
    });

    const total = taxFormCounts.reduce((sum, t) => sum + t._count.id, 0);

    return taxFormCounts.map(t => ({
      taxForm: t.taxForm,
      count: t._count.id,
      percentage: total > 0 ? Math.round((t._count.id / total) * 10000) / 100 : 0,
    }));
  }

  // =====================
  // Tag Statistics
  // =====================

  async getTagStatistics(ctx: StatisticsContext): Promise<any[]> {
    const totalClients = await db.clients.count({
      where: {
        organizationId: ctx.organizationId,
        isDeleted: false,
      },
    });

    const tagCounts = await db.$queryRaw<any[]>`
      SELECT
        t.id as "tagId",
        t.name as "tagName",
        t.color as "tagColor",
        COUNT(ct.client_id) as "clientCount",
        AVG(doc_count.count)::DECIMAL(10,2) as "avgDocuments",
        AVG(timeline_count.count)::DECIMAL(10,2) as "avgTimelineEvents"
      FROM tags t
      LEFT JOIN client_tags ct ON t.id = ct.tag_id
      LEFT JOIN clients c ON ct.client_id = c.id AND c.is_deleted = FALSE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as count
        FROM client_documents cd
        WHERE cd.client_id = c.id
      ) doc_count ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as count
        FROM client_timeline ctl
        WHERE ctl.client_id = c.id
      ) timeline_count ON TRUE
      WHERE t.organization_id = ${ctx.organizationId}
      AND t.is_archived = FALSE
      GROUP BY t.id, t.name, t.color
      ORDER BY "clientCount" DESC
    `;

    return tagCounts.map(t => ({
      tagId: t.tagId,
      tagName: t.tagName,
      tagColor: t.tagColor,
      clientCount: Number(t.clientCount),
      percentage: totalClients > 0
        ? Math.round((Number(t.clientCount) / totalClients) * 10000) / 100
        : 0,
      avgDocuments: t.avgDocuments ? Number(t.avgDocuments) : null,
      avgTimelineEvents: t.avgTimelineEvents ? Number(t.avgTimelineEvents) : null,
    }));
  }

  // =====================
  // Activity Heatmap
  // =====================

  async getActivityHeatmap(
    ctx: StatisticsContext,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    // Get daily activity counts
    const activityCounts = await db.$queryRaw<any[]>`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM client_timeline ct
      JOIN clients c ON ct.client_id = c.id
      WHERE c.organization_id = ${ctx.organizationId}
      AND ct.created_at >= ${startDate}
      AND ct.created_at <= ${endDate}
      GROUP BY DATE(created_at)
      ORDER BY date
    `;

    // Find max for normalization
    const maxCount = Math.max(...activityCounts.map(a => Number(a.count)), 1);

    // Generate all days in range
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const countMap = new Map(
      activityCounts.map(a => [format(new Date(a.date), 'yyyy-MM-dd'), Number(a.count)])
    );

    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const count = countMap.get(dateStr) || 0;
      const level = Math.min(Math.floor((count / maxCount) * 4), 4);

      return {
        date: dateStr,
        count,
        level,
      };
    });
  }

  // =====================
  // Compliance Issues
  // =====================

  async getComplianceIssues(ctx: StatisticsContext): Promise<any> {
    const [invalidVat, notOnWhitelist, expiredRegistrations] = await Promise.all([
      db.clients.count({
        where: {
          organizationId: ctx.organizationId,
          isDeleted: false,
          vatStatus: 'INVALID',
        },
      }),
      db.clients.count({
        where: {
          organizationId: ctx.organizationId,
          isDeleted: false,
          vatPayer: true,
          whiteListStatus: { in: ['NOT_FOUND', 'INVALID', null] },
        },
      }),
      db.clients.count({
        where: {
          organizationId: ctx.organizationId,
          isDeleted: false,
          OR: [
            { krsStatus: 'EXPIRED' },
            { regonStatus: 'EXPIRED' },
          ],
        },
      }),
    ]);

    // Missing documents would require document tracking
    const missingDocuments = 0; // Placeholder

    return {
      invalidVat,
      notOnWhitelist,
      missingDocuments,
      expiredRegistrations,
      total: invalidVat + notOnWhitelist + missingDocuments + expiredRegistrations,
    };
  }

  // =====================
  // Generate Daily Snapshot
  // =====================

  async generateDailySnapshot(organizationId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if snapshot already exists
    const existing = await db.clientDailySnapshots.findUnique({
      where: {
        organization_id_snapshot_date: {
          organizationId,
          snapshotDate: today,
        },
      },
    });

    if (existing) return;

    const ctx = { organizationId };

    const [portfolio, vatStats, taxForms, engagement] = await Promise.all([
      this.getPortfolioSummary(ctx),
      this.getVatStatistics(ctx),
      this.getTaxFormDistribution(ctx),
      this.getEngagementMetrics(ctx),
    ]);

    const taxFormMap = Object.fromEntries(
      taxForms.map(t => [t.taxForm, t.count])
    );

    await db.clientDailySnapshots.create({
      data: {
        organizationId,
        snapshotDate: today,
        totalClients: portfolio.totalClients,
        activeClients: portfolio.activeClients,
        inactiveClients: portfolio.inactiveClients,
        suspendedClients: portfolio.suspendedClients,
        pendingClients: portfolio.pendingClients,
        archivedClients: portfolio.archivedClients,
        vatActive: vatStats.vatActive,
        vatExempt: vatStats.vatExempt,
        vatNotRegistered: vatStats.vatNotRegistered,
        vatInvalid: vatStats.vatInvalid,
        whitelistVerified: vatStats.whitelistVerified,
        whitelistIssues: vatStats.whitelistIssues,
        taxFormCit: taxFormMap['CIT'] || 0,
        taxFormPit: taxFormMap['PIT'] || 0,
        taxFormVat: taxFormMap['VAT'] || 0,
        taxFormFlat: taxFormMap['FLAT_TAX'] || 0,
        taxFormLump: taxFormMap['LUMP_SUM'] || 0,
        clientsWithActivity7d: engagement.clientsActiveIn7Days,
        clientsWithActivity30d: engagement.clientsActiveIn30Days,
        totalTimelineEvents: engagement.totalTimelineEvents,
        totalDocuments: engagement.totalDocuments,
        newClients: portfolio.newClientsThisMonth, // Would need daily calculation
        churnedClients: portfolio.churnedClientsThisMonth, // Would need daily calculation
      },
    });
  }
}

export const clientStatisticsService = new ClientStatisticsService();
```

### tRPC Router

```typescript
// src/server/routers/crm/statistics.router.ts
import { router, protectedProcedure, adminProcedure } from '@/server/trpc';
import { z } from 'zod';
import { clientStatisticsService } from '@/server/services/client-statistics.service';
import { TimeRangeSchema, ScheduledReportConfigSchema } from '@/shared/schemas/statistics.schema';
import { subMonths, startOfMonth } from 'date-fns';

export const statisticsRouter = router({
  // Get portfolio summary
  getPortfolioSummary: protectedProcedure
    .query(async ({ ctx }) => {
      return clientStatisticsService.getPortfolioSummary({
        organizationId: ctx.session.organizationId,
      });
    }),

  // Get status distribution
  getStatusDistribution: protectedProcedure
    .query(async ({ ctx }) => {
      return clientStatisticsService.getStatusDistribution({
        organizationId: ctx.session.organizationId,
      });
    }),

  // Get growth trend
  getGrowthTrend: protectedProcedure
    .input(z.object({
      months: z.number().min(1).max(24).default(12),
      granularity: z.enum(['DAY', 'WEEK', 'MONTH']).default('MONTH'),
    }))
    .query(async ({ ctx, input }) => {
      const endDate = new Date();
      const startDate = startOfMonth(subMonths(endDate, input.months - 1));

      return clientStatisticsService.getGrowthTrend(
        { organizationId: ctx.session.organizationId },
        startDate,
        endDate,
        input.granularity
      );
    }),

  // Get engagement metrics
  getEngagementMetrics: protectedProcedure
    .query(async ({ ctx }) => {
      return clientStatisticsService.getEngagementMetrics({
        organizationId: ctx.session.organizationId,
      });
    }),

  // Get inactive clients
  getInactiveClients: protectedProcedure
    .input(z.object({
      inactivityDays: z.number().min(7).max(365).default(30),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      return clientStatisticsService.getInactiveClients(
        { organizationId: ctx.session.organizationId },
        input.inactivityDays,
        input.limit
      );
    }),

  // Get VAT statistics
  getVatStatistics: protectedProcedure
    .query(async ({ ctx }) => {
      return clientStatisticsService.getVatStatistics({
        organizationId: ctx.session.organizationId,
      });
    }),

  // Get tax form distribution
  getTaxFormDistribution: protectedProcedure
    .query(async ({ ctx }) => {
      return clientStatisticsService.getTaxFormDistribution({
        organizationId: ctx.session.organizationId,
      });
    }),

  // Get tag statistics
  getTagStatistics: protectedProcedure
    .query(async ({ ctx }) => {
      return clientStatisticsService.getTagStatistics({
        organizationId: ctx.session.organizationId,
      });
    }),

  // Get activity heatmap
  getActivityHeatmap: protectedProcedure
    .input(z.object({
      months: z.number().min(1).max(12).default(3),
    }))
    .query(async ({ ctx, input }) => {
      const endDate = new Date();
      const startDate = subMonths(endDate, input.months);

      return clientStatisticsService.getActivityHeatmap(
        { organizationId: ctx.session.organizationId },
        startDate,
        endDate
      );
    }),

  // Get compliance issues
  getComplianceIssues: protectedProcedure
    .query(async ({ ctx }) => {
      return clientStatisticsService.getComplianceIssues({
        organizationId: ctx.session.organizationId,
      });
    }),

  // Get full statistics (combined)
  getFullStatistics: protectedProcedure
    .query(async ({ ctx }) => {
      const orgCtx = { organizationId: ctx.session.organizationId };

      const [
        portfolio,
        statusDistribution,
        growthTrend,
        engagement,
        vatStatistics,
        taxFormDistribution,
        tagStatistics,
        complianceIssues,
      ] = await Promise.all([
        clientStatisticsService.getPortfolioSummary(orgCtx),
        clientStatisticsService.getStatusDistribution(orgCtx),
        clientStatisticsService.getGrowthTrend(
          orgCtx,
          startOfMonth(subMonths(new Date(), 11)),
          new Date(),
          'MONTH'
        ),
        clientStatisticsService.getEngagementMetrics(orgCtx),
        clientStatisticsService.getVatStatistics(orgCtx),
        clientStatisticsService.getTaxFormDistribution(orgCtx),
        clientStatisticsService.getTagStatistics(orgCtx),
        clientStatisticsService.getComplianceIssues(orgCtx),
      ]);

      return {
        portfolio,
        statusDistribution,
        growthTrend,
        engagement,
        vatStatistics,
        taxFormDistribution,
        tagStatistics,
        complianceIssues,
        generatedAt: new Date(),
      };
    }),

  // Scheduled reports
  createScheduledReport: adminProcedure
    .input(ScheduledReportConfigSchema)
    .mutation(async ({ ctx, input }) => {
      const report = await ctx.db.scheduledReports.create({
        data: {
          organizationId: ctx.session.organizationId,
          name: input.name,
          frequency: input.frequency,
          dayOfWeek: input.dayOfWeek,
          dayOfMonth: input.dayOfMonth,
          timeOfDay: input.timeOfDay,
          recipients: input.recipients,
          reportType: input.reportType,
          includeCharts: input.includeCharts,
          includeClientList: input.includeClientList,
          createdBy: ctx.session.userId,
          nextRunAt: calculateNextRunAt(input),
        },
      });

      await ctx.audit.log('statistics.report.schedule', {
        reportId: report.id,
        name: input.name,
        frequency: input.frequency,
      });

      return report;
    }),

  listScheduledReports: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.scheduledReports.findMany({
        where: { organizationId: ctx.session.organizationId },
        orderBy: { name: 'asc' },
      });
    }),

  updateScheduledReport: adminProcedure
    .input(z.object({
      reportId: z.string().uuid(),
      updates: ScheduledReportConfigSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      const report = await ctx.db.scheduledReports.update({
        where: { id: input.reportId },
        data: {
          ...input.updates,
          nextRunAt: input.updates.frequency
            ? calculateNextRunAt(input.updates as any)
            : undefined,
          updatedAt: new Date(),
        },
      });

      await ctx.audit.log('statistics.report.update', { reportId: input.reportId });

      return report;
    }),

  deleteScheduledReport: adminProcedure
    .input(z.object({ reportId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.scheduledReports.delete({
        where: { id: input.reportId },
      });

      await ctx.audit.log('statistics.report.delete', { reportId: input.reportId });

      return { success: true };
    }),

  // Export statistics to PDF
  exportStatisticsPdf: protectedProcedure
    .input(z.object({
      sections: z.array(z.enum([
        'portfolio', 'growth', 'engagement', 'vat', 'tags', 'compliance'
      ])).default(['portfolio', 'growth', 'engagement', 'vat', 'tags', 'compliance']),
    }))
    .mutation(async ({ ctx, input }) => {
      // Generate PDF (implementation would use a PDF library like PDFKit)
      const statistics = await clientStatisticsService.getPortfolioSummary({
        organizationId: ctx.session.organizationId,
      });

      await ctx.audit.log('statistics.export', {
        format: 'PDF',
        sections: input.sections,
      });

      // Return URL to generated PDF
      return {
        downloadUrl: `/api/downloads/statistics-${Date.now()}.pdf`,
        generatedAt: new Date(),
      };
    }),
});

function calculateNextRunAt(config: {
  frequency: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay: string;
}): Date {
  const now = new Date();
  const [hours, minutes] = config.timeOfDay.split(':').map(Number);

  const nextRun = new Date(now);
  nextRun.setHours(hours, minutes, 0, 0);

  switch (config.frequency) {
    case 'DAILY':
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;
    case 'WEEKLY':
      const currentDay = now.getDay();
      const targetDay = config.dayOfWeek || 1;
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0 || (daysUntil === 0 && nextRun <= now)) {
        daysUntil += 7;
      }
      nextRun.setDate(nextRun.getDate() + daysUntil);
      break;
    case 'MONTHLY':
      nextRun.setDate(config.dayOfMonth || 1);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;
  }

  return nextRun;
}
```

---

## Test Specification

### Unit Tests

```typescript
// tests/unit/client-statistics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientStatisticsService } from '@/server/services/client-statistics.service';

describe('ClientStatisticsService', () => {
  let service: ClientStatisticsService;

  beforeEach(() => {
    service = new ClientStatisticsService();
    vi.clearAllMocks();
  });

  describe('getPortfolioSummary', () => {
    it('calculates growth rate correctly', async () => {
      // Mock database responses
      const mockStatusCounts = [
        { status: 'ACTIVE', _count: { id: 100 } },
        { status: 'INACTIVE', _count: { id: 20 } },
      ];

      vi.spyOn(db.clients, 'groupBy').mockResolvedValue(mockStatusCounts);
      vi.spyOn(db.clients, 'count')
        .mockResolvedValueOnce(10) // new clients
        .mockResolvedValueOnce(5); // churned clients

      vi.spyOn(db.clientDailySnapshots, 'findFirst').mockResolvedValue({
        totalClients: 110,
      });

      const result = await service.getPortfolioSummary({
        organizationId: 'test-org',
      });

      expect(result.totalClients).toBe(120);
      expect(result.netGrowth).toBe(5);
      expect(result.growthRate).toBeCloseTo(9.09, 1);
    });
  });

  describe('getStatusDistribution', () => {
    it('calculates percentages correctly', async () => {
      vi.spyOn(db.clients, 'groupBy').mockResolvedValue([
        { status: 'ACTIVE', _count: { id: 75 } },
        { status: 'INACTIVE', _count: { id: 25 } },
      ]);

      const result = await service.getStatusDistribution({
        organizationId: 'test-org',
      });

      expect(result).toHaveLength(2);
      expect(result[0].percentage).toBe(75);
      expect(result[1].percentage).toBe(25);
    });
  });

  describe('getInactiveClients', () => {
    it('calculates days since activity correctly', async () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      vi.spyOn(db.clients, 'findMany').mockResolvedValue([
        {
          id: '1',
          companyName: 'Test',
          nip: '123',
          status: 'ACTIVE',
          timeline: [{ createdAt: tenDaysAgo, eventType: 'SYSTEM' }],
        },
      ]);

      const result = await service.getInactiveClients(
        { organizationId: 'test-org' },
        5
      );

      expect(result).toHaveLength(1);
      expect(result[0].daysSinceActivity).toBeGreaterThanOrEqual(10);
    });
  });
});
```

### Integration Tests

```typescript
// tests/integration/statistics.router.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, cleanupTestData } from '../helpers';
import { statisticsRouter } from '@/server/routers/crm/statistics.router';

describe('Statistics Router', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let testOrg: { id: string };

  beforeEach(async () => {
    ctx = await createTestContext();
    testOrg = await ctx.db.organizations.create({
      data: { name: 'Test Org', slug: 'test-org' },
    });
    ctx.session.organizationId = testOrg.id;

    // Create test clients
    await ctx.db.clients.createMany({
      data: [
        { organizationId: testOrg.id, companyName: 'Active 1', status: 'ACTIVE', vatStatus: 'ACTIVE', createdBy: ctx.session.userId },
        { organizationId: testOrg.id, companyName: 'Active 2', status: 'ACTIVE', vatStatus: 'ACTIVE', createdBy: ctx.session.userId },
        { organizationId: testOrg.id, companyName: 'Inactive', status: 'INACTIVE', vatStatus: 'NOT_REGISTERED', createdBy: ctx.session.userId },
      ],
    });
  });

  afterEach(async () => {
    await cleanupTestData(ctx.db);
  });

  describe('getPortfolioSummary', () => {
    it('returns correct counts', async () => {
      const result = await statisticsRouter.getPortfolioSummary({ ctx });

      expect(result.totalClients).toBe(3);
      expect(result.activeClients).toBe(2);
      expect(result.inactiveClients).toBe(1);
    });
  });

  describe('getVatStatistics', () => {
    it('returns correct VAT distribution', async () => {
      const result = await statisticsRouter.getVatStatistics({ ctx });

      expect(result.vatActive).toBe(2);
      expect(result.vatNotRegistered).toBe(1);
    });
  });

  describe('getFullStatistics', () => {
    it('returns all statistics sections', async () => {
      const result = await statisticsRouter.getFullStatistics({ ctx });

      expect(result.portfolio).toBeDefined();
      expect(result.statusDistribution).toBeDefined();
      expect(result.engagement).toBeDefined();
      expect(result.vatStatistics).toBeDefined();
      expect(result.generatedAt).toBeDefined();
    });
  });
});
```

### E2E Tests

```typescript
// tests/e2e/statistics.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Client Statistics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('displays portfolio summary', async ({ page }) => {
    await page.goto('/clients/statistics');

    await expect(page.locator('[data-testid="total-clients"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-clients"]')).toBeVisible();
    await expect(page.locator('[data-testid="growth-rate"]')).toBeVisible();
  });

  test('shows status distribution chart', async ({ page }) => {
    await page.goto('/clients/statistics');

    const chart = page.locator('[data-testid="status-distribution-chart"]');
    await expect(chart).toBeVisible();

    // Verify chart has segments
    await expect(chart.locator('.chart-segment')).toHaveCount({ min: 1 });
  });

  test('displays inactive clients list', async ({ page }) => {
    await page.goto('/clients/statistics');

    await page.click('text=Nieaktywni klienci');

    await expect(page.locator('[data-testid="inactive-clients-table"]')).toBeVisible();
    await expect(page.locator('th:has-text("Dni nieaktywności")')).toBeVisible();
  });

  test('exports statistics to PDF', async ({ page }) => {
    await page.goto('/clients/statistics');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Eksportuj raport")'),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test('creates scheduled report', async ({ page }) => {
    await page.goto('/clients/statistics/reports');

    await page.click('button:has-text("Nowy raport")');

    await page.fill('[name="name"]', 'Tygodniowe statystyki');
    await page.selectOption('[name="frequency"]', 'WEEKLY');
    await page.selectOption('[name="dayOfWeek"]', '1'); // Monday
    await page.fill('[name="timeOfDay"]', '08:00');
    await page.fill('[name="recipients"]', 'manager@firma.pl');

    await page.click('button:has-text("Zapisz")');

    await expect(page.locator('text=Raport został zaplanowany')).toBeVisible();
  });
});
```

---

## Security Checklist

- [x] Row Level Security on statistics tables
- [x] Organization isolation for all queries
- [x] Read-only access for viewer role
- [x] Admin-only for scheduled reports management
- [x] Audit logging for exports and report creation
- [x] Rate limiting on statistics endpoints
- [x] Cache invalidation on data changes
- [x] Sanitized inputs for time ranges

---

## Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `statistics.view` | Dashboard viewed | sections, timeRange |
| `statistics.export` | Report exported | format, sections |
| `statistics.report.schedule` | Report scheduled | reportId, name, frequency |
| `statistics.report.update` | Report updated | reportId |
| `statistics.report.delete` | Report deleted | reportId |
| `statistics.report.sent` | Report emailed | reportId, recipients |

---

## Implementation Notes

### Performance Considerations
- Use daily snapshots for historical trends (avoid real-time aggregation)
- Cache statistics with 5-minute TTL for dashboard
- Pre-compute tag statistics nightly
- Use materialized views for complex aggregations

### Scheduled Jobs
- Daily snapshot generation at 00:05 local time
- Scheduled report execution based on configured times
- Cache cleanup for expired statistics

### Chart Libraries
- Recharts for React charts (line, bar, pie)
- Calendar heatmap with custom component
- Export charts as images for PDF reports

---

*Story created: December 2024*
*Template version: 1.0*
