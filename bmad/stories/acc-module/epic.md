# Epic: Accounting Engine Module (ACC)

> **Module Code**: ACC
> **Priority**: P0 (Core)
> **Phase**: 3 (Weeks 9-12)
> **Status**: 📋 Specified

---

## Overview

### Description
The Accounting Engine is the financial backbone of the platform, implementing a complete double-entry bookkeeping system compliant with Polish accounting standards (Ustawa o rachunkowości). It manages the chart of accounts, journal entries, general ledger, financial statements, and integration with Polish tax reporting requirements.

### Business Value
- **Core Functionality**: Essential for any accounting platform
- **Compliance**: Meets Polish accounting regulations
- **Automation**: Reduces manual entry errors
- **Integration**: Foundation for tax, banking, and reporting modules

### Success Criteria
- 100% accurate double-entry balance (debits = credits)
- Support for Polish chart of accounts template
- JPK-ready data structure
- Sub-200ms response time for ledger queries
- 100% audit trail coverage

---

## Dependencies

### Depends On
- **AIM**: Authentication & user context
- **CRM**: Client/organization context for multi-tenant ledgers

### Depended By
- **TAX**: Tax calculations and JPK generation
- **DOC**: Document-to-entry automation
- **BNK**: Bank reconciliation
- **HRP**: Salary expense postings

---

## Story Map

### User Journey: Accountant Managing Books

```
                     ACCOUNTING ENGINE (ACC)
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
    ▼                         ▼                         ▼
┌─────────┐            ┌─────────────┐           ┌─────────────┐
│  SETUP  │            │   DAILY     │           │  REPORTING  │
│         │            │ OPERATIONS  │           │             │
└────┬────┘            └──────┬──────┘           └──────┬──────┘
     │                        │                         │
     ▼                        ▼                         ▼
┌─────────┐            ┌─────────────┐           ┌─────────────┐
│ACC-001  │            │ACC-006      │           │ACC-012      │
│Chart of │            │Journal      │           │Trial        │
│Accounts │            │Entries      │           │Balance      │
└────┬────┘            └──────┬──────┘           └──────┬──────┘
     │                        │                         │
     ▼                        ▼                         ▼
┌─────────┐            ┌─────────────┐           ┌─────────────┐
│ACC-002  │            │ACC-007      │           │ACC-013      │
│Account  │            │Entry        │           │Balance      │
│Templates│            │Validation   │           │Sheet        │
└────┬────┘            └──────┬──────┘           └──────┬──────┘
     │                        │                         │
     ▼                        ▼                         ▼
┌─────────┐            ┌─────────────┐           ┌─────────────┐
│ACC-003  │            │ACC-008      │           │ACC-014      │
│Account  │            │General      │           │Income       │
│Hierarchy│            │Ledger       │           │Statement    │
└────┬────┘            └──────┬──────┘           └──────┬──────┘
     │                        │                         │
     ▼                        ▼                         ▼
┌─────────┐            ┌─────────────┐           ┌─────────────┐
│ACC-004  │            │ACC-009      │           │ACC-015      │
│Fiscal   │            │Entry        │           │JPK Export   │
│Periods  │            │Templates    │           │             │
└────┬────┘            └──────┬──────┘           └─────────────┘
     │                        │
     ▼                        ▼
┌─────────┐            ┌─────────────┐
│ACC-005  │            │ACC-010      │
│Opening  │            │Recurring    │
│Balances │            │Entries      │
└─────────┘            └──────┬──────┘
                              │
                              ▼
                       ┌─────────────┐
                       │ACC-011      │
                       │Entry        │
                       │Reversal     │
                       └─────────────┘
```

---

## Stories

### Setup Phase (Foundation)

