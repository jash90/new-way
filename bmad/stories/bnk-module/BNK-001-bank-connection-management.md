# BNK-001: Bank Connection Management

> **Story ID**: BNK-001
> **Epic**: Banking Integration Layer (BNK)
> **Status**: 📋 Ready for Development
> **Priority**: P0 (Critical)
> **Story Points**: 13
> **Phase**: Week 21

---

## User Story

**As an** accountant,
**I want to** securely connect client bank accounts using PSD2 Open Banking APIs,
**So that** I can access financial data without manual data entry.

---

## Acceptance Criteria

### AC1: PSD2 OAuth 2.0 Authorization Flow
```gherkin
Feature: PSD2 OAuth 2.0 Authorization Flow

  Scenario: Initiate bank connection with supported Polish bank
    Given I am authenticated as an accountant with "banking.connect" permission
    And I have selected a client with organization_id "org-123"
    When I request to connect bank "PKO" for the client
    Then a new bank connection record is created with status "PENDING"
    And I receive an authorization URL for the bank's OAuth flow
    And the authorization URL contains correct redirect_uri
    And the authorization state is securely stored in Redis
    And an audit log entry is created for "BANK_CONNECTION_INITIATED"

  Scenario: Complete OAuth callback with authorization code
    Given I have initiated a bank connection with correlation_id "corr-123"
    And the bank has redirected with authorization code "auth-code-xyz"
    When the OAuth callback is processed
    Then the authorization code is exchanged for access and refresh tokens
    And tokens are encrypted with AES-256-GCM before storage
    And the connection status is updated to "ACTIVE"
    And consent expiry date (90 days) is recorded
    And an event "bank.connected" is emitted
    And the user is redirected to success page

  Scenario: Handle OAuth callback error
    Given I have initiated a bank connection
    When the OAuth callback contains error "access_denied"
    Then the connection status is updated to "DISCONNECTED"
    And an audit log entry is created with error details
    And the user is redirected to error page with appropriate message
```

### AC2: Strong Customer Authentication (SCA)
```gherkin
Feature: Strong Customer Authentication (SCA)

  Scenario: SCA challenge during payment initiation
    Given I have an active bank connection for PKO Bank
    And I initiate a payment requiring SCA
    When the bank requires additional authentication
    Then an SCA challenge URL is returned
    And the challenge type is recorded (SMS, push, biometric)
    And the payment status is "AWAITING_SCA"
    And a notification is sent to the user

  Scenario: SCA completion callback
    Given a payment is awaiting SCA completion
    When the user completes SCA successfully
    Then the payment proceeds to execution
    And the SCA completion is logged in audit trail
```

### AC3: Consent Management (90-day validity)
```gherkin
Feature: Consent Management

  Scenario: Track consent expiration
    Given I have an active bank connection
    And the consent was granted 85 days ago
    When the consent expiration check runs daily at 02:00
    Then a warning notification is sent 5 days before expiry
    And the connection is marked with "consent_expiring_soon" flag

  Scenario: Handle expired consent
    Given I have a bank connection with expired consent
    When I attempt to fetch transactions
    Then the request is rejected with "CONSENT_EXPIRED" error
    And the connection status is updated to "EXPIRED"
    And a notification is sent to renew the consent
    And a re-authorization URL is provided

  Scenario: Consent renewal
    Given I have an expired bank connection
    When I request to renew consent
    Then a new OAuth flow is initiated
    And the existing connection record is updated (not duplicated)
    And historical transaction data is preserved
```

### AC4: Multi-bank Support
```gherkin
Feature: Multi-bank Support

  Scenario: Connect multiple banks for same client
    Given client "org-123" has an active connection to PKO Bank
    When I connect the same client to mBank
    Then a new separate connection is created for mBank
    And both connections are visible in the client's banking panel
    And each connection has its own token storage

  Scenario: Display supported Polish banks
    When I open the bank connection dialog
    Then I see a list of supported banks including:
      | Bank Name | Bank ID | Status |
      | PKO Bank Polski | pko | Available |
      | mBank | mbank | Available |
      | Santander Bank Polska | santander | Available |
      | ING Bank Śląski | ing | Available |
      | Bank Pekao | pekao | Available |
      | BNP Paribas | bnp | Available |
      | Alior Bank | alior | Available |
      | Credit Agricole | credit_agricole | Available |
```

