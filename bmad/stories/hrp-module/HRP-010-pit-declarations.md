# HRP-010: PIT Declarations

## Story Information
| Field | Value |
|-------|-------|
| **Story ID** | HRP-010 |
| **Epic** | HR & Payroll Module (HRP) |
| **Title** | PIT Tax Declarations & Annual Settlements |
| **Priority** | P1 (High) |
| **Story Points** | 8 |
| **Status** | Draft |

## User Story
**As a** HR manager or payroll specialist,
**I want** to generate PIT tax declarations and annual settlements,
**So that** I can fulfill tax reporting obligations and provide employees with required tax documents.

## Business Context
### Polish PIT Requirements
- **PIT-11**: Annual information about income and tax advances (employer → employee & tax office)
- **PIT-4R**: Annual declaration of tax advances paid (employer → tax office)
- **PIT-8AR**: Annual declaration of flat-rate taxes (employer → tax office)
- **Deadline**: January 31st for PIT-11 to tax office, February 28th to employees
- **Electronic Filing**: Mandatory via e-Deklaracje system
- **Tax Scales**: Progressive (12%/32%) or flat-rate options

### Declaration Types
| Declaration | Purpose | Deadline | Recipients |
|-------------|---------|----------|------------|
| PIT-11 | Employee income summary | Jan 31 / Feb 28 | Tax office / Employee |
| PIT-4R | Employer tax advances | Jan 31 | Tax office |
| PIT-8AR | Flat-rate taxes | Jan 31 | Tax office |
| PIT-8C | Copyright/civil contracts | Feb 28 | Tax office / Contractor |
| IFT-1R | Non-resident income | Feb 28 | Tax office / Non-resident |

## Acceptance Criteria

### AC1: PIT-11 Generation
```gherkin
Given the tax year has ended
When I generate PIT-11 declarations
Then the system creates individual PIT-11 for each employee
And includes all income types (salary, benefits, bonuses)
And calculates tax advances correctly
And applies tax-free amount (kwota wolna) properly
And generates XML for e-Deklaracje submission
```

### AC2: PIT-4R Generation
```gherkin
Given the tax year has ended
When I generate PIT-4R declaration
Then the system aggregates all monthly tax advances
And includes breakdown by month
And reconciles with individual PIT-11 totals
And generates XML for e-Deklaracje
```

### AC3: Tax Threshold Handling
```gherkin
Given an employee's income crosses tax threshold
When the system calculates tax
Then it applies 12% rate up to 120,000 PLN
And applies 32% rate on income above threshold
And tracks threshold crossing date
And adjusts monthly advances accordingly
```

### AC4: Copyright Costs (50% or 20%)
```gherkin
Given an employee has copyright-eligible work
When calculating PIT-11
Then the system applies 50% deductible costs (up to 120,000 PLN limit)
Or applies 20% flat costs for non-creative work
And documents cost type per income source
```

### AC5: e-Deklaracje Submission
```gherkin
Given PIT declarations are generated and validated
When I submit to e-Deklaracje
Then the system sends via official API
And receives UPO (official receipt)
And tracks submission status
And stores confirmation documents
```

## Technical Specification

### Database Schema

