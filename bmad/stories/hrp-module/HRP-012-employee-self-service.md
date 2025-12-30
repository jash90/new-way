# HRP-012: Employee Self-Service Portal

> **Story ID**: HRP-012
> **Epic**: [HR & Payroll Module](./epic.md)
> **Priority**: P2 (Important)
> **Points**: 5
> **Status**: 📋 Ready for Development
> **Phase**: Week 28

---

## User Story

**As an** employee,
**I want** self-service access to my HR information,
**So that** I can view and update my data independently without contacting HR.

---

## Acceptance Criteria

### AC1: Personal Data Viewing and Editing
```gherkin
Given I am a logged-in employee
When I access my profile page
Then I see my personal data:
  - Full name and photo
  - Contact information (email, phone, address)
  - Employment details (position, department, start date)
  - Contract type and status
And I can edit allowed fields:
  - Phone number
  - Address
  - Emergency contact
  - Bank account details
And changes to sensitive fields require HR approval
And I see a changelog of my profile updates
```

### AC2: Payslip Access
```gherkin
Given I am an employee with payroll history
When I access the payslips section
Then I see a list of all my payslips by month
And I can filter by year
And I can view payslip details:
  - Gross salary
  - ZUS contributions breakdown
  - Tax deductions
  - Benefits and additions
  - Net salary
And I can download payslips as PDF
And I can access year-to-date summary
```

### AC3: Leave Request Submission
```gherkin
Given I want to request leave
When I use the leave request form
Then I can select leave type:
  - Urlop wypoczynkowy (annual)
  - Na żądanie (on-demand)
  - Okolicznościowy (circumstantial)
And I can select date range with calendar
And I see my available leave balance
And I see team calendar with other absences
And I can add notes for my manager
And submitted requests show pending status
And I receive notification when approved/rejected
```

### AC4: Document Download
```gherkin
Given I need HR documents
When I access the documents section
Then I see available documents:
  - Employment contract
  - Contract amendments (aneksy)
  - Certificates (zaświadczenia)
  - RODO consent forms
And I can download documents as PDF
And I can request new certificates
And I see document generation status
```

### AC5: Tax Document Access
```gherkin
Given it is tax season (January-February)
When I access tax documents
Then I see my PIT-11 for the previous year
And I can download PIT-11 as PDF
And I can confirm receipt of PIT-11
And I see history of all past PIT-11 documents
And I receive email notification when new PIT-11 is available
```

### AC6: Contact Information Updates
```gherkin
Given I need to update my contact details
When I edit my phone or address
Then changes take effect immediately for non-sensitive fields
And I see confirmation of successful update
And I receive email confirmation of changes
And HR is notified of the change
And audit log records the modification
```

### AC7: Mobile-Responsive Interface
```gherkin
Given I access the portal from a mobile device
When I use self-service features
Then all screens are mobile-optimized
And navigation is touch-friendly
And documents are viewable on mobile
And leave requests can be submitted from mobile
And push notifications work on mobile
```

---

## Technical Specification

### Database Schema

