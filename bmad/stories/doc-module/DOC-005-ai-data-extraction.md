# DOC-005: AI Data Extraction

> **Story ID**: DOC-005
> **Epic**: Document Intelligence Module (DOC)
> **Priority**: P0 (Critical)
> **Story Points**: 13
> **Status**: 📋 Ready for Development
> **Phase**: Week 14

---

## 📋 User Story

**As an** accountant working with Polish clients,
**I want** automatic extraction of structured data from documents,
**So that** invoice, receipt, contract, and bank statement data is captured automatically without manual data entry.

---

## 🎯 Acceptance Criteria

### Scenario 1: Invoice Field Extraction
```gherkin
Given a document has been OCR processed
And the document type is "INVOICE"
When the AI extraction process runs
Then the system extracts seller NIP, name, and address
And extracts buyer NIP, name, and address
And extracts invoice number and dates (issue, sale, due)
And extracts all line items with quantities, prices, VAT rates
And extracts payment terms and bank account (IBAN)
And assigns confidence scores to each extracted field
And the extraction accuracy is ≥85% for clear documents
```

### Scenario 2: Receipt Data Extraction
```gherkin
Given a document has been OCR processed
And the document type is "RECEIPT" (paragon fiskalny)
When the AI extraction process runs
Then the system extracts seller NIP and name
And extracts receipt number and date
And extracts line items with names and prices
And extracts payment method and total amounts
And extracts fiscal device unique ID (numer unikatowy kasy)
And handles Polish thermal receipt formats
```

### Scenario 3: Contract Term Extraction
```gherkin
Given a document has been OCR processed
And the document type is "CONTRACT"
When the AI extraction process runs
Then the system extracts contract parties (strony umowy)
And extracts contract number and signing date
And extracts contract duration (start date, end date, indefinite)
And extracts key terms and obligations
And extracts payment terms and amounts
And extracts termination conditions (wypowiedzenie)
```

### Scenario 4: Bank Statement Parsing
```gherkin
Given a document has been OCR processed
And the document type is "BANK_STATEMENT"
When the AI extraction process runs
Then the system extracts account number (IBAN/NRB)
And extracts statement period (from/to dates)
And extracts opening and closing balances
And extracts all transactions with dates, descriptions, amounts
And categorizes transactions (income/expense)
And extracts sender/recipient information for each transaction
```

### Scenario 5: Line Item Extraction
```gherkin
Given a document contains tabular data with line items
When the AI extraction process runs
Then the system detects item boundaries correctly
And extracts item description/name
And extracts quantity and unit (szt, kg, m², etc.)
And extracts unit price and line total
And extracts VAT rate and VAT amount per line
And calculates and validates line totals
And identifies GTU codes if present
```

### Scenario 6: Polish Format Support
```gherkin
Given a document contains Polish-formatted data
When the AI extraction process runs
Then the system correctly parses Polish date formats:
  | Format | Example |
  | DD.MM.YYYY | 15.01.2024 |
  | DD-MM-YYYY | 15-01-2024 |
  | D MMMM YYYY | 15 stycznia 2024 |
And correctly parses Polish currency formats:
  | Format | Example |
  | X XXX,XX zł | 1 234,56 zł |
  | X.XXX,XX PLN | 1.234,56 PLN |
And validates NIP format with checksum
And validates REGON format with checksum
And validates Polish IBAN format (PL + 26 digits)
```

### Scenario 7: Business Rules Validation
```gherkin
Given extracted data from a document
When the validation process runs
Then the system validates NIP checksums
And validates invoice number sequencing (if prior invoices exist)
And validates VAT calculations (net + VAT = gross)
And validates line item totals sum to document total
And validates dates are logical (sale ≤ issue ≤ due)
And flags inconsistencies with confidence-weighted warnings
And the validation results are stored with the extraction
```

### Scenario 8: Extraction Review and Correction
```gherkin
Given extraction has completed with some low-confidence fields
When an accountant reviews the extraction results
Then the system highlights fields with confidence <0.7
And allows manual correction of any field
And learns from corrections to improve future extractions
And maintains audit trail of all corrections
And re-validates the document after corrections
```

---

## 🗄️ Database Schema

```sql
-- Extraction results
CREATE TABLE extraction_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  ocr_result_id UUID NOT NULL REFERENCES ocr_results(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  document_type TEXT NOT NULL CHECK (document_type IN (
    'INVOICE', 'RECEIPT', 'CONTRACT', 'BANK_STATEMENT',
    'PAYROLL', 'TAX_DECLARATION', 'OTHER'
  )),

  extraction_model TEXT NOT NULL DEFAULT 'gpt-4-vision',
  extraction_version TEXT NOT NULL DEFAULT '1.0.0',

  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW', 'APPROVED'
  )),

  overall_confidence DECIMAL(5,4) NOT NULL DEFAULT 0,
  field_count INTEGER NOT NULL DEFAULT 0,
  low_confidence_count INTEGER NOT NULL DEFAULT 0,

  raw_extraction JSONB NOT NULL DEFAULT '{}',
  structured_data JSONB NOT NULL DEFAULT '{}',
  validation_results JSONB NOT NULL DEFAULT '{}',

  processing_time_ms INTEGER,
  token_usage JSONB,

  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extracted fields (normalized)
CREATE TABLE extracted_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_result_id UUID NOT NULL REFERENCES extraction_results(id) ON DELETE CASCADE,

  field_category TEXT NOT NULL CHECK (field_category IN (
    'SELLER', 'BUYER', 'DOCUMENT', 'LINE_ITEM', 'PAYMENT',
    'TOTALS', 'CONTRACT', 'TRANSACTION', 'OTHER'
  )),
  field_name TEXT NOT NULL,
  field_value TEXT,
  field_type TEXT NOT NULL CHECK (field_type IN (
    'STRING', 'NUMBER', 'DATE', 'CURRENCY', 'NIP', 'REGON',
    'IBAN', 'PERCENTAGE', 'BOOLEAN', 'ARRAY'
  )),

  normalized_value JSONB,

  confidence DECIMAL(5,4) NOT NULL,
  source_text TEXT,
  bounding_box JSONB,

  is_validated BOOLEAN DEFAULT false,
  validation_status TEXT CHECK (validation_status IN (
    'VALID', 'INVALID', 'WARNING', 'NOT_VALIDATED'
  )),
  validation_message TEXT,

  is_corrected BOOLEAN DEFAULT false,
  original_value TEXT,
  corrected_by UUID REFERENCES users(id),
  corrected_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Line items extraction
CREATE TABLE extracted_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_result_id UUID NOT NULL REFERENCES extraction_results(id) ON DELETE CASCADE,

  line_number INTEGER NOT NULL,

  description TEXT,
  quantity DECIMAL(15,4),
  unit TEXT,
  unit_price_net DECIMAL(15,2),
  unit_price_gross DECIMAL(15,2),

  line_total_net DECIMAL(15,2),
  line_total_vat DECIMAL(15,2),
  line_total_gross DECIMAL(15,2),

  vat_rate DECIMAL(5,2),
  vat_rate_code TEXT,

  gtu_code TEXT CHECK (gtu_code IS NULL OR gtu_code ~ '^GTU_(0[1-9]|1[0-3])$'),
  pkwiu_code TEXT,

  confidence DECIMAL(5,4) NOT NULL,
  is_validated BOOLEAN DEFAULT false,
  validation_errors JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bank transactions (from statements)
CREATE TABLE extracted_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_result_id UUID NOT NULL REFERENCES extraction_results(id) ON DELETE CASCADE,

  transaction_date DATE NOT NULL,
  posting_date DATE,
  value_date DATE,

  description TEXT NOT NULL,
  reference_number TEXT,

  amount DECIMAL(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PLN',
  transaction_type TEXT CHECK (transaction_type IN ('CREDIT', 'DEBIT')),

  counterparty_name TEXT,
  counterparty_account TEXT,
  counterparty_nip TEXT,

  balance_after DECIMAL(15,2),

  category TEXT,
  is_transfer BOOLEAN DEFAULT false,

  confidence DECIMAL(5,4) NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Extraction templates (for learning)
CREATE TABLE extraction_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  issuer_nip TEXT,
  issuer_name TEXT,

  field_mappings JSONB NOT NULL DEFAULT '{}',
  extraction_hints JSONB NOT NULL DEFAULT '{}',

  success_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  average_confidence DECIMAL(5,4),

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (organization_id, issuer_nip, document_type)
);

-- Extraction corrections (for ML training)
CREATE TABLE extraction_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_result_id UUID NOT NULL REFERENCES extraction_results(id) ON DELETE CASCADE,
  field_id UUID REFERENCES extracted_fields(id),

  field_name TEXT NOT NULL,
  original_value TEXT,
  corrected_value TEXT NOT NULL,

  correction_type TEXT NOT NULL CHECK (correction_type IN (
    'VALUE_CHANGE', 'TYPE_CHANGE', 'FIELD_ADDED', 'FIELD_REMOVED'
  )),

  corrected_by UUID NOT NULL REFERENCES users(id),
  correction_reason TEXT,

  used_for_training BOOLEAN DEFAULT false,
  training_batch_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_extraction_results_document ON extraction_results(document_id);
CREATE INDEX idx_extraction_results_status ON extraction_results(status);
CREATE INDEX idx_extraction_results_org ON extraction_results(organization_id);
CREATE INDEX idx_extracted_fields_result ON extracted_fields(extraction_result_id);
CREATE INDEX idx_extracted_fields_category ON extracted_fields(field_category);
CREATE INDEX idx_extracted_line_items_result ON extracted_line_items(extraction_result_id);
CREATE INDEX idx_extracted_transactions_result ON extracted_transactions(extraction_result_id);
CREATE INDEX idx_extraction_templates_org_issuer ON extraction_templates(organization_id, issuer_nip);
CREATE INDEX idx_extraction_corrections_result ON extraction_corrections(extraction_result_id);

-- RLS Policies
ALTER TABLE extraction_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY extraction_results_org_isolation ON extraction_results
  USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY extracted_fields_org_isolation ON extracted_fields
  USING (extraction_result_id IN (
    SELECT id FROM extraction_results
    WHERE organization_id = current_setting('app.current_organization_id')::UUID
  ));

CREATE POLICY extracted_line_items_org_isolation ON extracted_line_items
  USING (extraction_result_id IN (
    SELECT id FROM extraction_results
    WHERE organization_id = current_setting('app.current_organization_id')::UUID
  ));

CREATE POLICY extracted_transactions_org_isolation ON extracted_transactions
  USING (extraction_result_id IN (
    SELECT id FROM extraction_results
    WHERE organization_id = current_setting('app.current_organization_id')::UUID
  ));

CREATE POLICY extraction_templates_org_isolation ON extraction_templates
  USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY extraction_corrections_org_isolation ON extraction_corrections
  USING (extraction_result_id IN (
    SELECT id FROM extraction_results
    WHERE organization_id = current_setting('app.current_organization_id')::UUID
  ));
```

