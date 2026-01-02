// DOC-005: Document Search Schemas
// Schemas for full-text search, filtering, and advanced query capabilities

import { z } from 'zod';
import {
  documentCategorySchema,
  documentSourceSchema,
  documentStatusSchema,
  documentVisibilitySchema,
  processingStatusSchema,
  supportedFileTypeSchema,
} from './document.schema';

// =========================================================================
// ENUMS
// =========================================================================

/**
 * Search result sort options
 */
export const searchSortFieldSchema = z.enum([
  'relevance',
  'createdAt',
  'updatedAt',
  'uploadedAt',
  'documentDate',
  'fileName',
  'fileSize',
]);
export type SearchSortField = z.infer<typeof searchSortFieldSchema>;

/**
 * Search operator for combining conditions
 */
export const searchOperatorSchema = z.enum(['AND', 'OR']);
export type SearchOperator = z.infer<typeof searchOperatorSchema>;

/**
 * Field match type for search
 */
export const matchTypeSchema = z.enum([
  'exact',
  'contains',
  'startsWith',
  'endsWith',
  'fuzzy',
]);
export type MatchType = z.infer<typeof matchTypeSchema>;

// =========================================================================
// INPUT SCHEMAS
// =========================================================================

/**
 * Basic text search input
 */
export const textSearchInputSchema = z.object({
  query: z.string().min(1).max(500),
  fields: z.array(z.enum([
    'title',
    'description',
    'fileName',
    'documentNumber',
    'referenceNumber',
    'searchContent',
    'tags',
  ])).optional(),
  matchType: matchTypeSchema.optional().default('contains'),
  caseSensitive: z.boolean().optional().default(false),
});
export type TextSearchInput = z.infer<typeof textSearchInputSchema>;

/**
 * Date range filter
 */
export const dateRangeFilterSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine(
  (data) => {
    if (data.from && data.to) {
      return data.from <= data.to;
    }
    return true;
  },
  { message: 'From date must be before or equal to to date' }
);
export type DateRangeFilter = z.infer<typeof dateRangeFilterSchema>;

/**
 * Numeric range filter
 */
export const numericRangeFilterSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
}).refine(
  (data) => {
    if (data.min !== undefined && data.max !== undefined) {
      return data.min <= data.max;
    }
    return true;
  },
  { message: 'Min must be less than or equal to max' }
);
export type NumericRangeFilter = z.infer<typeof numericRangeFilterSchema>;

/**
 * Advanced filter condition
 */
export const filterConditionSchema = z.object({
  field: z.string(),
  operator: z.enum([
    'equals',
    'notEquals',
    'contains',
    'notContains',
    'startsWith',
    'endsWith',
    'greaterThan',
    'lessThan',
    'greaterThanOrEqual',
    'lessThanOrEqual',
    'in',
    'notIn',
    'isNull',
    'isNotNull',
  ]),
  value: z.unknown(),
});
export type FilterCondition = z.infer<typeof filterConditionSchema>;

/**
 * Filter group for complex queries
 */
export const filterGroupSchema: z.ZodType<{
  operator: 'AND' | 'OR';
  conditions: (FilterCondition | FilterGroup)[];
}> = z.object({
  operator: searchOperatorSchema,
  conditions: z.array(z.lazy(() => z.union([filterConditionSchema, filterGroupSchema]))),
});
export type FilterGroup = z.infer<typeof filterGroupSchema>;

/**
 * Facet request for aggregation
 */
export const facetRequestSchema = z.object({
  field: z.enum([
    'category',
    'source',
    'status',
    'visibility',
    'fileType',
    'ocrStatus',
    'extractionStatus',
    'classificationStatus',
    'tags',
  ]),
  limit: z.number().int().min(1).max(100).optional().default(10),
  minCount: z.number().int().min(0).optional().default(1),
});
export type FacetRequest = z.infer<typeof facetRequestSchema>;

/**
 * Comprehensive document search input
 */
