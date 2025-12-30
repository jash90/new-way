# Story: JPK File Generation (TAX-007)

> **Story ID**: TAX-007
> **Epic**: Tax Compliance Module (TAX)
> **Priority**: P0 (Critical)
> **Points**: 13
> **Status**: 📋 Ready for Development
> **Sprint**: Week 14

---

## 📋 User Story

**As an** accountant,
**I want** to generate JPK (Jednolity Plik Kontrolny) files automatically,
**So that** I can submit required tax data to Polish tax authorities in compliance with regulations.

---

## 🎯 Acceptance Criteria

### Scenario 1: JPK_V7M Monthly VAT File Generation

```gherkin
Feature: JPK_V7M Monthly VAT File Generation
  As an accountant
  I need to generate JPK_V7M files for monthly VAT payers
  So that I can submit accurate VAT declarations to tax authorities

  Background:
    Given the system has VAT transaction data for the period
    And client "ABC Sp. z o.o." is configured as monthly VAT payer
    And the client has NIP "1234567890"

  Scenario: Generate complete JPK_V7M file
    Given the following sales invoices exist for January 2025:
      | invoice_number | net_amount | vat_rate | vat_amount | buyer_nip   | sale_date  |
      | FV/2025/001    | 10000.00   | 23       | 2300.00    | 9876543210  | 2025-01-05 |
      | FV/2025/002    | 5000.00    | 8        | 400.00     | 8765432109  | 2025-01-10 |
      | FV/2025/003    | 2000.00    | 0        | 0.00       | PL123456789 | 2025-01-15 |
    And the following purchase invoices exist for January 2025:
      | invoice_number | net_amount | vat_rate | vat_amount | seller_nip | purchase_date |
      | KF/001/2025    | 3000.00    | 23       | 690.00     | 1111111111 | 2025-01-08    |
      | KF/002/2025    | 1000.00    | 8        | 80.00      | 2222222222 | 2025-01-12    |
    When I generate JPK_V7M for period "2025-01"
    Then the file should contain valid XML structure
    And the Naglowek section should include:
      | field           | value                              |
      | KodFormularza   | JPK_VAT                            |
      | WariantFormularza | 2                                |
      | DataWytworzeniaJPK | current timestamp               |
      | NazwaSystemu    | KsięgowaCRM                        |
      | CelZlozenia     | 1                                  |
    And the Podmiot1 section should include client NIP "1234567890"
    And the Deklaracja section should contain:
      | field    | value    |
      | P_38     | 17000.00 | # Net sales 23%+8%+0%
      | P_39     | 2700.00  | # Output VAT 23%+8%
      | P_46     | 4000.00  | # Net purchases
      | P_47     | 770.00   | # Input VAT
      | P_51     | 1930.00  | # VAT due (2700-770)
    And the SprzedazWiersz section should contain 3 records
    And the ZakupWiersz section should contain 2 records

  Scenario: Apply GTU codes to sales records
    Given a sales invoice with goods from GTU_01 category (alcoholic beverages)
    When I generate JPK_V7M
    Then the SprzedazWiersz for that invoice should have GTU_01="1"

  Scenario: Apply procedure codes to transactions
    Given a sales invoice marked as MPP (split payment mandatory)
    And the invoice amount exceeds 15000 PLN
    When I generate JPK_V7M
    Then the SprzedazWiersz should have MPP="1"

  Scenario: Handle corrective JPK_V7M
    Given a JPK_V7M was previously submitted for period "2025-01"
    And corrections are needed for invoice "FV/2025/001"
    When I generate corrective JPK_V7M with CelZlozenia="2"
    Then the file should include all original data plus corrections
    And the system should track the correction reference
```

### Scenario 2: JPK_V7K Quarterly VAT File Generation

```gherkin
Feature: JPK_V7K Quarterly VAT File Generation
  As an accountant
  I need to generate JPK_V7K files for quarterly VAT payers
  So that small taxpayers can submit VAT declarations quarterly

  Background:
    Given client "Mała Firma Jan Kowalski" is configured as quarterly VAT payer
    And the client qualifies as small taxpayer (revenue < 2M EUR)

  Scenario: Generate JPK_V7K for Q1
    Given VAT transactions exist for January, February, and March 2025
    When I generate JPK_V7K for period "2025-Q1"
    Then the file should aggregate data from all 3 months
    And the Deklaracja section should show quarterly totals
    And the Ewidencja sections should contain monthly records with proper dates

  Scenario: Quarterly payer monthly records submission
    Given it is mid-quarter (February)
    When I generate JPK_V7K monthly records only
    Then only Ewidencja sections should be generated
    And Deklaracja section should be omitted
    And the file should be marked as partial submission
```

### Scenario 3: JPK_FA Invoice File Generation

```gherkin
Feature: JPK_FA Invoice File On-Demand Generation
  As an accountant
  I need to generate JPK_FA files when requested by tax authorities
  So that I can provide detailed invoice data for audits

  Scenario: Generate JPK_FA for audit period
    Given a tax authority request for invoices from "2024-01-01" to "2024-12-31"
    And the client has 500 invoices in that period
    When I generate JPK_FA for the requested period
    Then the file should contain all 500 invoices in Faktura elements
    And each Faktura should include:
      | field              | description                    |
      | P_1                | Invoice date                   |
      | P_2A               | Invoice number                 |
      | P_3A/P_3B          | Seller name                    |
      | P_3C               | Seller address                 |
      | P_4A/P_4B          | Buyer name                     |
      | P_5                | Buyer NIP                      |
      | P_13_1 through P_13_7 | Net amounts by VAT rate     |
      | P_14_1 through P_14_5 | VAT amounts by rate         |
      | P_15               | Total gross amount             |
    And FakturaWiersz elements should contain line items
    And the file should be sorted chronologically

  Scenario: Generate JPK_FA with RO (annual summary invoices)
    Given the client issues annual summary invoices (faktura zbiorcza)
    When I generate JPK_FA including RO invoices
    Then RO invoices should be marked with RodzajFaktury="RO"
    And linked detailed invoices should be referenced
```

### Scenario 4: JPK_KR Accounting Books Generation

```gherkin
Feature: JPK_KR Accounting Books On-Demand Generation
  As an accountant
  I need to generate JPK_KR files when requested by tax authorities
  So that I can provide general ledger data for audits

  Scenario: Generate JPK_KR for fiscal year
    Given a tax authority request for accounting books for year 2024
    And the client uses full accounting (pełna księgowość)
    When I generate JPK_KR for period "2024"
    Then the file should contain:
      | section     | description                     |
      | ZOiS        | Journal entries summary         |
      | Dziennik    | Complete journal with entries   |
      | KontoZapis  | Account-level transactions      |
      | Ctrl        | Control sums and validation     |
    And all journal entries should be balanced (debit = credit)
    And account codes should match Polish chart of accounts (zespoły 0-9)

  Scenario: Validate accounting period integrity
    Given the accounting year 2024 is not yet closed
    When I attempt to generate JPK_KR for 2024
    Then the system should warn about open period
    And offer option to generate with "draft" status
    And include only posted entries
```

### Scenario 5: XSD Schema Validation

```gherkin
Feature: JPK XSD Schema Validation
  As an accountant
  I need JPK files to be validated against official XSD schemas
  So that submissions are accepted by tax authorities

  Scenario: Validate JPK_V7M against current schema
    Given I have generated a JPK_V7M file
    When the system validates against official JPK_V7M XSD schema (v2)
    Then validation should pass without errors
    And all required elements should be present
    And all data types should match schema definitions

  Scenario: Handle validation errors
    Given a JPK_V7M file with invalid NIP format
    When the system validates the file
    Then validation should fail
    And error message should specify:
      | field    | error                              |
      | NIP      | Invalid format - must be 10 digits |
    And the file should not be marked as ready for submission

  Scenario: Schema version compatibility
    Given a new XSD schema version is released by Ministry of Finance
    When the system detects schema update
    Then it should download and store the new schema
    And notify administrators about the change
    And continue supporting previous schema for transition period
```

### Scenario 6: Digital Signature Support

```gherkin
Feature: JPK Digital Signature Support
  As an accountant
  I need to sign JPK files with qualified electronic signatures
  So that they are legally valid for submission

  Scenario: Sign JPK file with qualified signature
    Given a validated JPK_V7M file is ready
    And the user has a qualified electronic signature (Profil Zaufany or Podpis Kwalifikowany)
    When I request to sign the file
    Then the system should:
      | step | action                                      |
      | 1    | Generate XAdES-BES signature envelope       |
      | 2    | Hash the JPK content using SHA-256          |
      | 3    | Connect to signature provider               |
      | 4    | Apply user's qualified signature            |
      | 5    | Embed signature in XML structure            |
    And the signed file should be stored securely
    And signature verification should pass

  Scenario: Support Profil Zaufany signature
    Given the user chooses to sign via Profil Zaufany (ePUAP)
    When I initiate the signing process
    Then the system should redirect to login.gov.pl
    And after authentication, signature should be applied
    And the file should be marked as signed with PZ

  Scenario: Verify existing signature
    Given a signed JPK file exists
    When I request signature verification
    Then the system should validate:
      | check                  | result   |
      | Signature integrity    | valid    |
      | Certificate validity   | valid    |
      | Certificate chain      | trusted  |
      | Timestamp              | verified |
    And display verification status to user
```

### Scenario 7: Generation Performance

```gherkin
Feature: JPK Generation Performance
  As an accountant
  I need JPK files to be generated quickly
  So that monthly submissions don't impact productivity

  Scenario: Generate large JPK_V7M efficiently
    Given a client with 10,000 transactions per month
    When I generate JPK_V7M
    Then generation should complete within 5 seconds
    And memory usage should not exceed 500MB
    And the file should be streamed to storage progressively

  Scenario: Batch generation for multiple clients
    Given 50 clients require JPK_V7M generation
    When I initiate batch generation
    Then files should be generated in parallel (max 5 concurrent)
    And progress should be reported for each client
    And failures should not stop other generations
    And summary report should be available after completion
```

---

## 🗄️ Database Schema

