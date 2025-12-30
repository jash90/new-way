# HRP-003: Contract Management

> **Story ID**: HRP-003
> **Epic**: HR & Payroll Module (HRP)
> **Priority**: P0 (Critical)
> **Points**: 13
> **Status**: 📋 Ready for Development

---

## User Story

**As an** HR manager,
**I want to** manage employment contracts according to Polish labor law,
**So that** all employment relationships are properly documented and compliant.

---

## Acceptance Criteria

### AC1: Create Employment Contract (Umowa o pracę)
```gherkin
Given I am an authenticated HR manager
When I create a new employment contract with:
  | Field | Value |
  | Employee | Jan Kowalski |
  | Contract Type | Umowa o pracę |
  | Position | Software Developer |
  | Start Date | 2024-01-15 |
  | Gross Salary | 15000 PLN |
  | Working Hours | Full-time (1.0) |
Then the contract should be created with Polish legal clauses
And the contract should be linked to the employee
And the employee's primary contract should be updated
And an audit event "contract.created" should be logged
```

### AC2: Create Mandate Contract (Umowa zlecenie)
```gherkin
Given I am an authenticated HR manager
When I create a mandate contract with:
  | Field | Value |
  | Contractor | Anna Nowak |
  | Rate Type | Hourly |
  | Rate Amount | 150 PLN/hour |
  | ZUS Contributions | Full (student exemption: No) |
Then the contract should reflect civil law agreement terms
And ZUS contribution settings should be saved
And hourly rate should be validated against minimum wage
```

### AC3: Contract Amendment (Aneks)
```gherkin
Given an employee has an active contract
When I create an amendment with:
  | Field | Old Value | New Value |
  | Position | Junior Developer | Developer |
  | Gross Salary | 12000 PLN | 15000 PLN |
  | Effective Date | 2024-07-01 | |
Then the amendment should be created referencing original contract
And changes should be applied from the effective date
And the original contract terms should be preserved in history
```

### AC4: Contract Termination
```gherkin
Given an employee has an active contract
When I initiate contract termination with:
  | Field | Value |
  | Termination Type | Za wypowiedzeniem |
  | Notice Period | 3 months |
  | Last Day | 2024-12-31 |
  | Reason | Employee resignation |
Then the termination date should be calculated correctly
And świadectwo pracy requirements should be triggered
And leave balance settlement should be initiated
And final payroll calculation should be scheduled
```

### AC5: Generate Contract Document
```gherkin
Given I have configured a contract
When I generate the contract document
Then a PDF should be generated with:
  | Section | Content |
  | Header | Company details, logo |
  | Parties | Employer and employee data |
  | Terms | Position, salary, hours |
  | Legal clauses | Kodeks Pracy references |
  | Signatures | Signature placeholders |
And the document should be in Polish
And date should use Polish format (dd.mm.yyyy)
```

### AC6: Generate Świadectwo Pracy
```gherkin
Given an employee's contract has been terminated
When I generate świadectwo pracy
Then the document should include:
  | Section | Content |
  | Employment period | Start and end dates |
  | Position | All positions held |
  | Working hours | Full-time/part-time |
  | Leave used | Vacation days taken |
  | Special conditions | Hazardous work, etc. |
And the document should comply with Rozporządzenie MRPiPS
```

---

## Technical Specification

### Database Schema

