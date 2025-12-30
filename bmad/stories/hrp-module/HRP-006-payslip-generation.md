# HRP-006: Payslip Generation & Distribution

## Story Information
- **Story ID**: HRP-006
- **Epic**: HR & Payroll Module (HRP)
- **Title**: Payslip Generation & Distribution
- **Priority**: High
- **Status**: Draft
- **Estimated Points**: 8
- **Sprint**: TBD

## User Story
**As a** Payroll Manager
**I want to** generate and distribute professional payslips to employees
**So that** employees receive clear documentation of their earnings and deductions

## Acceptance Criteria

### AC1: Payslip Generation
```gherkin
Given a payroll calculation is completed and approved
When I trigger payslip generation
Then the system should:
  - Generate PDF payslips for all employees in the batch
  - Include all required Polish payslip elements
  - Apply company branding and formatting
  - Store payslips securely with encryption
  - Process in batches for large employee counts (>100)
```

### AC2: Polish Payslip Requirements (Pasek płacowy)
```gherkin
Given payslips are generated for Polish employees
Then each payslip must include:
  | Section                    | Polish Name                    | Required |
  | Employee identification    | Dane pracownika                | Yes      |
  | Period                     | Okres rozliczeniowy            | Yes      |
  | Gross salary               | Wynagrodzenie brutto           | Yes      |
  | ZUS employee contributions | Składki ZUS pracownika         | Yes      |
  | Health insurance           | Składka zdrowotna              | Yes      |
  | Tax advance                | Zaliczka na podatek            | Yes      |
  | Deductions                 | Potrącenia                     | Yes      |
  | Additions/benefits         | Dodatki                        | Yes      |
  | Net salary                 | Wynagrodzenie netto            | Yes      |
  | Payment information        | Informacje o wypłacie          | Yes      |
  | Year-to-date summary       | Podsumowanie roczne            | Yes      |
  | Employer ZUS costs         | Składki ZUS pracodawcy         | Optional |
```

### AC3: Payslip Distribution
```gherkin
Given payslips are generated
When distribution is triggered
Then the system should support:
  | Method        | Description                              |
  | EMAIL         | Send encrypted PDF to employee email     |
  | PORTAL        | Upload to employee self-service portal   |
  | BOTH          | Email notification + portal access       |
And include:
  - Password protection option (last 4 PESEL digits)
  - Delivery confirmation tracking
  - Retry mechanism for failed deliveries
```

### AC4: Payslip History & Access
```gherkin
Given an employee needs to access payslips
When they access the payslip history
Then they should see:
  - List of all payslips with period and date
  - Download option for each payslip
  - Search by period or date range
  - Access log showing who viewed/downloaded
```

### AC5: Payslip Corrections
```gherkin
Given a payslip contains an error
When a correction is needed
Then the system should:
  - Generate a corrected payslip (Korekta)
  - Mark original as superseded
  - Include correction reference and reason
  - Distribute corrected version
  - Maintain audit trail
```

### AC6: Bulk Operations
```gherkin
Given a large batch of payslips
When processing bulk operations
Then the system should:
  - Support async processing via job queue
  - Show progress indicator
  - Handle partial failures gracefully
  - Provide summary report on completion
  - Allow retry of failed items
```

## Technical Specification

### Database Schema

