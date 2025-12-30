# Epic: Banking Integration Layer (BNK)

> **Module Code**: BNK
> **Priority**: P2 (Important)
> **Phase**: 6 (Weeks 21-24)
> **Status**: 📋 Specified

---

## Overview

### Description
The Banking Integration Layer provides secure, PSD2-compliant integration with Polish banking institutions through Open Banking APIs. It enables automated financial data aggregation, payment processing, and intelligent transaction reconciliation, serving as the financial backbone of the accounting platform.

### Business Value
- **Automation**: Eliminate manual bank statement imports and data entry
- **Accuracy**: Real-time account balances and transaction data
- **Compliance**: PSD2/SCA compliance for secure banking operations
- **Efficiency**: Automated reconciliation saves 80%+ of manual effort
- **Cash Flow**: Real-time visibility into financial position

### Success Criteria
- Bank connection success rate ≥98%
- Transaction import accuracy 100%
- Payment initiation success rate ≥99%
- Auto-reconciliation rate ≥80%
- API response time <500ms average
- Zero security incidents

---

## Dependencies

### Depends On
- **AIM**: Authentication & authorization for banking operations
- **ACC**: Accounting entries for reconciliation matching
- **CRM**: Client data for account ownership
- **Infrastructure**: Redis, PostgreSQL, RabbitMQ

### Depended By
- **TAX**: VAT payment verification (White List)
- **WFA**: Payment processing workflows
- **MON**: Banking operation monitoring
- **CSP**: Client bank account visibility

---

## Story Map

### User Journey: Banking Integration

```
                      BANKING INTEGRATION LAYER (BNK)
                                  │
    ┌─────────────────────────────┼─────────────────────────────┐
    │                             │                             │
    ▼                             ▼                             ▼
┌─────────┐              ┌─────────────┐               ┌─────────────┐
│ CONNECT │              │ TRANSACTIONS│               │  PAYMENTS   │
│         │              │ & ACCOUNTS  │               │ & RECONCILE │
└────┬────┘              └──────┬──────┘               └──────┬──────┘
     │                          │                             │
     ▼                          ▼                             ▼
┌─────────┐              ┌─────────────┐               ┌─────────────┐
│BNK-001  │              │BNK-003      │               │BNK-005      │
│Bank     │              │Transaction  │               │Payment      │
│Connection│             │Import       │               │Initiation   │
└────┬────┘              └──────┬──────┘               └──────┬──────┘
     │                          │                             │
     ▼                          ▼                             ▼
┌─────────┐              ┌─────────────┐               ┌─────────────┐
│BNK-002  │              │BNK-004      │               │BNK-006      │
│Account  │              │AI           │               │Payment      │
│Aggregation│            │Categorization│              │Status       │
└─────────┘              └──────┬──────┘               └──────┬──────┘
                                │                             │
                                ▼                             ▼
                         ┌─────────────┐               ┌─────────────┐
                         │BNK-007      │               │BNK-008      │
                         │Transaction  │               │Webhook      │
                         │Reconciliation│              │Management   │
                         └─────────────┘               └──────┬──────┘
                                                              │
                                ┌─────────────────────────────┤
                                │                             │
                                ▼                             ▼
                         ┌─────────────┐               ┌─────────────┐
                         │BNK-009      │               │BNK-010      │
                         │Multi-Provider│              │Banking      │
                         │Support      │               │Analytics    │
                         └─────────────┘               └─────────────┘
```

---

## Stories

### Connection & Accounts Phase

```yaml
BNK-001:
  title: "Bank Connection Management"
  priority: P0
  points: 13
  description: >
    As an accountant, I need to securely connect client bank accounts
    using PSD2 Open Banking APIs so that I can access financial data.
  features:
    - PSD2 OAuth 2.0 authorization flow
    - Strong Customer Authentication (SCA)
    - Consent management (90-day validity)
    - Multi-bank support
    - Connection status monitoring
    - Token encryption and refresh
    - Audit logging
  dependencies: [AIM]
  phase: "Week 21"

BNK-002:
  title: "Account Aggregation & Balance"
  priority: P0
  points: 8
  description: >
    As an accountant, I need to view all connected bank accounts
    with real-time balances so that I can monitor cash position.
  features:
    - Multi-account aggregation
    - Real-time balance retrieval
    - Available vs booked balance
    - Currency support (PLN, EUR, USD)
    - Account type classification
    - Balance history tracking
    - Low balance alerts
  dependencies: [BNK-001]
  phase: "Week 21"
```

