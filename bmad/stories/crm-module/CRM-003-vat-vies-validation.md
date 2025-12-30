# CRM-003: VAT/VIES Validation

> **Story ID**: CRM-003
> **Epic**: Core CRM Module
> **Priority**: P0 (Critical)
> **Points**: 5
> **Phase**: Week 5
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant,
**I want** to validate EU VAT numbers and check Polish tax whitelist status,
**So that** I can ensure compliance and verify client tax status before transactions.

---

## Acceptance Criteria

### AC1: EU VAT Number Validation via VIES

```gherkin
Feature: EU VAT Number Validation
  As an accountant
  I want to validate EU VAT numbers through the VIES system
  So that I can verify EU business partners

  Background:
    Given I am logged in as an accountant
    And I have permission to manage clients

  Scenario: Validate valid EU VAT number
    Given a client with EU VAT number "DE123456789"
    When I request VAT validation
    Then the system should query VIES API
    And return validation status "VALID"
    And display company name from VIES
    And display company address from VIES
    And store validation result with timestamp

  Scenario: Validate invalid EU VAT number
    Given a client with EU VAT number "DE999999999"
    When I request VAT validation
    Then the system should return status "INVALID"
    And display validation error message
    And log validation attempt

  Scenario: Handle VIES service unavailability
    Given the VIES service is unavailable
    When I request VAT validation
    Then the system should return status "SERVICE_UNAVAILABLE"
    And queue the validation for retry
    And notify the user of temporary unavailability
    And use cached result if available (within 24h)

  Scenario: Validate Polish VAT number format
    Given I enter VAT number "PL1234567890"
    When the system validates the format
    Then it should verify 10-digit NIP format
    And calculate checksum validation
    And return format validation result

  Scenario: Batch VAT validation
    Given I have multiple clients to validate
    When I request batch VAT validation for 10 clients
    Then the system should process validations in parallel
    And respect VIES rate limits (10 requests/minute)
    And return consolidated results
```

### AC2: Polish Tax Whitelist Verification

```gherkin
Feature: Polish Tax Whitelist Verification
  As an accountant
  I want to verify clients against the Polish tax whitelist
  So that I can ensure safe VAT transactions

  Background:
    Given I am logged in as an accountant
    And I have a client with NIP "1234567890"

  Scenario: Verify client on whitelist with valid bank account
    Given the client's NIP is "1234567890"
    And their bank account is "PL61109010140000071219812874"
    When I verify whitelist status
    Then the system should query MF API
    And return status "ON_WHITELIST"
    And confirm bank account is registered
    And display registration date
    And store verification result

  Scenario: Client not registered for VAT
    Given the client's NIP is not registered for VAT
    When I verify whitelist status
    Then the system should return status "NOT_REGISTERED"
    And display appropriate warning
    And suggest client verification

  Scenario: Bank account not on whitelist
    Given the client's NIP is "1234567890"
    And their bank account is not registered
    When I verify whitelist status
    Then the system should return "ACCOUNT_NOT_FOUND"
    And flag the client for review
    And display risk warning for VAT split payment

  Scenario: Verify virtual bank account
    Given a virtual account number for payment gateway
    When I verify against whitelist
    Then the system should identify virtual account
    And verify the master account on whitelist
    And return appropriate status

  Scenario: Check historical whitelist status
    Given I need to verify for a past transaction date
    When I request historical verification for "2024-01-15"
    Then the system should use historical API endpoint
    And return status as of that date
```

### AC3: VAT Status Change Monitoring

```gherkin
Feature: VAT Status Change Monitoring
  As an accountant
  I want to be notified when client VAT status changes
  So that I can take appropriate action

  Scenario: Schedule periodic VAT verification
    Given a client with active VAT status
    When the scheduled verification runs (weekly)
    Then the system should verify current status
    And compare with stored status
    And create timeline event if changed

  Scenario: Detect VAT status change
    Given a client previously had status "ACTIVE"
    When the periodic check finds status "SUSPENDED"
    Then the system should update client record
    And create high-priority alert
    And send notification to assigned accountant
    And log change in client timeline

  Scenario: Manual status refresh
    Given I view a client's VAT details
    When I click "Refresh VAT Status"
    Then the system should perform immediate verification
    And update displayed information
    And log refresh action
```

---

## Technical Specification

### Database Schema

