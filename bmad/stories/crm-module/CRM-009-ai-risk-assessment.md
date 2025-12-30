# CRM-009: AI Risk Assessment

> **Story ID**: CRM-009
> **Epic**: Core CRM Module
> **Priority**: P1 (Important)
> **Points**: 8
> **Status**: 📋 Ready for Development
> **Phase**: Week 7

---

## User Story

**As an** accountant,
**I want** AI-powered risk assessment for my clients,
**So that** I can proactively manage client relationships and identify potential issues.

---

## Acceptance Criteria

### AC1: Risk Score Calculation
```gherkin
Feature: Calculate client risk score

  Scenario: Calculate risk score for new client
    Given I have a new client "ABC Sp. z o.o."
    When the system calculates risk score
    Then I should see a risk score between 0 and 100
    And risk level should be categorized (LOW, MEDIUM, HIGH, CRITICAL)
    And contributing factors should be listed

  Scenario: Risk score based on VAT status
    Given client has VAT status "INVALID"
    When risk score is calculated
    Then VAT status factor should contribute to higher risk
    And I should see "Invalid VAT status" as a risk factor

  Scenario: Risk score based on payment history
    Given client has 3 overdue invoices
    When risk score is calculated
    Then payment history factor should contribute to higher risk
    And I should see "Overdue payments" as a risk factor

  Scenario: Risk score based on document completeness
    Given client is missing required documents
    When risk score is calculated
    Then documentation factor should contribute to risk
    And I should see "Missing documents" as a risk factor
```

### AC2: Churn Prediction
```gherkin
Feature: Predict client churn probability

  Scenario: Predict churn for active client
    Given client "ABC Sp. z o.o." has been active for 2 years
    And client engagement has decreased in last 3 months
    When churn prediction is calculated
    Then I should see churn probability percentage
    And I should see contributing factors
    And I should see recommended retention actions

  Scenario: Low engagement triggers churn warning
    Given client has not interacted in 60 days
    And no documents uploaded in 90 days
    When churn prediction runs
    Then churn probability should be HIGH
    And alert should be generated for accountant

  Scenario: Seasonal pattern detection
    Given client is in seasonal industry (agriculture)
    And low activity is expected in winter
    When churn prediction runs
    Then seasonal pattern should be considered
    And churn probability should not be artificially inflated
```

### AC3: Financial Health Analysis
```gherkin
Feature: Analyze client financial health

  Scenario: Analyze financial ratios
    Given client has financial data from accounting module
    When financial health analysis runs
    Then I should see liquidity ratio
    And I should see profitability indicators
    And I should see trend analysis

  Scenario: Compare to industry benchmarks
    Given client is in "IT Services" industry
    When financial health is analyzed
    Then metrics should be compared to industry average
    And deviations should be highlighted

  Scenario: Detect financial anomalies
    Given client's revenue dropped 40% month-over-month
    When financial analysis runs
    Then anomaly should be detected
    And alert should be generated
    And possible causes should be suggested
```

### AC4: Risk Dashboard
```gherkin
Feature: View risk analytics dashboard

  Scenario: View portfolio risk overview
    Given I am logged in as an accountant
    When I navigate to risk dashboard
    Then I should see overall portfolio risk distribution
    And I should see high-risk clients list
    And I should see risk trend chart

  Scenario: Drill down to client risk details
    Given I see client "ABC Sp. z o.o." in high-risk list
    When I click on the client
    Then I should see detailed risk breakdown
    And I should see risk history timeline
    And I should see AI recommendations

  Scenario: Filter by risk level
    Given I am on risk dashboard
    When I filter by "HIGH" risk level
    Then I should see only high-risk clients
    And count should match high-risk total
```

### AC5: Risk Alerts and Notifications
```gherkin
Feature: Receive risk alerts

  Scenario: Alert on risk level change
    Given client was LOW risk yesterday
    And client became HIGH risk today
    When risk assessment runs
    Then I should receive notification about risk change
    And notification should include reason for change
    And notification should include recommended actions

  Scenario: Configure alert thresholds
    Given I want alerts only for CRITICAL risk
    When I configure notification preferences
    And set threshold to "CRITICAL"
    Then I should only receive CRITICAL risk alerts
    And lower risk changes should be logged but not alerted

  Scenario: Weekly risk summary
    Given I have enabled weekly summary
    When Sunday arrives
    Then I should receive weekly risk summary email
    And summary should include risk changes
    And summary should include action items
```

### AC6: AI Recommendations
```gherkin
Feature: Receive AI-powered recommendations

  Scenario: Get retention recommendations
    Given client has HIGH churn probability
    When I view client risk assessment
    Then I should see retention recommendations
    And recommendations should be prioritized
    And I should be able to mark recommendations as acted upon

  Scenario: Get compliance recommendations
    Given client has VAT compliance issues
    When risk assessment identifies issues
    Then I should see specific compliance actions
    And actions should include deadlines
    And actions should link to relevant documents

  Scenario: Track recommendation effectiveness
    Given I followed retention recommendation last month
    And client is still active
    When I view recommendations history
    Then I should see recommendation was effective
    And this should improve future recommendations
```

---

## Technical Specification

### Database Schema

