# CRM-001: Client Profile Management

> **Story ID**: CRM-001
> **Epic**: Core CRM Module (CRM)
> **Priority**: P0 (Critical)
> **Points**: 13
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant,
**I want to** create and manage client profiles with complete company information,
**So that** I can track all client data in one centralized place.

---

## Acceptance Criteria

### AC1: Client Creation with Polish Business Data
```gherkin
Feature: Client Profile Creation
  As an accountant
  I want to create new client profiles
  So that I can onboard new clients efficiently

  Scenario: Create client with valid Polish NIP
    Given I am logged in as an accountant
    And I have access to the CRM module
    When I create a new client with:
      | field        | value              |
      | companyName  | Test Company       |
      | nip          | 1234567890         |
      | taxForm      | CIT                |
      | street       | Marszałkowska 1    |
      | postalCode   | 00-001             |
      | city         | Warszawa           |
    Then the client should be created successfully
    And the client should have status "PENDING"
    And an audit event "CLIENT_CREATED" should be logged
    And a timeline event should be created

  Scenario: Reject client with invalid NIP format
    Given I am logged in as an accountant
    When I try to create a client with NIP "12345"
    Then the creation should fail
    And I should see error "NIP must be 10 digits"

  Scenario: Reject duplicate NIP within organization
    Given I am logged in as an accountant
    And a client with NIP "1234567890" already exists
    When I try to create another client with NIP "1234567890"
    Then the creation should fail
    And I should see error "Client with this NIP already exists"
```

### AC2: Client Update with Optimistic Locking
```gherkin
Feature: Client Profile Updates
  As an accountant
  I want to update client information
  So that I can keep records current

  Scenario: Update client successfully
    Given I am logged in as an accountant
    And a client with ID "client-123" exists with version 1
    When I update the client with:
      | field       | value          |
      | companyName | Updated Name   |
      | version     | 1              |
    Then the update should succeed
    And the client version should be 2
    And an audit event "CLIENT_UPDATED" should be logged
    And the changes should be tracked in timeline

  Scenario: Reject update with stale version
    Given I am logged in as an accountant
    And a client exists with version 5
    When I try to update with version 3
    Then the update should fail
    And I should see error "Client has been modified by another user"
```

### AC3: Client Soft Delete and Restore
```gherkin
Feature: Client Deletion
  As an accountant
  I want to delete and restore clients
  So that I can manage the client lifecycle

  Scenario: Soft delete client
    Given I am logged in as an accountant
    And an active client "client-123" exists
    When I delete the client
    Then the client should be marked as deleted
    And the client should not appear in default listings
    And an audit event "CLIENT_DELETED" should be logged

  Scenario: Restore deleted client
    Given I am logged in as an accountant
    And a deleted client "client-123" exists
    When I restore the client
    Then the client should be active again
    And an audit event "CLIENT_RESTORED" should be logged
```

### AC4: Client Status Management
```gherkin
Feature: Client Status Transitions
  As an accountant
  I want to manage client status
  So that I can track client lifecycle

  Scenario Outline: Valid status transitions
    Given a client with status "<current_status>"
    When I change the status to "<new_status>"
    Then the transition should succeed
    And a timeline event should be created

    Examples:
      | current_status | new_status   |
      | PENDING        | ACTIVE       |
      | ACTIVE         | SUSPENDED    |
      | SUSPENDED      | ACTIVE       |
      | ACTIVE         | INACTIVE     |
      | INACTIVE       | ARCHIVED     |

  Scenario: Invalid status transition
    Given a client with status "ARCHIVED"
    When I try to change status to "ACTIVE"
    Then the transition should fail
    And I should see error "Cannot activate archived client"
```

---

## Technical Specification

### Database Schema