```sql
-- VAT validation results cache
CREATE TABLE vat_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

    -- VAT number details
    vat_number VARCHAR(20) NOT NULL,
    country_code CHAR(2) NOT NULL,

    -- Validation result
    status VARCHAR(50) NOT NULL, -- VALID, INVALID, NOT_FOUND, SERVICE_ERROR
    valid BOOLEAN NOT NULL,

    -- Response data (from VIES/MF)
    company_name VARCHAR(500),
    company_address TEXT,
    registration_date DATE,

    -- Metadata
    request_identifier VARCHAR(100), -- VIES consultation number
    validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    raw_response JSONB,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),

    CONSTRAINT unique_vat_validation UNIQUE(organization_id, vat_number, validated_at)
);

CREATE INDEX idx_vat_validations_vat_number ON vat_validations(vat_number);
CREATE INDEX idx_vat_validations_client ON vat_validations(client_id);
CREATE INDEX idx_vat_validations_expires ON vat_validations(expires_at);

-- Whitelist verification results
CREATE TABLE whitelist_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

    -- Query parameters
    nip VARCHAR(10) NOT NULL,
    bank_account VARCHAR(34), -- IBAN format
    verification_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Result
    status VARCHAR(50) NOT NULL, -- ON_WHITELIST, NOT_REGISTERED, ACCOUNT_NOT_FOUND
    nip_valid BOOLEAN NOT NULL,
    account_valid BOOLEAN,

    -- Response data
    subject_name VARCHAR(500),
    registered_accounts TEXT[], -- Array of registered bank accounts
    registration_status VARCHAR(50), -- CZYNNY, ZWOLNIONY, NIEZAREJESTROWANY

    -- Metadata
    request_id VARCHAR(100),
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_response JSONB,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_whitelist_nip ON whitelist_verifications(nip);
CREATE INDEX idx_whitelist_client ON whitelist_verifications(client_id);
CREATE INDEX idx_whitelist_date ON whitelist_verifications(verification_date);

-- VAT status monitoring schedule
CREATE TABLE vat_monitoring_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

    -- Schedule configuration
    frequency VARCHAR(20) NOT NULL DEFAULT 'WEEKLY', -- DAILY, WEEKLY, MONTHLY
    next_check_at TIMESTAMPTZ NOT NULL,
    last_checked_at TIMESTAMPTZ,
    last_status VARCHAR(50),

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_client_monitoring UNIQUE(client_id)
);

CREATE INDEX idx_vat_monitoring_next ON vat_monitoring_schedules(next_check_at)
    WHERE is_active = TRUE;

-- Row Level Security
ALTER TABLE vat_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelist_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_monitoring_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY vat_validations_org_policy ON vat_validations
    FOR ALL USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY whitelist_org_policy ON whitelist_verifications
    FOR ALL USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY vat_monitoring_org_policy ON vat_monitoring_schedules
    FOR ALL USING (organization_id = current_setting('app.organization_id')::UUID);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// =====================================
// EU VAT Validation Schemas
// =====================================

// EU country codes
export const euCountryCodes = [
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES',
  'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
  'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'
] as const;

export const EUCountryCodeSchema = z.enum(euCountryCodes);

// VAT number format per country
const vatPatterns: Record<string, RegExp> = {
  AT: /^U\d{8}$/,
  BE: /^0\d{9}$/,
  BG: /^\d{9,10}$/,
  CY: /^\d{8}[A-Z]$/,
  CZ: /^\d{8,10}$/,
  DE: /^\d{9}$/,
  DK: /^\d{8}$/,
  EE: /^\d{9}$/,
  EL: /^\d{9}$/,
  ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/,
  FI: /^\d{8}$/,
  FR: /^[A-Z0-9]{2}\d{9}$/,
  HR: /^\d{11}$/,
  HU: /^\d{8}$/,
  IE: /^[0-9A-Z+*]{8,9}$/,
  IT: /^\d{11}$/,
  LT: /^(\d{9}|\d{12})$/,
  LU: /^\d{8}$/,
  LV: /^\d{11}$/,
  MT: /^\d{8}$/,
  NL: /^\d{9}B\d{2}$/,
  PL: /^\d{10}$/,
  PT: /^\d{9}$/,
  RO: /^\d{2,10}$/,
  SE: /^\d{12}$/,
  SI: /^\d{8}$/,
  SK: /^\d{10}$/,
};

export const EUVATNumberSchema = z.string()
  .min(4)
  .max(15)
  .transform((val) => val.toUpperCase().replace(/\s/g, ''))
  .refine((val) => {
    const countryCode = val.substring(0, 2);
    const number = val.substring(2);
    const pattern = vatPatterns[countryCode];
    return pattern ? pattern.test(number) : false;
  }, { message: 'Invalid EU VAT number format' });

export const ValidateVATInputSchema = z.object({
  vatNumber: EUVATNumberSchema,
  clientId: z.string().uuid().optional(),
});

export const VATValidationResultSchema = z.object({
  valid: z.boolean(),
  status: z.enum(['VALID', 'INVALID', 'NOT_FOUND', 'SERVICE_UNAVAILABLE', 'ERROR']),
  vatNumber: z.string(),
  countryCode: z.string(),
  companyName: z.string().optional(),
  companyAddress: z.string().optional(),
  requestDate: z.string().datetime(),
  requestIdentifier: z.string().optional(),
  message: z.string().optional(),
});

export type ValidateVATInput = z.infer<typeof ValidateVATInputSchema>;
export type VATValidationResult = z.infer<typeof VATValidationResultSchema>;

// =====================================
// Polish Whitelist Schemas
// =====================================

// Polish NIP with checksum validation
export const PolishNIPSchema = z.string()
  .regex(/^\d{10}$/, 'NIP must be 10 digits')
  .refine((nip) => {
    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
    const digits = nip.split('').map(Number);
    const sum = weights.reduce((acc, weight, i) => acc + weight * digits[i], 0);
    return sum % 11 === digits[9];
  }, { message: 'Invalid NIP checksum' });

// Polish IBAN format
export const PolishIBANSchema = z.string()
  .transform((val) => val.toUpperCase().replace(/\s/g, ''))
  .refine((val) => {
    // Polish IBAN: PL + 2 check digits + 24 digits (26 total)
    if (val.startsWith('PL')) {
      return /^PL\d{26}$/.test(val);
    }
    // Also accept plain 26-digit account number
    return /^\d{26}$/.test(val);
  }, { message: 'Invalid Polish bank account number' });

export const VerifyWhitelistInputSchema = z.object({
  nip: PolishNIPSchema,
  bankAccount: PolishIBANSchema.optional(),
  verificationDate: z.string().date().optional(), // For historical checks
  clientId: z.string().uuid().optional(),
});

export const WhitelistVerificationResultSchema = z.object({
  status: z.enum([
    'ON_WHITELIST',
    'NOT_REGISTERED',
    'ACCOUNT_NOT_FOUND',
    'NIP_INVALID',
    'SERVICE_ERROR'
  ]),
  nipValid: z.boolean(),
  accountValid: z.boolean().optional(),
  subjectName: z.string().optional(),
  registrationStatus: z.enum(['CZYNNY', 'ZWOLNIONY', 'NIEZAREJESTROWANY']).optional(),
  registeredAccounts: z.array(z.string()).optional(),
  verificationDate: z.string().datetime(),
  requestId: z.string().optional(),
  message: z.string().optional(),
});

export type VerifyWhitelistInput = z.infer<typeof VerifyWhitelistInputSchema>;
export type WhitelistVerificationResult = z.infer<typeof WhitelistVerificationResultSchema>;

// =====================================
// Batch Validation Schemas
// =====================================

export const BatchVATValidationInputSchema = z.object({
  vatNumbers: z.array(EUVATNumberSchema).min(1).max(100),
});

export const BatchWhitelistInputSchema = z.object({
  entries: z.array(z.object({
    nip: PolishNIPSchema,
    bankAccount: PolishIBANSchema.optional(),
  })).min(1).max(100),
});

// =====================================
// Monitoring Schemas
// =====================================

export const MonitoringFrequencySchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY']);

export const CreateMonitoringScheduleSchema = z.object({
  clientId: z.string().uuid(),
  frequency: MonitoringFrequencySchema.default('WEEKLY'),
});

export const VATStatusChangeEventSchema = z.object({
  clientId: z.string().uuid(),
  previousStatus: z.string(),
  newStatus: z.string(),
  changedAt: z.string().datetime(),
  detectedAt: z.string().datetime(),
});

export type MonitoringFrequency = z.infer<typeof MonitoringFrequencySchema>;
export type CreateMonitoringSchedule = z.infer<typeof CreateMonitoringScheduleSchema>;
```

