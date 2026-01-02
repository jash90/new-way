import { PrismaClient, Prisma, Permission, UserPermission } from '@prisma/client';
import { Redis } from 'ioredis';
import { TRPCError } from '@trpc/server';
import { AuditLogger } from '../../utils/audit-logger';
import type {
  CreatePermissionInput,
  UpdatePermissionInput,
  ListPermissionsQueryInput,
  AssignUserPermissionInput as _AssignUserPermissionInput,
  BulkPermissionAssignmentInput,
} from '@ksiegowacrm/shared';

// Suppress unused type import warning - reserved for future use
void (0 as unknown as _AssignUserPermissionInput);

// ==========================================================================
// PERMISSION SERVICE (AIM-008)
// Fine-Grained Access Control
// ==========================================================================

interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  source?: 'role' | 'direct' | 'wildcard';
}

interface PermissionUsage {
  roleCount: number;
  userCount: number;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface EffectivePermissionsGrouped {
  roles: { roleName: string; permissions: Permission[] }[];
  direct: Permission[];
}

export class PermissionService {
  private readonly PERMISSION_CACHE_KEY = 'permission:';
  private readonly USER_PERMISSIONS_CACHE_KEY = 'user_permissions:';
  private readonly CACHE_TTL = 900; // 15 minutes

  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private auditLogger: AuditLogger
  ) {}

  // ==========================================================================
  // PERMISSION CRUD
  // ==========================================================================