---

## 📝 Zod Validation Schemas

```typescript
import { z } from 'zod';

// Document types for extraction
export const DocumentTypeEnum = z.enum([
  'INVOICE',
  'RECEIPT',
  'CONTRACT',
  'BANK_STATEMENT',
  'PAYROLL',
  'TAX_DECLARATION',
  'OTHER'
]);

export const ExtractionStatusEnum = z.enum([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'NEEDS_REVIEW',
  'APPROVED'
]);

export const FieldCategoryEnum = z.enum([
  'SELLER',
  'BUYER',
  'DOCUMENT',
  'LINE_ITEM',
  'PAYMENT',
  'TOTALS',
  'CONTRACT',
  'TRANSACTION',
  'OTHER'
]);

export const FieldTypeEnum = z.enum([
  'STRING',
  'NUMBER',
  'DATE',
  'CURRENCY',
  'NIP',
  'REGON',
  'IBAN',
  'PERCENTAGE',
  'BOOLEAN',
  'ARRAY'
]);

// Polish-specific validation patterns
export const polishNipSchema = z.string().regex(
  /^\d{10}$|^\d{3}-\d{3}-\d{2}-\d{2}$/,
  'NIP musi mieć format XXXXXXXXXX lub XXX-XXX-XX-XX'
).refine((nip) => {
  const digits = nip.replace(/\D/g, '');
  if (digits.length !== 10) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * weights[i];
  }
  return sum % 11 === parseInt(digits[9]);
}, 'Nieprawidłowa suma kontrolna NIP');

export const polishRegonSchema = z.string().regex(
  /^\d{9}$|^\d{14}$/,
  'REGON musi mieć 9 lub 14 cyfr'
).refine((regon) => {
  const digits = regon.replace(/\D/g, '');
  if (digits.length === 9) {
    const weights = [8, 9, 2, 3, 4, 5, 6, 7];
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += parseInt(digits[i]) * weights[i];
    }
    return (sum % 11 % 10) === parseInt(digits[8]);
  }
  if (digits.length === 14) {
    const weights = [2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8];
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(digits[i]) * weights[i];
    }
    return (sum % 11 % 10) === parseInt(digits[13]);
  }
  return false;
}, 'Nieprawidłowa suma kontrolna REGON');

export const polishIbanSchema = z.string().regex(
  /^PL\d{26}$|^\d{26}$/,
  'Polski IBAN musi mieć format PL + 26 cyfr lub 26 cyfr (NRB)'
).refine((iban) => {
  const digits = iban.startsWith('PL') ? iban.slice(2) : iban;
  // Full IBAN validation with modulo 97
  const rearranged = digits.slice(4) + '2521' + digits.slice(0, 4); // PL = 25, 21
  const numericString = rearranged.replace(/[A-Z]/g, (char) =>
    (char.charCodeAt(0) - 55).toString()
  );
  let remainder = 0;
  for (const digit of numericString) {
    remainder = (remainder * 10 + parseInt(digit)) % 97;
  }
  return remainder === 1;
}, 'Nieprawidłowy numer IBAN');

// Currency amount schema (Polish format)
export const polishCurrencySchema = z.object({
  amount: z.number().multipleOf(0.01),
  currency: z.string().default('PLN'),
  formatted: z.string().optional()
});

// Extracted invoice schema
export const extractedInvoiceSchema = z.object({
  seller: z.object({
    nip: polishNipSchema.optional(),
    regon: polishRegonSchema.optional(),
    name: z.string().min(1),
    address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      postalCode: z.string().regex(/^\d{2}-\d{3}$/).optional(),
      country: z.string().default('Polska')
    }).optional(),
    bankAccount: polishIbanSchema.optional()
  }),
  buyer: z.object({
    nip: polishNipSchema.optional(),
    regon: polishRegonSchema.optional(),
    name: z.string().min(1),
    address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      postalCode: z.string().regex(/^\d{2}-\d{3}$/).optional(),
      country: z.string().default('Polska')
    }).optional()
  }),
  document: z.object({
    invoiceNumber: z.string().min(1),
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    paymentMethod: z.enum(['TRANSFER', 'CASH', 'CARD', 'OTHER']).optional()
  }),
  lineItems: z.array(z.object({
    lineNumber: z.number().int().positive(),
    description: z.string(),
    quantity: z.number().positive(),
    unit: z.string().optional(),
    unitPriceNet: z.number(),
    vatRate: z.number().min(0).max(100),
    vatRateCode: z.enum(['23', '8', '5', '0', 'zw', 'np', 'oo']).optional(),
    lineTotalNet: z.number(),
    lineTotalVat: z.number(),
    lineTotalGross: z.number(),
    gtuCode: z.string().regex(/^GTU_(0[1-9]|1[0-3])$/).optional(),
    pkwiuCode: z.string().optional()
  })),
  totals: z.object({
    totalNet: z.number(),
    totalVat: z.number(),
    totalGross: z.number(),
    vatBreakdown: z.array(z.object({
      rate: z.number(),
      rateCode: z.string(),
      netAmount: z.number(),
      vatAmount: z.number()
    })).optional()
  }),
  payment: z.object({
    bankAccount: polishIbanSchema.optional(),
    bankName: z.string().optional(),
    paymentTerms: z.string().optional(),
    splitPayment: z.boolean().optional(),
    amountPaid: z.number().optional(),
    amountDue: z.number().optional()
  }).optional()
});

// Extracted receipt schema
export const extractedReceiptSchema = z.object({
  seller: z.object({
    nip: polishNipSchema,
    name: z.string(),
    address: z.string().optional()
  }),
  receipt: z.object({
    receiptNumber: z.string(),
    fiscalNumber: z.string().optional(),
    deviceId: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional()
  }),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number(),
    totalPrice: z.number(),
    vatRate: z.string().optional()
  })),
  totals: z.object({
    total: z.number(),
    vatBreakdown: z.array(z.object({
      rate: z.string(),
      amount: z.number()
    })).optional()
  }),
  payment: z.object({
    method: z.enum(['CASH', 'CARD', 'MIXED', 'OTHER']),
    cashGiven: z.number().optional(),
    changeReturned: z.number().optional()
  }).optional()
});

// Extracted contract schema
export const extractedContractSchema = z.object({
  parties: z.array(z.object({
    role: z.enum(['PARTY_A', 'PARTY_B', 'GUARANTOR', 'WITNESS']),
    type: z.enum(['COMPANY', 'INDIVIDUAL']),
    name: z.string(),
    nip: polishNipSchema.optional(),
    regon: polishRegonSchema.optional(),
    pesel: z.string().regex(/^\d{11}$/).optional(),
    address: z.string().optional(),
    representedBy: z.string().optional()
  })),
  contract: z.object({
    contractNumber: z.string().optional(),
    contractType: z.string(),
    signingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    isIndefinite: z.boolean().optional()
  }),
  terms: z.object({
    subject: z.string(),
    value: z.number().optional(),
    currency: z.string().default('PLN'),
    paymentTerms: z.string().optional(),
    terminationNoticePeriod: z.string().optional(),
    penalties: z.string().optional()
  }).optional(),
  obligations: z.array(z.object({
    party: z.string(),
    obligation: z.string()
  })).optional()
});

// Extracted bank statement schema
export const extractedBankStatementSchema = z.object({
  account: z.object({
    accountNumber: polishIbanSchema,
    accountHolder: z.string(),
    bankName: z.string().optional(),
    currency: z.string().default('PLN')
  }),
  period: z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    statementNumber: z.string().optional()
  }),
  balances: z.object({
    opening: z.number(),
    closing: z.number(),
    totalCredits: z.number().optional(),
    totalDebits: z.number().optional()
  }),
  transactions: z.array(z.object({
    transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    postingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    valueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    description: z.string(),
    reference: z.string().optional(),
    amount: z.number(),
    type: z.enum(['CREDIT', 'DEBIT']),
    balanceAfter: z.number().optional(),
    counterparty: z.object({
      name: z.string().optional(),
      account: z.string().optional(),
      nip: z.string().optional()
    }).optional()
  }))
});

// Extraction request
export const startExtractionSchema = z.object({
  documentId: z.string().uuid(),
  ocrResultId: z.string().uuid(),
  documentType: DocumentTypeEnum.optional(),
  extractionOptions: z.object({
    useTemplate: z.boolean().default(true),
    templateId: z.string().uuid().optional(),
    extractLineItems: z.boolean().default(true),
    validateBusinessRules: z.boolean().default(true),
    detectGtuCodes: z.boolean().default(true)
  }).optional()
});

// Field correction request
export const correctFieldSchema = z.object({
  extractionResultId: z.string().uuid(),
  fieldId: z.string().uuid().optional(),
  fieldName: z.string(),
  fieldCategory: FieldCategoryEnum,
  correctedValue: z.string(),
  correctionReason: z.string().optional()
});

// Approve extraction request
export const approveExtractionSchema = z.object({
  extractionResultId: z.string().uuid(),
  notes: z.string().optional()
});

// Search extractions
export const searchExtractionsSchema = z.object({
  documentType: DocumentTypeEnum.optional(),
  status: ExtractionStatusEnum.optional(),
  confidenceMin: z.number().min(0).max(1).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sellerNip: z.string().optional(),
  buyerNip: z.string().optional(),
  invoiceNumber: z.string().optional(),
  amountMin: z.number().optional(),
  amountMax: z.number().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'confidence', 'documentType']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});
```

---

## 🔧 Service Implementation

