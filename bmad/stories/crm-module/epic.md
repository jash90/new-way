# Epic: Core CRM Module (CRM)

> **Module Code**: CRM
> **Priority**: P0 (Core)
> **Phase**: 2 (Weeks 5-8)
> **Status**: 📋 Specified

---

## Overview

### Description
The Core CRM Module serves as the central hub for managing all client-related data and interactions within the accounting platform. It provides a unified view of client information, automates data enrichment from Polish government sources (GUS, REGON, VIES), and enables intelligent client management through AI-powered insights. This module implements complete client lifecycle management compliant with Polish business regulations.

### Business Value
- **Centralized Data**: Single source of truth for all client information
- **Automation**: Automatic data enrichment from government systems
- **Compliance**: Built-in Polish NIP/REGON/KRS validation
- **Intelligence**: AI-powered risk assessment and churn prediction
- **Efficiency**: Streamlined client onboarding and management

### Success Criteria
- 100% NIP format validation accuracy
- <3s response time for GUS data enrichment
- 99.9% data consistency across client records
- Full audit trail for all client modifications
- Sub-200ms search response time with Elasticsearch

---

## Dependencies

### Depends On
- **AIM**: Authentication & user context for permissions
- **Infrastructure**: PostgreSQL, Redis, Elasticsearch setup

### Depended By
- **ACC**: Client context for accounting transactions
- **TAX**: Client tax configuration for declarations
- **DOC**: Client document associations
- **BNK**: Client bank account management
- **HRP**: Client employee management
- **CSP**: Client self-service portal access

---

## Story Map

### User Journey: Client Lifecycle Management

```
                         CORE CRM MODULE (CRM)
                                  │
    ┌─────────────────────────────┼─────────────────────────────┐
    │                             │                             │
    ▼                             ▼                             ▼
┌─────────┐              ┌─────────────┐               ┌─────────────┐
│  SETUP  │              │   DAILY     │               │  ANALYTICS  │
│         │              │ OPERATIONS  │               │             │
└────┬────┘              └──────┬──────┘               └──────┬──────┘
     │                          │                             │
     ▼                          ▼                             ▼
┌─────────┐              ┌─────────────┐               ┌─────────────┐
│CRM-001  │              │CRM-004      │               │CRM-009      │
│Client   │              │Contact      │               │AI Risk      │
│Profiles │              │Management   │               │Assessment   │
└────┬────┘              └──────┬──────┘               └──────┬──────┘
     │                          │                             │
     ▼                          ▼                             ▼
┌─────────┐              ┌─────────────┐               ┌─────────────┐
│CRM-002  │              │CRM-005      │               │CRM-010      │
│GUS/REGON│              │Client       │               │Bulk         │
│Integration│            │Timeline     │               │Operations   │
└────┬────┘              └──────┬──────┘               └──────┬──────┘
     │                          │                             │
     ▼                          ▼                             ▼
┌─────────┐              ┌─────────────┐               ┌─────────────┐
│CRM-003  │              │CRM-006      │               │CRM-011      │
│VAT/VIES │              │Custom       │               │Client       │
│Validation│             │Fields       │               │Statistics   │
└────┬────┘              └──────┬──────┘               └──────┬──────┘
     │                          │                             │
     ▼                          ▼                             ▼
┌─────────┐              ┌─────────────┐               ┌─────────────┐
│CRM-007  │              │CRM-008      │               │CRM-012      │
│Tagging  │              │Search &     │               │Portal       │
│System   │              │Filtering    │               │Access       │
└─────────┘              └─────────────┘               └─────────────┘
```

---

## Stories

### Setup Phase (Foundation)

```yaml
CRM-001:
  title: "Client Profile Management"
  priority: P0
  points: 13
  description: >
    As an accountant, I need to create and manage client profiles
    with complete company information so that I can track all
    client data in one place.
  dependencies: [AIM]
  phase: "Week 5"

CRM-002:
  title: "GUS/REGON Integration"
  priority: P0
  points: 8
  description: >
    As an accountant, I need automatic data enrichment from GUS/REGON
    so that I can quickly populate client information with official data.
  dependencies: [CRM-001]
  phase: "Week 5"

CRM-003:
  title: "VAT/VIES Validation"
  priority: P0
  points: 5
  description: >
    As an accountant, I need to validate EU VAT numbers and check
    Polish tax whitelist status so that I can ensure compliance.
  dependencies: [CRM-001]
  phase: "Week 5"

CRM-007:
  title: "Tagging and Categorization"
  priority: P1
  points: 5
  description: >
    As an accountant, I need to tag and categorize clients
    so that I can organize and filter them efficiently.
  dependencies: [CRM-001]
  phase: "Week 5"
```

### Daily Operations

```yaml
CRM-004:
  title: "Contact Management"
  priority: P0
  points: 8
  description: >
    As an accountant, I need to manage multiple contacts per client
    with roles and preferences so that I can communicate effectively.
  dependencies: [CRM-001]
  phase: "Week 6"

CRM-005:
  title: "Client Timeline"
  priority: P1
  points: 8
  description: >
    As an accountant, I need to view chronological history of all
    client interactions so that I can track relationship progress.
  dependencies: [CRM-001]
  phase: "Week 6"

CRM-006:
  title: "Custom Fields System"
  priority: P2
  points: 5
  description: >
    As an accountant, I need flexible custom fields
    so that I can store industry-specific client data.
  dependencies: [CRM-001]
  phase: "Week 6"

CRM-008:
  title: "Advanced Search and Filtering"
  priority: P0
  points: 8
  description: >
    As an accountant, I need advanced search capabilities
    so that I can quickly find clients by any criteria.
  dependencies: [CRM-001]
  phase: "Week 7"
```

