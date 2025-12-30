# Story AIM-008: Permission Management (Fine-Grained Access Control)

> **Story ID**: AIM-008
> **Epic**: Authentication & Identity Management
> **Priority**: P1 (High)
> **Points**: 8
> **Status**: 📋 Ready for Development
> **Dependencies**: AIM-007 (RBAC Setup)

---

## 📋 User Story

**As a** system administrator
**I want** to define and manage fine-grained permissions with resource-action patterns
**So that** I can precisely control access to system features and data

---

## ✅ Acceptance Criteria

### Scenario 1: Creating a New Permission
```gherkin
Given I am logged in as an administrator
And I have "permissions.create" permission
When I navigate to permission management
And I create a new permission with resource "invoices" and action "export"
Then the permission "invoices.export" is created
And the permission appears in the permission registry
And an audit event is logged for permission creation
```

### Scenario 2: Permission with Wildcard Action
```gherkin
Given I am managing permissions for role "ACCOUNTANT"
When I assign permission "invoices.*" to the role
Then the role has all invoice-related permissions
And any new invoice permission is automatically included
And the wildcard is evaluated at permission check time
```

### Scenario 3: Permission Groups/Categories
```gherkin
Given I am viewing the permission list
When I filter by module "CRM"
Then I see all CRM-related permissions grouped together
And permissions are organized by resource (clients, contacts, timeline)
And I can expand/collapse permission groups
```

### Scenario 4: Permission Templates
```gherkin
Given I am creating a new role "JUNIOR_ACCOUNTANT"
When I select template "Read-Only Financial Access"
Then the role is pre-populated with read permissions for financial resources
And I can customize by adding or removing individual permissions
And the template source is documented in audit log
```

### Scenario 5: Effective Permission Calculation
```gherkin
Given user has role "ACCOUNTANT" with "invoices.read" permission
And user also has direct permission override "invoices.export"
When I check user's effective permissions for resource "invoices"
Then I see both "invoices.read" and "invoices.export"
And I can see the source (role vs direct) for each permission
```

### Scenario 6: Permission Denied with Reason
```gherkin
Given user tries to access "/api/invoices/export"
And user does not have "invoices.export" permission
When the permission check fails
Then the API returns 403 Forbidden
And the response includes error code "PERMISSION_DENIED"
And the audit log records the denied access attempt
And the error message is "Brak uprawnień do eksportu faktur"
```

### Scenario 7: Conditional Permissions
```gherkin
Given user has permission "clients.read" with condition "own_organization_only"
When user tries to read client from their organization
Then access is granted
When user tries to read client from another organization
Then access is denied
And the denial is logged with condition failure reason
```

### Scenario 8: Permission Inheritance Override
```gherkin
Given organization has role "LOCAL_ADMIN" that inherits from "ADMIN"
And "ADMIN" role has permission "users.delete"
When organization sets explicit deny for "users.delete" on "LOCAL_ADMIN"
Then users with "LOCAL_ADMIN" cannot delete users
And the explicit deny takes precedence over inherited allow
```

### Scenario 9: Permission Check Performance
```gherkin
Given system receives 1000 concurrent API requests
When each request requires permission check
Then average permission check time is under 2ms
And permissions are loaded from Redis cache
And cache miss results in database query with cache update
```

### Scenario 10: Permission-Based UI Rendering
```gherkin
Given user is viewing the dashboard
When the UI renders action buttons
Then only buttons for permitted actions are displayed
And hidden buttons don't send any DOM elements (security)
And disabled buttons show tooltip "Brak uprawnień"
```

### Scenario 11: Bulk Permission Assignment
```gherkin
Given I am managing role "SALES_MANAGER"
When I select multiple permissions using checkbox
And I click "Assign Selected"
Then all selected permissions are added to the role atomically
And a single audit event records all changes
And role's permission cache is invalidated
```

### Scenario 12: Permission Dependencies
```gherkin
Given permission "invoices.create" requires "clients.read"
When I assign only "invoices.create" to a role
Then I see warning "Ta uprawnienie wymaga również: clients.read"
And I can choose to auto-add dependent permissions
And the dependency relationship is documented
```

---

## 🛠️ Technical Specification

### Database Schema

```sql
-- Permission Categories (for UI organization)
CREATE TABLE permission_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(150) NOT NULL,
  display_name_pl VARCHAR(150) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  icon VARCHAR(50),
  color VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Extended Permissions table (referenced from AIM-007)
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Permission identity
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,

  -- Display information
  display_name VARCHAR(150) NOT NULL,
  display_name_pl VARCHAR(150) NOT NULL,
  description TEXT,
  description_pl TEXT,

  -- Categorization
  category_id UUID REFERENCES permission_categories(id) ON DELETE SET NULL,
  module VARCHAR(50) NOT NULL,

  -- Permission characteristics
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_dangerous BOOLEAN NOT NULL DEFAULT false, -- Requires confirmation
  requires_mfa BOOLEAN NOT NULL DEFAULT false, -- Requires active MFA

  -- Conditional permissions
  supports_conditions BOOLEAN NOT NULL DEFAULT false,
  allowed_conditions JSONB DEFAULT '[]',

  -- Dependencies
  depends_on UUID[] DEFAULT '{}',

  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),

  -- Constraints
  UNIQUE(resource, action)
);

-- Permission Templates (presets for common role patterns)
CREATE TABLE permission_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(150) NOT NULL,
  display_name_pl VARCHAR(150) NOT NULL,
  description TEXT,
  description_pl TEXT,

  -- Template configuration
  permission_ids UUID[] NOT NULL DEFAULT '{}',
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id)
);

-- Direct User Permissions (overrides role permissions)
CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

  -- Grant or Deny
  permission_type VARCHAR(10) NOT NULL DEFAULT 'GRANT'
    CHECK (permission_type IN ('GRANT', 'DENY')),

  -- Conditions for conditional permissions
  conditions JSONB DEFAULT '{}',

  -- Temporal assignment
  granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,

  -- Audit trail
  granted_by UUID NOT NULL REFERENCES users(id),
  reason TEXT,

  UNIQUE(user_id, permission_id)
);

-- Role Permission Overrides (for child roles)
CREATE TABLE role_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

  -- Override type
  override_type VARCHAR(10) NOT NULL CHECK (override_type IN ('DENY', 'REQUIRE_MFA')),

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES users(id),

  UNIQUE(role_id, permission_id)
);

-- Permission Change Audit (dedicated table for permission changes)
CREATE TABLE permission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event details
  event_type VARCHAR(50) NOT NULL,
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('ROLE', 'USER', 'PERMISSION')),
  target_id UUID NOT NULL,

  -- Change details
  permission_id UUID REFERENCES permissions(id),
  old_value JSONB,
  new_value JSONB,

  -- Actor
  actor_id UUID NOT NULL REFERENCES users(id),
  actor_ip VARCHAR(45),
  actor_user_agent TEXT,

  -- Context
  organization_id UUID REFERENCES organizations(id),
  correlation_id UUID NOT NULL,

  -- Immutable timestamp
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);
CREATE INDEX idx_permissions_module ON permissions(module);
CREATE INDEX idx_permissions_category ON permissions(category_id);
CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission ON user_permissions(permission_id);
CREATE INDEX idx_user_permissions_expires ON user_permissions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_permission_audit_target ON permission_audit_log(target_type, target_id);
CREATE INDEX idx_permission_audit_actor ON permission_audit_log(actor_id);
CREATE INDEX idx_permission_audit_created ON permission_audit_log(created_at);

-- GIN index for wildcard permission matching
CREATE INDEX idx_permissions_resource_gin ON permissions USING gin(resource gin_trgm_ops);

-- RLS Policies
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY permissions_read_policy ON permissions
  FOR SELECT USING (is_active = true);

CREATE POLICY permissions_manage_policy ON permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM get_user_permissions(current_user_id())
      WHERE permission_key = 'permissions.manage'
    )
  );

CREATE POLICY user_permissions_policy ON user_permissions
  FOR ALL USING (
    user_id = current_user_id() OR
    EXISTS (
      SELECT 1 FROM get_user_permissions(current_user_id())
      WHERE permission_key = 'permissions.manage'
    )
  );
```

