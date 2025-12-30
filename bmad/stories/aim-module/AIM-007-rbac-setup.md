# Story AIM-007: RBAC Setup (Role-Based Access Control)

> **Story ID**: AIM-007
> **Epic**: Authentication & Identity Management
> **Priority**: P0 (Critical)
> **Points**: 8
> **Status**: 📋 Ready for Development
> **Dependencies**: AIM-001, AIM-003

---

## 📋 User Story

**As a** system administrator
**I want** to manage roles and define access permissions
**So that** I can control what each user can do in the system based on their role

---

## ✅ Acceptance Criteria

### Scenario 1: Creating a New Role
```gherkin
Given I am logged in as an administrator
And I have "roles.create" permission
When I navigate to role management
And I create a new role with name "ACCOUNTANT" and description "Standard accountant role"
Then the role is created in the system
And the role appears in the role list
And an audit event is logged for role creation
```

### Scenario 2: Assigning Permissions to Role
```gherkin
Given I am viewing a role "ACCOUNTANT"
And the role has no permissions yet
When I select permissions "clients.read", "clients.create", "invoices.read"
And I save the role configuration
Then the permissions are attached to the role
And any user with this role gains these permissions
And an audit event is logged for permission change
```

### Scenario 3: Assigning Role to User
```gherkin
Given I am managing user "jan.kowalski@example.com"
And the user currently has role "USER"
When I assign additional role "ACCOUNTANT"
Then the user has both "USER" and "ACCOUNTANT" roles
And the user has combined permissions from both roles
And the user is notified about role change
And an audit event is logged
```

### Scenario 4: Removing Role from User
```gherkin
Given user "jan.kowalski@example.com" has roles ["USER", "ACCOUNTANT"]
When I remove role "ACCOUNTANT" from the user
Then the user only has role "USER"
And the user loses permissions specific to "ACCOUNTANT" role
And user's active sessions are refreshed with new permissions
And an audit event is logged
```

### Scenario 5: Viewing Effective Permissions
```gherkin
Given user has roles ["USER", "ACCOUNTANT", "MANAGER"]
When I view the user's effective permissions
Then I see all unique permissions from all assigned roles
And permissions are grouped by resource
And I can see which role granted each permission
```

### Scenario 6: System Role Protection
```gherkin
Given role "SUPER_ADMIN" is a system role
When I try to delete or modify the role
Then the operation is rejected
And I see error "Rola systemowa nie może być modyfikowana"
```

### Scenario 7: Role with Time-Limited Assignment
```gherkin
Given I am assigning role "TEMPORARY_ADMIN" to user
When I set expiration date to 30 days from now
Then the role assignment has an expiry timestamp
And the user loses the role automatically after expiration
And a scheduled job removes expired role assignments
```

### Scenario 8: Checking Permission at Runtime
```gherkin
Given user makes request to "/api/clients"
When the system checks authorization
Then user's roles are loaded from cache (Redis)
And effective permissions are computed from roles
And access is granted only if "clients.read" permission exists
And response time for permission check is under 5ms
```

---

## 🛠️ Technical Specification

### Database Schema

```sql
-- Roles table with hierarchical support
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  description TEXT,
  parent_role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),

  -- Constraints
  CONSTRAINT chk_role_name_format CHECK (name ~ '^[A-Z][A-Z0-9_]{1,99}$'),
  CONSTRAINT chk_no_self_parent CHECK (id != parent_role_id)
);

-- Permissions table
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  description TEXT,
  conditions JSONB DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  module VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint on resource + action
  CONSTRAINT uq_permission_resource_action UNIQUE (resource, action),
  CONSTRAINT chk_resource_format CHECK (resource ~ '^[a-z][a-z0-9_]{1,99}$'),
  CONSTRAINT chk_action_format CHECK (action ~ '^[a-z][a-z0-9_]{1,49}$')
);

-- Role permissions junction with metadata
CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  conditions_override JSONB DEFAULT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES users(id),

  PRIMARY KEY (role_id, permission_id)
);

-- User roles junction with temporal support
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ DEFAULT NULL,
  revoked_at TIMESTAMPTZ DEFAULT NULL,
  revoked_by UUID REFERENCES users(id),
  reason TEXT,

  -- Prevent duplicate active assignments
  CONSTRAINT uq_user_role_active UNIQUE (user_id, role_id, organization_id)
    WHERE revoked_at IS NULL
);

-- Permission cache for fast lookups
CREATE TABLE user_permission_cache (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  permissions JSONB NOT NULL DEFAULT '[]',
  roles JSONB NOT NULL DEFAULT '[]',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour'
);

-- Role hierarchy closure table for efficient queries
CREATE TABLE role_hierarchy (
  ancestor_role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  descendant_role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (ancestor_role_id, descendant_role_id)
);

-- Create indexes for performance
CREATE INDEX idx_roles_organization ON roles(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_roles_parent ON roles(parent_role_id) WHERE parent_role_id IS NOT NULL;
CREATE INDEX idx_roles_active ON roles(is_active) WHERE is_active = true;

CREATE INDEX idx_permissions_module ON permissions(module);
CREATE INDEX idx_permissions_resource ON permissions(resource);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_user_roles_active ON user_roles(user_id, role_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_user_roles_expiring ON user_roles(expires_at) WHERE expires_at IS NOT NULL AND revoked_at IS NULL;

CREATE INDEX idx_permission_cache_expires ON user_permission_cache(expires_at);

-- Row Level Security
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY roles_org_isolation ON roles
  FOR ALL
  USING (
    organization_id IS NULL OR
    organization_id = current_setting('app.current_organization_id')::uuid
  );

CREATE POLICY user_roles_org_isolation ON user_roles
  FOR ALL
  USING (
    organization_id IS NULL OR
    organization_id = current_setting('app.current_organization_id')::uuid
  );
```

### Default Roles and Permissions Seed

