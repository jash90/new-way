# TAX-006: ZUS Contribution Calculation

> **Story ID**: TAX-006
> **Epic**: Tax Compliance Module (TAX)
> **Priority**: P1 (High)
> **Points**: 8
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant managing payroll and social security,
**I want** to calculate ZUS contributions accurately for all contributor types,
**So that** clients meet their social security obligations and employees receive proper coverage.

---

## Acceptance Criteria

### AC1: Standard ZUS Contribution Calculation (Full Rate)

```gherkin
Feature: Standard ZUS Contribution Calculation
  As an accountant
  I need to calculate full ZUS contributions
  So that standard contributors pay correct social security amounts

  Background:
    Given a contributor with standard ZUS basis
    And the contribution period is January 2025

  Scenario: Calculate employee ZUS contributions
    Given an employee with gross salary of 10,000.00 PLN
    When I calculate employee ZUS contributions
    Then emerytalne (employee) should be 976.00 PLN (9.76%)
    And rentowe (employee) should be 150.00 PLN (1.5%)
    And chorobowe should be 245.00 PLN (2.45%)
    And zdrowotne should be 777.51 PLN (9% of base after social)
    And total employee contribution should be 2,148.51 PLN

  Scenario: Calculate employer ZUS contributions
    Given an employee with gross salary of 10,000.00 PLN
    When I calculate employer ZUS contributions
    Then emerytalne (employer) should be 976.00 PLN (9.76%)
    And rentowe (employer) should be 650.00 PLN (6.5%)
    And wypadkowe should be 167.00 PLN (1.67% - default rate)
    And FP (Fundusz Pracy) should be 245.00 PLN (2.45%)
    And FGŚP should be 10.00 PLN (0.1%)
    And total employer contribution should be 2,048.00 PLN

  Scenario: Calculate total employment cost
    Given an employee with gross salary of 10,000.00 PLN
    When I calculate total employment cost
    Then net salary should be approximately 7,100.00 PLN (after ZUS and PIT)
    And total employer cost should be 12,048.00 PLN
    And cost breakdown should show all components

  Scenario: Calculate ZUS with annual basis limit
    Given an employee with YTD earnings of 220,000.00 PLN
    And the annual ZUS basis limit is 234,720.00 PLN (2025)
    And current month salary is 20,000.00 PLN
    When I calculate ZUS contributions
    Then emerytalne and rentowe should apply only to 14,720.00 PLN
    And chorobowe and zdrowotne should apply to full amount
    And a warning should indicate basis limit reached
```

### AC2: Self-Employed ZUS (Działalność Gospodarcza)

```gherkin
Feature: Self-Employed ZUS Contributions
  As an accountant
  I need to calculate ZUS for self-employed individuals
  So that entrepreneurs pay correct contributions

  Background:
    Given a self-employed client
    And the contribution period is 2025

  Scenario: Calculate standard self-employed ZUS
    Given the declared basis is 4,666.00 PLN (60% of average wage)
    When I calculate self-employed ZUS
    Then emerytalne should be 910.55 PLN (19.52%)
    And rentowe should be 373.28 PLN (8%)
    And chorobowe should be 114.32 PLN (2.45% - voluntary)
    And wypadkowe should be 77.92 PLN (1.67%)
    And FP should be 114.32 PLN (2.45%)
    And zdrowotne should be calculated on declared health basis

  Scenario: Calculate ZUS with higher declared basis
    Given the self-employed declares basis of 10,000.00 PLN
    When I calculate self-employed ZUS
    Then contributions should calculate on 10,000.00 PLN
    And all rates should apply correctly
    And higher future benefits should be noted

  Scenario: Self-employed without chorobowe
    Given the self-employed opted out of sickness insurance
    When I calculate self-employed ZUS
    Then chorobowe should be 0.00 PLN
    And other contributions should calculate normally
    And a note should indicate no sickness coverage

  Scenario: Calculate health insurance (składka zdrowotna)
    Given the self-employed has income of 15,000.00 PLN (month)
    And the taxation form is "zasady ogólne" (tax scale)
    When I calculate health insurance
    Then health basis should be 15,000.00 PLN
    And health contribution should be 1,350.00 PLN (9%)
    And NFZ contribution portion should be tracked
```

### AC3: Preferential ZUS (Mały ZUS Plus)

```gherkin
Feature: Preferential ZUS Plus Calculation
  As an accountant
  I need to apply preferential ZUS rates for eligible small businesses
  So that qualifying entrepreneurs benefit from reduced contributions

  Background:
    Given a self-employed client
    And the client qualifies for Mały ZUS Plus

  Scenario: Verify Mały ZUS Plus eligibility
    Given the client's previous year revenue was 100,000.00 PLN
    And the revenue limit is 120,000 PLN (30x minimum wage)
    And the client has been in business for at least 60 months
    When I check Mały ZUS Plus eligibility
    Then the client should be eligible
    And eligibility period should be calculated (max 36 months)

  Scenario: Calculate Mały ZUS Plus contributions
    Given the client's previous year income was 50,000.00 PLN
    And the calculated basis is 2,500.00 PLN (50% of avg monthly income)
    When I calculate Mały ZUS Plus contributions
    Then the reduced basis should be 2,500.00 PLN
    And emerytalne should be 488.00 PLN
    And rentowe should be 200.00 PLN
    And other contributions should apply to reduced basis
    And total should be significantly lower than standard

  Scenario: Mały ZUS Plus basis calculation rules
    Given the client's previous year income was 30,000.00 PLN
    When I calculate the contribution basis
    Then basis should be between minimum (30% min wage) and maximum (60% avg wage)
    And calculated basis should be 50% of average monthly income
    And basis should respect minimum threshold

  Scenario: Track Mały ZUS Plus usage period
    Given the client has used 24 months of Mały ZUS Plus
    When I check remaining eligibility
    Then remaining months should be 12
    And end date should be calculated
    And notification should be sent when approaching limit
```

### AC4: Preferential ZUS for New Businesses (Ulga na start + Preferencyjne)

```gherkin
Feature: New Business ZUS Relief
  As an accountant
  I need to apply startup ZUS relief correctly
  So that new businesses benefit from reduced contributions

  Background:
    Given a newly registered business

  Scenario: Apply "Ulga na start" (6 months no social)
    Given the business registered on 2025-01-15
    And this is the owner's first business activity
    When I calculate ZUS for first 6 months
    Then social insurance contributions should be 0.00 PLN
    And only health insurance should be payable
    And relief period should end on 2025-07-14

  Scenario: Transition to preferential ZUS (24 months)
    Given the "Ulga na start" period ended
    And the client chooses preferential ZUS
    When I calculate preferential ZUS
    Then basis should be 30% of minimum wage
    And this rate applies for 24 full months
    And end date should be tracked

  Scenario: Track total relief utilization
    Given the client used 6 months "Ulga na start"
    And the client used 18 months preferential ZUS
    When I check relief status
    Then remaining preferential months should be 6
    And total savings to date should be calculated
    And timeline should show transition to standard ZUS
```

### AC5: ZUS for Civil Contracts (Umowa Zlecenie/Dzieło)

```gherkin
Feature: Civil Contract ZUS Contributions
  As an accountant
  I need to calculate ZUS for civil contracts
  So that contractors receive proper social security coverage

  Background:
    Given a contractor on civil contract

  Scenario: Calculate ZUS for umowa zlecenie (mandate contract)
    Given a zlecenie contract with remuneration of 5,000.00 PLN
    And the contractor is not employed elsewhere
    When I calculate contract ZUS
    Then emerytalne should be calculated (19.52% total)
    And rentowe should be calculated (8% total)
    And chorobowe should be voluntary (2.45%)
    And zdrowotne should be 9% of basis

  Scenario: Zlecenie with employment elsewhere
    Given the contractor has full-time employment
    And the employment salary exceeds minimum wage
    When I calculate contract ZUS
    Then only zdrowotne should be mandatory
    And other contributions should be optional
    And a note should explain the exemption

  Scenario: Student exemption (umowa zlecenie)
    Given the contractor is a student under 26 years old
    When I calculate contract ZUS
    Then all ZUS contributions should be 0.00 PLN
    And a note should confirm student exemption

  Scenario: Umowa o dzieło (work contract)
    Given a dzieło contract with remuneration of 8,000.00 PLN
    And no employment relationship exists
    When I calculate contract ZUS
    Then ZUS contributions should be 0.00 PLN
    And only income tax should apply
    And a note should explain dzieło exemption

  Scenario: Multiple zlecenie contracts
    Given the contractor has 3 active zlecenie contracts
    And Contract A pays 3,000.00 PLN (primary)
    And Contract B pays 2,000.00 PLN
    And Contract C pays 1,500.00 PLN
    When I calculate contributions
    Then full ZUS should apply to Contract A
    And only zdrowotne should apply to B and C (above min wage cumulative)
    And the "zbieg tytułów" rules should be applied
```

