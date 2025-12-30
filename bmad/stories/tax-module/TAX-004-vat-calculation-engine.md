# TAX-004: VAT Calculation Engine

> **Story ID**: TAX-004
> **Epic**: [TAX - Tax Compliance Module](./epic.md)
> **Priority**: P0 (Critical)
> **Points**: 13
> **Status**: 📋 Ready for Development
> **Sprint**: Phase 4, Week 13

---

## User Story

**As an** accountant processing client invoices,
**I want** automated VAT calculations with support for all Polish VAT scenarios,
**So that** I can accurately determine VAT obligations and prepare declarations.

---

## Acceptance Criteria

### AC1: Basic VAT Calculation

```gherkin
Feature: Basic VAT Calculation
  As an accountant
  I need to calculate VAT on transactions
  So that I can determine tax obligations

  Background:
    Given I am logged in as an accountant
    And I have a client with active VAT configuration

  Scenario: Calculate VAT at standard rate (23%)
    Given a transaction with net amount 1000.00 PLN
    And VAT rate is "STANDARD" (23%)
    When I calculate VAT
    Then VAT amount should be 230.00 PLN
    And gross amount should be 1230.00 PLN

  Scenario: Calculate VAT at reduced rate (8%)
    Given a transaction with net amount 500.00 PLN
    And VAT rate is "REDUCED_8" (8%)
    When I calculate VAT
    Then VAT amount should be 40.00 PLN
    And gross amount should be 540.00 PLN

  Scenario: Calculate VAT at reduced rate (5%)
    Given a transaction with net amount 200.00 PLN
    And VAT rate is "REDUCED_5" (5%)
    When I calculate VAT
    Then VAT amount should be 10.00 PLN
    And gross amount should be 210.00 PLN

  Scenario: Zero-rated transaction (0%)
    Given a transaction with net amount 5000.00 PLN
    And VAT rate is "ZERO" (0%)
    When I calculate VAT
    Then VAT amount should be 0.00 PLN
    And gross amount should be 5000.00 PLN
    And transaction should be marked for export reporting

  Scenario: Exempt transaction (zw)
    Given a transaction with net amount 1000.00 PLN
    And VAT rate is "EXEMPT" (zw)
    When I calculate VAT
    Then VAT amount should be 0.00 PLN
    And transaction should be flagged as exempt
    And legal basis should be required

  Scenario: Reverse charge (np)
    Given a transaction with net amount 10000.00 PLN
    And VAT rate is "REVERSE_CHARGE" (np)
    When I calculate VAT
    Then VAT amount should be 0.00 PLN
    And transaction should be flagged for reverse charge mechanism
    And buyer NIP should be validated

  Scenario: Calculate from gross amount
    Given a transaction with gross amount 1230.00 PLN
    And VAT rate is "STANDARD" (23%)
    When I calculate VAT backwards
    Then net amount should be 1000.00 PLN
    And VAT amount should be 230.00 PLN
```

### AC2: Input/Output VAT Tracking

```gherkin
Feature: Input/Output VAT Tracking
  As an accountant
  I need to track input and output VAT separately
  So that I can calculate VAT settlement

  Scenario: Record output VAT (VAT należny)
    Given a sales invoice with net amount 10000.00 PLN
    And VAT rate is 23%
    When I record the invoice as sales
    Then output VAT should increase by 2300.00 PLN
    And the transaction should be categorized as "OUTPUT"

  Scenario: Record input VAT (VAT naliczony)
    Given a purchase invoice with net amount 5000.00 PLN
    And VAT rate is 23%
    And the expense is business-related
    When I record the invoice as purchase
    Then input VAT should increase by 1150.00 PLN
    And the transaction should be categorized as "INPUT"

  Scenario: Calculate VAT settlement
    Given output VAT for the period is 10000.00 PLN
    And input VAT for the period is 6000.00 PLN
    When I calculate VAT settlement
    Then VAT due (do zapłaty) should be 4000.00 PLN

  Scenario: VAT refund scenario
    Given output VAT for the period is 3000.00 PLN
    And input VAT for the period is 8000.00 PLN
    When I calculate VAT settlement
    Then VAT refund (do zwrotu) should be 5000.00 PLN
    And refund options should be displayed:
      | Option            | Timeline |
      | Bank transfer     | 60 days  |
      | Offset next period| Immediate|
      | Accelerated (25d) | 25 days  |

  Scenario: Partial input VAT deduction
    Given a purchase invoice for 2000.00 PLN gross
    And the vehicle is used 50% for business
    When I record the invoice with 50% deduction
    Then input VAT should be 162.60 PLN (50% of 325.20)
    And non-deductible VAT should be added to expense
```

### AC3: EU Transaction Handling

```gherkin
Feature: EU Transaction Handling
  As an accountant
  I need to handle intra-EU transactions correctly
  So that WNT and WDT are properly reported

  Scenario: Intra-Community Acquisition (WNT)
    Given a purchase from EU supplier with VAT ID "DE123456789"
    And invoice amount is 5000.00 EUR
    And exchange rate is 4.50 PLN/EUR
    When I record the WNT transaction
    Then amount in PLN should be 22500.00 PLN
    And both input and output VAT should be calculated at 23%
    And output VAT should be 5175.00 PLN
    And input VAT should be 5175.00 PLN
    And transaction should be flagged for JPK WNT reporting

  Scenario: Intra-Community Supply (WDT)
    Given a sale to EU customer with VAT ID "FR98765432198"
    And invoice amount is 10000.00 PLN
    When I record the WDT transaction
    Then VAT rate should be 0%
    And transaction should require valid EU VAT ID
    And transaction should be flagged for JPK WDT reporting
    And EU VAT ID should be verified via VIES

  Scenario: Validate EU VAT ID via VIES
    Given an EU VAT ID "DE123456789"
    When I verify the VAT ID
    Then VIES API should confirm validity
    And company name should be returned
    And address should be returned
    And verification result should be cached for 24 hours

  Scenario: Invalid EU VAT ID
    Given an EU VAT ID "DE000000000"
    When I verify the VAT ID
    Then VIES API should return invalid
    And WDT should be blocked until valid ID provided
    And user should be warned about potential 23% VAT liability

  Scenario: Triangular transaction
    Given company A (PL) buys from B (DE) and sells to C (FR)
    And goods ship directly from DE to FR
    When I record the triangular transaction
    Then the transaction should be flagged as triangular
    And simplified procedure should be applied
    And proper reporting codes should be set
```

### AC4: Reverse Charge Mechanism