```sql
-- JPK file types enumeration
CREATE TYPE jpk_type AS ENUM (
  'JPK_V7M',    -- Monthly VAT declaration
  'JPK_V7K',    -- Quarterly VAT declaration
  'JPK_FA',     -- Invoices on demand
  'JPK_KR',     -- Accounting books on demand
  'JPK_WB',     -- Bank statements on demand
  'JPK_MAG',    -- Warehouse records on demand
  'JPK_EWP'     -- Revenue/expense ledger on demand
);

-- JPK file status
CREATE TYPE jpk_status AS ENUM (
  'DRAFT',           -- Being prepared
  'GENERATED',       -- XML generated
  'VALIDATED',       -- XSD validation passed
  'SIGNED',          -- Digitally signed
  'SUBMITTED',       -- Sent to tax authority
  'ACCEPTED',        -- UPO received
  'REJECTED',        -- Rejected by authority
  'CORRECTED'        -- Replaced by correction
);

-- JPK submission purpose
CREATE TYPE jpk_cel_zlozenia AS ENUM (
  '1',  -- Original submission
  '2'   -- Correction
);

-- Main JPK files table
CREATE TABLE jpk_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID NOT NULL REFERENCES clients(id),

  -- File identification
  jpk_type jpk_type NOT NULL,
  reference_number VARCHAR(50) NOT NULL,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,

  -- Submission details
  cel_zlozenia jpk_cel_zlozenia NOT NULL DEFAULT '1',
  corrects_jpk_id UUID REFERENCES jpk_files(id),

  -- Status tracking
  status jpk_status NOT NULL DEFAULT 'DRAFT',

  -- File storage
  file_path VARCHAR(500),
  file_size_bytes BIGINT,
  file_hash_sha256 VARCHAR(64),

  -- Validation
  xsd_schema_version VARCHAR(20) NOT NULL,
  validation_errors JSONB,
  validated_at TIMESTAMPTZ,

  -- Signature
  signature_type VARCHAR(50), -- 'PROFIL_ZAUFANY', 'PODPIS_KWALIFIKOWANY'
  signed_at TIMESTAMPTZ,
  signed_by UUID REFERENCES users(id),
  signature_data BYTEA,

  -- Submission tracking
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES users(id),
  upo_reference VARCHAR(100),
  upo_received_at TIMESTAMPTZ,
  upo_document_path VARCHAR(500),

  -- Summary data (denormalized for quick access)
  total_records INTEGER NOT NULL DEFAULT 0,
  summary_data JSONB NOT NULL DEFAULT '{}',

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_jpk_reference UNIQUE (organization_id, reference_number)
);

-- GTU (Grupy Towarów i Usług) codes for JPK_V7
CREATE TABLE gtu_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) NOT NULL UNIQUE, -- GTU_01 through GTU_13
  name VARCHAR(200) NOT NULL,
  description TEXT,
  effective_from DATE NOT NULL,
  effective_to DATE,
  pkwiu_codes TEXT[], -- Related PKWiU codes
  cn_codes TEXT[], -- Related CN codes
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Procedure codes for JPK_V7
CREATE TABLE procedure_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) NOT NULL UNIQUE, -- SW, EE, TP, TT_WNT, TT_D, MR_T, etc.
  name VARCHAR(200) NOT NULL,
  description TEXT,
  applies_to VARCHAR(20) NOT NULL, -- 'SALES', 'PURCHASES', 'BOTH'
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- JPK_V7 sales records (SprzedazWiersz)
CREATE TABLE jpk_v7_sales_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jpk_file_id UUID NOT NULL REFERENCES jpk_files(id) ON DELETE CASCADE,

  -- Record identification
  lp INTEGER NOT NULL, -- Line number

  -- Counterparty data
  kod_kraju_nadania_tin VARCHAR(2),
  nr_kontrahenta VARCHAR(50), -- Buyer NIP or EU VAT number
  nazwa_kontrahenta VARCHAR(256),

  -- Document data
  dowod_sprzedazy VARCHAR(256) NOT NULL, -- Invoice number
  data_wystawienia DATE NOT NULL,
  data_sprzedazy DATE,
  typ_dokumentu VARCHAR(10), -- RO, WEW, FP

  -- GTU codes (boolean flags)
  gtu_01 BOOLEAN DEFAULT false,
  gtu_02 BOOLEAN DEFAULT false,
  gtu_03 BOOLEAN DEFAULT false,
  gtu_04 BOOLEAN DEFAULT false,
  gtu_05 BOOLEAN DEFAULT false,
  gtu_06 BOOLEAN DEFAULT false,
  gtu_07 BOOLEAN DEFAULT false,
  gtu_08 BOOLEAN DEFAULT false,
  gtu_09 BOOLEAN DEFAULT false,
  gtu_10 BOOLEAN DEFAULT false,
  gtu_12 BOOLEAN DEFAULT false,
  gtu_13 BOOLEAN DEFAULT false,

  -- Procedure codes (boolean flags)
  sw BOOLEAN DEFAULT false,    -- Delivery as part of mail order
  ee BOOLEAN DEFAULT false,    -- Telecommunications/broadcasting/electronic services
  tp BOOLEAN DEFAULT false,    -- Related party transaction
  tt_wnt BOOLEAN DEFAULT false,
  tt_d BOOLEAN DEFAULT false,
  mr_t BOOLEAN DEFAULT false,
  mr_uz BOOLEAN DEFAULT false,
  i_42 BOOLEAN DEFAULT false,
  i_63 BOOLEAN DEFAULT false,
  b_spv BOOLEAN DEFAULT false,
  b_spv_dostawa BOOLEAN DEFAULT false,
  b_mpv_prowizja BOOLEAN DEFAULT false,
  mpp BOOLEAN DEFAULT false,   -- Split payment (MPP)

  -- Amounts by rate
  k_10 DECIMAL(15,2) DEFAULT 0, -- Net amount 23%
  k_11 DECIMAL(15,2) DEFAULT 0, -- VAT 23%
  k_12 DECIMAL(15,2) DEFAULT 0, -- Net amount 8%
  k_13 DECIMAL(15,2) DEFAULT 0, -- VAT 8%
  k_14 DECIMAL(15,2) DEFAULT 0, -- Net amount 5%
  k_15 DECIMAL(15,2) DEFAULT 0, -- VAT 5%
  k_16 DECIMAL(15,2) DEFAULT 0, -- Net amount 0%
  k_17 DECIMAL(15,2) DEFAULT 0, -- Export net
  k_18 DECIMAL(15,2) DEFAULT 0, -- WDT net
  k_19 DECIMAL(15,2) DEFAULT 0, -- VAT exempt net
  k_20 DECIMAL(15,2) DEFAULT 0, -- ZW net

  -- Source reference
  source_invoice_id UUID REFERENCES invoices(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- JPK_V7 purchase records (ZakupWiersz)
CREATE TABLE jpk_v7_purchase_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jpk_file_id UUID NOT NULL REFERENCES jpk_files(id) ON DELETE CASCADE,

  -- Record identification
  lp INTEGER NOT NULL,

  -- Counterparty data
  kod_kraju_nadania_tin VARCHAR(2),
  nr_dostawcy VARCHAR(50), -- Seller NIP or EU VAT number
  nazwa_dostawcy VARCHAR(256),

  -- Document data
  dowod_zakupu VARCHAR(256) NOT NULL,
  data_zakupu DATE NOT NULL,
  data_wplywu DATE,

  -- Document type codes
  mpp BOOLEAN DEFAULT false,   -- Split payment
  imp BOOLEAN DEFAULT false,   -- Import

  -- Amounts
  k_40 DECIMAL(15,2) DEFAULT 0, -- Net amount acquisitions
  k_41 DECIMAL(15,2) DEFAULT 0, -- VAT acquisitions
  k_42 DECIMAL(15,2) DEFAULT 0, -- Net amount other
  k_43 DECIMAL(15,2) DEFAULT 0, -- VAT other (deductible)
  k_44 DECIMAL(15,2) DEFAULT 0, -- Net amount fixed assets
  k_45 DECIMAL(15,2) DEFAULT 0, -- VAT fixed assets
  k_46 DECIMAL(15,2) DEFAULT 0, -- VAT correction (+)
  k_47 DECIMAL(15,2) DEFAULT 0, -- VAT correction (-)

  -- Source reference
  source_invoice_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- JPK_V7 declaration data (Deklaracja section)
CREATE TABLE jpk_v7_declarations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jpk_file_id UUID NOT NULL REFERENCES jpk_files(id) ON DELETE CASCADE,

  -- Period
  rok INTEGER NOT NULL,
  miesiac INTEGER, -- NULL for quarterly
  kwartal INTEGER, -- NULL for monthly

  -- Sales section
  p_10 DECIMAL(15,2) DEFAULT 0, -- Taxable sales 23% net
  p_11 DECIMAL(15,2) DEFAULT 0, -- Taxable sales 23% VAT
  p_12 DECIMAL(15,2) DEFAULT 0, -- Taxable sales 8% net
  p_13 DECIMAL(15,2) DEFAULT 0, -- Taxable sales 8% VAT
  p_14 DECIMAL(15,2) DEFAULT 0, -- Taxable sales 5% net
  p_15 DECIMAL(15,2) DEFAULT 0, -- Taxable sales 5% VAT
  p_16 DECIMAL(15,2) DEFAULT 0, -- 0% sales net
  p_17 DECIMAL(15,2) DEFAULT 0, -- Export net
  p_18 DECIMAL(15,2) DEFAULT 0, -- WDT net
  p_19 DECIMAL(15,2) DEFAULT 0, -- VAT exempt net
  p_20 DECIMAL(15,2) DEFAULT 0, -- ZW sales net

  -- Special transactions
  p_21 DECIMAL(15,2) DEFAULT 0, -- WNT net
  p_22 DECIMAL(15,2) DEFAULT 0, -- WNT VAT
  p_23 DECIMAL(15,2) DEFAULT 0, -- Import services net
  p_24 DECIMAL(15,2) DEFAULT 0, -- Import services VAT
  p_25 DECIMAL(15,2) DEFAULT 0, -- Import goods net
  p_26 DECIMAL(15,2) DEFAULT 0, -- Import goods VAT
  p_27 DECIMAL(15,2) DEFAULT 0, -- Reverse charge net
  p_28 DECIMAL(15,2) DEFAULT 0, -- Reverse charge VAT

  -- Totals
  p_37 DECIMAL(15,2) DEFAULT 0, -- Total net
  p_38 DECIMAL(15,2) DEFAULT 0, -- Total output VAT

  -- Purchases section
  p_39 DECIMAL(15,2) DEFAULT 0, -- Acquisitions net
  p_40 DECIMAL(15,2) DEFAULT 0, -- Acquisitions VAT (deductible)
  p_41 DECIMAL(15,2) DEFAULT 0, -- Other purchases net
  p_42 DECIMAL(15,2) DEFAULT 0, -- Other purchases VAT (deductible)
  p_43 DECIMAL(15,2) DEFAULT 0, -- Fixed assets net
  p_44 DECIMAL(15,2) DEFAULT 0, -- Fixed assets VAT (deductible)
  p_45 DECIMAL(15,2) DEFAULT 0, -- VAT corrections (+)
  p_46 DECIMAL(15,2) DEFAULT 0, -- VAT corrections (-)
  p_47 DECIMAL(15,2) DEFAULT 0, -- Total input VAT

  -- Settlement
  p_48 DECIMAL(15,2) DEFAULT 0, -- Carry-forward from previous
  p_49 DECIMAL(15,2) DEFAULT 0, -- VAT excess (output > input)
  p_50 DECIMAL(15,2) DEFAULT 0, -- VAT refund request
  p_51 DECIMAL(15,2) DEFAULT 0, -- VAT due to pay
  p_52 DECIMAL(15,2) DEFAULT 0, -- Carry-forward to next period
  p_53 DECIMAL(15,2) DEFAULT 0, -- VAT to refund (input > output)
  p_54 DECIMAL(15,2) DEFAULT 0, -- VAT to refund (accelerated)

  -- Refund details
  p_60 INTEGER, -- Refund term days (25/60/180)
  p_61 BOOLEAN DEFAULT false, -- Bank account declaration
  p_62 VARCHAR(26), -- Refund bank account (IBAN)

  -- Additional declarations
  p_63 BOOLEAN DEFAULT false, -- Taxable person ceased activity
  p_64 BOOLEAN DEFAULT false, -- No taxable transactions
  p_65 BOOLEAN DEFAULT false, -- Nil declaration
  p_66 BOOLEAN DEFAULT false, -- Records only (quarterly)
  p_67 BOOLEAN DEFAULT false, -- First declaration after registration
  p_68 DECIMAL(15,2) DEFAULT 0, -- Correction from previous periods

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- XSD schema versions tracking
CREATE TABLE jpk_xsd_schemas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jpk_type jpk_type NOT NULL,
  version VARCHAR(20) NOT NULL,
  schema_url VARCHAR(500) NOT NULL,
  schema_content TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_schema_version UNIQUE (jpk_type, version)
);

-- JPK generation audit log
CREATE TABLE jpk_generation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jpk_file_id UUID NOT NULL REFERENCES jpk_files(id),
  action VARCHAR(50) NOT NULL, -- 'GENERATED', 'VALIDATED', 'SIGNED', 'SUBMITTED', etc.
  status VARCHAR(20) NOT NULL, -- 'SUCCESS', 'FAILURE'
  details JSONB NOT NULL DEFAULT '{}',
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_jpk_files_org_client ON jpk_files(organization_id, client_id);
CREATE INDEX idx_jpk_files_period ON jpk_files(period_from, period_to);
CREATE INDEX idx_jpk_files_status ON jpk_files(status);
CREATE INDEX idx_jpk_files_type_period ON jpk_files(jpk_type, period_from);
CREATE INDEX idx_jpk_v7_sales_jpk_id ON jpk_v7_sales_records(jpk_file_id);
CREATE INDEX idx_jpk_v7_purchases_jpk_id ON jpk_v7_purchase_records(jpk_file_id);

-- Row Level Security
ALTER TABLE jpk_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE jpk_v7_sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE jpk_v7_purchase_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE jpk_v7_declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY jpk_files_org_isolation ON jpk_files
  FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY jpk_v7_sales_org_isolation ON jpk_v7_sales_records
  FOR ALL USING (
    jpk_file_id IN (
      SELECT id FROM jpk_files
      WHERE organization_id = current_setting('app.current_organization_id')::UUID
    )
  );

CREATE POLICY jpk_v7_purchases_org_isolation ON jpk_v7_purchase_records
  FOR ALL USING (
    jpk_file_id IN (
      SELECT id FROM jpk_files
      WHERE organization_id = current_setting('app.current_organization_id')::UUID
    )
  );

CREATE POLICY jpk_v7_declarations_org_isolation ON jpk_v7_declarations
  FOR ALL USING (
    jpk_file_id IN (
      SELECT id FROM jpk_files
      WHERE organization_id = current_setting('app.current_organization_id')::UUID
    )
  );
```

