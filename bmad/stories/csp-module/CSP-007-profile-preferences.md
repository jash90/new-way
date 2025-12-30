# Story: CSP-007 - Profile & Preferences Management

## Story Overview

| Field | Value |
|-------|-------|
| Story ID | CSP-007 |
| Epic | CSP-EPIC (Client Self-Service Portal) |
| Title | Profile & Preferences Management |
| Priority | P2 |
| Story Points | 5 |
| Sprint | Sprint 3 (Week 31) |
| Status | Draft |
| Dependencies | CRM, AIM |

## User Story

**As a** portal client,
**I want** to view and manage my profile information and preferences,
**So that** I can keep my contact details up to date and customize the portal experience to my needs.

## Acceptance Criteria

### AC1: Profile Information View

```gherkin
Feature: Client Profile View
  As a portal client
  I want to view my profile information
  So that I can verify my data is correct

  Scenario: Display profile information
    Given I am logged into the portal
    When I navigate to my profile page
    Then I should see my profile sections:
      | section | description |
      | Personal info | Name, email, phone |
      | Company info | Company name, NIP, address |
      | Portal access | Role, permissions, last login |
      | Security | MFA status, password last changed |

  Scenario: View company details from CRM
    Given I am on my profile page
    When I view the company section
    Then I should see synchronized data from CRM:
      | field | editable |
      | Company name | No |
      | NIP | No |
      | REGON | No |
      | Primary address | Request change |
      | Industry | Request change |
```

### AC2: Personal Information Update

```gherkin
Feature: Personal Information Management
  As a portal client
  I want to update my personal information
  So that my contact details are current

  Scenario: Update contact information
    Given I am on the profile edit page
    When I update my personal information:
      | field | requirement |
      | First name | Required, 2-50 chars |
      | Last name | Required, 2-50 chars |
      | Phone | Optional, valid Polish format |
      | Alternate email | Optional, valid email |
    And I click "Zapisz zmiany"
    Then my profile should be updated
    And I should see a success message
    And the change should be logged in audit trail

  Scenario: Email change requires verification
    Given I want to change my primary email
    When I enter a new email address
    Then a verification email should be sent to the new address
    And my current email should remain active until verified
    And I should see "Weryfikacja w toku" status
```

### AC3: Security Settings

```gherkin
Feature: Security Settings Management
  As a security-conscious client
  I want to manage my security settings
  So that I can protect my account

  Scenario: Change password
    Given I am on the security settings page
    When I click "Zmień hasło"
    And I enter my current password
    And I enter a new password meeting requirements:
      | requirement | specification |
      | Min length | 12 characters |
      | Uppercase | At least 1 |
      | Lowercase | At least 1 |
      | Numbers | At least 1 |
      | Special chars | At least 1 |
    And I confirm the new password
    Then my password should be changed
    And I should receive email notification about the change
    And all other sessions should be invalidated

  Scenario: Enable MFA
    Given I don't have MFA enabled
    When I click "Włącz weryfikację dwuetapową"
    Then I should see MFA setup options:
      | method | description |
      | TOTP | Aplikacja autoryzacyjna |
      | SMS | Kod SMS |
    And I can complete the setup wizard

  Scenario: Disable MFA
    Given I have MFA enabled
    When I click "Wyłącz weryfikację dwuetapową"
    Then I must verify with current MFA code
    And I must enter my password
    Then MFA should be disabled with warning message

  Scenario: View active sessions
    Given I am on security settings
    When I view active sessions
    Then I should see all my active sessions:
      | info | description |
      | Device | Browser/device type |
      | Location | Approximate location |
      | IP address | Masked IP (last octet hidden) |
      | Last activity | Date and time |
      | Current | Marked if current session |
    And I can terminate any session except current
```

### AC4: Notification Preferences