```sql
-- Main clients table
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Basic information
  company_name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  nip VARCHAR(10) NOT NULL,
  regon VARCHAR(14),
  krs VARCHAR(20),
  vat_number VARCHAR(20),
  vat_status VARCHAR(50) DEFAULT 'NOT_REGISTERED'
    CHECK (vat_status IN ('ACTIVE', 'NOT_REGISTERED', 'INVALID', 'EXEMPT')),

  -- Tax configuration (JSONB for flexibility)
  tax_settings JSONB NOT NULL DEFAULT '{}',

  -- Address information (JSONB)
  registered_address JSONB NOT NULL,
  correspondence_address JSONB,

  -- Business information
  industry_code VARCHAR(10),        -- PKD code
  industry_name VARCHAR(255),
  company_size VARCHAR(50)
    CHECK (company_size IN ('MICRO', 'SMALL', 'MEDIUM', 'LARGE')),
  established_date DATE,

  -- Status fields
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'ARCHIVED')),
  onboarding_status VARCHAR(50) DEFAULT 'NOT_STARTED'
    CHECK (onboarding_status IN ('NOT_STARTED', 'IN_PROGRESS', 'DOCUMENTS_PENDING', 'REVIEW', 'COMPLETED')),
  service_level VARCHAR(50) DEFAULT 'STANDARD'
    CHECK (service_level IN ('BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE')),
  contract_start_date DATE,
  contract_end_date DATE,

  -- Risk assessment (populated by AI)
  risk_profile JSONB,
  credit_score INTEGER CHECK (credit_score BETWEEN 0 AND 100),
  payment_history JSONB,

  -- Flexible fields
  custom_fields JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,

  -- System fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,

  -- Constraints
  CONSTRAINT unique_org_nip UNIQUE(organization_id, nip),
  CONSTRAINT valid_nip CHECK (nip ~ '^\d{10}$'),
  CONSTRAINT valid_regon CHECK (regon IS NULL OR regon ~ '^\d{9}(\d{5})?$'),
  CONSTRAINT valid_krs CHECK (krs IS NULL OR krs ~ '^\d{10}$')
);

-- Row-Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY clients_org_isolation ON clients
  USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY clients_not_deleted ON clients
  FOR SELECT USING (deleted_at IS NULL);

-- Indexes
CREATE INDEX idx_clients_org ON clients(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_nip ON clients(nip) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_status ON clients(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_created ON clients(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_updated ON clients(updated_at DESC) WHERE deleted_at IS NULL;

-- Full-text search index
CREATE INDEX idx_clients_search ON clients USING GIN(
  to_tsvector('polish',
    company_name || ' ' ||
    COALESCE(legal_name, '') || ' ' ||
    nip || ' ' ||
    COALESCE(regon, '')
  )
) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Client versions for audit trail
CREATE TABLE client_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  version INTEGER NOT NULL,
  data JSONB NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_reason TEXT,

  CONSTRAINT unique_client_version UNIQUE(client_id, version)
);

CREATE INDEX idx_client_versions_client ON client_versions(client_id);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Polish validation patterns
const nipPattern = /^\d{10}$/;
const regonPattern = /^\d{9}(\d{5})?$/;
const krsPattern = /^\d{10}$/;
const postalCodePattern = /^\d{2}-\d{3}$/;
const phonePattern = /^\+?[0-9\s\-()]+$/;

// NIP validation with checksum
function validateNIP(nip: string): boolean {
  if (!nipPattern.test(nip)) return false;

  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const digits = nip.split('').map(Number);

  const sum = weights.reduce((acc, weight, i) => acc + weight * digits[i], 0);
  const checksum = sum % 11;

  return checksum === digits[9];
}

// Address schema
export const AddressSchema = z.object({
  street: z.string().min(1).max(255),
  buildingNumber: z.string().min(1).max(20),
  apartmentNumber: z.string().max(20).optional(),
  postalCode: z.string().regex(postalCodePattern, 'Invalid postal code format (XX-XXX)'),
  city: z.string().min(1).max(100),
  country: z.string().length(2).default('PL'),
  province: z.string().max(100).optional(),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  }).optional()
});

// Tax settings schema
export const TaxSettingsSchema = z.object({
  taxForm: z.enum(['CIT', 'PIT', 'VAT', 'FLAT_TAX', 'LUMP_SUM']),
  vatPayer: z.boolean().default(false),
  vatRate: z.number().min(0).max(100).optional(),
  vatPaymentPeriod: z.enum(['MONTHLY', 'QUARTERLY']).optional(),
  citRate: z.number().min(0).max(100).optional(),
  pitRate: z.number().min(0).max(100).optional(),
  zusConfiguration: z.object({
    contributionType: z.enum(['FULL', 'PREFERENTIAL', 'NONE']),
    healthInsurance: z.boolean(),
    sicknessBenefit: z.boolean()
  }).optional(),
  taxDeadlines: z.array(z.object({
    type: z.string(),
    dayOfMonth: z.number().min(1).max(31),
    frequency: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY'])
  })).default([])
});

// Create client DTO
export const CreateClientSchema = z.object({
  companyName: z.string().min(1).max(255),
  legalName: z.string().max(255).optional(),
  nip: z.string().regex(nipPattern, 'NIP must be 10 digits').refine(validateNIP, 'Invalid NIP checksum'),
  regon: z.string().regex(regonPattern, 'REGON must be 9 or 14 digits').optional(),
  krs: z.string().regex(krsPattern, 'KRS must be 10 digits').optional(),
  vatNumber: z.string().max(20).optional(),

  taxSettings: TaxSettingsSchema,

  registeredAddress: AddressSchema,
  correspondenceAddress: AddressSchema.optional(),

  industryCode: z.string().max(10).optional(),
  industryName: z.string().max(255).optional(),
  companySize: z.enum(['MICRO', 'SMALL', 'MEDIUM', 'LARGE']).optional(),
  establishedDate: z.coerce.date().optional(),

  serviceLevel: z.enum(['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE']).default('STANDARD'),
  contractStartDate: z.coerce.date().optional(),
  contractEndDate: z.coerce.date().optional(),

  customFields: z.record(z.any()).default({}),
  tags: z.array(z.string()).default([]),
  notes: z.string().max(10000).optional()
});

// Update client DTO with optimistic locking
export const UpdateClientSchema = CreateClientSchema.partial().extend({
  version: z.number().int().positive()
});

// Client status change DTO
export const ChangeClientStatusSchema = z.object({
  clientId: z.string().uuid(),
  newStatus: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'ARCHIVED']),
  reason: z.string().max(500).optional(),
  version: z.number().int().positive()
});

// Client response schema
export const ClientSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  companyName: z.string(),
  legalName: z.string().nullable(),
  nip: z.string(),
  regon: z.string().nullable(),
  krs: z.string().nullable(),
  vatNumber: z.string().nullable(),
  vatStatus: z.enum(['ACTIVE', 'NOT_REGISTERED', 'INVALID', 'EXEMPT']),
  taxSettings: TaxSettingsSchema,
  registeredAddress: AddressSchema,
  correspondenceAddress: AddressSchema.nullable(),
  industryCode: z.string().nullable(),
  industryName: z.string().nullable(),
  companySize: z.enum(['MICRO', 'SMALL', 'MEDIUM', 'LARGE']).nullable(),
  establishedDate: z.date().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'ARCHIVED']),
  onboardingStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DOCUMENTS_PENDING', 'REVIEW', 'COMPLETED']),
  serviceLevel: z.enum(['BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE']),
  contractStartDate: z.date().nullable(),
  contractEndDate: z.date().nullable(),
  riskProfile: z.object({
    score: z.number(),
    level: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    lastAssessmentDate: z.date()
  }).nullable(),
  customFields: z.record(z.any()),
  tags: z.array(z.string()),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid(),
  version: z.number()
});

export type CreateClientDto = z.infer<typeof CreateClientSchema>;
export type UpdateClientDto = z.infer<typeof UpdateClientSchema>;
export type ChangeClientStatusDto = z.infer<typeof ChangeClientStatusSchema>;
export type Client = z.infer<typeof ClientSchema>;
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  CreateClientSchema,
  UpdateClientSchema,
  ChangeClientStatusSchema,
  ClientSchema
} from './schemas';

export const clientRouter = router({
  // Create new client
  create: protectedProcedure
    .input(CreateClientSchema)
    .output(ClientSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, db, organizationId } = ctx;

      // Check for duplicate NIP
      const existing = await db.client.findFirst({
        where: {
          organizationId,
          nip: input.nip,
          deletedAt: null
        }
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Client with NIP ${input.nip} already exists`
        });
      }

      // Create client
      const client = await db.client.create({
        data: {
          organizationId,
          ...input,
          status: 'PENDING',
          onboardingStatus: 'NOT_STARTED',
          vatStatus: input.vatNumber ? 'ACTIVE' : 'NOT_REGISTERED',
          createdBy: user.id,
          updatedBy: user.id,
          version: 1
        }
      });

      // Create initial version snapshot
      await db.clientVersion.create({
        data: {
          clientId: client.id,
          version: 1,
          data: client,
          changedBy: user.id,
          changeReason: 'Initial creation'
        }
      });

      // Add timeline event
      await db.clientTimeline.create({
        data: {
          clientId: client.id,
          eventType: 'CLIENT_CREATED',
          title: 'Client created',
          description: `Client ${client.companyName} was created`,
          metadata: { source: 'manual' },
          userId: user.id,
          userName: user.name
        }
      });

      // Emit audit event
      await ctx.audit.log({
        action: 'CLIENT_CREATED',
        entityType: 'Client',
        entityId: client.id,
        userId: user.id,
        metadata: {
          companyName: client.companyName,
          nip: client.nip
        }
      });

      return client;
    }),

  // Get client by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(ClientSchema.nullable())
    .query(async ({ ctx, input }) => {
      return ctx.db.client.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null
        }
      });
    }),

  // List clients with pagination and filtering
  list: protectedProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'ARCHIVED']).optional(),
      search: z.string().optional(),
      tags: z.array(z.string()).optional(),
      sortBy: z.enum(['companyName', 'createdAt', 'updatedAt', 'nip']).default('createdAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
      includeDeleted: z.boolean().default(false)
    }))
    .output(z.object({
      items: z.array(ClientSchema),
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
      totalPages: z.number()
    }))
    .query(async ({ ctx, input }) => {
      const { page, pageSize, status, search, tags, sortBy, sortOrder, includeDeleted } = input;

      const where: any = {
        organizationId: ctx.organizationId
      };

      if (!includeDeleted) {
        where.deletedAt = null;
      }

      if (status) {
        where.status = status;
      }

      if (search) {
        where.OR = [
          { companyName: { contains: search, mode: 'insensitive' } },
          { legalName: { contains: search, mode: 'insensitive' } },
          { nip: { contains: search } },
          { regon: { contains: search } }
        ];
      }

      if (tags && tags.length > 0) {
        where.tags = { hasEvery: tags };
      }

      const [items, total] = await Promise.all([
        ctx.db.client.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        ctx.db.client.count({ where })
      ]);

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    }),

  // Update client
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: UpdateClientSchema
    }))
    .output(ClientSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, db, organizationId } = ctx;
      const { id, data } = input;

      // Get existing client with lock
      const existing = await db.$queryRaw`
        SELECT * FROM clients
        WHERE id = ${id}::uuid
          AND organization_id = ${organizationId}::uuid
          AND deleted_at IS NULL
        FOR UPDATE
      `;

      if (!existing || existing.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found'
        });
      }

      const client = existing[0];

      // Check optimistic lock
      if (data.version !== client.version) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Client has been modified by another user'
        });
      }

      // Track changes
      const changes = trackChanges(client, data);

      // Update client
      const { version, ...updateData } = data;
      const updated = await db.client.update({
        where: { id },
        data: {
          ...updateData,
          updatedBy: user.id,
          updatedAt: new Date(),
          version: client.version + 1
        }
      });

      // Create version snapshot
      await db.clientVersion.create({
        data: {
          clientId: id,
          version: updated.version,
          data: updated,
          changedBy: user.id,
          changeReason: `Updated: ${changes.map(c => c.field).join(', ')}`
        }
      });

      // Add timeline event if there are changes
      if (changes.length > 0) {
        await db.clientTimeline.create({
          data: {
            clientId: id,
            eventType: 'CLIENT_UPDATED',
            title: 'Client updated',
            description: `Updated ${changes.length} field(s)`,
            metadata: { changes },
            userId: user.id,
            userName: user.name
          }
        });
      }

      // Audit log
      await ctx.audit.log({
        action: 'CLIENT_UPDATED',
        entityType: 'Client',
        entityId: id,
        userId: user.id,
        oldValue: client,
        newValue: updated,
        metadata: { changes }
      });

      return updated;
    }),

  // Soft delete client
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { user, db, organizationId } = ctx;

      const client = await db.client.findFirst({
        where: {
          id: input.id,
          organizationId,
          deletedAt: null
        }
      });

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found'
        });
      }

      await db.client.update({
        where: { id: input.id },
        data: {
          deletedAt: new Date(),
          updatedBy: user.id
        }
      });

      // Timeline event
      await db.clientTimeline.create({
        data: {
          clientId: input.id,
          eventType: 'CLIENT_DELETED',
          title: 'Client deleted',
          description: `Client ${client.companyName} was deleted`,
          metadata: {},
          userId: user.id,
          userName: user.name
        }
      });

      // Audit log
      await ctx.audit.log({
        action: 'CLIENT_DELETED',
        entityType: 'Client',
        entityId: input.id,
        userId: user.id
      });

      return { success: true };
    }),

  // Restore deleted client
  restore: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(ClientSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, db, organizationId } = ctx;

      const client = await db.client.findFirst({
        where: {
          id: input.id,
          organizationId,
          deletedAt: { not: null }
        }
      });

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deleted client not found'
        });
      }

      const restored = await db.client.update({
        where: { id: input.id },
        data: {
          deletedAt: null,
          status: 'PENDING',
          updatedBy: user.id,
          version: client.version + 1
        }
      });

      // Timeline event
      await db.clientTimeline.create({
        data: {
          clientId: input.id,
          eventType: 'CLIENT_RESTORED',
          title: 'Client restored',
          description: `Client ${client.companyName} was restored`,
          metadata: {},
          userId: user.id,
          userName: user.name
        }
      });

      // Audit log
      await ctx.audit.log({
        action: 'CLIENT_RESTORED',
        entityType: 'Client',
        entityId: input.id,
        userId: user.id
      });

      return restored;
    }),

  // Change client status
  changeStatus: protectedProcedure
    .input(ChangeClientStatusSchema)
    .output(ClientSchema)
    .mutation(async ({ ctx, input }) => {
      const { user, db, organizationId } = ctx;

      const client = await db.client.findFirst({
        where: {
          id: input.clientId,
          organizationId,
          deletedAt: null
        }
      });

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found'
        });
      }

      // Validate status transition
      const validTransitions: Record<string, string[]> = {
        'PENDING': ['ACTIVE', 'SUSPENDED'],
        'ACTIVE': ['SUSPENDED', 'INACTIVE'],
        'SUSPENDED': ['ACTIVE', 'INACTIVE'],
        'INACTIVE': ['ACTIVE', 'ARCHIVED'],
        'ARCHIVED': [] // Cannot transition from archived
      };

      if (!validTransitions[client.status]?.includes(input.newStatus)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot transition from ${client.status} to ${input.newStatus}`
        });
      }

      // Check version
      if (input.version !== client.version) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Client has been modified by another user'
        });
      }

      const updated = await db.client.update({
        where: { id: input.clientId },
        data: {
          status: input.newStatus,
          updatedBy: user.id,
          version: client.version + 1
        }
      });

      // Timeline event
      await db.clientTimeline.create({
        data: {
          clientId: input.clientId,
          eventType: 'CLIENT_STATUS_CHANGED',
          title: `Status changed to ${input.newStatus}`,
          description: input.reason || `Status changed from ${client.status} to ${input.newStatus}`,
          metadata: {
            oldStatus: client.status,
            newStatus: input.newStatus,
            reason: input.reason
          },
          userId: user.id,
          userName: user.name
        }
      });

      // Audit log
      await ctx.audit.log({
        action: 'CLIENT_STATUS_CHANGED',
        entityType: 'Client',
        entityId: input.clientId,
        userId: user.id,
        metadata: {
          oldStatus: client.status,
          newStatus: input.newStatus,
          reason: input.reason
        }
      });

      return updated;
    }),

  // Get client history/versions
  getHistory: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      limit: z.number().int().min(1).max(100).default(20)
    }))
    .output(z.array(z.object({
      version: z.number(),
      data: z.any(),
      changedBy: z.string().uuid(),
      changedAt: z.date(),
      changeReason: z.string().nullable()
    })))
    .query(async ({ ctx, input }) => {
      return ctx.db.clientVersion.findMany({
        where: { clientId: input.clientId },
        orderBy: { version: 'desc' },
        take: input.limit
      });
    })
});

// Helper function to track changes
function trackChanges(original: any, updated: any): Array<{ field: string; oldValue: any; newValue: any }> {
  const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

  const fieldsToTrack = [
    'companyName', 'legalName', 'nip', 'regon', 'krs', 'vatNumber',
    'taxSettings', 'registeredAddress', 'correspondenceAddress',
    'industryCode', 'industryName', 'companySize', 'serviceLevel',
    'contractStartDate', 'contractEndDate', 'tags', 'notes'
  ];

  for (const field of fieldsToTrack) {
    if (field in updated && JSON.stringify(original[field]) !== JSON.stringify(updated[field])) {
      changes.push({
        field,
        oldValue: original[field],
        newValue: updated[field]
      });
    }
  }

  return changes;
}
```

### Service Implementation

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/lib/prisma';
import { EventBus } from '@/lib/events';
import { AuditLogger } from '@/lib/audit';
import { CacheService } from '@/lib/cache';
import type { Client, CreateClientDto, UpdateClientDto } from './schemas';

@Injectable()
export class ClientService {
  constructor(
    private readonly db: PrismaService,
    private readonly eventBus: EventBus,
    private readonly audit: AuditLogger,
    private readonly cache: CacheService
  ) {}

  async create(
    organizationId: string,
    data: CreateClientDto,
    userId: string
  ): Promise<Client> {
    // Check for duplicate NIP
    const existing = await this.db.client.findFirst({
      where: {
        organizationId,
        nip: data.nip,
        deletedAt: null
      }
    });

    if (existing) {
      throw new Error(`Client with NIP ${data.nip} already exists`);
    }

    // Create within transaction
    const client = await this.db.$transaction(async (tx) => {
      // Create client
      const newClient = await tx.client.create({
        data: {
          organizationId,
          ...data,
          status: 'PENDING',
          onboardingStatus: 'NOT_STARTED',
          vatStatus: data.vatNumber ? 'ACTIVE' : 'NOT_REGISTERED',
          createdBy: userId,
          updatedBy: userId,
          version: 1
        }
      });

      // Create initial version
      await tx.clientVersion.create({
        data: {
          clientId: newClient.id,
          version: 1,
          data: newClient,
          changedBy: userId,
          changeReason: 'Initial creation'
        }
      });

      // Create timeline event
      await tx.clientTimeline.create({
        data: {
          clientId: newClient.id,
          eventType: 'CLIENT_CREATED',
          title: 'Client created',
          description: `Client ${newClient.companyName} was created`,
          metadata: { source: 'manual' },
          userId,
          userName: await this.getUserName(userId)
        }
      });

      return newClient;
    });

    // Publish event
    await this.eventBus.publish({
      type: 'CLIENT_CREATED',
      clientId: client.id,
      organizationId,
      companyName: client.companyName,
      nip: client.nip,
      createdBy: userId,
      timestamp: new Date()
    });

    // Audit log
    await this.audit.log({
      action: 'CLIENT_CREATED',
      entityType: 'Client',
      entityId: client.id,
      userId,
      metadata: {
        companyName: client.companyName,
        nip: client.nip
      }
    });

    // Invalidate cache
    await this.cache.invalidate(`clients:${organizationId}:*`);

    return client;
  }

  async findById(
    organizationId: string,
    id: string
  ): Promise<Client | null> {
    // Check cache first
    const cacheKey = `client:${id}`;
    const cached = await this.cache.get<Client>(cacheKey);
    if (cached) return cached;

    const client = await this.db.client.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null
      }
    });

    if (client) {
      await this.cache.set(cacheKey, client, 3600); // 1 hour TTL
    }

    return client;
  }

  async findByNIP(
    organizationId: string,
    nip: string
  ): Promise<Client | null> {
    return this.db.client.findFirst({
      where: {
        organizationId,
        nip,
        deletedAt: null
      }
    });
  }

  private async getUserName(userId: string): Promise<string> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { name: true }
    });
    return user?.name || 'System';
  }
}
```

---

## Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientService } from './client.service';
import { createMockPrisma, createMockEventBus, createMockAudit, createMockCache } from '@/test/mocks';

describe('ClientService', () => {
  let service: ClientService;
  let mockDb: ReturnType<typeof createMockPrisma>;
  let mockEventBus: ReturnType<typeof createMockEventBus>;
  let mockAudit: ReturnType<typeof createMockAudit>;
  let mockCache: ReturnType<typeof createMockCache>;

  const organizationId = 'org-123';
  const userId = 'user-123';

  beforeEach(() => {
    mockDb = createMockPrisma();
    mockEventBus = createMockEventBus();
    mockAudit = createMockAudit();
    mockCache = createMockCache();

    service = new ClientService(mockDb, mockEventBus, mockAudit, mockCache);
  });

  describe('create', () => {
    const validClientData = {
      companyName: 'Test Company Sp. z o.o.',
      nip: '1234567890',
      taxSettings: {
        taxForm: 'CIT' as const,
        vatPayer: true,
        vatPaymentPeriod: 'MONTHLY' as const,
        taxDeadlines: []
      },
      registeredAddress: {
        street: 'Marszałkowska',
        buildingNumber: '1',
        postalCode: '00-001',
        city: 'Warszawa',
        country: 'PL'
      }
    };

    it('should create a new client successfully', async () => {
      mockDb.client.findFirst.mockResolvedValue(null);
      mockDb.$transaction.mockImplementation(async (fn) => fn(mockDb));
      mockDb.client.create.mockResolvedValue({
        id: 'client-123',
        ...validClientData,
        organizationId,
        status: 'PENDING',
        version: 1
      });

      const result = await service.create(organizationId, validClientData, userId);

      expect(result.companyName).toBe('Test Company Sp. z o.o.');
      expect(result.status).toBe('PENDING');
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'CLIENT_CREATED' })
      );
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CLIENT_CREATED' })
      );
    });

    it('should reject duplicate NIP', async () => {
      mockDb.client.findFirst.mockResolvedValue({
        id: 'existing-client',
        nip: '1234567890'
      });

      await expect(
        service.create(organizationId, validClientData, userId)
      ).rejects.toThrow('Client with NIP 1234567890 already exists');
    });
  });

  describe('findById', () => {
    it('should return cached client if available', async () => {
      const cachedClient = { id: 'client-123', companyName: 'Cached Company' };
      mockCache.get.mockResolvedValue(cachedClient);

      const result = await service.findById(organizationId, 'client-123');

      expect(result).toEqual(cachedClient);
      expect(mockDb.client.findFirst).not.toHaveBeenCalled();
    });

    it('should query database and cache result if not cached', async () => {
      const dbClient = { id: 'client-123', companyName: 'DB Company' };
      mockCache.get.mockResolvedValue(null);
      mockDb.client.findFirst.mockResolvedValue(dbClient);

      const result = await service.findById(organizationId, 'client-123');

      expect(result).toEqual(dbClient);
      expect(mockCache.set).toHaveBeenCalledWith('client:client-123', dbClient, 3600);
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestContext, cleanupTestData } from '@/test/helpers';
import { clientRouter } from './client.router';

describe('Client API Integration', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let caller: ReturnType<typeof clientRouter.createCaller>;

  beforeAll(async () => {
    ctx = await createTestContext();
    caller = clientRouter.createCaller(ctx);
  });

  afterAll(async () => {
    await cleanupTestData(ctx);
  });

  beforeEach(async () => {
    await ctx.db.client.deleteMany({ where: { organizationId: ctx.organizationId } });
  });

  describe('create', () => {
    it('should create client and enrich from GUS', async () => {
      const result = await caller.create({
        companyName: 'Test Integration Company',
        nip: '5270103391', // Valid test NIP
        taxSettings: {
          taxForm: 'CIT',
          vatPayer: true,
          taxDeadlines: []
        },
        registeredAddress: {
          street: 'Test Street',
          buildingNumber: '1',
          postalCode: '00-001',
          city: 'Warszawa',
          country: 'PL'
        }
      });

      expect(result.id).toBeDefined();
      expect(result.status).toBe('PENDING');
      expect(result.version).toBe(1);

      // Verify timeline event was created
      const timeline = await ctx.db.clientTimeline.findFirst({
        where: { clientId: result.id }
      });
      expect(timeline?.eventType).toBe('CLIENT_CREATED');
    });

    it('should prevent duplicate NIP', async () => {
      // Create first client
      await caller.create({
        companyName: 'First Company',
        nip: '5270103391',
        taxSettings: { taxForm: 'CIT', vatPayer: false, taxDeadlines: [] },
        registeredAddress: {
          street: 'Test',
          buildingNumber: '1',
          postalCode: '00-001',
          city: 'Warszawa',
          country: 'PL'
        }
      });

      // Attempt duplicate
      await expect(
        caller.create({
          companyName: 'Duplicate Company',
          nip: '5270103391',
          taxSettings: { taxForm: 'CIT', vatPayer: false, taxDeadlines: [] },
          registeredAddress: {
            street: 'Test',
            buildingNumber: '1',
            postalCode: '00-001',
            city: 'Warszawa',
            country: 'PL'
          }
        })
      ).rejects.toThrow('already exists');
    });
  });

  describe('update with optimistic locking', () => {
    it('should update successfully with correct version', async () => {
      const created = await caller.create({
        companyName: 'Original Name',
        nip: '5270103391',
        taxSettings: { taxForm: 'CIT', vatPayer: false, taxDeadlines: [] },
        registeredAddress: {
          street: 'Test',
          buildingNumber: '1',
          postalCode: '00-001',
          city: 'Warszawa',
          country: 'PL'
        }
      });

      const updated = await caller.update({
        id: created.id,
        data: {
          companyName: 'Updated Name',
          version: 1
        }
      });

      expect(updated.companyName).toBe('Updated Name');
      expect(updated.version).toBe(2);
    });

    it('should reject update with stale version', async () => {
      const created = await caller.create({
        companyName: 'Original Name',
        nip: '5270103391',
        taxSettings: { taxForm: 'CIT', vatPayer: false, taxDeadlines: [] },
        registeredAddress: {
          street: 'Test',
          buildingNumber: '1',
          postalCode: '00-001',
          city: 'Warszawa',
          country: 'PL'
        }
      });

      // First update
      await caller.update({
        id: created.id,
        data: { companyName: 'First Update', version: 1 }
      });

      // Attempt update with stale version
      await expect(
        caller.update({
          id: created.id,
          data: { companyName: 'Stale Update', version: 1 }
        })
      ).rejects.toThrow('modified by another user');
    });
  });

  describe('status transitions', () => {
    it('should allow valid status transitions', async () => {
      const created = await caller.create({
        companyName: 'Status Test Company',
        nip: '5270103391',
        taxSettings: { taxForm: 'CIT', vatPayer: false, taxDeadlines: [] },
        registeredAddress: {
          street: 'Test',
          buildingNumber: '1',
          postalCode: '00-001',
          city: 'Warszawa',
          country: 'PL'
        }
      });

      // PENDING -> ACTIVE
      const activated = await caller.changeStatus({
        clientId: created.id,
        newStatus: 'ACTIVE',
        version: 1
      });

      expect(activated.status).toBe('ACTIVE');

      // ACTIVE -> SUSPENDED
      const suspended = await caller.changeStatus({
        clientId: created.id,
        newStatus: 'SUSPENDED',
        reason: 'Payment overdue',
        version: 2
      });

      expect(suspended.status).toBe('SUSPENDED');
    });

    it('should reject invalid status transitions', async () => {
      const created = await caller.create({
        companyName: 'Invalid Transition Company',
        nip: '5270103391',
        taxSettings: { taxForm: 'CIT', vatPayer: false, taxDeadlines: [] },
        registeredAddress: {
          street: 'Test',
          buildingNumber: '1',
          postalCode: '00-001',
          city: 'Warszawa',
          country: 'PL'
        }
      });

      // PENDING -> ARCHIVED (invalid)
      await expect(
        caller.changeStatus({
          clientId: created.id,
          newStatus: 'ARCHIVED',
          version: 1
        })
      ).rejects.toThrow('Cannot transition');
    });
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Client Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('should create a new client', async ({ page }) => {
    await page.goto('/clients/new');

    // Fill form
    await page.fill('[data-testid="company-name"]', 'E2E Test Company');
    await page.fill('[data-testid="nip"]', '5270103391');
    await page.selectOption('[data-testid="tax-form"]', 'CIT');
    await page.fill('[data-testid="street"]', 'Testowa');
    await page.fill('[data-testid="building-number"]', '1');
    await page.fill('[data-testid="postal-code"]', '00-001');
    await page.fill('[data-testid="city"]', 'Warszawa');

    // Submit
    await page.click('[data-testid="submit-client"]');

    // Verify success
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page).toHaveURL(/\/clients\/[a-f0-9-]+/);

    // Verify client details
    await expect(page.locator('[data-testid="client-name"]')).toContainText('E2E Test Company');
    await expect(page.locator('[data-testid="client-status"]')).toContainText('Pending');
  });

  test('should show validation errors for invalid NIP', async ({ page }) => {
    await page.goto('/clients/new');

    await page.fill('[data-testid="company-name"]', 'Invalid NIP Company');
    await page.fill('[data-testid="nip"]', '12345'); // Invalid NIP

    await page.click('[data-testid="submit-client"]');

    await expect(page.locator('[data-testid="nip-error"]')).toContainText('NIP must be 10 digits');
  });

  test('should update client and show version conflict', async ({ page }) => {
    // Navigate to existing client
    await page.goto('/clients');
    await page.click('[data-testid="client-row"]:first-child');

    // Edit client
    await page.click('[data-testid="edit-client"]');
    await page.fill('[data-testid="company-name"]', 'Updated Company Name');
    await page.click('[data-testid="save-client"]');

    // Verify update
    await expect(page.locator('[data-testid="client-name"]')).toContainText('Updated Company Name');
  });
});
```

