# TAX-005: CIT/PIT Calculation Engine

> **Story ID**: TAX-005
> **Epic**: Tax Compliance Module (TAX)
> **Priority**: P0 (Critical)
> **Points**: 13
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant managing client taxes,
**I want** to calculate income tax obligations (CIT and PIT) accurately,
**So that** I can prepare correct corporate and personal income tax declarations.

---

## Acceptance Criteria

### AC1: CIT Standard Rate Calculation (19%)

```gherkin
Feature: Corporate Income Tax Standard Rate Calculation
  As an accountant
  I need to calculate CIT at the standard 19% rate
  So that corporate clients can fulfill their tax obligations

  Background:
    Given a client configured as CIT payer
    And the tax period is Q1 2025

  Scenario: Calculate CIT at standard 19% rate
    Given the client has total revenue of 500,000.00 PLN
    And the client has deductible expenses of 350,000.00 PLN
    When I calculate the CIT obligation
    Then the taxable income should be 150,000.00 PLN
    And the CIT amount should be 28,500.00 PLN
    And the calculation should use rate 19%

  Scenario: Calculate CIT with non-deductible expenses
    Given the client has total revenue of 500,000.00 PLN
    And the client has total expenses of 380,000.00 PLN
    And 30,000.00 PLN of expenses are non-deductible (Art. 16 CIT)
    When I calculate the CIT obligation
    Then the taxable income should be 150,000.00 PLN
    And non-deductible expenses should be listed separately
    And the CIT amount should be 28,500.00 PLN

  Scenario: CIT with previous year loss carry-forward
    Given the client has taxable income of 150,000.00 PLN
    And the client has loss carry-forward of 80,000.00 PLN from 2024
    When I calculate the CIT obligation
    Then the loss deduction should be 75,000.00 PLN (max 50% of income)
    And the adjusted taxable income should be 75,000.00 PLN
    And the CIT amount should be 14,250.00 PLN
    And remaining loss carry-forward should be 5,000.00 PLN
```

### AC2: CIT Preferential Rate (9% for Small Taxpayers)

```gherkin
Feature: Corporate Income Tax Preferential Rate for Small Taxpayers
  As an accountant
  I need to apply the 9% CIT rate for eligible small taxpayers
  So that qualifying clients benefit from preferential tax treatment

  Background:
    Given a client configured as CIT payer
    And the tax period is 2025

  Scenario: Verify small taxpayer eligibility
    Given the client's previous year revenue was 1,800,000.00 EUR equivalent
    When I check small taxpayer eligibility
    Then the client should qualify as "mały podatnik"
    And the 9% rate should be available

  Scenario: Small taxpayer exceeds threshold
    Given the client's previous year revenue was 2,100,000.00 EUR equivalent
    When I check small taxpayer eligibility
    Then the client should NOT qualify as "mały podatnik"
    And only the 19% standard rate should be available

  Scenario: Calculate CIT at 9% rate
    Given the client qualifies as small taxpayer
    And the client has taxable income of 150,000.00 PLN
    When I calculate the CIT obligation
    Then the CIT amount should be 13,500.00 PLN
    And the calculation should use rate 9%

  Scenario: New company first year eligibility
    Given the client is a newly registered company
    And this is their first tax year
    When I check small taxpayer eligibility
    Then the client should qualify for 9% rate
    And a note should indicate first-year eligibility
```

### AC3: Estonian CIT (Ryczałt od dochodów spółek)

```gherkin
Feature: Estonian CIT Calculation
  As an accountant
  I need to calculate Estonian CIT for eligible companies
  So that clients can benefit from deferred taxation

  Background:
    Given a client configured for Estonian CIT
    And the client is a sp. z o.o. or S.A.

  Scenario: Estonian CIT eligibility verification
    Given the client has less than 100 employees
    And the client's revenue is below 100,000,000.00 PLN
    And the client has no shares in other entities
    And shareholders are natural persons only
    When I verify Estonian CIT eligibility
    Then the client should be eligible for Estonian CIT

  Scenario: Calculate Estonian CIT on distribution
    Given the client has retained earnings of 500,000.00 PLN
    And the client distributes 200,000.00 PLN as dividends
    When I calculate Estonian CIT
    Then the CIT base should be 200,000.00 PLN
    And the CIT rate should be 10% (small taxpayer) or 20% (standard)
    And the CIT amount should be calculated accordingly

  Scenario: Hidden profit detection
    Given the client has Estonian CIT status
    And the client pays 50,000.00 PLN to a shareholder for services
    And the market rate for such services is 20,000.00 PLN
    When I analyze the transaction
    Then it should be flagged as potential hidden profit
    And 30,000.00 PLN should be subject to Estonian CIT

  Scenario: Exit from Estonian CIT
    Given the client has been on Estonian CIT for 3 years
    And the client decides to exit the regime
    When I calculate exit tax
    Then all retained earnings should be taxed
    And the calculation should include proper disclosure
```

### AC4: PIT Progressive Scale (12%/32%)

```gherkin
Feature: Personal Income Tax Progressive Scale
  As an accountant
  I need to calculate PIT using the progressive scale
  So that individual taxpayers pay correct income tax

  Background:
    Given a client configured as PIT payer
    And the tax form is PIT-36

  Scenario: PIT below first threshold (tax-free amount)
    Given the taxpayer has annual income of 25,000.00 PLN
    And the taxpayer has no other income sources
    When I calculate PIT
    Then the taxable income should be 25,000.00 PLN
    And the tax-free amount should be 30,000.00 PLN
    And the PIT amount should be 0.00 PLN

  Scenario: PIT in first bracket (12%)
    Given the taxpayer has annual income of 80,000.00 PLN
    And deductible expenses are 20,000.00 PLN
    When I calculate PIT
    Then the taxable income should be 60,000.00 PLN
    And tax from first bracket should be (60,000 - 30,000) * 12% = 3,600.00 PLN
    And total PIT should be 3,600.00 PLN

  Scenario: PIT in second bracket (32%)
    Given the taxpayer has annual income of 200,000.00 PLN
    And deductible expenses are 30,000.00 PLN
    When I calculate PIT
    Then the taxable income should be 170,000.00 PLN
    And tax from first bracket should be (120,000 - 30,000) * 12% = 10,800.00 PLN
    And tax from second bracket should be (170,000 - 120,000) * 32% = 16,000.00 PLN
    And total PIT should be 26,800.00 PLN

  Scenario: PIT with degressive tax-free amount
    Given the taxpayer has annual income of 135,000.00 PLN
    When I calculate the effective tax-free amount
    Then the reduced tax-free amount should be calculated per formula
    And the reduction should be proportional to income above 120,000 PLN
```

### AC5: PIT Flat Rate (19%)

```gherkin
Feature: Personal Income Tax Flat Rate
  As an accountant
  I need to calculate PIT at flat 19% rate for business income
  So that eligible taxpayers can use simplified taxation

  Background:
    Given a client configured as PIT payer
    And the client has chosen flat tax option

  Scenario: PIT flat rate calculation
    Given the taxpayer has business income of 300,000.00 PLN
    And business expenses are 150,000.00 PLN
    When I calculate PIT at flat rate
    Then the taxable income should be 150,000.00 PLN
    And the PIT amount should be 28,500.00 PLN
    And no tax-free amount should be applied

  Scenario: Flat rate with health insurance deduction
    Given the taxpayer has business income of 150,000.00 PLN (net)
    And the taxpayer paid health insurance of 12,000.00 PLN
    When I calculate PIT at flat rate
    Then 10,200.00 PLN (85%) of health insurance should be deductible
    And the effective taxable income should reflect this deduction

  Scenario: Flat rate ineligibility for spouse joint filing
    Given the taxpayer chose flat tax
    And the taxpayer is married
    When they attempt joint filing with spouse
    Then joint filing should be blocked
    And a warning should explain flat tax prevents joint filing
```

### AC6: Advance Payment Calculations

```gherkin
Feature: Income Tax Advance Payments
  As an accountant
  I need to calculate monthly/quarterly advance payments
  So that clients can pay taxes throughout the year

  Background:
    Given a client configured for income tax

  Scenario: CIT monthly advance calculation
    Given the client pays CIT monthly
    And January revenue is 100,000.00 PLN
    And January expenses are 70,000.00 PLN
    When I calculate January CIT advance
    Then the monthly income should be 30,000.00 PLN
    And the advance payment should be 5,700.00 PLN (at 19%)
    And payment deadline should be February 20th

  Scenario: CIT quarterly advance calculation
    Given the client qualifies for quarterly advances
    And Q1 cumulative income is 90,000.00 PLN
    When I calculate Q1 CIT advance
    Then the advance should be 17,100.00 PLN (at 19%)
    And payment deadline should be April 20th

  Scenario: Simplified advance payment method
    Given the client chose simplified advance method
    And previous year tax was 60,000.00 PLN
    When I calculate monthly simplified advance
    Then each monthly advance should be 5,000.00 PLN (1/12 of prev year)

  Scenario: Advance payment with cumulative calculation
    Given Q1 advance paid was 20,000.00 PLN
    And Q2 cumulative income is 250,000.00 PLN
    And Q2 cumulative tax due is 47,500.00 PLN
    When I calculate Q2 advance payment
    Then Q2 advance should be 27,500.00 PLN (47,500 - 20,000)
```

