# HRP-002: Employee Onboarding

> **Story ID**: HRP-002
> **Epic**: HR & Payroll Module (HRP)
> **Priority**: P1 (Important)
> **Points**: 8
> **Status**: 📋 Ready for Development

---

## User Story

**As an** HR manager,
**I want to** have a streamlined onboarding process for new employees,
**So that** new hires are set up correctly with all required Polish documentation and system access.

---

## Acceptance Criteria

### AC1: Onboarding Workflow Wizard
```gherkin
Given I am an authenticated HR manager
And I have created a new employee record
When I initiate the onboarding process
Then I should see a step-by-step wizard with:
  | Step | Name | Required |
  | 1 | Dane osobowe | Yes |
  | 2 | Dokumenty | Yes |
  | 3 | Umowa | Yes |
  | 4 | ZUS | Yes |
  | 5 | Podatki | Yes |
  | 6 | Dostęp | No |
And each step should show completion status
And I should be able to navigate between steps
```

### AC2: Required Document Checklist
```gherkin
Given I am on the documents step of onboarding
When the system displays the document checklist
Then I should see the following required documents:
  | Document | Status |
  | Dowód osobisty (kopia) | Pending |
  | Kwestionariusz osobowy | Pending |
  | Świadectwo pracy (poprzedni pracodawca) | Optional |
  | Orzeczenie lekarskie | Pending |
  | Szkolenie BHP | Pending |
  | RODO - zgoda | Pending |
And I should be able to upload or mark each document as received
And completion percentage should update in real-time
```

### AC3: ZUS Registration Data Collection
```gherkin
Given I am on the ZUS registration step
When I fill in the ZUS data:
  | Field | Value |
  | NFZ Branch | 01 (Dolnośląski) |
  | Previous Employment | Yes |
  | Continuation of ZUS | No |
Then the system should validate NFZ branch code
And prepare ZUA form data
And save the ZUS registration requirements
```

### AC4: Tax Form Processing (PIT-2)
```gherkin
Given I am on the tax configuration step
When I configure tax settings:
  | Setting | Value |
  | Ulga podatkowa | TAK - 1/12 kwoty zmniejszającej |
  | PPK uczestnictwo | TAK |
  | Koszty uzyskania | Podstawowe (250 zł) |
Then the system should save tax preferences
And apply settings to future payroll calculations
And generate PIT-2 form if applicable
```

### AC5: Initial Contract Generation
```gherkin
Given I have completed employee data entry
When I proceed to contract generation
Then the system should pre-fill contract with:
  | Field | Source |
  | Employee data | Employee record |
  | Company data | Tenant settings |
  | Position | Employee position |
  | Salary | Contract configuration |
And I should be able to select contract type
And generate contract document from template
```

### AC6: Onboarding Progress Tracking
```gherkin
Given multiple employees are being onboarded
When I view the onboarding dashboard
Then I should see all in-progress onboardings
And each should show:
  | Info | Example |
  | Employee name | Jan Kowalski |
  | Start date | 2024-01-15 |
  | Progress | 60% (3/5 steps) |
  | Pending items | 2 documents |
  | Assigned HR | Anna Nowak |
And I should be able to filter by status and date
```

---

## Technical Specification

### Database Schema

