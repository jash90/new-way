# TAX-012: Tax Compliance Reports

> **Story ID**: TAX-012
> **Epic**: Tax Compliance Module (TAX)
> **Priority**: P1
> **Story Points**: 8
> **Status**: 📋 Ready for Development
> **Sprint**: Week 16

---

## User Story

**As an** accountant,
**I want** comprehensive tax compliance reports,
**So that** I can monitor compliance status and provide clients with clear tax obligation summaries.

---

## Description

The Tax Compliance Reports feature provides accountants with a comprehensive dashboard and reporting system to monitor the compliance status of all clients. It aggregates data from VAT, CIT/PIT, ZUS calculations and filings to present a unified view of tax obligations, deadlines, risks, and historical performance. Reports can be generated in multiple formats for client presentations and audit purposes.

### Business Value

- **Compliance Monitoring**: Real-time visibility into all client obligations
- **Risk Identification**: Early warning for potential compliance issues
- **Client Communication**: Professional reports for client meetings
- **Audit Readiness**: Historical filing records readily available
- **Efficiency**: Centralized view replaces manual tracking

### Success Metrics

- Dashboard load time <2s
- Report generation time <5s for PDF
- 100% accuracy of obligation tracking
- Zero missed deadlines with proper alert usage
- Client satisfaction score ≥4.5/5 on report quality

---

## Acceptance Criteria

### Scenario 1: View Compliance Status Overview
```gherkin
Given I am logged in as an accountant
When I navigate to the compliance dashboard
Then I see an overview showing:
  | Metric                    | Description                          |
  | Total clients             | Number of active clients             |
  | Compliant clients         | Clients with all obligations met     |
  | At-risk clients           | Clients with upcoming deadlines      |
  | Non-compliant clients     | Clients with missed obligations      |
  | Upcoming deadlines        | Deadlines in next 7/14/30 days       |
  | Recent submissions        | Last 10 submissions with status      |
And each metric is clickable to drill down to details
And the overview refreshes in real-time
```

### Scenario 2: View Obligation Checklist for Client
```gherkin
Given I am viewing a specific client's compliance report
When I view the obligation checklist
Then I see a comprehensive list of tax obligations:
  | Obligation Type    | Period   | Status    | Due Date   | Filed Date |
  | JPK_V7M           | 01/2024  | Submitted | 25.02.2024 | 22.02.2024 |
  | JPK_V7M           | 02/2024  | Pending   | 25.03.2024 | -          |
  | CIT Advance       | Q1/2024  | Due Soon  | 20.04.2024 | -          |
  | ZUS DRA           | 02/2024  | Submitted | 15.03.2024 | 14.03.2024 |
And obligations are grouped by tax type (VAT, CIT, PIT, ZUS)
And status indicators show: Submitted, Pending, Due Soon, Overdue
And I can filter by period, status, or tax type
```

### Scenario 3: View Risk Assessment
```gherkin
Given I am viewing the compliance dashboard
When I view the risk assessment section
Then I see risk indicators for each client:
  | Risk Factor                | Weight | Assessment                    |
  | Late filing history        | 25%    | Based on past 12 months       |
  | Payment delays             | 20%    | Based on payment timeliness   |
  | Correction frequency       | 15%    | Number of JPK corrections     |
  | White list compliance      | 20%    | Large payment verification    |
  | Documentation completeness | 20%    | Missing invoices/documents    |
And overall risk score is calculated (Low, Medium, High, Critical)
And high-risk clients are highlighted prominently
And risk trends are shown (improving, stable, declining)
```

### Scenario 4: View Deadline Calendar
```gherkin
Given I am viewing the compliance dashboard
When I view the deadline calendar
Then I see a calendar with all upcoming tax deadlines:
  | Date       | Client          | Obligation  | Status        |
  | 15.03.2024 | ABC Sp. z o.o. | ZUS DRA     | Due           |
  | 20.03.2024 | XYZ JDG        | PIT Advance | Due           |
  | 25.03.2024 | ABC Sp. z o.o. | JPK_V7M     | Upcoming      |
  | 25.03.2024 | XYZ JDG        | JPK_V7M     | Upcoming      |
And I can view by day, week, month, or quarter
And weekends and Polish holidays are marked
And overdue items are highlighted in red
And I can set reminder preferences for each deadline type
```

### Scenario 5: View Historical Filings
```gherkin
Given I am viewing a client's compliance report
When I view historical filings
Then I see a complete history of all tax submissions:
  | Filing ID    | Type     | Period   | Submitted   | Status   | UPO Number  |
  | JPK-2024-001 | JPK_V7M  | 01/2024  | 22.02.2024  | Accepted | 12345678    |
  | ZUS-2024-002 | DRA      | 01/2024  | 14.02.2024  | Accepted | ZUS-98765   |
  | CIT-2023-001 | CIT-8    | 2023     | 28.03.2024  | Accepted | 87654321    |
And I can download original filing documents
And I can view submission details and responses
And filings can be filtered by year, type, or status
And corrections are linked to original filings
```

### Scenario 6: Export Report to PDF
```gherkin
Given I am viewing a compliance report
When I export the report to PDF format
Then a professional PDF document is generated containing:
  | Section                    | Content                              |
  | Cover page                 | Client name, period, generation date |
  | Executive summary          | Key compliance metrics               |
  | Obligation status          | Full checklist with statuses         |
  | Risk assessment            | Risk factors and recommendations     |
  | Deadline calendar          | Upcoming obligations                 |
  | Historical filings         | Archive of submissions               |
  | Appendices                 | Supporting documentation             |
And the PDF is branded with accounting firm identity
And the PDF includes page numbers and table of contents
And generation completes within 5 seconds
```

### Scenario 7: Export Report to Excel
```gherkin
Given I am viewing a compliance report
When I export the report to Excel format
Then an Excel workbook is generated containing:
  | Sheet                      | Content                              |
  | Summary                    | Key metrics and KPIs                 |
  | Obligations                | Full obligation list with formulas   |
  | Deadlines                  | Calendar data with conditional format|
  | Historical Filings         | Complete filing archive              |
  | Risk Analysis              | Risk scores and calculations         |
And data is properly formatted for further analysis
And formulas are included for custom calculations
And pivot table-ready data structure
```

### Scenario 8: Configure Report Preferences
```gherkin
Given I am an accountant configuring report settings
When I access report preferences
Then I can configure:
  | Setting                    | Options                              |
  | Default period             | Current month/quarter/year           |
  | Sections to include        | Toggle each report section           |
  | Risk thresholds            | Custom thresholds for risk levels    |
  | Deadline warning days      | Days before deadline for alerts      |
  | Branding                   | Logo, colors, contact information    |
  | Language                   | Polish or English                    |
  | Automatic generation       | Schedule periodic report generation  |
And preferences are saved per organization
And templates can be created for different report types
```

---

## Technical Specification

### Database Schema