### Transactions Phase

```yaml
BNK-003:
  title: "Transaction Import & Normalization"
  priority: P0
  points: 8
  description: >
    As an accountant, I need to import bank transactions automatically
    so that I have up-to-date financial data without manual entry.
  features:
    - Automatic transaction fetching
    - Data normalization across banks
    - Deduplication logic
    - Date range selection
    - Incremental imports
    - Transaction status tracking
    - Import scheduling
  dependencies: [BNK-002]
  phase: "Week 22"

BNK-004:
  title: "AI Transaction Categorization"
  priority: P1
  points: 8
  description: >
    As an accountant, I need transactions automatically categorized
    so that I can quickly assign them to proper accounts.
  features:
    - ML-based categorization
    - Polish accounting categories
    - VAT rate suggestions
    - Counterparty recognition
    - Custom rule support
    - Learning from corrections
    - Confidence scoring
  dependencies: [BNK-003]
  phase: "Week 22"
```

### Payments Phase

```yaml
BNK-005:
  title: "Payment Initiation"
  priority: P0
  points: 13
  description: >
    As an accountant, I need to initiate payments directly from the platform
    so that I can process invoices without logging into bank portals.
  features:
    - SEPA Credit Transfer
    - SEPA Instant payments
    - Domestic transfers (Elixir)
    - Split payment (VAT)
    - White List verification
    - Payment scheduling
    - Batch payments
  dependencies: [BNK-002]
  phase: "Week 23"

BNK-006:
  title: "Payment Status & Management"
  priority: P0
  points: 5
  description: >
    As an accountant, I need to track payment status and manage
    pending payments so that I can ensure timely processing.
  features:
    - Real-time status tracking
    - Payment cancellation
    - Failed payment handling
    - Payment history
    - Receipt generation
    - Status notifications
    - Retry logic
  dependencies: [BNK-005]
  phase: "Week 23"
```

### Reconciliation & Integration Phase

```yaml
BNK-007:
  title: "Transaction Reconciliation"
  priority: P0
  points: 13
  description: >
    As an accountant, I need to reconcile bank transactions with
    accounting entries so that books match bank statements.
  features:
    - Exact matching algorithm
    - Fuzzy matching support
    - AI-assisted matching
    - Manual matching interface
    - Confidence scoring
    - Reconciliation reports
    - Exception handling
  dependencies: [BNK-003, ACC]
  phase: "Week 23"

BNK-008:
  title: "Webhook Management"
  priority: P1
  points: 5
  description: >
    As a system, I need to receive real-time notifications from banks
    so that data stays synchronized without constant polling.
  features:
    - Webhook registration
    - Signature validation
    - Event processing
    - Retry handling
    - Event logging
    - Subscription management
    - Fallback polling
  dependencies: [BNK-001]
  phase: "Week 24"
```

### Advanced Features Phase

```yaml
BNK-009:
  title: "Multi-Provider Support"
  priority: P1
  points: 8
  description: >
    As an accountant, I need to connect to various Polish banks
    through a unified interface regardless of provider differences.
  features:
    - PKO Bank Polski integration
    - mBank integration
    - Provider abstraction layer
    - Santander Bank Polska
    - ING Bank Śląski
    - Aggregator fallback
    - Provider health monitoring
  dependencies: [BNK-001]
  phase: "Week 24"

BNK-010:
  title: "Banking Analytics & Reporting"
  priority: P2
  points: 5
  description: >
    As an accountant, I need analytics on banking operations
    so that I can optimize cash management and identify issues.
  features:
    - Cash flow analysis
    - Payment success metrics
    - Reconciliation statistics
    - Bank fee analysis
    - Connection health reports
    - API usage tracking
    - Export capabilities
  dependencies: [BNK-003, BNK-007]
  phase: "Week 24"
```

---

## Technical Architecture

### Database Schema Overview
```sql
-- Core tables
bank_connections        -- PSD2 connections with encrypted tokens
bank_accounts          -- Connected bank accounts
bank_transactions      -- Imported transactions
payments               -- Payment initiation records
reconciliation_reports -- Reconciliation results
transaction_categories -- AI categorization
webhook_subscriptions  -- Webhook configurations
```

