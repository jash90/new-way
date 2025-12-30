# Epic: Tax Compliance Module (TAX)

> **Module Code**: TAX
> **Priority**: P1 (Essential)
> **Phase**: 4 (Weeks 13-16)
> **Status**: 📋 Specified

---

## Overview

### Description
The AI-Powered Tax Compliance Module serves as the intelligent tax management center of the accounting platform, combining traditional tax calculation capabilities with advanced AI features for regulatory interpretation and compliance optimization. It ensures full compliance with Polish tax laws (VAT, CIT, PIT, ZUS) while minimizing tax burden through intelligent optimization suggestions. The module handles JPK file generation, e-Declaration submission to e-Urząd Skarbowy, and provides real-time compliance monitoring.

### Business Value
- **Full Compliance**: Automated JPK generation and e-Declaration submission
- **Tax Optimization**: AI-powered suggestions for legal tax optimization
- **Risk Reduction**: Proactive compliance monitoring and deadline alerts
- **Efficiency**: Automated calculations reduce manual work and errors
- **Intelligence**: AI assistant for regulatory interpretation

### Success Criteria
- 100% accurate VAT/CIT/PIT/ZUS calculations
- JPK files validated against official XSD schemas
- <5s generation time for monthly JPK-V7M
- <30s e-Declaration submission
- AI interpretation confidence ≥0.75
- Zero missed tax deadlines with alert system

---

## Dependencies

### Depends On
- **AIM**: Authentication & user context for permissions
- **ACC**: Accounting data for tax calculations
- **CRM**: Client tax configuration
- **DOC**: Tax document storage

### Depended By
- **CSP**: Client tax dashboard access
- **MON**: Tax compliance monitoring
- **WFA**: Tax filing workflow automation

---

## Story Map

### User Journey: Tax Compliance Management

```
                         TAX COMPLIANCE MODULE (TAX)
                                  │
    ┌─────────────────────────────┼─────────────────────────────┐
    │                             │                             │
    ▼                             ▼                             ▼
┌─────────┐              ┌─────────────┐               ┌─────────────┐
│  SETUP  │              │ CALCULATIONS│               │  REPORTING  │
│         │              │ & JPK       │               │  & AI       │
└────┬────┘              └──────┬──────┘               └──────┬──────┘
     │                          │                             │
     ▼                          ▼                             ▼
┌─────────┐              ┌─────────────┐               ┌─────────────┐
│TAX-001  │              │TAX-004      │               │TAX-010      │
│Tax      │              │VAT          │               │AI Tax       │
│Config   │              │Calculation  │               │Assistant    │
└────┬────┘              └──────┬──────┘               └──────┬──────┘
     │                          │                             │
     ▼                          ▼                             ▼
┌─────────┐              ┌─────────────┐               ┌─────────────┐
│TAX-002  │              │TAX-005      │               │TAX-011      │
│Tax Rates│              │CIT/PIT      │               │Tax          │
│Management│             │Calculation  │               │Optimization │
└────┬────┘              └──────┬──────┘               └──────┬──────┘
     │                          │                             │
     ▼                          ▼                             ▼
┌─────────┐              ┌─────────────┐               ┌─────────────┐
│TAX-003  │              │TAX-006      │               │TAX-012      │
│Deadline │              │ZUS          │               │Compliance   │
│Management│             │Calculation  │               │Reports      │
└─────────┘              └──────┬──────┘               └──────┬──────┘
                                │                             │
                                ▼                             ▼
                         ┌─────────────┐               ┌─────────────┐
                         │TAX-007      │               │TAX-013      │
                         │JPK          │               │White List   │
                         │Generation   │               │Verification │
                         └──────┬──────┘               └──────┬──────┘
                                │                             │
                                ▼                             ▼
                         ┌─────────────┐               ┌─────────────┐
                         │TAX-008      │               │TAX-014      │
                         │e-Declaration│               │Regulatory   │
                         │Submission   │               │Updates      │
                         └──────┬──────┘               └─────────────┘
                                │
                                ▼
                         ┌─────────────┐
                         │TAX-009      │
                         │KSeF         │
                         │Integration  │
                         └─────────────┘
```

---

## Stories

### Setup Phase (Foundation)

```yaml
TAX-001:
  title: "Client Tax Configuration"
  priority: P0
  points: 8
  description: >
    As an accountant, I need to configure tax settings for each client
    so that tax calculations are performed according to their specific requirements.
  features:
    - VAT payer status and period (monthly/quarterly)
    - CIT/PIT tax form selection
    - ZUS contribution type
    - Estonian CIT option
    - e-Declaration preferences
  dependencies: [AIM, CRM]
  phase: "Week 13"

TAX-002:
  title: "Tax Rates and Rules Management"
  priority: P0
  points: 5
  description: >
    As an accountant, I need access to current Polish tax rates and rules
    so that calculations are always accurate and compliant.
  features:
    - VAT rates (23%, 8%, 5%, 0%, zw, np)
    - CIT rates (19%, 9% for small taxpayers)
    - PIT scales (progressive 12%/32%, flat 19%)
    - ZUS contribution bases and rates
    - Automatic rate updates
  dependencies: [TAX-001]
  phase: "Week 13"

TAX-003:
  title: "Tax Deadline Management"
  priority: P0
  points: 5
  description: >
    As an accountant, I need automatic tracking of tax deadlines
    so that no filing dates are missed.
  features:
    - Calendar of all tax deadlines
    - Email/SMS notifications
    - Configurable reminder days
    - Holiday and weekend adjustments
    - Per-client deadline tracking
  dependencies: [TAX-001]
  phase: "Week 13"
```

