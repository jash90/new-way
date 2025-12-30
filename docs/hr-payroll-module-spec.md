# Module 8: HR & Payroll Module - Complete Technical Specification

## A. Module Overview
- **Purpose**: Complete HR and payroll management system with Polish labor law compliance
- **Scope**: Employee management, contract generation, payroll calculation, ZUS integration, leave management, onboarding/offboarding
- **Dependencies**: Client module, Document module, Integration module (ZUS), Notification module
- **Consumers**: Portal module, Reporting module, Mobile app, Accounting module

## B. Technical Specification

### 1. Technology Stack
- **Primary Framework**: NestJS with TypeScript for service layer
- **Database**: PostgreSQL for relational data (employees, contracts, payroll)
- **Caching**: Redis for payroll calculations cache and tax tables
- **Security**: JWT authentication, role-based access control, data encryption at rest
- **Document Generation**: PDFKit for contract and payslip generation
- **Queue System**: Bull/Redis for async payroll processing
- **External Integrations**: ZUS API, NBP API (exchange rates), tax office integration

### 2. Key Interfaces

```typescript
// Main service interfaces
interface IHRService {
  // Employee Management
  createEmployee(data: CreateEmployeeDTO): Promise<Employee>
  updateEmployee(id: string, data: UpdateEmployeeDTO): Promise<Employee>
  getEmployee(id: string): Promise<Employee>
  listEmployees(filters: EmployeeFilters): Promise<PaginatedResult<Employee>>
  terminateEmployee(id: string, data: TerminationDTO): Promise<TerminationResult>
  
  // Contract Management
  generateContract(data: ContractGenerationDTO): Promise<Contract>
  updateContract(id: string, data: UpdateContractDTO): Promise<Contract>
  renewContract(id: string, data: RenewalDTO): Promise<Contract>
  
  // Leave Management
  requestLeave(data: LeaveRequestDTO): Promise<LeaveRequest>
  approveLeave(id: string, approver: string): Promise<LeaveApproval>
  getLeaveBalance(employeeId: string): Promise<LeaveBalance>
}

interface IPayrollService {
  calculateSalary(employee: Employee, period: PayrollPeriod): Promise<PayrollCalculation>
  processPayroll(period: PayrollPeriod): Promise<PayrollBatch>
  generatePayslips(batchId: string): Promise<Payslip[]>
  submitZUSDeclaration(declaration: ZUSDeclarationDTO): Promise<ZUSSubmissionResult>
  calculateYearEndTax(employeeId: string, year: number): Promise<TaxCalculation>
}

// Data Transfer Objects
interface CreateEmployeeDTO {
  personalData: {
    firstName: string
    lastName: string
    pesel: string
    nip?: string
    dateOfBirth: Date
    nationalIdNumber: string
    passportNumber?: string
  }
  contactData: {
    email: string
    phone: string
    address: Address
    emergencyContact: EmergencyContact
  }
  employmentData: {
    position: string
    department: string
    startDate: Date
    contractType: ContractType
    salary: Money
    workingHours: number
    manager?: string
  }
  bankAccount: {
    accountNumber: string
    bankName: string
    swift?: string
  }
  taxData: {
    taxOffice: string
    taxScale: TaxScale
    taxRelief: TaxRelief[]
  }
}

interface PayrollCalculation {
  employeeId: string
  period: PayrollPeriod
  gross: Money
  
  socialSecurity: {
    retirement: Money      // Emerytalne 9.76%
    disability: Money      // Rentowe 1.5%
    sickness: Money        // Chorobowe 2.45%
    accident: Money        // Wypadkowe (variable)
    laborFund: Money       // Fundusz Pracy 2.45%
    total: Money
  }
  
  healthInsurance: {
    contribution: Money    // 9%
    deductible: Money      // 7.75%
  }
  
  tax: {
    base: Money
    rate: number
    amount: Money
    relief: Money
    advance: Money
  }
  
  deductions: Deduction[]
  additions: Addition[]
  net: Money
  
  employerCosts: {
    socialSecurity: Money
    total: Money
  }
}

// Event interfaces
interface PayrollEvent {
  id: string
  type: 'PAYROLL_CALCULATED' | 'PAYROLL_APPROVED' | 'PAYROLL_PAID'
  timestamp: Date
  correlationId: string
  payload: any
}

interface EmployeeEvent {
  id: string
  type: 'EMPLOYEE_CREATED' | 'EMPLOYEE_UPDATED' | 'EMPLOYEE_TERMINATED'
  employeeId: string
  timestamp: Date
  changes?: any
  actor: string
}

// Configuration interface
interface HRModuleConfig {
  payroll: {
    defaultCurrency: string
    processingDay: number
    paymentDay: number
    overtimeMultiplier: number
    nightShiftBonus: number
    weekendBonus: number
  }
  
  zus: {
    apiUrl: string
    apiKey: string
    certificatePath: string
    retryAttempts: number
    timeout: number
  }
  
  leave: {
    annualDays: number
    sickLeaveDays: number
    parentalLeaveDays: number
    carryOverMaxDays: number
  }
  
  documents: {
    contractTemplatePath: string
    payslipTemplatePath: string
    storageBasePath: string
  }
}
```

### 3. API Endpoints

