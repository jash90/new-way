# 📁 Project Context: Accounting CRM Platform

> **Project Codename**: KsięgowaCRM
> **Version**: 1.0.0-beta
> **Started**: December 2024
> **Last Updated**: December 2024
> **BMAD Coverage**: 11 modules | 117 stories | 8 agents | 4 checklists

---

## 🎯 Project Overview

### What We're Building

A comprehensive, AI-powered accounting platform tailored specifically for the Polish market. The system integrates CRM functionality, accounting automation, HR management, and AI capabilities into a unified solution.

### Problem Statement

Polish accounting firms (biura rachunkowe) currently face:

1. **Tool Fragmentation**: Average firm uses 5-7 disconnected applications
2. **Manual Data Entry**: Same data entered multiple times across systems
3. **Compliance Burden**: Complex Polish tax regulations require constant attention
4. **Scaling Difficulties**: Traditional tools don't scale with client growth
5. **Limited Automation**: Most processes remain manual and error-prone

### Solution

An all-in-one platform that:
- Centralizes client data and communication
- Automates routine accounting tasks
- Integrates with Polish government systems (KSeF, ZUS, GUS)
- Provides AI-powered document processing and tax guidance
- Scales from solo practitioners to large firms

---

## 🏗️ Technical Stack

### Frontend
```yaml
Framework: Next.js 14+ (App Router)
Language: TypeScript 5.x (strict mode)
Styling: TailwindCSS 3.x
Components: shadcn/ui
State: Zustand + React Query
Forms: React Hook Form + Zod
Charts: Recharts
```

### Backend
```yaml
Runtime: Node.js 20+
API Layer: tRPC v11
ORM: Prisma 5.x
Validation: Zod
Auth: Supabase Auth + custom JWT layer
Queue: BullMQ (Redis)
Workflow: n8n (self-hosted)
```

### Database & Infrastructure
```yaml
Primary DB: PostgreSQL 15+ (Supabase)
Cache: Redis 7+
Storage: Supabase Storage
Search: PostgreSQL Full-Text → Elasticsearch (Phase 2)
Hosting: Vercel (frontend) + Railway/Fly.io (backend)
```

### AI/ML
```yaml
LLM: Claude API (Anthropic) + OpenAI
OCR: Tesseract + Google Vision API
Document AI: Custom models for Polish documents
Embeddings: OpenAI text-embedding-3-small
Vector DB: Pinecone/Weaviate (for tax knowledge base)
```

---

## 📦 Module Architecture

### Core Modules

| Module | Code | Status | Priority | Phase |
|--------|------|--------|----------|-------|
| Authentication & Identity | AIM | 🟡 In Progress | P0 | 1 |
| Core CRM | CRM | 📋 Specified | P0 | 2 |
| Accounting Engine | ACC | 📋 Specified | P0 | 3 |
| Tax Compliance | TAX | 📋 Specified | P1 | 3 |
| Document Intelligence | DOC | 📋 Specified | P1 | 4 |
| Workflow Automation | WFA | 📋 Specified | P1 | 4 |
| Banking Integration | BNK | 📋 Specified | P2 | 3 |
| HR & Payroll | HRP | 📋 Specified | P2 | 5 |
| Client Portal | CSP | 📋 Specified | P2 | 6 |
| AI Agent | AAM | 📋 Specified | P2 | 4 |
| Analytics & Monitoring | MON | 📋 Specified | P3 | 6 |

### Module Dependencies

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AIM (Authentication)                         │
│                    Foundation for all modules                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
    ┌───────────┐            ┌───────────┐            ┌───────────┐
    │    CRM    │            │    ACC    │            │    HRP    │
    │  Clients  │───────────▶│ Accounting│◀───────────│  HR/Pay   │
    └───────────┘            └───────────┘            └───────────┘
          │                       │ │                       │
          │                       │ │                       │
          ▼                       ▼ ▼                       ▼
    ┌───────────┐            ┌───────────┐            ┌───────────┐
    │    DOC    │◀───────────│    TAX    │            │    ZUS    │
    │ Documents │            │Compliance │            │ (in HRP)  │
    └───────────┘            └───────────┘            └───────────┘
          │                       │
          └───────────┬───────────┘
                      ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                    Integration Layer                           │
    │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  │
    │  │    BNK    │  │    WFA    │  │    AAM    │  │    CSP    │  │
    │  │  Banking  │  │ Workflows │  │ AI Agent  │  │  Portal   │  │
    │  └───────────┘  └───────────┘  └───────────┘  └───────────┘  │
    └───────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │      MON      │
                            │  Monitoring   │
                            └───────────────┘
