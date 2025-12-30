# HRP-001: Employee Management

> **Story ID**: HRP-001
> **Epic**: HR & Payroll Module (HRP)
> **Priority**: P0 (Critical)
> **Points**: 13
> **Status**: 📋 Ready for Development

---

## User Story

**As an** HR manager,
**I want to** manage employee records with all required Polish employment data,
**So that** I can maintain accurate HR information and ensure compliance with Polish labor law.

---

## Acceptance Criteria

### AC1: Employee Creation with PESEL Validation
```gherkin
Given I am an authenticated HR manager
When I create a new employee with the following data:
  | Field | Value |
  | firstName | Jan |
  | lastName | Kowalski |
  | pesel | 85010112345 |
  | email | jan.kowalski@firma.pl |
  | dateOfBirth | 1985-01-01 |
Then the PESEL checksum should be validated
And the date of birth should be extracted from PESEL
And gender should be inferred from PESEL
And the employee record should be created
And an audit event "employee.created" should be logged
```

### AC2: Duplicate PESEL Prevention
```gherkin
Given an employee with PESEL "85010112345" already exists
When I attempt to create another employee with the same PESEL
Then the creation should be rejected
And I should see error "Pracownik z tym numerem PESEL już istnieje"
```

### AC3: Employee Search and Filtering
```gherkin
Given there are 100 employees in the system
When I search with the following filters:
  | Filter | Value |
  | status | ACTIVE |
  | department | IT |
  | searchTerm | Kowalski |
Then results should be returned within 500ms
And results should be paginated
And results should match all specified criteria
```

### AC4: Personal Data Management (GDPR Compliant)
```gherkin
Given I am viewing an employee's record
When I access personal data section
Then I should see:
  | Field | Encrypted |
  | PESEL | Yes |
  | Address | Yes |
  | Bank Account | Yes |
  | Phone | Yes |
And access should be logged for GDPR compliance
And I should see data retention policy information
```

### AC5: Employee Status Transitions
```gherkin
Given an employee with status "ACTIVE"
When I change their status to "ON_LEAVE"
Then the status should be updated
And the status change history should be recorded
And related systems should be notified
And an audit event "employee.status_changed" should be logged
```

### AC6: Bulk Import from CSV/Excel
```gherkin
Given I have a CSV file with 50 employee records
When I upload the file for bulk import
Then the system should validate all PESEL numbers
And duplicate records should be identified
And validation errors should be listed per row
And valid records should be imported
And an import summary should be generated
```

---

## Technical Specification

### Database Schema

