import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createContext } from '../../context';
import { appRouter } from '../../index';

// ==========================================================================
// MOCKS
// ==========================================================================

const mockPrisma = {
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
  authAuditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  keys: vi.fn(),
  pipeline: vi.fn(() => ({
    del: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
};

// ==========================================================================
// TEST SUITE
// ==========================================================================

describe('Permission Router', () => {
  let adminCaller: ReturnType<typeof appRouter.createCaller>;
  let userCaller: ReturnType<typeof appRouter.createCaller>;

  // UUIDs
  const ADMIN_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const REGULAR_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440002';
  const PERMISSION_ID = '550e8400-e29b-41d4-a716-446655440020';
  const ROLE_ID = '550e8400-e29b-41d4-a716-446655440010';
  const ORG_ID = '550e8400-e29b-41d4-a716-446655440030';

  const mockPermission = {
    id: PERMISSION_ID,
    resource: 'invoices',
    action: 'read',
    displayName: 'Read Invoices',
    description: 'Permission to read invoices',
    module: 'FKW',
    conditions: null,
    isActive: true,
    createdAt: new Date('2025-01-15T12:00:00.000Z'),
    updatedAt: new Date('2025-01-15T12:00:00.000Z'),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    vi.clearAllMocks();

    // Default mocks
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.keys.mockResolvedValue([]);

    mockPrisma.authAuditLog.create.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // CONTEXT HELPERS
  // ==========================================================================

  function createAdminContext() {
    const ctx = createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
          authorization: 'Bearer admin-token',
        },
        url: '/api/trpc/permission',
        method: 'POST',
      } as any,
      res: {} as any,
    });

    return {
      ...ctx,
      session: {
        sessionId: SESSION_ID,
        userId: ADMIN_USER_ID,
        email: 'admin@example.com',
        roles: ['SUPER_ADMIN'],
        organizationId: ORG_ID,
      },
    };
  }

  function createUserContext() {
    const ctx = createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
          authorization: 'Bearer user-token',
        },
        url: '/api/trpc/permission',
        method: 'POST',
      } as any,
      res: {} as any,
    });

    return {
      ...ctx,
      session: {
        sessionId: SESSION_ID,
        userId: REGULAR_USER_ID,
        email: 'user@example.com',
        roles: ['USER'],
        organizationId: ORG_ID,
      },
    };
  }

  function createUnauthenticatedContext() {
    return createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
        },
        url: '/api/trpc/permission',
        method: 'POST',
      } as any,
      res: {} as any,
    });
  }

  // ==========================================================================
  // AUTHORIZATION TESTS
  // ==========================================================================

  describe('Authorization', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should require admin role for createPermission', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.permission.create({
          resource: 'reports',
          action: 'read',
          displayName: 'Read Reports',
          module: 'REPORTS',
        })
      ).rejects.toThrow();
    });

    it('should require admin role for deletePermission', async () => {
      await expect(
        userCaller.aim.permission.delete({ permissionId: PERMISSION_ID })
      ).rejects.toThrow();
    });

    it('should allow admins to create permissions', async () => {
      mockPrisma.permission.findFirst.mockResolvedValue(null);
      mockPrisma.permission.create.mockResolvedValue({
        ...mockPermission,
        resource: 'reports',
        action: 'read',
        displayName: 'Read Reports',
        module: 'REPORTS',
      });

      const result = await adminCaller.aim.permission.create({
        resource: 'reports',
        action: 'read',
        displayName: 'Read Reports',
        module: 'REPORTS',
      });

      expect(result.resource).toBe('reports');
      expect(result.action).toBe('read');
    });
  });

  // ==========================================================================
  // CREATE PERMISSION TESTS
  // ==========================================================================

  describe('createPermission', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should create a new permission', async () => {
      mockPrisma.permission.findFirst.mockResolvedValue(null);
      mockPrisma.permission.create.mockResolvedValue(mockPermission);

      const result = await adminCaller.aim.permission.create({
        resource: 'invoices',
        action: 'read',
        displayName: 'Read Invoices',
        module: 'FKW',
      });

      expect(result.id).toBe(PERMISSION_ID);
      expect(result.resource).toBe('invoices');
      expect(result.action).toBe('read');
    });

    it('should reject duplicate permission key', async () => {
      mockPrisma.permission.findFirst.mockResolvedValue(mockPermission);

      await expect(
        adminCaller.aim.permission.create({
          resource: 'invoices',
          action: 'read',
          displayName: 'Another Read Invoices',
          module: 'FKW',
        })
      ).rejects.toThrow(/istnieje/i);
    });

    it('should validate resource format', async () => {
      await expect(
        adminCaller.aim.permission.create({
          resource: 'Invalid-Resource',
          action: 'read',
          displayName: 'Test',
          module: 'TEST',
        })
      ).rejects.toThrow();
    });

    it('should validate action format', async () => {
      await expect(
        adminCaller.aim.permission.create({
          resource: 'invoices',
          action: 'INVALID-ACTION',
          displayName: 'Test',
          module: 'TEST',
        })
      ).rejects.toThrow();
    });

    it('should allow wildcard action', async () => {
      mockPrisma.permission.findFirst.mockResolvedValue(null);
      mockPrisma.permission.create.mockResolvedValue({
        ...mockPermission,
        action: '*',
        displayName: 'Full Invoices Access',
      });

      const result = await adminCaller.aim.permission.create({
        resource: 'invoices',
        action: '*',
        displayName: 'Full Invoices Access',
        module: 'FKW',
      });

      expect(result.action).toBe('*');
    });

    it('should log audit event on creation', async () => {
      mockPrisma.permission.findFirst.mockResolvedValue(null);
      mockPrisma.permission.create.mockResolvedValue(mockPermission);

      await adminCaller.aim.permission.create({
        resource: 'invoices',
        action: 'read',
        displayName: 'Read Invoices',
        module: 'FKW',
      });

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GET PERMISSION TESTS
  // ==========================================================================

  describe('getPermissionById', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should return permission by ID', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);

      const result = await adminCaller.aim.permission.getById({ permissionId: PERMISSION_ID });

      expect(result).toBeDefined();
      expect(result?.id).toBe(PERMISSION_ID);
    });

    it('should return null for non-existent permission', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(null);

      const result = await adminCaller.aim.permission.getById({
        permissionId: '550e8400-e29b-41d4-a716-446655449999',
      });

      expect(result).toBeNull();
    });
  });

  describe('getPermissionByKey', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should return permission by resource.action key', async () => {
      mockPrisma.permission.findFirst.mockResolvedValue(mockPermission);

      const result = await adminCaller.aim.permission.getByKey({
        resource: 'invoices',
        action: 'read',
      });

      expect(result).toBeDefined();
      expect(result?.resource).toBe('invoices');
      expect(result?.action).toBe('read');
    });

    it('should return null for non-existent key', async () => {
      mockPrisma.permission.findFirst.mockResolvedValue(null);

      const result = await adminCaller.aim.permission.getByKey({
        resource: 'nonexistent',
        action: 'read',
      });

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // LIST PERMISSIONS TESTS
  // ==========================================================================

  describe('listPermissions', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should list permissions with pagination', async () => {
      const permissions = [mockPermission, { ...mockPermission, id: 'perm-2', action: 'create' }];
      mockPrisma.permission.findMany.mockResolvedValue(permissions);
      mockPrisma.permission.count.mockResolvedValue(2);

      const result = await adminCaller.aim.permission.list({
        page: 1,
        pageSize: 10,
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('should filter by module', async () => {
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);
      mockPrisma.permission.count.mockResolvedValue(1);

      const result = await adminCaller.aim.permission.list({
        module: 'FKW',
        page: 1,
        pageSize: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(mockPrisma.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ module: 'FKW' }),
        })
      );
    });

    it('should filter by resource', async () => {
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);
      mockPrisma.permission.count.mockResolvedValue(1);

      const result = await adminCaller.aim.permission.list({
        resource: 'invoices',
        page: 1,
        pageSize: 10,
      });

      expect(result.items).toHaveLength(1);
    });

    it('should search by displayName, resource, or action', async () => {
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);
      mockPrisma.permission.count.mockResolvedValue(1);

      await adminCaller.aim.permission.list({
        search: 'invoice',
        page: 1,
        pageSize: 10,
      });

      expect(mockPrisma.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ displayName: expect.anything() }),
              expect.objectContaining({ resource: expect.anything() }),
              expect.objectContaining({ action: expect.anything() }),
            ]),
          }),
        })
      );
    });

    it('should include inactive permissions when requested', async () => {
      mockPrisma.permission.findMany.mockResolvedValue([]);
      mockPrisma.permission.count.mockResolvedValue(0);

      await adminCaller.aim.permission.list({
        includeInactive: true,
        page: 1,
        pageSize: 10,
      });

      // Should not filter by isActive
      const call = mockPrisma.permission.findMany.mock.calls[0][0];
      expect(call.where?.isActive).toBeUndefined();
    });
  });

  // ==========================================================================
  // UPDATE PERMISSION TESTS
  // ==========================================================================

  describe('updatePermission', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should update permission displayName', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.permission.update.mockResolvedValue({
        ...mockPermission,
        displayName: 'Updated Display Name',
      });

      const result = await adminCaller.aim.permission.update({
        permissionId: PERMISSION_ID,
        displayName: 'Updated Display Name',
      });

      expect(result.displayName).toBe('Updated Display Name');
    });

    it('should throw for non-existent permission', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(null);

      await expect(
        adminCaller.aim.permission.update({
          permissionId: '550e8400-e29b-41d4-a716-446655449999',
          displayName: 'Test',
        })
      ).rejects.toThrow(/nie zostało znalezione/i);
    });

    it('should update permission isActive status', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.permission.update.mockResolvedValue({
        ...mockPermission,
        isActive: false,
      });

      const result = await adminCaller.aim.permission.update({
        permissionId: PERMISSION_ID,
        isActive: false,
      });

      expect(result.isActive).toBe(false);
    });

    it('should invalidate cache on update', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.permission.update.mockResolvedValue(mockPermission);
      mockRedis.keys.mockResolvedValue(['user_permissions:user-1', 'user_permissions:user-2']);

      await adminCaller.aim.permission.update({
        permissionId: PERMISSION_ID,
        displayName: 'Updated',
      });

      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // DELETE PERMISSION TESTS
  // ==========================================================================

  describe('deletePermission', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should delete permission when not in use', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.rolePermission.count.mockResolvedValue(0);
      mockPrisma.userPermission.count.mockResolvedValue(0);
      mockPrisma.permission.update.mockResolvedValue({
        ...mockPermission,
        isActive: false,
      });

      await adminCaller.aim.permission.delete({ permissionId: PERMISSION_ID });

      expect(mockPrisma.permission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PERMISSION_ID },
          data: expect.objectContaining({ isActive: false }),
        })
      );
    });

    it('should throw when permission is assigned to roles', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.rolePermission.count.mockResolvedValue(3);
      mockPrisma.userPermission.count.mockResolvedValue(0);

      await expect(
        adminCaller.aim.permission.delete({ permissionId: PERMISSION_ID })
      ).rejects.toThrow(/używane/i);
    });

    it('should throw when permission is assigned to users', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.rolePermission.count.mockResolvedValue(0);
      mockPrisma.userPermission.count.mockResolvedValue(2);

      await expect(
        adminCaller.aim.permission.delete({ permissionId: PERMISSION_ID })
      ).rejects.toThrow(/używane/i);
    });

    it('should throw for non-existent permission', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(null);

      await expect(
        adminCaller.aim.permission.delete({
          permissionId: '550e8400-e29b-41d4-a716-446655449999',
        })
      ).rejects.toThrow(/nie zostało znalezione/i);
    });
  });

  // ==========================================================================
  // USER PERMISSION ASSIGNMENT TESTS
  // ==========================================================================

  describe('assignPermissionToUser', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should assign permission to user with GRANT type', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.userPermission.findUnique.mockResolvedValue(null);
      mockPrisma.userPermission.create.mockResolvedValue({
        id: 'user-perm-1',
        userId: REGULAR_USER_ID,
        permissionId: PERMISSION_ID,
        isGranted: true,
        conditions: [],
        reason: 'Test assignment',
        createdAt: new Date(),
        permission: mockPermission,
      });

      const result = await adminCaller.aim.permission.assignToUser({
        userId: REGULAR_USER_ID,
        permissionId: PERMISSION_ID,
        permissionType: 'GRANT',
        reason: 'Test assignment',
      });

      expect(result.userId).toBe(REGULAR_USER_ID);
      expect(result.permissionId).toBe(PERMISSION_ID);
      expect(result.isGranted).toBe(true);
    });

    it('should assign permission with DENY type', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.userPermission.findUnique.mockResolvedValue(null);
      mockPrisma.userPermission.create.mockResolvedValue({
        id: 'user-perm-1',
        userId: REGULAR_USER_ID,
        permissionId: PERMISSION_ID,
        isGranted: false,
        conditions: [],
        reason: 'Access restriction',
        createdAt: new Date(),
        permission: mockPermission,
      });

      const result = await adminCaller.aim.permission.assignToUser({
        userId: REGULAR_USER_ID,
        permissionId: PERMISSION_ID,
        permissionType: 'DENY',
        reason: 'Access restriction',
      });

      expect(result.isGranted).toBe(false);
    });

    it('should assign permission with conditions', async () => {
      const conditions = [{ type: 'own_organization' as const, value: { orgId: ORG_ID } }];
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.userPermission.findUnique.mockResolvedValue(null);
      mockPrisma.userPermission.create.mockResolvedValue({
        id: 'user-perm-1',
        userId: REGULAR_USER_ID,
        permissionId: PERMISSION_ID,
        isGranted: true,
        conditions,
        reason: null,
        createdAt: new Date(),
        permission: mockPermission,
      });

      const result = await adminCaller.aim.permission.assignToUser({
        userId: REGULAR_USER_ID,
        permissionId: PERMISSION_ID,
        conditions,
      });

      expect(result.conditions).toEqual(conditions);
    });

    it('should assign permission with expiration', async () => {
      const expiresAt = '2025-12-31T23:59:59.000Z';
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.userPermission.findUnique.mockResolvedValue(null);
      mockPrisma.userPermission.create.mockResolvedValue({
        id: 'user-perm-1',
        userId: REGULAR_USER_ID,
        permissionId: PERMISSION_ID,
        isGranted: true,
        conditions: [],
        expiresAt: new Date(expiresAt),
        reason: null,
        createdAt: new Date(),
        permission: mockPermission,
      });

      const result = await adminCaller.aim.permission.assignToUser({
        userId: REGULAR_USER_ID,
        permissionId: PERMISSION_ID,
        expiresAt,
      });

      expect(result.expiresAt).toBeDefined();
    });

    it('should throw when permission already assigned', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.userPermission.findUnique.mockResolvedValue({
        id: 'existing-perm',
        userId: REGULAR_USER_ID,
        permissionId: PERMISSION_ID,
        isGranted: false,
      });

      await expect(
        adminCaller.aim.permission.assignToUser({
          userId: REGULAR_USER_ID,
          permissionId: PERMISSION_ID,
          permissionType: 'GRANT',
          reason: 'Updated',
        })
      ).rejects.toThrow(/już przypisane/i);
    });

    it('should invalidate user permission cache', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.userPermission.findUnique.mockResolvedValue(null);
      mockPrisma.userPermission.create.mockResolvedValue({
        id: 'user-perm-1',
        userId: REGULAR_USER_ID,
        permissionId: PERMISSION_ID,
        isGranted: true,
        conditions: [],
        createdAt: new Date(),
        permission: mockPermission,
      });

      await adminCaller.aim.permission.assignToUser({
        userId: REGULAR_USER_ID,
        permissionId: PERMISSION_ID,
      });

      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining(REGULAR_USER_ID)
      );
    });
  });

  // ==========================================================================
  // REVOKE USER PERMISSION TESTS
  // ==========================================================================

  describe('revokePermissionFromUser', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should revoke permission from user', async () => {
      mockPrisma.userPermission.findUnique.mockResolvedValue({
        id: 'user-perm-1',
        userId: REGULAR_USER_ID,
        permissionId: PERMISSION_ID,
        isGranted: true,
        permission: mockPermission,
      });
      mockPrisma.userPermission.delete.mockResolvedValue({});

      await adminCaller.aim.permission.revokeFromUser({
        userId: REGULAR_USER_ID,
        permissionId: PERMISSION_ID,
        reason: 'No longer needed',
      });

      expect(mockPrisma.userPermission.delete).toHaveBeenCalled();
    });

    it('should throw when permission not assigned', async () => {
      mockPrisma.userPermission.findUnique.mockResolvedValue(null);

      await expect(
        adminCaller.aim.permission.revokeFromUser({
          userId: REGULAR_USER_ID,
          permissionId: PERMISSION_ID,
        })
      ).rejects.toThrow(/nie jest przypisane/i);
    });

    it('should invalidate user permission cache on revoke', async () => {
      mockPrisma.userPermission.findUnique.mockResolvedValue({
        id: 'user-perm-1',
        userId: REGULAR_USER_ID,
        permissionId: PERMISSION_ID,
        permission: mockPermission,
      });
      mockPrisma.userPermission.delete.mockResolvedValue({});

      await adminCaller.aim.permission.revokeFromUser({
        userId: REGULAR_USER_ID,
        permissionId: PERMISSION_ID,
      });

      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining(REGULAR_USER_ID)
      );
    });

    it('should log audit event on revocation', async () => {
      mockPrisma.userPermission.findUnique.mockResolvedValue({
        id: 'user-perm-1',
        userId: REGULAR_USER_ID,
        permissionId: PERMISSION_ID,
        permission: mockPermission,
      });
      mockPrisma.userPermission.delete.mockResolvedValue({});

      await adminCaller.aim.permission.revokeFromUser({
        userId: REGULAR_USER_ID,
        permissionId: PERMISSION_ID,
        reason: 'Security review',
      });

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GET USER PERMISSIONS TESTS
  // ==========================================================================

  describe('getUserPermissions', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should return direct permissions for user', async () => {
      mockPrisma.userPermission.findMany.mockResolvedValue([
        {
          id: 'user-perm-1',
          userId: REGULAR_USER_ID,
          permissionId: PERMISSION_ID,
          isGranted: true,
          permission: mockPermission,
        },
      ]);

      const result = await adminCaller.aim.permission.getUserPermissions({
        userId: REGULAR_USER_ID,
      });

      expect(result).toHaveLength(1);
      expect(result[0].permission.id).toBe(PERMISSION_ID);
    });

    it('should exclude expired permissions by default', async () => {
      mockPrisma.userPermission.findMany.mockResolvedValue([]);

      await adminCaller.aim.permission.getUserPermissions({
        userId: REGULAR_USER_ID,
      });

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

    it('should include expired when requested', async () => {
      mockPrisma.userPermission.findMany.mockResolvedValue([]);

      await adminCaller.aim.permission.getUserPermissions({
        userId: REGULAR_USER_ID,
        includeExpired: true,
      });

      const call = mockPrisma.userPermission.findMany.mock.calls[0][0];
      expect(call.where?.OR).toBeUndefined();
    });
  });

  // ==========================================================================
  // EFFECTIVE PERMISSIONS TESTS
  // ==========================================================================

  describe('getUserEffectivePermissions', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should return combined role and direct permissions', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            name: 'ADMIN',
            rolePermissions: [{ permission: mockPermission }],
          },
        },
      ]);
      mockPrisma.userPermission.findMany.mockResolvedValue([
        {
          permission: { ...mockPermission, id: 'direct-perm', action: 'delete' },
          isGranted: true,
        },
      ]);

      const result = await adminCaller.aim.permission.getEffectivePermissions({
        userId: REGULAR_USER_ID,
      });

      expect(result).toHaveLength(2);
    });

    it('should use cached permissions when available', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify([mockPermission])
      );

      const result = await adminCaller.aim.permission.getEffectivePermissions({
        userId: REGULAR_USER_ID,
      });

      expect(result).toHaveLength(1);
      expect(mockPrisma.userRole.findMany).not.toHaveBeenCalled();
    });

    it('should group by source when requested', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            name: 'ADMIN',
            rolePermissions: [{ permission: mockPermission }],
          },
        },
      ]);
      mockPrisma.userPermission.findMany.mockResolvedValue([]);

      const result = await adminCaller.aim.permission.getEffectivePermissions({
        userId: REGULAR_USER_ID,
        groupBySource: true,
      });

      expect(result).toHaveProperty('roles');
      expect(result).toHaveProperty('direct');
    });

    it('should deduplicate permissions from multiple sources', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            name: 'ADMIN',
            rolePermissions: [{ permission: mockPermission }],
          },
        },
      ]);
      mockPrisma.userPermission.findMany.mockResolvedValue([
        { permission: mockPermission, isGranted: true },
      ]);

      const result = await adminCaller.aim.permission.getEffectivePermissions({
        userId: REGULAR_USER_ID,
      });

      // Should have only 1 permission (deduplicated)
      expect(result).toHaveLength(1);
    });
  });

  // ==========================================================================
  // BULK OPERATIONS TESTS
  // ==========================================================================

  describe('bulkAssignPermissions', () => {
    const PERM_ID_1 = '550e8400-e29b-41d4-a716-446655440100';
    const PERM_ID_2 = '550e8400-e29b-41d4-a716-446655440101';
    const PERM_ID_3 = '550e8400-e29b-41d4-a716-446655440102';

    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should add multiple permissions to role', async () => {
      const permissionIds = [PERM_ID_1, PERM_ID_2];
      mockPrisma.permission.findMany.mockResolvedValue(
        permissionIds.map((id) => ({ id, resource: 'test', action: 'read', isActive: true }))
      );
      mockPrisma.rolePermission.upsert.mockResolvedValue({});

      const result = await adminCaller.aim.permission.bulkAssign({
        targetType: 'role',
        targetId: ROLE_ID,
        permissionIds,
        operation: 'add',
      });

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
    });

    it('should remove multiple permissions from user', async () => {
      const permissionIds = [PERM_ID_1, PERM_ID_2];
      mockPrisma.permission.findMany.mockResolvedValue(
        permissionIds.map((id) => ({ id }))
      );
      mockPrisma.userPermission.deleteMany.mockResolvedValue({ count: 2 });

      const result = await adminCaller.aim.permission.bulkAssign({
        targetType: 'user',
        targetId: REGULAR_USER_ID,
        permissionIds,
        operation: 'remove',
      });

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
    });

    it('should validate all permissions exist', async () => {
      const permissionIds = [PERM_ID_1, PERM_ID_3];
      mockPrisma.permission.findMany.mockResolvedValue([{ id: PERM_ID_1 }]);

      await expect(
        adminCaller.aim.permission.bulkAssign({
          targetType: 'role',
          targetId: ROLE_ID,
          permissionIds,
          operation: 'add',
        })
      ).rejects.toThrow(/nie istnieją/i);
    });

    it('should log single audit event for bulk operation', async () => {
      const permissionIds = [PERM_ID_1, PERM_ID_2];
      mockPrisma.permission.findMany.mockResolvedValue(
        permissionIds.map((id) => ({ id }))
      );
      mockPrisma.rolePermission.upsert.mockResolvedValue({});

      await adminCaller.aim.permission.bulkAssign({
        targetType: 'role',
        targetId: ROLE_ID,
        permissionIds,
        operation: 'add',
      });

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // PERMISSION USAGE TESTS
  // ==========================================================================

  describe('getPermissionUsage', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should return usage statistics', async () => {
      mockPrisma.rolePermission.count.mockResolvedValue(5);
      mockPrisma.userPermission.count.mockResolvedValue(3);

      const result = await adminCaller.aim.permission.getUsage({
        permissionId: PERMISSION_ID,
      });

      expect(result.roleCount).toBe(5);
      expect(result.userCount).toBe(3);
    });
  });

  // ==========================================================================
  // PERMISSION CHECK TESTS
  // ==========================================================================

  describe('checkPermission', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should allow access when permission granted', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            rolePermissions: [{ permission: mockPermission }],
          },
        },
      ]);
      mockPrisma.userPermission.findMany.mockResolvedValue([]);
      mockPrisma.userPermission.findFirst.mockResolvedValue(null);

      const result = await adminCaller.aim.permission.check({
        userId: REGULAR_USER_ID,
        resource: 'invoices',
        action: 'read',
      });

      expect(result.allowed).toBe(true);
    });

    it('should deny access when permission not granted', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([]);
      mockPrisma.userPermission.findMany.mockResolvedValue([]);

      const result = await adminCaller.aim.permission.check({
        userId: REGULAR_USER_ID,
        resource: 'invoices',
        action: 'delete',
      });

      expect(result.allowed).toBe(false);
    });

    it('should support wildcard permission matching', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            rolePermissions: [{ permission: { ...mockPermission, action: '*' } }],
          },
        },
      ]);
      mockPrisma.userPermission.findMany.mockResolvedValue([]);
      mockPrisma.userPermission.findFirst.mockResolvedValue(null);

      const result = await adminCaller.aim.permission.check({
        userId: REGULAR_USER_ID,
        resource: 'invoices',
        action: 'any_action',
      });

      expect(result.allowed).toBe(true);
    });

    it('should evaluate conditions with context', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([]);
      mockPrisma.userPermission.findMany.mockResolvedValue([
        {
          permission: mockPermission,
          isGranted: true,
          conditions: [{ type: 'own_organization', value: { orgId: ORG_ID } }],
        },
      ]);
      mockPrisma.userPermission.findFirst.mockResolvedValue({
        isGranted: true,
        conditions: [{ type: 'own_organization', value: { orgId: ORG_ID } }],
      });

      const result = await adminCaller.aim.permission.check({
        userId: REGULAR_USER_ID,
        resource: 'invoices',
        action: 'read',
        context: { organizationId: ORG_ID },
      });

      expect(result.allowed).toBe(true);
    });

    it('should deny when conditions not met', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([]);
      mockPrisma.userPermission.findMany.mockResolvedValue([
        {
          permission: mockPermission,
          isGranted: true,
          conditions: [{ type: 'own_organization', value: { orgId: ORG_ID } }],
        },
      ]);
      mockPrisma.userPermission.findFirst.mockResolvedValue({
        isGranted: true,
        conditions: [{ type: 'own_organization', value: { orgId: ORG_ID } }],
      });

      const result = await adminCaller.aim.permission.check({
        userId: REGULAR_USER_ID,
        resource: 'invoices',
        action: 'read',
        context: { organizationId: 'different-org' },
      });

      expect(result.allowed).toBe(false);
    });
  });
});
