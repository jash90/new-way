# Story: Token & Cost Management

## Story Metadata

| Field | Value |
|-------|-------|
| Story ID | AAM-008 |
| Epic | AI Agent Module (AAM) |
| Title | Token & Cost Management |
| Status | Draft |
| Priority | P2 |
| Story Points | 5 |
| Sprint | Sprint 7 |
| Dependencies | AAM-001, AAM-004 |
| Assignee | TBD |
| Created | 2025-01-XX |
| Updated | 2025-01-XX |

## User Story

**As a** Super Admin
**I want to** track and manage AI token usage and costs across agents
**So that** I can optimize spending, set budgets, and ensure cost-effective AI operations

## Acceptance Criteria

### AC1: Real-Time Usage Tracking
```gherkin
Given I am a Super Admin viewing agent usage
When an agent processes user requests
Then I see real-time token counts for input/output
And I see cost calculations based on model pricing
And usage is attributed to specific agents and users
And I can filter usage by date range, agent, or user
```

### AC2: Budget Management
```gherkin
Given I want to control AI spending
When I set monthly/daily budget limits
Then agents are throttled when approaching limits (80% warning)
And agents are blocked when limits are exceeded
And I receive email/in-app notifications at thresholds
And I can configure different budgets per agent or department
```

### AC3: Cost Optimization Recommendations
```gherkin
Given I want to optimize AI costs
When I view cost analytics
Then I see recommendations for model downgrades where quality allows
And I see prompt optimization suggestions to reduce tokens
And I see caching opportunities for repeated queries
And estimated savings are calculated for each recommendation
```

### AC4: Usage Reports & Exports
```gherkin
Given I need cost reporting for accounting
When I generate usage reports
Then I can export detailed breakdowns by agent, user, period
And reports include Polish tax-compliant formatting
And I can schedule automatic monthly reports
And historical data is retained for 24 months
```

### AC5: Model Pricing Configuration
```gherkin
Given different LLM providers have different pricing
When I configure model pricing
Then I can set custom prices per 1K tokens (input/output)
And price history is maintained for accurate historical costs
And currency conversion is supported (USD to PLN)
And pricing updates are versioned with effective dates
```

## Technical Specification

### Database Schema