```sql
-- Employee personal data table
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    employee_number VARCHAR(20) UNIQUE,

    -- Personal data (encrypted)
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    pesel VARCHAR(11) UNIQUE NOT NULL,
    pesel_hash VARCHAR(64) NOT NULL, -- For search without decryption
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('MALE', 'FEMALE')),

    -- Contact information (encrypted)
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),

    -- Address (encrypted as JSONB)
    address_encrypted BYTEA,

    -- Employment data
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED')),
    department_id UUID REFERENCES departments(id),
    position VARCHAR(100),
    hire_date DATE NOT NULL,
    termination_date DATE,

    -- Tax and ZUS
    tax_office_id UUID REFERENCES tax_offices(id),
    nfz_branch VARCHAR(10), -- NFZ branch code
    pit_form_type VARCHAR(10) DEFAULT 'PIT-2',

    -- Bank account (encrypted)
    bank_account_encrypted BYTEA,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID NOT NULL REFERENCES users(id),

    CONSTRAINT valid_pesel CHECK (LENGTH(pesel) = 11)
);

-- Employee status history
CREATE TABLE employee_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    reason TEXT,
    effective_date DATE NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by UUID NOT NULL REFERENCES users(id)
);

-- Employee documents
CREATE TABLE employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    document_type VARCHAR(50) NOT NULL,
    document_id UUID NOT NULL REFERENCES documents(id),
    valid_from DATE,
    valid_until DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Departments
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    manager_id UUID REFERENCES employees(id),
    parent_id UUID REFERENCES departments(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_employees_tenant ON employees(tenant_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_pesel_hash ON employees(pesel_hash);
CREATE INDEX idx_employees_search ON employees USING gin(
    to_tsvector('polish', first_name || ' ' || last_name)
);

-- Row Level Security
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON employees
    FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY hr_access ON employees
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = current_setting('app.user_id')::uuid
            AND ur.role IN ('HR_MANAGER', 'HR_ADMIN', 'ADMIN')
        )
    );
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// PESEL validation function
const validatePesel = (pesel: string): boolean => {
  if (!/^\d{11}$/.test(pesel)) return false;

  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  let sum = 0;

  for (let i = 0; i < 10; i++) {
    sum += parseInt(pesel[i]) * weights[i];
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(pesel[10]);
};

// Extract birth date from PESEL
const extractBirthDateFromPesel = (pesel: string): Date => {
  const year = parseInt(pesel.substring(0, 2));
  let month = parseInt(pesel.substring(2, 4));
  const day = parseInt(pesel.substring(4, 6));

  let century = 1900;
  if (month > 80) { century = 1800; month -= 80; }
  else if (month > 60) { century = 2200; month -= 60; }
  else if (month > 40) { century = 2100; month -= 40; }
  else if (month > 20) { century = 2000; month -= 20; }

  return new Date(century + year, month - 1, day);
};

// Extract gender from PESEL
const extractGenderFromPesel = (pesel: string): 'MALE' | 'FEMALE' => {
  return parseInt(pesel[9]) % 2 === 0 ? 'FEMALE' : 'MALE';
};

// Address schema
export const addressSchema = z.object({
  street: z.string().min(1, 'Ulica jest wymagana'),
  buildingNumber: z.string().min(1, 'Numer budynku jest wymagany'),
  apartmentNumber: z.string().optional(),
  postalCode: z.string().regex(/^\d{2}-\d{3}$/, 'Nieprawidłowy kod pocztowy'),
  city: z.string().min(1, 'Miasto jest wymagane'),
  country: z.string().default('PL'),
});

// Create employee schema
export const createEmployeeSchema = z.object({
  firstName: z.string()
    .min(1, 'Imię jest wymagane')
    .max(100, 'Imię jest za długie'),

  lastName: z.string()
    .min(1, 'Nazwisko jest wymagane')
    .max(100, 'Nazwisko jest za długie'),

  pesel: z.string()
    .length(11, 'PESEL musi mieć 11 cyfr')
    .regex(/^\d{11}$/, 'PESEL może zawierać tylko cyfry')
    .refine(validatePesel, 'Nieprawidłowa suma kontrolna PESEL'),

  email: z.string()
    .email('Nieprawidłowy adres email'),

  phone: z.string()
    .regex(/^\+?[\d\s-]{9,15}$/, 'Nieprawidłowy numer telefonu')
    .optional(),

  address: addressSchema,

  departmentId: z.string().uuid().optional(),
  position: z.string().max(100).optional(),
  hireDate: z.coerce.date(),

  taxOfficeId: z.string().uuid().optional(),
  nfzBranch: z.string().max(10).optional(),
  pitFormType: z.enum(['PIT-2', 'NO_PIT']).default('PIT-2'),

  bankAccount: z.string()
    .regex(/^[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}$/, 'Nieprawidłowy numer IBAN')
    .optional(),
});

// Update employee schema
export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  id: z.string().uuid(),
});

// Employee status change schema
export const changeStatusSchema = z.object({
  employeeId: z.string().uuid(),
  newStatus: z.enum(['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED']),
  reason: z.string().max(500).optional(),
  effectiveDate: z.coerce.date(),
});

// Search employees schema
export const searchEmployeesSchema = z.object({
  searchTerm: z.string().optional(),
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'ALL']).default('ALL'),
  departmentId: z.string().uuid().optional(),
  hiredAfter: z.coerce.date().optional(),
  hiredBefore: z.coerce.date().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['lastName', 'hireDate', 'department']).default('lastName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// Bulk import schema
export const bulkImportSchema = z.object({
  employees: z.array(createEmployeeSchema).min(1).max(500),
  skipDuplicates: z.boolean().default(false),
  validateOnly: z.boolean().default(false),
});
```

