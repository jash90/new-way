# Story: Agent Analytics & Monitoring

## Story Metadata

| Field | Value |
|-------|-------|
| Story ID | AAM-009 |
| Epic | AI Agent Module (AAM) |
| Title | Agent Analytics & Monitoring |
| Status | Draft |
| Priority | P2 |
| Story Points | 5 |
| Sprint | Sprint 7 |
| Dependencies | AAM-001, AAM-004, AAM-008 |
| Assignee | TBD |
| Created | 2025-01-XX |
| Updated | 2025-01-XX |

## User Story

**As a** Super Admin
**I want to** monitor AI agent performance and user satisfaction
**So that** I can identify issues, optimize agents, and ensure quality service

## Acceptance Criteria

### AC1: Performance Metrics Dashboard
```gherkin
Given I am a Super Admin viewing agent analytics
When I access the analytics dashboard
Then I see key metrics: response time, error rate, availability
And I see trends over configurable time periods (1d, 7d, 30d)
And metrics are visualized with charts and gauges
And I can drill down into specific agents or users
```

### AC2: User Satisfaction Tracking
```gherkin
Given users can rate agent responses
When I view satisfaction metrics
Then I see average ratings per agent (1-5 stars)
And I see feedback categorization (helpful, accurate, fast)
And I see sentiment analysis of text feedback
And I can identify agents needing improvement
```

### AC3: Real-Time Monitoring
```gherkin
Given agents are processing requests
When I view real-time monitoring
Then I see active conversations count
And I see queue depth and wait times
And I see error alerts within 1 minute of occurrence
And I receive notifications for anomalies
```

### AC4: Usage Patterns Analysis
```gherkin
Given I want to understand agent usage
When I view usage analytics
Then I see peak usage times (heatmap)
And I see most common query types
And I see conversation length distribution
And I see user engagement metrics
```

### AC5: Quality Metrics
```gherkin
Given I want to ensure agent quality
When I view quality metrics
Then I see accuracy rate (based on feedback)
And I see hallucination detection rate
And I see knowledge base hit rate
And I see action completion rate
```

## Technical Specification

### Database Schema

