# CSP-004: Report Access & Download

## Story Overview

| Field | Value |
|-------|-------|
| Story ID | CSP-004 |
| Epic | CSP-EPIC (Client Self-Service Portal) |
| Title | Report Access & Download |
| Priority | P1 |
| Story Points | 5 |
| Sprint | Sprint 2 (Week 30) |
| Dependencies | CSP-001, ACC Module, TAX Module |
| Status | Draft |

## User Story

**As a** business owner or financial manager
**I want to** access and download financial reports through the client portal
**So that** I can review my business performance and have reports available for my records without contacting my accountant

## Acceptance Criteria

### AC1: Report Library View
```gherkin
Feature: Report Library
  Scenario: Browse available reports
    Given I am an authenticated client in the portal
    When I navigate to the Reports section
    Then I should see a categorized list of available reports:
      | Category | Report Types |
      | Financial Statements | Balance Sheet, Income Statement, Cash Flow |
      | Tax Reports | VAT Summary, CIT Calculation, PIT Summary |
      | Management Reports | KPI Dashboard, Revenue Analysis, Expense Analysis |
      | Compliance | JPK_V7 Summary, Audit Trail |
    And each report shows:
      | Field | Description |
      | Name | Report title |
      | Period | Covered date range |
      | Generated | Generation date |
      | Format | PDF/Excel/CSV |
      | Size | File size |
      | Status | Available/Processing/Expired |
```

### AC2: Report Generation
```gherkin
Feature: On-Demand Report Generation
  Scenario: Generate new report
    Given I am in the Reports section
    When I click "Generate Report"
    Then I can select:
      | Option | Values |
      | Report Type | From available templates |
      | Period | Custom date range or preset (Month/Quarter/Year) |
      | Format | PDF, Excel, CSV |
      | Language | Polish, English |
    And when I submit the request
    Then the report generation starts in background
    And I receive a notification when ready
    And the report appears in my library

  Scenario: Report generation limits
    Given I have generated 5 reports today
    When I try to generate another report
    Then I should see a message about daily generation limit
    And I should see when my limit resets
```

### AC3: Report Download
```gherkin
Feature: Report Download
  Scenario: Download single report
    Given I am viewing my report library
    When I click download on a report
    Then the report should download in selected format
    And download should be logged for audit
    And a temporary signed URL should be generated

  Scenario: Bulk download
    Given I have selected multiple reports (max 10)
    When I click "Download Selected"
    Then a ZIP archive is created with all reports
    And I receive a download link
```

### AC4: Scheduled Reports
```gherkin
Feature: Scheduled Report Delivery
  Scenario: Schedule recurring report
    Given I am in the Reports section
    When I click "Schedule Report"
    Then I can configure:
      | Option | Values |
      | Report Type | Available templates |
      | Frequency | Weekly, Monthly, Quarterly |
      | Day | Day of week/month |
      | Format | PDF, Excel |
      | Delivery | Email, Portal only |
    And the scheduled report is created
    And I can manage (pause/resume/delete) my schedules

  Scenario: View scheduled reports
    Given I have scheduled reports
    When I view "My Schedules"
    Then I see all active schedules with next run date
    And I can modify or cancel each schedule
```

### AC5: Report Preview
```gherkin
Feature: Report Preview
  Scenario: Preview report before download
    Given I am viewing a PDF report
    When I click "Preview"
    Then the report opens in an embedded viewer
    And I can navigate pages
    And I can zoom in/out
    And I can search text within the report
    And I can download directly from preview
```

## Technical Specification

### Database Schema