```typescript
// src/services/document/ai-extraction.service.ts

import { db } from '@/lib/db';
import { OpenAI } from 'openai';
import {
  extractedInvoiceSchema,
  extractedReceiptSchema,
  extractedContractSchema,
  extractedBankStatementSchema,
  polishNipSchema,
  polishRegonSchema,
  polishIbanSchema
} from './schemas';
import { createAuditLog } from '@/lib/audit';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Extraction prompts per document type
const EXTRACTION_PROMPTS: Record<string, string> = {
  INVOICE: `Wyodrębnij dane z polskiej faktury VAT. Zwróć JSON z następującymi polami:
- seller: NIP, nazwa, adres, numer konta bankowego
- buyer: NIP, nazwa, adres
- document: numer faktury, data wystawienia, data sprzedaży, termin płatności
- lineItems: tablica z pozycjami (opis, ilość, jednostka, cena netto, stawka VAT, wartość netto, VAT, brutto, kod GTU)
- totals: suma netto, VAT, brutto, podział VAT według stawek
- payment: konto bankowe, warunki płatności, mechanizm podzielonej płatności

Formatuj daty jako YYYY-MM-DD. Kwoty jako liczby (bez symbolu waluty).
NIP bez myślników. Stawki VAT jako liczby (23, 8, 5, 0) lub kody (zw, np).`,

  RECEIPT: `Wyodrębnij dane z polskiego paragonu fiskalnego. Zwróć JSON z:
- seller: NIP, nazwa, adres
- receipt: numer paragonu, numer fiskalny, ID urządzenia, data, godzina
- items: tablica z pozycjami (nazwa, ilość, cena jednostkowa, cena łączna, stawka VAT)
- totals: suma, podział VAT
- payment: metoda płatności, gotówka podana, reszta

Formatuj daty jako YYYY-MM-DD.`,

  CONTRACT: `Wyodrębnij dane z polskiej umowy. Zwróć JSON z:
- parties: tablica stron (rola, typ, nazwa, NIP/REGON/PESEL, adres, reprezentant)
- contract: numer, typ umowy, data podpisania, data rozpoczęcia, data zakończenia, czy bezterminowa
- terms: przedmiot umowy, wartość, warunki płatności, okres wypowiedzenia, kary
- obligations: tablica obowiązków (strona, obowiązek)

Formatuj daty jako YYYY-MM-DD.`,

  BANK_STATEMENT: `Wyodrębnij dane z polskiego wyciągu bankowego. Zwróć JSON z:
- account: numer konta (IBAN), właściciel, nazwa banku, waluta
- period: data od, data do, numer wyciągu
- balances: saldo początkowe, saldo końcowe, suma uznań, suma obciążeń
- transactions: tablica transakcji (data, data księgowania, opis, referencja, kwota, typ, saldo po, kontrahent)

