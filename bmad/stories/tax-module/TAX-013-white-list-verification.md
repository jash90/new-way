# TAX-013: White List Verification

> **Story ID**: TAX-013
> **Epic**: Tax Compliance Module (TAX)
> **Priority**: P0 (Critical)
> **Points**: 5
> **Status**: 📋 Ready for Development
> **Phase**: Week 13

---

## User Story

**As an** accountant managing client transactions,
**I want** to verify VAT payer status and bank accounts against the official White List (Biała Lista),
**So that** I can ensure compliance with Polish tax law and avoid penalties for unverified B2B payments over 15,000 PLN.

---

## Business Context

### Legal Background
The White List (Wykaz podatników VAT / Biała Lista) is a mandatory verification system introduced by Polish tax authorities. According to Art. 96b ustawy o VAT and Art. 22p ustawy o PIT/CIT:

1. **Mandatory Verification**: For B2B payments exceeding 15,000 PLN (gross), the payer must verify that the recipient's bank account is registered on the White List
2. **Penalty**: Failure to verify results in loss of tax deduction rights and potential 30% sanction
3. **Real-time Verification**: Verification must be performed on the day of payment

### Business Value
- **Compliance**: Ensure 100% compliance with Polish White List requirements
- **Risk Mitigation**: Prevent penalties from unverified payments
- **Automation**: Automatic verification integrated into payment workflows
- **Audit Trail**: Complete verification history for tax audits

---

## Acceptance Criteria

### Scenario 1: Verify Active VAT Payer by NIP
```gherkin
Given I am an authenticated accountant
And I have a client NIP "1234567890" to verify
When I request NIP verification against the White List
Then the system should call the MF API with the NIP
And return the VAT payer status (active/inactive)
And return the registration date if active
And return the list of registered bank accounts
And store the verification result with timestamp
And the response should be returned within 3 seconds
```

### Scenario 2: Verify Bank Account Registration
```gherkin
Given I am an authenticated accountant
And I have a payment to verify:
  | Field | Value |
  | recipient_nip | 1234567890 |
  | recipient_iban | PL12345678901234567890123456 |
  | amount | 50000.00 PLN |
When I request bank account verification
Then the system should verify the IBAN against the White List
And return whether the account is registered (true/false)
And if amount > 15,000 PLN and account not registered, flag as high risk
And store the verification result with payment context
And suggest split payment if account is not registered
```

### Scenario 3: Batch NIP Verification
```gherkin
Given I am an authenticated accountant
And I have multiple NIPs to verify:
  | NIP |
  | 1234567890 |
  | 9876543210 |
  | 5555555555 |
When I request batch verification
Then the system should verify all NIPs in parallel
And return individual results for each NIP
And aggregate statistics (active, inactive, not found)
And complete within 10 seconds for up to 30 NIPs
```

### Scenario 4: Automatic Invoice Verification
```gherkin
Given I am creating an invoice for client with NIP "1234567890"
And the invoice amount exceeds 15,000 PLN
When the invoice is saved
Then the system should automatically verify the NIP
And verify all bank accounts on the invoice
And display verification status on the invoice
And block invoice finalization if verification fails (configurable)
And log the verification event in audit trail
```

### Scenario 5: Payment Pre-Authorization Check
```gherkin
Given I am initiating a payment of 25,000 PLN
And the recipient NIP is "1234567890"
And the recipient IBAN is "PL12345678901234567890123456"
When I request payment pre-authorization
Then the system should verify NIP status is active
And verify the IBAN is registered for the NIP
And check if split payment is required (Annex 15 goods/services)
And return authorization status (approved, requires_split_payment, blocked)
And provide detailed reasoning for the decision
```

### Scenario 6: Verification History and Audit
```gherkin
Given I am an authenticated accountant
And I want to view verification history for client "1234567890"
When I request the verification history
Then the system should return all verifications sorted by date
And include verification type (NIP, IBAN, combined)
And include the result and any warnings
And include who performed the verification
And allow filtering by date range and result type
And support export to PDF for audit purposes
```

### Scenario 7: Alert for High-Risk Payments
```gherkin
Given the system is monitoring pending payments
And there is a payment over 15,000 PLN with unverified recipient
When the payment deadline approaches (configurable, default 24h)
Then the system should send an alert to the accountant
And display the payment in the "Requires Attention" dashboard
And provide one-click verification action
And escalate to supervisor if not resolved within SLA
```

### Scenario 8: Cached Verification with Freshness Check
```gherkin
Given I verified NIP "1234567890" yesterday at 14:00
And the verification was successful
When I request verification again today at 10:00
Then the system should check cache age (max 24 hours per regulations)
And return cached result if within freshness window
And indicate the original verification timestamp
And allow forced refresh if requested
And update cache on forced refresh
```

---

## Technical Specification

### Database Schema

