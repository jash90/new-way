# HRP-004: Benefits & Allowances Management

## Story Information
- **Story ID**: HRP-004
- **Epic**: HR & Payroll Module (HRP)
- **Title**: Benefits & Allowances Management
- **Priority**: High
- **Status**: Draft
- **Estimated Points**: 8
- **Sprint**: TBD

## User Story
**As a** HR Manager
**I want to** configure and manage employee benefits and allowances
**So that** compensation packages are properly tracked and included in payroll calculations

## Acceptance Criteria

### AC1: Benefit Type Configuration
```gherkin
Given I am an HR Manager
When I access the benefit configuration panel
Then I can create benefit types with:
  | Field              | Requirement                              |
  | Name               | Unique name (Polish/English)             |
  | Type               | RECURRING, ONE_TIME, CONDITIONAL         |
  | Category           | MONETARY, NON_MONETARY, INSURANCE, OTHER |
  | Taxable            | Boolean with tax code                    |
  | ZUS applicable     | Boolean with contribution type           |
  | Calculation method | FIXED, PERCENTAGE, FORMULA               |
```

### AC2: Employee Benefit Assignment
```gherkin
Given an employee exists in the system
When I assign benefits to the employee
Then the system should:
  - Allow selecting from configured benefit types
  - Set effective dates (start/end)
  - Define benefit amount or percentage
  - Support proration for partial periods
  - Track benefit history with amendments
```

### AC3: Polish-Specific Benefits
```gherkin
Given the system operates in Poland
When configuring benefits
Then the following Polish-specific benefits are available:
  | Benefit                    | Polish Name              | Typical Value     |
  | Meal allowance             | Dodatek żywieniowy       | Up to 450 PLN/mo  |
  | Transportation allowance   | Dodatek transportowy     | Variable          |
  | Private medical care       | Opieka medyczna          | Package-based     |
  | Sport/recreation card      | Karta MultiSport         | 100-200 PLN/mo    |
  | Life insurance             | Ubezpieczenie na życie   | Package-based     |
  | Holiday bonus (Wczasy pod gruszą) | Dofinansowanie wypoczynku | Per ZFŚS rules |
  | Child allowance (świadczenia socjalne) | Świadczenie socjalne | Per ZFŚS      |
```

### AC4: ZFŚS (Company Social Fund) Integration
```gherkin
Given the company has a ZFŚS fund
When managing social benefits
Then the system should:
  - Track ZFŚS fund balance
  - Calculate eligibility based on income criteria
  - Support different benefit tiers
  - Generate ZFŚS reports for accounting
  - Track employee applications and approvals
```

### AC5: Payroll Integration
```gherkin
Given benefits are assigned to employees
When running payroll calculation
Then benefits should:
  - Be automatically included in gross calculation (if monetary)
  - Apply correct tax treatment
  - Apply correct ZUS contributions
  - Appear as separate line items on payslip
  - Support benefit deductions (employee contributions)
```

### AC6: Benefit Audit Trail
```gherkin
Given benefit changes are made
When reviewing benefit history
Then the audit trail shows:
  - Who made the change
  - When the change was made
  - Previous and new values
  - Effective date of change
  - Reason for change (if provided)
```

## Technical Specification

### Database Schema