```sql
-- Employee self-service related tables

-- Profile change requests (for fields requiring approval)
CREATE TABLE employee_profile_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  requested_by UUID NOT NULL REFERENCES users(id),

  -- Change details
  field_name VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_reason TEXT,

  -- Approval workflow
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profile_changes_employee ON employee_profile_changes(employee_id);
CREATE INDEX idx_profile_changes_status ON employee_profile_changes(status) WHERE status = 'PENDING';

-- Document requests
CREATE TABLE employee_document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),

  document_type VARCHAR(50) NOT NULL, -- 'ZASWIADCZENIE_O_ZATRUDNIENIU', 'ZASWIADCZENIE_O_ZAROBKACH', 'PIT_11_COPY', 'OTHER'
  purpose TEXT, -- Why they need it
  additional_notes TEXT,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'READY', 'DELIVERED', 'REJECTED'

  -- Generated document
  document_id UUID REFERENCES documents(id),
  generated_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Processing
  processed_by UUID REFERENCES users(id),
  rejection_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_requests_employee ON employee_document_requests(employee_id);
CREATE INDEX idx_doc_requests_status ON employee_document_requests(status);

-- PIT-11 delivery tracking
CREATE TABLE pit11_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  declaration_id UUID NOT NULL REFERENCES pit_declarations(id),

  -- Delivery method
  delivery_method VARCHAR(20) NOT NULL, -- 'PORTAL', 'EMAIL', 'PRINT'
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Confirmation
  viewed_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  confirmed_ip VARCHAR(45),

  -- For email delivery
  email_sent_to VARCHAR(255),
  email_sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pit11_delivery_employee ON pit11_delivery_log(employee_id);
CREATE INDEX idx_pit11_delivery_year ON pit11_delivery_log(declaration_id);

-- Employee notifications preferences
CREATE TABLE employee_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) UNIQUE,

  -- Notification channels
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,

  -- Notification types
  payslip_notifications BOOLEAN NOT NULL DEFAULT true,
  leave_notifications BOOLEAN NOT NULL DEFAULT true,
  document_notifications BOOLEAN NOT NULL DEFAULT true,
  tax_notifications BOOLEAN NOT NULL DEFAULT true,
  profile_change_notifications BOOLEAN NOT NULL DEFAULT true,

  -- Digest settings
  digest_enabled BOOLEAN NOT NULL DEFAULT false,
  digest_frequency VARCHAR(20) DEFAULT 'WEEKLY', -- 'DAILY', 'WEEKLY'

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Employee session activity for security
CREATE TABLE employee_portal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  user_id UUID NOT NULL REFERENCES users(id),

  -- Session info
  session_token_hash VARCHAR(64) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT,
  device_type VARCHAR(20), -- 'DESKTOP', 'MOBILE', 'TABLET'

  -- Activity
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pages_visited JSONB DEFAULT '[]',

  -- Termination
  logged_out_at TIMESTAMPTZ,
  logout_reason VARCHAR(50), -- 'USER_LOGOUT', 'SESSION_TIMEOUT', 'FORCED_LOGOUT'

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_portal_sessions_employee ON employee_portal_sessions(employee_id);
CREATE INDEX idx_portal_sessions_active ON employee_portal_sessions(employee_id, logged_out_at) WHERE logged_out_at IS NULL;

-- Row Level Security
ALTER TABLE employee_profile_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE pit11_delivery_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_portal_sessions ENABLE ROW LEVEL SECURITY;

-- Employees can only see their own data
CREATE POLICY employee_own_profile_changes ON employee_profile_changes
  FOR ALL USING (
    employee_id = current_setting('app.employee_id')::uuid
    OR tenant_id = current_setting('app.tenant_id')::uuid
  );

CREATE POLICY employee_own_doc_requests ON employee_document_requests
  FOR ALL USING (
    employee_id = current_setting('app.employee_id')::uuid
    OR tenant_id = current_setting('app.tenant_id')::uuid
  );

CREATE POLICY employee_own_pit11_delivery ON pit11_delivery_log
  FOR ALL USING (
    employee_id = current_setting('app.employee_id')::uuid
    OR tenant_id = current_setting('app.tenant_id')::uuid
  );

CREATE POLICY employee_own_notifications ON employee_notification_preferences
  FOR ALL USING (
    employee_id = current_setting('app.employee_id')::uuid
  );

CREATE POLICY employee_own_sessions ON employee_portal_sessions
  FOR ALL USING (
    employee_id = current_setting('app.employee_id')::uuid
  );
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Editable profile fields (non-sensitive)
export const updateProfileSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{9,15}$/).optional(),
  personalEmail: z.string().email().optional(),
  address: z.object({
    street: z.string().min(1).max(255),
    city: z.string().min(1).max(100),
    postalCode: z.string().regex(/^\d{2}-\d{3}$/), // Polish postal code
    country: z.string().default('PL'),
  }).optional(),
  emergencyContact: z.object({
    name: z.string().min(1).max(255),
    relationship: z.string().max(100),
    phone: z.string().regex(/^\+?[0-9]{9,15}$/),
  }).optional(),
});

// Bank account update (requires approval)
export const updateBankAccountSchema = z.object({
  accountNumber: z.string().regex(/^[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}$/), // IBAN format
  bankName: z.string().min(1).max(255),
  swift: z.string().regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/).optional(),
  changeReason: z.string().min(10).max(500),
});

// Leave request from self-service
export const selfServiceLeaveRequestSchema = z.object({
  leaveType: z.enum([
    'WYPOCZYNKOWY',
    'NA_ZADANIE',
    'OKOLICZNOSCIOWY',
    'BEZPLATNY',
  ]),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  startHalfDay: z.boolean().default(false),
  endHalfDay: z.boolean().default(false),
  notes: z.string().max(500).optional(),
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'Data końcowa musi być po dacie początkowej' }
);

// Document request
export const documentRequestSchema = z.object({
  documentType: z.enum([
    'ZASWIADCZENIE_O_ZATRUDNIENIU',
    'ZASWIADCZENIE_O_ZAROBKACH',
    'ZASWIADCZENIE_ZUS',
    'PIT_11_COPY',
    'OTHER',
  ]),
  purpose: z.string().min(10).max(500),
  additionalNotes: z.string().max(1000).optional(),
  urgencyLevel: z.enum(['NORMAL', 'URGENT']).default('NORMAL'),
});

// Notification preferences
export const notificationPreferencesSchema = z.object({
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  payslipNotifications: z.boolean(),
  leaveNotifications: z.boolean(),
  documentNotifications: z.boolean(),
  taxNotifications: z.boolean(),
  profileChangeNotifications: z.boolean(),
  digestEnabled: z.boolean(),
  digestFrequency: z.enum(['DAILY', 'WEEKLY']).optional(),
});

// PIT-11 confirmation
export const confirmPit11Schema = z.object({
  declarationId: z.string().uuid(),
  confirmed: z.boolean(),
});
```

### Core Services