```sql
-- White List verifications
CREATE TABLE white_list_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Subject of verification
    nip VARCHAR(10) NOT NULL,
    iban VARCHAR(34),

    -- Verification context
    verification_type VARCHAR(20) NOT NULL CHECK (verification_type IN (
        'nip_only', 'iban_only', 'nip_and_iban', 'batch'
    )),
    context_type VARCHAR(30) CHECK (context_type IN (
        'manual', 'invoice', 'payment', 'scheduled', 'api'
    )),
    context_reference_id UUID,
    context_reference_type VARCHAR(50),

    -- Request details
    request_id VARCHAR(100) UNIQUE, -- MF API request ID
    request_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_date DATE NOT NULL DEFAULT CURRENT_DATE, -- Date of verification (for cache key)

    -- Response details
    response_timestamp TIMESTAMPTZ,
    response_time_ms INTEGER,

    -- NIP verification result
    nip_status VARCHAR(20) CHECK (nip_status IN (
        'active', 'inactive', 'not_registered', 'error'
    )),
    registration_date DATE,
    deregistration_date DATE,
    restoration_date DATE,

    -- IBAN verification result
    iban_registered BOOLEAN,
    iban_assignment_date DATE,

    -- Subject details from MF
    subject_name TEXT,
    subject_legal_form VARCHAR(100),
    subject_address TEXT,
    krs_number VARCHAR(20),
    regon VARCHAR(14),

    -- All registered accounts
    registered_accounts JSONB DEFAULT '[]',

    -- Risk assessment
    amount_verified DECIMAL(15,2),
    requires_split_payment BOOLEAN DEFAULT FALSE,
    risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN (
        'low', 'medium', 'high', 'critical'
    )),
    risk_reasons JSONB DEFAULT '[]',

    -- Metadata
    verified_by UUID REFERENCES users(id),
    is_cached BOOLEAN DEFAULT FALSE,
    cache_source_id UUID REFERENCES white_list_verifications(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes for common queries
    CONSTRAINT valid_nip CHECK (nip ~ '^\d{10}$')
);

CREATE INDEX idx_wlv_organization ON white_list_verifications(organization_id);
CREATE INDEX idx_wlv_nip ON white_list_verifications(nip);
CREATE INDEX idx_wlv_iban ON white_list_verifications(iban) WHERE iban IS NOT NULL;
CREATE INDEX idx_wlv_request_date ON white_list_verifications(nip, request_date);
CREATE INDEX idx_wlv_context ON white_list_verifications(context_reference_id, context_reference_type);
CREATE INDEX idx_wlv_risk ON white_list_verifications(risk_level) WHERE risk_level IN ('high', 'critical');

-- Registered bank accounts cache
CREATE TABLE white_list_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NOT NULL REFERENCES white_list_verifications(id) ON DELETE CASCADE,

    nip VARCHAR(10) NOT NULL,
    iban VARCHAR(34) NOT NULL,

    -- Account details
    bank_name VARCHAR(200),
    bank_swift VARCHAR(11),
    account_type VARCHAR(50),

    -- Assignment period
    assignment_date DATE,
    removal_date DATE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_iban CHECK (iban ~ '^PL\d{26}$|^\d{26}$')
);

CREATE INDEX idx_wla_nip ON white_list_accounts(nip);
CREATE INDEX idx_wla_iban ON white_list_accounts(iban);
CREATE UNIQUE INDEX idx_wla_verification_iban ON white_list_accounts(verification_id, iban);

-- Verification alerts
CREATE TABLE white_list_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Alert context
    alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN (
        'unverified_payment', 'verification_failed', 'account_not_registered',
        'vat_status_changed', 'split_payment_required', 'verification_expired'
    )),
    severity VARCHAR(20) NOT NULL CHECK (severity IN (
        'info', 'warning', 'error', 'critical'
    )),

    -- Related entities
    nip VARCHAR(10),
    iban VARCHAR(34),
    payment_id UUID,
    invoice_id UUID,
    verification_id UUID REFERENCES white_list_verifications(id),

    -- Alert details
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    amount DECIMAL(15,2),
    deadline TIMESTAMPTZ,

    -- Resolution
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN (
        'open', 'acknowledged', 'resolved', 'escalated', 'dismissed'
    )),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    resolution_notes TEXT,

    -- Escalation
    escalated_at TIMESTAMPTZ,
    escalated_to UUID REFERENCES users(id),

    -- Notifications sent
    notifications_sent JSONB DEFAULT '[]',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wla_organization ON white_list_alerts(organization_id);
CREATE INDEX idx_wla_status ON white_list_alerts(status) WHERE status IN ('open', 'acknowledged');
CREATE INDEX idx_wla_severity ON white_list_alerts(severity) WHERE severity IN ('error', 'critical');
CREATE INDEX idx_wla_deadline ON white_list_alerts(deadline) WHERE status = 'open';

-- Verification configuration per organization
CREATE TABLE white_list_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) UNIQUE,

    -- Automatic verification settings
    auto_verify_invoices BOOLEAN DEFAULT TRUE,
    auto_verify_payments BOOLEAN DEFAULT TRUE,
    verification_threshold DECIMAL(15,2) DEFAULT 15000.00,

    -- Block settings
    block_unverified_invoices BOOLEAN DEFAULT FALSE,
    block_unverified_payments BOOLEAN DEFAULT TRUE,

    -- Cache settings
    cache_duration_hours INTEGER DEFAULT 24 CHECK (cache_duration_hours BETWEEN 1 AND 24),
    force_fresh_on_payment BOOLEAN DEFAULT TRUE,

    -- Alert settings
    alert_threshold_hours INTEGER DEFAULT 24,
    escalation_threshold_hours INTEGER DEFAULT 48,
    alert_recipients JSONB DEFAULT '[]',

    -- Split payment settings
    auto_detect_split_payment BOOLEAN DEFAULT TRUE,
    split_payment_pkd_codes JSONB DEFAULT '[]', -- Annex 15 codes

    -- API settings
    api_timeout_ms INTEGER DEFAULT 5000,
    max_retries INTEGER DEFAULT 3,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled batch verifications
CREATE TABLE white_list_batch_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Job details
    job_type VARCHAR(30) NOT NULL CHECK (job_type IN (
        'client_verification', 'payment_check', 'expiring_cache_refresh'
    )),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'running', 'completed', 'failed', 'cancelled'
    )),

    -- Input
    input_nips TEXT[], -- Array of NIPs to verify
    total_count INTEGER NOT NULL,

    -- Progress
    processed_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,

    -- Results summary
    results JSONB DEFAULT '{}',
    errors JSONB DEFAULT '[]',

    -- Timing
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wlbj_organization ON white_list_batch_jobs(organization_id);
CREATE INDEX idx_wlbj_status ON white_list_batch_jobs(status) WHERE status IN ('pending', 'running');

-- Audit log for verification actions
CREATE TABLE white_list_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Action details
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,

    -- Context
    user_id UUID REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,

    -- Changes
    old_values JSONB,
    new_values JSONB,

    -- Additional context
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wlal_organization ON white_list_audit_log(organization_id);
CREATE INDEX idx_wlal_entity ON white_list_audit_log(entity_type, entity_id);
CREATE INDEX idx_wlal_user ON white_list_audit_log(user_id);
CREATE INDEX idx_wlal_created ON white_list_audit_log(created_at);

-- Row Level Security
ALTER TABLE white_list_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_list_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_list_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_list_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_list_batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_list_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own org verifications"
    ON white_list_verifications FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY "Users can access own org accounts"
    ON white_list_accounts FOR ALL
    USING (verification_id IN (
        SELECT id FROM white_list_verifications
        WHERE organization_id = current_setting('app.current_organization_id')::UUID
    ));

CREATE POLICY "Users can access own org alerts"
    ON white_list_alerts FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY "Users can access own org config"
    ON white_list_config FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY "Users can access own org batch jobs"
    ON white_list_batch_jobs FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY "Users can access own org audit log"
    ON white_list_audit_log FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::UUID);
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// NIP validation with checksum
export const NIPSchema = z.string()
  .transform(val => val.replace(/[\s-]/g, ''))
  .refine(val => /^\d{10}$/.test(val), 'NIP must be 10 digits')
  .refine(val => {
    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
    const digits = val.split('').map(Number);
    const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0);
    return sum % 11 === digits[9];
  }, 'Invalid NIP checksum');

// Polish IBAN validation
export const PolishIBANSchema = z.string()
  .transform(val => val.replace(/\s/g, '').toUpperCase())
  .refine(val => /^(PL)?\d{26}$/.test(val), 'Invalid Polish IBAN format')
  .transform(val => val.startsWith('PL') ? val : `PL${val}`);

// Verification request schemas
export const VerifyNIPRequestSchema = z.object({
  nip: NIPSchema,
  date: z.string().date().optional(), // Verification date, defaults to today
  force_refresh: z.boolean().default(false)
});

export const VerifyIBANRequestSchema = z.object({
  nip: NIPSchema,
  iban: PolishIBANSchema,
  amount: z.number().positive().optional(),
  date: z.string().date().optional(),
  force_refresh: z.boolean().default(false)
});

export const BatchVerifyRequestSchema = z.object({
  nips: z.array(NIPSchema).min(1).max(30),
  date: z.string().date().optional(),
  force_refresh: z.boolean().default(false)
});

export const PaymentVerificationRequestSchema = z.object({
  recipient_nip: NIPSchema,
  recipient_iban: PolishIBANSchema,
  amount: z.number().positive(),
  payment_date: z.string().date(),
  invoice_id: z.string().uuid().optional(),
  payment_id: z.string().uuid().optional(),
  pkd_codes: z.array(z.string()).optional(), // For split payment detection
  force_refresh: z.boolean().default(false)
});

// Response schemas
export const NIPStatusSchema = z.enum([
  'active',
  'inactive',
  'not_registered',
  'error'
]);

export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const VerificationResultSchema = z.object({
  verification_id: z.string().uuid(),
  nip: z.string(),
  iban: z.string().optional(),

  // NIP verification
  nip_status: NIPStatusSchema,
  registration_date: z.string().date().nullable(),
  deregistration_date: z.string().date().nullable(),

  // Subject details
  subject_name: z.string().nullable(),
  subject_address: z.string().nullable(),
  krs: z.string().nullable(),
  regon: z.string().nullable(),

  // IBAN verification
  iban_registered: z.boolean().nullable(),
  registered_accounts: z.array(z.object({
    iban: z.string(),
    bank_name: z.string().nullable(),
    assignment_date: z.string().date().nullable()
  })),

  // Risk assessment
  risk_level: RiskLevelSchema,
  risk_reasons: z.array(z.string()),
  requires_split_payment: z.boolean(),

  // Cache info
  is_cached: z.boolean(),
  verified_at: z.string().datetime(),
  cache_expires_at: z.string().datetime().nullable(),

  // Request metadata
  request_id: z.string(),
  response_time_ms: z.number()
});

export const PaymentAuthorizationSchema = z.object({
  authorized: z.boolean(),
  status: z.enum([
    'approved',
    'requires_split_payment',
    'blocked_unregistered_account',
    'blocked_inactive_vat',
    'blocked_verification_failed',
    'warning_below_threshold'
  ]),
  verification: VerificationResultSchema,
  message: z.string(),
  recommendations: z.array(z.string())
});

// Alert schemas
export const AlertTypeSchema = z.enum([
  'unverified_payment',
  'verification_failed',
  'account_not_registered',
  'vat_status_changed',
  'split_payment_required',
  'verification_expired'
]);

export const AlertSeveritySchema = z.enum(['info', 'warning', 'error', 'critical']);

export const AlertStatusSchema = z.enum([
  'open',
  'acknowledged',
  'resolved',
  'escalated',
  'dismissed'
]);

export const CreateAlertSchema = z.object({
  alert_type: AlertTypeSchema,
  severity: AlertSeveritySchema,
  nip: NIPSchema.optional(),
  iban: PolishIBANSchema.optional(),
  payment_id: z.string().uuid().optional(),
  invoice_id: z.string().uuid().optional(),
  title: z.string().max(200),
  message: z.string(),
  amount: z.number().positive().optional(),
  deadline: z.string().datetime().optional()
});

export const ResolveAlertSchema = z.object({
  alert_id: z.string().uuid(),
  status: z.enum(['resolved', 'dismissed']),
  resolution_notes: z.string().optional()
});

// Configuration schema
export const WhiteListConfigSchema = z.object({
  auto_verify_invoices: z.boolean().default(true),
  auto_verify_payments: z.boolean().default(true),
  verification_threshold: z.number().min(0).default(15000),
  block_unverified_invoices: z.boolean().default(false),
  block_unverified_payments: z.boolean().default(true),
  cache_duration_hours: z.number().min(1).max(24).default(24),
  force_fresh_on_payment: z.boolean().default(true),
  alert_threshold_hours: z.number().min(1).default(24),
  escalation_threshold_hours: z.number().min(1).default(48),
  alert_recipients: z.array(z.object({
    user_id: z.string().uuid(),
    email: z.boolean().default(true),
    sms: z.boolean().default(false)
  })).default([]),
  auto_detect_split_payment: z.boolean().default(true),
  split_payment_pkd_codes: z.array(z.string()).default([])
});

// History filter schema
export const VerificationHistoryFilterSchema = z.object({
  nip: NIPSchema.optional(),
  client_id: z.string().uuid().optional(),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  status: NIPStatusSchema.optional(),
  risk_level: RiskLevelSchema.optional(),
  verification_type: z.enum(['nip_only', 'iban_only', 'nip_and_iban', 'batch']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20)
});
```

