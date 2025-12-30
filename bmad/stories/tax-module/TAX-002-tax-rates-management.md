# Story: Tax Rates and Rules Management (TAX-002)

> **Story ID**: TAX-002
> **Epic**: Tax Compliance Module (TAX)
> **Priority**: P0 (Critical)
> **Story Points**: 5
> **Status**: 📋 Ready for Development

---

## 📋 User Story

**As an** accountant,
**I want to** access current Polish tax rates and rules,
**So that** calculations are always accurate and compliant with current regulations.

---

## 🎯 Acceptance Criteria

### AC1: VAT Rates Management

```gherkin
Feature: VAT Rates Management
  As an accountant
  I need access to current VAT rates
  So that I can apply correct rates to transactions

  Scenario: View current VAT rates
    Given I am logged in as an accountant
    When I access the tax rates reference
    Then I should see all current VAT rates:
      | Rate | Code | Description                    |
      | 23%  | 23   | Stawka podstawowa              |
      | 8%   | 8    | Stawka obniżona (żywność, etc) |
      | 5%   | 5    | Stawka obniżona (podstawowa żywność) |
      | 0%   | 0    | Stawka zerowa (eksport, WDT)   |
      | zw   | ZW   | Zwolniony z VAT                |
      | np   | NP   | Nie podlega VAT (odwrotne obciążenie) |

  Scenario: Apply VAT rate to transaction
    Given I am creating a sales invoice
    When I select product category "electronics"
    Then the system should suggest VAT rate "23%"
    And I should be able to override if justified

  Scenario: VAT rate for mixed transactions
    Given I have an invoice with multiple items
    And items have different VAT rates
    When the invoice is calculated
    Then each line item should use its specific rate
    And the summary should show VAT per rate
    And the total VAT should be sum of all rates

  Scenario: VAT rate historical lookup
    Given a transaction occurred on "2023-06-15"
    When I calculate VAT for that date
    Then the system should use rates valid on that date
    And any rate changes after that date should not apply
```

### AC2: CIT Rates Management

```gherkin
Feature: CIT Rates Management
  As an accountant
  I need access to current CIT rates
  So that corporate income tax is calculated correctly

  Scenario: Standard CIT rate
    Given a client is a CIT payer
    And the client is not a small taxpayer
    When I calculate CIT
    Then the rate of 19% should be applied

  Scenario: Small taxpayer CIT rate
    Given a client is a CIT payer
    And the client qualifies as small taxpayer
    When I calculate CIT
    Then the rate of 9% should be applied
    And the qualification should be documented

  Scenario: CIT advance payment calculation
    Given a client has monthly CIT advances
    When I calculate the advance for current month
    Then the calculation should consider:
      | Factor                    | Source              |
      | Year-to-date revenue      | ACC module          |
      | Year-to-date expenses     | ACC module          |
      | Tax-deductible expenses   | Art. 15 CIT law     |
      | Non-deductible expenses   | Art. 16 CIT law     |
      | Previous advances paid    | TAX module          |
    And the advance amount should be calculated correctly
```

### AC3: PIT Rates Management

```gherkin
Feature: PIT Rates Management
  As an accountant
  I need access to current PIT rates
  So that personal income tax is calculated correctly

  Scenario: Progressive PIT scale
    Given a client uses progressive tax scale
    When calculating PIT
    Then the following thresholds should apply:
      | Income Range          | Rate | Tax Calculation              |
      | 0 - 30,000 PLN        | 0%   | Tax-free amount              |
      | 30,001 - 120,000 PLN  | 12%  | (income - 30000) * 0.12      |
      | > 120,000 PLN         | 32%  | 10800 + (income - 120000) * 0.32 |

  Scenario: Flat PIT rate
    Given a client uses flat tax (podatek liniowy)
    When calculating PIT
    Then the rate of 19% should be applied
    And no tax-free amount should apply

  Scenario: Lump sum taxation (Ryczałt)
    Given a client uses lump sum taxation
    When calculating tax
    Then rates should be based on activity type:
      | Activity Type                    | Rate   |
      | IT services                      | 12%    |
      | Other services                   | 8.5%   |
      | Trade                            | 3%     |
      | Manufacturing                    | 5.5%   |
      | Rental income                    | 8.5%   |
```