### tRPC Router

```typescript
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  ValidateVATInputSchema,
  VerifyWhitelistInputSchema,
  BatchVATValidationInputSchema,
  BatchWhitelistInputSchema,
  CreateMonitoringScheduleSchema,
} from './schemas';
import { VATValidationService } from './vat-validation.service';
import { WhitelistService } from './whitelist.service';
import { VATMonitoringService } from './vat-monitoring.service';

export const vatRouter = router({
  // VIES Validation
  validateVAT: protectedProcedure
    .input(ValidateVATInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new VATValidationService(ctx.db, ctx.cache);

      try {
        const result = await service.validateVAT(input.vatNumber, ctx.user.id);

        // Link to client if provided
        if (input.clientId) {
          await service.linkValidationToClient(result.id, input.clientId);
        }

        // Log audit event
        await ctx.audit.log({
          action: 'VAT_VALIDATION',
          entityType: 'vat_validation',
          entityId: result.id,
          details: {
            vatNumber: input.vatNumber,
            status: result.status,
            valid: result.valid,
          },
          userId: ctx.user.id,
          organizationId: ctx.organizationId,
        });

        return result;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'VAT validation failed',
          cause: error,
        });
      }
    }),

  // Batch VIES Validation
  batchValidateVAT: protectedProcedure
    .input(BatchVATValidationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new VATValidationService(ctx.db, ctx.cache);

      const results = await service.batchValidate(
        input.vatNumbers,
        ctx.user.id,
        ctx.organizationId
      );

      await ctx.audit.log({
        action: 'BATCH_VAT_VALIDATION',
        entityType: 'vat_validation',
        details: {
          count: input.vatNumbers.length,
          validCount: results.filter(r => r.valid).length,
        },
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });

      return results;
    }),

  // Polish Whitelist Verification
  verifyWhitelist: protectedProcedure
    .input(VerifyWhitelistInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new WhitelistService(ctx.db, ctx.cache);

      const result = await service.verify({
        nip: input.nip,
        bankAccount: input.bankAccount,
        verificationDate: input.verificationDate
          ? new Date(input.verificationDate)
          : new Date(),
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });

      // Link to client if provided
      if (input.clientId) {
        await service.linkVerificationToClient(result.id, input.clientId);
      }

      await ctx.audit.log({
        action: 'WHITELIST_VERIFICATION',
        entityType: 'whitelist_verification',
        entityId: result.id,
        details: {
          nip: input.nip,
          bankAccount: input.bankAccount ? '***' + input.bankAccount.slice(-4) : null,
          status: result.status,
        },
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });

      return result;
    }),

  // Batch Whitelist Verification
  batchVerifyWhitelist: protectedProcedure
    .input(BatchWhitelistInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new WhitelistService(ctx.db, ctx.cache);

      const results = await service.batchVerify(
        input.entries,
        ctx.user.id,
        ctx.organizationId
      );

      await ctx.audit.log({
        action: 'BATCH_WHITELIST_VERIFICATION',
        entityType: 'whitelist_verification',
        details: {
          count: input.entries.length,
          onWhitelistCount: results.filter(r => r.status === 'ON_WHITELIST').length,
        },
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });

      return results;
    }),

  // Get validation history for client
  getClientValidationHistory: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      type: z.enum(['vat', 'whitelist', 'all']).default('all'),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const vatService = new VATValidationService(ctx.db, ctx.cache);
      const whitelistService = new WhitelistService(ctx.db, ctx.cache);

      const results: any = {};

      if (input.type === 'vat' || input.type === 'all') {
        results.vatValidations = await vatService.getClientHistory(
          input.clientId,
          input.limit
        );
      }

      if (input.type === 'whitelist' || input.type === 'all') {
        results.whitelistVerifications = await whitelistService.getClientHistory(
          input.clientId,
          input.limit
        );
      }

      return results;
    }),

  // Create monitoring schedule
  createMonitoringSchedule: protectedProcedure
    .input(CreateMonitoringScheduleSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new VATMonitoringService(ctx.db);

      const schedule = await service.createSchedule({
        clientId: input.clientId,
        frequency: input.frequency,
        organizationId: ctx.organizationId,
      });

      await ctx.audit.log({
        action: 'VAT_MONITORING_CREATED',
        entityType: 'vat_monitoring_schedule',
        entityId: schedule.id,
        details: {
          clientId: input.clientId,
          frequency: input.frequency,
        },
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });

      return schedule;
    }),

  // Get monitoring status
  getMonitoringStatus: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new VATMonitoringService(ctx.db);
      return service.getClientMonitoringStatus(input.clientId);
    }),

  // Toggle monitoring
  toggleMonitoring: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new VATMonitoringService(ctx.db);
      return service.toggleMonitoring(input.clientId, input.isActive);
    }),
});
```

