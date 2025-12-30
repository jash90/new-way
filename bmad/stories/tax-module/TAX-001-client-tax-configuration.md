# Story: Client Tax Configuration (TAX-001)

> **Story ID**: TAX-001
> **Epic**: Tax Compliance Module (TAX)
> **Priority**: P0 (Critical)
> **Story Points**: 8
> **Status**: 📋 Ready for Development

---

## 📋 User Story

**As an** accountant,
**I want to** configure tax settings for each client,
**So that** tax calculations are performed according to their specific requirements and Polish tax regulations.

---

## 🎯 Acceptance Criteria

### AC1: VAT Payer Configuration

```gherkin
Feature: VAT Payer Configuration
  As an accountant
  I need to configure VAT payer status for clients
  So that VAT calculations are performed correctly

  Background:
    Given I am logged in as an accountant
    And I have a client "ABC Sp. z o.o." with NIP "5261234567"

  Scenario: Configure client as monthly VAT payer
    Given I am on the client tax configuration page
    When I set VAT payer status to "active"
    And I set VAT period to "monthly"
    And I save the configuration
    Then the client should be marked as monthly VAT payer
    And the system should expect JPK_V7M submissions
    And the deadline should be set to 25th of following month

  Scenario: Configure client as quarterly VAT payer
    Given I am on the client tax configuration page
    When I set VAT payer status to "active"
    And I set VAT period to "quarterly"
    And I verify small taxpayer status (revenue < 2M EUR)
    And I save the configuration
    Then the client should be marked as quarterly VAT payer
    And the system should expect JPK_V7K submissions
    And the deadline should be set to 25th of month following quarter

  Scenario: Configure client as VAT exempt
    Given I am on the client tax configuration page
    When I set VAT payer status to "exempt"
    And I select exemption reason "Art. 113 - obrót < 200.000 PLN"
    And I save the configuration
    Then the client should be marked as VAT exempt
    And VAT calculations should be disabled
    And the exemption reason should be recorded in audit log

  Scenario: Attempt to configure quarterly VAT without small taxpayer status
    Given the client has revenue exceeding 2M EUR
    When I try to set VAT period to "quarterly"
    Then the system should display error "Quarterly VAT available only for small taxpayers"
    And the configuration should not be saved
```

### AC2: Income Tax Configuration

```gherkin
Feature: Income Tax Configuration
  As an accountant
  I need to configure income tax form for clients
  So that proper CIT or PIT declarations are prepared

  Background:
    Given I am logged in as an accountant
    And I have access to client tax settings

  Scenario: Configure CIT for corporation
    Given the client legal form is "Sp. z o.o."
    When I configure tax form as "CIT"
    And I set CIT rate to "19%"
    And I configure accounting year start date
    And I save the configuration
    Then the client should be set up for CIT declarations
    And CIT-8 annual declaration should be scheduled
    And monthly advance payments should be configured

  Scenario: Configure CIT with small taxpayer rate
    Given the client legal form is "Sp. z o.o."
    And the client annual revenue is below 2M EUR
    When I configure tax form as "CIT"
    And I verify small taxpayer eligibility
    And I set CIT rate to "9%"
    And I save the configuration
    Then the client should have 9% CIT rate applied
    And quarterly advance payments should be available

  Scenario: Configure PIT for sole proprietorship
    Given the client legal form is "JDG" (jednoosobowa działalność gospodarcza)
    When I configure tax form as "PIT"
    And I select tax scale option "progressive" (12%/32%)
    And I save the configuration
    Then the client should be set up for PIT declarations
    And PIT-36 annual declaration should be scheduled

  Scenario: Configure flat tax PIT
    Given the client legal form is "JDG"
    When I configure tax form as "PIT"
    And I select tax option "flat" (19%)
    And I acknowledge loss of joint filing option
    And I save the configuration
    Then the client should have 19% flat tax rate
    And PIT-36L annual declaration should be scheduled

  Scenario: Configure Estonian CIT
    Given the client legal form is "Sp. z o.o."
    And the client meets Estonian CIT requirements
    When I configure tax form as "CIT"
    And I enable Estonian CIT option
    And I verify employment level requirements
    And I save the configuration
    Then the client should be set up for Estonian CIT
    And tax on distributed profits should be configured
    And retention of profits should not be taxed
```

### AC3: ZUS Configuration