### API Endpoints (tRPC)

```typescript
// src/server/api/routers/permissions.ts
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '../trpc';
import { PermissionService } from '@/services/permission.service';
import { TRPCError } from '@trpc/server';

// Zod Schemas
const PermissionSchema = z.object({
  id: z.string().uuid(),
  resource: z.string().min(1).max(100),
  action: z.string().min(1).max(50),
  displayName: z.string().min(1).max(150),
  displayNamePl: z.string().min(1).max(150),
  description: z.string().optional(),
  descriptionPl: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  module: z.string().min(1).max(50),
  isSystem: z.boolean(),
  isDangerous: z.boolean(),
  requiresMfa: z.boolean(),
  supportsConditions: z.boolean(),
  allowedConditions: z.array(z.string()).default([]),
  dependsOn: z.array(z.string().uuid()).default([]),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const CreatePermissionSchema = z.object({
  resource: z.string()
    .min(1, 'Zasób jest wymagany')
    .max(100, 'Nazwa zasobu zbyt długa')
    .regex(/^[a-z][a-z0-9_]*$/, 'Nieprawidłowy format zasobu'),
  action: z.string()
    .min(1, 'Akcja jest wymagana')
    .max(50, 'Nazwa akcji zbyt długa')
    .regex(/^[a-z][a-z0-9_]*|\*$/, 'Nieprawidłowy format akcji'),
  displayName: z.string().min(1).max(150),
  displayNamePl: z.string().min(1).max(150),
  description: z.string().max(500).optional(),
  descriptionPl: z.string().max(500).optional(),
  categoryId: z.string().uuid().optional(),
  module: z.string().min(1).max(50),
  isDangerous: z.boolean().default(false),
  requiresMfa: z.boolean().default(false),
  supportsConditions: z.boolean().default(false),
  allowedConditions: z.array(z.string()).default([]),
  dependsOn: z.array(z.string().uuid()).default([]),
});

const PermissionConditionSchema = z.object({
  type: z.enum(['own_organization', 'own_records', 'department', 'custom']),
  value: z.record(z.unknown()).optional(),
});

const AssignUserPermissionSchema = z.object({
  userId: z.string().uuid(),
  permissionId: z.string().uuid(),
  permissionType: z.enum(['GRANT', 'DENY']).default('GRANT'),
  conditions: z.array(PermissionConditionSchema).default([]),
  expiresAt: z.date().optional(),
  reason: z.string().max(500).optional(),
});

const BulkPermissionAssignmentSchema = z.object({
  targetType: z.enum(['role', 'user']),
  targetId: z.string().uuid(),
  permissionIds: z.array(z.string().uuid()).min(1).max(100),
  operation: z.enum(['add', 'remove']),
});

const PermissionCheckSchema = z.object({
  userId: z.string().uuid(),
  resource: z.string(),
  action: z.string(),
  context: z.record(z.unknown()).optional(),
});

export const permissionsRouter = createTRPCRouter({
  // List all permissions with filtering
  list: protectedProcedure
    .input(z.object({
      module: z.string().optional(),
      categoryId: z.string().uuid().optional(),
      search: z.string().optional(),
      includeInactive: z.boolean().default(false),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(10).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);

      return service.listPermissions({
        ...input,
        organizationId: ctx.session.organizationId,
      });
    }),

  // Get permission by ID
  getById: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);

      const permission = await service.getPermissionById(input.id);

      if (!permission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Uprawnienie nie zostało znalezione',
        });
      }

      return permission;
    }),

  // Get permission by resource and action
  getByKey: protectedProcedure
    .input(z.object({
      resource: z.string(),
      action: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);

      return service.getPermissionByKey(input.resource, input.action);
    }),

  // Create new permission
  create: adminProcedure
    .input(CreatePermissionSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);

      // Check for duplicate
      const existing = await service.getPermissionByKey(input.resource, input.action);
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Uprawnienie ${input.resource}.${input.action} już istnieje`,
        });
      }

      // Validate dependencies exist
      if (input.dependsOn.length > 0) {
        const dependencies = await service.getPermissionsByIds(input.dependsOn);
        if (dependencies.length !== input.dependsOn.length) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Niektóre zależności nie istnieją',
          });
        }
      }

      return service.createPermission({
        ...input,
        createdBy: ctx.session.userId,
      });
    }),

  // Update permission
  update: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: CreatePermissionSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);

      const permission = await service.getPermissionById(input.id);

      if (!permission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Uprawnienie nie zostało znalezione',
        });
      }

      if (permission.isSystem) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Uprawnienie systemowe nie może być modyfikowane',
        });
      }

      return service.updatePermission(input.id, input.data, ctx.session.userId);
    }),

  // Delete permission
  delete: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);

      const permission = await service.getPermissionById(input.id);

      if (!permission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Uprawnienie nie zostało znalezione',
        });
      }

      if (permission.isSystem) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Uprawnienie systemowe nie może być usunięte',
        });
      }

      // Check if permission is in use
      const usage = await service.getPermissionUsage(input.id);
      if (usage.roleCount > 0 || usage.userCount > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Uprawnienie jest używane przez ${usage.roleCount} ról i ${usage.userCount} użytkowników`,
        });
      }

      return service.deletePermission(input.id, ctx.session.userId);
    }),

  // Get permission categories
  getCategories: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);
      return service.getCategories();
    }),

  // Get permissions grouped by category
  getGroupedByCategory: protectedProcedure
    .input(z.object({
      module: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);
      return service.getPermissionsGroupedByCategory(input.module);
    }),

  // Get permission templates
  getTemplates: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);
      return service.getTemplates();
    }),

  // Apply template to role
  applyTemplate: adminProcedure
    .input(z.object({
      templateId: z.string().uuid(),
      roleId: z.string().uuid(),
      merge: z.boolean().default(true), // true = add to existing, false = replace
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);

      return service.applyTemplateToRole(
        input.templateId,
        input.roleId,
        input.merge,
        ctx.session.userId
      );
    }),

  // Assign permission directly to user
  assignToUser: adminProcedure
    .input(AssignUserPermissionSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);

      return service.assignPermissionToUser({
        ...input,
        grantedBy: ctx.session.userId,
      });
    }),

  // Revoke permission from user
  revokeFromUser: adminProcedure
    .input(z.object({
      userId: z.string().uuid(),
      permissionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);

      return service.revokePermissionFromUser(
        input.userId,
        input.permissionId,
        ctx.session.userId
      );
    }),

  // Get user's direct permissions
  getUserPermissions: protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      // Can only view own permissions or must have permission
      if (input.userId !== ctx.session.userId) {
        const canView = await ctx.permissionChecker.check(
          ctx.session.userId,
          'users',
          'read_permissions'
        );
        if (!canView) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Brak uprawnień do przeglądania uprawnień użytkownika',
          });
        }
      }

      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);
      return service.getUserDirectPermissions(input.userId);
    }),

  // Get user's effective permissions (roles + direct)
  getEffectivePermissions: protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
      groupBySource: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      // Can only view own permissions or must have permission
      if (input.userId !== ctx.session.userId) {
        const canView = await ctx.permissionChecker.check(
          ctx.session.userId,
          'users',
          'read_permissions'
        );
        if (!canView) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Brak uprawnień do przeglądania uprawnień użytkownika',
          });
        }
      }

      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);
      return service.getUserEffectivePermissions(input.userId, input.groupBySource);
    }),

  // Bulk permission assignment
  bulkAssign: adminProcedure
    .input(BulkPermissionAssignmentSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);

      return service.bulkAssignPermissions({
        ...input,
        actorId: ctx.session.userId,
      });
    }),

  // Check permission (for runtime authorization)
  check: protectedProcedure
    .input(PermissionCheckSchema)
    .query(async ({ ctx, input }) => {
      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);

      return service.checkPermission(
        input.userId,
        input.resource,
        input.action,
        input.context
      );
    }),

  // Check multiple permissions
  checkMultiple: protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
      permissions: z.array(z.object({
        resource: z.string(),
        action: z.string(),
      })),
      mode: z.enum(['all', 'any']).default('all'),
    }))
    .query(async ({ ctx, input }) => {
      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);

      return service.checkMultiplePermissions(
        input.userId,
        input.permissions,
        input.mode
      );
    }),

  // Get permission dependencies
  getDependencies: protectedProcedure
    .input(z.object({
      permissionId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);
      return service.getPermissionDependencies(input.permissionId);
    }),

  // Get permission usage statistics
  getUsage: adminProcedure
    .input(z.object({
      permissionId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);
      return service.getPermissionUsage(input.permissionId);
    }),

  // Get modules (for filtering)
  getModules: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new PermissionService(ctx.db, ctx.cache, ctx.audit);
      return service.getModules();
    }),
});
```

### Permission Service Implementation

```typescript
// src/services/permission.service.ts
import { v4 as uuidv4 } from 'uuid';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { AuditLogger } from './audit.service';

interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  source?: 'role' | 'direct' | 'inherited' | 'denied';
  checkedAt: Date;
  cacheHit: boolean;
}

interface EffectivePermission {
  permissionId: string;
  resource: string;
  action: string;
  permissionKey: string;
  source: 'role' | 'direct';
  sourceId: string;
  sourceName: string;
  conditions?: Record<string, unknown>[];
  isDenied: boolean;
}

export class PermissionService {
  private readonly CACHE_PREFIX = 'permissions:';
  private readonly USER_PERMISSIONS_TTL = 300; // 5 minutes
  private readonly PERMISSION_REGISTRY_TTL = 3600; // 1 hour

  constructor(
    private readonly db: PrismaClient,
    private readonly cache: Redis,
    private readonly audit: AuditLogger
  ) {}

  // ==================== Permission CRUD ====================

  async createPermission(data: {
    resource: string;
    action: string;
    displayName: string;
    displayNamePl: string;
    description?: string;
    descriptionPl?: string;
    categoryId?: string;
    module: string;
    isDangerous?: boolean;
    requiresMfa?: boolean;
    supportsConditions?: boolean;
    allowedConditions?: string[];
    dependsOn?: string[];
    createdBy: string;
  }) {
    const correlationId = uuidv4();

    const permission = await this.db.permission.create({
      data: {
        id: uuidv4(),
        resource: data.resource,
        action: data.action,
        displayName: data.displayName,
        displayNamePl: data.displayNamePl,
        description: data.description,
        descriptionPl: data.descriptionPl,
        categoryId: data.categoryId,
        module: data.module,
        isDangerous: data.isDangerous || false,
        requiresMfa: data.requiresMfa || false,
        supportsConditions: data.supportsConditions || false,
        allowedConditions: data.allowedConditions || [],
        dependsOn: data.dependsOn || [],
        createdBy: data.createdBy,
      },
    });

    // Invalidate permission registry cache
    await this.invalidatePermissionCache();

    // Audit log
    await this.audit.log({
      eventType: 'PERMISSION_CREATED',
      targetType: 'PERMISSION',
      targetId: permission.id,
      newValue: permission,
      actorId: data.createdBy,
      correlationId,
    });

    return permission;
  }

  async updatePermission(
    id: string,
    data: Partial<{
      displayName: string;
      displayNamePl: string;
      description: string;
      descriptionPl: string;
      categoryId: string;
      isDangerous: boolean;
      requiresMfa: boolean;
      supportsConditions: boolean;
      allowedConditions: string[];
      dependsOn: string[];
      isActive: boolean;
    }>,
    actorId: string
  ) {
    const correlationId = uuidv4();

    const oldPermission = await this.db.permission.findUnique({
      where: { id },
    });

    const updated = await this.db.permission.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    // Invalidate all caches
    await this.invalidatePermissionCache();
    await this.invalidateAllUserPermissionCaches();

    // Audit log
    await this.audit.log({
      eventType: 'PERMISSION_UPDATED',
      targetType: 'PERMISSION',
      targetId: id,
      oldValue: oldPermission,
      newValue: updated,
      actorId,
      correlationId,
    });

    return updated;
  }

  async deletePermission(id: string, actorId: string) {
    const correlationId = uuidv4();

    const permission = await this.db.permission.findUnique({
      where: { id },
    });

    // Soft delete
    await this.db.permission.update({
      where: { id },
      data: { isActive: false },
    });

    // Remove from all roles and users
    await this.db.$transaction([
      this.db.rolePermission.deleteMany({
        where: { permissionId: id },
      }),
      this.db.userPermission.deleteMany({
        where: { permissionId: id },
      }),
    ]);

    // Invalidate caches
    await this.invalidatePermissionCache();
    await this.invalidateAllUserPermissionCaches();

    // Audit log
    await this.audit.log({
      eventType: 'PERMISSION_DELETED',
      targetType: 'PERMISSION',
      targetId: id,
      oldValue: permission,
      actorId,
      correlationId,
    });

    return { success: true };
  }

  // ==================== Permission Queries ====================

  async listPermissions(options: {
    module?: string;
    categoryId?: string;
    search?: string;
    includeInactive?: boolean;
    page: number;
    pageSize: number;
    organizationId?: string;
  }) {
    const where: any = {};

    if (!options.includeInactive) {
      where.isActive = true;
    }

    if (options.module) {
      where.module = options.module;
    }

    if (options.categoryId) {
      where.categoryId = options.categoryId;
    }

    if (options.search) {
      where.OR = [
        { resource: { contains: options.search, mode: 'insensitive' } },
        { action: { contains: options.search, mode: 'insensitive' } },
        { displayName: { contains: options.search, mode: 'insensitive' } },
        { displayNamePl: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [permissions, total] = await Promise.all([
      this.db.permission.findMany({
        where,
        include: {
          category: true,
        },
        orderBy: [
          { module: 'asc' },
          { resource: 'asc' },
          { action: 'asc' },
        ],
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
      }),
      this.db.permission.count({ where }),
    ]);

    return {
      permissions,
      pagination: {
        page: options.page,
        pageSize: options.pageSize,
        total,
        totalPages: Math.ceil(total / options.pageSize),
      },
    };
  }

  async getPermissionById(id: string) {
    return this.db.permission.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });
  }

  async getPermissionByKey(resource: string, action: string) {
    return this.db.permission.findFirst({
      where: { resource, action, isActive: true },
      include: {
        category: true,
      },
    });
  }

  async getPermissionsByIds(ids: string[]) {
    return this.db.permission.findMany({
      where: {
        id: { in: ids },
        isActive: true,
      },
    });
  }

  async getPermissionsGroupedByCategory(module?: string) {
    const where: any = { isActive: true };
    if (module) {
      where.module = module;
    }

    const permissions = await this.db.permission.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { resource: 'asc' },
        { action: 'asc' },
      ],
    });

    // Group by category
    const grouped = permissions.reduce((acc, perm) => {
      const categoryName = perm.category?.name || 'Uncategorized';
      if (!acc[categoryName]) {
        acc[categoryName] = {
          category: perm.category,
          permissions: [],
        };
      }
      acc[categoryName].permissions.push(perm);
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped);
  }

  async getModules() {
    const result = await this.db.permission.groupBy({
      by: ['module'],
      where: { isActive: true },
      _count: true,
    });

    return result.map(r => ({
      name: r.module,
      permissionCount: r._count,
    }));
  }

  // ==================== User Permission Management ====================

  async assignPermissionToUser(data: {
    userId: string;
    permissionId: string;
    permissionType: 'GRANT' | 'DENY';
    conditions?: Record<string, unknown>[];
    expiresAt?: Date;
    reason?: string;
    grantedBy: string;
  }) {
    const correlationId = uuidv4();

    // Check if assignment already exists
    const existing = await this.db.userPermission.findUnique({
      where: {
        userId_permissionId: {
          userId: data.userId,
          permissionId: data.permissionId,
        },
      },
    });

    let result;

    if (existing) {
      // Update existing
      result = await this.db.userPermission.update({
        where: { id: existing.id },
        data: {
          permissionType: data.permissionType,
          conditions: data.conditions || {},
          expiresAt: data.expiresAt,
          reason: data.reason,
          grantedBy: data.grantedBy,
          grantedAt: new Date(),
        },
        include: {
          permission: true,
        },
      });
    } else {
      // Create new
      result = await this.db.userPermission.create({
        data: {
          id: uuidv4(),
          userId: data.userId,
          permissionId: data.permissionId,
          permissionType: data.permissionType,
          conditions: data.conditions || {},
          expiresAt: data.expiresAt,
          reason: data.reason,
          grantedBy: data.grantedBy,
        },
        include: {
          permission: true,
        },
      });
    }

    // Invalidate user's permission cache
    await this.invalidateUserPermissionCache(data.userId);

    // Audit log
    await this.audit.log({
      eventType: existing ? 'USER_PERMISSION_UPDATED' : 'USER_PERMISSION_GRANTED',
      targetType: 'USER',
      targetId: data.userId,
      permissionId: data.permissionId,
      oldValue: existing,
      newValue: result,
      actorId: data.grantedBy,
      correlationId,
    });

    return result;
  }

  async revokePermissionFromUser(
    userId: string,
    permissionId: string,
    actorId: string
  ) {
    const correlationId = uuidv4();

    const existing = await this.db.userPermission.findUnique({
      where: {
        userId_permissionId: { userId, permissionId },
      },
      include: {
        permission: true,
      },
    });

    if (!existing) {
      return { success: false, message: 'Przypisanie nie istnieje' };
    }

    await this.db.userPermission.delete({
      where: { id: existing.id },
    });

    // Invalidate user's permission cache
    await this.invalidateUserPermissionCache(userId);

    // Audit log
    await this.audit.log({
      eventType: 'USER_PERMISSION_REVOKED',
      targetType: 'USER',
      targetId: userId,
      permissionId,
      oldValue: existing,
      actorId,
      correlationId,
    });

    return { success: true };
  }

  async getUserDirectPermissions(userId: string) {
    return this.db.userPermission.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        permission: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        grantedAt: 'desc',
      },
    });
  }

  // ==================== Effective Permissions ====================

  async getUserEffectivePermissions(
    userId: string,
    groupBySource: boolean = false
  ): Promise<EffectivePermission[]> {
    // Try cache first
    const cacheKey = `${this.CACHE_PREFIX}user:${userId}:effective`;
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      const permissions = JSON.parse(cached);
      return groupBySource ? this.groupPermissionsBySource(permissions) : permissions;
    }

    // Get role-based permissions
    const rolePermissions = await this.db.$queryRaw<EffectivePermission[]>`
      SELECT DISTINCT
        p.id as "permissionId",
        p.resource,
        p.action,
        CONCAT(p.resource, '.', p.action) as "permissionKey",
        'role' as source,
        r.id as "sourceId",
        r.name as "sourceName",
        NULL as conditions,
        COALESCE(rpo.override_type = 'DENY', false) as "isDenied"
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      JOIN role_hierarchy rh ON rh.ancestor_role_id = r.id
      JOIN role_permissions rp ON rp.role_id = rh.descendant_role_id
      JOIN permissions p ON p.id = rp.permission_id
      LEFT JOIN role_permission_overrides rpo ON rpo.role_id = r.id AND rpo.permission_id = p.id
      WHERE ur.user_id = ${userId}::uuid
        AND ur.is_active = true
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        AND r.is_active = true
        AND p.is_active = true
    `;

    // Get direct user permissions
    const directPermissions = await this.db.$queryRaw<EffectivePermission[]>`
      SELECT
        p.id as "permissionId",
        p.resource,
        p.action,
        CONCAT(p.resource, '.', p.action) as "permissionKey",
        'direct' as source,
        up.id as "sourceId",
        'Direct Assignment' as "sourceName",
        up.conditions,
        (up.permission_type = 'DENY') as "isDenied"
      FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = ${userId}::uuid
        AND (up.expires_at IS NULL OR up.expires_at > NOW())
        AND p.is_active = true
    `;

    // Merge permissions (direct overrides role)
    const permissionMap = new Map<string, EffectivePermission>();

    // Add role permissions first
    for (const perm of rolePermissions) {
      permissionMap.set(perm.permissionKey, perm);
    }

    // Override with direct permissions
    for (const perm of directPermissions) {
      permissionMap.set(perm.permissionKey, perm);
    }

    // Expand wildcards
    const allPermissions = Array.from(permissionMap.values());
    const expandedPermissions = await this.expandWildcardPermissions(allPermissions);

    // Cache result
    await this.cache.setex(
      cacheKey,
      this.USER_PERMISSIONS_TTL,
      JSON.stringify(expandedPermissions)
    );

    return groupBySource
      ? this.groupPermissionsBySource(expandedPermissions)
      : expandedPermissions;
  }

  private async expandWildcardPermissions(
    permissions: EffectivePermission[]
  ): Promise<EffectivePermission[]> {
    const result: EffectivePermission[] = [];
    const wildcards: EffectivePermission[] = [];

    for (const perm of permissions) {
      if (perm.action === '*') {
        wildcards.push(perm);
      } else {
        result.push(perm);
      }
    }

    // Expand wildcards
    for (const wildcard of wildcards) {
      const resourcePermissions = await this.db.permission.findMany({
        where: {
          resource: wildcard.resource,
          isActive: true,
        },
      });

      for (const p of resourcePermissions) {
        const key = `${p.resource}.${p.action}`;
        if (!result.some(r => r.permissionKey === key)) {
          result.push({
            ...wildcard,
            permissionId: p.id,
            action: p.action,
            permissionKey: key,
          });
        }
      }
    }

    return result;
  }

  private groupPermissionsBySource(
    permissions: EffectivePermission[]
  ): Record<string, EffectivePermission[]> {
    return permissions.reduce((acc, perm) => {
      const key = `${perm.source}:${perm.sourceId}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(perm);
      return acc;
    }, {} as Record<string, EffectivePermission[]>);
  }

  // ==================== Permission Checking ====================

  async checkPermission(
    userId: string,
    resource: string,
    action: string,
    context?: Record<string, unknown>
  ): Promise<PermissionCheckResult> {
    const startTime = Date.now();

    // Get user's effective permissions (cached)
    const permissions = await this.getUserEffectivePermissions(userId);
    const cacheHit = Date.now() - startTime < 5; // Assume cache hit if < 5ms

    // Check for exact match
    const permissionKey = `${resource}.${action}`;
    const exactMatch = permissions.find(p => p.permissionKey === permissionKey);

    if (exactMatch) {
      if (exactMatch.isDenied) {
        return {
          allowed: false,
          reason: 'Uprawnienie zostało jawnie zabronione',
          source: 'denied',
          checkedAt: new Date(),
          cacheHit,
        };
      }

      // Check conditions if any
      if (exactMatch.conditions && context) {
        const conditionResult = this.evaluateConditions(
          exactMatch.conditions as Record<string, unknown>[],
          context
        );
        if (!conditionResult.passed) {
          return {
            allowed: false,
            reason: conditionResult.reason,
            source: exactMatch.source,
            checkedAt: new Date(),
            cacheHit,
          };
        }
      }

      return {
        allowed: true,
        source: exactMatch.source,
        checkedAt: new Date(),
        cacheHit,
      };
    }

    // Check for wildcard match
    const wildcardKey = `${resource}.*`;
    const wildcardMatch = permissions.find(p => p.permissionKey === wildcardKey);

    if (wildcardMatch && !wildcardMatch.isDenied) {
      return {
        allowed: true,
        source: wildcardMatch.source,
        checkedAt: new Date(),
        cacheHit,
      };
    }

    // No permission found
    return {
      allowed: false,
      reason: 'Brak wymaganego uprawnienia',
      checkedAt: new Date(),
      cacheHit,
    };
  }

  async checkMultiplePermissions(
    userId: string,
    permissionsToCheck: Array<{ resource: string; action: string }>,
    mode: 'all' | 'any'
  ): Promise<{
    allowed: boolean;
    results: Array<{ resource: string; action: string; allowed: boolean }>;
  }> {
    const results = await Promise.all(
      permissionsToCheck.map(async ({ resource, action }) => {
        const result = await this.checkPermission(userId, resource, action);
        return { resource, action, allowed: result.allowed };
      })
    );

    const allowed = mode === 'all'
      ? results.every(r => r.allowed)
      : results.some(r => r.allowed);

    return { allowed, results };
  }

  private evaluateConditions(
    conditions: Record<string, unknown>[],
    context: Record<string, unknown>
  ): { passed: boolean; reason?: string } {
    for (const condition of conditions) {
      switch (condition.type) {
        case 'own_organization':
          if (context.organizationId !== context.userOrganizationId) {
            return {
              passed: false,
              reason: 'Dostęp ograniczony do własnej organizacji',
            };
          }
          break;

        case 'own_records':
          if (context.ownerId !== context.userId) {
            return {
              passed: false,
              reason: 'Dostęp ograniczony do własnych rekordów',
            };
          }
          break;

        case 'department':
          if (context.departmentId !== context.userDepartmentId) {
            return {
              passed: false,
              reason: 'Dostęp ograniczony do własnego działu',
            };
          }
          break;

        case 'custom':
          // Custom condition evaluation
          if (!this.evaluateCustomCondition(condition.value as Record<string, unknown>, context)) {
            return {
              passed: false,
              reason: 'Warunek niestandardowy nie został spełniony',
            };
          }
          break;
      }
    }

    return { passed: true };
  }

  private evaluateCustomCondition(
    condition: Record<string, unknown>,
    context: Record<string, unknown>
  ): boolean {
    // Implement custom condition logic
    // This could be a simple field comparison or more complex logic
    const { field, operator, value } = condition;
    const contextValue = context[field as string];

    switch (operator) {
      case 'eq':
        return contextValue === value;
      case 'neq':
        return contextValue !== value;
      case 'in':
        return Array.isArray(value) && value.includes(contextValue);
      case 'contains':
        return typeof contextValue === 'string' && contextValue.includes(value as string);
      default:
        return false;
    }
  }

  // ==================== Bulk Operations ====================

  async bulkAssignPermissions(data: {
    targetType: 'role' | 'user';
    targetId: string;
    permissionIds: string[];
    operation: 'add' | 'remove';
    actorId: string;
  }) {
    const correlationId = uuidv4();

    await this.db.$transaction(async (tx) => {
      if (data.targetType === 'role') {
        if (data.operation === 'add') {
          await tx.rolePermission.createMany({
            data: data.permissionIds.map(permissionId => ({
              roleId: data.targetId,
              permissionId,
            })),
            skipDuplicates: true,
          });
        } else {
          await tx.rolePermission.deleteMany({
            where: {
              roleId: data.targetId,
              permissionId: { in: data.permissionIds },
            },
          });
        }
      } else {
        if (data.operation === 'add') {
          await tx.userPermission.createMany({
            data: data.permissionIds.map(permissionId => ({
              id: uuidv4(),
              userId: data.targetId,
              permissionId,
              permissionType: 'GRANT',
              grantedBy: data.actorId,
            })),
            skipDuplicates: true,
          });
        } else {
          await tx.userPermission.deleteMany({
            where: {
              userId: data.targetId,
              permissionId: { in: data.permissionIds },
            },
          });
        }
      }
    });

    // Invalidate caches
    if (data.targetType === 'user') {
      await this.invalidateUserPermissionCache(data.targetId);
    } else {
      // For roles, invalidate all users with that role
      await this.invalidateRoleUsersCaches(data.targetId);
    }

    // Audit log
    await this.audit.log({
      eventType: `BULK_PERMISSIONS_${data.operation.toUpperCase()}`,
      targetType: data.targetType.toUpperCase() as 'ROLE' | 'USER',
      targetId: data.targetId,
      newValue: {
        permissionIds: data.permissionIds,
        operation: data.operation,
      },
      actorId: data.actorId,
      correlationId,
    });

    return { success: true, count: data.permissionIds.length };
  }

  // ==================== Templates ====================

  async getTemplates() {
    return this.db.permissionTemplate.findMany({
      where: { isActive: true },
      orderBy: { displayName: 'asc' },
    });
  }

  async applyTemplateToRole(
    templateId: string,
    roleId: string,
    merge: boolean,
    actorId: string
  ) {
    const correlationId = uuidv4();

    const template = await this.db.permissionTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error('Szablon nie został znaleziony');
    }

    await this.db.$transaction(async (tx) => {
      // Clear existing if not merging
      if (!merge) {
        await tx.rolePermission.deleteMany({
          where: { roleId },
        });
      }

      // Add template permissions
      await tx.rolePermission.createMany({
        data: template.permissionIds.map(permissionId => ({
          roleId,
          permissionId,
        })),
        skipDuplicates: true,
      });

      // Update template usage count
      await tx.permissionTemplate.update({
        where: { id: templateId },
        data: { usageCount: { increment: 1 } },
      });
    });

    // Invalidate caches
    await this.invalidateRoleUsersCaches(roleId);

    // Audit log
    await this.audit.log({
      eventType: 'TEMPLATE_APPLIED',
      targetType: 'ROLE',
      targetId: roleId,
      newValue: {
        templateId,
        templateName: template.name,
        merge,
        permissionCount: template.permissionIds.length,
      },
      actorId,
      correlationId,
    });

    return { success: true, appliedCount: template.permissionIds.length };
  }

  // ==================== Utilities ====================

  async getPermissionUsage(permissionId: string) {
    const [roleCount, userCount] = await Promise.all([
      this.db.rolePermission.count({
        where: { permissionId },
      }),
      this.db.userPermission.count({
        where: { permissionId },
      }),
    ]);

    return { roleCount, userCount };
  }

  async getPermissionDependencies(permissionId: string) {
    const permission = await this.db.permission.findUnique({
      where: { id: permissionId },
      select: { dependsOn: true },
    });

    if (!permission || permission.dependsOn.length === 0) {
      return [];
    }

    return this.db.permission.findMany({
      where: {
        id: { in: permission.dependsOn },
      },
    });
  }

  async getCategories() {
    return this.db.permissionCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ==================== Cache Management ====================

  private async invalidatePermissionCache() {
    await this.cache.del(`${this.CACHE_PREFIX}registry`);
  }

  private async invalidateUserPermissionCache(userId: string) {
    const keys = await this.cache.keys(`${this.CACHE_PREFIX}user:${userId}:*`);
    if (keys.length > 0) {
      await this.cache.del(...keys);
    }
  }

  private async invalidateRoleUsersCaches(roleId: string) {
    // Get all users with this role
    const userRoles = await this.db.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    });

    // Invalidate each user's cache
    await Promise.all(
      userRoles.map(ur => this.invalidateUserPermissionCache(ur.userId))
    );
  }

  private async invalidateAllUserPermissionCaches() {
    const keys = await this.cache.keys(`${this.CACHE_PREFIX}user:*`);
    if (keys.length > 0) {
      await this.cache.del(...keys);
    }
  }
}
```

### React Permission Hook

```typescript
// src/hooks/usePermissions.ts
import { useMemo, useCallback } from 'react';
import { api } from '@/utils/api';
import { useSession } from './useSession';

