# CRM-004: Contact Management

> **Story ID**: CRM-004
> **Epic**: Core CRM Module
> **Priority**: P0 (Critical)
> **Points**: 8
> **Phase**: Week 6
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant,
**I want** to manage multiple contacts per client with roles and preferences,
**So that** I can communicate effectively with the right people for different matters.

---

## Acceptance Criteria

### AC1: Contact CRUD Operations

```gherkin
Feature: Contact Management
  As an accountant
  I want to manage contacts for each client
  So that I can maintain accurate contact information

  Background:
    Given I am logged in as an accountant
    And I have permission to manage clients
    And I have a client "ABC Company"

  Scenario: Add new contact to client
    Given I am viewing client "ABC Company"
    When I click "Add Contact"
    And I fill in:
      | Field      | Value              |
      | First Name | Jan                |
      | Last Name  | Kowalski           |
      | Role       | OWNER              |
      | Email      | jan@abc.pl         |
      | Phone      | +48 123 456 789    |
      | Mobile     | +48 987 654 321    |
    And I check "Primary Contact"
    And I click "Save"
    Then the contact should be created successfully
    And the contact should appear in the client's contact list
    And a timeline event "Contact Added" should be created

  Scenario: Add contact with portal access
    Given I am adding a new contact
    When I fill in the contact details
    And I check "Grant Portal Access"
    Then the system should validate email is provided
    And create a pending portal invitation
    And send invitation email to the contact

  Scenario: Update existing contact
    Given client "ABC Company" has contact "Jan Kowalski"
    When I edit the contact
    And I change the phone number to "+48 111 222 333"
    And I click "Save"
    Then the contact should be updated
    And the previous values should be preserved in history
    And a timeline event "Contact Updated" should be created

  Scenario: Remove contact from client
    Given client "ABC Company" has contact "Jan Kowalski"
    And "Jan Kowalski" is not the primary contact
    When I click "Remove Contact"
    And I confirm the removal
    Then the contact should be soft-deleted
    And a timeline event "Contact Removed" should be created
    And the contact data should be retained for audit

  Scenario: Cannot remove primary contact without replacement
    Given client "ABC Company" has only one contact "Jan Kowalski"
    And "Jan Kowalski" is the primary contact
    When I try to remove "Jan Kowalski"
    Then I should see error "Cannot remove the only primary contact"
    And the contact should not be removed

  Scenario: Transfer primary contact status
    Given client "ABC Company" has contacts "Jan Kowalski" (primary) and "Anna Nowak"
    When I set "Anna Nowak" as primary contact
    Then "Anna Nowak" should become the primary contact
    And "Jan Kowalski" should no longer be primary
    And timeline event should record the change
```

### AC2: Contact Roles and Responsibilities

```gherkin
Feature: Contact Roles
  As an accountant
  I want to assign roles to contacts
  So that I know who to contact for specific matters

  Scenario: Available contact roles
    When I view the role options for a contact
    Then I should see the following roles:
      | Role       | Description                              |
      | OWNER      | Company owner or partner                 |
      | ACCOUNTANT | Internal accountant                      |
      | MANAGER    | Department or general manager            |
      | EMPLOYEE   | Regular employee                         |
      | AUTHORIZED | Person authorized for specific matters   |
      | OTHER      | Other role                               |

  Scenario: Assign multiple roles to contact
    Given I am editing contact "Jan Kowalski"
    When I select roles "OWNER" and "AUTHORIZED"
    And I click "Save"
    Then the contact should have both roles assigned

  Scenario: Filter contacts by role
    Given client has multiple contacts with different roles
    When I filter contacts by role "ACCOUNTANT"
    Then I should see only contacts with "ACCOUNTANT" role

  Scenario: Role-based communication routing
    Given contact "Jan Kowalski" has role "ACCOUNTANT"
    And contact "Anna Nowak" has role "OWNER"
    When I send tax-related communication
    Then the system should suggest "Jan Kowalski" as recipient
    When I send business-related communication
    Then the system should suggest "Anna Nowak" as recipient
```

### AC3: Contact Preferences

```gherkin
Feature: Contact Communication Preferences
  As an accountant
  I want to track contact preferences
  So that I can respect their communication choices

  Scenario: Set communication preferences
    Given I am editing contact "Jan Kowalski"
    When I configure preferences:
      | Preference              | Value          |
      | Preferred Channel       | Email          |
      | Language                | Polish         |
      | Best Time to Call       | 10:00-12:00    |
      | Receive Newsletters     | Yes            |
      | Receive Tax Reminders   | Yes            |
      | Receive System Updates  | No             |
    And I click "Save"
    Then the preferences should be saved
    And be used for future communications

  Scenario: Respect communication blackout periods
    Given contact "Jan Kowalski" has blackout period on weekends
    When the system schedules a reminder for Saturday
    Then it should automatically reschedule for Monday

  Scenario: Track communication consent (RODO/GDPR)
    Given I am adding a new contact
    When I save the contact
    Then the system should record:
      | Field                | Value                |
      | Consent Date         | Current timestamp    |
      | Consent Source       | Manual entry         |
      | Marketing Consent    | As specified         |
      | Data Processing      | Required for service |
```

