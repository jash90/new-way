/**
 * ACC-007: Entry Validation and Balancing Service
 * Implements validation rules engine for journal entries
 *
 * TODO: The following Prisma models need to be added to the schema:
 * - ValidationRule: Stores custom validation rules for journal entries
 * - ValidationResult: Stores validation results history for entries
 *
 * Methods that depend on these missing models are currently stubbed with NotImplementedError.
 */

import { TRPCError } from '@trpc/server';
import { Decimal } from 'decimal.js';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { CORE_VALIDATION_RULES } from '@ksiegowacrm/shared';
import type {
  CreateValidationRuleInput,
  UpdateValidationRuleInput,
  GetValidationRuleInput,
  ListValidationRulesInput,
  DeleteValidationRuleInput,
  ToggleValidationRuleInput,
  ValidateEntryInput,
  CheckBalanceInput,
  GetValidationHistoryInput,
  ValidationRule as _ValidationRule,
  ListValidationRulesResult as _ListValidationRulesResult,
  ValidationResponse,
  CheckBalanceResult,
  GetValidationHistoryResult as _GetValidationHistoryResult,
  ValidationResultItem,
  BalanceInfo,
  ValidationSummary,
} from '@ksiegowacrm/shared';

// Suppress unused type imports - reserved for future implementation
void (0 as unknown as _ValidationRule);
void (0 as unknown as _ListValidationRulesResult);
void (0 as unknown as _GetValidationHistoryResult);

/**
 * Error thrown when a feature requires missing Prisma models
 */
class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

interface AuditLogger {
  log: (entry: {
    action: string;
    entityType: string;
    entityId: string;
    userId?: string;
    organizationId?: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    details?: Record<string, unknown>;
  }) => void;
}

interface EntryLine {
  id?: string;
  accountId: string;
  debitAmount: number;
  creditAmount: number;
  currency?: string;
  exchangeRate?: number;
  costCenterId?: string | null;
  description?: string | null;
}

interface EntryData {
  entryDate: Date;
  entryType: string;
  lines: EntryLine[];
}

interface Account {
  id: string;
  accountCode: string;
  accountName: string;
  isActive: boolean;
  allowsPosting: boolean;
  requiresCostCenter: boolean;
}

const BASE_CURRENCY = 'PLN';
const BALANCE_TOLERANCE = 0.01;