### Calculations & JPK

```yaml
TAX-004:
  title: "VAT Calculation Engine"
  priority: P0
  points: 13
  description: >
    As an accountant, I need to calculate VAT obligations
    so that I can prepare accurate VAT declarations.
  features:
    - Input/output VAT calculation
    - EU transaction handling (WNT, WDT)
    - Reverse charge mechanism
    - OSS procedure support
    - VAT corrections
    - Carry-forward tracking
  dependencies: [TAX-001, TAX-002, ACC]
  phase: "Week 13"

TAX-005:
  title: "CIT/PIT Calculation Engine"
  priority: P0
  points: 13
  description: >
    As an accountant, I need to calculate income tax obligations
    so that I can prepare CIT/PIT declarations.
  features:
    - Revenue and expense aggregation
    - Tax-deductible expense validation
    - Advance payment calculation
    - Annual declaration preparation
    - Loss carry-forward
    - Estonian CIT calculations
  dependencies: [TAX-001, TAX-002, ACC]
  phase: "Week 14"

TAX-006:
  title: "ZUS Contribution Calculation"
  priority: P1
  points: 8
  description: >
    As an accountant, I need to calculate ZUS contributions
    so that social security obligations are met.
  features:
    - Standard ZUS calculation
    - Preferential rates (small ZUS+)
    - Health insurance (9%)
    - Accident insurance
    - Labor Fund and FGŚP
    - DRA declaration preparation
  dependencies: [TAX-001, TAX-002]
  phase: "Week 14"

TAX-007:
  title: "JPK File Generation"
  priority: P0
  points: 13
  description: >
    As an accountant, I need to generate JPK files
    so that I can submit required data to tax authorities.
  features:
    - JPK_V7M (monthly VAT)
    - JPK_V7K (quarterly VAT)
    - JPK_FA (invoices on demand)
    - JPK_KR (accounting books)
    - XSD schema validation
    - Digital signature support
  dependencies: [TAX-004, ACC]
  phase: "Week 14"

TAX-008:
  title: "e-Declaration Submission"
  priority: P0
  points: 8
  description: >
    As an accountant, I need to submit declarations electronically
    so that filing is efficient and traceable.
  features:
    - e-Urząd Skarbowy integration
    - Automatic JPK submission
    - UPO (official receipt) retrieval
    - Submission status tracking
    - Retry logic for failures
    - Submission history
  dependencies: [TAX-007]
  phase: "Week 15"

TAX-009:
  title: "KSeF Integration"
  priority: P1
  points: 8
  description: >
    As an accountant, I need KSeF integration
    so that structured invoices can be exchanged with tax authorities.
  features:
    - Invoice submission to KSeF
    - Invoice retrieval from KSeF
    - KSeF number assignment
    - Status synchronization
    - Error handling
    - Batch operations
  dependencies: [TAX-008, DOC]
  phase: "Week 15"
```

### AI & Reporting

```yaml
TAX-010:
  title: "AI Tax Assistant"
  priority: P1
  points: 13
  description: >
    As an accountant, I need an AI assistant for tax questions
    so that I can get quick answers to regulatory questions.
  features:
    - Natural language tax queries
    - Regulation interpretation
    - Cited legal sources
    - Confidence scoring
    - Query history
    - Polish language support
  dependencies: [TAX-001]
  phase: "Week 15"

TAX-011:
  title: "Tax Optimization Suggestions"
  priority: P2
  points: 8
  description: >
    As an accountant, I need AI-powered optimization suggestions
    so that I can minimize clients' legal tax burden.
  features:
    - Current structure analysis
    - Optimization proposals
    - Estimated savings
    - Risk assessment
    - Implementation steps
    - Legal justification
  dependencies: [TAX-010, TAX-004, TAX-005]
  phase: "Week 16"

TAX-012:
  title: "Tax Compliance Reports"
  priority: P1
  points: 8
  description: >
    As an accountant, I need comprehensive tax reports
    so that I can monitor compliance status.
  features:
    - Compliance status overview
    - Obligation checklist
    - Risk assessment
    - Deadline calendar
    - Historical filings
    - Export to PDF/Excel
  dependencies: [TAX-004, TAX-005, TAX-007]
  phase: "Week 16"

TAX-013:
  title: "White List Verification"
  priority: P0
  points: 5
  description: >
    As an accountant, I need to verify VAT payer status
    so that I can ensure compliance for large payments.
  features:
    - NIP verification
    - Bank account verification
    - Real-time API checks
    - Verification history
    - Automatic alerts for >15,000 PLN
    - Integration with invoicing
  dependencies: [TAX-001, CRM]
  phase: "Week 13"

TAX-014:
  title: "Regulatory Update Monitoring"
  priority: P2
  points: 5
  description: >
    As an accountant, I need to track tax law changes
    so that I stay informed about regulatory updates.
  features:
    - Automatic law change detection
    - Impact analysis
    - Client notifications
    - Effective date tracking
    - Archive of changes
    - AI-powered summaries
  dependencies: [TAX-010]
  phase: "Week 16"
```