```sql
-- Risk assessment results
CREATE TABLE client_risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Overall risk score (0-100)
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    previous_risk_level VARCHAR(20),

    -- Churn prediction (0-100)
    churn_probability INTEGER CHECK (churn_probability >= 0 AND churn_probability <= 100),

    -- Financial health score (0-100)
    financial_health_score INTEGER CHECK (financial_health_score >= 0 AND financial_health_score <= 100),

    -- Factor breakdown (JSON)
    risk_factors JSONB NOT NULL DEFAULT '[]',
    churn_factors JSONB NOT NULL DEFAULT '[]',
    financial_factors JSONB NOT NULL DEFAULT '[]',

    -- AI recommendations
    recommendations JSONB NOT NULL DEFAULT '[]',

    -- Metadata
    model_version VARCHAR(50) NOT NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,

    -- Status
    is_current BOOLEAN NOT NULL DEFAULT TRUE,

    UNIQUE(client_id, is_current) -- Only one current assessment per client
);

-- Risk factor definitions (configurable weights)
CREATE TABLE risk_factor_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    factor_code VARCHAR(50) NOT NULL,
    factor_name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Factor configuration
    category VARCHAR(50) NOT NULL, -- COMPLIANCE, FINANCIAL, ENGAGEMENT, EXTERNAL
    weight DECIMAL(5, 2) NOT NULL DEFAULT 1.0,

    -- Scoring rules (JSON)
    scoring_rules JSONB NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(organization_id, factor_code)
);

-- Risk alerts history
CREATE TABLE risk_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES client_risk_assessments(id),

    alert_type VARCHAR(50) NOT NULL, -- RISK_INCREASED, RISK_CRITICAL, CHURN_WARNING, ANOMALY_DETECTED
    severity VARCHAR(20) NOT NULL, -- INFO, WARNING, CRITICAL

    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,

    -- State
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    dismissed_by UUID REFERENCES users(id),
    dismissed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recommendation tracking
CREATE TABLE risk_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES client_risk_assessments(id),

    recommendation_type VARCHAR(50) NOT NULL, -- RETENTION, COMPLIANCE, FINANCIAL, ENGAGEMENT
    priority VARCHAR(20) NOT NULL, -- HIGH, MEDIUM, LOW

    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    action_items JSONB NOT NULL DEFAULT '[]',

    -- Deadline if applicable
    due_date DATE,

    -- Status tracking
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, DISMISSED
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id),

    -- Effectiveness tracking
    was_effective BOOLEAN,
    effectiveness_notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Risk assessment history for trend analysis
CREATE TABLE risk_assessment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    risk_score INTEGER NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    churn_probability INTEGER,
    financial_health_score INTEGER,

    recorded_at DATE NOT NULL,

    UNIQUE(client_id, recorded_at)
);

-- Indexes
CREATE INDEX idx_risk_assessments_client ON client_risk_assessments(client_id);
CREATE INDEX idx_risk_assessments_org ON client_risk_assessments(organization_id);
CREATE INDEX idx_risk_assessments_current ON client_risk_assessments(client_id, is_current) WHERE is_current = TRUE;
CREATE INDEX idx_risk_assessments_level ON client_risk_assessments(risk_level) WHERE is_current = TRUE;
CREATE INDEX idx_risk_alerts_org_unread ON risk_alerts(organization_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_risk_recommendations_status ON risk_recommendations(status) WHERE status != 'COMPLETED';
CREATE INDEX idx_risk_history_client_date ON risk_assessment_history(client_id, recorded_at);

-- RLS policies
ALTER TABLE client_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_factor_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY risk_assessments_org_policy ON client_risk_assessments
    FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);

CREATE POLICY risk_factors_org_policy ON risk_factor_definitions
    FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);

CREATE POLICY risk_alerts_org_policy ON risk_alerts
    FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);

CREATE POLICY risk_recommendations_org_policy ON risk_recommendations
    FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);

CREATE POLICY risk_history_org_policy ON risk_assessment_history
    FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Risk levels
export const RiskLevel = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type RiskLevel = z.infer<typeof RiskLevel>;

// Risk factor schema
export const RiskFactorSchema = z.object({
  code: z.string(),
  name: z.string(),
  category: z.enum(['COMPLIANCE', 'FINANCIAL', 'ENGAGEMENT', 'EXTERNAL']),
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(10),
  contribution: z.number().min(0).max(100), // Weighted contribution to final score
  description: z.string(),
  severity: RiskLevel,
  data: z.record(z.any()).optional(), // Supporting data
});

export type RiskFactor = z.infer<typeof RiskFactorSchema>;

// Churn factor schema
export const ChurnFactorSchema = z.object({
  code: z.string(),
  name: z.string(),
  probability_contribution: z.number().min(0).max(100),
  description: z.string(),
  trend: z.enum(['IMPROVING', 'STABLE', 'DECLINING']),
  data: z.record(z.any()).optional(),
});

export type ChurnFactor = z.infer<typeof ChurnFactorSchema>;

// Financial factor schema
export const FinancialFactorSchema = z.object({
  code: z.string(),
  name: z.string(),
  value: z.number(),
  benchmark: z.number().optional(),
  deviation_percent: z.number().optional(),
  status: z.enum(['HEALTHY', 'WARNING', 'CRITICAL']),
  description: z.string(),
});

export type FinancialFactor = z.infer<typeof FinancialFactorSchema>;

// Recommendation schema
export const RecommendationSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['RETENTION', 'COMPLIANCE', 'FINANCIAL', 'ENGAGEMENT']),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  title: z.string(),
  description: z.string(),
  actionItems: z.array(z.object({
    action: z.string(),
    deadline: z.date().optional(),
    link: z.string().url().optional(),
  })),
  dueDate: z.date().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED']),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

// Full risk assessment result
export const RiskAssessmentSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),

  // Overall scores
  riskScore: z.number().min(0).max(100),
  riskLevel: RiskLevel,
  previousRiskLevel: RiskLevel.nullable(),
  riskChange: z.enum(['INCREASED', 'DECREASED', 'STABLE']).optional(),

  churnProbability: z.number().min(0).max(100).nullable(),
  financialHealthScore: z.number().min(0).max(100).nullable(),

  // Detailed factors
  riskFactors: z.array(RiskFactorSchema),
  churnFactors: z.array(ChurnFactorSchema),
  financialFactors: z.array(FinancialFactorSchema),

  // Recommendations
  recommendations: z.array(RecommendationSchema),

  // Metadata
  modelVersion: z.string(),
  calculatedAt: z.date(),
  expiresAt: z.date(),
});

export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

// Alert schema
export const RiskAlertSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  clientName: z.string(),

  alertType: z.enum(['RISK_INCREASED', 'RISK_CRITICAL', 'CHURN_WARNING', 'ANOMALY_DETECTED']),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),

  title: z.string(),
  message: z.string(),

  isRead: z.boolean(),
  isDismissed: z.boolean(),

  createdAt: z.date(),
});

export type RiskAlert = z.infer<typeof RiskAlertSchema>;

// Dashboard schemas
export const RiskDistributionSchema = z.object({
  low: z.number(),
  medium: z.number(),
  high: z.number(),
  critical: z.number(),
  total: z.number(),
});

export const PortfolioRiskSummarySchema = z.object({
  distribution: RiskDistributionSchema,
  averageRiskScore: z.number(),
  averageChurnProbability: z.number(),
  highRiskClients: z.array(z.object({
    id: z.string().uuid(),
    companyName: z.string(),
    riskScore: z.number(),
    riskLevel: RiskLevel,
    topRiskFactor: z.string(),
  })),
  recentAlerts: z.array(RiskAlertSchema),
  trendData: z.array(z.object({
    date: z.date(),
    averageScore: z.number(),
    highRiskCount: z.number(),
  })),
});

export type PortfolioRiskSummary = z.infer<typeof PortfolioRiskSummarySchema>;

// Input schemas
export const CalculateRiskInputSchema = z.object({
  clientId: z.string().uuid(),
  forceRecalculate: z.boolean().default(false),
});

export const GetRiskHistoryInputSchema = z.object({
  clientId: z.string().uuid(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
});

export const UpdateRecommendationStatusSchema = z.object({
  recommendationId: z.string().uuid(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'DISMISSED']),
  notes: z.string().max(1000).optional(),
  wasEffective: z.boolean().optional(),
});
```

### Risk Assessment Service