Formatuj daty jako YYYY-MM-DD. Uznania jako dodatnie kwoty, obciążenia jako ujemne.`
};

interface ExtractionResult {
  success: boolean;
  documentType: string;
  structuredData: any;
  fields: ExtractedField[];
  lineItems?: any[];
  transactions?: any[];
  overallConfidence: number;
  validationResults: ValidationResult[];
  processingTimeMs: number;
  tokenUsage: { prompt: number; completion: number; total: number };
}

interface ExtractedField {
  category: string;
  name: string;
  value: any;
  type: string;
  confidence: number;
  sourceText?: string;
  boundingBox?: any;
}

interface ValidationResult {
  field: string;
  status: 'VALID' | 'INVALID' | 'WARNING';
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
}

export class AIExtractionService {

  /**
   * Start extraction process for a document
   */
  static async startExtraction(
    input: {
      documentId: string;
      ocrResultId: string;
      documentType?: string;
      extractionOptions?: {
        useTemplate?: boolean;
        templateId?: string;
        extractLineItems?: boolean;
        validateBusinessRules?: boolean;
        detectGtuCodes?: boolean;
      };
    },
    context: { userId: string; organizationId: string }
  ): Promise<ExtractionResult> {
    const startTime = Date.now();

    // Get OCR result
    const ocrResult = await db.query.ocrResults.findFirst({
      where: (ocr, { eq }) => eq(ocr.id, input.ocrResultId)
    });

    if (!ocrResult) {
      throw new Error('Nie znaleziono wyników OCR');
    }

    // Detect document type if not provided
    const documentType = input.documentType ||
      await this.detectDocumentType(ocrResult.extractedText);

    // Check for existing template
    let template = null;
    if (input.extractionOptions?.useTemplate !== false) {
      template = await this.findMatchingTemplate(
        ocrResult.extractedText,
        documentType,
        context.organizationId
      );
    }

    // Run AI extraction
    const extractionResult = await this.runAIExtraction(
      ocrResult.extractedText,
      documentType,
      template,
      input.extractionOptions
    );

    // Validate extracted data
    const validationResults = input.extractionOptions?.validateBusinessRules !== false
      ? await this.validateExtraction(extractionResult.structuredData, documentType)
      : [];

    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(
      extractionResult.fields,
      validationResults
    );

    // Determine status based on confidence
    const status = overallConfidence >= 0.85 ? 'COMPLETED' :
                   overallConfidence >= 0.7 ? 'NEEDS_REVIEW' : 'NEEDS_REVIEW';

    // Save extraction result
    const savedResult = await db.insert('extraction_results').values({
      documentId: input.documentId,
      ocrResultId: input.ocrResultId,
      organizationId: context.organizationId,
      documentType,
      extractionModel: 'gpt-4-vision',
      extractionVersion: '1.0.0',
      status,
      overallConfidence,
      fieldCount: extractionResult.fields.length,
      lowConfidenceCount: extractionResult.fields.filter(f => f.confidence < 0.7).length,
      rawExtraction: extractionResult.rawResponse,
      structuredData: extractionResult.structuredData,
      validationResults,
      processingTimeMs: Date.now() - startTime,
      tokenUsage: extractionResult.tokenUsage
    }).returning();

    // Save extracted fields
    if (extractionResult.fields.length > 0) {
      await db.insert('extracted_fields').values(
        extractionResult.fields.map(field => ({
          extractionResultId: savedResult[0].id,
          fieldCategory: field.category,
          fieldName: field.name,
          fieldValue: String(field.value),
          fieldType: field.type,
          normalizedValue: field.value,
          confidence: field.confidence,
          sourceText: field.sourceText,
          boundingBox: field.boundingBox,
          isValidated: false,
          validationStatus: 'NOT_VALIDATED'
        }))
      );
    }

    // Save line items
    if (extractionResult.lineItems && extractionResult.lineItems.length > 0) {
      await db.insert('extracted_line_items').values(
        extractionResult.lineItems.map((item, index) => ({
          extractionResultId: savedResult[0].id,
          lineNumber: index + 1,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPriceNet: item.unitPriceNet,
          unitPriceGross: item.unitPriceGross,
          lineTotalNet: item.lineTotalNet,
          lineTotalVat: item.lineTotalVat,
          lineTotalGross: item.lineTotalGross,
          vatRate: item.vatRate,
          vatRateCode: item.vatRateCode,
          gtuCode: item.gtuCode,
          pkwiuCode: item.pkwiuCode,
          confidence: item.confidence || overallConfidence,
          isValidated: false,
          validationErrors: []
        }))
      );
    }

    // Save transactions (for bank statements)
    if (extractionResult.transactions && extractionResult.transactions.length > 0) {
      await db.insert('extracted_transactions').values(
        extractionResult.transactions.map(tx => ({
          extractionResultId: savedResult[0].id,
          transactionDate: tx.transactionDate,
          postingDate: tx.postingDate,
          valueDate: tx.valueDate,
          description: tx.description,
          referenceNumber: tx.reference,
          amount: tx.amount,
          currency: tx.currency || 'PLN',
          transactionType: tx.type,
          counterpartyName: tx.counterparty?.name,
          counterpartyAccount: tx.counterparty?.account,
          counterpartyNip: tx.counterparty?.nip,
          balanceAfter: tx.balanceAfter,
          confidence: tx.confidence || overallConfidence
        }))
      );
    }

    // Update template statistics
    if (template) {
      await this.updateTemplateStats(template.id, overallConfidence);
    }

    // Create audit log
    await createAuditLog({
      action: 'EXTRACTION_COMPLETED',
      entityType: 'extraction_result',
      entityId: savedResult[0].id,
      userId: context.userId,
      organizationId: context.organizationId,
      metadata: {
        documentId: input.documentId,
        documentType,
        overallConfidence,
        fieldCount: extractionResult.fields.length,
        processingTimeMs: Date.now() - startTime
      }
    });

    return {
      success: true,
      documentType,
      structuredData: extractionResult.structuredData,
      fields: extractionResult.fields,
      lineItems: extractionResult.lineItems,
      transactions: extractionResult.transactions,
      overallConfidence,
      validationResults,
      processingTimeMs: Date.now() - startTime,
      tokenUsage: extractionResult.tokenUsage
    };
  }

  /**
   * Detect document type from OCR text
   */
  private static async detectDocumentType(text: string): Promise<string> {
    const textLower = text.toLowerCase();

    // Invoice detection
    const invoicePatterns = [
      'faktura vat', 'faktura korygująca', 'faktura proforma',
      'nip sprzedawcy', 'nip nabywcy', 'data sprzedaży',
      'kwota netto', 'kwota vat', 'razem do zapłaty'
    ];
    if (invoicePatterns.some(p => textLower.includes(p))) {
      return 'INVOICE';
    }

    // Receipt detection
    const receiptPatterns = [
      'paragon fiskalny', 'nr unikatowy', 'ptu',
      'raport dobowy', 'kasa fiskalna', 'gotówka'
    ];
    if (receiptPatterns.some(p => textLower.includes(p))) {
      return 'RECEIPT';
    }

    // Contract detection
    const contractPatterns = [
      'umowa', 'strony umowy', 'przedmiot umowy',
      'zobowiązania', 'wypowiedzenie', 'kary umowne',
      'reprezentowany przez', 'niniejsza umowa'
    ];
    if (contractPatterns.some(p => textLower.includes(p))) {
      return 'CONTRACT';
    }

    // Bank statement detection
    const bankPatterns = [
      'wyciąg bankowy', 'saldo początkowe', 'saldo końcowe',
      'data waluty', 'numer rachunku', 'operacje na koncie',
      'historia transakcji', 'bank'
    ];
    if (bankPatterns.some(p => textLower.includes(p))) {
      return 'BANK_STATEMENT';
    }

    // Use AI for unclear documents
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'Określ typ dokumentu. Odpowiedz tylko jednym słowem: INVOICE, RECEIPT, CONTRACT, BANK_STATEMENT, PAYROLL, TAX_DECLARATION lub OTHER.'
        },
        {
          role: 'user',
          content: text.slice(0, 2000)
        }
      ],
      max_tokens: 50,
      temperature: 0
    });

    const detected = response.choices[0]?.message?.content?.trim().toUpperCase();
    return ['INVOICE', 'RECEIPT', 'CONTRACT', 'BANK_STATEMENT', 'PAYROLL', 'TAX_DECLARATION'].includes(detected || '')
      ? detected!
      : 'OTHER';
  }

  /**
   * Find matching template for extraction
   */
  private static async findMatchingTemplate(
    text: string,
    documentType: string,
    organizationId: string
  ): Promise<any | null> {
    // Extract potential NIP from text
    const nipMatch = text.match(/\d{3}-?\d{3}-?\d{2}-?\d{2}/);
    if (!nipMatch) return null;

    const nip = nipMatch[0].replace(/-/g, '');

    // Find template for this issuer
    const template = await db.query.extractionTemplates.findFirst({
      where: (t, { eq, and }) => and(
        eq(t.organizationId, organizationId),
        eq(t.issuerNip, nip),
        eq(t.documentType, documentType),
        eq(t.isActive, true)
      ),
      orderBy: (t, { desc }) => [desc(t.successCount)]
    });

    return template;
  }

  /**
   * Run AI extraction
   */
  private static async runAIExtraction(
    text: string,
    documentType: string,
    template: any | null,
    options?: {
      extractLineItems?: boolean;
      detectGtuCodes?: boolean;
    }
  ): Promise<{
    rawResponse: any;
    structuredData: any;
    fields: ExtractedField[];
    lineItems?: any[];
    transactions?: any[];
    tokenUsage: { prompt: number; completion: number; total: number };
  }> {
    const prompt = EXTRACTION_PROMPTS[documentType] || EXTRACTION_PROMPTS.INVOICE;

    // Add template hints if available
    const enhancedPrompt = template
      ? `${prompt}\n\nWskazówki na podstawie poprzednich dokumentów tego wystawcy:\n${JSON.stringify(template.extractionHints)}`
      : prompt;

    // Add GTU detection if requested
    const gtuPrompt = options?.detectGtuCodes !== false && documentType === 'INVOICE'
      ? '\n\nDla każdej pozycji określ kod GTU (GTU_01 do GTU_13) jeśli dotyczy.'
      : '';

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: enhancedPrompt + gtuPrompt + '\n\nZwróć tylko poprawny JSON bez dodatkowego tekstu.'
        },
        {
          role: 'user',
          content: text
        }
      ],
      max_tokens: 4000,
      temperature: 0,
      response_format: { type: 'json_object' }
    });

    const rawContent = response.choices[0]?.message?.content || '{}';
    let structuredData: any;

    try {
      structuredData = JSON.parse(rawContent);
    } catch {
      structuredData = {};
    }

    // Normalize and validate with schema
    structuredData = this.normalizeExtractedData(structuredData, documentType);

    // Extract fields with confidence
    const fields = this.extractFieldsWithConfidence(structuredData, documentType, text);

    // Extract line items
    const lineItems = documentType === 'INVOICE' || documentType === 'RECEIPT'
      ? this.extractLineItems(structuredData, text)
      : undefined;

    // Extract transactions
    const transactions = documentType === 'BANK_STATEMENT'
      ? this.extractTransactions(structuredData, text)
      : undefined;

    return {
      rawResponse: structuredData,
      structuredData,
      fields,
      lineItems,
      transactions,
      tokenUsage: {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0
      }
    };
  }

  /**
   * Normalize extracted data
   */
  private static normalizeExtractedData(data: any, documentType: string): any {
    // Normalize dates to YYYY-MM-DD
    const normalizeDate = (dateStr: string): string => {
      if (!dateStr) return '';

      // Handle DD.MM.YYYY
      const ddmmyyyy = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (ddmmyyyy) {
        return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
      }

      // Handle DD-MM-YYYY
      const ddmmyyyyDash = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (ddmmyyyyDash) {
        return `${ddmmyyyyDash[3]}-${ddmmyyyyDash[2].padStart(2, '0')}-${ddmmyyyyDash[1].padStart(2, '0')}`;
      }

      // Handle Polish month names
      const months: Record<string, string> = {
        'stycznia': '01', 'lutego': '02', 'marca': '03', 'kwietnia': '04',
        'maja': '05', 'czerwca': '06', 'lipca': '07', 'sierpnia': '08',
        'września': '09', 'października': '10', 'listopada': '11', 'grudnia': '12'
      };

      for (const [monthName, monthNum] of Object.entries(months)) {
        const match = dateStr.match(new RegExp(`(\\d{1,2})\\s+${monthName}\\s+(\\d{4})`, 'i'));
        if (match) {
          return `${match[2]}-${monthNum}-${match[1].padStart(2, '0')}`;
        }
      }

      return dateStr;
    };

    // Normalize currency amounts
    const normalizeAmount = (amount: any): number => {
      if (typeof amount === 'number') return amount;
      if (typeof amount === 'string') {
        // Remove currency symbols and spaces
        const cleaned = amount.replace(/[złzlPLN\s]/gi, '').trim();
        // Handle Polish decimal format (1 234,56)
        const normalized = cleaned.replace(/\s/g, '').replace(',', '.');
        return parseFloat(normalized) || 0;
      }
      return 0;
    };

    // Normalize NIP
    const normalizeNip = (nip: string): string => {
      return nip?.replace(/\D/g, '') || '';
    };

    // Deep normalize object
    const normalize = (obj: any, path: string = ''): any => {
      if (obj === null || obj === undefined) return obj;

      if (Array.isArray(obj)) {
        return obj.map((item, i) => normalize(item, `${path}[${i}]`));
      }

      if (typeof obj === 'object') {
        const normalized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          const keyLower = key.toLowerCase();

          // Normalize dates
          if (keyLower.includes('date') || keyLower.includes('data')) {
            normalized[key] = normalizeDate(value as string);
          }
          // Normalize amounts
          else if (
            keyLower.includes('amount') || keyLower.includes('total') ||
            keyLower.includes('price') || keyLower.includes('kwota') ||
            keyLower.includes('cena') || keyLower.includes('wartosc') ||
            keyLower.includes('saldo') || keyLower.includes('balance')
          ) {
            normalized[key] = normalizeAmount(value);
          }
          // Normalize NIP
          else if (keyLower === 'nip') {
            normalized[key] = normalizeNip(value as string);
          }
          // Recurse
          else {
            normalized[key] = normalize(value, `${path}.${key}`);
          }
        }
        return normalized;
      }

      return obj;
    };

    return normalize(data);
  }

  /**
   * Extract fields with confidence scoring
   */
  private static extractFieldsWithConfidence(
    data: any,
    documentType: string,
    originalText: string
  ): ExtractedField[] {
    const fields: ExtractedField[] = [];

    const extractFromObject = (
      obj: any,
      category: string,
      prefix: string = ''
    ) => {
      for (const [key, value] of Object.entries(obj || {})) {
        if (value === null || value === undefined) continue;

        const fieldName = prefix ? `${prefix}.${key}` : key;

        if (typeof value === 'object' && !Array.isArray(value)) {
          // Recurse into nested objects
          extractFromObject(value, category, fieldName);
        } else if (!Array.isArray(value)) {
          // Calculate confidence based on presence in original text
          const valueStr = String(value);
          const confidence = this.calculateFieldConfidence(valueStr, originalText, key);

          fields.push({
            category,
            name: fieldName,
            value,
            type: this.inferFieldType(key, value),
            confidence,
            sourceText: this.findSourceText(valueStr, originalText)
          });
        }
      }
    };

    // Map document structure to categories
    if (documentType === 'INVOICE') {
      extractFromObject(data.seller, 'SELLER');
      extractFromObject(data.buyer, 'BUYER');
      extractFromObject(data.document, 'DOCUMENT');
      extractFromObject(data.totals, 'TOTALS');
      extractFromObject(data.payment, 'PAYMENT');
    } else if (documentType === 'RECEIPT') {
      extractFromObject(data.seller, 'SELLER');
      extractFromObject(data.receipt, 'DOCUMENT');
      extractFromObject(data.totals, 'TOTALS');
      extractFromObject(data.payment, 'PAYMENT');
    } else if (documentType === 'CONTRACT') {
      data.parties?.forEach((party: any) => {
        extractFromObject(party, 'CONTRACT', `party.${party.role}`);
      });
      extractFromObject(data.contract, 'CONTRACT');
      extractFromObject(data.terms, 'CONTRACT');
    } else if (documentType === 'BANK_STATEMENT') {
      extractFromObject(data.account, 'DOCUMENT');
      extractFromObject(data.period, 'DOCUMENT');
      extractFromObject(data.balances, 'TOTALS');
    }

    return fields;
  }

  /**
   * Calculate field confidence based on text matching
   */
  private static calculateFieldConfidence(
    value: string,
    originalText: string,
    fieldName: string
  ): number {
    if (!value || !originalText) return 0.5;

    const textLower = originalText.toLowerCase();
    const valueLower = value.toLowerCase();

    // Exact match
    if (originalText.includes(value)) return 0.95;
    if (textLower.includes(valueLower)) return 0.90;

    // Partial match (for normalized values)
    const valueWords = valueLower.split(/\s+/);
    const matchedWords = valueWords.filter(w => textLower.includes(w));
    if (matchedWords.length > 0) {
      return 0.7 + (0.2 * matchedWords.length / valueWords.length);
    }

    // Field-specific patterns
    if (fieldName.toLowerCase().includes('nip') && /^\d{10}$/.test(value)) {
      // Check if NIP appears in any format
      const nipVariations = [
        value,
        `${value.slice(0,3)}-${value.slice(3,6)}-${value.slice(6,8)}-${value.slice(8)}`
      ];
      if (nipVariations.some(v => originalText.includes(v))) return 0.95;
    }

    // Lower confidence for inferred values
    return 0.6;
  }

  /**
   * Find source text in original document
   */
  private static findSourceText(value: string, originalText: string): string | undefined {
    const index = originalText.indexOf(value);
    if (index === -1) return undefined;

    // Get surrounding context (50 chars before and after)
    const start = Math.max(0, index - 50);
    const end = Math.min(originalText.length, index + value.length + 50);

    return originalText.slice(start, end);
  }

  /**
   * Infer field type from name and value
   */
  private static inferFieldType(name: string, value: any): string {
    const nameLower = name.toLowerCase();

    if (nameLower === 'nip') return 'NIP';
    if (nameLower === 'regon') return 'REGON';
    if (nameLower.includes('iban') || nameLower.includes('account') || nameLower.includes('konto')) {
      return 'IBAN';
    }
    if (nameLower.includes('date') || nameLower.includes('data')) return 'DATE';
    if (
      nameLower.includes('amount') || nameLower.includes('total') ||
      nameLower.includes('price') || nameLower.includes('kwota') ||
      nameLower.includes('cena')
    ) return 'CURRENCY';
    if (nameLower.includes('rate') || nameLower.includes('stawka')) return 'PERCENTAGE';
    if (typeof value === 'boolean') return 'BOOLEAN';
    if (typeof value === 'number') return 'NUMBER';

    return 'STRING';
  }

  /**
   * Extract line items from structured data
   */
  private static extractLineItems(data: any, originalText: string): any[] {
    const items = data.lineItems || data.items || [];

    return items.map((item: any, index: number) => {
      const confidence = this.calculateFieldConfidence(
        item.description || item.name || '',
        originalText,
        'lineItem'
      );

      return {
        description: item.description || item.name,
        quantity: item.quantity || 1,
        unit: item.unit || 'szt.',
        unitPriceNet: item.unitPriceNet || item.unitPrice || 0,
        unitPriceGross: item.unitPriceGross,
        lineTotalNet: item.lineTotalNet || item.totalPrice || 0,
        lineTotalVat: item.lineTotalVat || item.vat || 0,
        lineTotalGross: item.lineTotalGross ||
          (item.lineTotalNet || 0) + (item.lineTotalVat || 0),
        vatRate: item.vatRate,
        vatRateCode: item.vatRateCode,
        gtuCode: item.gtuCode,
        pkwiuCode: item.pkwiuCode,
        confidence
      };
    });
  }

  /**
   * Extract transactions from bank statement
   */
  private static extractTransactions(data: any, originalText: string): any[] {
    const transactions = data.transactions || [];

    return transactions.map((tx: any) => {
      const confidence = this.calculateFieldConfidence(
        tx.description || '',
        originalText,
        'transaction'
      );

      return {
        transactionDate: tx.transactionDate,
        postingDate: tx.postingDate,
        valueDate: tx.valueDate,
        description: tx.description,
        reference: tx.reference,
        amount: tx.amount,
        currency: tx.currency || 'PLN',
        type: tx.type || (tx.amount >= 0 ? 'CREDIT' : 'DEBIT'),
        balanceAfter: tx.balanceAfter,
        counterparty: tx.counterparty,
        confidence
      };
    });
  }

  /**
   * Validate extracted data against business rules
   */
  private static async validateExtraction(
    data: any,
    documentType: string
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Validate NIP checksums
    const validateNip = (nip: string, fieldPath: string) => {
      if (!nip) return;
      try {
        polishNipSchema.parse(nip);
        results.push({
          field: fieldPath,
          status: 'VALID',
          message: 'NIP prawidłowy',
          severity: 'INFO'
        });
      } catch {
        results.push({
          field: fieldPath,
          status: 'INVALID',
          message: 'Nieprawidłowa suma kontrolna NIP',
          severity: 'ERROR'
        });
      }
    };

    // Validate IBAN
    const validateIban = (iban: string, fieldPath: string) => {
      if (!iban) return;
      try {
        polishIbanSchema.parse(iban);
        results.push({
          field: fieldPath,
          status: 'VALID',
          message: 'IBAN prawidłowy',
          severity: 'INFO'
        });
      } catch {
        results.push({
          field: fieldPath,
          status: 'INVALID',
          message: 'Nieprawidłowy numer IBAN',
          severity: 'ERROR'
        });
      }
    };

    if (documentType === 'INVOICE') {
      // Validate NIPs
      validateNip(data.seller?.nip, 'seller.nip');
      validateNip(data.buyer?.nip, 'buyer.nip');

      // Validate IBAN
      validateIban(data.seller?.bankAccount, 'seller.bankAccount');
      validateIban(data.payment?.bankAccount, 'payment.bankAccount');

      // Validate dates logic
      const issueDate = new Date(data.document?.issueDate);
      const saleDate = data.document?.saleDate ? new Date(data.document.saleDate) : null;
      const dueDate = data.document?.dueDate ? new Date(data.document.dueDate) : null;

      if (saleDate && saleDate > issueDate) {
        results.push({
          field: 'document.saleDate',
          status: 'WARNING',
          message: 'Data sprzedaży późniejsza niż data wystawienia',
          severity: 'WARNING'
        });
      }

      if (dueDate && dueDate < issueDate) {
        results.push({
          field: 'document.dueDate',
          status: 'WARNING',
          message: 'Termin płatności wcześniejszy niż data wystawienia',
          severity: 'WARNING'
        });
      }

      // Validate totals
      const lineItemsTotal = (data.lineItems || []).reduce(
        (sum: number, item: any) => sum + (item.lineTotalGross || 0), 0
      );
      const documentTotal = data.totals?.totalGross || 0;

      if (Math.abs(lineItemsTotal - documentTotal) > 0.01) {
        results.push({
          field: 'totals.totalGross',
          status: 'WARNING',
          message: `Suma pozycji (${lineItemsTotal.toFixed(2)}) różni się od sumy dokumentu (${documentTotal.toFixed(2)})`,
          severity: 'WARNING'
        });
      }

      // Validate VAT calculations
      for (const item of data.lineItems || []) {
        if (item.lineTotalNet && item.vatRate !== undefined && item.lineTotalVat !== undefined) {
          const expectedVat = item.lineTotalNet * (item.vatRate / 100);
          if (Math.abs(expectedVat - item.lineTotalVat) > 0.02) {
            results.push({
              field: `lineItem.${item.lineNumber}.vatAmount`,
              status: 'WARNING',
              message: `Obliczony VAT (${expectedVat.toFixed(2)}) różni się od podanego (${item.lineTotalVat.toFixed(2)})`,
              severity: 'WARNING'
            });
          }
        }
      }
    }

    if (documentType === 'BANK_STATEMENT') {
      validateIban(data.account?.accountNumber, 'account.accountNumber');

      // Validate balances
      const opening = data.balances?.opening || 0;
      const closing = data.balances?.closing || 0;
      const totalCredits = (data.transactions || [])
        .filter((tx: any) => tx.type === 'CREDIT')
        .reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0);
      const totalDebits = (data.transactions || [])
        .filter((tx: any) => tx.type === 'DEBIT')
        .reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0);

      const expectedClosing = opening + totalCredits - totalDebits;
      if (Math.abs(expectedClosing - closing) > 0.01) {
        results.push({
          field: 'balances.closing',
          status: 'WARNING',
          message: `Obliczone saldo końcowe (${expectedClosing.toFixed(2)}) różni się od podanego (${closing.toFixed(2)})`,
          severity: 'WARNING'
        });
      }
    }

    return results;
  }

  /**
   * Calculate overall confidence
   */
  private static calculateOverallConfidence(
    fields: ExtractedField[],
    validationResults: ValidationResult[]
  ): number {
    if (fields.length === 0) return 0;

    // Base confidence from fields
    const avgFieldConfidence = fields.reduce(
      (sum, f) => sum + f.confidence, 0
    ) / fields.length;

    // Penalty for validation errors
    const errorCount = validationResults.filter(v => v.status === 'INVALID').length;
    const warningCount = validationResults.filter(v => v.status === 'WARNING').length;
    const errorPenalty = errorCount * 0.1;
    const warningPenalty = warningCount * 0.03;

    return Math.max(0, Math.min(1, avgFieldConfidence - errorPenalty - warningPenalty));
  }

  /**
   * Update template statistics
   */
  private static async updateTemplateStats(
    templateId: string,
    confidence: number
  ): Promise<void> {
    await db.execute(`
      UPDATE extraction_templates
      SET
        total_count = total_count + 1,
        success_count = success_count + CASE WHEN $1 >= 0.85 THEN 1 ELSE 0 END,
        average_confidence = (
          (average_confidence * total_count + $1) / (total_count + 1)
        ),
        updated_at = NOW()
      WHERE id = $2
    `, [confidence, templateId]);
  }

  /**
   * Correct a field value
   */
  static async correctField(
    input: {
      extractionResultId: string;
      fieldId?: string;
      fieldName: string;
      fieldCategory: string;
      correctedValue: string;
      correctionReason?: string;
    },
    context: { userId: string; organizationId: string }
  ): Promise<void> {
    // Get original field
    const originalField = input.fieldId
      ? await db.query.extractedFields.findFirst({
          where: (f, { eq }) => eq(f.id, input.fieldId)
        })
      : null;

    // Update or create field
    if (originalField) {
      await db.update('extracted_fields')
        .set({
          fieldValue: input.correctedValue,
          isCorrected: true,
          originalValue: originalField.fieldValue,
          correctedBy: context.userId,
          correctedAt: new Date()
        })
        .where(eq('id', input.fieldId));
    }

    // Record correction for ML training
    await db.insert('extraction_corrections').values({
      extractionResultId: input.extractionResultId,
      fieldId: input.fieldId,
      fieldName: input.fieldName,
      originalValue: originalField?.fieldValue,
      correctedValue: input.correctedValue,
      correctionType: originalField ? 'VALUE_CHANGE' : 'FIELD_ADDED',
      correctedBy: context.userId,
      correctionReason: input.correctionReason,
      usedForTraining: false
    });

    // Update extraction result
    await db.update('extraction_results')
      .set({
        status: 'NEEDS_REVIEW',
        updatedAt: new Date()
      })
      .where(eq('id', input.extractionResultId));

    // Re-validate
    const result = await db.query.extractionResults.findFirst({
      where: (r, { eq }) => eq(r.id, input.extractionResultId)
    });

    if (result) {
      const validationResults = await this.validateExtraction(
        result.structuredData,
        result.documentType
      );

      await db.update('extraction_results')
        .set({
          validationResults,
          updatedAt: new Date()
        })
        .where(eq('id', input.extractionResultId));
    }

    // Audit log
    await createAuditLog({
      action: 'EXTRACTION_FIELD_CORRECTED',
      entityType: 'extraction_result',
      entityId: input.extractionResultId,
      userId: context.userId,
      organizationId: context.organizationId,
      metadata: {
        fieldName: input.fieldName,
        originalValue: originalField?.fieldValue,
        correctedValue: input.correctedValue,
        correctionReason: input.correctionReason
      }
    });
  }

  /**
   * Approve extraction results
   */
  static async approveExtraction(
    input: { extractionResultId: string; notes?: string },
    context: { userId: string; organizationId: string }
  ): Promise<void> {
    await db.update('extraction_results')
      .set({
        status: 'APPROVED',
        reviewedBy: context.userId,
        reviewedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq('id', input.extractionResultId));

    await createAuditLog({
      action: 'EXTRACTION_APPROVED',
      entityType: 'extraction_result',
      entityId: input.extractionResultId,
      userId: context.userId,
      organizationId: context.organizationId,
      metadata: { notes: input.notes }
    });
  }

  /**
   * Get extraction result by ID
   */
  static async getExtractionResult(
    id: string,
    context: { organizationId: string }
  ): Promise<any> {
    const result = await db.query.extractionResults.findFirst({
      where: (r, { eq, and }) => and(
        eq(r.id, id),
        eq(r.organizationId, context.organizationId)
      ),
      with: {
        extractedFields: true,
        extractedLineItems: true,
        extractedTransactions: true
      }
    });

    return result;
  }

  /**
   * Search extractions
   */
  static async searchExtractions(
    input: {
      documentType?: string;
      status?: string;
      confidenceMin?: number;
      dateFrom?: string;
      dateTo?: string;
      sellerNip?: string;
      buyerNip?: string;
      invoiceNumber?: string;
      amountMin?: number;
      amountMax?: number;
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
    context: { organizationId: string }
  ): Promise<{ results: any[]; total: number; page: number; pageSize: number }> {
    const page = input.page || 1;
    const pageSize = input.pageSize || 20;
    const offset = (page - 1) * pageSize;

    // Build query conditions
    const conditions: any[] = [
      eq('organization_id', context.organizationId)
    ];

    if (input.documentType) {
      conditions.push(eq('document_type', input.documentType));
    }
    if (input.status) {
      conditions.push(eq('status', input.status));
    }
    if (input.confidenceMin !== undefined) {
      conditions.push(gte('overall_confidence', input.confidenceMin));
    }
    if (input.dateFrom) {
      conditions.push(gte('created_at', new Date(input.dateFrom)));
    }
    if (input.dateTo) {
      conditions.push(lte('created_at', new Date(input.dateTo)));
    }

    // Query with JSON field searches
    let query = db.select().from('extraction_results');

    if (input.sellerNip) {
      query = query.where(
        sql`structured_data->'seller'->>'nip' = ${input.sellerNip.replace(/-/g, '')}`
      );
    }
    if (input.buyerNip) {
      query = query.where(
        sql`structured_data->'buyer'->>'nip' = ${input.buyerNip.replace(/-/g, '')}`
      );
    }
    if (input.invoiceNumber) {
      query = query.where(
        sql`structured_data->'document'->>'invoiceNumber' ILIKE ${`%${input.invoiceNumber}%`}`
      );
    }
    if (input.amountMin !== undefined) {
      query = query.where(
        sql`(structured_data->'totals'->>'totalGross')::numeric >= ${input.amountMin}`
      );
    }
    if (input.amountMax !== undefined) {
      query = query.where(
        sql`(structured_data->'totals'->>'totalGross')::numeric <= ${input.amountMax}`
      );
    }

    // Get total count
    const [{ count }] = await db.select({ count: sql`count(*)` })
      .from('extraction_results')
      .where(and(...conditions));

    // Get paginated results
    const results = await query
      .where(and(...conditions))
      .orderBy(
        input.sortOrder === 'asc'
          ? asc(input.sortBy || 'created_at')
          : desc(input.sortBy || 'created_at')
      )
      .limit(pageSize)
      .offset(offset);

    return {
      results,
      total: Number(count),
      page,
      pageSize
    };
  }
}
```