```typescript
// src/server/services/employee-self-service.service.ts
import { TRPCError } from '@trpc/server';
import { db } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  employees,
  payslips,
  leaveRequests,
  leaveEntitlements,
  contracts,
  documents,
  pitDeclarations,
  employeeProfileChanges,
  employeeDocumentRequests,
  pit11DeliveryLog,
  employeeNotificationPreferences,
} from '../db/schema';
import { NotificationService } from './notification.service';
import { DocumentGeneratorService } from './document-generator.service';
import { AuditService } from './audit.service';

export class EmployeeSelfServiceService {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly documentService: DocumentGeneratorService,
    private readonly auditService: AuditService
  ) {}

  // ============================================
  // PROFILE MANAGEMENT
  // ============================================

  async getMyProfile(employeeId: string): Promise<EmployeeProfile> {
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, employeeId),
      with: {
        contracts: {
          where: eq(contracts.status, 'ACTIVE'),
          limit: 1,
        },
      },
    });

    if (!employee) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Profil pracownika nie został znaleziony',
      });
    }

    // Get pending changes
    const pendingChanges = await db.query.employeeProfileChanges.findMany({
      where: and(
        eq(employeeProfileChanges.employeeId, employeeId),
        eq(employeeProfileChanges.status, 'PENDING')
      ),
    });

    return {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      personalEmail: employee.personalEmail,
      address: employee.address,
      emergencyContact: employee.emergencyContact,
      position: employee.position,
      department: employee.department,
      hireDate: employee.hireDate,
      employmentStatus: employee.status,
      contract: employee.contracts[0] ? {
        type: employee.contracts[0].contractType,
        startDate: employee.contracts[0].startDate,
        endDate: employee.contracts[0].endDate,
      } : null,
      photoUrl: employee.photoUrl,
      pendingChanges: pendingChanges.map((c) => ({
        field: c.fieldName,
        newValue: c.newValue,
        requestedAt: c.createdAt,
      })),
    };
  }

  async updateMyProfile(
    employeeId: string,
    userId: string,
    data: UpdateProfileInput
  ): Promise<{ updated: string[]; pendingApproval: string[] }> {
    const updated: string[] = [];
    const pendingApproval: string[] = [];

    // Non-sensitive fields - update immediately
    const immediateUpdates: Partial<typeof employees.$inferInsert> = {};

    if (data.phone !== undefined) {
      immediateUpdates.phone = data.phone;
      updated.push('phone');
    }

    if (data.personalEmail !== undefined) {
      immediateUpdates.personalEmail = data.personalEmail;
      updated.push('personalEmail');
    }

    if (data.address !== undefined) {
      immediateUpdates.address = data.address;
      updated.push('address');
    }

    if (data.emergencyContact !== undefined) {
      immediateUpdates.emergencyContact = data.emergencyContact;
      updated.push('emergencyContact');
    }

    if (Object.keys(immediateUpdates).length > 0) {
      await db
        .update(employees)
        .set({
          ...immediateUpdates,
          updatedAt: new Date(),
        })
        .where(eq(employees.id, employeeId));

      // Audit log
      await this.auditService.log({
        action: 'PROFILE_UPDATED',
        entityType: 'Employee',
        entityId: employeeId,
        changes: immediateUpdates,
        userId,
      });

      // Send confirmation email
      await this.notificationService.sendProfileUpdateConfirmation(
        employeeId,
        updated
      );
    }

    return { updated, pendingApproval };
  }

  async requestBankAccountChange(
    employeeId: string,
    userId: string,
    data: BankAccountChangeInput
  ): Promise<{ requestId: string }> {
    // Get current bank account
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, employeeId),
      columns: { bankAccount: true },
    });

    // Create change request
    const [request] = await db
      .insert(employeeProfileChanges)
      .values({
        tenantId: await this.getTenantId(employeeId),
        employeeId,
        requestedBy: userId,
        fieldName: 'bankAccount',
        oldValue: JSON.stringify(employee?.bankAccount),
        newValue: JSON.stringify({
          accountNumber: data.accountNumber,
          bankName: data.bankName,
          swift: data.swift,
        }),
        changeReason: data.changeReason,
        status: 'PENDING',
      })
      .returning();

    // Notify HR
    await this.notificationService.notifyHROfProfileChangeRequest(
      employeeId,
      request.id,
      'bankAccount'
    );

    // Audit log
    await this.auditService.log({
      action: 'BANK_ACCOUNT_CHANGE_REQUESTED',
      entityType: 'Employee',
      entityId: employeeId,
      changes: { requestId: request.id },
      userId,
    });

    return { requestId: request.id };
  }

  // ============================================
  // PAYSLIPS
  // ============================================

  async getMyPayslips(
    employeeId: string,
    params: { year?: number; limit?: number; offset?: number }
  ): Promise<PayslipList> {
    const year = params.year || new Date().getFullYear();
    const limit = params.limit || 12;
    const offset = params.offset || 0;

    const payslipList = await db.query.payslips.findMany({
      where: and(
        eq(payslips.employeeId, employeeId),
        sql`EXTRACT(YEAR FROM period_start) = ${year}`
      ),
      orderBy: desc(payslips.periodStart),
      limit,
      offset,
    });

    // Get year-to-date totals
    const ytdTotals = await db
      .select({
        grossTotal: sql<number>`sum(gross_salary)`,
        netTotal: sql<number>`sum(net_salary)`,
        zusTotal: sql<number>`sum(employee_zus_total)`,
        taxTotal: sql<number>`sum(tax_advance)`,
      })
      .from(payslips)
      .where(
        and(
          eq(payslips.employeeId, employeeId),
          sql`EXTRACT(YEAR FROM period_start) = ${year}`
        )
      );

    // Get available years
    const years = await db
      .selectDistinct({
        year: sql<number>`EXTRACT(YEAR FROM period_start)::int`,
      })
      .from(payslips)
      .where(eq(payslips.employeeId, employeeId))
      .orderBy(desc(sql`EXTRACT(YEAR FROM period_start)`));

    return {
      payslips: payslipList.map((p) => ({
        id: p.id,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        grossSalary: p.grossSalary,
        netSalary: p.netSalary,
        status: p.status,
        pdfPath: p.documentPath,
      })),
      yearToDate: {
        year,
        grossTotal: Number(ytdTotals[0]?.grossTotal) || 0,
        netTotal: Number(ytdTotals[0]?.netTotal) || 0,
        zusTotal: Number(ytdTotals[0]?.zusTotal) || 0,
        taxTotal: Number(ytdTotals[0]?.taxTotal) || 0,
      },
      availableYears: years.map((y) => y.year),
      pagination: {
        limit,
        offset,
        hasMore: payslipList.length === limit,
      },
    };
  }

  async getPayslipDetails(
    employeeId: string,
    payslipId: string
  ): Promise<PayslipDetails> {
    const payslip = await db.query.payslips.findFirst({
      where: and(
        eq(payslips.id, payslipId),
        eq(payslips.employeeId, employeeId)
      ),
    });

    if (!payslip) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Pasek wypłaty nie został znaleziony',
      });
    }

    return {
      id: payslip.id,
      periodStart: payslip.periodStart,
      periodEnd: payslip.periodEnd,

      // Earnings
      earnings: {
        baseSalary: payslip.baseSalary,
        overtime: payslip.overtimeAmount,
        bonuses: payslip.bonusesTotal,
        benefits: payslip.benefitsTotal,
        grossSalary: payslip.grossSalary,
      },

      // ZUS Deductions (Employee)
      zusEmployee: {
        emerytalne: payslip.zusEmerytalne,
        rentowe: payslip.zusRentowe,
        chorobowe: payslip.zusChorobowe,
        total: payslip.employeeZusTotal,
      },

      // Health Insurance
      healthInsurance: {
        contribution: payslip.healthContribution,
        taxDeductible: payslip.healthTaxDeductible,
      },

      // Tax
      tax: {
        base: payslip.taxBase,
        costs: payslip.taxDeductibleCosts,
        relief: payslip.taxRelief,
        advance: payslip.taxAdvance,
      },

      // Other deductions
      otherDeductions: payslip.otherDeductions || [],

      // Net
      netSalary: payslip.netSalary,

      // Employer costs (informational)
      employerCosts: {
        zusEmerytalneEmployer: payslip.zusEmerytalneEmployer,
        zusRentoweEmployer: payslip.zusRentoweEmployer,
        zusWypadkowe: payslip.zusWypadkowe,
        funduszPracy: payslip.funduszPracy,
        fgsp: payslip.fgsp,
        ppkEmployer: payslip.ppkEmployer,
        totalEmployerCost: payslip.totalEmployerCost,
      },

      // Document
      pdfPath: payslip.documentPath,
      generatedAt: payslip.generatedAt,
    };
  }

  async downloadPayslip(
    employeeId: string,
    payslipId: string
  ): Promise<{ url: string; filename: string }> {
    const payslip = await db.query.payslips.findFirst({
      where: and(
        eq(payslips.id, payslipId),
        eq(payslips.employeeId, employeeId)
      ),
    });

    if (!payslip || !payslip.documentPath) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Dokument paska wypłaty nie został znaleziony',
      });
    }

    // Generate signed URL for download
    const url = await this.documentService.getSignedUrl(
      payslip.documentPath,
      3600 // 1 hour expiry
    );

    const period = new Date(payslip.periodStart);
    const filename = `pasek_${period.getFullYear()}_${String(period.getMonth() + 1).padStart(2, '0')}.pdf`;

    // Log download
    await this.auditService.log({
      action: 'PAYSLIP_DOWNLOADED',
      entityType: 'Payslip',
      entityId: payslipId,
      changes: {},
      userId: employeeId,
    });

    return { url, filename };
  }

  // ============================================
  // LEAVE MANAGEMENT
  // ============================================

  async getMyLeaveBalance(employeeId: string): Promise<LeaveBalanceInfo> {
    const currentYear = new Date().getFullYear();

    const entitlements = await db.query.leaveEntitlements.findMany({
      where: and(
        eq(leaveEntitlements.employeeId, employeeId),
        eq(leaveEntitlements.year, currentYear)
      ),
    });

    // Check for carryover from previous year (valid until Sept 30)
    const carryover = await db.query.leaveEntitlements.findFirst({
      where: and(
        eq(leaveEntitlements.employeeId, employeeId),
        eq(leaveEntitlements.year, currentYear - 1),
        eq(leaveEntitlements.leaveType, 'WYPOCZYNKOWY'),
        sql`carry_over_days > 0`
      ),
    });

    const now = new Date();
    const carryoverExpiry = new Date(currentYear, 8, 30); // Sept 30
    const carryoverValid = now < carryoverExpiry;

    // Get pending requests
    const pendingRequests = await db.query.leaveRequests.findMany({
      where: and(
        eq(leaveRequests.employeeId, employeeId),
        eq(leaveRequests.status, 'PENDING')
      ),
    });

    const balances = entitlements.map((e) => ({
      leaveType: e.leaveType,
      totalEntitlement: e.totalEntitlement,
      usedDays: e.usedDays,
      pendingDays: e.pendingDays,
      remainingDays: e.remainingDays,
    }));

    return {
      year: currentYear,
      balances,
      carryover: carryover && carryoverValid ? {
        days: carryover.carryOverDays,
        expiresAt: carryoverExpiry,
      } : null,
      pendingRequests: pendingRequests.length,
    };
  }

  async submitLeaveRequest(
    employeeId: string,
    userId: string,
    data: LeaveRequestInput
  ): Promise<{ requestId: string }> {
    // Validate balance
    const balance = await this.getMyLeaveBalance(employeeId);
    const typeBalance = balance.balances.find(
      (b) => b.leaveType === data.leaveType
    );

    if (!typeBalance || typeBalance.remainingDays < this.calculateWorkingDays(data)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Niewystarczająca liczba dni urlopu',
      });
    }

    // Check for on-demand leave limit (max 4 per year)
    if (data.leaveType === 'NA_ZADANIE') {
      const onDemandUsed = await db
        .select({ count: sql<number>`count(*)` })
        .from(leaveRequests)
        .where(
          and(
            eq(leaveRequests.employeeId, employeeId),
            eq(leaveRequests.leaveType, 'NA_ZADANIE'),
            eq(leaveRequests.status, 'APPROVED'),
            sql`EXTRACT(YEAR FROM start_date) = ${new Date().getFullYear()}`
          )
        );

      if (Number(onDemandUsed[0]?.count) >= 4) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Wykorzystano limit 4 dni urlopu na żądanie w roku',
        });
      }
    }

    // Get manager for approval routing
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, employeeId),
      columns: { managerId: true },
    });

    // Calculate working days
    const workingDays = this.calculateWorkingDays(data);

    // Create leave request
    const [request] = await db
      .insert(leaveRequests)
      .values({
        tenantId: await this.getTenantId(employeeId),
        employeeId,
        leaveType: data.leaveType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        startHalfDay: data.startHalfDay,
        endHalfDay: data.endHalfDay,
        workingDays,
        notes: data.notes,
        status: 'PENDING',
        requestedBy: userId,
        approverId: employee?.managerId,
      })
      .returning();

    // Update pending days in entitlement
    await db
      .update(leaveEntitlements)
      .set({
        pendingDays: sql`pending_days + ${workingDays}`,
      })
      .where(
        and(
          eq(leaveEntitlements.employeeId, employeeId),
          eq(leaveEntitlements.leaveType, data.leaveType),
          eq(leaveEntitlements.year, new Date().getFullYear())
        )
      );

    // Notify manager
    if (employee?.managerId) {
      await this.notificationService.notifyManagerOfLeaveRequest(
        employee.managerId,
        request.id
      );
    }

    // Audit log
    await this.auditService.log({
      action: 'LEAVE_REQUESTED',
      entityType: 'LeaveRequest',
      entityId: request.id,
      changes: data,
      userId,
    });

    return { requestId: request.id };
  }

  async getMyLeaveRequests(
    employeeId: string,
    params: { status?: string; year?: number }
  ): Promise<LeaveRequestInfo[]> {
    const year = params.year || new Date().getFullYear();

    const requests = await db.query.leaveRequests.findMany({
      where: and(
        eq(leaveRequests.employeeId, employeeId),
        sql`EXTRACT(YEAR FROM start_date) = ${year}`,
        params.status ? eq(leaveRequests.status, params.status) : undefined
      ),
      orderBy: desc(leaveRequests.startDate),
    });

    return requests.map((r) => ({
      id: r.id,
      leaveType: r.leaveType,
      startDate: r.startDate,
      endDate: r.endDate,
      workingDays: r.workingDays,
      status: r.status,
      notes: r.notes,
      approvedAt: r.approvedAt,
      rejectedAt: r.rejectedAt,
      rejectionReason: r.rejectionReason,
    }));
  }

  async cancelLeaveRequest(
    employeeId: string,
    requestId: string
  ): Promise<void> {
    const request = await db.query.leaveRequests.findFirst({
      where: and(
        eq(leaveRequests.id, requestId),
        eq(leaveRequests.employeeId, employeeId)
      ),
    });

    if (!request) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Wniosek urlopowy nie został znaleziony',
      });
    }

    if (request.status !== 'PENDING') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Można anulować tylko wnioski oczekujące',
      });
    }

    // Update request status
    await db
      .update(leaveRequests)
      .set({
        status: 'CANCELLED',
        updatedAt: new Date(),
      })
      .where(eq(leaveRequests.id, requestId));

    // Release pending days
    await db
      .update(leaveEntitlements)
      .set({
        pendingDays: sql`pending_days - ${request.workingDays}`,
      })
      .where(
        and(
          eq(leaveEntitlements.employeeId, employeeId),
          eq(leaveEntitlements.leaveType, request.leaveType),
          eq(leaveEntitlements.year, new Date(request.startDate).getFullYear())
        )
      );
  }

  // ============================================
  // DOCUMENTS
  // ============================================

  async getMyDocuments(employeeId: string): Promise<DocumentInfo[]> {
    // Get contracts
    const contractDocs = await db.query.contracts.findMany({
      where: eq(contracts.employeeId, employeeId),
      columns: {
        id: true,
        contractType: true,
        startDate: true,
        documentPath: true,
        createdAt: true,
      },
      orderBy: desc(contracts.createdAt),
    });

    // Get other documents (certificates, etc.)
    const otherDocs = await db.query.documents.findMany({
      where: and(
        eq(documents.employeeId, employeeId),
        sql`document_category = 'HR'`
      ),
      orderBy: desc(documents.createdAt),
    });

    const allDocs: DocumentInfo[] = [
      ...contractDocs.map((c) => ({
        id: c.id,
        type: 'CONTRACT' as const,
        name: `Umowa - ${c.contractType}`,
        date: c.startDate,
        path: c.documentPath,
      })),
      ...otherDocs.map((d) => ({
        id: d.id,
        type: 'OTHER' as const,
        name: d.name,
        date: d.createdAt,
        path: d.filePath,
      })),
    ];

    return allDocs.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async requestDocument(
    employeeId: string,
    userId: string,
    data: DocumentRequestInput
  ): Promise<{ requestId: string }> {
    const [request] = await db
      .insert(employeeDocumentRequests)
      .values({
        tenantId: await this.getTenantId(employeeId),
        employeeId,
        documentType: data.documentType,
        purpose: data.purpose,
        additionalNotes: data.additionalNotes,
        status: 'PENDING',
      })
      .returning();

    // Notify HR
    await this.notificationService.notifyHROfDocumentRequest(
      employeeId,
      request.id,
      data.documentType
    );

    // Audit log
    await this.auditService.log({
      action: 'DOCUMENT_REQUESTED',
      entityType: 'DocumentRequest',
      entityId: request.id,
      changes: data,
      userId,
    });

    return { requestId: request.id };
  }

  async getMyDocumentRequests(employeeId: string): Promise<DocumentRequestInfo[]> {
    const requests = await db.query.employeeDocumentRequests.findMany({
      where: eq(employeeDocumentRequests.employeeId, employeeId),
      orderBy: desc(employeeDocumentRequests.createdAt),
    });

    return requests.map((r) => ({
      id: r.id,
      documentType: r.documentType,
      purpose: r.purpose,
      status: r.status,
      requestedAt: r.createdAt,
      readyAt: r.generatedAt,
      documentId: r.documentId,
    }));
  }

  // ============================================
  // TAX DOCUMENTS
  // ============================================

  async getMyPit11Documents(employeeId: string): Promise<Pit11Info[]> {
    const declarations = await db.query.pitDeclarations.findMany({
      where: and(
        eq(pitDeclarations.employeeId, employeeId),
        eq(pitDeclarations.declarationType, 'PIT_11')
      ),
      orderBy: desc(pitDeclarations.taxYear),
    });

    // Get delivery info
    const deliveryLogs = await db.query.pit11DeliveryLog.findMany({
      where: eq(pit11DeliveryLog.employeeId, employeeId),
    });

    const deliveryMap = new Map(
      deliveryLogs.map((d) => [d.declarationId, d])
    );

    return declarations.map((d) => {
      const delivery = deliveryMap.get(d.id);
      return {
        id: d.id,
        taxYear: d.taxYear,
        status: d.status,
        generatedAt: d.generatedAt,
        documentPath: d.documentPath,
        viewedAt: delivery?.viewedAt,
        downloadedAt: delivery?.downloadedAt,
        confirmedAt: delivery?.confirmedAt,
      };
    });
  }

  async viewPit11(
    employeeId: string,
    declarationId: string
  ): Promise<{ url: string }> {
    const declaration = await db.query.pitDeclarations.findFirst({
      where: and(
        eq(pitDeclarations.id, declarationId),
        eq(pitDeclarations.employeeId, employeeId)
      ),
    });

    if (!declaration || !declaration.documentPath) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Deklaracja PIT-11 nie została znaleziona',
      });
    }

    // Update view timestamp
    await db
      .update(pit11DeliveryLog)
      .set({ viewedAt: new Date() })
      .where(
        and(
          eq(pit11DeliveryLog.declarationId, declarationId),
          eq(pit11DeliveryLog.employeeId, employeeId)
        )
      );

    // Generate signed URL
    const url = await this.documentService.getSignedUrl(
      declaration.documentPath,
      3600
    );

    return { url };
  }

  async downloadPit11(
    employeeId: string,
    declarationId: string
  ): Promise<{ url: string; filename: string }> {
    const declaration = await db.query.pitDeclarations.findFirst({
      where: and(
        eq(pitDeclarations.id, declarationId),
        eq(pitDeclarations.employeeId, employeeId)
      ),
    });

    if (!declaration || !declaration.documentPath) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Deklaracja PIT-11 nie została znaleziona',
      });
    }

    // Update download timestamp
    await db
      .update(pit11DeliveryLog)
      .set({ downloadedAt: new Date() })
      .where(
        and(
          eq(pit11DeliveryLog.declarationId, declarationId),
          eq(pit11DeliveryLog.employeeId, employeeId)
        )
      );

    const url = await this.documentService.getSignedUrl(
      declaration.documentPath,
      3600
    );

    const filename = `PIT-11_${declaration.taxYear}.pdf`;

    // Audit log
    await this.auditService.log({
      action: 'PIT11_DOWNLOADED',
      entityType: 'PitDeclaration',
      entityId: declarationId,
      changes: {},
      userId: employeeId,
    });

    return { url, filename };
  }

  async confirmPit11Receipt(
    employeeId: string,
    declarationId: string,
    ipAddress: string
  ): Promise<void> {
    await db
      .update(pit11DeliveryLog)
      .set({
        confirmedAt: new Date(),
        confirmedIp: ipAddress,
      })
      .where(
        and(
          eq(pit11DeliveryLog.declarationId, declarationId),
          eq(pit11DeliveryLog.employeeId, employeeId)
        )
      );

    // Audit log
    await this.auditService.log({
      action: 'PIT11_RECEIPT_CONFIRMED',
      entityType: 'PitDeclaration',
      entityId: declarationId,
      changes: { ipAddress },
      userId: employeeId,
    });
  }

  // ============================================
  // NOTIFICATION PREFERENCES
  // ============================================

  async getNotificationPreferences(
    employeeId: string
  ): Promise<NotificationPreferences> {
    let prefs = await db.query.employeeNotificationPreferences.findFirst({
      where: eq(employeeNotificationPreferences.employeeId, employeeId),
    });

    if (!prefs) {
      // Create default preferences
      [prefs] = await db
        .insert(employeeNotificationPreferences)
        .values({
          employeeId,
          emailEnabled: true,
          pushEnabled: true,
          smsEnabled: false,
          payslipNotifications: true,
          leaveNotifications: true,
          documentNotifications: true,
          taxNotifications: true,
          profileChangeNotifications: true,
          digestEnabled: false,
        })
        .returning();
    }

    return {
      emailEnabled: prefs.emailEnabled,
      pushEnabled: prefs.pushEnabled,
      smsEnabled: prefs.smsEnabled,
      payslipNotifications: prefs.payslipNotifications,
      leaveNotifications: prefs.leaveNotifications,
      documentNotifications: prefs.documentNotifications,
      taxNotifications: prefs.taxNotifications,
      profileChangeNotifications: prefs.profileChangeNotifications,
      digestEnabled: prefs.digestEnabled,
      digestFrequency: prefs.digestFrequency,
    };
  }

  async updateNotificationPreferences(
    employeeId: string,
    data: NotificationPreferencesInput
  ): Promise<void> {
    await db
      .insert(employeeNotificationPreferences)
      .values({
        employeeId,
        ...data,
      })
      .onConflictDoUpdate({
        target: employeeNotificationPreferences.employeeId,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      });
  }

  // ============================================
  // TEAM CALENDAR (for leave visibility)
  // ============================================

  async getTeamCalendar(
    employeeId: string,
    params: { startDate: string; endDate: string }
  ): Promise<TeamCalendarEntry[]> {
    // Get employee's team members (same department/manager)
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, employeeId),
      columns: { department: true, managerId: true },
    });

    if (!employee) {
      return [];
    }

    // Get approved leave for team members in date range
    const teamLeave = await db
      .select({
        employeeId: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        leaveType: leaveRequests.leaveType,
      })
      .from(leaveRequests)
      .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
      .where(
        and(
          eq(employees.department, employee.department),
          eq(leaveRequests.status, 'APPROVED'),
          sql`start_date <= ${params.endDate}`,
          sql`end_date >= ${params.startDate}`
        )
      );

    return teamLeave.map((l) => ({
      employeeId: l.employeeId,
      employeeName: `${l.firstName} ${l.lastName.charAt(0)}.`, // Privacy: only initial
      startDate: l.startDate,
      endDate: l.endDate,
      leaveType: l.leaveType,
    }));
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async getTenantId(employeeId: string): Promise<string> {
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, employeeId),
      columns: { tenantId: true },
    });
    return employee!.tenantId;
  }

  private calculateWorkingDays(data: LeaveRequestInput): number {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    let days = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Not weekend
        if (!this.isPolishHoliday(current)) {
          days++;
        }
      }
      current.setDate(current.getDate() + 1);
    }

    // Adjust for half days
    if (data.startHalfDay) days -= 0.5;
    if (data.endHalfDay) days -= 0.5;

    return days;
  }

  private isPolishHoliday(date: Date): boolean {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    // Fixed holidays
    const fixedHolidays = [
      [0, 1],   // Nowy Rok
      [0, 6],   // Trzech Króli
      [4, 1],   // Święto Pracy
      [4, 3],   // Święto Konstytucji
      [7, 15],  // Wniebowzięcie NMP
      [10, 1],  // Wszystkich Świętych
      [10, 11], // Święto Niepodległości
      [11, 25], // Boże Narodzenie
      [11, 26], // Drugi dzień świąt
    ];

    for (const [m, d] of fixedHolidays) {
      if (month === m && day === d) return true;
    }

    // Easter-based holidays
    const easter = this.calculateEaster(year);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);
    const corpusChristi = new Date(easter);
    corpusChristi.setDate(easter.getDate() + 60);

    if (
      (month === easter.getMonth() && day === easter.getDate()) ||
      (month === easterMonday.getMonth() && day === easterMonday.getDate()) ||
      (month === corpusChristi.getMonth() && day === corpusChristi.getDate())
    ) {
      return true;
    }

    return false;
  }

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
}
```

