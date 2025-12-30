# DOC-006: Document Classification & Tagging

> **Story ID**: DOC-006
> **Epic**: Document Intelligence Module (DOC)
> **Priority**: P1 (High)
> **Story Points**: 8
> **Status**: 📋 Ready for Development
> **Phase**: Week 14

---

## 📋 User Story

**As an** accountant managing documents for Polish clients,
**I want** automatic document categorization and tagging,
**So that** documents are organized without manual effort and can be easily found and filtered.

---

## 🎯 Acceptance Criteria

### Scenario 1: AI-Powered Type Detection
```gherkin
Given a document has been OCR processed
When the classification engine analyzes the document
Then the system detects the document type with confidence score
And assigns one of the predefined types:
  | Type | Polish Name | Examples |
  | INVOICE | Faktura | Faktura VAT, Faktura korygująca, Faktura proforma |
  | RECEIPT | Paragon | Paragon fiskalny, Rachunek |
  | CONTRACT | Umowa | Umowa o pracę, Umowa zlecenie, Umowa o dzieło |
  | BANK_STATEMENT | Wyciąg | Wyciąg bankowy, Potwierdzenie przelewu |
  | TAX_DECLARATION | Deklaracja | PIT, CIT, VAT, JPK |
  | PAYROLL | Płace | Lista płac, Pasek wynagrodzeń |
  | CORRESPONDENCE | Korespondencja | Pismo urzędowe, Email |
  | OTHER | Inne | Dokumenty niezaklasyfikowane |
And the classification accuracy is ≥90% for clear documents
And low confidence classifications are flagged for review
```

### Scenario 2: Automatic Category Assignment
```gherkin
Given a document type has been detected
When the system assigns categories
Then it maps to appropriate accounting categories:
  | Type | Categories |
  | INVOICE | Zakupy, Sprzedaż, VAT, Koszty |
  | RECEIPT | Wydatki, Koszty operacyjne |
  | CONTRACT | Kadry, Umowy, Zobowiązania |
  | BANK_STATEMENT | Finanse, Rozrachunki |
  | TAX_DECLARATION | Podatki, Sprawozdawczość |
  | PAYROLL | Kadry, Płace, ZUS |
And assigns fiscal year and accounting period
And links to related client if NIP is detected
And assigns default retention period per Polish law
```

### Scenario 3: Custom Tag Management
```gherkin
Given an organization uses custom tags
When an accountant creates a new tag
Then the system allows defining:
  - Tag name (unique within organization)
  - Tag color (from predefined palette)
  - Tag description
  - Tag group/category
  - Visibility (organization-wide or personal)
And allows creating tag hierarchies (parent/child)
And tracks tag usage statistics
And supports up to 1000 custom tags per organization
```

### Scenario 4: AI Tag Suggestions
```gherkin
Given a document has been classified
And has extracted data
When the system generates tag suggestions
Then it suggests tags based on:
  - Document type and content
  - Seller/buyer NIP (recurring entities)
  - Amount thresholds (e.g., "Duża transakcja" for >10,000 PLN)
  - Fiscal period (e.g., "Q1 2024", "Styczeń 2024")
  - GTU codes from invoices
  - Contract types detected
And ranks suggestions by relevance
And learns from user tag selections
And suggests up to 10 relevant tags
```

### Scenario 5: Bulk Tagging
```gherkin
Given an accountant selects multiple documents
When bulk tagging is initiated
Then the system allows:
  - Adding tags to all selected documents
  - Removing tags from all selected documents
  - Replacing existing tags with new ones
And shows preview of changes before applying
And processes up to 500 documents per batch
And logs all bulk operations for audit
And allows undo within 30 minutes
```

### Scenario 6: Tag-Based Filtering
```gherkin
Given documents have been tagged
When an accountant applies tag filters
Then the system supports:
  - Single tag filtering
  - Multiple tag filtering (AND/OR logic)
  - Tag exclusion (NOT operator)
  - Combined with other filters (date, type, client)
And displays filtered document count
And allows saving filter presets
And provides instant results (<500ms for typical queries)
```

### Scenario 7: Automatic Re-classification
```gherkin
Given document content has been corrected
Or extracted data has been modified
When re-classification is triggered
Then the system re-evaluates document type
And updates categories if needed
And suggests additional tags based on new data
And preserves manually assigned tags
And logs classification history
```

### Scenario 8: Classification Rules Engine
```gherkin
Given an organization defines custom classification rules
When a document matches rule criteria
Then the system applies automatic actions:
  - Assign specific type override
  - Apply predefined tags
  - Assign to specific category
  - Route to workflow (DOC-007)
And rules support conditions:
  - NIP matching (specific issuers)
  - Amount ranges
  - Keyword detection
  - Date ranges
And rules have priority ordering
And rule conflicts are resolved by highest priority
```

---

## 🗄️ Database Schema

```sql
-- Document categories (predefined)
CREATE TABLE document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),

  name TEXT NOT NULL,
  name_pl TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,

  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  parent_id UUID REFERENCES document_categories(id),
  sort_order INTEGER DEFAULT 0,

  default_retention_years INTEGER,
  default_workflow_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (organization_id, name)
);

-- Document tags
CREATE TABLE document_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6B7280',

  tag_group TEXT,
  parent_id UUID REFERENCES document_tags(id),

  visibility TEXT NOT NULL DEFAULT 'ORGANIZATION' CHECK (
    visibility IN ('ORGANIZATION', 'PERSONAL', 'SYSTEM')
  ),
  created_by UUID REFERENCES users(id),

  usage_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (organization_id, slug)
);

-- Document tag assignments
CREATE TABLE document_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES document_tags(id) ON DELETE CASCADE,

  assigned_by UUID REFERENCES users(id),
  assignment_source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (
    assignment_source IN ('MANUAL', 'AI_SUGGESTED', 'RULE_BASED', 'BULK')
  ),

  confidence DECIMAL(5,4),
  is_accepted BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (document_id, tag_id)
);

-- Document classifications
CREATE TABLE document_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  document_type TEXT NOT NULL CHECK (document_type IN (
    'INVOICE', 'RECEIPT', 'CONTRACT', 'BANK_STATEMENT',
    'TAX_DECLARATION', 'PAYROLL', 'CORRESPONDENCE', 'OTHER'
  )),
  document_subtype TEXT,

  confidence DECIMAL(5,4) NOT NULL,
  classification_source TEXT NOT NULL DEFAULT 'AI' CHECK (
    classification_source IN ('AI', 'MANUAL', 'RULE_BASED', 'EXTRACTION')
  ),

  category_id UUID REFERENCES document_categories(id),

  fiscal_year INTEGER,
  fiscal_period TEXT,

  linked_client_id UUID REFERENCES clients(id),
  linked_entity_nip TEXT,

  retention_until DATE,
  retention_policy TEXT,

  metadata JSONB DEFAULT '{}',
  classification_history JSONB DEFAULT '[]',

  is_reviewed BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tag suggestions
CREATE TABLE tag_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES document_tags(id),

  relevance_score DECIMAL(5,4) NOT NULL,
  suggestion_reason TEXT,
  suggestion_source TEXT NOT NULL CHECK (
    suggestion_source IN ('CONTENT', 'ENTITY', 'AMOUNT', 'PERIOD', 'GTU', 'HISTORY')
  ),

  is_accepted BOOLEAN,
  is_dismissed BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (document_id, tag_id)
);

-- Classification rules
CREATE TABLE classification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,

  priority INTEGER NOT NULL DEFAULT 100,

  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,

  match_count INTEGER NOT NULL DEFAULT 0,
  last_matched_at TIMESTAMPTZ,

  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bulk operations log
CREATE TABLE bulk_tag_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  operation_type TEXT NOT NULL CHECK (
    operation_type IN ('ADD', 'REMOVE', 'REPLACE')
  ),

  document_ids UUID[] NOT NULL,
  document_count INTEGER NOT NULL,

  tags_added UUID[],
  tags_removed UUID[],

  performed_by UUID NOT NULL REFERENCES users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  is_reverted BOOLEAN DEFAULT false,
  reverted_at TIMESTAMPTZ,
  reverted_by UUID REFERENCES users(id),

  revert_deadline TIMESTAMPTZ NOT NULL
);

-- Saved filters
CREATE TABLE saved_tag_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_by UUID NOT NULL REFERENCES users(id),

  name TEXT NOT NULL,
  description TEXT,

  filter_config JSONB NOT NULL,

  is_shared BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_document_tags_org ON document_tags(organization_id);
CREATE INDEX idx_document_tags_slug ON document_tags(organization_id, slug);
CREATE INDEX idx_document_tags_group ON document_tags(organization_id, tag_group);

CREATE INDEX idx_tag_assignments_document ON document_tag_assignments(document_id);
CREATE INDEX idx_tag_assignments_tag ON document_tag_assignments(tag_id);

CREATE INDEX idx_classifications_document ON document_classifications(document_id);
CREATE INDEX idx_classifications_org ON document_classifications(organization_id);
CREATE INDEX idx_classifications_type ON document_classifications(document_type);
CREATE INDEX idx_classifications_period ON document_classifications(fiscal_year, fiscal_period);
CREATE INDEX idx_classifications_client ON document_classifications(linked_client_id);

CREATE INDEX idx_tag_suggestions_document ON tag_suggestions(document_id);
CREATE INDEX idx_classification_rules_org ON classification_rules(organization_id, priority);

CREATE INDEX idx_bulk_operations_org ON bulk_tag_operations(organization_id);
CREATE INDEX idx_bulk_operations_deadline ON bulk_tag_operations(revert_deadline) WHERE NOT is_reverted;

-- RLS Policies
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_tag_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_tag_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_org_isolation ON document_categories
  USING (organization_id IS NULL OR organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY tags_org_isolation ON document_tags
  USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY tag_assignments_org_isolation ON document_tag_assignments
  USING (document_id IN (
    SELECT id FROM documents
    WHERE organization_id = current_setting('app.current_organization_id')::UUID
  ));

CREATE POLICY classifications_org_isolation ON document_classifications
  USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY suggestions_org_isolation ON tag_suggestions
  USING (document_id IN (
    SELECT id FROM documents
    WHERE organization_id = current_setting('app.current_organization_id')::UUID
  ));

CREATE POLICY rules_org_isolation ON classification_rules
  USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY bulk_ops_org_isolation ON bulk_tag_operations
  USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY filters_org_isolation ON saved_tag_filters
  USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Functions
CREATE OR REPLACE FUNCTION update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE document_tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE document_tags SET usage_count = usage_count - 1 WHERE id = OLD.tag_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tag_usage
AFTER INSERT OR DELETE ON document_tag_assignments
FOR EACH ROW EXECUTE FUNCTION update_tag_usage_count();
```

