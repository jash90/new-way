// DOC-001: Document Management Schemas
// Core document entity schemas for upload, storage, and metadata management

import { z } from 'zod';

// =========================================================================
// ENUMS
// =========================================================================

/**
 * Document status in the workflow
 */
export const documentStatusSchema = z.enum([
  'PENDING_UPLOAD',
  'UPLOADING',
  'UPLOADED',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
  'ARCHIVED',
  'DELETED',
]);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

/**
 * Document category for classification
 */
export const documentCategorySchema = z.enum([
  'INVOICE',
  'RECEIPT',
  'CONTRACT',
  'BANK_STATEMENT',
  'TAX_DOCUMENT',
  'PAYROLL',
  'CORRESPONDENCE',
  'REPORT',
  'OTHER',
]);
export type DocumentCategory = z.infer<typeof documentCategorySchema>;

/**
 * Document source indicating origin
 */
export const documentSourceSchema = z.enum([
  'MANUAL_UPLOAD',
  'EMAIL_IMPORT',
  'API_IMPORT',
  'SCAN',
  'GENERATED',
  'KSEF_IMPORT',
  'BANK_IMPORT',
]);
export type DocumentSource = z.infer<typeof documentSourceSchema>;

/**
 * Processing status for OCR and AI extraction
 */
export const processingStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'SKIPPED',
]);
export type ProcessingStatus = z.infer<typeof processingStatusSchema>;

/**
 * Supported file types for documents
 */
export const supportedFileTypeSchema = z.enum([
  'PDF',
  'PNG',
  'JPG',
  'JPEG',
  'TIFF',
  'DOC',
  'DOCX',
  'XLS',
  'XLSX',
  'CSV',
  'XML',
  'TXT',
]);
export type SupportedFileType = z.infer<typeof supportedFileTypeSchema>;

/**
 * Document visibility level
 */
export const documentVisibilitySchema = z.enum([
  'PRIVATE',
  'ORGANIZATION',
  'CLIENT_VISIBLE',
  'PUBLIC',
]);
export type DocumentVisibility = z.infer<typeof documentVisibilitySchema>;

// =========================================================================
// ENTITY SCHEMAS
// =========================================================================

/**
 * Core document entity schema
 */
export const documentSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid().nullish(),

  // File metadata
  fileName: z.string().min(1).max(500),
  originalFileName: z.string().min(1).max(500),
  fileType: supportedFileTypeSchema,
  mimeType: z.string().min(1).max(100),
  fileSize: z.number().int().positive(),
  filePath: z.string().min(1).max(1000),

  // Storage info
  storageProvider: z.string().default('local'),
  storageBucket: z.string().nullish(),
  storageKey: z.string().min(1).max(500),
  checksumMd5: z.string().length(32).nullish(),
  checksumSha256: z.string().length(64).nullish(),

  // Classification and categorization
  category: documentCategorySchema.nullish(),
  subcategory: z.string().max(100).nullish(),
  documentType: z.string().max(100).nullish(),
  source: documentSourceSchema,

  // Metadata
  title: z.string().max(500).nullish(),
  description: z.string().max(2000).nullish(),
  documentDate: z.date().nullish(),
  documentNumber: z.string().max(100).nullish(),
  referenceNumber: z.string().max(100).nullish(),

  // Status
  status: documentStatusSchema,
  visibility: documentVisibilitySchema.default('ORGANIZATION'),

  // Processing status
  ocrStatus: processingStatusSchema.default('PENDING'),
  extractionStatus: processingStatusSchema.default('PENDING'),
  classificationStatus: processingStatusSchema.default('PENDING'),

  // Related entities
  journalEntryId: z.string().uuid().nullish(),
  vatTransactionId: z.string().uuid().nullish(),
  invoiceId: z.string().uuid().nullish(),

  // Version control
  versionNumber: z.number().int().min(1).default(1),
  isLatestVersion: z.boolean().default(true),
  parentDocumentId: z.string().uuid().nullish(),

  // Tags and search
  tags: z.array(z.string().max(50)).default([]),
  customMetadata: z.record(z.string(), z.unknown()).nullish(),

  // Full-text search content
  searchContent: z.string().nullish(),

  // Audit
  uploadedBy: z.string().uuid(),
  uploadedAt: z.date(),
  processedAt: z.date().nullish(),
  archivedAt: z.date().nullish(),
  deletedAt: z.date().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Document = z.infer<typeof documentSchema>;

/**
 * Document list item (summary view)
 */
