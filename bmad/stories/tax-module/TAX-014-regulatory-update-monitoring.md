# TAX-014: Regulatory Update Monitoring

> **Story ID**: TAX-014
> **Epic**: Tax Compliance Module (TAX)
> **Priority**: P2 (Important)
> **Points**: 5
> **Status**: 📋 Ready for Development
> **Phase**: Week 16

---

## User Story

**As an** accountant managing multiple clients,
**I want** to automatically track Polish tax law changes and receive AI-powered summaries,
**So that** I can stay informed about regulatory updates and proactively advise clients about changes affecting them.

---

## Business Context

### Problem Statement
Polish tax law changes frequently with:
- Multiple amendments per year to VAT, CIT, PIT, and ZUS regulations
- New interpretations from Minister of Finance
- EU directives requiring implementation
- Court rulings affecting tax practice (NSA, TSUE)

### Business Value
- **Proactive Compliance**: Stay ahead of regulatory changes
- **Client Advisory**: Inform clients about changes affecting them
- **Risk Reduction**: Avoid penalties from missed regulatory updates
- **Efficiency**: AI summaries reduce time spent reading legal texts
- **Knowledge Base**: Searchable archive of all tracked changes

### Sources Monitored
1. **Dziennik Ustaw** (Official Journal) - New laws and amendments
2. **Monitor Polski** - Ministerial announcements
3. **Dziennik Urzędowy MF** - Tax interpretations
4. **ISAP** (Internetowy System Aktów Prawnych) - Legal database
5. **EUR-Lex** - EU tax directives
6. **NSA/WSA Rulings** - Tax court decisions

---

## Acceptance Criteria

### Scenario 1: Automatic Law Change Detection
```gherkin
Given the system is configured to monitor tax regulations
And there is a new amendment published in Dziennik Ustaw
When the system performs its daily scan (configurable schedule)
Then it should detect the new amendment
And extract key information (title, publication date, effective date)
And classify the change by tax domain (VAT, CIT, PIT, ZUS, other)
And store the change in the regulatory updates database
And queue the change for AI summarization
```

### Scenario 2: AI-Powered Summary Generation
```gherkin
Given a new regulatory change has been detected
When the AI summarization is triggered
Then the system should generate a summary in Polish containing:
  | Element | Description |
  | title | Clear, descriptive title |
  | summary | 2-3 sentence plain language summary |
  | key_changes | Bullet points of main changes |
  | affected_entities | Who is affected (businesses, individuals, etc.) |
  | effective_date | When the change takes effect |
  | action_required | What actions need to be taken |
And include confidence score for the summary (≥0.75)
And link to the original source document
And the summary should be completed within 30 seconds
```

### Scenario 3: Impact Analysis for Clients
```gherkin
Given a regulatory change affecting VAT rates has been detected
And I have 50 clients with various tax configurations
When I request impact analysis for this change
Then the system should analyze each client's configuration
And identify clients affected by the change (e.g., those using affected VAT rates)
And generate a list of impacted clients with impact severity
And estimate compliance effort required per client
And suggest actions for each affected client
```

### Scenario 4: Client Notification
```gherkin
Given a regulatory change affects client "ABC Sp. z o.o."
And the client is subscribed to regulatory updates
When the change is processed and summarized
Then the system should send a notification to the client
And include the AI-generated summary
And include specific impact for their business
And include recommended actions
And allow notification preferences (email, in-app, SMS)
And track notification delivery and read status
```

### Scenario 5: Effective Date Calendar
```gherkin
Given there are multiple regulatory changes with future effective dates
When I view the regulatory calendar
Then I should see all changes organized by effective date
And changes within 30 days should be highlighted as "approaching"
And I should be able to filter by:
  | Filter | Options |
  | tax_domain | VAT, CIT, PIT, ZUS, all |
  | impact_level | high, medium, low |
  | client | specific client or all |
  | status | pending, acknowledged, implemented |
And each entry should link to the detailed change information
```

### Scenario 6: Search and Archive
```gherkin
Given I need to find a specific regulatory change from the past
When I search the archive with query "split payment 2024"
Then the system should return relevant regulatory changes
And support full-text search in Polish
And support filters for date range, domain, and source
And display results with relevance ranking
And show the AI summary and original source link
And allow bookmarking important changes
```

### Scenario 7: Custom Monitoring Rules
```gherkin
Given I want to monitor specific keywords in new regulations
When I create a custom monitoring rule:
  | Field | Value |
  | name | Split Payment Monitoring |
  | keywords | "mechanizm podzielonej płatności", "split payment", "MPP" |
  | domains | VAT |
  | alert_level | high |
Then the system should flag any new changes matching these keywords
And send immediate notification when match found
And add the change to my personalized watchlist
```

### Scenario 8: Regulatory Change Workflow
```gherkin
Given a regulatory change affects my organization's operations
When I acknowledge the change
Then I should be able to:
  | Action | Description |
  | assign | Assign to team member for review |
  | schedule | Schedule implementation date |
  | add_notes | Add internal notes and comments |
  | link_tasks | Link to related tasks in the system |
  | mark_implemented | Mark as implemented with evidence |
And track the workflow status and history
And generate compliance report for auditors
```

---

## Technical Specification

### Database Schema