export const documentSearchInputSchema = z.object({
  // Text search
  query: z.string().max(500).optional(),
  searchFields: z.array(z.string()).optional(),
  matchType: matchTypeSchema.optional(),

  // Entity filters
  clientId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),

  // Document filters
  categories: z.array(documentCategorySchema).optional(),
  sources: z.array(documentSourceSchema).optional(),
  statuses: z.array(documentStatusSchema).optional(),
  visibilities: z.array(documentVisibilitySchema).optional(),
  fileTypes: z.array(supportedFileTypeSchema).optional(),

  // Processing status filters
  ocrStatuses: z.array(processingStatusSchema).optional(),
  extractionStatuses: z.array(processingStatusSchema).optional(),
  classificationStatuses: z.array(processingStatusSchema).optional(),

  // Date filters
  documentDateRange: dateRangeFilterSchema.optional(),
  uploadedAtRange: dateRangeFilterSchema.optional(),
  createdAtRange: dateRangeFilterSchema.optional(),
  updatedAtRange: dateRangeFilterSchema.optional(),

  // Size filter
  fileSizeRange: numericRangeFilterSchema.optional(),

  // Tags
  tags: z.array(z.string().max(50)).optional(),
  tagOperator: searchOperatorSchema.optional().default('AND'),

  // Related entities
  journalEntryId: z.string().uuid().optional(),
  vatTransactionId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),

  // Version control
  latestOnly: z.boolean().optional().default(true),
  includeArchived: z.boolean().optional().default(false),
  includeDeleted: z.boolean().optional().default(false),

  // Advanced filters
  advancedFilters: filterGroupSchema.optional(),

  // Facets
  facets: z.array(facetRequestSchema).optional(),

  // Pagination
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),

  // Sorting
  sortBy: searchSortFieldSchema.optional().default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),

  // Highlighting
  highlight: z.boolean().optional().default(false),
  highlightFields: z.array(z.string()).optional(),
  highlightPreTag: z.string().max(50).optional().default('<mark>'),
  highlightPostTag: z.string().max(50).optional().default('</mark>'),
});
export type DocumentSearchInput = z.infer<typeof documentSearchInputSchema>;

/**
 * Quick search input (simplified)
 */
export const quickSearchInputSchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(20).optional().default(5),
  categories: z.array(documentCategorySchema).optional(),
  clientId: z.string().uuid().optional(),
});
export type QuickSearchInput = z.infer<typeof quickSearchInputSchema>;

/**
 * Similar documents search input
 */
export const similarDocumentsInputSchema = z.object({
  documentId: z.string().uuid(),
  limit: z.number().int().min(1).max(20).optional().default(5),
  threshold: z.number().min(0).max(1).optional().default(0.7),
  includeContent: z.boolean().optional().default(false),
});
export type SimilarDocumentsInput = z.infer<typeof similarDocumentsInputSchema>;

// =========================================================================
// OUTPUT SCHEMAS
// =========================================================================

/**
 * Search highlight result
 */
export const searchHighlightSchema = z.object({
  field: z.string(),
  fragments: z.array(z.string()),
});
export type SearchHighlight = z.infer<typeof searchHighlightSchema>;

/**
 * Search result item
 */
export const searchResultItemSchema = z.object({
  id: z.string().uuid(),
  score: z.number().min(0).optional(),

  // Document summary
  fileName: z.string(),
  originalFileName: z.string(),
  fileType: supportedFileTypeSchema,
  fileSize: z.number().int().positive(),

  // Classification
  category: documentCategorySchema.nullish(),
  source: documentSourceSchema,
  status: documentStatusSchema,

  // Metadata
  title: z.string().nullish(),
  description: z.string().nullish(),
  documentDate: z.date().nullish(),
  documentNumber: z.string().nullish(),
  tags: z.array(z.string()),

  // Processing status
  ocrStatus: processingStatusSchema,
  extractionStatus: processingStatusSchema,

  // Timestamps
  uploadedAt: z.date(),
  createdAt: z.date(),

  // Highlights (if requested)
  highlights: z.array(searchHighlightSchema).optional(),
});
export type SearchResultItem = z.infer<typeof searchResultItemSchema>;

