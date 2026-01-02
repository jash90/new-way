import { z } from 'zod';

// ===========================================
// SEARCH ENUMS
// ===========================================

export const searchSortFieldSchema = z.enum([
  'relevance',
  'displayName',
  'createdAt',
  'updatedAt',
  'companyName',
  'email',
]);

export const searchEntityTypeSchema = z.enum(['client', 'contact', 'all']);

export const dateRangePresetSchema = z.enum([
  'today',
  'yesterday',
  'last7days',
  'last30days',
  'last90days',
  'thisMonth',
  'lastMonth',
  'thisYear',
  'custom',
]);

// ===========================================
// ADVANCED SEARCH INPUT
// ===========================================

export const advancedSearchInputSchema = z.object({
  // Main search query
  query: z.string().max(500).optional(),

  // Entity type to search
  entityType: searchEntityTypeSchema.default('client'),

  // Filters
  filters: z
    .object({
      // Client type filter
      clientTypes: z
        .array(z.enum(['individual', 'company']))
        .optional(),

      // Status filter
      statuses: z
        .array(z.enum(['active', 'inactive', 'potential', 'archived']))
        .optional(),

      // Tags filter (match any)
      tags: z.array(z.string()).optional(),

      // Tags filter (match all)
      tagsMatchAll: z.boolean().default(false),

      // VAT status filter
      vatStatuses: z
        .array(z.enum(['ACTIVE', 'NOT_REGISTERED', 'INVALID', 'EXEMPT']))
        .optional(),

      // Date range for creation
      createdDateRange: z
        .object({
          preset: dateRangePresetSchema.optional(),
          from: z.date().optional(),
          to: z.date().optional(),
        })
        .optional(),

      // Date range for last update
      updatedDateRange: z
        .object({
          preset: dateRangePresetSchema.optional(),
          from: z.date().optional(),
          to: z.date().optional(),
        })
        .optional(),

      // Custom fields filter
      customFields: z
        .array(
          z.object({
            key: z.string(),
            value: z.string(),
            operator: z.enum(['equals', 'contains', 'startsWith', 'endsWith']).default('equals'),
          })
        )
        .optional(),

      // Has contact flag
      hasContact: z.boolean().optional(),

      // Has timeline events
      hasTimelineEvents: z.boolean().optional(),

      // Owner filter (for org admins)
      ownerIds: z.array(z.string().uuid()).optional(),
    })
    .optional(),

  // Sorting
  sortBy: searchSortFieldSchema.default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),

  // Pagination
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),

  // Include facets in response
  includeFacets: z.boolean().default(false),

  // Highlight matches in results
  highlightMatches: z.boolean().default(false),
});

export type AdvancedSearchInput = z.infer<typeof advancedSearchInputSchema>;

// ===========================================
// SEARCH SUGGESTION INPUT
// ===========================================

export const searchSuggestionInputSchema = z.object({
  query: z.string().min(2).max(100),
  entityType: searchEntityTypeSchema.default('all'),
  limit: z.number().int().min(1).max(10).default(5),
});

export type SearchSuggestionInput = z.infer<typeof searchSuggestionInputSchema>;

// ===========================================
// SAVED SEARCH SCHEMAS
// ===========================================

export const createSavedSearchSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  searchCriteria: advancedSearchInputSchema.omit({
    page: true,
    limit: true,
    includeFacets: true,
    highlightMatches: true,
  }),
  isDefault: z.boolean().default(false),
});

export type CreateSavedSearchInput = z.infer<typeof createSavedSearchSchema>;

export const updateSavedSearchSchema = z.object({
  searchId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  searchCriteria: advancedSearchInputSchema
    .omit({
      page: true,
      limit: true,
      includeFacets: true,
      highlightMatches: true,
    })
    .optional(),
  isDefault: z.boolean().optional(),
});

export type UpdateSavedSearchInput = z.infer<typeof updateSavedSearchSchema>;

export const deleteSavedSearchSchema = z.object({
  searchId: z.string().uuid(),
});

export type DeleteSavedSearchInput = z.infer<typeof deleteSavedSearchSchema>;

export const listSavedSearchesSchema = z.object({
  entityType: searchEntityTypeSchema.optional(),
});

export type ListSavedSearchesInput = z.infer<typeof listSavedSearchesSchema>;

// ===========================================
// OUTPUT TYPES
// ===========================================

export interface SearchResultItem {
  id: string;
  entityType: 'client' | 'contact';
  displayName: string;
  email: string | null;
  type?: 'individual' | 'company';
  status?: string;
  tags?: string[];
  highlights?: Record<string, string[]>;
  score?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchFacets {
  clientTypes: { value: string; count: number }[];
  statuses: { value: string; count: number }[];
  tags: { value: string; count: number }[];
  vatStatuses: { value: string; count: number }[];
  createdByMonth: { month: string; count: number }[];
}

export interface AdvancedSearchResult {
  results: SearchResultItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  facets?: SearchFacets;
  queryTime: number;
}

export interface SearchSuggestion {
  id: string;
  text: string;
  entityType: 'client' | 'contact';
  category: string;
}

export interface SearchSuggestionsResult {
  suggestions: SearchSuggestion[];
}

export interface SavedSearch {
  id: string;
  name: string;
  description: string | null;
  searchCriteria: Record<string, unknown>;
  isDefault: boolean;
  usageCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedSearchCreateResult {
  success: boolean;
  savedSearch: SavedSearch;
  message: string;
}

export interface SavedSearchUpdateResult {
  success: boolean;
  savedSearch: SavedSearch;
  message: string;
}

export interface SavedSearchDeleteResult {
  success: boolean;
  message: string;
}

export interface SavedSearchListResult {
  savedSearches: SavedSearch[];
  total: number;
}