### AC6: Variable Accident Insurance Rate

```gherkin
Feature: Variable Accident Insurance Rate
  As an accountant
  I need to apply correct accident insurance rates
  So that contributions match the employer's risk category

  Background:
    Given an employer with registered PKD codes

  Scenario: Apply default accident rate
    Given the employer has fewer than 10 insured persons
    When I determine accident insurance rate
    Then the rate should be 1.67% (default)
    And no risk assessment required

  Scenario: Apply risk-based accident rate
    Given the employer has 50 insured persons
    And the primary PKD code is 45.20.Z (car repair)
    And the risk category is 6
    When I determine accident insurance rate
    Then the rate should be 1.47% (category 6)
    And the rate source should be documented

  Scenario: High-risk industry rate
    Given the employer's PKD is 05.10.Z (coal mining)
    And the risk category is 33
    When I determine accident insurance rate
    Then the rate should be 3.33%
    And a note should indicate high-risk classification

  Scenario: Rate change notification
    Given the employer received ZUS notification of rate change
    And the new rate is 2.00%
    And the effective date is 2025-04-01
    When I update accident rate
    Then calculations before April should use old rate
    And calculations from April should use new rate
    And rate history should be maintained
```

### AC7: ZUS Declaration (DRA) Preparation

```gherkin
Feature: ZUS DRA Declaration Generation
  As an accountant
  I need to generate ZUS DRA declarations
  So that contributions are properly reported to ZUS

  Background:
    Given a complete monthly ZUS calculation

  Scenario: Generate DRA for employer
    Given the employer has 10 employees
    And all contributions are calculated for January 2025
    When I generate DRA declaration
    Then DRA summary should include all employees
    And total contributions should match calculations
    And declaration should be in ZUS-approved format

  Scenario: Generate RCA attachments
    Given individual employee calculations exist
    When I generate RCA attachments
    Then one RCA should exist per employee
    And each RCA should show contribution breakdown
    And RCAs should link to parent DRA

  Scenario: Generate RSA for absences
    Given an employee had sick leave in January
    And the sick leave was 5 days
    When I generate RSA report
    Then absence codes should be correct
    And period should match leave dates
    And benefit amounts should be calculated

  Scenario: Generate RZA for health-only contributors
    Given a contractor pays only health insurance
    When I generate declarations
    Then RZA should be generated (not RCA)
    And only health contribution should appear
    And title to insurance should be specified

  Scenario: DRA submission deadline calculation
    Given the declaration is for January 2025
    And the employer is a business entity
    When I calculate submission deadline
    Then deadline should be February 15, 2025
    And if weekend/holiday, next business day applies
```

---

## Technical Specification

### Database Schema