---

## 📝 Zod Validation Schemas

```typescript
import { z } from 'zod';

// JPK type enumeration
export const JPKTypeSchema = z.enum([
  'JPK_V7M',
  'JPK_V7K',
  'JPK_FA',
  'JPK_KR',
  'JPK_WB',
  'JPK_MAG',
  'JPK_EWP',
]);

export type JPKType = z.infer<typeof JPKTypeSchema>;

// JPK status enumeration
export const JPKStatusSchema = z.enum([
  'DRAFT',
  'GENERATED',
  'VALIDATED',
  'SIGNED',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'CORRECTED',
]);

export type JPKStatus = z.infer<typeof JPKStatusSchema>;

// Cel złożenia (submission purpose)
export const CelZlozeniaSchema = z.enum(['1', '2']);

// GTU codes schema
export const GTUCodesSchema = z.object({
  GTU_01: z.boolean().default(false), // Alcoholic beverages
  GTU_02: z.boolean().default(false), // Fuel
  GTU_03: z.boolean().default(false), // Heating oil
  GTU_04: z.boolean().default(false), // Tobacco
  GTU_05: z.boolean().default(false), // Waste
  GTU_06: z.boolean().default(false), // Electronics
  GTU_07: z.boolean().default(false), // Vehicles
  GTU_08: z.boolean().default(false), // Precious metals
  GTU_09: z.boolean().default(false), // Medicines
  GTU_10: z.boolean().default(false), // Buildings
  GTU_12: z.boolean().default(false), // Intangible services
  GTU_13: z.boolean().default(false), // Transport services
});

// Procedure codes schema
export const ProcedureCodesSchema = z.object({
  SW: z.boolean().default(false),    // Mail order sales
  EE: z.boolean().default(false),    // Electronic services
  TP: z.boolean().default(false),    // Related parties
  TT_WNT: z.boolean().default(false),
  TT_D: z.boolean().default(false),
  MR_T: z.boolean().default(false),
  MR_UZ: z.boolean().default(false),
  I_42: z.boolean().default(false),
  I_63: z.boolean().default(false),
  B_SPV: z.boolean().default(false),
  B_SPV_DOSTAWA: z.boolean().default(false),
  B_MPV_PROWIZJA: z.boolean().default(false),
  MPP: z.boolean().default(false),   // Split payment mandatory
  IMP: z.boolean().default(false),   // Import
});

// JPK generation request
export const GenerateJPKInputSchema = z.object({
  clientId: z.string().uuid(),
  jpkType: JPKTypeSchema,
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  celZlozenia: CelZlozeniaSchema.default('1'),
  correctsJpkId: z.string().uuid().optional(),
  options: z.object({
    includeDeclaration: z.boolean().default(true),
    validateBeforeGeneration: z.boolean().default(true),
    signAfterGeneration: z.boolean().default(false),
    signatureType: z.enum(['PROFIL_ZAUFANY', 'PODPIS_KWALIFIKOWANY']).optional(),
  }).optional(),
});

export type GenerateJPKInput = z.infer<typeof GenerateJPKInputSchema>;

// JPK V7 sales record
export const JPKV7SalesRecordSchema = z.object({
  lp: z.number().int().positive(),
  kodKrajuNadaniaTin: z.string().length(2).optional(),
  nrKontrahenta: z.string().max(50).optional(),
  nazwaKontrahenta: z.string().max(256).optional(),
  dowodSprzedazy: z.string().max(256),
  dataWystawienia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dataSprzedazy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  typDokumentu: z.enum(['RO', 'WEW', 'FP']).optional(),
  gtuCodes: GTUCodesSchema.optional(),
  procedureCodes: ProcedureCodesSchema.optional(),
  amounts: z.object({
    K_10: z.number().default(0), // Net 23%
    K_11: z.number().default(0), // VAT 23%
    K_12: z.number().default(0), // Net 8%
    K_13: z.number().default(0), // VAT 8%
    K_14: z.number().default(0), // Net 5%
    K_15: z.number().default(0), // VAT 5%
    K_16: z.number().default(0), // Net 0%
    K_17: z.number().default(0), // Export net
    K_18: z.number().default(0), // WDT net
    K_19: z.number().default(0), // Exempt net
    K_20: z.number().default(0), // ZW net
  }),
  sourceInvoiceId: z.string().uuid().optional(),
});

// JPK V7 purchase record
export const JPKV7PurchaseRecordSchema = z.object({
  lp: z.number().int().positive(),
  kodKrajuNadaniaTin: z.string().length(2).optional(),
  nrDostawcy: z.string().max(50).optional(),
  nazwaDostawcy: z.string().max(256).optional(),
  dowodZakupu: z.string().max(256),
  dataZakupu: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dataWplywu: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mpp: z.boolean().default(false),
  imp: z.boolean().default(false),
  amounts: z.object({
    K_40: z.number().default(0), // Acquisitions net
    K_41: z.number().default(0), // Acquisitions VAT
    K_42: z.number().default(0), // Other net
    K_43: z.number().default(0), // Other VAT
    K_44: z.number().default(0), // Fixed assets net
    K_45: z.number().default(0), // Fixed assets VAT
    K_46: z.number().default(0), // Correction (+)
    K_47: z.number().default(0), // Correction (-)
  }),
  sourceInvoiceId: z.string().uuid().optional(),
});

// JPK V7 declaration
export const JPKV7DeclarationSchema = z.object({
  rok: z.number().int().min(2018).max(2100),
  miesiac: z.number().int().min(1).max(12).optional(),
  kwartal: z.number().int().min(1).max(4).optional(),

  // Sales totals
  P_10: z.number().default(0), // 23% net
  P_11: z.number().default(0), // 23% VAT
  P_12: z.number().default(0), // 8% net
  P_13: z.number().default(0), // 8% VAT
  P_14: z.number().default(0), // 5% net
  P_15: z.number().default(0), // 5% VAT
  P_16: z.number().default(0), // 0% net
  P_17: z.number().default(0), // Export
  P_18: z.number().default(0), // WDT
  P_19: z.number().default(0), // Exempt
  P_20: z.number().default(0), // ZW

  // Special transactions
  P_21: z.number().default(0), // WNT net
  P_22: z.number().default(0), // WNT VAT
  P_23: z.number().default(0), // Import services net
  P_24: z.number().default(0), // Import services VAT
  P_25: z.number().default(0), // Import goods net
  P_26: z.number().default(0), // Import goods VAT
  P_27: z.number().default(0), // Reverse charge net
  P_28: z.number().default(0), // Reverse charge VAT

  // Totals
  P_37: z.number().default(0), // Total net
  P_38: z.number().default(0), // Total output VAT

  // Purchases
  P_39: z.number().default(0), // Acquisitions net
  P_40: z.number().default(0), // Acquisitions VAT
  P_41: z.number().default(0), // Other net
  P_42: z.number().default(0), // Other VAT
  P_43: z.number().default(0), // Fixed assets net
  P_44: z.number().default(0), // Fixed assets VAT
  P_45: z.number().default(0), // Correction (+)
  P_46: z.number().default(0), // Correction (-)
  P_47: z.number().default(0), // Total input VAT

  // Settlement
  P_48: z.number().default(0), // Carry-forward
  P_49: z.number().default(0), // VAT excess
  P_50: z.number().default(0), // Refund request
  P_51: z.number().default(0), // VAT due
  P_52: z.number().default(0), // Carry to next
  P_53: z.number().default(0), // VAT refund
  P_54: z.number().default(0), // Accelerated refund

  // Refund options
  P_60: z.number().int().optional(),
  P_61: z.boolean().default(false),
  P_62: z.string().max(26).optional(),

  // Declarations
  P_63: z.boolean().default(false),
  P_64: z.boolean().default(false),
  P_65: z.boolean().default(false),
  P_66: z.boolean().default(false),
  P_67: z.boolean().default(false),
  P_68: z.number().default(0),
});

// Validation result
export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.object({
    field: z.string(),
    message: z.string(),
    severity: z.enum(['ERROR', 'WARNING']),
    line: z.number().optional(),
  })),
  warnings: z.array(z.object({
    field: z.string(),
    message: z.string(),
  })),
  schemaVersion: z.string(),
  validatedAt: z.string().datetime(),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// Sign JPK request
export const SignJPKInputSchema = z.object({
  jpkFileId: z.string().uuid(),
  signatureType: z.enum(['PROFIL_ZAUFANY', 'PODPIS_KWALIFIKOWANY']),
  returnUrl: z.string().url().optional(), // For Profil Zaufany redirect
});

// Submit JPK request
export const SubmitJPKInputSchema = z.object({
  jpkFileId: z.string().uuid(),
  testMode: z.boolean().default(false), // For e-Urząd test environment
});

// Batch generation request
export const BatchGenerateJPKInputSchema = z.object({
  clientIds: z.array(z.string().uuid()).min(1).max(100),
  jpkType: JPKTypeSchema,
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  options: z.object({
    maxConcurrent: z.number().int().min(1).max(10).default(5),
    stopOnError: z.boolean().default(false),
    autoValidate: z.boolean().default(true),
  }).optional(),
});
```

