# BNK-003: Transaction Import & Normalization

> **Story ID**: BNK-003
> **Epic**: Banking Integration Layer (BNK)
> **Priority**: P0 (Critical)
> **Story Points**: 8
> **Phase**: Week 22
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant,
**I want to** import bank transactions automatically with normalized data,
**So that** I have up-to-date financial data without manual entry and consistent format across all banks.

---

## Acceptance Criteria

### AC1: Automatic Transaction Fetching
```gherkin
Feature: Automatic Transaction Fetching
  Scenario: Fetch new transactions from connected bank
    Given a bank connection with status "ACTIVE"
    And last sync was "2024-01-14T10:00:00Z"
    When automatic transaction sync is triggered
    Then system fetches transactions since last sync
    And new transactions are stored in database
    And sync timestamp is updated
    And audit event "TRANSACTIONS_FETCHED" is logged

  Scenario: Handle pagination for large transaction sets
    Given bank API returns paginated results
    When fetching transactions exceeds page limit
    Then system follows pagination links
    And all transactions are retrieved
    And no duplicates are created
```

### AC2: Data Normalization Across Banks
```gherkin
Feature: Transaction Data Normalization
  Scenario: Normalize transaction from PKO Bank Polski
    Given a raw transaction from PKO with format
      | field | value |
      | tytul | "Przelew przychodzący" |
      | kwota | "1500,00" |
      | data_ksiegowania | "14.01.2024" |
    When transaction is normalized
    Then transaction has standardized format
      | field | value |
      | description | "Przelew przychodzący" |
      | amount | 1500.00 |
      | bookingDate | "2024-01-14" |
    And currency is set to "PLN"

  Scenario: Normalize transaction from mBank
    Given a raw transaction from mBank with ISO format
    When transaction is normalized
    Then transaction follows same schema as PKO transactions
    And provider-specific fields are preserved in metadata
```

### AC3: Deduplication Logic
```gherkin
Feature: Transaction Deduplication
  Scenario: Prevent duplicate imports
    Given existing transaction with reference "REF123456"
    When importing transaction with same reference
    Then duplicate is detected
    And import is skipped
    And deduplication event is logged

  Scenario: Handle transactions without unique reference
    Given transaction without bank reference
    When importing similar transaction
    Then hash is generated from amount, date, description
    And hash-based deduplication is applied
```

### AC4: Date Range Selection
```gherkin
Feature: Date Range Transaction Import
  Scenario: Import transactions for specific period
    Given user selects date range "2024-01-01" to "2024-01-31"
    When manual import is triggered
    Then only transactions within range are fetched
    And existing transactions in range are not duplicated
    And import summary shows count and amount totals

  Scenario: Validate date range limits
    Given user selects date range exceeding 90 days
    When import is requested
    Then error is returned with message "Maksymalny zakres to 90 dni"
    And import is not executed
```

### AC5: Incremental Imports
```gherkin
Feature: Incremental Transaction Import
  Scenario: Import only new transactions
    Given last successful import was 24 hours ago
    When incremental import runs
    Then only transactions after last import are fetched
    And import is significantly faster than full import
    And transaction count reflects only new items

  Scenario: Handle gap in import schedule
    Given last import was 7 days ago due to connection issue
    When incremental import runs
    Then all transactions since last import are fetched
    And warning is logged for extended gap
```

### AC6: Transaction Status Tracking
```gherkin
Feature: Transaction Status Tracking
  Scenario: Track pending transaction becoming booked
    Given pending transaction with status "PENDING"
    When transaction clears at bank
    And next sync occurs
    Then transaction status updates to "BOOKED"
    And status change event is emitted
    And booking date is set

  Scenario: Track reversed transaction
    Given booked transaction with reference "REF123"
    When bank reverses the transaction
    And next sync occurs
    Then original transaction marked as "REVERSED"
    And reversal transaction linked to original
```

### AC7: Import Scheduling
```gherkin
Feature: Import Scheduling
  Scenario: Configure automatic import schedule
    Given user configures import schedule
      | interval | "EVERY_4_HOURS" |
      | startTime | "06:00" |
      | endTime | "22:00" |
    When schedule is saved
    Then imports run every 4 hours within time window
    And no imports occur outside window
    And schedule is client-specific

  Scenario: Manual import override
    Given automatic import is scheduled
    When user triggers manual import
    Then immediate import is executed
    And automatic schedule continues unchanged
```

---

## Technical Specification

### Database Schema