### AC4: Contact Portal Access

```gherkin
Feature: Contact Portal Access
  As an accountant
  I want to manage client portal access for contacts
  So that contacts can view their company information

  Scenario: Enable portal access for contact
    Given contact "Jan Kowalski" does not have portal access
    When I enable portal access
    Then the system should:
      | Action                      |
      | Validate email is provided  |
      | Create portal user account  |
      | Send invitation email       |
      | Set status to PENDING       |

  Scenario: Revoke portal access
    Given contact "Jan Kowalski" has active portal access
    When I revoke portal access
    Then the system should:
      | Action                       |
      | Deactivate portal user       |
      | Send access revoked email    |
      | Log security event           |
      | Keep historical access data  |

  Scenario: Track portal access status
    When I view contact's portal access status
    Then I should see:
      | Field                | Example Value        |
      | Status               | ACTIVE/PENDING/NONE  |
      | Invitation Date      | 2024-01-15           |
      | Last Login           | 2024-01-20 14:30     |
      | Permissions          | View Documents, etc. |
```

---

## Technical Specification

### Database Schema

```sql
-- Contact table
CREATE TABLE client_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

    -- Personal information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,

    -- Contact methods
    email VARCHAR(255),
    phone VARCHAR(30),
    mobile VARCHAR(30),
    fax VARCHAR(30),

    -- Role and position
    roles TEXT[] NOT NULL DEFAULT '{}', -- Array of roles
    position VARCHAR(100),
    department VARCHAR(100),

    -- Status
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Portal access
    has_portal_access BOOLEAN NOT NULL DEFAULT FALSE,
    portal_user_id UUID REFERENCES users(id),
    portal_status VARCHAR(20), -- NONE, PENDING, ACTIVE, REVOKED
    portal_invited_at TIMESTAMPTZ,
    portal_activated_at TIMESTAMPTZ,

    -- Communication preferences (JSONB for flexibility)
    preferences JSONB NOT NULL DEFAULT '{}',

    -- GDPR/RODO consent tracking
    consent_data JSONB NOT NULL DEFAULT '{}',

    -- Notes
    notes TEXT,

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID NOT NULL REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),

    -- Constraints
    CONSTRAINT contact_requires_email_or_phone
        CHECK (email IS NOT NULL OR phone IS NOT NULL OR mobile IS NOT NULL),
    CONSTRAINT portal_access_requires_email
        CHECK (NOT has_portal_access OR email IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_contacts_client ON client_contacts(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_email ON client_contacts(email) WHERE email IS NOT NULL;
CREATE INDEX idx_contacts_portal ON client_contacts(portal_user_id) WHERE portal_user_id IS NOT NULL;
CREATE INDEX idx_contacts_roles ON client_contacts USING GIN(roles);
CREATE INDEX idx_contacts_primary ON client_contacts(client_id, is_primary) WHERE is_primary = TRUE;

-- Ensure only one primary contact per client
CREATE UNIQUE INDEX idx_unique_primary_contact
    ON client_contacts(client_id)
    WHERE is_primary = TRUE AND deleted_at IS NULL;

-- Contact history for audit trail
CREATE TABLE client_contacts_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES client_contacts(id),

    -- Snapshot of contact at change time
    snapshot JSONB NOT NULL,

    -- Change metadata
    change_type VARCHAR(20) NOT NULL, -- CREATE, UPDATE, DELETE
    changed_fields TEXT[],
    changed_by UUID NOT NULL REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- IP and user agent for security audit
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX idx_contact_history_contact ON client_contacts_history(contact_id);
CREATE INDEX idx_contact_history_date ON client_contacts_history(changed_at);

-- Row Level Security
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_contacts_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY contacts_org_policy ON client_contacts
    FOR ALL USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY contacts_history_policy ON client_contacts_history
    FOR SELECT USING (
        contact_id IN (
            SELECT id FROM client_contacts
            WHERE organization_id = current_setting('app.organization_id')::UUID
        )
    );
```

### Zod Schemas

