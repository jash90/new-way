import { z } from 'zod';

// ==========================================================================
// BACKUP CODES SCHEMAS (AIM-010)
// Dedicated backup codes management
// ==========================================================================

/**
 * Get backup codes status - no input required (uses session userId)
 */
export const getBackupCodesStatusSchema = z.object({}).optional();

export type GetBackupCodesStatusInput = z.infer<typeof getBackupCodesStatusSchema>;

/**
 * Backup codes status response
 */
export const backupCodesStatusSchema = z.object({
  isEnabled: z.boolean(),
  totalCodes: z.number(),
  remainingCodes: z.number(),
  usedCodes: z.number(),
  lastUsedAt: z.string().datetime().nullable(),
  generatedAt: z.string().datetime().nullable(),
  shouldRegenerate: z.boolean(), // true if remainingCodes <= 2
});

export type BackupCodesStatus = z.infer<typeof backupCodesStatusSchema>;

/**
 * List used backup codes - pagination
 */
export const listUsedBackupCodesSchema = z.object({
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(50).default(10),
  }).optional(),
});

export type ListUsedBackupCodesInput = z.infer<typeof listUsedBackupCodesSchema>;

/**
 * Used backup code entry
 */
export const usedBackupCodeEntrySchema = z.object({
  id: z.string().uuid(),
  usedAt: z.string().datetime(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
});

export type UsedBackupCodeEntry = z.infer<typeof usedBackupCodeEntrySchema>;

/**
 * Paginated used backup codes response
 */
export const paginatedUsedBackupCodesSchema = z.object({
  items: z.array(usedBackupCodeEntrySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
});

export type PaginatedUsedBackupCodes = z.infer<typeof paginatedUsedBackupCodesSchema>;

/**
 * Export backup codes format
 */
export const backupCodesExportFormatSchema = z.enum(['text', 'pdf']);

export type BackupCodesExportFormat = z.infer<typeof backupCodesExportFormatSchema>;

/**
 * Export backup codes input
 */
export const exportBackupCodesSchema = z.object({
  format: backupCodesExportFormatSchema.default('text'),
  password: z.string().min(1, 'Hasło jest wymagane'),
  totpCode: z.string().length(6).regex(/^\d{6}$/, 'Nieprawidłowy kod TOTP'),
});

export type ExportBackupCodesInput = z.infer<typeof exportBackupCodesSchema>;

/**
 * Export backup codes result
 */
export const exportBackupCodesResultSchema = z.object({
  format: backupCodesExportFormatSchema,
  content: z.string(), // Base64 for PDF, plain text for text format
  filename: z.string(),
  mimeType: z.string(),
  generatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(), // For PDF download links
  warning: z.string(),
});

export type ExportBackupCodesResult = z.infer<typeof exportBackupCodesResultSchema>;

/**
 * Verify backup code without challenge (direct verification)
 */
export const verifyBackupCodeDirectSchema = z.object({
  code: z.string()
    .length(8, 'Kod zapasowy musi mieć 8 znaków')
    .regex(/^[A-Z0-9]{8}$/i, 'Nieprawidłowy format kodu zapasowego')
    .transform((val) => val.toUpperCase()),
});

export type VerifyBackupCodeDirectInput = z.infer<typeof verifyBackupCodeDirectSchema>;

/**
 * Verify backup code direct result
 */
export const verifyBackupCodeDirectResultSchema = z.object({
  success: z.boolean(),
  remainingCodes: z.number(),
  shouldRegenerate: z.boolean(),
  verifiedAt: z.string().datetime(),
});

export type VerifyBackupCodeDirectResult = z.infer<typeof verifyBackupCodeDirectResultSchema>;
