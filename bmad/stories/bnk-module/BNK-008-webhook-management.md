# BNK-008: Webhook Management

> **Story ID**: BNK-008
> **Epic**: [Banking Integration Layer (BNK)](./epic.md)
> **Priority**: P1 (Important)
> **Story Points**: 5
> **Status**: 📋 Ready for Development

---

## User Story

**As a** system,
**I need to** receive real-time notifications from banks,
**So that** data stays synchronized without constant polling.

---

## Acceptance Criteria

### AC1: Webhook Registration
```gherkin
Given I have an active bank connection
When the system registers for webhooks
Then it should:
  - Generate unique callback URL per connection
  - Register with the bank's webhook API
  - Store webhook subscription details
  - Configure event types to receive
And the webhook should be registered within 30 seconds
```

### AC2: Signature Validation
```gherkin
Given a webhook request is received
When the system validates the signature
Then it should:
  - Extract signature from request headers
  - Verify HMAC-SHA256 signature using shared secret
  - Reject requests with invalid signatures
  - Log all validation attempts
And invalid requests should return 401 Unauthorized
```

### AC3: Event Processing
```gherkin
Given a valid webhook event is received
When the system processes the event
Then it should:
  - Parse the event payload
  - Identify the event type (transaction, balance, consent)
  - Route to appropriate handler
  - Update local data accordingly
And processing should complete within 5 seconds
And respond with 200 OK to acknowledge receipt
```

### AC4: Retry Handling
```gherkin
Given webhook processing fails
When the bank retries the webhook
Then the system should:
  - Accept idempotent retries (same event ID)
  - Not duplicate data processing
  - Track retry attempts
  - Alert after 3 consecutive failures
And maintain event idempotency for 24 hours
```

### AC5: Event Logging
```gherkin
Given any webhook event is received
When the event is processed
Then the system should log:
  - Event ID and type
  - Source bank and connection
  - Processing result (success/failure)
  - Processing duration
  - Any errors or warnings
And logs should be retained for 90 days
```

### AC6: Subscription Management
```gherkin
Given I manage webhook subscriptions
When I view or modify subscriptions
Then I should be able to:
  - List all active subscriptions
  - View subscription status and health
  - Pause or resume subscriptions
  - Update subscribed event types
  - Delete subscriptions
And subscription changes should take effect within 60 seconds
```

### AC7: Fallback Polling
```gherkin
Given webhooks are unavailable
When the system detects webhook failures
Then it should:
  - Automatically switch to polling mode
  - Poll at configured intervals (default: 15 minutes)
  - Continue attempting webhook reconnection
  - Resume webhooks when available
And data should remain synchronized during fallback
```

---

## Technical Specification

### Database Schema