```sql
-- ZUS Contribution Types (Reference)
CREATE TABLE zus_contribution_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE, -- 'EMERYTALNE', 'RENTOWE', etc.
  name_pl VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),

  -- Rate Information
  employee_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  employer_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  self_employed_rate DECIMAL(5,2) NOT NULL DEFAULT 0,

  -- Optionality
  is_mandatory_employee BOOLEAN NOT NULL DEFAULT true,
  is_mandatory_employer BOOLEAN NOT NULL DEFAULT true,
  is_mandatory_self_employed BOOLEAN NOT NULL DEFAULT true,
  is_voluntary_option BOOLEAN NOT NULL DEFAULT false,

  -- Validity
  effective_from DATE NOT NULL,
  effective_to DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert 2025 ZUS rates
INSERT INTO zus_contribution_types (code, name_pl, employee_rate, employer_rate, self_employed_rate, is_mandatory_employee, is_mandatory_employer, is_mandatory_self_employed, effective_from) VALUES
('EMERYTALNE', 'Ubezpieczenie emerytalne', 9.76, 9.76, 19.52, true, true, true, '2025-01-01'),
('RENTOWE', 'Ubezpieczenie rentowe', 1.50, 6.50, 8.00, true, true, true, '2025-01-01'),
('CHOROBOWE', 'Ubezpieczenie chorobowe', 2.45, 0, 2.45, true, false, false, '2025-01-01'),
('WYPADKOWE', 'Ubezpieczenie wypadkowe', 0, 1.67, 1.67, false, true, true, '2025-01-01'),
('ZDROWOTNE', 'Ubezpieczenie zdrowotne', 9.00, 0, 9.00, true, false, true, '2025-01-01'),
('FP', 'Fundusz Pracy', 0, 2.45, 2.45, false, true, true, '2025-01-01'),
('FGSP', 'FGŚP', 0, 0.10, 0, false, true, false, '2025-01-01'),
('FEP', 'Fundusz Emerytur Pomostowych', 0, 1.50, 0, false, false, false, '2025-01-01');

-- ZUS Parameters (Annual)
CREATE TABLE zus_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL UNIQUE,

  -- Basis Limits
  annual_basis_limit DECIMAL(15,2) NOT NULL, -- 30x average wage
  minimum_wage DECIMAL(10,2) NOT NULL,
  average_wage DECIMAL(10,2) NOT NULL,

  -- Standard Basis
  self_employed_standard_basis DECIMAL(10,2) NOT NULL, -- 60% of average
  preferential_basis DECIMAL(10,2) NOT NULL, -- 30% of minimum

  -- Health Insurance
  health_basis_minimum DECIMAL(10,2) NOT NULL,

  -- Small ZUS Plus
  small_zus_plus_revenue_limit DECIMAL(15,2) NOT NULL, -- 30x minimum

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert 2025 parameters
INSERT INTO zus_parameters (year, annual_basis_limit, minimum_wage, average_wage, self_employed_standard_basis, preferential_basis, health_basis_minimum, small_zus_plus_revenue_limit) VALUES
(2025, 234720.00, 4666.00, 7767.00, 4666.00, 1399.80, 4666.00, 120000.00);

-- Contributor Profiles
CREATE TABLE zus_contributor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID REFERENCES clients(id),
  employee_id UUID REFERENCES employees(id),

  -- Contributor Type
  contributor_type contributor_type_enum NOT NULL,
  -- 'EMPLOYEE', 'SELF_EMPLOYED', 'ZLECENIE', 'DZIELO', 'MEMBER'

  -- ZUS Identifiers
  pesel VARCHAR(11),
  nip VARCHAR(10),
  regon VARCHAR(14),

  -- Relief Status
  relief_type relief_type_enum, -- 'ULGA_NA_START', 'PREFERENTIAL', 'MALY_ZUS_PLUS', 'STANDARD'
  relief_start_date DATE,
  relief_end_date DATE,
  relief_months_used INTEGER DEFAULT 0,

  -- Optional Insurance
  has_chorobowe BOOLEAN DEFAULT true,

  -- Custom Rates
  custom_wypadkowe_rate DECIMAL(5,2),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  insurance_start_date DATE NOT NULL,
  insurance_end_date DATE,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ZUS Calculations
CREATE TABLE zus_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  contributor_profile_id UUID NOT NULL REFERENCES zus_contributor_profiles(id),

  -- Period
  calculation_year INTEGER NOT NULL,
  calculation_month INTEGER NOT NULL,

  -- Basis
  gross_amount DECIMAL(15,2) NOT NULL,
  contribution_basis DECIMAL(15,2) NOT NULL,
  health_basis DECIMAL(15,2) NOT NULL,

  -- YTD Tracking (for annual limit)
  ytd_basis_before DECIMAL(15,2) NOT NULL DEFAULT 0,
  basis_limit_applied BOOLEAN NOT NULL DEFAULT false,
  basis_after_limit DECIMAL(15,2),

  -- Employee Contributions
  emerytalne_employee DECIMAL(10,2) NOT NULL DEFAULT 0,
  rentowe_employee DECIMAL(10,2) NOT NULL DEFAULT 0,
  chorobowe DECIMAL(10,2) NOT NULL DEFAULT 0,
  zdrowotne DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_employee DECIMAL(10,2) NOT NULL,

  -- Employer Contributions
  emerytalne_employer DECIMAL(10,2) NOT NULL DEFAULT 0,
  rentowe_employer DECIMAL(10,2) NOT NULL DEFAULT 0,
  wypadkowe DECIMAL(10,2) NOT NULL DEFAULT 0,
  fp DECIMAL(10,2) NOT NULL DEFAULT 0,
  fgsp DECIMAL(10,2) NOT NULL DEFAULT 0,
  fep DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_employer DECIMAL(10,2) NOT NULL,

  -- Total
  total_contribution DECIMAL(10,2) NOT NULL,

  -- Rates Used
  wypadkowe_rate_used DECIMAL(5,2) NOT NULL,

  -- Relief Applied
  relief_type_applied relief_type_enum,
  relief_savings DECIMAL(10,2) DEFAULT 0,

  -- Status
  status calculation_status_enum NOT NULL DEFAULT 'DRAFT',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  calculated_by UUID REFERENCES users(id),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_month CHECK (calculation_month BETWEEN 1 AND 12)
);

-- ZUS Declarations
CREATE TABLE zus_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID REFERENCES clients(id),

  -- Declaration Info
  declaration_type declaration_type_enum NOT NULL, -- 'DRA', 'RCA', 'RSA', 'RZA'
  declaration_year INTEGER NOT NULL,
  declaration_month INTEGER NOT NULL,

  -- For RCA/RSA/RZA - linked contributor
  contributor_profile_id UUID REFERENCES zus_contributor_profiles(id),

  -- For DRA - summary data
  total_contributors INTEGER,
  total_emerytalne DECIMAL(15,2),
  total_rentowe DECIMAL(15,2),
  total_chorobowe DECIMAL(15,2),
  total_wypadkowe DECIMAL(15,2),
  total_zdrowotne DECIMAL(15,2),
  total_fp DECIMAL(15,2),
  total_fgsp DECIMAL(15,2),
  grand_total DECIMAL(15,2),

  -- Submission
  due_date DATE NOT NULL,
  submission_date TIMESTAMPTZ,
  confirmation_number VARCHAR(50),

  -- Status
  status declaration_status_enum NOT NULL DEFAULT 'DRAFT',

  -- File Storage
  xml_file_path VARCHAR(500),
  pdf_file_path VARCHAR(500),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Accident Insurance Rates by PKD
CREATE TABLE wypadkowe_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pkd_code VARCHAR(10) NOT NULL,
  pkd_description VARCHAR(255),
  risk_category INTEGER NOT NULL,
  rate DECIMAL(5,2) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Relief Tracking
CREATE TABLE zus_relief_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_profile_id UUID NOT NULL REFERENCES zus_contributor_profiles(id),

  relief_type relief_type_enum NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  max_months INTEGER NOT NULL,
  months_used INTEGER NOT NULL DEFAULT 0,

  -- Savings
  total_savings DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  exhausted_date DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_zus_calc_contributor ON zus_calculations(contributor_profile_id, calculation_year, calculation_month);
CREATE INDEX idx_zus_calc_org ON zus_calculations(organization_id, calculation_year, calculation_month);
CREATE INDEX idx_zus_declaration_client ON zus_declarations(client_id, declaration_year, declaration_month);
CREATE INDEX idx_contributor_profile_org ON zus_contributor_profiles(organization_id, is_active);
CREATE INDEX idx_wypadkowe_pkd ON wypadkowe_rates(pkd_code, effective_from);

-- RLS Policies
ALTER TABLE zus_contributor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE zus_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE zus_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE zus_relief_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY zus_contributor_org_isolation ON zus_contributor_profiles
  FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);

CREATE POLICY zus_calc_org_isolation ON zus_calculations
  FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);

CREATE POLICY zus_decl_org_isolation ON zus_declarations
  FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Enums
export const ContributorTypeEnum = z.enum([
  'EMPLOYEE',
  'SELF_EMPLOYED',
  'ZLECENIE',
  'DZIELO',
  'BOARD_MEMBER',
]);

export const ReliefTypeEnum = z.enum([
  'STANDARD',
  'ULGA_NA_START',
  'PREFERENTIAL',
  'MALY_ZUS_PLUS',
]);

export const DeclarationTypeEnum = z.enum(['DRA', 'RCA', 'RSA', 'RZA']);

// ZUS Calculation Input
export const ZUSCalculationInputSchema = z.object({
  contributorProfileId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),

  // Basis
  grossAmount: z.string().refine(
    (val) => parseFloat(val) >= 0,
    { message: 'Gross amount cannot be negative' }
  ),

  // Optional overrides
  customBasis: z.string().optional(),
  customHealthBasis: z.string().optional(),

  // YTD context
  ytdBasisBefore: z.string().optional(),

  // Options
  includeChorobowe: z.boolean().default(true),
  customWypadkoweRate: z.string().optional(),
});

// Self-Employed ZUS Input
export const SelfEmployedZUSInputSchema = z.object({
  contributorProfileId: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),

  // Basis declaration
  declaredBasis: z.string().optional(),
  useMalyZusPlus: z.boolean().default(false),
  previousYearIncome: z.string().optional(), // For Mały ZUS Plus calculation

  // Health insurance
  monthlyIncome: z.string().optional(), // For variable health basis
  taxationForm: z.enum(['SCALE', 'FLAT', 'RYCZALT', 'KARTA']),

  // Options
  includeChorobowe: z.boolean().default(true),
});

// Contributor Profile Input
export const ContributorProfileInputSchema = z.object({
  clientId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),

  contributorType: ContributorTypeEnum,

  // Identifiers
  pesel: z.string().length(11).optional(),
  nip: z.string().length(10).optional(),

  // Relief
  reliefType: ReliefTypeEnum.default('STANDARD'),
  reliefStartDate: z.string().datetime().optional(),

  // Insurance dates
  insuranceStartDate: z.string().datetime(),

  // Options
  hasChorobowe: z.boolean().default(true),
  customWypadkoweRate: z.string().optional(),
});

// Relief Eligibility Check Input
export const ReliefEligibilityInputSchema = z.object({
  contributorProfileId: z.string().uuid(),
  reliefType: ReliefTypeEnum,
  previousYearRevenue: z.string().optional(),
  previousYearIncome: z.string().optional(),
  businessStartDate: z.string().datetime().optional(),
  monthsInBusiness: z.number().int().optional(),
});

// DRA Generation Input
export const DRAGenerationInputSchema = z.object({
  clientId: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  includeRCA: z.boolean().default(true),
  includeRSA: z.boolean().default(true),
  includeRZA: z.boolean().default(true),
});

// Calculation Result
export const ZUSCalculationResultSchema = z.object({
  calculationId: z.string().uuid(),

  // Basis
  grossAmount: z.string(),
  contributionBasis: z.string(),
  healthBasis: z.string(),
  basisLimitApplied: z.boolean(),

  // Employee contributions
  emerytalne_employee: z.string(),
  rentowe_employee: z.string(),
  chorobowe: z.string(),
  zdrowotne: z.string(),
  totalEmployee: z.string(),

  // Employer contributions
  emerytalne_employer: z.string(),
  rentowe_employer: z.string(),
  wypadkowe: z.string(),
  fp: z.string(),
  fgsp: z.string(),
  fep: z.string().optional(),
  totalEmployer: z.string(),

  // Total
  totalContribution: z.string(),

  // Net calculation
  netAmount: z.string().optional(),

  // Relief info
  reliefApplied: ReliefTypeEnum.optional(),
  reliefSavings: z.string().optional(),

  // Rates used
  rates: z.object({
    emerytalne: z.string(),
    rentowe_employee: z.string(),
    rentowe_employer: z.string(),
    chorobowe: z.string(),
    wypadkowe: z.string(),
    zdrowotne: z.string(),
    fp: z.string(),
    fgsp: z.string(),
  }),
});
```

### Service Implementation

