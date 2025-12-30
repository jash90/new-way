# Story: CSP-006 - Client Onboarding Wizard

## Story Overview

| Field | Value |
|-------|-------|
| Story ID | CSP-006 |
| Epic | CSP-EPIC (Client Self-Service Portal) |
| Title | Client Onboarding Wizard |
| Priority | P1 |
| Story Points | 5 |
| Sprint | Sprint 3 (Week 31) |
| Status | Draft |
| Dependencies | CRM, AIM |

## User Story

**As a** new client of the accounting firm,
**I want** a guided step-by-step onboarding wizard,
**So that** I can quickly set up my portal account, provide required information, and understand how to use the portal features effectively.

## Acceptance Criteria

### AC1: Welcome & Account Verification

```gherkin
Feature: Client Onboarding Welcome Step
  As a new portal client
  I want to verify my account and see a welcome message
  So that I know my portal access has been activated

  Scenario: Display personalized welcome
    Given I am a new client logging in for the first time
    And my email has been pre-registered by the accounting firm
    When I complete email verification
    Then I should see a personalized welcome message with my company name
    And I should see an overview of what I'll accomplish in the onboarding process
    And I should see an estimated time to complete (5-10 minutes)

  Scenario: Set secure password
    Given I am on the password creation step
    When I enter a password that meets security requirements
    | requirement | specification |
    | minimum length | 12 characters |
    | uppercase | at least 1 |
    | lowercase | at least 1 |
    | numbers | at least 1 |
    | special chars | at least 1 |
    And I confirm the password
    Then my password should be securely stored
    And I should see a password strength indicator as "Strong"

  Scenario: Optional MFA setup
    Given I have set my password
    When I reach the MFA setup step
    Then I should see options for:
      | method | description |
      | TOTP | Aplikacja autoryzacyjna (Google Authenticator, Authy) |
      | SMS | Kod SMS na numer telefonu |
      | Skip | Pomiń (można włączyć później) |
    And I can complete MFA setup or skip for later
```

### AC2: Company Information Verification

```gherkin
Feature: Company Information Step
  As a new client
  I want to verify and complete my company information
  So that my accounting firm has accurate data for services

  Scenario: Display pre-filled company data from CRM
    Given I am on the company information step
    When the wizard loads
    Then I should see pre-filled data from CRM:
      | field | editable |
      | Company name | No |
      | NIP | No |
      | REGON | Yes |
      | Address | Yes |
      | Industry | Yes |
    And I can verify the accuracy of this information

  Scenario: Add additional contacts
    Given I am viewing company information
    When I click "Dodaj osobę kontaktową"
    Then I should see a form for:
      | field | required |
      | Full name | Yes |
      | Email | Yes |
      | Phone | No |
      | Role | Yes |
      | Portal access | Yes |
    And I can add up to 5 additional contacts

  Scenario: Verify contact information
    Given I have added contact information
    When I add an email for portal access
    Then the system should send a verification email
    And the contact should be marked as "Oczekuje na weryfikację"
```

### AC3: Document Preferences Setup

```gherkin
Feature: Document Preferences Step
  As a new client
  I want to configure how I receive and organize documents
  So that the portal works according to my preferences

  Scenario: Set document notification preferences
    Given I am on the document preferences step
    When I configure notification settings
    Then I should be able to set preferences for:
      | event | options |
      | New document uploaded | Email, Portal, Both, None |
      | Document requires action | Email, Portal, Both |
      | Monthly summary | Weekly, Monthly, None |

  Scenario: Configure auto-categorization preferences
    Given I am setting document preferences
    When I enable AI auto-categorization
    Then I should be able to:
      | setting | description |
      | Enable auto-categorization | Automatically categorize uploaded documents |
      | Set default tax year | Default tax year for new uploads |
      | Preferred categories | Highlight frequently used categories |

  Scenario: Set document retention preferences
    Given I am on document settings
    When I configure retention preferences
    Then I should see options for:
      | period | description |
      | 7 years | Standard legal requirement (recommended) |
      | 10 years | Extended retention |
      | Custom | Custom retention period |
```