```typescript
import { z } from 'zod';

// =====================================
// Contact Role Enum
// =====================================

export const ContactRoleSchema = z.enum([
  'OWNER',
  'ACCOUNTANT',
  'MANAGER',
  'EMPLOYEE',
  'AUTHORIZED',
  'OTHER'
]);

export type ContactRole = z.infer<typeof ContactRoleSchema>;

// =====================================
// Contact Preference Schemas
// =====================================

export const CommunicationChannelSchema = z.enum(['EMAIL', 'PHONE', 'SMS', 'MAIL', 'PORTAL']);

export const ContactPreferencesSchema = z.object({
  preferredChannel: CommunicationChannelSchema.optional(),
  language: z.string().length(2).default('pl'), // ISO 639-1
  timezone: z.string().default('Europe/Warsaw'),
  bestTimeToCall: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }).optional(),
  blackoutPeriods: z.array(z.object({
    type: z.enum(['WEEKLY', 'DATE_RANGE']),
    days: z.array(z.number().min(0).max(6)).optional(), // 0=Sunday
    startDate: z.string().date().optional(),
    endDate: z.string().date().optional(),
  })).optional(),
  subscriptions: z.object({
    newsletters: z.boolean().default(false),
    taxReminders: z.boolean().default(true),
    systemUpdates: z.boolean().default(true),
    marketingEmails: z.boolean().default(false),
  }).optional(),
});

export type ContactPreferences = z.infer<typeof ContactPreferencesSchema>;

// =====================================
// GDPR/RODO Consent Schema
// =====================================

export const ConsentDataSchema = z.object({
  dataProcessing: z.object({
    granted: z.boolean(),
    grantedAt: z.string().datetime(),
    purpose: z.string(),
    legalBasis: z.enum(['CONTRACT', 'CONSENT', 'LEGITIMATE_INTEREST']),
  }),
  marketing: z.object({
    granted: z.boolean(),
    grantedAt: z.string().datetime().optional(),
    revokedAt: z.string().datetime().optional(),
    channels: z.array(CommunicationChannelSchema).optional(),
  }).optional(),
  thirdPartySharing: z.object({
    granted: z.boolean(),
    grantedAt: z.string().datetime().optional(),
    partners: z.array(z.string()).optional(),
  }).optional(),
  source: z.enum(['MANUAL_ENTRY', 'IMPORT', 'PORTAL', 'FORM']),
  recordedBy: z.string().uuid(),
});

export type ConsentData = z.infer<typeof ConsentDataSchema>;

// =====================================
// Contact CRUD Schemas
// =====================================

export const CreateContactSchema = z.object({
  clientId: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[0-9\s\-()]+$/).optional(),
  mobile: z.string().regex(/^\+?[0-9\s\-()]+$/).optional(),
  fax: z.string().regex(/^\+?[0-9\s\-()]+$/).optional(),
  roles: z.array(ContactRoleSchema).min(1),
  position: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  isPrimary: z.boolean().default(false),
  grantPortalAccess: z.boolean().default(false),
  preferences: ContactPreferencesSchema.optional(),
  notes: z.string().max(5000).optional(),
}).refine(
  data => data.email || data.phone || data.mobile,
  { message: 'At least one contact method (email, phone, or mobile) is required' }
).refine(
  data => !data.grantPortalAccess || data.email,
  { message: 'Email is required for portal access' }
);

export const UpdateContactSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().regex(/^\+?[0-9\s\-()]+$/).optional().nullable(),
  mobile: z.string().regex(/^\+?[0-9\s\-()]+$/).optional().nullable(),
  fax: z.string().regex(/^\+?[0-9\s\-()]+$/).optional().nullable(),
  roles: z.array(ContactRoleSchema).min(1).optional(),
  position: z.string().max(100).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
  preferences: ContactPreferencesSchema.optional(),
  notes: z.string().max(5000).optional().nullable(),
});

export type CreateContact = z.infer<typeof CreateContactSchema>;
export type UpdateContact = z.infer<typeof UpdateContactSchema>;

// =====================================
// Portal Access Schemas
// =====================================

export const PortalStatusSchema = z.enum(['NONE', 'PENDING', 'ACTIVE', 'REVOKED']);

export const EnablePortalAccessSchema = z.object({
  contactId: z.string().uuid(),
  permissions: z.array(z.string()).optional(),
  sendInvitation: z.boolean().default(true),
  customMessage: z.string().max(1000).optional(),
});

export const RevokePortalAccessSchema = z.object({
  contactId: z.string().uuid(),
  reason: z.string().max(500).optional(),
  sendNotification: z.boolean().default(true),
});

// =====================================
// Query Schemas
// =====================================

export const ListContactsSchema = z.object({
  clientId: z.string().uuid(),
  roles: z.array(ContactRoleSchema).optional(),
  hasPortalAccess: z.boolean().optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional(),
});

export const ContactResponseSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  mobile: z.string().nullable(),
  roles: z.array(ContactRoleSchema),
  position: z.string().nullable(),
  department: z.string().nullable(),
  isPrimary: z.boolean(),
  isActive: z.boolean(),
  hasPortalAccess: z.boolean(),
  portalStatus: PortalStatusSchema.nullable(),
  preferences: ContactPreferencesSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ContactResponse = z.infer<typeof ContactResponseSchema>;
```