### AC5: Connection Status Monitoring
```gherkin
Feature: Connection Status Monitoring

  Scenario: Monitor connection health
    Given I have active bank connections
    When the health check job runs every 15 minutes
    Then each connection is verified for:
      | Check | Action on Failure |
      | Token validity | Refresh token |
      | API availability | Mark degraded |
      | Consent validity | Send warning |
    And connection health metrics are updated

  Scenario: Display connection status dashboard
    Given I am viewing client "org-123" banking dashboard
    Then I see all bank connections with status indicators:
      | Status | Indicator | Description |
      | ACTIVE | 🟢 Green | Connection healthy |
      | PENDING | 🟡 Yellow | Awaiting authorization |
      | EXPIRED | 🔴 Red | Consent expired |
      | DISCONNECTED | ⚪ Gray | Manually disconnected |
      | ERROR | 🔴 Red | Connection error |
```

### AC6: Token Encryption and Refresh
```gherkin
Feature: Token Security

  Scenario: Secure token storage
    Given I complete OAuth authorization
    When tokens are received from the bank
    Then access_token is encrypted with AES-256-GCM
    And refresh_token is encrypted separately
    And encryption key is stored in secure vault
    And token encryption uses unique IV per token

  Scenario: Automatic token refresh
    Given I have an active connection with expiring access token
    When a transaction fetch is attempted
    And the access token expires in less than 5 minutes
    Then the refresh token is used to obtain new access token
    And the new tokens are encrypted and stored
    And the operation proceeds without user intervention
    And token refresh is logged in audit trail

  Scenario: Handle refresh token expiration
    Given the refresh token has expired
    When any banking operation is attempted
    Then the connection status changes to "EXPIRED"
    And a notification is sent to re-authorize
    And pending operations are queued for retry
```

### AC7: Audit Logging
```gherkin
Feature: Audit Logging

  Scenario: Log all banking connection events
    Given banking operations are performed
    Then audit logs contain:
      | Event | Data Logged |
      | CONNECTION_INITIATED | user_id, bank_id, client_id, timestamp |
      | CONNECTION_COMPLETED | connection_id, consent_id, accounts_count |
      | CONNECTION_FAILED | error_code, error_message, correlation_id |
      | TOKEN_REFRESHED | connection_id, timestamp |
      | CONSENT_EXPIRED | connection_id, expiry_date |
      | CONNECTION_DISCONNECTED | user_id, reason, timestamp |
    And sensitive data (tokens) is never logged
    And logs are retained for 5 years (Polish compliance)
```

---

## Technical Specification

### Database Schema