```typescript
// src/server/services/zus-contribution.service.ts
import Decimal from 'decimal.js';
import { db } from '@/server/db';
import {
  zusContributorProfiles,
  zusCalculations,
  zusDeclarations,
  zusParameters,
  zusContributionTypes,
  zusReliefTracking,
  wypadkoweRates,
} from '@/server/db/schema';
import { eq, and, lte, gte, desc } from 'drizzle-orm';

// 2025 ZUS Rates
const ZUS_RATES = {
  EMERYTALNE: { employee: new Decimal('9.76'), employer: new Decimal('9.76') },
  RENTOWE: { employee: new Decimal('1.5'), employer: new Decimal('6.5') },
  CHOROBOWE: { employee: new Decimal('2.45'), employer: new Decimal('0') },
  WYPADKOWE_DEFAULT: new Decimal('1.67'),
  ZDROWOTNE: new Decimal('9'),
  FP: new Decimal('2.45'),
  FGSP: new Decimal('0.1'),
  FEP: new Decimal('1.5'),
};

export class ZUSContributionService {
  constructor(private readonly db: typeof db) {}

  // ===================
  // EMPLOYEE ZUS
  // ===================

  async calculateEmployeeZUS(
    input: ZUSCalculationInput
  ): Promise<ZUSCalculationResult> {
    const profile = await this.getContributorProfile(input.contributorProfileId);
    const params = await this.getZUSParameters(input.year);

    const gross = new Decimal(input.grossAmount);

    // Check annual basis limit
    const ytdBefore = new Decimal(input.ytdBasisBefore || '0');
    const { basis, limitApplied } = this.applyAnnualBasisLimit(
      gross,
      ytdBefore,
      new Decimal(params.annualBasisLimit)
    );

    // Calculate social insurance basis (for emerytalne, rentowe, chorobowe)
    const socialBasis = basis;

    // Calculate health insurance basis (gross minus social contributions)
    const socialEmployee = this.calculateEmployeeSocialContributions(socialBasis);
    const healthBasis = gross.minus(socialEmployee.total);

    // Calculate all contributions
    const employeeContributions = {
      emerytalne: socialBasis.mul(ZUS_RATES.EMERYTALNE.employee.div(100)),
      rentowe: socialBasis.mul(ZUS_RATES.RENTOWE.employee.div(100)),
      chorobowe: input.includeChorobowe
        ? socialBasis.mul(ZUS_RATES.CHOROBOWE.employee.div(100))
        : new Decimal(0),
      zdrowotne: healthBasis.mul(ZUS_RATES.ZDROWOTNE.div(100)),
    };

    // Get accident insurance rate
    const wypadkoweRate = input.customWypadkoweRate
      ? new Decimal(input.customWypadkoweRate)
      : await this.getWypadkoweRate(profile.organizationId);

    const employerContributions = {
      emerytalne: socialBasis.mul(ZUS_RATES.EMERYTALNE.employer.div(100)),
      rentowe: socialBasis.mul(ZUS_RATES.RENTOWE.employer.div(100)),
      wypadkowe: socialBasis.mul(wypadkoweRate.div(100)),
      fp: gross.mul(ZUS_RATES.FP.div(100)),
      fgsp: gross.mul(ZUS_RATES.FGSP.div(100)),
      fep: new Decimal(0), // Only for specific jobs
    };

    // Round all values
    const rounded = this.roundContributions({
      employee: employeeContributions,
      employer: employerContributions,
    });

    const totalEmployee = rounded.employee.emerytalne
      .plus(rounded.employee.rentowe)
      .plus(rounded.employee.chorobowe)
      .plus(rounded.employee.zdrowotne);

    const totalEmployer = rounded.employer.emerytalne
      .plus(rounded.employer.rentowe)
      .plus(rounded.employer.wypadkowe)
      .plus(rounded.employer.fp)
      .plus(rounded.employer.fgsp);

    const totalContribution = totalEmployee.plus(totalEmployer);

    // Save calculation
    const [calculation] = await this.db
      .insert(zusCalculations)
      .values({
        organizationId: profile.organizationId,
        contributorProfileId: input.contributorProfileId,
        calculationYear: input.year,
        calculationMonth: input.month,
        grossAmount: gross.toString(),
        contributionBasis: socialBasis.toString(),
        healthBasis: healthBasis.toString(),
        ytdBasisBefore: ytdBefore.toString(),
        basisLimitApplied: limitApplied,
        basisAfterLimit: limitApplied ? basis.toString() : null,
        emerytalne_employee: rounded.employee.emerytalne.toString(),
        rentowe_employee: rounded.employee.rentowe.toString(),
        chorobowe: rounded.employee.chorobowe.toString(),
        zdrowotne: rounded.employee.zdrowotne.toString(),
        totalEmployee: totalEmployee.toString(),
        emerytalne_employer: rounded.employer.emerytalne.toString(),
        rentowe_employer: rounded.employer.rentowe.toString(),
        wypadkowe: rounded.employer.wypadkowe.toString(),
        fp: rounded.employer.fp.toString(),
        fgsp: rounded.employer.fgsp.toString(),
        fep: '0',
        totalEmployer: totalEmployer.toString(),
        totalContribution: totalContribution.toString(),
        wypadkoweRateUsed: wypadkoweRate.toString(),
        status: 'CALCULATED',
      })
      .returning();

    return {
      calculationId: calculation.id,
      grossAmount: gross.toString(),
      contributionBasis: socialBasis.toString(),
      healthBasis: healthBasis.toString(),
      basisLimitApplied: limitApplied,
      emerytalne_employee: rounded.employee.emerytalne.toString(),
      rentowe_employee: rounded.employee.rentowe.toString(),
      chorobowe: rounded.employee.chorobowe.toString(),
      zdrowotne: rounded.employee.zdrowotne.toString(),
      totalEmployee: totalEmployee.toString(),
      emerytalne_employer: rounded.employer.emerytalne.toString(),
      rentowe_employer: rounded.employer.rentowe.toString(),
      wypadkowe: rounded.employer.wypadkowe.toString(),
      fp: rounded.employer.fp.toString(),
      fgsp: rounded.employer.fgsp.toString(),
      totalEmployer: totalEmployer.toString(),
      totalContribution: totalContribution.toString(),
      rates: {
        emerytalne: '19.52',
        rentowe_employee: '1.5',
        rentowe_employer: '6.5',
        chorobowe: '2.45',
        wypadkowe: wypadkoweRate.toString(),
        zdrowotne: '9',
        fp: '2.45',
        fgsp: '0.1',
      },
    };
  }

  private calculateEmployeeSocialContributions(basis: Decimal): {
    emerytalne: Decimal;
    rentowe: Decimal;
    chorobowe: Decimal;
    total: Decimal;
  } {
    const emerytalne = basis.mul(ZUS_RATES.EMERYTALNE.employee.div(100));
    const rentowe = basis.mul(ZUS_RATES.RENTOWE.employee.div(100));
    const chorobowe = basis.mul(ZUS_RATES.CHOROBOWE.employee.div(100));
    const total = emerytalne.plus(rentowe).plus(chorobowe);

    return { emerytalne, rentowe, chorobowe, total };
  }

  // ===================
  // SELF-EMPLOYED ZUS
  // ===================

  async calculateSelfEmployedZUS(
    input: SelfEmployedZUSInput
  ): Promise<ZUSCalculationResult> {
    const profile = await this.getContributorProfile(input.contributorProfileId);
    const params = await this.getZUSParameters(input.year);

    // Determine contribution basis based on relief type
    let socialBasis: Decimal;
    let reliefApplied: string | undefined;
    let reliefSavings = new Decimal(0);

    if (profile.reliefType === 'ULGA_NA_START') {
      // No social contributions, only health
      socialBasis = new Decimal(0);
      reliefApplied = 'ULGA_NA_START';
      reliefSavings = new Decimal(params.selfEmployedStandardBasis)
        .mul(new Decimal('30.03').div(100)); // Approximate savings
    } else if (profile.reliefType === 'PREFERENTIAL') {
      // 30% of minimum wage
      socialBasis = new Decimal(params.preferentialBasis);
      reliefApplied = 'PREFERENTIAL';
      const standardContrib = new Decimal(params.selfEmployedStandardBasis)
        .mul(new Decimal('30.03').div(100));
      const preferentialContrib = socialBasis.mul(new Decimal('30.03').div(100));
      reliefSavings = standardContrib.minus(preferentialContrib);
    } else if (input.useMalyZusPlus && input.previousYearIncome) {
      // Mały ZUS Plus - 50% of average monthly income from previous year
      const avgMonthlyIncome = new Decimal(input.previousYearIncome).div(12);
      const calculatedBasis = avgMonthlyIncome.mul(new Decimal('0.5'));

      // Apply min/max limits
      const minBasis = new Decimal(params.preferentialBasis);
      const maxBasis = new Decimal(params.selfEmployedStandardBasis);

      socialBasis = Decimal.max(minBasis, Decimal.min(calculatedBasis, maxBasis));
      reliefApplied = 'MALY_ZUS_PLUS';

      const standardContrib = maxBasis.mul(new Decimal('30.03').div(100));
      const actualContrib = socialBasis.mul(new Decimal('30.03').div(100));
      reliefSavings = standardContrib.minus(actualContrib);
    } else if (input.declaredBasis) {
      // Custom declared basis (minimum is standard)
      socialBasis = Decimal.max(
        new Decimal(input.declaredBasis),
        new Decimal(params.selfEmployedStandardBasis)
      );
    } else {
      // Standard basis (60% of average wage)
      socialBasis = new Decimal(params.selfEmployedStandardBasis);
    }

    // Calculate health insurance basis
    const healthBasis = this.calculateHealthBasis(
      input.taxationForm,
      input.monthlyIncome ? new Decimal(input.monthlyIncome) : undefined,
      new Decimal(params.healthBasisMinimum)
    );

    // Calculate contributions (self-employed pays both parts)
    const socialContributions = {
      emerytalne: socialBasis.mul(new Decimal('19.52').div(100)),
      rentowe: socialBasis.mul(new Decimal('8').div(100)),
      chorobowe: input.includeChorobowe
        ? socialBasis.mul(ZUS_RATES.CHOROBOWE.employee.div(100))
        : new Decimal(0),
      wypadkowe: socialBasis.mul(ZUS_RATES.WYPADKOWE_DEFAULT.div(100)),
      fp: socialBasis.mul(ZUS_RATES.FP.div(100)),
    };

    const healthContribution = healthBasis.mul(ZUS_RATES.ZDROWOTNE.div(100));

    // Round all values
    const rounded = {
      emerytalne: socialContributions.emerytalne.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      rentowe: socialContributions.rentowe.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      chorobowe: socialContributions.chorobowe.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      wypadkowe: socialContributions.wypadkowe.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      fp: socialContributions.fp.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      zdrowotne: healthContribution.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    };

    const totalSocial = rounded.emerytalne
      .plus(rounded.rentowe)
      .plus(rounded.chorobowe)
      .plus(rounded.wypadkowe)
      .plus(rounded.fp);

    const totalContribution = totalSocial.plus(rounded.zdrowotne);

    // Save calculation
    const [calculation] = await this.db
      .insert(zusCalculations)
      .values({
        organizationId: profile.organizationId,
        contributorProfileId: input.contributorProfileId,
        calculationYear: input.year,
        calculationMonth: input.month,
        grossAmount: socialBasis.toString(), // For self-employed, basis is the "gross"
        contributionBasis: socialBasis.toString(),
        healthBasis: healthBasis.toString(),
        ytdBasisBefore: '0',
        basisLimitApplied: false,
        emerytalne_employee: rounded.emerytalne.toString(),
        rentowe_employee: rounded.rentowe.toString(),
        chorobowe: rounded.chorobowe.toString(),
        zdrowotne: rounded.zdrowotne.toString(),
        totalEmployee: totalContribution.toString(),
        emerytalne_employer: '0',
        rentowe_employer: '0',
        wypadkowe: rounded.wypadkowe.toString(),
        fp: rounded.fp.toString(),
        fgsp: '0',
        fep: '0',
        totalEmployer: '0',
        totalContribution: totalContribution.toString(),
        wypadkoweRateUsed: ZUS_RATES.WYPADKOWE_DEFAULT.toString(),
        reliefTypeApplied: reliefApplied,
        reliefSavings: reliefSavings.toString(),
        status: 'CALCULATED',
      })
      .returning();

    return {
      calculationId: calculation.id,
      grossAmount: socialBasis.toString(),
      contributionBasis: socialBasis.toString(),
      healthBasis: healthBasis.toString(),
      basisLimitApplied: false,
      emerytalne_employee: rounded.emerytalne.toString(),
      rentowe_employee: rounded.rentowe.toString(),
      chorobowe: rounded.chorobowe.toString(),
      zdrowotne: rounded.zdrowotne.toString(),
      totalEmployee: totalContribution.toString(),
      emerytalne_employer: '0',
      rentowe_employer: '0',
      wypadkowe: rounded.wypadkowe.toString(),
      fp: rounded.fp.toString(),
      fgsp: '0',
      totalEmployer: '0',
      totalContribution: totalContribution.toString(),
      reliefApplied: reliefApplied as any,
      reliefSavings: reliefSavings.toString(),
      rates: {
        emerytalne: '19.52',
        rentowe_employee: '8',
        rentowe_employer: '0',
        chorobowe: '2.45',
        wypadkowe: '1.67',
        zdrowotne: '9',
        fp: '2.45',
        fgsp: '0',
      },
    };
  }

  private calculateHealthBasis(
    taxationForm: string,
    monthlyIncome: Decimal | undefined,
    minimum: Decimal
  ): Decimal {
    // Health basis depends on taxation form
    switch (taxationForm) {
      case 'SCALE':
      case 'FLAT':
        // Based on actual income
        return monthlyIncome && monthlyIncome.gte(minimum)
          ? monthlyIncome
          : minimum;
      case 'RYCZALT':
        // Fixed basis tiers based on annual revenue
        return minimum; // Simplified - should use revenue tiers
      case 'KARTA':
        // Fixed minimal basis
        return minimum;
      default:
        return minimum;
    }
  }

  // ===================
  // RELIEF MANAGEMENT
  // ===================

  async checkReliefEligibility(
    input: ReliefEligibilityInput
  ): Promise<{
    isEligible: boolean;
    reason?: string;
    maxMonths?: number;
    remainingMonths?: number;
    estimatedSavings?: string;
  }> {
    const profile = await this.getContributorProfile(input.contributorProfileId);

    switch (input.reliefType) {
      case 'ULGA_NA_START':
        return this.checkUlgaNaStartEligibility(profile, input);
      case 'PREFERENTIAL':
        return this.checkPreferentialEligibility(profile, input);
      case 'MALY_ZUS_PLUS':
        return this.checkMalyZusPlusEligibility(profile, input);
      default:
        return { isEligible: true };
    }
  }

  private async checkUlgaNaStartEligibility(
    profile: any,
    input: ReliefEligibilityInput
  ): Promise<any> {
    // Ulga na start: 6 months, first business activity only

    // Check if first business
    if (input.businessStartDate) {
      const startDate = new Date(input.businessStartDate);
      const sixMonthsLater = new Date(startDate);
      sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

      const now = new Date();
      if (now > sixMonthsLater) {
        return {
          isEligible: false,
          reason: 'Okres Ulgi na start (6 miesięcy) został przekroczony',
        };
      }

      const remainingDays = Math.ceil(
        (sixMonthsLater.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const remainingMonths = Math.ceil(remainingDays / 30);

      return {
        isEligible: true,
        maxMonths: 6,
        remainingMonths,
        estimatedSavings: '1400', // Approximate monthly savings
      };
    }

    return { isEligible: true, maxMonths: 6 };
  }

  private async checkPreferentialEligibility(
    profile: any,
    input: ReliefEligibilityInput
  ): Promise<any> {
    // Preferential ZUS: 24 months after Ulga na start or from business start

    // Check months in business
    if (input.monthsInBusiness && input.monthsInBusiness > 30) {
      // 6 months ulga + 24 months preferential = 30 max
      return {
        isEligible: false,
        reason: 'Okres preferencyjny ZUS (24 miesiące) został przekroczony',
      };
    }

    const relief = await this.db.query.zusReliefTracking.findFirst({
      where: and(
        eq(zusReliefTracking.contributorProfileId, input.contributorProfileId),
        eq(zusReliefTracking.reliefType, 'PREFERENTIAL'),
      ),
    });

    if (relief) {
      const remaining = relief.maxMonths - relief.monthsUsed;
      if (remaining <= 0) {
        return {
          isEligible: false,
          reason: 'Wykorzystano limit preferencyjnego ZUS',
        };
      }

      return {
        isEligible: true,
        maxMonths: 24,
        remainingMonths: remaining,
        estimatedSavings: '800', // Approximate monthly savings
      };
    }

    return { isEligible: true, maxMonths: 24, remainingMonths: 24 };
  }

  private async checkMalyZusPlusEligibility(
    profile: any,
    input: ReliefEligibilityInput
  ): Promise<any> {
    // Mały ZUS Plus: 36 months, revenue < 120,000 PLN, > 60 months in business

    const params = await this.getZUSParameters(new Date().getFullYear());

    // Check revenue limit
    if (input.previousYearRevenue) {
      const revenue = new Decimal(input.previousYearRevenue);
      const limit = new Decimal(params.smallZusPlusRevenueLimit);

      if (revenue.gte(limit)) {
        return {
          isEligible: false,
          reason: `Przychód przekracza limit ${limit.toString()} PLN`,
        };
      }
    }

    // Check business duration (>60 months required)
    if (input.monthsInBusiness && input.monthsInBusiness < 60) {
      return {
        isEligible: false,
        reason: 'Wymagane minimum 60 miesięcy prowadzenia działalności',
      };
    }

    // Check if already used 36 months
    const relief = await this.db.query.zusReliefTracking.findFirst({
      where: and(
        eq(zusReliefTracking.contributorProfileId, input.contributorProfileId),
        eq(zusReliefTracking.reliefType, 'MALY_ZUS_PLUS'),
      ),
    });

    if (relief) {
      const remaining = 36 - relief.monthsUsed;
      if (remaining <= 0) {
        return {
          isEligible: false,
          reason: 'Wykorzystano limit Małego ZUS Plus (36 miesięcy)',
        };
      }

      return {
        isEligible: true,
        maxMonths: 36,
        remainingMonths: remaining,
      };
    }

    return { isEligible: true, maxMonths: 36, remainingMonths: 36 };
  }

  // ===================
  // DRA DECLARATION
  // ===================

  async generateDRADeclaration(
    input: DRAGenerationInput
  ): Promise<{
    draId: string;
    rcaCount: number;
    rsaCount: number;
    rzaCount: number;
    totals: any;
    dueDate: Date;
  }> {
    // Get all calculations for the month
    const calculations = await this.db.query.zusCalculations.findMany({
      where: and(
        eq(zusCalculations.clientId, input.clientId),
        eq(zusCalculations.calculationYear, input.year),
        eq(zusCalculations.calculationMonth, input.month),
        eq(zusCalculations.status, 'CALCULATED'),
      ),
      with: {
        contributorProfile: true,
      },
    });

    if (calculations.length === 0) {
      throw new Error('No calculations found for this period');
    }

    // Aggregate totals
    const totals = calculations.reduce(
      (acc, calc) => ({
        emerytalne: new Decimal(acc.emerytalne)
          .plus(calc.emerytalne_employee)
          .plus(calc.emerytalne_employer),
        rentowe: new Decimal(acc.rentowe)
          .plus(calc.rentowe_employee)
          .plus(calc.rentowe_employer),
        chorobowe: new Decimal(acc.chorobowe).plus(calc.chorobowe),
        wypadkowe: new Decimal(acc.wypadkowe).plus(calc.wypadkowe),
        zdrowotne: new Decimal(acc.zdrowotne).plus(calc.zdrowotne),
        fp: new Decimal(acc.fp).plus(calc.fp),
        fgsp: new Decimal(acc.fgsp).plus(calc.fgsp),
      }),
      {
        emerytalne: new Decimal(0),
        rentowe: new Decimal(0),
        chorobowe: new Decimal(0),
        wypadkowe: new Decimal(0),
        zdrowotne: new Decimal(0),
        fp: new Decimal(0),
        fgsp: new Decimal(0),
      }
    );

    const grandTotal = totals.emerytalne
      .plus(totals.rentowe)
      .plus(totals.chorobowe)
      .plus(totals.wypadkowe)
      .plus(totals.zdrowotne)
      .plus(totals.fp)
      .plus(totals.fgsp);

    // Calculate due date (15th or 20th of following month)
    const dueDate = this.calculateDRADueDate(input.year, input.month);

    // Create DRA declaration
    const [dra] = await this.db
      .insert(zusDeclarations)
      .values({
        organizationId: input.organizationId,
        clientId: input.clientId,
        declarationType: 'DRA',
        declarationYear: input.year,
        declarationMonth: input.month,
        totalContributors: calculations.length,
        totalEmerytalne: totals.emerytalne.toString(),
        totalRentowe: totals.rentowe.toString(),
        totalChorobowe: totals.chorobowe.toString(),
        totalWypadkowe: totals.wypadkowe.toString(),
        totalZdrowotne: totals.zdrowotne.toString(),
        totalFp: totals.fp.toString(),
        totalFgsp: totals.fgsp.toString(),
        grandTotal: grandTotal.toString(),
        dueDate,
        status: 'GENERATED',
      })
      .returning();

    // Generate individual declarations (RCA, RSA, RZA)
    let rcaCount = 0;
    let rsaCount = 0;
    let rzaCount = 0;

    for (const calc of calculations) {
      const profile = calc.contributorProfile;

      // Determine declaration type based on contributor
      if (profile.contributorType === 'ZLECENIE' && !calc.emerytalne_employee) {
        // Health-only contributor - RZA
        if (input.includeRZA) {
          await this.db.insert(zusDeclarations).values({
            organizationId: input.organizationId,
            clientId: input.clientId,
            declarationType: 'RZA',
            declarationYear: input.year,
            declarationMonth: input.month,
            contributorProfileId: calc.contributorProfileId,
            totalZdrowotne: calc.zdrowotne,
            grandTotal: calc.zdrowotne,
            dueDate,
            status: 'GENERATED',
          });
          rzaCount++;
        }
      } else {
        // Full contributor - RCA
        if (input.includeRCA) {
          await this.db.insert(zusDeclarations).values({
            organizationId: input.organizationId,
            clientId: input.clientId,
            declarationType: 'RCA',
            declarationYear: input.year,
            declarationMonth: input.month,
            contributorProfileId: calc.contributorProfileId,
            totalEmerytalne: new Decimal(calc.emerytalne_employee)
              .plus(calc.emerytalne_employer)
              .toString(),
            totalRentowe: new Decimal(calc.rentowe_employee)
              .plus(calc.rentowe_employer)
              .toString(),
            totalChorobowe: calc.chorobowe,
            totalWypadkowe: calc.wypadkowe,
            totalZdrowotne: calc.zdrowotne,
            totalFp: calc.fp,
            totalFgsp: calc.fgsp,
            grandTotal: calc.totalContribution,
            dueDate,
            status: 'GENERATED',
          });
          rcaCount++;
        }
      }
    }

    return {
      draId: dra.id,
      rcaCount,
      rsaCount,
      rzaCount,
      totals: {
        emerytalne: totals.emerytalne.toString(),
        rentowe: totals.rentowe.toString(),
        chorobowe: totals.chorobowe.toString(),
        wypadkowe: totals.wypadkowe.toString(),
        zdrowotne: totals.zdrowotne.toString(),
        fp: totals.fp.toString(),
        fgsp: totals.fgsp.toString(),
        grandTotal: grandTotal.toString(),
        contributorCount: calculations.length,
      },
      dueDate,
    };
  }

  private calculateDRADueDate(year: number, month: number): Date {
    // Standard: 15th of following month
    // Businesses: 20th of following month

    let dueMonth = month + 1;
    let dueYear = year;

    if (dueMonth > 12) {
      dueMonth = 1;
      dueYear++;
    }

    // Using 15th as default (adjust for business type in production)
    const dueDate = new Date(dueYear, dueMonth - 1, 15);

    // Adjust for weekends
    while (dueDate.getDay() === 0 || dueDate.getDay() === 6) {
      dueDate.setDate(dueDate.getDate() + 1);
    }

    return dueDate;
  }

  // ===================
  // HELPER METHODS
  // ===================

  private applyAnnualBasisLimit(
    gross: Decimal,
    ytdBefore: Decimal,
    annualLimit: Decimal
  ): { basis: Decimal; limitApplied: boolean } {
    const ytdAfter = ytdBefore.plus(gross);

    if (ytdBefore.gte(annualLimit)) {
      // Already exceeded limit
      return { basis: new Decimal(0), limitApplied: true };
    }

    if (ytdAfter.gt(annualLimit)) {
      // Partially exceeds limit
      const basis = annualLimit.minus(ytdBefore);
      return { basis, limitApplied: true };
    }

    // Within limit
    return { basis: gross, limitApplied: false };
  }

  private roundContributions(contributions: any): any {
    return {
      employee: {
        emerytalne: contributions.employee.emerytalne.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        rentowe: contributions.employee.rentowe.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        chorobowe: contributions.employee.chorobowe.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        zdrowotne: contributions.employee.zdrowotne.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      },
      employer: {
        emerytalne: contributions.employer.emerytalne.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        rentowe: contributions.employer.rentowe.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        wypadkowe: contributions.employer.wypadkowe.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        fp: contributions.employer.fp.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        fgsp: contributions.employer.fgsp.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      },
    };
  }

  private async getContributorProfile(id: string) {
    const profile = await this.db.query.zusContributorProfiles.findFirst({
      where: eq(zusContributorProfiles.id, id),
    });

    if (!profile) {
      throw new Error('Contributor profile not found');
    }

    return profile;
  }

  private async getZUSParameters(year: number) {
    const params = await this.db.query.zusParameters.findFirst({
      where: eq(zusParameters.year, year),
    });

    if (!params) {
      throw new Error(`ZUS parameters for year ${year} not found`);
    }

    return params;
  }

  private async getWypadkoweRate(organizationId: string): Promise<Decimal> {
    // In production, this would look up the employer's risk category
    // For now, return default rate
    return ZUS_RATES.WYPADKOWE_DEFAULT;
  }
}
```

