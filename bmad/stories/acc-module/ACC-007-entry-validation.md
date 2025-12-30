# ACC-007: Entry Validation and Balancing

> **Story ID**: ACC-007
> **Title**: Entry Validation and Balancing
> **Epic**: Accounting Engine (ACC)
> **Priority**: P0
> **Points**: 8
> **Status**: 📋 Ready for Development

---

## User Story

**As an** accountant creating journal entries,
**I want** entries to be automatically validated for balance and business rules,
**So that** I cannot post unbalanced or invalid entries to the ledger.

---

## Acceptance Criteria

### AC1: Balance Validation
```gherkin
Feature: Entry Balance Validation

Scenario: Validate balanced entry
  Given I create an entry with:
    | Account     | Debit  | Credit |
    | 100 - Kasa  | 1000   |        |
    | 200 - Bank  |        | 1000   |
  When I save the entry
  Then the entry should pass balance validation
  And status indicator should show "Balanced"

Scenario: Reject unbalanced entry on posting
  Given I create an entry with:
    | Account     | Debit  | Credit |
    | 100 - Kasa  | 1000   |        |
    | 200 - Bank  |        | 900    |
  When I try to post the entry
  Then I should see error "Entry is out of balance by 100.00"
  And the entry should remain in draft status

Scenario: Real-time balance indicator
  Given I am adding lines to a journal entry
  When total debits are 1500 and total credits are 1200
  Then I should see balance indicator "Debits > Credits by 300.00"
  And the indicator should be highlighted in red
```

### AC2: Account Validation
```gherkin
Feature: Account Validation

Scenario: Prevent posting to header account
  Given account "1 - Aktywa" is a header account (allowsPosting = false)
  When I try to create a line with this account
  Then I should see error "Cannot post to header account"

Scenario: Prevent posting to inactive account
  Given account "150 - Old Cash" is inactive
  When I try to create a line with this account
  Then I should see error "Account is inactive"

Scenario: Validate account exists
  Given I enter account code "999"
  When account "999" does not exist
  Then I should see error "Account not found"
```

### AC3: Period Validation
```gherkin
Feature: Period Validation

Scenario: Validate entry date has open period
  Given I create an entry dated "2024-01-15"
  And period "January 2024" is open
  When I save the entry
  Then the entry should be assigned to January 2024 period

Scenario: Warn on soft-closed period
  Given I create an entry dated "2024-01-15"
  And period "January 2024" is soft-closed
  When I try to post the entry
  Then I should see warning "Period is soft-closed. Continue?"
  And I should be able to proceed with override

Scenario: Block posting to closed period
  Given I create an entry dated "2023-12-15"
  And period "December 2023" is closed
  When I try to post the entry
  Then I should see error "Cannot post to closed period"
  And the entry should not be posted
```

### AC4: Multi-Currency Validation
```gherkin
Feature: Multi-Currency Validation

Scenario: Convert foreign currency to base
  Given base currency is PLN
  When I create a line with 1000 EUR at rate 4.35
  Then base currency amount should be 4350 PLN
  And both amounts should be stored

Scenario: Validate balance in base currency
  Given entry with mixed currencies:
    | Account | Amount | Currency | Rate |
    | 100     | 1000   | EUR      | 4.35 |
    | 200     |        | 4350 PLN | 1.00 |
  When validating balance
  Then entry should be balanced in PLN (4350 = 4350)
```

### AC5: Business Rule Validation
```gherkin
Feature: Business Rules

Scenario: Validate VAT posting rules
  Given I create an entry with VAT
  When VAT account is debited without corresponding expense
  Then I should see warning "VAT posting without corresponding transaction"

Scenario: Validate cost center requirement
  Given account "501 - Koszty" requires cost center
  When I create a line without cost center
  Then I should see error "Cost center required for this account"

Scenario: Validate minimum amounts
  Given organization has minimum posting amount of 0.01
  When I create a line with amount 0.00
  Then I should see error "Amount must be greater than 0"
```

