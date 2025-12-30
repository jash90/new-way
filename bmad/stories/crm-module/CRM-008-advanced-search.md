# CRM-008: Advanced Search and Filtering

> **Story ID**: CRM-008
> **Epic**: Core CRM Module
> **Priority**: P0 (Core)
> **Points**: 8
> **Status**: 📋 Ready for Development
> **Phase**: Week 7

---

## User Story

**As an** accountant,
**I want** advanced search capabilities with multi-criteria filtering,
**So that** I can quickly find clients by any combination of attributes.

---

## Acceptance Criteria

### AC1: Full-Text Search
```gherkin
Feature: Full-text search across client data

  Scenario: Search clients by company name
    Given I am logged in as an accountant
    And clients exist with names "ABC Sp. z o.o.", "ABC Transport", "XYZ Services"
    When I enter "ABC" in the search field
    Then I should see "ABC Sp. z o.o." and "ABC Transport" in results
    And results should be ordered by relevance score
    And "XYZ Services" should not appear in results

  Scenario: Search clients by NIP number
    Given clients exist with NIP "1234567890" and "9876543210"
    When I search for "123456"
    Then I should see client with NIP "1234567890"
    And partial NIP matching should work

  Scenario: Search clients by contact information
    Given client has contact with email "jan.kowalski@firma.pl"
    When I search for "kowalski"
    Then I should see the client in results
    And the matching contact should be highlighted

  Scenario: Search with Polish diacritics normalization
    Given client exists with name "Żółta Łódź Sp. z o.o."
    When I search for "zolta lodz"
    Then I should find the client
    And diacritics should be normalized in search
```

### AC2: Multi-Criteria Filtering
```gherkin
Feature: Filter clients by multiple criteria

  Scenario: Filter by client status
    Given clients exist with statuses ACTIVE, INACTIVE, SUSPENDED
    When I filter by status "ACTIVE"
    Then I should see only active clients
    And inactive and suspended clients should be hidden

  Scenario: Filter by VAT status
    Given clients exist with VAT statuses ACTIVE, NOT_REGISTERED, INVALID
    When I filter by VAT status "ACTIVE"
    Then I should see only VAT-active clients

  Scenario: Filter by tax form
    Given clients exist with tax forms CIT, PIT, VAT, FLAT_TAX
    When I filter by tax form "CIT"
    Then I should see only CIT taxpayers

  Scenario: Filter by date range
    Given clients were created on various dates
    When I filter by creation date from "2024-01-01" to "2024-03-31"
    Then I should see only clients created in Q1 2024

  Scenario: Combine multiple filters
    Given I have filtered by status "ACTIVE"
    When I add filter for VAT status "ACTIVE"
    And I add filter for tax form "VAT"
    Then I should see only clients matching ALL criteria
    And filter count should show "3 filters active"
```

### AC3: Tag and Category Filtering
```gherkin
Feature: Filter clients by tags and categories

  Scenario: Filter by single tag
    Given clients have tags "VIP", "Standard", "New"
    When I filter by tag "VIP"
    Then I should see only VIP-tagged clients

  Scenario: Filter by multiple tags (OR logic)
    Given I filter by tags "VIP" OR "Premium"
    Then I should see clients with either tag
    And results should include union of both tags

  Scenario: Filter by multiple tags (AND logic)
    Given I filter by tags "VIP" AND "Manufacturing"
    Then I should see only clients with BOTH tags
    And results should include intersection only

  Scenario: Filter by tag category
    Given tag category "Industry" has tags "IT", "Manufacturing", "Retail"
    When I filter by category "Industry" = "IT"
    Then I should see only IT industry clients
```

### AC4: Custom Field Filtering
```gherkin
Feature: Filter clients by custom field values

  Scenario: Filter by text custom field
    Given custom field "Region" exists with values
    When I filter by "Region" equals "Mazowieckie"
    Then I should see only clients from Mazowieckie region

  Scenario: Filter by numeric custom field with range
    Given custom field "Annual Revenue" exists with numeric values
    When I filter by "Annual Revenue" between 1000000 and 5000000
    Then I should see only clients within revenue range

  Scenario: Filter by date custom field
    Given custom field "Contract End Date" exists
    When I filter by "Contract End Date" before "2024-12-31"
    Then I should see clients with expiring contracts

  Scenario: Filter by select custom field
    Given custom field "Priority Level" has options "High", "Medium", "Low"
    When I filter by "Priority Level" equals "High"
    Then I should see only high-priority clients
```

### AC5: Saved Searches
```gherkin
Feature: Save and reuse search configurations

  Scenario: Save current search as preset
    Given I have applied search "VIP" and filters status=ACTIVE, VAT=ACTIVE
    When I click "Save Search"
    And I enter name "Active VIP Clients"
    Then search should be saved to my presets
    And it should appear in my saved searches list

  Scenario: Load saved search
    Given I have saved search "Active VIP Clients"
    When I select it from saved searches
    Then all search criteria should be restored
    And results should match the saved configuration

  Scenario: Share saved search with team
    Given I have saved search "Expiring Contracts"
    When I share it with my organization
    Then team members should see it in shared searches
    And they should be able to use it

  Scenario: Delete saved search
    Given I have saved search "Old Query"
    When I delete it
    Then it should be removed from my list
    And shared copies should be unaffected
```

### AC6: Search Results Management
```gherkin
Feature: Manage and export search results

  Scenario: Sort results by column
    Given I have search results displayed
    When I click on "Company Name" column header
    Then results should sort alphabetically by name
    And clicking again should reverse the order

  Scenario: Paginate large result sets
    Given search returns 250 clients
    When I view results with page size 25
    Then I should see first 25 clients
    And pagination should show "Page 1 of 10"
    And I should be able to navigate between pages

  Scenario: Export filtered results
    Given I have filtered to 50 clients
    When I click "Export"
    And I select format "Excel"
    Then an Excel file should download
    And it should contain only the 50 filtered clients

  Scenario: Quick actions on results
    Given I have search results displayed
    When I select multiple clients
    Then I should see bulk action options
    And I should be able to apply tags, change status, or export selected
```

---

## Technical Specification

### Database Schema