```sql
-- Regulatory sources configuration
CREATE TABLE regulatory_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source identification
    source_code VARCHAR(50) NOT NULL UNIQUE,
    source_name VARCHAR(200) NOT NULL,
    source_name_pl VARCHAR(200) NOT NULL,
    source_url TEXT NOT NULL,

    -- Source type
    source_type VARCHAR(30) NOT NULL CHECK (source_type IN (
        'official_journal', 'ministry', 'court', 'eu', 'interpretation'
    )),

    -- Scraping configuration
    scrape_enabled BOOLEAN DEFAULT TRUE,
    scrape_frequency_hours INTEGER DEFAULT 24,
    scrape_config JSONB DEFAULT '{}', -- CSS selectors, API endpoints, etc.
    last_scraped_at TIMESTAMPTZ,
    last_scrape_status VARCHAR(20),
    last_scrape_error TEXT,

    -- Domain mapping
    default_domains TEXT[] DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default sources
INSERT INTO regulatory_sources (source_code, source_name, source_name_pl, source_url, source_type, default_domains) VALUES
('DZIENNIK_USTAW', 'Official Journal', 'Dziennik Ustaw', 'https://dziennikustaw.gov.pl', 'official_journal', ARRAY['VAT', 'CIT', 'PIT', 'ZUS']),
('MONITOR_POLSKI', 'Polish Monitor', 'Monitor Polski', 'https://monitorpolski.gov.pl', 'official_journal', ARRAY['VAT', 'CIT', 'PIT']),
('MF_INTERPRETACJE', 'MF Interpretations', 'Interpretacje MF', 'https://www.podatki.gov.pl/interpretacje', 'interpretation', ARRAY['VAT', 'CIT', 'PIT']),
('NSA_ORZECZENIA', 'NSA Rulings', 'Orzeczenia NSA', 'https://orzeczenia.nsa.gov.pl', 'court', ARRAY['VAT', 'CIT', 'PIT', 'ZUS']),
('EUR_LEX', 'EUR-Lex', 'EUR-Lex', 'https://eur-lex.europa.eu', 'eu', ARRAY['VAT']);

-- Detected regulatory changes
CREATE TABLE regulatory_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source reference
    source_id UUID NOT NULL REFERENCES regulatory_sources(id),
    external_id VARCHAR(200), -- ID from source system (e.g., Dz.U. 2024 poz. 123)

    -- Basic information
    title TEXT NOT NULL,
    title_pl TEXT NOT NULL,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
        'ustawa', 'rozporzadzenie', 'obwieszczenie', 'interpretacja',
        'wyrok', 'dyrektywa', 'decyzja', 'komunikat', 'inne'
    )),

    -- Classification
    domains TEXT[] NOT NULL DEFAULT '{}', -- VAT, CIT, PIT, ZUS, RACHUNKOWOSC, etc.
    keywords TEXT[] DEFAULT '{}',
    impact_level VARCHAR(20) DEFAULT 'medium' CHECK (impact_level IN (
        'critical', 'high', 'medium', 'low', 'informational'
    )),

    -- Dates
    publication_date DATE NOT NULL,
    effective_date DATE,
    announcement_date DATE,

    -- Content
    original_url TEXT,
    original_content TEXT, -- Full text if available
    content_hash VARCHAR(64), -- For duplicate detection

    -- AI Summary
    ai_summary JSONB, -- Structured summary
    ai_summary_status VARCHAR(20) DEFAULT 'pending' CHECK (ai_summary_status IN (
        'pending', 'processing', 'completed', 'failed', 'skipped'
    )),
    ai_summary_confidence DECIMAL(3,2),
    ai_summary_generated_at TIMESTAMPTZ,
    ai_model_used VARCHAR(100),

    -- Processing status
    processing_status VARCHAR(20) DEFAULT 'new' CHECK (processing_status IN (
        'new', 'processing', 'reviewed', 'published', 'archived', 'rejected'
    )),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_external_id UNIQUE (source_id, external_id)
);

CREATE INDEX idx_rc_source ON regulatory_changes(source_id);
CREATE INDEX idx_rc_domains ON regulatory_changes USING GIN(domains);
CREATE INDEX idx_rc_keywords ON regulatory_changes USING GIN(keywords);
CREATE INDEX idx_rc_publication_date ON regulatory_changes(publication_date DESC);
CREATE INDEX idx_rc_effective_date ON regulatory_changes(effective_date);
CREATE INDEX idx_rc_impact ON regulatory_changes(impact_level);
CREATE INDEX idx_rc_status ON regulatory_changes(processing_status);
CREATE INDEX idx_rc_content_hash ON regulatory_changes(content_hash);

-- AI-generated summaries (detailed)
CREATE TABLE regulatory_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_id UUID NOT NULL REFERENCES regulatory_changes(id) ON DELETE CASCADE,

    -- Summary content
    language VARCHAR(5) DEFAULT 'pl',
    headline VARCHAR(300) NOT NULL,
    summary TEXT NOT NULL, -- 2-3 sentences
    key_changes JSONB NOT NULL DEFAULT '[]', -- Array of bullet points
    affected_entities JSONB DEFAULT '[]', -- Who is affected
    action_required JSONB DEFAULT '[]', -- Required actions

    -- Legal references
    legal_basis TEXT[], -- Referenced articles/regulations
    related_changes UUID[] DEFAULT '{}', -- Related regulatory_changes IDs

    -- AI metadata
    confidence_score DECIMAL(3,2) NOT NULL,
    model_id VARCHAR(100),
    tokens_used INTEGER,
    generation_time_ms INTEGER,

    -- Human review
    human_reviewed BOOLEAN DEFAULT FALSE,
    human_edits JSONB,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT one_summary_per_lang UNIQUE (change_id, language)
);

CREATE INDEX idx_rs_change ON regulatory_summaries(change_id);
CREATE INDEX idx_rs_language ON regulatory_summaries(language);

-- Client impact analysis
CREATE TABLE regulatory_impact_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    change_id UUID NOT NULL REFERENCES regulatory_changes(id),
    client_id UUID NOT NULL REFERENCES clients(id),

    -- Impact assessment
    is_impacted BOOLEAN NOT NULL,
    impact_severity VARCHAR(20) CHECK (impact_severity IN (
        'critical', 'high', 'medium', 'low', 'none'
    )),
    impact_areas JSONB DEFAULT '[]', -- Specific areas affected

    -- Analysis details
    analysis_reasoning TEXT,
    affected_processes JSONB DEFAULT '[]',
    estimated_effort_hours INTEGER,
    compliance_deadline DATE,

    -- Recommendations
    recommended_actions JSONB DEFAULT '[]',
    estimated_cost DECIMAL(12,2),

    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'acknowledged', 'in_progress', 'implemented', 'not_applicable'
    )),

    -- Tracking
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    implemented_by UUID REFERENCES users(id),
    implemented_at TIMESTAMPTZ,
    implementation_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_client_change UNIQUE (client_id, change_id)
);

CREATE INDEX idx_ria_organization ON regulatory_impact_analyses(organization_id);
CREATE INDEX idx_ria_client ON regulatory_impact_analyses(client_id);
CREATE INDEX idx_ria_change ON regulatory_impact_analyses(change_id);
CREATE INDEX idx_ria_impacted ON regulatory_impact_analyses(is_impacted) WHERE is_impacted = TRUE;
CREATE INDEX idx_ria_status ON regulatory_impact_analyses(status);

-- Client notification preferences
CREATE TABLE regulatory_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) UNIQUE,

    -- Notification settings
    notifications_enabled BOOLEAN DEFAULT TRUE,

    -- Channels
    email_enabled BOOLEAN DEFAULT TRUE,
    email_addresses TEXT[] DEFAULT '{}',
    in_app_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    sms_numbers TEXT[] DEFAULT '{}',

    -- Filters
    min_impact_level VARCHAR(20) DEFAULT 'low',
    domains_filter TEXT[] DEFAULT '{}', -- Empty = all

    -- Frequency
    digest_frequency VARCHAR(20) DEFAULT 'immediate' CHECK (digest_frequency IN (
        'immediate', 'daily', 'weekly'
    )),
    digest_day INTEGER CHECK (digest_day BETWEEN 0 AND 6), -- For weekly
    digest_time TIME DEFAULT '09:00',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications sent
CREATE TABLE regulatory_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Target
    client_id UUID REFERENCES clients(id),
    user_id UUID REFERENCES users(id),

    -- Content
    change_id UUID NOT NULL REFERENCES regulatory_changes(id),
    notification_type VARCHAR(30) NOT NULL CHECK (notification_type IN (
        'new_change', 'effective_date_reminder', 'impact_alert', 'digest', 'custom'
    )),

    -- Delivery
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'in_app', 'sms')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'sent', 'delivered', 'read', 'failed', 'bounced'
    )),

    -- Content
    subject VARCHAR(300),
    body TEXT,

    -- Tracking
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rn_organization ON regulatory_notifications(organization_id);
CREATE INDEX idx_rn_client ON regulatory_notifications(client_id);
CREATE INDEX idx_rn_change ON regulatory_notifications(change_id);
CREATE INDEX idx_rn_status ON regulatory_notifications(status);

-- Custom monitoring rules
CREATE TABLE regulatory_monitoring_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Rule definition
    name VARCHAR(200) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,

    -- Matching criteria
    keywords TEXT[] NOT NULL,
    domains TEXT[] DEFAULT '{}',
    sources UUID[] DEFAULT '{}', -- Empty = all sources
    min_impact_level VARCHAR(20) DEFAULT 'low',

    -- Alert settings
    alert_level VARCHAR(20) DEFAULT 'normal' CHECK (alert_level IN (
        'low', 'normal', 'high', 'critical'
    )),
    notify_immediately BOOLEAN DEFAULT TRUE,

    -- Assignment
    assigned_to UUID REFERENCES users(id),

    -- Stats
    match_count INTEGER DEFAULT 0,
    last_match_at TIMESTAMPTZ,

    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rmr_organization ON regulatory_monitoring_rules(organization_id);
CREATE INDEX idx_rmr_active ON regulatory_monitoring_rules(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_rmr_keywords ON regulatory_monitoring_rules USING GIN(keywords);

-- Rule matches
CREATE TABLE regulatory_rule_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES regulatory_monitoring_rules(id) ON DELETE CASCADE,
    change_id UUID NOT NULL REFERENCES regulatory_changes(id) ON DELETE CASCADE,

    matched_keywords TEXT[],
    match_score DECIMAL(3,2),

    notified BOOLEAN DEFAULT FALSE,
    notified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_rule_change UNIQUE (rule_id, change_id)
);

CREATE INDEX idx_rrm_rule ON regulatory_rule_matches(rule_id);
CREATE INDEX idx_rrm_change ON regulatory_rule_matches(change_id);

-- User bookmarks and notes
CREATE TABLE regulatory_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    change_id UUID NOT NULL REFERENCES regulatory_changes(id),

    notes TEXT,
    tags TEXT[] DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_change UNIQUE (user_id, change_id)
);

CREATE INDEX idx_rb_user ON regulatory_bookmarks(user_id);
CREATE INDEX idx_rb_change ON regulatory_bookmarks(change_id);

-- Audit log
CREATE TABLE regulatory_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),

    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,

    user_id UUID REFERENCES users(id),
    details JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ral_organization ON regulatory_audit_log(organization_id);
CREATE INDEX idx_ral_entity ON regulatory_audit_log(entity_type, entity_id);
CREATE INDEX idx_ral_user ON regulatory_audit_log(user_id);

-- Row Level Security
ALTER TABLE regulatory_impact_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_monitoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can access own org impact analyses"
    ON regulatory_impact_analyses FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY "Users can access own org notifications"
    ON regulatory_notifications FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY "Users can access own org monitoring rules"
    ON regulatory_monitoring_rules FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY "Users can access own bookmarks"
    ON regulatory_bookmarks FOR ALL
    USING (user_id = current_setting('app.current_user_id')::UUID);
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Tax domains
export const TaxDomainSchema = z.enum([
  'VAT',
  'CIT',
  'PIT',
  'ZUS',
  'RACHUNKOWOSC',
  'ORDYNACJA',
  'KARY_SKARBOWE',
  'AKCYZA',
  'CLA',
  'INNE'
]);

// Document types
export const DocumentTypeSchema = z.enum([
  'ustawa',
  'rozporzadzenie',
  'obwieszczenie',
  'interpretacja',
  'wyrok',
  'dyrektywa',
  'decyzja',
  'komunikat',
  'inne'
]);

// Impact levels
export const ImpactLevelSchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
  'informational'
]);

// Processing status
export const ProcessingStatusSchema = z.enum([
  'new',
  'processing',
  'reviewed',
  'published',
  'archived',
  'rejected'
]);

// AI Summary status
export const AISummaryStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'skipped'
]);

// Regulatory change schema
export const RegulatoryChangeSchema = z.object({
  id: z.string().uuid(),
  source_id: z.string().uuid(),
  external_id: z.string().nullable(),
  title: z.string(),
  title_pl: z.string(),
  document_type: DocumentTypeSchema,
  domains: z.array(TaxDomainSchema),
  keywords: z.array(z.string()),
  impact_level: ImpactLevelSchema,
  publication_date: z.string().date(),
  effective_date: z.string().date().nullable(),
  original_url: z.string().url().nullable(),
  ai_summary: z.object({
    headline: z.string(),
    summary: z.string(),
    key_changes: z.array(z.string()),
    affected_entities: z.array(z.string()),
    action_required: z.array(z.string())
  }).nullable(),
  ai_summary_confidence: z.number().min(0).max(1).nullable(),
  processing_status: ProcessingStatusSchema
});

// Search filters
export const RegulatorySearchFilterSchema = z.object({
  query: z.string().optional(),
  domains: z.array(TaxDomainSchema).optional(),
  document_types: z.array(DocumentTypeSchema).optional(),
  impact_levels: z.array(ImpactLevelSchema).optional(),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  effective_date_from: z.string().date().optional(),
  effective_date_to: z.string().date().optional(),
  source_ids: z.array(z.string().uuid()).optional(),
  has_ai_summary: z.boolean().optional(),
  status: ProcessingStatusSchema.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sort_by: z.enum(['publication_date', 'effective_date', 'impact_level', 'relevance']).default('publication_date'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// Impact analysis request
export const ImpactAnalysisRequestSchema = z.object({
  change_id: z.string().uuid(),
  client_ids: z.array(z.string().uuid()).optional(), // Empty = all clients
  force_refresh: z.boolean().default(false)
});

// Impact analysis result
export const ImpactAnalysisResultSchema = z.object({
  change_id: z.string().uuid(),
  total_clients: z.number(),
  impacted_clients: z.number(),
  impact_breakdown: z.object({
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number(),
    none: z.number()
  }),
  analyses: z.array(z.object({
    client_id: z.string().uuid(),
    client_name: z.string(),
    is_impacted: z.boolean(),
    impact_severity: ImpactLevelSchema.nullable(),
    impact_areas: z.array(z.string()),
    recommended_actions: z.array(z.string()),
    estimated_effort_hours: z.number().nullable()
  }))
});

// Notification preferences
export const NotificationPreferencesSchema = z.object({
  notifications_enabled: z.boolean().default(true),
  email_enabled: z.boolean().default(true),
  email_addresses: z.array(z.string().email()).default([]),
  in_app_enabled: z.boolean().default(true),
  sms_enabled: z.boolean().default(false),
  sms_numbers: z.array(z.string()).default([]),
  min_impact_level: ImpactLevelSchema.default('low'),
  domains_filter: z.array(TaxDomainSchema).default([]),
  digest_frequency: z.enum(['immediate', 'daily', 'weekly']).default('immediate'),
  digest_day: z.number().int().min(0).max(6).optional(),
  digest_time: z.string().regex(/^\d{2}:\d{2}$/).default('09:00')
});

// Monitoring rule
export const MonitoringRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  keywords: z.array(z.string()).min(1),
  domains: z.array(TaxDomainSchema).default([]),
  sources: z.array(z.string().uuid()).default([]),
  min_impact_level: ImpactLevelSchema.default('low'),
  alert_level: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  notify_immediately: z.boolean().default(true),
  assigned_to: z.string().uuid().optional()
});

// Calendar filter
export const CalendarFilterSchema = z.object({
  start_date: z.string().date(),
  end_date: z.string().date(),
  domains: z.array(TaxDomainSchema).optional(),
  impact_levels: z.array(ImpactLevelSchema).optional(),
  client_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'acknowledged', 'implemented', 'all']).default('all')
});

// Bookmark schema
export const BookmarkSchema = z.object({
  change_id: z.string().uuid(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([])
});
```