### API Endpoints

```typescript
// src/server/routers/zus.router.ts
import { router, protectedProcedure } from '@/server/trpc';
import { ZUSContributionService } from '@/server/services/zus-contribution.service';
import {
  ZUSCalculationInputSchema,
  SelfEmployedZUSInputSchema,
  ContributorProfileInputSchema,
  ReliefEligibilityInputSchema,
  DRAGenerationInputSchema,
} from '@/shared/schemas/zus.schema';
import { z } from 'zod';

export const zusRouter = router({
  // Calculations
  calculateEmployee: protectedProcedure
    .input(ZUSCalculationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSContributionService(ctx.db);

      await ctx.auditLog.log({
        action: 'ZUS_EMPLOYEE_CALCULATE',
        resourceType: 'zus_calculation',
        details: { contributorId: input.contributorProfileId },
      });

      return service.calculateEmployeeZUS(input);
    }),

  calculateSelfEmployed: protectedProcedure
    .input(SelfEmployedZUSInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSContributionService(ctx.db);

      await ctx.auditLog.log({
        action: 'ZUS_SELF_EMPLOYED_CALCULATE',
        resourceType: 'zus_calculation',
        details: { contributorId: input.contributorProfileId },
      });

      return service.calculateSelfEmployedZUS(input);
    }),

  // Contributor Profiles
  createProfile: protectedProcedure
    .input(ContributorProfileInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSContributionService(ctx.db);
      return service.createContributorProfile({
        ...input,
        organizationId: ctx.session.organizationId,
      });
    }),

  getProfile: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.zusContributorProfiles.findFirst({
        where: eq(zusContributorProfiles.id, input.id),
      });
    }),

  // Relief Management
  checkRelief: protectedProcedure
    .input(ReliefEligibilityInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new ZUSContributionService(ctx.db);
      return service.checkReliefEligibility(input);
    }),

  // Declarations
  generateDRA: protectedProcedure
    .input(DRAGenerationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSContributionService(ctx.db);

      await ctx.auditLog.log({
        action: 'ZUS_DRA_GENERATE',
        resourceType: 'zus_declaration',
        details: { clientId: input.clientId, period: `${input.year}-${input.month}` },
      });

      return service.generateDRADeclaration({
        ...input,
        organizationId: ctx.session.organizationId,
      });
    }),

  getDeclarations: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      year: z.number().int(),
      month: z.number().int().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.zusDeclarations.findMany({
        where: and(
          eq(zusDeclarations.clientId, input.clientId),
          eq(zusDeclarations.declarationYear, input.year),
          input.month ? eq(zusDeclarations.declarationMonth, input.month) : undefined,
        ),
        orderBy: [desc(zusDeclarations.createdAt)],
      });
    }),

  // Parameters
  getParameters: protectedProcedure
    .input(z.object({ year: z.number().int() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.zusParameters.findFirst({
        where: eq(zusParameters.year, input.year),
      });
    }),

  // Calculation History
  getCalculations: protectedProcedure
    .input(z.object({
      contributorProfileId: z.string().uuid(),
      year: z.number().int(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.zusCalculations.findMany({
        where: and(
          eq(zusCalculations.contributorProfileId, input.contributorProfileId),
          eq(zusCalculations.calculationYear, input.year),
        ),
        orderBy: [asc(zusCalculations.calculationMonth)],
      });
    }),
});
```

