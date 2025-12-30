# Epic: HR & Payroll Module (HRP)

> **Module Code**: HRP
> **Priority**: P2 (Important)
> **Phase**: 7 (Weeks 25-28)
> **Status**: 📋 Specified

---

## Overview

### Description
The HR & Payroll Module provides comprehensive human resources and payroll management for Polish businesses, ensuring full compliance with Polish labor law, ZUS (Social Insurance Institution) requirements, and tax regulations. It handles employee lifecycle management, contract administration, payroll calculations, leave management, and mandatory reporting.

### Business Value
- **Compliance**: Full compliance with Polish labor law (Kodeks Pracy) and ZUS regulations
- **Automation**: Automated payroll calculations with Polish tax rules
- **Accuracy**: Precise ZUS contribution calculations (emerytalne, rentowe, chorobowe)
- **Efficiency**: Streamlined HR workflows and document generation
- **Integration**: Seamless integration with ZUS PUE and tax systems

### Success Criteria
- Payroll calculation accuracy: 100%
- ZUS declaration generation: 100% compliance
- PIT-11 generation accuracy: 100%
- Employee onboarding time: <30 minutes
- Payroll processing time: <5 minutes per 100 employees
- Zero compliance penalties

---

## Dependencies

### Depends On
- **AIM**: Authentication & authorization for HR operations
- **CRM**: Company data for employment records
- **DOC**: Document storage for contracts and payslips
- **Infrastructure**: PostgreSQL, Redis, RabbitMQ

### Depended By
- **ACC**: Payroll journal entries
- **TAX**: PIT declarations, ZUS settlements
- **BNK**: Salary payment initiation
- **MON**: HR metrics and analytics

---

## Story Map

### User Journey: HR & Payroll Management

```
                        HR & PAYROLL MODULE (HRP)
                                  │
    ┌─────────────────────────────┼─────────────────────────────┐
    │                             │                             │
    ▼                             ▼                             ▼
┌─────────┐              ┌─────────────┐               ┌─────────────┐
│EMPLOYEES│              │  CONTRACTS  │               │   PAYROLL   │
│& ONBOARD│              │ & BENEFITS  │               │ & REPORTING │
└────┬────┘              └──────┬──────┘               └──────┬──────┘
     │                          │                             │
     ▼                          ▼                             ▼
┌─────────┐              ┌─────────────┐               ┌─────────────┐
│HRP-001  │              │HRP-003      │               │HRP-005      │
│Employee │              │Contract     │               │Payroll      │
│Management│             │Management   │               │Calculation  │
└────┬────┘              └──────┬──────┘               └──────┬──────┘
     │                          │                             │
     ▼                          ▼                             ▼
┌─────────┐              ┌─────────────┐               ┌─────────────┐
│HRP-002  │              │HRP-004      │               │HRP-006      │
│Employee │              │Benefits &   │               │Payslip      │
│Onboarding│             │Allowances   │               │Generation   │
└─────────┘              └─────────────┘               └──────┬──────┘
                                                              │
                                ┌─────────────────────────────┤
                                │                             │
                                ▼                             ▼
                         ┌─────────────┐               ┌─────────────┐
                         │HRP-007      │               │HRP-008      │
                         │Leave        │               │ZUS          │
                         │Management   │               │Integration  │
                         └──────┬──────┘               └──────┬──────┘
                                │                             │
                                ▼                             ▼
                         ┌─────────────┐               ┌─────────────┐
                         │HRP-009      │               │HRP-010      │
                         │Time         │               │PIT          │
                         │Tracking     │               │Declarations │
                         └─────────────┘               └──────┬──────┘
                                                              │
                                ┌─────────────────────────────┤
                                │                             │
                                ▼                             ▼
                         ┌─────────────┐               ┌─────────────┐
                         │HRP-011      │               │HRP-012      │
                         │HR           │               │Employee     │
                         │Analytics    │               │Self-Service │
                         └─────────────┘               └─────────────┘
```

---

## Stories

### Employee Management Phase

