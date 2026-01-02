import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createContext } from '../../context';
import { appRouter } from '../../index';

// Mock dependencies
const mockPrisma = {
  role: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  permission: {
    findMany: vi.fn(),
  },
  rolePermission: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  roleHierarchy: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
  },
  userRole: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  userPermissionCache: {
    upsert: vi.fn(),
    deleteMany: vi.fn(),
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

describe('RBAC Router', () => {
  let adminCaller: ReturnType<typeof appRouter.createCaller>;
  let userCaller: ReturnType<typeof appRouter.createCaller>;

  // Use valid UUIDs
  const ADMIN_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const REGULAR_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440002';
  const ROLE_ID = '550e8400-e29b-41d4-a716-446655440010';
  const PERMISSION_ID = '550e8400-e29b-41d4-a716-446655440020';
  const PARENT_ROLE_ID = '550e8400-e29b-41d4-a716-446655440011';

  const mockRole = {
    id: ROLE_ID,
    name: 'CUSTOM_ROLE',
    displayName: 'Custom Role',
    description: 'A custom role for testing',
    isSystem: false,
    isActive: true,
    organizationId: null,
    parentRoleId: null,
    metadata: {},
    createdAt: new Date('2025-01-15T12:00:00.000Z'),
    updatedAt: new Date('2025-01-15T12:00:00.000Z'),
    permissions: [],
    parentRole: null,
  };

  const mockSystemRole = {
    ...mockRole,
    id: '550e8400-e29b-41d4-a716-446655440012',
    name: 'SUPER_ADMIN',
    displayName: 'Super Administrator',
    isSystem: true,
  };

  const mockPermission = {
    id: PERMISSION_ID,
    resource: 'clients',
    action: 'read',
    displayName: 'Read Clients',
    description: 'Permission to read clients',
    module: 'CRM',
    isSystem: true,
    createdAt: new Date('2025-01-15T12:00:00.000Z'),
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
    mockPrisma.roleHierarchy.findMany.mockResolvedValue([]);
    mockPrisma.userPermissionCache.upsert.mockResolvedValue({});
    mockPrisma.userPermissionCache.deleteMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Helper to create authenticated context with admin role
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
        url: '/api/trpc/rbac',
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
        organizationId: '',
      },
    };
  }

  // Helper to create authenticated context with regular user role
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
        url: '/api/trpc/rbac',
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
        organizationId: '',
      },
    };
  }

  // Helper to create unauthenticated context
  function createUnauthenticatedContext() {
    return createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
        },
        url: '/api/trpc/rbac',
        method: 'POST',
      } as any,
      res: {} as any,
    });
  }

  // =========================================================================
  // Authorization Tests
  // =========================================================================
  describe('authorization', () => {
    it('should reject unauthenticated requests', async () => {
      // Arrange
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      // Act & Assert
      await expect(caller.aim.rbac.listRoles({})).rejects.toThrow('Musisz być zalogowany');
    });

    it('should reject non-admin users for admin-only endpoints', async () => {
      // Arrange
      userCaller = appRouter.createCaller(createUserContext());

      // Act & Assert
      await expect(
        userCaller.aim.rbac.createRole({
          name: 'NEW_ROLE',
          displayName: 'New Role',
        })
      ).rejects.toThrow('Brak uprawnień administratora');
    });

    it('should allow admin users to access admin endpoints', async () => {
      // Arrange
      adminCaller = appRouter.createCaller(createAdminContext());
      mockPrisma.role.findFirst.mockResolvedValue(null); // No duplicate
      mockPrisma.role.create.mockResolvedValue(mockRole);
      mockPrisma.roleHierarchy.create.mockResolvedValue({});
      // Mock getRoleById call after create
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        permissions: [],
        parentRole: null,
        _count: { userRoles: 0 },
      });

      // Act
      const result = await adminCaller.aim.rbac.createRole({
        name: 'NEW_ROLE',
        displayName: 'New Role',
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe('CUSTOM_ROLE');
    });
  });

  // =========================================================================
  // Role CRUD Operations
  // =========================================================================
  describe('rbac.createRole', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should create a new role successfully', async () => {
      // Arrange
      mockPrisma.role.findFirst.mockResolvedValue(null); // No duplicate
      mockPrisma.role.create.mockResolvedValue(mockRole);
      mockPrisma.roleHierarchy.create.mockResolvedValue({});
      // Mock getRoleById call after create
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        permissions: [],
        parentRole: null,
        _count: { userRoles: 0 },
      });

      // Act
      const result = await adminCaller.aim.rbac.createRole({
        name: 'CUSTOM_ROLE',
        displayName: 'Custom Role',
        description: 'A custom role for testing',
      });

      // Assert
      expect(result.name).toBe('CUSTOM_ROLE');
      expect(result.displayName).toBe('Custom Role');
      expect(mockPrisma.authAuditLog.create).toHaveBeenCalled();
    });

    it('should reject duplicate role names', async () => {
      // Arrange
      mockPrisma.role.findFirst.mockResolvedValue(mockRole); // Duplicate exists

      // Act & Assert
      await expect(
        adminCaller.aim.rbac.createRole({
          name: 'CUSTOM_ROLE',
          displayName: 'Custom Role',
        })
      ).rejects.toThrow();
    });

    it('should create role with parent role', async () => {
      // Arrange
      const parentRole = { ...mockRole, id: PARENT_ROLE_ID, name: 'PARENT_ROLE', isActive: true };
      mockPrisma.role.findFirst.mockResolvedValue(null); // No duplicate
      mockPrisma.role.findUnique.mockResolvedValue(parentRole); // Parent role check
      mockPrisma.role.create.mockResolvedValue({ ...mockRole, parentRoleId: PARENT_ROLE_ID });
      mockPrisma.roleHierarchy.create.mockResolvedValue({});
      mockPrisma.roleHierarchy.findMany.mockResolvedValue([]); // For hierarchy update

      // Mock getRoleById call after create
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        parentRoleId: PARENT_ROLE_ID,
        parentRole: { id: PARENT_ROLE_ID, name: 'PARENT_ROLE', displayName: 'Parent Role' },
        permissions: [],
        _count: { userRoles: 0 },
      });

      // Act
      const result = await adminCaller.aim.rbac.createRole({
        name: 'CHILD_ROLE',
        displayName: 'Child Role',
        parentRoleId: PARENT_ROLE_ID,
      });

      // Assert
      expect(result).toBeDefined();
    });

    it('should create role with initial permissions', async () => {
      // Arrange
      mockPrisma.role.findFirst.mockResolvedValue(null); // No duplicate
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);
      mockPrisma.role.create.mockResolvedValue(mockRole);
      mockPrisma.roleHierarchy.create.mockResolvedValue({});
      mockPrisma.rolePermission.createMany.mockResolvedValue({ count: 1 });
      // Mock getRoleById call after create
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        permissions: [{ permission: mockPermission }],
        parentRole: null,
        _count: { userRoles: 0 },
      });

      // Act
      const result = await adminCaller.aim.rbac.createRole({
        name: 'CUSTOM_ROLE',
        displayName: 'Custom Role',
        permissions: [PERMISSION_ID],
      });

      // Assert
      expect(result).toBeDefined();
      expect(mockPrisma.rolePermission.createMany).toHaveBeenCalled();
    });

    it('should validate role name format', async () => {
      // Arrange - role name must start with uppercase

      // Act & Assert
      await expect(
        adminCaller.aim.rbac.createRole({
          name: 'lowercase_role', // Invalid - must start with uppercase
          displayName: 'Invalid Role',
        })
      ).rejects.toThrow();
    });
  });

  describe('rbac.getRoleById', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should return role by ID', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        permissions: [],
        parentRole: null,
        _count: { userRoles: 0 },
      });

      // Act
      const result = await adminCaller.aim.rbac.getRoleById({ roleId: ROLE_ID });

      // Assert
      expect(result.id).toBe(ROLE_ID);
      expect(result.name).toBe('CUSTOM_ROLE');
    });

    it('should return cached role', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(JSON.stringify(mockRole));

      // Act
      const result = await adminCaller.aim.rbac.getRoleById({ roleId: ROLE_ID });

      // Assert
      expect(result.id).toBe(ROLE_ID);
      expect(mockPrisma.role.findUnique).not.toHaveBeenCalled();
    });

    it('should throw error for non-existent role', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.role.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        adminCaller.aim.rbac.getRoleById({ roleId: ROLE_ID })
      ).rejects.toThrow('Rola nie została znaleziona');
    });
  });

  describe('rbac.listRoles', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should list all active non-system roles by default', async () => {
      // Arrange
      mockPrisma.role.findMany.mockResolvedValue([
        { ...mockRole, permissions: [], parentRole: null, _count: { userRoles: 0 } },
      ]);

      // Act
      const result = await adminCaller.aim.rbac.listRoles({});

      // Assert
      expect(result).toHaveLength(1);
      expect(mockPrisma.role.findMany).toHaveBeenCalled();
    });

    it('should include system roles when requested', async () => {
      // Arrange
      mockPrisma.role.findMany.mockResolvedValue([
        { ...mockRole, permissions: [], parentRole: null, _count: { userRoles: 0 } },
        { ...mockSystemRole, permissions: [], parentRole: null, _count: { userRoles: 0 } },
      ]);

      // Act
      const result = await adminCaller.aim.rbac.listRoles({ includeSystem: true });

      // Assert
      expect(result).toHaveLength(2);
    });

    it('should include inactive roles when requested', async () => {
      // Arrange
      const inactiveRole = { ...mockRole, isActive: false, permissions: [], parentRole: null, _count: { userRoles: 0 } };
      mockPrisma.role.findMany.mockResolvedValue([
        { ...mockRole, permissions: [], parentRole: null, _count: { userRoles: 0 } },
        inactiveRole,
      ]);

      // Act
      const result = await adminCaller.aim.rbac.listRoles({ includeInactive: true });

      // Assert
      expect(result).toHaveLength(2);
    });

    it('should filter by search term', async () => {
      // Arrange
      mockPrisma.role.findMany.mockResolvedValue([
        { ...mockRole, permissions: [], parentRole: null, _count: { userRoles: 0 } },
      ]);

      // Act
      const result = await adminCaller.aim.rbac.listRoles({ search: 'Custom' });

      // Assert
      expect(result).toHaveLength(1);
      expect(mockPrisma.role.findMany).toHaveBeenCalled();
    });
  });

  describe('rbac.updateRole', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should update role successfully', async () => {
      // Arrange
      mockPrisma.role.findUnique
        .mockResolvedValueOnce(mockRole) // First call: check role exists
        .mockResolvedValueOnce({ // Second call: getRoleById after update
          ...mockRole,
          displayName: 'Updated Role Name',
          permissions: [],
          parentRole: null,
          _count: { userRoles: 0 },
        });
      mockPrisma.role.update.mockResolvedValue({
        ...mockRole,
        displayName: 'Updated Role Name',
      });

      // Act
      const result = await adminCaller.aim.rbac.updateRole({
        roleId: ROLE_ID,
        data: { displayName: 'Updated Role Name' },
      });

      // Assert
      expect(result.displayName).toBe('Updated Role Name');
      expect(mockPrisma.authAuditLog.create).toHaveBeenCalled();
    });

    it('should reject modification of system roles', async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue(mockSystemRole);

      // Act & Assert
      await expect(
        adminCaller.aim.rbac.updateRole({
          roleId: mockSystemRole.id,
          data: { displayName: 'Hacked Admin' },
        })
      ).rejects.toThrow(/systemow/i);
    });

    it('should invalidate cache on update', async () => {
      // Arrange
      mockPrisma.role.findUnique
        .mockResolvedValueOnce(mockRole)
        .mockResolvedValueOnce({
          ...mockRole,
          permissions: [],
          parentRole: null,
          _count: { userRoles: 0 },
        });
      mockPrisma.role.update.mockResolvedValue(mockRole);

      // Act
      await adminCaller.aim.rbac.updateRole({
        roleId: ROLE_ID,
        data: { displayName: 'Updated Name' },
      });

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(expect.stringContaining(ROLE_ID));
    });
  });

  describe('rbac.deleteRole', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should soft delete role successfully', async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        _count: { userRoles: 0 },
      });
      mockPrisma.role.update.mockResolvedValue({ ...mockRole, isActive: false });

      // Act
      await adminCaller.aim.rbac.deleteRole({ roleId: ROLE_ID });

      // Assert
      expect(mockPrisma.role.update).toHaveBeenCalled();
    });

    it('should reject deletion of system roles', async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue(mockSystemRole);

      // Act & Assert
      await expect(
        adminCaller.aim.rbac.deleteRole({ roleId: mockSystemRole.id })
      ).rejects.toThrow(/systemow/i);
    });

    it('should reject deletion of roles with assigned users', async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        _count: { userRoles: 5 },
      });

      // Act & Assert
      await expect(
        adminCaller.aim.rbac.deleteRole({ roleId: ROLE_ID })
      ).rejects.toThrow(/przypisanej/i);
    });
  });

  // =========================================================================
  // Role Permissions
  // =========================================================================
  describe('rbac.updateRolePermissions', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should update role permissions successfully', async () => {
      // Arrange
      const roleWithPermissions = {
        ...mockRole,
        permissions: [{ permissionId: 'old-perm-id', permission: mockPermission }],
      };
      mockPrisma.role.findUnique.mockResolvedValue(roleWithPermissions);
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);
      mockPrisma.rolePermission.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.rolePermission.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.userRole.findMany.mockResolvedValue([]);

      // Act
      await adminCaller.aim.rbac.updateRolePermissions({
        roleId: ROLE_ID,
        permissionIds: [PERMISSION_ID],
      });

      // Assert
      expect(mockPrisma.rolePermission.createMany).toHaveBeenCalled();
      expect(mockPrisma.authAuditLog.create).toHaveBeenCalled();
    });

    it('should reject permission update for system roles', async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue(mockSystemRole);

      // Act & Assert
      await expect(
        adminCaller.aim.rbac.updateRolePermissions({
          roleId: mockSystemRole.id,
          permissionIds: [PERMISSION_ID],
        })
      ).rejects.toThrow('Uprawnienia roli systemowej nie mogą być modyfikowane');
    });

    it('should invalidate user permission caches', async () => {
      // Arrange
      const roleWithPermissions = { ...mockRole, permissions: [] };
      const usersWithRole = [
        { userId: REGULAR_USER_ID },
        { userId: 'another-user-id' },
      ];
      mockPrisma.role.findUnique.mockResolvedValue(roleWithPermissions);
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);
      mockPrisma.rolePermission.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.userRole.findMany.mockResolvedValue(usersWithRole);

      // Act
      await adminCaller.aim.rbac.updateRolePermissions({
        roleId: ROLE_ID,
        permissionIds: [PERMISSION_ID],
      });

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining(REGULAR_USER_ID)
      );
    });
  });

  // =========================================================================
  // User Role Assignment
  // =========================================================================
  describe('rbac.assignRoleToUser', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should assign role to user successfully', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue({ id: REGULAR_USER_ID, email: 'user@test.com' });
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.userRole.findFirst.mockResolvedValue(null);
      mockPrisma.userRole.create.mockResolvedValue({
        id: 'user-role-id',
        userId: REGULAR_USER_ID,
        roleId: ROLE_ID,
        role: mockRole,
        grantedAt: new Date(),
      });

      // Act
      const result = await adminCaller.aim.rbac.assignRoleToUser({
        userId: REGULAR_USER_ID,
        roleId: ROLE_ID,
      });

      // Assert
      expect(result.userId).toBe(REGULAR_USER_ID);
      expect(result.roleId).toBe(ROLE_ID);
      expect(mockPrisma.authAuditLog.create).toHaveBeenCalled();
    });

    it('should reject assigning inactive role', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue({ id: REGULAR_USER_ID });
      mockPrisma.role.findUnique.mockResolvedValue({ ...mockRole, isActive: false });

      // Act & Assert
      await expect(
        adminCaller.aim.rbac.assignRoleToUser({
          userId: REGULAR_USER_ID,
          roleId: ROLE_ID,
        })
      ).rejects.toThrow('Nie można przypisać nieaktywnej roli');
    });

    it('should reject duplicate assignment', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue({ id: REGULAR_USER_ID });
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.userRole.findFirst.mockResolvedValue({ id: 'existing-assignment' });

      // Act & Assert
      await expect(
        adminCaller.aim.rbac.assignRoleToUser({
          userId: REGULAR_USER_ID,
          roleId: ROLE_ID,
        })
      ).rejects.toThrow('Użytkownik ma już przypisaną tę rolę');
    });

    it('should support temporal assignment with expiration', async () => {
      // Arrange
      const expiresAt = '2025-12-31T23:59:59.000Z';
      mockPrisma.user.findUnique.mockResolvedValue({ id: REGULAR_USER_ID });
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.userRole.findFirst.mockResolvedValue(null);
      mockPrisma.userRole.create.mockResolvedValue({
        id: 'user-role-id',
        userId: REGULAR_USER_ID,
        roleId: ROLE_ID,
        role: mockRole,
        expiresAt: new Date(expiresAt),
      });

      // Act
      const result = await adminCaller.aim.rbac.assignRoleToUser({
        userId: REGULAR_USER_ID,
        roleId: ROLE_ID,
        expiresAt,
      });

      // Assert
      expect(result.expiresAt).toBeDefined();
    });
  });

  describe('rbac.revokeRoleFromUser', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should revoke role from user successfully', async () => {
      // Arrange
      mockPrisma.userRole.findFirst.mockResolvedValue({
        id: 'user-role-id',
        userId: REGULAR_USER_ID,
        roleId: ROLE_ID,
        role: mockRole,
      });
      mockPrisma.userRole.count.mockResolvedValue(2); // User has multiple roles
      mockPrisma.userRole.update.mockResolvedValue({});

      // Act
      await adminCaller.aim.rbac.revokeRoleFromUser({
        userId: REGULAR_USER_ID,
        roleId: ROLE_ID,
        reason: 'Role no longer needed',
      });

      // Assert
      expect(mockPrisma.userRole.update).toHaveBeenCalledWith({
        where: { id: 'user-role-id' },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
          revokedBy: ADMIN_USER_ID,
          reason: 'Role no longer needed',
        }),
      });
    });

    it('should reject revoking last role', async () => {
      // Arrange
      mockPrisma.userRole.findFirst.mockResolvedValue({
        id: 'user-role-id',
        userId: REGULAR_USER_ID,
        roleId: ROLE_ID,
        role: mockRole,
      });
      mockPrisma.userRole.count.mockResolvedValue(1); // Only one role

      // Act & Assert
      await expect(
        adminCaller.aim.rbac.revokeRoleFromUser({
          userId: REGULAR_USER_ID,
          roleId: ROLE_ID,
          reason: 'Test reason',
        })
      ).rejects.toThrow('Nie można odebrać ostatniej roli użytkownika');
    });

    it('should invalidate user permission cache on revoke', async () => {
      // Arrange
      mockPrisma.userRole.findFirst.mockResolvedValue({
        id: 'user-role-id',
        userId: REGULAR_USER_ID,
        roleId: ROLE_ID,
        role: mockRole,
      });
      mockPrisma.userRole.count.mockResolvedValue(2);
      mockPrisma.userRole.update.mockResolvedValue({});

      // Act
      await adminCaller.aim.rbac.revokeRoleFromUser({
        userId: REGULAR_USER_ID,
        roleId: ROLE_ID,
        reason: 'Test reason for revoking role',
      });

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining(REGULAR_USER_ID)
      );
    });
  });

  describe('rbac.getUserRoles', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should return user roles', async () => {
      // Arrange
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          id: 'user-role-id',
          userId: REGULAR_USER_ID,
          roleId: ROLE_ID,
          role: mockRole,
          grantedAt: new Date(),
        },
      ]);

      // Act
      const result = await adminCaller.aim.rbac.getUserRoles({
        userId: REGULAR_USER_ID,
      });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].roleId).toBe(ROLE_ID);
    });

    it('should only return active non-expired roles', async () => {
      // Arrange
      mockPrisma.userRole.findMany.mockResolvedValue([]);

      // Act
      await adminCaller.aim.rbac.getUserRoles({ userId: REGULAR_USER_ID });

      // Assert
      expect(mockPrisma.userRole.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            revokedAt: null,
            OR: expect.arrayContaining([
              { expiresAt: null },
              { expiresAt: expect.any(Object) },
            ]),
          }),
        })
      );
    });
  });

  // =========================================================================
  // Permission Checking
  // =========================================================================
  describe('rbac.checkPermission', () => {
    it('should check permission for current user (protected procedure)', async () => {
      // Arrange
      userCaller = appRouter.createCaller(createUserContext());
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          userId: REGULAR_USER_ID,
          roles: ['USER'],
          permissionKeys: ['clients:read', 'entries:read'],
          computedAt: new Date(),
        })
      );

      // Act
      const result = await userCaller.aim.rbac.checkPermission({
        resource: 'clients',
        action: 'read',
      });

      // Assert
      expect(result.hasPermission).toBe(true);
    });

    it('should return false for missing permission', async () => {
      // Arrange
      userCaller = appRouter.createCaller(createUserContext());
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          userId: REGULAR_USER_ID,
          roles: ['USER'],
          permissionKeys: ['clients:read'],
          computedAt: new Date(),
        })
      );

      // Act
      const result = await userCaller.aim.rbac.checkPermission({
        resource: 'admin',
        action: 'delete',
      });

      // Assert
      expect(result.hasPermission).toBe(false);
    });
  });

  describe('rbac.checkPermissions', () => {
    it('should bulk check multiple permissions', async () => {
      // Arrange
      userCaller = appRouter.createCaller(createUserContext());
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          userId: REGULAR_USER_ID,
          roles: ['USER'],
          permissionKeys: ['clients:read', 'entries:read', 'entries:create'],
          computedAt: new Date(),
        })
      );

      // Act
      const result = await userCaller.aim.rbac.checkPermissions({
        permissions: [
          { resource: 'clients', action: 'read' },
          { resource: 'clients', action: 'delete' },
          { resource: 'entries', action: 'create' },
        ],
      });

      // Assert
      expect(result['clients:read']).toBe(true);
      expect(result['clients:delete']).toBe(false);
      expect(result['entries:create']).toBe(true);
    });
  });

  describe('rbac.getUserEffectivePermissions', () => {
    it('should return effective permissions for current user', async () => {
      // Arrange
      userCaller = appRouter.createCaller(createUserContext());
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          id: 'user-role-id',
          userId: REGULAR_USER_ID,
          roleId: ROLE_ID,
          role: {
            ...mockRole,
            permissions: [{ permissionId: PERMISSION_ID, permission: mockPermission }],
          },
        },
      ]);
      mockPrisma.roleHierarchy.findMany.mockResolvedValue([
        {
          ancestorRoleId: ROLE_ID,
          descendantRoleId: ROLE_ID,
          depth: 0,
          ancestorRole: {
            ...mockRole,
            permissions: [{ permissionId: PERMISSION_ID, permission: mockPermission }],
          },
        },
      ]);

      // Act
      const result = await userCaller.aim.rbac.getUserEffectivePermissions();

      // Assert
      expect(result.userId).toBe(REGULAR_USER_ID);
      expect(result.roles).toContain('CUSTOM_ROLE');
      expect(result.permissionKeys).toContain('clients:read');
    });
  });

  // =========================================================================
  // Permission Catalog
  // =========================================================================
  describe('rbac.listPermissions', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should list all permissions', async () => {
      // Arrange
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);

      // Act
      const result = await adminCaller.aim.rbac.listPermissions({});

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].resource).toBe('clients');
    });

    it('should filter permissions by module', async () => {
      // Arrange
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);

      // Act
      await adminCaller.aim.rbac.listPermissions({ module: 'CRM' });

      // Assert
      expect(mockPrisma.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { module: 'CRM' },
        })
      );
    });
  });

  describe('rbac.getPermissionsByModule', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should group permissions by module', async () => {
      // Arrange
      const crmPermission = { ...mockPermission, module: 'CRM' };
      const aimPermission = { ...mockPermission, id: 'perm-2', module: 'AIM', resource: 'users', action: 'read' };
      mockPrisma.permission.findMany.mockResolvedValue([crmPermission, aimPermission]);

      // Act
      const result = await adminCaller.aim.rbac.getPermissionsByModule();

      // Assert
      expect(result.CRM).toBeDefined();
      expect(result.AIM).toBeDefined();
      expect(result.CRM).toHaveLength(1);
      expect(result.AIM).toHaveLength(1);
    });
  });

  // =========================================================================
  // Schema Validation
  // =========================================================================
  describe('schema validation', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should validate role name format (uppercase, underscore)', async () => {
      // Act & Assert - lowercase should fail
      await expect(
        adminCaller.aim.rbac.createRole({
          name: 'invalid',
          displayName: 'Invalid Role',
        })
      ).rejects.toThrow();
    });

    it('should validate resource name format (lowercase)', async () => {
      // Arrange
      userCaller = appRouter.createCaller(createUserContext());
      mockRedis.get.mockResolvedValue(JSON.stringify({ permissionKeys: [] }));

      // Act & Assert - uppercase should fail
      await expect(
        userCaller.aim.rbac.checkPermission({
          resource: 'CLIENTS', // Invalid - should be lowercase
          action: 'read',
        })
      ).rejects.toThrow();
    });

    it('should validate UUID format for roleId', async () => {
      // Act & Assert
      await expect(
        adminCaller.aim.rbac.getRoleById({
          roleId: 'not-a-uuid',
        })
      ).rejects.toThrow();
    });

    it('should require reason for role revocation (min 5 chars)', async () => {
      // Act & Assert
      await expect(
        adminCaller.aim.rbac.revokeRoleFromUser({
          userId: REGULAR_USER_ID,
          roleId: ROLE_ID,
          reason: 'abc', // Too short
        })
      ).rejects.toThrow();
    });
  });
});
