# BNK-006: Payment Status & Management

> **Story ID**: BNK-006
> **Epic**: Banking Integration Layer (BNK)
> **Priority**: P0 (Critical)
> **Story Points**: 5
> **Phase**: Week 23
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant,
**I want to** track payment status and manage pending payments,
**So that** I can ensure timely processing and handle failures appropriately.

---

## Acceptance Criteria

### AC1: Real-Time Status Tracking
```gherkin
Feature: Real-Time Payment Status Tracking
  Scenario: Track payment through lifecycle
    Given payment is initiated
    When payment progresses through stages
    Then status updates in real-time
      | stage | status |
      | Created | DRAFT |
      | Awaiting SCA | PENDING_AUTHORIZATION |
      | Authorized | AUTHORIZED |
      | Sent to bank | PROCESSING |
      | Completed | COMPLETED |
    And webhook notifications sent for each change

  Scenario: Poll bank for status updates
    Given payment status is "PROCESSING"
    When status polling runs
    Then bank API is queried for latest status
    And local status is synchronized
    And last_checked timestamp is updated
```

### AC2: Payment Cancellation
```gherkin
Feature: Payment Cancellation
  Scenario: Cancel draft payment
    Given payment with status "DRAFT"
    When user requests cancellation
    Then status changes to "CANCELLED"
    And cancellation reason is recorded
    And audit event is logged

  Scenario: Cancel scheduled payment
    Given scheduled payment for future date
    When user cancels before execution date
    Then payment is cancelled
    And scheduled job is removed

  Scenario: Attempt to cancel processing payment
    Given payment with status "PROCESSING"
    When user requests cancellation
    Then error is returned "Płatność w trakcie realizacji nie może być anulowana"
    And status remains unchanged
```

### AC3: Failed Payment Handling
```gherkin
Feature: Failed Payment Handling
  Scenario: Handle bank rejection
    Given payment submitted to bank
    When bank returns rejection
      | error_code | "INSUFFICIENT_FUNDS" |
    Then status changes to "REJECTED"
    And error code and message are stored
    And notification sent to user
    And retry option is available

  Scenario: Handle technical failure
    Given payment processing times out
    When timeout is detected
    Then status changes to "FAILED"
    And automatic retry is scheduled
    And retry count is incremented
```

### AC4: Payment History
```gherkin
Feature: Payment History
  Scenario: View payment history
    Given user requests payment history
    When filtered by date range and status
    Then payments matching criteria are returned
    And sorted by date descending
    And includes amount totals

  Scenario: Export payment history
    Given payment history query
    When export is requested
    Then CSV or PDF file is generated
    And contains all payment details
    And includes audit information
```

### AC5: Receipt Generation
```gherkin
Feature: Payment Receipt Generation
  Scenario: Generate receipt for completed payment
    Given payment with status "COMPLETED"
    When receipt is requested
    Then PDF receipt is generated
    And includes payment details
      | field | value |
      | recipient | creditor name |
      | amount | payment amount |
      | date | execution date |
      | reference | payment reference |
    And receipt can be downloaded

  Scenario: Generate batch receipt
    Given completed payment batch
    When batch receipt requested
    Then single PDF with all payments is generated
```

### AC6: Status Notifications
```gherkin
Feature: Payment Status Notifications
  Scenario: Email notification on completion
    Given user has email notifications enabled
    When payment completes successfully
    Then confirmation email is sent
    And includes payment summary
    And includes link to view details

  Scenario: In-app notification on failure
    Given payment fails
    When failure is detected
    Then in-app notification is created
    And notification shows error details
    And links to retry action
```

### AC7: Retry Logic
```gherkin
Feature: Payment Retry Logic
  Scenario: Manual retry of failed payment
    Given payment with status "FAILED"
    When user clicks retry
    Then new payment attempt is created
    And linked to original payment
    And retry count is incremented

  Scenario: Automatic retry with backoff
    Given payment fails with retryable error
    When automatic retry triggers
    Then retry is attempted after delay
      | attempt | delay |
      | 1 | 5 minutes |
      | 2 | 15 minutes |
      | 3 | 1 hour |
    And max 3 automatic retries
```

---

## Technical Specification

### Database Schema Extensions