```typescript
// Employee Management
GET    /api/v1/employees                    // List all employees with pagination
GET    /api/v1/employees/:id                // Get employee details
POST   /api/v1/employees                    // Create new employee
PUT    /api/v1/employees/:id                // Update employee
DELETE /api/v1/employees/:id                // Soft delete employee
POST   /api/v1/employees/:id/terminate      // Terminate employment

// Contract Management
GET    /api/v1/contracts                    // List contracts
GET    /api/v1/contracts/:id                // Get contract details
POST   /api/v1/contracts                    // Create contract
PUT    /api/v1/contracts/:id                // Update contract
POST   /api/v1/contracts/:id/renew          // Renew contract
GET    /api/v1/contracts/:id/download       // Download PDF

// Payroll Processing
GET    /api/v1/payroll/periods              // List payroll periods
POST   /api/v1/payroll/calculate            // Calculate payroll for period
POST   /api/v1/payroll/approve              // Approve payroll batch
POST   /api/v1/payroll/process              // Process approved payroll
GET    /api/v1/payroll/:id/summary          // Get payroll summary
GET    /api/v1/payroll/payslips/:id         // Get payslip

// Leave Management
GET    /api/v1/leaves                       // List leave requests
POST   /api/v1/leaves                       // Create leave request
PUT    /api/v1/leaves/:id/approve           // Approve leave
PUT    /api/v1/leaves/:id/reject            // Reject leave
GET    /api/v1/leaves/balance/:employeeId   // Get leave balance

// Reports
GET    /api/v1/reports/payroll/monthly      // Monthly payroll report
GET    /api/v1/reports/zus/declaration      // ZUS declaration report
GET    /api/v1/reports/tax/pit-11           // Annual tax report
```

## C. Implementation Details

### 1. Main Service Implementation

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheService } from './cache.service';
import { ZUSIntegrationService } from './integrations/zus.service';
import { DocumentGeneratorService } from './document-generator.service';
import { AuditService } from './audit.service';
import * as crypto from 'crypto';