interface Permission {
  permissionKey: string;
  resource: string;
  action: string;
  source: 'role' | 'direct';
  isDenied: boolean;
}

interface UsePermissionsResult {
  permissions: Permission[];
  isLoading: boolean;
  can: (resource: string, action: string) => boolean;
  canAny: (permissions: Array<{ resource: string; action: string }>) => boolean;
  canAll: (permissions: Array<{ resource: string; action: string }>) => boolean;
  canResource: (resource: string) => boolean;
  getResourcePermissions: (resource: string) => Permission[];
  refresh: () => void;
}

export function usePermissions(): UsePermissionsResult {
  const { session } = useSession();

  const {
    data: permissions = [],
    isLoading,
    refetch,
  } = api.permissions.getEffectivePermissions.useQuery(
    { userId: session?.userId ?? '', groupBySource: false },
    {
      enabled: !!session?.userId,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    }
  );

  // Build permission set for O(1) lookup
  const permissionSet = useMemo(() => {
    const set = new Set<string>();
    const deniedSet = new Set<string>();

    for (const perm of permissions) {
      if (perm.isDenied) {
        deniedSet.add(perm.permissionKey);
      } else {
        set.add(perm.permissionKey);
      }
    }

    return { allowed: set, denied: deniedSet };
  }, [permissions]);

  const can = useCallback((resource: string, action: string): boolean => {
    const key = `${resource}.${action}`;

    // Check explicit deny first
    if (permissionSet.denied.has(key)) {
      return false;
    }

    // Check exact permission
    if (permissionSet.allowed.has(key)) {
      return true;
    }

    // Check wildcard
    const wildcardKey = `${resource}.*`;
    return permissionSet.allowed.has(wildcardKey);
  }, [permissionSet]);

  const canAny = useCallback(
    (perms: Array<{ resource: string; action: string }>): boolean => {
      return perms.some(p => can(p.resource, p.action));
    },
    [can]
  );

  const canAll = useCallback(
    (perms: Array<{ resource: string; action: string }>): boolean => {
      return perms.every(p => can(p.resource, p.action));
    },
    [can]
  );

  const canResource = useCallback(
    (resource: string): boolean => {
      // Check if user has any permission for the resource
      return permissions.some(
        p => p.resource === resource && !p.isDenied
      );
    },
    [permissions]
  );

  const getResourcePermissions = useCallback(
    (resource: string): Permission[] => {
      return permissions.filter(p => p.resource === resource);
    },
    [permissions]
  );

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    permissions,
    isLoading,
    can,
    canAny,
    canAll,
    canResource,
    getResourcePermissions,
    refresh,
  };
}
```

### Permission Guard Component

```tsx
// src/components/auth/RequirePermission.tsx
import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface RequirePermissionProps {
  resource: string;
  action: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showDisabled?: boolean;
  disabledTooltip?: string;
}