```sql
-- Payment status history table
CREATE TABLE payment_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),

    -- Status change
    from_status payment_status,
    to_status payment_status NOT NULL,

    -- Bank response
    bank_status VARCHAR(50),
    bank_status_code VARCHAR(50),
    bank_message TEXT,

    -- Metadata
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changed_by UUID REFERENCES users(id),
    trigger_type VARCHAR(50) NOT NULL, -- 'USER', 'WEBHOOK', 'POLLING', 'SYSTEM'

    -- Additional data
    details JSONB
);

-- Payment retries table
CREATE TABLE payment_retries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_payment_id UUID NOT NULL REFERENCES payments(id),
    retry_payment_id UUID REFERENCES payments(id),

    -- Retry details
    attempt_number INTEGER NOT NULL,
    retry_type VARCHAR(50) NOT NULL, -- 'MANUAL', 'AUTOMATIC'
    scheduled_at TIMESTAMP WITH TIME ZONE,
    executed_at TIMESTAMP WITH TIME ZONE,

    -- Result
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    error_message TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment notifications table
CREATE TABLE payment_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    user_id UUID NOT NULL REFERENCES users(id),

    -- Notification details
    notification_type VARCHAR(50) NOT NULL, -- 'EMAIL', 'IN_APP', 'SMS', 'WEBHOOK'
    template VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',

    -- Content
    subject VARCHAR(255),
    content TEXT,

    -- Delivery
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment receipts table
CREATE TABLE payment_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    batch_id UUID REFERENCES payment_batches(id),

    -- Receipt details
    receipt_number VARCHAR(50) NOT NULL UNIQUE,
    receipt_type VARCHAR(50) NOT NULL, -- 'SINGLE', 'BATCH'

    -- File storage
    file_path VARCHAR(500),
    file_size INTEGER,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Download tracking
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_status_history_payment ON payment_status_history(payment_id);
CREATE INDEX idx_status_history_date ON payment_status_history(changed_at DESC);
CREATE INDEX idx_retries_original ON payment_retries(original_payment_id);
CREATE INDEX idx_notifications_payment ON payment_notifications(payment_id);
CREATE INDEX idx_notifications_user ON payment_notifications(user_id, status);
CREATE INDEX idx_receipts_payment ON payment_receipts(payment_id);

-- RLS
ALTER TABLE payment_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_retries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;
```

### Zod Schemas

```typescript
// src/modules/bnk/schemas/payment-status.schema.ts
import { z } from 'zod';
import { PaymentStatusEnum } from './payment.schema';

// Status history entry
export const PaymentStatusHistorySchema = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid(),
  fromStatus: PaymentStatusEnum.nullable(),
  toStatus: PaymentStatusEnum,
  bankStatus: z.string().nullable(),
  bankStatusCode: z.string().nullable(),
  bankMessage: z.string().nullable(),
  changedAt: z.string().datetime(),
  changedBy: z.string().uuid().nullable(),
  triggerType: z.enum(['USER', 'WEBHOOK', 'POLLING', 'SYSTEM']),
  details: z.record(z.unknown()).nullable()
});

// Retry record
export const PaymentRetrySchema = z.object({
  id: z.string().uuid(),
  originalPaymentId: z.string().uuid(),
  retryPaymentId: z.string().uuid().nullable(),
  attemptNumber: z.number(),
  retryType: z.enum(['MANUAL', 'AUTOMATIC']),
  scheduledAt: z.string().datetime().nullable(),
  executedAt: z.string().datetime().nullable(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED']),
  errorMessage: z.string().nullable()
});

// Notification record
export const PaymentNotificationSchema = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid(),
  userId: z.string().uuid(),
  notificationType: z.enum(['EMAIL', 'IN_APP', 'SMS', 'WEBHOOK']),
  template: z.string(),
  status: z.enum(['PENDING', 'SENT', 'DELIVERED', 'FAILED']),
  subject: z.string().nullable(),
  content: z.string().nullable(),
  sentAt: z.string().datetime().nullable(),
  deliveredAt: z.string().datetime().nullable(),
  errorMessage: z.string().nullable()
});

// Receipt
export const PaymentReceiptSchema = z.object({
  id: z.string().uuid(),
  paymentId: z.string().uuid(),
  batchId: z.string().uuid().nullable(),
  receiptNumber: z.string(),
  receiptType: z.enum(['SINGLE', 'BATCH']),
  filePath: z.string().nullable(),
  fileSize: z.number().nullable(),
  generatedAt: z.string().datetime(),
  downloadCount: z.number(),
  lastDownloadedAt: z.string().datetime().nullable()
});

// Retry request
export const RetryPaymentRequestSchema = z.object({
  paymentId: z.string().uuid(),
  reason: z.string().optional()
});

// Status update (from webhook)
export const StatusUpdateWebhookSchema = z.object({
  paymentId: z.string(),
  bankPaymentId: z.string(),
  status: z.string(),
  statusCode: z.string().optional(),
  message: z.string().optional(),
  executedAt: z.string().datetime().optional(),
  signature: z.string()
});

// Export request
export const ExportPaymentsRequestSchema = z.object({
  format: z.enum(['CSV', 'PDF', 'XLSX']),
  dateFrom: z.string().date(),
  dateTo: z.string().date(),
  status: z.array(PaymentStatusEnum).optional(),
  accountId: z.string().uuid().optional()
});

// Type exports
export type PaymentStatusHistory = z.infer<typeof PaymentStatusHistorySchema>;
export type PaymentRetry = z.infer<typeof PaymentRetrySchema>;
export type PaymentNotification = z.infer<typeof PaymentNotificationSchema>;
export type PaymentReceipt = z.infer<typeof PaymentReceiptSchema>;
export type RetryPaymentRequest = z.infer<typeof RetryPaymentRequestSchema>;
export type ExportPaymentsRequest = z.infer<typeof ExportPaymentsRequestSchema>;
```