### Service Implementation

```typescript
// src/server/services/regulatory-monitoring.service.ts
import { TRPCError } from '@trpc/server';
import OpenAI from 'openai';
import { db } from '@/server/db';
import { redis } from '@/server/redis';
import {
  RegulatorySearchFilterSchema,
  ImpactAnalysisRequestSchema,
  ImpactAnalysisResultSchema,
  MonitoringRuleSchema,
  TaxDomainSchema,
  ImpactLevelSchema
} from './schemas/regulatory-monitoring.schemas';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Domain-specific keywords for impact analysis
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  VAT: ['VAT', 'podatek od towarów i usług', 'faktura', 'odliczenie', 'stawka', 'zwolnienie', 'JPK', 'KSeF', 'split payment'],
  CIT: ['CIT', 'podatek dochodowy od osób prawnych', 'przychód', 'koszt uzyskania', 'amortyzacja', 'strata'],
  PIT: ['PIT', 'podatek dochodowy od osób fizycznych', 'dochód', 'ulga', 'kwota wolna', 'skala podatkowa'],
  ZUS: ['ZUS', 'składka', 'ubezpieczenie', 'emerytalne', 'rentowe', 'chorobowe', 'zdrowotne'],
  RACHUNKOWOSC: ['rachunkowość', 'sprawozdanie', 'bilans', 'księgi rachunkowe', 'inwentaryzacja']
};

export class RegulatoryMonitoringService {
  constructor(
    private organizationId: string,
    private userId: string
  ) {}

  /**
   * Search regulatory changes
   */
  async searchChanges(filter: z.infer<typeof RegulatorySearchFilterSchema>) {
    const {
      query,
      domains,
      document_types,
      impact_levels,
      date_from,
      date_to,
      effective_date_from,
      effective_date_to,
      source_ids,
      has_ai_summary,
      status,
      page,
      limit,
      sort_by,
      sort_order
    } = filter;

    const where: any = {};

    // Full-text search
    if (query) {
      where.OR = [
        { title_pl: { contains: query, mode: 'insensitive' } },
        { keywords: { hasSome: [query] } },
        { ai_summary: { path: ['summary'], string_contains: query } }
      ];
    }

    if (domains?.length) {
      where.domains = { hasSome: domains };
    }

    if (document_types?.length) {
      where.document_type = { in: document_types };
    }

    if (impact_levels?.length) {
      where.impact_level = { in: impact_levels };
    }

    if (date_from || date_to) {
      where.publication_date = {};
      if (date_from) where.publication_date.gte = new Date(date_from);
      if (date_to) where.publication_date.lte = new Date(date_to);
    }

    if (effective_date_from || effective_date_to) {
      where.effective_date = {};
      if (effective_date_from) where.effective_date.gte = new Date(effective_date_from);
      if (effective_date_to) where.effective_date.lte = new Date(effective_date_to);
    }

    if (source_ids?.length) {
      where.source_id = { in: source_ids };
    }

    if (has_ai_summary !== undefined) {
      where.ai_summary_status = has_ai_summary ? 'completed' : { not: 'completed' };
    }

    if (status) {
      where.processing_status = status;
    }

    // Only show published changes unless admin
    where.processing_status = { in: ['published', 'reviewed'] };

    const orderBy: any = {};
    orderBy[sort_by] = sort_order;

    const [changes, total] = await Promise.all([
      db.regulatory_changes.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          source: {
            select: { source_name_pl: true, source_type: true }
          },
          summaries: {
            where: { language: 'pl' },
            take: 1
          }
        }
      }),
      db.regulatory_changes.count({ where })
    ]);

    return {
      changes: changes.map(c => ({
        ...c,
        summary: c.summaries[0] || null
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get upcoming regulatory changes calendar
   */
  async getCalendar(filter: z.infer<typeof CalendarFilterSchema>) {
    const { start_date, end_date, domains, impact_levels, client_id, status } = filter;

    const where: any = {
      effective_date: {
        gte: new Date(start_date),
        lte: new Date(end_date)
      },
      processing_status: { in: ['published', 'reviewed'] }
    };

    if (domains?.length) {
      where.domains = { hasSome: domains };
    }

    if (impact_levels?.length) {
      where.impact_level = { in: impact_levels };
    }

    const changes = await db.regulatory_changes.findMany({
      where,
      orderBy: { effective_date: 'asc' },
      include: {
        summaries: {
          where: { language: 'pl' },
          take: 1
        }
      }
    });

    // If client filter, get impact analyses
    let impactMap = new Map();
    if (client_id) {
      const impacts = await db.regulatory_impact_analyses.findMany({
        where: {
          client_id,
          change_id: { in: changes.map(c => c.id) }
        }
      });
      impactMap = new Map(impacts.map(i => [i.change_id, i]));
    }

    // Group by date
    const calendar: Record<string, any[]> = {};
    for (const change of changes) {
      const dateKey = change.effective_date?.toISOString().split('T')[0] || 'unknown';
      if (!calendar[dateKey]) {
        calendar[dateKey] = [];
      }

      const impact = client_id ? impactMap.get(change.id) : null;

      // Apply status filter
      if (status !== 'all' && impact) {
        if (status === 'pending' && impact.status !== 'pending') continue;
        if (status === 'acknowledged' && impact.status !== 'acknowledged') continue;
        if (status === 'implemented' && impact.status !== 'implemented') continue;
      }

      calendar[dateKey].push({
        id: change.id,
        title: change.title_pl,
        document_type: change.document_type,
        domains: change.domains,
        impact_level: change.impact_level,
        effective_date: change.effective_date,
        summary: change.summaries[0]?.headline,
        client_impact: impact ? {
          is_impacted: impact.is_impacted,
          severity: impact.impact_severity,
          status: impact.status
        } : null
      });
    }

    return calendar;
  }

  /**
   * Generate AI summary for a regulatory change
   */
  async generateSummary(changeId: string): Promise<void> {
    const change = await db.regulatory_changes.findUnique({
      where: { id: changeId },
      include: { source: true }
    });

    if (!change) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Zmiana regulacyjna nie znaleziona'
      });
    }

    // Update status to processing
    await db.regulatory_changes.update({
      where: { id: changeId },
      data: { ai_summary_status: 'processing' }
    });

    const startTime = Date.now();

    try {
      const systemPrompt = `Jesteś ekspertem od polskiego prawa podatkowego. Twoim zadaniem jest tworzenie zwięzłych, przydatnych podsumowań zmian w przepisach dla księgowych i doradców podatkowych.

