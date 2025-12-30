# CRM-012: Portal Access Management

> **Story ID**: CRM-012
> **Epic**: Core CRM Module (CRM)
> **Priority**: P2 (Extended)
> **Story Points**: 5
> **Phase**: Week 8
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant
**I want to** manage client portal access
**So that** clients can view their own information securely

---

## Description

### Overview
This story implements a comprehensive client portal access management system that enables accountants to grant and manage portal access for their clients. The portal allows clients to view their own company information, documents, invoices, and reports in a self-service manner, reducing the administrative burden on accountants while improving client satisfaction.

### Business Context
- **Self-Service**: Clients can access their data 24/7 without contacting the accountant
- **Transparency**: Improved client relationships through data visibility
- **Efficiency**: Reduced support requests for routine information queries
- **Security**: Controlled access with audit trails and permission management
- **Compliance**: RODO-compliant data access with consent management

### Key Features
1. **Portal User Management**: Create, invite, and manage portal user accounts
2. **Access Control**: Define permissions per client and per user
3. **Invitation System**: Secure invitation workflow with token-based verification
4. **Activity Tracking**: Monitor and audit all portal user activities
5. **Data Visibility**: Configure what data clients can see
6. **Multi-User Support**: Multiple portal users per client with different roles

---

## Dependencies

### Requires
- **CRM-001**: Client Profile Management (client records)
- **CRM-004**: Contact Management (contact persons as portal users)
- **AIM Module**: Authentication infrastructure

### Required By
- **CSP Module**: Client Self-Service Portal frontend
- **DOC Module**: Document portal access

---

## Acceptance Criteria

### Feature: Portal User Management

```gherkin
Feature: Portal User Management
  As an accountant
  I want to manage portal users for my clients
  So that clients can access their information

  Background:
    Given I am logged in as an accountant
    And I have a client "ABC Company" with NIP "1234567890"
    And the client has contact "Jan Kowalski" with email "jan@abc.pl"

  Scenario: Invite contact as portal user
    Given contact "Jan Kowalski" is not a portal user
    When I invite "Jan Kowalski" to the client portal
    And I assign the "owner" role
    Then an invitation email is sent to "jan@abc.pl"
    And a pending invitation record is created
    And the invitation expires in 7 days
    And an audit event "PORTAL_INVITATION_SENT" is logged

  Scenario: Resend portal invitation
    Given contact "Jan Kowalski" has a pending invitation
    And the invitation was sent more than 24 hours ago
    When I resend the invitation
    Then a new invitation token is generated
    And the old token is invalidated
    And a new email is sent to "jan@abc.pl"

  Scenario: Cancel pending invitation
    Given contact "Jan Kowalski" has a pending invitation
    When I cancel the invitation
    Then the invitation status changes to "CANCELLED"
    And the invitation token is invalidated
    And an audit event "PORTAL_INVITATION_CANCELLED" is logged

  Scenario: View portal users for client
    Given client "ABC Company" has 3 active portal users
    And 1 pending invitation
    When I view the portal users for "ABC Company"
    Then I see a list of 3 active users with their roles
    And I see 1 pending invitation
    And I see last login timestamps for active users

  Scenario: Disable portal user access
    Given "Jan Kowalski" is an active portal user
    When I disable their portal access
    Then their account status changes to "DISABLED"
    And they cannot log in to the portal
    And active sessions are terminated
    And an audit event "PORTAL_USER_DISABLED" is logged

  Scenario: Re-enable portal user access
    Given "Jan Kowalski" has disabled portal access
    When I re-enable their access
    Then their account status changes to "ACTIVE"
    And they can log in again
    And an audit event "PORTAL_USER_ENABLED" is logged
```

### Feature: Portal User Invitation Flow

```gherkin
Feature: Portal User Invitation Flow
  As a contact person
  I want to accept a portal invitation
  So that I can access my company's information

  Scenario: Accept invitation and create account
    Given I received a portal invitation email
    And the invitation token is valid
    When I click the invitation link
    And I set my password "SecureP@ss123"
    And I accept the terms of service
    And I provide RODO consent
    Then my portal account is created
    And my status changes to "ACTIVE"
    And I am redirected to the portal dashboard
    And an audit event "PORTAL_USER_ACTIVATED" is logged

  Scenario: Reject expired invitation
    Given I have an invitation link
    And the invitation has expired
    When I click the invitation link
    Then I see an "Invitation expired" message
    And I am prompted to contact my accountant
    And an audit event "PORTAL_INVITATION_EXPIRED_ACCESS" is logged

  Scenario: Reject used invitation
    Given I have already accepted my invitation
    When I click the invitation link again
    Then I see an "Already registered" message
    And I am redirected to the login page
```

### Feature: Portal Access Permissions

```gherkin
Feature: Portal Access Permissions
  As an accountant
  I want to configure portal permissions
  So that clients see only appropriate information

  Background:
    Given I am logged in as an accountant
    And "Jan Kowalski" is an active portal user for "ABC Company"

  Scenario: Configure data visibility
    When I configure portal permissions for "ABC Company"
    Then I can toggle visibility for:
      | Section          | Default |
      | Company Profile  | ON      |
      | Documents        | ON      |
      | Invoices         | ON      |
      | Financial Reports| OFF     |
      | Tax Declarations | OFF     |
      | Bank Accounts    | OFF     |
    And changes are saved immediately
    And an audit event "PORTAL_PERMISSIONS_UPDATED" is logged

  Scenario: Assign portal user role
    Given the available roles are:
      | Role     | Description                              |
      | owner    | Full access to all permitted sections    |
      | manager  | View and download, no settings           |
      | employee | View only, limited to specific sections  |
    When I change "Jan Kowalski" role to "manager"
    Then their permissions are updated accordingly
    And an audit event "PORTAL_ROLE_CHANGED" is logged

  Scenario: Configure section-level permissions per user
    Given "Jan Kowalski" has role "employee"
    When I configure their specific permissions
    Then I can grant or revoke access to:
      | Section         | Access  |
      | Company Profile | View    |
      | Documents       | View    |
      | Invoices        | None    |
    And custom permissions override role defaults
```

### Feature: Portal Activity Tracking

