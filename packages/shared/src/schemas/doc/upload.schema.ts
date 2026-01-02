// DOC-001: Document Upload Schemas
// Schemas for file upload validation, progress tracking, and storage configuration

import { z } from 'zod';
import {
  documentCategorySchema,
  documentSourceSchema,
  documentVisibilitySchema,
  supportedFileTypeSchema,
} from './document.schema';

// =========================================================================
// CONSTANTS
// =========================================================================

/**
 * Maximum file size in bytes (50MB)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Maximum files per batch upload
 */
export const MAX_BATCH_SIZE = 20;

/**
 * Allowed MIME types mapping
 */
export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  PDF: ['application/pdf'],
  PNG: ['image/png'],
  JPG: ['image/jpeg'],
  JPEG: ['image/jpeg'],
  TIFF: ['image/tiff'],
  DOC: ['application/msword'],
  DOCX: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  XLS: ['application/vnd.ms-excel'],
  XLSX: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  CSV: ['text/csv', 'application/csv'],
  XML: ['application/xml', 'text/xml'],
  TXT: ['text/plain'],
};

// =========================================================================
// ENUMS
// =========================================================================

/**
 * Upload status tracking
 */
export const uploadStatusSchema = z.enum([
  'PENDING',
  'UPLOADING',
  'VALIDATING',
  'STORING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);
export type UploadStatus = z.infer<typeof uploadStatusSchema>;

/**
 * Upload error codes
 */
export const uploadErrorCodeSchema = z.enum([
  'FILE_TOO_LARGE',
  'INVALID_FILE_TYPE',
  'INVALID_MIME_TYPE',
  'FILE_CORRUPTED',
  'STORAGE_ERROR',
  'QUOTA_EXCEEDED',
  'VIRUS_DETECTED',
  'DUPLICATE_FILE',
  'VALIDATION_ERROR',
  'UNKNOWN_ERROR',
]);
export type UploadErrorCode = z.infer<typeof uploadErrorCodeSchema>;

// =========================================================================
// INPUT SCHEMAS
// =========================================================================

/**
 * Single file upload metadata
 */
export const fileUploadMetadataSchema = z.object({
  originalFileName: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(100),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE),

  // Optional classification hints
  category: documentCategorySchema.optional(),
  source: documentSourceSchema.optional(),
  visibility: documentVisibilitySchema.optional(),

  // Optional metadata
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  documentDate: z.coerce.date().optional(),
  documentNumber: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).optional(),
  customMetadata: z.record(z.string(), z.unknown()).optional(),

  // Related entity hints
  clientId: z.string().uuid().optional(),
  journalEntryId: z.string().uuid().optional(),
  vatTransactionId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),

  // Processing options
  skipOcr: z.boolean().optional(),
  skipExtraction: z.boolean().optional(),
  skipClassification: z.boolean().optional(),
});
export type FileUploadMetadata = z.infer<typeof fileUploadMetadataSchema>;

/**
 * Request presigned upload URL input
 */
export const requestUploadUrlInputSchema = z.object({
  fileName: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(100),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE),
  metadata: fileUploadMetadataSchema.optional(),
});
export type RequestUploadUrlInput = z.infer<typeof requestUploadUrlInputSchema>;

/**
 * Confirm upload completion input
 */
export const confirmUploadInputSchema = z.object({
  uploadId: z.string().uuid(),
  checksumMd5: z.string().length(32).optional(),
  checksumSha256: z.string().length(64).optional(),
});
export type ConfirmUploadInput = z.infer<typeof confirmUploadInputSchema>;

/**
 * Cancel upload input
 */
export const cancelUploadInputSchema = z.object({
  uploadId: z.string().uuid(),
});
export type CancelUploadInput = z.infer<typeof cancelUploadInputSchema>;

/**
 * Batch upload request input
 */
export const batchUploadInputSchema = z.object({
  files: z.array(requestUploadUrlInputSchema).min(1).max(MAX_BATCH_SIZE),
  commonMetadata: z.object({
    clientId: z.string().uuid().optional(),
    category: documentCategorySchema.optional(),
    source: documentSourceSchema.optional(),
    visibility: documentVisibilitySchema.optional(),
    tags: z.array(z.string().max(50)).optional(),
  }).optional(),
});
export type BatchUploadInput = z.infer<typeof batchUploadInputSchema>;

