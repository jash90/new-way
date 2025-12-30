# HRP-008: ZUS Integration

## Story Information
| Field | Value |
|-------|-------|
| **Story ID** | HRP-008 |
| **Epic** | HR & Payroll Module (HRP) |
| **Title** | ZUS Integration & Electronic Declarations |
| **Priority** | P0 (Critical) |
| **Story Points** | 13 |
| **Status** | Draft |

## User Story
**As a** HR manager or payroll specialist,
**I want** automated ZUS declaration generation and submission,
**So that** I can efficiently fulfill mandatory social insurance reporting requirements and avoid penalties for late or incorrect submissions.

## Business Context
### Polish ZUS Requirements
- **Monthly Declarations**: DRA (employer summary), RCA (employee contributions), RSA (absences)
- **Registration Forms**: ZUA (new employee), ZWUA (deregistration), ZCNA (family members)
- **Deadlines**: 15th of following month for contributions, 7 days for registration changes
- **Electronic Submission**: Mandatory via Płatnik software or API
- **Validation**: Strict XML schema validation with error codes
- **Corrections**: KOA (correction declarations) for errors found after submission

### Integration Scope
- ZUS PUE (Platforma Usług Elektronicznych) API connection
- Płatnik-compatible XML generation
- e-ZLA (electronic sick leave) import
- Contribution calculation validation
- Declaration status tracking

## Acceptance Criteria

### AC1: Declaration Generation
```gherkin
Given I have completed payroll for a period
When I generate ZUS declarations
Then the system creates DRA summary declaration
And generates RCA records for each employee
And generates RSA records for absences
And validates all calculations against ZUS rules
And produces Płatnik-compatible XML files
```

### AC2: Employee Registration (ZUA)
```gherkin
Given a new employee starts employment
When I submit their ZUS registration
Then the system generates ZUA form with correct data
And includes insurance code based on contract type
And specifies contribution dates from employment start
And validates NIP and PESEL against ZUS database
And tracks submission status
```

### AC3: e-ZLA Integration
```gherkin
Given an employee has electronic sick leave (e-ZLA)
When the system receives e-ZLA notification
Then it imports sick leave details automatically
And creates corresponding leave request
And adjusts payroll calculations
And generates RSA records for the period
And tracks ZUS takeover dates (33/14 days)
```

### AC4: Declaration Correction
```gherkin
Given a submitted declaration has errors
When I create a correction
Then the system identifies changed records
And generates KOA correction declaration
And maintains audit trail of original vs corrected
And validates correction against original
And tracks correction submission status
```

### AC5: Contribution Validation
```gherkin
Given payroll calculations are complete
When I validate ZUS contributions
Then the system checks against annual limits (roczna podstawa wymiaru)
And verifies correct rates applied
And validates codes match contract types
And reports any discrepancies with explanations
```

## Technical Specification

### Database Schema

```sql
-- ZUS declaration tracking
CREATE TABLE zus_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  declaration_type VARCHAR(10) NOT NULL,  -- DRA, RCA, RSA, ZUA, ZWUA, ZCNA, KOA
  period_year INTEGER NOT NULL,
  period_month INTEGER,  -- NULL for registration forms
  sequence_number INTEGER NOT NULL DEFAULT 1,  -- For corrections
  is_correction BOOLEAN DEFAULT false,
  corrects_declaration_id UUID REFERENCES zus_declarations(id),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  -- DRAFT, GENERATED, VALIDATED, SUBMITTED, ACCEPTED, REJECTED, CORRECTED

  -- Generation metadata
  generated_at TIMESTAMPTZ,
  generated_by UUID REFERENCES users(id),
  xml_content TEXT,
  xml_hash VARCHAR(64),  -- SHA-256 for integrity

  -- Submission tracking
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES users(id),
  submission_reference VARCHAR(100),
  pue_document_id VARCHAR(100),

  -- Response handling
  response_received_at TIMESTAMPTZ,
  response_status VARCHAR(20),
  response_errors JSONB,  -- Array of ZUS error codes and messages

  -- Totals (for DRA)
  total_employees INTEGER,
  total_basis_retirement DECIMAL(15, 2),
  total_basis_disability DECIMAL(15, 2),
  total_basis_sickness DECIMAL(15, 2),
  total_basis_accident DECIMAL(15, 2),
  total_basis_health DECIMAL(15, 2),
  total_contribution_employee DECIMAL(15, 2),
  total_contribution_employer DECIMAL(15, 2),
  total_contribution_health DECIMAL(15, 2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, declaration_type, period_year, period_month, sequence_number)
);

CREATE INDEX idx_zus_declarations_period ON zus_declarations(tenant_id, period_year, period_month);
CREATE INDEX idx_zus_declarations_status ON zus_declarations(tenant_id, status);

-- Individual employee records in declarations
CREATE TABLE zus_declaration_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id UUID NOT NULL REFERENCES zus_declarations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  payroll_record_id UUID REFERENCES payroll_records(id),

  -- Employee identification
  pesel VARCHAR(11) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,

  -- Insurance codes
  insurance_code VARCHAR(6) NOT NULL,  -- 6-digit code (e.g., 011000)
  title_code VARCHAR(4),  -- 4-digit entitlement code

  -- Contribution bases
  basis_retirement DECIMAL(15, 2),
  basis_disability DECIMAL(15, 2),
  basis_sickness DECIMAL(15, 2),
  basis_accident DECIMAL(15, 2),
  basis_health DECIMAL(15, 2),
  basis_fp DECIMAL(15, 2),  -- Fundusz Pracy
  basis_fgsp DECIMAL(15, 2),  -- FGŚP

  -- Calculated contributions (employee)
  contribution_retirement_employee DECIMAL(15, 2),
  contribution_disability_employee DECIMAL(15, 2),
  contribution_sickness DECIMAL(15, 2),
  contribution_health DECIMAL(15, 2),

  -- Calculated contributions (employer)
  contribution_retirement_employer DECIMAL(15, 2),
  contribution_disability_employer DECIMAL(15, 2),
  contribution_accident DECIMAL(15, 2),
  contribution_fp DECIMAL(15, 2),
  contribution_fgsp DECIMAL(15, 2),

  -- For RSA (absence records)
  absence_type_code VARCHAR(3),  -- ZUS absence code
  absence_from DATE,
  absence_to DATE,
  absence_days INTEGER,
  benefit_amount DECIMAL(15, 2),
  benefit_type VARCHAR(20),  -- WYNAGRODZENIE, ZASILEK

  -- For registration forms
  registration_date DATE,
  deregistration_date DATE,
  deregistration_code VARCHAR(3),

  -- Validation
  validation_errors JSONB,
  is_valid BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_zus_records_declaration ON zus_declaration_records(declaration_id);
CREATE INDEX idx_zus_records_employee ON zus_declaration_records(employee_id);

-- ZUS submission log
CREATE TABLE zus_submission_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id UUID NOT NULL REFERENCES zus_declarations(id),
  action VARCHAR(50) NOT NULL,
  -- GENERATE, VALIDATE, SUBMIT, CHECK_STATUS, RECEIVE_RESPONSE, DOWNLOAD

  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  performed_by UUID REFERENCES users(id),

  -- Request details
  request_method VARCHAR(20),
  request_endpoint VARCHAR(200),
  request_payload_hash VARCHAR(64),

  -- Response details
  response_status INTEGER,
  response_body TEXT,

  -- Error handling
  error_occurred BOOLEAN DEFAULT false,
  error_message TEXT,

  -- Timing
  duration_ms INTEGER
);

CREATE INDEX idx_zus_log_declaration ON zus_submission_log(declaration_id);

-- e-ZLA (electronic sick leave) imports
CREATE TABLE ezla_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- ZUS reference
  ezla_number VARCHAR(50) NOT NULL,
  series VARCHAR(10),

  -- Employee matching
  employee_id UUID REFERENCES employees(id),
  pesel VARCHAR(11) NOT NULL,
  employee_matched BOOLEAN DEFAULT false,

  -- Sick leave details
  issue_date DATE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  icd_code VARCHAR(10),  -- Diagnosis code (masked)
  is_hospital BOOLEAN DEFAULT false,
  is_infectious BOOLEAN DEFAULT false,

  -- Doctor info
  doctor_npwz VARCHAR(20),  -- Doctor's license number
  facility_regon VARCHAR(14),

  -- Processing
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  leave_request_id UUID REFERENCES leave_requests(id),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  -- PENDING, MATCHED, PROCESSED, REJECTED, MANUAL_REVIEW
  processing_notes TEXT,

  UNIQUE(tenant_id, ezla_number)
);

CREATE INDEX idx_ezla_tenant_status ON ezla_imports(tenant_id, status);
CREATE INDEX idx_ezla_pesel ON ezla_imports(pesel);

-- ZUS annual limits tracking
CREATE TABLE zus_annual_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  year INTEGER NOT NULL,

  -- Annual ceiling tracking (30x average salary)
  annual_ceiling DECIMAL(15, 2) NOT NULL,  -- 234,720 PLN for 2024
  ytd_basis_retirement DECIMAL(15, 2) DEFAULT 0,
  ytd_basis_disability DECIMAL(15, 2) DEFAULT 0,
  ceiling_reached_date DATE,
  ceiling_reached_month INTEGER,

  -- Per-month breakdown
  monthly_bases JSONB,  -- {1: 15000, 2: 15000, ...}

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, employee_id, year)
);

CREATE INDEX idx_zus_limits_year ON zus_annual_limits(tenant_id, year);

-- ZUS configuration and rates
CREATE TABLE zus_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  valid_from DATE NOT NULL,
  valid_to DATE,

  -- Employee contributions
  rate_retirement_employee DECIMAL(5, 4) NOT NULL,  -- 9.76%
  rate_disability_employee DECIMAL(5, 4) NOT NULL,  -- 1.5%
  rate_sickness DECIMAL(5, 4) NOT NULL,  -- 2.45%
  rate_health DECIMAL(5, 4) NOT NULL,  -- 9%
  rate_health_deductible DECIMAL(5, 4) NOT NULL,  -- 7.75%

  -- Employer contributions
  rate_retirement_employer DECIMAL(5, 4) NOT NULL,  -- 9.76%
  rate_disability_employer DECIMAL(5, 4) NOT NULL,  -- 6.5%
  rate_accident_min DECIMAL(5, 4) NOT NULL,  -- 0.67%
  rate_accident_max DECIMAL(5, 4) NOT NULL,  -- 3.33%
  rate_fp DECIMAL(5, 4) NOT NULL,  -- 2.45%
  rate_fgsp DECIMAL(5, 4) NOT NULL,  -- 0.1%

  -- Annual ceiling
  annual_ceiling DECIMAL(15, 2) NOT NULL,

  -- Minimum wage
  minimum_wage DECIMAL(10, 2) NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(valid_from)
);
```