```sql
-- Search configuration and saved searches
CREATE TABLE saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    search_config JSONB NOT NULL,
    is_shared BOOLEAN NOT NULL DEFAULT FALSE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, name, created_by)
);

-- Search history for analytics and suggestions
CREATE TABLE search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    search_query TEXT,
    filters JSONB NOT NULL DEFAULT '{}',
    result_count INTEGER NOT NULL DEFAULT 0,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Materialized view for fast full-text search
CREATE MATERIALIZED VIEW client_search_index AS
SELECT
    c.id,
    c.organization_id,
    c.company_name,
    c.trade_name,
    c.nip,
    c.regon,
    c.krs,
    c.status,
    c.vat_status,
    c.tax_form,
    c.is_vat_payer,
    c.created_at,
    c.updated_at,
    -- Full-text search vector
    setweight(to_tsvector('polish', coalesce(c.company_name, '')), 'A') ||
    setweight(to_tsvector('polish', coalesce(c.trade_name, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(c.nip, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(c.regon, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(c.krs, '')), 'C') ||
    setweight(to_tsvector('polish', coalesce(c.city, '')), 'C') ||
    setweight(to_tsvector('polish', coalesce(c.street, '')), 'D') AS search_vector,
    -- Normalized text for diacritics-insensitive search
    unaccent(lower(coalesce(c.company_name, ''))) AS normalized_name,
    -- Contact search data (aggregated)
    (
        SELECT string_agg(
            coalesce(cc.first_name, '') || ' ' ||
            coalesce(cc.last_name, '') || ' ' ||
            coalesce(cc.email, '') || ' ' ||
            coalesce(cc.phone, ''),
            ' '
        )
        FROM client_contacts cc
        WHERE cc.client_id = c.id AND cc.is_deleted = FALSE
    ) AS contact_text,
    -- Tag IDs for filtering
    ARRAY(
        SELECT ct.tag_id
        FROM client_tags ct
        WHERE ct.client_id = c.id
    ) AS tag_ids,
    -- Custom field values for filtering (as JSONB)
    (
        SELECT jsonb_object_agg(
            cfv.field_id::text,
            CASE
                WHEN cfd.field_type IN ('TEXT', 'TEXTAREA', 'EMAIL', 'PHONE', 'URL') THEN to_jsonb(cfv.value_text)
                WHEN cfd.field_type IN ('NUMBER', 'CURRENCY') THEN to_jsonb(cfv.value_number)
                WHEN cfd.field_type = 'DATE' THEN to_jsonb(cfv.value_date)
                WHEN cfd.field_type = 'DATETIME' THEN to_jsonb(cfv.value_datetime)
                WHEN cfd.field_type = 'CHECKBOX' THEN to_jsonb(cfv.value_boolean)
                ELSE cfv.value_json
            END
        )
        FROM custom_field_values cfv
        JOIN custom_field_definitions cfd ON cfd.id = cfv.field_id
        WHERE cfv.entity_type = 'CLIENT' AND cfv.entity_id = c.id
    ) AS custom_fields
FROM clients c
WHERE c.is_deleted = FALSE;

-- Indexes for the materialized view
CREATE INDEX idx_client_search_org ON client_search_index(organization_id);
CREATE INDEX idx_client_search_vector ON client_search_index USING GIN(search_vector);
CREATE INDEX idx_client_search_normalized ON client_search_index USING GIN(normalized_name gin_trgm_ops);
CREATE INDEX idx_client_search_status ON client_search_index(status);
CREATE INDEX idx_client_search_vat_status ON client_search_index(vat_status);
CREATE INDEX idx_client_search_tax_form ON client_search_index(tax_form);
CREATE INDEX idx_client_search_tags ON client_search_index USING GIN(tag_ids);
CREATE INDEX idx_client_search_custom ON client_search_index USING GIN(custom_fields);
CREATE INDEX idx_client_search_created ON client_search_index(created_at);

-- Function to refresh search index
CREATE OR REPLACE FUNCTION refresh_client_search_index()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY client_search_index;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh on client changes
CREATE TRIGGER refresh_search_index_on_client_change
AFTER INSERT OR UPDATE OR DELETE ON clients
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_client_search_index();

-- RLS policies
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_searches_org_policy ON saved_searches
    FOR ALL USING (organization_id = current_setting('app.organization_id')::uuid);

CREATE POLICY saved_searches_owner_or_shared ON saved_searches
    FOR SELECT USING (
        organization_id = current_setting('app.organization_id')::uuid
        AND (created_by = current_setting('app.user_id')::uuid OR is_shared = TRUE)
    );

CREATE POLICY search_history_user_policy ON search_history
    FOR ALL USING (
        organization_id = current_setting('app.organization_id')::uuid
        AND user_id = current_setting('app.user_id')::uuid
    );
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Filter operators for different field types
export const FilterOperator = z.enum([
  'EQUALS',
  'NOT_EQUALS',
  'CONTAINS',
  'STARTS_WITH',
  'ENDS_WITH',
  'GREATER_THAN',
  'LESS_THAN',
  'GREATER_OR_EQUAL',
  'LESS_OR_EQUAL',
  'BETWEEN',
  'IN',
  'NOT_IN',
  'IS_NULL',
  'IS_NOT_NULL',
  'BEFORE',
  'AFTER',
]);

// Base filter schema
export const FilterConditionSchema = z.object({
  field: z.string().min(1),
  operator: FilterOperator,
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.date(),
    z.array(z.string()),
    z.array(z.number()),
    z.null(),
  ]).optional(),
  // For BETWEEN operator
  valueFrom: z.union([z.string(), z.number(), z.date()]).optional(),
  valueTo: z.union([z.string(), z.number(), z.date()]).optional(),
});

// Tag filter with AND/OR logic
export const TagFilterSchema = z.object({
  tagIds: z.array(z.string().uuid()).min(1),
  logic: z.enum(['AND', 'OR']).default('OR'),
});

// Custom field filter
export const CustomFieldFilterSchema = z.object({
  fieldId: z.string().uuid(),
  operator: FilterOperator,
  value: z.any().optional(),
  valueFrom: z.any().optional(),
  valueTo: z.any().optional(),
});

// Sort configuration
export const SortConfigSchema = z.object({
  field: z.string().min(1),
  direction: z.enum(['asc', 'desc']).default('asc'),
});

// Complete search configuration
export const SearchConfigSchema = z.object({
  // Full-text search query
  query: z.string().max(500).optional(),

  // Standard field filters
  filters: z.array(FilterConditionSchema).default([]),

  // Tag filters
  tagFilter: TagFilterSchema.optional(),

  // Custom field filters
  customFieldFilters: z.array(CustomFieldFilterSchema).default([]),

  // Sorting
  sort: z.array(SortConfigSchema).default([{ field: 'company_name', direction: 'asc' }]),

  // Pagination
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),

  // Include related data
  includeContacts: z.boolean().default(false),
  includeTags: z.boolean().default(true),
  includeCustomFields: z.boolean().default(false),
});

export type SearchConfig = z.infer<typeof SearchConfigSchema>;

// Search input schema
export const SearchClientsInputSchema = SearchConfigSchema.extend({
  organizationId: z.string().uuid(),
});

// Saved search schemas
export const CreateSavedSearchSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  searchConfig: SearchConfigSchema,
  isShared: z.boolean().default(false),
  isDefault: z.boolean().default(false),
});

export const UpdateSavedSearchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  searchConfig: SearchConfigSchema.optional(),
  isShared: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

// Search result schema
export const ClientSearchResultSchema = z.object({
  id: z.string().uuid(),
  companyName: z.string(),
  tradeName: z.string().nullable(),
  nip: z.string(),
  regon: z.string().nullable(),
  krs: z.string().nullable(),
  status: z.string(),
  vatStatus: z.string(),
  taxForm: z.string(),
  city: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  // Search metadata
  relevanceScore: z.number().optional(),
  matchedFields: z.array(z.string()).optional(),
  // Related data
  contacts: z.array(z.object({
    id: z.string().uuid(),
    fullName: z.string(),
    email: z.string().nullable(),
    isPrimary: z.boolean(),
  })).optional(),
  tags: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    color: z.string(),
    categoryName: z.string().nullable(),
  })).optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});

// Paginated search response
export const SearchResultsSchema = z.object({
  items: z.array(ClientSearchResultSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalItems: z.number(),
    totalPages: z.number(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
  meta: z.object({
    executionTimeMs: z.number(),
    appliedFilters: z.number(),
    searchQuery: z.string().optional(),
  }),
});

// Export types
export type FilterCondition = z.infer<typeof FilterConditionSchema>;
export type TagFilter = z.infer<typeof TagFilterSchema>;
export type CustomFieldFilter = z.infer<typeof CustomFieldFilterSchema>;
export type SortConfig = z.infer<typeof SortConfigSchema>;
export type ClientSearchResult = z.infer<typeof ClientSearchResultSchema>;
export type SearchResults = z.infer<typeof SearchResultsSchema>;
```