```yaml
ACC-001:
  title: "Chart of Accounts Management"
  priority: P0
  points: 13
  description: >
    As an accountant, I need to create and manage a chart of accounts
    so that I can organize financial transactions properly.
  dependencies: [AIM, CRM]
  phase: "Week 9"

ACC-002:
  title: "Polish Chart of Accounts Templates"
  priority: P0
  points: 8
  description: >
    As an accountant, I need Polish standard account templates
    so that I can quickly set up compliant books for new clients.
  dependencies: [ACC-001]
  phase: "Week 9"

ACC-003:
  title: "Account Hierarchy and Grouping"
  priority: P1
  points: 5
  description: >
    As an accountant, I need to organize accounts hierarchically
    so that I can create meaningful financial reports.
  dependencies: [ACC-001]
  phase: "Week 9"

ACC-004:
  title: "Fiscal Period Management"
  priority: P0
  points: 8
  description: >
    As an accountant, I need to manage fiscal periods
    so that I can control when entries can be posted.
  dependencies: [ACC-001]
  phase: "Week 9"

ACC-005:
  title: "Opening Balances"
  priority: P1
  points: 5
  description: >
    As an accountant, I need to enter opening balances
    so that I can start tracking from a specific date.
  dependencies: [ACC-001, ACC-004]
  phase: "Week 9"
```

### Daily Operations

```yaml
ACC-006:
  title: "Journal Entry Creation"
  priority: P0
  points: 13
  description: >
    As an accountant, I need to create journal entries with
    multiple debit/credit lines so that I can record transactions.
  dependencies: [ACC-001, ACC-004]
  phase: "Week 9"

ACC-007:
  title: "Entry Validation and Balancing"
  priority: P0
  points: 8
  description: >
    As an accountant, I need entries to be automatically validated
    so that I cannot post unbalanced entries.
  dependencies: [ACC-006]
  phase: "Week 9"

ACC-008:
  title: "General Ledger"
  priority: P0
  points: 13
  description: >
    As an accountant, I need to view the general ledger
    so that I can see all postings to each account.
  dependencies: [ACC-006]
  phase: "Week 9"

ACC-009:
  title: "Journal Entry Templates"
  priority: P2
  points: 5
  description: >
    As an accountant, I need entry templates
    so that I can quickly create common transactions.
  dependencies: [ACC-006]
  phase: "Week 10"

ACC-010:
  title: "Recurring Entries"
  priority: P2
  points: 8
  description: >
    As an accountant, I need to schedule recurring entries
    so that regular transactions are posted automatically.
  dependencies: [ACC-006, ACC-009]
  phase: "Week 10"

ACC-011:
  title: "Entry Reversal"
  priority: P1
  points: 5
  description: >
    As an accountant, I need to reverse posted entries
    so that I can correct mistakes properly.
  dependencies: [ACC-006]
  phase: "Week 10"
```

### Reporting

```yaml
ACC-012:
  title: "Trial Balance"
  priority: P0
  points: 8
  description: >
    As an accountant, I need to generate a trial balance
    so that I can verify that books are balanced.
  dependencies: [ACC-008]
  phase: "Week 10"

ACC-013:
  title: "Balance Sheet (Bilans)"
  priority: P0
  points: 13
  description: >
    As an accountant, I need to generate a balance sheet
    so that I can report the financial position.
  dependencies: [ACC-012]
  phase: "Week 11"

ACC-014:
  title: "Income Statement (RZiS)"
  priority: P0
  points: 13
  description: >
    As an accountant, I need to generate an income statement
    so that I can report profitability.
  dependencies: [ACC-012]
  phase: "Week 11"

ACC-015:
  title: "JPK-KR Export"
  priority: P0
  points: 13
  description: >
    As an accountant, I need to export accounting books in JPK_KR format
    so that I can submit to Polish tax authorities.
  dependencies: [ACC-012, ACC-013, ACC-014]
  phase: "Week 12"
```

---

## Technical Architecture

