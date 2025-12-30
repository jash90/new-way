# BNK-005: Payment Initiation

> **Story ID**: BNK-005
> **Epic**: Banking Integration Layer (BNK)
> **Priority**: P0 (Critical)
> **Story Points**: 13
> **Phase**: Week 23
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant,
**I want to** initiate payments directly from the platform,
**So that** I can process invoices without logging into bank portals and maintain full audit trail.

---

## Acceptance Criteria

### AC1: SEPA Credit Transfer
```gherkin
Feature: SEPA Credit Transfer
  Scenario: Initiate standard SEPA payment
    Given user has active bank connection
    And sufficient account balance
    When user initiates SEPA payment
      | creditor_name | "ABC Company GmbH" |
      | creditor_iban | "DE89370400440532013000" |
      | amount | 5000.00 |
      | currency | "EUR" |
      | reference | "INV-2024-001" |
    Then payment request is created
    And SCA authorization is required
    And payment status is "PENDING_AUTHORIZATION"
    And audit event "PAYMENT_INITIATED" is logged

  Scenario: SEPA payment validation
    Given user enters invalid IBAN format
    When payment is submitted
    Then validation error is returned
    And error message shows "Nieprawidłowy format IBAN"
```

### AC2: SEPA Instant Payments
```gherkin
Feature: SEPA Instant Payments
  Scenario: Initiate instant SEPA payment
    Given bank supports SEPA Instant
    And amount is within instant limit (100,000 EUR)
    When user selects instant payment option
    Then payment is processed within 10 seconds
    And confirmation is received immediately
    And higher fee is applied if applicable

  Scenario: Instant payment fallback
    Given instant payment fails due to timeout
    When retry is triggered
    Then fallback to standard SEPA is offered
    And user is notified of the change
```

### AC3: Domestic Transfers (Elixir)
```gherkin
Feature: Domestic PLN Transfers
  Scenario: Initiate Elixir transfer
    Given user initiates PLN domestic transfer
      | creditor_name | "Jan Kowalski" |
      | creditor_account | "PL61109010140000071219812874" |
      | amount | 15000.00 |
    When payment is submitted
    Then Elixir transfer is created
    And expected execution is next business day
    And SORBNET is used if amount > 1,000,000 PLN

  Scenario: Express Elixir transfer
    Given user selects express option
    And amount is within Express Elixir limits
    When payment is submitted
    Then Express Elixir transfer is created
    And expected execution is within 15 minutes
```

### AC4: Split Payment (VAT)
```gherkin
Feature: Split Payment (Podzielona Płatność)
  Scenario: Mandatory split payment for B2B > 15,000 PLN
    Given invoice amount is 18,450.00 PLN
    And transaction is B2B
    And counterparty is VAT registered
    When payment is initiated
    Then split payment is automatically applied
    And net amount goes to main account
    And VAT amount goes to VAT account
    And payment reference includes "MPP" marker

  Scenario: Voluntary split payment
    Given user selects split payment option
    And invoice details are provided
      | gross_amount | 12300.00 |
      | vat_amount | 2300.00 |
      | invoice_number | "FV/2024/001" |
      | nip | "1234567890" |
    When payment is submitted
    Then split payment transfer is created
    And VAT is directed to VAT account
```

### AC5: White List Verification
```gherkin
Feature: White List Verification
  Scenario: Verify account on VAT White List
    Given payment amount > 15,000 PLN
    And counterparty has NIP
    When payment is prepared
    Then White List API is called
    And verification result is stored
    And if not on White List, warning is shown

  Scenario: Block payment to non-verified account
    Given client has strict White List policy
    And account is not on White List
    When payment is initiated
    Then payment is blocked
    And reason is logged
    And alternative accounts are suggested if available
```

### AC6: Payment Scheduling
```gherkin
Feature: Payment Scheduling
  Scenario: Schedule future payment
    Given user sets execution date "2024-02-15"
    When payment is scheduled
    Then payment status is "SCHEDULED"
    And payment will be executed on specified date
    And reminder is set for day before

  Scenario: Cancel scheduled payment
    Given scheduled payment exists
    And execution date is in the future
    When user cancels payment
    Then payment status changes to "CANCELLED"
    And cancellation is logged
```