### AC7: Loss Carry-Forward Management

```gherkin
Feature: Tax Loss Carry-Forward
  As an accountant
  I need to track and apply loss carry-forwards
  So that clients can offset past losses against current income

  Background:
    Given a client with historical tax losses

  Scenario: Record new tax loss
    Given the client has 2024 taxable loss of 200,000.00 PLN
    When I record the loss for carry-forward
    Then a loss carry-forward entry should be created
    And the expiration year should be 2029 (5 years)
    And remaining amount should be 200,000.00 PLN

  Scenario: Apply loss carry-forward (max 50% rule)
    Given the client has loss carry-forward of 200,000.00 PLN
    And current year taxable income is 150,000.00 PLN
    When I calculate loss deduction
    Then maximum deduction should be 75,000.00 PLN (50% of income)
    And taxable income after deduction should be 75,000.00 PLN
    And remaining carry-forward should be 125,000.00 PLN

  Scenario: Multiple year losses application
    Given the client has losses from multiple years:
      | Year | Amount     | Remaining  |
      | 2022 | 50,000.00  | 30,000.00  |
      | 2023 | 100,000.00 | 100,000.00 |
      | 2024 | 80,000.00  | 80,000.00  |
    And current year taxable income is 200,000.00 PLN
    When I apply loss carry-forwards
    Then oldest losses should be applied first (FIFO)
    And total deduction should respect 50% limit (100,000.00 PLN)
    And remaining losses should be updated accordingly

  Scenario: Loss expiration warning
    Given the client has loss from 2020 expiring in 2025
    And remaining loss amount is 50,000.00 PLN
    When generating annual tax summary
    Then a warning should indicate expiring loss
    And recommendation should suggest maximizing deduction
```

### AC8: Tax-Deductible Expense Validation

```gherkin
Feature: Tax-Deductible Expense Validation
  As an accountant
  I need to validate expense deductibility
  So that only legitimate expenses reduce taxable income

  Background:
    Given a client with business expenses

  Scenario: Validate standard business expense
    Given an expense of 5,000.00 PLN for office supplies
    And the expense has proper documentation
    And the expense is related to business activity
    When I validate the expense deductibility
    Then the expense should be marked as fully deductible
    And no warnings should be generated

  Scenario: Detect non-deductible expense (Art. 16 CIT)
    Given an expense of 10,000.00 PLN for client entertainment
    When I validate the expense deductibility
    Then the expense should be marked as non-deductible
    And the reason should reference Art. 16 ust. 1 pkt 28
    And it should not reduce taxable income

  Scenario: Partially deductible expense (car expenses)
    Given a company car expense of 10,000.00 PLN
    And the car is used for mixed purposes (business and private)
    When I validate the expense deductibility
    Then 75% (7,500.00 PLN) should be deductible
    And 25% (2,500.00 PLN) should be non-deductible
    And the reason should explain mixed-use limitation

  Scenario: Representation expense limitation
    Given an expense of 3,000.00 PLN for business gifts
    And per-item value exceeds 200 PLN
    When I validate the expense deductibility
    Then the expense should be flagged as representation
    And deductibility should be denied
    And Art. 16 reference should be provided

  Scenario: Depreciation expense validation
    Given an asset purchase of 15,000.00 PLN
    And the asset has useful life of 5 years
    When I validate depreciation expense
    Then annual depreciation of 3,000.00 PLN should be deductible
    And depreciation method should be documented
    And remaining book value should be tracked
```

---

## Technical Specification

### Database Schema