### AC4: Communication Preferences

```gherkin
Feature: Communication Preferences Step
  As a new client
  I want to set my communication preferences
  So that I receive notifications in my preferred way

  Scenario: Configure messaging preferences
    Given I am on communication preferences step
    When I set my preferences
    Then I should configure:
      | setting | options |
      | Email notifications | Natychmiast, Podsumowanie dzienne, Wyłączone |
      | Push notifications | Enabled, Disabled |
      | SMS for urgent matters | Enabled, Disabled |
      | Preferred language | Polski, English |

  Scenario: Set business hours for notifications
    Given I am configuring notification timing
    When I set quiet hours
    Then I should be able to:
      | option | description |
      | Business hours only | 8:00-18:00 Mon-Fri |
      | Custom schedule | Define custom quiet hours |
      | No restrictions | Receive anytime |
```

### AC5: Portal Tour & Completion

```gherkin
Feature: Interactive Portal Tour
  As a new client completing onboarding
  I want an interactive tour of the portal features
  So that I understand how to use key functionalities

  Scenario: Complete interactive feature tour
    Given I have completed all onboarding steps
    When I start the portal tour
    Then I should see guided highlights of:
      | feature | description |
      | Dashboard | Przegląd KPI i finansów firmy |
      | Documents | Przesyłanie i zarządzanie dokumentami |
      | Reports | Dostęp do raportów finansowych |
      | Messages | Bezpieczna komunikacja z biurem |
      | Profile | Ustawienia konta i preferencje |

  Scenario: Skip or restart tour
    Given I am viewing the portal tour
    When I want to skip the tour
    Then I should be able to skip with a "Pomiń przewodnik" button
    And I should be able to restart the tour from profile settings

  Scenario: Onboarding completion confirmation
    Given I have completed all onboarding steps
    When I finish the wizard
    Then I should see a completion confirmation
    And my onboarding_completed flag should be set to true
    And I should be redirected to the dashboard
    And the accounting firm should receive notification of completed onboarding
```

## Technical Specification

### Database Schema