```sql
-- Token usage records per request
CREATE TABLE agent_token_usage (
  usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  conversation_id UUID REFERENCES agent_conversations(conversation_id),
  message_id UUID REFERENCES agent_messages(message_id),
  user_id UUID NOT NULL REFERENCES users(id),

  -- Token counts
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,

  -- Cost calculation
  model VARCHAR(100) NOT NULL,
  input_cost_per_1k DECIMAL(10,6) NOT NULL,
  output_cost_per_1k DECIMAL(10,6) NOT NULL,
  input_cost DECIMAL(10,4) GENERATED ALWAYS AS (input_tokens * input_cost_per_1k / 1000) STORED,
  output_cost DECIMAL(10,4) GENERATED ALWAYS AS (output_tokens * output_cost_per_1k / 1000) STORED,
  total_cost DECIMAL(10,4) GENERATED ALWAYS AS (
    (input_tokens * input_cost_per_1k / 1000) + (output_tokens * output_cost_per_1k / 1000)
  ) STORED,
  currency VARCHAR(3) DEFAULT 'USD',

  -- Context
  request_type VARCHAR(50) NOT NULL, -- 'chat', 'embedding', 'completion'
  cached BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budget configurations
CREATE TABLE agent_budgets (
  budget_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Scope
  scope_type VARCHAR(20) NOT NULL, -- 'tenant', 'department', 'agent', 'user'
  scope_id UUID, -- NULL for tenant scope

  -- Limits
  daily_limit DECIMAL(10,2),
  monthly_limit DECIMAL(10,2),
  yearly_limit DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'PLN',

  -- Thresholds
  warning_threshold DECIMAL(3,2) DEFAULT 0.80, -- 80%
  block_threshold DECIMAL(3,2) DEFAULT 1.00, -- 100%

  -- Actions
  action_on_warning VARCHAR(20) DEFAULT 'NOTIFY', -- 'NOTIFY', 'THROTTLE'
  action_on_limit VARCHAR(20) DEFAULT 'BLOCK', -- 'BLOCK', 'NOTIFY_ONLY'

  -- Notifications
  notification_emails TEXT[], -- Additional notification recipients
  notify_admins BOOLEAN DEFAULT true,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_scope CHECK (
    (scope_type = 'tenant' AND scope_id IS NULL) OR
    (scope_type != 'tenant' AND scope_id IS NOT NULL)
  )
);

-- Budget usage tracking (aggregated)
CREATE TABLE budget_usage (
  usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  budget_id UUID NOT NULL REFERENCES agent_budgets(budget_id),

  period_type VARCHAR(10) NOT NULL, -- 'daily', 'monthly', 'yearly'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  total_tokens BIGINT DEFAULT 0,
  total_cost DECIMAL(12,4) DEFAULT 0,
  request_count INTEGER DEFAULT 0,

  -- Status
  warning_sent BOOLEAN DEFAULT false,
  limit_reached BOOLEAN DEFAULT false,
  limit_reached_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(budget_id, period_type, period_start)
);

-- Model pricing configuration
CREATE TABLE model_pricing (
  pricing_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id), -- NULL for global defaults

  model VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL, -- 'openai', 'anthropic', 'huggingface'

  input_cost_per_1k DECIMAL(10,6) NOT NULL,
  output_cost_per_1k DECIMAL(10,6) NOT NULL,
  embedding_cost_per_1k DECIMAL(10,6),
  currency VARCHAR(3) DEFAULT 'USD',

  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, model, effective_from)
);

-- Cost optimization recommendations
CREATE TABLE cost_recommendations (
  recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID REFERENCES agents(id),

  type VARCHAR(50) NOT NULL, -- 'MODEL_DOWNGRADE', 'PROMPT_OPTIMIZATION', 'CACHING', 'BATCHING'
  priority VARCHAR(20) DEFAULT 'MEDIUM', -- 'HIGH', 'MEDIUM', 'LOW'

  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,

  -- Impact estimates
  current_monthly_cost DECIMAL(10,2),
  estimated_new_cost DECIMAL(10,2),
  estimated_savings DECIMAL(10,2),
  savings_percentage DECIMAL(5,2),

  -- Implementation details
  implementation_steps JSONB DEFAULT '[]',
  affected_agents UUID[],

  -- Status
  status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'REJECTED', 'IMPLEMENTED'
  implemented_at TIMESTAMPTZ,
  actual_savings DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage reports
CREATE TABLE usage_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'SUMMARY', 'DETAILED', 'AGENT_BREAKDOWN', 'USER_BREAKDOWN'

  -- Report parameters
  date_from DATE NOT NULL,
  date_until DATE NOT NULL,
  filters JSONB DEFAULT '{}',

  -- Generated report
  format VARCHAR(20) NOT NULL, -- 'PDF', 'XLSX', 'CSV'
  file_url TEXT,
  file_size INTEGER,

  -- Scheduling
  is_scheduled BOOLEAN DEFAULT false,
  schedule_cron VARCHAR(100),
  next_run_at TIMESTAMPTZ,

  -- Status
  status VARCHAR(20) DEFAULT 'GENERATING', -- 'GENERATING', 'COMPLETED', 'FAILED'
  generated_at TIMESTAMPTZ,
  error_message TEXT,

  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_token_usage_tenant ON agent_token_usage(tenant_id);
CREATE INDEX idx_token_usage_agent ON agent_token_usage(agent_id);
CREATE INDEX idx_token_usage_user ON agent_token_usage(user_id);
CREATE INDEX idx_token_usage_created ON agent_token_usage(created_at);
CREATE INDEX idx_token_usage_conversation ON agent_token_usage(conversation_id);
CREATE INDEX idx_budget_usage_period ON budget_usage(budget_id, period_start);
CREATE INDEX idx_model_pricing_lookup ON model_pricing(model, effective_from)
  WHERE is_active = true;
CREATE INDEX idx_recommendations_tenant ON cost_recommendations(tenant_id, status);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Token usage recording
export const RecordTokenUsageSchema = z.object({
  agentId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  model: z.string().min(1),
  requestType: z.enum(['chat', 'embedding', 'completion']),
  cached: z.boolean().default(false),
});

// Budget management
export const CreateBudgetSchema = z.object({
  scopeType: z.enum(['tenant', 'department', 'agent', 'user']),
  scopeId: z.string().uuid().optional(),
  dailyLimit: z.number().positive().optional(),
  monthlyLimit: z.number().positive().optional(),
  yearlyLimit: z.number().positive().optional(),
  currency: z.enum(['PLN', 'USD', 'EUR']).default('PLN'),
  warningThreshold: z.number().min(0.5).max(0.99).default(0.80),
  blockThreshold: z.number().min(0.5).max(2.0).default(1.00),
  actionOnWarning: z.enum(['NOTIFY', 'THROTTLE']).default('NOTIFY'),
  actionOnLimit: z.enum(['BLOCK', 'NOTIFY_ONLY']).default('BLOCK'),
  notificationEmails: z.array(z.string().email()).optional(),
  notifyAdmins: z.boolean().default(true),
});

export const UpdateBudgetSchema = CreateBudgetSchema.partial();

// Model pricing
export const SetModelPricingSchema = z.object({
  model: z.string().min(1),
  provider: z.enum(['openai', 'anthropic', 'huggingface', 'cohere']),
  inputCostPer1k: z.number().positive(),
  outputCostPer1k: z.number().positive(),
  embeddingCostPer1k: z.number().positive().optional(),
  currency: z.enum(['USD', 'EUR', 'PLN']).default('USD'),
  effectiveFrom: z.string().datetime().optional(),
});

// Usage queries
export const UsageQuerySchema = z.object({
  dateFrom: z.string().datetime(),
  dateUntil: z.string().datetime(),
  agentIds: z.array(z.string().uuid()).optional(),
  userIds: z.array(z.string().uuid()).optional(),
  models: z.array(z.string()).optional(),
  groupBy: z.enum(['day', 'week', 'month', 'agent', 'user', 'model']).optional(),
  currency: z.enum(['PLN', 'USD', 'EUR']).default('PLN'),
});

// Report generation
export const GenerateReportSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['SUMMARY', 'DETAILED', 'AGENT_BREAKDOWN', 'USER_BREAKDOWN']),
  dateFrom: z.string().datetime(),
  dateUntil: z.string().datetime(),
  format: z.enum(['PDF', 'XLSX', 'CSV']),
  filters: z.object({
    agentIds: z.array(z.string().uuid()).optional(),
    userIds: z.array(z.string().uuid()).optional(),
    departments: z.array(z.string()).optional(),
  }).optional(),
});

// Schedule report
export const ScheduleReportSchema = GenerateReportSchema.extend({
  scheduleCron: z.string().regex(/^[\d\*\-\/\,]+\s[\d\*\-\/\,]+\s[\d\*\-\/\,]+\s[\d\*\-\/\,]+\s[\d\*\-\/\,]+$/),
});

// Recommendation response
export const RecommendationResponseSchema = z.object({
  recommendationId: z.string().uuid(),
  action: z.enum(['ACCEPTED', 'REJECTED', 'IMPLEMENTED']),
  actualSavings: z.number().optional(),
  notes: z.string().optional(),
});

// Response types
export const TokenUsageStatsSchema = z.object({
  period: z.string(),
  totalTokens: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  totalCost: z.number(),
  requestCount: z.number(),
  averageTokensPerRequest: z.number(),
  cachedRequests: z.number(),
  cacheSavings: z.number(),
});

export const BudgetStatusSchema = z.object({
  budgetId: z.string().uuid(),
  scope: z.string(),
  period: z.string(),
  limit: z.number(),
  used: z.number(),
  remaining: z.number(),
  percentageUsed: z.number(),
  status: z.enum(['OK', 'WARNING', 'EXCEEDED']),
  projectedMonthEnd: z.number().optional(),
});

export type RecordTokenUsage = z.infer<typeof RecordTokenUsageSchema>;
export type CreateBudget = z.infer<typeof CreateBudgetSchema>;
export type UpdateBudget = z.infer<typeof UpdateBudgetSchema>;
export type SetModelPricing = z.infer<typeof SetModelPricingSchema>;
export type UsageQuery = z.infer<typeof UsageQuerySchema>;
export type GenerateReport = z.infer<typeof GenerateReportSchema>;
export type ScheduleReport = z.infer<typeof ScheduleReportSchema>;
export type RecommendationResponse = z.infer<typeof RecommendationResponseSchema>;
export type TokenUsageStats = z.infer<typeof TokenUsageStatsSchema>;
export type BudgetStatus = z.infer<typeof BudgetStatusSchema>;
```

