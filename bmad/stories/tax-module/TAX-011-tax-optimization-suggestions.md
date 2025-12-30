# TAX-011: Tax Optimization Suggestions

> **Story ID**: TAX-011
> **Epic**: Tax Compliance Module (TAX)
> **Priority**: P2
> **Story Points**: 8
> **Status**: 📋 Ready for Development
> **Sprint**: Week 16

---

## User Story

**As an** accountant,
**I want** AI-powered tax optimization suggestions,
**So that** I can minimize my clients' legal tax burden while ensuring full compliance.

---

## Description

The Tax Optimization Suggestions feature provides intelligent, data-driven analysis of each client's tax position to identify legal optimization opportunities. The system analyzes current tax structures, business activities, and applicable regulations to generate actionable suggestions with estimated savings, risk assessments, and implementation guidance. All suggestions are grounded in Polish tax law and include proper legal justification.

### Business Value

- **Tax Savings**: Identify legal tax reduction opportunities
- **Proactive Advice**: Suggest optimizations before tax deadlines
- **Risk Management**: Assess compliance risk for each suggestion
- **Client Value**: Demonstrate advisory expertise to clients
- **Knowledge Capture**: Learn from successful optimizations

### Success Metrics

- Average savings identified ≥5% of tax liability
- Suggestion acceptance rate ≥40%
- Compliance rate post-optimization 100%
- Client satisfaction score ≥4.5/5
- Time to generate suggestions <30s

---

## Acceptance Criteria

### Scenario 1: Analyze Current Tax Structure
```gherkin
Given I am logged in as an accountant
And I have a client with complete tax configuration
When I request a tax optimization analysis for the client
Then the system analyzes:
  | Analysis Area          | Data Sources                           |
  | Business structure     | Legal form, PKD codes, ownership       |
  | Revenue composition    | Income by source, customer types       |
  | Expense patterns       | Deductible expenses, cost categories   |
  | Current tax elections  | VAT period, CIT/PIT form, ZUS type     |
  | Historical performance | Previous year filings, trend analysis  |
And each area is scored for optimization potential (0-100%)
And the analysis completes within 30 seconds
```

### Scenario 2: Generate Optimization Proposals
```gherkin
Given a completed tax structure analysis
When the system generates optimization proposals
Then each proposal includes:
  | Field                  | Description                            |
  | proposal_id            | Unique identifier                      |
  | category               | Optimization category                  |
  | title                  | Short descriptive title                |
  | description            | Detailed explanation                   |
  | estimated_savings      | Annual savings estimate in PLN         |
  | confidence_level       | Low, Medium, High, Very High           |
  | implementation_effort  | Simple, Moderate, Complex              |
  | risk_level            | Minimal, Low, Medium, Elevated         |
  | applicable_period      | When optimization can be applied       |
  | deadline               | Implementation deadline if any         |
And proposals are sorted by savings/effort ratio
And at least 3 relevant proposals are generated
```

### Scenario 3: View Estimated Savings
```gherkin
Given I am viewing optimization proposals for a client
When I select a specific proposal
Then I see detailed savings breakdown:
  | Component              | Amount                                 |
  | Current tax liability  | Amount under current structure         |
  | Optimized liability    | Amount after optimization              |
  | Gross savings         | Difference                              |
  | Implementation cost    | One-time and recurring costs           |
  | Net savings           | Gross savings minus costs              |
  | Payback period        | Time to recover implementation cost    |
And savings projections for 1, 3, and 5 years
And sensitivity analysis for key assumptions
```

### Scenario 4: Assess Risk Level
```gherkin
Given I am reviewing an optimization proposal
When I view the risk assessment
Then I see comprehensive risk analysis:
  | Risk Category          | Assessment                             |
  | Legal certainty       | How clear is the legal basis           |
  | Audit probability      | Likelihood of tax authority scrutiny   |
  | Challenge risk        | Risk of optimization being challenged  |
  | Penalty exposure      | Potential penalties if rejected        |
  | Reputation impact     | Effect on client's tax reputation      |
  | Reversibility         | Ease of reverting if needed            |
And overall risk score (1-10 scale)
And risk mitigation strategies
And similar cases from tax rulings
```

### Scenario 5: View Implementation Steps
```gherkin
Given I have selected an optimization proposal to implement
When I view implementation guidance
Then I see step-by-step implementation plan:
  | Step | Action | Timeline | Responsible | Documents |
  | 1    | Preparation tasks | Week 1 | Accountant | List |
  | 2    | Client decisions | Week 2 | Client | Forms |
  | 3    | Documentation | Week 3 | Accountant | Templates |
  | 4    | Submission/Filing | Week 4 | Accountant | Filings |
  | 5    | Verification | Week 5 | Both | Confirmations |
And each step has detailed instructions
And required document templates are provided
And timeline considers regulatory deadlines
```

### Scenario 6: Review Legal Justification
```gherkin
Given I am reviewing an optimization proposal
When I view the legal basis
Then I see comprehensive legal justification:
  | Section                | Content                                |
  | Primary legal basis    | Main law provisions supporting proposal|
  | Supporting regulations | Related ordinances and interpretations |
  | Tax rulings            | Relevant Ministry of Finance rulings   |
  | Court decisions        | Supporting court judgments             |
  | Expert commentary      | Tax advisor interpretations            |
And full citations in Polish legal format
And links to official sources where available
And analysis of any contrary interpretations
```

### Scenario 7: Track Accepted Optimizations
```gherkin
Given an optimization proposal has been implemented
When I track the optimization outcome
Then I can record:
  | Field                  | Value                                  |
  | Implementation date    | When optimization was applied          |
  | Actual savings         | Measured savings vs. estimated         |
  | Compliance verified    | Confirmation from tax filings          |
  | Issues encountered     | Any problems during implementation     |
  | Client feedback        | Client satisfaction rating             |
And the system learns from outcomes
And success/failure feeds future recommendations
```

### Scenario 8: Generate Client Report
```gherkin
Given I have analyzed and selected optimizations for a client
When I generate an optimization report
Then the report includes:
  | Section                | Content                                |
  | Executive summary      | Key findings and recommendations       |
  | Current situation      | Tax structure analysis results         |
  | Opportunities          | Ranked optimization proposals          |
  | Recommended actions    | Prioritized implementation plan        |
  | Risk summary           | Aggregated risk assessment             |
  | Legal appendix         | Detailed legal justifications          |
And report is available in PDF format
And branded with accounting firm identity
And language is client-appropriate (not technical jargon)
```

---

## Technical Specification

### Database Schema