export function RequirePermission({
  resource,
  action,
  children,
  fallback = null,
  showDisabled = false,
  disabledTooltip = 'Brak uprawnień',
}: RequirePermissionProps) {
  const { can, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  const hasPermission = can(resource, action);

  if (hasPermission) {
    return <>{children}</>;
  }

  if (showDisabled) {
    // Clone children and add disabled prop
    return (
      <div title={disabledTooltip} style={{ opacity: 0.5, cursor: 'not-allowed' }}>
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              disabled: true,
              onClick: (e: React.MouseEvent) => e.preventDefault(),
            } as any);
          }
          return child;
        })}
      </div>
    );
  }

  return <>{fallback}</>;
}

// For requiring any of multiple permissions
interface RequireAnyPermissionProps {
  permissions: Array<{ resource: string; action: string }>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireAnyPermission({
  permissions,
  children,
  fallback = null,
}: RequireAnyPermissionProps) {
  const { canAny, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  return canAny(permissions) ? <>{children}</> : <>{fallback}</>;
}

// For requiring all of multiple permissions
interface RequireAllPermissionsProps {
  permissions: Array<{ resource: string; action: string }>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireAllPermissions({
  permissions,
  children,
  fallback = null,
}: RequireAllPermissionsProps) {
  const { canAll, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  return canAll(permissions) ? <>{children}</> : <>{fallback}</>;
}
```

### NestJS Permission Guard

```typescript
// src/server/guards/permission.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '@/services/permission.service';
import { AuditLogger } from '@/services/audit.service';
import { v4 as uuidv4 } from 'uuid';

// Decorator for required permissions
export const PERMISSIONS_KEY = 'required_permissions';

export interface RequiredPermission {
  resource: string;
  action: string;
}

export const RequirePermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const RequirePermission = (resource: string, action: string) =>
  RequirePermissions({ resource, action });

// Decorator for permission check mode
export const PERMISSION_MODE_KEY = 'permission_mode';
export type PermissionMode = 'all' | 'any';

export const PermissionMode = (mode: PermissionMode) =>
  SetMetadata(PERMISSION_MODE_KEY, mode);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
    private readonly auditLogger: AuditLogger
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<RequiredPermission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permissions required
    }

    const mode = this.reflector.getAllAndOverride<PermissionMode>(
      PERMISSION_MODE_KEY,
      [context.getHandler(), context.getClass()]
    ) || 'all';

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Wymagane uwierzytelnienie');
    }

    const correlationId = uuidv4();

    // Check permissions based on mode
    const results = await this.permissionService.checkMultiplePermissions(
      user.id,
      requiredPermissions,
      mode
    );

    if (!results.allowed) {
      // Log denied access
      await this.auditLogger.log({
        eventType: 'ACCESS_DENIED',
        userId: user.id,
        metadata: {
          requiredPermissions,
          mode,
          results: results.results,
          endpoint: request.url,
          method: request.method,
        },
        correlationId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      const missingPermissions = results.results
        .filter(r => !r.allowed)
        .map(r => `${r.resource}.${r.action}`)
        .join(', ');

      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Brak wymaganych uprawnień',
        details: `Wymagane uprawnienia: ${missingPermissions}`,
      });
    }

    return true;
  }
}
```

---

## 🧪 Test Specifications

### Unit Tests

```typescript
// src/services/__tests__/permission.service.test.ts
import { PermissionService } from '../permission.service';
import { prismaMock } from '@/test/mocks/prisma';
import { redisMock } from '@/test/mocks/redis';
import { auditMock } from '@/test/mocks/audit';