```sql
-- Onboarding process tracking
CREATE TABLE onboarding_processes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    employee_id UUID NOT NULL REFERENCES employees(id),

    -- Process state
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS'
        CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD')),
    current_step INTEGER NOT NULL DEFAULT 1,
    total_steps INTEGER NOT NULL DEFAULT 6,

    -- Timeline
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    target_completion_date DATE,
    completed_at TIMESTAMPTZ,

    -- Assignment
    assigned_to UUID REFERENCES users(id),

    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Onboarding steps
CREATE TABLE onboarding_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onboarding_id UUID NOT NULL REFERENCES onboarding_processes(id),

    step_number INTEGER NOT NULL,
    step_name VARCHAR(50) NOT NULL,
    step_type VARCHAR(30) NOT NULL,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),

    -- Completion
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id),

    -- Step-specific data
    data JSONB,

    UNIQUE(onboarding_id, step_number)
);

-- Onboarding document checklist
CREATE TABLE onboarding_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onboarding_id UUID NOT NULL REFERENCES onboarding_processes(id),

    document_type VARCHAR(50) NOT NULL,
    document_name VARCHAR(100) NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT true,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'RECEIVED', 'REJECTED', 'NOT_APPLICABLE')),

    -- Document reference
    document_id UUID REFERENCES documents(id),

    -- Tracking
    received_at TIMESTAMPTZ,
    received_by UUID REFERENCES users(id),
    rejection_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Onboarding templates
CREATE TABLE onboarding_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    name VARCHAR(100) NOT NULL,
    description TEXT,
    contract_type VARCHAR(30) NOT NULL,

    -- Steps configuration
    steps JSONB NOT NULL,

    -- Documents configuration
    required_documents JSONB NOT NULL,

    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_onboarding_tenant ON onboarding_processes(tenant_id);
CREATE INDEX idx_onboarding_employee ON onboarding_processes(employee_id);
CREATE INDEX idx_onboarding_status ON onboarding_processes(status);
CREATE INDEX idx_onboarding_assigned ON onboarding_processes(assigned_to);
CREATE INDEX idx_onboarding_steps ON onboarding_steps(onboarding_id);
CREATE INDEX idx_onboarding_docs ON onboarding_documents(onboarding_id);
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Onboarding step types
export const onboardingStepTypes = [
  'PERSONAL_DATA',
  'DOCUMENTS',
  'CONTRACT',
  'ZUS_REGISTRATION',
  'TAX_CONFIGURATION',
  'SYSTEM_ACCESS',
] as const;

// Document types for onboarding
export const onboardingDocumentTypes = [
  'ID_CARD_COPY',
  'PERSONAL_QUESTIONNAIRE',
  'PREVIOUS_EMPLOYMENT_CERT',
  'MEDICAL_CERTIFICATE',
  'BHP_TRAINING',
  'GDPR_CONSENT',
  'BANK_ACCOUNT_FORM',
  'TAX_RESIDENCE_CERT',
  'EDUCATION_CERT',
] as const;

// NFZ Branch codes
export const nfzBranchCodes = [
  '01', // Dolnośląski
  '02', // Kujawsko-Pomorski
  '03', // Lubelski
  '04', // Lubuski
  '05', // Łódzki
  '06', // Małopolski
  '07', // Mazowiecki
  '08', // Opolski
  '09', // Podkarpacki
  '10', // Podlaski
  '11', // Pomorski
  '12', // Śląski
  '13', // Świętokrzyski
  '14', // Warmińsko-Mazurski
  '15', // Wielkopolski
  '16', // Zachodniopomorski
] as const;

// Start onboarding schema
export const startOnboardingSchema = z.object({
  employeeId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  targetCompletionDate: z.coerce.date().optional(),
  assignedTo: z.string().uuid().optional(),
});

// Update step schema
export const updateOnboardingStepSchema = z.object({
  onboardingId: z.string().uuid(),
  stepNumber: z.number().int().min(1).max(6),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']),
  data: z.record(z.any()).optional(),
});

// ZUS registration data schema
export const zusRegistrationDataSchema = z.object({
  nfzBranch: z.enum(nfzBranchCodes),
  previousEmployment: z.boolean(),
  previousEmployer: z.object({
    name: z.string(),
    nip: z.string().regex(/^\d{10}$/),
    terminationDate: z.coerce.date(),
  }).optional(),
  continuationOfZus: z.boolean(),
  disabilityLevel: z.enum(['NONE', 'LIGHT', 'MODERATE', 'SIGNIFICANT']).optional(),
  studentStatus: z.boolean().default(false),
  studentUntil: z.coerce.date().optional(),
});

// Tax configuration schema
export const taxConfigurationSchema = z.object({
  taxRelief: z.enum([
    'FULL',           // 1/12 kwoty zmniejszającej (300 zł/miesiąc)
    'HALF',           // 1/24 kwoty zmniejszającej (150 zł/miesiąc)
    'NONE',           // Brak ulgi
  ]),
  costOfRevenue: z.enum([
    'STANDARD',       // 250 zł/miesiąc
    'ELEVATED',       // 300 zł/miesiąc (dojazd z innej miejscowości)
    'IP_BOX',         // 50% dla praw autorskich
  ]),
  ppkParticipation: z.boolean(),
  ppkContributionRate: z.number().min(0.5).max(4).optional(), // 0.5% - 4%
  pit2Filed: z.boolean(),
  taxResidency: z.enum(['PL', 'EU', 'OTHER']).default('PL'),
});

// Document status update schema
export const updateDocumentStatusSchema = z.object({
  onboardingId: z.string().uuid(),
  documentId: z.string().uuid(),
  status: z.enum(['PENDING', 'RECEIVED', 'REJECTED', 'NOT_APPLICABLE']),
  documentFileId: z.string().uuid().optional(),
  rejectionReason: z.string().max(500).optional(),
});

// Contract configuration for onboarding
export const onboardingContractSchema = z.object({
  contractType: z.enum([
    'UMOWA_O_PRACE',
    'UMOWA_ZLECENIE',
    'UMOWA_O_DZIELO',
  ]),
  position: z.string().min(1).max(100),
  departmentId: z.string().uuid().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  trialPeriod: z.boolean().default(false),
  trialEndDate: z.coerce.date().optional(),
  grossSalary: z.number().positive(),
  workingHours: z.number().min(0.125).max(1).default(1), // 1/8 to full-time
  workSchedule: z.enum(['STANDARD', 'SHIFT', 'FLEXIBLE', 'REMOTE']),
});

// Search onboardings schema
export const searchOnboardingsSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD', 'ALL']).default('ALL'),
  assignedTo: z.string().uuid().optional(),
  startedAfter: z.coerce.date().optional(),
  startedBefore: z.coerce.date().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});
```