```gherkin
Feature: Portal Activity Tracking
  As an accountant
  I want to track portal user activities
  So that I can monitor client engagement and security

  Background:
    Given I am logged in as an accountant
    And "Jan Kowalski" is an active portal user

  Scenario: View portal activity log
    Given "Jan Kowalski" has logged into the portal
    And they have viewed documents and downloaded invoices
    When I view the activity log for "ABC Company"
    Then I see a chronological list of activities:
      | Timestamp           | User          | Action           | Details              |
      | 2024-01-15 10:30:00 | Jan Kowalski  | LOGIN            | IP: 192.168.1.1      |
      | 2024-01-15 10:32:00 | Jan Kowalski  | VIEW_DOCUMENTS   | Folder: Invoices     |
      | 2024-01-15 10:35:00 | Jan Kowalski  | DOWNLOAD         | File: FV/2024/001    |
    And I can filter by user, action type, and date range

  Scenario: Track login attempts
    Given "Jan Kowalski" attempts to log in
    When they enter wrong password 3 times
    Then login attempts are logged with:
      | Status | IP Address    | Timestamp           |
      | FAILED | 192.168.1.1  | 2024-01-15 10:00:00 |
      | FAILED | 192.168.1.1  | 2024-01-15 10:00:30 |
      | FAILED | 192.168.1.1  | 2024-01-15 10:01:00 |
    And account is temporarily locked
    And accountant receives notification

  Scenario: Monitor active sessions
    Given "Jan Kowalski" is logged into the portal
    When I view active sessions
    Then I see current session details:
      | Device        | Browser | IP          | Started             |
      | Desktop       | Chrome  | 192.168.1.1 | 2024-01-15 10:30:00 |
    And I can terminate sessions remotely
```

### Feature: Bulk Portal Operations

```gherkin
Feature: Bulk Portal Operations
  As an accountant
  I want to manage portal access for multiple clients
  So that I can efficiently onboard and offboard clients

  Scenario: Bulk invite contacts to portal
    Given I have 10 clients with primary contacts
    And none of them have portal access
    When I select all 10 clients
    And I choose "Invite to Portal"
    And I select role "owner" for all
    Then 10 invitation emails are queued
    And 10 pending invitations are created
    And a summary shows success/failure counts

  Scenario: Bulk disable portal access
    Given I have selected 5 clients with active portal users
    When I choose "Disable Portal Access"
    And I confirm the action
    Then all portal users for selected clients are disabled
    And active sessions are terminated
    And an audit event is logged for each user
```

---

## Technical Specification

### Database Schema