---

## Test Specifications

### Unit Tests

```typescript
// src/server/services/__tests__/zus-contribution.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import { ZUSContributionService } from '../zus-contribution.service';

describe('ZUSContributionService', () => {
  let service: ZUSContributionService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'calc-123' }]),
      query: {
        zusContributorProfiles: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'profile-123',
            organizationId: 'org-123',
            contributorType: 'EMPLOYEE',
            reliefType: 'STANDARD',
          }),
        },
        zusParameters: {
          findFirst: vi.fn().mockResolvedValue({
            year: 2025,
            annualBasisLimit: '234720',
            minimumWage: '4666',
            averageWage: '7767',
            selfEmployedStandardBasis: '4666',
            preferentialBasis: '1399.80',
            healthBasisMinimum: '4666',
            smallZusPlusRevenueLimit: '120000',
          }),
        },
        zusReliefTracking: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    };
    service = new ZUSContributionService(mockDb);
  });

  describe('Employee ZUS', () => {
    it('should calculate standard employee ZUS contributions', async () => {
      const result = await service.calculateEmployeeZUS({
        contributorProfileId: 'profile-123',
        year: 2025,
        month: 1,
        grossAmount: '10000',
        includeChorobowe: true,
      });

      // Employee contributions
      expect(result.emerytalne_employee).toBe('976'); // 10000 * 9.76%
      expect(result.rentowe_employee).toBe('150'); // 10000 * 1.5%
      expect(result.chorobowe).toBe('245'); // 10000 * 2.45%

      // Health basis = 10000 - 976 - 150 - 245 = 8629
      // Zdrowotne = 8629 * 9% = 776.61
      expect(parseFloat(result.zdrowotne)).toBeCloseTo(776.61, 0);

      // Employer contributions
      expect(result.emerytalne_employer).toBe('976'); // 10000 * 9.76%
      expect(result.rentowe_employer).toBe('650'); // 10000 * 6.5%
      expect(result.wypadkowe).toBe('167'); // 10000 * 1.67%
      expect(result.fp).toBe('245'); // 10000 * 2.45%
      expect(result.fgsp).toBe('10'); // 10000 * 0.1%
    });

    it('should apply annual basis limit', async () => {
      const result = await service.calculateEmployeeZUS({
        contributorProfileId: 'profile-123',
        year: 2025,
        month: 12,
        grossAmount: '20000',
        ytdBasisBefore: '220000', // Already paid on 220,000
        includeChorobowe: true,
      });

      // Limit is 234,720, so only 14,720 applies to emerytalne/rentowe
      expect(result.basisLimitApplied).toBe(true);
      expect(parseFloat(result.emerytalne_employee)).toBeCloseTo(1436.67, 0);
      expect(parseFloat(result.rentowe_employee)).toBeCloseTo(220.80, 0);

      // Chorobowe and zdrowotne still apply to full amount
      expect(result.chorobowe).toBe('490'); // 20000 * 2.45%
    });
  });

  describe('Self-Employed ZUS', () => {
    it('should calculate standard self-employed ZUS', async () => {
      const result = await service.calculateSelfEmployedZUS({
        contributorProfileId: 'profile-123',
        year: 2025,
        month: 1,
        taxationForm: 'SCALE',
        includeChorobowe: true,
      });

      // Standard basis: 4666 PLN (60% of average)
      expect(result.contributionBasis).toBe('4666');

      // Emerytalne: 4666 * 19.52% = 910.56
      expect(parseFloat(result.emerytalne_employee)).toBeCloseTo(910.56, 0);

      // Rentowe: 4666 * 8% = 373.28
      expect(parseFloat(result.rentowe_employee)).toBeCloseTo(373.28, 0);

      // Chorobowe: 4666 * 2.45% = 114.32
      expect(parseFloat(result.chorobowe)).toBeCloseTo(114.32, 0);

      // Wypadkowe: 4666 * 1.67% = 77.92
      expect(parseFloat(result.wypadkowe)).toBeCloseTo(77.92, 0);
    });

    it('should apply Ulga na start relief', async () => {
      mockDb.query.zusContributorProfiles.findFirst.mockResolvedValue({
        id: 'profile-123',
        organizationId: 'org-123',
        contributorType: 'SELF_EMPLOYED',
        reliefType: 'ULGA_NA_START',
      });

      const result = await service.calculateSelfEmployedZUS({
        contributorProfileId: 'profile-123',
        year: 2025,
        month: 1,
        taxationForm: 'SCALE',
        monthlyIncome: '10000',
        includeChorobowe: true,
      });

      // No social insurance during Ulga na start
      expect(result.contributionBasis).toBe('0');
      expect(result.emerytalne_employee).toBe('0');
      expect(result.rentowe_employee).toBe('0');
      expect(result.chorobowe).toBe('0');
      expect(result.wypadkowe).toBe('0');

      // Only health insurance
      expect(parseFloat(result.zdrowotne)).toBeGreaterThan(0);
      expect(result.reliefApplied).toBe('ULGA_NA_START');
    });

    it('should calculate Mały ZUS Plus', async () => {
      mockDb.query.zusContributorProfiles.findFirst.mockResolvedValue({
        id: 'profile-123',
        organizationId: 'org-123',
        contributorType: 'SELF_EMPLOYED',
        reliefType: 'STANDARD',
      });

      const result = await service.calculateSelfEmployedZUS({
        contributorProfileId: 'profile-123',
        year: 2025,
        month: 1,
        taxationForm: 'SCALE',
        useMalyZusPlus: true,
        previousYearIncome: '60000', // 5000/month average
        includeChorobowe: true,
      });

      // Basis = 50% of average monthly income = 2500
      expect(result.contributionBasis).toBe('2500');
      expect(result.reliefApplied).toBe('MALY_ZUS_PLUS');
      expect(parseFloat(result.reliefSavings!)).toBeGreaterThan(0);
    });
  });

  describe('Relief Eligibility', () => {
    it('should verify Mały ZUS Plus eligibility', async () => {
      const result = await service.checkReliefEligibility({
        contributorProfileId: 'profile-123',
        reliefType: 'MALY_ZUS_PLUS',
        previousYearRevenue: '100000',
        monthsInBusiness: 72,
      });

      expect(result.isEligible).toBe(true);
      expect(result.maxMonths).toBe(36);
    });

    it('should reject Mały ZUS Plus for high revenue', async () => {
      const result = await service.checkReliefEligibility({
        contributorProfileId: 'profile-123',
        reliefType: 'MALY_ZUS_PLUS',
        previousYearRevenue: '150000', // Exceeds 120,000 limit
        monthsInBusiness: 72,
      });

      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('Przychód przekracza limit');
    });
  });

  describe('DRA Declaration', () => {
    it('should generate DRA with correct totals', async () => {
      mockDb.query.zusCalculations = {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'calc-1',
            contributorProfileId: 'profile-1',
            emerytalne_employee: '976',
            emerytalne_employer: '976',
            rentowe_employee: '150',
            rentowe_employer: '650',
            chorobowe: '245',
            wypadkowe: '167',
            zdrowotne: '777',
            fp: '245',
            fgsp: '10',
            totalContribution: '4196',
            contributorProfile: {
              contributorType: 'EMPLOYEE',
            },
          },
        ]),
      };

      const result = await service.generateDRADeclaration({
        organizationId: 'org-123',
        clientId: 'client-123',
        year: 2025,
        month: 1,
        includeRCA: true,
        includeRSA: true,
        includeRZA: true,
      });

      expect(result.draId).toBeDefined();
      expect(result.rcaCount).toBe(1);
      expect(result.totals.emerytalne).toBe('1952'); // 976 + 976
      expect(result.totals.rentowe).toBe('800'); // 150 + 650
      expect(result.totals.contributorCount).toBe(1);
    });
  });
});
```

