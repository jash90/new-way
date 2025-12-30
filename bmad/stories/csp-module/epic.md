# Epic: Client Self-Service Portal (CSP) Module

## Epic Overview

| Field | Value |
|-------|-------|
| Epic ID | CSP-EPIC |
| Module | Client Self-Service Portal |
| Priority | P2 |
| Total Story Points | 53 |
| Estimated Duration | 3 weeks |
| Dependencies | AIM, CRM, DOC, ACC, TAX |

## Business Context

### Problem Statement
Clients of accounting firms require direct access to their financial data, documents, and communication with their accounting team without needing to contact staff for routine information requests. Manual document exchange via email creates security risks and delays.

### Solution
A secure, self-service web portal enabling clients to independently access dashboards, upload/download documents, view reports, communicate with their accounting team, and manage their profile settings.

### Business Value
- **40% reduction** in support calls for routine information requests
- **Improved client satisfaction** through 24/7 access to financial data
- **Enhanced security** with encrypted document exchange
- **Faster document processing** through direct client uploads
- **Audit compliance** with complete activity tracking

## Technical Foundation

### Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| Frontend | React 18 + TypeScript | Component reusability, type safety |
| UI Library | Material-UI v5 | Consistent design, accessibility |
| State Management | Redux Toolkit + RTK Query | Centralized state, efficient caching |
| Backend | NestJS + TypeScript | Type-safe, modular architecture |
| Database | PostgreSQL 15 | ACID compliance for financial data |
| Caching | Redis 7 | Session management, data caching |
| File Storage | AWS S3 + CloudFront | Scalable document storage with CDN |
| Real-time | WebSockets (Socket.io) | Instant messaging, notifications |
| Security | JWT + OAuth 2.0 + AES-256 | Enterprise-grade authentication |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Client Self-Service Portal                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │  Dashboard  │  │   Document   │  │      Messaging         │ │
│  │    View     │  │   Manager    │  │       Center           │ │
│  └──────┬──────┘  └──────┬───────┘  └───────────┬─────────────┘ │
│         │                │                       │               │
│  ┌──────┴──────┐  ┌──────┴───────┐  ┌───────────┴─────────────┐ │
│  │   Report    │  │   Profile    │  │      Notification       │ │
│  │   Viewer    │  │   Manager    │  │        Center           │ │
│  └──────┬──────┘  └──────┬───────┘  └───────────┬─────────────┘ │
├─────────┴────────────────┴───────────────────────┴───────────────┤
│                         API Gateway                               │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │   Auth   │ │   CRM    │ │   DOC    │ │   ACC    │ │  TAX   │ │
│  │ Service  │ │ Service  │ │ Service  │ │ Service  │ │Service │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘ │
├──────────────────────────────────────────────────────────────────┤
│  PostgreSQL  │    Redis    │    AWS S3    │    WebSocket        │
└──────────────────────────────────────────────────────────────────┘
```

### Core Database Tables

```sql
-- Portal sessions with device fingerprinting
CREATE TABLE portal_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  access_token_hash VARCHAR(64) NOT NULL,
  refresh_token_hash VARCHAR(64) NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  device_fingerprint VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Portal documents with versioning
CREATE TABLE portal_documents (
  document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  tax_year INTEGER,
  description TEXT,
  tags JSONB DEFAULT '[]',
  s3_location TEXT NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  encrypted BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID NOT NULL,
  modified_at TIMESTAMPTZ DEFAULT NOW()
);

-- Secure messaging with threading
CREATE TABLE portal_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  thread_id UUID,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'NORMAL',
  sender_type VARCHAR(20) NOT NULL, -- 'CLIENT', 'STAFF'
  sender_id UUID NOT NULL,
  attachments JSONB DEFAULT '[]',
  reply_to_message_id UUID REFERENCES portal_messages(message_id),
  encrypted BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'SENT'
);