### tRPC Router Extension

```typescript
// src/modules/bnk/routers/payment-status.router.ts
import { router, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  PaymentStatusHistorySchema,
  PaymentRetrySchema,
  PaymentReceiptSchema,
  RetryPaymentRequestSchema,
  ExportPaymentsRequestSchema
} from '../schemas/payment-status.schema';
import { PaymentStatusService } from '../services/payment-status.service';
import { ReceiptGeneratorService } from '../services/receipt-generator.service';

export const paymentStatusRouter = router({
  // Get status history
  getStatusHistory: protectedProcedure
    .input(z.object({ paymentId: z.string().uuid() }))
    .output(z.array(PaymentStatusHistorySchema))
    .query(async ({ ctx, input }) => {
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

      return ctx.db.paymentStatusHistory.findMany({
        where: { paymentId: input.paymentId },
        orderBy: { changedAt: 'desc' }
      });
    }),

  // Retry failed payment
  retryPayment: protectedProcedure
    .input(RetryPaymentRequestSchema)
    .output(z.object({
      retryId: z.string().uuid(),
      newPaymentId: z.string().uuid()
    }))
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

      const retryableStatuses = ['FAILED', 'REJECTED'];
      if (!retryableStatuses.includes(payment.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Płatność w statusie ${payment.status} nie może być ponowiona`
        });
      }

      // Check retry count
      const existingRetries = await ctx.db.paymentRetry.count({
        where: { originalPaymentId: input.paymentId }
      });

      if (existingRetries >= 5) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Osiągnięto maksymalną liczbę prób (5)'
        });
      }

      const statusService = new PaymentStatusService(ctx.db);
      const result = await statusService.retryPayment(
        payment,
        ctx.session.userId,
        'MANUAL',
        input.reason
      );

      await ctx.audit.log({
        action: 'PAYMENT_RETRY_INITIATED',
        resourceType: 'PAYMENT',
        resourceId: input.paymentId,
        details: {
          attemptNumber: existingRetries + 1,
          newPaymentId: result.newPaymentId
        }
      });

      return result;
    }),

  // Get retry history
  getRetryHistory: protectedProcedure
    .input(z.object({ paymentId: z.string().uuid() }))
    .output(z.array(PaymentRetrySchema))
    .query(async ({ ctx, input }) => {
      return ctx.db.paymentRetry.findMany({
        where: { originalPaymentId: input.paymentId },
        orderBy: { attemptNumber: 'asc' }
      });
    }),

  // Generate receipt
  generateReceipt: protectedProcedure
    .input(z.object({
      paymentId: z.string().uuid().optional(),
      batchId: z.string().uuid().optional()
    }).refine(
      data => data.paymentId || data.batchId,
      { message: 'Wymagany paymentId lub batchId' }
    ))
    .output(PaymentReceiptSchema)
    .mutation(async ({ ctx, input }) => {
      const receiptService = new ReceiptGeneratorService(ctx.db);

      if (input.paymentId) {
        const payment = await ctx.db.payment.findFirst({
          where: {
            id: input.paymentId,
            clientId: ctx.session.clientId,
            status: 'COMPLETED'
          }
        });

        if (!payment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Nie znaleziono zakończonej płatności'
          });
        }

        return receiptService.generateSingleReceipt(payment);
      }

      if (input.batchId) {
        const batch = await ctx.db.paymentBatch.findFirst({
          where: {
            id: input.batchId,
            clientId: ctx.session.clientId,
            status: 'COMPLETED'
          }
        });

        if (!batch) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Nie znaleziono zakończonej partii płatności'
          });
        }

        return receiptService.generateBatchReceipt(batch);
      }

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Wymagany paymentId lub batchId'
      });
    }),

  // Download receipt
  downloadReceipt: protectedProcedure
    .input(z.object({ receiptId: z.string().uuid() }))
    .output(z.object({
      url: z.string(),
      filename: z.string(),
      expiresAt: z.string().datetime()
    }))
    .query(async ({ ctx, input }) => {
      const receipt = await ctx.db.paymentReceipt.findFirst({
        where: { id: input.receiptId },
        include: {
          payment: {
            select: { clientId: true }
          }
        }
      });

      if (!receipt || receipt.payment?.clientId !== ctx.session.clientId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono potwierdzenia'
        });
      }

      // Update download count
      await ctx.db.paymentReceipt.update({
        where: { id: input.receiptId },
        data: {
          downloadCount: { increment: 1 },
          lastDownloadedAt: new Date()
        }
      });

      const receiptService = new ReceiptGeneratorService(ctx.db);
      return receiptService.getDownloadUrl(receipt);
    }),

  // Export payments
  exportPayments: protectedProcedure
    .input(ExportPaymentsRequestSchema)
    .output(z.object({
      jobId: z.string().uuid(),
      status: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const statusService = new PaymentStatusService(ctx.db);

      const jobId = await statusService.createExportJob({
        clientId: ctx.session.clientId,
        userId: ctx.session.userId,
        ...input
      });

      // Start async export
      statusService.executeExport(jobId).catch(console.error);

      return { jobId, status: 'PROCESSING' };
    }),

  // Get export status
  getExportStatus: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .output(z.object({
      status: z.enum(['PROCESSING', 'COMPLETED', 'FAILED']),
      downloadUrl: z.string().nullable(),
      errorMessage: z.string().nullable()
    }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.db.exportJob.findFirst({
        where: {
          id: input.jobId,
          userId: ctx.session.userId
        }
      });

      if (!job) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono zadania eksportu'
        });
      }

      return {
        status: job.status,
        downloadUrl: job.downloadUrl,
        errorMessage: job.errorMessage
      };
    }),

  // Get notifications
  getNotifications: protectedProcedure
    .input(z.object({
      unreadOnly: z.boolean().default(true),
      limit: z.number().min(1).max(100).default(20)
    }))
    .output(z.array(z.object({
      id: z.string().uuid(),
      paymentId: z.string().uuid(),
      type: z.string(),
      subject: z.string().nullable(),
      createdAt: z.string().datetime(),
      isRead: z.boolean()
    })))
    .query(async ({ ctx, input }) => {
      const where: any = {
        userId: ctx.session.userId,
        notificationType: 'IN_APP'
      };

      if (input.unreadOnly) {
        where.status = { in: ['SENT', 'DELIVERED'] };
      }

      const notifications = await ctx.db.paymentNotification.findMany({
        where,
        take: input.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          payment: {
            select: {
              id: true,
              creditorName: true,
              amount: true,
              status: true
            }
          }
        }
      });

      return notifications.map(n => ({
        id: n.id,
        paymentId: n.paymentId,
        type: n.template,
        subject: n.subject,
        createdAt: n.createdAt.toISOString(),
        isRead: n.status === 'DELIVERED'
      }));
    }),

  // Mark notification as read
  markNotificationRead: protectedProcedure
    .input(z.object({ notificationId: z.string().uuid() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.paymentNotification.updateMany({
        where: {
          id: input.notificationId,
          userId: ctx.session.userId
        },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date()
        }
      });

      return { success: true };
    }),

  // Sync payment status from bank
  syncStatus: protectedProcedure
    .input(z.object({ paymentId: z.string().uuid() }))
    .output(z.object({
      previousStatus: z.string(),
      currentStatus: z.string(),
      bankStatus: z.string().nullable()
    }))
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.db.payment.findFirst({
        where: {
          id: input.paymentId,
          clientId: ctx.session.clientId
        },
        include: { connection: true }
      });

      if (!payment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono płatności'
        });
      }

      const statusService = new PaymentStatusService(ctx.db);
      const result = await statusService.syncFromBank(payment);

      return result;
    })
});
```

### Payment Status Service

```typescript
// src/modules/bnk/services/payment-status.service.ts
import { PrismaClient, Payment, PaymentStatus } from '@prisma/client';
import { BankProviderFactory } from './bank-provider.factory';