```sql
-- Portal users table (extends AIM users for portal-specific data)
CREATE TABLE portal_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES client_contacts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- AIM user after activation

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 'ACTIVE', 'DISABLED', 'SUSPENDED', 'DELETED'
    )),

    -- Role and permissions
    role VARCHAR(20) NOT NULL DEFAULT 'employee' CHECK (role IN (
        'owner', 'manager', 'employee'
    )),
    custom_permissions JSONB DEFAULT '{}',

    -- Invitation tracking
    invitation_token UUID,
    invitation_sent_at TIMESTAMPTZ,
    invitation_expires_at TIMESTAMPTZ,
    invitation_accepted_at TIMESTAMPTZ,

    -- Consent and compliance
    terms_accepted_at TIMESTAMPTZ,
    rodo_consent_at TIMESTAMPTZ,
    rodo_consent_version VARCHAR(20),

    -- Activity tracking
    last_login_at TIMESTAMPTZ,
    login_count INTEGER DEFAULT 0,
    last_activity_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),

    -- Constraints
    CONSTRAINT unique_client_contact UNIQUE (client_id, contact_id),
    CONSTRAINT unique_invitation_token UNIQUE (invitation_token)
);

-- Portal permission presets per client
CREATE TABLE portal_client_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

    -- Global visibility settings
    profile_visible BOOLEAN DEFAULT TRUE,
    documents_visible BOOLEAN DEFAULT TRUE,
    invoices_visible BOOLEAN DEFAULT TRUE,
    financial_reports_visible BOOLEAN DEFAULT FALSE,
    tax_declarations_visible BOOLEAN DEFAULT FALSE,
    bank_accounts_visible BOOLEAN DEFAULT FALSE,

    -- Feature settings
    allow_document_upload BOOLEAN DEFAULT FALSE,
    allow_message_sending BOOLEAN DEFAULT TRUE,
    allow_data_export BOOLEAN DEFAULT FALSE,

    -- Notification settings
    notify_on_new_document BOOLEAN DEFAULT TRUE,
    notify_on_invoice BOOLEAN DEFAULT TRUE,
    notify_on_deadline BOOLEAN DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_client_settings UNIQUE (client_id)
);

-- Portal activity log
CREATE TABLE portal_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    portal_user_id UUID REFERENCES portal_users(id) ON DELETE SET NULL,

    -- Activity details
    action VARCHAR(50) NOT NULL,
    action_category VARCHAR(30) NOT NULL CHECK (action_category IN (
        'AUTH', 'VIEW', 'DOWNLOAD', 'UPLOAD', 'MESSAGE', 'SETTINGS', 'EXPORT'
    )),
    resource_type VARCHAR(50),
    resource_id UUID,
    resource_name VARCHAR(255),

    -- Context
    ip_address INET,
    user_agent TEXT,
    device_type VARCHAR(20),
    browser VARCHAR(50),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN (
        'SUCCESS', 'FAILED', 'BLOCKED'
    )),
    failure_reason TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Portal sessions
CREATE TABLE portal_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_user_id UUID NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,

    -- Session info
    session_token_hash VARCHAR(64) NOT NULL,
    refresh_token_hash VARCHAR(64),

    -- Device info
    ip_address INET NOT NULL,
    user_agent TEXT,
    device_type VARCHAR(20),
    browser VARCHAR(50),
    device_fingerprint VARCHAR(64),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    terminated_at TIMESTAMPTZ,
    terminated_by UUID REFERENCES users(id),
    termination_reason VARCHAR(50),

    CONSTRAINT unique_session_token UNIQUE (session_token_hash)
);

-- Indexes
CREATE INDEX idx_portal_users_client ON portal_users(client_id);
CREATE INDEX idx_portal_users_status ON portal_users(status);
CREATE INDEX idx_portal_users_invitation_token ON portal_users(invitation_token) WHERE invitation_token IS NOT NULL;
CREATE INDEX idx_portal_activity_client ON portal_activity_log(client_id);
CREATE INDEX idx_portal_activity_user ON portal_activity_log(portal_user_id);
CREATE INDEX idx_portal_activity_created ON portal_activity_log(created_at DESC);
CREATE INDEX idx_portal_sessions_user ON portal_sessions(portal_user_id);
CREATE INDEX idx_portal_sessions_active ON portal_sessions(is_active) WHERE is_active = TRUE;

-- Row Level Security
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_client_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY portal_users_isolation ON portal_users
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY portal_settings_isolation ON portal_client_settings
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY portal_activity_isolation ON portal_activity_log
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY portal_sessions_isolation ON portal_sessions
    USING (portal_user_id IN (
        SELECT id FROM portal_users
        WHERE organization_id = current_setting('app.current_organization_id')::UUID
    ));
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Enums
export const PortalUserStatus = z.enum([
  'PENDING',
  'ACTIVE',
  'DISABLED',
  'SUSPENDED',
  'DELETED'
]);

export const PortalRole = z.enum([
  'owner',
  'manager',
  'employee'
]);

export const ActivityCategory = z.enum([
  'AUTH',
  'VIEW',
  'DOWNLOAD',
  'UPLOAD',
  'MESSAGE',
  'SETTINGS',
  'EXPORT'
]);

export const ActivityStatus = z.enum([
  'SUCCESS',
  'FAILED',
  'BLOCKED'
]);

// Portal User Schemas
export const PortalUserSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),
  contactId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  status: PortalUserStatus,
  role: PortalRole,
  customPermissions: z.record(z.boolean()).optional(),
  invitationSentAt: z.date().nullable(),
  invitationExpiresAt: z.date().nullable(),
  invitationAcceptedAt: z.date().nullable(),
  termsAcceptedAt: z.date().nullable(),
  rodoConsentAt: z.date().nullable(),
  lastLoginAt: z.date().nullable(),
  loginCount: z.number().int().min(0),
  lastActivityAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PortalUser = z.infer<typeof PortalUserSchema>;

// Invitation Schemas
export const InviteToPortalInputSchema = z.object({
  clientId: z.string().uuid(),
  contactId: z.string().uuid(),
  role: PortalRole.default('employee'),
  customPermissions: z.record(z.boolean()).optional(),
  sendEmail: z.boolean().default(true),
  expirationDays: z.number().int().min(1).max(30).default(7),
});

export type InviteToPortalInput = z.infer<typeof InviteToPortalInputSchema>;

export const AcceptInvitationInputSchema = z.object({
  token: z.string().uuid(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain special character'),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept terms of service' }),
  }),
  acceptRodo: z.literal(true, {
    errorMap: () => ({ message: 'RODO consent is required' }),
  }),
});

export type AcceptInvitationInput = z.infer<typeof AcceptInvitationInputSchema>;

// Portal Settings Schemas
export const PortalClientSettingsSchema = z.object({
  clientId: z.string().uuid(),
  profileVisible: z.boolean().default(true),
  documentsVisible: z.boolean().default(true),
  invoicesVisible: z.boolean().default(true),
  financialReportsVisible: z.boolean().default(false),
  taxDeclarationsVisible: z.boolean().default(false),
  bankAccountsVisible: z.boolean().default(false),
  allowDocumentUpload: z.boolean().default(false),
  allowMessageSending: z.boolean().default(true),
  allowDataExport: z.boolean().default(false),
  notifyOnNewDocument: z.boolean().default(true),
  notifyOnInvoice: z.boolean().default(true),
  notifyOnDeadline: z.boolean().default(true),
});

export type PortalClientSettings = z.infer<typeof PortalClientSettingsSchema>;

export const UpdatePortalSettingsInputSchema = PortalClientSettingsSchema.partial().required({
  clientId: true,
});

export type UpdatePortalSettingsInput = z.infer<typeof UpdatePortalSettingsInputSchema>;

// Permission Schemas
export const UpdatePortalUserInputSchema = z.object({
  portalUserId: z.string().uuid(),
  role: PortalRole.optional(),
  customPermissions: z.record(z.boolean()).optional(),
  status: z.enum(['ACTIVE', 'DISABLED', 'SUSPENDED']).optional(),
});

export type UpdatePortalUserInput = z.infer<typeof UpdatePortalUserInputSchema>;

// Activity Log Schemas
export const PortalActivitySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),
  portalUserId: z.string().uuid().nullable(),
  action: z.string(),
  actionCategory: ActivityCategory,
  resourceType: z.string().nullable(),
  resourceId: z.string().uuid().nullable(),
  resourceName: z.string().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  deviceType: z.string().nullable(),
  browser: z.string().nullable(),
  status: ActivityStatus,
  failureReason: z.string().nullable(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
});

export type PortalActivity = z.infer<typeof PortalActivitySchema>;

export const GetActivityLogInputSchema = z.object({
  clientId: z.string().uuid().optional(),
  portalUserId: z.string().uuid().optional(),
  actionCategory: ActivityCategory.optional(),
  status: ActivityStatus.optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type GetActivityLogInput = z.infer<typeof GetActivityLogInputSchema>;

// Session Schemas
export const PortalSessionSchema = z.object({
  id: z.string().uuid(),
  portalUserId: z.string().uuid(),
  ipAddress: z.string(),
  userAgent: z.string().nullable(),
  deviceType: z.string().nullable(),
  browser: z.string().nullable(),
  isActive: z.boolean(),
  startedAt: z.date(),
  lastActivityAt: z.date(),
  expiresAt: z.date(),
});

export type PortalSession = z.infer<typeof PortalSessionSchema>;

// Bulk Operations Schemas
export const BulkInviteInputSchema = z.object({
  invitations: z.array(z.object({
    clientId: z.string().uuid(),
    contactId: z.string().uuid(),
    role: PortalRole.default('owner'),
  })).min(1).max(100),
  sendEmails: z.boolean().default(true),
  expirationDays: z.number().int().min(1).max(30).default(7),
});

export type BulkInviteInput = z.infer<typeof BulkInviteInputSchema>;

export const BulkDisableInputSchema = z.object({
  clientIds: z.array(z.string().uuid()).min(1).max(100),
  terminateSessions: z.boolean().default(true),
});

export type BulkDisableInput = z.infer<typeof BulkDisableInputSchema>;
```

### Service Layer