```sql
-- Bank transactions table
CREATE TABLE bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    account_id UUID NOT NULL REFERENCES bank_accounts(id),
    connection_id UUID NOT NULL REFERENCES bank_connections(id),

    -- Transaction identification
    external_id VARCHAR(255) NOT NULL,
    bank_reference VARCHAR(255),
    end_to_end_id VARCHAR(255),

    -- Transaction details
    transaction_type transaction_type NOT NULL, -- 'CREDIT' | 'DEBIT'
    status transaction_status NOT NULL DEFAULT 'PENDING',

    -- Amounts
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'PLN',
    original_amount DECIMAL(15, 2),
    original_currency VARCHAR(3),
    exchange_rate DECIMAL(12, 6),

    -- Dates
    booking_date DATE NOT NULL,
    value_date DATE,
    transaction_date TIMESTAMP WITH TIME ZONE,

    -- Normalized fields
    description TEXT,
    counterparty_name VARCHAR(255),
    counterparty_account VARCHAR(34), -- IBAN format

    -- Categorization
    category_id UUID REFERENCES transaction_categories(id),
    category_confidence DECIMAL(5, 4),
    is_category_confirmed BOOLEAN DEFAULT FALSE,

    -- Reconciliation
    reconciliation_status reconciliation_status DEFAULT 'UNMATCHED',
    reconciled_entry_id UUID,

    -- Metadata
    raw_data JSONB NOT NULL,
    normalized_data JSONB,
    deduplication_hash VARCHAR(64) NOT NULL,

    -- Audit
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(account_id, deduplication_hash),
    CONSTRAINT valid_amount CHECK (amount != 0)
);

-- Transaction status enum
CREATE TYPE transaction_status AS ENUM (
    'PENDING',
    'BOOKED',
    'REVERSED',
    'REJECTED'
);

-- Import jobs table
CREATE TABLE transaction_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    connection_id UUID NOT NULL REFERENCES bank_connections(id),
    account_id UUID REFERENCES bank_accounts(id),

    -- Job configuration
    import_type VARCHAR(50) NOT NULL, -- 'INCREMENTAL' | 'FULL' | 'DATE_RANGE'
    date_from DATE,
    date_to DATE,

    -- Job status
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Results
    transactions_fetched INTEGER DEFAULT 0,
    transactions_imported INTEGER DEFAULT 0,
    transactions_skipped INTEGER DEFAULT 0,
    errors JSONB,

    -- Metadata
    triggered_by VARCHAR(50) NOT NULL, -- 'SCHEDULE' | 'MANUAL' | 'WEBHOOK'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Import schedules table
CREATE TABLE import_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id),
    connection_id UUID NOT NULL REFERENCES bank_connections(id),

    -- Schedule configuration
    is_enabled BOOLEAN DEFAULT TRUE,
    interval_type VARCHAR(50) NOT NULL,
    interval_value INTEGER NOT NULL,
    start_time TIME,
    end_time TIME,
    days_of_week INTEGER[], -- 0-6, Sunday to Saturday

    -- Execution tracking
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    consecutive_failures INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(client_id, connection_id)
);

-- Indexes
CREATE INDEX idx_transactions_account_date ON bank_transactions(account_id, booking_date DESC);
CREATE INDEX idx_transactions_client_status ON bank_transactions(client_id, reconciliation_status);
CREATE INDEX idx_transactions_external_id ON bank_transactions(external_id);
CREATE INDEX idx_transactions_dedup_hash ON bank_transactions(deduplication_hash);
CREATE INDEX idx_import_jobs_status ON transaction_import_jobs(status, created_at);

-- Row Level Security
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY transactions_client_isolation ON bank_transactions
    USING (client_id = current_setting('app.current_client_id')::UUID);
CREATE POLICY import_jobs_client_isolation ON transaction_import_jobs
    USING (client_id = current_setting('app.current_client_id')::UUID);
CREATE POLICY schedules_client_isolation ON import_schedules
    USING (client_id = current_setting('app.current_client_id')::UUID);
```

### Zod Schemas