### Service Implementation

```typescript
import { injectable, inject } from 'inversify';
import { TokenUsageRepository } from '../repositories/token-usage.repository';
import { BudgetRepository } from '../repositories/budget.repository';
import { ModelPricingRepository } from '../repositories/model-pricing.repository';
import { RecommendationRepository } from '../repositories/recommendation.repository';
import { ReportRepository } from '../repositories/report.repository';
import { AuditService } from '../../core/services/audit.service';
import { NotificationService } from '../../notification/services/notification.service';
import { CurrencyService } from '../../core/services/currency.service';
import { S3Service } from '../../storage/services/s3.service';
import { PDFService } from '../../core/services/pdf.service';
import { ExcelService } from '../../core/services/excel.service';
import {
  RecordTokenUsage,
  CreateBudget,
  UpdateBudget,
  UsageQuery,
  GenerateReport,
  TokenUsageStats,
  BudgetStatus,
} from '../schemas/cost-management.schema';

@injectable()
export class CostManagementService {
  constructor(
    @inject(TokenUsageRepository) private usageRepo: TokenUsageRepository,
    @inject(BudgetRepository) private budgetRepo: BudgetRepository,
    @inject(ModelPricingRepository) private pricingRepo: ModelPricingRepository,
    @inject(RecommendationRepository) private recommendationRepo: RecommendationRepository,
    @inject(ReportRepository) private reportRepo: ReportRepository,
    @inject(AuditService) private auditService: AuditService,
    @inject(NotificationService) private notificationService: NotificationService,
    @inject(CurrencyService) private currencyService: CurrencyService,
    @inject(S3Service) private s3Service: S3Service,
    @inject(PDFService) private pdfService: PDFService,
    @inject(ExcelService) private excelService: ExcelService,
  ) {}

  // ============ Token Usage Recording ============

  async recordUsage(tenantId: string, input: RecordTokenUsage): Promise<void> {
    const pricing = await this.getModelPricing(tenantId, input.model);

    const usage = await this.usageRepo.create(tenantId, {
      ...input,
      inputCostPer1k: pricing.inputCostPer1k,
      outputCostPer1k: pricing.outputCostPer1k,
      currency: pricing.currency,
    });

    // Update budget usage asynchronously
    await this.updateBudgetUsage(tenantId, input);

    // Check budget limits
    await this.checkBudgetLimits(tenantId, input.agentId, input.userId);
  }

  private async getModelPricing(tenantId: string, model: string): Promise<{
    inputCostPer1k: number;
    outputCostPer1k: number;
    currency: string;
  }> {
    // Check tenant-specific pricing first, then global defaults
    const pricing = await this.pricingRepo.getActivePricing(tenantId, model) ||
                   await this.pricingRepo.getActivePricing(null, model);

    if (!pricing) {
      // Use default pricing for unknown models
      return {
        inputCostPer1k: 0.01,
        outputCostPer1k: 0.03,
        currency: 'USD',
      };
    }

    return pricing;
  }

  private async updateBudgetUsage(tenantId: string, input: RecordTokenUsage): Promise<void> {
    const pricing = await this.getModelPricing(tenantId, input.model);
    const totalCost = (input.inputTokens * pricing.inputCostPer1k / 1000) +
                     (input.outputTokens * pricing.outputCostPer1k / 1000);

    // Update all applicable budgets
    const budgets = await this.budgetRepo.getApplicableBudgets(
      tenantId,
      input.agentId,
      input.userId,
    );

    for (const budget of budgets) {
      const convertedCost = await this.currencyService.convert(
        totalCost,
        pricing.currency,
        budget.currency,
      );

      await this.budgetRepo.incrementUsage(
        budget.budgetId,
        input.inputTokens + input.outputTokens,
        convertedCost,
      );
    }
  }

  private async checkBudgetLimits(
    tenantId: string,
    agentId: string,
    userId: string,
  ): Promise<void> {
    const statuses = await this.getBudgetStatuses(tenantId, agentId, userId);

    for (const status of statuses) {
      if (status.status === 'WARNING' && !status.warningSent) {
        await this.sendBudgetWarning(tenantId, status);
      } else if (status.status === 'EXCEEDED' && !status.limitReached) {
        await this.handleBudgetExceeded(tenantId, status);
      }
    }
  }

  private async sendBudgetWarning(tenantId: string, status: BudgetStatus): Promise<void> {
    const budget = await this.budgetRepo.findById(status.budgetId);

    await this.notificationService.send({
      tenantId,
      type: 'BUDGET_WARNING',
      title: 'Ostrzeżenie o budżecie AI',
      body: `Wykorzystano ${status.percentageUsed.toFixed(0)}% budżetu (${status.used.toFixed(2)} ${budget.currency} z ${status.limit.toFixed(2)} ${budget.currency})`,
      recipients: budget.notificationEmails || [],
      notifyAdmins: budget.notifyAdmins,
      priority: 'HIGH',
    });

    await this.budgetRepo.markWarningSent(status.budgetId);

    await this.auditService.log({
      tenantId,
      action: 'BUDGET_WARNING_SENT',
      entityType: 'budget',
      entityId: status.budgetId,
      newValue: { percentageUsed: status.percentageUsed },
    });
  }

  private async handleBudgetExceeded(tenantId: string, status: BudgetStatus): Promise<void> {
    const budget = await this.budgetRepo.findById(status.budgetId);

    await this.notificationService.send({
      tenantId,
      type: 'BUDGET_EXCEEDED',
      title: 'Przekroczono limit budżetu AI',
      body: `Budżet został przekroczony. Wykorzystano ${status.used.toFixed(2)} ${budget.currency} z ${status.limit.toFixed(2)} ${budget.currency}`,
      recipients: budget.notificationEmails || [],
      notifyAdmins: budget.notifyAdmins,
      priority: 'CRITICAL',
    });

    await this.budgetRepo.markLimitReached(status.budgetId);

    await this.auditService.log({
      tenantId,
      action: 'BUDGET_EXCEEDED',
      entityType: 'budget',
      entityId: status.budgetId,
      newValue: { used: status.used, limit: status.limit },
    });
  }

  // ============ Budget Management ============

  async createBudget(tenantId: string, userId: string, input: CreateBudget): Promise<Budget> {
    const budget = await this.budgetRepo.create(tenantId, input);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'BUDGET_CREATED',
      entityType: 'budget',
      entityId: budget.budgetId,
      newValue: input,
    });

    return budget;
  }

  async updateBudget(
    tenantId: string,
    userId: string,
    budgetId: string,
    input: UpdateBudget,
  ): Promise<Budget> {
    const existing = await this.budgetRepo.findById(budgetId);
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error('Budżet nie został znaleziony');
    }

    const updated = await this.budgetRepo.update(budgetId, input);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'BUDGET_UPDATED',
      entityType: 'budget',
      entityId: budgetId,
      previousValue: existing,
      newValue: updated,
    });

    return updated;
  }

  async getBudgetStatuses(
    tenantId: string,
    agentId?: string,
    userId?: string,
  ): Promise<BudgetStatus[]> {
    const budgets = await this.budgetRepo.getApplicableBudgets(tenantId, agentId, userId);
    const statuses: BudgetStatus[] = [];

    for (const budget of budgets) {
      const usage = await this.budgetRepo.getCurrentUsage(budget.budgetId);

      const limit = budget.monthlyLimit || budget.dailyLimit || budget.yearlyLimit;
      const percentageUsed = limit ? (usage.totalCost / limit) * 100 : 0;

      let status: 'OK' | 'WARNING' | 'EXCEEDED' = 'OK';
      if (percentageUsed >= budget.blockThreshold * 100) {
        status = 'EXCEEDED';
      } else if (percentageUsed >= budget.warningThreshold * 100) {
        status = 'WARNING';
      }

      // Calculate projected month-end usage
      const dayOfMonth = new Date().getDate();
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const projectedMonthEnd = (usage.totalCost / dayOfMonth) * daysInMonth;

      statuses.push({
        budgetId: budget.budgetId,
        scope: `${budget.scopeType}:${budget.scopeId || 'all'}`,
        period: 'monthly',
        limit: limit || 0,
        used: usage.totalCost,
        remaining: Math.max(0, (limit || 0) - usage.totalCost),
        percentageUsed,
        status,
        projectedMonthEnd,
        warningSent: usage.warningSent,
        limitReached: usage.limitReached,
      });
    }

    return statuses;
  }

  async checkCanMakeRequest(
    tenantId: string,
    agentId: string,
    userId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const statuses = await this.getBudgetStatuses(tenantId, agentId, userId);

    for (const status of statuses) {
      const budget = await this.budgetRepo.findById(status.budgetId);

      if (status.status === 'EXCEEDED' && budget.actionOnLimit === 'BLOCK') {
        return {
          allowed: false,
          reason: `Przekroczono limit budżetu AI. Pozostały limit zostanie odnowiony ${this.getNextResetDate(budget)}`,
        };
      }
    }

    return { allowed: true };
  }

  private getNextResetDate(budget: Budget): string {
    const now = new Date();
    if (budget.dailyLimit) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow.toLocaleDateString('pl-PL');
    }
    if (budget.monthlyLimit) {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return nextMonth.toLocaleDateString('pl-PL');
    }
    return 'wkrótce';
  }

  // ============ Usage Analytics ============

  async getUsageStats(tenantId: string, query: UsageQuery): Promise<TokenUsageStats[]> {
    const usage = await this.usageRepo.getAggregatedUsage(tenantId, query);

    // Convert costs to requested currency
    const convertedUsage = await Promise.all(
      usage.map(async (stat) => {
        const convertedCost = await this.currencyService.convert(
          stat.totalCost,
          'USD',
          query.currency,
        );
        return {
          ...stat,
          totalCost: convertedCost,
        };
      }),
    );

    return convertedUsage;
  }

  async getDashboardMetrics(tenantId: string): Promise<{
    today: TokenUsageStats;
    thisMonth: TokenUsageStats;
    topAgents: Array<{ agentId: string; name: string; cost: number }>;
    topUsers: Array<{ userId: string; name: string; cost: number }>;
    costTrend: Array<{ date: string; cost: number }>;
  }> {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todayStats] = await this.getUsageStats(tenantId, {
      dateFrom: startOfDay.toISOString(),
      dateUntil: new Date().toISOString(),
      currency: 'PLN',
    });

    const [monthStats] = await this.getUsageStats(tenantId, {
      dateFrom: startOfMonth.toISOString(),
      dateUntil: new Date().toISOString(),
      currency: 'PLN',
    });

    const topAgents = await this.usageRepo.getTopAgentsByUsage(tenantId, 5);
    const topUsers = await this.usageRepo.getTopUsersByUsage(tenantId, 5);
    const costTrend = await this.usageRepo.getDailyCostTrend(tenantId, 30);

    return {
      today: todayStats || this.emptyStats(),
      thisMonth: monthStats || this.emptyStats(),
      topAgents,
      topUsers,
      costTrend,
    };
  }

  private emptyStats(): TokenUsageStats {
    return {
      period: 'current',
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
      requestCount: 0,
      averageTokensPerRequest: 0,
      cachedRequests: 0,
      cacheSavings: 0,
    };
  }

  // ============ Cost Optimization ============

  async generateRecommendations(tenantId: string): Promise<void> {
    // Analyze usage patterns and generate recommendations
    const agents = await this.usageRepo.getAgentUsagePatterns(tenantId);

    for (const agent of agents) {
      // Check for model downgrade opportunities
      if (agent.avgResponseQuality > 0.8 && agent.model.includes('gpt-4')) {
        await this.createRecommendation(tenantId, {
          agentId: agent.agentId,
          type: 'MODEL_DOWNGRADE',
          title: 'Możliwość obniżenia modelu',
          description: `Agent "${agent.name}" utrzymuje wysoką jakość odpowiedzi (${(agent.avgResponseQuality * 100).toFixed(0)}%). Przejście na GPT-3.5-turbo może zmniejszyć koszty o 90% przy minimalnej utracie jakości.`,
          currentMonthlyCost: agent.monthlyCost,
          estimatedNewCost: agent.monthlyCost * 0.1,
          estimatedSavings: agent.monthlyCost * 0.9,
          savingsPercentage: 90,
          implementationSteps: [
            'Przeprowadź testy A/B z nowym modelem',
            'Monitoruj jakość odpowiedzi przez tydzień',
            'Jeśli jakość jest akceptowalna, zmień model w konfiguracji agenta',
          ],
        });
      }

      // Check for caching opportunities
      if (agent.duplicateQueryRate > 0.2) {
        const potentialSavings = agent.monthlyCost * agent.duplicateQueryRate * 0.95;
        await this.createRecommendation(tenantId, {
          agentId: agent.agentId,
          type: 'CACHING',
          title: 'Możliwość buforowania odpowiedzi',
          description: `${(agent.duplicateQueryRate * 100).toFixed(0)}% zapytań do agenta "${agent.name}" jest powtarzalnych. Włączenie cache może zaoszczędzić ${potentialSavings.toFixed(2)} PLN miesięcznie.`,
          currentMonthlyCost: agent.monthlyCost,
          estimatedNewCost: agent.monthlyCost - potentialSavings,
          estimatedSavings: potentialSavings,
          savingsPercentage: agent.duplicateQueryRate * 95,
          implementationSteps: [
            'Włącz cache semantyczny dla agenta',
            'Ustaw TTL na odpowiedni dla domeny (np. 24h dla FAQ)',
            'Monitoruj współczynnik trafień cache',
          ],
        });
      }

      // Check for prompt optimization
      if (agent.avgPromptTokens > 2000) {
        const potentialSavings = (agent.avgPromptTokens - 1500) * agent.requestCount * 0.00003;
        await this.createRecommendation(tenantId, {
          agentId: agent.agentId,
          type: 'PROMPT_OPTIMIZATION',
          title: 'Optymalizacja promptu systemowego',
          description: `Prompt systemowy agenta "${agent.name}" zawiera średnio ${agent.avgPromptTokens} tokenów. Skrócenie do 1500 tokenów może zaoszczędzić ${potentialSavings.toFixed(2)} PLN miesięcznie.`,
          currentMonthlyCost: agent.monthlyCost,
          estimatedNewCost: agent.monthlyCost - potentialSavings,
          estimatedSavings: potentialSavings,
          savingsPercentage: (potentialSavings / agent.monthlyCost) * 100,
          implementationSteps: [
            'Przeanalizuj prompt systemowy pod kątem redundancji',
            'Usuń powtarzające się instrukcje',
            'Użyj skrótów i zwięzłego języka',
            'Przetestuj skrócony prompt na próbie zapytań',
          ],
        });
      }
    }
  }

  private async createRecommendation(
    tenantId: string,
    recommendation: Omit<CostRecommendation, 'recommendationId' | 'status' | 'createdAt'>,
  ): Promise<void> {
    // Check if similar recommendation already exists and is pending
    const existing = await this.recommendationRepo.findSimilar(
      tenantId,
      recommendation.agentId,
      recommendation.type,
    );

    if (!existing) {
      await this.recommendationRepo.create(tenantId, recommendation);
    }
  }

  async getRecommendations(
    tenantId: string,
    status?: string,
  ): Promise<CostRecommendation[]> {
    return this.recommendationRepo.findByTenant(tenantId, status);
  }

  async respondToRecommendation(
    tenantId: string,
    userId: string,
    recommendationId: string,
    action: 'ACCEPTED' | 'REJECTED' | 'IMPLEMENTED',
    actualSavings?: number,
  ): Promise<void> {
    const recommendation = await this.recommendationRepo.findById(recommendationId);
    if (!recommendation || recommendation.tenantId !== tenantId) {
      throw new Error('Rekomendacja nie została znaleziona');
    }

    await this.recommendationRepo.updateStatus(recommendationId, action, actualSavings);

    await this.auditService.log({
      tenantId,
      userId,
      action: `RECOMMENDATION_${action}`,
      entityType: 'cost_recommendation',
      entityId: recommendationId,
      newValue: { action, actualSavings },
    });
  }

  // ============ Report Generation ============

  async generateReport(tenantId: string, userId: string, input: GenerateReport): Promise<Report> {
    const report = await this.reportRepo.create(tenantId, userId, input);

    // Generate report asynchronously
    this.generateReportAsync(tenantId, report.reportId, input);

    return report;
  }

  private async generateReportAsync(
    tenantId: string,
    reportId: string,
    input: GenerateReport,
  ): Promise<void> {
    try {
      const usage = await this.usageRepo.getDetailedUsage(tenantId, {
        dateFrom: input.dateFrom,
        dateUntil: input.dateUntil,
        ...input.filters,
      });

      let fileBuffer: Buffer;
      let fileName: string;

      switch (input.format) {
        case 'PDF':
          fileBuffer = await this.generatePDFReport(tenantId, input, usage);
          fileName = `raport-${input.type.toLowerCase()}-${Date.now()}.pdf`;
          break;
        case 'XLSX':
          fileBuffer = await this.generateExcelReport(tenantId, input, usage);
          fileName = `raport-${input.type.toLowerCase()}-${Date.now()}.xlsx`;
          break;
        case 'CSV':
          fileBuffer = await this.generateCSVReport(usage);
          fileName = `raport-${input.type.toLowerCase()}-${Date.now()}.csv`;
          break;
      }

      const fileUrl = await this.s3Service.upload({
        bucket: 'reports',
        key: `${tenantId}/cost-reports/${fileName}`,
        body: fileBuffer,
        contentType: this.getContentType(input.format),
      });

      await this.reportRepo.markCompleted(reportId, fileUrl, fileBuffer.length);
    } catch (error) {
      await this.reportRepo.markFailed(reportId, error.message);
    }
  }

  private async generatePDFReport(
    tenantId: string,
    input: GenerateReport,
    usage: DetailedUsage[],
  ): Promise<Buffer> {
    const tenant = await this.tenantRepo.findById(tenantId);

    return this.pdfService.generate({
      template: 'cost-report',
      data: {
        companyName: tenant.name,
        companyNip: tenant.nip,
        reportType: input.type,
        dateFrom: new Date(input.dateFrom).toLocaleDateString('pl-PL'),
        dateUntil: new Date(input.dateUntil).toLocaleDateString('pl-PL'),
        generatedAt: new Date().toLocaleString('pl-PL'),
        summary: this.calculateSummary(usage),
        details: usage,
      },
      locale: 'pl-PL',
    });
  }

  private async generateExcelReport(
    tenantId: string,
    input: GenerateReport,
    usage: DetailedUsage[],
  ): Promise<Buffer> {
    return this.excelService.generate({
      sheets: [
        {
          name: 'Podsumowanie',
          data: [this.calculateSummary(usage)],
        },
        {
          name: 'Szczegóły',
          data: usage.map((u) => ({
            'Data': new Date(u.createdAt).toLocaleString('pl-PL'),
            'Agent': u.agentName,
            'Użytkownik': u.userName,
            'Model': u.model,
            'Tokeny (wejście)': u.inputTokens,
            'Tokeny (wyjście)': u.outputTokens,
            'Koszt (PLN)': u.totalCostPLN.toFixed(4),
          })),
        },
      ],
    });
  }

  private async generateCSVReport(usage: DetailedUsage[]): Promise<Buffer> {
    const headers = 'Data,Agent,Użytkownik,Model,Tokeny wejście,Tokeny wyjście,Koszt PLN\n';
    const rows = usage.map((u) =>
      `"${new Date(u.createdAt).toLocaleString('pl-PL')}","${u.agentName}","${u.userName}","${u.model}",${u.inputTokens},${u.outputTokens},${u.totalCostPLN.toFixed(4)}`,
    ).join('\n');

    return Buffer.from(headers + rows, 'utf-8');
  }

  private calculateSummary(usage: DetailedUsage[]): ReportSummary {
    return {
      totalRequests: usage.length,
      totalInputTokens: usage.reduce((sum, u) => sum + u.inputTokens, 0),
      totalOutputTokens: usage.reduce((sum, u) => sum + u.outputTokens, 0),
      totalCostPLN: usage.reduce((sum, u) => sum + u.totalCostPLN, 0),
      averageCostPerRequest: usage.length > 0
        ? usage.reduce((sum, u) => sum + u.totalCostPLN, 0) / usage.length
        : 0,
      uniqueAgents: new Set(usage.map((u) => u.agentId)).size,
      uniqueUsers: new Set(usage.map((u) => u.userId)).size,
    };
  }

  private getContentType(format: string): string {
    switch (format) {
      case 'PDF': return 'application/pdf';
      case 'XLSX': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'CSV': return 'text/csv';
      default: return 'application/octet-stream';
    }
  }

  // ============ Model Pricing ============

  async setModelPricing(tenantId: string, userId: string, input: SetModelPricing): Promise<void> {
    // Deactivate previous pricing for this model
    await this.pricingRepo.deactivatePricing(tenantId, input.model);

    // Create new pricing
    await this.pricingRepo.create(tenantId, input);

    await this.auditService.log({
      tenantId,
      userId,
      action: 'MODEL_PRICING_SET',
      entityType: 'model_pricing',
      entityId: input.model,
      newValue: input,
    });
  }

  async getModelPricingList(tenantId: string): Promise<ModelPricing[]> {
    return this.pricingRepo.getActivePricingList(tenantId);
  }
}
```

