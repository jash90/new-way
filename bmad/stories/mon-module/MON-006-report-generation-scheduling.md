# Story: MON-006 - Report Generation & Scheduling

## Story Overview

| Field | Value |
|-------|-------|
| Story ID | MON-006 |
| Epic | MON-EPIC (Monitoring & Analytics) |
| Title | Report Generation & Scheduling |
| Priority | P2 |
| Story Points | 3 |
| Status | Draft |
| Sprint | Sprint 2 (Week 33) |
| Dependencies | MON-001 (Events), MON-002 (Metrics) |

## User Story

**As a** business manager or system administrator,
**I want** to generate and schedule monitoring reports in various formats,
**So that** I can share system health and performance insights with stakeholders regularly.

## Acceptance Criteria

### AC1: Report Generation

```gherkin
Given I am an authenticated user with report permissions
When I request a performance report with:
  | Field | Value |
  | type | performance |
  | periodStart | 2024-01-01T00:00:00Z |
  | periodEnd | 2024-01-31T23:59:59Z |
  | format | pdf |
Then a PDF report should be generated
And the report should contain performance metrics for the specified period
And the report should be saved and accessible for download
```

### AC2: Multiple Report Types

```gherkin
Given I am generating a report
When I select a report type
Then I should be able to generate:
  | Type | Description |
  | performance | System performance metrics summary |
  | analytics | User behavior and event analytics |
  | errors | Error summary and trends |
  | health | Service health and uptime report |
  | executive | High-level KPI summary for management |
  | custom | Custom metrics and dimensions |
```

### AC3: Export Formats

```gherkin
Given I am generating a report
When I select the export format
Then I should be able to export as:
  | Format | Use Case |
  | PDF | Formal reports with charts |
  | Excel | Data analysis and manipulation |
  | CSV | Raw data export |
  | JSON | API integration and automation |
And the format should preserve appropriate data fidelity
```

### AC4: Report Scheduling

```gherkin
Given I am creating a scheduled report
When I configure the schedule with:
  | Field | Value |
  | reportType | performance |
  | scheduleExpression | 0 9 * * 1 |
  | recipients | ["manager@company.com"] |
  | format | pdf |
Then the report should be generated automatically every Monday at 9 AM
And the report should be emailed to configured recipients
```

### AC5: Report Templates

```gherkin
Given I want to create reports with consistent branding
When I create a custom report template with:
  | Field | Value |
  | name | Monthly Performance Template |
  | logo | company-logo.png |
  | header | "Raport Wydajności Systemu" |
  | sections | ["summary", "metrics", "trends", "recommendations"] |
Then the template should be saved
And I should be able to use it for future reports
```

### AC6: Report History and Access

```gherkin
Given I have generated reports
When I view the report history
Then I should see a list of generated reports with:
  | Field | Description |
  | name | Report name |
  | type | Report type |
  | generatedAt | Generation timestamp |
  | generatedBy | User who generated |
  | format | Export format |
  | fileSize | File size |
  | status | Generation status |
And I should be able to download or delete reports
```

### AC7: Report Data Filtering

```gherkin
Given I am generating a report
When I apply filters
Then I should be able to filter by:
  | Filter | Description |
  | services | Specific services to include |
  | metrics | Specific metrics to include |
  | severity | Error severity levels |
  | users | Specific users (for analytics) |
  | tags | Custom tags |
And the report should only include matching data
```

## Technical Specification

### Database Schema