-- Activity log for audit trail
CREATE TABLE portal_activity_log (
  activity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  session_id UUID REFERENCES portal_sessions(session_id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  ip_address INET,
  user_agent TEXT,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  correlation_id UUID,
  metadata JSONB DEFAULT '{}'
);

-- Notifications
CREATE TABLE portal_notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(client_id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'NORMAL',
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'PENDING'
);
```

## Story Map

### Sprint 1: Foundation & Dashboard (Week 29)

| Story ID | Story Name | Points | Priority | Dependencies |
|----------|------------|--------|----------|--------------|
| CSP-001 | Client Dashboard | 8 | P0 | AIM, CRM |
| CSP-002 | Document Management | 8 | P0 | DOC |

### Sprint 2: Reports & Communication (Week 30)

| Story ID | Story Name | Points | Priority | Dependencies |
|----------|------------|--------|----------|--------------|
| CSP-003 | Invoice & Payment Portal | 8 | P1 | ACC |
| CSP-004 | Report Access & Download | 5 | P1 | ACC, TAX |
| CSP-005 | Secure Messaging | 8 | P1 | - |

### Sprint 3: Onboarding & UX (Week 31)

| Story ID | Story Name | Points | Priority | Dependencies |
|----------|------------|--------|----------|--------------|
| CSP-006 | Client Onboarding Wizard | 5 | P1 | CRM |
| CSP-007 | Profile & Preferences | 5 | P2 | CRM |
| CSP-008 | Mobile-Responsive UI | 6 | P2 | All CSP |

## Story Dependency Graph

```
                    ┌─────────────────┐
                    │    AIM Auth     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌──────────┐   ┌──────────┐   ┌──────────┐
       │ CSP-001  │   │ CSP-002  │   │ CSP-006  │
       │Dashboard │   │Documents │   │Onboarding│
       └────┬─────┘   └────┬─────┘   └────┬─────┘
            │              │              │
    ┌───────┴──────┐       │              │
    ▼              ▼       ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ CSP-003  │ │ CSP-004  │ │ CSP-005  │ │ CSP-007  │
│ Invoices │ │ Reports  │ │Messaging │ │ Profile  │
└────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
     │            │            │            │
     └────────────┴────────────┴────────────┘
                       │
                       ▼
                ┌──────────┐
                │ CSP-008  │
                │  Mobile  │
                └──────────┘
```

## User Personas

### Primary: Business Owner / Financial Manager
- **Needs**: Quick access to financial KPIs, document submission, report downloads
- **Pain Points**: Manual document exchange, waiting for accountant responses
- **Goals**: Self-service access 24/7, secure communication

### Secondary: Bookkeeper / Administrative Staff
- **Needs**: Upload invoices, view transaction history, communicate issues
- **Pain Points**: Email-based document submission, lack of status visibility
- **Goals**: Streamlined document submission, clear task tracking

## Acceptance Criteria Summary

### Functional Requirements

1. **Authentication & Security**
   - MFA support (TOTP, SMS)
   - OAuth 2.0 SSO integration
   - Session timeout with configurable duration
   - Device fingerprinting and trusted devices
   - Brute-force protection (5 failed attempts → 15min lockout)

2. **Dashboard**
   - Real-time KPIs: Revenue, Expenses, Profit Margin, Outstanding Invoices
   - Interactive charts: Revenue trends, expense breakdown
   - Tax calendar with upcoming deadlines
   - Recent activity feed
   - Pending tasks and notifications

3. **Document Management**
   - Upload with drag-and-drop (max 50MB, configurable file types)
   - Automatic categorization suggestions
   - Full-text search across documents
   - Version history
   - Secure download with audit logging

4. **Reporting**
   - View generated financial reports
   - Download in PDF/Excel formats
   - Schedule recurring report delivery
   - Custom date range filtering

5. **Messaging**
   - Encrypted two-way communication
   - Thread-based conversations
   - File attachments
   - Read receipts
   - Priority flagging

### Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Page Load Time | < 2 seconds (P95) |
| API Response Time | < 500ms (P95) |
| Uptime | 99.9% |
| File Upload Speed | > 1MB/s |
| Concurrent Users | 1000+ per tenant |
| Mobile Support | iOS 14+, Android 10+ |
| Accessibility | WCAG 2.1 AA |
| Browser Support | Chrome, Firefox, Safari, Edge (latest 2 versions) |

### Security Requirements

- AES-256-GCM encryption for documents at rest
- TLS 1.3 for data in transit
- GDPR/RODO compliance for data handling
- Complete audit trail (7-year retention)
- Row-level security per tenant and client
- Rate limiting: 100 requests/15min per IP

## API Design

### tRPC Router Structure

```typescript
// Main portal router
export const portalRouter = router({
  // Dashboard
  dashboard: dashboardRouter,

  // Documents
  documents: documentRouter,

  // Reports
  reports: reportRouter,

  // Messages
  messages: messageRouter,

  // Profile
  profile: profileRouter,

  // Notifications
  notifications: notificationRouter,

  // Activity
  activity: activityRouter,
});

// Client-scoped procedures
const clientProcedure = publicProcedure
  .use(portalAuthMiddleware)
  .use(({ ctx, next }) => {
    return next({
      ctx: {
        ...ctx,
        clientId: ctx.portalSession.clientId,
        tenantId: ctx.portalSession.tenantId,
      },
    });
  });
```

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/portal/dashboard` | GET | Get dashboard data with KPIs |
| `/portal/documents` | GET | List client documents |
| `/portal/documents/upload` | POST | Upload new document |
| `/portal/documents/:id/download` | GET | Download document |
| `/portal/reports` | GET | List available reports |
| `/portal/reports/:id/download` | GET | Download report |
| `/portal/messages` | GET/POST | Get/send messages |
| `/portal/profile` | GET/PUT | Get/update profile |
| `/portal/notifications` | GET | Get notifications |
| `/portal/activity` | GET | Get activity log |

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance degradation under load | Medium | High | CDN, caching, load testing |
| Security breach | Low | Critical | Penetration testing, security audits |
| Document storage quota exceeded | Medium | Medium | Storage monitoring, archival policies |
| Real-time messaging delays | Medium | Medium | WebSocket fallback to polling |
| Browser compatibility issues | Low | Medium | Cross-browser testing, polyfills |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Client Portal Adoption | 70% of clients | Active users / Total clients |
| Document Upload Rate | 50% of docs via portal | Portal uploads / Total uploads |
| Support Call Reduction | 40% decrease | Support tickets / month |
| Client Satisfaction | NPS > 50 | Quarterly surveys |
| Page Load Time | < 2s P95 | Performance monitoring |
| Uptime | 99.9% | Availability monitoring |

## Implementation Notes

### Multi-tenancy Strategy
- All database tables include `tenant_id` column
- Row-Level Security (RLS) policies enforced at database level
- Separate S3 prefixes per tenant for document storage
- Redis key namespacing: `portal:{tenant_id}:{client_id}:*`

### Caching Strategy
- Dashboard data: 5-minute TTL, invalidate on data changes
- Document lists: 10-minute TTL, invalidate on upload/delete
- Reports: 30-minute TTL
- User profile: Session-scoped caching

### Internationalization
- Support for Polish (pl) and English (en) initially
- Date formats: DD.MM.YYYY (Polish), MM/DD/YYYY (English)
- Currency formatting per locale
- All UI strings in translation files
- Right-to-left (RTL) support prepared for future

## Definition of Done

- [ ] All acceptance criteria met and verified
- [ ] Unit test coverage ≥ 80%
- [ ] Integration tests for all API endpoints
- [ ] E2E tests for critical user journeys
- [ ] Security review completed
- [ ] Performance benchmarks met
- [ ] Accessibility audit passed (WCAG 2.1 AA)
- [ ] Documentation updated
- [ ] Code reviewed and approved
- [ ] Deployed to staging and verified