### AC7: Batch Payments
```gherkin
Feature: Batch Payment Processing
  Scenario: Process multiple payments in batch
    Given user uploads payment file with 50 payments
    When batch is submitted
    Then all payments are validated
    And batch SCA authorization is requested
    And payments are processed in parallel
    And batch summary report is generated

  Scenario: Partial batch execution
    Given batch contains 50 payments
    And 5 payments fail validation
    When batch is submitted
    Then 45 valid payments are processed
    And 5 failures are reported
    And user can retry failed payments
```

---

## Technical Specification

### Database Schema

```sql
-- Payment types enum
CREATE TYPE payment_type AS ENUM (
    'SEPA',
    'SEPA_INSTANT',
    'DOMESTIC',
    'DOMESTIC_EXPRESS',
    'INTERNATIONAL',
    'SPLIT_PAYMENT'
);

-- Payment status enum
CREATE TYPE payment_status AS ENUM (
    'DRAFT',
    'PENDING_AUTHORIZATION',
    'AUTHORIZED',
    'PENDING_EXECUTION',
    'SCHEDULED',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'REJECTED',
    'CANCELLED'
);

-- Payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    connection_id UUID NOT NULL REFERENCES bank_connections(id),
    account_id UUID NOT NULL REFERENCES bank_accounts(id),

    -- Payment identification
    payment_reference VARCHAR(35) NOT NULL,
    end_to_end_id VARCHAR(35),
    bank_payment_id VARCHAR(255),

    -- Payment type and status
    payment_type payment_type NOT NULL,
    status payment_status NOT NULL DEFAULT 'DRAFT',

    -- Creditor details
    creditor_name VARCHAR(140) NOT NULL,
    creditor_iban VARCHAR(34) NOT NULL,
    creditor_bic VARCHAR(11),
    creditor_address JSONB,

    -- Amount
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'PLN',

    -- Split payment details
    is_split_payment BOOLEAN DEFAULT FALSE,
    vat_amount DECIMAL(15, 2),
    vat_account VARCHAR(34),
    invoice_number VARCHAR(100),
    counterparty_nip VARCHAR(10),

    -- Remittance info
    remittance_info TEXT,
    structured_reference VARCHAR(35),

    -- Scheduling
    requested_execution_date DATE,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    executed_at TIMESTAMP WITH TIME ZONE,

    -- White List verification
    white_list_verified BOOLEAN,
    white_list_check_date TIMESTAMP WITH TIME ZONE,
    white_list_result JSONB,

    -- SCA
    sca_required BOOLEAN DEFAULT TRUE,
    sca_status VARCHAR(50),
    sca_method VARCHAR(50),
    authorization_id VARCHAR(255),

    -- Related entities
    invoice_id UUID,
    batch_id UUID REFERENCES payment_batches(id),

    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP WITH TIME ZONE,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_amount CHECK (amount > 0),
    CONSTRAINT valid_split_payment CHECK (
        (is_split_payment = FALSE) OR
        (is_split_payment = TRUE AND vat_amount IS NOT NULL AND counterparty_nip IS NOT NULL)
    )
);

-- Payment batches table
CREATE TABLE payment_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    connection_id UUID NOT NULL REFERENCES bank_connections(id),

    -- Batch info
    name VARCHAR(255),
    description TEXT,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    total_payments INTEGER NOT NULL DEFAULT 0,
    successful_payments INTEGER DEFAULT 0,
    failed_payments INTEGER DEFAULT 0,

    -- Amounts
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    processed_amount DECIMAL(15, 2) DEFAULT 0,

    -- SCA
    authorization_id VARCHAR(255),
    authorized_at TIMESTAMP WITH TIME ZONE,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    executed_at TIMESTAMP WITH TIME ZONE
);

-- Payment audit table
CREATE TABLE payment_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),

    -- Audit details
    action VARCHAR(50) NOT NULL,
    old_status payment_status,
    new_status payment_status,
    details JSONB,

    -- User info
    performed_by UUID REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- White List cache
CREATE TABLE white_list_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nip VARCHAR(10) NOT NULL,
    account_number VARCHAR(34) NOT NULL,

    -- Verification result
    is_verified BOOLEAN NOT NULL,
    verification_date DATE NOT NULL,
    api_request_id VARCHAR(255),

    -- Cache metadata
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    UNIQUE(nip, account_number, verification_date)
);

-- Indexes
CREATE INDEX idx_payments_client_status ON payments(client_id, status);
CREATE INDEX idx_payments_scheduled ON payments(scheduled_at) WHERE status = 'SCHEDULED';
CREATE INDEX idx_payments_batch ON payments(batch_id);
CREATE INDEX idx_payment_audit_payment ON payment_audit(payment_id);
CREATE INDEX idx_white_list_nip_account ON white_list_cache(nip, account_number);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_client_isolation ON payments
    USING (client_id = current_setting('app.current_client_id')::UUID);
CREATE POLICY batches_client_isolation ON payment_batches
    USING (client_id = current_setting('app.current_client_id')::UUID);
```