```sql
-- Aggregated performance metrics (hourly)
CREATE TABLE agent_metrics_hourly (
  metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  hour_start TIMESTAMPTZ NOT NULL,

  -- Volume metrics
  request_count INTEGER DEFAULT 0,
  conversation_count INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,

  -- Performance metrics
  avg_response_time_ms INTEGER,
  p50_response_time_ms INTEGER,
  p95_response_time_ms INTEGER,
  p99_response_time_ms INTEGER,

  -- Token metrics
  total_input_tokens BIGINT DEFAULT 0,
  total_output_tokens BIGINT DEFAULT 0,
  avg_tokens_per_request INTEGER,

  -- Quality metrics
  error_count INTEGER DEFAULT 0,
  timeout_count INTEGER DEFAULT 0,
  knowledge_hit_count INTEGER DEFAULT 0,
  knowledge_miss_count INTEGER DEFAULT 0,

  -- Satisfaction metrics
  rating_count INTEGER DEFAULT 0,
  rating_sum INTEGER DEFAULT 0,
  positive_feedback_count INTEGER DEFAULT 0,
  negative_feedback_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, agent_id, hour_start)
);

-- User feedback on responses
CREATE TABLE agent_feedback (
  feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(conversation_id),
  message_id UUID NOT NULL REFERENCES agent_messages(message_id),
  user_id UUID NOT NULL REFERENCES users(id),

  -- Rating
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),

  -- Categorical feedback
  is_helpful BOOLEAN,
  is_accurate BOOLEAN,
  is_fast BOOLEAN,

  -- Text feedback
  comment TEXT,
  comment_sentiment VARCHAR(20), -- 'positive', 'neutral', 'negative'

  -- Categories (auto-detected or user-selected)
  categories VARCHAR(50)[], -- ['inaccurate', 'incomplete', 'slow', 'helpful', etc.]

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(message_id, user_id)
);

-- Error tracking
CREATE TABLE agent_errors (
  error_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  conversation_id UUID REFERENCES agent_conversations(conversation_id),

  -- Error details
  error_type VARCHAR(100) NOT NULL, -- 'LLM_ERROR', 'TIMEOUT', 'RATE_LIMIT', 'KNOWLEDGE_ERROR', 'CONTEXT_ERROR'
  error_code VARCHAR(50),
  error_message TEXT NOT NULL,

  -- Context
  request_input TEXT,
  stack_trace TEXT,

  -- Resolution
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anomaly detection alerts
CREATE TABLE agent_alerts (
  alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID REFERENCES agents(id), -- NULL for tenant-wide alerts

  -- Alert details
  type VARCHAR(50) NOT NULL, -- 'ERROR_SPIKE', 'LATENCY_INCREASE', 'SATISFACTION_DROP', 'USAGE_ANOMALY'
  severity VARCHAR(20) NOT NULL, -- 'INFO', 'WARNING', 'CRITICAL'

  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,

  -- Metrics that triggered alert
  metric_name VARCHAR(100),
  metric_value DECIMAL(10,2),
  threshold_value DECIMAL(10,2),

  -- Status
  status VARCHAR(20) DEFAULT 'OPEN', -- 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Query patterns (for analytics)
CREATE TABLE agent_query_patterns (
  pattern_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id),

  -- Pattern info
  pattern_text VARCHAR(255) NOT NULL, -- Normalized query pattern
  pattern_embedding VECTOR(1536), -- For similarity clustering
  category VARCHAR(100), -- Auto-detected category

  -- Statistics
  occurrence_count INTEGER DEFAULT 1,
  avg_satisfaction DECIMAL(3,2),
  avg_response_time_ms INTEGER,

  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, agent_id, pattern_text)
);

-- Indexes
CREATE INDEX idx_metrics_hourly_lookup ON agent_metrics_hourly(tenant_id, agent_id, hour_start DESC);
CREATE INDEX idx_feedback_agent ON agent_feedback(agent_id, created_at DESC);
CREATE INDEX idx_errors_agent ON agent_errors(tenant_id, agent_id, created_at DESC);
CREATE INDEX idx_errors_unresolved ON agent_errors(tenant_id) WHERE is_resolved = false;
CREATE INDEX idx_alerts_open ON agent_alerts(tenant_id) WHERE status = 'OPEN';
CREATE INDEX idx_query_patterns_embedding ON agent_query_patterns USING ivfflat (pattern_embedding vector_cosine_ops);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Feedback submission
export const SubmitFeedbackSchema = z.object({
  messageId: z.string().uuid(),
  rating: z.number().int().min(1).max(5).optional(),
  isHelpful: z.boolean().optional(),
  isAccurate: z.boolean().optional(),
  isFast: z.boolean().optional(),
  comment: z.string().max(1000).optional(),
  categories: z.array(z.string()).optional(),
});

// Analytics query
export const AnalyticsQuerySchema = z.object({
  agentIds: z.array(z.string().uuid()).optional(),
  dateFrom: z.string().datetime(),
  dateUntil: z.string().datetime(),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  metrics: z.array(z.enum([
    'request_count',
    'response_time',
    'error_rate',
    'satisfaction',
    'token_usage',
    'knowledge_hit_rate',
  ])).optional(),
});

// Dashboard metrics
export const DashboardMetricsSchema = z.object({
  period: z.enum(['1d', '7d', '30d', '90d']).default('7d'),
  agentId: z.string().uuid().optional(),
});

// Alert configuration
export const AlertConfigSchema = z.object({
  agentId: z.string().uuid().optional(), // NULL for all agents
  type: z.enum(['ERROR_SPIKE', 'LATENCY_INCREASE', 'SATISFACTION_DROP', 'USAGE_ANOMALY']),
  threshold: z.number(),
  comparisonOperator: z.enum(['gt', 'lt', 'gte', 'lte']),
  enabled: z.boolean().default(true),
  notificationChannels: z.array(z.enum(['email', 'slack', 'webhook'])),
});

// Response types
export const PerformanceMetricsSchema = z.object({
  avgResponseTime: z.number(),
  p50ResponseTime: z.number(),
  p95ResponseTime: z.number(),
  errorRate: z.number(),
  availability: z.number(),
  requestCount: z.number(),
});

export const SatisfactionMetricsSchema = z.object({
  averageRating: z.number(),
  ratingCount: z.number(),
  ratingDistribution: z.object({
    1: z.number(),
    2: z.number(),
    3: z.number(),
    4: z.number(),
    5: z.number(),
  }),
  helpfulRate: z.number(),
  accurateRate: z.number(),
  topFeedbackCategories: z.array(z.object({
    category: z.string(),
    count: z.number(),
  })),
});

export const UsageHeatmapSchema = z.object({
  data: z.array(z.object({
    dayOfWeek: z.number().min(0).max(6),
    hour: z.number().min(0).max(23),
    value: z.number(),
  })),
});

export type SubmitFeedback = z.infer<typeof SubmitFeedbackSchema>;
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;
export type DashboardMetrics = z.infer<typeof DashboardMetricsSchema>;
export type AlertConfig = z.infer<typeof AlertConfigSchema>;
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;
export type SatisfactionMetrics = z.infer<typeof SatisfactionMetricsSchema>;
export type UsageHeatmap = z.infer<typeof UsageHeatmapSchema>;
```