```sql
-- Compliance reports
CREATE TABLE tax_compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID REFERENCES clients(id), -- NULL for org-wide reports

  -- Report metadata
  report_type VARCHAR(30) NOT NULL
    CHECK (report_type IN ('client_detail', 'client_summary', 'organization_overview',
                            'deadline_calendar', 'risk_assessment', 'historical_archive')),
  period_type VARCHAR(20) NOT NULL
    CHECK (period_type IN ('month', 'quarter', 'year', 'custom')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Report content (cached)
  report_data JSONB NOT NULL DEFAULT '{}',
  summary_metrics JSONB NOT NULL DEFAULT '{}',

  -- Generation metadata
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID NOT NULL REFERENCES users(id),
  generation_time_ms INTEGER,

  -- Export information
  last_exported_at TIMESTAMPTZ,
  export_format VARCHAR(10),
  export_url VARCHAR(500),
  export_expires_at TIMESTAMPTZ,

  -- Validity
  valid_until TIMESTAMPTZ, -- When data becomes stale
  is_current BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compliance obligations tracking
CREATE TABLE tax_compliance_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID NOT NULL REFERENCES clients(id),

  -- Obligation identification
  obligation_type VARCHAR(30) NOT NULL
    CHECK (obligation_type IN ('jpk_v7m', 'jpk_v7k', 'jpk_fa', 'cit_advance',
                                'cit_annual', 'pit_advance', 'pit_annual',
                                'zus_dra', 'zus_rca', 'vat_ue', 'intrastat',
                                'pit_11', 'pit_4r', 'pit_8ar', 'cit_8')),

  -- Period
  period_year INTEGER NOT NULL,
  period_month INTEGER, -- NULL for annual obligations
  period_quarter INTEGER, -- For quarterly obligations

  -- Dates
  due_date DATE NOT NULL,
  warning_date DATE, -- When to start warning
  filed_date DATE,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'due_soon', 'overdue', 'filed', 'accepted',
                       'rejected', 'correcting', 'exempt', 'not_applicable')),

  -- Filing reference
  filing_id UUID, -- Reference to actual filing (JPK, ZUS declaration, etc.)
  upo_number VARCHAR(100),
  confirmation_date TIMESTAMPTZ,

  -- Amounts (if applicable)
  calculated_amount DECIMAL(15, 2),
  filed_amount DECIMAL(15, 2),
  paid_amount DECIMAL(15, 2),
  payment_date DATE,

  -- Correction tracking
  is_correction BOOLEAN NOT NULL DEFAULT false,
  corrects_obligation_id UUID REFERENCES tax_compliance_obligations(id),
  correction_reason TEXT,

  -- Notes
  notes TEXT,
  internal_notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),

  CONSTRAINT unique_client_obligation_period
    UNIQUE (client_id, obligation_type, period_year, period_month, period_quarter, is_correction)
);

-- Risk assessments
CREATE TABLE tax_compliance_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID NOT NULL REFERENCES clients(id),

  -- Assessment period
  assessment_date DATE NOT NULL,
  assessment_period_start DATE NOT NULL,
  assessment_period_end DATE NOT NULL,

  -- Risk scores (0-100)
  late_filing_score INTEGER NOT NULL CHECK (late_filing_score BETWEEN 0 AND 100),
  payment_delay_score INTEGER NOT NULL CHECK (payment_delay_score BETWEEN 0 AND 100),
  correction_frequency_score INTEGER NOT NULL CHECK (correction_frequency_score BETWEEN 0 AND 100),
  white_list_score INTEGER NOT NULL CHECK (white_list_score BETWEEN 0 AND 100),
  documentation_score INTEGER NOT NULL CHECK (documentation_score BETWEEN 0 AND 100),

  -- Calculated overall score
  overall_score DECIMAL(5, 2) NOT NULL,
  risk_level VARCHAR(20) NOT NULL
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),

  -- Trend
  previous_score DECIMAL(5, 2),
  trend VARCHAR(20)
    CHECK (trend IN ('improving', 'stable', 'declining')),

  -- Details
  risk_factors JSONB NOT NULL DEFAULT '[]',
  -- [{ "factor": "...", "description": "...", "impact": "high" }]

  recommendations JSONB NOT NULL DEFAULT '[]',
  -- [{ "action": "...", "priority": "high", "deadline": "..." }]

  -- Metadata
  calculated_by VARCHAR(20) NOT NULL DEFAULT 'system'
    CHECK (calculated_by IN ('system', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Report templates
CREATE TABLE tax_compliance_report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Template info
  name VARCHAR(200) NOT NULL,
  description TEXT,
  report_type VARCHAR(30) NOT NULL,

  -- Configuration
  sections_config JSONB NOT NULL DEFAULT '{}',
  -- {
  --   "summary": { "enabled": true, "title": "..." },
  --   "obligations": { "enabled": true, "filter": {...} },
  --   "risk": { "enabled": true },
  --   "calendar": { "enabled": true, "range_days": 30 },
  --   "history": { "enabled": true, "limit": 50 }
  -- }

  risk_thresholds JSONB NOT NULL DEFAULT '{}',
  -- { "low": 25, "medium": 50, "high": 75, "critical": 90 }

  -- Branding
  branding_config JSONB DEFAULT '{}',
  -- { "logo_url": "...", "primary_color": "#...", "footer_text": "..." }

  -- Localization
  language VARCHAR(5) NOT NULL DEFAULT 'pl',

  -- Scheduling
  auto_generate BOOLEAN NOT NULL DEFAULT false,
  schedule_cron VARCHAR(100), -- e.g., "0 9 1 * *" for monthly
  schedule_recipients JSONB DEFAULT '[]',

  -- Status
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id)
);

-- Report generation history
CREATE TABLE tax_compliance_report_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES tax_compliance_reports(id),

  -- Generation details
  format VARCHAR(10) NOT NULL CHECK (format IN ('pdf', 'xlsx', 'csv', 'html')),
  file_url VARCHAR(500),
  file_size_bytes INTEGER,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error_message TEXT,

  -- Delivery
  delivered_to JSONB DEFAULT '[]', -- Email addresses
  delivered_at TIMESTAMPTZ,

  -- Metadata
  requested_by UUID NOT NULL REFERENCES users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Dashboard snapshots for quick loading
CREATE TABLE tax_compliance_dashboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Snapshot data
  snapshot_date DATE NOT NULL,

  -- Aggregated metrics
  total_clients INTEGER NOT NULL,
  compliant_clients INTEGER NOT NULL,
  at_risk_clients INTEGER NOT NULL,
  non_compliant_clients INTEGER NOT NULL,

  -- Deadline counts
  deadlines_7_days INTEGER NOT NULL,
  deadlines_14_days INTEGER NOT NULL,
  deadlines_30_days INTEGER NOT NULL,
  overdue_count INTEGER NOT NULL,

  -- Recent activity
  recent_submissions JSONB NOT NULL DEFAULT '[]',

  -- Risk distribution
  risk_distribution JSONB NOT NULL DEFAULT '{}',
  -- { "low": 10, "medium": 5, "high": 2, "critical": 0 }

  -- Per tax type stats
  vat_stats JSONB NOT NULL DEFAULT '{}',
  cit_stats JSONB NOT NULL DEFAULT '{}',
  pit_stats JSONB NOT NULL DEFAULT '{}',
  zus_stats JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_org_snapshot_date UNIQUE (organization_id, snapshot_date)
);

-- Indexes
CREATE INDEX idx_compliance_reports_org ON tax_compliance_reports(organization_id);
CREATE INDEX idx_compliance_reports_client ON tax_compliance_reports(client_id);
CREATE INDEX idx_compliance_reports_type ON tax_compliance_reports(report_type);
CREATE INDEX idx_compliance_obligations_client ON tax_compliance_obligations(client_id);
CREATE INDEX idx_compliance_obligations_due ON tax_compliance_obligations(due_date);
CREATE INDEX idx_compliance_obligations_status ON tax_compliance_obligations(status);
CREATE INDEX idx_compliance_risk_client ON tax_compliance_risk_assessments(client_id);
CREATE INDEX idx_compliance_risk_date ON tax_compliance_risk_assessments(assessment_date);
CREATE INDEX idx_compliance_snapshot_org_date ON tax_compliance_dashboard_snapshots(organization_id, snapshot_date DESC);

-- Row Level Security
ALTER TABLE tax_compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_compliance_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_compliance_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_compliance_report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_compliance_report_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_compliance_dashboard_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own organization compliance reports"
  ON tax_compliance_reports FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY "Users can access own organization obligations"
  ON tax_compliance_obligations FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY "Users can access own organization risk assessments"
  ON tax_compliance_risk_assessments FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY "Users can access own organization templates"
  ON tax_compliance_report_templates FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY "Users can access own organization snapshots"
  ON tax_compliance_dashboard_snapshots FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::UUID);
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Obligation type enum
export const ObligationTypeSchema = z.enum([
  'jpk_v7m', 'jpk_v7k', 'jpk_fa', 'cit_advance', 'cit_annual',
  'pit_advance', 'pit_annual', 'zus_dra', 'zus_rca', 'vat_ue',
  'intrastat', 'pit_11', 'pit_4r', 'pit_8ar', 'cit_8'
]);

export type ObligationType = z.infer<typeof ObligationTypeSchema>;

// Obligation status enum
export const ObligationStatusSchema = z.enum([
  'pending', 'due_soon', 'overdue', 'filed', 'accepted',
  'rejected', 'correcting', 'exempt', 'not_applicable'
]);

export type ObligationStatus = z.infer<typeof ObligationStatusSchema>;

// Risk level enum
export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// Report type enum
export const ReportTypeSchema = z.enum([
  'client_detail', 'client_summary', 'organization_overview',
  'deadline_calendar', 'risk_assessment', 'historical_archive'
]);

export type ReportType = z.infer<typeof ReportTypeSchema>;

// Period type enum
export const PeriodTypeSchema = z.enum(['month', 'quarter', 'year', 'custom']);
export type PeriodType = z.infer<typeof PeriodTypeSchema>;

// Dashboard request schema
export const GetDashboardSchema = z.object({
  forceRefresh: z.boolean().default(false)
});

export type GetDashboardInput = z.infer<typeof GetDashboardSchema>;

// Dashboard response schema
export const DashboardResponseSchema = z.object({
  snapshotDate: z.string(),
  totalClients: z.number(),
  compliantClients: z.number(),
  atRiskClients: z.number(),
  nonCompliantClients: z.number(),
  deadlines7Days: z.number(),
  deadlines14Days: z.number(),
  deadlines30Days: z.number(),
  overdueCount: z.number(),
  recentSubmissions: z.array(z.object({
    clientName: z.string(),
    obligationType: ObligationTypeSchema,
    period: z.string(),
    status: ObligationStatusSchema,
    filedDate: z.string().optional()
  })),
  riskDistribution: z.record(z.number()),
  vatStats: z.object({
    pending: z.number(),
    filed: z.number(),
    overdue: z.number()
  }),
  citStats: z.object({
    pending: z.number(),
    filed: z.number(),
    overdue: z.number()
  }),
  pitStats: z.object({
    pending: z.number(),
    filed: z.number(),
    overdue: z.number()
  }),
  zusStats: z.object({
    pending: z.number(),
    filed: z.number(),
    overdue: z.number()
  })
});

export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;

// Obligation list request schema
export const GetObligationsSchema = z.object({
  clientId: z.string().uuid().optional(),
  obligationType: ObligationTypeSchema.optional(),
  status: ObligationStatusSchema.optional(),
  periodYear: z.number().int().optional(),
  periodMonth: z.number().int().min(1).max(12).optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  limit: z.number().int().min(1).max(500).default(100),
  offset: z.number().int().min(0).default(0)
});

export type GetObligationsInput = z.infer<typeof GetObligationsSchema>;

// Obligation response schema
export const ObligationSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  clientName: z.string(),
  obligationType: ObligationTypeSchema,
  periodYear: z.number(),
  periodMonth: z.number().nullable(),
  periodQuarter: z.number().nullable(),
  periodLabel: z.string(),
  dueDate: z.string(),
  warningDate: z.string().nullable(),
  filedDate: z.string().nullable(),
  status: ObligationStatusSchema,
  filingId: z.string().uuid().nullable(),
  upoNumber: z.string().nullable(),
  calculatedAmount: z.number().nullable(),
  filedAmount: z.number().nullable(),
  paidAmount: z.number().nullable(),
  isCorrection: z.boolean(),
  notes: z.string().nullable()
});

export type Obligation = z.infer<typeof ObligationSchema>;

// Risk assessment request schema
export const GetRiskAssessmentSchema = z.object({
  clientId: z.string().uuid().optional(),
  assessmentDate: z.string().optional(),
  riskLevel: RiskLevelSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50)
});

export type GetRiskAssessmentInput = z.infer<typeof GetRiskAssessmentSchema>;

// Risk assessment response schema
export const RiskAssessmentResponseSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  clientName: z.string(),
  assessmentDate: z.string(),
  scores: z.object({
    lateFiling: z.number(),
    paymentDelay: z.number(),
    correctionFrequency: z.number(),
    whiteList: z.number(),
    documentation: z.number()
  }),
  overallScore: z.number(),
  riskLevel: RiskLevelSchema,
  trend: z.enum(['improving', 'stable', 'declining']).nullable(),
  riskFactors: z.array(z.object({
    factor: z.string(),
    description: z.string(),
    impact: z.enum(['low', 'medium', 'high'])
  })),
  recommendations: z.array(z.object({
    action: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
    deadline: z.string().optional()
  }))
});

export type RiskAssessmentResponse = z.infer<typeof RiskAssessmentResponseSchema>;

// Calendar request schema
export const GetCalendarSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  clientId: z.string().uuid().optional(),
  obligationTypes: z.array(ObligationTypeSchema).optional()
});

export type GetCalendarInput = z.infer<typeof GetCalendarSchema>;

// Calendar event schema
export const CalendarEventSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  clientId: z.string().uuid(),
  clientName: z.string(),
  obligationType: ObligationTypeSchema,
  obligationLabel: z.string(),
  period: z.string(),
  status: ObligationStatusSchema,
  isHoliday: z.boolean(),
  isWeekend: z.boolean(),
  daysUntilDue: z.number()
});

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

// Historical filings request schema
export const GetHistoricalFilingsSchema = z.object({
  clientId: z.string().uuid(),
  obligationType: ObligationTypeSchema.optional(),
  periodYear: z.number().int().optional(),
  status: z.enum(['accepted', 'rejected', 'all']).default('all'),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0)
});

export type GetHistoricalFilingsInput = z.infer<typeof GetHistoricalFilingsSchema>;

// Historical filing schema
export const HistoricalFilingSchema = z.object({
  id: z.string().uuid(),
  filingId: z.string(),
  obligationType: ObligationTypeSchema,
  period: z.string(),
  submittedAt: z.string(),
  status: z.string(),
  upoNumber: z.string().nullable(),
  fileUrl: z.string().nullable(),
  filedAmount: z.number().nullable(),
  correctionOf: z.string().nullable(),
  correctedBy: z.array(z.string())
});

export type HistoricalFiling = z.infer<typeof HistoricalFilingSchema>;

// Generate report request schema
export const GenerateReportSchema = z.object({
  reportType: ReportTypeSchema,
  clientId: z.string().uuid().optional(),
  periodType: PeriodTypeSchema,
  periodStart: z.string(),
  periodEnd: z.string(),
  format: z.enum(['pdf', 'xlsx', 'csv', 'html']).default('pdf'),
  templateId: z.string().uuid().optional(),
  language: z.enum(['pl', 'en']).default('pl'),
  sections: z.object({
    summary: z.boolean().default(true),
    obligations: z.boolean().default(true),
    risk: z.boolean().default(true),
    calendar: z.boolean().default(true),
    history: z.boolean().default(true)
  }).optional(),
  deliverTo: z.array(z.string().email()).optional()
});

export type GenerateReportInput = z.infer<typeof GenerateReportSchema>;

// Report template schema
export const ReportTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  reportType: ReportTypeSchema,
  sectionsConfig: z.record(z.any()),
  riskThresholds: z.object({
    low: z.number(),
    medium: z.number(),
    high: z.number(),
    critical: z.number()
  }),
  brandingConfig: z.object({
    logoUrl: z.string().optional(),
    primaryColor: z.string().optional(),
    footerText: z.string().optional()
  }).optional(),
  language: z.string(),
  autoGenerate: z.boolean(),
  scheduleCron: z.string().nullable(),
  isDefault: z.boolean(),
  isActive: z.boolean()
});

export type ReportTemplate = z.infer<typeof ReportTemplateSchema>;

// Create/update template schema
export const SaveTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  reportType: ReportTypeSchema,
  sectionsConfig: z.record(z.any()),
  riskThresholds: z.object({
    low: z.number().min(0).max(100),
    medium: z.number().min(0).max(100),
    high: z.number().min(0).max(100),
    critical: z.number().min(0).max(100)
  }).optional(),
  brandingConfig: z.object({
    logoUrl: z.string().url().optional(),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    footerText: z.string().max(500).optional()
  }).optional(),
  language: z.enum(['pl', 'en']).default('pl'),
  autoGenerate: z.boolean().default(false),
  scheduleCron: z.string().optional(),
  scheduleRecipients: z.array(z.string().email()).optional(),
  isDefault: z.boolean().default(false)
});

export type SaveTemplateInput = z.infer<typeof SaveTemplateSchema>;
```