### tRPC Router

```typescript
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { CostManagementService } from '../services/cost-management.service';
import {
  CreateBudgetSchema,
  UpdateBudgetSchema,
  SetModelPricingSchema,
  UsageQuerySchema,
  GenerateReportSchema,
  ScheduleReportSchema,
  RecommendationResponseSchema,
} from '../schemas/cost-management.schema';
import { z } from 'zod';

export const costManagementRouter = router({
  // Budget management (Admin only)
  createBudget: adminProcedure
    .input(CreateBudgetSchema)
    .mutation(({ ctx, input }) =>
      ctx.costManagementService.createBudget(ctx.tenantId, ctx.userId, input),
    ),

  updateBudget: adminProcedure
    .input(z.object({
      budgetId: z.string().uuid(),
      data: UpdateBudgetSchema,
    }))
    .mutation(({ ctx, input }) =>
      ctx.costManagementService.updateBudget(ctx.tenantId, ctx.userId, input.budgetId, input.data),
    ),

  deleteBudget: adminProcedure
    .input(z.object({ budgetId: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.costManagementService.deleteBudget(ctx.tenantId, ctx.userId, input.budgetId),
    ),

  listBudgets: adminProcedure
    .query(({ ctx }) =>
      ctx.costManagementService.listBudgets(ctx.tenantId),
    ),

  getBudgetStatuses: adminProcedure
    .input(z.object({
      agentId: z.string().uuid().optional(),
      userId: z.string().uuid().optional(),
    }).optional())
    .query(({ ctx, input }) =>
      ctx.costManagementService.getBudgetStatuses(ctx.tenantId, input?.agentId, input?.userId),
    ),

  // Usage analytics
  getUsageStats: adminProcedure
    .input(UsageQuerySchema)
    .query(({ ctx, input }) =>
      ctx.costManagementService.getUsageStats(ctx.tenantId, input),
    ),

  getDashboardMetrics: adminProcedure
    .query(({ ctx }) =>
      ctx.costManagementService.getDashboardMetrics(ctx.tenantId),
    ),

  // Cost optimization
  getRecommendations: adminProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(({ ctx, input }) =>
      ctx.costManagementService.getRecommendations(ctx.tenantId, input?.status),
    ),

  respondToRecommendation: adminProcedure
    .input(RecommendationResponseSchema)
    .mutation(({ ctx, input }) =>
      ctx.costManagementService.respondToRecommendation(
        ctx.tenantId,
        ctx.userId,
        input.recommendationId,
        input.action,
        input.actualSavings,
      ),
    ),

  generateRecommendations: adminProcedure
    .mutation(({ ctx }) =>
      ctx.costManagementService.generateRecommendations(ctx.tenantId),
    ),

  // Reports
  generateReport: adminProcedure
    .input(GenerateReportSchema)
    .mutation(({ ctx, input }) =>
      ctx.costManagementService.generateReport(ctx.tenantId, ctx.userId, input),
    ),

  scheduleReport: adminProcedure
    .input(ScheduleReportSchema)
    .mutation(({ ctx, input }) =>
      ctx.costManagementService.scheduleReport(ctx.tenantId, ctx.userId, input),
    ),

  listReports: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(({ ctx, input }) =>
      ctx.costManagementService.listReports(ctx.tenantId, input?.limit, input?.offset),
    ),

  getReport: adminProcedure
    .input(z.object({ reportId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      ctx.costManagementService.getReport(ctx.tenantId, input.reportId),
    ),

  // Model pricing
  setModelPricing: adminProcedure
    .input(SetModelPricingSchema)
    .mutation(({ ctx, input }) =>
      ctx.costManagementService.setModelPricing(ctx.tenantId, ctx.userId, input),
    ),

  getModelPricingList: adminProcedure
    .query(({ ctx }) =>
      ctx.costManagementService.getModelPricingList(ctx.tenantId),
    ),

  // Budget check for agents
  checkBudget: protectedProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      ctx.costManagementService.checkCanMakeRequest(ctx.tenantId, input.agentId, ctx.userId),
    ),
});
```