### Search Service

```typescript
// src/server/services/crm/search.service.ts
import { db } from '@/server/db';
import { TRPCError } from '@trpc/server';
import type {
  SearchConfig,
  FilterCondition,
  CustomFieldFilter,
  SearchResults,
  ClientSearchResult
} from './search.schema';

export class ClientSearchService {
  /**
   * Build and execute advanced client search
   */
  async searchClients(
    organizationId: string,
    config: SearchConfig,
    userId: string
  ): Promise<SearchResults> {
    const startTime = Date.now();

    // Build the base query
    let query = this.buildBaseQuery(organizationId, config);

    // Apply full-text search if query provided
    if (config.query?.trim()) {
      query = this.applyFullTextSearch(query, config.query);
    }

    // Apply standard filters
    for (const filter of config.filters) {
      query = this.applyFilter(query, filter);
    }

    // Apply tag filters
    if (config.tagFilter) {
      query = this.applyTagFilter(query, config.tagFilter);
    }

    // Apply custom field filters
    for (const cfFilter of config.customFieldFilters) {
      query = this.applyCustomFieldFilter(query, cfFilter);
    }

    // Get total count for pagination
    const countQuery = query.clone();
    const [{ count }] = await countQuery.select(db.raw('COUNT(DISTINCT id) as count'));
    const totalItems = parseInt(count, 10);

    // Apply sorting
    for (const sort of config.sort) {
      query = query.orderBy(this.mapSortField(sort.field), sort.direction);
    }

    // Apply pagination
    const offset = (config.page - 1) * config.pageSize;
    query = query.limit(config.pageSize).offset(offset);

    // Execute query
    const clients = await query;

    // Load related data if requested
    const results = await this.enrichResults(
      clients,
      config.includeContacts,
      config.includeTags,
      config.includeCustomFields
    );

    const executionTimeMs = Date.now() - startTime;

    // Log search for analytics
    await this.logSearch(organizationId, userId, config, totalItems, executionTimeMs);

    return {
      items: results,
      pagination: {
        page: config.page,
        pageSize: config.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / config.pageSize),
        hasNextPage: config.page * config.pageSize < totalItems,
        hasPreviousPage: config.page > 1,
      },
      meta: {
        executionTimeMs,
        appliedFilters: config.filters.length + config.customFieldFilters.length + (config.tagFilter ? 1 : 0),
        searchQuery: config.query,
      },
    };
  }

  /**
   * Build base query from materialized view
   */
  private buildBaseQuery(organizationId: string, config: SearchConfig) {
    return db('client_search_index as csi')
      .select(
        'csi.id',
        'csi.company_name',
        'csi.trade_name',
        'csi.nip',
        'csi.regon',
        'csi.krs',
        'csi.status',
        'csi.vat_status',
        'csi.tax_form',
        'csi.created_at',
        'csi.updated_at'
      )
      .where('csi.organization_id', organizationId);
  }

  /**
   * Apply full-text search with Polish language support
   */
  private applyFullTextSearch(query: any, searchQuery: string) {
    // Normalize query for diacritics-insensitive search
    const normalizedQuery = this.normalizePolish(searchQuery);

    // Build tsquery from user input
    const tsQuery = searchQuery
      .trim()
      .split(/\s+/)
      .map(word => `${word}:*`)
      .join(' & ');

    return query
      .where(function() {
        this.whereRaw(
          "search_vector @@ to_tsquery('polish', ?)",
          [tsQuery]
        )
        .orWhereRaw(
          "normalized_name ILIKE ?",
          [`%${normalizedQuery}%`]
        )
        .orWhereRaw(
          "nip LIKE ?",
          [`%${searchQuery}%`]
        )
        .orWhereRaw(
          "contact_text ILIKE ?",
          [`%${searchQuery}%`]
        );
      })
      .select(
        db.raw(
          "ts_rank(search_vector, to_tsquery('polish', ?)) as relevance_score",
          [tsQuery]
        )
      )
      .orderBy('relevance_score', 'desc');
  }

  /**
   * Apply a single filter condition
   */
  private applyFilter(query: any, filter: FilterCondition) {
    const column = this.mapFilterField(filter.field);

    switch (filter.operator) {
      case 'EQUALS':
        return query.where(column, filter.value);

      case 'NOT_EQUALS':
        return query.whereNot(column, filter.value);

      case 'CONTAINS':
        return query.whereILike(column, `%${filter.value}%`);

      case 'STARTS_WITH':
        return query.whereILike(column, `${filter.value}%`);

      case 'ENDS_WITH':
        return query.whereILike(column, `%${filter.value}`);

      case 'GREATER_THAN':
        return query.where(column, '>', filter.value);

      case 'LESS_THAN':
        return query.where(column, '<', filter.value);

      case 'GREATER_OR_EQUAL':
        return query.where(column, '>=', filter.value);

      case 'LESS_OR_EQUAL':
        return query.where(column, '<=', filter.value);

      case 'BETWEEN':
        return query.whereBetween(column, [filter.valueFrom, filter.valueTo]);

      case 'IN':
        return query.whereIn(column, filter.value as any[]);

      case 'NOT_IN':
        return query.whereNotIn(column, filter.value as any[]);

      case 'IS_NULL':
        return query.whereNull(column);

      case 'IS_NOT_NULL':
        return query.whereNotNull(column);

      case 'BEFORE':
        return query.where(column, '<', filter.value);

      case 'AFTER':
        return query.where(column, '>', filter.value);

      default:
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unknown filter operator: ${filter.operator}`,
        });
    }
  }

  /**
   * Apply tag filter with AND/OR logic
   */
  private applyTagFilter(query: any, tagFilter: { tagIds: string[]; logic: 'AND' | 'OR' }) {
    if (tagFilter.logic === 'OR') {
      // Client must have at least one of the tags
      return query.whereRaw(
        'tag_ids && ARRAY[?]::uuid[]',
        [tagFilter.tagIds]
      );
    } else {
      // Client must have ALL specified tags
      return query.whereRaw(
        'tag_ids @> ARRAY[?]::uuid[]',
        [tagFilter.tagIds]
      );
    }
  }

  /**
   * Apply custom field filter
   */
  private applyCustomFieldFilter(query: any, cfFilter: CustomFieldFilter) {
    const fieldPath = `custom_fields->>'${cfFilter.fieldId}'`;

    switch (cfFilter.operator) {
      case 'EQUALS':
        return query.whereRaw(`${fieldPath} = ?`, [String(cfFilter.value)]);

      case 'NOT_EQUALS':
        return query.whereRaw(`${fieldPath} != ?`, [String(cfFilter.value)]);

      case 'CONTAINS':
        return query.whereRaw(`${fieldPath} ILIKE ?`, [`%${cfFilter.value}%`]);

      case 'GREATER_THAN':
        return query.whereRaw(`(${fieldPath})::numeric > ?`, [cfFilter.value]);

      case 'LESS_THAN':
        return query.whereRaw(`(${fieldPath})::numeric < ?`, [cfFilter.value]);

      case 'BETWEEN':
        return query.whereRaw(
          `(${fieldPath})::numeric BETWEEN ? AND ?`,
          [cfFilter.valueFrom, cfFilter.valueTo]
        );

      case 'BEFORE':
        return query.whereRaw(`(${fieldPath})::date < ?`, [cfFilter.value]);

      case 'AFTER':
        return query.whereRaw(`(${fieldPath})::date > ?`, [cfFilter.value]);

      case 'IS_NULL':
        return query.whereRaw(`${fieldPath} IS NULL`);

      case 'IS_NOT_NULL':
        return query.whereRaw(`${fieldPath} IS NOT NULL`);

      default:
        return query;
    }
  }

  /**
   * Enrich results with related data
   */
  private async enrichResults(
    clients: any[],
    includeContacts: boolean,
    includeTags: boolean,
    includeCustomFields: boolean
  ): Promise<ClientSearchResult[]> {
    if (clients.length === 0) return [];

    const clientIds = clients.map(c => c.id);

    // Load contacts if requested
    let contactsMap: Map<string, any[]> = new Map();
    if (includeContacts) {
      const contacts = await db('client_contacts')
        .select('id', 'client_id', 'first_name', 'last_name', 'email', 'is_primary')
        .whereIn('client_id', clientIds)
        .where('is_deleted', false)
        .orderBy('is_primary', 'desc');

      for (const contact of contacts) {
        const existing = contactsMap.get(contact.client_id) || [];
        existing.push({
          id: contact.id,
          fullName: `${contact.first_name} ${contact.last_name}`.trim(),
          email: contact.email,
          isPrimary: contact.is_primary,
        });
        contactsMap.set(contact.client_id, existing);
      }
    }

    // Load tags if requested
    let tagsMap: Map<string, any[]> = new Map();
    if (includeTags) {
      const tags = await db('client_tags as ct')
        .join('tags as t', 't.id', 'ct.tag_id')
        .leftJoin('tag_categories as tc', 'tc.id', 't.category_id')
        .select(
          'ct.client_id',
          't.id',
          't.name',
          't.color',
          'tc.name as category_name'
        )
        .whereIn('ct.client_id', clientIds)
        .where('t.is_archived', false);

      for (const tag of tags) {
        const existing = tagsMap.get(tag.client_id) || [];
        existing.push({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          categoryName: tag.category_name,
        });
        tagsMap.set(tag.client_id, existing);
      }
    }

    // Load custom fields if requested
    let customFieldsMap: Map<string, Record<string, any>> = new Map();
    if (includeCustomFields) {
      const customFields = await db('custom_field_values as cfv')
        .join('custom_field_definitions as cfd', 'cfd.id', 'cfv.field_id')
        .select(
          'cfv.entity_id',
          'cfd.name as field_name',
          'cfv.value_text',
          'cfv.value_number',
          'cfv.value_date',
          'cfv.value_datetime',
          'cfv.value_boolean',
          'cfv.value_json',
          'cfd.field_type'
        )
        .whereIn('cfv.entity_id', clientIds)
        .where('cfv.entity_type', 'CLIENT')
        .where('cfd.is_active', true);

      for (const cf of customFields) {
        const existing = customFieldsMap.get(cf.entity_id) || {};
        existing[cf.field_name] = this.extractCustomFieldValue(cf);
        customFieldsMap.set(cf.entity_id, existing);
      }
    }

    // Map results
    return clients.map(client => ({
      id: client.id,
      companyName: client.company_name,
      tradeName: client.trade_name,
      nip: client.nip,
      regon: client.regon,
      krs: client.krs,
      status: client.status,
      vatStatus: client.vat_status,
      taxForm: client.tax_form,
      city: client.city,
      createdAt: client.created_at,
      updatedAt: client.updated_at,
      relevanceScore: client.relevance_score,
      matchedFields: client.matched_fields,
      contacts: contactsMap.get(client.id),
      tags: tagsMap.get(client.id) || [],
      customFields: customFieldsMap.get(client.id),
    }));
  }

  /**
   * Normalize Polish text for diacritics-insensitive search
   */
  private normalizePolish(text: string): string {
    const diacriticsMap: Record<string, string> = {
      'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
      'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
      'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N',
      'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
    };

    return text
      .split('')
      .map(char => diacriticsMap[char] || char)
      .join('')
      .toLowerCase();
  }

  /**
   * Map API field names to database columns
   */
  private mapFilterField(field: string): string {
    const fieldMap: Record<string, string> = {
      companyName: 'company_name',
      tradeName: 'trade_name',
      nip: 'nip',
      regon: 'regon',
      krs: 'krs',
      status: 'status',
      vatStatus: 'vat_status',
      taxForm: 'tax_form',
      isVatPayer: 'is_vat_payer',
      city: 'city',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    return fieldMap[field] || field;
  }

  /**
   * Map sort field names
   */
  private mapSortField(field: string): string {
    return this.mapFilterField(field);
  }

  /**
   * Extract custom field value based on type
   */
  private extractCustomFieldValue(cf: any): any {
    switch (cf.field_type) {
      case 'TEXT':
      case 'TEXTAREA':
      case 'EMAIL':
      case 'PHONE':
      case 'URL':
        return cf.value_text;
      case 'NUMBER':
      case 'CURRENCY':
        return cf.value_number;
      case 'DATE':
        return cf.value_date;
      case 'DATETIME':
        return cf.value_datetime;
      case 'CHECKBOX':
        return cf.value_boolean;
      default:
        return cf.value_json;
    }
  }

  /**
   * Log search for analytics
   */
  private async logSearch(
    organizationId: string,
    userId: string,
    config: SearchConfig,
    resultCount: number,
    executionTimeMs: number
  ): Promise<void> {
    await db('search_history').insert({
      organization_id: organizationId,
      user_id: userId,
      search_query: config.query,
      filters: JSON.stringify({
        filters: config.filters,
        tagFilter: config.tagFilter,
        customFieldFilters: config.customFieldFilters,
      }),
      result_count: resultCount,
      execution_time_ms: executionTimeMs,
    });
  }

  /**
   * Get search suggestions based on history
   */
  async getSearchSuggestions(
    organizationId: string,
    userId: string,
    query: string
  ): Promise<string[]> {
    const suggestions = await db('search_history')
      .select('search_query')
      .where('organization_id', organizationId)
      .where('user_id', userId)
      .whereNotNull('search_query')
      .whereILike('search_query', `${query}%`)
      .groupBy('search_query')
      .orderByRaw('COUNT(*) DESC')
      .limit(10);

    return suggestions.map(s => s.search_query);
  }

  /**
   * Refresh the search index materialized view
   */
  async refreshSearchIndex(): Promise<void> {
    await db.raw('REFRESH MATERIALIZED VIEW CONCURRENTLY client_search_index');
  }
}