```typescript
// src/server/services/portal-access.service.ts

import { TRPCError } from '@trpc/server';
import { db } from '../db';
import {
  InviteToPortalInput,
  AcceptInvitationInput,
  UpdatePortalUserInput,
  UpdatePortalSettingsInput,
  GetActivityLogInput,
  BulkInviteInput,
  BulkDisableInput,
  PortalUser,
  PortalClientSettings,
  PortalActivity,
  PortalSession
} from '../schemas/portal-access.schema';
import { v4 as uuidv4 } from 'uuid';
import { addDays, isAfter } from 'date-fns';
import * as bcrypt from 'bcrypt';
import { emailService } from './email.service';
import { auditService } from './audit.service';
import { UAParser } from 'ua-parser-js';

interface PortalContext {
  organizationId: string;
  userId: string;
}

export class PortalAccessService {
  // ==================== PORTAL USER MANAGEMENT ====================

  async inviteToPortal(
    ctx: PortalContext,
    input: InviteToPortalInput
  ): Promise<PortalUser> {
    // Verify client belongs to organization
    const client = await db.client.findFirst({
      where: {
        id: input.clientId,
        organizationId: ctx.organizationId
      },
      include: { contacts: true }
    });

    if (!client) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Client not found',
      });
    }

    // Verify contact belongs to client
    const contact = client.contacts.find(c => c.id === input.contactId);
    if (!contact) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Contact not found for this client',
      });
    }

    // Check if already invited
    const existingUser = await db.portalUser.findUnique({
      where: {
        clientId_contactId: {
          clientId: input.clientId,
          contactId: input.contactId,
        }
      }
    });

    if (existingUser) {
      if (existingUser.status === 'ACTIVE') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This contact already has portal access',
        });
      }

      if (existingUser.status === 'PENDING') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An invitation is already pending for this contact',
        });
      }
    }

    // Generate invitation token
    const invitationToken = uuidv4();
    const expiresAt = addDays(new Date(), input.expirationDays);

    // Create or update portal user
    const portalUser = await db.portalUser.upsert({
      where: {
        clientId_contactId: {
          clientId: input.clientId,
          contactId: input.contactId,
        }
      },
      create: {
        organizationId: ctx.organizationId,
        clientId: input.clientId,
        contactId: input.contactId,
        role: input.role,
        customPermissions: input.customPermissions || {},
        status: 'PENDING',
        invitationToken,
        invitationSentAt: new Date(),
        invitationExpiresAt: expiresAt,
        createdBy: ctx.userId,
      },
      update: {
        status: 'PENDING',
        role: input.role,
        customPermissions: input.customPermissions || {},
        invitationToken,
        invitationSentAt: new Date(),
        invitationExpiresAt: expiresAt,
        updatedBy: ctx.userId,
      },
    });

    // Send invitation email
    if (input.sendEmail && contact.email) {
      await emailService.sendPortalInvitation({
        to: contact.email,
        recipientName: `${contact.firstName} ${contact.lastName}`,
        clientName: client.companyName,
        invitationToken,
        expiresAt,
      });
    }

    // Log audit event
    await auditService.log({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'PORTAL_INVITATION_SENT',
      resourceType: 'portal_user',
      resourceId: portalUser.id,
      metadata: {
        clientId: input.clientId,
        contactId: input.contactId,
        role: input.role,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return portalUser;
  }

  async resendInvitation(
    ctx: PortalContext,
    portalUserId: string
  ): Promise<PortalUser> {
    const portalUser = await db.portalUser.findFirst({
      where: {
        id: portalUserId,
        organizationId: ctx.organizationId
      },
      include: {
        contact: true,
        client: true
      }
    });

    if (!portalUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Portal user not found',
      });
    }

    if (portalUser.status !== 'PENDING') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Can only resend invitation for pending users',
      });
    }

    // Generate new token
    const invitationToken = uuidv4();
    const expiresAt = addDays(new Date(), 7);

    const updated = await db.portalUser.update({
      where: { id: portalUserId },
      data: {
        invitationToken,
        invitationSentAt: new Date(),
        invitationExpiresAt: expiresAt,
        updatedBy: ctx.userId,
      },
    });

    // Send email
    if (portalUser.contact.email) {
      await emailService.sendPortalInvitation({
        to: portalUser.contact.email,
        recipientName: `${portalUser.contact.firstName} ${portalUser.contact.lastName}`,
        clientName: portalUser.client.companyName,
        invitationToken,
        expiresAt,
      });
    }

    await auditService.log({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'PORTAL_INVITATION_RESENT',
      resourceType: 'portal_user',
      resourceId: portalUserId,
    });

    return updated;
  }

  async cancelInvitation(
    ctx: PortalContext,
    portalUserId: string
  ): Promise<void> {
    const portalUser = await db.portalUser.findFirst({
      where: {
        id: portalUserId,
        organizationId: ctx.organizationId,
        status: 'PENDING'
      },
    });

    if (!portalUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Pending invitation not found',
      });
    }

    await db.portalUser.update({
      where: { id: portalUserId },
      data: {
        status: 'DELETED',
        invitationToken: null,
        updatedBy: ctx.userId,
      },
    });

    await auditService.log({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'PORTAL_INVITATION_CANCELLED',
      resourceType: 'portal_user',
      resourceId: portalUserId,
    });
  }

  async acceptInvitation(
    input: AcceptInvitationInput
  ): Promise<{ portalUser: PortalUser; sessionToken: string }> {
    const portalUser = await db.portalUser.findFirst({
      where: {
        invitationToken: input.token,
        status: 'PENDING'
      },
      include: {
        contact: true,
        client: true,
        organization: true
      }
    });

    if (!portalUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Invalid or already used invitation',
      });
    }

    // Check expiration
    if (portalUser.invitationExpiresAt && isAfter(new Date(), portalUser.invitationExpiresAt)) {
      await this.logActivity({
        organizationId: portalUser.organizationId,
        clientId: portalUser.clientId,
        portalUserId: portalUser.id,
        action: 'INVITATION_EXPIRED_ACCESS',
        actionCategory: 'AUTH',
        status: 'BLOCKED',
      });

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invitation has expired. Please contact your accountant.',
      });
    }

    // Create AIM user account
    const passwordHash = await bcrypt.hash(input.password, 12);

    const aimUser = await db.user.create({
      data: {
        email: portalUser.contact.email!,
        passwordHash,
        firstName: portalUser.contact.firstName,
        lastName: portalUser.contact.lastName,
        role: 'portal_user',
        organizationId: portalUser.organizationId,
        emailVerified: true, // Verified through invitation
        isActive: true,
      },
    });

    // Update portal user
    const updatedPortalUser = await db.portalUser.update({
      where: { id: portalUser.id },
      data: {
        userId: aimUser.id,
        status: 'ACTIVE',
        invitationToken: null,
        invitationAcceptedAt: new Date(),
        termsAcceptedAt: new Date(),
        rodoConsentAt: new Date(),
        rodoConsentVersion: '1.0',
      },
    });

    // Create session
    const sessionToken = uuidv4();
    await this.createSession(portalUser.id, sessionToken, {});

    await auditService.log({
      organizationId: portalUser.organizationId,
      userId: aimUser.id,
      action: 'PORTAL_USER_ACTIVATED',
      resourceType: 'portal_user',
      resourceId: portalUser.id,
    });

    return {
      portalUser: updatedPortalUser,
      sessionToken
    };
  }

  async getPortalUsers(
    ctx: PortalContext,
    clientId: string
  ): Promise<PortalUser[]> {
    return db.portalUser.findMany({
      where: {
        organizationId: ctx.organizationId,
        clientId,
        status: { not: 'DELETED' },
      },
      include: {
        contact: true,
        user: {
          select: { email: true, lastLoginAt: true }
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updatePortalUser(
    ctx: PortalContext,
    input: UpdatePortalUserInput
  ): Promise<PortalUser> {
    const portalUser = await db.portalUser.findFirst({
      where: {
        id: input.portalUserId,
        organizationId: ctx.organizationId
      },
    });

    if (!portalUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Portal user not found',
      });
    }

    const previousStatus = portalUser.status;

    const updated = await db.portalUser.update({
      where: { id: input.portalUserId },
      data: {
        role: input.role,
        customPermissions: input.customPermissions,
        status: input.status,
        updatedBy: ctx.userId,
      },
    });

    // Handle status changes
    if (input.status && input.status !== previousStatus) {
      if (input.status === 'DISABLED') {
        // Terminate active sessions
        await this.terminateUserSessions(input.portalUserId, ctx.userId, 'User disabled');

        await auditService.log({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: 'PORTAL_USER_DISABLED',
          resourceType: 'portal_user',
          resourceId: input.portalUserId,
        });
      } else if (input.status === 'ACTIVE' && previousStatus === 'DISABLED') {
        await auditService.log({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: 'PORTAL_USER_ENABLED',
          resourceType: 'portal_user',
          resourceId: input.portalUserId,
        });
      }
    }

    if (input.role && input.role !== portalUser.role) {
      await auditService.log({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'PORTAL_ROLE_CHANGED',
        resourceType: 'portal_user',
        resourceId: input.portalUserId,
        metadata: {
          previousRole: portalUser.role,
          newRole: input.role,
        },
      });
    }

    return updated;
  }

  // ==================== SETTINGS MANAGEMENT ====================

  async getPortalSettings(
    ctx: PortalContext,
    clientId: string
  ): Promise<PortalClientSettings> {
    let settings = await db.portalClientSettings.findUnique({
      where: { clientId },
    });

    if (!settings) {
      // Return defaults
      settings = await db.portalClientSettings.create({
        data: {
          organizationId: ctx.organizationId,
          clientId,
        },
      });
    }

    return settings;
  }

  async updatePortalSettings(
    ctx: PortalContext,
    input: UpdatePortalSettingsInput
  ): Promise<PortalClientSettings> {
    // Verify client belongs to organization
    const client = await db.client.findFirst({
      where: {
        id: input.clientId,
        organizationId: ctx.organizationId
      },
    });

    if (!client) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Client not found',
      });
    }

    const { clientId, ...settingsData } = input;

    const settings = await db.portalClientSettings.upsert({
      where: { clientId },
      create: {
        organizationId: ctx.organizationId,
        clientId,
        ...settingsData,
      },
      update: settingsData,
    });

    await auditService.log({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'PORTAL_PERMISSIONS_UPDATED',
      resourceType: 'portal_client_settings',
      resourceId: settings.id,
      metadata: { clientId, changes: settingsData },
    });

    return settings;
  }

  // ==================== ACTIVITY TRACKING ====================

  async logActivity(
    activity: {
      organizationId: string;
      clientId: string;
      portalUserId?: string;
      action: string;
      actionCategory: string;
      resourceType?: string;
      resourceId?: string;
      resourceName?: string;
      status?: string;
      failureReason?: string;
      metadata?: Record<string, unknown>;
    },
    request?: { ip?: string; headers?: Record<string, string> }
  ): Promise<PortalActivity> {
    let deviceInfo = {};

    if (request?.headers?.['user-agent']) {
      const parser = new UAParser(request.headers['user-agent']);
      const result = parser.getResult();
      deviceInfo = {
        deviceType: result.device.type || 'desktop',
        browser: result.browser.name,
        userAgent: request.headers['user-agent'],
      };
    }

    return db.portalActivityLog.create({
      data: {
        organizationId: activity.organizationId,
        clientId: activity.clientId,
        portalUserId: activity.portalUserId,
        action: activity.action,
        actionCategory: activity.actionCategory,
        resourceType: activity.resourceType,
        resourceId: activity.resourceId,
        resourceName: activity.resourceName,
        status: activity.status || 'SUCCESS',
        failureReason: activity.failureReason,
        metadata: activity.metadata || {},
        ipAddress: request?.ip,
        ...deviceInfo,
      },
    });
  }

  async getActivityLog(
    ctx: PortalContext,
    input: GetActivityLogInput
  ): Promise<{ activities: PortalActivity[]; total: number }> {
    const where: any = {
      organizationId: ctx.organizationId,
    };

    if (input.clientId) where.clientId = input.clientId;
    if (input.portalUserId) where.portalUserId = input.portalUserId;
    if (input.actionCategory) where.actionCategory = input.actionCategory;
    if (input.status) where.status = input.status;

    if (input.startDate || input.endDate) {
      where.createdAt = {};
      if (input.startDate) where.createdAt.gte = input.startDate;
      if (input.endDate) where.createdAt.lte = input.endDate;
    }

    const [activities, total] = await Promise.all([
      db.portalActivityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        skip: input.offset,
        include: {
          portalUser: {
            include: { contact: true }
          }
        }
      }),
      db.portalActivityLog.count({ where }),
    ]);

    return { activities, total };
  }

  // ==================== SESSION MANAGEMENT ====================

  async createSession(
    portalUserId: string,
    sessionToken: string,
    request: { ip?: string; userAgent?: string }
  ): Promise<PortalSession> {
    const tokenHash = await bcrypt.hash(sessionToken, 10);

    let deviceInfo = {};
    if (request.userAgent) {
      const parser = new UAParser(request.userAgent);
      const result = parser.getResult();
      deviceInfo = {
        deviceType: result.device.type || 'desktop',
        browser: result.browser.name,
        userAgent: request.userAgent,
      };
    }

    return db.portalSession.create({
      data: {
        portalUserId,
        sessionTokenHash: tokenHash,
        ipAddress: request.ip || '0.0.0.0',
        expiresAt: addDays(new Date(), 7), // 7 day session
        ...deviceInfo,
      },
    });
  }

  async getActiveSessions(
    ctx: PortalContext,
    portalUserId: string
  ): Promise<PortalSession[]> {
    // Verify access
    const portalUser = await db.portalUser.findFirst({
      where: {
        id: portalUserId,
        organizationId: ctx.organizationId
      },
    });

    if (!portalUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Portal user not found',
      });
    }

    return db.portalSession.findMany({
      where: {
        portalUserId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActivityAt: 'desc' },
    });
  }

  async terminateSession(
    ctx: PortalContext,
    sessionId: string
  ): Promise<void> {
    const session = await db.portalSession.findFirst({
      where: { id: sessionId },
      include: {
        portalUser: true,
      },
    });

    if (!session || session.portalUser.organizationId !== ctx.organizationId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Session not found',
      });
    }

    await db.portalSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        terminatedAt: new Date(),
        terminatedBy: ctx.userId,
        terminationReason: 'Manual termination by accountant',
      },
    });

    await auditService.log({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'PORTAL_SESSION_TERMINATED',
      resourceType: 'portal_session',
      resourceId: sessionId,
    });
  }

  private async terminateUserSessions(
    portalUserId: string,
    terminatedBy: string,
    reason: string
  ): Promise<number> {
    const result = await db.portalSession.updateMany({
      where: {
        portalUserId,
        isActive: true,
      },
      data: {
        isActive: false,
        terminatedAt: new Date(),
        terminatedBy,
        terminationReason: reason,
      },
    });

    return result.count;
  }

  // ==================== BULK OPERATIONS ====================

  async bulkInvite(
    ctx: PortalContext,
    input: BulkInviteInput
  ): Promise<{ successful: number; failed: Array<{ clientId: string; error: string }> }> {
    const results = {
      successful: 0,
      failed: [] as Array<{ clientId: string; error: string }>,
    };

    for (const invitation of input.invitations) {
      try {
        await this.inviteToPortal(ctx, {
          clientId: invitation.clientId,
          contactId: invitation.contactId,
          role: invitation.role,
          sendEmail: input.sendEmails,
          expirationDays: input.expirationDays,
        });
        results.successful++;
      } catch (error) {
        results.failed.push({
          clientId: invitation.clientId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    await auditService.log({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'PORTAL_BULK_INVITE',
      resourceType: 'portal_user',
      metadata: {
        totalRequested: input.invitations.length,
        successful: results.successful,
        failed: results.failed.length,
      },
    });

    return results;
  }

  async bulkDisable(
    ctx: PortalContext,
    input: BulkDisableInput
  ): Promise<{ disabledUsers: number; terminatedSessions: number }> {
    // Get all portal users for the specified clients
    const portalUsers = await db.portalUser.findMany({
      where: {
        organizationId: ctx.organizationId,
        clientId: { in: input.clientIds },
        status: 'ACTIVE',
      },
    });

    if (portalUsers.length === 0) {
      return { disabledUsers: 0, terminatedSessions: 0 };
    }

    const portalUserIds = portalUsers.map(u => u.id);

    // Disable users
    await db.portalUser.updateMany({
      where: { id: { in: portalUserIds } },
      data: {
        status: 'DISABLED',
        updatedBy: ctx.userId,
      },
    });

    // Terminate sessions if requested
    let terminatedSessions = 0;
    if (input.terminateSessions) {
      const result = await db.portalSession.updateMany({
        where: {
          portalUserId: { in: portalUserIds },
          isActive: true,
        },
        data: {
          isActive: false,
          terminatedAt: new Date(),
          terminatedBy: ctx.userId,
          terminationReason: 'Bulk disable operation',
        },
      });
      terminatedSessions = result.count;
    }

    // Log individual audit events
    for (const user of portalUsers) {
      await auditService.log({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'PORTAL_USER_DISABLED',
        resourceType: 'portal_user',
        resourceId: user.id,
        metadata: { reason: 'Bulk disable operation' },
      });
    }

    return {
      disabledUsers: portalUsers.length,
      terminatedSessions,
    };
  }
}

export const portalAccessService = new PortalAccessService();
```