export class PaymentStatusService {
  constructor(private db: PrismaClient) {}

  async updateStatus(
    paymentId: string,
    newStatus: PaymentStatus,
    options: {
      bankStatus?: string;
      bankStatusCode?: string;
      bankMessage?: string;
      changedBy?: string;
      triggerType: 'USER' | 'WEBHOOK' | 'POLLING' | 'SYSTEM';
      details?: Record<string, unknown>;
    }
  ): Promise<void> {
    const payment = await this.db.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) return;

    // Record status history
    await this.db.paymentStatusHistory.create({
      data: {
        paymentId,
        fromStatus: payment.status,
        toStatus: newStatus,
        bankStatus: options.bankStatus,
        bankStatusCode: options.bankStatusCode,
        bankMessage: options.bankMessage,
        changedBy: options.changedBy,
        triggerType: options.triggerType,
        details: options.details
      }
    });

    // Update payment
    await this.db.payment.update({
      where: { id: paymentId },
      data: {
        status: newStatus,
        ...(newStatus === 'COMPLETED' && { executedAt: new Date() })
      }
    });

    // Send notification
    await this.sendStatusNotification(payment, newStatus);
  }

  async retryPayment(
    payment: Payment,
    userId: string,
    retryType: 'MANUAL' | 'AUTOMATIC',
    reason?: string
  ): Promise<{ retryId: string; newPaymentId: string }> {
    // Count existing retries
    const attemptNumber = await this.db.paymentRetry.count({
      where: { originalPaymentId: payment.id }
    }) + 1;

    // Create new payment (copy of original)
    const newPayment = await this.db.payment.create({
      data: {
        clientId: payment.clientId,
        connectionId: payment.connectionId,
        accountId: payment.accountId,
        paymentReference: `${payment.paymentReference}-R${attemptNumber}`,
        paymentType: payment.paymentType,
        status: 'DRAFT',
        creditorName: payment.creditorName,
        creditorIban: payment.creditorIban,
        creditorBic: payment.creditorBic,
        amount: payment.amount,
        currency: payment.currency,
        isSplitPayment: payment.isSplitPayment,
        vatAmount: payment.vatAmount,
        counterpartyNip: payment.counterpartyNip,
        invoiceNumber: payment.invoiceNumber,
        remittanceInfo: payment.remittanceInfo,
        scaRequired: true,
        createdBy: userId
      }
    });

    // Create retry record
    const retry = await this.db.paymentRetry.create({
      data: {
        originalPaymentId: payment.id,
        retryPaymentId: newPayment.id,
        attemptNumber,
        retryType,
        status: 'PENDING'
      }
    });

    return {
      retryId: retry.id,
      newPaymentId: newPayment.id
    };
  }

  async syncFromBank(payment: Payment & { connection: any }): Promise<{
    previousStatus: string;
    currentStatus: string;
    bankStatus: string | null;
  }> {
    const provider = BankProviderFactory.create(payment.connection.provider);
    const previousStatus = payment.status;

    try {
      const bankStatus = await provider.getPaymentStatus(
        payment.connection,
        payment.bankPaymentId || payment.paymentReference
      );

      const newStatus = this.mapBankStatus(bankStatus.status);

      if (newStatus !== previousStatus) {
        await this.updateStatus(payment.id, newStatus, {
          bankStatus: bankStatus.status,
          bankStatusCode: bankStatus.statusCode,
          bankMessage: bankStatus.message,
          triggerType: 'POLLING'
        });
      }

      return {
        previousStatus,
        currentStatus: newStatus,
        bankStatus: bankStatus.status
      };
    } catch (error) {
      console.error('Failed to sync payment status:', error);
      return {
        previousStatus,
        currentStatus: previousStatus,
        bankStatus: null
      };
    }
  }

  private mapBankStatus(bankStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'ACCP': 'PROCESSING',
      'ACSC': 'COMPLETED',
      'ACSP': 'PROCESSING',
      'ACTC': 'AUTHORIZED',
      'ACWC': 'COMPLETED',
      'ACWP': 'COMPLETED',
      'RCVD': 'PROCESSING',
      'PDNG': 'PENDING_EXECUTION',
      'RJCT': 'REJECTED',
      'CANC': 'CANCELLED'
    };

    return statusMap[bankStatus] || 'PROCESSING';
  }

  private async sendStatusNotification(
    payment: Payment,
    newStatus: PaymentStatus
  ): Promise<void> {
    const notificationTemplates: Record<PaymentStatus, string | null> = {
      'COMPLETED': 'payment_completed',
      'FAILED': 'payment_failed',
      'REJECTED': 'payment_rejected',
      'CANCELLED': 'payment_cancelled',
      'DRAFT': null,
      'PENDING_AUTHORIZATION': null,
      'AUTHORIZED': null,
      'PENDING_EXECUTION': null,
      'SCHEDULED': null,
      'PROCESSING': null
    };

    const template = notificationTemplates[newStatus];
    if (!template) return;

    // Create in-app notification
    await this.db.paymentNotification.create({
      data: {
        paymentId: payment.id,
        userId: payment.createdBy,
        notificationType: 'IN_APP',
        template,
        status: 'SENT',
        subject: this.getNotificationSubject(newStatus, payment),
        sentAt: new Date()
      }
    });

    // TODO: Send email notification if user preferences allow
  }

  private getNotificationSubject(status: PaymentStatus, payment: Payment): string {
    const subjects: Record<PaymentStatus, string> = {
      'COMPLETED': `Płatność ${payment.amount} ${payment.currency} do ${payment.creditorName} została zrealizowana`,
      'FAILED': `Płatność ${payment.amount} ${payment.currency} do ${payment.creditorName} nie powiodła się`,
      'REJECTED': `Płatność ${payment.amount} ${payment.currency} do ${payment.creditorName} została odrzucona`,
      'CANCELLED': `Płatność ${payment.amount} ${payment.currency} do ${payment.creditorName} została anulowana`,
      'DRAFT': '',
      'PENDING_AUTHORIZATION': '',
      'AUTHORIZED': '',
      'PENDING_EXECUTION': '',
      'SCHEDULED': '',
      'PROCESSING': ''
    };

    return subjects[status];
  }

  async createExportJob(params: {
    clientId: string;
    userId: string;
    format: string;
    dateFrom: string;
    dateTo: string;
    status?: string[];
    accountId?: string;
  }): Promise<string> {
    const job = await this.db.exportJob.create({
      data: {
        userId: params.userId,
        type: 'PAYMENTS',
        format: params.format,
        parameters: params,
        status: 'PROCESSING'
      }
    });

    return job.id;
  }

  async executeExport(jobId: string): Promise<void> {
    // Implementation for generating export file
    // This would query payments, generate CSV/PDF/XLSX, and upload to storage
  }
}
```

---

## Test Specifications

### Unit Tests

```typescript
// src/modules/bnk/__tests__/payment-status.test.ts
import { describe, it, expect } from 'vitest';
import { PaymentStatusService } from '../services/payment-status.service';

