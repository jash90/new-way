# BNK-002: Account Aggregation & Balance

> **Story ID**: BNK-002
> **Epic**: Banking Integration Layer (BNK)
> **Status**: 📋 Ready for Development
> **Priority**: P0 (Critical)
> **Story Points**: 8
> **Phase**: Week 21

---

## User Story

**As an** accountant,
**I want to** view all connected bank accounts with real-time balances,
**So that** I can monitor the cash position of my clients.

---

## Acceptance Criteria

### AC1: Multi-account Aggregation
```gherkin
Feature: Multi-account Aggregation

  Scenario: Fetch accounts after successful bank connection
    Given I have an active bank connection to PKO Bank
    When the account sync job runs
    Then all accounts linked to the consent are fetched
    And each account is stored with:
      | Field | Example |
      | external_id | PKO-ACC-12345 |
      | account_number | 12 3456 7890 1234 5678 9012 3456 |
      | iban | PL12345678901234567890123456 |
      | name | Rachunek bieżący |
      | type | CHECKING |
      | currency | PLN |
    And account sync timestamp is updated

  Scenario: Aggregate accounts from multiple banks
    Given client "org-123" has connections to PKO and mBank
    When I view the client's banking dashboard
    Then I see all accounts from both banks aggregated
    And accounts are grouped by bank
    And total balance across all accounts is displayed
    And currency conversion is applied for non-PLN accounts
```

### AC2: Real-time Balance Retrieval
```gherkin
Feature: Real-time Balance Retrieval

  Scenario: Fetch current balance for account
    Given I have a connected bank account "acc-123"
    When I request the current balance
    Then the balance is fetched from the bank API
    And I receive both booked and available balance
    And the balance is cached for 60 seconds
    And balance_updated_at timestamp is recorded

  Scenario: Display balance with refresh option
    Given I am viewing account "acc-123" details
    Then I see the current balance: 15,234.56 PLN
    And I see the available balance: 14,000.00 PLN
    And I see "Last updated: 2 minutes ago"
    And I can click "Refresh" to get fresh balance

  Scenario: Handle balance fetch failure
    Given the bank API is temporarily unavailable
    When I request the balance
    Then the cached balance is returned with a warning
    And the warning states "Saldo może być nieaktualne"
    And a retry is scheduled in 5 minutes
```

### AC3: Available vs Booked Balance
```gherkin
Feature: Balance Types

  Scenario: Display different balance types
    Given account "acc-123" has pending transactions
    When I view the account details
    Then I see:
      | Balance Type | Amount | Description |
      | Saldo księgowe | 15,234.56 PLN | Confirmed transactions |
      | Saldo dostępne | 14,000.00 PLN | Available for spending |
      | Zablokowane | 1,234.56 PLN | Pending/blocked funds |
    And the tooltip explains each balance type

  Scenario: Track balance changes
    Given I am viewing an account
    When a new transaction affects the balance
    Then the balance is updated in real-time (if webhook active)
    And a change indicator shows +/- amount
    And the change is logged in balance history
```

### AC4: Multi-currency Support (PLN, EUR, USD)
```gherkin
Feature: Multi-currency Support

  Scenario: Display foreign currency accounts
    Given client has accounts in PLN, EUR, and USD
    When I view the aggregated dashboard
    Then each account shows balance in native currency
    And total balance is converted to PLN using NBP rates
    And conversion rate source and date are displayed

  Scenario: Currency conversion for reporting
    Given I am generating a cash position report
    When the report includes EUR and USD accounts
    Then balances are converted using NBP mid-rate
    And the conversion date is noted
    And original currency amounts are preserved

  Scenario: Handle missing exchange rate
    Given NBP rate for USD is not available today
    When converting USD balance
    Then the most recent available rate is used
    And a warning indicates "Kurs z dnia: {date}"
```