```sql
-- Webhook subscriptions table
CREATE TABLE webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    provider VARCHAR(50) NOT NULL,
    external_subscription_id VARCHAR(255),
    callback_url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    secret VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ACTIVE', 'PAUSED', 'FAILED', 'EXPIRED')),
    last_event_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    failure_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    CONSTRAINT unique_connection_subscription UNIQUE (connection_id, provider)
);

-- Webhook events table
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    external_event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    signature VARCHAR(255),
    signature_valid BOOLEAN,
    status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED'
        CHECK (status IN ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'DUPLICATE')),
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    processing_duration_ms INTEGER,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_external_event UNIQUE (subscription_id, external_event_id)
);

-- Webhook event handlers table
CREATE TABLE webhook_event_handlers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    handler_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    priority INTEGER NOT NULL DEFAULT 100,
    configuration JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_event_handler UNIQUE (event_type, handler_name)
);

-- Fallback polling configuration
CREATE TABLE polling_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    reason VARCHAR(50),
    interval_seconds INTEGER NOT NULL DEFAULT 900, -- 15 minutes
    last_poll_at TIMESTAMPTZ,
    next_poll_at TIMESTAMPTZ,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_connection_polling UNIQUE (connection_id)
);

-- Indexes
CREATE INDEX idx_webhook_subscriptions_connection ON webhook_subscriptions(connection_id);
CREATE INDEX idx_webhook_subscriptions_status ON webhook_subscriptions(status);
CREATE INDEX idx_webhook_subscriptions_provider ON webhook_subscriptions(provider);
CREATE INDEX idx_webhook_events_subscription ON webhook_events(subscription_id);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at DESC);
CREATE INDEX idx_webhook_events_external ON webhook_events(external_event_id);
CREATE INDEX idx_polling_next ON polling_configurations(next_poll_at) WHERE is_active = TRUE;

-- RLS Policies
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE polling_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_subscriptions_org_isolation ON webhook_subscriptions
    USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY webhook_events_org_isolation ON webhook_events
    USING (subscription_id IN (
        SELECT id FROM webhook_subscriptions
        WHERE organization_id = current_setting('app.organization_id')::UUID
    ));

CREATE POLICY polling_org_isolation ON polling_configurations
    USING (connection_id IN (
        SELECT id FROM bank_connections
        WHERE organization_id = current_setting('app.organization_id')::UUID
    ));

-- Cleanup old events (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS void AS $$
BEGIN
    DELETE FROM webhook_events
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';
import crypto from 'crypto';

// Webhook event types
export const WebhookEventTypeSchema = z.enum([
  'TRANSACTION_CREATED',
  'TRANSACTION_UPDATED',
  'BALANCE_UPDATED',
  'ACCOUNT_STATUS_CHANGED',
  'CONSENT_EXPIRING',
  'CONSENT_REVOKED',
  'PAYMENT_STATUS_CHANGED',
  'CONNECTION_STATUS_CHANGED'
]);
export type WebhookEventType = z.infer<typeof WebhookEventTypeSchema>;

// Subscription status
export const SubscriptionStatusSchema = z.enum([
  'PENDING', 'ACTIVE', 'PAUSED', 'FAILED', 'EXPIRED'
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

// Create subscription request
export const CreateSubscriptionSchema = z.object({
  connectionId: z.string().uuid(),
  events: z.array(WebhookEventTypeSchema).min(1, 'Wybierz co najmniej jeden typ zdarzenia'),
  callbackUrlOverride: z.string().url().optional()
});
export type CreateSubscriptionRequest = z.infer<typeof CreateSubscriptionSchema>;

// Update subscription request
export const UpdateSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  events: z.array(WebhookEventTypeSchema).optional(),
  status: z.enum(['ACTIVE', 'PAUSED']).optional()
});
export type UpdateSubscriptionRequest = z.infer<typeof UpdateSubscriptionSchema>;

// Incoming webhook payload (generic structure)
export const IncomingWebhookSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  timestamp: z.string().datetime(),
  data: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional()
});
export type IncomingWebhook = z.infer<typeof IncomingWebhookSchema>;

// Webhook signature validation
export const WebhookSignatureSchema = z.object({
  signature: z.string().min(1),
  timestamp: z.string(),
  payload: z.string()
});

// Provider-specific webhook schemas
export const PKOWebhookSchema = z.object({
  id: z.string(),
  type: z.enum(['transaction.created', 'balance.updated', 'consent.expiring']),
  created: z.string().datetime(),
  data: z.object({
    accountId: z.string(),
    transactionId: z.string().optional(),
    amount: z.string().optional(),
    balance: z.string().optional()
  })
});

export const MBankWebhookSchema = z.object({
  eventId: z.string(),
  eventType: z.string(),
  occurredAt: z.string().datetime(),
  payload: z.object({
    accountNumber: z.string(),
    details: z.record(z.unknown())
  })
});

// Subscription list filters
export const SubscriptionFiltersSchema = z.object({
  connectionId: z.string().uuid().optional(),
  status: SubscriptionStatusSchema.optional(),
  provider: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0)
});
export type SubscriptionFilters = z.infer<typeof SubscriptionFiltersSchema>;

// Event list filters
export const EventFiltersSchema = z.object({
  subscriptionId: z.string().uuid().optional(),
  eventType: WebhookEventTypeSchema.optional(),
  status: z.enum(['RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'DUPLICATE']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0)
});
export type EventFilters = z.infer<typeof EventFiltersSchema>;

// Webhook health status
export const WebhookHealthSchema = z.object({
  subscriptionId: z.string().uuid(),
  status: SubscriptionStatusSchema,
  lastEventAt: z.string().datetime().nullable(),
  lastSuccessAt: z.string().datetime().nullable(),
  lastFailureAt: z.string().datetime().nullable(),
  failureCount: z.number().int(),
  successRate: z.number().min(0).max(1),
  avgProcessingTimeMs: z.number().int(),
  isHealthy: z.boolean()
});
export type WebhookHealth = z.infer<typeof WebhookHealthSchema>;
```

### tRPC Router