```typescript
// src/modules/bnk/schemas/transaction.schema.ts
import { z } from 'zod';

// Enums
export const TransactionTypeEnum = z.enum(['CREDIT', 'DEBIT']);
export const TransactionStatusEnum = z.enum(['PENDING', 'BOOKED', 'REVERSED', 'REJECTED']);
export const ReconciliationStatusEnum = z.enum([
  'UNMATCHED',
  'MATCHED',
  'PARTIALLY_MATCHED',
  'MANUALLY_MATCHED',
  'EXCLUDED'
]);
export const ImportTypeEnum = z.enum(['INCREMENTAL', 'FULL', 'DATE_RANGE']);
export const IntervalTypeEnum = z.enum([
  'EVERY_HOUR',
  'EVERY_2_HOURS',
  'EVERY_4_HOURS',
  'EVERY_6_HOURS',
  'EVERY_12_HOURS',
  'DAILY'
]);

// Transaction schema
export const BankTransactionSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  accountId: z.string().uuid(),
  connectionId: z.string().uuid(),

  externalId: z.string(),
  bankReference: z.string().nullable(),
  endToEndId: z.string().nullable(),

  transactionType: TransactionTypeEnum,
  status: TransactionStatusEnum,

  amount: z.number(),
  currency: z.string().length(3),
  originalAmount: z.number().nullable(),
  originalCurrency: z.string().length(3).nullable(),
  exchangeRate: z.number().nullable(),

  bookingDate: z.string().date(),
  valueDate: z.string().date().nullable(),
  transactionDate: z.string().datetime().nullable(),

  description: z.string().nullable(),
  counterpartyName: z.string().nullable(),
  counterpartyAccount: z.string().nullable(),

  categoryId: z.string().uuid().nullable(),
  categoryConfidence: z.number().min(0).max(1).nullable(),
  isCategoryConfirmed: z.boolean(),

  reconciliationStatus: ReconciliationStatusEnum,
  reconciledEntryId: z.string().uuid().nullable(),

  rawData: z.record(z.unknown()),
  normalizedData: z.record(z.unknown()).nullable(),

  importedAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// Import request schema
export const ImportTransactionsRequestSchema = z.object({
  connectionId: z.string().uuid(),
  accountId: z.string().uuid().optional(),
  importType: ImportTypeEnum,
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional()
}).refine(
  (data) => {
    if (data.importType === 'DATE_RANGE') {
      return data.dateFrom && data.dateTo;
    }
    return true;
  },
  { message: 'Data od i do są wymagane dla importu z zakresu dat' }
).refine(
  (data) => {
    if (data.dateFrom && data.dateTo) {
      const from = new Date(data.dateFrom);
      const to = new Date(data.dateTo);
      const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 90;
    }
    return true;
  },
  { message: 'Maksymalny zakres to 90 dni' }
);

// Import job response
export const ImportJobSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  connectionId: z.string().uuid(),
  accountId: z.string().uuid().nullable(),

  importType: ImportTypeEnum,
  dateFrom: z.string().date().nullable(),
  dateTo: z.string().date().nullable(),

  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),

  transactionsFetched: z.number(),
  transactionsImported: z.number(),
  transactionsSkipped: z.number(),
  errors: z.array(z.object({
    code: z.string(),
    message: z.string(),
    transactionId: z.string().optional()
  })).nullable(),

  triggeredBy: z.enum(['SCHEDULE', 'MANUAL', 'WEBHOOK']),
  createdAt: z.string().datetime()
});

// Transaction list query
export const TransactionListQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  connectionId: z.string().uuid().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  type: TransactionTypeEnum.optional(),
  status: TransactionStatusEnum.optional(),
  reconciliationStatus: ReconciliationStatusEnum.optional(),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(10).max(100).default(50),
  sortBy: z.enum(['bookingDate', 'amount', 'counterpartyName']).default('bookingDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Schedule configuration
export const ImportScheduleSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  connectionId: z.string().uuid(),

  isEnabled: z.boolean(),
  intervalType: IntervalTypeEnum,
  intervalValue: z.number().min(1).max(24),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),

  lastRunAt: z.string().datetime().nullable(),
  nextRunAt: z.string().datetime().nullable(),
  consecutiveFailures: z.number()
});

export const CreateScheduleRequestSchema = z.object({
  connectionId: z.string().uuid(),
  intervalType: IntervalTypeEnum,
  intervalValue: z.number().min(1).max(24).default(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional()
});

// Type exports
export type BankTransaction = z.infer<typeof BankTransactionSchema>;
export type ImportTransactionsRequest = z.infer<typeof ImportTransactionsRequestSchema>;
export type ImportJob = z.infer<typeof ImportJobSchema>;
export type TransactionListQuery = z.infer<typeof TransactionListQuerySchema>;
export type ImportSchedule = z.infer<typeof ImportScheduleSchema>;
export type CreateScheduleRequest = z.infer<typeof CreateScheduleRequestSchema>;
```

### tRPC Router