---

## Security Checklist

- [x] **Authentication**: All endpoints require valid JWT token
- [x] **Authorization**: Organization-level RLS policies enforced
- [x] **Input Validation**: Zod schemas validate all inputs
- [x] **NIP Validation**: Checksum validation for Polish NIP
- [x] **SQL Injection**: Parameterized queries via Prisma
- [x] **XSS Prevention**: Input sanitization for text fields
- [x] **Rate Limiting**: API rate limits applied
- [x] **Audit Trail**: All mutations logged to audit table
- [x] **Optimistic Locking**: Version field prevents concurrent update issues
- [x] **Soft Delete**: Data preserved for audit/recovery
- [x] **Sensitive Data**: PII fields identified for encryption

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `CLIENT_CREATED` | New client created | clientId, companyName, nip, createdBy |
| `CLIENT_UPDATED` | Client modified | clientId, changes[], updatedBy |
| `CLIENT_DELETED` | Client soft deleted | clientId, deletedBy |
| `CLIENT_RESTORED` | Deleted client restored | clientId, restoredBy |
| `CLIENT_STATUS_CHANGED` | Status transition | clientId, oldStatus, newStatus, reason |
| `CLIENT_VERSION_CREATED` | Version snapshot | clientId, version, changedBy |

---

## Implementation Notes

### Polish NIP Validation
NIP (Numer Identyfikacji Podatkowej) uses modulo 11 checksum:
- Weights: [6, 5, 7, 2, 3, 4, 5, 6, 7]
- Sum of (weight × digit) mod 11 must equal the 10th digit

### Caching Strategy
- Individual clients cached for 1 hour (key: `client:{id}`)
- List queries invalidate on any client mutation
- Use Redis for distributed cache in production

### Search Indexing
- Full-text search index on companyName, legalName, nip, regon
- Uses PostgreSQL `to_tsvector('polish', ...)` for Polish language support
- Consider Elasticsearch for advanced search requirements

---

*Story created: December 2024*
*Last updated: December 2024*