```yaml
HRP-001:
  title: "Employee Management"
  priority: P0
  points: 13
  description: >
    As an HR manager, I need to manage employee records with all required
    Polish employment data so that I can maintain accurate HR information.
  features:
    - Employee CRUD operations
    - PESEL validation and storage
    - Personal data management (GDPR compliant)
    - Employment history tracking
    - Document attachments
    - Employee search and filtering
    - Bulk import from CSV/Excel
  dependencies: [AIM, CRM]
  phase: "Week 25"

HRP-002:
  title: "Employee Onboarding"
  priority: P1
  points: 8
  description: >
    As an HR manager, I need a streamlined onboarding process so that
    new employees are set up correctly with all required documentation.
  features:
    - Onboarding workflow wizard
    - Required document checklist
    - ZUS registration data collection
    - Tax form (PIT-2) processing
    - Initial contract generation
    - System access provisioning
    - Onboarding progress tracking
  dependencies: [HRP-001, DOC]
  phase: "Week 25"
```

### Contract Management Phase

```yaml
HRP-003:
  title: "Contract Management"
  priority: P0
  points: 13
  description: >
    As an HR manager, I need to manage employment contracts according to
    Polish labor law so that all employment relationships are properly documented.
  features:
    - Umowa o pracę (employment contract)
    - Umowa zlecenie (mandate contract)
    - Umowa o dzieło (contract for specific work)
    - Contract templates with Polish legal clauses
    - Contract amendments (aneksy)
    - Contract termination handling
    - Świadectwo pracy generation
  dependencies: [HRP-001]
  phase: "Week 25"

HRP-004:
  title: "Benefits & Allowances"
  priority: P1
  points: 8
  description: >
    As an HR manager, I need to configure employee benefits and allowances
    so that compensation packages are correctly applied to payroll.
  features:
    - Benefit type configuration
    - Per-employee benefit assignment
    - Taxable vs non-taxable benefits
    - PPK (Employee Capital Plans) management
    - ZFŚS (Social Benefits Fund) handling
    - Benefit history tracking
    - Cost reporting
  dependencies: [HRP-001]
  phase: "Week 26"
```

### Payroll Phase

```yaml
HRP-005:
  title: "Payroll Calculation"
  priority: P0
  points: 21
  description: >
    As a payroll specialist, I need accurate payroll calculations according
    to Polish tax and social security laws so that employees are paid correctly.
  features:
    - Gross to net calculation
    - ZUS contributions (emerytalne, rentowe, chorobowe, zdrowotne)
    - Tax calculation (PIT scale or flat rate)
    - Tax relief (ulga podatkowa) application
    - Overtime calculation
    - Deductions management
    - Payroll batch processing
    - Multi-period payroll support
  dependencies: [HRP-003, HRP-004]
  phase: "Week 26"

HRP-006:
  title: "Payslip Generation"
  priority: P0
  points: 8
  description: >
    As an employee, I need to receive detailed payslips so that I can
    understand my compensation breakdown.
  features:
    - Payslip PDF generation
    - Detailed breakdown display
    - Year-to-date totals
    - Email delivery
    - Payslip archive
    - Digital signature
    - Batch generation
  dependencies: [HRP-005]
  phase: "Week 26"
```

### Leave & Time Phase

```yaml
HRP-007:
  title: "Leave Management"
  priority: P0
  points: 13
  description: >
    As an employee, I need to request and track leave according to
    Polish labor law entitlements so that my absences are properly recorded.
  features:
    - Urlop wypoczynkowy (annual leave) - 20/26 days
    - Urlop na żądanie (on-demand leave) - 4 days
    - L4 (sick leave) handling
    - Urlop macierzyński/rodzicielski (parental leave)
    - Leave request workflow
    - Leave balance calculation
    - Manager approval process
    - Calendar integration
  dependencies: [HRP-001]
  phase: "Week 27"

HRP-009:
  title: "Time Tracking"
  priority: P2
  points: 8
  description: >
    As a manager, I need to track employee working hours so that
    overtime and attendance are properly recorded.
  features:
    - Daily time entry
    - Work schedule management
    - Overtime tracking
    - Attendance reports
    - Integration with payroll
    - Holiday calendar (Polish)
    - Flexible hours support
  dependencies: [HRP-001]
  phase: "Week 27"
```

### Compliance & Reporting Phase