```sql
-- Client onboarding tracking
CREATE TABLE portal_onboarding (
  onboarding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  status VARCHAR(20) NOT NULL DEFAULT 'NOT_STARTED',
  current_step INTEGER DEFAULT 0,
  steps_completed JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  skipped_steps JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_client_onboarding UNIQUE(tenant_id, client_id),
  CONSTRAINT chk_status CHECK (status IN (
    'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED'
  ))
);

-- Onboarding step definitions
CREATE TABLE portal_onboarding_steps (
  step_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  step_number INTEGER NOT NULL,
  step_key VARCHAR(50) NOT NULL,
  title_pl VARCHAR(100) NOT NULL,
  title_en VARCHAR(100) NOT NULL,
  description_pl TEXT,
  description_en TEXT,
  is_required BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  estimated_minutes INTEGER DEFAULT 2,
  order_index INTEGER NOT NULL,

  CONSTRAINT uq_step_key UNIQUE(tenant_id, step_key)
);

-- Step completion tracking
CREATE TABLE portal_onboarding_progress (
  progress_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id UUID NOT NULL REFERENCES portal_onboarding(onboarding_id),
  step_id UUID NOT NULL REFERENCES portal_onboarding_steps(step_id),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  skipped_at TIMESTAMPTZ,
  skip_reason TEXT,
  data_collected JSONB DEFAULT '{}',

  CONSTRAINT uq_onboarding_step UNIQUE(onboarding_id, step_id),
  CONSTRAINT chk_progress_status CHECK (status IN (
    'PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'
  ))
);

-- Client preferences set during onboarding
CREATE TABLE portal_client_preferences (
  preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  category VARCHAR(50) NOT NULL,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_client_preference_category UNIQUE(tenant_id, client_id, category)
);

-- Indexes
CREATE INDEX idx_onboarding_client ON portal_onboarding(tenant_id, client_id);
CREATE INDEX idx_onboarding_status ON portal_onboarding(status) WHERE status = 'IN_PROGRESS';
CREATE INDEX idx_progress_onboarding ON portal_onboarding_progress(onboarding_id);
CREATE INDEX idx_preferences_client ON portal_client_preferences(tenant_id, client_id);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Onboarding step status
export const OnboardingStepStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'SKIPPED'
]);

// Password creation schema
export const SetPasswordSchema = z.object({
  password: z.string()
    .min(12, 'Hasło musi mieć co najmniej 12 znaków')
    .regex(/[A-Z]/, 'Hasło musi zawierać wielką literę')
    .regex(/[a-z]/, 'Hasło musi zawierać małą literę')
    .regex(/[0-9]/, 'Hasło musi zawierać cyfrę')
    .regex(/[^A-Za-z0-9]/, 'Hasło musi zawierać znak specjalny'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Hasła nie są identyczne',
  path: ['confirmPassword']
});

// MFA setup schema
export const MfaSetupSchema = z.object({
  method: z.enum(['TOTP', 'SMS', 'SKIP']),
  phoneNumber: z.string().regex(/^\+48[0-9]{9}$/).optional(),
  verificationCode: z.string().length(6).optional()
}).refine((data) => {
  if (data.method === 'SMS' && !data.phoneNumber) {
    return false;
  }
  return true;
}, { message: 'Numer telefonu wymagany dla SMS' });

// Company info verification schema
export const CompanyInfoVerificationSchema = z.object({
  regon: z.string().regex(/^[0-9]{9}$|^[0-9]{14}$/).optional(),
  address: z.object({
    street: z.string().max(200),
    city: z.string().max(100),
    postalCode: z.string().regex(/^[0-9]{2}-[0-9]{3}$/),
    country: z.string().default('PL')
  }).optional(),
  industry: z.string().max(100).optional(),
  additionalContacts: z.array(z.object({
    fullName: z.string().min(2).max(100),
    email: z.string().email(),
    phone: z.string().optional(),
    role: z.string().max(50),
    grantPortalAccess: z.boolean().default(false)
  })).max(5).optional()
});

// Document preferences schema
export const DocumentPreferencesSchema = z.object({
  notifications: z.object({
    newDocument: z.enum(['EMAIL', 'PORTAL', 'BOTH', 'NONE']).default('BOTH'),
    actionRequired: z.enum(['EMAIL', 'PORTAL', 'BOTH']).default('BOTH'),
    monthlySummary: z.enum(['WEEKLY', 'MONTHLY', 'NONE']).default('MONTHLY')
  }),
  autoCategorizationEnabled: z.boolean().default(true),
  defaultTaxYear: z.number().int().min(2020).max(2030).optional(),
  preferredCategories: z.array(z.string()).max(10).optional(),
  retentionPeriodYears: z.number().int().min(7).max(20).default(7)
});

// Communication preferences schema
export const CommunicationPreferencesSchema = z.object({
  emailNotifications: z.enum(['IMMEDIATE', 'DAILY_DIGEST', 'DISABLED']).default('IMMEDIATE'),
  pushNotificationsEnabled: z.boolean().default(true),
  smsForUrgent: z.boolean().default(false),
  preferredLanguage: z.enum(['pl', 'en']).default('pl'),
  quietHours: z.object({
    enabled: z.boolean().default(false),
    startTime: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/).optional(),
    endTime: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/).optional(),
    timezone: z.string().default('Europe/Warsaw')
  }).optional()
});

// Complete step request
export const CompleteStepRequestSchema = z.object({
  stepKey: z.string(),
  data: z.record(z.unknown()).optional(),
  skipReason: z.string().max(500).optional()
});

// Onboarding response
export const OnboardingStateSchema = z.object({
  onboardingId: z.string().uuid(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED']),
  currentStep: z.number().int().min(0),
  totalSteps: z.number().int(),
  progressPercentage: z.number().min(0).max(100),
  steps: z.array(z.object({
    stepNumber: z.number(),
    stepKey: z.string(),
    title: z.string(),
    description: z.string().optional(),
    status: OnboardingStepStatusSchema,
    isRequired: z.boolean(),
    estimatedMinutes: z.number()
  })),
  estimatedTimeRemaining: z.number(),
  canSkipCurrent: z.boolean()
});
```