### Service Implementation

```typescript
import { db } from '@/lib/db';
import { TRPCError } from '@trpc/server';
import { generatePDF, generateExcel, generateCSV } from '@/lib/reports';
import { sendEmail } from '@/lib/email';
import {
  GetDashboardInput,
  DashboardResponse,
  GetObligationsInput,
  Obligation,
  GetRiskAssessmentInput,
  RiskAssessmentResponse,
  GetCalendarInput,
  CalendarEvent,
  GetHistoricalFilingsInput,
  HistoricalFiling,
  GenerateReportInput,
  SaveTemplateInput,
  ReportTemplate,
  ObligationType,
  RiskLevel
} from './compliance-reports.schemas';

// Polish holidays for calendar
const POLISH_HOLIDAYS_2024 = [
  '2024-01-01', // Nowy Rok
  '2024-01-06', // Trzech Króli
  '2024-03-31', // Wielkanoc
  '2024-04-01', // Poniedziałek Wielkanocny
  '2024-05-01', // Święto Pracy
  '2024-05-03', // Święto Konstytucji
  '2024-05-19', // Zesłanie Ducha Świętego
  '2024-05-30', // Boże Ciało
  '2024-08-15', // Wniebowzięcie NMP
  '2024-11-01', // Wszystkich Świętych
  '2024-11-11', // Święto Niepodległości
  '2024-12-25', // Boże Narodzenie
  '2024-12-26'  // Drugi dzień Bożego Narodzenia
];

// Obligation type labels
const OBLIGATION_LABELS: Record<ObligationType, { pl: string; en: string }> = {
  jpk_v7m: { pl: 'JPK_V7M (VAT miesięczny)', en: 'JPK_V7M (Monthly VAT)' },
  jpk_v7k: { pl: 'JPK_V7K (VAT kwartalny)', en: 'JPK_V7K (Quarterly VAT)' },
  jpk_fa: { pl: 'JPK_FA (Faktury)', en: 'JPK_FA (Invoices)' },
  cit_advance: { pl: 'Zaliczka CIT', en: 'CIT Advance' },
  cit_annual: { pl: 'CIT-8 (roczny)', en: 'CIT-8 (Annual)' },
  pit_advance: { pl: 'Zaliczka PIT', en: 'PIT Advance' },
  pit_annual: { pl: 'PIT-36 (roczny)', en: 'PIT-36 (Annual)' },
  zus_dra: { pl: 'ZUS DRA', en: 'ZUS DRA' },
  zus_rca: { pl: 'ZUS RCA', en: 'ZUS RCA' },
  vat_ue: { pl: 'VAT-UE', en: 'VAT-EU' },
  intrastat: { pl: 'Intrastat', en: 'Intrastat' },
  pit_11: { pl: 'PIT-11', en: 'PIT-11' },
  pit_4r: { pl: 'PIT-4R', en: 'PIT-4R' },
  pit_8ar: { pl: 'PIT-8AR', en: 'PIT-8AR' },
  cit_8: { pl: 'CIT-8', en: 'CIT-8' }
};

// Risk weights
const RISK_WEIGHTS = {
  lateFiling: 0.25,
  paymentDelay: 0.20,
  correctionFrequency: 0.15,
  whiteList: 0.20,
  documentation: 0.20
};

// Default risk thresholds
const DEFAULT_RISK_THRESHOLDS = {
  low: 25,
  medium: 50,
  high: 75,
  critical: 90
};

export class TaxComplianceReportsService {
  /**
   * Get compliance dashboard data
   */
  async getDashboard(
    input: GetDashboardInput,
    organizationId: string
  ): Promise<DashboardResponse> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check for existing snapshot
    if (!input.forceRefresh) {
      const snapshot = await db.taxComplianceDashboardSnapshot.findFirst({
        where: {
          organizationId,
          snapshotDate: today
        }
      });

      if (snapshot) {
        return this.mapSnapshotToResponse(snapshot);
      }
    }

    // Generate fresh data
    const dashboardData = await this.generateDashboardData(organizationId, today);

    // Save snapshot
    await db.taxComplianceDashboardSnapshot.upsert({
      where: {
        organizationId_snapshotDate: {
          organizationId,
          snapshotDate: today
        }
      },
      create: {
        organizationId,
        snapshotDate: today,
        ...dashboardData
      },
      update: dashboardData
    });

    return this.mapSnapshotToResponse({ snapshotDate: today, ...dashboardData });
  }

  /**
   * Generate fresh dashboard data
   */
  private async generateDashboardData(
    organizationId: string,
    today: Date
  ): Promise<any> {
    const [
      totalClients,
      obligations,
      riskAssessments,
      recentSubmissions
    ] = await Promise.all([
      db.client.count({ where: { organizationId, isActive: true } }),
      db.taxComplianceObligation.findMany({
        where: { organizationId },
        include: { client: { select: { name: true } } }
      }),
      db.taxComplianceRiskAssessment.findMany({
        where: {
          organizationId,
          assessmentDate: {
            gte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        orderBy: { assessmentDate: 'desc' },
        distinct: ['clientId']
      }),
      db.taxComplianceObligation.findMany({
        where: {
          organizationId,
          status: { in: ['filed', 'accepted'] },
          filedDate: { not: null }
        },
        orderBy: { filedDate: 'desc' },
        take: 10,
        include: { client: { select: { name: true } } }
      })
    ]);

    // Calculate deadline counts
    const day7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const day14 = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const day30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const pendingObligations = obligations.filter(o =>
      ['pending', 'due_soon'].includes(o.status)
    );

    const deadlines7Days = pendingObligations.filter(o =>
      new Date(o.dueDate) <= day7
    ).length;

    const deadlines14Days = pendingObligations.filter(o =>
      new Date(o.dueDate) <= day14
    ).length;

    const deadlines30Days = pendingObligations.filter(o =>
      new Date(o.dueDate) <= day30
    ).length;

    const overdueCount = obligations.filter(o => o.status === 'overdue').length;

    // Calculate client compliance status
    const clientStatuses = new Map<string, string>();
    for (const obligation of obligations) {
      const current = clientStatuses.get(obligation.clientId) || 'compliant';
      if (obligation.status === 'overdue') {
        clientStatuses.set(obligation.clientId, 'non_compliant');
      } else if (
        obligation.status === 'due_soon' &&
        current !== 'non_compliant'
      ) {
        clientStatuses.set(obligation.clientId, 'at_risk');
      }
    }

    const compliantClients = Array.from(clientStatuses.values())
      .filter(s => s === 'compliant').length;
    const atRiskClients = Array.from(clientStatuses.values())
      .filter(s => s === 'at_risk').length;
    const nonCompliantClients = Array.from(clientStatuses.values())
      .filter(s => s === 'non_compliant').length;

    // Risk distribution
    const riskDistribution = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    for (const assessment of riskAssessments) {
      riskDistribution[assessment.riskLevel as RiskLevel]++;
    }

    // Tax type stats
    const calculateStats = (types: ObligationType[]) => {
      const filtered = obligations.filter(o =>
        types.includes(o.obligationType as ObligationType)
      );
      return {
        pending: filtered.filter(o =>
          ['pending', 'due_soon'].includes(o.status)
        ).length,
        filed: filtered.filter(o =>
          ['filed', 'accepted'].includes(o.status)
        ).length,
        overdue: filtered.filter(o => o.status === 'overdue').length
      };
    };

    return {
      totalClients,
      compliantClients,
      atRiskClients,
      nonCompliantClients,
      deadlines7Days,
      deadlines14Days,
      deadlines30Days,
      overdueCount,
      recentSubmissions: recentSubmissions.map(s => ({
        clientName: s.client.name,
        obligationType: s.obligationType,
        period: this.formatPeriod(s.periodYear, s.periodMonth, s.periodQuarter),
        status: s.status,
        filedDate: s.filedDate?.toISOString()
      })),
      riskDistribution,
      vatStats: calculateStats(['jpk_v7m', 'jpk_v7k', 'vat_ue']),
      citStats: calculateStats(['cit_advance', 'cit_annual', 'cit_8']),
      pitStats: calculateStats(['pit_advance', 'pit_annual', 'pit_11', 'pit_4r', 'pit_8ar']),
      zusStats: calculateStats(['zus_dra', 'zus_rca'])
    };
  }

  /**
   * Get obligations list
   */
  async getObligations(
    input: GetObligationsInput,
    organizationId: string
  ): Promise<{ obligations: Obligation[]; total: number }> {
    const where: any = { organizationId };

    if (input.clientId) where.clientId = input.clientId;
    if (input.obligationType) where.obligationType = input.obligationType;
    if (input.status) where.status = input.status;
    if (input.periodYear) where.periodYear = input.periodYear;
    if (input.periodMonth) where.periodMonth = input.periodMonth;

    if (input.dueDateFrom || input.dueDateTo) {
      where.dueDate = {};
      if (input.dueDateFrom) where.dueDate.gte = new Date(input.dueDateFrom);
      if (input.dueDateTo) where.dueDate.lte = new Date(input.dueDateTo);
    }

    const [obligations, total] = await Promise.all([
      db.taxComplianceObligation.findMany({
        where,
        include: { client: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        skip: input.offset,
        take: input.limit
      }),
      db.taxComplianceObligation.count({ where })
    ]);

    return {
      obligations: obligations.map(o => this.mapObligation(o)),
      total
    };
  }

  /**
   * Get risk assessments
   */
  async getRiskAssessments(
    input: GetRiskAssessmentInput,
    organizationId: string
  ): Promise<RiskAssessmentResponse[]> {
    const where: any = { organizationId };

    if (input.clientId) where.clientId = input.clientId;
    if (input.riskLevel) where.riskLevel = input.riskLevel;
    if (input.assessmentDate) {
      where.assessmentDate = new Date(input.assessmentDate);
    }

    const assessments = await db.taxComplianceRiskAssessment.findMany({
      where,
      include: { client: { select: { name: true } } },
      orderBy: [{ overallScore: 'desc' }, { assessmentDate: 'desc' }],
      take: input.limit
    });

    return assessments.map(a => this.mapRiskAssessment(a));
  }

  /**
   * Calculate and save risk assessment for a client
   */
  async calculateRiskAssessment(
    clientId: string,
    organizationId: string
  ): Promise<RiskAssessmentResponse> {
    const today = new Date();
    const yearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Get client data
    const [client, obligations, whiteListChecks, documents] = await Promise.all([
      db.client.findFirst({
        where: { id: clientId, organizationId }
      }),
      db.taxComplianceObligation.findMany({
        where: {
          clientId,
          periodYear: { gte: today.getFullYear() - 1 }
        }
      }),
      db.whiteListVerification.findMany({
        where: {
          clientId,
          createdAt: { gte: yearAgo }
        }
      }),
      db.document.findMany({
        where: {
          clientId,
          createdAt: { gte: yearAgo },
          type: { in: ['invoice', 'receipt', 'contract'] }
        }
      })
    ]);

    if (!client) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Client not found'
      });
    }

    // Calculate individual scores (0 = best, 100 = worst)

    // Late filing score
    const totalObligations = obligations.filter(o =>
      ['filed', 'accepted', 'overdue'].includes(o.status)
    );
    const lateFilings = obligations.filter(o =>
      o.filedDate && o.dueDate && new Date(o.filedDate) > new Date(o.dueDate)
    );
    const lateFilingScore = totalObligations.length > 0
      ? Math.round((lateFilings.length / totalObligations.length) * 100)
      : 0;

    // Payment delay score
    const paidObligations = obligations.filter(o => o.paidAmount !== null);
    const latePayments = paidObligations.filter(o =>
      o.paymentDate && o.dueDate && new Date(o.paymentDate) > new Date(o.dueDate)
    );
    const paymentDelayScore = paidObligations.length > 0
      ? Math.round((latePayments.length / paidObligations.length) * 100)
      : 0;

    // Correction frequency score
    const corrections = obligations.filter(o => o.isCorrection);
    const correctionScore = totalObligations.length > 0
      ? Math.min(100, Math.round((corrections.length / totalObligations.length) * 200))
      : 0;

    // White list compliance score
    const failedChecks = whiteListChecks.filter(c =>
      c.status === 'not_found' || c.status === 'invalid_account'
    );
    const whiteListScore = whiteListChecks.length > 0
      ? Math.round((failedChecks.length / whiteListChecks.length) * 100)
      : 0;

    // Documentation completeness score
    const expectedDocs = totalObligations.length * 10; // Rough estimate
    const documentationScore = expectedDocs > 0
      ? Math.max(0, 100 - Math.round((documents.length / expectedDocs) * 100))
      : 0;

    // Calculate overall score
    const overallScore =
      lateFilingScore * RISK_WEIGHTS.lateFiling +
      paymentDelayScore * RISK_WEIGHTS.paymentDelay +
      correctionScore * RISK_WEIGHTS.correctionFrequency +
      whiteListScore * RISK_WEIGHTS.whiteList +
      documentationScore * RISK_WEIGHTS.documentation;

    // Determine risk level
    let riskLevel: RiskLevel;
    if (overallScore < DEFAULT_RISK_THRESHOLDS.low) {
      riskLevel = 'low';
    } else if (overallScore < DEFAULT_RISK_THRESHOLDS.medium) {
      riskLevel = 'medium';
    } else if (overallScore < DEFAULT_RISK_THRESHOLDS.high) {
      riskLevel = 'high';
    } else {
      riskLevel = 'critical';
    }

    // Get previous assessment for trend
    const previousAssessment = await db.taxComplianceRiskAssessment.findFirst({
      where: { clientId },
      orderBy: { assessmentDate: 'desc' }
    });

    let trend: 'improving' | 'stable' | 'declining' | null = null;
    if (previousAssessment) {
      const scoreDiff = overallScore - Number(previousAssessment.overallScore);
      if (scoreDiff < -5) trend = 'improving';
      else if (scoreDiff > 5) trend = 'declining';
      else trend = 'stable';
    }

    // Generate risk factors and recommendations
    const riskFactors: any[] = [];
    const recommendations: any[] = [];

    if (lateFilingScore > 30) {
      riskFactors.push({
        factor: 'Opóźnienia w składaniu deklaracji',
        description: `${lateFilings.length} z ${totalObligations.length} deklaracji złożonych po terminie`,
        impact: lateFilingScore > 60 ? 'high' : 'medium'
      });
      recommendations.push({
        action: 'Wdrożyć system przypomnień o terminach',
        priority: 'high',
        deadline: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    if (correctionScore > 30) {
      riskFactors.push({
        factor: 'Wysoka częstotliwość korekt',
        description: `${corrections.length} korekt w ostatnich 12 miesiącach`,
        impact: correctionScore > 50 ? 'high' : 'medium'
      });
      recommendations.push({
        action: 'Przegląd procesu weryfikacji przed wysyłką',
        priority: 'medium'
      });
    }

    // Save assessment
    const assessment = await db.taxComplianceRiskAssessment.create({
      data: {
        organizationId,
        clientId,
        assessmentDate: today,
        assessmentPeriodStart: yearAgo,
        assessmentPeriodEnd: today,
        lateFilingScore,
        paymentDelayScore,
        correctionFrequencyScore: correctionScore,
        whiteListScore,
        documentationScore,
        overallScore,
        riskLevel,
        previousScore: previousAssessment
          ? Number(previousAssessment.overallScore)
          : null,
        trend,
        riskFactors,
        recommendations,
        calculatedBy: 'system'
      },
      include: { client: { select: { name: true } } }
    });

    return this.mapRiskAssessment(assessment);
  }

  /**
   * Get calendar events
   */
  async getCalendar(
    input: GetCalendarInput,
    organizationId: string
  ): Promise<CalendarEvent[]> {
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);

    const where: any = {
      organizationId,
      dueDate: {
        gte: startDate,
        lte: endDate
      }
    };

    if (input.clientId) where.clientId = input.clientId;
    if (input.obligationTypes?.length) {
      where.obligationType = { in: input.obligationTypes };
    }

    const obligations = await db.taxComplianceObligation.findMany({
      where,
      include: { client: { select: { name: true } } },
      orderBy: { dueDate: 'asc' }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return obligations.map(o => {
      const dueDate = new Date(o.dueDate);
      const dayOfWeek = dueDate.getDay();
      const dateStr = dueDate.toISOString().split('T')[0];

      return {
        id: o.id,
        date: dateStr,
        clientId: o.clientId,
        clientName: o.client.name,
        obligationType: o.obligationType as ObligationType,
        obligationLabel: OBLIGATION_LABELS[o.obligationType as ObligationType]?.pl || o.obligationType,
        period: this.formatPeriod(o.periodYear, o.periodMonth, o.periodQuarter),
        status: o.status as any,
        isHoliday: POLISH_HOLIDAYS_2024.includes(dateStr) ||
                   this.isPolishHoliday(dueDate),
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        daysUntilDue: Math.ceil(
          (dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
        )
      };
    });
  }

  /**
   * Get historical filings
   */
  async getHistoricalFilings(
    input: GetHistoricalFilingsInput,
    organizationId: string
  ): Promise<{ filings: HistoricalFiling[]; total: number }> {
    const where: any = {
      organizationId,
      clientId: input.clientId,
      status: { in: ['filed', 'accepted', 'rejected'] }
    };

    if (input.obligationType) where.obligationType = input.obligationType;
    if (input.periodYear) where.periodYear = input.periodYear;
    if (input.status !== 'all') {
      where.status = input.status;
    }

    const [filings, total] = await Promise.all([
      db.taxComplianceObligation.findMany({
        where,
        orderBy: { filedDate: 'desc' },
        skip: input.offset,
        take: input.limit
      }),
      db.taxComplianceObligation.count({ where })
    ]);

    // Get corrections for each filing
    const filingsWithCorrections = await Promise.all(
      filings.map(async f => {
        const corrections = await db.taxComplianceObligation.findMany({
          where: { correctsObligationId: f.id },
          select: { id: true }
        });

        return {
          ...f,
          correctedBy: corrections.map(c => c.id)
        };
      })
    );

    return {
      filings: filingsWithCorrections.map(f => ({
        id: f.id,
        filingId: f.filingId || f.id,
        obligationType: f.obligationType as ObligationType,
        period: this.formatPeriod(f.periodYear, f.periodMonth, f.periodQuarter),
        submittedAt: f.filedDate?.toISOString() || '',
        status: f.status,
        upoNumber: f.upoNumber,
        fileUrl: null, // Would be fetched from document service
        filedAmount: f.filedAmount ? Number(f.filedAmount) : null,
        correctionOf: f.correctsObligationId,
        correctedBy: f.correctedBy
      })),
      total
    };
  }

  /**
   * Generate report
   */
  async generateReport(
    input: GenerateReportInput,
    organizationId: string,
    userId: string
  ): Promise<{ reportId: string; url: string; expiresAt: Date }> {
    // Load template if specified
    let template: any = null;
    if (input.templateId) {
      template = await db.taxComplianceReportTemplate.findFirst({
        where: { id: input.templateId, organizationId }
      });
    }

    // Gather report data
    const reportData = await this.gatherReportData(
      input,
      organizationId,
      template
    );

    // Create report record
    const report = await db.taxComplianceReport.create({
      data: {
        organizationId,
        clientId: input.clientId || null,
        reportType: input.reportType,
        periodType: input.periodType,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        reportData,
        summaryMetrics: reportData.summary,
        generatedBy: userId,
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      }
    });

    // Generate file
    let fileUrl: string;
    let fileSize: number;

    switch (input.format) {
      case 'pdf':
        const pdfResult = await generatePDF(reportData, {
          template: template?.brandingConfig,
          language: input.language
        });
        fileUrl = pdfResult.url;
        fileSize = pdfResult.size;
        break;

      case 'xlsx':
        const xlsxResult = await generateExcel(reportData);
        fileUrl = xlsxResult.url;
        fileSize = xlsxResult.size;
        break;

      case 'csv':
        const csvResult = await generateCSV(reportData);
        fileUrl = csvResult.url;
        fileSize = csvResult.size;
        break;

      default:
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unsupported format: ${input.format}`
        });
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Save generation record
    await db.taxComplianceReportGeneration.create({
      data: {
        reportId: report.id,
        format: input.format,
        fileUrl,
        fileSizeBytes: fileSize,
        status: 'completed',
        completedAt: new Date(),
        expiresAt,
        requestedBy: userId,
        deliveredTo: input.deliverTo || []
      }
    });

    // Update report with export info
    await db.taxComplianceReport.update({
      where: { id: report.id },
      data: {
        lastExportedAt: new Date(),
        exportFormat: input.format,
        exportUrl: fileUrl,
        exportExpiresAt: expiresAt
      }
    });

    // Send email if recipients specified
    if (input.deliverTo?.length) {
      await this.sendReportEmail(input.deliverTo, fileUrl, report, input.language);
    }

    return {
      reportId: report.id,
      url: fileUrl,
      expiresAt
    };
  }

  /**
   * Gather all data needed for a report
   */
  private async gatherReportData(
    input: GenerateReportInput,
    organizationId: string,
    template: any
  ): Promise<any> {
    const sections = input.sections || {
      summary: true,
      obligations: true,
      risk: true,
      calendar: true,
      history: true
    };

    const data: any = {
      reportType: input.reportType,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      generatedAt: new Date().toISOString(),
      language: input.language
    };

    // Get client info if client-specific report
    if (input.clientId) {
      const client = await db.client.findFirst({
        where: { id: input.clientId, organizationId }
      });
      data.client = {
        name: client?.name,
        nip: client?.nip,
        legalForm: client?.legalForm
      };
    }

    // Summary section
    if (sections.summary) {
      data.summary = await this.generateSummarySection(
        input.clientId,
        organizationId,
        input.periodStart,
        input.periodEnd
      );
    }

    // Obligations section
    if (sections.obligations) {
      const { obligations } = await this.getObligations(
        {
          clientId: input.clientId,
          dueDateFrom: input.periodStart,
          dueDateTo: input.periodEnd,
          limit: 500
        },
        organizationId
      );
      data.obligations = obligations;
    }

    // Risk section
    if (sections.risk && input.clientId) {
      const assessments = await this.getRiskAssessments(
        { clientId: input.clientId, limit: 1 },
        organizationId
      );
      data.riskAssessment = assessments[0] || null;
    }

    // Calendar section
    if (sections.calendar) {
      data.calendar = await this.getCalendar(
        {
          startDate: input.periodStart,
          endDate: input.periodEnd,
          clientId: input.clientId
        },
        organizationId
      );
    }

    // Historical filings section
    if (sections.history && input.clientId) {
      const periodYear = new Date(input.periodStart).getFullYear();
      const { filings } = await this.getHistoricalFilings(
        {
          clientId: input.clientId,
          periodYear,
          limit: 100
        },
        organizationId
      );
      data.historicalFilings = filings;
    }

    return data;
  }

  /**
   * Generate summary metrics
   */
  private async generateSummarySection(
    clientId: string | undefined,
    organizationId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<any> {
    const where: any = {
      organizationId,
      dueDate: {
        gte: new Date(periodStart),
        lte: new Date(periodEnd)
      }
    };

    if (clientId) where.clientId = clientId;

    const obligations = await db.taxComplianceObligation.findMany({
      where
    });

    const total = obligations.length;
    const filed = obligations.filter(o =>
      ['filed', 'accepted'].includes(o.status)
    ).length;
    const pending = obligations.filter(o =>
      ['pending', 'due_soon'].includes(o.status)
    ).length;
    const overdue = obligations.filter(o => o.status === 'overdue').length;

    const complianceRate = total > 0
      ? Math.round(((total - overdue) / total) * 100)
      : 100;

    return {
      totalObligations: total,
      filedObligations: filed,
      pendingObligations: pending,
      overdueObligations: overdue,
      complianceRate,
      periodStart,
      periodEnd
    };
  }

  /**
   * Save or update report template
   */
  async saveTemplate(
    input: SaveTemplateInput,
    organizationId: string,
    userId: string
  ): Promise<ReportTemplate> {
    // If setting as default, unset other defaults of same type
    if (input.isDefault) {
      await db.taxComplianceReportTemplate.updateMany({
        where: {
          organizationId,
          reportType: input.reportType,
          isDefault: true
        },
        data: { isDefault: false }
      });
    }

    const data = {
      name: input.name,
      description: input.description || null,
      reportType: input.reportType,
      sectionsConfig: input.sectionsConfig,
      riskThresholds: input.riskThresholds || DEFAULT_RISK_THRESHOLDS,
      brandingConfig: input.brandingConfig || {},
      language: input.language,
      autoGenerate: input.autoGenerate,
      scheduleCron: input.scheduleCron || null,
      scheduleRecipients: input.scheduleRecipients || [],
      isDefault: input.isDefault
    };

    const template = input.id
      ? await db.taxComplianceReportTemplate.update({
          where: { id: input.id },
          data
        })
      : await db.taxComplianceReportTemplate.create({
          data: {
            ...data,
            organizationId,
            createdBy: userId,
            isActive: true
          }
        });

    return this.mapTemplate(template);
  }

  /**
   * Get templates
   */
  async getTemplates(
    organizationId: string,
    reportType?: string
  ): Promise<ReportTemplate[]> {
    const where: any = { organizationId, isActive: true };
    if (reportType) where.reportType = reportType;

    const templates = await db.taxComplianceReportTemplate.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    return templates.map(t => this.mapTemplate(t));
  }

  // Helper methods

  private formatPeriod(
    year: number,
    month: number | null,
    quarter: number | null
  ): string {
    if (month) {
      return `${month.toString().padStart(2, '0')}/${year}`;
    }
    if (quarter) {
      return `Q${quarter}/${year}`;
    }
    return year.toString();
  }

  private isPolishHoliday(date: Date): boolean {
    // Check moving holidays (Easter-based)
    // This is a simplified check - full implementation would need Easter calculation
    const dateStr = date.toISOString().split('T')[0];
    return POLISH_HOLIDAYS_2024.includes(dateStr);
  }

  private mapSnapshotToResponse(snapshot: any): DashboardResponse {
    return {
      snapshotDate: snapshot.snapshotDate.toISOString().split('T')[0],
      totalClients: snapshot.totalClients,
      compliantClients: snapshot.compliantClients,
      atRiskClients: snapshot.atRiskClients,
      nonCompliantClients: snapshot.nonCompliantClients,
      deadlines7Days: snapshot.deadlines7Days,
      deadlines14Days: snapshot.deadlines14Days,
      deadlines30Days: snapshot.deadlines30Days,
      overdueCount: snapshot.overdueCount,
      recentSubmissions: snapshot.recentSubmissions || [],
      riskDistribution: snapshot.riskDistribution || {},
      vatStats: snapshot.vatStats || { pending: 0, filed: 0, overdue: 0 },
      citStats: snapshot.citStats || { pending: 0, filed: 0, overdue: 0 },
      pitStats: snapshot.pitStats || { pending: 0, filed: 0, overdue: 0 },
      zusStats: snapshot.zusStats || { pending: 0, filed: 0, overdue: 0 }
    };
  }

  private mapObligation(o: any): Obligation {
    return {
      id: o.id,
      clientId: o.clientId,
      clientName: o.client?.name || '',
      obligationType: o.obligationType,
      periodYear: o.periodYear,
      periodMonth: o.periodMonth,
      periodQuarter: o.periodQuarter,
      periodLabel: this.formatPeriod(o.periodYear, o.periodMonth, o.periodQuarter),
      dueDate: o.dueDate.toISOString().split('T')[0],
      warningDate: o.warningDate?.toISOString().split('T')[0] || null,
      filedDate: o.filedDate?.toISOString().split('T')[0] || null,
      status: o.status,
      filingId: o.filingId,
      upoNumber: o.upoNumber,
      calculatedAmount: o.calculatedAmount ? Number(o.calculatedAmount) : null,
      filedAmount: o.filedAmount ? Number(o.filedAmount) : null,
      paidAmount: o.paidAmount ? Number(o.paidAmount) : null,
      isCorrection: o.isCorrection,
      notes: o.notes
    };
  }

  private mapRiskAssessment(a: any): RiskAssessmentResponse {
    return {
      id: a.id,
      clientId: a.clientId,
      clientName: a.client?.name || '',
      assessmentDate: a.assessmentDate.toISOString().split('T')[0],
      scores: {
        lateFiling: a.lateFilingScore,
        paymentDelay: a.paymentDelayScore,
        correctionFrequency: a.correctionFrequencyScore,
        whiteList: a.whiteListScore,
        documentation: a.documentationScore
      },
      overallScore: Number(a.overallScore),
      riskLevel: a.riskLevel,
      trend: a.trend,
      riskFactors: a.riskFactors || [],
      recommendations: a.recommendations || []
    };
  }

  private mapTemplate(t: any): ReportTemplate {
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      reportType: t.reportType,
      sectionsConfig: t.sectionsConfig || {},
      riskThresholds: t.riskThresholds || DEFAULT_RISK_THRESHOLDS,
      brandingConfig: t.brandingConfig,
      language: t.language,
      autoGenerate: t.autoGenerate,
      scheduleCron: t.scheduleCron,
      isDefault: t.isDefault,
      isActive: t.isActive
    };
  }

  private async sendReportEmail(
    recipients: string[],
    fileUrl: string,
    report: any,
    language: 'pl' | 'en'
  ): Promise<void> {
    const subject = language === 'pl'
      ? `Raport zgodności podatkowej - ${new Date().toLocaleDateString('pl-PL')}`
      : `Tax Compliance Report - ${new Date().toLocaleDateString('en-US')}`;

    const body = language === 'pl'
      ? `W załączeniu raport zgodności podatkowej.\n\nLink do pobrania: ${fileUrl}`
      : `Please find attached the tax compliance report.\n\nDownload link: ${fileUrl}`;

    for (const email of recipients) {
      await sendEmail({
        to: email,
        subject,
        body,
        attachmentUrl: fileUrl
      });
    }
  }
}