---

## Technical Specification

### Database Schema

```sql
-- Validation rules table
CREATE TABLE validation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Rule identification
  rule_code VARCHAR(50) NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(30) NOT NULL,
  -- BALANCE, ACCOUNT, PERIOD, CURRENCY, BUSINESS

  -- Rule configuration
  is_active BOOLEAN DEFAULT TRUE,
  severity VARCHAR(20) NOT NULL DEFAULT 'ERROR',
  -- ERROR (blocks), WARNING (warns), INFO (informs)

  -- Rule definition (JSON for flexibility)
  conditions JSONB NOT NULL,
  -- e.g., {"account_type": "EXPENSE", "requires": ["cost_center"]}

  error_message TEXT NOT NULL,

  -- Scope
  applies_to_entry_types TEXT[], -- NULL = all types

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_rule_type CHECK (rule_type IN (
    'BALANCE', 'ACCOUNT', 'PERIOD', 'CURRENCY', 'BUSINESS', 'CUSTOM'
  )),
  CONSTRAINT valid_severity CHECK (severity IN ('ERROR', 'WARNING', 'INFO')),
  UNIQUE(organization_id, rule_code)
);

-- Validation results (stored for audit)
CREATE TABLE validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  validated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  validated_by UUID REFERENCES users(id),

  -- Overall result
  is_valid BOOLEAN NOT NULL,
  can_post BOOLEAN NOT NULL, -- No errors blocking post

  -- Results detail
  results JSONB NOT NULL,
  -- Array of { rule_code, passed, severity, message }

  error_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  info_count INTEGER NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX idx_validation_rules_org ON validation_rules(organization_id);
CREATE INDEX idx_validation_rules_type ON validation_rules(rule_type);
CREATE INDEX idx_validation_results_entry ON validation_results(entry_id);
```

### Zod Schemas

```typescript
import { z } from 'zod';

// Validation severity levels
export const SeverityEnum = z.enum(['ERROR', 'WARNING', 'INFO']);
export const RuleTypeEnum = z.enum([
  'BALANCE', 'ACCOUNT', 'PERIOD', 'CURRENCY', 'BUSINESS', 'CUSTOM'
]);

// Validation rule schema
export const ValidationRuleSchema = z.object({
  id: z.string().uuid(),
  ruleCode: z.string(),
  ruleName: z.string(),
  ruleType: RuleTypeEnum,
  isActive: z.boolean(),
  severity: SeverityEnum,
  conditions: z.record(z.any()),
  errorMessage: z.string(),
  appliesToEntryTypes: z.array(z.string()).nullable(),
});

// Single validation result
export const ValidationResultItemSchema = z.object({
  ruleCode: z.string(),
  ruleName: z.string(),
  passed: z.boolean(),
  severity: SeverityEnum,
  message: z.string(),
  details: z.record(z.any()).optional(),
});

// Full validation response
export const ValidationResponseSchema = z.object({
  isValid: z.boolean(),
  canPost: z.boolean(), // No blocking errors
  results: z.array(ValidationResultItemSchema),
  summary: z.object({
    totalRules: z.number(),
    passed: z.number(),
    errors: z.number(),
    warnings: z.number(),
    infos: z.number(),
  }),
  balanceInfo: z.object({
    totalDebits: z.number(),
    totalCredits: z.number(),
    difference: z.number(),
    isBalanced: z.boolean(),
    currency: z.string(),
  }),
});

// Create custom rule
export const CreateValidationRuleInput = z.object({
  ruleCode: z.string().min(1).max(50),
  ruleName: z.string().min(1).max(255),
  ruleType: RuleTypeEnum,
  severity: SeverityEnum.default('ERROR'),
  conditions: z.record(z.any()),
  errorMessage: z.string().min(1),
  appliesToEntryTypes: z.array(z.string()).optional(),
});

// Validate entry input
export const ValidateEntryInput = z.object({
  entryId: z.string().uuid().optional(),
  // Or inline entry data for pre-save validation
  entryData: z.object({
    entryDate: z.coerce.date(),
    entryType: z.string(),
    lines: z.array(z.object({
      accountId: z.string().uuid(),
      debitAmount: z.number(),
      creditAmount: z.number(),
      currency: z.string().default('PLN'),
      exchangeRate: z.number().default(1),
      costCenterId: z.string().uuid().optional(),
    })),
  }).optional(),
});

export type ValidationRule = z.infer<typeof ValidationRuleSchema>;
export type ValidationResultItem = z.infer<typeof ValidationResultItemSchema>;
export type ValidationResponse = z.infer<typeof ValidationResponseSchema>;
```