```typescript
// src/modules/bnk/routers/transaction.router.ts
import { router, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  ImportTransactionsRequestSchema,
  TransactionListQuerySchema,
  CreateScheduleRequestSchema,
  BankTransactionSchema,
  ImportJobSchema,
  ImportScheduleSchema
} from '../schemas/transaction.schema';
import { TransactionImportService } from '../services/transaction-import.service';
import { TransactionNormalizationService } from '../services/transaction-normalization.service';

export const transactionRouter = router({
  // Import transactions
  importTransactions: protectedProcedure
    .input(ImportTransactionsRequestSchema)
    .output(ImportJobSchema)
    .mutation(async ({ ctx, input }) => {
      const importService = new TransactionImportService(ctx.db);

      // Verify connection belongs to client
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

      // Create import job
      const job = await importService.createImportJob({
        clientId: ctx.session.clientId,
        connectionId: input.connectionId,
        accountId: input.accountId,
        importType: input.importType,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        triggeredBy: 'MANUAL'
      });

      // Start async import
      importService.executeImport(job.id).catch(console.error);

      // Audit log
      await ctx.audit.log({
        action: 'TRANSACTION_IMPORT_STARTED',
        resourceType: 'IMPORT_JOB',
        resourceId: job.id,
        details: { importType: input.importType }
      });

      return job;
    }),

  // Get import job status
  getImportJob: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .output(ImportJobSchema)
    .query(async ({ ctx, input }) => {
      const job = await ctx.db.transactionImportJob.findFirst({
        where: {
          id: input.jobId,
          clientId: ctx.session.clientId
        }
      });

      if (!job) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono zadania importu'
        });
      }

      return job;
    }),

  // List transactions
  getTransactions: protectedProcedure
    .input(TransactionListQuerySchema)
    .output(z.object({
      transactions: z.array(BankTransactionSchema),
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
      totalPages: z.number(),
      summary: z.object({
        totalCredit: z.number(),
        totalDebit: z.number(),
        netAmount: z.number()
      })
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {
        clientId: ctx.session.clientId
      };

      if (input.accountId) where.accountId = input.accountId;
      if (input.connectionId) where.connectionId = input.connectionId;
      if (input.type) where.transactionType = input.type;
      if (input.status) where.status = input.status;
      if (input.reconciliationStatus) where.reconciliationStatus = input.reconciliationStatus;

      if (input.dateFrom || input.dateTo) {
        where.bookingDate = {};
        if (input.dateFrom) where.bookingDate.gte = input.dateFrom;
        if (input.dateTo) where.bookingDate.lte = input.dateTo;
      }

      if (input.minAmount !== undefined || input.maxAmount !== undefined) {
        where.amount = {};
        if (input.minAmount !== undefined) where.amount.gte = input.minAmount;
        if (input.maxAmount !== undefined) where.amount.lte = input.maxAmount;
      }

      if (input.search) {
        where.OR = [
          { description: { contains: input.search, mode: 'insensitive' } },
          { counterpartyName: { contains: input.search, mode: 'insensitive' } },
          { counterpartyAccount: { contains: input.search } }
        ];
      }

      const [transactions, total, summary] = await Promise.all([
        ctx.db.bankTransaction.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { [input.sortBy]: input.sortOrder }
        }),
        ctx.db.bankTransaction.count({ where }),
        ctx.db.bankTransaction.groupBy({
          by: ['transactionType'],
          where,
          _sum: { amount: true }
        })
      ]);

      const creditSum = summary.find(s => s.transactionType === 'CREDIT')?._sum.amount || 0;
      const debitSum = Math.abs(summary.find(s => s.transactionType === 'DEBIT')?._sum.amount || 0);

      return {
        transactions,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
        summary: {
          totalCredit: creditSum,
          totalDebit: debitSum,
          netAmount: creditSum - debitSum
        }
      };
    }),

  // Get single transaction
  getTransaction: protectedProcedure
    .input(z.object({ transactionId: z.string().uuid() }))
    .output(BankTransactionSchema.extend({
      account: z.object({
        id: z.string().uuid(),
        name: z.string(),
        iban: z.string()
      }),
      relatedTransactions: z.array(z.object({
        id: z.string().uuid(),
        description: z.string().nullable(),
        amount: z.number(),
        bookingDate: z.string()
      }))
    }))
    .query(async ({ ctx, input }) => {
      const transaction = await ctx.db.bankTransaction.findFirst({
        where: {
          id: input.transactionId,
          clientId: ctx.session.clientId
        },
        include: {
          account: {
            select: { id: true, name: true, iban: true }
          }
        }
      });

      if (!transaction) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono transakcji'
        });
      }

      // Find related transactions (same counterparty)
      const relatedTransactions = transaction.counterpartyAccount
        ? await ctx.db.bankTransaction.findMany({
            where: {
              clientId: ctx.session.clientId,
              counterpartyAccount: transaction.counterpartyAccount,
              id: { not: transaction.id }
            },
            select: {
              id: true,
              description: true,
              amount: true,
              bookingDate: true
            },
            take: 5,
            orderBy: { bookingDate: 'desc' }
          })
        : [];

      return { ...transaction, relatedTransactions };
    }),

  // Configure import schedule
  createSchedule: protectedProcedure
    .input(CreateScheduleRequestSchema)
    .output(ImportScheduleSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify connection
      const connection = await ctx.db.bankConnection.findFirst({
        where: {
          id: input.connectionId,
          clientId: ctx.session.clientId
        }
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono połączenia bankowego'
        });
      }

      // Calculate next run time
      const nextRunAt = calculateNextRunTime(input);

      const schedule = await ctx.db.importSchedule.upsert({
        where: {
          clientId_connectionId: {
            clientId: ctx.session.clientId,
            connectionId: input.connectionId
          }
        },
        create: {
          clientId: ctx.session.clientId,
          connectionId: input.connectionId,
          isEnabled: true,
          intervalType: input.intervalType,
          intervalValue: input.intervalValue,
          startTime: input.startTime,
          endTime: input.endTime,
          daysOfWeek: input.daysOfWeek,
          nextRunAt
        },
        update: {
          isEnabled: true,
          intervalType: input.intervalType,
          intervalValue: input.intervalValue,
          startTime: input.startTime,
          endTime: input.endTime,
          daysOfWeek: input.daysOfWeek,
          nextRunAt
        }
      });

      await ctx.audit.log({
        action: 'IMPORT_SCHEDULE_CONFIGURED',
        resourceType: 'IMPORT_SCHEDULE',
        resourceId: schedule.id,
        details: { intervalType: input.intervalType }
      });

      return schedule;
    }),

  // Get schedule
  getSchedule: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .output(ImportScheduleSchema.nullable())
    .query(async ({ ctx, input }) => {
      return ctx.db.importSchedule.findFirst({
        where: {
          connectionId: input.connectionId,
          clientId: ctx.session.clientId
        }
      });
    }),

  // Toggle schedule
  toggleSchedule: protectedProcedure
    .input(z.object({
      scheduleId: z.string().uuid(),
      isEnabled: z.boolean()
    }))
    .output(ImportScheduleSchema)
    .mutation(async ({ ctx, input }) => {
      const schedule = await ctx.db.importSchedule.findFirst({
        where: {
          id: input.scheduleId,
          clientId: ctx.session.clientId
        }
      });

      if (!schedule) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Nie znaleziono harmonogramu'
        });
      }

      return ctx.db.importSchedule.update({
        where: { id: input.scheduleId },
        data: {
          isEnabled: input.isEnabled,
          nextRunAt: input.isEnabled ? calculateNextRunTime(schedule) : null
        }
      });
    }),

  // Get import history
  getImportHistory: protectedProcedure
    .input(z.object({
      connectionId: z.string().uuid().optional(),
      limit: z.number().min(1).max(100).default(20)
    }))
    .output(z.array(ImportJobSchema))
    .query(async ({ ctx, input }) => {
      const where: any = {
        clientId: ctx.session.clientId
      };

      if (input.connectionId) {
        where.connectionId = input.connectionId;
      }

      return ctx.db.transactionImportJob.findMany({
        where,
        take: input.limit,
        orderBy: { createdAt: 'desc' }
      });
    })
});

// Helper function
function calculateNextRunTime(schedule: {
  intervalType: string;
  intervalValue: number;
  startTime?: string;
  endTime?: string;
  daysOfWeek?: number[];
}): Date {
  const now = new Date();
  let next = new Date(now);

  const intervalHours: Record<string, number> = {
    'EVERY_HOUR': 1,
    'EVERY_2_HOURS': 2,
    'EVERY_4_HOURS': 4,
    'EVERY_6_HOURS': 6,
    'EVERY_12_HOURS': 12,
    'DAILY': 24
  };

  const hours = intervalHours[schedule.intervalType] * schedule.intervalValue;
  next.setTime(next.getTime() + hours * 60 * 60 * 1000);

  // Adjust for time window
  if (schedule.startTime && schedule.endTime) {
    const [startHour, startMin] = schedule.startTime.split(':').map(Number);
    const [endHour, endMin] = schedule.endTime.split(':').map(Number);

    const nextHour = next.getHours();
    if (nextHour < startHour || (nextHour === startHour && next.getMinutes() < startMin)) {
      next.setHours(startHour, startMin, 0, 0);
    } else if (nextHour > endHour || (nextHour === endHour && next.getMinutes() > endMin)) {
      next.setDate(next.getDate() + 1);
      next.setHours(startHour, startMin, 0, 0);
    }
  }

  return next;
}
```