export const taxComplianceReportsService = new TaxComplianceReportsService();
```

### API Router

```typescript
import { router, protectedProcedure } from '@/server/trpc';
import { taxComplianceReportsService } from './compliance-reports.service';
import {
  GetDashboardSchema,
  GetObligationsSchema,
  GetRiskAssessmentSchema,
  GetCalendarSchema,
  GetHistoricalFilingsSchema,
  GenerateReportSchema,
  SaveTemplateSchema,
  ReportTypeSchema
} from './compliance-reports.schemas';
import { z } from 'zod';

export const taxComplianceReportsRouter = router({
  // Dashboard
  getDashboard: protectedProcedure
    .input(GetDashboardSchema)
    .query(async ({ input, ctx }) => {
      return taxComplianceReportsService.getDashboard(
        input,
        ctx.organizationId
      );
    }),

  // Obligations
  getObligations: protectedProcedure
    .input(GetObligationsSchema)
    .query(async ({ input, ctx }) => {
      return taxComplianceReportsService.getObligations(
        input,
        ctx.organizationId
      );
    }),

  // Risk assessments
  getRiskAssessments: protectedProcedure
    .input(GetRiskAssessmentSchema)
    .query(async ({ input, ctx }) => {
      return taxComplianceReportsService.getRiskAssessments(
        input,
        ctx.organizationId
      );
    }),

  calculateRiskAssessment: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return taxComplianceReportsService.calculateRiskAssessment(
        input.clientId,
        ctx.organizationId
      );
    }),

  // Calendar
  getCalendar: protectedProcedure
    .input(GetCalendarSchema)
    .query(async ({ input, ctx }) => {
      return taxComplianceReportsService.getCalendar(
        input,
        ctx.organizationId
      );
    }),

  // Historical filings
  getHistoricalFilings: protectedProcedure
    .input(GetHistoricalFilingsSchema)
    .query(async ({ input, ctx }) => {
      return taxComplianceReportsService.getHistoricalFilings(
        input,
        ctx.organizationId
      );
    }),

  // Report generation
  generateReport: protectedProcedure
    .input(GenerateReportSchema)
    .mutation(async ({ input, ctx }) => {
      return taxComplianceReportsService.generateReport(
        input,
        ctx.organizationId,
        ctx.userId
      );
    }),

  // Templates
  getTemplates: protectedProcedure
    .input(z.object({
      reportType: ReportTypeSchema.optional()
    }))
    .query(async ({ input, ctx }) => {
      return taxComplianceReportsService.getTemplates(
        ctx.organizationId,
        input.reportType
      );
    }),

  saveTemplate: protectedProcedure
    .input(SaveTemplateSchema)
    .mutation(async ({ input, ctx }) => {
      return taxComplianceReportsService.saveTemplate(
        input,
        ctx.organizationId,
        ctx.userId
      );
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({ templateId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.taxComplianceReportTemplate.update({
        where: {
          id: input.templateId,
          organizationId: ctx.organizationId
        },
        data: { isActive: false }
      });
    })
});
```

---

## Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaxComplianceReportsService } from './compliance-reports.service';

describe('TaxComplianceReportsService', () => {
  let service: TaxComplianceReportsService;

  beforeEach(() => {
    service = new TaxComplianceReportsService();
    vi.clearAllMocks();
  });

  describe('formatPeriod', () => {
    it('should format monthly period', () => {
      const result = service['formatPeriod'](2024, 3, null);
      expect(result).toBe('03/2024');
    });

    it('should format quarterly period', () => {
      const result = service['formatPeriod'](2024, null, 2);
      expect(result).toBe('Q2/2024');
    });

    it('should format annual period', () => {
      const result = service['formatPeriod'](2024, null, null);
      expect(result).toBe('2024');
    });
  });

  describe('risk score calculation', () => {
    const RISK_WEIGHTS = {
      lateFiling: 0.25,
      paymentDelay: 0.20,
      correctionFrequency: 0.15,
      whiteList: 0.20,
      documentation: 0.20
    };

    it('should calculate overall score correctly', () => {
      const scores = {
        lateFiling: 40,
        paymentDelay: 20,
        correctionFrequency: 30,
        whiteList: 10,
        documentation: 25
      };

      const overall =
        scores.lateFiling * RISK_WEIGHTS.lateFiling +
        scores.paymentDelay * RISK_WEIGHTS.paymentDelay +
        scores.correctionFrequency * RISK_WEIGHTS.correctionFrequency +
        scores.whiteList * RISK_WEIGHTS.whiteList +
        scores.documentation * RISK_WEIGHTS.documentation;

      expect(overall).toBe(24.5);
    });

    it('should determine risk level correctly', () => {
      const determineLevel = (score: number) => {
        if (score < 25) return 'low';
        if (score < 50) return 'medium';
        if (score < 75) return 'high';
        return 'critical';
      };

      expect(determineLevel(20)).toBe('low');
      expect(determineLevel(40)).toBe('medium');
      expect(determineLevel(60)).toBe('high');
      expect(determineLevel(90)).toBe('critical');
    });
  });

  describe('obligation status mapping', () => {
    it('should map obligation correctly', () => {
      const rawObligation = {
        id: 'test-id',
        clientId: 'client-id',
        client: { name: 'Test Client' },
        obligationType: 'jpk_v7m',
        periodYear: 2024,
        periodMonth: 3,
        periodQuarter: null,
        dueDate: new Date('2024-04-25'),
        warningDate: new Date('2024-04-18'),
        filedDate: new Date('2024-04-22'),
        status: 'accepted',
        filingId: 'filing-id',
        upoNumber: '12345678',
        calculatedAmount: 5000.50,
        filedAmount: 5000.50,
        paidAmount: 5000.50,
        isCorrection: false,
        notes: null
      };

      const mapped = service['mapObligation'](rawObligation);

      expect(mapped.periodLabel).toBe('03/2024');
      expect(mapped.clientName).toBe('Test Client');
      expect(mapped.calculatedAmount).toBe(5000.50);
    });
  });

  describe('isPolishHoliday', () => {
    it('should identify Christmas as holiday', () => {
      const christmas = new Date('2024-12-25');
      const result = service['isPolishHoliday'](christmas);
      expect(result).toBe(true);
    });

    it('should identify regular day as non-holiday', () => {
      const regularDay = new Date('2024-06-15');
      const result = service['isPolishHoliday'](regularDay);
      expect(result).toBe(false);
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, cleanupTestData } from '@/tests/helpers';
import { taxComplianceReportsRouter } from './compliance-reports.router';

describe('Tax Compliance Reports Integration', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let testClientId: string;

  beforeAll(async () => {
    ctx = await createTestContext();

    // Create test client with obligations
    const client = await ctx.db.client.create({
      data: {
        organizationId: ctx.organizationId,
        name: 'Test Compliance Client',
        nip: '1234567890'
      }
    });
    testClientId = client.id;

    // Create test obligations
    await ctx.db.taxComplianceObligation.createMany({
      data: [
        {
          organizationId: ctx.organizationId,
          clientId: testClientId,
          obligationType: 'jpk_v7m',
          periodYear: 2024,
          periodMonth: 1,
          dueDate: new Date('2024-02-25'),
          filedDate: new Date('2024-02-22'),
          status: 'accepted',
          upoNumber: 'UPO-001'
        },
        {
          organizationId: ctx.organizationId,
          clientId: testClientId,
          obligationType: 'jpk_v7m',
          periodYear: 2024,
          periodMonth: 2,
          dueDate: new Date('2024-03-25'),
          status: 'pending'
        },
        {
          organizationId: ctx.organizationId,
          clientId: testClientId,
          obligationType: 'zus_dra',
          periodYear: 2024,
          periodMonth: 2,
          dueDate: new Date('2024-03-15'),
          status: 'overdue'
        }
      ]
    });
  });

  afterAll(async () => {
    await cleanupTestData(ctx);
  });

  describe('getDashboard', () => {
    it('should return dashboard with metrics', async () => {
      const caller = taxComplianceReportsRouter.createCaller(ctx);

      const result = await caller.getDashboard({ forceRefresh: true });

      expect(result.totalClients).toBeGreaterThan(0);
      expect(result.snapshotDate).toBeDefined();
      expect(result.riskDistribution).toBeDefined();
    });
  });

  describe('getObligations', () => {
    it('should return obligations for client', async () => {
      const caller = taxComplianceReportsRouter.createCaller(ctx);

      const result = await caller.getObligations({
        clientId: testClientId
      });

      expect(result.obligations.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThanOrEqual(result.obligations.length);
    });

    it('should filter by status', async () => {
      const caller = taxComplianceReportsRouter.createCaller(ctx);

      const result = await caller.getObligations({
        clientId: testClientId,
        status: 'overdue'
      });

      expect(result.obligations.every(o => o.status === 'overdue')).toBe(true);
    });
  });

  describe('calculateRiskAssessment', () => {
    it('should calculate and return risk assessment', async () => {
      const caller = taxComplianceReportsRouter.createCaller(ctx);

      const result = await caller.calculateRiskAssessment({
        clientId: testClientId
      });

      expect(result.clientId).toBe(testClientId);
      expect(result.scores).toBeDefined();
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.riskLevel).toMatch(/low|medium|high|critical/);
    });
  });

  describe('getCalendar', () => {
    it('should return calendar events', async () => {
      const caller = taxComplianceReportsRouter.createCaller(ctx);

      const result = await caller.getCalendar({
        startDate: '2024-03-01',
        endDate: '2024-03-31',
        clientId: testClientId
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].obligationLabel).toBeDefined();
    });
  });

  describe('getHistoricalFilings', () => {
    it('should return historical filings', async () => {
      const caller = taxComplianceReportsRouter.createCaller(ctx);

      const result = await caller.getHistoricalFilings({
        clientId: testClientId
      });

      expect(result.filings.length).toBeGreaterThan(0);
      expect(result.filings[0].upoNumber).toBeDefined();
    });
  });

  describe('templates', () => {
    it('should save and retrieve template', async () => {
      const caller = taxComplianceReportsRouter.createCaller(ctx);

      const template = await caller.saveTemplate({
        name: 'Test Template',
        reportType: 'client_detail',
        sectionsConfig: {
          summary: { enabled: true },
          obligations: { enabled: true }
        }
      });

      expect(template.id).toBeDefined();
      expect(template.name).toBe('Test Template');

      const templates = await caller.getTemplates({});
      expect(templates.some(t => t.id === template.id)).toBe(true);
    });
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Tax Compliance Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('view compliance dashboard', async ({ page }) => {
    await page.goto('/tax/compliance');

    // Verify dashboard sections
    await expect(page.locator('[data-testid="compliance-overview"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-clients"]')).toBeVisible();
    await expect(page.locator('[data-testid="risk-distribution"]')).toBeVisible();

    // Verify metrics are loaded
    await expect(page.locator('[data-testid="deadlines-count"]'))
      .not.toHaveText('Loading...');
  });

  test('view client obligations', async ({ page }) => {
    await page.goto('/clients/test-client/compliance');

    // Verify obligation list
    await expect(page.locator('[data-testid="obligation-item"]'))
      .toHaveCount.greaterThan(0);

    // Filter by status
    await page.selectOption('[data-testid="status-filter"]', 'pending');

    const items = await page.locator('[data-testid="obligation-item"]').all();
    for (const item of items) {
      await expect(item.locator('[data-testid="status-badge"]'))
        .toHaveText(/Pending|Due Soon/);
    }
  });

  test('view deadline calendar', async ({ page }) => {
    await page.goto('/tax/compliance/calendar');

    // Verify calendar is displayed
    await expect(page.locator('[data-testid="deadline-calendar"]')).toBeVisible();

    // Navigate to next month
    await page.click('[data-testid="next-month"]');

    // Click on deadline event
    await page.click('[data-testid="calendar-event"]:first-child');

    // Verify event details popup
    await expect(page.locator('[data-testid="event-details"]')).toBeVisible();
  });

  test('generate PDF report', async ({ page }) => {
    await page.goto('/clients/test-client/compliance');

    // Click generate report
    await page.click('[data-testid="generate-report"]');

    // Configure report
    await page.selectOption('[data-testid="report-type"]', 'client_detail');
    await page.selectOption('[data-testid="format"]', 'pdf');
    await page.check('[data-testid="include-risk"]');
    await page.check('[data-testid="include-history"]');

    // Generate
    await page.click('[data-testid="submit-report"]');

    // Wait for generation
    await expect(page.locator('[data-testid="report-ready"]'))
      .toBeVisible({ timeout: 30000 });

    // Download
    const download = await page.waitForEvent('download');
    expect(download.suggestedFilename()).toContain('.pdf');
  });

  test('view risk assessment', async ({ page }) => {
    await page.goto('/clients/test-client/compliance/risk');

    // Verify risk scores are displayed
    await expect(page.locator('[data-testid="overall-risk-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="risk-factors"]')).toBeVisible();

    // Recalculate risk
    await page.click('[data-testid="recalculate-risk"]');

    // Wait for calculation
    await expect(page.locator('[data-testid="calculating"]'))
      .toBeHidden({ timeout: 10000 });

    // Verify updated
    await expect(page.locator('[data-testid="last-calculated"]'))
      .toContainText('just now');
  });
});
```

