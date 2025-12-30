# ACC-001: Chart of Accounts Management

> **Story ID**: ACC-001
> **Title**: Chart of Accounts Management
> **Epic**: Accounting Engine (ACC)
> **Priority**: P0
> **Points**: 13
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant managing client books,
**I want to** create and manage a chart of accounts,
**So that** I can organize financial transactions according to Polish accounting standards.

---

## Acceptance Criteria

### AC1: Create Account
```gherkin
Feature: Create Chart of Account

Scenario: Create a new account with valid data
  Given I am logged in as an accountant
  And I have access to organization "Test Biuro"
  When I create a new account with:
    | Field         | Value                    |
    | accountCode   | 100                      |
    | accountName   | Kasa                     |
    | accountType   | CASH                     |
    | normalBalance | DEBIT                    |
    | currency      | PLN                      |
  Then the account should be created successfully
  And the account should have a unique ID
  And an audit log entry should be created

Scenario: Reject duplicate account code
  Given an account with code "100" exists
  When I try to create another account with code "100"
  Then I should receive an error "Account code already exists"
  And no new account should be created

Scenario: Validate account code format
  Given I am creating a new account
  When I enter account code "ABC"
  Then I should receive an error "Account code must be numeric"
```

### AC2: List and Search Accounts
```gherkin
Feature: List Chart of Accounts

Scenario: View all accounts
  Given the organization has 50 accounts
  When I request the chart of accounts
  Then I should see all 50 accounts
  And accounts should be sorted by accountCode

Scenario: Filter by account type
  Given accounts exist with types CASH, REVENUE, EXPENSE
  When I filter by accountType "CASH"
  Then I should only see accounts of type CASH

Scenario: Search by name
  Given accounts "Kasa", "Bank PKO", "Bank mBank" exist
  When I search for "Bank"
  Then I should see "Bank PKO" and "Bank mBank"
  And I should not see "Kasa"
```

### AC3: Update Account
```gherkin
Feature: Update Chart of Account

Scenario: Update account name
  Given an account "100 - Kasa" exists
  When I update the name to "Kasa główna"
  Then the account name should be "Kasa główna"
  And an audit log entry should record the change

Scenario: Prevent changing account type with postings
  Given account "100" has journal entries posted
  When I try to change accountType from CASH to RECEIVABLES
  Then I should receive an error "Cannot change type of account with postings"

Scenario: Prevent changing account code
  Given an account with code "100" exists
  When I try to change the code to "101"
  Then I should receive an error "Account code cannot be changed"
```

### AC4: Deactivate Account
```gherkin
Feature: Deactivate Account

Scenario: Deactivate unused account
  Given account "999" has no journal entries
  When I deactivate account "999"
  Then the account should be marked as inactive
  And the account should not appear in active accounts list
  And the account should still be visible in reports

Scenario: Prevent deactivating account with balance
  Given account "100" has a non-zero balance
  When I try to deactivate account "100"
  Then I should receive an error "Cannot deactivate account with non-zero balance"
```

---

## Technical Specification

### Database Schema

