# BNK-009: Multi-Provider Support

> **Story ID**: BNK-009
> **Epic**: Banking Integration Layer (BNK)
> **Priority**: P1 (Important)
> **Points**: 8
> **Status**: 📋 Ready for Development
> **Phase**: Week 24

---

## User Story

**As an** accountant,
**I want to** connect to various Polish banks through a unified interface,
**So that** I can manage all client banking relationships regardless of bank-specific API differences.

---

## Acceptance Criteria

### AC1: PKO Bank Polski Integration

```gherkin
Feature: PKO Bank Polski Integration
  As an accountant
  I need to connect to PKO BP accounts
  So that I can access Poland's largest bank

  Background:
    Given the system has PKO Bank Polski provider configured
    And the client has a PKO BP account

  Scenario: Successful PKO BP connection
    Given valid OAuth credentials for PKO BP
    When I initiate a connection request
    Then the system should use PKO BP specific authentication flow
    And handle PKO BP specific data formats
    And normalize transactions to standard format
    And return connection success confirmation

  Scenario: PKO BP API error handling
    Given an active PKO BP connection
    When the PKO BP API returns an error
    Then the system should parse PKO BP specific error codes
    And translate to standard error format
    And suggest appropriate recovery action
    And log the original error for debugging

  Scenario: PKO BP rate limiting
    Given multiple PKO BP API requests
    When approaching rate limits
    Then the system should implement backoff strategy
    And queue non-urgent requests
    And prioritize balance/transaction sync
```

### AC2: mBank Integration

```gherkin
Feature: mBank Integration
  As an accountant
  I need to connect to mBank accounts
  So that I can access modern API with good documentation

  Background:
    Given the system has mBank provider configured
    And the client has an mBank account

  Scenario: mBank OAuth 2.0 flow
    Given mBank OAuth 2.0 credentials
    When I start the authentication flow
    Then the system should redirect to mBank consent page
    And receive authorization code
    And exchange for access and refresh tokens
    And securely store tokens

  Scenario: mBank transaction retrieval
    Given an active mBank connection
    When I request transaction history
    Then the system should use mBank's pagination format
    And handle mBank specific transaction fields
    And map categories to standard taxonomy
    And preserve original mBank data for reference
```

### AC3: Provider Abstraction Layer

```gherkin
Feature: Provider Abstraction Layer
  As a system
  I need a unified interface for all bank providers
  So that business logic remains bank-agnostic

  Scenario: Unified connection interface
    Given multiple bank providers are configured
    When business logic requests a connection
    Then it should use the same interface
    And the abstraction layer routes to correct provider
    And returns standardized response format
    And hides provider-specific complexity

  Scenario: Provider capability detection
    Given a bank provider
    When querying supported features
    Then the system should return capability map
    Including supported payment types
    And available account types
    And feature flags for optional capabilities
    And API version compatibility

  Scenario: Automatic provider selection
    Given an IBAN number
    When determining the provider
    Then the system should identify bank from IBAN prefix
    And select appropriate provider adapter
    And fall back to aggregator if direct not available
```

### AC4: Santander Bank Polska Integration

```gherkin
Feature: Santander Bank Polska Integration
  As an accountant
  I need to connect to Santander accounts
  So that I can access European standard banking APIs

  Scenario: Santander API compliance
    Given Santander API credentials
    When making API calls
    Then the system should follow Berlin Group standards
    And use Santander specific extensions
    And handle consent lifecycle properly
    And support SCA when required
```

### AC5: ING Bank Śląski Integration

```gherkin
Feature: ING Bank Śląski Integration
  As an accountant
  I need to connect to ING accounts
  So that I can access banks with good Open Banking support

  Scenario: ING Open Banking connection
    Given ING API credentials
    When establishing connection
    Then the system should use ING's developer portal standards
    And handle ING specific authentication flow
    And support ING's webhook notifications
    And process ING transaction formats
```

### AC6: Aggregator Fallback

```gherkin
Feature: Aggregator Fallback
  As a system
  I need to use aggregators when direct APIs unavailable
  So that I can support banks without direct API access

  Scenario: Fallback to aggregator
    Given a bank without direct API support
    When connection is requested
    Then the system should automatically use aggregator
    And maintain same data quality standards
    And handle aggregator-specific limitations
    And notify about reduced functionality if any

  Scenario: Aggregator provider switch
    Given an active aggregator connection
    When direct API becomes available
    Then the system should offer migration option
    And transfer existing consent if possible
    And maintain transaction history continuity
```

### AC7: Provider Health Monitoring

```gherkin
Feature: Provider Health Monitoring
  As an administrator
  I need to monitor provider health
  So that I can proactively address API issues

  Scenario: Real-time health status
    Given multiple active providers
    When checking health dashboard
    Then I should see each provider status
    Including response time metrics
    And error rate statistics
    And availability percentage
    And last successful sync time

  Scenario: Health alert triggering
    Given provider health thresholds configured
    When a provider exceeds error threshold
    Then the system should generate an alert
    And notify system administrators
    And update provider status to degraded
    And consider switching to fallback if available

  Scenario: Health history reporting
    Given health data collected over time
    When generating health report
    Then I should see historical trends
    And identify problematic periods
    And compare provider reliability
    And export data for analysis
```

---

## Technical Specification

### Database Schema

