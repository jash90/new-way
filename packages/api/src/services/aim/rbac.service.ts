import { TRPCError } from '@trpc/server';
import type { PrismaClient, Prisma } from '@prisma/client';
import type Redis from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';
import type {
  CreateRoleInput,
  UpdateRoleInput,
  AssignRoleInput,
  CheckPermissionInput,
  ListRolesQueryInput,
} from '@ksiegowacrm/shared';

/**
 * Permission data structure
 */
export interface Permission {
  id: string;
  resource: string;
  action: string;
  displayName: string;
  module: string;
  grantedVia?: string;
}

/**
 * Role data structure
 */
export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  parentRole?: { id: string; name: string; displayName: string } | null;
  permissions: Permission[];
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User Role data structure
 */
export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  organizationId: string | null;
  grantedAt: Date;
  grantedBy: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedBy: string | null;
  reason: string | null;
  role: {
    id: string;
    name: string;
    displayName: string;
  };
}

/**
 * Effective Permissions data structure
 */
export interface EffectivePermissions {
  userId: string;
  roles: string[];
  permissions: Permission[];
  permissionKeys: string[];
  computedAt: Date;
}

/**
 * RBAC Service (AIM-007)
 * Manages Role-Based Access Control with caching and audit logging
 */
export class RBACService {
  // Cache key patterns
  private readonly ROLE_CACHE_KEY = 'rbac:role:';
  private readonly USER_PERMISSIONS_CACHE_KEY = 'rbac:user:permissions:';