### Zod Schemas

```typescript
// src/modules/bnk/schemas/payment.schema.ts
import { z } from 'zod';

// Enums
export const PaymentTypeEnum = z.enum([
  'SEPA',
  'SEPA_INSTANT',
  'DOMESTIC',
  'DOMESTIC_EXPRESS',
  'INTERNATIONAL',
  'SPLIT_PAYMENT'
]);

export const PaymentStatusEnum = z.enum([
  'DRAFT',
  'PENDING_AUTHORIZATION',
  'AUTHORIZED',
  'PENDING_EXECUTION',
  'SCHEDULED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'REJECTED',
  'CANCELLED'
]);

// IBAN validation
const IBANSchema = z.string().regex(
  /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/,
  'Nieprawidłowy format IBAN'
);

// NIP validation
const NIPSchema = z.string().regex(
  /^[0-9]{10}$/,
  'NIP musi składać się z 10 cyfr'
);

// Base payment schema
export const PaymentSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  connectionId: z.string().uuid(),
  accountId: z.string().uuid(),

  paymentReference: z.string(),
  endToEndId: z.string().nullable(),
  bankPaymentId: z.string().nullable(),

  paymentType: PaymentTypeEnum,
  status: PaymentStatusEnum,

  creditorName: z.string().max(140),
  creditorIban: IBANSchema,
  creditorBic: z.string().max(11).nullable(),
  creditorAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().length(2).optional()
  }).nullable(),

  amount: z.number().positive(),
  currency: z.string().length(3),

  isSplitPayment: z.boolean(),
  vatAmount: z.number().nullable(),
  vatAccount: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  counterpartyNip: NIPSchema.nullable(),

  remittanceInfo: z.string().max(140).nullable(),
  structuredReference: z.string().max(35).nullable(),

  requestedExecutionDate: z.string().date().nullable(),
  scheduledAt: z.string().datetime().nullable(),
  executedAt: z.string().datetime().nullable(),

  whiteListVerified: z.boolean().nullable(),
  whiteListCheckDate: z.string().datetime().nullable(),

  scaRequired: z.boolean(),
  scaStatus: z.string().nullable(),
  authorizationId: z.string().nullable(),

  invoiceId: z.string().uuid().nullable(),
  batchId: z.string().uuid().nullable(),

  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  retryCount: z.number(),

  createdAt: z.string().datetime(),
  createdBy: z.string().uuid()
});

// Create payment request
export const CreatePaymentRequestSchema = z.object({
  connectionId: z.string().uuid(),
  accountId: z.string().uuid(),

  paymentType: PaymentTypeEnum,

  creditorName: z.string().min(1).max(140),
  creditorIban: IBANSchema,
  creditorBic: z.string().max(11).optional(),
  creditorAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().length(2).optional()
  }).optional(),

  amount: z.number().positive(),
  currency: z.string().length(3).default('PLN'),

  // Split payment (optional)
  isSplitPayment: z.boolean().default(false),
  vatAmount: z.number().optional(),
  invoiceNumber: z.string().optional(),
  counterpartyNip: NIPSchema.optional(),

  remittanceInfo: z.string().max(140).optional(),
  structuredReference: z.string().max(35).optional(),

  // Scheduling (optional)
  requestedExecutionDate: z.string().date().optional(),

  // Related invoice
  invoiceId: z.string().uuid().optional()
}).refine(
  (data) => {
    if (data.isSplitPayment) {
      return data.vatAmount !== undefined && data.counterpartyNip !== undefined;
    }
    return true;
  },
  { message: 'Split payment wymaga podania kwoty VAT i NIP kontrahenta' }
);

// Batch payment request
export const CreateBatchPaymentRequestSchema = z.object({
  connectionId: z.string().uuid(),
  name: z.string().optional(),
  description: z.string().optional(),
  payments: z.array(CreatePaymentRequestSchema.omit({ connectionId: true })).min(1).max(500)
});

// Authorize payment request
export const AuthorizePaymentRequestSchema = z.object({
  paymentId: z.string().uuid(),
  scaMethod: z.enum(['SMS', 'APP', 'CARD_READER', 'BIOMETRIC']).optional()
});

// Confirm authorization request
export const ConfirmAuthorizationRequestSchema = z.object({
  paymentId: z.string().uuid(),
  authorizationCode: z.string().optional(),
  authorizationId: z.string()
});

// Cancel payment request
export const CancelPaymentRequestSchema = z.object({
  paymentId: z.string().uuid(),
  reason: z.string().optional()
});

// White List verification response
export const WhiteListVerificationSchema = z.object({
  nip: z.string(),
  accountNumber: z.string(),
  isVerified: z.boolean(),
  verificationDate: z.string().date(),
  apiRequestId: z.string().optional(),
  companyName: z.string().optional()
});

// Payment batch schema
export const PaymentBatchSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  connectionId: z.string().uuid(),

  name: z.string().nullable(),
  description: z.string().nullable(),

  status: z.enum(['DRAFT', 'PENDING_AUTHORIZATION', 'AUTHORIZED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  totalPayments: z.number(),
  successfulPayments: z.number(),
  failedPayments: z.number(),

  totalAmount: z.number(),
  processedAmount: z.number(),

  authorizationId: z.string().nullable(),
  authorizedAt: z.string().datetime().nullable(),

  createdAt: z.string().datetime(),
  createdBy: z.string().uuid(),
  executedAt: z.string().datetime().nullable()
});

// Type exports
export type Payment = z.infer<typeof PaymentSchema>;
export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;
export type CreateBatchPaymentRequest = z.infer<typeof CreateBatchPaymentRequestSchema>;
export type PaymentBatch = z.infer<typeof PaymentBatchSchema>;
export type WhiteListVerification = z.infer<typeof WhiteListVerificationSchema>;
```