```sql
-- Bank provider configurations
CREATE TABLE bank_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Provider identification
  provider_code VARCHAR(50) NOT NULL,
  provider_name VARCHAR(255) NOT NULL,
  provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('DIRECT', 'AGGREGATOR', 'HYBRID')),

  -- API configuration
  api_base_url TEXT NOT NULL,
  api_version VARCHAR(20) NOT NULL,
  auth_type VARCHAR(50) NOT NULL CHECK (auth_type IN ('OAUTH2', 'MTLS', 'API_KEY', 'CERTIFICATE')),

  -- Credentials (encrypted)
  client_id_encrypted BYTEA,
  client_secret_encrypted BYTEA,
  certificate_encrypted BYTEA,
  private_key_encrypted BYTEA,

  -- Capabilities
  capabilities JSONB NOT NULL DEFAULT '{}',
  supported_account_types TEXT[] NOT NULL DEFAULT '{}',
  supported_payment_types TEXT[] NOT NULL DEFAULT '{}',
  supported_currencies TEXT[] NOT NULL DEFAULT '{PLN}',

  -- Rate limiting
  rate_limit_requests INTEGER NOT NULL DEFAULT 100,
  rate_limit_window_seconds INTEGER NOT NULL DEFAULT 60,
  current_requests INTEGER NOT NULL DEFAULT 0,
  window_reset_at TIMESTAMPTZ,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEGRADED', 'MAINTENANCE', 'DISABLED')),
  is_primary BOOLEAN NOT NULL DEFAULT true,
  fallback_provider_id UUID REFERENCES bank_providers(id),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, provider_code)
);

-- Provider health metrics
CREATE TABLE provider_health_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES bank_providers(id) ON DELETE CASCADE,

  -- Time bucket
  bucket_start TIMESTAMPTZ NOT NULL,
  bucket_end TIMESTAMPTZ NOT NULL,

  -- Request metrics
  total_requests INTEGER NOT NULL DEFAULT 0,
  successful_requests INTEGER NOT NULL DEFAULT 0,
  failed_requests INTEGER NOT NULL DEFAULT 0,
  timeout_requests INTEGER NOT NULL DEFAULT 0,

  -- Latency metrics (milliseconds)
  avg_response_time_ms DECIMAL(10,2),
  min_response_time_ms DECIMAL(10,2),
  max_response_time_ms DECIMAL(10,2),
  p50_response_time_ms DECIMAL(10,2),
  p95_response_time_ms DECIMAL(10,2),
  p99_response_time_ms DECIMAL(10,2),

  -- Error breakdown
  error_breakdown JSONB NOT NULL DEFAULT '{}',

  -- Availability
  uptime_percentage DECIMAL(5,2),
  downtime_minutes INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(provider_id, bucket_start)
);

-- Provider IBAN mappings
CREATE TABLE provider_iban_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- IBAN prefix matching
  country_code CHAR(2) NOT NULL,
  bank_code VARCHAR(10) NOT NULL,

  -- Provider mapping
  provider_code VARCHAR(50) NOT NULL,
  provider_name VARCHAR(255) NOT NULL,

  -- Priority for multiple matches
  priority INTEGER NOT NULL DEFAULT 100,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(country_code, bank_code)
);

-- Provider feature flags
CREATE TABLE provider_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES bank_providers(id) ON DELETE CASCADE,

  feature_code VARCHAR(100) NOT NULL,
  feature_name VARCHAR(255) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Configuration
  config JSONB NOT NULL DEFAULT '{}',

  -- Limitations
  limitations TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(provider_id, feature_code)
);

-- Provider API logs
CREATE TABLE provider_api_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES bank_providers(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES bank_connections(id),

  -- Request details
  request_method VARCHAR(10) NOT NULL,
  request_path TEXT NOT NULL,
  request_headers JSONB,
  request_body_hash VARCHAR(64),

  -- Response details
  response_status INTEGER,
  response_headers JSONB,
  response_body_hash VARCHAR(64),

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Error details
  error_code VARCHAR(100),
  error_message TEXT,

  -- Correlation
  correlation_id UUID NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_provider_health_bucket ON provider_health_metrics(provider_id, bucket_start DESC);
CREATE INDEX idx_provider_api_logs_provider ON provider_api_logs(provider_id, created_at DESC);
CREATE INDEX idx_provider_api_logs_correlation ON provider_api_logs(correlation_id);
CREATE INDEX idx_provider_iban_lookup ON provider_iban_mappings(country_code, bank_code) WHERE is_active = true;

-- Row Level Security
ALTER TABLE bank_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own organization providers"
  ON bank_providers FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view own organization health metrics"
  ON provider_health_metrics FOR SELECT
  USING (provider_id IN (
    SELECT id FROM bank_providers WHERE organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  ));
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Provider codes
export const ProviderCodeSchema = z.enum([
  'PKO_BP',
  'MBANK',
  'SANTANDER',
  'ING',
  'PEKAO',
  'BNP_PARIBAS',
  'ALIOR',
  'CREDIT_AGRICOLE',
  'AGGREGATOR_SALT_EDGE',
  'AGGREGATOR_TINK',
]);

export const ProviderTypeSchema = z.enum(['DIRECT', 'AGGREGATOR', 'HYBRID']);

export const AuthTypeSchema = z.enum(['OAUTH2', 'MTLS', 'API_KEY', 'CERTIFICATE']);

export const ProviderStatusSchema = z.enum(['ACTIVE', 'DEGRADED', 'MAINTENANCE', 'DISABLED']);

// Provider configuration
export const ProviderConfigSchema = z.object({
  providerCode: ProviderCodeSchema,
  providerName: z.string().min(1).max(255),
  providerType: ProviderTypeSchema,
  apiBaseUrl: z.string().url(),
  apiVersion: z.string().min(1).max(20),
  authType: AuthTypeSchema,
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  certificate: z.string().optional(),
  privateKey: z.string().optional(),
  capabilities: z.object({
    supportsWebhooks: z.boolean().default(false),
    supportsBatchPayments: z.boolean().default(false),
    supportsSplitPayment: z.boolean().default(false),
    supportsInstantPayments: z.boolean().default(false),
    supportsScheduledPayments: z.boolean().default(false),
    supportsRecurringPayments: z.boolean().default(false),
    maxHistoryDays: z.number().int().min(1).max(730).default(90),
    supportedLanguages: z.array(z.string()).default(['pl', 'en']),
  }),
  supportedAccountTypes: z.array(z.string()).default(['CHECKING', 'SAVINGS']),
  supportedPaymentTypes: z.array(z.string()).default(['SEPA', 'DOMESTIC']),
  supportedCurrencies: z.array(z.string()).default(['PLN']),
  rateLimitRequests: z.number().int().min(1).max(10000).default(100),
  rateLimitWindowSeconds: z.number().int().min(1).max(3600).default(60),
});

// Provider capabilities query
export const ProviderCapabilitiesQuerySchema = z.object({
  providerCode: ProviderCodeSchema,
});

// Health metrics query
export const HealthMetricsQuerySchema = z.object({
  providerIds: z.array(z.string().uuid()).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  bucketSize: z.enum(['HOUR', 'DAY', 'WEEK']).default('HOUR'),
});

// IBAN provider lookup
export const IbanProviderLookupSchema = z.object({
  iban: z.string()
    .regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/, 'Nieprawidłowy format IBAN'),
});

// Provider status update
export const ProviderStatusUpdateSchema = z.object({
  providerId: z.string().uuid(),
  status: ProviderStatusSchema,
  reason: z.string().max(500).optional(),
});

// Health alert configuration
export const HealthAlertConfigSchema = z.object({
  providerId: z.string().uuid(),
  errorRateThreshold: z.number().min(0).max(100).default(5),
  responseTimeThresholdMs: z.number().int().min(100).max(30000).default(5000),
  availabilityThreshold: z.number().min(0).max(100).default(99),
  alertChannels: z.array(z.enum(['EMAIL', 'SLACK', 'WEBHOOK', 'SMS'])).default(['EMAIL']),
});

// Provider migration request
export const ProviderMigrationSchema = z.object({
  connectionId: z.string().uuid(),
  fromProvider: ProviderCodeSchema,
  toProvider: ProviderCodeSchema,
  preserveHistory: z.boolean().default(true),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type ProviderCapabilitiesQuery = z.infer<typeof ProviderCapabilitiesQuerySchema>;
export type HealthMetricsQuery = z.infer<typeof HealthMetricsQuerySchema>;
export type IbanProviderLookup = z.infer<typeof IbanProviderLookupSchema>;
export type ProviderStatusUpdate = z.infer<typeof ProviderStatusUpdateSchema>;
export type HealthAlertConfig = z.infer<typeof HealthAlertConfigSchema>;
export type ProviderMigration = z.infer<typeof ProviderMigrationSchema>;
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  ProviderConfigSchema,
  ProviderCapabilitiesQuerySchema,
  HealthMetricsQuerySchema,
  IbanProviderLookupSchema,
  ProviderStatusUpdateSchema,
  HealthAlertConfigSchema,
  ProviderMigrationSchema,
} from './schemas';
import { ProviderService } from './provider.service';
import { ProviderHealthService } from './provider-health.service';

export const providerRouter = router({
  // Get all configured providers
  getProviders: protectedProcedure
    .query(async ({ ctx }) => {
      const providerService = new ProviderService(ctx.db, ctx.encryptionService);
      return providerService.getProviders(ctx.organizationId);
    }),

  // Get provider by code
  getProvider: protectedProcedure
    .input(ProviderCapabilitiesQuerySchema)
    .query(async ({ ctx, input }) => {
      const providerService = new ProviderService(ctx.db, ctx.encryptionService);
      const provider = await providerService.getProviderByCode(
        ctx.organizationId,
        input.providerCode
      );

      if (!provider) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono dostawcy',
        });
      }

      return provider;
    }),

  // Get provider capabilities
  getCapabilities: protectedProcedure
    .input(ProviderCapabilitiesQuerySchema)
    .query(async ({ ctx, input }) => {
      const providerService = new ProviderService(ctx.db, ctx.encryptionService);
      return providerService.getProviderCapabilities(input.providerCode);
    }),

  // Lookup provider by IBAN
  lookupByIban: protectedProcedure
    .input(IbanProviderLookupSchema)
    .query(async ({ ctx, input }) => {
      const providerService = new ProviderService(ctx.db, ctx.encryptionService);
      return providerService.lookupProviderByIban(input.iban);
    }),

  // Get all supported providers
  getSupportedProviders: protectedProcedure
    .query(async ({ ctx }) => {
      const providerService = new ProviderService(ctx.db, ctx.encryptionService);
      return providerService.getSupportedProviders();
    }),

  // Configure provider
  configureProvider: protectedProcedure
    .input(ProviderConfigSchema)
    .mutation(async ({ ctx, input }) => {
      const providerService = new ProviderService(ctx.db, ctx.encryptionService);

      const provider = await providerService.configureProvider(
        ctx.organizationId,
        input,
        ctx.userId
      );

      // Audit log
      await ctx.auditLog.log({
        action: 'PROVIDER_CONFIGURED',
        resourceType: 'BANK_PROVIDER',
        resourceId: provider.id,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        details: {
          providerCode: input.providerCode,
          providerType: input.providerType,
        },
      });

      return provider;
    }),

  // Update provider status
  updateStatus: protectedProcedure
    .input(ProviderStatusUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const providerService = new ProviderService(ctx.db, ctx.encryptionService);

      const provider = await providerService.updateProviderStatus(
        input.providerId,
        input.status,
        input.reason,
        ctx.userId
      );

      // Audit log
      await ctx.auditLog.log({
        action: 'PROVIDER_STATUS_UPDATED',
        resourceType: 'BANK_PROVIDER',
        resourceId: input.providerId,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        details: {
          newStatus: input.status,
          reason: input.reason,
        },
      });

      return provider;
    }),

  // Get health metrics
  getHealthMetrics: protectedProcedure
    .input(HealthMetricsQuerySchema)
    .query(async ({ ctx, input }) => {
      const healthService = new ProviderHealthService(ctx.db);
      return healthService.getHealthMetrics(
        ctx.organizationId,
        input.providerIds,
        input.startDate ? new Date(input.startDate) : undefined,
        input.endDate ? new Date(input.endDate) : undefined,
        input.bucketSize
      );
    }),

  // Get current health status
  getCurrentHealth: protectedProcedure
    .query(async ({ ctx }) => {
      const healthService = new ProviderHealthService(ctx.db);
      return healthService.getCurrentHealthStatus(ctx.organizationId);
    }),

  // Configure health alerts
  configureAlerts: protectedProcedure
    .input(HealthAlertConfigSchema)
    .mutation(async ({ ctx, input }) => {
      const healthService = new ProviderHealthService(ctx.db);

      const config = await healthService.configureAlerts(
        input.providerId,
        input,
        ctx.userId
      );

      return config;
    }),

  // Test provider connection
  testConnection: protectedProcedure
    .input(ProviderCapabilitiesQuerySchema)
    .mutation(async ({ ctx, input }) => {
      const providerService = new ProviderService(ctx.db, ctx.encryptionService);
      return providerService.testProviderConnection(
        ctx.organizationId,
        input.providerCode
      );
    }),

  // Migrate connection to different provider
  migrateConnection: protectedProcedure
    .input(ProviderMigrationSchema)
    .mutation(async ({ ctx, input }) => {
      const providerService = new ProviderService(ctx.db, ctx.encryptionService);

      const result = await providerService.migrateConnection(
        input.connectionId,
        input.fromProvider,
        input.toProvider,
        input.preserveHistory,
        ctx.userId
      );

      // Audit log
      await ctx.auditLog.log({
        action: 'CONNECTION_MIGRATED',
        resourceType: 'BANK_CONNECTION',
        resourceId: input.connectionId,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        details: {
          fromProvider: input.fromProvider,
          toProvider: input.toProvider,
          preserveHistory: input.preserveHistory,
        },
      });

      return result;
    }),

  // Get API logs
  getApiLogs: protectedProcedure
    .input(z.object({
      providerId: z.string().uuid(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      errorOnly: z.boolean().default(false),
      limit: z.number().int().min(1).max(1000).default(100),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const providerService = new ProviderService(ctx.db, ctx.encryptionService);
      return providerService.getApiLogs(
        input.providerId,
        input.startDate ? new Date(input.startDate) : undefined,
        input.endDate ? new Date(input.endDate) : undefined,
        input.errorOnly,
        input.limit,
        input.offset
      );
    }),
});
```

