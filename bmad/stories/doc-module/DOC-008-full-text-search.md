# DOC-008: Full-Text Search

> **Story ID**: DOC-008
> **Epic**: Document Intelligence Module (DOC)
> **Priority**: P0 (Critical)
> **Story Points**: 8
> **Sprint**: Week 15
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant,
**I want to** search document content using full-text search,
**So that** I can quickly find any document by its content, regardless of filename or metadata.

---

## Business Context

### Problem Statement
Accountants managing thousands of documents need powerful search capabilities to quickly locate specific invoices, contracts, or receipts. Traditional filename or tag-based search is insufficient when the exact location or naming convention is unknown.

### Business Value
- **Productivity**: Find any document in <200ms instead of manual browsing
- **Accuracy**: Full-text search finds documents traditional search misses
- **Polish Support**: Native Polish language analysis with diacritics, stemming, and synonyms
- **Discovery**: Faceted search helps discover related documents
- **Efficiency**: Saved searches and suggestions reduce repetitive queries

### Success Metrics
- Search response time <200ms for 95th percentile
- >95% search precision for exact queries
- >85% recall for fuzzy/partial queries
- <50ms autocomplete suggestions
- Polish diacritics properly normalized (ą→a, ę→e, etc.)

---

## Acceptance Criteria

### Scenario 1: Basic Full-Text Search
```gherkin
Given I am an authenticated accountant
And my organization has 5000 indexed documents
When I search for "faktura VAT 2024"
Then I receive search results within 200ms
And results are ranked by relevance score
And each result shows document title, type, date, and relevance percentage
And search terms are highlighted in the result snippets
```

### Scenario 2: Polish Language Analysis
```gherkin
Given I am searching for documents in Polish
When I search for "faktury" (plural form)
Then I find documents containing "faktura" (singular form)
And when I search for "ksiegowy"
Then I find documents containing "księgowy" (with diacritics)
And when I search for "zamowienie"
Then I also find "zamówienie" and "zamówienia"
```

### Scenario 3: Faceted Search with Filters
```gherkin
Given I am on the document search page
When I search for "umowa"
Then I see faceted filters for:
  | Facet         | Example Values                    |
  | Document Type | Invoice, Contract, Receipt        |
  | Date Range    | Last 7 days, Last month, Custom   |
  | Client        | List of matching client names     |
  | VAT Rate      | 23%, 8%, 5%, 0%, zw              |
  | Amount Range  | 0-1000, 1000-10000, 10000+       |
And when I select "Contract" type filter
Then results are filtered to only show contracts
And facet counts update to reflect current filter state
```

### Scenario 4: Fuzzy Matching and Typo Tolerance
```gherkin
Given I am searching with potential typos
When I search for "fkatura" (misspelled)
Then I receive suggestions: "Did you mean: faktura?"
And when I search for "Jan Kowalski" with fuzzy mode enabled
Then I find documents containing "Jan Kowalsky" or "Jan Kowalki"
And fuzzy matches are clearly indicated as approximate
```

### Scenario 5: Search Highlighting
```gherkin
Given I am viewing search results
When I search for "NIP 1234567890"
Then matching text is highlighted in result snippets
And the snippet shows context around the match (±50 characters)
And multiple matches in the same document are all highlighted
And highlights use <mark> tags for accessibility
```

### Scenario 6: Saved Searches
```gherkin
Given I frequently search for unpaid invoices
When I perform search with query "faktura status:unpaid"
And I click "Save Search"
And I enter name "Niezapłacone faktury"
And I optionally enable notifications for new matches
Then the search is saved to my profile
And I can access it from "Saved Searches" dropdown
And when new documents match my saved search
Then I receive a notification (if enabled)
```

### Scenario 7: Search Suggestions and Autocomplete
```gherkin
Given I am typing in the search box
When I type "fakt"
Then I see autocomplete suggestions within 50ms:
  | Suggestion Type   | Example                          |
  | Query Completion  | "faktura", "faktura VAT"         |
  | Recent Searches   | "faktura kosztowa grudzień"      |
  | Client Names      | "Faktor sp. z o.o."              |
  | NIP Patterns      | "5271234567" (if partial match)  |
And suggestions update as I continue typing
And I can navigate suggestions with keyboard arrows
And pressing Enter executes selected suggestion
```

### Scenario 8: Advanced Query Syntax
```gherkin
Given I am performing an advanced search
When I use advanced query operators:
  | Query                              | Expected Behavior                           |
  | "umowa najmu"                      | Exact phrase match                          |
  | faktura AND client:ABC             | Boolean AND with field filter               |
  | faktura OR rachunek                | Boolean OR (either term)                    |
  | faktura NOT proforma               | Exclude documents with proforma             |
  | amount:>10000                      | Numeric range filter                        |
  | date:[2024-01-01 TO 2024-12-31]    | Date range filter                           |
  | client:ABC*                        | Wildcard matching                           |
  | vat_rate:23                        | Exact field match                           |
Then search correctly interprets and applies all operators
And syntax errors show helpful error messages
```

---

## Technical Specification

### Elasticsearch Index Mapping

```json
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "analysis": {
      "filter": {
        "polish_stop": {
          "type": "stop",
          "stopwords": "_polish_"
        },
        "polish_stemmer": {
          "type": "stemmer",
          "language": "polish"
        },
        "polish_synonym": {
          "type": "synonym",
          "synonyms": [
            "faktura,rachunek",
            "klient,kontrahent",
            "umowa,kontrakt",
            "vat,podatek od towarów i usług",
            "nip,numer identyfikacji podatkowej",
            "regon,rejestr gospodarki narodowej"
          ]
        },
        "ascii_folding": {
          "type": "asciifolding",
          "preserve_original": true
        },
        "edge_ngram": {
          "type": "edge_ngram",
          "min_gram": 2,
          "max_gram": 20
        }
      },
      "analyzer": {
        "polish_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": [
            "lowercase",
            "ascii_folding",
            "polish_stop",
            "polish_stemmer",
            "polish_synonym"
          ]
        },
        "polish_search_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": [
            "lowercase",
            "ascii_folding",
            "polish_stop",
            "polish_stemmer"
          ]
        },
        "autocomplete_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": [
            "lowercase",
            "ascii_folding",
            "edge_ngram"
          ]
        },
        "autocomplete_search": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": [
            "lowercase",
            "ascii_folding"
          ]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "organization_id": { "type": "keyword" },
      "document_type": { "type": "keyword" },
      "status": { "type": "keyword" },
      "title": {
        "type": "text",
        "analyzer": "polish_analyzer",
        "search_analyzer": "polish_search_analyzer",
        "fields": {
          "keyword": { "type": "keyword" },
          "autocomplete": {
            "type": "text",
            "analyzer": "autocomplete_analyzer",
            "search_analyzer": "autocomplete_search"
          }
        }
      },
      "content": {
        "type": "text",
        "analyzer": "polish_analyzer",
        "search_analyzer": "polish_search_analyzer",
        "term_vector": "with_positions_offsets"
      },
      "ocr_text": {
        "type": "text",
        "analyzer": "polish_analyzer",
        "search_analyzer": "polish_search_analyzer",
        "term_vector": "with_positions_offsets"
      },
      "extracted_data": {
        "type": "object",
        "properties": {
          "seller_name": {
            "type": "text",
            "analyzer": "polish_analyzer",
            "fields": {
              "keyword": { "type": "keyword" },
              "autocomplete": {
                "type": "text",
                "analyzer": "autocomplete_analyzer",
                "search_analyzer": "autocomplete_search"
              }
            }
          },
          "seller_nip": { "type": "keyword" },
          "buyer_name": {
            "type": "text",
            "analyzer": "polish_analyzer",
            "fields": { "keyword": { "type": "keyword" } }
          },
          "buyer_nip": { "type": "keyword" },
          "invoice_number": {
            "type": "keyword",
            "fields": {
              "text": { "type": "text" }
            }
          },
          "issue_date": { "type": "date" },
          "sale_date": { "type": "date" },
          "due_date": { "type": "date" },
          "net_amount": { "type": "double" },
          "vat_amount": { "type": "double" },
          "gross_amount": { "type": "double" },
          "vat_rate": { "type": "keyword" },
          "currency": { "type": "keyword" },
          "payment_status": { "type": "keyword" }
        }
      },
      "client_id": { "type": "keyword" },
      "client_name": {
        "type": "text",
        "analyzer": "polish_analyzer",
        "fields": {
          "keyword": { "type": "keyword" },
          "autocomplete": {
            "type": "text",
            "analyzer": "autocomplete_analyzer",
            "search_analyzer": "autocomplete_search"
          }
        }
      },
      "tags": { "type": "keyword" },
      "file_name": {
        "type": "text",
        "fields": { "keyword": { "type": "keyword" } }
      },
      "file_type": { "type": "keyword" },
      "file_size": { "type": "long" },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" },
      "uploaded_by": { "type": "keyword" },
      "fiscal_year": { "type": "integer" },
      "fiscal_month": { "type": "integer" },
      "suggest": {
        "type": "completion",
        "analyzer": "polish_analyzer",
        "preserve_separators": true,
        "preserve_position_increments": true,
        "max_input_length": 50,
        "contexts": [
          {
            "name": "organization",
            "type": "category",
            "path": "organization_id"
          }
        ]
      }
    }
  }
}
```

