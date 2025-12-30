# Story: AAM-007 - Agent Permissions & Access Control

## Story Overview

| Field | Value |
|-------|-------|
| Story ID | AAM-007 |
| Epic | AI Agent Module (AAM) |
| Priority | P1 |
| Story Points | 5 |
| Sprint | Sprint 3 (Week 34) |
| Dependencies | AAM-001, AAM-004 |

## User Story

**As a** super admin
**I want to** configure fine-grained permissions for AI agents
**So that** I can control who can access agents and what data they can retrieve from platform modules

## Acceptance Criteria

### AC1: Access Level Configuration
```gherkin
Given I am configuring an agent
When I set the access level
Then I can choose between private, organization, or public
And the agent visibility should match the selected level
```

### AC2: Role-Based Access
```gherkin
Given I am configuring agent access
When I specify allowed roles
Then only users with those roles can interact with the agent
And other users should see "Access Denied" message
```

### AC3: User-Specific Access
```gherkin
Given I want to limit agent to specific users
When I add users to the allowed list
Then only those users can access the agent
And this takes precedence over role-based access
```

### AC4: Module Data Access
```gherkin
Given an agent has module integrations
When I configure data access permissions
Then I can specify which modules the agent can access
And set scope for each module (own data, assigned, all)
And the agent respects these boundaries when querying
```

### AC5: Rate Limiting
```gherkin
Given I want to prevent abuse
When I configure rate limits
Then I can set requests per time window
And users exceeding the limit receive throttle error
And limits reset after the time window
```

### AC6: Cost Limits
```gherkin
Given I want to control AI spending
When I set cost limits
Then I can define daily and monthly limits
And agent stops responding when limits are reached
And admin receives notification at 80% threshold
```

## Technical Specification

### Database Schema