### AC5: Account Type Classification
```gherkin
Feature: Account Type Classification

  Scenario: Classify accounts by type
    Given I fetch accounts from the bank
    Then each account is classified as:
      | Bank Type | System Type | Icon |
      | CACC | CHECKING | 💳 |
      | SVGS | SAVINGS | 🏦 |
      | CARD | CREDIT | 💳 |
      | LOAN | LOAN | 📋 |
      | OTHR | INVESTMENT | 📈 |
    And unknown types default to CHECKING

  Scenario: Filter accounts by type
    Given I have 10 connected accounts of various types
    When I filter by "CHECKING"
    Then only checking accounts are displayed
    And I can clear filter to see all accounts
```

### AC6: Balance History Tracking
```gherkin
Feature: Balance History Tracking

  Scenario: Record daily balance snapshots
    Given balance check job runs at 00:00 and 12:00
    When the job executes for account "acc-123"
    Then a balance snapshot is recorded:
      | timestamp | booked_balance | available_balance |
      | 2024-01-15 00:00 | 15,000.00 | 14,500.00 |
    And historical data is retained for 2 years

  Scenario: Display balance trend chart
    Given I am viewing account "acc-123"
    When I click "Historia salda"
    Then I see a chart showing balance over time
    And I can select time range: week, month, quarter, year
    And I can export data to Excel
```

### AC7: Low Balance Alerts
```gherkin
Feature: Low Balance Alerts

  Scenario: Configure low balance threshold
    Given I am managing account "acc-123"
    When I set low balance alert threshold to 5,000 PLN
    Then the threshold is saved for the account
    And I can enable/disable email and in-app notifications

  Scenario: Trigger low balance alert
    Given account "acc-123" has threshold 5,000 PLN
    And current balance drops to 4,500 PLN
    When the balance check job runs
    Then an in-app notification is created
    And an email is sent to configured recipients
    And the alert is logged for audit

  Scenario: Clear low balance alert
    Given a low balance alert is active for "acc-123"
    When the balance rises above threshold + 10% buffer
    Then the alert is cleared
    And a "balance restored" notification is sent
```

---

## Technical Specification

### Database Schema

```sql
-- Bank accounts table
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- External identifiers
  external_id VARCHAR(255) NOT NULL,
  resource_id VARCHAR(255), -- PSD2 resource ID

  -- Account details
  account_number VARCHAR(34),
  iban VARCHAR(34),
  bic VARCHAR(11),
  name VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255),

  -- Classification
  type VARCHAR(20) NOT NULL DEFAULT 'CHECKING'
    CHECK (type IN ('CHECKING', 'SAVINGS', 'CREDIT', 'LOAN', 'INVESTMENT')),
  product_name VARCHAR(255), -- Bank's product name

  -- Currency and balance
  currency CHAR(3) NOT NULL DEFAULT 'PLN',
  booked_balance DECIMAL(19, 4),
  available_balance DECIMAL(19, 4),
  credit_limit DECIMAL(19, 4),
  balance_updated_at TIMESTAMPTZ,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'CLOSED')),

  -- Alerts
  low_balance_threshold DECIMAL(19, 4),
  low_balance_alert_enabled BOOLEAN DEFAULT FALSE,
  low_balance_alert_triggered_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_external_account UNIQUE (connection_id, external_id)
);

-- Balance history for tracking
CREATE TABLE account_balance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,

  -- Balance snapshot
  booked_balance DECIMAL(19, 4) NOT NULL,
  available_balance DECIMAL(19, 4),
  credit_limit DECIMAL(19, 4),
  currency CHAR(3) NOT NULL,

  -- Conversion (if foreign currency)
  pln_equivalent DECIMAL(19, 4),
  exchange_rate DECIMAL(10, 6),
  exchange_rate_date DATE,

  -- Metadata
  snapshot_type VARCHAR(20) DEFAULT 'SCHEDULED'
    CHECK (snapshot_type IN ('SCHEDULED', 'MANUAL', 'TRANSACTION', 'ALERT')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_bank_accounts_connection ON bank_accounts(connection_id);
CREATE INDEX idx_bank_accounts_org ON bank_accounts(organization_id);
CREATE INDEX idx_bank_accounts_type ON bank_accounts(type);
CREATE INDEX idx_bank_accounts_currency ON bank_accounts(currency);
CREATE INDEX idx_bank_accounts_status ON bank_accounts(status);
CREATE INDEX idx_balance_history_account ON account_balance_history(account_id);
CREATE INDEX idx_balance_history_created ON account_balance_history(created_at);

-- Composite indexes
CREATE INDEX idx_bank_accounts_org_status ON bank_accounts(organization_id, status);
CREATE INDEX idx_balance_history_account_date ON account_balance_history(account_id, created_at DESC);

-- Row Level Security
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_balance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_accounts_org_isolation ON bank_accounts
  FOR ALL USING (organization_id = current_setting('app.organization_id')::UUID);

CREATE POLICY balance_history_org_isolation ON account_balance_history
  FOR ALL USING (organization_id = current_setting('app.organization_id')::UUID);
```