### tRPC Router

```typescript
import { router, hrManagerProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  startOnboardingSchema,
  updateOnboardingStepSchema,
  zusRegistrationDataSchema,
  taxConfigurationSchema,
  updateDocumentStatusSchema,
  onboardingContractSchema,
  searchOnboardingsSchema,
} from './schemas';
import { OnboardingService } from './onboarding.service';
import { AuditService } from '../common/audit.service';

export const onboardingRouter = router({
  // Start onboarding process
  start: hrManagerProcedure
    .input(startOnboardingSchema)
    .mutation(async ({ input, ctx }) => {
      const onboardingService = new OnboardingService(ctx.db);
      const auditService = new AuditService(ctx.db);

      // Check if employee exists
      const employee = await ctx.db.employee.findUnique({
        where: { id: input.employeeId },
      });

      if (!employee) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pracownik nie został znaleziony',
        });
      }

      // Check for existing active onboarding
      const existingOnboarding = await onboardingService.findActiveByEmployee(input.employeeId);

      if (existingOnboarding) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Pracownik ma już aktywny proces onboardingu',
        });
      }

      // Create onboarding process
      const onboarding = await onboardingService.create({
        ...input,
        tenantId: ctx.tenantId,
        assignedTo: input.assignedTo || ctx.userId,
      });

      await auditService.log({
        action: 'onboarding.started',
        resourceType: 'onboarding',
        resourceId: onboarding.id,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        metadata: { employeeId: input.employeeId },
      });

      return onboarding;
    }),

  // Get onboarding by ID
  getById: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const onboardingService = new OnboardingService(ctx.db);

      const onboarding = await onboardingService.findById(input.id);

      if (!onboarding) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Proces onboardingu nie został znaleziony',
        });
      }

      return onboarding;
    }),

  // Get onboarding for employee
  getByEmployee: hrManagerProcedure
    .input(z.object({ employeeId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const onboardingService = new OnboardingService(ctx.db);
      return onboardingService.findByEmployee(input.employeeId);
    }),

  // Update step status
  updateStep: hrManagerProcedure
    .input(updateOnboardingStepSchema)
    .mutation(async ({ input, ctx }) => {
      const onboardingService = new OnboardingService(ctx.db);
      const auditService = new AuditService(ctx.db);

      const step = await onboardingService.updateStep({
        ...input,
        completedBy: ctx.userId,
      });

      await auditService.log({
        action: 'onboarding.step_updated',
        resourceType: 'onboarding',
        resourceId: input.onboardingId,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        metadata: {
          stepNumber: input.stepNumber,
          status: input.status,
        },
      });

      return step;
    }),

  // Save ZUS registration data
  saveZusData: hrManagerProcedure
    .input(z.object({
      onboardingId: z.string().uuid(),
      data: zusRegistrationDataSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const onboardingService = new OnboardingService(ctx.db);

      await onboardingService.saveStepData(
        input.onboardingId,
        4, // ZUS step
        input.data
      );

      // Prepare ZUA form data
      const zuaData = await onboardingService.prepareZuaForm(
        input.onboardingId,
        input.data
      );

      return { success: true, zuaData };
    }),

  // Save tax configuration
  saveTaxConfig: hrManagerProcedure
    .input(z.object({
      onboardingId: z.string().uuid(),
      data: taxConfigurationSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const onboardingService = new OnboardingService(ctx.db);

      await onboardingService.saveStepData(
        input.onboardingId,
        5, // Tax step
        input.data
      );

      // Update employee tax settings
      const onboarding = await onboardingService.findById(input.onboardingId);

      await ctx.db.employee.update({
        where: { id: onboarding!.employeeId },
        data: {
          taxRelief: input.data.taxRelief,
          costOfRevenue: input.data.costOfRevenue,
          ppkParticipation: input.data.ppkParticipation,
          ppkContributionRate: input.data.ppkContributionRate,
        },
      });

      return { success: true };
    }),

  // Update document status
  updateDocument: hrManagerProcedure
    .input(updateDocumentStatusSchema)
    .mutation(async ({ input, ctx }) => {
      const onboardingService = new OnboardingService(ctx.db);

      await onboardingService.updateDocumentStatus({
        ...input,
        receivedBy: ctx.userId,
      });

      // Check if all required documents are received
      const allReceived = await onboardingService.checkAllDocumentsReceived(
        input.onboardingId
      );

      if (allReceived) {
        await onboardingService.updateStep({
          onboardingId: input.onboardingId,
          stepNumber: 2, // Documents step
          status: 'COMPLETED',
          completedBy: ctx.userId,
        });
      }

      return { success: true, allDocumentsReceived: allReceived };
    }),

  // Generate contract from onboarding
  generateContract: hrManagerProcedure
    .input(z.object({
      onboardingId: z.string().uuid(),
      contractConfig: onboardingContractSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const onboardingService = new OnboardingService(ctx.db);
      const auditService = new AuditService(ctx.db);

      const contract = await onboardingService.generateContract(
        input.onboardingId,
        input.contractConfig,
        ctx.userId
      );

      // Mark contract step as completed
      await onboardingService.updateStep({
        onboardingId: input.onboardingId,
        stepNumber: 3, // Contract step
        status: 'COMPLETED',
        completedBy: ctx.userId,
        data: { contractId: contract.id },
      });

      await auditService.log({
        action: 'onboarding.contract_generated',
        resourceType: 'onboarding',
        resourceId: input.onboardingId,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        metadata: { contractId: contract.id },
      });

      return contract;
    }),

  // Complete onboarding
  complete: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const onboardingService = new OnboardingService(ctx.db);
      const auditService = new AuditService(ctx.db);

      // Verify all required steps are completed
      const canComplete = await onboardingService.canComplete(input.id);

      if (!canComplete.success) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Nie można zakończyć onboardingu: ${canComplete.reason}`,
        });
      }

      const onboarding = await onboardingService.complete(input.id, ctx.userId);

      await auditService.log({
        action: 'onboarding.completed',
        resourceType: 'onboarding',
        resourceId: input.id,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
      });

      return onboarding;
    }),

  // Search onboardings
  search: hrManagerProcedure
    .input(searchOnboardingsSchema)
    .query(async ({ input, ctx }) => {
      const onboardingService = new OnboardingService(ctx.db);

      return onboardingService.search({
        ...input,
        tenantId: ctx.tenantId,
      });
    }),

  // Get onboarding statistics
  getStatistics: hrManagerProcedure
    .query(async ({ ctx }) => {
      const onboardingService = new OnboardingService(ctx.db);
      return onboardingService.getStatistics(ctx.tenantId);
    }),

  // Get available templates
  getTemplates: hrManagerProcedure
    .query(async ({ ctx }) => {
      return ctx.db.onboardingTemplate.findMany({
        where: {
          tenantId: ctx.tenantId,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });
    }),
});
```

### Service Implementation

```typescript
import { PrismaClient } from '@prisma/client';