```sql
-- Chart of Accounts table
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Account identification
  account_code VARCHAR(20) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_name_en VARCHAR(255), -- Optional English name

  -- Classification
  account_type VARCHAR(50) NOT NULL,
  account_class INTEGER, -- Polish account class (0-9)
  account_group VARCHAR(100), -- For hierarchy
  parent_account_id UUID REFERENCES chart_of_accounts(id),

  -- Behavior
  normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
  currency VARCHAR(3) NOT NULL DEFAULT 'PLN',
  is_multi_currency BOOLEAN DEFAULT FALSE,

  -- Control
  is_active BOOLEAN DEFAULT TRUE,
  is_system_account BOOLEAN DEFAULT FALSE, -- Cannot be deleted
  allows_posting BOOLEAN DEFAULT TRUE, -- Some summary accounts don't

  -- Metadata
  description TEXT,
  tax_category VARCHAR(50), -- For VAT/CIT reporting
  jpk_symbol VARCHAR(50), -- For JPK-KR mapping

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),

  -- Constraints
  UNIQUE(organization_id, account_code),
  CHECK (account_code ~ '^[0-9]{1,20}$')
);

-- Enable RLS
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization's accounts"
  ON chart_of_accounts FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Accountants can manage accounts"
  ON chart_of_accounts FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_users
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'senior_accountant', 'accountant')
  ));

-- Indexes
CREATE INDEX idx_coa_org_code ON chart_of_accounts(organization_id, account_code);
CREATE INDEX idx_coa_org_type ON chart_of_accounts(organization_id, account_type);
CREATE INDEX idx_coa_org_active ON chart_of_accounts(organization_id, is_active);
CREATE INDEX idx_coa_parent ON chart_of_accounts(parent_account_id);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Account types per Polish regulations
export const AccountTypeEnum = z.enum([
  'FIXED_ASSETS',      // Aktywa trwałe (klasa 0)
  'CURRENT_ASSETS',    // Aktywa obrotowe
  'INVENTORY',         // Zapasy (klasa 3)
  'RECEIVABLES',       // Należności (klasa 2)
  'CASH',              // Środki pieniężne (klasa 1)
  'PREPAYMENTS',       // Rozliczenia międzyokresowe
  'EQUITY',            // Kapitały własne (klasa 8)
  'PROVISIONS',        // Rezerwy
  'LIABILITIES',       // Zobowiązania (klasa 2)
  'ACCRUALS',          // Rozliczenia międzyokresowe bierne
  'REVENUE',           // Przychody (klasa 7)
  'EXPENSE',           // Koszty ogólne
  'COST_BY_TYPE',      // Koszty rodzajowe (klasa 4)
  'COST_BY_FUNCTION',  // Koszty wg miejsc (klasa 5)
  'TAXES_SETTLEMENTS', // Rozrachunki publicznoprawne
  'OFF_BALANCE',       // Konta pozabilansowe
]);

export const NormalBalanceEnum = z.enum(['DEBIT', 'CREDIT']);

// Create account input
export const CreateAccountInput = z.object({
  accountCode: z
    .string()
    .min(1, 'Account code is required')
    .max(20, 'Account code too long')
    .regex(/^[0-9]+$/, 'Account code must be numeric'),

  accountName: z
    .string()
    .min(1, 'Account name is required')
    .max(255, 'Account name too long'),

  accountNameEn: z.string().max(255).optional(),

  accountType: AccountTypeEnum,

  accountClass: z
    .number()
    .int()
    .min(0)
    .max(9)
    .optional(),

  accountGroup: z.string().max(100).optional(),

  parentAccountId: z.string().uuid().optional(),

  normalBalance: NormalBalanceEnum,

  currency: z
    .string()
    .length(3)
    .default('PLN'),

  isMultiCurrency: z.boolean().default(false),

  allowsPosting: z.boolean().default(true),

  description: z.string().optional(),

  taxCategory: z.string().max(50).optional(),

  jpkSymbol: z.string().max(50).optional(),
});

export type CreateAccountInput = z.infer<typeof CreateAccountInput>;

// Update account input (more restrictive)
export const UpdateAccountInput = z.object({
  accountName: z.string().min(1).max(255).optional(),
  accountNameEn: z.string().max(255).optional().nullable(),
  accountGroup: z.string().max(100).optional().nullable(),
  parentAccountId: z.string().uuid().optional().nullable(),
  allowsPosting: z.boolean().optional(),
  description: z.string().optional().nullable(),
  taxCategory: z.string().max(50).optional().nullable(),
  jpkSymbol: z.string().max(50).optional().nullable(),
});

// Account output
export const AccountOutput = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  accountCode: z.string(),
  accountName: z.string(),
  accountNameEn: z.string().nullable(),
  accountType: AccountTypeEnum,
  accountClass: z.number().nullable(),
  accountGroup: z.string().nullable(),
  parentAccountId: z.string().uuid().nullable(),
  normalBalance: NormalBalanceEnum,
  currency: z.string(),
  isMultiCurrency: z.boolean(),
  isActive: z.boolean(),
  isSystemAccount: z.boolean(),
  allowsPosting: z.boolean(),
  description: z.string().nullable(),
  taxCategory: z.string().nullable(),
  jpkSymbol: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// List/filter input
export const ListAccountsInput = z.object({
  accountType: AccountTypeEnum.optional(),
  isActive: z.boolean().optional(),
  parentAccountId: z.string().uuid().optional().nullable(),
  search: z.string().optional(),
  includeChildren: z.boolean().default(false),
});
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  CreateAccountInput,
  UpdateAccountInput,
  ListAccountsInput
} from './schemas';

export const accountingRouter = router({
  // Create a new account
  createAccount: protectedProcedure
    .input(CreateAccountInput)
    .mutation(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      // Check for duplicate account code
      const existing = await ctx.db.chartOfAccounts.findFirst({
        where: {
          organizationId,
          accountCode: input.accountCode,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Account code already exists',
        });
      }

      // Validate parent account if provided
      if (input.parentAccountId) {
        const parent = await ctx.db.chartOfAccounts.findFirst({
          where: {
            id: input.parentAccountId,
            organizationId,
          },
        });

        if (!parent) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Parent account not found',
          });
        }
      }

      // Auto-determine account class from code
      const accountClass = parseInt(input.accountCode[0], 10);

      const account = await ctx.db.chartOfAccounts.create({
        data: {
          organizationId,
          ...input,
          accountClass,
          createdBy: ctx.session.userId,
        },
      });

      // Audit log
      await ctx.audit.log({
        action: 'ACCOUNT_CREATED',
        entityType: 'CHART_OF_ACCOUNTS',
        entityId: account.id,
        details: { accountCode: input.accountCode, accountName: input.accountName },
      });

      return account;
    }),

  // Get accounts with filtering
  getAccounts: protectedProcedure
    .input(ListAccountsInput)
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      const where: any = {
        organizationId,
      };

      if (input.accountType) {
        where.accountType = input.accountType;
      }

      if (input.isActive !== undefined) {
        where.isActive = input.isActive;
      }

      if (input.parentAccountId !== undefined) {
        where.parentAccountId = input.parentAccountId;
      }

      if (input.search) {
        where.OR = [
          { accountCode: { contains: input.search } },
          { accountName: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      const accounts = await ctx.db.chartOfAccounts.findMany({
        where,
        orderBy: { accountCode: 'asc' },
        include: input.includeChildren ? { children: true } : undefined,
      });

      return accounts;
    }),

  // Get single account
  getAccount: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const account = await ctx.db.chartOfAccounts.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.session.organizationId,
        },
        include: {
          parent: true,
          children: true,
        },
      });

      if (!account) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found',
        });
      }

      return account;
    }),

  // Update account
  updateAccount: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: UpdateAccountInput,
    }))
    .mutation(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      const existing = await ctx.db.chartOfAccounts.findFirst({
        where: { id: input.id, organizationId },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found',
        });
      }

      // Store old values for audit
      const oldValues = { ...existing };

      const updated = await ctx.db.chartOfAccounts.update({
        where: { id: input.id },
        data: {
          ...input.data,
          updatedAt: new Date(),
          updatedBy: ctx.session.userId,
        },
      });

      // Audit log with changes
      await ctx.audit.log({
        action: 'ACCOUNT_UPDATED',
        entityType: 'CHART_OF_ACCOUNTS',
        entityId: input.id,
        details: {
          changes: ctx.audit.diff(oldValues, updated),
        },
      });

      return updated;
    }),

  // Deactivate account
  deactivateAccount: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      const account = await ctx.db.chartOfAccounts.findFirst({
        where: { id: input.id, organizationId },
      });

      if (!account) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found',
        });
      }

      if (account.isSystemAccount) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot deactivate system account',
        });
      }

      // Check for non-zero balance
      const balance = await ctx.db.accountBalance.findFirst({
        where: { accountId: input.id },
        orderBy: { periodEnd: 'desc' },
      });

      if (balance && !balance.closingBalance.equals(0)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot deactivate account with non-zero balance',
        });
      }

      const updated = await ctx.db.chartOfAccounts.update({
        where: { id: input.id },
        data: {
          isActive: false,
          updatedAt: new Date(),
          updatedBy: ctx.session.userId,
        },
      });

      await ctx.audit.log({
        action: 'ACCOUNT_DEACTIVATED',
        entityType: 'CHART_OF_ACCOUNTS',
        entityId: input.id,
      });

      return updated;
    }),
});
```