### Zod Schemas

```typescript
import { z } from 'zod';
import { Decimal } from 'decimal.js';

export const AccountTypeSchema = z.enum([
  'CHECKING',
  'SAVINGS',
  'CREDIT',
  'LOAN',
  'INVESTMENT'
]);

export const AccountStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'CLOSED'
]);

export const CurrencySchema = z.enum(['PLN', 'EUR', 'USD', 'GBP', 'CHF']);

// Balance schema
export const AccountBalanceSchema = z.object({
  booked: z.number(),
  available: z.number().nullable(),
  creditLimit: z.number().nullable(),
  currency: CurrencySchema,
  updatedAt: z.string().datetime()
});

// Account schema
export const BankAccountSchema = z.object({
  id: z.string().uuid(),
  connectionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  externalId: z.string(),
  accountNumber: z.string().nullable(),
  iban: z.string().regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/).nullable(),
  bic: z.string().nullable(),
  name: z.string(),
  ownerName: z.string().nullable(),
  type: AccountTypeSchema,
  currency: CurrencySchema,
  balance: AccountBalanceSchema,
  status: AccountStatusSchema,
  lowBalanceThreshold: z.number().nullable(),
  lowBalanceAlertEnabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// Request schemas
export const SyncAccountsRequestSchema = z.object({
  connectionId: z.string().uuid()
});

export const GetBalanceRequestSchema = z.object({
  accountId: z.string().uuid(),
  forceRefresh: z.boolean().default(false)
});

export const SetAlertThresholdRequestSchema = z.object({
  accountId: z.string().uuid(),
  threshold: z.number().positive(),
  enabled: z.boolean().default(true)
});

export const GetBalanceHistoryRequestSchema = z.object({
  accountId: z.string().uuid(),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime()
});

// Aggregated view schema
export const AccountAggregationSchema = z.object({
  accounts: z.array(BankAccountSchema),
  totalsByBank: z.array(z.object({
    bankId: z.string(),
    bankName: z.string(),
    accountCount: z.number(),
    totalBalance: z.number(),
    currency: CurrencySchema
  })),
  grandTotal: z.object({
    totalPLN: z.number(),
    accountCount: z.number(),
    lastUpdated: z.string().datetime()
  })
});

// Balance history entry
export const BalanceHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  bookedBalance: z.number(),
  availableBalance: z.number().nullable(),
  currency: CurrencySchema,
  plnEquivalent: z.number().nullable(),
  exchangeRate: z.number().nullable(),
  snapshotType: z.enum(['SCHEDULED', 'MANUAL', 'TRANSACTION', 'ALERT']),
  createdAt: z.string().datetime()
});

// Type exports
export type AccountType = z.infer<typeof AccountTypeSchema>;
export type BankAccount = z.infer<typeof BankAccountSchema>;
export type AccountBalance = z.infer<typeof AccountBalanceSchema>;
export type AccountAggregation = z.infer<typeof AccountAggregationSchema>;
export type BalanceHistoryEntry = z.infer<typeof BalanceHistoryEntrySchema>;
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '@/server/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  SyncAccountsRequestSchema,
  GetBalanceRequestSchema,
  SetAlertThresholdRequestSchema,
  GetBalanceHistoryRequestSchema,
  BankAccountSchema,
  AccountAggregationSchema,
  AccountBalanceSchema,
  BalanceHistoryEntrySchema
} from './schemas';

export const bankAccountRouter = router({
  // Sync accounts from bank
  syncAccounts: protectedProcedure
    .input(SyncAccountsRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db.bankConnection.findUnique({
        where: { id: input.connectionId }
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Połączenie nie zostało znalezione'
        });
      }

      if (connection.status !== 'ACTIVE') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Połączenie nie jest aktywne'
        });
      }

      // Get access token
      const accessToken = await ctx.tokenService.getAccessToken(connection.id);

      // Get provider
      const provider = ctx.bankProviderFactory.getProvider(connection.bankId);

      // Fetch accounts from bank
      const bankAccounts = await provider.fetchAccounts(accessToken);

      // Upsert accounts
      const accounts = await ctx.db.$transaction(async (tx) => {
        const results = [];

        for (const bankAccount of bankAccounts) {
          const account = await tx.bankAccount.upsert({
            where: {
              connection_id_external_id: {
                connectionId: input.connectionId,
                externalId: bankAccount.externalId
              }
            },
            create: {
              connectionId: input.connectionId,
              organizationId: connection.organizationId,
              externalId: bankAccount.externalId,
              resourceId: bankAccount.resourceId,
              accountNumber: bankAccount.accountNumber,
              iban: bankAccount.iban,
              bic: bankAccount.bic,
              name: bankAccount.name,
              ownerName: bankAccount.ownerName,
              type: mapAccountType(bankAccount.type),
              productName: bankAccount.productName,
              currency: bankAccount.currency,
              bookedBalance: bankAccount.balance?.booked,
              availableBalance: bankAccount.balance?.available,
              creditLimit: bankAccount.creditLimit,
              balanceUpdatedAt: new Date(),
              status: 'ACTIVE'
            },
            update: {
              name: bankAccount.name,
              bookedBalance: bankAccount.balance?.booked,
              availableBalance: bankAccount.balance?.available,
              creditLimit: bankAccount.creditLimit,
              balanceUpdatedAt: new Date(),
              status: 'ACTIVE',
              updatedAt: new Date()
            }
          });

          results.push(account);
        }

        return results;
      });

      // Update connection sync timestamp
      await ctx.db.bankConnection.update({
        where: { id: input.connectionId },
        data: { lastSyncedAt: new Date() }
      });

      // Audit log
      await ctx.audit.log({
        action: 'ACCOUNTS_SYNCED',
        resourceType: 'BANK_CONNECTION',
        resourceId: input.connectionId,
        organizationId: connection.organizationId,
        metadata: { accountCount: accounts.length }
      });

      return { success: true, accountCount: accounts.length };
    }),

  // Get accounts for organization
  getAccounts: protectedProcedure
    .input(z.object({
      organizationId: z.string().uuid(),
      type: AccountTypeSchema.optional(),
      currency: CurrencySchema.optional(),
      status: AccountStatusSchema.optional()
    }))
    .output(z.array(BankAccountSchema))
    .query(async ({ ctx, input }) => {
      const accounts = await ctx.db.bankAccount.findMany({
        where: {
          organizationId: input.organizationId,
          ...(input.type && { type: input.type }),
          ...(input.currency && { currency: input.currency }),
          ...(input.status && { status: input.status })
        },
        include: {
          connection: {
            select: { bankId: true, bankName: true, status: true }
          }
        },
        orderBy: [
          { connection: { bankName: 'asc' } },
          { name: 'asc' }
        ]
      });

      return accounts.map(acc => ({
        id: acc.id,
        connectionId: acc.connectionId,
        organizationId: acc.organizationId,
        externalId: acc.externalId,
        accountNumber: acc.accountNumber,
        iban: acc.iban,
        bic: acc.bic,
        name: acc.name,
        ownerName: acc.ownerName,
        type: acc.type,
        currency: acc.currency,
        balance: {
          booked: acc.bookedBalance?.toNumber() || 0,
          available: acc.availableBalance?.toNumber() || null,
          creditLimit: acc.creditLimit?.toNumber() || null,
          currency: acc.currency,
          updatedAt: acc.balanceUpdatedAt?.toISOString() || acc.updatedAt.toISOString()
        },
        status: acc.status,
        lowBalanceThreshold: acc.lowBalanceThreshold?.toNumber() || null,
        lowBalanceAlertEnabled: acc.lowBalanceAlertEnabled,
        createdAt: acc.createdAt.toISOString(),
        updatedAt: acc.updatedAt.toISOString()
      }));
    }),

  // Get aggregated account view
  getAggregation: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .output(AccountAggregationSchema)
    .query(async ({ ctx, input }) => {
      const accounts = await ctx.db.bankAccount.findMany({
        where: {
          organizationId: input.organizationId,
          status: 'ACTIVE'
        },
        include: {
          connection: {
            select: { bankId: true, bankName: true }
          }
        }
      });

      // Group by bank
      const byBank = accounts.reduce((acc, account) => {
        const bankId = account.connection.bankId;
        if (!acc[bankId]) {
          acc[bankId] = {
            bankId,
            bankName: account.connection.bankName,
            accounts: [],
            totalBalance: 0
          };
        }
        acc[bankId].accounts.push(account);
        acc[bankId].totalBalance += account.bookedBalance?.toNumber() || 0;
        return acc;
      }, {} as Record<string, any>);

      // Calculate grand total in PLN
      let totalPLN = 0;
      let latestUpdate = new Date(0);

      for (const account of accounts) {
        let balancePLN = account.bookedBalance?.toNumber() || 0;

        // Convert foreign currency
        if (account.currency !== 'PLN') {
          const rate = await ctx.exchangeRateService.getRate(account.currency, 'PLN');
          balancePLN = balancePLN * rate;
        }

        totalPLN += balancePLN;

        if (account.balanceUpdatedAt && account.balanceUpdatedAt > latestUpdate) {
          latestUpdate = account.balanceUpdatedAt;
        }
      }

      return {
        accounts: accounts.map(formatAccount),
        totalsByBank: Object.values(byBank).map(bank => ({
          bankId: bank.bankId,
          bankName: bank.bankName,
          accountCount: bank.accounts.length,
          totalBalance: bank.totalBalance,
          currency: 'PLN' // Simplified - assuming PLN for totals
        })),
        grandTotal: {
          totalPLN,
          accountCount: accounts.length,
          lastUpdated: latestUpdate.toISOString()
        }
      };
    }),

  // Get balance for single account
  getBalance: protectedProcedure
    .input(GetBalanceRequestSchema)
    .output(AccountBalanceSchema)
    .query(async ({ ctx, input }) => {
      const account = await ctx.db.bankAccount.findUnique({
        where: { id: input.accountId },
        include: { connection: true }
      });

      if (!account) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Konto nie zostało znalezione'
        });
      }

      // Check cache first (unless force refresh)
      if (!input.forceRefresh) {
        const cached = await ctx.redis.get(`balance:${input.accountId}`);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      // Fetch fresh balance from bank
      try {
        const accessToken = await ctx.tokenService.getAccessToken(account.connectionId);
        const provider = ctx.bankProviderFactory.getProvider(account.connection.bankId);

        const balance = await provider.fetchBalance(accessToken, account.externalId);

        // Update database
        await ctx.db.bankAccount.update({
          where: { id: input.accountId },
          data: {
            bookedBalance: balance.booked,
            availableBalance: balance.available,
            balanceUpdatedAt: new Date()
          }
        });

        const result = {
          booked: balance.booked,
          available: balance.available,
          creditLimit: account.creditLimit?.toNumber() || null,
          currency: account.currency,
          updatedAt: new Date().toISOString()
        };

        // Cache for 60 seconds
        await ctx.redis.set(
          `balance:${input.accountId}`,
          JSON.stringify(result),
          'EX',
          60
        );

        return result;
      } catch (error) {
        // Return cached/stored balance on error
        ctx.logger.warn('Failed to fetch balance, returning stored value', { error });

        return {
          booked: account.bookedBalance?.toNumber() || 0,
          available: account.availableBalance?.toNumber() || null,
          creditLimit: account.creditLimit?.toNumber() || null,
          currency: account.currency,
          updatedAt: account.balanceUpdatedAt?.toISOString() || account.updatedAt.toISOString()
        };
      }
    }),

  // Set low balance alert
  setAlertThreshold: protectedProcedure
    .input(SetAlertThresholdRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.db.bankAccount.findUnique({
        where: { id: input.accountId }
      });

      if (!account) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Konto nie zostało znalezione'
        });
      }

      await ctx.db.bankAccount.update({
        where: { id: input.accountId },
        data: {
          lowBalanceThreshold: input.threshold,
          lowBalanceAlertEnabled: input.enabled
        }
      });

      // Audit log
      await ctx.audit.log({
        action: 'BALANCE_ALERT_CONFIGURED',
        resourceType: 'BANK_ACCOUNT',
        resourceId: input.accountId,
        organizationId: account.organizationId,
        metadata: { threshold: input.threshold, enabled: input.enabled }
      });

      return { success: true };
    }),

  // Get balance history
  getBalanceHistory: protectedProcedure
    .input(GetBalanceHistoryRequestSchema)
    .output(z.array(BalanceHistoryEntrySchema))
    .query(async ({ ctx, input }) => {
      const history = await ctx.db.accountBalanceHistory.findMany({
        where: {
          accountId: input.accountId,
          createdAt: {
            gte: new Date(input.dateFrom),
            lte: new Date(input.dateTo)
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      return history.map(entry => ({
        id: entry.id,
        accountId: entry.accountId,
        bookedBalance: entry.bookedBalance.toNumber(),
        availableBalance: entry.availableBalance?.toNumber() || null,
        currency: entry.currency,
        plnEquivalent: entry.plnEquivalent?.toNumber() || null,
        exchangeRate: entry.exchangeRate?.toNumber() || null,
        snapshotType: entry.snapshotType,
        createdAt: entry.createdAt.toISOString()
      }));
    })
});
```