### AC4: ZUS Rates Management

```gherkin
Feature: ZUS Contribution Rates
  As an accountant
  I need access to current ZUS rates
  So that social security contributions are calculated correctly

  Scenario: View current ZUS rates for 2024
    Given I access ZUS rates reference
    Then I should see the following rates:
      | Contribution    | Employee | Employer | Total  |
      | Emerytalne      | 9.76%    | 9.76%    | 19.52% |
      | Rentowe         | 1.5%     | 6.5%     | 8%     |
      | Chorobowe       | 2.45%    | 0%       | 2.45%  |
      | Wypadkowe       | 0%       | 1.67%*   | 1.67%  |
      | Zdrowotne       | 9%       | 0%       | 9%     |
      | FP              | 0%       | 2.45%    | 2.45%  |
      | FGŚP            | 0%       | 0.1%     | 0.1%   |
    And note that wypadkowe varies by employer risk category

  Scenario: Calculate ZUS for self-employed
    Given a self-employed person with standard ZUS
    And the declared contribution base is 4,694.40 PLN (2024)
    When I calculate monthly contributions
    Then the calculation should be:
      | Contribution    | Amount PLN |
      | Emerytalne      | 458.19     |
      | Rentowe         | 187.78     |
      | Chorobowe       | 115.01     |
      | Wypadkowe       | 78.39      |
      | Zdrowotne       | 381.78*    |
      | FP              | 115.01     |
    And health insurance is 9% of 75% minimum wage

  Scenario: Calculate ZUS for preferential (Mały ZUS Plus)
    Given a self-employed person qualifies for Mały ZUS Plus
    And last year revenue was 80,000 PLN
    When I calculate the contribution base
    Then the base should be:
      | Formula | revenue * 0.3 / 12 |
      | Result  | 2,000 PLN          |
    And contributions should be calculated on this reduced base
```

### AC5: Tax Rate Updates

```gherkin
Feature: Tax Rate Updates
  As an administrator
  I need automatic tax rate updates
  So that the system always uses current rates

  Scenario: Automatic rate detection
    Given the system monitors official Polish government sources
    When a new tax rate is announced
    Then the system should notify administrators
    And prepare the rate update for review
    And store effective date

  Scenario: Manual rate update
    Given I am an administrator
    When I update a tax rate
    Then I must provide:
      | Field          | Required |
      | New rate value | Yes      |
      | Effective from | Yes      |
      | Legal basis    | Yes      |
      | Documentation  | Yes      |
    And the change should be logged for audit

  Scenario: Rate change impact analysis
    Given a VAT rate will change on "2025-01-01"
    When I request impact analysis
    Then the system should show:
      | Impact Area        | Count   |
      | Active clients     | 150     |
      | Pending invoices   | 25      |
      | Open transactions  | 300     |
    And recommendations for handling the transition
```

---

## 🗄️ Database Schema