```gherkin
Feature: ZUS Contribution Configuration
  As an accountant
  I need to configure ZUS contribution settings for clients
  So that social security obligations are calculated correctly

  Background:
    Given I am logged in as an accountant
    And I have a self-employed client

  Scenario: Configure standard ZUS contributions
    Given the client is a self-employed person
    When I configure ZUS type as "standard"
    And I set the contribution base to declared amount
    And I enable all contribution types
    And I save the configuration
    Then standard ZUS rates should be applied
    And monthly DRA declaration should be scheduled by 20th

  Scenario: Configure preferential ZUS (Mały ZUS Plus)
    Given the client meets Mały ZUS Plus requirements
    And annual revenue is below 120.000 PLN
    When I configure ZUS type as "preferential"
    And I verify eligibility period (36 months in last 60)
    And I calculate contribution base from revenue
    And I save the configuration
    Then preferential contribution base should be calculated
    And the client should be flagged for eligibility review

  Scenario: Configure ZUS for new business (ulga na start)
    Given the client started business within last 6 months
    And this is their first business registration
    When I configure ZUS type as "ulga_na_start"
    And I set start date of business
    And I save the configuration
    Then only health insurance should be required
    And social contributions should be exempt for 6 months
    And expiration date should be calculated and tracked

  Scenario: Configure employer ZUS
    Given the client is a company with employees
    When I configure employer ZUS settings
    And I set accident insurance rate based on PKD code
    And I enable Labor Fund (FP) contribution
    And I enable FGŚP contribution
    And I save the configuration
    Then employer contribution rates should be configured
    And monthly DRA with RCA attachments should be scheduled
```

### AC4: e-Declaration Preferences

```gherkin
Feature: e-Declaration Configuration
  As an accountant
  I need to configure e-declaration preferences for clients
  So that electronic submissions are prepared correctly

  Background:
    Given I am logged in as an accountant
    And I have client with tax configuration

  Scenario: Configure authorized representative
    Given the client has granted POA for tax submissions
    When I add authorized representative details
    And I enter representative's NIP and name
    And I specify authorization scope (VAT, CIT, ZUS)
    And I set authorization validity period
    And I save the configuration
    Then the representative should be linked to client
    And UPL-1 authorization reference should be stored

  Scenario: Configure submission method
    Given the client has active tax configuration
    When I configure submission method as "automatic"
    And I enable automatic UPO download
    And I set notification preferences (email, in-app)
    And I save the configuration
    Then submissions should be sent automatically when ready
    And UPO confirmations should be downloaded and stored

  Scenario: Configure manual approval workflow
    Given the client requires approval before submission
    When I configure submission method as "manual_approval"
    And I add approval workflow with reviewers
    And I set approval deadline (days before filing deadline)
    And I save the configuration
    Then declarations should wait for approval
    And notifications should be sent to reviewers
    And deadline alerts should include approval buffer
```

### AC5: Tax Configuration Audit

```gherkin
Feature: Tax Configuration Audit Trail
  As an administrator
  I need complete audit trail of tax configuration changes
  So that I can track who changed what and when

  Scenario: Track configuration changes
    Given a tax configuration exists for client
    When any configuration field is modified
    Then an audit log entry should be created
    And the entry should contain:
      | field          | value                           |
      | timestamp      | current datetime (UTC)          |
      | user_id        | modifying user                  |
      | client_id      | affected client                 |
      | field_changed  | configuration field name        |
      | old_value      | previous value                  |
      | new_value      | updated value                   |
      | change_reason  | optional justification          |
      | ip_address     | user's IP address               |
      | session_id     | correlation ID                  |

  Scenario: View configuration history
    Given a tax configuration has been modified multiple times
    When I view the configuration history
    Then I should see chronological list of changes
    And I should be able to filter by date range
    And I should be able to filter by field name
    And I should be able to export history to PDF

  Scenario: Restore previous configuration
    Given a tax configuration was incorrectly modified
    When I select a previous version from history
    And I click "Restore this version"
    And I provide restoration reason
    Then the configuration should revert to selected version
    And a new audit entry should record the restoration
```

---

## 🗄️ Database Schema

### Tax Configuration Table