---

## Security Checklist

### Authentication & Authorization
- [x] All endpoints require authentication
- [x] Organization-level access control enforced
- [x] Row Level Security (RLS) on all tables
- [x] User can only access own organization's data

### Data Protection
- [x] Tax obligation data encrypted at rest
- [x] Client financial information protected
- [x] Report URLs are signed and time-limited
- [x] Generated files expire after 7 days

### Input Validation
- [x] All inputs validated with Zod schemas
- [x] Date ranges validated
- [x] Report types validated as enums
- [x] Template configurations sanitized

### Audit Trail
- [x] Report generation logged
- [x] Risk assessments logged
- [x] Dashboard access tracked
- [x] Template modifications logged

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `dashboard_viewed` | Dashboard access | userId, forceRefresh |
| `obligations_queried` | Obligations list | filters, resultCount |
| `risk_calculated` | Risk assessment | clientId, overallScore, riskLevel |
| `calendar_viewed` | Calendar access | dateRange, clientId |
| `report_generated` | Report created | reportType, format, clientId |
| `report_downloaded` | Report downloaded | reportId, format, userId |
| `report_emailed` | Report sent | reportId, recipients |
| `template_saved` | Template created/updated | templateId, name |
| `template_deleted` | Template deactivated | templateId |

---

## Implementation Notes