```yaml
HRP-008:
  title: "ZUS Integration"
  priority: P0
  points: 13
  description: >
    As a payroll specialist, I need to generate and submit ZUS declarations
    so that social security contributions are properly reported.
  features:
    - ZUS DRA (monthly declaration)
    - ZUS RCA (contribution breakdown)
    - ZUS RSA (benefit payments)
    - ZUS RPA (additional contributions)
    - ZUA/ZZA (employee registration)
    - ZWUA (deregistration)
    - ZUS PUE integration
    - Declaration archive
  dependencies: [HRP-005]
  phase: "Week 27"

HRP-010:
  title: "PIT Declarations"
  priority: P0
  points: 8
  description: >
    As a payroll specialist, I need to generate annual tax declarations
    so that employees receive their tax documents on time.
  features:
    - PIT-11 (annual tax certificate)
    - PIT-4R (employer tax declaration)
    - PIT-8AR (flat-rate tax)
    - IFT-1R (foreign income)
    - XML generation for e-Deklaracje
    - Employee delivery tracking
    - Correction handling
  dependencies: [HRP-005]
  phase: "Week 28"
```

### Analytics & Self-Service Phase

```yaml
HRP-011:
  title: "HR Analytics & Reporting"
  priority: P2
  points: 5
  description: >
    As an HR manager, I need analytics and reports on HR metrics
    so that I can make data-driven decisions.
  features:
    - Headcount analytics
    - Turnover rates
    - Leave utilization
    - Payroll cost analysis
    - Department breakdowns
    - Trend visualization
    - Custom report builder
    - Export capabilities
  dependencies: [HRP-001, HRP-005, HRP-007]
  phase: "Week 28"

HRP-012:
  title: "Employee Self-Service"
  priority: P2
  points: 5
  description: >
    As an employee, I need self-service access to my HR information
    so that I can view and update my data independently.
  features:
    - Personal data viewing/editing
    - Payslip access
    - Leave request submission
    - Document download
    - Tax document access
    - Contact information updates
    - Mobile-responsive interface
  dependencies: [HRP-001, HRP-006, HRP-007]
  phase: "Week 28"
```

---

## Technical Architecture

### Database Schema Overview
```sql
-- Core tables
employees              -- Employee personal data (PESEL, address)
contracts              -- Employment contracts with terms
payroll_periods        -- Monthly payroll periods
payroll_records        -- Individual payroll calculations
payroll_components     -- Breakdown of payroll items
leave_balances         -- Leave entitlements per employee
leave_requests         -- Leave request records
time_entries           -- Daily time tracking
benefits               -- Benefit configurations
employee_benefits      -- Per-employee benefit assignments
zus_declarations       -- ZUS declaration records
pit_declarations       -- Annual PIT declarations
```

### Key Entities
```typescript
// Employee status
enum EmploymentStatus {
  ACTIVE = 'ACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  SUSPENDED = 'SUSPENDED',
  TERMINATED = 'TERMINATED'
}

// Contract types
enum ContractType {
  UMOWA_O_PRACE = 'UMOWA_O_PRACE',           // Employment contract
  UMOWA_ZLECENIE = 'UMOWA_ZLECENIE',         // Mandate contract
  UMOWA_O_DZIELO = 'UMOWA_O_DZIELO',         // Contract for specific work
  B2B = 'B2B'                                 // Business-to-business
}

// Leave types
enum LeaveType {
  WYPOCZYNKOWY = 'WYPOCZYNKOWY',             // Annual leave
  NA_ZADANIE = 'NA_ZADANIE',                 // On-demand leave
  CHOROBOWY = 'CHOROBOWY',                   // Sick leave
  MACIERZYNSKI = 'MACIERZYNSKI',             // Maternity leave
  RODZICIELSKI = 'RODZICIELSKI',             // Parental leave
  OJCOWSKI = 'OJCOWSKI',                     // Paternity leave
  BEZPLATNY = 'BEZPLATNY',                   // Unpaid leave
  OKOLICZNOSCIOWY = 'OKOLICZNOSCIOWY'        // Circumstantial leave
}

// ZUS contribution types
interface ZUSContributions {
  emerytalne: number;      // 9.76% employee + 9.76% employer
  rentowe: number;         // 1.5% employee + 6.5% employer
  chorobowe: number;       // 2.45% employee only
  wypadkowe: number;       // 1.67% employer only (varies)
  zdrowotne: number;       // 9% employee (7.75% tax deductible)
  fp: number;              // 2.45% employer (Labor Fund)
  fgsp: number;            // 0.10% employer (Guaranteed Benefits Fund)
}
```