```typescript
// src/server/services/crm/risk-assessment.service.ts
import { db } from '@/server/db';
import { TRPCError } from '@trpc/server';
import type {
  RiskAssessment,
  RiskFactor,
  ChurnFactor,
  FinancialFactor,
  RiskLevel,
  Recommendation
} from './risk-assessment.schema';

const MODEL_VERSION = '1.0.0';
const ASSESSMENT_VALIDITY_HOURS = 24;

export class RiskAssessmentService {
  /**
   * Calculate or retrieve risk assessment for a client
   */
  async getClientRiskAssessment(
    organizationId: string,
    clientId: string,
    forceRecalculate = false
  ): Promise<RiskAssessment> {
    // Check for valid cached assessment
    if (!forceRecalculate) {
      const existing = await db('client_risk_assessments')
        .where('client_id', clientId)
        .where('organization_id', organizationId)
        .where('is_current', true)
        .where('expires_at', '>', new Date())
        .first();

      if (existing) {
        return this.mapAssessmentToResponse(existing);
      }
    }

    // Calculate new assessment
    return this.calculateRiskAssessment(organizationId, clientId);
  }

  /**
   * Calculate full risk assessment
   */
  private async calculateRiskAssessment(
    organizationId: string,
    clientId: string
  ): Promise<RiskAssessment> {
    // Get client data
    const client = await db('clients')
      .where('id', clientId)
      .where('organization_id', organizationId)
      .first();

    if (!client) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Client not found',
      });
    }

    // Get factor definitions
    const factorDefinitions = await this.getFactorDefinitions(organizationId);

    // Calculate risk factors
    const riskFactors = await this.calculateRiskFactors(
      organizationId,
      clientId,
      client,
      factorDefinitions
    );

    // Calculate churn factors
    const churnFactors = await this.calculateChurnFactors(
      organizationId,
      clientId,
      client
    );

    // Calculate financial factors
    const financialFactors = await this.calculateFinancialFactors(
      organizationId,
      clientId
    );

    // Calculate aggregate scores
    const riskScore = this.calculateAggregateRiskScore(riskFactors);
    const riskLevel = this.scoreToLevel(riskScore);
    const churnProbability = this.calculateChurnProbability(churnFactors);
    const financialHealthScore = this.calculateFinancialHealthScore(financialFactors);

    // Generate recommendations
    const recommendations = await this.generateRecommendations(
      organizationId,
      clientId,
      riskFactors,
      churnFactors,
      financialFactors
    );

    // Get previous assessment for comparison
    const previousAssessment = await db('client_risk_assessments')
      .where('client_id', clientId)
      .where('is_current', true)
      .first();

    // Mark previous as non-current
    if (previousAssessment) {
      await db('client_risk_assessments')
        .where('id', previousAssessment.id)
        .update({ is_current: false });
    }

    // Store new assessment
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ASSESSMENT_VALIDITY_HOURS);

    const [assessment] = await db('client_risk_assessments')
      .insert({
        client_id: clientId,
        organization_id: organizationId,
        risk_score: riskScore,
        risk_level: riskLevel,
        previous_risk_level: previousAssessment?.risk_level,
        churn_probability: churnProbability,
        financial_health_score: financialHealthScore,
        risk_factors: JSON.stringify(riskFactors),
        churn_factors: JSON.stringify(churnFactors),
        financial_factors: JSON.stringify(financialFactors),
        recommendations: JSON.stringify(recommendations),
        model_version: MODEL_VERSION,
        expires_at: expiresAt,
        is_current: true,
      })
      .returning('*');

    // Store in history for trend analysis
    await this.recordHistoryEntry(organizationId, clientId, {
      riskScore,
      riskLevel,
      churnProbability,
      financialHealthScore,
    });

    // Generate alerts if needed
    await this.generateAlerts(
      organizationId,
      clientId,
      assessment.id,
      riskLevel,
      previousAssessment?.risk_level,
      churnProbability
    );

    // Store recommendations
    await this.storeRecommendations(
      organizationId,
      clientId,
      assessment.id,
      recommendations
    );

    return this.mapAssessmentToResponse(assessment);
  }

  /**
   * Calculate individual risk factors
   */
  private async calculateRiskFactors(
    organizationId: string,
    clientId: string,
    client: any,
    definitions: any[]
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    // VAT Status Factor
    factors.push(await this.calculateVatStatusFactor(client));

    // Payment History Factor
    factors.push(await this.calculatePaymentHistoryFactor(organizationId, clientId));

    // Document Completeness Factor
    factors.push(await this.calculateDocumentCompletenessFactor(organizationId, clientId));

    // Whitelist Status Factor
    factors.push(await this.calculateWhitelistFactor(clientId));

    // KSeF Compliance Factor (if applicable)
    factors.push(await this.calculateKsefComplianceFactor(organizationId, clientId));

    // External Data Factors (GUS, REGON status)
    factors.push(await this.calculateExternalDataFactor(client));

    return factors.filter(f => f !== null) as RiskFactor[];
  }

  private async calculateVatStatusFactor(client: any): Promise<RiskFactor> {
    let score = 0;
    let description = '';
    let severity: RiskLevel = 'LOW';

    switch (client.vat_status) {
      case 'ACTIVE':
        score = 0;
        description = 'VAT status is active and verified';
        severity = 'LOW';
        break;
      case 'NOT_REGISTERED':
        score = 20;
        description = 'Client is not registered for VAT';
        severity = 'LOW';
        break;
      case 'INVALID':
        score = 80;
        description = 'VAT number is invalid or verification failed';
        severity = 'HIGH';
        break;
      case 'EXEMPT':
        score = 10;
        description = 'Client is VAT exempt';
        severity = 'LOW';
        break;
      default:
        score = 50;
        description = 'VAT status unknown';
        severity = 'MEDIUM';
    }

    return {
      code: 'VAT_STATUS',
      name: 'VAT Registration Status',
      category: 'COMPLIANCE',
      score,
      weight: 2.0,
      contribution: score * 2.0,
      description,
      severity,
      data: { vatStatus: client.vat_status },
    };
  }

  private async calculatePaymentHistoryFactor(
    organizationId: string,
    clientId: string
  ): Promise<RiskFactor> {
    // Get payment statistics from invoices
    const paymentStats = await db('invoices')
      .where('client_id', clientId)
      .where('organization_id', organizationId)
      .select(
        db.raw('COUNT(*) FILTER (WHERE status = \'OVERDUE\') as overdue_count'),
        db.raw('COUNT(*) FILTER (WHERE paid_at > due_date) as late_paid_count'),
        db.raw('COUNT(*) as total_count'),
        db.raw('AVG(EXTRACT(DAY FROM (paid_at - due_date))) FILTER (WHERE paid_at > due_date) as avg_days_late')
      )
      .first();

    const overdueCount = parseInt(paymentStats?.overdue_count || '0', 10);
    const latePaidCount = parseInt(paymentStats?.late_paid_count || '0', 10);
    const totalCount = parseInt(paymentStats?.total_count || '0', 10);
    const avgDaysLate = parseFloat(paymentStats?.avg_days_late || '0');

    let score = 0;
    let severity: RiskLevel = 'LOW';

    // Score based on overdue invoices
    if (overdueCount >= 3) {
      score += 40;
      severity = 'HIGH';
    } else if (overdueCount >= 1) {
      score += 20;
      severity = 'MEDIUM';
    }

    // Score based on late payment rate
    if (totalCount > 0) {
      const lateRate = latePaidCount / totalCount;
      if (lateRate > 0.5) {
        score += 30;
        severity = severity === 'LOW' ? 'MEDIUM' : severity;
      } else if (lateRate > 0.2) {
        score += 15;
      }
    }

    // Score based on average days late
    if (avgDaysLate > 30) {
      score += 20;
    } else if (avgDaysLate > 14) {
      score += 10;
    }

    return {
      code: 'PAYMENT_HISTORY',
      name: 'Payment History',
      category: 'FINANCIAL',
      score: Math.min(score, 100),
      weight: 2.5,
      contribution: Math.min(score, 100) * 2.5,
      description: overdueCount > 0
        ? `${overdueCount} overdue invoice(s), average ${Math.round(avgDaysLate)} days late`
        : 'Good payment history',
      severity,
      data: { overdueCount, latePaidCount, totalCount, avgDaysLate },
    };
  }

  private async calculateDocumentCompletenessFactor(
    organizationId: string,
    clientId: string
  ): Promise<RiskFactor> {
    // Check required documents
    const requiredDocs = ['KRS_EXTRACT', 'NIP_CONFIRMATION', 'AUTHORIZATION'];

    const existingDocs = await db('client_documents')
      .where('client_id', clientId)
      .where('organization_id', organizationId)
      .whereIn('document_type', requiredDocs)
      .select('document_type');

    const existingTypes = new Set(existingDocs.map(d => d.document_type));
    const missingDocs = requiredDocs.filter(t => !existingTypes.has(t));
    const completeness = (existingTypes.size / requiredDocs.length) * 100;

    let score = 100 - completeness;
    let severity: RiskLevel = 'LOW';

    if (missingDocs.length >= 2) {
      severity = 'HIGH';
    } else if (missingDocs.length === 1) {
      severity = 'MEDIUM';
    }

    return {
      code: 'DOCUMENT_COMPLETENESS',
      name: 'Document Completeness',
      category: 'COMPLIANCE',
      score,
      weight: 1.5,
      contribution: score * 1.5,
      description: missingDocs.length > 0
        ? `Missing documents: ${missingDocs.join(', ')}`
        : 'All required documents present',
      severity,
      data: { completeness, missingDocs },
    };
  }

  private async calculateWhitelistFactor(clientId: string): Promise<RiskFactor> {
    // Get latest whitelist verification
    const verification = await db('vat_verifications')
      .where('client_id', clientId)
      .where('verification_type', 'WHITELIST')
      .orderBy('verified_at', 'desc')
      .first();

    let score = 0;
    let severity: RiskLevel = 'LOW';
    let description = '';

    if (!verification) {
      score = 30;
      severity = 'MEDIUM';
      description = 'Whitelist status not verified';
    } else if (!verification.is_on_whitelist) {
      score = 70;
      severity = 'HIGH';
      description = 'Client not on VAT whitelist';
    } else {
      const verificationAge = Date.now() - new Date(verification.verified_at).getTime();
      const daysSinceVerification = verificationAge / (1000 * 60 * 60 * 24);

      if (daysSinceVerification > 30) {
        score = 20;
        severity = 'LOW';
        description = `Whitelist verified ${Math.round(daysSinceVerification)} days ago`;
      } else {
        score = 0;
        description = 'Client verified on whitelist';
      }
    }

    return {
      code: 'WHITELIST_STATUS',
      name: 'VAT Whitelist Status',
      category: 'COMPLIANCE',
      score,
      weight: 2.0,
      contribution: score * 2.0,
      description,
      severity,
      data: verification,
    };
  }

  private async calculateKsefComplianceFactor(
    organizationId: string,
    clientId: string
  ): Promise<RiskFactor | null> {
    // Check if organization uses KSeF
    const orgSettings = await db('organization_settings')
      .where('organization_id', organizationId)
      .where('key', 'ksef_enabled')
      .first();

    if (!orgSettings?.value || orgSettings.value !== 'true') {
      return null; // KSeF not applicable
    }

    // Check KSeF registration status
    const ksefStatus = await db('ksef_registrations')
      .where('client_id', clientId)
      .first();

    let score = 0;
    let severity: RiskLevel = 'LOW';

    if (!ksefStatus || ksefStatus.status !== 'ACTIVE') {
      score = 50;
      severity = 'MEDIUM';
    }

    return {
      code: 'KSEF_COMPLIANCE',
      name: 'KSeF Compliance',
      category: 'COMPLIANCE',
      score,
      weight: 1.5,
      contribution: score * 1.5,
      description: ksefStatus?.status === 'ACTIVE'
        ? 'KSeF registration active'
        : 'KSeF registration required',
      severity,
      data: ksefStatus,
    };
  }

  private async calculateExternalDataFactor(client: any): Promise<RiskFactor> {
    let score = 0;
    let severity: RiskLevel = 'LOW';
    const issues: string[] = [];

    // Check if GUS data is present and recent
    if (!client.gus_last_sync) {
      score += 15;
      issues.push('GUS data not synced');
    } else {
      const daysSinceSync = (Date.now() - new Date(client.gus_last_sync).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceSync > 90) {
        score += 10;
        issues.push('GUS data outdated');
      }
    }

    // Check REGON status
    if (client.regon_status === 'INACTIVE') {
      score += 30;
      severity = 'MEDIUM';
      issues.push('REGON status inactive');
    }

    // Check KRS status if applicable
    if (client.krs && client.krs_status === 'LIQUIDATION') {
      score += 50;
      severity = 'HIGH';
      issues.push('Company in liquidation');
    }

    return {
      code: 'EXTERNAL_DATA',
      name: 'External Registry Status',
      category: 'EXTERNAL',
      score,
      weight: 1.5,
      contribution: score * 1.5,
      description: issues.length > 0
        ? issues.join('; ')
        : 'External data verified and current',
      severity,
      data: {
        gusLastSync: client.gus_last_sync,
        regonStatus: client.regon_status,
        krsStatus: client.krs_status,
      },
    };
  }

  /**
   * Calculate churn prediction factors
   */
  private async calculateChurnFactors(
    organizationId: string,
    clientId: string,
    client: any
  ): Promise<ChurnFactor[]> {
    const factors: ChurnFactor[] = [];

    // Engagement factor (timeline activity)
    const recentActivity = await db('client_timeline')
      .where('client_id', clientId)
      .where('created_at', '>', db.raw("NOW() - INTERVAL '90 days'"))
      .count('* as count')
      .first();

    const activityCount = parseInt(recentActivity?.count || '0', 10);
    let engagementProbability = 0;
    let engagementTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE';

    if (activityCount === 0) {
      engagementProbability = 40;
      engagementTrend = 'DECLINING';
    } else if (activityCount < 5) {
      engagementProbability = 20;
      engagementTrend = 'DECLINING';
    }

    factors.push({
      code: 'ENGAGEMENT',
      name: 'Client Engagement',
      probability_contribution: engagementProbability,
      description: activityCount === 0
        ? 'No activity in last 90 days'
        : `${activityCount} interactions in last 90 days`,
      trend: engagementTrend,
      data: { activityCount },
    });

    // Document upload frequency
    const recentDocs = await db('client_documents')
      .where('client_id', clientId)
      .where('created_at', '>', db.raw("NOW() - INTERVAL '60 days'"))
      .count('* as count')
      .first();

    const docCount = parseInt(recentDocs?.count || '0', 10);
    let docProbability = 0;

    if (docCount === 0) {
      docProbability = 25;
    } else if (docCount < 3) {
      docProbability = 10;
    }

    factors.push({
      code: 'DOCUMENT_ACTIVITY',
      name: 'Document Activity',
      probability_contribution: docProbability,
      description: docCount === 0
        ? 'No documents uploaded in 60 days'
        : `${docCount} documents in last 60 days`,
      trend: docCount === 0 ? 'DECLINING' : 'STABLE',
      data: { docCount },
    });

    // Service usage trend
    const invoicesTrend = await db('invoices')
      .where('client_id', clientId)
      .select(
        db.raw("DATE_TRUNC('month', created_at) as month"),
        db.raw('SUM(total_amount) as amount')
      )
      .groupByRaw("DATE_TRUNC('month', created_at)")
      .orderBy('month', 'desc')
      .limit(6);

    if (invoicesTrend.length >= 3) {
      const recentAvg = (parseFloat(invoicesTrend[0]?.amount || '0') + parseFloat(invoicesTrend[1]?.amount || '0')) / 2;
      const previousAvg = (parseFloat(invoicesTrend[2]?.amount || '0') + parseFloat(invoicesTrend[3]?.amount || '0')) / 2;

      let revenueTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' = 'STABLE';
      let revenueProbability = 0;

      if (previousAvg > 0) {
        const changePercent = ((recentAvg - previousAvg) / previousAvg) * 100;

        if (changePercent < -30) {
          revenueProbability = 30;
          revenueTrend = 'DECLINING';
        } else if (changePercent < -10) {
          revenueProbability = 15;
          revenueTrend = 'DECLINING';
        } else if (changePercent > 10) {
          revenueTrend = 'IMPROVING';
        }
      }

      factors.push({
        code: 'REVENUE_TREND',
        name: 'Revenue Trend',
        probability_contribution: revenueProbability,
        description: revenueTrend === 'DECLINING'
          ? 'Revenue declining compared to previous period'
          : 'Revenue stable or growing',
        trend: revenueTrend,
        data: { invoicesTrend },
      });
    }

    // Client tenure (newer clients have higher churn risk)
    const tenureMonths = (Date.now() - new Date(client.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
    let tenureProbability = 0;

    if (tenureMonths < 3) {
      tenureProbability = 20;
    } else if (tenureMonths < 12) {
      tenureProbability = 10;
    }

    factors.push({
      code: 'TENURE',
      name: 'Client Tenure',
      probability_contribution: tenureProbability,
      description: tenureMonths < 3
        ? 'New client (< 3 months)'
        : tenureMonths < 12
          ? 'Recent client (< 1 year)'
          : `Long-term client (${Math.round(tenureMonths / 12)} years)`,
      trend: 'STABLE',
      data: { tenureMonths },
    });

    return factors;
  }

  /**
   * Calculate financial health factors
   */
  private async calculateFinancialFactors(
    organizationId: string,
    clientId: string
  ): Promise<FinancialFactor[]> {
    const factors: FinancialFactor[] = [];

    // Get latest financial data (from accounting module if available)
    const financialData = await db('client_financial_summaries')
      .where('client_id', clientId)
      .orderBy('period_end', 'desc')
      .first();

    if (financialData) {
      // Current ratio (liquidity)
      if (financialData.current_assets && financialData.current_liabilities) {
        const currentRatio = financialData.current_assets / financialData.current_liabilities;
        const benchmark = 1.5; // Industry standard

        factors.push({
          code: 'CURRENT_RATIO',
          name: 'Current Ratio (Liquidity)',
          value: currentRatio,
          benchmark,
          deviation_percent: ((currentRatio - benchmark) / benchmark) * 100,
          status: currentRatio >= 1.0 ? (currentRatio >= benchmark ? 'HEALTHY' : 'WARNING') : 'CRITICAL',
          description: currentRatio >= 1.0
            ? 'Adequate short-term liquidity'
            : 'Liquidity concerns - current liabilities exceed current assets',
        });
      }

      // Profit margin
      if (financialData.revenue && financialData.net_profit) {
        const profitMargin = (financialData.net_profit / financialData.revenue) * 100;
        const benchmark = 10; // 10% industry average

        factors.push({
          code: 'PROFIT_MARGIN',
          name: 'Net Profit Margin',
          value: profitMargin,
          benchmark,
          deviation_percent: ((profitMargin - benchmark) / benchmark) * 100,
          status: profitMargin >= 5 ? (profitMargin >= benchmark ? 'HEALTHY' : 'WARNING') : 'CRITICAL',
          description: `Net profit margin of ${profitMargin.toFixed(1)}%`,
        });
      }

      // Revenue growth
      const previousPeriod = await db('client_financial_summaries')
        .where('client_id', clientId)
        .where('period_end', '<', financialData.period_end)
        .orderBy('period_end', 'desc')
        .first();

      if (previousPeriod?.revenue && financialData.revenue) {
        const growthRate = ((financialData.revenue - previousPeriod.revenue) / previousPeriod.revenue) * 100;

        factors.push({
          code: 'REVENUE_GROWTH',
          name: 'Revenue Growth Rate',
          value: growthRate,
          benchmark: 5,
          deviation_percent: ((growthRate - 5) / 5) * 100,
          status: growthRate >= 0 ? (growthRate >= 5 ? 'HEALTHY' : 'WARNING') : 'CRITICAL',
          description: growthRate >= 0
            ? `Revenue grew ${growthRate.toFixed(1)}% YoY`
            : `Revenue declined ${Math.abs(growthRate).toFixed(1)}% YoY`,
        });
      }
    }

    // Invoice-based metrics
    const invoiceMetrics = await db('invoices')
      .where('client_id', clientId)
      .where('organization_id', organizationId)
      .select(
        db.raw('AVG(EXTRACT(DAY FROM (paid_at - issue_date))) as avg_payment_days'),
        db.raw('SUM(CASE WHEN status = \'OVERDUE\' THEN total_amount ELSE 0 END) as overdue_amount'),
        db.raw('SUM(total_amount) as total_invoiced')
      )
      .first();

    if (invoiceMetrics?.avg_payment_days) {
      const avgPaymentDays = parseFloat(invoiceMetrics.avg_payment_days);

      factors.push({
        code: 'PAYMENT_CYCLE',
        name: 'Average Payment Cycle',
        value: avgPaymentDays,
        benchmark: 30,
        deviation_percent: ((avgPaymentDays - 30) / 30) * 100,
        status: avgPaymentDays <= 30 ? 'HEALTHY' : (avgPaymentDays <= 60 ? 'WARNING' : 'CRITICAL'),
        description: `Average payment in ${Math.round(avgPaymentDays)} days`,
      });
    }

    return factors;
  }

  /**
   * Calculate aggregate risk score from factors
   */
  private calculateAggregateRiskScore(factors: RiskFactor[]): number {
    if (factors.length === 0) return 0;

    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedSum = factors.reduce((sum, f) => sum + (f.score * f.weight), 0);

    return Math.round(weightedSum / totalWeight);
  }

  /**
   * Convert score to risk level
   */
  private scoreToLevel(score: number): RiskLevel {
    if (score >= 75) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 25) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Calculate churn probability from factors
   */
  private calculateChurnProbability(factors: ChurnFactor[]): number {
    if (factors.length === 0) return 0;

    // Sum probability contributions (capped at 100)
    const totalProbability = factors.reduce((sum, f) => sum + f.probability_contribution, 0);
    return Math.min(Math.round(totalProbability), 100);
  }

  /**
   * Calculate financial health score from factors
   */
  private calculateFinancialHealthScore(factors: FinancialFactor[]): number {
    if (factors.length === 0) return 50; // Neutral if no data

    // Each factor contributes to overall health
    const healthyCount = factors.filter(f => f.status === 'HEALTHY').length;
    const warningCount = factors.filter(f => f.status === 'WARNING').length;
    const criticalCount = factors.filter(f => f.status === 'CRITICAL').length;

    const healthScore = (healthyCount * 100 + warningCount * 50 + criticalCount * 0) / factors.length;
    return Math.round(healthScore);
  }

  /**
   * Generate AI recommendations based on assessment
   */
  private async generateRecommendations(
    organizationId: string,
    clientId: string,
    riskFactors: RiskFactor[],
    churnFactors: ChurnFactor[],
    financialFactors: FinancialFactor[]
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Risk-based recommendations
    for (const factor of riskFactors) {
      if (factor.severity === 'HIGH' || factor.severity === 'CRITICAL') {
        switch (factor.code) {
          case 'VAT_STATUS':
            recommendations.push({
              id: crypto.randomUUID(),
              type: 'COMPLIANCE',
              priority: 'HIGH',
              title: 'Verify VAT Status',
              description: 'Client VAT status requires immediate attention',
              actionItems: [
                { action: 'Contact client to verify VAT registration' },
                { action: 'Re-run VIES validation' },
                { action: 'Check whitelist status' },
              ],
              status: 'PENDING',
            });
            break;

          case 'WHITELIST_STATUS':
            recommendations.push({
              id: crypto.randomUUID(),
              type: 'COMPLIANCE',
              priority: 'HIGH',
              title: 'Whitelist Verification Required',
              description: 'Client is not on VAT whitelist - verify bank account',
              actionItems: [
                { action: 'Verify client bank account number' },
                { action: 'Update bank account if needed' },
                { action: 'Re-check whitelist status' },
              ],
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              status: 'PENDING',
            });
            break;

          case 'PAYMENT_HISTORY':
            recommendations.push({
              id: crypto.randomUUID(),
              type: 'FINANCIAL',
              priority: 'HIGH',
              title: 'Address Payment Issues',
              description: `Client has ${factor.data?.overdueCount} overdue invoices`,
              actionItems: [
                { action: 'Contact client about overdue payments' },
                { action: 'Review payment terms' },
                { action: 'Consider payment plan if needed' },
              ],
              status: 'PENDING',
            });
            break;

          case 'DOCUMENT_COMPLETENESS':
            recommendations.push({
              id: crypto.randomUUID(),
              type: 'COMPLIANCE',
              priority: 'MEDIUM',
              title: 'Complete Client Documentation',
              description: `Missing required documents: ${factor.data?.missingDocs?.join(', ')}`,
              actionItems: factor.data?.missingDocs?.map((doc: string) => ({
                action: `Request ${doc} from client`,
              })) || [],
              dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              status: 'PENDING',
            });
            break;
        }
      }
    }

    // Churn-based recommendations
    const highChurnFactors = churnFactors.filter(f => f.probability_contribution >= 20);
    if (highChurnFactors.length > 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'RETENTION',
        priority: 'HIGH',
        title: 'Client Retention Risk',
        description: 'Client shows signs of potential churn',
        actionItems: [
          { action: 'Schedule check-in call with client' },
          { action: 'Review service satisfaction' },
          { action: 'Offer service improvements if applicable' },
        ],
        status: 'PENDING',
      });
    }

    // Financial health recommendations
    const criticalFinancial = financialFactors.filter(f => f.status === 'CRITICAL');
    if (criticalFinancial.length > 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'FINANCIAL',
        priority: 'MEDIUM',
        title: 'Financial Health Concerns',
        description: 'Client financial metrics indicate potential issues',
        actionItems: [
          { action: 'Review client financial statements' },
          { action: 'Discuss financial situation with client' },
          { action: 'Adjust service scope if needed' },
        ],
        status: 'PENDING',
      });
    }

    return recommendations;
  }

  /**
   * Generate alerts for significant risk changes
   */
  private async generateAlerts(
    organizationId: string,
    clientId: string,
    assessmentId: string,
    currentLevel: RiskLevel,
    previousLevel: RiskLevel | undefined,
    churnProbability: number | null
  ): Promise<void> {
    const alerts: any[] = [];

    // Alert on risk level increase
    if (previousLevel && this.levelToScore(currentLevel) > this.levelToScore(previousLevel)) {
      alerts.push({
        organization_id: organizationId,
        client_id: clientId,
        assessment_id: assessmentId,
        alert_type: currentLevel === 'CRITICAL' ? 'RISK_CRITICAL' : 'RISK_INCREASED',
        severity: currentLevel === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        title: `Risk level increased to ${currentLevel}`,
        message: `Client risk level has changed from ${previousLevel} to ${currentLevel}. Review the assessment for details.`,
      });
    }

    // Alert on high churn probability
    if (churnProbability && churnProbability >= 50) {
      alerts.push({
        organization_id: organizationId,
        client_id: clientId,
        assessment_id: assessmentId,
        alert_type: 'CHURN_WARNING',
        severity: churnProbability >= 75 ? 'CRITICAL' : 'WARNING',
        title: 'High churn risk detected',
        message: `Client has ${churnProbability}% churn probability. Consider retention actions.`,
      });
    }

    if (alerts.length > 0) {
      await db('risk_alerts').insert(alerts);
    }
  }

  private levelToScore(level: RiskLevel): number {
    const scores: Record<RiskLevel, number> = {
      'LOW': 1,
      'MEDIUM': 2,
      'HIGH': 3,
      'CRITICAL': 4,
    };
    return scores[level];
  }

  /**
   * Store recommendations in database
   */
  private async storeRecommendations(
    organizationId: string,
    clientId: string,
    assessmentId: string,
    recommendations: Recommendation[]
  ): Promise<void> {
    if (recommendations.length === 0) return;

    const records = recommendations.map(rec => ({
      id: rec.id,
      organization_id: organizationId,
      client_id: clientId,
      assessment_id: assessmentId,
      recommendation_type: rec.type,
      priority: rec.priority,
      title: rec.title,
      description: rec.description,
      action_items: JSON.stringify(rec.actionItems),
      due_date: rec.dueDate,
      status: 'PENDING',
    }));

    await db('risk_recommendations').insert(records);
  }

  /**
   * Record history entry for trend analysis
   */
  private async recordHistoryEntry(
    organizationId: string,
    clientId: string,
    data: {
      riskScore: number;
      riskLevel: RiskLevel;
      churnProbability: number | null;
      financialHealthScore: number | null;
    }
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    await db('risk_assessment_history')
      .insert({
        client_id: clientId,
        organization_id: organizationId,
        risk_score: data.riskScore,
        risk_level: data.riskLevel,
        churn_probability: data.churnProbability,
        financial_health_score: data.financialHealthScore,
        recorded_at: today,
      })
      .onConflict(['client_id', 'recorded_at'])
      .merge();
  }

  /**
   * Get factor definitions for organization
   */
  private async getFactorDefinitions(organizationId: string): Promise<any[]> {
    return db('risk_factor_definitions')
      .where('organization_id', organizationId)
      .where('is_active', true)
      .orderBy('category')
      .orderBy('factor_name');
  }

  /**
   * Map database record to response schema
   */
  private mapAssessmentToResponse(record: any): RiskAssessment {
    return {
      id: record.id,
      clientId: record.client_id,
      riskScore: record.risk_score,
      riskLevel: record.risk_level,
      previousRiskLevel: record.previous_risk_level,
      riskChange: this.determineRiskChange(record.risk_level, record.previous_risk_level),
      churnProbability: record.churn_probability,
      financialHealthScore: record.financial_health_score,
      riskFactors: record.risk_factors,
      churnFactors: record.churn_factors,
      financialFactors: record.financial_factors,
      recommendations: record.recommendations,
      modelVersion: record.model_version,
      calculatedAt: record.calculated_at,
      expiresAt: record.expires_at,
    };
  }

  private determineRiskChange(
    current: RiskLevel,
    previous: RiskLevel | null
  ): 'INCREASED' | 'DECREASED' | 'STABLE' | undefined {
    if (!previous) return undefined;

    const currentScore = this.levelToScore(current);
    const previousScore = this.levelToScore(previous);

    if (currentScore > previousScore) return 'INCREASED';
    if (currentScore < previousScore) return 'DECREASED';
    return 'STABLE';
  }

  /**
   * Get portfolio risk summary
   */
  async getPortfolioRiskSummary(organizationId: string): Promise<any> {
    // Get distribution
    const distribution = await db('client_risk_assessments')
      .where('organization_id', organizationId)
      .where('is_current', true)
      .select('risk_level')
      .groupBy('risk_level')
      .count('* as count');

    const distMap: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    for (const row of distribution) {
      distMap[row.risk_level] = parseInt(row.count as string, 10);
    }

    // Get averages
    const averages = await db('client_risk_assessments')
      .where('organization_id', organizationId)
      .where('is_current', true)
      .avg('risk_score as avgRisk')
      .avg('churn_probability as avgChurn')
      .first();

    // Get high-risk clients
    const highRiskClients = await db('client_risk_assessments as cra')
      .join('clients as c', 'c.id', 'cra.client_id')
      .where('cra.organization_id', organizationId)
      .where('cra.is_current', true)
      .whereIn('cra.risk_level', ['HIGH', 'CRITICAL'])
      .select(
        'c.id',
        'c.company_name',
        'cra.risk_score',
        'cra.risk_level',
        'cra.risk_factors'
      )
      .orderBy('cra.risk_score', 'desc')
      .limit(10);

    // Get recent alerts
    const recentAlerts = await db('risk_alerts as ra')
      .join('clients as c', 'c.id', 'ra.client_id')
      .where('ra.organization_id', organizationId)
      .where('ra.is_dismissed', false)
      .select(
        'ra.*',
        'c.company_name as client_name'
      )
      .orderBy('ra.created_at', 'desc')
      .limit(5);

    // Get trend data (last 30 days)
    const trendData = await db('risk_assessment_history')
      .where('organization_id', organizationId)
      .where('recorded_at', '>=', db.raw("CURRENT_DATE - INTERVAL '30 days'"))
      .select('recorded_at')
      .avg('risk_score as avg_score')
      .count('CASE WHEN risk_level IN (\'HIGH\', \'CRITICAL\') THEN 1 END as high_risk_count')
      .groupBy('recorded_at')
      .orderBy('recorded_at');

    return {
      distribution: {
        low: distMap.LOW,
        medium: distMap.MEDIUM,
        high: distMap.HIGH,
        critical: distMap.CRITICAL,
        total: Object.values(distMap).reduce((a, b) => a + b, 0),
      },
      averageRiskScore: Math.round(parseFloat(averages?.avgRisk || '0')),
      averageChurnProbability: Math.round(parseFloat(averages?.avgChurn || '0')),
      highRiskClients: highRiskClients.map(c => ({
        id: c.id,
        companyName: c.company_name,
        riskScore: c.risk_score,
        riskLevel: c.risk_level,
        topRiskFactor: c.risk_factors[0]?.name || 'N/A',
      })),
      recentAlerts: recentAlerts.map(a => ({
        id: a.id,
        clientId: a.client_id,
        clientName: a.client_name,
        alertType: a.alert_type,
        severity: a.severity,
        title: a.title,
        message: a.message,
        isRead: a.is_read,
        isDismissed: a.is_dismissed,
        createdAt: a.created_at,
      })),
      trendData: trendData.map(t => ({
        date: t.recorded_at,
        averageScore: Math.round(parseFloat(t.avg_score || '0')),
        highRiskCount: parseInt(t.high_risk_count || '0', 10),
      })),
    };
  }
}

export const riskAssessmentService = new RiskAssessmentService();
```