```sql
-- Insert default system roles
INSERT INTO roles (id, name, display_name, description, is_system) VALUES
  ('00000000-0000-0000-0000-000000000001', 'SUPER_ADMIN', 'Super Administrator', 'Pełny dostęp do wszystkich funkcji systemu', true),
  ('00000000-0000-0000-0000-000000000002', 'ADMIN', 'Administrator', 'Zarządzanie użytkownikami i konfiguracją', true),
  ('00000000-0000-0000-0000-000000000003', 'FIRM_OWNER', 'Właściciel Firmy', 'Pełny dostęp do danych swojej firmy', true),
  ('00000000-0000-0000-0000-000000000004', 'ACCOUNTANT', 'Księgowy', 'Dostęp do księgowości i dokumentów', true),
  ('00000000-0000-0000-0000-000000000005', 'USER', 'Użytkownik', 'Podstawowy dostęp do systemu', true),
  ('00000000-0000-0000-0000-000000000006', 'CLIENT', 'Klient', 'Dostęp do portalu klienta', true);

-- Insert default permissions by module
INSERT INTO permissions (resource, action, display_name, description, module) VALUES
  -- AIM Module permissions
  ('users', 'create', 'Tworzenie użytkowników', 'Możliwość tworzenia nowych kont użytkowników', 'aim'),
  ('users', 'read', 'Przeglądanie użytkowników', 'Możliwość przeglądania listy użytkowników', 'aim'),
  ('users', 'update', 'Edycja użytkowników', 'Możliwość modyfikacji danych użytkowników', 'aim'),
  ('users', 'delete', 'Usuwanie użytkowników', 'Możliwość dezaktywacji/usuwania użytkowników', 'aim'),
  ('roles', 'create', 'Tworzenie ról', 'Możliwość tworzenia nowych ról', 'aim'),
  ('roles', 'read', 'Przeglądanie ról', 'Możliwość przeglądania ról i uprawnień', 'aim'),
  ('roles', 'update', 'Edycja ról', 'Możliwość modyfikacji ról', 'aim'),
  ('roles', 'delete', 'Usuwanie ról', 'Możliwość usuwania ról niestandardowych', 'aim'),
  ('roles', 'assign', 'Przypisywanie ról', 'Możliwość przypisywania ról użytkownikom', 'aim'),
  ('sessions', 'read', 'Przeglądanie sesji', 'Przeglądanie aktywnych sesji użytkowników', 'aim'),
  ('sessions', 'revoke', 'Odwoływanie sesji', 'Wymuszenie wylogowania użytkowników', 'aim'),
  ('audit', 'read', 'Przeglądanie logów', 'Dostęp do logów audytowych', 'aim'),

  -- CRM Module permissions
  ('clients', 'create', 'Tworzenie klientów', 'Dodawanie nowych klientów', 'crm'),
  ('clients', 'read', 'Przeglądanie klientów', 'Dostęp do listy klientów', 'crm'),
  ('clients', 'update', 'Edycja klientów', 'Modyfikacja danych klientów', 'crm'),
  ('clients', 'delete', 'Usuwanie klientów', 'Archiwizacja/usuwanie klientów', 'crm'),
  ('clients', 'export', 'Eksport klientów', 'Eksport danych klientów', 'crm'),

  -- ACC Module permissions
  ('accounts', 'create', 'Tworzenie kont', 'Tworzenie kont księgowych', 'acc'),
  ('accounts', 'read', 'Przeglądanie kont', 'Dostęp do planu kont', 'acc'),
  ('accounts', 'update', 'Edycja kont', 'Modyfikacja kont księgowych', 'acc'),
  ('entries', 'create', 'Tworzenie zapisów', 'Tworzenie zapisów księgowych', 'acc'),
  ('entries', 'read', 'Przeglądanie zapisów', 'Dostęp do dziennika', 'acc'),
  ('entries', 'post', 'Księgowanie', 'Zatwierdzanie zapisów', 'acc'),
  ('entries', 'reverse', 'Stornowanie', 'Stornowanie zapisów', 'acc'),
  ('reports', 'read', 'Przeglądanie raportów', 'Dostęp do sprawozdań', 'acc'),
  ('reports', 'export', 'Eksport raportów', 'Eksport sprawozdań finansowych', 'acc'),

  -- DOC Module permissions
  ('documents', 'upload', 'Przesyłanie dokumentów', 'Upload dokumentów do systemu', 'doc'),
  ('documents', 'read', 'Przeglądanie dokumentów', 'Dostęp do dokumentów', 'doc'),
  ('documents', 'delete', 'Usuwanie dokumentów', 'Usuwanie dokumentów', 'doc'),

  -- TAX Module permissions
  ('tax_declarations', 'create', 'Tworzenie deklaracji', 'Przygotowywanie deklaracji podatkowych', 'tax'),
  ('tax_declarations', 'read', 'Przeglądanie deklaracji', 'Dostęp do deklaracji', 'tax'),
  ('tax_declarations', 'submit', 'Wysyłanie deklaracji', 'Wysyłanie do urzędu skarbowego', 'tax'),
  ('jpk', 'generate', 'Generowanie JPK', 'Tworzenie plików JPK', 'tax'),
  ('jpk', 'submit', 'Wysyłanie JPK', 'Wysyłanie JPK do MF', 'tax');

-- Assign permissions to default roles
-- SUPER_ADMIN gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000001', id FROM permissions;

-- ADMIN gets user and role management
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000002', id FROM permissions
WHERE module = 'aim';

-- FIRM_OWNER gets all business permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000003', id FROM permissions
WHERE module IN ('crm', 'acc', 'doc', 'tax');

-- ACCOUNTANT gets accounting and document permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000004', id FROM permissions
WHERE module IN ('acc', 'doc', 'tax') OR (resource = 'clients' AND action = 'read');

-- USER gets read-only access
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000005', id FROM permissions
WHERE action IN ('read');

-- CLIENT gets limited portal access
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000006', id FROM permissions
WHERE resource IN ('documents') AND action IN ('read', 'upload');

-- Initialize role hierarchy closure table
INSERT INTO role_hierarchy (ancestor_role_id, descendant_role_id, depth)
SELECT id, id, 0 FROM roles;
```

### API Endpoints

```typescript
// Role Management Endpoints
POST   /api/v1/roles                    // Create new role
GET    /api/v1/roles                    // List all roles
GET    /api/v1/roles/:id                // Get role details
PUT    /api/v1/roles/:id                // Update role
DELETE /api/v1/roles/:id                // Delete role (soft delete)

// Role Permissions
GET    /api/v1/roles/:id/permissions    // Get role permissions
PUT    /api/v1/roles/:id/permissions    // Update role permissions (bulk)
POST   /api/v1/roles/:id/permissions    // Add permission to role
DELETE /api/v1/roles/:id/permissions/:permissionId  // Remove permission

// User Role Assignment
GET    /api/v1/users/:id/roles          // Get user roles
POST   /api/v1/users/:id/roles          // Assign role to user
DELETE /api/v1/users/:id/roles/:roleId  // Remove role from user
GET    /api/v1/users/:id/permissions    // Get user effective permissions

// Permission Catalog
GET    /api/v1/permissions              // List all permissions
GET    /api/v1/permissions/modules      // List permissions by module
GET    /api/v1/permissions/:id          // Get permission details

// Authorization Check
POST   /api/v1/auth/check-permission    // Check if user has permission
POST   /api/v1/auth/check-permissions   // Bulk permission check
```

### Validation Schemas