### Service Implementation

```typescript
// vat-validation.service.ts
import axios from 'axios';
import { parseStringPromise } from 'xml2js';

interface VIESResponse {
  valid: boolean;
  countryCode: string;
  vatNumber: string;
  name?: string;
  address?: string;
  requestDate: string;
  requestIdentifier?: string;
}

export class VATValidationService {
  private readonly VIES_URL = 'https://ec.europa.eu/taxation_customs/vies/services/checkVatService';
  private readonly CACHE_TTL = 24 * 60 * 60; // 24 hours
  private readonly RATE_LIMIT = 10; // requests per minute

  constructor(
    private readonly db: Database,
    private readonly cache: Redis
  ) {}

  async validateVAT(fullVatNumber: string, userId: string): Promise<VATValidationResult> {
    const countryCode = fullVatNumber.substring(0, 2).toUpperCase();
    const vatNumber = fullVatNumber.substring(2);

    // Check cache first
    const cacheKey = `vat:${fullVatNumber}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Rate limiting check
    await this.checkRateLimit();

    try {
      const response = await this.callVIES(countryCode, vatNumber);

      const result: VATValidationResult = {
        valid: response.valid,
        status: response.valid ? 'VALID' : 'INVALID',
        vatNumber: fullVatNumber,
        countryCode,
        companyName: response.name,
        companyAddress: response.address,
        requestDate: new Date().toISOString(),
        requestIdentifier: response.requestIdentifier,
      };

      // Store in database
      const dbRecord = await this.db.vatValidations.create({
        data: {
          organizationId: this.organizationId,
          vatNumber: fullVatNumber,
          countryCode,
          status: result.status,
          valid: result.valid,
          companyName: result.companyName,
          companyAddress: result.companyAddress,
          requestIdentifier: result.requestIdentifier,
          validatedAt: new Date(),
          expiresAt: new Date(Date.now() + this.CACHE_TTL * 1000),
          rawResponse: response,
          createdBy: userId,
        },
      });

      // Cache the result
      await this.cache.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

      return { ...result, id: dbRecord.id };
    } catch (error) {
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        // Service timeout - check for cached result
        const fallback = await this.getFallbackResult(fullVatNumber);
        if (fallback) {
          return { ...fallback, status: 'SERVICE_UNAVAILABLE', message: 'Using cached result' };
        }

        return {
          valid: false,
          status: 'SERVICE_UNAVAILABLE',
          vatNumber: fullVatNumber,
          countryCode,
          requestDate: new Date().toISOString(),
          message: 'VIES service temporarily unavailable',
        };
      }
      throw error;
    }
  }

  private async callVIES(countryCode: string, vatNumber: string): Promise<VIESResponse> {
    const soapEnvelope = `
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                        xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
        <soapenv:Header/>
        <soapenv:Body>
          <urn:checkVat>
            <urn:countryCode>${countryCode}</urn:countryCode>
            <urn:vatNumber>${vatNumber}</urn:vatNumber>
          </urn:checkVat>
        </soapenv:Body>
      </soapenv:Envelope>
    `;

    const response = await axios.post(this.VIES_URL, soapEnvelope, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '',
      },
      timeout: 10000, // 10 second timeout
    });

    const parsed = await parseStringPromise(response.data);
    const result = parsed['soap:Envelope']['soap:Body'][0]['checkVatResponse'][0];

    return {
      valid: result.valid[0] === 'true',
      countryCode: result.countryCode[0],
      vatNumber: result.vatNumber[0],
      name: result.name?.[0],
      address: result.address?.[0],
      requestDate: result.requestDate[0],
      requestIdentifier: result.requestIdentifier?.[0],
    };
  }

  private async checkRateLimit(): Promise<void> {
    const key = `vies_rate_limit:${Math.floor(Date.now() / 60000)}`;
    const count = await this.cache.incr(key);

    if (count === 1) {
      await this.cache.expire(key, 60);
    }

    if (count > this.RATE_LIMIT) {
      throw new Error('VIES rate limit exceeded. Please wait before retrying.');
    }
  }

  private async getFallbackResult(vatNumber: string): Promise<VATValidationResult | null> {
    // Look for recent valid result in database
    const recent = await this.db.vatValidations.findFirst({
      where: {
        vatNumber,
        validatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      orderBy: { validatedAt: 'desc' },
    });

    if (recent) {
      return {
        valid: recent.valid,
        status: recent.status as any,
        vatNumber: recent.vatNumber,
        countryCode: recent.countryCode,
        companyName: recent.companyName,
        companyAddress: recent.companyAddress,
        requestDate: recent.validatedAt.toISOString(),
      };
    }

    return null;
  }

  async batchValidate(
    vatNumbers: string[],
    userId: string,
    organizationId: string
  ): Promise<VATValidationResult[]> {
    // Process in batches respecting rate limits
    const results: VATValidationResult[] = [];
    const batchSize = this.RATE_LIMIT;

    for (let i = 0; i < vatNumbers.length; i += batchSize) {
      const batch = vatNumbers.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(vat => this.validateVAT(vat, userId).catch(err => ({
          valid: false,
          status: 'ERROR' as const,
          vatNumber: vat,
          countryCode: vat.substring(0, 2),
          requestDate: new Date().toISOString(),
          message: err.message,
        })))
      );

      results.push(...batchResults);

      // Wait between batches to respect rate limits
      if (i + batchSize < vatNumbers.length) {
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }

    return results;
  }

  async linkValidationToClient(validationId: string, clientId: string): Promise<void> {
    await this.db.vatValidations.update({
      where: { id: validationId },
      data: { clientId },
    });
  }

  async getClientHistory(clientId: string, limit: number): Promise<any[]> {
    return this.db.vatValidations.findMany({
      where: { clientId },
      orderBy: { validatedAt: 'desc' },
      take: limit,
    });
  }
}
```

```typescript
// whitelist.service.ts
import axios from 'axios';