```sql
-- Benefit type definitions
CREATE TABLE benefit_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  code VARCHAR(50) NOT NULL,
  name_pl VARCHAR(200) NOT NULL,
  name_en VARCHAR(200),
  description TEXT,

  category VARCHAR(50) NOT NULL,           -- MONETARY, NON_MONETARY, INSURANCE, SOCIAL
  benefit_type VARCHAR(50) NOT NULL,       -- RECURRING, ONE_TIME, CONDITIONAL

  -- Tax & ZUS treatment
  is_taxable BOOLEAN DEFAULT true,
  tax_code VARCHAR(20),
  zus_applicable BOOLEAN DEFAULT true,
  zus_type VARCHAR(50),                    -- FULL, PARTIAL, EXEMPT

  -- Calculation
  calculation_method VARCHAR(50) NOT NULL, -- FIXED, PERCENTAGE, FORMULA
  default_amount DECIMAL(15, 2),
  percentage_base VARCHAR(50),             -- GROSS, NET, CUSTOM
  formula TEXT,

  -- Limits
  min_amount DECIMAL(15, 2),
  max_amount DECIMAL(15, 2),
  annual_limit DECIMAL(15, 2),

  -- ZFŚS specific
  is_zfss BOOLEAN DEFAULT false,
  zfss_income_thresholds JSONB,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL,

  UNIQUE(tenant_id, code)
);

-- Employee benefit assignments
CREATE TABLE employee_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  benefit_type_id UUID NOT NULL REFERENCES benefit_types(id),

  -- Effective period
  effective_from DATE NOT NULL,
  effective_to DATE,

  -- Amount
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PLN',

  -- Employee contribution (deduction)
  employee_contribution DECIMAL(15, 2) DEFAULT 0,

  -- For percentage-based
  percentage DECIMAL(5, 2),
  calculated_amount DECIMAL(15, 2),

  -- Status
  status VARCHAR(50) DEFAULT 'ACTIVE',     -- ACTIVE, SUSPENDED, TERMINATED

  -- Metadata
  notes TEXT,
  document_path TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,

  CONSTRAINT valid_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- Benefit history for audit
CREATE TABLE employee_benefit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_benefit_id UUID NOT NULL REFERENCES employee_benefits(id),

  change_type VARCHAR(50) NOT NULL,        -- CREATED, MODIFIED, SUSPENDED, TERMINATED
  previous_values JSONB,
  new_values JSONB,
  change_reason TEXT,

  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by UUID NOT NULL
);

-- ZFŚS fund management
CREATE TABLE zfss_fund (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  year INTEGER NOT NULL,

  -- Fund amounts
  initial_balance DECIMAL(15, 2) NOT NULL,
  employer_contributions DECIMAL(15, 2) DEFAULT 0,
  employee_repayments DECIMAL(15, 2) DEFAULT 0,
  disbursements DECIMAL(15, 2) DEFAULT 0,
  current_balance DECIMAL(15, 2) GENERATED ALWAYS AS (
    initial_balance + employer_contributions + employee_repayments - disbursements
  ) STORED,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, year)
);

-- ZFŚS applications
CREATE TABLE zfss_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  fund_id UUID NOT NULL REFERENCES zfss_fund(id),

  application_type VARCHAR(100) NOT NULL,  -- HOLIDAY, LOAN, EVENT, CHILDCARE
  requested_amount DECIMAL(15, 2) NOT NULL,
  approved_amount DECIMAL(15, 2),

  -- Income verification
  declared_income DECIMAL(15, 2),
  income_tier VARCHAR(50),

  status VARCHAR(50) DEFAULT 'PENDING',    -- PENDING, APPROVED, REJECTED, DISBURSED

  application_date DATE DEFAULT CURRENT_DATE,
  decision_date DATE,
  disbursement_date DATE,

  notes TEXT,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  decided_by UUID,

  CONSTRAINT valid_approval CHECK (
    status != 'APPROVED' OR approved_amount IS NOT NULL
  )
);

-- Indexes
CREATE INDEX idx_benefit_types_tenant ON benefit_types(tenant_id);
CREATE INDEX idx_employee_benefits_employee ON employee_benefits(employee_id);
CREATE INDEX idx_employee_benefits_dates ON employee_benefits(effective_from, effective_to);
CREATE INDEX idx_employee_benefits_status ON employee_benefits(status);
CREATE INDEX idx_zfss_applications_employee ON zfss_applications(employee_id);
CREATE INDEX idx_zfss_applications_status ON zfss_applications(status);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Benefit type schema
export const BenefitTypeSchema = z.object({
  code: z.string().min(1).max(50),
  namePl: z.string().min(1).max(200),
  nameEn: z.string().max(200).optional(),
  description: z.string().optional(),

  category: z.enum(['MONETARY', 'NON_MONETARY', 'INSURANCE', 'SOCIAL']),
  benefitType: z.enum(['RECURRING', 'ONE_TIME', 'CONDITIONAL']),

  isTaxable: z.boolean().default(true),
  taxCode: z.string().max(20).optional(),
  zusApplicable: z.boolean().default(true),
  zusType: z.enum(['FULL', 'PARTIAL', 'EXEMPT']).optional(),

  calculationMethod: z.enum(['FIXED', 'PERCENTAGE', 'FORMULA']),
  defaultAmount: z.number().positive().optional(),
  percentageBase: z.enum(['GROSS', 'NET', 'CUSTOM']).optional(),
  formula: z.string().optional(),

  minAmount: z.number().nonnegative().optional(),
  maxAmount: z.number().positive().optional(),
  annualLimit: z.number().positive().optional(),

  isZfss: z.boolean().default(false),
  zfssIncomeThresholds: z.array(z.object({
    maxIncome: z.number().positive(),
    percentage: z.number().min(0).max(100),
  })).optional(),
});

// Employee benefit assignment schema
export const EmployeeBenefitSchema = z.object({
  employeeId: z.string().uuid(),
  benefitTypeId: z.string().uuid(),

  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),

  amount: z.number().positive(),
  currency: z.string().length(3).default('PLN'),
  employeeContribution: z.number().nonnegative().default(0),

  percentage: z.number().min(0).max(100).optional(),

  notes: z.string().optional(),
});

// ZFŚS application schema
export const ZfssApplicationSchema = z.object({
  employeeId: z.string().uuid(),
  applicationType: z.enum(['HOLIDAY', 'LOAN', 'EVENT', 'CHILDCARE', 'EMERGENCY']),
  requestedAmount: z.number().positive(),
  declaredIncome: z.number().nonnegative(),
  notes: z.string().optional(),
});

// Benefit calculation result
export const BenefitCalculationSchema = z.object({
  benefitId: z.string().uuid(),
  benefitCode: z.string(),
  benefitName: z.string(),

  grossAmount: z.number(),
  employeeContribution: z.number(),
  netBenefit: z.number(),

  taxableAmount: z.number(),
  taxAmount: z.number(),

  zusBase: z.number(),
  zusEmployeeAmount: z.number(),
  zusEmployerAmount: z.number(),
});
```