---

## 🌐 tRPC Router

```typescript
// src/server/routers/doc/ai-extraction.router.ts

import { router, protectedProcedure } from '@/server/trpc';
import {
  startExtractionSchema,
  correctFieldSchema,
  approveExtractionSchema,
  searchExtractionsSchema
} from './schemas';
import { AIExtractionService } from '@/services/document/ai-extraction.service';
import { z } from 'zod';

export const aiExtractionRouter = router({

  // Start extraction process
  startExtraction: protectedProcedure
    .input(startExtractionSchema)
    .mutation(async ({ input, ctx }) => {
      return AIExtractionService.startExtraction(input, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
    }),

  // Get extraction result
  getExtractionResult: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return AIExtractionService.getExtractionResult(input.id, {
        organizationId: ctx.user.organizationId
      });
    }),

  // Get extraction by document
  getByDocument: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const result = await db.query.extractionResults.findFirst({
        where: (r, { eq, and }) => and(
          eq(r.documentId, input.documentId),
          eq(r.organizationId, ctx.user.organizationId)
        ),
        with: {
          extractedFields: true,
          extractedLineItems: true,
          extractedTransactions: true
        },
        orderBy: (r, { desc }) => [desc(r.createdAt)]
      });
      return result;
    }),

  // Correct a field
  correctField: protectedProcedure
    .input(correctFieldSchema)
    .mutation(async ({ input, ctx }) => {
      await AIExtractionService.correctField(input, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
      return { success: true };
    }),

  // Approve extraction
  approveExtraction: protectedProcedure
    .input(approveExtractionSchema)
    .mutation(async ({ input, ctx }) => {
      await AIExtractionService.approveExtraction(input, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
      return { success: true };
    }),

  // Search extractions
  searchExtractions: protectedProcedure
    .input(searchExtractionsSchema)
    .query(async ({ input, ctx }) => {
      return AIExtractionService.searchExtractions(input, {
        organizationId: ctx.user.organizationId
      });
    }),

  // Re-extract document
  reExtract: protectedProcedure
    .input(z.object({
      extractionResultId: z.string().uuid(),
      options: z.object({
        useTemplate: z.boolean().default(true),
        extractLineItems: z.boolean().default(true),
        validateBusinessRules: z.boolean().default(true)
      }).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      // Get existing extraction
      const existing = await db.query.extractionResults.findFirst({
        where: (r, { eq, and }) => and(
          eq(r.id, input.extractionResultId),
          eq(r.organizationId, ctx.user.organizationId)
        )
      });

      if (!existing) {
        throw new Error('Nie znaleziono wyników ekstrakcji');
      }

      // Re-run extraction
      return AIExtractionService.startExtraction({
        documentId: existing.documentId,
        ocrResultId: existing.ocrResultId,
        documentType: existing.documentType,
        extractionOptions: input.options
      }, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
    }),

  // Get extraction statistics
  getStatistics: protectedProcedure
    .input(z.object({
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    }))
    .query(async ({ input, ctx }) => {
      const result = await db.execute(`
        SELECT
          document_type,
          COUNT(*) as total_count,
          COUNT(*) FILTER (WHERE status = 'APPROVED') as approved_count,
          COUNT(*) FILTER (WHERE status = 'NEEDS_REVIEW') as needs_review_count,
          AVG(overall_confidence) as avg_confidence,
          AVG(processing_time_ms) as avg_processing_time,
          SUM((token_usage->>'total')::int) as total_tokens
        FROM extraction_results
        WHERE organization_id = $1
          AND ($2::date IS NULL OR created_at >= $2::date)
          AND ($3::date IS NULL OR created_at <= $3::date)
        GROUP BY document_type
      `, [ctx.user.organizationId, input.dateFrom, input.dateTo]);

      return result.rows;
    }),

  // Get low confidence extractions for review
  getLowConfidenceExtractions: protectedProcedure
    .input(z.object({
      threshold: z.number().min(0).max(1).default(0.7),
      limit: z.number().int().min(1).max(100).default(20)
    }))
    .query(async ({ input, ctx }) => {
      return db.query.extractionResults.findMany({
        where: (r, { eq, and, lt }) => and(
          eq(r.organizationId, ctx.user.organizationId),
          eq(r.status, 'NEEDS_REVIEW'),
          lt(r.overallConfidence, input.threshold)
        ),
        orderBy: (r, { asc }) => [asc(r.overallConfidence)],
        limit: input.limit,
        with: {
          extractedFields: {
            where: (f, { lt }) => lt(f.confidence, input.threshold)
          }
        }
      });
    }),

  // Save extraction as template
  saveAsTemplate: protectedProcedure
    .input(z.object({
      extractionResultId: z.string().uuid(),
      templateName: z.string().min(1)
    }))
    .mutation(async ({ input, ctx }) => {
      const extraction = await db.query.extractionResults.findFirst({
        where: (r, { eq, and }) => and(
          eq(r.id, input.extractionResultId),
          eq(r.organizationId, ctx.user.organizationId)
        )
      });

      if (!extraction) {
        throw new Error('Nie znaleziono wyników ekstrakcji');
      }

      const sellerNip = extraction.structuredData?.seller?.nip;

      // Create or update template
      await db.insert('extraction_templates')
        .values({
          organizationId: ctx.user.organizationId,
          name: input.templateName,
          documentType: extraction.documentType,
          issuerNip: sellerNip,
          issuerName: extraction.structuredData?.seller?.name,
          fieldMappings: extraction.structuredData,
          extractionHints: {
            knownFields: Object.keys(extraction.structuredData || {}),
            avgConfidence: extraction.overallConfidence
          },
          isActive: true
        })
        .onConflictDoUpdate({
          target: ['organization_id', 'issuer_nip', 'document_type'],
          set: {
            name: input.templateName,
            fieldMappings: extraction.structuredData,
            extractionHints: sql`extraction_hints || ${JSON.stringify({
              updatedAt: new Date().toISOString()
            })}`,
            updatedAt: new Date()
          }
        });

      return { success: true };
    })
});
```