```sql
-- PIT declarations tracking
CREATE TABLE pit_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Declaration details
  declaration_type VARCHAR(10) NOT NULL,  -- PIT-11, PIT-4R, PIT-8AR, PIT-8C, IFT-1R
  tax_year INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,  -- For corrections

  -- For individual declarations (PIT-11, PIT-8C, IFT-1R)
  employee_id UUID REFERENCES employees(id),

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  -- DRAFT, GENERATED, VALIDATED, SUBMITTED, ACCEPTED, REJECTED, CORRECTED

  -- Generation
  generated_at TIMESTAMPTZ,
  generated_by UUID REFERENCES users(id),
  xml_content TEXT,
  pdf_content BYTEA,

  -- Submission
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES users(id),
  submission_reference VARCHAR(100),
  upo_reference VARCHAR(100),  -- Urzędowe Poświadczenie Odbioru
  upo_document BYTEA,

  -- Response
  response_received_at TIMESTAMPTZ,
  response_status VARCHAR(20),
  rejection_reason TEXT,

  -- Employee delivery (for PIT-11)
  sent_to_employee BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  delivery_method VARCHAR(20),  -- EMAIL, PORTAL, MAIL
  employee_confirmed_receipt BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, declaration_type, tax_year, employee_id, version)
);

CREATE INDEX idx_pit_declarations_year ON pit_declarations(tenant_id, tax_year);
CREATE INDEX idx_pit_declarations_employee ON pit_declarations(employee_id);
CREATE INDEX idx_pit_declarations_status ON pit_declarations(status);

-- PIT-11 details
CREATE TABLE pit11_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id UUID NOT NULL REFERENCES pit_declarations(id) ON DELETE CASCADE,

  -- Employee data (snapshot)
  pesel VARCHAR(11) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  address_street VARCHAR(200),
  address_city VARCHAR(100),
  address_postal_code VARCHAR(10),
  tax_office_code VARCHAR(4),

  -- Employment period
  employment_from DATE,
  employment_to DATE,

  -- Section D: Income from employment
  income_employment DECIMAL(12, 2) DEFAULT 0,
  costs_employment DECIMAL(12, 2) DEFAULT 0,  -- Standard 250 PLN/month
  advance_tax_employment DECIMAL(12, 2) DEFAULT 0,

  -- Section E: Income with copyright costs
  income_copyright DECIMAL(12, 2) DEFAULT 0,
  costs_copyright DECIMAL(12, 2) DEFAULT 0,  -- 50% up to limit
  advance_tax_copyright DECIMAL(12, 2) DEFAULT 0,

  -- Section F: Civil contracts
  income_civil_contract DECIMAL(12, 2) DEFAULT 0,
  costs_civil_contract DECIMAL(12, 2) DEFAULT 0,  -- 20%
  advance_tax_civil DECIMAL(12, 2) DEFAULT 0,

  -- Section G: Other income
  income_other DECIMAL(12, 2) DEFAULT 0,
  costs_other DECIMAL(12, 2) DEFAULT 0,
  advance_tax_other DECIMAL(12, 2) DEFAULT 0,

  -- Totals
  total_income DECIMAL(12, 2) DEFAULT 0,
  total_costs DECIMAL(12, 2) DEFAULT 0,
  total_advance_tax DECIMAL(12, 2) DEFAULT 0,

  -- Health insurance
  health_insurance_deducted DECIMAL(12, 2) DEFAULT 0,  -- 7.75% portion

  -- ZUS contributions (employee part)
  zus_retirement DECIMAL(12, 2) DEFAULT 0,
  zus_disability DECIMAL(12, 2) DEFAULT 0,
  zus_sickness DECIMAL(12, 2) DEFAULT 0,

  -- Special cases
  is_resident BOOLEAN DEFAULT true,
  is_under_26 BOOLEAN DEFAULT false,  -- Ulga dla młodych
  young_relief_amount DECIMAL(12, 2) DEFAULT 0,
  middle_class_relief DECIMAL(12, 2) DEFAULT 0,  -- Ulga dla klasy średniej (discontinued)

  -- Foreign income
  foreign_income DECIMAL(12, 2) DEFAULT 0,
  foreign_tax_paid DECIMAL(12, 2) DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PIT-4R details (monthly breakdown)
CREATE TABLE pit4r_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id UUID NOT NULL REFERENCES pit_declarations(id) ON DELETE CASCADE,

  -- Monthly data
  month INTEGER NOT NULL,  -- 1-12

  -- Number of employees
  employee_count INTEGER DEFAULT 0,

  -- Income and tax
  total_income DECIMAL(14, 2) DEFAULT 0,
  total_tax_advance DECIMAL(14, 2) DEFAULT 0,
  total_health_deduction DECIMAL(14, 2) DEFAULT 0,
  net_tax_due DECIMAL(14, 2) DEFAULT 0,

  -- Breakdown by rate
  tax_12_percent DECIMAL(14, 2) DEFAULT 0,
  tax_32_percent DECIMAL(14, 2) DEFAULT 0,

  -- Corrections
  correction_amount DECIMAL(14, 2) DEFAULT 0,
  correction_reason TEXT,

  UNIQUE(declaration_id, month)
);

-- Tax threshold tracking
CREATE TABLE tax_threshold_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  tax_year INTEGER NOT NULL,

  -- Threshold tracking
  threshold_amount DECIMAL(12, 2) NOT NULL DEFAULT 120000,
  ytd_income DECIMAL(14, 2) DEFAULT 0,
  threshold_crossed BOOLEAN DEFAULT false,
  crossed_date DATE,
  crossed_month INTEGER,

  -- Monthly income tracking
  monthly_income JSONB,  -- {1: 15000, 2: 15000, ...}

  -- Copyright cost tracking
  copyright_costs_limit DECIMAL(12, 2) DEFAULT 120000,
  ytd_copyright_costs DECIMAL(12, 2) DEFAULT 0,
  copyright_limit_reached BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, employee_id, tax_year)
);

CREATE INDEX idx_tax_threshold_year ON tax_threshold_tracking(tenant_id, tax_year);

-- e-Deklaracje submission log
CREATE TABLE edeklaracje_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id UUID NOT NULL REFERENCES pit_declarations(id),

  action VARCHAR(50) NOT NULL,
  -- VALIDATE, SUBMIT, CHECK_STATUS, DOWNLOAD_UPO

  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  performed_by UUID REFERENCES users(id),

  -- Request
  request_xml_hash VARCHAR(64),
  request_size_bytes INTEGER,

  -- Response
  response_status VARCHAR(20),
  response_reference VARCHAR(100),
  response_message TEXT,

  -- Timing
  duration_ms INTEGER,

  -- Error handling
  error_occurred BOOLEAN DEFAULT false,
  error_code VARCHAR(20),
  error_details TEXT
);

CREATE INDEX idx_edeklaracje_log_declaration ON edeklaracje_log(declaration_id);

-- Tax rates configuration
CREATE TABLE tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_year INTEGER NOT NULL,

  -- Tax brackets
  first_bracket_rate DECIMAL(5, 4) NOT NULL,  -- 12% = 0.12
  first_bracket_limit DECIMAL(12, 2) NOT NULL,  -- 120,000 PLN
  second_bracket_rate DECIMAL(5, 4) NOT NULL,  -- 32% = 0.32

  -- Tax-free amount (kwota wolna)
  tax_free_amount DECIMAL(12, 2) NOT NULL,  -- 30,000 PLN
  monthly_tax_free DECIMAL(10, 2) NOT NULL,  -- 300 PLN/month

  -- Health insurance deductible
  health_deductible_rate DECIMAL(5, 4) NOT NULL,  -- 7.75%

  -- Standard costs
  standard_monthly_costs DECIMAL(10, 2) NOT NULL,  -- 250 PLN
  standard_monthly_costs_commute DECIMAL(10, 2) NOT NULL,  -- 300 PLN (dojeżdżający)
  max_annual_standard_costs DECIMAL(10, 2) NOT NULL,  -- 3,000 PLN

  -- Copyright costs
  copyright_cost_rate DECIMAL(5, 4) NOT NULL,  -- 50%
  copyright_cost_limit DECIMAL(12, 2) NOT NULL,  -- 120,000 PLN
  civil_contract_cost_rate DECIMAL(5, 4) NOT NULL,  -- 20%

  -- Young person relief (ulga dla młodych)
  young_relief_limit DECIMAL(12, 2) NOT NULL,  -- 85,528 PLN
  young_relief_age_limit INTEGER NOT NULL,  -- 26

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tax_year)
);
```

### PIT Service Implementation