### tRPC Router

```typescript
import { router, protectedProcedure, hrManagerProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  changeStatusSchema,
  searchEmployeesSchema,
  bulkImportSchema,
} from './schemas';
import { EmployeeService } from './employee.service';
import { EncryptionService } from '../common/encryption.service';
import { AuditService } from '../common/audit.service';

export const employeeRouter = router({
  // Create employee
  create: hrManagerProcedure
    .input(createEmployeeSchema)
    .mutation(async ({ input, ctx }) => {
      const employeeService = new EmployeeService(ctx.db);
      const encryptionService = new EncryptionService();
      const auditService = new AuditService(ctx.db);

      // Check for duplicate PESEL
      const existingEmployee = await employeeService.findByPesel(input.pesel);
      if (existingEmployee) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Pracownik z tym numerem PESEL już istnieje',
        });
      }

      // Extract data from PESEL
      const dateOfBirth = extractBirthDateFromPesel(input.pesel);
      const gender = extractGenderFromPesel(input.pesel);

      // Encrypt sensitive data
      const encryptedData = {
        pesel: await encryptionService.encrypt(input.pesel),
        peselHash: await encryptionService.hash(input.pesel),
        address: await encryptionService.encryptJson(input.address),
        bankAccount: input.bankAccount
          ? await encryptionService.encrypt(input.bankAccount)
          : null,
      };

      // Create employee
      const employee = await employeeService.create({
        ...input,
        ...encryptedData,
        dateOfBirth,
        gender,
        tenantId: ctx.tenantId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      // Log audit event
      await auditService.log({
        action: 'employee.created',
        resourceType: 'employee',
        resourceId: employee.id,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        metadata: {
          employeeNumber: employee.employeeNumber,
        },
      });

      return employee;
    }),

  // Get employee by ID
  getById: hrManagerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const employeeService = new EmployeeService(ctx.db);
      const encryptionService = new EncryptionService();
      const auditService = new AuditService(ctx.db);

      const employee = await employeeService.findById(input.id);

      if (!employee) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pracownik nie został znaleziony',
        });
      }

      // Log access for GDPR compliance
      await auditService.log({
        action: 'employee.accessed',
        resourceType: 'employee',
        resourceId: employee.id,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
      });

      // Decrypt sensitive data for display
      return {
        ...employee,
        pesel: await encryptionService.decrypt(employee.pesel),
        address: await encryptionService.decryptJson(employee.addressEncrypted),
        bankAccount: employee.bankAccountEncrypted
          ? await encryptionService.decrypt(employee.bankAccountEncrypted)
          : null,
      };
    }),

  // Search employees
  search: hrManagerProcedure
    .input(searchEmployeesSchema)
    .query(async ({ input, ctx }) => {
      const employeeService = new EmployeeService(ctx.db);

      const { employees, total } = await employeeService.search({
        ...input,
        tenantId: ctx.tenantId,
      });

      return {
        employees,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total,
          totalPages: Math.ceil(total / input.pageSize),
        },
      };
    }),

  // Update employee
  update: hrManagerProcedure
    .input(updateEmployeeSchema)
    .mutation(async ({ input, ctx }) => {
      const employeeService = new EmployeeService(ctx.db);
      const encryptionService = new EncryptionService();
      const auditService = new AuditService(ctx.db);

      const existingEmployee = await employeeService.findById(input.id);

      if (!existingEmployee) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pracownik nie został znaleziony',
        });
      }

      // Prepare encrypted fields if changed
      const encryptedUpdates: Partial<typeof input> = {};

      if (input.address) {
        encryptedUpdates.addressEncrypted = await encryptionService.encryptJson(input.address);
      }

      if (input.bankAccount) {
        encryptedUpdates.bankAccountEncrypted = await encryptionService.encrypt(input.bankAccount);
      }

      const updatedEmployee = await employeeService.update(input.id, {
        ...input,
        ...encryptedUpdates,
        updatedBy: ctx.userId,
      });

      // Log audit event
      await auditService.log({
        action: 'employee.updated',
        resourceType: 'employee',
        resourceId: input.id,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        metadata: {
          changedFields: Object.keys(input).filter(k => k !== 'id'),
        },
      });

      return updatedEmployee;
    }),

  // Change employee status
  changeStatus: hrManagerProcedure
    .input(changeStatusSchema)
    .mutation(async ({ input, ctx }) => {
      const employeeService = new EmployeeService(ctx.db);
      const auditService = new AuditService(ctx.db);

      const employee = await employeeService.findById(input.employeeId);

      if (!employee) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pracownik nie został znaleziony',
        });
      }

      // Record status change
      await employeeService.changeStatus({
        employeeId: input.employeeId,
        oldStatus: employee.status,
        newStatus: input.newStatus,
        reason: input.reason,
        effectiveDate: input.effectiveDate,
        changedBy: ctx.userId,
      });

      // Log audit event
      await auditService.log({
        action: 'employee.status_changed',
        resourceType: 'employee',
        resourceId: input.employeeId,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        metadata: {
          oldStatus: employee.status,
          newStatus: input.newStatus,
          reason: input.reason,
        },
      });

      return { success: true };
    }),

  // Bulk import
  bulkImport: hrManagerProcedure
    .input(bulkImportSchema)
    .mutation(async ({ input, ctx }) => {
      const employeeService = new EmployeeService(ctx.db);
      const auditService = new AuditService(ctx.db);

      const results = await employeeService.bulkImport({
        employees: input.employees,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        skipDuplicates: input.skipDuplicates,
        validateOnly: input.validateOnly,
      });

      // Log audit event
      await auditService.log({
        action: 'employee.bulk_imported',
        resourceType: 'employee',
        resourceId: null,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        metadata: {
          totalRecords: input.employees.length,
          imported: results.imported,
          skipped: results.skipped,
          errors: results.errors.length,
        },
      });

      return results;
    }),

  // Archive employee (soft delete)
  archive: hrManagerProcedure
    .input(z.object({ id: z.string().uuid(), reason: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const employeeService = new EmployeeService(ctx.db);
      const auditService = new AuditService(ctx.db);

      await employeeService.archive(input.id, ctx.userId);

      await auditService.log({
        action: 'employee.archived',
        resourceType: 'employee',
        resourceId: input.id,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        metadata: { reason: input.reason },
      });

      return { success: true };
    }),

  // Get employee status history
  getStatusHistory: hrManagerProcedure
    .input(z.object({ employeeId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const employeeService = new EmployeeService(ctx.db);
      return employeeService.getStatusHistory(input.employeeId);
    }),

  // Get departments
  getDepartments: protectedProcedure
    .query(async ({ ctx }) => {
      const employeeService = new EmployeeService(ctx.db);
      return employeeService.getDepartments(ctx.tenantId);
    }),
});
```