### tRPC Router

```typescript
// src/server/routers/portal-access.router.ts

import { router, protectedProcedure, publicProcedure } from '../trpc';
import { portalAccessService } from '../services/portal-access.service';
import {
  InviteToPortalInputSchema,
  AcceptInvitationInputSchema,
  UpdatePortalUserInputSchema,
  UpdatePortalSettingsInputSchema,
  GetActivityLogInputSchema,
  BulkInviteInputSchema,
  BulkDisableInputSchema,
} from '../schemas/portal-access.schema';
import { z } from 'zod';

export const portalAccessRouter = router({
  // Portal User Management
  inviteToPortal: protectedProcedure
    .input(InviteToPortalInputSchema)
    .mutation(async ({ ctx, input }) => {
      return portalAccessService.inviteToPortal(
        { organizationId: ctx.organizationId, userId: ctx.userId },
        input
      );
    }),

  resendInvitation: protectedProcedure
    .input(z.object({ portalUserId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return portalAccessService.resendInvitation(
        { organizationId: ctx.organizationId, userId: ctx.userId },
        input.portalUserId
      );
    }),

  cancelInvitation: protectedProcedure
    .input(z.object({ portalUserId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return portalAccessService.cancelInvitation(
        { organizationId: ctx.organizationId, userId: ctx.userId },
        input.portalUserId
      );
    }),

  // Public endpoint for accepting invitations
  acceptInvitation: publicProcedure
    .input(AcceptInvitationInputSchema)
    .mutation(async ({ input, ctx }) => {
      return portalAccessService.acceptInvitation(input);
    }),

  // Validate invitation token (public)
  validateInvitation: publicProcedure
    .input(z.object({ token: z.string().uuid() }))
    .query(async ({ input }) => {
      const portalUser = await portalAccessService.validateInvitationToken(input.token);
      return {
        valid: !!portalUser,
        contactName: portalUser ?
          `${portalUser.contact.firstName} ${portalUser.contact.lastName}` : null,
        clientName: portalUser?.client.companyName || null,
        expired: portalUser?.invitationExpiresAt ?
          new Date() > portalUser.invitationExpiresAt : true,
      };
    }),

  getPortalUsers: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return portalAccessService.getPortalUsers(
        { organizationId: ctx.organizationId, userId: ctx.userId },
        input.clientId
      );
    }),

  updatePortalUser: protectedProcedure
    .input(UpdatePortalUserInputSchema)
    .mutation(async ({ ctx, input }) => {
      return portalAccessService.updatePortalUser(
        { organizationId: ctx.organizationId, userId: ctx.userId },
        input
      );
    }),

  // Settings Management
  getPortalSettings: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return portalAccessService.getPortalSettings(
        { organizationId: ctx.organizationId, userId: ctx.userId },
        input.clientId
      );
    }),

  updatePortalSettings: protectedProcedure
    .input(UpdatePortalSettingsInputSchema)
    .mutation(async ({ ctx, input }) => {
      return portalAccessService.updatePortalSettings(
        { organizationId: ctx.organizationId, userId: ctx.userId },
        input
      );
    }),

  // Activity Tracking
  getActivityLog: protectedProcedure
    .input(GetActivityLogInputSchema)
    .query(async ({ ctx, input }) => {
      return portalAccessService.getActivityLog(
        { organizationId: ctx.organizationId, userId: ctx.userId },
        input
      );
    }),

  // Session Management
  getActiveSessions: protectedProcedure
    .input(z.object({ portalUserId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return portalAccessService.getActiveSessions(
        { organizationId: ctx.organizationId, userId: ctx.userId },
        input.portalUserId
      );
    }),

  terminateSession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return portalAccessService.terminateSession(
        { organizationId: ctx.organizationId, userId: ctx.userId },
        input.sessionId
      );
    }),

  // Bulk Operations
  bulkInvite: protectedProcedure
    .input(BulkInviteInputSchema)
    .mutation(async ({ ctx, input }) => {
      return portalAccessService.bulkInvite(
        { organizationId: ctx.organizationId, userId: ctx.userId },
        input
      );
    }),

  bulkDisable: protectedProcedure
    .input(BulkDisableInputSchema)
    .mutation(async ({ ctx, input }) => {
      return portalAccessService.bulkDisable(
        { organizationId: ctx.organizationId, userId: ctx.userId },
        input
      );
    }),
});
```