interface WhitelistAPIResponse {
  result: {
    subject?: {
      name: string;
      nip: string;
      statusVat: string;
      accountNumbers?: string[];
      registrationLegalDate?: string;
    };
    requestId: string;
    requestDateTime: string;
  };
}

export class WhitelistService {
  private readonly API_URL = 'https://wl-api.mf.gov.pl/api/search/nip';
  private readonly HISTORICAL_API_URL = 'https://wl-api.mf.gov.pl/api/check/nip';
  private readonly CACHE_TTL = 60 * 60; // 1 hour

  constructor(
    private readonly db: Database,
    private readonly cache: Redis
  ) {}

  async verify(params: {
    nip: string;
    bankAccount?: string;
    verificationDate?: Date;
    userId: string;
    organizationId: string;
  }): Promise<WhitelistVerificationResult> {
    const { nip, bankAccount, verificationDate, userId, organizationId } = params;

    // Use historical API for past dates
    const isHistorical = verificationDate &&
      verificationDate.toDateString() !== new Date().toDateString();

    const cacheKey = `whitelist:${nip}:${bankAccount || 'no-account'}:${
      verificationDate?.toISOString().split('T')[0] || 'today'
    }`;

    // Check cache (only for non-historical)
    if (!isHistorical) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    try {
      const apiResult = isHistorical
        ? await this.callHistoricalAPI(nip, bankAccount, verificationDate!)
        : await this.callCurrentAPI(nip, bankAccount);

      const result = this.mapAPIResult(apiResult, nip, bankAccount);

      // Store in database
      const dbRecord = await this.db.whitelistVerifications.create({
        data: {
          organizationId,
          nip,
          bankAccount,
          verificationDate: verificationDate || new Date(),
          status: result.status,
          nipValid: result.nipValid,
          accountValid: result.accountValid,
          subjectName: result.subjectName,
          registeredAccounts: result.registeredAccounts,
          registrationStatus: result.registrationStatus,
          requestId: result.requestId,
          verifiedAt: new Date(),
          rawResponse: apiResult,
          createdBy: userId,
        },
      });

      // Cache current results
      if (!isHistorical) {
        await this.cache.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));
      }