```sql
-- Tax configuration for clients
CREATE TABLE tax_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- VAT Configuration
    vat_status VARCHAR(20) NOT NULL DEFAULT 'not_registered',
    vat_period VARCHAR(20), -- 'monthly', 'quarterly'
    vat_exemption_reason VARCHAR(100),
    vat_registration_date DATE,
    vat_deregistration_date DATE,

    -- Income Tax Configuration
    income_tax_form VARCHAR(10) NOT NULL, -- 'CIT', 'PIT'
    income_tax_rate DECIMAL(5,2),
    is_small_taxpayer BOOLEAN DEFAULT false,
    estonian_cit_enabled BOOLEAN DEFAULT false,
    estonian_cit_start_date DATE,
    pit_tax_option VARCHAR(20), -- 'progressive', 'flat', 'lump_sum'
    accounting_year_start DATE DEFAULT '01-01',

    -- ZUS Configuration
    zus_type VARCHAR(30), -- 'standard', 'preferential', 'ulga_na_start', 'employer'
    zus_contribution_base DECIMAL(12,2),
    zus_accident_rate DECIMAL(5,2) DEFAULT 1.67,
    zus_fp_enabled BOOLEAN DEFAULT true,
    zus_fgsp_enabled BOOLEAN DEFAULT true,
    zus_ulga_expiry_date DATE,

    -- e-Declaration Configuration
    submission_method VARCHAR(20) DEFAULT 'manual', -- 'automatic', 'manual_approval'
    auto_upo_download BOOLEAN DEFAULT true,
    notification_email VARCHAR(255),
    notification_in_app BOOLEAN DEFAULT true,
    approval_required BOOLEAN DEFAULT false,
    approval_days_before INTEGER DEFAULT 5,

    -- Metadata
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),

    CONSTRAINT chk_vat_status CHECK (vat_status IN ('active', 'exempt', 'not_registered', 'invalid')),
    CONSTRAINT chk_income_tax_form CHECK (income_tax_form IN ('CIT', 'PIT')),
    CONSTRAINT chk_zus_type CHECK (zus_type IN ('standard', 'preferential', 'ulga_na_start', 'employer', 'none'))
);

-- Indexes for performance
CREATE INDEX idx_tax_config_client ON tax_configurations(client_id);
CREATE INDEX idx_tax_config_tenant ON tax_configurations(tenant_id);
CREATE INDEX idx_tax_config_active ON tax_configurations(is_active) WHERE is_active = true;
CREATE INDEX idx_tax_config_vat_status ON tax_configurations(vat_status);

-- Authorized representatives for e-declarations
CREATE TABLE tax_representatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    representative_nip VARCHAR(10) NOT NULL,
    representative_name VARCHAR(200) NOT NULL,
    authorization_scope TEXT[] NOT NULL, -- ['VAT', 'CIT', 'PIT', 'ZUS']
    upl1_reference VARCHAR(50),
    valid_from DATE NOT NULL,
    valid_to DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    CONSTRAINT chk_representative_nip CHECK (representative_nip ~ '^[0-9]{10}$')
);

CREATE INDEX idx_tax_rep_client ON tax_representatives(client_id);
CREATE INDEX idx_tax_rep_active ON tax_representatives(is_active) WHERE is_active = true;

-- Tax configuration audit log
CREATE TABLE tax_configuration_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    configuration_id UUID NOT NULL REFERENCES tax_configurations(id),
    client_id UUID NOT NULL REFERENCES clients(id),
    user_id UUID NOT NULL REFERENCES users(id),

    action VARCHAR(20) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'RESTORE'
    field_changed VARCHAR(100),
    old_value JSONB,
    new_value JSONB,
    change_reason TEXT,

    ip_address INET,
    user_agent TEXT,
    session_id UUID,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_audit_action CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'RESTORE'))
);

CREATE INDEX idx_tax_audit_config ON tax_configuration_audit(configuration_id);
CREATE INDEX idx_tax_audit_client ON tax_configuration_audit(client_id);
CREATE INDEX idx_tax_audit_created ON tax_configuration_audit(created_at DESC);

-- Row Level Security
ALTER TABLE tax_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_configuration_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY tax_config_tenant_isolation ON tax_configurations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY tax_rep_tenant_isolation ON tax_representatives
    FOR ALL USING (
        client_id IN (SELECT id FROM clients WHERE tenant_id = current_setting('app.current_tenant')::UUID)
    );

CREATE POLICY tax_audit_tenant_isolation ON tax_configuration_audit
    FOR ALL USING (
        client_id IN (SELECT id FROM clients WHERE tenant_id = current_setting('app.current_tenant')::UUID)
    );
```

---

## 🔌 API Specification

### Endpoints

```typescript
// Tax Configuration CRUD
POST   /api/trpc/tax.createConfiguration
GET    /api/trpc/tax.getConfiguration
GET    /api/trpc/tax.getConfigurationByClient
PUT    /api/trpc/tax.updateConfiguration
DELETE /api/trpc/tax.deleteConfiguration

// Tax Representatives
POST   /api/trpc/tax.addRepresentative
GET    /api/trpc/tax.getRepresentatives
PUT    /api/trpc/tax.updateRepresentative
DELETE /api/trpc/tax.removeRepresentative

// Configuration History
GET    /api/trpc/tax.getConfigurationHistory
POST   /api/trpc/tax.restoreConfiguration

// Validation
POST   /api/trpc/tax.validateConfiguration
POST   /api/trpc/tax.checkSmallTaxpayerStatus
POST   /api/trpc/tax.checkEstonianCITEligibility
```

### Zod Schemas