### Database Schema (PostgreSQL)

```sql
-- Saved searches table
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name VARCHAR(100) NOT NULL,
  description TEXT,
  query_string TEXT NOT NULL,
  filters JSONB DEFAULT '{}',

  -- Notification settings
  notifications_enabled BOOLEAN DEFAULT FALSE,
  notification_frequency VARCHAR(20) DEFAULT 'daily', -- 'immediate', 'daily', 'weekly'
  last_notification_at TIMESTAMPTZ,
  last_result_count INTEGER DEFAULT 0,

  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Metadata
  is_shared BOOLEAN DEFAULT FALSE, -- Organization-wide sharing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_saved_search_name UNIQUE (organization_id, user_id, name)
);

-- Search history table
CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  query_string TEXT NOT NULL,
  filters JSONB DEFAULT '{}',

  -- Results metadata
  result_count INTEGER NOT NULL,
  took_ms INTEGER NOT NULL, -- Elasticsearch query time

  -- Context
  session_id UUID,
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search suggestions table (pre-computed)
CREATE TABLE search_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  suggestion_type VARCHAR(20) NOT NULL, -- 'query', 'client', 'nip', 'term'
  suggestion_text TEXT NOT NULL,
  display_text TEXT NOT NULL,

  -- Popularity and relevance
  weight INTEGER DEFAULT 1,
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_suggestion UNIQUE (organization_id, suggestion_type, suggestion_text)
);

-- Search analytics table
CREATE TABLE search_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Aggregated metrics
  total_searches INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  avg_response_time_ms DOUBLE PRECISION,
  zero_result_searches INTEGER DEFAULT 0,

  -- Top queries
  top_queries JSONB DEFAULT '[]',
  top_filters JSONB DEFAULT '[]',
  top_no_results_queries JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_saved_searches_user ON saved_searches(user_id, organization_id);
CREATE INDEX idx_saved_searches_notifications ON saved_searches(notifications_enabled, notification_frequency)
  WHERE notifications_enabled = TRUE;

CREATE INDEX idx_search_history_user ON search_history(user_id, created_at DESC);
CREATE INDEX idx_search_history_query ON search_history(organization_id, query_string);
CREATE INDEX idx_search_history_created ON search_history(organization_id, created_at DESC);

CREATE INDEX idx_search_suggestions_org ON search_suggestions(organization_id, suggestion_type, is_active);
CREATE INDEX idx_search_suggestions_text ON search_suggestions(organization_id, suggestion_text)
  WHERE is_active = TRUE;

CREATE INDEX idx_search_analytics_period ON search_analytics(organization_id, period_start, period_end);

-- RLS Policies
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_searches_org_isolation ON saved_searches
  FOR ALL USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY search_history_org_isolation ON search_history
  FOR ALL USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY search_suggestions_org_isolation ON search_suggestions
  FOR ALL USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY search_analytics_org_isolation ON search_analytics
  FOR ALL USING (organization_id = current_setting('app.organization_id')::UUID);

-- Function to update search suggestions from history
CREATE OR REPLACE FUNCTION update_search_suggestions()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert suggestion based on search query
  INSERT INTO search_suggestions (organization_id, suggestion_type, suggestion_text, display_text, weight, use_count, last_used_at)
  VALUES (NEW.organization_id, 'query', LOWER(NEW.query_string), NEW.query_string, 1, 1, NOW())
  ON CONFLICT (organization_id, suggestion_type, suggestion_text)
  DO UPDATE SET
    use_count = search_suggestions.use_count + 1,
    last_used_at = NOW(),
    weight = search_suggestions.weight + 1,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER search_history_update_suggestions
  AFTER INSERT ON search_history
  FOR EACH ROW
  EXECUTE FUNCTION update_search_suggestions();
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Document type enum
export const documentTypeSchema = z.enum([
  'INVOICE',
  'RECEIPT',
  'CONTRACT',
  'BANK_STATEMENT',
  'TAX_DECLARATION',
  'PAYROLL',
  'CORRESPONDENCE',
  'OTHER'
]);

// Search sort options
export const searchSortSchema = z.enum([
  'relevance',
  'date_desc',
  'date_asc',
  'amount_desc',
  'amount_asc',
  'title_asc',
  'title_desc'
]);

// Date range filter
export const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  preset: z.enum([
    'today',
    'yesterday',
    'last_7_days',
    'last_30_days',
    'this_month',
    'last_month',
    'this_quarter',
    'last_quarter',
    'this_year',
    'last_year',
    'custom'
  ]).optional()
});

// Amount range filter
export const amountRangeSchema = z.object({
  min: z.number().nonnegative().optional(),
  max: z.number().positive().optional(),
  currency: z.string().length(3).default('PLN')
}).refine(
  data => !data.min || !data.max || data.min <= data.max,
  { message: 'min must be less than or equal to max' }
);

// Search filters schema
export const searchFiltersSchema = z.object({
  document_types: z.array(documentTypeSchema).optional(),
  date_range: dateRangeSchema.optional(),
  amount_range: amountRangeSchema.optional(),
  vat_rates: z.array(z.string()).optional(),
  client_ids: z.array(z.string().uuid()).optional(),
  tags: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  uploaded_by: z.array(z.string().uuid()).optional(),
  fiscal_year: z.number().int().min(2000).max(2100).optional(),
  fiscal_month: z.number().int().min(1).max(12).optional(),
  has_extracted_data: z.boolean().optional(),
  nip: z.string().regex(/^\d{10}$/).optional(),
  invoice_number: z.string().optional()
});

// Main search query schema
export const searchQuerySchema = z.object({
  query: z.string().min(1).max(500),
  filters: searchFiltersSchema.optional(),
  sort: searchSortSchema.default('relevance'),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(100).default(20),

  // Search options
  fuzzy: z.boolean().default(false),
  fuzzy_max_edits: z.number().int().min(1).max(2).default(1),
  highlight: z.boolean().default(true),
  highlight_fragment_size: z.number().int().min(50).max(500).default(150),
  highlight_number_of_fragments: z.number().int().min(1).max(10).default(3),

  // Facets
  include_facets: z.boolean().default(true),
  facet_size: z.number().int().min(5).max(50).default(10),

  // Advanced options
  explain: z.boolean().default(false), // Include relevance explanation
  track_total_hits: z.boolean().default(true)
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

// Search result item schema
export const searchResultItemSchema = z.object({
  id: z.string().uuid(),
  document_type: documentTypeSchema,
  title: z.string(),
  file_name: z.string(),
  file_type: z.string(),
  file_size: z.number(),

  // Extracted data highlights
  seller_name: z.string().optional(),
  seller_nip: z.string().optional(),
  buyer_name: z.string().optional(),
  buyer_nip: z.string().optional(),
  invoice_number: z.string().optional(),
  gross_amount: z.number().optional(),
  vat_rate: z.string().optional(),

  // Dates
  issue_date: z.string().datetime().optional(),
  created_at: z.string().datetime(),

  // Client info
  client_id: z.string().uuid().optional(),
  client_name: z.string().optional(),

  // Tags
  tags: z.array(z.string()),

  // Search metadata
  score: z.number(),
  highlights: z.record(z.array(z.string())).optional(),
  explanation: z.any().optional()
});

// Facet value schema
export const facetValueSchema = z.object({
  key: z.string(),
  doc_count: z.number().int(),
  selected: z.boolean().default(false)
});

// Facets schema
export const facetsSchema = z.object({
  document_types: z.array(facetValueSchema),
  vat_rates: z.array(facetValueSchema),
  clients: z.array(facetValueSchema),
  tags: z.array(facetValueSchema),
  fiscal_years: z.array(facetValueSchema),
  date_histogram: z.array(z.object({
    key: z.string(), // ISO date
    doc_count: z.number().int()
  })),
  amount_ranges: z.array(z.object({
    key: z.string(),
    from: z.number().optional(),
    to: z.number().optional(),
    doc_count: z.number().int()
  }))
});

// Search response schema
export const searchResponseSchema = z.object({
  results: z.array(searchResultItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  page_size: z.number().int(),
  total_pages: z.number().int(),
  took_ms: z.number().int(),
  facets: facetsSchema.optional(),
  suggestions: z.array(z.string()).optional()
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;

// Autocomplete query schema
export const autocompleteQuerySchema = z.object({
  prefix: z.string().min(2).max(100),
  limit: z.number().int().min(1).max(20).default(10),
  types: z.array(z.enum(['query', 'client', 'nip', 'term', 'recent'])).optional()
});

// Autocomplete suggestion schema
export const autocompleteSuggestionSchema = z.object({
  type: z.enum(['query', 'client', 'nip', 'term', 'recent']),
  text: z.string(),
  display: z.string(),
  score: z.number(),
  metadata: z.record(z.any()).optional()
});

// Autocomplete response schema
export const autocompleteResponseSchema = z.object({
  suggestions: z.array(autocompleteSuggestionSchema),
  took_ms: z.number().int()
});

// Saved search schema
export const savedSearchSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  query_string: z.string().min(1).max(500),
  filters: searchFiltersSchema.optional(),
  notifications_enabled: z.boolean().default(false),
  notification_frequency: z.enum(['immediate', 'daily', 'weekly']).default('daily'),
  is_shared: z.boolean().default(false)
});

export type SavedSearch = z.infer<typeof savedSearchSchema>;

// Create saved search input
export const createSavedSearchSchema = savedSearchSchema.omit({ id: true });

// Update saved search input
export const updateSavedSearchSchema = savedSearchSchema.partial().required({ id: true });

// Index document schema (for Elasticsearch)
export const indexDocumentSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  document_type: documentTypeSchema,
  status: z.string(),
  title: z.string(),
  content: z.string().optional(),
  ocr_text: z.string().optional(),
  extracted_data: z.record(z.any()).optional(),
  client_id: z.string().uuid().optional(),
  client_name: z.string().optional(),
  tags: z.array(z.string()).default([]),
  file_name: z.string(),
  file_type: z.string(),
  file_size: z.number(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  uploaded_by: z.string().uuid(),
  fiscal_year: z.number().int().optional(),
  fiscal_month: z.number().int().optional()
});

// Search history entry schema
export const searchHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  query_string: z.string(),
  filters: searchFiltersSchema.optional(),
  result_count: z.number().int(),
  took_ms: z.number().int(),
  created_at: z.string().datetime()
});
```