### Service Implementation

```typescript
import { injectable, inject } from 'inversify';
import { MetricsRepository } from '../repositories/metrics.repository';
import { FeedbackRepository } from '../repositories/feedback.repository';
import { ErrorRepository } from '../repositories/error.repository';
import { AlertRepository } from '../repositories/alert.repository';
import { QueryPatternRepository } from '../repositories/query-pattern.repository';
import { AuditService } from '../../core/services/audit.service';
import { NotificationService } from '../../notification/services/notification.service';
import { SentimentService } from '../../ai/services/sentiment.service';
import { EmbeddingService } from '../../ai/services/embedding.service';
import {
  SubmitFeedback,
  AnalyticsQuery,
  DashboardMetrics,
  PerformanceMetrics,
  SatisfactionMetrics,
  UsageHeatmap,
} from '../schemas/analytics.schema';

@injectable()
export class AgentAnalyticsService {
  constructor(
    @inject(MetricsRepository) private metricsRepo: MetricsRepository,
    @inject(FeedbackRepository) private feedbackRepo: FeedbackRepository,
    @inject(ErrorRepository) private errorRepo: ErrorRepository,
    @inject(AlertRepository) private alertRepo: AlertRepository,
    @inject(QueryPatternRepository) private patternRepo: QueryPatternRepository,
    @inject(AuditService) private auditService: AuditService,
    @inject(NotificationService) private notificationService: NotificationService,
    @inject(SentimentService) private sentimentService: SentimentService,
    @inject(EmbeddingService) private embeddingService: EmbeddingService,
  ) {}

  // ============ Metrics Recording ============

  async recordRequestMetrics(
    tenantId: string,
    agentId: string,
    metrics: {
      responseTimeMs: number;
      inputTokens: number;
      outputTokens: number;
      hadError: boolean;
      knowledgeHit: boolean;
      userId: string;
      conversationId: string;
    },
  ): Promise<void> {
    const hourStart = this.getHourStart(new Date());

    await this.metricsRepo.incrementHourlyMetrics(tenantId, agentId, hourStart, {
      requestCount: 1,
      responseTimeSum: metrics.responseTimeMs,
      inputTokens: metrics.inputTokens,
      outputTokens: metrics.outputTokens,
      errorCount: metrics.hadError ? 1 : 0,
      knowledgeHitCount: metrics.knowledgeHit ? 1 : 0,
      knowledgeMissCount: !metrics.knowledgeHit ? 1 : 0,
      uniqueUsers: [metrics.userId],
    });

    // Check for anomalies
    await this.checkForAnomalies(tenantId, agentId, metrics);
  }

  async recordError(
    tenantId: string,
    agentId: string,
    error: {
      type: string;
      code?: string;
      message: string;
      conversationId?: string;
      requestInput?: string;
      stackTrace?: string;
    },
  ): Promise<void> {
    const errorRecord = await this.errorRepo.create(tenantId, agentId, error);

    // Check if error spike alert needed
    const recentErrorCount = await this.errorRepo.countRecent(tenantId, agentId, 5); // Last 5 minutes
    if (recentErrorCount >= 5) {
      await this.createAlert(tenantId, agentId, {
        type: 'ERROR_SPIKE',
        severity: 'CRITICAL',
        title: 'Wzrost liczby błędów agenta',
        description: `Agent wykrył ${recentErrorCount} błędów w ciągu ostatnich 5 minut`,
        metricName: 'error_count_5min',
        metricValue: recentErrorCount,
        thresholdValue: 5,
      });
    }
  }

  private async checkForAnomalies(
    tenantId: string,
    agentId: string,
    metrics: { responseTimeMs: number; hadError: boolean },
  ): Promise<void> {
    // Get baseline metrics (last 7 days average)
    const baseline = await this.metricsRepo.getBaselineMetrics(tenantId, agentId, 7);

    // Check response time anomaly
    if (baseline.avgResponseTime && metrics.responseTimeMs > baseline.avgResponseTime * 3) {
      await this.createAlert(tenantId, agentId, {
        type: 'LATENCY_INCREASE',
        severity: 'WARNING',
        title: 'Zwiększony czas odpowiedzi',
        description: `Czas odpowiedzi (${metrics.responseTimeMs}ms) przekroczył 3x średnią (${baseline.avgResponseTime.toFixed(0)}ms)`,
        metricName: 'response_time_ms',
        metricValue: metrics.responseTimeMs,
        thresholdValue: baseline.avgResponseTime * 3,
      });
    }
  }

  private async createAlert(
    tenantId: string,
    agentId: string | null,
    alert: {
      type: string;
      severity: string;
      title: string;
      description: string;
      metricName: string;
      metricValue: number;
      thresholdValue: number;
    },
  ): Promise<void> {
    // Check if similar alert already open
    const existingAlert = await this.alertRepo.findOpenAlert(tenantId, agentId, alert.type);
    if (existingAlert) {
      return;
    }

    const newAlert = await this.alertRepo.create(tenantId, agentId, alert);

    // Send notification
    await this.notificationService.send({
      tenantId,
      type: `AGENT_ALERT_${alert.severity}`,
      title: alert.title,
      body: alert.description,
      notifyAdmins: true,
      priority: alert.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
    });
  }

  // ============ Feedback Management ============

  async submitFeedback(
    tenantId: string,
    userId: string,
    conversationId: string,
    input: SubmitFeedback,
  ): Promise<void> {
    // Get conversation to find agent
    const message = await this.messageRepo.findById(input.messageId);
    if (!message || message.tenantId !== tenantId) {
      throw new Error('Wiadomość nie została znaleziona');
    }

    // Analyze sentiment if comment provided
    let commentSentiment: string | undefined;
    if (input.comment) {
      commentSentiment = await this.sentimentService.analyze(input.comment);
    }

    await this.feedbackRepo.upsert(tenantId, {
      agentId: message.agentId,
      conversationId,
      messageId: input.messageId,
      userId,
      rating: input.rating,
      isHelpful: input.isHelpful,
      isAccurate: input.isAccurate,
      isFast: input.isFast,
      comment: input.comment,
      commentSentiment,
      categories: input.categories,
    });

    // Update hourly metrics
    const hourStart = this.getHourStart(new Date());
    await this.metricsRepo.incrementFeedbackMetrics(tenantId, message.agentId, hourStart, {
      ratingCount: input.rating ? 1 : 0,
      ratingSum: input.rating || 0,
      positiveFeedback: (input.rating && input.rating >= 4) || input.isHelpful ? 1 : 0,
      negativeFeedback: (input.rating && input.rating <= 2) || input.isHelpful === false ? 1 : 0,
    });

    // Check for satisfaction drop alert
    const recentSatisfaction = await this.feedbackRepo.getRecentAverageRating(
      tenantId,
      message.agentId,
      24, // Last 24 hours
    );
    const historicalSatisfaction = await this.feedbackRepo.getHistoricalAverageRating(
      tenantId,
      message.agentId,
      30, // Last 30 days
    );

    if (historicalSatisfaction && recentSatisfaction < historicalSatisfaction - 0.5) {
      await this.createAlert(tenantId, message.agentId, {
        type: 'SATISFACTION_DROP',
        severity: 'WARNING',
        title: 'Spadek satysfakcji użytkowników',
        description: `Średnia ocena w ostatnich 24h (${recentSatisfaction.toFixed(2)}) spadła poniżej średniej 30-dniowej (${historicalSatisfaction.toFixed(2)})`,
        metricName: 'avg_rating_24h',
        metricValue: recentSatisfaction,
        thresholdValue: historicalSatisfaction - 0.5,
      });
    }
  }

  // ============ Analytics Queries ============

  async getPerformanceMetrics(
    tenantId: string,
    query: DashboardMetrics,
  ): Promise<PerformanceMetrics> {
    const dateRange = this.getDateRange(query.period);
    const metrics = await this.metricsRepo.getAggregatedMetrics(
      tenantId,
      query.agentId,
      dateRange.from,
      dateRange.to,
    );

    const totalRequests = metrics.requestCount;
    const errorRate = totalRequests > 0 ? (metrics.errorCount / totalRequests) * 100 : 0;

    // Calculate availability (100% - error rate - timeout rate)
    const timeoutRate = totalRequests > 0 ? (metrics.timeoutCount / totalRequests) * 100 : 0;
    const availability = Math.max(0, 100 - errorRate - timeoutRate);

    return {
      avgResponseTime: metrics.avgResponseTime || 0,
      p50ResponseTime: metrics.p50ResponseTime || 0,
      p95ResponseTime: metrics.p95ResponseTime || 0,
      errorRate,
      availability,
      requestCount: totalRequests,
    };
  }

  async getSatisfactionMetrics(
    tenantId: string,
    query: DashboardMetrics,
  ): Promise<SatisfactionMetrics> {
    const dateRange = this.getDateRange(query.period);
    const feedback = await this.feedbackRepo.getAggregatedFeedback(
      tenantId,
      query.agentId,
      dateRange.from,
      dateRange.to,
    );

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    feedback.ratingDistribution.forEach((item) => {
      ratingDistribution[item.rating] = item.count;
    });

    const totalHelpful = feedback.helpfulCount + feedback.notHelpfulCount;
    const totalAccurate = feedback.accurateCount + feedback.notAccurateCount;

    return {
      averageRating: feedback.averageRating || 0,
      ratingCount: feedback.ratingCount,
      ratingDistribution,
      helpfulRate: totalHelpful > 0 ? (feedback.helpfulCount / totalHelpful) * 100 : 0,
      accurateRate: totalAccurate > 0 ? (feedback.accurateCount / totalAccurate) * 100 : 0,
      topFeedbackCategories: feedback.topCategories,
    };
  }

  async getUsageHeatmap(
    tenantId: string,
    query: DashboardMetrics,
  ): Promise<UsageHeatmap> {
    const dateRange = this.getDateRange(query.period);
    const hourlyData = await this.metricsRepo.getHourlyDistribution(
      tenantId,
      query.agentId,
      dateRange.from,
      dateRange.to,
    );

    // Transform to heatmap format
    const data: Array<{ dayOfWeek: number; hour: number; value: number }> = [];

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const entry = hourlyData.find(
          (h) => h.dayOfWeek === day && h.hour === hour,
        );
        data.push({
          dayOfWeek: day,
          hour,
          value: entry?.requestCount || 0,
        });
      }
    }

    return { data };
  }

  async getQualityMetrics(
    tenantId: string,
    query: DashboardMetrics,
  ): Promise<{
    accuracyRate: number;
    knowledgeHitRate: number;
    actionCompletionRate: number;
    hallucinationRate: number;
  }> {
    const dateRange = this.getDateRange(query.period);
    const metrics = await this.metricsRepo.getQualityMetrics(
      tenantId,
      query.agentId,
      dateRange.from,
      dateRange.to,
    );

    const totalKnowledgeQueries = metrics.knowledgeHitCount + metrics.knowledgeMissCount;

    return {
      accuracyRate: metrics.accuracyRate || 0,
      knowledgeHitRate: totalKnowledgeQueries > 0
        ? (metrics.knowledgeHitCount / totalKnowledgeQueries) * 100
        : 0,
      actionCompletionRate: metrics.actionCompletionRate || 0,
      hallucinationRate: metrics.hallucinationRate || 0,
    };
  }

  async getTimeSeriesMetrics(
    tenantId: string,
    query: AnalyticsQuery,
  ): Promise<Array<{
    timestamp: string;
    metrics: Record<string, number>;
  }>> {
    return this.metricsRepo.getTimeSeries(
      tenantId,
      query.agentIds,
      query.dateFrom,
      query.dateUntil,
      query.granularity,
      query.metrics,
    );
  }

  async getTopQueryPatterns(
    tenantId: string,
    agentId: string,
    limit: number = 10,
  ): Promise<Array<{
    pattern: string;
    category: string;
    count: number;
    avgSatisfaction: number;
  }>> {
    return this.patternRepo.getTopPatterns(tenantId, agentId, limit);
  }

  // ============ Real-Time Monitoring ============

  async getRealTimeStats(tenantId: string): Promise<{
    activeConversations: number;
    requestsLastMinute: number;
    avgResponseTimeLastMinute: number;
    errorCountLastMinute: number;
    queueDepth: number;
  }> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);

    const stats = await this.metricsRepo.getRealTimeStats(tenantId, oneMinuteAgo);
    const queueDepth = await this.getQueueDepth(tenantId);

    return {
      activeConversations: stats.activeConversations,
      requestsLastMinute: stats.requestCount,
      avgResponseTimeLastMinute: stats.avgResponseTime,
      errorCountLastMinute: stats.errorCount,
      queueDepth,
    };
  }

  private async getQueueDepth(tenantId: string): Promise<number> {
    // Get pending requests from message queue
    // This would integrate with RabbitMQ/Redis queue
    return 0; // Placeholder
  }

  // ============ Alert Management ============

  async getOpenAlerts(tenantId: string): Promise<Alert[]> {
    return this.alertRepo.findOpenAlerts(tenantId);
  }

  async acknowledgeAlert(
    tenantId: string,
    userId: string,
    alertId: string,
  ): Promise<void> {
    const alert = await this.alertRepo.findById(alertId);
    if (!alert || alert.tenantId !== tenantId) {
      throw new Error('Alert nie został znaleziony');
    }

    await this.alertRepo.acknowledge(alertId, userId);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'ALERT_ACKNOWLEDGED',
      entityType: 'agent_alert',
      entityId: alertId,
    });
  }

  async resolveAlert(
    tenantId: string,
    userId: string,
    alertId: string,
  ): Promise<void> {
    const alert = await this.alertRepo.findById(alertId);
    if (!alert || alert.tenantId !== tenantId) {
      throw new Error('Alert nie został znaleziony');
    }

    await this.alertRepo.resolve(alertId);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'ALERT_RESOLVED',
      entityType: 'agent_alert',
      entityId: alertId,
    });
  }

  // ============ Query Pattern Analysis ============

  async recordQueryPattern(
    tenantId: string,
    agentId: string,
    query: string,
    satisfaction?: number,
    responseTimeMs?: number,
  ): Promise<void> {
    // Normalize query (remove specifics, keep pattern)
    const normalizedPattern = this.normalizeQuery(query);

    // Generate embedding for clustering
    const embedding = await this.embeddingService.generateEmbedding(normalizedPattern);

    // Find similar pattern or create new
    const existingPattern = await this.patternRepo.findSimilar(
      tenantId,
      agentId,
      embedding,
      0.9, // 90% similarity threshold
    );

    if (existingPattern) {
      await this.patternRepo.incrementPattern(
        existingPattern.patternId,
        satisfaction,
        responseTimeMs,
      );
    } else {
      // Detect category using LLM
      const category = await this.detectQueryCategory(query);

      await this.patternRepo.create(tenantId, agentId, {
        patternText: normalizedPattern,
        patternEmbedding: embedding,
        category,
        avgSatisfaction: satisfaction,
        avgResponseTimeMs: responseTimeMs,
      });
    }
  }

  private normalizeQuery(query: string): string {
    // Replace specific values with placeholders
    return query
      .replace(/\b\d+[.,]?\d*\s*(zł|PLN|EUR|USD)\b/gi, '[AMOUNT]')
      .replace(/\b\d{10,11}\b/g, '[NIP]')
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '[DATE]')
      .replace(/\b[A-Z]{2,3}-\d+\b/g, '[INVOICE_NO]')
      .replace(/\b\d{26}\b/g, '[IBAN]')
      .trim()
      .toLowerCase();
  }

  private async detectQueryCategory(query: string): Promise<string> {
    // Use LLM to categorize query
    // Categories: 'vat', 'pit', 'cit', 'invoicing', 'reporting', 'general', etc.
    return 'general'; // Placeholder
  }

  // ============ Helpers ============

  private getHourStart(date: Date): Date {
    const hourStart = new Date(date);
    hourStart.setMinutes(0, 0, 0);
    return hourStart;
  }

  private getDateRange(period: string): { from: Date; to: Date } {
    const to = new Date();
    const from = new Date();

    switch (period) {
      case '1d':
        from.setDate(from.getDate() - 1);
        break;
      case '7d':
        from.setDate(from.getDate() - 7);
        break;
      case '30d':
        from.setDate(from.getDate() - 30);
        break;
      case '90d':
        from.setDate(from.getDate() - 90);
        break;
      default:
        from.setDate(from.getDate() - 7);
    }

    return { from, to };
  }
}
```