```sql
-- Agent permissions (main configuration)
CREATE TABLE agent_permissions (
  permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  access_level VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
  allowed_roles JSONB DEFAULT '[]',
  allowed_users JSONB DEFAULT '[]',
  blocked_users JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id)
);

-- Module access configuration
CREATE TABLE agent_module_access (
  access_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  module_id VARCHAR(50) NOT NULL,
  module_name VARCHAR(100) NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]', -- ['read:clients', 'read:invoices']
  scope VARCHAR(20) NOT NULL DEFAULT 'OWN', -- OWN, ASSIGNED, ALL
  data_filters JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, module_id)
);

-- Rate limit configuration
CREATE TABLE agent_rate_limits (
  rate_limit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  requests_limit INTEGER NOT NULL DEFAULT 100,
  window_seconds INTEGER NOT NULL DEFAULT 3600,
  burst_limit INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id)
);

-- Cost limits
CREATE TABLE agent_cost_limits (
  cost_limit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  daily_limit_usd DECIMAL(10,2),
  monthly_limit_usd DECIMAL(10,2),
  alert_threshold_percent INTEGER DEFAULT 80,
  action_on_exceed VARCHAR(20) DEFAULT 'BLOCK', -- BLOCK, WARN, NOTIFY
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id)
);

-- Rate limit tracking (Redis preferred, DB fallback)
CREATE TABLE agent_rate_limit_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  user_id UUID NOT NULL REFERENCES users(id),
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 1,
  last_request_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, user_id, window_start)
);

-- Cost tracking
CREATE TABLE agent_cost_tracking (
  tracking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  period_type VARCHAR(10) NOT NULL, -- DAILY, MONTHLY
  period_start DATE NOT NULL,
  total_cost_usd DECIMAL(10,4) DEFAULT 0,
  request_count INTEGER DEFAULT 0,
  token_count INTEGER DEFAULT 0,
  limit_exceeded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, period_type, period_start)
);

-- Indexes
CREATE INDEX idx_permissions_agent ON agent_permissions(agent_id);
CREATE INDEX idx_module_access_agent ON agent_module_access(agent_id);
CREATE INDEX idx_rate_limits_agent ON agent_rate_limits(agent_id);
CREATE INDEX idx_cost_limits_agent ON agent_cost_limits(agent_id);
CREATE INDEX idx_rate_log_agent_user ON agent_rate_limit_log(agent_id, user_id, window_start);
CREATE INDEX idx_cost_tracking_agent ON agent_cost_tracking(agent_id, period_type, period_start);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Access level
export const accessLevelSchema = z.enum(['PRIVATE', 'ORGANIZATION', 'PUBLIC']);

// Module scope
export const moduleScopeSchema = z.enum(['OWN', 'ASSIGNED', 'ALL']);

// Permission configuration
export const permissionConfigSchema = z.object({
  accessLevel: accessLevelSchema,
  allowedRoles: z.array(z.string()).default([]),
  allowedUsers: z.array(z.string().uuid()).default([]),
  blockedUsers: z.array(z.string().uuid()).default([]),
});

// Module access configuration
export const moduleAccessSchema = z.object({
  moduleId: z.string().min(1).max(50),
  moduleName: z.string().min(1).max(100),
  permissions: z.array(z.string()),
  scope: moduleScopeSchema,
  dataFilters: z.record(z.any()).optional(),
  enabled: z.boolean().default(true),
});

// Rate limit configuration
export const rateLimitSchema = z.object({
  requestsLimit: z.number().int().min(1).max(10000).default(100),
  windowSeconds: z.number().int().min(60).max(86400).default(3600),
  burstLimit: z.number().int().min(1).max(100).optional(),
});

// Cost limit configuration
export const costLimitSchema = z.object({
  dailyLimitUsd: z.number().min(0).max(10000).optional(),
  monthlyLimitUsd: z.number().min(0).max(100000).optional(),
  alertThresholdPercent: z.number().int().min(50).max(99).default(80),
  actionOnExceed: z.enum(['BLOCK', 'WARN', 'NOTIFY']).default('BLOCK'),
});

// Full permissions update
export const updatePermissionsSchema = z.object({
  permissions: permissionConfigSchema.optional(),
  moduleAccess: z.array(moduleAccessSchema).optional(),
  rateLimit: rateLimitSchema.optional(),
  costLimit: costLimitSchema.optional(),
});

// Access check result
export const accessCheckResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
  rateLimitRemaining: z.number().optional(),
  costRemaining: z.object({
    daily: z.number().optional(),
    monthly: z.number().optional(),
  }).optional(),
});

export type AccessLevel = z.infer<typeof accessLevelSchema>;
export type ModuleScope = z.infer<typeof moduleScopeSchema>;
export type PermissionConfig = z.infer<typeof permissionConfigSchema>;
export type ModuleAccess = z.infer<typeof moduleAccessSchema>;
export type RateLimit = z.infer<typeof rateLimitSchema>;
export type CostLimit = z.infer<typeof costLimitSchema>;
export type UpdatePermissions = z.infer<typeof updatePermissionsSchema>;
export type AccessCheckResult = z.infer<typeof accessCheckResultSchema>;
```

### Service Implementation