### Document Search Service

```typescript
import { Client } from '@elastic/elasticsearch';
import { db } from '@/lib/db';
import {
  savedSearches,
  searchHistory,
  searchSuggestions,
  searchAnalytics
} from '@/lib/db/schema';
import { eq, desc, and, sql, gte, lte } from 'drizzle-orm';
import {
  SearchQuery,
  SearchResponse,
  SavedSearch,
  searchQuerySchema,
  autocompleteQuerySchema
} from './schemas';

const DOCUMENT_INDEX = 'documents';

export class DocumentSearchService {
  private esClient: Client;

  constructor() {
    this.esClient = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: process.env.ELASTICSEARCH_API_KEY ? {
        apiKey: process.env.ELASTICSEARCH_API_KEY
      } : undefined
    });
  }

  // ============================================
  // MAIN SEARCH OPERATIONS
  // ============================================

  async search(
    organizationId: string,
    userId: string,
    input: SearchQuery
  ): Promise<SearchResponse> {
    const startTime = Date.now();

    // Validate input
    const query = searchQuerySchema.parse(input);

    // Build Elasticsearch query
    const esQuery = this.buildElasticsearchQuery(organizationId, query);

    // Execute search
    const response = await this.esClient.search({
      index: DOCUMENT_INDEX,
      body: esQuery
    });

    const tookMs = Date.now() - startTime;

    // Parse results
    const results = this.parseSearchResults(response, query);

    // Parse facets
    const facets = query.include_facets
      ? this.parseFacets(response.aggregations, query.filters)
      : undefined;

    // Get suggestions for zero results
    const suggestions = results.results.length === 0
      ? await this.getSearchSuggestions(organizationId, query.query)
      : undefined;

    // Log search history (async, don't await)
    this.logSearchHistory(organizationId, userId, query, results.results.length, tookMs);

    return {
      results: results.results,
      total: results.total,
      page: query.page,
      page_size: query.page_size,
      total_pages: Math.ceil(results.total / query.page_size),
      took_ms: tookMs,
      facets,
      suggestions
    };
  }

  private buildElasticsearchQuery(organizationId: string, query: SearchQuery): object {
    const must: object[] = [
      // Organization filter (security)
      { term: { organization_id: organizationId } }
    ];

    const should: object[] = [];
    const filter: object[] = [];

    // Main query
    if (query.query) {
      if (query.fuzzy) {
        // Fuzzy search
        must.push({
          multi_match: {
            query: query.query,
            fields: [
              'title^3',
              'title.keyword^4',
              'content^1.5',
              'ocr_text^1.5',
              'extracted_data.seller_name^2',
              'extracted_data.buyer_name^2',
              'extracted_data.invoice_number^3',
              'client_name^2',
              'file_name'
            ],
            fuzziness: query.fuzzy_max_edits === 2 ? 'AUTO' : '1',
            prefix_length: 2,
            type: 'best_fields',
            operator: 'or'
          }
        });
      } else {
        // Standard search with Polish analysis
        must.push({
          multi_match: {
            query: query.query,
            fields: [
              'title^3',
              'title.keyword^4',
              'content^1.5',
              'ocr_text^1.5',
              'extracted_data.seller_name^2',
              'extracted_data.buyer_name^2',
              'extracted_data.invoice_number^3',
              'extracted_data.seller_nip^4',
              'extracted_data.buyer_nip^4',
              'client_name^2',
              'file_name'
            ],
            type: 'best_fields',
            operator: 'or',
            tie_breaker: 0.3
          }
        });
      }
    }

    // Apply filters
    if (query.filters) {
      const filters = query.filters;

      // Document type filter
      if (filters.document_types?.length) {
        filter.push({
          terms: { document_type: filters.document_types }
        });
      }

      // Date range filter
      if (filters.date_range) {
        const dateFilter = this.buildDateFilter(filters.date_range);
        if (dateFilter) filter.push(dateFilter);
      }

      // Amount range filter
      if (filters.amount_range) {
        const amountFilter: any = { range: { 'extracted_data.gross_amount': {} } };
        if (filters.amount_range.min !== undefined) {
          amountFilter.range['extracted_data.gross_amount'].gte = filters.amount_range.min;
        }
        if (filters.amount_range.max !== undefined) {
          amountFilter.range['extracted_data.gross_amount'].lte = filters.amount_range.max;
        }
        filter.push(amountFilter);
      }

      // VAT rates filter
      if (filters.vat_rates?.length) {
        filter.push({
          terms: { 'extracted_data.vat_rate': filters.vat_rates }
        });
      }

      // Client filter
      if (filters.client_ids?.length) {
        filter.push({
          terms: { client_id: filters.client_ids }
        });
      }

      // Tags filter
      if (filters.tags?.length) {
        filter.push({
          terms: { tags: filters.tags }
        });
      }

      // Status filter
      if (filters.status?.length) {
        filter.push({
          terms: { status: filters.status }
        });
      }

      // Fiscal year filter
      if (filters.fiscal_year) {
        filter.push({
          term: { fiscal_year: filters.fiscal_year }
        });
      }

      // Fiscal month filter
      if (filters.fiscal_month) {
        filter.push({
          term: { fiscal_month: filters.fiscal_month }
        });
      }

      // NIP filter
      if (filters.nip) {
        filter.push({
          bool: {
            should: [
              { term: { 'extracted_data.seller_nip': filters.nip } },
              { term: { 'extracted_data.buyer_nip': filters.nip } }
            ]
          }
        });
      }

      // Invoice number filter
      if (filters.invoice_number) {
        filter.push({
          match: { 'extracted_data.invoice_number': filters.invoice_number }
        });
      }
    }

    // Build final query
    const esQuery: any = {
      query: {
        bool: {
          must,
          filter,
          should
        }
      },
      from: (query.page - 1) * query.page_size,
      size: query.page_size,
      track_total_hits: query.track_total_hits
    };

    // Sorting
    esQuery.sort = this.buildSort(query.sort);

    // Highlighting
    if (query.highlight) {
      esQuery.highlight = {
        fields: {
          title: {
            fragment_size: query.highlight_fragment_size,
            number_of_fragments: 1
          },
          content: {
            fragment_size: query.highlight_fragment_size,
            number_of_fragments: query.highlight_number_of_fragments
          },
          ocr_text: {
            fragment_size: query.highlight_fragment_size,
            number_of_fragments: query.highlight_number_of_fragments
          },
          'extracted_data.seller_name': {
            fragment_size: query.highlight_fragment_size,
            number_of_fragments: 1
          },
          'extracted_data.buyer_name': {
            fragment_size: query.highlight_fragment_size,
            number_of_fragments: 1
          }
        },
        pre_tags: ['<mark>'],
        post_tags: ['</mark>'],
        encoder: 'html'
      };
    }

    // Aggregations (facets)
    if (query.include_facets) {
      esQuery.aggs = this.buildAggregations(query.facet_size);
    }

    // Explain (for debugging)
    if (query.explain) {
      esQuery.explain = true;
    }

    return esQuery;
  }

  private buildDateFilter(dateRange: any): object | null {
    let from: string | undefined;
    let to: string | undefined;

    if (dateRange.preset) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (dateRange.preset) {
        case 'today':
          from = today.toISOString();
          break;
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          from = yesterday.toISOString();
          to = today.toISOString();
          break;
        case 'last_7_days':
          const week = new Date(today);
          week.setDate(week.getDate() - 7);
          from = week.toISOString();
          break;
        case 'last_30_days':
          const month = new Date(today);
          month.setDate(month.getDate() - 30);
          from = month.toISOString();
          break;
        case 'this_month':
          from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          break;
        case 'last_month':
          from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
          to = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          break;
        case 'this_quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          from = new Date(now.getFullYear(), quarter * 3, 1).toISOString();
          break;
        case 'this_year':
          from = new Date(now.getFullYear(), 0, 1).toISOString();
          break;
        case 'last_year':
          from = new Date(now.getFullYear() - 1, 0, 1).toISOString();
          to = new Date(now.getFullYear(), 0, 1).toISOString();
          break;
        case 'custom':
          from = dateRange.from;
          to = dateRange.to;
          break;
      }
    } else {
      from = dateRange.from;
      to = dateRange.to;
    }

    if (!from && !to) return null;

    const range: any = { range: { created_at: {} } };
    if (from) range.range.created_at.gte = from;
    if (to) range.range.created_at.lte = to;

    return range;
  }

  private buildSort(sort: string): object[] {
    switch (sort) {
      case 'date_desc':
        return [{ created_at: 'desc' }];
      case 'date_asc':
        return [{ created_at: 'asc' }];
      case 'amount_desc':
        return [{ 'extracted_data.gross_amount': 'desc' }];
      case 'amount_asc':
        return [{ 'extracted_data.gross_amount': 'asc' }];
      case 'title_asc':
        return [{ 'title.keyword': 'asc' }];
      case 'title_desc':
        return [{ 'title.keyword': 'desc' }];
      case 'relevance':
      default:
        return [{ _score: 'desc' }, { created_at: 'desc' }];
    }
  }

  private buildAggregations(size: number): object {
    return {
      document_types: {
        terms: { field: 'document_type', size }
      },
      vat_rates: {
        terms: { field: 'extracted_data.vat_rate', size }
      },
      clients: {
        terms: { field: 'client_name.keyword', size }
      },
      tags: {
        terms: { field: 'tags', size }
      },
      fiscal_years: {
        terms: { field: 'fiscal_year', size, order: { _key: 'desc' } }
      },
      date_histogram: {
        date_histogram: {
          field: 'created_at',
          calendar_interval: 'month',
          format: 'yyyy-MM'
        }
      },
      amount_ranges: {
        range: {
          field: 'extracted_data.gross_amount',
          ranges: [
            { key: '0-1000', to: 1000 },
            { key: '1000-5000', from: 1000, to: 5000 },
            { key: '5000-10000', from: 5000, to: 10000 },
            { key: '10000-50000', from: 10000, to: 50000 },
            { key: '50000+', from: 50000 }
          ]
        }
      }
    };
  }

  private parseSearchResults(response: any, query: SearchQuery): { results: any[], total: number } {
    const hits = response.hits.hits || [];
    const total = typeof response.hits.total === 'number'
      ? response.hits.total
      : response.hits.total.value;

    const results = hits.map((hit: any) => ({
      id: hit._source.id,
      document_type: hit._source.document_type,
      title: hit._source.title,
      file_name: hit._source.file_name,
      file_type: hit._source.file_type,
      file_size: hit._source.file_size,
      seller_name: hit._source.extracted_data?.seller_name,
      seller_nip: hit._source.extracted_data?.seller_nip,
      buyer_name: hit._source.extracted_data?.buyer_name,
      buyer_nip: hit._source.extracted_data?.buyer_nip,
      invoice_number: hit._source.extracted_data?.invoice_number,
      gross_amount: hit._source.extracted_data?.gross_amount,
      vat_rate: hit._source.extracted_data?.vat_rate,
      issue_date: hit._source.extracted_data?.issue_date,
      created_at: hit._source.created_at,
      client_id: hit._source.client_id,
      client_name: hit._source.client_name,
      tags: hit._source.tags || [],
      score: hit._score,
      highlights: hit.highlight,
      explanation: query.explain ? hit._explanation : undefined
    }));

    return { results, total };
  }

  private parseFacets(aggregations: any, currentFilters?: any): object {
    if (!aggregations) return {};

    const parseTerms = (agg: any, selectedValues?: string[]) => {
      if (!agg?.buckets) return [];
      return agg.buckets.map((bucket: any) => ({
        key: bucket.key,
        doc_count: bucket.doc_count,
        selected: selectedValues?.includes(bucket.key) || false
      }));
    };

    return {
      document_types: parseTerms(
        aggregations.document_types,
        currentFilters?.document_types
      ),
      vat_rates: parseTerms(
        aggregations.vat_rates,
        currentFilters?.vat_rates
      ),
      clients: parseTerms(aggregations.clients),
      tags: parseTerms(
        aggregations.tags,
        currentFilters?.tags
      ),
      fiscal_years: parseTerms(aggregations.fiscal_years),
      date_histogram: aggregations.date_histogram?.buckets?.map((b: any) => ({
        key: b.key_as_string,
        doc_count: b.doc_count
      })) || [],
      amount_ranges: aggregations.amount_ranges?.buckets?.map((b: any) => ({
        key: b.key,
        from: b.from,
        to: b.to,
        doc_count: b.doc_count
      })) || []
    };
  }

  // ============================================
  // AUTOCOMPLETE
  // ============================================

  async autocomplete(
    organizationId: string,
    userId: string,
    input: z.infer<typeof autocompleteQuerySchema>
  ) {
    const startTime = Date.now();
    const { prefix, limit, types } = autocompleteQuerySchema.parse(input);

    const suggestions: any[] = [];

    // Elasticsearch completion suggester
    const esResponse = await this.esClient.search({
      index: DOCUMENT_INDEX,
      body: {
        suggest: {
          document_suggest: {
            prefix,
            completion: {
              field: 'suggest',
              size: limit,
              skip_duplicates: true,
              fuzzy: {
                fuzziness: 1
              },
              contexts: {
                organization: organizationId
              }
            }
          }
        },
        // Also search for matching terms
        query: {
          bool: {
            must: [
              { term: { organization_id: organizationId } },
              {
                bool: {
                  should: [
                    { prefix: { 'title.autocomplete': { value: prefix, boost: 2 } } },
                    { prefix: { 'client_name.autocomplete': { value: prefix, boost: 1.5 } } },
                    { prefix: { 'extracted_data.seller_name.autocomplete': prefix } }
                  ]
                }
              }
            ]
          }
        },
        size: 0, // We only want suggestions
        aggs: {
          client_suggestions: {
            terms: {
              field: 'client_name.keyword',
              size: 5,
              include: `${prefix}.*`
            }
          }
        }
      }
    });

    // Parse completion suggestions
    const completionSuggestions = esResponse.suggest?.document_suggest?.[0]?.options || [];
    for (const option of completionSuggestions) {
      suggestions.push({
        type: 'term',
        text: option.text,
        display: option.text,
        score: option._score || 1,
        metadata: { source: 'completion' }
      });
    }

    // Parse client suggestions from aggregations
    const clientBuckets = esResponse.aggregations?.client_suggestions?.buckets || [];
    for (const bucket of clientBuckets) {
      if (!types || types.includes('client')) {
        suggestions.push({
          type: 'client',
          text: bucket.key,
          display: `Klient: ${bucket.key}`,
          score: bucket.doc_count / 100, // Normalize
          metadata: { doc_count: bucket.doc_count }
        });
      }
    }

    // Get recent searches from database
    if (!types || types.includes('recent')) {
      const recentSearches = await db.select()
        .from(searchHistory)
        .where(and(
          eq(searchHistory.organization_id, organizationId),
          eq(searchHistory.user_id, userId),
          sql`LOWER(${searchHistory.query_string}) LIKE ${`${prefix.toLowerCase()}%`}`
        ))
        .orderBy(desc(searchHistory.created_at))
        .limit(5);

      for (const recent of recentSearches) {
        suggestions.push({
          type: 'recent',
          text: recent.query_string,
          display: recent.query_string,
          score: 0.8,
          metadata: {
            result_count: recent.result_count,
            searched_at: recent.created_at
          }
        });
      }
    }

    // Get popular queries from suggestions table
    if (!types || types.includes('query')) {
      const popularQueries = await db.select()
        .from(searchSuggestions)
        .where(and(
          eq(searchSuggestions.organization_id, organizationId),
          eq(searchSuggestions.suggestion_type, 'query'),
          eq(searchSuggestions.is_active, true),
          sql`LOWER(${searchSuggestions.suggestion_text}) LIKE ${`${prefix.toLowerCase()}%`}`
        ))
        .orderBy(desc(searchSuggestions.weight))
        .limit(5);

      for (const popular of popularQueries) {
        suggestions.push({
          type: 'query',
          text: popular.display_text,
          display: popular.display_text,
          score: popular.weight / 100,
          metadata: { use_count: popular.use_count }
        });
      }
    }

    // Deduplicate and sort by score
    const seen = new Set<string>();
    const uniqueSuggestions = suggestions
      .filter(s => {
        const key = `${s.type}:${s.text.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      suggestions: uniqueSuggestions,
      took_ms: Date.now() - startTime
    };
  }

  // ============================================
  // SAVED SEARCHES
  // ============================================

  async createSavedSearch(
    organizationId: string,
    userId: string,
    input: Omit<SavedSearch, 'id'>
  ): Promise<SavedSearch> {
    const [savedSearch] = await db.insert(savedSearches)
      .values({
        organization_id: organizationId,
        user_id: userId,
        name: input.name,
        description: input.description,
        query_string: input.query_string,
        filters: input.filters || {},
        notifications_enabled: input.notifications_enabled,
        notification_frequency: input.notification_frequency,
        is_shared: input.is_shared
      })
      .returning();

    return savedSearch;
  }

  async getSavedSearches(
    organizationId: string,
    userId: string
  ): Promise<SavedSearch[]> {
    const searches = await db.select()
      .from(savedSearches)
      .where(and(
        eq(savedSearches.organization_id, organizationId),
        sql`(${savedSearches.user_id} = ${userId} OR ${savedSearches.is_shared} = TRUE)`
      ))
      .orderBy(desc(savedSearches.last_used_at));

    return searches;
  }

  async executeSavedSearch(
    organizationId: string,
    userId: string,
    savedSearchId: string
  ): Promise<SearchResponse> {
    // Get saved search
    const [savedSearch] = await db.select()
      .from(savedSearches)
      .where(and(
        eq(savedSearches.id, savedSearchId),
        eq(savedSearches.organization_id, organizationId)
      ))
      .limit(1);

    if (!savedSearch) {
      throw new Error('Saved search not found');
    }

    // Update usage stats
    await db.update(savedSearches)
      .set({
        use_count: sql`${savedSearches.use_count} + 1`,
        last_used_at: sql`NOW()`
      })
      .where(eq(savedSearches.id, savedSearchId));

    // Execute search
    return this.search(organizationId, userId, {
      query: savedSearch.query_string,
      filters: savedSearch.filters as any,
      page: 1,
      page_size: 20,
      include_facets: true,
      highlight: true
    });
  }

  async updateSavedSearch(
    organizationId: string,
    userId: string,
    savedSearchId: string,
    input: Partial<SavedSearch>
  ): Promise<SavedSearch> {
    const [updated] = await db.update(savedSearches)
      .set({
        ...input,
        updated_at: sql`NOW()`
      })
      .where(and(
        eq(savedSearches.id, savedSearchId),
        eq(savedSearches.organization_id, organizationId),
        eq(savedSearches.user_id, userId)
      ))
      .returning();

    if (!updated) {
      throw new Error('Saved search not found or access denied');
    }

    return updated;
  }

  async deleteSavedSearch(
    organizationId: string,
    userId: string,
    savedSearchId: string
  ): Promise<void> {
    const result = await db.delete(savedSearches)
      .where(and(
        eq(savedSearches.id, savedSearchId),
        eq(savedSearches.organization_id, organizationId),
        eq(savedSearches.user_id, userId)
      ));

    if (result.rowCount === 0) {
      throw new Error('Saved search not found or access denied');
    }
  }

  // ============================================
  // INDEXING
  // ============================================

  async indexDocument(document: z.infer<typeof indexDocumentSchema>): Promise<void> {
    // Build suggest field
    const suggest: any = {
      input: [
        document.title,
        document.client_name,
        document.extracted_data?.seller_name,
        document.extracted_data?.invoice_number
      ].filter(Boolean),
      contexts: {
        organization: document.organization_id
      }
    };

    await this.esClient.index({
      index: DOCUMENT_INDEX,
      id: document.id,
      body: {
        ...document,
        suggest
      },
      refresh: true
    });
  }

  async updateDocumentIndex(
    documentId: string,
    updates: Partial<z.infer<typeof indexDocumentSchema>>
  ): Promise<void> {
    await this.esClient.update({
      index: DOCUMENT_INDEX,
      id: documentId,
      body: {
        doc: {
          ...updates,
          updated_at: new Date().toISOString()
        }
      },
      refresh: true
    });
  }

  async removeFromIndex(documentId: string): Promise<void> {
    await this.esClient.delete({
      index: DOCUMENT_INDEX,
      id: documentId,
      refresh: true
    });
  }

  async bulkIndex(documents: z.infer<typeof indexDocumentSchema>[]): Promise<{
    indexed: number;
    failed: number;
    errors: any[]
  }> {
    const operations = documents.flatMap(doc => [
      { index: { _index: DOCUMENT_INDEX, _id: doc.id } },
      {
        ...doc,
        suggest: {
          input: [
            doc.title,
            doc.client_name,
            doc.extracted_data?.seller_name,
            doc.extracted_data?.invoice_number
          ].filter(Boolean),
          contexts: {
            organization: doc.organization_id
          }
        }
      }
    ]);

    const response = await this.esClient.bulk({
      body: operations,
      refresh: true
    });

    const errors = response.items
      .filter((item: any) => item.index?.error)
      .map((item: any) => ({
        id: item.index._id,
        error: item.index.error
      }));

    return {
      indexed: documents.length - errors.length,
      failed: errors.length,
      errors
    };
  }

  // ============================================
  // SEARCH HISTORY & ANALYTICS
  // ============================================

  private async logSearchHistory(
    organizationId: string,
    userId: string,
    query: SearchQuery,
    resultCount: number,
    tookMs: number
  ): Promise<void> {
    try {
      await db.insert(searchHistory).values({
        organization_id: organizationId,
        user_id: userId,
        query_string: query.query,
        filters: query.filters || {},
        result_count: resultCount,
        took_ms: tookMs
      });
    } catch (error) {
      // Don't fail search if history logging fails
      console.error('Failed to log search history:', error);
    }
  }

  async getSearchHistory(
    organizationId: string,
    userId: string,
    limit: number = 20
  ) {
    return db.select()
      .from(searchHistory)
      .where(and(
        eq(searchHistory.organization_id, organizationId),
        eq(searchHistory.user_id, userId)
      ))
      .orderBy(desc(searchHistory.created_at))
      .limit(limit);
  }

  async clearSearchHistory(
    organizationId: string,
    userId: string
  ): Promise<void> {
    await db.delete(searchHistory)
      .where(and(
        eq(searchHistory.organization_id, organizationId),
        eq(searchHistory.user_id, userId)
      ));
  }

  // ============================================
  // SUGGESTIONS
  // ============================================

  private async getSearchSuggestions(
    organizationId: string,
    query: string
  ): Promise<string[]> {
    // Use Elasticsearch did-you-mean functionality
    const response = await this.esClient.search({
      index: DOCUMENT_INDEX,
      body: {
        suggest: {
          text: query,
          simple_phrase: {
            phrase: {
              field: 'content',
              size: 3,
              gram_size: 2,
              direct_generator: [{
                field: 'content',
                suggest_mode: 'popular',
                min_word_length: 3
              }],
              highlight: {
                pre_tag: '',
                post_tag: ''
              }
            }
          }
        }
      }
    });

    const suggestions = response.suggest?.simple_phrase?.[0]?.options || [];
    return suggestions.map((s: any) => s.text);
  }

  // ============================================
  // INDEX MANAGEMENT
  // ============================================

  async createIndex(): Promise<void> {
    const indexExists = await this.esClient.indices.exists({
      index: DOCUMENT_INDEX
    });

    if (!indexExists) {
      await this.esClient.indices.create({
        index: DOCUMENT_INDEX,
        body: {
          // Include the mapping defined above
          settings: {
            number_of_shards: 3,
            number_of_replicas: 1,
            analysis: {
              // ... Polish analyzers from mapping above
            }
          },
          mappings: {
            // ... properties from mapping above
          }
        }
      });
    }
  }

  async getIndexStats(): Promise<{
    doc_count: number;
    size_bytes: number;
    health: string;
  }> {
    const stats = await this.esClient.indices.stats({
      index: DOCUMENT_INDEX
    });

    const health = await this.esClient.cluster.health({
      index: DOCUMENT_INDEX
    });

    return {
      doc_count: stats._all.primaries?.docs?.count || 0,
      size_bytes: stats._all.primaries?.store?.size_in_bytes || 0,
      health: health.status
    };
  }

  async reindexAll(organizationId: string): Promise<void> {
    // This would typically be called via a background job
    // to reindex all documents for an organization
    await this.esClient.reindex({
      body: {
        source: {
          index: DOCUMENT_INDEX,
          query: {
            term: { organization_id: organizationId }
          }
        },
        dest: {
          index: `${DOCUMENT_INDEX}_reindex`
        }
      },
      wait_for_completion: false
    });
  }
}

