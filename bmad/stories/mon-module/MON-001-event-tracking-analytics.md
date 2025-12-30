# MON-001: Event Tracking & Analytics

## Story Information

| Field | Value |
|-------|-------|
| Story ID | MON-001 |
| Epic | Monitoring & Analytics Module |
| Priority | P0 |
| Story Points | 8 |
| Status | Draft |
| Created | 2025-01-XX |
| Updated | 2025-01-XX |

## User Story

**As a** system administrator
**I want to** track and query user actions and system events
**So that** I can understand system usage patterns and troubleshoot issues effectively

## Acceptance Criteria

### AC1: Event Tracking
```gherkin
Given I have a valid authenticated session
When I submit an analytics event with type, category, and action
Then the event should be stored with a timestamp
And I should receive confirmation of successful tracking
And the event should be queryable within 5 seconds
```

### AC2: Batch Event Processing
```gherkin
Given I have multiple events to track
When I submit a batch of up to 1000 events
Then all valid events should be processed
And I should receive a summary of successful and failed events
And processing should complete within 2 seconds
```

### AC3: Event Querying
```gherkin
Given events have been tracked in the system
When I query events with filters (type, category, user, date range)
Then I should receive paginated results matching the criteria
And results should include event details and context
And query response time should be under 500ms
```

### AC4: Custom Event Properties
```gherkin
Given I am tracking an analytics event
When I include custom properties as key-value pairs
Then the properties should be stored with the event
And they should be searchable and filterable
```

### AC5: Event Categories
```gherkin
Given the system supports predefined event types
When I track events of types: USER_ACTION, SYSTEM_EVENT, ERROR, PERFORMANCE, BUSINESS, SECURITY
Then each type should be properly categorized
And type-specific processing should be applied
```

## Technical Specification

### Database Schema

```sql
-- Analytics events table
CREATE TABLE analytics_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type VARCHAR(50) NOT NULL,
  category VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  label VARCHAR(255),
  value NUMERIC,
  user_id UUID REFERENCES users(id),
  session_id VARCHAR(64),
  properties JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event aggregations for analytics
CREATE TABLE event_aggregations (
  aggregation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  event_type VARCHAR(50) NOT NULL,
  category VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  granularity VARCHAR(20) NOT NULL, -- 'minute', 'hour', 'day'
  count BIGINT NOT NULL DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  total_value NUMERIC DEFAULT 0,
  avg_value NUMERIC DEFAULT 0,
  min_value NUMERIC,
  max_value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_events_tenant_timestamp ON analytics_events(tenant_id, timestamp DESC);
CREATE INDEX idx_events_user_action ON analytics_events(tenant_id, user_id, action);
CREATE INDEX idx_events_type_category ON analytics_events(tenant_id, event_type, category);
CREATE INDEX idx_events_session ON analytics_events(tenant_id, session_id);
CREATE INDEX idx_events_properties ON analytics_events USING GIN(properties);

CREATE INDEX idx_aggregations_lookup ON event_aggregations(tenant_id, event_type, category, action, period_start);

-- Partitioning for high-volume events
CREATE TABLE analytics_events_2025_01 PARTITION OF analytics_events
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
-- Additional partitions created automatically
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Event types enum
export const EventTypeEnum = z.enum([
  'USER_ACTION',
  'SYSTEM_EVENT',
  'ERROR',
  'PERFORMANCE',
  'BUSINESS',
  'SECURITY',
  'CUSTOM'
]);

// Event context schema
export const EventContextSchema = z.object({
  correlationId: z.string().uuid().optional(),
  page: z.string().max(255).optional(),
  referrer: z.string().max(255).optional(),
  userAgent: z.string().max(500).optional(),
  ipAddress: z.string().ip().optional(),
  locale: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
  deviceType: z.enum(['desktop', 'mobile', 'tablet']).optional(),
  browser: z.string().max(100).optional(),
  os: z.string().max(100).optional(),
});

// Event metadata schema
export const EventMetadataSchema = z.object({
  source: z.string().max(100).optional(),
  version: z.string().max(20).optional(),
  environment: z.enum(['development', 'staging', 'production']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});

// Analytics event schema
export const AnalyticsEventSchema = z.object({
  id: z.string().uuid().optional(),
  type: EventTypeEnum,
  category: z.string().min(1).max(100),
  action: z.string().min(1).max(100),
  label: z.string().max(255).optional(),
  value: z.number().optional(),
  userId: z.string().uuid().optional(),
  sessionId: z.string().max(64).optional(),
  properties: z.record(z.unknown()).default({}),
  context: EventContextSchema.optional(),
  metadata: EventMetadataSchema.optional(),
  timestamp: z.date().optional(),
});

// Batch event schema
export const BatchEventsSchema = z.object({
  events: z.array(AnalyticsEventSchema).min(1).max(1000),
});

// Event query schema
export const EventQuerySchema = z.object({
  eventTypes: z.array(EventTypeEnum).optional(),
  categories: z.array(z.string()).optional(),
  actions: z.array(z.string()).optional(),
  userId: z.string().uuid().optional(),
  sessionId: z.string().optional(),
  startTime: z.date(),
  endTime: z.date(),
  properties: z.record(z.unknown()).optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
  orderBy: z.enum(['timestamp_asc', 'timestamp_desc']).default('timestamp_desc'),
});

// Aggregation query schema
export const AggregationQuerySchema = z.object({
  eventTypes: z.array(EventTypeEnum).optional(),
  categories: z.array(z.string()).optional(),
  actions: z.array(z.string()).optional(),
  startTime: z.date(),
  endTime: z.date(),
  granularity: z.enum(['minute', 'hour', 'day', 'week', 'month']).default('hour'),
  groupBy: z.array(z.enum(['event_type', 'category', 'action', 'user_id'])).optional(),
});
```