```typescript
import { Injectable, ForbiddenException, TooManyRequestsException } from '@nestjs/common';
import { PermissionRepository } from '../repositories/permission.repository';
import { RateLimitService } from './rate-limit.service';
import { CostTrackingService } from './cost-tracking.service';
import { AuditService } from '../../audit/audit.service';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class AgentPermissionService {
  constructor(
    private readonly permissionRepo: PermissionRepository,
    private readonly rateLimitService: RateLimitService,
    private readonly costTrackingService: CostTrackingService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  async checkAccess(
    tenantId: string,
    userId: string,
    userRoles: string[],
    agentId: string,
  ): Promise<AccessCheckResult> {
    const permissions = await this.permissionRepo.getAgentPermissions(
      tenantId,
      agentId,
    );

    if (!permissions) {
      return { allowed: false, reason: 'Agent nie został znaleziony' };
    }

    // Check if user is blocked
    if (permissions.blockedUsers.includes(userId)) {
      return { allowed: false, reason: 'Dostęp zablokowany' };
    }

    // Check access level
    const accessAllowed = await this.checkAccessLevel(
      permissions,
      userId,
      userRoles,
      tenantId,
    );

    if (!accessAllowed.allowed) {
      return accessAllowed;
    }

    // Check rate limit
    const rateLimitCheck = await this.checkRateLimit(tenantId, agentId, userId);
    if (!rateLimitCheck.allowed) {
      return rateLimitCheck;
    }

    // Check cost limit
    const costLimitCheck = await this.checkCostLimit(tenantId, agentId);
    if (!costLimitCheck.allowed) {
      return costLimitCheck;
    }

    return {
      allowed: true,
      rateLimitRemaining: rateLimitCheck.remaining,
      costRemaining: costLimitCheck.remaining,
    };
  }

  private async checkAccessLevel(
    permissions: AgentPermissions,
    userId: string,
    userRoles: string[],
    tenantId: string,
  ): Promise<AccessCheckResult> {
    switch (permissions.accessLevel) {
      case 'PRIVATE':
        // Only creator or allowed users
        if (
          permissions.allowedUsers.length > 0 &&
          !permissions.allowedUsers.includes(userId)
        ) {
          return { allowed: false, reason: 'Brak dostępu do tego agenta' };
        }
        break;

      case 'ORGANIZATION':
        // Check roles if specified
        if (permissions.allowedRoles.length > 0) {
          const hasRole = permissions.allowedRoles.some(role =>
            userRoles.includes(role),
          );
          if (!hasRole && !permissions.allowedUsers.includes(userId)) {
            return { allowed: false, reason: 'Brak wymaganej roli' };
          }
        }
        break;

      case 'PUBLIC':
        // Open to all authenticated users
        break;
    }

    return { allowed: true };
  }

  private async checkRateLimit(
    tenantId: string,
    agentId: string,
    userId: string,
  ): Promise<AccessCheckResult & { remaining?: number }> {
    const config = await this.permissionRepo.getRateLimitConfig(tenantId, agentId);

    if (!config) {
      return { allowed: true };
    }

    const result = await this.rateLimitService.checkAndIncrement({
      key: `agent:${agentId}:user:${userId}`,
      limit: config.requestsLimit,
      windowSeconds: config.windowSeconds,
      burstLimit: config.burstLimit,
    });

    if (!result.allowed) {
      return {
        allowed: false,
        reason: `Przekroczono limit zapytań. Spróbuj ponownie za ${result.retryAfterSeconds} sekund.`,
      };
    }

    return {
      allowed: true,
      remaining: result.remaining,
    };
  }

  private async checkCostLimit(
    tenantId: string,
    agentId: string,
  ): Promise<AccessCheckResult & { remaining?: { daily?: number; monthly?: number } }> {
    const config = await this.permissionRepo.getCostLimitConfig(tenantId, agentId);

    if (!config || (!config.dailyLimitUsd && !config.monthlyLimitUsd)) {
      return { allowed: true };
    }

    const usage = await this.costTrackingService.getCurrentUsage(tenantId, agentId);

    // Check daily limit
    if (config.dailyLimitUsd && usage.dailyCost >= config.dailyLimitUsd) {
      if (config.actionOnExceed === 'BLOCK') {
        return {
          allowed: false,
          reason: 'Przekroczono dzienny limit kosztów dla tego agenta',
        };
      }
    }

    // Check monthly limit
    if (config.monthlyLimitUsd && usage.monthlyCost >= config.monthlyLimitUsd) {
      if (config.actionOnExceed === 'BLOCK') {
        return {
          allowed: false,
          reason: 'Przekroczono miesięczny limit kosztów dla tego agenta',
        };
      }
    }

    // Check alert threshold
    await this.checkAndSendAlerts(config, usage, agentId);

    return {
      allowed: true,
      remaining: {
        daily: config.dailyLimitUsd
          ? Math.max(0, config.dailyLimitUsd - usage.dailyCost)
          : undefined,
        monthly: config.monthlyLimitUsd
          ? Math.max(0, config.monthlyLimitUsd - usage.monthlyCost)
          : undefined,
      },
    };
  }

  async validateModuleAccess(
    tenantId: string,
    agentId: string,
    moduleId: string,
    userId: string,
    resourceOwnerId?: string,
  ): Promise<boolean> {
    const moduleAccess = await this.permissionRepo.getModuleAccess(
      tenantId,
      agentId,
      moduleId,
    );

    if (!moduleAccess || !moduleAccess.enabled) {
      return false;
    }

    // Check scope
    switch (moduleAccess.scope) {
      case 'OWN':
        return resourceOwnerId === userId;

      case 'ASSIGNED':
        // Check if user is assigned to the resource
        return this.checkAssignment(tenantId, userId, moduleId, resourceOwnerId);

      case 'ALL':
        return true;
    }

    return false;
  }

  async updatePermissions(
    tenantId: string,
    userId: string,
    agentId: string,
    input: UpdatePermissions,
  ): Promise<void> {
    if (input.permissions) {
      await this.permissionRepo.upsertPermissions(tenantId, agentId, input.permissions);
    }

    if (input.moduleAccess) {
      await this.permissionRepo.upsertModuleAccess(tenantId, agentId, input.moduleAccess);
    }

    if (input.rateLimit) {
      await this.permissionRepo.upsertRateLimit(tenantId, agentId, input.rateLimit);
    }

    if (input.costLimit) {
      await this.permissionRepo.upsertCostLimit(tenantId, agentId, input.costLimit);
    }

    await this.auditService.log({
      tenantId,
      userId,
      action: 'AGENT_PERMISSIONS_UPDATED',
      entityType: 'agent',
      entityId: agentId,
      metadata: {
        updatedSections: Object.keys(input).filter(k => input[k] !== undefined),
      },
    });
  }

  async getPermissions(
    tenantId: string,
    agentId: string,
  ): Promise<FullPermissionConfig> {
    const [permissions, moduleAccess, rateLimit, costLimit] = await Promise.all([
      this.permissionRepo.getAgentPermissions(tenantId, agentId),
      this.permissionRepo.getAllModuleAccess(tenantId, agentId),
      this.permissionRepo.getRateLimitConfig(tenantId, agentId),
      this.permissionRepo.getCostLimitConfig(tenantId, agentId),
    ]);

    return {
      permissions: permissions || {
        accessLevel: 'PRIVATE',
        allowedRoles: [],
        allowedUsers: [],
        blockedUsers: [],
      },
      moduleAccess: moduleAccess || [],
      rateLimit: rateLimit || {
        requestsLimit: 100,
        windowSeconds: 3600,
      },
      costLimit,
    };
  }

  private async checkAndSendAlerts(
    config: CostLimit,
    usage: CostUsage,
    agentId: string,
  ): Promise<void> {
    const thresholdPercent = config.alertThresholdPercent / 100;

    // Daily alert
    if (
      config.dailyLimitUsd &&
      usage.dailyCost >= config.dailyLimitUsd * thresholdPercent &&
      !usage.dailyAlertSent
    ) {
      await this.notificationService.sendAdminNotification({
        type: 'AGENT_COST_ALERT',
        title: 'Zbliżasz się do dziennego limitu kosztów',
        message: `Agent osiągnął ${Math.round(
          (usage.dailyCost / config.dailyLimitUsd) * 100,
        )}% dziennego limitu kosztów.`,
        metadata: { agentId, period: 'daily', usage: usage.dailyCost },
      });
      await this.costTrackingService.markAlertSent(agentId, 'DAILY');
    }

    // Monthly alert
    if (
      config.monthlyLimitUsd &&
      usage.monthlyCost >= config.monthlyLimitUsd * thresholdPercent &&
      !usage.monthlyAlertSent
    ) {
      await this.notificationService.sendAdminNotification({
        type: 'AGENT_COST_ALERT',
        title: 'Zbliżasz się do miesięcznego limitu kosztów',
        message: `Agent osiągnął ${Math.round(
          (usage.monthlyCost / config.monthlyLimitUsd) * 100,
        )}% miesięcznego limitu kosztów.`,
        metadata: { agentId, period: 'monthly', usage: usage.monthlyCost },
      });
      await this.costTrackingService.markAlertSent(agentId, 'MONTHLY');
    }
  }

  private async checkAssignment(
    tenantId: string,
    userId: string,
    moduleId: string,
    resourceOwnerId?: string,
  ): Promise<boolean> {
    // Implementation depends on module-specific assignment logic
    // e.g., check if user is assigned to client in CRM module
    return false;
  }
}
```