```

### Module Story Counts

| Module | Stories | Story Points | Key Features |
|--------|---------|--------------|--------------|
| AIM | 12 | 58 | Auth, MFA, Tenant, Roles |
| CRM | 12 | 70 | Clients, GUS/REGON, Search |
| ACC | 15 | 90 | Chart of Accounts, GL, Invoicing |
| TAX | 14 | 85 | VAT/CIT/PIT, JPK, KSeF |
| DOC | 10 | 60 | OCR, Extraction, Search |
| WFA | 8 | 50 | n8n, Triggers, Templates |
| BNK | 10 | 65 | PSD2, Reconciliation |
| HRP | 12 | 75 | Payroll, ZUS, Contracts |
| CSP | 8 | 45 | Dashboard, Messaging |
| AAM | 10 | 60 | LLM, Knowledge Base |
| MON | 6 | 35 | APM, Alerts, Reports |
| **Total** | **117** | **693** | |

---

## 👥 User Personas

### Primary Persona: Księgowa Anna

**Demographics**:
- Age: 35-50
- Role: Owner/Senior Accountant at small biuro rachunkowe
- Tech comfort: Moderate (uses Excel daily, familiar with banking apps)

**Goals**:
- Serve more clients without hiring
- Reduce manual data entry
- Stay compliant with changing regulations
- Provide better service to clients

**Pain Points**:
- Too many disconnected tools
- Manual processes eating up time
- Constant regulatory changes
- Client communication overhead

### Secondary Persona: Przedsiębiorca Marek

**Demographics**:
- Age: 30-45
- Role: SME owner (5-50 employees)
- Tech comfort: Variable (smartphone-first)

**Goals**:
- Understand financial position quickly
- Submit documents easily
- Get tax advice when needed
- Reduce accounting costs

**Pain Points**:
- Doesn't understand accounting jargon
- Forgets to send documents on time
- Surprised by tax bills
- Can't access data when needed

---

## 🗓️ Development Roadmap (24 Weeks)

### Phase 1: Foundation (Weeks 1-4)
**Goal:** Establish core infrastructure and authentication

#### Week 1: Project Setup & Infrastructure
- [ ] Initialize monorepo with pnpm workspaces
- [ ] Set up Next.js 14 with TypeScript
- [ ] Configure Supabase project
- [ ] Set up PostgreSQL schemas
- [ ] Initialize Redis for caching
- [ ] Configure n8n instance

#### Week 2: Authentication Implementation
- [ ] Implement enhanced auth module
- [ ] Set up Supabase Auth integration
- [ ] Create login/register pages
- [ ] Implement MFA setup flow
- [ ] Add session management
- [ ] Create password reset flow

#### Week 3: Core Database & Multi-tenancy
- [ ] Design and implement database schema
- [ ] Set up Row Level Security (RLS)
- [ ] Implement organization management
- [ ] Create user role system
- [ ] Add audit logging tables

#### Week 4: Admin Dashboard & User Management
- [ ] Create admin layout with shadcn/ui
- [ ] Build user management interface
- [ ] Implement permission management
- [ ] Add organization settings
- [ ] Create audit log viewer

### Phase 2: Core CRM (Weeks 5-8)
**Goal:** Build essential CRM functionality

#### Week 5: Client Management Module
- [ ] Client CRUD operations
- [ ] GUS/REGON integration
- [ ] VIES VAT validation
- [ ] Client timeline feature
- [ ] Custom fields system

#### Week 6: Document Management
- [ ] File upload system (Supabase Storage)
- [ ] OCR integration (Google Vision API)
- [ ] Document categorization
- [ ] Full-text search
- [ ] Version control system

#### Week 7: Task Management
- [ ] Task creation and assignment
- [ ] Kanban board view
- [ ] Calendar integration
- [ ] Recurring tasks
- [ ] Email notifications

#### Week 8: Communication Hub
- [ ] Internal messaging system
- [ ] Email integration
- [ ] Activity feeds
- [ ] Comment threads
- [ ] Notification center

### Phase 3: Accounting Engine (Weeks 9-12)
**Goal:** Implement core accounting features

#### Week 9: Chart of Accounts & Journal Entries
- [ ] Chart of accounts management (Polish template)
- [ ] Double-entry bookkeeping
- [ ] Journal entry posting
- [ ] General ledger
- [ ] Trial balance

#### Week 10: Invoicing & Billing
- [ ] Invoice generation
- [ ] Recurring invoices
- [ ] Payment tracking
- [ ] Multi-currency support (PLN, EUR)
- [ ] PDF generation

#### Week 11: Banking Integration
- [ ] PSD2 bank connections (mBank first)
- [ ] Transaction import
- [ ] Bank reconciliation
- [ ] Payment matching
- [ ] Cash flow tracking

#### Week 12: Polish Tax Compliance
- [ ] VAT calculations (all Polish rates)
- [ ] JPK_V7 generation
- [ ] Tax period management
- [ ] ZUS calculations preview
- [ ] Tax deadline calendar

### Phase 4: AI & Automation (Weeks 13-16)
**Goal:** Add AI capabilities and workflow automation

#### Week 13: AI Assistant Foundation
- [ ] Claude/OpenAI API integration
- [ ] Polish tax law knowledge base
- [ ] Query interpretation system
- [ ] Response generation
- [ ] Feedback loop

#### Week 14: Document Intelligence
- [ ] Smart OCR with data extraction
- [ ] Automatic categorization
- [ ] Invoice data extraction
- [ ] Validation rules
- [ ] Learning from corrections

#### Week 15: Workflow Automation with n8n
- [ ] Document reminder workflow
- [ ] Client onboarding automation
- [ ] Deadline monitoring
- [ ] Status change alerts
- [ ] Report generation

#### Week 16: Predictive Analytics
- [ ] Cash flow forecasting
- [ ] Tax liability predictions
- [ ] Client risk assessment
- [ ] Revenue predictions
- [ ] Anomaly detection

### Phase 5: HR & Payroll (Weeks 17-20)
**Goal:** Complete HR and payroll functionality

#### Week 17: Employee Management
- [ ] Employee database
- [ ] Contract generation
- [ ] Document management
- [ ] Leave tracking
- [ ] Benefits management

#### Week 18: Polish Payroll Calculations
- [ ] Salary calculations
- [ ] ZUS contributions (all types)
- [ ] Tax calculations (PIT)
- [ ] Payslip generation
- [ ] Year-end summaries (PIT-11, PIT-4R)

#### Week 19: ZUS & Labor Law Compliance
- [ ] ZUS declaration generation (DRA, RCA, RZA, RSA)
- [ ] Electronic submission to ZUS PUE
- [ ] Compliance monitoring
- [ ] Alert system
- [ ] Report generation

#### Week 20: Employee Self-Service
- [ ] Employee portal
- [ ] Leave requests
- [ ] Document access
- [ ] Payslip viewing
- [ ] Personal data management

### Phase 6: Client Portal & Mobile (Weeks 21-24)
**Goal:** Build client-facing features

#### Week 21-22: Client Portal
- [ ] Secure client login
- [ ] Document upload
- [ ] Financial dashboard
- [ ] Report viewing
- [ ] Secure messaging with accountant

#### Week 23-24: Mobile & Polish
- [ ] Responsive mobile design
- [ ] Push notifications
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Beta launch preparation

---

## 🔗 Integration Priorities

### Phase 1 Integrations (Must Have)
| Integration | Purpose | Priority |
|-------------|---------|----------|
| GUS/REGON | Company data verification | P0 |
| VIES | EU VAT validation | P0 |
| mBank | First bank integration (PSD2) | P0 |
| SendGrid | Email notifications | P0 |
| Autenti | E-signatures | P1 |

### Phase 2 Integrations (Should Have)
| Integration | Purpose | Priority |
|-------------|---------|----------|
| KSeF | E-invoicing (mandatory 2026) | P1 |
| ZUS PUE | Social security submissions | P1 |
| Google Vision | OCR for documents | P1 |
| Stripe | Platform payments | P2 |

### Phase 3 Integrations (Nice to Have)
| Integration | Purpose | Priority |
|-------------|---------|----------|
| PKO, ING, Santander | Additional banks | P2 |
| Comarch Optima | Accounting software sync | P2 |
| Zapier | Extended automation | P3 |
| Power BI | Advanced analytics | P3 |

---

## 🔑 Key Decisions Made

### ADR-001: Modular Monolith over Microservices
**Decision**: Start with modular monolith architecture
**Rationale**:
- Simpler deployment and operations for small team
- Easier refactoring during early development
- Can extract services later if needed
**Consequences**: Need strict module boundaries from day one

### ADR-002: tRPC over REST/GraphQL
**Decision**: Use tRPC for all internal APIs
**Rationale**:
- End-to-end type safety with TypeScript
- Less boilerplate than REST
- Better DX than GraphQL for our use case
**Consequences**: Tight coupling to TypeScript frontend

### ADR-003: Supabase for Auth and Database
**Decision**: Use Supabase as primary backend
**Rationale**:
- Built-in auth with Row Level Security
- Realtime subscriptions out of the box
- PostgreSQL with all features we need
- Generous free tier for development
**Consequences**: Some vendor lock-in, need to understand RLS well

### ADR-004: Decimal.js for All Financial Calculations
**Decision**: Never use floating point for money
**Rationale**:
- Floating point causes rounding errors
- Accounting requires exact precision
- Polish regulations specify rounding rules
**Consequences**: Slightly more verbose code, need conversion at boundaries

### ADR-005: Polish-First Localization
**Decision**: Build for Polish market first, then internationalize
**Rationale**:
- Deep understanding of Polish regulations required
- NIP/REGON/KSeF/ZUS are Poland-specific
- Easier to add languages later than regulations
**Consequences**: UI primarily in Polish initially

---

## ⚠️ Risk Mitigation

### Technical Risks
| Risk | Mitigation |
|------|------------|
| Performance degradation | Implement caching early, use pagination, regular profiling |
| Security vulnerabilities | Regular security audits, penetration testing, dependency scanning |
| Scalability issues | Design for horizontal scaling, use connection pooling |
| Data loss | Automated backups, point-in-time recovery, transaction logging |

### Business Risks
| Risk | Mitigation |
|------|------------|
| Competition | Focus on AI differentiator and Polish compliance |
| Adoption challenges | Free tier for small firms, extensive documentation |
| Compliance failures | Legal review before launch, continuous monitoring |
| Support burden | Build comprehensive documentation, self-service tools |

---

## 💰 Budget Estimation

### Monthly Infrastructure Costs
```yaml
Supabase Pro: $25
Vercel Pro: $20
SendGrid: $15
Google Cloud (OCR): $50
Elasticsearch: $95
n8n: Self-hosted (included in Vercel)
---
Total: ~$205/month initially
```

### Development Resources
- 1 Full-stack developer (founder)
- 1 Part-time UI/UX designer (month 2)
- 1 QA tester (month 3)
- 1 Domain expert consultant (as needed)

---

## 📊 Success Metrics

### Technical Metrics
| Metric | Target |
|--------|--------|
| API response time (p95) | < 200ms |
| Page load time | < 2s |
| Uptime | 99.9% |
| Error rate | < 0.1% |
| Test coverage | > 80% |

### Business Metrics (Post-Launch)
| Metric | Target |
|--------|--------|
| Beta users (Month 3) | 10 firms |
| Active users (Month 6) | 100 users |
| NPS Score | > 70 |
| Monthly churn | < 5% |

### Compliance Metrics
| Metric | Target |
|--------|--------|
| Security incidents | Zero |
| Audit log coverage | 100% |
| RODO compliance | Verified |
| KSeF readiness | Before February 2026 |

---

## 🚀 Go-to-Market Timeline

### Month 1-2: Development Sprint
- Core features implementation
- Internal testing

### Month 3: Private Beta
- 10 friendly accounting firms
- Feedback collection
- Bug fixes

### Month 4: Public Beta
- 50 early adopters
- Feature refinement
- Performance optimization

### Month 5: Soft Launch
- Limited marketing
- 100 target users
- Pricing validation

### Month 6: Full Launch
- Marketing campaign
- Partner program
- Scale to 500+ users

---

## 📂 Project Structure

```
accounting-crm/
├── bmad/                   # BMAD methodology files
│   ├── agents/             # AI agent specifications (8 specialists)
│   │   ├── ai-architect.md           # LLM integration, prompt engineering
│   │   ├── banking-expert.md         # PSD2, Open Banking, reconciliation
│   │   ├── document-expert.md        # OCR, AI extraction, categorization
│   │   ├── frontend-expert.md        # React, accessibility, UX
│   │   ├── hr-payroll-expert.md      # ZUS, Polish labor law
│   │   ├── polish-accounting-expert.md # Tax regulations, JPK, KSeF
│   │   ├── security-architect.md     # Threat modeling, compliance
│   │   └── workflow-expert.md        # n8n, automation patterns
│   ├── checklists/         # Review checklists (4 types)
│   │   ├── security-review.md        # Security & vulnerability checklist
│   │   ├── polish-compliance-review.md # NIP/REGON/JPK/KSeF/ZUS
│   │   ├── api-integration-review.md # External APIs, PSD2, webhooks
│   │   └── data-privacy-review.md    # GDPR/RODO compliance
│   ├── stories/            # User stories by module (117 total)
│   │   ├── aim-module/     # Authentication & Identity (12 stories)
│   │   ├── acc-module/     # Accounting Engine (15 stories)
│   │   ├── crm-module/     # Core CRM (12 stories)
│   │   ├── tax-module/     # Tax Compliance (14 stories)
│   │   ├── doc-module/     # Document Intelligence (10 stories)
│   │   ├── wfa-module/     # Workflow Automation (8 stories)
│   │   ├── bnk-module/     # Banking Integration (10 stories)
│   │   ├── hrp-module/     # HR & Payroll (12 stories)
│   │   ├── csp-module/     # Client Portal (8 stories)
│   │   ├── aam-module/     # AI Agent (10 stories)
│   │   └── mon-module/     # Monitoring & Analytics (6 stories)
│   ├── templates/          # Document templates
│   ├── workflows/          # Development workflows
│   ├── constitution.md     # Non-negotiable rules (v2.0.0)
│   └── project.md          # This file
├── apps/
│   ├── web/                # Next.js frontend
│   └── api/                # Backend services
├── packages/
│   ├── database/           # Prisma schema & migrations
│   ├── shared/             # Shared types & utilities
│   └── ui/                 # Shared UI components
├── docs/                   # Technical specifications
└── tools/                  # Build tools & scripts
```

---

## 📋 BMAD Summary

### Specification Coverage

The BMAD (Big Model Agent Development) methodology has been fully applied to this project:

| Component | Count | Description |
|-----------|-------|-------------|
| Epics | 11 | One per module, with full dependency mapping |
| User Stories | 117 | Detailed specifications with acceptance criteria |
| Agents | 8 | Domain-specific AI agent specifications |
| Checklists | 4 | Security, compliance, API, and privacy reviews |

### Story Distribution by Priority

| Priority | Modules | Stories | Focus |
|----------|---------|---------|-------|
| P0 | AIM, CRM, ACC | 39 | Core foundation |
| P1 | TAX, DOC, WFA | 32 | Polish compliance |
| P2 | BNK, HRP, CSP, AAM | 40 | Integration & AI |
| P3 | MON | 6 | Observability |

### Key Documentation References

| Document | Location | Purpose |
|----------|----------|---------|
| Constitution | `bmad/constitution.md` | Non-negotiable rules (v2.0.0) |
| Module Epics | `bmad/stories/*/epic.md` | Module overview and story maps |
| Story Template | `bmad/templates/story.md` | Standard story format |
| Security Review | `bmad/checklists/security-review.md` | Security checklist |
| Polish Compliance | `bmad/checklists/polish-compliance-review.md` | Regulatory compliance |

---

## 📞 External Resources

### Documentation
- Technical Specs: `/docs/`
- API Reference: `/docs/api/`
- Architecture: `/docs/architecture/`

### Polish Government APIs
- [KSeF Documentation](https://www.podatki.gov.pl/ksef/)
- [ZUS PUE API](https://www.zus.pl/)
- [GUS REGON API](https://api.stat.gov.pl/)
- [NBP Exchange Rates](https://api.nbp.pl/)
- [e-Urząd Skarbowy](https://www.podatki.gov.pl/)

### Banking APIs (PSD2)
- [mBank API](https://developer.mbank.pl/)
- [PKO BP API](https://developer.pkobp.pl/)
- [ING Bank Śląski API](https://developer.ing.pl/)

---

*Last updated: December 2024*