```sql
-- Bank connections table with PSD2 compliance
CREATE TABLE bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_id VARCHAR(50) NOT NULL,
  bank_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACTIVE', 'EXPIRED', 'DISCONNECTED', 'ERROR')),

  -- OAuth tokens (encrypted)
  encrypted_access_token TEXT,
  encrypted_refresh_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,

  -- PSD2 consent
  consent_id VARCHAR(255),
  consent_granted_at TIMESTAMPTZ,
  consent_expires_at TIMESTAMPTZ,
  consent_scope TEXT[], -- e.g., ['accounts', 'transactions', 'payments']

  -- OAuth state
  correlation_id UUID,
  auth_state VARCHAR(255),
  redirect_url TEXT,

  -- Connection metadata
  last_synced_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,
  error_count INTEGER DEFAULT 0,

  -- Health monitoring
  health_status VARCHAR(20) DEFAULT 'UNKNOWN',
  health_checked_at TIMESTAMPTZ,

  -- Audit
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Constraints
  CONSTRAINT unique_active_connection UNIQUE (organization_id, bank_id)
    WHERE status = 'ACTIVE'
);

-- Bank connection audit trail
CREATE TABLE bank_connection_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES bank_connections(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  correlation_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_bank_connections_org ON bank_connections(organization_id);
CREATE INDEX idx_bank_connections_status ON bank_connections(status);
CREATE INDEX idx_bank_connections_consent_expiry ON bank_connections(consent_expires_at)
  WHERE status = 'ACTIVE';
CREATE INDEX idx_bank_connection_audit_connection ON bank_connection_audit(connection_id);
CREATE INDEX idx_bank_connection_audit_org ON bank_connection_audit(organization_id);
CREATE INDEX idx_bank_connection_audit_created ON bank_connection_audit(created_at);

-- Row Level Security
ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_connection_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_connections_org_isolation ON bank_connections
  FOR ALL USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY bank_connection_audit_org_isolation ON bank_connection_audit
  FOR ALL USING (organization_id = current_setting('app.organization_id')::UUID);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Supported Polish banks
export const BankIdSchema = z.enum([
  'pko',
  'mbank',
  'santander',
  'ing',
  'pekao',
  'bnp',
  'alior',
  'credit_agricole'
]);

export const ConnectionStatusSchema = z.enum([
  'PENDING',
  'ACTIVE',
  'EXPIRED',
  'DISCONNECTED',
  'ERROR'
]);

export const ConsentScopeSchema = z.enum([
  'accounts',
  'transactions',
  'payments',
  'balance'
]);

// Request schemas
export const ConnectBankRequestSchema = z.object({
  organizationId: z.string().uuid(),
  bankId: BankIdSchema,
  redirectUrl: z.string().url(),
  scopes: z.array(ConsentScopeSchema).default(['accounts', 'transactions', 'balance']),
  metadata: z.record(z.any()).optional()
});

export const OAuthCallbackSchema = z.object({
  code: z.string().optional(),
  state: z.string(),
  error: z.string().optional(),
  error_description: z.string().optional()
});

export const RefreshConnectionRequestSchema = z.object({
  connectionId: z.string().uuid()
});

export const DisconnectBankRequestSchema = z.object({
  connectionId: z.string().uuid(),
  reason: z.string().optional()
});

// Response schemas
export const BankConnectionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  bankId: BankIdSchema,
  bankName: z.string(),
  status: ConnectionStatusSchema,
  consentExpiresAt: z.string().datetime().nullable(),
  consentScope: z.array(ConsentScopeSchema),
  lastSyncedAt: z.string().datetime().nullable(),
  healthStatus: z.enum(['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN']),
  accountsCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const AuthorizationUrlResponseSchema = z.object({
  connectionId: z.string().uuid(),
  authorizationUrl: z.string().url(),
  state: z.string(),
  expiresIn: z.number().int() // seconds
});

export const SupportedBankSchema = z.object({
  id: BankIdSchema,
  name: z.string(),
  logo: z.string().url().optional(),
  apiVersion: z.string(),
  features: z.array(z.string()),
  status: z.enum(['available', 'maintenance', 'unavailable'])
});

// Type exports
export type BankId = z.infer<typeof BankIdSchema>;
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;
export type ConnectBankRequest = z.infer<typeof ConnectBankRequestSchema>;
export type OAuthCallback = z.infer<typeof OAuthCallbackSchema>;
export type BankConnection = z.infer<typeof BankConnectionSchema>;
export type SupportedBank = z.infer<typeof SupportedBankSchema>;
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import {
  ConnectBankRequestSchema,
  OAuthCallbackSchema,
  RefreshConnectionRequestSchema,
  DisconnectBankRequestSchema,
  BankConnectionSchema,
  AuthorizationUrlResponseSchema
} from './schemas';

export const bankConnectionRouter = router({
  // Initiate bank connection
  connect: protectedProcedure
    .input(ConnectBankRequestSchema)
    .output(AuthorizationUrlResponseSchema)
    .mutation(async ({ ctx, input }) => {
      // Check permission
      if (!ctx.user.permissions.includes('banking.connect')) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Brak uprawnień do połączenia z bankiem'
        });
      }

      // Check rate limit
      await ctx.rateLimiter.checkLimit(
        `bank_connect:${ctx.user.id}`,
        5, // max 5 connections per hour
        3600
      );

      // Get bank provider
      const provider = ctx.bankProviderFactory.getProvider(input.bankId);
      if (!provider) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Bank ${input.bankId} nie jest obsługiwany`
        });
      }

      // Check for existing active connection
      const existing = await ctx.db.bankConnection.findFirst({
        where: {
          organizationId: input.organizationId,
          bankId: input.bankId,
          status: 'ACTIVE'
        }
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Aktywne połączenie z tym bankiem już istnieje'
        });
      }

      // Create pending connection
      const correlationId = crypto.randomUUID();
      const state = crypto.randomUUID();

      const connection = await ctx.db.bankConnection.create({
        data: {
          organizationId: input.organizationId,
          bankId: input.bankId,
          bankName: provider.getBankName(),
          status: 'PENDING',
          correlationId,
          authState: state,
          redirectUrl: input.redirectUrl,
          consentScope: input.scopes,
          metadata: input.metadata || {},
          createdBy: ctx.user.id
        }
      });

      // Store state in Redis for callback verification
      await ctx.redis.set(
        `bank_auth_state:${state}`,
        JSON.stringify({
          connectionId: connection.id,
          organizationId: input.organizationId,
          bankId: input.bankId
        }),
        'EX',
        600 // 10 minute expiry
      );

      // Generate authorization URL
      const authorizationUrl = await provider.getAuthorizationUrl({
        redirectUri: `${process.env.APP_URL}/api/banking/callback`,
        state,
        scope: input.scopes
      });

      // Audit log
      await ctx.audit.log({
        action: 'BANK_CONNECTION_INITIATED',
        resourceType: 'BANK_CONNECTION',
        resourceId: connection.id,
        organizationId: input.organizationId,
        metadata: {
          bankId: input.bankId,
          correlationId
        }
      });

      // Emit event
      await ctx.events.emit('bank.connection.initiated', {
        connectionId: connection.id,
        organizationId: input.organizationId,
        bankId: input.bankId,
        correlationId
      });

      return {
        connectionId: connection.id,
        authorizationUrl,
        state,
        expiresIn: 600
      };
    }),

  // Process OAuth callback
  callback: protectedProcedure
    .input(OAuthCallbackSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify state
      const stateData = await ctx.redis.get(`bank_auth_state:${input.state}`);
      if (!stateData) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nieprawidłowy lub wygasły stan autoryzacji'
        });
      }

      const { connectionId, organizationId, bankId } = JSON.parse(stateData);

      // Delete state from Redis
      await ctx.redis.del(`bank_auth_state:${input.state}`);

      // Handle error response
      if (input.error) {
        await ctx.db.bankConnection.update({
          where: { id: connectionId },
          data: {
            status: 'DISCONNECTED',
            lastErrorAt: new Date(),
            lastErrorMessage: input.error_description || input.error
          }
        });

        await ctx.audit.log({
          action: 'BANK_CONNECTION_FAILED',
          resourceType: 'BANK_CONNECTION',
          resourceId: connectionId,
          organizationId,
          metadata: { error: input.error, description: input.error_description }
        });

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Autoryzacja odrzucona: ${input.error_description || input.error}`
        });
      }

      // Exchange code for tokens
      const provider = ctx.bankProviderFactory.getProvider(bankId);
      const tokens = await provider.exchangeCode(input.code!, {
        redirectUri: `${process.env.APP_URL}/api/banking/callback`
      });

      // Encrypt tokens
      const encryptedAccessToken = await ctx.encryption.encrypt(tokens.accessToken);
      const encryptedRefreshToken = tokens.refreshToken
        ? await ctx.encryption.encrypt(tokens.refreshToken)
        : null;

      // Calculate expiry dates
      const now = new Date();
      const accessTokenExpiresAt = new Date(now.getTime() + tokens.expiresIn * 1000);
      const consentExpiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days

      // Update connection
      const updatedConnection = await ctx.db.bankConnection.update({
        where: { id: connectionId },
        data: {
          status: 'ACTIVE',
          encryptedAccessToken,
          encryptedRefreshToken,
          accessTokenExpiresAt,
          consentId: tokens.consentId,
          consentGrantedAt: now,
          consentExpiresAt,
          healthStatus: 'HEALTHY',
          healthCheckedAt: now
        }
      });

      // Audit log
      await ctx.audit.log({
        action: 'BANK_CONNECTION_COMPLETED',
        resourceType: 'BANK_CONNECTION',
        resourceId: connectionId,
        organizationId,
        metadata: {
          consentId: tokens.consentId,
          consentExpiresAt: consentExpiresAt.toISOString()
        }
      });

      // Emit event
      await ctx.events.emit('bank.connected', {
        connectionId,
        organizationId,
        bankId,
        consentExpiresAt
      });

      // Trigger initial account sync
      await ctx.queue.add('bank.sync.accounts', {
        connectionId,
        organizationId
      });

      return { success: true, connectionId };
    }),

  // Get connections for organization
  getConnections: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .output(z.array(BankConnectionSchema))
    .query(async ({ ctx, input }) => {
      const connections = await ctx.db.bankConnection.findMany({
        where: { organizationId: input.organizationId },
        include: {
          _count: { select: { accounts: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      return connections.map(conn => ({
        id: conn.id,
        organizationId: conn.organizationId,
        bankId: conn.bankId,
        bankName: conn.bankName,
        status: conn.status,
        consentExpiresAt: conn.consentExpiresAt?.toISOString() || null,
        consentScope: conn.consentScope,
        lastSyncedAt: conn.lastSyncedAt?.toISOString() || null,
        healthStatus: conn.healthStatus,
        accountsCount: conn._count.accounts,
        createdAt: conn.createdAt.toISOString(),
        updatedAt: conn.updatedAt.toISOString()
      }));
    }),

  // Refresh connection
  refresh: protectedProcedure
    .input(RefreshConnectionRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db.bankConnection.findUnique({
        where: { id: input.connectionId }
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Połączenie nie zostało znalezione'
        });
      }

      if (connection.status === 'EXPIRED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Zgoda wygasła. Wymagana ponowna autoryzacja.'
        });
      }

      // Decrypt refresh token
      if (!connection.encryptedRefreshToken) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Brak tokenu odświeżania'
        });
      }

      const refreshToken = await ctx.encryption.decrypt(connection.encryptedRefreshToken);

      // Refresh tokens
      const provider = ctx.bankProviderFactory.getProvider(connection.bankId);
      const tokens = await provider.refreshToken(refreshToken);

      // Update tokens
      const encryptedAccessToken = await ctx.encryption.encrypt(tokens.accessToken);
      const encryptedRefreshToken = tokens.refreshToken
        ? await ctx.encryption.encrypt(tokens.refreshToken)
        : connection.encryptedRefreshToken;

      const accessTokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

      await ctx.db.bankConnection.update({
        where: { id: input.connectionId },
        data: {
          encryptedAccessToken,
          encryptedRefreshToken,
          accessTokenExpiresAt,
          healthStatus: 'HEALTHY',
          healthCheckedAt: new Date(),
          errorCount: 0,
          lastErrorAt: null,
          lastErrorMessage: null
        }
      });

      // Audit log
      await ctx.audit.log({
        action: 'TOKEN_REFRESHED',
        resourceType: 'BANK_CONNECTION',
        resourceId: input.connectionId,
        organizationId: connection.organizationId
      });

      return { success: true };
    }),

  // Disconnect bank
  disconnect: protectedProcedure
    .input(DisconnectBankRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db.bankConnection.findUnique({
        where: { id: input.connectionId }
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Połączenie nie zostało znalezione'
        });
      }

      // Revoke consent at bank (if supported)
      try {
        const provider = ctx.bankProviderFactory.getProvider(connection.bankId);
        if (connection.encryptedAccessToken) {
          const accessToken = await ctx.encryption.decrypt(connection.encryptedAccessToken);
          await provider.revokeConsent(accessToken, connection.consentId);
        }
      } catch (error) {
        // Log but don't fail - bank may not support revocation
        console.warn('Failed to revoke consent at bank:', error);
      }

      // Update connection status
      await ctx.db.bankConnection.update({
        where: { id: input.connectionId },
        data: {
          status: 'DISCONNECTED',
          encryptedAccessToken: null,
          encryptedRefreshToken: null,
          metadata: {
            ...connection.metadata,
            disconnectedAt: new Date().toISOString(),
            disconnectReason: input.reason
          }
        }
      });

      // Audit log
      await ctx.audit.log({
        action: 'BANK_CONNECTION_DISCONNECTED',
        resourceType: 'BANK_CONNECTION',
        resourceId: input.connectionId,
        organizationId: connection.organizationId,
        metadata: { reason: input.reason }
      });

      // Emit event
      await ctx.events.emit('bank.disconnected', {
        connectionId: input.connectionId,
        organizationId: connection.organizationId,
        bankId: connection.bankId
      });

      return { success: true };
    }),

  // Get supported banks
  getSupportedBanks: protectedProcedure
    .output(z.array(SupportedBankSchema))
    .query(async ({ ctx }) => {
      return ctx.bankProviderFactory.getSupportedBanks();
    })
});
```

### Service Implementation

```typescript
// Bank provider factory
import { Injectable } from '@nestjs/common';
import { PKOBankProvider } from './providers/pko.provider';
import { MBankProvider } from './providers/mbank.provider';
import { SantanderProvider } from './providers/santander.provider';
import { INGProvider } from './providers/ing.provider';

export interface IBankProvider {
  getBankName(): string;
  getAuthorizationUrl(params: AuthParams): Promise<string>;
  exchangeCode(code: string, params: ExchangeParams): Promise<TokenResponse>;
  refreshToken(refreshToken: string): Promise<TokenResponse>;
  revokeConsent(accessToken: string, consentId: string): Promise<void>;
  fetchAccounts(accessToken: string): Promise<BankAccount[]>;
  fetchTransactions(params: TransactionParams): Promise<BankTransaction[]>;
  initiatePayment(params: PaymentParams): Promise<PaymentResponse>;
}

@Injectable()
export class BankProviderFactory {
  private providers: Map<string, IBankProvider> = new Map();

  constructor(
    private readonly config: BankingConfig,
    private readonly httpService: HttpService,
    private readonly logger: Logger
  ) {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    if (this.config.providers.pko) {
      this.providers.set('pko', new PKOBankProvider(this.config.providers.pko, this.httpService));
    }
    if (this.config.providers.mbank) {
      this.providers.set('mbank', new MBankProvider(this.config.providers.mbank, this.httpService));
    }
    if (this.config.providers.santander) {
      this.providers.set('santander', new SantanderProvider(this.config.providers.santander, this.httpService));
    }
    if (this.config.providers.ing) {
      this.providers.set('ing', new INGProvider(this.config.providers.ing, this.httpService));
    }
    // Add more providers...
  }

  getProvider(bankId: string): IBankProvider | undefined {
    return this.providers.get(bankId);
  }

  getSupportedBanks(): SupportedBank[] {
    return [
      {
        id: 'pko',
        name: 'PKO Bank Polski',
        logo: '/banks/pko.svg',
        apiVersion: '2.0',
        features: ['accounts', 'transactions', 'payments'],
        status: this.providers.has('pko') ? 'available' : 'unavailable'
      },
      {
        id: 'mbank',
        name: 'mBank',
        logo: '/banks/mbank.svg',
        apiVersion: '2.1',
        features: ['accounts', 'transactions', 'payments', 'instant'],
        status: this.providers.has('mbank') ? 'available' : 'unavailable'
      },
      // ... more banks
    ];
  }
}
```

---

## Test Specifications

### Unit Tests

```typescript
describe('BankConnectionService', () => {
  describe('connect', () => {
    it('should create pending connection and return auth URL', async () => {
      const input = {
        organizationId: 'org-123',
        bankId: 'pko',
        redirectUrl: 'https://app.example.com/callback',
        scopes: ['accounts', 'transactions']
      };

      const result = await service.connect(input, mockUser);

      expect(result.connectionId).toBeDefined();
      expect(result.authorizationUrl).toContain('pko.pl');
      expect(result.expiresIn).toBe(600);
      expect(mockDb.bankConnection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            bankId: 'pko'
          })
        })
      );
    });

    it('should reject duplicate active connection', async () => {
      mockDb.bankConnection.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.connect(input, mockUser)).rejects.toThrow(
        'Aktywne połączenie z tym bankiem już istnieje'
      );
    });

    it('should reject unsupported bank', async () => {
      const input = { ...validInput, bankId: 'unsupported_bank' };

      await expect(service.connect(input, mockUser)).rejects.toThrow(
        'nie jest obsługiwany'
      );
    });
  });

  describe('callback', () => {
    it('should complete connection on successful OAuth', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        connectionId: 'conn-123',
        organizationId: 'org-123',
        bankId: 'pko'
      }));
      mockProvider.exchangeCode.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        consentId: 'consent-123'
      });

      const result = await service.callback({
        code: 'auth-code',
        state: 'valid-state'
      });

      expect(result.success).toBe(true);
      expect(mockDb.bankConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACTIVE'
          })
        })
      );
    });

    it('should handle OAuth error', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        connectionId: 'conn-123',
        organizationId: 'org-123',
        bankId: 'pko'
      }));

      await expect(service.callback({
        error: 'access_denied',
        error_description: 'User rejected',
        state: 'valid-state'
      })).rejects.toThrow('access_denied');
    });

    it('should reject invalid state', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.callback({
        code: 'auth-code',
        state: 'invalid-state'
      })).rejects.toThrow('Nieprawidłowy lub wygasły stan autoryzacji');
    });
  });

  describe('refresh', () => {
    it('should refresh tokens successfully', async () => {
      mockDb.bankConnection.findUnique.mockResolvedValue({
        id: 'conn-123',
        bankId: 'pko',
        status: 'ACTIVE',
        encryptedRefreshToken: 'encrypted-refresh'
      });
      mockEncryption.decrypt.mockResolvedValue('refresh-token');
      mockProvider.refreshToken.mockResolvedValue({
        accessToken: 'new-access',
        expiresIn: 3600
      });

      const result = await service.refresh({ connectionId: 'conn-123' });

      expect(result.success).toBe(true);
      expect(mockEncryption.encrypt).toHaveBeenCalled();
    });

    it('should reject expired connection', async () => {
      mockDb.bankConnection.findUnique.mockResolvedValue({
        id: 'conn-123',
        status: 'EXPIRED'
      });

      await expect(service.refresh({ connectionId: 'conn-123' })).rejects.toThrow(
        'Zgoda wygasła'
      );
    });
  });
});
```

### Integration Tests

```typescript
describe('Bank Connection Integration', () => {
  it('should complete full OAuth flow', async () => {
    // 1. Initiate connection
    const initResponse = await request(app)
      .post('/api/trpc/bnk.connect')
      .send({
        organizationId: testOrg.id,
        bankId: 'pko',
        redirectUrl: 'http://localhost:3000/callback'
      })
      .expect(200);

    const { connectionId, authorizationUrl, state } = initResponse.body;
    expect(connectionId).toBeDefined();
    expect(authorizationUrl).toContain('pko.pl');

    // 2. Simulate OAuth callback (mocked bank response)
    const callbackResponse = await request(app)
      .get(`/api/banking/callback?code=test-code&state=${state}`)
      .expect(302);

    // 3. Verify connection is active
    const connection = await db.bankConnection.findUnique({
      where: { id: connectionId }
    });
    expect(connection.status).toBe('ACTIVE');
    expect(connection.consentExpiresAt).toBeDefined();
  });

  it('should handle consent expiration', async () => {
    // Create connection with expired consent
    const connection = await db.bankConnection.create({
      data: {
        organizationId: testOrg.id,
        bankId: 'pko',
        bankName: 'PKO Bank Polski',
        status: 'ACTIVE',
        consentExpiresAt: new Date(Date.now() - 86400000) // yesterday
      }
    });

    // Run consent check job
    await consentExpirationJob.run();

    // Verify status changed
    const updated = await db.bankConnection.findUnique({
      where: { id: connection.id }
    });
    expect(updated.status).toBe('EXPIRED');
  });
});
```

### E2E Tests

```typescript
describe('Bank Connection E2E', () => {
  it('should connect bank and display in dashboard', async () => {
    await page.goto('/dashboard/banking');

    // Click connect bank
    await page.click('[data-testid="connect-bank-btn"]');

    // Select bank
    await page.click('[data-testid="bank-pko"]');

    // Should redirect to bank authorization
    await page.waitForURL(/pko\.pl/);

    // Simulate bank authorization (test mode)
    await page.fill('#login', 'test_user');
    await page.fill('#password', 'test_pass');
    await page.click('#authorize');

    // Should redirect back
    await page.waitForURL(/\/dashboard\/banking/);

    // Verify connection shown
    await expect(page.locator('[data-testid="connection-pko"]')).toBeVisible();
    await expect(page.locator('[data-testid="connection-status-active"]')).toBeVisible();
  });
});
```

---

## Security Checklist

- [x] **Authentication**: OAuth 2.0 with PKCE required for all bank connections
- [x] **Authorization**: Permission `banking.connect` required
- [x] **Token Security**: AES-256-GCM encryption for all tokens
- [x] **State Validation**: Cryptographic state parameter prevents CSRF
- [x] **Rate Limiting**: Max 5 connection attempts per hour
- [x] **Audit Trail**: All connection events logged immutably
- [x] **Data Masking**: Tokens never logged, IBANs masked in logs
- [x] **PSD2 Compliance**: SCA support, 90-day consent tracking
- [x] **TLS 1.3**: All bank API communications encrypted

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `BANK_CONNECTION_INITIATED` | OAuth flow started | org_id, bank_id, correlation_id |
| `BANK_CONNECTION_COMPLETED` | OAuth successful | connection_id, consent_id, scope |
| `BANK_CONNECTION_FAILED` | OAuth error | error_code, error_description |
| `TOKEN_REFRESHED` | Token refresh | connection_id, timestamp |
| `CONSENT_EXPIRING` | 5 days before expiry | connection_id, expiry_date |
| `CONSENT_EXPIRED` | Consent expired | connection_id |
| `BANK_CONNECTION_DISCONNECTED` | Manual disconnect | reason, user_id |

---

## Dependencies

- **AIM**: Authentication & authorization
- **Infrastructure**: Redis (state storage), PostgreSQL, encryption service

---

## Implementation Notes

### Polish Bank API Specifics

1. **PKO Bank Polski**: Uses custom OAuth extension, requires certificate-based auth
2. **mBank**: Standard PSD2, good API documentation, supports instant payments
3. **Santander**: PSD2 compliant, European standards
4. **ING**: Good Open Banking support, modern API

### Consent Renewal Strategy

- Alert user 7 days before expiry
- Alert again 3 days before
- Final alert 1 day before
- After expiry, require full re-authorization

### Error Handling

- Network errors: Retry with exponential backoff
- Rate limit errors: Queue and retry later
- Auth errors: Invalidate connection, notify user
- Unknown errors: Log, alert, graceful degradation

---

*Last updated: December 2024*