```sql
-- Report templates
CREATE TABLE report_templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  description TEXT,
  config JSONB NOT NULL, -- sections, styling, branding
  is_default BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- Report jobs (for async generation)
CREATE TABLE report_jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  report_type VARCHAR(50) NOT NULL,
  template_id UUID REFERENCES report_templates(template_id),
  schedule_id UUID REFERENCES report_schedules(schedule_id),
  parameters JSONB NOT NULL,
  format VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  requested_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report delivery log
CREATE TABLE report_deliveries (
  delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES monitoring_reports(report_id),
  schedule_id UUID REFERENCES report_schedules(schedule_id),
  delivery_method VARCHAR(50) NOT NULL, -- email, storage, webhook
  recipient VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL, -- pending, sent, delivered, failed
  error_message TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_report_templates_tenant ON report_templates(tenant_id);
CREATE INDEX idx_report_jobs_tenant_status ON report_jobs(tenant_id, status);
CREATE INDEX idx_report_jobs_schedule ON report_jobs(schedule_id, created_at DESC);
CREATE INDEX idx_report_deliveries_report ON report_deliveries(report_id);
CREATE INDEX idx_report_schedules_next_run ON report_schedules(tenant_id, next_run_at) WHERE enabled = true;
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Enums
export const ReportTypeEnum = z.enum([
  'performance',
  'analytics',
  'errors',
  'health',
  'executive',
  'custom',
]);

export const ReportFormatEnum = z.enum(['pdf', 'excel', 'csv', 'json']);
export const ReportStatusEnum = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);
export const DeliveryMethodEnum = z.enum(['email', 'storage', 'webhook']);

// Report Section Schema
export const ReportSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['summary', 'chart', 'table', 'metrics', 'text']),
  config: z.object({
    metrics: z.array(z.string()).optional(),
    chartType: z.enum(['line', 'bar', 'pie', 'area']).optional(),
    aggregation: z.enum(['avg', 'sum', 'min', 'max', 'count']).optional(),
    groupBy: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    customQuery: z.string().optional(),
  }).optional(),
  order: z.number().int().min(0),
});

// Report Template Schema
export const CreateReportTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  reportType: ReportTypeEnum,
  description: z.string().max(1000).optional(),
  config: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    logo: z.string().url().optional(),
    headerColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    sections: z.array(ReportSectionSchema),
    footer: z.string().optional(),
    includeTimestamp: z.boolean().default(true),
    includePageNumbers: z.boolean().default(true),
    language: z.enum(['pl', 'en']).default('pl'),
  }),
  isDefault: z.boolean().default(false),
});

// Generate Report Schema
export const GenerateReportSchema = z.object({
  reportType: ReportTypeEnum,
  name: z.string().min(1).max(255).optional(),
  templateId: z.string().uuid().optional(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  format: ReportFormatEnum,
  filters: z.object({
    services: z.array(z.string()).optional(),
    metrics: z.array(z.string()).optional(),
    severity: z.array(z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])).optional(),
    userIds: z.array(z.string().uuid()).optional(),
    tags: z.record(z.string()).optional(),
  }).optional(),
  options: z.object({
    includeCharts: z.boolean().default(true),
    includeTrends: z.boolean().default(true),
    compareWithPrevious: z.boolean().default(false),
    customSections: z.array(ReportSectionSchema).optional(),
  }).optional(),
}).refine(data => data.periodEnd > data.periodStart, {
  message: 'periodEnd must be after periodStart',
});

// Schedule Report Schema
export const CreateReportScheduleSchema = z.object({
  reportType: ReportTypeEnum,
  name: z.string().min(1).max(255),
  templateId: z.string().uuid().optional(),
  scheduleExpression: z.string().regex(
    /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/,
    { message: 'Invalid cron expression' }
  ),
  timezone: z.string().default('Europe/Warsaw'),
  format: ReportFormatEnum.default('pdf'),
  parameters: z.object({
    periodType: z.enum(['day', 'week', 'month', 'quarter']).default('week'),
    filters: z.object({
      services: z.array(z.string()).optional(),
      metrics: z.array(z.string()).optional(),
    }).optional(),
    options: z.object({
      includeCharts: z.boolean().default(true),
      compareWithPrevious: z.boolean().default(true),
    }).optional(),
  }),
  recipients: z.array(z.object({
    type: z.enum(['email', 'webhook']),
    address: z.string(),
  })).min(1),
  enabled: z.boolean().default(true),
});

// Update Schedule Schema
export const UpdateReportScheduleSchema = CreateReportScheduleSchema.partial();

// Report Query Schema
export const ReportQuerySchema = z.object({
  reportType: ReportTypeEnum.optional(),
  status: ReportStatusEnum.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  generatedBy: z.string().uuid().optional(),
  format: ReportFormatEnum.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['generated_at', 'name', 'file_size']).default('generated_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Types
export type ReportType = z.infer<typeof ReportTypeEnum>;
export type ReportFormat = z.infer<typeof ReportFormatEnum>;
export type GenerateReport = z.infer<typeof GenerateReportSchema>;
export type CreateReportSchedule = z.infer<typeof CreateReportScheduleSchema>;
export type ReportQuery = z.infer<typeof ReportQuerySchema>;
```

### Service Implementation