### Service Implementation

```typescript
// src/modules/portal/services/onboarding.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly db: DrizzleService,
    private readonly crmService: CrmService,
    private readonly authService: AuthService,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService
  ) {}

  async getOnboardingState(
    tenantId: string,
    clientId: string
  ): Promise<OnboardingState> {
    // Get or create onboarding record
    let onboarding = await this.db.query.portalOnboarding.findFirst({
      where: and(
        eq(portalOnboarding.tenantId, tenantId),
        eq(portalOnboarding.clientId, clientId)
      )
    });

    if (!onboarding) {
      onboarding = await this.initializeOnboarding(tenantId, clientId);
    }

    // Get step definitions
    const steps = await this.db.query.portalOnboardingSteps.findMany({
      where: and(
        eq(portalOnboardingSteps.tenantId, tenantId),
        eq(portalOnboardingSteps.isActive, true)
      ),
      orderBy: [asc(portalOnboardingSteps.orderIndex)]
    });

    // Get progress for each step
    const progress = await this.db.query.portalOnboardingProgress.findMany({
      where: eq(portalOnboardingProgress.onboardingId, onboarding.onboardingId)
    });

    const progressMap = new Map(
      progress.map(p => [p.stepId, p])
    );

    // Calculate completion percentage
    const completedSteps = progress.filter(p => p.status === 'COMPLETED').length;
    const progressPercentage = Math.round((completedSteps / steps.length) * 100);

    // Calculate estimated time remaining
    const pendingSteps = steps.filter(s => {
      const stepProgress = progressMap.get(s.stepId);
      return !stepProgress || stepProgress.status === 'PENDING';
    });
    const estimatedTimeRemaining = pendingSteps.reduce(
      (sum, s) => sum + s.estimatedMinutes, 0
    );

    return {
      onboardingId: onboarding.onboardingId,
      status: onboarding.status,
      currentStep: onboarding.currentStep,
      totalSteps: steps.length,
      progressPercentage,
      steps: steps.map(step => {
        const stepProgress = progressMap.get(step.stepId);
        return {
          stepNumber: step.stepNumber,
          stepKey: step.stepKey,
          title: step.titlePl, // Use locale-based selection
          description: step.descriptionPl,
          status: stepProgress?.status || 'PENDING',
          isRequired: step.isRequired,
          estimatedMinutes: step.estimatedMinutes
        };
      }),
      estimatedTimeRemaining,
      canSkipCurrent: !steps[onboarding.currentStep]?.isRequired
    };
  }

  async completeStep(
    tenantId: string,
    clientId: string,
    input: CompleteStepRequest
  ): Promise<OnboardingState> {
    const onboarding = await this.db.query.portalOnboarding.findFirst({
      where: and(
        eq(portalOnboarding.tenantId, tenantId),
        eq(portalOnboarding.clientId, clientId)
      )
    });

    if (!onboarding) {
      throw new BadRequestException('Onboarding not initialized');
    }

    const step = await this.db.query.portalOnboardingSteps.findFirst({
      where: and(
        eq(portalOnboardingSteps.tenantId, tenantId),
        eq(portalOnboardingSteps.stepKey, input.stepKey)
      )
    });

    if (!step) {
      throw new BadRequestException('Invalid step');
    }

    // Process step-specific logic
    await this.processStepData(tenantId, clientId, input.stepKey, input.data);

    // Update progress
    await this.db.insert(portalOnboardingProgress).values({
      onboardingId: onboarding.onboardingId,
      stepId: step.stepId,
      status: input.skipReason ? 'SKIPPED' : 'COMPLETED',
      completedAt: input.skipReason ? null : new Date(),
      skippedAt: input.skipReason ? new Date() : null,
      skipReason: input.skipReason,
      dataCollected: input.data || {}
    }).onConflictDoUpdate({
      target: [
        portalOnboardingProgress.onboardingId,
        portalOnboardingProgress.stepId
      ],
      set: {
        status: input.skipReason ? 'SKIPPED' : 'COMPLETED',
        completedAt: input.skipReason ? null : new Date(),
        skippedAt: input.skipReason ? new Date() : null,
        skipReason: input.skipReason,
        dataCollected: input.data || {}
      }
    });

    // Move to next step
    const nextStepNumber = onboarding.currentStep + 1;
    const totalSteps = await this.db.select({ count: sql<number>`count(*)` })
      .from(portalOnboardingSteps)
      .where(and(
        eq(portalOnboardingSteps.tenantId, tenantId),
        eq(portalOnboardingSteps.isActive, true)
      ));

    const isCompleted = nextStepNumber >= totalSteps[0].count;

    await this.db.update(portalOnboarding)
      .set({
        currentStep: isCompleted ? onboarding.currentStep : nextStepNumber,
        status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: isCompleted ? new Date() : null,
        stepsCompleted: sql`steps_completed || ${JSON.stringify([input.stepKey])}::jsonb`,
        updatedAt: new Date()
      })
      .where(eq(portalOnboarding.onboardingId, onboarding.onboardingId));

    // If completed, notify accounting firm
    if (isCompleted) {
      await this.handleOnboardingCompletion(tenantId, clientId);
    }

    // Audit
    await this.auditService.log({
      tenantId,
      clientId,
      action: input.skipReason ? 'ONBOARDING_STEP_SKIPPED' : 'ONBOARDING_STEP_COMPLETED',
      entityType: 'onboarding',
      entityId: onboarding.onboardingId,
      metadata: { stepKey: input.stepKey }
    });

    return this.getOnboardingState(tenantId, clientId);
  }

  private async processStepData(
    tenantId: string,
    clientId: string,
    stepKey: string,
    data: Record<string, unknown> | undefined
  ): Promise<void> {
    if (!data) return;

    switch (stepKey) {
      case 'password':
        const passwordData = SetPasswordSchema.parse(data);
        await this.authService.setClientPassword(clientId, passwordData.password);
        break;

      case 'mfa':
        const mfaData = MfaSetupSchema.parse(data);
        if (mfaData.method !== 'SKIP') {
          await this.authService.setupMfa(clientId, mfaData);
        }
        break;

      case 'company':
        const companyData = CompanyInfoVerificationSchema.parse(data);
        await this.crmService.updateClientInfo(tenantId, clientId, companyData);
        break;

      case 'documents':
        const docPrefs = DocumentPreferencesSchema.parse(data);
        await this.savePreferences(tenantId, clientId, 'documents', docPrefs);
        break;

      case 'communication':
        const commPrefs = CommunicationPreferencesSchema.parse(data);
        await this.savePreferences(tenantId, clientId, 'communication', commPrefs);
        break;
    }
  }

  private async savePreferences(
    tenantId: string,
    clientId: string,
    category: string,
    preferences: Record<string, unknown>
  ): Promise<void> {
    await this.db.insert(portalClientPreferences).values({
      tenantId,
      clientId,
      category,
      preferences
    }).onConflictDoUpdate({
      target: [
        portalClientPreferences.tenantId,
        portalClientPreferences.clientId,
        portalClientPreferences.category
      ],
      set: {
        preferences,
        updatedAt: new Date()
      }
    });
  }

  private async handleOnboardingCompletion(
    tenantId: string,
    clientId: string
  ): Promise<void> {
    // Update client record
    await this.crmService.markOnboardingCompleted(tenantId, clientId);

    // Notify accounting firm
    await this.notificationService.notifyStaff({
      tenantId,
      type: 'CLIENT_ONBOARDING_COMPLETED',
      title: 'Klient zakończył onboarding',
      body: `Klient zakończył konfigurację portalu klienta`,
      clientId,
      priority: 'NORMAL'
    });

    // Send welcome email to client
    await this.notificationService.sendEmail({
      tenantId,
      clientId,
      template: 'onboarding_complete',
      subject: 'Witamy w portalu klienta!'
    });
  }

  private async initializeOnboarding(
    tenantId: string,
    clientId: string
  ): Promise<typeof portalOnboarding.$inferSelect> {
    const [result] = await this.db.insert(portalOnboarding).values({
      tenantId,
      clientId,
      status: 'IN_PROGRESS',
      currentStep: 0,
      startedAt: new Date()
    }).returning();

    return result;
  }
}
```

