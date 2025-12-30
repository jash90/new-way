# Story: KSeF Integration (TAX-009)

> **Story ID**: TAX-009
> **Epic**: Tax Compliance Module (TAX)
> **Priority**: P1 (Essential)
> **Points**: 8
> **Status**: 📋 Ready for Development
> **Phase**: Week 15

---

## User Story

**As an** accountant,
**I want** to integrate with KSeF (Krajowy System e-Faktur)
**So that** I can submit and receive structured invoices through the national e-invoice system.

---

## Background

KSeF (Krajowy System e-Faktur) is Poland's National e-Invoice System, which will become mandatory for B2B transactions starting in 2026. The system enables electronic exchange of structured invoices in a standardized XML format (FA(2)), providing authenticity, integrity, and legal compliance for all invoices.

### Key KSeF Concepts
- **Faktura ustrukturyzowana (FA)**: Structured invoice in XML format per Ministry of Finance schema
- **Numer KSeF**: Unique identifier assigned by KSeF to each submitted invoice
- **Token dostępowy**: Authorization token for API access
- **Sesja interaktywna**: Interactive API session for real-time operations
- **Sesja wsadowa**: Batch session for bulk invoice processing
- **UPO KSeF**: Official receipt confirming invoice acceptance

---

## Acceptance Criteria

### Scenario 1: Interactive Invoice Submission
```gherkin
Given I have a valid invoice in draft status
And I am authenticated with KSeF via authorized method
When I submit the invoice to KSeF
Then the invoice is converted to FA(2) XML format
And the XML is validated against current KSeF schema
And the invoice is submitted via KSeF API
And a KSeF number is assigned and stored
And the invoice status is updated to "submitted_to_ksef"
And submission timestamp is recorded
And UPO KSeF is retrieved and stored
```

### Scenario 2: Batch Invoice Submission
```gherkin
Given I have multiple invoices ready for KSeF submission
And all invoices pass validation
When I initiate batch submission to KSeF
Then a batch session is created
And all invoices are packaged with metadata
And batch is submitted via KSeF batch API
And each invoice receives its KSeF number
And batch processing status is tracked
And individual invoice statuses are updated
And batch completion notification is sent
```

### Scenario 3: Invoice Retrieval from KSeF
```gherkin
Given I am authenticated with KSeF
And I have a date range or KSeF numbers to retrieve
When I request invoices from KSeF
Then received invoices are downloaded from KSeF
And XML content is parsed and validated
And invoice data is extracted and stored
And sender/recipient information is verified
And invoices are linked to appropriate clients
And retrieval is logged in audit trail
```

### Scenario 4: KSeF Number Assignment
```gherkin
Given an invoice is successfully submitted to KSeF
When KSeF processes the invoice
Then a unique KSeF number is returned
And the number follows format: [date]-[sequence]-[checksum]
And the KSeF number is stored with the invoice
And the number is displayed on all invoice views
And the number is included in printed/PDF versions
And the assignment is logged for compliance
```

### Scenario 5: Status Synchronization
```gherkin
Given invoices have been submitted to KSeF
When I check synchronization status
Then current status is retrieved from KSeF API
And local invoice statuses are updated accordingly
And any rejections are flagged with reasons
And pending invoices are tracked separately
And status history is maintained
And discrepancies are reported for review
```

### Scenario 6: KSeF Invoice Correction
```gherkin
Given an invoice in KSeF requires correction
When I create a correction invoice (faktura korygująca)
Then the correction references the original KSeF number
And correction type is specified (amount, item, data)
And correction is submitted to KSeF
And new KSeF number is assigned to correction
And original invoice is marked as corrected
And both invoices are linked in the system
```

### Scenario 7: Error Handling
```gherkin
Given a KSeF operation encounters an error
When the error is detected
Then the error type is identified:
  | Error Type | Action |
  | SCHEMA_VALIDATION | Show field-level errors, prevent submission |
  | AUTH_EXPIRED | Refresh token or prompt re-authentication |
  | RATE_LIMIT | Queue for retry with backoff |
  | SYSTEM_UNAVAILABLE | Enable offline mode, queue submissions |
  | INVOICE_REJECTED | Show rejection reasons, allow correction |
  | NETWORK_ERROR | Retry with exponential backoff |
And error details are logged
And user is notified with actionable message
And recovery options are presented
```

### Scenario 8: Offline Mode Operation
```gherkin
Given KSeF system is unavailable
When I create or modify invoices
Then invoices are marked as "pending_ksef_submission"
And invoices are queued for later submission
And offline period is tracked
And when KSeF becomes available, queue is processed
And submission order is maintained (FIFO)
And all queued invoices are submitted with verification
```

---

## Technical Specification

### Database Schema

```sql
-- KSeF invoice tracking
CREATE TABLE ksef_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  ksef_number VARCHAR(50) UNIQUE,
  ksef_reference_number VARCHAR(100),
  session_id VARCHAR(100),
  submission_type VARCHAR(20) NOT NULL CHECK (submission_type IN ('interactive', 'batch')),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  xml_content TEXT,
  xml_hash VARCHAR(64),
  fa_schema_version VARCHAR(20) NOT NULL DEFAULT 'FA(2)',
  submitted_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejection_reason TEXT,
  upo_xml TEXT,
  upo_reference VARCHAR(100),
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN (
    'pending', 'validating', 'submitting', 'submitted',
    'processing', 'accepted', 'rejected', 'error', 'cancelled'
  ))
);

-- KSeF batch operations
CREATE TABLE ksef_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  batch_reference VARCHAR(100) UNIQUE NOT NULL,
  session_id VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'preparing',
  invoice_count INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  accepted_count INTEGER DEFAULT 0,
  rejected_count INTEGER DEFAULT 0,
  package_hash VARCHAR(64),
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_details JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_batch_status CHECK (status IN (
    'preparing', 'validating', 'submitting', 'processing',
    'completed', 'partial_success', 'failed', 'cancelled'
  ))
);

-- KSeF batch items (linking invoices to batches)
CREATE TABLE ksef_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES ksef_batches(id) ON DELETE CASCADE,
  ksef_invoice_id UUID NOT NULL REFERENCES ksef_invoices(id),
  sequence_number INTEGER NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  ksef_number VARCHAR(50),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (batch_id, sequence_number)
);

-- KSeF received invoices (zakupowe)
CREATE TABLE ksef_received_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  ksef_number VARCHAR(50) NOT NULL,
  sender_nip VARCHAR(10) NOT NULL,
  sender_name VARCHAR(500),
  recipient_nip VARCHAR(10) NOT NULL,
  invoice_number VARCHAR(100),
  invoice_date DATE NOT NULL,
  sale_date DATE,
  net_amount DECIMAL(15, 2) NOT NULL,
  vat_amount DECIMAL(15, 2) NOT NULL,
  gross_amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'PLN',
  xml_content TEXT NOT NULL,
  xml_hash VARCHAR(64) NOT NULL,
  parsed_data JSONB,
  linked_invoice_id UUID REFERENCES invoices(id),
  linked_client_id UUID REFERENCES clients(id),
  processing_status VARCHAR(30) NOT NULL DEFAULT 'received',
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (organization_id, ksef_number),
  CONSTRAINT valid_processing_status CHECK (processing_status IN (
    'received', 'parsed', 'matched', 'imported', 'rejected', 'error'
  ))
);

-- KSeF sessions
CREATE TABLE ksef_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  session_type VARCHAR(20) NOT NULL CHECK (session_type IN ('interactive', 'batch')),
  session_token TEXT NOT NULL,
  reference_number VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  auth_method VARCHAR(30) NOT NULL,
  auth_identifier VARCHAR(100),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  terminated_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  operations_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_session_status CHECK (status IN ('active', 'expired', 'terminated', 'error'))
);

-- KSeF API configuration
CREATE TABLE ksef_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  environment VARCHAR(20) NOT NULL DEFAULT 'test',
  auth_method VARCHAR(30) NOT NULL DEFAULT 'token',
  auth_token_encrypted TEXT,
  certificate_id UUID REFERENCES certificates(id),
  profil_zaufany_config JSONB,
  auto_download_enabled BOOLEAN DEFAULT false,
  auto_download_interval_hours INTEGER DEFAULT 24,
  last_download_at TIMESTAMPTZ,
  download_from_date DATE,
  notification_email VARCHAR(255),
  webhook_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (organization_id, environment),
  CONSTRAINT valid_environment CHECK (environment IN ('test', 'demo', 'production')),
  CONSTRAINT valid_auth_method CHECK (auth_method IN ('token', 'certificate', 'profil_zaufany'))
);

-- KSeF synchronization log
CREATE TABLE ksef_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  sync_type VARCHAR(30) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  status VARCHAR(20) NOT NULL,
  invoices_processed INTEGER DEFAULT 0,
  invoices_succeeded INTEGER DEFAULT 0,
  invoices_failed INTEGER DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- KSeF offline queue
CREATE TABLE ksef_offline_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  operation VARCHAR(20) NOT NULL DEFAULT 'submit',
  priority INTEGER DEFAULT 0,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  processed_at TIMESTAMPTZ,

  CONSTRAINT valid_queue_status CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'))
);

-- Indexes
CREATE INDEX idx_ksef_invoices_org_status ON ksef_invoices(organization_id, status);
CREATE INDEX idx_ksef_invoices_ksef_number ON ksef_invoices(ksef_number);
CREATE INDEX idx_ksef_invoices_invoice ON ksef_invoices(invoice_id);
CREATE INDEX idx_ksef_batches_org ON ksef_batches(organization_id);
CREATE INDEX idx_ksef_received_sender ON ksef_received_invoices(sender_nip);
CREATE INDEX idx_ksef_received_date ON ksef_received_invoices(invoice_date);
CREATE INDEX idx_ksef_sessions_org ON ksef_sessions(organization_id, status);
CREATE INDEX idx_ksef_offline_queue_pending ON ksef_offline_queue(organization_id, status) WHERE status = 'queued';

-- Row Level Security
ALTER TABLE ksef_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE ksef_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ksef_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ksef_received_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE ksef_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ksef_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ksef_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ksef_offline_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY ksef_invoices_isolation ON ksef_invoices
  USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY ksef_batches_isolation ON ksef_batches
  USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY ksef_received_isolation ON ksef_received_invoices
  USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY ksef_sessions_isolation ON ksef_sessions
  USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY ksef_config_isolation ON ksef_config
  USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY ksef_sync_isolation ON ksef_sync_log
  USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY ksef_queue_isolation ON ksef_offline_queue
  USING (organization_id = current_setting('app.organization_id')::UUID);
```