---

## 📝 Zod Validation Schemas

```typescript
import { z } from 'zod';

// Document type enum
export const DocumentTypeEnum = z.enum([
  'INVOICE',
  'RECEIPT',
  'CONTRACT',
  'BANK_STATEMENT',
  'TAX_DECLARATION',
  'PAYROLL',
  'CORRESPONDENCE',
  'OTHER'
]);

export const TagVisibilityEnum = z.enum([
  'ORGANIZATION',
  'PERSONAL',
  'SYSTEM'
]);

export const AssignmentSourceEnum = z.enum([
  'MANUAL',
  'AI_SUGGESTED',
  'RULE_BASED',
  'BULK'
]);

export const ClassificationSourceEnum = z.enum([
  'AI',
  'MANUAL',
  'RULE_BASED',
  'EXTRACTION'
]);

// Tag color palette (brand-safe colors)
const TAG_COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#F59E0B', // amber
  '#EAB308', // yellow
  '#84CC16', // lime
  '#22C55E', // green
  '#10B981', // emerald
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#0EA5E9', // sky
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#A855F7', // purple
  '#D946EF', // fuchsia
  '#EC4899', // pink
  '#6B7280', // gray
] as const;

// Create tag
export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  color: z.enum(TAG_COLORS as unknown as [string, ...string[]]).default('#6B7280'),
  tagGroup: z.string().max(50).optional(),
  parentId: z.string().uuid().optional(),
  visibility: TagVisibilityEnum.default('ORGANIZATION')
});

// Update tag
export const updateTagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
  color: z.enum(TAG_COLORS as unknown as [string, ...string[]]).optional(),
  tagGroup: z.string().max(50).optional(),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional()
});

// Assign tags to document
export const assignTagsSchema = z.object({
  documentId: z.string().uuid(),
  tagIds: z.array(z.string().uuid()).min(1).max(50),
  source: AssignmentSourceEnum.default('MANUAL')
});

// Remove tags from document
export const removeTagsSchema = z.object({
  documentId: z.string().uuid(),
  tagIds: z.array(z.string().uuid()).min(1)
});

// Bulk tag operation
export const bulkTagOperationSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(500),
  operation: z.enum(['ADD', 'REMOVE', 'REPLACE']),
  tagsToAdd: z.array(z.string().uuid()).optional(),
  tagsToRemove: z.array(z.string().uuid()).optional()
}).refine(
  (data) => {
    if (data.operation === 'ADD') return data.tagsToAdd && data.tagsToAdd.length > 0;
    if (data.operation === 'REMOVE') return data.tagsToRemove && data.tagsToRemove.length > 0;
    if (data.operation === 'REPLACE') {
      return (data.tagsToAdd && data.tagsToAdd.length > 0) ||
             (data.tagsToRemove && data.tagsToRemove.length > 0);
    }
    return true;
  },
  { message: 'Wymagane są tagi do operacji' }
);

// Revert bulk operation
export const revertBulkOperationSchema = z.object({
  operationId: z.string().uuid()
});

// Create category
export const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  namePl: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  parentId: z.string().uuid().optional(),
  defaultRetentionYears: z.number().int().min(1).max(50).optional(),
  defaultWorkflowId: z.string().uuid().optional()
});

// Classification rule conditions
const ruleConditionSchema = z.object({
  field: z.enum([
    'documentType',
    'sellerNip',
    'buyerNip',
    'amountGross',
    'keyword',
    'date',
    'fiscalPeriod'
  ]),
  operator: z.enum([
    'equals',
    'notEquals',
    'contains',
    'notContains',
    'greaterThan',
    'lessThan',
    'between',
    'in',
    'notIn',
    'matches' // regex
  ]),
  value: z.union([
    z.string(),
    z.number(),
    z.array(z.string()),
    z.array(z.number()),
    z.object({ min: z.number(), max: z.number() })
  ])
});

// Classification rule actions
const ruleActionSchema = z.object({
  type: z.enum([
    'setType',
    'setCategory',
    'addTags',
    'setRetention',
    'triggerWorkflow',
    'assignToClient',
    'setFiscalPeriod'
  ]),
  value: z.union([
    z.string(),
    z.array(z.string().uuid()),
    z.number(),
    z.object({
      year: z.number(),
      period: z.string()
    })
  ])
});

// Create classification rule
export const createClassificationRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  priority: z.number().int().min(1).max(1000).default(100),
  conditions: z.array(ruleConditionSchema).min(1),
  conditionsLogic: z.enum(['AND', 'OR']).default('AND'),
  actions: z.array(ruleActionSchema).min(1),
  isActive: z.boolean().default(true)
});

// Update classification rule
export const updateClassificationRuleSchema = createClassificationRuleSchema.partial().extend({
  id: z.string().uuid()
});

// Manual classification
export const classifyDocumentSchema = z.object({
  documentId: z.string().uuid(),
  documentType: DocumentTypeEnum,
  documentSubtype: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  fiscalYear: z.number().int().min(2000).max(2100).optional(),
  fiscalPeriod: z.string().optional(),
  linkedClientId: z.string().uuid().optional()
});

// Accept/dismiss tag suggestion
export const handleSuggestionSchema = z.object({
  suggestionId: z.string().uuid(),
  action: z.enum(['accept', 'dismiss'])
});

// Filter by tags
export const tagFilterSchema = z.object({
  includeTags: z.array(z.string().uuid()).optional(),
  excludeTags: z.array(z.string().uuid()).optional(),
  tagLogic: z.enum(['AND', 'OR']).default('AND'),
  documentTypes: z.array(DocumentTypeEnum).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  fiscalYear: z.number().int().optional(),
  fiscalPeriod: z.string().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  clientId: z.string().uuid().optional(),
  isReviewed: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'type', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Save filter preset
export const saveFilterPresetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  filterConfig: tagFilterSchema.omit({ page: true, pageSize: true }),
  isShared: z.boolean().default(false)
});

// Search tags
export const searchTagsSchema = z.object({
  query: z.string().optional(),
  tagGroup: z.string().optional(),
  visibility: TagVisibilityEnum.optional(),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
  sortBy: z.enum(['name', 'usageCount', 'createdAt']).default('usageCount'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});
```

---

## 🔧 Service Implementation