---

## Test Specifications

### Unit Tests

```typescript
// src/server/services/__tests__/portal-access.service.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PortalAccessService } from '../portal-access.service';

describe('PortalAccessService', () => {
  let service: PortalAccessService;
  const mockCtx = {
    organizationId: 'org-123',
    userId: 'user-123',
  };

  beforeEach(() => {
    service = new PortalAccessService();
    vi.clearAllMocks();
  });

  describe('inviteToPortal', () => {
    it('should create invitation with valid token', async () => {
      const input = {
        clientId: 'client-123',
        contactId: 'contact-123',
        role: 'owner' as const,
        sendEmail: true,
        expirationDays: 7,
      };

      const result = await service.inviteToPortal(mockCtx, input);

      expect(result.status).toBe('PENDING');
      expect(result.role).toBe('owner');
      expect(result.invitationToken).toBeDefined();
      expect(result.invitationExpiresAt).toBeDefined();
    });

    it('should reject if contact already has active access', async () => {
      // Setup existing active user

      await expect(service.inviteToPortal(mockCtx, {
        clientId: 'client-123',
        contactId: 'existing-contact',
        role: 'owner',
      })).rejects.toThrow('already has portal access');
    });

    it('should set correct expiration date', async () => {
      const input = {
        clientId: 'client-123',
        contactId: 'contact-123',
        role: 'employee' as const,
        expirationDays: 14,
      };

      const result = await service.inviteToPortal(mockCtx, input);

      const expectedExpiry = new Date();
      expectedExpiry.setDate(expectedExpiry.getDate() + 14);

      expect(result.invitationExpiresAt?.getDate()).toBe(expectedExpiry.getDate());
    });
  });

  describe('acceptInvitation', () => {
    it('should activate user with valid token', async () => {
      const result = await service.acceptInvitation({
        token: 'valid-token-uuid',
        password: 'SecureP@ss123!',
        acceptTerms: true,
        acceptRodo: true,
      });

      expect(result.portalUser.status).toBe('ACTIVE');
      expect(result.portalUser.termsAcceptedAt).toBeDefined();
      expect(result.portalUser.rodoConsentAt).toBeDefined();
      expect(result.sessionToken).toBeDefined();
    });

    it('should reject expired invitation', async () => {
      await expect(service.acceptInvitation({
        token: 'expired-token-uuid',
        password: 'SecureP@ss123!',
        acceptTerms: true,
        acceptRodo: true,
      })).rejects.toThrow('expired');
    });

    it('should validate password requirements', async () => {
      await expect(service.acceptInvitation({
        token: 'valid-token-uuid',
        password: 'weak', // Too short, no special chars
        acceptTerms: true,
        acceptRodo: true,
      })).rejects.toThrow();
    });
  });

  describe('updatePortalUser', () => {
    it('should update role successfully', async () => {
      const result = await service.updatePortalUser(mockCtx, {
        portalUserId: 'portal-user-123',
        role: 'manager',
      });

      expect(result.role).toBe('manager');
    });

    it('should terminate sessions when disabling', async () => {
      const terminateSpy = vi.spyOn(service as any, 'terminateUserSessions');

      await service.updatePortalUser(mockCtx, {
        portalUserId: 'portal-user-123',
        status: 'DISABLED',
      });

      expect(terminateSpy).toHaveBeenCalled();
    });
  });

  describe('bulkInvite', () => {
    it('should process multiple invitations', async () => {
      const result = await service.bulkInvite(mockCtx, {
        invitations: [
          { clientId: 'client-1', contactId: 'contact-1', role: 'owner' },
          { clientId: 'client-2', contactId: 'contact-2', role: 'owner' },
        ],
        sendEmails: true,
        expirationDays: 7,
      });

      expect(result.successful).toBe(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should continue on individual failures', async () => {
      const result = await service.bulkInvite(mockCtx, {
        invitations: [
          { clientId: 'valid-client', contactId: 'contact-1', role: 'owner' },
          { clientId: 'invalid-client', contactId: 'contact-2', role: 'owner' },
        ],
        sendEmails: false,
        expirationDays: 7,
      });

      expect(result.successful).toBe(1);
      expect(result.failed).toHaveLength(1);
    });
  });
});
```