### Service Implementation

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { db } from '@/db';
import { TRPCError } from '@trpc/server';

@Injectable()
export class BenefitsService {
  private readonly logger = new Logger(BenefitsService.name);

  /**
   * Get active benefits for employee in a period
   */
  async getEmployeeBenefits(
    employeeId: string,
    periodDate: Date
  ): Promise<EmployeeBenefit[]> {
    const benefits = await db.query.employeeBenefits.findMany({
      where: and(
        eq(employeeBenefits.employeeId, employeeId),
        eq(employeeBenefits.status, 'ACTIVE'),
        lte(employeeBenefits.effectiveFrom, periodDate),
        or(
          isNull(employeeBenefits.effectiveTo),
          gte(employeeBenefits.effectiveTo, periodDate)
        )
      ),
      with: {
        benefitType: true,
      },
    });

    return benefits;
  }

  /**
   * Calculate benefit amounts for payroll
   */
  async calculateBenefitsForPayroll(
    employeeId: string,
    period: { year: number; month: number },
    grossSalary: number
  ): Promise<BenefitCalculation[]> {
    const periodDate = new Date(period.year, period.month - 1, 1);
    const benefits = await this.getEmployeeBenefits(employeeId, periodDate);

    const calculations: BenefitCalculation[] = [];

    for (const benefit of benefits) {
      const calculation = await this.calculateSingleBenefit(
        benefit,
        grossSalary,
        period
      );
      calculations.push(calculation);
    }

    return calculations;
  }