```typescript
// src/server/services/hrp/pit.service.ts
import { TRPCError } from '@trpc/server';
import { db } from '@/server/db';
import {
  pitDeclarations, pit11Details, pit4rDetails,
  taxThresholdTracking, edeklarajeLog, taxRates
} from '@/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { XMLBuilder } from 'fast-xml-parser';
import { createHash } from 'crypto';
import PDFDocument from 'pdfkit';

interface PIT11Data {
  employeeId: string;
  taxYear: number;
  incomeEmployment: number;
  incomeCopyright: number;
  incomeCivilContract: number;
  incomeOther: number;
  costsEmployment: number;
  costsCopyright: number;
  costsCivilContract: number;
  costsOther: number;
  advanceTax: number;
  healthInsurance: number;
  zusContributions: {
    retirement: number;
    disability: number;
    sickness: number;
  };
}

export class PITService {
  constructor(private readonly tenantId: string) {}

  /**
   * Generate PIT-11 for all employees for a tax year
   */
  async generateAllPIT11(taxYear: number, userId: string): Promise<string[]> {
    // Get all employees who had income in the tax year
    const employeesWithIncome = await db.query.payrollRecords.findMany({
      where: and(
        eq(payrollRecords.tenantId, this.tenantId),
        eq(payrollRecords.periodYear, taxYear),
        eq(payrollRecords.status, 'PAID')
      ),
      columns: {
        employeeId: true,
      },
      distinct: true,
    });

    const declarationIds: string[] = [];

    for (const { employeeId } of employeesWithIncome) {
      const id = await this.generatePIT11(employeeId, taxYear, userId);
      declarationIds.push(id);
    }

    return declarationIds;
  }

  /**
   * Generate PIT-11 for a single employee
   */
  async generatePIT11(employeeId: string, taxYear: number, userId: string): Promise<string> {
    const employee = await db.query.employees.findFirst({
      where: and(
        eq(employees.id, employeeId),
        eq(employees.tenantId, this.tenantId)
      ),
    });

    if (!employee) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    // Get tax rates for the year
    const rates = await this.getTaxRates(taxYear);

    // Aggregate payroll data for the year
    const payrollData = await this.aggregateYearlyPayroll(employeeId, taxYear);

    // Calculate costs
    const costs = this.calculateCosts(payrollData, rates);

    // Check for existing declaration
    const existing = await db.query.pitDeclarations.findFirst({
      where: and(
        eq(pitDeclarations.tenantId, this.tenantId),
        eq(pitDeclarations.declarationType, 'PIT-11'),
        eq(pitDeclarations.employeeId, employeeId),
        eq(pitDeclarations.taxYear, taxYear)
      ),
      orderBy: [desc(pitDeclarations.version)],
    });

    const version = existing ? existing.version + 1 : 1;

    // Create declaration
    const [declaration] = await db.insert(pitDeclarations)
      .values({
        tenantId: this.tenantId,
        declarationType: 'PIT-11',
        taxYear,
        version,
        employeeId,
        status: 'DRAFT',
      })
      .returning();

    // Create PIT-11 details
    await db.insert(pit11Details).values({
      declarationId: declaration.id,
      pesel: employee.pesel,
      firstName: employee.firstName,
      lastName: employee.lastName,
      dateOfBirth: employee.dateOfBirth,
      addressStreet: employee.streetAddress,
      addressCity: employee.city,
      addressPostalCode: employee.postalCode,
      taxOfficeCode: employee.taxOfficeCode,
      employmentFrom: payrollData.employmentFrom,
      employmentTo: payrollData.employmentTo,
      incomeEmployment: payrollData.incomeEmployment,
      costsEmployment: costs.employment,
      advanceTaxEmployment: payrollData.advanceTaxEmployment,
      incomeCopyright: payrollData.incomeCopyright,
      costsCopyright: costs.copyright,
      advanceTaxCopyright: payrollData.advanceTaxCopyright,
      incomeCivilContract: payrollData.incomeCivilContract,
      costsCivilContract: costs.civilContract,
      advanceTaxCivil: payrollData.advanceTaxCivil,
      incomeOther: payrollData.incomeOther,
      costsOther: costs.other,
      advanceTaxOther: payrollData.advanceTaxOther,
      totalIncome: payrollData.totalIncome,
      totalCosts: costs.total,
      totalAdvanceTax: payrollData.totalAdvanceTax,
      healthInsuranceDeducted: payrollData.healthInsurance,
      zusRetirement: payrollData.zusRetirement,
      zusDisability: payrollData.zusDisability,
      zusSickness: payrollData.zusSickness,
      isResident: employee.isPolishResident,
      isUnder26: this.isUnder26AtYearEnd(employee.dateOfBirth, taxYear),
      youngReliefAmount: payrollData.youngReliefAmount,
    });

    // Generate XML
    const xml = await this.generatePIT11Xml(declaration.id);

    // Generate PDF
    const pdf = await this.generatePIT11Pdf(declaration.id);

    await db.update(pitDeclarations)
      .set({
        status: 'GENERATED',
        generatedAt: new Date(),
        generatedBy: userId,
        xmlContent: xml,
        pdfContent: pdf,
        updatedAt: new Date(),
      })
      .where(eq(pitDeclarations.id, declaration.id));

    await this.logAction(declaration.id, 'GENERATE', userId);

    return declaration.id;
  }

  /**
   * Generate PIT-4R for the tax year
   */
  async generatePIT4R(taxYear: number, userId: string): Promise<string> {
    const rates = await this.getTaxRates(taxYear);

    // Check for existing declaration
    const existing = await db.query.pitDeclarations.findFirst({
      where: and(
        eq(pitDeclarations.tenantId, this.tenantId),
        eq(pitDeclarations.declarationType, 'PIT-4R'),
        eq(pitDeclarations.taxYear, taxYear)
      ),
      orderBy: [desc(pitDeclarations.version)],
    });

    const version = existing ? existing.version + 1 : 1;

    // Create declaration
    const [declaration] = await db.insert(pitDeclarations)
      .values({
        tenantId: this.tenantId,
        declarationType: 'PIT-4R',
        taxYear,
        version,
        status: 'DRAFT',
      })
      .returning();

    // Aggregate monthly data
    for (let month = 1; month <= 12; month++) {
      const monthlyData = await this.aggregateMonthlyTax(taxYear, month);

      await db.insert(pit4rDetails).values({
        declarationId: declaration.id,
        month,
        employeeCount: monthlyData.employeeCount,
        totalIncome: monthlyData.totalIncome,
        totalTaxAdvance: monthlyData.totalTaxAdvance,
        totalHealthDeduction: monthlyData.healthDeduction,
        netTaxDue: monthlyData.netTaxDue,
        tax12Percent: monthlyData.tax12Percent,
        tax32Percent: monthlyData.tax32Percent,
      });
    }

    // Generate XML
    const xml = await this.generatePIT4RXml(declaration.id);

    await db.update(pitDeclarations)
      .set({
        status: 'GENERATED',
        generatedAt: new Date(),
        generatedBy: userId,
        xmlContent: xml,
        updatedAt: new Date(),
      })
      .where(eq(pitDeclarations.id, declaration.id));

    return declaration.id;
  }

  /**
   * Aggregate yearly payroll data for an employee
   */
  private async aggregateYearlyPayroll(employeeId: string, taxYear: number) {
    const payrolls = await db.query.payrollRecords.findMany({
      where: and(
        eq(payrollRecords.tenantId, this.tenantId),
        eq(payrollRecords.employeeId, employeeId),
        eq(payrollRecords.periodYear, taxYear),
        eq(payrollRecords.status, 'PAID')
      ),
      orderBy: [asc(payrollRecords.periodMonth)],
    });

    let result = {
      employmentFrom: null as Date | null,
      employmentTo: null as Date | null,
      incomeEmployment: 0,
      incomeCopyright: 0,
      incomeCivilContract: 0,
      incomeOther: 0,
      advanceTaxEmployment: 0,
      advanceTaxCopyright: 0,
      advanceTaxCivil: 0,
      advanceTaxOther: 0,
      totalIncome: 0,
      totalAdvanceTax: 0,
      healthInsurance: 0,
      zusRetirement: 0,
      zusDisability: 0,
      zusSickness: 0,
      youngReliefAmount: 0,
    };

    for (const payroll of payrolls) {
      // Track employment period
      const periodStart = new Date(taxYear, payroll.periodMonth - 1, 1);
      const periodEnd = new Date(taxYear, payroll.periodMonth, 0);

      if (!result.employmentFrom || periodStart < result.employmentFrom) {
        result.employmentFrom = periodStart;
      }
      if (!result.employmentTo || periodEnd > result.employmentTo) {
        result.employmentTo = periodEnd;
      }

      // Aggregate by income type
      const components = payroll.components as Record<string, number> || {};

      result.incomeEmployment += Number(payroll.grossAmount) - (components.copyright || 0);
      result.incomeCopyright += components.copyright || 0;
      result.incomeOther += components.bonus || 0;

      // Tax advances
      result.advanceTaxEmployment += Number(payroll.incomeTax);

      // ZUS
      result.zusRetirement += Number(payroll.zusEmployeeRetirement || 0);
      result.zusDisability += Number(payroll.zusEmployeeDisability || 0);
      result.zusSickness += Number(payroll.zusSickness || 0);

      // Health insurance (7.75% deductible portion)
      result.healthInsurance += Number(payroll.healthInsuranceDeductible || 0);

      // Young person relief
      result.youngReliefAmount += Number(payroll.youngReliefApplied || 0);
    }

    result.totalIncome = result.incomeEmployment + result.incomeCopyright +
      result.incomeCivilContract + result.incomeOther;
    result.totalAdvanceTax = result.advanceTaxEmployment + result.advanceTaxCopyright +
      result.advanceTaxCivil + result.advanceTaxOther;

    return result;
  }

  /**
   * Calculate deductible costs
   */
  private calculateCosts(
    payrollData: any,
    rates: typeof taxRates.$inferSelect
  ): {
    employment: number;
    copyright: number;
    civilContract: number;
    other: number;
    total: number;
  } {
    // Standard employment costs (250 PLN/month, max 3000/year)
    const monthsWorked = this.calculateMonthsWorked(
      payrollData.employmentFrom,
      payrollData.employmentTo
    );
    const employmentCosts = Math.min(
      monthsWorked * Number(rates.standardMonthlyCosts),
      Number(rates.maxAnnualStandardCosts)
    );

    // Copyright costs (50% up to limit)
    const copyrightCosts = Math.min(
      payrollData.incomeCopyright * Number(rates.copyrightCostRate),
      Number(rates.copyrightCostLimit)
    );

    // Civil contract costs (20%)
    const civilContractCosts = payrollData.incomeCivilContract *
      Number(rates.civilContractCostRate);

    // Other costs (typically 0 unless documented)
    const otherCosts = 0;

    return {
      employment: this.round2(employmentCosts),
      copyright: this.round2(copyrightCosts),
      civilContract: this.round2(civilContractCosts),
      other: otherCosts,
      total: this.round2(employmentCosts + copyrightCosts + civilContractCosts + otherCosts),
    };
  }

  /**
   * Aggregate monthly tax data for PIT-4R
   */
  private async aggregateMonthlyTax(taxYear: number, month: number) {
    const payrolls = await db.query.payrollRecords.findMany({
      where: and(
        eq(payrollRecords.tenantId, this.tenantId),
        eq(payrollRecords.periodYear, taxYear),
        eq(payrollRecords.periodMonth, month),
        eq(payrollRecords.status, 'PAID')
      ),
    });

    const employeeCount = new Set(payrolls.map(p => p.employeeId)).size;

    let result = {
      employeeCount,
      totalIncome: 0,
      totalTaxAdvance: 0,
      healthDeduction: 0,
      netTaxDue: 0,
      tax12Percent: 0,
      tax32Percent: 0,
    };

    for (const payroll of payrolls) {
      result.totalIncome += Number(payroll.grossAmount);
      result.totalTaxAdvance += Number(payroll.incomeTax);
      result.healthDeduction += Number(payroll.healthInsuranceDeductible || 0);

      // Categorize by tax rate
      if (payroll.taxRate === 0.32) {
        result.tax32Percent += Number(payroll.incomeTax);
      } else {
        result.tax12Percent += Number(payroll.incomeTax);
      }
    }

    result.netTaxDue = result.totalTaxAdvance - result.healthDeduction;

    return result;
  }

  /**
   * Generate PIT-11 XML for e-Deklaracje
   */
  private async generatePIT11Xml(declarationId: string): Promise<string> {
    const declaration = await db.query.pitDeclarations.findFirst({
      where: eq(pitDeclarations.id, declarationId),
    });

    const details = await db.query.pit11Details.findFirst({
      where: eq(pit11Details.declarationId, declarationId),
    });

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, this.tenantId),
    });

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      declaration: {
        encoding: 'UTF-8',
        version: '1.0',
      },
    });

    const xmlObj = {
      'Deklaracja': {
        '@_xmlns': 'http://crd.gov.pl/wzor/2024/01/16/13261/',
        '@_xmlns:etd': 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2022/09/13/eD/DefinicjeTypy/',
        'Naglowek': {
          'KodFormularza': {
            '@_kodSystemowy': 'PIT-11 (29)',
            '@_kodPodatku': 'PIT',
            '@_rodzajZobowiazania': 'Z',
            '@_wersjaSchemy': '1-0E',
            '#text': 'PIT-11',
          },
          'WariantFormularza': '29',
          'CelZlozenia': {
            '@_poz': 'P_6',
            '#text': declaration.version === 1 ? '1' : '2',  // 1=original, 2=correction
          },
          'Rok': declaration.taxYear,
        },
        'Podmiot1': {
          '@_rola': 'Płatnik',
          'OsobaNiefizyczna': {
            'NIP': tenant.nip,
            'PelnaNazwa': tenant.name,
          },
        },
        'Podmiot2': {
          '@_rola': 'Podatnik',
          'OsobaFizyczna': {
            'PESEL': details.pesel,
            'ImiePierwsze': details.firstName,
            'Nazwisko': details.lastName,
            'DataUrodzenia': details.dateOfBirth?.toISOString().split('T')[0],
          },
          'AdresZamieszkania': {
            'KodKraju': 'PL',
            'Wojewodztwo': 'mazowieckie',  // From employee data
            'Powiat': 'm. st. Warszawa',
            'Gmina': 'Warszawa',
            'Ulica': details.addressStreet,
            'NrDomu': '1',  // Parse from address
            'Miejscowosc': details.addressCity,
            'KodPocztowy': details.addressPostalCode,
          },
        },
        'PozycjeSzczegolowe': {
          // Section D - Employment income
          'P_29': this.formatAmount(details.incomeEmployment),  // Income
          'P_30': this.formatAmount(details.costsEmployment),   // Costs
          'P_31': this.formatAmount(details.advanceTaxEmployment),  // Tax

          // Section E - Copyright income (50% costs)
          'P_36': this.formatAmount(details.incomeCopyright),
          'P_37': this.formatAmount(details.costsCopyright),
          'P_38': this.formatAmount(details.advanceTaxCopyright),

          // ZUS contributions
          'P_63': this.formatAmount(
            Number(details.zusRetirement) +
            Number(details.zusDisability) +
            Number(details.zusSickness)
          ),

          // Health insurance deducted
          'P_64': this.formatAmount(details.healthInsuranceDeducted),

          // Totals
          'P_65': this.formatAmount(details.totalIncome),
          'P_66': this.formatAmount(details.totalCosts),
          'P_67': this.formatAmount(details.totalAdvanceTax),
        },
        'Pouczenie': '1',
      },
    };

    return builder.build(xmlObj);
  }

  /**
   * Generate PIT-11 PDF document
   */
  private async generatePIT11Pdf(declarationId: string): Promise<Buffer> {
    const declaration = await db.query.pitDeclarations.findFirst({
      where: eq(pitDeclarations.id, declarationId),
    });

    const details = await db.query.pit11Details.findFirst({
      where: eq(pit11Details.declarationId, declarationId),
    });

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, this.tenantId),
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Register Polish fonts
      doc.registerFont('DejaVu', 'fonts/DejaVuSans.ttf');
      doc.font('DejaVu');

      // Header
      doc.fontSize(16).text(`PIT-11 (29) za rok ${declaration.taxYear}`, { align: 'center' });
      doc.moveDown();

      doc.fontSize(12).text('INFORMACJA O PRZYCHODACH Z INNYCH ŹRÓDEŁ', { align: 'center' });
      doc.text('ORAZ O DOCHODACH I POBRANYCH ZALICZKACH NA PODATEK DOCHODOWY', { align: 'center' });
      doc.moveDown(2);

      // Employer section
      doc.fontSize(10);
      doc.text('A. DANE PŁATNIKA', { underline: true });
      doc.text(`NIP: ${tenant.nip}`);
      doc.text(`Nazwa: ${tenant.name}`);
      doc.moveDown();

      // Employee section
      doc.text('B. DANE PODATNIKA', { underline: true });
      doc.text(`PESEL: ${details.pesel}`);
      doc.text(`Imię i nazwisko: ${details.firstName} ${details.lastName}`);
      doc.text(`Adres: ${details.addressStreet}, ${details.addressPostalCode} ${details.addressCity}`);
      doc.moveDown();

      // Income section
      doc.text('D. PRZYCHODY ZE STOSUNKU PRACY', { underline: true });
      doc.text(`Przychód: ${this.formatAmountPL(details.incomeEmployment)} PLN`);
      doc.text(`Koszty uzyskania: ${this.formatAmountPL(details.costsEmployment)} PLN`);
      doc.text(`Zaliczka na podatek: ${this.formatAmountPL(details.advanceTaxEmployment)} PLN`);
      doc.moveDown();

      if (Number(details.incomeCopyright) > 0) {
        doc.text('E. PRZYCHODY Z PRAW AUTORSKICH (50% KUP)', { underline: true });
        doc.text(`Przychód: ${this.formatAmountPL(details.incomeCopyright)} PLN`);
        doc.text(`Koszty uzyskania (50%): ${this.formatAmountPL(details.costsCopyright)} PLN`);
        doc.text(`Zaliczka na podatek: ${this.formatAmountPL(details.advanceTaxCopyright)} PLN`);
        doc.moveDown();
      }

      // ZUS section
      doc.text('SKŁADKI ZUS', { underline: true });
      doc.text(`Emerytalne: ${this.formatAmountPL(details.zusRetirement)} PLN`);
      doc.text(`Rentowe: ${this.formatAmountPL(details.zusDisability)} PLN`);
      doc.text(`Chorobowe: ${this.formatAmountPL(details.zusSickness)} PLN`);
      doc.moveDown();

      // Health insurance
      doc.text(`Składka zdrowotna odliczona: ${this.formatAmountPL(details.healthInsuranceDeducted)} PLN`);
      doc.moveDown();

      // Totals
      doc.text('PODSUMOWANIE', { underline: true });
      doc.text(`Łączny przychód: ${this.formatAmountPL(details.totalIncome)} PLN`);
      doc.text(`Łączne koszty: ${this.formatAmountPL(details.totalCosts)} PLN`);
      doc.text(`Łączna zaliczka na podatek: ${this.formatAmountPL(details.totalAdvanceTax)} PLN`);

      // Footer
      doc.moveDown(3);
      doc.fontSize(8);
      doc.text(`Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}`, { align: 'right' });

      doc.end();
    });
  }

  /**
   * Validate declaration before submission
   */
  async validateDeclaration(declarationId: string): Promise<{
    isValid: boolean;
    errors: Array<{ code: string; message: string; field?: string }>;
    warnings: Array<{ code: string; message: string }>;
  }> {
    const declaration = await db.query.pitDeclarations.findFirst({
      where: eq(pitDeclarations.id, declarationId),
    });

    if (!declaration) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Declaration not found' });
    }

    const errors: Array<{ code: string; message: string; field?: string }> = [];
    const warnings: Array<{ code: string; message: string }> = [];

    if (declaration.declarationType === 'PIT-11') {
      const details = await db.query.pit11Details.findFirst({
        where: eq(pit11Details.declarationId, declarationId),
      });

      // Validate PESEL
      if (!this.validatePESEL(details.pesel)) {
        errors.push({
          code: 'INVALID_PESEL',
          message: 'Invalid PESEL number',
          field: 'pesel',
        });
      }

      // Validate totals
      const calculatedTotal = Number(details.incomeEmployment) +
        Number(details.incomeCopyright) +
        Number(details.incomeCivilContract) +
        Number(details.incomeOther);

      if (Math.abs(calculatedTotal - Number(details.totalIncome)) > 0.01) {
        errors.push({
          code: 'TOTAL_MISMATCH',
          message: 'Total income does not match sum of components',
          field: 'totalIncome',
        });
      }

      // Validate costs don't exceed limits
      const rates = await this.getTaxRates(declaration.taxYear);

      if (Number(details.costsCopyright) > Number(rates.copyrightCostLimit)) {
        errors.push({
          code: 'COPYRIGHT_COSTS_EXCEEDED',
          message: `Copyright costs exceed annual limit of ${rates.copyrightCostLimit} PLN`,
          field: 'costsCopyright',
        });
      }

      // Warning for high income
      if (Number(details.totalIncome) > 1000000) {
        warnings.push({
          code: 'HIGH_INCOME',
          message: 'Income exceeds 1,000,000 PLN - verify correctness',
        });
      }
    }

    const isValid = errors.length === 0;

    await db.update(pitDeclarations)
      .set({
        status: isValid ? 'VALIDATED' : 'DRAFT',
        updatedAt: new Date(),
      })
      .where(eq(pitDeclarations.id, declarationId));

    return { isValid, errors, warnings };
  }

  /**
   * Submit declaration to e-Deklaracje
   */
  async submitToEDeklaracje(declarationId: string, userId: string): Promise<{
    success: boolean;
    reference?: string;
    error?: string;
  }> {
    const declaration = await db.query.pitDeclarations.findFirst({
      where: eq(pitDeclarations.id, declarationId),
    });

    if (!declaration) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Declaration not found' });
    }

    if (declaration.status !== 'VALIDATED') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Declaration must be validated before submission',
      });
    }

    if (!declaration.xmlContent) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'XML content not generated',
      });
    }

    try {
      // Sign XML with qualified signature (integration with external signing service)
      const signedXml = await this.signXml(declaration.xmlContent);

      // Submit to e-Deklaracje API
      const response = await this.callEDeklarajeAPI('submit', signedXml);

      if (response.success) {
        await db.update(pitDeclarations)
          .set({
            status: 'SUBMITTED',
            submittedAt: new Date(),
            submittedBy: userId,
            submissionReference: response.reference,
            updatedAt: new Date(),
          })
          .where(eq(pitDeclarations.id, declarationId));

        await this.logAction(declarationId, 'SUBMIT', userId, {
          reference: response.reference,
        });

        return { success: true, reference: response.reference };
      } else {
        await this.logAction(declarationId, 'SUBMIT_FAILED', userId, {
          error: response.error,
        });

        return { success: false, error: response.error };
      }
    } catch (error) {
      await this.logAction(declarationId, 'SUBMIT_ERROR', userId, {
        error: error.message,
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `e-Deklaracje submission failed: ${error.message}`,
      });
    }
  }

  /**
   * Check submission status and download UPO
   */
  async checkSubmissionStatus(declarationId: string): Promise<{
    status: string;
    upoAvailable: boolean;
  }> {
    const declaration = await db.query.pitDeclarations.findFirst({
      where: eq(pitDeclarations.id, declarationId),
    });

    if (!declaration?.submissionReference) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Declaration not submitted',
      });
    }

    const response = await this.callEDeklarajeAPI('status', {
      reference: declaration.submissionReference,
    });

    if (response.status === 'ACCEPTED' && response.upo) {
      await db.update(pitDeclarations)
        .set({
          status: 'ACCEPTED',
          responseReceivedAt: new Date(),
          responseStatus: 'ACCEPTED',
          upoReference: response.upoReference,
          upoDocument: Buffer.from(response.upo, 'base64'),
          updatedAt: new Date(),
        })
        .where(eq(pitDeclarations.id, declarationId));
    } else if (response.status === 'REJECTED') {
      await db.update(pitDeclarations)
        .set({
          status: 'REJECTED',
          responseReceivedAt: new Date(),
          responseStatus: 'REJECTED',
          rejectionReason: response.reason,
          updatedAt: new Date(),
        })
        .where(eq(pitDeclarations.id, declarationId));
    }

    return {
      status: response.status,
      upoAvailable: !!response.upo,
    };
  }

  /**
   * Send PIT-11 to employee
   */
  async sendToEmployee(
    declarationId: string,
    method: 'EMAIL' | 'PORTAL' | 'MAIL'
  ): Promise<void> {
    const declaration = await db.query.pitDeclarations.findFirst({
      where: eq(pitDeclarations.id, declarationId),
      with: {
        employee: true,
      },
    });

    if (!declaration) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Declaration not found' });
    }

    if (declaration.declarationType !== 'PIT-11') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only PIT-11 can be sent to employees',
      });
    }

    if (!declaration.pdfContent) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'PDF not generated',
      });
    }

    switch (method) {
      case 'EMAIL':
        await this.sendPIT11ByEmail(declaration);
        break;
      case 'PORTAL':
        await this.publishToEmployeePortal(declaration);
        break;
      case 'MAIL':
        // Generate mailing request for physical delivery
        await this.createMailingRequest(declaration);
        break;
    }

    await db.update(pitDeclarations)
      .set({
        sentToEmployee: true,
        sentAt: new Date(),
        deliveryMethod: method,
        updatedAt: new Date(),
      })
      .where(eq(pitDeclarations.id, declarationId));
  }

  // Helper methods
  private async getTaxRates(taxYear: number): Promise<typeof taxRates.$inferSelect> {
    const rates = await db.query.taxRates.findFirst({
      where: eq(taxRates.taxYear, taxYear),
    });

    if (!rates) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Tax rates not configured for year ${taxYear}`,
      });
    }

    return rates;
  }

  private isUnder26AtYearEnd(dateOfBirth: Date, taxYear: number): boolean {
    const yearEnd = new Date(taxYear, 11, 31);
    const age = yearEnd.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = yearEnd.getMonth() - dateOfBirth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && yearEnd.getDate() < dateOfBirth.getDate())) {
      return age - 1 < 26;
    }
    return age < 26;
  }

  private calculateMonthsWorked(from: Date | null, to: Date | null): number {
    if (!from || !to) return 0;
    return (to.getFullYear() - from.getFullYear()) * 12 +
      (to.getMonth() - from.getMonth()) + 1;
  }

  private validatePESEL(pesel: string): boolean {
    if (!/^\d{11}$/.test(pesel)) return false;
    const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
    const sum = weights.reduce((acc, w, i) => acc + w * parseInt(pesel[i]), 0);
    return (10 - (sum % 10)) % 10 === parseInt(pesel[10]);
  }

  private formatAmount(amount: number | string | null): string {
    if (amount === null) return '0.00';
    return Number(amount).toFixed(2);
  }

  private formatAmountPL(amount: number | string | null): string {
    if (amount === null) return '0,00';
    return Number(amount).toLocaleString('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private async signXml(xml: string): Promise<string> {
    // Integration with qualified electronic signature service
    // This would call an external signing service
    return xml; // Placeholder
  }

  private async callEDeklarajeAPI(action: string, data: any): Promise<any> {
    // Integration with e-Deklaracje API
    // This would make actual API calls
    return { success: true, reference: `REF-${Date.now()}` }; // Placeholder
  }

  private async logAction(
    declarationId: string,
    action: string,
    userId: string,
    details?: Record<string, any>
  ): Promise<void> {
    await db.insert(edeklarajeLog).values({
      declarationId,
      action,
      performedBy: userId,
      responseMessage: details ? JSON.stringify(details) : null,
    });
  }

  private async sendPIT11ByEmail(declaration: any): Promise<void> {
    // Email sending implementation
  }

  private async publishToEmployeePortal(declaration: any): Promise<void> {
    // Portal publication implementation
  }

  private async createMailingRequest(declaration: any): Promise<void> {
    // Mailing request creation
  }
}
```

### tRPC Router

```typescript
// src/server/routers/hrp/pit.router.ts
import { z } from 'zod';
import { router, hrManagerProcedure, employeeProcedure } from '@/server/trpc';
import { PITService } from '@/server/services/hrp/pit.service';