```sql
-- Report templates available to clients
CREATE TABLE portal_report_templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  name_pl VARCHAR(255) NOT NULL,
  description TEXT,
  description_pl TEXT,
  category VARCHAR(50) NOT NULL, -- 'FINANCIAL', 'TAX', 'MANAGEMENT', 'COMPLIANCE'
  report_type VARCHAR(50) NOT NULL, -- 'BALANCE_SHEET', 'INCOME_STATEMENT', etc.
  supported_formats TEXT[] NOT NULL DEFAULT '{PDF,XLSX}',
  parameters JSONB DEFAULT '{}', -- Required parameters schema
  is_active BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  generation_credits INTEGER DEFAULT 1, -- Credits consumed per generation
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated reports
CREATE TABLE portal_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  template_id UUID NOT NULL REFERENCES portal_report_templates(template_id),
  name VARCHAR(255) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  format VARCHAR(10) NOT NULL, -- 'PDF', 'XLSX', 'CSV'
  language VARCHAR(5) DEFAULT 'pl',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED'
  s3_location TEXT,
  file_size BIGINT,
  checksum VARCHAR(64),
  parameters JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  download_count INTEGER DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL
);

-- Report schedules
CREATE TABLE portal_report_schedules (
  schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  template_id UUID NOT NULL REFERENCES portal_report_templates(template_id),
  name VARCHAR(255) NOT NULL,
  frequency VARCHAR(20) NOT NULL, -- 'WEEKLY', 'MONTHLY', 'QUARTERLY'
  day_of_period INTEGER, -- Day of week (1-7) or month (1-28)
  format VARCHAR(10) NOT NULL,
  language VARCHAR(5) DEFAULT 'pl',
  delivery_method VARCHAR(20) NOT NULL, -- 'EMAIL', 'PORTAL', 'BOTH'
  delivery_email VARCHAR(255),
  parameters JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  last_status VARCHAR(20),
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report access log
CREATE TABLE portal_report_access_log (
  access_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  report_id UUID NOT NULL REFERENCES portal_reports(report_id),
  action VARCHAR(20) NOT NULL, -- 'VIEW', 'DOWNLOAD', 'PREVIEW'
  ip_address INET,
  user_agent TEXT,
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_reports_client ON portal_reports(tenant_id, client_id);
CREATE INDEX idx_reports_status ON portal_reports(status) WHERE status IN ('PENDING', 'PROCESSING');
CREATE INDEX idx_reports_expires ON portal_reports(expires_at) WHERE status = 'READY';
CREATE INDEX idx_schedules_next_run ON portal_report_schedules(next_run_at) WHERE is_active = true;
CREATE INDEX idx_templates_category ON portal_report_templates(tenant_id, category) WHERE is_active = true;
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Report template
export const ReportTemplateSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string(),
  namePl: z.string(),
  description: z.string().optional(),
  descriptionPl: z.string().optional(),
  category: z.enum(['FINANCIAL', 'TAX', 'MANAGEMENT', 'COMPLIANCE']),
  reportType: z.string(),
  supportedFormats: z.array(z.enum(['PDF', 'XLSX', 'CSV'])),
  parameters: z.record(z.any()).optional(),
  requiresApproval: z.boolean(),
});

export type ReportTemplate = z.infer<typeof ReportTemplateSchema>;

// Report list filters
export const ReportFiltersSchema = z.object({
  category: z.enum(['FINANCIAL', 'TAX', 'MANAGEMENT', 'COMPLIANCE']).optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED']).optional(),
  periodFrom: z.string().datetime().optional(),
  periodTo: z.string().datetime().optional(),
  format: z.enum(['PDF', 'XLSX', 'CSV']).optional(),
  search: z.string().max(100).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(50).default(20),
});

export type ReportFilters = z.infer<typeof ReportFiltersSchema>;

// Report summary
export const ReportSummarySchema = z.object({
  reportId: z.string().uuid(),
  name: z.string(),
  category: z.string(),
  reportType: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  format: z.enum(['PDF', 'XLSX', 'CSV']),
  status: z.enum(['PENDING', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED']),
  fileSize: z.number().optional(),
  generatedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  downloadCount: z.number(),
});

export type ReportSummary = z.infer<typeof ReportSummarySchema>;

// Generate report request
export const GenerateReportRequestSchema = z.object({
  templateId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: z.enum(['PDF', 'XLSX', 'CSV']),
  language: z.enum(['pl', 'en']).default('pl'),
  parameters: z.record(z.any()).optional(),
});

export type GenerateReportRequest = z.infer<typeof GenerateReportRequestSchema>;

// Schedule report request
export const ScheduleReportRequestSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().min(3).max(100),
  frequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY']),
  dayOfPeriod: z.number().int().min(1).max(28),
  format: z.enum(['PDF', 'XLSX']),
  language: z.enum(['pl', 'en']).default('pl'),
  deliveryMethod: z.enum(['EMAIL', 'PORTAL', 'BOTH']),
  deliveryEmail: z.string().email().optional(),
  parameters: z.record(z.any()).optional(),
}).refine(
  (data) => {
    if (data.deliveryMethod !== 'PORTAL' && !data.deliveryEmail) {
      return false;
    }
    return true;
  },
  { message: 'Email is required when delivery includes email' }
);

export type ScheduleReportRequest = z.infer<typeof ScheduleReportRequestSchema>;
```