@Injectable()
export class HRPayrollService implements IHRService, IPayrollService {
  private readonly logger = new Logger(HRPayrollService.name);
  
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(PayrollRecord)
    private readonly payrollRepository: Repository<PayrollRecord>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheService: CacheService,
    private readonly zusService: ZUSIntegrationService,
    private readonly documentGenerator: DocumentGeneratorService,
    private readonly auditService: AuditService,
    private readonly config: HRModuleConfig
  ) {}
  
  // Employee Management
  async createEmployee(data: CreateEmployeeDTO): Promise<Employee> {
    const correlationId = crypto.randomUUID();
    this.logger.log(`Creating employee with correlation ID: ${correlationId}`);
    
    // Start transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      // Validate PESEL
      if (!this.validatePESEL(data.personalData.pesel)) {
        throw new InvalidPESELException(data.personalData.pesel);
      }
      
      // Check for duplicate
      const existing = await this.employeeRepository.findOne({
        where: { pesel: data.personalData.pesel }
      });
      
      if (existing) {
        throw new DuplicateEmployeeException(data.personalData.pesel);
      }
      
      // Create employee entity
      const employee = new Employee();
      Object.assign(employee, {
        ...data.personalData,
        ...data.contactData,
        ...data.employmentData,
        id: crypto.randomUUID(),
        employeeCode: this.generateEmployeeCode(),
        status: EmployeeStatus.ACTIVE,
        createdAt: new Date(),
        createdBy: 'system' // Should come from auth context
      });
      
      // Save employee
      const savedEmployee = await queryRunner.manager.save(employee);
      
      // Create initial contract
      const contract = new Contract();
      Object.assign(contract, {
        id: crypto.randomUUID(),
        employeeId: savedEmployee.id,
        type: data.employmentData.contractType,
        startDate: data.employmentData.startDate,
        salary: data.employmentData.salary,
        position: data.employmentData.position,
        workingHours: data.employmentData.workingHours,
        status: ContractStatus.ACTIVE,
        createdAt: new Date()
      });
      
      await queryRunner.manager.save(contract);
      
      // Initialize leave balance
      await this.initializeLeaveBalance(savedEmployee.id, queryRunner);
      
      // Audit log
      await this.auditService.log({
        action: 'EMPLOYEE_CREATED',
        entityType: 'Employee',
        entityId: savedEmployee.id,
        changes: data,
        userId: 'system',
        correlationId
      });
      
      // Commit transaction
      await queryRunner.commitTransaction();
      
      // Publish event
      this.eventEmitter.emit('employee.created', {
        id: crypto.randomUUID(),
        type: 'EMPLOYEE_CREATED',
        employeeId: savedEmployee.id,
        timestamp: new Date(),
        correlationId,
        payload: savedEmployee
      });
      
      this.logger.log(`Employee created successfully: ${savedEmployee.id}`);
      return savedEmployee;
      
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create employee: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  
  // Payroll Calculation with Polish tax law
  async calculateSalary(
    employee: Employee, 
    period: PayrollPeriod
  ): Promise<PayrollCalculation> {
    this.logger.log(`Calculating salary for employee ${employee.id} for period ${period.month}/${period.year}`);
    
    // Check cache first
    const cacheKey = `payroll:${employee.id}:${period.year}:${period.month}`;
    const cached = await this.cacheService.get<PayrollCalculation>(cacheKey);
    if (cached) {
      this.logger.debug('Returning cached payroll calculation');
      return cached;
    }
    
    try {
      const gross = employee.salary;
      
      // Get ZUS rates for the period
      const zusRates = await this.getZUSRates(period);
      const zusCeiling = await this.getZUSCeiling(period);
      
      // Calculate ZUS base (limited by ceiling)
      const zusBase = Math.min(gross.amount, zusCeiling);
      
      // Calculate social security contributions (employee part)
      const socialSecurity = {
        retirement: this.roundMoney(zusBase * zusRates.retirement.employee), // 9.76%
        disability: this.roundMoney(zusBase * zusRates.disability.employee), // 1.5%
        sickness: this.roundMoney(gross.amount * zusRates.sickness),        // 2.45%
        accident: 0, // Paid by employer only
        laborFund: 0, // Paid by employer only
        total: 0
      };
      
      socialSecurity.total = Object.values(socialSecurity)
        .reduce((sum, val) => sum + val, 0);
      
      // Calculate health insurance base
      const healthBase = gross.amount - socialSecurity.total;
      
      // Calculate health insurance (NFZ)
      const healthInsurance = {
        contribution: this.roundMoney(healthBase * 0.09),    // 9%
        deductible: this.roundMoney(healthBase * 0.0775)     // 7.75% tax deductible
      };
      
      // Get employee's tax configuration
      const taxConfig = await this.getEmployeeTaxConfig(employee.id);
      
      // Calculate taxable income
      const taxableIncome = this.calculateTaxableIncome(
        gross.amount,
        socialSecurity.total,
        taxConfig.costs
      );
      
      // Calculate income tax
      const tax = await this.calculateIncomeTax(
        taxableIncome,
        taxConfig.scale,
        taxConfig.relief,
        healthInsurance.deductible,
        period
      );
      
      // Get additional deductions and additions
      const deductions = await this.getDeductions(employee.id, period);
      const additions = await this.getAdditions(employee.id, period);
      
      // Calculate net salary
      const totalDeductions = socialSecurity.total + 
                            healthInsurance.contribution + 
                            tax.advance +
                            deductions.reduce((sum, d) => sum + d.amount, 0);
      
      const totalAdditions = additions.reduce((sum, a) => sum + a.amount, 0);
      
      const net = gross.amount + totalAdditions - totalDeductions;
      
      // Calculate employer costs
      const employerCosts = this.calculateEmployerCosts(gross.amount, zusRates, period);
      
      const calculation: PayrollCalculation = {
        employeeId: employee.id,
        period,
        gross: { amount: gross.amount, currency: gross.currency },
        socialSecurity: {
          retirement: { amount: socialSecurity.retirement, currency: gross.currency },
          disability: { amount: socialSecurity.disability, currency: gross.currency },
          sickness: { amount: socialSecurity.sickness, currency: gross.currency },
          accident: { amount: 0, currency: gross.currency },
          laborFund: { amount: 0, currency: gross.currency },
          total: { amount: socialSecurity.total, currency: gross.currency }
        },
        healthInsurance: {
          contribution: { amount: healthInsurance.contribution, currency: gross.currency },
          deductible: { amount: healthInsurance.deductible, currency: gross.currency }
        },
        tax: {
          base: { amount: taxableIncome, currency: gross.currency },
          rate: tax.rate,
          amount: { amount: tax.amount, currency: gross.currency },
          relief: { amount: tax.relief, currency: gross.currency },
          advance: { amount: tax.advance, currency: gross.currency }
        },
        deductions,
        additions,
        net: { amount: net, currency: gross.currency },
        employerCosts
      };
      
      // Cache the calculation
      await this.cacheService.set(cacheKey, calculation, 3600); // 1 hour
      
      // Audit log
      await this.auditService.log({
        action: 'PAYROLL_CALCULATED',
        entityType: 'Payroll',
        entityId: employee.id,
        changes: { period, gross: gross.amount, net },
        userId: 'system'
      });
      
      return calculation;
      
    } catch (error) {
      this.logger.error(`Failed to calculate salary: ${error.message}`, error.stack);
      throw new PayrollCalculationException(employee.id, period, error.message);
    }
  }
  
  // Process entire payroll batch
  async processPayroll(period: PayrollPeriod): Promise<PayrollBatch> {
    const correlationId = crypto.randomUUID();
    this.logger.log(`Processing payroll for period ${period.month}/${period.year}, correlation ID: ${correlationId}`);
    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      // Check if payroll already processed
      const existing = await this.payrollRepository.findOne({
        where: { year: period.year, month: period.month, status: PayrollStatus.COMPLETED }
      });
      
      if (existing) {
        throw new PayrollAlreadyProcessedException(period);
      }
      
      // Get all active employees
      const employees = await this.employeeRepository.find({
        where: { status: EmployeeStatus.ACTIVE }
      });
      
      // Create payroll batch
      const batch = new PayrollBatch();
      batch.id = crypto.randomUUID();
      batch.period = period;
      batch.status = PayrollBatchStatus.PROCESSING;
      batch.createdAt = new Date();
      batch.totalEmployees = employees.length;
      batch.processedEmployees = 0;
      
      const savedBatch = await queryRunner.manager.save(batch);
      
      const calculations: PayrollCalculation[] = [];
      const errors: any[] = [];
      
      // Process each employee
      for (const employee of employees) {
        try {
          const calculation = await this.calculateSalary(employee, period);
          
          // Save payroll record
          const record = new PayrollRecord();
          Object.assign(record, {
            id: crypto.randomUUID(),
            batchId: savedBatch.id,
            employeeId: employee.id,
            period,
            calculation,
            status: PayrollRecordStatus.CALCULATED,
            createdAt: new Date()
          });
          
          await queryRunner.manager.save(record);
          calculations.push(calculation);
          
          savedBatch.processedEmployees++;
          
        } catch (error) {
          this.logger.error(`Failed to process payroll for employee ${employee.id}: ${error.message}`);
          errors.push({
            employeeId: employee.id,
            error: error.message
          });
        }
      }
      
      // Update batch status
      savedBatch.status = errors.length > 0 ? 
        PayrollBatchStatus.PARTIALLY_COMPLETED : 
        PayrollBatchStatus.COMPLETED;
      savedBatch.completedAt = new Date();
      savedBatch.errors = errors;
      
      await queryRunner.manager.save(savedBatch);
      
      // Generate ZUS declaration
      const zusDeclaration = await this.generateZUSDeclaration(calculations, period);
      await queryRunner.manager.save(zusDeclaration);
      
      // Commit transaction
      await queryRunner.commitTransaction();
      
      // Publish event
      this.eventEmitter.emit('payroll.processed', {
        id: crypto.randomUUID(),
        type: 'PAYROLL_PROCESSED',
        batchId: savedBatch.id,
        period,
        timestamp: new Date(),
        correlationId,
        summary: {
          totalEmployees: employees.length,
          processed: savedBatch.processedEmployees,
          errors: errors.length
        }
      });
      
      this.logger.log(`Payroll batch processed: ${savedBatch.id}`);
      return savedBatch;
      
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to process payroll: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  
  // Helper Methods
  private validatePESEL(pesel: string): boolean {
    if (!pesel || pesel.length !== 11) return false;
    
    const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
    let sum = 0;
    
    for (let i = 0; i < 10; i++) {
      sum += parseInt(pesel[i]) * weights[i];
    }
    
    const checksum = (10 - (sum % 10)) % 10;
    return checksum === parseInt(pesel[10]);
  }
  
  private generateEmployeeCode(): string {
    const prefix = 'EMP';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }
  
  private async getZUSRates(period: PayrollPeriod): Promise<ZUSRates> {
    const cacheKey = `zus-rates:${period.year}`;
    const cached = await this.cacheService.get<ZUSRates>(cacheKey);
    
    if (cached) return cached;
    
    // Default 2024 rates
    const rates: ZUSRates = {
      retirement: { employee: 0.0976, employer: 0.0976 },
      disability: { employee: 0.015, employer: 0.065 },
      sickness: 0.0245,
      accident: 0.0167, // Variable, using average
      laborFund: 0.0245,
      fgsp: 0.001
    };
    
    await this.cacheService.set(cacheKey, rates, 86400); // 24 hours
    return rates;
  }
  
  private async getZUSCeiling(period: PayrollPeriod): Promise<number> {
    // 30x average salary in Poland, updated yearly
    const year = period.year;
    const ceilings: Record<number, number> = {
      2024: 206700, // Example value
      2025: 216000
    };
    
    return ceilings[year] || ceilings[2024];
  }
  
  private roundMoney(amount: number): number {
    return Math.round(amount * 100) / 100;
  }
  
  private calculateTaxableIncome(
    gross: number, 
    socialSecurity: number, 
    costs: number
  ): number {
    return Math.max(0, gross - socialSecurity - costs);
  }
  
  private async calculateIncomeTax(
    taxableIncome: number,
    taxScale: TaxScale,
    relief: TaxRelief[],
    healthDeductible: number,
    period: PayrollPeriod
  ): Promise<TaxCalculation> {
    let tax = 0;
    let rate = 0;
    
    if (taxScale === TaxScale.PROGRESSIVE) {
      // Polish tax scale for 2024
      const threshold = 120000; // Annual threshold
      const monthlyThreshold = threshold / 12;
      
      if (taxableIncome <= monthlyThreshold) {
        rate = 0.12;
        tax = taxableIncome * rate;
      } else {
        rate = 0.32;
        tax = monthlyThreshold * 0.12 + (taxableIncome - monthlyThreshold) * 0.32;
      }
    } else {
      // Flat tax 19%
      rate = 0.19;
      tax = taxableIncome * rate;
    }
    
    // Apply relief
    let totalRelief = 0;
    for (const r of relief) {
      if (r.type === TaxReliefType.STANDARD) {
        totalRelief += 3600 / 12; // Monthly portion of annual relief
      }
      // Add other relief types
    }
    
    // Calculate advance payment
    const advance = Math.max(0, tax - totalRelief - healthDeductible);
    
    return {
      amount: this.roundMoney(tax),
      rate,
      relief: this.roundMoney(totalRelief),
      advance: this.roundMoney(advance)
    };
  }
  
  private calculateEmployerCosts(
    gross: number, 
    zusRates: ZUSRates,
    period: PayrollPeriod
  ): EmployerCosts {
    const zusCeiling = 206700 / 12; // Monthly ceiling
    const zusBase = Math.min(gross, zusCeiling);
    
    const costs = {
      retirement: this.roundMoney(zusBase * zusRates.retirement.employer),
      disability: this.roundMoney(zusBase * zusRates.disability.employer),
      accident: this.roundMoney(gross * zusRates.accident),
      laborFund: this.roundMoney(gross * zusRates.laborFund),
      fgsp: this.roundMoney(gross * zusRates.fgsp)
    };
    
    const total = Object.values(costs).reduce((sum, val) => sum + val, 0);
    
    return {
      socialSecurity: { amount: total, currency: 'PLN' },
      total: { amount: gross + total, currency: 'PLN' }
    };
  }
}

// Event Handlers
@Injectable()
export class PayrollEventHandlers {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly reportService: ReportService
  ) {}
  
  @OnEvent('payroll.processed')
  async handlePayrollProcessed(event: PayrollEvent) {
    // Send notifications
    await this.notificationService.notifyPayrollProcessed(event.payload);
    
    // Generate reports
    await this.reportService.generatePayrollReport(event.payload.batchId);
  }
  
  @OnEvent('employee.created')
  async handleEmployeeCreated(event: EmployeeEvent) {
    // Send welcome email
    await this.notificationService.sendWelcomeEmail(event.employeeId);
    
    // Create onboarding tasks
    await this.createOnboardingTasks(event.employeeId);
  }
}

