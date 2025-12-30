# HRP-007: Leave Management System

## Story Information
- **Story ID**: HRP-007
- **Epic**: HR & Payroll Module (HRP)
- **Title**: Leave Management System
- **Priority**: High
- **Status**: Draft
- **Estimated Points**: 13
- **Sprint**: TBD

## User Story
**As a** HR Manager and Employee
**I want to** manage leave requests and track leave balances
**So that** employee absences are properly recorded and accounted for in payroll

## Acceptance Criteria

### AC1: Polish Leave Types
```gherkin
Given the system operates under Polish labor law
When configuring leave types
Then the following types must be supported per Kodeks Pracy:
  | Type                    | Polish Name                    | Entitlement            |
  | Annual leave            | Urlop wypoczynkowy             | 20/26 days per year    |
  | On-demand leave         | Urlop na żądanie               | 4 days (from annual)   |
  | Sick leave              | Zwolnienie lekarskie (L4)      | 182 days (paid)        |
  | Maternity leave         | Urlop macierzyński             | 20 weeks               |
  | Paternity leave         | Urlop ojcowski                 | 2 weeks                |
  | Parental leave          | Urlop rodzicielski             | 32/34 weeks            |
  | Childcare leave         | Urlop wychowawczy              | 36 months              |
  | Unpaid leave            | Urlop bezpłatny                | Unlimited              |
  | Occasional leave        | Urlop okolicznościowy          | 1-2 days               |
  | Training leave          | Urlop szkoleniowy              | Per agreement          |
  | Blood donation leave    | Urlop dla krwiodawców          | 1 day per donation     |
```

### AC2: Annual Leave Entitlement Calculation
```gherkin
Given an employee's work history
When calculating annual leave entitlement
Then the system should:
  - Award 20 days if total experience < 10 years
  - Award 26 days if total experience >= 10 years
  - Count education towards experience:
    | Education Level              | Years Credited |
    | Podstawowe (primary)         | 0              |
    | Zasadnicze zawodowe          | 3              |
    | Średnie (secondary)          | 4              |
    | Policealne                   | 6              |
    | Wyższe (university)          | 8              |
  - Prorate for partial year (first year/termination)
  - Handle carry-over (max to Sept 30 next year)
```

### AC3: Leave Request Workflow
```gherkin
Given an employee wants to request leave
When they submit a leave request
Then the workflow should:
  - Validate against available balance
  - Check for conflicts with other requests
  - Route to appropriate approver (manager)
  - Support multi-level approval if configured
  - Send notifications at each step
  - Allow cancellation before start date
```

### AC4: Sick Leave (L4) Processing
```gherkin
Given an employee submits sick leave (zwolnienie lekarskie)
When processing the L4
Then the system should:
  - Accept ZUS e-ZLA electronic sick note
  - Calculate sick pay:
    | Days       | Payer        | Rate   |
    | 1-33       | Employer     | 80%    |
    | 1-14 (50+) | Employer     | 80%    |
    | 34+        | ZUS (zasiłek)| 80%    |
    | 15+ (50+)  | ZUS          | 80%    |
  - Track 182-day limit per illness
  - Handle rehabilitation benefit (świadczenie rehabilitacyjne)
  - Flag for ZUS reporting
```

### AC5: Leave Balance Tracking
```gherkin
Given leave is used or accrued
When viewing leave balances
Then the system should show:
  - Annual leave: entitled, used, remaining, carry-over
  - Sick leave: days used this year, total this period
  - On-demand leave: remaining (from annual allocation)
  - Other leave types: balances where applicable
  - Historical balances by year
```

### AC6: Calendar Integration
```gherkin
Given approved leave exists
When viewing team calendars
Then the system should:
  - Display all approved absences
  - Show pending requests with different styling
  - Calculate team coverage percentage
  - Warn about understaffing
  - Export to iCal format
```

### AC7: Payroll Integration
```gherkin
Given leave affects compensation
When running payroll
Then the system should:
  - Deduct unpaid leave days
  - Apply sick leave pay rules
  - Include leave accruals in calculations
  - Generate leave-related payroll components
```

## Technical Specification

### Database Schema