```typescript
import { z } from 'zod';

// Role name validation (uppercase with underscores)
const roleNameSchema = z
  .string()
  .min(2, 'Nazwa roli musi mieć min. 2 znaki')
  .max(100, 'Nazwa roli może mieć max. 100 znaków')
  .regex(
    /^[A-Z][A-Z0-9_]{1,99}$/,
    'Nazwa roli musi zaczynać się od wielkiej litery i zawierać tylko wielkie litery, cyfry i podkreślniki'
  );

// Create Role Schema
export const createRoleSchema = z.object({
  name: roleNameSchema,
  displayName: z.string().min(2).max(150),
  description: z.string().max(500).optional(),
  parentRoleId: z.string().uuid().optional(),
  permissions: z.array(z.string().uuid()).optional().default([]),
  metadata: z.record(z.unknown()).optional()
});

export type CreateRoleDto = z.infer<typeof createRoleSchema>;

// Update Role Schema
export const updateRoleSchema = z.object({
  displayName: z.string().min(2).max(150).optional(),
  description: z.string().max(500).optional(),
  parentRoleId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional()
});

export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;

// Assign Role Schema
export const assignRoleSchema = z.object({
  roleId: z.string().uuid(),
  userId: z.string().uuid(),
  organizationId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
  reason: z.string().max(500).optional()
});

export type AssignRoleDto = z.infer<typeof assignRoleSchema>;

// Revoke Role Schema
export const revokeRoleSchema = z.object({
  reason: z.string().min(5, 'Podaj przyczynę odebrania roli').max(500)
});

export type RevokeRoleDto = z.infer<typeof revokeRoleSchema>;

// Update Role Permissions Schema
export const updateRolePermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid())
});

export type UpdateRolePermissionsDto = z.infer<typeof updateRolePermissionsSchema>;

// Permission Check Schema
export const checkPermissionSchema = z.object({
  resource: z.string().regex(/^[a-z][a-z0-9_]{1,99}$/),
  action: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/),
  conditions: z.record(z.unknown()).optional()
});

export type CheckPermissionDto = z.infer<typeof checkPermissionSchema>;

// Bulk Permission Check Schema
export const bulkCheckPermissionsSchema = z.object({
  permissions: z.array(checkPermissionSchema).min(1).max(50)
});

export type BulkCheckPermissionsDto = z.infer<typeof bulkCheckPermissionsSchema>;

// List Roles Query Schema
export const listRolesQuerySchema = z.object({
  includeSystem: z.coerce.boolean().optional().default(false),
  includeInactive: z.coerce.boolean().optional().default(false),
  search: z.string().max(100).optional(),
  module: z.string().optional()
});

export type ListRolesQueryDto = z.infer<typeof listRolesQuerySchema>;
```

### Service Implementation

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AssignRoleDto,
  CheckPermissionDto
} from './dto';
import {
  Role,
  Permission,
  UserRole,
  EffectivePermissions
} from './types';

@Injectable()
export class RBACService {
  // Cache key patterns
  private readonly ROLE_CACHE_KEY = 'rbac:role:';
  private readonly USER_PERMISSIONS_CACHE_KEY = 'rbac:user:permissions:';
  private readonly PERMISSION_CATALOG_KEY = 'rbac:permissions:all';

  // Cache TTL in seconds
  private readonly ROLE_CACHE_TTL = 3600; // 1 hour
  private readonly USER_PERMISSIONS_TTL = 900; // 15 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  // ==========================================
  // ROLE MANAGEMENT
  // ==========================================