  /**
   * Calculate single benefit with tax and ZUS
   */
  private async calculateSingleBenefit(
    benefit: EmployeeBenefit,
    grossSalary: number,
    period: { year: number; month: number }
  ): Promise<BenefitCalculation> {
    const type = benefit.benefitType;

    // Calculate gross amount
    let grossAmount = benefit.amount;

    if (type.calculationMethod === 'PERCENTAGE') {
      const base = type.percentageBase === 'GROSS' ? grossSalary : grossSalary;
      grossAmount = (base * (benefit.percentage || 0)) / 100;
    }

    // Apply limits
    if (type.maxAmount && grossAmount > type.maxAmount) {
      grossAmount = type.maxAmount;
    }

    // Calculate proration if partial month
    grossAmount = await this.prorateIfNeeded(benefit, grossAmount, period);

    // Employee contribution
    const employeeContribution = benefit.employeeContribution || 0;
    const netBenefit = grossAmount - employeeContribution;

    // Tax calculation
    let taxableAmount = 0;
    let taxAmount = 0;

    if (type.isTaxable) {
      taxableAmount = grossAmount;
      // Tax will be calculated in main payroll service
    }

    // ZUS calculation
    let zusBase = 0;
    let zusEmployeeAmount = 0;
    let zusEmployerAmount = 0;

    if (type.zusApplicable) {
      zusBase = grossAmount;

      if (type.zusType === 'FULL') {
        // Full ZUS contributions apply
        zusEmployeeAmount = zusBase * 0.1371; // 9.76% + 1.5% + 2.45%
        zusEmployerAmount = zusBase * 0.2038; // 9.76% + 6.5% + 1.67% + 2.45% + 0.1%
      } else if (type.zusType === 'PARTIAL') {
        // Only health insurance
        zusEmployeeAmount = zusBase * 0.09;
      }
    }

    return {
      benefitId: benefit.id,
      benefitCode: type.code,
      benefitName: type.namePl,
      grossAmount,
      employeeContribution,
      netBenefit,
      taxableAmount,
      taxAmount,
      zusBase,
      zusEmployeeAmount,
      zusEmployerAmount,
    };
  }

  /**
   * Prorate benefit for partial periods
   */
  private async prorateIfNeeded(
    benefit: EmployeeBenefit,
    amount: number,
    period: { year: number; month: number }
  ): Promise<number> {
    const monthStart = new Date(period.year, period.month - 1, 1);
    const monthEnd = new Date(period.year, period.month, 0);
    const daysInMonth = monthEnd.getDate();

    let effectiveDays = daysInMonth;

    // Check if benefit starts mid-month
    if (benefit.effectiveFrom > monthStart) {
      const startDay = new Date(benefit.effectiveFrom).getDate();
      effectiveDays = daysInMonth - startDay + 1;
    }

    // Check if benefit ends mid-month
    if (benefit.effectiveTo && benefit.effectiveTo < monthEnd) {
      const endDay = new Date(benefit.effectiveTo).getDate();
      effectiveDays = Math.min(effectiveDays, endDay);
    }

    if (effectiveDays < daysInMonth) {
      return Math.round((amount * effectiveDays / daysInMonth) * 100) / 100;
    }

    return amount;
  }

  /**
   * Process ZFŚS application
   */
  async processZfssApplication(
    applicationId: string,
    decision: 'APPROVED' | 'REJECTED',
    approvedAmount?: number,
    rejectionReason?: string,
    decidedBy: string
  ): Promise<ZfssApplication> {
    return await db.transaction(async (tx) => {
      const application = await tx.query.zfssApplications.findFirst({
        where: eq(zfssApplications.id, applicationId),
      });

      if (!application) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Application not found',
        });
      }