---

## Technical Architecture

### Database Schema Overview
```sql
-- Core tables
tax_configurations      -- Client tax settings
tax_calculations        -- Calculation history
jpk_files              -- Generated JPK files
tax_deadlines          -- Deadline tracking
compliance_checks      -- Compliance reports
tax_interpretations    -- AI interpretations
tax_optimizations      -- Optimization proposals
regulatory_updates     -- Law changes tracking
```

### Key Entities
```typescript
// Tax types
enum TaxType {
  VAT = 'VAT',
  CIT = 'CIT',
  PIT = 'PIT',
  ZUS = 'ZUS'
}

// JPK types per Polish regulations
enum JPKType {
  JPK_V7M = 'JPK_V7M',    // Monthly VAT
  JPK_V7K = 'JPK_V7K',    // Quarterly VAT
  JPK_FA = 'JPK_FA',      // Invoices
  JPK_KR = 'JPK_KR',      // Accounting books
  JPK_WB = 'JPK_WB'       // Bank statements
}

// VAT rates
enum VATRate {
  STANDARD = 23,
  REDUCED_8 = 8,
  REDUCED_5 = 5,
  ZERO = 0,
  EXEMPT = -1,
  REVERSE_CHARGE = -2
}

// Compliance status
enum ComplianceStatus {
  COMPLIANT = 'COMPLIANT',
  WARNING = 'WARNING',
  NON_COMPLIANT = 'NON_COMPLIANT'
}
```

### API Endpoints
```typescript
// Tax Calculations
POST   /api/trpc/tax.calculateVAT
POST   /api/trpc/tax.calculateCIT
POST   /api/trpc/tax.calculatePIT
POST   /api/trpc/tax.calculateZUS

// JPK Operations
POST   /api/trpc/tax.generateJPK
POST   /api/trpc/tax.validateJPK
POST   /api/trpc/tax.submitJPK
GET    /api/trpc/tax.getJPKStatus

// Compliance
GET    /api/trpc/tax.checkCompliance
GET    /api/trpc/tax.getDeadlines
POST   /api/trpc/tax.verifyWhiteList

// AI Features
POST   /api/trpc/tax.interpretRegulation
GET    /api/trpc/tax.getOptimizations
POST   /api/trpc/tax.askQuestion

// e-Declaration
POST   /api/trpc/tax.submitDeclaration
GET    /api/trpc/tax.getDeclarationStatus
```

---

## Implementation Phases

### Week 13: Foundation
- TAX-001: Client Tax Configuration
- TAX-002: Tax Rates Management
- TAX-003: Deadline Management
- TAX-004: VAT Calculation Engine
- TAX-013: White List Verification

### Week 14: Calculations
- TAX-005: CIT/PIT Calculation
- TAX-006: ZUS Calculation
- TAX-007: JPK Generation

### Week 15: Integration
- TAX-008: e-Declaration Submission
- TAX-009: KSeF Integration
- TAX-010: AI Tax Assistant

### Week 16: Advanced Features
- TAX-011: Tax Optimization
- TAX-012: Compliance Reports
- TAX-014: Regulatory Updates

---

## Agents Involved

| Agent | Role | Stories |
|-------|------|---------|
| polish-accounting-expert | Tax law compliance, Polish regulations | All |
| security-architect | Data protection, API security | TAX-008, TAX-009 |
| backend | API implementation, integrations | All |

---

## Acceptance Criteria Summary

### Non-Functional Requirements
- All calculations use Decimal.js (no floating point)
- JPK files validated against official XSD schemas
- All tax data encrypted at rest
- Full audit trail for calculations and submissions
- AI responses include confidence scores and disclaimers

### Performance Requirements
- VAT calculation: <500ms
- JPK generation: <5s for monthly file
- e-Declaration submission: <30s
- AI interpretation: <10s
- White List verification: <3s

### External Integrations
- e-Urząd Skarbowy API (99% SLA)
- KSeF API (99% SLA)
- Biała Lista API (99% SLA)
- OpenAI API for AI features

---

## Story Points Summary

| Priority | Stories | Points |
|----------|---------|--------|
| P0 | 7 | 57 |
| P1 | 5 | 45 |
| P2 | 2 | 13 |
| **Total** | **14** | **115** |

---

*Last updated: December 2024*