### API Endpoints

```typescript
// src/modules/portal/routers/onboarding.router.ts
import { router, portalProcedure } from '../trpc';

export const onboardingRouter = router({
  // Get current onboarding state
  getState: portalProcedure
    .query(async ({ ctx }) => {
      return ctx.onboardingService.getOnboardingState(
        ctx.tenantId,
        ctx.clientId
      );
    }),

  // Complete a step
  completeStep: portalProcedure
    .input(CompleteStepRequestSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.onboardingService.completeStep(
        ctx.tenantId,
        ctx.clientId,
        input
      );
    }),

  // Skip current step (if allowed)
  skipStep: portalProcedure
    .input(z.object({
      stepKey: z.string(),
      reason: z.string().max(500).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.onboardingService.completeStep(
        ctx.tenantId,
        ctx.clientId,
        {
          stepKey: input.stepKey,
          skipReason: input.reason || 'Pominięto przez użytkownika'
        }
      );
    }),

  // Restart onboarding (admin only)
  restart: portalProcedure
    .mutation(async ({ ctx }) => {
      return ctx.onboardingService.restartOnboarding(
        ctx.tenantId,
        ctx.clientId
      );
    }),

  // Get step details
  getStepDetails: portalProcedure
    .input(z.object({ stepKey: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.onboardingService.getStepDetails(
        ctx.tenantId,
        ctx.clientId,
        input.stepKey
      );
    })
});
```