```typescript
import { z } from 'zod';

// VAT Status enum
export const VATStatusSchema = z.enum([
  'active',
  'exempt',
  'not_registered',
  'invalid'
]);

// VAT Period enum
export const VATPeriodSchema = z.enum([
  'monthly',
  'quarterly'
]);

// Income Tax Form enum
export const IncomeTaxFormSchema = z.enum([
  'CIT',
  'PIT'
]);

// PIT Tax Option enum
export const PITTaxOptionSchema = z.enum([
  'progressive',
  'flat',
  'lump_sum'
]);

// ZUS Type enum
export const ZUSTypeSchema = z.enum([
  'standard',
  'preferential',
  'ulga_na_start',
  'employer',
  'none'
]);

// Submission Method enum
export const SubmissionMethodSchema = z.enum([
  'automatic',
  'manual',
  'manual_approval'
]);

// Authorization Scope enum
export const AuthorizationScopeSchema = z.enum([
  'VAT',
  'CIT',
  'PIT',
  'ZUS'
]);

// NIP validation with checksum
const nipRegex = /^[0-9]{10}$/;

export const validateNIP = (nip: string): boolean => {
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const digits = nip.replace(/\D/g, '');

  if (digits.length !== 10) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * weights[i];
  }

  const checksum = sum % 11;
  return checksum === parseInt(digits[9]);
};

// Tax Configuration Input Schema
export const TaxConfigurationInputSchema = z.object({
  clientId: z.string().uuid(),

  // VAT Configuration
  vatStatus: VATStatusSchema,
  vatPeriod: VATPeriodSchema.optional(),
  vatExemptionReason: z.string().max(100).optional(),
  vatRegistrationDate: z.string().datetime().optional(),

  // Income Tax Configuration
  incomeTaxForm: IncomeTaxFormSchema,
  incomeTaxRate: z.number().min(0).max(100).optional(),
  isSmallTaxpayer: z.boolean().default(false),
  estonianCitEnabled: z.boolean().default(false),
  estonianCitStartDate: z.string().datetime().optional(),
  pitTaxOption: PITTaxOptionSchema.optional(),
  accountingYearStart: z.string().regex(/^\d{2}-\d{2}$/).default('01-01'),

  // ZUS Configuration
  zusType: ZUSTypeSchema.optional(),
  zusContributionBase: z.number().positive().optional(),
  zusAccidentRate: z.number().min(0.67).max(3.33).default(1.67),
  zusFpEnabled: z.boolean().default(true),
  zusFgspEnabled: z.boolean().default(true),
  zusUlgaExpiryDate: z.string().datetime().optional(),

  // e-Declaration Configuration
  submissionMethod: SubmissionMethodSchema.default('manual'),
  autoUpoDownload: z.boolean().default(true),
  notificationEmail: z.string().email().optional(),
  notificationInApp: z.boolean().default(true),
  approvalRequired: z.boolean().default(false),
  approvalDaysBefore: z.number().int().min(1).max(30).default(5),

  // Effective dates
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional()
}).refine((data) => {
  // Quarterly VAT only for small taxpayers
  if (data.vatPeriod === 'quarterly' && !data.isSmallTaxpayer) {
    return false;
  }
  return true;
}, {
  message: 'Quarterly VAT is only available for small taxpayers'
}).refine((data) => {
  // Estonian CIT only for CIT payers
  if (data.estonianCitEnabled && data.incomeTaxForm !== 'CIT') {
    return false;
  }
  return true;
}, {
  message: 'Estonian CIT is only available for CIT taxpayers'
});

// Tax Representative Input Schema
export const TaxRepresentativeInputSchema = z.object({
  clientId: z.string().uuid(),
  representativeNip: z.string().refine(validateNIP, {
    message: 'Invalid NIP checksum'
  }),
  representativeName: z.string().min(2).max(200),
  authorizationScope: z.array(AuthorizationScopeSchema).min(1),
  upl1Reference: z.string().max(50).optional(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().optional()
});

// Tax Configuration Response Schema
export const TaxConfigurationResponseSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  clientName: z.string(),
  clientNip: z.string(),

  // VAT Configuration
  vatStatus: VATStatusSchema,
  vatPeriod: VATPeriodSchema.nullable(),
  vatExemptionReason: z.string().nullable(),
  vatRegistrationDate: z.string().datetime().nullable(),

  // Income Tax Configuration
  incomeTaxForm: IncomeTaxFormSchema,
  incomeTaxRate: z.number().nullable(),
  isSmallTaxpayer: z.boolean(),
  estonianCitEnabled: z.boolean(),
  pitTaxOption: PITTaxOptionSchema.nullable(),

  // ZUS Configuration
  zusType: ZUSTypeSchema.nullable(),
  zusContributionBase: z.number().nullable(),
  zusAccidentRate: z.number(),

  // e-Declaration Configuration
  submissionMethod: SubmissionMethodSchema,
  autoUpoDownload: z.boolean(),
  approvalRequired: z.boolean(),

  // Representatives
  representatives: z.array(z.object({
    id: z.string().uuid(),
    representativeNip: z.string(),
    representativeName: z.string(),
    authorizationScope: z.array(AuthorizationScopeSchema),
    validFrom: z.string().datetime(),
    validTo: z.string().datetime().nullable(),
    isActive: z.boolean()
  })),

  // Metadata
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// Configuration History Entry Schema
export const ConfigurationHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'RESTORE']),
  fieldChanged: z.string().nullable(),
  oldValue: z.any().nullable(),
  newValue: z.any().nullable(),
  changeReason: z.string().nullable(),
  userName: z.string(),
  userEmail: z.string(),
  createdAt: z.string().datetime()
});
```

### tRPC Router Implementation