```sql
-- Tax rates reference table
CREATE TABLE tax_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tax_type VARCHAR(20) NOT NULL, -- 'VAT', 'CIT', 'PIT', 'ZUS'
    rate_code VARCHAR(10) NOT NULL,
    rate_name VARCHAR(100) NOT NULL,
    rate_value DECIMAL(5,2) NOT NULL,

    -- Applicability
    applies_to VARCHAR(50), -- 'employee', 'employer', 'self_employed', 'all'
    activity_type VARCHAR(50), -- For lump sum rates

    -- Validity period
    effective_from DATE NOT NULL,
    effective_to DATE,

    -- Legal reference
    legal_basis VARCHAR(200),
    description TEXT,

    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    CONSTRAINT chk_tax_type CHECK (tax_type IN ('VAT', 'CIT', 'PIT', 'ZUS', 'FP', 'FGSP')),
    CONSTRAINT unique_rate_period UNIQUE (tax_type, rate_code, effective_from)
);

-- Index for rate lookups
CREATE INDEX idx_tax_rates_type_date ON tax_rates(tax_type, effective_from DESC);
CREATE INDEX idx_tax_rates_active ON tax_rates(is_active) WHERE is_active = true;

-- ZUS contribution bases
CREATE TABLE zus_contribution_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL,
    month INTEGER,

    -- Bases
    minimum_wage DECIMAL(12,2) NOT NULL,
    average_wage DECIMAL(12,2),
    declared_base_min DECIMAL(12,2), -- 60% average wage
    declared_base_standard DECIMAL(12,2),
    health_base DECIMAL(12,2), -- 75% minimum wage
    preferential_base_max DECIMAL(12,2),

    -- ZUS annual limits
    annual_contribution_limit DECIMAL(14,2), -- 30x average wage

    effective_from DATE NOT NULL,
    effective_to DATE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_zus_base_period UNIQUE (year, month)
);

-- Tax thresholds (for progressive scales)
CREATE TABLE tax_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tax_type VARCHAR(20) NOT NULL,
    threshold_name VARCHAR(50) NOT NULL,

    lower_bound DECIMAL(14,2),
    upper_bound DECIMAL(14,2),
    rate DECIMAL(5,2) NOT NULL,
    base_amount DECIMAL(14,2), -- Fixed amount for bracket

    effective_from DATE NOT NULL,
    effective_to DATE,

    legal_basis VARCHAR(200),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_threshold_bounds CHECK (lower_bound < upper_bound OR upper_bound IS NULL)
);

-- Tax rate change audit
CREATE TABLE tax_rate_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_id UUID REFERENCES tax_rates(id),

    action VARCHAR(20) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    change_reason TEXT,

    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed current VAT rates
INSERT INTO tax_rates (tax_type, rate_code, rate_name, rate_value, effective_from, legal_basis)
VALUES
    ('VAT', '23', 'Stawka podstawowa', 23.00, '2011-01-01', 'Art. 41 ust. 1 ustawy o VAT'),
    ('VAT', '8', 'Stawka obniżona', 8.00, '2011-01-01', 'Art. 41 ust. 2 ustawy o VAT'),
    ('VAT', '5', 'Stawka obniżona', 5.00, '2011-01-01', 'Art. 41 ust. 2a ustawy o VAT'),
    ('VAT', '0', 'Stawka zerowa', 0.00, '2011-01-01', 'Art. 41 ust. 4-11 ustawy o VAT'),
    ('VAT', 'ZW', 'Zwolniony', 0.00, '2011-01-01', 'Art. 43 ustawy o VAT'),
    ('VAT', 'NP', 'Nie podlega', 0.00, '2011-01-01', 'Art. 17 ust. 1 pkt 7 ustawy o VAT');

-- Seed CIT rates
INSERT INTO tax_rates (tax_type, rate_code, rate_name, rate_value, effective_from, legal_basis)
VALUES
    ('CIT', 'STANDARD', 'Stawka podstawowa CIT', 19.00, '2004-01-01', 'Art. 19 ust. 1 ustawy o CIT'),
    ('CIT', 'SMALL', 'Mały podatnik CIT', 9.00, '2019-01-01', 'Art. 19 ust. 1 pkt 2 ustawy o CIT');

-- Seed PIT rates
INSERT INTO tax_rates (tax_type, rate_code, rate_name, rate_value, effective_from, legal_basis)
VALUES
    ('PIT', 'FLAT', 'Podatek liniowy', 19.00, '2004-01-01', 'Art. 30c ust. 1 ustawy o PIT'),
    ('PIT', 'PROG_12', 'Skala progresywna - I próg', 12.00, '2022-07-01', 'Art. 27 ust. 1 ustawy o PIT'),
    ('PIT', 'PROG_32', 'Skala progresywna - II próg', 32.00, '2009-01-01', 'Art. 27 ust. 1 ustawy o PIT');

-- Seed ZUS rates 2024
INSERT INTO tax_rates (tax_type, rate_code, rate_name, rate_value, applies_to, effective_from, legal_basis)
VALUES
    ('ZUS', 'EMERY_EE', 'Emerytalne (pracownik)', 9.76, 'employee', '1999-01-01', 'Art. 22 ust. 1 pkt 1 ustawy o SUS'),
    ('ZUS', 'EMERY_ER', 'Emerytalne (pracodawca)', 9.76, 'employer', '1999-01-01', 'Art. 22 ust. 1 pkt 1 ustawy o SUS'),
    ('ZUS', 'RENT_EE', 'Rentowe (pracownik)', 1.50, 'employee', '2012-02-01', 'Art. 22 ust. 1 pkt 2 ustawy o SUS'),
    ('ZUS', 'RENT_ER', 'Rentowe (pracodawca)', 6.50, 'employer', '2012-02-01', 'Art. 22 ust. 1 pkt 2 ustawy o SUS'),
    ('ZUS', 'CHOR_EE', 'Chorobowe (pracownik)', 2.45, 'employee', '1999-01-01', 'Art. 22 ust. 1 pkt 3 ustawy o SUS'),
    ('ZUS', 'WYPAD_ER', 'Wypadkowe (pracodawca)', 1.67, 'employer', '2018-04-01', 'Art. 22 ust. 1 pkt 4 ustawy o SUS'),
    ('ZUS', 'ZDROW', 'Zdrowotne', 9.00, 'all', '2022-01-01', 'Art. 79 ust. 1 ustawy o świadczeniach'),
    ('FP', 'FP', 'Fundusz Pracy', 2.45, 'employer', '2021-01-01', 'Art. 104 ust. 1 ustawy o promocji zatrudnienia'),
    ('FGSP', 'FGSP', 'FGŚP', 0.10, 'employer', '2006-07-01', 'Art. 9 ustawy o ochronie roszczeń pracowniczych');

-- Seed PIT thresholds 2024
INSERT INTO tax_thresholds (tax_type, threshold_name, lower_bound, upper_bound, rate, base_amount, effective_from, legal_basis)
VALUES
    ('PIT', 'Kwota wolna', 0, 30000, 0, 0, '2022-07-01', 'Art. 27 ust. 1 ustawy o PIT'),
    ('PIT', 'I próg podatkowy', 30000.01, 120000, 12, 0, '2022-07-01', 'Art. 27 ust. 1 ustawy o PIT'),
    ('PIT', 'II próg podatkowy', 120000.01, NULL, 32, 10800, '2009-01-01', 'Art. 27 ust. 1 ustawy o PIT');

-- Seed ZUS bases 2024
INSERT INTO zus_contribution_bases (year, minimum_wage, average_wage, declared_base_min, declared_base_standard, health_base, annual_contribution_limit, effective_from)
VALUES
    (2024, 4242.00, 7824.00, 4694.40, 4694.40, 3181.50, 234720.00, '2024-01-01');
```