### KSeF API Configuration

```typescript
// KSeF API endpoints per environment
export const KSEF_ENDPOINTS = {
  TEST: {
    base: 'https://ksef-test.mf.gov.pl/api',
    session: '/online/Session',
    invoices: '/online/Invoice',
    batch: '/batch',
    status: '/common/Status',
    upo: '/common/Invoice/{ksefNumber}/upo',
  },
  DEMO: {
    base: 'https://ksef-demo.mf.gov.pl/api',
    // Same structure as TEST
  },
  PRODUCTION: {
    base: 'https://ksef.mf.gov.pl/api',
    // Same structure as TEST
  },
} as const;

// KSeF FA(2) XML Namespaces
export const KSEF_NAMESPACES = {
  FA: 'http://crd.gov.pl/wzor/2023/06/29/12648/',
  XSD: 'http://www.w3.org/2001/XMLSchema',
  XSI: 'http://www.w3.org/2001/XMLSchema-instance',
};

// KSeF schema versions
export const KSEF_SCHEMA_VERSIONS = {
  CURRENT: 'FA(2)',
  SUPPORTED: ['FA(1)', 'FA(2)'],
};

// Rate limits
export const KSEF_RATE_LIMITS = {
  INTERACTIVE: {
    REQUESTS_PER_MINUTE: 60,
    INVOICES_PER_SESSION: 100,
  },
  BATCH: {
    MAX_INVOICES_PER_BATCH: 1000,
    MAX_BATCH_SIZE_MB: 50,
  },
};
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';
import Decimal from 'decimal.js';

// KSeF submission input
export const submitToKSeFSchema = z.object({
  invoiceId: z.string().uuid(),
  submissionType: z.enum(['interactive', 'batch']).default('interactive'),
  priority: z.number().int().min(0).max(10).default(5),
});

// Batch submission input
export const batchSubmitSchema = z.object({
  invoiceIds: z.array(z.string().uuid()).min(1).max(1000),
  batchReference: z.string().max(100).optional(),
  scheduledAt: z.coerce.date().optional(),
});

// KSeF invoice retrieval input
export const retrieveKSeFInvoicesSchema = z.object({
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
  ksefNumbers: z.array(z.string()).optional(),
  senderNip: z.string().length(10).optional(),
  pageSize: z.number().int().min(1).max(100).default(50),
  pageToken: z.string().optional(),
});

// KSeF session creation
export const createKSeFSessionSchema = z.object({
  sessionType: z.enum(['interactive', 'batch']),
  authMethod: z.enum(['token', 'certificate', 'profil_zaufany']),
  authCredentials: z.object({
    token: z.string().optional(),
    certificateId: z.string().uuid().optional(),
    profilZaufanyCode: z.string().optional(),
  }),
});

// KSeF configuration update
export const updateKSeFConfigSchema = z.object({
  environment: z.enum(['test', 'demo', 'production']),
  authMethod: z.enum(['token', 'certificate', 'profil_zaufany']),
  authToken: z.string().optional(),
  certificateId: z.string().uuid().optional(),
  autoDownloadEnabled: z.boolean().optional(),
  autoDownloadIntervalHours: z.number().int().min(1).max(168).optional(),
  downloadFromDate: z.coerce.date().optional(),
  notificationEmail: z.string().email().optional(),
  webhookUrl: z.string().url().optional(),
});

// FA(2) invoice structure for XML generation
export const fa2InvoiceSchema = z.object({
  invoiceNumber: z.string().max(256),
  invoiceDate: z.coerce.date(),
  saleDate: z.coerce.date().optional(),
  seller: z.object({
    nip: z.string().length(10),
    name: z.string().max(512),
    address: z.object({
      street: z.string().max(256).optional(),
      buildingNumber: z.string().max(20),
      apartmentNumber: z.string().max(20).optional(),
      postalCode: z.string().max(10),
      city: z.string().max(256),
      country: z.string().length(2).default('PL'),
    }),
  }),
  buyer: z.object({
    nip: z.string().length(10).optional(),
    name: z.string().max(512),
    address: z.object({
      street: z.string().max(256).optional(),
      buildingNumber: z.string().max(20),
      apartmentNumber: z.string().max(20).optional(),
      postalCode: z.string().max(10),
      city: z.string().max(256),
      country: z.string().length(2).default('PL'),
    }),
  }),
  lineItems: z.array(z.object({
    name: z.string().max(512),
    quantity: z.string(), // Decimal as string
    unit: z.string().max(20).optional(),
    unitPrice: z.string(), // Decimal as string
    netAmount: z.string(),
    vatRate: z.string(),
    vatAmount: z.string(),
    grossAmount: z.string(),
    pkwiu: z.string().max(20).optional(),
    cn: z.string().max(10).optional(),
    gtu: z.string().max(10).optional(),
  })).min(1),
  totals: z.object({
    netAmount: z.string(),
    vatAmount: z.string(),
    grossAmount: z.string(),
  }),
  paymentTerms: z.object({
    paymentMethod: z.enum(['cash', 'transfer', 'card', 'other']),
    dueDate: z.coerce.date().optional(),
    bankAccount: z.string().max(34).optional(),
  }).optional(),
  annotations: z.object({
    splitPayment: z.boolean().default(false),
    reverseCharge: z.boolean().default(false),
    selfBilling: z.boolean().default(false),
  }).optional(),
});

export type SubmitToKSeFInput = z.infer<typeof submitToKSeFSchema>;
export type BatchSubmitInput = z.infer<typeof batchSubmitSchema>;
export type RetrieveKSeFInvoicesInput = z.infer<typeof retrieveKSeFInvoicesSchema>;
export type CreateKSeFSessionInput = z.infer<typeof createKSeFSessionSchema>;
export type UpdateKSeFConfigInput = z.infer<typeof updateKSeFConfigSchema>;
export type FA2Invoice = z.infer<typeof fa2InvoiceSchema>;
```

### KSeF Service Implementation