### Key Entities
```typescript
// Connection status
enum ConnectionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  DISCONNECTED = 'DISCONNECTED'
}

// Account types
enum AccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
  CREDIT = 'CREDIT',
  LOAN = 'LOAN',
  INVESTMENT = 'INVESTMENT'
}

// Transaction types
enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT'
}

// Payment types
enum PaymentType {
  SEPA = 'SEPA',
  SEPA_INSTANT = 'SEPA_INSTANT',
  DOMESTIC = 'DOMESTIC',
  INTERNATIONAL = 'INTERNATIONAL'
}

// Reconciliation status
enum ReconciliationStatus {
  UNMATCHED = 'UNMATCHED',
  MATCHED = 'MATCHED',
  PARTIALLY_MATCHED = 'PARTIALLY_MATCHED',
  MANUALLY_MATCHED = 'MANUALLY_MATCHED',
  EXCLUDED = 'EXCLUDED'
}
```

### API Endpoints
```typescript
// Connection management
POST   /api/trpc/bnk.connect
GET    /api/trpc/bnk.getConnections
PUT    /api/trpc/bnk.refreshConnection
DELETE /api/trpc/bnk.disconnect

// Account operations
GET    /api/trpc/bnk.getAccounts
GET    /api/trpc/bnk.getBalance
POST   /api/trpc/bnk.syncAccounts

// Transaction operations
GET    /api/trpc/bnk.getTransactions
POST   /api/trpc/bnk.importTransactions
POST   /api/trpc/bnk.categorizeTransaction

// Payment operations
POST   /api/trpc/bnk.initiatePayment
GET    /api/trpc/bnk.getPaymentStatus
DELETE /api/trpc/bnk.cancelPayment

// Reconciliation
POST   /api/trpc/bnk.reconcile
GET    /api/trpc/bnk.getSuggestions
POST   /api/trpc/bnk.confirmMatch

// Webhooks
POST   /api/webhooks/banking/:provider
```

---

## Implementation Phases

### Week 21: Foundation
- BNK-001: Bank Connection Management
- BNK-002: Account Aggregation & Balance

### Week 22: Transactions
- BNK-003: Transaction Import & Normalization
- BNK-004: AI Transaction Categorization

### Week 23: Payments & Reconciliation
- BNK-005: Payment Initiation
- BNK-006: Payment Status & Management
- BNK-007: Transaction Reconciliation

### Week 24: Advanced Features
- BNK-008: Webhook Management
- BNK-009: Multi-Provider Support
- BNK-010: Banking Analytics & Reporting

---

## Agents Involved

| Agent | Role | Stories |
|-------|------|---------|
| banking-expert | PSD2 integration, payment processing | All |
| security-architect | Token encryption, audit trails | BNK-001, BNK-005 |
| backend | API implementation | All |
| ai-architect | Transaction categorization | BNK-004, BNK-007 |

---

## Acceptance Criteria Summary

### Non-Functional Requirements
- All tokens encrypted with AES-256-GCM
- TLS 1.3 for all bank communications
- Complete audit trail for banking operations
- GDPR-compliant data handling
- PSD2 SCA compliance

### Performance Requirements
- Connection establishment: <5s
- Balance retrieval: <1s
- Transaction import: <10s for 1000 transactions
- Payment initiation: <2s
- Reconciliation: <5s for batch

### External Services
- Polish banks (PKO, mBank, Santander, ING)
- Ministry of Finance (White List API)
- Banking aggregators (optional fallback)

---

## Polish Banking Specifics

### Supported Banks
1. **PKO Bank Polski** - Largest Polish bank
2. **mBank** - Modern API, good documentation
3. **Santander Bank Polska** - European standards
4. **ING Bank Śląski** - Good Open Banking support
5. **Bank Pekao** - Second largest bank
6. **BNP Paribas** - European integration
7. **Alior Bank** - Digital-first approach
8. **Credit Agricole** - Agricultural sector

### Payment Specifics
- **Split Payment (Podzielona Płatność)**: Required for B2B >15,000 PLN
- **White List Verification**: Mandatory for VAT payer accounts
- **Elixir**: Domestic transfer system
- **Express Elixir**: Instant domestic transfers
- **SORBNET2**: Large value payments

### Regulatory Compliance
- PSD2 (EU Directive 2015/2366)
- Polish Payment Services Act
- Strong Customer Authentication (SCA)
- 90-day consent validity
- Data retention requirements

---

## Story Points Summary

| Priority | Stories | Points |
|----------|---------|--------|
| P0 | 6 | 60 |
| P1 | 3 | 21 |
| P2 | 1 | 5 |
| **Total** | **10** | **86** |

---

*Last updated: December 2024*