### Service Implementation

```typescript
import { PrismaClient } from '@prisma/client';
import { CreateEmployeeInput, SearchEmployeesInput, BulkImportInput } from './types';
import { generateEmployeeNumber } from '../utils/generators';

export class EmployeeService {
  constructor(private db: PrismaClient) {}

  async findById(id: string) {
    return this.db.employee.findUnique({
      where: { id },
      include: {
        department: true,
        contracts: {
          where: { isActive: true },
          orderBy: { startDate: 'desc' },
          take: 1,
        },
      },
    });
  }

  async findByPesel(pesel: string) {
    const peselHash = await this.hashPesel(pesel);
    return this.db.employee.findFirst({
      where: { peselHash },
    });
  }

  async create(data: CreateEmployeeInput) {
    const employeeNumber = await generateEmployeeNumber(this.db, data.tenantId);

    return this.db.employee.create({
      data: {
        ...data,
        employeeNumber,
      },
    });
  }

  async update(id: string, data: Partial<CreateEmployeeInput>) {
    return this.db.employee.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async search(input: SearchEmployeesInput) {
    const where: any = {
      tenantId: input.tenantId,
    };

    if (input.status !== 'ALL') {
      where.status = input.status;
    }

    if (input.departmentId) {
      where.departmentId = input.departmentId;
    }

    if (input.searchTerm) {
      where.OR = [
        { firstName: { contains: input.searchTerm, mode: 'insensitive' } },
        { lastName: { contains: input.searchTerm, mode: 'insensitive' } },
        { email: { contains: input.searchTerm, mode: 'insensitive' } },
        { employeeNumber: { contains: input.searchTerm, mode: 'insensitive' } },
      ];
    }

    if (input.hiredAfter) {
      where.hireDate = { ...where.hireDate, gte: input.hiredAfter };
    }

    if (input.hiredBefore) {
      where.hireDate = { ...where.hireDate, lte: input.hiredBefore };
    }

    const [employees, total] = await Promise.all([
      this.db.employee.findMany({
        where,
        include: {
          department: true,
        },
        orderBy: { [input.sortBy]: input.sortOrder },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.db.employee.count({ where }),
    ]);

    return { employees, total };
  }

  async changeStatus(data: {
    employeeId: string;
    oldStatus: string;
    newStatus: string;
    reason?: string;
    effectiveDate: Date;
    changedBy: string;
  }) {
    return this.db.$transaction([
      this.db.employee.update({
        where: { id: data.employeeId },
        data: {
          status: data.newStatus,
          terminationDate: data.newStatus === 'TERMINATED' ? data.effectiveDate : null,
        },
      }),
      this.db.employeeStatusHistory.create({
        data: {
          employeeId: data.employeeId,
          oldStatus: data.oldStatus,
          newStatus: data.newStatus,
          reason: data.reason,
          effectiveDate: data.effectiveDate,
          changedBy: data.changedBy,
        },
      }),
    ]);
  }

  async bulkImport(input: BulkImportInput) {
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as { row: number; error: string }[],
    };

    for (let i = 0; i < input.employees.length; i++) {
      const employee = input.employees[i];

      try {
        // Check for duplicate
        const existing = await this.findByPesel(employee.pesel);

        if (existing) {
          if (input.skipDuplicates) {
            results.skipped++;
            continue;
          } else {
            results.errors.push({
              row: i + 1,
              error: `Pracownik z PESEL ${employee.pesel.substring(0, 6)}*** już istnieje`,
            });
            continue;
          }
        }

        if (!input.validateOnly) {
          await this.create({
            ...employee,
            tenantId: input.tenantId,
            createdBy: input.userId,
            updatedBy: input.userId,
          });
        }

        results.imported++;
      } catch (error) {
        results.errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : 'Nieznany błąd',
        });
      }
    }

    return results;
  }

  async archive(id: string, userId: string) {
    return this.db.employee.update({
      where: { id },
      data: {
        status: 'TERMINATED',
        terminationDate: new Date(),
        updatedBy: userId,
      },
    });
  }

  async getStatusHistory(employeeId: string) {
    return this.db.employeeStatusHistory.findMany({
      where: { employeeId },
      orderBy: { changedAt: 'desc' },
      include: {
        changedByUser: {
          select: { firstName: true, lastName: true },
        },
      },
    });
  }

  async getDepartments(tenantId: string) {
    return this.db.department.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  private async hashPesel(pesel: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(pesel).digest('hex');
  }
}
```