```gherkin
Feature: Notification Preferences
  As a portal client
  I want to customize my notification settings
  So that I receive alerts in my preferred way

  Scenario: Configure email notifications
    Given I am on notification preferences
    When I configure email settings
    Then I should be able to set:
      | category | options |
      | New documents | Immediate, Daily digest, Off |
      | Messages | Immediate, Daily digest |
      | Report ready | Immediate, Off |
      | Deadlines | 7 days before, 3 days, 1 day, Off |
      | Invoice reminders | Immediate, Weekly, Off |

  Scenario: Configure push notifications
    Given I am on notification preferences
    When I enable push notifications
    Then I should grant browser permission
    And I can configure which events trigger push

  Scenario: Set quiet hours
    Given I am on notification preferences
    When I enable quiet hours
    Then I should set:
      | setting | default |
      | Start time | 22:00 |
      | End time | 07:00 |
      | Days | Codziennie |
      | Timezone | Europe/Warsaw |
    And no notifications should be sent during quiet hours

  Scenario: Configure digest settings
    Given I prefer daily digest
    When I set digest preferences
    Then I should choose:
      | setting | options |
      | Delivery time | 08:00, 09:00, 10:00 |
      | Include | Documents, Messages, Reports, All |
      | Format | Summary, Detailed |
```

### AC5: Display & Accessibility Preferences

```gherkin
Feature: Display Preferences
  As a portal client
  I want to customize the portal appearance
  So that it's comfortable for me to use

  Scenario: Language preference
    Given I am on display preferences
    When I change the language
    Then I can choose between:
      | language | code |
      | Polski | pl |
      | English | en |
    And the portal should immediately switch language
    And my preference should persist across sessions

  Scenario: Theme preference
    Given I am on display preferences
    When I change the theme
    Then I can choose:
      | theme | description |
      | Jasny | Light mode |
      | Ciemny | Dark mode |
      | Systemowy | Match system preference |
    And the theme should apply immediately

  Scenario: Date and number format
    Given I am on display preferences
    When I configure regional settings
    Then I should set:
      | setting | options |
      | Date format | DD.MM.YYYY, YYYY-MM-DD, MM/DD/YYYY |
      | Time format | 24h, 12h |
      | Number format | Polish (1 234,56), English (1,234.56) |
      | Currency display | PLN, zł |

  Scenario: Accessibility options
    Given I need accessibility accommodations
    When I configure accessibility settings
    Then I should be able to enable:
      | setting | description |
      | High contrast | Zwiększony kontrast kolorów |
      | Large text | Większy rozmiar czcionki |
      | Reduce motion | Ograniczenie animacji |
      | Screen reader hints | Dodatkowe opisy dla czytników |
```

## Technical Specification

### Database Schema