### Provider Service Implementation

```typescript
import { Injectable } from '@nestjs/common';
import { Database } from '../database';
import { EncryptionService } from '../encryption/encryption.service';
import { ProviderAdapter, PKOAdapter, MBankAdapter, SantanderAdapter, INGAdapter, AggregatorAdapter } from './adapters';

// Provider adapter interface
export interface BankProviderAdapter {
  connect(credentials: ProviderCredentials): Promise<ConnectionResult>;
  disconnect(connectionId: string): Promise<void>;
  getAccounts(connectionId: string): Promise<Account[]>;
  getTransactions(accountId: string, dateFrom: Date, dateTo: Date): Promise<Transaction[]>;
  getBalance(accountId: string): Promise<Balance>;
  initiatePayment(payment: PaymentRequest): Promise<PaymentResult>;
  getCapabilities(): ProviderCapabilities;
  healthCheck(): Promise<HealthCheckResult>;
}

@Injectable()
export class ProviderService {
  private adapters: Map<string, BankProviderAdapter> = new Map();

  constructor(
    private readonly db: Database,
    private readonly encryptionService: EncryptionService
  ) {
    this.initializeAdapters();
  }

  private initializeAdapters(): void {
    this.adapters.set('PKO_BP', new PKOAdapter());
    this.adapters.set('MBANK', new MBankAdapter());
    this.adapters.set('SANTANDER', new SantanderAdapter());
    this.adapters.set('ING', new INGAdapter());
    this.adapters.set('PEKAO', new PekaoAdapter());
    this.adapters.set('BNP_PARIBAS', new BNPAdapter());
    this.adapters.set('AGGREGATOR_SALT_EDGE', new AggregatorAdapter('SALT_EDGE'));
    this.adapters.set('AGGREGATOR_TINK', new AggregatorAdapter('TINK'));
  }

  // Get adapter for provider
  getAdapter(providerCode: string): BankProviderAdapter {
    const adapter = this.adapters.get(providerCode);

    if (!adapter) {
      throw new Error(`Brak adaptera dla dostawcy: ${providerCode}`);
    }

    return adapter;
  }

  // Lookup provider by IBAN
  async lookupProviderByIban(iban: string): Promise<ProviderLookupResult> {
    const countryCode = iban.substring(0, 2);
    const bankCode = iban.substring(4, 12);

    // Polish bank code mapping
    const polishBankCodes: Record<string, string> = {
      '10201000': 'PKO_BP',
      '10201013': 'PKO_BP',
      '10201026': 'PKO_BP',
      '11402004': 'MBANK',
      '11402022': 'MBANK',
      '10901014': 'SANTANDER',
      '10500000': 'ING',
      '10501038': 'ING',
      '12401000': 'PEKAO',
      '16001000': 'BNP_PARIBAS',
      '21201111': 'CREDIT_AGRICOLE',
      '24901010': 'ALIOR',
    };

    // Try to find direct provider
    const mapping = await this.db.providerIbanMappings.findFirst({
      where: {
        countryCode,
        bankCode: {
          startsWith: bankCode.substring(0, 4),
        },
        isActive: true,
      },
      orderBy: { priority: 'asc' },
    });

    if (mapping) {
      const adapter = this.getAdapter(mapping.providerCode);
      return {
        providerCode: mapping.providerCode,
        providerName: mapping.providerName,
        providerType: 'DIRECT',
        capabilities: adapter.getCapabilities(),
        isSupported: true,
      };
    }

    // Check hardcoded Polish banks
    for (const [code, providerCode] of Object.entries(polishBankCodes)) {
      if (bankCode.startsWith(code.substring(0, 4))) {
        const adapter = this.getAdapter(providerCode);
        return {
          providerCode,
          providerName: this.getProviderName(providerCode),
          providerType: 'DIRECT',
          capabilities: adapter.getCapabilities(),
          isSupported: true,
        };
      }
    }

    // Fall back to aggregator
    return {
      providerCode: 'AGGREGATOR_SALT_EDGE',
      providerName: 'Salt Edge (Agregator)',
      providerType: 'AGGREGATOR',
      capabilities: this.getAdapter('AGGREGATOR_SALT_EDGE').getCapabilities(),
      isSupported: true,
      isAggregator: true,
      note: 'Bank obsługiwany przez agregator - niektóre funkcje mogą być ograniczone',
    };
  }

  // Get supported providers
  async getSupportedProviders(): Promise<SupportedProvider[]> {
    return [
      {
        code: 'PKO_BP',
        name: 'PKO Bank Polski',
        type: 'DIRECT',
        logo: '/logos/pko-bp.png',
        capabilities: this.getAdapter('PKO_BP').getCapabilities(),
        status: 'ACTIVE',
        popularity: 1,
      },
      {
        code: 'MBANK',
        name: 'mBank',
        type: 'DIRECT',
        logo: '/logos/mbank.png',
        capabilities: this.getAdapter('MBANK').getCapabilities(),
        status: 'ACTIVE',
        popularity: 2,
      },
      {
        code: 'SANTANDER',
        name: 'Santander Bank Polska',
        type: 'DIRECT',
        logo: '/logos/santander.png',
        capabilities: this.getAdapter('SANTANDER').getCapabilities(),
        status: 'ACTIVE',
        popularity: 3,
      },
      {
        code: 'ING',
        name: 'ING Bank Śląski',
        type: 'DIRECT',
        logo: '/logos/ing.png',
        capabilities: this.getAdapter('ING').getCapabilities(),
        status: 'ACTIVE',
        popularity: 4,
      },
      {
        code: 'PEKAO',
        name: 'Bank Pekao',
        type: 'DIRECT',
        logo: '/logos/pekao.png',
        capabilities: this.getAdapter('PEKAO').getCapabilities(),
        status: 'ACTIVE',
        popularity: 5,
      },
      {
        code: 'AGGREGATOR_SALT_EDGE',
        name: 'Inne banki (Salt Edge)',
        type: 'AGGREGATOR',
        logo: '/logos/salt-edge.png',
        capabilities: this.getAdapter('AGGREGATOR_SALT_EDGE').getCapabilities(),
        status: 'ACTIVE',
        popularity: 100,
        note: 'Obsługa pozostałych banków przez agregator',
      },
    ];
  }

  // Test provider connection
  async testProviderConnection(
    organizationId: string,
    providerCode: string
  ): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      const adapter = this.getAdapter(providerCode);
      const healthResult = await adapter.healthCheck();

      const duration = Date.now() - startTime;

      // Log the test
      await this.logApiCall(providerCode, {
        method: 'GET',
        path: '/health',
        duration,
        success: healthResult.isHealthy,
      });

      return {
        success: healthResult.isHealthy,
        responseTimeMs: duration,
        message: healthResult.isHealthy
          ? 'Połączenie z dostawcą działa prawidłowo'
          : `Problem z połączeniem: ${healthResult.errorMessage}`,
        details: healthResult,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      await this.logApiCall(providerCode, {
        method: 'GET',
        path: '/health',
        duration,
        success: false,
        error: error.message,
      });

      return {
        success: false,
        responseTimeMs: duration,
        message: `Błąd połączenia: ${error.message}`,
        error: error.message,
      };
    }
  }

  // Migrate connection to different provider
  async migrateConnection(
    connectionId: string,
    fromProvider: string,
    toProvider: string,
    preserveHistory: boolean,
    userId: string
  ): Promise<MigrationResult> {
    // Get existing connection
    const connection = await this.db.bankConnections.findUnique({
      where: { id: connectionId },
      include: { accounts: true },
    });

    if (!connection) {
      throw new Error('Nie znaleziono połączenia');
    }

    if (connection.providerCode !== fromProvider) {
      throw new Error('Połączenie nie używa wskazanego dostawcy źródłowego');
    }

    // Check target provider supports this bank
    const toAdapter = this.getAdapter(toProvider);

    // Begin migration transaction
    const result = await this.db.$transaction(async (tx) => {
      // Create new connection with new provider
      const newConnection = await tx.bankConnections.create({
        data: {
          ...connection,
          id: undefined,
          providerCode: toProvider,
          status: 'PENDING',
          previousConnectionId: connectionId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      if (preserveHistory) {
        // Copy accounts
        for (const account of connection.accounts) {
          await tx.bankAccounts.create({
            data: {
              ...account,
              id: undefined,
              connectionId: newConnection.id,
              previousAccountId: account.id,
            },
          });
        }

        // Update transactions to reference new accounts
        // (in production, this would be done via account mapping)
      }

      // Mark old connection as migrated
      await tx.bankConnections.update({
        where: { id: connectionId },
        data: {
          status: 'MIGRATED',
          migratedToId: newConnection.id,
          migratedAt: new Date(),
        },
      });

      return {
        success: true,
        newConnectionId: newConnection.id,
        oldConnectionId: connectionId,
        accountsMigrated: connection.accounts.length,
        historyPreserved: preserveHistory,
        message: 'Migracja zakończona pomyślnie. Wymagana ponowna autoryzacja.',
        requiresReauthorization: true,
      };
    });

    return result;
  }

  private getProviderName(code: string): string {
    const names: Record<string, string> = {
      'PKO_BP': 'PKO Bank Polski',
      'MBANK': 'mBank',
      'SANTANDER': 'Santander Bank Polska',
      'ING': 'ING Bank Śląski',
      'PEKAO': 'Bank Pekao',
      'BNP_PARIBAS': 'BNP Paribas',
      'CREDIT_AGRICOLE': 'Credit Agricole',
      'ALIOR': 'Alior Bank',
    };
    return names[code] || code;
  }

  private async logApiCall(
    providerCode: string,
    details: ApiCallDetails
  ): Promise<void> {
    await this.db.providerApiLogs.create({
      data: {
        providerId: await this.getProviderId(providerCode),
        requestMethod: details.method,
        requestPath: details.path,
        responseStatus: details.success ? 200 : 500,
        durationMs: details.duration,
        errorCode: details.error ? 'CONNECTION_ERROR' : null,
        errorMessage: details.error,
        correlationId: crypto.randomUUID(),
        startedAt: new Date(Date.now() - details.duration),
        completedAt: new Date(),
      },
    });
  }
}
```