---

## ⚙️ Implementation

### JPK Generation Service

```typescript
import Decimal from 'decimal.js';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { createHash } from 'crypto';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from 'date-fns';
import { pl } from 'date-fns/locale';

// JPK XML namespaces
const JPK_NAMESPACES = {
  JPK_V7M: {
    xmlns: 'http://crd.gov.pl/wzor/2021/12/27/11148/',
    'xmlns:etd': 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2021/06/08/eD/DefinicjeTypy/',
    'xmlns:kck': 'http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2021/06/08/eD/KodyCechyKlucz686/'
  },
  // ... other types
};

// GTU code definitions
const GTU_DEFINITIONS: Record<string, { pkwiu: string[], cn: string[], description: string }> = {
  GTU_01: {
    pkwiu: ['11.01.1', '11.02', '11.03', '11.04', '11.05'],
    cn: ['2203', '2204', '2205', '2206', '2207', '2208'],
    description: 'Napoje alkoholowe'
  },
  GTU_02: {
    pkwiu: ['19.20.21', '19.20.22', '19.20.23', '19.20.24', '19.20.25'],
    cn: ['2710'],
    description: 'Paliwa'
  },
  GTU_03: {
    pkwiu: ['19.20.29'],
    cn: ['2710 19 43', '2710 19 46', '2710 19 47'],
    description: 'Oleje opałowe'
  },
  // ... more GTU codes
};

export class JPKGenerationService {
  constructor(
    private readonly db: Database,
    private readonly vatService: VATCalculationService,
    private readonly invoiceService: InvoiceService,
    private readonly storageService: StorageService,
    private readonly xsdValidator: XSDValidatorService,
    private readonly signatureService: SignatureService,
    private readonly auditService: AuditService
  ) {}

  /**
   * Generate JPK_V7M (monthly VAT) file
   */
  async generateJPKV7M(input: GenerateJPKInput): Promise<JPKGenerationResult> {
    const startTime = Date.now();

    // Validate period is single month
    const periodStart = new Date(input.periodFrom);
    const periodEnd = new Date(input.periodTo);

    if (periodStart.getMonth() !== periodEnd.getMonth()) {
      throw new JPKError('JPK_V7M requires single month period');
    }

    // Load client data
    const client = await this.db.client.findUniqueOrThrow({
      where: { id: input.clientId },
      include: {
        organization: true,
        taxConfiguration: true,
      },
    });

    // Validate client is monthly VAT payer
    if (client.taxConfiguration?.vatPeriod !== 'MONTHLY') {
      throw new JPKError('Client is not configured as monthly VAT payer');
    }

    // Create JPK file record
    const jpkFile = await this.db.jpkFile.create({
      data: {
        organizationId: client.organizationId,
        clientId: client.id,
        jpkType: 'JPK_V7M',
        referenceNumber: this.generateReferenceNumber('JPK_V7M', client.id, periodStart),
        periodFrom: periodStart,
        periodTo: periodEnd,
        celZlozenia: input.celZlozenia,
        correctsJpkId: input.correctsJpkId,
        status: 'DRAFT',
        xsdSchemaVersion: await this.getCurrentSchemaVersion('JPK_V7M'),
        createdBy: input.userId,
      },
    });

    try {
      // Fetch sales invoices
      const salesInvoices = await this.invoiceService.getInvoicesForPeriod({
        clientId: client.id,
        type: 'SALES',
        from: periodStart,
        to: periodEnd,
        status: ['POSTED', 'PAID'],
      });

      // Fetch purchase invoices
      const purchaseInvoices = await this.invoiceService.getInvoicesForPeriod({
        clientId: client.id,
        type: 'PURCHASE',
        from: periodStart,
        to: periodEnd,
        status: ['POSTED', 'PAID'],
      });

      // Process sales records
      const salesRecords = await this.processSalesRecords(jpkFile.id, salesInvoices);

      // Process purchase records
      const purchaseRecords = await this.processPurchaseRecords(jpkFile.id, purchaseInvoices);

      // Calculate declaration
      const declaration = await this.calculateDeclaration(
        client.id,
        periodStart.getFullYear(),
        periodStart.getMonth() + 1,
        salesRecords,
        purchaseRecords
      );

      // Build XML structure
      const xml = this.buildJPKV7MXML({
        client,
        jpkFile,
        salesRecords,
        purchaseRecords,
        declaration,
        includeDeclaration: input.options?.includeDeclaration !== false,
      });

      // Validate against XSD
      if (input.options?.validateBeforeGeneration !== false) {
        const validationResult = await this.xsdValidator.validate(
          xml,
          'JPK_V7M',
          jpkFile.xsdSchemaVersion
        );

        if (!validationResult.isValid) {
          await this.db.jpkFile.update({
            where: { id: jpkFile.id },
            data: {
              validationErrors: validationResult.errors,
              status: 'DRAFT',
            },
          });

          return {
            success: false,
            jpkFileId: jpkFile.id,
            validationErrors: validationResult.errors,
          };
        }

        await this.db.jpkFile.update({
          where: { id: jpkFile.id },
          data: {
            validatedAt: new Date(),
          },
        });
      }

      // Calculate file hash
      const fileHash = createHash('sha256').update(xml).digest('hex');

      // Store XML file
      const filePath = await this.storageService.storeJPKFile(
        jpkFile.id,
        xml,
        `${jpkFile.referenceNumber}.xml`
      );

      // Update JPK file record
      await this.db.jpkFile.update({
        where: { id: jpkFile.id },
        data: {
          status: 'GENERATED',
          filePath,
          fileSizeBytes: Buffer.byteLength(xml, 'utf8'),
          fileHashSha256: fileHash,
          totalRecords: salesRecords.length + purchaseRecords.length,
          summaryData: {
            salesCount: salesRecords.length,
            purchasesCount: purchaseRecords.length,
            outputVAT: declaration.P_38,
            inputVAT: declaration.P_47,
            vatDue: declaration.P_51,
            vatRefund: declaration.P_53,
          },
          updatedAt: new Date(),
        },
      });

      // Log generation
      await this.logGeneration(jpkFile.id, 'GENERATED', 'SUCCESS', {
        duration: Date.now() - startTime,
        recordCount: salesRecords.length + purchaseRecords.length,
        fileSize: Buffer.byteLength(xml, 'utf8'),
      }, input.userId);

      // Sign if requested
      if (input.options?.signAfterGeneration && input.options?.signatureType) {
        await this.signJPKFile({
          jpkFileId: jpkFile.id,
          signatureType: input.options.signatureType,
        });
      }

      return {
        success: true,
        jpkFileId: jpkFile.id,
        referenceNumber: jpkFile.referenceNumber,
        filePath,
        fileSize: Buffer.byteLength(xml, 'utf8'),
        recordCount: salesRecords.length + purchaseRecords.length,
        generationTime: Date.now() - startTime,
      };

    } catch (error) {
      await this.db.jpkFile.update({
        where: { id: jpkFile.id },
        data: { status: 'DRAFT' },
      });

      await this.logGeneration(jpkFile.id, 'GENERATED', 'FAILURE', {
        error: error.message,
        duration: Date.now() - startTime,
      }, input.userId);

      throw error;
    }
  }

  /**
   * Process sales invoices into JPK V7 records
   */
  private async processSalesRecords(
    jpkFileId: string,
    invoices: Invoice[]
  ): Promise<JPKV7SalesRecord[]> {
    const records: JPKV7SalesRecord[] = [];

    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];

      // Determine GTU codes based on line items
      const gtuCodes = await this.determineGTUCodes(invoice.lineItems);

      // Determine procedure codes
      const procedureCodes = this.determineProcedureCodes(invoice);

      // Calculate amounts by VAT rate
      const amounts = this.calculateSalesAmountsByRate(invoice.lineItems);

      const record: JPKV7SalesRecord = {
        lp: i + 1,
        kodKrajuNadaniaTin: invoice.buyerCountryCode !== 'PL' ? invoice.buyerCountryCode : undefined,
        nrKontrahenta: invoice.buyerTaxId,
        nazwaKontrahenta: invoice.buyerName,
        dowodSprzedazy: invoice.number,
        dataWystawienia: format(invoice.issueDate, 'yyyy-MM-dd'),
        dataSprzedazy: invoice.saleDate ? format(invoice.saleDate, 'yyyy-MM-dd') : undefined,
        typDokumentu: this.mapInvoiceType(invoice.type),
        gtuCodes,
        procedureCodes,
        amounts,
        sourceInvoiceId: invoice.id,
      };

      records.push(record);

      // Persist to database
      await this.db.jpkV7SalesRecord.create({
        data: {
          jpkFileId,
          ...this.mapRecordToDbFormat(record),
        },
      });
    }

    return records;
  }

  /**
   * Determine GTU codes for invoice based on line items
   */
  private async determineGTUCodes(lineItems: InvoiceLineItem[]): Promise<GTUCodes> {
    const gtuCodes: GTUCodes = {
      GTU_01: false, GTU_02: false, GTU_03: false, GTU_04: false,
      GTU_05: false, GTU_06: false, GTU_07: false, GTU_08: false,
      GTU_09: false, GTU_10: false, GTU_12: false, GTU_13: false,
    };

    for (const item of lineItems) {
      if (!item.pkwiuCode && !item.cnCode) continue;

      for (const [gtuCode, definition] of Object.entries(GTU_DEFINITIONS)) {
        // Check PKWiU match
        if (item.pkwiuCode) {
          for (const pkwiu of definition.pkwiu) {
            if (item.pkwiuCode.startsWith(pkwiu)) {
              gtuCodes[gtuCode as keyof GTUCodes] = true;
              break;
            }
          }
        }

        // Check CN code match
        if (item.cnCode) {
          for (const cn of definition.cn) {
            if (item.cnCode.startsWith(cn.replace(/\s/g, ''))) {
              gtuCodes[gtuCode as keyof GTUCodes] = true;
              break;
            }
          }
        }
      }
    }

    return gtuCodes;
  }

  /**
   * Determine procedure codes for invoice
   */
  private determineProcedureCodes(invoice: Invoice): ProcedureCodes {
    const codes: ProcedureCodes = {
      SW: false, EE: false, TP: false, TT_WNT: false, TT_D: false,
      MR_T: false, MR_UZ: false, I_42: false, I_63: false,
      B_SPV: false, B_SPV_DOSTAWA: false, B_MPV_PROWIZJA: false,
      MPP: false, IMP: false,
    };

    // Split payment mandatory (MPP) - over 15,000 PLN and Annex 15 goods
    if (invoice.totalGross.gte(15000) && this.hasAnnex15Goods(invoice)) {
      codes.MPP = true;
    }

    // Electronic services (EE)
    if (invoice.serviceType === 'ELECTRONIC' || invoice.serviceType === 'TELECOM') {
      codes.EE = true;
    }

    // Related party transactions (TP)
    if (invoice.isRelatedParty) {
      codes.TP = true;
    }

    // Mail order sales (SW)
    if (invoice.isMailOrder) {
      codes.SW = true;
    }

    // Triangular transaction
    if (invoice.isTriangularTransaction) {
      codes.TT_D = true;
    }

    return codes;
  }

  /**
   * Build complete JPK_V7M XML structure
   */
  private buildJPKV7MXML(data: {
    client: ClientWithOrganization;
    jpkFile: JPKFile;
    salesRecords: JPKV7SalesRecord[];
    purchaseRecords: JPKV7PurchaseRecord[];
    declaration: JPKV7Declaration;
    includeDeclaration: boolean;
  }): string {
    const { client, jpkFile, salesRecords, purchaseRecords, declaration, includeDeclaration } = data;

    const year = jpkFile.periodFrom.getFullYear();
    const month = jpkFile.periodFrom.getMonth() + 1;

    const jpkStructure = {
      JPK: {
        '@_xmlns': JPK_NAMESPACES.JPK_V7M.xmlns,
        '@_xmlns:etd': JPK_NAMESPACES.JPK_V7M['xmlns:etd'],

        // Naglowek (Header)
        Naglowek: {
          KodFormularza: {
            '@_kodSystemowy': 'JPK_V7M (2)',
            '@_wersjaSchemy': '1-0E',
            '#text': 'JPK_VAT',
          },
          WariantFormularza: 2,
          DataWytworzeniaJPK: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
          NazwaSystemu: 'KsięgowaCRM',
          CelZlozenia: {
            '@_poz': 'P_7',
            '#text': jpkFile.celZlozenia,
          },
          KodUrzedu: client.taxOfficeCode,
          Rok: year,
          Miesiac: month,
        },

        // Podmiot1 (Taxpayer)
        Podmiot1: {
          '@_rola': 'Podatnik',
          OsobaNiefizyczna: client.legalForm !== 'NATURAL_PERSON' ? {
            NIP: client.nip,
            PelnaNazwa: client.name,
            Email: client.email,
            Telefon: client.phone,
          } : undefined,
          OsobaFizyczna: client.legalForm === 'NATURAL_PERSON' ? {
            NIP: client.nip,
            ImiePierwsze: client.firstName,
            Nazwisko: client.lastName,
            DataUrodzenia: client.birthDate ? format(client.birthDate, 'yyyy-MM-dd') : undefined,
            Email: client.email,
            Telefon: client.phone,
          } : undefined,
        },

        // Deklaracja (Declaration) - if included
        ...(includeDeclaration ? {
          Deklaracja: {
            Naglowek: {
              KodFormularzaDekl: {
                '@_kodSystemowy': 'VAT-7 (22)',
                '@_kodPodatku': 'VAT',
                '@_rodzajZobowiazania': 'Z',
                '@_wersjaSchemy': '1-0E',
                '#text': 'VAT-7',
              },
              WariantFormularzaDekl: 22,
            },
            PozycjeSzczegolowe: this.buildDeclarationPositions(declaration),
          },
        } : {}),

        // Ewidencja (Records)
        Ewidencja: {
          // Sales records
          SprzedazCtrl: {
            LiczbaWierszySprzedazy: salesRecords.length,
            PodatekNalezny: this.sumSalesVAT(salesRecords).toFixed(2),
          },
          ...this.buildSalesRecordsXML(salesRecords),

          // Purchase records
          ZakupCtrl: {
            LiczbaWierszyZakupow: purchaseRecords.length,
            PodatekNaliczony: this.sumPurchaseVAT(purchaseRecords).toFixed(2),
          },
          ...this.buildPurchaseRecordsXML(purchaseRecords),
        },
      },
    };

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      indentBy: '  ',
      suppressEmptyNode: true,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
    });

    const xmlContent = builder.build(jpkStructure);
    return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlContent}`;
  }

  /**
   * Validate JPK file against XSD schema
   */
  async validateJPK(jpkFileId: string): Promise<ValidationResult> {
    const jpkFile = await this.db.jpkFile.findUniqueOrThrow({
      where: { id: jpkFileId },
    });

    const xmlContent = await this.storageService.readJPKFile(jpkFile.filePath);

    const result = await this.xsdValidator.validate(
      xmlContent,
      jpkFile.jpkType,
      jpkFile.xsdSchemaVersion
    );

    await this.db.jpkFile.update({
      where: { id: jpkFileId },
      data: {
        status: result.isValid ? 'VALIDATED' : 'DRAFT',
        validationErrors: result.errors,
        validatedAt: result.isValid ? new Date() : null,
      },
    });

    await this.logGeneration(jpkFileId, 'VALIDATED', result.isValid ? 'SUCCESS' : 'FAILURE', {
      errors: result.errors,
      warnings: result.warnings,
    });

    return result;
  }

  /**
   * Sign JPK file with qualified electronic signature
   */
  async signJPKFile(input: SignJPKInput): Promise<SigningResult> {
    const jpkFile = await this.db.jpkFile.findUniqueOrThrow({
      where: { id: input.jpkFileId },
    });

    if (jpkFile.status !== 'VALIDATED' && jpkFile.status !== 'GENERATED') {
      throw new JPKError('JPK file must be validated before signing');
    }

    const xmlContent = await this.storageService.readJPKFile(jpkFile.filePath);

    let signedContent: string;
    let signatureData: Buffer;

    if (input.signatureType === 'PROFIL_ZAUFANY') {
      // Initiate Profil Zaufany signing flow
      const signingSession = await this.signatureService.initiateProfilZaufanySigning({
        content: xmlContent,
        returnUrl: input.returnUrl,
        documentType: 'JPK',
      });

      return {
        success: true,
        requiresRedirect: true,
        redirectUrl: signingSession.authUrl,
        sessionId: signingSession.sessionId,
      };
    } else {
      // Use qualified signature (requires external certificate)
      const signResult = await this.signatureService.signWithQualifiedCertificate({
        content: xmlContent,
        certificateId: input.certificateId,
      });

      signedContent = signResult.signedContent;
      signatureData = signResult.signatureData;
    }

    // Store signed file
    const signedFilePath = await this.storageService.storeJPKFile(
      jpkFile.id,
      signedContent,
      `${jpkFile.referenceNumber}_signed.xml`
    );

    await this.db.jpkFile.update({
      where: { id: jpkFile.id },
      data: {
        status: 'SIGNED',
        filePath: signedFilePath,
        signatureType: input.signatureType,
        signedAt: new Date(),
        signedBy: input.userId,
        signatureData,
      },
    });

    await this.logGeneration(jpkFile.id, 'SIGNED', 'SUCCESS', {
      signatureType: input.signatureType,
    });

    return {
      success: true,
      requiresRedirect: false,
      signedFilePath,
    };
  }

  /**
   * Complete Profil Zaufany signing callback
   */
  async completeProfilZaufanySigning(sessionId: string, authCode: string): Promise<SigningResult> {
    const signingResult = await this.signatureService.completeProfilZaufanySigning(
      sessionId,
      authCode
    );

    if (!signingResult.success) {
      throw new JPKError('Profil Zaufany signing failed');
    }

    const jpkFile = await this.db.jpkFile.findFirstOrThrow({
      where: {
        // Find by signing session association
      },
    });

    const signedFilePath = await this.storageService.storeJPKFile(
      jpkFile.id,
      signingResult.signedContent,
      `${jpkFile.referenceNumber}_signed.xml`
    );

    await this.db.jpkFile.update({
      where: { id: jpkFile.id },
      data: {
        status: 'SIGNED',
        filePath: signedFilePath,
        signatureType: 'PROFIL_ZAUFANY',
        signedAt: new Date(),
        signatureData: signingResult.signatureData,
      },
    });

    return {
      success: true,
      requiresRedirect: false,
      signedFilePath,
    };
  }

  /**
   * Batch generate JPK files for multiple clients
   */
  async batchGenerateJPK(input: BatchGenerateJPKInput): Promise<BatchGenerationResult> {
    const results: Map<string, JPKGenerationResult> = new Map();
    const queue = [...input.clientIds];
    const maxConcurrent = input.options?.maxConcurrent ?? 5;
    const activePromises: Promise<void>[] = [];

    const processClient = async (clientId: string) => {
      try {
        const result = await this.generateJPKV7M({
          clientId,
          jpkType: input.jpkType,
          periodFrom: input.periodFrom,
          periodTo: input.periodTo,
          celZlozenia: '1',
        });
        results.set(clientId, result);
      } catch (error) {
        results.set(clientId, {
          success: false,
          error: error.message,
          clientId,
        });

        if (input.options?.stopOnError) {
          throw error;
        }
      }
    };

    while (queue.length > 0 || activePromises.length > 0) {
      // Start new tasks up to maxConcurrent
      while (queue.length > 0 && activePromises.length < maxConcurrent) {
        const clientId = queue.shift()!;
        const promise = processClient(clientId).then(() => {
          const index = activePromises.indexOf(promise);
          if (index > -1) activePromises.splice(index, 1);
        });
        activePromises.push(promise);
      }

      // Wait for at least one to complete
      if (activePromises.length > 0) {
        await Promise.race(activePromises);
      }
    }

    const successful = Array.from(results.values()).filter(r => r.success).length;
    const failed = results.size - successful;

    return {
      totalClients: input.clientIds.length,
      successful,
      failed,
      results: Object.fromEntries(results),
    };
  }

  /**
   * Generate unique reference number
   */
  private generateReferenceNumber(type: JPKType, clientId: string, period: Date): string {
    const clientPrefix = clientId.substring(0, 8).toUpperCase();
    const periodStr = format(period, 'yyyyMM');
    const timestamp = Date.now().toString(36).toUpperCase();
    return `${type}-${clientPrefix}-${periodStr}-${timestamp}`;
  }

  /**
   * Get current XSD schema version for JPK type
   */
  private async getCurrentSchemaVersion(jpkType: JPKType): Promise<string> {
    const schema = await this.db.jpkXsdSchema.findFirst({
      where: {
        jpkType,
        isCurrent: true,
      },
    });

    if (!schema) {
      throw new JPKError(`No current XSD schema found for ${jpkType}`);
    }

    return schema.version;
  }

  /**
   * Log JPK generation activity
   */
  private async logGeneration(
    jpkFileId: string,
    action: string,
    status: string,
    details: object,
    userId?: string
  ): Promise<void> {
    await this.db.jpkGenerationLog.create({
      data: {
        jpkFileId,
        action,
        status,
        details,
        createdBy: userId,
      },
    });

    // Audit log
    await this.auditService.log({
      action: `JPK_${action}`,
      entityType: 'JPK_FILE',
      entityId: jpkFileId,
      details: { status, ...details },
      userId,
    });
  }
}
```

---

## 🔌 API Endpoints

```typescript
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import {
  GenerateJPKInputSchema,
  SignJPKInputSchema,
  SubmitJPKInputSchema,
  BatchGenerateJPKInputSchema,
} from './schemas';