```sql
-- Payslip records
CREATE TABLE payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  payroll_record_id UUID NOT NULL REFERENCES payroll_records(id),
  employee_id UUID NOT NULL REFERENCES employees(id),

  -- Period information
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,

  -- Document details
  payslip_number VARCHAR(100) NOT NULL,
  document_path TEXT NOT NULL,
  document_hash VARCHAR(64) NOT NULL,        -- SHA-256 for integrity
  file_size_bytes INTEGER NOT NULL,

  -- Status
  status VARCHAR(50) DEFAULT 'GENERATED',    -- GENERATED, DISTRIBUTED, VIEWED, DOWNLOADED

  -- Correction handling
  is_correction BOOLEAN DEFAULT false,
  correction_of UUID REFERENCES payslips(id),
  correction_reason TEXT,
  superseded_by UUID REFERENCES payslips(id),

  -- Distribution
  distribution_method VARCHAR(50),           -- EMAIL, PORTAL, BOTH
  distributed_at TIMESTAMPTZ,
  distribution_status VARCHAR(50),           -- PENDING, SENT, DELIVERED, FAILED
  distribution_error TEXT,

  -- Security
  is_password_protected BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL,

  UNIQUE(tenant_id, payroll_record_id),
  CONSTRAINT valid_correction CHECK (
    (is_correction = false AND correction_of IS NULL) OR
    (is_correction = true AND correction_of IS NOT NULL)
  )
);

-- Payslip access log
CREATE TABLE payslip_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id UUID NOT NULL REFERENCES payslips(id),

  action VARCHAR(50) NOT NULL,               -- VIEWED, DOWNLOADED, EMAILED
  accessed_by UUID NOT NULL,
  accessed_at TIMESTAMPTZ DEFAULT NOW(),

  ip_address INET,
  user_agent TEXT
);

-- Payslip templates
CREATE TABLE payslip_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Template content
  template_html TEXT NOT NULL,
  header_html TEXT,
  footer_html TEXT,

  -- Styling
  styles_css TEXT,
  logo_path TEXT,

  -- Configuration
  include_employer_costs BOOLEAN DEFAULT false,
  include_ytd_summary BOOLEAN DEFAULT true,
  language VARCHAR(5) DEFAULT 'pl',

  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL
);

-- Distribution jobs
CREATE TABLE payslip_distribution_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  batch_id UUID,                             -- Optional batch reference

  -- Job details
  total_payslips INTEGER NOT NULL,
  processed_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,

  status VARCHAR(50) DEFAULT 'PENDING',      -- PENDING, PROCESSING, COMPLETED, FAILED

  distribution_method VARCHAR(50) NOT NULL,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  error_summary JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL
);

-- Indexes
CREATE INDEX idx_payslips_employee ON payslips(employee_id);
CREATE INDEX idx_payslips_period ON payslips(year, month);
CREATE INDEX idx_payslips_status ON payslips(status);
CREATE INDEX idx_payslips_distribution ON payslips(distribution_status);
CREATE INDEX idx_payslip_access_payslip ON payslip_access_log(payslip_id);
CREATE INDEX idx_payslip_access_user ON payslip_access_log(accessed_by);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Payslip data for PDF generation
export const PayslipDataSchema = z.object({
  // Header
  companyName: z.string(),
  companyAddress: z.string(),
  companyNip: z.string(),
  companyLogo: z.string().optional(),

  // Employee
  employee: z.object({
    fullName: z.string(),
    employeeCode: z.string(),
    pesel: z.string(),
    position: z.string(),
    department: z.string(),
  }),

  // Period
  period: z.object({
    year: z.number(),
    month: z.number(),
    periodLabel: z.string(), // "Styczeń 2024"
  }),

  // Earnings
  earnings: z.object({
    baseSalary: z.number(),
    additions: z.array(z.object({
      name: z.string(),
      amount: z.number(),
    })),
    totalGross: z.number(),
  }),

  // ZUS Employee
  zusEmployee: z.object({
    retirement: z.number(),        // Emerytalne 9.76%
    disability: z.number(),        // Rentowe 1.5%
    sickness: z.number(),          // Chorobowe 2.45%
    total: z.number(),
  }),

  // Health Insurance
  healthInsurance: z.object({
    contribution: z.number(),      // 9%
    deductible: z.number(),        // 7.75%
  }),

  // Tax
  tax: z.object({
    base: z.number(),
    rate: z.number(),
    calculatedTax: z.number(),
    relief: z.number(),
    healthDeduction: z.number(),
    advance: z.number(),
  }),

  // Deductions
  deductions: z.array(z.object({
    name: z.string(),
    amount: z.number(),
  })),

  // Net
  netSalary: z.number(),

  // Payment
  payment: z.object({
    bankAccount: z.string(),
    paymentDate: z.string(),
    transferTitle: z.string(),
  }),

  // Year-to-date
  ytd: z.object({
    grossTotal: z.number(),
    zusTotal: z.number(),
    healthTotal: z.number(),
    taxTotal: z.number(),
    netTotal: z.number(),
  }),

  // Optional employer costs
  employerCosts: z.object({
    zusRetirement: z.number(),
    zusDisability: z.number(),
    zusAccident: z.number(),
    laborFund: z.number(),
    fgsp: z.number(),
    total: z.number(),
  }).optional(),
});

// Distribution request
export const PayslipDistributionSchema = z.object({
  payslipIds: z.array(z.string().uuid()).optional(),
  batchId: z.string().uuid().optional(),
  method: z.enum(['EMAIL', 'PORTAL', 'BOTH']),
  passwordProtect: z.boolean().default(true),
  sendNotification: z.boolean().default(true),
}).refine(
  data => data.payslipIds?.length || data.batchId,
  'Either payslipIds or batchId is required'
);

// Correction request
export const PayslipCorrectionSchema = z.object({
  originalPayslipId: z.string().uuid(),
  payrollRecordId: z.string().uuid(),
  reason: z.string().min(10).max(500),
});
```

