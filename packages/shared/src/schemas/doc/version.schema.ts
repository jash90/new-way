// DOC-006: Document Versioning Schemas
// Schemas for version control, history tracking, and document comparison

import { z } from 'zod';
import { documentCategorySchema, supportedFileTypeSchema } from './document.schema';

// =========================================================================
// ENUMS
// =========================================================================

/**
 * Version change type
 */
export const versionChangeTypeSchema = z.enum([
  'CREATED',
  'UPLOADED',
  'METADATA_UPDATED',
  'CONTENT_REPLACED',
  'REPROCESSED',
  'RESTORED',
  'MERGED',
]);
export type VersionChangeType = z.infer<typeof versionChangeTypeSchema>;

/**
 * Version status
 */
export const versionStatusSchema = z.enum([
  'ACTIVE',
  'SUPERSEDED',
  'ARCHIVED',
  'DELETED',
]);
export type VersionStatus = z.infer<typeof versionStatusSchema>;

/**
 * Comparison result type
 */
export const comparisonResultTypeSchema = z.enum([
  'IDENTICAL',
  'METADATA_ONLY',
  'CONTENT_ONLY',
  'BOTH',
]);
export type ComparisonResultType = z.infer<typeof comparisonResultTypeSchema>;

// =========================================================================
// ENTITY SCHEMAS
// =========================================================================

/**
 * Document version entity
 */
export const documentVersionSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  versionNumber: z.number().int().min(1),

  // Version status
  status: versionStatusSchema,
  isLatest: z.boolean(),

  // File information
  fileName: z.string().min(1).max(500),
  fileType: supportedFileTypeSchema,
  fileSize: z.number().int().positive(),
  storageKey: z.string().min(1).max(500),
  checksumMd5: z.string().length(32).nullish(),
  checksumSha256: z.string().length(64).nullish(),

  // Change information
  changeType: versionChangeTypeSchema,
  changeDescription: z.string().max(1000).nullish(),
  changedFields: z.array(z.string()).optional(),

  // Metadata snapshot
  metadataSnapshot: z.record(z.string(), z.unknown()).optional(),

  // Previous version reference
  previousVersionId: z.string().uuid().nullish(),

  // Audit
  createdBy: z.string().uuid(),
  createdAt: z.date(),
});
export type DocumentVersion = z.infer<typeof documentVersionSchema>;

/**
 * Version list item (summary view)
 */
export const versionListItemSchema = documentVersionSchema.pick({
  id: true,
  documentId: true,
  versionNumber: true,
  status: true,
  isLatest: true,
  fileName: true,
  fileType: true,
  fileSize: true,
  changeType: true,
  changeDescription: true,
  createdBy: true,
  createdAt: true,
});
export type VersionListItem = z.infer<typeof versionListItemSchema>;

/**
 * Version change record
 */
export const versionChangeRecordSchema = z.object({
  field: z.string(),
  previousValue: z.unknown().nullish(),
  newValue: z.unknown().nullish(),
  changeType: z.enum(['added', 'modified', 'removed']),
});
export type VersionChangeRecord = z.infer<typeof versionChangeRecordSchema>;

// =========================================================================
// INPUT SCHEMAS
// =========================================================================

/**
 * Create new version input
 */
export const createVersionInputSchema = z.object({
  documentId: z.string().uuid(),

  // New file (if content replaced)
  fileName: z.string().min(1).max(500).optional(),
  fileType: supportedFileTypeSchema.optional(),
  fileSize: z.number().int().positive().optional(),
  storageKey: z.string().min(1).max(500).optional(),
  checksumMd5: z.string().length(32).optional(),
  checksumSha256: z.string().length(64).optional(),

  // Change information
  changeType: versionChangeTypeSchema,
  changeDescription: z.string().max(1000).optional(),
  changedFields: z.array(z.string()).optional(),
});
export type CreateVersionInput = z.infer<typeof createVersionInputSchema>;

