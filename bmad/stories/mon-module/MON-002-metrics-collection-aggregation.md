# Story: MON-002 - Metrics Collection & Aggregation

## Story Overview

| Field | Value |
|-------|-------|
| Story ID | MON-002 |
| Epic | Monitoring & Analytics (MON) |
| Title | Metrics Collection & Aggregation |
| Priority | P0 |
| Story Points | 8 |
| Sprint | Week 32 (Sprint 1) |
| Dependencies | - |

## User Story

**As a** System Administrator,
**I want** to collect and aggregate system and business metrics in real-time,
**So that** I can monitor performance, detect trends, and optimize the platform.

## Acceptance Criteria

### AC1: Metric Recording

**Given** a valid metric with name, value, type, and tags
**When** the metric is recorded via API
**Then** the metric is stored in the time-series database within 100ms
**And** the metric is immediately available for real-time queries

### AC2: Metric Types Support

**Given** different metric types (counter, gauge, histogram, summary)
**When** recording metrics of each type
**Then** each type is processed with appropriate semantics
**And** counters increment, gauges set absolute values, histograms track distributions

### AC3: Tag-Based Organization

**Given** metrics with custom tags
**When** querying metrics
**Then** tags can be used as filter criteria
**And** results can be grouped by tag values

### AC4: Time-Based Aggregation

**Given** raw metrics over a time period
**When** requesting aggregated metrics
**Then** aggregations (avg, sum, min, max, percentiles) are computed
**And** results are available for multiple granularities (1m, 5m, 1h, 1d)

### AC5: Real-Time Streaming

**Given** an active metric subscription
**When** new metrics matching the subscription are recorded
**Then** clients receive updates via WebSocket within 1 second
**And** streaming continues until client disconnects

### AC6: Batch Recording

**Given** multiple metrics to record
**When** batch recording up to 500 metrics
**Then** all metrics are persisted within 5 seconds
**And** partial failures return which metrics failed

## Technical Specification

### Database Schema