```sql
-- Income Tax Calculations
CREATE TABLE income_tax_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID NOT NULL REFERENCES clients(id),

  -- Tax Type
  tax_type tax_type_enum NOT NULL, -- 'CIT' or 'PIT'
  tax_year INTEGER NOT NULL,
  period_type period_type_enum NOT NULL, -- 'MONTHLY', 'QUARTERLY', 'ANNUAL'
  period_number INTEGER, -- 1-12 for monthly, 1-4 for quarterly, NULL for annual

  -- Income Components
  total_revenue DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_expenses DECIMAL(15,2) NOT NULL DEFAULT 0,
  non_deductible_expenses DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_exempt_income DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Calculated Values
  gross_income DECIMAL(15,2) NOT NULL DEFAULT 0,
  loss_deduction DECIMAL(15,2) NOT NULL DEFAULT 0,
  taxable_income DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Tax Calculation
  tax_rate DECIMAL(5,2) NOT NULL,
  tax_rate_code VARCHAR(20) NOT NULL, -- 'CIT_19', 'CIT_9', 'PIT_SCALE', 'PIT_FLAT', 'ESTONIAN'
  calculated_tax DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- PIT-specific (progressive scale)
  first_bracket_tax DECIMAL(15,2),
  second_bracket_tax DECIMAL(15,2),
  tax_free_amount_applied DECIMAL(15,2),

  -- Advance Payments
  advance_type advance_type_enum, -- 'STANDARD', 'SIMPLIFIED', 'QUARTERLY'
  previous_advances_paid DECIMAL(15,2) DEFAULT 0,
  current_advance_due DECIMAL(15,2) DEFAULT 0,

  -- Status
  status calculation_status_enum NOT NULL DEFAULT 'DRAFT',
  calculation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  calculated_by UUID REFERENCES users(id),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_period CHECK (
    (period_type = 'MONTHLY' AND period_number BETWEEN 1 AND 12) OR
    (period_type = 'QUARTERLY' AND period_number BETWEEN 1 AND 4) OR
    (period_type = 'ANNUAL' AND period_number IS NULL)
  )
);

-- Tax Loss Carry-Forward
CREATE TABLE tax_loss_carry_forwards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID NOT NULL REFERENCES clients(id),

  -- Loss Details
  tax_type tax_type_enum NOT NULL,
  loss_year INTEGER NOT NULL,
  original_amount DECIMAL(15,2) NOT NULL,
  remaining_amount DECIMAL(15,2) NOT NULL,
  expiration_year INTEGER NOT NULL,

  -- Source
  source_calculation_id UUID REFERENCES income_tax_calculations(id),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  fully_utilized_date DATE,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT positive_amounts CHECK (
    original_amount > 0 AND remaining_amount >= 0
  ),
  CONSTRAINT valid_expiration CHECK (expiration_year = loss_year + 5)
);

-- Loss Carry-Forward Applications
CREATE TABLE loss_carry_forward_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loss_carry_forward_id UUID NOT NULL REFERENCES tax_loss_carry_forwards(id),
  calculation_id UUID NOT NULL REFERENCES income_tax_calculations(id),

  -- Application Details
  application_year INTEGER NOT NULL,
  amount_applied DECIMAL(15,2) NOT NULL,
  remaining_after DECIMAL(15,2) NOT NULL,

  -- Constraints Applied
  income_limit_applied DECIMAL(15,2), -- 50% of income limit

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Non-Deductible Expenses
CREATE TABLE non_deductible_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  calculation_id UUID NOT NULL REFERENCES income_tax_calculations(id),

  -- Expense Details
  expense_type VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  legal_basis VARCHAR(50) NOT NULL, -- e.g., 'ART_16_UST_1_PKT_28'
  description TEXT,

  -- Source Document
  source_document_id UUID,
  source_entry_id UUID,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Estonian CIT Tracking
CREATE TABLE estonian_cit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID NOT NULL REFERENCES clients(id),

  -- Regime Details
  entry_date DATE NOT NULL,
  exit_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Eligibility Tracking
  employee_count INTEGER,
  annual_revenue DECIMAL(15,2),
  eligibility_status eligibility_status_enum NOT NULL,
  last_eligibility_check DATE,

  -- Accumulated Earnings
  retained_earnings DECIMAL(15,2) NOT NULL DEFAULT 0,
  distributed_earnings DECIMAL(15,2) NOT NULL DEFAULT 0,
  hidden_profit_detected DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Tax Calculations
  total_estonian_cit_paid DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PIT Scale Brackets (Reference Table)
CREATE TABLE pit_scale_brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_from DATE NOT NULL,
  effective_to DATE,

  -- Bracket 1
  bracket_1_threshold DECIMAL(15,2) NOT NULL, -- 30,000 PLN tax-free
  bracket_1_rate DECIMAL(5,2) NOT NULL, -- 12%
  bracket_1_upper_limit DECIMAL(15,2) NOT NULL, -- 120,000 PLN

  -- Bracket 2
  bracket_2_rate DECIMAL(5,2) NOT NULL, -- 32%

  -- Tax-free amount degression
  degression_start DECIMAL(15,2), -- Income level where degression starts
  degression_end DECIMAL(15,2), -- Income level where tax-free becomes 0

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_brackets CHECK (bracket_1_upper_limit > bracket_1_threshold)
);

-- Advance Payment Schedule
CREATE TABLE advance_payment_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  calculation_id UUID REFERENCES income_tax_calculations(id),

  -- Payment Details
  tax_type tax_type_enum NOT NULL,
  tax_year INTEGER NOT NULL,
  period_type period_type_enum NOT NULL,
  period_number INTEGER NOT NULL,

  -- Amounts
  calculated_amount DECIMAL(15,2) NOT NULL,
  paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  remaining_amount DECIMAL(15,2) GENERATED ALWAYS AS (calculated_amount - paid_amount) STORED,

  -- Dates
  due_date DATE NOT NULL,
  payment_date DATE,

  -- Status
  status payment_status_enum NOT NULL DEFAULT 'PENDING',

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_income_tax_calc_client ON income_tax_calculations(client_id, tax_year, period_type);
CREATE INDEX idx_income_tax_calc_org ON income_tax_calculations(organization_id, tax_year);
CREATE INDEX idx_loss_carry_forward_client ON tax_loss_carry_forwards(client_id, is_active);
CREATE INDEX idx_loss_carry_forward_expiry ON tax_loss_carry_forwards(expiration_year, is_active);
CREATE INDEX idx_estonian_cit_client ON estonian_cit_records(client_id, is_active);
CREATE INDEX idx_advance_schedule_due ON advance_payment_schedule(due_date, status);

-- RLS Policies
ALTER TABLE income_tax_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_loss_carry_forwards ENABLE ROW LEVEL SECURITY;
ALTER TABLE non_deductible_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE estonian_cit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_payment_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY income_tax_org_isolation ON income_tax_calculations
  FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);

CREATE POLICY loss_carry_forward_org_isolation ON tax_loss_carry_forwards
  FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);

CREATE POLICY non_deductible_org_isolation ON non_deductible_expenses
  FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);

CREATE POLICY estonian_cit_org_isolation ON estonian_cit_records
  FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);

CREATE POLICY advance_schedule_org_isolation ON advance_payment_schedule
  FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';
import Decimal from 'decimal.js';

// Enums
export const TaxTypeEnum = z.enum(['CIT', 'PIT']);
export const PeriodTypeEnum = z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']);
export const AdvanceTypeEnum = z.enum(['STANDARD', 'SIMPLIFIED', 'QUARTERLY']);
export const CITRateCodeEnum = z.enum(['CIT_19', 'CIT_9', 'ESTONIAN_10', 'ESTONIAN_20']);
export const PITRateCodeEnum = z.enum(['PIT_SCALE', 'PIT_FLAT_19']);

// Income Tax Calculation Input
export const IncomeTaxCalculationInputSchema = z.object({
  clientId: z.string().uuid(),
  taxType: TaxTypeEnum,
  taxYear: z.number().int().min(2020).max(2100),
  periodType: PeriodTypeEnum,
  periodNumber: z.number().int().min(1).max(12).optional(),

  // Income components
  totalRevenue: z.string().refine(
    (val) => !new Decimal(val).isNegative(),
    { message: 'Revenue cannot be negative' }
  ),
  totalExpenses: z.string().refine(
    (val) => !new Decimal(val).isNegative(),
    { message: 'Expenses cannot be negative' }
  ),

  // Optional adjustments
  nonDeductibleExpenses: z.array(z.object({
    type: z.string(),
    amount: z.string(),
    legalBasis: z.string(),
    description: z.string().optional(),
  })).optional(),
  taxExemptIncome: z.string().optional(),

  // Rate selection
  rateCode: z.union([CITRateCodeEnum, PITRateCodeEnum]).optional(),
  applyLossCarryForward: z.boolean().default(true),

  // Advance payment context
  previousAdvancesPaid: z.string().optional(),
});

// CIT Calculation Input
export const CITCalculationInputSchema = IncomeTaxCalculationInputSchema.extend({
  taxType: z.literal('CIT'),
  isSmallTaxpayer: z.boolean().optional(),
  isEstonianCIT: z.boolean().default(false),
  previousYearRevenue: z.string().optional(), // For small taxpayer check
});

// PIT Calculation Input
export const PITCalculationInputSchema = IncomeTaxCalculationInputSchema.extend({
  taxType: z.literal('PIT'),
  useFlatRate: z.boolean().default(false),
  healthInsurancePaid: z.string().optional(),
  jointFiling: z.boolean().default(false),
  spouseIncome: z.string().optional(),
});

// Estonian CIT Input
export const EstonianCITCalculationInputSchema = z.object({
  clientId: z.string().uuid(),
  taxYear: z.number().int(),

  // Distribution calculation
  distributedAmount: z.string(),
  distributionType: z.enum(['DIVIDEND', 'HIDDEN_PROFIT', 'EXIT']),

  // Company status
  isSmallTaxpayer: z.boolean(),
  retainedEarnings: z.string(),
});

// Loss Carry-Forward Input
export const LossCarryForwardInputSchema = z.object({
  clientId: z.string().uuid(),
  taxType: TaxTypeEnum,
  lossYear: z.number().int(),
  amount: z.string().refine(
    (val) => new Decimal(val).isPositive(),
    { message: 'Loss amount must be positive' }
  ),
  sourceCalculationId: z.string().uuid().optional(),
});

// Advance Payment Calculation Input
export const AdvancePaymentInputSchema = z.object({
  clientId: z.string().uuid(),
  taxType: TaxTypeEnum,
  taxYear: z.number().int(),
  periodType: PeriodTypeEnum,
  periodNumber: z.number().int(),

  // Cumulative figures
  cumulativeIncome: z.string(),
  cumulativeTaxDue: z.string(),
  previousAdvancesPaid: z.string(),

  // Method
  advanceType: AdvanceTypeEnum,
  previousYearTax: z.string().optional(), // For simplified method
});

// Expense Deductibility Check Input
export const ExpenseDeductibilityInputSchema = z.object({
  expenseType: z.string(),
  amount: z.string(),
  description: z.string(),
  documentDate: z.string().datetime(),

  // Categorization
  category: z.enum([
    'OFFICE_SUPPLIES',
    'TRAVEL',
    'REPRESENTATION',
    'ENTERTAINMENT',
    'VEHICLE',
    'DEPRECIATION',
    'SALARIES',
    'RENT',
    'UTILITIES',
    'PROFESSIONAL_SERVICES',
    'MARKETING',
    'OTHER',
  ]),

  // Vehicle-specific
  vehicleUsageType: z.enum(['BUSINESS_ONLY', 'MIXED_USE']).optional(),

  // Asset-specific
  assetValue: z.string().optional(),
  usefulLife: z.number().int().optional(),
});

// Calculation Result Schemas
export const IncomeTaxCalculationResultSchema = z.object({
  calculationId: z.string().uuid(),

  // Input summary
  totalRevenue: z.string(),
  totalExpenses: z.string(),
  nonDeductibleExpenses: z.string(),
  taxExemptIncome: z.string(),

  // Calculated values
  grossIncome: z.string(),
  lossDeduction: z.string(),
  taxableIncome: z.string(),

  // Tax calculation
  taxRate: z.string(),
  taxRateCode: z.string(),
  calculatedTax: z.string(),

  // PIT-specific
  firstBracketTax: z.string().optional(),
  secondBracketTax: z.string().optional(),
  taxFreeAmountApplied: z.string().optional(),

  // Advance payment
  previousAdvancesPaid: z.string(),
  currentAdvanceDue: z.string(),

  // Loss carry-forward info
  lossCarryForwardApplied: z.array(z.object({
    lossYear: z.number(),
    amountApplied: z.string(),
    remainingAmount: z.string(),
  })).optional(),

  // Non-deductible breakdown
  nonDeductibleBreakdown: z.array(z.object({
    type: z.string(),
    amount: z.string(),
    legalBasis: z.string(),
  })).optional(),
});
```

### Service Implementation