---

## 🧪 Test Specifications

### Unit Tests

```typescript
// __tests__/services/ai-extraction.service.test.ts

import { AIExtractionService } from '@/services/document/ai-extraction.service';

describe('AIExtractionService', () => {

  describe('Document Type Detection', () => {
    it('should detect INVOICE from Polish invoice text', async () => {
      const text = 'FAKTURA VAT nr 123/2024\nNIP sprzedawcy: 1234567890';
      const result = await AIExtractionService['detectDocumentType'](text);
      expect(result).toBe('INVOICE');
    });

    it('should detect RECEIPT from fiscal receipt text', async () => {
      const text = 'PARAGON FISKALNY\nNr unikatowy: ABC123';
      const result = await AIExtractionService['detectDocumentType'](text);
      expect(result).toBe('RECEIPT');
    });

    it('should detect CONTRACT from contract text', async () => {
      const text = 'UMOWA O ŚWIADCZENIE USŁUG\nStrony umowy:\nPrzedmiot umowy:';
      const result = await AIExtractionService['detectDocumentType'](text);
      expect(result).toBe('CONTRACT');
    });

    it('should detect BANK_STATEMENT from statement text', async () => {
      const text = 'WYCIĄG BANKOWY\nSaldo początkowe: 1000,00 PLN\nSaldo końcowe:';
      const result = await AIExtractionService['detectDocumentType'](text);
      expect(result).toBe('BANK_STATEMENT');
    });
  });

  describe('Data Normalization', () => {
    it('should normalize Polish date formats', () => {
      const data = {
        document: {
          issueDate: '15.01.2024',
          saleDate: '15 stycznia 2024'
        }
      };

      const normalized = AIExtractionService['normalizeExtractedData'](data, 'INVOICE');

      expect(normalized.document.issueDate).toBe('2024-01-15');
      expect(normalized.document.saleDate).toBe('2024-01-15');
    });

    it('should normalize Polish currency formats', () => {
      const data = {
        totals: {
          totalGross: '1 234,56 zł',
          totalNet: '1000,00 PLN'
        }
      };

      const normalized = AIExtractionService['normalizeExtractedData'](data, 'INVOICE');

      expect(normalized.totals.totalGross).toBe(1234.56);
      expect(normalized.totals.totalNet).toBe(1000.00);
    });

    it('should normalize NIP format', () => {
      const data = {
        seller: { nip: '123-456-78-90' }
      };

      const normalized = AIExtractionService['normalizeExtractedData'](data, 'INVOICE');

      expect(normalized.seller.nip).toBe('1234567890');
    });
  });

  describe('Field Confidence Calculation', () => {
    it('should return high confidence for exact matches', () => {
      const confidence = AIExtractionService['calculateFieldConfidence'](
        'Firma ABC Sp. z o.o.',
        'Sprzedawca: Firma ABC Sp. z o.o. NIP: 1234567890',
        'name'
      );
      expect(confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should return lower confidence for inferred values', () => {
      const confidence = AIExtractionService['calculateFieldConfidence'](
        'unknown value',
        'completely different text without match',
        'field'
      );
      expect(confidence).toBeLessThan(0.7);
    });

    it('should recognize NIP in different formats', () => {
      const confidence = AIExtractionService['calculateFieldConfidence'](
        '1234567890',
        'NIP: 123-456-78-90',
        'nip'
      );
      expect(confidence).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('Field Type Inference', () => {
    it('should identify NIP field type', () => {
      const type = AIExtractionService['inferFieldType']('nip', '1234567890');
      expect(type).toBe('NIP');
    });

    it('should identify date field type', () => {
      const type = AIExtractionService['inferFieldType']('issueDate', '2024-01-15');
      expect(type).toBe('DATE');
    });

    it('should identify currency field type', () => {
      const type = AIExtractionService['inferFieldType']('totalAmount', 1234.56);
      expect(type).toBe('CURRENCY');
    });

    it('should identify IBAN field type', () => {
      const type = AIExtractionService['inferFieldType']('bankAccount', 'PL61109010140000071219812874');
      expect(type).toBe('IBAN');
    });
  });

  describe('Business Rules Validation', () => {
    it('should validate NIP checksum', async () => {
      const data = {
        seller: { nip: '5260001546' }, // Valid NIP
        buyer: { nip: '1234567890' }   // Invalid NIP
      };

      const results = await AIExtractionService['validateExtraction'](data, 'INVOICE');

      const sellerNipResult = results.find(r => r.field === 'seller.nip');
      const buyerNipResult = results.find(r => r.field === 'buyer.nip');

      expect(sellerNipResult?.status).toBe('VALID');
      expect(buyerNipResult?.status).toBe('INVALID');
    });

    it('should validate date logic', async () => {
      const data = {
        document: {
          issueDate: '2024-01-15',
          saleDate: '2024-01-20', // After issue date - warning
          dueDate: '2024-01-10'   // Before issue date - warning
        }
      };

      const results = await AIExtractionService['validateExtraction'](data, 'INVOICE');

      const warnings = results.filter(r => r.status === 'WARNING');
      expect(warnings.length).toBe(2);
    });

    it('should validate line item totals', async () => {
      const data = {
        lineItems: [
          { lineTotalGross: 100 },
          { lineTotalGross: 200 }
        ],
        totals: { totalGross: 350 } // Mismatch - should be 300
      };

      const results = await AIExtractionService['validateExtraction'](data, 'INVOICE');

      const totalWarning = results.find(r => r.field === 'totals.totalGross');
      expect(totalWarning?.status).toBe('WARNING');
    });
  });

  describe('Overall Confidence Calculation', () => {
    it('should calculate average field confidence', () => {
      const fields = [
        { confidence: 0.9, category: 'SELLER', name: 'nip', value: '123', type: 'NIP' },
        { confidence: 0.8, category: 'SELLER', name: 'name', value: 'ABC', type: 'STRING' },
        { confidence: 0.7, category: 'BUYER', name: 'nip', value: '456', type: 'NIP' }
      ];

      const confidence = AIExtractionService['calculateOverallConfidence'](fields, []);

      expect(confidence).toBeCloseTo(0.8, 1);
    });

    it('should apply penalty for validation errors', () => {
      const fields = [
        { confidence: 0.9, category: 'SELLER', name: 'nip', value: '123', type: 'NIP' }
      ];
      const validationResults = [
        { field: 'seller.nip', status: 'INVALID' as const, message: 'Invalid', severity: 'ERROR' as const }
      ];

      const confidence = AIExtractionService['calculateOverallConfidence'](fields, validationResults);

      expect(confidence).toBeLessThan(0.9);
    });
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/ai-extraction.test.ts

import { db } from '@/lib/db';
import { aiExtractionRouter } from '@/server/routers/doc/ai-extraction.router';

describe('AI Extraction Integration', () => {
  const testOrganizationId = 'test-org-id';
  const testUserId = 'test-user-id';
  const testDocumentId = 'test-document-id';
  const testOcrResultId = 'test-ocr-result-id';

  beforeAll(async () => {
    // Setup test data
    await db.insert('organizations').values({
      id: testOrganizationId,
      name: 'Test Organization'
    });

    await db.insert('users').values({
      id: testUserId,
      organizationId: testOrganizationId,
      email: 'test@example.com'
    });

    await db.insert('documents').values({
      id: testDocumentId,
      organizationId: testOrganizationId,
      fileName: 'test-invoice.pdf'
    });

    await db.insert('ocr_results').values({
      id: testOcrResultId,
      documentId: testDocumentId,
      extractedText: `
        FAKTURA VAT nr FV/2024/001
        Data wystawienia: 15.01.2024
        Data sprzedaży: 15.01.2024

        Sprzedawca:
        Firma ABC Sp. z o.o.
        NIP: 5260001546
        ul. Testowa 1, 00-001 Warszawa

        Nabywca:
        Firma XYZ S.A.
        NIP: 7010000001
        ul. Przykładowa 2, 00-002 Kraków

        Pozycje:
        1. Usługa programistyczna - 10 godz. x 200,00 zł = 2000,00 zł netto, VAT 23%

        Razem netto: 2000,00 zł
        VAT 23%: 460,00 zł
        Razem brutto: 2460,00 zł

        Termin płatności: 14 dni
        Nr konta: PL61109010140000071219812874
      `
    });
  });

  afterAll(async () => {
    await db.delete('extraction_results').where(eq('organizationId', testOrganizationId));
    await db.delete('ocr_results').where(eq('documentId', testDocumentId));
    await db.delete('documents').where(eq('id', testDocumentId));
    await db.delete('users').where(eq('id', testUserId));
    await db.delete('organizations').where(eq('id', testOrganizationId));
  });

  it('should extract data from Polish invoice', async () => {
    const result = await AIExtractionService.startExtraction({
      documentId: testDocumentId,
      ocrResultId: testOcrResultId,
      documentType: 'INVOICE'
    }, {
      userId: testUserId,
      organizationId: testOrganizationId
    });

    expect(result.success).toBe(true);
    expect(result.documentType).toBe('INVOICE');
    expect(result.overallConfidence).toBeGreaterThan(0.7);

    // Check seller extraction
    expect(result.structuredData.seller.nip).toBe('5260001546');
    expect(result.structuredData.seller.name).toContain('ABC');

    // Check buyer extraction
    expect(result.structuredData.buyer.nip).toBe('7010000001');

    // Check document info
    expect(result.structuredData.document.invoiceNumber).toContain('FV/2024/001');
    expect(result.structuredData.document.issueDate).toBe('2024-01-15');

    // Check totals
    expect(result.structuredData.totals.totalNet).toBe(2000);
    expect(result.structuredData.totals.totalGross).toBe(2460);

    // Check line items
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0].lineTotalNet).toBe(2000);
    expect(result.lineItems[0].vatRate).toBe(23);
  });

  it('should save extraction result to database', async () => {
    const result = await AIExtractionService.startExtraction({
      documentId: testDocumentId,
      ocrResultId: testOcrResultId
    }, {
      userId: testUserId,
      organizationId: testOrganizationId
    });

    const savedResult = await db.query.extractionResults.findFirst({
      where: (r, { eq }) => eq(r.documentId, testDocumentId)
    });

    expect(savedResult).toBeTruthy();
    expect(savedResult?.documentType).toBe('INVOICE');
    expect(savedResult?.organizationId).toBe(testOrganizationId);
  });

  it('should apply RLS policies', async () => {
    // Set different organization context
    await db.execute(`SET app.current_organization_id = 'other-org-id'`);

    const results = await db.query.extractionResults.findMany({
      where: (r, { eq }) => eq(r.documentId, testDocumentId)
    });

    expect(results).toHaveLength(0);

    // Reset context
    await db.execute(`SET app.current_organization_id = '${testOrganizationId}'`);
  });

  it('should handle field corrections', async () => {
    const extraction = await db.query.extractionResults.findFirst({
      where: (r, { eq }) => eq(r.documentId, testDocumentId)
    });

    await AIExtractionService.correctField({
      extractionResultId: extraction!.id,
      fieldName: 'seller.name',
      fieldCategory: 'SELLER',
      correctedValue: 'Firma ABC Spółka z o.o.',
      correctionReason: 'Pełna nazwa firmy'
    }, {
      userId: testUserId,
      organizationId: testOrganizationId
    });

    const correction = await db.query.extractionCorrections.findFirst({
      where: (c, { eq }) => eq(c.extractionResultId, extraction!.id)
    });

    expect(correction).toBeTruthy();
    expect(correction?.correctedValue).toBe('Firma ABC Spółka z o.o.');
    expect(correction?.correctionType).toBe('VALUE_CHANGE');
  });

  it('should search extractions by criteria', async () => {
    const results = await AIExtractionService.searchExtractions({
      documentType: 'INVOICE',
      sellerNip: '5260001546',
      page: 1,
      pageSize: 10
    }, {
      organizationId: testOrganizationId
    });

    expect(results.results.length).toBeGreaterThan(0);
    expect(results.results[0].documentType).toBe('INVOICE');
  });
});
```