### Integration Tests

```typescript
// src/server/routers/__tests__/portal-access.router.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, cleanupTestData } from '../../test/helpers';
import { portalAccessRouter } from '../portal-access.router';

describe('Portal Access Router Integration', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let testClientId: string;
  let testContactId: string;
  let testPortalUserId: string;

  beforeAll(async () => {
    ctx = await createTestContext();

    // Create test client with contact
    const client = await ctx.db.client.create({
      data: {
        organizationId: ctx.organizationId,
        companyName: 'Test Company',
        nip: '1234567890',
        status: 'ACTIVE',
        createdBy: ctx.userId,
      },
    });
    testClientId = client.id;

    const contact = await ctx.db.clientContact.create({
      data: {
        clientId: testClientId,
        firstName: 'Jan',
        lastName: 'Testowy',
        email: 'jan@test.pl',
        isPrimary: true,
        createdBy: ctx.userId,
      },
    });
    testContactId = contact.id;
  });

  afterAll(async () => {
    await cleanupTestData(ctx);
  });

  it('should invite contact to portal', async () => {
    const caller = portalAccessRouter.createCaller(ctx);

    const result = await caller.inviteToPortal({
      clientId: testClientId,
      contactId: testContactId,
      role: 'owner',
      sendEmail: false,
    });

    testPortalUserId = result.id;

    expect(result.status).toBe('PENDING');
    expect(result.invitationToken).toBeDefined();
  });

  it('should list portal users for client', async () => {
    const caller = portalAccessRouter.createCaller(ctx);

    const users = await caller.getPortalUsers({ clientId: testClientId });

    expect(users).toHaveLength(1);
    expect(users[0].contactId).toBe(testContactId);
  });

  it('should update portal settings', async () => {
    const caller = portalAccessRouter.createCaller(ctx);

    const settings = await caller.updatePortalSettings({
      clientId: testClientId,
      documentsVisible: true,
      invoicesVisible: true,
      financialReportsVisible: false,
    });

    expect(settings.documentsVisible).toBe(true);
    expect(settings.financialReportsVisible).toBe(false);
  });

  it('should cancel invitation', async () => {
    const caller = portalAccessRouter.createCaller(ctx);

    await caller.cancelInvitation({ portalUserId: testPortalUserId });

    const users = await caller.getPortalUsers({ clientId: testClientId });
    expect(users).toHaveLength(0); // Cancelled = DELETED status, filtered out
  });
});
```