### tRPC Router

```typescript
// src/modules/bnk/routers/payment.router.ts
import { router, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  CreatePaymentRequestSchema,
  CreateBatchPaymentRequestSchema,
  AuthorizePaymentRequestSchema,
  ConfirmAuthorizationRequestSchema,
  CancelPaymentRequestSchema,
  PaymentSchema,
  PaymentBatchSchema,
  WhiteListVerificationSchema
} from '../schemas/payment.schema';
import { PaymentService } from '../services/payment.service';
import { WhiteListService } from '../services/white-list.service';

export const paymentRouter = router({
  // Create single payment
  createPayment: protectedProcedure
    .input(CreatePaymentRequestSchema)
    .output(PaymentSchema)
    .mutation(async ({ ctx, input }) => {
      const paymentService = new PaymentService(ctx.db);

      // Verify connection and account
      const account = await ctx.db.bankAccount.findFirst({
        where: {
          id: input.accountId,
          connectionId: input.connectionId,
          clientId: ctx.session.clientId
        },
        include: {
          connection: true
        }
      });

      if (!account || account.connection.status !== 'ACTIVE') {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono aktywnego konta bankowego'
        });
      }

      // Check balance
      const balance = await paymentService.getAccountBalance(account.id);
      if (balance.available < input.amount) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Niewystarczające środki. Dostępne: ${balance.available} ${input.currency}`
        });
      }

      // White List verification for payments > 15,000 PLN
      let whiteListResult = null;
      if (input.amount > 15000 && input.currency === 'PLN' && input.counterpartyNip) {
        const whiteListService = new WhiteListService();
        whiteListResult = await whiteListService.verify(
          input.counterpartyNip,
          input.creditorIban
        );

        if (!whiteListResult.isVerified) {
          // Log warning but don't block (unless strict policy)
          await ctx.audit.log({
            action: 'WHITE_LIST_WARNING',
            resourceType: 'PAYMENT',
            details: {
              nip: input.counterpartyNip,
              iban: input.creditorIban,
              amount: input.amount
            }
          });
        }
      }

      // Auto-enable split payment for B2B > 15,000 PLN
      const shouldSplitPayment =
        input.amount > 15000 &&
        input.currency === 'PLN' &&
        input.counterpartyNip &&
        !input.isSplitPayment;

      const payment = await paymentService.createPayment({
        clientId: ctx.session.clientId,
        connectionId: input.connectionId,
        accountId: input.accountId,
        createdBy: ctx.session.userId,
        ...input,
        isSplitPayment: input.isSplitPayment || shouldSplitPayment,
        whiteListVerified: whiteListResult?.isVerified ?? null,
        whiteListCheckDate: whiteListResult ? new Date() : null,
        whiteListResult
      });

      await ctx.audit.log({
        action: 'PAYMENT_INITIATED',
        resourceType: 'PAYMENT',
        resourceId: payment.id,
        details: {
          amount: input.amount,
          currency: input.currency,
          paymentType: input.paymentType,
          creditorIban: input.creditorIban
        }
      });

      return payment;
    }),

  // Create batch payment
  createBatch: protectedProcedure
    .input(CreateBatchPaymentRequestSchema)
    .output(PaymentBatchSchema)
    .mutation(async ({ ctx, input }) => {
      const paymentService = new PaymentService(ctx.db);

      // Verify connection
      const connection = await ctx.db.bankConnection.findFirst({
        where: {
          id: input.connectionId,
          clientId: ctx.session.clientId,
          status: 'ACTIVE'
        }
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono aktywnego połączenia bankowego'
        });
      }

      const batch = await paymentService.createBatch({
        clientId: ctx.session.clientId,
        connectionId: input.connectionId,
        name: input.name,
        description: input.description,
        payments: input.payments,
        createdBy: ctx.session.userId
      });

      await ctx.audit.log({
        action: 'PAYMENT_BATCH_CREATED',
        resourceType: 'PAYMENT_BATCH',
        resourceId: batch.id,
        details: {
          totalPayments: input.payments.length,
          totalAmount: batch.totalAmount
        }
      });

      return batch;
    }),

  // Request SCA authorization
  authorize: protectedProcedure
    .input(AuthorizePaymentRequestSchema)
    .output(z.object({
      authorizationId: z.string(),
      scaMethod: z.string(),
      authorizationUrl: z.string().optional(),
      expiresAt: z.string().datetime()
    }))
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.db.payment.findFirst({
        where: {
          id: input.paymentId,
          clientId: ctx.session.clientId
        },
        include: {
          connection: true
        }
      });

      if (!payment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono płatności'
        });
      }

      if (payment.status !== 'DRAFT' && payment.status !== 'PENDING_AUTHORIZATION') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Płatność nie może być autoryzowana w statusie: ${payment.status}`
        });
      }

      const paymentService = new PaymentService(ctx.db);
      const authResult = await paymentService.initiateAuthorization(
        payment,
        input.scaMethod
      );

      await ctx.db.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PENDING_AUTHORIZATION',
          scaStatus: 'PENDING',
          scaMethod: authResult.scaMethod,
          authorizationId: authResult.authorizationId
        }
      });

      await ctx.audit.log({
        action: 'PAYMENT_AUTHORIZATION_REQUESTED',
        resourceType: 'PAYMENT',
        resourceId: payment.id,
        details: { scaMethod: authResult.scaMethod }
      });

      return authResult;
    }),

  // Confirm authorization
  confirmAuthorization: protectedProcedure
    .input(ConfirmAuthorizationRequestSchema)
    .output(PaymentSchema)
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.db.payment.findFirst({
        where: {
          id: input.paymentId,
          clientId: ctx.session.clientId,
          status: 'PENDING_AUTHORIZATION'
        }
      });

      if (!payment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono płatności oczekującej na autoryzację'
        });
      }

      const paymentService = new PaymentService(ctx.db);
      const confirmed = await paymentService.confirmAuthorization(
        payment,
        input.authorizationId,
        input.authorizationCode
      );

      if (confirmed) {
        const updated = await ctx.db.payment.update({
          where: { id: payment.id },
          data: {
            status: payment.requestedExecutionDate ? 'SCHEDULED' : 'AUTHORIZED',
            scaStatus: 'COMPLETED'
          }
        });

        // If not scheduled, submit for execution
        if (!payment.requestedExecutionDate) {
          paymentService.executePayment(payment.id).catch(console.error);
        }

        await ctx.audit.log({
          action: 'PAYMENT_AUTHORIZED',
          resourceType: 'PAYMENT',
          resourceId: payment.id
        });

        return updated;
      }

      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Autoryzacja nie powiodła się'
      });
    }),

  // Cancel payment
  cancel: protectedProcedure
    .input(CancelPaymentRequestSchema)
    .output(PaymentSchema)
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.db.payment.findFirst({
        where: {
          id: input.paymentId,
          clientId: ctx.session.clientId
        }
      });

      if (!payment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono płatności'
        });
      }

      const cancellableStatuses = ['DRAFT', 'PENDING_AUTHORIZATION', 'SCHEDULED'];
      if (!cancellableStatuses.includes(payment.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Płatność w statusie ${payment.status} nie może być anulowana`
        });
      }

      const updated = await ctx.db.payment.update({
        where: { id: payment.id },
        data: {
          status: 'CANCELLED',
          errorMessage: input.reason
        }
      });

      await ctx.audit.log({
        action: 'PAYMENT_CANCELLED',
        resourceType: 'PAYMENT',
        resourceId: payment.id,
        details: { reason: input.reason }
      });

      return updated;
    }),

  // Get payment
  getPayment: protectedProcedure
    .input(z.object({ paymentId: z.string().uuid() }))
    .output(PaymentSchema.extend({
      account: z.object({
        id: z.string(),
        name: z.string(),
        iban: z.string()
      }),
      auditTrail: z.array(z.object({
        action: z.string(),
        oldStatus: z.string().nullable(),
        newStatus: z.string().nullable(),
        createdAt: z.string()
      }))
    }))
    .query(async ({ ctx, input }) => {
      const payment = await ctx.db.payment.findFirst({
        where: {
          id: input.paymentId,
          clientId: ctx.session.clientId
        },
        include: {
          account: {
            select: { id: true, name: true, iban: true }
          }
        }
      });

      if (!payment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono płatności'
        });
      }

      const auditTrail = await ctx.db.paymentAudit.findMany({
        where: { paymentId: payment.id },
        select: {
          action: true,
          oldStatus: true,
          newStatus: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return { ...payment, auditTrail };
    }),

  // List payments
  getPayments: protectedProcedure
    .input(z.object({
      connectionId: z.string().uuid().optional(),
      accountId: z.string().uuid().optional(),
      status: z.array(PaymentSchema.shape.status).optional(),
      dateFrom: z.string().date().optional(),
      dateTo: z.string().date().optional(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(10).max(100).default(20)
    }))
    .output(z.object({
      payments: z.array(PaymentSchema),
      total: z.number(),
      page: z.number(),
      pageSize: z.number()
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {
        clientId: ctx.session.clientId
      };

      if (input.connectionId) where.connectionId = input.connectionId;
      if (input.accountId) where.accountId = input.accountId;
      if (input.status?.length) where.status = { in: input.status };
      if (input.dateFrom || input.dateTo) {
        where.createdAt = {};
        if (input.dateFrom) where.createdAt.gte = new Date(input.dateFrom);
        if (input.dateTo) where.createdAt.lte = new Date(input.dateTo);
      }

      const [payments, total] = await Promise.all([
        ctx.db.payment.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { createdAt: 'desc' }
        }),
        ctx.db.payment.count({ where })
      ]);

      return {
        payments,
        total,
        page: input.page,
        pageSize: input.pageSize
      };
    }),

  // Verify White List
  verifyWhiteList: protectedProcedure
    .input(z.object({
      nip: z.string().regex(/^[0-9]{10}$/),
      accountNumber: z.string()
    }))
    .output(WhiteListVerificationSchema)
    .mutation(async ({ ctx, input }) => {
      const whiteListService = new WhiteListService();
      const result = await whiteListService.verify(input.nip, input.accountNumber);

      await ctx.audit.log({
        action: 'WHITE_LIST_VERIFICATION',
        resourceType: 'WHITE_LIST',
        details: {
          nip: input.nip,
          isVerified: result.isVerified
        }
      });

      return result;
    }),

  // Get scheduled payments
  getScheduledPayments: protectedProcedure
    .output(z.array(PaymentSchema))
    .query(async ({ ctx }) => {
      return ctx.db.payment.findMany({
        where: {
          clientId: ctx.session.clientId,
          status: 'SCHEDULED'
        },
        orderBy: { requestedExecutionDate: 'asc' }
      });
    })
});
```

### White List Service

```typescript
// src/modules/bnk/services/white-list.service.ts
import axios from 'axios';