```gherkin
Feature: Reverse Charge Mechanism
  As an accountant
  I need to handle reverse charge transactions
  So that VAT is properly shifted to the buyer

  Scenario: Domestic reverse charge (construction services)
    Given a subcontractor invoice for construction services
    And invoice amount is 50000.00 PLN net
    And service is listed in Annex 14 to VAT Act
    When I record the reverse charge invoice
    Then seller's invoice should have no VAT (np)
    And buyer should self-account VAT at 23%
    And both input and output VAT should be 11500.00 PLN
    And transaction should have GTU code "GTU_05"

  Scenario: Import of services reverse charge
    Given a service invoice from US supplier
    And invoice amount is 1000.00 USD
    And exchange rate is 4.00 PLN/USD
    When I record the import of services
    Then amount in PLN should be 4000.00 PLN
    And buyer should self-account VAT
    And output VAT should be 920.00 PLN (23%)
    And input VAT should be 920.00 PLN if deductible
    And transaction should be flagged for import services reporting

  Scenario: Annex 15 goods (split payment mandatory)
    Given a purchase of goods from Annex 15
    And invoice amount is 20000.00 PLN gross
    And amount exceeds 15000.00 PLN threshold
    When I record the invoice
    Then split payment should be marked as mandatory
    And invoice should have "Mechanizm podzielonej płatności" annotation
    And bank account should be verified on White List
```

### AC5: OSS Procedure Support

```gherkin
Feature: One Stop Shop (OSS) Procedure
  As an accountant
  I need to handle OSS transactions for EU B2C sales
  So that VAT is correctly reported in destination countries

  Scenario: B2C sale to EU consumer
    Given a sale to private consumer in Germany
    And consumer has no VAT ID
    And sale amount is 500.00 EUR
    When I record the B2C sale
    Then German VAT rate should be applied (19%)
    And VAT amount should be 79.83 EUR
    And transaction should be flagged for OSS reporting

  Scenario: OSS threshold monitoring
    Given total B2C sales to EU in current year
    When sales exceed 10000.00 EUR threshold
    Then client should be notified about mandatory OSS registration
    And future transactions should use destination country VAT rates

  Scenario: Generate OSS declaration data
    Given OSS transactions for Q1 2025
    When I generate OSS declaration
    Then transactions should be grouped by destination country
    And each country's VAT should be calculated separately
    And total VAT due should be summarized
    And declaration should follow OSS XML format

  Scenario: Multiple destination countries
    Given sales to:
      | Country | Net Amount | VAT Rate |
      | DE      | 1000 EUR   | 19%      |
      | FR      | 500 EUR    | 20%      |
      | IT      | 800 EUR    | 22%      |
    When I calculate OSS VAT
    Then VAT breakdown should be:
      | Country | VAT Amount |
      | DE      | 190 EUR    |
      | FR      | 100 EUR    |
      | IT      | 176 EUR    |
    And total OSS VAT should be 466 EUR
```

### AC6: VAT Corrections

```gherkin
Feature: VAT Corrections
  As an accountant
  I need to process VAT corrections
  So that errors are properly adjusted

  Scenario: Correction invoice (faktura korygująca)
    Given an original invoice with net 1000.00 PLN and VAT 230.00 PLN
    And the correction reduces net by 200.00 PLN
    When I create correction invoice
    Then net difference should be -200.00 PLN
    And VAT difference should be -46.00 PLN
    And correction should reference original invoice number
    And correction should appear in current period's JPK

  Scenario: Complete invoice cancellation
    Given an original invoice with net 5000.00 PLN
    When I create full cancellation correction
    Then correction net should be -5000.00 PLN
    And correction VAT should be -1150.00 PLN (23%)
    And both invoices should be linked

  Scenario: Correction affecting previous period
    Given an original invoice from Q3 2024
    And correction is issued in Q1 2025
    When I record the correction
    Then correction should appear in Q1 2025 JPK
    And previous period should not be modified
    And system should track period discrepancy

  Scenario: Price increase correction
    Given an original invoice with net 1000.00 PLN
    And correction increases price by 500.00 PLN
    When I create price increase correction
    Then correction net should be +500.00 PLN
    And correction VAT should be +115.00 PLN
    And total after correction should be visible
```

### AC7: VAT Carry-Forward

```gherkin
Feature: VAT Carry-Forward
  As an accountant
  I need to track VAT overpayments carried forward
  So that they are properly applied to future periods

  Scenario: Carry forward excess input VAT
    Given VAT settlement for January shows 5000.00 PLN refund due
    And client chooses to carry forward
    When I process the carry forward
    Then carry forward amount should be recorded as 5000.00 PLN
    And status should be "CARRY_FORWARD"
    And it should be available for February settlement

  Scenario: Apply carry forward to next period
    Given carry forward from January is 5000.00 PLN
    And February's VAT due is 3000.00 PLN
    When I calculate February settlement
    Then carry forward should reduce VAT due
    And net VAT due should be 0.00 PLN
    And remaining carry forward should be 2000.00 PLN
    And February's JPK should reflect the offset

  Scenario: Track carry forward history
    Given multiple periods with carry forwards
    When I view carry forward history
    Then I should see:
      | Period   | Original | Applied | Remaining |
      | 2024-10  | 5000     | 3000    | 2000      |
      | 2024-11  | 2000     | 2000    | 0         |
      | 2024-12  | 1000     | 0       | 1000      |
    And history should be exportable for audit

  Scenario: Partial refund with carry forward
    Given VAT refund due is 10000.00 PLN
    And client requests 5000.00 PLN refund
    When I process partial refund
    Then 5000.00 PLN should be marked for refund
    And 5000.00 PLN should be carried forward
    And JPK should reflect this split
```

---

## Technical Specification

### Database Schema