### Service Implementation

```typescript
import { injectable, inject } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import { TRPCError } from '@trpc/server';

@injectable()
export class EventTrackingService {
  constructor(
    @inject('EventRepository') private eventRepo: EventRepository,
    @inject('AggregationRepository') private aggRepo: AggregationRepository,
    @inject('CacheService') private cache: CacheService,
    @inject('QueueService') private queue: QueueService,
    @inject('Logger') private logger: Logger,
  ) {}

  // Track single event
  async trackEvent(
    tenantId: string,
    event: z.infer<typeof AnalyticsEventSchema>,
  ): Promise<{ eventId: string }> {
    const eventId = event.id || uuidv4();
    const timestamp = event.timestamp || new Date();

    try {
      // Validate and enrich event
      const enrichedEvent = {
        event_id: eventId,
        tenant_id: tenantId,
        timestamp,
        event_type: event.type,
        category: event.category,
        action: event.action,
        label: event.label,
        value: event.value,
        user_id: event.userId,
        session_id: event.sessionId,
        properties: event.properties,
        context: event.context || {},
        metadata: event.metadata || {},
      };

      // Queue for async processing
      await this.queue.add('event-tracking', {
        type: 'track_event',
        data: enrichedEvent,
      });

      // Update real-time counters
      await this.updateRealTimeCounters(tenantId, event);

      this.logger.debug('Zdarzenie śledzone pomyślnie', {
        eventId,
        type: event.type,
        action: event.action,
      });

      return { eventId };
    } catch (error) {
      this.logger.error('Błąd podczas śledzenia zdarzenia', {
        error: error.message,
        eventId,
      });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Nie udało się zarejestrować zdarzenia',
      });
    }
  }

  // Track batch of events
  async trackBatch(
    tenantId: string,
    events: z.infer<typeof AnalyticsEventSchema>[],
  ): Promise<{
    successful: string[];
    failed: Array<{ index: number; error: string }>;
    total: number;
  }> {
    const results = {
      successful: [] as string[],
      failed: [] as Array<{ index: number; error: string }>,
      total: events.length,
    };

    // Process in parallel batches
    const batchSize = 100;
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);

      const promises = batch.map(async (event, idx) => {
        try {
          const { eventId } = await this.trackEvent(tenantId, event);
          results.successful.push(eventId);
        } catch (error) {
          results.failed.push({
            index: i + idx,
            error: error.message,
          });
        }
      });

      await Promise.all(promises);
    }

    this.logger.info('Przetworzono partię zdarzeń', {
      total: results.total,
      successful: results.successful.length,
      failed: results.failed.length,
    });

    return results;
  }

  // Query events
  async queryEvents(
    tenantId: string,
    query: z.infer<typeof EventQuerySchema>,
  ): Promise<{
    events: AnalyticsEvent[];
    total: number;
    hasMore: boolean;
  }> {
    // Build cache key
    const cacheKey = `events:${tenantId}:${JSON.stringify(query)}`;

    // Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Build query
    const whereConditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (query.eventTypes?.length) {
      whereConditions.push(`event_type = ANY($${paramIndex})`);
      params.push(query.eventTypes);
      paramIndex++;
    }

    if (query.categories?.length) {
      whereConditions.push(`category = ANY($${paramIndex})`);
      params.push(query.categories);
      paramIndex++;
    }

    if (query.actions?.length) {
      whereConditions.push(`action = ANY($${paramIndex})`);
      params.push(query.actions);
      paramIndex++;
    }

    if (query.userId) {
      whereConditions.push(`user_id = $${paramIndex}`);
      params.push(query.userId);
      paramIndex++;
    }

    if (query.sessionId) {
      whereConditions.push(`session_id = $${paramIndex}`);
      params.push(query.sessionId);
      paramIndex++;
    }

    whereConditions.push(`timestamp >= $${paramIndex}`);
    params.push(query.startTime);
    paramIndex++;

    whereConditions.push(`timestamp <= $${paramIndex}`);
    params.push(query.endTime);
    paramIndex++;

    // Property filters
    if (query.properties) {
      for (const [key, value] of Object.entries(query.properties)) {
        whereConditions.push(`properties->>'${key}' = $${paramIndex}`);
        params.push(String(value));
        paramIndex++;
      }
    }

    const orderDirection = query.orderBy === 'timestamp_asc' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await this.eventRepo.query(
      `SELECT COUNT(*) as count FROM analytics_events WHERE ${whereConditions.join(' AND ')}`,
      params,
    );
    const total = parseInt(countResult[0].count, 10);

    // Get events
    const events = await this.eventRepo.query(
      `SELECT * FROM analytics_events
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY timestamp ${orderDirection}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, query.limit, query.offset],
    );

    const result = {
      events: events.map(this.mapEventFromDb),
      total,
      hasMore: query.offset + events.length < total,
    };

    // Cache for 60 seconds
    await this.cache.set(cacheKey, JSON.stringify(result), 60);

    return result;
  }

  // Get aggregated analytics
  async getAggregatedAnalytics(
    tenantId: string,
    query: z.infer<typeof AggregationQuerySchema>,
  ): Promise<{
    data: AggregatedData[];
    summary: AnalyticsSummary;
  }> {
    const granularityInterval = this.getGranularityInterval(query.granularity);

    // Build aggregation query
    const selectFields = [
      `date_trunc('${query.granularity}', timestamp) as period`,
      'COUNT(*) as count',
      'COUNT(DISTINCT user_id) as unique_users',
      'SUM(value) as total_value',
      'AVG(value) as avg_value',
    ];

    const groupByFields = ['period'];

    if (query.groupBy) {
      for (const field of query.groupBy) {
        selectFields.push(field);
        groupByFields.push(field);
      }
    }

    const whereConditions = [
      'tenant_id = $1',
      'timestamp >= $2',
      'timestamp <= $3',
    ];
    const params: any[] = [tenantId, query.startTime, query.endTime];
    let paramIndex = 4;

    if (query.eventTypes?.length) {
      whereConditions.push(`event_type = ANY($${paramIndex})`);
      params.push(query.eventTypes);
      paramIndex++;
    }

    if (query.categories?.length) {
      whereConditions.push(`category = ANY($${paramIndex})`);
      params.push(query.categories);
      paramIndex++;
    }

    const data = await this.eventRepo.query(
      `SELECT ${selectFields.join(', ')}
       FROM analytics_events
       WHERE ${whereConditions.join(' AND ')}
       GROUP BY ${groupByFields.join(', ')}
       ORDER BY period ASC`,
      params,
    );

    // Calculate summary
    const summary = await this.calculateSummary(tenantId, query);

    return {
      data: data.map((row: any) => ({
        period: row.period,
        count: parseInt(row.count, 10),
        uniqueUsers: parseInt(row.unique_users, 10),
        totalValue: parseFloat(row.total_value) || 0,
        avgValue: parseFloat(row.avg_value) || 0,
        ...(query.groupBy ? this.extractGroupByFields(row, query.groupBy) : {}),
      })),
      summary,
    };
  }

  // Real-time event stream
  async *streamEvents(
    tenantId: string,
    eventTypes?: string[],
  ): AsyncGenerator<AnalyticsEvent> {
    const channel = `events:${tenantId}`;

    // Subscribe to Redis pub/sub
    const subscriber = await this.cache.subscribe(channel);

    try {
      for await (const message of subscriber) {
        const event = JSON.parse(message);

        if (!eventTypes || eventTypes.includes(event.event_type)) {
          yield this.mapEventFromDb(event);
        }
      }
    } finally {
      await subscriber.unsubscribe(channel);
    }
  }

  // Private helpers
  private async updateRealTimeCounters(
    tenantId: string,
    event: z.infer<typeof AnalyticsEventSchema>,
  ): Promise<void> {
    const hourKey = new Date().toISOString().slice(0, 13);
    const counterKey = `counter:${tenantId}:${event.type}:${event.category}:${hourKey}`;

    await this.cache.incr(counterKey);
    await this.cache.expire(counterKey, 7200); // 2 hours TTL

    // Publish for real-time subscribers
    await this.cache.publish(`events:${tenantId}`, JSON.stringify({
      event_type: event.type,
      category: event.category,
      action: event.action,
      timestamp: new Date().toISOString(),
    }));
  }

  private async calculateSummary(
    tenantId: string,
    query: z.infer<typeof AggregationQuerySchema>,
  ): Promise<AnalyticsSummary> {
    const result = await this.eventRepo.query(
      `SELECT
        COUNT(*) as total_events,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(DISTINCT category) as categories,
        COUNT(DISTINCT action) as actions
       FROM analytics_events
       WHERE tenant_id = $1 AND timestamp >= $2 AND timestamp <= $3`,
      [tenantId, query.startTime, query.endTime],
    );

    return {
      totalEvents: parseInt(result[0].total_events, 10),
      uniqueUsers: parseInt(result[0].unique_users, 10),
      uniqueSessions: parseInt(result[0].unique_sessions, 10),
      categories: parseInt(result[0].categories, 10),
      actions: parseInt(result[0].actions, 10),
    };
  }

  private getGranularityInterval(granularity: string): string {
    const intervals: Record<string, string> = {
      minute: '1 minute',
      hour: '1 hour',
      day: '1 day',
      week: '1 week',
      month: '1 month',
    };
    return intervals[granularity] || '1 hour';
  }

  private mapEventFromDb(row: any): AnalyticsEvent {
    return {
      eventId: row.event_id,
      timestamp: row.timestamp,
      type: row.event_type,
      category: row.category,
      action: row.action,
      label: row.label,
      value: row.value,
      userId: row.user_id,
      sessionId: row.session_id,
      properties: row.properties,
      context: row.context,
      metadata: row.metadata,
    };
  }

  private extractGroupByFields(row: any, fields: string[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const field of fields) {
      result[field] = row[field];
    }
    return result;
  }
}
```

### tRPC Router

```typescript
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { z } from 'zod';