### tRPC Router

```typescript
// src/server/routers/crm/risk-assessment.router.ts
import { router, protectedProcedure, adminProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  CalculateRiskInputSchema,
  GetRiskHistoryInputSchema,
  UpdateRecommendationStatusSchema,
} from './risk-assessment.schema';
import { riskAssessmentService } from '@/server/services/crm/risk-assessment.service';
import { db } from '@/server/db';
import { auditLog } from '@/server/services/audit.service';

export const riskAssessmentRouter = router({
  /**
   * Get current risk assessment for a client
   */
  getClientRiskAssessment: protectedProcedure
    .input(CalculateRiskInputSchema)
    .query(async ({ ctx, input }) => {
      const assessment = await riskAssessmentService.getClientRiskAssessment(
        ctx.organizationId,
        input.clientId,
        input.forceRecalculate
      );

      if (input.forceRecalculate) {
        await auditLog({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: 'RISK_ASSESSMENT_CALCULATED',
          entityType: 'CLIENT',
          entityId: input.clientId,
          metadata: {
            riskScore: assessment.riskScore,
            riskLevel: assessment.riskLevel,
          },
        });
      }

      return assessment;
    }),

  /**
   * Get risk assessment history for trends
   */
  getRiskHistory: protectedProcedure
    .input(GetRiskHistoryInputSchema)
    .query(async ({ ctx, input }) => {
      let query = db('risk_assessment_history')
        .where('client_id', input.clientId)
        .where('organization_id', ctx.organizationId)
        .orderBy('recorded_at', 'desc');

      if (input.startDate) {
        query = query.where('recorded_at', '>=', input.startDate);
      }
      if (input.endDate) {
        query = query.where('recorded_at', '<=', input.endDate);
      }

      return query;
    }),

  /**
   * Get portfolio risk summary (dashboard)
   */
  getPortfolioRiskSummary: protectedProcedure
    .query(async ({ ctx }) => {
      return riskAssessmentService.getPortfolioRiskSummary(ctx.organizationId);
    }),

  /**
   * Get unread risk alerts
   */
  getAlerts: protectedProcedure
    .input(z.object({
      unreadOnly: z.boolean().default(true),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      let query = db('risk_alerts as ra')
        .join('clients as c', 'c.id', 'ra.client_id')
        .where('ra.organization_id', ctx.organizationId)
        .where('ra.is_dismissed', false)
        .select(
          'ra.*',
          'c.company_name as client_name'
        )
        .orderBy('ra.created_at', 'desc')
        .limit(input.limit);

      if (input.unreadOnly) {
        query = query.where('ra.is_read', false);
      }

      const alerts = await query;

      return alerts.map(a => ({
        id: a.id,
        clientId: a.client_id,
        clientName: a.client_name,
        alertType: a.alert_type,
        severity: a.severity,
        title: a.title,
        message: a.message,
        isRead: a.is_read,
        createdAt: a.created_at,
      }));
    }),

  /**
   * Mark alert as read
   */
  markAlertRead: protectedProcedure
    .input(z.object({ alertId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db('risk_alerts')
        .where('id', input.alertId)
        .where('organization_id', ctx.organizationId)
        .update({ is_read: true });

      return { success: true };
    }),

  /**
   * Dismiss alert
   */
  dismissAlert: protectedProcedure
    .input(z.object({ alertId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db('risk_alerts')
        .where('id', input.alertId)
        .where('organization_id', ctx.organizationId)
        .update({
          is_dismissed: true,
          dismissed_by: ctx.userId,
          dismissed_at: new Date(),
        });

      return { success: true };
    }),

  /**
   * Get recommendations for a client
   */
  getRecommendations: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED', 'ALL']).default('ALL'),
    }))
    .query(async ({ ctx, input }) => {
      let query = db('risk_recommendations')
        .where('client_id', input.clientId)
        .where('organization_id', ctx.organizationId)
        .orderBy('priority', 'desc')
        .orderBy('created_at', 'desc');

      if (input.status !== 'ALL') {
        query = query.where('status', input.status);
      }

      const recommendations = await query;

      return recommendations.map(r => ({
        id: r.id,
        type: r.recommendation_type,
        priority: r.priority,
        title: r.title,
        description: r.description,
        actionItems: r.action_items,
        dueDate: r.due_date,
        status: r.status,
        completedAt: r.completed_at,
        wasEffective: r.was_effective,
        effectivenessNotes: r.effectiveness_notes,
        createdAt: r.created_at,
      }));
    }),

  /**
   * Update recommendation status
   */
  updateRecommendationStatus: protectedProcedure
    .input(UpdateRecommendationStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await db('risk_recommendations')
        .where('id', input.recommendationId)
        .where('organization_id', ctx.organizationId)
        .first();

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Recommendation not found',
        });
      }

      const updateData: Record<string, any> = {
        status: input.status,
        updated_at: new Date(),
      };

      if (input.status === 'COMPLETED') {
        updateData.completed_at = new Date();
        updateData.completed_by = ctx.userId;
        if (input.wasEffective !== undefined) {
          updateData.was_effective = input.wasEffective;
        }
        if (input.notes) {
          updateData.effectiveness_notes = input.notes;
        }
      }

      await db('risk_recommendations')
        .where('id', input.recommendationId)
        .update(updateData);

      await auditLog({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'RECOMMENDATION_STATUS_UPDATED',
        entityType: 'RISK_RECOMMENDATION',
        entityId: input.recommendationId,
        previousValue: { status: existing.status },
        newValue: { status: input.status },
      });

      return { success: true };
    }),

  /**
   * Batch recalculate risk for all clients (admin job)
   */
  batchRecalculateRisk: adminProcedure
    .input(z.object({
      clientIds: z.array(z.string().uuid()).optional(),
      expiredOnly: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get clients to process
      let query = db('clients')
        .where('organization_id', ctx.organizationId)
        .where('is_deleted', false)
        .select('id');

      if (input.clientIds?.length) {
        query = query.whereIn('id', input.clientIds);
      }

      if (input.expiredOnly) {
        // Only recalculate for clients with expired or missing assessments
        query = query.whereNotExists(
          db('client_risk_assessments')
            .whereRaw('client_risk_assessments.client_id = clients.id')
            .where('is_current', true)
            .where('expires_at', '>', new Date())
        );
      }

      const clients = await query;
      const results = {
        processed: 0,
        errors: [] as { clientId: string; error: string }[],
      };

      for (const client of clients) {
        try {
          await riskAssessmentService.getClientRiskAssessment(
            ctx.organizationId,
            client.id,
            true // Force recalculate
          );
          results.processed++;
        } catch (error) {
          results.errors.push({
            clientId: client.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      await auditLog({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'BATCH_RISK_RECALCULATION',
        entityType: 'SYSTEM',
        metadata: results,
      });

      return results;
    }),
});
```