```sql
-- Client profile preferences (extends CRM client data)
CREATE TABLE portal_profiles (
  profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  alternate_email VARCHAR(255),
  alternate_email_verified BOOLEAN DEFAULT false,
  phone_number VARCHAR(20),
  avatar_url TEXT,
  timezone VARCHAR(50) DEFAULT 'Europe/Warsaw',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_portal_profile UNIQUE(tenant_id, client_id)
);

-- Security settings
CREATE TABLE portal_security_settings (
  setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_method VARCHAR(20),
  mfa_secret_encrypted TEXT,
  mfa_backup_codes_encrypted TEXT,
  password_last_changed TIMESTAMPTZ,
  password_expires_at TIMESTAMPTZ,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_password_change_notification TIMESTAMPTZ,
  require_password_change BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_security_settings UNIQUE(tenant_id, client_id)
);

-- Notification preferences
CREATE TABLE portal_notification_preferences (
  preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  email_new_documents VARCHAR(20) DEFAULT 'IMMEDIATE',
  email_messages VARCHAR(20) DEFAULT 'IMMEDIATE',
  email_reports VARCHAR(20) DEFAULT 'IMMEDIATE',
  email_deadlines VARCHAR(20) DEFAULT '7_DAYS',
  email_invoices VARCHAR(20) DEFAULT 'IMMEDIATE',
  push_enabled BOOLEAN DEFAULT false,
  push_subscription JSONB,
  digest_enabled BOOLEAN DEFAULT false,
  digest_time TIME DEFAULT '09:00',
  digest_includes JSONB DEFAULT '["documents", "messages"]',
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',
  quiet_hours_days JSONB DEFAULT '["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_notification_prefs UNIQUE(tenant_id, client_id),
  CONSTRAINT chk_email_documents CHECK (
    email_new_documents IN ('IMMEDIATE', 'DAILY_DIGEST', 'OFF')
  ),
  CONSTRAINT chk_email_messages CHECK (
    email_messages IN ('IMMEDIATE', 'DAILY_DIGEST')
  )
);

-- Display preferences
CREATE TABLE portal_display_preferences (
  preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  language VARCHAR(5) DEFAULT 'pl',
  theme VARCHAR(20) DEFAULT 'LIGHT',
  date_format VARCHAR(20) DEFAULT 'DD.MM.YYYY',
  time_format VARCHAR(5) DEFAULT '24h',
  number_format VARCHAR(20) DEFAULT 'pl',
  currency_display VARCHAR(10) DEFAULT 'PLN',
  high_contrast BOOLEAN DEFAULT false,
  large_text BOOLEAN DEFAULT false,
  reduce_motion BOOLEAN DEFAULT false,
  screen_reader_hints BOOLEAN DEFAULT false,
  dashboard_widgets JSONB DEFAULT '[]',
  sidebar_collapsed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_display_prefs UNIQUE(tenant_id, client_id),
  CONSTRAINT chk_language CHECK (language IN ('pl', 'en')),
  CONSTRAINT chk_theme CHECK (theme IN ('LIGHT', 'DARK', 'SYSTEM'))
);

-- Email change requests
CREATE TABLE portal_email_changes (
  change_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  current_email VARCHAR(255) NOT NULL,
  new_email VARCHAR(255) NOT NULL,
  verification_token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_email_change_status CHECK (
    status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'CANCELLED')
  )
);

-- Indexes
CREATE INDEX idx_profiles_client ON portal_profiles(tenant_id, client_id);
CREATE INDEX idx_security_client ON portal_security_settings(tenant_id, client_id);
CREATE INDEX idx_notification_client ON portal_notification_preferences(tenant_id, client_id);
CREATE INDEX idx_display_client ON portal_display_preferences(tenant_id, client_id);
CREATE INDEX idx_email_changes_pending ON portal_email_changes(status, expires_at)
  WHERE status = 'PENDING';
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Profile update schema
export const UpdateProfileSchema = z.object({
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  phoneNumber: z.string()
    .regex(/^(\+48)?[0-9]{9}$/, 'Nieprawidłowy format numeru telefonu')
    .optional()
    .nullable(),
  alternateEmail: z.string().email('Nieprawidłowy email').optional().nullable(),
  timezone: z.string().max(50).optional()
});

// Email change request
export const RequestEmailChangeSchema = z.object({
  newEmail: z.string().email('Nieprawidłowy adres email'),
  currentPassword: z.string().min(1, 'Hasło wymagane')
});

// Password change schema
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Aktualne hasło wymagane'),
  newPassword: z.string()
    .min(12, 'Hasło musi mieć co najmniej 12 znaków')
    .regex(/[A-Z]/, 'Hasło musi zawierać wielką literę')
    .regex(/[a-z]/, 'Hasło musi zawierać małą literę')
    .regex(/[0-9]/, 'Hasło musi zawierać cyfrę')
    .regex(/[^A-Za-z0-9]/, 'Hasło musi zawierać znak specjalny'),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Hasła nie są identyczne',
  path: ['confirmPassword']
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'Nowe hasło musi być inne niż obecne',
  path: ['newPassword']
});

// MFA setup schema
export const SetupMfaSchema = z.object({
  method: z.enum(['TOTP', 'SMS']),
  phoneNumber: z.string().regex(/^\+48[0-9]{9}$/).optional(),
  verificationCode: z.string().length(6)
});

// Disable MFA schema
export const DisableMfaSchema = z.object({
  mfaCode: z.string().length(6),
  password: z.string().min(1)
});

// Notification preferences schema
export const NotificationPreferencesSchema = z.object({
  emailNewDocuments: z.enum(['IMMEDIATE', 'DAILY_DIGEST', 'OFF']).optional(),
  emailMessages: z.enum(['IMMEDIATE', 'DAILY_DIGEST']).optional(),
  emailReports: z.enum(['IMMEDIATE', 'OFF']).optional(),
  emailDeadlines: z.enum(['7_DAYS', '3_DAYS', '1_DAY', 'OFF']).optional(),
  emailInvoices: z.enum(['IMMEDIATE', 'WEEKLY', 'OFF']).optional(),
  pushEnabled: z.boolean().optional(),
  pushSubscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string()
    })
  }).optional().nullable(),
  digestEnabled: z.boolean().optional(),
  digestTime: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/).optional(),
  digestIncludes: z.array(z.enum(['documents', 'messages', 'reports', 'deadlines'])).optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/).optional(),
  quietHoursEnd: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/).optional(),
  quietHoursDays: z.array(z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])).optional()
});

// Display preferences schema
export const DisplayPreferencesSchema = z.object({
  language: z.enum(['pl', 'en']).optional(),
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
  dateFormat: z.enum(['DD.MM.YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY']).optional(),
  timeFormat: z.enum(['24h', '12h']).optional(),
  numberFormat: z.enum(['pl', 'en']).optional(),
  currencyDisplay: z.enum(['PLN', 'zł']).optional(),
  highContrast: z.boolean().optional(),
  largeText: z.boolean().optional(),
  reduceMotion: z.boolean().optional(),
  screenReaderHints: z.boolean().optional()
});

// Session termination
export const TerminateSessionSchema = z.object({
  sessionId: z.string().uuid(),
  terminateAll: z.boolean().optional().default(false)
});

// Profile response
export const ProfileResponseSchema = z.object({
  personal: z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    emailVerified: z.boolean(),
    alternateEmail: z.string().email().nullable(),
    phoneNumber: z.string().nullable(),
    avatarUrl: z.string().nullable()
  }),
  company: z.object({
    name: z.string(),
    nip: z.string(),
    regon: z.string().nullable(),
    address: z.object({
      street: z.string(),
      city: z.string(),
      postalCode: z.string(),
      country: z.string()
    }),
    industry: z.string().nullable()
  }),
  security: z.object({
    mfaEnabled: z.boolean(),
    mfaMethod: z.string().nullable(),
    passwordLastChanged: z.date().nullable(),
    passwordExpiresAt: z.date().nullable(),
    activeSessions: z.number()
  }),
  portal: z.object({
    role: z.string(),
    permissions: z.array(z.string()),
    lastLogin: z.date().nullable(),
    onboardingCompleted: z.boolean(),
    createdAt: z.date()
  })
});
```