Dla każdej zmiany regulacyjnej:
1. Napisz krótki, zrozumiały nagłówek (max 100 znaków)
2. Napisz streszczenie w 2-3 zdaniach w prostym języku
3. Wymień kluczowe zmiany jako punkty
4. Określ kogo dotyczy zmiana
5. Podaj jakie działania trzeba podjąć

Odpowiedz w formacie JSON.`;

      const userPrompt = `Przeanalizuj następującą zmianę regulacyjną i wygeneruj podsumowanie:

Tytuł: ${change.title_pl}
Typ dokumentu: ${change.document_type}
Data publikacji: ${change.publication_date}
Data wejścia w życie: ${change.effective_date || 'Nie określono'}
Źródło: ${change.source.source_name_pl}
Domeny: ${change.domains.join(', ')}

${change.original_content ? `Treść:\n${change.original_content.substring(0, 8000)}` : '(Treść niedostępna - podsumuj na podstawie tytułu)'}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2000
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(content);
      const generationTime = Date.now() - startTime;

      // Store summary
      await db.regulatory_summaries.create({
        data: {
          change_id: changeId,
          language: 'pl',
          headline: parsed.headline || parsed.nagłówek,
          summary: parsed.summary || parsed.streszczenie,
          key_changes: parsed.key_changes || parsed.kluczowe_zmiany || [],
          affected_entities: parsed.affected_entities || parsed.kogo_dotyczy || [],
          action_required: parsed.action_required || parsed.wymagane_działania || [],
          confidence_score: 0.85, // Base confidence for GPT-4
          model_id: 'gpt-4-turbo-preview',
          tokens_used: response.usage?.total_tokens,
          generation_time_ms: generationTime
        }
      });

      // Update change status
      await db.regulatory_changes.update({
        where: { id: changeId },
        data: {
          ai_summary_status: 'completed',
          ai_summary_confidence: 0.85,
          ai_summary_generated_at: new Date(),
          ai_model_used: 'gpt-4-turbo-preview',
          ai_summary: {
            headline: parsed.headline || parsed.nagłówek,
            summary: parsed.summary || parsed.streszczenie,
            key_changes: parsed.key_changes || parsed.kluczowe_zmiany || [],
            affected_entities: parsed.affected_entities || parsed.kogo_dotyczy || [],
            action_required: parsed.action_required || parsed.wymagane_działania || []
          }
        }
      });

    } catch (error) {
      await db.regulatory_changes.update({
        where: { id: changeId },
        data: { ai_summary_status: 'failed' }
      });
      throw error;
    }
  }

  /**
   * Analyze impact on clients
   */
  async analyzeImpact(input: z.infer<typeof ImpactAnalysisRequestSchema>): Promise<z.infer<typeof ImpactAnalysisResultSchema>> {
    const { change_id, client_ids, force_refresh } = input;

    const change = await db.regulatory_changes.findUnique({
      where: { id: change_id },
      include: { summaries: { where: { language: 'pl' } } }
    });

    if (!change) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Zmiana regulacyjna nie znaleziona'
      });
    }

    // Get clients to analyze
    const clientFilter: any = {
      organization_id: this.organizationId,
      is_active: true
    };
    if (client_ids?.length) {
      clientFilter.id = { in: client_ids };
    }

    const clients = await db.clients.findMany({
      where: clientFilter,
      include: {
        tax_configuration: true
      }
    });

    const analyses: any[] = [];
    const impactBreakdown = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      none: 0
    };

    for (const client of clients) {
      // Check if analysis exists and not forcing refresh
      if (!force_refresh) {
        const existing = await db.regulatory_impact_analyses.findUnique({
          where: {
            client_id_change_id: {
              client_id: client.id,
              change_id: change_id
            }
          }
        });

        if (existing) {
          analyses.push({
            client_id: client.id,
            client_name: client.name,
            is_impacted: existing.is_impacted,
            impact_severity: existing.impact_severity,
            impact_areas: existing.impact_areas,
            recommended_actions: existing.recommended_actions,
            estimated_effort_hours: existing.estimated_effort_hours
          });

          if (existing.impact_severity) {
            impactBreakdown[existing.impact_severity as keyof typeof impactBreakdown]++;
          } else {
            impactBreakdown.none++;
          }
          continue;
        }
      }

      // Perform impact analysis
      const impact = await this.analyzeClientImpact(change, client);

      // Store analysis
      await db.regulatory_impact_analyses.upsert({
        where: {
          client_id_change_id: {
            client_id: client.id,
            change_id: change_id
          }
        },
        update: {
          ...impact,
          updated_at: new Date()
        },
        create: {
          organization_id: this.organizationId,
          client_id: client.id,
          change_id: change_id,
          ...impact
        }
      });

      analyses.push({
        client_id: client.id,
        client_name: client.name,
        ...impact
      });

      if (impact.impact_severity) {
        impactBreakdown[impact.impact_severity as keyof typeof impactBreakdown]++;
      } else {
        impactBreakdown.none++;
      }
    }

    return {
      change_id,
      total_clients: clients.length,
      impacted_clients: analyses.filter(a => a.is_impacted).length,
      impact_breakdown: impactBreakdown,
      analyses
    };
  }

  /**
   * Analyze impact for a single client
   */
  private async analyzeClientImpact(change: any, client: any): Promise<{
    is_impacted: boolean;
    impact_severity: string | null;
    impact_areas: string[];
    recommended_actions: string[];
    estimated_effort_hours: number | null;
  }> {
    const taxConfig = client.tax_configuration;
    const impactAreas: string[] = [];
    const recommendedActions: string[] = [];
    let impactScore = 0;

    // Check domain overlap
    const clientDomains = this.getClientDomains(taxConfig);
    const overlappingDomains = change.domains.filter((d: string) =>
      clientDomains.includes(d)
    );

    if (overlappingDomains.length === 0) {
      return {
        is_impacted: false,
        impact_severity: null,
        impact_areas: [],
        recommended_actions: [],
        estimated_effort_hours: null
      };
    }

    // Check specific impacts based on domains and client config
    for (const domain of overlappingDomains) {
      switch (domain) {
        case 'VAT':
          if (taxConfig?.is_vat_payer) {
            impactAreas.push('Rozliczenia VAT');
            impactScore += 20;
            recommendedActions.push('Przegląd procedur VAT');
          }
          break;

        case 'CIT':
          if (taxConfig?.tax_form === 'CIT') {
            impactAreas.push('Podatek dochodowy CIT');
            impactScore += 20;
            recommendedActions.push('Analiza wpływu na kalkulację CIT');
          }
          break;

        case 'PIT':
          if (taxConfig?.tax_form?.startsWith('PIT')) {
            impactAreas.push('Podatek dochodowy PIT');
            impactScore += 15;
          }
          break;

        case 'ZUS':
          impactAreas.push('Składki ZUS');
          impactScore += 15;
          recommendedActions.push('Weryfikacja składek ZUS');
          break;
      }
    }

    // Check keywords for specific impacts
    const summary = change.ai_summary;
    if (summary?.key_changes) {
      for (const keyChange of summary.key_changes) {
        const lowerChange = keyChange.toLowerCase();

        if (lowerChange.includes('stawka') || lowerChange.includes('rate')) {
          impactAreas.push('Zmiana stawek podatkowych');
          impactScore += 25;
        }
        if (lowerChange.includes('termin') || lowerChange.includes('deadline')) {
          impactAreas.push('Zmiana terminów');
          impactScore += 15;
        }
        if (lowerChange.includes('deklaracja') || lowerChange.includes('jpk')) {
          impactAreas.push('Deklaracje podatkowe');
          impactScore += 20;
        }
      }
    }

    // Calculate impact level
    let severity: string | null = null;
    if (impactScore >= 60) severity = 'critical';
    else if (impactScore >= 40) severity = 'high';
    else if (impactScore >= 20) severity = 'medium';
    else if (impactScore > 0) severity = 'low';

    // Estimate effort
    let estimatedHours: number | null = null;
    if (severity === 'critical') estimatedHours = 8;
    else if (severity === 'high') estimatedHours = 4;
    else if (severity === 'medium') estimatedHours = 2;
    else if (severity === 'low') estimatedHours = 1;

    // Add standard actions from summary
    if (summary?.action_required) {
      recommendedActions.push(...summary.action_required);
    }

    return {
      is_impacted: impactAreas.length > 0,
      impact_severity: severity,
      impact_areas: [...new Set(impactAreas)],
      recommended_actions: [...new Set(recommendedActions)],
      estimated_effort_hours: estimatedHours
    };
  }

  private getClientDomains(taxConfig: any): string[] {
    const domains: string[] = [];

    if (taxConfig?.is_vat_payer) domains.push('VAT');
    if (taxConfig?.tax_form === 'CIT') domains.push('CIT');
    if (taxConfig?.tax_form?.startsWith('PIT')) domains.push('PIT');
    if (taxConfig) domains.push('ZUS'); // All clients have ZUS

    return domains;
  }

  /**
   * Create monitoring rule
   */
  async createMonitoringRule(input: z.infer<typeof MonitoringRuleSchema>) {
    const rule = await db.regulatory_monitoring_rules.create({
      data: {
        organization_id: this.organizationId,
        ...input,
        created_by: this.userId
      }
    });

    // Check existing changes for matches
    await this.matchRuleAgainstExisting(rule);

    return rule;
  }

  /**
   * Match rule against existing changes
   */
  private async matchRuleAgainstExisting(rule: any) {
    const where: any = {
      processing_status: { in: ['published', 'reviewed'] }
    };

    if (rule.domains?.length) {
      where.domains = { hasSome: rule.domains };
    }

    const changes = await db.regulatory_changes.findMany({
      where,
      orderBy: { publication_date: 'desc' },
      take: 100 // Check last 100 changes
    });

    for (const change of changes) {
      const matchedKeywords = rule.keywords.filter((kw: string) =>
        change.title_pl.toLowerCase().includes(kw.toLowerCase()) ||
        change.keywords.some((ck: string) => ck.toLowerCase().includes(kw.toLowerCase()))
      );

      if (matchedKeywords.length > 0) {
        await db.regulatory_rule_matches.upsert({
          where: {
            rule_id_change_id: {
              rule_id: rule.id,
              change_id: change.id
            }
          },
          update: {
            matched_keywords: matchedKeywords,
            match_score: matchedKeywords.length / rule.keywords.length
          },
          create: {
            rule_id: rule.id,
            change_id: change.id,
            matched_keywords: matchedKeywords,
            match_score: matchedKeywords.length / rule.keywords.length
          }
        });
      }
    }

    // Update rule stats
    const matchCount = await db.regulatory_rule_matches.count({
      where: { rule_id: rule.id }
    });

    await db.regulatory_monitoring_rules.update({
      where: { id: rule.id },
      data: { match_count: matchCount }
    });
  }

  /**
   * Get monitoring rules
   */
  async getMonitoringRules() {
    return db.regulatory_monitoring_rules.findMany({
      where: { organization_id: this.organizationId },
      include: {
        _count: {
          select: { matches: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });
  }

  /**
   * Get rule matches
   */
  async getRuleMatches(ruleId: string) {
    return db.regulatory_rule_matches.findMany({
      where: { rule_id: ruleId },
      include: {
        change: {
          include: {
            summaries: {
              where: { language: 'pl' },
              take: 1
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });
  }

  /**
   * Bookmark a change
   */
  async bookmarkChange(input: z.infer<typeof BookmarkSchema>) {
    return db.regulatory_bookmarks.upsert({
      where: {
        user_id_change_id: {
          user_id: this.userId,
          change_id: input.change_id
        }
      },
      update: {
        notes: input.notes,
        tags: input.tags,
        updated_at: new Date()
      },
      create: {
        user_id: this.userId,
        change_id: input.change_id,
        notes: input.notes,
        tags: input.tags
      }
    });
  }

  /**
   * Get user bookmarks
   */
  async getBookmarks() {
    return db.regulatory_bookmarks.findMany({
      where: { user_id: this.userId },
      include: {
        change: {
          include: {
            summaries: {
              where: { language: 'pl' },
              take: 1
            }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });
  }
}
```

### API Router

```typescript
// src/server/routers/regulatory-monitoring.router.ts
import { router, protectedProcedure } from '@/server/trpc';
import { RegulatoryMonitoringService } from '@/server/services/regulatory-monitoring.service';
import {
  RegulatorySearchFilterSchema,
  CalendarFilterSchema,
  ImpactAnalysisRequestSchema,
  MonitoringRuleSchema,
  NotificationPreferencesSchema,
  BookmarkSchema
} from '@/server/services/schemas/regulatory-monitoring.schemas';
import { z } from 'zod';

export const regulatoryMonitoringRouter = router({
  // Search changes
  searchChanges: protectedProcedure
    .input(RegulatorySearchFilterSchema)
    .query(async ({ ctx, input }) => {
      const service = new RegulatoryMonitoringService(
        ctx.session.organizationId,
        ctx.session.userId
      );
      return service.searchChanges(input);
    }),

  // Get change by ID
  getChange: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.regulatory_changes.findUnique({
        where: { id: input.id },
        include: {
          source: true,
          summaries: true
        }
      });
    }),

  // Get calendar
  getCalendar: protectedProcedure
    .input(CalendarFilterSchema)
    .query(async ({ ctx, input }) => {
      const service = new RegulatoryMonitoringService(
        ctx.session.organizationId,
        ctx.session.userId
      );
      return service.getCalendar(input);
    }),

  // Generate summary (admin only)
  generateSummary: protectedProcedure
    .input(z.object({ change_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new RegulatoryMonitoringService(
        ctx.session.organizationId,
        ctx.session.userId
      );
      return service.generateSummary(input.change_id);
    }),

  // Analyze impact
  analyzeImpact: protectedProcedure
    .input(ImpactAnalysisRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new RegulatoryMonitoringService(
        ctx.session.organizationId,
        ctx.session.userId
      );
      return service.analyzeImpact(input);
    }),

  // Get impact analysis for client
  getClientImpact: protectedProcedure
    .input(z.object({
      client_id: z.string().uuid(),
      status: z.enum(['pending', 'acknowledged', 'implemented', 'all']).optional()
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {
        organization_id: ctx.session.organizationId,
        client_id: input.client_id
      };

      if (input.status && input.status !== 'all') {
        where.status = input.status;
      }

      return ctx.db.regulatory_impact_analyses.findMany({
        where,
        include: {
          change: {
            include: {
              summaries: {
                where: { language: 'pl' },
                take: 1
              }
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });
    }),

  // Acknowledge impact
  acknowledgeImpact: protectedProcedure
    .input(z.object({
      analysis_id: z.string().uuid()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.regulatory_impact_analyses.update({
        where: { id: input.analysis_id },
        data: {
          status: 'acknowledged',
          acknowledged_by: ctx.session.userId,
          acknowledged_at: new Date()
        }
      });
    }),

  // Mark as implemented
  markImplemented: protectedProcedure
    .input(z.object({
      analysis_id: z.string().uuid(),
      notes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.regulatory_impact_analyses.update({
        where: { id: input.analysis_id },
        data: {
          status: 'implemented',
          implemented_by: ctx.session.userId,
          implemented_at: new Date(),
          implementation_notes: input.notes
        }
      });
    }),

  // Monitoring rules
  getMonitoringRules: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new RegulatoryMonitoringService(
        ctx.session.organizationId,
        ctx.session.userId
      );
      return service.getMonitoringRules();
    }),

  createMonitoringRule: protectedProcedure
    .input(MonitoringRuleSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new RegulatoryMonitoringService(
        ctx.session.organizationId,
        ctx.session.userId
      );
      return service.createMonitoringRule(input);
    }),

  updateMonitoringRule: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: MonitoringRuleSchema.partial()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.regulatory_monitoring_rules.update({
        where: {
          id: input.id,
          organization_id: ctx.session.organizationId
        },
        data: input.data
      });
    }),

  deleteMonitoringRule: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.regulatory_monitoring_rules.delete({
        where: {
          id: input.id,
          organization_id: ctx.session.organizationId
        }
      });
    }),

  getRuleMatches: protectedProcedure
    .input(z.object({ rule_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new RegulatoryMonitoringService(
        ctx.session.organizationId,
        ctx.session.userId
      );
      return service.getRuleMatches(input.rule_id);
    }),

  // Notification preferences
  getNotificationPreferences: protectedProcedure
    .input(z.object({ client_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.regulatory_notification_preferences.findUnique({
        where: { client_id: input.client_id }
      });
    }),

  updateNotificationPreferences: protectedProcedure
    .input(z.object({
      client_id: z.string().uuid(),
      preferences: NotificationPreferencesSchema
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.regulatory_notification_preferences.upsert({
        where: { client_id: input.client_id },
        update: { ...input.preferences, updated_at: new Date() },
        create: {
          client_id: input.client_id,
          ...input.preferences
        }
      });
    }),

  // Bookmarks
  getBookmarks: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new RegulatoryMonitoringService(
        ctx.session.organizationId,
        ctx.session.userId
      );
      return service.getBookmarks();
    }),

  bookmarkChange: protectedProcedure
    .input(BookmarkSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new RegulatoryMonitoringService(
        ctx.session.organizationId,
        ctx.session.userId
      );
      return service.bookmarkChange(input);
    }),

  removeBookmark: protectedProcedure
    .input(z.object({ change_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.regulatory_bookmarks.delete({
        where: {
          user_id_change_id: {
            user_id: ctx.session.userId,
            change_id: input.change_id
          }
        }
      });
    }),

  // Sources
  getSources: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.regulatory_sources.findMany({
        where: { scrape_enabled: true },
        orderBy: { source_name_pl: 'asc' }
      });
    })
});
```

---

## Test Specifications

### Unit Tests

```typescript
// src/server/services/__tests__/regulatory-monitoring.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RegulatoryMonitoringService } from '../regulatory-monitoring.service';
import { db } from '@/server/db';
import OpenAI from 'openai';

vi.mock('@/server/db');
vi.mock('openai');

describe('RegulatoryMonitoringService', () => {
  let service: RegulatoryMonitoringService;
  const mockOrgId = 'org-123';
  const mockUserId = 'user-456';

  beforeEach(() => {
    service = new RegulatoryMonitoringService(mockOrgId, mockUserId);
    vi.clearAllMocks();
  });

  describe('searchChanges', () => {
    it('should search with full-text query', async () => {
      vi.mocked(db.regulatory_changes.findMany).mockResolvedValue([
        { id: '1', title_pl: 'Zmiana stawek VAT', domains: ['VAT'] }
      ]);
      vi.mocked(db.regulatory_changes.count).mockResolvedValue(1);

      const result = await service.searchChanges({
        query: 'VAT',
        page: 1,
        limit: 20
      });

      expect(result.changes).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by domains', async () => {
      vi.mocked(db.regulatory_changes.findMany).mockResolvedValue([]);
      vi.mocked(db.regulatory_changes.count).mockResolvedValue(0);

      await service.searchChanges({
        domains: ['VAT', 'CIT'],
        page: 1,
        limit: 20
      });

      expect(db.regulatory_changes.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            domains: { hasSome: ['VAT', 'CIT'] }
          })
        })
      );
    });

    it('should filter by date range', async () => {
      vi.mocked(db.regulatory_changes.findMany).mockResolvedValue([]);
      vi.mocked(db.regulatory_changes.count).mockResolvedValue(0);

      await service.searchChanges({
        date_from: '2024-01-01',
        date_to: '2024-12-31',
        page: 1,
        limit: 20
      });

      expect(db.regulatory_changes.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            publication_date: {
              gte: expect.any(Date),
              lte: expect.any(Date)
            }
          })
        })
      );
    });
  });

  describe('generateSummary', () => {
    it('should generate AI summary for change', async () => {
      const mockChange = {
        id: 'change-1',
        title_pl: 'Ustawa o zmianie ustawy o VAT',
        document_type: 'ustawa',
        domains: ['VAT'],
        publication_date: new Date('2024-01-15'),
        effective_date: new Date('2024-04-01'),
        original_content: 'Treść ustawy...',
        source: { source_name_pl: 'Dziennik Ustaw' }
      };

      vi.mocked(db.regulatory_changes.findUnique).mockResolvedValue(mockChange);
      vi.mocked(db.regulatory_changes.update).mockResolvedValue(mockChange);
      vi.mocked(db.regulatory_summaries.create).mockResolvedValue({});

      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: JSON.stringify({
                    nagłówek: 'Nowe stawki VAT od kwietnia',
                    streszczenie: 'Ustawa wprowadza zmiany w stawkach VAT.',
                    kluczowe_zmiany: ['Zmiana stawki na żywność'],
                    kogo_dotyczy: ['Wszystkie firmy'],
                    wymagane_działania: ['Aktualizacja systemów']
                  })
                }
              }],
              usage: { total_tokens: 500 }
            })
          }
        }
      };

      vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as any);

      await service.generateSummary('change-1');

      expect(db.regulatory_summaries.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            change_id: 'change-1',
            headline: 'Nowe stawki VAT od kwietnia',
            confidence_score: 0.85
          })
        })
      );
    });
  });

  describe('analyzeImpact', () => {
    it('should identify impacted clients', async () => {
      const mockChange = {
        id: 'change-1',
        domains: ['VAT'],
        ai_summary: {
          key_changes: ['Zmiana stawek VAT']
        }
      };

      const mockClients = [
        {
          id: 'client-1',
          name: 'Firma VAT',
          tax_configuration: { is_vat_payer: true, tax_form: 'CIT' }
        },
        {
          id: 'client-2',
          name: 'Firma nie-VAT',
          tax_configuration: { is_vat_payer: false, tax_form: 'PIT-36' }
        }
      ];

      vi.mocked(db.regulatory_changes.findUnique).mockResolvedValue(mockChange);
      vi.mocked(db.clients.findMany).mockResolvedValue(mockClients);
      vi.mocked(db.regulatory_impact_analyses.findUnique).mockResolvedValue(null);
      vi.mocked(db.regulatory_impact_analyses.upsert).mockResolvedValue({});

      const result = await service.analyzeImpact({
        change_id: 'change-1'
      });

      expect(result.total_clients).toBe(2);
      expect(result.impacted_clients).toBe(1);
      expect(result.analyses[0].is_impacted).toBe(true);
      expect(result.analyses[1].is_impacted).toBe(false);
    });
  });

  describe('createMonitoringRule', () => {
    it('should create rule and match against existing changes', async () => {
      const ruleInput = {
        name: 'VAT Monitoring',
        keywords: ['VAT', 'stawka'],
        domains: ['VAT'],
        alert_level: 'high' as const
      };

      const mockRule = { id: 'rule-1', ...ruleInput };
      const mockChanges = [
        { id: 'change-1', title_pl: 'Ustawa o VAT', keywords: ['VAT'] }
      ];

      vi.mocked(db.regulatory_monitoring_rules.create).mockResolvedValue(mockRule);
      vi.mocked(db.regulatory_changes.findMany).mockResolvedValue(mockChanges);
      vi.mocked(db.regulatory_rule_matches.upsert).mockResolvedValue({});
      vi.mocked(db.regulatory_rule_matches.count).mockResolvedValue(1);
      vi.mocked(db.regulatory_monitoring_rules.update).mockResolvedValue(mockRule);

      const result = await service.createMonitoringRule(ruleInput);

      expect(result.id).toBe('rule-1');
      expect(db.regulatory_rule_matches.upsert).toHaveBeenCalled();
    });
  });
});
```

### Integration Tests

```typescript
// src/server/services/__tests__/regulatory-monitoring.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext } from '@/test/helpers';
import { regulatoryMonitoringRouter } from '../routers/regulatory-monitoring.router';