### E2E Tests

```typescript
// e2e/ai-extraction.spec.ts

import { test, expect } from '@playwright/test';

test.describe('AI Data Extraction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'accountant@test.pl');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should extract data from uploaded invoice', async ({ page }) => {
    await page.goto('/documents');

    // Upload test invoice
    await page.setInputFiles('input[type="file"]', 'e2e/fixtures/test-invoice.pdf');
    await page.waitForSelector('[data-testid="upload-success"]');

    // Wait for OCR and extraction
    await page.waitForSelector('[data-testid="extraction-complete"]', { timeout: 60000 });

    // Verify extracted data
    await page.click('[data-testid="view-extraction"]');

    // Check seller info
    await expect(page.locator('[data-field="seller.nip"]')).toContainText('526');
    await expect(page.locator('[data-field="seller.name"]')).not.toBeEmpty();

    // Check invoice number
    await expect(page.locator('[data-field="document.invoiceNumber"]')).not.toBeEmpty();

    // Check totals
    await expect(page.locator('[data-field="totals.totalGross"]')).not.toBeEmpty();

    // Check line items
    const lineItems = await page.locator('[data-testid="line-item"]').count();
    expect(lineItems).toBeGreaterThan(0);
  });

  test('should highlight low confidence fields', async ({ page }) => {
    await page.goto('/documents');

    // Upload blurry document
    await page.setInputFiles('input[type="file"]', 'e2e/fixtures/blurry-invoice.pdf');
    await page.waitForSelector('[data-testid="extraction-complete"]', { timeout: 60000 });

    await page.click('[data-testid="view-extraction"]');

    // Check for low confidence indicators
    const lowConfidenceFields = await page.locator('[data-confidence="low"]').count();
    expect(lowConfidenceFields).toBeGreaterThan(0);

    // Verify warning badge
    await expect(page.locator('[data-testid="needs-review-badge"]')).toBeVisible();
  });

  test('should allow field correction', async ({ page }) => {
    await page.goto('/documents');

    // Navigate to document with extraction
    await page.click('[data-testid="document-row"]:first-child');
    await page.click('[data-testid="view-extraction"]');

    // Click to edit seller name
    await page.click('[data-field="seller.name"] [data-testid="edit-button"]');

    // Enter corrected value
    await page.fill('[data-testid="field-input"]', 'Poprawiona Nazwa Sp. z o.o.');
    await page.fill('[data-testid="correction-reason"]', 'Korekta nazwy firmy');
    await page.click('[data-testid="save-correction"]');

    // Verify correction saved
    await expect(page.locator('[data-field="seller.name"]')).toContainText('Poprawiona Nazwa');
    await expect(page.locator('[data-testid="corrected-badge"]')).toBeVisible();
  });

  test('should approve extraction', async ({ page }) => {
    await page.goto('/documents');

    // Navigate to document needing review
    await page.click('[data-testid="needs-review-filter"]');
    await page.click('[data-testid="document-row"]:first-child');
    await page.click('[data-testid="view-extraction"]');

    // Approve extraction
    await page.click('[data-testid="approve-extraction"]');

    // Confirm approval
    await page.click('[data-testid="confirm-approve"]');

    // Verify status changed
    await expect(page.locator('[data-testid="status-badge"]')).toContainText('Zatwierdzono');
  });

  test('should display extraction statistics', async ({ page }) => {
    await page.goto('/documents/statistics');

    // Check statistics are displayed
    await expect(page.locator('[data-testid="total-extractions"]')).not.toBeEmpty();
    await expect(page.locator('[data-testid="avg-confidence"]')).not.toBeEmpty();
    await expect(page.locator('[data-testid="approval-rate"]')).not.toBeEmpty();

    // Check breakdown by document type
    const typeRows = await page.locator('[data-testid="type-statistics-row"]').count();
    expect(typeRows).toBeGreaterThan(0);
  });

  test('should handle bank statement extraction', async ({ page }) => {
    await page.goto('/documents');

    // Upload bank statement
    await page.setInputFiles('input[type="file"]', 'e2e/fixtures/bank-statement.pdf');
    await page.waitForSelector('[data-testid="extraction-complete"]', { timeout: 60000 });

    await page.click('[data-testid="view-extraction"]');

    // Check account info
    await expect(page.locator('[data-field="account.accountNumber"]')).toContainText('PL');

    // Check balances
    await expect(page.locator('[data-field="balances.opening"]')).not.toBeEmpty();
    await expect(page.locator('[data-field="balances.closing"]')).not.toBeEmpty();

    // Check transactions
    const transactions = await page.locator('[data-testid="transaction-row"]').count();
    expect(transactions).toBeGreaterThan(0);
  });

  test('should save extraction as template', async ({ page }) => {
    await page.goto('/documents');

    // Navigate to approved extraction
    await page.click('[data-testid="approved-filter"]');
    await page.click('[data-testid="document-row"]:first-child');
    await page.click('[data-testid="view-extraction"]');

    // Save as template
    await page.click('[data-testid="save-as-template"]');
    await page.fill('[data-testid="template-name"]', 'Szablon faktury ABC');
    await page.click('[data-testid="confirm-save-template"]');

    // Verify success message
    await expect(page.locator('[data-testid="toast-success"]')).toContainText('Szablon zapisany');

    // Verify template in list
    await page.goto('/settings/extraction-templates');
    await expect(page.locator('[data-testid="template-list"]')).toContainText('Szablon faktury ABC');
  });
});
```