### Service Implementation

```typescript
// src/modules/portal/services/profile.service.ts
import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class ProfileService {
  constructor(
    private readonly db: DrizzleService,
    private readonly authService: AuthService,
    private readonly crmService: CrmService,
    private readonly emailService: EmailService,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService
  ) {}

  async getProfile(tenantId: string, clientId: string): Promise<ProfileResponse> {
    const [client, profile, security, sessions] = await Promise.all([
      this.crmService.getClient(tenantId, clientId),
      this.getPortalProfile(tenantId, clientId),
      this.getSecuritySettings(tenantId, clientId),
      this.sessionService.getActiveSessionCount(tenantId, clientId)
    ]);

    return {
      personal: {
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        emailVerified: client.emailVerified,
        alternateEmail: profile?.alternateEmail || null,
        phoneNumber: profile?.phoneNumber || null,
        avatarUrl: profile?.avatarUrl || null
      },
      company: {
        name: client.companyName,
        nip: client.nip,
        regon: client.regon,
        address: client.address,
        industry: client.industry
      },
      security: {
        mfaEnabled: security?.mfaEnabled || false,
        mfaMethod: security?.mfaMethod || null,
        passwordLastChanged: security?.passwordLastChanged || null,
        passwordExpiresAt: security?.passwordExpiresAt || null,
        activeSessions: sessions
      },
      portal: {
        role: client.portalRole,
        permissions: client.permissions,
        lastLogin: client.lastPortalLogin,
        onboardingCompleted: client.onboardingCompleted,
        createdAt: client.createdAt
      }
    };
  }

  async updateProfile(
    tenantId: string,
    clientId: string,
    input: UpdateProfileInput
  ): Promise<ProfileResponse> {
    // Update CRM data
    if (input.firstName || input.lastName) {
      await this.crmService.updateClient(tenantId, clientId, {
        firstName: input.firstName,
        lastName: input.lastName
      });
    }

    // Update portal profile
    await this.db.insert(portalProfiles).values({
      tenantId,
      clientId,
      phoneNumber: input.phoneNumber,
      alternateEmail: input.alternateEmail,
      timezone: input.timezone,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: [portalProfiles.tenantId, portalProfiles.clientId],
      set: {
        phoneNumber: input.phoneNumber,
        alternateEmail: input.alternateEmail,
        timezone: input.timezone,
        updatedAt: new Date()
      }
    });

    await this.auditService.log({
      tenantId,
      clientId,
      action: 'PROFILE_UPDATED',
      metadata: { updatedFields: Object.keys(input) }
    });

    return this.getProfile(tenantId, clientId);
  }

  async requestEmailChange(
    tenantId: string,
    clientId: string,
    input: RequestEmailChangeInput
  ): Promise<{ message: string }> {
    // Verify current password
    const isValid = await this.authService.verifyPassword(clientId, input.currentPassword);
    if (!isValid) {
      throw new UnauthorizedException('Nieprawidłowe hasło');
    }

    // Check if email already in use
    const exists = await this.crmService.emailExists(tenantId, input.newEmail);
    if (exists) {
      throw new BadRequestException('Ten adres email jest już używany');
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Cancel any pending changes
    await this.db.update(portalEmailChanges)
      .set({ status: 'CANCELLED' })
      .where(and(
        eq(portalEmailChanges.tenantId, tenantId),
        eq(portalEmailChanges.clientId, clientId),
        eq(portalEmailChanges.status, 'PENDING')
      ));

    // Create new change request
    const client = await this.crmService.getClient(tenantId, clientId);
    await this.db.insert(portalEmailChanges).values({
      tenantId,
      clientId,
      currentEmail: client.email,
      newEmail: input.newEmail,
      verificationTokenHash: tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    // Send verification email
    await this.emailService.send({
      to: input.newEmail,
      template: 'email_change_verification',
      data: {
        name: `${client.firstName} ${client.lastName}`,
        verificationLink: `${process.env.PORTAL_URL}/verify-email?token=${token}`,
        expiresIn: '24 godziny'
      }
    });

    await this.auditService.log({
      tenantId,
      clientId,
      action: 'EMAIL_CHANGE_REQUESTED',
      metadata: { newEmail: input.newEmail }
    });

    return { message: 'Link weryfikacyjny został wysłany na nowy adres email' };
  }

  async changePassword(
    tenantId: string,
    clientId: string,
    input: ChangePasswordInput
  ): Promise<{ message: string }> {
    // Verify current password
    const isValid = await this.authService.verifyPassword(clientId, input.currentPassword);
    if (!isValid) {
      throw new UnauthorizedException('Nieprawidłowe aktualne hasło');
    }

    // Check password history (prevent reuse of last 5)
    const wasUsed = await this.authService.wasPasswordUsed(clientId, input.newPassword, 5);
    if (wasUsed) {
      throw new BadRequestException('To hasło było już używane. Wybierz inne.');
    }

    // Update password
    await this.authService.setPassword(clientId, input.newPassword);

    // Update security settings
    await this.db.update(portalSecuritySettings)
      .set({
        passwordLastChanged: new Date(),
        passwordExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        requirePasswordChange: false,
        updatedAt: new Date()
      })
      .where(and(
        eq(portalSecuritySettings.tenantId, tenantId),
        eq(portalSecuritySettings.clientId, clientId)
      ));

    // Invalidate all other sessions
    await this.sessionService.terminateAllExceptCurrent(tenantId, clientId);

    // Send notification email
    const client = await this.crmService.getClient(tenantId, clientId);
    await this.emailService.send({
      to: client.email,
      template: 'password_changed',
      data: {
        name: client.firstName,
        changedAt: new Date().toLocaleString('pl-PL'),
        ipAddress: 'hidden for security'
      }
    });

    await this.auditService.log({
      tenantId,
      clientId,
      action: 'PASSWORD_CHANGED',
      metadata: { sessionsTerminated: true }
    });

    return { message: 'Hasło zostało zmienione. Pozostałe sesje zostały zakończone.' };
  }

  async setupMfa(
    tenantId: string,
    clientId: string,
    input: SetupMfaInput
  ): Promise<{ backupCodes: string[] }> {
    // Verify the code first
    const isValid = await this.authService.verifyMfaSetupCode(
      clientId,
      input.method,
      input.verificationCode
    );

    if (!isValid) {
      throw new BadRequestException('Nieprawidłowy kod weryfikacyjny');
    }

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Encrypt and save MFA settings
    await this.db.update(portalSecuritySettings)
      .set({
        mfaEnabled: true,
        mfaMethod: input.method,
        mfaBackupCodesEncrypted: await this.encryptBackupCodes(backupCodes),
        updatedAt: new Date()
      })
      .where(and(
        eq(portalSecuritySettings.tenantId, tenantId),
        eq(portalSecuritySettings.clientId, clientId)
      ));

    await this.auditService.log({
      tenantId,
      clientId,
      action: 'MFA_ENABLED',
      metadata: { method: input.method }
    });

    return { backupCodes };
  }

  async updateNotificationPreferences(
    tenantId: string,
    clientId: string,
    input: NotificationPreferencesInput
  ): Promise<void> {
    await this.db.insert(portalNotificationPreferences).values({
      tenantId,
      clientId,
      ...input,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: [
        portalNotificationPreferences.tenantId,
        portalNotificationPreferences.clientId
      ],
      set: {
        ...input,
        updatedAt: new Date()
      }
    });

    await this.auditService.log({
      tenantId,
      clientId,
      action: 'NOTIFICATION_PREFERENCES_UPDATED'
    });
  }

  async updateDisplayPreferences(
    tenantId: string,
    clientId: string,
    input: DisplayPreferencesInput
  ): Promise<void> {
    await this.db.insert(portalDisplayPreferences).values({
      tenantId,
      clientId,
      ...input,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: [
        portalDisplayPreferences.tenantId,
        portalDisplayPreferences.clientId
      ],
      set: {
        ...input,
        updatedAt: new Date()
      }
    });

    await this.auditService.log({
      tenantId,
      clientId,
      action: 'DISPLAY_PREFERENCES_UPDATED',
      metadata: { preferences: input }
    });
  }

  async getActiveSessions(
    tenantId: string,
    clientId: string
  ): Promise<SessionInfo[]> {
    return this.sessionService.getActiveSessions(tenantId, clientId);
  }

  async terminateSession(
    tenantId: string,
    clientId: string,
    input: TerminateSessionInput,
    currentSessionId: string
  ): Promise<void> {
    if (input.terminateAll) {
      await this.sessionService.terminateAllExceptCurrent(tenantId, clientId);
    } else {
      if (input.sessionId === currentSessionId) {
        throw new BadRequestException('Nie można zakończyć bieżącej sesji');
      }
      await this.sessionService.terminateSession(tenantId, clientId, input.sessionId);
    }

    await this.auditService.log({
      tenantId,
      clientId,
      action: input.terminateAll ? 'ALL_SESSIONS_TERMINATED' : 'SESSION_TERMINATED',
      metadata: { sessionId: input.sessionId }
    });
  }

  private async getPortalProfile(tenantId: string, clientId: string) {
    return this.db.query.portalProfiles.findFirst({
      where: and(
        eq(portalProfiles.tenantId, tenantId),
        eq(portalProfiles.clientId, clientId)
      )
    });
  }

  private async getSecuritySettings(tenantId: string, clientId: string) {
    return this.db.query.portalSecuritySettings.findFirst({
      where: and(
        eq(portalSecuritySettings.tenantId, tenantId),
        eq(portalSecuritySettings.clientId, clientId)
      )
    });
  }

  private async encryptBackupCodes(codes: string[]): Promise<string> {
    // AES-256-GCM encryption
    const key = Buffer.from(process.env.BACKUP_CODES_ENCRYPTION_KEY!, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(codes), 'utf8'),
      cipher.final()
    ]);

    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }
}
```