export const documentListItemSchema = documentSchema.pick({
  id: true,
  organizationId: true,
  clientId: true,
  fileName: true,
  originalFileName: true,
  fileType: true,
  fileSize: true,
  category: true,
  source: true,
  title: true,
  documentDate: true,
  documentNumber: true,
  status: true,
  visibility: true,
  ocrStatus: true,
  extractionStatus: true,
  classificationStatus: true,
  versionNumber: true,
  isLatestVersion: true,
  tags: true,
  uploadedBy: true,
  uploadedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type DocumentListItem = z.infer<typeof documentListItemSchema>;

// =========================================================================
// INPUT SCHEMAS - CREATE
// =========================================================================

/**
 * Create document input (after upload)
 */
export const createDocumentInputSchema = z.object({
  clientId: z.string().uuid().optional(),

  // File info (from upload)
  fileName: z.string().min(1).max(500),
  originalFileName: z.string().min(1).max(500),
  fileType: supportedFileTypeSchema,
  mimeType: z.string().min(1).max(100),
  fileSize: z.number().int().positive(),
  filePath: z.string().min(1).max(1000),
  storageKey: z.string().min(1).max(500),
  storageBucket: z.string().optional(),

  // Classification
  category: documentCategorySchema.optional(),
  subcategory: z.string().max(100).optional(),
  source: documentSourceSchema,

  // Metadata
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  documentDate: z.coerce.date().optional(),
  documentNumber: z.string().max(100).optional(),
  referenceNumber: z.string().max(100).optional(),

  // Visibility
  visibility: documentVisibilitySchema.optional(),

  // Tags
  tags: z.array(z.string().max(50)).optional(),
  customMetadata: z.record(z.string(), z.unknown()).optional(),

  // Related entities
  journalEntryId: z.string().uuid().optional(),
  vatTransactionId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),

  // Processing options
  skipOcr: z.boolean().optional(),
  skipExtraction: z.boolean().optional(),
  skipClassification: z.boolean().optional(),
});
export type CreateDocumentInput = z.infer<typeof createDocumentInputSchema>;

// =========================================================================
// INPUT SCHEMAS - UPDATE
// =========================================================================

/**
 * Update document input
 */
export const updateDocumentInputSchema = z.object({
  documentId: z.string().uuid(),

  // Classification
  category: documentCategorySchema.optional(),
  subcategory: z.string().max(100).optional(),

  // Metadata
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  documentDate: z.coerce.date().optional(),
  documentNumber: z.string().max(100).optional(),
  referenceNumber: z.string().max(100).optional(),

  // Visibility
  visibility: documentVisibilitySchema.optional(),

  // Tags
  tags: z.array(z.string().max(50)).optional(),
  customMetadata: z.record(z.string(), z.unknown()).optional(),

  // Related entities
  journalEntryId: z.string().uuid().nullish(),
  vatTransactionId: z.string().uuid().nullish(),
  invoiceId: z.string().uuid().nullish(),
});
export type UpdateDocumentInput = z.infer<typeof updateDocumentInputSchema>;

// =========================================================================
// INPUT SCHEMAS - QUERY
// =========================================================================

/**
 * Get document by ID input
 */
export const getDocumentInputSchema = z.object({
  documentId: z.string().uuid(),
  includeVersions: z.boolean().optional(),
  includeExtractedData: z.boolean().optional(),
});
export type GetDocumentInput = z.infer<typeof getDocumentInputSchema>;

/**
 * List documents input with pagination and filters
 */
export const listDocumentsInputSchema = z.object({
  clientId: z.string().uuid().optional(),

  // Filters
  category: documentCategorySchema.optional(),
  categories: z.array(documentCategorySchema).optional(),
  source: documentSourceSchema.optional(),
  status: documentStatusSchema.optional(),
  statuses: z.array(documentStatusSchema).optional(),
  visibility: documentVisibilitySchema.optional(),
  fileType: supportedFileTypeSchema.optional(),
  fileTypes: z.array(supportedFileTypeSchema).optional(),

  // Processing status filters
  ocrStatus: processingStatusSchema.optional(),
  extractionStatus: processingStatusSchema.optional(),
  classificationStatus: processingStatusSchema.optional(),

  // Date filters
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  uploadedFrom: z.coerce.date().optional(),
  uploadedTo: z.coerce.date().optional(),

  // Tags
  tags: z.array(z.string()).optional(),
  anyTag: z.boolean().optional(), // true = OR, false = AND

  // Related entity filters
  journalEntryId: z.string().uuid().optional(),
  vatTransactionId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),

  // Version filters
  latestOnly: z.boolean().optional().default(true),

  // Pagination
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),

  // Sorting
  sortBy: z.enum([
    'createdAt',
    'updatedAt',
    'uploadedAt',
    'documentDate',
    'fileName',
    'fileSize',
  ]).optional().default('uploadedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});
export type ListDocumentsInput = z.infer<typeof listDocumentsInputSchema>;

/**
 * Delete document input
 */
export const deleteDocumentInputSchema = z.object({
  documentId: z.string().uuid(),
  permanent: z.boolean().optional().default(false),
});
export type DeleteDocumentInput = z.infer<typeof deleteDocumentInputSchema>;

/**
 * Archive document input
 */
export const archiveDocumentInputSchema = z.object({
  documentId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});
export type ArchiveDocumentInput = z.infer<typeof archiveDocumentInputSchema>;

/**
 * Restore document input
 */
export const restoreDocumentInputSchema = z.object({
  documentId: z.string().uuid(),
});
export type RestoreDocumentInput = z.infer<typeof restoreDocumentInputSchema>;

// =========================================================================
// OUTPUT SCHEMAS
// =========================================================================

/**
 * Document list response
 */
export const documentListResponseSchema = z.object({
  documents: z.array(documentListItemSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    totalItems: z.number().int().min(0),
    totalPages: z.number().int().min(0),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
});
export type DocumentListResponse = z.infer<typeof documentListResponseSchema>;

/**
 * Document with versions response
 */
export const documentWithVersionsSchema = documentSchema.extend({
  versions: z.array(documentListItemSchema).optional(),
  extractedData: z.record(z.string(), z.unknown()).optional(),
});
export type DocumentWithVersions = z.infer<typeof documentWithVersionsSchema>;

/**
 * Document statistics
 */
export const documentStatsSchema = z.object({
  totalDocuments: z.number().int().min(0),
  totalSize: z.number().int().min(0),
  byCategory: z.record(documentCategorySchema, z.number().int().min(0)),
  byStatus: z.record(documentStatusSchema, z.number().int().min(0)),
  byFileType: z.record(supportedFileTypeSchema, z.number().int().min(0)),
  recentUploads: z.number().int().min(0),
  pendingProcessing: z.number().int().min(0),
});
export type DocumentStats = z.infer<typeof documentStatsSchema>;

/**
 * Get document statistics input
 */
export const getDocumentStatsInputSchema = z.object({
  clientId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type GetDocumentStatsInput = z.infer<typeof getDocumentStatsInputSchema>;