### Transaction Normalization Service

```typescript
// src/modules/bnk/services/transaction-normalization.service.ts
import crypto from 'crypto';

interface RawTransaction {
  externalId: string;
  [key: string]: unknown;
}

interface NormalizedTransaction {
  externalId: string;
  bankReference: string | null;
  endToEndId: string | null;
  transactionType: 'CREDIT' | 'DEBIT';
  status: 'PENDING' | 'BOOKED';
  amount: number;
  currency: string;
  originalAmount: number | null;
  originalCurrency: string | null;
  exchangeRate: number | null;
  bookingDate: string;
  valueDate: string | null;
  transactionDate: string | null;
  description: string | null;
  counterpartyName: string | null;
  counterpartyAccount: string | null;
  rawData: Record<string, unknown>;
  deduplicationHash: string;
}

export class TransactionNormalizationService {
  // Provider-specific normalizers
  private normalizers: Map<string, (raw: RawTransaction) => NormalizedTransaction> = new Map([
    ['PKO', this.normalizePKO.bind(this)],
    ['MBANK', this.normalizeMBank.bind(this)],
    ['ING', this.normalizeING.bind(this)],
    ['SANTANDER', this.normalizeSantander.bind(this)]
  ]);

  normalize(
    provider: string,
    rawTransaction: RawTransaction
  ): NormalizedTransaction {
    const normalizer = this.normalizers.get(provider.toUpperCase());

    if (!normalizer) {
      // Use generic normalizer for unknown providers
      return this.normalizeGeneric(rawTransaction);
    }

    return normalizer(rawTransaction);
  }

  private normalizePKO(raw: RawTransaction): NormalizedTransaction {
    // PKO Bank Polski specific format
    const data = raw as any;

    const amount = this.parsePolishAmount(data.kwota || data.amount);
    const transactionType = amount >= 0 ? 'CREDIT' : 'DEBIT';

    return {
      externalId: data.id_transakcji || data.externalId,
      bankReference: data.numer_referencyjny || null,
      endToEndId: data.end_to_end_id || null,
      transactionType,
      status: data.status === 'oczekująca' ? 'PENDING' : 'BOOKED',
      amount: Math.abs(amount),
      currency: data.waluta || 'PLN',
      originalAmount: data.kwota_oryginalna ? this.parsePolishAmount(data.kwota_oryginalna) : null,
      originalCurrency: data.waluta_oryginalna || null,
      exchangeRate: data.kurs_wymiany ? parseFloat(data.kurs_wymiany) : null,
      bookingDate: this.parsePolishDate(data.data_ksiegowania || data.booking_date),
      valueDate: data.data_waluty ? this.parsePolishDate(data.data_waluty) : null,
      transactionDate: data.data_operacji ? this.parsePolishDateTime(data.data_operacji) : null,
      description: data.tytul || data.opis || null,
      counterpartyName: data.nazwa_kontrahenta || data.nadawca || data.odbiorca || null,
      counterpartyAccount: this.normalizeIBAN(data.rachunek_kontrahenta) || null,
      rawData: raw,
      deduplicationHash: this.generateDeduplicationHash({
        externalId: data.id_transakcji || data.externalId,
        amount,
        date: data.data_ksiegowania,
        description: data.tytul
      })
    };
  }

  private normalizeMBank(raw: RawTransaction): NormalizedTransaction {
    // mBank uses more standard ISO formats
    const data = raw as any;

    const amount = parseFloat(data.amount?.value || data.amount);
    const transactionType = amount >= 0 ? 'CREDIT' : 'DEBIT';

    return {
      externalId: data.transactionId || data.id,
      bankReference: data.referenceNumber || null,
      endToEndId: data.endToEndId || null,
      transactionType,
      status: data.bookingStatus === 'PDNG' ? 'PENDING' : 'BOOKED',
      amount: Math.abs(amount),
      currency: data.amount?.currency || data.currency || 'PLN',
      originalAmount: data.instructedAmount ? parseFloat(data.instructedAmount.value) : null,
      originalCurrency: data.instructedAmount?.currency || null,
      exchangeRate: data.exchangeRate ? parseFloat(data.exchangeRate) : null,
      bookingDate: data.bookingDate,
      valueDate: data.valueDate || null,
      transactionDate: data.transactionDate || null,
      description: data.remittanceInformationUnstructured || data.details || null,
      counterpartyName: data.creditorName || data.debtorName || null,
      counterpartyAccount: this.normalizeIBAN(data.creditorAccount?.iban || data.debtorAccount?.iban) || null,
      rawData: raw,
      deduplicationHash: this.generateDeduplicationHash({
        externalId: data.transactionId || data.id,
        amount,
        date: data.bookingDate,
        description: data.remittanceInformationUnstructured
      })
    };
  }

  private normalizeING(raw: RawTransaction): NormalizedTransaction {
    const data = raw as any;

    const amount = parseFloat(data.transactionAmount?.amount || data.amount);
    const transactionType = data.creditDebitIndicator === 'CRDT' ? 'CREDIT' : 'DEBIT';

    return {
      externalId: data.entryReference || data.id,
      bankReference: data.bankTransactionCode || null,
      endToEndId: data.endToEndIdentification || null,
      transactionType,
      status: data.status === 'BOOK' ? 'BOOKED' : 'PENDING',
      amount: Math.abs(amount),
      currency: data.transactionAmount?.currency || 'PLN',
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
      bookingDate: data.bookingDate,
      valueDate: data.valueDate || null,
      transactionDate: null,
      description: Array.isArray(data.remittanceInformation)
        ? data.remittanceInformation.join(' ')
        : data.remittanceInformation || null,
      counterpartyName: data.relatedParties?.creditor?.name || data.relatedParties?.debtor?.name || null,
      counterpartyAccount: this.normalizeIBAN(
        data.relatedParties?.creditorAccount?.iban || data.relatedParties?.debtorAccount?.iban
      ) || null,
      rawData: raw,
      deduplicationHash: this.generateDeduplicationHash({
        externalId: data.entryReference,
        amount,
        date: data.bookingDate,
        description: data.remittanceInformation
      })
    };
  }

  private normalizeSantander(raw: RawTransaction): NormalizedTransaction {
    const data = raw as any;

    const amount = parseFloat(data.amount);
    const transactionType = amount >= 0 ? 'CREDIT' : 'DEBIT';

    return {
      externalId: data.transactionId,
      bankReference: data.referenceNumber || null,
      endToEndId: data.endToEndId || null,
      transactionType,
      status: 'BOOKED',
      amount: Math.abs(amount),
      currency: data.currency || 'PLN',
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
      bookingDate: data.bookingDate,
      valueDate: data.valueDate || null,
      transactionDate: data.operationDate || null,
      description: data.description || null,
      counterpartyName: data.counterparty?.name || null,
      counterpartyAccount: this.normalizeIBAN(data.counterparty?.accountNumber) || null,
      rawData: raw,
      deduplicationHash: this.generateDeduplicationHash({
        externalId: data.transactionId,
        amount,
        date: data.bookingDate,
        description: data.description
      })
    };
  }

  private normalizeGeneric(raw: RawTransaction): NormalizedTransaction {
    const data = raw as any;

    // Attempt to extract common fields
    const amount = this.extractAmount(data);
    const transactionType = amount >= 0 ? 'CREDIT' : 'DEBIT';

    return {
      externalId: data.externalId || data.id || data.transactionId,
      bankReference: data.reference || data.bankReference || null,
      endToEndId: data.endToEndId || null,
      transactionType,
      status: 'BOOKED',
      amount: Math.abs(amount),
      currency: data.currency || 'PLN',
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
      bookingDate: this.extractDate(data),
      valueDate: null,
      transactionDate: null,
      description: data.description || data.title || data.details || null,
      counterpartyName: data.counterpartyName || data.creditorName || data.debtorName || null,
      counterpartyAccount: this.normalizeIBAN(data.counterpartyAccount || data.iban) || null,
      rawData: raw,
      deduplicationHash: this.generateDeduplicationHash({
        externalId: data.externalId || data.id,
        amount,
        date: this.extractDate(data),
        description: data.description
      })
    };
  }

  // Helper methods
  private parsePolishAmount(value: string | number): number {
    if (typeof value === 'number') return value;
    // Polish format: "1 500,00" or "1500,00"
    return parseFloat(value.replace(/\s/g, '').replace(',', '.'));
  }

  private parsePolishDate(value: string): string {
    // Polish format: "14.01.2024" -> "2024-01-14"
    if (value.includes('.')) {
      const [day, month, year] = value.split('.');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return value;
  }

  private parsePolishDateTime(value: string): string {
    // Polish format: "14.01.2024 10:30:00"
    const [datePart, timePart] = value.split(' ');
    const date = this.parsePolishDate(datePart);
    return `${date}T${timePart || '00:00:00'}`;
  }

  private normalizeIBAN(value: string | null | undefined): string | null {
    if (!value) return null;
    // Remove spaces and convert to uppercase
    return value.replace(/\s/g, '').toUpperCase();
  }

  private extractAmount(data: any): number {
    if (data.amount?.value) return parseFloat(data.amount.value);
    if (typeof data.amount === 'number') return data.amount;
    if (typeof data.amount === 'string') return this.parsePolishAmount(data.amount);
    if (data.kwota) return this.parsePolishAmount(data.kwota);
    return 0;
  }

  private extractDate(data: any): string {
    const dateFields = ['bookingDate', 'data_ksiegowania', 'date', 'transactionDate'];
    for (const field of dateFields) {
      if (data[field]) {
        return data[field].includes('.') ? this.parsePolishDate(data[field]) : data[field];
      }
    }
    return new Date().toISOString().split('T')[0];
  }

  private generateDeduplicationHash(data: {
    externalId: string;
    amount: number;
    date: string;
    description?: string;
  }): string {
    // Primary: use external ID if available
    if (data.externalId) {
      return crypto
        .createHash('sha256')
        .update(`ext:${data.externalId}`)
        .digest('hex');
    }

    // Fallback: hash of amount, date, and description
    const content = `${data.amount}|${data.date}|${data.description || ''}`;
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
  }
}
```