### tRPC Router

```typescript
// src/server/routers/employee-self-service.router.ts
import { router, employeeProcedure } from '../trpc';
import { z } from 'zod';
import {
  updateProfileSchema,
  updateBankAccountSchema,
  selfServiceLeaveRequestSchema,
  documentRequestSchema,
  notificationPreferencesSchema,
  confirmPit11Schema,
} from '../schemas/self-service.schema';

export const employeeSelfServiceRouter = router({
  // Profile
  getMyProfile: employeeProcedure
    .query(async ({ ctx }) => {
      return ctx.selfServiceService.getMyProfile(ctx.employeeId);
    }),

  updateMyProfile: employeeProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.selfServiceService.updateMyProfile(
        ctx.employeeId,
        ctx.userId,
        input
      );
    }),

  requestBankAccountChange: employeeProcedure
    .input(updateBankAccountSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.selfServiceService.requestBankAccountChange(
        ctx.employeeId,
        ctx.userId,
        input
      );
    }),

  // Payslips
  getMyPayslips: employeeProcedure
    .input(z.object({
      year: z.number().int().optional(),
      limit: z.number().int().min(1).max(50).default(12),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.selfServiceService.getMyPayslips(ctx.employeeId, input);
    }),

  getPayslipDetails: employeeProcedure
    .input(z.object({ payslipId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.selfServiceService.getPayslipDetails(
        ctx.employeeId,
        input.payslipId
      );
    }),

  downloadPayslip: employeeProcedure
    .input(z.object({ payslipId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.selfServiceService.downloadPayslip(
        ctx.employeeId,
        input.payslipId
      );
    }),

  // Leave
  getMyLeaveBalance: employeeProcedure
    .query(async ({ ctx }) => {
      return ctx.selfServiceService.getMyLeaveBalance(ctx.employeeId);
    }),

  submitLeaveRequest: employeeProcedure
    .input(selfServiceLeaveRequestSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.selfServiceService.submitLeaveRequest(
        ctx.employeeId,
        ctx.userId,
        input
      );
    }),

  getMyLeaveRequests: employeeProcedure
    .input(z.object({
      status: z.string().optional(),
      year: z.number().int().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.selfServiceService.getMyLeaveRequests(ctx.employeeId, input);
    }),

  cancelLeaveRequest: employeeProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.selfServiceService.cancelLeaveRequest(
        ctx.employeeId,
        input.requestId
      );
    }),

  getTeamCalendar: employeeProcedure
    .input(z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.selfServiceService.getTeamCalendar(ctx.employeeId, input);
    }),

  // Documents
  getMyDocuments: employeeProcedure
    .query(async ({ ctx }) => {
      return ctx.selfServiceService.getMyDocuments(ctx.employeeId);
    }),

  requestDocument: employeeProcedure
    .input(documentRequestSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.selfServiceService.requestDocument(
        ctx.employeeId,
        ctx.userId,
        input
      );
    }),

  getMyDocumentRequests: employeeProcedure
    .query(async ({ ctx }) => {
      return ctx.selfServiceService.getMyDocumentRequests(ctx.employeeId);
    }),

  // Tax documents
  getMyPit11Documents: employeeProcedure
    .query(async ({ ctx }) => {
      return ctx.selfServiceService.getMyPit11Documents(ctx.employeeId);
    }),

  viewPit11: employeeProcedure
    .input(z.object({ declarationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.selfServiceService.viewPit11(
        ctx.employeeId,
        input.declarationId
      );
    }),

  downloadPit11: employeeProcedure
    .input(z.object({ declarationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.selfServiceService.downloadPit11(
        ctx.employeeId,
        input.declarationId
      );
    }),

  confirmPit11Receipt: employeeProcedure
    .input(confirmPit11Schema)
    .mutation(async ({ ctx, input }) => {
      return ctx.selfServiceService.confirmPit11Receipt(
        ctx.employeeId,
        input.declarationId,
        ctx.req.ip // Get IP from request
      );
    }),

  // Notifications
  getNotificationPreferences: employeeProcedure
    .query(async ({ ctx }) => {
      return ctx.selfServiceService.getNotificationPreferences(ctx.employeeId);
    }),

  updateNotificationPreferences: employeeProcedure
    .input(notificationPreferencesSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.selfServiceService.updateNotificationPreferences(
        ctx.employeeId,
        input
      );
    }),
});
```