### API Endpoints

```typescript
// src/modules/portal/routers/profile.router.ts
import { router, portalProcedure } from '../trpc';

export const profileRouter = router({
  // Get full profile
  get: portalProcedure
    .query(async ({ ctx }) => {
      return ctx.profileService.getProfile(ctx.tenantId, ctx.clientId);
    }),

  // Update profile
  update: portalProcedure
    .input(UpdateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.profileService.updateProfile(ctx.tenantId, ctx.clientId, input);
    }),

  // Request email change
  requestEmailChange: portalProcedure
    .input(RequestEmailChangeSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.profileService.requestEmailChange(ctx.tenantId, ctx.clientId, input);
    }),

  // Change password
  changePassword: portalProcedure
    .input(ChangePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.profileService.changePassword(ctx.tenantId, ctx.clientId, input);
    }),

  // Setup MFA
  setupMfa: portalProcedure
    .input(SetupMfaSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.profileService.setupMfa(ctx.tenantId, ctx.clientId, input);
    }),

  // Disable MFA
  disableMfa: portalProcedure
    .input(DisableMfaSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.profileService.disableMfa(ctx.tenantId, ctx.clientId, input);
    }),

  // Get notification preferences
  getNotificationPreferences: portalProcedure
    .query(async ({ ctx }) => {
      return ctx.profileService.getNotificationPreferences(ctx.tenantId, ctx.clientId);
    }),

  // Update notification preferences
  updateNotificationPreferences: portalProcedure
    .input(NotificationPreferencesSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.profileService.updateNotificationPreferences(
        ctx.tenantId, ctx.clientId, input
      );
    }),

  // Get display preferences
  getDisplayPreferences: portalProcedure
    .query(async ({ ctx }) => {
      return ctx.profileService.getDisplayPreferences(ctx.tenantId, ctx.clientId);
    }),

  // Update display preferences
  updateDisplayPreferences: portalProcedure
    .input(DisplayPreferencesSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.profileService.updateDisplayPreferences(
        ctx.tenantId, ctx.clientId, input
      );
    }),

  // Get active sessions
  getSessions: portalProcedure
    .query(async ({ ctx }) => {
      return ctx.profileService.getActiveSessions(ctx.tenantId, ctx.clientId);
    }),

  // Terminate session
  terminateSession: portalProcedure
    .input(TerminateSessionSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.profileService.terminateSession(
        ctx.tenantId, ctx.clientId, input, ctx.sessionId
      );
    })
});
```

