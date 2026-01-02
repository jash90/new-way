import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationService } from '../../services/ace/validation.service';
import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../lib/audit-logger';

// ===========================================================================
// MOCKS
// ===========================================================================

const mockPrisma = {
  validationRule: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  validationResult: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  journalEntry: {
    findFirst: vi.fn(),
  },
  chartOfAccounts: {
    findMany: vi.fn(),
  },
  accountingPeriod: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn((fn) => fn(mockPrisma)),
} as unknown as PrismaClient;

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn().mockResolvedValue([]),
} as unknown as Redis;

const mockAuditLogger = {
  log: vi.fn(),
} as unknown as AuditLogger;

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_USER_ID = 'user-123';
const TEST_ORG_ID = 'org-456';
const TEST_RULE_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_ENTRY_ID = '660e8400-e29b-41d4-a716-446655440002';
const TEST_ACCOUNT_ID_1 = '770e8400-e29b-41d4-a716-446655440003';
const TEST_ACCOUNT_ID_2 = '880e8400-e29b-41d4-a716-446655440004';
const TEST_PERIOD_ID = '990e8400-e29b-41d4-a716-446655440005';

const testRule = {
  id: TEST_RULE_ID,
  organizationId: TEST_ORG_ID,
  ruleCode: 'CUSTOM_001',
  ruleName: 'Custom Rule',
  ruleType: 'BUSINESS',
  isActive: true,
  severity: 'WARNING',
  conditions: { rule: 'large_amount', threshold: 10000 },
  errorMessage: 'Amount exceeds threshold',
  appliesToEntryTypes: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const testCashAccount = {
  id: TEST_ACCOUNT_ID_1,
  organizationId: TEST_ORG_ID,
  accountCode: '100',
  accountName: 'Kasa',
  accountType: 'asset',
  normalBalance: 'debit',
  isActive: true,
  allowsPosting: true,
  requiresCostCenter: false,
};

const testBankAccount = {
  id: TEST_ACCOUNT_ID_2,
  organizationId: TEST_ORG_ID,
  accountCode: '130',
  accountName: 'Bank',
  accountType: 'asset',
  normalBalance: 'debit',
  isActive: true,
  allowsPosting: true,
  requiresCostCenter: false,
};

const testOpenPeriod = {
  id: TEST_PERIOD_ID,
  organizationId: TEST_ORG_ID,
  periodNumber: 1,
  name: 'Styczeń 2024',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
  status: 'open',
};

const testClosedPeriod = {
  ...testOpenPeriod,
  status: 'closed',
};

const testSoftClosedPeriod = {
  ...testOpenPeriod,
  status: 'soft_closed',
};

const testEntry = {
  id: TEST_ENTRY_ID,
  organizationId: TEST_ORG_ID,
  entryDate: new Date('2024-01-15'),
  entryType: 'STANDARD',
  status: 'DRAFT',
  lines: [
    {
      id: 'line-1',
      accountId: TEST_ACCOUNT_ID_1,
      debitAmount: 1000,
      creditAmount: 0,
      currency: 'PLN',
      exchangeRate: 1,
    },
    {
      id: 'line-2',
      accountId: TEST_ACCOUNT_ID_2,
      debitAmount: 0,
      creditAmount: 1000,
      currency: 'PLN',
      exchangeRate: 1,
    },
  ],
};

// ===========================================================================
// TESTS
// ===========================================================================

describe('ValidationService', () => {
  let service: ValidationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ValidationService(
      mockPrisma,
      mockRedis,
      mockAuditLogger,
      TEST_USER_ID,
      TEST_ORG_ID
    );
  });

  // =========================================================================
  // VALIDATION RULE CRUD
  // =========================================================================

  describe('createRule', () => {
    it('should create a new validation rule', async () => {
      const input = {
        ruleCode: 'TEST_RULE',
        ruleName: 'Test Rule',
        ruleType: 'BUSINESS' as const,
        severity: 'ERROR' as const,
        conditions: { minAmount: 100 },
        errorMessage: 'Test error message',
      };

      const expectedRule = {
        id: TEST_RULE_ID,
        organizationId: TEST_ORG_ID,
        ...input,
        isActive: true,
        appliesToEntryTypes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.validationRule.findFirst = vi.fn().mockResolvedValue(null);
      mockPrisma.validationRule.create = vi.fn().mockResolvedValue(expectedRule);

      const result = await service.createRule(input);

      expect(result.ruleCode).toBe('TEST_RULE');
      expect(mockPrisma.validationRule.create).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should reject duplicate rule code', async () => {
      const input = {
        ruleCode: 'EXISTING_RULE',
        ruleName: 'Duplicate Rule',
        ruleType: 'BUSINESS' as const,
        severity: 'ERROR' as const,
        conditions: {},
        errorMessage: 'Error',
      };

      mockPrisma.validationRule.findFirst = vi.fn().mockResolvedValue(testRule);

      await expect(service.createRule(input)).rejects.toThrow(TRPCError);
    });
  });

  describe('getRule', () => {
    it('should get rule by ID', async () => {
      mockPrisma.validationRule.findFirst = vi.fn().mockResolvedValue(testRule);

      const result = await service.getRule({ ruleId: TEST_RULE_ID });

      expect(result.id).toBe(TEST_RULE_ID);
      expect(result.ruleCode).toBe('CUSTOM_001');
    });

    it('should throw if rule not found', async () => {
      mockPrisma.validationRule.findFirst = vi.fn().mockResolvedValue(null);

      await expect(service.getRule({ ruleId: 'non-existent' })).rejects.toThrow(TRPCError);
    });
  });

  describe('listRules', () => {
    it('should list all rules', async () => {
      mockPrisma.validationRule.findMany = vi.fn().mockResolvedValue([testRule]);
      mockPrisma.validationRule.count = vi.fn().mockResolvedValue(1);

      const result = await service.listRules({});

      expect(result.rules).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by rule type', async () => {
      mockPrisma.validationRule.findMany = vi.fn().mockResolvedValue([testRule]);
      mockPrisma.validationRule.count = vi.fn().mockResolvedValue(1);

      await service.listRules({ ruleType: 'BUSINESS' });

      expect(mockPrisma.validationRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ ruleType: 'BUSINESS' }),
        })
      );
    });

    it('should filter by active status', async () => {
      mockPrisma.validationRule.findMany = vi.fn().mockResolvedValue([testRule]);
      mockPrisma.validationRule.count = vi.fn().mockResolvedValue(1);

      await service.listRules({ isActive: true });

      expect(mockPrisma.validationRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      );
    });
  });

  describe('updateRule', () => {
    it('should update rule', async () => {
      const updatedRule = { ...testRule, ruleName: 'Updated Name' };
      mockPrisma.validationRule.findFirst = vi.fn().mockResolvedValue(testRule);
      mockPrisma.validationRule.update = vi.fn().mockResolvedValue(updatedRule);

      const result = await service.updateRule({
        ruleId: TEST_RULE_ID,
        ruleName: 'Updated Name',
      });

      expect(result.ruleName).toBe('Updated Name');
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should throw if rule not found', async () => {
      mockPrisma.validationRule.findFirst = vi.fn().mockResolvedValue(null);

      await expect(
        service.updateRule({ ruleId: 'non-existent', ruleName: 'New' })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('deleteRule', () => {
    it('should delete rule', async () => {
      mockPrisma.validationRule.findFirst = vi.fn().mockResolvedValue(testRule);
      mockPrisma.validationRule.delete = vi.fn().mockResolvedValue(testRule);

      const result = await service.deleteRule({ ruleId: TEST_RULE_ID });

      expect(result.success).toBe(true);
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should throw if rule not found', async () => {
      mockPrisma.validationRule.findFirst = vi.fn().mockResolvedValue(null);

      await expect(service.deleteRule({ ruleId: 'non-existent' })).rejects.toThrow(TRPCError);
    });
  });

  describe('toggleRule', () => {
    it('should toggle rule status', async () => {
      mockPrisma.validationRule.findFirst = vi.fn().mockResolvedValue(testRule);
      mockPrisma.validationRule.update = vi.fn().mockResolvedValue({ ...testRule, isActive: false });

      const result = await service.toggleRule({ ruleId: TEST_RULE_ID });

      expect(result.isActive).toBe(false);
    });
  });

  // =========================================================================
  // ENTRY VALIDATION
  // =========================================================================

  describe('validateEntry', () => {
    beforeEach(() => {
      mockPrisma.chartOfAccounts.findMany = vi.fn().mockResolvedValue([testCashAccount, testBankAccount]);
      mockPrisma.accountingPeriod.findFirst = vi.fn().mockResolvedValue(testOpenPeriod);
      mockPrisma.validationRule.findMany = vi.fn().mockResolvedValue([]);
    });

    it('should validate existing entry by ID', async () => {
      mockPrisma.journalEntry.findFirst = vi.fn().mockResolvedValue(testEntry);
      mockPrisma.validationResult.create = vi.fn().mockResolvedValue({});

      const result = await service.validateEntry({ entryId: TEST_ENTRY_ID });

      expect(result.isValid).toBe(true);
      expect(result.canPost).toBe(true);
      expect(result.balanceInfo.isBalanced).toBe(true);
    });

    it('should validate inline entry data', async () => {
      const result = await service.validateEntry({
        entryData: {
          entryDate: new Date('2024-01-15'),
          entryType: 'STANDARD',
          lines: [
            { accountId: TEST_ACCOUNT_ID_1, debitAmount: 1000, creditAmount: 0 },
            { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 1000 },
          ],
        },
        storeResult: false,
      });

      expect(result.isValid).toBe(true);
      expect(result.canPost).toBe(true);
    });

    it('should detect unbalanced entry', async () => {
      const result = await service.validateEntry({
        entryData: {
          entryDate: new Date('2024-01-15'),
          entryType: 'STANDARD',
          lines: [
            { accountId: TEST_ACCOUNT_ID_1, debitAmount: 1000, creditAmount: 0 },
            { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 900 },
          ],
        },
        storeResult: false,
      });

      expect(result.isValid).toBe(false);
      expect(result.balanceInfo.isBalanced).toBe(false);
      expect(result.balanceInfo.difference).toBe(100);
    });

    it('should detect inactive account', async () => {
      const inactiveAccount = { ...testCashAccount, isActive: false };
      mockPrisma.chartOfAccounts.findMany = vi.fn().mockResolvedValue([inactiveAccount, testBankAccount]);

      const result = await service.validateEntry({
        entryData: {
          entryDate: new Date('2024-01-15'),
          entryType: 'STANDARD',
          lines: [
            { accountId: TEST_ACCOUNT_ID_1, debitAmount: 1000, creditAmount: 0 },
            { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 1000 },
          ],
        },
        storeResult: false,
      });

      expect(result.isValid).toBe(false);
      const inactiveError = result.results.find((r) => r.ruleCode === 'CORE_ACCOUNT_ACTIVE');
      expect(inactiveError?.passed).toBe(false);
    });

    it('should detect header account (non-postable)', async () => {
      const headerAccount = { ...testCashAccount, allowsPosting: false };
      mockPrisma.chartOfAccounts.findMany = vi.fn().mockResolvedValue([headerAccount, testBankAccount]);

      const result = await service.validateEntry({
        entryData: {
          entryDate: new Date('2024-01-15'),
          entryType: 'STANDARD',
          lines: [
            { accountId: TEST_ACCOUNT_ID_1, debitAmount: 1000, creditAmount: 0 },
            { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 1000 },
          ],
        },
        storeResult: false,
      });

      expect(result.isValid).toBe(false);
      const headerError = result.results.find((r) => r.ruleCode === 'CORE_ACCOUNT_POSTABLE');
      expect(headerError?.passed).toBe(false);
    });

    it('should detect missing cost center', async () => {
      const accountWithCostCenter = { ...testCashAccount, requiresCostCenter: true };
      mockPrisma.chartOfAccounts.findMany = vi.fn().mockResolvedValue([accountWithCostCenter, testBankAccount]);

      const result = await service.validateEntry({
        entryData: {
          entryDate: new Date('2024-01-15'),
          entryType: 'STANDARD',
          lines: [
            { accountId: TEST_ACCOUNT_ID_1, debitAmount: 1000, creditAmount: 0 },
            { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 1000 },
          ],
        },
        storeResult: false,
      });

      expect(result.isValid).toBe(false);
      const costCenterError = result.results.find((r) => r.ruleCode === 'CORE_COST_CENTER_REQUIRED');
      expect(costCenterError?.passed).toBe(false);
    });

    it('should detect closed period', async () => {
      mockPrisma.accountingPeriod.findFirst = vi.fn().mockResolvedValue(testClosedPeriod);

      const result = await service.validateEntry({
        entryData: {
          entryDate: new Date('2024-01-15'),
          entryType: 'STANDARD',
          lines: [
            { accountId: TEST_ACCOUNT_ID_1, debitAmount: 1000, creditAmount: 0 },
            { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 1000 },
          ],
        },
        storeResult: false,
      });

      expect(result.canPost).toBe(false);
      const periodError = result.results.find((r) => r.ruleCode === 'CORE_PERIOD_OPEN');
      expect(periodError?.passed).toBe(false);
    });

    it('should warn on soft-closed period', async () => {
      mockPrisma.accountingPeriod.findFirst = vi.fn().mockResolvedValue(testSoftClosedPeriod);

      const result = await service.validateEntry({
        entryData: {
          entryDate: new Date('2024-01-15'),
          entryType: 'STANDARD',
          lines: [
            { accountId: TEST_ACCOUNT_ID_1, debitAmount: 1000, creditAmount: 0 },
            { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 1000 },
          ],
        },
        storeResult: false,
      });

      expect(result.canPost).toBe(true); // Can still post with warning
      const periodWarning = result.results.find((r) => r.ruleCode === 'CORE_PERIOD_SOFT_CLOSED');
      expect(periodWarning?.severity).toBe('WARNING');
    });

    it('should detect missing period', async () => {
      mockPrisma.accountingPeriod.findFirst = vi.fn().mockResolvedValue(null);

      const result = await service.validateEntry({
        entryData: {
          entryDate: new Date('2024-01-15'),
          entryType: 'STANDARD',
          lines: [
            { accountId: TEST_ACCOUNT_ID_1, debitAmount: 1000, creditAmount: 0 },
            { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 1000 },
          ],
        },
        storeResult: false,
      });

      expect(result.canPost).toBe(false);
      const periodError = result.results.find((r) => r.ruleCode === 'CORE_PERIOD_EXISTS');
      expect(periodError?.passed).toBe(false);
    });

    it('should validate multi-currency entry in base currency', async () => {
      const result = await service.validateEntry({
        entryData: {
          entryDate: new Date('2024-01-15'),
          entryType: 'STANDARD',
          lines: [
            { accountId: TEST_ACCOUNT_ID_1, debitAmount: 1000, creditAmount: 0, currency: 'EUR', exchangeRate: 4.35 },
            { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 4350, currency: 'PLN', exchangeRate: 1 },
          ],
        },
        storeResult: false,
      });

      expect(result.balanceInfo.isBalanced).toBe(true);
    });

    it('should warn about exchange rate of 1 for non-base currency', async () => {
      const result = await service.validateEntry({
        entryData: {
          entryDate: new Date('2024-01-15'),
          entryType: 'STANDARD',
          lines: [
            { accountId: TEST_ACCOUNT_ID_1, debitAmount: 1000, creditAmount: 0, currency: 'EUR', exchangeRate: 1 },
            { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 1000, currency: 'PLN', exchangeRate: 1 },
          ],
        },
        storeResult: false,
      });

      const exchangeWarning = result.results.find((r) => r.ruleCode === 'CORE_EXCHANGE_RATE');
      expect(exchangeWarning?.severity).toBe('WARNING');
    });

    it('should store validation result when storeResult is true', async () => {
      mockPrisma.journalEntry.findFirst = vi.fn().mockResolvedValue(testEntry);
      mockPrisma.validationResult.create = vi.fn().mockResolvedValue({});

      await service.validateEntry({ entryId: TEST_ENTRY_ID, storeResult: true });

      expect(mockPrisma.validationResult.create).toHaveBeenCalled();
    });

    it('should not store validation result when storeResult is false', async () => {
      await service.validateEntry({
        entryData: {
          entryDate: new Date('2024-01-15'),
          entryType: 'STANDARD',
          lines: [
            { accountId: TEST_ACCOUNT_ID_1, debitAmount: 1000, creditAmount: 0 },
            { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 1000 },
          ],
        },
        storeResult: false,
      });

      expect(mockPrisma.validationResult.create).not.toHaveBeenCalled();
    });

    it('should throw if entry not found', async () => {
      mockPrisma.journalEntry.findFirst = vi.fn().mockResolvedValue(null);

      await expect(service.validateEntry({ entryId: 'non-existent' })).rejects.toThrow(TRPCError);
    });

    it('should detect zero amount entry', async () => {
      const result = await service.validateEntry({
        entryData: {
          entryDate: new Date('2024-01-15'),
          entryType: 'STANDARD',
          lines: [
            { accountId: TEST_ACCOUNT_ID_1, debitAmount: 0, creditAmount: 0 },
            { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 0 },
          ],
        },
        storeResult: false,
      });

      expect(result.isValid).toBe(false);
      const zeroError = result.results.find((r) => r.ruleCode === 'CORE_ZERO_ENTRY');
      expect(zeroError?.passed).toBe(false);
    });

    it('should apply custom business rules', async () => {
      mockPrisma.validationRule.findMany = vi.fn().mockResolvedValue([testRule]);

      const result = await service.validateEntry({
        entryData: {
          entryDate: new Date('2024-01-15'),
          entryType: 'STANDARD',
          lines: [
            { accountId: TEST_ACCOUNT_ID_1, debitAmount: 50000, creditAmount: 0 },
            { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 50000 },
          ],
        },
        storeResult: false,
      });

      // Should have warning for large amount
      const customWarning = result.results.find((r) => r.ruleCode === 'CUSTOM_001');
      expect(customWarning).toBeDefined();
    });
  });

  // =========================================================================
  // QUICK BALANCE CHECK
  // =========================================================================

  describe('checkBalance', () => {
    it('should check balance for balanced lines', () => {
      const result = service.checkBalance({
        lines: [
          { debitAmount: 1000, creditAmount: 0 },
          { debitAmount: 0, creditAmount: 1000 },
        ],
      });

      expect(result.isBalanced).toBe(true);
      expect(result.difference).toBe(0);
    });

    it('should detect unbalanced lines', () => {
      const result = service.checkBalance({
        lines: [
          { debitAmount: 1000, creditAmount: 0 },
          { debitAmount: 0, creditAmount: 800 },
        ],
      });

      expect(result.isBalanced).toBe(false);
      expect(result.difference).toBe(200);
    });

    it('should handle multi-currency with exchange rates', () => {
      const result = service.checkBalance({
        lines: [
          { debitAmount: 1000, creditAmount: 0, currency: 'EUR', exchangeRate: 4.35 },
          { debitAmount: 0, creditAmount: 4350, currency: 'PLN', exchangeRate: 1 },
        ],
      });

      expect(result.isBalanced).toBe(true);
    });

    it('should allow small rounding difference', () => {
      const result = service.checkBalance({
        lines: [
          { debitAmount: 100.005, creditAmount: 0 },
          { debitAmount: 0, creditAmount: 100.004 },
        ],
      });

      expect(result.isBalanced).toBe(true); // Within 0.01 tolerance
    });
  });

  // =========================================================================
  // VALIDATION HISTORY
  // =========================================================================

  describe('getValidationHistory', () => {
    it('should get validation history for entry', async () => {
      const historyRecord = {
        id: 'record-1',
        entryId: TEST_ENTRY_ID,
        validatedAt: new Date(),
        validatedBy: TEST_USER_ID,
        isValid: true,
        canPost: true,
        results: [],
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        validatedByUser: { name: 'Test User', email: 'test@test.com' },
      };

      mockPrisma.journalEntry.findFirst = vi.fn().mockResolvedValue(testEntry);
      mockPrisma.validationResult.findMany = vi.fn().mockResolvedValue([historyRecord]);
      mockPrisma.validationResult.count = vi.fn().mockResolvedValue(1);

      const result = await service.getValidationHistory({ entryId: TEST_ENTRY_ID });

      expect(result.history).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should throw if entry not found', async () => {
      mockPrisma.journalEntry.findFirst = vi.fn().mockResolvedValue(null);

      await expect(service.getValidationHistory({ entryId: 'non-existent' })).rejects.toThrow(TRPCError);
    });
  });

  // =========================================================================
  // CACHE INVALIDATION
  // =========================================================================

  describe('cache invalidation', () => {
    it('should invalidate cache on rule creation', async () => {
      mockPrisma.validationRule.findFirst = vi.fn().mockResolvedValue(null);
      mockPrisma.validationRule.create = vi.fn().mockResolvedValue(testRule);
      mockRedis.keys = vi.fn().mockResolvedValue([`validation:${TEST_ORG_ID}:rules`]);

      await service.createRule({
        ruleCode: 'NEW_RULE',
        ruleName: 'New Rule',
        ruleType: 'BUSINESS',
        severity: 'ERROR',
        conditions: {},
        errorMessage: 'Error',
      });

      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should invalidate cache on rule update', async () => {
      mockPrisma.validationRule.findFirst = vi.fn().mockResolvedValue(testRule);
      mockPrisma.validationRule.update = vi.fn().mockResolvedValue(testRule);
      mockRedis.keys = vi.fn().mockResolvedValue([`validation:${TEST_ORG_ID}:rules`]);

      await service.updateRule({ ruleId: TEST_RULE_ID, ruleName: 'Updated' });

      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should invalidate cache on rule deletion', async () => {
      mockPrisma.validationRule.findFirst = vi.fn().mockResolvedValue(testRule);
      mockPrisma.validationRule.delete = vi.fn().mockResolvedValue(testRule);
      mockRedis.keys = vi.fn().mockResolvedValue([`validation:${TEST_ORG_ID}:rules`]);

      await service.deleteRule({ ruleId: TEST_RULE_ID });

      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // AUDIT LOGGING
  // =========================================================================

  describe('audit logging', () => {
    it('should log rule creation', async () => {
      mockPrisma.validationRule.findFirst = vi.fn().mockResolvedValue(null);
      mockPrisma.validationRule.create = vi.fn().mockResolvedValue(testRule);

      await service.createRule({
        ruleCode: 'NEW_RULE',
        ruleName: 'New Rule',
        ruleType: 'BUSINESS',
        severity: 'ERROR',
        conditions: {},
        errorMessage: 'Error',
      });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'VALIDATION_RULE_CREATED',
        })
      );
    });

    it('should log rule update', async () => {
      mockPrisma.validationRule.findFirst = vi.fn().mockResolvedValue(testRule);
      mockPrisma.validationRule.update = vi.fn().mockResolvedValue(testRule);

      await service.updateRule({ ruleId: TEST_RULE_ID, ruleName: 'Updated' });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'VALIDATION_RULE_UPDATED',
        })
      );
    });

    it('should log rule deletion', async () => {
      mockPrisma.validationRule.findFirst = vi.fn().mockResolvedValue(testRule);
      mockPrisma.validationRule.delete = vi.fn().mockResolvedValue(testRule);

      await service.deleteRule({ ruleId: TEST_RULE_ID });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'VALIDATION_RULE_DELETED',
        })
      );
    });
  });
});