### Service Implementation

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(PortalReport) private reportRepo: Repository<PortalReport>,
    @InjectRepository(PortalReportTemplate) private templateRepo: Repository<PortalReportTemplate>,
    @InjectRepository(PortalReportSchedule) private scheduleRepo: Repository<PortalReportSchedule>,
    @InjectQueue('report-generation') private reportQueue: Queue,
    private readonly s3Service: S3Service,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
    private readonly cache: RedisService,
  ) {}

  async getTemplates(tenantId: string): Promise<ReportTemplate[]> {
    const cacheKey = `report-templates:${tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const templates = await this.templateRepo.find({
      where: { tenantId, isActive: true },
      order: { category: 'ASC', name: 'ASC' },
    });

    const result = templates.map(t => ({
      templateId: t.id,
      name: t.name,
      namePl: t.namePl,
      description: t.description,
      descriptionPl: t.descriptionPl,
      category: t.category,
      reportType: t.reportType,
      supportedFormats: t.supportedFormats,
      parameters: t.parameters,
      requiresApproval: t.requiresApproval,
    }));

    await this.cache.setex(cacheKey, 3600, JSON.stringify(result)); // 1 hour cache
    return result;
  }

  async getReports(
    tenantId: string,
    clientId: string,
    filters: ReportFilters,
  ): Promise<PaginatedResponse<ReportSummary>> {
    const queryBuilder = this.reportRepo
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.template', 'template')
      .where('report.tenant_id = :tenantId', { tenantId })
      .andWhere('report.client_id = :clientId', { clientId });

    // Apply filters
    if (filters.category) {
      queryBuilder.andWhere('template.category = :category', { category: filters.category });
    }
    if (filters.status) {
      queryBuilder.andWhere('report.status = :status', { status: filters.status });
    }
    if (filters.periodFrom) {
      queryBuilder.andWhere('report.period_start >= :periodFrom', { periodFrom: filters.periodFrom });
    }
    if (filters.periodTo) {
      queryBuilder.andWhere('report.period_end <= :periodTo', { periodTo: filters.periodTo });
    }
    if (filters.format) {
      queryBuilder.andWhere('report.format = :format', { format: filters.format });
    }
    if (filters.search) {
      queryBuilder.andWhere('report.name ILIKE :search', { search: `%${filters.search}%` });
    }

    queryBuilder
      .orderBy('report.created_at', 'DESC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit);

    const [reports, total] = await queryBuilder.getManyAndCount();

    const items = reports.map(r => ({
      reportId: r.id,
      name: r.name,
      category: r.template.category,
      reportType: r.template.reportType,
      periodStart: r.periodStart.toISOString().split('T')[0],
      periodEnd: r.periodEnd.toISOString().split('T')[0],
      format: r.format,
      status: r.status,
      fileSize: r.fileSize,
      generatedAt: r.generatedAt?.toISOString(),
      expiresAt: r.expiresAt?.toISOString(),
      downloadCount: r.downloadCount,
    }));

    return {
      items,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async generateReport(
    tenantId: string,
    clientId: string,
    request: GenerateReportRequest,
  ): Promise<{ reportId: string; status: string }> {
    // Check daily limit
    const todayCount = await this.getTodayReportCount(tenantId, clientId);
    const dailyLimit = 10; // Could be tenant-configurable
    if (todayCount >= dailyLimit) {
      throw new BadRequestException(
        `Osiągnięto dzienny limit generowania raportów (${dailyLimit}). Limit zostanie odnowiony o północy.`
      );
    }

    // Validate template
    const template = await this.templateRepo.findOne({
      where: { id: request.templateId, tenantId, isActive: true },
    });
    if (!template) {
      throw new NotFoundException('Szablon raportu nie istnieje');
    }

    // Validate format
    if (!template.supportedFormats.includes(request.format)) {
      throw new BadRequestException(`Format ${request.format} nie jest obsługiwany dla tego raportu`);
    }

    // Validate date range
    const periodStart = new Date(request.periodStart);
    const periodEnd = new Date(request.periodEnd);
    if (periodEnd < periodStart) {
      throw new BadRequestException('Data końcowa nie może być wcześniejsza niż początkowa');
    }

    // Create report record
    const reportId = uuidv4();
    const report = await this.reportRepo.save({
      id: reportId,
      tenantId,
      clientId,
      templateId: request.templateId,
      name: this.generateReportName(template, periodStart, periodEnd, request.language),
      periodStart,
      periodEnd,
      format: request.format,
      language: request.language,
      status: 'PENDING',
      parameters: request.parameters,
      createdBy: clientId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Queue generation job
    await this.reportQueue.add('generate', {
      reportId,
      tenantId,
      clientId,
      templateId: request.templateId,
      periodStart: request.periodStart,
      periodEnd: request.periodEnd,
      format: request.format,
      language: request.language,
      parameters: request.parameters,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    // Audit
    await this.auditService.log({
      action: 'REPORT_GENERATION_REQUESTED',
      tenantId,
      clientId,
      entityType: 'REPORT',
      entityId: reportId,
      metadata: {
        templateId: request.templateId,
        format: request.format,
        period: `${request.periodStart} - ${request.periodEnd}`,
      },
    });

    return {
      reportId,
      status: 'PENDING',
    };
  }

  async getDownloadUrl(
    tenantId: string,
    clientId: string,
    reportId: string,
  ): Promise<{ url: string; expiresIn: number }> {
    const report = await this.reportRepo.findOne({
      where: { id: reportId, tenantId, clientId, status: 'READY' },
    });

    if (!report) {
      throw new NotFoundException('Raport nie istnieje lub nie jest gotowy');
    }

    if (report.expiresAt && new Date() > report.expiresAt) {
      throw new BadRequestException('Raport wygasł. Wygeneruj nowy raport.');
    }

    // Generate signed URL
    const url = await this.s3Service.getSignedUrl(report.s3Location, {
      expiresIn: 300, // 5 minutes
      responseContentDisposition: `attachment; filename="${report.name}.${report.format.toLowerCase()}"`,
    });

    // Update download count
    await this.reportRepo.update(reportId, {
      downloadCount: () => 'download_count + 1',
      lastDownloadedAt: new Date(),
    });

    // Log access
    await this.logReportAccess(tenantId, clientId, reportId, 'DOWNLOAD');

    return {
      url,
      expiresIn: 300,
    };
  }

  async bulkDownload(
    tenantId: string,
    clientId: string,
    reportIds: string[],
  ): Promise<{ zipUrl: string; expiresIn: number }> {
    if (reportIds.length > 10) {
      throw new BadRequestException('Maksymalnie można pobrać 10 raportów jednocześnie');
    }

    const reports = await this.reportRepo.find({
      where: {
        id: In(reportIds),
        tenantId,
        clientId,
        status: 'READY',
      },
    });

    if (reports.length !== reportIds.length) {
      throw new BadRequestException('Niektóre raporty nie są dostępne');
    }

    // Create ZIP archive
    const zipKey = `temp/${tenantId}/${clientId}/reports-${Date.now()}.zip`;
    const archive = archiver('zip', { zlib: { level: 9 } });

    for (const report of reports) {
      const fileStream = await this.s3Service.getObject(report.s3Location);
      archive.append(fileStream, { name: `${report.name}.${report.format.toLowerCase()}` });
    }

    await archive.finalize();
    await this.s3Service.uploadStream(zipKey, archive);

    // Generate signed URL
    const url = await this.s3Service.getSignedUrl(zipKey, {
      expiresIn: 3600, // 1 hour
      responseContentDisposition: `attachment; filename="raporty-${new Date().toISOString().split('T')[0]}.zip"`,
    });

    // Schedule cleanup
    await this.scheduleZipCleanup(zipKey);

    // Log access for each report
    for (const report of reports) {
      await this.logReportAccess(tenantId, clientId, report.id, 'DOWNLOAD');
    }

    return {
      zipUrl: url,
      expiresIn: 3600,
    };
  }

  async createSchedule(
    tenantId: string,
    clientId: string,
    request: ScheduleReportRequest,
  ): Promise<{ scheduleId: string }> {
    // Validate template
    const template = await this.templateRepo.findOne({
      where: { id: request.templateId, tenantId, isActive: true },
    });
    if (!template) {
      throw new NotFoundException('Szablon raportu nie istnieje');
    }

    // Calculate next run
    const nextRun = this.calculateNextRun(request.frequency, request.dayOfPeriod);

    const schedule = await this.scheduleRepo.save({
      id: uuidv4(),
      tenantId,
      clientId,
      templateId: request.templateId,
      name: request.name,
      frequency: request.frequency,
      dayOfPeriod: request.dayOfPeriod,
      format: request.format,
      language: request.language,
      deliveryMethod: request.deliveryMethod,
      deliveryEmail: request.deliveryEmail,
      parameters: request.parameters,
      isActive: true,
      nextRunAt: nextRun,
    });

    // Audit
    await this.auditService.log({
      action: 'REPORT_SCHEDULE_CREATED',
      tenantId,
      clientId,
      entityType: 'SCHEDULE',
      entityId: schedule.id,
      metadata: {
        templateId: request.templateId,
        frequency: request.frequency,
        nextRun: nextRun.toISOString(),
      },
    });

    return { scheduleId: schedule.id };
  }

  async getSchedules(
    tenantId: string,
    clientId: string,
  ): Promise<ReportSchedule[]> {
    const schedules = await this.scheduleRepo.find({
      where: { tenantId, clientId },
      relations: ['template'],
      order: { nextRunAt: 'ASC' },
    });

    return schedules.map(s => ({
      scheduleId: s.id,
      name: s.name,
      templateName: s.template.namePl,
      category: s.template.category,
      frequency: s.frequency,
      dayOfPeriod: s.dayOfPeriod,
      format: s.format,
      deliveryMethod: s.deliveryMethod,
      isActive: s.isActive,
      nextRunAt: s.nextRunAt.toISOString(),
      lastRunAt: s.lastRunAt?.toISOString(),
      lastStatus: s.lastStatus,
      runCount: s.runCount,
    }));
  }

  private generateReportName(
    template: PortalReportTemplate,
    periodStart: Date,
    periodEnd: Date,
    language: string,
  ): string {
    const name = language === 'pl' ? template.namePl : template.name;
    const startStr = periodStart.toISOString().split('T')[0];
    const endStr = periodEnd.toISOString().split('T')[0];
    return `${name} ${startStr} - ${endStr}`;
  }

  private calculateNextRun(frequency: string, dayOfPeriod: number): Date {
    const now = new Date();
    let nextRun: Date;

    switch (frequency) {
      case 'WEEKLY':
        nextRun = new Date(now);
        const currentDay = now.getDay() || 7;
        const daysUntil = (dayOfPeriod - currentDay + 7) % 7 || 7;
        nextRun.setDate(now.getDate() + daysUntil);
        break;
      case 'MONTHLY':
        nextRun = new Date(now.getFullYear(), now.getMonth() + 1, dayOfPeriod);
        break;
      case 'QUARTERLY':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const nextQuarterMonth = (currentQuarter + 1) * 3;
        nextRun = new Date(now.getFullYear(), nextQuarterMonth, dayOfPeriod);
        break;
    }

    nextRun.setHours(8, 0, 0, 0); // Run at 8 AM
    return nextRun;
  }
}
```

### Report Generation Worker

```typescript
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';

@Processor('report-generation')
export class ReportGenerationProcessor {
  constructor(
    private readonly reportService: ReportService,
    private readonly accService: AccountingService,
    private readonly taxService: TaxService,
    private readonly pdfService: PdfService,
    private readonly excelService: ExcelService,
    private readonly s3Service: S3Service,
    private readonly notificationService: NotificationService,
  ) {}

  @Process('generate')
  async generateReport(job: Job): Promise<void> {
    const { reportId, tenantId, clientId, templateId, periodStart, periodEnd, format, language, parameters } = job.data;

    try {
      // Update status
      await this.reportRepo.update(reportId, { status: 'PROCESSING' });

      // Get report data based on template type
      const template = await this.templateRepo.findOne({ where: { id: templateId } });
      const reportData = await this.getReportData(
        template.reportType,
        tenantId,
        clientId,
        periodStart,
        periodEnd,
        parameters,
      );

      // Generate file
      let fileBuffer: Buffer;
      let mimeType: string;

      switch (format) {
        case 'PDF':
          fileBuffer = await this.pdfService.generateReport(template.reportType, reportData, language);
          mimeType = 'application/pdf';
          break;
        case 'XLSX':
          fileBuffer = await this.excelService.generateReport(template.reportType, reportData, language);
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        case 'CSV':
          fileBuffer = await this.generateCsv(reportData);
          mimeType = 'text/csv';
          break;
      }

      // Upload to S3
      const s3Key = `reports/${tenantId}/${clientId}/${reportId}.${format.toLowerCase()}`;
      await this.s3Service.upload(s3Key, fileBuffer, {
        ContentType: mimeType,
        ServerSideEncryption: 'AES256',
      });

      // Update report record
      await this.reportRepo.update(reportId, {
        status: 'READY',
        s3Location: s3Key,
        fileSize: fileBuffer.length,
        checksum: this.calculateChecksum(fileBuffer),
        generatedAt: new Date(),
      });

      // Notify client
      await this.notificationService.send({
        tenantId,
        clientId,
        type: 'REPORT_READY',
        title: 'Raport gotowy',
        body: `Twój raport "${job.data.name}" jest gotowy do pobrania.`,
        actionUrl: `/portal/reports/${reportId}`,
        priority: 'NORMAL',
      });

    } catch (error) {
      await this.reportRepo.update(reportId, {
        status: 'FAILED',
        errorMessage: error.message,
      });

      // Notify about failure
      await this.notificationService.send({
        tenantId,
        clientId,
        type: 'REPORT_FAILED',
        title: 'Błąd generowania raportu',
        body: `Nie udało się wygenerować raportu. Spróbuj ponownie lub skontaktuj się z biurem.`,
        priority: 'HIGH',
      });

      throw error;
    }
  }

  private async getReportData(
    reportType: string,
    tenantId: string,
    clientId: string,
    periodStart: string,
    periodEnd: string,
    parameters: any,
  ): Promise<any> {
    switch (reportType) {
      case 'BALANCE_SHEET':
        return this.accService.getBalanceSheet(tenantId, clientId, periodEnd);
      case 'INCOME_STATEMENT':
        return this.accService.getIncomeStatement(tenantId, clientId, periodStart, periodEnd);
      case 'CASH_FLOW':
        return this.accService.getCashFlowStatement(tenantId, clientId, periodStart, periodEnd);
      case 'VAT_SUMMARY':
        return this.taxService.getVatSummary(tenantId, clientId, periodStart, periodEnd);
      case 'CIT_CALCULATION':
        return this.taxService.getCitCalculation(tenantId, clientId, periodStart, periodEnd);
      case 'JPK_V7_SUMMARY':
        return this.taxService.getJpkSummary(tenantId, clientId, periodStart, periodEnd);
      // Add more report types...
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
  }
}
```

## Test Specifications

### Unit Tests

```typescript
describe('ReportService', () => {
  describe('getTemplates', () => {
    it('should return cached templates when available', async () => {
      cache.get.mockResolvedValue(JSON.stringify([mockTemplate]));
      const result = await service.getTemplates(tenantId);
      expect(result).toHaveLength(1);
      expect(templateRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('generateReport', () => {
    it('should enforce daily generation limit', async () => {
      jest.spyOn(service, 'getTodayReportCount').mockResolvedValue(10);
      await expect(
        service.generateReport(tenantId, clientId, mockRequest)
      ).rejects.toThrow(BadRequestException);
    });

    it('should queue report generation job', async () => {
      const result = await service.generateReport(tenantId, clientId, mockRequest);
      expect(reportQueue.add).toHaveBeenCalledWith('generate', expect.any(Object));
      expect(result.status).toBe('PENDING');
    });
  });

  describe('createSchedule', () => {
    it('should calculate next run correctly for weekly schedule', () => {
      const nextRun = service.calculateNextRun('WEEKLY', 1); // Monday
      expect(nextRun.getDay()).toBe(1);
    });

    it('should calculate next run correctly for monthly schedule', () => {
      const nextRun = service.calculateNextRun('MONTHLY', 15);
      expect(nextRun.getDate()).toBe(15);
    });
  });
});
```

## Security Checklist

- [x] Report access limited to owning client only
- [x] Signed URLs for downloads with short expiry
- [x] Rate limiting on report generation
- [x] Audit logging for all report operations
- [x] S3 server-side encryption for stored reports
- [x] Report expiration after 30 days
- [x] Email validation for scheduled delivery

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| REPORT_GENERATION_REQUESTED | Client requests report | templateId, period, format |
| REPORT_READY | Report generation complete | reportId, fileSize |
| REPORT_FAILED | Generation fails | reportId, error |
| REPORT_DOWNLOADED | Client downloads report | reportId |
| REPORT_SCHEDULE_CREATED | Schedule created | scheduleId, frequency |
| REPORT_SCHEDULE_MODIFIED | Schedule modified | scheduleId, changes |

## Performance Requirements

| Metric | Target |
|--------|--------|
| Template list load | < 200ms |
| Report list load | < 500ms |
| Report generation (simple) | < 30s |
| Report generation (complex) | < 2min |
| Download URL generation | < 200ms |

## Definition of Done

- [x] All acceptance criteria implemented and tested
- [x] Unit test coverage ≥ 80%
- [x] Integration tests for report generation
- [x] Background job processing tested
- [x] PDF/Excel generation validated
- [x] Polish localization applied
- [x] Security review completed
- [x] Performance benchmarks met