### Database Schema Overview
```sql
-- Core tables
chart_of_accounts       -- Account definitions
accounting_periods      -- Fiscal periods
journal_entries         -- Entry headers
journal_lines           -- Entry line items
general_ledger          -- Materialized postings
account_balances        -- Period-end balances (cached)
entry_templates         -- Reusable templates
recurring_entries       -- Scheduled entries
```

### Key Entities
```typescript
// Account types per Polish regulations
enum AccountType {
  FIXED_ASSETS = 'FIXED_ASSETS',           // Aktywa trwałe (klasa 0)
  INVENTORY = 'INVENTORY',                  // Zapasy (klasa 3)
  RECEIVABLES = 'RECEIVABLES',              // Należności (klasa 2)
  CASH = 'CASH',                            // Środki pieniężne (klasa 1)
  EQUITY = 'EQUITY',                        // Kapitały własne (klasa 8)
  LIABILITIES = 'LIABILITIES',              // Zobowiązania (klasa 2)
  REVENUE = 'REVENUE',                      // Przychody (klasa 7)
  EXPENSE = 'EXPENSE',                      // Koszty (klasa 4, 5)
  COST_BY_TYPE = 'COST_BY_TYPE',           // Koszty rodzajowe (klasa 4)
  COST_BY_FUNCTION = 'COST_BY_FUNCTION',   // Koszty wg miejsc (klasa 5)
  TAXES_SETTLEMENTS = 'TAXES_SETTLEMENTS', // Rozrachunki publicznoprawne
}

// Entry status workflow
enum EntryStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
}
```

### API Endpoints
```typescript
// Chart of Accounts
POST   /api/trpc/accounting.createAccount
GET    /api/trpc/accounting.getAccounts
PUT    /api/trpc/accounting.updateAccount
DELETE /api/trpc/accounting.deactivateAccount

// Journal Entries
POST   /api/trpc/accounting.createEntry
GET    /api/trpc/accounting.getEntries
PUT    /api/trpc/accounting.updateDraftEntry
POST   /api/trpc/accounting.postEntry
POST   /api/trpc/accounting.reverseEntry

// Ledger & Reports
GET    /api/trpc/accounting.getGeneralLedger
GET    /api/trpc/accounting.getTrialBalance
GET    /api/trpc/accounting.getBalanceSheet
GET    /api/trpc/accounting.getIncomeStatement
POST   /api/trpc/accounting.exportJPKKR
```

---

## Implementation Phases

### Week 9: Foundation
- ACC-001: Chart of Accounts Management
- ACC-002: Polish Templates
- ACC-003: Account Hierarchy
- ACC-004: Fiscal Periods
- ACC-006: Journal Entry Creation
- ACC-007: Entry Validation
- ACC-008: General Ledger

### Week 10: Operations
- ACC-005: Opening Balances
- ACC-009: Entry Templates
- ACC-010: Recurring Entries
- ACC-011: Entry Reversal
- ACC-012: Trial Balance

### Week 11-12: Reporting
- ACC-013: Balance Sheet
- ACC-014: Income Statement
- ACC-015: JPK-KR Export

---

## Agents Involved

| Agent | Role | Stories |
|-------|------|---------|
| polish-accounting-expert | Domain validation, Polish standards | All |
| security-architect | Data protection, audit trails | ACC-006, ACC-008 |
| backend | API implementation | All |

---

## Acceptance Criteria Summary

### Non-Functional Requirements
- All monetary values use Decimal.js (no floating point)
- Every mutation creates an audit log entry
- Entries cannot be modified after posting (only reversed)
- All reports match official Polish templates
- JPK export validates against official XSD

### Performance Requirements
- Chart of accounts: <100ms load time
- Journal entry creation: <200ms
- Trial balance generation: <500ms for 10,000 entries
- General ledger query: <300ms with pagination

---

## Story Points Summary

| Priority | Stories | Points |
|----------|---------|--------|
| P0 | 10 | 98 |
| P1 | 3 | 15 |
| P2 | 2 | 13 |
| **Total** | **15** | **126** |

---

*Last updated: December 2024*