## Test Specification

### Unit Tests

```typescript
describe('ProfileService', () => {
  describe('changePassword', () => {
    it('should reject incorrect current password', async () => {
      authService.verifyPassword.mockResolvedValue(false);

      await expect(service.changePassword(tenantId, clientId, {
        currentPassword: 'wrong',
        newPassword: 'NewSecure123!',
        confirmPassword: 'NewSecure123!'
      })).rejects.toThrow(UnauthorizedException);
    });

    it('should reject previously used password', async () => {
      authService.verifyPassword.mockResolvedValue(true);
      authService.wasPasswordUsed.mockResolvedValue(true);

      await expect(service.changePassword(tenantId, clientId, {
        currentPassword: 'current',
        newPassword: 'OldPassword123!',
        confirmPassword: 'OldPassword123!'
      })).rejects.toThrow(BadRequestException);
    });

    it('should invalidate other sessions on password change', async () => {
      authService.verifyPassword.mockResolvedValue(true);
      authService.wasPasswordUsed.mockResolvedValue(false);

      await service.changePassword(tenantId, clientId, validPasswordChange);

      expect(sessionService.terminateAllExceptCurrent).toHaveBeenCalled();
    });
  });

  describe('requestEmailChange', () => {
    it('should send verification email to new address', async () => {
      authService.verifyPassword.mockResolvedValue(true);
      crmService.emailExists.mockResolvedValue(false);

      await service.requestEmailChange(tenantId, clientId, {
        newEmail: 'new@example.com',
        currentPassword: 'password'
      });

      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'new@example.com',
          template: 'email_change_verification'
        })
      );
    });
  });

  describe('updateDisplayPreferences', () => {
    it('should save theme preference', async () => {
      await service.updateDisplayPreferences(tenantId, clientId, {
        theme: 'DARK'
      });

      const prefs = await getDisplayPrefs(tenantId, clientId);
      expect(prefs.theme).toBe('DARK');
    });
  });
});
```