export const clientSearchService = new ClientSearchService();
```

### tRPC Router

```typescript
// src/server/routers/crm/search.router.ts
import { router, protectedProcedure, adminProcedure } from '@/server/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  SearchClientsInputSchema,
  CreateSavedSearchSchema,
  UpdateSavedSearchSchema,
  SearchConfigSchema,
} from './search.schema';
import { clientSearchService } from '@/server/services/crm/search.service';
import { db } from '@/server/db';
import { auditLog } from '@/server/services/audit.service';

export const searchRouter = router({
  /**
   * Search clients with advanced filtering
   */
  searchClients: protectedProcedure
    .input(SearchConfigSchema)
    .query(async ({ ctx, input }) => {
      const startTime = Date.now();

      const results = await clientSearchService.searchClients(
        ctx.organizationId,
        input,
        ctx.userId
      );

      await auditLog({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'CLIENT_SEARCH',
        entityType: 'CLIENT',
        metadata: {
          query: input.query,
          filterCount: input.filters.length,
          resultCount: results.pagination.totalItems,
          executionTimeMs: Date.now() - startTime,
        },
      });

      return results;
    }),

  /**
   * Get search suggestions based on user history
   */
  getSuggestions: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      return clientSearchService.getSearchSuggestions(
        ctx.organizationId,
        ctx.userId,
        input.query
      );
    }),

  /**
   * Get saved searches for user
   */
  getSavedSearches: protectedProcedure
    .query(async ({ ctx }) => {
      const searches = await db('saved_searches')
        .select('*')
        .where('organization_id', ctx.organizationId)
        .where(function() {
          this.where('created_by', ctx.userId)
            .orWhere('is_shared', true);
        })
        .orderBy('usage_count', 'desc')
        .orderBy('name', 'asc');

      return searches.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        searchConfig: s.search_config,
        isShared: s.is_shared,
        isDefault: s.is_default,
        isOwner: s.created_by === ctx.userId,
        usageCount: s.usage_count,
        lastUsedAt: s.last_used_at,
        createdAt: s.created_at,
      }));
    }),

  /**
   * Create saved search
   */
  createSavedSearch: protectedProcedure
    .input(CreateSavedSearchSchema)
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate name
      const existing = await db('saved_searches')
        .where('organization_id', ctx.organizationId)
        .where('created_by', ctx.userId)
        .where('name', input.name)
        .first();

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Saved search with this name already exists',
        });
      }

      // If setting as default, unset other defaults
      if (input.isDefault) {
        await db('saved_searches')
          .where('organization_id', ctx.organizationId)
          .where('created_by', ctx.userId)
          .update({ is_default: false });
      }

      const [savedSearch] = await db('saved_searches')
        .insert({
          organization_id: ctx.organizationId,
          created_by: ctx.userId,
          name: input.name,
          description: input.description,
          search_config: input.searchConfig,
          is_shared: input.isShared,
          is_default: input.isDefault,
        })
        .returning('*');

      await auditLog({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'SAVED_SEARCH_CREATED',
        entityType: 'SAVED_SEARCH',
        entityId: savedSearch.id,
        newValue: input,
      });

      return {
        id: savedSearch.id,
        name: savedSearch.name,
        description: savedSearch.description,
        searchConfig: savedSearch.search_config,
        isShared: savedSearch.is_shared,
        isDefault: savedSearch.is_default,
        createdAt: savedSearch.created_at,
      };
    }),

  /**
   * Update saved search
   */
  updateSavedSearch: protectedProcedure
    .input(UpdateSavedSearchSchema)
    .mutation(async ({ ctx, input }) => {
      // Check ownership
      const existing = await db('saved_searches')
        .where('id', input.id)
        .where('organization_id', ctx.organizationId)
        .first();

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Saved search not found',
        });
      }

      if (existing.created_by !== ctx.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only update your own saved searches',
        });
      }

      // If setting as default, unset other defaults
      if (input.isDefault) {
        await db('saved_searches')
          .where('organization_id', ctx.organizationId)
          .where('created_by', ctx.userId)
          .whereNot('id', input.id)
          .update({ is_default: false });
      }

      const updateData: Record<string, any> = { updated_at: new Date() };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.searchConfig !== undefined) updateData.search_config = input.searchConfig;
      if (input.isShared !== undefined) updateData.is_shared = input.isShared;
      if (input.isDefault !== undefined) updateData.is_default = input.isDefault;

      const [updated] = await db('saved_searches')
        .where('id', input.id)
        .update(updateData)
        .returning('*');

      await auditLog({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'SAVED_SEARCH_UPDATED',
        entityType: 'SAVED_SEARCH',
        entityId: input.id,
        previousValue: existing,
        newValue: updated,
      });

      return updated;
    }),

  /**
   * Delete saved search
   */
  deleteSavedSearch: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db('saved_searches')
        .where('id', input.id)
        .where('organization_id', ctx.organizationId)
        .first();

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Saved search not found',
        });
      }

      if (existing.created_by !== ctx.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete your own saved searches',
        });
      }

      await db('saved_searches').where('id', input.id).delete();

      await auditLog({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'SAVED_SEARCH_DELETED',
        entityType: 'SAVED_SEARCH',
        entityId: input.id,
        previousValue: existing,
      });

      return { success: true };
    }),

  /**
   * Use saved search (increment usage, return config)
   */
  useSavedSearch: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const savedSearch = await db('saved_searches')
        .where('id', input.id)
        .where('organization_id', ctx.organizationId)
        .where(function() {
          this.where('created_by', ctx.userId)
            .orWhere('is_shared', true);
        })
        .first();

      if (!savedSearch) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Saved search not found',
        });
      }

      // Update usage stats
      await db('saved_searches')
        .where('id', input.id)
        .update({
          usage_count: db.raw('usage_count + 1'),
          last_used_at: new Date(),
        });

      return {
        searchConfig: savedSearch.search_config,
      };
    }),

  /**
   * Export search results
   */
  exportSearchResults: protectedProcedure
    .input(z.object({
      searchConfig: SearchConfigSchema,
      format: z.enum(['csv', 'excel', 'json']),
      fields: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get all results (without pagination limit for export)
      const exportConfig = {
        ...input.searchConfig,
        page: 1,
        pageSize: 10000, // Max export limit
        includeContacts: true,
        includeTags: true,
        includeCustomFields: true,
      };

      const results = await clientSearchService.searchClients(
        ctx.organizationId,
        exportConfig,
        ctx.userId
      );

      await auditLog({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'CLIENT_SEARCH_EXPORTED',
        entityType: 'CLIENT',
        metadata: {
          format: input.format,
          recordCount: results.items.length,
          filterCount: input.searchConfig.filters.length,
        },
      });

      // Return data for client-side export generation
      // In production, this would generate and return a signed URL to a file
      return {
        data: results.items,
        format: input.format,
        recordCount: results.items.length,
        exportedAt: new Date().toISOString(),
      };
    }),

  /**
   * Refresh search index (admin only)
   */
  refreshSearchIndex: adminProcedure
    .mutation(async ({ ctx }) => {
      await clientSearchService.refreshSearchIndex();

      await auditLog({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'SEARCH_INDEX_REFRESHED',
        entityType: 'SYSTEM',
      });

      return { success: true };
    }),

  /**
   * Get search analytics (admin only)
   */
  getSearchAnalytics: adminProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      // Most common searches
      const topSearches = await db('search_history')
        .select('search_query')
        .count('* as count')
        .where('organization_id', ctx.organizationId)
        .whereBetween('created_at', [input.startDate, input.endDate])
        .whereNotNull('search_query')
        .groupBy('search_query')
        .orderByRaw('count DESC')
        .limit(10);

      // Search volume over time
      const volumeByDay = await db('search_history')
        .select(db.raw("DATE(created_at) as date"))
        .count('* as count')
        .where('organization_id', ctx.organizationId)
        .whereBetween('created_at', [input.startDate, input.endDate])
        .groupByRaw('DATE(created_at)')
        .orderBy('date');

      // Average execution time
      const avgExecutionTime = await db('search_history')
        .avg('execution_time_ms as avg')
        .where('organization_id', ctx.organizationId)
        .whereBetween('created_at', [input.startDate, input.endDate])
        .first();

      // Zero-result searches
      const zeroResultSearches = await db('search_history')
        .select('search_query')
        .count('* as count')
        .where('organization_id', ctx.organizationId)
        .whereBetween('created_at', [input.startDate, input.endDate])
        .where('result_count', 0)
        .groupBy('search_query')
        .orderByRaw('count DESC')
        .limit(10);

      return {
        topSearches,
        volumeByDay,
        avgExecutionTimeMs: avgExecutionTime?.avg || 0,
        zeroResultSearches,
      };
    }),
});
```

---

## Test Specification

### Unit Tests

```typescript
// src/server/services/crm/__tests__/search.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientSearchService } from '../search.service';
import { db } from '@/server/db';