---

## Test Specifications

### Unit Tests

```typescript
// src/modules/bnk/__tests__/transaction-normalization.test.ts
import { describe, it, expect } from 'vitest';
import { TransactionNormalizationService } from '../services/transaction-normalization.service';

describe('TransactionNormalizationService', () => {
  const service = new TransactionNormalizationService();

  describe('PKO Bank Polski normalization', () => {
    it('should normalize PKO transaction with Polish format', () => {
      const raw = {
        externalId: 'PKO123',
        id_transakcji: 'TRX001',
        kwota: '1 500,00',
        waluta: 'PLN',
        data_ksiegowania: '14.01.2024',
        tytul: 'Przelew przychodzący',
        nazwa_kontrahenta: 'Jan Kowalski',
        rachunek_kontrahenta: 'PL61 1090 1014 0000 0712 1981 2874'
      };

      const result = service.normalize('PKO', raw);

      expect(result.amount).toBe(1500);
      expect(result.currency).toBe('PLN');
      expect(result.bookingDate).toBe('2024-01-14');
      expect(result.transactionType).toBe('CREDIT');
      expect(result.counterpartyAccount).toBe('PL61109010140000071219812874');
    });

    it('should handle negative amounts as DEBIT', () => {
      const raw = {
        externalId: 'PKO124',
        kwota: '-500,00',
        data_ksiegowania: '14.01.2024'
      };

      const result = service.normalize('PKO', raw);

      expect(result.transactionType).toBe('DEBIT');
      expect(result.amount).toBe(500);
    });
  });

  describe('mBank normalization', () => {
    it('should normalize mBank transaction with ISO format', () => {
      const raw = {
        externalId: 'MBANK123',
        transactionId: 'TRX002',
        amount: { value: '2500.00', currency: 'EUR' },
        bookingDate: '2024-01-14',
        remittanceInformationUnstructured: 'Invoice payment',
        creditorName: 'ABC Company',
        creditorAccount: { iban: 'PL61 1090 1014 0000 0712 1981 2874' }
      };

      const result = service.normalize('MBANK', raw);

      expect(result.amount).toBe(2500);
      expect(result.currency).toBe('EUR');
      expect(result.description).toBe('Invoice payment');
    });
  });

  describe('Deduplication', () => {
    it('should generate consistent hash for same transaction', () => {
      const raw = {
        externalId: 'TEST123',
        amount: '100,00',
        data_ksiegowania: '14.01.2024'
      };

      const result1 = service.normalize('PKO', raw);
      const result2 = service.normalize('PKO', raw);

      expect(result1.deduplicationHash).toBe(result2.deduplicationHash);
    });

    it('should generate different hash for different transactions', () => {
      const raw1 = {
        externalId: 'TEST123',
        amount: '100,00',
        data_ksiegowania: '14.01.2024'
      };
      const raw2 = {
        externalId: 'TEST124',
        amount: '100,00',
        data_ksiegowania: '14.01.2024'
      };

      const result1 = service.normalize('PKO', raw1);
      const result2 = service.normalize('PKO', raw2);

      expect(result1.deduplicationHash).not.toBe(result2.deduplicationHash);
    });
  });

  describe('Generic normalization', () => {
    it('should handle unknown provider with generic normalizer', () => {
      const raw = {
        externalId: 'UNKNOWN123',
        id: 'TRX003',
        amount: 750.50,
        currency: 'PLN',
        bookingDate: '2024-01-14',
        description: 'Generic transaction'
      };

      const result = service.normalize('UNKNOWN_BANK', raw);

      expect(result.externalId).toBe('UNKNOWN123');
      expect(result.amount).toBe(750.50);
      expect(result.description).toBe('Generic transaction');
    });
  });
});
```