### Provider Health Service

```typescript
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Database } from '../database';

@Injectable()
export class ProviderHealthService {
  constructor(private readonly db: Database) {}

  // Collect health metrics every minute
  @Cron(CronExpression.EVERY_MINUTE)
  async collectHealthMetrics(): Promise<void> {
    const providers = await this.db.bankProviders.findMany({
      where: { status: { not: 'DISABLED' } },
    });

    for (const provider of providers) {
      await this.collectProviderMetrics(provider.id);
    }
  }

  // Get current health status for all providers
  async getCurrentHealthStatus(organizationId: string): Promise<HealthStatus[]> {
    const providers = await this.db.bankProviders.findMany({
      where: { organizationId },
    });

    const statuses: HealthStatus[] = [];

    for (const provider of providers) {
      // Get last hour metrics
      const metrics = await this.db.providerHealthMetrics.findFirst({
        where: {
          providerId: provider.id,
          bucketStart: {
            gte: new Date(Date.now() - 3600000),
          },
        },
        orderBy: { bucketStart: 'desc' },
      });

      // Get last successful sync
      const lastSync = await this.db.providerApiLogs.findFirst({
        where: {
          providerId: provider.id,
          responseStatus: { lt: 400 },
        },
        orderBy: { completedAt: 'desc' },
      });

      statuses.push({
        providerId: provider.id,
        providerCode: provider.providerCode,
        providerName: provider.providerName,
        status: provider.status,
        metrics: metrics ? {
          errorRate: metrics.failedRequests / Math.max(metrics.totalRequests, 1) * 100,
          avgResponseTimeMs: metrics.avgResponseTimeMs,
          p95ResponseTimeMs: metrics.p95ResponseTimeMs,
          availability: metrics.uptimePercentage,
          totalRequests: metrics.totalRequests,
          successfulRequests: metrics.successfulRequests,
          failedRequests: metrics.failedRequests,
        } : null,
        lastSuccessfulSync: lastSync?.completedAt || null,
        isHealthy: provider.status === 'ACTIVE' &&
          (!metrics || metrics.failedRequests / Math.max(metrics.totalRequests, 1) < 0.05),
      });
    }

    return statuses;
  }

  // Get historical health metrics
  async getHealthMetrics(
    organizationId: string,
    providerIds: string[] | undefined,
    startDate: Date | undefined,
    endDate: Date | undefined,
    bucketSize: 'HOUR' | 'DAY' | 'WEEK'
  ): Promise<HealthMetricsReport> {
    const where: any = {
      provider: { organizationId },
    };

    if (providerIds?.length) {
      where.providerId = { in: providerIds };
    }

    if (startDate || endDate) {
      where.bucketStart = {};
      if (startDate) where.bucketStart.gte = startDate;
      if (endDate) where.bucketStart.lte = endDate;
    }

    const metrics = await this.db.providerHealthMetrics.findMany({
      where,
      orderBy: { bucketStart: 'desc' },
      include: {
        provider: {
          select: { providerCode: true, providerName: true },
        },
      },
    });

    // Aggregate by bucket size
    const aggregated = this.aggregateMetrics(metrics, bucketSize);

    return {
      startDate: startDate || new Date(Date.now() - 86400000),
      endDate: endDate || new Date(),
      bucketSize,
      providers: aggregated,
      summary: this.calculateSummary(metrics),
    };
  }

  // Check and trigger alerts
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkHealthAlerts(): Promise<void> {
    const alerts = await this.db.healthAlertConfigs.findMany({
      where: { isEnabled: true },
      include: { provider: true },
    });

    for (const alert of alerts) {
      await this.evaluateAlert(alert);
    }
  }

  private async evaluateAlert(alert: any): Promise<void> {
    const metrics = await this.db.providerHealthMetrics.findFirst({
      where: {
        providerId: alert.providerId,
        bucketStart: { gte: new Date(Date.now() - 300000) },
      },
      orderBy: { bucketStart: 'desc' },
    });

    if (!metrics) return;

    const errorRate = metrics.failedRequests / Math.max(metrics.totalRequests, 1) * 100;
    const shouldAlert =
      errorRate > alert.errorRateThreshold ||
      (metrics.avgResponseTimeMs && metrics.avgResponseTimeMs > alert.responseTimeThresholdMs) ||
      (metrics.uptimePercentage && metrics.uptimePercentage < alert.availabilityThreshold);

    if (shouldAlert) {
      await this.triggerAlert(alert, {
        errorRate,
        avgResponseTime: metrics.avgResponseTimeMs,
        availability: metrics.uptimePercentage,
      });
    }
  }

  private async triggerAlert(alert: any, metrics: any): Promise<void> {
    for (const channel of alert.alertChannels) {
      switch (channel) {
        case 'EMAIL':
          await this.sendEmailAlert(alert, metrics);
          break;
        case 'SLACK':
          await this.sendSlackAlert(alert, metrics);
          break;
        case 'WEBHOOK':
          await this.sendWebhookAlert(alert, metrics);
          break;
      }
    }

    // Update provider status if degraded
    if (metrics.errorRate > 10) {
      await this.db.bankProviders.update({
        where: { id: alert.providerId },
        data: { status: 'DEGRADED' },
      });
    }
  }

  private aggregateMetrics(
    metrics: any[],
    bucketSize: 'HOUR' | 'DAY' | 'WEEK'
  ): Map<string, any[]> {
    // Group by provider and aggregate by bucket size
    const grouped = new Map<string, any[]>();

    for (const metric of metrics) {
      const key = metric.provider.providerCode;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(metric);
    }

    return grouped;
  }

  private calculateSummary(metrics: any[]): HealthSummary {
    if (metrics.length === 0) {
      return {
        avgErrorRate: 0,
        avgResponseTime: 0,
        avgAvailability: 100,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
      };
    }

    const totals = metrics.reduce((acc, m) => ({
      totalRequests: acc.totalRequests + m.totalRequests,
      successfulRequests: acc.successfulRequests + m.successfulRequests,
      failedRequests: acc.failedRequests + m.failedRequests,
      responseTimeSum: acc.responseTimeSum + (m.avgResponseTimeMs || 0) * m.totalRequests,
      availabilitySum: acc.availabilitySum + (m.uptimePercentage || 100),
    }), {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimeSum: 0,
      availabilitySum: 0,
    });

    return {
      avgErrorRate: totals.failedRequests / Math.max(totals.totalRequests, 1) * 100,
      avgResponseTime: totals.responseTimeSum / Math.max(totals.totalRequests, 1),
      avgAvailability: totals.availabilitySum / metrics.length,
      totalRequests: totals.totalRequests,
      successfulRequests: totals.successfulRequests,
      failedRequests: totals.failedRequests,
    };
  }
}
```