### Validation Engine

```typescript
import { Decimal } from 'decimal.js';

interface ValidationContext {
  organizationId: string;
  entry: {
    id?: string;
    entryDate: Date;
    entryType: string;
    lines: EntryLine[];
  };
  accounts: Map<string, Account>;
  period: AccountingPeriod | null;
  rules: ValidationRule[];
}

interface EntryLine {
  accountId: string;
  debitAmount: number;
  creditAmount: number;
  currency: string;
  exchangeRate: number;
  costCenterId?: string;
}

interface Account {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  normalBalance: 'DEBIT' | 'CREDIT';
  isActive: boolean;
  allowsPosting: boolean;
  requiresCostCenter: boolean;
}

interface AccountingPeriod {
  id: string;
  status: 'OPEN' | 'SOFT_CLOSED' | 'CLOSED';
  periodName: string;
}

export class EntryValidationEngine {
  private context: ValidationContext;

  constructor(context: ValidationContext) {
    this.context = context;
  }

  async validate(): Promise<ValidationResponse> {
    const results: ValidationResultItem[] = [];

    // Core validations (always run)
    results.push(...this.validateBalance());
    results.push(...this.validateAccounts());
    results.push(...this.validatePeriod());
    results.push(...this.validateCurrency());

    // Custom business rules
    for (const rule of this.context.rules) {
      if (!rule.isActive) continue;
      if (rule.appliesToEntryTypes &&
          !rule.appliesToEntryTypes.includes(this.context.entry.entryType)) {
        continue;
      }

      const result = this.evaluateRule(rule);
      results.push(result);
    }

    // Calculate summary
    const summary = {
      totalRules: results.length,
      passed: results.filter(r => r.passed).length,
      errors: results.filter(r => !r.passed && r.severity === 'ERROR').length,
      warnings: results.filter(r => !r.passed && r.severity === 'WARNING').length,
      infos: results.filter(r => !r.passed && r.severity === 'INFO').length,
    };

    // Calculate balance info
    const balanceInfo = this.calculateBalanceInfo();

    return {
      isValid: summary.errors === 0 && balanceInfo.isBalanced,
      canPost: summary.errors === 0,
      results,
      summary,
      balanceInfo,
    };
  }

  private validateBalance(): ValidationResultItem[] {
    const results: ValidationResultItem[] = [];
    const balanceInfo = this.calculateBalanceInfo();

    results.push({
      ruleCode: 'CORE_BALANCE',
      ruleName: 'Entry Balance',
      passed: balanceInfo.isBalanced,
      severity: 'ERROR',
      message: balanceInfo.isBalanced
        ? 'Entry is balanced'
        : `Entry is out of balance by ${Math.abs(balanceInfo.difference).toFixed(2)} ${balanceInfo.currency}`,
      details: balanceInfo,
    });

    // Check for zero-amount entry
    if (balanceInfo.totalDebits === 0 && balanceInfo.totalCredits === 0) {
      results.push({
        ruleCode: 'CORE_ZERO_ENTRY',
        ruleName: 'Zero Amount Entry',
        passed: false,
        severity: 'ERROR',
        message: 'Entry has no amounts',
      });
    }

    return results;
  }

  private validateAccounts(): ValidationResultItem[] {
    const results: ValidationResultItem[] = [];

    for (const line of this.context.entry.lines) {
      const account = this.context.accounts.get(line.accountId);

      // Account exists
      if (!account) {
        results.push({
          ruleCode: 'CORE_ACCOUNT_EXISTS',
          ruleName: 'Account Exists',
          passed: false,
          severity: 'ERROR',
          message: `Account ${line.accountId} not found`,
          details: { accountId: line.accountId },
        });
        continue;
      }

      // Account is active
      if (!account.isActive) {
        results.push({
          ruleCode: 'CORE_ACCOUNT_ACTIVE',
          ruleName: 'Account Active',
          passed: false,
          severity: 'ERROR',
          message: `Account ${account.accountCode} - ${account.accountName} is inactive`,
          details: { accountCode: account.accountCode },
        });
      }

      // Account allows posting
      if (!account.allowsPosting) {
        results.push({
          ruleCode: 'CORE_ACCOUNT_POSTABLE',
          ruleName: 'Account Allows Posting',
          passed: false,
          severity: 'ERROR',
          message: `Cannot post to header account ${account.accountCode} - ${account.accountName}`,
          details: { accountCode: account.accountCode },
        });
      }

      // Cost center required
      if (account.requiresCostCenter && !line.costCenterId) {
        results.push({
          ruleCode: 'CORE_COST_CENTER_REQUIRED',
          ruleName: 'Cost Center Required',
          passed: false,
          severity: 'ERROR',
          message: `Cost center required for account ${account.accountCode}`,
          details: { accountCode: account.accountCode },
        });
      }

      // Validate amount > 0
      if (line.debitAmount === 0 && line.creditAmount === 0) {
        results.push({
          ruleCode: 'CORE_LINE_AMOUNT',
          ruleName: 'Line Amount',
          passed: false,
          severity: 'ERROR',
          message: `Line for ${account.accountCode} has zero amount`,
          details: { accountCode: account.accountCode },
        });
      }
    }

    return results;
  }

  private validatePeriod(): ValidationResultItem[] {
    const results: ValidationResultItem[] = [];
    const { period } = this.context;

    if (!period) {
      results.push({
        ruleCode: 'CORE_PERIOD_EXISTS',
        ruleName: 'Period Exists',
        passed: false,
        severity: 'ERROR',
        message: 'No accounting period found for entry date',
        details: { entryDate: this.context.entry.entryDate },
      });
      return results;
    }

    if (period.status === 'CLOSED') {
      results.push({
        ruleCode: 'CORE_PERIOD_OPEN',
        ruleName: 'Period Open',
        passed: false,
        severity: 'ERROR',
        message: `Cannot post to closed period: ${period.periodName}`,
        details: { periodName: period.periodName },
      });
    } else if (period.status === 'SOFT_CLOSED') {
      results.push({
        ruleCode: 'CORE_PERIOD_SOFT_CLOSED',
        ruleName: 'Period Soft Closed',
        passed: true, // Not blocking, but warning
        severity: 'WARNING',
        message: `Period ${period.periodName} is soft-closed. Posting requires override.`,
        details: { periodName: period.periodName },
      });
    } else {
      results.push({
        ruleCode: 'CORE_PERIOD_OPEN',
        ruleName: 'Period Open',
        passed: true,
        severity: 'INFO',
        message: `Posting to open period: ${period.periodName}`,
      });
    }

    return results;
  }

  private validateCurrency(): ValidationResultItem[] {
    const results: ValidationResultItem[] = [];

    // Check for consistent currency handling
    const currencies = new Set(this.context.entry.lines.map(l => l.currency));

    if (currencies.size > 1) {
      results.push({
        ruleCode: 'CORE_MULTI_CURRENCY',
        ruleName: 'Multi-Currency Entry',
        passed: true,
        severity: 'INFO',
        message: `Entry uses multiple currencies: ${Array.from(currencies).join(', ')}`,
        details: { currencies: Array.from(currencies) },
      });

      // Validate exchange rates for non-base currencies
      for (const line of this.context.entry.lines) {
        if (line.currency !== 'PLN' && line.exchangeRate === 1) {
          results.push({
            ruleCode: 'CORE_EXCHANGE_RATE',
            ruleName: 'Exchange Rate',
            passed: false,
            severity: 'WARNING',
            message: `Exchange rate for ${line.currency} should not be 1.0`,
            details: { currency: line.currency, rate: line.exchangeRate },
          });
        }
      }
    }

    return results;
  }

  private evaluateRule(rule: ValidationRule): ValidationResultItem {
    const { conditions } = rule;

    try {
      let passed = true;
      let message = '';

      switch (rule.ruleType) {
        case 'BUSINESS':
          passed = this.evaluateBusinessRule(conditions);
          break;
        case 'CUSTOM':
          passed = this.evaluateCustomRule(conditions);
          break;
        default:
          // Other types handled by core validations
          passed = true;
      }

      return {
        ruleCode: rule.ruleCode,
        ruleName: rule.ruleName,
        passed,
        severity: rule.severity,
        message: passed ? `Passed: ${rule.ruleName}` : rule.errorMessage,
      };
    } catch (error) {
      return {
        ruleCode: rule.ruleCode,
        ruleName: rule.ruleName,
        passed: false,
        severity: 'WARNING',
        message: `Rule evaluation error: ${error.message}`,
      };
    }
  }

  private evaluateBusinessRule(conditions: Record<string, any>): boolean {
    // Example business rules:

    // 1. VAT account requires corresponding expense
    if (conditions.rule === 'vat_with_expense') {
      const hasVat = this.context.entry.lines.some(l => {
        const account = this.context.accounts.get(l.accountId);
        return account?.accountCode.startsWith('22'); // VAT accounts
      });

      const hasExpense = this.context.entry.lines.some(l => {
        const account = this.context.accounts.get(l.accountId);
        return ['EXPENSE', 'COST_BY_TYPE', 'COST_BY_FUNCTION']
          .includes(account?.accountType || '');
      });

      if (hasVat && !hasExpense) {
        return false;
      }
    }

    // 2. Intercompany accounts must have matching entries
    if (conditions.rule === 'intercompany_match') {
      // Implementation for intercompany validation
    }

    // 3. Large amount entries require approval
    if (conditions.rule === 'large_amount_approval') {
      const threshold = conditions.threshold || 10000;
      const maxAmount = Math.max(
        ...this.context.entry.lines.map(l =>
          Math.max(l.debitAmount, l.creditAmount)
        )
      );
      return maxAmount < threshold;
    }

    return true;
  }

  private evaluateCustomRule(conditions: Record<string, any>): boolean {
    // Custom rule evaluation using expression parser
    // This allows organizations to define their own rules

    const { expression, params } = conditions;

    // Example: Evaluate simple expressions
    // expression: "line.debitAmount < params.maxAmount"
    // params: { maxAmount: 50000 }

    // For security, use a safe expression evaluator
    // not eval()

    return true; // Placeholder
  }

  private calculateBalanceInfo() {
    const totals = this.context.entry.lines.reduce(
      (acc, line) => {
        const debitBase = new Decimal(line.debitAmount).times(line.exchangeRate);
        const creditBase = new Decimal(line.creditAmount).times(line.exchangeRate);

        return {
          debits: acc.debits.plus(debitBase),
          credits: acc.credits.plus(creditBase),
        };
      },
      { debits: new Decimal(0), credits: new Decimal(0) }
    );

    const difference = totals.debits.minus(totals.credits);

    return {
      totalDebits: totals.debits.toNumber(),
      totalCredits: totals.credits.toNumber(),
      difference: difference.toNumber(),
      isBalanced: difference.abs().lessThanOrEqualTo(0.01), // Allow 1 cent tolerance
      currency: 'PLN', // Base currency
    };
  }
}
```