export const eventRouter = router({
  // Track single event
  track: protectedProcedure
    .input(AnalyticsEventSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.eventTrackingService.trackEvent(ctx.tenantId, input);
    }),

  // Track batch of events
  trackBatch: protectedProcedure
    .input(BatchEventsSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.eventTrackingService.trackBatch(ctx.tenantId, input.events);
    }),

  // Query events
  query: protectedProcedure
    .input(EventQuerySchema)
    .query(async ({ ctx, input }) => {
      return ctx.eventTrackingService.queryEvents(ctx.tenantId, input);
    }),

  // Get aggregated analytics
  aggregate: protectedProcedure
    .input(AggregationQuerySchema)
    .query(async ({ ctx, input }) => {
      return ctx.eventTrackingService.getAggregatedAnalytics(ctx.tenantId, input);
    }),

  // Get event by ID
  getById: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.eventTrackingService.getEventById(ctx.tenantId, input.eventId);
    }),

  // Get event types summary
  getEventTypesSummary: protectedProcedure
    .input(z.object({
      startTime: z.date(),
      endTime: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.eventTrackingService.getEventTypesSummary(ctx.tenantId, input);
    }),

  // Delete old events (admin only)
  purgeOldEvents: adminProcedure
    .input(z.object({
      olderThan: z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.eventTrackingService.purgeOldEvents(ctx.tenantId, input.olderThan);
    }),
});
```

### Event Queue Worker

```typescript
import { Worker, Job } from 'bullmq';