  async createPermission(
    input: CreatePermissionInput,
    createdBy: string
  ): Promise<Permission> {
    // Validate format
    this.validateResourceFormat(input.resource);
    this.validateActionFormat(input.action);

    // Check for duplicate
    const existing = await this.prisma.permission.findFirst({
      where: { resource: input.resource, action: input.action },
    });

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `Uprawnienie ${input.resource}.${input.action} już istnieje`,
      });
    }

    // Create permission
    const permission = await this.prisma.permission.create({
      data: {
        resource: input.resource,
        action: input.action,
        displayName: input.displayName,
        description: input.description,
        module: input.module,
        conditions: (input.conditions || null) as Prisma.InputJsonValue | undefined,
        isActive: true,
      },
    });

    // Log audit event
    await this.auditLogger.log({
      eventType: 'PERMISSION_CREATED',
      actorId: createdBy,
      targetType: 'permission',
      targetId: permission.id,
      metadata: {
        resource: permission.resource,
        action: permission.action,
        module: permission.module,
      },
    });

    return permission;
  }

  async getPermissionById(permissionId: string): Promise<Permission | null> {
    return this.prisma.permission.findUnique({
      where: { id: permissionId },
    });
  }

  async getPermissionByKey(resource: string, action: string): Promise<Permission | null> {
    return this.prisma.permission.findFirst({
      where: { resource, action },
    });
  }

  async listPermissions(
    query: Partial<ListPermissionsQueryInput>
  ): Promise<PaginatedResult<Permission>> {
    const {
      module,
      resource,
      search,
      includeInactive = false,
      page = 1,
      pageSize = 50,
    } = query;

    const where: any = {};

    if (!includeInactive) {
      where.isActive = true;
    }

    if (module) {
      where.module = module;
    }

    if (resource) {
      where.resource = resource;
    }

    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.permission.findMany({
        where,
        orderBy: [{ module: 'asc' }, { resource: 'asc' }, { action: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.permission.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updatePermission(
    permissionId: string,
    data: UpdatePermissionInput,
    updatedBy: string
  ): Promise<Permission> {
    const existing = await this.prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Uprawnienie nie zostało znalezione',
      });
    }

    const permission = await this.prisma.permission.update({
      where: { id: permissionId },
      data: {
        displayName: data.displayName ?? existing.displayName,
        description: data.description !== undefined ? data.description : existing.description,
        module: data.module ?? existing.module,
        conditions: (data.conditions !== undefined ? data.conditions : existing.conditions) as Prisma.InputJsonValue | undefined,
        isActive: data.isActive ?? existing.isActive,
      },
    });

    // Log audit event
    await this.auditLogger.log({
      eventType: 'PERMISSION_UPDATED',
      actorId: updatedBy,
      targetType: 'permission',
      targetId: permission.id,
      metadata: {
        changes: data,
      },
    });

    // Invalidate cache
    await this.redis.del(`${this.PERMISSION_CACHE_KEY}${permissionId}`);

    return permission;
  }

  async deletePermission(permissionId: string, deletedBy: string): Promise<void> {
    const permission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Uprawnienie nie zostało znalezione',
      });
    }

    // Check if permission is in use
    const usage = await this.getPermissionUsage(permissionId);
    if (usage.roleCount > 0 || usage.userCount > 0) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `Uprawnienie jest używane przez ${usage.roleCount} ról i ${usage.userCount} użytkowników`,
      });
    }

    // Soft delete
    await this.prisma.permission.update({
      where: { id: permissionId },
      data: { isActive: false },
    });

    // Log audit event
    await this.auditLogger.log({
      eventType: 'PERMISSION_DELETED',
      actorId: deletedBy,
      targetType: 'permission',
      targetId: permissionId,
      metadata: {
        resource: permission.resource,
        action: permission.action,
      },
    });

    // Invalidate cache
    await this.redis.del(`${this.PERMISSION_CACHE_KEY}${permissionId}`);
  }

  // ==========================================================================
  // USER PERMISSION MANAGEMENT
  // ==========================================================================

  async assignPermissionToUser(input: {
    userId: string;
    permissionId: string;
    grantedBy: string;
    expiresAt?: string;
    conditions?: any[];
    reason?: string;
  }): Promise<UserPermission> {
    // Verify permission exists
    const permission = await this.prisma.permission.findUnique({
      where: { id: input.permissionId },
    });

    if (!permission) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Uprawnienie nie zostało znalezione',
      });
    }

    // Check if already assigned
    const existing = await this.prisma.userPermission.findUnique({
      where: {
        userId_permissionId: {
          userId: input.userId,
          permissionId: input.permissionId,
        },
      },
    });

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Uprawnienie jest już przypisane do tego użytkownika',
      });
    }

    // Create user permission
    const userPermission = await this.prisma.userPermission.create({
      data: {
        userId: input.userId,
        permissionId: input.permissionId,
        isGranted: true,
        conditions: (input.conditions || null) as Prisma.InputJsonValue | undefined,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
      include: {
        permission: true,
      },
    });

    // Invalidate user permission cache
    await this.invalidateUserPermissionCache(input.userId);

    // Log audit event
    await this.auditLogger.log({
      eventType: 'USER_PERMISSION_ASSIGNED',
      actorId: input.grantedBy,
      targetType: 'user',
      targetId: input.userId,
      metadata: {
        permissionId: input.permissionId,
        permissionKey: `${permission.resource}.${permission.action}`,
        expiresAt: input.expiresAt,
        reason: input.reason,
      },
    });

    return userPermission;
  }

  async revokePermissionFromUser(
    userId: string,
    permissionId: string,
    revokedBy: string,
    reason?: string
  ): Promise<void> {
    // Check if assigned
    const existing = await this.prisma.userPermission.findUnique({
      where: {
        userId_permissionId: {
          userId,
          permissionId,
        },
      },
      include: {
        permission: true,
      },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Uprawnienie nie jest przypisane do tego użytkownika',
      });
    }

    // Delete user permission
    await this.prisma.userPermission.delete({
      where: {
        userId_permissionId: {
          userId,
          permissionId,
        },
      },
    });

    // Invalidate user permission cache
    await this.invalidateUserPermissionCache(userId);

    // Log audit event
    await this.auditLogger.log({
      eventType: 'USER_PERMISSION_REVOKED',
      actorId: revokedBy,
      targetType: 'user',
      targetId: userId,
      metadata: {
        permissionId,
        permissionKey: `${existing.permission.resource}.${existing.permission.action}`,
        reason,
      },
    });
  }

  async getUserDirectPermissions(
    userId: string,
    includeExpired = false
  ): Promise<UserPermission[]> {
    const where: any = { userId };

    if (!includeExpired) {
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ];
    }

    return this.prisma.userPermission.findMany({
      where,
      include: {
        permission: true,
      },
    });
  }

  // ==========================================================================
  // BULK OPERATIONS
  // ==========================================================================

  async bulkAssignPermissions(input: BulkPermissionAssignmentInput & { actorId: string }): Promise<{
    success: boolean;
    processed: number;
    errors: string[];
  }> {
    const { targetType, targetId, permissionIds, operation, actorId } = input;

    // Validate all permissions exist
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
    });

    if (permissions.length !== permissionIds.length) {
      const foundIds = new Set(permissions.map((p) => p.id));
      const missing = permissionIds.filter((id) => !foundIds.has(id));
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Następujące uprawnienia nie istnieją: ${missing.join(', ')}`,
      });
    }

    let processed = 0;

    if (targetType === 'role') {
      if (operation === 'add') {
        // Add permissions to role
        await this.prisma.$transaction(async (tx) => {
          for (const permissionId of permissionIds) {
            await tx.rolePermission.upsert({
              where: {
                roleId_permissionId: {
                  roleId: targetId,
                  permissionId,
                },
              },
              update: {},
              create: {
                roleId: targetId,
                permissionId,
                grantedById: actorId,
              },
            });
            processed++;
          }
        });
      } else {
        // Remove permissions from role
        const result = await this.prisma.rolePermission.deleteMany({
          where: {
            roleId: targetId,
            permissionId: { in: permissionIds },
          },
        });
        processed = result.count;
      }
    } else {
      if (operation === 'add') {
        // Add permissions to user
        await this.prisma.$transaction(async (tx) => {
          for (const permissionId of permissionIds) {
            await tx.userPermission.upsert({
              where: {
                userId_permissionId: {
                  userId: targetId,
                  permissionId,
                },
              },
              update: {},
              create: {
                userId: targetId,
                permissionId,
                isGranted: true,
              },
            });
            processed++;
          }
        });

        // Invalidate cache
        await this.invalidateUserPermissionCache(targetId);
      } else {
        // Remove permissions from user
        const result = await this.prisma.userPermission.deleteMany({
          where: {
            userId: targetId,
            permissionId: { in: permissionIds },
          },
        });
        processed = result.count;

        // Invalidate cache
        await this.invalidateUserPermissionCache(targetId);
      }
    }

    // Log audit event
    await this.auditLogger.log({
      eventType: 'BULK_PERMISSIONS_ASSIGNED',
      actorId,
      targetType,
      targetId,
      metadata: {
        operation,
        permissionCount: permissionIds.length,
        processed,
      },
    });

    return {
      success: true,
      processed,
      errors: [],
    };
  }

  // ==========================================================================
  // PERMISSION USAGE
  // ==========================================================================

  async getPermissionUsage(permissionId: string): Promise<PermissionUsage> {
    const [roleCount, userCount] = await Promise.all([
      this.prisma.rolePermission.count({
        where: { permissionId },
      }),
      this.prisma.userPermission.count({
        where: { permissionId },
      }),
    ]);

    return { roleCount, userCount };
  }

  // ==========================================================================
  // EFFECTIVE PERMISSIONS
  // ==========================================================================

  async getUserEffectivePermissions(
    userId: string,
    groupBySource = false
  ): Promise<Permission[] | EffectivePermissionsGrouped> {
    // Check cache first
    const cacheKey = `${this.USER_PERMISSIONS_CACHE_KEY}${userId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached && !groupBySource) {
      return JSON.parse(cached);
    }

    // Get role permissions
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    // Get direct permissions
    const directPermissions = await this.prisma.userPermission.findMany({
      where: {
        userId,
        isGranted: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        permission: true,
      },
    });

    if (groupBySource) {
      const result: EffectivePermissionsGrouped = {
        roles: userRoles.map((ur) => ({
          roleName: ur.role.name,
          permissions: ur.role.permissions.map((rp: { permission: Permission }) => rp.permission),
        })),
        direct: directPermissions.map((dp) => dp.permission),
      };
      return result;
    }

    // Combine and deduplicate
    const permissionMap = new Map<string, Permission>();

    for (const userRole of userRoles) {
      for (const rp of userRole.role.permissions as Array<{ permission: Permission }>) {
        permissionMap.set(rp.permission.id, rp.permission);
      }
    }

    for (const dp of directPermissions) {
      permissionMap.set(dp.permission.id, dp.permission);
    }

    const permissions = Array.from(permissionMap.values());

    // Cache the result
    await this.redis.set(cacheKey, JSON.stringify(permissions), 'EX', this.CACHE_TTL);

    return permissions;
  }

  // ==========================================================================
  // PERMISSION CHECK WITH CONDITIONS
  // ==========================================================================

  async checkPermissionWithContext(
    userId: string,
    resource: string,
    action: string,
    context: Record<string, unknown>
  ): Promise<PermissionCheckResult> {
    const permissions = await this.getUserEffectivePermissions(userId) as Permission[];

    // Check for exact match
    const exactMatch = permissions.find(
      (p) => p.resource === resource && p.action === action && p.isActive
    );

    if (exactMatch) {
      // Check conditions if any
      const directPermission = await this.prisma.userPermission.findFirst({
        where: {
          userId,
          permission: { resource, action },
          isGranted: true,
        },
      });

      if (directPermission?.conditions) {
        const conditionResult = this.evaluateConditions(
          directPermission.conditions as any[],
          context
        );
        if (!conditionResult.passed) {
          return {
            allowed: false,
            reason: `Permission condition not met: ${conditionResult.reason}`,
          };
        }
      }

      return { allowed: true, source: 'direct' };
    }

    // Check for wildcard match
    const wildcardMatch = permissions.find(
      (p) => p.resource === resource && p.action === '*' && p.isActive
    );

    if (wildcardMatch) {
      return { allowed: true, source: 'wildcard' };
    }

    return {
      allowed: false,
      reason: `Permission ${resource}.${action} not granted`,
    };
  }

  private evaluateConditions(
    conditions: any[],
    context: Record<string, unknown>
  ): { passed: boolean; reason?: string } {
    for (const condition of conditions) {
      switch (condition.type) {
        case 'own_organization':
          if (context.organizationId !== condition.value?.orgId) {
            return {
              passed: false,
              reason: 'Organization mismatch',
            };
          }
          break;

        case 'own_records':
          if (context.ownerId !== context.userId) {
            return {
              passed: false,
              reason: 'Not owner of record',
            };
          }
          break;

        case 'department':
          if (context.departmentId !== condition.value?.departmentId) {
            return {
              passed: false,
              reason: 'Department mismatch',
            };
          }
          break;

        case 'custom':
          // Custom conditions would need specific evaluation logic
          break;
      }
    }

    return { passed: true };
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  validateResourceFormat(resource: string): void {
    const pattern = /^[a-z][a-z0-9_]*$/;
    if (!pattern.test(resource)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nieprawidłowy format zasobu (małe litery, cyfry, podkreślenia, musi zaczynać się od litery)',
      });
    }
  }

  validateActionFormat(action: string): void {
    const pattern = /^([a-z][a-z0-9_]*|\*)$/;
    if (!pattern.test(action)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nieprawidłowy format akcji (małe litery, cyfry, podkreślenia lub *)',
      });
    }
  }

  // ==========================================================================
  // CACHE MANAGEMENT
  // ==========================================================================

  private async invalidateUserPermissionCache(userId: string): Promise<void> {
    const cacheKey = `${this.USER_PERMISSIONS_CACHE_KEY}${userId}`;
    await this.redis.del(cacheKey);
  }
}