export const jpkRouter = router({
  /**
   * Generate JPK file
   */
  generate: protectedProcedure
    .input(GenerateJPKInputSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.services.jpk.generateJPKV7M({
        ...input,
        userId: ctx.user.id,
      });
      return result;
    }),

  /**
   * Validate JPK file against XSD
   */
  validate: protectedProcedure
    .input(z.object({ jpkFileId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.jpk.validateJPK(input.jpkFileId);
    }),

  /**
   * Sign JPK file
   */
  sign: protectedProcedure
    .input(SignJPKInputSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.services.jpk.signJPKFile({
        ...input,
        userId: ctx.user.id,
      });
    }),

  /**
   * Complete Profil Zaufany signing callback
   */
  completeSigningCallback: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      authCode: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.services.jpk.completeProfilZaufanySigning(
        input.sessionId,
        input.authCode
      );
    }),

  /**
   * Get JPK file by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.jpkFile.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          client: { select: { id: true, name: true, nip: true } },
          _count: {
            select: {
              salesRecords: true,
              purchaseRecords: true,
            },
          },
        },
      });
    }),

  /**
   * List JPK files for client
   */
  listByClient: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      jpkType: z.string().optional(),
      status: z.string().optional(),
      year: z.number().int().optional(),
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { clientId: input.clientId };

      if (input.jpkType) where.jpkType = input.jpkType;
      if (input.status) where.status = input.status;
      if (input.year) {
        where.periodFrom = {
          gte: new Date(input.year, 0, 1),
          lt: new Date(input.year + 1, 0, 1),
        };
      }

      const [files, total] = await Promise.all([
        ctx.db.jpkFile.findMany({
          where,
          orderBy: { periodFrom: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.db.jpkFile.count({ where }),
      ]);

      return { files, total };
    }),

  /**
   * Download JPK file
   */
  download: protectedProcedure
    .input(z.object({ jpkFileId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const jpkFile = await ctx.db.jpkFile.findUniqueOrThrow({
        where: { id: input.jpkFileId },
      });

      const content = await ctx.services.storage.readJPKFile(jpkFile.filePath);

      return {
        content,
        filename: `${jpkFile.referenceNumber}.xml`,
        mimeType: 'application/xml',
      };
    }),

  /**
   * Batch generate JPK files
   */
  batchGenerate: protectedProcedure
    .input(BatchGenerateJPKInputSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.services.jpk.batchGenerateJPK(input);
    }),

  /**
   * Get sales records for JPK file
   */
  getSalesRecords: protectedProcedure
    .input(z.object({
      jpkFileId: z.string().uuid(),
      limit: z.number().int().min(1).max(1000).default(100),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const [records, total] = await Promise.all([
        ctx.db.jpkV7SalesRecord.findMany({
          where: { jpkFileId: input.jpkFileId },
          orderBy: { lp: 'asc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.db.jpkV7SalesRecord.count({
          where: { jpkFileId: input.jpkFileId },
        }),
      ]);

      return { records, total };
    }),

  /**
   * Get purchase records for JPK file
   */
  getPurchaseRecords: protectedProcedure
    .input(z.object({
      jpkFileId: z.string().uuid(),
      limit: z.number().int().min(1).max(1000).default(100),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const [records, total] = await Promise.all([
        ctx.db.jpkV7PurchaseRecord.findMany({
          where: { jpkFileId: input.jpkFileId },
          orderBy: { lp: 'asc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.db.jpkV7PurchaseRecord.count({
          where: { jpkFileId: input.jpkFileId },
        }),
      ]);

      return { records, total };
    }),

  /**
   * Get generation logs
   */
  getGenerationLogs: protectedProcedure
    .input(z.object({
      jpkFileId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.db.jpkGenerationLog.findMany({
        where: { jpkFileId: input.jpkFileId },
        orderBy: { createdAt: 'desc' },
      });
    }),

  /**
   * Get GTU codes reference
   */
  getGTUCodes: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.gtuCode.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
      });
    }),

  /**
   * Get procedure codes reference
   */
  getProcedureCodes: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.procedureCode.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
      });
    }),

  /**
   * Preview JPK file content
   */
  preview: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      jpkType: z.string(),
      periodFrom: z.string(),
      periodTo: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Generate preview without saving
      return ctx.services.jpk.previewJPK(input);
    }),
});
```

---

## 🧪 Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import { JPKGenerationService } from './JPKGenerationService';
import { createMockDatabase, createMockServices } from '@/test/mocks';

describe('JPKGenerationService', () => {
  let service: JPKGenerationService;
  let mockDb: ReturnType<typeof createMockDatabase>;
  let mockServices: ReturnType<typeof createMockServices>;

  beforeEach(() => {
    mockDb = createMockDatabase();
    mockServices = createMockServices();
    service = new JPKGenerationService(
      mockDb,
      mockServices.vat,
      mockServices.invoice,
      mockServices.storage,
      mockServices.xsdValidator,
      mockServices.signature,
      mockServices.audit
    );
  });

  describe('GTU code determination', () => {
    it('should detect GTU_01 for alcoholic beverages by PKWiU', async () => {
      const lineItems = [
        { pkwiuCode: '11.01.10', description: 'Wódka' },
      ];

      const gtuCodes = await service['determineGTUCodes'](lineItems);

      expect(gtuCodes.GTU_01).toBe(true);
      expect(gtuCodes.GTU_02).toBe(false);
    });

    it('should detect GTU_02 for fuel by CN code', async () => {
      const lineItems = [
        { cnCode: '27101943', description: 'Olej napędowy' },
      ];

      const gtuCodes = await service['determineGTUCodes'](lineItems);

      expect(gtuCodes.GTU_02).toBe(true);
    });

    it('should detect multiple GTU codes on single invoice', async () => {
      const lineItems = [
        { pkwiuCode: '11.05.10', description: 'Piwo' },
        { pkwiuCode: '12.00.11', description: 'Tytoń' },
      ];

      const gtuCodes = await service['determineGTUCodes'](lineItems);

      expect(gtuCodes.GTU_01).toBe(true); // Alcohol
      expect(gtuCodes.GTU_04).toBe(true); // Tobacco
    });
  });

  describe('Procedure code determination', () => {
    it('should set MPP for invoices over 15000 PLN with Annex 15 goods', () => {
      const invoice = {
        totalGross: new Decimal(20000),
        lineItems: [{ pkwiuCode: '41.00.30' }], // Construction
      };

      const codes = service['determineProcedureCodes'](invoice);

      expect(codes.MPP).toBe(true);
    });

    it('should not set MPP for invoices under 15000 PLN', () => {
      const invoice = {
        totalGross: new Decimal(14999.99),
        lineItems: [{ pkwiuCode: '41.00.30' }],
      };

      const codes = service['determineProcedureCodes'](invoice);

      expect(codes.MPP).toBe(false);
    });

    it('should set EE for electronic services', () => {
      const invoice = {
        totalGross: new Decimal(1000),
        serviceType: 'ELECTRONIC',
      };

      const codes = service['determineProcedureCodes'](invoice);

      expect(codes.EE).toBe(true);
    });

    it('should set TP for related party transactions', () => {
      const invoice = {
        totalGross: new Decimal(5000),
        isRelatedParty: true,
      };

      const codes = service['determineProcedureCodes'](invoice);

      expect(codes.TP).toBe(true);
    });
  });

  describe('Sales amounts calculation', () => {
    it('should aggregate amounts by VAT rate correctly', () => {
      const lineItems = [
        { netAmount: new Decimal(1000), vatRate: 23, vatAmount: new Decimal(230) },
        { netAmount: new Decimal(500), vatRate: 23, vatAmount: new Decimal(115) },
        { netAmount: new Decimal(200), vatRate: 8, vatAmount: new Decimal(16) },
      ];

      const amounts = service['calculateSalesAmountsByRate'](lineItems);

      expect(amounts.K_10).toBe(1500); // Net 23%
      expect(amounts.K_11).toBe(345);  // VAT 23%
      expect(amounts.K_12).toBe(200);  // Net 8%
      expect(amounts.K_13).toBe(16);   // VAT 8%
    });

    it('should handle export (0%) correctly', () => {
      const lineItems = [
        { netAmount: new Decimal(5000), vatRate: 0, vatAmount: new Decimal(0), isExport: true },
      ];

      const amounts = service['calculateSalesAmountsByRate'](lineItems);

      expect(amounts.K_17).toBe(5000); // Export net
      expect(amounts.K_16).toBe(0);    // Regular 0% (not export)
    });

    it('should handle WDT (intra-community delivery) correctly', () => {
      const lineItems = [
        { netAmount: new Decimal(3000), vatRate: 0, vatAmount: new Decimal(0), isWDT: true },
      ];

      const amounts = service['calculateSalesAmountsByRate'](lineItems);

      expect(amounts.K_18).toBe(3000); // WDT net
    });
  });

  describe('Declaration calculation', () => {
    it('should calculate VAT due when output > input', async () => {
      const salesRecords = [
        { amounts: { K_10: 10000, K_11: 2300 } },
      ];
      const purchaseRecords = [
        { amounts: { K_42: 3000, K_43: 690 } },
      ];

      const declaration = await service['calculateDeclaration'](
        'client-id',
        2025,
        1,
        salesRecords,
        purchaseRecords
      );

      expect(declaration.P_38).toBe(2300);  // Output VAT
      expect(declaration.P_47).toBe(690);   // Input VAT
      expect(declaration.P_51).toBe(1610);  // VAT due (2300 - 690)
      expect(declaration.P_53).toBe(0);     // No refund
    });

    it('should calculate VAT refund when input > output', async () => {
      const salesRecords = [
        { amounts: { K_10: 1000, K_11: 230 } },
      ];
      const purchaseRecords = [
        { amounts: { K_42: 5000, K_43: 1150 } },
      ];

      const declaration = await service['calculateDeclaration'](
        'client-id',
        2025,
        1,
        salesRecords,
        purchaseRecords
      );

      expect(declaration.P_38).toBe(230);   // Output VAT
      expect(declaration.P_47).toBe(1150);  // Input VAT
      expect(declaration.P_51).toBe(0);     // No VAT due
      expect(declaration.P_53).toBe(920);   // VAT refund (1150 - 230)
    });

    it('should apply carry-forward from previous period', async () => {
      mockDb.vatCarryForward.findFirst.mockResolvedValue({
        amount: new Decimal(500),
      });

      const declaration = await service['calculateDeclaration'](
        'client-id',
        2025,
        1,
        [{ amounts: { K_10: 10000, K_11: 2300 } }],
        [{ amounts: { K_42: 3000, K_43: 690 } }]
      );

      expect(declaration.P_48).toBe(500);   // Carry-forward
      expect(declaration.P_51).toBe(1110);  // VAT due (2300 - 690 - 500)
    });
  });

  describe('XML generation', () => {
    it('should generate valid XML structure', () => {
      const data = {
        client: {
          nip: '1234567890',
          name: 'Test Sp. z o.o.',
          taxOfficeCode: '1234',
          legalForm: 'SP_ZOO',
        },
        jpkFile: {
          referenceNumber: 'JPK-TEST-202501',
          periodFrom: new Date(2025, 0, 1),
          periodTo: new Date(2025, 0, 31),
          celZlozenia: '1',
        },
        salesRecords: [],
        purchaseRecords: [],
        declaration: { P_38: 0, P_47: 0, P_51: 0 },
        includeDeclaration: true,
      };

      const xml = service['buildJPKV7MXML'](data);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<JPK');
      expect(xml).toContain('<Naglowek>');
      expect(xml).toContain('<KodFormularza');
      expect(xml).toContain('JPK_VAT');
      expect(xml).toContain('<NIP>1234567890</NIP>');
      expect(xml).toContain('<Miesiac>1</Miesiac>');
      expect(xml).toContain('<Rok>2025</Rok>');
    });

    it('should include GTU codes in sales records', () => {
      const data = {
        client: { nip: '1234567890', name: 'Test' },
        jpkFile: { periodFrom: new Date(2025, 0, 1), periodTo: new Date(2025, 0, 31) },
        salesRecords: [{
          lp: 1,
          dowodSprzedazy: 'FV/2025/001',
          dataWystawienia: '2025-01-15',
          gtuCodes: { GTU_01: true, GTU_02: false },
          amounts: { K_10: 1000, K_11: 230 },
        }],
        purchaseRecords: [],
        declaration: {},
        includeDeclaration: false,
      };

      const xml = service['buildJPKV7MXML'](data);

      expect(xml).toContain('<GTU_01>1</GTU_01>');
      expect(xml).not.toContain('<GTU_02>');
    });
  });

  describe('XSD validation', () => {
    it('should pass validation for valid JPK structure', async () => {
      mockServices.xsdValidator.validate.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        schemaVersion: '1-0E',
        validatedAt: new Date().toISOString(),
      });

      const result = await service.validateJPK('jpk-file-id');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid NIP format', async () => {
      mockServices.xsdValidator.validate.mockResolvedValue({
        isValid: false,
        errors: [{
          field: 'NIP',
          message: 'Invalid NIP format - must be 10 digits',
          severity: 'ERROR',
        }],
        warnings: [],
        schemaVersion: '1-0E',
        validatedAt: new Date().toISOString(),
      });

      const result = await service.validateJPK('jpk-file-id');

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('NIP');
    });
  });

  describe('Reference number generation', () => {
    it('should generate unique reference numbers', () => {
      const ref1 = service['generateReferenceNumber']('JPK_V7M', 'client-123', new Date(2025, 0, 1));
      const ref2 = service['generateReferenceNumber']('JPK_V7M', 'client-123', new Date(2025, 0, 1));

      expect(ref1).toMatch(/^JPK_V7M-[A-Z0-9]+-202501-[A-Z0-9]+$/);
      expect(ref1).not.toBe(ref2); // Should be unique due to timestamp
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, cleanupTestData } from '@/test/integration';

describe('JPK Generation Integration', () => {
  let ctx: TestContext;
  let testClient: Client;

  beforeAll(async () => {
    ctx = await createTestContext();

    // Create test client with tax configuration
    testClient = await ctx.db.client.create({
      data: {
        organizationId: ctx.organization.id,
        name: 'Test Client Sp. z o.o.',
        nip: '1234567890',
        taxConfiguration: {
          create: {
            vatPayer: true,
            vatPeriod: 'MONTHLY',
            taxOfficeCode: '1234',
          },
        },
      },
    });

    // Create test invoices
    await ctx.db.invoice.createMany({
      data: [
        {
          clientId: testClient.id,
          number: 'FV/2025/001',
          type: 'SALES',
          issueDate: new Date(2025, 0, 15),
          netAmount: 10000,
          vatAmount: 2300,
          grossAmount: 12300,
          vatRate: 23,
          status: 'POSTED',
        },
        {
          clientId: testClient.id,
          number: 'FV/2025/002',
          type: 'SALES',
          issueDate: new Date(2025, 0, 20),
          netAmount: 5000,
          vatAmount: 400,
          grossAmount: 5400,
          vatRate: 8,
          status: 'POSTED',
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanupTestData(ctx);
  });

  it('should generate complete JPK_V7M file', async () => {
    const result = await ctx.services.jpk.generateJPKV7M({
      clientId: testClient.id,
      jpkType: 'JPK_V7M',
      periodFrom: '2025-01-01',
      periodTo: '2025-01-31',
      userId: ctx.user.id,
    });

    expect(result.success).toBe(true);
    expect(result.jpkFileId).toBeDefined();
    expect(result.recordCount).toBe(2);

    // Verify JPK file record
    const jpkFile = await ctx.db.jpkFile.findUnique({
      where: { id: result.jpkFileId },
    });

    expect(jpkFile).toBeDefined();
    expect(jpkFile!.status).toBe('GENERATED');
    expect(jpkFile!.jpkType).toBe('JPK_V7M');
  });

  it('should validate generated JPK against XSD', async () => {
    const generateResult = await ctx.services.jpk.generateJPKV7M({
      clientId: testClient.id,
      jpkType: 'JPK_V7M',
      periodFrom: '2025-01-01',
      periodTo: '2025-01-31',
      userId: ctx.user.id,
      options: { validateBeforeGeneration: false },
    });

    const validationResult = await ctx.services.jpk.validateJPK(generateResult.jpkFileId);

    expect(validationResult.isValid).toBe(true);
  });

  it('should create sales records with correct GTU codes', async () => {
    // Create invoice with alcoholic beverages
    await ctx.db.invoice.create({
      data: {
        clientId: testClient.id,
        number: 'FV/2025/003',
        type: 'SALES',
        issueDate: new Date(2025, 0, 25),
        lineItems: {
          create: [{
            description: 'Wódka',
            pkwiuCode: '11.01.10',
            netAmount: 1000,
            vatAmount: 230,
            vatRate: 23,
          }],
        },
        netAmount: 1000,
        vatAmount: 230,
        grossAmount: 1230,
        status: 'POSTED',
      },
    });

    const result = await ctx.services.jpk.generateJPKV7M({
      clientId: testClient.id,
      jpkType: 'JPK_V7M',
      periodFrom: '2025-01-01',
      periodTo: '2025-01-31',
      userId: ctx.user.id,
    });

    const salesRecords = await ctx.db.jpkV7SalesRecord.findMany({
      where: { jpkFileId: result.jpkFileId },
    });

    const alcoholRecord = salesRecords.find(r => r.dowodSprzedazy === 'FV/2025/003');
    expect(alcoholRecord).toBeDefined();
    expect(alcoholRecord!.gtu_01).toBe(true);
  });

  it('should handle batch generation for multiple clients', async () => {
    // Create additional test clients
    const client2 = await ctx.db.client.create({
      data: {
        organizationId: ctx.organization.id,
        name: 'Second Client',
        nip: '9876543210',
        taxConfiguration: {
          create: { vatPayer: true, vatPeriod: 'MONTHLY' },
        },
      },
    });

    const batchResult = await ctx.services.jpk.batchGenerateJPK({
      clientIds: [testClient.id, client2.id],
      jpkType: 'JPK_V7M',
      periodFrom: '2025-01-01',
      periodTo: '2025-01-31',
    });

    expect(batchResult.totalClients).toBe(2);
    expect(batchResult.successful).toBe(2);
    expect(batchResult.failed).toBe(0);
  });

  it('should create audit logs for all JPK operations', async () => {
    const result = await ctx.services.jpk.generateJPKV7M({
      clientId: testClient.id,
      jpkType: 'JPK_V7M',
      periodFrom: '2025-01-01',
      periodTo: '2025-01-31',
      userId: ctx.user.id,
    });

    const logs = await ctx.db.jpkGenerationLog.findMany({
      where: { jpkFileId: result.jpkFileId },
    });

    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs.some(l => l.action === 'GENERATED')).toBe(true);
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('JPK Generation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'accountant@test.com');
    await page.fill('[data-testid="password"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('complete JPK_V7M generation workflow', async ({ page }) => {
    // Navigate to JPK generation
    await page.click('[data-testid="nav-tax"]');
    await page.click('[data-testid="nav-jpk"]');

    // Select client
    await page.click('[data-testid="client-selector"]');
    await page.click('[data-testid="client-option-test-sp-zoo"]');

    // Select period
    await page.click('[data-testid="period-selector"]');
    await page.click('[data-testid="period-2025-01"]');

    // Select JPK type
    await page.selectOption('[data-testid="jpk-type"]', 'JPK_V7M');

    // Generate JPK
    await page.click('[data-testid="generate-jpk-button"]');

    // Wait for generation
    await expect(page.locator('[data-testid="generation-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="generation-complete"]')).toBeVisible({ timeout: 30000 });

    // Verify results
    await expect(page.locator('[data-testid="jpk-status"]')).toHaveText('Wygenerowany');
    await expect(page.locator('[data-testid="sales-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="purchase-count"]')).toBeVisible();
  });

  test('validate and sign JPK file', async ({ page }) => {
    // Navigate to existing JPK file
    await page.goto('/tax/jpk/files');
    await page.click('[data-testid="jpk-file-row"]:first-child');

    // Validate
    await page.click('[data-testid="validate-button"]');
    await expect(page.locator('[data-testid="validation-success"]')).toBeVisible();

    // Sign with Profil Zaufany
    await page.click('[data-testid="sign-button"]');
    await page.click('[data-testid="signature-type-pz"]');
    await page.click('[data-testid="confirm-sign"]');

    // Should redirect to login.gov.pl (mock in test environment)
    await expect(page).toHaveURL(/login\.gov\.pl|mock-auth/);
  });

  test('download generated JPK file', async ({ page }) => {
    await page.goto('/tax/jpk/files');
    await page.click('[data-testid="jpk-file-row"]:first-child');

    // Download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="download-button"]'),
    ]);

    expect(download.suggestedFilename()).toMatch(/JPK.*\.xml$/);
  });

  test('view JPK file details and records', async ({ page }) => {
    await page.goto('/tax/jpk/files');
    await page.click('[data-testid="jpk-file-row"]:first-child');

    // View sales records
    await page.click('[data-testid="tab-sales"]');
    await expect(page.locator('[data-testid="sales-records-table"]')).toBeVisible();

    // View purchase records
    await page.click('[data-testid="tab-purchases"]');
    await expect(page.locator('[data-testid="purchase-records-table"]')).toBeVisible();

    // View declaration
    await page.click('[data-testid="tab-declaration"]');
    await expect(page.locator('[data-testid="declaration-summary"]')).toBeVisible();
  });

  test('batch generation for multiple clients', async ({ page }) => {
    await page.goto('/tax/jpk/batch');

    // Select multiple clients
    await page.click('[data-testid="select-all-clients"]');

    // Configure batch
    await page.selectOption('[data-testid="jpk-type"]', 'JPK_V7M');
    await page.click('[data-testid="period-2025-01"]');

    // Start batch
    await page.click('[data-testid="start-batch-button"]');

    // Monitor progress
    await expect(page.locator('[data-testid="batch-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="batch-complete"]')).toBeVisible({ timeout: 120000 });

    // Verify results
    const successCount = await page.locator('[data-testid="batch-success-count"]').textContent();
    expect(parseInt(successCount!)).toBeGreaterThan(0);
  });
});
```