### tRPC Router

```typescript
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  CreateContactSchema,
  UpdateContactSchema,
  ListContactsSchema,
  EnablePortalAccessSchema,
  RevokePortalAccessSchema,
} from './schemas';
import { ContactService } from './contact.service';

export const contactRouter = router({
  // Create contact
  create: protectedProcedure
    .input(CreateContactSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ContactService(ctx.db, ctx.events);

      // Verify client belongs to organization
      const client = await ctx.db.clients.findFirst({
        where: {
          id: input.clientId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found',
        });
      }

      const contact = await service.create({
        ...input,
        organizationId: ctx.organizationId,
        createdBy: ctx.user.id,
      });

      // Handle portal access if requested
      if (input.grantPortalAccess && input.email) {
        await service.enablePortalAccess({
          contactId: contact.id,
          sendInvitation: true,
          organizationId: ctx.organizationId,
          createdBy: ctx.user.id,
        });
      }

      // Create timeline event
      await ctx.events.emit('CONTACT_CREATED', {
        clientId: input.clientId,
        contactId: contact.id,
        contactName: `${input.firstName} ${input.lastName}`,
        roles: input.roles,
        isPrimary: input.isPrimary,
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });

      // Audit log
      await ctx.audit.log({
        action: 'CONTACT_CREATED',
        entityType: 'contact',
        entityId: contact.id,
        details: {
          clientId: input.clientId,
          contactName: `${input.firstName} ${input.lastName}`,
          roles: input.roles,
        },
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });

      return contact;
    }),

  // Update contact
  update: protectedProcedure
    .input(z.object({
      contactId: z.string().uuid(),
      data: UpdateContactSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ContactService(ctx.db, ctx.events);

      // Get existing contact
      const existing = await service.findById(input.contactId, ctx.organizationId);
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contact not found',
        });
      }

      // Handle primary contact changes
      if (input.data.isPrimary === true && !existing.isPrimary) {
        await service.transferPrimaryStatus(existing.clientId, input.contactId);
      }

      const contact = await service.update({
        contactId: input.contactId,
        data: input.data,
        updatedBy: ctx.user.id,
        previousData: existing,
      });

      // Calculate changed fields for audit
      const changedFields = Object.keys(input.data).filter(
        key => input.data[key] !== existing[key]
      );

      await ctx.events.emit('CONTACT_UPDATED', {
        clientId: existing.clientId,
        contactId: input.contactId,
        contactName: `${contact.firstName} ${contact.lastName}`,
        changedFields,
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });

      await ctx.audit.log({
        action: 'CONTACT_UPDATED',
        entityType: 'contact',
        entityId: contact.id,
        details: {
          changedFields,
          changes: changedFields.map(field => ({
            field,
            from: existing[field],
            to: contact[field],
          })),
        },
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });

      return contact;
    }),

  // Delete (soft delete) contact
  delete: protectedProcedure
    .input(z.object({ contactId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ContactService(ctx.db, ctx.events);

      const contact = await service.findById(input.contactId, ctx.organizationId);
      if (!contact) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contact not found',
        });
      }

      // Check if primary contact
      if (contact.isPrimary) {
        // Check if there are other active contacts
        const otherContacts = await service.listByClient(contact.clientId, {
          isActive: true,
        });

        if (otherContacts.length <= 1) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Cannot remove the only primary contact. Add another contact first.',
          });
        }
      }

      await service.delete(input.contactId, ctx.user.id);

      await ctx.events.emit('CONTACT_REMOVED', {
        clientId: contact.clientId,
        contactId: input.contactId,
        contactName: `${contact.firstName} ${contact.lastName}`,
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });

      await ctx.audit.log({
        action: 'CONTACT_DELETED',
        entityType: 'contact',
        entityId: input.contactId,
        details: {
          clientId: contact.clientId,
          contactName: `${contact.firstName} ${contact.lastName}`,
        },
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });

      return { success: true };
    }),

  // List contacts for client
  list: protectedProcedure
    .input(ListContactsSchema)
    .query(async ({ ctx, input }) => {
      const service = new ContactService(ctx.db, ctx.events);

      // Verify client access
      const client = await ctx.db.clients.findFirst({
        where: {
          id: input.clientId,
          organizationId: ctx.organizationId,
        },
      });

      if (!client) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found',
        });
      }

      return service.listByClient(input.clientId, {
        roles: input.roles,
        hasPortalAccess: input.hasPortalAccess,
        isActive: input.isActive ?? true,
        search: input.search,
      });
    }),

  // Get single contact
  getById: protectedProcedure
    .input(z.object({ contactId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new ContactService(ctx.db, ctx.events);

      const contact = await service.findById(input.contactId, ctx.organizationId);
      if (!contact) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contact not found',
        });
      }

      return contact;
    }),

  // Set primary contact
  setPrimary: protectedProcedure
    .input(z.object({ contactId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new ContactService(ctx.db, ctx.events);

      const contact = await service.findById(input.contactId, ctx.organizationId);
      if (!contact) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contact not found',
        });
      }

      if (contact.isPrimary) {
        return contact; // Already primary
      }

      await service.transferPrimaryStatus(contact.clientId, input.contactId);

      await ctx.events.emit('PRIMARY_CONTACT_CHANGED', {
        clientId: contact.clientId,
        newPrimaryId: input.contactId,
        contactName: `${contact.firstName} ${contact.lastName}`,
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });

      return service.findById(input.contactId, ctx.organizationId);
    }),

  // Enable portal access
  enablePortalAccess: protectedProcedure
    .input(EnablePortalAccessSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ContactService(ctx.db, ctx.events);

      const contact = await service.findById(input.contactId, ctx.organizationId);
      if (!contact) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contact not found',
        });
      }

      if (!contact.email) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Contact must have an email address for portal access',
        });
      }

      if (contact.hasPortalAccess) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Contact already has portal access',
        });
      }

      await service.enablePortalAccess({
        contactId: input.contactId,
        permissions: input.permissions,
        sendInvitation: input.sendInvitation,
        customMessage: input.customMessage,
        organizationId: ctx.organizationId,
        createdBy: ctx.user.id,
      });

      await ctx.events.emit('PORTAL_ACCESS_ENABLED', {
        clientId: contact.clientId,
        contactId: input.contactId,
        contactEmail: contact.email,
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });

      await ctx.audit.log({
        action: 'PORTAL_ACCESS_ENABLED',
        entityType: 'contact',
        entityId: input.contactId,
        details: {
          email: contact.email,
          permissions: input.permissions,
        },
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });

      return service.findById(input.contactId, ctx.organizationId);
    }),

  // Revoke portal access
  revokePortalAccess: protectedProcedure
    .input(RevokePortalAccessSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ContactService(ctx.db, ctx.events);

      const contact = await service.findById(input.contactId, ctx.organizationId);
      if (!contact) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contact not found',
        });
      }

      if (!contact.hasPortalAccess) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Contact does not have portal access',
        });
      }

      await service.revokePortalAccess({
        contactId: input.contactId,
        reason: input.reason,
        sendNotification: input.sendNotification,
        revokedBy: ctx.user.id,
      });

      await ctx.events.emit('PORTAL_ACCESS_REVOKED', {
        clientId: contact.clientId,
        contactId: input.contactId,
        reason: input.reason,
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });

      await ctx.audit.log({
        action: 'PORTAL_ACCESS_REVOKED',
        entityType: 'contact',
        entityId: input.contactId,
        details: { reason: input.reason },
        userId: ctx.user.id,
        organizationId: ctx.organizationId,
      });

      return { success: true };
    }),

  // Get contact history
  getHistory: protectedProcedure
    .input(z.object({
      contactId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const service = new ContactService(ctx.db, ctx.events);

      const contact = await service.findById(input.contactId, ctx.organizationId);
      if (!contact) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contact not found',
        });
      }

      return service.getHistory(input.contactId, input.limit);
    }),
});
```