## Test Specification

### Unit Tests

```typescript
describe('OnboardingService', () => {
  describe('getOnboardingState', () => {
    it('should create new onboarding for first-time client', async () => {
      const result = await service.getOnboardingState(tenantId, newClientId);

      expect(result.status).toBe('IN_PROGRESS');
      expect(result.currentStep).toBe(0);
      expect(result.progressPercentage).toBe(0);
    });

    it('should return existing onboarding state', async () => {
      // Setup: Client with 2 completed steps
      await setupPartialOnboarding(tenantId, clientId, 2);

      const result = await service.getOnboardingState(tenantId, clientId);

      expect(result.currentStep).toBe(2);
      expect(result.progressPercentage).toBeGreaterThan(0);
    });

    it('should calculate estimated time remaining correctly', async () => {
      const result = await service.getOnboardingState(tenantId, clientId);

      // Sum of estimated_minutes for pending steps
      expect(result.estimatedTimeRemaining).toBeGreaterThan(0);
    });
  });

  describe('completeStep', () => {
    it('should validate password requirements', async () => {
      await expect(service.completeStep(tenantId, clientId, {
        stepKey: 'password',
        data: { password: 'weak', confirmPassword: 'weak' }
      })).rejects.toThrow();
    });

    it('should save document preferences', async () => {
      await service.completeStep(tenantId, clientId, {
        stepKey: 'documents',
        data: {
          notifications: { newDocument: 'EMAIL' },
          autoCategorizationEnabled: true,
          retentionPeriodYears: 7
        }
      });

      const prefs = await getClientPreferences(tenantId, clientId, 'documents');
      expect(prefs.autoCategorizationEnabled).toBe(true);
    });

    it('should notify staff on completion', async () => {
      // Complete all steps
      await completeAllOnboardingSteps(tenantId, clientId);

      expect(notificationService.notifyStaff).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CLIENT_ONBOARDING_COMPLETED'
        })
      );
    });

    it('should allow skipping non-required steps', async () => {
      const result = await service.completeStep(tenantId, clientId, {
        stepKey: 'mfa',
        skipReason: 'Will configure later'
      });

      expect(result.steps.find(s => s.stepKey === 'mfa')?.status).toBe('SKIPPED');
    });
  });
});
```