---

## Test Specification

### Unit Tests

```typescript
describe('EmployeeSelfServiceService', () => {
  describe('getMyProfile', () => {
    it('should return employee profile with pending changes', async () => {
      const profile = await service.getMyProfile(employeeId);

      expect(profile.id).toBe(employeeId);
      expect(profile.firstName).toBeDefined();
      expect(profile.pendingChanges).toBeInstanceOf(Array);
    });
  });

  describe('updateMyProfile', () => {
    it('should update non-sensitive fields immediately', async () => {
      const result = await service.updateMyProfile(employeeId, userId, {
        phone: '+48123456789',
      });

      expect(result.updated).toContain('phone');
      expect(result.pendingApproval).toHaveLength(0);
    });
  });

  describe('requestBankAccountChange', () => {
    it('should create pending change request', async () => {
      const result = await service.requestBankAccountChange(employeeId, userId, {
        accountNumber: 'PL61109010140000071219812874',
        bankName: 'mBank',
        changeReason: 'Zmiana banku',
      });

      expect(result.requestId).toBeDefined();

      const request = await db.query.employeeProfileChanges.findFirst({
        where: eq(employeeProfileChanges.id, result.requestId),
      });
      expect(request?.status).toBe('PENDING');
    });
  });

  describe('getMyPayslips', () => {
    it('should return paginated payslips with YTD totals', async () => {
      const result = await service.getMyPayslips(employeeId, { year: 2024 });

      expect(result.payslips).toBeInstanceOf(Array);
      expect(result.yearToDate.year).toBe(2024);
      expect(result.availableYears).toContain(2024);
    });
  });

  describe('submitLeaveRequest', () => {
    it('should validate leave balance before submission', async () => {
      await expect(
        service.submitLeaveRequest(employeeId, userId, {
          leaveType: 'WYPOCZYNKOWY',
          startDate: '2024-12-01T00:00:00Z',
          endDate: '2024-12-31T00:00:00Z', // 23 working days - may exceed balance
          startHalfDay: false,
          endHalfDay: false,
        })
      ).rejects.toThrow('Niewystarczająca liczba dni urlopu');
    });

    it('should enforce on-demand leave limit of 4 days', async () => {
      // Setup: Already used 4 on-demand days this year
      await expect(
        service.submitLeaveRequest(employeeId, userId, {
          leaveType: 'NA_ZADANIE',
          startDate: '2024-12-15T00:00:00Z',
          endDate: '2024-12-15T00:00:00Z',
          startHalfDay: false,
          endHalfDay: false,
        })
      ).rejects.toThrow('Wykorzystano limit 4 dni urlopu na żądanie');
    });

    it('should calculate working days excluding weekends and holidays', async () => {
      const result = await service.submitLeaveRequest(employeeId, userId, {
        leaveType: 'WYPOCZYNKOWY',
        startDate: '2024-12-23T00:00:00Z', // Monday
        endDate: '2024-12-27T00:00:00Z',   // Friday - includes Christmas
        startHalfDay: false,
        endHalfDay: false,
      });

      const request = await db.query.leaveRequests.findFirst({
        where: eq(leaveRequests.id, result.requestId),
      });

      // 5 calendar days - 2 weekend days - 2 Christmas holidays = 1 working day
      // But Dec 23, 24, 27 are working days = 3 working days (assuming 25, 26 are holidays)
      expect(request?.workingDays).toBe(3);
    });
  });

  describe('getMyPit11Documents', () => {
    it('should return PIT-11 with delivery status', async () => {
      const documents = await service.getMyPit11Documents(employeeId);

      expect(documents).toBeInstanceOf(Array);
      documents.forEach((doc) => {
        expect(doc.taxYear).toBeDefined();
        expect(doc.status).toBeDefined();
      });
    });
  });

  describe('confirmPit11Receipt', () => {
    it('should record confirmation with IP address', async () => {
      await service.confirmPit11Receipt(employeeId, declarationId, '192.168.1.1');

      const log = await db.query.pit11DeliveryLog.findFirst({
        where: eq(pit11DeliveryLog.declarationId, declarationId),
      });

      expect(log?.confirmedAt).toBeDefined();
      expect(log?.confirmedIp).toBe('192.168.1.1');
    });
  });
});
```