```typescript
// src/services/document/classification.service.ts

import { db } from '@/lib/db';
import { OpenAI } from 'openai';
import { createAuditLog } from '@/lib/audit';
import slugify from 'slugify';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Polish document type definitions
const DOCUMENT_TYPE_DEFINITIONS: Record<string, {
  keywords: string[];
  patterns: RegExp[];
  defaultCategory: string;
  defaultRetentionYears: number;
}> = {
  INVOICE: {
    keywords: ['faktura', 'vat', 'netto', 'brutto', 'sprzedawca', 'nabywca', 'nip'],
    patterns: [/faktura\s+(vat|koryguj|proforma)/i, /nip:\s*\d{10}/i],
    defaultCategory: 'Zakupy',
    defaultRetentionYears: 5
  },
  RECEIPT: {
    keywords: ['paragon', 'fiskalny', 'ptu', 'kasa', 'unikatowy'],
    patterns: [/paragon\s+fiskalny/i, /nr\s+unikatowy/i],
    defaultCategory: 'Wydatki',
    defaultRetentionYears: 5
  },
  CONTRACT: {
    keywords: ['umowa', 'strony', 'przedmiot', 'zobowiązania', 'wypowiedzenie'],
    patterns: [/umowa\s+(o\s+pracę|zlecenie|o\s+dzieło|najmu)/i],
    defaultCategory: 'Umowy',
    defaultRetentionYears: 10
  },
  BANK_STATEMENT: {
    keywords: ['wyciąg', 'saldo', 'bankowy', 'transakcje', 'przelew'],
    patterns: [/wyciąg\s+(bankowy|z\s+konta)/i, /saldo\s+(początkowe|końcowe)/i],
    defaultCategory: 'Finanse',
    defaultRetentionYears: 5
  },
  TAX_DECLARATION: {
    keywords: ['deklaracja', 'pit', 'cit', 'vat-7', 'jpk', 'urząd skarbowy'],
    patterns: [/(pit|cit|vat)-\d+/i, /jpk_v7/i],
    defaultCategory: 'Podatki',
    defaultRetentionYears: 5
  },
  PAYROLL: {
    keywords: ['lista płac', 'wynagrodzenie', 'pasek', 'składki', 'zus'],
    patterns: [/lista\s+płac/i, /pasek\s+(wynagrodz|wypłat)/i],
    defaultCategory: 'Płace',
    defaultRetentionYears: 50 // 50 years for employee records per Polish law
  },
  CORRESPONDENCE: {
    keywords: ['pismo', 'urząd', 'wezwanie', 'zawiadomienie', 'decyzja'],
    patterns: [/pismo\s+(urzędowe|procesowe)/i, /znak\s+sprawy/i],
    defaultCategory: 'Korespondencja',
    defaultRetentionYears: 5
  }
};

export class ClassificationService {

  /**
   * Classify a document
   */
  static async classifyDocument(
    documentId: string,
    ocrText: string,
    extractedData: any | null,
    context: { userId: string; organizationId: string }
  ): Promise<{
    documentType: string;
    documentSubtype: string | null;
    confidence: number;
    categoryId: string | null;
    fiscalYear: number | null;
    fiscalPeriod: string | null;
    linkedClientId: string | null;
    suggestedTags: Array<{ tagId: string; relevance: number; reason: string }>;
  }> {
    // Step 1: Rule-based classification
    const ruleResult = await this.applyClassificationRules(
      documentId,
      ocrText,
      extractedData,
      context.organizationId
    );

    if (ruleResult) {
      return ruleResult;
    }

    // Step 2: Pattern-based classification
    const patternResult = this.classifyByPatterns(ocrText);

    // Step 3: AI classification for low confidence or OTHER type
    let finalClassification = patternResult;
    if (patternResult.confidence < 0.8 || patternResult.documentType === 'OTHER') {
      const aiResult = await this.classifyWithAI(ocrText);
      if (aiResult.confidence > patternResult.confidence) {
        finalClassification = aiResult;
      }
    }

    // Step 4: Determine fiscal period
    const fiscalInfo = this.determineFiscalPeriod(extractedData, ocrText);

    // Step 5: Link to client by NIP
    const linkedClientId = await this.findClientByNip(
      extractedData,
      context.organizationId
    );

    // Step 6: Get or create default category
    const categoryId = await this.getDefaultCategory(
      finalClassification.documentType,
      context.organizationId
    );

    // Step 7: Generate tag suggestions
    const suggestedTags = await this.generateTagSuggestions(
      documentId,
      finalClassification.documentType,
      extractedData,
      fiscalInfo,
      context.organizationId
    );

    // Save classification
    await db.insert('document_classifications').values({
      documentId,
      organizationId: context.organizationId,
      documentType: finalClassification.documentType,
      documentSubtype: finalClassification.documentSubtype,
      confidence: finalClassification.confidence,
      classificationSource: finalClassification.source,
      categoryId,
      fiscalYear: fiscalInfo.year,
      fiscalPeriod: fiscalInfo.period,
      linkedClientId,
      retentionUntil: this.calculateRetentionDate(finalClassification.documentType),
      metadata: {
        patternMatches: finalClassification.patterns || [],
        keywordMatches: finalClassification.keywords || []
      }
    });

    // Save tag suggestions
    if (suggestedTags.length > 0) {
      await db.insert('tag_suggestions').values(
        suggestedTags.map(suggestion => ({
          documentId,
          tagId: suggestion.tagId,
          relevanceScore: suggestion.relevance,
          suggestionReason: suggestion.reason,
          suggestionSource: suggestion.source
        }))
      );
    }

    // Audit log
    await createAuditLog({
      action: 'DOCUMENT_CLASSIFIED',
      entityType: 'document',
      entityId: documentId,
      userId: context.userId,
      organizationId: context.organizationId,
      metadata: {
        documentType: finalClassification.documentType,
        confidence: finalClassification.confidence,
        source: finalClassification.source,
        suggestedTagsCount: suggestedTags.length
      }
    });

    return {
      documentType: finalClassification.documentType,
      documentSubtype: finalClassification.documentSubtype,
      confidence: finalClassification.confidence,
      categoryId,
      fiscalYear: fiscalInfo.year,
      fiscalPeriod: fiscalInfo.period,
      linkedClientId,
      suggestedTags
    };
  }

  /**
   * Classify document by pattern matching
   */
  private static classifyByPatterns(text: string): {
    documentType: string;
    documentSubtype: string | null;
    confidence: number;
    source: string;
    patterns: string[];
    keywords: string[];
  } {
    const textLower = text.toLowerCase();
    const results: Array<{
      type: string;
      keywordScore: number;
      patternScore: number;
      matchedKeywords: string[];
      matchedPatterns: string[];
    }> = [];

    for (const [docType, config] of Object.entries(DOCUMENT_TYPE_DEFINITIONS)) {
      const matchedKeywords = config.keywords.filter(kw => textLower.includes(kw));
      const matchedPatterns = config.patterns.filter(p => p.test(textLower)).map(p => p.source);

      const keywordScore = matchedKeywords.length / config.keywords.length;
      const patternScore = matchedPatterns.length > 0 ? 1 : 0;

      results.push({
        type: docType,
        keywordScore,
        patternScore,
        matchedKeywords,
        matchedPatterns
      });
    }

    // Sort by combined score
    results.sort((a, b) => {
      const scoreA = a.patternScore * 0.6 + a.keywordScore * 0.4;
      const scoreB = b.patternScore * 0.6 + b.keywordScore * 0.4;
      return scoreB - scoreA;
    });

    const best = results[0];
    const confidence = best.patternScore * 0.6 + best.keywordScore * 0.4;

    if (confidence < 0.3) {
      return {
        documentType: 'OTHER',
        documentSubtype: null,
        confidence: confidence,
        source: 'AI',
        patterns: [],
        keywords: []
      };
    }

    // Determine subtype
    let documentSubtype: string | null = null;
    if (best.type === 'INVOICE') {
      if (textLower.includes('koryguj')) documentSubtype = 'CORRECTION';
      else if (textLower.includes('proforma')) documentSubtype = 'PROFORMA';
      else if (textLower.includes('zaliczk')) documentSubtype = 'ADVANCE';
      else documentSubtype = 'STANDARD';
    } else if (best.type === 'CONTRACT') {
      if (textLower.includes('o pracę')) documentSubtype = 'EMPLOYMENT';
      else if (textLower.includes('zlecenie')) documentSubtype = 'SERVICE';
      else if (textLower.includes('o dzieło')) documentSubtype = 'WORK';
      else if (textLower.includes('najmu')) documentSubtype = 'LEASE';
    }

    return {
      documentType: best.type,
      documentSubtype,
      confidence,
      source: 'AI',
      patterns: best.matchedPatterns,
      keywords: best.matchedKeywords
    };
  }

  /**
   * Classify with AI for uncertain documents
   */
  private static async classifyWithAI(text: string): Promise<{
    documentType: string;
    documentSubtype: string | null;
    confidence: number;
    source: string;
  }> {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `Sklasyfikuj polski dokument księgowy. Zwróć JSON z polami:
- documentType: INVOICE | RECEIPT | CONTRACT | BANK_STATEMENT | TAX_DECLARATION | PAYROLL | CORRESPONDENCE | OTHER
- documentSubtype: opcjonalny podtyp (np. dla INVOICE: STANDARD, CORRECTION, PROFORMA)
- confidence: liczba 0-1 określająca pewność klasyfikacji
- reasoning: krótkie uzasadnienie