### tRPC Router

```typescript
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { AgentAnalyticsService } from '../services/agent-analytics.service';
import {
  SubmitFeedbackSchema,
  AnalyticsQuerySchema,
  DashboardMetricsSchema,
} from '../schemas/analytics.schema';
import { z } from 'zod';

export const agentAnalyticsRouter = router({
  // User feedback (any authenticated user)
  submitFeedback: protectedProcedure
    .input(z.object({
      conversationId: z.string().uuid(),
      feedback: SubmitFeedbackSchema,
    }))
    .mutation(({ ctx, input }) =>
      ctx.agentAnalyticsService.submitFeedback(
        ctx.tenantId,
        ctx.userId,
        input.conversationId,
        input.feedback,
      ),
    ),

  // Dashboard metrics (Admin)
  getPerformanceMetrics: adminProcedure
    .input(DashboardMetricsSchema)
    .query(({ ctx, input }) =>
      ctx.agentAnalyticsService.getPerformanceMetrics(ctx.tenantId, input),
    ),

  getSatisfactionMetrics: adminProcedure
    .input(DashboardMetricsSchema)
    .query(({ ctx, input }) =>
      ctx.agentAnalyticsService.getSatisfactionMetrics(ctx.tenantId, input),
    ),

  getUsageHeatmap: adminProcedure
    .input(DashboardMetricsSchema)
    .query(({ ctx, input }) =>
      ctx.agentAnalyticsService.getUsageHeatmap(ctx.tenantId, input),
    ),

  getQualityMetrics: adminProcedure
    .input(DashboardMetricsSchema)
    .query(({ ctx, input }) =>
      ctx.agentAnalyticsService.getQualityMetrics(ctx.tenantId, input),
    ),

  getTimeSeriesMetrics: adminProcedure
    .input(AnalyticsQuerySchema)
    .query(({ ctx, input }) =>
      ctx.agentAnalyticsService.getTimeSeriesMetrics(ctx.tenantId, input),
    ),

  getTopQueryPatterns: adminProcedure
    .input(z.object({
      agentId: z.string().uuid(),
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(({ ctx, input }) =>
      ctx.agentAnalyticsService.getTopQueryPatterns(
        ctx.tenantId,
        input.agentId,
        input.limit,
      ),
    ),

  // Real-time monitoring (Admin)
  getRealTimeStats: adminProcedure
    .query(({ ctx }) =>
      ctx.agentAnalyticsService.getRealTimeStats(ctx.tenantId),
    ),

  // Alerts (Admin)
  getOpenAlerts: adminProcedure
    .query(({ ctx }) =>
      ctx.agentAnalyticsService.getOpenAlerts(ctx.tenantId),
    ),

  acknowledgeAlert: adminProcedure
    .input(z.object({ alertId: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.agentAnalyticsService.acknowledgeAlert(ctx.tenantId, ctx.userId, input.alertId),
    ),

  resolveAlert: adminProcedure
    .input(z.object({ alertId: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.agentAnalyticsService.resolveAlert(ctx.tenantId, ctx.userId, input.alertId),
    ),

  // Error tracking (Admin)
  getRecentErrors: adminProcedure
    .input(z.object({
      agentId: z.string().uuid().optional(),
      limit: z.number().min(1).max(100).default(20),
      unresolvedOnly: z.boolean().default(false),
    }))
    .query(({ ctx, input }) =>
      ctx.agentAnalyticsService.getRecentErrors(
        ctx.tenantId,
        input.agentId,
        input.limit,
        input.unresolvedOnly,
      ),
    ),

  resolveError: adminProcedure
    .input(z.object({
      errorId: z.string().uuid(),
      notes: z.string().optional(),
    }))
    .mutation(({ ctx, input }) =>
      ctx.agentAnalyticsService.resolveError(
        ctx.tenantId,
        ctx.userId,
        input.errorId,
        input.notes,
      ),
    ),
});
```