### Service Implementation

```typescript
// contact.service.ts
import { EventEmitter } from '../events';

export class ContactService {
  constructor(
    private readonly db: Database,
    private readonly events: EventEmitter
  ) {}

  async create(params: {
    clientId: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    mobile?: string;
    fax?: string;
    roles: ContactRole[];
    position?: string;
    department?: string;
    isPrimary: boolean;
    preferences?: ContactPreferences;
    notes?: string;
    organizationId: string;
    createdBy: string;
  }): Promise<Contact> {
    const {
      clientId,
      isPrimary,
      organizationId,
      createdBy,
      ...contactData
    } = params;

    return this.db.$transaction(async (tx) => {
      // If setting as primary, clear existing primary
      if (isPrimary) {
        await tx.clientContacts.updateMany({
          where: { clientId, isPrimary: true, deletedAt: null },
          data: { isPrimary: false, updatedBy: createdBy },
        });
      }

      // Create the contact
      const contact = await tx.clientContacts.create({
        data: {
          ...contactData,
          clientId,
          organizationId,
          isPrimary,
          isActive: true,
          hasPortalAccess: false,
          portalStatus: 'NONE',
          consentData: {
            dataProcessing: {
              granted: true,
              grantedAt: new Date().toISOString(),
              purpose: 'Client relationship management',
              legalBasis: 'CONTRACT',
            },
            source: 'MANUAL_ENTRY',
            recordedBy: createdBy,
          },
          createdBy,
          updatedBy: createdBy,
        },
      });

      // Create history entry
      await tx.clientContactsHistory.create({
        data: {
          contactId: contact.id,
          snapshot: contact,
          changeType: 'CREATE',
          changedFields: Object.keys(contactData),
          changedBy: createdBy,
        },
      });

      return this.mapToResponse(contact);
    });
  }

  async update(params: {
    contactId: string;
    data: UpdateContact;
    updatedBy: string;
    previousData: Contact;
  }): Promise<Contact> {
    const { contactId, data, updatedBy, previousData } = params;

    const contact = await this.db.clientContacts.update({
      where: { id: contactId },
      data: {
        ...data,
        updatedBy,
        updatedAt: new Date(),
      },
    });

    // Create history entry
    const changedFields = Object.keys(data).filter(
      key => data[key] !== previousData[key]
    );

    await this.db.clientContactsHistory.create({
      data: {
        contactId,
        snapshot: contact,
        changeType: 'UPDATE',
        changedFields,
        changedBy: updatedBy,
      },
    });

    return this.mapToResponse(contact);
  }

  async delete(contactId: string, deletedBy: string): Promise<void> {
    const contact = await this.db.clientContacts.update({
      where: { id: contactId },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false,
      },
    });

    await this.db.clientContactsHistory.create({
      data: {
        contactId,
        snapshot: contact,
        changeType: 'DELETE',
        changedFields: ['deletedAt', 'deletedBy', 'isActive'],
        changedBy: deletedBy,
      },
    });
  }

  async transferPrimaryStatus(clientId: string, newPrimaryId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      // Remove primary from all contacts of this client
      await tx.clientContacts.updateMany({
        where: { clientId, deletedAt: null },
        data: { isPrimary: false },
      });

      // Set new primary
      await tx.clientContacts.update({
        where: { id: newPrimaryId },
        data: { isPrimary: true },
      });
    });
  }

  async enablePortalAccess(params: {
    contactId: string;
    permissions?: string[];
    sendInvitation: boolean;
    customMessage?: string;
    organizationId: string;
    createdBy: string;
  }): Promise<void> {
    const { contactId, permissions, sendInvitation, customMessage, organizationId, createdBy } = params;

    const contact = await this.db.clientContacts.findUnique({
      where: { id: contactId },
    });

    if (!contact?.email) {
      throw new Error('Contact must have email for portal access');
    }

    // Create portal user account
    const portalUser = await this.db.users.create({
      data: {
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        organizationId,
        role: 'CLIENT_PORTAL',
        permissions: permissions || ['VIEW_DOCUMENTS', 'VIEW_REPORTS'],
        status: 'PENDING_ACTIVATION',
        createdBy,
      },
    });

    // Update contact with portal info
    await this.db.clientContacts.update({
      where: { id: contactId },
      data: {
        hasPortalAccess: true,
        portalUserId: portalUser.id,
        portalStatus: 'PENDING',
        portalInvitedAt: new Date(),
      },
    });

    // Send invitation email
    if (sendInvitation) {
      await this.events.emit('SEND_PORTAL_INVITATION', {
        userId: portalUser.id,
        email: contact.email,
        firstName: contact.firstName,
        customMessage,
      });
    }
  }

  async revokePortalAccess(params: {
    contactId: string;
    reason?: string;
    sendNotification: boolean;
    revokedBy: string;
  }): Promise<void> {
    const { contactId, reason, sendNotification, revokedBy } = params;

    const contact = await this.db.clientContacts.findUnique({
      where: { id: contactId },
      include: { portalUser: true },
    });

    if (!contact?.portalUserId) {
      throw new Error('Contact does not have portal access');
    }

    // Deactivate portal user
    await this.db.users.update({
      where: { id: contact.portalUserId },
      data: {
        status: 'DEACTIVATED',
        deactivatedAt: new Date(),
        deactivationReason: reason,
      },
    });

    // Update contact
    await this.db.clientContacts.update({
      where: { id: contactId },
      data: {
        hasPortalAccess: false,
        portalStatus: 'REVOKED',
      },
    });

    // Send notification
    if (sendNotification && contact.email) {
      await this.events.emit('SEND_PORTAL_REVOCATION_NOTICE', {
        email: contact.email,
        firstName: contact.firstName,
        reason,
      });
    }
  }

  async findById(contactId: string, organizationId: string): Promise<Contact | null> {
    const contact = await this.db.clientContacts.findFirst({
      where: {
        id: contactId,
        organizationId,
        deletedAt: null,
      },
    });

    return contact ? this.mapToResponse(contact) : null;
  }

  async listByClient(clientId: string, filters: {
    roles?: ContactRole[];
    hasPortalAccess?: boolean;
    isActive?: boolean;
    search?: string;
  }): Promise<Contact[]> {
    const where: any = {
      clientId,
      deletedAt: null,
    };

    if (filters.roles?.length) {
      where.roles = { hasSome: filters.roles };
    }

    if (filters.hasPortalAccess !== undefined) {
      where.hasPortalAccess = filters.hasPortalAccess;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const contacts = await this.db.clientContacts.findMany({
      where,
      orderBy: [
        { isPrimary: 'desc' },
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });

    return contacts.map(this.mapToResponse);
  }

  async getHistory(contactId: string, limit: number): Promise<any[]> {
    return this.db.clientContactsHistory.findMany({
      where: { contactId },
      orderBy: { changedAt: 'desc' },
      take: limit,
      include: {
        changedByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  private mapToResponse(contact: any): Contact {
    return {
      id: contact.id,
      clientId: contact.clientId,
      firstName: contact.firstName,
      lastName: contact.lastName,
      fullName: `${contact.firstName} ${contact.lastName}`,
      email: contact.email,
      phone: contact.phone,
      mobile: contact.mobile,
      roles: contact.roles,
      position: contact.position,
      department: contact.department,
      isPrimary: contact.isPrimary,
      isActive: contact.isActive,
      hasPortalAccess: contact.hasPortalAccess,
      portalStatus: contact.portalStatus,
      preferences: contact.preferences,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    };
  }
}
```