```typescript
import { router, protectedProcedure } from '../trpc';
import { TaxConfigurationInputSchema, TaxRepresentativeInputSchema } from './schemas';
import { TRPCError } from '@trpc/server';
import { Decimal } from 'decimal.js';

export const taxConfigurationRouter = router({
  // Create new tax configuration
  createConfiguration: protectedProcedure
    .input(TaxConfigurationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user, tenantId } = ctx;

      // Verify client belongs to tenant
      const client = await db.client.findFirst({
        where: {
          id: input.clientId,
          tenantId
        }
      });

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found'
        });
      }

      // Check for existing active configuration
      const existingConfig = await db.taxConfiguration.findFirst({
        where: {
          clientId: input.clientId,
          isActive: true
        }
      });

      if (existingConfig) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Active tax configuration already exists for this client'
        });
      }

      // Validate small taxpayer status for quarterly VAT
      if (input.vatPeriod === 'quarterly') {
        const isEligible = await checkSmallTaxpayerStatus(client.id, db);
        if (!isEligible) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Client does not qualify for quarterly VAT (small taxpayer status required)'
          });
        }
      }

      // Validate Estonian CIT eligibility
      if (input.estonianCitEnabled) {
        const isEligible = await checkEstonianCITEligibility(client.id, db);
        if (!isEligible) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Client does not meet Estonian CIT requirements'
          });
        }
      }

      // Create configuration
      const configuration = await db.taxConfiguration.create({
        data: {
          clientId: input.clientId,
          tenantId,
          vatStatus: input.vatStatus,
          vatPeriod: input.vatPeriod,
          vatExemptionReason: input.vatExemptionReason,
          vatRegistrationDate: input.vatRegistrationDate,
          incomeTaxForm: input.incomeTaxForm,
          incomeTaxRate: input.incomeTaxRate ? new Decimal(input.incomeTaxRate) : null,
          isSmallTaxpayer: input.isSmallTaxpayer,
          estonianCitEnabled: input.estonianCitEnabled,
          estonianCitStartDate: input.estonianCitStartDate,
          pitTaxOption: input.pitTaxOption,
          accountingYearStart: input.accountingYearStart,
          zusType: input.zusType,
          zusContributionBase: input.zusContributionBase ? new Decimal(input.zusContributionBase) : null,
          zusAccidentRate: new Decimal(input.zusAccidentRate),
          zusFpEnabled: input.zusFpEnabled,
          zusFgspEnabled: input.zusFgspEnabled,
          zusUlgaExpiryDate: input.zusUlgaExpiryDate,
          submissionMethod: input.submissionMethod,
          autoUpoDownload: input.autoUpoDownload,
          notificationEmail: input.notificationEmail,
          notificationInApp: input.notificationInApp,
          approvalRequired: input.approvalRequired,
          approvalDaysBefore: input.approvalDaysBefore,
          effectiveFrom: input.effectiveFrom || new Date().toISOString(),
          effectiveTo: input.effectiveTo,
          isActive: true,
          createdBy: user.id,
          updatedBy: user.id
        }
      });

      // Create audit log entry
      await db.taxConfigurationAudit.create({
        data: {
          configurationId: configuration.id,
          clientId: input.clientId,
          userId: user.id,
          action: 'CREATE',
          newValue: input,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          sessionId: ctx.sessionId
        }
      });

      // Emit event for deadline creation
      await ctx.events.emit('tax.configuration.created', {
        configurationId: configuration.id,
        clientId: input.clientId,
        tenantId,
        vatPeriod: input.vatPeriod,
        incomeTaxForm: input.incomeTaxForm
      });

      return configuration;
    }),

  // Get configuration by client
  getConfigurationByClient: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { db, tenantId } = ctx;

      const configuration = await db.taxConfiguration.findFirst({
        where: {
          clientId: input.clientId,
          tenantId,
          isActive: true
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              nip: true,
              legalForm: true
            }
          },
          representatives: {
            where: { isActive: true }
          }
        }
      });

      if (!configuration) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tax configuration not found for this client'
        });
      }

      return configuration;
    }),

  // Update configuration
  updateConfiguration: protectedProcedure
    .input(z.object({
      configurationId: z.string().uuid(),
      data: TaxConfigurationInputSchema.partial(),
      changeReason: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, user, tenantId } = ctx;

      const existingConfig = await db.taxConfiguration.findFirst({
        where: {
          id: input.configurationId,
          tenantId
        }
      });

      if (!existingConfig) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tax configuration not found'
        });
      }

      // Store old values for audit
      const oldValues = { ...existingConfig };

      // Update configuration
      const updated = await db.taxConfiguration.update({
        where: { id: input.configurationId },
        data: {
          ...input.data,
          updatedBy: user.id,
          updatedAt: new Date()
        }
      });

      // Create audit entries for each changed field
      for (const [key, newValue] of Object.entries(input.data)) {
        if (oldValues[key] !== newValue) {
          await db.taxConfigurationAudit.create({
            data: {
              configurationId: input.configurationId,
              clientId: existingConfig.clientId,
              userId: user.id,
              action: 'UPDATE',
              fieldChanged: key,
              oldValue: oldValues[key],
              newValue: newValue,
              changeReason: input.changeReason,
              ipAddress: ctx.ipAddress,
              userAgent: ctx.userAgent,
              sessionId: ctx.sessionId
            }
          });
        }
      }

      // Emit event for configuration update
      await ctx.events.emit('tax.configuration.updated', {
        configurationId: updated.id,
        clientId: existingConfig.clientId,
        tenantId,
        changedFields: Object.keys(input.data)
      });

      return updated;
    }),

  // Get configuration history
  getConfigurationHistory: protectedProcedure
    .input(z.object({
      configurationId: z.string().uuid(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      fieldName: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      cursor: z.string().uuid().optional()
    }))
    .query(async ({ ctx, input }) => {
      const { db, tenantId } = ctx;

      const config = await db.taxConfiguration.findFirst({
        where: {
          id: input.configurationId,
          tenantId
        }
      });

      if (!config) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tax configuration not found'
        });
      }

      const where: any = {
        configurationId: input.configurationId
      };

      if (input.startDate) {
        where.createdAt = { ...where.createdAt, gte: new Date(input.startDate) };
      }

      if (input.endDate) {
        where.createdAt = { ...where.createdAt, lte: new Date(input.endDate) };
      }

      if (input.fieldName) {
        where.fieldChanged = input.fieldName;
      }

      if (input.cursor) {
        where.id = { lt: input.cursor };
      }

      const history = await db.taxConfigurationAudit.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1
      });

      let nextCursor: string | undefined;
      if (history.length > input.limit) {
        const nextItem = history.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: history,
        nextCursor
      };
    }),

  // Restore previous configuration
  restoreConfiguration: protectedProcedure
    .input(z.object({
      configurationId: z.string().uuid(),
      auditEntryId: z.string().uuid(),
      restoreReason: z.string().min(10)
    }))
    .mutation(async ({ ctx, input }) => {
      const { db, user, tenantId } = ctx;

      // Get the audit entry to restore from
      const auditEntry = await db.taxConfigurationAudit.findUnique({
        where: { id: input.auditEntryId }
      });

      if (!auditEntry || auditEntry.configurationId !== input.configurationId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Audit entry not found'
        });
      }

      const config = await db.taxConfiguration.findFirst({
        where: {
          id: input.configurationId,
          tenantId
        }
      });

      if (!config) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tax configuration not found'
        });
      }

      const currentValues = { ...config };

      // Restore the old value
      const updated = await db.taxConfiguration.update({
        where: { id: input.configurationId },
        data: {
          [auditEntry.fieldChanged as string]: auditEntry.oldValue,
          updatedBy: user.id,
          updatedAt: new Date()
        }
      });

      // Create restoration audit entry
      await db.taxConfigurationAudit.create({
        data: {
          configurationId: input.configurationId,
          clientId: config.clientId,
          userId: user.id,
          action: 'RESTORE',
          fieldChanged: auditEntry.fieldChanged,
          oldValue: currentValues[auditEntry.fieldChanged as keyof typeof currentValues],
          newValue: auditEntry.oldValue,
          changeReason: input.restoreReason,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          sessionId: ctx.sessionId
        }
      });

      return updated;
    }),

  // Check small taxpayer status
  checkSmallTaxpayerStatus: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { db, tenantId } = ctx;

      // Get client revenue from last year
      const lastYearRevenue = await db.journalEntry.aggregate({
        where: {
          clientId: input.clientId,
          accountCode: { startsWith: '7' }, // Revenue accounts
          postingDate: {
            gte: new Date(new Date().getFullYear() - 1, 0, 1),
            lt: new Date(new Date().getFullYear(), 0, 1)
          }
        },
        _sum: { creditAmount: true }
      });

      const revenue = lastYearRevenue._sum.creditAmount || new Decimal(0);
      const threshold = new Decimal(2000000 * 4.5); // ~2M EUR in PLN

      return {
        isEligible: revenue.lessThan(threshold),
        revenue: revenue.toNumber(),
        threshold: threshold.toNumber(),
        currency: 'PLN'
      };
    }),

  // Check Estonian CIT eligibility
  checkEstonianCITEligibility: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { db, tenantId } = ctx;

      const client = await db.client.findFirst({
        where: {
          id: input.clientId,
          tenantId
        }
      });

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found'
        });
      }

      const requirements = {
        isPolishCompany: ['sp_zoo', 'sa', 'sk', 'psa'].includes(client.legalForm),
        noPartnershipIncome: true, // Would need to check actual data
        employmentLevel: false, // Would need to check ZUS data
        hasQualifiedRevenue: true // Would need complex calculation
      };

      const isEligible = Object.values(requirements).every(v => v);

      return {
        isEligible,
        requirements,
        legalForm: client.legalForm
      };
    })
});

// Helper functions
async function checkSmallTaxpayerStatus(clientId: string, db: any): Promise<boolean> {
  // Implementation as above
  return true;
}

async function checkEstonianCITEligibility(clientId: string, db: any): Promise<boolean> {
  // Implementation as above
  return true;
}
```