### Dashboard Caching
- Dashboard snapshots are cached daily for performance
- Snapshots are regenerated on-demand with `forceRefresh: true`
- Real-time updates available through WebSocket (future enhancement)

### Risk Assessment Algorithm
Risk scores are calculated using weighted factors:
- Late filing history (25%): Percentage of late filings in 12 months
- Payment delays (20%): Percentage of late payments
- Correction frequency (15%): Number of JPK corrections
- White List compliance (20%): Failed verification rate
- Documentation completeness (20%): Document coverage ratio

Risk levels:
- Low: 0-25%
- Medium: 25-50%
- High: 50-75%
- Critical: 75-100%

### Report Generation
Reports support multiple formats:
- PDF: Professional, branded documents for client presentation
- Excel: Data-rich workbooks with formulas for analysis
- CSV: Raw data export for integration

Reports include configurable sections:
- Summary metrics
- Obligation checklist
- Risk assessment
- Deadline calendar
- Historical filings

### Polish Holiday Handling
The calendar considers Polish public holidays when displaying deadlines:
- Non-working days are highlighted
- Tax deadlines that fall on holidays roll to next business day
- Holiday list is maintained per year

---

## Dependencies

- **TAX-003**: Tax Deadline Management (deadline data)
- **TAX-007**: JPK File Generation (filing references)
- **TAX-008**: e-Declaration Submission (UPO numbers)
- **TAX-013**: White List Verification (compliance scores)
- **ACC**: Accounting data for financial context

---

## References

- [Terminy podatkowe](https://www.podatki.gov.pl/kalendarz-podatkowy/)
- [JPK dokumentacja](https://www.podatki.gov.pl/jednolity-plik-kontrolny/)
- [ZUS terminy](https://www.zus.pl/baza-wiedzy/skladki-wskazniki-odsetki/terminy)

---

*Story last updated: December 2024*