Kontekst typów dokumentów:
- INVOICE: Faktury VAT, faktury korygujące, proformy
- RECEIPT: Paragony fiskalne, rachunki
- CONTRACT: Umowy o pracę, zlecenie, o dzieło, najmu
- BANK_STATEMENT: Wyciągi bankowe, potwierdzenia przelewów
- TAX_DECLARATION: Deklaracje PIT, CIT, VAT, JPK
- PAYROLL: Listy płac, paski wynagrodzeń
- CORRESPONDENCE: Pisma urzędowe, korespondencja
- OTHER: Dokumenty nierozpoznane`
        },
        {
          role: 'user',
          content: text.slice(0, 3000)
        }
      ],
      max_tokens: 200,
      temperature: 0,
      response_format: { type: 'json_object' }
    });

    try {
      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      return {
        documentType: result.documentType || 'OTHER',
        documentSubtype: result.documentSubtype || null,
        confidence: Math.min(result.confidence || 0.5, 0.95),
        source: 'AI'
      };
    } catch {
      return {
        documentType: 'OTHER',
        documentSubtype: null,
        confidence: 0.3,
        source: 'AI'
      };
    }
  }

  /**
   * Apply custom classification rules
   */
  private static async applyClassificationRules(
    documentId: string,
    text: string,
    extractedData: any,
    organizationId: string
  ): Promise<any | null> {
    const rules = await db.query.classificationRules.findMany({
      where: (r, { eq, and }) => and(
        eq(r.organizationId, organizationId),
        eq(r.isActive, true)
      ),
      orderBy: (r, { asc }) => [asc(r.priority)]
    });

    for (const rule of rules) {
      if (this.evaluateRuleConditions(rule.conditions, rule.conditionsLogic, text, extractedData)) {
        const result = await this.executeRuleActions(rule.actions, extractedData);

        // Update rule match count
        await db.update('classification_rules')
          .set({
            matchCount: sql`match_count + 1`,
            lastMatchedAt: new Date()
          })
          .where(eq('id', rule.id));

        return {
          ...result,
          source: 'RULE_BASED',
          ruleId: rule.id
        };
      }
    }

    return null;
  }

  /**
   * Evaluate rule conditions
   */
  private static evaluateRuleConditions(
    conditions: any[],
    logic: string,
    text: string,
    extractedData: any
  ): boolean {
    const results = conditions.map(condition => {
      const fieldValue = this.getFieldValue(condition.field, text, extractedData);
      return this.evaluateCondition(condition.operator, fieldValue, condition.value);
    });

    return logic === 'AND'
      ? results.every(r => r)
      : results.some(r => r);
  }

  /**
   * Get field value for condition evaluation
   */
  private static getFieldValue(field: string, text: string, extractedData: any): any {
    switch (field) {
      case 'documentType':
        return extractedData?.documentType;
      case 'sellerNip':
        return extractedData?.seller?.nip;
      case 'buyerNip':
        return extractedData?.buyer?.nip;
      case 'amountGross':
        return extractedData?.totals?.totalGross;
      case 'keyword':
        return text.toLowerCase();
      case 'date':
        return extractedData?.document?.issueDate || extractedData?.document?.date;
      case 'fiscalPeriod':
        return this.determineFiscalPeriod(extractedData, text);
      default:
        return null;
    }
  }

  /**
   * Evaluate single condition
   */
  private static evaluateCondition(operator: string, fieldValue: any, conditionValue: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === conditionValue;
      case 'notEquals':
        return fieldValue !== conditionValue;
      case 'contains':
        return String(fieldValue).includes(String(conditionValue));
      case 'notContains':
        return !String(fieldValue).includes(String(conditionValue));
      case 'greaterThan':
        return Number(fieldValue) > Number(conditionValue);
      case 'lessThan':
        return Number(fieldValue) < Number(conditionValue);
      case 'between':
        return Number(fieldValue) >= conditionValue.min && Number(fieldValue) <= conditionValue.max;
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      case 'notIn':
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
      case 'matches':
        return new RegExp(conditionValue, 'i').test(String(fieldValue));
      default:
        return false;
    }
  }

  /**
   * Execute rule actions
   */
  private static async executeRuleActions(actions: any[], extractedData: any): Promise<any> {
    const result: any = {
      confidence: 0.95
    };

    for (const action of actions) {
      switch (action.type) {
        case 'setType':
          result.documentType = action.value;
          break;
        case 'setCategory':
          result.categoryId = action.value;
          break;
        case 'addTags':
          result.tagsToAdd = action.value;
          break;
        case 'setRetention':
          result.retentionYears = action.value;
          break;
        case 'triggerWorkflow':
          result.workflowId = action.value;
          break;
        case 'assignToClient':
          result.linkedClientId = action.value;
          break;
        case 'setFiscalPeriod':
          result.fiscalYear = action.value.year;
          result.fiscalPeriod = action.value.period;
          break;
      }
    }

    return result;
  }

  /**
   * Determine fiscal period from document
   */
  private static determineFiscalPeriod(
    extractedData: any,
    text: string
  ): { year: number | null; period: string | null } {
    // Try to get from extracted data
    const date = extractedData?.document?.issueDate ||
                 extractedData?.document?.saleDate ||
                 extractedData?.document?.date;

    if (date) {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        const year = parsed.getFullYear();
        const month = parsed.getMonth() + 1;
        const quarter = Math.ceil(month / 3);
        return {
          year,
          period: `Q${quarter}-${year}`
        };
      }
    }

    // Try to extract from text
    const yearMatch = text.match(/20\d{2}/);
    const year = yearMatch ? parseInt(yearMatch[0]) : null;

    const monthPatterns = [
      { pattern: /styczeń|stycz|01[\/.-]20\d{2}/i, month: 1 },
      { pattern: /luty|lut|02[\/.-]20\d{2}/i, month: 2 },
      { pattern: /marzec|mar|03[\/.-]20\d{2}/i, month: 3 },
      { pattern: /kwiecień|kwi|04[\/.-]20\d{2}/i, month: 4 },
      { pattern: /maj|05[\/.-]20\d{2}/i, month: 5 },
      { pattern: /czerwiec|cze|06[\/.-]20\d{2}/i, month: 6 },
      { pattern: /lipiec|lip|07[\/.-]20\d{2}/i, month: 7 },
      { pattern: /sierpień|sie|08[\/.-]20\d{2}/i, month: 8 },
      { pattern: /wrzesień|wrz|09[\/.-]20\d{2}/i, month: 9 },
      { pattern: /październik|paź|10[\/.-]20\d{2}/i, month: 10 },
      { pattern: /listopad|lis|11[\/.-]20\d{2}/i, month: 11 },
      { pattern: /grudzień|gru|12[\/.-]20\d{2}/i, month: 12 }
    ];

    for (const { pattern, month } of monthPatterns) {
      if (pattern.test(text)) {
        const quarter = Math.ceil(month / 3);
        return {
          year,
          period: year ? `Q${quarter}-${year}` : null
        };
      }
    }

    return { year, period: null };
  }

  /**
   * Find client by NIP
   */
  private static async findClientByNip(
    extractedData: any,
    organizationId: string
  ): Promise<string | null> {
    const nipCandidates = [
      extractedData?.seller?.nip,
      extractedData?.buyer?.nip
    ].filter(Boolean);

    for (const nip of nipCandidates) {
      const client = await db.query.clients.findFirst({
        where: (c, { eq, and }) => and(
          eq(c.organizationId, organizationId),
          eq(c.nip, nip.replace(/-/g, ''))
        )
      });

      if (client) {
        return client.id;
      }
    }

    return null;
  }

  /**
   * Get or create default category
   */
  private static async getDefaultCategory(
    documentType: string,
    organizationId: string
  ): Promise<string | null> {
    const config = DOCUMENT_TYPE_DEFINITIONS[documentType];
    if (!config) return null;

    // Look for existing category
    let category = await db.query.documentCategories.findFirst({
      where: (c, { eq, and, or }) => and(
        or(
          eq(c.organizationId, organizationId),
          sql`organization_id IS NULL`
        ),
        eq(c.name, config.defaultCategory)
      )
    });

    // Create if doesn't exist
    if (!category) {
      const [created] = await db.insert('document_categories').values({
        organizationId,
        name: config.defaultCategory,
        namePl: config.defaultCategory,
        defaultRetentionYears: config.defaultRetentionYears,
        isSystem: false,
        isActive: true
      }).returning();
      category = created;
    }

    return category.id;
  }

  /**
   * Calculate retention date
   */
  private static calculateRetentionDate(documentType: string): Date {
    const config = DOCUMENT_TYPE_DEFINITIONS[documentType];
    const years = config?.defaultRetentionYears || 5;

    const date = new Date();
    date.setFullYear(date.getFullYear() + years);
    return date;
  }

  /**
   * Generate tag suggestions
   */
  private static async generateTagSuggestions(
    documentId: string,
    documentType: string,
    extractedData: any,
    fiscalInfo: { year: number | null; period: string | null },
    organizationId: string
  ): Promise<Array<{ tagId: string; relevance: number; reason: string; source: string }>> {
    const suggestions: Array<{ tagId: string; relevance: number; reason: string; source: string }> = [];

    // Get all active tags for organization
    const tags = await db.query.documentTags.findMany({
      where: (t, { eq, and }) => and(
        eq(t.organizationId, organizationId),
        eq(t.isActive, true)
      )
    });

    // Suggest by document type
    for (const tag of tags) {
      const tagLower = tag.name.toLowerCase();
      const tagSlug = tag.slug.toLowerCase();

      // Document type match
      if (tagLower.includes(documentType.toLowerCase()) || tagSlug.includes(documentType.toLowerCase())) {
        suggestions.push({
          tagId: tag.id,
          relevance: 0.9,
          reason: `Typ dokumentu: ${documentType}`,
          source: 'CONTENT'
        });
      }

      // Entity match (seller/buyer NIP)
      const sellerNip = extractedData?.seller?.nip;
      const sellerName = extractedData?.seller?.name?.toLowerCase();
      if (sellerNip && (tagLower.includes(sellerNip) || (sellerName && tagLower.includes(sellerName.slice(0, 10))))) {
        suggestions.push({
          tagId: tag.id,
          relevance: 0.85,
          reason: `Kontrahent: ${extractedData.seller.name}`,
          source: 'ENTITY'
        });
      }

      // Amount threshold
      const amount = extractedData?.totals?.totalGross || 0;
      if (amount > 10000 && (tagLower.includes('duż') || tagLower.includes('znacząc'))) {
        suggestions.push({
          tagId: tag.id,
          relevance: 0.8,
          reason: `Kwota: ${amount.toFixed(2)} PLN`,
          source: 'AMOUNT'
        });
      }

      // Fiscal period match
      if (fiscalInfo.period && tagLower.includes(fiscalInfo.period.toLowerCase())) {
        suggestions.push({
          tagId: tag.id,
          relevance: 0.75,
          reason: `Okres: ${fiscalInfo.period}`,
          source: 'PERIOD'
        });
      }
      if (fiscalInfo.year && tagLower.includes(fiscalInfo.year.toString())) {
        suggestions.push({
          tagId: tag.id,
          relevance: 0.7,
          reason: `Rok: ${fiscalInfo.year}`,
          source: 'PERIOD'
        });
      }

      // GTU code match
      const gtuCodes = extractedData?.lineItems?.map((item: any) => item.gtuCode).filter(Boolean) || [];
      for (const gtu of gtuCodes) {
        if (tagLower.includes(gtu.toLowerCase())) {
          suggestions.push({
            tagId: tag.id,
            relevance: 0.85,
            reason: `Kod GTU: ${gtu}`,
            source: 'GTU'
          });
        }
      }
    }

    // Deduplicate and sort by relevance
    const uniqueSuggestions = new Map<string, typeof suggestions[0]>();
    for (const suggestion of suggestions) {
      const existing = uniqueSuggestions.get(suggestion.tagId);
      if (!existing || suggestion.relevance > existing.relevance) {
        uniqueSuggestions.set(suggestion.tagId, suggestion);
      }
    }

    return Array.from(uniqueSuggestions.values())
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10);
  }

  /**
   * Create a new tag
   */
  static async createTag(
    input: {
      name: string;
      description?: string;
      color: string;
      tagGroup?: string;
      parentId?: string;
      visibility: string;
    },
    context: { userId: string; organizationId: string }
  ): Promise<any> {
    const slug = slugify(input.name, { lower: true, strict: true });

    // Check for existing tag with same slug
    const existing = await db.query.documentTags.findFirst({
      where: (t, { eq, and }) => and(
        eq(t.organizationId, context.organizationId),
        eq(t.slug, slug)
      )
    });

    if (existing) {
      throw new Error('Tag o tej nazwie już istnieje');
    }

    const [tag] = await db.insert('document_tags').values({
      organizationId: context.organizationId,
      name: input.name,
      slug,
      description: input.description,
      color: input.color,
      tagGroup: input.tagGroup,
      parentId: input.parentId,
      visibility: input.visibility,
      createdBy: context.userId
    }).returning();

    await createAuditLog({
      action: 'TAG_CREATED',
      entityType: 'document_tag',
      entityId: tag.id,
      userId: context.userId,
      organizationId: context.organizationId,
      metadata: { name: input.name }
    });

    return tag;
  }

  /**
   * Assign tags to document
   */
  static async assignTags(
    input: {
      documentId: string;
      tagIds: string[];
      source: string;
    },
    context: { userId: string; organizationId: string }
  ): Promise<void> {
    // Verify document belongs to organization
    const document = await db.query.documents.findFirst({
      where: (d, { eq, and }) => and(
        eq(d.id, input.documentId),
        eq(d.organizationId, context.organizationId)
      )
    });

    if (!document) {
      throw new Error('Dokument nie znaleziony');
    }

    // Insert tag assignments
    const values = input.tagIds.map(tagId => ({
      documentId: input.documentId,
      tagId,
      assignedBy: context.userId,
      assignmentSource: input.source,
      isAccepted: true
    }));

    await db.insert('document_tag_assignments')
      .values(values)
      .onConflictDoNothing();

    await createAuditLog({
      action: 'TAGS_ASSIGNED',
      entityType: 'document',
      entityId: input.documentId,
      userId: context.userId,
      organizationId: context.organizationId,
      metadata: { tagIds: input.tagIds, source: input.source }
    });
  }

  /**
   * Bulk tag operation
   */
  static async bulkTagOperation(
    input: {
      documentIds: string[];
      operation: 'ADD' | 'REMOVE' | 'REPLACE';
      tagsToAdd?: string[];
      tagsToRemove?: string[];
    },
    context: { userId: string; organizationId: string }
  ): Promise<{ operationId: string; affectedCount: number }> {
    // Verify all documents belong to organization
    const documents = await db.query.documents.findMany({
      where: (d, { and, inArray }) => and(
        inArray(d.id, input.documentIds),
        eq(d.organizationId, context.organizationId)
      )
    });

    if (documents.length !== input.documentIds.length) {
      throw new Error('Niektóre dokumenty nie zostały znalezione');
    }

    // Create bulk operation record
    const [operation] = await db.insert('bulk_tag_operations').values({
      organizationId: context.organizationId,
      operationType: input.operation,
      documentIds: input.documentIds,
      documentCount: input.documentIds.length,
      tagsAdded: input.tagsToAdd || [],
      tagsRemoved: input.tagsToRemove || [],
      performedBy: context.userId,
      revertDeadline: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    }).returning();

    // Execute operation
    if (input.operation === 'REMOVE' || input.operation === 'REPLACE') {
      if (input.tagsToRemove?.length) {
        await db.delete('document_tag_assignments')
          .where(and(
            inArray('documentId', input.documentIds),
            inArray('tagId', input.tagsToRemove)
          ));
      }
    }

    if (input.operation === 'ADD' || input.operation === 'REPLACE') {
      if (input.tagsToAdd?.length) {
        const assignments = input.documentIds.flatMap(docId =>
          input.tagsToAdd!.map(tagId => ({
            documentId: docId,
            tagId,
            assignedBy: context.userId,
            assignmentSource: 'BULK',
            isAccepted: true
          }))
        );

        await db.insert('document_tag_assignments')
          .values(assignments)
          .onConflictDoNothing();
      }
    }

    await createAuditLog({
      action: 'BULK_TAG_OPERATION',
      entityType: 'bulk_operation',
      entityId: operation.id,
      userId: context.userId,
      organizationId: context.organizationId,
      metadata: {
        operation: input.operation,
        documentCount: input.documentIds.length,
        tagsAdded: input.tagsToAdd,
        tagsRemoved: input.tagsToRemove
      }
    });

    return {
      operationId: operation.id,
      affectedCount: input.documentIds.length
    };
  }

  /**
   * Revert bulk operation
   */
  static async revertBulkOperation(
    operationId: string,
    context: { userId: string; organizationId: string }
  ): Promise<void> {
    const operation = await db.query.bulkTagOperations.findFirst({
      where: (o, { eq, and }) => and(
        eq(o.id, operationId),
        eq(o.organizationId, context.organizationId)
      )
    });

    if (!operation) {
      throw new Error('Operacja nie znaleziona');
    }

    if (operation.isReverted) {
      throw new Error('Operacja została już cofnięta');
    }

    if (new Date() > operation.revertDeadline) {
      throw new Error('Upłynął czas na cofnięcie operacji');
    }

    // Reverse the operation
    if (operation.operationType === 'ADD' || operation.operationType === 'REPLACE') {
      if (operation.tagsAdded?.length) {
        await db.delete('document_tag_assignments')
          .where(and(
            inArray('documentId', operation.documentIds),
            inArray('tagId', operation.tagsAdded)
          ));
      }
    }

    if (operation.operationType === 'REMOVE' || operation.operationType === 'REPLACE') {
      if (operation.tagsRemoved?.length) {
        const assignments = operation.documentIds.flatMap(docId =>
          operation.tagsRemoved!.map(tagId => ({
            documentId: docId,
            tagId,
            assignedBy: context.userId,
            assignmentSource: 'BULK',
            isAccepted: true
          }))
        );

        await db.insert('document_tag_assignments')
          .values(assignments)
          .onConflictDoNothing();
      }
    }

    // Mark as reverted
    await db.update('bulk_tag_operations')
      .set({
        isReverted: true,
        revertedAt: new Date(),
        revertedBy: context.userId
      })
      .where(eq('id', operationId));

    await createAuditLog({
      action: 'BULK_OPERATION_REVERTED',
      entityType: 'bulk_operation',
      entityId: operationId,
      userId: context.userId,
      organizationId: context.organizationId
    });
  }

  /**
   * Filter documents by tags
   */
  static async filterByTags(
    input: {
      includeTags?: string[];
      excludeTags?: string[];
      tagLogic: 'AND' | 'OR';
      documentTypes?: string[];
      categoryIds?: string[];
      fiscalYear?: number;
      fiscalPeriod?: string;
      dateFrom?: string;
      dateTo?: string;
      clientId?: string;
      isReviewed?: boolean;
      page: number;
      pageSize: number;
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    },
    context: { organizationId: string }
  ): Promise<{ documents: any[]; total: number }> {
    const offset = (input.page - 1) * input.pageSize;

    let baseQuery = db.select({
      document: documents,
      classification: documentClassifications,
      tagCount: sql`COUNT(DISTINCT dta.tag_id)`
    })
    .from(documents)
    .leftJoin(documentClassifications, eq(documents.id, documentClassifications.documentId))
    .leftJoin(documentTagAssignments, eq(documents.id, documentTagAssignments.documentId))
    .where(eq(documents.organizationId, context.organizationId));

    // Include tags filter
    if (input.includeTags?.length) {
      if (input.tagLogic === 'AND') {
        baseQuery = baseQuery.where(
          sql`(
            SELECT COUNT(DISTINCT tag_id)
            FROM document_tag_assignments
            WHERE document_id = documents.id
            AND tag_id = ANY(${input.includeTags})
          ) = ${input.includeTags.length}`
        );
      } else {
        baseQuery = baseQuery.where(
          inArray(documentTagAssignments.tagId, input.includeTags)
        );
      }
    }

    // Exclude tags filter
    if (input.excludeTags?.length) {
      baseQuery = baseQuery.where(
        sql`NOT EXISTS (
          SELECT 1 FROM document_tag_assignments
          WHERE document_id = documents.id
          AND tag_id = ANY(${input.excludeTags})
        )`
      );
    }

    // Document type filter
    if (input.documentTypes?.length) {
      baseQuery = baseQuery.where(
        inArray(documentClassifications.documentType, input.documentTypes)
      );
    }

    // Category filter
    if (input.categoryIds?.length) {
      baseQuery = baseQuery.where(
        inArray(documentClassifications.categoryId, input.categoryIds)
      );
    }

    // Fiscal year filter
    if (input.fiscalYear) {
      baseQuery = baseQuery.where(
        eq(documentClassifications.fiscalYear, input.fiscalYear)
      );
    }

    // Fiscal period filter
    if (input.fiscalPeriod) {
      baseQuery = baseQuery.where(
        eq(documentClassifications.fiscalPeriod, input.fiscalPeriod)
      );
    }

    // Date range filter
    if (input.dateFrom) {
      baseQuery = baseQuery.where(
        gte(documents.createdAt, new Date(input.dateFrom))
      );
    }
    if (input.dateTo) {
      baseQuery = baseQuery.where(
        lte(documents.createdAt, new Date(input.dateTo))
      );
    }

    // Client filter
    if (input.clientId) {
      baseQuery = baseQuery.where(
        eq(documentClassifications.linkedClientId, input.clientId)
      );
    }

    // Review status filter
    if (input.isReviewed !== undefined) {
      baseQuery = baseQuery.where(
        eq(documentClassifications.isReviewed, input.isReviewed)
      );
    }

    // Get total count
    const countResult = await db.select({ count: sql`COUNT(DISTINCT documents.id)` })
      .from(baseQuery.as('subquery'));
    const total = Number(countResult[0]?.count || 0);

    // Get paginated results
    const documents = await baseQuery
      .groupBy(documents.id, documentClassifications.id)
      .orderBy(
        input.sortOrder === 'asc'
          ? asc(input.sortBy === 'name' ? documents.fileName : documents.createdAt)
          : desc(input.sortBy === 'name' ? documents.fileName : documents.createdAt)
      )
      .limit(input.pageSize)
      .offset(offset);

    // Get tags for each document
    const documentIds = documents.map(d => d.document.id);
    const tags = await db.query.documentTagAssignments.findMany({
      where: (a, { inArray }) => inArray(a.documentId, documentIds),
      with: { tag: true }
    });

    const tagsByDocument = new Map<string, any[]>();
    for (const assignment of tags) {
      const existing = tagsByDocument.get(assignment.documentId) || [];
      existing.push(assignment.tag);
      tagsByDocument.set(assignment.documentId, existing);
    }

    const enrichedDocuments = documents.map(d => ({
      ...d.document,
      classification: d.classification,
      tags: tagsByDocument.get(d.document.id) || []
    }));

    return {
      documents: enrichedDocuments,
      total
    };
  }
}
```