      if (application.status !== 'PENDING') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Application already processed',
        });
      }

      if (decision === 'APPROVED') {
        // Check fund balance
        const fund = await tx.query.zfssFund.findFirst({
          where: eq(zfssFund.id, application.fundId),
        });

        if (!fund || fund.currentBalance < (approvedAmount || 0)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Insufficient ZFŚS fund balance',
          });
        }

        // Update fund disbursements
        await tx
          .update(zfssFund)
          .set({
            disbursements: sql`disbursements + ${approvedAmount}`,
          })
          .where(eq(zfssFund.id, application.fundId));
      }

      // Update application
      const [updated] = await tx
        .update(zfssApplications)
        .set({
          status: decision,
          approvedAmount: decision === 'APPROVED' ? approvedAmount : null,
          rejectionReason: decision === 'REJECTED' ? rejectionReason : null,
          decisionDate: new Date(),
          decidedBy,
        })
        .where(eq(zfssApplications.id, applicationId))
        .returning();

      // Audit log
      await this.auditService.log({
        action: `ZFSS_APPLICATION_${decision}`,
        entityType: 'ZfssApplication',
        entityId: applicationId,
        userId: decidedBy,
        metadata: { approvedAmount, rejectionReason },
      });

      return updated;
    });
  }

  /**
   * Calculate ZFŚS tier based on income
   */
  calculateZfssTier(
    declaredIncome: number,
    thresholds: { maxIncome: number; percentage: number }[]
  ): { tier: number; percentage: number } {
    const sortedThresholds = [...thresholds].sort((a, b) => a.maxIncome - b.maxIncome);

    for (let i = 0; i < sortedThresholds.length; i++) {
      if (declaredIncome <= sortedThresholds[i].maxIncome) {
        return {
          tier: i + 1,
          percentage: sortedThresholds[i].percentage,
        };
      }
    }

    // Above all thresholds - lowest percentage
    return {
      tier: sortedThresholds.length + 1,
      percentage: sortedThresholds[sortedThresholds.length - 1]?.percentage * 0.5 || 0,
    };
  }
}
```

### tRPC Router

```typescript
import { router, hrManagerProcedure, employeeProcedure } from '@/trpc';
import { z } from 'zod';