### Integration Tests

```typescript
describe('Onboarding API', () => {
  it('should complete full onboarding flow', async () => {
    // Step 1: Get initial state
    const initialState = await request(app)
      .get('/api/portal/onboarding/state')
      .set('Authorization', `Bearer ${newClientToken}`);

    expect(initialState.body.status).toBe('IN_PROGRESS');
    expect(initialState.body.currentStep).toBe(0);

    // Step 2: Set password
    await request(app)
      .post('/api/portal/onboarding/step')
      .set('Authorization', `Bearer ${newClientToken}`)
      .send({
        stepKey: 'password',
        data: {
          password: 'SecurePassword123!',
          confirmPassword: 'SecurePassword123!'
        }
      })
      .expect(200);

    // Step 3: Skip MFA
    await request(app)
      .post('/api/portal/onboarding/skip')
      .set('Authorization', `Bearer ${newClientToken}`)
      .send({ stepKey: 'mfa' })
      .expect(200);

    // ... continue through all steps

    // Final state
    const finalState = await request(app)
      .get('/api/portal/onboarding/state')
      .set('Authorization', `Bearer ${newClientToken}`);

    expect(finalState.body.status).toBe('COMPLETED');
    expect(finalState.body.progressPercentage).toBe(100);
  });
});
```

## Security Checklist

- [x] Password validation with strong requirements
- [x] MFA setup follows security best practices
- [x] Data collected during onboarding is validated
- [x] Audit trail for all onboarding actions
- [x] Additional contacts require email verification
- [x] Rate limiting on step completion
- [x] Tenant isolation enforced
- [x] Sensitive data (passwords) never logged

## Audit Events

| Event | Description | Logged Data |
|-------|-------------|-------------|
| ONBOARDING_STARTED | Client began onboarding | clientId, startedAt |
| ONBOARDING_STEP_COMPLETED | Step completed | stepKey, data summary |
| ONBOARDING_STEP_SKIPPED | Step skipped | stepKey, reason |
| ONBOARDING_COMPLETED | Full onboarding finished | completionTime, skippedSteps |
| PASSWORD_SET | Password created | timestamp (no password data) |
| MFA_CONFIGURED | MFA setup completed | method |
| CONTACT_ADDED | Additional contact added | contactEmail, role |

## UI/UX Guidelines

### Stepper Component
- Display progress bar showing completion percentage
- Show estimated time remaining
- Highlight current step with visual indicator
- Allow navigation to previous completed steps
- Mark skipped steps with different styling

### Mobile Considerations
- Full-screen steps on mobile
- Touch-friendly inputs
- Progressive disclosure of complex forms
- Swipe gestures for step navigation

### Accessibility
- ARIA labels for progress indicators
- Keyboard navigation between steps
- Screen reader announcements for step changes
- Clear error messages with instructions

## Definition of Done

- [ ] All acceptance criteria verified
- [ ] Unit test coverage ≥ 80%
- [ ] Integration tests for full onboarding flow
- [ ] Security review completed
- [ ] Accessibility audit passed (WCAG 2.1 AA)
- [ ] Polish and English translations complete
- [ ] Staff notification on completion works
- [ ] Mobile-responsive wizard tested
- [ ] Documentation updated