### Access Control Middleware

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { AgentPermissionService } from './agent-permission.service';

@Injectable()
export class AgentAccessMiddleware implements NestMiddleware {
  constructor(private readonly permissionService: AgentPermissionService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const agentId = req.params.agentId || req.body.agentId;

    if (!agentId) {
      return next();
    }

    const { tenantId, userId, roles } = req.user;

    const accessResult = await this.permissionService.checkAccess(
      tenantId,
      userId,
      roles,
      agentId,
    );

    if (!accessResult.allowed) {
      throw new ForbiddenException(accessResult.reason);
    }

    // Attach remaining limits to request for potential UI display
    req.agentAccess = {
      rateLimitRemaining: accessResult.rateLimitRemaining,
      costRemaining: accessResult.costRemaining,
    };

    next();
  }
}
```

### tRPC Router

```typescript
export const agentPermissionRouter = router({
  // Get agent permissions
  getPermissions: superAdminProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.agentPermissionService.getPermissions(
        ctx.tenantId,
        input.agentId,
      );
    }),

  // Update permissions
  updatePermissions: superAdminProcedure
    .input(z.object({
      agentId: z.string().uuid(),
      ...updatePermissionsSchema.shape,
    }))
    .mutation(async ({ ctx, input }) => {
      const { agentId, ...permissions } = input;
      await ctx.agentPermissionService.updatePermissions(
        ctx.tenantId,
        ctx.userId,
        agentId,
        permissions,
      );
      return { success: true };
    }),

  // Check access (for testing)
  checkAccess: protectedProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.agentPermissionService.checkAccess(
        ctx.tenantId,
        ctx.userId,
        ctx.roles,
        input.agentId,
      );
    }),

  // Get current usage
  getUsage: superAdminProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.costTrackingService.getCurrentUsage(
        ctx.tenantId,
        input.agentId,
      );
    }),
});
```

## Test Specification

### Unit Tests

```typescript
describe('AgentPermissionService', () => {
  describe('checkAccess', () => {
    it('should allow access for allowed user', async () => {
      const result = await service.checkAccess(
        'tenant-1',
        'allowed-user',
        ['user'],
        'agent-1',
      );

      expect(result.allowed).toBe(true);
    });

    it('should deny access for blocked user', async () => {
      const result = await service.checkAccess(
        'tenant-1',
        'blocked-user',
        ['admin'],
        'agent-1',
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Dostęp zablokowany');
    });

    it('should enforce role-based access', async () => {
      const result = await service.checkAccess(
        'tenant-1',
        'user-1',
        ['viewer'],
        'agent-with-role-restriction',
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Brak wymaganej roli');
    });

    it('should enforce rate limits', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 100; i++) {
        await service.checkAccess('tenant-1', 'user-1', ['user'], 'agent-1');
      }

      const result = await service.checkAccess(
        'tenant-1',
        'user-1',
        ['user'],
        'agent-1',
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Przekroczono limit');
    });
  });

  describe('validateModuleAccess', () => {
    it('should allow OWN scope for resource owner', async () => {
      const result = await service.validateModuleAccess(
        'tenant-1',
        'agent-1',
        'crm',
        'user-1',
        'user-1', // resource owner
      );

      expect(result).toBe(true);
    });

    it('should deny OWN scope for non-owner', async () => {
      const result = await service.validateModuleAccess(
        'tenant-1',
        'agent-1',
        'crm',
        'user-1',
        'user-2', // different owner
      );

      expect(result).toBe(false);
    });
  });
});
```

## Security Checklist

- [x] Access level strictly enforced
- [x] Blocked users cannot access agent
- [x] Role checks performed before access
- [x] Module scope restrictions applied
- [x] Rate limiting prevents abuse
- [x] Cost limits prevent runaway spending
- [x] All access attempts logged
- [x] Admin alerts for threshold breaches

## Audit Events

| Event | Description | Data |
|-------|-------------|------|
| AGENT_PERMISSIONS_UPDATED | Permissions changed | agentId, updatedSections |
| AGENT_ACCESS_DENIED | Access attempt denied | agentId, userId, reason |
| AGENT_RATE_LIMITED | User rate limited | agentId, userId, retryAfter |
| AGENT_COST_LIMIT_REACHED | Cost limit exceeded | agentId, period, amount |
| AGENT_COST_ALERT | Cost threshold alert | agentId, period, percentage |

## Definition of Done

- [x] Access level configuration working
- [x] Role-based access control implemented
- [x] User-specific access lists working
- [x] Module data access scopes enforced
- [x] Rate limiting implemented
- [x] Cost limits and alerts working
- [x] Unit test coverage ≥ 80%
- [x] Security review completed
- [x] Documentation updated