### ZUS Service Implementation

```typescript
// src/server/services/hrp/zus.service.ts
import { TRPCError } from '@trpc/server';
import { db } from '@/server/db';
import {
  zusDeclarations, zusDeclarationRecords, zusSubmissionLog,
  ezlaImports, zusAnnualLimits, zusRates
} from '@/server/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { createHash } from 'crypto';

// ZUS insurance codes mapping
const INSURANCE_CODES = {
  EMPLOYMENT_FULL: '011000',      // Umowa o pracę, pełne składki
  EMPLOYMENT_REDUCED: '011100',   // Umowa o pracę, obniżone składki
  CIVIL_CONTRACT: '041100',       // Umowa zlecenia
  CIVIL_VOLUNTARY: '041110',      // Umowa zlecenia z dobrowolnym chorobowym
  MANDATE_STUDENT: '041200',      // Umowa zlecenia ze studentem
  BOARD_MEMBER: '225100',         // Członek zarządu
  MATERNITY: '121000',            // Urlop macierzyński
  PARENTAL: '121100',             // Urlop rodzicielski
} as const;

// ZUS absence codes for RSA
const ABSENCE_CODES = {
  SICK_EMPLOYER: '331',      // Wynagrodzenie chorobowe (employer pays)
  SICK_ZUS: '313',           // Zasiłek chorobowy (ZUS pays)
  MATERNITY: '311',          // Zasiłek macierzyński
  CARE: '312',               // Zasiłek opiekuńczy
  REHABILITATION: '321',     // Świadczenie rehabilitacyjne
  ACCIDENT: '314',           // Zasiłek z wypadku
} as const;

// Deregistration codes for ZWUA
const DEREGISTRATION_CODES = {
  CONTRACT_END: '100',       // Rozwiązanie umowy
  RESIGNATION: '200',        // Wypowiedzenie przez pracownika
  TERMINATION: '300',        // Wypowiedzenie przez pracodawcę
  MUTUAL: '400',             // Porozumienie stron
  DEATH: '500',              // Zgon
  RETIREMENT: '600',         // Przejście na emeryturę
} as const;

interface ZUSContributions {
  basisRetirement: number;
  basisDisability: number;
  basisSickness: number;
  basisAccident: number;
  basisHealth: number;
  basisFP: number;
  basisFGSP: number;
  employeeRetirement: number;
  employeeDisability: number;
  employeeSickness: number;
  employeeHealth: number;
  employerRetirement: number;
  employerDisability: number;
  employerAccident: number;
  employerFP: number;
  employerFGSP: number;
}

export class ZUSService {
  constructor(private readonly tenantId: string) {}

  /**
   * Generate DRA declaration for a period
   */
  async generateDRA(year: number, month: number): Promise<string> {
    // Get all payroll records for the period
    const payrollRecords = await db.query.payrollRecords.findMany({
      where: and(
        eq(payrollRecords.tenantId, this.tenantId),
        eq(payrollRecords.periodYear, year),
        eq(payrollRecords.periodMonth, month),
        eq(payrollRecords.status, 'PAID')
      ),
      with: {
        employee: true,
      },
    });

    if (payrollRecords.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `No paid payroll records found for ${year}-${month.toString().padStart(2, '0')}`,
      });
    }

    // Get current ZUS rates
    const rates = await this.getCurrentRates(year, month);

    // Create declaration record
    const [declaration] = await db.insert(zusDeclarations)
      .values({
        tenantId: this.tenantId,
        declarationType: 'DRA',
        periodYear: year,
        periodMonth: month,
        status: 'DRAFT',
        totalEmployees: payrollRecords.length,
      })
      .returning();

    // Process each employee
    const records: typeof zusDeclarationRecords.$inferInsert[] = [];
    let totals = {
      basisRetirement: 0,
      basisDisability: 0,
      basisSickness: 0,
      basisAccident: 0,
      basisHealth: 0,
      contributionEmployee: 0,
      contributionEmployer: 0,
      contributionHealth: 0,
    };

    for (const payroll of payrollRecords) {
      const contributions = await this.calculateContributions(
        payroll.employee.id,
        payroll.grossAmount,
        year,
        month,
        rates
      );

      const insuranceCode = this.determineInsuranceCode(payroll.employee);

      records.push({
        declarationId: declaration.id,
        employeeId: payroll.employee.id,
        payrollRecordId: payroll.id,
        pesel: payroll.employee.pesel,
        firstName: payroll.employee.firstName,
        lastName: payroll.employee.lastName,
        insuranceCode,
        basisRetirement: contributions.basisRetirement,
        basisDisability: contributions.basisDisability,
        basisSickness: contributions.basisSickness,
        basisAccident: contributions.basisAccident,
        basisHealth: contributions.basisHealth,
        basisFp: contributions.basisFP,
        basisFgsp: contributions.basisFGSP,
        contributionRetirementEmployee: contributions.employeeRetirement,
        contributionDisabilityEmployee: contributions.employeeDisability,
        contributionSickness: contributions.employeeSickness,
        contributionHealth: contributions.employeeHealth,
        contributionRetirementEmployer: contributions.employerRetirement,
        contributionDisabilityEmployer: contributions.employerDisability,
        contributionAccident: contributions.employerAccident,
        contributionFp: contributions.employerFP,
        contributionFgsp: contributions.employerFGSP,
      });

      // Accumulate totals
      totals.basisRetirement += contributions.basisRetirement;
      totals.basisDisability += contributions.basisDisability;
      totals.basisSickness += contributions.basisSickness;
      totals.basisAccident += contributions.basisAccident;
      totals.basisHealth += contributions.basisHealth;
      totals.contributionEmployee += (
        contributions.employeeRetirement +
        contributions.employeeDisability +
        contributions.employeeSickness
      );
      totals.contributionEmployer += (
        contributions.employerRetirement +
        contributions.employerDisability +
        contributions.employerAccident +
        contributions.employerFP +
        contributions.employerFGSP
      );
      totals.contributionHealth += contributions.employeeHealth;
    }

    // Insert all records
    await db.insert(zusDeclarationRecords).values(records);

    // Update declaration with totals
    await db.update(zusDeclarations)
      .set({
        totalBasisRetirement: totals.basisRetirement,
        totalBasisDisability: totals.basisDisability,
        totalBasisSickness: totals.basisSickness,
        totalBasisAccident: totals.basisAccident,
        totalBasisHealth: totals.basisHealth,
        totalContributionEmployee: totals.contributionEmployee,
        totalContributionEmployer: totals.contributionEmployer,
        totalContributionHealth: totals.contributionHealth,
      })
      .where(eq(zusDeclarations.id, declaration.id));

    // Generate XML
    const xml = await this.generateDRAXml(declaration.id);

    await db.update(zusDeclarations)
      .set({
        status: 'GENERATED',
        generatedAt: new Date(),
        xmlContent: xml,
        xmlHash: createHash('sha256').update(xml).digest('hex'),
      })
      .where(eq(zusDeclarations.id, declaration.id));

    await this.logAction(declaration.id, 'GENERATE', {
      employeeCount: payrollRecords.length,
      totals,
    });

    return declaration.id;
  }

  /**
   * Generate RCA records (included in DRA generation)
   */
  async generateRCA(declarationId: string): Promise<string> {
    const declaration = await db.query.zusDeclarations.findFirst({
      where: eq(zusDeclarations.id, declarationId),
      with: {
        records: true,
      },
    });

    if (!declaration) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Declaration not found',
      });
    }

    return this.generateRCAXml(declaration);
  }

  /**
   * Generate RSA for absences in a period
   */
  async generateRSA(year: number, month: number): Promise<string> {
    // Get all sick leave and other absences for the period
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const absences = await db.query.sickLeavePeriods.findMany({
      where: and(
        eq(sickLeavePeriods.tenantId, this.tenantId),
        lte(sickLeavePeriods.startDate, endDate),
        gte(sickLeavePeriods.endDate, startDate)
      ),
      with: {
        employee: true,
      },
    });

    if (absences.length === 0) {
      return null; // No RSA needed
    }

    // Create RSA declaration
    const [declaration] = await db.insert(zusDeclarations)
      .values({
        tenantId: this.tenantId,
        declarationType: 'RSA',
        periodYear: year,
        periodMonth: month,
        status: 'DRAFT',
        totalEmployees: new Set(absences.map(a => a.employeeId)).size,
      })
      .returning();

    // Process each absence
    const records: typeof zusDeclarationRecords.$inferInsert[] = [];

    for (const absence of absences) {
      // Calculate days within the reporting month
      const absenceStart = new Date(Math.max(
        absence.startDate.getTime(),
        startDate.getTime()
      ));
      const absenceEnd = new Date(Math.min(
        absence.endDate.getTime(),
        endDate.getTime()
      ));
      const days = Math.ceil(
        (absenceEnd.getTime() - absenceStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

      // Determine absence code and benefit type
      const { code, benefitType } = this.determineAbsenceCode(absence);

      records.push({
        declarationId: declaration.id,
        employeeId: absence.employeeId,
        pesel: absence.employee.pesel,
        firstName: absence.employee.firstName,
        lastName: absence.employee.lastName,
        insuranceCode: INSURANCE_CODES.EMPLOYMENT_FULL,
        absenceTypeCode: code,
        absenceFrom: absenceStart,
        absenceTo: absenceEnd,
        absenceDays: days,
        benefitAmount: absence.dailyRate * days,
        benefitType,
      });
    }

    await db.insert(zusDeclarationRecords).values(records);

    // Generate XML
    const xml = await this.generateRSAXml(declaration.id);

    await db.update(zusDeclarations)
      .set({
        status: 'GENERATED',
        generatedAt: new Date(),
        xmlContent: xml,
        xmlHash: createHash('sha256').update(xml).digest('hex'),
      })
      .where(eq(zusDeclarations.id, declaration.id));

    return declaration.id;
  }

  /**
   * Generate ZUA for new employee registration
   */
  async generateZUA(employeeId: string, startDate: Date): Promise<string> {
    const employee = await db.query.employees.findFirst({
      where: and(
        eq(employees.id, employeeId),
        eq(employees.tenantId, this.tenantId)
      ),
      with: {
        contracts: {
          where: eq(contracts.status, 'ACTIVE'),
          orderBy: [desc(contracts.startDate)],
          limit: 1,
        },
      },
    });

    if (!employee) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const contract = employee.contracts[0];
    if (!contract) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Employee has no active contract',
      });
    }

    const insuranceCode = this.determineInsuranceCode({ contract });

    // Create ZUA declaration
    const [declaration] = await db.insert(zusDeclarations)
      .values({
        tenantId: this.tenantId,
        declarationType: 'ZUA',
        periodYear: startDate.getFullYear(),
        status: 'DRAFT',
        totalEmployees: 1,
      })
      .returning();

    // Add employee record
    await db.insert(zusDeclarationRecords).values({
      declarationId: declaration.id,
      employeeId: employee.id,
      pesel: employee.pesel,
      firstName: employee.firstName,
      lastName: employee.lastName,
      insuranceCode,
      registrationDate: startDate,
    });

    // Generate XML
    const xml = await this.generateZUAXml(declaration.id);

    await db.update(zusDeclarations)
      .set({
        status: 'GENERATED',
        generatedAt: new Date(),
        xmlContent: xml,
        xmlHash: createHash('sha256').update(xml).digest('hex'),
      })
      .where(eq(zusDeclarations.id, declaration.id));

    return declaration.id;
  }

  /**
   * Generate ZWUA for employee deregistration
   */
  async generateZWUA(
    employeeId: string,
    endDate: Date,
    reason: keyof typeof DEREGISTRATION_CODES
  ): Promise<string> {
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

    // Create ZWUA declaration
    const [declaration] = await db.insert(zusDeclarations)
      .values({
        tenantId: this.tenantId,
        declarationType: 'ZWUA',
        periodYear: endDate.getFullYear(),
        status: 'DRAFT',
        totalEmployees: 1,
      })
      .returning();

    // Add employee record
    await db.insert(zusDeclarationRecords).values({
      declarationId: declaration.id,
      employeeId: employee.id,
      pesel: employee.pesel,
      firstName: employee.firstName,
      lastName: employee.lastName,
      insuranceCode: INSURANCE_CODES.EMPLOYMENT_FULL,
      deregistrationDate: endDate,
      deregistrationCode: DEREGISTRATION_CODES[reason],
    });

    // Generate XML
    const xml = await this.generateZWUAXml(declaration.id);

    await db.update(zusDeclarations)
      .set({
        status: 'GENERATED',
        generatedAt: new Date(),
        xmlContent: xml,
        xmlHash: createHash('sha256').update(xml).digest('hex'),
      })
      .where(eq(zusDeclarations.id, declaration.id));

    return declaration.id;
  }

  /**
   * Calculate ZUS contributions with annual ceiling
   */
  private async calculateContributions(
    employeeId: string,
    grossAmount: number,
    year: number,
    month: number,
    rates: typeof zusRates.$inferSelect
  ): Promise<ZUSContributions> {
    // Get or create annual limits record
    let limits = await db.query.zusAnnualLimits.findFirst({
      where: and(
        eq(zusAnnualLimits.tenantId, this.tenantId),
        eq(zusAnnualLimits.employeeId, employeeId),
        eq(zusAnnualLimits.year, year)
      ),
    });

    if (!limits) {
      [limits] = await db.insert(zusAnnualLimits)
        .values({
          tenantId: this.tenantId,
          employeeId,
          year,
          annualCeiling: rates.annualCeiling,
          ytdBasisRetirement: 0,
          ytdBasisDisability: 0,
          monthlyBases: {},
        })
        .returning();
    }

    // Calculate bases with ceiling
    const remainingRetirement = Math.max(0,
      rates.annualCeiling - Number(limits.ytdBasisRetirement)
    );
    const remainingDisability = Math.max(0,
      rates.annualCeiling - Number(limits.ytdBasisDisability)
    );

    // Apply ceiling to retirement and disability only
    const basisRetirement = Math.min(grossAmount, remainingRetirement);
    const basisDisability = Math.min(grossAmount, remainingDisability);
    const basisSickness = grossAmount;  // No ceiling
    const basisAccident = grossAmount;  // No ceiling
    const basisHealth = grossAmount - (
      grossAmount * Number(rates.rateRetirementEmployee) +
      grossAmount * Number(rates.rateDisabilityEmployee) +
      grossAmount * Number(rates.rateSickness)
    );
    const basisFP = grossAmount;
    const basisFGSP = grossAmount;

    // Calculate employee contributions
    const employeeRetirement = basisRetirement * Number(rates.rateRetirementEmployee);
    const employeeDisability = basisDisability * Number(rates.rateDisabilityEmployee);
    const employeeSickness = basisSickness * Number(rates.rateSickness);
    const employeeHealth = basisHealth * Number(rates.rateHealth);

    // Calculate employer contributions
    const employerRetirement = basisRetirement * Number(rates.rateRetirementEmployer);
    const employerDisability = basisDisability * Number(rates.rateDisabilityEmployer);
    const employerAccident = basisAccident * Number(rates.rateAccidentMin);  // Use min for now
    const employerFP = basisFP * Number(rates.rateFp);
    const employerFGSP = basisFGSP * Number(rates.rateFgsp);

    // Update YTD tracking
    const newYtdRetirement = Number(limits.ytdBasisRetirement) + basisRetirement;
    const newYtdDisability = Number(limits.ytdBasisDisability) + basisDisability;
    const monthlyBases = limits.monthlyBases as Record<string, number> || {};
    monthlyBases[month.toString()] = grossAmount;

    await db.update(zusAnnualLimits)
      .set({
        ytdBasisRetirement: newYtdRetirement,
        ytdBasisDisability: newYtdDisability,
        monthlyBases,
        ceilingReachedDate: newYtdRetirement >= rates.annualCeiling && !limits.ceilingReachedDate
          ? new Date()
          : limits.ceilingReachedDate,
        ceilingReachedMonth: newYtdRetirement >= rates.annualCeiling && !limits.ceilingReachedMonth
          ? month
          : limits.ceilingReachedMonth,
        updatedAt: new Date(),
      })
      .where(eq(zusAnnualLimits.id, limits.id));

    return {
      basisRetirement: this.round2(basisRetirement),
      basisDisability: this.round2(basisDisability),
      basisSickness: this.round2(basisSickness),
      basisAccident: this.round2(basisAccident),
      basisHealth: this.round2(basisHealth),
      basisFP: this.round2(basisFP),
      basisFGSP: this.round2(basisFGSP),
      employeeRetirement: this.round2(employeeRetirement),
      employeeDisability: this.round2(employeeDisability),
      employeeSickness: this.round2(employeeSickness),
      employeeHealth: this.round2(employeeHealth),
      employerRetirement: this.round2(employerRetirement),
      employerDisability: this.round2(employerDisability),
      employerAccident: this.round2(employerAccident),
      employerFP: this.round2(employerFP),
      employerFGSP: this.round2(employerFGSP),
    };
  }

  /**
   * Import e-ZLA from ZUS
   */
  async importEZLA(ezlaData: {
    ezlaNumber: string;
    series: string;
    pesel: string;
    issueDate: Date;
    startDate: Date;
    endDate: Date;
    icdCode?: string;
    isHospital: boolean;
    isInfectious: boolean;
    doctorNpwz: string;
    facilityRegon: string;
  }): Promise<string> {
    // Try to match employee by PESEL
    const employee = await db.query.employees.findFirst({
      where: and(
        eq(employees.tenantId, this.tenantId),
        eq(employees.pesel, ezlaData.pesel)
      ),
    });

    // Insert e-ZLA record
    const [ezla] = await db.insert(ezlaImports)
      .values({
        tenantId: this.tenantId,
        ezlaNumber: ezlaData.ezlaNumber,
        series: ezlaData.series,
        employeeId: employee?.id,
        pesel: ezlaData.pesel,
        employeeMatched: !!employee,
        issueDate: ezlaData.issueDate,
        startDate: ezlaData.startDate,
        endDate: ezlaData.endDate,
        icdCode: ezlaData.icdCode,
        isHospital: ezlaData.isHospital,
        isInfectious: ezlaData.isInfectious,
        doctorNpwz: ezlaData.doctorNpwz,
        facilityRegon: ezlaData.facilityRegon,
        status: employee ? 'MATCHED' : 'PENDING',
      })
      .returning();

    // If employee matched, auto-create leave request
    if (employee) {
      await this.processMatchedEZLA(ezla.id);
    }

    return ezla.id;
  }

  /**
   * Process matched e-ZLA into leave request
   */
  private async processMatchedEZLA(ezlaId: string): Promise<void> {
    const ezla = await db.query.ezlaImports.findFirst({
      where: eq(ezlaImports.id, ezlaId),
    });

    if (!ezla || !ezla.employeeId) return;

    // Create sick leave request
    const [leaveRequest] = await db.insert(leaveRequests)
      .values({
        tenantId: this.tenantId,
        employeeId: ezla.employeeId,
        leaveTypeId: await this.getSickLeaveTypeId(),
        startDate: ezla.startDate,
        endDate: ezla.endDate,
        status: 'APPROVED',  // e-ZLA is automatically valid
        isEzla: true,
        ezlaReference: ezla.ezlaNumber,
        notes: `Imported from e-ZLA ${ezla.ezlaNumber}`,
      })
      .returning();

    // Update e-ZLA record
    await db.update(ezlaImports)
      .set({
        status: 'PROCESSED',
        processedAt: new Date(),
        leaveRequestId: leaveRequest.id,
      })
      .where(eq(ezlaImports.id, ezlaId));
  }

  /**
   * Validate declaration before submission
   */
  async validateDeclaration(declarationId: string): Promise<{
    isValid: boolean;
    errors: Array<{ code: string; message: string; field?: string }>;
  }> {
    const declaration = await db.query.zusDeclarations.findFirst({
      where: eq(zusDeclarations.id, declarationId),
      with: {
        records: true,
      },
    });

    if (!declaration) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Declaration not found',
      });
    }

    const errors: Array<{ code: string; message: string; field?: string }> = [];

    // Validate each record
    for (const record of declaration.records) {
      // Validate PESEL
      if (!this.validatePESEL(record.pesel)) {
        errors.push({
          code: 'ERR_PESEL',
          message: `Invalid PESEL for ${record.firstName} ${record.lastName}`,
          field: 'pesel',
        });
      }

      // Validate insurance code
      if (!Object.values(INSURANCE_CODES).includes(record.insuranceCode as any)) {
        errors.push({
          code: 'ERR_INSURANCE_CODE',
          message: `Invalid insurance code ${record.insuranceCode}`,
          field: 'insuranceCode',
        });
      }

      // Validate contribution bases
      if (Number(record.basisRetirement) < 0) {
        errors.push({
          code: 'ERR_BASIS_NEGATIVE',
          message: `Negative retirement basis for ${record.firstName} ${record.lastName}`,
          field: 'basisRetirement',
        });
      }
    }

    // Validate totals match sum of records
    if (declaration.declarationType === 'DRA') {
      const sumRetirement = declaration.records.reduce(
        (sum, r) => sum + Number(r.basisRetirement), 0
      );
      if (Math.abs(sumRetirement - Number(declaration.totalBasisRetirement)) > 0.01) {
        errors.push({
          code: 'ERR_TOTAL_MISMATCH',
          message: 'Total retirement basis does not match sum of records',
          field: 'totalBasisRetirement',
        });
      }
    }

    const isValid = errors.length === 0;

    // Update declaration status
    await db.update(zusDeclarations)
      .set({
        status: isValid ? 'VALIDATED' : 'DRAFT',
        updatedAt: new Date(),
      })
      .where(eq(zusDeclarations.id, declarationId));

    await this.logAction(declarationId, 'VALIDATE', { isValid, errorCount: errors.length });

    return { isValid, errors };
  }

  /**
   * Create correction declaration (KOA)
   */
  async createCorrection(
    originalDeclarationId: string,
    corrections: Array<{
      employeeId: string;
      field: string;
      oldValue: any;
      newValue: any;
    }>
  ): Promise<string> {
    const original = await db.query.zusDeclarations.findFirst({
      where: eq(zusDeclarations.id, originalDeclarationId),
      with: {
        records: true,
      },
    });

    if (!original) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Original declaration not found',
      });
    }

    if (!['SUBMITTED', 'ACCEPTED'].includes(original.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Can only correct submitted or accepted declarations',
      });
    }

    // Create correction declaration
    const [correction] = await db.insert(zusDeclarations)
      .values({
        tenantId: this.tenantId,
        declarationType: 'KOA',
        periodYear: original.periodYear,
        periodMonth: original.periodMonth,
        sequenceNumber: original.sequenceNumber + 1,
        isCorrection: true,
        correctsDeclarationId: original.id,
        status: 'DRAFT',
        totalEmployees: new Set(corrections.map(c => c.employeeId)).size,
      })
      .returning();

    // Copy and update records
    for (const originalRecord of original.records) {
      const recordCorrections = corrections.filter(
        c => c.employeeId === originalRecord.employeeId
      );

      const newRecord = { ...originalRecord };
      delete newRecord.id;
      newRecord.declarationId = correction.id;

      for (const corr of recordCorrections) {
        (newRecord as any)[corr.field] = corr.newValue;
      }

      await db.insert(zusDeclarationRecords).values(newRecord);
    }

    // Mark original as corrected
    await db.update(zusDeclarations)
      .set({ status: 'CORRECTED' })
      .where(eq(zusDeclarations.id, originalDeclarationId));

    await this.logAction(correction.id, 'CREATE_CORRECTION', {
      originalId: originalDeclarationId,
      correctionCount: corrections.length,
    });

    return correction.id;
  }

  /**
   * Generate Płatnik-compatible DRA XML
   */
  private async generateDRAXml(declarationId: string): Promise<string> {
    const declaration = await db.query.zusDeclarations.findFirst({
      where: eq(zusDeclarations.id, declarationId),
      with: {
        records: true,
      },
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
      'KEDU': {
        '@_xmlns': 'http://www.zus.pl/2024/KEDU_5_4',
        'naglowek': {
          'wersja_schematu': '5.4',
          'typ_dokumentu': 'DRA',
          'id_dokumentu': declaration.id,
          'data_utworzenia': new Date().toISOString().split('T')[0],
        },
        'platnik': {
          'nip': tenant.nip,
          'regon': tenant.regon,
          'nazwa': tenant.name,
          'adres': {
            'ulica': tenant.streetAddress,
            'numer_domu': tenant.buildingNumber,
            'numer_lokalu': tenant.apartmentNumber,
            'kod_pocztowy': tenant.postalCode,
            'miejscowosc': tenant.city,
          },
        },
        'deklaracja': {
          'rok': declaration.periodYear,
          'miesiac': declaration.periodMonth.toString().padStart(2, '0'),
          'numer_deklaracji': declaration.sequenceNumber.toString().padStart(2, '0'),
          'typ_deklaracji': declaration.isCorrection ? 'K' : 'Z',
          'liczba_ubezpieczonych': declaration.totalEmployees,
          'podstawy': {
            'emerytalna': this.formatAmount(declaration.totalBasisRetirement),
            'rentowa': this.formatAmount(declaration.totalBasisDisability),
            'chorobowa': this.formatAmount(declaration.totalBasisSickness),
            'wypadkowa': this.formatAmount(declaration.totalBasisAccident),
            'zdrowotna': this.formatAmount(declaration.totalBasisHealth),
          },
          'skladki': {
            'pracownik': this.formatAmount(declaration.totalContributionEmployee),
            'pracodawca': this.formatAmount(declaration.totalContributionEmployer),
            'zdrowotna': this.formatAmount(declaration.totalContributionHealth),
          },
        },
        'RCA': declaration.records.map(record => ({
          'ubezpieczony': {
            'pesel': record.pesel,
            'imie': record.firstName,
            'nazwisko': record.lastName,
            'kod_ubezpieczenia': record.insuranceCode,
          },
          'podstawy': {
            'emerytalna': this.formatAmount(record.basisRetirement),
            'rentowa': this.formatAmount(record.basisDisability),
            'chorobowa': this.formatAmount(record.basisSickness),
            'wypadkowa': this.formatAmount(record.basisAccident),
            'zdrowotna': this.formatAmount(record.basisHealth),
            'FP': this.formatAmount(record.basisFp),
            'FGSP': this.formatAmount(record.basisFgsp),
          },
          'skladki_pracownik': {
            'emerytalna': this.formatAmount(record.contributionRetirementEmployee),
            'rentowa': this.formatAmount(record.contributionDisabilityEmployee),
            'chorobowa': this.formatAmount(record.contributionSickness),
            'zdrowotna': this.formatAmount(record.contributionHealth),
          },
          'skladki_pracodawca': {
            'emerytalna': this.formatAmount(record.contributionRetirementEmployer),
            'rentowa': this.formatAmount(record.contributionDisabilityEmployer),
            'wypadkowa': this.formatAmount(record.contributionAccident),
            'FP': this.formatAmount(record.contributionFp),
            'FGSP': this.formatAmount(record.contributionFgsp),
          },
        })),
      },
    };

    return builder.build(xmlObj);
  }

  // Helper methods
  private determineInsuranceCode(employee: { contract?: any }): string {
    if (!employee.contract) return INSURANCE_CODES.EMPLOYMENT_FULL;

    switch (employee.contract.type) {
      case 'EMPLOYMENT':
        return INSURANCE_CODES.EMPLOYMENT_FULL;
      case 'CIVIL':
        return employee.contract.voluntarySickness
          ? INSURANCE_CODES.CIVIL_VOLUNTARY
          : INSURANCE_CODES.CIVIL_CONTRACT;
      case 'BOARD':
        return INSURANCE_CODES.BOARD_MEMBER;
      default:
        return INSURANCE_CODES.EMPLOYMENT_FULL;
    }
  }

  private determineAbsenceCode(absence: any): { code: string; benefitType: string } {
    if (absence.isZusPaying) {
      return { code: ABSENCE_CODES.SICK_ZUS, benefitType: 'ZASILEK' };
    }
    return { code: ABSENCE_CODES.SICK_EMPLOYER, benefitType: 'WYNAGRODZENIE' };
  }

  private validatePESEL(pesel: string): boolean {
    if (!/^\d{11}$/.test(pesel)) return false;

    const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
    const sum = weights.reduce((acc, w, i) => acc + w * parseInt(pesel[i]), 0);
    const checksum = (10 - (sum % 10)) % 10;

    return checksum === parseInt(pesel[10]);
  }

  private async getCurrentRates(year: number, month: number): Promise<typeof zusRates.$inferSelect> {
    const date = new Date(year, month - 1, 1);

    const rates = await db.query.zusRates.findFirst({
      where: and(
        lte(zusRates.validFrom, date),
        sql`(${zusRates.validTo} IS NULL OR ${zusRates.validTo} >= ${date})`
      ),
      orderBy: [desc(zusRates.validFrom)],
    });

    if (!rates) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `No ZUS rates configured for ${year}-${month}`,
      });
    }

    return rates;
  }

  private async getSickLeaveTypeId(): Promise<string> {
    const sickLeave = await db.query.leaveTypes.findFirst({
      where: and(
        eq(leaveTypes.tenantId, this.tenantId),
        eq(leaveTypes.code, 'SICK')
      ),
    });
    return sickLeave?.id;
  }

  private formatAmount(amount: number | string | null): string {
    if (amount === null) return '0.00';
    return Number(amount).toFixed(2);
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private async logAction(
    declarationId: string,
    action: string,
    details: Record<string, any>
  ): Promise<void> {
    await db.insert(zusSubmissionLog).values({
      declarationId,
      action,
      performedAt: new Date(),
      requestPayloadHash: createHash('sha256')
        .update(JSON.stringify(details))
        .digest('hex'),
    });
  }
}
```

