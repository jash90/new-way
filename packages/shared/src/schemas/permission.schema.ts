import { z } from 'zod';

// ==========================================================================
// PERMISSION SCHEMAS (AIM-008)
// Fine-Grained Access Control
// ==========================================================================

/**
 * Permission resource name validation
 * - lowercase letters, numbers, underscores
 * - must start with a letter
 */
export const permissionResourceSchema = z
  .string()
  .min(1, 'Zasób jest wymagany')
  .max(100, 'Nazwa zasobu zbyt długa')
  .regex(/^[a-z][a-z0-9_]*$/, 'Nieprawidłowy format zasobu (małe litery, cyfry, podkreślenia)');

/**
 * Permission action name validation
 * - lowercase letters, numbers, underscores, or wildcard (*)
 */
export const permissionActionSchema = z
  .string()
  .min(1, 'Akcja jest wymagana')
  .max(50, 'Nazwa akcji zbyt długa')
  .regex(/^([a-z][a-z0-9_]*|\*)$/, 'Nieprawidłowy format akcji (małe litery, cyfry, podkreślenia lub *)');

/**
 * Create permission input
 */
export const createPermissionSchema = z.object({
  resource: permissionResourceSchema,
  action: permissionActionSchema,
  displayName: z
    .string()
    .min(1, 'Nazwa wyświetlana jest wymagana')
    .max(150, 'Nazwa wyświetlana zbyt długa'),
  description: z
    .string()
    .max(500, 'Opis zbyt długi')
    .optional(),
  module: z
    .string()
    .min(1, 'Moduł jest wymagany')
    .max(50, 'Nazwa modułu zbyt długa'),
  conditions: z.record(z.unknown()).optional(),
});

export type CreatePermissionInput = z.infer<typeof createPermissionSchema>;

/**
 * Update permission input
 */
export const updatePermissionSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Nazwa wyświetlana jest wymagana')
    .max(150, 'Nazwa wyświetlana zbyt długa')
    .optional(),
  description: z
    .string()
    .max(500, 'Opis zbyt długi')
    .optional()
    .nullable(),
  module: z
    .string()
    .min(1, 'Moduł jest wymagany')
    .max(50, 'Nazwa modułu zbyt długa')
    .optional(),
  conditions: z.record(z.unknown()).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type UpdatePermissionInput = z.infer<typeof updatePermissionSchema>;

/**
 * Permission ID input
 */
export const permissionIdSchema = z.object({
  permissionId: z.string().uuid('Nieprawidłowy identyfikator uprawnienia'),
});

export type PermissionIdInput = z.infer<typeof permissionIdSchema>;

/**
 * Get permission by key (resource.action)
 */
export const permissionKeySchema = z.object({
  resource: permissionResourceSchema,
  action: permissionActionSchema,
});

export type PermissionKeyInput = z.infer<typeof permissionKeySchema>;

/**
 * List permissions query
 */
export const listPermissionsQuerySchema = z.object({
  module: z.string().optional(),
  resource: z.string().optional(),
  search: z.string().max(100).optional(),
  includeInactive: z.boolean().default(false),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(10).max(100).default(50),
});

export type ListPermissionsQueryInput = z.infer<typeof listPermissionsQuerySchema>;

/**
 * Permission type for direct user permissions
 */
export const permissionTypeSchema = z.enum(['GRANT', 'DENY']);

export type PermissionType = z.infer<typeof permissionTypeSchema>;

/**
 * Permission condition types
 */
export const permissionConditionTypeSchema = z.enum([
  'own_organization',
  'own_records',
  'department',
  'custom',
]);

export type PermissionConditionType = z.infer<typeof permissionConditionTypeSchema>;

/**
 * Permission condition
 */
export const permissionConditionSchema = z.object({
  type: permissionConditionTypeSchema,
  value: z.record(z.unknown()).optional(),
});

export type PermissionCondition = z.infer<typeof permissionConditionSchema>;

/**
 * Assign permission to user
 */
export const assignUserPermissionSchema = z.object({
  userId: z.string().uuid('Nieprawidłowy identyfikator użytkownika'),
  permissionId: z.string().uuid('Nieprawidłowy identyfikator uprawnienia'),
  permissionType: permissionTypeSchema.default('GRANT'),
  conditions: z.array(permissionConditionSchema).default([]),
  expiresAt: z.string().datetime().optional(),
  reason: z.string().max(500).optional(),
});

export type AssignUserPermissionInput = z.infer<typeof assignUserPermissionSchema>;

/**
 * Revoke permission from user
 */
export const revokeUserPermissionSchema = z.object({
  userId: z.string().uuid('Nieprawidłowy identyfikator użytkownika'),
  permissionId: z.string().uuid('Nieprawidłowy identyfikator uprawnienia'),
  reason: z.string().min(5, 'Powód musi mieć co najmniej 5 znaków').max(500).optional(),
});

export type RevokeUserPermissionInput = z.infer<typeof revokeUserPermissionSchema>;

/**
 * Bulk permission assignment
 */
export const bulkPermissionAssignmentSchema = z.object({
  targetType: z.enum(['role', 'user']),
  targetId: z.string().uuid('Nieprawidłowy identyfikator'),
  permissionIds: z
    .array(z.string().uuid())
    .min(1, 'Wybierz co najmniej jedno uprawnienie')
    .max(100, 'Maksymalnie 100 uprawnień jednocześnie'),
  operation: z.enum(['add', 'remove']),
});

export type BulkPermissionAssignmentInput = z.infer<typeof bulkPermissionAssignmentSchema>;

/**
 * Permission check input
 */
export const permissionCheckInputSchema = z.object({
  userId: z.string().uuid('Nieprawidłowy identyfikator użytkownika'),
  resource: permissionResourceSchema,
  action: permissionActionSchema,
  context: z.record(z.unknown()).optional(),
});

export type PermissionCheckInputSchema = z.infer<typeof permissionCheckInputSchema>;

/**
 * Get user permissions
 */
export const getUserPermissionsSchema = z.object({
  userId: z.string().uuid('Nieprawidłowy identyfikator użytkownika'),
  includeExpired: z.boolean().default(false),
});

export type GetUserPermissionsInput = z.infer<typeof getUserPermissionsSchema>;

/**
 * Get user effective permissions
 */
export const getUserEffectivePermissionsSchema = z.object({
  userId: z.string().uuid('Nieprawidłowy identyfikator użytkownika'),
  groupBySource: z.boolean().default(false),
});

export type GetUserEffectivePermissionsInput = z.infer<typeof getUserEffectivePermissionsSchema>;