---

## Test Specification

### Unit Tests

```typescript
// src/server/services/crm/__tests__/risk-assessment.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RiskAssessmentService } from '../risk-assessment.service';

describe('RiskAssessmentService', () => {
  let service: RiskAssessmentService;

  beforeEach(() => {
    service = new RiskAssessmentService();
    vi.clearAllMocks();
  });

  describe('scoreToLevel', () => {
    it('should return LOW for scores 0-24', () => {
      expect((service as any).scoreToLevel(0)).toBe('LOW');
      expect((service as any).scoreToLevel(24)).toBe('LOW');
    });

    it('should return MEDIUM for scores 25-49', () => {
      expect((service as any).scoreToLevel(25)).toBe('MEDIUM');
      expect((service as any).scoreToLevel(49)).toBe('MEDIUM');
    });

    it('should return HIGH for scores 50-74', () => {
      expect((service as any).scoreToLevel(50)).toBe('HIGH');
      expect((service as any).scoreToLevel(74)).toBe('HIGH');
    });

    it('should return CRITICAL for scores 75-100', () => {
      expect((service as any).scoreToLevel(75)).toBe('CRITICAL');
      expect((service as any).scoreToLevel(100)).toBe('CRITICAL');
    });
  });

  describe('calculateAggregateRiskScore', () => {
    it('should calculate weighted average', () => {
      const factors = [
        { score: 50, weight: 2.0 },
        { score: 30, weight: 1.0 },
        { score: 70, weight: 1.0 },
      ] as any[];

      const result = (service as any).calculateAggregateRiskScore(factors);
      // (50*2 + 30*1 + 70*1) / (2+1+1) = 200/4 = 50
      expect(result).toBe(50);
    });

    it('should return 0 for empty factors', () => {
      const result = (service as any).calculateAggregateRiskScore([]);
      expect(result).toBe(0);
    });
  });

  describe('calculateChurnProbability', () => {
    it('should sum probability contributions', () => {
      const factors = [
        { probability_contribution: 20 },
        { probability_contribution: 15 },
        { probability_contribution: 10 },
      ] as any[];

      const result = (service as any).calculateChurnProbability(factors);
      expect(result).toBe(45);
    });

    it('should cap at 100', () => {
      const factors = [
        { probability_contribution: 60 },
        { probability_contribution: 50 },
      ] as any[];

      const result = (service as any).calculateChurnProbability(factors);
      expect(result).toBe(100);
    });
  });

  describe('determineRiskChange', () => {
    it('should return INCREASED when current > previous', () => {
      expect((service as any).determineRiskChange('HIGH', 'LOW')).toBe('INCREASED');
      expect((service as any).determineRiskChange('CRITICAL', 'MEDIUM')).toBe('INCREASED');
    });

    it('should return DECREASED when current < previous', () => {
      expect((service as any).determineRiskChange('LOW', 'HIGH')).toBe('DECREASED');
      expect((service as any).determineRiskChange('MEDIUM', 'CRITICAL')).toBe('DECREASED');
    });

    it('should return STABLE when same', () => {
      expect((service as any).determineRiskChange('MEDIUM', 'MEDIUM')).toBe('STABLE');
    });

    it('should return undefined when no previous', () => {
      expect((service as any).determineRiskChange('MEDIUM', null)).toBeUndefined();
    });
  });
});
```