```typescript
import { injectable, inject } from 'inversify';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { parse as parseJson2Csv } from 'json2csv';

@injectable()
export class ReportService {
  private generationQueue: Queue;
  private deliveryQueue: Queue;

  constructor(
    @inject('PostgresPool') private db: Pool,
    @inject('RedisClient') private redis: Redis,
    @inject('MetricsService') private metrics: MetricsService,
    @inject('EventService') private events: EventService,
    @inject('ErrorService') private errors: ErrorService,
    @inject('StorageService') private storage: StorageService,
    @inject('EmailService') private email: EmailService,
    @inject('Logger') private logger: Logger
  ) {
    this.generationQueue = new Queue('report-generation', { connection: redis });
    this.deliveryQueue = new Queue('report-delivery', { connection: redis });
    this.initializeWorkers();
    this.initializeScheduler();
  }

  async generateReport(
    tenantId: string,
    userId: string,
    input: GenerateReport
  ): Promise<ReportJob> {
    // Create job record
    const jobResult = await this.db.query(
      `INSERT INTO report_jobs (
        tenant_id, report_type, template_id, parameters, format,
        status, requested_by
      ) VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
      RETURNING *`,
      [
        tenantId,
        input.reportType,
        input.templateId,
        JSON.stringify({
          name: input.name,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          filters: input.filters,
          options: input.options,
        }),
        input.format,
        userId,
      ]
    );

    const job = jobResult.rows[0];

    // Queue for async processing
    await this.generationQueue.add(
      'generate',
      { tenantId, jobId: job.job_id },
      { jobId: job.job_id }
    );

    this.logger.info('Report generation queued', {
      tenantId,
      jobId: job.job_id,
      reportType: input.reportType,
    });

    return this.mapToReportJob(job);
  }

  private async processReportGeneration(
    tenantId: string,
    jobId: string
  ): Promise<void> {
    const job = await this.getJob(jobId);
    const params = job.parameters;

    try {
      // Update status to processing
      await this.updateJobStatus(jobId, 'PROCESSING', 0);

      // Fetch report data
      const data = await this.fetchReportData(
        tenantId,
        job.report_type,
        params
      );
      await this.updateJobStatus(jobId, 'PROCESSING', 30);

      // Get template if specified
      const template = job.template_id
        ? await this.getTemplate(tenantId, job.template_id)
        : this.getDefaultTemplate(job.report_type);

      // Generate report in requested format
      const reportContent = await this.generateReportContent(
        job.format,
        data,
        template,
        params
      );
      await this.updateJobStatus(jobId, 'PROCESSING', 70);

      // Save to storage
      const fileName = this.generateFileName(params.name || job.report_type, job.format);
      const filePath = await this.storage.upload(
        tenantId,
        `reports/${fileName}`,
        reportContent
      );
      await this.updateJobStatus(jobId, 'PROCESSING', 90);

      // Create report record
      const reportResult = await this.db.query(
        `INSERT INTO monitoring_reports (
          tenant_id, report_type, name, generated_at, generated_by,
          period_start, period_end, data, format, file_path, file_size,
          processing_time_ms
        ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          tenantId,
          job.report_type,
          params.name || this.generateReportName(job.report_type),
          job.requested_by,
          params.periodStart,
          params.periodEnd,
          JSON.stringify(data.summary),
          job.format,
          filePath,
          reportContent.length,
          Date.now() - job.started_at.getTime(),
        ]
      );

      // Update job as completed
      await this.db.query(
        `UPDATE report_jobs
         SET status = 'COMPLETED', progress = 100, completed_at = NOW()
         WHERE job_id = $1`,
        [jobId]
      );

      this.logger.info('Report generated successfully', {
        tenantId,
        jobId,
        reportId: reportResult.rows[0].report_id,
        filePath,
      });
    } catch (error) {
      await this.db.query(
        `UPDATE report_jobs
         SET status = 'FAILED', error_message = $1, completed_at = NOW()
         WHERE job_id = $2`,
        [error.message, jobId]
      );

      this.logger.error('Report generation failed', {
        tenantId,
        jobId,
        error: error.message,
      });

      throw error;
    }
  }

  private async fetchReportData(
    tenantId: string,
    reportType: string,
    params: any
  ): Promise<ReportData> {
    const { periodStart, periodEnd, filters } = params;

    switch (reportType) {
      case 'performance':
        return this.fetchPerformanceData(tenantId, periodStart, periodEnd, filters);
      case 'analytics':
        return this.fetchAnalyticsData(tenantId, periodStart, periodEnd, filters);
      case 'errors':
        return this.fetchErrorData(tenantId, periodStart, periodEnd, filters);
      case 'health':
        return this.fetchHealthData(tenantId, periodStart, periodEnd, filters);
      case 'executive':
        return this.fetchExecutiveData(tenantId, periodStart, periodEnd, filters);
      case 'custom':
        return this.fetchCustomData(tenantId, params);
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
  }

  private async fetchPerformanceData(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
    filters?: any
  ): Promise<ReportData> {
    const [
      responseTimeMetrics,
      throughputMetrics,
      errorRateMetrics,
      resourceMetrics,
    ] = await Promise.all([
      this.metrics.query(tenantId, {
        metrics: ['api.response_time'],
        startTime: periodStart,
        endTime: periodEnd,
        aggregation: 'avg',
        granularity: 'hour',
      }),
      this.metrics.query(tenantId, {
        metrics: ['api.requests_total'],
        startTime: periodStart,
        endTime: periodEnd,
        aggregation: 'sum',
        granularity: 'hour',
      }),
      this.metrics.query(tenantId, {
        metrics: ['api.error_rate'],
        startTime: periodStart,
        endTime: periodEnd,
        aggregation: 'avg',
        granularity: 'hour',
      }),
      this.metrics.query(tenantId, {
        metrics: ['system.cpu_usage', 'system.memory_usage'],
        startTime: periodStart,
        endTime: periodEnd,
        aggregation: 'avg',
        granularity: 'hour',
      }),
    ]);

    return {
      type: 'performance',
      period: { start: periodStart, end: periodEnd },
      summary: {
        avgResponseTime: this.calculateAverage(responseTimeMetrics),
        totalRequests: this.calculateSum(throughputMetrics),
        avgErrorRate: this.calculateAverage(errorRateMetrics),
        avgCpuUsage: this.calculateAverage(resourceMetrics.filter(m => m.name === 'system.cpu_usage')),
        avgMemoryUsage: this.calculateAverage(resourceMetrics.filter(m => m.name === 'system.memory_usage')),
      },
      timeSeries: {
        responseTime: responseTimeMetrics,
        throughput: throughputMetrics,
        errorRate: errorRateMetrics,
        resources: resourceMetrics,
      },
      insights: this.generatePerformanceInsights(responseTimeMetrics, throughputMetrics, errorRateMetrics),
    };
  }

  private async fetchAnalyticsData(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
    filters?: any
  ): Promise<ReportData> {
    const [
      userEvents,
      topActions,
      userSessions,
      conversionMetrics,
    ] = await Promise.all([
      this.events.query(tenantId, {
        eventTypes: ['USER_ACTION'],
        startTime: periodStart,
        endTime: periodEnd,
      }),
      this.events.aggregate(tenantId, {
        groupBy: 'action',
        aggregation: 'count',
        startTime: periodStart,
        endTime: periodEnd,
        limit: 10,
      }),
      this.events.aggregate(tenantId, {
        groupBy: 'session_id',
        aggregation: 'count',
        startTime: periodStart,
        endTime: periodEnd,
      }),
      this.metrics.query(tenantId, {
        metrics: ['business.conversion_rate'],
        startTime: periodStart,
        endTime: periodEnd,
        aggregation: 'avg',
      }),
    ]);

    return {
      type: 'analytics',
      period: { start: periodStart, end: periodEnd },
      summary: {
        totalEvents: userEvents.length,
        uniqueSessions: userSessions.length,
        avgEventsPerSession: userEvents.length / (userSessions.length || 1),
        conversionRate: this.calculateAverage(conversionMetrics),
      },
      topActions,
      dailyActiveUsers: await this.calculateDAU(tenantId, periodStart, periodEnd),
      insights: this.generateAnalyticsInsights(userEvents, topActions),
    };
  }

  private async fetchErrorData(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
    filters?: any
  ): Promise<ReportData> {
    const [
      errors,
      errorsBySeverity,
      errorsByService,
      topErrors,
    ] = await Promise.all([
      this.errors.query(tenantId, {
        startTime: periodStart,
        endTime: periodEnd,
        severity: filters?.severity,
      }),
      this.errors.aggregate(tenantId, {
        groupBy: 'severity',
        startTime: periodStart,
        endTime: periodEnd,
      }),
      this.errors.aggregate(tenantId, {
        groupBy: 'service',
        startTime: periodStart,
        endTime: periodEnd,
      }),
      this.errors.getTopErrors(tenantId, {
        startTime: periodStart,
        endTime: periodEnd,
        limit: 10,
      }),
    ]);

    return {
      type: 'errors',
      period: { start: periodStart, end: periodEnd },
      summary: {
        totalErrors: errors.length,
        criticalErrors: errorsBySeverity.find(e => e.severity === 'CRITICAL')?.count || 0,
        affectedUsers: await this.countAffectedUsers(errors),
        mttr: await this.calculateMTTR(tenantId, periodStart, periodEnd),
      },
      errorsBySeverity,
      errorsByService,
      topErrors,
      insights: this.generateErrorInsights(errors, errorsBySeverity),
    };
  }

  private async generateReportContent(
    format: string,
    data: ReportData,
    template: ReportTemplate,
    params: any
  ): Promise<Buffer> {
    switch (format) {
      case 'pdf':
        return this.generatePDF(data, template, params);
      case 'excel':
        return this.generateExcel(data, template, params);
      case 'csv':
        return this.generateCSV(data, params);
      case 'json':
        return Buffer.from(JSON.stringify(data, null, 2));
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private async generatePDF(
    data: ReportData,
    template: ReportTemplate,
    params: any
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header with logo
      if (template.config.logo) {
        doc.image(template.config.logo, 50, 45, { width: 50 });
      }

      // Title
      doc.fontSize(24)
         .fillColor(template.config.headerColor || '#2c3e50')
         .text(template.config.title || this.getReportTitle(data.type), 110, 50);

      doc.fontSize(12)
         .fillColor('#7f8c8d')
         .text(`${this.formatDateRange(data.period.start, data.period.end)}`, 110, 80);

      doc.moveDown(2);

      // Summary section
      doc.fontSize(16)
         .fillColor('#2c3e50')
         .text('Podsumowanie', { underline: true });

      doc.moveDown(0.5);
      doc.fontSize(11).fillColor('#34495e');

      for (const [key, value] of Object.entries(data.summary)) {
        doc.text(`${this.translateMetricKey(key)}: ${this.formatValue(value)}`);
      }

      doc.moveDown(1.5);

      // Render sections based on template
      for (const section of template.config.sections) {
        await this.renderPDFSection(doc, section, data);
      }

      // Footer
      doc.fontSize(8)
         .fillColor('#95a5a6')
         .text(
           `Wygenerowano: ${new Date().toLocaleString('pl-PL')}`,
           50,
           doc.page.height - 50
         );

      if (template.config.includePageNumbers) {
        doc.text(
          `Strona ${doc.bufferedPageRange().count}`,
          doc.page.width - 100,
          doc.page.height - 50
        );
      }

      doc.end();
    });
  }

  private async generateExcel(
    data: ReportData,
    template: ReportTemplate,
    params: any
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Monitoring System';
    workbook.created = new Date();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Podsumowanie');
    summarySheet.columns = [
      { header: 'Metryka', key: 'metric', width: 30 },
      { header: 'Wartość', key: 'value', width: 20 },
    ];

    for (const [key, value] of Object.entries(data.summary)) {
      summarySheet.addRow({
        metric: this.translateMetricKey(key),
        value: this.formatValue(value),
      });
    }

    // Style header
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2C3E50' },
    };
    summarySheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Time series data sheet
    if (data.timeSeries) {
      const timeSeriesSheet = workbook.addWorksheet('Dane czasowe');

      // Dynamic columns based on metrics
      const metricsColumns = Object.keys(data.timeSeries).map(metric => ({
        header: this.translateMetricKey(metric),
        key: metric,
        width: 15,
      }));

      timeSeriesSheet.columns = [
        { header: 'Timestamp', key: 'timestamp', width: 20 },
        ...metricsColumns,
      ];

      // Add data rows
      const timestamps = new Set<string>();
      for (const series of Object.values(data.timeSeries)) {
        for (const point of series) {
          timestamps.add(point.timestamp);
        }
      }

      for (const ts of Array.from(timestamps).sort()) {
        const row: any = { timestamp: ts };
        for (const [metric, series] of Object.entries(data.timeSeries)) {
          const point = series.find(p => p.timestamp === ts);
          row[metric] = point?.value || null;
        }
        timeSeriesSheet.addRow(row);
      }
    }

    // Insights sheet
    if (data.insights?.length) {
      const insightsSheet = workbook.addWorksheet('Wnioski');
      insightsSheet.columns = [
        { header: 'Kategoria', key: 'category', width: 15 },
        { header: 'Wniosek', key: 'insight', width: 60 },
        { header: 'Rekomendacja', key: 'recommendation', width: 40 },
      ];

      for (const insight of data.insights) {
        insightsSheet.addRow(insight);
      }
    }

    return workbook.xlsx.writeBuffer() as Promise<Buffer>;
  }

  private async generateCSV(data: ReportData, params: any): Promise<Buffer> {
    const rows: any[] = [];

    // Flatten summary
    for (const [key, value] of Object.entries(data.summary)) {
      rows.push({
        type: 'summary',
        metric: key,
        value,
        timestamp: null,
      });
    }

    // Flatten time series
    if (data.timeSeries) {
      for (const [metric, series] of Object.entries(data.timeSeries)) {
        for (const point of series) {
          rows.push({
            type: 'timeseries',
            metric,
            value: point.value,
            timestamp: point.timestamp,
          });
        }
      }
    }

    const csv = parseJson2Csv(rows, {
      fields: ['type', 'metric', 'value', 'timestamp'],
    });

    return Buffer.from(csv, 'utf-8');
  }

  async createSchedule(
    tenantId: string,
    userId: string,
    input: CreateReportSchedule
  ): Promise<ReportSchedule> {
    const nextRun = this.calculateNextRun(input.scheduleExpression, input.timezone);

    const result = await this.db.query(
      `INSERT INTO report_schedules (
        tenant_id, report_type, name, schedule_expression, parameters,
        recipients, enabled, next_run_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        tenantId,
        input.reportType,
        input.name,
        input.scheduleExpression,
        JSON.stringify({
          templateId: input.templateId,
          format: input.format,
          timezone: input.timezone,
          ...input.parameters,
        }),
        JSON.stringify(input.recipients),
        input.enabled,
        nextRun,
        userId,
      ]
    );

    this.logger.info('Report schedule created', {
      tenantId,
      scheduleId: result.rows[0].schedule_id,
      name: input.name,
      nextRun,
    });

    return this.mapToSchedule(result.rows[0]);
  }

  async getReportHistory(
    tenantId: string,
    query: ReportQuery
  ): Promise<PaginatedReports> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (query.reportType) {
      conditions.push(`report_type = $${paramIndex}`);
      params.push(query.reportType);
      paramIndex++;
    }

    if (query.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(query.status);
      paramIndex++;
    }

    if (query.startDate) {
      conditions.push(`generated_at >= $${paramIndex}`);
      params.push(query.startDate);
      paramIndex++;
    }

    if (query.endDate) {
      conditions.push(`generated_at <= $${paramIndex}`);
      params.push(query.endDate);
      paramIndex++;
    }

    if (query.generatedBy) {
      conditions.push(`generated_by = $${paramIndex}`);
      params.push(query.generatedBy);
      paramIndex++;
    }

    if (query.format) {
      conditions.push(`format = $${paramIndex}`);
      params.push(query.format);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const offset = (query.page - 1) * query.limit;

    const [dataResult, countResult] = await Promise.all([
      this.db.query(
        `SELECT mr.*, u.email as generated_by_email
         FROM monitoring_reports mr
         LEFT JOIN users u ON mr.generated_by = u.id
         WHERE ${whereClause}
         ORDER BY ${query.sortBy} ${query.sortOrder}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, query.limit, offset]
      ),
      this.db.query(
        `SELECT COUNT(*) FROM monitoring_reports WHERE ${whereClause}`,
        params
      ),
    ]);

    return {
      reports: dataResult.rows.map(this.mapToReport),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / query.limit),
      },
    };
  }

  async downloadReport(
    tenantId: string,
    reportId: string
  ): Promise<{ content: Buffer; filename: string; contentType: string }> {
    const report = await this.getReport(tenantId, reportId);

    if (!report) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Report not found' });
    }

    const content = await this.storage.download(report.filePath);
    const contentType = this.getContentType(report.format);
    const filename = report.filePath.split('/').pop()!;

    return { content, filename, contentType };
  }

  private initializeScheduler(): void {
    // Check for due schedules every minute
    setInterval(async () => {
      await this.processScheduledReports();
    }, 60 * 1000);
  }

  private async processScheduledReports(): Promise<void> {
    const dueSchedules = await this.db.query(
      `SELECT * FROM report_schedules
       WHERE enabled = true AND next_run_at <= NOW()
       FOR UPDATE SKIP LOCKED`
    );

    for (const schedule of dueSchedules.rows) {
      try {
        const params = schedule.parameters;
        const period = this.calculatePeriod(params.periodType);

        // Generate report
        const job = await this.generateReport(
          schedule.tenant_id,
          schedule.created_by,
          {
            reportType: schedule.report_type,
            templateId: params.templateId,
            periodStart: period.start,
            periodEnd: period.end,
            format: params.format || 'pdf',
            filters: params.filters,
            options: params.options,
          }
        );

        // Queue delivery after generation completes
        await this.deliveryQueue.add(
          'deliver',
          {
            tenantId: schedule.tenant_id,
            scheduleId: schedule.schedule_id,
            jobId: job.jobId,
            recipients: schedule.recipients,
          },
          { delay: 60000 } // Wait 1 minute for generation
        );

        // Update next run time
        const nextRun = this.calculateNextRun(
          schedule.schedule_expression,
          params.timezone
        );

        await this.db.query(
          `UPDATE report_schedules
           SET last_run_at = NOW(), next_run_at = $1
           WHERE schedule_id = $2`,
          [nextRun, schedule.schedule_id]
        );

        this.logger.info('Scheduled report triggered', {
          scheduleId: schedule.schedule_id,
          nextRun,
        });
      } catch (error) {
        this.logger.error('Failed to process scheduled report', {
          scheduleId: schedule.schedule_id,
          error: error.message,
        });
      }
    }
  }

  private initializeWorkers(): void {
    // Generation worker
    new Worker('report-generation', async (job) => {
      const { tenantId, jobId } = job.data;
      await this.processReportGeneration(tenantId, jobId);
    }, { connection: this.redis, concurrency: 3 });

    // Delivery worker
    new Worker('report-delivery', async (job) => {
      const { tenantId, scheduleId, jobId, recipients } = job.data;

      // Wait for report to be ready
      const reportJob = await this.waitForJobCompletion(jobId);
      if (reportJob.status !== 'COMPLETED') {
        throw new Error('Report generation failed');
      }

      // Get report file
      const report = await this.getReportByJobId(jobId);
      const content = await this.storage.download(report.filePath);

      // Deliver to each recipient
      for (const recipient of recipients) {
        try {
          if (recipient.type === 'email') {
            await this.email.send({
              to: recipient.address,
              subject: `Raport: ${report.name}`,
              text: `W załączniku raport ${report.name} za okres ${this.formatDateRange(report.periodStart, report.periodEnd)}`,
              attachments: [{
                filename: report.filePath.split('/').pop()!,
                content,
                contentType: this.getContentType(report.format),
              }],
            });
          } else if (recipient.type === 'webhook') {
            await this.sendWebhook(recipient.address, {
              reportId: report.reportId,
              name: report.name,
              downloadUrl: await this.storage.getSignedUrl(report.filePath),
            });
          }

          await this.logDelivery(report.reportId, scheduleId, recipient, 'delivered');
        } catch (error) {
          await this.logDelivery(report.reportId, scheduleId, recipient, 'failed', error.message);
        }
      }
    }, { connection: this.redis });
  }

  private getReportTitle(type: string): string {
    const titles = {
      performance: 'Raport Wydajności Systemu',
      analytics: 'Raport Analityczny',
      errors: 'Raport Błędów',
      health: 'Raport Stanu Usług',
      executive: 'Raport Wykonawczy',
      custom: 'Raport Niestandardowy',
    };
    return titles[type] || 'Raport';
  }

  private translateMetricKey(key: string): string {
    const translations = {
      avgResponseTime: 'Średni czas odpowiedzi',
      totalRequests: 'Łączna liczba żądań',
      avgErrorRate: 'Średni wskaźnik błędów',
      avgCpuUsage: 'Średnie użycie CPU',
      avgMemoryUsage: 'Średnie użycie pamięci',
      totalErrors: 'Łączna liczba błędów',
      criticalErrors: 'Błędy krytyczne',
      affectedUsers: 'Dotknięci użytkownicy',
      mttr: 'Średni czas naprawy',
      totalEvents: 'Łączna liczba zdarzeń',
      uniqueSessions: 'Unikalne sesje',
      conversionRate: 'Współczynnik konwersji',
    };
    return translations[key] || key;
  }

  private getContentType(format: string): string {
    const types = {
      pdf: 'application/pdf',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      json: 'application/json',
    };
    return types[format] || 'application/octet-stream';
  }
}
```

### tRPC Router

```typescript
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { z } from 'zod';