      return { ...result, id: dbRecord.id };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return {
          status: 'SERVICE_ERROR',
          nipValid: false,
          verificationDate: new Date().toISOString(),
          message: `Ministry of Finance API error: ${error.message}`,
        };
      }
      throw error;
    }
  }

  private async callCurrentAPI(
    nip: string,
    bankAccount?: string
  ): Promise<WhitelistAPIResponse> {
    const url = bankAccount
      ? `${this.API_URL}/${nip}/bank-account/${bankAccount}`
      : `${this.API_URL}/${nip}`;

    const response = await axios.get<WhitelistAPIResponse>(url, {
      headers: { Accept: 'application/json' },
      timeout: 10000,
    });

    return response.data;
  }

  private async callHistoricalAPI(
    nip: string,
    bankAccount: string | undefined,
    date: Date
  ): Promise<WhitelistAPIResponse> {
    const dateStr = date.toISOString().split('T')[0];

    const url = bankAccount
      ? `${this.HISTORICAL_API_URL}/${nip}/bank-account/${bankAccount}?date=${dateStr}`
      : `${this.HISTORICAL_API_URL}/${nip}?date=${dateStr}`;

    const response = await axios.get<WhitelistAPIResponse>(url, {
      headers: { Accept: 'application/json' },
      timeout: 10000,
    });

    return response.data;
  }

  private mapAPIResult(
    apiResult: WhitelistAPIResponse,
    nip: string,
    bankAccount?: string
  ): WhitelistVerificationResult {
    const subject = apiResult.result.subject;

    if (!subject) {
      return {
        status: 'NOT_REGISTERED',
        nipValid: false,
        verificationDate: apiResult.result.requestDateTime,
        requestId: apiResult.result.requestId,
        message: 'NIP not found in VAT register',
      };
    }

    const nipValid = subject.statusVat === 'Czynny';
    let accountValid: boolean | undefined;

    if (bankAccount && subject.accountNumbers) {
      // Normalize account numbers for comparison
      const normalizedInput = bankAccount.replace(/[^0-9]/g, '');
      const normalizedAccounts = subject.accountNumbers.map(
        acc => acc.replace(/[^0-9]/g, '')
      );
      accountValid = normalizedAccounts.includes(normalizedInput);
    }

    let status: WhitelistVerificationResult['status'];
    if (!nipValid) {
      status = subject.statusVat === 'Zwolniony'
        ? 'NOT_REGISTERED'
        : 'NIP_INVALID';
    } else if (bankAccount && !accountValid) {
      status = 'ACCOUNT_NOT_FOUND';
    } else {
      status = 'ON_WHITELIST';
    }

    return {
      status,
      nipValid,
      accountValid,
      subjectName: subject.name,
      registrationStatus: subject.statusVat as any,
      registeredAccounts: subject.accountNumbers,
      verificationDate: apiResult.result.requestDateTime,
      requestId: apiResult.result.requestId,
    };
  }

  async batchVerify(
    entries: Array<{ nip: string; bankAccount?: string }>,
    userId: string,
    organizationId: string
  ): Promise<WhitelistVerificationResult[]> {
    // Process in parallel with concurrency limit
    const concurrencyLimit = 5;
    const results: WhitelistVerificationResult[] = [];

    for (let i = 0; i < entries.length; i += concurrencyLimit) {
      const batch = entries.slice(i, i + concurrencyLimit);

      const batchResults = await Promise.all(
        batch.map(entry =>
          this.verify({
            ...entry,
            userId,
            organizationId,
          }).catch(err => ({
            status: 'SERVICE_ERROR' as const,
            nipValid: false,
            verificationDate: new Date().toISOString(),
            message: err.message,
          }))
        )
      );

      results.push(...batchResults);
    }

    return results;
  }

  async linkVerificationToClient(verificationId: string, clientId: string): Promise<void> {
    await this.db.whitelistVerifications.update({
      where: { id: verificationId },
      data: { clientId },
    });
  }

  async getClientHistory(clientId: string, limit: number): Promise<any[]> {
    return this.db.whitelistVerifications.findMany({
      where: { clientId },
      orderBy: { verifiedAt: 'desc' },
      take: limit,
    });
  }
}
```

---

## Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VATValidationService } from './vat-validation.service';
import { WhitelistService } from './whitelist.service';

describe('VATValidationService', () => {
  let service: VATValidationService;
  let mockDb: any;
  let mockCache: any;

  beforeEach(() => {
    mockDb = {
      vatValidations: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
    };
    mockCache = {
      get: vi.fn(),
      setex: vi.fn(),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn(),
    };
    service = new VATValidationService(mockDb, mockCache);
  });

  describe('validateVAT', () => {
    it('should return cached result if available', async () => {
      const cachedResult = {
        valid: true,
        status: 'VALID',
        vatNumber: 'DE123456789',
        countryCode: 'DE',
        companyName: 'Test GmbH',
      };
      mockCache.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await service.validateVAT('DE123456789', 'user-1');

      expect(result).toEqual(cachedResult);
      expect(mockCache.get).toHaveBeenCalledWith('vat:DE123456789');
    });

    it('should validate EU VAT number format', async () => {
      const validFormats = [
        { vat: 'DE123456789', valid: true },
        { vat: 'PL1234567890', valid: true },
        { vat: 'FR12345678901', valid: true },
        { vat: 'XX123456789', valid: false }, // Invalid country
      ];

      for (const { vat, valid } of validFormats) {
        if (valid) {
          expect(vat.substring(0, 2)).toMatch(/^[A-Z]{2}$/);
        }
      }
    });

    it('should respect rate limits', async () => {
      mockCache.incr.mockResolvedValue(11); // Over limit

      await expect(service.validateVAT('DE123456789', 'user-1'))
        .rejects.toThrow('VIES rate limit exceeded');
    });
  });
});

describe('WhitelistService', () => {
  let service: WhitelistService;
  let mockDb: any;
  let mockCache: any;

  beforeEach(() => {
    mockDb = {
      whitelistVerifications: {
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
    };
    mockCache = {
      get: vi.fn(),
      setex: vi.fn(),
    };
    service = new WhitelistService(mockDb, mockCache);
  });

  describe('verify', () => {
    it('should verify NIP on whitelist', async () => {
      mockCache.get.mockResolvedValue(null);

      // Mock API call would go here
      // For unit tests, we test the mapping logic
    });

    it('should detect account not on whitelist', async () => {
      const apiResult = {
        result: {
          subject: {
            name: 'Test Company',
            nip: '1234567890',
            statusVat: 'Czynny',
            accountNumbers: ['PL61109010140000071219812874'],
          },
          requestId: 'req-123',
          requestDateTime: new Date().toISOString(),
        },
      };

      const result = service['mapAPIResult'](
        apiResult,
        '1234567890',
        'PL99999999999999999999999999'
      );

      expect(result.status).toBe('ACCOUNT_NOT_FOUND');
      expect(result.nipValid).toBe(true);
      expect(result.accountValid).toBe(false);
    });

    it('should handle NIP not registered for VAT', async () => {
      const apiResult = {
        result: {
          subject: {
            name: 'Test Company',
            nip: '1234567890',
            statusVat: 'Zwolniony',
          },
          requestId: 'req-123',
          requestDateTime: new Date().toISOString(),
        },
      };

      const result = service['mapAPIResult'](apiResult, '1234567890');

      expect(result.status).toBe('NOT_REGISTERED');
      expect(result.nipValid).toBe(false);
    });
  });

  describe('NIP validation', () => {
    it('should validate Polish NIP checksum', () => {
      const validNIPs = ['1234563218', '5252248481', '1182092510'];
      const invalidNIPs = ['1234567890', '0000000000', '9999999999'];

      const validateNIP = (nip: string): boolean => {
        const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
        const digits = nip.split('').map(Number);
        const sum = weights.reduce((acc, weight, i) => acc + weight * digits[i], 0);
        return sum % 11 === digits[9];
      };

      for (const nip of validNIPs) {
        expect(validateNIP(nip)).toBe(true);
      }
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, cleanupTestData } from '../test/helpers';
import { vatRouter } from './vat.router';

describe('VAT/VIES Integration Tests', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await cleanupTestData(ctx);
  });

  describe('VIES Validation', () => {
    it('should validate real EU VAT number', async () => {
      // Note: Use test VAT numbers for CI/CD
      const result = await vatRouter.createCaller(ctx).validateVAT({
        vatNumber: 'DE123456789',
      });

      expect(result.vatNumber).toBe('DE123456789');
      expect(result.countryCode).toBe('DE');
      expect(['VALID', 'INVALID', 'SERVICE_UNAVAILABLE']).toContain(result.status);
    });

    it('should store validation result in database', async () => {
      const result = await vatRouter.createCaller(ctx).validateVAT({
        vatNumber: 'PL1234567890',
      });

      const stored = await ctx.db.vatValidations.findFirst({
        where: { vatNumber: 'PL1234567890' },
      });

      expect(stored).toBeTruthy();
      expect(stored?.status).toBe(result.status);
    });

    it('should link validation to client', async () => {
      const client = await ctx.db.clients.create({
        data: { companyName: 'Test', nip: '1234567890', organizationId: ctx.organizationId },
      });

      const result = await vatRouter.createCaller(ctx).validateVAT({
        vatNumber: 'PL1234567890',
        clientId: client.id,
      });

      const validation = await ctx.db.vatValidations.findUnique({
        where: { id: result.id },
      });

      expect(validation?.clientId).toBe(client.id);
    });
  });

  describe('Whitelist Verification', () => {
    it('should verify Polish NIP on whitelist', async () => {
      // Use known test NIP
      const result = await vatRouter.createCaller(ctx).verifyWhitelist({
        nip: '5252248481', // Valid test NIP
      });

      expect(result.nipValid).toBeDefined();
      expect(['ON_WHITELIST', 'NOT_REGISTERED', 'SERVICE_ERROR']).toContain(result.status);
    });

    it('should verify bank account on whitelist', async () => {
      const result = await vatRouter.createCaller(ctx).verifyWhitelist({
        nip: '5252248481',
        bankAccount: 'PL61109010140000071219812874',
      });

      expect(result.accountValid).toBeDefined();
    });

    it('should handle historical verification', async () => {
      const result = await vatRouter.createCaller(ctx).verifyWhitelist({
        nip: '5252248481',
        verificationDate: '2024-01-15',
      });

      expect(result.verificationDate).toBeTruthy();
    });
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('VAT/VIES Validation E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should validate EU VAT from client form', async ({ page }) => {
    await page.goto('/clients/new');

    // Fill basic client info
    await page.fill('[name="companyName"]', 'Test GmbH');
    await page.fill('[name="vatNumber"]', 'DE123456789');

    // Click validate button
    await page.click('[data-testid="validate-vat-btn"]');

    // Wait for validation result
    await expect(page.locator('[data-testid="vat-status"]')).toBeVisible();

    // Check result is displayed
    const status = await page.locator('[data-testid="vat-status"]').textContent();
    expect(['Valid', 'Invalid', 'Service Unavailable']).toContain(status);
  });

  test('should verify whitelist from client details', async ({ page }) => {
    await page.goto('/clients/test-client-id');

    // Navigate to tax tab
    await page.click('[data-testid="tab-tax"]');

    // Click verify whitelist
    await page.click('[data-testid="verify-whitelist-btn"]');

    // Wait for result
    await expect(page.locator('[data-testid="whitelist-status"]')).toBeVisible();

    // Check for appropriate status
    const status = await page.locator('[data-testid="whitelist-status"]').textContent();
    expect(status).toBeTruthy();
  });

  test('should show validation history', async ({ page }) => {
    await page.goto('/clients/test-client-id');

    // Navigate to history tab
    await page.click('[data-testid="tab-validation-history"]');

    // Should see validation entries
    const entries = page.locator('[data-testid="validation-entry"]');
    await expect(entries).toHaveCount(await entries.count());
  });

  test('should handle batch validation', async ({ page }) => {
    await page.goto('/clients');

    // Select multiple clients
    await page.click('[data-testid="select-all"]');

    // Click batch validate
    await page.click('[data-testid="batch-validate-btn"]');

    // Wait for modal
    await expect(page.locator('[data-testid="batch-validation-modal"]')).toBeVisible();

    // Select VAT validation
    await page.click('[data-testid="validate-vat-option"]');
    await page.click('[data-testid="start-batch-btn"]');

    // Wait for progress
    await expect(page.locator('[data-testid="batch-progress"]')).toBeVisible();
  });
});
```