---

## 🔒 Security Checklist

- [x] Organization isolation via RLS policies
- [x] User authentication required for all operations
- [x] Audit logging for extraction, corrections, and approvals
- [x] NIP/REGON validation prevents processing invalid identifiers
- [x] OpenAI API key stored in environment variables
- [x] Token usage tracked and logged
- [x] Rate limiting on extraction API calls
- [x] Sensitive data (bank accounts, NIPs) encrypted at rest
- [x] Correction history immutable for audit compliance
- [x] GDPR compliance - data retention policies respected

---

## 📊 Audit Events

| Event | Description | Data Captured |
|-------|-------------|---------------|
| `EXTRACTION_STARTED` | Extraction process initiated | documentId, documentType, options |
| `EXTRACTION_COMPLETED` | Extraction completed successfully | documentId, confidence, fieldCount, processingTime |
| `EXTRACTION_FAILED` | Extraction process failed | documentId, errorMessage |
| `EXTRACTION_FIELD_CORRECTED` | Field value manually corrected | fieldName, originalValue, correctedValue, reason |
| `EXTRACTION_APPROVED` | Extraction results approved by user | extractionResultId, notes |
| `EXTRACTION_REPROCESSED` | Document re-extracted | extractionResultId, newConfidence |
| `TEMPLATE_CREATED` | Extraction template saved | templateName, issuerNip, documentType |

---

## 📝 Implementation Notes

### AI Model Selection
- Primary model: GPT-4 Turbo for complex document understanding
- Fallback: GPT-3.5 Turbo for simple extractions
- Future consideration: Fine-tuned model for Polish accounting documents

### Polish Language Specifics
- Date formats: DD.MM.YYYY, DD-MM-YYYY, "DD miesiąca YYYY"
- Currency: space as thousand separator, comma as decimal
- NIP checksum: modulo 11 with weights [6,5,7,2,3,4,5,6,7]
- REGON checksum: different weights for 9 and 14 digit variants
- IBAN validation: modulo 97 with country code conversion

### Performance Considerations
- Target extraction time: <10s per document
- Batch processing for multiple documents
- Template caching for repeated issuers
- Async processing for large documents

### Learning and Improvement
- Corrections stored for ML training data
- Templates evolve based on successful extractions
- Confidence scoring improves with user feedback
- Regular model fine-tuning with accumulated data

### Integration Points
- OCR results from DOC-004 as input
- Extracted data feeds into ACC module for journal entries
- TAX module uses NIP data for White List verification
- WFA module can trigger workflows based on extraction results

---

## 🔗 Dependencies

### Depends On
- **DOC-004**: OCR Processing Engine (provides OCR results)
- **AIM**: User authentication and organization context

### Depended By
- **ACC**: Accounting journal entry creation from invoices
- **TAX**: Tax document processing for JPK
- **WFA**: Document-triggered workflow automation

---

*Story last updated: December 2024*