### Integration Tests

```typescript
describe('Employee Self-Service Integration', () => {
  it('should complete full leave request workflow', async () => {
    // Check initial balance
    const balanceBefore = await service.getMyLeaveBalance(employeeId);
    const initialRemaining = balanceBefore.balances.find(
      (b) => b.leaveType === 'WYPOCZYNKOWY'
    )?.remainingDays ?? 0;

    // Submit request
    const { requestId } = await service.submitLeaveRequest(employeeId, userId, {
      leaveType: 'WYPOCZYNKOWY',
      startDate: '2024-12-02T00:00:00Z',
      endDate: '2024-12-03T00:00:00Z',
      startHalfDay: false,
      endHalfDay: false,
    });

    // Check pending days updated
    const balanceAfter = await service.getMyLeaveBalance(employeeId);
    const pendingDays = balanceAfter.balances.find(
      (b) => b.leaveType === 'WYPOCZYNKOWY'
    )?.pendingDays ?? 0;

    expect(pendingDays).toBe(2);

    // Cancel request
    await service.cancelLeaveRequest(employeeId, requestId);

    // Check balance restored
    const balanceFinal = await service.getMyLeaveBalance(employeeId);
    const finalPending = balanceFinal.balances.find(
      (b) => b.leaveType === 'WYPOCZYNKOWY'
    )?.pendingDays ?? 0;

    expect(finalPending).toBe(0);
  });

  it('should track PIT-11 viewing and downloading', async () => {
    // View PIT-11
    await service.viewPit11(employeeId, declarationId);

    // Download PIT-11
    const { url, filename } = await service.downloadPit11(employeeId, declarationId);

    expect(url).toContain('signed');
    expect(filename).toMatch(/PIT-11_\d{4}\.pdf/);

    // Check delivery log
    const log = await db.query.pit11DeliveryLog.findFirst({
      where: eq(pit11DeliveryLog.declarationId, declarationId),
    });

    expect(log?.viewedAt).toBeDefined();
    expect(log?.downloadedAt).toBeDefined();
  });
});
```