### tRPC Router

```typescript
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  ValidateEntryInput,
  CreateValidationRuleInput,
} from './schemas';
import { EntryValidationEngine } from './validation-engine';

export const validationRouter = router({
  // Validate entry (existing or inline)
  validateEntry: protectedProcedure
    .input(ValidateEntryInput)
    .mutation(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      let entry: any;
      let lines: any[];

      if (input.entryId) {
        // Validate existing entry
        entry = await ctx.db.journalEntries.findFirst({
          where: { id: input.entryId, organizationId },
          include: { lines: true },
        });

        if (!entry) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Entry not found',
          });
        }

        lines = entry.lines;
      } else if (input.entryData) {
        // Validate inline data (pre-save)
        entry = {
          entryDate: input.entryData.entryDate,
          entryType: input.entryData.entryType,
        };
        lines = input.entryData.lines;
      } else {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Must provide entryId or entryData',
        });
      }

      // Fetch required data
      const accountIds = lines.map(l => l.accountId);
      const accounts = await ctx.db.chartOfAccounts.findMany({
        where: { id: { in: accountIds }, organizationId },
      });

      const accountMap = new Map(accounts.map(a => [a.id, a]));

      const period = await ctx.db.accountingPeriods.findFirst({
        where: {
          organizationId,
          startDate: { lte: entry.entryDate },
          endDate: { gte: entry.entryDate },
          periodType: 'REGULAR',
        },
      });

      const rules = await ctx.db.validationRules.findMany({
        where: { organizationId, isActive: true },
      });

      // Run validation
      const engine = new EntryValidationEngine({
        organizationId,
        entry: { ...entry, lines },
        accounts: accountMap,
        period,
        rules,
      });

      const result = await engine.validate();

      // Store validation result if validating existing entry
      if (input.entryId) {
        await ctx.db.validationResults.create({
          data: {
            entryId: input.entryId,
            validatedBy: ctx.session.userId,
            isValid: result.isValid,
            canPost: result.canPost,
            results: result.results,
            errorCount: result.summary.errors,
            warningCount: result.summary.warnings,
            infoCount: result.summary.infos,
          },
        });
      }

      return result;
    }),

  // Create custom validation rule
  createRule: protectedProcedure
    .input(CreateValidationRuleInput)
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.session;

      const rule = await ctx.db.validationRules.create({
        data: {
          organizationId,
          ...input,
        },
      });

      await ctx.db.auditLogs.create({
        data: {
          organizationId,
          userId,
          action: 'VALIDATION_RULE_CREATED',
          entityType: 'VALIDATION_RULE',
          entityId: rule.id,
          newValues: { ruleCode: rule.ruleCode, ruleName: rule.ruleName },
        },
      });

      return rule;
    }),

  // Get validation rules
  getRules: protectedProcedure
    .input(z.object({
      ruleType: RuleTypeEnum.optional(),
      isActive: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      const where: any = { organizationId };
      if (input.ruleType) where.ruleType = input.ruleType;
      if (input.isActive !== undefined) where.isActive = input.isActive;

      return ctx.db.validationRules.findMany({
        where,
        orderBy: [{ ruleType: 'asc' }, { ruleCode: 'asc' }],
      });
    }),

  // Toggle rule active status
  toggleRule: protectedProcedure
    .input(z.object({ ruleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { organizationId, userId } = ctx.session;

      const rule = await ctx.db.validationRules.findFirst({
        where: { id: input.ruleId, organizationId },
      });

      if (!rule) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Rule not found',
        });
      }

      const updated = await ctx.db.validationRules.update({
        where: { id: input.ruleId },
        data: { isActive: !rule.isActive },
      });

      return updated;
    }),

  // Get validation history for entry
  getValidationHistory: protectedProcedure
    .input(z.object({ entryId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = ctx.session;

      // Verify entry belongs to org
      const entry = await ctx.db.journalEntries.findFirst({
        where: { id: input.entryId, organizationId },
      });

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Entry not found',
        });
      }

      return ctx.db.validationResults.findMany({
        where: { entryId: input.entryId },
        include: {
          validatedByUser: { select: { name: true } },
        },
        orderBy: { validatedAt: 'desc' },
      });
    }),

  // Quick balance check (lightweight)
  checkBalance: protectedProcedure
    .input(z.object({
      lines: z.array(z.object({
        debitAmount: z.number(),
        creditAmount: z.number(),
        currency: z.string().default('PLN'),
        exchangeRate: z.number().default(1),
      })),
    }))
    .query(({ input }) => {
      const totals = input.lines.reduce(
        (acc, line) => {
          const debit = new Decimal(line.debitAmount).times(line.exchangeRate);
          const credit = new Decimal(line.creditAmount).times(line.exchangeRate);
          return {
            debits: acc.debits.plus(debit),
            credits: acc.credits.plus(credit),
          };
        },
        { debits: new Decimal(0), credits: new Decimal(0) }
      );

      const difference = totals.debits.minus(totals.credits);

      return {
        totalDebits: totals.debits.toNumber(),
        totalCredits: totals.credits.toNumber(),
        difference: difference.toNumber(),
        isBalanced: difference.abs().lessThanOrEqualTo(0.01),
      };
    }),
});
```