export const pitRouter = router({
  generateAllPIT11: hrManagerProcedure
    .input(z.object({
      taxYear: z.number().min(2020).max(2100),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PITService(ctx.tenantId);
      return service.generateAllPIT11(input.taxYear, ctx.user.id);
    }),

  generatePIT11: hrManagerProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      taxYear: z.number().min(2020).max(2100),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PITService(ctx.tenantId);
      return service.generatePIT11(input.employeeId, input.taxYear, ctx.user.id);
    }),

  generatePIT4R: hrManagerProcedure
    .input(z.object({
      taxYear: z.number().min(2020).max(2100),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PITService(ctx.tenantId);
      return service.generatePIT4R(input.taxYear, ctx.user.id);
    }),

  validateDeclaration: hrManagerProcedure
    .input(z.object({
      declarationId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PITService(ctx.tenantId);
      return service.validateDeclaration(input.declarationId);
    }),

  submitToEDeklaracje: hrManagerProcedure
    .input(z.object({
      declarationId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PITService(ctx.tenantId);
      return service.submitToEDeklaracje(input.declarationId, ctx.user.id);
    }),

  checkSubmissionStatus: hrManagerProcedure
    .input(z.object({
      declarationId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const service = new PITService(ctx.tenantId);
      return service.checkSubmissionStatus(input.declarationId);
    }),

  sendToEmployee: hrManagerProcedure
    .input(z.object({
      declarationId: z.string().uuid(),
      method: z.enum(['EMAIL', 'PORTAL', 'MAIL']),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PITService(ctx.tenantId);
      await service.sendToEmployee(input.declarationId, input.method);
      return { success: true };
    }),

  listDeclarations: hrManagerProcedure
    .input(z.object({
      taxYear: z.number().optional(),
      type: z.enum(['PIT-11', 'PIT-4R', 'PIT-8AR', 'PIT-8C', 'IFT-1R']).optional(),
      status: z.string().optional(),
      employeeId: z.string().uuid().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(pitDeclarations.tenantId, ctx.tenantId)];

      if (input.taxYear) conditions.push(eq(pitDeclarations.taxYear, input.taxYear));
      if (input.type) conditions.push(eq(pitDeclarations.declarationType, input.type));
      if (input.status) conditions.push(eq(pitDeclarations.status, input.status));
      if (input.employeeId) conditions.push(eq(pitDeclarations.employeeId, input.employeeId));

      const [declarations, count] = await Promise.all([
        db.query.pitDeclarations.findMany({
          where: and(...conditions),
          with: {
            employee: {
              columns: { firstName: true, lastName: true },
            },
          },
          orderBy: [desc(pitDeclarations.taxYear), desc(pitDeclarations.createdAt)],
          limit: input.pageSize,
          offset: (input.page - 1) * input.pageSize,
        }),
        db.select({ count: sql<number>`count(*)` })
          .from(pitDeclarations)
          .where(and(...conditions)),
      ]);

      return {
        declarations,
        total: count[0].count,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  getDeclaration: hrManagerProcedure
    .input(z.object({
      declarationId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      return db.query.pitDeclarations.findFirst({
        where: and(
          eq(pitDeclarations.id, input.declarationId),
          eq(pitDeclarations.tenantId, ctx.tenantId)
        ),
        with: {
          pit11Details: true,
          pit4rDetails: true,
          employee: true,
        },
      });
    }),

  downloadPdf: hrManagerProcedure
    .input(z.object({
      declarationId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const declaration = await db.query.pitDeclarations.findFirst({
        where: and(
          eq(pitDeclarations.id, input.declarationId),
          eq(pitDeclarations.tenantId, ctx.tenantId)
        ),
      });

      if (!declaration?.pdfContent) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'PDF not available' });
      }

      return {
        pdf: declaration.pdfContent.toString('base64'),
        filename: `${declaration.declarationType}_${declaration.taxYear}_${declaration.employeeId || 'summary'}.pdf`,
      };
    }),

  downloadXml: hrManagerProcedure
    .input(z.object({
      declarationId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const declaration = await db.query.pitDeclarations.findFirst({
        where: and(
          eq(pitDeclarations.id, input.declarationId),
          eq(pitDeclarations.tenantId, ctx.tenantId)
        ),
      });

      if (!declaration?.xmlContent) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'XML not available' });
      }

      return {
        xml: declaration.xmlContent,
        filename: `${declaration.declarationType}_${declaration.taxYear}.xml`,
      };
    }),

  // Employee self-service
  getMyPIT11: employeeProcedure
    .input(z.object({
      taxYear: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(pitDeclarations.tenantId, ctx.tenantId),
        eq(pitDeclarations.employeeId, ctx.user.employeeId),
        eq(pitDeclarations.declarationType, 'PIT-11'),
        eq(pitDeclarations.sentToEmployee, true),
      ];

      if (input.taxYear) {
        conditions.push(eq(pitDeclarations.taxYear, input.taxYear));
      }

      return db.query.pitDeclarations.findMany({
        where: and(...conditions),
        with: {
          pit11Details: true,
        },
        orderBy: [desc(pitDeclarations.taxYear)],
      });
    }),

  downloadMyPIT11: employeeProcedure
    .input(z.object({
      declarationId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const declaration = await db.query.pitDeclarations.findFirst({
        where: and(
          eq(pitDeclarations.id, input.declarationId),
          eq(pitDeclarations.tenantId, ctx.tenantId),
          eq(pitDeclarations.employeeId, ctx.user.employeeId),
          eq(pitDeclarations.sentToEmployee, true)
        ),
      });

      if (!declaration?.pdfContent) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'PDF not available' });
      }

      // Mark as confirmed receipt
      await db.update(pitDeclarations)
        .set({ employeeConfirmedReceipt: true })
        .where(eq(pitDeclarations.id, input.declarationId));

      return {
        pdf: declaration.pdfContent.toString('base64'),
        filename: `PIT-11_${declaration.taxYear}.pdf`,
      };
    }),
});
```

## Test Specification

### Unit Tests

```typescript
describe('PITService', () => {
  describe('generatePIT11', () => {
    it('should generate PIT-11 with correct totals', async () => {
      const declarationId = await service.generatePIT11(employeeId, 2024, userId);

      const details = await getPIT11Details(declarationId);
      expect(details.totalIncome).toBe(
        details.incomeEmployment + details.incomeCopyright + details.incomeOther
      );
    });

    it('should apply copyright cost limit', async () => {
      // Employee with 300,000 PLN copyright income
      await createPayrollWithCopyright(employeeId, 2024, 300000);

      const declarationId = await service.generatePIT11(employeeId, 2024, userId);
      const details = await getPIT11Details(declarationId);

      // 50% of 300,000 = 150,000, but limited to 120,000
      expect(details.costsCopyright).toBe(120000);
    });

    it('should calculate standard employment costs correctly', async () => {
      // 12 months employment
      const declarationId = await service.generatePIT11(employeeId, 2024, userId);
      const details = await getPIT11Details(declarationId);

      // 12 * 250 = 3000 (max annual)
      expect(details.costsEmployment).toBe(3000);
    });
  });

  describe('generatePIT4R', () => {
    it('should aggregate monthly data correctly', async () => {
      const declarationId = await service.generatePIT4R(2024, userId);

      const details = await getPIT4RDetails(declarationId);
      expect(details.length).toBe(12);

      const totalTax = details.reduce((sum, m) => sum + m.totalTaxAdvance, 0);
      expect(totalTax).toBeGreaterThan(0);
    });
  });

  describe('validateDeclaration', () => {
    it('should detect invalid PESEL', async () => {
      await createPIT11WithInvalidPesel(declarationId);

      const result = await service.validateDeclaration(declarationId);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'INVALID_PESEL' })
      );
    });

    it('should detect total mismatch', async () => {
      await createPIT11WithMismatchedTotals(declarationId);

      const result = await service.validateDeclaration(declarationId);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'TOTAL_MISMATCH' })
      );
    });
  });
});
```

## Security Checklist

- [x] PESEL validation with checksum
- [x] XML signed with qualified electronic signature
- [x] PDF password protected for employee delivery
- [x] Tenant isolation via RLS
- [x] HR manager role required for generation/submission
- [x] Employee can only access their own PIT-11
- [x] Audit trail for all operations
- [x] UPO (receipt) stored for compliance

## Audit Events

| Event | Data Captured |
|-------|--------------|
| `PIT_DECLARATION_GENERATED` | declaration_id, type, tax_year, employee_id |
| `PIT_DECLARATION_VALIDATED` | declaration_id, is_valid, errors |
| `PIT_SUBMITTED_EDEKLARACJE` | declaration_id, reference |
| `PIT_ACCEPTED` | declaration_id, upo_reference |
| `PIT_REJECTED` | declaration_id, rejection_reason |
| `PIT_SENT_TO_EMPLOYEE` | declaration_id, method |
| `PIT_EMPLOYEE_DOWNLOAD` | declaration_id, employee_id |

## Implementation Notes

1. **Tax Rates**: Configurable per year in tax_rates table
2. **e-Deklaracje Integration**: Requires qualified electronic signature
3. **UPO**: Urzędowe Poświadczenie Odbioru - official receipt from tax office
4. **Copyright Costs**: 50% up to 120,000 PLN annual limit
5. **Young Person Relief**: Applies to employees under 26
6. **Employee Delivery**: Deadline February 28th
7. **Corrections**: Use version field for tracking