```typescript
// src/server/services/income-tax.service.ts
import Decimal from 'decimal.js';
import { db } from '@/server/db';
import { TaxRatesService } from './tax-rates.service';
import {
  incomeTaxCalculations,
  taxLossCarryForwards,
  lossCarryForwardApplications,
  nonDeductibleExpenses,
  estonianCitRecords,
  advancePaymentSchedule,
  pitScaleBrackets,
} from '@/server/db/schema';
import { eq, and, lte, gte, desc, asc, isNull, or } from 'drizzle-orm';

// Polish 2025 Tax Constants
const TAX_CONSTANTS = {
  CIT_STANDARD_RATE: new Decimal('19'),
  CIT_SMALL_TAXPAYER_RATE: new Decimal('9'),
  ESTONIAN_CIT_SMALL_RATE: new Decimal('10'),
  ESTONIAN_CIT_STANDARD_RATE: new Decimal('20'),

  PIT_BRACKET_1_RATE: new Decimal('12'),
  PIT_BRACKET_2_RATE: new Decimal('32'),
  PIT_FLAT_RATE: new Decimal('19'),

  TAX_FREE_AMOUNT: new Decimal('30000'),
  BRACKET_1_THRESHOLD: new Decimal('120000'),

  SMALL_TAXPAYER_LIMIT_EUR: new Decimal('2000000'),
  LOSS_CARRY_FORWARD_YEARS: 5,
  LOSS_DEDUCTION_MAX_PERCENT: new Decimal('50'),

  HEALTH_INSURANCE_DEDUCTION_PERCENT: new Decimal('85'),
};

export class IncomeTaxService {
  constructor(
    private readonly db: typeof db,
    private readonly taxRatesService: TaxRatesService,
  ) {}

  // ===================
  // CIT CALCULATIONS
  // ===================

  async calculateCIT(input: CITCalculationInput): Promise<IncomeTaxCalculationResult> {
    const revenue = new Decimal(input.totalRevenue);
    const expenses = new Decimal(input.totalExpenses);

    // Validate and separate non-deductible expenses
    const nonDeductible = await this.processNonDeductibleExpenses(
      input.nonDeductibleExpenses || []
    );
    const nonDeductibleTotal = nonDeductible.reduce(
      (sum, exp) => sum.plus(exp.amount),
      new Decimal(0)
    );

    // Calculate gross income
    const deductibleExpenses = expenses.minus(nonDeductibleTotal);
    const grossIncome = revenue.minus(deductibleExpenses);

    // Apply loss carry-forward if requested and available
    let lossDeduction = new Decimal(0);
    let lossApplications: Array<{
      lossYear: number;
      amountApplied: string;
      remainingAmount: string;
    }> = [];

    if (input.applyLossCarryForward && grossIncome.isPositive()) {
      const lossResult = await this.applyLossCarryForward(
        input.clientId,
        'CIT',
        grossIncome
      );
      lossDeduction = new Decimal(lossResult.totalDeduction);
      lossApplications = lossResult.applications;
    }

    // Calculate taxable income
    const taxableIncome = Decimal.max(
      grossIncome.minus(lossDeduction),
      new Decimal(0)
    );

    // Determine tax rate
    const { rate, rateCode } = await this.determineCITRate(input);

    // Calculate tax
    const calculatedTax = taxableIncome
      .mul(rate.div(100))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // Calculate advance payment due
    const previousAdvances = new Decimal(input.previousAdvancesPaid || '0');
    const currentAdvanceDue = Decimal.max(
      calculatedTax.minus(previousAdvances),
      new Decimal(0)
    );

    // Save calculation
    const [calculation] = await this.db
      .insert(incomeTaxCalculations)
      .values({
        organizationId: input.organizationId,
        clientId: input.clientId,
        taxType: 'CIT',
        taxYear: input.taxYear,
        periodType: input.periodType,
        periodNumber: input.periodNumber,
        totalRevenue: revenue.toString(),
        totalExpenses: expenses.toString(),
        nonDeductibleExpenses: nonDeductibleTotal.toString(),
        taxExemptIncome: input.taxExemptIncome || '0',
        grossIncome: grossIncome.toString(),
        lossDeduction: lossDeduction.toString(),
        taxableIncome: taxableIncome.toString(),
        taxRate: rate.toString(),
        taxRateCode: rateCode,
        calculatedTax: calculatedTax.toString(),
        previousAdvancesPaid: previousAdvances.toString(),
        currentAdvanceDue: currentAdvanceDue.toString(),
        status: 'CALCULATED',
        calculatedBy: input.userId,
      })
      .returning();

    // Save non-deductible expenses
    if (nonDeductible.length > 0) {
      await this.db.insert(nonDeductibleExpenses).values(
        nonDeductible.map((exp) => ({
          organizationId: input.organizationId,
          calculationId: calculation.id,
          expenseType: exp.type,
          amount: exp.amount.toString(),
          legalBasis: exp.legalBasis,
          description: exp.description,
        }))
      );
    }

    return {
      calculationId: calculation.id,
      totalRevenue: revenue.toString(),
      totalExpenses: expenses.toString(),
      nonDeductibleExpenses: nonDeductibleTotal.toString(),
      taxExemptIncome: input.taxExemptIncome || '0',
      grossIncome: grossIncome.toString(),
      lossDeduction: lossDeduction.toString(),
      taxableIncome: taxableIncome.toString(),
      taxRate: rate.toString(),
      taxRateCode: rateCode,
      calculatedTax: calculatedTax.toString(),
      previousAdvancesPaid: previousAdvances.toString(),
      currentAdvanceDue: currentAdvanceDue.toString(),
      lossCarryForwardApplied: lossApplications.length > 0 ? lossApplications : undefined,
      nonDeductibleBreakdown: nonDeductible.length > 0
        ? nonDeductible.map((exp) => ({
            type: exp.type,
            amount: exp.amount.toString(),
            legalBasis: exp.legalBasis,
          }))
        : undefined,
    };
  }

  private async determineCITRate(input: CITCalculationInput): Promise<{
    rate: Decimal;
    rateCode: string;
  }> {
    // Check for Estonian CIT
    if (input.isEstonianCIT) {
      return {
        rate: input.isSmallTaxpayer
          ? TAX_CONSTANTS.ESTONIAN_CIT_SMALL_RATE
          : TAX_CONSTANTS.ESTONIAN_CIT_STANDARD_RATE,
        rateCode: input.isSmallTaxpayer ? 'ESTONIAN_10' : 'ESTONIAN_20',
      };
    }

    // Check small taxpayer eligibility
    if (input.isSmallTaxpayer || await this.checkSmallTaxpayerEligibility(input)) {
      return {
        rate: TAX_CONSTANTS.CIT_SMALL_TAXPAYER_RATE,
        rateCode: 'CIT_9',
      };
    }

    return {
      rate: TAX_CONSTANTS.CIT_STANDARD_RATE,
      rateCode: 'CIT_19',
    };
  }

  async checkSmallTaxpayerEligibility(input: {
    previousYearRevenue?: string;
  }): Promise<boolean> {
    if (!input.previousYearRevenue) return false;

    // Get EUR exchange rate (simplified - should use NBP rate)
    const eurRate = new Decimal('4.35'); // Approximate, should fetch actual rate
    const limitPLN = TAX_CONSTANTS.SMALL_TAXPAYER_LIMIT_EUR.mul(eurRate);

    return new Decimal(input.previousYearRevenue).lte(limitPLN);
  }

  // ===================
  // PIT CALCULATIONS
  // ===================

  async calculatePIT(input: PITCalculationInput): Promise<IncomeTaxCalculationResult> {
    const revenue = new Decimal(input.totalRevenue);
    const expenses = new Decimal(input.totalExpenses);

    // Process non-deductible expenses
    const nonDeductible = await this.processNonDeductibleExpenses(
      input.nonDeductibleExpenses || []
    );
    const nonDeductibleTotal = nonDeductible.reduce(
      (sum, exp) => sum.plus(exp.amount),
      new Decimal(0)
    );

    // Calculate gross income
    const deductibleExpenses = expenses.minus(nonDeductibleTotal);
    let grossIncome = revenue.minus(deductibleExpenses);

    // Health insurance deduction for flat rate
    if (input.useFlatRate && input.healthInsurancePaid) {
      const healthDeduction = new Decimal(input.healthInsurancePaid)
        .mul(TAX_CONSTANTS.HEALTH_INSURANCE_DEDUCTION_PERCENT.div(100))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      grossIncome = grossIncome.minus(healthDeduction);
    }

    // Apply loss carry-forward
    let lossDeduction = new Decimal(0);
    let lossApplications: Array<{
      lossYear: number;
      amountApplied: string;
      remainingAmount: string;
    }> = [];

    if (input.applyLossCarryForward && grossIncome.isPositive()) {
      const lossResult = await this.applyLossCarryForward(
        input.clientId,
        'PIT',
        grossIncome
      );
      lossDeduction = new Decimal(lossResult.totalDeduction);
      lossApplications = lossResult.applications;
    }

    // Calculate taxable income
    const taxableIncome = Decimal.max(
      grossIncome.minus(lossDeduction),
      new Decimal(0)
    );

    // Calculate tax based on method
    let calculatedTax: Decimal;
    let taxRateCode: string;
    let firstBracketTax: Decimal | undefined;
    let secondBracketTax: Decimal | undefined;
    let taxFreeAmountApplied: Decimal | undefined;

    if (input.useFlatRate) {
      // Flat 19% rate
      calculatedTax = taxableIncome
        .mul(TAX_CONSTANTS.PIT_FLAT_RATE.div(100))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      taxRateCode = 'PIT_FLAT_19';
    } else {
      // Progressive scale
      const progressiveResult = this.calculateProgressivePIT(
        taxableIncome,
        input.jointFiling,
        input.spouseIncome ? new Decimal(input.spouseIncome) : undefined
      );
      calculatedTax = progressiveResult.totalTax;
      firstBracketTax = progressiveResult.firstBracketTax;
      secondBracketTax = progressiveResult.secondBracketTax;
      taxFreeAmountApplied = progressiveResult.taxFreeAmountApplied;
      taxRateCode = 'PIT_SCALE';
    }

    // Calculate advance payment due
    const previousAdvances = new Decimal(input.previousAdvancesPaid || '0');
    const currentAdvanceDue = Decimal.max(
      calculatedTax.minus(previousAdvances),
      new Decimal(0)
    );

    // Save calculation
    const [calculation] = await this.db
      .insert(incomeTaxCalculations)
      .values({
        organizationId: input.organizationId,
        clientId: input.clientId,
        taxType: 'PIT',
        taxYear: input.taxYear,
        periodType: input.periodType,
        periodNumber: input.periodNumber,
        totalRevenue: revenue.toString(),
        totalExpenses: expenses.toString(),
        nonDeductibleExpenses: nonDeductibleTotal.toString(),
        taxExemptIncome: input.taxExemptIncome || '0',
        grossIncome: grossIncome.toString(),
        lossDeduction: lossDeduction.toString(),
        taxableIncome: taxableIncome.toString(),
        taxRate: input.useFlatRate ? '19' : '12/32',
        taxRateCode: taxRateCode,
        calculatedTax: calculatedTax.toString(),
        firstBracketTax: firstBracketTax?.toString(),
        secondBracketTax: secondBracketTax?.toString(),
        taxFreeAmountApplied: taxFreeAmountApplied?.toString(),
        previousAdvancesPaid: previousAdvances.toString(),
        currentAdvanceDue: currentAdvanceDue.toString(),
        status: 'CALCULATED',
        calculatedBy: input.userId,
      })
      .returning();

    return {
      calculationId: calculation.id,
      totalRevenue: revenue.toString(),
      totalExpenses: expenses.toString(),
      nonDeductibleExpenses: nonDeductibleTotal.toString(),
      taxExemptIncome: input.taxExemptIncome || '0',
      grossIncome: grossIncome.toString(),
      lossDeduction: lossDeduction.toString(),
      taxableIncome: taxableIncome.toString(),
      taxRate: input.useFlatRate ? '19' : '12/32',
      taxRateCode: taxRateCode,
      calculatedTax: calculatedTax.toString(),
      firstBracketTax: firstBracketTax?.toString(),
      secondBracketTax: secondBracketTax?.toString(),
      taxFreeAmountApplied: taxFreeAmountApplied?.toString(),
      previousAdvancesPaid: previousAdvances.toString(),
      currentAdvanceDue: currentAdvanceDue.toString(),
      lossCarryForwardApplied: lossApplications.length > 0 ? lossApplications : undefined,
    };
  }

  private calculateProgressivePIT(
    taxableIncome: Decimal,
    jointFiling: boolean = false,
    spouseIncome?: Decimal
  ): {
    totalTax: Decimal;
    firstBracketTax: Decimal;
    secondBracketTax: Decimal;
    taxFreeAmountApplied: Decimal;
  } {
    let incomeToTax = taxableIncome;
    let taxFreeAmount = TAX_CONSTANTS.TAX_FREE_AMOUNT;
    let bracket1Threshold = TAX_CONSTANTS.BRACKET_1_THRESHOLD;

    // Joint filing doubles thresholds
    if (jointFiling && spouseIncome) {
      const combinedIncome = taxableIncome.plus(spouseIncome);
      incomeToTax = combinedIncome.div(2); // Split equally
      taxFreeAmount = TAX_CONSTANTS.TAX_FREE_AMOUNT.mul(2);
      bracket1Threshold = TAX_CONSTANTS.BRACKET_1_THRESHOLD.mul(2);
    }

    // Calculate effective tax-free amount (with degression for high earners)
    const effectiveTaxFree = this.calculateEffectiveTaxFreeAmount(incomeToTax);

    let firstBracketTax = new Decimal(0);
    let secondBracketTax = new Decimal(0);

    if (incomeToTax.lte(effectiveTaxFree)) {
      // Income below tax-free threshold
      return {
        totalTax: new Decimal(0),
        firstBracketTax: new Decimal(0),
        secondBracketTax: new Decimal(0),
        taxFreeAmountApplied: incomeToTax,
      };
    }

    const taxableAfterFree = incomeToTax.minus(effectiveTaxFree);
    const bracket1Upper = bracket1Threshold.minus(effectiveTaxFree);

    if (taxableAfterFree.lte(bracket1Upper)) {
      // Only first bracket applies
      firstBracketTax = taxableAfterFree
        .mul(TAX_CONSTANTS.PIT_BRACKET_1_RATE.div(100))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } else {
      // Both brackets apply
      firstBracketTax = bracket1Upper
        .mul(TAX_CONSTANTS.PIT_BRACKET_1_RATE.div(100))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      const secondBracketIncome = taxableAfterFree.minus(bracket1Upper);
      secondBracketTax = secondBracketIncome
        .mul(TAX_CONSTANTS.PIT_BRACKET_2_RATE.div(100))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    let totalTax = firstBracketTax.plus(secondBracketTax);

    // Double tax for joint filing
    if (jointFiling && spouseIncome) {
      totalTax = totalTax.mul(2);
      firstBracketTax = firstBracketTax.mul(2);
      secondBracketTax = secondBracketTax.mul(2);
    }

    return {
      totalTax: totalTax.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      firstBracketTax,
      secondBracketTax,
      taxFreeAmountApplied: effectiveTaxFree,
    };
  }

  private calculateEffectiveTaxFreeAmount(income: Decimal): Decimal {
    // Tax-free amount degression formula (2025 rules)
    // Full 30,000 PLN up to 120,000 PLN income
    // Degression from 120,000 to 200,000 PLN
    // Zero tax-free above 200,000 PLN (approximately)

    if (income.lte(TAX_CONSTANTS.BRACKET_1_THRESHOLD)) {
      return TAX_CONSTANTS.TAX_FREE_AMOUNT;
    }

    const degressionEnd = new Decimal('200000');

    if (income.gte(degressionEnd)) {
      return new Decimal(0);
    }

    // Linear degression
    const degressionRange = degressionEnd.minus(TAX_CONSTANTS.BRACKET_1_THRESHOLD);
    const incomeAboveThreshold = income.minus(TAX_CONSTANTS.BRACKET_1_THRESHOLD);
    const reductionFactor = incomeAboveThreshold.div(degressionRange);

    const reducedAmount = TAX_CONSTANTS.TAX_FREE_AMOUNT.mul(
      new Decimal(1).minus(reductionFactor)
    );

    return Decimal.max(reducedAmount, new Decimal(0)).toDecimalPlaces(2);
  }

  // ===================
  // LOSS CARRY-FORWARD
  // ===================

  async applyLossCarryForward(
    clientId: string,
    taxType: 'CIT' | 'PIT',
    currentIncome: Decimal
  ): Promise<{
    totalDeduction: string;
    applications: Array<{
      lossYear: number;
      amountApplied: string;
      remainingAmount: string;
    }>;
  }> {
    // Get active losses ordered by year (FIFO)
    const losses = await this.db.query.taxLossCarryForwards.findMany({
      where: and(
        eq(taxLossCarryForwards.clientId, clientId),
        eq(taxLossCarryForwards.taxType, taxType),
        eq(taxLossCarryForwards.isActive, true),
        gte(taxLossCarryForwards.expirationYear, new Date().getFullYear()),
      ),
      orderBy: [asc(taxLossCarryForwards.lossYear)],
    });

    if (losses.length === 0) {
      return { totalDeduction: '0', applications: [] };
    }

    // Maximum deduction is 50% of current income
    const maxDeduction = currentIncome
      .mul(TAX_CONSTANTS.LOSS_DEDUCTION_MAX_PERCENT.div(100))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    let totalDeduction = new Decimal(0);
    const applications: Array<{
      lossYear: number;
      amountApplied: string;
      remainingAmount: string;
    }> = [];

    for (const loss of losses) {
      if (totalDeduction.gte(maxDeduction)) break;

      const remainingAllowance = maxDeduction.minus(totalDeduction);
      const lossRemaining = new Decimal(loss.remainingAmount);
      const amountToApply = Decimal.min(remainingAllowance, lossRemaining);

      if (amountToApply.isPositive()) {
        const newRemaining = lossRemaining.minus(amountToApply);

        // Update loss record
        await this.db
          .update(taxLossCarryForwards)
          .set({
            remainingAmount: newRemaining.toString(),
            isActive: newRemaining.isPositive(),
            fullyUtilizedDate: newRemaining.isZero() ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(taxLossCarryForwards.id, loss.id));

        totalDeduction = totalDeduction.plus(amountToApply);
        applications.push({
          lossYear: loss.lossYear,
          amountApplied: amountToApply.toString(),
          remainingAmount: newRemaining.toString(),
        });
      }
    }

    return {
      totalDeduction: totalDeduction.toString(),
      applications,
    };
  }

  async recordLoss(input: LossCarryForwardInput): Promise<void> {
    const currentYear = new Date().getFullYear();

    await this.db.insert(taxLossCarryForwards).values({
      organizationId: input.organizationId,
      clientId: input.clientId,
      taxType: input.taxType,
      lossYear: input.lossYear,
      originalAmount: input.amount,
      remainingAmount: input.amount,
      expirationYear: input.lossYear + TAX_CONSTANTS.LOSS_CARRY_FORWARD_YEARS,
      sourceCalculationId: input.sourceCalculationId,
    });
  }

  // ===================
  // NON-DEDUCTIBLE EXPENSES
  // ===================

  private async processNonDeductibleExpenses(
    expenses: Array<{
      type: string;
      amount: string;
      legalBasis: string;
      description?: string;
    }>
  ): Promise<Array<{
    type: string;
    amount: Decimal;
    legalBasis: string;
    description?: string;
  }>> {
    return expenses.map((exp) => ({
      type: exp.type,
      amount: new Decimal(exp.amount),
      legalBasis: exp.legalBasis,
      description: exp.description,
    }));
  }

  async validateExpenseDeductibility(
    input: ExpenseDeductibilityInput
  ): Promise<{
    isDeductible: boolean;
    deductibleAmount: string;
    nonDeductibleAmount: string;
    reason?: string;
    legalBasis?: string;
  }> {
    const amount = new Decimal(input.amount);

    // Check specific non-deductible categories (Art. 16 CIT / Art. 23 PIT)
    const nonDeductibleCategories = {
      REPRESENTATION: {
        isDeductible: false,
        legalBasis: 'ART_16_UST_1_PKT_28',
        reason: 'Koszty reprezentacji nie stanowią kosztów uzyskania przychodu',
      },
      ENTERTAINMENT: {
        isDeductible: false,
        legalBasis: 'ART_16_UST_1_PKT_28',
        reason: 'Wydatki na rozrywkę nie stanowią kosztów uzyskania przychodu',
      },
    };

    if (nonDeductibleCategories[input.category as keyof typeof nonDeductibleCategories]) {
      const rule = nonDeductibleCategories[input.category as keyof typeof nonDeductibleCategories];
      return {
        isDeductible: false,
        deductibleAmount: '0',
        nonDeductibleAmount: amount.toString(),
        reason: rule.reason,
        legalBasis: rule.legalBasis,
      };
    }

    // Vehicle expenses - mixed use limitation
    if (input.category === 'VEHICLE' && input.vehicleUsageType === 'MIXED_USE') {
      const deductiblePercent = new Decimal('75');
      const deductibleAmount = amount.mul(deductiblePercent.div(100));
      const nonDeductibleAmount = amount.minus(deductibleAmount);

      return {
        isDeductible: true,
        deductibleAmount: deductibleAmount.toString(),
        nonDeductibleAmount: nonDeductibleAmount.toString(),
        reason: 'Samochód do celów mieszanych - ograniczenie do 75%',
        legalBasis: 'ART_16_UST_1_PKT_51',
      };
    }

    // Standard deductible expense
    return {
      isDeductible: true,
      deductibleAmount: amount.toString(),
      nonDeductibleAmount: '0',
    };
  }

  // ===================
  // ADVANCE PAYMENTS
  // ===================

  async calculateAdvancePayment(
    input: AdvancePaymentInput
  ): Promise<{
    advanceAmount: string;
    dueDate: Date;
    calculationMethod: string;
  }> {
    let advanceAmount: Decimal;
    let calculationMethod: string;

    if (input.advanceType === 'SIMPLIFIED' && input.previousYearTax) {
      // Simplified method: 1/12 of previous year tax
      advanceAmount = new Decimal(input.previousYearTax)
        .div(12)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      calculationMethod = 'SIMPLIFIED_1_12';
    } else {
      // Standard method: cumulative tax minus advances paid
      const cumulativeTax = new Decimal(input.cumulativeTaxDue);
      const paidAdvances = new Decimal(input.previousAdvancesPaid);
      advanceAmount = Decimal.max(
        cumulativeTax.minus(paidAdvances),
        new Decimal(0)
      );
      calculationMethod = 'CUMULATIVE';
    }

    // Calculate due date (20th of following month)
    const dueDate = this.calculateAdvanceDueDate(
      input.taxYear,
      input.periodType,
      input.periodNumber
    );

    return {
      advanceAmount: advanceAmount.toString(),
      dueDate,
      calculationMethod,
    };
  }

  private calculateAdvanceDueDate(
    year: number,
    periodType: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
    periodNumber: number
  ): Date {
    let month: number;

    if (periodType === 'MONTHLY') {
      month = periodNumber + 1; // Next month
    } else if (periodType === 'QUARTERLY') {
      month = periodNumber * 3 + 1; // Month after quarter end
    } else {
      // Annual - due April 30th
      return new Date(year + 1, 3, 30);
    }

    // Handle year rollover
    let dueYear = year;
    if (month > 12) {
      month = 1;
      dueYear++;
    }

    // 20th of the month
    return new Date(dueYear, month - 1, 20);
  }
}
```