export const documentSearchService = new DocumentSearchService();
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '@/lib/trpc';
import { z } from 'zod';
import { documentSearchService } from './search.service';
import {
  searchQuerySchema,
  autocompleteQuerySchema,
  createSavedSearchSchema,
  updateSavedSearchSchema,
  indexDocumentSchema
} from './schemas';

export const searchRouter = router({
  // Main search endpoint
  search: protectedProcedure
    .input(searchQuerySchema)
    .query(async ({ ctx, input }) => {
      return documentSearchService.search(
        ctx.organizationId,
        ctx.userId,
        input
      );
    }),

  // Autocomplete suggestions
  autocomplete: protectedProcedure
    .input(autocompleteQuerySchema)
    .query(async ({ ctx, input }) => {
      return documentSearchService.autocomplete(
        ctx.organizationId,
        ctx.userId,
        input
      );
    }),

  // Saved searches
  createSavedSearch: protectedProcedure
    .input(createSavedSearchSchema)
    .mutation(async ({ ctx, input }) => {
      return documentSearchService.createSavedSearch(
        ctx.organizationId,
        ctx.userId,
        input
      );
    }),

  getSavedSearches: protectedProcedure
    .query(async ({ ctx }) => {
      return documentSearchService.getSavedSearches(
        ctx.organizationId,
        ctx.userId
      );
    }),

  executeSavedSearch: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return documentSearchService.executeSavedSearch(
        ctx.organizationId,
        ctx.userId,
        input.id
      );
    }),

  updateSavedSearch: protectedProcedure
    .input(updateSavedSearchSchema)
    .mutation(async ({ ctx, input }) => {
      return documentSearchService.updateSavedSearch(
        ctx.organizationId,
        ctx.userId,
        input.id,
        input
      );
    }),

  deleteSavedSearch: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return documentSearchService.deleteSavedSearch(
        ctx.organizationId,
        ctx.userId,
        input.id
      );
    }),

  // Search history
  getSearchHistory: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      return documentSearchService.getSearchHistory(
        ctx.organizationId,
        ctx.userId,
        input.limit
      );
    }),

  clearSearchHistory: protectedProcedure
    .mutation(async ({ ctx }) => {
      return documentSearchService.clearSearchHistory(
        ctx.organizationId,
        ctx.userId
      );
    }),

  // Index management (admin only)
  indexDocument: protectedProcedure
    .input(indexDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      // Check admin permissions
      if (!ctx.permissions.includes('documents:admin')) {
        throw new Error('Admin permission required');
      }
      return documentSearchService.indexDocument(input);
    }),

  bulkIndex: protectedProcedure
    .input(z.object({ documents: z.array(indexDocumentSchema) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.permissions.includes('documents:admin')) {
        throw new Error('Admin permission required');
      }
      return documentSearchService.bulkIndex(input.documents);
    }),

  removeFromIndex: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.permissions.includes('documents:admin')) {
        throw new Error('Admin permission required');
      }
      return documentSearchService.removeFromIndex(input.documentId);
    }),

  getIndexStats: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.permissions.includes('documents:admin')) {
        throw new Error('Admin permission required');
      }
      return documentSearchService.getIndexStats();
    }),

  reindexOrganization: protectedProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.permissions.includes('documents:admin')) {
        throw new Error('Admin permission required');
      }
      return documentSearchService.reindexAll(ctx.organizationId);
    })
});
```

---

## Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentSearchService } from './search.service';

describe('DocumentSearchService', () => {
  let searchService: DocumentSearchService;
  const mockEsClient = {
    search: vi.fn(),
    index: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    bulk: vi.fn()
  };

  beforeEach(() => {
    searchService = new DocumentSearchService();
    // @ts-ignore - mock client
    searchService['esClient'] = mockEsClient;
    vi.clearAllMocks();
  });

  describe('search', () => {
    it('should build correct Elasticsearch query with filters', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: { hits: [], total: { value: 0 } },
        aggregations: {}
      });

      await searchService.search('org-1', 'user-1', {
        query: 'faktura VAT',
        filters: {
          document_types: ['INVOICE'],
          vat_rates: ['23']
        },
        page: 1,
        page_size: 20
      });

      const esQuery = mockEsClient.search.mock.calls[0][0].body;
      expect(esQuery.query.bool.must).toContainEqual({
        term: { organization_id: 'org-1' }
      });
      expect(esQuery.query.bool.filter).toContainEqual({
        terms: { document_type: ['INVOICE'] }
      });
    });

    it('should apply Polish language analysis', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: {
          hits: [
            { _source: { id: '1', title: 'Faktura' }, _score: 1.5 }
          ],
          total: { value: 1 }
        }
      });

      const result = await searchService.search('org-1', 'user-1', {
        query: 'faktury', // plural form
        page: 1,
        page_size: 20
      });

      // Polish stemmer should match singular "faktura"
      expect(result.total).toBe(1);
    });

    it('should enable fuzzy matching when specified', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: { hits: [], total: { value: 0 } }
      });

      await searchService.search('org-1', 'user-1', {
        query: 'fkatura', // typo
        fuzzy: true,
        fuzzy_max_edits: 2,
        page: 1,
        page_size: 20
      });

      const esQuery = mockEsClient.search.mock.calls[0][0].body;
      expect(esQuery.query.bool.must[1].multi_match.fuzziness).toBe('AUTO');
    });

    it('should include highlights in results', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: {
          hits: [
            {
              _source: { id: '1', title: 'Faktura VAT' },
              _score: 1.0,
              highlight: {
                title: ['<mark>Faktura</mark> VAT']
              }
            }
          ],
          total: { value: 1 }
        }
      });

      const result = await searchService.search('org-1', 'user-1', {
        query: 'faktura',
        highlight: true,
        page: 1,
        page_size: 20
      });

      expect(result.results[0].highlights?.title).toContain('<mark>Faktura</mark> VAT');
    });
  });

  describe('autocomplete', () => {
    it('should return suggestions from multiple sources', async () => {
      mockEsClient.search.mockResolvedValue({
        suggest: {
          document_suggest: [{ options: [{ text: 'faktura VAT', _score: 1 }] }]
        },
        aggregations: {
          client_suggestions: { buckets: [{ key: 'Fabryka ABC', doc_count: 10 }] }
        }
      });

      const result = await searchService.autocomplete('org-1', 'user-1', {
        prefix: 'fa',
        limit: 10
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.took_ms).toBeDefined();
    });

    it('should deduplicate suggestions', async () => {
      mockEsClient.search.mockResolvedValue({
        suggest: {
          document_suggest: [{
            options: [
              { text: 'faktura', _score: 1 },
              { text: 'faktura', _score: 0.9 } // duplicate
            ]
          }]
        },
        aggregations: {}
      });

      const result = await searchService.autocomplete('org-1', 'user-1', {
        prefix: 'fa',
        limit: 10
      });

      const fakturaCount = result.suggestions.filter(s => s.text === 'faktura').length;
      expect(fakturaCount).toBe(1);
    });
  });

  describe('savedSearches', () => {
    it('should create saved search with notification settings', async () => {
      const saved = await searchService.createSavedSearch('org-1', 'user-1', {
        name: 'Niezapłacone faktury',
        query_string: 'faktura status:unpaid',
        notifications_enabled: true,
        notification_frequency: 'daily'
      });

      expect(saved.id).toBeDefined();
      expect(saved.notifications_enabled).toBe(true);
    });
  });

  describe('indexing', () => {
    it('should index document with suggest field', async () => {
      await searchService.indexDocument({
        id: 'doc-1',
        organization_id: 'org-1',
        document_type: 'INVOICE',
        status: 'PROCESSED',
        title: 'Faktura FV/2024/001',
        client_name: 'ABC Sp. z o.o.',
        tags: ['vat', '2024'],
        file_name: 'faktura.pdf',
        file_type: 'application/pdf',
        file_size: 1024,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        uploaded_by: 'user-1'
      });

      const indexCall = mockEsClient.index.mock.calls[0][0];
      expect(indexCall.body.suggest.input).toContain('Faktura FV/2024/001');
      expect(indexCall.body.suggest.input).toContain('ABC Sp. z o.o.');
    });

    it('should bulk index documents efficiently', async () => {
      mockEsClient.bulk.mockResolvedValue({
        items: [
          { index: { _id: '1', status: 201 } },
          { index: { _id: '2', status: 201 } }
        ]
      });

      const result = await searchService.bulkIndex([
        { /* doc 1 */ } as any,
        { /* doc 2 */ } as any
      ]);

      expect(result.indexed).toBe(2);
      expect(result.failed).toBe(0);
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@elastic/elasticsearch';
import { db } from '@/lib/db';
import { DocumentSearchService } from './search.service';

describe('DocumentSearchService Integration', () => {
  let esClient: Client;
  let searchService: DocumentSearchService;
  const testOrgId = 'test-org-integration';
  const testUserId = 'test-user-integration';

  beforeAll(async () => {
    esClient = new Client({ node: 'http://localhost:9200' });
    searchService = new DocumentSearchService();

    // Create test index
    await searchService.createIndex();

    // Index test documents
    await searchService.bulkIndex([
      {
        id: 'test-doc-1',
        organization_id: testOrgId,
        document_type: 'INVOICE',
        status: 'PROCESSED',
        title: 'Faktura VAT FV/2024/001',
        content: 'Usługi księgowe za styczeń 2024',
        extracted_data: {
          seller_name: 'Biuro Rachunkowe Sp. z o.o.',
          seller_nip: '5271234567',
          gross_amount: 1230,
          vat_rate: '23'
        },
        client_name: 'ABC Sp. z o.o.',
        tags: ['vat', 'styczeń'],
        file_name: 'faktura-001.pdf',
        file_type: 'application/pdf',
        file_size: 1024,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        uploaded_by: testUserId,
        fiscal_year: 2024,
        fiscal_month: 1
      },
      {
        id: 'test-doc-2',
        organization_id: testOrgId,
        document_type: 'CONTRACT',
        status: 'PROCESSED',
        title: 'Umowa najmu lokalu',
        content: 'Umowa zawarta w dniu 1 stycznia 2024',
        client_name: 'XYZ Sp. z o.o.',
        tags: ['umowa', 'najem'],
        file_name: 'umowa-najem.pdf',
        file_type: 'application/pdf',
        file_size: 2048,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        uploaded_by: testUserId
      }
    ]);

    // Wait for indexing
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Cleanup test documents
    await esClient.deleteByQuery({
      index: 'documents',
      body: {
        query: { term: { organization_id: testOrgId } }
      }
    });
  });

  describe('Full-text search', () => {
    it('should find documents by content', async () => {
      const result = await searchService.search(testOrgId, testUserId, {
        query: 'usługi księgowe',
        page: 1,
        page_size: 20
      });

      expect(result.total).toBe(1);
      expect(result.results[0].id).toBe('test-doc-1');
    });

    it('should handle Polish diacritics', async () => {
      // Search without diacritics
      const result = await searchService.search(testOrgId, testUserId, {
        query: 'styczen', // without ń
        page: 1,
        page_size: 20
      });

      expect(result.total).toBe(1);
    });

    it('should apply faceted filters', async () => {
      const result = await searchService.search(testOrgId, testUserId, {
        query: '*',
        filters: {
          document_types: ['INVOICE']
        },
        page: 1,
        page_size: 20,
        include_facets: true
      });

      expect(result.total).toBe(1);
      expect(result.facets?.document_types).toBeDefined();
    });

    it('should return response within 200ms', async () => {
      const result = await searchService.search(testOrgId, testUserId, {
        query: 'faktura',
        page: 1,
        page_size: 20
      });

      expect(result.took_ms).toBeLessThan(200);
    });
  });

  describe('Autocomplete', () => {
    it('should return suggestions within 50ms', async () => {
      const result = await searchService.autocomplete(testOrgId, testUserId, {
        prefix: 'fak',
        limit: 10
      });

      expect(result.took_ms).toBeLessThan(50);
    });
  });

  describe('Saved searches', () => {
    let savedSearchId: string;

    it('should create and execute saved search', async () => {
      const saved = await searchService.createSavedSearch(testOrgId, testUserId, {
        name: 'Test Saved Search',
        query_string: 'faktura',
        notifications_enabled: false
      });

      savedSearchId = saved.id;
      expect(saved.id).toBeDefined();

      // Execute saved search
      const result = await searchService.executeSavedSearch(
        testOrgId,
        testUserId,
        savedSearchId
      );

      expect(result.total).toBeGreaterThan(0);
    });

    it('should list saved searches', async () => {
      const searches = await searchService.getSavedSearches(testOrgId, testUserId);
      expect(searches.length).toBeGreaterThan(0);
    });
  });
});
```