### Analytics & Integration

```yaml
CRM-009:
  title: "AI Risk Assessment"
  priority: P1
  points: 8
  description: >
    As an accountant, I need AI-powered risk assessment
    so that I can proactively manage client relationships.
  dependencies: [CRM-001, CRM-003]
  phase: "Week 7"

CRM-010:
  title: "Bulk Operations"
  priority: P1
  points: 8
  description: >
    As an accountant, I need bulk import/export capabilities
    so that I can efficiently manage large client datasets.
  dependencies: [CRM-001]
  phase: "Week 7"

CRM-011:
  title: "Client Statistics"
  priority: P2
  points: 5
  description: >
    As an accountant, I need client statistics and analytics
    so that I can understand engagement and performance.
  dependencies: [CRM-001, CRM-005]
  phase: "Week 8"

CRM-012:
  title: "Portal Access Management"
  priority: P2
  points: 5
  description: >
    As an accountant, I need to manage client portal access
    so that clients can view their own information.
  dependencies: [CRM-001, CRM-004, AIM]
  phase: "Week 8"
```

---

## Technical Architecture

### Database Schema Overview
```sql
-- Core tables
clients                 -- Client profiles with company data
client_contacts         -- Contact persons per client
client_timeline         -- Chronological event history
client_tags             -- Tag associations
client_custom_fields    -- Flexible custom field values
client_documents        -- Document associations
client_bank_accounts    -- Bank account information
client_versions         -- Historical versions for audit
```

### Key Entities
```typescript
// Client statuses
enum ClientStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
  ARCHIVED = 'ARCHIVED'
}

// Tax forms per Polish regulations
enum TaxForm {
  CIT = 'CIT',           // Podatek dochodowy od osób prawnych
  PIT = 'PIT',           // Podatek dochodowy od osób fizycznych
  VAT = 'VAT',           // Podatek od towarów i usług
  FLAT_TAX = 'FLAT_TAX', // Podatek liniowy 19%
  LUMP_SUM = 'LUMP_SUM'  // Ryczałt od przychodów
}

// VAT status
enum VATStatus {
  ACTIVE = 'ACTIVE',
  NOT_REGISTERED = 'NOT_REGISTERED',
  INVALID = 'INVALID',
  EXEMPT = 'EXEMPT'
}

// Risk levels
enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}
```

### API Endpoints
```typescript
// Client CRUD
POST   /api/trpc/crm.createClient
GET    /api/trpc/crm.getClients
GET    /api/trpc/crm.getClientById
PUT    /api/trpc/crm.updateClient
DELETE /api/trpc/crm.deleteClient
POST   /api/trpc/crm.restoreClient

// Data Enrichment
POST   /api/trpc/crm.enrichFromGUS
POST   /api/trpc/crm.validateVATEU
POST   /api/trpc/crm.verifyWhiteList

// Contacts
GET    /api/trpc/crm.getContacts
POST   /api/trpc/crm.addContact
PUT    /api/trpc/crm.updateContact
DELETE /api/trpc/crm.removeContact

// Timeline
GET    /api/trpc/crm.getTimeline
POST   /api/trpc/crm.addTimelineEvent

// Search & Analytics
GET    /api/trpc/crm.searchClients
POST   /api/trpc/crm.assessRisk
GET    /api/trpc/crm.getStatistics

// Bulk Operations
POST   /api/trpc/crm.bulkImport
POST   /api/trpc/crm.bulkExport
```

---

## Implementation Phases

### Week 5: Foundation
- CRM-001: Client Profile Management
- CRM-002: GUS/REGON Integration
- CRM-003: VAT/VIES Validation
- CRM-007: Tagging and Categorization

### Week 6: Operations
- CRM-004: Contact Management
- CRM-005: Client Timeline
- CRM-006: Custom Fields System

### Week 7: Search & Intelligence
- CRM-008: Advanced Search and Filtering
- CRM-009: AI Risk Assessment
- CRM-010: Bulk Operations

### Week 8: Analytics & Portal
- CRM-011: Client Statistics
- CRM-012: Portal Access Management

---

## Agents Involved

| Agent | Role | Stories |
|-------|------|---------|
| polish-accounting-expert | Domain validation, Polish standards | CRM-002, CRM-003 |
| security-architect | Data protection, access control | All |
| backend | API implementation, integrations | All |

---

## Acceptance Criteria Summary

### Non-Functional Requirements
- All NIP/REGON/KRS validated against official formats
- GUS API integration with 5s timeout and retry logic
- VIES EU VAT validation with fallback handling
- Full audit trail for all client data changes
- Row-level security for multi-tenant isolation

### Performance Requirements
- Client list load: <200ms with pagination
- Search response: <300ms for full-text search
- GUS enrichment: <5s end-to-end
- Client creation: <500ms including enrichment
- Export generation: <10s for 1000 records

---

## Story Points Summary

| Priority | Stories | Points |
|----------|---------|--------|
| P0 | 5 | 42 |
| P1 | 4 | 29 |
| P2 | 3 | 15 |
| **Total** | **12** | **86** |

---

*Last updated: December 2024*