### Background Jobs

```typescript
// Balance snapshot job
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class BalanceSnapshotJob {
  constructor(
    private readonly db: PrismaService,
    private readonly tokenService: TokenService,
    private readonly bankProviderFactory: BankProviderFactory,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly logger: Logger
  ) {}

  @Cron('0 0,12 * * *') // Run at 00:00 and 12:00
  async createSnapshots() {
    this.logger.log('Starting balance snapshot job');

    const accounts = await this.db.bankAccount.findMany({
      where: { status: 'ACTIVE' },
      include: { connection: true }
    });

    for (const account of accounts) {
      try {
        // Get PLN equivalent for foreign currency
        let plnEquivalent = null;
        let exchangeRate = null;

        if (account.currency !== 'PLN') {
          const rate = await this.exchangeRateService.getRate(
            account.currency,
            'PLN'
          );
          exchangeRate = rate;
          plnEquivalent = (account.bookedBalance?.toNumber() || 0) * rate;
        }

        // Create snapshot
        await this.db.accountBalanceHistory.create({
          data: {
            accountId: account.id,
            organizationId: account.organizationId,
            bookedBalance: account.bookedBalance || 0,
            availableBalance: account.availableBalance,
            creditLimit: account.creditLimit,
            currency: account.currency,
            plnEquivalent,
            exchangeRate,
            exchangeRateDate: new Date(),
            snapshotType: 'SCHEDULED'
          }
        });
      } catch (error) {
        this.logger.error(`Failed to create snapshot for account ${account.id}`, error);
      }
    }

    this.logger.log(`Completed balance snapshots for ${accounts.length} accounts`);
  }
}

// Low balance alert job
@Injectable()
export class LowBalanceAlertJob {
  @Cron('*/15 * * * *') // Every 15 minutes
  async checkBalances() {
    const accounts = await this.db.bankAccount.findMany({
      where: {
        status: 'ACTIVE',
        lowBalanceAlertEnabled: true,
        lowBalanceThreshold: { not: null }
      }
    });

    for (const account of accounts) {
      const balance = account.availableBalance || account.bookedBalance;
      const threshold = account.lowBalanceThreshold;

      if (balance && threshold && balance.lessThan(threshold)) {
        // Check if alert already triggered
        if (!account.lowBalanceAlertTriggeredAt) {
          // Trigger alert
          await this.triggerLowBalanceAlert(account);
        }
      } else if (account.lowBalanceAlertTriggeredAt) {
        // Clear alert if balance restored with buffer
        const buffer = threshold!.times(1.1); // 10% buffer
        if (balance && balance.greaterThanOrEqualTo(buffer)) {
          await this.clearLowBalanceAlert(account);
        }
      }
    }
  }

  private async triggerLowBalanceAlert(account: BankAccount) {
    // Update account
    await this.db.bankAccount.update({
      where: { id: account.id },
      data: { lowBalanceAlertTriggeredAt: new Date() }
    });

    // Send notification
    await this.notificationService.send({
      type: 'LOW_BALANCE_ALERT',
      organizationId: account.organizationId,
      title: 'Niskie saldo na koncie',
      message: `Saldo konta ${account.name} (${account.iban}) spadło poniżej progu ${account.lowBalanceThreshold} ${account.currency}`,
      priority: 'HIGH',
      metadata: {
        accountId: account.id,
        currentBalance: account.bookedBalance,
        threshold: account.lowBalanceThreshold
      }
    });

    // Audit log
    await this.audit.log({
      action: 'LOW_BALANCE_ALERT_TRIGGERED',
      resourceType: 'BANK_ACCOUNT',
      resourceId: account.id,
      organizationId: account.organizationId,
      metadata: {
        balance: account.bookedBalance,
        threshold: account.lowBalanceThreshold
      }
    });
  }

  private async clearLowBalanceAlert(account: BankAccount) {
    await this.db.bankAccount.update({
      where: { id: account.id },
      data: { lowBalanceAlertTriggeredAt: null }
    });

    await this.notificationService.send({
      type: 'BALANCE_RESTORED',
      organizationId: account.organizationId,
      title: 'Saldo przywrócone',
      message: `Saldo konta ${account.name} wróciło powyżej progu alertu`,
      priority: 'NORMAL'
    });
  }
}
```