interface WhiteListVerificationResult {
  nip: string;
  accountNumber: string;
  isVerified: boolean;
  verificationDate: string;
  apiRequestId?: string;
  companyName?: string;
}

export class WhiteListService {
  private apiUrl = 'https://wl-api.mf.gov.pl/api';

  async verify(nip: string, accountNumber: string): Promise<WhiteListVerificationResult> {
    const normalizedAccount = this.normalizeAccountNumber(accountNumber);
    const today = new Date().toISOString().split('T')[0];

    try {
      // Check cache first
      const cached = await this.checkCache(nip, normalizedAccount, today);
      if (cached) return cached;

      // Call Ministry of Finance API
      const response = await axios.get(
        `${this.apiUrl}/check/nip/${nip}/bank-account/${normalizedAccount}`,
        {
          params: { date: today },
          timeout: 10000
        }
      );

      const result: WhiteListVerificationResult = {
        nip,
        accountNumber: normalizedAccount,
        isVerified: response.data.result.accountAssigned === 'TAK',
        verificationDate: today,
        apiRequestId: response.data.result.requestId,
        companyName: response.data.result.subject?.name
      };

      // Cache the result
      await this.cacheResult(result);

      return result;
    } catch (error) {
      console.error('White List verification failed:', error);

      // Return unverified on error
      return {
        nip,
        accountNumber: normalizedAccount,
        isVerified: false,
        verificationDate: today
      };
    }
  }