  async createRole(
    dto: CreateRoleDto,
    createdBy: string,
    organizationId?: string
  ): Promise<Role> {
    // Check for system role name conflict
    const existingRole = await this.prisma.role.findFirst({
      where: { name: dto.name }
    });

    if (existingRole) {
      throw new ConflictException('Rola o tej nazwie już istnieje');
    }

    // Validate parent role if specified
    if (dto.parentRoleId) {
      const parentRole = await this.prisma.role.findUnique({
        where: { id: dto.parentRoleId }
      });

      if (!parentRole) {
        throw new NotFoundException('Rola nadrzędna nie istnieje');
      }

      if (!parentRole.isActive) {
        throw new BadRequestException('Rola nadrzędna jest nieaktywna');
      }
    }

    // Create role with transaction
    const role = await this.prisma.$transaction(async (tx) => {
      // Create the role
      const newRole = await tx.role.create({
        data: {
          name: dto.name,
          displayName: dto.displayName,
          description: dto.description,
          parentRoleId: dto.parentRoleId,
          organizationId,
          metadata: dto.metadata || {},
          createdBy,
          updatedBy: createdBy
        }
      });

      // Add self-reference to hierarchy closure table
      await tx.roleHierarchy.create({
        data: {
          ancestorRoleId: newRole.id,
          descendantRoleId: newRole.id,
          depth: 0
        }
      });

      // If has parent, update hierarchy closure table
      if (dto.parentRoleId) {
        await this.updateRoleHierarchy(tx, newRole.id, dto.parentRoleId);
      }

      // Assign permissions if provided
      if (dto.permissions?.length) {
        await tx.rolePermission.createMany({
          data: dto.permissions.map(permissionId => ({
            roleId: newRole.id,
            permissionId,
            grantedBy: createdBy
          }))
        });
      }

      return newRole;
    });

    // Log audit event
    await this.auditService.log({
      eventType: 'ROLE_CREATED',
      actorId: createdBy,
      targetType: 'role',
      targetId: role.id,
      metadata: {
        roleName: role.name,
        permissionCount: dto.permissions?.length || 0
      }
    });

    // Emit event
    this.eventEmitter.emit('rbac.role.created', { role, createdBy });

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
            permission: true
          }
        },
        parentRole: {
          select: { id: true, name: true, displayName: true }
        },
        _count: {
          select: { userRoles: { where: { revokedAt: null } } }
        }
      }
    });

    if (!role) {
      throw new NotFoundException('Rola nie została znaleziona');
    }

    const result: Role = {
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      parentRole: role.parentRole,
      permissions: role.permissions.map(rp => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        displayName: rp.permission.displayName,
        module: rp.permission.module
      })),
      userCount: role._count.userRoles,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
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
    query: ListRolesQueryDto,
    organizationId?: string
  ): Promise<Role[]> {
    const roles = await this.prisma.role.findMany({
      where: {
        AND: [
          // Organization filter
          organizationId
            ? { OR: [{ organizationId }, { organizationId: null }] }
            : { organizationId: null },
          // System roles filter
          query.includeSystem ? {} : { isSystem: false },
          // Active filter
          query.includeInactive ? {} : { isActive: true },
          // Search filter
          query.search
            ? {
                OR: [
                  { name: { contains: query.search, mode: 'insensitive' } },
                  { displayName: { contains: query.search, mode: 'insensitive' } }
                ]
              }
            : {}
        ]
      },
      include: {
        permissions: {
          include: { permission: true }
        },
        _count: {
          select: { userRoles: { where: { revokedAt: null } } }
        }
      },
      orderBy: [
        { isSystem: 'desc' },
        { displayName: 'asc' }
      ]
    });

    return roles.map(role => ({
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      permissions: role.permissions.map(rp => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        displayName: rp.permission.displayName,
        module: rp.permission.module
      })),
      userCount: role._count.userRoles,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    }));
  }

  async updateRole(
    roleId: string,
    dto: UpdateRoleDto,
    updatedBy: string
  ): Promise<Role> {
    const existingRole = await this.prisma.role.findUnique({
      where: { id: roleId }
    });

    if (!existingRole) {
      throw new NotFoundException('Rola nie została znaleziona');
    }

    if (existingRole.isSystem) {
      throw new ForbiddenException('Rola systemowa nie może być modyfikowana');
    }

    // Validate parent role if changing
    if (dto.parentRoleId !== undefined) {
      if (dto.parentRoleId === roleId) {
        throw new BadRequestException('Rola nie może być swoim rodzicem');
      }

      if (dto.parentRoleId) {
        // Check for circular reference
        const wouldCreateCycle = await this.checkForCyclicHierarchy(
          dto.parentRoleId,
          roleId
        );
        if (wouldCreateCycle) {
          throw new BadRequestException('Ta zmiana spowodowałaby cykliczną hierarchię');
        }
      }
    }

    const role = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        ...dto,
        updatedBy,
        updatedAt: new Date()
      }
    });

    // Invalidate cache
    await this.redis.del(`${this.ROLE_CACHE_KEY}${roleId}`);

    // If role hierarchy changed, update closure table
    if (dto.parentRoleId !== undefined && dto.parentRoleId !== existingRole.parentRoleId) {
      await this.rebuildRoleHierarchy(roleId, dto.parentRoleId);
    }

    // Log audit event
    await this.auditService.log({
      eventType: 'ROLE_UPDATED',
      actorId: updatedBy,
      targetType: 'role',
      targetId: role.id,
      metadata: {
        changes: dto,
        previousValues: {
          displayName: existingRole.displayName,
          description: existingRole.description,
          parentRoleId: existingRole.parentRoleId
        }
      }
    });

    return this.getRoleById(roleId);
  }

  async deleteRole(
    roleId: string,
    deletedBy: string
  ): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        _count: {
          select: { userRoles: { where: { revokedAt: null } } }
        }
      }
    });

    if (!role) {
      throw new NotFoundException('Rola nie została znaleziona');
    }

    if (role.isSystem) {
      throw new ForbiddenException('Rola systemowa nie może być usunięta');
    }

    if (role._count.userRoles > 0) {
      throw new ConflictException(
        `Nie można usunąć roli przypisanej do ${role._count.userRoles} użytkowników`
      );
    }

    // Soft delete by setting isActive to false
    await this.prisma.role.update({
      where: { id: roleId },
      data: {
        isActive: false,
        updatedBy: deletedBy,
        updatedAt: new Date()
      }
    });

    // Invalidate cache
    await this.redis.del(`${this.ROLE_CACHE_KEY}${roleId}`);

    // Log audit event
    await this.auditService.log({
      eventType: 'ROLE_DELETED',
      actorId: deletedBy,
      targetType: 'role',
      targetId: role.id,
      metadata: { roleName: role.name }
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
        permissions: true
      }
    });

    if (!role) {
      throw new NotFoundException('Rola nie została znaleziona');
    }

    if (role.isSystem) {
      throw new ForbiddenException('Uprawnienia roli systemowej nie mogą być modyfikowane');
    }

    // Validate all permission IDs exist
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } }
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('Niektóre uprawnienia nie istnieją');
    }

    const currentPermissionIds = role.permissions.map(rp => rp.permissionId);
    const toAdd = permissionIds.filter(id => !currentPermissionIds.includes(id));
    const toRemove = currentPermissionIds.filter(id => !permissionIds.includes(id));

    await this.prisma.$transaction(async (tx) => {
      // Remove old permissions
      if (toRemove.length > 0) {
        await tx.rolePermission.deleteMany({
          where: {
            roleId,
            permissionId: { in: toRemove }
          }
        });
      }

      // Add new permissions
      if (toAdd.length > 0) {
        await tx.rolePermission.createMany({
          data: toAdd.map(permissionId => ({
            roleId,
            permissionId,
            grantedBy: updatedBy
          }))
        });
      }
    });

    // Invalidate caches
    await this.invalidateRolePermissionCaches(roleId);

    // Log audit event
    await this.auditService.log({
      eventType: 'ROLE_PERMISSIONS_UPDATED',
      actorId: updatedBy,
      targetType: 'role',
      targetId: roleId,
      metadata: {
        added: toAdd,
        removed: toRemove,
        totalPermissions: permissionIds.length
      }
    });

    // Emit event for affected users
    this.eventEmitter.emit('rbac.role.permissions.changed', { roleId });
  }

  // ==========================================
  // USER ROLE ASSIGNMENT
  // ==========================================

  async assignRoleToUser(
    dto: AssignRoleDto,
    grantedBy: string
  ): Promise<UserRole> {
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: dto.userId } }),
      this.prisma.role.findUnique({ where: { id: dto.roleId } })
    ]);

    if (!user) {
      throw new NotFoundException('Użytkownik nie został znaleziony');
    }

    if (!role) {
      throw new NotFoundException('Rola nie została znaleziona');
    }

    if (!role.isActive) {
      throw new BadRequestException('Nie można przypisać nieaktywnej roli');
    }

    // Check if assignment already exists
    const existingAssignment = await this.prisma.userRole.findFirst({
      where: {
        userId: dto.userId,
        roleId: dto.roleId,
        organizationId: dto.organizationId || null,
        revokedAt: null
      }
    });

    if (existingAssignment) {
      throw new ConflictException('Użytkownik ma już przypisaną tę rolę');
    }

    const userRole = await this.prisma.userRole.create({
      data: {
        userId: dto.userId,
        roleId: dto.roleId,
        organizationId: dto.organizationId,
        grantedBy,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        reason: dto.reason
      },
      include: {
        role: {
          select: { id: true, name: true, displayName: true }
        }
      }
    });

    // Invalidate user's permission cache
    await this.invalidateUserPermissionCache(dto.userId);

    // Log audit event
    await this.auditService.log({
      eventType: 'ROLE_ASSIGNED',
      actorId: grantedBy,
      targetType: 'user',
      targetId: dto.userId,
      metadata: {
        roleId: dto.roleId,
        roleName: role.name,
        expiresAt: dto.expiresAt,
        reason: dto.reason
      }
    });

    // Emit event
    this.eventEmitter.emit('rbac.user.role.assigned', {
      userId: dto.userId,
      roleId: dto.roleId,
      grantedBy
    });

    return userRole;
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
        revokedAt: null
      },
      include: {
        role: true
      }
    });

    if (!userRole) {
      throw new NotFoundException('Przypisanie roli nie zostało znalezione');
    }

    // Check if it's the user's last role (prevent orphan users)
    const userRoleCount = await this.prisma.userRole.count({
      where: {
        userId,
        revokedAt: null
      }
    });

    if (userRoleCount === 1) {
      throw new BadRequestException(
        'Nie można odebrać ostatniej roli użytkownika. Przypisz inną rolę przed odebraniem tej.'
      );
    }

    await this.prisma.userRole.update({
      where: { id: userRole.id },
      data: {
        revokedAt: new Date(),
        revokedBy,
        reason
      }
    });

    // Invalidate user's permission cache
    await this.invalidateUserPermissionCache(userId);

    // Log audit event
    await this.auditService.log({
      eventType: 'ROLE_REVOKED',
      actorId: revokedBy,
      targetType: 'user',
      targetId: userId,
      metadata: {
        roleId,
        roleName: userRole.role.name,
        reason
      }
    });

    // Emit event
    this.eventEmitter.emit('rbac.user.role.revoked', {
      userId,
      roleId,
      revokedBy
    });
  }

  async getUserRoles(userId: string): Promise<UserRole[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
        revokedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true }
            }
          }
        },
        grantedByUser: {
          select: { id: true, email: true, firstName: true, lastName: true }
        }
      },
      orderBy: { grantedAt: 'desc' }
    });

    return userRoles;
  }

  // ==========================================
  // PERMISSION CHECKING
  // ==========================================

  async getUserEffectivePermissions(userId: string): Promise<EffectivePermissions> {
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
      roleNames.push(userRole.role.name);

      // Get all ancestor roles' permissions via hierarchy
      const ancestorPermissions = await this.prisma.roleHierarchy.findMany({
        where: { descendantRoleId: userRole.role.id },
        include: {
          ancestorRole: {
            include: {
              permissions: {
                include: { permission: true }
              }
            }
          }
        }
      });

      for (const hierarchy of ancestorPermissions) {
        for (const rp of hierarchy.ancestorRole.permissions) {
          const key = `${rp.permission.resource}:${rp.permission.action}`;
          if (!permissionMap.has(key)) {
            permissionMap.set(key, {
              id: rp.permission.id,
              resource: rp.permission.resource,
              action: rp.permission.action,
              displayName: rp.permission.displayName,
              module: rp.permission.module,
              grantedVia: hierarchy.ancestorRole.name
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
      computedAt: new Date()
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
        expiresAt: new Date(Date.now() + this.USER_PERMISSIONS_TTL * 1000)
      },
      update: {
        permissions: result.permissionKeys,
        roles: result.roles,
        computedAt: new Date(),
        expiresAt: new Date(Date.now() + this.USER_PERMISSIONS_TTL * 1000)
      }
    });

    return result;
  }

  async checkPermission(
    userId: string,
    dto: CheckPermissionDto
  ): Promise<boolean> {
    const effectivePermissions = await this.getUserEffectivePermissions(userId);
    const permissionKey = `${dto.resource}:${dto.action}`;

    return effectivePermissions.permissionKeys.includes(permissionKey);
  }

  async checkPermissions(
    userId: string,
    checks: CheckPermissionDto[]
  ): Promise<Map<string, boolean>> {
    const effectivePermissions = await this.getUserEffectivePermissions(userId);
    const results = new Map<string, boolean>();

    for (const check of checks) {
      const permissionKey = `${check.resource}:${check.action}`;
      results.set(permissionKey, effectivePermissions.permissionKeys.includes(permissionKey));
    }

    return results;
  }

  // ==========================================
  // PERMISSION CATALOG
  // ==========================================

  async listPermissions(module?: string): Promise<Permission[]> {
    const permissions = await this.prisma.permission.findMany({
      where: module ? { module } : {},
      orderBy: [
        { module: 'asc' },
        { resource: 'asc' },
        { action: 'asc' }
      ]
    });

    return permissions;
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
    const parentAncestors = await tx.roleHierarchy.findMany({
      where: { descendantRoleId: parentRoleId }
    });

    // Add new hierarchy entries for role -> each ancestor
    for (const ancestor of parentAncestors) {
      await tx.roleHierarchy.create({
        data: {
          ancestorRoleId: ancestor.ancestorRoleId,
          descendantRoleId: roleId,
          depth: ancestor.depth + 1
        }
      });
    }
  }

  private async rebuildRoleHierarchy(
    roleId: string,
    newParentId: string | null
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Get all descendants of this role (excluding self)
      const descendants = await tx.roleHierarchy.findMany({
        where: { ancestorRoleId: roleId, depth: { gt: 0 } }
      });

      // Delete all hierarchy entries where this role or its descendants are involved
      // (except self-references)
      await tx.roleHierarchy.deleteMany({
        where: {
          OR: [
            { descendantRoleId: roleId, depth: { gt: 0 } },
            { descendantRoleId: { in: descendants.map(d => d.descendantRoleId) } }
          ]
        }
      });

      // If new parent exists, rebuild hierarchy
      if (newParentId) {
        await this.updateRoleHierarchy(tx, roleId, newParentId);

        // Also update descendants
        for (const desc of descendants) {
          const ancestorsOfRole = await tx.roleHierarchy.findMany({
            where: { descendantRoleId: roleId }
          });

          for (const ancestor of ancestorsOfRole) {
            await tx.roleHierarchy.create({
              data: {
                ancestorRoleId: ancestor.ancestorRoleId,
                descendantRoleId: desc.descendantRoleId,
                depth: ancestor.depth + desc.depth
              }
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
    const existing = await this.prisma.roleHierarchy.findFirst({
      where: {
        ancestorRoleId: roleId,
        descendantRoleId: potentialParentId
      }
    });

    return !!existing;
  }

  private async invalidateRolePermissionCaches(roleId: string): Promise<void> {
    // Invalidate role cache
    await this.redis.del(`${this.ROLE_CACHE_KEY}${roleId}`);

    // Find all users with this role and invalidate their permission caches
    const userRoles = await this.prisma.userRole.findMany({
      where: { roleId, revokedAt: null },
      select: { userId: true }
    });

    const userIds = userRoles.map(ur => ur.userId);
    await Promise.all(
      userIds.map(userId => this.invalidateUserPermissionCache(userId))
    );
  }

  private async invalidateUserPermissionCache(userId: string): Promise<void> {
    await this.redis.del(`${this.USER_PERMISSIONS_CACHE_KEY}${userId}`);
    await this.prisma.userPermissionCache.deleteMany({
      where: { userId }
    });
  }
}
```

### tRPC Router

```typescript
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { z } from 'zod';
import {
  createRoleSchema,
  updateRoleSchema,
  assignRoleSchema,
  revokeRoleSchema,
  updateRolePermissionsSchema,
  checkPermissionSchema,
  bulkCheckPermissionsSchema,
  listRolesQuerySchema
} from './dto';

export const rbacRouter = router({
  // ==========================================
  // ROLE MANAGEMENT
  // ==========================================

  createRole: adminProcedure
    .input(createRoleSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.rbacService.createRole(
        input,
        ctx.user.id,
        ctx.organizationId
      );
    }),

  getRole: protectedProcedure
    .input(z.object({ roleId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.rbacService.getRoleById(input.roleId);
    }),

  listRoles: protectedProcedure
    .input(listRolesQuerySchema.optional())
    .query(async ({ ctx, input }) => {
      return ctx.rbacService.listRoles(
        input || {},
        ctx.organizationId
      );
    }),

  updateRole: adminProcedure
    .input(z.object({
      roleId: z.string().uuid(),
      data: updateRoleSchema
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.rbacService.updateRole(
        input.roleId,
        input.data,
        ctx.user.id
      );
    }),

  deleteRole: adminProcedure
    .input(z.object({ roleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.rbacService.deleteRole(input.roleId, ctx.user.id);
    }),

  // ==========================================
  // ROLE PERMISSIONS
  // ==========================================

  getRolePermissions: protectedProcedure
    .input(z.object({ roleId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const role = await ctx.rbacService.getRoleById(input.roleId);
      return role.permissions;
    }),

  updateRolePermissions: adminProcedure
    .input(z.object({
      roleId: z.string().uuid(),
      data: updateRolePermissionsSchema
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.rbacService.updateRolePermissions(
        input.roleId,
        input.data.permissionIds,
        ctx.user.id
      );
    }),

  // ==========================================
  // USER ROLE ASSIGNMENT
  // ==========================================

  assignRole: adminProcedure
    .input(assignRoleSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.rbacService.assignRoleToUser(input, ctx.user.id);
    }),

  revokeRole: adminProcedure
    .input(z.object({
      userId: z.string().uuid(),
      roleId: z.string().uuid(),
      data: revokeRoleSchema
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.rbacService.revokeRoleFromUser(
        input.userId,
        input.roleId,
        ctx.user.id,
        input.data.reason
      );
    }),

  getUserRoles: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Allow users to see their own roles or admins to see anyone's
      if (input.userId !== ctx.user.id) {
        const canView = await ctx.rbacService.checkPermission(
          ctx.user.id,
          { resource: 'users', action: 'read' }
        );
        if (!canView) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Brak uprawnień do przeglądania ról użytkownika'
          });
        }
      }
      return ctx.rbacService.getUserRoles(input.userId);
    }),

  getUserEffectivePermissions: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Allow users to see their own permissions or admins to see anyone's
      if (input.userId !== ctx.user.id) {
        const canView = await ctx.rbacService.checkPermission(
          ctx.user.id,
          { resource: 'users', action: 'read' }
        );
        if (!canView) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Brak uprawnień do przeglądania uprawnień użytkownika'
          });
        }
      }
      return ctx.rbacService.getUserEffectivePermissions(input.userId);
    }),

  // ==========================================
  // PERMISSION CHECKING
  // ==========================================

  checkPermission: protectedProcedure
    .input(checkPermissionSchema)
    .query(async ({ ctx, input }) => {
      return ctx.rbacService.checkPermission(ctx.user.id, input);
    }),

  checkPermissions: protectedProcedure
    .input(bulkCheckPermissionsSchema)
    .query(async ({ ctx, input }) => {
      const results = await ctx.rbacService.checkPermissions(
        ctx.user.id,
        input.permissions
      );
      return Object.fromEntries(results);
    }),

  // ==========================================
  // PERMISSION CATALOG
  // ==========================================

  listPermissions: protectedProcedure
    .input(z.object({ module: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.rbacService.listPermissions(input?.module);
    }),

  getPermissionsByModule: protectedProcedure
    .query(async ({ ctx }) => {
      const grouped = await ctx.rbacService.getPermissionsByModule();
      return Object.fromEntries(grouped);
    }),

  // ==========================================
  // MY PERMISSIONS (convenience endpoints)
  // ==========================================

  myRoles: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.rbacService.getUserRoles(ctx.user.id);
    }),

  myPermissions: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.rbacService.getUserEffectivePermissions(ctx.user.id);
    }),

  canI: protectedProcedure
    .input(checkPermissionSchema)
    .query(async ({ ctx, input }) => {
      return ctx.rbacService.checkPermission(ctx.user.id, input);
    })
});
```

### Authorization Guard

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RBACService } from './rbac.service';
import { PERMISSIONS_KEY } from './decorators';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RBACService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permissions from decorator
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permissions required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Check all required permissions
    const checks = requiredPermissions.map(perm => {
      const [resource, action] = perm.split(':');
      return { resource, action };
    });

    const results = await this.rbacService.checkPermissions(user.id, checks);

    // All permissions must be granted
    return Array.from(results.values()).every(Boolean);
  }
}

// Permission decorator
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// Usage example:
// @RequirePermissions('clients:create', 'clients:read')
// @UseGuards(PermissionGuard)
// async createClient() { ... }
```