### Service Implementation

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as PDFDocument from 'pdfkit';
import * as crypto from 'crypto';
import { db } from '@/db';

@Injectable()
export class PayslipService {
  private readonly logger = new Logger(PayslipService.name);

  constructor(
    @InjectQueue('payslip') private payslipQueue: Queue,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Generate payslips for a payroll batch
   */
  async generatePayslipsForBatch(
    batchId: string,
    options: { templateId?: string; includeEmployerCosts?: boolean }
  ): Promise<{ jobId: string; totalPayslips: number }> {
    const payrollRecords = await db.query.payrollRecords.findMany({
      where: eq(payrollRecords.batchId, batchId),
      with: {
        employee: true,
      },
    });

    if (payrollRecords.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No payroll records found for batch',
      });
    }

    // Queue batch processing job
    const job = await this.payslipQueue.add('generate-batch', {
      batchId,
      payrollRecordIds: payrollRecords.map(r => r.id),
      options,
    });

    return {
      jobId: job.id.toString(),
      totalPayslips: payrollRecords.length,
    };
  }

  /**
   * Generate single payslip PDF
   */
  async generatePayslipPdf(
    payrollRecordId: string,
    template: PayslipTemplate,
    options: { includeEmployerCosts?: boolean } = {}
  ): Promise<{ path: string; hash: string; size: number }> {
    const payrollRecord = await db.query.payrollRecords.findFirst({
      where: eq(payrollRecords.id, payrollRecordId),
      with: {
        employee: {
          with: {
            contracts: {
              where: eq(contracts.status, 'ACTIVE'),
              limit: 1,
            },
          },
        },
      },
    });

    if (!payrollRecord) {
      throw new Error(`Payroll record ${payrollRecordId} not found`);
    }

    // Build payslip data
    const payslipData = await this.buildPayslipData(payrollRecord, options);

    // Generate PDF
    const pdfBuffer = await this.renderPayslipPdf(payslipData, template);

    // Calculate hash for integrity
    const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    // Generate unique filename
    const filename = this.generatePayslipFilename(payrollRecord);

    // Store securely (encrypted at rest)
    const path = await this.storageService.uploadEncrypted(
      `payslips/${payrollRecord.year}/${payrollRecord.month}/${filename}`,
      pdfBuffer,
      'application/pdf'
    );

    return {
      path,
      hash,
      size: pdfBuffer.length,
    };
  }

  /**
   * Build payslip data structure
   */
  private async buildPayslipData(
    payrollRecord: PayrollRecordWithEmployee,
    options: { includeEmployerCosts?: boolean }
  ): Promise<PayslipData> {
    const employee = payrollRecord.employee;
    const contract = employee.contracts[0];

    // Get company info
    const company = await this.getCompanyInfo(payrollRecord.tenantId);

    // Get YTD totals
    const ytd = await this.calculateYtdTotals(employee.id, payrollRecord.year, payrollRecord.month);

    // Polish month names
    const monthNames = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];

    return {
      companyName: company.name,
      companyAddress: company.fullAddress,
      companyNip: company.nip,
      companyLogo: company.logoPath,

      employee: {
        fullName: `${employee.firstName} ${employee.lastName}`,
        employeeCode: employee.employeeCode,
        pesel: this.maskPesel(employee.pesel), // Show only last 4
        position: contract?.position || employee.position,
        department: employee.department,
      },

      period: {
        year: payrollRecord.year,
        month: payrollRecord.month,
        periodLabel: `${monthNames[payrollRecord.month - 1]} ${payrollRecord.year}`,
      },

      earnings: {
        baseSalary: payrollRecord.grossAmount,
        additions: payrollRecord.additions || [],
        totalGross: payrollRecord.grossAmount +
          (payrollRecord.additions?.reduce((s, a) => s + a.amount, 0) || 0),
      },

      zusEmployee: {
        retirement: payrollRecord.zusRetirementEmployee,
        disability: payrollRecord.zusDisabilityEmployee,
        sickness: payrollRecord.zusSickness,
        total: payrollRecord.zusTotalEmployee,
      },

      healthInsurance: {
        contribution: payrollRecord.healthContribution,
        deductible: payrollRecord.healthDeductible,
      },

      tax: {
        base: payrollRecord.taxBase,
        rate: payrollRecord.taxRate,
        calculatedTax: payrollRecord.taxAmount,
        relief: payrollRecord.taxRelief || 0,
        healthDeduction: payrollRecord.healthDeductible,
        advance: payrollRecord.taxAdvance,
      },

      deductions: payrollRecord.deductions || [],

      netSalary: payrollRecord.netAmount,

      payment: {
        bankAccount: this.maskBankAccount(employee.bankAccountNumber),
        paymentDate: this.formatDate(payrollRecord.paymentDate),
        transferTitle: `Wynagrodzenie ${monthNames[payrollRecord.month - 1]} ${payrollRecord.year}`,
      },

      ytd,

      employerCosts: options.includeEmployerCosts ? {
        zusRetirement: payrollRecord.zusRetirementEmployer,
        zusDisability: payrollRecord.zusDisabilityEmployer,
        zusAccident: payrollRecord.zusAccidentEmployer,
        laborFund: payrollRecord.zusLaborFund,
        fgsp: payrollRecord.zusFgsp,
        total: payrollRecord.employerTotalCost,
      } : undefined,
    };
  }

  /**
   * Render PDF using template
   */
  private async renderPayslipPdf(
    data: PayslipData,
    template: PayslipTemplate
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Pasek płacowy - ${data.period.periodLabel}`,
          Author: data.companyName,
          Subject: `Wynagrodzenie pracownika ${data.employee.fullName}`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Register Polish font
      doc.registerFont('Polish', 'fonts/DejaVuSans.ttf');
      doc.font('Polish');

      // Header with company info and logo
      this.renderHeader(doc, data, template);

      // Employee info section
      this.renderEmployeeSection(doc, data);

      // Earnings section
      this.renderEarningsSection(doc, data);

      // Deductions section (ZUS, health, tax)
      this.renderDeductionsSection(doc, data);

      // Net salary (highlighted)
      this.renderNetSalarySection(doc, data);

      // YTD summary
      if (template.includeYtdSummary) {
        this.renderYtdSection(doc, data);
      }

      // Employer costs (optional)
      if (data.employerCosts && template.includeEmployerCosts) {
        this.renderEmployerCostsSection(doc, data);
      }

      // Footer
      this.renderFooter(doc, data, template);

      doc.end();
    });
  }

  private renderHeader(doc: PDFKit.PDFDocument, data: PayslipData, template: PayslipTemplate): void {
    // Logo
    if (data.companyLogo) {
      doc.image(data.companyLogo, 50, 45, { width: 100 });
    }

    // Company name
    doc.fontSize(16).text(data.companyName, 200, 50, { align: 'right' });
    doc.fontSize(10).text(data.companyAddress, 200, 70, { align: 'right' });
    doc.text(`NIP: ${data.companyNip}`, 200, 85, { align: 'right' });

    // Title
    doc.moveDown(2);
    doc.fontSize(18).text('PASEK PŁACOWY', { align: 'center' });
    doc.fontSize(12).text(`za okres: ${data.period.periodLabel}`, { align: 'center' });

    doc.moveDown();
  }

  private renderEmployeeSection(doc: PDFKit.PDFDocument, data: PayslipData): void {
    doc.fontSize(11).text('DANE PRACOWNIKA', { underline: true });
    doc.moveDown(0.5);

    const startX = 50;
    doc.fontSize(10);
    doc.text(`Imię i nazwisko: ${data.employee.fullName}`, startX);
    doc.text(`Numer pracownika: ${data.employee.employeeCode}`, startX);
    doc.text(`PESEL: ${data.employee.pesel}`, startX);
    doc.text(`Stanowisko: ${data.employee.position}`, startX);
    doc.text(`Dział: ${data.employee.department}`, startX);

    doc.moveDown();
  }

  private renderEarningsSection(doc: PDFKit.PDFDocument, data: PayslipData): void {
    doc.fontSize(11).text('WYNAGRODZENIE BRUTTO', { underline: true });
    doc.moveDown(0.5);

    // Table header
    const startX = 50;
    const amountX = 450;
    doc.fontSize(10);

    // Base salary
    doc.text('Wynagrodzenie zasadnicze', startX);
    doc.text(this.formatMoney(data.earnings.baseSalary), amountX, doc.y - 12, { align: 'right' });

    // Additions
    for (const addition of data.earnings.additions) {
      doc.text(addition.name, startX);
      doc.text(this.formatMoney(addition.amount), amountX, doc.y - 12, { align: 'right' });
    }

    // Total gross
    doc.moveDown(0.5);
    doc.font('Polish-Bold').text('RAZEM BRUTTO', startX);
    doc.text(this.formatMoney(data.earnings.totalGross), amountX, doc.y - 12, { align: 'right' });
    doc.font('Polish');

    doc.moveDown();
  }

  private renderDeductionsSection(doc: PDFKit.PDFDocument, data: PayslipData): void {
    doc.fontSize(11).text('SKŁADKI I POTRĄCENIA', { underline: true });
    doc.moveDown(0.5);

    const startX = 50;
    const amountX = 450;
    doc.fontSize(10);

    // ZUS employee
    doc.text('Składki ZUS pracownika:', startX, doc.y, { underline: true });
    doc.text(`  - Emerytalna (9,76%)`, startX);
    doc.text(this.formatMoney(data.zusEmployee.retirement), amountX, doc.y - 12, { align: 'right' });
    doc.text(`  - Rentowa (1,50%)`, startX);
    doc.text(this.formatMoney(data.zusEmployee.disability), amountX, doc.y - 12, { align: 'right' });
    doc.text(`  - Chorobowa (2,45%)`, startX);
    doc.text(this.formatMoney(data.zusEmployee.sickness), amountX, doc.y - 12, { align: 'right' });
    doc.font('Polish-Bold').text(`  Razem ZUS pracownika`, startX);
    doc.text(this.formatMoney(data.zusEmployee.total), amountX, doc.y - 12, { align: 'right' });
    doc.font('Polish');

    doc.moveDown(0.5);

    // Health insurance
    doc.text('Składka zdrowotna (9%)', startX);
    doc.text(this.formatMoney(data.healthInsurance.contribution), amountX, doc.y - 12, { align: 'right' });

    doc.moveDown(0.5);

    // Tax
    doc.text(`Podstawa opodatkowania`, startX);
    doc.text(this.formatMoney(data.tax.base), amountX, doc.y - 12, { align: 'right' });
    doc.text(`Podatek naliczony (${(data.tax.rate * 100).toFixed(0)}%)`, startX);
    doc.text(this.formatMoney(data.tax.calculatedTax), amountX, doc.y - 12, { align: 'right' });
    if (data.tax.relief > 0) {
      doc.text(`Ulga podatkowa`, startX);
      doc.text(`-${this.formatMoney(data.tax.relief)}`, amountX, doc.y - 12, { align: 'right' });
    }
    doc.font('Polish-Bold').text(`Zaliczka na podatek`, startX);
    doc.text(this.formatMoney(data.tax.advance), amountX, doc.y - 12, { align: 'right' });
    doc.font('Polish');

    // Other deductions
    if (data.deductions.length > 0) {
      doc.moveDown(0.5);
      doc.text('Inne potrącenia:', startX);
      for (const deduction of data.deductions) {
        doc.text(`  - ${deduction.name}`, startX);
        doc.text(this.formatMoney(deduction.amount), amountX, doc.y - 12, { align: 'right' });
      }
    }

    doc.moveDown();
  }

  private renderNetSalarySection(doc: PDFKit.PDFDocument, data: PayslipData): void {
    // Highlighted box
    doc.rect(45, doc.y, 510, 30).fill('#e8f5e9');

    doc.fillColor('#1b5e20');
    doc.fontSize(14).font('Polish-Bold');
    doc.text('WYNAGRODZENIE NETTO DO WYPŁATY:', 50, doc.y - 25);
    doc.text(this.formatMoney(data.netSalary) + ' PLN', 450, doc.y - 14, { align: 'right' });

    doc.fillColor('black').font('Polish').fontSize(10);
    doc.moveDown(2);

    // Payment info
    doc.text(`Numer konta: ${data.payment.bankAccount}`);
    doc.text(`Data wypłaty: ${data.payment.paymentDate}`);
    doc.text(`Tytuł przelewu: ${data.payment.transferTitle}`);

    doc.moveDown();
  }

  private renderYtdSection(doc: PDFKit.PDFDocument, data: PayslipData): void {
    doc.fontSize(11).text('PODSUMOWANIE ROCZNE (narastająco)', { underline: true });
    doc.moveDown(0.5);

    const startX = 50;
    const amountX = 450;
    doc.fontSize(9);

    doc.text('Brutto narastająco', startX);
    doc.text(this.formatMoney(data.ytd.grossTotal), amountX, doc.y - 10, { align: 'right' });
    doc.text('ZUS narastająco', startX);
    doc.text(this.formatMoney(data.ytd.zusTotal), amountX, doc.y - 10, { align: 'right' });
    doc.text('Zdrowotne narastająco', startX);
    doc.text(this.formatMoney(data.ytd.healthTotal), amountX, doc.y - 10, { align: 'right' });
    doc.text('Podatek narastająco', startX);
    doc.text(this.formatMoney(data.ytd.taxTotal), amountX, doc.y - 10, { align: 'right' });
    doc.text('Netto narastająco', startX);
    doc.text(this.formatMoney(data.ytd.netTotal), amountX, doc.y - 10, { align: 'right' });

    doc.moveDown();
  }

  private renderEmployerCostsSection(doc: PDFKit.PDFDocument, data: PayslipData): void {
    if (!data.employerCosts) return;

    doc.fontSize(11).text('KOSZTY PRACODAWCY', { underline: true });
    doc.moveDown(0.5);

    const startX = 50;
    const amountX = 450;
    doc.fontSize(9);

    doc.text('Składka emerytalna pracodawcy (9,76%)', startX);
    doc.text(this.formatMoney(data.employerCosts.zusRetirement), amountX, doc.y - 10, { align: 'right' });
    doc.text('Składka rentowa pracodawcy (6,50%)', startX);
    doc.text(this.formatMoney(data.employerCosts.zusDisability), amountX, doc.y - 10, { align: 'right' });
    doc.text('Składka wypadkowa', startX);
    doc.text(this.formatMoney(data.employerCosts.zusAccident), amountX, doc.y - 10, { align: 'right' });
    doc.text('Fundusz Pracy (2,45%)', startX);
    doc.text(this.formatMoney(data.employerCosts.laborFund), amountX, doc.y - 10, { align: 'right' });
    doc.text('FGŚP (0,10%)', startX);
    doc.text(this.formatMoney(data.employerCosts.fgsp), amountX, doc.y - 10, { align: 'right' });

    doc.font('Polish-Bold');
    doc.text('Całkowity koszt pracodawcy', startX);
    doc.text(this.formatMoney(data.employerCosts.total), amountX, doc.y - 10, { align: 'right' });
    doc.font('Polish');

    doc.moveDown();
  }

  private renderFooter(doc: PDFKit.PDFDocument, data: PayslipData, template: PayslipTemplate): void {
    const pageHeight = doc.page.height;

    doc.fontSize(8);
    doc.text(
      'Dokument wygenerowany elektronicznie. Nie wymaga podpisu.',
      50,
      pageHeight - 50,
      { align: 'center' }
    );
    doc.text(
      `Wygenerowano: ${new Date().toLocaleString('pl-PL')}`,
      50,
      pageHeight - 40,
      { align: 'center' }
    );
  }

  /**
   * Distribute payslips
   */
  async distributePayslips(
    distribution: PayslipDistributionInput
  ): Promise<{ jobId: string }> {
    let payslipIds: string[];

    if (distribution.payslipIds) {
      payslipIds = distribution.payslipIds;
    } else {
      const payslips = await db.query.payslips.findMany({
        where: eq(payslips.batchId, distribution.batchId),
      });
      payslipIds = payslips.map(p => p.id);
    }

    // Create distribution job
    const [job] = await db.insert(payslipDistributionJobs).values({
      tenantId: distribution.tenantId,
      totalPayslips: payslipIds.length,
      distributionMethod: distribution.method,
      createdBy: distribution.userId,
    }).returning();

    // Queue distribution
    await this.payslipQueue.add('distribute', {
      jobId: job.id,
      payslipIds,
      method: distribution.method,
      passwordProtect: distribution.passwordProtect,
      sendNotification: distribution.sendNotification,
    });

    return { jobId: job.id };
  }

  /**
   * Send payslip via email
   */
  async sendPayslipEmail(
    payslip: Payslip,
    options: { passwordProtect: boolean }
  ): Promise<void> {
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, payslip.employeeId),
    });

    if (!employee?.email) {
      throw new Error('Employee email not found');
    }

    // Download and optionally password-protect PDF
    let pdfBuffer = await this.storageService.download(payslip.documentPath);

    if (options.passwordProtect) {
      const password = employee.pesel.slice(-4);
      pdfBuffer = await this.encryptPdf(pdfBuffer, password);
    }

    // Send email
    await this.emailService.send({
      to: employee.email,
      subject: `Pasek płacowy - ${this.getMonthName(payslip.month)} ${payslip.year}`,
      template: 'payslip-delivery',
      context: {
        employeeName: `${employee.firstName} ${employee.lastName}`,
        period: `${this.getMonthName(payslip.month)} ${payslip.year}`,
        passwordHint: options.passwordProtect ? 'Hasło: ostatnie 4 cyfry numeru PESEL' : undefined,
      },
      attachments: [
        {
          filename: `Pasek_${payslip.year}_${String(payslip.month).padStart(2, '0')}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  // Helper methods
  private formatMoney(amount: number): string {
    return amount.toLocaleString('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private maskPesel(pesel: string): string {
    return `*******${pesel.slice(-4)}`;
  }

  private maskBankAccount(account: string): string {
    return account.replace(/(.{2})(.*)(.{4})/, '$1 **** **** **** $3');
  }

  private formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('pl-PL');
  }

  private generatePayslipFilename(record: PayrollRecord): string {
    return `payslip_${record.employeeId}_${record.year}_${String(record.month).padStart(2, '0')}.pdf`;
  }

  private getMonthName(month: number): string {
    const names = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];
    return names[month - 1];
  }
}
```

### tRPC Router

```typescript
import { router, payrollManagerProcedure, employeeProcedure } from '@/trpc';
import { z } from 'zod';