### E2E Tests

```typescript
// e2e/portal-access.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Portal Access Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'accountant@test.pl');
    await page.fill('[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should invite contact to portal', async ({ page }) => {
    // Navigate to client
    await page.goto('/clients/test-client-id');
    await page.click('text=Portal Access');

    // Open invitation dialog
    await page.click('text=Invite to Portal');

    // Select contact
    await page.click('[data-testid="contact-select"]');
    await page.click('text=Jan Kowalski');

    // Select role
    await page.click('[data-testid="role-select"]');
    await page.click('text=Owner');

    // Send invitation
    await page.click('text=Send Invitation');

    // Verify success
    await expect(page.locator('text=Invitation sent')).toBeVisible();
    await expect(page.locator('text=Jan Kowalski')).toBeVisible();
    await expect(page.locator('text=Pending')).toBeVisible();
  });

  test('should configure portal visibility settings', async ({ page }) => {
    await page.goto('/clients/test-client-id');
    await page.click('text=Portal Settings');

    // Toggle settings
    await page.click('[data-testid="toggle-financial-reports"]');
    await page.click('[data-testid="toggle-tax-declarations"]');

    // Save
    await page.click('text=Save Settings');

    // Verify
    await expect(page.locator('text=Settings saved')).toBeVisible();
    await expect(page.locator('[data-testid="toggle-financial-reports"]')).toBeChecked();
  });

  test('should view portal activity log', async ({ page }) => {
    await page.goto('/clients/test-client-id');
    await page.click('text=Portal Activity');

    // Verify activity list
    await expect(page.locator('[data-testid="activity-log"]')).toBeVisible();

    // Filter by action
    await page.click('[data-testid="action-filter"]');
    await page.click('text=Downloads');

    await expect(page.locator('[data-testid="activity-row"]').first()).toContainText('DOWNLOAD');
  });

  test('should terminate active session', async ({ page }) => {
    await page.goto('/clients/test-client-id');
    await page.click('text=Portal Access');

    // View active sessions
    await page.click('[data-testid="user-menu-jan"]');
    await page.click('text=Active Sessions');

    // Terminate session
    await page.click('[data-testid="terminate-session-btn"]');
    await page.click('text=Confirm');

    await expect(page.locator('text=Session terminated')).toBeVisible();
  });
});
```

---

## Security Checklist

### Authentication & Authorization
- [x] Secure invitation token generation (UUID v4)
- [x] Token expiration enforcement
- [x] Password strength requirements
- [x] Session management with secure token hashing
- [x] Organization isolation via RLS
- [x] Role-based permission checks

### Data Protection
- [x] RODO consent tracking
- [x] Terms of service acceptance
- [x] Activity audit logging
- [x] IP address logging for security
- [x] Session fingerprinting

### Security Controls
- [x] Failed login tracking
- [x] Account lockout capability
- [x] Remote session termination
- [x] Secure password reset flow (via AIM)
- [x] Invitation token single-use

### Input Validation
- [x] All inputs validated via Zod
- [x] UUID format validation
- [x] Email format validation
- [x] Password complexity rules

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `PORTAL_INVITATION_SENT` | Contact invited | clientId, contactId, role, expiresAt |
| `PORTAL_INVITATION_RESENT` | Invitation resent | portalUserId, newExpiresAt |
| `PORTAL_INVITATION_CANCELLED` | Invitation cancelled | portalUserId |
| `PORTAL_INVITATION_EXPIRED_ACCESS` | Expired token used | portalUserId, attemptedAt |
| `PORTAL_USER_ACTIVATED` | Invitation accepted | portalUserId, userId |
| `PORTAL_USER_DISABLED` | User disabled | portalUserId, reason |
| `PORTAL_USER_ENABLED` | User re-enabled | portalUserId |
| `PORTAL_ROLE_CHANGED` | Role updated | portalUserId, previousRole, newRole |
| `PORTAL_PERMISSIONS_UPDATED` | Settings changed | clientId, changes |
| `PORTAL_SESSION_TERMINATED` | Session ended | sessionId, terminatedBy |
| `PORTAL_BULK_INVITE` | Bulk operation | count, results |

---

## Implementation Notes

### Integration with AIM Module
- Portal users are linked to AIM users after invitation acceptance
- Authentication flows through AIM module
- Password reset handled by AIM password recovery

### Integration with CRM Module
- Portal users linked to client contacts (CRM-004)
- Client profile data shown based on permissions
- Activity logged to client timeline (CRM-005)

### Email Templates Required
- Portal invitation email
- Invitation reminder email
- Account activated confirmation
- Password reset (via AIM)

### Performance Considerations
- Index on invitation_token for fast lookup
- Index on portal_user status for filtering
- Activity log partitioning for high-volume clients
- Session cleanup job for expired sessions

### Future Enhancements
- Two-factor authentication for portal users
- Custom branding per organization
- API access tokens for integrations
- Delegation between portal users

---

*Story created: December 2024*
*Template version: 1.0*