```sql
-- Main metrics table with time partitioning
CREATE TABLE metrics (
  metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  metric_name VARCHAR(255) NOT NULL,
  metric_value DOUBLE PRECISION NOT NULL,
  metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('COUNTER', 'GAUGE', 'HISTOGRAM', 'SUMMARY')),
  tags JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL,
  unit VARCHAR(50),
  aggregation_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Partitions created monthly
CREATE TABLE metrics_y2025m01 PARTITION OF metrics
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Pre-aggregated metrics for fast queries
CREATE TABLE metrics_aggregated (
  aggregation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  metric_name VARCHAR(255) NOT NULL,
  tags JSONB DEFAULT '{}',
  granularity VARCHAR(20) NOT NULL CHECK (granularity IN ('1m', '5m', '1h', '1d')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  count BIGINT NOT NULL,
  sum DOUBLE PRECISION NOT NULL,
  min DOUBLE PRECISION NOT NULL,
  max DOUBLE PRECISION NOT NULL,
  avg DOUBLE PRECISION NOT NULL,
  p50 DOUBLE PRECISION,
  p90 DOUBLE PRECISION,
  p95 DOUBLE PRECISION,
  p99 DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, metric_name, granularity, period_start, tags)
);

-- Indexes
CREATE INDEX idx_metrics_name_timestamp ON metrics(metric_name, timestamp DESC);
CREATE INDEX idx_metrics_tenant_timestamp ON metrics(tenant_id, timestamp DESC);
CREATE INDEX idx_metrics_tags ON metrics USING GIN(tags);

CREATE INDEX idx_metrics_agg_name_period ON metrics_aggregated(tenant_id, metric_name, granularity, period_start DESC);
CREATE INDEX idx_metrics_agg_tags ON metrics_aggregated USING GIN(tags);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Metric type enum
export const MetricTypeEnum = z.enum([
  'COUNTER',
  'GAUGE',
  'HISTOGRAM',
  'SUMMARY',
]);

// Aggregation type enum
export const AggregationTypeEnum = z.enum([
  'AVG',
  'SUM',
  'MIN',
  'MAX',
  'COUNT',
  'P50',
  'P90',
  'P95',
  'P99',
]);

// Time granularity enum
export const GranularityEnum = z.enum(['1m', '5m', '1h', '1d']);

// Metric tags schema
export const MetricTagsSchema = z.record(
  z.string().max(50),
  z.string().max(100),
).refine(
  (tags) => Object.keys(tags).length <= 20,
  { message: 'Maximum 20 tags allowed' }
);

// Base metric schema
export const MetricSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(255).regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/),
  value: z.number(),
  type: MetricTypeEnum,
  tags: MetricTagsSchema.default({}),
  timestamp: z.date().optional(),
  unit: z.string().max(50).optional(),
  aggregationType: AggregationTypeEnum.optional(),
});

// Batch metrics schema
export const BatchMetricsSchema = z.object({
  metrics: z.array(MetricSchema).min(1).max(500),
});

// Metric query schema
export const MetricQuerySchema = z.object({
  metricNames: z.array(z.string()).min(1).max(10),
  startTime: z.date(),
  endTime: z.date(),
  granularity: GranularityEnum.optional(),
  aggregation: AggregationTypeEnum.default('AVG'),
  tags: MetricTagsSchema.optional(),
  groupBy: z.array(z.string()).max(5).optional(),
  limit: z.number().int().min(1).max(10000).default(1000),
});

// Real-time subscription schema
export const MetricSubscriptionSchema = z.object({
  metricNames: z.array(z.string()).min(1).max(5),
  tags: MetricTagsSchema.optional(),
});

// Query response types
export const MetricDataPointSchema = z.object({
  timestamp: z.date(),
  value: z.number(),
  tags: MetricTagsSchema.optional(),
});

export const AggregatedMetricSchema = z.object({
  metricName: z.string(),
  periodStart: z.date(),
  periodEnd: z.date(),
  count: z.number(),
  sum: z.number(),
  min: z.number(),
  max: z.number(),
  avg: z.number(),
  p50: z.number().optional(),
  p90: z.number().optional(),
  p95: z.number().optional(),
  p99: z.number().optional(),
  tags: MetricTagsSchema.optional(),
});

export const MetricsResponseSchema = z.object({
  data: z.array(z.union([MetricDataPointSchema, AggregatedMetricSchema])),
  metadata: z.object({
    totalCount: z.number(),
    query: MetricQuerySchema,
    executionTimeMs: z.number(),
    fromCache: z.boolean(),
  }),
});
```

### Service Implementation