/**
 * Facet result value
 */
export const facetValueSchema = z.object({
  value: z.string(),
  count: z.number().int().min(0),
});
export type FacetValue = z.infer<typeof facetValueSchema>;

/**
 * Facet result
 */
export const facetResultSchema = z.object({
  field: z.string(),
  values: z.array(facetValueSchema),
  totalCount: z.number().int().min(0),
});
export type FacetResult = z.infer<typeof facetResultSchema>;

/**
 * Search response
 */
export const documentSearchResponseSchema = z.object({
  results: z.array(searchResultItemSchema),

  // Pagination
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    totalItems: z.number().int().min(0),
    totalPages: z.number().int().min(0),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),

  // Search metadata
  metadata: z.object({
    query: z.string().optional(),
    took: z.number().min(0), // milliseconds
    maxScore: z.number().min(0).optional(),
  }),

  // Facets (if requested)
  facets: z.array(facetResultSchema).optional(),
});
export type DocumentSearchResponse = z.infer<typeof documentSearchResponseSchema>;

/**
 * Quick search result
 */
export const quickSearchResultSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  title: z.string().nullish(),
  category: documentCategorySchema.nullish(),
  fileType: supportedFileTypeSchema,
  matchedField: z.string(),
  matchedText: z.string(),
});
export type QuickSearchResult = z.infer<typeof quickSearchResultSchema>;

/**
 * Quick search response
 */
export const quickSearchResponseSchema = z.object({
  results: z.array(quickSearchResultSchema),
  totalCount: z.number().int().min(0),
  took: z.number().min(0),
});
export type QuickSearchResponse = z.infer<typeof quickSearchResponseSchema>;

/**
 * Similar document result
 */
export const similarDocumentResultSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  title: z.string().nullish(),
  category: documentCategorySchema.nullish(),
  similarity: z.number().min(0).max(1),
  sharedTags: z.array(z.string()).optional(),
  contentPreview: z.string().optional(),
});
export type SimilarDocumentResult = z.infer<typeof similarDocumentResultSchema>;

/**
 * Similar documents response
 */
export const similarDocumentsResponseSchema = z.object({
  sourceDocument: z.object({
    id: z.string().uuid(),
    fileName: z.string(),
    title: z.string().nullish(),
  }),
  similarDocuments: z.array(similarDocumentResultSchema),
});
export type SimilarDocumentsResponse = z.infer<typeof similarDocumentsResponseSchema>;

// =========================================================================
// SEARCH SUGGESTIONS
// =========================================================================

/**
 * Search suggestion type
 */
export const suggestionTypeSchema = z.enum([
  'document',
  'tag',
  'category',
  'recent',
  'popular',
]);
export type SuggestionType = z.infer<typeof suggestionTypeSchema>;

/**
 * Search suggestion
 */
export const searchSuggestionSchema = z.object({
  type: suggestionTypeSchema,
  text: z.string(),
  highlight: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type SearchSuggestion = z.infer<typeof searchSuggestionSchema>;

/**
 * Search suggestions input
 */
export const searchSuggestionsInputSchema = z.object({
  query: z.string().min(1).max(100),
  limit: z.number().int().min(1).max(10).optional().default(5),
  types: z.array(suggestionTypeSchema).optional(),
  clientId: z.string().uuid().optional(),
});
export type SearchSuggestionsInput = z.infer<typeof searchSuggestionsInputSchema>;

/**
 * Search suggestions response
 */
export const searchSuggestionsResponseSchema = z.object({
  suggestions: z.array(searchSuggestionSchema),
});
export type SearchSuggestionsResponse = z.infer<typeof searchSuggestionsResponseSchema>;