### tRPC Router

```typescript
// src/server/routers/hrp/zus.router.ts
import { z } from 'zod';
import { router, hrManagerProcedure, systemProcedure } from '@/server/trpc';
import { ZUSService } from '@/server/services/hrp/zus.service';

export const zusRouter = router({
  generateDRA: hrManagerProcedure
    .input(z.object({
      year: z.number().min(2020).max(2100),
      month: z.number().min(1).max(12),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSService(ctx.tenantId);
      return service.generateDRA(input.year, input.month);
    }),

  generateRSA: hrManagerProcedure
    .input(z.object({
      year: z.number().min(2020).max(2100),
      month: z.number().min(1).max(12),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSService(ctx.tenantId);
      return service.generateRSA(input.year, input.month);
    }),

  generateZUA: hrManagerProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      startDate: z.coerce.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSService(ctx.tenantId);
      return service.generateZUA(input.employeeId, input.startDate);
    }),

  generateZWUA: hrManagerProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      endDate: z.coerce.date(),
      reason: z.enum([
        'CONTRACT_END', 'RESIGNATION', 'TERMINATION',
        'MUTUAL', 'DEATH', 'RETIREMENT'
      ]),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSService(ctx.tenantId);
      return service.generateZWUA(input.employeeId, input.endDate, input.reason);
    }),

  validateDeclaration: hrManagerProcedure
    .input(z.object({
      declarationId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSService(ctx.tenantId);
      return service.validateDeclaration(input.declarationId);
    }),

  createCorrection: hrManagerProcedure
    .input(z.object({
      originalDeclarationId: z.string().uuid(),
      corrections: z.array(z.object({
        employeeId: z.string().uuid(),
        field: z.string(),
        oldValue: z.any(),
        newValue: z.any(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSService(ctx.tenantId);
      return service.createCorrection(
        input.originalDeclarationId,
        input.corrections
      );
    }),

  importEZLA: systemProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      ezlaNumber: z.string(),
      series: z.string(),
      pesel: z.string().length(11),
      issueDate: z.coerce.date(),
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      icdCode: z.string().optional(),
      isHospital: z.boolean(),
      isInfectious: z.boolean(),
      doctorNpwz: z.string(),
      facilityRegon: z.string(),
    }))
    .mutation(async ({ input }) => {
      const service = new ZUSService(input.tenantId);
      return service.importEZLA(input);
    }),

  listDeclarations: hrManagerProcedure
    .input(z.object({
      year: z.number().optional(),
      month: z.number().optional(),
      type: z.enum(['DRA', 'RCA', 'RSA', 'ZUA', 'ZWUA', 'ZCNA', 'KOA']).optional(),
      status: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(zusDeclarations.tenantId, ctx.tenantId)];

      if (input.year) conditions.push(eq(zusDeclarations.periodYear, input.year));
      if (input.month) conditions.push(eq(zusDeclarations.periodMonth, input.month));
      if (input.type) conditions.push(eq(zusDeclarations.declarationType, input.type));
      if (input.status) conditions.push(eq(zusDeclarations.status, input.status));

      const [declarations, count] = await Promise.all([
        db.query.zusDeclarations.findMany({
          where: and(...conditions),
          orderBy: [desc(zusDeclarations.periodYear), desc(zusDeclarations.periodMonth)],
          limit: input.pageSize,
          offset: (input.page - 1) * input.pageSize,
        }),
        db.select({ count: sql<number>`count(*)` })
          .from(zusDeclarations)
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
      const declaration = await db.query.zusDeclarations.findFirst({
        where: and(
          eq(zusDeclarations.id, input.declarationId),
          eq(zusDeclarations.tenantId, ctx.tenantId)
        ),
        with: {
          records: true,
        },
      });

      if (!declaration) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Declaration not found',
        });
      }

      return declaration;
    }),

  downloadXml: hrManagerProcedure
    .input(z.object({
      declarationId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const declaration = await db.query.zusDeclarations.findFirst({
        where: and(
          eq(zusDeclarations.id, input.declarationId),
          eq(zusDeclarations.tenantId, ctx.tenantId)
        ),
      });

      if (!declaration?.xmlContent) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'XML not generated yet',
        });
      }

      return {
        xml: declaration.xmlContent,
        filename: `${declaration.declarationType}_${declaration.periodYear}_${declaration.periodMonth?.toString().padStart(2, '0') || '00'}.xml`,
      };
    }),

  getAnnualLimits: hrManagerProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      year: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      return db.query.zusAnnualLimits.findFirst({
        where: and(
          eq(zusAnnualLimits.tenantId, ctx.tenantId),
          eq(zusAnnualLimits.employeeId, input.employeeId),
          eq(zusAnnualLimits.year, input.year)
        ),
      });
    }),

  listPendingEZLA: hrManagerProcedure
    .input(z.object({
      status: z.enum(['PENDING', 'MATCHED', 'PROCESSED', 'REJECTED', 'MANUAL_REVIEW']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(ezlaImports.tenantId, ctx.tenantId)];
      if (input.status) conditions.push(eq(ezlaImports.status, input.status));

      return db.query.ezlaImports.findMany({
        where: and(...conditions),
        orderBy: [desc(ezlaImports.importedAt)],
      });
    }),

  matchEZLA: hrManagerProcedure
    .input(z.object({
      ezlaId: z.string().uuid(),
      employeeId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.update(ezlaImports)
        .set({
          employeeId: input.employeeId,
          employeeMatched: true,
          status: 'MATCHED',
        })
        .where(and(
          eq(ezlaImports.id, input.ezlaId),
          eq(ezlaImports.tenantId, ctx.tenantId)
        ));

      const service = new ZUSService(ctx.tenantId);
      await service.processMatchedEZLA(input.ezlaId);

      return { success: true };
    }),
});
```

