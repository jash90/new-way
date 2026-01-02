import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { PermissionService } from '../../services/aim/permission.service';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';

// ==========================================================================
// PERMISSION SERVICE TESTS (AIM-008)
// TDD - Tests First
// ==========================================================================

describe('PermissionService', () => {
  // Mock instances
  let mockPrisma: any;
  let mockRedis: any;
  let mockAuditLogger: any;
  let permissionService: PermissionService;

  // Test data
  const PERMISSION_ID = '550e8400-e29b-41d4-a716-446655440001';
  const USER_ID = '550e8400-e29b-41d4-a716-446655440002';
  const ADMIN_ID = '550e8400-e29b-41d4-a716-446655440003';
  const ROLE_ID = '550e8400-e29b-41d4-a716-446655440004';
  const ORG_ID = '550e8400-e29b-41d4-a716-446655440005';

  const mockPermission = {
    id: PERMISSION_ID,
    resource: 'invoices',
    action: 'read',
    displayName: 'Read Invoices',
    description: 'Allows reading invoices',
    module: 'INVOICING',
    conditions: null,
    isActive: true,
    createdAt: new Date('2024-01-01'),
  };

  const mockUserPermission = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    userId: USER_ID,
    permissionId: PERMISSION_ID,
    isGranted: true,
    conditions: null,
    grantedAt: new Date('2024-01-01'),
    expiresAt: null,
    permission: mockPermission,
  };

  beforeEach(() => {
    // Reset mocks
    mockPrisma = {
      permission: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      userPermission: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
        upsert: vi.fn(),
      },
      rolePermission: {
        count: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
      userRole: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(mockPrisma)),
    };

    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      keys: vi.fn().mockResolvedValue([]),
    };

    mockAuditLogger = {
      log: vi.fn(),
    };

    permissionService = new PermissionService(
      mockPrisma as unknown as PrismaClient,
      mockRedis as unknown as Redis,
      mockAuditLogger as unknown as AuditLogger
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // PERMISSION CRUD
  // ==========================================================================
  describe('createPermission', () => {
    it('should create a new permission successfully', async () => {
      // Arrange
      mockPrisma.permission.findFirst.mockResolvedValue(null); // No duplicate
      mockPrisma.permission.create.mockResolvedValue(mockPermission);

      const input = {
        resource: 'invoices',
        action: 'read',
        displayName: 'Read Invoices',
        description: 'Allows reading invoices',
        module: 'INVOICING',
      };

      // Act
      const result = await permissionService.createPermission(input, ADMIN_ID);

      // Assert
      expect(mockPrisma.permission.findFirst).toHaveBeenCalledWith({
        where: { resource: 'invoices', action: 'read' },
      });
      expect(mockPrisma.permission.create).toHaveBeenCalled();
      expect(result).toEqual(mockPermission);
    });

    it('should reject duplicate permission (same resource.action)', async () => {
      // Arrange
      mockPrisma.permission.findFirst.mockResolvedValue(mockPermission);

      const input = {
        resource: 'invoices',
        action: 'read',
        displayName: 'Read Invoices',
        module: 'INVOICING',
      };

      // Act & Assert
      await expect(
        permissionService.createPermission(input, ADMIN_ID)
      ).rejects.toThrow(TRPCError);
      await expect(
        permissionService.createPermission(input, ADMIN_ID)
      ).rejects.toThrow(/już istnieje/i);
    });

    it('should validate resource format', async () => {
      // Arrange
      const input = {
        resource: 'Invalid-Resource', // Invalid format
        action: 'read',
        displayName: 'Read',
        module: 'TEST',
      };

      // Act & Assert
      await expect(
        permissionService.createPermission(input, ADMIN_ID)
      ).rejects.toThrow();
    });

    it('should allow wildcard action (*)', async () => {
      // Arrange
      mockPrisma.permission.findFirst.mockResolvedValue(null);
      const wildcardPermission = { ...mockPermission, action: '*' };
      mockPrisma.permission.create.mockResolvedValue(wildcardPermission);

      const input = {
        resource: 'invoices',
        action: '*',
        displayName: 'All Invoice Actions',
        module: 'INVOICING',
      };

      // Act
      const result = await permissionService.createPermission(input, ADMIN_ID);

      // Assert
      expect(result.action).toBe('*');
    });

    it('should log audit event on permission creation', async () => {
      // Arrange
      mockPrisma.permission.findFirst.mockResolvedValue(null);
      mockPrisma.permission.create.mockResolvedValue(mockPermission);

      const input = {
        resource: 'invoices',
        action: 'read',
        displayName: 'Read Invoices',
        module: 'INVOICING',
      };

      // Act
      await permissionService.createPermission(input, ADMIN_ID);

      // Assert
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PERMISSION_CREATED',
          actorId: ADMIN_ID,
        })
      );
    });
  });

  describe('getPermissionById', () => {
    it('should return permission by ID', async () => {
      // Arrange
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);

      // Act
      const result = await permissionService.getPermissionById(PERMISSION_ID);

      // Assert
      expect(result).toEqual(mockPermission);
      expect(mockPrisma.permission.findUnique).toHaveBeenCalledWith({
        where: { id: PERMISSION_ID },
      });
    });

    it('should return null for non-existent permission', async () => {
      // Arrange
      mockPrisma.permission.findUnique.mockResolvedValue(null);

      // Act
      const result = await permissionService.getPermissionById('non-existent');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getPermissionByKey', () => {
    it('should return permission by resource and action', async () => {
      // Arrange
      mockPrisma.permission.findFirst.mockResolvedValue(mockPermission);

      // Act
      const result = await permissionService.getPermissionByKey('invoices', 'read');

      // Assert
      expect(result).toEqual(mockPermission);
      expect(mockPrisma.permission.findFirst).toHaveBeenCalledWith({
        where: { resource: 'invoices', action: 'read' },
      });
    });
  });

  describe('listPermissions', () => {
    it('should list all permissions with default pagination', async () => {
      // Arrange
      const permissions = [mockPermission, { ...mockPermission, id: 'perm-2', action: 'create' }];
      mockPrisma.permission.findMany.mockResolvedValue(permissions);
      mockPrisma.permission.count.mockResolvedValue(2);

      // Act
      const result = await permissionService.listPermissions({});

      // Assert
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('should filter permissions by module', async () => {
      // Arrange
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);
      mockPrisma.permission.count.mockResolvedValue(1);

      // Act
      await permissionService.listPermissions({ module: 'INVOICING' });

      // Assert
      expect(mockPrisma.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ module: 'INVOICING' }),
        })
      );
    });

    it('should filter permissions by resource', async () => {
      // Arrange
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);
      mockPrisma.permission.count.mockResolvedValue(1);

      // Act
      await permissionService.listPermissions({ resource: 'invoices' });

      // Assert
      expect(mockPrisma.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ resource: 'invoices' }),
        })
      );
    });

    it('should search permissions by displayName', async () => {
      // Arrange
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);
      mockPrisma.permission.count.mockResolvedValue(1);

      // Act
      await permissionService.listPermissions({ search: 'invoice' });

      // Assert
      expect(mockPrisma.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                displayName: expect.objectContaining({ contains: 'invoice' }),
              }),
            ]),
          }),
        })
      );
    });

    it('should exclude inactive permissions by default', async () => {
      // Arrange
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);
      mockPrisma.permission.count.mockResolvedValue(1);

      // Act
      await permissionService.listPermissions({});

      // Assert
      expect(mockPrisma.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      );
    });

    it('should include inactive permissions when requested', async () => {
      // Arrange
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);
      mockPrisma.permission.count.mockResolvedValue(1);

      // Act
      await permissionService.listPermissions({ includeInactive: true });

      // Assert
      expect(mockPrisma.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ isActive: true }),
        })
      );
    });

    it('should support pagination', async () => {
      // Arrange
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);
      mockPrisma.permission.count.mockResolvedValue(100);

      // Act
      const result = await permissionService.listPermissions({ page: 2, pageSize: 20 });

      // Assert
      expect(mockPrisma.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        })
      );
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(5);
    });
  });

  describe('updatePermission', () => {
    it('should update permission successfully', async () => {
      // Arrange
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      const updatedPermission = { ...mockPermission, displayName: 'Updated Name' };
      mockPrisma.permission.update.mockResolvedValue(updatedPermission);

      // Act
      const result = await permissionService.updatePermission(
        PERMISSION_ID,
        { displayName: 'Updated Name' },
        ADMIN_ID
      );

      // Assert
      expect(result.displayName).toBe('Updated Name');
      expect(mockPrisma.permission.update).toHaveBeenCalled();
    });

    it('should throw NOT_FOUND for non-existent permission', async () => {
      // Arrange
      mockPrisma.permission.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        permissionService.updatePermission('non-existent', { displayName: 'Test' }, ADMIN_ID)
      ).rejects.toThrow(TRPCError);
      await expect(
        permissionService.updatePermission('non-existent', { displayName: 'Test' }, ADMIN_ID)
      ).rejects.toThrow(/nie zostało znalezione/i);
    });

    it('should log audit event on permission update', async () => {
      // Arrange
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.permission.update.mockResolvedValue(mockPermission);

      // Act
      await permissionService.updatePermission(
        PERMISSION_ID,
        { displayName: 'Updated Name' },
        ADMIN_ID
      );

      // Assert
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PERMISSION_UPDATED',
          actorId: ADMIN_ID,
        })
      );
    });
  });

  describe('deletePermission', () => {
    it('should soft delete permission successfully', async () => {
      // Arrange
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.rolePermission.count.mockResolvedValue(0);
      mockPrisma.userPermission.count.mockResolvedValue(0);
      mockPrisma.permission.update.mockResolvedValue({ ...mockPermission, isActive: false });

      // Act
      await permissionService.deletePermission(PERMISSION_ID, ADMIN_ID);

      // Assert
      expect(mockPrisma.permission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PERMISSION_ID },
          data: expect.objectContaining({ isActive: false }),
        })
      );
    });

    it('should throw NOT_FOUND for non-existent permission', async () => {
      // Arrange
      mockPrisma.permission.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        permissionService.deletePermission('non-existent', ADMIN_ID)
      ).rejects.toThrow(/nie zostało znalezione/i);
    });

    it('should reject deletion of permission in use by roles', async () => {
      // Arrange
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.rolePermission.count.mockResolvedValue(3);
      mockPrisma.userPermission.count.mockResolvedValue(0);

      // Act & Assert
      await expect(
        permissionService.deletePermission(PERMISSION_ID, ADMIN_ID)
      ).rejects.toThrow(/używane/i);
    });

    it('should reject deletion of permission in use by users', async () => {
      // Arrange
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.rolePermission.count.mockResolvedValue(0);
      mockPrisma.userPermission.count.mockResolvedValue(5);

      // Act & Assert
      await expect(
        permissionService.deletePermission(PERMISSION_ID, ADMIN_ID)
      ).rejects.toThrow(/używane/i);
    });
  });

  // ==========================================================================
  // USER PERMISSION MANAGEMENT
  // ==========================================================================
  describe('assignPermissionToUser', () => {
    it('should assign permission to user successfully', async () => {
      // Arrange
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.userPermission.findUnique.mockResolvedValue(null); // Not already assigned
      mockPrisma.userPermission.create.mockResolvedValue(mockUserPermission);

      const input = {
        userId: USER_ID,
        permissionId: PERMISSION_ID,
        grantedBy: ADMIN_ID,
      };

      // Act
      const result = await permissionService.assignPermissionToUser(input);

      // Assert
      expect(result).toEqual(mockUserPermission);
      expect(mockPrisma.userPermission.create).toHaveBeenCalled();
    });

    it('should throw if permission does not exist', async () => {
      // Arrange
      mockPrisma.permission.findUnique.mockResolvedValue(null);

      const input = {
        userId: USER_ID,
        permissionId: 'non-existent',
        grantedBy: ADMIN_ID,
      };

      // Act & Assert
      await expect(
        permissionService.assignPermissionToUser(input)
      ).rejects.toThrow(/nie zostało znalezione/i);
    });

    it('should throw if permission already assigned', async () => {
      // Arrange
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.userPermission.findUnique.mockResolvedValue(mockUserPermission);

      const input = {
        userId: USER_ID,
        permissionId: PERMISSION_ID,
        grantedBy: ADMIN_ID,
      };

      // Act & Assert
      await expect(
        permissionService.assignPermissionToUser(input)
      ).rejects.toThrow(/już przypisane/i);
    });

    it('should support permission with expiration date', async () => {
      // Arrange
      const expiresAt = new Date('2025-12-31');
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.userPermission.findUnique.mockResolvedValue(null);
      mockPrisma.userPermission.create.mockResolvedValue({
        ...mockUserPermission,
        expiresAt,
      });

      const input = {
        userId: USER_ID,
        permissionId: PERMISSION_ID,
        grantedBy: ADMIN_ID,
        expiresAt: expiresAt.toISOString(),
      };

      // Act
      const result = await permissionService.assignPermissionToUser(input);

      // Assert
      expect(result.expiresAt).toEqual(expiresAt);
    });

    it('should support permission with conditions', async () => {
      // Arrange
      const conditions = [{ type: 'own_organization', value: { orgId: ORG_ID } }];
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.userPermission.findUnique.mockResolvedValue(null);
      mockPrisma.userPermission.create.mockResolvedValue({
        ...mockUserPermission,
        conditions,
      });

      const input = {
        userId: USER_ID,
        permissionId: PERMISSION_ID,
        grantedBy: ADMIN_ID,
        conditions,
      };

      // Act
      const result = await permissionService.assignPermissionToUser(input);

      // Assert
      expect(result.conditions).toEqual(conditions);
    });

    it('should invalidate user permission cache on assignment', async () => {
      // Arrange
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.userPermission.findUnique.mockResolvedValue(null);
      mockPrisma.userPermission.create.mockResolvedValue(mockUserPermission);

      const input = {
        userId: USER_ID,
        permissionId: PERMISSION_ID,
        grantedBy: ADMIN_ID,
      };

      // Act
      await permissionService.assignPermissionToUser(input);

      // Assert
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should log audit event on permission assignment', async () => {
      // Arrange
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.userPermission.findUnique.mockResolvedValue(null);
      mockPrisma.userPermission.create.mockResolvedValue(mockUserPermission);

      const input = {
        userId: USER_ID,
        permissionId: PERMISSION_ID,
        grantedBy: ADMIN_ID,
      };

      // Act
      await permissionService.assignPermissionToUser(input);

      // Assert
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'USER_PERMISSION_ASSIGNED',
          actorId: ADMIN_ID,
        })
      );
    });
  });

  describe('revokePermissionFromUser', () => {
    it('should revoke permission from user successfully', async () => {
      // Arrange
      mockPrisma.userPermission.findUnique.mockResolvedValue(mockUserPermission);
      mockPrisma.userPermission.delete.mockResolvedValue(mockUserPermission);

      // Act
      await permissionService.revokePermissionFromUser(USER_ID, PERMISSION_ID, ADMIN_ID);

      // Assert
      expect(mockPrisma.userPermission.delete).toHaveBeenCalledWith({
        where: {
          userId_permissionId: {
            userId: USER_ID,
            permissionId: PERMISSION_ID,
          },
        },
      });
    });

    it('should throw if permission not assigned to user', async () => {
      // Arrange
      mockPrisma.userPermission.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        permissionService.revokePermissionFromUser(USER_ID, PERMISSION_ID, ADMIN_ID)
      ).rejects.toThrow(/nie jest przypisane/i);
    });

    it('should invalidate user permission cache on revocation', async () => {
      // Arrange
      mockPrisma.userPermission.findUnique.mockResolvedValue(mockUserPermission);
      mockPrisma.userPermission.delete.mockResolvedValue(mockUserPermission);

      // Act
      await permissionService.revokePermissionFromUser(USER_ID, PERMISSION_ID, ADMIN_ID);

      // Assert
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should log audit event on permission revocation', async () => {
      // Arrange
      mockPrisma.userPermission.findUnique.mockResolvedValue(mockUserPermission);
      mockPrisma.userPermission.delete.mockResolvedValue(mockUserPermission);

      // Act
      await permissionService.revokePermissionFromUser(USER_ID, PERMISSION_ID, ADMIN_ID);

      // Assert
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'USER_PERMISSION_REVOKED',
          actorId: ADMIN_ID,
        })
      );
    });
  });

  describe('getUserDirectPermissions', () => {
    it('should return direct permissions for user', async () => {
      // Arrange
      mockPrisma.userPermission.findMany.mockResolvedValue([mockUserPermission]);

      // Act
      const result = await permissionService.getUserDirectPermissions(USER_ID);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockUserPermission);
    });

    it('should exclude expired permissions by default', async () => {
      // Arrange
      mockPrisma.userPermission.findMany.mockResolvedValue([mockUserPermission]);

      // Act
      await permissionService.getUserDirectPermissions(USER_ID);

      // Assert
      expect(mockPrisma.userPermission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { expiresAt: null },
              { expiresAt: { gt: expect.any(Date) } },
            ]),
          }),
        })
      );
    });

    it('should include expired permissions when requested', async () => {
      // Arrange
      mockPrisma.userPermission.findMany.mockResolvedValue([mockUserPermission]);

      // Act
      await permissionService.getUserDirectPermissions(USER_ID, true);

      // Assert
      expect(mockPrisma.userPermission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            OR: expect.anything(),
          }),
        })
      );
    });
  });

  // ==========================================================================
  // BULK OPERATIONS
  // ==========================================================================
  describe('bulkAssignPermissions', () => {
    it('should add multiple permissions to a role', async () => {
      // Arrange
      const permissionIds = ['perm-1', 'perm-2', 'perm-3'];
      mockPrisma.permission.findMany.mockResolvedValue(
        permissionIds.map((id) => ({ id, resource: 'test', action: 'read', isActive: true }))
      );

      const input = {
        targetType: 'role' as const,
        targetId: ROLE_ID,
        permissionIds,
        operation: 'add' as const,
        actorId: ADMIN_ID,
      };

      // Act
      const result = await permissionService.bulkAssignPermissions(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.processed).toBe(3);
    });

    it('should remove multiple permissions from a user', async () => {
      // Arrange
      const permissionIds = ['perm-1', 'perm-2'];
      mockPrisma.permission.findMany.mockResolvedValue(
        permissionIds.map((id) => ({ id, resource: 'test', action: 'read', isActive: true }))
      );
      mockPrisma.userPermission.deleteMany.mockResolvedValue({ count: 2 });

      const input = {
        targetType: 'user' as const,
        targetId: USER_ID,
        permissionIds,
        operation: 'remove' as const,
        actorId: ADMIN_ID,
      };

      // Act
      const result = await permissionService.bulkAssignPermissions(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
    });

    it('should validate all permissions exist before bulk operation', async () => {
      // Arrange
      const permissionIds = ['perm-1', 'perm-2', 'non-existent'];
      mockPrisma.permission.findMany.mockResolvedValue([
        { id: 'perm-1' },
        { id: 'perm-2' },
      ]); // Only 2 found

      const input = {
        targetType: 'role' as const,
        targetId: ROLE_ID,
        permissionIds,
        operation: 'add' as const,
        actorId: ADMIN_ID,
      };

      // Act & Assert
      await expect(
        permissionService.bulkAssignPermissions(input)
      ).rejects.toThrow(/nie istnieją/i);
    });

    it('should log single audit event for bulk operation', async () => {
      // Arrange
      const permissionIds = ['perm-1', 'perm-2'];
      mockPrisma.permission.findMany.mockResolvedValue(
        permissionIds.map((id) => ({ id }))
      );

      const input = {
        targetType: 'role' as const,
        targetId: ROLE_ID,
        permissionIds,
        operation: 'add' as const,
        actorId: ADMIN_ID,
      };

      // Act
      await permissionService.bulkAssignPermissions(input);

      // Assert
      expect(mockAuditLogger.log).toHaveBeenCalledTimes(1);
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'BULK_PERMISSIONS_ASSIGNED',
        })
      );
    });
  });

  // ==========================================================================
  // PERMISSION USAGE
  // ==========================================================================
  describe('getPermissionUsage', () => {
    it('should return usage statistics for a permission', async () => {
      // Arrange
      mockPrisma.rolePermission.count.mockResolvedValue(5);
      mockPrisma.userPermission.count.mockResolvedValue(3);

      // Act
      const result = await permissionService.getPermissionUsage(PERMISSION_ID);

      // Assert
      expect(result.roleCount).toBe(5);
      expect(result.userCount).toBe(3);
    });
  });

  // ==========================================================================
  // EFFECTIVE PERMISSIONS
  // ==========================================================================
  describe('getUserEffectivePermissions', () => {
    it('should combine role and direct permissions', async () => {
      // Arrange
      const rolePermission = { ...mockPermission, id: 'role-perm', action: 'create' };
      const directPermission = { ...mockPermission, id: 'direct-perm', action: 'delete' };

      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            rolePermissions: [{ permission: rolePermission }],
          },
        },
      ]);
      mockPrisma.userPermission.findMany.mockResolvedValue([
        { permission: directPermission, isGranted: true },
      ]);

      // Act
      const result = await permissionService.getUserEffectivePermissions(USER_ID);

      // Assert
      expect(result).toHaveLength(2);
    });

    it('should group by source when requested', async () => {
      // Arrange
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            name: 'ADMIN',
            rolePermissions: [{ permission: mockPermission }],
          },
        },
      ]);
      mockPrisma.userPermission.findMany.mockResolvedValue([]);

      // Act
      const result = await permissionService.getUserEffectivePermissions(USER_ID, true);

      // Assert
      expect(result).toHaveProperty('roles');
      expect(result).toHaveProperty('direct');
    });

    it('should use cache when available', async () => {
      // Arrange
      const cachedPermissions = JSON.stringify([mockPermission]);
      mockRedis.get.mockResolvedValue(cachedPermissions);

      // Act
      const result = await permissionService.getUserEffectivePermissions(USER_ID);

      // Assert
      expect(mockPrisma.userRole.findMany).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should cache results after computation', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([]);
      mockPrisma.userPermission.findMany.mockResolvedValue([]);

      // Act
      await permissionService.getUserEffectivePermissions(USER_ID);

      // Assert
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // PERMISSION CHECK WITH CONDITIONS
  // ==========================================================================
  describe('checkPermissionWithContext', () => {
    it('should allow access when permission granted without conditions', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            rolePermissions: [{ permission: mockPermission }],
          },
        },
      ]);
      mockPrisma.userPermission.findMany.mockResolvedValue([]);

      // Act
      const result = await permissionService.checkPermissionWithContext(
        USER_ID,
        'invoices',
        'read',
        {}
      );

      // Assert
      expect(result.allowed).toBe(true);
    });

    it('should deny access when permission not granted', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([]);
      mockPrisma.userPermission.findMany.mockResolvedValue([]);

      // Act
      const result = await permissionService.checkPermissionWithContext(
        USER_ID,
        'invoices',
        'delete',
        {}
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should evaluate conditions for conditional permissions', async () => {
      // Arrange
      const conditionalPermission = {
        ...mockPermission,
        conditions: [{ type: 'own_organization', value: { orgId: ORG_ID } }],
      };
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([]);
      mockPrisma.userPermission.findMany.mockResolvedValue([
        { permission: conditionalPermission, isGranted: true, conditions: conditionalPermission.conditions },
      ]);

      // Act - with matching context
      const result = await permissionService.checkPermissionWithContext(
        USER_ID,
        'invoices',
        'read',
        { organizationId: ORG_ID }
      );

      // Assert
      expect(result.allowed).toBe(true);
    });

    it('should deny access when conditions not met', async () => {
      // Arrange
      const conditionalPermission = {
        ...mockPermission,
        conditions: [{ type: 'own_organization', value: { orgId: ORG_ID } }],
      };
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([]);
      mockPrisma.userPermission.findMany.mockResolvedValue([
        { permission: conditionalPermission, isGranted: true, conditions: conditionalPermission.conditions },
      ]);
      // Service calls findFirst to get the direct permission with conditions
      mockPrisma.userPermission.findFirst.mockResolvedValue({
        userId: USER_ID,
        permissionId: conditionalPermission.id,
        isGranted: true,
        conditions: conditionalPermission.conditions,
      });

      // Act - with different organization
      const result = await permissionService.checkPermissionWithContext(
        USER_ID,
        'invoices',
        'read',
        { organizationId: 'different-org' }
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('condition');
    });

    it('should support wildcard action matching', async () => {
      // Arrange
      const wildcardPermission = { ...mockPermission, action: '*' };
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            rolePermissions: [{ permission: wildcardPermission }],
          },
        },
      ]);
      mockPrisma.userPermission.findMany.mockResolvedValue([]);

      // Act
      const result = await permissionService.checkPermissionWithContext(
        USER_ID,
        'invoices',
        'any_action',
        {}
      );

      // Assert
      expect(result.allowed).toBe(true);
    });
  });

  // ==========================================================================
  // PERMISSION VALIDATION
  // ==========================================================================
  describe('validatePermissionFormat', () => {
    it('should validate correct resource format', () => {
      expect(() => permissionService.validateResourceFormat('invoices')).not.toThrow();
      expect(() => permissionService.validateResourceFormat('client_notes')).not.toThrow();
      expect(() => permissionService.validateResourceFormat('crm123')).not.toThrow();
    });

    it('should reject invalid resource format', () => {
      expect(() => permissionService.validateResourceFormat('Invalid')).toThrow();
      expect(() => permissionService.validateResourceFormat('123start')).toThrow();
      expect(() => permissionService.validateResourceFormat('with-dash')).toThrow();
      expect(() => permissionService.validateResourceFormat('with space')).toThrow();
    });

    it('should validate correct action format', () => {
      expect(() => permissionService.validateActionFormat('read')).not.toThrow();
      expect(() => permissionService.validateActionFormat('*')).not.toThrow();
      expect(() => permissionService.validateActionFormat('create_draft')).not.toThrow();
    });

    it('should reject invalid action format', () => {
      expect(() => permissionService.validateActionFormat('READ')).toThrow();
      expect(() => permissionService.validateActionFormat('**')).toThrow();
      expect(() => permissionService.validateActionFormat('with-dash')).toThrow();
    });
  });
});