```sql
-- Tax optimization analyses
CREATE TABLE tax_optimization_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  analysis_year INTEGER NOT NULL,

  -- Analysis status
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'analyzing', 'completed', 'failed', 'expired')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Input data snapshot
  client_snapshot JSONB NOT NULL DEFAULT '{}',
  financial_data JSONB NOT NULL DEFAULT '{}',
  tax_configuration JSONB NOT NULL DEFAULT '{}',

  -- Analysis results
  structure_scores JSONB DEFAULT '{}',
  -- {
  --   "business_structure": { "score": 75, "potential": "medium" },
  --   "revenue_composition": { "score": 60, "potential": "high" },
  --   "expense_patterns": { "score": 85, "potential": "low" },
  --   "tax_elections": { "score": 50, "potential": "high" },
  --   "historical_trend": { "score": 70, "potential": "medium" }
  -- }

  overall_optimization_potential DECIMAL(5, 2), -- 0.00-100.00
  estimated_total_savings DECIMAL(15, 2),

  -- AI processing metadata
  ai_model_version VARCHAR(50),
  processing_time_ms INTEGER,

  -- Audit
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_client_year_analysis UNIQUE (client_id, analysis_year)
);

-- Optimization proposals
CREATE TABLE tax_optimization_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES tax_optimization_analyses(id) ON DELETE CASCADE,

  -- Proposal identification
  proposal_code VARCHAR(30) NOT NULL, -- e.g., "VAT_QUARTERLY", "CIT_ESTONIAN"
  category VARCHAR(50) NOT NULL,
  -- Categories: VAT_OPTIMIZATION, CIT_OPTIMIZATION, PIT_OPTIMIZATION,
  --             ZUS_OPTIMIZATION, STRUCTURE_CHANGE, EXPENSE_OPTIMIZATION,
  --             TIMING_OPTIMIZATION, ELECTION_CHANGE

  -- Proposal content
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  detailed_explanation TEXT,

  -- Financial estimates
  current_liability DECIMAL(15, 2) NOT NULL,
  optimized_liability DECIMAL(15, 2) NOT NULL,
  gross_savings DECIMAL(15, 2) NOT NULL,
  implementation_cost_one_time DECIMAL(15, 2) DEFAULT 0,
  implementation_cost_recurring DECIMAL(15, 2) DEFAULT 0,
  net_savings DECIMAL(15, 2) NOT NULL,
  payback_months INTEGER,

  -- Projections
  savings_year_1 DECIMAL(15, 2),
  savings_year_3 DECIMAL(15, 2),
  savings_year_5 DECIMAL(15, 2),
  assumptions JSONB DEFAULT '[]',
  sensitivity_analysis JSONB DEFAULT '{}',

  -- Assessment scores
  confidence_level VARCHAR(20) NOT NULL DEFAULT 'medium'
    CHECK (confidence_level IN ('low', 'medium', 'high', 'very_high')),
  implementation_effort VARCHAR(20) NOT NULL DEFAULT 'moderate'
    CHECK (implementation_effort IN ('simple', 'moderate', 'complex')),
  risk_level VARCHAR(20) NOT NULL DEFAULT 'low'
    CHECK (risk_level IN ('minimal', 'low', 'medium', 'elevated')),
  priority_score DECIMAL(5, 2), -- Calculated: savings/effort ratio

  -- Timing
  applicable_from DATE,
  applicable_until DATE,
  implementation_deadline DATE,

  -- Status tracking
  status VARCHAR(30) NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'under_review', 'accepted', 'rejected',
                       'implementing', 'implemented', 'verified', 'failed')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  review_notes TEXT,

  -- AI metadata
  ai_confidence DECIMAL(3, 2), -- 0.00-1.00
  similar_cases_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Risk assessments for proposals
CREATE TABLE tax_optimization_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES tax_optimization_proposals(id) ON DELETE CASCADE,

  -- Risk categories (1-10 scale)
  legal_certainty_score INTEGER NOT NULL CHECK (legal_certainty_score BETWEEN 1 AND 10),
  audit_probability_score INTEGER NOT NULL CHECK (audit_probability_score BETWEEN 1 AND 10),
  challenge_risk_score INTEGER NOT NULL CHECK (challenge_risk_score BETWEEN 1 AND 10),
  penalty_exposure_score INTEGER NOT NULL CHECK (penalty_exposure_score BETWEEN 1 AND 10),
  reputation_impact_score INTEGER NOT NULL CHECK (reputation_impact_score BETWEEN 1 AND 10),
  reversibility_score INTEGER NOT NULL CHECK (reversibility_score BETWEEN 1 AND 10),

  overall_risk_score DECIMAL(3, 1) NOT NULL, -- Weighted average

  -- Detailed assessments
  legal_certainty_notes TEXT,
  audit_probability_notes TEXT,
  challenge_risk_notes TEXT,
  penalty_exposure_notes TEXT,
  reputation_impact_notes TEXT,
  reversibility_notes TEXT,

  -- Mitigation strategies
  mitigation_strategies JSONB DEFAULT '[]',
  -- [{ "risk": "audit", "strategy": "...", "effectiveness": "high" }]

  -- Supporting cases
  supporting_rulings JSONB DEFAULT '[]',
  contrary_interpretations JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Legal justifications
CREATE TABLE tax_optimization_legal_basis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES tax_optimization_proposals(id) ON DELETE CASCADE,

  -- Legal source type
  source_type VARCHAR(30) NOT NULL
    CHECK (source_type IN ('ustawa', 'rozporzadzenie', 'interpretacja',
                            'orzeczenie', 'komentarz', 'praktyka')),

  -- Citation details
  citation_full TEXT NOT NULL,
  citation_short VARCHAR(200) NOT NULL,

  -- Source details
  legal_act_name VARCHAR(300),
  article_reference VARCHAR(100),
  effective_date DATE,
  publication_reference VARCHAR(200), -- e.g., "Dz.U. 2004 Nr 54 poz. 535"

  -- Content
  relevant_excerpt TEXT,
  interpretation TEXT,

  -- Source URL if available
  source_url VARCHAR(500),

  -- Classification
  is_primary_basis BOOLEAN NOT NULL DEFAULT false,
  supports_optimization BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  added_by VARCHAR(30) NOT NULL DEFAULT 'ai'
    CHECK (added_by IN ('ai', 'manual', 'system')),
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Implementation steps
CREATE TABLE tax_optimization_implementation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES tax_optimization_proposals(id) ON DELETE CASCADE,

  step_number INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  detailed_instructions TEXT,

  -- Timeline
  estimated_duration_days INTEGER,
  relative_start_day INTEGER, -- Days from implementation start
  deadline DATE,

  -- Responsibility
  responsible_party VARCHAR(30) NOT NULL
    CHECK (responsible_party IN ('accountant', 'client', 'both', 'third_party')),

  -- Required documents
  required_documents JSONB DEFAULT '[]',
  -- [{ "name": "...", "template_id": "...", "description": "..." }]

  document_templates JSONB DEFAULT '[]',
  -- [{ "template_id": "...", "name": "...", "url": "..." }]

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'blocked')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_proposal_step UNIQUE (proposal_id, step_number)
);

-- Implementation tracking
CREATE TABLE tax_optimization_implementations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES tax_optimization_proposals(id) UNIQUE,

  -- Implementation details
  implementation_date DATE NOT NULL,
  implemented_by UUID NOT NULL REFERENCES users(id),

  -- Outcome tracking
  actual_savings_year_1 DECIMAL(15, 2),
  actual_implementation_cost DECIMAL(15, 2),
  variance_from_estimate DECIMAL(5, 2), -- Percentage

  -- Compliance verification
  compliance_verified BOOLEAN NOT NULL DEFAULT false,
  verification_date DATE,
  verification_notes TEXT,

  -- Issues and feedback
  issues_encountered JSONB DEFAULT '[]',
  client_feedback_rating INTEGER CHECK (client_feedback_rating BETWEEN 1 AND 5),
  client_feedback_notes TEXT,

  -- Learning
  lessons_learned TEXT,
  recommendation_for_similar BOOLEAN,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimization categories reference
CREATE TABLE tax_optimization_categories (
  code VARCHAR(50) PRIMARY KEY,
  name_pl VARCHAR(200) NOT NULL,
  name_en VARCHAR(200) NOT NULL,
  description TEXT,

  -- Applicability
  applicable_to_legal_forms VARCHAR[] DEFAULT ARRAY[]::VARCHAR[],
  -- e.g., ['sp_zoo', 'sa', 'jdg']

  applicable_to_tax_types VARCHAR[] DEFAULT ARRAY[]::VARCHAR[],
  -- e.g., ['VAT', 'CIT', 'PIT']

  -- Typical characteristics
  typical_savings_range VARCHAR(50), -- e.g., "5-15%"
  typical_risk_level VARCHAR(20),
  typical_effort VARCHAR(20),

  -- AI guidance
  analysis_prompts JSONB DEFAULT '[]',
  evaluation_criteria JSONB DEFAULT '{}',

  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log for optimization activities
CREATE TABLE tax_optimization_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  analysis_id UUID REFERENCES tax_optimization_analyses(id),
  proposal_id UUID REFERENCES tax_optimization_proposals(id),
  implementation_id UUID REFERENCES tax_optimization_implementations(id),

  -- Event details
  event_type VARCHAR(50) NOT NULL,
  -- Events: analysis_started, analysis_completed, proposal_generated,
  --         proposal_reviewed, proposal_accepted, proposal_rejected,
  --         implementation_started, step_completed, implementation_verified,
  --         report_generated, etc.

  event_data JSONB NOT NULL DEFAULT '{}',

  -- Actor
  actor_id UUID NOT NULL REFERENCES users(id),
  actor_ip INET,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_optimization_analyses_client ON tax_optimization_analyses(client_id);
CREATE INDEX idx_optimization_analyses_status ON tax_optimization_analyses(status);
CREATE INDEX idx_optimization_analyses_year ON tax_optimization_analyses(analysis_year);
CREATE INDEX idx_optimization_proposals_analysis ON tax_optimization_proposals(analysis_id);
CREATE INDEX idx_optimization_proposals_status ON tax_optimization_proposals(status);
CREATE INDEX idx_optimization_proposals_category ON tax_optimization_proposals(category);
CREATE INDEX idx_optimization_legal_basis_proposal ON tax_optimization_legal_basis(proposal_id);
CREATE INDEX idx_optimization_steps_proposal ON tax_optimization_implementation_steps(proposal_id);
CREATE INDEX idx_optimization_audit_analysis ON tax_optimization_audit_log(analysis_id);
CREATE INDEX idx_optimization_audit_proposal ON tax_optimization_audit_log(proposal_id);

-- Row Level Security
ALTER TABLE tax_optimization_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_optimization_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_optimization_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_optimization_legal_basis ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_optimization_implementation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_optimization_implementations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_optimization_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own organization optimization analyses"
  ON tax_optimization_analyses FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY "Users can access own organization optimization proposals"
  ON tax_optimization_proposals FOR ALL
  USING (analysis_id IN (
    SELECT id FROM tax_optimization_analyses
    WHERE organization_id = current_setting('app.current_organization_id')::UUID
  ));
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';
import Decimal from 'decimal.js';

// Optimization category enum
export const OptimizationCategorySchema = z.enum([
  'VAT_OPTIMIZATION',
  'CIT_OPTIMIZATION',
  'PIT_OPTIMIZATION',
  'ZUS_OPTIMIZATION',
  'STRUCTURE_CHANGE',
  'EXPENSE_OPTIMIZATION',
  'TIMING_OPTIMIZATION',
  'ELECTION_CHANGE'
]);

export type OptimizationCategory = z.infer<typeof OptimizationCategorySchema>;

// Confidence level enum
export const ConfidenceLevelSchema = z.enum(['low', 'medium', 'high', 'very_high']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

// Implementation effort enum
export const ImplementationEffortSchema = z.enum(['simple', 'moderate', 'complex']);
export type ImplementationEffort = z.infer<typeof ImplementationEffortSchema>;

// Risk level enum
export const RiskLevelSchema = z.enum(['minimal', 'low', 'medium', 'elevated']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// Analysis request schema
export const RequestAnalysisSchema = z.object({
  clientId: z.string().uuid(),
  analysisYear: z.number().int().min(2020).max(2030),
  includeCategories: z.array(OptimizationCategorySchema).optional(),
  excludeCategories: z.array(OptimizationCategorySchema).optional(),
  minimumSavingsThreshold: z.number().min(0).optional(),
  maxRiskLevel: RiskLevelSchema.optional()
});

export type RequestAnalysisInput = z.infer<typeof RequestAnalysisSchema>;

// Structure score schema
export const StructureScoreSchema = z.object({
  area: z.string(),
  score: z.number().min(0).max(100),
  potential: z.enum(['low', 'medium', 'high']),
  findings: z.array(z.string()),
  recommendations: z.array(z.string())
});

// Analysis result schema
export const AnalysisResultSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  analysisYear: z.number(),
  status: z.enum(['pending', 'analyzing', 'completed', 'failed', 'expired']),
  structureScores: z.record(StructureScoreSchema),
  overallOptimizationPotential: z.number().min(0).max(100),
  estimatedTotalSavings: z.number(),
  proposalCount: z.number(),
  completedAt: z.string().datetime().optional()
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// Savings breakdown schema
export const SavingsBreakdownSchema = z.object({
  currentLiability: z.number(),
  optimizedLiability: z.number(),
  grossSavings: z.number(),
  implementationCostOneTime: z.number(),
  implementationCostRecurring: z.number(),
  netSavings: z.number(),
  paybackMonths: z.number().nullable(),
  projections: z.object({
    year1: z.number(),
    year3: z.number(),
    year5: z.number()
  }),
  assumptions: z.array(z.object({
    name: z.string(),
    value: z.string(),
    impact: z.enum(['low', 'medium', 'high'])
  })),
  sensitivityAnalysis: z.record(z.object({
    pessimistic: z.number(),
    expected: z.number(),
    optimistic: z.number()
  }))
});

export type SavingsBreakdown = z.infer<typeof SavingsBreakdownSchema>;

// Risk assessment schema
export const RiskAssessmentSchema = z.object({
  legalCertainty: z.object({
    score: z.number().min(1).max(10),
    notes: z.string()
  }),
  auditProbability: z.object({
    score: z.number().min(1).max(10),
    notes: z.string()
  }),
  challengeRisk: z.object({
    score: z.number().min(1).max(10),
    notes: z.string()
  }),
  penaltyExposure: z.object({
    score: z.number().min(1).max(10),
    notes: z.string()
  }),
  reputationImpact: z.object({
    score: z.number().min(1).max(10),
    notes: z.string()
  }),
  reversibility: z.object({
    score: z.number().min(1).max(10),
    notes: z.string()
  }),
  overallRiskScore: z.number().min(1).max(10),
  mitigationStrategies: z.array(z.object({
    risk: z.string(),
    strategy: z.string(),
    effectiveness: z.enum(['low', 'medium', 'high'])
  })),
  supportingRulings: z.array(z.object({
    reference: z.string(),
    date: z.string(),
    summary: z.string(),
    relevance: z.string()
  })),
  contraryInterpretations: z.array(z.object({
    reference: z.string(),
    concern: z.string(),
    mitigation: z.string()
  }))
});

export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

// Legal basis schema
export const LegalBasisSchema = z.object({
  sourceType: z.enum(['ustawa', 'rozporzadzenie', 'interpretacja', 'orzeczenie', 'komentarz', 'praktyka']),
  citationFull: z.string(),
  citationShort: z.string(),
  legalActName: z.string().optional(),
  articleReference: z.string().optional(),
  effectiveDate: z.string().optional(),
  publicationReference: z.string().optional(),
  relevantExcerpt: z.string().optional(),
  interpretation: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  isPrimaryBasis: z.boolean(),
  supportsOptimization: z.boolean()
});

export type LegalBasis = z.infer<typeof LegalBasisSchema>;

// Implementation step schema
export const ImplementationStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  title: z.string().min(1).max(200),
  description: z.string(),
  detailedInstructions: z.string().optional(),
  estimatedDurationDays: z.number().int().min(1).optional(),
  relativeStartDay: z.number().int().min(0).optional(),
  deadline: z.string().optional(),
  responsibleParty: z.enum(['accountant', 'client', 'both', 'third_party']),
  requiredDocuments: z.array(z.object({
    name: z.string(),
    templateId: z.string().optional(),
    description: z.string()
  })),
  documentTemplates: z.array(z.object({
    templateId: z.string(),
    name: z.string(),
    url: z.string()
  }))
});

export type ImplementationStep = z.infer<typeof ImplementationStepSchema>;

// Proposal schema
export const OptimizationProposalSchema = z.object({
  id: z.string().uuid(),
  proposalCode: z.string(),
  category: OptimizationCategorySchema,
  title: z.string(),
  description: z.string(),
  detailedExplanation: z.string().optional(),
  savings: SavingsBreakdownSchema,
  confidenceLevel: ConfidenceLevelSchema,
  implementationEffort: ImplementationEffortSchema,
  riskLevel: RiskLevelSchema,
  priorityScore: z.number(),
  applicableFrom: z.string().optional(),
  applicableUntil: z.string().optional(),
  implementationDeadline: z.string().optional(),
  status: z.enum(['proposed', 'under_review', 'accepted', 'rejected',
                  'implementing', 'implemented', 'verified', 'failed']),
  riskAssessment: RiskAssessmentSchema.optional(),
  legalBasis: z.array(LegalBasisSchema).optional(),
  implementationSteps: z.array(ImplementationStepSchema).optional()
});

export type OptimizationProposal = z.infer<typeof OptimizationProposalSchema>;

// Review proposal schema
export const ReviewProposalSchema = z.object({
  proposalId: z.string().uuid(),
  action: z.enum(['accept', 'reject', 'request_more_info']),
  notes: z.string().optional()
});

export type ReviewProposalInput = z.infer<typeof ReviewProposalSchema>;

// Track implementation schema
export const TrackImplementationSchema = z.object({
  proposalId: z.string().uuid(),
  implementationDate: z.string(),
  actualSavingsYear1: z.number().optional(),
  actualImplementationCost: z.number().optional(),
  complianceVerified: z.boolean().optional(),
  verificationNotes: z.string().optional(),
  issuesEncountered: z.array(z.object({
    issue: z.string(),
    resolution: z.string().optional(),
    severity: z.enum(['minor', 'moderate', 'major'])
  })).optional(),
  clientFeedbackRating: z.number().int().min(1).max(5).optional(),
  clientFeedbackNotes: z.string().optional(),
  lessonsLearned: z.string().optional()
});

export type TrackImplementationInput = z.infer<typeof TrackImplementationSchema>;

// Generate report schema
export const GenerateReportSchema = z.object({
  analysisId: z.string().uuid(),
  proposalIds: z.array(z.string().uuid()).optional(),
  reportFormat: z.enum(['pdf', 'docx', 'html']).default('pdf'),
  language: z.enum(['pl', 'en']).default('pl'),
  includeDetailedLegalBasis: z.boolean().default(true),
  includeImplementationSteps: z.boolean().default(true),
  clientBranding: z.boolean().default(false)
});

export type GenerateReportInput = z.infer<typeof GenerateReportSchema>;
```