---

## Test Specifications

### Unit Tests

```typescript
describe('Entry Validation Engine', () => {
  describe('Balance validation', () => {
    it('should pass for balanced entry', async () => {
      const engine = new EntryValidationEngine({
        organizationId: 'org-1',
        entry: {
          entryDate: new Date(),
          entryType: 'STANDARD',
          lines: [
            { accountId: 'a1', debitAmount: 1000, creditAmount: 0, currency: 'PLN', exchangeRate: 1 },
            { accountId: 'a2', debitAmount: 0, creditAmount: 1000, currency: 'PLN', exchangeRate: 1 },
          ],
        },
        accounts: mockAccountMap,
        period: mockOpenPeriod,
        rules: [],
      });

      const result = await engine.validate();
      expect(result.balanceInfo.isBalanced).toBe(true);
    });

    it('should fail for unbalanced entry', async () => {
      const engine = new EntryValidationEngine({
        organizationId: 'org-1',
        entry: {
          entryDate: new Date(),
          entryType: 'STANDARD',
          lines: [
            { accountId: 'a1', debitAmount: 1000, creditAmount: 0, currency: 'PLN', exchangeRate: 1 },
            { accountId: 'a2', debitAmount: 0, creditAmount: 900, currency: 'PLN', exchangeRate: 1 },
          ],
        },
        accounts: mockAccountMap,
        period: mockOpenPeriod,
        rules: [],
      });

      const result = await engine.validate();
      expect(result.balanceInfo.isBalanced).toBe(false);
      expect(result.balanceInfo.difference).toBe(100);
    });

    it('should balance multi-currency in base currency', async () => {
      const engine = new EntryValidationEngine({
        organizationId: 'org-1',
        entry: {
          entryDate: new Date(),
          entryType: 'STANDARD',
          lines: [
            { accountId: 'a1', debitAmount: 1000, creditAmount: 0, currency: 'EUR', exchangeRate: 4.35 },
            { accountId: 'a2', debitAmount: 0, creditAmount: 4350, currency: 'PLN', exchangeRate: 1 },
          ],
        },
        accounts: mockAccountMap,
        period: mockOpenPeriod,
        rules: [],
      });

      const result = await engine.validate();
      expect(result.balanceInfo.isBalanced).toBe(true);
    });
  });

  describe('Account validation', () => {
    it('should fail for header account', async () => {
      const accountMap = new Map([
        ['a1', { ...mockAccount, allowsPosting: false }],
      ]);

      const engine = new EntryValidationEngine({
        organizationId: 'org-1',
        entry: {
          entryDate: new Date(),
          entryType: 'STANDARD',
          lines: [
            { accountId: 'a1', debitAmount: 1000, creditAmount: 0, currency: 'PLN', exchangeRate: 1 },
          ],
        },
        accounts: accountMap,
        period: mockOpenPeriod,
        rules: [],
      });

      const result = await engine.validate();
      const accountError = result.results.find(r => r.ruleCode === 'CORE_ACCOUNT_POSTABLE');
      expect(accountError?.passed).toBe(false);
    });
  });

  describe('Period validation', () => {
    it('should fail for closed period', async () => {
      const engine = new EntryValidationEngine({
        organizationId: 'org-1',
        entry: mockEntry,
        accounts: mockAccountMap,
        period: { id: 'p1', status: 'CLOSED', periodName: 'Dec 2023' },
        rules: [],
      });

      const result = await engine.validate();
      const periodError = result.results.find(r => r.ruleCode === 'CORE_PERIOD_OPEN');
      expect(periodError?.passed).toBe(false);
    });

    it('should warn for soft-closed period', async () => {
      const engine = new EntryValidationEngine({
        organizationId: 'org-1',
        entry: mockEntry,
        accounts: mockAccountMap,
        period: { id: 'p1', status: 'SOFT_CLOSED', periodName: 'Jan 2024' },
        rules: [],
      });

      const result = await engine.validate();
      const periodWarning = result.results.find(r => r.ruleCode === 'CORE_PERIOD_SOFT_CLOSED');
      expect(periodWarning?.severity).toBe('WARNING');
      expect(result.canPost).toBe(true); // Can still post
    });
  });
});
```