/**
 * Get version history input
 */
export const getVersionHistoryInputSchema = z.object({
  documentId: z.string().uuid(),

  // Filters
  changeTypes: z.array(versionChangeTypeSchema).optional(),
  statuses: z.array(versionStatusSchema).optional(),
  createdBy: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),

  // Pagination
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(50).optional().default(10),

  // Sorting
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});
export type GetVersionHistoryInput = z.infer<typeof getVersionHistoryInputSchema>;

/**
 * Get specific version input
 */
export const getVersionInputSchema = z.object({
  documentId: z.string().uuid(),
  versionNumber: z.number().int().min(1).optional(),
  versionId: z.string().uuid().optional(),
}).refine(
  (data) => data.versionNumber !== undefined || data.versionId !== undefined,
  { message: 'Either versionNumber or versionId must be provided' }
);
export type GetVersionInput = z.infer<typeof getVersionInputSchema>;

/**
 * Compare versions input
 */
export const compareVersionsInputSchema = z.object({
  documentId: z.string().uuid(),
  sourceVersionNumber: z.number().int().min(1),
  targetVersionNumber: z.number().int().min(1),
  includeContent: z.boolean().optional().default(false),
}).refine(
  (data) => data.sourceVersionNumber !== data.targetVersionNumber,
  { message: 'Source and target versions must be different' }
);
export type CompareVersionsInput = z.infer<typeof compareVersionsInputSchema>;

/**
 * Restore version input
 */
export const restoreVersionInputSchema = z.object({
  documentId: z.string().uuid(),
  versionNumber: z.number().int().min(1),
  reason: z.string().max(500).optional(),
});
export type RestoreVersionInput = z.infer<typeof restoreVersionInputSchema>;

/**
 * Delete version input
 */
export const deleteVersionInputSchema = z.object({
  documentId: z.string().uuid(),
  versionNumber: z.number().int().min(1),
  permanent: z.boolean().optional().default(false),
});
export type DeleteVersionInput = z.infer<typeof deleteVersionInputSchema>;

/**
 * Merge versions input
 */
export const mergeVersionsInputSchema = z.object({
  documentId: z.string().uuid(),
  sourceVersionNumbers: z.array(z.number().int().min(1)).min(2),
  mergeStrategy: z.enum(['latest', 'combine', 'custom']).optional().default('latest'),
  customMergeRules: z.record(z.string(), z.enum(['source', 'target', 'combine'])).optional(),
  description: z.string().max(500).optional(),
});
export type MergeVersionsInput = z.infer<typeof mergeVersionsInputSchema>;

// =========================================================================
// OUTPUT SCHEMAS
// =========================================================================

/**
 * Version history response
 */