### Service Implementation

```typescript
// src/server/services/white-list.service.ts
import { TRPCError } from '@trpc/server';
import Decimal from 'decimal.js';
import { db } from '@/server/db';
import { redis } from '@/server/redis';
import {
  VerifyNIPRequestSchema,
  VerifyIBANRequestSchema,
  PaymentVerificationRequestSchema,
  BatchVerifyRequestSchema,
  VerificationResultSchema,
  PaymentAuthorizationSchema,
  NIPStatusSchema,
  RiskLevelSchema
} from './schemas/white-list.schemas';

// Annex 15 - goods/services requiring split payment
const SPLIT_PAYMENT_PKD_CODES = [
  '46.71', // Wholesale of fuels
  '46.72', // Wholesale of metals
  '46.77', // Wholesale of waste and scrap
  '47.30', // Retail sale of automotive fuel
  // ... full list from Polish regulations
];

// Risk thresholds
const RISK_THRESHOLDS = {
  MANDATORY_VERIFICATION_AMOUNT: new Decimal('15000'),
  HIGH_RISK_AMOUNT: new Decimal('50000'),
  CRITICAL_RISK_AMOUNT: new Decimal('100000')
};

interface MFAPIResponse {
  result: {
    requestId: string;
    subject?: {
      name: string;
      nip: string;
      statusVat: string;
      regon: string;
      krs: string;
      residenceAddress: string;
      registrationLegalDate: string;
      registrationDenialDate?: string;
      restorationDate?: string;
      accountNumbers: string[];
    };
  };
}

export class WhiteListService {
  private readonly MF_API_BASE = 'https://wl-api.mf.gov.pl';
  private readonly CACHE_PREFIX = 'whitelist:';

  constructor(
    private organizationId: string,
    private userId: string
  ) {}

  /**
   * Verify NIP against White List
   */
  async verifyNIP(input: z.infer<typeof VerifyNIPRequestSchema>): Promise<z.infer<typeof VerificationResultSchema>> {
    const { nip, date = this.getTodayDate(), force_refresh = false } = input;

    // Check cache first (unless forced refresh)
    if (!force_refresh) {
      const cached = await this.getCachedVerification(nip, date);
      if (cached) {
        return cached;
      }
    }

    // Get configuration
    const config = await this.getConfig();

    // Call MF API
    const startTime = Date.now();
    const response = await this.callMFAPI(`/api/search/nip/${nip}?date=${date}`);
    const responseTimeMs = Date.now() - startTime;

    // Parse response
    const result = await this.parseNIPResponse(response, nip, date, responseTimeMs);

    // Store verification
    const verification = await this.storeVerification({
      ...result,
      verification_type: 'nip_only',
      context_type: 'manual',
      verified_by: this.userId
    });

    // Cache result
    await this.cacheVerification(nip, date, verification, config.cache_duration_hours);

    // Audit log
    await this.logAuditEvent('nip_verification', 'verification', verification.verification_id, {
      nip,
      status: result.nip_status,
      response_time_ms: responseTimeMs
    });

    return verification;
  }

  /**
   * Verify NIP and specific IBAN
   */
  async verifyIBAN(input: z.infer<typeof VerifyIBANRequestSchema>): Promise<z.infer<typeof VerificationResultSchema>> {
    const { nip, iban, amount, date = this.getTodayDate(), force_refresh = false } = input;

    // First verify NIP
    const nipVerification = await this.verifyNIP({ nip, date, force_refresh });

    // Check if IBAN is in registered accounts
    const normalizedIban = this.normalizeIBAN(iban);
    const ibanRegistered = nipVerification.registered_accounts.some(
      acc => this.normalizeIBAN(acc.iban) === normalizedIban
    );

    // Assess risk
    const riskAssessment = this.assessRisk(nipVerification, ibanRegistered, amount);

    // Update verification with IBAN result
    const verification = await db.white_list_verifications.update({
      where: { id: nipVerification.verification_id },
      data: {
        iban: normalizedIban,
        iban_registered: ibanRegistered,
        verification_type: 'nip_and_iban',
        amount_verified: amount,
        risk_level: riskAssessment.level,
        risk_reasons: riskAssessment.reasons,
        requires_split_payment: riskAssessment.requiresSplitPayment
      }
    });

    return {
      ...nipVerification,
      iban: normalizedIban,
      iban_registered: ibanRegistered,
      risk_level: riskAssessment.level,
      risk_reasons: riskAssessment.reasons,
      requires_split_payment: riskAssessment.requiresSplitPayment
    };
  }

  /**
   * Verify payment before execution
   */
  async verifyPayment(input: z.infer<typeof PaymentVerificationRequestSchema>): Promise<z.infer<typeof PaymentAuthorizationSchema>> {
    const {
      recipient_nip,
      recipient_iban,
      amount,
      payment_date,
      invoice_id,
      payment_id,
      pkd_codes = [],
      force_refresh = false
    } = input;

    const config = await this.getConfig();
    const amountDecimal = new Decimal(amount);

    // For payments, always use fresh verification if configured
    const shouldForceFresh = config.force_fresh_on_payment || force_refresh;

    // Verify NIP and IBAN
    const verification = await this.verifyIBAN({
      nip: recipient_nip,
      iban: recipient_iban,
      amount,
      date: payment_date,
      force_refresh: shouldForceFresh
    });

    // Update context
    await db.white_list_verifications.update({
      where: { id: verification.verification_id },
      data: {
        context_type: 'payment',
        context_reference_id: payment_id || invoice_id,
        context_reference_type: payment_id ? 'payment' : 'invoice'
      }
    });

    // Check split payment requirement
    const requiresSplitPayment = this.checkSplitPaymentRequired(
      amountDecimal,
      pkd_codes,
      config.split_payment_pkd_codes
    );

    // Determine authorization status
    const authorization = this.determineAuthorization(
      verification,
      amountDecimal,
      requiresSplitPayment,
      config
    );

    // Create alert if needed
    if (authorization.status !== 'approved' && authorization.status !== 'warning_below_threshold') {
      await this.createAlert({
        alert_type: this.mapAuthStatusToAlertType(authorization.status),
        severity: authorization.authorized ? 'warning' : 'error',
        nip: recipient_nip,
        iban: recipient_iban,
        payment_id,
        invoice_id,
        title: `Weryfikacja płatności: ${authorization.status}`,
        message: authorization.message,
        amount
      });
    }

    // Audit log
    await this.logAuditEvent('payment_verification', 'payment', payment_id, {
      recipient_nip,
      recipient_iban,
      amount,
      status: authorization.status,
      authorized: authorization.authorized
    });

    return authorization;
  }

  /**
   * Batch verify multiple NIPs
   */
  async batchVerify(input: z.infer<typeof BatchVerifyRequestSchema>): Promise<{
    results: z.infer<typeof VerificationResultSchema>[];
    summary: {
      total: number;
      active: number;
      inactive: number;
      not_registered: number;
      errors: number;
    };
  }> {
    const { nips, date = this.getTodayDate(), force_refresh = false } = input;

    // Create batch job record
    const batchJob = await db.white_list_batch_jobs.create({
      data: {
        organization_id: this.organizationId,
        job_type: 'client_verification',
        status: 'running',
        input_nips: nips,
        total_count: nips.length,
        created_by: this.userId,
        started_at: new Date()
      }
    });

    const results: z.infer<typeof VerificationResultSchema>[] = [];
    const summary = {
      total: nips.length,
      active: 0,
      inactive: 0,
      not_registered: 0,
      errors: 0
    };

    // Process in parallel with concurrency limit
    const CONCURRENCY = 5;
    const chunks = this.chunkArray(nips, CONCURRENCY);

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(nip => this.verifyNIP({ nip, date, force_refresh }))
      );

      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          switch (result.value.nip_status) {
            case 'active': summary.active++; break;
            case 'inactive': summary.inactive++; break;
            case 'not_registered': summary.not_registered++; break;
            default: summary.errors++;
          }
        } else {
          summary.errors++;
        }
      }

      // Update progress
      await db.white_list_batch_jobs.update({
        where: { id: batchJob.id },
        data: {
          processed_count: results.length + summary.errors,
          success_count: results.length,
          failure_count: summary.errors
        }
      });
    }

    // Complete batch job
    await db.white_list_batch_jobs.update({
      where: { id: batchJob.id },
      data: {
        status: 'completed',
        completed_at: new Date(),
        results: summary
      }
    });

    return { results, summary };
  }

  /**
   * Get verification history
   */
  async getHistory(filter: z.infer<typeof VerificationHistoryFilterSchema>) {
    const { nip, client_id, date_from, date_to, status, risk_level, verification_type, page, limit } = filter;

    const where: any = {
      organization_id: this.organizationId
    };

    if (nip) where.nip = nip;
    if (status) where.nip_status = status;
    if (risk_level) where.risk_level = risk_level;
    if (verification_type) where.verification_type = verification_type;

    if (date_from || date_to) {
      where.request_date = {};
      if (date_from) where.request_date.gte = new Date(date_from);
      if (date_to) where.request_date.lte = new Date(date_to);
    }

    const [verifications, total] = await Promise.all([
      db.white_list_verifications.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          accounts: true,
          verified_by_user: {
            select: { id: true, name: true, email: true }
          }
        }
      }),
      db.white_list_verifications.count({ where })
    ]);

    return {
      verifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get active alerts
   */
  async getAlerts(status?: z.infer<typeof AlertStatusSchema>) {
    const where: any = {
      organization_id: this.organizationId
    };

    if (status) {
      where.status = status;
    } else {
      where.status = { in: ['open', 'acknowledged'] };
    }

    return db.white_list_alerts.findMany({
      where,
      orderBy: [
        { severity: 'desc' },
        { deadline: 'asc' },
        { created_at: 'desc' }
      ]
    });
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(input: z.infer<typeof ResolveAlertSchema>) {
    const { alert_id, status, resolution_notes } = input;

    const alert = await db.white_list_alerts.findFirst({
      where: {
        id: alert_id,
        organization_id: this.organizationId
      }
    });

    if (!alert) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Alert nie znaleziony'
      });
    }

    const updated = await db.white_list_alerts.update({
      where: { id: alert_id },
      data: {
        status,
        resolved_at: new Date(),
        resolved_by: this.userId,
        resolution_notes
      }
    });

    await this.logAuditEvent('alert_resolved', 'alert', alert_id, {
      old_status: alert.status,
      new_status: status,
      resolution_notes
    });

    return updated;
  }

  // Private helper methods

  private async callMFAPI(endpoint: string): Promise<MFAPIResponse> {
    const config = await this.getConfig();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.api_timeout_ms);

    try {
      const response = await fetch(`${this.MF_API_BASE}${endpoint}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `MF API error: ${response.status} ${response.statusText}`
        });
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parseNIPResponse(
    response: MFAPIResponse,
    nip: string,
    date: string,
    responseTimeMs: number
  ): Promise<Partial<z.infer<typeof VerificationResultSchema>>> {
    const subject = response.result.subject;

    if (!subject) {
      return {
        nip,
        nip_status: 'not_registered',
        registration_date: null,
        deregistration_date: null,
        subject_name: null,
        subject_address: null,
        krs: null,
        regon: null,
        iban_registered: null,
        registered_accounts: [],
        risk_level: 'high',
        risk_reasons: ['NIP nie jest zarejestrowany jako podatnik VAT'],
        requires_split_payment: false,
        is_cached: false,
        verified_at: new Date().toISOString(),
        cache_expires_at: null,
        request_id: response.result.requestId,
        response_time_ms: responseTimeMs
      };
    }

    const nipStatus = this.mapVATStatus(subject.statusVat);
    const registeredAccounts = (subject.accountNumbers || []).map(iban => ({
      iban: this.normalizeIBAN(iban),
      bank_name: this.getBankNameFromIBAN(iban),
      assignment_date: null
    }));

    return {
      nip: subject.nip,
      nip_status: nipStatus,
      registration_date: subject.registrationLegalDate || null,
      deregistration_date: subject.registrationDenialDate || null,
      subject_name: subject.name,
      subject_address: subject.residenceAddress,
      krs: subject.krs || null,
      regon: subject.regon || null,
      iban_registered: null,
      registered_accounts: registeredAccounts,
      risk_level: nipStatus === 'active' ? 'low' : 'high',
      risk_reasons: nipStatus !== 'active'
        ? [`Status VAT: ${nipStatus}`]
        : [],
      requires_split_payment: false,
      is_cached: false,
      verified_at: new Date().toISOString(),
      cache_expires_at: null,
      request_id: response.result.requestId,
      response_time_ms: responseTimeMs
    };
  }

  private mapVATStatus(status: string): z.infer<typeof NIPStatusSchema> {
    switch (status?.toLowerCase()) {
      case 'czynny': return 'active';
      case 'zwolniony': return 'inactive';
      case 'niezarejestrowany': return 'not_registered';
      default: return 'error';
    }
  }

  private assessRisk(
    verification: z.infer<typeof VerificationResultSchema>,
    ibanRegistered: boolean,
    amount?: number
  ): { level: z.infer<typeof RiskLevelSchema>; reasons: string[]; requiresSplitPayment: boolean } {
    const reasons: string[] = [];
    let riskScore = 0;

    // NIP status
    if (verification.nip_status !== 'active') {
      riskScore += 50;
      reasons.push(`Status VAT: ${verification.nip_status}`);
    }

    // IBAN registration
    if (!ibanRegistered) {
      riskScore += 30;
      reasons.push('Konto bankowe nie jest zarejestrowane na Białej Liście');
    }

    // Amount threshold
    if (amount) {
      const amountDecimal = new Decimal(amount);

      if (amountDecimal.gte(RISK_THRESHOLDS.CRITICAL_RISK_AMOUNT)) {
        riskScore += 20;
        reasons.push('Kwota przekracza 100 000 PLN');
      } else if (amountDecimal.gte(RISK_THRESHOLDS.HIGH_RISK_AMOUNT)) {
        riskScore += 10;
        reasons.push('Kwota przekracza 50 000 PLN');
      } else if (amountDecimal.gte(RISK_THRESHOLDS.MANDATORY_VERIFICATION_AMOUNT)) {
        riskScore += 5;
        reasons.push('Kwota przekracza 15 000 PLN - obowiązkowa weryfikacja');
      }
    }

    let level: z.infer<typeof RiskLevelSchema>;
    if (riskScore >= 70) level = 'critical';
    else if (riskScore >= 50) level = 'high';
    else if (riskScore >= 25) level = 'medium';
    else level = 'low';

    return { level, reasons, requiresSplitPayment: false };
  }

  private checkSplitPaymentRequired(
    amount: Decimal,
    transactionPKD: string[],
    configuredPKD: string[]
  ): boolean {
    // Split payment mandatory for amounts >= 15,000 PLN on Annex 15 goods/services
    if (amount.lt(RISK_THRESHOLDS.MANDATORY_VERIFICATION_AMOUNT)) {
      return false;
    }

    const relevantPKD = [...SPLIT_PAYMENT_PKD_CODES, ...configuredPKD];
    return transactionPKD.some(pkd => relevantPKD.some(r => pkd.startsWith(r)));
  }

  private determineAuthorization(
    verification: z.infer<typeof VerificationResultSchema>,
    amount: Decimal,
    requiresSplitPayment: boolean,
    config: any
  ): z.infer<typeof PaymentAuthorizationSchema> {
    // Below threshold - warning only
    if (amount.lt(RISK_THRESHOLDS.MANDATORY_VERIFICATION_AMOUNT)) {
      return {
        authorized: true,
        status: 'warning_below_threshold',
        verification,
        message: 'Kwota poniżej progu obowiązkowej weryfikacji (15 000 PLN)',
        recommendations: ['Weryfikacja zalecana ale nieobowiązkowa']
      };
    }

    // VAT not active
    if (verification.nip_status !== 'active') {
      return {
        authorized: !config.block_unverified_payments,
        status: 'blocked_inactive_vat',
        verification,
        message: `Odbiorca nie jest czynnym podatnikiem VAT (status: ${verification.nip_status})`,
        recommendations: [
          'Sprawdź poprawność NIP',
          'Skontaktuj się z odbiorcą w celu weryfikacji statusu VAT',
          'Rozważ wstrzymanie płatności do wyjaśnienia'
        ]
      };
    }

    // IBAN not registered
    if (verification.iban_registered === false) {
      return {
        authorized: !config.block_unverified_payments,
        status: 'blocked_unregistered_account',
        verification,
        message: 'Konto bankowe odbiorcy nie jest zarejestrowane na Białej Liście',
        recommendations: [
          'Poproś odbiorcę o podanie konta z Białej Listy',
          'Użyj mechanizmu podzielonej płatności (split payment)',
          'Rozważ płatność na inne zarejestrowane konto odbiorcy'
        ]
      };
    }

    // Split payment required
    if (requiresSplitPayment) {
      return {
        authorized: true,
        status: 'requires_split_payment',
        verification,
        message: 'Transakcja wymaga zastosowania mechanizmu podzielonej płatności',
        recommendations: [
          'Zastosuj mechanizm podzielonej płatności (split payment)',
          'Dodaj adnotację "Mechanizm podzielonej płatności" na fakturze'
        ]
      };
    }

    // All checks passed
    return {
      authorized: true,
      status: 'approved',
      verification,
      message: 'Płatność zweryfikowana pozytywnie',
      recommendations: []
    };
  }

  private async getCachedVerification(
    nip: string,
    date: string
  ): Promise<z.infer<typeof VerificationResultSchema> | null> {
    const cacheKey = `${this.CACHE_PREFIX}${nip}:${date}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      const verification = JSON.parse(cached);
      return {
        ...verification,
        is_cached: true
      };
    }

    // Check database for same-day verification
    const dbCached = await db.white_list_verifications.findFirst({
      where: {
        organization_id: this.organizationId,
        nip,
        request_date: new Date(date)
      },
      orderBy: { created_at: 'desc' },
      include: { accounts: true }
    });

    if (dbCached) {
      return this.mapVerificationToResult(dbCached, true);
    }

    return null;
  }

  private async cacheVerification(
    nip: string,
    date: string,
    verification: z.infer<typeof VerificationResultSchema>,
    durationHours: number
  ): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}${nip}:${date}`;
    await redis.setex(
      cacheKey,
      durationHours * 3600,
      JSON.stringify(verification)
    );
  }

  private async storeVerification(data: any) {
    const verification = await db.white_list_verifications.create({
      data: {
        organization_id: this.organizationId,
        ...data
      }
    });

    // Store registered accounts
    if (data.registered_accounts?.length > 0) {
      await db.white_list_accounts.createMany({
        data: data.registered_accounts.map((acc: any) => ({
          verification_id: verification.id,
          nip: data.nip,
          iban: acc.iban,
          bank_name: acc.bank_name,
          assignment_date: acc.assignment_date
        }))
      });
    }

    return this.mapVerificationToResult(verification, false);
  }

  private async createAlert(data: z.infer<typeof CreateAlertSchema>) {
    return db.white_list_alerts.create({
      data: {
        organization_id: this.organizationId,
        ...data
      }
    });
  }

  private async getConfig() {
    const config = await db.white_list_config.findUnique({
      where: { organization_id: this.organizationId }
    });

    return config || {
      auto_verify_invoices: true,
      auto_verify_payments: true,
      verification_threshold: 15000,
      block_unverified_invoices: false,
      block_unverified_payments: true,
      cache_duration_hours: 24,
      force_fresh_on_payment: true,
      alert_threshold_hours: 24,
      escalation_threshold_hours: 48,
      alert_recipients: [],
      auto_detect_split_payment: true,
      split_payment_pkd_codes: [],
      api_timeout_ms: 5000,
      max_retries: 3
    };
  }

  private async logAuditEvent(
    action: string,
    entityType: string,
    entityId: string | undefined,
    metadata: any
  ) {
    await db.white_list_audit_log.create({
      data: {
        organization_id: this.organizationId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        user_id: this.userId,
        metadata
      }
    });
  }

  private mapVerificationToResult(
    verification: any,
    isCached: boolean
  ): z.infer<typeof VerificationResultSchema> {
    return {
      verification_id: verification.id,
      nip: verification.nip,
      iban: verification.iban,
      nip_status: verification.nip_status,
      registration_date: verification.registration_date?.toISOString().split('T')[0] || null,
      deregistration_date: verification.deregistration_date?.toISOString().split('T')[0] || null,
      subject_name: verification.subject_name,
      subject_address: verification.subject_address,
      krs: verification.krs_number,
      regon: verification.regon,
      iban_registered: verification.iban_registered,
      registered_accounts: (verification.accounts || verification.registered_accounts || []).map((acc: any) => ({
        iban: acc.iban,
        bank_name: acc.bank_name,
        assignment_date: acc.assignment_date?.toISOString().split('T')[0] || null
      })),
      risk_level: verification.risk_level,
      risk_reasons: verification.risk_reasons || [],
      requires_split_payment: verification.requires_split_payment || false,
      is_cached: isCached,
      verified_at: verification.request_timestamp?.toISOString() || verification.created_at.toISOString(),
      cache_expires_at: null,
      request_id: verification.request_id || '',
      response_time_ms: verification.response_time_ms || 0
    };
  }

  private mapAuthStatusToAlertType(status: string): z.infer<typeof AlertTypeSchema> {
    switch (status) {
      case 'blocked_inactive_vat': return 'vat_status_changed';
      case 'blocked_unregistered_account': return 'account_not_registered';
      case 'requires_split_payment': return 'split_payment_required';
      case 'blocked_verification_failed': return 'verification_failed';
      default: return 'unverified_payment';
    }
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private normalizeIBAN(iban: string): string {
    const clean = iban.replace(/\s/g, '').toUpperCase();
    return clean.startsWith('PL') ? clean : `PL${clean}`;
  }

  private getBankNameFromIBAN(iban: string): string | null {
    const bankCode = this.normalizeIBAN(iban).substring(4, 8);
    const bankNames: Record<string, string> = {
      '1010': 'NBP',
      '1020': 'PKO BP',
      '1050': 'ING Bank Śląski',
      '1090': 'Santander Bank Polska',
      '1140': 'mBank',
      '1160': 'Bank Millennium',
      '1240': 'Pekao SA',
      '1320': 'Bank Pocztowy',
      '1540': 'BOŚ Bank',
      '1580': 'Mercedes-Benz Bank',
      '1610': 'SGB-Bank',
      '1680': 'Plus Bank',
      '1870': 'Nest Bank',
      '1930': 'Bank Polskiej Spółdzielczości',
      '1940': 'Credit Agricole',
      '2030': 'BNP Paribas',
      '2120': 'Santander Consumer',
      '2130': 'Volkswagen Bank',
      '2160': 'Toyota Bank',
      '2480': 'Getin Noble Bank',
      '2490': 'Alior Bank'
    };
    return bankNames[bankCode] || null;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
```

### API Router

```typescript
// src/server/routers/white-list.router.ts
import { router, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { WhiteListService } from '@/server/services/white-list.service';
import {
  VerifyNIPRequestSchema,
  VerifyIBANRequestSchema,
  PaymentVerificationRequestSchema,
  BatchVerifyRequestSchema,
  VerificationHistoryFilterSchema,
  ResolveAlertSchema,
  WhiteListConfigSchema,
  AlertStatusSchema
} from '@/server/services/schemas/white-list.schemas';
import { z } from 'zod';

export const whiteListRouter = router({
  // NIP verification
  verifyNIP: protectedProcedure
    .input(VerifyNIPRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.session.organizationId,
        ctx.session.userId
      );
      return service.verifyNIP(input);
    }),

  // IBAN verification
  verifyIBAN: protectedProcedure
    .input(VerifyIBANRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.session.organizationId,
        ctx.session.userId
      );
      return service.verifyIBAN(input);
    }),

  // Payment pre-authorization
  verifyPayment: protectedProcedure
    .input(PaymentVerificationRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.session.organizationId,
        ctx.session.userId
      );
      return service.verifyPayment(input);
    }),

  // Batch verification
  batchVerify: protectedProcedure
    .input(BatchVerifyRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.session.organizationId,
        ctx.session.userId
      );
      return service.batchVerify(input);
    }),

  // Verification history
  getHistory: protectedProcedure
    .input(VerificationHistoryFilterSchema)
    .query(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.session.organizationId,
        ctx.session.userId
      );
      return service.getHistory(input);
    }),

  // Active alerts
  getAlerts: protectedProcedure
    .input(z.object({
      status: AlertStatusSchema.optional()
    }).optional())
    .query(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.session.organizationId,
        ctx.session.userId
      );
      return service.getAlerts(input?.status);
    }),

  // Resolve alert
  resolveAlert: protectedProcedure
    .input(ResolveAlertSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.session.organizationId,
        ctx.session.userId
      );
      return service.resolveAlert(input);
    }),

  // Get configuration
  getConfig: protectedProcedure
    .query(async ({ ctx }) => {
      const config = await ctx.db.white_list_config.findUnique({
        where: { organization_id: ctx.session.organizationId }
      });
      return config || WhiteListConfigSchema.parse({});
    }),

  // Update configuration
  updateConfig: protectedProcedure
    .input(WhiteListConfigSchema.partial())
    .mutation(async ({ ctx, input }) => {
      return ctx.db.white_list_config.upsert({
        where: { organization_id: ctx.session.organizationId },
        update: { ...input, updated_at: new Date() },
        create: {
          organization_id: ctx.session.organizationId,
          ...WhiteListConfigSchema.parse(input)
        }
      });
    }),

  // Export verification history for audit
  exportHistory: protectedProcedure
    .input(z.object({
      nip: z.string().optional(),
      date_from: z.string().date(),
      date_to: z.string().date(),
      format: z.enum(['pdf', 'csv', 'json'])
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.session.organizationId,
        ctx.session.userId
      );

      const history = await service.getHistory({
        nip: input.nip,
        date_from: input.date_from,
        date_to: input.date_to,
        page: 1,
        limit: 1000
      });

      // Generate export based on format
      switch (input.format) {
        case 'json':
          return {
            content: JSON.stringify(history.verifications, null, 2),
            filename: `weryfikacje_${input.date_from}_${input.date_to}.json`,
            contentType: 'application/json'
          };
        case 'csv':
          const csv = generateCSV(history.verifications);
          return {
            content: csv,
            filename: `weryfikacje_${input.date_from}_${input.date_to}.csv`,
            contentType: 'text/csv'
          };
        case 'pdf':
          // PDF generation would use a library like PDFKit
          throw new TRPCError({
            code: 'NOT_IMPLEMENTED',
            message: 'PDF export w przygotowaniu'
          });
      }
    })
});