---

## Test Specifications

### Unit Tests

```typescript
describe('BankAccountService', () => {
  describe('syncAccounts', () => {
    it('should sync accounts from bank', async () => {
      const mockBankAccounts = [
        {
          externalId: 'ext-1',
          name: 'Rachunek bieżący',
          iban: 'PL12345678901234567890123456',
          type: 'CACC',
          currency: 'PLN',
          balance: { booked: 15000, available: 14000 }
        }
      ];
      mockProvider.fetchAccounts.mockResolvedValue(mockBankAccounts);

      const result = await service.syncAccounts({ connectionId: 'conn-123' });

      expect(result.success).toBe(true);
      expect(result.accountCount).toBe(1);
      expect(mockDb.bankAccount.upsert).toHaveBeenCalled();
    });

    it('should reject inactive connection', async () => {
      mockDb.bankConnection.findUnique.mockResolvedValue({
        id: 'conn-123',
        status: 'EXPIRED'
      });

      await expect(service.syncAccounts({ connectionId: 'conn-123' }))
        .rejects.toThrow('Połączenie nie jest aktywne');
    });
  });

  describe('getBalance', () => {
    it('should return cached balance', async () => {
      const cached = {
        booked: 15000,
        available: 14000,
        currency: 'PLN',
        updatedAt: new Date().toISOString()
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getBalance({
        accountId: 'acc-123',
        forceRefresh: false
      });

      expect(result).toEqual(cached);
      expect(mockProvider.fetchBalance).not.toHaveBeenCalled();
    });

    it('should fetch fresh balance when force refresh', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockProvider.fetchBalance.mockResolvedValue({
        booked: 16000,
        available: 15000
      });

      const result = await service.getBalance({
        accountId: 'acc-123',
        forceRefresh: true
      });

      expect(result.booked).toBe(16000);
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });

  describe('getAggregation', () => {
    it('should aggregate accounts from multiple banks', async () => {
      mockDb.bankAccount.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          bookedBalance: new Decimal(10000),
          currency: 'PLN',
          connection: { bankId: 'pko', bankName: 'PKO' }
        },
        {
          id: 'acc-2',
          bookedBalance: new Decimal(5000),
          currency: 'PLN',
          connection: { bankId: 'mbank', bankName: 'mBank' }
        }
      ]);

      const result = await service.getAggregation({ organizationId: 'org-123' });

      expect(result.accounts).toHaveLength(2);
      expect(result.totalsByBank).toHaveLength(2);
      expect(result.grandTotal.totalPLN).toBe(15000);
    });

    it('should convert foreign currency to PLN', async () => {
      mockDb.bankAccount.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          bookedBalance: new Decimal(1000),
          currency: 'EUR',
          connection: { bankId: 'pko', bankName: 'PKO' }
        }
      ]);
      mockExchangeRateService.getRate.mockResolvedValue(4.35);

      const result = await service.getAggregation({ organizationId: 'org-123' });

      expect(result.grandTotal.totalPLN).toBe(4350);
    });
  });
});

describe('LowBalanceAlertJob', () => {
  it('should trigger alert when balance below threshold', async () => {
    mockDb.bankAccount.findMany.mockResolvedValue([{
      id: 'acc-123',
      bookedBalance: new Decimal(4500),
      lowBalanceThreshold: new Decimal(5000),
      lowBalanceAlertEnabled: true,
      lowBalanceAlertTriggeredAt: null
    }]);

    await job.checkBalances();

    expect(mockNotificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'LOW_BALANCE_ALERT'
      })
    );
  });

  it('should clear alert when balance restored', async () => {
    mockDb.bankAccount.findMany.mockResolvedValue([{
      id: 'acc-123',
      bookedBalance: new Decimal(6000),
      lowBalanceThreshold: new Decimal(5000),
      lowBalanceAlertEnabled: true,
      lowBalanceAlertTriggeredAt: new Date()
    }]);

    await job.checkBalances();

    expect(mockDb.bankAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lowBalanceAlertTriggeredAt: null }
      })
    );
  });
});
```