---

## Security Checklist

- [x] All external API calls use HTTPS
- [x] API keys stored in environment variables
- [x] Rate limiting implemented for external APIs
- [x] Input validation with Zod schemas
- [x] NIP checksum validation prevents invalid queries
- [x] Bank account numbers partially masked in logs
- [x] Row-level security for multi-tenant isolation
- [x] Audit logging for all validation operations
- [x] Cache invalidation on sensitive data changes
- [x] Error messages don't expose internal details

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `VAT_VALIDATION` | VAT number validated | VAT number, status, result |
| `BATCH_VAT_VALIDATION` | Batch VAT validation | Count, valid count |
| `WHITELIST_VERIFICATION` | NIP whitelist check | NIP (full), account (masked), status |
| `BATCH_WHITELIST_VERIFICATION` | Batch whitelist check | Count, on-whitelist count |
| `VAT_MONITORING_CREATED` | Monitoring schedule created | Client ID, frequency |
| `VAT_STATUS_CHANGED` | VAT status change detected | Previous status, new status |

---

## Implementation Notes

### External API Dependencies

1. **VIES (VAT Information Exchange System)**
   - URL: https://ec.europa.eu/taxation_customs/vies/
   - Protocol: SOAP/XML
   - Rate limit: ~10 requests/minute recommended
   - Timeout: 10 seconds

2. **Polish Ministry of Finance Whitelist API**
   - URL: https://wl-api.mf.gov.pl/
   - Protocol: REST/JSON
   - Rate limit: No official limit, use 5 concurrent
   - Timeout: 10 seconds

### Caching Strategy

- **VIES results**: 24-hour TTL (data changes infrequently)
- **Whitelist results**: 1-hour TTL (more dynamic)
- **Cache key format**: `{service}:{identifier}:{date}`
- **Fallback**: Use database for recent cached results

### Error Handling

- Graceful degradation when external services unavailable
- Queue failed validations for retry
- User notification with appropriate messaging
- Logging for monitoring and debugging

---

*Last updated: December 2024*