### API Endpoints

```typescript
// src/server/routers/income-tax.router.ts
import { router, protectedProcedure } from '@/server/trpc';
import { IncomeTaxService } from '@/server/services/income-tax.service';
import {
  CITCalculationInputSchema,
  PITCalculationInputSchema,
  LossCarryForwardInputSchema,
  AdvancePaymentInputSchema,
  ExpenseDeductibilityInputSchema,
} from '@/shared/schemas/income-tax.schema';
import { z } from 'zod';

export const incomeTaxRouter = router({
  // CIT Calculations
  calculateCIT: protectedProcedure
    .input(CITCalculationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new IncomeTaxService(ctx.db, ctx.taxRatesService);

      await ctx.auditLog.log({
        action: 'INCOME_TAX_CIT_CALCULATE',
        resourceType: 'income_tax_calculation',
        details: { clientId: input.clientId, taxYear: input.taxYear },
      });

      return service.calculateCIT({
        ...input,
        organizationId: ctx.session.organizationId,
        userId: ctx.session.userId,
      });
    }),

  // PIT Calculations
  calculatePIT: protectedProcedure
    .input(PITCalculationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new IncomeTaxService(ctx.db, ctx.taxRatesService);

      await ctx.auditLog.log({
        action: 'INCOME_TAX_PIT_CALCULATE',
        resourceType: 'income_tax_calculation',
        details: { clientId: input.clientId, taxYear: input.taxYear },
      });

      return service.calculatePIT({
        ...input,
        organizationId: ctx.session.organizationId,
        userId: ctx.session.userId,
      });
    }),

  // Advance Payments
  calculateAdvance: protectedProcedure
    .input(AdvancePaymentInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new IncomeTaxService(ctx.db, ctx.taxRatesService);
      return service.calculateAdvancePayment(input);
    }),

  // Loss Carry-Forward
  recordLoss: protectedProcedure
    .input(LossCarryForwardInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new IncomeTaxService(ctx.db, ctx.taxRatesService);

      await ctx.auditLog.log({
        action: 'LOSS_CARRY_FORWARD_RECORD',
        resourceType: 'tax_loss_carry_forward',
        details: { clientId: input.clientId, lossYear: input.lossYear },
      });

      return service.recordLoss({
        ...input,
        organizationId: ctx.session.organizationId,
      });
    }),

  getLosses: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      taxType: z.enum(['CIT', 'PIT']),
      activeOnly: z.boolean().default(true),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.taxLossCarryForwards.findMany({
        where: and(
          eq(taxLossCarryForwards.clientId, input.clientId),
          eq(taxLossCarryForwards.taxType, input.taxType),
          input.activeOnly ? eq(taxLossCarryForwards.isActive, true) : undefined,
        ),
        orderBy: [asc(taxLossCarryForwards.lossYear)],
      });
    }),

  // Expense Deductibility
  validateExpense: protectedProcedure
    .input(ExpenseDeductibilityInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new IncomeTaxService(ctx.db, ctx.taxRatesService);
      return service.validateExpenseDeductibility(input);
    }),

  // Small Taxpayer Check
  checkSmallTaxpayer: protectedProcedure
    .input(z.object({
      previousYearRevenue: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const service = new IncomeTaxService(ctx.db, ctx.taxRatesService);
      const isEligible = await service.checkSmallTaxpayerEligibility(input);

      return {
        isSmallTaxpayer: isEligible,
        applicableRate: isEligible ? '9%' : '19%',
        threshold: '2,000,000 EUR',
      };
    }),

  // Calculation History
  getCalculations: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      taxYear: z.number().int(),
      taxType: z.enum(['CIT', 'PIT']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.incomeTaxCalculations.findMany({
        where: and(
          eq(incomeTaxCalculations.clientId, input.clientId),
          eq(incomeTaxCalculations.taxYear, input.taxYear),
          input.taxType ? eq(incomeTaxCalculations.taxType, input.taxType) : undefined,
        ),
        orderBy: [desc(incomeTaxCalculations.createdAt)],
      });
    }),

  getCalculationById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const calculation = await ctx.db.query.incomeTaxCalculations.findFirst({
        where: eq(incomeTaxCalculations.id, input.id),
        with: {
          nonDeductibleExpenses: true,
          lossApplications: true,
        },
      });

      if (!calculation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Calculation not found',
        });
      }

      return calculation;
    }),
});
```