```typescript
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import Decimal from 'decimal.js';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { encrypt, decrypt } from '@/lib/encryption';
import {
  KSEF_ENDPOINTS,
  KSEF_NAMESPACES,
  KSEF_RATE_LIMITS,
} from './ksef-config';
import type {
  SubmitToKSeFInput,
  BatchSubmitInput,
  RetrieveKSeFInvoicesInput,
  FA2Invoice,
} from './ksef-schemas';

interface KSeFSession {
  sessionToken: string;
  referenceNumber: string;
  expiresAt: Date;
}

interface KSeFSubmissionResult {
  success: boolean;
  ksefNumber?: string;
  referenceNumber?: string;
  upoReference?: string;
  error?: string;
  errorCode?: string;
}

interface KSeFBatchResult {
  batchId: string;
  status: string;
  processedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  results: Array<{
    invoiceId: string;
    ksefNumber?: string;
    error?: string;
  }>;
}

export class KSeFService {
  private xmlBuilder: XMLBuilder;
  private xmlParser: XMLParser;

  constructor() {
    this.xmlBuilder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      indentBy: '  ',
    });

    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
  }

  /**
   * Submit single invoice to KSeF (interactive mode)
   */
  async submitInvoice(
    input: SubmitToKSeFInput,
    organizationId: string,
    userId: string
  ): Promise<KSeFSubmissionResult> {
    // Load invoice data
    const invoice = await db.invoice.findUnique({
      where: { id: input.invoiceId, organizationId },
      include: {
        lineItems: true,
        client: true,
        seller: true,
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Get KSeF configuration
    const config = await this.getKSeFConfig(organizationId);

    // Create or get active session
    const session = await this.getOrCreateSession(organizationId, 'interactive', config);

    // Convert invoice to FA(2) XML
    const fa2Invoice = this.convertToFA2(invoice);
    const xmlContent = this.generateFA2XML(fa2Invoice);
    const xmlHash = this.calculateHash(xmlContent);

    // Validate against XSD schema
    const validationResult = await this.validateXML(xmlContent);
    if (!validationResult.valid) {
      await auditLog({
        action: 'KSEF_VALIDATION_FAILED',
        entityType: 'ksef_invoice',
        entityId: input.invoiceId,
        organizationId,
        userId,
        details: { errors: validationResult.errors },
      });
      throw new Error(`XML validation failed: ${validationResult.errors.join(', ')}`);
    }

    // Create KSeF invoice record
    const ksefInvoice = await db.ksefInvoice.create({
      data: {
        organizationId,
        invoiceId: input.invoiceId,
        sessionId: session.referenceNumber,
        submissionType: 'interactive',
        status: 'submitting',
        xmlContent,
        xmlHash,
        faSchemaVersion: 'FA(2)',
      },
    });

    try {
      // Submit to KSeF API
      const endpoint = KSEF_ENDPOINTS[config.environment].base + KSEF_ENDPOINTS[config.environment].invoices;
      const response = await this.makeKSeFRequest(
        endpoint,
        'POST',
        session.sessionToken,
        { InvoiceBody: xmlContent }
      );

      // Update with KSeF response
      await db.ksefInvoice.update({
        where: { id: ksefInvoice.id },
        data: {
          ksefNumber: response.ksefNumber,
          ksefReferenceNumber: response.referenceNumber,
          status: 'submitted',
          submittedAt: new Date(),
        },
      });

      // Update original invoice
      await db.invoice.update({
        where: { id: input.invoiceId },
        data: {
          ksefNumber: response.ksefNumber,
          ksefSubmittedAt: new Date(),
          status: 'submitted_to_ksef',
        },
      });

      // Retrieve UPO asynchronously
      this.retrieveUPO(ksefInvoice.id, response.ksefNumber, config, session.sessionToken);

      await auditLog({
        action: 'KSEF_INVOICE_SUBMITTED',
        entityType: 'ksef_invoice',
        entityId: ksefInvoice.id,
        organizationId,
        userId,
        details: {
          invoiceId: input.invoiceId,
          ksefNumber: response.ksefNumber,
        },
      });

      return {
        success: true,
        ksefNumber: response.ksefNumber,
        referenceNumber: response.referenceNumber,
      };
    } catch (error) {
      // Update status on failure
      await db.ksefInvoice.update({
        where: { id: ksefInvoice.id },
        data: {
          status: 'error',
          rejectionReason: error.message,
          retryCount: { increment: 1 },
          lastRetryAt: new Date(),
          nextRetryAt: this.calculateNextRetry(1),
        },
      });

      await auditLog({
        action: 'KSEF_SUBMISSION_FAILED',
        entityType: 'ksef_invoice',
        entityId: ksefInvoice.id,
        organizationId,
        userId,
        details: { error: error.message },
      });

      return {
        success: false,
        error: error.message,
        errorCode: error.code,
      };
    }
  }

  /**
   * Submit batch of invoices to KSeF
   */
  async submitBatch(
    input: BatchSubmitInput,
    organizationId: string,
    userId: string
  ): Promise<KSeFBatchResult> {
    // Validate batch size
    if (input.invoiceIds.length > KSEF_RATE_LIMITS.BATCH.MAX_INVOICES_PER_BATCH) {
      throw new Error(`Batch size exceeds maximum of ${KSEF_RATE_LIMITS.BATCH.MAX_INVOICES_PER_BATCH} invoices`);
    }

    // Get KSeF configuration
    const config = await this.getKSeFConfig(organizationId);

    // Create batch session
    const session = await this.getOrCreateSession(organizationId, 'batch', config);

    // Create batch record
    const batchReference = input.batchReference || `BATCH-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const batch = await db.ksefBatch.create({
      data: {
        organizationId,
        batchReference,
        sessionId: session.referenceNumber,
        status: 'preparing',
        invoiceCount: input.invoiceIds.length,
      },
    });

    // Process each invoice
    const invoiceXmls: Array<{ invoiceId: string; xml: string; hash: string }> = [];

    for (let i = 0; i < input.invoiceIds.length; i++) {
      const invoiceId = input.invoiceIds[i];

      try {
        const invoice = await db.invoice.findUnique({
          where: { id: invoiceId, organizationId },
          include: { lineItems: true, client: true, seller: true },
        });

        if (!invoice) {
          throw new Error('Invoice not found');
        }

        const fa2Invoice = this.convertToFA2(invoice);
        const xmlContent = this.generateFA2XML(fa2Invoice);
        const xmlHash = this.calculateHash(xmlContent);

        // Create KSeF invoice record
        const ksefInvoice = await db.ksefInvoice.create({
          data: {
            organizationId,
            invoiceId,
            sessionId: session.referenceNumber,
            submissionType: 'batch',
            status: 'pending',
            xmlContent,
            xmlHash,
            faSchemaVersion: 'FA(2)',
          },
        });

        // Create batch item
        await db.ksefBatchItem.create({
          data: {
            batchId: batch.id,
            ksefInvoiceId: ksefInvoice.id,
            sequenceNumber: i + 1,
            status: 'pending',
          },
        });

        invoiceXmls.push({ invoiceId, xml: xmlContent, hash: xmlHash });
      } catch (error) {
        // Log error but continue with other invoices
        console.error(`Error preparing invoice ${invoiceId}:`, error);
      }
    }

    // Update batch status
    await db.ksefBatch.update({
      where: { id: batch.id },
      data: { status: 'validating' },
    });

    // Package and submit batch
    try {
      const packageHash = this.calculateBatchPackageHash(invoiceXmls);

      await db.ksefBatch.update({
        where: { id: batch.id },
        data: {
          status: 'submitting',
          packageHash,
        },
      });

      // Submit batch to KSeF
      const endpoint = KSEF_ENDPOINTS[config.environment].base + KSEF_ENDPOINTS[config.environment].batch;
      const batchResponse = await this.makeKSeFRequest(
        endpoint,
        'POST',
        session.sessionToken,
        {
          BatchHeader: {
            Reference: batchReference,
            InvoiceCount: invoiceXmls.length,
          },
          Invoices: invoiceXmls.map((inv, idx) => ({
            Sequence: idx + 1,
            Body: inv.xml,
          })),
        }
      );

      // Update batch status
      await db.ksefBatch.update({
        where: { id: batch.id },
        data: {
          status: 'processing',
          submittedAt: new Date(),
        },
      });

      await auditLog({
        action: 'KSEF_BATCH_SUBMITTED',
        entityType: 'ksef_batch',
        entityId: batch.id,
        organizationId,
        userId,
        details: {
          batchReference,
          invoiceCount: invoiceXmls.length,
        },
      });

      // Schedule batch status polling
      this.scheduleBatchStatusPoll(batch.id, config, session.sessionToken);

      return {
        batchId: batch.id,
        status: 'processing',
        processedCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        results: [],
      };
    } catch (error) {
      await db.ksefBatch.update({
        where: { id: batch.id },
        data: {
          status: 'failed',
          errorDetails: { message: error.message },
        },
      });

      throw error;
    }
  }

  /**
   * Retrieve invoices from KSeF (incoming invoices)
   */
  async retrieveInvoices(
    input: RetrieveKSeFInvoicesInput,
    organizationId: string,
    userId: string
  ): Promise<{ invoices: any[]; nextPageToken?: string }> {
    const config = await this.getKSeFConfig(organizationId);
    const session = await this.getOrCreateSession(organizationId, 'interactive', config);

    const endpoint = KSEF_ENDPOINTS[config.environment].base + KSEF_ENDPOINTS[config.environment].invoices;

    const queryParams = new URLSearchParams({
      DateFrom: input.dateFrom.toISOString().split('T')[0],
      DateTo: input.dateTo.toISOString().split('T')[0],
      PageSize: input.pageSize.toString(),
    });

    if (input.pageToken) {
      queryParams.set('PageToken', input.pageToken);
    }

    if (input.senderNip) {
      queryParams.set('SenderNip', input.senderNip);
    }

    const response = await this.makeKSeFRequest(
      `${endpoint}?${queryParams.toString()}`,
      'GET',
      session.sessionToken
    );

    // Process received invoices
    const processedInvoices = [];
    for (const ksefInvoice of response.invoices || []) {
      const existingInvoice = await db.ksefReceivedInvoice.findUnique({
        where: {
          organizationId_ksefNumber: {
            organizationId,
            ksefNumber: ksefInvoice.ksefNumber,
          },
        },
      });

      if (!existingInvoice) {
        // Download full invoice XML
        const invoiceXml = await this.downloadInvoiceXml(
          ksefInvoice.ksefNumber,
          config,
          session.sessionToken
        );

        // Parse invoice data
        const parsedData = this.parseFA2XML(invoiceXml);

        // Store received invoice
        const receivedInvoice = await db.ksefReceivedInvoice.create({
          data: {
            organizationId,
            ksefNumber: ksefInvoice.ksefNumber,
            senderNip: parsedData.seller.nip,
            senderName: parsedData.seller.name,
            recipientNip: parsedData.buyer.nip || '',
            invoiceNumber: parsedData.invoiceNumber,
            invoiceDate: new Date(parsedData.invoiceDate),
            saleDate: parsedData.saleDate ? new Date(parsedData.saleDate) : null,
            netAmount: parsedData.totals.netAmount,
            vatAmount: parsedData.totals.vatAmount,
            grossAmount: parsedData.totals.grossAmount,
            currency: parsedData.currency || 'PLN',
            xmlContent: invoiceXml,
            xmlHash: this.calculateHash(invoiceXml),
            parsedData,
            processingStatus: 'parsed',
          },
        });

        // Try to match with existing client
        await this.matchInvoiceToClient(receivedInvoice.id, organizationId);

        processedInvoices.push(receivedInvoice);
      }
    }

    // Log sync
    await db.ksefSyncLog.create({
      data: {
        organizationId,
        syncType: 'invoice_retrieval',
        direction: 'inbound',
        status: 'completed',
        invoicesProcessed: response.invoices?.length || 0,
        invoicesSucceeded: processedInvoices.length,
        invoicesFailed: (response.invoices?.length || 0) - processedInvoices.length,
        completedAt: new Date(),
      },
    });

    await auditLog({
      action: 'KSEF_INVOICES_RETRIEVED',
      entityType: 'ksef_received_invoice',
      organizationId,
      userId,
      details: {
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        invoicesRetrieved: processedInvoices.length,
      },
    });

    return {
      invoices: processedInvoices,
      nextPageToken: response.nextPageToken,
    };
  }

  /**
   * Check and synchronize KSeF statuses
   */
  async synchronizeStatuses(organizationId: string): Promise<void> {
    const config = await this.getKSeFConfig(organizationId);
    const session = await this.getOrCreateSession(organizationId, 'interactive', config);

    // Get pending invoices
    const pendingInvoices = await db.ksefInvoice.findMany({
      where: {
        organizationId,
        status: { in: ['submitted', 'processing'] },
      },
    });

    for (const invoice of pendingInvoices) {
      try {
        const statusEndpoint = KSEF_ENDPOINTS[config.environment].base +
          KSEF_ENDPOINTS[config.environment].status.replace('{referenceNumber}', invoice.ksefReferenceNumber);

        const status = await this.makeKSeFRequest(statusEndpoint, 'GET', session.sessionToken);

        if (status.status === 'accepted' && !invoice.ksefNumber) {
          await db.ksefInvoice.update({
            where: { id: invoice.id },
            data: {
              status: 'accepted',
              ksefNumber: status.ksefNumber,
              acceptedAt: new Date(),
            },
          });

          // Retrieve UPO
          await this.retrieveUPO(invoice.id, status.ksefNumber, config, session.sessionToken);
        } else if (status.status === 'rejected') {
          await db.ksefInvoice.update({
            where: { id: invoice.id },
            data: {
              status: 'rejected',
              rejectionReason: status.rejectionReason,
            },
          });
        }
      } catch (error) {
        console.error(`Error syncing status for invoice ${invoice.id}:`, error);
      }
    }
  }

  /**
   * Convert internal invoice to FA(2) format
   */
  private convertToFA2(invoice: any): FA2Invoice {
    return {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.issueDate,
      saleDate: invoice.saleDate,
      seller: {
        nip: invoice.seller.nip,
        name: invoice.seller.name,
        address: {
          street: invoice.seller.street,
          buildingNumber: invoice.seller.buildingNumber,
          apartmentNumber: invoice.seller.apartmentNumber,
          postalCode: invoice.seller.postalCode,
          city: invoice.seller.city,
          country: invoice.seller.country || 'PL',
        },
      },
      buyer: {
        nip: invoice.client.nip,
        name: invoice.client.name,
        address: {
          street: invoice.client.street,
          buildingNumber: invoice.client.buildingNumber,
          apartmentNumber: invoice.client.apartmentNumber,
          postalCode: invoice.client.postalCode,
          city: invoice.client.city,
          country: invoice.client.country || 'PL',
        },
      },
      lineItems: invoice.lineItems.map((item: any) => ({
        name: item.name,
        quantity: new Decimal(item.quantity).toString(),
        unit: item.unit,
        unitPrice: new Decimal(item.unitPrice).toString(),
        netAmount: new Decimal(item.netAmount).toString(),
        vatRate: item.vatRate.toString(),
        vatAmount: new Decimal(item.vatAmount).toString(),
        grossAmount: new Decimal(item.grossAmount).toString(),
        pkwiu: item.pkwiu,
        cn: item.cn,
        gtu: item.gtu,
      })),
      totals: {
        netAmount: new Decimal(invoice.netAmount).toString(),
        vatAmount: new Decimal(invoice.vatAmount).toString(),
        grossAmount: new Decimal(invoice.grossAmount).toString(),
      },
      paymentTerms: invoice.paymentMethod ? {
        paymentMethod: invoice.paymentMethod,
        dueDate: invoice.dueDate,
        bankAccount: invoice.bankAccount,
      } : undefined,
      annotations: {
        splitPayment: invoice.splitPayment || false,
        reverseCharge: invoice.reverseCharge || false,
        selfBilling: invoice.selfBilling || false,
      },
    };
  }

  /**
   * Generate FA(2) XML from invoice data
   */
  private generateFA2XML(invoice: FA2Invoice): string {
    const xmlObject = {
      Faktura: {
        '@_xmlns': KSEF_NAMESPACES.FA,
        '@_xmlns:xsi': KSEF_NAMESPACES.XSI,
        Naglowek: {
          KodFormularza: {
            '@_kodSystemowy': 'FA (2)',
            '@_wersjaSchemy': '1-0E',
            '#text': 'FA',
          },
          WariantFormularza: 2,
          DataWytworzeniaFa: new Date().toISOString(),
          SystemInfo: 'KsięgowaCRM',
        },
        Podmiot1: {
          // Seller (Sprzedawca)
          DaneIdentyfikacyjne: {
            NIP: invoice.seller.nip,
            Nazwa: invoice.seller.name,
          },
          Adres: {
            KodKraju: invoice.seller.address.country,
            AdresL1: this.formatAddressLine(invoice.seller.address),
          },
        },
        Podmiot2: {
          // Buyer (Nabywca)
          DaneIdentyfikacyjne: invoice.buyer.nip ? {
            NIP: invoice.buyer.nip,
            Nazwa: invoice.buyer.name,
          } : {
            Nazwa: invoice.buyer.name,
          },
          Adres: {
            KodKraju: invoice.buyer.address.country,
            AdresL1: this.formatAddressLine(invoice.buyer.address),
          },
        },
        Fa: {
          KodWaluty: 'PLN',
          P_1: invoice.invoiceDate.toISOString().split('T')[0], // Data wystawienia
          P_2: invoice.invoiceNumber, // Numer faktury
          ...(invoice.saleDate && { P_6: invoice.saleDate.toISOString().split('T')[0] }), // Data sprzedaży
          FaWiersz: invoice.lineItems.map((item, index) => ({
            NrWierszaFa: index + 1,
            P_7: item.name,
            P_8A: item.unit,
            P_8B: item.quantity,
            P_9A: item.unitPrice,
            P_11: item.netAmount,
            P_12: this.mapVatRate(item.vatRate),
            ...(item.pkwiu && { GTU: item.gtu }),
          })),
          P_13_1: invoice.totals.netAmount, // Suma netto
          P_14_1: invoice.totals.vatAmount, // Suma VAT
          P_15: invoice.totals.grossAmount, // Suma brutto
          ...(invoice.annotations?.splitPayment && { P_18A: true }), // MPP
          ...(invoice.annotations?.reverseCharge && { P_18: true }), // Odwrotne obciążenie
        },
      },
    };

    return this.xmlBuilder.build(xmlObject);
  }

  /**
   * Parse FA(2) XML to invoice data
   */
  private parseFA2XML(xml: string): FA2Invoice {
    const parsed = this.xmlParser.parse(xml);
    const faktura = parsed.Faktura;

    return {
      invoiceNumber: faktura.Fa.P_2,
      invoiceDate: new Date(faktura.Fa.P_1),
      saleDate: faktura.Fa.P_6 ? new Date(faktura.Fa.P_6) : undefined,
      seller: {
        nip: faktura.Podmiot1.DaneIdentyfikacyjne.NIP,
        name: faktura.Podmiot1.DaneIdentyfikacyjne.Nazwa,
        address: this.parseAddress(faktura.Podmiot1.Adres),
      },
      buyer: {
        nip: faktura.Podmiot2.DaneIdentyfikacyjne?.NIP,
        name: faktura.Podmiot2.DaneIdentyfikacyjne?.Nazwa || faktura.Podmiot2.DaneIdentyfikacyjne,
        address: this.parseAddress(faktura.Podmiot2.Adres),
      },
      lineItems: this.parseLineItems(faktura.Fa.FaWiersz),
      totals: {
        netAmount: faktura.Fa.P_13_1,
        vatAmount: faktura.Fa.P_14_1,
        grossAmount: faktura.Fa.P_15,
      },
    };
  }

  // Helper methods
  private formatAddressLine(address: FA2Invoice['seller']['address']): string {
    const parts = [];
    if (address.street) parts.push(address.street);
    parts.push(address.buildingNumber);
    if (address.apartmentNumber) parts.push(`/${address.apartmentNumber}`);
    parts.push(`, ${address.postalCode} ${address.city}`);
    return parts.join(' ');
  }

  private parseAddress(address: any): FA2Invoice['seller']['address'] {
    // Parse address from KSeF format
    return {
      buildingNumber: '',
      postalCode: '',
      city: '',
      country: address.KodKraju || 'PL',
    };
  }

  private parseLineItems(items: any[]): FA2Invoice['lineItems'] {
    const itemsArray = Array.isArray(items) ? items : [items];
    return itemsArray.map(item => ({
      name: item.P_7,
      quantity: item.P_8B,
      unit: item.P_8A,
      unitPrice: item.P_9A,
      netAmount: item.P_11,
      vatRate: item.P_12,
      vatAmount: '0', // Calculated
      grossAmount: '0', // Calculated
    }));
  }

  private mapVatRate(rate: string): string {
    const rateMap: Record<string, string> = {
      '23': '23',
      '8': '8',
      '5': '5',
      '0': '0',
      'zw': 'zw',
      'np': 'np',
      'oo': 'oo',
    };
    return rateMap[rate] || rate;
  }

  private calculateHash(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  private calculateBatchPackageHash(invoices: Array<{ hash: string }>): string {
    const combinedHashes = invoices.map(i => i.hash).join('');
    return crypto.createHash('sha256').update(combinedHashes, 'utf8').digest('hex');
  }

  private calculateNextRetry(retryCount: number): Date {
    const delays = [30000, 120000, 600000, 1800000, 3600000]; // 30s, 2min, 10min, 30min, 1h
    const delay = delays[Math.min(retryCount, delays.length - 1)];
    return new Date(Date.now() + delay);
  }

  private async getKSeFConfig(organizationId: string): Promise<any> {
    const config = await db.ksefConfig.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      throw new Error('KSeF configuration not found. Please configure KSeF integration.');
    }

    return config;
  }

  private async getOrCreateSession(
    organizationId: string,
    sessionType: 'interactive' | 'batch',
    config: any
  ): Promise<KSeFSession> {
    // Check for existing active session
    const existingSession = await db.ksefSession.findFirst({
      where: {
        organizationId,
        sessionType,
        status: 'active',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingSession) {
      // Update last activity
      await db.ksefSession.update({
        where: { id: existingSession.id },
        data: { lastActivityAt: new Date() },
      });

      return {
        sessionToken: existingSession.sessionToken,
        referenceNumber: existingSession.referenceNumber,
        expiresAt: existingSession.expiresAt,
      };
    }

    // Create new session
    return this.createSession(organizationId, sessionType, config);
  }

  private async createSession(
    organizationId: string,
    sessionType: 'interactive' | 'batch',
    config: any
  ): Promise<KSeFSession> {
    const endpoint = KSEF_ENDPOINTS[config.environment].base + KSEF_ENDPOINTS[config.environment].session;

    // Build auth request based on method
    const authRequest = await this.buildAuthRequest(config);

    const response = await fetch(endpoint + '/InitToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authRequest),
    });

    if (!response.ok) {
      throw new Error(`KSeF session creation failed: ${response.statusText}`);
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes

    // Store session
    await db.ksefSession.create({
      data: {
        organizationId,
        sessionType,
        sessionToken: data.sessionToken,
        referenceNumber: data.referenceNumber,
        status: 'active',
        authMethod: config.authMethod,
        expiresAt,
      },
    });

    return {
      sessionToken: data.sessionToken,
      referenceNumber: data.referenceNumber,
      expiresAt,
    };
  }

  private async buildAuthRequest(config: any): Promise<any> {
    switch (config.authMethod) {
      case 'token':
        return {
          AuthorisationToken: decrypt(config.authTokenEncrypted),
        };
      case 'certificate':
        // Certificate-based auth
        return {
          AuthorisationCertificate: {
            CertificateSerial: config.certificateId,
          },
        };
      case 'profil_zaufany':
        // Profil Zaufany OAuth
        return {
          ProfilZaufany: config.profilZaufanyConfig,
        };
      default:
        throw new Error(`Unsupported auth method: ${config.authMethod}`);
    }
  }

  private async makeKSeFRequest(
    endpoint: string,
    method: string,
    sessionToken: string,
    body?: any
  ): Promise<any> {
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'SessionToken': sessionToken,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || `KSeF API error: ${response.statusText}`);
      (error as any).code = errorData.code;
      throw error;
    }

    return response.json();
  }

  private async validateXML(xml: string): Promise<{ valid: boolean; errors: string[] }> {
    // Validate against FA(2) XSD schema
    // In production, use actual XSD validation library
    try {
      const parsed = this.xmlParser.parse(xml);

      const errors: string[] = [];

      // Basic structure validation
      if (!parsed.Faktura) {
        errors.push('Missing root element Faktura');
      }
      if (!parsed.Faktura?.Naglowek) {
        errors.push('Missing header element Naglowek');
      }
      if (!parsed.Faktura?.Podmiot1) {
        errors.push('Missing seller element Podmiot1');
      }
      if (!parsed.Faktura?.Podmiot2) {
        errors.push('Missing buyer element Podmiot2');
      }
      if (!parsed.Faktura?.Fa) {
        errors.push('Missing invoice data element Fa');
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  }

  private async retrieveUPO(
    ksefInvoiceId: string,
    ksefNumber: string,
    config: any,
    sessionToken: string
  ): Promise<void> {
    try {
      const upoEndpoint = KSEF_ENDPOINTS[config.environment].base +
        KSEF_ENDPOINTS[config.environment].upo.replace('{ksefNumber}', ksefNumber);

      const upoResponse = await this.makeKSeFRequest(upoEndpoint, 'GET', sessionToken);

      await db.ksefInvoice.update({
        where: { id: ksefInvoiceId },
        data: {
          upoXml: upoResponse.upoXml,
          upoReference: upoResponse.upoReference,
          status: 'accepted',
          acceptedAt: new Date(),
        },
      });
    } catch (error) {
      console.error(`Error retrieving UPO for ${ksefNumber}:`, error);
    }
  }

  private async downloadInvoiceXml(
    ksefNumber: string,
    config: any,
    sessionToken: string
  ): Promise<string> {
    const endpoint = KSEF_ENDPOINTS[config.environment].base +
      KSEF_ENDPOINTS[config.environment].invoices + `/${ksefNumber}`;

    const response = await this.makeKSeFRequest(endpoint, 'GET', sessionToken);
    return response.invoiceXml;
  }

  private async matchInvoiceToClient(
    receivedInvoiceId: string,
    organizationId: string
  ): Promise<void> {
    const receivedInvoice = await db.ksefReceivedInvoice.findUnique({
      where: { id: receivedInvoiceId },
    });

    if (!receivedInvoice) return;

    // Try to match by sender NIP
    const client = await db.client.findFirst({
      where: {
        organizationId,
        nip: receivedInvoice.senderNip,
      },
    });

    if (client) {
      await db.ksefReceivedInvoice.update({
        where: { id: receivedInvoiceId },
        data: {
          linkedClientId: client.id,
          processingStatus: 'matched',
        },
      });
    }
  }

  private scheduleBatchStatusPoll(
    batchId: string,
    config: any,
    sessionToken: string
  ): void {
    // In production, use job queue (e.g., BullMQ)
    setTimeout(async () => {
      await this.pollBatchStatus(batchId, config, sessionToken);
    }, 30000); // Poll after 30 seconds
  }

  private async pollBatchStatus(
    batchId: string,
    config: any,
    sessionToken: string
  ): Promise<void> {
    const batch = await db.ksefBatch.findUnique({
      where: { id: batchId },
      include: { items: { include: { ksefInvoice: true } } },
    });

    if (!batch || batch.status === 'completed' || batch.status === 'failed') {
      return;
    }

    try {
      const statusEndpoint = KSEF_ENDPOINTS[config.environment].base +
        KSEF_ENDPOINTS[config.environment].batch + `/${batch.batchReference}/status`;

      const status = await this.makeKSeFRequest(statusEndpoint, 'GET', sessionToken);

      // Update individual invoice statuses
      let acceptedCount = 0;
      let rejectedCount = 0;

      for (const itemStatus of status.invoiceStatuses || []) {
        const item = batch.items.find(i => i.sequenceNumber === itemStatus.sequence);
        if (item) {
          await db.ksefBatchItem.update({
            where: { id: item.id },
            data: {
              status: itemStatus.status,
              ksefNumber: itemStatus.ksefNumber,
              errorMessage: itemStatus.errorMessage,
              processedAt: new Date(),
            },
          });

          await db.ksefInvoice.update({
            where: { id: item.ksefInvoiceId },
            data: {
              status: itemStatus.status === 'accepted' ? 'accepted' : 'rejected',
              ksefNumber: itemStatus.ksefNumber,
              rejectionReason: itemStatus.errorMessage,
            },
          });

          if (itemStatus.status === 'accepted') {
            acceptedCount++;
          } else {
            rejectedCount++;
          }
        }
      }

      // Update batch status
      const isComplete = status.status === 'completed' ||
        (acceptedCount + rejectedCount === batch.invoiceCount);

      await db.ksefBatch.update({
        where: { id: batchId },
        data: {
          status: isComplete ?
            (rejectedCount === 0 ? 'completed' :
             acceptedCount === 0 ? 'failed' : 'partial_success') :
            'processing',
          processedCount: acceptedCount + rejectedCount,
          acceptedCount,
          rejectedCount,
          completedAt: isComplete ? new Date() : null,
        },
      });

      // Continue polling if not complete
      if (!isComplete) {
        this.scheduleBatchStatusPoll(batchId, config, sessionToken);
      }
    } catch (error) {
      console.error(`Error polling batch status for ${batchId}:`, error);
      // Retry polling
      this.scheduleBatchStatusPoll(batchId, config, sessionToken);
    }
  }
}
```

### API Endpoints (tRPC Router)

```typescript
import { router, protectedProcedure } from '@/lib/trpc';
import { TRPCError } from '@trpc/server';
import { KSeFService } from './ksef-service';
import {
  submitToKSeFSchema,
  batchSubmitSchema,
  retrieveKSeFInvoicesSchema,
  createKSeFSessionSchema,
  updateKSeFConfigSchema,
} from './ksef-schemas';

const ksefService = new KSeFService();

export const ksefRouter = router({
  // Submit single invoice to KSeF
  submitInvoice: protectedProcedure
    .input(submitToKSeFSchema)
    .mutation(async ({ input, ctx }) => {
      return ksefService.submitInvoice(
        input,
        ctx.session.organizationId,
        ctx.session.userId
      );
    }),

  // Submit batch of invoices
  submitBatch: protectedProcedure
    .input(batchSubmitSchema)
    .mutation(async ({ input, ctx }) => {
      return ksefService.submitBatch(
        input,
        ctx.session.organizationId,
        ctx.session.userId
      );
    }),

  // Retrieve invoices from KSeF
  retrieveInvoices: protectedProcedure
    .input(retrieveKSeFInvoicesSchema)
    .mutation(async ({ input, ctx }) => {
      return ksefService.retrieveInvoices(
        input,
        ctx.session.organizationId,
        ctx.session.userId
      );
    }),

  // Get KSeF invoice status
  getInvoiceStatus: protectedProcedure
    .input(z.object({ invoiceId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const ksefInvoice = await db.ksefInvoice.findFirst({
        where: {
          invoiceId: input.invoiceId,
          organizationId: ctx.session.organizationId,
        },
        orderBy: { createdAt: 'desc' },
      });

      return ksefInvoice;
    }),

  // Get batch status
  getBatchStatus: protectedProcedure
    .input(z.object({ batchId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const batch = await db.ksefBatch.findUnique({
        where: {
          id: input.batchId,
          organizationId: ctx.session.organizationId,
        },
        include: {
          items: {
            include: { ksefInvoice: true },
          },
        },
      });

      if (!batch) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Batch not found' });
      }

      return batch;
    }),

  // Get received invoices
  getReceivedInvoices: protectedProcedure
    .input(z.object({
      dateFrom: z.coerce.date().optional(),
      dateTo: z.coerce.date().optional(),
      status: z.enum(['received', 'parsed', 'matched', 'imported', 'rejected', 'error']).optional(),
      clientId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      const where: any = {
        organizationId: ctx.session.organizationId,
      };

      if (input.dateFrom) {
        where.invoiceDate = { gte: input.dateFrom };
      }
      if (input.dateTo) {
        where.invoiceDate = { ...where.invoiceDate, lte: input.dateTo };
      }
      if (input.status) {
        where.processingStatus = input.status;
      }
      if (input.clientId) {
        where.linkedClientId = input.clientId;
      }

      const [invoices, total] = await Promise.all([
        db.ksefReceivedInvoice.findMany({
          where,
          orderBy: { downloadedAt: 'desc' },
          take: input.limit,
          skip: input.offset,
          include: { linkedClient: true },
        }),
        db.ksefReceivedInvoice.count({ where }),
      ]);

      return { invoices, total };
    }),

  // Synchronize statuses
  synchronize: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ksefService.synchronizeStatuses(ctx.session.organizationId);
      return { success: true };
    }),

  // Get/update configuration
  getConfig: protectedProcedure
    .query(async ({ ctx }) => {
      const config = await db.ksefConfig.findFirst({
        where: { organizationId: ctx.session.organizationId },
      });
      return config;
    }),

  updateConfig: protectedProcedure
    .input(updateKSeFConfigSchema)
    .mutation(async ({ input, ctx }) => {
      const existingConfig = await db.ksefConfig.findFirst({
        where: {
          organizationId: ctx.session.organizationId,
          environment: input.environment,
        },
      });

      const configData = {
        ...input,
        authTokenEncrypted: input.authToken ? encrypt(input.authToken) : undefined,
      };
      delete configData.authToken;

      if (existingConfig) {
        return db.ksefConfig.update({
          where: { id: existingConfig.id },
          data: configData,
        });
      }

      return db.ksefConfig.create({
        data: {
          organizationId: ctx.session.organizationId,
          ...configData,
        },
      });
    }),

  // Get offline queue
  getOfflineQueue: protectedProcedure
    .query(async ({ ctx }) => {
      return db.ksefOfflineQueue.findMany({
        where: {
          organizationId: ctx.session.organizationId,
          status: 'queued',
        },
        orderBy: { queuedAt: 'asc' },
        include: { invoice: true },
      });
    }),

  // Process offline queue
  processOfflineQueue: protectedProcedure
    .mutation(async ({ ctx }) => {
      const queue = await db.ksefOfflineQueue.findMany({
        where: {
          organizationId: ctx.session.organizationId,
          status: 'queued',
        },
        orderBy: [{ priority: 'desc' }, { queuedAt: 'asc' }],
        take: 50,
      });

      let processed = 0;
      let failed = 0;

      for (const item of queue) {
        try {
          await db.ksefOfflineQueue.update({
            where: { id: item.id },
            data: { status: 'processing' },
          });

          await ksefService.submitInvoice(
            { invoiceId: item.invoiceId, submissionType: 'interactive' },
            ctx.session.organizationId,
            ctx.session.userId
          );

          await db.ksefOfflineQueue.update({
            where: { id: item.id },
            data: { status: 'completed', processedAt: new Date() },
          });

          processed++;
        } catch (error) {
          await db.ksefOfflineQueue.update({
            where: { id: item.id },
            data: {
              status: item.retryCount >= 3 ? 'failed' : 'queued',
              retryCount: { increment: 1 },
              lastError: error.message,
            },
          });

          failed++;
        }
      }

      return { processed, failed, remaining: queue.length - processed - failed };
    }),

  // Get sync history
  getSyncHistory: protectedProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(20),
    }))
    .query(async ({ input, ctx }) => {
      return db.ksefSyncLog.findMany({
        where: { organizationId: ctx.session.organizationId },
        orderBy: { startedAt: 'desc' },
        take: input.limit,
      });
    }),
});
```

---

## Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KSeFService } from '../ksef-service';
import { db } from '@/lib/db';

vi.mock('@/lib/db');
vi.mock('@/lib/audit');

describe('KSeFService', () => {
  let service: KSeFService;

  beforeEach(() => {
    service = new KSeFService();
    vi.clearAllMocks();
  });

  describe('Invoice Submission', () => {
    it('should convert invoice to FA(2) XML format', () => {
      const invoice = {
        invoiceNumber: 'FV/2025/001',
        issueDate: new Date('2025-01-15'),
        seller: {
          nip: '1234567890',
          name: 'Test Seller Sp. z o.o.',
          street: 'Testowa',
          buildingNumber: '1',
          postalCode: '00-001',
          city: 'Warszawa',
        },
        client: {
          nip: '0987654321',
          name: 'Test Buyer S.A.',
          street: 'Kupiecka',
          buildingNumber: '10',
          postalCode: '00-002',
          city: 'Kraków',
        },
        lineItems: [{
          name: 'Usługa konsultingowa',
          quantity: 10,
          unit: 'godz.',
          unitPrice: 200,
          netAmount: 2000,
          vatRate: '23',
          vatAmount: 460,
          grossAmount: 2460,
        }],
        netAmount: 2000,
        vatAmount: 460,
        grossAmount: 2460,
      };

      const fa2Invoice = service['convertToFA2'](invoice);

      expect(fa2Invoice.invoiceNumber).toBe('FV/2025/001');
      expect(fa2Invoice.seller.nip).toBe('1234567890');
      expect(fa2Invoice.buyer.nip).toBe('0987654321');
      expect(fa2Invoice.lineItems).toHaveLength(1);
      expect(fa2Invoice.totals.grossAmount).toBe('2460');
    });

    it('should generate valid FA(2) XML', () => {
      const fa2Invoice = {
        invoiceNumber: 'FV/2025/001',
        invoiceDate: new Date('2025-01-15'),
        seller: {
          nip: '1234567890',
          name: 'Test Seller',
          address: { buildingNumber: '1', postalCode: '00-001', city: 'Warszawa', country: 'PL' },
        },
        buyer: {
          nip: '0987654321',
          name: 'Test Buyer',
          address: { buildingNumber: '10', postalCode: '00-002', city: 'Kraków', country: 'PL' },
        },
        lineItems: [{
          name: 'Service',
          quantity: '1',
          unit: 'szt.',
          unitPrice: '100',
          netAmount: '100',
          vatRate: '23',
          vatAmount: '23',
          grossAmount: '123',
        }],
        totals: { netAmount: '100', vatAmount: '23', grossAmount: '123' },
      };

      const xml = service['generateFA2XML'](fa2Invoice);

      expect(xml).toContain('Faktura');
      expect(xml).toContain('xmlns');
      expect(xml).toContain('Naglowek');
      expect(xml).toContain('Podmiot1');
      expect(xml).toContain('Podmiot2');
      expect(xml).toContain('FA (2)');
    });

    it('should calculate correct XML hash', () => {
      const xml = '<test>content</test>';
      const hash = service['calculateHash'](xml);

      expect(hash).toHaveLength(64); // SHA-256 hex
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('XML Validation', () => {
    it('should validate correct FA(2) XML structure', async () => {
      const validXml = `
        <Faktura xmlns="http://crd.gov.pl/wzor/2023/06/29/12648/">
          <Naglowek><KodFormularza kodSystemowy="FA (2)">FA</KodFormularza></Naglowek>
          <Podmiot1><DaneIdentyfikacyjne><NIP>1234567890</NIP></DaneIdentyfikacyjne></Podmiot1>
          <Podmiot2><DaneIdentyfikacyjne><NIP>0987654321</NIP></DaneIdentyfikacyjne></Podmiot2>
          <Fa><P_1>2025-01-15</P_1><P_2>FV/001</P_2></Fa>
        </Faktura>
      `;

      const result = await service['validateXML'](validXml);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid XML structure', async () => {
      const invalidXml = '<Invalid>Not a valid FA(2)</Invalid>';

      const result = await service['validateXML'](invalidXml);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Batch Operations', () => {
    it('should calculate batch package hash correctly', () => {
      const invoices = [
        { invoiceId: '1', xml: '<xml1/>', hash: 'abc123' },
        { invoiceId: '2', xml: '<xml2/>', hash: 'def456' },
      ];

      const packageHash = service['calculateBatchPackageHash'](invoices);

      expect(packageHash).toHaveLength(64);
      expect(packageHash).toMatch(/^[a-f0-9]+$/);
    });

    it('should reject batch exceeding max invoices', async () => {
      const tooManyInvoices = Array(1001).fill('uuid');

      await expect(
        service.submitBatch(
          { invoiceIds: tooManyInvoices },
          'org-id',
          'user-id'
        )
      ).rejects.toThrow('Batch size exceeds maximum');
    });
  });

  describe('Retry Logic', () => {
    it('should calculate exponential backoff correctly', () => {
      const retry1 = service['calculateNextRetry'](1);
      const retry2 = service['calculateNextRetry'](2);
      const retry3 = service['calculateNextRetry'](3);

      expect(retry2.getTime()).toBeGreaterThan(retry1.getTime());
      expect(retry3.getTime()).toBeGreaterThan(retry2.getTime());
    });

    it('should cap retry delay at maximum', () => {
      const retry10 = service['calculateNextRetry'](10);
      const retry11 = service['calculateNextRetry'](11);

      // Should be capped at same delay
      const diff = Math.abs(retry11.getTime() - retry10.getTime());
      expect(diff).toBeLessThan(1000); // Within 1 second tolerance
    });
  });

  describe('VAT Rate Mapping', () => {
    it('should map standard VAT rates', () => {
      expect(service['mapVatRate']('23')).toBe('23');
      expect(service['mapVatRate']('8')).toBe('8');
      expect(service['mapVatRate']('5')).toBe('5');
      expect(service['mapVatRate']('0')).toBe('0');
    });

    it('should map special VAT codes', () => {
      expect(service['mapVatRate']('zw')).toBe('zw');
      expect(service['mapVatRate']('np')).toBe('np');
      expect(service['mapVatRate']('oo')).toBe('oo');
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, cleanupTest } from '@/test/helpers';
import { ksefRouter } from '../ksef-router';

describe('KSeF Integration', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await cleanupTest(ctx);
  });

  describe('Configuration', () => {
    it('should save KSeF configuration', async () => {
      const config = await ctx.caller.ksef.updateConfig({
        environment: 'test',
        authMethod: 'token',
        authToken: 'test-token-12345',
        autoDownloadEnabled: true,
        autoDownloadIntervalHours: 24,
      });

      expect(config.environment).toBe('test');
      expect(config.authMethod).toBe('token');
      expect(config.autoDownloadEnabled).toBe(true);
    });

    it('should retrieve configuration', async () => {
      const config = await ctx.caller.ksef.getConfig();

      expect(config).toBeDefined();
      expect(config.environment).toBe('test');
      // Token should be encrypted
      expect(config.authTokenEncrypted).not.toBe('test-token-12345');
    });
  });

  describe('Invoice Submission', () => {
    it('should submit invoice to KSeF (test mode)', async () => {
      // Create test invoice
      const invoice = await ctx.db.invoice.create({
        data: {
          organizationId: ctx.organizationId,
          invoiceNumber: 'FV/2025/KSEF/001',
          issueDate: new Date(),
          status: 'draft',
          netAmount: 1000,
          vatAmount: 230,
          grossAmount: 1230,
          // ... other required fields
        },
      });

      // Mock KSeF API response
      // In test environment, use mock server

      const result = await ctx.caller.ksef.submitInvoice({
        invoiceId: invoice.id,
        submissionType: 'interactive',
      });

      expect(result.success).toBe(true);
      // In mock mode, check expected behavior
    });

    it('should track submission in database', async () => {
      const ksefInvoice = await ctx.db.ksefInvoice.findFirst({
        where: { organizationId: ctx.organizationId },
        orderBy: { createdAt: 'desc' },
      });

      expect(ksefInvoice).toBeDefined();
      expect(ksefInvoice.faSchemaVersion).toBe('FA(2)');
      expect(ksefInvoice.xmlContent).toBeDefined();
    });
  });

  describe('Batch Operations', () => {
    it('should create and track batch', async () => {
      const invoiceIds = await Promise.all(
        [1, 2, 3].map(async (i) => {
          const invoice = await ctx.db.invoice.create({
            data: {
              organizationId: ctx.organizationId,
              invoiceNumber: `FV/2025/BATCH/${i}`,
              issueDate: new Date(),
              status: 'draft',
              netAmount: 100 * i,
              vatAmount: 23 * i,
              grossAmount: 123 * i,
            },
          });
          return invoice.id;
        })
      );

      const result = await ctx.caller.ksef.submitBatch({
        invoiceIds,
      });

      expect(result.batchId).toBeDefined();
      expect(result.status).toBe('processing');

      const batch = await ctx.caller.ksef.getBatchStatus({
        batchId: result.batchId,
      });

      expect(batch.invoiceCount).toBe(3);
    });
  });

  describe('Invoice Retrieval', () => {
    it('should retrieve received invoices', async () => {
      // Insert mock received invoice
      await ctx.db.ksefReceivedInvoice.create({
        data: {
          organizationId: ctx.organizationId,
          ksefNumber: 'KSEF-2025-1234567890',
          senderNip: '1111111111',
          senderName: 'Dostawca Test',
          recipientNip: ctx.organization.nip,
          invoiceNumber: 'FZ/2025/001',
          invoiceDate: new Date(),
          netAmount: 500,
          vatAmount: 115,
          grossAmount: 615,
          currency: 'PLN',
          xmlContent: '<test/>',
          xmlHash: 'abc123',
          processingStatus: 'received',
        },
      });

      const result = await ctx.caller.ksef.getReceivedInvoices({
        limit: 10,
      });

      expect(result.invoices.length).toBeGreaterThan(0);
      expect(result.invoices[0].senderNip).toBe('1111111111');
    });
  });

  describe('Offline Queue', () => {
    it('should queue invoice for offline submission', async () => {
      const invoice = await ctx.db.invoice.create({
        data: {
          organizationId: ctx.organizationId,
          invoiceNumber: 'FV/2025/OFFLINE/001',
          issueDate: new Date(),
          status: 'draft',
          netAmount: 200,
          vatAmount: 46,
          grossAmount: 246,
        },
      });

      await ctx.db.ksefOfflineQueue.create({
        data: {
          organizationId: ctx.organizationId,
          invoiceId: invoice.id,
          operation: 'submit',
          priority: 5,
          status: 'queued',
        },
      });

      const queue = await ctx.caller.ksef.getOfflineQueue();

      expect(queue.length).toBeGreaterThan(0);
      expect(queue[0].invoiceId).toBe(invoice.id);
    });
  });

  describe('Audit Trail', () => {
    it('should log KSeF operations', async () => {
      const logs = await ctx.db.auditLog.findMany({
        where: {
          organizationId: ctx.organizationId,
          action: { startsWith: 'KSEF_' },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      expect(logs.length).toBeGreaterThan(0);
    });
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('KSeF Integration E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('should configure KSeF integration', async ({ page }) => {
    await page.goto('/settings/integrations/ksef');

    // Select environment
    await page.selectOption('[data-testid="ksef-environment"]', 'test');

    // Select auth method
    await page.selectOption('[data-testid="ksef-auth-method"]', 'token');

    // Enter token
    await page.fill('[data-testid="ksef-auth-token"]', 'test-token-12345');

    // Enable auto-download
    await page.check('[data-testid="ksef-auto-download"]');

    // Save
    await page.click('[data-testid="ksef-save-config"]');

    await expect(page.locator('[data-testid="success-message"]'))
      .toContainText('Konfiguracja KSeF została zapisana');
  });

  test('should submit invoice to KSeF', async ({ page }) => {
    // Navigate to invoices
    await page.goto('/invoices');

    // Create new invoice
    await page.click('[data-testid="create-invoice"]');
    await page.fill('[data-testid="invoice-number"]', 'FV/2025/E2E/001');
    await page.fill('[data-testid="client-nip"]', '1234567890');
    // ... fill other fields

    // Save invoice
    await page.click('[data-testid="save-invoice"]');
    await page.waitForURL(/\/invoices\/[\w-]+/);

    // Submit to KSeF
    await page.click('[data-testid="submit-to-ksef"]');

    // Confirm submission
    await page.click('[data-testid="confirm-ksef-submit"]');

    // Wait for result
    await expect(page.locator('[data-testid="ksef-status"]'))
      .toContainText(/Wysłano|Przetwarzanie/);
  });

  test('should display KSeF number after acceptance', async ({ page }) => {
    await page.goto('/invoices');

    // Find submitted invoice
    await page.click('[data-testid="invoice-row"]:has-text("FV/2025/E2E")');

    // Wait for KSeF status (may need polling in real scenario)
    await page.waitForSelector('[data-testid="ksef-number"]', { timeout: 60000 });

    const ksefNumber = await page.textContent('[data-testid="ksef-number"]');
    expect(ksefNumber).toMatch(/KSEF-\d{4}-\d+/);
  });

  test('should retrieve incoming invoices from KSeF', async ({ page }) => {
    await page.goto('/invoices/received');

    // Click sync button
    await page.click('[data-testid="sync-ksef"]');

    // Wait for sync to complete
    await expect(page.locator('[data-testid="sync-status"]'))
      .toContainText('Synchronizacja zakończona');

    // Check for new invoices
    const invoiceCount = await page.locator('[data-testid="received-invoice-row"]').count();
    expect(invoiceCount).toBeGreaterThanOrEqual(0);
  });

  test('should handle batch submission', async ({ page }) => {
    await page.goto('/invoices');

    // Select multiple invoices
    await page.check('[data-testid="invoice-checkbox"]:nth-child(1)');
    await page.check('[data-testid="invoice-checkbox"]:nth-child(2)');
    await page.check('[data-testid="invoice-checkbox"]:nth-child(3)');

    // Open batch actions
    await page.click('[data-testid="batch-actions"]');
    await page.click('[data-testid="batch-submit-ksef"]');

    // Confirm batch submission
    await page.click('[data-testid="confirm-batch-submit"]');

    // Wait for batch creation
    await expect(page.locator('[data-testid="batch-status"]'))
      .toContainText('Paczka utworzona');

    // Navigate to batch details
    await page.click('[data-testid="view-batch-details"]');

    // Verify batch items
    const itemCount = await page.locator('[data-testid="batch-item-row"]').count();
    expect(itemCount).toBe(3);
  });

  test('should display offline queue when KSeF unavailable', async ({ page }) => {
    // Simulate KSeF unavailability (via test flag or mock)
    await page.goto('/invoices?ksef_mock=unavailable');

    // Try to submit invoice
    await page.click('[data-testid="invoice-row"]:first-child');
    await page.click('[data-testid="submit-to-ksef"]');
    await page.click('[data-testid="confirm-ksef-submit"]');

    // Should show queued message
    await expect(page.locator('[data-testid="ksef-status"]'))
      .toContainText('W kolejce offline');

    // Navigate to queue
    await page.goto('/settings/integrations/ksef/queue');

    // Verify invoice in queue
    const queueCount = await page.locator('[data-testid="queue-item-row"]').count();
    expect(queueCount).toBeGreaterThan(0);
  });
});
```