```sql
-- Employment contracts
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    employee_id UUID NOT NULL REFERENCES employees(id),

    -- Contract identification
    contract_number VARCHAR(50) UNIQUE,
    contract_type VARCHAR(30) NOT NULL CHECK (contract_type IN (
        'UMOWA_O_PRACE',
        'UMOWA_ZLECENIE',
        'UMOWA_O_DZIELO',
        'B2B'
    )),

    -- Contract terms
    position VARCHAR(100) NOT NULL,
    department_id UUID REFERENCES departments(id),
    work_location VARCHAR(200),

    -- Duration
    start_date DATE NOT NULL,
    end_date DATE, -- NULL for indefinite
    indefinite BOOLEAN DEFAULT false,

    -- Trial period
    trial_period BOOLEAN DEFAULT false,
    trial_end_date DATE,
    trial_salary DECIMAL(12,2),

    -- Compensation
    salary_type VARCHAR(20) NOT NULL CHECK (salary_type IN ('MONTHLY', 'HOURLY', 'TASK')),
    gross_salary DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'PLN',

    -- Working time
    working_hours DECIMAL(3,2) NOT NULL DEFAULT 1.0, -- 1.0 = full-time
    work_schedule VARCHAR(30) DEFAULT 'STANDARD',

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN (
        'DRAFT', 'ACTIVE', 'SUSPENDED', 'TERMINATED', 'EXPIRED'
    )),
    is_primary BOOLEAN DEFAULT true,

    -- Termination
    termination_date DATE,
    termination_type VARCHAR(30),
    termination_reason TEXT,
    notice_period_days INTEGER,

    -- ZUS settings (for civil contracts)
    zus_emerytalne BOOLEAN DEFAULT true,
    zus_rentowe BOOLEAN DEFAULT true,
    zus_chorobowe BOOLEAN DEFAULT true,
    zus_student_exemption BOOLEAN DEFAULT false,

    -- Metadata
    document_id UUID REFERENCES documents(id),
    parent_contract_id UUID REFERENCES contracts(id), -- For amendments
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Contract amendments
CREATE TABLE contract_amendments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id),

    amendment_number INTEGER NOT NULL,
    effective_date DATE NOT NULL,

    -- Changes
    changes JSONB NOT NULL, -- {field: {old: x, new: y}}

    -- Status
    status VARCHAR(20) DEFAULT 'ACTIVE',

    -- Document
    document_id UUID REFERENCES documents(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),

    UNIQUE(contract_id, amendment_number)
);

-- Contract templates
CREATE TABLE contract_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    name VARCHAR(100) NOT NULL,
    contract_type VARCHAR(30) NOT NULL,
    language VARCHAR(5) DEFAULT 'pl',

    -- Template content
    template_content TEXT NOT NULL,
    variables JSONB, -- Available template variables

    -- Settings
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Świadectwo pracy records
CREATE TABLE employment_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    employee_id UUID NOT NULL REFERENCES employees(id),

    -- Employment details
    employment_start DATE NOT NULL,
    employment_end DATE NOT NULL,
    positions_held JSONB NOT NULL,
    working_time_dimension DECIMAL(3,2),

    -- Leave information
    vacation_days_used INTEGER,
    vacation_days_equivalent INTEGER,
    sick_leave_days INTEGER,

    -- Special circumstances
    special_conditions TEXT,
    additional_info TEXT,

    -- Document
    document_id UUID REFERENCES documents(id),
    issued_date DATE NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_contracts_tenant ON contracts(tenant_id);
CREATE INDEX idx_contracts_employee ON contracts(employee_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_type ON contracts(contract_type);
CREATE INDEX idx_contracts_dates ON contracts(start_date, end_date);
CREATE INDEX idx_amendments_contract ON contract_amendments(contract_id);
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Contract types
export const contractTypes = [
  'UMOWA_O_PRACE',
  'UMOWA_ZLECENIE',
  'UMOWA_O_DZIELO',
  'B2B',
] as const;

// Termination types
export const terminationTypes = [
  'ZA_WYPOWIEDZENIEM',           // With notice
  'BEZ_WYPOWIEDZENIA',           // Without notice
  'ZA_POROZUMIENIEM',            // Mutual agreement
  'WYGASNIECIE',                 // Contract expiration
  'SMIERC_PRACOWNIKA',           // Employee death
] as const;

// Work schedules
export const workSchedules = [
  'STANDARD',      // 8h/day, Mon-Fri
  'SHIFT',         // Shift work
  'FLEXIBLE',      // Flexible hours
  'REMOTE',        // Remote work
  'HYBRID',        // Hybrid
  'TASK_BASED',    // Task-based (for specific work contracts)
] as const;

// Minimum wage validation (2024)
const MINIMUM_WAGE_MONTHLY = 4242; // PLN gross
const MINIMUM_WAGE_HOURLY = 27.70; // PLN gross

// Create contract schema
export const createContractSchema = z.object({
  employeeId: z.string().uuid(),

  contractType: z.enum(contractTypes),
  position: z.string().min(1).max(100),
  departmentId: z.string().uuid().optional(),
  workLocation: z.string().max(200).optional(),

  // Duration
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  indefinite: z.boolean().default(false),

  // Trial period
  trialPeriod: z.boolean().default(false),
  trialEndDate: z.coerce.date().optional(),
  trialSalary: z.number().positive().optional(),

  // Compensation
  salaryType: z.enum(['MONTHLY', 'HOURLY', 'TASK']),
  grossSalary: z.number().positive(),
  currency: z.string().length(3).default('PLN'),

  // Working time
  workingHours: z.number().min(0.125).max(1).default(1), // 1/8 to full-time
  workSchedule: z.enum(workSchedules).default('STANDARD'),

  // ZUS settings (for civil contracts)
  zusEmerytalne: z.boolean().default(true),
  zusRentowe: z.boolean().default(true),
  zusChorobowe: z.boolean().default(true),
  zusStudentExemption: z.boolean().default(false),
}).refine(data => {
  // Validate minimum wage for employment contracts
  if (data.contractType === 'UMOWA_O_PRACE') {
    if (data.salaryType === 'MONTHLY') {
      const proRatedMinimum = MINIMUM_WAGE_MONTHLY * data.workingHours;
      return data.grossSalary >= proRatedMinimum;
    }
    if (data.salaryType === 'HOURLY') {
      return data.grossSalary >= MINIMUM_WAGE_HOURLY;
    }
  }
  return true;
}, {
  message: 'Wynagrodzenie nie może być niższe od minimalnego',
  path: ['grossSalary'],
}).refine(data => {
  // Trial period validation
  if (data.trialPeriod && !data.trialEndDate) {
    return false;
  }
  return true;
}, {
  message: 'Data zakończenia okresu próbnego jest wymagana',
  path: ['trialEndDate'],
}).refine(data => {
  // End date validation for definite contracts
  if (!data.indefinite && !data.endDate) {
    return false;
  }
  return true;
}, {
  message: 'Data zakończenia jest wymagana dla umowy na czas określony',
  path: ['endDate'],
});

// Create amendment schema
export const createAmendmentSchema = z.object({
  contractId: z.string().uuid(),
  effectiveDate: z.coerce.date(),
  changes: z.object({
    position: z.object({
      old: z.string(),
      new: z.string(),
    }).optional(),
    grossSalary: z.object({
      old: z.number(),
      new: z.number(),
    }).optional(),
    workingHours: z.object({
      old: z.number(),
      new: z.number(),
    }).optional(),
    departmentId: z.object({
      old: z.string().uuid().nullable(),
      new: z.string().uuid().nullable(),
    }).optional(),
    workLocation: z.object({
      old: z.string().nullable(),
      new: z.string().nullable(),
    }).optional(),
  }).refine(changes => Object.keys(changes).length > 0, {
    message: 'Aneks musi zawierać przynajmniej jedną zmianę',
  }),
});

// Terminate contract schema
export const terminateContractSchema = z.object({
  contractId: z.string().uuid(),
  terminationType: z.enum(terminationTypes),
  terminationDate: z.coerce.date(),
  reason: z.string().max(1000).optional(),
  noticePeriodDays: z.number().int().min(0).optional(),
  settlementDate: z.coerce.date().optional(),
});

// Generate certificate schema
export const generateCertificateSchema = z.object({
  employeeId: z.string().uuid(),
  employmentStart: z.coerce.date(),
  employmentEnd: z.coerce.date(),
  includeLeaveInfo: z.boolean().default(true),
  additionalInfo: z.string().max(2000).optional(),
});

// Search contracts schema
export const searchContractsSchema = z.object({
  employeeId: z.string().uuid().optional(),
  contractType: z.enum([...contractTypes, 'ALL']).default('ALL'),
  status: z.enum(['DRAFT', 'ACTIVE', 'SUSPENDED', 'TERMINATED', 'EXPIRED', 'ALL']).default('ALL'),
  startDateFrom: z.coerce.date().optional(),
  startDateTo: z.coerce.date().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
```