### E2E Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Document Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.goto('/documents');
  });

  test('should perform basic search', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('faktura VAT');
    await searchInput.press('Enter');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]');

    // Check results loaded
    const results = page.locator('[data-testid="search-result-item"]');
    await expect(results.first()).toBeVisible();

    // Check highlights
    const highlight = page.locator('mark');
    await expect(highlight.first()).toBeVisible();
  });

  test('should show autocomplete suggestions', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('fakt');

    // Wait for suggestions
    await page.waitForSelector('[data-testid="autocomplete-suggestions"]');

    const suggestions = page.locator('[data-testid="suggestion-item"]');
    await expect(suggestions.first()).toBeVisible({ timeout: 100 }); // <50ms requirement

    // Navigate with keyboard
    await searchInput.press('ArrowDown');
    await searchInput.press('Enter');

    // Check search executed
    await page.waitForSelector('[data-testid="search-results"]');
  });

  test('should filter by document type', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'dokument');
    await page.press('[data-testid="search-input"]', 'Enter');

    await page.waitForSelector('[data-testid="facet-document-type"]');

    // Click facet filter
    await page.click('[data-testid="facet-invoice"]');

    // Check results updated
    await page.waitForSelector('[data-testid="active-filter-invoice"]');
    const results = page.locator('[data-testid="search-result-item"]');

    // All results should be invoices
    for (const result of await results.all()) {
      await expect(result.locator('[data-testid="document-type"]')).toHaveText('Faktura');
    }
  });

  test('should save and use saved search', async ({ page }) => {
    // Perform search
    await page.fill('[data-testid="search-input"]', 'faktura status:unpaid');
    await page.press('[data-testid="search-input"]', 'Enter');
    await page.waitForSelector('[data-testid="search-results"]');

    // Save search
    await page.click('[data-testid="save-search-button"]');
    await page.fill('[data-testid="saved-search-name"]', 'Niezapłacone faktury');
    await page.click('[data-testid="save-search-confirm"]');

    // Verify saved
    await expect(page.locator('[data-testid="saved-search-success"]')).toBeVisible();

    // Use saved search
    await page.click('[data-testid="saved-searches-dropdown"]');
    await page.click('[data-testid="saved-search-item"]:has-text("Niezapłacone faktury")');

    // Check search executed
    await page.waitForSelector('[data-testid="search-results"]');
    await expect(page.locator('[data-testid="search-input"]')).toHaveValue('faktura status:unpaid');
  });

  test('should use advanced query syntax', async ({ page }) => {
    const queries = [
      { query: '"umowa najmu"', description: 'exact phrase' },
      { query: 'faktura AND client:ABC', description: 'boolean AND' },
      { query: 'amount:>10000', description: 'numeric range' }
    ];

    for (const { query, description } of queries) {
      await page.fill('[data-testid="search-input"]', query);
      await page.press('[data-testid="search-input"]', 'Enter');
      await page.waitForSelector('[data-testid="search-results"]');

      // Should not show syntax error
      await expect(page.locator('[data-testid="search-error"]')).not.toBeVisible();
    }
  });

  test('should handle zero results with suggestions', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'xyznonexistent');
    await page.press('[data-testid="search-input"]', 'Enter');

    await page.waitForSelector('[data-testid="no-results"]');

    // Check suggestions shown
    const suggestions = page.locator('[data-testid="search-suggestions"]');
    await expect(suggestions).toBeVisible();
  });

  test('should respond within 200ms', async ({ page }) => {
    const startTime = Date.now();

    await page.fill('[data-testid="search-input"]', 'faktura');
    await page.press('[data-testid="search-input"]', 'Enter');
    await page.waitForSelector('[data-testid="search-results"]');

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Account for network latency, check server-side time
    const tookMs = await page.locator('[data-testid="search-took-ms"]').textContent();
    expect(parseInt(tookMs || '0')).toBeLessThan(200);
  });
});
```

---

## Security Checklist

### Authentication & Authorization
- [ ] All search endpoints require authentication
- [ ] Organization isolation enforced via organization_id filter
- [ ] RLS policies prevent cross-tenant data access
- [ ] Saved searches visible only to owner or if shared
- [ ] Admin-only endpoints check permissions

### Input Validation
- [ ] Query string sanitized and length-limited (max 500 chars)
- [ ] Filter values validated against allowed enums
- [ ] Page size limited (max 100)
- [ ] Fuzzy edit distance limited (max 2)
- [ ] Date ranges validated for sanity

### Data Protection
- [ ] Search history encrypted at rest
- [ ] Elasticsearch connection uses TLS
- [ ] API keys stored securely (not in code)
- [ ] PII in search results respects access controls

### Rate Limiting
- [ ] Search requests rate-limited per user
- [ ] Autocomplete requests rate-limited (higher threshold)
- [ ] Bulk indexing operations throttled
- [ ] Saved search notifications rate-limited

### Logging & Audit
- [ ] All searches logged with user context
- [ ] Saved search modifications logged
- [ ] Index modifications logged
- [ ] Error details not exposed to clients

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `document.search` | Search executed | query, filters, result_count, user_id, took_ms |
| `document.search.autocomplete` | Autocomplete request | prefix, user_id, suggestion_count |
| `saved_search.created` | New saved search | name, query, user_id |
| `saved_search.executed` | Saved search run | saved_search_id, user_id, result_count |
| `saved_search.updated` | Saved search modified | saved_search_id, changes, user_id |
| `saved_search.deleted` | Saved search removed | saved_search_id, user_id |
| `search_history.cleared` | History cleared | user_id, cleared_count |
| `index.document_indexed` | Document added to index | document_id, organization_id |
| `index.document_updated` | Document index updated | document_id, fields_updated |
| `index.document_removed` | Document removed from index | document_id |
| `index.bulk_operation` | Bulk indexing | document_count, success_count, error_count |
| `index.reindex_started` | Reindex initiated | organization_id, admin_user_id |

---

## Implementation Notes

### Elasticsearch Deployment
- **Version**: Elasticsearch 8.x recommended
- **Cluster**: Minimum 3 nodes for production
- **Memory**: 4GB heap per node minimum
- **Storage**: SSD recommended for performance

### Polish Language Support
- Install `analysis-stempel` plugin for Polish stemming
- Configure synonyms for Polish accounting terms
- Test with common diacritics (ą, ę, ó, ś, ł, ż, ź, ć, ń)

### Performance Optimization
- Use `filter` context for non-scoring queries
- Enable request caching for repeated queries
- Implement `scroll` API for large exports
- Monitor slow query log (>100ms)

### Index Lifecycle
- Daily indices for high-volume organizations
- ILM policy: hot → warm → cold → delete
- Retain search history for 90 days max
- Archive analytics data monthly

### Dependencies
- `@elastic/elasticsearch` ^8.x
- Document OCR integration (DOC-004)
- Data extraction integration (DOC-005)
- Classification tags integration (DOC-006)

---

## Related Stories

- **DOC-004**: OCR Processing Engine (provides searchable text)
- **DOC-005**: AI Data Extraction (provides structured fields)
- **DOC-006**: Document Classification (provides tags for filtering)
- **ACC**: Accounting module (client associations)
- **CRM**: Client management (client names, NIPs)

---

## Definition of Done

- [ ] Elasticsearch index created with Polish analyzers
- [ ] All 8 acceptance scenarios passing
- [ ] Search response time <200ms (95th percentile)
- [ ] Autocomplete <50ms response time
- [ ] Polish diacritics normalization working
- [ ] Faceted search with counts
- [ ] Saved searches CRUD complete
- [ ] Search history logging
- [ ] RLS policies enforced
- [ ] Unit test coverage ≥85%
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Security checklist complete
- [ ] Performance benchmarks documented

---

*Story created: December 2024*
*Template version: 1.0.0*