---

## 🌐 tRPC Router

```typescript
// src/server/routers/doc/classification.router.ts

import { router, protectedProcedure } from '@/server/trpc';
import {
  createTagSchema,
  updateTagSchema,
  assignTagsSchema,
  removeTagsSchema,
  bulkTagOperationSchema,
  revertBulkOperationSchema,
  createCategorySchema,
  createClassificationRuleSchema,
  updateClassificationRuleSchema,
  classifyDocumentSchema,
  handleSuggestionSchema,
  tagFilterSchema,
  saveFilterPresetSchema,
  searchTagsSchema
} from './schemas';
import { ClassificationService } from '@/services/document/classification.service';
import { z } from 'zod';

export const classificationRouter = router({

  // === Tags ===

  createTag: protectedProcedure
    .input(createTagSchema)
    .mutation(async ({ input, ctx }) => {
      return ClassificationService.createTag(input, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
    }),

  updateTag: protectedProcedure
    .input(updateTagSchema)
    .mutation(async ({ input, ctx }) => {
      return ClassificationService.updateTag(input, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
    }),

  deleteTag: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return ClassificationService.deleteTag(input.id, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
    }),

  searchTags: protectedProcedure
    .input(searchTagsSchema)
    .query(async ({ input, ctx }) => {
      return ClassificationService.searchTags(input, {
        organizationId: ctx.user.organizationId
      });
    }),

  getTagGroups: protectedProcedure
    .query(async ({ ctx }) => {
      return ClassificationService.getTagGroups({
        organizationId: ctx.user.organizationId
      });
    }),

  // === Tag Assignments ===

  assignTags: protectedProcedure
    .input(assignTagsSchema)
    .mutation(async ({ input, ctx }) => {
      await ClassificationService.assignTags(input, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
      return { success: true };
    }),

  removeTags: protectedProcedure
    .input(removeTagsSchema)
    .mutation(async ({ input, ctx }) => {
      await ClassificationService.removeTags(input, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
      return { success: true };
    }),

  getDocumentTags: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return ClassificationService.getDocumentTags(input.documentId, {
        organizationId: ctx.user.organizationId
      });
    }),

  // === Bulk Operations ===

  bulkTagOperation: protectedProcedure
    .input(bulkTagOperationSchema)
    .mutation(async ({ input, ctx }) => {
      return ClassificationService.bulkTagOperation(input, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
    }),

  revertBulkOperation: protectedProcedure
    .input(revertBulkOperationSchema)
    .mutation(async ({ input, ctx }) => {
      await ClassificationService.revertBulkOperation(input.operationId, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
      return { success: true };
    }),

  getBulkOperations: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().min(1).max(50).default(20)
    }))
    .query(async ({ input, ctx }) => {
      return ClassificationService.getBulkOperations(input, {
        organizationId: ctx.user.organizationId
      });
    }),

  // === Categories ===

  createCategory: protectedProcedure
    .input(createCategorySchema)
    .mutation(async ({ input, ctx }) => {
      return ClassificationService.createCategory(input, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
    }),

  getCategories: protectedProcedure
    .query(async ({ ctx }) => {
      return ClassificationService.getCategories({
        organizationId: ctx.user.organizationId
      });
    }),

  // === Classification ===

  classifyDocument: protectedProcedure
    .input(classifyDocumentSchema)
    .mutation(async ({ input, ctx }) => {
      return ClassificationService.manualClassification(input, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
    }),

  getClassification: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return ClassificationService.getClassification(input.documentId, {
        organizationId: ctx.user.organizationId
      });
    }),

  reclassifyDocument: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return ClassificationService.reclassifyDocument(input.documentId, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
    }),

  // === Classification Rules ===

  createRule: protectedProcedure
    .input(createClassificationRuleSchema)
    .mutation(async ({ input, ctx }) => {
      return ClassificationService.createRule(input, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
    }),

  updateRule: protectedProcedure
    .input(updateClassificationRuleSchema)
    .mutation(async ({ input, ctx }) => {
      return ClassificationService.updateRule(input, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
    }),

  deleteRule: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return ClassificationService.deleteRule(input.id, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
    }),

  getRules: protectedProcedure
    .query(async ({ ctx }) => {
      return ClassificationService.getRules({
        organizationId: ctx.user.organizationId
      });
    }),

  testRule: protectedProcedure
    .input(z.object({
      ruleId: z.string().uuid(),
      documentId: z.string().uuid()
    }))
    .query(async ({ input, ctx }) => {
      return ClassificationService.testRule(input.ruleId, input.documentId, {
        organizationId: ctx.user.organizationId
      });
    }),

  // === Tag Suggestions ===

  getSuggestions: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return ClassificationService.getTagSuggestions(input.documentId, {
        organizationId: ctx.user.organizationId
      });
    }),

  handleSuggestion: protectedProcedure
    .input(handleSuggestionSchema)
    .mutation(async ({ input, ctx }) => {
      return ClassificationService.handleSuggestion(input, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
    }),

  // === Filtering ===

  filterByTags: protectedProcedure
    .input(tagFilterSchema)
    .query(async ({ input, ctx }) => {
      return ClassificationService.filterByTags(input, {
        organizationId: ctx.user.organizationId
      });
    }),

  saveFilterPreset: protectedProcedure
    .input(saveFilterPresetSchema)
    .mutation(async ({ input, ctx }) => {
      return ClassificationService.saveFilterPreset(input, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
    }),

  getFilterPresets: protectedProcedure
    .query(async ({ ctx }) => {
      return ClassificationService.getFilterPresets({
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
    }),

  deleteFilterPreset: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return ClassificationService.deleteFilterPreset(input.id, {
        userId: ctx.user.id,
        organizationId: ctx.user.organizationId
      });
    }),

  // === Statistics ===

  getTagStatistics: protectedProcedure
    .query(async ({ ctx }) => {
      return ClassificationService.getTagStatistics({
        organizationId: ctx.user.organizationId
      });
    }),

  getClassificationStatistics: protectedProcedure
    .input(z.object({
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    }))
    .query(async ({ input, ctx }) => {
      return ClassificationService.getClassificationStatistics(input, {
        organizationId: ctx.user.organizationId
      });
    })
});
```