---

## Test Specifications

### Unit Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { AccountingService } from '@/services/accounting';
import { createMockContext } from '@/test/utils';

describe('AccountingService - Chart of Accounts', () => {
  let service: AccountingService;
  let mockContext: MockContext;

  beforeEach(() => {
    mockContext = createMockContext();
    service = new AccountingService(mockContext);
  });

  describe('createAccount', () => {
    it('should create account with valid data', async () => {
      const input = {
        accountCode: '100',
        accountName: 'Kasa',
        accountType: 'CASH',
        normalBalance: 'DEBIT',
        currency: 'PLN',
      };

      const result = await service.createAccount(input);

      expect(result).toBeDefined();
      expect(result.accountCode).toBe('100');
      expect(result.accountClass).toBe(1); // Auto-determined from first digit
    });

    it('should reject duplicate account code', async () => {
      mockContext.db.chartOfAccounts.findFirst.mockResolvedValueOnce({
        id: 'existing-id',
        accountCode: '100',
      });

      const input = {
        accountCode: '100',
        accountName: 'Duplicate',
        accountType: 'CASH',
        normalBalance: 'DEBIT',
      };

      await expect(service.createAccount(input)).rejects.toThrow(
        'Account code already exists'
      );
    });

    it('should reject non-numeric account code', async () => {
      const input = {
        accountCode: 'ABC',
        accountName: 'Invalid',
        accountType: 'CASH',
        normalBalance: 'DEBIT',
      };

      await expect(service.createAccount(input)).rejects.toThrow(
        'Account code must be numeric'
      );
    });

    it('should validate parent account exists', async () => {
      mockContext.db.chartOfAccounts.findFirst.mockResolvedValueOnce(null);

      const input = {
        accountCode: '101',
        accountName: 'Child Account',
        accountType: 'CASH',
        normalBalance: 'DEBIT',
        parentAccountId: 'non-existent-id',
      };

      await expect(service.createAccount(input)).rejects.toThrow(
        'Parent account not found'
      );
    });
  });

  describe('getAccounts', () => {
    it('should return accounts sorted by code', async () => {
      const mockAccounts = [
        { accountCode: '200', accountName: 'Account B' },
        { accountCode: '100', accountName: 'Account A' },
      ];
      mockContext.db.chartOfAccounts.findMany.mockResolvedValueOnce(
        mockAccounts.sort((a, b) => a.accountCode.localeCompare(b.accountCode))
      );

      const result = await service.getAccounts({});

      expect(result[0].accountCode).toBe('100');
      expect(result[1].accountCode).toBe('200');
    });

    it('should filter by account type', async () => {
      const result = await service.getAccounts({ accountType: 'CASH' });

      expect(mockContext.db.chartOfAccounts.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ accountType: 'CASH' }),
        })
      );
    });

    it('should search by name', async () => {
      const result = await service.getAccounts({ search: 'Bank' });

      expect(mockContext.db.chartOfAccounts.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ accountName: expect.any(Object) }),
            ]),
          }),
        })
      );
    });
  });

  describe('deactivateAccount', () => {
    it('should deactivate account with zero balance', async () => {
      mockContext.db.chartOfAccounts.findFirst.mockResolvedValueOnce({
        id: 'acc-1',
        isSystemAccount: false,
      });
      mockContext.db.accountBalance.findFirst.mockResolvedValueOnce({
        closingBalance: new Decimal(0),
      });

      const result = await service.deactivateAccount({ id: 'acc-1' });

      expect(result.isActive).toBe(false);
    });

    it('should reject deactivating account with balance', async () => {
      mockContext.db.chartOfAccounts.findFirst.mockResolvedValueOnce({
        id: 'acc-1',
        isSystemAccount: false,
      });
      mockContext.db.accountBalance.findFirst.mockResolvedValueOnce({
        closingBalance: new Decimal(1000),
      });

      await expect(
        service.deactivateAccount({ id: 'acc-1' })
      ).rejects.toThrow('Cannot deactivate account with non-zero balance');
    });

    it('should reject deactivating system account', async () => {
      mockContext.db.chartOfAccounts.findFirst.mockResolvedValueOnce({
        id: 'acc-1',
        isSystemAccount: true,
      });

      await expect(
        service.deactivateAccount({ id: 'acc-1' })
      ).rejects.toThrow('Cannot deactivate system account');
    });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestClient, seedTestOrganization } from '@/test/integration';

describe('Chart of Accounts API Integration', () => {
  let client: TestClient;
  let organizationId: string;

  beforeEach(async () => {
    const { org, session } = await seedTestOrganization();
    organizationId = org.id;
    client = createTestClient(session);
  });

  afterEach(async () => {
    await cleanupTestData(organizationId);
  });

  it('should create and retrieve account', async () => {
    // Create
    const created = await client.accounting.createAccount({
      accountCode: '100',
      accountName: 'Kasa',
      accountType: 'CASH',
      normalBalance: 'DEBIT',
    });

    expect(created.id).toBeDefined();

    // Retrieve
    const retrieved = await client.accounting.getAccount({ id: created.id });

    expect(retrieved.accountCode).toBe('100');
    expect(retrieved.accountName).toBe('Kasa');
  });

  it('should update account and create audit log', async () => {
    const created = await client.accounting.createAccount({
      accountCode: '100',
      accountName: 'Kasa',
      accountType: 'CASH',
      normalBalance: 'DEBIT',
    });

    await client.accounting.updateAccount({
      id: created.id,
      data: { accountName: 'Kasa główna' },
    });

    // Check audit log
    const logs = await client.audit.getLogs({
      entityType: 'CHART_OF_ACCOUNTS',
      entityId: created.id,
    });

    expect(logs).toContainEqual(
      expect.objectContaining({
        action: 'ACCOUNT_UPDATED',
      })
    );
  });

  it('should enforce organization isolation', async () => {
    // Create account in org A
    const accountA = await client.accounting.createAccount({
      accountCode: '100',
      accountName: 'Kasa Org A',
      accountType: 'CASH',
      normalBalance: 'DEBIT',
    });

    // Create different org
    const { session: sessionB } = await seedTestOrganization();
    const clientB = createTestClient(sessionB);

    // Should not be able to access org A's account
    await expect(
      clientB.accounting.getAccount({ id: accountA.id })
    ).rejects.toThrow('Account not found');
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Chart of Accounts UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'accountant@test.com');
    await page.fill('[name="password"]', 'Test123!');
    await page.click('[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create new account', async ({ page }) => {
    await page.goto('/accounting/chart-of-accounts');

    await page.click('[data-testid="add-account"]');

    await page.fill('[name="accountCode"]', '100');
    await page.fill('[name="accountName"]', 'Kasa');
    await page.selectOption('[name="accountType"]', 'CASH');
    await page.selectOption('[name="normalBalance"]', 'DEBIT');

    await page.click('[type="submit"]');

    await expect(page.locator('[data-testid="account-row-100"]')).toBeVisible();
  });

  test('should show validation error for duplicate code', async ({ page }) => {
    // Assume account 100 exists
    await page.goto('/accounting/chart-of-accounts');
    await page.click('[data-testid="add-account"]');

    await page.fill('[name="accountCode"]', '100');
    await page.fill('[name="accountName"]', 'Duplicate');
    await page.selectOption('[name="accountType"]', 'CASH');
    await page.selectOption('[name="normalBalance"]', 'DEBIT');

    await page.click('[type="submit"]');

    await expect(page.locator('.error-message')).toContainText(
      'Account code already exists'
    );
  });

  test('should search accounts', async ({ page }) => {
    await page.goto('/accounting/chart-of-accounts');

    await page.fill('[data-testid="search-input"]', 'Bank');

    await expect(page.locator('[data-testid="account-row"]')).toHaveCount(2);
  });
});
```

---

## Security Checklist

- [x] RLS policies defined for chart_of_accounts table
- [x] Organization isolation enforced at database level
- [x] Only authorized roles can create/modify accounts
- [x] System accounts cannot be deleted
- [x] Audit logging for all mutations
- [x] Input validation with Zod schemas
- [x] No PII stored in account data
- [x] Account codes cannot be changed after creation

---

## Audit Events

| Event | Trigger | Data Captured |
|-------|---------|---------------|
| ACCOUNT_CREATED | New account created | accountCode, accountName, accountType, createdBy |
| ACCOUNT_UPDATED | Account modified | Field changes diff, updatedBy |
| ACCOUNT_DEACTIVATED | Account deactivated | accountId, deactivatedBy |
| ACCOUNT_REACTIVATED | Account reactivated | accountId, reactivatedBy |

---

## Implementation Notes

### Polish Account Classes
```
0 - Aktywa trwałe (Fixed Assets)
1 - Środki pieniężne, rachunki bankowe (Cash and Bank)
2 - Rozrachunki i roszczenia (Settlements and Claims)
3 - Materiały i towary (Inventory)
4 - Koszty wg rodzajów (Costs by Type)
5 - Koszty wg typów działalności (Costs by Activity)
6 - Produkty i rozliczenia międzyokresowe (Products and Accruals)
7 - Przychody i koszty związane z ich osiągnięciem (Revenue)
8 - Kapitały, fundusze, rezerwy i wynik (Equity and Results)
9 - Konta pozabilansowe (Off-Balance Sheet)
```

### Normal Balance Rules
- Assets (0, 1, 2, 3): DEBIT
- Liabilities (2): CREDIT
- Equity (8): CREDIT
- Revenue (7): CREDIT
- Expenses (4, 5): DEBIT

---

## Tasks

- [ ] Create database migration
- [ ] Implement Prisma model
- [ ] Create Zod validation schemas
- [ ] Implement tRPC router
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Create UI components
- [ ] Write E2E tests
- [ ] Update API documentation

---

*Last updated: December 2024*