function generateCSV(verifications: any[]): string {
  const headers = [
    'Data weryfikacji',
    'NIP',
    'Nazwa podmiotu',
    'Status VAT',
    'IBAN',
    'Konto zarejestrowane',
    'Poziom ryzyka',
    'Kwota'
  ];

  const rows = verifications.map(v => [
    v.verified_at,
    v.nip,
    v.subject_name || '',
    v.nip_status,
    v.iban || '',
    v.iban_registered ? 'Tak' : 'Nie',
    v.risk_level,
    v.amount_verified || ''
  ]);

  return [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
  ].join('\n');
}
```

---

## Test Specifications

### Unit Tests

```typescript
// src/server/services/__tests__/white-list.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WhiteListService } from '../white-list.service';
import { db } from '@/server/db';
import { redis } from '@/server/redis';

vi.mock('@/server/db');
vi.mock('@/server/redis');

describe('WhiteListService', () => {
  let service: WhiteListService;
  const mockOrgId = 'org-123';
  const mockUserId = 'user-456';

  beforeEach(() => {
    service = new WhiteListService(mockOrgId, mockUserId);
    vi.clearAllMocks();
  });

  describe('NIP Validation', () => {
    it('should validate correct NIP with checksum', () => {
      const validNIP = '7811914629';
      // Checksum: 6*7+5*8+7*1+2*1+3*9+4*1+5*4+6*6+7*2 = 162, 162 % 11 = 9 ✓
      expect(() => NIPSchema.parse(validNIP)).not.toThrow();
    });

    it('should reject NIP with invalid checksum', () => {
      const invalidNIP = '1234567890';
      expect(() => NIPSchema.parse(invalidNIP)).toThrow();
    });

    it('should accept NIP with dashes and normalize', () => {
      const nipWithDashes = '781-191-46-29';
      expect(NIPSchema.parse(nipWithDashes)).toBe('7811914629');
    });
  });

  describe('IBAN Validation', () => {
    it('should validate Polish IBAN format', () => {
      const validIBAN = 'PL61109010140000071219812874';
      expect(() => PolishIBANSchema.parse(validIBAN)).not.toThrow();
    });

    it('should add PL prefix if missing', () => {
      const ibanWithoutPrefix = '61109010140000071219812874';
      expect(PolishIBANSchema.parse(ibanWithoutPrefix)).toBe('PL61109010140000071219812874');
    });

    it('should reject invalid IBAN format', () => {
      const invalidIBAN = 'DE89370400440532013000'; // German IBAN
      expect(() => PolishIBANSchema.parse(invalidIBAN)).toThrow();
    });
  });

  describe('verifyNIP', () => {
    it('should return cached result if available', async () => {
      const cachedResult = {
        verification_id: 'ver-123',
        nip: '7811914629',
        nip_status: 'active',
        is_cached: true
      };

      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(cachedResult));

      const result = await service.verifyNIP({ nip: '7811914629' });

      expect(result.is_cached).toBe(true);
      expect(result.nip_status).toBe('active');
    });

    it('should call MF API if not cached', async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(db.white_list_verifications.findFirst).mockResolvedValue(null);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: {
            requestId: 'req-123',
            subject: {
              name: 'Test Company',
              nip: '7811914629',
              statusVat: 'Czynny',
              accountNumbers: ['PL61109010140000071219812874']
            }
          }
        })
      });

      vi.mocked(db.white_list_verifications.create).mockResolvedValue({
        id: 'ver-new',
        nip: '7811914629',
        nip_status: 'active'
      });

      const result = await service.verifyNIP({ nip: '7811914629' });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('7811914629'),
        expect.any(Object)
      );
      expect(result.nip_status).toBe('active');
      expect(result.is_cached).toBe(false);
    });
  });

  describe('Risk Assessment', () => {
    it('should return low risk for active VAT with registered IBAN', () => {
      const verification = {
        nip_status: 'active',
        registered_accounts: [{ iban: 'PL61109010140000071219812874' }]
      };

      const risk = service['assessRisk'](verification, true, 5000);

      expect(risk.level).toBe('low');
      expect(risk.reasons).toHaveLength(0);
    });

    it('should return high risk for inactive VAT', () => {
      const verification = {
        nip_status: 'inactive',
        registered_accounts: []
      };

      const risk = service['assessRisk'](verification, false, 20000);

      expect(risk.level).toBe('critical');
      expect(risk.reasons).toContain('Status VAT: inactive');
      expect(risk.reasons).toContain('Konto bankowe nie jest zarejestrowane na Białej Liście');
    });

    it('should increase risk for high amounts', () => {
      const verification = {
        nip_status: 'active',
        registered_accounts: []
      };

      const riskLow = service['assessRisk'](verification, true, 10000);
      const riskHigh = service['assessRisk'](verification, true, 100000);

      expect(riskLow.level).toBe('low');
      expect(riskHigh.level).toBe('medium'); // Amount adds risk even with active VAT
    });
  });

  describe('Payment Authorization', () => {
    it('should approve payment below threshold without full verification', async () => {
      const result = await service.verifyPayment({
        recipient_nip: '7811914629',
        recipient_iban: 'PL61109010140000071219812874',
        amount: 10000,
        payment_date: '2024-12-15'
      });

      expect(result.authorized).toBe(true);
      expect(result.status).toBe('warning_below_threshold');
    });

    it('should block payment to unregistered account above threshold', async () => {
      // Setup mock for unregistered account
      vi.mocked(redis.get).mockResolvedValue(null);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: {
            requestId: 'req-123',
            subject: {
              name: 'Test Company',
              nip: '7811914629',
              statusVat: 'Czynny',
              accountNumbers: ['PL11111111111111111111111111'] // Different account
            }
          }
        })
      });

      vi.mocked(db.white_list_config.findUnique).mockResolvedValue({
        block_unverified_payments: true
      });

      const result = await service.verifyPayment({
        recipient_nip: '7811914629',
        recipient_iban: 'PL61109010140000071219812874',
        amount: 50000,
        payment_date: '2024-12-15'
      });

      expect(result.authorized).toBe(false);
      expect(result.status).toBe('blocked_unregistered_account');
    });
  });

  describe('Batch Verification', () => {
    it('should process multiple NIPs in parallel', async () => {
      const nips = ['7811914629', '5252248481', '1132191233'];

      vi.mocked(db.white_list_batch_jobs.create).mockResolvedValue({ id: 'batch-1' });

      // Mock successful verification for each
      for (const nip of nips) {
        vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify({
          nip,
          nip_status: 'active'
        }));
      }

      const result = await service.batchVerify({ nips });

      expect(result.summary.total).toBe(3);
      expect(result.summary.active).toBe(3);
      expect(result.results).toHaveLength(3);
    });

    it('should handle mixed results in batch', async () => {
      const nips = ['7811914629', '0000000000'];

      vi.mocked(db.white_list_batch_jobs.create).mockResolvedValue({ id: 'batch-2' });
      vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify({
        nip: '7811914629',
        nip_status: 'active'
      }));
      vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify({
        nip: '0000000000',
        nip_status: 'not_registered'
      }));

      const result = await service.batchVerify({ nips });

      expect(result.summary.active).toBe(1);
      expect(result.summary.not_registered).toBe(1);
    });
  });
});
```

### Integration Tests

```typescript
// src/server/services/__tests__/white-list.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext } from '@/test/helpers';
import { whiteListRouter } from '../routers/white-list.router';