export const payslipRouter = router({
  // Generate payslips for batch
  generateBatch: payrollManagerProcedure
    .input(z.object({
      batchId: z.string().uuid(),
      templateId: z.string().uuid().optional(),
      includeEmployerCosts: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.payslipService.generatePayslipsForBatch(input.batchId, input);
    }),

  // Distribute payslips
  distribute: payrollManagerProcedure
    .input(PayslipDistributionSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.payslipService.distributePayslips({
        ...input,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
      });
    }),

  // Get distribution job status
  getDistributionStatus: payrollManagerProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.payslipService.getDistributionJobStatus(input.jobId);
    }),

  // Employee: Get my payslips
  getMyPayslips: employeeProcedure
    .input(z.object({
      year: z.number().optional(),
      limit: z.number().min(1).max(50).default(12),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.payslipService.getEmployeePayslips(ctx.employeeId, input);
    }),

  // Employee: Download payslip
  downloadPayslip: employeeProcedure
    .input(z.object({ payslipId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.payslipService.downloadPayslip(input.payslipId, ctx.employeeId, ctx.userId);
    }),

  // Generate correction
  generateCorrection: payrollManagerProcedure
    .input(PayslipCorrectionSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.payslipService.generateCorrection(input, ctx.userId);
    }),

  // Template management
  listTemplates: payrollManagerProcedure
    .query(async ({ ctx }) => {
      return ctx.payslipService.listTemplates(ctx.tenantId);
    }),

  createTemplate: payrollManagerProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      templateHtml: z.string(),
      headerHtml: z.string().optional(),
      footerHtml: z.string().optional(),
      stylesCss: z.string().optional(),
      includeEmployerCosts: z.boolean().default(false),
      includeYtdSummary: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.payslipService.createTemplate(ctx.tenantId, input, ctx.userId);
    }),
});
```

## Test Specifications

### Unit Tests

```typescript
describe('PayslipService', () => {
  describe('buildPayslipData', () => {
    it('should build correct Polish payslip data', async () => {
      const payrollRecord = createMockPayrollRecord({
        grossAmount: 10000,
        zusRetirementEmployee: 976,
        zusDisabilityEmployee: 150,
        zusSickness: 245,
        healthContribution: 776.61,
        taxAdvance: 558,
        netAmount: 7294.39,
      });

      const data = await service.buildPayslipData(payrollRecord, {});

      expect(data.earnings.totalGross).toBe(10000);
      expect(data.zusEmployee.total).toBe(1371);
      expect(data.netSalary).toBe(7294.39);
      expect(data.period.periodLabel).toMatch(/^\w+ \d{4}$/);
    });

    it('should mask PESEL correctly', () => {
      const masked = service.maskPesel('90010112345');
      expect(masked).toBe('*******2345');
    });
  });

  describe('renderPayslipPdf', () => {
    it('should generate valid PDF buffer', async () => {
      const data = createMockPayslipData();
      const template = createMockTemplate();

      const buffer = await service.renderPayslipPdf(data, template);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    });

    it('should include employer costs when requested', async () => {
      const data = createMockPayslipData({ includeEmployerCosts: true });
      const template = createMockTemplate({ includeEmployerCosts: true });

      const buffer = await service.renderPayslipPdf(data, template);

      // Verify PDF contains employer costs section
      const pdfText = await extractTextFromPdf(buffer);
      expect(pdfText).toContain('KOSZTY PRACODAWCY');
    });
  });
});
```

## Security Checklist

- [x] Payslips encrypted at rest
- [x] Password protection option using PESEL
- [x] RLS policies for tenant isolation
- [x] Employee can only access own payslips
- [x] Access logging for all downloads
- [x] Secure email transmission
- [x] Document integrity via hash verification

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `PAYSLIP_GENERATED` | Payslip PDF created | Period, employee, hash |
| `PAYSLIP_DISTRIBUTED` | Payslip sent/uploaded | Method, recipient |
| `PAYSLIP_VIEWED` | Employee views payslip | Viewer, timestamp |
| `PAYSLIP_DOWNLOADED` | Employee downloads PDF | Viewer, IP |
| `PAYSLIP_CORRECTION_CREATED` | Correction generated | Original, reason |

## Definition of Done

- [ ] PDF generation with Polish formatting
- [ ] All required payslip sections implemented
- [ ] Email distribution working
- [ ] Portal upload working
- [ ] Password protection implemented
- [ ] Correction workflow functional
- [ ] Bulk processing tested (100+ payslips)
- [ ] Unit tests passing (≥80% coverage)
- [ ] Integration tests passing
- [ ] Security review completed
- [ ] Polish characters rendering correctly