---

## 🔒 Security Checklist

- [x] Row Level Security (RLS) enforced on all JPK tables
- [x] Organization isolation for multi-tenant data
- [x] Audit logging for all JPK operations
- [x] File storage with encryption at rest
- [x] Secure file hash verification (SHA-256)
- [x] Digital signature support (XAdES-BES)
- [x] Profil Zaufany OAuth integration
- [x] Input validation with Zod schemas
- [x] Rate limiting on generation endpoints
- [x] Secure temporary file handling

---

## 📊 Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `JPK_GENERATED` | JPK file created | File ID, type, period, record count |
| `JPK_VALIDATED` | XSD validation run | Validation result, errors |
| `JPK_SIGNED` | Digital signature applied | Signature type, signer |
| `JPK_DOWNLOADED` | File downloaded | User, timestamp |
| `JPK_BATCH_STARTED` | Batch generation initiated | Client count, type |
| `JPK_BATCH_COMPLETED` | Batch generation finished | Success/failure counts |

---

## 📚 Implementation Notes

### JPK File Types Reference

| Type | Full Name | Frequency | Purpose |
|------|-----------|-----------|---------|
| JPK_V7M | JPK_VAT Monthly | Monthly | Combined VAT declaration + records |
| JPK_V7K | JPK_VAT Quarterly | Quarterly | For small taxpayers |
| JPK_FA | JPK_Faktury | On demand | Detailed invoice data |
| JPK_KR | JPK_Księgi Rachunkowe | On demand | General ledger |
| JPK_WB | JPK_Wyciąg Bankowy | On demand | Bank statements |
| JPK_MAG | JPK_Magazyn | On demand | Warehouse records |
| JPK_EWP | JPK_Ewidencja Przychodów | On demand | Revenue ledger (ryczałt) |