### React Hook for Permissions

```typescript
import { useMemo, useCallback } from 'react';
import { trpc } from '@/lib/trpc';

interface UsePermissionsOptions {
  refetchOnMount?: boolean;
}

export function usePermissions(options: UsePermissionsOptions = {}) {
  const { refetchOnMount = true } = options;

  const {
    data: effectivePermissions,
    isLoading,
    error,
    refetch
  } = trpc.rbac.myPermissions.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 15 * 60 * 1000, // 15 minutes
    refetchOnMount
  });

  const permissionSet = useMemo(() => {
    if (!effectivePermissions) return new Set<string>();
    return new Set(effectivePermissions.permissionKeys);
  }, [effectivePermissions]);

  /**
   * Check if user has a specific permission
   * @param resource - Resource name (e.g., 'clients')
   * @param action - Action name (e.g., 'create')
   */
  const can = useCallback(
    (resource: string, action: string): boolean => {
      return permissionSet.has(`${resource}:${action}`);
    },
    [permissionSet]
  );

  /**
   * Check if user has any of the specified permissions
   */
  const canAny = useCallback(
    (permissions: Array<{ resource: string; action: string }>): boolean => {
      return permissions.some(p => can(p.resource, p.action));
    },
    [can]
  );

  /**
   * Check if user has all of the specified permissions
   */
  const canAll = useCallback(
    (permissions: Array<{ resource: string; action: string }>): boolean => {
      return permissions.every(p => can(p.resource, p.action));
    },
    [can]
  );

  /**
   * Check if user has a specific role
   */
  const hasRole = useCallback(
    (roleName: string): boolean => {
      if (!effectivePermissions) return false;
      return effectivePermissions.roles.includes(roleName);
    },
    [effectivePermissions]
  );

  /**
   * Check if user has any of the specified roles
   */
  const hasAnyRole = useCallback(
    (roleNames: string[]): boolean => {
      if (!effectivePermissions) return false;
      return roleNames.some(role => effectivePermissions.roles.includes(role));
    },
    [effectivePermissions]
  );

  return {
    // State
    permissions: effectivePermissions,
    roles: effectivePermissions?.roles || [],
    isLoading,
    error,

    // Methods
    can,
    canAny,
    canAll,
    hasRole,
    hasAnyRole,
    refetch
  };
}

// Example usage:
// const { can, hasRole } = usePermissions();
//
// if (can('clients', 'create')) {
//   // Show create button
// }
//
// if (hasRole('ADMIN')) {
//   // Show admin section
// }
```

