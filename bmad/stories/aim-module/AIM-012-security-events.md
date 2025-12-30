# 📋 Story: AIM-012 - Security Events & Alerts

> **Story ID**: `AIM-012`
> **Epic**: AIM-EPIC-001
> **Status**: 🟢 Ready for Development
> **Points**: 8
> **Priority**: P1

---

## 📖 User Story

**As a** system administrator
**I want** to receive real-time notifications about security events
**So that** I can respond quickly to potential threats

---

## ✅ Acceptance Criteria

### AC1: Real-Time Event Streaming
```gherkin
Given I am logged in as an admin
When I open the security events dashboard
Then I see real-time security events as they occur
And events are categorized by severity (CRITICAL, HIGH, MEDIUM, LOW)
And I can filter events by type, user, or IP address
And new events appear without page refresh
```

### AC2: Email Notifications
```gherkin
Given I have configured email notifications
When a security event of my subscribed severity occurs
Then I receive an email notification within 60 seconds
And the email contains:
  | Field       | Content                        |
  | Subject     | [KsięgowaCRM] Alert: {type}    |
  | Event type  | Human-readable description     |
  | Timestamp   | ISO format with timezone       |
  | Details     | Relevant event metadata        |
  | Action link | Direct link to event in system |
And the email is in Polish language
```

### AC3: SMS Notifications for Critical Events
```gherkin
Given I have configured SMS notifications for CRITICAL events
When a CRITICAL severity event occurs
Then I receive an SMS notification within 30 seconds
And the SMS contains brief event summary
And the SMS includes a shortened link to details
And SMS is sent to all registered security contacts
```

### AC4: Slack/Teams Integration
```gherkin
Given I have configured Slack webhook integration
When a security event matching my filters occurs
Then a notification is posted to the configured channel
And the notification includes:
  | Element     | Content                      |
  | Color       | Red/Orange/Yellow by severity|
  | Title       | Event type in Polish         |
  | Fields      | User, IP, Timestamp, Details |
  | Actions     | View Details, Acknowledge    |
And I can interact with the notification directly
```

### AC5: Push Notifications (Mobile)
```gherkin
Given I have enabled push notifications on my mobile device
When a HIGH or CRITICAL event occurs
Then I receive a push notification immediately
And the notification shows event summary
And tapping opens the event details in the app
And notifications work even when app is closed
```

### AC6: Alert Escalation
```gherkin
Given an alert has been triggered
When no one acknowledges it within 15 minutes
Then the alert escalates to the next level:
  | Level | Action                           |
  | 1     | Original notification channels   |
  | 2     | Secondary contacts + SMS         |
  | 3     | All security team + phone call   |
And each escalation is logged
And escalation stops when alert is acknowledged
```

### AC7: Notification Preferences
```gherkin
Given I am a security admin
When I access notification settings
Then I can configure per-channel preferences:
  | Channel | Options                                |
  | Email   | On/Off, Severity filter, Digest mode  |
  | SMS     | On/Off, CRITICAL only, Phone number   |
  | Slack   | Webhook URL, Channel, Severity filter |
  | Push    | On/Off, Severity filter, Quiet hours  |
And I can set quiet hours (no non-critical alerts)
And I can subscribe to specific event types
```

### AC8: Security Dashboard
```gherkin
Given I am on the security dashboard
When the page loads
Then I see real-time metrics:
  | Widget            | Content                        |
  | Active alerts     | Count by severity              |
  | Events timeline   | Last 24h chart                 |
  | Geographic map    | Login locations                |
  | Top threats       | Most frequent alert types      |
  | Response time     | Avg time to acknowledge        |
And widgets auto-refresh every 30 seconds
And I can customize widget layout
```

### AC9: Alert Rules Configuration
```gherkin
Given I am a security admin
When I create a custom alert rule
Then I can specify:
  | Field       | Options                           |
  | Event types | Multi-select from available types |
  | Conditions  | Count threshold, Time window      |
  | Severity    | AUTO, LOW, MEDIUM, HIGH, CRITICAL |
  | Actions     | Notification channels, Auto-block |
And the rule is validated before saving
And I can enable/disable rules without deleting
```

### AC10: Event Correlation View
```gherkin
Given I select a security event
When I click "View related events"
Then I see all events with the same correlation ID
And events are displayed on a timeline
And I can see the full attack chain if applicable
And I can add notes to the correlation group
```

### AC11: Prometheus Metrics Export
```gherkin
Given Prometheus is configured to scrape our metrics
When it queries the /metrics endpoint
Then it receives security metrics:
  | Metric                              | Type    |
  | auth_security_events_total          | Counter |
  | auth_alerts_active                  | Gauge   |
  | auth_alert_response_time_seconds    | Histogram |
  | auth_failed_logins_total            | Counter |
  | auth_blocked_ips_total              | Gauge   |
And metrics have appropriate labels (severity, type)
```

### AC12: Webhook Notifications
```gherkin
Given I have configured a custom webhook
When a security event matches my webhook criteria
Then an HTTP POST is sent to the webhook URL
And the payload contains full event data in JSON
And the request includes HMAC signature header
And failed webhooks are retried 3 times
And webhook failures are logged
```

---

## 🔧 Technical Specification

### Database Schema

```sql
-- =====================================================
-- Notification Subscriptions
-- =====================================================

-- Notification channel enum
CREATE TYPE notification_channel AS ENUM (
  'EMAIL',
  'SMS',
  'PUSH',
  'SLACK',
  'TEAMS',
  'WEBHOOK'
);

-- Alert severity enum (if not exists from AIM-011)
DO $$ BEGIN
  CREATE TYPE alert_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Notification subscriptions table
CREATE TABLE notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Channel configuration
  channel notification_channel NOT NULL,
  channel_config JSONB NOT NULL DEFAULT '{}',
  -- EMAIL: { address: string }
  -- SMS: { phone_number: string, country_code: string }
  -- PUSH: { device_token: string, platform: 'ios' | 'android' }
  -- SLACK: { webhook_url: string, channel: string }
  -- TEAMS: { webhook_url: string }
  -- WEBHOOK: { url: string, secret: string, headers: object }

  -- Filter configuration
  min_severity alert_severity NOT NULL DEFAULT 'MEDIUM',
  event_types TEXT[] DEFAULT NULL, -- NULL = all types

  -- Schedule
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME, -- e.g., '22:00'
  quiet_hours_end TIME,   -- e.g., '07:00'
  quiet_hours_timezone VARCHAR(50) DEFAULT 'Europe/Warsaw',
  digest_mode BOOLEAN NOT NULL DEFAULT false,
  digest_frequency VARCHAR(20) DEFAULT 'daily', -- 'hourly', 'daily', 'weekly'

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, channel, channel_config)
);

CREATE INDEX idx_notif_subs_user ON notification_subscriptions(user_id);
CREATE INDEX idx_notif_subs_channel ON notification_subscriptions(channel);
CREATE INDEX idx_notif_subs_enabled ON notification_subscriptions(is_enabled) WHERE is_enabled = true;

-- =====================================================
-- Notification Queue
-- =====================================================

-- Notification status enum
CREATE TYPE notification_status AS ENUM (
  'PENDING',
  'SENT',
  'DELIVERED',
  'FAILED',
  'CANCELLED'
);

-- Notification queue table
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target
  subscription_id UUID NOT NULL REFERENCES notification_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  channel notification_channel NOT NULL,

  -- Source event
  alert_id UUID REFERENCES security_alerts(id),
  audit_log_id UUID REFERENCES auth_audit_logs(id),

  -- Content
  subject VARCHAR(255),
  body TEXT NOT NULL,
  body_html TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',

  -- Status
  status notification_status NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMP,
  last_error TEXT,
  delivered_at TIMESTAMP,

  -- Scheduling
  scheduled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notif_queue_status ON notification_queue(status) WHERE status = 'PENDING';
CREATE INDEX idx_notif_queue_scheduled ON notification_queue(scheduled_at) WHERE status = 'PENDING';
CREATE INDEX idx_notif_queue_user ON notification_queue(user_id);

-- =====================================================
-- Escalation Rules
-- =====================================================

CREATE TABLE escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Trigger conditions
  min_severity alert_severity NOT NULL DEFAULT 'HIGH',
  event_types TEXT[],

  -- Escalation levels (JSONB array)
  levels JSONB NOT NULL,
  -- Example: [
  --   { "delay_minutes": 0, "channels": ["EMAIL", "SLACK"], "contacts": ["user-1"] },
  --   { "delay_minutes": 15, "channels": ["SMS"], "contacts": ["user-1", "user-2"] },
  --   { "delay_minutes": 30, "channels": ["SMS", "PHONE"], "contacts": ["all-security-team"] }
  -- ]

  is_enabled BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)
);

-- =====================================================
-- Custom Alert Rules
-- =====================================================

CREATE TABLE custom_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Conditions
  event_types TEXT[] NOT NULL,
  condition_operator VARCHAR(10) NOT NULL DEFAULT 'COUNT', -- 'COUNT', 'RATE', 'UNIQUE'
  condition_threshold INTEGER NOT NULL,
  condition_window_minutes INTEGER NOT NULL DEFAULT 60,
  condition_group_by VARCHAR(50), -- 'ip', 'user', 'country'

  -- Action
  severity alert_severity NOT NULL,
  auto_block_ip BOOLEAN NOT NULL DEFAULT false,
  auto_lock_account BOOLEAN NOT NULL DEFAULT false,
  notification_channels notification_channel[] NOT NULL DEFAULT ARRAY['EMAIL']::notification_channel[],

  -- Status
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMP,
  trigger_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_custom_rules_enabled ON custom_alert_rules(is_enabled) WHERE is_enabled = true;

-- =====================================================
-- Escalation Tracking
-- =====================================================

CREATE TABLE alert_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES security_alerts(id),
  escalation_rule_id UUID NOT NULL REFERENCES escalation_rules(id),

  current_level INTEGER NOT NULL DEFAULT 0,
  escalated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  next_escalation_at TIMESTAMP,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  completed_reason VARCHAR(50), -- 'ACKNOWLEDGED', 'RESOLVED', 'MAX_LEVEL'

  escalation_history JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_escalations_next ON alert_escalations(next_escalation_at)
  WHERE is_complete = false;
```