### API Endpoints
```typescript
// Employee management
POST   /api/trpc/hrp.createEmployee
GET    /api/trpc/hrp.getEmployees
GET    /api/trpc/hrp.getEmployee
PUT    /api/trpc/hrp.updateEmployee
DELETE /api/trpc/hrp.archiveEmployee

// Contract management
POST   /api/trpc/hrp.createContract
PUT    /api/trpc/hrp.updateContract
POST   /api/trpc/hrp.terminateContract
GET    /api/trpc/hrp.getContracts

// Payroll operations
POST   /api/trpc/hrp.calculatePayroll
POST   /api/trpc/hrp.processPayrollBatch
GET    /api/trpc/hrp.getPayrollRecords
POST   /api/trpc/hrp.generatePayslips

// Leave management
POST   /api/trpc/hrp.requestLeave
PUT    /api/trpc/hrp.approveLeave
GET    /api/trpc/hrp.getLeaveBalance
GET    /api/trpc/hrp.getLeaveRequests

// ZUS & Tax
POST   /api/trpc/hrp.generateZUSDeclaration
POST   /api/trpc/hrp.generatePIT11
GET    /api/trpc/hrp.getDeclarations
```

---

## Implementation Phases

### Week 25: Foundation
- HRP-001: Employee Management
- HRP-002: Employee Onboarding
- HRP-003: Contract Management

### Week 26: Payroll
- HRP-004: Benefits & Allowances
- HRP-005: Payroll Calculation
- HRP-006: Payslip Generation

### Week 27: Leave & Compliance
- HRP-007: Leave Management
- HRP-008: ZUS Integration
- HRP-009: Time Tracking

### Week 28: Reporting & Self-Service
- HRP-010: PIT Declarations
- HRP-011: HR Analytics & Reporting
- HRP-012: Employee Self-Service

---

## Agents Involved

| Agent | Role | Stories |
|-------|------|---------|
| hr-payroll-expert | Polish labor law, ZUS, payroll calculations | All |
| backend | API implementation, database design | All |
| security-architect | PII protection, GDPR compliance | HRP-001, HRP-002 |
| frontend-expert | Employee portal UI | HRP-012 |

---

## Acceptance Criteria Summary

### Non-Functional Requirements
- PESEL validation with checksum verification
- All personal data encrypted (AES-256-GCM)
- GDPR-compliant data handling and retention
- Audit trail for all HR operations
- Row-level security for employee data

### Performance Requirements
- Employee search: <500ms
- Payroll calculation: <100ms per employee
- Batch payroll (100 employees): <5 seconds
- Report generation: <10 seconds
- ZUS declaration generation: <5 seconds

### Polish Compliance
- Kodeks Pracy (Labor Code) compliance
- ZUS contribution rates and ceilings
- Polish tax scales and reliefs
- Mandatory leave entitlements
- Employment documentation requirements

---

## Polish HR Specifics

### ZUS Contribution Rates (2024)
| Contribution | Employee | Employer | Total |
|--------------|----------|----------|-------|
| Emerytalne | 9.76% | 9.76% | 19.52% |
| Rentowe | 1.50% | 6.50% | 8.00% |
| Chorobowe | 2.45% | - | 2.45% |
| Wypadkowe | - | 1.67%* | 1.67% |
| Zdrowotne | 9.00% | - | 9.00% |
| FP | - | 2.45% | 2.45% |
| FGŚP | - | 0.10% | 0.10% |

*Wypadkowe rate varies by employer risk category

### ZUS Contribution Ceiling
- Annual ceiling: 234,720 PLN (2024)
- Applies to: Emerytalne, Rentowe
- Does not apply to: Chorobowe, Zdrowotne

### Tax Scales (2024)
| Threshold | Rate | Tax-free amount |
|-----------|------|-----------------|
| Up to 120,000 PLN | 12% | 30,000 PLN |
| Above 120,000 PLN | 32% | - |

### Leave Entitlements
| Leave Type | Entitlement |
|------------|-------------|
| Annual (< 10 years exp.) | 20 days |
| Annual (≥ 10 years exp.) | 26 days |
| On-demand | 4 days (from annual) |
| Sick leave | 80% pay (33 days, then ZUS) |
| Maternity | 20 weeks (100% pay) |
| Parental | 32-34 weeks (70-100% pay) |

---

## Story Points Summary

| Priority | Stories | Points |
|----------|---------|--------|
| P0 | 7 | 89 |
| P1 | 2 | 16 |
| P2 | 3 | 18 |
| **Total** | **12** | **123** |

---

*Last updated: December 2024*