// Custom Exceptions
export class HRPayrollException extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'HRPayrollException';
  }
}

export class InvalidPESELException extends HRPayrollException {
  constructor(pesel: string) {
    super(`Invalid PESEL number: ${pesel}`, 'INVALID_PESEL');
  }
}

export class DuplicateEmployeeException extends HRPayrollException {
  constructor(pesel: string) {
    super(`Employee with PESEL ${pesel} already exists`, 'DUPLICATE_EMPLOYEE');
  }
}

export class PayrollCalculationException extends HRPayrollException {
  constructor(employeeId: string, period: PayrollPeriod, details: string) {
    super(
      `Failed to calculate payroll for employee ${employeeId} for period ${period.month}/${period.year}: ${details}`,
      'PAYROLL_CALCULATION_FAILED'
    );
  }
}

export class PayrollAlreadyProcessedException extends HRPayrollException {
  constructor(period: PayrollPeriod) {
    super(
      `Payroll for period ${period.month}/${period.year} has already been processed`,
      'PAYROLL_ALREADY_PROCESSED'
    );
  }
}
```

## D. Database Schema

```sql
-- Employees table
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code VARCHAR(50) UNIQUE NOT NULL,
  
  -- Personal data
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  pesel VARCHAR(11) UNIQUE NOT NULL,
  nip VARCHAR(10),
  date_of_birth DATE NOT NULL,
  national_id_number VARCHAR(50),
  passport_number VARCHAR(50),
  
  -- Contact data
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  address_street VARCHAR(255),
  address_city VARCHAR(100),
  address_postal_code VARCHAR(20),
  address_country VARCHAR(2) DEFAULT 'PL',
  emergency_contact_name VARCHAR(200),
  emergency_contact_phone VARCHAR(50),
  
  -- Employment data
  position VARCHAR(200) NOT NULL,
  department VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  manager_id UUID REFERENCES employees(id),
  
  -- Bank data
  bank_account_number VARCHAR(50),
  bank_name VARCHAR(100),
  bank_swift VARCHAR(20),
  
  -- Tax data
  tax_office VARCHAR(200),
  tax_scale VARCHAR(20) DEFAULT 'PROGRESSIVE',
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),
  
  CONSTRAINT chk_pesel_format CHECK (pesel ~ '^\d{11}$'),
  CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Contracts table
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  contract_number VARCHAR(100) UNIQUE NOT NULL,
  
  type VARCHAR(50) NOT NULL, -- EMPLOYMENT, B2B, MANDATE, SPECIFIC_TASK
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  
  start_date DATE NOT NULL,
  end_date DATE,
  probation_end_date DATE,
  
  position VARCHAR(200) NOT NULL,
  department VARCHAR(100),
  workplace_address TEXT,
  
  -- Compensation
  salary_amount DECIMAL(15, 2) NOT NULL,
  salary_currency VARCHAR(3) DEFAULT 'PLN',
  payment_frequency VARCHAR(20) DEFAULT 'MONTHLY',
  
  -- Working conditions
  working_hours_per_week DECIMAL(5, 2) DEFAULT 40,
  vacation_days INTEGER DEFAULT 26,
  
  -- Document references
  document_path TEXT,
  signed_date DATE,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_by VARCHAR(100),
  
  CONSTRAINT chk_contract_dates CHECK (end_date IS NULL OR end_date > start_date),
  CONSTRAINT chk_salary_positive CHECK (salary_amount > 0)
);