### Integration Tests

```typescript
// src/server/routers/crm/__tests__/risk-assessment.router.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, createTestClient } from '@/test/helpers';
import { db } from '@/server/db';

describe('Risk Assessment Router', () => {
  let ctx: TestContext;
  let orgId: string;
  let clientId: string;

  beforeEach(async () => {
    ctx = await createTestContext();
    orgId = ctx.organizationId;

    // Create test client
    const [client] = await db('clients').insert({
      organization_id: orgId,
      company_name: 'Test Company',
      nip: '1234567890',
      status: 'ACTIVE',
      vat_status: 'ACTIVE',
    }).returning('id');

    clientId = client.id;
  });

  afterEach(async () => {
    await db('risk_recommendations').where('organization_id', orgId).delete();
    await db('risk_alerts').where('organization_id', orgId).delete();
    await db('client_risk_assessments').where('organization_id', orgId).delete();
    await db('risk_assessment_history').where('organization_id', orgId).delete();
    await db('clients').where('organization_id', orgId).delete();
  });

  describe('getClientRiskAssessment', () => {
    it('should calculate risk assessment for client', async () => {
      const caller = createTestClient(ctx);

      const assessment = await caller.crm.riskAssessment.getClientRiskAssessment({
        clientId,
        forceRecalculate: true,
      });

      expect(assessment.clientId).toBe(clientId);
      expect(assessment.riskScore).toBeGreaterThanOrEqual(0);
      expect(assessment.riskScore).toBeLessThanOrEqual(100);
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(assessment.riskLevel);
      expect(assessment.riskFactors).toBeInstanceOf(Array);
    });

    it('should use cached assessment when not expired', async () => {
      const caller = createTestClient(ctx);

      // First call - calculates
      const first = await caller.crm.riskAssessment.getClientRiskAssessment({
        clientId,
        forceRecalculate: true,
      });

      // Second call - should use cache
      const second = await caller.crm.riskAssessment.getClientRiskAssessment({
        clientId,
        forceRecalculate: false,
      });

      expect(first.id).toBe(second.id);
    });

    it('should generate recommendations for high-risk factors', async () => {
      // Create client with high-risk attributes
      const [highRiskClient] = await db('clients').insert({
        organization_id: orgId,
        company_name: 'High Risk Company',
        nip: '9999999999',
        status: 'ACTIVE',
        vat_status: 'INVALID', // High risk
      }).returning('id');

      const caller = createTestClient(ctx);

      const assessment = await caller.crm.riskAssessment.getClientRiskAssessment({
        clientId: highRiskClient.id,
        forceRecalculate: true,
      });

      expect(assessment.recommendations.length).toBeGreaterThan(0);
      expect(assessment.recommendations.some(r => r.type === 'COMPLIANCE')).toBe(true);
    });
  });

  describe('portfolio summary', () => {
    it('should return portfolio risk summary', async () => {
      const caller = createTestClient(ctx);

      // Generate assessment first
      await caller.crm.riskAssessment.getClientRiskAssessment({
        clientId,
        forceRecalculate: true,
      });

      const summary = await caller.crm.riskAssessment.getPortfolioRiskSummary();

      expect(summary.distribution).toBeDefined();
      expect(summary.distribution.total).toBeGreaterThan(0);
      expect(summary.averageRiskScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('alerts', () => {
    it('should mark alert as read', async () => {
      const caller = createTestClient(ctx);

      // Create an alert
      const [alert] = await db('risk_alerts').insert({
        organization_id: orgId,
        client_id: clientId,
        assessment_id: crypto.randomUUID(),
        alert_type: 'RISK_INCREASED',
        severity: 'WARNING',
        title: 'Test Alert',
        message: 'Test message',
        is_read: false,
      }).returning('id');

      await caller.crm.riskAssessment.markAlertRead({ alertId: alert.id });

      const updated = await db('risk_alerts').where('id', alert.id).first();
      expect(updated.is_read).toBe(true);
    });
  });

  describe('recommendations', () => {
    it('should update recommendation status', async () => {
      // Create assessment and recommendation
      const [assessment] = await db('client_risk_assessments').insert({
        client_id: clientId,
        organization_id: orgId,
        risk_score: 50,
        risk_level: 'HIGH',
        model_version: '1.0.0',
        expires_at: new Date(Date.now() + 86400000),
      }).returning('id');

      const [recommendation] = await db('risk_recommendations').insert({
        organization_id: orgId,
        client_id: clientId,
        assessment_id: assessment.id,
        recommendation_type: 'COMPLIANCE',
        priority: 'HIGH',
        title: 'Test Recommendation',
        description: 'Test description',
        status: 'PENDING',
      }).returning('id');

      const caller = createTestClient(ctx);

      await caller.crm.riskAssessment.updateRecommendationStatus({
        recommendationId: recommendation.id,
        status: 'COMPLETED',
        wasEffective: true,
        notes: 'Fixed the issue',
      });

      const updated = await db('risk_recommendations').where('id', recommendation.id).first();
      expect(updated.status).toBe('COMPLETED');
      expect(updated.was_effective).toBe(true);
      expect(updated.completed_at).toBeDefined();
    });
  });
});
```