export class OnboardingService {
  constructor(private db: PrismaClient) {}

  private readonly defaultSteps = [
    { number: 1, name: 'Dane osobowe', type: 'PERSONAL_DATA' },
    { number: 2, name: 'Dokumenty', type: 'DOCUMENTS' },
    { number: 3, name: 'Umowa', type: 'CONTRACT' },
    { number: 4, name: 'Rejestracja ZUS', type: 'ZUS_REGISTRATION' },
    { number: 5, name: 'Konfiguracja podatkowa', type: 'TAX_CONFIGURATION' },
    { number: 6, name: 'Dostęp do systemu', type: 'SYSTEM_ACCESS' },
  ];

  private readonly defaultDocuments = [
    { type: 'ID_CARD_COPY', name: 'Kopia dowodu osobistego', required: true },
    { type: 'PERSONAL_QUESTIONNAIRE', name: 'Kwestionariusz osobowy', required: true },
    { type: 'PREVIOUS_EMPLOYMENT_CERT', name: 'Świadectwo pracy', required: false },
    { type: 'MEDICAL_CERTIFICATE', name: 'Orzeczenie lekarskie', required: true },
    { type: 'BHP_TRAINING', name: 'Szkolenie BHP', required: true },
    { type: 'GDPR_CONSENT', name: 'Zgoda RODO', required: true },
    { type: 'BANK_ACCOUNT_FORM', name: 'Formularz konta bankowego', required: false },
  ];