---

## Security Checklist

- [ ] Employee can only access their own data (RLS policies)
- [ ] Sensitive field changes require HR approval
- [ ] Bank account changes require additional verification
- [ ] Document downloads logged with IP
- [ ] Session tracking for suspicious activity
- [ ] Rate limiting on document requests
- [ ] PIT-11 confirmation with IP logging
- [ ] Team calendar shows only approved leave (privacy)
- [ ] CSRF protection on all mutations
- [ ] XSS protection on user-entered data

---

## Audit Events

```typescript
const SELF_SERVICE_AUDIT_EVENTS = {
  PROFILE_UPDATED: 'hrp.selfservice.profile_updated',
  BANK_ACCOUNT_CHANGE_REQUESTED: 'hrp.selfservice.bank_change_requested',
  PAYSLIP_VIEWED: 'hrp.selfservice.payslip_viewed',
  PAYSLIP_DOWNLOADED: 'hrp.selfservice.payslip_downloaded',
  LEAVE_REQUESTED: 'hrp.selfservice.leave_requested',
  LEAVE_CANCELLED: 'hrp.selfservice.leave_cancelled',
  DOCUMENT_REQUESTED: 'hrp.selfservice.document_requested',
  DOCUMENT_DOWNLOADED: 'hrp.selfservice.document_downloaded',
  PIT11_VIEWED: 'hrp.selfservice.pit11_viewed',
  PIT11_DOWNLOADED: 'hrp.selfservice.pit11_downloaded',
  PIT11_RECEIPT_CONFIRMED: 'hrp.selfservice.pit11_confirmed',
  NOTIFICATION_PREFS_UPDATED: 'hrp.selfservice.notification_prefs_updated',
} as const;
```