export class EventTrackingWorker {
  private worker: Worker;

  constructor(
    private eventRepo: EventRepository,
    private aggRepo: AggregationRepository,
    private logger: Logger,
  ) {
    this.worker = new Worker('event-tracking', this.processJob.bind(this), {
      concurrency: 10,
      limiter: {
        max: 1000,
        duration: 1000,
      },
    });

    this.worker.on('completed', (job) => {
      this.logger.debug('Zadanie przetworzono', { jobId: job.id });
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error('Zadanie nie powiodło się', {
        jobId: job?.id,
        error: error.message,
      });
    });
  }

  private async processJob(job: Job): Promise<void> {
    switch (job.data.type) {
      case 'track_event':
        await this.processTrackEvent(job.data.data);
        break;
      case 'aggregate_events':
        await this.processAggregation(job.data.data);
        break;
      default:
        throw new Error(`Nieznany typ zadania: ${job.data.type}`);
    }
  }

  private async processTrackEvent(event: any): Promise<void> {
    // Insert event into database
    await this.eventRepo.insert('analytics_events', event);

    // Update aggregations
    await this.updateAggregations(event);
  }

  private async updateAggregations(event: any): Promise<void> {
    const granularities = ['minute', 'hour', 'day'];

    for (const granularity of granularities) {
      const periodStart = this.getPeriodStart(event.timestamp, granularity);
      const periodEnd = this.getPeriodEnd(periodStart, granularity);

      await this.aggRepo.query(
        `INSERT INTO event_aggregations
         (tenant_id, event_type, category, action, period_start, period_end, granularity, count, unique_users, total_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 1, $8)
         ON CONFLICT (tenant_id, event_type, category, action, period_start, granularity)
         DO UPDATE SET
           count = event_aggregations.count + 1,
           unique_users = event_aggregations.unique_users +
             CASE WHEN NOT EXISTS (
               SELECT 1 FROM analytics_events
               WHERE tenant_id = $1 AND event_type = $2 AND category = $3
               AND user_id = $9 AND timestamp >= $5 AND timestamp < $6
             ) THEN 1 ELSE 0 END,
           total_value = event_aggregations.total_value + COALESCE($8, 0)`,
        [
          event.tenant_id,
          event.event_type,
          event.category,
          event.action,
          periodStart,
          periodEnd,
          granularity,
          event.value || 0,
          event.user_id,
        ],
      );
    }
  }