### tRPC Router

```typescript
import { router, hrManagerProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  createContractSchema,
  createAmendmentSchema,
  terminateContractSchema,
  generateCertificateSchema,
  searchContractsSchema,
} from './schemas';
import { ContractService } from './contract.service';
import { DocumentService } from '../documents/document.service';
import { AuditService } from '../common/audit.service';

export const contractRouter = router({
  // Create contract
  create: hrManagerProcedure
    .input(createContractSchema)
    .mutation(async ({ input, ctx }) => {
      const contractService = new ContractService(ctx.db);
      const auditService = new AuditService(ctx.db);

      // Verify employee exists
      const employee = await ctx.db.employee.findUnique({
        where: { id: input.employeeId },
      });

      if (!employee) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pracownik nie został znaleziony',
        });
      }

      // Check for overlapping contracts
      const overlapping = await contractService.findOverlapping(
        input.employeeId,
        input.startDate,
        input.endDate
      );

      if (overlapping.length > 0 && input.contractType === 'UMOWA_O_PRACE') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Pracownik ma już aktywną umowę o pracę w tym okresie',
        });
      }

      const contract = await contractService.create({
        ...input,
        tenantId: ctx.tenantId,
        createdBy: ctx.userId,
      });

      await auditService.log({
        action: 'contract.created',
        resourceType: 'contract',
        resourceId: contract.id,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        metadata: {
          employeeId: input.employeeId,
          contractType: input.contractType,
        },
      });

      return contract;
    }),

  // Get contract by ID
  getById: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const contractService = new ContractService(ctx.db);
      const contract = await contractService.findById(input.id);

      if (!contract) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Umowa nie została znaleziona',
        });
      }

      return contract;
    }),

  // Get contracts for employee
  getByEmployee: hrManagerProcedure
    .input(z.object({ employeeId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const contractService = new ContractService(ctx.db);
      return contractService.findByEmployee(input.employeeId);
    }),

  // Search contracts
  search: hrManagerProcedure
    .input(searchContractsSchema)
    .query(async ({ input, ctx }) => {
      const contractService = new ContractService(ctx.db);
      return contractService.search({ ...input, tenantId: ctx.tenantId });
    }),

  // Create amendment
  createAmendment: hrManagerProcedure
    .input(createAmendmentSchema)
    .mutation(async ({ input, ctx }) => {
      const contractService = new ContractService(ctx.db);
      const auditService = new AuditService(ctx.db);

      const contract = await contractService.findById(input.contractId);

      if (!contract) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Umowa nie została znaleziona',
        });
      }

      if (contract.status !== 'ACTIVE') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Można aneksować tylko aktywne umowy',
        });
      }

      const amendment = await contractService.createAmendment({
        ...input,
        createdBy: ctx.userId,
      });

      await auditService.log({
        action: 'contract.amended',
        resourceType: 'contract',
        resourceId: input.contractId,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        metadata: {
          amendmentId: amendment.id,
          changes: Object.keys(input.changes),
        },
      });

      return amendment;
    }),

  // Terminate contract
  terminate: hrManagerProcedure
    .input(terminateContractSchema)
    .mutation(async ({ input, ctx }) => {
      const contractService = new ContractService(ctx.db);
      const auditService = new AuditService(ctx.db);

      const contract = await contractService.findById(input.contractId);

      if (!contract) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Umowa nie została znaleziona',
        });
      }

      if (contract.status !== 'ACTIVE') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Można rozwiązać tylko aktywne umowy',
        });
      }

      // Validate notice period for employment contracts
      if (contract.contractType === 'UMOWA_O_PRACE' &&
          input.terminationType === 'ZA_WYPOWIEDZENIEM') {
        const requiredNoticePeriod = contractService.calculateNoticePeriod(contract);

        if (input.noticePeriodDays && input.noticePeriodDays < requiredNoticePeriod) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Minimalny okres wypowiedzenia to ${requiredNoticePeriod} dni`,
          });
        }
      }

      const terminated = await contractService.terminate({
        ...input,
        updatedBy: ctx.userId,
      });

      // Update employee status if primary contract
      if (contract.isPrimary) {
        await ctx.db.employee.update({
          where: { id: contract.employeeId },
          data: {
            status: 'TERMINATED',
            terminationDate: input.terminationDate,
          },
        });
      }

      await auditService.log({
        action: 'contract.terminated',
        resourceType: 'contract',
        resourceId: input.contractId,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        metadata: {
          terminationType: input.terminationType,
          terminationDate: input.terminationDate,
        },
      });

      return terminated;
    }),

  // Generate contract document
  generateDocument: hrManagerProcedure
    .input(z.object({
      contractId: z.string().uuid(),
      templateId: z.string().uuid().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const contractService = new ContractService(ctx.db);
      const documentService = new DocumentService(ctx.db);

      const contract = await contractService.findById(input.contractId);

      if (!contract) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Umowa nie została znaleziona',
        });
      }

      // Get template
      const template = input.templateId
        ? await ctx.db.contractTemplate.findUnique({ where: { id: input.templateId } })
        : await ctx.db.contractTemplate.findFirst({
            where: {
              tenantId: ctx.tenantId,
              contractType: contract.contractType,
              isDefault: true,
            },
          });

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono szablonu umowy',
        });
      }

      // Generate document
      const document = await contractService.generateDocument(contract, template);

      // Update contract with document reference
      await ctx.db.contract.update({
        where: { id: contract.id },
        data: { documentId: document.id },
      });

      return document;
    }),

  // Generate świadectwo pracy
  generateCertificate: hrManagerProcedure
    .input(generateCertificateSchema)
    .mutation(async ({ input, ctx }) => {
      const contractService = new ContractService(ctx.db);
      const auditService = new AuditService(ctx.db);

      // Get all contracts for employee in the period
      const contracts = await contractService.findByEmployeeInPeriod(
        input.employeeId,
        input.employmentStart,
        input.employmentEnd
      );

      if (contracts.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono umów w podanym okresie',
        });
      }

      // Get leave information
      const leaveInfo = input.includeLeaveInfo
        ? await contractService.getLeaveInfoForPeriod(
            input.employeeId,
            input.employmentStart,
            input.employmentEnd
          )
        : null;

      // Generate certificate
      const certificate = await contractService.generateCertificate({
        ...input,
        contracts,
        leaveInfo,
        tenantId: ctx.tenantId,
        createdBy: ctx.userId,
      });

      await auditService.log({
        action: 'certificate.generated',
        resourceType: 'employment_certificate',
        resourceId: certificate.id,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        metadata: { employeeId: input.employeeId },
      });

      return certificate;
    }),

  // Get contract templates
  getTemplates: hrManagerProcedure
    .input(z.object({
      contractType: z.enum(contractTypes).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const where: any = {
        tenantId: ctx.tenantId,
        isActive: true,
      };

      if (input.contractType) {
        where.contractType = input.contractType;
      }

      return ctx.db.contractTemplate.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      });
    }),
});
```

### Service Implementation

```typescript
import { PrismaClient } from '@prisma/client';