```sql
-- Leave types configuration
CREATE TABLE leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  code VARCHAR(50) NOT NULL,
  name_pl VARCHAR(200) NOT NULL,
  name_en VARCHAR(200),
  description TEXT,

  category VARCHAR(50) NOT NULL,              -- ANNUAL, SICK, PARENTAL, UNPAID, OTHER

  -- Entitlement rules
  has_balance BOOLEAN DEFAULT true,
  default_days_per_year DECIMAL(5, 2),
  max_carry_over_days DECIMAL(5, 2),
  carry_over_expiry_months INTEGER,           -- Months into next year (9 = Sept 30)

  -- Pay rules
  is_paid BOOLEAN DEFAULT true,
  pay_percentage DECIMAL(5, 2) DEFAULT 100,

  -- Request rules
  requires_approval BOOLEAN DEFAULT true,
  requires_document BOOLEAN DEFAULT false,
  min_notice_days INTEGER DEFAULT 0,
  max_consecutive_days INTEGER,

  -- Restrictions
  allowed_contract_types VARCHAR(50)[],       -- NULL = all
  min_employment_months INTEGER DEFAULT 0,

  is_system BOOLEAN DEFAULT false,            -- Built-in types
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, code)
);

-- Employee leave entitlements (per year)
CREATE TABLE leave_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  leave_type_id UUID NOT NULL REFERENCES leave_types(id),
  year INTEGER NOT NULL,

  -- Entitlement
  base_entitlement DECIMAL(5, 2) NOT NULL,    -- Standard entitlement
  additional_days DECIMAL(5, 2) DEFAULT 0,    -- Bonus/adjustments
  carry_over_days DECIMAL(5, 2) DEFAULT 0,    -- From previous year
  total_entitlement DECIMAL(5, 2) GENERATED ALWAYS AS (
    base_entitlement + additional_days + carry_over_days
  ) STORED,

  -- Usage
  used_days DECIMAL(5, 2) DEFAULT 0,
  pending_days DECIMAL(5, 2) DEFAULT 0,       -- In pending requests
  remaining_days DECIMAL(5, 2) GENERATED ALWAYS AS (
    base_entitlement + additional_days + carry_over_days - used_days
  ) STORED,

  -- For annual leave
  on_demand_used DECIMAL(5, 2) DEFAULT 0,     -- Urlop na żądanie (max 4)

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(employee_id, leave_type_id, year),
  CONSTRAINT valid_usage CHECK (used_days >= 0 AND used_days <= total_entitlement)
);

-- Leave requests
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  leave_type_id UUID NOT NULL REFERENCES leave_types(id),

  -- Request details
  request_number VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Duration
  total_days DECIMAL(5, 2) NOT NULL,
  working_days DECIMAL(5, 2) NOT NULL,        -- Excluding weekends/holidays

  -- Half-day support
  start_half_day BOOLEAN DEFAULT false,       -- Morning only on start
  end_half_day BOOLEAN DEFAULT false,         -- Afternoon only on end

  -- On-demand flag
  is_on_demand BOOLEAN DEFAULT false,         -- Urlop na żądanie

  -- Status
  status VARCHAR(50) DEFAULT 'PENDING',       -- PENDING, APPROVED, REJECTED, CANCELLED

  -- Request info
  reason TEXT,
  notes TEXT,

  -- For sick leave
  sick_note_number VARCHAR(100),              -- e-ZLA number
  sick_note_document_id UUID,
  illness_code VARCHAR(20),
  is_work_related BOOLEAN DEFAULT false,

  -- Workflow
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_by UUID NOT NULL,

  approved_at TIMESTAMPTZ,
  approved_by UUID,
  approval_notes TEXT,

  rejected_at TIMESTAMPTZ,
  rejected_by UUID,
  rejection_reason TEXT,

  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID,
  cancellation_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_dates CHECK (end_date >= start_date),
  CONSTRAINT valid_days CHECK (working_days > 0 AND working_days <= total_days)
);

-- Leave request approvals (for multi-level)
CREATE TABLE leave_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id UUID NOT NULL REFERENCES leave_requests(id),

  approval_level INTEGER NOT NULL,            -- 1, 2, 3...
  approver_id UUID NOT NULL REFERENCES employees(id),

  status VARCHAR(50) DEFAULT 'PENDING',       -- PENDING, APPROVED, REJECTED
  decision_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(leave_request_id, approval_level)
);

-- Sick leave periods (for 182-day tracking)
CREATE TABLE sick_leave_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),

  illness_group VARCHAR(100),                 -- For grouping related illness
  period_start DATE NOT NULL,
  period_end DATE,                            -- NULL if ongoing

  total_days_used INTEGER DEFAULT 0,
  max_days INTEGER DEFAULT 182,

  -- Status
  is_active BOOLEAN DEFAULT true,
  exceeded_limit BOOLEAN DEFAULT false,

  -- ZUS transition
  zus_benefit_start_date DATE,                -- When ZUS takes over
  rehabilitation_start_date DATE,             -- świadczenie rehabilitacyjne

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leave calendar events (for display)
CREATE TABLE leave_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  leave_request_id UUID REFERENCES leave_requests(id),

  event_date DATE NOT NULL,
  leave_type_code VARCHAR(50) NOT NULL,

  is_half_day BOOLEAN DEFAULT false,
  half_day_part VARCHAR(20),                  -- MORNING, AFTERNOON

  status VARCHAR(50) NOT NULL,                -- PENDING, APPROVED, CANCELLED

  UNIQUE(employee_id, event_date, leave_type_code)
);

-- Indexes
CREATE INDEX idx_leave_entitlements_employee ON leave_entitlements(employee_id);
CREATE INDEX idx_leave_entitlements_year ON leave_entitlements(year);
CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_calendar_date ON leave_calendar_events(event_date);
CREATE INDEX idx_leave_calendar_employee ON leave_calendar_events(employee_id);
CREATE INDEX idx_sick_periods_employee ON sick_leave_periods(employee_id);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Leave request schema
export const LeaveRequestSchema = z.object({
  leaveTypeId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  startHalfDay: z.boolean().default(false),
  endHalfDay: z.boolean().default(false),
  isOnDemand: z.boolean().default(false),
  reason: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
}).refine(
  data => new Date(data.endDate) >= new Date(data.startDate),
  'End date must be after start date'
);

// Sick leave request (with e-ZLA)
export const SickLeaveRequestSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  sickNoteNumber: z.string().min(1).max(100),
  illnessCode: z.string().max(20).optional(),
  isWorkRelated: z.boolean().default(false),
  documentId: z.string().uuid().optional(),
});

// Leave approval schema
export const LeaveApprovalSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().max(1000).optional(),
});

// Entitlement adjustment
export const EntitlementAdjustmentSchema = z.object({
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  year: z.number().min(2020).max(2100),
  adjustmentDays: z.number(),
  reason: z.string().min(1).max(500),
});

// Leave balance response
export const LeaveBalanceSchema = z.object({
  leaveTypeCode: z.string(),
  leaveTypeName: z.string(),
  year: z.number(),

  baseEntitlement: z.number(),
  carryOver: z.number(),
  additional: z.number(),
  totalEntitlement: z.number(),

  used: z.number(),
  pending: z.number(),
  remaining: z.number(),

  onDemandUsed: z.number().optional(),
  onDemandRemaining: z.number().optional(),
});
```