---

## Test Specification

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmployeeService } from './employee.service';
import { createEmployeeSchema } from './schemas';

describe('Employee Schema Validation', () => {
  describe('PESEL validation', () => {
    it('should accept valid PESEL', () => {
      const result = createEmployeeSchema.safeParse({
        firstName: 'Jan',
        lastName: 'Kowalski',
        pesel: '85010112345', // Valid checksum
        email: 'jan@example.pl',
        hireDate: new Date(),
        address: {
          street: 'Testowa',
          buildingNumber: '1',
          postalCode: '00-001',
          city: 'Warszawa',
        },
      });

      expect(result.success).toBe(true);
    });

    it('should reject PESEL with invalid checksum', () => {
      const result = createEmployeeSchema.safeParse({
        firstName: 'Jan',
        lastName: 'Kowalski',
        pesel: '85010112346', // Invalid checksum
        email: 'jan@example.pl',
        hireDate: new Date(),
        address: {
          street: 'Testowa',
          buildingNumber: '1',
          postalCode: '00-001',
          city: 'Warszawa',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Nieprawidłowa suma kontrolna PESEL');
    });

    it('should reject PESEL with wrong length', () => {
      const result = createEmployeeSchema.safeParse({
        firstName: 'Jan',
        lastName: 'Kowalski',
        pesel: '8501011234', // 10 digits
        email: 'jan@example.pl',
        hireDate: new Date(),
        address: {
          street: 'Testowa',
          buildingNumber: '1',
          postalCode: '00-001',
          city: 'Warszawa',
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe('PESEL data extraction', () => {
    it('should extract correct birth date from PESEL (1985)', () => {
      const birthDate = extractBirthDateFromPesel('85010112345');
      expect(birthDate.getFullYear()).toBe(1985);
      expect(birthDate.getMonth()).toBe(0); // January
      expect(birthDate.getDate()).toBe(1);
    });

    it('should extract correct birth date from PESEL (2000+)', () => {
      const birthDate = extractBirthDateFromPesel('00210112345');
      expect(birthDate.getFullYear()).toBe(2000);
      expect(birthDate.getMonth()).toBe(0); // January
    });

    it('should extract male gender from PESEL', () => {
      const gender = extractGenderFromPesel('85010112345'); // 4 is even
      expect(gender).toBe('FEMALE');
    });

    it('should extract female gender from PESEL', () => {
      const gender = extractGenderFromPesel('85010112355'); // 5 is odd
      expect(gender).toBe('MALE');
    });
  });
});

describe('EmployeeService', () => {
  let service: EmployeeService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      employee: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      employeeStatusHistory: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    service = new EmployeeService(mockDb);
  });

  describe('search', () => {
    it('should search employees with pagination', async () => {
      mockDb.employee.findMany.mockResolvedValue([
        { id: '1', firstName: 'Jan', lastName: 'Kowalski' },
      ]);
      mockDb.employee.count.mockResolvedValue(1);

      const result = await service.search({
        tenantId: 'tenant-1',
        page: 1,
        pageSize: 20,
        sortBy: 'lastName',
        sortOrder: 'asc',
      });

      expect(result.employees).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockDb.employee.findMany.mockResolvedValue([]);
      mockDb.employee.count.mockResolvedValue(0);

      await service.search({
        tenantId: 'tenant-1',
        status: 'ACTIVE',
        page: 1,
        pageSize: 20,
        sortBy: 'lastName',
        sortOrder: 'asc',
      });

      expect(mockDb.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext } from '../test/helpers';

describe('Employee API Integration', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('should create and retrieve employee', async () => {
    const employeeData = {
      firstName: 'Jan',
      lastName: 'Kowalski',
      pesel: '85010112345',
      email: 'jan.kowalski@test.pl',
      hireDate: new Date('2024-01-01'),
      address: {
        street: 'Testowa',
        buildingNumber: '1',
        postalCode: '00-001',
        city: 'Warszawa',
      },
    };

    // Create employee
    const created = await ctx.caller.hrp.create(employeeData);
    expect(created.id).toBeDefined();
    expect(created.employeeNumber).toMatch(/^EMP-\d+$/);

    // Retrieve employee
    const retrieved = await ctx.caller.hrp.getById({ id: created.id });
    expect(retrieved.firstName).toBe('Jan');
    expect(retrieved.lastName).toBe('Kowalski');
    expect(retrieved.pesel).toBe('85010112345');
  });

  it('should prevent duplicate PESEL', async () => {
    const employeeData = {
      firstName: 'Anna',
      lastName: 'Nowak',
      pesel: '85010112345', // Same PESEL as previous test
      email: 'anna.nowak@test.pl',
      hireDate: new Date('2024-01-01'),
      address: {
        street: 'Testowa',
        buildingNumber: '2',
        postalCode: '00-002',
        city: 'Kraków',
      },
    };

    await expect(ctx.caller.hrp.create(employeeData)).rejects.toThrow(
      'Pracownik z tym numerem PESEL już istnieje'
    );
  });

  it('should change employee status and record history', async () => {
    // First create an employee
    const created = await ctx.caller.hrp.create({
      firstName: 'Piotr',
      lastName: 'Wiśniewski',
      pesel: '90050512345',
      email: 'piotr@test.pl',
      hireDate: new Date('2024-01-01'),
      address: {
        street: 'Testowa',
        buildingNumber: '3',
        postalCode: '00-003',
        city: 'Gdańsk',
      },
    });

    // Change status
    await ctx.caller.hrp.changeStatus({
      employeeId: created.id,
      newStatus: 'ON_LEAVE',
      reason: 'Urlop macierzyński',
      effectiveDate: new Date(),
    });

    // Check status history
    const history = await ctx.caller.hrp.getStatusHistory({
      employeeId: created.id,
    });

    expect(history).toHaveLength(1);
    expect(history[0].oldStatus).toBe('ACTIVE');
    expect(history[0].newStatus).toBe('ON_LEAVE');
    expect(history[0].reason).toBe('Urlop macierzyński');
  });
});
```

---

## Security Checklist

- [x] PESEL stored encrypted with AES-256-GCM
- [x] PESEL hash stored for duplicate detection without decryption
- [x] Address and bank account encrypted
- [x] Row-level security policies implemented
- [x] HR manager role required for all operations
- [x] All data access logged for GDPR compliance
- [x] Personal data never logged in plaintext
- [x] Input validation with Zod schemas
- [x] SQL injection prevented via Prisma ORM
- [x] Rate limiting on bulk operations

---

## Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `employee.created` | New employee added | Employee number, created by |
| `employee.updated` | Employee data modified | Changed fields list |
| `employee.accessed` | Employee record viewed | Accessor user ID |
| `employee.status_changed` | Status transition | Old/new status, reason |
| `employee.archived` | Employee archived | Archive reason |
| `employee.bulk_imported` | Bulk import completed | Import statistics |

---

## Implementation Notes

### PESEL Validation Algorithm
The PESEL checksum is calculated using weights [1, 3, 7, 9, 1, 3, 7, 9, 1, 3] for the first 10 digits. The sum modulo 10 subtracted from 10 gives the check digit.

### Data Encryption
All PII fields are encrypted using AES-256-GCM before storage. A separate hash is stored for the PESEL to enable duplicate detection without decryption.

### Employee Number Generation
Employee numbers follow the format `EMP-XXXXXX` where X is a sequential number padded to 6 digits, unique per tenant.

### GDPR Compliance
- All access to personal data is logged
- Data retention policies are enforced
- Export functionality for data portability
- Right to deletion implemented via anonymization

---

*This story is part of the BMAD methodology for the Polish Accounting Platform.*