---

## Test Specifications

### Unit Tests

```typescript
// src/server/services/__tests__/income-tax.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import { IncomeTaxService } from '../income-tax.service';

describe('IncomeTaxService', () => {
  let service: IncomeTaxService;
  let mockDb: any;
  let mockTaxRatesService: any;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'calc-123' }]),
      query: {
        taxLossCarryForwards: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    };
    mockTaxRatesService = {};
    service = new IncomeTaxService(mockDb, mockTaxRatesService);
  });

  describe('CIT Calculations', () => {
    it('should calculate CIT at standard 19% rate', async () => {
      const input = {
        organizationId: 'org-123',
        clientId: 'client-123',
        userId: 'user-123',
        taxType: 'CIT' as const,
        taxYear: 2025,
        periodType: 'ANNUAL' as const,
        totalRevenue: '500000',
        totalExpenses: '350000',
        applyLossCarryForward: false,
      };

      const result = await service.calculateCIT(input);

      expect(result.taxableIncome).toBe('150000');
      expect(result.calculatedTax).toBe('28500'); // 150000 * 19%
      expect(result.taxRateCode).toBe('CIT_19');
    });

    it('should apply small taxpayer 9% rate', async () => {
      const input = {
        organizationId: 'org-123',
        clientId: 'client-123',
        userId: 'user-123',
        taxType: 'CIT' as const,
        taxYear: 2025,
        periodType: 'ANNUAL' as const,
        totalRevenue: '500000',
        totalExpenses: '350000',
        isSmallTaxpayer: true,
        applyLossCarryForward: false,
      };

      const result = await service.calculateCIT(input);

      expect(result.taxableIncome).toBe('150000');
      expect(result.calculatedTax).toBe('13500'); // 150000 * 9%
      expect(result.taxRateCode).toBe('CIT_9');
    });

    it('should exclude non-deductible expenses', async () => {
      const input = {
        organizationId: 'org-123',
        clientId: 'client-123',
        userId: 'user-123',
        taxType: 'CIT' as const,
        taxYear: 2025,
        periodType: 'ANNUAL' as const,
        totalRevenue: '500000',
        totalExpenses: '380000',
        nonDeductibleExpenses: [
          { type: 'REPRESENTATION', amount: '30000', legalBasis: 'ART_16_UST_1_PKT_28' },
        ],
        applyLossCarryForward: false,
      };

      const result = await service.calculateCIT(input);

      expect(result.nonDeductibleExpenses).toBe('30000');
      expect(result.taxableIncome).toBe('150000'); // 500000 - (380000 - 30000)
    });
  });

  describe('PIT Progressive Scale', () => {
    it('should calculate zero tax for income below tax-free amount', async () => {
      const input = {
        organizationId: 'org-123',
        clientId: 'client-123',
        userId: 'user-123',
        taxType: 'PIT' as const,
        taxYear: 2025,
        periodType: 'ANNUAL' as const,
        totalRevenue: '25000',
        totalExpenses: '0',
        useFlatRate: false,
        applyLossCarryForward: false,
      };

      const result = await service.calculatePIT(input);

      expect(result.calculatedTax).toBe('0');
      expect(result.taxFreeAmountApplied).toBe('25000');
    });

    it('should calculate PIT in first bracket (12%)', async () => {
      const input = {
        organizationId: 'org-123',
        clientId: 'client-123',
        userId: 'user-123',
        taxType: 'PIT' as const,
        taxYear: 2025,
        periodType: 'ANNUAL' as const,
        totalRevenue: '80000',
        totalExpenses: '20000',
        useFlatRate: false,
        applyLossCarryForward: false,
      };

      const result = await service.calculatePIT(input);

      // Taxable: 60000, after tax-free (30000): 30000 * 12% = 3600
      expect(result.taxableIncome).toBe('60000');
      expect(result.firstBracketTax).toBe('3600');
      expect(result.calculatedTax).toBe('3600');
    });

    it('should calculate PIT in second bracket (32%)', async () => {
      const input = {
        organizationId: 'org-123',
        clientId: 'client-123',
        userId: 'user-123',
        taxType: 'PIT' as const,
        taxYear: 2025,
        periodType: 'ANNUAL' as const,
        totalRevenue: '200000',
        totalExpenses: '30000',
        useFlatRate: false,
        applyLossCarryForward: false,
      };

      const result = await service.calculatePIT(input);

      // Taxable: 170000
      // First bracket: (120000 - 30000) * 12% = 10800
      // Second bracket: (170000 - 120000) * 32% = 16000
      // Total: 26800
      expect(result.taxableIncome).toBe('170000');
      expect(result.firstBracketTax).toBe('10800');
      expect(result.secondBracketTax).toBe('16000');
      expect(result.calculatedTax).toBe('26800');
    });

    it('should calculate PIT flat rate (19%)', async () => {
      const input = {
        organizationId: 'org-123',
        clientId: 'client-123',
        userId: 'user-123',
        taxType: 'PIT' as const,
        taxYear: 2025,
        periodType: 'ANNUAL' as const,
        totalRevenue: '300000',
        totalExpenses: '150000',
        useFlatRate: true,
        applyLossCarryForward: false,
      };

      const result = await service.calculatePIT(input);

      // No tax-free amount for flat rate
      expect(result.taxableIncome).toBe('150000');
      expect(result.calculatedTax).toBe('28500'); // 150000 * 19%
      expect(result.taxRateCode).toBe('PIT_FLAT_19');
    });
  });

  describe('Loss Carry-Forward', () => {
    it('should apply loss carry-forward with 50% limit', async () => {
      mockDb.query.taxLossCarryForwards.findMany.mockResolvedValue([
        {
          id: 'loss-1',
          lossYear: 2024,
          remainingAmount: '80000',
          expirationYear: 2029,
        },
      ]);

      const result = await service.applyLossCarryForward(
        'client-123',
        'CIT',
        new Decimal('150000')
      );

      // Max deduction: 150000 * 50% = 75000
      expect(result.totalDeduction).toBe('75000');
      expect(result.applications[0].amountApplied).toBe('75000');
      expect(result.applications[0].remainingAmount).toBe('5000');
    });

    it('should apply multiple losses in FIFO order', async () => {
      mockDb.query.taxLossCarryForwards.findMany.mockResolvedValue([
        { id: 'loss-1', lossYear: 2022, remainingAmount: '30000', expirationYear: 2027 },
        { id: 'loss-2', lossYear: 2023, remainingAmount: '100000', expirationYear: 2028 },
      ]);

      const result = await service.applyLossCarryForward(
        'client-123',
        'CIT',
        new Decimal('200000')
      );

      // Max deduction: 200000 * 50% = 100000
      // First: use all 30000 from 2022
      // Second: use 70000 from 2023
      expect(result.totalDeduction).toBe('100000');
      expect(result.applications.length).toBe(2);
      expect(result.applications[0].lossYear).toBe(2022);
      expect(result.applications[0].amountApplied).toBe('30000');
      expect(result.applications[1].lossYear).toBe(2023);
      expect(result.applications[1].amountApplied).toBe('70000');
    });
  });

  describe('Expense Deductibility', () => {
    it('should flag representation expenses as non-deductible', async () => {
      const result = await service.validateExpenseDeductibility({
        expenseType: 'Client gifts',
        amount: '5000',
        description: 'Client entertainment',
        documentDate: new Date().toISOString(),
        category: 'REPRESENTATION',
      });

      expect(result.isDeductible).toBe(false);
      expect(result.nonDeductibleAmount).toBe('5000');
      expect(result.legalBasis).toBe('ART_16_UST_1_PKT_28');
    });

    it('should apply 75% limit for mixed-use vehicle expenses', async () => {
      const result = await service.validateExpenseDeductibility({
        expenseType: 'Fuel',
        amount: '10000',
        description: 'Company car fuel',
        documentDate: new Date().toISOString(),
        category: 'VEHICLE',
        vehicleUsageType: 'MIXED_USE',
      });

      expect(result.isDeductible).toBe(true);
      expect(result.deductibleAmount).toBe('7500');
      expect(result.nonDeductibleAmount).toBe('2500');
    });
  });

  describe('Advance Payments', () => {
    it('should calculate standard advance payment', async () => {
      const result = await service.calculateAdvancePayment({
        clientId: 'client-123',
        taxType: 'CIT',
        taxYear: 2025,
        periodType: 'QUARTERLY',
        periodNumber: 2,
        cumulativeIncome: '250000',
        cumulativeTaxDue: '47500',
        previousAdvancesPaid: '20000',
        advanceType: 'STANDARD',
      });

      expect(result.advanceAmount).toBe('27500'); // 47500 - 20000
      expect(result.calculationMethod).toBe('CUMULATIVE');
    });

    it('should calculate simplified advance payment (1/12 method)', async () => {
      const result = await service.calculateAdvancePayment({
        clientId: 'client-123',
        taxType: 'CIT',
        taxYear: 2025,
        periodType: 'MONTHLY',
        periodNumber: 3,
        cumulativeIncome: '0',
        cumulativeTaxDue: '0',
        previousAdvancesPaid: '0',
        advanceType: 'SIMPLIFIED',
        previousYearTax: '60000',
      });

      expect(result.advanceAmount).toBe('5000'); // 60000 / 12
      expect(result.calculationMethod).toBe('SIMPLIFIED_1_12');
    });
  });
});
```