---

## Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContactService } from './contact.service';

describe('ContactService', () => {
  let service: ContactService;
  let mockDb: any;
  let mockEvents: any;

  beforeEach(() => {
    mockDb = {
      clientContacts: {
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      clientContactsHistory: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      users: {
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn((fn) => fn(mockDb)),
    };
    mockEvents = {
      emit: vi.fn(),
    };
    service = new ContactService(mockDb, mockEvents);
  });

  describe('create', () => {
    it('should create contact with required fields', async () => {
      const contactData = {
        clientId: 'client-1',
        firstName: 'Jan',
        lastName: 'Kowalski',
        email: 'jan@example.com',
        roles: ['OWNER'],
        isPrimary: false,
        organizationId: 'org-1',
        createdBy: 'user-1',
      };

      mockDb.clientContacts.create.mockResolvedValue({
        id: 'contact-1',
        ...contactData,
        isActive: true,
        hasPortalAccess: false,
        portalStatus: 'NONE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(contactData);

      expect(result.firstName).toBe('Jan');
      expect(result.lastName).toBe('Kowalski');
      expect(result.fullName).toBe('Jan Kowalski');
    });

    it('should clear existing primary when setting new primary', async () => {
      const contactData = {
        clientId: 'client-1',
        firstName: 'Jan',
        lastName: 'Kowalski',
        email: 'jan@example.com',
        roles: ['OWNER'],
        isPrimary: true,
        organizationId: 'org-1',
        createdBy: 'user-1',
      };

      mockDb.clientContacts.create.mockResolvedValue({
        id: 'contact-1',
        ...contactData,
        isActive: true,
        hasPortalAccess: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.create(contactData);

      expect(mockDb.clientContacts.updateMany).toHaveBeenCalledWith({
        where: { clientId: 'client-1', isPrimary: true, deletedAt: null },
        data: { isPrimary: false, updatedBy: 'user-1' },
      });
    });
  });

  describe('transferPrimaryStatus', () => {
    it('should transfer primary status to new contact', async () => {
      await service.transferPrimaryStatus('client-1', 'contact-2');

      expect(mockDb.clientContacts.updateMany).toHaveBeenCalledWith({
        where: { clientId: 'client-1', deletedAt: null },
        data: { isPrimary: false },
      });

      expect(mockDb.clientContacts.update).toHaveBeenCalledWith({
        where: { id: 'contact-2' },
        data: { isPrimary: true },
      });
    });
  });

  describe('listByClient', () => {
    it('should filter contacts by role', async () => {
      mockDb.clientContacts.findMany.mockResolvedValue([]);

      await service.listByClient('client-1', { roles: ['ACCOUNTANT'] });

      expect(mockDb.clientContacts.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roles: { hasSome: ['ACCOUNTANT'] },
          }),
        })
      );
    });

    it('should search by name or email', async () => {
      mockDb.clientContacts.findMany.mockResolvedValue([]);

      await service.listByClient('client-1', { search: 'jan' });

      expect(mockDb.clientContacts.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { firstName: { contains: 'jan', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestContext, cleanupTestData } from '../test/helpers';
import { contactRouter } from './contact.router';

describe('Contact Management Integration', () => {
  let ctx: TestContext;
  let testClient: any;

  beforeAll(async () => {
    ctx = await createTestContext();
    testClient = await ctx.db.clients.create({
      data: {
        companyName: 'Test Company',
        nip: '1234567890',
        organizationId: ctx.organizationId,
        createdBy: ctx.user.id,
        updatedBy: ctx.user.id,
      },
    });
  });

  afterAll(async () => {
    await cleanupTestData(ctx);
  });

  describe('Contact CRUD', () => {
    it('should create contact for client', async () => {
      const result = await contactRouter.createCaller(ctx).create({
        clientId: testClient.id,
        firstName: 'Jan',
        lastName: 'Kowalski',
        email: 'jan@test.pl',
        phone: '+48 123 456 789',
        roles: ['OWNER'],
        isPrimary: true,
      });

      expect(result.firstName).toBe('Jan');
      expect(result.lastName).toBe('Kowalski');
      expect(result.isPrimary).toBe(true);
      expect(result.id).toBeDefined();
    });

    it('should list contacts for client', async () => {
      const result = await contactRouter.createCaller(ctx).list({
        clientId: testClient.id,
      });

      expect(result.length).toBeGreaterThan(0);
    });

    it('should update contact', async () => {
      // First create a contact
      const contact = await contactRouter.createCaller(ctx).create({
        clientId: testClient.id,
        firstName: 'Anna',
        lastName: 'Nowak',
        email: 'anna@test.pl',
        roles: ['ACCOUNTANT'],
        isPrimary: false,
      });

      // Then update it
      const updated = await contactRouter.createCaller(ctx).update({
        contactId: contact.id,
        data: { phone: '+48 987 654 321' },
      });

      expect(updated.phone).toBe('+48 987 654 321');
    });
  });

  describe('Primary Contact Management', () => {
    it('should transfer primary status', async () => {
      // Get current primary
      const contacts = await contactRouter.createCaller(ctx).list({
        clientId: testClient.id,
      });

      const nonPrimary = contacts.find(c => !c.isPrimary);
      if (nonPrimary) {
        const result = await contactRouter.createCaller(ctx).setPrimary({
          contactId: nonPrimary.id,
        });

        expect(result.isPrimary).toBe(true);
      }
    });
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Contact Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should add new contact to client', async ({ page }) => {
    await page.goto('/clients/test-client-id');
    await page.click('[data-testid="tab-contacts"]');
    await page.click('[data-testid="add-contact-btn"]');

    // Fill contact form
    await page.fill('[name="firstName"]', 'Jan');
    await page.fill('[name="lastName"]', 'Kowalski');
    await page.fill('[name="email"]', 'jan@test.pl');
    await page.fill('[name="phone"]', '+48 123 456 789');
    await page.selectOption('[name="role"]', 'OWNER');
    await page.check('[name="isPrimary"]');

    await page.click('[data-testid="save-contact-btn"]');

    // Verify contact appears in list
    await expect(page.locator('text=Jan Kowalski')).toBeVisible();
  });

  test('should enable portal access for contact', async ({ page }) => {
    await page.goto('/clients/test-client-id');
    await page.click('[data-testid="tab-contacts"]');

    // Click on contact row
    await page.click('text=Jan Kowalski');

    // Enable portal access
    await page.click('[data-testid="enable-portal-btn"]');
    await page.click('[data-testid="confirm-portal-access"]');

    // Verify status changed
    await expect(page.locator('[data-testid="portal-status"]')).toContainText('Pending');
  });
});
```

---

## Security Checklist

- [x] Contact email validated before portal access
- [x] Portal invitations use secure tokens
- [x] Contact deletion is soft-delete for audit trail
- [x] History table preserves all changes
- [x] Row-level security enforced
- [x] GDPR consent tracked for each contact
- [x] Sensitive data masked in audit logs
- [x] Rate limiting on contact operations
- [x] Input validation with Zod schemas
- [x] Portal access revocation immediate

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `CONTACT_CREATED` | New contact added | Contact name, roles, client ID |
| `CONTACT_UPDATED` | Contact modified | Changed fields, old/new values |
| `CONTACT_REMOVED` | Contact deleted | Contact name, client ID |
| `PRIMARY_CONTACT_CHANGED` | Primary status transferred | Previous/new primary IDs |
| `PORTAL_ACCESS_ENABLED` | Portal access granted | Email, permissions |
| `PORTAL_ACCESS_REVOKED` | Portal access removed | Reason, contact ID |

---

## Implementation Notes

### Contact Role Guidelines

| Role | Typical Responsibilities | Communication Types |
|------|-------------------------|---------------------|
| OWNER | Strategic decisions, contracts | Legal, business-critical |
| ACCOUNTANT | Daily operations, documents | Tax, financial |
| MANAGER | Department coordination | Operational |
| EMPLOYEE | Task execution | Task-specific |
| AUTHORIZED | Limited authorization | Specific matters only |

### Portal Access Flow

1. Accountant enables portal access for contact
2. System creates pending user account
3. Invitation email sent with secure link
4. Contact clicks link and sets password
5. Account activated, contact can access portal
6. All portal activity logged for audit

### GDPR/RODO Compliance

- Consent recorded at contact creation
- Marketing consent separate from service consent
- Right to access: Export contact data
- Right to erasure: Anonymize instead of delete
- Consent source and timestamp tracked

---

*Last updated: December 2024*