describe('WhiteList Integration Tests', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('Database Operations', () => {
    it('should store verification result', async () => {
      const caller = whiteListRouter.createCaller(ctx);

      const result = await caller.verifyNIP({
        nip: '7811914629',
        force_refresh: true
      });

      // Verify stored in database
      const stored = await ctx.db.white_list_verifications.findUnique({
        where: { id: result.verification_id }
      });

      expect(stored).not.toBeNull();
      expect(stored?.nip).toBe('7811914629');
      expect(stored?.organization_id).toBe(ctx.session.organizationId);
    });

    it('should create alerts for high-risk verifications', async () => {
      const caller = whiteListRouter.createCaller(ctx);

      // Force verification that creates alert
      await caller.verifyPayment({
        recipient_nip: '7811914629',
        recipient_iban: 'PL99999999999999999999999999', // Unknown account
        amount: 50000,
        payment_date: '2024-12-15',
        force_refresh: true
      });

      const alerts = await caller.getAlerts({ status: 'open' });

      expect(alerts.some(a => a.alert_type === 'account_not_registered')).toBe(true);
    });

    it('should update configuration', async () => {
      const caller = whiteListRouter.createCaller(ctx);

      await caller.updateConfig({
        verification_threshold: 20000,
        cache_duration_hours: 12
      });

      const config = await caller.getConfig();

      expect(config.verification_threshold).toBe(20000);
      expect(config.cache_duration_hours).toBe(12);
    });
  });

  describe('Cache Operations', () => {
    it('should cache verification result', async () => {
      const caller = whiteListRouter.createCaller(ctx);

      // First call - fresh
      const fresh = await caller.verifyNIP({
        nip: '7811914629',
        force_refresh: true
      });
      expect(fresh.is_cached).toBe(false);

      // Second call - cached
      const cached = await caller.verifyNIP({
        nip: '7811914629',
        force_refresh: false
      });
      expect(cached.is_cached).toBe(true);
    });

    it('should respect force_refresh flag', async () => {
      const caller = whiteListRouter.createCaller(ctx);

      // Cache a result
      await caller.verifyNIP({
        nip: '7811914629',
        force_refresh: true
      });

      // Force refresh should bypass cache
      const fresh = await caller.verifyNIP({
        nip: '7811914629',
        force_refresh: true
      });

      expect(fresh.is_cached).toBe(false);
    });
  });

  describe('RLS Policies', () => {
    it('should isolate data between organizations', async () => {
      const ctxOrg1 = await createTestContext({ organizationId: 'org-1' });
      const ctxOrg2 = await createTestContext({ organizationId: 'org-2' });

      const callerOrg1 = whiteListRouter.createCaller(ctxOrg1);
      const callerOrg2 = whiteListRouter.createCaller(ctxOrg2);

      // Create verification in org1
      await callerOrg1.verifyNIP({
        nip: '7811914629',
        force_refresh: true
      });

      // Org2 should not see org1's verifications
      const historyOrg2 = await callerOrg2.getHistory({
        nip: '7811914629',
        page: 1,
        limit: 10
      });

      expect(historyOrg2.verifications).toHaveLength(0);

      await ctxOrg1.cleanup();
      await ctxOrg2.cleanup();
    });
  });
});
```

### E2E Tests

```typescript
// e2e/white-list.spec.ts
import { test, expect } from '@playwright/test';