### Integration Tests

```typescript
describe('Validation Router', () => {
  describe('validateEntry', () => {
    it('should validate existing entry', async () => {
      const entry = await createDraftEntry();

      const result = await caller.validation.validateEntry({
        entryId: entry.id,
      });

      expect(result.isValid).toBe(true);
      expect(result.canPost).toBe(true);
    });

    it('should validate inline entry data', async () => {
      const result = await caller.validation.validateEntry({
        entryData: {
          entryDate: new Date('2024-01-15'),
          entryType: 'STANDARD',
          lines: [
            { accountId: cashAccountId, debitAmount: 500, creditAmount: 0 },
            { accountId: bankAccountId, debitAmount: 0, creditAmount: 500 },
          ],
        },
      });

      expect(result.isValid).toBe(true);
    });

    it('should store validation history', async () => {
      const entry = await createDraftEntry();
      await caller.validation.validateEntry({ entryId: entry.id });

      const history = await caller.validation.getValidationHistory({
        entryId: entry.id,
      });

      expect(history.length).toBe(1);
    });
  });

  describe('checkBalance', () => {
    it('should return real-time balance check', async () => {
      const result = await caller.validation.checkBalance({
        lines: [
          { debitAmount: 1000, creditAmount: 0 },
          { debitAmount: 0, creditAmount: 800 },
        ],
      });

      expect(result.isBalanced).toBe(false);
      expect(result.difference).toBe(200);
    });
  });
});
```

---

## Security Checklist

- [x] Organization isolation for rules
- [x] Safe expression evaluation (no eval)
- [x] Audit logging for rule changes
- [x] Validation results stored for compliance

---

## Tasks

- [ ] Create database migrations
- [ ] Implement validation engine
- [ ] Create core validation rules
- [ ] Build business rule evaluator
- [ ] Add real-time balance indicator to UI
- [ ] Implement custom rule management
- [ ] Write tests

---

*Last updated: December 2024*