### tRPC Router Implementation

```typescript
// src/server/routers/security-events.router.ts
import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { SecurityEventsService } from '../services/security-events.service';
import { observable } from '@trpc/server/observable';
import { TRPCError } from '@trpc/server';

// =====================================================
// Zod Schemas
// =====================================================

const NotificationChannelSchema = z.enum([
  'EMAIL',
  'SMS',
  'PUSH',
  'SLACK',
  'TEAMS',
  'WEBHOOK'
]);

const AlertSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const EmailConfigSchema = z.object({
  address: z.string().email()
});

const SmsConfigSchema = z.object({
  phone_number: z.string().regex(/^\+?[1-9]\d{6,14}$/),
  country_code: z.string().length(2).default('PL')
});

const PushConfigSchema = z.object({
  device_token: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web'])
});

const SlackConfigSchema = z.object({
  webhook_url: z.string().url().startsWith('https://hooks.slack.com/'),
  channel: z.string().optional()
});

const TeamsConfigSchema = z.object({
  webhook_url: z.string().url()
});

const WebhookConfigSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(32),
  headers: z.record(z.string()).optional()
});

const ChannelConfigSchema = z.union([
  EmailConfigSchema,
  SmsConfigSchema,
  PushConfigSchema,
  SlackConfigSchema,
  TeamsConfigSchema,
  WebhookConfigSchema
]);

const SubscriptionCreateSchema = z.object({
  channel: NotificationChannelSchema,
  channelConfig: ChannelConfigSchema,
  minSeverity: AlertSeveritySchema.default('MEDIUM'),
  eventTypes: z.array(z.string()).nullable().default(null),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  quietHoursTimezone: z.string().default('Europe/Warsaw'),
  digestMode: z.boolean().default(false),
  digestFrequency: z.enum(['hourly', 'daily', 'weekly']).default('daily')
});

const CustomAlertRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  eventTypes: z.array(z.string()).min(1),
  conditionOperator: z.enum(['COUNT', 'RATE', 'UNIQUE']).default('COUNT'),
  conditionThreshold: z.number().int().min(1),
  conditionWindowMinutes: z.number().int().min(1).max(1440).default(60),
  conditionGroupBy: z.enum(['ip', 'user', 'country']).nullable().optional(),
  severity: AlertSeveritySchema,
  autoBlockIp: z.boolean().default(false),
  autoLockAccount: z.boolean().default(false),
  notificationChannels: z.array(NotificationChannelSchema).default(['EMAIL'])
});

const EscalationLevelSchema = z.object({
  delayMinutes: z.number().int().min(0),
  channels: z.array(NotificationChannelSchema),
  contacts: z.array(z.string()) // user IDs or 'all-security-team'
});

const EscalationRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  minSeverity: AlertSeveritySchema.default('HIGH'),
  eventTypes: z.array(z.string()).nullable().optional(),
  levels: z.array(EscalationLevelSchema).min(1).max(5)
});

// =====================================================
// Response Schemas
// =====================================================

const SecurityEventSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string(),
  severity: AlertSeveritySchema,
  timestamp: z.string().datetime(),
  actor: z.object({
    userId: z.string().uuid().nullable(),
    ipAddress: z.string(),
    geoCountry: z.string().nullable(),
    geoCity: z.string().nullable()
  }),
  target: z.object({
    type: z.string().nullable(),
    id: z.string().nullable()
  }),
  result: z.string(),
  metadata: z.record(z.unknown())
});

const DashboardMetricsSchema = z.object({
  activeAlerts: z.object({
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number()
  }),
  eventsLast24h: z.array(z.object({
    hour: z.number(),
    count: z.number(),
    severity: z.string()
  })),
  topThreats: z.array(z.object({
    type: z.string(),
    count: z.number(),
    trend: z.enum(['up', 'down', 'stable'])
  })),
  geographicData: z.array(z.object({
    country: z.string(),
    city: z.string().nullable(),
    count: z.number(),
    latitude: z.number(),
    longitude: z.number()
  })),
  responseMetrics: z.object({
    avgAcknowledgeTime: z.number(), // minutes
    avgResolveTime: z.number(),
    unacknowledged: z.number()
  })
});

// =====================================================
// Router Definition
// =====================================================

export const securityEventsRouter = router({
  // -------------------------
  // Real-time Event Stream
  // -------------------------
  streamEvents: adminProcedure
    .input(z.object({
      minSeverity: AlertSeveritySchema.optional(),
      eventTypes: z.array(z.string()).optional()
    }))
    .subscription(({ ctx, input }) => {
      return observable<z.infer<typeof SecurityEventSchema>>((emit) => {
        const service = new SecurityEventsService(ctx.db, ctx.redis);

        const unsubscribe = service.subscribeToEvents(
          {
            minSeverity: input.minSeverity,
            eventTypes: input.eventTypes
          },
          (event) => emit.next(event)
        );

        return () => {
          unsubscribe();
        };
      });
    }),

  // -------------------------
  // Dashboard Metrics
  // -------------------------
  getDashboardMetrics: adminProcedure
    .output(DashboardMetricsSchema)
    .query(async ({ ctx }) => {
      const service = new SecurityEventsService(ctx.db, ctx.redis);
      return service.getDashboardMetrics();
    }),

  // -------------------------
  // Notification Subscriptions
  // -------------------------
  getMySubscriptions: protectedProcedure
    .output(z.array(z.object({
      id: z.string().uuid(),
      channel: NotificationChannelSchema,
      channelConfig: z.record(z.unknown()),
      minSeverity: AlertSeveritySchema,
      eventTypes: z.array(z.string()).nullable(),
      isEnabled: z.boolean(),
      quietHoursStart: z.string().nullable(),
      quietHoursEnd: z.string().nullable(),
      digestMode: z.boolean(),
      createdAt: z.string().datetime()
    })))
    .query(async ({ ctx }) => {
      const service = new SecurityEventsService(ctx.db, ctx.redis);
      return service.getUserSubscriptions(ctx.user.id);
    }),

  createSubscription: protectedProcedure
    .input(SubscriptionCreateSchema)
    .output(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SecurityEventsService(ctx.db, ctx.redis);

      // Validate channel config matches channel type
      service.validateChannelConfig(input.channel, input.channelConfig);

      return service.createSubscription({
        userId: ctx.user.id,
        ...input
      });
    }),

  updateSubscription: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      updates: SubscriptionCreateSchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SecurityEventsService(ctx.db, ctx.redis);
      return service.updateSubscription(input.id, ctx.user.id, input.updates);
    }),

  deleteSubscription: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SecurityEventsService(ctx.db, ctx.redis);
      return service.deleteSubscription(input.id, ctx.user.id);
    }),

  testSubscription: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SecurityEventsService(ctx.db, ctx.redis);
      return service.sendTestNotification(input.id, ctx.user.id);
    }),

  // -------------------------
  // Custom Alert Rules
  // -------------------------
  listAlertRules: adminProcedure
    .output(z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      description: z.string().nullable(),
      eventTypes: z.array(z.string()),
      conditionOperator: z.string(),
      conditionThreshold: z.number(),
      conditionWindowMinutes: z.number(),
      severity: AlertSeveritySchema,
      isEnabled: z.boolean(),
      lastTriggeredAt: z.string().datetime().nullable(),
      triggerCount: z.number()
    })))
    .query(async ({ ctx }) => {
      const service = new SecurityEventsService(ctx.db, ctx.redis);
      return service.listAlertRules();
    }),

  createAlertRule: adminProcedure
    .input(CustomAlertRuleSchema)
    .output(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SecurityEventsService(ctx.db, ctx.redis);
      return service.createAlertRule({
        ...input,
        createdBy: ctx.user.id
      });
    }),

  updateAlertRule: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      updates: CustomAlertRuleSchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SecurityEventsService(ctx.db, ctx.redis);
      return service.updateAlertRule(input.id, input.updates);
    }),

  toggleAlertRule: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      isEnabled: z.boolean()
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SecurityEventsService(ctx.db, ctx.redis);
      return service.toggleAlertRule(input.id, input.isEnabled);
    }),

  deleteAlertRule: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SecurityEventsService(ctx.db, ctx.redis);
      return service.deleteAlertRule(input.id);
    }),

  // -------------------------
  // Escalation Rules
  // -------------------------
  listEscalationRules: adminProcedure
    .output(z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      description: z.string().nullable(),
      minSeverity: AlertSeveritySchema,
      eventTypes: z.array(z.string()).nullable(),
      levels: z.array(EscalationLevelSchema),
      isEnabled: z.boolean()
    })))
    .query(async ({ ctx }) => {
      const service = new SecurityEventsService(ctx.db, ctx.redis);
      return service.listEscalationRules();
    }),

  createEscalationRule: adminProcedure
    .input(EscalationRuleSchema)
    .output(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new SecurityEventsService(ctx.db, ctx.redis);
      return service.createEscalationRule({
        ...input,
        createdBy: ctx.user.id
      });
    }),

  // -------------------------
  // Prometheus Metrics
  // -------------------------
  getPrometheusMetrics: adminProcedure
    .output(z.string())
    .query(async ({ ctx }) => {
      const service = new SecurityEventsService(ctx.db, ctx.redis);
      return service.getPrometheusMetrics();
    }),

  // -------------------------
  // Register Push Token
  // -------------------------
  registerPushToken: protectedProcedure
    .input(z.object({
      token: z.string().min(1),
      platform: z.enum(['ios', 'android', 'web'])
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new SecurityEventsService(ctx.db, ctx.redis);
      return service.registerPushToken(ctx.user.id, input.token, input.platform);
    })
});
```

