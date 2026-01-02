import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, adminProcedure } from '../../trpc';
import {
  createRoleSchema,
  updateRoleSchema,
  assignRoleSchema,
  revokeRoleSchema,
  updateRolePermissionsSchema,
  checkPermissionSchema,
  bulkCheckPermissionsSchema,
  listRolesQuerySchema,
  roleIdSchema,
  permissionModuleSchema,
} from '@ksiegowacrm/shared';
import { z } from 'zod';
import { RBACService } from '../../services/aim/rbac.service';
import { AuditLogger } from '../../utils/audit-logger';

/**
 * RBAC Router (AIM-007)
 * Handles Role-Based Access Control operations
 */
export const rbacRouter = router({
  // =========================================================================
  // Role CRUD Operations (Admin Only)
  // =========================================================================

  /**
   * Create a new role
   */
  createRole: adminProcedure.input(createRoleSchema).mutation(async ({ input, ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const rbacService = new RBACService(prisma, redis, auditLogger);

    try {
      const role = await rbacService.createRole(input, session!.userId, session!.organizationId || undefined);
      return role;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      if (error instanceof Error) {
        if (error.message.includes('już istnieje') || error.message.includes('already exists')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: error.message,
          });
        }
        if (error.message.includes('nie została znaleziona') || error.message.includes('not found')) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }
        if (error.message.includes('nieaktywna') || error.message.includes('inactive')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas tworzenia roli',
      });
    }
  }),

  /**
   * Get role by ID
   */
  getRoleById: adminProcedure.input(roleIdSchema).query(async ({ input, ctx }) => {
    const { prisma, redis } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const rbacService = new RBACService(prisma, redis, auditLogger);

    try {
      const role = await rbacService.getRoleById(input.roleId);
      return role;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      if (error instanceof Error && (error.message.includes('nie została znaleziona') || error.message.includes('not found'))) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Rola nie została znaleziona',
        });
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas pobierania roli',
      });
    }
  }),

  /**
   * List roles with filtering
   */
  listRoles: adminProcedure.input(listRolesQuerySchema).query(async ({ input, ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const rbacService = new RBACService(prisma, redis, auditLogger);

    try {
      const roles = await rbacService.listRoles(input, session!.organizationId || undefined);
      return roles;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas pobierania listy ról',
      });
    }
  }),

  /**
   * Update a role
   */
  updateRole: adminProcedure
    .input(
      z.object({
        roleId: z.string().uuid('Nieprawidłowy identyfikator roli'),
        data: updateRoleSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const rbacService = new RBACService(prisma, redis, auditLogger);

      try {
        const role = await rbacService.updateRole(input.roleId, input.data, session!.userId);
        return role;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        if (error instanceof Error) {
          if (error.message.includes('nie została znaleziona') || error.message.includes('not found')) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: error.message,
            });
          }
          if (error.message.includes('systemow') || error.message.includes('system')) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Role systemowe nie mogą być modyfikowane',
            });
          }
          if (error.message.includes('cykliczn') || error.message.includes('circular')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error.message,
            });
          }
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas aktualizacji roli',
        });
      }
    }),

  /**
   * Delete (soft delete) a role
   */
  deleteRole: adminProcedure.input(roleIdSchema).mutation(async ({ input, ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const rbacService = new RBACService(prisma, redis, auditLogger);

    try {
      await rbacService.deleteRole(input.roleId, session!.userId);
      return { success: true };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      if (error instanceof Error) {
        if (error.message.includes('nie została znaleziona') || error.message.includes('not found')) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }
        if (error.message.includes('systemow') || error.message.includes('system')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Role systemowe nie mogą być usunięte',
          });
        }
        if (error.message.includes('przypisanych') || error.message.includes('assigned')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas usuwania roli',
      });
    }
  }),

  // =========================================================================
  // Role Permissions (Admin Only)
  // =========================================================================

  /**
   * Update role permissions
   */
  updateRolePermissions: adminProcedure
    .input(
      z.object({
        roleId: z.string().uuid('Nieprawidłowy identyfikator roli'),
        permissionIds: updateRolePermissionsSchema.shape.permissionIds,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const rbacService = new RBACService(prisma, redis, auditLogger);

      try {
        await rbacService.updateRolePermissions(input.roleId, input.permissionIds, session!.userId);
        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        if (error instanceof Error) {
          if (error.message.includes('nie została znaleziona') || error.message.includes('not found')) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: error.message,
            });
          }
          if (error.message.includes('systemow') || error.message.includes('system')) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Uprawnienia roli systemowej nie mogą być modyfikowane',
            });
          }
          if (error.message.includes('nie istnieją') || error.message.includes('do not exist')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error.message,
            });
          }
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas aktualizacji uprawnień roli',
        });
      }
    }),

  // =========================================================================
  // User Role Assignment (Admin Only)
  // =========================================================================

  /**
   * Assign a role to a user
   */
  assignRoleToUser: adminProcedure.input(assignRoleSchema).mutation(async ({ input, ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const rbacService = new RBACService(prisma, redis, auditLogger);

    try {
      const userRole = await rbacService.assignRoleToUser(input, session!.userId);
      return userRole;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      if (error instanceof Error) {
        if (error.message.includes('nie został') || error.message.includes('not found')) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }
        if (error.message.includes('nieaktywn') || error.message.includes('inactive')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Nie można przypisać nieaktywnej roli',
          });
        }
        if (error.message.includes('już przypisaną') || error.message.includes('already assigned')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Użytkownik ma już przypisaną tę rolę',
          });
        }
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas przypisywania roli',
      });
    }
  }),

  /**
   * Revoke a role from a user
   */
  revokeRoleFromUser: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid('Nieprawidłowy identyfikator użytkownika'),
        roleId: z.string().uuid('Nieprawidłowy identyfikator roli'),
        reason: revokeRoleSchema.shape.reason,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const rbacService = new RBACService(prisma, redis, auditLogger);

      try {
        await rbacService.revokeRoleFromUser(input.userId, input.roleId, session!.userId, input.reason);
        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        if (error instanceof Error) {
          if (error.message.includes('nie zostało znalezione') || error.message.includes('not found')) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: error.message,
            });
          }
          if (error.message.includes('ostatniej roli') || error.message.includes('last role')) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Nie można odebrać ostatniej roli użytkownika. Przypisz inną rolę przed odebraniem tej.',
            });
          }
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas odbierania roli',
        });
      }
    }),

  /**
   * Get roles assigned to a user
   */
  getUserRoles: adminProcedure
    .input(z.object({ userId: z.string().uuid('Nieprawidłowy identyfikator użytkownika') }))
    .query(async ({ input, ctx }) => {
      const { prisma, redis } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const rbacService = new RBACService(prisma, redis, auditLogger);

      try {
        const userRoles = await rbacService.getUserRoles(input.userId);
        return userRoles;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas pobierania ról użytkownika',
        });
      }
    }),

  // =========================================================================
  // Permission Checking (Protected - for current user)
  // =========================================================================

  /**
   * Check if current user has a specific permission
   */
  checkPermission: protectedProcedure.input(checkPermissionSchema).query(async ({ input, ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const rbacService = new RBACService(prisma, redis, auditLogger);

    try {
      const hasPermission = await rbacService.checkPermission(session!.userId, input);
      return { hasPermission };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas sprawdzania uprawnienia',
      });
    }
  }),

  /**
   * Bulk check multiple permissions for current user
   */
  checkPermissions: protectedProcedure.input(bulkCheckPermissionsSchema).query(async ({ input, ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const rbacService = new RBACService(prisma, redis, auditLogger);

    try {
      const results = await rbacService.checkPermissions(session!.userId, input.permissions);

      // Convert Map to plain object for JSON serialization
      const resultsObject: Record<string, boolean> = {};
      results.forEach((value, key) => {
        resultsObject[key] = value;
      });

      return resultsObject;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas sprawdzania uprawnień',
      });
    }
  }),

  /**
   * Get effective permissions for current user
   */
  getUserEffectivePermissions: protectedProcedure.query(async ({ ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const rbacService = new RBACService(prisma, redis, auditLogger);

    try {
      const effectivePermissions = await rbacService.getUserEffectivePermissions(session!.userId);
      return effectivePermissions;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas pobierania uprawnień użytkownika',
      });
    }
  }),

  // =========================================================================
  // Permission Catalog (Admin Only)
  // =========================================================================

  /**
   * List all available permissions
   */
  listPermissions: adminProcedure.input(permissionModuleSchema).query(async ({ input, ctx }) => {
    const { prisma, redis } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const rbacService = new RBACService(prisma, redis, auditLogger);

    try {
      const permissions = await rbacService.listPermissions(input.module);
      return permissions;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas pobierania listy uprawnień',
      });
    }
  }),

  /**
   * Get permissions grouped by module
   */
  getPermissionsByModule: adminProcedure.query(async ({ ctx }) => {
    const { prisma, redis } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const rbacService = new RBACService(prisma, redis, auditLogger);

    try {
      const permissionsByModule = await rbacService.getPermissionsByModule();

      // Convert Map to plain object for JSON serialization
      const result: Record<string, any[]> = {};
      permissionsByModule.forEach((permissions, module) => {
        result[module] = permissions;
      });

      return result;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas pobierania uprawnień według modułów',
      });
    }
  }),
});

export type RBACRouter = typeof rbacRouter;