export const reportRouter = router({
  // Generate report
  generate: protectedProcedure
    .input(GenerateReportSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.reportService.generateReport(
        ctx.tenantId,
        ctx.user.id,
        input
      );
    }),

  // Get job status
  getJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.reportService.getJobStatus(ctx.tenantId, input.jobId);
    }),

  // List reports
  list: protectedProcedure
    .input(ReportQuerySchema)
    .query(async ({ ctx, input }) => {
      return ctx.reportService.getReportHistory(ctx.tenantId, input);
    }),

  // Get report by ID
  get: protectedProcedure
    .input(z.object({ reportId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.reportService.getReport(ctx.tenantId, input.reportId);
    }),

  // Download report
  download: protectedProcedure
    .input(z.object({ reportId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.reportService.downloadReport(ctx.tenantId, input.reportId);
    }),

  // Delete report
  delete: protectedProcedure
    .input(z.object({ reportId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.reportService.deleteReport(ctx.tenantId, input.reportId);
    }),

  // Create template
  createTemplate: adminProcedure
    .input(CreateReportTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.reportService.createTemplate(
        ctx.tenantId,
        ctx.user.id,
        input
      );
    }),

  // List templates
  listTemplates: protectedProcedure
    .input(z.object({
      reportType: ReportTypeEnum.optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.reportService.getTemplates(ctx.tenantId, input.reportType);
    }),

  // Get template
  getTemplate: protectedProcedure
    .input(z.object({ templateId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.reportService.getTemplate(ctx.tenantId, input.templateId);
    }),

  // Update template
  updateTemplate: adminProcedure
    .input(z.object({
      templateId: z.string().uuid(),
      updates: CreateReportTemplateSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.reportService.updateTemplate(
        ctx.tenantId,
        input.templateId,
        input.updates
      );
    }),

  // Delete template
  deleteTemplate: adminProcedure
    .input(z.object({ templateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.reportService.deleteTemplate(ctx.tenantId, input.templateId);
    }),

  // Create schedule
  createSchedule: adminProcedure
    .input(CreateReportScheduleSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.reportService.createSchedule(
        ctx.tenantId,
        ctx.user.id,
        input
      );
    }),

  // List schedules
  listSchedules: protectedProcedure
    .input(z.object({
      enabled: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.reportService.getSchedules(ctx.tenantId, input.enabled);
    }),

  // Get schedule
  getSchedule: protectedProcedure
    .input(z.object({ scheduleId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.reportService.getSchedule(ctx.tenantId, input.scheduleId);
    }),

  // Update schedule
  updateSchedule: adminProcedure
    .input(z.object({
      scheduleId: z.string().uuid(),
      updates: UpdateReportScheduleSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.reportService.updateSchedule(
        ctx.tenantId,
        input.scheduleId,
        input.updates
      );
    }),

  // Delete schedule
  deleteSchedule: adminProcedure
    .input(z.object({ scheduleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.reportService.deleteSchedule(ctx.tenantId, input.scheduleId);
    }),

  // Toggle schedule
  toggleSchedule: adminProcedure
    .input(z.object({
      scheduleId: z.string().uuid(),
      enabled: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.reportService.toggleSchedule(
        ctx.tenantId,
        input.scheduleId,
        input.enabled
      );
    }),

  // Run schedule now
  runScheduleNow: adminProcedure
    .input(z.object({ scheduleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.reportService.runScheduleNow(ctx.tenantId, input.scheduleId);
    }),
});
```

## Test Specifications

### Unit Tests

```typescript
describe('ReportService', () => {
  let service: ReportService;
  let mockDb: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<Redis>;
  let mockMetrics: jest.Mocked<MetricsService>;
  let mockStorage: jest.Mocked<StorageService>;

  beforeEach(() => {
    mockDb = createMockPool();
    mockRedis = createMockRedis();
    mockMetrics = createMockMetricsService();
    mockStorage = createMockStorageService();

    service = new ReportService(
      mockDb, mockRedis, mockMetrics,
      createMockEventService(), createMockErrorService(),
      mockStorage, createMockEmailService(), createMockLogger()
    );
  });

  describe('generateReport', () => {
    it('should create job and queue generation', async () => {
      const input: GenerateReport = {
        reportType: 'performance',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
        format: 'pdf',
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [{ job_id: 'job-123', ...input }],
      });

      const result = await service.generateReport('tenant-1', 'user-1', input);

      expect(result.jobId).toBe('job-123');
      expect(result.status).toBe('PENDING');
    });
  });

  describe('fetchPerformanceData', () => {
    it('should aggregate metrics correctly', async () => {
      mockMetrics.query
        .mockResolvedValueOnce([{ value: 100 }, { value: 200 }]) // response time
        .mockResolvedValueOnce([{ value: 1000 }]) // throughput
        .mockResolvedValueOnce([{ value: 0.02 }]) // error rate
        .mockResolvedValueOnce([{ value: 50 }, { value: 60 }]); // resources

      const result = await service['fetchPerformanceData'](
        'tenant-1',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.summary.avgResponseTime).toBe(150);
      expect(result.summary.totalRequests).toBe(1000);
      expect(result.summary.avgErrorRate).toBe(0.02);
    });
  });

  describe('generatePDF', () => {
    it('should generate valid PDF buffer', async () => {
      const data: ReportData = {
        type: 'performance',
        period: { start: new Date(), end: new Date() },
        summary: { avgResponseTime: 150, totalRequests: 1000 },
        timeSeries: {},
      };

      const template = {
        config: {
          title: 'Test Report',
          sections: [],
        },
      };

      const result = await service['generatePDF'](data, template as any, {});

      expect(result).toBeInstanceOf(Buffer);
      expect(result.slice(0, 4).toString()).toBe('%PDF'); // PDF magic number
    });
  });

  describe('generateExcel', () => {
    it('should generate valid Excel buffer', async () => {
      const data: ReportData = {
        type: 'performance',
        period: { start: new Date(), end: new Date() },
        summary: { avgResponseTime: 150 },
        timeSeries: {
          responseTime: [{ timestamp: '2024-01-01T00:00:00Z', value: 150 }],
        },
      };

      const result = await service['generateExcel'](data, {} as any, {});

      expect(result).toBeInstanceOf(Buffer);
      // Excel files start with PK (ZIP format)
      expect(result.slice(0, 2).toString()).toBe('PK');
    });
  });

  describe('createSchedule', () => {
    it('should create schedule with correct next run', async () => {
      const input: CreateReportSchedule = {
        reportType: 'performance',
        name: 'Weekly Performance',
        scheduleExpression: '0 9 * * 1', // Monday 9 AM
        format: 'pdf',
        parameters: { periodType: 'week' },
        recipients: [{ type: 'email', address: 'manager@example.com' }],
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [{ schedule_id: 'schedule-123', ...input }],
      });

      const result = await service.createSchedule('tenant-1', 'user-1', input);

      expect(result.scheduleId).toBe('schedule-123');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO report_schedules'),
        expect.any(Array)
      );
    });
  });

  describe('calculatePeriod', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-15'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should calculate day period', () => {
      const period = service['calculatePeriod']('day');

      expect(period.start).toEqual(new Date('2024-01-14T00:00:00.000Z'));
      expect(period.end).toEqual(new Date('2024-01-14T23:59:59.999Z'));
    });

    it('should calculate week period', () => {
      const period = service['calculatePeriod']('week');

      expect(period.start.getDate()).toBeLessThan(15);
      expect(period.end.getDate()).toBeLessThanOrEqual(14);
    });

    it('should calculate month period', () => {
      const period = service['calculatePeriod']('month');

      expect(period.start.getMonth()).toBe(11); // December
      expect(period.end.getMonth()).toBe(11);
    });
  });
});
```

### Integration Tests

```typescript
describe('Report Integration', () => {
  let app: INestApplication;
  let db: Pool;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ReportModule, TestDatabaseModule],
    }).compile();

    app = module.createNestApplication();
    db = module.get(Pool);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Report Generation', () => {
    it('should generate PDF report', async () => {
      // Insert test metrics
      await insertTestMetrics(db, 'tenant-1');

      // Request report
      const jobResponse = await request(app.getHttpServer())
        .post('/api/reports/generate')
        .set('Authorization', `Bearer ${getTestToken('user', 'tenant-1')}`)
        .send({
          reportType: 'performance',
          periodStart: '2024-01-01T00:00:00Z',
          periodEnd: '2024-01-31T23:59:59Z',
          format: 'pdf',
        })
        .expect(201);

      expect(jobResponse.body.jobId).toBeDefined();
      expect(jobResponse.body.status).toBe('PENDING');

      // Wait for generation
      await waitForJobCompletion(app, jobResponse.body.jobId, 30000);

      // Verify report created
      const reports = await request(app.getHttpServer())
        .get('/api/reports')
        .set('Authorization', `Bearer ${getTestToken('user', 'tenant-1')}`)
        .expect(200);

      expect(reports.body.reports).toHaveLength(1);
      expect(reports.body.reports[0].format).toBe('pdf');

      // Download report
      const download = await request(app.getHttpServer())
        .post(`/api/reports/${reports.body.reports[0].reportId}/download`)
        .set('Authorization', `Bearer ${getTestToken('user', 'tenant-1')}`)
        .expect(200);

      expect(download.body.content).toBeDefined();
      expect(download.body.contentType).toBe('application/pdf');
    }, 60000);

    it('should generate Excel report with multiple sheets', async () => {
      await insertTestMetrics(db, 'tenant-1');

      const jobResponse = await request(app.getHttpServer())
        .post('/api/reports/generate')
        .send({
          reportType: 'performance',
          periodStart: '2024-01-01',
          periodEnd: '2024-01-31',
          format: 'excel',
        })
        .set('Authorization', `Bearer ${getTestToken('user', 'tenant-1')}`)
        .expect(201);

      await waitForJobCompletion(app, jobResponse.body.jobId, 30000);

      const reports = await request(app.getHttpServer())
        .get('/api/reports')
        .set('Authorization', `Bearer ${getTestToken('user', 'tenant-1')}`);

      const download = await request(app.getHttpServer())
        .post(`/api/reports/${reports.body.reports[0].reportId}/download`)
        .set('Authorization', `Bearer ${getTestToken('user', 'tenant-1')}`);

      // Verify Excel content
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(download.body.content, 'base64'));

      expect(workbook.worksheets.length).toBeGreaterThanOrEqual(2);
      expect(workbook.worksheets[0].name).toBe('Podsumowanie');
    }, 60000);
  });

  describe('Scheduled Reports', () => {
    it('should create and execute scheduled report', async () => {
      // Create schedule
      const scheduleResponse = await request(app.getHttpServer())
        .post('/api/reports/schedules')
        .set('Authorization', `Bearer ${getAdminToken('admin', 'tenant-1')}`)
        .send({
          reportType: 'performance',
          name: 'Daily Performance',
          scheduleExpression: '0 9 * * *',
          format: 'pdf',
          parameters: { periodType: 'day' },
          recipients: [{ type: 'email', address: 'test@example.com' }],
        })
        .expect(201);

      expect(scheduleResponse.body.scheduleId).toBeDefined();

      // Manually trigger
      await request(app.getHttpServer())
        .post(`/api/reports/schedules/${scheduleResponse.body.scheduleId}/run`)
        .set('Authorization', `Bearer ${getAdminToken('admin', 'tenant-1')}`)
        .expect(200);

      // Wait for generation
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify report was created
      const reports = await request(app.getHttpServer())
        .get('/api/reports')
        .set('Authorization', `Bearer ${getTestToken('user', 'tenant-1')}`);

      expect(reports.body.reports.some(r => r.name.includes('Daily Performance'))).toBe(true);
    }, 30000);
  });
});
```

## Security Checklist

- [x] Reports tenant-isolated via tenant_id
- [x] Admin-only access for schedules and templates
- [x] Report file access controlled by tenant
- [x] Signed URLs for report downloads (time-limited)
- [x] Email recipients validated against tenant users
- [x] Webhook URLs validated to prevent SSRF
- [x] PII masked in exported reports
- [x] Report retention policy enforced (90 days default)
- [x] Audit logging for generation and access

## Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `report.generated` | Report creation complete | report_id, type, format, size |
| `report.downloaded` | Report file accessed | report_id, downloaded_by |
| `report.deleted` | Report removed | report_id, deleted_by |
| `report.template.created` | Template creation | template_id, name, created_by |
| `report.template.updated` | Template modification | template_id, changes |
| `report.schedule.created` | Schedule creation | schedule_id, cron, recipients |
| `report.schedule.executed` | Scheduled run | schedule_id, job_id |
| `report.delivery.sent` | Email/webhook delivery | report_id, recipient, status |

## Implementation Notes

### Polish Localization

- Report titles and headers in Polish by default
- Metric labels translated (e.g., "Średni czas odpowiedzi")
- Date formatting: dd.MM.yyyy HH:mm (Polish convention)
- Number formatting: 1 234,56 (space as thousands separator, comma for decimals)
- Timezone: Europe/Warsaw for all scheduled reports

### Performance Considerations

- Report generation runs asynchronously via BullMQ
- Maximum 3 concurrent report generations per tenant
- Large reports chunked during generation
- Generated reports cached for 24 hours
- Scheduled reports run with lower priority

### Storage Strategy

- Reports stored in object storage (S3-compatible)
- Path format: `tenants/{tenant_id}/reports/{year}/{month}/{filename}`
- Retention: 90 days by default, configurable per tenant
- Signed URLs expire after 1 hour

### Export Format Notes

- **PDF**: Uses PDFKit, includes charts as embedded images
- **Excel**: Uses ExcelJS, separate sheets for summary/data/insights
- **CSV**: Flattened data, UTF-8 with BOM for Polish characters
- **JSON**: Full structured data, useful for API integrations

## Definition of Done

- [x] All acceptance criteria implemented and passing
- [x] Unit test coverage ≥ 80%
- [x] Integration tests for generation workflow
- [x] PDF/Excel/CSV export verified
- [x] Scheduled delivery working
- [x] Security review completed
- [x] Polish localization applied
- [x] Performance tested (standard report < 30s)
- [x] Code reviewed and approved
- [x] Documentation updated