---

## Security Checklist

- [x] **Authorization**: Organization isolation via RLS policies
- [x] **Data Validation**: Zod schemas for all inputs
- [x] **Caching**: Balance cached with 60s TTL to prevent API abuse
- [x] **Error Handling**: Graceful fallback to stored balance on API errors
- [x] **Audit Trail**: All balance operations logged
- [x] **Data Masking**: Account numbers masked in logs

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| `ACCOUNTS_SYNCED` | Account sync completed | connection_id, account_count |
| `BALANCE_FETCHED` | Balance refresh | account_id, source (cache/api) |
| `BALANCE_ALERT_CONFIGURED` | Threshold set | account_id, threshold, enabled |
| `LOW_BALANCE_ALERT_TRIGGERED` | Balance below threshold | account_id, balance, threshold |
| `BALANCE_RESTORED` | Balance above threshold | account_id, balance |

---

## Dependencies

- **BNK-001**: Bank Connection Management (required for account sync)
- **Exchange Rate Service**: For foreign currency conversion

---

## Implementation Notes

### Account Type Mapping

```typescript
function mapAccountType(bankType: string): AccountType {
  const mapping: Record<string, AccountType> = {
    'CACC': 'CHECKING',    // Current Account
    'SVGS': 'SAVINGS',     // Savings Account
    'CARD': 'CREDIT',      // Card Account
    'LOAN': 'LOAN',        // Loan Account
    'TRAN': 'CHECKING',    // Transaction Account
    'OTHR': 'INVESTMENT',  // Other
  };
  return mapping[bankType] || 'CHECKING';
}
```

### NBP Exchange Rate Integration

```typescript
// Fetch from NBP API
async function getNBPRate(currency: string): Promise<number> {
  const response = await fetch(
    `https://api.nbp.pl/api/exchangerates/rates/a/${currency}/?format=json`
  );
  const data = await response.json();
  return data.rates[0].mid;
}
```

---

*Last updated: December 2024*