  private normalizeAccountNumber(account: string): string {
    // Remove spaces, dashes, and country code prefix
    return account
      .replace(/[\s-]/g, '')
      .replace(/^PL/i, '');
  }

  private async checkCache(
    nip: string,
    accountNumber: string,
    date: string
  ): Promise<WhiteListVerificationResult | null> {
    // Implementation would check white_list_cache table
    return null;
  }

  private async cacheResult(result: WhiteListVerificationResult): Promise<void> {
    // Implementation would insert into white_list_cache table
  }
}
```

---

## Test Specifications

### Unit Tests

```typescript
// src/modules/bnk/__tests__/payment.test.ts
import { describe, it, expect } from 'vitest';
import { CreatePaymentRequestSchema } from '../schemas/payment.schema';

describe('Payment Schema Validation', () => {
  it('should validate correct payment request', () => {
    const validPayment = {
      connectionId: '123e4567-e89b-12d3-a456-426614174000',
      accountId: '123e4567-e89b-12d3-a456-426614174001',
      paymentType: 'DOMESTIC',
      creditorName: 'Jan Kowalski',
      creditorIban: 'PL61109010140000071219812874',
      amount: 1500.00,
      currency: 'PLN'
    };

    const result = CreatePaymentRequestSchema.safeParse(validPayment);
    expect(result.success).toBe(true);
  });

  it('should reject invalid IBAN', () => {
    const invalidPayment = {
      connectionId: '123e4567-e89b-12d3-a456-426614174000',
      accountId: '123e4567-e89b-12d3-a456-426614174001',
      paymentType: 'DOMESTIC',
      creditorName: 'Jan Kowalski',
      creditorIban: 'INVALID123',
      amount: 1500.00
    };

    const result = CreatePaymentRequestSchema.safeParse(invalidPayment);
    expect(result.success).toBe(false);
  });

  it('should require VAT amount and NIP for split payment', () => {
    const splitPayment = {
      connectionId: '123e4567-e89b-12d3-a456-426614174000',
      accountId: '123e4567-e89b-12d3-a456-426614174001',
      paymentType: 'SPLIT_PAYMENT',
      creditorName: 'ABC Sp. z o.o.',
      creditorIban: 'PL61109010140000071219812874',
      amount: 12300.00,
      currency: 'PLN',
      isSplitPayment: true
      // Missing vatAmount and counterpartyNip
    };

    const result = CreatePaymentRequestSchema.safeParse(splitPayment);
    expect(result.success).toBe(false);
  });
});
```

### Integration Tests

```typescript
// src/modules/bnk/__tests__/payment.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestContext } from '@/test/utils';
import { paymentRouter } from '../routers/payment.router';

