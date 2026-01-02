import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';

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
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  rolePermission: {
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  userRole: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  roleHierarchy: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  userPermissionCache: {
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
};

const mockAuditLogger = {
  log: vi.fn(),
};

// Import after mocks are set up
import { RBACService } from '../../services/aim/rbac.service';

describe('RBACService', () => {
  let rbacService: RBACService;

  // Test UUIDs
  const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const ADMIN_ID = '550e8400-e29b-41d4-a716-446655440001';
  const ROLE_ID = '550e8400-e29b-41d4-a716-446655440002';
  const PARENT_ROLE_ID = '550e8400-e29b-41d4-a716-446655440003';
  const PERMISSION_ID = '550e8400-e29b-41d4-a716-446655440004';
  const ORGANIZATION_ID = '550e8400-e29b-41d4-a716-446655440005';

  // System role IDs from seed
  const SUPER_ADMIN_ID = '00000000-0000-0000-0000-000000000001';
  const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000002';

  // Mock data
  const mockRole = {
    id: ROLE_ID,
    name: 'ACCOUNTANT',
    displayName: 'Księgowy',
    description: 'Dostęp do księgowości',
    isSystem: false,
    isActive: true,
    parentRoleId: null,
    organizationId: null,
    metadata: {},
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
    createdBy: ADMIN_ID,
    updatedBy: ADMIN_ID,
  };

  const mockSystemRole = {
    id: SUPER_ADMIN_ID,
    name: 'SUPER_ADMIN',
    displayName: 'Super Administrator',
    description: 'Pełny dostęp do systemu',
    isSystem: true,
    isActive: true,
    parentRoleId: null,
    organizationId: null,
    metadata: {},
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockPermission = {
    id: PERMISSION_ID,
    resource: 'clients',
    action: 'read',
    displayName: 'Przeglądanie klientów',
    description: 'Dostęp do listy klientów',
    module: 'crm',
    isActive: true,
    createdAt: new Date('2025-01-01'),
  };

  const mockUser = {
    id: USER_ID,
    email: 'jan.kowalski@example.com',
    status: 'ACTIVE',
  };

  const mockUserRole = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    userId: USER_ID,
    roleId: ROLE_ID,
    organizationId: null,
    grantedAt: new Date('2025-01-15'),
    grantedBy: ADMIN_ID,
    expiresAt: null,
    revokedAt: null,
    revokedBy: null,
    reason: null,
    role: mockRole,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    vi.clearAllMocks();

    // Default mock implementations
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);

    mockAuditLogger.log.mockResolvedValue(undefined);

    rbacService = new RBACService(
      mockPrisma as any,
      mockRedis as any,
      mockAuditLogger as any
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // ROLE CREATION
  // =========================================================================
  describe('createRole', () => {
    it('should create a new role successfully', async () => {
      // Arrange
      mockPrisma.role.findFirst.mockResolvedValue(null);
      mockPrisma.role.create.mockResolvedValue(mockRole);
      mockPrisma.roleHierarchy.create.mockResolvedValue({
        ancestorRoleId: ROLE_ID,
        descendantRoleId: ROLE_ID,
        depth: 0,
      });
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        permissions: [],
        parentRole: null,
        _count: { userRoles: 0 },
      });

      // Act
      const result = await rbacService.createRole(
        {
          name: 'ACCOUNTANT',
          displayName: 'Księgowy',
          description: 'Dostęp do księgowości',
        },
        ADMIN_ID
      );

      // Assert
      expect(result.name).toBe('ACCOUNTANT');
      expect(mockPrisma.role.create).toHaveBeenCalled();
      expect(mockPrisma.roleHierarchy.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ancestorRoleId: expect.any(String),
          descendantRoleId: expect.any(String),
          depth: 0,
        }),
      });
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ROLE_CREATED',
          actorId: ADMIN_ID,
        })
      );
    });

    it('should reject duplicate role name', async () => {
      // Arrange
      mockPrisma.role.findFirst.mockResolvedValue(mockRole);

      // Act & Assert
      await expect(
        rbacService.createRole(
          {
            name: 'ACCOUNTANT',
            displayName: 'Księgowy',
          },
          ADMIN_ID
        )
      ).rejects.toThrow(TRPCError);
    });

    it('should validate parent role exists', async () => {
      // Arrange
      mockPrisma.role.findFirst.mockResolvedValue(null);
      mockPrisma.role.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        rbacService.createRole(
          {
            name: 'NEW_ROLE',
            displayName: 'Nowa rola',
            parentRoleId: 'non-existent-id',
          },
          ADMIN_ID
        )
      ).rejects.toThrow(TRPCError);
    });

    it('should reject inactive parent role', async () => {
      // Arrange
      mockPrisma.role.findFirst.mockResolvedValue(null);
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        id: PARENT_ROLE_ID,
        isActive: false,
      });

      // Act & Assert
      await expect(
        rbacService.createRole(
          {
            name: 'NEW_ROLE',
            displayName: 'Nowa rola',
            parentRoleId: PARENT_ROLE_ID,
          },
          ADMIN_ID
        )
      ).rejects.toThrow(TRPCError);
    });

    it('should create role with initial permissions', async () => {
      // Arrange
      mockPrisma.role.findFirst.mockResolvedValue(null);
      mockPrisma.role.create.mockResolvedValue(mockRole);
      mockPrisma.roleHierarchy.create.mockResolvedValue({});
      mockPrisma.rolePermission.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        permissions: [{ permission: mockPermission }],
        parentRole: null,
        _count: { userRoles: 0 },
      });

      // Act
      const result = await rbacService.createRole(
        {
          name: 'ACCOUNTANT',
          displayName: 'Księgowy',
          permissions: [PERMISSION_ID],
        },
        ADMIN_ID
      );

      // Assert
      expect(mockPrisma.rolePermission.createMany).toHaveBeenCalled();
      expect(result.permissions).toHaveLength(1);
    });

    it('should create role within organization scope', async () => {
      // Arrange
      mockPrisma.role.findFirst.mockResolvedValue(null);
      mockPrisma.role.create.mockResolvedValue({
        ...mockRole,
        organizationId: ORGANIZATION_ID,
      });
      mockPrisma.roleHierarchy.create.mockResolvedValue({});
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        organizationId: ORGANIZATION_ID,
        permissions: [],
        parentRole: null,
        _count: { userRoles: 0 },
      });

      // Act
      const result = await rbacService.createRole(
        {
          name: 'CUSTOM_ROLE',
          displayName: 'Rola niestandardowa',
        },
        ADMIN_ID,
        ORGANIZATION_ID
      );

      // Assert
      expect(mockPrisma.role.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: ORGANIZATION_ID,
        }),
      });
    });
  });

  // =========================================================================
  // ROLE RETRIEVAL
  // =========================================================================
  describe('getRoleById', () => {
    it('should return role from cache when available', async () => {
      // Arrange
      const cachedRole = { ...mockRole, permissions: [], userCount: 0 };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedRole));

      // Act
      const result = await rbacService.getRoleById(ROLE_ID);

      // Assert
      expect(result.name).toBe('ACCOUNTANT');
      expect(mockPrisma.role.findUnique).not.toHaveBeenCalled();
    });

    it('should fetch role from database when cache miss', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        permissions: [],
        parentRole: null,
        _count: { userRoles: 5 },
      });

      // Act
      const result = await rbacService.getRoleById(ROLE_ID);

      // Assert
      expect(result.name).toBe('ACCOUNTANT');
      expect(result.userCount).toBe(5);
      expect(mockPrisma.role.findUnique).toHaveBeenCalledWith({
        where: { id: ROLE_ID },
        include: expect.any(Object),
      });
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should throw when role not found', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.role.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(rbacService.getRoleById(ROLE_ID)).rejects.toThrow(TRPCError);
    });
  });

  describe('listRoles', () => {
    it('should list all active non-system roles by default', async () => {
      // Arrange
      mockPrisma.role.findMany.mockResolvedValue([
        { ...mockRole, permissions: [], _count: { userRoles: 2 } },
      ]);

      // Act
      const result = await rbacService.listRoles({});

      // Assert
      expect(result).toHaveLength(1);
      expect(mockPrisma.role.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { isSystem: false },
            { isActive: true },
          ]),
        }),
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });

    it('should include system roles when requested', async () => {
      // Arrange
      mockPrisma.role.findMany.mockResolvedValue([
        { ...mockSystemRole, permissions: [], _count: { userRoles: 1 } },
        { ...mockRole, permissions: [], _count: { userRoles: 2 } },
      ]);

      // Act
      const result = await rbacService.listRoles({ includeSystem: true });

      // Assert
      expect(result).toHaveLength(2);
    });

    it('should filter roles by search term', async () => {
      // Arrange
      mockPrisma.role.findMany.mockResolvedValue([
        { ...mockRole, permissions: [], _count: { userRoles: 2 } },
      ]);

      // Act
      await rbacService.listRoles({ search: 'Księg' });

      // Assert
      expect(mockPrisma.role.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: [
                { name: { contains: 'Księg', mode: 'insensitive' } },
                { displayName: { contains: 'Księg', mode: 'insensitive' } },
              ],
            }),
          ]),
        }),
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
    });
  });

  // =========================================================================
  // ROLE UPDATE
  // =========================================================================
  describe('updateRole', () => {
    it('should update role successfully', async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValueOnce(mockRole);
      mockPrisma.role.update.mockResolvedValue({
        ...mockRole,
        displayName: 'Główny Księgowy',
      });
      mockPrisma.role.findUnique.mockResolvedValueOnce({
        ...mockRole,
        displayName: 'Główny Księgowy',
        permissions: [],
        parentRole: null,
        _count: { userRoles: 0 },
      });

      // Act
      const result = await rbacService.updateRole(
        ROLE_ID,
        { displayName: 'Główny Księgowy' },
        ADMIN_ID
      );

      // Assert
      expect(result.displayName).toBe('Główny Księgowy');
      expect(mockRedis.del).toHaveBeenCalledWith(expect.stringContaining(ROLE_ID));
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ROLE_UPDATED',
        })
      );
    });

    it('should reject modification of system role', async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue(mockSystemRole);

      // Act & Assert
      await expect(
        rbacService.updateRole(
          SUPER_ADMIN_ID,
          { displayName: 'Modified Admin' },
          ADMIN_ID
        )
      ).rejects.toThrow(TRPCError);
    });

    it('should reject self-referential parent', async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);

      // Act & Assert
      await expect(
        rbacService.updateRole(
          ROLE_ID,
          { parentRoleId: ROLE_ID },
          ADMIN_ID
        )
      ).rejects.toThrow(TRPCError);
    });

    it('should detect and reject circular hierarchy', async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.roleHierarchy.findFirst.mockResolvedValue({
        ancestorRoleId: ROLE_ID,
        descendantRoleId: PARENT_ROLE_ID,
        depth: 1,
      });

      // Act & Assert
      await expect(
        rbacService.updateRole(
          ROLE_ID,
          { parentRoleId: PARENT_ROLE_ID },
          ADMIN_ID
        )
      ).rejects.toThrow(TRPCError);
    });

    it('should throw when role not found', async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        rbacService.updateRole(
          'non-existent-id',
          { displayName: 'Test' },
          ADMIN_ID
        )
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // ROLE DELETION
  // =========================================================================
  describe('deleteRole', () => {
    it('should soft delete role successfully', async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        _count: { userRoles: 0 },
      });
      mockPrisma.role.update.mockResolvedValue({
        ...mockRole,
        isActive: false,
      });

      // Act
      await rbacService.deleteRole(ROLE_ID, ADMIN_ID);

      // Assert
      expect(mockPrisma.role.update).toHaveBeenCalledWith({
        where: { id: ROLE_ID },
        data: expect.objectContaining({
          isActive: false,
        }),
      });
      expect(mockRedis.del).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ROLE_DELETED',
        })
      );
    });

    it('should reject deletion of system role', async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockSystemRole,
        _count: { userRoles: 5 },
      });

      // Act & Assert
      await expect(
        rbacService.deleteRole(SUPER_ADMIN_ID, ADMIN_ID)
      ).rejects.toThrow(TRPCError);
    });

    it('should reject deletion of role with active users', async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        _count: { userRoles: 3 },
      });

      // Act & Assert
      await expect(
        rbacService.deleteRole(ROLE_ID, ADMIN_ID)
      ).rejects.toThrow(TRPCError);
    });

    it('should throw when role not found', async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        rbacService.deleteRole('non-existent-id', ADMIN_ID)
      ).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // ROLE PERMISSIONS
  // =========================================================================
  describe('updateRolePermissions', () => {
    it('should update role permissions successfully', async () => {
      // Arrange
      const newPermissionId = '550e8400-e29b-41d4-a716-446655440020';
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        permissions: [{ permissionId: PERMISSION_ID }],
      });
      mockPrisma.permission.findMany.mockResolvedValue([
        mockPermission,
        { ...mockPermission, id: newPermissionId },
      ]);
      mockPrisma.rolePermission.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.rolePermission.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.userRole.findMany.mockResolvedValue([]);

      // Act
      await rbacService.updateRolePermissions(
        ROLE_ID,
        [PERMISSION_ID, newPermissionId],
        ADMIN_ID
      );

      // Assert
      expect(mockPrisma.rolePermission.createMany).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ROLE_PERMISSIONS_UPDATED',
        })
      );
    });

    it('should reject modification of system role permissions', async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockSystemRole,
        permissions: [],
      });

      // Act & Assert
      await expect(
        rbacService.updateRolePermissions(
          SUPER_ADMIN_ID,
          [PERMISSION_ID],
          ADMIN_ID
        )
      ).rejects.toThrow(TRPCError);
    });

    it('should validate all permission IDs exist', async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        permissions: [],
      });
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);

      // Act & Assert - passing 2 IDs but only 1 exists
      await expect(
        rbacService.updateRolePermissions(
          ROLE_ID,
          [PERMISSION_ID, 'non-existent-id'],
          ADMIN_ID
        )
      ).rejects.toThrow(TRPCError);
    });

    it('should invalidate user permission caches for affected users', async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        permissions: [],
      });
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);
      mockPrisma.rolePermission.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.userRole.findMany.mockResolvedValue([
        { userId: USER_ID },
        { userId: ADMIN_ID },
      ]);
      mockPrisma.userPermissionCache.deleteMany.mockResolvedValue({ count: 2 });

      // Act
      await rbacService.updateRolePermissions(ROLE_ID, [PERMISSION_ID], ADMIN_ID);

      // Assert
      expect(mockRedis.del).toHaveBeenCalledTimes(3); // Role cache + 2 user caches
    });
  });

  // =========================================================================
  // USER ROLE ASSIGNMENT
  // =========================================================================
  describe('assignRoleToUser', () => {
    it('should assign role to user successfully', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.userRole.findFirst.mockResolvedValue(null);
      mockPrisma.userRole.create.mockResolvedValue(mockUserRole);
      mockPrisma.userPermissionCache.deleteMany.mockResolvedValue({});

      // Act
      const result = await rbacService.assignRoleToUser(
        {
          userId: USER_ID,
          roleId: ROLE_ID,
        },
        ADMIN_ID
      );

      // Assert
      expect(result.userId).toBe(USER_ID);
      expect(result.roleId).toBe(ROLE_ID);
      expect(mockRedis.del).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ROLE_ASSIGNED',
        })
      );
    });

    it('should reject assignment of inactive role', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        isActive: false,
      });

      // Act & Assert
      await expect(
        rbacService.assignRoleToUser(
          { userId: USER_ID, roleId: ROLE_ID },
          ADMIN_ID
        )
      ).rejects.toThrow(TRPCError);
    });

    it('should reject duplicate role assignment', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.userRole.findFirst.mockResolvedValue(mockUserRole);

      // Act & Assert
      await expect(
        rbacService.assignRoleToUser(
          { userId: USER_ID, roleId: ROLE_ID },
          ADMIN_ID
        )
      ).rejects.toThrow(TRPCError);
    });

    it('should assign role with expiration date', async () => {
      // Arrange
      const expiresAt = new Date('2025-02-15').toISOString();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.userRole.findFirst.mockResolvedValue(null);
      mockPrisma.userRole.create.mockResolvedValue({
        ...mockUserRole,
        expiresAt: new Date(expiresAt),
      });
      mockPrisma.userPermissionCache.deleteMany.mockResolvedValue({});

      // Act
      const result = await rbacService.assignRoleToUser(
        {
          userId: USER_ID,
          roleId: ROLE_ID,
          expiresAt,
        },
        ADMIN_ID
      );

      // Assert
      expect(mockPrisma.userRole.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: new Date(expiresAt),
        }),
        include: expect.any(Object),
      });
    });

    it('should throw when user not found', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);

      // Act & Assert
      await expect(
        rbacService.assignRoleToUser(
          { userId: 'non-existent-user', roleId: ROLE_ID },
          ADMIN_ID
        )
      ).rejects.toThrow(TRPCError);
    });

    it('should throw when role not found', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.role.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        rbacService.assignRoleToUser(
          { userId: USER_ID, roleId: 'non-existent-role' },
          ADMIN_ID
        )
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('revokeRoleFromUser', () => {
    it('should revoke role from user successfully', async () => {
      // Arrange
      mockPrisma.userRole.findFirst.mockResolvedValue(mockUserRole);
      mockPrisma.userRole.count.mockResolvedValue(2); // User has 2 roles
      mockPrisma.userRole.update.mockResolvedValue({
        ...mockUserRole,
        revokedAt: new Date(),
        revokedBy: ADMIN_ID,
      });
      mockPrisma.userPermissionCache.deleteMany.mockResolvedValue({});

      // Act
      await rbacService.revokeRoleFromUser(
        USER_ID,
        ROLE_ID,
        ADMIN_ID,
        'Zmiana stanowiska'
      );

      // Assert
      expect(mockPrisma.userRole.update).toHaveBeenCalledWith({
        where: { id: mockUserRole.id },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
          revokedBy: ADMIN_ID,
          reason: 'Zmiana stanowiska',
        }),
      });
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ROLE_REVOKED',
        })
      );
    });

    it('should prevent revoking last role', async () => {
      // Arrange
      mockPrisma.userRole.findFirst.mockResolvedValue(mockUserRole);
      mockPrisma.userRole.count.mockResolvedValue(1); // Only 1 role

      // Act & Assert
      await expect(
        rbacService.revokeRoleFromUser(
          USER_ID,
          ROLE_ID,
          ADMIN_ID,
          'Próba odebrania ostatniej roli'
        )
      ).rejects.toThrow(TRPCError);
    });

    it('should throw when role assignment not found', async () => {
      // Arrange
      mockPrisma.userRole.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        rbacService.revokeRoleFromUser(
          USER_ID,
          ROLE_ID,
          ADMIN_ID,
          'Nieistniejące przypisanie'
        )
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('getUserRoles', () => {
    it('should return active user roles', async () => {
      // Arrange
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          ...mockUserRole,
          role: {
            ...mockRole,
            permissions: [{ permission: mockPermission }],
          },
          grantedByUser: { id: ADMIN_ID, email: 'admin@example.com' },
        },
      ]);

      // Act
      const result = await rbacService.getUserRoles(USER_ID);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].role.name).toBe('ACCOUNTANT');
    });

    it('should exclude expired roles', async () => {
      // Arrange
      mockPrisma.userRole.findMany.mockResolvedValue([]);

      // Act
      const result = await rbacService.getUserRoles(USER_ID);

      // Assert
      expect(mockPrisma.userRole.findMany).toHaveBeenCalledWith({
        where: {
          userId: USER_ID,
          revokedAt: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: expect.any(Date) } },
          ],
        },
        include: expect.any(Object),
        orderBy: { grantedAt: 'desc' },
      });
    });
  });

  // =========================================================================
  // PERMISSION CHECKING
  // =========================================================================
  describe('checkPermission', () => {
    const mockEffectivePermissions = {
      userId: USER_ID,
      roles: ['ACCOUNTANT'],
      permissions: [
        {
          id: PERMISSION_ID,
          resource: 'clients',
          action: 'read',
          displayName: 'Przeglądanie klientów',
          module: 'crm',
          grantedVia: 'ACCOUNTANT',
        },
      ],
      permissionKeys: ['clients:read'],
      computedAt: new Date(),
    };

    it('should return true when user has permission (cache hit)', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(JSON.stringify(mockEffectivePermissions));

      // Act
      const result = await rbacService.checkPermission(USER_ID, {
        resource: 'clients',
        action: 'read',
      });

      // Assert
      expect(result).toBe(true);
      expect(mockPrisma.userRole.findMany).not.toHaveBeenCalled();
    });

    it('should return false when user lacks permission', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(JSON.stringify(mockEffectivePermissions));

      // Act
      const result = await rbacService.checkPermission(USER_ID, {
        resource: 'clients',
        action: 'delete',
      });

      // Assert
      expect(result).toBe(false);
    });

    it('should compute permissions on cache miss', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          ...mockUserRole,
          role: {
            ...mockRole,
            permissions: [{ permission: mockPermission }],
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
            permissions: [{ permission: mockPermission }],
          },
        },
      ]);
      mockPrisma.userPermissionCache.upsert.mockResolvedValue({});

      // Act
      const result = await rbacService.checkPermission(USER_ID, {
        resource: 'clients',
        action: 'read',
      });

      // Assert
      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe('getUserEffectivePermissions', () => {
    it('should return cached permissions when available', async () => {
      // Arrange
      const cached = {
        userId: USER_ID,
        roles: ['ACCOUNTANT'],
        permissions: [],
        permissionKeys: ['clients:read'],
        computedAt: new Date(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      // Act
      const result = await rbacService.getUserEffectivePermissions(USER_ID);

      // Assert
      expect(result.permissionKeys).toContain('clients:read');
      expect(mockPrisma.userRole.findMany).not.toHaveBeenCalled();
    });

    it('should compute and cache permissions on miss', async () => {
      // Arrange
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          ...mockUserRole,
          role: mockRole,
        },
      ]);
      mockPrisma.roleHierarchy.findMany.mockResolvedValue([
        {
          ancestorRoleId: ROLE_ID,
          descendantRoleId: ROLE_ID,
          depth: 0,
          ancestorRole: {
            ...mockRole,
            permissions: [{ permission: mockPermission }],
          },
        },
      ]);
      mockPrisma.userPermissionCache.upsert.mockResolvedValue({});

      // Act
      const result = await rbacService.getUserEffectivePermissions(USER_ID);

      // Assert
      expect(result.roles).toContain('ACCOUNTANT');
      expect(result.permissionKeys).toContain('clients:read');
      expect(mockRedis.setex).toHaveBeenCalled();
      expect(mockPrisma.userPermissionCache.upsert).toHaveBeenCalled();
    });

    it('should include inherited permissions from role hierarchy', async () => {
      // Arrange
      const parentPermission = {
        id: '550e8400-e29b-41d4-a716-446655440030',
        resource: 'reports',
        action: 'read',
        displayName: 'Przeglądanie raportów',
        module: 'acc',
      };
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          ...mockUserRole,
          role: { ...mockRole, parentRoleId: PARENT_ROLE_ID },
        },
      ]);
      mockPrisma.roleHierarchy.findMany.mockResolvedValue([
        {
          ancestorRoleId: ROLE_ID,
          descendantRoleId: ROLE_ID,
          depth: 0,
          ancestorRole: {
            ...mockRole,
            permissions: [{ permission: mockPermission }],
          },
        },
        {
          ancestorRoleId: PARENT_ROLE_ID,
          descendantRoleId: ROLE_ID,
          depth: 1,
          ancestorRole: {
            id: PARENT_ROLE_ID,
            name: 'MANAGER',
            permissions: [{ permission: parentPermission }],
          },
        },
      ]);
      mockPrisma.userPermissionCache.upsert.mockResolvedValue({});

      // Act
      const result = await rbacService.getUserEffectivePermissions(USER_ID);

      // Assert
      expect(result.permissionKeys).toContain('clients:read');
      expect(result.permissionKeys).toContain('reports:read');
    });
  });

  describe('checkPermissions (bulk)', () => {
    it('should check multiple permissions efficiently', async () => {
      // Arrange
      const cached = {
        userId: USER_ID,
        roles: ['ACCOUNTANT'],
        permissions: [],
        permissionKeys: ['clients:read', 'clients:create'],
        computedAt: new Date(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      // Act
      const result = await rbacService.checkPermissions(USER_ID, [
        { resource: 'clients', action: 'read' },
        { resource: 'clients', action: 'create' },
        { resource: 'clients', action: 'delete' },
      ]);

      // Assert
      expect(result.get('clients:read')).toBe(true);
      expect(result.get('clients:create')).toBe(true);
      expect(result.get('clients:delete')).toBe(false);
    });
  });

  // =========================================================================
  // PERMISSION CATALOG
  // =========================================================================
  describe('listPermissions', () => {
    it('should list all permissions', async () => {
      // Arrange
      mockPrisma.permission.findMany.mockResolvedValue([
        mockPermission,
        { ...mockPermission, id: '2', resource: 'accounts', action: 'read', module: 'acc' },
      ]);

      // Act
      const result = await rbacService.listPermissions();

      // Assert
      expect(result).toHaveLength(2);
    });

    it('should filter permissions by module', async () => {
      // Arrange
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);

      // Act
      const result = await rbacService.listPermissions('crm');

      // Assert
      expect(mockPrisma.permission.findMany).toHaveBeenCalledWith({
        where: { module: 'crm' },
        orderBy: expect.any(Array),
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getPermissionsByModule', () => {
    it('should group permissions by module', async () => {
      // Arrange
      mockPrisma.permission.findMany.mockResolvedValue([
        { ...mockPermission, module: 'crm' },
        { ...mockPermission, id: '2', module: 'crm' },
        { ...mockPermission, id: '3', module: 'acc' },
      ]);

      // Act
      const result = await rbacService.getPermissionsByModule();

      // Assert
      expect(result.get('crm')).toHaveLength(2);
      expect(result.get('acc')).toHaveLength(1);
    });
  });

  // =========================================================================
  // CACHE MANAGEMENT
  // =========================================================================
  describe('cache management', () => {
    it('should invalidate role cache on role update', async () => {
      // Arrange
      mockPrisma.role.findUnique.mockResolvedValueOnce(mockRole);
      mockPrisma.role.update.mockResolvedValue(mockRole);
      mockPrisma.role.findUnique.mockResolvedValueOnce({
        ...mockRole,
        permissions: [],
        parentRole: null,
        _count: { userRoles: 0 },
      });

      // Act
      await rbacService.updateRole(ROLE_ID, { displayName: 'Test' }, ADMIN_ID);

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining(ROLE_ID)
      );
    });

    it('should invalidate user permission cache on role assignment', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.userRole.findFirst.mockResolvedValue(null);
      mockPrisma.userRole.create.mockResolvedValue(mockUserRole);
      mockPrisma.userPermissionCache.deleteMany.mockResolvedValue({});

      // Act
      await rbacService.assignRoleToUser(
        { userId: USER_ID, roleId: ROLE_ID },
        ADMIN_ID
      );

      // Assert
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining(USER_ID)
      );
    });
  });

  // =========================================================================
  // AUDIT LOGGING
  // =========================================================================
  describe('audit logging', () => {
    it('should log role creation event', async () => {
      // Arrange
      mockPrisma.role.findFirst.mockResolvedValue(null);
      mockPrisma.role.create.mockResolvedValue(mockRole);
      mockPrisma.roleHierarchy.create.mockResolvedValue({});
      mockPrisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        permissions: [],
        parentRole: null,
        _count: { userRoles: 0 },
      });

      // Act
      await rbacService.createRole(
        { name: 'TEST_ROLE', displayName: 'Test' },
        ADMIN_ID
      );

      // Assert
      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        eventType: 'ROLE_CREATED',
        actorId: ADMIN_ID,
        targetType: 'role',
        targetId: ROLE_ID,
        metadata: expect.objectContaining({
          roleName: 'ACCOUNTANT',
        }),
      });
    });

    it('should log role assignment event with all metadata', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.userRole.findFirst.mockResolvedValue(null);
      mockPrisma.userRole.create.mockResolvedValue(mockUserRole);
      mockPrisma.userPermissionCache.deleteMany.mockResolvedValue({});

      // Act
      await rbacService.assignRoleToUser(
        {
          userId: USER_ID,
          roleId: ROLE_ID,
          reason: 'Awans na stanowisko księgowego',
        },
        ADMIN_ID
      );

      // Assert
      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        eventType: 'ROLE_ASSIGNED',
        actorId: ADMIN_ID,
        targetType: 'user',
        targetId: USER_ID,
        metadata: expect.objectContaining({
          roleId: ROLE_ID,
          roleName: 'ACCOUNTANT',
          reason: 'Awans na stanowisko księgowego',
        }),
      });
    });
  });
});