### Integration Tests

```typescript
describe('Profile API', () => {
  it('should return complete profile data', async () => {
    const response = await request(app)
      .get('/api/portal/profile')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('personal');
    expect(response.body).toHaveProperty('company');
    expect(response.body).toHaveProperty('security');
    expect(response.body.personal.email).toBeDefined();
  });

  it('should update notification preferences', async () => {
    const response = await request(app)
      .put('/api/portal/profile/notifications')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        emailNewDocuments: 'DAILY_DIGEST',
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00'
      })
      .expect(200);

    const prefs = await request(app)
      .get('/api/portal/profile/notifications')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(prefs.body.emailNewDocuments).toBe('DAILY_DIGEST');
    expect(prefs.body.quietHoursEnabled).toBe(true);
  });
});
```

## Security Checklist

- [x] Password change requires current password verification
- [x] Email change requires verification of new address
- [x] MFA disable requires both MFA code and password
- [x] Session management allows terminating other sessions
- [x] Password history prevents reuse of last 5 passwords
- [x] Backup codes are encrypted at rest
- [x] All profile changes are audited
- [x] Current session cannot be self-terminated
- [x] Sensitive data (passwords, codes) never returned in responses

## Audit Events

| Event | Description | Logged Data |
|-------|-------------|-------------|
| PROFILE_UPDATED | Profile info changed | Updated fields |
| EMAIL_CHANGE_REQUESTED | Email change initiated | New email |
| EMAIL_VERIFIED | Email change confirmed | Old/new email |
| PASSWORD_CHANGED | Password updated | Timestamp |
| MFA_ENABLED | MFA activated | Method |
| MFA_DISABLED | MFA deactivated | Method |
| SESSION_TERMINATED | Single session ended | Session ID |
| ALL_SESSIONS_TERMINATED | All sessions ended | Count |
| NOTIFICATION_PREFERENCES_UPDATED | Notifications changed | - |
| DISPLAY_PREFERENCES_UPDATED | Display settings changed | Preferences |

## Definition of Done

- [ ] All acceptance criteria verified
- [ ] Unit test coverage ≥ 80%
- [ ] Integration tests passing
- [ ] Password security requirements enforced
- [ ] Email verification flow working
- [ ] MFA setup/disable secure
- [ ] Session management functional
- [ ] Accessibility audit passed
- [ ] Polish and English translations complete
- [ ] Documentation updated