describe('Payment Integration', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  describe('createPayment', () => {
    it('should create domestic payment', async () => {
      // Setup test data
      const connection = await ctx.db.bankConnection.create({
        data: {
          clientId: ctx.session.clientId,
          provider: 'MBANK',
          status: 'ACTIVE',
          bankName: 'mBank'
        }
      });

      const account = await ctx.db.bankAccount.create({
        data: {
          clientId: ctx.session.clientId,
          connectionId: connection.id,
          externalId: 'ACC001',
          iban: 'PL61109010140000071219812874',
          name: 'Konto główne',
          currency: 'PLN',
          accountType: 'CHECKING',
          balanceAvailable: 50000,
          balanceBooked: 50000
        }
      });

      const result = await paymentRouter.createCaller(ctx).createPayment({
        connectionId: connection.id,
        accountId: account.id,
        paymentType: 'DOMESTIC',
        creditorName: 'Test Creditor',
        creditorIban: 'PL27114020040000300201355387',
        amount: 1500.00,
        currency: 'PLN',
        remittanceInfo: 'Test payment'
      });

      expect(result.status).toBe('DRAFT');
      expect(result.paymentType).toBe('DOMESTIC');
      expect(result.amount).toBe(1500);
    });

    it('should reject payment with insufficient balance', async () => {
      const connection = await ctx.db.bankConnection.create({
        data: {
          clientId: ctx.session.clientId,
          provider: 'MBANK',
          status: 'ACTIVE',
          bankName: 'mBank'
        }
      });

      const account = await ctx.db.bankAccount.create({
        data: {
          clientId: ctx.session.clientId,
          connectionId: connection.id,
          externalId: 'ACC002',
          iban: 'PL61109010140000071219812874',
          name: 'Konto główne',
          currency: 'PLN',
          accountType: 'CHECKING',
          balanceAvailable: 100,
          balanceBooked: 100
        }
      });

      await expect(
        paymentRouter.createCaller(ctx).createPayment({
          connectionId: connection.id,
          accountId: account.id,
          paymentType: 'DOMESTIC',
          creditorName: 'Test Creditor',
          creditorIban: 'PL27114020040000300201355387',
          amount: 1500.00,
          currency: 'PLN'
        })
      ).rejects.toThrow('Niewystarczające środki');
    });
  });
});
```

---

## Security Checklist

- [ ] SCA required for all payment initiations
- [ ] IBAN validation before submission
- [ ] NIP validation for split payments
- [ ] White List verification for B2B > 15,000 PLN
- [ ] Rate limiting on payment endpoints
- [ ] Amount limits enforced
- [ ] Complete audit trail for all payment operations
- [ ] Sensitive data encrypted (account numbers masked in logs)
- [ ] Authorization codes expire after 5 minutes
- [ ] Duplicate payment detection

---

## Audit Events

| Event | Trigger | Data |
|-------|---------|------|
| `PAYMENT_INITIATED` | Payment created | paymentId, amount, type |
| `PAYMENT_AUTHORIZATION_REQUESTED` | SCA initiated | paymentId, scaMethod |
| `PAYMENT_AUTHORIZED` | SCA completed | paymentId |
| `PAYMENT_EXECUTED` | Bank confirms | paymentId, bankPaymentId |
| `PAYMENT_CANCELLED` | User cancels | paymentId, reason |
| `PAYMENT_FAILED` | Execution failed | paymentId, errorCode |
| `PAYMENT_BATCH_CREATED` | Batch created | batchId, totalPayments |
| `WHITE_LIST_VERIFICATION` | API called | nip, isVerified |
| `WHITE_LIST_WARNING` | Account not verified | nip, iban, amount |

---

## Dependencies

- **BNK-002**: Account Aggregation (requires account balance)
- **BNK-001**: Bank Connection (requires active connection)
- **TAX**: White List integration for VAT compliance

---

## Polish Language Support

All user-facing messages in Polish:
- "Nie znaleziono aktywnego konta bankowego"
- "Niewystarczające środki. Dostępne: X PLN"
- "Split payment wymaga podania kwoty VAT i NIP kontrahenta"
- "Nieprawidłowy format IBAN"
- "NIP musi składać się z 10 cyfr"
- "Płatność nie może być autoryzowana w statusie: X"
- "Płatność w statusie X nie może być anulowana"
- "Autoryzacja nie powiodła się"

---

*Last updated: December 2024*