describe('PermissionService', () => {
  let service: PermissionService;

  beforeEach(() => {
    service = new PermissionService(prismaMock, redisMock, auditMock);
    jest.clearAllMocks();
  });

  describe('createPermission', () => {
    it('should create a new permission', async () => {
      const input = {
        resource: 'invoices',
        action: 'export',
        displayName: 'Export Invoices',
        displayNamePl: 'Eksport faktur',
        module: 'ACC',
        createdBy: 'user-123',
      };

      prismaMock.permission.create.mockResolvedValue({
        id: 'perm-123',
        ...input,
        isActive: true,
        isSystem: false,
        isDangerous: false,
        requiresMfa: false,
        supportsConditions: false,
        allowedConditions: [],
        dependsOn: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createPermission(input);

      expect(result.resource).toBe('invoices');
      expect(result.action).toBe('export');
      expect(prismaMock.permission.create).toHaveBeenCalledTimes(1);
      expect(redisMock.del).toHaveBeenCalled(); // Cache invalidation
    });

    it('should reject invalid resource format', async () => {
      const input = {
        resource: 'Invalid Resource', // Invalid - contains space
        action: 'read',
        displayName: 'Read',
        displayNamePl: 'Odczyt',
        module: 'CRM',
        createdBy: 'user-123',
      };

      await expect(service.createPermission(input))
        .rejects.toThrow();
    });
  });

  describe('checkPermission', () => {
    it('should return allowed for exact permission match', async () => {
      redisMock.get.mockResolvedValue(JSON.stringify([
        { permissionKey: 'invoices.read', resource: 'invoices', action: 'read', isDenied: false },
      ]));

      const result = await service.checkPermission('user-123', 'invoices', 'read');

      expect(result.allowed).toBe(true);
      expect(result.cacheHit).toBe(true);
    });

    it('should return denied for missing permission', async () => {
      redisMock.get.mockResolvedValue(JSON.stringify([
        { permissionKey: 'invoices.read', resource: 'invoices', action: 'read', isDenied: false },
      ]));

      const result = await service.checkPermission('user-123', 'invoices', 'delete');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Brak wymaganego uprawnienia');
    });

    it('should honor explicit deny over grant', async () => {
      redisMock.get.mockResolvedValue(JSON.stringify([
        { permissionKey: 'invoices.delete', resource: 'invoices', action: 'delete', isDenied: true },
        { permissionKey: 'invoices.*', resource: 'invoices', action: '*', isDenied: false },
      ]));

      const result = await service.checkPermission('user-123', 'invoices', 'delete');

      expect(result.allowed).toBe(false);
      expect(result.source).toBe('denied');
    });

    it('should expand wildcard permissions', async () => {
      redisMock.get.mockResolvedValue(JSON.stringify([
        { permissionKey: 'invoices.*', resource: 'invoices', action: '*', isDenied: false },
      ]));

      const result = await service.checkPermission('user-123', 'invoices', 'export');

      expect(result.allowed).toBe(true);
    });

    it('should evaluate conditions correctly', async () => {
      redisMock.get.mockResolvedValue(JSON.stringify([
        {
          permissionKey: 'clients.read',
          resource: 'clients',
          action: 'read',
          isDenied: false,
          conditions: [{ type: 'own_organization' }],
        },
      ]));

      // Different organization
      const result = await service.checkPermission(
        'user-123',
        'clients',
        'read',
        { organizationId: 'org-2', userOrganizationId: 'org-1' }
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('własnej organizacji');
    });
  });

  describe('getUserEffectivePermissions', () => {
    it('should merge role and direct permissions', async () => {
      redisMock.get.mockResolvedValue(null); // Cache miss

      prismaMock.$queryRaw
        .mockResolvedValueOnce([ // Role permissions
          { permissionKey: 'invoices.read', source: 'role', isDenied: false },
        ])
        .mockResolvedValueOnce([ // Direct permissions
          { permissionKey: 'invoices.export', source: 'direct', isDenied: false },
        ]);

      prismaMock.permission.findMany.mockResolvedValue([]); // No wildcard expansion needed

      const result = await service.getUserEffectivePermissions('user-123');

      expect(result).toHaveLength(2);
      expect(result.some(p => p.permissionKey === 'invoices.read')).toBe(true);
      expect(result.some(p => p.permissionKey === 'invoices.export')).toBe(true);
    });

    it('should cache effective permissions', async () => {
      redisMock.get.mockResolvedValue(null);

      prismaMock.$queryRaw
        .mockResolvedValue([])
        .mockResolvedValue([]);

      await service.getUserEffectivePermissions('user-123');

      expect(redisMock.setex).toHaveBeenCalled();
    });
  });

  describe('bulkAssignPermissions', () => {
    it('should assign multiple permissions atomically', async () => {
      const input = {
        targetType: 'role' as const,
        targetId: 'role-123',
        permissionIds: ['perm-1', 'perm-2', 'perm-3'],
        operation: 'add' as const,
        actorId: 'admin-123',
      };

      prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
      prismaMock.rolePermission.createMany.mockResolvedValue({ count: 3 });

      const result = await service.bulkAssignPermissions(input);

      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'BULK_PERMISSIONS_ADD',
        })
      );
    });
  });
});
```

### Integration Tests

```typescript
// src/api/__tests__/permissions.integration.test.ts
import { createTestContext } from '@/test/context';
import { createCaller } from '@/server/api/root';