### E2E Tests

```typescript
// e2e/crm/risk-assessment.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsAccountant, createTestClient } from '../helpers';

test.describe('CRM Risk Assessment', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAccountant(page);
  });

  test('should display risk dashboard', async ({ page }) => {
    await page.goto('/crm/risk-dashboard');

    await expect(page.getByTestId('risk-distribution-chart')).toBeVisible();
    await expect(page.getByTestId('high-risk-clients-list')).toBeVisible();
    await expect(page.getByTestId('recent-alerts')).toBeVisible();
  });

  test('should show client risk assessment', async ({ page }) => {
    await page.goto('/crm/clients/test-client-id/risk');

    await expect(page.getByTestId('risk-score')).toBeVisible();
    await expect(page.getByTestId('risk-level')).toBeVisible();
    await expect(page.getByTestId('risk-factors')).toBeVisible();
    await expect(page.getByTestId('churn-probability')).toBeVisible();
    await expect(page.getByTestId('recommendations')).toBeVisible();
  });

  test('should recalculate risk on demand', async ({ page }) => {
    await page.goto('/crm/clients/test-client-id/risk');

    await page.getByRole('button', { name: 'Recalculate' }).click();

    await expect(page.getByText('Risk assessment updated')).toBeVisible();
    await expect(page.getByTestId('last-calculated')).toContainText('just now');
  });

  test('should display and dismiss alerts', async ({ page }) => {
    await page.goto('/crm/risk-dashboard');

    // Check alerts section
    const alertsSection = page.getByTestId('recent-alerts');
    await expect(alertsSection).toBeVisible();

    // Click on an alert
    const firstAlert = alertsSection.locator('[data-testid="alert-item"]').first();
    await firstAlert.click();

    // Alert should be marked as read
    await expect(firstAlert).not.toHaveClass(/unread/);
  });

  test('should complete recommendation', async ({ page }) => {
    await page.goto('/crm/clients/test-client-id/risk');

    // Find a recommendation
    const recommendation = page.getByTestId('recommendation-item').first();

    // Mark as completed
    await recommendation.getByRole('button', { name: 'Complete' }).click();

    // Fill effectiveness feedback
    await page.getByLabel('Was this effective?').check();
    await page.getByLabel('Notes').fill('Issue resolved');
    await page.getByRole('button', { name: 'Save' }).click();

    // Recommendation should show as completed
    await expect(recommendation).toHaveAttribute('data-status', 'COMPLETED');
  });

  test('should filter high-risk clients', async ({ page }) => {
    await page.goto('/crm/clients');

    // Open filters
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByLabel('Risk Level').selectOption('HIGH');
    await page.getByRole('button', { name: 'Apply' }).click();

    // All visible clients should be high risk
    const riskBadges = page.locator('[data-testid="risk-badge"]');
    for (const badge of await riskBadges.all()) {
      const level = await badge.textContent();
      expect(['HIGH', 'CRITICAL']).toContain(level);
    }
  });
});
```