```typescript
import { router, protectedProcedure, publicProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  CreateSubscriptionSchema,
  UpdateSubscriptionSchema,
  SubscriptionFiltersSchema,
  EventFiltersSchema,
  IncomingWebhookSchema
} from './schemas';

export const webhookRouter = router({
  // Create subscription
  createSubscription: protectedProcedure
    .input(CreateSubscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      const subscription = await ctx.webhookService.createSubscription({
        ...input,
        organizationId: ctx.session.organizationId
      });

      await ctx.auditLog.record({
        action: 'BNK.WEBHOOK.SUBSCRIPTION_CREATED',
        resourceId: subscription.id,
        metadata: {
          connectionId: input.connectionId,
          events: input.events
        }
      });

      return subscription;
    }),

  // List subscriptions
  listSubscriptions: protectedProcedure
    .input(SubscriptionFiltersSchema)
    .query(async ({ ctx, input }) => {
      return ctx.webhookService.listSubscriptions(
        ctx.session.organizationId,
        input
      );
    }),

  // Get subscription details
  getSubscription: protectedProcedure
    .input(z.object({ subscriptionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.webhookService.getSubscription(
        input.subscriptionId,
        ctx.session.organizationId
      );
    }),

  // Update subscription
  updateSubscription: protectedProcedure
    .input(UpdateSubscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      const subscription = await ctx.webhookService.updateSubscription({
        ...input,
        organizationId: ctx.session.organizationId
      });

      await ctx.auditLog.record({
        action: 'BNK.WEBHOOK.SUBSCRIPTION_UPDATED',
        resourceId: input.subscriptionId,
        metadata: { updates: Object.keys(input).filter(k => k !== 'subscriptionId') }
      });

      return subscription;
    }),

  // Delete subscription
  deleteSubscription: protectedProcedure
    .input(z.object({ subscriptionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.webhookService.deleteSubscription(
        input.subscriptionId,
        ctx.session.organizationId
      );

      await ctx.auditLog.record({
        action: 'BNK.WEBHOOK.SUBSCRIPTION_DELETED',
        resourceId: input.subscriptionId
      });

      return { success: true };
    }),

  // Get subscription health
  getHealth: protectedProcedure
    .input(z.object({ subscriptionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.webhookService.getSubscriptionHealth(
        input.subscriptionId,
        ctx.session.organizationId
      );
    }),

  // List events
  listEvents: protectedProcedure
    .input(EventFiltersSchema)
    .query(async ({ ctx, input }) => {
      return ctx.webhookService.listEvents(
        ctx.session.organizationId,
        input
      );
    }),

  // Get event details
  getEvent: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.webhookService.getEvent(
        input.eventId,
        ctx.session.organizationId
      );
    }),

  // Retry failed event
  retryEvent: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.webhookService.retryEvent(
        input.eventId,
        ctx.session.organizationId
      );

      await ctx.auditLog.record({
        action: 'BNK.WEBHOOK.EVENT_RETRIED',
        resourceId: input.eventId
      });

      return result;
    }),

  // === Webhook Receiver Endpoints (Public) ===

  // PKO Bank webhook receiver
  receivePKO: publicProcedure
    .input(z.object({
      headers: z.record(z.string()),
      body: z.unknown()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.webhookService.handleIncomingWebhook(
        'PKO',
        input.headers,
        input.body
      );
    }),

  // mBank webhook receiver
  receiveMBank: publicProcedure
    .input(z.object({
      headers: z.record(z.string()),
      body: z.unknown()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.webhookService.handleIncomingWebhook(
        'MBANK',
        input.headers,
        input.body
      );
    }),

  // Generic webhook receiver
  receive: publicProcedure
    .input(z.object({
      provider: z.string(),
      headers: z.record(z.string()),
      body: z.unknown()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.webhookService.handleIncomingWebhook(
        input.provider.toUpperCase(),
        input.headers,
        input.body
      );
    }),

  // === Polling Management ===

  // Get polling status
  getPollingStatus: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.webhookService.getPollingStatus(
        input.connectionId,
        ctx.session.organizationId
      );
    }),

  // Force enable polling
  enablePolling: protectedProcedure
    .input(z.object({
      connectionId: z.string().uuid(),
      intervalSeconds: z.number().int().min(60).max(3600).default(900)
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.webhookService.enablePolling({
        ...input,
        organizationId: ctx.session.organizationId,
        reason: 'MANUAL'
      });

      await ctx.auditLog.record({
        action: 'BNK.WEBHOOK.POLLING_ENABLED',
        resourceId: input.connectionId,
        metadata: { intervalSeconds: input.intervalSeconds }
      });

      return result;
    }),

  // Disable polling
  disablePolling: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.webhookService.disablePolling(
        input.connectionId,
        ctx.session.organizationId
      );

      await ctx.auditLog.record({
        action: 'BNK.WEBHOOK.POLLING_DISABLED',
        resourceId: input.connectionId
      });

      return { success: true };
    })
});
```