  // Cache TTL in seconds
  private readonly ROLE_CACHE_TTL = 3600; // 1 hour
  private readonly USER_PERMISSIONS_TTL = 900; // 15 minutes

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly auditLogger: AuditLogger
  ) {}

  // ==========================================
  // ROLE MANAGEMENT
  // ==========================================

  async createRole(
    input: CreateRoleInput,
    createdBy: string,
    organizationId?: string
  ): Promise<Role> {
    // Check for duplicate role name
    const existingRole = await this.prisma.role.findFirst({
      where: { name: input.name },
    });

    if (existingRole) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Rola o tej nazwie już istnieje',
      });
    }

    // Validate parent role if specified
    if (input.parentRoleId) {
      const parentRole = await this.prisma.role.findUnique({
        where: { id: input.parentRoleId },
      });

      if (!parentRole) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Rola nadrzędna nie istnieje',
        });
      }

      if (!parentRole.isActive) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Rola nadrzędna jest nieaktywna',
        });
      }
    }

    // Create role with transaction
    const role = await this.prisma.$transaction(async (tx) => {
      // Create the role
      const newRole = await tx.role.create({
        data: {
          name: input.name,
          displayName: input.displayName,
          description: input.description,
          parentRoleId: input.parentRoleId,
          organizationId,
          metadata: (input.metadata || {}) as Prisma.InputJsonValue,
          createdById: createdBy,
          updatedById: createdBy,
        },
      });

      // Add self-reference to hierarchy closure table
      await tx.roleHierarchyClosure.create({
        data: {
          ancestorRoleId: newRole.id,
          descendantRoleId: newRole.id,
          depth: 0,
        },
      });

      // If has parent, update hierarchy closure table
      if (input.parentRoleId) {
        await this.updateRoleHierarchy(tx, newRole.id, input.parentRoleId);
      }

      // Assign permissions if provided
      if (input.permissions?.length) {
        await tx.rolePermission.createMany({
          data: input.permissions.map((permissionId) => ({
            roleId: newRole.id,
            permissionId,
            grantedById: createdBy,
          })),
        });
      }

      return newRole;
    });

    // Log audit event
    await this.auditLogger.log({
      eventType: 'ROLE_CREATED',
      actorId: createdBy,
      targetType: 'role',
      targetId: role.id,
      metadata: {
        roleName: role.name,
        permissionCount: input.permissions?.length || 0,
      },
    });

    return this.getRoleById(role.id);
  }

  async getRoleById(roleId: string): Promise<Role> {
    // Try cache first
    const cached = await this.redis.get(`${this.ROLE_CACHE_KEY}${roleId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        parentRole: {
          select: { id: true, name: true, displayName: true },
        },
        _count: {
          select: { userRoles: { where: { revokedAt: null } } },
        },
      },
    });

    if (!role) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Rola nie została znaleziona',
      });
    }

    const result: Role = {
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      parentRole: role.parentRole,
      permissions: role.permissions.map((rp: any) => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        displayName: rp.permission.displayName,
        module: rp.permission.module,
      })),
      userCount: role._count.userRoles,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };

    // Cache the result
    await this.redis.setex(
      `${this.ROLE_CACHE_KEY}${roleId}`,
      this.ROLE_CACHE_TTL,
      JSON.stringify(result)
    );

    return result;
  }

  async listRoles(
    query: ListRolesQueryInput,
    organizationId?: string
  ): Promise<Role[]> {
    const whereConditions: any[] = [
      // Organization filter
      organizationId
        ? { OR: [{ organizationId }, { organizationId: null }] }
        : { organizationId: null },
    ];

    // System roles filter
    if (!query.includeSystem) {
      whereConditions.push({ isSystem: false });
    }

    // Active filter
    if (!query.includeInactive) {
      whereConditions.push({ isActive: true });
    }

    // Search filter
    if (query.search) {
      whereConditions.push({
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { displayName: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    const roles = await this.prisma.role.findMany({
      where: {
        AND: whereConditions,
      },
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: {
          select: { userRoles: { where: { revokedAt: null } } },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { displayName: 'asc' }],
    });

    return roles.map((role: any) => ({
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      permissions: role.permissions.map((rp: any) => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        displayName: rp.permission.displayName,
        module: rp.permission.module,
      })),
      userCount: role._count.userRoles,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));
  }

  async updateRole(
    roleId: string,
    input: UpdateRoleInput,
    updatedBy: string
  ): Promise<Role> {
    const existingRole = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!existingRole) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Rola nie została znaleziona',
      });
    }

    if (existingRole.isSystem) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Rola systemowa nie może być modyfikowana',
      });
    }

    // Validate parent role if changing
    if (input.parentRoleId !== undefined) {
      if (input.parentRoleId === roleId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Rola nie może być swoim rodzicem',
        });
      }

      if (input.parentRoleId) {
        // Check for circular reference
        const wouldCreateCycle = await this.checkForCyclicHierarchy(
          input.parentRoleId,
          roleId
        );
        if (wouldCreateCycle) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Ta zmiana spowodowałaby cykliczną hierarchię',
          });
        }
      }
    }

    const role = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        displayName: input.displayName,
        description: input.description,
        parentRoleId: input.parentRoleId,
        isActive: input.isActive,
        metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
        updatedById: updatedBy,
        updatedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.redis.del(`${this.ROLE_CACHE_KEY}${roleId}`);

    // If role hierarchy changed, update closure table
    if (
      input.parentRoleId !== undefined &&
      input.parentRoleId !== existingRole.parentRoleId
    ) {
      await this.rebuildRoleHierarchy(roleId, input.parentRoleId);
    }

    // Log audit event
    await this.auditLogger.log({
      eventType: 'ROLE_UPDATED',
      actorId: updatedBy,
      targetType: 'role',
      targetId: role.id,
      metadata: {
        changes: input,
        previousValues: {
          displayName: existingRole.displayName,
          description: existingRole.description,
          parentRoleId: existingRole.parentRoleId,
        },
      },
    });

    return this.getRoleById(roleId);
  }

  async deleteRole(roleId: string, deletedBy: string): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        _count: {
          select: { userRoles: { where: { revokedAt: null } } },
        },
      },
    });

    if (!role) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Rola nie została znaleziona',
      });
    }

    if (role.isSystem) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Rola systemowa nie może być usunięta',
      });
    }

    if (role._count.userRoles > 0) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `Nie można usunąć roli przypisanej do ${role._count.userRoles} użytkowników`,
      });
    }

    // Soft delete by setting isActive to false
    await this.prisma.role.update({
      where: { id: roleId },
      data: {
        isActive: false,
        updatedById: deletedBy,
        updatedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.redis.del(`${this.ROLE_CACHE_KEY}${roleId}`);

    // Log audit event
    await this.auditLogger.log({
      eventType: 'ROLE_DELETED',
      actorId: deletedBy,
      targetType: 'role',
      targetId: role.id,
      metadata: { roleName: role.name },
    });
  }

  // ==========================================
  // ROLE PERMISSIONS
  // ==========================================

  async updateRolePermissions(
    roleId: string,
    permissionIds: string[],
    updatedBy: string
  ): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: true,
      },
    });

    if (!role) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Rola nie została znaleziona',
      });
    }

    if (role.isSystem) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Uprawnienia roli systemowej nie mogą być modyfikowane',
      });
    }

    // Validate all permission IDs exist
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
    });

    if (permissions.length !== permissionIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Niektóre uprawnienia nie istnieją',
      });
    }

    const currentPermissionIds = role.permissions.map(
      (rp: any) => rp.permissionId
    );
    const toAdd = permissionIds.filter(
      (id) => !currentPermissionIds.includes(id)
    );
    const toRemove = currentPermissionIds.filter(
      (id: string) => !permissionIds.includes(id)
    );

    await this.prisma.$transaction(async (tx) => {
      // Remove old permissions
      if (toRemove.length > 0) {
        await tx.rolePermission.deleteMany({
          where: {
            roleId,
            permissionId: { in: toRemove },
          },
        });
      }

      // Add new permissions
      if (toAdd.length > 0) {
        await tx.rolePermission.createMany({
          data: toAdd.map((permissionId) => ({
            roleId,
            permissionId,
            grantedById: updatedBy,
          })),
        });
      }
    });

    // Invalidate caches
    await this.invalidateRolePermissionCaches(roleId);

    // Log audit event
    await this.auditLogger.log({
      eventType: 'ROLE_PERMISSIONS_UPDATED',
      actorId: updatedBy,
      targetType: 'role',
      targetId: roleId,
      metadata: {
        added: toAdd,
        removed: toRemove,
        totalPermissions: permissionIds.length,
      },
    });
  }

  // ==========================================
  // USER ROLE ASSIGNMENT
  // ==========================================

  async assignRoleToUser(
    input: AssignRoleInput,
    grantedBy: string
  ): Promise<UserRole> {
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: input.userId } }),
      this.prisma.role.findUnique({ where: { id: input.roleId } }),
    ]);

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Użytkownik nie został znaleziony',
      });
    }

    if (!role) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Rola nie została znaleziona',
      });
    }

    if (!role.isActive) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Nie można przypisać nieaktywnej roli',
      });
    }

    // Check if assignment already exists
    const existingAssignment = await this.prisma.userRole.findFirst({
      where: {
        userId: input.userId,
        roleId: input.roleId,
        organizationId: input.organizationId || null,
        revokedAt: null,
      },
    });

    if (existingAssignment) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Użytkownik ma już przypisaną tę rolę',
      });
    }

    const userRole = await this.prisma.userRole.create({
      data: {
        userId: input.userId,
        roleId: input.roleId,
        organizationId: input.organizationId,
        grantedById: grantedBy,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        reason: input.reason,
      },
      include: {
        role: {
          select: { id: true, name: true, displayName: true },
        },
      },
    });

    // Invalidate user's permission cache
    await this.invalidateUserPermissionCache(input.userId);

    // Log audit event
    await this.auditLogger.log({
      eventType: 'ROLE_ASSIGNED',
      actorId: grantedBy,
      targetType: 'user',
      targetId: input.userId,
      metadata: {
        roleId: input.roleId,
        roleName: role.name,
        expiresAt: input.expiresAt,
        reason: input.reason,
      },
    });

    return userRole as unknown as UserRole;
  }

  async revokeRoleFromUser(
    userId: string,
    roleId: string,
    revokedBy: string,
    reason: string
  ): Promise<void> {
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId,
        roleId,
        revokedAt: null,
      },
      include: {
        role: true,
      },
    });

    if (!userRole) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Przypisanie roli nie zostało znalezione',
      });
    }

    // Check if it's the user's last role (prevent orphan users)
    const userRoleCount = await this.prisma.userRole.count({
      where: {
        userId,
        revokedAt: null,
      },
    });

    if (userRoleCount === 1) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'Nie można odebrać ostatniej roli użytkownika. Przypisz inną rolę przed odebraniem tej.',
      });
    }

    await this.prisma.userRole.update({
      where: { id: userRole.id },
      data: {
        revokedAt: new Date(),
        revokedById: revokedBy,
        reason,
      },
    });

    // Invalidate user's permission cache
    await this.invalidateUserPermissionCache(userId);

    // Log audit event
    await this.auditLogger.log({
      eventType: 'ROLE_REVOKED',
      actorId: revokedBy,
      targetType: 'user',
      targetId: userId,
      metadata: {
        roleId,
        roleName: userRole.role.name,
        reason,
      },
    });
  }

  async getUserRoles(userId: string): Promise<UserRole[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
        grantedBy: {
          select: { id: true, email: true },
        },
      },
      orderBy: { grantedAt: 'desc' },
    });

    return userRoles as unknown as UserRole[];
  }

  // ==========================================
  // PERMISSION CHECKING
  // ==========================================

  async getUserEffectivePermissions(
    userId: string
  ): Promise<EffectivePermissions> {
    // Try cache first
    const cacheKey = `${this.USER_PERMISSIONS_CACHE_KEY}${userId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    // Get user's active roles
    const userRoles = await this.getUserRoles(userId);

    // Collect all permissions from all roles (including inherited via hierarchy)
    const permissionMap = new Map<string, Permission>();
    const roleNames: string[] = [];

    for (const userRole of userRoles) {
      roleNames.push((userRole.role as any).name);

      // Get all ancestor roles' permissions via hierarchy
      const ancestorPermissions = await this.prisma.roleHierarchyClosure.findMany({
        where: { descendantRoleId: userRole.role.id },
        include: {
          ancestorRole: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      });

      for (const hierarchy of ancestorPermissions) {
        for (const rp of (hierarchy as any).ancestorRole.permissions) {
          const key = `${rp.permission.resource}:${rp.permission.action}`;
          if (!permissionMap.has(key)) {
            permissionMap.set(key, {
              id: rp.permission.id,
              resource: rp.permission.resource,
              action: rp.permission.action,
              displayName: rp.permission.displayName,
              module: rp.permission.module,
              grantedVia: (hierarchy as any).ancestorRole.name,
            });
          }
        }
      }
    }

    const result: EffectivePermissions = {
      userId,
      roles: roleNames,
      permissions: Array.from(permissionMap.values()),
      permissionKeys: Array.from(permissionMap.keys()),
      computedAt: new Date(),
    };

    // Cache the result
    await this.redis.setex(
      cacheKey,
      this.USER_PERMISSIONS_TTL,
      JSON.stringify(result)
    );

    // Also update DB cache
    await this.prisma.userPermissionCache.upsert({
      where: { userId },
      create: {
        userId,
        permissions: result.permissionKeys,
        roles: result.roles,
        computedAt: new Date(),
        expiresAt: new Date(Date.now() + this.USER_PERMISSIONS_TTL * 1000),
      },
      update: {
        permissions: result.permissionKeys,
        roles: result.roles,
        computedAt: new Date(),
        expiresAt: new Date(Date.now() + this.USER_PERMISSIONS_TTL * 1000),
      },
    });

    return result;
  }

  async checkPermission(
    userId: string,
    input: CheckPermissionInput
  ): Promise<boolean> {
    const effectivePermissions = await this.getUserEffectivePermissions(userId);
    const permissionKey = `${input.resource}:${input.action}`;

    return effectivePermissions.permissionKeys.includes(permissionKey);
  }

  async checkPermissions(
    userId: string,
    checks: CheckPermissionInput[]
  ): Promise<Map<string, boolean>> {
    const effectivePermissions = await this.getUserEffectivePermissions(userId);
    const results = new Map<string, boolean>();

    for (const check of checks) {
      const permissionKey = `${check.resource}:${check.action}`;
      results.set(
        permissionKey,
        effectivePermissions.permissionKeys.includes(permissionKey)
      );
    }

    return results;
  }

  // ==========================================
  // PERMISSION CATALOG
  // ==========================================

  async listPermissions(module?: string): Promise<Permission[]> {
    const permissions = await this.prisma.permission.findMany({
      where: module ? { module } : {},
      orderBy: [{ module: 'asc' }, { resource: 'asc' }, { action: 'asc' }],
    });

    return permissions as Permission[];
  }

  async getPermissionsByModule(): Promise<Map<string, Permission[]>> {
    const permissions = await this.listPermissions();
    const grouped = new Map<string, Permission[]>();

    for (const permission of permissions) {
      const modulePermissions = grouped.get(permission.module) || [];
      modulePermissions.push(permission);
      grouped.set(permission.module, modulePermissions);
    }

    return grouped;
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private async updateRoleHierarchy(
    tx: any,
    roleId: string,
    parentRoleId: string
  ): Promise<void> {
    // Get all ancestors of the parent (including parent itself)
    const parentAncestors = await tx.roleHierarchyClosure.findMany({
      where: { descendantRoleId: parentRoleId },
    });

    // Add new hierarchy entries for role -> each ancestor
    for (const ancestor of parentAncestors) {
      await tx.roleHierarchyClosure.create({
        data: {
          ancestorRoleId: ancestor.ancestorRoleId,
          descendantRoleId: roleId,
          depth: ancestor.depth + 1,
        },
      });
    }
  }

  private async rebuildRoleHierarchy(
    roleId: string,
    newParentId: string | null
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Get all descendants of this role (excluding self)
      const descendants = await tx.roleHierarchyClosure.findMany({
        where: { ancestorRoleId: roleId, depth: { gt: 0 } },
      });

      // Delete all hierarchy entries where this role or its descendants are involved
      // (except self-references)
      await tx.roleHierarchyClosure.deleteMany({
        where: {
          OR: [
            { descendantRoleId: roleId, depth: { gt: 0 } },
            {
              descendantRoleId: {
                in: descendants.map((d: any) => d.descendantRoleId),
              },
            },
          ],
        },
      });

      // If new parent exists, rebuild hierarchy
      if (newParentId) {
        await this.updateRoleHierarchy(tx, roleId, newParentId);

        // Also update descendants
        for (const desc of descendants) {
          const ancestorsOfRole = await tx.roleHierarchyClosure.findMany({
            where: { descendantRoleId: roleId },
          });

          for (const ancestor of ancestorsOfRole) {
            await tx.roleHierarchyClosure.create({
              data: {
                ancestorRoleId: ancestor.ancestorRoleId,
                descendantRoleId: desc.descendantRoleId,
                depth: ancestor.depth + desc.depth,
              },
            });
          }
        }
      }
    });
  }

  private async checkForCyclicHierarchy(
    potentialParentId: string,
    roleId: string
  ): Promise<boolean> {
    // Check if roleId is an ancestor of potentialParentId
    const existing = await this.prisma.roleHierarchyClosure.findFirst({
      where: {
        ancestorRoleId: roleId,
        descendantRoleId: potentialParentId,
      },
    });

    return !!existing;
  }

  private async invalidateRolePermissionCaches(roleId: string): Promise<void> {
    // Invalidate role cache
    await this.redis.del(`${this.ROLE_CACHE_KEY}${roleId}`);

    // Find all users with this role and invalidate their permission caches
    const userRoles = await this.prisma.userRole.findMany({
      where: { roleId, revokedAt: null },
      select: { userId: true },
    });

    const userIds = userRoles.map((ur: { userId: string }) => ur.userId);
    await Promise.all(
      userIds.map((userId) => this.invalidateUserPermissionCache(userId))
    );
  }

  private async invalidateUserPermissionCache(userId: string): Promise<void> {
    await this.redis.del(`${this.USER_PERMISSIONS_CACHE_KEY}${userId}`);
    await this.prisma.userPermissionCache.deleteMany({
      where: { userId },
    });
  }
}