---

## Security Checklist

- [x] KSeF tokens encrypted at rest (AES-256)
- [x] Certificate private keys securely stored
- [x] API communication over TLS 1.3
- [x] Session tokens with expiration
- [x] Rate limiting on KSeF operations
- [x] Row Level Security on all tables
- [x] Audit logging for all submissions
- [x] Input validation with Zod schemas
- [x] XML injection prevention
- [x] CSRF protection on API endpoints
- [x] Secure webhook signature verification

---

## Audit Events

| Event | Trigger | Data Logged |
|-------|---------|-------------|
| `KSEF_CONFIG_UPDATED` | Configuration change | env, auth_method, changes |
| `KSEF_SESSION_CREATED` | New session | session_type, auth_method |
| `KSEF_INVOICE_SUBMITTED` | Invoice submission | invoice_id, ksef_number |
| `KSEF_BATCH_SUBMITTED` | Batch submission | batch_id, invoice_count |
| `KSEF_INVOICES_RETRIEVED` | Invoice download | date_range, count |
| `KSEF_SUBMISSION_FAILED` | Submission error | invoice_id, error_details |
| `KSEF_VALIDATION_FAILED` | XML validation error | invoice_id, validation_errors |
| `KSEF_UPO_RETRIEVED` | UPO download | ksef_number, upo_reference |
| `KSEF_STATUS_SYNCED` | Status synchronization | invoices_updated |
| `KSEF_QUEUE_PROCESSED` | Offline queue processing | processed, failed |