-- Payroll records table
CREATE TABLE payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES payroll_batches(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  
  -- Gross salary
  gross_amount DECIMAL(15, 2) NOT NULL,
  
  -- Social Security (ZUS)
  zus_retirement_employee DECIMAL(15, 2) NOT NULL,
  zus_disability_employee DECIMAL(15, 2) NOT NULL,
  zus_sickness DECIMAL(15, 2) NOT NULL,
  zus_total_employee DECIMAL(15, 2) NOT NULL,
  
  -- Health insurance
  health_contribution DECIMAL(15, 2) NOT NULL,
  health_deductible DECIMAL(15, 2) NOT NULL,
  
  -- Tax
  tax_base DECIMAL(15, 2) NOT NULL,
  tax_rate DECIMAL(5, 4) NOT NULL,
  tax_amount DECIMAL(15, 2) NOT NULL,
  tax_advance DECIMAL(15, 2) NOT NULL,
  
  -- Net salary
  net_amount DECIMAL(15, 2) NOT NULL,
  
  -- Employer costs
  zus_retirement_employer DECIMAL(15, 2) NOT NULL,
  zus_disability_employer DECIMAL(15, 2) NOT NULL,
  zus_accident_employer DECIMAL(15, 2) NOT NULL,
  zus_labor_fund DECIMAL(15, 2) NOT NULL,
  zus_fgsp DECIMAL(15, 2) NOT NULL,
  employer_total_cost DECIMAL(15, 2) NOT NULL,
  
  -- Additional data
  deductions JSONB DEFAULT '[]',
  additions JSONB DEFAULT '[]',
  
  status VARCHAR(50) NOT NULL DEFAULT 'CALCULATED',
  payment_date DATE,
  payment_reference VARCHAR(200),
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processed_by VARCHAR(100),
  approved_by VARCHAR(100),
  
  CONSTRAINT chk_month_valid CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT chk_amounts_positive CHECK (
    gross_amount > 0 AND net_amount > 0
  ),
  UNIQUE(employee_id, year, month)
);