### Service Implementation

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { db } from '@/db';
import { TRPCError } from '@trpc/server';

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  /**
   * Calculate annual leave entitlement based on Polish law
   */
  async calculateAnnualEntitlement(
    employeeId: string,
    year: number
  ): Promise<{ days: number; calculation: EntitlementCalculation }> {
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, employeeId),
    });

    if (!employee) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Employee not found' });
    }

    // Get work history and education
    const workHistory = await this.getWorkHistory(employeeId);
    const education = employee.educationLevel;

    // Calculate years of experience
    const educationYears = this.getEducationYears(education);
    const workYears = this.calculateWorkYears(workHistory, year);
    const totalYears = educationYears + workYears;

    // Determine base entitlement
    const baseEntitlement = totalYears >= 10 ? 26 : 20;

    // Prorate for first year
    let finalEntitlement = baseEntitlement;
    const startDate = new Date(employee.startDate);
    const yearStart = new Date(year, 0, 1);

    if (startDate.getFullYear() === year && startDate > yearStart) {
      // First year - prorate
      const monthsWorked = 12 - startDate.getMonth();
      finalEntitlement = Math.round((baseEntitlement * monthsWorked) / 12 * 100) / 100;
    }

    return {
      days: finalEntitlement,
      calculation: {
        educationLevel: education,
        educationYears,
        workYears,
        totalYears,
        baseEntitlement,
        prorated: finalEntitlement !== baseEntitlement,
        finalEntitlement,
      },
    };
  }

  /**
   * Get education years credited per Polish law
   */
  private getEducationYears(level: string): number {
    const educationCredits: Record<string, number> = {
      'PODSTAWOWE': 0,
      'ZASADNICZE_ZAWODOWE': 3,
      'SREDNIE': 4,
      'SREDNIE_ZAWODOWE': 5,
      'POLICEALNE': 6,
      'WYZSZE': 8,
    };
    return educationCredits[level] || 0;
  }

  /**
   * Submit leave request
   */
  async submitLeaveRequest(
    tenantId: string,
    employeeId: string,
    request: LeaveRequestInput
  ): Promise<LeaveRequest> {
    return await db.transaction(async (tx) => {
      // Get leave type
      const leaveType = await tx.query.leaveTypes.findFirst({
        where: eq(leaveTypes.id, request.leaveTypeId),
      });

      if (!leaveType) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave type not found' });
      }

      // Calculate working days
      const workingDays = await this.calculateWorkingDays(
        new Date(request.startDate),
        new Date(request.endDate),
        request.startHalfDay,
        request.endHalfDay,
        tenantId
      );

      // Validate balance if required
      if (leaveType.hasBalance) {
        const year = new Date(request.startDate).getFullYear();
        const balance = await this.getLeaveBalance(employeeId, leaveType.id, year, tx);

        if (balance.remaining < workingDays) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Insufficient leave balance. Available: ${balance.remaining}, Requested: ${workingDays}`,
          });
        }

        // Check on-demand limit
        if (request.isOnDemand) {
          const onDemandRemaining = 4 - (balance.onDemandUsed || 0);
          if (workingDays > onDemandRemaining) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Only ${onDemandRemaining} on-demand days remaining`,
            });
          }
        }
      }

      // Check for conflicts
      await this.checkForConflicts(employeeId, request.startDate, request.endDate, tx);

      // Generate request number
      const requestNumber = await this.generateRequestNumber(tenantId, tx);

      // Create request
      const [leaveRequest] = await tx.insert(leaveRequests).values({
        tenantId,
        employeeId,
        leaveTypeId: request.leaveTypeId,
        requestNumber,
        startDate: request.startDate,
        endDate: request.endDate,
        totalDays: this.calculateTotalDays(request.startDate, request.endDate),
        workingDays,
        startHalfDay: request.startHalfDay,
        endHalfDay: request.endHalfDay,
        isOnDemand: request.isOnDemand,
        reason: request.reason,
        notes: request.notes,
        submittedBy: employeeId,
      }).returning();

      // Update pending days in entitlement
      if (leaveType.hasBalance) {
        const year = new Date(request.startDate).getFullYear();
        await tx
          .update(leaveEntitlements)
          .set({
            pendingDays: sql`pending_days + ${workingDays}`,
          })
          .where(and(
            eq(leaveEntitlements.employeeId, employeeId),
            eq(leaveEntitlements.leaveTypeId, request.leaveTypeId),
            eq(leaveEntitlements.year, year)
          ));
      }

      // Create calendar events
      await this.createCalendarEvents(leaveRequest, leaveType.code, tx);

      // Find approver and create approval workflow
      if (leaveType.requiresApproval) {
        const approver = await this.findApprover(employeeId, tx);
        await tx.insert(leaveApprovals).values({
          leaveRequestId: leaveRequest.id,
          approvalLevel: 1,
          approverId: approver.id,
        });

        // Send notification to approver
        await this.notificationService.send({
          userId: approver.id,
          type: 'LEAVE_REQUEST_PENDING',
          data: {
            requestId: leaveRequest.id,
            employeeName: await this.getEmployeeName(employeeId),
            leaveType: leaveType.namePl,
            dates: `${request.startDate} - ${request.endDate}`,
            days: workingDays,
          },
        });
      } else {
        // Auto-approve
        await this.approveLeaveRequest(leaveRequest.id, 'SYSTEM', undefined, tx);
      }

      // Audit log
      await this.auditService.log({
        action: 'LEAVE_REQUEST_SUBMITTED',
        entityType: 'LeaveRequest',
        entityId: leaveRequest.id,
        userId: employeeId,
      });

      return leaveRequest;
    });
  }

  /**
   * Approve leave request
   */
  async approveLeaveRequest(
    requestId: string,
    approverId: string,
    notes?: string,
    tx?: Transaction
  ): Promise<LeaveRequest> {
    const executor = tx || db;

    const request = await executor.query.leaveRequests.findFirst({
      where: eq(leaveRequests.id, requestId),
      with: {
        leaveType: true,
      },
    });

    if (!request) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Leave request not found' });
    }

    if (request.status !== 'PENDING') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot approve request with status: ${request.status}`,
      });
    }

    // Update request status
    const [updated] = await executor
      .update(leaveRequests)
      .set({
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: approverId,
        approvalNotes: notes,
      })
      .where(eq(leaveRequests.id, requestId))
      .returning();

    // Update entitlement
    if (request.leaveType.hasBalance) {
      const year = new Date(request.startDate).getFullYear();
      await executor
        .update(leaveEntitlements)
        .set({
          usedDays: sql`used_days + ${request.workingDays}`,
          pendingDays: sql`pending_days - ${request.workingDays}`,
          onDemandUsed: request.isOnDemand
            ? sql`on_demand_used + ${request.workingDays}`
            : sql`on_demand_used`,
        })
        .where(and(
          eq(leaveEntitlements.employeeId, request.employeeId),
          eq(leaveEntitlements.leaveTypeId, request.leaveTypeId),
          eq(leaveEntitlements.year, year)
        ));
    }

    // Update calendar events
    await executor
      .update(leaveCalendarEvents)
      .set({ status: 'APPROVED' })
      .where(eq(leaveCalendarEvents.leaveRequestId, requestId));

    // Send notification to employee
    await this.notificationService.send({
      userId: request.employeeId,
      type: 'LEAVE_REQUEST_APPROVED',
      data: {
        requestId,
        leaveType: request.leaveType.namePl,
        dates: `${request.startDate} - ${request.endDate}`,
      },
    });

    return updated;
  }

  /**
   * Process sick leave (L4)
   */
  async processSickLeave(
    tenantId: string,
    employeeId: string,
    sickLeave: SickLeaveInput
  ): Promise<LeaveRequest> {
    return await db.transaction(async (tx) => {
      // Get or create sick leave period
      let sickPeriod = await tx.query.sickLeavePeriods.findFirst({
        where: and(
          eq(sickLeavePeriods.employeeId, employeeId),
          eq(sickLeavePeriods.isActive, true)
        ),
      });

      const daysRequested = this.calculateTotalDays(sickLeave.startDate, sickLeave.endDate);

      if (!sickPeriod) {
        // Start new 182-day period
        [sickPeriod] = await tx.insert(sickLeavePeriods).values({
          tenantId,
          employeeId,
          periodStart: sickLeave.startDate,
          totalDaysUsed: daysRequested,
        }).returning();
      } else {
        // Check 182-day limit
        const newTotal = sickPeriod.totalDaysUsed + daysRequested;
        if (newTotal > 182) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Sick leave would exceed 182-day limit. Days remaining: ${182 - sickPeriod.totalDaysUsed}`,
          });
        }

        await tx
          .update(sickLeavePeriods)
          .set({
            totalDaysUsed: newTotal,
            exceededLimit: newTotal >= 182,
          })
          .where(eq(sickLeavePeriods.id, sickPeriod.id));
      }

      // Get sick leave type
      const sickLeaveType = await tx.query.leaveTypes.findFirst({
        where: and(
          eq(leaveTypes.tenantId, tenantId),
          eq(leaveTypes.code, 'SICK_LEAVE')
        ),
      });

      // Calculate payer (employer vs ZUS)
      const employee = await tx.query.employees.findFirst({
        where: eq(employees.id, employeeId),
      });
      const isOver50 = this.isEmployeeOver50(employee!.dateOfBirth);
      const employerDays = isOver50 ? 14 : 33;

      // Create leave request
      const [request] = await tx.insert(leaveRequests).values({
        tenantId,
        employeeId,
        leaveTypeId: sickLeaveType!.id,
        requestNumber: await this.generateRequestNumber(tenantId, tx),
        startDate: sickLeave.startDate,
        endDate: sickLeave.endDate,
        totalDays: daysRequested,
        workingDays: daysRequested,
        sickNoteNumber: sickLeave.sickNoteNumber,
        sickNoteDocumentId: sickLeave.documentId,
        illnessCode: sickLeave.illnessCode,
        isWorkRelated: sickLeave.isWorkRelated,
        status: 'APPROVED', // Sick leave auto-approved
        approvedAt: new Date(),
        approvedBy: 'SYSTEM',
        submittedBy: employeeId,
      }).returning();

      // Flag for ZUS if over employer limit
      if (sickPeriod.totalDaysUsed > employerDays && !sickPeriod.zusBenefitStartDate) {
        await tx
          .update(sickLeavePeriods)
          .set({
            zusBenefitStartDate: this.calculateZusBenefitStartDate(
              sickPeriod.periodStart,
              employerDays
            ),
          })
          .where(eq(sickLeavePeriods.id, sickPeriod.id));
      }

      // Create calendar events
      await this.createCalendarEvents(request, 'SICK_LEAVE', tx);

      return request;
    });
  }

  /**
   * Calculate working days excluding weekends and holidays
   */
  async calculateWorkingDays(
    startDate: Date,
    endDate: Date,
    startHalfDay: boolean,
    endHalfDay: boolean,
    tenantId: string
  ): Promise<number> {
    // Get Polish holidays for the period
    const holidays = await this.getPolishHolidays(
      startDate.getFullYear(),
      endDate.getFullYear()
    );
    const holidaySet = new Set(holidays.map(h => h.toISOString().split('T')[0]));

    let workingDays = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().split('T')[0];

      // Skip weekends and holidays
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
        workingDays += 1;
      }

      current.setDate(current.getDate() + 1);
    }

    // Adjust for half days
    if (startHalfDay && workingDays > 0) {
      workingDays -= 0.5;
    }
    if (endHalfDay && workingDays > 0) {
      workingDays -= 0.5;
    }

    return workingDays;
  }

  /**
   * Get Polish holidays (fixed + movable)
   */
  private async getPolishHolidays(startYear: number, endYear: number): Promise<Date[]> {
    const holidays: Date[] = [];

    for (let year = startYear; year <= endYear; year++) {
      // Fixed holidays
      holidays.push(
        new Date(year, 0, 1),   // Nowy Rok
        new Date(year, 0, 6),   // Trzech Króli
        new Date(year, 4, 1),   // Święto Pracy
        new Date(year, 4, 3),   // Święto Konstytucji
        new Date(year, 7, 15),  // Wniebowzięcie NMP
        new Date(year, 10, 1),  // Wszystkich Świętych
        new Date(year, 10, 11), // Święto Niepodległości
        new Date(year, 11, 25), // Boże Narodzenie
        new Date(year, 11, 26), // Drugi dzień BN
      );

      // Movable holidays (Easter-based)
      const easter = this.calculateEaster(year);
      holidays.push(
        easter,                                         // Wielkanoc
        new Date(easter.getTime() + 24 * 60 * 60 * 1000), // Poniedziałek Wielkanocny
        new Date(easter.getTime() + 49 * 24 * 60 * 60 * 1000), // Zesłanie Ducha Św.
        new Date(easter.getTime() + 60 * 24 * 60 * 60 * 1000), // Boże Ciało
      );
    }

    return holidays;
  }

  /**
   * Calculate Easter date (Anonymous Gregorian algorithm)
   */
  private calculateEaster(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(year, month, day);
  }

  /**
   * Process carry-over at year end
   */
  async processYearEndCarryOver(tenantId: string, year: number): Promise<void> {
    this.logger.log(`Processing leave carry-over for year ${year}`);

    const entitlements = await db.query.leaveEntitlements.findMany({
      where: and(
        eq(leaveEntitlements.tenantId, tenantId),
        eq(leaveEntitlements.year, year)
      ),
      with: {
        leaveType: true,
      },
    });

    for (const entitlement of entitlements) {
      if (!entitlement.leaveType.maxCarryOverDays) continue;

      const remaining = entitlement.totalEntitlement - entitlement.usedDays;
      const carryOver = Math.min(
        remaining,
        entitlement.leaveType.maxCarryOverDays
      );

      if (carryOver > 0) {
        // Create next year entitlement with carry-over
        await db.insert(leaveEntitlements).values({
          tenantId,
          employeeId: entitlement.employeeId,
          leaveTypeId: entitlement.leaveTypeId,
          year: year + 1,
          baseEntitlement: entitlement.baseEntitlement,
          carryOverDays: carryOver,
        }).onConflictDoUpdate({
          target: [
            leaveEntitlements.employeeId,
            leaveEntitlements.leaveTypeId,
            leaveEntitlements.year,
          ],
          set: {
            carryOverDays: carryOver,
          },
        });
      }
    }
  }
}
```

### tRPC Router

```typescript
import { router, employeeProcedure, hrManagerProcedure } from '@/trpc';
import { z } from 'zod';