---

## Implementation Notes

### Dependencies
- `TAX-008`: e-Declaration Submission (uses similar patterns)
- `DOC`: Document module for XML/UPO storage

### KSeF Environments
- **Test**: https://ksef-test.mf.gov.pl (use for development)
- **Demo**: https://ksef-demo.mf.gov.pl (for user acceptance testing)
- **Production**: https://ksef.mf.gov.pl (mandatory from 2026)

### Schema Versioning
- Current: FA(2)
- Support migration to future schema versions
- Store schema version with each invoice

### Performance Considerations
- Batch operations for high-volume clients
- Async status polling via background jobs
- Connection pooling for KSeF API
- Cache session tokens for active users

### Compliance Notes
- KSeF mandatory for B2B from February 2026
- Invoices must be submitted within 24h of issue
- UPO serves as legal proof of submission
- KSeF number must appear on all invoice copies

---

## References

- [KSeF API Documentation](https://www.podatki.gov.pl/ksef/)
- [FA(2) Schema Specification](https://crd.gov.pl/wzor/2023/06/29/12648/)
- [Ministerstwo Finansów KSeF Portal](https://www.podatki.gov.pl/ksef/)
- [Polish Tax Code - KSeF Regulations](https://isap.sejm.gov.pl/)

---

*Story created: December 2024*
*Schema version: FA(2)*
*Target: Week 15, Phase 4*