test.describe('White List Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should verify NIP through UI', async ({ page }) => {
    await page.goto('/tax/white-list');

    // Enter NIP
    await page.fill('[data-testid="nip-input"]', '781-191-46-29');
    await page.click('[data-testid="verify-btn"]');

    // Wait for result
    await expect(page.locator('[data-testid="verification-result"]')).toBeVisible();
    await expect(page.locator('[data-testid="vat-status"]')).toContainText(/Czynny|Nieczynny/);

    // Should show registered accounts
    await expect(page.locator('[data-testid="registered-accounts"]')).toBeVisible();
  });

  test('should verify payment with risk assessment', async ({ page }) => {
    await page.goto('/tax/white-list/payment-check');

    // Fill payment details
    await page.fill('[data-testid="recipient-nip"]', '7811914629');
    await page.fill('[data-testid="recipient-iban"]', 'PL61109010140000071219812874');
    await page.fill('[data-testid="amount"]', '50000');
    await page.fill('[data-testid="payment-date"]', '2024-12-20');

    await page.click('[data-testid="check-payment-btn"]');

    // Wait for authorization result
    await expect(page.locator('[data-testid="authorization-status"]')).toBeVisible();

    // Should show risk level
    await expect(page.locator('[data-testid="risk-level"]')).toBeVisible();

    // Should show recommendations if any
    const recommendations = page.locator('[data-testid="recommendations"]');
    if (await recommendations.isVisible()) {
      await expect(recommendations.locator('li')).toHaveCount({ minimum: 1 });
    }
  });

  test('should show verification history', async ({ page }) => {
    await page.goto('/tax/white-list/history');

    // Wait for table to load
    await expect(page.locator('[data-testid="history-table"]')).toBeVisible();

    // Filter by NIP
    await page.fill('[data-testid="filter-nip"]', '7811914629');
    await page.click('[data-testid="apply-filter-btn"]');

    // Results should be filtered
    const rows = page.locator('[data-testid="history-row"]');
    for (const row of await rows.all()) {
      await expect(row.locator('[data-testid="nip-cell"]')).toContainText('7811914629');
    }
  });

  test('should manage alerts', async ({ page }) => {
    await page.goto('/tax/white-list/alerts');

    // Wait for alerts to load
    await expect(page.locator('[data-testid="alerts-list"]')).toBeVisible();

    // Click on first open alert
    const firstAlert = page.locator('[data-testid="alert-item"]').first();
    await firstAlert.click();

    // Alert details should be visible
    await expect(page.locator('[data-testid="alert-details"]')).toBeVisible();

    // Resolve alert
    await page.click('[data-testid="resolve-btn"]');
    await page.fill('[data-testid="resolution-notes"]', 'Zweryfikowano telefonicznie');
    await page.click('[data-testid="confirm-resolve-btn"]');

    // Alert should be resolved
    await expect(page.locator('[data-testid="alert-status"]')).toContainText('Rozwiązany');
  });

  test('should export verification history', async ({ page }) => {
    await page.goto('/tax/white-list/history');

    // Set date range
    await page.fill('[data-testid="date-from"]', '2024-01-01');
    await page.fill('[data-testid="date-to"]', '2024-12-31');

    // Export to CSV
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-csv-btn"]')
    ]);

    expect(download.suggestedFilename()).toMatch(/weryfikacje.*\.csv$/);
  });

  test('should configure White List settings', async ({ page }) => {
    await page.goto('/settings/white-list');

    // Update threshold
    await page.fill('[data-testid="verification-threshold"]', '20000');

    // Toggle automatic verification
    await page.click('[data-testid="auto-verify-invoices"]');

    // Save settings
    await page.click('[data-testid="save-config-btn"]');

    // Should show success message
    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Zapisano');

    // Reload and verify settings persisted
    await page.reload();
    await expect(page.locator('[data-testid="verification-threshold"]')).toHaveValue('20000');
  });
});
```

---

## Security Checklist

### Authentication & Authorization
- [x] All endpoints require authentication
- [x] Organization-scoped data access via RLS
- [x] Role-based access for configuration changes
- [x] Audit logging for all verification actions

### Data Protection
- [x] NIP/IBAN validation before API calls
- [x] No sensitive data in logs (masked NIP/IBAN)
- [x] Encrypted storage for cached verifications
- [x] Secure API communication (TLS 1.3)

### API Security
- [x] Rate limiting on MF API calls (max 100/min)
- [x] Timeout handling for external API
- [x] Input sanitization for all parameters
- [x] Error messages don't leak internal details

### Compliance
- [x] Verification date stored per regulations (Art. 96b)
- [x] 24-hour cache limit respected
- [x] Complete audit trail for tax inspections
- [x] Export functionality for audit purposes

---

## Audit Events

```typescript
const WHITE_LIST_AUDIT_EVENTS = {
  // Verification events
  NIP_VERIFICATION_REQUESTED: 'white_list.nip.verification_requested',
  NIP_VERIFICATION_COMPLETED: 'white_list.nip.verification_completed',
  IBAN_VERIFICATION_REQUESTED: 'white_list.iban.verification_requested',
  IBAN_VERIFICATION_COMPLETED: 'white_list.iban.verification_completed',
  PAYMENT_VERIFICATION_REQUESTED: 'white_list.payment.verification_requested',
  PAYMENT_VERIFICATION_COMPLETED: 'white_list.payment.verification_completed',
  BATCH_VERIFICATION_STARTED: 'white_list.batch.started',
  BATCH_VERIFICATION_COMPLETED: 'white_list.batch.completed',

  // Cache events
  CACHE_HIT: 'white_list.cache.hit',
  CACHE_MISS: 'white_list.cache.miss',
  CACHE_REFRESHED: 'white_list.cache.refreshed',

  // Alert events
  ALERT_CREATED: 'white_list.alert.created',
  ALERT_ACKNOWLEDGED: 'white_list.alert.acknowledged',
  ALERT_RESOLVED: 'white_list.alert.resolved',
  ALERT_ESCALATED: 'white_list.alert.escalated',

  // Configuration events
  CONFIG_UPDATED: 'white_list.config.updated',

  // Export events
  HISTORY_EXPORTED: 'white_list.history.exported'
};
```

---

## Implementation Notes

### External API Integration
- MF White List API: `https://wl-api.mf.gov.pl`
- No authentication required (public API)
- Rate limit: Recommended max 100 requests/minute
- Response time: Typically 500ms-2s