### Integration Tests

```typescript
// src/server/routers/__tests__/income-tax.router.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestContext, createTestCaller } from '@/test/helpers';

describe('Income Tax Router Integration', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let caller: ReturnType<typeof createTestCaller>;

  beforeEach(async () => {
    ctx = await createTestContext();
    caller = createTestCaller(ctx);
  });

  describe('calculateCIT', () => {
    it('should calculate and persist CIT calculation', async () => {
      const result = await caller.tax.calculateCIT({
        clientId: ctx.testClient.id,
        taxType: 'CIT',
        taxYear: 2025,
        periodType: 'ANNUAL',
        totalRevenue: '1000000',
        totalExpenses: '700000',
      });

      expect(result.calculationId).toBeDefined();
      expect(result.taxableIncome).toBe('300000');
      expect(result.calculatedTax).toBe('57000'); // 300000 * 19%

      // Verify persistence
      const saved = await caller.tax.getCalculationById({
        id: result.calculationId,
      });
      expect(saved).toBeDefined();
      expect(saved.taxableIncome).toBe('300000');
    });

    it('should create audit log for CIT calculation', async () => {
      await caller.tax.calculateCIT({
        clientId: ctx.testClient.id,
        taxType: 'CIT',
        taxYear: 2025,
        periodType: 'ANNUAL',
        totalRevenue: '500000',
        totalExpenses: '350000',
      });

      const logs = await ctx.db.query.auditLogs.findMany({
        where: eq(auditLogs.action, 'INCOME_TAX_CIT_CALCULATE'),
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].resourceType).toBe('income_tax_calculation');
    });
  });

  describe('calculatePIT', () => {
    it('should calculate PIT with progressive scale', async () => {
      const result = await caller.tax.calculatePIT({
        clientId: ctx.testClient.id,
        taxType: 'PIT',
        taxYear: 2025,
        periodType: 'ANNUAL',
        totalRevenue: '150000',
        totalExpenses: '30000',
        useFlatRate: false,
      });

      expect(result.taxableIncome).toBe('120000');
      // All in first bracket: (120000 - 30000) * 12% = 10800
      expect(result.firstBracketTax).toBe('10800');
      expect(result.calculatedTax).toBe('10800');
    });
  });

  describe('Loss Carry-Forward', () => {
    it('should record and apply loss carry-forward', async () => {
      // Record a loss
      await caller.tax.recordLoss({
        clientId: ctx.testClient.id,
        taxType: 'CIT',
        lossYear: 2024,
        amount: '100000',
      });

      // Calculate CIT with loss application
      const result = await caller.tax.calculateCIT({
        clientId: ctx.testClient.id,
        taxType: 'CIT',
        taxYear: 2025,
        periodType: 'ANNUAL',
        totalRevenue: '300000',
        totalExpenses: '100000',
        applyLossCarryForward: true,
      });

      // Gross income: 200000
      // Max loss deduction: 200000 * 50% = 100000
      expect(result.lossDeduction).toBe('100000');
      expect(result.taxableIncome).toBe('100000');
      expect(result.calculatedTax).toBe('19000'); // 100000 * 19%
    });
  });
});
```