```sql
-- VAT transactions table
CREATE TABLE vat_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id),
    journal_entry_id UUID REFERENCES journal_entries(id),

    -- Transaction details
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN (
        'DOMESTIC_SALE', 'DOMESTIC_PURCHASE', 'WDT', 'WNT',
        'IMPORT_GOODS', 'IMPORT_SERVICES', 'EXPORT', 'OSS_SALE',
        'REVERSE_CHARGE', 'CORRECTION'
    )),
    vat_direction VARCHAR(10) NOT NULL CHECK (vat_direction IN ('INPUT', 'OUTPUT', 'BOTH')),

    -- Amounts
    net_amount DECIMAL(15, 2) NOT NULL,
    vat_rate_code VARCHAR(20) NOT NULL,
    vat_rate_value DECIMAL(5, 2) NOT NULL,
    vat_amount DECIMAL(15, 2) NOT NULL,
    gross_amount DECIMAL(15, 2) NOT NULL,

    -- Currency handling
    currency VARCHAR(3) DEFAULT 'PLN',
    exchange_rate DECIMAL(10, 6) DEFAULT 1.000000,
    net_amount_pln DECIMAL(15, 2) NOT NULL,
    vat_amount_pln DECIMAL(15, 2) NOT NULL,
    gross_amount_pln DECIMAL(15, 2) NOT NULL,

    -- Period
    tax_period_year INTEGER NOT NULL,
    tax_period_month INTEGER NOT NULL CHECK (tax_period_month BETWEEN 1 AND 12),
    transaction_date DATE NOT NULL,

    -- Counterparty
    counterparty_name VARCHAR(500),
    counterparty_nip VARCHAR(20),
    counterparty_country VARCHAR(2),
    counterparty_vat_id VARCHAR(20),

    -- EU specific
    is_eu_transaction BOOLEAN DEFAULT false,
    eu_vat_id_verified BOOLEAN,
    eu_vat_id_verification_date TIMESTAMPTZ,
    destination_country VARCHAR(2),

    -- Correction reference
    is_correction BOOLEAN DEFAULT false,
    corrects_transaction_id UUID REFERENCES vat_transactions(id),
    correction_reason TEXT,

    -- JPK reporting
    jpk_document_type VARCHAR(10),
    gtu_codes VARCHAR(50)[],
    procedure_codes VARCHAR(20)[],

    -- Status
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN (
        'ACTIVE', 'CORRECTED', 'CANCELLED', 'PENDING_VERIFICATION'
    )),

    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VAT period summaries
CREATE TABLE vat_period_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

    -- Period
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    period_type VARCHAR(10) NOT NULL CHECK (period_type IN ('MONTHLY', 'QUARTERLY')),
    quarter INTEGER CHECK (quarter BETWEEN 1 AND 4),

    -- Output VAT (VAT należny)
    output_vat_23 DECIMAL(15, 2) DEFAULT 0,
    output_vat_8 DECIMAL(15, 2) DEFAULT 0,
    output_vat_5 DECIMAL(15, 2) DEFAULT 0,
    output_vat_0 DECIMAL(15, 2) DEFAULT 0,
    output_vat_wdt DECIMAL(15, 2) DEFAULT 0,
    output_vat_export DECIMAL(15, 2) DEFAULT 0,
    output_vat_reverse_charge DECIMAL(15, 2) DEFAULT 0,
    output_vat_total DECIMAL(15, 2) DEFAULT 0,

    -- Input VAT (VAT naliczony)
    input_vat_deductible DECIMAL(15, 2) DEFAULT 0,
    input_vat_non_deductible DECIMAL(15, 2) DEFAULT 0,
    input_vat_fixed_assets DECIMAL(15, 2) DEFAULT 0,
    input_vat_wnt DECIMAL(15, 2) DEFAULT 0,
    input_vat_import DECIMAL(15, 2) DEFAULT 0,
    input_vat_total DECIMAL(15, 2) DEFAULT 0,

    -- Settlement
    vat_due DECIMAL(15, 2) DEFAULT 0,
    vat_refund DECIMAL(15, 2) DEFAULT 0,
    carry_forward_from_previous DECIMAL(15, 2) DEFAULT 0,
    carry_forward_to_next DECIMAL(15, 2) DEFAULT 0,
    final_vat_due DECIMAL(15, 2) DEFAULT 0,
    final_vat_refund DECIMAL(15, 2) DEFAULT 0,

    -- Status
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'CALCULATED', 'SUBMITTED', 'ACCEPTED', 'CORRECTED'
    )),
    jpk_file_id UUID,
    submission_date TIMESTAMPTZ,
    upo_number VARCHAR(100),

    -- Metadata
    calculated_at TIMESTAMPTZ,
    calculated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (client_id, year, month)
);

-- VAT carry forward tracking
CREATE TABLE vat_carry_forwards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

    -- Source period
    source_year INTEGER NOT NULL,
    source_month INTEGER NOT NULL,
    source_summary_id UUID NOT NULL REFERENCES vat_period_summaries(id),

    -- Amount
    original_amount DECIMAL(15, 2) NOT NULL,
    remaining_amount DECIMAL(15, 2) NOT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN (
        'ACTIVE', 'PARTIALLY_APPLIED', 'FULLY_APPLIED', 'REFUNDED', 'EXPIRED'
    )),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Carry forward applications
CREATE TABLE vat_carry_forward_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carry_forward_id UUID NOT NULL REFERENCES vat_carry_forwards(id) ON DELETE CASCADE,
    target_summary_id UUID NOT NULL REFERENCES vat_period_summaries(id),
    amount_applied DECIMAL(15, 2) NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    applied_by UUID NOT NULL REFERENCES users(id)
);

-- EU VAT verification cache
CREATE TABLE eu_vat_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vat_id VARCHAR(20) NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    is_valid BOOLEAN NOT NULL,
    company_name VARCHAR(500),
    company_address TEXT,
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    request_id VARCHAR(100),
    UNIQUE (vat_id)
);

-- Indexes
CREATE INDEX idx_vat_transactions_org ON vat_transactions(organization_id);
CREATE INDEX idx_vat_transactions_client ON vat_transactions(client_id);
CREATE INDEX idx_vat_transactions_period ON vat_transactions(tax_period_year, tax_period_month);
CREATE INDEX idx_vat_transactions_type ON vat_transactions(transaction_type);
CREATE INDEX idx_vat_transactions_date ON vat_transactions(transaction_date);
CREATE INDEX idx_vat_summaries_client_period ON vat_period_summaries(client_id, year, month);
CREATE INDEX idx_vat_carry_forwards_client ON vat_carry_forwards(client_id);
CREATE INDEX idx_eu_vat_cache ON eu_vat_verifications(vat_id);

-- RLS Policies
ALTER TABLE vat_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_period_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_carry_forwards ENABLE ROW LEVEL SECURITY;

CREATE POLICY vat_transactions_org_isolation ON vat_transactions
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY vat_summaries_org_isolation ON vat_period_summaries
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY vat_carry_forwards_org_isolation ON vat_carry_forwards
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);
```

### VAT Calculation Service