---

## Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderService } from './provider.service';

describe('ProviderService', () => {
  let service: ProviderService;
  let mockDb: any;
  let mockEncryption: any;

  beforeEach(() => {
    mockDb = {
      providerIbanMappings: { findFirst: vi.fn() },
      bankProviders: { findMany: vi.fn(), update: vi.fn() },
      bankConnections: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      providerApiLogs: { create: vi.fn() },
      $transaction: vi.fn((fn) => fn(mockDb)),
    };
    mockEncryption = { encrypt: vi.fn(), decrypt: vi.fn() };
    service = new ProviderService(mockDb, mockEncryption);
  });

  describe('lookupProviderByIban', () => {
    it('should identify PKO BP from IBAN', async () => {
      const result = await service.lookupProviderByIban('PL10102010001234567890123456');

      expect(result.providerCode).toBe('PKO_BP');
      expect(result.providerType).toBe('DIRECT');
      expect(result.isSupported).toBe(true);
    });

    it('should identify mBank from IBAN', async () => {
      const result = await service.lookupProviderByIban('PL11140200401234567890123456');

      expect(result.providerCode).toBe('MBANK');
      expect(result.providerType).toBe('DIRECT');
    });

    it('should fall back to aggregator for unknown bank', async () => {
      mockDb.providerIbanMappings.findFirst.mockResolvedValue(null);

      const result = await service.lookupProviderByIban('PL99999900001234567890123456');

      expect(result.providerCode).toBe('AGGREGATOR_SALT_EDGE');
      expect(result.providerType).toBe('AGGREGATOR');
      expect(result.isAggregator).toBe(true);
    });
  });

  describe('getSupportedProviders', () => {
    it('should return all supported Polish banks', async () => {
      const providers = await service.getSupportedProviders();

      expect(providers.length).toBeGreaterThan(0);
      expect(providers.some(p => p.code === 'PKO_BP')).toBe(true);
      expect(providers.some(p => p.code === 'MBANK')).toBe(true);
      expect(providers.some(p => p.code === 'SANTANDER')).toBe(true);
      expect(providers.some(p => p.code === 'ING')).toBe(true);
    });

    it('should include aggregator as fallback option', async () => {
      const providers = await service.getSupportedProviders();

      const aggregator = providers.find(p => p.type === 'AGGREGATOR');
      expect(aggregator).toBeDefined();
    });
  });

  describe('testProviderConnection', () => {
    it('should return success for healthy provider', async () => {
      const result = await service.testProviderConnection('org-1', 'MBANK');

      expect(result.success).toBe(true);
      expect(result.responseTimeMs).toBeGreaterThan(0);
    });
  });

  describe('migrateConnection', () => {
    it('should migrate connection to new provider', async () => {
      mockDb.bankConnections.findUnique.mockResolvedValue({
        id: 'conn-1',
        providerCode: 'AGGREGATOR_SALT_EDGE',
        accounts: [{ id: 'acc-1', iban: 'PL...' }],
      });
      mockDb.bankConnections.create.mockResolvedValue({ id: 'conn-2' });

      const result = await service.migrateConnection(
        'conn-1',
        'AGGREGATOR_SALT_EDGE',
        'PKO_BP',
        true,
        'user-1'
      );

      expect(result.success).toBe(true);
      expect(result.newConnectionId).toBe('conn-2');
      expect(result.requiresReauthorization).toBe(true);
    });

    it('should reject migration with wrong source provider', async () => {
      mockDb.bankConnections.findUnique.mockResolvedValue({
        id: 'conn-1',
        providerCode: 'MBANK',
      });

      await expect(
        service.migrateConnection('conn-1', 'PKO_BP', 'ING', true, 'user-1')
      ).rejects.toThrow('Połączenie nie używa wskazanego dostawcy źródłowego');
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext } from '../test/context';

describe('Multi-Provider Integration', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('Provider Lookup Flow', () => {
    it('should lookup and connect via correct provider', async () => {
      // Step 1: Lookup provider by IBAN
      const lookup = await ctx.trpc.provider.lookupByIban({
        iban: 'PL10102010001234567890123456',
      });

      expect(lookup.providerCode).toBe('PKO_BP');
      expect(lookup.isSupported).toBe(true);

      // Step 2: Get provider capabilities
      const capabilities = await ctx.trpc.provider.getCapabilities({
        providerCode: lookup.providerCode,
      });

      expect(capabilities.supportsWebhooks).toBeDefined();
      expect(capabilities.supportedPaymentTypes).toContain('DOMESTIC');
    });

    it('should handle aggregator fallback for unsupported bank', async () => {
      const lookup = await ctx.trpc.provider.lookupByIban({
        iban: 'PL99999900001234567890123456',
      });

      expect(lookup.providerType).toBe('AGGREGATOR');
      expect(lookup.note).toContain('agregator');
    });
  });

  describe('Health Monitoring Flow', () => {
    it('should track and report provider health', async () => {
      // Get current health status
      const health = await ctx.trpc.provider.getCurrentHealth();

      expect(health.length).toBeGreaterThan(0);

      for (const status of health) {
        expect(status.providerId).toBeDefined();
        expect(status.status).toBeDefined();
        expect(['ACTIVE', 'DEGRADED', 'MAINTENANCE', 'DISABLED']).toContain(status.status);
      }
    });

    it('should generate health metrics report', async () => {
      const report = await ctx.trpc.provider.getHealthMetrics({
        bucketSize: 'HOUR',
      });

      expect(report.startDate).toBeDefined();
      expect(report.endDate).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.summary.totalRequests).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Connection Migration Flow', () => {
    it('should migrate connection from aggregator to direct provider', async () => {
      // Create aggregator connection
      const connection = await ctx.createBankConnection({
        providerCode: 'AGGREGATOR_SALT_EDGE',
        iban: 'PL10102010001234567890123456',
      });

      // Migrate to PKO direct
      const migration = await ctx.trpc.provider.migrateConnection({
        connectionId: connection.id,
        fromProvider: 'AGGREGATOR_SALT_EDGE',
        toProvider: 'PKO_BP',
        preserveHistory: true,
      });

      expect(migration.success).toBe(true);
      expect(migration.requiresReauthorization).toBe(true);

      // Verify old connection marked as migrated
      const oldConnection = await ctx.db.bankConnections.findUnique({
        where: { id: connection.id },
      });
      expect(oldConnection.status).toBe('MIGRATED');
    });
  });
});
```

---

## Security Checklist

- [ ] Provider credentials encrypted with AES-256-GCM
- [ ] API keys never logged or exposed in responses
- [ ] Rate limiting enforced per provider
- [ ] TLS 1.3 for all provider communications
- [ ] Certificate pinning for direct provider connections
- [ ] Audit trail for all provider configuration changes
- [ ] Row Level Security on all provider tables
- [ ] Health alerts don't expose sensitive provider details
- [ ] Migration process validates authorization
- [ ] API logs sanitized (no sensitive data in paths/bodies)

---

## Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `PROVIDER_CONFIGURED` | New provider setup | Provider code, type, capabilities |
| `PROVIDER_STATUS_UPDATED` | Status change | Previous/new status, reason |
| `PROVIDER_CREDENTIALS_ROTATED` | Credential update | Provider ID, rotation type |
| `CONNECTION_MIGRATED` | Provider migration | From/to providers, preserve history |
| `HEALTH_ALERT_TRIGGERED` | Threshold exceeded | Provider, metric, threshold |
| `PROVIDER_DISABLED` | Manual disable | Provider ID, reason |

---

## Implementation Notes

### Polish Bank API Specifics

1. **PKO Bank Polski**
   - Custom OAuth flow with specific scopes
   - Transaction descriptions in Polish encoding
   - Split payment fields in transactions

2. **mBank**
   - Modern REST API with good documentation
   - Supports webhooks for real-time updates
   - Strong typing in responses

3. **Santander**
   - Berlin Group PSD2 compliant
   - Consent management via TPP portal
   - European standard transaction formats

4. **ING**
   - Developer-friendly portal
   - Good sandbox environment
   - Supports multiple authentication methods

### Aggregator Integration

- Salt Edge primary aggregator for unsupported banks
- Tink as backup aggregator
- Aggregator data normalized to same format as direct APIs
- Some features may be limited via aggregator

### Performance Considerations

- Provider adapters loaded lazily
- Connection pooling per provider
- Response caching where appropriate
- Health metrics collected asynchronously

---

## Dependencies

- **BNK-001**: Bank Connection Management (connection infrastructure)
- **BNK-002**: Account Aggregation (account data structures)
- **Infrastructure**: Redis (caching), PostgreSQL, monitoring systems

---

*Last Updated: December 2024*