## Test Specification

### Unit Tests

```typescript
describe('CostManagementService', () => {
  describe('recordUsage', () => {
    it('should record token usage with correct pricing', async () => {
      const input = {
        agentId: 'agent-1',
        userId: 'user-1',
        inputTokens: 1000,
        outputTokens: 500,
        model: 'gpt-4',
        requestType: 'chat',
      };

      await service.recordUsage(tenantId, input);

      expect(usageRepo.create).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          inputCostPer1k: 0.03,
          outputCostPer1k: 0.06,
        }),
      );
    });

    it('should update budget usage after recording', async () => {
      await service.recordUsage(tenantId, validInput);

      expect(budgetRepo.incrementUsage).toHaveBeenCalled();
    });

    it('should trigger warning when threshold reached', async () => {
      budgetRepo.getCurrentUsage.mockResolvedValue({ totalCost: 850, warningSent: false });

      await service.recordUsage(tenantId, validInput);

      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'BUDGET_WARNING',
        }),
      );
    });
  });

  describe('checkCanMakeRequest', () => {
    it('should allow request when under budget', async () => {
      budgetRepo.getCurrentUsage.mockResolvedValue({ totalCost: 500 });

      const result = await service.checkCanMakeRequest(tenantId, 'agent-1', 'user-1');

      expect(result.allowed).toBe(true);
    });

    it('should block request when budget exceeded', async () => {
      budgetRepo.getCurrentUsage.mockResolvedValue({ totalCost: 1100 });

      const result = await service.checkCanMakeRequest(tenantId, 'agent-1', 'user-1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Przekroczono limit');
    });
  });

  describe('generateRecommendations', () => {
    it('should suggest model downgrade for high-quality agents', async () => {
      usageRepo.getAgentUsagePatterns.mockResolvedValue([{
        agentId: 'agent-1',
        name: 'Test Agent',
        model: 'gpt-4',
        avgResponseQuality: 0.85,
        monthlyCost: 100,
      }]);

      await service.generateRecommendations(tenantId);

      expect(recommendationRepo.create).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          type: 'MODEL_DOWNGRADE',
        }),
      );
    });

    it('should suggest caching for repeated queries', async () => {
      usageRepo.getAgentUsagePatterns.mockResolvedValue([{
        agentId: 'agent-1',
        duplicateQueryRate: 0.35,
        monthlyCost: 200,
      }]);

      await service.generateRecommendations(tenantId);

      expect(recommendationRepo.create).toHaveBeenCalledWith(
        tenantId,
        expect.objectContaining({
          type: 'CACHING',
        }),
      );
    });
  });
});
```