## Test Specification

### Unit Tests

```typescript
describe('ZUSService', () => {
  describe('generateDRA', () => {
    it('should generate DRA with correct totals', async () => {
      const service = new ZUSService(tenantId);
      const declarationId = await service.generateDRA(2024, 1);

      const declaration = await getDeclaration(declarationId);
      expect(declaration.declarationType).toBe('DRA');
      expect(declaration.status).toBe('GENERATED');
      expect(declaration.xmlContent).toBeDefined();
    });

    it('should apply annual ceiling to retirement/disability', async () => {
      // Set up employee near ceiling
      await setYtdBasis(employeeId, 2024, 230000);

      const service = new ZUSService(tenantId);
      await service.generateDRA(2024, 12);

      const limits = await getAnnualLimits(employeeId, 2024);
      expect(limits.ceilingReachedMonth).toBe(12);
    });

    it('should reject if no paid payroll records', async () => {
      const service = new ZUSService(tenantId);

      await expect(service.generateDRA(2024, 1))
        .rejects.toThrow('No paid payroll records found');
    });
  });

  describe('generateZUA', () => {
    it('should generate ZUA for new employee', async () => {
      const service = new ZUSService(tenantId);
      const declarationId = await service.generateZUA(
        employeeId,
        new Date('2024-01-15')
      );

      const declaration = await getDeclaration(declarationId);
      expect(declaration.declarationType).toBe('ZUA');
      expect(declaration.records[0].registrationDate).toEqual(
        new Date('2024-01-15')
      );
    });

    it('should determine correct insurance code based on contract', async () => {
      // Civil contract employee
      const declarationId = await service.generateZUA(civilEmployeeId, new Date());

      const declaration = await getDeclaration(declarationId);
      expect(declaration.records[0].insuranceCode).toBe('041100');
    });
  });

  describe('validatePESEL', () => {
    it('should validate correct PESEL', () => {
      expect(service.validatePESEL('44051401359')).toBe(true);
    });

    it('should reject invalid checksum', () => {
      expect(service.validatePESEL('44051401358')).toBe(false);
    });
  });

  describe('importEZLA', () => {
    it('should match e-ZLA to employee by PESEL', async () => {
      const ezlaId = await service.importEZLA({
        ezlaNumber: 'ABC123456',
        series: 'E',
        pesel: employeePesel,
        issueDate: new Date('2024-01-10'),
        startDate: new Date('2024-01-10'),
        endDate: new Date('2024-01-17'),
        isHospital: false,
        isInfectious: false,
        doctorNpwz: '1234567',
        facilityRegon: '12345678901234',
      });

      const ezla = await getEZLA(ezlaId);
      expect(ezla.status).toBe('MATCHED');
      expect(ezla.employeeMatched).toBe(true);
    });

    it('should create leave request for matched e-ZLA', async () => {
      const ezlaId = await service.importEZLA({...});

      const ezla = await getEZLA(ezlaId);
      expect(ezla.leaveRequestId).toBeDefined();

      const leave = await getLeaveRequest(ezla.leaveRequestId);
      expect(leave.isEzla).toBe(true);
    });
  });

  describe('createCorrection', () => {
    it('should create KOA with updated values', async () => {
      const correctionId = await service.createCorrection(
        originalDeclarationId,
        [{
          employeeId,
          field: 'basisRetirement',
          oldValue: 5000,
          newValue: 5500,
        }]
      );

      const correction = await getDeclaration(correctionId);
      expect(correction.declarationType).toBe('KOA');
      expect(correction.isCorrection).toBe(true);
      expect(correction.records[0].basisRetirement).toBe(5500);
    });

    it('should mark original as corrected', async () => {
      await service.createCorrection(originalDeclarationId, [...]);

      const original = await getDeclaration(originalDeclarationId);
      expect(original.status).toBe('CORRECTED');
    });
  });
});
```