---

## 🔌 API Specification

### Endpoints

```typescript
// Tax Rates
GET    /api/trpc/tax.getRates
GET    /api/trpc/tax.getRatesByType
GET    /api/trpc/tax.getRateForDate
POST   /api/trpc/tax.updateRate (admin)
GET    /api/trpc/tax.getRateHistory

// ZUS Bases
GET    /api/trpc/tax.getZUSBases
GET    /api/trpc/tax.getZUSBaseForPeriod

// Thresholds
GET    /api/trpc/tax.getThresholds
GET    /api/trpc/tax.getPITThresholds

// Calculations
POST   /api/trpc/tax.calculateVATAmount
POST   /api/trpc/tax.calculatePITAmount
POST   /api/trpc/tax.calculateZUSContributions
```

### Zod Schemas

```typescript
import { z } from 'zod';
import { Decimal } from 'decimal.js';

// Tax Type enum
export const TaxTypeSchema = z.enum(['VAT', 'CIT', 'PIT', 'ZUS', 'FP', 'FGSP']);

// Get rates input
export const GetRatesInputSchema = z.object({
  taxType: TaxTypeSchema,
  asOfDate: z.string().datetime().optional(),
  includeInactive: z.boolean().default(false)
});

// Tax rate response
export const TaxRateResponseSchema = z.object({
  id: z.string().uuid(),
  taxType: TaxTypeSchema,
  rateCode: z.string(),
  rateName: z.string(),
  rateValue: z.number(),
  appliesTo: z.string().nullable(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable(),
  legalBasis: z.string().nullable(),
  description: z.string().nullable(),
  isActive: z.boolean()
});

// VAT calculation input
export const VATCalculationInputSchema = z.object({
  netAmount: z.number().positive(),
  rateCode: z.string(),
  transactionDate: z.string().datetime().optional()
});

// VAT calculation response
export const VATCalculationResponseSchema = z.object({
  netAmount: z.number(),
  vatRate: z.number(),
  vatAmount: z.number(),
  grossAmount: z.number(),
  rateCode: z.string(),
  rateName: z.string(),
  effectiveDate: z.string().datetime()
});

// PIT calculation input
export const PITCalculationInputSchema = z.object({
  annualIncome: z.number(),
  taxOption: z.enum(['progressive', 'flat', 'lump_sum']),
  activityType: z.string().optional(), // For lump sum
  deductions: z.number().default(0),
  taxYear: z.number().int()
});

// PIT calculation response
export const PITCalculationResponseSchema = z.object({
  annualIncome: z.number(),
  taxableIncome: z.number(),
  taxOption: z.string(),
  brackets: z.array(z.object({
    threshold: z.string(),
    income: z.number(),
    rate: z.number(),
    tax: z.number()
  })),
  totalTax: z.number(),
  effectiveRate: z.number(),
  taxYear: z.number()
});

// ZUS calculation input
export const ZUSCalculationInputSchema = z.object({
  contributorType: z.enum(['employee', 'employer', 'self_employed']),
  zusType: z.enum(['standard', 'preferential', 'ulga_na_start']).optional(),
  grossSalary: z.number().positive().optional(),
  declaredBase: z.number().positive().optional(),
  accidentRate: z.number().min(0.67).max(3.33).optional(),
  calculationMonth: z.number().int().min(1).max(12),
  calculationYear: z.number().int()
});

// ZUS calculation response
export const ZUSCalculationResponseSchema = z.object({
  contributorType: z.string(),
  contributionBase: z.number(),
  contributions: z.object({
    emerytalne: z.object({ employee: z.number(), employer: z.number(), total: z.number() }),
    rentowe: z.object({ employee: z.number(), employer: z.number(), total: z.number() }),
    chorobowe: z.object({ employee: z.number(), employer: z.number(), total: z.number() }),
    wypadkowe: z.object({ employee: z.number(), employer: z.number(), total: z.number() }),
    zdrowotne: z.object({ employee: z.number(), employer: z.number(), total: z.number() }),
    fp: z.object({ employee: z.number(), employer: z.number(), total: z.number() }),
    fgsp: z.object({ employee: z.number(), employer: z.number(), total: z.number() })
  }),
  totalEmployee: z.number(),
  totalEmployer: z.number(),
  totalContributions: z.number(),
  netSalary: z.number().optional()
});
```