vi.mock('@/server/db');

describe('ClientSearchService', () => {
  let service: ClientSearchService;

  beforeEach(() => {
    service = new ClientSearchService();
    vi.clearAllMocks();
  });

  describe('normalizePolish', () => {
    it('should normalize Polish diacritics', () => {
      const input = 'Żółta Łódź';
      const result = (service as any).normalizePolish(input);
      expect(result).toBe('zolta lodz');
    });

    it('should handle mixed case with diacritics', () => {
      const input = 'ŚWIĘTY Mikołaj';
      const result = (service as any).normalizePolish(input);
      expect(result).toBe('swiety mikolaj');
    });

    it('should preserve non-Polish characters', () => {
      const input = 'ABC Company 123';
      const result = (service as any).normalizePolish(input);
      expect(result).toBe('abc company 123');
    });
  });

  describe('mapFilterField', () => {
    it('should map camelCase to snake_case', () => {
      expect((service as any).mapFilterField('companyName')).toBe('company_name');
      expect((service as any).mapFilterField('vatStatus')).toBe('vat_status');
      expect((service as any).mapFilterField('createdAt')).toBe('created_at');
    });

    it('should return original if no mapping exists', () => {
      expect((service as any).mapFilterField('unknown')).toBe('unknown');
    });
  });

  describe('extractCustomFieldValue', () => {
    it('should extract text values', () => {
      const cf = { field_type: 'TEXT', value_text: 'test' };
      expect((service as any).extractCustomFieldValue(cf)).toBe('test');
    });

    it('should extract number values', () => {
      const cf = { field_type: 'NUMBER', value_number: 42 };
      expect((service as any).extractCustomFieldValue(cf)).toBe(42);
    });

    it('should extract boolean values', () => {
      const cf = { field_type: 'CHECKBOX', value_boolean: true };
      expect((service as any).extractCustomFieldValue(cf)).toBe(true);
    });

    it('should extract date values', () => {
      const date = new Date('2024-01-15');
      const cf = { field_type: 'DATE', value_date: date };
      expect((service as any).extractCustomFieldValue(cf)).toBe(date);
    });
  });
});
```

### Integration Tests

```typescript
// src/server/routers/crm/__tests__/search.router.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, createTestClient } from '@/test/helpers';
import { db } from '@/server/db';