export class ValidationService {
  private readonly CACHE_PREFIX = 'validation-rules';
  private readonly _CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly auditLogger: AuditLogger,
    private readonly userId: string,
    private readonly organizationId: string
  ) {
    // Suppress unused warnings - reserved for future caching implementation
    this._suppressUnusedWarnings();
  }

  /**
   * Suppress TypeScript unused warnings for properties reserved for future use
   */
  private _suppressUnusedWarnings(): void {
    void this._CACHE_TTL;
    void this.auditLogger;
    void this.userId;
    // Reference helper methods that are used by stubbed implementations
    void this.invalidateCache;
    void this._mapRuleToResult;
  }

  // =========================================================================
  // VALIDATION RULE CRUD
  // =========================================================================

  /**
   * Create a new validation rule
   * @throws NotImplementedError - Requires ValidationRule Prisma model
   */
  async createRule(input: CreateValidationRuleInput): Promise<never> {
    void input;
    throw new NotImplementedError('createRule: Requires ValidationRule Prisma model');
  }

  /**
   * Get validation rule by ID
   * @throws NotImplementedError - Requires ValidationRule Prisma model
   */
  async getRule(input: GetValidationRuleInput): Promise<never> {
    void input;
    throw new NotImplementedError('getRule: Requires ValidationRule Prisma model');
  }

  /**
   * List validation rules with filters
   * @throws NotImplementedError - Requires ValidationRule Prisma model
   */
  async listRules(input: ListValidationRulesInput): Promise<never> {
    void input;
    throw new NotImplementedError('listRules: Requires ValidationRule Prisma model');
  }

  /**
   * Update validation rule
   * @throws NotImplementedError - Requires ValidationRule Prisma model
   */
  async updateRule(input: UpdateValidationRuleInput): Promise<never> {
    void input;
    throw new NotImplementedError('updateRule: Requires ValidationRule Prisma model');
  }

  /**
   * Delete validation rule
   * @throws NotImplementedError - Requires ValidationRule Prisma model
   */
  async deleteRule(input: DeleteValidationRuleInput): Promise<never> {
    void input;
    throw new NotImplementedError('deleteRule: Requires ValidationRule Prisma model');
  }

  /**
   * Toggle rule active status
   * @throws NotImplementedError - Requires ValidationRule Prisma model
   */
  async toggleRule(input: ToggleValidationRuleInput): Promise<never> {
    void input;
    throw new NotImplementedError('toggleRule: Requires ValidationRule Prisma model');
  }

  // =========================================================================
  // ENTRY VALIDATION
  // =========================================================================

  /**
   * Validate journal entry
   */
  async validateEntry(input: ValidateEntryInput): Promise<ValidationResponse> {
    let entryData: EntryData;
    let entryId: string | undefined;

    // Get entry data either from DB or from input
    if (input.entryId) {
      const entry = await this.prisma.journalEntry.findFirst({
        where: {
          id: input.entryId,
          organizationId: this.organizationId,
        },
        include: {
          lines: true,
        },
      });

      if (!entry) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Journal entry not found',
        });
      }

      entryId = entry.id;
      entryData = {
        entryDate: entry.entryDate,
        entryType: entry.entryType,
        lines: entry.lines.map((line) => ({
          id: line.id,
          accountId: line.accountId,
          debitAmount: Number(line.debitAmount),
          creditAmount: Number(line.creditAmount),
          currency: line.currency,
          exchangeRate: Number(line.exchangeRate),
          costCenterId: line.costCenterId,
          description: line.description,
        })),
      };
    } else if (input.entryData) {
      entryData = {
        entryDate: input.entryData.entryDate,
        entryType: input.entryData.entryType,
        lines: input.entryData.lines.map((line) => ({
          accountId: line.accountId,
          debitAmount: line.debitAmount || 0,
          creditAmount: line.creditAmount || 0,
          currency: line.currency || BASE_CURRENCY,
          exchangeRate: line.exchangeRate || 1,
          costCenterId: line.costCenterId,
          description: line.description,
        })),
      };
    } else {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Must provide either entryId or entryData',
      });
    }

    const results: ValidationResultItem[] = [];

    // Get accounts for validation
    const accountIds = entryData.lines.map((l) => l.accountId);
    const accounts = await this.prisma.chartOfAccount.findMany({
      where: {
        id: { in: accountIds },
        organizationId: this.organizationId,
      },
    });
    const accountMap = new Map(
      accounts.map((a) => [
        a.id,
        {
          id: a.id,
          accountCode: a.accountCode,
          accountName: a.accountName,
          isActive: a.status === 'active',
          allowsPosting: a.allowsPosting,
          requiresCostCenter: false, // Not in schema, default to false
        } as Account,
      ])
    );

    // Get period for date - query through fiscalYear relation
    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        fiscalYear: { organizationId: this.organizationId },
        startDate: { lte: entryData.entryDate },
        endDate: { gte: entryData.entryDate },
      },
    });

    // Note: Custom business rules require ValidationRule Prisma model (not yet implemented)
    // When implemented, query: this.prisma.validationRule.findMany({ where: { organizationId, isActive: true } })

    // -------------------------------------------------------------------------
    // CORE VALIDATIONS
    // -------------------------------------------------------------------------

    // 1. Balance Check
    const balanceInfo = this.calculateBalance(entryData.lines);
    results.push({
      ruleCode: CORE_VALIDATION_RULES.BALANCE,
      ruleName: 'Entry Balance',
      passed: balanceInfo.isBalanced,
      severity: 'ERROR',
      message: balanceInfo.isBalanced
        ? 'Entry is balanced'
        : `Entry is not balanced. Difference: ${balanceInfo.difference.toFixed(2)}`,
      details: {
        totalDebits: balanceInfo.totalDebits,
        totalCredits: balanceInfo.totalCredits,
        difference: balanceInfo.difference,
      },
    });

    // 2. Zero Entry Check
    const totalAmount = balanceInfo.totalDebits + balanceInfo.totalCredits;
    const isZeroEntry = totalAmount === 0;
    results.push({
      ruleCode: CORE_VALIDATION_RULES.ZERO_ENTRY,
      ruleName: 'Non-Zero Entry',
      passed: !isZeroEntry,
      severity: 'ERROR',
      message: isZeroEntry ? 'Entry has zero amounts' : 'Entry has valid amounts',
    });

    // 3. Account Validations
    for (const line of entryData.lines) {
      const account = accountMap.get(line.accountId);
      const lineNum = entryData.lines.indexOf(line) + 1;

      // Account exists
      if (!account) {
        results.push({
          ruleCode: CORE_VALIDATION_RULES.ACCOUNT_EXISTS,
          ruleName: 'Account Exists',
          passed: false,
          severity: 'ERROR',
          message: `Account not found: ${line.accountId}`,
          lineNumber: lineNum,
          accountCode: line.accountId,
        });
        continue;
      }

      // Account active
      if (!account.isActive) {
        results.push({
          ruleCode: CORE_VALIDATION_RULES.ACCOUNT_ACTIVE,
          ruleName: 'Account Active',
          passed: false,
          severity: 'ERROR',
          message: `Account is inactive: ${account.accountCode} - ${account.accountName}`,
          lineNumber: lineNum,
          accountCode: account.accountCode,
        });
      }

      // Account allows posting (not header)
      if (!account.allowsPosting) {
        results.push({
          ruleCode: CORE_VALIDATION_RULES.ACCOUNT_POSTABLE,
          ruleName: 'Account Allows Posting',
          passed: false,
          severity: 'ERROR',
          message: `Account does not allow posting (header account): ${account.accountCode}`,
          lineNumber: lineNum,
          accountCode: account.accountCode,
        });
      }

      // Cost center required
      if (account.requiresCostCenter && !line.costCenterId) {
        results.push({
          ruleCode: CORE_VALIDATION_RULES.COST_CENTER_REQUIRED,
          ruleName: 'Cost Center Required',
          passed: false,
          severity: 'ERROR',
          message: `Cost center required for account: ${account.accountCode}`,
          lineNumber: lineNum,
          accountCode: account.accountCode,
        });
      }
    }

    // 4. Period Validations
    if (!period) {
      results.push({
        ruleCode: CORE_VALIDATION_RULES.PERIOD_EXISTS,
        ruleName: 'Period Exists',
        passed: false,
        severity: 'ERROR',
        message: `No accounting period found for date: ${entryData.entryDate.toISOString().split('T')[0]}`,
      });
    } else {
      // Period open check
      if (period.status === 'closed') {
        results.push({
          ruleCode: CORE_VALIDATION_RULES.PERIOD_OPEN,
          ruleName: 'Period Open',
          passed: false,
          severity: 'ERROR',
          message: `Period is closed: ${period.name}`,
        });
      }

      // Soft-closed warning
      if (period.status === 'soft_closed') {
        results.push({
          ruleCode: CORE_VALIDATION_RULES.PERIOD_SOFT_CLOSED,
          ruleName: 'Period Soft-Closed',
          passed: true, // Pass with warning
          severity: 'WARNING',
          message: `Period is soft-closed: ${period.name}. Posting requires approval.`,
        });
      }
    }

    // 5. Multi-Currency / Exchange Rate Validations
    const hasForeignCurrency = entryData.lines.some((l) => l.currency !== BASE_CURRENCY);
    if (hasForeignCurrency) {
      for (const line of entryData.lines) {
        if (line.currency !== BASE_CURRENCY && line.exchangeRate === 1) {
          results.push({
            ruleCode: CORE_VALIDATION_RULES.EXCHANGE_RATE,
            ruleName: 'Exchange Rate Valid',
            passed: true, // Pass with warning
            severity: 'WARNING',
            message: `Exchange rate of 1 for ${line.currency} may be incorrect`,
            lineNumber: entryData.lines.indexOf(line) + 1,
          });
        }
      }
    }

    // Note: Custom business rules validation is disabled until ValidationRule Prisma model is implemented
    // TODO: Add custom rule processing when ValidationRule model is available

    // -------------------------------------------------------------------------
    // BUILD RESPONSE
    // -------------------------------------------------------------------------
    const errors = results.filter((r) => !r.passed && r.severity === 'ERROR');
    const warnings = results.filter((r) => !r.passed && r.severity === 'WARNING');
    const infos = results.filter((r) => !r.passed && r.severity === 'INFO');

    const summary: ValidationSummary = {
      totalRules: results.length,
      passed: results.filter((r) => r.passed).length,
      errors: errors.length,
      warnings: warnings.length,
      infos: infos.length,
    };

    const isValid = errors.length === 0;
    const canPost = isValid && (!period || period.status !== 'closed');

    // Note: Storing validation results is disabled until ValidationResult Prisma model is implemented
    // TODO: Add result storage when ValidationResult model is available
    // const storeResult = input.storeResult !== false;
    // if (storeResult && entryId) { ... }
    void input.storeResult;
    void entryId;

    return {
      isValid,
      canPost,
      results,
      summary,
      balanceInfo: {
        ...balanceInfo,
        currency: BASE_CURRENCY,
      },
    };
  }

  // =========================================================================
  // QUICK BALANCE CHECK
  // =========================================================================

  /**
   * Quick balance check without full validation
   */
  checkBalance(input: CheckBalanceInput): CheckBalanceResult {
    const lines = input.lines.map((l) => ({
      debitAmount: l.debitAmount || 0,
      creditAmount: l.creditAmount || 0,
      currency: l.currency || BASE_CURRENCY,
      exchangeRate: l.exchangeRate || 1,
    }));

    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const line of lines) {
      // Convert to base currency
      const rate = new Decimal(line.exchangeRate);
      totalDebits = totalDebits.plus(new Decimal(line.debitAmount).times(rate));
      totalCredits = totalCredits.plus(new Decimal(line.creditAmount).times(rate));
    }

    const difference = totalDebits.minus(totalCredits).abs();
    const isBalanced = difference.lessThanOrEqualTo(BALANCE_TOLERANCE);

    return {
      totalDebits: totalDebits.toNumber(),
      totalCredits: totalCredits.toNumber(),
      difference: difference.toNumber(),
      isBalanced,
    };
  }

  // =========================================================================
  // VALIDATION HISTORY
  // =========================================================================

  /**
   * Get validation history for an entry
   * @throws NotImplementedError - Requires ValidationResult Prisma model
   */
  async getValidationHistory(input: GetValidationHistoryInput): Promise<never> {
    void input;
    throw new NotImplementedError('getValidationHistory: Requires ValidationResult Prisma model');
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  private calculateBalance(lines: EntryLine[]): BalanceInfo {
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const line of lines) {
      // Convert to base currency using exchange rate
      const rate = new Decimal(line.exchangeRate || 1);
      totalDebits = totalDebits.plus(new Decimal(line.debitAmount).times(rate));
      totalCredits = totalCredits.plus(new Decimal(line.creditAmount).times(rate));
    }

    const difference = totalDebits.minus(totalCredits).abs();
    const isBalanced = difference.lessThanOrEqualTo(BALANCE_TOLERANCE);

    return {
      totalDebits: totalDebits.toNumber(),
      totalCredits: totalCredits.toNumber(),
      difference: difference.toNumber(),
      isBalanced,
      currency: BASE_CURRENCY,
    };
  }

  private async invalidateCache(): Promise<void> {
    const pattern = `${this.CACHE_PREFIX}:${this.organizationId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Map database rule to ValidationRule type
   * Note: This method is reserved for future use when ValidationRule Prisma model is implemented
   */
  private _mapRuleToResult(_rule: unknown): _ValidationRule {
    // Stub method - will be implemented when ValidationRule Prisma model is available
    throw new NotImplementedError('mapRuleToResult: Requires ValidationRule Prisma model');
  }
}