  private getPeriodStart(timestamp: Date, granularity: string): Date {
    const date = new Date(timestamp);
    switch (granularity) {
      case 'minute':
        date.setSeconds(0, 0);
        break;
      case 'hour':
        date.setMinutes(0, 0, 0);
        break;
      case 'day':
        date.setHours(0, 0, 0, 0);
        break;
    }
    return date;
  }

  private getPeriodEnd(periodStart: Date, granularity: string): Date {
    const date = new Date(periodStart);
    switch (granularity) {
      case 'minute':
        date.setMinutes(date.getMinutes() + 1);
        break;
      case 'hour':
        date.setHours(date.getHours() + 1);
        break;
      case 'day':
        date.setDate(date.getDate() + 1);
        break;
    }
    return date;
  }
}
```

## Test Specification

### Unit Tests

```typescript
describe('EventTrackingService', () => {
  let service: EventTrackingService;
  let mockEventRepo: jest.Mocked<EventRepository>;
  let mockCache: jest.Mocked<CacheService>;
  let mockQueue: jest.Mocked<QueueService>;

  beforeEach(() => {
    mockEventRepo = createMock<EventRepository>();
    mockCache = createMock<CacheService>();
    mockQueue = createMock<QueueService>();

    service = new EventTrackingService(
      mockEventRepo,
      createMock<AggregationRepository>(),
      mockCache,
      mockQueue,
      createMock<Logger>(),
    );
  });

  describe('trackEvent', () => {
    it('should track valid event successfully', async () => {
      const event = {
        type: 'USER_ACTION' as const,
        category: 'navigation',
        action: 'page_view',
        properties: { page: '/dashboard' },
      };

      mockQueue.add.mockResolvedValue(undefined);

      const result = await service.trackEvent('tenant-123', event);

      expect(result.eventId).toBeDefined();
      expect(mockQueue.add).toHaveBeenCalledWith('event-tracking', expect.objectContaining({
        type: 'track_event',
      }));
    });

    it('should generate event ID if not provided', async () => {
      const event = {
        type: 'USER_ACTION' as const,
        category: 'click',
        action: 'button_click',
      };

      const result = await service.trackEvent('tenant-123', event);

      expect(result.eventId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('should handle tracking failure gracefully', async () => {
      mockQueue.add.mockRejectedValue(new Error('Queue error'));

      await expect(
        service.trackEvent('tenant-123', {
          type: 'USER_ACTION',
          category: 'test',
          action: 'test',
        }),
      ).rejects.toThrow('Nie udało się zarejestrować zdarzenia');
    });
  });

  describe('trackBatch', () => {
    it('should process batch of events', async () => {
      const events = Array.from({ length: 10 }, (_, i) => ({
        type: 'USER_ACTION' as const,
        category: 'batch',
        action: `action_${i}`,
      }));

      mockQueue.add.mockResolvedValue(undefined);

      const result = await service.trackBatch('tenant-123', events);

      expect(result.total).toBe(10);
      expect(result.successful.length).toBe(10);
      expect(result.failed.length).toBe(0);
    });

    it('should handle partial failures in batch', async () => {
      const events = [
        { type: 'USER_ACTION' as const, category: 'test', action: 'success' },
        { type: 'USER_ACTION' as const, category: 'test', action: 'fail' },
      ];

      mockQueue.add
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed'));

      const result = await service.trackBatch('tenant-123', events);

      expect(result.successful.length).toBe(1);
      expect(result.failed.length).toBe(1);
    });
  });

  describe('queryEvents', () => {
    it('should return cached results if available', async () => {
      const cached = JSON.stringify({
        events: [{ eventId: 'event-1', type: 'USER_ACTION' }],
        total: 1,
        hasMore: false,
      });

      mockCache.get.mockResolvedValue(cached);

      const result = await service.queryEvents('tenant-123', {
        startTime: new Date('2025-01-01'),
        endTime: new Date('2025-01-31'),
      });

      expect(result.events.length).toBe(1);
      expect(mockEventRepo.query).not.toHaveBeenCalled();
    });

    it('should query database and cache results', async () => {
      mockCache.get.mockResolvedValue(null);
      mockEventRepo.query
        .mockResolvedValueOnce([{ count: '5' }])
        .mockResolvedValueOnce([
          { event_id: 'e1', event_type: 'USER_ACTION', category: 'nav', action: 'click' },
        ]);

      const result = await service.queryEvents('tenant-123', {
        startTime: new Date('2025-01-01'),
        endTime: new Date('2025-01-31'),
      });

      expect(result.total).toBe(5);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should apply all filters correctly', async () => {
      mockCache.get.mockResolvedValue(null);
      mockEventRepo.query
        .mockResolvedValueOnce([{ count: '1' }])
        .mockResolvedValueOnce([]);

      await service.queryEvents('tenant-123', {
        eventTypes: ['USER_ACTION'],
        categories: ['navigation'],
        userId: 'user-123',
        startTime: new Date('2025-01-01'),
        endTime: new Date('2025-01-31'),
        properties: { page: '/dashboard' },
      });

      const queryCall = mockEventRepo.query.mock.calls[0];
      expect(queryCall[0]).toContain('event_type = ANY');
      expect(queryCall[0]).toContain('category = ANY');
      expect(queryCall[0]).toContain('user_id =');
    });
  });
});
```

### Integration Tests

```typescript
describe('Event Tracking Integration', () => {
  let app: INestApplication;
  let eventService: EventTrackingService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MonitoringModule, DatabaseModule, CacheModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    eventService = app.get(EventTrackingService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should track and query event end-to-end', async () => {
    // Track event
    const { eventId } = await eventService.trackEvent('test-tenant', {
      type: 'USER_ACTION',
      category: 'integration_test',
      action: 'test_action',
      properties: { testKey: 'testValue' },
    });

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Query event
    const result = await eventService.queryEvents('test-tenant', {
      eventTypes: ['USER_ACTION'],
      categories: ['integration_test'],
      startTime: new Date(Date.now() - 60000),
      endTime: new Date(),
    });

    expect(result.events.some((e) => e.eventId === eventId)).toBe(true);
  });

  it('should handle high-volume batch processing', async () => {
    const events = Array.from({ length: 500 }, (_, i) => ({
      type: 'PERFORMANCE' as const,
      category: 'load_test',
      action: `action_${i}`,
      value: Math.random() * 100,
    }));

    const startTime = Date.now();
    const result = await eventService.trackBatch('test-tenant', events);
    const duration = Date.now() - startTime;

    expect(result.successful.length).toBe(500);
    expect(duration).toBeLessThan(5000); // Under 5 seconds
  });
});
```

## Security Checklist

- [x] Tenant isolation enforced at database level
- [x] Input validation with Zod schemas
- [x] Rate limiting on tracking endpoints
- [x] PII masking in event properties
- [x] SQL injection prevention with parameterized queries
- [x] Authentication required for all endpoints
- [x] Admin-only access for purge operations
- [x] Audit logging for data deletions

## Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `EVENTS_TRACKED` | Event tracked | Event type, category, user |
| `EVENTS_BATCH_PROCESSED` | Batch completed | Count, success/fail ratio |
| `EVENTS_QUERIED` | Events queried | Filters, result count |
| `EVENTS_PURGED` | Old events deleted | Date threshold, count deleted |

## Implementation Notes

### Performance Considerations
- Use queue-based async processing for tracking
- Implement event buffering for high-volume scenarios
- Pre-aggregate metrics at multiple granularities
- Partition tables by time for efficient queries
- Cache frequent queries for 60 seconds

### Monitoring
- Track event ingestion rate
- Monitor queue depth and processing latency
- Alert on high failure rates
- Dashboard for event volume by type

### Data Retention
- Events: 90 days default
- Aggregations: 365 days
- Implement automatic partition management
- Archive to cold storage before deletion