```typescript
// src/server/services/vat-calculation.service.ts
import Decimal from 'decimal.js';
import { TRPCError } from '@trpc/server';

// Configure Decimal.js for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface VATCalculationInput {
  netAmount?: string;
  grossAmount?: string;
  vatRateCode: string;
  currency?: string;
  exchangeRate?: string;
  transactionDate: Date;
}

export interface VATCalculationResult {
  netAmount: Decimal;
  vatRate: Decimal;
  vatRateCode: string;
  vatAmount: Decimal;
  grossAmount: Decimal;
  netAmountPLN: Decimal;
  vatAmountPLN: Decimal;
  grossAmountPLN: Decimal;
  exchangeRate: Decimal;
  currency: string;
}

export interface VATSettlementInput {
  clientId: string;
  year: number;
  month: number;
}

export interface VATSettlementResult {
  outputVAT: {
    rate23: Decimal;
    rate8: Decimal;
    rate5: Decimal;
    rate0: Decimal;
    wdt: Decimal;
    exports: Decimal;
    reverseCharge: Decimal;
    total: Decimal;
  };
  inputVAT: {
    deductible: Decimal;
    nonDeductible: Decimal;
    fixedAssets: Decimal;
    wnt: Decimal;
    imports: Decimal;
    total: Decimal;
  };
  settlement: {
    vatDue: Decimal;
    vatRefund: Decimal;
    carryForwardFromPrevious: Decimal;
    carryForwardToNext: Decimal;
    finalVatDue: Decimal;
    finalVatRefund: Decimal;
  };
}

export class VATCalculationService {
  constructor(
    private db: Database,
    private taxRatesService: TaxRatesService,
    private viesService: VIESVerificationService
  ) {}

  /**
   * Calculate VAT from net amount
   */
  async calculateFromNet(input: VATCalculationInput): Promise<VATCalculationResult> {
    if (!input.netAmount) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Net amount is required for forward calculation',
      });
    }

    const vatRate = await this.taxRatesService.getVATRate(
      input.vatRateCode,
      input.transactionDate
    );

    const netAmount = new Decimal(input.netAmount);
    const rate = new Decimal(vatRate.rateValue).div(100);
    const exchangeRate = new Decimal(input.exchangeRate || '1');
    const currency = input.currency || 'PLN';

    // Calculate VAT and gross
    const vatAmount = netAmount.mul(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const grossAmount = netAmount.plus(vatAmount);

    // Convert to PLN if foreign currency
    const netAmountPLN = netAmount.mul(exchangeRate).toDecimalPlaces(2);
    const vatAmountPLN = vatAmount.mul(exchangeRate).toDecimalPlaces(2);
    const grossAmountPLN = grossAmount.mul(exchangeRate).toDecimalPlaces(2);

    return {
      netAmount,
      vatRate: rate.mul(100),
      vatRateCode: input.vatRateCode,
      vatAmount,
      grossAmount,
      netAmountPLN,
      vatAmountPLN,
      grossAmountPLN,
      exchangeRate,
      currency,
    };
  }

  /**
   * Calculate VAT backwards from gross amount
   */
  async calculateFromGross(input: VATCalculationInput): Promise<VATCalculationResult> {
    if (!input.grossAmount) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Gross amount is required for backward calculation',
      });
    }

    const vatRate = await this.taxRatesService.getVATRate(
      input.vatRateCode,
      input.transactionDate
    );

    const grossAmount = new Decimal(input.grossAmount);
    const rate = new Decimal(vatRate.rateValue).div(100);
    const exchangeRate = new Decimal(input.exchangeRate || '1');
    const currency = input.currency || 'PLN';

    // Calculate net from gross: net = gross / (1 + rate)
    const divisor = new Decimal(1).plus(rate);
    const netAmount = grossAmount.div(divisor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const vatAmount = grossAmount.minus(netAmount);

    // Convert to PLN
    const netAmountPLN = netAmount.mul(exchangeRate).toDecimalPlaces(2);
    const vatAmountPLN = vatAmount.mul(exchangeRate).toDecimalPlaces(2);
    const grossAmountPLN = grossAmount.mul(exchangeRate).toDecimalPlaces(2);

    return {
      netAmount,
      vatRate: rate.mul(100),
      vatRateCode: input.vatRateCode,
      vatAmount,
      grossAmount,
      netAmountPLN,
      vatAmountPLN,
      grossAmountPLN,
      exchangeRate,
      currency,
    };
  }

  /**
   * Calculate VAT settlement for a period
   */
  async calculateSettlement(input: VATSettlementInput): Promise<VATSettlementResult> {
    const { clientId, year, month } = input;

    // Get all VAT transactions for the period
    const transactions = await this.db.query.vatTransactions.findMany({
      where: and(
        eq(vatTransactions.clientId, clientId),
        eq(vatTransactions.taxPeriodYear, year),
        eq(vatTransactions.taxPeriodMonth, month),
        eq(vatTransactions.status, 'ACTIVE'),
      ),
    });

    // Initialize accumulators
    const outputVAT = {
      rate23: new Decimal(0),
      rate8: new Decimal(0),
      rate5: new Decimal(0),
      rate0: new Decimal(0),
      wdt: new Decimal(0),
      exports: new Decimal(0),
      reverseCharge: new Decimal(0),
      total: new Decimal(0),
    };

    const inputVAT = {
      deductible: new Decimal(0),
      nonDeductible: new Decimal(0),
      fixedAssets: new Decimal(0),
      wnt: new Decimal(0),
      imports: new Decimal(0),
      total: new Decimal(0),
    };

    // Process each transaction
    for (const tx of transactions) {
      const vatAmount = new Decimal(tx.vatAmountPln);

      if (tx.vatDirection === 'OUTPUT' || tx.vatDirection === 'BOTH') {
        switch (tx.vatRateCode) {
          case 'STANDARD':
            outputVAT.rate23 = outputVAT.rate23.plus(vatAmount);
            break;
          case 'REDUCED_8':
            outputVAT.rate8 = outputVAT.rate8.plus(vatAmount);
            break;
          case 'REDUCED_5':
            outputVAT.rate5 = outputVAT.rate5.plus(vatAmount);
            break;
          case 'ZERO':
            outputVAT.rate0 = outputVAT.rate0.plus(vatAmount);
            break;
        }

        if (tx.transactionType === 'WDT') {
          outputVAT.wdt = outputVAT.wdt.plus(new Decimal(tx.netAmountPln));
        }
        if (tx.transactionType === 'EXPORT') {
          outputVAT.exports = outputVAT.exports.plus(new Decimal(tx.netAmountPln));
        }
        if (tx.transactionType === 'REVERSE_CHARGE') {
          outputVAT.reverseCharge = outputVAT.reverseCharge.plus(vatAmount);
        }
      }

      if (tx.vatDirection === 'INPUT' || tx.vatDirection === 'BOTH') {
        if (tx.transactionType === 'WNT') {
          inputVAT.wnt = inputVAT.wnt.plus(vatAmount);
        } else if (tx.transactionType === 'IMPORT_GOODS' || tx.transactionType === 'IMPORT_SERVICES') {
          inputVAT.imports = inputVAT.imports.plus(vatAmount);
        } else {
          inputVAT.deductible = inputVAT.deductible.plus(vatAmount);
        }
      }
    }

    // Calculate totals
    outputVAT.total = outputVAT.rate23
      .plus(outputVAT.rate8)
      .plus(outputVAT.rate5)
      .plus(outputVAT.reverseCharge);

    inputVAT.total = inputVAT.deductible
      .plus(inputVAT.wnt)
      .plus(inputVAT.imports);

    // Get carry forward from previous period
    const carryForward = await this.getCarryForward(clientId, year, month);
    const carryForwardFromPrevious = new Decimal(carryForward?.remainingAmount || 0);

    // Calculate settlement
    const netPosition = outputVAT.total.minus(inputVAT.total);
    let vatDue = new Decimal(0);
    let vatRefund = new Decimal(0);
    let carryForwardToNext = new Decimal(0);
    let finalVatDue = new Decimal(0);
    let finalVatRefund = new Decimal(0);

    if (netPosition.greaterThan(0)) {
      vatDue = netPosition;
      // Apply carry forward
      if (carryForwardFromPrevious.greaterThan(0)) {
        if (carryForwardFromPrevious.greaterThanOrEqualTo(vatDue)) {
          carryForwardToNext = carryForwardFromPrevious.minus(vatDue);
          finalVatDue = new Decimal(0);
        } else {
          finalVatDue = vatDue.minus(carryForwardFromPrevious);
        }
      } else {
        finalVatDue = vatDue;
      }
    } else {
      vatRefund = netPosition.abs();
      finalVatRefund = vatRefund.plus(carryForwardFromPrevious);
    }

    return {
      outputVAT,
      inputVAT,
      settlement: {
        vatDue,
        vatRefund,
        carryForwardFromPrevious,
        carryForwardToNext,
        finalVatDue,
        finalVatRefund,
      },
    };
  }

  /**
   * Process WNT (Intra-Community Acquisition)
   */
  async processWNT(input: {
    clientId: string;
    supplierVatId: string;
    netAmount: string;
    currency: string;
    exchangeRate: string;
    transactionDate: Date;
    periodYear: number;
    periodMonth: number;
  }): Promise<VATCalculationResult & { transactionId: string }> {
    // Verify EU VAT ID
    const verification = await this.viesService.verifyVatId(input.supplierVatId);
    if (!verification.valid) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Invalid EU VAT ID: ${input.supplierVatId}`,
      });
    }

    // Calculate VAT (WNT requires self-accounting at Polish rate)
    const calculation = await this.calculateFromNet({
      netAmount: input.netAmount,
      vatRateCode: 'STANDARD', // Always 23% for WNT
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      transactionDate: input.transactionDate,
    });

    // Create transaction with both input and output VAT
    const [transaction] = await this.db.insert(vatTransactions).values({
      organizationId: this.ctx.session.organizationId,
      clientId: input.clientId,
      transactionType: 'WNT',
      vatDirection: 'BOTH', // Both input and output VAT
      netAmount: calculation.netAmount.toString(),
      vatRateCode: 'STANDARD',
      vatRateValue: '23.00',
      vatAmount: calculation.vatAmount.toString(),
      grossAmount: calculation.grossAmount.toString(),
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      netAmountPln: calculation.netAmountPLN.toString(),
      vatAmountPln: calculation.vatAmountPLN.toString(),
      grossAmountPln: calculation.grossAmountPLN.toString(),
      taxPeriodYear: input.periodYear,
      taxPeriodMonth: input.periodMonth,
      transactionDate: input.transactionDate,
      counterpartyVatId: input.supplierVatId,
      counterpartyCountry: input.supplierVatId.substring(0, 2),
      counterpartyName: verification.name,
      isEuTransaction: true,
      euVatIdVerified: true,
      euVatIdVerificationDate: new Date(),
      createdBy: this.ctx.session.userId,
    }).returning({ id: vatTransactions.id });

    return {
      ...calculation,
      transactionId: transaction.id,
    };
  }

  /**
   * Process WDT (Intra-Community Supply)
   */
  async processWDT(input: {
    clientId: string;
    customerVatId: string;
    netAmount: string;
    transactionDate: Date;
    periodYear: number;
    periodMonth: number;
  }): Promise<{ transactionId: string; netAmount: Decimal }> {
    // Verify EU VAT ID
    const verification = await this.viesService.verifyVatId(input.customerVatId);
    if (!verification.valid) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Invalid EU VAT ID. WDT requires valid EU VAT ID. ID: ${input.customerVatId}`,
      });
    }

    const netAmount = new Decimal(input.netAmount);

    // Create WDT transaction (0% VAT)
    const [transaction] = await this.db.insert(vatTransactions).values({
      organizationId: this.ctx.session.organizationId,
      clientId: input.clientId,
      transactionType: 'WDT',
      vatDirection: 'OUTPUT',
      netAmount: netAmount.toString(),
      vatRateCode: 'ZERO',
      vatRateValue: '0.00',
      vatAmount: '0.00',
      grossAmount: netAmount.toString(),
      currency: 'PLN',
      exchangeRate: '1.000000',
      netAmountPln: netAmount.toString(),
      vatAmountPln: '0.00',
      grossAmountPln: netAmount.toString(),
      taxPeriodYear: input.periodYear,
      taxPeriodMonth: input.periodMonth,
      transactionDate: input.transactionDate,
      counterpartyVatId: input.customerVatId,
      counterpartyCountry: input.customerVatId.substring(0, 2),
      counterpartyName: verification.name,
      isEuTransaction: true,
      euVatIdVerified: true,
      euVatIdVerificationDate: new Date(),
      destinationCountry: input.customerVatId.substring(0, 2),
      createdBy: this.ctx.session.userId,
    }).returning({ id: vatTransactions.id });

    return {
      transactionId: transaction.id,
      netAmount,
    };
  }

  /**
   * Create correction transaction
   */
  async createCorrection(input: {
    originalTransactionId: string;
    netAmountDifference: string;
    reason: string;
    correctionDate: Date;
    periodYear: number;
    periodMonth: number;
  }): Promise<{ correctionId: string; vatDifference: Decimal }> {
    // Get original transaction
    const original = await this.db.query.vatTransactions.findFirst({
      where: eq(vatTransactions.id, input.originalTransactionId),
    });

    if (!original) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Original transaction not found',
      });
    }

    // Calculate correction VAT
    const netDiff = new Decimal(input.netAmountDifference);
    const rate = new Decimal(original.vatRateValue).div(100);
    const vatDiff = netDiff.mul(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const grossDiff = netDiff.plus(vatDiff);

    // Create correction transaction
    const [correction] = await this.db.insert(vatTransactions).values({
      organizationId: original.organizationId,
      clientId: original.clientId,
      transactionType: 'CORRECTION',
      vatDirection: original.vatDirection,
      netAmount: netDiff.toString(),
      vatRateCode: original.vatRateCode,
      vatRateValue: original.vatRateValue,
      vatAmount: vatDiff.toString(),
      grossAmount: grossDiff.toString(),
      currency: original.currency,
      exchangeRate: original.exchangeRate,
      netAmountPln: netDiff.mul(new Decimal(original.exchangeRate)).toDecimalPlaces(2).toString(),
      vatAmountPln: vatDiff.mul(new Decimal(original.exchangeRate)).toDecimalPlaces(2).toString(),
      grossAmountPln: grossDiff.mul(new Decimal(original.exchangeRate)).toDecimalPlaces(2).toString(),
      taxPeriodYear: input.periodYear,
      taxPeriodMonth: input.periodMonth,
      transactionDate: input.correctionDate,
      counterpartyName: original.counterpartyName,
      counterpartyNip: original.counterpartyNip,
      isCorrection: true,
      correctsTransactionId: original.id,
      correctionReason: input.reason,
      createdBy: this.ctx.session.userId,
    }).returning({ id: vatTransactions.id });

    // Update original transaction status
    await this.db.update(vatTransactions)
      .set({ status: 'CORRECTED', updatedAt: new Date() })
      .where(eq(vatTransactions.id, original.id));

    return {
      correctionId: correction.id,
      vatDifference: vatDiff,
    };
  }

  private async getCarryForward(clientId: string, year: number, month: number) {
    // Get the previous period's carry forward
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    return this.db.query.vatCarryForwards.findFirst({
      where: and(
        eq(vatCarryForwards.clientId, clientId),
        eq(vatCarryForwards.sourceYear, prevYear),
        eq(vatCarryForwards.sourceMonth, prevMonth),
        eq(vatCarryForwards.status, 'ACTIVE'),
      ),
    });
  }
}
```

### API Endpoints (tRPC)

```typescript
// src/server/api/routers/vat-calculation.ts
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

const vatCalculationInputSchema = z.object({
  netAmount: z.string().optional(),
  grossAmount: z.string().optional(),
  vatRateCode: z.enum(['STANDARD', 'REDUCED_8', 'REDUCED_5', 'ZERO', 'EXEMPT', 'REVERSE_CHARGE']),
  currency: z.string().length(3).default('PLN'),
  exchangeRate: z.string().optional(),
  transactionDate: z.date(),
}).refine(data => data.netAmount || data.grossAmount, {
  message: 'Either netAmount or grossAmount must be provided',
});

const vatTransactionInputSchema = z.object({
  clientId: z.string().uuid(),
  documentId: z.string().uuid().optional(),
  transactionType: z.enum([
    'DOMESTIC_SALE', 'DOMESTIC_PURCHASE', 'WDT', 'WNT',
    'IMPORT_GOODS', 'IMPORT_SERVICES', 'EXPORT', 'OSS_SALE', 'REVERSE_CHARGE'
  ]),
  netAmount: z.string(),
  vatRateCode: z.string(),
  currency: z.string().length(3).default('PLN'),
  exchangeRate: z.string().optional(),
  transactionDate: z.date(),
  periodYear: z.number().min(2020).max(2100),
  periodMonth: z.number().min(1).max(12),
  counterpartyName: z.string().max(500).optional(),
  counterpartyNip: z.string().max(20).optional(),
  counterpartyVatId: z.string().max(20).optional(),
  gtuCodes: z.array(z.string()).optional(),
  procedureCodes: z.array(z.string()).optional(),
});

export const vatCalculationRouter = createTRPCRouter({
  // Calculate VAT
  calculate: protectedProcedure
    .input(vatCalculationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new VATCalculationService(ctx.db, ctx.taxRatesService, ctx.viesService);

      if (input.netAmount) {
        return service.calculateFromNet(input);
      } else {
        return service.calculateFromGross(input);
      }
    }),

  // Record VAT transaction
  recordTransaction: protectedProcedure
    .input(vatTransactionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new VATCalculationService(ctx.db, ctx.taxRatesService, ctx.viesService);

      // Calculate VAT
      const calculation = await service.calculateFromNet({
        netAmount: input.netAmount,
        vatRateCode: input.vatRateCode,
        currency: input.currency,
        exchangeRate: input.exchangeRate,
        transactionDate: input.transactionDate,
      });

      // Determine VAT direction
      const vatDirection = ['DOMESTIC_PURCHASE', 'WNT', 'IMPORT_GOODS', 'IMPORT_SERVICES']
        .includes(input.transactionType) ? 'INPUT' : 'OUTPUT';

      // Create transaction
      const [transaction] = await ctx.db.insert(vatTransactions).values({
        organizationId: ctx.session.organizationId,
        clientId: input.clientId,
        documentId: input.documentId,
        transactionType: input.transactionType,
        vatDirection,
        netAmount: calculation.netAmount.toString(),
        vatRateCode: input.vatRateCode,
        vatRateValue: calculation.vatRate.toString(),
        vatAmount: calculation.vatAmount.toString(),
        grossAmount: calculation.grossAmount.toString(),
        currency: input.currency,
        exchangeRate: input.exchangeRate || '1.000000',
        netAmountPln: calculation.netAmountPLN.toString(),
        vatAmountPln: calculation.vatAmountPLN.toString(),
        grossAmountPln: calculation.grossAmountPLN.toString(),
        taxPeriodYear: input.periodYear,
        taxPeriodMonth: input.periodMonth,
        transactionDate: input.transactionDate,
        counterpartyName: input.counterpartyName,
        counterpartyNip: input.counterpartyNip,
        counterpartyVatId: input.counterpartyVatId,
        gtuCodes: input.gtuCodes,
        procedureCodes: input.procedureCodes,
        isEuTransaction: ['WDT', 'WNT', 'OSS_SALE'].includes(input.transactionType),
        createdBy: ctx.session.userId,
      }).returning({ id: vatTransactions.id });

      await ctx.auditLog.log({
        action: 'VAT_TRANSACTION_RECORDED',
        entityType: 'vat_transaction',
        entityId: transaction.id,
        details: {
          type: input.transactionType,
          netAmount: calculation.netAmount.toString(),
          vatAmount: calculation.vatAmount.toString(),
        },
      });

      return { id: transaction.id, ...calculation };
    }),

  // Get period settlement
  getSettlement: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      year: z.number().min(2020).max(2100),
      month: z.number().min(1).max(12),
    }))
    .query(async ({ ctx, input }) => {
      const service = new VATCalculationService(ctx.db, ctx.taxRatesService, ctx.viesService);
      return service.calculateSettlement(input);
    }),

  // Process WNT
  processWNT: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      supplierVatId: z.string().min(8).max(20),
      netAmount: z.string(),
      currency: z.string().length(3),
      exchangeRate: z.string(),
      transactionDate: z.date(),
      periodYear: z.number(),
      periodMonth: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new VATCalculationService(ctx.db, ctx.taxRatesService, ctx.viesService);
      return service.processWNT(input);
    }),

  // Process WDT
  processWDT: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      customerVatId: z.string().min(8).max(20),
      netAmount: z.string(),
      transactionDate: z.date(),
      periodYear: z.number(),
      periodMonth: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new VATCalculationService(ctx.db, ctx.taxRatesService, ctx.viesService);
      return service.processWDT(input);
    }),

  // Verify EU VAT ID
  verifyEuVatId: protectedProcedure
    .input(z.object({
      vatId: z.string().min(8).max(20),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.viesService.verifyVatId(input.vatId);
    }),

  // Create correction
  createCorrection: protectedProcedure
    .input(z.object({
      originalTransactionId: z.string().uuid(),
      netAmountDifference: z.string(),
      reason: z.string().min(10).max(500),
      correctionDate: z.date(),
      periodYear: z.number(),
      periodMonth: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new VATCalculationService(ctx.db, ctx.taxRatesService, ctx.viesService);
      return service.createCorrection(input);
    }),

  // Get transactions for period
  getTransactions: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      year: z.number(),
      month: z.number(),
      type: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.vatTransactions.findMany({
        where: and(
          eq(vatTransactions.clientId, input.clientId),
          eq(vatTransactions.taxPeriodYear, input.year),
          eq(vatTransactions.taxPeriodMonth, input.month),
          input.type ? eq(vatTransactions.transactionType, input.type) : undefined,
        ),
        orderBy: [desc(vatTransactions.transactionDate)],
      });
    }),
});
```

---

## Test Specifications

### Unit Tests

```typescript
// src/server/services/__tests__/vat-calculation.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import { VATCalculationService } from '../vat-calculation.service';

describe('VATCalculationService', () => {
  let service: VATCalculationService;
  let mockDb: any;
  let mockTaxRatesService: any;

  beforeEach(() => {
    mockTaxRatesService = {
      getVATRate: vi.fn(),
    };
    mockDb = {
      query: { vatTransactions: { findMany: vi.fn() } },
    };
    service = new VATCalculationService(mockDb, mockTaxRatesService, null);
  });

  describe('calculateFromNet', () => {
    it('should calculate VAT at 23%', async () => {
      mockTaxRatesService.getVATRate.mockResolvedValue({ rateValue: '23.00' });

      const result = await service.calculateFromNet({
        netAmount: '1000.00',
        vatRateCode: 'STANDARD',
        transactionDate: new Date(),
      });

      expect(result.netAmount.toString()).toBe('1000');
      expect(result.vatAmount.toString()).toBe('230');
      expect(result.grossAmount.toString()).toBe('1230');
    });

    it('should calculate VAT at 8%', async () => {
      mockTaxRatesService.getVATRate.mockResolvedValue({ rateValue: '8.00' });

      const result = await service.calculateFromNet({
        netAmount: '500.00',
        vatRateCode: 'REDUCED_8',
        transactionDate: new Date(),
      });

      expect(result.vatAmount.toString()).toBe('40');
      expect(result.grossAmount.toString()).toBe('540');
    });

    it('should handle zero-rated transactions', async () => {
      mockTaxRatesService.getVATRate.mockResolvedValue({ rateValue: '0.00' });

      const result = await service.calculateFromNet({
        netAmount: '5000.00',
        vatRateCode: 'ZERO',
        transactionDate: new Date(),
      });

      expect(result.vatAmount.toString()).toBe('0');
      expect(result.grossAmount.toString()).toBe('5000');
    });

    it('should convert foreign currency to PLN', async () => {
      mockTaxRatesService.getVATRate.mockResolvedValue({ rateValue: '23.00' });

      const result = await service.calculateFromNet({
        netAmount: '1000.00',
        vatRateCode: 'STANDARD',
        currency: 'EUR',
        exchangeRate: '4.50',
        transactionDate: new Date(),
      });

      expect(result.netAmountPLN.toString()).toBe('4500');
      expect(result.vatAmountPLN.toString()).toBe('1035');
      expect(result.grossAmountPLN.toString()).toBe('5535');
    });

    it('should round to 2 decimal places correctly', async () => {
      mockTaxRatesService.getVATRate.mockResolvedValue({ rateValue: '23.00' });

      const result = await service.calculateFromNet({
        netAmount: '123.45',
        vatRateCode: 'STANDARD',
        transactionDate: new Date(),
      });

      // 123.45 * 0.23 = 28.3935 -> rounded to 28.39
      expect(result.vatAmount.toString()).toBe('28.39');
      expect(result.grossAmount.toString()).toBe('151.84');
    });
  });

  describe('calculateFromGross', () => {
    it('should calculate backwards from gross at 23%', async () => {
      mockTaxRatesService.getVATRate.mockResolvedValue({ rateValue: '23.00' });

      const result = await service.calculateFromGross({
        grossAmount: '1230.00',
        vatRateCode: 'STANDARD',
        transactionDate: new Date(),
      });

      expect(result.netAmount.toString()).toBe('1000');
      expect(result.vatAmount.toString()).toBe('230');
    });

    it('should handle complex gross amounts', async () => {
      mockTaxRatesService.getVATRate.mockResolvedValue({ rateValue: '23.00' });

      const result = await service.calculateFromGross({
        grossAmount: '151.84',
        vatRateCode: 'STANDARD',
        transactionDate: new Date(),
      });

      // 151.84 / 1.23 = 123.4471... -> 123.45
      expect(result.netAmount.toString()).toBe('123.45');
    });
  });

  describe('calculateSettlement', () => {
    it('should calculate VAT due when output > input', async () => {
      mockDb.query.vatTransactions.findMany.mockResolvedValue([
        { vatDirection: 'OUTPUT', vatAmountPln: '2300', vatRateCode: 'STANDARD', transactionType: 'DOMESTIC_SALE' },
        { vatDirection: 'INPUT', vatAmountPln: '1150', vatRateCode: 'STANDARD', transactionType: 'DOMESTIC_PURCHASE' },
      ]);

      const result = await service.calculateSettlement({
        clientId: 'client-1',
        year: 2025,
        month: 1,
      });

      expect(result.outputVAT.total.toString()).toBe('2300');
      expect(result.inputVAT.total.toString()).toBe('1150');
      expect(result.settlement.finalVatDue.toString()).toBe('1150');
    });

    it('should calculate VAT refund when input > output', async () => {
      mockDb.query.vatTransactions.findMany.mockResolvedValue([
        { vatDirection: 'OUTPUT', vatAmountPln: '1000', vatRateCode: 'STANDARD', transactionType: 'DOMESTIC_SALE' },
        { vatDirection: 'INPUT', vatAmountPln: '3000', vatRateCode: 'STANDARD', transactionType: 'DOMESTIC_PURCHASE' },
      ]);

      const result = await service.calculateSettlement({
        clientId: 'client-1',
        year: 2025,
        month: 1,
      });

      expect(result.settlement.finalVatRefund.toString()).toBe('2000');
    });
  });
});
```

### Integration Tests

```typescript
// src/server/api/routers/__tests__/vat-calculation.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, cleanupTestData } from '@/test/helpers';

describe('VAT Calculation Router Integration', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    await ctx.seedTestData();
  });

  afterAll(async () => {
    await cleanupTestData(ctx);
  });

  describe('calculate', () => {
    it('should calculate VAT correctly for all rate types', async () => {
      const testCases = [
        { netAmount: '1000', vatRateCode: 'STANDARD', expectedVat: '230.00' },
        { netAmount: '1000', vatRateCode: 'REDUCED_8', expectedVat: '80.00' },
        { netAmount: '1000', vatRateCode: 'REDUCED_5', expectedVat: '50.00' },
        { netAmount: '1000', vatRateCode: 'ZERO', expectedVat: '0.00' },
      ];

      for (const tc of testCases) {
        const result = await ctx.caller.vatCalculation.calculate({
          netAmount: tc.netAmount,
          vatRateCode: tc.vatRateCode,
          transactionDate: new Date(),
        });

        expect(result.vatAmount.toString()).toBe(tc.expectedVat);
      }
    });
  });

  describe('recordTransaction', () => {
    it('should record domestic sale transaction', async () => {
      const result = await ctx.caller.vatCalculation.recordTransaction({
        clientId: ctx.testClient.id,
        transactionType: 'DOMESTIC_SALE',
        netAmount: '10000',
        vatRateCode: 'STANDARD',
        transactionDate: new Date(),
        periodYear: 2025,
        periodMonth: 1,
        counterpartyName: 'Test Buyer',
        counterpartyNip: '1234567890',
      });

      expect(result.id).toBeDefined();
      expect(result.vatAmount.toString()).toBe('2300');

      // Verify in database
      const saved = await ctx.db.query.vatTransactions.findFirst({
        where: eq(vatTransactions.id, result.id),
      });

      expect(saved).toBeDefined();
      expect(saved.vatDirection).toBe('OUTPUT');
      expect(saved.vatAmountPln).toBe('2300.00');
    });
  });

  describe('processWNT', () => {
    it('should process WNT with valid EU VAT ID', async () => {
      // Mock VIES service to return valid
      vi.spyOn(ctx.viesService, 'verifyVatId').mockResolvedValue({
        valid: true,
        name: 'German Company GmbH',
        address: 'Berlin, Germany',
      });

      const result = await ctx.caller.vatCalculation.processWNT({
        clientId: ctx.testClient.id,
        supplierVatId: 'DE123456789',
        netAmount: '5000',
        currency: 'EUR',
        exchangeRate: '4.50',
        transactionDate: new Date(),
        periodYear: 2025,
        periodMonth: 1,
      });

      expect(result.transactionId).toBeDefined();
      // 5000 EUR * 4.50 * 0.23 = 5175 PLN
      expect(result.vatAmountPLN.toString()).toBe('5175');

      // Verify transaction has BOTH direction (input and output)
      const saved = await ctx.db.query.vatTransactions.findFirst({
        where: eq(vatTransactions.id, result.transactionId),
      });
      expect(saved.vatDirection).toBe('BOTH');
      expect(saved.isEuTransaction).toBe(true);
    });

    it('should reject WNT with invalid EU VAT ID', async () => {
      vi.spyOn(ctx.viesService, 'verifyVatId').mockResolvedValue({
        valid: false,
      });

      await expect(
        ctx.caller.vatCalculation.processWNT({
          clientId: ctx.testClient.id,
          supplierVatId: 'DE000000000',
          netAmount: '5000',
          currency: 'EUR',
          exchangeRate: '4.50',
          transactionDate: new Date(),
          periodYear: 2025,
          periodMonth: 1,
        })
      ).rejects.toThrow('Invalid EU VAT ID');
    });
  });

  describe('getSettlement', () => {
    it('should calculate correct settlement with multiple transactions', async () => {
      // Create test transactions
      await ctx.caller.vatCalculation.recordTransaction({
        clientId: ctx.testClient.id,
        transactionType: 'DOMESTIC_SALE',
        netAmount: '10000',
        vatRateCode: 'STANDARD',
        transactionDate: new Date(),
        periodYear: 2025,
        periodMonth: 2,
      });

      await ctx.caller.vatCalculation.recordTransaction({
        clientId: ctx.testClient.id,
        transactionType: 'DOMESTIC_PURCHASE',
        netAmount: '6000',
        vatRateCode: 'STANDARD',
        transactionDate: new Date(),
        periodYear: 2025,
        periodMonth: 2,
      });

      const settlement = await ctx.caller.vatCalculation.getSettlement({
        clientId: ctx.testClient.id,
        year: 2025,
        month: 2,
      });

      // Output: 10000 * 23% = 2300
      // Input: 6000 * 23% = 1380
      // Due: 2300 - 1380 = 920
      expect(settlement.outputVAT.rate23.toString()).toBe('2300');
      expect(settlement.inputVAT.deductible.toString()).toBe('1380');
      expect(settlement.settlement.finalVatDue.toString()).toBe('920');
    });
  });
});
```

---

## Security Checklist

- [x] All VAT calculations use Decimal.js for precision
- [x] Transaction data isolated by organization_id via RLS
- [x] EU VAT ID verification via official VIES API
- [x] Audit logging for all VAT transactions
- [x] Input validation with Zod schemas
- [x] Rate limiting on VIES API calls
- [x] Exchange rates from trusted sources (NBP)
- [x] No direct SQL - using ORM only

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `VAT_TRANSACTION_RECORDED` | New transaction | type, amounts, counterparty |
| `VAT_CALCULATION_PERFORMED` | VAT calculated | input, output, rate |
| `VAT_SETTLEMENT_CALCULATED` | Period settlement | period, totals, due/refund |
| `EU_VAT_ID_VERIFIED` | VIES check | vat_id, result, timestamp |
| `VAT_CORRECTION_CREATED` | Correction invoice | original_id, difference |
| `VAT_CARRY_FORWARD_APPLIED` | Offset used | amount, source_period |

---

## Performance Requirements

| Operation | Target | Max |
|-----------|--------|-----|
| Single VAT calculation | <50ms | 100ms |
| Period settlement | <500ms | 2s |
| Transaction recording | <200ms | 500ms |
| VIES verification | <2s | 5s |
| Settlement export | <1s | 3s |

---

## Dependencies

- **TAX-001**: Client tax configuration (VAT payer status)
- **TAX-002**: Tax rates reference
- **ACC**: Journal entries for posting
- **External**: VIES API, NBP exchange rates

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] Database schema implemented with RLS
- [ ] VAT calculation service with Decimal.js
- [ ] tRPC endpoints for all operations
- [ ] VIES integration for EU VAT ID verification
- [ ] WNT/WDT processing with proper VAT direction
- [ ] Correction handling with reference tracking
- [ ] Carry-forward tracking
- [ ] Unit test coverage ≥85%
- [ ] Integration tests passing
- [ ] Security checklist completed
- [ ] Audit logging implemented
- [ ] Performance benchmarks met
- [ ] Code review approved

---

*Story created: December 2024*
*Last updated: December 2024*