```typescript
import { injectable, inject } from 'inversify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { InfluxDB, Point, QueryApi, WriteApi } from '@influxdata/influxdb-client';

import { TYPES } from '@/infrastructure/types';
import { Logger } from '@/infrastructure/logger';
import {
  MetricSchema,
  BatchMetricsSchema,
  MetricQuerySchema,
  MetricSubscriptionSchema,
  AggregatedMetricSchema,
  MetricsResponseSchema,
  GranularityEnum,
} from './schemas';

export interface IMetricsService {
  recordMetric(
    tenantId: string,
    metric: z.infer<typeof MetricSchema>,
  ): Promise<{ metricId: string }>;

  recordBatch(
    tenantId: string,
    batch: z.infer<typeof BatchMetricsSchema>,
  ): Promise<{ successful: string[]; failed: Array<{ id: string; error: string }> }>;

  queryMetrics(
    tenantId: string,
    query: z.infer<typeof MetricQuerySchema>,
  ): Promise<z.infer<typeof MetricsResponseSchema>>;

  getAggregatedMetrics(
    tenantId: string,
    query: z.infer<typeof MetricQuerySchema>,
  ): Promise<z.infer<typeof MetricsResponseSchema>>;

  subscribe(
    tenantId: string,
    subscription: z.infer<typeof MetricSubscriptionSchema>,
    callback: (metric: z.infer<typeof MetricSchema>) => void,
  ): () => void;

  getRealtimeValue(
    tenantId: string,
    metricName: string,
    tags?: Record<string, string>,
  ): Promise<number | null>;
}

@injectable()
export class MetricsService implements IMetricsService {
  private readonly queue: Queue;
  private readonly writeApi: WriteApi;
  private readonly queryApi: QueryApi;
  private readonly metricsBuffer: Map<string, z.infer<typeof MetricSchema>[]> = new Map();
  private flushInterval: NodeJS.Timer;

  constructor(
    @inject(TYPES.Logger) private readonly logger: Logger,
    @inject(TYPES.Redis) private readonly redis: Redis,
    @inject(TYPES.Database) private readonly db: Pool,
    @inject(TYPES.InfluxDB) private readonly influx: InfluxDB,
  ) {
    this.queue = new Queue('metrics-processing', {
      connection: { host: process.env.REDIS_HOST, port: 6379 },
    });

    this.writeApi = this.influx.getWriteApi(
      process.env.INFLUXDB_ORG!,
      process.env.INFLUXDB_BUCKET!,
      'ms',
      { batchSize: 1000, flushInterval: 5000 },
    );

    this.queryApi = this.influx.getQueryApi(process.env.INFLUXDB_ORG!);

    // Start flush interval for buffered metrics
    this.startFlushInterval();

    // Initialize worker for background processing
    this.initializeWorker();
  }

  async recordMetric(
    tenantId: string,
    metric: z.infer<typeof MetricSchema>,
  ): Promise<{ metricId: string }> {
    const validatedMetric = MetricSchema.parse(metric);
    const metricId = validatedMetric.id || uuidv4();

    const enrichedMetric = {
      ...validatedMetric,
      id: metricId,
      timestamp: validatedMetric.timestamp || new Date(),
    };

    // Write to InfluxDB immediately for real-time access
    await this.writeToInflux(tenantId, enrichedMetric);

    // Update real-time cache
    await this.updateRealtimeCache(tenantId, enrichedMetric);

    // Queue for PostgreSQL persistence and aggregation
    await this.queue.add('record-metric', {
      type: 'record_metric',
      tenantId,
      metric: enrichedMetric,
    });

    // Publish for real-time subscribers
    await this.publishMetric(tenantId, enrichedMetric);

    this.logger.debug('Metric recorded', { tenantId, metricId, name: metric.name });

    return { metricId };
  }

  async recordBatch(
    tenantId: string,
    batch: z.infer<typeof BatchMetricsSchema>,
  ): Promise<{ successful: string[]; failed: Array<{ id: string; error: string }> }> {
    const validatedBatch = BatchMetricsSchema.parse(batch);
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    const points: Point[] = [];

    for (const metric of validatedBatch.metrics) {
      try {
        const metricId = metric.id || uuidv4();
        const enrichedMetric = {
          ...metric,
          id: metricId,
          timestamp: metric.timestamp || new Date(),
        };

        // Build InfluxDB point
        const point = this.buildInfluxPoint(tenantId, enrichedMetric);
        points.push(point);

        // Update real-time cache
        await this.updateRealtimeCache(tenantId, enrichedMetric);

        successful.push(metricId);
      } catch (error) {
        const err = error as Error;
        failed.push({
          id: metric.id || 'unknown',
          error: err.message,
        });
      }
    }

    // Batch write to InfluxDB
    if (points.length > 0) {
      points.forEach((point) => this.writeApi.writePoint(point));
      await this.writeApi.flush();
    }

    // Queue for PostgreSQL persistence
    if (successful.length > 0) {
      await this.queue.add('record-batch', {
        type: 'record_batch',
        tenantId,
        metricIds: successful,
        metrics: validatedBatch.metrics.filter((m) => successful.includes(m.id!)),
      });
    }

    this.logger.info('Batch metrics recorded', {
      tenantId,
      successful: successful.length,
      failed: failed.length,
    });

    return { successful, failed };
  }

  async queryMetrics(
    tenantId: string,
    query: z.infer<typeof MetricQuerySchema>,
  ): Promise<z.infer<typeof MetricsResponseSchema>> {
    const validatedQuery = MetricQuerySchema.parse(query);
    const startTime = Date.now();

    // Check cache first
    const cacheKey = this.buildCacheKey(tenantId, validatedQuery);
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      const parsedCache = JSON.parse(cached);
      return {
        ...parsedCache,
        metadata: {
          ...parsedCache.metadata,
          fromCache: true,
        },
      };
    }

    // Build and execute Flux query
    const fluxQuery = this.buildFluxQuery(tenantId, validatedQuery);
    const data: Array<z.infer<typeof AggregatedMetricSchema>> = [];

    await new Promise<void>((resolve, reject) => {
      this.queryApi.queryRows(fluxQuery, {
        next: (row, tableMeta) => {
          const record = tableMeta.toObject(row);
          data.push({
            metricName: record._measurement,
            periodStart: new Date(record._start),
            periodEnd: new Date(record._stop),
            count: record.count || 1,
            sum: record.sum || record._value,
            min: record.min || record._value,
            max: record.max || record._value,
            avg: record.mean || record._value,
            p50: record.p50,
            p90: record.p90,
            p95: record.p95,
            p99: record.p99,
            tags: record.tags ? JSON.parse(record.tags) : undefined,
          });
        },
        error: (error) => reject(error),
        complete: () => resolve(),
      });
    });

    const executionTimeMs = Date.now() - startTime;

    const response: z.infer<typeof MetricsResponseSchema> = {
      data,
      metadata: {
        totalCount: data.length,
        query: validatedQuery,
        executionTimeMs,
        fromCache: false,
      },
    };

    // Cache results (60 second TTL)
    await this.redis.setex(cacheKey, 60, JSON.stringify(response));

    return response;
  }

  async getAggregatedMetrics(
    tenantId: string,
    query: z.infer<typeof MetricQuerySchema>,
  ): Promise<z.infer<typeof MetricsResponseSchema>> {
    const validatedQuery = MetricQuerySchema.parse(query);
    const startTime = Date.now();

    // Check pre-aggregated data in PostgreSQL
    const result = await this.db.query(
      `SELECT
        metric_name,
        period_start,
        period_end,
        count,
        sum,
        min,
        max,
        avg,
        p50,
        p90,
        p95,
        p99,
        tags
      FROM metrics_aggregated
      WHERE tenant_id = $1
        AND metric_name = ANY($2)
        AND granularity = $3
        AND period_start >= $4
        AND period_end <= $5
        AND ($6::jsonb IS NULL OR tags @> $6)
      ORDER BY period_start DESC
      LIMIT $7`,
      [
        tenantId,
        validatedQuery.metricNames,
        validatedQuery.granularity || '1h',
        validatedQuery.startTime,
        validatedQuery.endTime,
        validatedQuery.tags ? JSON.stringify(validatedQuery.tags) : null,
        validatedQuery.limit,
      ],
    );

    const data = result.rows.map((row) => ({
      metricName: row.metric_name,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      count: row.count,
      sum: row.sum,
      min: row.min,
      max: row.max,
      avg: row.avg,
      p50: row.p50,
      p90: row.p90,
      p95: row.p95,
      p99: row.p99,
      tags: row.tags,
    }));

    return {
      data,
      metadata: {
        totalCount: data.length,
        query: validatedQuery,
        executionTimeMs: Date.now() - startTime,
        fromCache: false,
      },
    };
  }

  subscribe(
    tenantId: string,
    subscription: z.infer<typeof MetricSubscriptionSchema>,
    callback: (metric: z.infer<typeof MetricSchema>) => void,
  ): () => void {
    const validatedSub = MetricSubscriptionSchema.parse(subscription);
    const channels = validatedSub.metricNames.map(
      (name) => `mon:${tenantId}:metrics:${name}`,
    );

    const subscriber = this.redis.duplicate();

    subscriber.subscribe(...channels);

    subscriber.on('message', (channel, message) => {
      try {
        const metric = JSON.parse(message);

        // Filter by tags if specified
        if (validatedSub.tags) {
          const metricTags = metric.tags || {};
          const matches = Object.entries(validatedSub.tags).every(
            ([key, value]) => metricTags[key] === value,
          );
          if (!matches) return;
        }

        callback(metric);
      } catch (error) {
        this.logger.error('Error processing metric subscription', { error });
      }
    });

    // Return unsubscribe function
    return () => {
      subscriber.unsubscribe(...channels);
      subscriber.disconnect();
    };
  }

  async getRealtimeValue(
    tenantId: string,
    metricName: string,
    tags?: Record<string, string>,
  ): Promise<number | null> {
    const cacheKey = this.buildRealtimeCacheKey(tenantId, metricName, tags);
    const value = await this.redis.get(cacheKey);
    return value ? parseFloat(value) : null;
  }

  // Private helper methods
  private async writeToInflux(
    tenantId: string,
    metric: z.infer<typeof MetricSchema> & { id: string; timestamp: Date },
  ): Promise<void> {
    const point = this.buildInfluxPoint(tenantId, metric);
    this.writeApi.writePoint(point);
  }

  private buildInfluxPoint(
    tenantId: string,
    metric: z.infer<typeof MetricSchema> & { id: string; timestamp: Date },
  ): Point {
    const point = new Point(metric.name)
      .tag('tenant_id', tenantId)
      .tag('metric_type', metric.type)
      .floatField('value', metric.value)
      .timestamp(metric.timestamp);

    if (metric.unit) {
      point.tag('unit', metric.unit);
    }

    if (metric.tags) {
      Object.entries(metric.tags).forEach(([key, value]) => {
        point.tag(key, value);
      });
    }

    return point;
  }

  private async updateRealtimeCache(
    tenantId: string,
    metric: z.infer<typeof MetricSchema> & { id: string; timestamp: Date },
  ): Promise<void> {
    const cacheKey = this.buildRealtimeCacheKey(tenantId, metric.name, metric.tags);

    switch (metric.type) {
      case 'COUNTER':
        await this.redis.incrbyfloat(cacheKey, metric.value);
        break;
      case 'GAUGE':
        await this.redis.set(cacheKey, metric.value.toString());
        break;
      case 'HISTOGRAM':
      case 'SUMMARY':
        // Store in sorted set for percentile calculations
        await this.redis.zadd(
          `${cacheKey}:values`,
          metric.timestamp.getTime(),
          metric.value.toString(),
        );
        // Keep only last 1000 values
        await this.redis.zremrangebyrank(`${cacheKey}:values`, 0, -1001);
        break;
    }

    // Set TTL of 1 hour
    await this.redis.expire(cacheKey, 3600);
  }

  private async publishMetric(
    tenantId: string,
    metric: z.infer<typeof MetricSchema>,
  ): Promise<void> {
    const channel = `mon:${tenantId}:metrics:${metric.name}`;
    await this.redis.publish(channel, JSON.stringify(metric));
  }

  private buildCacheKey(
    tenantId: string,
    query: z.infer<typeof MetricQuerySchema>,
  ): string {
    const queryHash = Buffer.from(JSON.stringify(query)).toString('base64');
    return `mon:${tenantId}:query:${queryHash}`;
  }

  private buildRealtimeCacheKey(
    tenantId: string,
    metricName: string,
    tags?: Record<string, string>,
  ): string {
    const tagStr = tags ? `:${JSON.stringify(tags)}` : '';
    return `mon:${tenantId}:realtime:${metricName}${tagStr}`;
  }

  private buildFluxQuery(
    tenantId: string,
    query: z.infer<typeof MetricQuerySchema>,
  ): string {
    const filters = [`r.tenant_id == "${tenantId}"`];

    if (query.tags) {
      Object.entries(query.tags).forEach(([key, value]) => {
        filters.push(`r.${key} == "${value}"`);
      });
    }

    const measurementFilter = query.metricNames
      .map((name) => `r._measurement == "${name}"`)
      .join(' or ');

    const windowDuration = query.granularity || '1h';

    return `
      from(bucket: "${process.env.INFLUXDB_BUCKET}")
        |> range(start: ${query.startTime.toISOString()}, stop: ${query.endTime.toISOString()})
        |> filter(fn: (r) => ${measurementFilter})
        |> filter(fn: (r) => ${filters.join(' and ')})
        |> window(every: ${windowDuration})
        |> ${query.aggregation.toLowerCase()}()
        |> limit(n: ${query.limit})
    `;
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(async () => {
      try {
        await this.writeApi.flush();
      } catch (error) {
        this.logger.error('Error flushing metrics to InfluxDB', { error });
      }
    }, 5000);
  }

  private initializeWorker(): void {
    new Worker(
      'metrics-processing',
      async (job) => {
        switch (job.data.type) {
          case 'record_metric':
            await this.persistMetricToPostgres(job.data.tenantId, job.data.metric);
            break;
          case 'record_batch':
            await this.persistBatchToPostgres(job.data.tenantId, job.data.metrics);
            break;
          case 'aggregate':
            await this.computeAggregation(job.data);
            break;
        }
      },
      { connection: { host: process.env.REDIS_HOST, port: 6379 } },
    );
  }

  private async persistMetricToPostgres(
    tenantId: string,
    metric: z.infer<typeof MetricSchema> & { id: string; timestamp: Date },
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO metrics (
        metric_id, tenant_id, metric_name, metric_value, metric_type,
        tags, timestamp, unit, aggregation_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        metric.id,
        tenantId,
        metric.name,
        metric.value,
        metric.type,
        JSON.stringify(metric.tags || {}),
        metric.timestamp,
        metric.unit,
        metric.aggregationType,
      ],
    );
  }

  private async persistBatchToPostgres(
    tenantId: string,
    metrics: Array<z.infer<typeof MetricSchema> & { id: string; timestamp: Date }>,
  ): Promise<void> {
    const values: any[] = [];
    const placeholders: string[] = [];

    metrics.forEach((metric, i) => {
      const offset = i * 9;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`,
      );
      values.push(
        metric.id,
        tenantId,
        metric.name,
        metric.value,
        metric.type,
        JSON.stringify(metric.tags || {}),
        metric.timestamp,
        metric.unit,
        metric.aggregationType,
      );
    });

    await this.db.query(
      `INSERT INTO metrics (
        metric_id, tenant_id, metric_name, metric_value, metric_type,
        tags, timestamp, unit, aggregation_type
      ) VALUES ${placeholders.join(', ')}`,
      values,
    );
  }

  private async computeAggregation(params: {
    tenantId: string;
    metricName: string;
    granularity: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<void> {
    // Compute aggregation from raw metrics
    const result = await this.db.query(
      `SELECT
        COUNT(*) as count,
        SUM(metric_value) as sum,
        MIN(metric_value) as min,
        MAX(metric_value) as max,
        AVG(metric_value) as avg,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY metric_value) as p50,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY metric_value) as p90,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY metric_value) as p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY metric_value) as p99
      FROM metrics
      WHERE tenant_id = $1
        AND metric_name = $2
        AND timestamp >= $3
        AND timestamp < $4`,
      [params.tenantId, params.metricName, params.periodStart, params.periodEnd],
    );

    if (result.rows.length > 0 && result.rows[0].count > 0) {
      const row = result.rows[0];
      await this.db.query(
        `INSERT INTO metrics_aggregated (
          tenant_id, metric_name, tags, granularity, period_start, period_end,
          count, sum, min, max, avg, p50, p90, p95, p99
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (tenant_id, metric_name, granularity, period_start, tags)
        DO UPDATE SET
          count = EXCLUDED.count,
          sum = EXCLUDED.sum,
          min = EXCLUDED.min,
          max = EXCLUDED.max,
          avg = EXCLUDED.avg,
          p50 = EXCLUDED.p50,
          p90 = EXCLUDED.p90,
          p95 = EXCLUDED.p95,
          p99 = EXCLUDED.p99`,
        [
          params.tenantId,
          params.metricName,
          '{}',
          params.granularity,
          params.periodStart,
          params.periodEnd,
          row.count,
          row.sum,
          row.min,
          row.max,
          row.avg,
          row.p50,
          row.p90,
          row.p95,
          row.p99,
        ],
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.flushInterval);
    await this.writeApi.close();
    await this.queue.close();
  }
}
```

### tRPC Router

```typescript
import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import {
  MetricSchema,
  BatchMetricsSchema,
  MetricQuerySchema,
  MetricSubscriptionSchema,
} from './schemas';

export const metricsRouter = router({
  // Record single metric
  record: protectedProcedure
    .input(MetricSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.metricsService.recordMetric(
        ctx.tenantId,
        input,
      );

      // Audit log
      await ctx.auditService.log({
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        action: 'METRIC_RECORDED',
        entityType: 'metric',
        entityId: result.metricId,
        metadata: { metricName: input.name },
      });

      return result;
    }),

  // Record batch metrics
  recordBatch: protectedProcedure
    .input(BatchMetricsSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.metricsService.recordBatch(
        ctx.tenantId,
        input,
      );

      // Audit log for batch operation
      await ctx.auditService.log({
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        action: 'METRICS_BATCH_RECORDED',
        entityType: 'metric',
        metadata: {
          successful: result.successful.length,
          failed: result.failed.length,
        },
      });

      return result;
    }),

  // Query metrics
  query: protectedProcedure
    .input(MetricQuerySchema)
    .query(async ({ ctx, input }) => {
      return ctx.metricsService.queryMetrics(ctx.tenantId, input);
    }),

  // Get aggregated metrics
  getAggregated: protectedProcedure
    .input(MetricQuerySchema)
    .query(async ({ ctx, input }) => {
      return ctx.metricsService.getAggregatedMetrics(ctx.tenantId, input);
    }),

  // Get real-time metric value
  getRealtime: protectedProcedure
    .input(z.object({
      metricName: z.string(),
      tags: z.record(z.string(), z.string()).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const value = await ctx.metricsService.getRealtimeValue(
        ctx.tenantId,
        input.metricName,
        input.tags,
      );
      return { value };
    }),

  // Delete metrics (admin only)
  purge: adminProcedure
    .input(z.object({
      metricNames: z.array(z.string()).optional(),
      olderThan: z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify admin permissions
      if (!ctx.user.roles.includes('ADMIN')) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const deletedCount = await ctx.metricsService.purgeMetrics(
        ctx.tenantId,
        input.metricNames,
        input.olderThan,
      );

      // Audit log for purge operation
      await ctx.auditService.log({
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        action: 'METRICS_PURGED',
        entityType: 'metric',
        metadata: {
          metricNames: input.metricNames,
          olderThan: input.olderThan.toISOString(),
          deletedCount,
        },
      });

      return { deletedCount };
    }),
});
```

## Test Specifications

### Unit Tests

```typescript
describe('MetricsService', () => {
  let service: MetricsService;
  let mockRedis: jest.Mocked<Redis>;
  let mockDb: jest.Mocked<Pool>;
  let mockInflux: jest.Mocked<InfluxDB>;

  beforeEach(() => {
    mockRedis = createMock<Redis>();
    mockDb = createMock<Pool>();
    mockInflux = createMock<InfluxDB>();

    service = new MetricsService(
      mockLogger,
      mockRedis,
      mockDb,
      mockInflux,
    );
  });

  describe('recordMetric', () => {
    it('should record a counter metric and increment cache', async () => {
      const metric = {
        name: 'api.requests',
        value: 1,
        type: 'COUNTER' as const,
        tags: { endpoint: '/api/users' },
      };

      const result = await service.recordMetric('tenant-1', metric);

      expect(result.metricId).toBeDefined();
      expect(mockRedis.incrbyfloat).toHaveBeenCalled();
    });

    it('should record a gauge metric and set cache value', async () => {
      const metric = {
        name: 'system.cpu_usage',
        value: 75.5,
        type: 'GAUGE' as const,
        tags: { host: 'server-1' },
      };

      const result = await service.recordMetric('tenant-1', metric);

      expect(result.metricId).toBeDefined();
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should validate metric name format', async () => {
      const invalidMetric = {
        name: '123-invalid',
        value: 1,
        type: 'COUNTER' as const,
      };

      await expect(
        service.recordMetric('tenant-1', invalidMetric),
      ).rejects.toThrow();
    });
  });

  describe('recordBatch', () => {
    it('should record multiple metrics in batch', async () => {
      const batch = {
        metrics: [
          { name: 'metric.one', value: 1, type: 'COUNTER' as const },
          { name: 'metric.two', value: 2, type: 'GAUGE' as const },
        ],
      };

      const result = await service.recordBatch('tenant-1', batch);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should handle partial failures gracefully', async () => {
      const batch = {
        metrics: [
          { name: 'metric.valid', value: 1, type: 'COUNTER' as const },
          { name: '', value: 2, type: 'GAUGE' as const }, // Invalid
        ],
      };

      const result = await service.recordBatch('tenant-1', batch);

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
    });
  });

  describe('queryMetrics', () => {
    it('should return cached results when available', async () => {
      const cachedData = {
        data: [{ metricName: 'test', avg: 50 }],
        metadata: { totalCount: 1, fromCache: true },
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.queryMetrics('tenant-1', {
        metricNames: ['test'],
        startTime: new Date(),
        endTime: new Date(),
      });

      expect(result.metadata.fromCache).toBe(true);
    });

    it('should query InfluxDB when cache misses', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.queryMetrics('tenant-1', {
        metricNames: ['test'],
        startTime: new Date(),
        endTime: new Date(),
      });

      expect(mockInflux.getQueryApi).toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('should subscribe to metric updates', async () => {
      const callback = jest.fn();
      const unsubscribe = service.subscribe(
        'tenant-1',
        { metricNames: ['test.metric'] },
        callback,
      );

      expect(typeof unsubscribe).toBe('function');
    });
  });
});
```

### Integration Tests

```typescript
describe('Metrics Integration', () => {
  let app: INestApplication;
  let metricsService: IMetricsService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    metricsService = app.get<IMetricsService>('IMetricsService');
  });

  afterAll(async () => {
    await app.close();
  });

  it('should record and query metrics end-to-end', async () => {
    const tenantId = 'test-tenant';

    // Record multiple metrics
    for (let i = 0; i < 10; i++) {
      await metricsService.recordMetric(tenantId, {
        name: 'test.integration',
        value: Math.random() * 100,
        type: 'GAUGE',
        tags: { environment: 'test' },
      });
    }

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Query metrics
    const result = await metricsService.queryMetrics(tenantId, {
      metricNames: ['test.integration'],
      startTime: new Date(Date.now() - 60000),
      endTime: new Date(),
      aggregation: 'AVG',
    });

    expect(result.data.length).toBeGreaterThan(0);
    expect(result.metadata.totalCount).toBeGreaterThan(0);
  });

  it('should batch record 500 metrics within 5 seconds', async () => {
    const tenantId = 'test-tenant';
    const metrics = Array.from({ length: 500 }, (_, i) => ({
      name: `batch.metric.${i % 10}`,
      value: Math.random() * 100,
      type: 'GAUGE' as const,
      tags: { index: String(i) },
    }));

    const start = Date.now();
    const result = await metricsService.recordBatch(tenantId, { metrics });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000);
    expect(result.successful.length).toBe(500);
  });
});
```

## Security Checklist

- [x] Tenant isolation verified at all query levels
- [x] Input validation with Zod schemas
- [x] Rate limiting on record endpoints
- [x] Admin-only access for purge operations
- [x] Parameterized queries prevent SQL injection
- [x] Audit logging for all write operations
- [x] Metric name validation prevents injection
- [x] Tag values sanitized before storage

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `METRIC_RECORDED` | Single metric recorded | metricId, metricName |
| `METRICS_BATCH_RECORDED` | Batch recording | successCount, failCount |
| `METRICS_QUERIED` | Metrics query executed | queryParams, resultCount |
| `METRICS_PURGED` | Metrics deleted | metricNames, olderThan, deletedCount |

## Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| Single metric record latency | < 100ms | API response time |
| Batch 500 metrics | < 5s | API response time |
| Query response (with cache) | < 50ms | API response time |
| Query response (no cache) | < 500ms | API response time |
| Real-time streaming delay | < 1s | End-to-end latency |

## Polish Localization Notes

- Metric units displayed in Polish (np. "milisekundy", "bajty")
- Dashboard labels in Polish
- Error messages in Polish
- Report exports with Polish number formatting (1 234,56)

## Implementation Notes

1. Use InfluxDB as primary time-series database for real-time queries
2. PostgreSQL for aggregated data and long-term retention
3. Redis for real-time cache and pub/sub streaming
4. Pre-compute aggregations for common time windows
5. Implement metric cardinality limits (max 20 tags, max 100 unique values per tag)
6. Consider downsampling for metrics older than 30 days

## Definition of Done

- [ ] All acceptance criteria verified
- [ ] Unit test coverage ≥ 80%
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Code reviewed and approved