---

## Security Checklist

- [x] **Input Validation**: All inputs validated with Zod schemas
- [x] **Data Access Control**: RLS policies on all tables
- [x] **Organization Isolation**: All queries scoped to organization
- [x] **Audit Logging**: Risk calculations and actions logged
- [x] **Rate Limiting**: Batch operations limited
- [x] **Recommendation Ownership**: Users can only complete recommendations in their org
- [x] **Alert Permissions**: Users can only access their organization's alerts
- [x] **Admin Functions**: Batch operations require admin role

---

## Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `RISK_ASSESSMENT_CALCULATED` | Risk calculation | Client ID, risk score, risk level |
| `RECOMMENDATION_STATUS_UPDATED` | Status change | Recommendation ID, old/new status |
| `BATCH_RISK_RECALCULATION` | Admin batch job | Processed count, errors |
| `RISK_ALERT_DISMISSED` | Alert dismissed | Alert ID |

---

## Implementation Notes

### Performance Considerations

1. **Caching**: Assessments cached for 24 hours
2. **Lazy Loading**: Related data loaded only when needed
3. **Batch Processing**: Use scheduled jobs for bulk recalculation
4. **Index Optimization**: Indexes on frequently queried fields

### Future Enhancements

1. **Machine Learning**: Replace rule-based scoring with ML models
2. **Industry Benchmarks**: Compare against industry-specific metrics
3. **External Data**: Integrate with credit bureaus
4. **Predictive Analytics**: Forecast risk trends

### Integration Points

- **Accounting Module**: Financial health data
- **Document Module**: Document completeness
- **Invoice Module**: Payment history
- **Timeline Module**: Engagement metrics

---

## Related Stories

- **CRM-001**: Client Profile Management (data source)
- **CRM-003**: VAT/VIES Validation (VAT status factor)
- **CRM-005**: Client Timeline (engagement metrics)
- **ACC Module**: Financial data for health analysis

---

*Last updated: December 2024*