describe('Search Router Integration', () => {
  let ctx: TestContext;
  let orgId: string;
  let userId: string;

  beforeEach(async () => {
    ctx = await createTestContext();
    orgId = ctx.organizationId;
    userId = ctx.userId;

    // Create test clients
    await db('clients').insert([
      {
        organization_id: orgId,
        company_name: 'ABC Sp. z o.o.',
        nip: '1234567890',
        status: 'ACTIVE',
        vat_status: 'ACTIVE',
        tax_form: 'VAT',
        city: 'Warszawa',
      },
      {
        organization_id: orgId,
        company_name: 'XYZ Services',
        nip: '9876543210',
        status: 'ACTIVE',
        vat_status: 'NOT_REGISTERED',
        tax_form: 'PIT',
        city: 'Kraków',
      },
      {
        organization_id: orgId,
        company_name: 'Żółta Łódź Transport',
        nip: '5555555555',
        status: 'INACTIVE',
        vat_status: 'ACTIVE',
        tax_form: 'CIT',
        city: 'Łódź',
      },
    ]);

    // Refresh materialized view
    await db.raw('REFRESH MATERIALIZED VIEW client_search_index');
  });

  afterEach(async () => {
    await db('clients').where('organization_id', orgId).delete();
    await db('saved_searches').where('organization_id', orgId).delete();
    await db('search_history').where('organization_id', orgId).delete();
  });

  describe('searchClients', () => {
    it('should search by full-text query', async () => {
      const caller = createTestClient(ctx);

      const results = await caller.crm.search.searchClients({
        query: 'ABC',
      });

      expect(results.items).toHaveLength(1);
      expect(results.items[0].companyName).toBe('ABC Sp. z o.o.');
    });

    it('should search with Polish diacritics normalization', async () => {
      const caller = createTestClient(ctx);

      const results = await caller.crm.search.searchClients({
        query: 'zolta lodz',
      });

      expect(results.items).toHaveLength(1);
      expect(results.items[0].companyName).toBe('Żółta Łódź Transport');
    });

    it('should filter by status', async () => {
      const caller = createTestClient(ctx);

      const results = await caller.crm.search.searchClients({
        filters: [
          { field: 'status', operator: 'EQUALS', value: 'ACTIVE' },
        ],
      });

      expect(results.items).toHaveLength(2);
      expect(results.items.every(c => c.status === 'ACTIVE')).toBe(true);
    });

    it('should combine multiple filters', async () => {
      const caller = createTestClient(ctx);

      const results = await caller.crm.search.searchClients({
        filters: [
          { field: 'status', operator: 'EQUALS', value: 'ACTIVE' },
          { field: 'vatStatus', operator: 'EQUALS', value: 'ACTIVE' },
        ],
      });

      expect(results.items).toHaveLength(1);
      expect(results.items[0].companyName).toBe('ABC Sp. z o.o.');
    });

    it('should paginate results', async () => {
      const caller = createTestClient(ctx);

      const results = await caller.crm.search.searchClients({
        page: 1,
        pageSize: 2,
      });

      expect(results.items).toHaveLength(2);
      expect(results.pagination.totalItems).toBe(3);
      expect(results.pagination.totalPages).toBe(2);
      expect(results.pagination.hasNextPage).toBe(true);
    });

    it('should include execution metadata', async () => {
      const caller = createTestClient(ctx);

      const results = await caller.crm.search.searchClients({
        query: 'ABC',
        filters: [{ field: 'status', operator: 'EQUALS', value: 'ACTIVE' }],
      });

      expect(results.meta.executionTimeMs).toBeGreaterThan(0);
      expect(results.meta.appliedFilters).toBe(1);
      expect(results.meta.searchQuery).toBe('ABC');
    });
  });

  describe('saved searches', () => {
    it('should create and retrieve saved search', async () => {
      const caller = createTestClient(ctx);

      // Create
      const created = await caller.crm.search.createSavedSearch({
        name: 'Active Clients',
        searchConfig: {
          filters: [{ field: 'status', operator: 'EQUALS', value: 'ACTIVE' }],
        },
      });

      expect(created.name).toBe('Active Clients');

      // Retrieve
      const searches = await caller.crm.search.getSavedSearches();
      expect(searches).toHaveLength(1);
      expect(searches[0].name).toBe('Active Clients');
    });

    it('should share saved search with organization', async () => {
      const caller = createTestClient(ctx);

      await caller.crm.search.createSavedSearch({
        name: 'Shared Search',
        searchConfig: { filters: [] },
        isShared: true,
      });

      // Other user should see it
      const otherCtx = await createTestContext({ organizationId: orgId });
      const otherCaller = createTestClient(otherCtx);

      const searches = await otherCaller.crm.search.getSavedSearches();
      expect(searches.some(s => s.name === 'Shared Search')).toBe(true);
    });

    it('should track usage count', async () => {
      const caller = createTestClient(ctx);

      const created = await caller.crm.search.createSavedSearch({
        name: 'Tracked Search',
        searchConfig: { filters: [] },
      });

      // Use the search
      await caller.crm.search.useSavedSearch({ id: created.id });
      await caller.crm.search.useSavedSearch({ id: created.id });

      const searches = await caller.crm.search.getSavedSearches();
      const tracked = searches.find(s => s.id === created.id);
      expect(tracked?.usageCount).toBe(2);
    });
  });
});
```

### E2E Tests

```typescript
// e2e/crm/search.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsAccountant, createTestClient } from '../helpers';

