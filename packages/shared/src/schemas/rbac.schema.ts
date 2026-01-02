import { z } from 'zod';

/**
 * Role name validation schema
 * - Must start with uppercase letter
 * - Only uppercase letters, digits, and underscores allowed
 * - 2-100 characters
 */
export const roleNameSchema = z
  .string()
  .min(2, 'Nazwa roli musi mieć minimum 2 znaki')
  .max(100, 'Nazwa roli może mieć maksymalnie 100 znaków')
  .regex(
    /^[A-Z][A-Z0-9_]{1,99}$/,
    'Nazwa roli musi zaczynać się od wielkiej litery i zawierać tylko wielkie litery, cyfry i podkreślniki'
  );

/**
 * Resource name validation schema
 * - Must start with lowercase letter
 * - Only lowercase letters, digits, and underscores allowed
 * - 2-100 characters
 */
export const resourceNameSchema = z
  .string()
  .min(2, 'Nazwa zasobu musi mieć minimum 2 znaki')
  .max(100, 'Nazwa zasobu może mieć maksymalnie 100 znaków')
  .regex(
    /^[a-z][a-z0-9_]{1,99}$/,
    'Nazwa zasobu musi zaczynać się od małej litery i zawierać tylko małe litery, cyfry i podkreślniki'
  );

/**
 * Action name validation schema
 * - Must start with lowercase letter
 * - Only lowercase letters, digits, and underscores allowed
 * - 2-50 characters
 */
export const actionNameSchema = z
  .string()
  .min(2, 'Nazwa akcji musi mieć minimum 2 znaki')
  .max(50, 'Nazwa akcji może mieć maksymalnie 50 znaków')
  .regex(
    /^[a-z][a-z0-9_]{1,49}$/,
    'Nazwa akcji musi zaczynać się od małej litery i zawierać tylko małe litery, cyfry i podkreślniki'
  );

/**
 * Create Role Schema
 * Used when creating a new role
 */
export const createRoleSchema = z.object({
  name: roleNameSchema,
  displayName: z
    .string()
    .min(2, 'Nazwa wyświetlana musi mieć minimum 2 znaki')
    .max(150, 'Nazwa wyświetlana może mieć maksymalnie 150 znaków'),
  description: z
    .string()
    .max(500, 'Opis może mieć maksymalnie 500 znaków')
    .optional(),
  parentRoleId: z.string().uuid('Nieprawidłowy identyfikator roli nadrzędnej').optional(),
  permissions: z.array(z.string().uuid('Nieprawidłowy identyfikator uprawnienia')).optional().default([]),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

/**
 * Update Role Schema
 * Used when updating an existing role
 */
export const updateRoleSchema = z.object({
  displayName: z
    .string()
    .min(2, 'Nazwa wyświetlana musi mieć minimum 2 znaki')
    .max(150, 'Nazwa wyświetlana może mieć maksymalnie 150 znaków')
    .optional(),
  description: z
    .string()
    .max(500, 'Opis może mieć maksymalnie 500 znaków')
    .nullable()
    .optional(),
  parentRoleId: z.string().uuid('Nieprawidłowy identyfikator roli nadrzędnej').nullable().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

/**
 * Assign Role Schema
 * Used when assigning a role to a user
 */
export const assignRoleSchema = z.object({
  roleId: z.string().uuid('Nieprawidłowy identyfikator roli'),
  userId: z.string().uuid('Nieprawidłowy identyfikator użytkownika'),
  organizationId: z.string().uuid('Nieprawidłowy identyfikator organizacji').optional(),
  expiresAt: z.string().datetime('Nieprawidłowy format daty wygaśnięcia').optional(),
  reason: z.string().max(500, 'Przyczyna może mieć maksymalnie 500 znaków').optional(),
});

export type AssignRoleInput = z.infer<typeof assignRoleSchema>;

/**
 * Revoke Role Schema
 * Used when revoking a role from a user
 */
export const revokeRoleSchema = z.object({
  reason: z
    .string()
    .min(5, 'Podaj przyczynę odebrania roli (minimum 5 znaków)')
    .max(500, 'Przyczyna może mieć maksymalnie 500 znaków'),
});

export type RevokeRoleInput = z.infer<typeof revokeRoleSchema>;

/**
 * Update Role Permissions Schema
 * Used when bulk updating role permissions
 */
export const updateRolePermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid('Nieprawidłowy identyfikator uprawnienia')),
});

export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;

/**
 * Check Permission Schema
 * Used for single permission check
 */
export const checkPermissionSchema = z.object({
  resource: resourceNameSchema,
  action: actionNameSchema,
  conditions: z.record(z.unknown()).optional(),
});

export type CheckPermissionInput = z.infer<typeof checkPermissionSchema>;

/**
 * Bulk Check Permissions Schema
 * Used for checking multiple permissions at once
 */
export const bulkCheckPermissionsSchema = z.object({
  permissions: z
    .array(checkPermissionSchema)
    .min(1, 'Należy podać co najmniej jedno uprawnienie do sprawdzenia')
    .max(50, 'Można sprawdzić maksymalnie 50 uprawnień naraz'),
});

export type BulkCheckPermissionsInput = z.infer<typeof bulkCheckPermissionsSchema>;

/**
 * List Roles Query Schema
 * Used for filtering role list
 */
export const listRolesQuerySchema = z.object({
  includeSystem: z.coerce.boolean().optional().default(false),
  includeInactive: z.coerce.boolean().optional().default(false),
  search: z.string().max(100, 'Wyszukiwanie może mieć maksymalnie 100 znaków').optional(),
  module: z.string().max(50, 'Nazwa modułu może mieć maksymalnie 50 znaków').optional(),
});

export type ListRolesQueryInput = z.infer<typeof listRolesQuerySchema>;

/**
 * Role ID Schema
 * Used for single role operations
 */
export const roleIdSchema = z.object({
  roleId: z.string().uuid('Nieprawidłowy identyfikator roli'),
});

export type RoleIdInput = z.infer<typeof roleIdSchema>;

/**
 * User Role ID Schema
 * Used for user role operations
 */
export const userRoleIdSchema = z.object({
  userId: z.string().uuid('Nieprawidłowy identyfikator użytkownika'),
  roleId: z.string().uuid('Nieprawidłowy identyfikator roli'),
});

export type UserRoleIdInput = z.infer<typeof userRoleIdSchema>;

/**
 * Permission module Schema
 * Used for listing permissions by module
 */
export const permissionModuleSchema = z.object({
  module: z.string().max(50, 'Nazwa modułu może mieć maksymalnie 50 znaków').optional(),
});

export type PermissionModuleInput = z.infer<typeof permissionModuleSchema>;