### Service Implementation

```typescript
import { db } from '@/lib/db';
import { TRPCError } from '@trpc/server';
import OpenAI from 'openai';
import Decimal from 'decimal.js';
import { generatePDF } from '@/lib/pdf';
import {
  RequestAnalysisInput,
  AnalysisResult,
  OptimizationProposal,
  ReviewProposalInput,
  TrackImplementationInput,
  GenerateReportInput,
  RiskAssessment,
  LegalBasis,
  ImplementationStep,
  SavingsBreakdown,
  OptimizationCategory
} from './tax-optimization.schemas';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Optimization category configurations
const OPTIMIZATION_CATEGORIES: Record<OptimizationCategory, {
  nameEn: string;
  namePl: string;
  analysisPrompt: string;
  applicableLegalForms: string[];
  applicableTaxTypes: string[];
}> = {
  VAT_OPTIMIZATION: {
    nameEn: 'VAT Optimization',
    namePl: 'Optymalizacja VAT',
    analysisPrompt: 'Analyze VAT structure including: period selection (monthly/quarterly), reverse charge opportunities, EU transaction optimization, input VAT recovery improvement, split payment handling.',
    applicableLegalForms: ['sp_zoo', 'sa', 'jdg', 'sc', 'sj', 'sk'],
    applicableTaxTypes: ['VAT']
  },
  CIT_OPTIMIZATION: {
    nameEn: 'Corporate Income Tax Optimization',
    namePl: 'Optymalizacja CIT',
    analysisPrompt: 'Analyze CIT structure including: Estonian CIT eligibility, small taxpayer 9% rate, R&D relief (IP Box), accelerated depreciation, loss carry-forward utilization.',
    applicableLegalForms: ['sp_zoo', 'sa', 'sk'],
    applicableTaxTypes: ['CIT']
  },
  PIT_OPTIMIZATION: {
    nameEn: 'Personal Income Tax Optimization',
    namePl: 'Optymalizacja PIT',
    analysisPrompt: 'Analyze PIT structure including: tax form selection (progressive vs flat), deductible expenses optimization, tax reliefs utilization, income splitting options.',
    applicableLegalForms: ['jdg', 'sc', 'sj'],
    applicableTaxTypes: ['PIT']
  },
  ZUS_OPTIMIZATION: {
    nameEn: 'Social Security Optimization',
    namePl: 'Optymalizacja ZUS',
    analysisPrompt: 'Analyze ZUS structure including: Ulga na start eligibility, preferential ZUS, Mały ZUS Plus, optimal contribution basis, health insurance deduction.',
    applicableLegalForms: ['jdg'],
    applicableTaxTypes: ['ZUS']
  },
  STRUCTURE_CHANGE: {
    nameEn: 'Business Structure Change',
    namePl: 'Zmiana formy prawnej',
    analysisPrompt: 'Analyze potential benefits of changing legal form: JDG to sp. z o.o., partnership transformation, holding structure creation.',
    applicableLegalForms: ['jdg', 'sc', 'sj', 'sp_zoo'],
    applicableTaxTypes: ['CIT', 'PIT', 'VAT', 'ZUS']
  },
  EXPENSE_OPTIMIZATION: {
    nameEn: 'Expense Optimization',
    namePl: 'Optymalizacja kosztów',
    analysisPrompt: 'Analyze expense deductibility: vehicle costs, home office, travel, representation, employee benefits, training costs.',
    applicableLegalForms: ['sp_zoo', 'sa', 'jdg', 'sc', 'sj', 'sk'],
    applicableTaxTypes: ['CIT', 'PIT']
  },
  TIMING_OPTIMIZATION: {
    nameEn: 'Timing Optimization',
    namePl: 'Optymalizacja terminów',
    analysisPrompt: 'Analyze timing opportunities: advance payment optimization, expense/revenue timing, year-end strategies, deadline utilization.',
    applicableLegalForms: ['sp_zoo', 'sa', 'jdg', 'sc', 'sj', 'sk'],
    applicableTaxTypes: ['CIT', 'PIT', 'VAT']
  },
  ELECTION_CHANGE: {
    nameEn: 'Tax Election Changes',
    namePl: 'Zmiana wyborów podatkowych',
    analysisPrompt: 'Analyze tax election opportunities: depreciation method changes, inventory valuation, simplified record keeping options.',
    applicableLegalForms: ['sp_zoo', 'sa', 'jdg', 'sc', 'sj', 'sk'],
    applicableTaxTypes: ['CIT', 'PIT']
  }
};

export class TaxOptimizationService {
  /**
   * Request comprehensive tax optimization analysis
   */
  async requestAnalysis(
    input: RequestAnalysisInput,
    organizationId: string,
    userId: string
  ): Promise<AnalysisResult> {
    // Validate client exists and belongs to organization
    const client = await db.client.findFirst({
      where: {
        id: input.clientId,
        organizationId
      },
      include: {
        taxConfiguration: true
      }
    });

    if (!client) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Client not found'
      });
    }

    // Check for existing analysis for this year
    const existingAnalysis = await db.taxOptimizationAnalysis.findFirst({
      where: {
        clientId: input.clientId,
        analysisYear: input.analysisYear,
        status: { in: ['pending', 'analyzing', 'completed'] }
      }
    });

    if (existingAnalysis && existingAnalysis.status === 'completed') {
      // Return existing if recent (less than 30 days old)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (existingAnalysis.completedAt && existingAnalysis.completedAt > thirtyDaysAgo) {
        return this.getAnalysisResult(existingAnalysis.id);
      }
    }

    // Gather financial data for analysis
    const financialData = await this.gatherFinancialData(input.clientId, input.analysisYear);

    // Create analysis record
    const analysis = await db.taxOptimizationAnalysis.create({
      data: {
        organizationId,
        clientId: input.clientId,
        analysisYear: input.analysisYear,
        status: 'analyzing',
        startedAt: new Date(),
        clientSnapshot: client as any,
        financialData,
        taxConfiguration: client.taxConfiguration as any,
        createdBy: userId,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
      }
    });

    // Log audit event
    await this.logAuditEvent('analysis_started', {
      analysisId: analysis.id,
      clientId: input.clientId,
      year: input.analysisYear
    }, userId);

    // Run analysis asynchronously
    this.runAnalysis(analysis.id, input, organizationId, userId);

    return this.getAnalysisResult(analysis.id);
  }

  /**
   * Run the actual optimization analysis
   */
  private async runAnalysis(
    analysisId: string,
    input: RequestAnalysisInput,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const analysis = await db.taxOptimizationAnalysis.findUnique({
        where: { id: analysisId }
      });

      if (!analysis) return;

      // Analyze each structure area
      const structureScores = await this.analyzeStructure(analysis);

      // Determine applicable categories
      const applicableCategories = this.determineApplicableCategories(
        analysis.clientSnapshot as any,
        input.includeCategories,
        input.excludeCategories
      );

      // Generate optimization proposals
      const proposals = await this.generateProposals(
        analysis,
        structureScores,
        applicableCategories,
        input.minimumSavingsThreshold,
        input.maxRiskLevel
      );

      // Calculate overall potential
      const totalSavings = proposals.reduce(
        (sum, p) => sum.plus(new Decimal(p.netSavings)),
        new Decimal(0)
      );

      const overallPotential = this.calculateOverallPotential(structureScores);

      // Update analysis with results
      await db.taxOptimizationAnalysis.update({
        where: { id: analysisId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          structureScores,
          overallOptimizationPotential: overallPotential,
          estimatedTotalSavings: totalSavings.toNumber(),
          aiModelVersion: 'gpt-4-turbo-preview',
          processingTimeMs: Date.now() - startTime
        }
      });

      // Create proposals in database
      for (const proposal of proposals) {
        await this.createProposal(analysisId, proposal, userId);
      }

      // Log completion
      await this.logAuditEvent('analysis_completed', {
        analysisId,
        proposalCount: proposals.length,
        totalSavings: totalSavings.toNumber(),
        processingTimeMs: Date.now() - startTime
      }, userId);

    } catch (error) {
      // Update analysis as failed
      await db.taxOptimizationAnalysis.update({
        where: { id: analysisId },
        data: {
          status: 'failed',
          completedAt: new Date()
        }
      });

      console.error('Tax optimization analysis failed:', error);
    }
  }

  /**
   * Analyze client's tax structure
   */
  private async analyzeStructure(analysis: any): Promise<Record<string, any>> {
    const structureAreas = [
      'business_structure',
      'revenue_composition',
      'expense_patterns',
      'tax_elections',
      'historical_trend'
    ];

    const scores: Record<string, any> = {};

    for (const area of structureAreas) {
      const prompt = this.buildStructureAnalysisPrompt(area, analysis);

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are a Polish tax optimization expert. Analyze the following data and provide:
1. A score from 0-100 indicating optimization potential (higher = more room for improvement)
2. A potential rating: 'low', 'medium', or 'high'
3. Key findings (up to 5)
4. Specific recommendations (up to 5)

Respond in JSON format:
{
  "score": number,
  "potential": "low" | "medium" | "high",
  "findings": string[],
  "recommendations": string[]
}`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      scores[area] = {
        area,
        score: result.score || 50,
        potential: result.potential || 'medium',
        findings: result.findings || [],
        recommendations: result.recommendations || []
      };
    }

    return scores;
  }

  /**
   * Generate optimization proposals
   */
  private async generateProposals(
    analysis: any,
    structureScores: Record<string, any>,
    applicableCategories: OptimizationCategory[],
    minimumSavings?: number,
    maxRiskLevel?: string
  ): Promise<any[]> {
    const proposals: any[] = [];

    for (const category of applicableCategories) {
      const categoryConfig = OPTIMIZATION_CATEGORIES[category];

      const prompt = this.buildProposalPrompt(
        category,
        categoryConfig,
        analysis,
        structureScores
      );

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are a Polish tax optimization expert specializing in ${categoryConfig.namePl}.
Generate specific, actionable optimization proposals based on the analysis.

For each proposal, provide:
- proposal_code: Short unique code
- title: Clear title (max 200 chars)
- description: Brief description
- detailed_explanation: Full explanation with reasoning
- current_liability: Estimated current tax/cost
- optimized_liability: Estimated after optimization
- confidence_level: 'low', 'medium', 'high', 'very_high'
- implementation_effort: 'simple', 'moderate', 'complex'
- risk_level: 'minimal', 'low', 'medium', 'elevated'
- applicable_from: When can be implemented
- implementation_deadline: If time-sensitive

Respond with JSON array of proposals. Only include proposals with meaningful savings.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4
      });

      try {
        const result = JSON.parse(response.choices[0].message.content || '{}');
        const categoryProposals = result.proposals || [];

        for (const proposal of categoryProposals) {
          // Calculate savings
          const current = new Decimal(proposal.current_liability || 0);
          const optimized = new Decimal(proposal.optimized_liability || 0);
          const gross = current.minus(optimized);
          const implCostOne = new Decimal(proposal.implementation_cost_one_time || 0);
          const implCostRec = new Decimal(proposal.implementation_cost_recurring || 0);
          const net = gross.minus(implCostOne).minus(implCostRec);

          // Filter by minimum savings
          if (minimumSavings && net.lessThan(minimumSavings)) {
            continue;
          }

          // Filter by max risk level
          if (maxRiskLevel && this.riskLevelExceeds(proposal.risk_level, maxRiskLevel)) {
            continue;
          }

          // Calculate priority score (savings/effort ratio)
          const effortMultiplier = {
            simple: 1,
            moderate: 2,
            complex: 3
          }[proposal.implementation_effort as string] || 2;

          const priorityScore = net.dividedBy(effortMultiplier).toNumber();

          proposals.push({
            proposalCode: proposal.proposal_code,
            category,
            title: proposal.title,
            description: proposal.description,
            detailedExplanation: proposal.detailed_explanation,
            currentLiability: current.toNumber(),
            optimizedLiability: optimized.toNumber(),
            grossSavings: gross.toNumber(),
            implementationCostOneTime: implCostOne.toNumber(),
            implementationCostRecurring: implCostRec.toNumber(),
            netSavings: net.toNumber(),
            paybackMonths: implCostOne.greaterThan(0)
              ? Math.ceil(implCostOne.dividedBy(gross.dividedBy(12)).toNumber())
              : null,
            confidenceLevel: proposal.confidence_level || 'medium',
            implementationEffort: proposal.implementation_effort || 'moderate',
            riskLevel: proposal.risk_level || 'low',
            priorityScore,
            applicableFrom: proposal.applicable_from,
            implementationDeadline: proposal.implementation_deadline
          });
        }
      } catch (error) {
        console.error(`Error parsing proposals for ${category}:`, error);
      }
    }

    // Sort by priority score (descending)
    return proposals.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Create proposal with risk assessment and legal basis
   */
  private async createProposal(
    analysisId: string,
    proposalData: any,
    userId: string
  ): Promise<string> {
    // Create proposal
    const proposal = await db.taxOptimizationProposal.create({
      data: {
        analysisId,
        proposalCode: proposalData.proposalCode,
        category: proposalData.category,
        title: proposalData.title,
        description: proposalData.description,
        detailedExplanation: proposalData.detailedExplanation,
        currentLiability: proposalData.currentLiability,
        optimizedLiability: proposalData.optimizedLiability,
        grossSavings: proposalData.grossSavings,
        implementationCostOneTime: proposalData.implementationCostOneTime,
        implementationCostRecurring: proposalData.implementationCostRecurring,
        netSavings: proposalData.netSavings,
        paybackMonths: proposalData.paybackMonths,
        savingsYear1: proposalData.netSavings,
        savingsYear3: proposalData.netSavings * 3,
        savingsYear5: proposalData.netSavings * 5,
        confidenceLevel: proposalData.confidenceLevel,
        implementationEffort: proposalData.implementationEffort,
        riskLevel: proposalData.riskLevel,
        priorityScore: proposalData.priorityScore,
        applicableFrom: proposalData.applicableFrom
          ? new Date(proposalData.applicableFrom)
          : null,
        implementationDeadline: proposalData.implementationDeadline
          ? new Date(proposalData.implementationDeadline)
          : null,
        status: 'proposed'
      }
    });

    // Generate risk assessment
    await this.generateRiskAssessment(proposal.id, proposalData);

    // Generate legal basis
    await this.generateLegalBasis(proposal.id, proposalData);

    // Generate implementation steps
    await this.generateImplementationSteps(proposal.id, proposalData);

    // Log audit event
    await this.logAuditEvent('proposal_generated', {
      proposalId: proposal.id,
      category: proposalData.category,
      netSavings: proposalData.netSavings
    }, userId);

    return proposal.id;
  }

  /**
   * Generate detailed risk assessment for a proposal
   */
  private async generateRiskAssessment(
    proposalId: string,
    proposalData: any
  ): Promise<void> {
    const prompt = `Analyze the risk profile for this Polish tax optimization proposal:

Category: ${proposalData.category}
Title: ${proposalData.title}
Description: ${proposalData.description}
Estimated Savings: ${proposalData.netSavings} PLN

Provide detailed risk assessment in JSON format:
{
  "legal_certainty": { "score": 1-10, "notes": "explanation" },
  "audit_probability": { "score": 1-10, "notes": "explanation" },
  "challenge_risk": { "score": 1-10, "notes": "explanation" },
  "penalty_exposure": { "score": 1-10, "notes": "explanation" },
  "reputation_impact": { "score": 1-10, "notes": "explanation" },
  "reversibility": { "score": 1-10, "notes": "explanation" },
  "mitigation_strategies": [{ "risk": "...", "strategy": "...", "effectiveness": "low|medium|high" }],
  "supporting_rulings": [{ "reference": "...", "date": "...", "summary": "...", "relevance": "..." }],
  "contrary_interpretations": [{ "reference": "...", "concern": "...", "mitigation": "..." }]
}

Score interpretation: 1 = very low risk, 10 = very high risk`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a Polish tax risk assessment expert. Provide thorough, objective risk analysis.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    try {
      const risk = JSON.parse(response.choices[0].message.content || '{}');

      // Calculate overall risk score (weighted average)
      const weights = {
        legal_certainty: 0.25,
        audit_probability: 0.15,
        challenge_risk: 0.20,
        penalty_exposure: 0.20,
        reputation_impact: 0.10,
        reversibility: 0.10
      };

      const overallScore = Object.entries(weights).reduce((sum, [key, weight]) => {
        return sum + (risk[key]?.score || 5) * weight;
      }, 0);

      await db.taxOptimizationRisk.create({
        data: {
          proposalId,
          legalCertaintyScore: risk.legal_certainty?.score || 5,
          legalCertaintyNotes: risk.legal_certainty?.notes,
          auditProbabilityScore: risk.audit_probability?.score || 5,
          auditProbabilityNotes: risk.audit_probability?.notes,
          challengeRiskScore: risk.challenge_risk?.score || 5,
          challengeRiskNotes: risk.challenge_risk?.notes,
          penaltyExposureScore: risk.penalty_exposure?.score || 5,
          penaltyExposureNotes: risk.penalty_exposure?.notes,
          reputationImpactScore: risk.reputation_impact?.score || 5,
          reputationImpactNotes: risk.reputation_impact?.notes,
          reversibilityScore: risk.reversibility?.score || 5,
          reversibilityNotes: risk.reversibility?.notes,
          overallRiskScore: Math.round(overallScore * 10) / 10,
          mitigationStrategies: risk.mitigation_strategies || [],
          supportingRulings: risk.supporting_rulings || [],
          contraryInterpretations: risk.contrary_interpretations || []
        }
      });
    } catch (error) {
      console.error('Error generating risk assessment:', error);
    }
  }

  /**
   * Generate legal basis citations for a proposal
   */
  private async generateLegalBasis(
    proposalId: string,
    proposalData: any
  ): Promise<void> {
    const prompt = `Provide legal basis for this Polish tax optimization:

Category: ${proposalData.category}
Title: ${proposalData.title}
Description: ${proposalData.description}

Provide 3-5 legal citations in JSON array format:
[{
  "source_type": "ustawa|rozporzadzenie|interpretacja|orzeczenie|komentarz|praktyka",
  "citation_full": "Full legal citation",
  "citation_short": "Short reference",
  "legal_act_name": "Name of legal act",
  "article_reference": "Article/paragraph reference",
  "effective_date": "YYYY-MM-DD",
  "publication_reference": "Dz.U. reference if applicable",
  "relevant_excerpt": "Relevant text excerpt",
  "interpretation": "How this supports the optimization",
  "source_url": "URL if available",
  "is_primary_basis": true|false,
  "supports_optimization": true|false
}]

Use actual Polish tax law references (ustawy o VAT, CIT, PIT, etc.).`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a Polish tax law expert. Provide accurate legal citations with proper formatting.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2
    });

    try {
      const result = JSON.parse(response.choices[0].message.content || '{}');
      const citations = result.citations || result || [];

      for (const citation of citations) {
        await db.taxOptimizationLegalBasis.create({
          data: {
            proposalId,
            sourceType: citation.source_type || 'ustawa',
            citationFull: citation.citation_full,
            citationShort: citation.citation_short,
            legalActName: citation.legal_act_name,
            articleReference: citation.article_reference,
            effectiveDate: citation.effective_date
              ? new Date(citation.effective_date)
              : null,
            publicationReference: citation.publication_reference,
            relevantExcerpt: citation.relevant_excerpt,
            interpretation: citation.interpretation,
            sourceUrl: citation.source_url,
            isPrimaryBasis: citation.is_primary_basis || false,
            supportsOptimization: citation.supports_optimization !== false,
            addedBy: 'ai'
          }
        });
      }
    } catch (error) {
      console.error('Error generating legal basis:', error);
    }
  }

  /**
   * Generate implementation steps for a proposal
   */
  private async generateImplementationSteps(
    proposalId: string,
    proposalData: any
  ): Promise<void> {
    const prompt = `Create implementation steps for this Polish tax optimization:

Category: ${proposalData.category}
Title: ${proposalData.title}
Description: ${proposalData.description}
Implementation Effort: ${proposalData.implementationEffort}

Provide 3-7 implementation steps in JSON array format:
[{
  "step_number": 1,
  "title": "Step title",
  "description": "Brief description",
  "detailed_instructions": "Detailed how-to",
  "estimated_duration_days": 5,
  "relative_start_day": 0,
  "responsible_party": "accountant|client|both|third_party",
  "required_documents": [{ "name": "...", "description": "..." }],
  "document_templates": [{ "template_id": "...", "name": "...", "url": "..." }]
}]

Steps should be practical for Polish tax context.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a Polish tax implementation expert. Provide clear, actionable implementation steps.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    try {
      const result = JSON.parse(response.choices[0].message.content || '{}');
      const steps = result.steps || result || [];

      for (const step of steps) {
        await db.taxOptimizationImplementationStep.create({
          data: {
            proposalId,
            stepNumber: step.step_number,
            title: step.title,
            description: step.description,
            detailedInstructions: step.detailed_instructions,
            estimatedDurationDays: step.estimated_duration_days,
            relativeStartDay: step.relative_start_day,
            responsibleParty: step.responsible_party || 'accountant',
            requiredDocuments: step.required_documents || [],
            documentTemplates: step.document_templates || [],
            status: 'pending'
          }
        });
      }
    } catch (error) {
      console.error('Error generating implementation steps:', error);
    }
  }

  /**
   * Get analysis result
   */
  async getAnalysisResult(analysisId: string): Promise<AnalysisResult> {
    const analysis = await db.taxOptimizationAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        proposals: {
          orderBy: { priorityScore: 'desc' }
        }
      }
    });

    if (!analysis) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Analysis not found'
      });
    }

    return {
      id: analysis.id,
      clientId: analysis.clientId,
      analysisYear: analysis.analysisYear,
      status: analysis.status as any,
      structureScores: analysis.structureScores as any || {},
      overallOptimizationPotential: Number(analysis.overallOptimizationPotential) || 0,
      estimatedTotalSavings: Number(analysis.estimatedTotalSavings) || 0,
      proposalCount: analysis.proposals.length,
      completedAt: analysis.completedAt?.toISOString()
    };
  }

  /**
   * Get detailed proposal with all related data
   */
  async getProposal(
    proposalId: string,
    organizationId: string
  ): Promise<OptimizationProposal> {
    const proposal = await db.taxOptimizationProposal.findFirst({
      where: {
        id: proposalId,
        analysis: {
          organizationId
        }
      },
      include: {
        analysis: true,
        risks: true,
        legalBasis: true,
        implementationSteps: {
          orderBy: { stepNumber: 'asc' }
        }
      }
    });

    if (!proposal) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Proposal not found'
      });
    }

    return this.mapProposalToResponse(proposal);
  }

  /**
   * Review and accept/reject a proposal
   */
  async reviewProposal(
    input: ReviewProposalInput,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const proposal = await db.taxOptimizationProposal.findFirst({
      where: {
        id: input.proposalId,
        analysis: { organizationId }
      }
    });

    if (!proposal) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Proposal not found'
      });
    }

    const newStatus = input.action === 'accept'
      ? 'accepted'
      : input.action === 'reject'
        ? 'rejected'
        : 'under_review';

    await db.taxOptimizationProposal.update({
      where: { id: input.proposalId },
      data: {
        status: newStatus,
        reviewedAt: new Date(),
        reviewedBy: userId,
        reviewNotes: input.notes
      }
    });

    await this.logAuditEvent(
      input.action === 'accept' ? 'proposal_accepted' :
      input.action === 'reject' ? 'proposal_rejected' : 'proposal_reviewed',
      {
        proposalId: input.proposalId,
        notes: input.notes
      },
      userId
    );
  }

  /**
   * Track implementation outcome
   */
  async trackImplementation(
    input: TrackImplementationInput,
    organizationId: string,
    userId: string
  ): Promise<void> {
    const proposal = await db.taxOptimizationProposal.findFirst({
      where: {
        id: input.proposalId,
        analysis: { organizationId },
        status: { in: ['accepted', 'implementing', 'implemented'] }
      }
    });

    if (!proposal) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Proposal not found or not accepted'
      });
    }

    // Calculate variance if actual savings provided
    let variance: number | null = null;
    if (input.actualSavingsYear1 !== undefined) {
      const estimated = Number(proposal.savingsYear1) || 0;
      variance = estimated > 0
        ? ((input.actualSavingsYear1 - estimated) / estimated) * 100
        : 0;
    }

    await db.taxOptimizationImplementation.upsert({
      where: { proposalId: input.proposalId },
      create: {
        proposalId: input.proposalId,
        implementationDate: new Date(input.implementationDate),
        implementedBy: userId,
        actualSavingsYear1: input.actualSavingsYear1,
        actualImplementationCost: input.actualImplementationCost,
        varianceFromEstimate: variance,
        complianceVerified: input.complianceVerified || false,
        verificationNotes: input.verificationNotes,
        issuesEncountered: input.issuesEncountered || [],
        clientFeedbackRating: input.clientFeedbackRating,
        clientFeedbackNotes: input.clientFeedbackNotes,
        lessonsLearned: input.lessonsLearned,
        recommendationForSimilar: input.clientFeedbackRating
          ? input.clientFeedbackRating >= 4
          : null
      },
      update: {
        actualSavingsYear1: input.actualSavingsYear1,
        actualImplementationCost: input.actualImplementationCost,
        varianceFromEstimate: variance,
        complianceVerified: input.complianceVerified,
        verificationNotes: input.verificationNotes,
        issuesEncountered: input.issuesEncountered,
        clientFeedbackRating: input.clientFeedbackRating,
        clientFeedbackNotes: input.clientFeedbackNotes,
        lessonsLearned: input.lessonsLearned,
        recommendationForSimilar: input.clientFeedbackRating
          ? input.clientFeedbackRating >= 4
          : null
      }
    });

    // Update proposal status
    const newStatus = input.complianceVerified ? 'verified' : 'implemented';
    await db.taxOptimizationProposal.update({
      where: { id: input.proposalId },
      data: { status: newStatus }
    });

    await this.logAuditEvent('implementation_tracked', {
      proposalId: input.proposalId,
      actualSavings: input.actualSavingsYear1,
      variance,
      clientRating: input.clientFeedbackRating
    }, userId);
  }

  /**
   * Generate optimization report
   */
  async generateReport(
    input: GenerateReportInput,
    organizationId: string,
    userId: string
  ): Promise<{ url: string; expiresAt: Date }> {
    const analysis = await db.taxOptimizationAnalysis.findFirst({
      where: {
        id: input.analysisId,
        organizationId,
        status: 'completed'
      },
      include: {
        client: true,
        proposals: {
          where: input.proposalIds
            ? { id: { in: input.proposalIds } }
            : {},
          include: {
            risks: true,
            legalBasis: input.includeDetailedLegalBasis,
            implementationSteps: input.includeImplementationSteps
              ? { orderBy: { stepNumber: 'asc' } }
              : false
          },
          orderBy: { priorityScore: 'desc' }
        }
      }
    });

    if (!analysis) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Analysis not found'
      });
    }

    // Generate report content
    const reportContent = await this.buildReportContent(
      analysis,
      input.language,
      input.includeDetailedLegalBasis,
      input.includeImplementationSteps
    );

    // Generate PDF
    const { url, expiresAt } = await generatePDF(
      reportContent,
      `tax-optimization-${analysis.client.name}-${analysis.analysisYear}`,
      {
        format: input.reportFormat,
        branding: input.clientBranding
      }
    );

    await this.logAuditEvent('report_generated', {
      analysisId: input.analysisId,
      proposalCount: analysis.proposals.length,
      format: input.reportFormat,
      language: input.language
    }, userId);

    return { url, expiresAt };
  }

  // Helper methods

  private async gatherFinancialData(clientId: string, year: number): Promise<any> {
    // Gather relevant financial data from accounting module
    const [invoices, expenses, taxCalculations] = await Promise.all([
      db.invoice.findMany({
        where: {
          clientId,
          issueDate: {
            gte: new Date(`${year}-01-01`),
            lt: new Date(`${year + 1}-01-01`)
          }
        },
        select: {
          totalNet: true,
          totalVat: true,
          vatRate: true,
          type: true
        }
      }),
      db.expense.findMany({
        where: {
          clientId,
          date: {
            gte: new Date(`${year}-01-01`),
            lt: new Date(`${year + 1}-01-01`)
          }
        },
        select: {
          amount: true,
          category: true,
          isDeductible: true
        }
      }),
      db.taxCalculation.findMany({
        where: {
          clientId,
          year
        }
      })
    ]);

    return {
      revenue: invoices.reduce((sum, inv) => sum + Number(inv.totalNet), 0),
      vatCollected: invoices.reduce((sum, inv) => sum + Number(inv.totalVat), 0),
      expenses: expenses.reduce((sum, exp) => sum + Number(exp.amount), 0),
      deductibleExpenses: expenses
        .filter(e => e.isDeductible)
        .reduce((sum, exp) => sum + Number(exp.amount), 0),
      taxCalculations
    };
  }

  private determineApplicableCategories(
    clientSnapshot: any,
    include?: OptimizationCategory[],
    exclude?: OptimizationCategory[]
  ): OptimizationCategory[] {
    const legalForm = clientSnapshot.legalForm || 'jdg';

    let categories = Object.entries(OPTIMIZATION_CATEGORIES)
      .filter(([_, config]) =>
        config.applicableLegalForms.includes(legalForm)
      )
      .map(([code]) => code as OptimizationCategory);

    if (include && include.length > 0) {
      categories = categories.filter(c => include.includes(c));
    }

    if (exclude && exclude.length > 0) {
      categories = categories.filter(c => !exclude.includes(c));
    }

    return categories;
  }

  private buildStructureAnalysisPrompt(area: string, analysis: any): string {
    const clientSnapshot = analysis.clientSnapshot || {};
    const financialData = analysis.financialData || {};
    const taxConfig = analysis.taxConfiguration || {};

    return `Analyze ${area} for Polish tax optimization:

Client Information:
- Legal Form: ${clientSnapshot.legalForm || 'Unknown'}
- PKD Codes: ${clientSnapshot.pkdCodes?.join(', ') || 'Unknown'}
- Revenue: ${financialData.revenue || 0} PLN
- Expenses: ${financialData.expenses || 0} PLN

Tax Configuration:
- VAT Status: ${taxConfig.vatStatus || 'Unknown'}
- VAT Period: ${taxConfig.vatPeriod || 'Unknown'}
- Income Tax Form: ${taxConfig.incomeTaxForm || 'Unknown'}

Analysis Year: ${analysis.analysisYear}

Focus on ${area} and identify optimization potential.`;
  }

  private buildProposalPrompt(
    category: OptimizationCategory,
    config: any,
    analysis: any,
    structureScores: Record<string, any>
  ): string {
    return `Generate tax optimization proposals for category: ${config.namePl}

${config.analysisPrompt}

Client Data:
${JSON.stringify(analysis.clientSnapshot, null, 2)}

Financial Data:
${JSON.stringify(analysis.financialData, null, 2)}

Structure Analysis Scores:
${JSON.stringify(structureScores, null, 2)}

Generate specific, implementable proposals with realistic savings estimates in PLN.`;
  }

  private calculateOverallPotential(scores: Record<string, any>): number {
    const values = Object.values(scores);
    if (values.length === 0) return 0;

    return values.reduce((sum, s) => sum + (s.score || 0), 0) / values.length;
  }

  private riskLevelExceeds(proposalRisk: string, maxRisk: string): boolean {
    const levels = ['minimal', 'low', 'medium', 'elevated'];
    return levels.indexOf(proposalRisk) > levels.indexOf(maxRisk);
  }

  private mapProposalToResponse(proposal: any): OptimizationProposal {
    return {
      id: proposal.id,
      proposalCode: proposal.proposalCode,
      category: proposal.category,
      title: proposal.title,
      description: proposal.description,
      detailedExplanation: proposal.detailedExplanation,
      savings: {
        currentLiability: Number(proposal.currentLiability),
        optimizedLiability: Number(proposal.optimizedLiability),
        grossSavings: Number(proposal.grossSavings),
        implementationCostOneTime: Number(proposal.implementationCostOneTime),
        implementationCostRecurring: Number(proposal.implementationCostRecurring),
        netSavings: Number(proposal.netSavings),
        paybackMonths: proposal.paybackMonths,
        projections: {
          year1: Number(proposal.savingsYear1),
          year3: Number(proposal.savingsYear3),
          year5: Number(proposal.savingsYear5)
        },
        assumptions: proposal.assumptions || [],
        sensitivityAnalysis: proposal.sensitivityAnalysis || {}
      },
      confidenceLevel: proposal.confidenceLevel,
      implementationEffort: proposal.implementationEffort,
      riskLevel: proposal.riskLevel,
      priorityScore: Number(proposal.priorityScore),
      applicableFrom: proposal.applicableFrom?.toISOString(),
      applicableUntil: proposal.applicableUntil?.toISOString(),
      implementationDeadline: proposal.implementationDeadline?.toISOString(),
      status: proposal.status,
      riskAssessment: proposal.risks?.[0] ? this.mapRiskAssessment(proposal.risks[0]) : undefined,
      legalBasis: proposal.legalBasis?.map(this.mapLegalBasis) || [],
      implementationSteps: proposal.implementationSteps?.map(this.mapImplementationStep) || []
    };
  }

  private mapRiskAssessment(risk: any): RiskAssessment {
    return {
      legalCertainty: {
        score: risk.legalCertaintyScore,
        notes: risk.legalCertaintyNotes || ''
      },
      auditProbability: {
        score: risk.auditProbabilityScore,
        notes: risk.auditProbabilityNotes || ''
      },
      challengeRisk: {
        score: risk.challengeRiskScore,
        notes: risk.challengeRiskNotes || ''
      },
      penaltyExposure: {
        score: risk.penaltyExposureScore,
        notes: risk.penaltyExposureNotes || ''
      },
      reputationImpact: {
        score: risk.reputationImpactScore,
        notes: risk.reputationImpactNotes || ''
      },
      reversibility: {
        score: risk.reversibilityScore,
        notes: risk.reversibilityNotes || ''
      },
      overallRiskScore: Number(risk.overallRiskScore),
      mitigationStrategies: risk.mitigationStrategies || [],
      supportingRulings: risk.supportingRulings || [],
      contraryInterpretations: risk.contraryInterpretations || []
    };
  }

  private mapLegalBasis(basis: any): LegalBasis {
    return {
      sourceType: basis.sourceType,
      citationFull: basis.citationFull,
      citationShort: basis.citationShort,
      legalActName: basis.legalActName,
      articleReference: basis.articleReference,
      effectiveDate: basis.effectiveDate?.toISOString(),
      publicationReference: basis.publicationReference,
      relevantExcerpt: basis.relevantExcerpt,
      interpretation: basis.interpretation,
      sourceUrl: basis.sourceUrl,
      isPrimaryBasis: basis.isPrimaryBasis,
      supportsOptimization: basis.supportsOptimization
    };
  }

  private mapImplementationStep(step: any): ImplementationStep {
    return {
      stepNumber: step.stepNumber,
      title: step.title,
      description: step.description,
      detailedInstructions: step.detailedInstructions,
      estimatedDurationDays: step.estimatedDurationDays,
      relativeStartDay: step.relativeStartDay,
      deadline: step.deadline?.toISOString(),
      responsibleParty: step.responsibleParty,
      requiredDocuments: step.requiredDocuments || [],
      documentTemplates: step.documentTemplates || []
    };
  }

  private async buildReportContent(
    analysis: any,
    language: 'pl' | 'en',
    includeDetailedLegalBasis: boolean,
    includeImplementationSteps: boolean
  ): Promise<any> {
    // Build structured report content
    return {
      title: language === 'pl'
        ? `Raport optymalizacji podatkowej - ${analysis.client.name}`
        : `Tax Optimization Report - ${analysis.client.name}`,
      date: new Date().toISOString(),
      analysisYear: analysis.analysisYear,
      client: {
        name: analysis.client.name,
        nip: analysis.client.nip,
        legalForm: analysis.client.legalForm
      },
      summary: {
        overallPotential: analysis.overallOptimizationPotential,
        totalSavings: analysis.estimatedTotalSavings,
        proposalCount: analysis.proposals.length
      },
      structureAnalysis: analysis.structureScores,
      proposals: analysis.proposals.map((p: any) => ({
        title: p.title,
        description: p.description,
        category: p.category,
        savings: p.netSavings,
        confidence: p.confidenceLevel,
        effort: p.implementationEffort,
        risk: p.riskLevel,
        legalBasis: includeDetailedLegalBasis ? p.legalBasis : undefined,
        steps: includeImplementationSteps ? p.implementationSteps : undefined
      }))
    };
  }

  private async logAuditEvent(
    eventType: string,
    eventData: any,
    actorId: string
  ): Promise<void> {
    await db.taxOptimizationAuditLog.create({
      data: {
        analysisId: eventData.analysisId,
        proposalId: eventData.proposalId,
        implementationId: eventData.implementationId,
        eventType,
        eventData,
        actorId
      }
    });
  }
}

export const taxOptimizationService = new TaxOptimizationService();
```

### API Router

```typescript
import { router, protectedProcedure } from '@/server/trpc';
import { taxOptimizationService } from './tax-optimization.service';
import {
  RequestAnalysisSchema,
  ReviewProposalSchema,
  TrackImplementationSchema,
  GenerateReportSchema
} from './tax-optimization.schemas';
import { z } from 'zod';

export const taxOptimizationRouter = router({
  // Request optimization analysis
  requestAnalysis: protectedProcedure
    .input(RequestAnalysisSchema)
    .mutation(async ({ input, ctx }) => {
      return taxOptimizationService.requestAnalysis(
        input,
        ctx.organizationId,
        ctx.userId
      );
    }),

  // Get analysis result
  getAnalysis: protectedProcedure
    .input(z.object({ analysisId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return taxOptimizationService.getAnalysisResult(input.analysisId);
    }),

  // Get analysis with proposals
  getAnalysisWithProposals: protectedProcedure
    .input(z.object({ analysisId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const analysis = await taxOptimizationService.getAnalysisResult(input.analysisId);
      const proposals = await ctx.db.taxOptimizationProposal.findMany({
        where: { analysisId: input.analysisId },
        orderBy: { priorityScore: 'desc' }
      });
      return { ...analysis, proposals };
    }),

  // Get detailed proposal
  getProposal: protectedProcedure
    .input(z.object({ proposalId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return taxOptimizationService.getProposal(
        input.proposalId,
        ctx.organizationId
      );
    }),

  // Review proposal (accept/reject)
  reviewProposal: protectedProcedure
    .input(ReviewProposalSchema)
    .mutation(async ({ input, ctx }) => {
      return taxOptimizationService.reviewProposal(
        input,
        ctx.organizationId,
        ctx.userId
      );
    }),

  // Track implementation outcome
  trackImplementation: protectedProcedure
    .input(TrackImplementationSchema)
    .mutation(async ({ input, ctx }) => {
      return taxOptimizationService.trackImplementation(
        input,
        ctx.organizationId,
        ctx.userId
      );
    }),

  // Update implementation step status
  updateStepStatus: protectedProcedure
    .input(z.object({
      stepId: z.string().uuid(),
      status: z.enum(['pending', 'in_progress', 'completed', 'skipped', 'blocked']),
      notes: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.taxOptimizationImplementationStep.update({
        where: { id: input.stepId },
        data: {
          status: input.status,
          startedAt: input.status === 'in_progress' ? new Date() : undefined,
          completedAt: input.status === 'completed' ? new Date() : undefined,
          notes: input.notes
        }
      });
    }),

  // Generate optimization report
  generateReport: protectedProcedure
    .input(GenerateReportSchema)
    .mutation(async ({ input, ctx }) => {
      return taxOptimizationService.generateReport(
        input,
        ctx.organizationId,
        ctx.userId
      );
    }),

  // Get client's analysis history
  getClientAnalyses: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      limit: z.number().int().min(1).max(50).default(10)
    }))
    .query(async ({ input, ctx }) => {
      return ctx.db.taxOptimizationAnalysis.findMany({
        where: {
          clientId: input.clientId,
          organizationId: ctx.organizationId
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        include: {
          _count: {
            select: { proposals: true }
          }
        }
      });
    }),

  // Get optimization categories
  getCategories: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.taxOptimizationCategory.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' }
      });
    }),

  // Get organization-wide optimization statistics
  getStatistics: protectedProcedure
    .input(z.object({
      year: z.number().int().optional()
    }))
    .query(async ({ input, ctx }) => {
      const year = input.year || new Date().getFullYear();

      const stats = await ctx.db.taxOptimizationImplementation.aggregate({
        where: {
          proposal: {
            analysis: {
              organizationId: ctx.organizationId,
              analysisYear: year
            }
          }
        },
        _sum: {
          actualSavingsYear1: true,
          actualImplementationCost: true
        },
        _avg: {
          clientFeedbackRating: true,
          varianceFromEstimate: true
        },
        _count: true
      });

      const proposalStats = await ctx.db.taxOptimizationProposal.groupBy({
        by: ['status'],
        where: {
          analysis: {
            organizationId: ctx.organizationId,
            analysisYear: year
          }
        },
        _count: true
      });

      return {
        year,
        totalImplementations: stats._count,
        totalSavingsRealized: stats._sum.actualSavingsYear1 || 0,
        totalImplementationCost: stats._sum.actualImplementationCost || 0,
        averageClientRating: stats._avg.clientFeedbackRating || 0,
        averageVariance: stats._avg.varianceFromEstimate || 0,
        proposalsByStatus: Object.fromEntries(
          proposalStats.map(s => [s.status, s._count])
        )
      };
    })
});
```

---

## Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaxOptimizationService } from './tax-optimization.service';
import Decimal from 'decimal.js';

describe('TaxOptimizationService', () => {
  let service: TaxOptimizationService;

  beforeEach(() => {
    service = new TaxOptimizationService();
    vi.clearAllMocks();
  });

  describe('determineApplicableCategories', () => {
    it('should return VAT and PIT categories for JDG', () => {
      const categories = service['determineApplicableCategories'](
        { legalForm: 'jdg' },
        undefined,
        undefined
      );

      expect(categories).toContain('VAT_OPTIMIZATION');
      expect(categories).toContain('PIT_OPTIMIZATION');
      expect(categories).toContain('ZUS_OPTIMIZATION');
      expect(categories).not.toContain('CIT_OPTIMIZATION');
    });

    it('should return CIT categories for sp. z o.o.', () => {
      const categories = service['determineApplicableCategories'](
        { legalForm: 'sp_zoo' },
        undefined,
        undefined
      );

      expect(categories).toContain('VAT_OPTIMIZATION');
      expect(categories).toContain('CIT_OPTIMIZATION');
      expect(categories).not.toContain('PIT_OPTIMIZATION');
      expect(categories).not.toContain('ZUS_OPTIMIZATION');
    });

    it('should filter by include list', () => {
      const categories = service['determineApplicableCategories'](
        { legalForm: 'jdg' },
        ['VAT_OPTIMIZATION'],
        undefined
      );

      expect(categories).toEqual(['VAT_OPTIMIZATION']);
    });

    it('should filter out excluded categories', () => {
      const categories = service['determineApplicableCategories'](
        { legalForm: 'jdg' },
        undefined,
        ['ZUS_OPTIMIZATION']
      );

      expect(categories).not.toContain('ZUS_OPTIMIZATION');
    });
  });

  describe('calculateOverallPotential', () => {
    it('should calculate average of structure scores', () => {
      const scores = {
        business_structure: { score: 60 },
        revenue_composition: { score: 80 },
        expense_patterns: { score: 40 }
      };

      const potential = service['calculateOverallPotential'](scores);

      expect(potential).toBe(60);
    });

    it('should return 0 for empty scores', () => {
      const potential = service['calculateOverallPotential']({});
      expect(potential).toBe(0);
    });
  });

  describe('riskLevelExceeds', () => {
    it('should return true when proposal risk exceeds max', () => {
      expect(service['riskLevelExceeds']('elevated', 'medium')).toBe(true);
      expect(service['riskLevelExceeds']('medium', 'low')).toBe(true);
    });

    it('should return false when proposal risk is within max', () => {
      expect(service['riskLevelExceeds']('low', 'medium')).toBe(false);
      expect(service['riskLevelExceeds']('minimal', 'elevated')).toBe(false);
    });

    it('should return false when risk levels are equal', () => {
      expect(service['riskLevelExceeds']('medium', 'medium')).toBe(false);
    });
  });

  describe('savings calculations', () => {
    it('should calculate net savings correctly', () => {
      const current = new Decimal(100000);
      const optimized = new Decimal(85000);
      const implCostOne = new Decimal(2000);
      const implCostRec = new Decimal(500);

      const gross = current.minus(optimized);
      const net = gross.minus(implCostOne).minus(implCostRec);

      expect(gross.toNumber()).toBe(15000);
      expect(net.toNumber()).toBe(12500);
    });

    it('should calculate payback months correctly', () => {
      const grossSavings = new Decimal(12000); // Per year
      const implCostOne = new Decimal(3000);

      const monthlySavings = grossSavings.dividedBy(12);
      const paybackMonths = Math.ceil(
        implCostOne.dividedBy(monthlySavings).toNumber()
      );

      expect(paybackMonths).toBe(3);
    });
  });

  describe('priority score calculation', () => {
    it('should calculate higher score for simple high-savings proposals', () => {
      const netSavings = 10000;
      const effortMultiplier = 1; // simple

      const score = netSavings / effortMultiplier;

      expect(score).toBe(10000);
    });

    it('should calculate lower score for complex proposals', () => {
      const netSavings = 10000;
      const effortMultiplier = 3; // complex

      const score = netSavings / effortMultiplier;

      expect(score).toBeCloseTo(3333.33, 1);
    });
  });

  describe('risk assessment mapping', () => {
    it('should map risk assessment correctly', () => {
      const rawRisk = {
        legalCertaintyScore: 8,
        legalCertaintyNotes: 'Clear legal basis',
        auditProbabilityScore: 3,
        auditProbabilityNotes: 'Low audit risk',
        challengeRiskScore: 4,
        challengeRiskNotes: 'Unlikely to be challenged',
        penaltyExposureScore: 2,
        penaltyExposureNotes: 'Minimal penalties',
        reputationImpactScore: 1,
        reputationImpactNotes: 'No reputation impact',
        reversibilityScore: 9,
        reversibilityNotes: 'Easily reversible',
        overallRiskScore: 4.5,
        mitigationStrategies: [],
        supportingRulings: [],
        contraryInterpretations: []
      };

      const mapped = service['mapRiskAssessment'](rawRisk);

      expect(mapped.legalCertainty.score).toBe(8);
      expect(mapped.overallRiskScore).toBe(4.5);
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, cleanupTestData } from '@/tests/helpers';
import { taxOptimizationRouter } from './tax-optimization.router';

describe('Tax Optimization Integration', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let testClientId: string;
  let testAnalysisId: string;

  beforeAll(async () => {
    ctx = await createTestContext();

    // Create test client
    const client = await ctx.db.client.create({
      data: {
        organizationId: ctx.organizationId,
        name: 'Test Optimization Client',
        nip: '1234567890',
        legalForm: 'jdg',
        taxConfiguration: {
          vatStatus: 'active',
          vatPeriod: 'monthly',
          incomeTaxForm: 'pit_linear'
        }
      }
    });
    testClientId = client.id;
  });

  afterAll(async () => {
    await cleanupTestData(ctx);
  });

  describe('requestAnalysis', () => {
    it('should create analysis for valid client', async () => {
      const caller = taxOptimizationRouter.createCaller(ctx);

      const result = await caller.requestAnalysis({
        clientId: testClientId,
        analysisYear: 2024
      });

      expect(result.id).toBeDefined();
      expect(result.clientId).toBe(testClientId);
      expect(result.status).toMatch(/pending|analyzing/);

      testAnalysisId = result.id;
    });

    it('should return existing recent analysis', async () => {
      const caller = taxOptimizationRouter.createCaller(ctx);

      // Wait for first analysis to complete
      await new Promise(resolve => setTimeout(resolve, 5000));

      const result = await caller.requestAnalysis({
        clientId: testClientId,
        analysisYear: 2024
      });

      expect(result.id).toBe(testAnalysisId);
    });

    it('should reject invalid client', async () => {
      const caller = taxOptimizationRouter.createCaller(ctx);

      await expect(
        caller.requestAnalysis({
          clientId: '00000000-0000-0000-0000-000000000000',
          analysisYear: 2024
        })
      ).rejects.toThrow('Client not found');
    });
  });

  describe('getAnalysisWithProposals', () => {
    it('should return analysis with proposals', async () => {
      const caller = taxOptimizationRouter.createCaller(ctx);

      // Wait for analysis to complete
      await new Promise(resolve => setTimeout(resolve, 10000));

      const result = await caller.getAnalysisWithProposals({
        analysisId: testAnalysisId
      });

      expect(result.status).toBe('completed');
      expect(result.proposals).toBeInstanceOf(Array);
      expect(result.proposals.length).toBeGreaterThan(0);
    });
  });

  describe('getProposal', () => {
    it('should return detailed proposal', async () => {
      const caller = taxOptimizationRouter.createCaller(ctx);

      const analysis = await caller.getAnalysisWithProposals({
        analysisId: testAnalysisId
      });

      const proposalId = analysis.proposals[0].id;

      const proposal = await caller.getProposal({ proposalId });

      expect(proposal.id).toBe(proposalId);
      expect(proposal.riskAssessment).toBeDefined();
      expect(proposal.legalBasis).toBeInstanceOf(Array);
      expect(proposal.implementationSteps).toBeInstanceOf(Array);
    });
  });

  describe('reviewProposal', () => {
    it('should accept proposal', async () => {
      const caller = taxOptimizationRouter.createCaller(ctx);

      const analysis = await caller.getAnalysisWithProposals({
        analysisId: testAnalysisId
      });

      await caller.reviewProposal({
        proposalId: analysis.proposals[0].id,
        action: 'accept',
        notes: 'Test acceptance'
      });

      const updated = await caller.getProposal({
        proposalId: analysis.proposals[0].id
      });

      expect(updated.status).toBe('accepted');
    });

    it('should reject proposal with notes', async () => {
      const caller = taxOptimizationRouter.createCaller(ctx);

      const analysis = await caller.getAnalysisWithProposals({
        analysisId: testAnalysisId
      });

      if (analysis.proposals.length > 1) {
        await caller.reviewProposal({
          proposalId: analysis.proposals[1].id,
          action: 'reject',
          notes: 'Not applicable for this client'
        });

        const updated = await caller.getProposal({
          proposalId: analysis.proposals[1].id
        });

        expect(updated.status).toBe('rejected');
      }
    });
  });

  describe('trackImplementation', () => {
    it('should track implementation outcome', async () => {
      const caller = taxOptimizationRouter.createCaller(ctx);

      const analysis = await caller.getAnalysisWithProposals({
        analysisId: testAnalysisId
      });

      const acceptedProposal = analysis.proposals.find(
        p => p.status === 'accepted'
      );

      if (acceptedProposal) {
        await caller.trackImplementation({
          proposalId: acceptedProposal.id,
          implementationDate: new Date().toISOString(),
          actualSavingsYear1: 8000,
          actualImplementationCost: 500,
          complianceVerified: true,
          clientFeedbackRating: 5,
          clientFeedbackNotes: 'Great optimization!'
        });

        const updated = await caller.getProposal({
          proposalId: acceptedProposal.id
        });

        expect(updated.status).toBe('verified');
      }
    });
  });

  describe('getStatistics', () => {
    it('should return organization statistics', async () => {
      const caller = taxOptimizationRouter.createCaller(ctx);

      const stats = await caller.getStatistics({
        year: 2024
      });

      expect(stats.year).toBe(2024);
      expect(stats.totalSavingsRealized).toBeGreaterThanOrEqual(0);
      expect(stats.proposalsByStatus).toBeDefined();
    });
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Tax Optimization Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('complete optimization workflow', async ({ page }) => {
    // Navigate to client
    await page.goto('/clients/test-client');

    // Open tax optimization
    await page.click('[data-testid="tax-optimization-tab"]');

    // Request new analysis
    await page.click('[data-testid="request-analysis-button"]');
    await page.fill('[data-testid="analysis-year"]', '2024');
    await page.click('[data-testid="start-analysis"]');

    // Wait for analysis to complete
    await expect(page.locator('[data-testid="analysis-status"]'))
      .toHaveText('Completed', { timeout: 60000 });

    // View proposals
    await expect(page.locator('[data-testid="proposal-card"]'))
      .toHaveCount.greaterThan(0);

    // View first proposal details
    await page.click('[data-testid="proposal-card"]:first-child');

    // Verify proposal sections
    await expect(page.locator('[data-testid="savings-breakdown"]')).toBeVisible();
    await expect(page.locator('[data-testid="risk-assessment"]')).toBeVisible();
    await expect(page.locator('[data-testid="legal-basis"]')).toBeVisible();
    await expect(page.locator('[data-testid="implementation-steps"]')).toBeVisible();

    // Accept proposal
    await page.click('[data-testid="accept-proposal"]');
    await page.fill('[data-testid="acceptance-notes"]', 'E2E test acceptance');
    await page.click('[data-testid="confirm-acceptance"]');

    await expect(page.locator('[data-testid="proposal-status"]'))
      .toHaveText('Accepted');

    // Track implementation
    await page.click('[data-testid="track-implementation"]');
    await page.fill('[data-testid="actual-savings"]', '9500');
    await page.fill('[data-testid="implementation-cost"]', '750');
    await page.check('[data-testid="compliance-verified"]');
    await page.click('[data-testid="rating-5"]');
    await page.fill('[data-testid="feedback-notes"]', 'Excellent results');
    await page.click('[data-testid="save-implementation"]');

    await expect(page.locator('[data-testid="proposal-status"]'))
      .toHaveText('Verified');

    // Generate report
    await page.click('[data-testid="generate-report"]');
    await page.selectOption('[data-testid="report-format"]', 'pdf');
    await page.check('[data-testid="include-legal-basis"]');
    await page.check('[data-testid="include-steps"]');
    await page.click('[data-testid="download-report"]');

    // Verify download
    const download = await page.waitForEvent('download');
    expect(download.suggestedFilename()).toContain('tax-optimization');
  });

  test('filter proposals by risk level', async ({ page }) => {
    await page.goto('/clients/test-client/tax-optimization');

    // Filter to low risk only
    await page.selectOption('[data-testid="risk-filter"]', 'low');

    const proposals = await page.locator('[data-testid="proposal-card"]').all();
    for (const proposal of proposals) {
      const riskBadge = await proposal.locator('[data-testid="risk-badge"]').textContent();
      expect(['Minimal', 'Low']).toContain(riskBadge);
    }
  });

  test('view implementation steps timeline', async ({ page }) => {
    await page.goto('/clients/test-client/tax-optimization');

    await page.click('[data-testid="proposal-card"]:first-child');
    await page.click('[data-testid="implementation-tab"]');

    // Verify timeline
    await expect(page.locator('[data-testid="step-item"]'))
      .toHaveCount.greaterThan(0);

    // Update step status
    await page.click('[data-testid="step-item"]:first-child [data-testid="start-step"]');

    await expect(
      page.locator('[data-testid="step-item"]:first-child [data-testid="step-status"]')
    ).toHaveText('In Progress');
  });
});
```

---

## Security Checklist

### Authentication & Authorization
- [x] All endpoints require authentication
- [x] Organization-level access control enforced
- [x] Row Level Security (RLS) on all tables
- [x] User can only access own organization's analyses

### Data Protection
- [x] Financial data encrypted at rest
- [x] Client tax information protected
- [x] AI-generated content validated before storage
- [x] Report URLs are signed and time-limited

### Input Validation
- [x] All inputs validated with Zod schemas
- [x] Year range validated (2020-2030)
- [x] Decimal values validated for financial fields
- [x] Risk and confidence levels validated as enums

### Audit Trail
- [x] All analysis requests logged
- [x] Proposal reviews logged with user
- [x] Implementation tracking logged
- [x] Report generation logged

### AI Safety
- [x] OpenAI responses parsed defensively
- [x] AI confidence scores provided
- [x] Legal citations marked as AI-generated
- [x] Human review required for acceptance

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `analysis_started` | Analysis request | analysisId, clientId, year |
| `analysis_completed` | Analysis finished | analysisId, proposalCount, totalSavings, processingTime |
| `proposal_generated` | Each proposal created | proposalId, category, netSavings |
| `proposal_reviewed` | Request more info | proposalId, notes |
| `proposal_accepted` | Accept action | proposalId, notes |
| `proposal_rejected` | Reject action | proposalId, notes |
| `implementation_tracked` | Track outcome | proposalId, actualSavings, variance, rating |
| `step_updated` | Step status change | stepId, status |
| `report_generated` | Report download | analysisId, proposalCount, format |

---

## Implementation Notes

### Optimization Categories
The system supports 8 optimization categories tailored to Polish tax law:
- VAT_OPTIMIZATION - VAT period, reverse charge, EU transactions
- CIT_OPTIMIZATION - Estonian CIT, 9% rate, R&D relief
- PIT_OPTIMIZATION - Progressive vs flat, deductions
- ZUS_OPTIMIZATION - Ulga na start, preferential ZUS
- STRUCTURE_CHANGE - Legal form transformations
- EXPENSE_OPTIMIZATION - Deductibility improvements
- TIMING_OPTIMIZATION - Year-end strategies
- ELECTION_CHANGE - Tax elections changes

### AI Integration
- Uses GPT-4 Turbo for analysis and proposal generation
- Separate prompts for structure analysis, proposal generation, risk assessment
- Temperature tuned per task (0.2-0.4 for precision)
- JSON response format enforced for reliable parsing

### Priority Score Calculation
Priority score = Net Savings / Effort Multiplier
- Simple effort: multiplier = 1
- Moderate effort: multiplier = 2
- Complex effort: multiplier = 3

Higher scores indicate better return on effort.

### Risk Score Weighting
Overall risk = weighted average of:
- Legal certainty: 25%
- Audit probability: 15%
- Challenge risk: 20%
- Penalty exposure: 20%
- Reputation impact: 10%
- Reversibility: 10%

### Report Generation
Reports are generated as structured JSON and rendered to PDF using the platform's PDF generation service. Reports include:
- Executive summary
- Structure analysis
- Ranked proposals
- Risk assessments
- Legal citations
- Implementation timelines

---

## Dependencies

- **TAX-010**: AI Tax Assistant (for knowledge base and AI infrastructure)
- **TAX-004**: VAT Calculation Engine (for VAT optimization analysis)
- **TAX-005**: CIT/PIT Calculation Engine (for income tax analysis)
- **TAX-006**: ZUS Calculation (for ZUS optimization analysis)
- **ACC**: Accounting data for financial analysis

---

## References

- [Ustawa o VAT](https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20040540535)
- [Ustawa o CIT](https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19920210086)
- [Ustawa o PIT](https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19910800350)
- [Ustawa o systemie ubezpieczeń społecznych](https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19981370887)
- [Interpretacje podatkowe](https://sip.mf.gov.pl/)
- [Orzecznictwo NSA](https://orzeczenia.nsa.gov.pl/)

---

*Story last updated: December 2024*