export class ContractService {
  constructor(private db: PrismaClient) {}

  async findById(id: string) {
    return this.db.contract.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            pesel: true,
          },
        },
        department: true,
        amendments: {
          orderBy: { amendmentNumber: 'desc' },
        },
        document: true,
      },
    });
  }

  async findByEmployee(employeeId: string) {
    return this.db.contract.findMany({
      where: { employeeId },
      include: {
        amendments: true,
        department: true,
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async findOverlapping(employeeId: string, startDate: Date, endDate?: Date) {
    return this.db.contract.findMany({
      where: {
        employeeId,
        status: 'ACTIVE',
        OR: [
          // Start date falls within existing contract
          {
            startDate: { lte: startDate },
            OR: [
              { endDate: { gte: startDate } },
              { endDate: null },
            ],
          },
          // End date falls within existing contract
          endDate ? {
            startDate: { lte: endDate },
            OR: [
              { endDate: { gte: endDate } },
              { endDate: null },
            ],
          } : {},
        ],
      },
    });
  }

  async create(data: any) {
    const contractNumber = await this.generateContractNumber(data.tenantId, data.contractType);

    return this.db.$transaction(async (tx) => {
      // If this is primary contract, deactivate others
      if (data.isPrimary !== false) {
        await tx.contract.updateMany({
          where: {
            employeeId: data.employeeId,
            isPrimary: true,
            status: 'ACTIVE',
          },
          data: { isPrimary: false },
        });
      }

      return tx.contract.create({
        data: {
          ...data,
          contractNumber,
          isPrimary: data.isPrimary ?? true,
        },
        include: {
          employee: true,
          department: true,
        },
      });
    });
  }

  async createAmendment(data: {
    contractId: string;
    effectiveDate: Date;
    changes: Record<string, { old: any; new: any }>;
    createdBy: string;
  }) {
    return this.db.$transaction(async (tx) => {
      // Get current amendment count
      const count = await tx.contractAmendment.count({
        where: { contractId: data.contractId },
      });

      // Create amendment record
      const amendment = await tx.contractAmendment.create({
        data: {
          contractId: data.contractId,
          amendmentNumber: count + 1,
          effectiveDate: data.effectiveDate,
          changes: data.changes,
          createdBy: data.createdBy,
        },
      });

      // Apply changes to contract if effective date is today or past
      if (data.effectiveDate <= new Date()) {
        const updateData: any = {};

        for (const [field, change] of Object.entries(data.changes)) {
          updateData[field] = change.new;
        }

        await tx.contract.update({
          where: { id: data.contractId },
          data: updateData,
        });
      }

      return amendment;
    });
  }

  async terminate(data: {
    contractId: string;
    terminationType: string;
    terminationDate: Date;
    reason?: string;
    noticePeriodDays?: number;
    updatedBy: string;
  }) {
    return this.db.contract.update({
      where: { id: data.contractId },
      data: {
        status: 'TERMINATED',
        terminationDate: data.terminationDate,
        terminationType: data.terminationType,
        terminationReason: data.reason,
        noticePeriodDays: data.noticePeriodDays,
        updatedAt: new Date(),
      },
    });
  }

  calculateNoticePeriod(contract: any): number {
    // Calculate based on employment duration (Polish law)
    const startDate = new Date(contract.startDate);
    const now = new Date();
    const monthsEmployed = Math.floor(
      (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    if (contract.trialPeriod) {
      // Trial period notice
      const trialDays = Math.floor(
        (new Date(contract.trialEndDate).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (trialDays <= 14) return 3;
      if (trialDays <= 90) return 7;
      return 14;
    }

    // Regular employment notice periods
    if (monthsEmployed < 6) return 14;
    if (monthsEmployed < 36) return 30;
    return 90; // 3 months
  }

  async generateDocument(contract: any, template: any) {
    // Replace template variables with contract data
    let content = template.templateContent;

    const variables: Record<string, string> = {
      '{{COMPANY_NAME}}': contract.tenant?.name || '',
      '{{COMPANY_ADDRESS}}': contract.tenant?.address || '',
      '{{COMPANY_NIP}}': contract.tenant?.nip || '',
      '{{EMPLOYEE_NAME}}': `${contract.employee.firstName} ${contract.employee.lastName}`,
      '{{EMPLOYEE_PESEL}}': contract.employee.pesel,
      '{{POSITION}}': contract.position,
      '{{DEPARTMENT}}': contract.department?.name || '',
      '{{START_DATE}}': this.formatPolishDate(contract.startDate),
      '{{END_DATE}}': contract.endDate ? this.formatPolishDate(contract.endDate) : 'czas nieokreślony',
      '{{GROSS_SALARY}}': this.formatPolishCurrency(contract.grossSalary),
      '{{SALARY_WORDS}}': this.numberToPolishWords(contract.grossSalary),
      '{{WORKING_HOURS}}': this.formatWorkingHours(contract.workingHours),
      '{{TODAY_DATE}}': this.formatPolishDate(new Date()),
    };

    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(key, 'g'), value);
    }

    // Generate PDF
    const pdf = await this.generatePDF(content);

    // Save document
    return this.db.document.create({
      data: {
        tenantId: contract.tenantId,
        type: 'CONTRACT',
        name: `Umowa_${contract.contractNumber}.pdf`,
        mimeType: 'application/pdf',
        size: pdf.length,
        content: pdf,
      },
    });
  }

  async generateCertificate(data: {
    employeeId: string;
    employmentStart: Date;
    employmentEnd: Date;
    contracts: any[];
    leaveInfo: any;
    additionalInfo?: string;
    tenantId: string;
    createdBy: string;
  }) {
    // Aggregate positions held
    const positionsHeld = data.contracts.map(c => ({
      position: c.position,
      from: c.startDate,
      to: c.terminationDate || c.endDate || data.employmentEnd,
    }));

    // Calculate working time dimension (average)
    const avgWorkingTime = data.contracts.reduce((sum, c) => sum + c.workingHours, 0)
      / data.contracts.length;

    // Create certificate record
    const certificate = await this.db.employmentCertificate.create({
      data: {
        tenantId: data.tenantId,
        employeeId: data.employeeId,
        employmentStart: data.employmentStart,
        employmentEnd: data.employmentEnd,
        positionsHeld,
        workingTimeDimension: avgWorkingTime,
        vacationDaysUsed: data.leaveInfo?.vacationDaysUsed || 0,
        vacationDaysEquivalent: data.leaveInfo?.vacationDaysEquivalent || 0,
        sickLeaveDays: data.leaveInfo?.sickLeaveDays || 0,
        additionalInfo: data.additionalInfo,
        issuedDate: new Date(),
        createdBy: data.createdBy,
      },
    });

    // Generate document
    // ... PDF generation logic

    return certificate;
  }

  async search(input: any) {
    const where: any = { tenantId: input.tenantId };

    if (input.employeeId) where.employeeId = input.employeeId;
    if (input.contractType && input.contractType !== 'ALL') where.contractType = input.contractType;
    if (input.status && input.status !== 'ALL') where.status = input.status;
    if (input.startDateFrom) where.startDate = { ...where.startDate, gte: input.startDateFrom };
    if (input.startDateTo) where.startDate = { ...where.startDate, lte: input.startDateTo };

    const [items, total] = await Promise.all([
      this.db.contract.findMany({
        where,
        include: {
          employee: { select: { firstName: true, lastName: true } },
          department: { select: { name: true } },
        },
        orderBy: { startDate: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.db.contract.count({ where }),
    ]);

    return {
      items,
      total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.ceil(total / input.pageSize),
    };
  }

  private async generateContractNumber(tenantId: string, contractType: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = this.getContractPrefix(contractType);

    const count = await this.db.contract.count({
      where: {
        tenantId,
        contractNumber: { startsWith: `${prefix}/${year}/` },
      },
    });

    return `${prefix}/${year}/${String(count + 1).padStart(4, '0')}`;
  }

  private getContractPrefix(contractType: string): string {
    switch (contractType) {
      case 'UMOWA_O_PRACE': return 'UoP';
      case 'UMOWA_ZLECENIE': return 'UZ';
      case 'UMOWA_O_DZIELO': return 'UoD';
      case 'B2B': return 'B2B';
      default: return 'UM';
    }
  }

  private formatPolishDate(date: Date): string {
    return new Intl.DateTimeFormat('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  private formatPolishCurrency(amount: number): string {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
    }).format(amount);
  }

  private formatWorkingHours(ratio: number): string {
    if (ratio === 1) return 'pełny etat';
    if (ratio === 0.5) return '1/2 etatu';
    if (ratio === 0.75) return '3/4 etatu';
    if (ratio === 0.25) return '1/4 etatu';
    return `${ratio} etatu`;
  }

  private numberToPolishWords(num: number): string {
    // Implementation of number to Polish words conversion
    // ... (complex implementation)
    return `${num} złotych`;
  }

  private async generatePDF(content: string): Promise<Buffer> {
    // PDF generation using puppeteer or similar
    // ... implementation
    return Buffer.from(content);
  }
}
```

---

## Security Checklist

- [x] Contract data protected by RLS policies
- [x] Only HR managers can create/modify contracts
- [x] Salary information encrypted at rest
- [x] Audit trail for all contract operations
- [x] Minimum wage validation enforced
- [x] Notice period calculations follow Polish law
- [x] Document generation secured
- [x] Personal data handling GDPR compliant

---

## Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `contract.created` | New contract | Type, employee |
| `contract.amended` | Amendment created | Changed fields |
| `contract.terminated` | Contract ended | Termination type |
| `certificate.generated` | Świadectwo created | Employee, period |

---

*This story is part of the BMAD methodology for the Polish Accounting Platform.*