describe('Permissions API Integration', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let caller: ReturnType<typeof createCaller>;
  let adminCaller: ReturnType<typeof createCaller>;

  beforeAll(async () => {
    ctx = await createTestContext();
    caller = createCaller(ctx.userContext);
    adminCaller = createCaller(ctx.adminContext);
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('permission CRUD', () => {
    let createdPermissionId: string;

    it('should create permission as admin', async () => {
      const result = await adminCaller.permissions.create({
        resource: 'test_resource',
        action: 'test_action',
        displayName: 'Test Permission',
        displayNamePl: 'Testowe uprawnienie',
        module: 'TEST',
      });

      expect(result.id).toBeDefined();
      expect(result.resource).toBe('test_resource');
      createdPermissionId = result.id;
    });

    it('should list permissions with filtering', async () => {
      const result = await caller.permissions.list({
        module: 'TEST',
        page: 1,
        pageSize: 10,
      });

      expect(result.permissions.length).toBeGreaterThan(0);
      expect(result.permissions.some(p => p.id === createdPermissionId)).toBe(true);
    });

    it('should prevent non-admin from creating permissions', async () => {
      await expect(
        caller.permissions.create({
          resource: 'another_resource',
          action: 'read',
          displayName: 'Another',
          displayNamePl: 'Inne',
          module: 'TEST',
        })
      ).rejects.toThrow('FORBIDDEN');
    });

    it('should delete permission', async () => {
      await adminCaller.permissions.delete({ id: createdPermissionId });

      const permission = await caller.permissions.getById({ id: createdPermissionId });
      expect(permission?.isActive).toBe(false);
    });
  });

  describe('user permission assignment', () => {
    it('should assign direct permission to user', async () => {
      const permission = await ctx.createTestPermission('clients', 'export');

      await adminCaller.permissions.assignToUser({
        userId: ctx.testUser.id,
        permissionId: permission.id,
        permissionType: 'GRANT',
      });

      const userPermissions = await caller.permissions.getUserPermissions({
        userId: ctx.testUser.id,
      });

      expect(userPermissions.some(p => p.permission.id === permission.id)).toBe(true);
    });

    it('should check permission correctly', async () => {
      const result = await caller.permissions.check({
        userId: ctx.testUser.id,
        resource: 'clients',
        action: 'export',
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('permission templates', () => {
    it('should apply template to role', async () => {
      const template = await ctx.createTestTemplate('Accountant Template', [
        'invoices.read',
        'invoices.create',
        'clients.read',
      ]);

      const role = await ctx.createTestRole('TEST_ACCOUNTANT');

      await adminCaller.permissions.applyTemplate({
        templateId: template.id,
        roleId: role.id,
        merge: true,
      });

      // Verify permissions were applied
      const rolePermissions = await ctx.getRolePermissions(role.id);
      expect(rolePermissions).toHaveLength(3);
    });
  });
});
```

### E2E Tests

```typescript
// e2e/permissions.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsUser } from './helpers/auth';

test.describe('Permission Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display permission list with categories', async ({ page }) => {
    await page.goto('/admin/permissions');

    await expect(page.getByRole('heading', { name: 'Zarządzanie uprawnieniami' })).toBeVisible();

    // Check category accordion
    await expect(page.getByText('Moduł CRM')).toBeVisible();
    await expect(page.getByText('Moduł księgowy')).toBeVisible();
  });

  test('should create new permission', async ({ page }) => {
    await page.goto('/admin/permissions');
    await page.getByRole('button', { name: 'Dodaj uprawnienie' }).click();

    await page.getByLabel('Zasób').fill('reports');
    await page.getByLabel('Akcja').fill('generate');
    await page.getByLabel('Nazwa wyświetlana').fill('Generate Reports');
    await page.getByLabel('Nazwa polska').fill('Generowanie raportów');
    await page.getByLabel('Moduł').selectOption('ACC');

    await page.getByRole('button', { name: 'Zapisz' }).click();

    await expect(page.getByText('Uprawnienie zostało utworzone')).toBeVisible();
    await expect(page.getByText('reports.generate')).toBeVisible();
  });

  test('should assign permission to role', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.getByText('ACCOUNTANT').click();

    // Open permission assignment
    await page.getByRole('tab', { name: 'Uprawnienia' }).click();

    // Search and select permission
    await page.getByPlaceholder('Szukaj uprawnień').fill('export');
    await page.getByRole('checkbox', { name: 'invoices.export' }).check();

    await page.getByRole('button', { name: 'Zapisz zmiany' }).click();

    await expect(page.getByText('Uprawnienia zostały zaktualizowane')).toBeVisible();
  });

  test('should verify permission-based button visibility', async ({ page }) => {
    // Login as regular user without export permission
    await loginAsUser(page, 'regular.user@example.com');

    await page.goto('/invoices');

    // Export button should not be visible
    await expect(page.getByRole('button', { name: 'Eksportuj' })).not.toBeVisible();

    // Now login as user with export permission
    await loginAsUser(page, 'accountant@example.com');
    await page.goto('/invoices');

    // Export button should be visible
    await expect(page.getByRole('button', { name: 'Eksportuj' })).toBeVisible();
  });

  test('should show permission denied message', async ({ page }) => {
    await loginAsUser(page, 'regular.user@example.com');

    // Try to access admin page directly
    await page.goto('/admin/permissions');

    await expect(page.getByText('Brak uprawnień')).toBeVisible();
    await expect(page.getByText('Nie masz dostępu do tej strony')).toBeVisible();
  });
});
```

---

## 🔒 Security Checklist

- [x] Permissions validated against resource-action pattern
- [x] System permissions cannot be modified or deleted
- [x] Permission checks cached with short TTL (5 min)
- [x] Explicit deny takes precedence over allow
- [x] All permission changes logged with audit trail
- [x] Input sanitization for permission names
- [x] SQL injection prevention via parameterized queries
- [x] Permission check performance < 5ms (cached)
- [x] Wildcard permissions properly expanded
- [x] Conditional permissions evaluated securely
- [x] Permission UI doesn't leak hidden permissions
- [x] Bulk operations are atomic

---

## 📋 Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `PERMISSION_CREATED` | New permission added | permission details, creator |
| `PERMISSION_UPDATED` | Permission modified | old/new values, modifier |
| `PERMISSION_DELETED` | Permission removed | permission details, deleter |
| `USER_PERMISSION_GRANTED` | Direct permission assigned | user, permission, granter |
| `USER_PERMISSION_REVOKED` | Direct permission removed | user, permission, revoker |
| `BULK_PERMISSIONS_ADD` | Multiple permissions assigned | target, permissions, actor |
| `BULK_PERMISSIONS_REMOVE` | Multiple permissions removed | target, permissions, actor |
| `TEMPLATE_APPLIED` | Template applied to role | role, template, actor |
| `ACCESS_DENIED` | Permission check failed | user, resource, action, endpoint |

---

## 📝 Implementation Notes

1. **Permission Key Format**: `{resource}.{action}` - lowercase with underscores
2. **Wildcard Support**: `{resource}.*` grants all actions for resource
3. **Caching Strategy**: User permissions cached in Redis (5 min TTL)
4. **Deny Precedence**: Explicit DENY always wins over GRANT
5. **Condition Types**: `own_organization`, `own_records`, `department`, `custom`
6. **Performance Target**: Permission check < 2ms (cached), < 50ms (uncached)
7. **Template Usage**: Track template applications for analytics
8. **Dependency Validation**: Warn when assigning permission without dependencies

---

## 🔗 Related Stories

- **AIM-007**: RBAC Setup (prerequisite) - Role management
- **AIM-011**: Audit Logging - Permission change audit
- **AIM-012**: Security Events - Permission denial alerts

---

*Story created: December 2024*
*Last updated: December 2024*