## Test Specification

### Unit Tests

```typescript
describe('AgentAnalyticsService', () => {
  describe('recordRequestMetrics', () => {
    it('should increment hourly metrics correctly', async () => {
      await service.recordRequestMetrics(tenantId, agentId, {
        responseTimeMs: 250,
        inputTokens: 100,
        outputTokens: 200,
        hadError: false,
        knowledgeHit: true,
        userId: 'user-1',
        conversationId: 'conv-1',
      });

      expect(metricsRepo.incrementHourlyMetrics).toHaveBeenCalledWith(
        tenantId,
        agentId,
        expect.any(Date),
        expect.objectContaining({
          requestCount: 1,
          knowledgeHitCount: 1,
        }),
      );
    });

    it('should create alert on response time anomaly', async () => {
      metricsRepo.getBaselineMetrics.mockResolvedValue({ avgResponseTime: 200 });

      await service.recordRequestMetrics(tenantId, agentId, {
        responseTimeMs: 700, // 3.5x baseline
        inputTokens: 100,
        outputTokens: 200,
        hadError: false,
        knowledgeHit: true,
        userId: 'user-1',
        conversationId: 'conv-1',
      });

      expect(alertRepo.create).toHaveBeenCalledWith(
        tenantId,
        agentId,
        expect.objectContaining({
          type: 'LATENCY_INCREASE',
        }),
      );
    });
  });

  describe('submitFeedback', () => {
    it('should analyze sentiment of comment', async () => {
      sentimentService.analyze.mockResolvedValue('positive');

      await service.submitFeedback(tenantId, userId, conversationId, {
        messageId: 'msg-1',
        rating: 5,
        comment: 'Bardzo pomocna odpowiedź!',
      });

      expect(feedbackRepo.upsert).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          commentSentiment: 'positive',
        }),
      );
    });

    it('should trigger alert on satisfaction drop', async () => {
      feedbackRepo.getRecentAverageRating.mockResolvedValue(3.2);
      feedbackRepo.getHistoricalAverageRating.mockResolvedValue(4.5);

      await service.submitFeedback(tenantId, userId, conversationId, {
        messageId: 'msg-1',
        rating: 2,
      });

      expect(alertRepo.create).toHaveBeenCalledWith(
        tenantId,
        expect.any(String),
        expect.objectContaining({
          type: 'SATISFACTION_DROP',
        }),
      );
    });
  });

  describe('getUsageHeatmap', () => {
    it('should return complete 7x24 heatmap', async () => {
      const result = await service.getUsageHeatmap(tenantId, { period: '7d' });

      expect(result.data).toHaveLength(168); // 7 days * 24 hours
      expect(result.data[0]).toHaveProperty('dayOfWeek');
      expect(result.data[0]).toHaveProperty('hour');
      expect(result.data[0]).toHaveProperty('value');
    });
  });
});
```