### Integration Tests

```typescript
// src/server/routers/__tests__/zus.router.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestContext, createTestCaller } from '@/test/helpers';

describe('ZUS Router Integration', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let caller: ReturnType<typeof createTestCaller>;

  beforeEach(async () => {
    ctx = await createTestContext();
    caller = createTestCaller(ctx);
  });

  describe('calculateEmployee', () => {
    it('should calculate and persist ZUS contributions', async () => {
      const profile = await caller.zus.createProfile({
        employeeId: ctx.testEmployee.id,
        contributorType: 'EMPLOYEE',
        insuranceStartDate: '2025-01-01T00:00:00Z',
      });

      const result = await caller.zus.calculateEmployee({
        contributorProfileId: profile.id,
        year: 2025,
        month: 1,
        grossAmount: '10000',
        includeChorobowe: true,
      });

      expect(result.calculationId).toBeDefined();
      expect(result.totalEmployee).toBeDefined();
      expect(result.totalEmployer).toBeDefined();
    });
  });

  describe('generateDRA', () => {
    it('should generate complete DRA declaration', async () => {
      // Setup: Create profile and calculation
      const profile = await caller.zus.createProfile({
        employeeId: ctx.testEmployee.id,
        contributorType: 'EMPLOYEE',
        insuranceStartDate: '2025-01-01T00:00:00Z',
      });

      await caller.zus.calculateEmployee({
        contributorProfileId: profile.id,
        year: 2025,
        month: 1,
        grossAmount: '8000',
        includeChorobowe: true,
      });

      // Generate DRA
      const result = await caller.zus.generateDRA({
        clientId: ctx.testClient.id,
        year: 2025,
        month: 1,
      });

      expect(result.draId).toBeDefined();
      expect(result.rcaCount).toBe(1);
      expect(result.totals.contributorCount).toBe(1);
      expect(result.dueDate).toBeDefined();
    });
  });
});
```