describe('PaymentStatusService', () => {
  describe('mapBankStatus', () => {
    it('should map ACSC to COMPLETED', () => {
      const service = new PaymentStatusService({} as any);
      expect((service as any).mapBankStatus('ACSC')).toBe('COMPLETED');
    });

    it('should map RJCT to REJECTED', () => {
      const service = new PaymentStatusService({} as any);
      expect((service as any).mapBankStatus('RJCT')).toBe('REJECTED');
    });

    it('should default to PROCESSING for unknown status', () => {
      const service = new PaymentStatusService({} as any);
      expect((service as any).mapBankStatus('UNKNOWN')).toBe('PROCESSING');
    });
  });
});
```

---

## Security Checklist

- [ ] Status updates only from authorized sources
- [ ] Webhook signatures validated
- [ ] Retry limits enforced
- [ ] Receipt generation rate limited
- [ ] Export data filtered by client
- [ ] Notification delivery tracked

---

## Audit Events

| Event | Trigger | Data |
|-------|---------|------|
| `PAYMENT_STATUS_CHANGED` | Status update | paymentId, from, to |
| `PAYMENT_RETRY_INITIATED` | Retry started | paymentId, attempt |
| `PAYMENT_RECEIPT_GENERATED` | Receipt created | receiptId, paymentId |
| `PAYMENT_EXPORT_REQUESTED` | Export started | jobId, format |

---

## Dependencies

- **BNK-005**: Payment Initiation (requires payments to track)

---

*Last updated: December 2024*