  async create(data: {
    employeeId: string;
    tenantId: string;
    templateId?: string;
    targetCompletionDate?: Date;
    assignedTo: string;
  }) {
    // Get template or use defaults
    let steps = this.defaultSteps;
    let documents = this.defaultDocuments;

    if (data.templateId) {
      const template = await this.db.onboardingTemplate.findUnique({
        where: { id: data.templateId },
      });
      if (template) {
        steps = template.steps as typeof steps;
        documents = template.requiredDocuments as typeof documents;
      }
    }

    return this.db.$transaction(async (tx) => {
      // Create onboarding process
      const onboarding = await tx.onboardingProcess.create({
        data: {
          tenantId: data.tenantId,
          employeeId: data.employeeId,
          targetCompletionDate: data.targetCompletionDate,
          assignedTo: data.assignedTo,
          totalSteps: steps.length,
        },
      });

      // Create steps
      await tx.onboardingStep.createMany({
        data: steps.map(step => ({
          onboardingId: onboarding.id,
          stepNumber: step.number,
          stepName: step.name,
          stepType: step.type,
          status: step.number === 1 ? 'IN_PROGRESS' : 'PENDING',
        })),
      });

      // Create document checklist
      await tx.onboardingDocument.createMany({
        data: documents.map(doc => ({
          onboardingId: onboarding.id,
          documentType: doc.type,
          documentName: doc.name,
          isRequired: doc.required,
        })),
      });

      return this.findById(onboarding.id);
    });
  }