---

## Security Checklist

- [x] All calculations use Decimal.js (no floating point)
- [x] ZUS rates validated against official tables
- [x] RLS policies enforce organization isolation
- [x] Audit logging for all calculations
- [x] Input validation with Zod schemas
- [x] PESEL/NIP handled securely (encrypted at rest)
- [x] Relief eligibility validated before application
- [x] Annual basis limit tracked to prevent over-contribution
- [x] Declaration data immutable after submission

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `ZUS_EMPLOYEE_CALCULATE` | Employee calc | Contributor, period, amounts |
| `ZUS_SELF_EMPLOYED_CALCULATE` | Self-employed calc | Contributor, basis, relief |
| `ZUS_PROFILE_CREATE` | Profile creation | Contributor type, identifiers |
| `ZUS_RELIEF_CHECK` | Relief eligibility | Relief type, result |
| `ZUS_DRA_GENERATE` | DRA generation | Client, period, totals |
| `ZUS_DRA_SUBMIT` | DRA submission | Declaration ID, confirmation |

---

## Implementation Notes

### Polish ZUS Law References

- **Ustawa o systemie ubezpieczeń społecznych** (Dz.U. 1998 Nr 137 poz. 887)
- **Art. 18**: Contribution basis
- **Art. 18a**: Preferential basis for new businesses
- **Art. 22**: Contribution rates
- **Art. 46**: Declaration requirements

### Key 2025 Parameters

- Annual basis limit: 234,720.00 PLN
- Minimum wage: 4,666.00 PLN
- Standard self-employed basis: 4,666.00 PLN (60% of average)
- Preferential basis: 1,399.80 PLN (30% of minimum)
- Mały ZUS Plus revenue limit: 120,000 PLN

### Edge Cases

1. **Mid-month employment start**: Prorate contributions
2. **Multiple insurance titles**: Apply "zbieg tytułów" rules
3. **Basis limit reached mid-month**: Split calculation
4. **Foreign employee**: Different social security agreement rules
5. **Seasonal workers**: Track continuous employment periods

---

## Dependencies

- **TAX-001**: Client tax configuration
- **TAX-002**: Tax rates and rules management
- **HRP**: Employee/payroll data

## Related Stories

- **TAX-005**: CIT/PIT Calculation (uses ZUS for deductions)
- **TAX-007**: JPK File Generation
- **HRP-006**: Payroll Processing

---

*Story created: December 2024*
*Last updated: December 2024*
