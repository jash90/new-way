import { z } from 'zod';
import { clientStatusSchema } from './client.schema';

// ===========================================================================
// BULK OPERATION TYPES
// ===========================================================================

export const bulkOperationTypeSchema = z.enum([
  'archive',
  'restore',
  'delete',
  'update_status',
  'update_tags',
  'assign_owner',
  'export',
]);

export type BulkOperationType = z.infer<typeof bulkOperationTypeSchema>;

export const bulkOperationStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
]);

export type BulkOperationStatus = z.infer<typeof bulkOperationStatusSchema>;

// ===========================================================================
// BULK ARCHIVE CLIENTS
// ===========================================================================

export const bulkArchiveClientsSchema = z.object({
  clientIds: z
    .array(z.string().uuid())
    .min(1, 'Wymagany co najmniej jeden klient')
    .max(100, 'Maksymalnie 100 klientów na raz'),
  reason: z.string().optional(),
});

export type BulkArchiveClientsInput = z.infer<typeof bulkArchiveClientsSchema>;

export interface BulkArchiveResult {
  archived: number;
  failed: number;
  errors: Array<{ clientId: string; error: string }>;
}

// ===========================================================================
// BULK RESTORE CLIENTS
// ===========================================================================

export const bulkRestoreClientsSchema = z.object({
  clientIds: z
    .array(z.string().uuid())
    .min(1, 'Wymagany co najmniej jeden klient')
    .max(100, 'Maksymalnie 100 klientów na raz'),
});

export type BulkRestoreClientsInput = z.infer<typeof bulkRestoreClientsSchema>;

export interface BulkRestoreResult {
  restored: number;
  failed: number;
  errors: Array<{ clientId: string; error: string }>;
}

// ===========================================================================
// BULK DELETE CLIENTS (PERMANENT)
// ===========================================================================

export const bulkDeleteClientsSchema = z.object({
  clientIds: z
    .array(z.string().uuid())
    .min(1, 'Wymagany co najmniej jeden klient')
    .max(50, 'Maksymalnie 50 klientów na raz przy usuwaniu permanentnym'),
  confirmDeletion: z.literal(true, {
    errorMap: () => ({ message: 'Wymagane potwierdzenie usunięcia' }),
  }),
});

export type BulkDeleteClientsInput = z.infer<typeof bulkDeleteClientsSchema>;

export interface BulkDeleteResult {
  deleted: number;
  failed: number;
  errors: Array<{ clientId: string; error: string }>;
}

// ===========================================================================
// BULK UPDATE STATUS
// ===========================================================================

// Use clientStatusSchema from client.schema.ts to ensure consistency with Prisma enum
// ClientStatus enum: 'active' | 'inactive' | 'suspended' | 'archived'

export const bulkUpdateStatusSchema = z.object({
  clientIds: z
    .array(z.string().uuid())
    .min(1, 'Wymagany co najmniej jeden klient')
    .max(100, 'Maksymalnie 100 klientów na raz'),
  status: clientStatusSchema,
  reason: z.string().optional(),
});

export type BulkUpdateStatusInput = z.infer<typeof bulkUpdateStatusSchema>;

export interface BulkUpdateStatusResult {
  updated: number;
  failed: number;
  errors: Array<{ clientId: string; error: string }>;
}

// ===========================================================================
// BULK UPDATE TAGS
// ===========================================================================

export const bulkTagOperationSchema = z.enum(['add', 'remove', 'replace']);
export type BulkTagOperation = z.infer<typeof bulkTagOperationSchema>;

export const bulkUpdateTagsSchema = z.object({
  clientIds: z
    .array(z.string().uuid())
    .min(1, 'Wymagany co najmniej jeden klient')
    .max(100, 'Maksymalnie 100 klientów na raz'),
  operation: bulkTagOperationSchema,
  tags: z.array(z.string().min(1).max(50)).min(1, 'Wymagany co najmniej jeden tag'),
});

export type BulkUpdateTagsInput = z.infer<typeof bulkUpdateTagsSchema>;

export interface BulkUpdateTagsResult {
  updated: number;
  failed: number;
  errors: Array<{ clientId: string; error: string }>;
}

// ===========================================================================
// BULK ASSIGN OWNER
// ===========================================================================

export const bulkAssignOwnerSchema = z.object({
  clientIds: z
    .array(z.string().uuid())
    .min(1, 'Wymagany co najmniej jeden klient')
    .max(100, 'Maksymalnie 100 klientów na raz'),
  newOwnerId: z.string().uuid(),
  transferNotes: z.boolean().default(true),
  transferDocuments: z.boolean().default(true),
});

export type BulkAssignOwnerInput = z.infer<typeof bulkAssignOwnerSchema>;

export interface BulkAssignOwnerResult {
  assigned: number;
  failed: number;
  errors: Array<{ clientId: string; error: string }>;
}

// ===========================================================================
// BULK EXPORT
// ===========================================================================

export const exportFormatSchema = z.enum(['csv', 'xlsx', 'json', 'pdf']);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

export const bulkExportClientsSchema = z.object({
  clientIds: z
    .array(z.string().uuid())
    .min(1, 'Wymagany co najmniej jeden klient')
    .max(1000, 'Maksymalnie 1000 klientów na raz do eksportu'),
  format: exportFormatSchema.default('csv'),
  fields: z.array(z.string()).optional(),
  includeContacts: z.boolean().default(false),
  includeTimeline: z.boolean().default(false),
  includeDocuments: z.boolean().default(false),
});

export type BulkExportClientsInput = z.infer<typeof bulkExportClientsSchema>;

export interface BulkExportResult {
  exportId: string;
  status: BulkOperationStatus;
  clientCount: number;
  format: ExportFormat;
  downloadUrl?: string;
  expiresAt?: Date;
}

// ===========================================================================
// GET BULK OPERATION STATUS
// ===========================================================================

export const getBulkOperationStatusSchema = z.object({
  operationId: z.string().uuid(),
});

export type GetBulkOperationStatusInput = z.infer<typeof getBulkOperationStatusSchema>;

export interface BulkOperationProgress {
  operationId: string;
  type: BulkOperationType;
  status: BulkOperationStatus;
  totalItems: number;
  processedItems: number;
  successCount: number;
  failureCount: number;
  errors: Array<{ itemId: string; error: string }>;
  startedAt: Date;
  completedAt?: Date;
}

// ===========================================================================
// LIST BULK OPERATIONS
// ===========================================================================

export const listBulkOperationsSchema = z.object({
  type: bulkOperationTypeSchema.optional(),
  status: bulkOperationStatusSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type ListBulkOperationsInput = z.infer<typeof listBulkOperationsSchema>;

export interface BulkOperationListItem {
  operationId: string;
  type: BulkOperationType;
  status: BulkOperationStatus;
  totalItems: number;
  processedItems: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface BulkOperationsListResult {
  operations: BulkOperationListItem[];
  total: number;
  limit: number;
  offset: number;
}

// ===========================================================================
// CANCEL BULK OPERATION
// ===========================================================================

export const cancelBulkOperationSchema = z.object({
  operationId: z.string().uuid(),
});

export type CancelBulkOperationInput = z.infer<typeof cancelBulkOperationSchema>;

export interface CancelBulkOperationResult {
  cancelled: boolean;
  message: string;
}