-- Leave management
CREATE TABLE leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  year INTEGER NOT NULL,
  
  -- Annual leave
  annual_entitled INTEGER NOT NULL DEFAULT 26,
  annual_used DECIMAL(5, 2) DEFAULT 0,
  annual_remaining DECIMAL(5, 2) GENERATED ALWAYS AS (annual_entitled - annual_used) STORED,
  
  -- Sick leave
  sick_days_used DECIMAL(5, 2) DEFAULT 0,
  
  -- Other leave types
  parental_days_used DECIMAL(5, 2) DEFAULT 0,
  unpaid_days_used DECIMAL(5, 2) DEFAULT 0,
  
  carry_over_days DECIMAL(5, 2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(employee_id, year),
  CONSTRAINT chk_leave_balance CHECK (annual_used >= 0 AND annual_used <= annual_entitled + carry_over_days)
);

-- Leave requests
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  
  type VARCHAR(50) NOT NULL, -- ANNUAL, SICK, PARENTAL, UNPAID
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested DECIMAL(5, 2) NOT NULL,
  
  reason TEXT,
  medical_certificate_path TEXT,
  
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT chk_leave_dates CHECK (end_date >= start_date),
  CONSTRAINT chk_days_positive CHECK (days_requested > 0)
);

-- Indexes for performance
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_department ON employees(department);
CREATE INDEX idx_employees_manager ON employees(manager_id);
CREATE INDEX idx_contracts_employee ON contracts(employee_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_payroll_employee ON payroll_records(employee_id);
CREATE INDEX idx_payroll_period ON payroll_records(year, month);
CREATE INDEX idx_payroll_batch ON payroll_records(batch_id);
CREATE INDEX idx_leave_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_status ON leave_requests(status);
CREATE INDEX idx_leave_dates ON leave_requests(start_date, end_date);

-- Audit trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_payroll_updated_at BEFORE UPDATE ON payroll_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## E. Configuration

```typescript
// config/hr-payroll.config.ts
export const hrPayrollConfig: HRModuleConfig = {
  payroll: {
    defaultCurrency: 'PLN',
    processingDay: 25,        // Process payroll on 25th
    paymentDay: 10,           // Pay salaries on 10th
    overtimeMultiplier: 1.5,
    nightShiftBonus: 0.2,     // 20% bonus
    weekendBonus: 1.0,        // 100% bonus
  },
  
  zus: {
    apiUrl: process.env.ZUS_API_URL || 'https://api.zus.pl/v1',
    apiKey: process.env.ZUS_API_KEY,
    certificatePath: process.env.ZUS_CERT_PATH || '/certs/zus.p12',
    retryAttempts: 3,
    timeout: 30000, // 30 seconds
  },
  
  leave: {
    annualDays: 26,          // Default annual leave days
    sickLeaveDays: 182,      // Maximum paid sick leave
    parentalLeaveDays: 32,   // Parental leave weeks
    carryOverMaxDays: 13,    // Max days to carry over
  },
  
  documents: {
    contractTemplatePath: '/templates/contracts',
    payslipTemplatePath: '/templates/payslips',
    storageBasePath: '/storage/hr-documents',
  },
  
  notifications: {
    emailEnabled: true,
    smsEnabled: false,
    payslipDelivery: 'EMAIL', // EMAIL, PORTAL, BOTH
  },
  
  compliance: {
    gdprEnabled: true,
    dataRetentionYears: 50,  // Polish law requires 50 years
    anonymizeTerminated: false,
  }
};

// Environment variables
// .env file
ZUS_API_URL=https://api.zus.pl/v1
ZUS_API_KEY=your-api-key-here
ZUS_CERT_PATH=/certs/zus.p12
ZUS_CERT_PASSWORD=cert-password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hr_payroll
DB_USER=hr_user
DB_PASSWORD=secure-password
REDIS_URL=redis://localhost:6379
```

## F. Testing Strategy

### 1. Unit Tests

```typescript
// hr-payroll.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { HRPayrollService } from './hr-payroll.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('HRPayrollService', () => {
  let service: HRPayrollService;
  let employeeRepo: jest.Mocked<Repository<Employee>>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HRPayrollService,
        {
          provide: getRepositoryToken(Employee),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        // Mock other dependencies
      ],
    }).compile();
    
    service = module.get<HRPayrollService>(HRPayrollService);
    employeeRepo = module.get(getRepositoryToken(Employee));
    eventEmitter = module.get(EventEmitter2);
  });
  
  describe('createEmployee', () => {
    it('should create employee with valid data', async () => {
      const createDto: CreateEmployeeDTO = {
        personalData: {
          firstName: 'Jan',
          lastName: 'Kowalski',
          pesel: '90011012345', // Valid test PESEL
          dateOfBirth: new Date('1990-01-10'),
          nationalIdNumber: 'ABC123456',
        },
        contactData: {
          email: 'jan.kowalski@example.com',
          phone: '+48123456789',
          address: {
            street: 'Marszałkowska 1',
            city: 'Warszawa',
            postalCode: '00-001',
            country: 'PL',
          },
          emergencyContact: {
            name: 'Anna Kowalska',
            phone: '+48987654321',
          },
        },
        employmentData: {
          position: 'Software Developer',
          department: 'IT',
          startDate: new Date('2024-01-01'),
          contractType: ContractType.EMPLOYMENT,
          salary: { amount: 10000, currency: 'PLN' },
          workingHours: 40,
        },
        bankAccount: {
          accountNumber: 'PL61109010140000071219812874',
          bankName: 'mBank',
        },
        taxData: {
          taxOffice: 'Warszawa Śródmieście',
          taxScale: TaxScale.PROGRESSIVE,
          taxRelief: [],
        },
      };
      
      employeeRepo.findOne.mockResolvedValue(null);
      employeeRepo.save.mockImplementation(entity => Promise.resolve(entity));
      
      const result = await service.createEmployee(createDto);
      
      expect(result).toBeDefined();
      expect(result.pesel).toBe(createDto.personalData.pesel);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'employee.created',
        expect.objectContaining({
          type: 'EMPLOYEE_CREATED',
        })
      );
    });
    
    it('should reject invalid PESEL', async () => {
      const createDto = {
        personalData: {
          pesel: '12345678901', // Invalid PESEL
        },
      } as CreateEmployeeDTO;
      
      await expect(service.createEmployee(createDto))
        .rejects.toThrow(InvalidPESELException);
    });
    
    it('should reject duplicate employee', async () => {
      const createDto = {
        personalData: {
          pesel: '90011012345',
        },
      } as CreateEmployeeDTO;
      
      employeeRepo.findOne.mockResolvedValue({ id: 'existing' } as Employee);
      
      await expect(service.createEmployee(createDto))
        .rejects.toThrow(DuplicateEmployeeException);
    });
  });
  
  describe('calculateSalary', () => {
    it('should calculate Polish payroll correctly', async () => {
      const employee = {
        id: 'emp-123',
        salary: { amount: 10000, currency: 'PLN' },
      } as Employee;
      
      const period = { year: 2024, month: 1 };
      
      const result = await service.calculateSalary(employee, period);
      
      // Verify ZUS calculations
      expect(result.socialSecurity.retirement.amount).toBeCloseTo(976); // 9.76%
      expect(result.socialSecurity.disability.amount).toBeCloseTo(150); // 1.5%
      expect(result.socialSecurity.sickness.amount).toBeCloseTo(245); // 2.45%
      
      // Verify health insurance
      const healthBase = 10000 - result.socialSecurity.total.amount;
      expect(result.healthInsurance.contribution.amount)
        .toBeCloseTo(healthBase * 0.09, 2);
      
      // Verify net is calculated
      expect(result.net.amount).toBeGreaterThan(0);
      expect(result.net.amount).toBeLessThan(10000);
    });
    
    it('should apply ZUS ceiling', async () => {
      const employee = {
        id: 'emp-123',
        salary: { amount: 50000, currency: 'PLN' }, // Above ZUS ceiling
      } as Employee;
      
      const period = { year: 2024, month: 1 };
      const zusCeiling = 206700 / 12; // Monthly ceiling
      
      const result = await service.calculateSalary(employee, period);
      
      // Retirement and disability should be calculated on ceiling, not full salary
      expect(result.socialSecurity.retirement.amount)
        .toBeCloseTo(zusCeiling * 0.0976, 2);
    });
  });
});

// Integration tests
describe('HRPayroll Integration Tests', () => {
  let app: INestApplication;
  let employeeId: string;
  
  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = moduleFixture.createNestApplication();
    await app.init();
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  it('POST /api/v1/employees should create employee', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/employees')
      .send({
        personalData: {
          firstName: 'Test',
          lastName: 'User',
          pesel: '90011012345',
          // ... other fields
        },
        // ... other sections
      })
      .expect(201);
    
    employeeId = response.body.id;
    expect(response.body.employeeCode).toMatch(/^EMP-/);
  });
  
  it('POST /api/v1/payroll/calculate should calculate payroll', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/payroll/calculate')
      .send({
        employeeId,
        period: { year: 2024, month: 1 }
      })
      .expect(200);
    
    expect(response.body.net).toBeDefined();
    expect(response.body.socialSecurity).toBeDefined();
  });
});
```

### 2. Test Coverage Requirements
- Unit test coverage: minimum 80%
- Integration test coverage: minimum 70%
- Critical paths (payroll calculation, ZUS submission): 95%
- E2E tests for complete payroll cycle

## G. Monitoring & Observability

```typescript
// Metrics
export class HRPayrollMetrics {
  private readonly payrollCalculationDuration = new Histogram({
    name: 'hr_payroll_calculation_duration_seconds',
    help: 'Duration of payroll calculations',
    labelNames: ['status'],
  });
  
  private readonly employeeOperations = new Counter({
    name: 'hr_employee_operations_total',
    help: 'Total number of employee operations',
    labelNames: ['operation', 'status'],
  });
  
  private readonly zusSubmissions = new Counter({
    name: 'hr_zus_submissions_total',
    help: 'Total ZUS submissions',
    labelNames: ['status', 'type'],
  });
  
  private readonly payrollErrors = new Counter({
    name: 'hr_payroll_errors_total',
    help: 'Total payroll processing errors',
    labelNames: ['error_type'],
  });
  
  private readonly activeEmployees = new Gauge({
    name: 'hr_active_employees_count',
    help: 'Current number of active employees',
  });
}

// Logging
export class PayrollLogger {
  log(level: LogLevel, message: string, context?: any) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'hr-payroll',
      message,
      ...context,
      correlationId: context?.correlationId || crypto.randomUUID(),
    };
    
    console.log(JSON.stringify(entry));
  }
}

// Health checks
@Injectable()
export class HRHealthIndicator extends HealthIndicator {
  async isHealthy(): Promise<HealthIndicatorResult> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkZUSConnection(),
      this.checkRedis(),
    ]);
    
    const isHealthy = checks.every(c => c.status === 'up');
    
    return this.getStatus('hr-payroll', isHealthy, {
      database: checks[0],
      zus: checks[1],
      cache: checks[2],
    });
  }
}

// Alerts configuration
export const alertRules = [
  {
    name: 'high_payroll_error_rate',
    expression: 'rate(hr_payroll_errors_total[5m]) > 0.1',
    severity: 'critical',
    description: 'High payroll processing error rate',
  },
  {
    name: 'zus_submission_failures',
    expression: 'rate(hr_zus_submissions_total{status="failed"}[1h]) > 0',
    severity: 'warning',
    description: 'ZUS submission failures detected',
  },
  {
    name: 'payroll_processing_slow',
    expression: 'hr_payroll_calculation_duration_seconds > 5',
    severity: 'warning',
    description: 'Payroll calculation taking longer than expected',
  },
];
```

## H. Security Considerations

1. **Authentication & Authorization**
   - JWT-based authentication with role-based access
   - Separate roles: HR_ADMIN, PAYROLL_ADMIN, EMPLOYEE
   - Row-level security for employee data access

2. **Data Validation**
   - PESEL validation with checksum
   - IBAN validation for bank accounts
   - Input sanitization for all text fields
   - SQL injection prevention via parameterized queries

3. **Rate Limiting**
   - API rate limiting: 100 requests/minute for reads
   - 10 requests/minute for writes
   - Separate limits for payroll processing endpoints

4. **Encryption**
   - PII data encrypted at rest using AES-256
   - Salary and bank account data encrypted
   - TLS 1.3 for data in transit
   - Certificate pinning for ZUS API

5. **Audit Trail**
   - All data modifications logged
   - Payroll calculations audit trail
   - Access logs for sensitive data
   - Immutable audit log storage

## I. Documentation

1. **API Documentation**
   - OpenAPI 3.0 specification
   - Swagger UI at `/api/docs`
   - Postman collection with examples

2. **Code Comments**
   ```typescript
   /**
    * Calculates Polish payroll including ZUS and tax
    * @param employee - Employee entity with salary data
    * @param period - Payroll period (year/month)
    * @returns Complete payroll calculation with all components
    * @throws PayrollCalculationException if calculation fails
    */
   ```

3. **README Structure**
   - Module overview and architecture
   - Setup instructions
   - Configuration guide
   - API usage examples
   - Troubleshooting guide

4. **Architecture Diagrams**
   - Component diagram showing module structure
   - Sequence diagram for payroll processing
   - Data flow diagram for ZUS integration

## J. Deployment Considerations

1. **Deployment Strategy**
   - Blue-green deployment for zero downtime
   - Database migrations run separately
   - Feature flags for gradual rollout

2. **Resource Requirements**
   - CPU: 4 cores minimum (8 recommended)
   - Memory: 8GB RAM minimum (16GB recommended)
   - Storage: 100GB for documents and backups
   - Database: PostgreSQL with 50GB initial allocation

3. **Scaling Strategy**
   - Horizontal scaling for API servers
   - Read replicas for database
   - Queue workers scale based on payroll batch size
   - Redis cluster for high availability

4. **Dependencies**
   - PostgreSQL 14+ (99.99% SLA)
   - Redis 6+ for caching (99.9% SLA)
   - ZUS API availability (check status before batch)
   - Document storage service (S3-compatible)

5. **Backup & Recovery**
   - Daily database backups with 30-day retention
   - Point-in-time recovery capability
   - Document backups to separate region
   - Disaster recovery plan with 4-hour RTO