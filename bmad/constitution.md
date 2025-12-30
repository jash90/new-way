# 🏛️ Accounting CRM Platform Constitution

> **Version**: 2.0.0
> **Last Updated**: 2024-12-29
> **Status**: Active

This constitution defines the **non-negotiable principles** that govern all development activities in the Accounting CRM Platform project. All AI agents, developers, and contributors MUST adhere to these rules without exception.

---

## 📋 Table of Contents

1. [Project Identity](#project-identity)
2. [Module Registry](#module-registry)
3. [Financial Calculation Standards](#financial-calculation-standards)
4. [Security Requirements](#security-requirements)
5. [Polish Compliance Requirements](#polish-compliance-requirements)
6. [Code Standards](#code-standards)
7. [Architecture Principles](#architecture-principles)
8. [Testing Requirements](#testing-requirements)
9. [Data Protection](#data-protection)
10. [Audit Requirements](#audit-requirements)
11. [Integration Standards](#integration-standards)
12. [Module-Specific Requirements](#module-specific-requirements)
13. [AI & LLM Integration Standards](#ai-llm-integration-standards)

---

## 🎯 Project Identity

### Mission Statement
Build Poland's most comprehensive, AI-powered accounting platform that transforms how biura rachunkowe (accounting firms) serve their SME clients.

### Target Market
- **Primary**: ~30,000 Polish accounting firms (biura rachunkowe)
- **Secondary**: 1.5M Polish SMEs requiring accounting services
- **Tertiary**: Enterprise clients with complex compliance needs

### Core Value Proposition
- End-to-end accounting automation with Polish regulatory compliance
- AI-powered document processing and tax interpretation
- Unified platform replacing 5-7 fragmented tools

---

## 📦 Module Registry

### Platform Modules

The Accounting CRM Platform consists of 11 core modules organized by implementation priority:

| Module ID | Module Name | Priority | Description |
|-----------|-------------|----------|-------------|
| AIM | Authentication & Identity | P0 | User auth, MFA, sessions, RBAC, audit logging |
| CRM | Client Relationship Management | P0 | Client management, contacts, GUS/REGON lookup |
| ACC | Accounting Engine | P0 | Chart of accounts, GL, journal entries, statements |
| TAX | Tax Compliance | P1 | VAT, CIT, PIT calculations, JPK, KSeF integration |
| DOC | Document Intelligence | P1 | OCR, AI extraction, document classification |
| WFA | Workflow Automation | P1 | n8n integration, process automation |
| BNK | Banking Integration | P2 | PSD2/Open Banking, reconciliation, payments |
| HRP | HR & Payroll | P2 | Employees, contracts, ZUS, payroll, PIT-11 |
| CSP | Client Self-Service Portal | P2 | Client dashboard, document sharing, messaging |
| AAM | AI Agent Module | P2 | LLM integration, custom agents, knowledge base |
| MON | Monitoring & Analytics | P3 | APM, alerts, dashboards, reporting |

### Module Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API Gateway (tRPC)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
     ┌──────────┬──────────┬───────┼───────┬──────────┬──────────┐
     │          │          │       │       │          │          │
     ▼          ▼          ▼       ▼       ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│  AIM   │ │  CRM   │ │  ACC   │ │  TAX   │ │  DOC   │ │  WFA   │ │  AAM   │
│ (Auth) │ │(Client)│ │(Ledger)│ │ (Tax)  │ │ (Docs) │ │(Workfl)│ │  (AI)  │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
     │          │          │       │       │          │          │
     │     ┌────┴──────────┼───────┼───────┤          │          │
     │     │               │       │       │          │          │
     ▼     ▼               ▼       ▼       ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│  BNK   │ │  HRP   │ │  CSP   │ │  MON   │
│(Bank)  │ │ (HR)   │ │(Portal)│ │(Monitor│
└────────┘ └────────┘ └────────┘ └────────┘
     │          │          │       │
     └──────────┴──────────┴───────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Shared Infrastructure                                 │
│     (PostgreSQL, Redis, BullMQ, Supabase Storage, Event Bus, InfluxDB)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Module Interface Contracts

```typescript
// All modules MUST expose their public interface via barrel exports
// src/modules/{module}/index.ts

// Example: AIM module exports
export { AuthService } from './services/auth.service';
export { SessionService } from './services/session.service';
export { authRouter } from './routers/auth.router';
export type { User, Session, Permission } from './types';

// Cross-module communication via events
interface ModuleEvents {
  'aim:user.created': { userId: string; tenantId: string };
  'crm:client.created': { clientId: string; tenantId: string };
  'acc:journal.posted': { journalId: string; tenantId: string };
  'tax:declaration.submitted': { declarationType: string; period: string };
  'doc:document.processed': { documentId: string; extractedData: object };
  'bnk:transaction.imported': { transactionId: string; bankId: string };
  'hrp:payroll.calculated': { payrollId: string; period: string };
}
```

### Multi-Tenancy Requirements

```typescript
// MANDATORY: All modules must enforce tenant isolation
interface TenantIsolation {
  // Every table must include tenant_id
  tenantId: string;

  // RLS policies required on all tables
  rlsPolicy: `
    CREATE POLICY tenant_isolation ON {table_name}
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
  `;

  // Redis key namespacing
  cacheKeyPattern: '{module}:{tenant_id}:{entity}:{id}';

  // Queue job isolation
  queueJobData: { tenantId: string; /* ... */ };
}
```

---

## 💰 Financial Calculation Standards

### MANDATORY: Decimal Precision

```typescript
// ✅ CORRECT: Always use Decimal.js for monetary values
import Decimal from 'decimal.js';

const amount = new Decimal('1234.56');
const vatRate = new Decimal('0.23');
const vatAmount = amount.times(vatRate).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

// ❌ FORBIDDEN: Never use floating point for money
const amount = 1234.56; // VIOLATION
const total = price * quantity; // VIOLATION
```

### Precision Rules

| Data Type | Decimal Places | Rounding Method |
|-----------|---------------|-----------------|
| PLN amounts | 2 | ROUND_HALF_EVEN (banker's) |
| EUR amounts | 2 | ROUND_HALF_EVEN |
| Exchange rates | 4 | ROUND_HALF_UP |
| Tax rates | 4 | No rounding |
| Percentages | 2 | ROUND_HALF_UP |
| Unit prices | 4 | ROUND_HALF_UP |

### Currency Handling

```typescript
// Currency configuration per Polish accounting standards
const CURRENCY_CONFIG = {
  PLN: { decimals: 2, symbol: 'zł', position: 'after' },
  EUR: { decimals: 2, symbol: '€', position: 'before' },
  USD: { decimals: 2, symbol: '$', position: 'before' },
  exchangeRateDecimals: 4,
  // NBP (National Bank of Poland) is the authoritative source
  exchangeRateSource: 'NBP'
};
```

### Accounting Equation Validation

```typescript
// MUST validate on every transaction
// Assets = Liabilities + Equity
// Debits MUST equal Credits
interface AccountingValidation {
  validateDoubleEntry(entries: JournalEntry[]): boolean;
  validateAccountingEquation(ledger: GeneralLedger): boolean;
}
```

---

## 🔐 Security Requirements

### Authentication Standards

| Requirement | Specification |
|-------------|---------------|
| Password hashing | Argon2id (memory: 64MB, iterations: 3, parallelism: 4) |
| JWT signing | RS256 with 2048-bit keys |
| Access token expiry | 15 minutes maximum |
| Refresh token expiry | 7 days maximum |
| Session binding | IP + User-Agent fingerprint |
| MFA | TOTP (RFC 6238) with 6-digit codes |

### Authorization Model

```typescript
// Role-Based Access Control with Row-Level Security
interface AuthorizationModel {
  // Hierarchical roles
  roles: ['super_admin', 'firm_owner', 'accountant', 'assistant', 'client_viewer'];
  
  // Resource-based permissions
  permissions: {
    resource: string;      // e.g., 'invoices', 'clients', 'reports'
    action: string;        // 'create', 'read', 'update', 'delete'
    scope: 'own' | 'firm' | 'all';
    conditions?: object;   // Additional constraints
  };
  
  // Row-Level Security in Supabase
  rls: {
    enabled: true;
    policies: 'MUST be defined for every table';
  };
}
```

### Encryption Requirements

| Data Type | Encryption | Key Management |
|-----------|------------|----------------|
| Data at rest | AES-256-GCM | Supabase managed |
| Data in transit | TLS 1.3 | Certificate pinning |
| Sensitive fields | AES-256-GCM | Application-level |
| Backups | AES-256 | Separate keys |
| API keys | Argon2id hash | Never store plaintext |

### Session Security

```typescript
// Session configuration
const SESSION_CONFIG = {
  maxConcurrentSessions: 5,
  sessionTimeout: 3600, // 1 hour
  extendOnActivity: true,
  bindToIP: true,
  bindToUserAgent: true,
  secureOnlyCookies: true,
  sameSiteCookies: 'strict',
  httpOnlyCookies: true
};
```

---

## 🇵🇱 Polish Compliance Requirements

### NIP (Tax ID) Validation

```typescript
// MANDATORY: Validate NIP checksum
function validateNIP(nip: string): boolean {
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const digits = nip.replace(/[\s-]/g, '').split('').map(Number);
  
  if (digits.length !== 10) return false;
  
  const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0);
  const checksum = sum % 11;
  
  return checksum === digits[9];
}

// Optional: VIES verification for EU VAT
async function verifyVIES(nip: string): Promise<VIESResult>;
```

### REGON Validation

```typescript
// MANDATORY: Validate REGON checksum (9 or 14 digits)
function validateREGON(regon: string): boolean {
  const weights9 = [8, 9, 2, 3, 4, 5, 6, 7];
  const weights14 = [2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8];
  // Implementation per Polish standards
}
```

### KSeF Integration (Krajowy System e-Faktur)

```typescript
// Required from 2026 for B2B invoices
interface KSeFIntegration {
  // MANDATORY endpoints
  submitInvoice(invoice: KSeFInvoice): Promise<KSeFResponse>;
  getInvoiceStatus(ksef_id: string): Promise<KSeFStatus>;
  downloadInvoice(ksef_id: string): Promise<KSeFInvoice>;
  
  // Invoice format
  format: 'FA(2)'; // Faktura VAT schema version
  
  // Authentication
  auth: 'certificate' | 'trusted_profile' | 'authorization_token';
}
```

### ZUS Integration (Social Security)

```typescript
// ZUS PUE API integration requirements
interface ZUSIntegration {
  // Contribution types
  contributions: ['emerytalne', 'rentowe', 'chorobowe', 'wypadkowe', 'zdrowotne', 'FP', 'FGSP'];
  
  // Declaration types
  declarations: ['DRA', 'RCA', 'RZA', 'RSA'];
  
  // Deadlines per Polish law
  deadlines: {
    zus_payment: 15; // 15th of month (or 20th for some entities)
    declaration: 15;
  };
}
```

### Tax Compliance

```typescript
// VAT rates per Polish law (as of 2024)
const VAT_RATES = {
  standard: 0.23,      // 23%
  reduced1: 0.08,      // 8%
  reduced2: 0.05,      // 5%
  zero: 0.00,          // 0%
  exempt: null,        // zwolniony
  reverseCharge: 'RC'  // odwrotne obciążenie
};

// CIT/PIT rates
const INCOME_TAX = {
  cit_standard: 0.19,  // 19%
  cit_small: 0.09,     // 9% for small taxpayers
  pit_scale1: 0.12,    // 12% up to threshold
  pit_scale2: 0.32,    // 32% above threshold
  pit_flat: 0.19       // 19% linear
};
```

---

## 📝 Code Standards

### TypeScript Configuration

```json
// tsconfig.json - MANDATORY settings
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Forbidden Patterns

```typescript
// ❌ FORBIDDEN: any type
function process(data: any): any { } // VIOLATION

// ❌ FORBIDDEN: Non-null assertion without validation
const value = obj!.property; // VIOLATION

// ❌ FORBIDDEN: Floating point for money
const total = price * quantity; // VIOLATION

// ❌ FORBIDDEN: console.log in production code
console.log('debug'); // VIOLATION - use structured logger

// ❌ FORBIDDEN: Hardcoded secrets
const apiKey = 'sk-1234'; // VIOLATION

// ❌ FORBIDDEN: SQL string concatenation
const query = `SELECT * FROM users WHERE id = '${id}'`; // VIOLATION
```

### Required Patterns

```typescript
// ✅ REQUIRED: Zod schemas for all inputs
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

// ✅ REQUIRED: tRPC for internal APIs
export const authRouter = router({
  login: publicProcedure
    .input(LoginSchema)
    .mutation(async ({ input }) => { /* ... */ })
});

// ✅ REQUIRED: Structured error handling
class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
  }
}

// ✅ REQUIRED: Structured logging
logger.info('User logged in', { userId, sessionId, ip });
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files (components) | PascalCase | `InvoiceForm.tsx` |
| Files (utils) | kebab-case | `date-utils.ts` |
| Variables | camelCase | `invoiceTotal` |
| Constants | SCREAMING_SNAKE | `MAX_LOGIN_ATTEMPTS` |
| Types/Interfaces | PascalCase | `InvoiceLineItem` |
| Database tables | snake_case | `invoice_line_items` |
| API endpoints | kebab-case | `/api/v1/invoice-items` |

---

## 🏗️ Architecture Principles

### Module Boundaries

> **Note**: See [Module Registry](#module-registry) for the complete 11-module architecture diagram and detailed dependency map.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API Gateway (tRPC)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Core (P0)      │  Compliance (P1)  │  Integration (P2)   │  Operations (P3)│
│  AIM, CRM, ACC  │  TAX, DOC, WFA    │  BNK, HRP, CSP, AAM │  MON            │
├─────────────────────────────────────────────────────────────────────────────┤
│                         Shared Infrastructure                                │
│      (PostgreSQL, Redis, BullMQ, Supabase Storage, Event Bus, InfluxDB)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Communication Rules

1. **Modules communicate via defined interfaces only**
2. **No direct database access across module boundaries**
3. **Events for async cross-module communication**
4. **Shared types defined in common package**

### Dependency Rules

```typescript
// Module dependency hierarchy (top can depend on bottom, not reverse)
const MODULE_HIERARCHY = [
  'presentation',    // UI components, pages
  'application',     // Use cases, orchestration
  'domain',          // Business logic, entities
  'infrastructure'   // Database, external services
];

// Cross-module dependencies via interfaces (all 11 modules)
interface ModuleDependencies {
  // AIM is foundational - consumed by all modules
  AIM: ['CRM', 'ACC', 'TAX', 'DOC', 'WFA', 'BNK', 'HRP', 'CSP', 'AAM', 'MON'];
  // CRM consumed by financial and operational modules
  CRM: ['ACC', 'TAX', 'BNK', 'HRP', 'CSP', 'AAM'];
  // ACC consumed by tax, reporting, and analytics
  ACC: ['TAX', 'MON'];
  // TAX consumed by reporting
  TAX: ['MON'];
  // DOC consumed by AI and automation
  DOC: ['AAM', 'WFA'];
  // WFA orchestrates multiple modules
  WFA: []; // Leaf - orchestrates but is not a dependency
  // BNK consumed by accounting reconciliation
  BNK: ['ACC'];
  // HRP consumed by accounting for payroll journal entries
  HRP: ['ACC'];
  // CSP is client-facing - no internal dependents
  CSP: [];
  // AAM can assist across all modules
  AAM: [];
  // MON monitors all - leaf module
  MON: [];
}
```

---

## 🧪 Testing Requirements

### Coverage Thresholds

| Category | Minimum Coverage |
|----------|------------------|
| Financial calculations | 100% |
| Authentication flows | 95% |
| Business logic | 80% |
| API endpoints | 80% |
| UI components | 70% |
| Overall | 80% |

### Test Types Required

```typescript
// Unit tests - MANDATORY for all business logic
describe('InvoiceCalculator', () => {
  it('should calculate VAT correctly with banker rounding', () => {
    const result = calculateVAT(new Decimal('100.555'), VAT_RATES.standard);
    expect(result.toString()).toBe('23.13'); // HALF_EVEN rounding
  });
});

// Integration tests - MANDATORY for API endpoints
describe('POST /api/v1/auth/login', () => {
  it('should return tokens for valid credentials', async () => { });
  it('should increment failed attempts on invalid password', async () => { });
  it('should lock account after max attempts', async () => { });
});

// E2E tests - MANDATORY for critical user flows
describe('Invoice Creation Flow', () => {
  it('should create invoice and sync to KSeF', async () => { });
});
```

### Property-Based Testing for Financial Logic

```typescript
// REQUIRED for financial calculations
import * as fc from 'fast-check';

describe('Accounting Equation', () => {
  it('should always balance: Assets = Liabilities + Equity', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ debit: fc.decimal(), credit: fc.decimal() })),
        (entries) => {
          const totalDebits = sum(entries.map(e => e.debit));
          const totalCredits = sum(entries.map(e => e.credit));
          return totalDebits.equals(totalCredits);
        }
      )
    );
  });
});
```

---

## 🛡️ Data Protection

### RODO (GDPR) Compliance

```typescript
// Personal data handling requirements
interface RODOCompliance {
  // Right to access
  exportUserData(userId: string): Promise<UserDataExport>;
  
  // Right to erasure
  deleteUserData(userId: string): Promise<DeletionConfirmation>;
  
  // Right to rectification
  updatePersonalData(userId: string, data: PersonalData): Promise<void>;
  
  // Data retention
  retentionPolicies: {
    accounting_documents: '5 years'; // Polish law requirement
    personal_data: '3 years after last activity';
    audit_logs: '10 years';
  };
  
  // Consent management
  recordConsent(userId: string, purpose: string): Promise<void>;
  withdrawConsent(userId: string, purpose: string): Promise<void>;
}
```

### Data Classification

| Classification | Examples | Handling |
|----------------|----------|----------|
| Public | Company name, NIP | Standard protection |
| Internal | Financial reports | Encrypted at rest |
| Confidential | Salaries, contracts | Encrypted + access logging |
| Restricted | Passwords, keys | Never logged, special storage |

---

## 📊 Audit Requirements

### Audit Log Structure

```typescript
// MANDATORY: Every mutation must be logged
interface AuditLogEntry {
  id: string;
  timestamp: Date;
  actor: {
    userId: string;
    sessionId: string;
    ipAddress: string;
    userAgent: string;
  };
  action: {
    type: 'CREATE' | 'UPDATE' | 'DELETE' | 'ACCESS';
    resource: string;
    resourceId: string;
  };
  changes: {
    before: object | null;
    after: object | null;
    diff: object;
  };
  context: {
    correlationId: string;
    requestId: string;
    module: string;
  };
}
```

### Immutability Requirements

```sql
-- Audit logs table with immutability
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... fields ...
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  -- NO updated_at - logs are immutable
);

-- Prevent updates and deletes
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_audit_updates
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
```

---

## 🔌 Integration Standards

### External API Integration

```typescript
// Standard integration pattern
interface ExternalIntegration {
  // Circuit breaker for resilience
  circuitBreaker: {
    failureThreshold: 5;
    resetTimeout: 30000;
  };
  
  // Retry policy
  retry: {
    maxAttempts: 3;
    backoff: 'exponential';
    initialDelay: 1000;
  };
  
  // Timeout
  timeout: 30000; // 30 seconds max
  
  // Response caching
  cache: {
    enabled: true;
    ttl: number;
  };
}
```

### Government API Specifics

| API | Timeout | Retry | Cache TTL |
|-----|---------|-------|-----------|
| GUS/REGON | 30s | 3x | 24h |
| VIES | 30s | 3x | 24h |
| KSeF | 60s | 5x | None |
| ZUS PUE | 60s | 3x | 1h |
| NBP (rates) | 10s | 3x | 24h |

---

## 🔧 Module-Specific Requirements

### Banking Integration (BNK) Requirements

```typescript
// PSD2 / Open Banking compliance requirements
interface BankingSecurityRequirements {
  // Strong Customer Authentication (SCA)
  sca: {
    required: true;
    factors: ['knowledge', 'possession', 'inherence']; // 2 of 3 required
    exemptions: ['low_value', 'recurring', 'trusted_beneficiary'];
  };

  // Certificate-based authentication with banks
  certificates: {
    type: 'eIDAS QWAC' | 'eIDAS QSealC';
    storage: 'HSM' | 'AWS CloudHSM';
    rotation: '12 months';
  };

  // Transaction signing
  transactionSigning: {
    algorithm: 'RS256';
    nonRepudiation: true;
  };
}

// Bank connection security
const BANK_CONNECTION_RULES = {
  // Supported banks (mBank API, PKO BP, etc.)
  supportedProviders: ['mbank', 'pko', 'ing', 'santander', 'bnp'],

  // Consent management per PSD2
  consentValidity: 90, // days
  consentRenewal: 'explicit',

  // Transaction limits for automated payments
  autoPaymentLimit: new Decimal('10000'), // PLN
  bulkPaymentLimit: 50, // transactions per batch
};
```

### HR & Payroll (HRP) Requirements

```typescript
// Polish labor law compliance
interface HRComplianceRequirements {
  // PESEL handling (Polish national ID)
  peselHandling: {
    encrypted: true;
    masked: '***********' | '*******{last4}';
    accessLogged: true;
    retentionPeriod: '50 years'; // Per Kodeks pracy
  };

  // Salary data protection
  salaryData: {
    classification: 'CONFIDENTIAL';
    accessRoles: ['hr_admin', 'payroll_specialist', 'firm_owner'];
    encryption: 'AES-256-GCM';
    auditAllAccess: true;
  };

  // ZUS contribution rates (2024)
  zusContributions: {
    emerytalne: { employee: 0.0976, employer: 0.0976 };
    rentowe: { employee: 0.015, employer: 0.065 };
    chorobowe: { employee: 0.0245, employer: 0 };
    wypadkowe: { employee: 0, employer: 0.0167 }; // varies by risk
    zdrowotne: { employee: 0.09, employer: 0 };
    fp: { employee: 0, employer: 0.0245 };
    fgsp: { employee: 0, employer: 0.001 };
  };

  // Document retention per Polish law
  retention: {
    employmentRecords: '50 years'; // From 2019: 10 years for new contracts
    payrollRecords: '10 years';
    taxDocuments: '5 years';
    medicalRecords: '20 years';
  };
}

// Payroll calculation validation
const PAYROLL_VALIDATION = {
  // Minimum wage check (updated annually)
  minimumWage: new Decimal('4300'), // PLN gross (2024)

  // Working time limits
  maxWeeklyHours: 40,
  maxOvertimeAnnual: 150, // hours

  // PIT thresholds
  pitThreshold: new Decimal('120000'), // PLN annual
};
```

### Document Intelligence (DOC) Requirements

```typescript
// Document processing security
interface DocumentSecurityRequirements {
  // Supported file types with validation
  allowedTypes: ['pdf', 'png', 'jpg', 'jpeg', 'tiff'];
  maxFileSize: 50 * 1024 * 1024; // 50MB

  // Virus scanning MANDATORY before processing
  virusScan: {
    required: true;
    provider: 'ClamAV' | 'commercial';
    quarantine: true;
  };

  // OCR data handling
  ocrDataHandling: {
    // Extracted PII must be encrypted
    piiEncryption: true;
    // Temporary OCR artifacts must be deleted
    tempFileRetention: '24 hours';
    // Original documents encrypted at rest
    storageEncryption: 'AES-256-GCM';
  };

  // AI extraction validation
  aiExtraction: {
    confidenceThreshold: 0.85; // Below this, require human review
    humanReviewRequired: ['amounts', 'tax_ids', 'bank_accounts'];
    auditTrail: true;
  };
}
```

### Client Portal (CSP) Requirements

```typescript
// Client-facing security requirements
interface PortalSecurityRequirements {
  // Session management for external users
  session: {
    maxDuration: 1800; // 30 minutes
    extendOnActivity: true;
    forceLogoutOnInactivity: true;
  };

  // Rate limiting for client portal
  rateLimiting: {
    login: { requests: 5, window: '15 minutes' };
    api: { requests: 100, window: '1 minute' };
    download: { requests: 50, window: '1 hour' };
  };

  // Document sharing controls
  documentSharing: {
    watermarking: true;
    downloadLogging: true;
    expiringLinks: true;
    linkExpiry: '7 days';
  };

  // Client data visibility
  dataVisibility: {
    // Clients can only see their own data
    ownDataOnly: true;
    // No cross-client data access possible
    strictIsolation: true;
  };
}
```

---

## 🤖 AI & LLM Integration Standards

### General AI Security Requirements

```typescript
// MANDATORY for all AI/LLM integrations
interface AISecurityRequirements {
  // Data sanitization BEFORE sending to LLM
  dataSanitization: {
    // NEVER send to external LLM
    forbidden: ['pesel', 'nip', 'bank_account', 'password', 'api_key'];
    // Replace with placeholders
    placeholder: '[REDACTED_PESEL]' | '[REDACTED_NIP]' | '[REDACTED_BANK]';
    // Validation before API call
    preFlightCheck: true;
  };

  // Response filtering
  responseFiltering: {
    // Check for leaked sensitive data
    piiDetection: true;
    // Log anomalies for review
    anomalyLogging: true;
  };

  // Provider requirements
  providerRequirements: {
    dataProcessingAgreement: true; // DPA required
    euDataResidency: 'preferred'; // GDPR compliance
    noTrainingOnData: true; // Opt-out of training
  };
}
```

### AI Agent Module (AAM) Specific Rules

```typescript
// AI Agent configuration constraints
interface AIAgentConstraints {
  // Token management
  tokens: {
    maxPerRequest: 4096;
    maxPerConversation: 32000;
    dailyLimitPerTenant: 1000000;
    costTrackingRequired: true;
  };

  // Agent capabilities
  capabilities: {
    // Agents can READ data but NOT modify without approval
    readOnly: ['client_data', 'financial_records', 'documents'];
    // Requires human approval before execution
    approvalRequired: ['create_invoice', 'submit_declaration', 'make_payment'];
    // Never allowed
    forbidden: ['delete_data', 'modify_audit_logs', 'access_other_tenants'];
  };

  // Knowledge base security
  knowledgeBase: {
    // Documents must be sanitized before indexing
    sanitizeBeforeIndex: true;
    // Tenant isolation in vector store
    tenantIsolation: true;
    // Access control per document
    documentLevelPermissions: true;
  };

  // Conversation retention
  conversationRetention: {
    maxAge: '90 days';
    deletionPolicy: 'hard_delete';
    exportFormat: 'JSON';
  };
}

// LLM provider configuration
const LLM_CONFIG = {
  // Supported providers
  providers: ['anthropic', 'openai', 'azure_openai'],

  // Default model selection
  defaultModel: 'claude-3-sonnet',

  // Fallback strategy
  fallback: {
    enabled: true,
    order: ['anthropic', 'azure_openai', 'openai'],
    retryAttempts: 3,
  },

  // Cost controls
  costControls: {
    alertThreshold: 0.8, // 80% of budget
    hardLimit: true,
    budgetPeriod: 'monthly',
  },
};
```

### AI-Assisted Decision Making

```typescript
// MANDATORY: Human oversight for AI decisions
interface AIDecisionRequirements {
  // Classification of AI outputs
  outputClassification: {
    // Informational: No review needed
    informational: ['summaries', 'explanations', 'suggestions'];
    // Advisory: User confirmation needed
    advisory: ['tax_advice', 'financial_analysis', 'compliance_check'];
    // Actionable: Explicit approval required
    actionable: ['transaction_creation', 'declaration_submission', 'payment_initiation'];
  };

  // Audit trail for AI decisions
  aiAuditTrail: {
    logPrompt: true; // Sanitized
    logResponse: true;
    logConfidence: true;
    logUserAction: true; // accepted/rejected/modified
  };

  // Explanation capability
  explainability: {
    // AI must be able to explain its reasoning
    explanationRequired: true;
    // User can contest AI decisions
    contestationMechanism: true;
    // Human override always available
    humanOverride: true;
  };
}
```

### Prompt Security

```typescript
// Prompt injection prevention
interface PromptSecurityRequirements {
  // Input validation
  inputValidation: {
    maxLength: 10000; // characters
    forbiddenPatterns: [
      /ignore previous instructions/i,
      /system prompt/i,
      /you are now/i,
      /<\|.*\|>/,
    ];
    sanitization: true;
  };

  // System prompt protection
  systemPrompt: {
    // Never expose system prompt to users
    hidden: true;
    // Versioned and audited
    versioning: true;
    // Changes require approval
    changeApproval: 'security_team';
  };

  // Output validation
  outputValidation: {
    // Check for instruction leakage
    leakageDetection: true;
    // Validate format compliance
    formatValidation: true;
    // Content safety check
    safetyCheck: true;
  };
}
```

---

## 📌 Amendment Process

Changes to this constitution require:

1. **Proposal** with business justification
2. **Review** by technical lead
3. **Impact assessment** for existing code
4. **Approval** by project owner
5. **Migration plan** if breaking changes

---

## ✅ Compliance Checklist

Before any PR merge:

### Core Requirements (All Modules)
- [ ] No `any` types in new code
- [ ] All monetary calculations use Decimal.js
- [ ] Zod schemas for all inputs
- [ ] Audit logging for mutations
- [ ] Tests meet coverage thresholds
- [ ] No hardcoded secrets
- [ ] RLS policies for new tables with tenant_id
- [ ] Error handling follows patterns
- [ ] Documentation updated

### Financial Modules (ACC, TAX, BNK, HRP)
- [ ] Double-entry accounting validated (debits = credits)
- [ ] Currency handled with proper precision
- [ ] Tax calculations match Polish regulations
- [ ] ZUS contribution rates current

### Security-Sensitive Modules (AIM, BNK, HRP)
- [ ] Sensitive data encrypted (PESEL, bank accounts, salaries)
- [ ] Access logging for confidential data
- [ ] Rate limiting implemented
- [ ] Session security enforced

### External Integration Modules (TAX, BNK, DOC, AAM)
- [ ] Circuit breaker patterns for external APIs
- [ ] Retry policies configured
- [ ] Timeout limits set
- [ ] API credentials not exposed

### AI Module (AAM) Specific
- [ ] No PII sent to external LLMs
- [ ] Prompt injection prevention active
- [ ] Token limits enforced
- [ ] Human approval for actionable AI outputs

### Client-Facing Modules (CSP)
- [ ] Strict tenant isolation validated
- [ ] Document watermarking for downloads
- [ ] Session timeout configured (30 min max)
- [ ] Rate limiting for public endpoints

---

*This constitution is the source of truth for all development decisions. When in doubt, refer here.*