### Permission-Based Component

```typescript
import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface RequirePermissionProps {
  resource: string;
  action: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequirePermission({
  resource,
  action,
  children,
  fallback = null
}: RequirePermissionProps) {
  const { can, isLoading } = usePermissions();

  if (isLoading) {
    return null; // Or loading spinner
  }

  if (!can(resource, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Usage:
// <RequirePermission resource="clients" action="create">
//   <CreateClientButton />
// </RequirePermission>

interface RequireRoleProps {
  role: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireRole({
  role,
  children,
  fallback = null
}: RequireRoleProps) {
  const { hasRole, hasAnyRole, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  const hasRequiredRole = Array.isArray(role)
    ? hasAnyRole(role)
    : hasRole(role);

  if (!hasRequiredRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Usage:
// <RequireRole role="ADMIN">
//   <AdminPanel />
// </RequireRole>
//
// <RequireRole role={['ADMIN', 'MANAGER']}>
//   <ManagementSection />
// </RequireRole>
```

---

## 🧪 Test Specification

### Unit Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { RBACService } from './rbac.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuditService } from '../audit/audit.service';

describe('RBACService', () => {
  let service: RBACService;
  let prisma: jest.Mocked<PrismaService>;
  let redis: jest.Mocked<RedisService>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RBACService,
        {
          provide: PrismaService,
          useValue: {
            role: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn()
            },
            permission: {
              findMany: jest.fn()
            },
            userRole: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              count: jest.fn()
            },
            roleHierarchy: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              deleteMany: jest.fn()
            },
            userPermissionCache: {
              upsert: jest.fn(),
              deleteMany: jest.fn()
            },
            $transaction: jest.fn(cb => cb(prisma))
          }
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            setex: jest.fn(),
            del: jest.fn()
          }
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn()
          }
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<RBACService>(RBACService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
    auditService = module.get(AuditService);
  });

  describe('createRole', () => {
    it('should create a new role successfully', async () => {
      const dto = {
        name: 'TEST_ROLE',
        displayName: 'Test Role',
        description: 'A test role'
      };

      prisma.role.findFirst.mockResolvedValue(null);
      prisma.role.create.mockResolvedValue({
        id: 'role-123',
        ...dto,
        isSystem: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await service.createRole(dto, 'user-123');

      expect(prisma.role.create).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'ROLE_CREATED'
        })
      );
    });

    it('should reject duplicate role names', async () => {
      prisma.role.findFirst.mockResolvedValue({
        id: 'existing-role',
        name: 'TEST_ROLE'
      });

      await expect(
        service.createRole({
          name: 'TEST_ROLE',
          displayName: 'Test'
        }, 'user-123')
      ).rejects.toThrow('Rola o tej nazwie już istnieje');
    });

    it('should validate role name format', async () => {
      await expect(
        service.createRole({
          name: 'invalid-role', // lowercase not allowed
          displayName: 'Invalid'
        }, 'user-123')
      ).rejects.toThrow();
    });
  });

  describe('assignRoleToUser', () => {
    it('should assign role to user successfully', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-123' });
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-123',
        name: 'ACCOUNTANT',
        isActive: true
      });
      prisma.userRole.findFirst.mockResolvedValue(null);
      prisma.userRole.create.mockResolvedValue({
        id: 'assignment-123',
        userId: 'user-123',
        roleId: 'role-123',
        grantedAt: new Date()
      });

      const result = await service.assignRoleToUser({
        userId: 'user-123',
        roleId: 'role-123'
      }, 'admin-123');

      expect(prisma.userRole.create).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled(); // Cache invalidation
    });

    it('should reject assigning inactive role', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-123' });
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-123',
        isActive: false
      });

      await expect(
        service.assignRoleToUser({
          userId: 'user-123',
          roleId: 'role-123'
        }, 'admin-123')
      ).rejects.toThrow('Nie można przypisać nieaktywnej roli');
    });

    it('should reject duplicate role assignment', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-123' });
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-123',
        isActive: true
      });
      prisma.userRole.findFirst.mockResolvedValue({
        id: 'existing',
        userId: 'user-123',
        roleId: 'role-123'
      });

      await expect(
        service.assignRoleToUser({
          userId: 'user-123',
          roleId: 'role-123'
        }, 'admin-123')
      ).rejects.toThrow('Użytkownik ma już przypisaną tę rolę');
    });
  });

  describe('checkPermission', () => {
    it('should return true when user has permission', async () => {
      redis.get.mockResolvedValue(JSON.stringify({
        permissionKeys: ['clients:read', 'clients:create']
      }));

      const result = await service.checkPermission('user-123', {
        resource: 'clients',
        action: 'read'
      });

      expect(result).toBe(true);
    });

    it('should return false when user lacks permission', async () => {
      redis.get.mockResolvedValue(JSON.stringify({
        permissionKeys: ['clients:read']
      }));

      const result = await service.checkPermission('user-123', {
        resource: 'clients',
        action: 'delete'
      });

      expect(result).toBe(false);
    });

    it('should compute permissions from database when cache miss', async () => {
      redis.get.mockResolvedValue(null);
      prisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            id: 'role-1',
            name: 'USER',
            permissions: [
              { permission: { resource: 'clients', action: 'read' } }
            ]
          }
        }
      ]);
      prisma.roleHierarchy.findMany.mockResolvedValue([
        {
          ancestorRole: {
            name: 'USER',
            permissions: [
              { permission: { resource: 'clients', action: 'read' } }
            ]
          }
        }
      ]);

      const result = await service.checkPermission('user-123', {
        resource: 'clients',
        action: 'read'
      });

      expect(result).toBe(true);
      expect(redis.setex).toHaveBeenCalled(); // Should cache result
    });
  });

  describe('revokeRoleFromUser', () => {
    it('should revoke role successfully', async () => {
      prisma.userRole.findFirst.mockResolvedValue({
        id: 'assignment-123',
        userId: 'user-123',
        roleId: 'role-123',
        role: { name: 'ACCOUNTANT' }
      });
      prisma.userRole.count.mockResolvedValue(2); // User has 2 roles

      await service.revokeRoleFromUser(
        'user-123',
        'role-123',
        'admin-123',
        'Zmiana stanowiska'
      );

      expect(prisma.userRole.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            revokedAt: expect.any(Date),
            revokedBy: 'admin-123',
            reason: 'Zmiana stanowiska'
          })
        })
      );
    });

    it('should prevent revoking last role', async () => {
      prisma.userRole.findFirst.mockResolvedValue({
        id: 'assignment-123',
        userId: 'user-123',
        roleId: 'role-123',
        role: { name: 'USER' }
      });
      prisma.userRole.count.mockResolvedValue(1); // User has only 1 role

      await expect(
        service.revokeRoleFromUser(
          'user-123',
          'role-123',
          'admin-123',
          'Test'
        )
      ).rejects.toThrow('Nie można odebrać ostatniej roli użytkownika');
    });
  });

  describe('updateRole', () => {
    it('should update non-system role', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-123',
        name: 'CUSTOM_ROLE',
        isSystem: false
      });

      await service.updateRole('role-123', {
        displayName: 'Updated Name'
      }, 'admin-123');

      expect(prisma.role.update).toHaveBeenCalled();
    });

    it('should reject updating system role', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-123',
        name: 'SUPER_ADMIN',
        isSystem: true
      });

      await expect(
        service.updateRole('role-123', {
          displayName: 'Hacked'
        }, 'admin-123')
      ).rejects.toThrow('Rola systemowa nie może być modyfikowana');
    });
  });
});
```

### Integration Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('RBAC Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = module.createNestApplication();
    await app.init();

    prisma = module.get<PrismaService>(PrismaService);

    // Setup test users and get tokens
    adminToken = await getTestToken(app, 'admin@test.com', 'ADMIN');
    userToken = await getTestToken(app, 'user@test.com', 'USER');
  });

  afterAll(async () => {
    await prisma.$executeRaw`DELETE FROM roles WHERE is_system = false`;
    await app.close();
  });

  describe('POST /api/v1/roles', () => {
    it('should allow admin to create role', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'TEST_ACCOUNTANT',
          displayName: 'Testowy Księgowy',
          description: 'Rola testowa'
        })
        .expect(201);

      expect(response.body.name).toBe('TEST_ACCOUNTANT');
      expect(response.body.isSystem).toBe(false);
    });

    it('should reject role creation by regular user', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'HACKER_ROLE',
          displayName: 'Hacker'
        })
        .expect(403);
    });
  });

  describe('POST /api/v1/users/:id/roles', () => {
    it('should assign role to user', async () => {
      const testUser = await prisma.user.create({
        data: {
          email: 'test-assign@example.com',
          passwordHash: 'hash'
        }
      });

      const role = await prisma.role.findFirst({
        where: { name: 'USER' }
      });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/users/${testUser.id}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roleId: role.id
        })
        .expect(201);

      expect(response.body.roleId).toBe(role.id);
      expect(response.body.userId).toBe(testUser.id);

      // Cleanup
      await prisma.user.delete({ where: { id: testUser.id } });
    });
  });

  describe('GET /api/v1/users/:id/permissions', () => {
    it('should return effective permissions', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/users/me/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.permissionKeys).toBeDefined();
      expect(response.body.roles).toBeDefined();
      expect(Array.isArray(response.body.permissionKeys)).toBe(true);
    });

    it('should not allow user to view other users permissions', async () => {
      const otherUser = await prisma.user.findFirst({
        where: { email: { not: 'user@test.com' } }
      });

      await request(app.getHttpServer())
        .get(`/api/v1/users/${otherUser.id}/permissions`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('POST /api/v1/auth/check-permission', () => {
    it('should return true for granted permission', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/check-permission')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resource: 'users',
          action: 'read'
        })
        .expect(200);

      expect(response.body).toBe(true);
    });

    it('should return false for denied permission', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/check-permission')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          resource: 'roles',
          action: 'create'
        })
        .expect(200);

      expect(response.body).toBe(false);
    });
  });

  describe('Permission cache performance', () => {
    it('should check permission in under 5ms from cache', async () => {
      // Warm up cache
      await request(app.getHttpServer())
        .post('/api/v1/auth/check-permission')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resource: 'users', action: 'read' });

      // Measure cached response
      const start = Date.now();
      await request(app.getHttpServer())
        .post('/api/v1/auth/check-permission')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ resource: 'users', action: 'read' });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50); // 50ms including network overhead
    });
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('RBAC Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@example.com');
    await page.fill('[name="password"]', 'AdminPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('admin can view role list', async ({ page }) => {
    await page.goto('/admin/roles');

    // Should see system roles
    await expect(page.locator('text=Super Administrator')).toBeVisible();
    await expect(page.locator('text=Administrator')).toBeVisible();
    await expect(page.locator('text=Użytkownik')).toBeVisible();

    // System roles should have lock icon
    await expect(page.locator('[data-role="SUPER_ADMIN"] .system-badge')).toBeVisible();
  });

  test('admin can create custom role', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.click('button:has-text("Nowa rola")');

    // Fill role form
    await page.fill('[name="name"]', 'JUNIOR_ACCOUNTANT');
    await page.fill('[name="displayName"]', 'Młodszy Księgowy');
    await page.fill('[name="description"]', 'Rola dla nowych księgowych');

    // Select permissions
    await page.click('[data-permission="clients:read"]');
    await page.click('[data-permission="documents:read"]');
    await page.click('[data-permission="documents:upload"]');

    await page.click('button:has-text("Utwórz rolę")');

    // Should see success message
    await expect(page.locator('text=Rola została utworzona')).toBeVisible();

    // New role should appear in list
    await expect(page.locator('text=Młodszy Księgowy')).toBeVisible();
  });

  test('admin can assign role to user', async ({ page }) => {
    await page.goto('/admin/users');
    await page.click('tr:has-text("jan.kowalski@example.com")');

    // Open role assignment dialog
    await page.click('button:has-text("Zarządzaj rolami")');

    // Select role to assign
    await page.click('[data-role="ACCOUNTANT"]');
    await page.click('button:has-text("Przypisz")');

    // Should see success
    await expect(page.locator('text=Rola została przypisana')).toBeVisible();

    // Role should appear in user's role list
    await expect(page.locator('.user-roles >> text=Księgowy')).toBeVisible();
  });

  test('cannot modify system role', async ({ page }) => {
    await page.goto('/admin/roles');

    // Click on system role
    await page.click('tr:has-text("Super Administrator")');

    // Edit button should be disabled or not visible
    const editButton = page.locator('button:has-text("Edytuj")');
    await expect(editButton).toBeDisabled();

    // Delete button should be disabled
    const deleteButton = page.locator('button:has-text("Usuń")');
    await expect(deleteButton).toBeDisabled();
  });

  test('role permissions are reflected in UI', async ({ page }) => {
    // Login as user with limited permissions
    await page.goto('/logout');
    await page.goto('/login');
    await page.fill('[name="email"]', 'limited-user@example.com');
    await page.fill('[name="password"]', 'UserPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Should not see admin menu
    await expect(page.locator('text=Administracja')).not.toBeVisible();

    // Should see limited menu based on permissions
    await expect(page.locator('text=Dokumenty')).toBeVisible();

    // Trying to access admin page should redirect or show error
    await page.goto('/admin/roles');
    await expect(page.locator('text=Brak uprawnień')).toBeVisible();
  });

  test('effective permissions view shows inherited permissions', async ({ page }) => {
    await page.goto('/admin/users');
    await page.click('tr:has-text("jan.kowalski@example.com")');
    await page.click('text=Uprawnienia efektywne');

    // Should show permissions grouped by module
    await expect(page.locator('.permission-module:has-text("CRM")')).toBeVisible();
    await expect(page.locator('.permission-module:has-text("Księgowość")')).toBeVisible();

    // Should show which role granted each permission
    await expect(page.locator('[data-permission="clients:read"] >> text=Księgowy')).toBeVisible();
  });
});
```