/**
 * Get upload status input
 */
export const getUploadStatusInputSchema = z.object({
  uploadId: z.string().uuid(),
});
export type GetUploadStatusInput = z.infer<typeof getUploadStatusInputSchema>;

// =========================================================================
// OUTPUT SCHEMAS
// =========================================================================

/**
 * Presigned upload URL response
 */
export const uploadUrlResponseSchema = z.object({
  uploadId: z.string().uuid(),
  uploadUrl: z.string().url(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()).optional(),
  expiresAt: z.date(),
  storageKey: z.string(),
  maxFileSize: z.number().int().positive(),
});
export type UploadUrlResponse = z.infer<typeof uploadUrlResponseSchema>;

/**
 * Upload status response
 */
export const uploadStatusResponseSchema = z.object({
  uploadId: z.string().uuid(),
  status: uploadStatusSchema,
  progress: z.number().min(0).max(100).optional(),
  bytesUploaded: z.number().int().min(0).optional(),
  totalBytes: z.number().int().positive(),
  documentId: z.string().uuid().optional(),
  errorCode: uploadErrorCodeSchema.optional(),
  errorMessage: z.string().optional(),
  startedAt: z.date(),
  completedAt: z.date().optional(),
});
export type UploadStatusResponse = z.infer<typeof uploadStatusResponseSchema>;

/**
 * Upload confirmation response
 */
export const uploadConfirmationResponseSchema = z.object({
  success: z.boolean(),
  documentId: z.string().uuid().optional(),
  fileName: z.string(),
  fileSize: z.number().int().positive(),
  fileType: supportedFileTypeSchema,
  processingQueued: z.boolean(),
  errorCode: uploadErrorCodeSchema.optional(),
  errorMessage: z.string().optional(),
});
export type UploadConfirmationResponse = z.infer<typeof uploadConfirmationResponseSchema>;

/**
 * Batch upload response
 */
export const batchUploadResponseSchema = z.object({
  uploads: z.array(uploadUrlResponseSchema),
  batchId: z.string().uuid(),
  totalFiles: z.number().int().positive(),
  expiresAt: z.date(),
});
export type BatchUploadResponse = z.infer<typeof batchUploadResponseSchema>;

/**
 * Download URL response
 */
export const downloadUrlResponseSchema = z.object({
  downloadUrl: z.string().url(),
  expiresAt: z.date(),
  fileName: z.string(),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
});
export type DownloadUrlResponse = z.infer<typeof downloadUrlResponseSchema>;

/**
 * Request download URL input
 */
export const requestDownloadUrlInputSchema = z.object({
  documentId: z.string().uuid(),
  versionNumber: z.number().int().min(1).optional(),
  expiresIn: z.number().int().min(60).max(86400).optional().default(3600),
});
export type RequestDownloadUrlInput = z.infer<typeof requestDownloadUrlInputSchema>;

// =========================================================================
// VALIDATION HELPERS
// =========================================================================

/**
 * Validate file type from extension
 */
export const validateFileExtension = (fileName: string): boolean => {
  const extension = fileName.split('.').pop()?.toUpperCase();
  if (!extension) return false;
  return supportedFileTypeSchema.safeParse(extension).success;
};

/**
 * Validate MIME type
 */
export const validateMimeType = (mimeType: string, fileType: string): boolean => {
  const allowedMimes = ALLOWED_MIME_TYPES[fileType.toUpperCase()];
  if (!allowedMimes) return false;
  return allowedMimes.includes(mimeType.toLowerCase());
};

/**
 * Get file type from extension
 */
export const getFileTypeFromExtension = (fileName: string): string | null => {
  const extension = fileName.split('.').pop()?.toUpperCase();
  if (!extension) return null;
  const result = supportedFileTypeSchema.safeParse(extension);
  return result.success ? result.data : null;
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