---

## 🧪 Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestContext } from '@/test/utils';
import { taxConfigurationRouter } from './router';

describe('Tax Configuration Service', () => {
  let ctx: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    ctx = createTestContext();
    vi.clearAllMocks();
  });

  describe('createConfiguration', () => {
    it('should create tax configuration for client', async () => {
      const input = {
        clientId: 'client-uuid',
        vatStatus: 'active' as const,
        vatPeriod: 'monthly' as const,
        incomeTaxForm: 'CIT' as const,
        incomeTaxRate: 19,
        isSmallTaxpayer: false
      };

      const result = await taxConfigurationRouter.createConfiguration({
        ctx,
        input
      });

      expect(result.vatStatus).toBe('active');
      expect(result.vatPeriod).toBe('monthly');
      expect(result.incomeTaxForm).toBe('CIT');
      expect(result.isActive).toBe(true);
    });

    it('should reject quarterly VAT for non-small taxpayers', async () => {
      const input = {
        clientId: 'client-uuid',
        vatStatus: 'active' as const,
        vatPeriod: 'quarterly' as const,
        incomeTaxForm: 'CIT' as const,
        isSmallTaxpayer: false
      };

      await expect(
        taxConfigurationRouter.createConfiguration({ ctx, input })
      ).rejects.toThrow('quarterly VAT');
    });

    it('should reject Estonian CIT for non-CIT payers', async () => {
      const input = {
        clientId: 'client-uuid',
        vatStatus: 'active' as const,
        incomeTaxForm: 'PIT' as const,
        estonianCitEnabled: true
      };

      await expect(
        taxConfigurationRouter.createConfiguration({ ctx, input })
      ).rejects.toThrow('Estonian CIT');
    });

    it('should create audit log on configuration creation', async () => {
      const input = {
        clientId: 'client-uuid',
        vatStatus: 'active' as const,
        incomeTaxForm: 'CIT' as const
      };

      const result = await taxConfigurationRouter.createConfiguration({
        ctx,
        input
      });

      const audit = await ctx.db.taxConfigurationAudit.findFirst({
        where: { configurationId: result.id }
      });

      expect(audit).toBeDefined();
      expect(audit?.action).toBe('CREATE');
      expect(audit?.userId).toBe(ctx.user.id);
    });
  });

  describe('updateConfiguration', () => {
    it('should update configuration and create audit entries', async () => {
      const configId = 'config-uuid';

      const result = await taxConfigurationRouter.updateConfiguration({
        ctx,
        input: {
          configurationId: configId,
          data: { vatPeriod: 'quarterly' as const },
          changeReason: 'Client became small taxpayer'
        }
      });

      const audit = await ctx.db.taxConfigurationAudit.findFirst({
        where: {
          configurationId: configId,
          action: 'UPDATE',
          fieldChanged: 'vatPeriod'
        }
      });

      expect(audit).toBeDefined();
      expect(audit?.oldValue).toBe('monthly');
      expect(audit?.newValue).toBe('quarterly');
      expect(audit?.changeReason).toBe('Client became small taxpayer');
    });
  });

  describe('NIP Validation', () => {
    it('should validate correct NIP', () => {
      expect(validateNIP('5261234567')).toBe(true);
      expect(validateNIP('526-123-45-67')).toBe(true);
    });

    it('should reject incorrect NIP', () => {
      expect(validateNIP('1234567890')).toBe(false);
      expect(validateNIP('526123456')).toBe(false);
      expect(validateNIP('52612345678')).toBe(false);
    });
  });

  describe('ZUS Configuration', () => {
    it('should configure standard ZUS', async () => {
      const input = {
        clientId: 'client-uuid',
        vatStatus: 'active' as const,
        incomeTaxForm: 'PIT' as const,
        zusType: 'standard' as const,
        zusAccidentRate: 1.67
      };

      const result = await taxConfigurationRouter.createConfiguration({
        ctx,
        input
      });

      expect(result.zusType).toBe('standard');
      expect(Number(result.zusAccidentRate)).toBe(1.67);
    });

    it('should set ZUS ulga expiry date for ulga_na_start', async () => {
      const input = {
        clientId: 'client-uuid',
        vatStatus: 'exempt' as const,
        incomeTaxForm: 'PIT' as const,
        zusType: 'ulga_na_start' as const,
        zusUlgaExpiryDate: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      const result = await taxConfigurationRouter.createConfiguration({
        ctx,
        input
      });

      expect(result.zusType).toBe('ulga_na_start');
      expect(result.zusUlgaExpiryDate).toBeDefined();
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createIntegrationTestContext } from '@/test/integration';

describe('Tax Configuration Integration', () => {
  let ctx: Awaited<ReturnType<typeof createIntegrationTestContext>>;

  beforeAll(async () => {
    ctx = await createIntegrationTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('should create full tax configuration workflow', async () => {
    // Create client first
    const client = await ctx.trpc.crm.createClient({
      name: 'Test Sp. z o.o.',
      nip: '5261234567',
      legalForm: 'sp_zoo'
    });

    // Create tax configuration
    const config = await ctx.trpc.tax.createConfiguration({
      clientId: client.id,
      vatStatus: 'active',
      vatPeriod: 'monthly',
      incomeTaxForm: 'CIT',
      incomeTaxRate: 19,
      submissionMethod: 'automatic'
    });

    expect(config.isActive).toBe(true);

    // Verify configuration can be retrieved
    const retrieved = await ctx.trpc.tax.getConfigurationByClient({
      clientId: client.id
    });

    expect(retrieved.id).toBe(config.id);
    expect(retrieved.vatStatus).toBe('active');
  });

  it('should add and manage tax representatives', async () => {
    const client = await ctx.fixtures.createClient();
    const config = await ctx.fixtures.createTaxConfiguration(client.id);

    // Add representative
    const rep = await ctx.trpc.tax.addRepresentative({
      clientId: client.id,
      representativeNip: '1234567890',
      representativeName: 'Jan Kowalski',
      authorizationScope: ['VAT', 'CIT'],
      validFrom: new Date().toISOString()
    });

    expect(rep.isActive).toBe(true);

    // Verify representative appears in configuration
    const updated = await ctx.trpc.tax.getConfigurationByClient({
      clientId: client.id
    });

    expect(updated.representatives).toHaveLength(1);
    expect(updated.representatives[0].representativeName).toBe('Jan Kowalski');
  });

  it('should track configuration history', async () => {
    const client = await ctx.fixtures.createClient();
    const config = await ctx.fixtures.createTaxConfiguration(client.id);

    // Make multiple updates
    await ctx.trpc.tax.updateConfiguration({
      configurationId: config.id,
      data: { vatPeriod: 'quarterly' },
      changeReason: 'First change'
    });

    await ctx.trpc.tax.updateConfiguration({
      configurationId: config.id,
      data: { isSmallTaxpayer: true },
      changeReason: 'Second change'
    });

    // Get history
    const history = await ctx.trpc.tax.getConfigurationHistory({
      configurationId: config.id
    });

    expect(history.items.length).toBeGreaterThanOrEqual(3); // CREATE + 2 UPDATEs
    expect(history.items[0].action).toBe('UPDATE');
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Tax Configuration UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'accountant@test.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should configure client tax settings', async ({ page }) => {
    // Navigate to client
    await page.goto('/clients/client-uuid/tax');

    // Configure VAT
    await page.selectOption('[name="vatStatus"]', 'active');
    await page.selectOption('[name="vatPeriod"]', 'monthly');

    // Configure income tax
    await page.selectOption('[name="incomeTaxForm"]', 'CIT');
    await page.fill('[name="incomeTaxRate"]', '19');

    // Save
    await page.click('button:has-text("Zapisz konfigurację")');

    // Verify success
    await expect(page.locator('.toast-success')).toContainText('Konfiguracja zapisana');
  });

  test('should show quarterly VAT validation error', async ({ page }) => {
    await page.goto('/clients/large-client-uuid/tax');

    await page.selectOption('[name="vatStatus"]', 'active');
    await page.selectOption('[name="vatPeriod"]', 'quarterly');

    await page.click('button:has-text("Zapisz konfigurację")');

    await expect(page.locator('.error-message')).toContainText('mały podatnik');
  });

  test('should display configuration history', async ({ page }) => {
    await page.goto('/clients/client-uuid/tax/history');

    await expect(page.locator('.history-entry')).toHaveCount(3);
    await expect(page.locator('.history-entry').first()).toContainText('UPDATE');
  });
});
```

---

## 🔒 Security Checklist

- [x] **Input Validation**: All inputs validated with Zod schemas
- [x] **NIP Validation**: Checksum algorithm implemented
- [x] **Authorization**: Only authorized accountants can modify configuration
- [x] **Tenant Isolation**: Row-level security enforces multi-tenancy
- [x] **Audit Trail**: All changes logged with full context
- [x] **Data Protection**: Sensitive tax data encrypted at rest
- [x] **Session Tracking**: All operations linked to user sessions
- [x] **Rate Limiting**: Applied to configuration changes

---

## 📊 Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `tax.configuration.created` | New configuration | Full config, user, timestamp |
| `tax.configuration.updated` | Config modified | Changed fields, old/new values |
| `tax.configuration.deleted` | Config deactivated | User, reason, timestamp |
| `tax.configuration.restored` | Version restored | Restoration details |
| `tax.representative.added` | Rep added | Representative details |
| `tax.representative.removed` | Rep removed | Representative ID, reason |

---

## 📝 Implementation Notes

### Business Rules
1. Quarterly VAT requires small taxpayer status (revenue < 2M EUR)
2. Estonian CIT only for Polish corporations meeting employment requirements
3. ZUS "ulga na start" limited to first 6 months of business
4. Tax representative requires valid UPL-1 authorization

### Polish Legal References
- **VAT Period**: Art. 99 ustawy o VAT
- **Small Taxpayer**: Art. 2 pkt 25 ustawy o VAT (limit 2M EUR)
- **Estonian CIT**: Art. 28c-28t ustawy o CIT
- **ZUS Ulga**: Art. 18 ust. 1 ustawy Prawo przedsiębiorców

### Integration Points
- **CRM Module**: Client data and legal form
- **ACC Module**: Revenue calculations for small taxpayer check
- **TAX-003**: Deadline creation based on configuration
- **TAX-004/005**: Calculation parameters from configuration

---

*Story last updated: December 2024*