### GTU Code Categories

| Code | Category | Examples |
|------|----------|----------|
| GTU_01 | Alcoholic beverages | Beer, wine, vodka |
| GTU_02 | Fuels | Gasoline, diesel |
| GTU_03 | Heating oils | Light fuel oil |
| GTU_04 | Tobacco | Cigarettes, cigars |
| GTU_05 | Waste | Scrap metal, plastics |
| GTU_06 | Electronics | Computers, phones |
| GTU_07 | Vehicles | Cars, motorcycles |
| GTU_08 | Precious metals | Gold, silver, jewelry |
| GTU_09 | Medicines | Pharmaceuticals |
| GTU_10 | Buildings | Real estate sales |
| GTU_12 | Intangible services | Advisory, legal |
| GTU_13 | Transport services | Freight, passenger |

### Procedure Codes

| Code | Description |
|------|-------------|
| SW | Mail order sales to consumers |
| EE | Telecom/broadcasting/electronic services |
| TP | Related party transactions |
| TT_WNT | Triangular transaction (WNT) |
| TT_D | Triangular transaction (delivery) |
| MR_T | Tourism margin scheme |
| MR_UZ | Used goods margin scheme |
| I_42 | Customs procedure 42 |
| I_63 | Customs procedure 63 |
| B_SPV | Transfer of single-purpose voucher |
| B_SPV_DOSTAWA | Supply against single-purpose voucher |
| B_MPV_PROWIZJA | Multi-purpose voucher commission |
| MPP | Split payment mandatory |

### Dependencies

- **TAX-001**: Client tax configuration for VAT period
- **TAX-002**: Tax rates for calculation
- **TAX-004**: VAT calculation data
- **ACC**: Accounting entries for JPK_KR
- **DOC**: Document storage for generated files

### External Resources

- [Ministerstwo Finansów - JPK](https://www.podatki.gov.pl/jednolity-plik-kontrolny/)
- [XSD Schemas Repository](https://www.podatki.gov.pl/jednolity-plik-kontrolny/struktury-jpk/)
- [e-Urząd Skarbowy](https://www.podatki.gov.pl/e-urzad-skarbowy/)
- [Profil Zaufany API](https://pz.gov.pl/)

---

*Story created: December 2024*
*Last updated: December 2024*