### Service Implementation

```typescript
import { Decimal } from 'decimal.js';

export class TaxRatesService {
  constructor(private db: PrismaClient) {}

  /**
   * Get VAT rate for date
   */
  async getVATRate(rateCode: string, asOfDate: Date = new Date()): Promise<TaxRate> {
    const rate = await this.db.taxRate.findFirst({
      where: {
        taxType: 'VAT',
        rateCode,
        effectiveFrom: { lte: asOfDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: asOfDate } }
        ],
        isActive: true
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    if (!rate) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `VAT rate ${rateCode} not found for date ${asOfDate.toISOString()}`
      });
    }

    return rate;
  }

  /**
   * Calculate VAT amount using Decimal.js for precision
   */
  async calculateVAT(input: VATCalculationInput): Promise<VATCalculationResult> {
    const rate = await this.getVATRate(
      input.rateCode,
      input.transactionDate ? new Date(input.transactionDate) : new Date()
    );

    const netAmount = new Decimal(input.netAmount);
    const vatRate = new Decimal(rate.rateValue).div(100);
    const vatAmount = netAmount.mul(vatRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const grossAmount = netAmount.plus(vatAmount);

    return {
      netAmount: netAmount.toNumber(),
      vatRate: rate.rateValue,
      vatAmount: vatAmount.toNumber(),
      grossAmount: grossAmount.toNumber(),
      rateCode: rate.rateCode,
      rateName: rate.rateName,
      effectiveDate: rate.effectiveFrom.toISOString()
    };
  }

  /**
   * Calculate PIT using progressive scale
   */
  async calculatePIT(input: PITCalculationInput): Promise<PITCalculationResult> {
    const thresholds = await this.db.taxThreshold.findMany({
      where: {
        taxType: 'PIT',
        effectiveFrom: { lte: new Date(input.taxYear, 0, 1) },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date(input.taxYear, 11, 31) } }
        ]
      },
      orderBy: { lowerBound: 'asc' }
    });

    if (input.taxOption === 'flat') {
      const flatRate = await this.db.taxRate.findFirst({
        where: { taxType: 'PIT', rateCode: 'FLAT', isActive: true }
      });

      const taxableIncome = new Decimal(input.annualIncome).minus(input.deductions);
      const tax = taxableIncome.mul(new Decimal(flatRate!.rateValue).div(100));

      return {
        annualIncome: input.annualIncome,
        taxableIncome: taxableIncome.toNumber(),
        taxOption: 'flat',
        brackets: [{
          threshold: 'Podatek liniowy',
          income: taxableIncome.toNumber(),
          rate: flatRate!.rateValue,
          tax: tax.toNumber()
        }],
        totalTax: tax.toNumber(),
        effectiveRate: tax.div(input.annualIncome).mul(100).toNumber(),
        taxYear: input.taxYear
      };
    }

    // Progressive calculation
    const taxableIncome = new Decimal(input.annualIncome).minus(input.deductions);
    let remainingIncome = taxableIncome;
    let totalTax = new Decimal(0);
    const brackets: Array<{ threshold: string; income: number; rate: number; tax: number }> = [];

    for (const threshold of thresholds) {
      if (remainingIncome.lte(0)) break;

      const lower = new Decimal(threshold.lowerBound || 0);
      const upper = threshold.upperBound ? new Decimal(threshold.upperBound) : null;
      const rate = new Decimal(threshold.rate).div(100);
      const baseAmount = new Decimal(threshold.baseAmount || 0);

      let bracketIncome: Decimal;
      if (upper) {
        const bracketSize = upper.minus(lower);
        bracketIncome = Decimal.min(remainingIncome, bracketSize);
      } else {
        bracketIncome = remainingIncome;
      }

      const bracketTax = bracketIncome.mul(rate);

      brackets.push({
        threshold: threshold.thresholdName,
        income: bracketIncome.toNumber(),
        rate: threshold.rate,
        tax: bracketTax.toNumber()
      });

      totalTax = totalTax.plus(bracketTax);
      remainingIncome = remainingIncome.minus(bracketIncome);
    }

    return {
      annualIncome: input.annualIncome,
      taxableIncome: taxableIncome.toNumber(),
      taxOption: 'progressive',
      brackets,
      totalTax: totalTax.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
      effectiveRate: totalTax.div(input.annualIncome).mul(100).toDecimalPlaces(2).toNumber(),
      taxYear: input.taxYear
    };
  }

  /**
   * Calculate ZUS contributions
   */
  async calculateZUS(input: ZUSCalculationInput): Promise<ZUSCalculationResult> {
    // Get ZUS rates
    const rates = await this.db.taxRate.findMany({
      where: {
        taxType: { in: ['ZUS', 'FP', 'FGSP'] },
        isActive: true,
        effectiveFrom: { lte: new Date(input.calculationYear, input.calculationMonth - 1, 1) }
      }
    });

    // Get ZUS bases
    const bases = await this.db.zusContributionBase.findFirst({
      where: {
        year: input.calculationYear,
        OR: [
          { month: input.calculationMonth },
          { month: null }
        ]
      },
      orderBy: { month: 'desc' }
    });

    if (!bases) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `ZUS bases not found for ${input.calculationYear}/${input.calculationMonth}`
      });
    }

    // Determine contribution base
    let contributionBase: Decimal;
    if (input.contributorType === 'employee') {
      contributionBase = new Decimal(input.grossSalary!);
    } else if (input.zusType === 'preferential') {
      contributionBase = new Decimal(bases.preferentialBaseMax || bases.declaredBaseMin!);
    } else {
      contributionBase = new Decimal(input.declaredBase || bases.declaredBaseStandard!);
    }

    // Get individual rates
    const getRateValue = (code: string): Decimal => {
      const rate = rates.find(r => r.rateCode === code);
      return new Decimal(rate?.rateValue || 0).div(100);
    };

    const accidentRate = new Decimal(input.accidentRate || 1.67).div(100);

    // Calculate each contribution
    const emerytalne = {
      employee: contributionBase.mul(getRateValue('EMERY_EE')),
      employer: contributionBase.mul(getRateValue('EMERY_ER'))
    };

    const rentowe = {
      employee: contributionBase.mul(getRateValue('RENT_EE')),
      employer: contributionBase.mul(getRateValue('RENT_ER'))
    };

    const chorobowe = {
      employee: contributionBase.mul(getRateValue('CHOR_EE')),
      employer: new Decimal(0)
    };

    const wypadkowe = {
      employee: new Decimal(0),
      employer: contributionBase.mul(accidentRate)
    };

    // Health insurance base is different
    const healthBase = input.contributorType === 'self_employed'
      ? new Decimal(bases.healthBase!)
      : contributionBase.minus(emerytalne.employee).minus(rentowe.employee).minus(chorobowe.employee);

    const zdrowotne = {
      employee: healthBase.mul(getRateValue('ZDROW')),
      employer: new Decimal(0)
    };

    const fp = {
      employee: new Decimal(0),
      employer: contributionBase.mul(getRateValue('FP'))
    };

    const fgsp = {
      employee: new Decimal(0),
      employer: contributionBase.mul(getRateValue('FGSP'))
    };

    const totalEmployee = emerytalne.employee
      .plus(rentowe.employee)
      .plus(chorobowe.employee)
      .plus(zdrowotne.employee);

    const totalEmployer = emerytalne.employer
      .plus(rentowe.employer)
      .plus(wypadkowe.employer)
      .plus(fp.employer)
      .plus(fgsp.employer);

    return {
      contributorType: input.contributorType,
      contributionBase: contributionBase.toNumber(),
      contributions: {
        emerytalne: {
          employee: emerytalne.employee.toDecimalPlaces(2).toNumber(),
          employer: emerytalne.employer.toDecimalPlaces(2).toNumber(),
          total: emerytalne.employee.plus(emerytalne.employer).toDecimalPlaces(2).toNumber()
        },
        rentowe: {
          employee: rentowe.employee.toDecimalPlaces(2).toNumber(),
          employer: rentowe.employer.toDecimalPlaces(2).toNumber(),
          total: rentowe.employee.plus(rentowe.employer).toDecimalPlaces(2).toNumber()
        },
        chorobowe: {
          employee: chorobowe.employee.toDecimalPlaces(2).toNumber(),
          employer: 0,
          total: chorobowe.employee.toDecimalPlaces(2).toNumber()
        },
        wypadkowe: {
          employee: 0,
          employer: wypadkowe.employer.toDecimalPlaces(2).toNumber(),
          total: wypadkowe.employer.toDecimalPlaces(2).toNumber()
        },
        zdrowotne: {
          employee: zdrowotne.employee.toDecimalPlaces(2).toNumber(),
          employer: 0,
          total: zdrowotne.employee.toDecimalPlaces(2).toNumber()
        },
        fp: {
          employee: 0,
          employer: fp.employer.toDecimalPlaces(2).toNumber(),
          total: fp.employer.toDecimalPlaces(2).toNumber()
        },
        fgsp: {
          employee: 0,
          employer: fgsp.employer.toDecimalPlaces(2).toNumber(),
          total: fgsp.employer.toDecimalPlaces(2).toNumber()
        }
      },
      totalEmployee: totalEmployee.toDecimalPlaces(2).toNumber(),
      totalEmployer: totalEmployer.toDecimalPlaces(2).toNumber(),
      totalContributions: totalEmployee.plus(totalEmployer).toDecimalPlaces(2).toNumber(),
      netSalary: input.grossSalary
        ? new Decimal(input.grossSalary).minus(totalEmployee).toDecimalPlaces(2).toNumber()
        : undefined
    };
  }
}
```