test.describe('CRM Advanced Search', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAccountant(page);
    await page.goto('/crm/clients');
  });

  test('should search clients by name', async ({ page }) => {
    await page.getByPlaceholder('Search clients...').fill('ABC');
    await page.keyboard.press('Enter');

    await expect(page.getByText('ABC Sp. z o.o.')).toBeVisible();
    await expect(page.getByText('XYZ Services')).not.toBeVisible();
  });

  test('should filter by status', async ({ page }) => {
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByLabel('Status').selectOption('ACTIVE');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page.getByTestId('filter-badge')).toContainText('1 filter');

    // All visible clients should be active
    const statusCells = page.locator('[data-testid="client-status"]');
    for (const cell of await statusCells.all()) {
      await expect(cell).toHaveText('Active');
    }
  });

  test('should combine multiple filters', async ({ page }) => {
    await page.getByRole('button', { name: 'Filters' }).click();

    await page.getByLabel('Status').selectOption('ACTIVE');
    await page.getByLabel('VAT Status').selectOption('ACTIVE');
    await page.getByLabel('Tax Form').selectOption('VAT');

    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page.getByTestId('filter-badge')).toContainText('3 filters');

    // Should show only matching client
    await expect(page.getByText('ABC Sp. z o.o.')).toBeVisible();
    await expect(page.locator('[data-testid="client-row"]')).toHaveCount(1);
  });

  test('should save and load search', async ({ page }) => {
    // Apply filter
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByLabel('Status').selectOption('ACTIVE');
    await page.getByRole('button', { name: 'Apply' }).click();

    // Save search
    await page.getByRole('button', { name: 'Save Search' }).click();
    await page.getByLabel('Search Name').fill('Active Clients');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('Search saved')).toBeVisible();

    // Clear filters
    await page.getByRole('button', { name: 'Clear All' }).click();

    // Load saved search
    await page.getByRole('button', { name: 'Saved Searches' }).click();
    await page.getByText('Active Clients').click();

    // Verify filters are restored
    await expect(page.getByTestId('filter-badge')).toContainText('1 filter');
  });

  test('should export search results', async ({ page }) => {
    await page.getByPlaceholder('Search clients...').fill('ABC');
    await page.keyboard.press('Enter');

    const downloadPromise = page.waitForEvent('download');

    await page.getByRole('button', { name: 'Export' }).click();
    await page.getByText('Excel').click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.xlsx');
  });

  test('should sort results by column', async ({ page }) => {
    // Click company name header to sort
    await page.getByRole('columnheader', { name: 'Company Name' }).click();

    // First client should be first alphabetically
    const firstRow = page.locator('[data-testid="client-row"]').first();
    await expect(firstRow).toContainText('ABC');

    // Click again to reverse
    await page.getByRole('columnheader', { name: 'Company Name' }).click();

    // Now should be last alphabetically
    const firstRowAfter = page.locator('[data-testid="client-row"]').first();
    await expect(firstRowAfter).toContainText('Żółta');
  });

  test('should paginate results', async ({ page }) => {
    // Create many test clients first
    // ...

    await expect(page.getByTestId('pagination')).toBeVisible();
    await expect(page.getByText('Page 1 of')).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('Page 2 of')).toBeVisible();
  });
});
```

---

## Security Checklist

- [x] **Input Validation**: All search inputs validated with Zod schemas
- [x] **SQL Injection Prevention**: Parameterized queries with Knex
- [x] **XSS Prevention**: Search queries sanitized before display
- [x] **Rate Limiting**: Search endpoint has request limits
- [x] **Data Access Control**: RLS policies on all tables
- [x] **Organization Isolation**: All queries scoped to organization
- [x] **Audit Logging**: All search operations logged
- [x] **Export Limits**: Maximum 10,000 records per export
- [x] **Saved Search Ownership**: Users can only modify own searches
- [x] **Performance Protection**: Query complexity limits applied

---

## Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `CLIENT_SEARCH` | Search executed | Query, filters, result count, execution time |
| `SAVED_SEARCH_CREATED` | Save search preset | Search name, configuration |
| `SAVED_SEARCH_UPDATED` | Modify saved search | Changed fields |
| `SAVED_SEARCH_DELETED` | Delete saved search | Search ID |
| `CLIENT_SEARCH_EXPORTED` | Export results | Format, record count |
| `SEARCH_INDEX_REFRESHED` | Admin refresh index | Timestamp |

---

## Implementation Notes

### Performance Considerations

1. **Materialized View**: Use `client_search_index` for fast searches
2. **Concurrent Refresh**: Index refreshes don't block queries
3. **GIN Indexes**: For full-text search and array operations
4. **Trigram Index**: For fuzzy matching and substring searches
5. **Query Optimization**: Limit results before enrichment
6. **Caching**: Cache frequent searches in Redis

### Polish Language Support

1. **Full-Text Search**: Uses PostgreSQL `polish` dictionary
2. **Diacritics Normalization**: Custom `normalizePolish()` function
3. **`unaccent` Extension**: Required for normalized name column
4. **Trigram Matching**: For partial matches with diacritics

### Search Index Maintenance

1. **Automatic Refresh**: Trigger on client changes
2. **Concurrent Refresh**: Prevents blocking during updates
3. **Manual Refresh**: Admin endpoint for force refresh
4. **Scheduled Refresh**: Consider cron job for large datasets

---

## Related Stories

- **CRM-001**: Client Profile Management (data source)
- **CRM-006**: Custom Fields System (custom field filtering)
- **CRM-007**: Tagging and Categorization (tag filtering)
- **CRM-010**: Bulk Operations (bulk actions on results)

---

*Last updated: December 2024*