### SecurityEventsService Implementation

```typescript
// src/server/services/security-events.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';
import * as Twilio from 'twilio';
import * as webpush from 'web-push';
import axios from 'axios';
import * as crypto from 'crypto';

// =====================================================
// Types
// =====================================================

type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'SLACK' | 'TEAMS' | 'WEBHOOK';
type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface SecurityEvent {
  id: string;
  eventType: string;
  severity: AlertSeverity;
  timestamp: string;
  actor: {
    userId: string | null;
    ipAddress: string;
    geoCountry: string | null;
    geoCity: string | null;
  };
  target: {
    type: string | null;
    id: string | null;
  };
  result: string;
  metadata: Record<string, unknown>;
}

interface NotificationPayload {
  subscriptionId: string;
  userId: string;
  channel: NotificationChannel;
  channelConfig: Record<string, unknown>;
  subject: string;
  body: string;
  bodyHtml?: string;
  alertId?: string;
  auditLogId?: string;
  metadata: Record<string, unknown>;
}

// =====================================================
// Service Implementation
// =====================================================

@Injectable()
export class SecurityEventsService {
  private readonly REDIS_CHANNEL = 'security:events';
  private readonly eventListeners: Map<string, (event: SecurityEvent) => void> = new Map();

  private emailTransport: nodemailer.Transporter;
  private twilioClient: Twilio.Twilio;

  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    @Inject('REDIS_CLIENT') private readonly redis: Redis
  ) {
    this.initializeEmailTransport();
    this.initializeTwilio();
    this.initializeWebPush();
    this.subscribeToRedisEvents();
  }

  private initializeEmailTransport(): void {
    this.emailTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  private initializeTwilio(): void {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = Twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }
  }

  private initializeWebPush(): void {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@ksiegowaCRM.pl',
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
  }

  private subscribeToRedisEvents(): void {
    const subscriber = this.redis.duplicate();
    subscriber.subscribe(this.REDIS_CHANNEL);

    subscriber.on('message', (channel, message) => {
      if (channel === this.REDIS_CHANNEL) {
        const event = JSON.parse(message) as SecurityEvent;
        this.notifyListeners(event);
      }
    });
  }

  // -------------------------
  // Event Publishing
  // -------------------------
  async publishEvent(event: SecurityEvent): Promise<void> {
    // Publish to Redis for real-time streaming
    await this.redis.publish(this.REDIS_CHANNEL, JSON.stringify(event));

    // Check custom alert rules
    await this.checkCustomAlertRules(event);

    // Queue notifications for matching subscriptions
    await this.queueNotifications(event);
  }

  // -------------------------
  // Real-time Streaming
  // -------------------------
  subscribeToEvents(
    filters: { minSeverity?: AlertSeverity; eventTypes?: string[] },
    callback: (event: SecurityEvent) => void
  ): () => void {
    const listenerId = uuidv4();

    const filteredCallback = (event: SecurityEvent) => {
      const severityOrder = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

      if (filters.minSeverity) {
        if (severityOrder[event.severity] < severityOrder[filters.minSeverity]) {
          return;
        }
      }

      if (filters.eventTypes && filters.eventTypes.length > 0) {
        if (!filters.eventTypes.includes(event.eventType)) {
          return;
        }
      }

      callback(event);
    };

    this.eventListeners.set(listenerId, filteredCallback);

    return () => {
      this.eventListeners.delete(listenerId);
    };
  }

  private notifyListeners(event: SecurityEvent): void {
    for (const callback of this.eventListeners.values()) {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    }
  }

  // -------------------------
  // Dashboard Metrics
  // -------------------------
  async getDashboardMetrics(): Promise<any> {
    // Active alerts by severity
    const alertsQuery = `
      SELECT
        severity,
        COUNT(*) as count
      FROM security_alerts
      WHERE status NOT IN ('RESOLVED', 'FALSE_POSITIVE')
      GROUP BY severity
    `;
    const alertsResult = await this.db.query(alertsQuery);

    const activeAlerts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    for (const row of alertsResult.rows) {
      activeAlerts[row.severity.toLowerCase()] = parseInt(row.count, 10);
    }

    // Events last 24 hours by hour
    const eventsQuery = `
      SELECT
        EXTRACT(HOUR FROM created_at)::int as hour,
        COUNT(*) as count,
        CASE
          WHEN event_type IN ('TAMPERING_ATTEMPT', 'ACCOUNT_LOCKED') THEN 'CRITICAL'
          WHEN event_type IN ('LOGIN_FAILED', 'MFA_FAILED') THEN 'HIGH'
          WHEN event_type IN ('PASSWORD_CHANGED', 'MFA_DISABLED') THEN 'MEDIUM'
          ELSE 'LOW'
        END as severity
      FROM auth_audit_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY EXTRACT(HOUR FROM created_at), severity
      ORDER BY hour
    `;
    const eventsResult = await this.db.query(eventsQuery);

    // Top threats
    const threatsQuery = `
      WITH current_counts AS (
        SELECT alert_type, COUNT(*) as current_count
        FROM security_alerts
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY alert_type
      ),
      previous_counts AS (
        SELECT alert_type, COUNT(*) as previous_count
        FROM security_alerts
        WHERE created_at > NOW() - INTERVAL '48 hours'
          AND created_at <= NOW() - INTERVAL '24 hours'
        GROUP BY alert_type
      )
      SELECT
        c.alert_type as type,
        c.current_count as count,
        CASE
          WHEN p.previous_count IS NULL OR c.current_count > p.previous_count THEN 'up'
          WHEN c.current_count < p.previous_count THEN 'down'
          ELSE 'stable'
        END as trend
      FROM current_counts c
      LEFT JOIN previous_counts p ON c.alert_type = p.alert_type
      ORDER BY c.current_count DESC
      LIMIT 5
    `;
    const threatsResult = await this.db.query(threatsQuery);

    // Geographic data
    const geoQuery = `
      SELECT
        COALESCE(actor_geo_country, 'XX') as country,
        actor_geo_city as city,
        COUNT(*) as count
      FROM auth_audit_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
        AND event_type = 'LOGIN_SUCCESS'
      GROUP BY actor_geo_country, actor_geo_city
      ORDER BY count DESC
      LIMIT 50
    `;
    const geoResult = await this.db.query(geoQuery);

    // Response metrics
    const responseQuery = `
      SELECT
        AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 60) as avg_acknowledge_minutes,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60) as avg_resolve_minutes,
        COUNT(*) FILTER (WHERE status = 'NEW') as unacknowledged
      FROM security_alerts
      WHERE created_at > NOW() - INTERVAL '7 days'
    `;
    const responseResult = await this.db.query(responseQuery);

    return {
      activeAlerts,
      eventsLast24h: eventsResult.rows.map(r => ({
        hour: r.hour,
        count: parseInt(r.count, 10),
        severity: r.severity
      })),
      topThreats: threatsResult.rows.map(r => ({
        type: r.type,
        count: parseInt(r.count, 10),
        trend: r.trend
      })),
      geographicData: geoResult.rows.map(r => ({
        country: r.country,
        city: r.city,
        count: parseInt(r.count, 10),
        ...this.getCountryCoordinates(r.country)
      })),
      responseMetrics: {
        avgAcknowledgeTime: parseFloat(responseResult.rows[0]?.avg_acknowledge_minutes || '0'),
        avgResolveTime: parseFloat(responseResult.rows[0]?.avg_resolve_minutes || '0'),
        unacknowledged: parseInt(responseResult.rows[0]?.unacknowledged || '0', 10)
      }
    };
  }

  private getCountryCoordinates(countryCode: string): { latitude: number; longitude: number } {
    const coordinates: Record<string, { latitude: number; longitude: number }> = {
      PL: { latitude: 52.0, longitude: 19.0 },
      DE: { latitude: 51.0, longitude: 9.0 },
      FR: { latitude: 46.0, longitude: 2.0 },
      US: { latitude: 38.0, longitude: -97.0 },
      GB: { latitude: 54.0, longitude: -2.0 },
      XX: { latitude: 0.0, longitude: 0.0 }
    };
    return coordinates[countryCode] || coordinates.XX;
  }

  // -------------------------
  // Notification Subscriptions
  // -------------------------
  async getUserSubscriptions(userId: string): Promise<any[]> {
    const query = `
      SELECT *
      FROM notification_subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await this.db.query(query, [userId]);

    return result.rows.map(row => ({
      id: row.id,
      channel: row.channel,
      channelConfig: this.maskSensitiveConfig(row.channel_config),
      minSeverity: row.min_severity,
      eventTypes: row.event_types,
      isEnabled: row.is_enabled,
      quietHoursStart: row.quiet_hours_start,
      quietHoursEnd: row.quiet_hours_end,
      digestMode: row.digest_mode,
      createdAt: row.created_at.toISOString()
    }));
  }

  private maskSensitiveConfig(config: Record<string, unknown>): Record<string, unknown> {
    const masked = { ...config };

    if (masked.webhook_url) {
      const url = masked.webhook_url as string;
      masked.webhook_url = url.substring(0, 30) + '***';
    }
    if (masked.phone_number) {
      const phone = masked.phone_number as string;
      masked.phone_number = phone.substring(0, 4) + '***' + phone.slice(-2);
    }
    if (masked.secret) {
      masked.secret = '***';
    }
    if (masked.device_token) {
      const token = masked.device_token as string;
      masked.device_token = token.substring(0, 10) + '***';
    }

    return masked;
  }

  validateChannelConfig(channel: NotificationChannel, config: Record<string, unknown>): void {
    switch (channel) {
      case 'EMAIL':
        if (!config.address || typeof config.address !== 'string') {
          throw new Error('Wymagany poprawny adres email');
        }
        break;
      case 'SMS':
        if (!config.phone_number || typeof config.phone_number !== 'string') {
          throw new Error('Wymagany numer telefonu');
        }
        break;
      case 'SLACK':
        if (!config.webhook_url || !String(config.webhook_url).startsWith('https://hooks.slack.com/')) {
          throw new Error('Wymagany poprawny webhook Slack');
        }
        break;
      case 'WEBHOOK':
        if (!config.url || !config.secret) {
          throw new Error('Wymagany URL i secret dla webhook');
        }
        break;
    }
  }

  async createSubscription(data: {
    userId: string;
    channel: NotificationChannel;
    channelConfig: Record<string, unknown>;
    minSeverity: AlertSeverity;
    eventTypes: string[] | null;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    quietHoursTimezone?: string;
    digestMode: boolean;
    digestFrequency?: string;
  }): Promise<{ id: string }> {
    const id = uuidv4();

    const query = `
      INSERT INTO notification_subscriptions (
        id, user_id, channel, channel_config,
        min_severity, event_types,
        quiet_hours_start, quiet_hours_end, quiet_hours_timezone,
        digest_mode, digest_frequency
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `;

    await this.db.query(query, [
      id,
      data.userId,
      data.channel,
      JSON.stringify(data.channelConfig),
      data.minSeverity,
      data.eventTypes,
      data.quietHoursStart || null,
      data.quietHoursEnd || null,
      data.quietHoursTimezone || 'Europe/Warsaw',
      data.digestMode,
      data.digestFrequency || 'daily'
    ]);

    return { id };
  }

  async updateSubscription(
    id: string,
    userId: string,
    updates: Partial<{
      channelConfig: Record<string, unknown>;
      minSeverity: AlertSeverity;
      eventTypes: string[] | null;
      quietHoursStart: string | null;
      quietHoursEnd: string | null;
      digestMode: boolean;
    }>
  ): Promise<void> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.channelConfig !== undefined) {
      setClauses.push(`channel_config = $${paramIndex++}`);
      values.push(JSON.stringify(updates.channelConfig));
    }
    if (updates.minSeverity !== undefined) {
      setClauses.push(`min_severity = $${paramIndex++}`);
      values.push(updates.minSeverity);
    }
    if (updates.eventTypes !== undefined) {
      setClauses.push(`event_types = $${paramIndex++}`);
      values.push(updates.eventTypes);
    }
    if (updates.quietHoursStart !== undefined) {
      setClauses.push(`quiet_hours_start = $${paramIndex++}`);
      values.push(updates.quietHoursStart);
    }
    if (updates.quietHoursEnd !== undefined) {
      setClauses.push(`quiet_hours_end = $${paramIndex++}`);
      values.push(updates.quietHoursEnd);
    }
    if (updates.digestMode !== undefined) {
      setClauses.push(`digest_mode = $${paramIndex++}`);
      values.push(updates.digestMode);
    }

    values.push(id, userId);

    const query = `
      UPDATE notification_subscriptions
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
    `;

    const result = await this.db.query(query, values);
    if (result.rowCount === 0) {
      throw new Error('Subskrypcja nie została znaleziona');
    }
  }

  async deleteSubscription(id: string, userId: string): Promise<void> {
    const query = `
      DELETE FROM notification_subscriptions
      WHERE id = $1 AND user_id = $2
    `;
    const result = await this.db.query(query, [id, userId]);

    if (result.rowCount === 0) {
      throw new Error('Subskrypcja nie została znaleziona');
    }
  }

  async sendTestNotification(subscriptionId: string, userId: string): Promise<void> {
    const query = `
      SELECT *
      FROM notification_subscriptions
      WHERE id = $1 AND user_id = $2
    `;
    const result = await this.db.query(query, [subscriptionId, userId]);

    if (result.rows.length === 0) {
      throw new Error('Subskrypcja nie została znaleziona');
    }

    const subscription = result.rows[0];

    const testPayload: NotificationPayload = {
      subscriptionId,
      userId,
      channel: subscription.channel,
      channelConfig: subscription.channel_config,
      subject: '[TEST] KsięgowaCRM - Powiadomienie testowe',
      body: 'To jest testowe powiadomienie z systemu KsięgowaCRM. Jeśli je otrzymałeś, konfiguracja jest poprawna.',
      metadata: {
        isTest: true,
        timestamp: new Date().toISOString()
      }
    };

    await this.sendNotification(testPayload);
  }

  // -------------------------
  // Notification Queue & Sending
  // -------------------------
  private async queueNotifications(event: SecurityEvent): Promise<void> {
    // Get matching subscriptions
    const query = `
      SELECT *
      FROM notification_subscriptions
      WHERE is_enabled = true
        AND (
          min_severity = 'LOW'
          OR (min_severity = 'MEDIUM' AND $1 IN ('MEDIUM', 'HIGH', 'CRITICAL'))
          OR (min_severity = 'HIGH' AND $1 IN ('HIGH', 'CRITICAL'))
          OR (min_severity = 'CRITICAL' AND $1 = 'CRITICAL')
        )
        AND (event_types IS NULL OR $2 = ANY(event_types))
    `;

    const result = await this.db.query(query, [event.severity, event.eventType]);

    for (const subscription of result.rows) {
      // Check quiet hours
      if (this.isInQuietHours(subscription)) {
        continue;
      }

      const payload: NotificationPayload = {
        subscriptionId: subscription.id,
        userId: subscription.user_id,
        channel: subscription.channel,
        channelConfig: subscription.channel_config,
        subject: this.buildSubject(event),
        body: this.buildBody(event),
        bodyHtml: this.buildHtmlBody(event),
        auditLogId: event.id,
        metadata: {
          eventType: event.eventType,
          severity: event.severity
        }
      };

      if (subscription.digest_mode) {
        await this.queueForDigest(payload, subscription.digest_frequency);
      } else {
        await this.queueNotification(payload);
      }
    }
  }

  private isInQuietHours(subscription: any): boolean {
    if (!subscription.quiet_hours_start || !subscription.quiet_hours_end) {
      return false;
    }

    const now = new Date();
    const [startHour, startMin] = subscription.quiet_hours_start.split(':').map(Number);
    const [endHour, endMin] = subscription.quiet_hours_end.split(':').map(Number);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Quiet hours span midnight
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  private buildSubject(event: SecurityEvent): string {
    const severityPrefix = event.severity === 'CRITICAL' ? '🚨 ' :
                          event.severity === 'HIGH' ? '⚠️ ' :
                          event.severity === 'MEDIUM' ? '📢 ' : '';

    const eventTitles: Record<string, string> = {
      LOGIN_FAILED: 'Nieudana próba logowania',
      LOGIN_SUCCESS: 'Nowe logowanie',
      ACCOUNT_LOCKED: 'Konto zablokowane',
      MFA_DISABLED: 'MFA wyłączone',
      TAMPERING_ATTEMPT: 'Próba manipulacji',
      NEW_COUNTRY_LOGIN: 'Logowanie z nowego kraju',
      OFF_HOURS_ADMIN_ACCESS: 'Dostęp poza godzinami'
    };

    const title = eventTitles[event.eventType] || event.eventType;
    return `${severityPrefix}[KsięgowaCRM] ${title}`;
  }

  private buildBody(event: SecurityEvent): string {
    const lines = [
      `Typ zdarzenia: ${event.eventType}`,
      `Ważność: ${event.severity}`,
      `Data: ${new Date(event.timestamp).toLocaleString('pl-PL')}`,
      '',
      'Szczegóły:',
      `- Adres IP: ${event.actor.ipAddress}`,
      event.actor.geoCountry ? `- Lokalizacja: ${event.actor.geoCity || ''}, ${event.actor.geoCountry}` : '',
      event.actor.userId ? `- ID użytkownika: ${event.actor.userId}` : '',
      '',
      'Sprawdź szczegóły w panelu administracyjnym.',
      `${process.env.APP_URL}/admin/audit-logs/${event.id}`
    ];

    return lines.filter(Boolean).join('\n');
  }

  private buildHtmlBody(event: SecurityEvent): string {
    const severityColors: Record<AlertSeverity, string> = {
      CRITICAL: '#dc2626',
      HIGH: '#ea580c',
      MEDIUM: '#ca8a04',
      LOW: '#16a34a'
    };

    return `
      <!DOCTYPE html>
      <html lang="pl">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${severityColors[event.severity]}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .footer { background: #1f2937; color: #9ca3af; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; }
          .btn { display: inline-block; background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; }
          .details { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
          .details dt { font-weight: 600; color: #374151; }
          .details dd { margin: 0 0 10px 0; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Alert bezpieczeństwa</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">${event.eventType} - ${event.severity}</p>
          </div>
          <div class="content">
            <p>Wykryto zdarzenie bezpieczeństwa w systemie KsięgowaCRM.</p>
            <div class="details">
              <dl>
                <dt>Typ zdarzenia</dt>
                <dd>${event.eventType}</dd>
                <dt>Data i czas</dt>
                <dd>${new Date(event.timestamp).toLocaleString('pl-PL')}</dd>
                <dt>Adres IP</dt>
                <dd>${event.actor.ipAddress}</dd>
                ${event.actor.geoCountry ? `
                <dt>Lokalizacja</dt>
                <dd>${event.actor.geoCity || ''}, ${event.actor.geoCountry}</dd>
                ` : ''}
                ${event.actor.userId ? `
                <dt>ID użytkownika</dt>
                <dd>${event.actor.userId}</dd>
                ` : ''}
              </dl>
            </div>
            <p style="text-align: center;">
              <a href="${process.env.APP_URL}/admin/audit-logs/${event.id}" class="btn">
                Zobacz szczegóły
              </a>
            </p>
          </div>
          <div class="footer">
            <p style="margin: 0;">© ${new Date().getFullYear()} KsięgowaCRM</p>
            <p style="margin: 5px 0 0 0; font-size: 12px;">
              Otrzymujesz tę wiadomość, ponieważ subskrybujesz alerty bezpieczeństwa.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private async queueNotification(payload: NotificationPayload): Promise<void> {
    const id = uuidv4();

    const query = `
      INSERT INTO notification_queue (
        id, subscription_id, user_id, channel,
        alert_id, audit_log_id,
        subject, body, body_html, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    await this.db.query(query, [
      id,
      payload.subscriptionId,
      payload.userId,
      payload.channel,
      payload.alertId || null,
      payload.auditLogId || null,
      payload.subject,
      payload.body,
      payload.bodyHtml || null,
      JSON.stringify(payload.metadata)
    ]);

    // Process immediately for real-time delivery
    await this.processNotification(id);
  }

  private async queueForDigest(payload: NotificationPayload, frequency: string): Promise<void> {
    // Add to Redis sorted set for digest processing
    const digestKey = `digest:${payload.userId}:${payload.channel}:${frequency}`;
    await this.redis.zadd(digestKey, Date.now(), JSON.stringify(payload));
    await this.redis.expire(digestKey, 86400 * 7); // 7 days
  }

  private async processNotification(notificationId: string): Promise<void> {
    const query = `
      SELECT nq.*, ns.channel_config
      FROM notification_queue nq
      JOIN notification_subscriptions ns ON nq.subscription_id = ns.id
      WHERE nq.id = $1 AND nq.status = 'PENDING'
    `;

    const result = await this.db.query(query, [notificationId]);
    if (result.rows.length === 0) return;

    const notification = result.rows[0];

    try {
      await this.sendNotification({
        subscriptionId: notification.subscription_id,
        userId: notification.user_id,
        channel: notification.channel,
        channelConfig: notification.channel_config,
        subject: notification.subject,
        body: notification.body,
        bodyHtml: notification.body_html,
        metadata: notification.metadata
      });

      await this.db.query(`
        UPDATE notification_queue
        SET status = 'DELIVERED', delivered_at = NOW(), attempts = attempts + 1
        WHERE id = $1
      `, [notificationId]);

    } catch (error) {
      const attempts = notification.attempts + 1;
      const maxAttempts = notification.max_attempts;

      await this.db.query(`
        UPDATE notification_queue
        SET
          status = $1,
          attempts = $2,
          last_attempt_at = NOW(),
          last_error = $3
        WHERE id = $4
      `, [
        attempts >= maxAttempts ? 'FAILED' : 'PENDING',
        attempts,
        (error as Error).message,
        notificationId
      ]);

      if (attempts < maxAttempts) {
        // Schedule retry with exponential backoff
        setTimeout(() => {
          this.processNotification(notificationId);
        }, Math.pow(2, attempts) * 1000);
      }
    }
  }

  private async sendNotification(payload: NotificationPayload): Promise<void> {
    switch (payload.channel) {
      case 'EMAIL':
        await this.sendEmail(payload);
        break;
      case 'SMS':
        await this.sendSms(payload);
        break;
      case 'PUSH':
        await this.sendPush(payload);
        break;
      case 'SLACK':
        await this.sendSlack(payload);
        break;
      case 'TEAMS':
        await this.sendTeams(payload);
        break;
      case 'WEBHOOK':
        await this.sendWebhook(payload);
        break;
    }
  }

  private async sendEmail(payload: NotificationPayload): Promise<void> {
    const config = payload.channelConfig as { address: string };

    await this.emailTransport.sendMail({
      from: `"KsięgowaCRM" <${process.env.SMTP_FROM}>`,
      to: config.address,
      subject: payload.subject,
      text: payload.body,
      html: payload.bodyHtml
    });
  }

  private async sendSms(payload: NotificationPayload): Promise<void> {
    if (!this.twilioClient) {
      throw new Error('SMS service not configured');
    }

    const config = payload.channelConfig as { phone_number: string; country_code: string };

    await this.twilioClient.messages.create({
      body: payload.body.substring(0, 160), // SMS limit
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `${config.country_code}${config.phone_number}`
    });
  }

  private async sendPush(payload: NotificationPayload): Promise<void> {
    const config = payload.channelConfig as { device_token: string; platform: string };

    const pushPayload = {
      title: payload.subject,
      body: payload.body.substring(0, 200),
      data: payload.metadata
    };

    if (config.platform === 'web') {
      await webpush.sendNotification(
        JSON.parse(config.device_token),
        JSON.stringify(pushPayload)
      );
    } else {
      // For iOS/Android, use Firebase Cloud Messaging
      // Implementation depends on FCM setup
    }
  }

  private async sendSlack(payload: NotificationPayload): Promise<void> {
    const config = payload.channelConfig as { webhook_url: string; channel?: string };

    const severityColors: Record<string, string> = {
      CRITICAL: '#dc2626',
      HIGH: '#ea580c',
      MEDIUM: '#ca8a04',
      LOW: '#16a34a'
    };

    const slackPayload = {
      channel: config.channel,
      attachments: [{
        color: severityColors[(payload.metadata as any).severity] || '#3b82f6',
        title: payload.subject,
        text: payload.body,
        footer: 'KsięgowaCRM Security',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    await axios.post(config.webhook_url, slackPayload);
  }

  private async sendTeams(payload: NotificationPayload): Promise<void> {
    const config = payload.channelConfig as { webhook_url: string };

    const teamsPayload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '0076D7',
      summary: payload.subject,
      sections: [{
        activityTitle: payload.subject,
        facts: [
          { name: 'Treść', value: payload.body }
        ],
        markdown: true
      }]
    };

    await axios.post(config.webhook_url, teamsPayload);
  }

  private async sendWebhook(payload: NotificationPayload): Promise<void> {
    const config = payload.channelConfig as { url: string; secret: string; headers?: Record<string, string> };

    const body = JSON.stringify({
      event: (payload.metadata as any).eventType,
      severity: (payload.metadata as any).severity,
      subject: payload.subject,
      body: payload.body,
      timestamp: new Date().toISOString(),
      metadata: payload.metadata
    });

    const signature = crypto
      .createHmac('sha256', config.secret)
      .update(body)
      .digest('hex');

    await axios.post(config.url, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
        ...config.headers
      }
    });
  }

  // -------------------------
  // Custom Alert Rules
  // -------------------------
  async listAlertRules(): Promise<any[]> {
    const query = `SELECT * FROM custom_alert_rules ORDER BY created_at DESC`;
    const result = await this.db.query(query);

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      eventTypes: row.event_types,
      conditionOperator: row.condition_operator,
      conditionThreshold: row.condition_threshold,
      conditionWindowMinutes: row.condition_window_minutes,
      severity: row.severity,
      isEnabled: row.is_enabled,
      lastTriggeredAt: row.last_triggered_at?.toISOString() || null,
      triggerCount: row.trigger_count
    }));
  }

  async createAlertRule(data: any): Promise<{ id: string }> {
    const id = uuidv4();

    const query = `
      INSERT INTO custom_alert_rules (
        id, name, description, event_types,
        condition_operator, condition_threshold, condition_window_minutes, condition_group_by,
        severity, auto_block_ip, auto_lock_account, notification_channels,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `;

    await this.db.query(query, [
      id,
      data.name,
      data.description || null,
      data.eventTypes,
      data.conditionOperator,
      data.conditionThreshold,
      data.conditionWindowMinutes,
      data.conditionGroupBy || null,
      data.severity,
      data.autoBlockIp,
      data.autoLockAccount,
      data.notificationChannels,
      data.createdBy
    ]);

    return { id };
  }

  private async checkCustomAlertRules(event: SecurityEvent): Promise<void> {
    const query = `
      SELECT *
      FROM custom_alert_rules
      WHERE is_enabled = true
        AND $1 = ANY(event_types)
    `;

    const rules = await this.db.query(query, [event.eventType]);

    for (const rule of rules.rows) {
      const isTriggered = await this.evaluateAlertRule(rule, event);

      if (isTriggered) {
        await this.triggerCustomAlert(rule, event);
      }
    }
  }

  private async evaluateAlertRule(rule: any, event: SecurityEvent): Promise<boolean> {
    const windowStart = new Date(Date.now() - rule.condition_window_minutes * 60 * 1000);

    let query: string;
    let values: unknown[];

    switch (rule.condition_operator) {
      case 'COUNT':
        query = `
          SELECT COUNT(*) as count
          FROM auth_audit_logs
          WHERE event_type = ANY($1)
            AND created_at > $2
            ${rule.condition_group_by === 'ip' ? 'AND actor_ip_address = $3' : ''}
            ${rule.condition_group_by === 'user' ? 'AND actor_user_id = $3' : ''}
        `;
        values = [rule.event_types, windowStart];
        if (rule.condition_group_by) {
          values.push(rule.condition_group_by === 'ip' ? event.actor.ipAddress : event.actor.userId);
        }
        break;

      case 'UNIQUE':
        query = `
          SELECT COUNT(DISTINCT ${rule.condition_group_by === 'ip' ? 'actor_ip_address' : 'actor_user_id'}) as count
          FROM auth_audit_logs
          WHERE event_type = ANY($1)
            AND created_at > $2
        `;
        values = [rule.event_types, windowStart];
        break;

      default:
        return false;
    }

    const result = await this.db.query(query, values);
    const count = parseInt(result.rows[0].count, 10);

    return count >= rule.condition_threshold;
  }

  private async triggerCustomAlert(rule: any, event: SecurityEvent): Promise<void> {
    // Update rule statistics
    await this.db.query(`
      UPDATE custom_alert_rules
      SET last_triggered_at = NOW(), trigger_count = trigger_count + 1
      WHERE id = $1
    `, [rule.id]);

    // Create security alert
    const alertId = uuidv4();
    await this.db.query(`
      INSERT INTO security_alerts (
        id, alert_type, severity, title, description,
        audit_log_ids, target_user_id, target_ip_address,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      alertId,
      `CUSTOM_RULE_${rule.name}`,
      rule.severity,
      `Alert: ${rule.name}`,
      rule.description,
      [event.id],
      event.actor.userId,
      event.actor.ipAddress,
      JSON.stringify({
        ruleId: rule.id,
        ruleName: rule.name,
        eventType: event.eventType
      })
    ]);

    // Execute auto-actions
    if (rule.auto_block_ip) {
      await this.blockIp(event.actor.ipAddress);
    }
    if (rule.auto_lock_account && event.actor.userId) {
      await this.lockAccount(event.actor.userId);
    }

    // Publish event for notifications
    await this.publishEvent({
      ...event,
      eventType: `CUSTOM_ALERT_${rule.name}`,
      severity: rule.severity
    });
  }

  private async blockIp(ipAddress: string): Promise<void> {
    await this.redis.sadd('blocked:ips', ipAddress);
    await this.redis.expire(`blocked:ips:${ipAddress}`, 86400); // 24 hours
  }

  private async lockAccount(userId: string): Promise<void> {
    await this.db.query(`
      UPDATE users
      SET status = 'locked', locked_at = NOW(), locked_reason = 'SECURITY_ALERT'
      WHERE id = $1
    `, [userId]);
  }

  // -------------------------
  // Prometheus Metrics
  // -------------------------
  async getPrometheusMetrics(): Promise<string> {
    const metrics: string[] = [];

    // Security events total
    const eventsQuery = `
      SELECT event_type, result, COUNT(*) as count
      FROM auth_audit_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY event_type, result
    `;
    const eventsResult = await this.db.query(eventsQuery);

    metrics.push('# HELP auth_security_events_total Total security events');
    metrics.push('# TYPE auth_security_events_total counter');
    for (const row of eventsResult.rows) {
      metrics.push(`auth_security_events_total{event_type="${row.event_type}",result="${row.result}"} ${row.count}`);
    }

    // Active alerts gauge
    const alertsQuery = `
      SELECT severity, COUNT(*) as count
      FROM security_alerts
      WHERE status NOT IN ('RESOLVED', 'FALSE_POSITIVE')
      GROUP BY severity
    `;
    const alertsResult = await this.db.query(alertsQuery);

    metrics.push('# HELP auth_alerts_active Current active alerts');
    metrics.push('# TYPE auth_alerts_active gauge');
    for (const row of alertsResult.rows) {
      metrics.push(`auth_alerts_active{severity="${row.severity}"} ${row.count}`);
    }

    // Failed logins counter
    const failedLoginsQuery = `
      SELECT COUNT(*) as count
      FROM auth_audit_logs
      WHERE event_type = 'LOGIN_FAILED'
        AND created_at > NOW() - INTERVAL '1 hour'
    `;
    const failedResult = await this.db.query(failedLoginsQuery);

    metrics.push('# HELP auth_failed_logins_total Failed login attempts in last hour');
    metrics.push('# TYPE auth_failed_logins_total counter');
    metrics.push(`auth_failed_logins_total ${failedResult.rows[0].count}`);

    // Blocked IPs
    const blockedCount = await this.redis.scard('blocked:ips');

    metrics.push('# HELP auth_blocked_ips_total Currently blocked IP addresses');
    metrics.push('# TYPE auth_blocked_ips_total gauge');
    metrics.push(`auth_blocked_ips_total ${blockedCount}`);

    return metrics.join('\n');
  }

  // -------------------------
  // Escalation Rules
  // -------------------------
  async listEscalationRules(): Promise<any[]> {
    const query = `SELECT * FROM escalation_rules ORDER BY created_at DESC`;
    const result = await this.db.query(query);

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      minSeverity: row.min_severity,
      eventTypes: row.event_types,
      levels: row.levels,
      isEnabled: row.is_enabled
    }));
  }

  async createEscalationRule(data: any): Promise<{ id: string }> {
    const id = uuidv4();

    const query = `
      INSERT INTO escalation_rules (
        id, name, description, min_severity, event_types, levels, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

    await this.db.query(query, [
      id,
      data.name,
      data.description || null,
      data.minSeverity,
      data.eventTypes || null,
      JSON.stringify(data.levels),
      data.createdBy
    ]);

    return { id };
  }

  async toggleAlertRule(id: string, isEnabled: boolean): Promise<void> {
    await this.db.query(`
      UPDATE custom_alert_rules SET is_enabled = $1, updated_at = NOW() WHERE id = $2
    `, [isEnabled, id]);
  }

  async updateAlertRule(id: string, updates: any): Promise<void> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fields = ['name', 'description', 'event_types', 'condition_operator',
                   'condition_threshold', 'condition_window_minutes', 'severity',
                   'auto_block_ip', 'auto_lock_account', 'notification_channels'];

    for (const field of fields) {
      const camelField = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (updates[camelField] !== undefined) {
        setClauses.push(`${field} = $${paramIndex++}`);
        values.push(updates[camelField]);
      }
    }

    values.push(id);

    await this.db.query(`
      UPDATE custom_alert_rules SET ${setClauses.join(', ')} WHERE id = $${paramIndex}
    `, values);
  }

  async deleteAlertRule(id: string): Promise<void> {
    await this.db.query(`DELETE FROM custom_alert_rules WHERE id = $1`, [id]);
  }

  async registerPushToken(userId: string, token: string, platform: string): Promise<void> {
    // Check if subscription exists
    const existing = await this.db.query(`
      SELECT id FROM notification_subscriptions
      WHERE user_id = $1 AND channel = 'PUSH' AND channel_config->>'device_token' = $2
    `, [userId, token]);

    if (existing.rows.length === 0) {
      await this.createSubscription({
        userId,
        channel: 'PUSH',
        channelConfig: { device_token: token, platform },
        minSeverity: 'HIGH',
        eventTypes: null,
        digestMode: false
      });
    }
  }
}
```

---

## 🧪 Test Specification

### Unit Tests

```typescript
// src/server/services/__tests__/security-events.service.test.ts
import { SecurityEventsService } from '../security-events.service';