### Integration Tests

```typescript
describe('ZUS Integration', () => {
  describe('Full Declaration Workflow', () => {
    it('should complete full DRA workflow', async () => {
      // 1. Generate declaration
      const { declarationId } = await trpc.zus.generateDRA.mutate({
        year: 2024,
        month: 1,
      });

      // 2. Validate
      const validation = await trpc.zus.validateDeclaration.mutate({
        declarationId,
      });
      expect(validation.isValid).toBe(true);

      // 3. Download XML
      const { xml, filename } = await trpc.zus.downloadXml.query({
        declarationId,
      });
      expect(xml).toContain('KEDU');
      expect(filename).toBe('DRA_2024_01.xml');
    });

    it('should handle correction flow', async () => {
      // 1. Submit original
      const original = await generateAndSubmitDRA(2024, 1);

      // 2. Create correction
      const correctionId = await trpc.zus.createCorrection.mutate({
        originalDeclarationId: original.id,
        corrections: [{
          employeeId,
          field: 'basisRetirement',
          oldValue: 5000,
          newValue: 5500,
        }],
      });

      // 3. Validate correction
      const validation = await trpc.zus.validateDeclaration.mutate({
        declarationId: correctionId,
      });
      expect(validation.isValid).toBe(true);
    });
  });

  describe('e-ZLA Processing', () => {
    it('should auto-create leave from e-ZLA', async () => {
      // Simulate e-ZLA webhook
      await trpc.zus.importEZLA.mutate({
        tenantId,
        ezlaNumber: 'TEST123',
        series: 'E',
        pesel: employeePesel,
        issueDate: new Date(),
        startDate: new Date(),
        endDate: addDays(new Date(), 7),
        isHospital: false,
        isInfectious: false,
        doctorNpwz: '1234567',
        facilityRegon: '12345678901234',
      });

      // Verify leave created
      const leaves = await trpc.leave.listRequests.query({
        employeeId,
        status: 'APPROVED',
      });

      const ezlaLeave = leaves.find(l => l.isEzla);
      expect(ezlaLeave).toBeDefined();
      expect(ezlaLeave.ezlaReference).toBe('TEST123');
    });
  });

  describe('Annual Ceiling Tracking', () => {
    it('should track and apply ZUS ceiling', async () => {
      // Process 11 months near ceiling
      for (let month = 1; month <= 11; month++) {
        await processPayroll(employeeId, 2024, month, 20000);
      }

      // 12th month should hit ceiling
      await processPayroll(employeeId, 2024, 12, 20000);

      const limits = await trpc.zus.getAnnualLimits.query({
        employeeId,
        year: 2024,
      });

      expect(limits.ceilingReachedMonth).toBe(12);
      expect(limits.ytdBasisRetirement).toBeLessThanOrEqual(234720);
    });
  });
});
```