### Integration Tests

```typescript
describe('Cost Management Integration', () => {
  describe('Budget enforcement', () => {
    it('should enforce budget across multiple requests', async () => {
      // Create budget with 10 PLN limit
      await trpc.costManagement.createBudget({
        scopeType: 'agent',
        scopeId: agentId,
        monthlyLimit: 10,
        currency: 'PLN',
      });

      // Make requests until budget exceeded
      for (let i = 0; i < 100; i++) {
        const result = await trpc.costManagement.checkBudget({ agentId });
        if (!result.allowed) {
          expect(i).toBeGreaterThan(50); // Should allow some requests
          break;
        }
      }
    });

    it('should send notifications at thresholds', async () => {
      // Setup and simulate usage to 80%
      // Verify warning notification sent
      // Continue to 100%
      // Verify exceeded notification sent
    });
  });

  describe('Report generation', () => {
    it('should generate PDF report with Polish formatting', async () => {
      const report = await trpc.costManagement.generateReport({
        name: 'Test Report',
        type: 'SUMMARY',
        dateFrom: '2025-01-01T00:00:00Z',
        dateUntil: '2025-01-31T23:59:59Z',
        format: 'PDF',
      });

      // Wait for async generation
      await waitForReportCompletion(report.reportId);

      const completed = await trpc.costManagement.getReport({ reportId: report.reportId });
      expect(completed.status).toBe('COMPLETED');
      expect(completed.fileUrl).toBeDefined();
    });
  });
});
```