### Integration Tests

```typescript
// src/modules/bnk/__tests__/transaction-import.integration.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestContext } from '@/test/utils';
import { transactionRouter } from '../routers/transaction.router';

describe('Transaction Import Integration', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  describe('importTransactions', () => {
    it('should create import job for valid connection', async () => {
      const connection = await ctx.db.bankConnection.create({
        data: {
          clientId: ctx.session.clientId,
          provider: 'MBANK',
          status: 'ACTIVE',
          bankName: 'mBank',
          consentId: 'consent123',
          consentExpiresAt: new Date(Date.now() + 86400000),
          accessToken: 'encrypted_token',
          refreshToken: 'encrypted_refresh'
        }
      });

      const result = await transactionRouter.createCaller(ctx).importTransactions({
        connectionId: connection.id,
        importType: 'INCREMENTAL'
      });

      expect(result.status).toBe('PENDING');
      expect(result.importType).toBe('INCREMENTAL');
      expect(result.triggeredBy).toBe('MANUAL');
    });

    it('should reject import for inactive connection', async () => {
      const connection = await ctx.db.bankConnection.create({
        data: {
          clientId: ctx.session.clientId,
          provider: 'MBANK',
          status: 'EXPIRED',
          bankName: 'mBank'
        }
      });

      await expect(
        transactionRouter.createCaller(ctx).importTransactions({
          connectionId: connection.id,
          importType: 'INCREMENTAL'
        })
      ).rejects.toThrow('Nie znaleziono aktywnego połączenia bankowego');
    });

    it('should validate date range does not exceed 90 days', async () => {
      const connection = await ctx.db.bankConnection.create({
        data: {
          clientId: ctx.session.clientId,
          provider: 'MBANK',
          status: 'ACTIVE',
          bankName: 'mBank',
          consentId: 'consent123',
          consentExpiresAt: new Date(Date.now() + 86400000)
        }
      });

      await expect(
        transactionRouter.createCaller(ctx).importTransactions({
          connectionId: connection.id,
          importType: 'DATE_RANGE',
          dateFrom: '2024-01-01',
          dateTo: '2024-05-01'
        })
      ).rejects.toThrow('Maksymalny zakres to 90 dni');
    });
  });

  describe('getTransactions', () => {
    it('should return paginated transactions with summary', async () => {
      // Create test transactions
      const account = await ctx.db.bankAccount.create({
        data: {
          clientId: ctx.session.clientId,
          connectionId: 'conn123',
          externalId: 'ACC001',
          iban: 'PL61109010140000071219812874',
          name: 'Konto główne',
          currency: 'PLN',
          accountType: 'CHECKING'
        }
      });

      await ctx.db.bankTransaction.createMany({
        data: [
          {
            clientId: ctx.session.clientId,
            accountId: account.id,
            connectionId: 'conn123',
            externalId: 'TRX001',
            transactionType: 'CREDIT',
            status: 'BOOKED',
            amount: 1000,
            currency: 'PLN',
            bookingDate: '2024-01-14',
            deduplicationHash: 'hash1',
            rawData: {}
          },
          {
            clientId: ctx.session.clientId,
            accountId: account.id,
            connectionId: 'conn123',
            externalId: 'TRX002',
            transactionType: 'DEBIT',
            status: 'BOOKED',
            amount: 500,
            currency: 'PLN',
            bookingDate: '2024-01-14',
            deduplicationHash: 'hash2',
            rawData: {}
          }
        ]
      });

      const result = await transactionRouter.createCaller(ctx).getTransactions({
        accountId: account.id
      });

      expect(result.transactions).toHaveLength(2);
      expect(result.summary.totalCredit).toBe(1000);
      expect(result.summary.totalDebit).toBe(500);
      expect(result.summary.netAmount).toBe(500);
    });
  });
});
```