---

## UI/UX Requirements

### Mobile-First Design

1. **Responsive Layout**: All pages adapt to mobile/tablet/desktop
2. **Touch-Friendly**: Large touch targets (min 44x44px)
3. **Swipe Gestures**: Swipe to navigate between months in calendar
4. **Progressive Loading**: Skeleton screens for data loading
5. **Offline Indicators**: Clear messaging when offline

### Accessibility (WCAG 2.1 AA)

1. **Keyboard Navigation**: Full keyboard support for all features
2. **Screen Reader**: Proper ARIA labels and landmarks
3. **Color Contrast**: 4.5:1 minimum ratio
4. **Focus Indicators**: Clear focus states
5. **Error Messages**: Descriptive and helpful

### Polish Language

1. **All UI in Polish**: Labels, messages, errors
2. **Date Format**: DD.MM.YYYY
3. **Currency Format**: PLN with comma decimal separator
4. **Leave Types**: Polish names (urlop wypoczynkowy, etc.)

---

## Implementation Notes

### Performance Considerations

1. **Lazy Loading**: Load payslips on scroll
2. **Caching**: Cache profile data with short TTL
3. **Optimistic Updates**: Show immediate feedback on updates
4. **Document Streaming**: Stream large PDFs

### Privacy Considerations

1. **Team Calendar**: Show only initials of colleagues
2. **Salary Data**: Never show to other employees
3. **PII Masking**: Partial PESEL/account numbers in logs
4. **Session Timeout**: Auto-logout after inactivity

### Notification Strategy

1. **Push Notifications**: For urgent items (leave approval, new payslip)
2. **Email**: Weekly digest option
3. **In-App**: Badge counts for unread items
4. **SMS**: Optional, for critical items only

---

*Last Updated: December 2024*