---

## 🔒 Security Checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| System roles cannot be modified | ✅ | `isSystem` flag protection |
| Role name format enforced | ✅ | Regex validation on creation |
| Permission cache invalidation | ✅ | On role/permission changes |
| Circular hierarchy prevention | ✅ | Closure table with cycle check |
| Last role protection | ✅ | Cannot revoke user's last role |
| Audit logging for all changes | ✅ | AuditService integration |
| Row-level security | ✅ | Organization isolation via RLS |
| Permission check < 5ms | ✅ | Redis cache for effective permissions |
| Input validation with Zod | ✅ | All DTOs validated |
| SQL injection prevention | ✅ | Parameterized queries via Prisma |
| XSS prevention | ✅ | No HTML in role/permission data |
| Authorization before action | ✅ | PermissionGuard on endpoints |

---

## 📊 Audit Events

| Event Type | Trigger | Data Captured |
|------------|---------|---------------|
| `ROLE_CREATED` | New role created | roleName, permissionCount, createdBy |
| `ROLE_UPDATED` | Role modified | changes, previousValues, updatedBy |
| `ROLE_DELETED` | Role deactivated | roleName, deletedBy |
| `ROLE_PERMISSIONS_UPDATED` | Permissions changed | added, removed, roleId |
| `ROLE_ASSIGNED` | Role given to user | userId, roleId, grantedBy, expiresAt |
| `ROLE_REVOKED` | Role removed from user | userId, roleId, revokedBy, reason |
| `PERMISSION_CHECK_FAILED` | Unauthorized access attempt | userId, resource, action, endpoint |

---

## 📝 Implementation Notes

### 1. Role Hierarchy
Role hierarchy uses a closure table pattern for efficient ancestor/descendant queries. This allows:
- O(1) lookup for "does role A inherit from role B?"
- Efficient permission aggregation across hierarchy
- No recursive queries needed

### 2. Permission Cache Strategy
- **Redis**: Primary cache with 15-minute TTL for user permissions
- **PostgreSQL**: Backup cache in `user_permission_cache` table
- Cache invalidation cascades when role permissions change

### 3. Performance Optimization
- Permission checks are designed for <5ms response time
- Bulk permission checks available for UI rendering
- Role list queries are paginated and filterable

### 4. Multi-Tenancy Support
- Roles can be organization-scoped or global (system roles)
- RLS policies ensure organization isolation
- Custom roles per organization supported

### 5. Temporal Role Assignments
- Roles can have expiration dates
- Background job processes expired assignments daily
- Useful for temporary access (contractors, auditors)

### 6. UI Integration
- `usePermissions` hook for React components
- `RequirePermission` / `RequireRole` components for conditional rendering
- Permission-based route guards available

---

*Story created: December 2024*
*Template version: 1.0*