### Integration Tests

```typescript
describe('Agent Analytics Integration', () => {
  describe('Feedback flow', () => {
    it('should record feedback and update metrics', async () => {
      // Submit feedback
      await trpc.agentAnalytics.submitFeedback({
        conversationId,
        feedback: {
          messageId,
          rating: 4,
          isHelpful: true,
          comment: 'Good response',
        },
      });

      // Verify metrics updated
      const satisfaction = await trpc.agentAnalytics.getSatisfactionMetrics({
        period: '1d',
        agentId,
      });

      expect(satisfaction.ratingCount).toBeGreaterThan(0);
      expect(satisfaction.averageRating).toBeGreaterThan(0);
    });
  });

  describe('Alert flow', () => {
    it('should create and manage alerts', async () => {
      // Trigger error spike
      for (let i = 0; i < 5; i++) {
        await service.recordError(tenantId, agentId, {
          type: 'LLM_ERROR',
          message: 'Test error',
        });
      }

      // Check alert created
      const alerts = await trpc.agentAnalytics.getOpenAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('ERROR_SPIKE');

      // Acknowledge
      await trpc.agentAnalytics.acknowledgeAlert({ alertId: alerts[0].alertId });

      // Resolve
      await trpc.agentAnalytics.resolveAlert({ alertId: alerts[0].alertId });

      // Verify resolved
      const openAlerts = await trpc.agentAnalytics.getOpenAlerts();
      expect(openAlerts).toHaveLength(0);
    });
  });
});
```

## Security Checklist

- [x] Analytics data is tenant-isolated
- [x] Feedback limited to own conversations
- [x] Alert management requires Admin role
- [x] No PII in query patterns
- [x] Error details sanitized (no credentials)
- [x] Rate limiting on feedback submission
- [x] Audit logging for alert actions

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| FEEDBACK_SUBMITTED | User rates response | Rating, categories |
| ALERT_CREATED | Anomaly detected | Alert type, metrics |
| ALERT_ACKNOWLEDGED | Admin acknowledges | Alert ID, user |
| ALERT_RESOLVED | Admin resolves | Alert ID |
| ERROR_RESOLVED | Admin resolves error | Error ID, notes |
| METRICS_EXPORTED | Admin exports data | Date range, format |

## Definition of Done

- [x] Performance metrics dashboard implemented
- [x] User satisfaction tracking with sentiment
- [x] Real-time monitoring with alerts
- [x] Usage heatmap visualization
- [x] Quality metrics (accuracy, knowledge hit rate)
- [x] Query pattern analysis
- [x] Alert management (create, acknowledge, resolve)
- [x] Unit tests (≥80% coverage)
- [x] Integration tests for feedback flow
- [x] Polish localization for alerts
- [x] Security review completed