### E2E Tests

```typescript
// e2e/income-tax.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Income Tax Calculations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('should calculate CIT for corporate client', async ({ page }) => {
    await page.goto('/clients/client-123/tax');

    // Navigate to CIT calculation
    await page.click('[data-testid="new-calculation"]');
    await page.selectOption('[data-testid="tax-type"]', 'CIT');
    await page.selectOption('[data-testid="tax-year"]', '2025');
    await page.selectOption('[data-testid="period-type"]', 'ANNUAL');

    // Enter amounts
    await page.fill('[data-testid="total-revenue"]', '500000');
    await page.fill('[data-testid="total-expenses"]', '350000');

    // Calculate
    await page.click('[data-testid="calculate-button"]');

    // Verify results
    await expect(page.locator('[data-testid="taxable-income"]')).toHaveText('150 000,00 PLN');
    await expect(page.locator('[data-testid="tax-rate"]')).toHaveText('19%');
    await expect(page.locator('[data-testid="calculated-tax"]')).toHaveText('28 500,00 PLN');
  });

  test('should display PIT progressive scale breakdown', async ({ page }) => {
    await page.goto('/clients/client-456/tax');

    await page.click('[data-testid="new-calculation"]');
    await page.selectOption('[data-testid="tax-type"]', 'PIT');
    await page.selectOption('[data-testid="tax-method"]', 'SCALE');

    await page.fill('[data-testid="total-revenue"]', '200000');
    await page.fill('[data-testid="total-expenses"]', '30000');

    await page.click('[data-testid="calculate-button"]');

    // Verify bracket breakdown displayed
    await expect(page.locator('[data-testid="tax-free-amount"]')).toBeVisible();
    await expect(page.locator('[data-testid="first-bracket-tax"]')).toBeVisible();
    await expect(page.locator('[data-testid="second-bracket-tax"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-pit"]')).toHaveText('26 800,00 PLN');
  });

  test('should show loss carry-forward application', async ({ page }) => {
    await page.goto('/clients/client-789/tax/losses');

    // Verify existing losses displayed
    await expect(page.locator('[data-testid="loss-2024"]')).toBeVisible();

    // Go to calculation with loss application
    await page.goto('/clients/client-789/tax');
    await page.click('[data-testid="new-calculation"]');

    await page.fill('[data-testid="total-revenue"]', '300000');
    await page.fill('[data-testid="total-expenses"]', '100000');
    await page.check('[data-testid="apply-loss-carry-forward"]');

    await page.click('[data-testid="calculate-button"]');

    // Verify loss application shown
    await expect(page.locator('[data-testid="loss-deduction"]')).toBeVisible();
    await expect(page.locator('[data-testid="loss-application-details"]')).toBeVisible();
  });
});
```

---

## Security Checklist

- [x] All financial calculations use Decimal.js (no floating point)
- [x] Tax rates validated against official tables
- [x] RLS policies enforce organization isolation
- [x] Audit logging for all calculations
- [x] Input validation with Zod schemas
- [x] Rate limiting on calculation endpoints
- [x] Calculation results are immutable (status-based workflow)
- [x] Loss carry-forward tampering prevented via audit trail
- [x] Sensitive tax data encrypted at rest
- [x] Legal basis documented for all deductibility rules

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `INCOME_TAX_CIT_CALCULATE` | CIT calculation | Client, year, amounts, rate |
| `INCOME_TAX_PIT_CALCULATE` | PIT calculation | Client, year, amounts, method |
| `LOSS_CARRY_FORWARD_RECORD` | Loss recorded | Client, year, amount |
| `LOSS_CARRY_FORWARD_APPLY` | Loss applied | Calculation, loss IDs, amounts |
| `ADVANCE_PAYMENT_CALCULATE` | Advance calculated | Client, period, amount |
| `ESTONIAN_CIT_CALCULATE` | Estonian CIT calc | Client, distribution, rate |

---

## Implementation Notes

### Polish Tax Law References

- **CIT**: Ustawa o CIT (Dz.U. 1992 Nr 21 poz. 86)
  - Art. 16 - Non-deductible expenses
  - Art. 18 - Loss carry-forward rules
  - Art. 19 - Tax rates (19%, 9%)
  - Art. 28c-28t - Estonian CIT (Estoński CIT)

- **PIT**: Ustawa o PIT (Dz.U. 1991 Nr 80 poz. 350)
  - Art. 23 - Non-deductible expenses
  - Art. 27 - Progressive tax scale
  - Art. 30c - Flat 19% rate
  - Art. 9 - Loss carry-forward

### Edge Cases

1. **Leap Year Deadlines**: February 29 adjustments handled
2. **Negative Income**: Returns zero tax, creates loss carry-forward
3. **Mixed Rate Scenarios**: Handle rate changes mid-year
4. **Joint Filing Edge Cases**: Spouse income validation
5. **Estonian CIT Exit**: Proper taxation of all retained earnings
6. **Currency Conversion**: Use NBP exchange rates for PLN equivalents

### Performance Considerations

- Batch loss carry-forward queries
- Cache tax rate lookups (max 1 hour)
- Index on (client_id, tax_year, period_type)
- Async calculation for large datasets

---

## Dependencies

- **TAX-001**: Client tax configuration
- **TAX-002**: Tax rates and rules management
- **ACC**: Accounting data for revenue/expense aggregation

## Related Stories

- **TAX-006**: ZUS Contribution Calculation
- **TAX-007**: JPK File Generation
- **TAX-012**: Tax Compliance Reports

---

*Story created: December 2024*
*Last updated: December 2024*