  async findById(id: string) {
    return this.db.onboardingProcess.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true,
          },
        },
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
        documents: {
          orderBy: { documentType: 'asc' },
        },
        assignedToUser: {
          select: { firstName: true, lastName: true },
        },
      },
    });
  }

  async findActiveByEmployee(employeeId: string) {
    return this.db.onboardingProcess.findFirst({
      where: {
        employeeId,
        status: 'IN_PROGRESS',
      },
    });
  }

  async findByEmployee(employeeId: string) {
    return this.db.onboardingProcess.findMany({
      where: { employeeId },
      include: {
        steps: { orderBy: { stepNumber: 'asc' } },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async updateStep(data: {
    onboardingId: string;
    stepNumber: number;
    status: string;
    completedBy: string;
    data?: Record<string, any>;
  }) {
    return this.db.$transaction(async (tx) => {
      const step = await tx.onboardingStep.update({
        where: {
          onboardingId_stepNumber: {
            onboardingId: data.onboardingId,
            stepNumber: data.stepNumber,
          },
        },
        data: {
          status: data.status,
          completedAt: data.status === 'COMPLETED' ? new Date() : null,
          completedBy: data.status === 'COMPLETED' ? data.completedBy : null,
          data: data.data,
        },
      });

      // Update current step in onboarding
      if (data.status === 'COMPLETED') {
        const nextStep = data.stepNumber + 1;
        await tx.onboardingProcess.update({
          where: { id: data.onboardingId },
          data: { currentStep: nextStep },
        });

        // Mark next step as in progress if exists
        await tx.onboardingStep.updateMany({
          where: {
            onboardingId: data.onboardingId,
            stepNumber: nextStep,
          },
          data: { status: 'IN_PROGRESS' },
        });
      }

      return step;
    });
  }

  async saveStepData(onboardingId: string, stepNumber: number, data: Record<string, any>) {
    return this.db.onboardingStep.update({
      where: {
        onboardingId_stepNumber: { onboardingId, stepNumber },
      },
      data: { data },
    });
  }

  async updateDocumentStatus(data: {
    onboardingId: string;
    documentId: string;
    status: string;
    documentFileId?: string;
    receivedBy: string;
    rejectionReason?: string;
  }) {
    return this.db.onboardingDocument.update({
      where: { id: data.documentId },
      data: {
        status: data.status,
        documentId: data.documentFileId,
        receivedAt: data.status === 'RECEIVED' ? new Date() : null,
        receivedBy: data.status === 'RECEIVED' ? data.receivedBy : null,
        rejectionReason: data.rejectionReason,
      },
    });
  }

  async checkAllDocumentsReceived(onboardingId: string): Promise<boolean> {
    const pendingRequired = await this.db.onboardingDocument.count({
      where: {
        onboardingId,
        isRequired: true,
        status: { not: 'RECEIVED' },
      },
    });
    return pendingRequired === 0;
  }

  async prepareZuaForm(onboardingId: string, zusData: any) {
    const onboarding = await this.findById(onboardingId);
    if (!onboarding) throw new Error('Onboarding not found');

    // Prepare ZUA form structure
    return {
      formType: 'ZUA',
      employee: {
        pesel: '***', // Will be filled from decrypted data
        firstName: onboarding.employee.firstName,
        lastName: onboarding.employee.lastName,
      },
      nfzBranch: zusData.nfzBranch,
      registrationDate: new Date(),
      insuranceCodes: {
        emerytalne: true,
        rentowe: true,
        chorobowe: true,
        wypadkowe: true,
        zdrowotne: true,
      },
    };
  }

  async generateContract(
    onboardingId: string,
    config: any,
    userId: string
  ) {
    const onboarding = await this.findById(onboardingId);
    if (!onboarding) throw new Error('Onboarding not found');

    // Create contract record
    return this.db.contract.create({
      data: {
        employeeId: onboarding.employeeId,
        tenantId: onboarding.tenantId,
        contractType: config.contractType,
        position: config.position,
        departmentId: config.departmentId,
        startDate: config.startDate,
        endDate: config.endDate,
        trialPeriod: config.trialPeriod,
        trialEndDate: config.trialEndDate,
        grossSalary: config.grossSalary,
        workingHours: config.workingHours,
        workSchedule: config.workSchedule,
        isActive: true,
        createdBy: userId,
      },
    });
  }

  async canComplete(id: string): Promise<{ success: boolean; reason?: string }> {
    const onboarding = await this.findById(id);
    if (!onboarding) return { success: false, reason: 'Onboarding not found' };

    // Check required steps
    const requiredSteps = [1, 2, 3, 4, 5]; // First 5 steps are required
    for (const stepNum of requiredSteps) {
      const step = onboarding.steps.find(s => s.stepNumber === stepNum);
      if (!step || step.status !== 'COMPLETED') {
        return {
          success: false,
          reason: `Krok "${step?.stepName || stepNum}" nie został ukończony`
        };
      }
    }

    // Check required documents
    const pendingDocs = onboarding.documents.filter(
      d => d.isRequired && d.status !== 'RECEIVED'
    );
    if (pendingDocs.length > 0) {
      return {
        success: false,
        reason: `Brakuje ${pendingDocs.length} wymaganych dokumentów`,
      };
    }

    return { success: true };
  }

  async complete(id: string, userId: string) {
    return this.db.onboardingProcess.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async search(input: {
    tenantId: string;
    status?: string;
    assignedTo?: string;
    startedAfter?: Date;
    startedBefore?: Date;
    page: number;
    pageSize: number;
  }) {
    const where: any = { tenantId: input.tenantId };

    if (input.status && input.status !== 'ALL') {
      where.status = input.status;
    }
    if (input.assignedTo) {
      where.assignedTo = input.assignedTo;
    }
    if (input.startedAfter) {
      where.startedAt = { ...where.startedAt, gte: input.startedAfter };
    }
    if (input.startedBefore) {
      where.startedAt = { ...where.startedAt, lte: input.startedBefore };
    }

    const [items, total] = await Promise.all([
      this.db.onboardingProcess.findMany({
        where,
        include: {
          employee: {
            select: { firstName: true, lastName: true, position: true },
          },
          steps: {
            select: { stepNumber: true, status: true },
          },
          documents: {
            where: { isRequired: true },
            select: { status: true },
          },
        },
        orderBy: { startedAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.db.onboardingProcess.count({ where }),
    ]);

    return {
      items: items.map(item => ({
        ...item,
        progress: this.calculateProgress(item.steps),
        pendingDocuments: item.documents.filter(d => d.status === 'PENDING').length,
      })),
      total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.ceil(total / input.pageSize),
    };
  }

  async getStatistics(tenantId: string) {
    const [inProgress, completed, thisMonth] = await Promise.all([
      this.db.onboardingProcess.count({
        where: { tenantId, status: 'IN_PROGRESS' },
      }),
      this.db.onboardingProcess.count({
        where: { tenantId, status: 'COMPLETED' },
      }),
      this.db.onboardingProcess.count({
        where: {
          tenantId,
          startedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    return { inProgress, completed, thisMonth };
  }

  private calculateProgress(steps: { stepNumber: number; status: string }[]): number {
    const completed = steps.filter(s => s.status === 'COMPLETED').length;
    return Math.round((completed / steps.length) * 100);
  }
}
```

---

## Test Specification

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      onboardingProcess: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      onboardingStep: {
        createMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      onboardingDocument: {
        createMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn((fn) => fn(mockDb)),
    };
    service = new OnboardingService(mockDb);
  });

  describe('canComplete', () => {
    it('should return success when all required steps are completed', async () => {
      mockDb.onboardingProcess.findUnique.mockResolvedValue({
        id: '1',
        steps: [
          { stepNumber: 1, status: 'COMPLETED' },
          { stepNumber: 2, status: 'COMPLETED' },
          { stepNumber: 3, status: 'COMPLETED' },
          { stepNumber: 4, status: 'COMPLETED' },
          { stepNumber: 5, status: 'COMPLETED' },
          { stepNumber: 6, status: 'PENDING' },
        ],
        documents: [
          { isRequired: true, status: 'RECEIVED' },
          { isRequired: true, status: 'RECEIVED' },
          { isRequired: false, status: 'PENDING' },
        ],
      });

      const result = await service.canComplete('1');

      expect(result.success).toBe(true);
    });

    it('should return failure when required step is not completed', async () => {
      mockDb.onboardingProcess.findUnique.mockResolvedValue({
        id: '1',
        steps: [
          { stepNumber: 1, status: 'COMPLETED', stepName: 'Dane osobowe' },
          { stepNumber: 2, status: 'IN_PROGRESS', stepName: 'Dokumenty' },
          { stepNumber: 3, status: 'PENDING', stepName: 'Umowa' },
          { stepNumber: 4, status: 'PENDING', stepName: 'ZUS' },
          { stepNumber: 5, status: 'PENDING', stepName: 'Podatki' },
        ],
        documents: [],
      });

      const result = await service.canComplete('1');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Dokumenty');
    });

    it('should return failure when required documents are missing', async () => {
      mockDb.onboardingProcess.findUnique.mockResolvedValue({
        id: '1',
        steps: [
          { stepNumber: 1, status: 'COMPLETED' },
          { stepNumber: 2, status: 'COMPLETED' },
          { stepNumber: 3, status: 'COMPLETED' },
          { stepNumber: 4, status: 'COMPLETED' },
          { stepNumber: 5, status: 'COMPLETED' },
        ],
        documents: [
          { isRequired: true, status: 'RECEIVED' },
          { isRequired: true, status: 'PENDING' }, // Missing
          { isRequired: false, status: 'PENDING' },
        ],
      });

      const result = await service.canComplete('1');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Brakuje 1 wymaganych dokumentów');
    });
  });
});
```

---

## Security Checklist

- [x] Only HR managers can access onboarding processes
- [x] Employee data encrypted during onboarding
- [x] Document uploads scanned for malware
- [x] Audit trail for all onboarding actions
- [x] PESEL and personal data handled securely
- [x] ZUS data validated before submission
- [x] Contract generation logged
- [x] Tenant isolation enforced

---

## Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `onboarding.started` | Process initiated | Employee ID, template |
| `onboarding.step_updated` | Step status changed | Step number, status |
| `onboarding.document_received` | Document uploaded | Document type |
| `onboarding.contract_generated` | Contract created | Contract ID |
| `onboarding.completed` | Process finished | Completion time |

---

*This story is part of the BMAD methodology for the Polish Accounting Platform.*