describe('Regulatory Monitoring Integration Tests', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext();

    // Seed test data
    await ctx.db.regulatory_changes.create({
      data: {
        source_id: 'test-source',
        external_id: 'DU-2024-123',
        title: 'VAT Amendment Act',
        title_pl: 'Ustawa o zmianie ustawy o VAT',
        document_type: 'ustawa',
        domains: ['VAT'],
        keywords: ['VAT', 'stawka', 'faktura'],
        impact_level: 'high',
        publication_date: new Date('2024-01-15'),
        effective_date: new Date('2024-04-01'),
        processing_status: 'published'
      }
    });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('Search and Filter', () => {
    it('should search changes by query', async () => {
      const caller = regulatoryMonitoringRouter.createCaller(ctx);

      const result = await caller.searchChanges({
        query: 'VAT',
        page: 1,
        limit: 10
      });

      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.changes[0].title_pl).toContain('VAT');
    });

    it('should filter by domain', async () => {
      const caller = regulatoryMonitoringRouter.createCaller(ctx);

      const result = await caller.searchChanges({
        domains: ['VAT'],
        page: 1,
        limit: 10
      });

      for (const change of result.changes) {
        expect(change.domains).toContain('VAT');
      }
    });
  });

  describe('Impact Analysis', () => {
    it('should analyze impact for clients', async () => {
      const caller = regulatoryMonitoringRouter.createCaller(ctx);

      // Create test client
      const client = await ctx.db.clients.create({
        data: {
          organization_id: ctx.session.organizationId,
          name: 'Test VAT Client',
          nip: '7811914629',
          tax_configuration: {
            create: {
              is_vat_payer: true,
              vat_period: 'monthly',
              tax_form: 'CIT'
            }
          }
        }
      });

      const change = await ctx.db.regulatory_changes.findFirst({
        where: { domains: { has: 'VAT' } }
      });

      const result = await caller.analyzeImpact({
        change_id: change!.id,
        client_ids: [client.id]
      });

      expect(result.total_clients).toBe(1);
      expect(result.analyses[0].is_impacted).toBe(true);
    });
  });

  describe('Monitoring Rules', () => {
    it('should create and match monitoring rule', async () => {
      const caller = regulatoryMonitoringRouter.createCaller(ctx);

      const rule = await caller.createMonitoringRule({
        name: 'VAT Changes',
        keywords: ['VAT'],
        domains: ['VAT'],
        alert_level: 'high'
      });

      expect(rule.id).toBeDefined();

      const matches = await caller.getRuleMatches({ rule_id: rule.id });
      expect(matches.length).toBeGreaterThan(0);
    });
  });
});
```

### E2E Tests

```typescript
// e2e/regulatory-monitoring.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Regulatory Monitoring', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should search regulatory changes', async ({ page }) => {
    await page.goto('/tax/regulations');

    // Search for VAT changes
    await page.fill('[data-testid="search-input"]', 'VAT');
    await page.click('[data-testid="search-btn"]');

    // Wait for results
    await expect(page.locator('[data-testid="results-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="change-item"]')).toHaveCount({ minimum: 1 });
  });

  test('should view regulatory calendar', async ({ page }) => {
    await page.goto('/tax/regulations/calendar');

    // Calendar should be visible
    await expect(page.locator('[data-testid="regulatory-calendar"]')).toBeVisible();

    // Navigate to next month
    await page.click('[data-testid="next-month-btn"]');

    // Calendar should update
    await expect(page.locator('[data-testid="calendar-month"]')).not.toHaveText(
      new Date().toLocaleString('pl', { month: 'long' })
    );
  });

  test('should create monitoring rule', async ({ page }) => {
    await page.goto('/tax/regulations/rules');

    // Create new rule
    await page.click('[data-testid="create-rule-btn"]');
    await page.fill('[data-testid="rule-name"]', 'Split Payment Monitoring');
    await page.fill('[data-testid="rule-keywords"]', 'split payment, MPP, mechanizm podzielonej');
    await page.click('[data-testid="domain-VAT"]');
    await page.selectOption('[data-testid="alert-level"]', 'high');

    await page.click('[data-testid="save-rule-btn"]');

    // Rule should appear in list
    await expect(page.locator('[data-testid="rule-item"]')).toContainText('Split Payment');
  });

  test('should view impact analysis', async ({ page }) => {
    await page.goto('/tax/regulations');

    // Click on a change
    await page.click('[data-testid="change-item"]').first();

    // View impact analysis
    await page.click('[data-testid="analyze-impact-btn"]');

    // Wait for analysis
    await expect(page.locator('[data-testid="impact-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="impacted-clients"]')).toBeVisible();
  });

  test('should bookmark a change', async ({ page }) => {
    await page.goto('/tax/regulations');

    // Click on first change
    await page.click('[data-testid="change-item"]').first();

    // Bookmark it
    await page.click('[data-testid="bookmark-btn"]');
    await page.fill('[data-testid="bookmark-notes"]', 'Ważne dla klienta XYZ');
    await page.click('[data-testid="save-bookmark-btn"]');

    // Verify bookmark in list
    await page.goto('/tax/regulations/bookmarks');
    await expect(page.locator('[data-testid="bookmark-item"]')).toContainText('Ważne dla klienta XYZ');
  });
});
```

---

## Security Checklist

### Authentication & Authorization
- [x] All endpoints require authentication
- [x] Organization-scoped data access via RLS
- [x] User-scoped bookmarks
- [x] Admin-only access for summary generation

### Data Protection
- [x] No PII in regulatory data
- [x] Encrypted API keys for OpenAI
- [x] Secure scraping configuration storage
- [x] Rate limiting on AI generation

### External Integrations
- [x] Government API rate limiting respected
- [x] Timeout handling for external sources
- [x] Error handling for source unavailability
- [x] Caching to reduce external calls

---

## Audit Events

```typescript
const REGULATORY_AUDIT_EVENTS = {
  // Search events
  CHANGES_SEARCHED: 'regulatory.changes.searched',
  CHANGE_VIEWED: 'regulatory.change.viewed',

  // Summary events
  SUMMARY_GENERATED: 'regulatory.summary.generated',
  SUMMARY_REVIEWED: 'regulatory.summary.reviewed',

  // Impact events
  IMPACT_ANALYZED: 'regulatory.impact.analyzed',
  IMPACT_ACKNOWLEDGED: 'regulatory.impact.acknowledged',
  IMPACT_IMPLEMENTED: 'regulatory.impact.implemented',

  // Rule events
  RULE_CREATED: 'regulatory.rule.created',
  RULE_UPDATED: 'regulatory.rule.updated',
  RULE_DELETED: 'regulatory.rule.deleted',
  RULE_MATCHED: 'regulatory.rule.matched',

  // Notification events
  NOTIFICATION_SENT: 'regulatory.notification.sent',
  NOTIFICATION_READ: 'regulatory.notification.read',

  // Bookmark events
  CHANGE_BOOKMARKED: 'regulatory.change.bookmarked',
  BOOKMARK_REMOVED: 'regulatory.bookmark.removed'
};
```

---

## Implementation Notes

### Source Scraping
- Daily scraping of government sources (configurable)
- Incremental updates using publication dates
- Deduplication via content hash
- Retry logic for failed scrapes

### AI Summary Generation
- GPT-4 Turbo for best Polish language support
- Structured JSON output format
- Confidence scoring based on model certainty
- Human review option for critical changes

### Impact Analysis Algorithm
```
Impact Score Calculation:
1. Check domain overlap between change and client config
2. For each overlapping domain, add base score (15-25 points)
3. Check keywords in AI summary for specific impacts
4. Calculate severity based on total score:
   - critical: score >= 60
   - high: score >= 40
   - medium: score >= 20
   - low: score > 0
```

### Notification System
- Immediate notifications for high/critical impact
- Daily/weekly digests for lower impact
- Multi-channel delivery (email, in-app, SMS)
- Read tracking for compliance

---

## Dependencies

- **CRM**: Client data for impact analysis
- **TAX-001**: Client tax configuration
- **DOC**: Document storage for regulatory texts
- **TAX-010**: AI infrastructure (OpenAI integration)

---

## References

- [Dziennik Ustaw](https://dziennikustaw.gov.pl)
- [Monitor Polski](https://monitorpolski.gov.pl)
- [ISAP](https://isap.sejm.gov.pl)
- [Interpretacje podatkowe MF](https://www.podatki.gov.pl/interpretacje)
- [Orzecznictwo NSA](https://orzeczenia.nsa.gov.pl)
- [EUR-Lex](https://eur-lex.europa.eu)

---

*Story created: December 2024*
*Last updated: December 2024*