---

## 🧪 Test Specifications

### Unit Tests

```typescript
// __tests__/services/classification.service.test.ts

import { ClassificationService } from '@/services/document/classification.service';

describe('ClassificationService', () => {

  describe('Pattern-based Classification', () => {
    it('should classify Polish invoice', () => {
      const text = 'FAKTURA VAT nr FV/2024/001\nNIP: 1234567890\nKwota netto: 1000 zł';
      const result = ClassificationService['classifyByPatterns'](text);

      expect(result.documentType).toBe('INVOICE');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify Polish receipt', () => {
      const text = 'PARAGON FISKALNY\nNr unikatowy: ABC123456\nPTU A 23%';
      const result = ClassificationService['classifyByPatterns'](text);

      expect(result.documentType).toBe('RECEIPT');
    });

    it('should classify employment contract', () => {
      const text = 'UMOWA O PRACĘ zawarta w dniu 01.01.2024\nStrony umowy:\nPracodawca:';
      const result = ClassificationService['classifyByPatterns'](text);

      expect(result.documentType).toBe('CONTRACT');
      expect(result.documentSubtype).toBe('EMPLOYMENT');
    });

    it('should classify bank statement', () => {
      const text = 'WYCIĄG BANKOWY\nNumer rachunku: PL12345678901234567890123456\nSaldo początkowe:';
      const result = ClassificationService['classifyByPatterns'](text);

      expect(result.documentType).toBe('BANK_STATEMENT');
    });

    it('should return OTHER for unrecognized documents', () => {
      const text = 'Random text without any document markers';
      const result = ClassificationService['classifyByPatterns'](text);

      expect(result.documentType).toBe('OTHER');
      expect(result.confidence).toBeLessThan(0.3);
    });

    it('should detect invoice subtype CORRECTION', () => {
      const text = 'FAKTURA KORYGUJĄCA nr FK/2024/001';
      const result = ClassificationService['classifyByPatterns'](text);

      expect(result.documentType).toBe('INVOICE');
      expect(result.documentSubtype).toBe('CORRECTION');
    });
  });

  describe('Fiscal Period Detection', () => {
    it('should extract fiscal period from date', () => {
      const extractedData = {
        document: { issueDate: '2024-03-15' }
      };
      const result = ClassificationService['determineFiscalPeriod'](extractedData, '');

      expect(result.year).toBe(2024);
      expect(result.period).toBe('Q1-2024');
    });

    it('should detect Polish month names', () => {
      const text = 'Faktura z marca 2024';
      const result = ClassificationService['determineFiscalPeriod']({}, text);

      expect(result.period).toContain('Q1');
    });

    it('should handle missing dates', () => {
      const result = ClassificationService['determineFiscalPeriod']({}, 'No date here');

      expect(result.year).toBeNull();
      expect(result.period).toBeNull();
    });
  });

  describe('Retention Date Calculation', () => {
    it('should calculate 5-year retention for invoices', () => {
      const result = ClassificationService['calculateRetentionDate']('INVOICE');
      const expectedYear = new Date().getFullYear() + 5;

      expect(result.getFullYear()).toBe(expectedYear);
    });

    it('should calculate 50-year retention for payroll', () => {
      const result = ClassificationService['calculateRetentionDate']('PAYROLL');
      const expectedYear = new Date().getFullYear() + 50;

      expect(result.getFullYear()).toBe(expectedYear);
    });
  });

  describe('Rule Condition Evaluation', () => {
    it('should evaluate equals condition', () => {
      const result = ClassificationService['evaluateCondition']('equals', 'INVOICE', 'INVOICE');
      expect(result).toBe(true);
    });

    it('should evaluate contains condition', () => {
      const result = ClassificationService['evaluateCondition']('contains', 'some text here', 'text');
      expect(result).toBe(true);
    });

    it('should evaluate greaterThan condition', () => {
      const result = ClassificationService['evaluateCondition']('greaterThan', 15000, 10000);
      expect(result).toBe(true);
    });

    it('should evaluate between condition', () => {
      const result = ClassificationService['evaluateCondition']('between', 5000, { min: 1000, max: 10000 });
      expect(result).toBe(true);
    });

    it('should evaluate in condition', () => {
      const result = ClassificationService['evaluateCondition']('in', 'INVOICE', ['INVOICE', 'RECEIPT']);
      expect(result).toBe(true);
    });

    it('should evaluate regex matches condition', () => {
      const result = ClassificationService['evaluateCondition']('matches', 'FV/2024/001', 'FV/\\d{4}/\\d+');
      expect(result).toBe(true);
    });
  });

  describe('Tag Slug Generation', () => {
    it('should generate slug from Polish name', () => {
      const slug = slugify('Faktura zakupowa', { lower: true, strict: true });
      expect(slug).toBe('faktura-zakupowa');
    });

    it('should handle Polish diacritics', () => {
      const slug = slugify('Świadczenie usług', { lower: true, strict: true });
      expect(slug).toBe('swiadczenie-uslug');
    });
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/classification.test.ts

import { db } from '@/lib/db';
import { ClassificationService } from '@/services/document/classification.service';

describe('Classification Integration', () => {
  const testOrganizationId = 'test-org-id';
  const testUserId = 'test-user-id';

  beforeAll(async () => {
    // Setup test data
    await db.insert('organizations').values({
      id: testOrganizationId,
      name: 'Test Organization'
    });

    await db.insert('users').values({
      id: testUserId,
      organizationId: testOrganizationId,
      email: 'test@example.com'
    });
  });

  afterAll(async () => {
    await db.delete('document_tags').where(eq('organizationId', testOrganizationId));
    await db.delete('users').where(eq('id', testUserId));
    await db.delete('organizations').where(eq('id', testOrganizationId));
  });

  describe('Tag Management', () => {
    it('should create a new tag', async () => {
      const tag = await ClassificationService.createTag({
        name: 'Faktura VAT',
        description: 'Faktury VAT od dostawców',
        color: '#3B82F6',
        tagGroup: 'Dokumenty księgowe'
      }, {
        userId: testUserId,
        organizationId: testOrganizationId
      });

      expect(tag.id).toBeDefined();
      expect(tag.slug).toBe('faktura-vat');
      expect(tag.organizationId).toBe(testOrganizationId);
    });

    it('should prevent duplicate tag names', async () => {
      await ClassificationService.createTag({
        name: 'Test Tag',
        color: '#EF4444'
      }, {
        userId: testUserId,
        organizationId: testOrganizationId
      });

      await expect(
        ClassificationService.createTag({
          name: 'Test Tag',
          color: '#22C55E'
        }, {
          userId: testUserId,
          organizationId: testOrganizationId
        })
      ).rejects.toThrow('Tag o tej nazwie już istnieje');
    });

    it('should search tags', async () => {
      const result = await ClassificationService.searchTags({
        query: 'faktura',
        page: 1,
        pageSize: 10
      }, {
        organizationId: testOrganizationId
      });

      expect(result.tags.length).toBeGreaterThan(0);
      expect(result.tags[0].name.toLowerCase()).toContain('faktura');
    });
  });

  describe('Bulk Operations', () => {
    let documentIds: string[];
    let tagIds: string[];

    beforeAll(async () => {
      // Create test documents
      const docs = await db.insert('documents').values([
        { organizationId: testOrganizationId, fileName: 'doc1.pdf' },
        { organizationId: testOrganizationId, fileName: 'doc2.pdf' },
        { organizationId: testOrganizationId, fileName: 'doc3.pdf' }
      ]).returning();
      documentIds = docs.map(d => d.id);

      // Create test tags
      const tags = await db.insert('document_tags').values([
        { organizationId: testOrganizationId, name: 'Bulk Tag 1', slug: 'bulk-tag-1', color: '#EF4444' },
        { organizationId: testOrganizationId, name: 'Bulk Tag 2', slug: 'bulk-tag-2', color: '#22C55E' }
      ]).returning();
      tagIds = tags.map(t => t.id);
    });

    it('should add tags in bulk', async () => {
      const result = await ClassificationService.bulkTagOperation({
        documentIds,
        operation: 'ADD',
        tagsToAdd: tagIds
      }, {
        userId: testUserId,
        organizationId: testOrganizationId
      });

      expect(result.operationId).toBeDefined();
      expect(result.affectedCount).toBe(3);

      // Verify tags were added
      const assignments = await db.query.documentTagAssignments.findMany({
        where: (a, { inArray }) => inArray(a.documentId, documentIds)
      });

      expect(assignments.length).toBe(6); // 3 docs × 2 tags
    });

    it('should revert bulk operation', async () => {
      const operation = await ClassificationService.bulkTagOperation({
        documentIds: documentIds.slice(0, 2),
        operation: 'ADD',
        tagsToAdd: [tagIds[0]]
      }, {
        userId: testUserId,
        organizationId: testOrganizationId
      });

      await ClassificationService.revertBulkOperation(operation.operationId, {
        userId: testUserId,
        organizationId: testOrganizationId
      });

      const revertedOp = await db.query.bulkTagOperations.findFirst({
        where: (o, { eq }) => eq(o.id, operation.operationId)
      });

      expect(revertedOp?.isReverted).toBe(true);
    });
  });

  describe('Classification Rules', () => {
    let ruleId: string;

    it('should create classification rule', async () => {
      const rule = await ClassificationService.createRule({
        name: 'High Value Invoices',
        description: 'Auto-tag invoices over 10,000 PLN',
        priority: 10,
        conditions: [
          { field: 'documentType', operator: 'equals', value: 'INVOICE' },
          { field: 'amountGross', operator: 'greaterThan', value: 10000 }
        ],
        conditionsLogic: 'AND',
        actions: [
          { type: 'addTags', value: ['high-value-tag-id'] }
        ]
      }, {
        userId: testUserId,
        organizationId: testOrganizationId
      });

      expect(rule.id).toBeDefined();
      ruleId = rule.id;
    });

    it('should evaluate rule conditions correctly', async () => {
      const testResult = await ClassificationService.testRule(
        ruleId,
        'test-document-with-high-amount',
        { organizationId: testOrganizationId }
      );

      expect(testResult.matches).toBeDefined();
    });
  });

  describe('RLS Policies', () => {
    it('should isolate tags by organization', async () => {
      await db.execute(`SET app.current_organization_id = 'other-org-id'`);

      const tags = await db.query.documentTags.findMany({});

      expect(tags.length).toBe(0);

      await db.execute(`SET app.current_organization_id = '${testOrganizationId}'`);
    });
  });
});
```