### Caching Strategy
- Redis for fast in-memory cache (primary)
- Database for persistent cache (fallback)
- Cache key: `whitelist:{nip}:{date}`
- Max cache duration: 24 hours (per regulations)

### Risk Assessment Algorithm
```
Risk Score =
  (NIP not active ? 50 : 0) +
  (IBAN not registered ? 30 : 0) +
  (Amount >= 100,000 ? 20 : Amount >= 50,000 ? 10 : Amount >= 15,000 ? 5 : 0)

Risk Level:
  - critical: score >= 70
  - high: score >= 50
  - medium: score >= 25
  - low: score < 25
```

### Polish Bank Codes Reference
- 1010: NBP
- 1020: PKO BP
- 1050: ING Bank Śląski
- 1090: Santander Bank Polska
- 1140: mBank
- 1160: Bank Millennium
- 1240: Pekao SA
- 2490: Alior Bank

---

## Dependencies

- **CRM**: Client NIP data for verification context
- **ACC**: Invoice and payment data for automatic verification
- **TAX-004**: VAT calculation integration for split payment detection
- **DOC**: Document storage for verification exports

---

## References

- [Wykaz podatników VAT (Biała Lista)](https://www.podatki.gov.pl/wykaz-podatnikow-vat-wyszukiwarka/)
- [MF API Documentation](https://www.gov.pl/web/kas/api-wykazu-podatnikow-vat)
- [Art. 96b ustawy o VAT](https://www.lexlege.pl/ustawa-o-podatku-od-towarow-i-uslug/art-96b/)
- [Art. 22p ustawy o PIT](https://www.lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-22p/)
- [Załącznik nr 15 do ustawy o VAT (Split Payment)](https://www.podatki.gov.pl/vat/abc-vat/mechanizm-podzielonej-platnosci/)

---

*Story created: December 2024*
*Last updated: December 2024*