---

## 🧪 Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { TaxRatesService } from './service';
import { Decimal } from 'decimal.js';

describe('Tax Rates Service', () => {
  let service: TaxRatesService;

  beforeEach(() => {
    service = new TaxRatesService(mockDb);
  });

  describe('VAT Calculations', () => {
    it('should calculate 23% VAT correctly', async () => {
      const result = await service.calculateVAT({
        netAmount: 1000,
        rateCode: '23'
      });

      expect(result.vatAmount).toBe(230);
      expect(result.grossAmount).toBe(1230);
    });

    it('should handle 8% reduced rate', async () => {
      const result = await service.calculateVAT({
        netAmount: 500,
        rateCode: '8'
      });

      expect(result.vatAmount).toBe(40);
      expect(result.grossAmount).toBe(540);
    });

    it('should handle exempt (ZW) rate', async () => {
      const result = await service.calculateVAT({
        netAmount: 1000,
        rateCode: 'ZW'
      });

      expect(result.vatAmount).toBe(0);
      expect(result.grossAmount).toBe(1000);
    });

    it('should round VAT to 2 decimal places', async () => {
      const result = await service.calculateVAT({
        netAmount: 123.45,
        rateCode: '23'
      });

      expect(result.vatAmount).toBe(28.39); // 123.45 * 0.23 = 28.3935 → 28.39
    });
  });

  describe('PIT Calculations', () => {
    it('should calculate progressive PIT with tax-free amount', async () => {
      const result = await service.calculatePIT({
        annualIncome: 50000,
        taxOption: 'progressive',
        deductions: 0,
        taxYear: 2024
      });

      // 0-30000: 0%, 30001-50000: 12%
      expect(result.totalTax).toBe(2400); // (50000-30000) * 0.12
      expect(result.effectiveRate).toBeCloseTo(4.8);
    });

    it('should calculate PIT in second bracket', async () => {
      const result = await service.calculatePIT({
        annualIncome: 150000,
        taxOption: 'progressive',
        deductions: 0,
        taxYear: 2024
      });

      // 0-30000: 0 PLN
      // 30001-120000: 10,800 PLN (90000 * 0.12)
      // 120001-150000: 9,600 PLN (30000 * 0.32)
      expect(result.totalTax).toBe(20400);
    });

    it('should calculate flat PIT correctly', async () => {
      const result = await service.calculatePIT({
        annualIncome: 100000,
        taxOption: 'flat',
        deductions: 0,
        taxYear: 2024
      });

      expect(result.totalTax).toBe(19000); // 100000 * 0.19
    });
  });

  describe('ZUS Calculations', () => {
    it('should calculate employee ZUS contributions', async () => {
      const result = await service.calculateZUS({
        contributorType: 'employee',
        grossSalary: 10000,
        calculationMonth: 1,
        calculationYear: 2024
      });

      expect(result.contributions.emerytalne.employee).toBe(976);
      expect(result.contributions.rentowe.employee).toBe(150);
      expect(result.contributions.chorobowe.employee).toBe(245);
      expect(result.totalEmployee).toBeGreaterThan(0);
    });

    it('should calculate self-employed standard ZUS', async () => {
      const result = await service.calculateZUS({
        contributorType: 'self_employed',
        zusType: 'standard',
        declaredBase: 4694.40,
        calculationMonth: 1,
        calculationYear: 2024
      });

      expect(result.contributionBase).toBe(4694.40);
      expect(result.totalContributions).toBeGreaterThan(1000);
    });

    it('should calculate preferential ZUS', async () => {
      const result = await service.calculateZUS({
        contributorType: 'self_employed',
        zusType: 'preferential',
        calculationMonth: 1,
        calculationYear: 2024
      });

      // Preferential should have lower base
      expect(result.contributionBase).toBeLessThan(4694.40);
    });
  });
});
```

---

## 🔒 Security Checklist

- [x] **Read-only rates**: Regular users cannot modify rates
- [x] **Admin-only updates**: Only administrators can update rates
- [x] **Audit trail**: All rate changes logged
- [x] **Historical integrity**: Past rates preserved for historical calculations
- [x] **Decimal precision**: All calculations use Decimal.js

---

## 📊 Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `tax.rate.viewed` | Rate lookup | Rate ID, user, date |
| `tax.rate.updated` | Admin change | Old/new values, user |
| `tax.calculation.performed` | Any calculation | Type, input, result |

---

## 📝 Implementation Notes

### Polish Legal References
- **VAT Rates**: Art. 41 ustawy o VAT
- **CIT Rates**: Art. 19 ustawy o CIT
- **PIT Thresholds**: Art. 27 ustawy o PIT
- **ZUS Rates**: Art. 22 ustawy o SUS

### Integration Points
- **TAX-001**: Uses rates for configuration validation
- **TAX-004**: VAT calculation engine
- **TAX-005**: CIT/PIT calculation engine
- **TAX-006**: ZUS calculation engine

---

*Story last updated: December 2024*