### E2E Tests

```typescript
// e2e/classification.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Document Classification & Tagging', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'accountant@test.pl');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should display document classification', async ({ page }) => {
    await page.goto('/documents');
    await page.click('[data-testid="document-row"]:first-child');

    // Check classification section
    await expect(page.locator('[data-testid="document-type"]')).not.toBeEmpty();
    await expect(page.locator('[data-testid="classification-confidence"]')).toBeVisible();
    await expect(page.locator('[data-testid="fiscal-period"]')).toBeVisible();
  });

  test('should create new tag', async ({ page }) => {
    await page.goto('/settings/tags');
    await page.click('[data-testid="create-tag-button"]');

    await page.fill('[name="name"]', 'Nowy Tag Testowy');
    await page.fill('[name="description"]', 'Opis tagu testowego');
    await page.click('[data-testid="color-picker"] [data-color="#3B82F6"]');
    await page.click('[data-testid="save-tag-button"]');

    await expect(page.locator('[data-testid="toast-success"]')).toContainText('Tag utworzony');
    await expect(page.locator('[data-testid="tag-list"]')).toContainText('Nowy Tag Testowy');
  });

  test('should assign tags to document', async ({ page }) => {
    await page.goto('/documents');
    await page.click('[data-testid="document-row"]:first-child');

    await page.click('[data-testid="add-tag-button"]');
    await page.click('[data-testid="tag-option"]:first-child');
    await page.click('[data-testid="confirm-tags"]');

    await expect(page.locator('[data-testid="document-tags"]')).not.toBeEmpty();
  });

  test('should perform bulk tagging', async ({ page }) => {
    await page.goto('/documents');

    // Select multiple documents
    await page.click('[data-testid="select-all-checkbox"]');
    await page.click('[data-testid="bulk-actions-button"]');
    await page.click('[data-testid="bulk-tag-option"]');

    // Select tags
    await page.click('[data-testid="tag-option"]:first-child');
    await page.click('[data-testid="apply-bulk-tags"]');

    await expect(page.locator('[data-testid="toast-success"]')).toContainText('Tagi dodane');
  });

  test('should filter documents by tags', async ({ page }) => {
    await page.goto('/documents');

    await page.click('[data-testid="tag-filter-dropdown"]');
    await page.click('[data-testid="tag-filter-option"]:first-child');
    await page.click('[data-testid="apply-filters"]');

    // Verify filtered results
    await expect(page.locator('[data-testid="document-count"]')).not.toContainText('0');
    await expect(page.locator('[data-testid="active-filter-tag"]')).toBeVisible();
  });

  test('should accept tag suggestions', async ({ page }) => {
    await page.goto('/documents');
    await page.click('[data-testid="document-row"]:first-child');

    // Find suggestion
    const suggestion = page.locator('[data-testid="tag-suggestion"]').first();
    await expect(suggestion).toBeVisible();

    await suggestion.locator('[data-testid="accept-suggestion"]').click();

    await expect(page.locator('[data-testid="document-tags"]')).not.toBeEmpty();
  });

  test('should revert bulk operation', async ({ page }) => {
    await page.goto('/documents/bulk-operations');

    const recentOperation = page.locator('[data-testid="bulk-operation-row"]').first();
    await expect(recentOperation.locator('[data-testid="revert-button"]')).toBeVisible();

    await recentOperation.locator('[data-testid="revert-button"]').click();
    await page.click('[data-testid="confirm-revert"]');

    await expect(page.locator('[data-testid="toast-success"]')).toContainText('Operacja cofnięta');
  });

  test('should create classification rule', async ({ page }) => {
    await page.goto('/settings/classification-rules');
    await page.click('[data-testid="create-rule-button"]');

    await page.fill('[name="name"]', 'Duże faktury');
    await page.fill('[name="description"]', 'Automatyczne tagowanie dużych faktur');

    // Add condition
    await page.selectOption('[name="conditions.0.field"]', 'amountGross');
    await page.selectOption('[name="conditions.0.operator"]', 'greaterThan');
    await page.fill('[name="conditions.0.value"]', '10000');

    // Add action
    await page.selectOption('[name="actions.0.type"]', 'addTags');
    await page.click('[data-testid="tag-selector"] [data-testid="tag-option"]:first-child');

    await page.click('[data-testid="save-rule-button"]');

    await expect(page.locator('[data-testid="toast-success"]')).toContainText('Reguła utworzona');
  });
});
```