export const versionHistoryResponseSchema = z.object({
  documentId: z.string().uuid(),
  currentVersion: z.number().int().min(1),
  totalVersions: z.number().int().min(0),
  versions: z.array(versionListItemSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    totalItems: z.number().int().min(0),
    totalPages: z.number().int().min(0),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
});
export type VersionHistoryResponse = z.infer<typeof versionHistoryResponseSchema>;

/**
 * Version detail response
 */
export const versionDetailResponseSchema = documentVersionSchema.extend({
  downloadUrl: z.string().url().optional(),
  previousVersion: versionListItemSchema.nullish(),
  nextVersion: versionListItemSchema.nullish(),
});
export type VersionDetailResponse = z.infer<typeof versionDetailResponseSchema>;

/**
 * Version comparison result
 */
export const versionComparisonResultSchema = z.object({
  documentId: z.string().uuid(),
  sourceVersion: versionListItemSchema,
  targetVersion: versionListItemSchema,

  // Comparison result
  resultType: comparisonResultTypeSchema,

  // Metadata changes
  metadataChanges: z.array(versionChangeRecordSchema),

  // Content comparison (if requested)
  contentComparison: z.object({
    sizeChange: z.number().int(),
    checksumMatch: z.boolean(),
    textDiff: z.string().optional(), // For text-based documents
    pageDifferences: z.array(z.object({
      pageNumber: z.number().int().min(1),
      changeType: z.enum(['added', 'modified', 'removed']),
    })).optional(),
  }).optional(),

  // Summary
  summary: z.object({
    totalChanges: z.number().int().min(0),
    metadataChanges: z.number().int().min(0),
    contentChanged: z.boolean(),
    timeBetweenVersions: z.number().int(), // seconds
  }),
});
export type VersionComparisonResult = z.infer<typeof versionComparisonResultSchema>;

/**
 * Restore version response
 */
export const restoreVersionResponseSchema = z.object({
  success: z.boolean(),
  documentId: z.string().uuid(),
  restoredFromVersion: z.number().int().min(1),
  newVersion: z.number().int().min(1),
  newVersionId: z.string().uuid(),
});
export type RestoreVersionResponse = z.infer<typeof restoreVersionResponseSchema>;

/**
 * Merge versions response
 */
export const mergeVersionsResponseSchema = z.object({
  success: z.boolean(),
  documentId: z.string().uuid(),
  mergedVersionNumbers: z.array(z.number().int().min(1)),
  newVersion: z.number().int().min(1),
  newVersionId: z.string().uuid(),
  mergeReport: z.object({
    fieldsFromSource: z.array(z.string()),
    fieldsFromTarget: z.array(z.string()),
    combinedFields: z.array(z.string()),
    conflicts: z.array(z.object({
      field: z.string(),
      resolution: z.string(),
    })),
  }),
});
export type MergeVersionsResponse = z.infer<typeof mergeVersionsResponseSchema>;

// =========================================================================
// VERSION RETENTION POLICIES
// =========================================================================

/**
 * Version retention policy
 */
export const versionRetentionPolicySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),

  // Retention rules
  maxVersions: z.number().int().min(1).max(1000).optional(),
  maxAgeInDays: z.number().int().min(1).max(3650).optional(),
  keepFirstVersion: z.boolean().optional().default(true),
  keepLatestVersion: z.boolean().optional().default(true),
  keepMajorVersions: z.boolean().optional().default(false),

  // Application scope
  applyToCategories: z.array(documentCategorySchema).optional(),
  applyToOrganizationId: z.string().uuid().optional(),

  // Status
  isActive: z.boolean().default(true),

  // Audit
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type VersionRetentionPolicy = z.infer<typeof versionRetentionPolicySchema>;

/**
 * Create retention policy input
 */
export const createRetentionPolicyInputSchema = versionRetentionPolicySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateRetentionPolicyInput = z.infer<typeof createRetentionPolicyInputSchema>;

/**
 * Update retention policy input
 */
export const updateRetentionPolicyInputSchema = z.object({
  policyId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  maxVersions: z.number().int().min(1).max(1000).optional(),
  maxAgeInDays: z.number().int().min(1).max(3650).optional(),
  keepFirstVersion: z.boolean().optional(),
  keepLatestVersion: z.boolean().optional(),
  keepMajorVersions: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateRetentionPolicyInput = z.infer<typeof updateRetentionPolicyInputSchema>;

// =========================================================================
// VERSION HELPERS
// =========================================================================

/**
 * Check if version number is valid
 */
export const isValidVersionNumber = (version: number): boolean => {
  return Number.isInteger(version) && version >= 1;
};

/**
 * Format version number for display
 */
export const formatVersionNumber = (version: number, prefix: string = 'v'): string => {
  return `${prefix}${version}`;
};

/**
 * Parse version string to number
 */
export const parseVersionString = (versionString: string): number | null => {
  const match = versionString.match(/v?(\d+)/);
  if (!match || !match[1]) return null;
  const version = parseInt(match[1], 10);
  return isValidVersionNumber(version) ? version : null;
};