export const benefitsRouter = router({
  // Benefit type management
  createBenefitType: hrManagerProcedure
    .input(BenefitTypeSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.benefitsService.createBenefitType(ctx.tenantId, input, ctx.userId);
    }),

  listBenefitTypes: hrManagerProcedure
    .input(z.object({
      category: z.enum(['MONETARY', 'NON_MONETARY', 'INSURANCE', 'SOCIAL']).optional(),
      isActive: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.benefitsService.listBenefitTypes(ctx.tenantId, input);
    }),

  // Employee benefit assignment
  assignBenefit: hrManagerProcedure
    .input(EmployeeBenefitSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.benefitsService.assignBenefit(ctx.tenantId, input, ctx.userId);
    }),

  getEmployeeBenefits: hrManagerProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      includeHistory: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.benefitsService.getEmployeeBenefits(
        input.employeeId,
        new Date(),
        input.includeHistory
      );
    }),

  suspendBenefit: hrManagerProcedure
    .input(z.object({
      benefitId: z.string().uuid(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.benefitsService.suspendBenefit(input.benefitId, input.reason, ctx.userId);
    }),

  // ZFŚS management
  submitZfssApplication: employeeProcedure
    .input(ZfssApplicationSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.benefitsService.submitZfssApplication(ctx.tenantId, input, ctx.userId);
    }),

  processZfssApplication: hrManagerProcedure
    .input(z.object({
      applicationId: z.string().uuid(),
      decision: z.enum(['APPROVED', 'REJECTED']),
      approvedAmount: z.number().positive().optional(),
      rejectionReason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.benefitsService.processZfssApplication(
        input.applicationId,
        input.decision,
        input.approvedAmount,
        input.rejectionReason,
        ctx.userId
      );
    }),

  getZfssFundStatus: hrManagerProcedure
    .input(z.object({ year: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.benefitsService.getZfssFundStatus(ctx.tenantId, input.year);
    }),

  // Reports
  getBenefitsSummary: hrManagerProcedure
    .input(z.object({
      period: z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      }),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.benefitsService.getBenefitsSummary(ctx.tenantId, input.period);
    }),
});
```

## Test Specifications

### Unit Tests

```typescript
describe('BenefitsService', () => {
  describe('calculateSingleBenefit', () => {
    it('should calculate fixed amount benefit correctly', async () => {
      const benefit = {
        id: 'benefit-1',
        amount: 450,
        benefitType: {
          code: 'MEAL',
          namePl: 'Dodatek żywieniowy',
          calculationMethod: 'FIXED',
          isTaxable: false,
          zusApplicable: false,
        },
      };

      const result = await service.calculateSingleBenefit(benefit, 10000, { year: 2024, month: 1 });

      expect(result.grossAmount).toBe(450);
      expect(result.taxableAmount).toBe(0);
      expect(result.zusBase).toBe(0);
    });

    it('should calculate percentage-based benefit', async () => {
      const benefit = {
        id: 'benefit-2',
        percentage: 10,
        benefitType: {
          code: 'BONUS',
          calculationMethod: 'PERCENTAGE',
          percentageBase: 'GROSS',
          isTaxable: true,
          zusApplicable: true,
          zusType: 'FULL',
        },
      };

      const result = await service.calculateSingleBenefit(benefit, 10000, { year: 2024, month: 1 });

      expect(result.grossAmount).toBe(1000);
      expect(result.taxableAmount).toBe(1000);
      expect(result.zusEmployeeAmount).toBeCloseTo(137.1, 1);
    });

    it('should prorate benefit for partial month', async () => {
      const benefit = {
        id: 'benefit-3',
        amount: 300,
        effectiveFrom: new Date('2024-01-15'),
        benefitType: {
          calculationMethod: 'FIXED',
        },
      };

      const result = await service.calculateSingleBenefit(benefit, 10000, { year: 2024, month: 1 });

      // 17 days out of 31 = ~164.52 PLN
      expect(result.grossAmount).toBeCloseTo(164.52, 0);
    });
  });

  describe('calculateZfssTier', () => {
    const thresholds = [
      { maxIncome: 3000, percentage: 100 },
      { maxIncome: 5000, percentage: 80 },
      { maxIncome: 8000, percentage: 60 },
    ];

    it('should return tier 1 for lowest income', () => {
      const result = service.calculateZfssTier(2500, thresholds);
      expect(result.tier).toBe(1);
      expect(result.percentage).toBe(100);
    });

    it('should return correct tier for middle income', () => {
      const result = service.calculateZfssTier(4500, thresholds);
      expect(result.tier).toBe(2);
      expect(result.percentage).toBe(80);
    });

    it('should return lowest percentage for high income', () => {
      const result = service.calculateZfssTier(10000, thresholds);
      expect(result.tier).toBe(4);
      expect(result.percentage).toBe(30); // 60% * 0.5
    });
  });
});
```

### Integration Tests

```typescript
describe('Benefits Integration', () => {
  it('should include benefits in payroll calculation', async () => {
    // Create employee with benefits
    const employee = await createTestEmployee();

    await benefitsService.assignBenefit(tenantId, {
      employeeId: employee.id,
      benefitTypeId: mealAllowanceType.id,
      effectiveFrom: '2024-01-01',
      amount: 450,
    });

    // Run payroll
    const payroll = await payrollService.calculateSalary(employee, { year: 2024, month: 1 });

    expect(payroll.additions).toContainEqual(
      expect.objectContaining({
        code: 'MEAL',
        amount: 450,
      })
    );
  });
});
```

## Security Checklist

- [x] RLS policies for tenant isolation
- [x] HR Manager role required for benefit configuration
- [x] Employee can only view own benefits
- [x] Benefit amounts encrypted at rest
- [x] Audit trail for all changes
- [x] ZFŚS income data access restricted
- [x] Approval workflow for ZFŚS disbursements

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `BENEFIT_TYPE_CREATED` | New benefit type configured | Type details, created by |
| `BENEFIT_ASSIGNED` | Benefit assigned to employee | Employee, benefit, amount |
| `BENEFIT_MODIFIED` | Benefit amount/dates changed | Previous/new values |
| `BENEFIT_SUSPENDED` | Benefit suspended | Reason, suspended by |
| `ZFSS_APPLICATION_SUBMITTED` | Employee submits ZFŚS request | Application details |
| `ZFSS_APPLICATION_APPROVED` | ZFŚS request approved | Approved amount |
| `ZFSS_APPLICATION_REJECTED` | ZFŚS request rejected | Rejection reason |

## Definition of Done

- [ ] Benefit type CRUD operations implemented
- [ ] Employee benefit assignment working
- [ ] Payroll integration tested
- [ ] ZFŚS fund management functional
- [ ] Polish-specific benefits configured
- [ ] Proration logic implemented
- [ ] Audit trail complete
- [ ] Unit tests passing (≥80% coverage)
- [ ] Integration tests passing
- [ ] Security review completed
- [ ] Documentation updated