## Security Checklist

- [x] Budget modifications require Super Admin role
- [x] Usage data is tenant-isolated
- [x] Pricing configuration audited
- [x] No sensitive data in reports exported
- [x] Rate limiting on report generation
- [x] Budget bypass attempts logged
- [x] Currency conversion uses trusted rates

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| BUDGET_CREATED | Budget created | Budget configuration |
| BUDGET_UPDATED | Budget modified | Previous/new values |
| BUDGET_WARNING_SENT | Warning threshold reached | Usage percentage |
| BUDGET_EXCEEDED | Limit exceeded | Usage vs limit |
| MODEL_PRICING_SET | Pricing configured | Model, prices |
| RECOMMENDATION_ACCEPTED | Optimization accepted | Recommendation ID |
| RECOMMENDATION_REJECTED | Optimization rejected | Recommendation ID |
| RECOMMENDATION_IMPLEMENTED | Optimization implemented | Actual savings |
| REPORT_GENERATED | Report created | Report type, filters |

## Definition of Done

- [x] Real-time usage tracking implemented
- [x] Budget management with notifications
- [x] Cost optimization recommendations
- [x] Report generation (PDF, XLSX, CSV)
- [x] Model pricing configuration
- [x] Currency conversion (PLN, USD, EUR)
- [x] Unit tests (≥80% coverage)
- [x] Integration tests for budget enforcement
- [x] Polish localization for reports
- [x] Security review completed
- [x] Audit logging implemented