---

## Security Checklist

- [ ] Transaction data encrypted at rest
- [ ] RLS policies enforce client isolation
- [ ] Input validation with Zod schemas
- [ ] SQL injection prevention via Prisma
- [ ] Rate limiting on import endpoints
- [ ] Audit logging for all import operations
- [ ] Sensitive data (account numbers) masked in logs
- [ ] Import jobs timeout after 10 minutes

---

## Audit Events

| Event | Trigger | Data |
|-------|---------|------|
| `TRANSACTION_IMPORT_STARTED` | Import job created | jobId, importType |
| `TRANSACTION_IMPORT_COMPLETED` | Import finished | jobId, counts |
| `TRANSACTION_IMPORT_FAILED` | Import error | jobId, error |
| `IMPORT_SCHEDULE_CONFIGURED` | Schedule created/updated | scheduleId, interval |
| `TRANSACTIONS_FETCHED` | Bank API called | connectionId, count |
| `DUPLICATE_DETECTED` | Deduplication triggered | transactionId, hash |

---

## Dependencies

- **BNK-002**: Account Aggregation (requires accounts to import into)
- **BNK-001**: Bank Connection (requires active connection)

---

## Polish Language Support

All user-facing messages in Polish:
- "Nie znaleziono aktywnego połączenia bankowego"
- "Data od i do są wymagane dla importu z zakresu dat"
- "Maksymalny zakres to 90 dni"
- "Nie znaleziono zadania importu"
- "Nie znaleziono transakcji"
- "Nie znaleziono harmonogramu"

---

*Last updated: December 2024*