## Security Checklist

- [x] PESEL validation with checksum verification
- [x] XML content hashed for integrity verification
- [x] Tenant isolation via RLS policies
- [x] Audit logging for all declaration operations
- [x] HR manager role required for declaration access
- [x] System role required for e-ZLA import (webhook)
- [x] No sensitive data logged in plain text
- [x] Correction chain maintains full audit trail

## Audit Events

| Event | Data Captured |
|-------|--------------|
| `ZUS_DECLARATION_GENERATED` | declaration_id, type, period, employee_count |
| `ZUS_DECLARATION_VALIDATED` | declaration_id, is_valid, error_count |
| `ZUS_DECLARATION_SUBMITTED` | declaration_id, submission_reference |
| `ZUS_DECLARATION_CORRECTED` | original_id, correction_id, corrections |
| `EZLA_IMPORTED` | ezla_number, pesel, matched |
| `EZLA_PROCESSED` | ezla_id, leave_request_id |
| `ZUS_CEILING_REACHED` | employee_id, year, month |

## Implementation Notes

1. **XML Generation**: Uses fast-xml-parser for Płatnik-compatible XML
2. **ZUS Rates**: Stored in database with validity periods for historical accuracy
3. **Annual Ceiling**: Only applies to retirement (emerytalne) and disability (rentowe)
4. **e-ZLA Integration**: Webhook endpoint for ZUS PUE notifications
5. **Correction Flow**: KOA declarations link to original via correctsDeclarationId
6. **Insurance Codes**: 6-digit codes per ZUS classification (e.g., 011000)
7. **Absence Codes**: 3-digit codes for RSA (e.g., 331 for employer-paid sick)