### Service Implementation

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import crypto from 'crypto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly baseCallbackUrl: string;
  private readonly providers: Map<string, WebhookProviderHandler>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly bankingService: BankingService
  ) {
    this.baseCallbackUrl = this.config.get('WEBHOOK_BASE_URL');
    this.providers = this.initializeProviders();
  }

  private initializeProviders(): Map<string, WebhookProviderHandler> {
    return new Map([
      ['PKO', new PKOWebhookHandler()],
      ['MBANK', new MBankWebhookHandler()],
      ['ING', new INGWebhookHandler()],
      ['SANTANDER', new SantanderWebhookHandler()]
    ]);
  }

  async createSubscription(params: {
    connectionId: string;
    organizationId: string;
    events: string[];
    callbackUrlOverride?: string;
  }) {
    // Verify connection
    const connection = await this.prisma.bankConnection.findFirst({
      where: {
        id: params.connectionId,
        organizationId: params.organizationId,
        status: 'ACTIVE'
      }
    });

    if (!connection) {
      throw new Error('Połączenie bankowe nie zostało znalezione lub jest nieaktywne');
    }

    // Generate unique callback URL and secret
    const subscriptionId = crypto.randomUUID();
    const callbackUrl = params.callbackUrlOverride ||
      `${this.baseCallbackUrl}/webhooks/${connection.bankId.toLowerCase()}/${subscriptionId}`;
    const secret = crypto.randomBytes(32).toString('hex');

    // Register with bank provider
    const provider = this.providers.get(connection.bankId);
    if (!provider) {
      throw new Error(`Dostawca ${connection.bankId} nie obsługuje webhooków`);
    }

    let externalSubscriptionId: string | null = null;
    try {
      externalSubscriptionId = await provider.registerWebhook({
        accessToken: await this.bankingService.getAccessToken(connection.id),
        callbackUrl,
        events: params.events,
        secret
      });
    } catch (error) {
      this.logger.warn(`Failed to register webhook with provider: ${error.message}`);
      // Continue - we'll use polling as fallback
    }

    // Create subscription record
    const subscription = await this.prisma.webhookSubscription.create({
      data: {
        id: subscriptionId,
        connectionId: params.connectionId,
        organizationId: params.organizationId,
        provider: connection.bankId,
        externalSubscriptionId,
        callbackUrl,
        events: params.events,
        secret: await this.encryptSecret(secret),
        status: externalSubscriptionId ? 'ACTIVE' : 'PENDING',
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
      }
    });

    // If webhook registration failed, enable polling
    if (!externalSubscriptionId) {
      await this.enablePolling({
        connectionId: params.connectionId,
        organizationId: params.organizationId,
        reason: 'WEBHOOK_REGISTRATION_FAILED'
      });
    }

    return subscription;
  }

  async handleIncomingWebhook(
    provider: string,
    headers: Record<string, string>,
    body: unknown
  ): Promise<{ acknowledged: boolean }> {
    const startTime = Date.now();

    // Find provider handler
    const handler = this.providers.get(provider);
    if (!handler) {
      this.logger.warn(`Unknown webhook provider: ${provider}`);
      return { acknowledged: false };
    }

    // Parse and validate webhook
    const parsed = handler.parseWebhook(body);

    // Find subscription by callback URL or subscription ID
    const subscription = await this.findSubscriptionForWebhook(
      provider,
      headers,
      parsed
    );

    if (!subscription) {
      this.logger.warn(`No subscription found for webhook from ${provider}`);
      return { acknowledged: false };
    }

    // Validate signature
    const secret = await this.decryptSecret(subscription.secret);
    const signatureValid = this.validateSignature(
      headers,
      body,
      secret,
      handler.getSignatureConfig()
    );

    // Check for duplicate event
    const existingEvent = await this.prisma.webhookEvent.findFirst({
      where: {
        subscriptionId: subscription.id,
        externalEventId: parsed.eventId
      }
    });

    if (existingEvent) {
      this.logger.debug(`Duplicate webhook event: ${parsed.eventId}`);
      return { acknowledged: true };
    }

    // Create event record
    const event = await this.prisma.webhookEvent.create({
      data: {
        subscriptionId: subscription.id,
        externalEventId: parsed.eventId,
        eventType: parsed.eventType,
        payload: parsed as any,
        signature: headers['x-signature'] || headers['x-webhook-signature'],
        signatureValid,
        status: signatureValid ? 'RECEIVED' : 'FAILED',
        processingStartedAt: signatureValid ? new Date() : null
      }
    });

    if (!signatureValid) {
      this.logger.warn(`Invalid signature for webhook event ${event.id}`);
      await this.incrementFailureCount(subscription.id);
      return { acknowledged: false };
    }

    // Process event asynchronously
    this.processEventAsync(event.id, subscription, parsed);

    return { acknowledged: true };
  }

  private async processEventAsync(
    eventId: string,
    subscription: WebhookSubscription,
    payload: ParsedWebhook
  ) {
    const startTime = Date.now();

    try {
      // Update event status
      await this.prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: 'PROCESSING' }
      });

      // Route to appropriate handler
      await this.routeEvent(subscription, payload);

      // Mark as processed
      const processingDuration = Date.now() - startTime;
      await this.prisma.webhookEvent.update({
        where: { id: eventId },
        data: {
          status: 'PROCESSED',
          processingCompletedAt: new Date(),
          processingDurationMs: processingDuration
        }
      });

      // Update subscription success timestamp
      await this.prisma.webhookSubscription.update({
        where: { id: subscription.id },
        data: {
          lastEventAt: new Date(),
          lastSuccessAt: new Date(),
          failureCount: 0
        }
      });

      this.logger.log(
        `Processed webhook event ${eventId} in ${processingDuration}ms`
      );
    } catch (error) {
      this.logger.error(`Failed to process webhook event ${eventId}: ${error.message}`);

      await this.prisma.webhookEvent.update({
        where: { id: eventId },
        data: {
          status: 'FAILED',
          processingCompletedAt: new Date(),
          processingDurationMs: Date.now() - startTime,
          errorMessage: error.message
        }
      });

      await this.incrementFailureCount(subscription.id);
    }
  }

  private async routeEvent(subscription: WebhookSubscription, payload: ParsedWebhook) {
    const eventType = this.normalizeEventType(payload.eventType);

    switch (eventType) {
      case 'TRANSACTION_CREATED':
      case 'TRANSACTION_UPDATED':
        await this.handleTransactionEvent(subscription, payload);
        break;

      case 'BALANCE_UPDATED':
        await this.handleBalanceEvent(subscription, payload);
        break;

      case 'CONSENT_EXPIRING':
      case 'CONSENT_REVOKED':
        await this.handleConsentEvent(subscription, payload);
        break;

      case 'PAYMENT_STATUS_CHANGED':
        await this.handlePaymentEvent(subscription, payload);
        break;

      default:
        this.logger.warn(`Unhandled event type: ${eventType}`);
    }
  }

  private async handleTransactionEvent(
    subscription: WebhookSubscription,
    payload: ParsedWebhook
  ) {
    // Import new transaction
    await this.bankingService.importSingleTransaction(
      subscription.connectionId,
      payload.data
    );

    // Emit event for other modules
    await this.eventEmitter.emit('BNK.WEBHOOK.TRANSACTION', {
      connectionId: subscription.connectionId,
      transactionData: payload.data
    });
  }

  private async handleBalanceEvent(
    subscription: WebhookSubscription,
    payload: ParsedWebhook
  ) {
    // Update account balance
    await this.bankingService.updateAccountBalance(
      payload.data.accountId,
      payload.data.balance
    );

    await this.eventEmitter.emit('BNK.WEBHOOK.BALANCE', {
      connectionId: subscription.connectionId,
      accountId: payload.data.accountId,
      balance: payload.data.balance
    });
  }

  private async handleConsentEvent(
    subscription: WebhookSubscription,
    payload: ParsedWebhook
  ) {
    const eventType = this.normalizeEventType(payload.eventType);

    if (eventType === 'CONSENT_REVOKED') {
      // Mark connection as disconnected
      await this.prisma.bankConnection.update({
        where: { id: subscription.connectionId },
        data: { status: 'DISCONNECTED' }
      });
    }

    await this.eventEmitter.emit('BNK.WEBHOOK.CONSENT', {
      connectionId: subscription.connectionId,
      eventType,
      expiresAt: payload.data.expiresAt
    });
  }

  private async handlePaymentEvent(
    subscription: WebhookSubscription,
    payload: ParsedWebhook
  ) {
    // Update payment status
    await this.bankingService.updatePaymentStatus(
      payload.data.paymentId,
      payload.data.status
    );

    await this.eventEmitter.emit('BNK.WEBHOOK.PAYMENT', {
      connectionId: subscription.connectionId,
      paymentId: payload.data.paymentId,
      status: payload.data.status
    });
  }

  private validateSignature(
    headers: Record<string, string>,
    body: unknown,
    secret: string,
    config: SignatureConfig
  ): boolean {
    const signature = headers[config.headerName.toLowerCase()];
    if (!signature) return false;

    const timestamp = headers[config.timestampHeader?.toLowerCase() || 'x-timestamp'];

    // Check timestamp freshness (5 minute window)
    if (timestamp) {
      const eventTime = parseInt(timestamp) * 1000;
      if (Math.abs(Date.now() - eventTime) > 5 * 60 * 1000) {
        return false;
      }
    }

    const payload = timestamp
      ? `${timestamp}.${JSON.stringify(body)}`
      : JSON.stringify(body);

    const expectedSignature = crypto
      .createHmac(config.algorithm || 'sha256', secret)
      .update(payload)
      .digest('hex');

    // Use timing-safe comparison
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(config.signaturePrefix ? `${config.signaturePrefix}${expectedSignature}` : expectedSignature)
      );
    } catch {
      return false;
    }
  }

  private async incrementFailureCount(subscriptionId: string) {
    const subscription = await this.prisma.webhookSubscription.update({
      where: { id: subscriptionId },
      data: {
        lastFailureAt: new Date(),
        failureCount: { increment: 1 }
      }
    });

    // Check if we should switch to polling
    if (subscription.failureCount >= 3) {
      await this.enablePolling({
        connectionId: subscription.connectionId,
        organizationId: subscription.organizationId,
        reason: 'CONSECUTIVE_FAILURES'
      });

      await this.prisma.webhookSubscription.update({
        where: { id: subscriptionId },
        data: { status: 'FAILED' }
      });
    }
  }

  async enablePolling(params: {
    connectionId: string;
    organizationId: string;
    reason: string;
    intervalSeconds?: number;
  }) {
    await this.prisma.pollingConfiguration.upsert({
      where: { connectionId: params.connectionId },
      create: {
        connectionId: params.connectionId,
        isActive: true,
        reason: params.reason,
        intervalSeconds: params.intervalSeconds || 900,
        nextPollAt: new Date()
      },
      update: {
        isActive: true,
        reason: params.reason,
        intervalSeconds: params.intervalSeconds || 900,
        nextPollAt: new Date()
      }
    });

    this.logger.log(
      `Enabled polling for connection ${params.connectionId}: ${params.reason}`
    );
  }

  // Scheduled polling job
  @Cron(CronExpression.EVERY_MINUTE)
  async runPollingJobs() {
    const duePolls = await this.prisma.pollingConfiguration.findMany({
      where: {
        isActive: true,
        nextPollAt: { lte: new Date() }
      },
      include: {
        connection: true
      }
    });

    for (const poll of duePolls) {
      try {
        // Fetch latest transactions
        await this.bankingService.syncAccount(poll.connectionId);

        // Update polling record
        await this.prisma.pollingConfiguration.update({
          where: { id: poll.id },
          data: {
            lastPollAt: new Date(),
            nextPollAt: new Date(Date.now() + poll.intervalSeconds * 1000),
            consecutiveFailures: 0
          }
        });

        // Check if webhook is back online
        await this.checkWebhookRecovery(poll.connectionId);
      } catch (error) {
        this.logger.error(`Polling failed for connection ${poll.connectionId}: ${error.message}`);

        await this.prisma.pollingConfiguration.update({
          where: { id: poll.id },
          data: {
            lastPollAt: new Date(),
            nextPollAt: new Date(Date.now() + poll.intervalSeconds * 1000),
            consecutiveFailures: { increment: 1 }
          }
        });
      }
    }
  }

  private async checkWebhookRecovery(connectionId: string) {
    const subscription = await this.prisma.webhookSubscription.findFirst({
      where: {
        connectionId,
        status: 'FAILED'
      }
    });

    if (subscription) {
      // Try to re-register webhook
      try {
        const connection = await this.prisma.bankConnection.findUnique({
          where: { id: connectionId }
        });

        const provider = this.providers.get(connection.bankId);
        if (provider) {
          await provider.registerWebhook({
            accessToken: await this.bankingService.getAccessToken(connectionId),
            callbackUrl: subscription.callbackUrl,
            events: subscription.events,
            secret: await this.decryptSecret(subscription.secret)
          });

          // Webhook recovered - disable polling
          await this.prisma.webhookSubscription.update({
            where: { id: subscription.id },
            data: { status: 'ACTIVE', failureCount: 0 }
          });

          await this.prisma.pollingConfiguration.update({
            where: { connectionId },
            data: { isActive: false }
          });

          this.logger.log(`Webhook recovered for connection ${connectionId}`);
        }
      } catch (error) {
        // Still failing - continue polling
      }
    }
  }

  private async encryptSecret(secret: string): Promise<string> {
    const key = this.config.get('WEBHOOK_ENCRYPTION_KEY');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);

    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]).toString('base64');
  }

  private async decryptSecret(encrypted: string): Promise<string> {
    const key = this.config.get('WEBHOOK_ENCRYPTION_KEY');
    const buffer = Buffer.from(encrypted, 'base64');

    const iv = buffer.slice(0, 16);
    const authTag = buffer.slice(16, 32);
    const encryptedData = buffer.slice(32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, null, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private normalizeEventType(eventType: string): string {
    const mapping: Record<string, string> = {
      'transaction.created': 'TRANSACTION_CREATED',
      'transaction.updated': 'TRANSACTION_UPDATED',
      'balance.updated': 'BALANCE_UPDATED',
      'consent.expiring': 'CONSENT_EXPIRING',
      'consent.revoked': 'CONSENT_REVOKED',
      'payment.status': 'PAYMENT_STATUS_CHANGED'
    };

    return mapping[eventType.toLowerCase()] || eventType.toUpperCase().replace(/\./g, '_');
  }
}
```

---

## Test Specification

### Unit Tests

```typescript
describe('WebhookService', () => {
  describe('validateSignature', () => {
    it('should validate correct HMAC signature', () => {
      const secret = 'test-secret';
      const body = { eventId: '123', type: 'test' };
      const timestamp = Math.floor(Date.now() / 1000).toString();

      const payload = `${timestamp}.${JSON.stringify(body)}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const headers = {
        'x-signature': expectedSignature,
        'x-timestamp': timestamp
      };

      const result = service.validateSignature(headers, body, secret, {
        headerName: 'x-signature',
        timestampHeader: 'x-timestamp',
        algorithm: 'sha256'
      });

      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      const result = service.validateSignature(
        { 'x-signature': 'invalid' },
        { eventId: '123' },
        'secret',
        { headerName: 'x-signature', algorithm: 'sha256' }
      );

      expect(result).toBe(false);
    });

    it('should reject expired timestamp', () => {
      const oldTimestamp = Math.floor((Date.now() - 10 * 60 * 1000) / 1000).toString();

      const result = service.validateSignature(
        { 'x-signature': 'sig', 'x-timestamp': oldTimestamp },
        {},
        'secret',
        { headerName: 'x-signature', timestampHeader: 'x-timestamp' }
      );

      expect(result).toBe(false);
    });
  });

  describe('handleIncomingWebhook', () => {
    it('should process valid webhook and return acknowledged', async () => {
      const result = await service.handleIncomingWebhook(
        'PKO',
        validHeaders,
        validPayload
      );

      expect(result.acknowledged).toBe(true);
    });

    it('should detect and skip duplicate events', async () => {
      // First call
      await service.handleIncomingWebhook('PKO', headers, payload);

      // Duplicate call
      const result = await service.handleIncomingWebhook('PKO', headers, payload);

      expect(result.acknowledged).toBe(true);

      const events = await prisma.webhookEvent.findMany({
        where: { externalEventId: payload.eventId }
      });
      expect(events).toHaveLength(1);
    });

    it('should increment failure count on processing error', async () => {
      jest.spyOn(service, 'routeEvent').mockRejectedValue(new Error('Test error'));

      await service.handleIncomingWebhook('PKO', headers, payload);

      const subscription = await prisma.webhookSubscription.findFirst();
      expect(subscription.failureCount).toBe(1);
    });
  });

  describe('enablePolling', () => {
    it('should create polling configuration', async () => {
      await service.enablePolling({
        connectionId: 'conn-123',
        organizationId: 'org-123',
        reason: 'WEBHOOK_FAILED'
      });

      const config = await prisma.pollingConfiguration.findFirst({
        where: { connectionId: 'conn-123' }
      });

      expect(config).not.toBeNull();
      expect(config.isActive).toBe(true);
      expect(config.reason).toBe('WEBHOOK_FAILED');
    });
  });
});
```

### Integration Tests

```typescript
describe('Webhook API', () => {
  it('should handle full webhook lifecycle', async () => {
    // 1. Create subscription
    const createResponse = await request(app)
      .post('/api/trpc/bnk.createSubscription')
      .send({
        connectionId: testConnectionId,
        events: ['TRANSACTION_CREATED', 'BALANCE_UPDATED']
      });

    expect(createResponse.status).toBe(200);
    const subscriptionId = createResponse.body.id;

    // 2. Simulate incoming webhook
    const webhookPayload = {
      eventId: 'evt-123',
      eventType: 'transaction.created',
      data: { accountId: testAccountId, amount: '100.00' }
    };

    const signature = generateSignature(webhookPayload, testSecret);

    const webhookResponse = await request(app)
      .post(`/webhooks/pko/${subscriptionId}`)
      .set('X-Signature', signature)
      .set('X-Timestamp', Math.floor(Date.now() / 1000).toString())
      .send(webhookPayload);

    expect(webhookResponse.status).toBe(200);
    expect(webhookResponse.body.acknowledged).toBe(true);

    // 3. Verify event was processed
    const eventsResponse = await request(app)
      .get('/api/trpc/bnk.listEvents')
      .query({ subscriptionId });

    expect(eventsResponse.body).toHaveLength(1);
    expect(eventsResponse.body[0].status).toBe('PROCESSED');
  });
});
```

---

## Security Checklist

- [x] Webhook secrets encrypted at rest (AES-256-GCM)
- [x] HMAC signature validation on all incoming webhooks
- [x] Timestamp validation to prevent replay attacks
- [x] Rate limiting on webhook endpoints
- [x] RLS policies on all tables
- [x] Audit logging for subscription management
- [x] Sensitive data not logged
- [x] Timing-safe signature comparison
- [x] TLS required for callback URLs
- [x] IP allowlisting for known bank IPs (configurable)

---

## Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `BNK.WEBHOOK.SUBSCRIPTION_CREATED` | New subscription | connection, events |
| `BNK.WEBHOOK.SUBSCRIPTION_UPDATED` | Subscription modified | changes |
| `BNK.WEBHOOK.SUBSCRIPTION_DELETED` | Subscription removed | subscription ID |
| `BNK.WEBHOOK.EVENT_RECEIVED` | Webhook received | event type, provider |
| `BNK.WEBHOOK.EVENT_PROCESSED` | Event handled | processing time |
| `BNK.WEBHOOK.EVENT_FAILED` | Processing failed | error message |
| `BNK.WEBHOOK.EVENT_RETRIED` | Manual retry | event ID |
| `BNK.WEBHOOK.SIGNATURE_INVALID` | Bad signature | provider, IP |
| `BNK.WEBHOOK.POLLING_ENABLED` | Fallback activated | reason |
| `BNK.WEBHOOK.POLLING_DISABLED` | Webhook recovered | connection |

---

## Implementation Notes

### Provider-Specific Considerations
- **PKO**: Uses `X-PKO-Signature` header, SHA256
- **mBank**: Uses `X-MBank-Webhook-Signature`, SHA512
- **ING**: Uses `Authorization` header with bearer token
- **Santander**: Uses standard `X-Signature` with timestamp

### Fallback Strategy
1. After 3 consecutive webhook failures → enable polling
2. Poll every 15 minutes by default
3. Try to re-register webhook every hour
4. Resume webhooks when successful

### Performance Considerations
- Process webhooks asynchronously (respond 200 immediately)
- Use Redis for deduplication cache
- Batch similar events when possible
- Clean up old events after 90 days

---

## Dependencies

- **BNK-001**: Bank Connection (subscription requires active connection)
- **BNK-003**: Transaction Import (for transaction webhooks)
- **BNK-006**: Payment Status (for payment webhooks)

## Related Stories

- **BNK-002**: Account Aggregation (balance webhooks)
- **MON**: Monitoring (webhook health metrics)

---

*Last updated: December 2024*
