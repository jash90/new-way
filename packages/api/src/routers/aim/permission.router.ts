import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, adminProcedure } from '../../trpc';
import {
  createPermissionSchema,
  updatePermissionSchema,
  permissionIdSchema,
  permissionKeySchema,
  listPermissionsQuerySchema,
  assignUserPermissionSchema,
  revokeUserPermissionSchema,
  bulkPermissionAssignmentSchema,
  getUserPermissionsSchema,
  getUserEffectivePermissionsSchema,
} from '@ksiegowacrm/shared';
import { z } from 'zod';
import { PermissionService } from '../../services/aim/permission.service';
import { AuditLogger } from '../../utils/audit-logger';

/**
 * Permission Router (AIM-008)
 * Handles Fine-Grained Permission Management operations
 */
export const permissionRouter = router({
  // =========================================================================
  // Permission CRUD Operations (Admin Only)
  // =========================================================================

  /**
   * Create a new permission
   */
  create: adminProcedure.input(createPermissionSchema).mutation(async ({ input, ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const permissionService = new PermissionService(prisma, redis, auditLogger);

    try {
      const permission = await permissionService.createPermission(input, session!.userId);
      return permission;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas tworzenia uprawnienia',
      });
    }
  }),

  /**
   * Get permission by ID
   */
  getById: adminProcedure.input(permissionIdSchema).query(async ({ input, ctx }) => {
    const { prisma, redis } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const permissionService = new PermissionService(prisma, redis, auditLogger);

    return permissionService.getPermissionById(input.permissionId);
  }),

  /**
   * Get permission by resource.action key
   */
  getByKey: adminProcedure.input(permissionKeySchema).query(async ({ input, ctx }) => {
    const { prisma, redis } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const permissionService = new PermissionService(prisma, redis, auditLogger);

    return permissionService.getPermissionByKey(input.resource, input.action);
  }),

  /**
   * List permissions with filtering and pagination
   */
  list: adminProcedure.input(listPermissionsQuerySchema).query(async ({ input, ctx }) => {
    const { prisma, redis } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const permissionService = new PermissionService(prisma, redis, auditLogger);

    return permissionService.listPermissions(input);
  }),

  /**
   * Update permission
   */
  update: adminProcedure
    .input(
      z.object({
        permissionId: z.string().uuid(),
      }).merge(updatePermissionSchema)
    )
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;
      const { permissionId, ...updateData } = input;

      const auditLogger = new AuditLogger(prisma);
      const permissionService = new PermissionService(prisma, redis, auditLogger);

      try {
        const permission = await permissionService.updatePermission(
          permissionId,
          updateData,
          session!.userId
        );
        return permission;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Wystąpił błąd podczas aktualizacji uprawnienia',
        });
      }
    }),

  /**
   * Delete (soft-delete) permission
   */
  delete: adminProcedure.input(permissionIdSchema).mutation(async ({ input, ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const permissionService = new PermissionService(prisma, redis, auditLogger);

    try {
      await permissionService.deletePermission(input.permissionId, session!.userId);
      return { success: true };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas usuwania uprawnienia',
      });
    }
  }),

  // =========================================================================
  // User Permission Assignment (Admin Only)
  // =========================================================================

  /**
   * Assign permission to user
   */
  assignToUser: adminProcedure.input(assignUserPermissionSchema).mutation(async ({ input, ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const permissionService = new PermissionService(prisma, redis, auditLogger);

    try {
      const userPermission = await permissionService.assignPermissionToUser({
        ...input,
        grantedBy: session!.userId,
      });
      return userPermission;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas przypisywania uprawnienia',
      });
    }
  }),

  /**
   * Revoke permission from user
   */
  revokeFromUser: adminProcedure.input(revokeUserPermissionSchema).mutation(async ({ input, ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const permissionService = new PermissionService(prisma, redis, auditLogger);

    try {
      await permissionService.revokePermissionFromUser(
        input.userId,
        input.permissionId,
        session!.userId
      );
      return { success: true };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas odbierania uprawnienia',
      });
    }
  }),

  /**
   * Get user's direct permissions
   */
  getUserPermissions: adminProcedure.input(getUserPermissionsSchema).query(async ({ input, ctx }) => {
    const { prisma, redis } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const permissionService = new PermissionService(prisma, redis, auditLogger);

    return permissionService.getUserDirectPermissions(input.userId, input.includeExpired);
  }),

  /**
   * Get user's effective permissions (role + direct)
   */
  getEffectivePermissions: protectedProcedure
    .input(getUserEffectivePermissionsSchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const permissionService = new PermissionService(prisma, redis, auditLogger);

      return permissionService.getUserEffectivePermissions(input.userId, input.groupBySource);
    }),

  // =========================================================================
  // Bulk Operations (Admin Only)
  // =========================================================================

  /**
   * Bulk assign/remove permissions
   */
  bulkAssign: adminProcedure.input(bulkPermissionAssignmentSchema).mutation(async ({ input, ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const permissionService = new PermissionService(prisma, redis, auditLogger);

    try {
      return await permissionService.bulkAssignPermissions({
        ...input,
        actorId: session!.userId,
      });
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas masowego przypisywania uprawnień',
      });
    }
  }),

  // =========================================================================
  // Permission Usage & Check (Admin Only)
  // =========================================================================

  /**
   * Get permission usage statistics
   */
  getUsage: adminProcedure.input(permissionIdSchema).query(async ({ input, ctx }) => {
    const { prisma, redis } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const permissionService = new PermissionService(prisma, redis, auditLogger);

    return permissionService.getPermissionUsage(input.permissionId);
  }),

  /**
   * Check if user has permission with context
   */
  check: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        resource: z.string(),
        action: z.string(),
        context: z.record(z.unknown()).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { prisma, redis } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const permissionService = new PermissionService(prisma, redis, auditLogger);

      return permissionService.checkPermissionWithContext(
        input.userId,
        input.resource,
        input.action,
        input.context || {}
      );
    }),
});