describe('SecurityEventsService', () => {
  let service: SecurityEventsService;
  let mockDb: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockDb = createMockPool();
    mockRedis = createMockRedis();
    service = new SecurityEventsService(mockDb, mockRedis);
  });

  describe('getDashboardMetrics', () => {
    it('should return all dashboard metrics', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ severity: 'HIGH', count: '5' }] }) // alerts
        .mockResolvedValueOnce({ rows: [] }) // events
        .mockResolvedValueOnce({ rows: [] }) // threats
        .mockResolvedValueOnce({ rows: [] }) // geo
        .mockResolvedValueOnce({ rows: [{ avg_acknowledge_minutes: '10' }] }); // response

      const metrics = await service.getDashboardMetrics();

      expect(metrics.activeAlerts).toBeDefined();
      expect(metrics.activeAlerts.high).toBe(5);
    });
  });

  describe('notification delivery', () => {
    it('should send email notification', async () => {
      const sendMailMock = jest.fn().mockResolvedValue({});
      (service as any).emailTransport = { sendMail: sendMailMock };

      await (service as any).sendEmail({
        channelConfig: { address: 'test@example.com' },
        subject: 'Test',
        body: 'Test body',
        bodyHtml: '<p>Test</p>'
      });

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Test'
        })
      );
    });

    it('should respect quiet hours', () => {
      const subscription = {
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00'
      };

      // Test during quiet hours (23:00)
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T23:00:00'));

      const isQuiet = (service as any).isInQuietHours(subscription);
      expect(isQuiet).toBe(true);

      // Test outside quiet hours (10:00)
      jest.setSystemTime(new Date('2024-01-01T10:00:00'));
      const isNotQuiet = (service as any).isInQuietHours(subscription);
      expect(isNotQuiet).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('custom alert rules', () => {
    it('should trigger alert when threshold exceeded', async () => {
      const rule = {
        id: 'rule-1',
        event_types: ['LOGIN_FAILED'],
        condition_operator: 'COUNT',
        condition_threshold: 5,
        condition_window_minutes: 60,
        severity: 'HIGH'
      };

      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '10' }] });

      const isTriggered = await (service as any).evaluateAlertRule(rule, {
        eventType: 'LOGIN_FAILED',
        actor: { ipAddress: '192.168.1.1' }
      });

      expect(isTriggered).toBe(true);
    });

    it('should not trigger when below threshold', async () => {
      const rule = {
        event_types: ['LOGIN_FAILED'],
        condition_operator: 'COUNT',
        condition_threshold: 10,
        condition_window_minutes: 60
      };

      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const isTriggered = await (service as any).evaluateAlertRule(rule, {
        eventType: 'LOGIN_FAILED',
        actor: { ipAddress: '192.168.1.1' }
      });

      expect(isTriggered).toBe(false);
    });
  });

  describe('Prometheus metrics', () => {
    it('should generate valid Prometheus format', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ event_type: 'LOGIN_FAILED', result: 'FAILURE', count: '10' }] })
        .mockResolvedValueOnce({ rows: [{ severity: 'HIGH', count: '3' }] })
        .mockResolvedValueOnce({ rows: [{ count: '25' }] });

      mockRedis.scard.mockResolvedValue(5);

      const metrics = await service.getPrometheusMetrics();

      expect(metrics).toContain('auth_security_events_total');
      expect(metrics).toContain('auth_alerts_active');
      expect(metrics).toContain('auth_failed_logins_total');
      expect(metrics).toContain('auth_blocked_ips_total');
    });
  });
});
```

### E2E Tests

```typescript
// e2e/security-events.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Security Events & Alerts', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display real-time security dashboard', async ({ page }) => {
    await page.goto('/admin/security/dashboard');

    // Check all widgets are visible
    await expect(page.locator('[data-testid="active-alerts-widget"]')).toBeVisible();
    await expect(page.locator('[data-testid="events-timeline-widget"]')).toBeVisible();
    await expect(page.locator('[data-testid="geographic-map-widget"]')).toBeVisible();
    await expect(page.locator('[data-testid="top-threats-widget"]')).toBeVisible();
  });

  test('should configure email notifications', async ({ page }) => {
    await page.goto('/admin/security/notifications');

    // Add email subscription
    await page.click('[data-testid="add-subscription"]');
    await page.click('[data-testid="channel-EMAIL"]');
    await page.fill('[data-testid="email-address"]', 'security@example.com');
    await page.selectOption('[data-testid="min-severity"]', 'HIGH');
    await page.click('[data-testid="save-subscription"]');

    // Verify subscription created
    await expect(page.locator('[data-testid="subscription-list"]')).toContainText('security@example.com');
  });

  test('should test notification delivery', async ({ page }) => {
    await page.goto('/admin/security/notifications');

    // Click test button on existing subscription
    await page.click('[data-testid="subscription-row"]:first-child [data-testid="test-btn"]');

    // Wait for success message
    await expect(page.locator('[data-testid="toast-success"]')).toContainText('Testowe powiadomienie wysłane');
  });

  test('should create custom alert rule', async ({ page }) => {
    await page.goto('/admin/security/rules');

    await page.click('[data-testid="add-rule"]');

    // Fill rule form
    await page.fill('[data-testid="rule-name"]', 'Test Rule');
    await page.click('[data-testid="event-type-LOGIN_FAILED"]');
    await page.fill('[data-testid="threshold"]', '5');
    await page.selectOption('[data-testid="window"]', '60');
    await page.selectOption('[data-testid="severity"]', 'HIGH');
    await page.click('[data-testid="save-rule"]');

    // Verify rule created
    await expect(page.locator('[data-testid="rules-list"]')).toContainText('Test Rule');
  });

  test('should configure escalation rules', async ({ page }) => {
    await page.goto('/admin/security/escalation');

    await page.click('[data-testid="add-escalation"]');

    // Configure levels
    await page.fill('[data-testid="rule-name"]', 'Critical Escalation');
    await page.selectOption('[data-testid="min-severity"]', 'CRITICAL');

    // Level 1
    await page.fill('[data-testid="level-0-delay"]', '0');
    await page.click('[data-testid="level-0-channel-EMAIL"]');

    // Level 2
    await page.click('[data-testid="add-level"]');
    await page.fill('[data-testid="level-1-delay"]', '15');
    await page.click('[data-testid="level-1-channel-SMS"]');

    await page.click('[data-testid="save-escalation"]');

    await expect(page.locator('[data-testid="escalation-list"]')).toContainText('Critical Escalation');
  });

  test('should export Prometheus metrics', async ({ page, request }) => {
    const response = await request.get('/api/metrics', {
      headers: { Authorization: `Bearer ${await getAdminToken()}` }
    });

    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('auth_security_events_total');
    expect(body).toContain('auth_alerts_active');
  });
});
```

---

## 🔐 Security Checklist

- [ ] Webhook secrets are at least 32 characters
- [ ] HMAC signature validates webhook deliveries
- [ ] Phone numbers are validated before SMS delivery
- [ ] Email addresses are validated before delivery
- [ ] Slack webhook URLs are validated (hooks.slack.com)
- [ ] Push tokens are stored securely
- [ ] Notification content doesn't expose sensitive data
- [ ] Failed delivery attempts are logged
- [ ] Rate limiting on notification delivery
- [ ] Quiet hours respect user timezone

---

## 📋 Audit Events from This Story

| Event | Trigger | Data |
|-------|---------|------|
| `SUBSCRIPTION_CREATED` | New notification subscription | channel, severity |
| `SUBSCRIPTION_UPDATED` | Subscription modified | changes |
| `SUBSCRIPTION_DELETED` | Subscription removed | subscription_id |
| `ALERT_RULE_CREATED` | Custom rule created | rule details |
| `ALERT_RULE_TRIGGERED` | Rule threshold exceeded | rule_id, count |
| `ESCALATION_LEVEL_INCREASED` | Alert escalated | alert_id, level |
| `NOTIFICATION_SENT` | Notification delivered | channel, alert_id |
| `NOTIFICATION_FAILED` | Delivery failed | channel, error |
| `IP_BLOCKED` | Auto-block triggered | ip_address |
| `ACCOUNT_LOCKED_AUTO` | Auto-lock triggered | user_id |

---

## 📝 Implementation Notes

1. **Redis Pub/Sub** for real-time event streaming
2. **Exponential backoff** for failed notification retries
3. **Digest mode** batches notifications for configured frequency
4. **Twilio** for SMS (requires account setup)
5. **Web Push** uses VAPID keys for browser notifications
6. **Webhook signatures** use HMAC-SHA256
7. **Prometheus** endpoint at `/api/metrics` for Grafana
8. **Escalation worker** runs as separate cron job

---

*Story last updated: December 2024*