---

## 🔒 Security Checklist

- [x] Organization isolation via RLS policies
- [x] User authentication required for all operations
- [x] Tag visibility controls (organization/personal/system)
- [x] Audit logging for all tag and classification changes
- [x] Bulk operation revert with 30-minute window
- [x] Classification rules validated before execution
- [x] Rate limiting on AI classification calls
- [x] Input validation with Zod schemas
- [x] Slug generation prevents XSS via strict mode

---

## 📊 Audit Events

| Event | Description | Data Captured |
|-------|-------------|---------------|
| `DOCUMENT_CLASSIFIED` | Document classification completed | documentType, confidence, source |
| `TAG_CREATED` | New tag created | name, color, visibility |
| `TAG_UPDATED` | Tag modified | changes |
| `TAG_DELETED` | Tag removed | tagId |
| `TAGS_ASSIGNED` | Tags assigned to document | documentId, tagIds, source |
| `TAGS_REMOVED` | Tags removed from document | documentId, tagIds |
| `BULK_TAG_OPERATION` | Bulk tag operation executed | operation, documentCount, tags |
| `BULK_OPERATION_REVERTED` | Bulk operation reverted | operationId |
| `CLASSIFICATION_RULE_CREATED` | New rule created | ruleName, conditions, actions |
| `CLASSIFICATION_RULE_MATCHED` | Rule matched document | ruleId, documentId |

---

## 📝 Implementation Notes

### AI Classification Strategy
- Pattern matching first for speed (<10ms)
- AI fallback for uncertain cases (<3s)
- Rules override both AI and pattern matching
- Learning from user corrections improves accuracy

### Tag Management Best Practices
- Max 1000 tags per organization
- Tag groups for organization (max 50 groups)
- Hierarchical tags (max 3 levels deep)
- Color palette limited for consistency

### Performance Optimization
- Tag search with trigram index
- Materialized view for tag statistics
- Redis caching for frequent tag queries
- Batch inserts for bulk operations

### Polish Accounting Context
- Default retention periods per Polish law
- Fiscal year/period auto-detection
- GTU code recognition from invoices
- Client linking via NIP matching

---

## 🔗 Dependencies

### Depends On
- **DOC-004**: OCR Processing Engine (provides text)
- **DOC-005**: AI Data Extraction (provides structured data)
- **AIM**: User authentication and organization context

### Depended By
- **DOC-007**: Workflow Integration (triggers by classification)
- **DOC-008**: Full-Text Search (uses tags as filters)

---

*Story last updated: December 2024*
