import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validationRouter } from '../../routers/ace/validation.router';
import { ValidationService } from '../../services/ace/validation.service';
import { router, createCallerFactory } from '../../trpc';
import type { Context } from '../../trpc';

// ===========================================================================
// MOCKS
// ===========================================================================

vi.mock('../../services/ace/validation.service');

const mockSession = {
  userId: 'user-123',
  organizationId: 'org-456',
  email: 'test@example.com',
  role: 'admin' as const,
  permissions: ['*'],
};

const mockContext: Context = {
  prisma: {} as any,
  redis: {} as any,
  auditLogger: { log: vi.fn() } as any,
  session: mockSession,
};

const createCaller = createCallerFactory(router({ validation: validationRouter }));
const caller = createCaller(mockContext);

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_RULE_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_ENTRY_ID = '660e8400-e29b-41d4-a716-446655440002';
const TEST_ACCOUNT_ID_1 = '770e8400-e29b-41d4-a716-446655440003';
const TEST_ACCOUNT_ID_2 = '770e8400-e29b-41d4-a716-446655440004';

const testRule = {
  id: TEST_RULE_ID,
  organizationId: 'org-456',
  ruleCode: 'CUSTOM_001',
  ruleName: 'Custom Rule',
  ruleType: 'BUSINESS' as const,
  isActive: true,
  severity: 'WARNING' as const,
  conditions: { rule: 'large_amount', threshold: 10000 },
  errorMessage: 'Amount exceeds threshold',
  appliesToEntryTypes: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const testValidationResponse = {
  isValid: true,
  canPost: true,
  results: [
    {
      ruleCode: 'CORE_BALANCE',
      ruleName: 'Entry Balance',
      passed: true,
      severity: 'ERROR' as const,
      message: 'Entry is balanced',
    },
  ],
  summary: {
    totalRules: 1,
    passed: 1,
    errors: 0,
    warnings: 0,
    infos: 0,
  },
  balanceInfo: {
    totalDebits: 1000,
    totalCredits: 1000,
    difference: 0,
    isBalanced: true,
    currency: 'PLN',
  },
};

const testBalanceResult = {
  totalDebits: 1000,
  totalCredits: 1000,
  difference: 0,
  isBalanced: true,
};

const testHistoryRecord = {
  id: 'record-1',
  entryId: TEST_ENTRY_ID,
  validatedAt: new Date(),
  validatedBy: 'user-123',
  isValid: true,
  canPost: true,
  results: [],
  errorCount: 0,
  warningCount: 0,
  infoCount: 0,
  validatedByUser: { name: 'Test User', email: 'test@test.com' },
};

// ===========================================================================
// TESTS
// ===========================================================================

describe('validationRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // VALIDATION RULE CRUD
  // =========================================================================

  describe('createRule', () => {
    it('should create a new validation rule', async () => {
      const input = {
        ruleCode: 'NEW_RULE',
        ruleName: 'New Rule',
        ruleType: 'BUSINESS' as const,
        severity: 'ERROR' as const,
        conditions: { minAmount: 100 },
        errorMessage: 'Error message',
      };

      vi.mocked(ValidationService.prototype.createRule).mockResolvedValue(testRule);

      const result = await caller.validation.createRule(input);

      expect(result.ruleCode).toBe('CUSTOM_001');
      expect(ValidationService.prototype.createRule).toHaveBeenCalledWith(input);
    });
  });

  describe('getRule', () => {
    it('should get rule by ID', async () => {
      vi.mocked(ValidationService.prototype.getRule).mockResolvedValue(testRule);

      const result = await caller.validation.getRule({ ruleId: TEST_RULE_ID });

      expect(result.id).toBe(TEST_RULE_ID);
      expect(ValidationService.prototype.getRule).toHaveBeenCalledWith({ ruleId: TEST_RULE_ID });
    });
  });

  describe('listRules', () => {
    it('should list all rules', async () => {
      vi.mocked(ValidationService.prototype.listRules).mockResolvedValue({
        rules: [testRule],
        total: 1,
      });

      const result = await caller.validation.listRules({});

      expect(result.rules).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by rule type', async () => {
      vi.mocked(ValidationService.prototype.listRules).mockResolvedValue({
        rules: [testRule],
        total: 1,
      });

      await caller.validation.listRules({ ruleType: 'BUSINESS' });

      expect(ValidationService.prototype.listRules).toHaveBeenCalledWith({
        ruleType: 'BUSINESS',
      });
    });

    it('should filter by active status', async () => {
      vi.mocked(ValidationService.prototype.listRules).mockResolvedValue({
        rules: [testRule],
        total: 1,
      });

      await caller.validation.listRules({ isActive: true });

      expect(ValidationService.prototype.listRules).toHaveBeenCalledWith({
        isActive: true,
      });
    });
  });

  describe('updateRule', () => {
    it('should update rule', async () => {
      const updatedRule = { ...testRule, ruleName: 'Updated Name' };
      vi.mocked(ValidationService.prototype.updateRule).mockResolvedValue(updatedRule);

      const result = await caller.validation.updateRule({
        ruleId: TEST_RULE_ID,
        ruleName: 'Updated Name',
      });

      expect(result.ruleName).toBe('Updated Name');
      expect(ValidationService.prototype.updateRule).toHaveBeenCalled();
    });
  });

  describe('deleteRule', () => {
    it('should delete rule', async () => {
      vi.mocked(ValidationService.prototype.deleteRule).mockResolvedValue({ success: true });

      const result = await caller.validation.deleteRule({ ruleId: TEST_RULE_ID });

      expect(result.success).toBe(true);
      expect(ValidationService.prototype.deleteRule).toHaveBeenCalledWith({
        ruleId: TEST_RULE_ID,
      });
    });
  });

  describe('toggleRule', () => {
    it('should toggle rule status', async () => {
      const toggledRule = { ...testRule, isActive: false };
      vi.mocked(ValidationService.prototype.toggleRule).mockResolvedValue(toggledRule);

      const result = await caller.validation.toggleRule({ ruleId: TEST_RULE_ID });

      expect(result.isActive).toBe(false);
      expect(ValidationService.prototype.toggleRule).toHaveBeenCalledWith({
        ruleId: TEST_RULE_ID,
      });
    });
  });

  // =========================================================================
  // ENTRY VALIDATION
  // =========================================================================

  describe('validateEntry', () => {
    it('should validate entry by ID', async () => {
      vi.mocked(ValidationService.prototype.validateEntry).mockResolvedValue(testValidationResponse);

      const result = await caller.validation.validateEntry({ entryId: TEST_ENTRY_ID });

      expect(result.isValid).toBe(true);
      expect(result.canPost).toBe(true);
      expect(result.balanceInfo.isBalanced).toBe(true);
      // Router adds default storeResult: true when not specified
      expect(ValidationService.prototype.validateEntry).toHaveBeenCalledWith({
        entryId: TEST_ENTRY_ID,
        storeResult: true,
      });
    });

    it('should validate inline entry data', async () => {
      vi.mocked(ValidationService.prototype.validateEntry).mockResolvedValue(testValidationResponse);

      const entryData = {
        entryDate: new Date('2024-01-15'),
        entryType: 'STANDARD',
        lines: [
          { accountId: TEST_ACCOUNT_ID_1, debitAmount: 1000, creditAmount: 0 },
          { accountId: TEST_ACCOUNT_ID_2, debitAmount: 0, creditAmount: 1000 },
        ],
      };

      const result = await caller.validation.validateEntry({
        entryData,
        storeResult: false,
      });

      expect(result.isValid).toBe(true);
    });
  });

  // =========================================================================
  // QUICK BALANCE CHECK
  // =========================================================================

  describe('checkBalance', () => {
    it('should check balance for lines', async () => {
      vi.mocked(ValidationService.prototype.checkBalance).mockReturnValue(testBalanceResult);

      const result = await caller.validation.checkBalance({
        lines: [
          { debitAmount: 1000, creditAmount: 0 },
          { debitAmount: 0, creditAmount: 1000 },
        ],
      });

      expect(result.isBalanced).toBe(true);
      expect(result.difference).toBe(0);
    });

    it('should detect unbalanced lines', async () => {
      const unbalancedResult = {
        ...testBalanceResult,
        totalCredits: 800,
        difference: 200,
        isBalanced: false,
      };
      vi.mocked(ValidationService.prototype.checkBalance).mockReturnValue(unbalancedResult);

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

  // =========================================================================
  // VALIDATION HISTORY
  // =========================================================================

  describe('getValidationHistory', () => {
    it('should get validation history for entry', async () => {
      vi.mocked(ValidationService.prototype.getValidationHistory).mockResolvedValue({
        history: [testHistoryRecord],
        total: 1,
      });

      const result = await caller.validation.getValidationHistory({
        entryId: TEST_ENTRY_ID,
      });

      expect(result.history).toHaveLength(1);
      expect(result.total).toBe(1);
      // Router adds default limit: 10 when not specified
      expect(ValidationService.prototype.getValidationHistory).toHaveBeenCalledWith({
        entryId: TEST_ENTRY_ID,
        limit: 10,
      });
    });

    it('should respect limit parameter', async () => {
      vi.mocked(ValidationService.prototype.getValidationHistory).mockResolvedValue({
        history: [testHistoryRecord],
        total: 5,
      });

      await caller.validation.getValidationHistory({
        entryId: TEST_ENTRY_ID,
        limit: 1,
      });

      expect(ValidationService.prototype.getValidationHistory).toHaveBeenCalledWith({
        entryId: TEST_ENTRY_ID,
        limit: 1,
      });
    });
  });
});