export const leaveRouter = router({
  // Submit leave request
  submitRequest: employeeProcedure
    .input(LeaveRequestSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.leaveService.submitLeaveRequest(ctx.tenantId, ctx.employeeId, input);
    }),

  // Submit sick leave (L4)
  submitSickLeave: employeeProcedure
    .input(SickLeaveRequestSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.leaveService.processSickLeave(ctx.tenantId, ctx.employeeId, input);
    }),

  // Get my leave balance
  getMyBalance: employeeProcedure
    .input(z.object({ year: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const year = input.year || new Date().getFullYear();
      return ctx.leaveService.getAllLeaveBalances(ctx.employeeId, year);
    }),

  // Get my requests
  getMyRequests: employeeProcedure
    .input(z.object({
      status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'ALL']).optional(),
      year: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.leaveService.getEmployeeRequests(ctx.employeeId, input);
    }),

  // Cancel my request
  cancelRequest: employeeProcedure
    .input(z.object({
      requestId: z.string().uuid(),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.leaveService.cancelRequest(input.requestId, ctx.employeeId, input.reason);
    }),

  // HR: Approve/reject request
  processApproval: hrManagerProcedure
    .input(LeaveApprovalSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.decision === 'APPROVED') {
        return ctx.leaveService.approveLeaveRequest(input.requestId, ctx.userId, input.notes);
      } else {
        return ctx.leaveService.rejectLeaveRequest(input.requestId, ctx.userId, input.notes);
      }
    }),

  // HR: Get pending approvals
  getPendingApprovals: hrManagerProcedure
    .query(async ({ ctx }) => {
      return ctx.leaveService.getPendingApprovals(ctx.tenantId, ctx.userId);
    }),

  // HR: Adjust entitlement
  adjustEntitlement: hrManagerProcedure
    .input(EntitlementAdjustmentSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.leaveService.adjustEntitlement(ctx.tenantId, input, ctx.userId);
    }),

  // Get team calendar
  getTeamCalendar: employeeProcedure
    .input(z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      departmentId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.leaveService.getTeamCalendar(ctx.tenantId, input);
    }),

  // Export calendar to iCal
  exportCalendar: employeeProcedure
    .input(z.object({ year: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.leaveService.exportToICal(ctx.employeeId, input.year);
    }),

  // Get leave types
  getLeaveTypes: employeeProcedure
    .query(async ({ ctx }) => {
      return ctx.leaveService.getLeaveTypes(ctx.tenantId);
    }),

  // HR: Process year-end carry-over
  processCarryOver: hrManagerProcedure
    .input(z.object({ year: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.leaveService.processYearEndCarryOver(ctx.tenantId, input.year);
    }),
});
```

## Test Specifications

### Unit Tests

```typescript
describe('LeaveService', () => {
  describe('calculateAnnualEntitlement', () => {
    it('should return 20 days for < 10 years experience', async () => {
      const result = await service.calculateAnnualEntitlement(employeeWith5Years, 2024);
      expect(result.days).toBe(20);
    });

    it('should return 26 days for >= 10 years experience', async () => {
      const result = await service.calculateAnnualEntitlement(employeeWith12Years, 2024);
      expect(result.days).toBe(26);
    });

    it('should credit 8 years for university education', async () => {
      const result = await service.calculateAnnualEntitlement(graduateWith3YearsWork, 2024);
      expect(result.calculation.totalYears).toBe(11); // 8 + 3
      expect(result.days).toBe(26);
    });

    it('should prorate for first year employees', async () => {
      // Employee started July 1
      const result = await service.calculateAnnualEntitlement(newEmployeeJuly, 2024);
      expect(result.days).toBe(10); // 6 months of 20 days
    });
  });

  describe('calculateWorkingDays', () => {
    it('should exclude weekends', async () => {
      // Mon-Fri = 5 working days
      const days = await service.calculateWorkingDays(
        new Date('2024-01-08'), // Monday
        new Date('2024-01-12'), // Friday
        false, false, tenantId
      );
      expect(days).toBe(5);
    });

    it('should exclude Polish holidays', async () => {
      // May 1-3 includes two holidays
      const days = await service.calculateWorkingDays(
        new Date('2024-05-01'), // Wed - Święto Pracy
        new Date('2024-05-03'), // Fri - Konstytucja
        false, false, tenantId
      );
      expect(days).toBe(1); // Only May 2 is working day
    });

    it('should handle half days', async () => {
      const days = await service.calculateWorkingDays(
        new Date('2024-01-08'),
        new Date('2024-01-10'),
        true, true, tenantId
      );
      expect(days).toBe(2); // 3 days - 0.5 - 0.5 = 2
    });
  });

  describe('calculateEaster', () => {
    it('should calculate Easter 2024 correctly', () => {
      const easter = service.calculateEaster(2024);
      expect(easter.getMonth()).toBe(2); // March (0-indexed)
      expect(easter.getDate()).toBe(31);
    });

    it('should calculate Easter 2025 correctly', () => {
      const easter = service.calculateEaster(2025);
      expect(easter.getMonth()).toBe(3); // April
      expect(easter.getDate()).toBe(20);
    });
  });

  describe('processSickLeave', () => {
    it('should track 182-day limit', async () => {
      // Already used 180 days
      await createSickPeriodWithDays(employeeId, 180);

      // Request 5 more days
      await expect(
        service.processSickLeave(tenantId, employeeId, {
          startDate: '2024-06-01',
          endDate: '2024-06-05',
          sickNoteNumber: 'ZLA123'
        })
      ).rejects.toThrow('exceed 182-day limit');
    });

    it('should flag ZUS benefit after 33 days for under-50', async () => {
      const employee = await createEmployee({ dateOfBirth: '1990-01-01' });

      // Create 34 days of sick leave
      const request = await service.processSickLeave(tenantId, employee.id, {
        startDate: '2024-01-01',
        endDate: '2024-02-03',
        sickNoteNumber: 'ZLA123'
      });

      const period = await getSickPeriod(employee.id);
      expect(period.zusBenefitStartDate).toBeDefined();
    });
  });
});
```

## Security Checklist

- [x] RLS policies for tenant isolation
- [x] Employee can only view/edit own requests
- [x] Manager can only approve direct reports
- [x] HR Manager has broader access
- [x] Sick leave documents encrypted
- [x] PESEL data protected in sick leave
- [x] Audit trail for all leave actions

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `LEAVE_REQUEST_SUBMITTED` | New request created | Request details |
| `LEAVE_REQUEST_APPROVED` | Request approved | Approver, notes |
| `LEAVE_REQUEST_REJECTED` | Request rejected | Rejector, reason |
| `LEAVE_REQUEST_CANCELLED` | Request cancelled | Canceller, reason |
| `SICK_LEAVE_PROCESSED` | L4 processed | e-ZLA number, days |
| `ENTITLEMENT_ADJUSTED` | Manual adjustment | Adjuster, reason, amount |
| `CARRY_OVER_PROCESSED` | Year-end carry-over | Year, amounts |

## Definition of Done

- [ ] All Polish leave types implemented
- [ ] Entitlement calculation per Kodeks Pracy
- [ ] Leave request workflow functional
- [ ] Sick leave (L4) processing with 182-day tracking
- [ ] Balance tracking accurate
- [ ] Calendar integration working
- [ ] Polish holidays calculated correctly
- [ ] Year-end carry-over functional
- [ ] Unit tests passing (≥80% coverage)
- [ ] Integration tests passing
- [ ] Security review completed
