import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Account, ChartAccountType, AccountNature, AccountCategory } from '@ksiegowacrm/shared';

// ===========================================================================
// MOCKS
// ===========================================================================

const mocks = vi.hoisted(() => ({
  createAccount: vi.fn(),
  getAccount: vi.fn(),
  getAccountByCode: vi.fn(),
  listAccounts: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
  activateAccount: vi.fn(),
  deactivateAccount: vi.fn(),
  moveAccount: vi.fn(),
  getAccountTree: vi.fn(),
  searchAccounts: vi.fn(),
  validateAccountCode: vi.fn(),
  getAccountBalance: vi.fn(),
  batchCreateAccounts: vi.fn(),
  importAccounts: vi.fn(),
  exportAccounts: vi.fn(),
  getAccountStatistics: vi.fn(),
}));

vi.mock('../../services/ace/account.service', () => ({
  AccountService: vi.fn().mockImplementation(() => mocks),
}));

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_USER_ID = 'user-123';
const TEST_ORG_ID = 'org-456';

const sampleAccount: Account = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  organizationId: TEST_ORG_ID,
  code: '010',
  name: 'Fixed Assets',
  namePl: 'Środki trwałe',
  description: 'Fixed assets account',
  type: 'asset',
  category: '0',
  nature: 'debit',
  status: 'active',
  parentId: null,
  level: 1,
  isSynthetic: true,
  isAnalytic: false,
  isOffBalance: false,
  allowManualEntry: true,
  requireCostCenter: false,
  requireProject: false,
  vatType: null,
  sortOrder: 1,
  tags: [],
  createdBy: TEST_USER_ID,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const createAuthenticatedContext = () => ({
  session: {
    userId: TEST_USER_ID,
    organizationId: TEST_ORG_ID,
    email: 'test@example.com',
    role: 'user',
  },
  prisma: {} as any,
  redis: {} as any,
  auditLogger: { log: vi.fn() } as any,
});

// ===========================================================================
// TESTS
// ===========================================================================

describe('AccountRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // CREATE ACCOUNT
  // =========================================================================

  describe('create', () => {
    it('should create account with valid input', async () => {
      mocks.createAccount.mockResolvedValue(sampleAccount);
      const ctx = createAuthenticatedContext();

      // Import router after mocks are set up
      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.create({
        code: '010',
        name: 'Fixed Assets',
        namePl: 'Środki trwałe',
        type: 'asset',
        nature: 'debit',
      });

      expect(result).toEqual(sampleAccount);
      expect(mocks.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          code: '010',
          name: 'Fixed Assets',
          namePl: 'Środki trwałe',
          type: 'asset',
          nature: 'debit',
        }),
      );
    });

    it('should create account with parent', async () => {
      const childAccount = { ...sampleAccount, id: '550e8400-e29b-41d4-a716-446655440002', parentId: '550e8400-e29b-41d4-a716-446655440001' };
      mocks.createAccount.mockResolvedValue(childAccount);
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.create({
        code: '010-01',
        name: 'Machinery',
        namePl: 'Maszyny i urządzenia',
        type: 'asset',
        nature: 'debit',
        parentId: '550e8400-e29b-41d4-a716-446655440001',
      });

      expect(result.parentId).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

    it('should create account with VAT settings', async () => {
      const vatAccount = { ...sampleAccount, vatType: 'standard' };
      mocks.createAccount.mockResolvedValue(vatAccount);
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.create({
        code: '221',
        name: 'VAT Account',
        namePl: 'Rozrachunki VAT',
        type: 'liability',
        nature: 'credit',
        vatType: 'standard',
      });

      expect(result.vatType).toBe('standard');
    });
  });

  // =========================================================================
  // GET ACCOUNT
  // =========================================================================

  describe('get', () => {
    it('should get account by ID', async () => {
      mocks.getAccount.mockResolvedValue(sampleAccount);
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.get({ id: '550e8400-e29b-41d4-a716-446655440001' });

      expect(result).toEqual(sampleAccount);
      expect(mocks.getAccount).toHaveBeenCalledWith(
        expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440001' }),
      );
    });

    it('should get account with children', async () => {
      const accountWithChildren = { ...sampleAccount, children: [] };
      mocks.getAccount.mockResolvedValue(accountWithChildren);
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.get({ id: '550e8400-e29b-41d4-a716-446655440001', includeChildren: true });

      expect(mocks.getAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '550e8400-e29b-41d4-a716-446655440001',
          includeChildren: true,
        }),
      );
    });

    it('should reject invalid UUID', async () => {
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      await expect(caller.get({ id: 'invalid' })).rejects.toThrow();
    });
  });

  // =========================================================================
  // GET ACCOUNT BY CODE
  // =========================================================================

  describe('getByCode', () => {
    it('should get account by code', async () => {
      mocks.getAccountByCode.mockResolvedValue(sampleAccount);
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.getByCode({ code: '010' });

      expect(result).toEqual(sampleAccount);
      expect(mocks.getAccountByCode).toHaveBeenCalledWith(
        expect.objectContaining({ code: '010' }),
      );
    });
  });

  // =========================================================================
  // LIST ACCOUNTS
  // =========================================================================

  describe('list', () => {
    it('should list accounts with pagination', async () => {
      const listResult = {
        items: [sampleAccount],
        total: 1,
        limit: 10,
        offset: 0,
      };
      mocks.listAccounts.mockResolvedValue(listResult);
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.list({ limit: 10, offset: 0 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by type', async () => {
      const listResult = { items: [sampleAccount], total: 1, limit: 10, offset: 0 };
      mocks.listAccounts.mockResolvedValue(listResult);
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      await caller.list({ type: 'asset', limit: 10, offset: 0 });

      expect(mocks.listAccounts).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'asset' })
      );
    });

    it('should filter by category', async () => {
      const listResult = { items: [sampleAccount], total: 1, limit: 10, offset: 0 };
      mocks.listAccounts.mockResolvedValue(listResult);
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      await caller.list({ category: '0', limit: 10, offset: 0 });

      expect(mocks.listAccounts).toHaveBeenCalledWith(
        expect.objectContaining({ category: '0' })
      );
    });

    it('should search accounts', async () => {
      const listResult = { items: [sampleAccount], total: 1, limit: 10, offset: 0 };
      mocks.listAccounts.mockResolvedValue(listResult);
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      await caller.list({ search: 'środki', limit: 10, offset: 0 });

      expect(mocks.listAccounts).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'środki' })
      );
    });

    it('should sort by code', async () => {
      const listResult = { items: [sampleAccount], total: 1, limit: 10, offset: 0 };
      mocks.listAccounts.mockResolvedValue(listResult);
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      await caller.list({ sortBy: 'code', sortOrder: 'asc', limit: 10, offset: 0 });

      expect(mocks.listAccounts).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'code', sortOrder: 'asc' })
      );
    });
  });

  // =========================================================================
  // UPDATE ACCOUNT
  // =========================================================================

  describe('update', () => {
    it('should update account name', async () => {
      const updatedAccount = { ...sampleAccount, name: 'Updated Name' };
      mocks.updateAccount.mockResolvedValue(updatedAccount);
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.update({ id: '550e8400-e29b-41d4-a716-446655440001', name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });

    it('should update account status', async () => {
      const updatedAccount = { ...sampleAccount, status: 'inactive' };
      mocks.updateAccount.mockResolvedValue(updatedAccount);
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.update({ id: '550e8400-e29b-41d4-a716-446655440001', status: 'inactive' });

      expect(result.status).toBe('inactive');
    });

    it('should update VAT type', async () => {
      const updatedAccount = { ...sampleAccount, vatType: 'reduced_8' };
      mocks.updateAccount.mockResolvedValue(updatedAccount);
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.update({ id: '550e8400-e29b-41d4-a716-446655440001', vatType: 'reduced_8' });

      expect(result.vatType).toBe('reduced_8');
    });
  });

  // =========================================================================
  // DELETE ACCOUNT
  // =========================================================================

  describe('delete', () => {
    it('should delete account', async () => {
      mocks.deleteAccount.mockResolvedValue({
        success: true,
        message: 'Konto zostało usunięte',
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.delete({ id: '550e8400-e29b-41d4-a716-446655440001' });

      expect(result.success).toBe(true);
    });

    it('should force delete account with children', async () => {
      mocks.deleteAccount.mockResolvedValue({
        success: true,
        message: 'Konto zostało usunięte',
        deletedChildrenCount: 3,
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.delete({ id: '550e8400-e29b-41d4-a716-446655440001', force: true });

      expect(result.success).toBe(true);
      expect(result.deletedChildrenCount).toBe(3);
    });
  });

  // =========================================================================
  // ACTIVATE/DEACTIVATE ACCOUNT
  // =========================================================================

  describe('activate', () => {
    it('should activate account', async () => {
      mocks.activateAccount.mockResolvedValue({
        success: true,
        account: { ...sampleAccount, status: 'active' },
        message: 'Konto zostało aktywowane',
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.activate({ id: '550e8400-e29b-41d4-a716-446655440001' });

      expect(result.success).toBe(true);
      expect(result.account.status).toBe('active');
    });
  });

  describe('deactivate', () => {
    it('should deactivate account', async () => {
      mocks.deactivateAccount.mockResolvedValue({
        success: true,
        account: { ...sampleAccount, status: 'inactive' },
        message: 'Konto zostało dezaktywowane',
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.deactivate({ id: '550e8400-e29b-41d4-a716-446655440001' });

      expect(result.success).toBe(true);
      expect(result.account.status).toBe('inactive');
    });

    it('should deactivate account with reason', async () => {
      mocks.deactivateAccount.mockResolvedValue({
        success: true,
        account: { ...sampleAccount, status: 'inactive' },
        message: 'Konto zostało dezaktywowane',
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      await caller.deactivate({ id: '550e8400-e29b-41d4-a716-446655440001', reason: 'No longer used' });

      expect(mocks.deactivateAccount).toHaveBeenCalledWith({
        id: '550e8400-e29b-41d4-a716-446655440001',
        reason: 'No longer used',
      });
    });
  });

  // =========================================================================
  // MOVE ACCOUNT
  // =========================================================================

  describe('move', () => {
    it('should move account to new parent', async () => {
      mocks.moveAccount.mockResolvedValue({
        success: true,
        account: { ...sampleAccount, parentId: '550e8400-e29b-41d4-a716-446655440003' },
        previousParentId: null,
        message: 'Konto zostało przeniesione',
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.move({ id: '550e8400-e29b-41d4-a716-446655440001', newParentId: '550e8400-e29b-41d4-a716-446655440003' });

      expect(result.success).toBe(true);
    });

    it('should move account to root level', async () => {
      mocks.moveAccount.mockResolvedValue({
        success: true,
        account: { ...sampleAccount, parentId: null },
        previousParentId: '550e8400-e29b-41d4-a716-446655440002',
        message: 'Konto zostało przeniesione',
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.move({ id: '550e8400-e29b-41d4-a716-446655440001', newParentId: null });

      expect(result.success).toBe(true);
      expect(result.account.parentId).toBeNull();
    });
  });

  // =========================================================================
  // GET ACCOUNT TREE
  // =========================================================================

  describe('getTree', () => {
    it('should get account tree', async () => {
      mocks.getAccountTree.mockResolvedValue({
        nodes: [{ ...sampleAccount, children: [], childrenCount: 0 }],
        totalAccounts: 1,
        maxDepth: 5,
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.getTree({});

      expect(result.nodes).toHaveLength(1);
      expect(result.totalAccounts).toBe(1);
    });

    it('should filter tree by category', async () => {
      mocks.getAccountTree.mockResolvedValue({
        nodes: [],
        totalAccounts: 0,
        maxDepth: 5,
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      await caller.getTree({ category: '0' });

      expect(mocks.getAccountTree).toHaveBeenCalledWith(
        expect.objectContaining({ category: '0' }),
      );
    });

    it('should include inactive accounts', async () => {
      mocks.getAccountTree.mockResolvedValue({
        nodes: [],
        totalAccounts: 0,
        maxDepth: 5,
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      await caller.getTree({ includeInactive: true });

      expect(mocks.getAccountTree).toHaveBeenCalledWith(
        expect.objectContaining({ includeInactive: true }),
      );
    });
  });

  // =========================================================================
  // SEARCH ACCOUNTS
  // =========================================================================

  describe('search', () => {
    it('should search accounts', async () => {
      mocks.searchAccounts.mockResolvedValue({
        items: [sampleAccount],
        total: 1,
        query: 'środki',
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.search({ query: 'środki' });

      expect(result.items).toHaveLength(1);
      expect(result.query).toBe('środki');
    });

    it('should search in specific fields', async () => {
      mocks.searchAccounts.mockResolvedValue({
        items: [sampleAccount],
        total: 1,
        query: '010',
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      await caller.search({ query: '010', searchIn: ['code'] });

      expect(mocks.searchAccounts).toHaveBeenCalledWith(
        expect.objectContaining({
          query: '010',
          searchIn: ['code'],
        }),
      );
    });

    it('should limit search results', async () => {
      mocks.searchAccounts.mockResolvedValue({
        items: [sampleAccount],
        total: 1,
        query: 'test',
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      await caller.search({ query: 'test', limit: 5 });

      expect(mocks.searchAccounts).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test',
          limit: 5,
        }),
      );
    });
  });

  // =========================================================================
  // VALIDATE ACCOUNT CODE
  // =========================================================================

  describe('validateCode', () => {
    it('should validate unique account code', async () => {
      mocks.validateAccountCode.mockResolvedValue({
        isValid: true,
        isUnique: true,
        suggestedCategory: '0',
        suggestedType: 'asset',
        suggestedNature: 'debit',
        errors: [],
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.validateCode({ code: '010' });

      expect(result.isValid).toBe(true);
      expect(result.isUnique).toBe(true);
    });

    it('should detect duplicate account code', async () => {
      mocks.validateAccountCode.mockResolvedValue({
        isValid: true,
        isUnique: false,
        suggestedCategory: '0',
        suggestedType: 'asset',
        suggestedNature: 'debit',
        errors: ['Konto o tym numerze już istnieje'],
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.validateCode({ code: '010' });

      expect(result.isUnique).toBe(false);
      expect(result.errors).toContain('Konto o tym numerze już istnieje');
    });
  });

  // =========================================================================
  // GET ACCOUNT BALANCE
  // =========================================================================

  describe('getBalance', () => {
    it('should get account balance', async () => {
      mocks.getAccountBalance.mockResolvedValue({
        accountId: '550e8400-e29b-41d4-a716-446655440001',
        accountCode: '010',
        accountName: 'Fixed Assets',
        openingDebit: 0,
        openingCredit: 0,
        openingBalance: 0,
        periodDebit: 1000,
        periodCredit: 500,
        closingDebit: 1000,
        closingCredit: 500,
        closingBalance: 500,
        entriesCount: 10,
        asOfDate: new Date(),
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.getBalance({ accountId: '550e8400-e29b-41d4-a716-446655440001' });

      expect(result.accountId).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(result.closingBalance).toBe(500);
    });

    it('should filter by fiscal year', async () => {
      mocks.getAccountBalance.mockResolvedValue({
        accountId: '550e8400-e29b-41d4-a716-446655440001',
        accountCode: '010',
        accountName: 'Fixed Assets',
        openingDebit: 0,
        openingCredit: 0,
        openingBalance: 0,
        periodDebit: 1000,
        periodCredit: 500,
        closingDebit: 1000,
        closingCredit: 500,
        closingBalance: 500,
        entriesCount: 5,
        asOfDate: new Date(),
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      await caller.getBalance({ accountId: '550e8400-e29b-41d4-a716-446655440001', fiscalYearId: '660e8400-e29b-41d4-a716-446655440001' });

      expect(mocks.getAccountBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: '550e8400-e29b-41d4-a716-446655440001',
          fiscalYearId: '660e8400-e29b-41d4-a716-446655440001',
        }),
      );
    });
  });

  // =========================================================================
  // BATCH CREATE ACCOUNTS
  // =========================================================================

  describe('batchCreate', () => {
    it('should create multiple accounts', async () => {
      mocks.batchCreateAccounts.mockResolvedValue({
        success: true,
        created: [sampleAccount],
        failed: [],
        message: 'Utworzono 1 kont',
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.batchCreate({
        accounts: [{
          code: '010',
          name: 'Fixed Assets',
          namePl: 'Środki trwałe',
          type: 'asset',
          nature: 'debit',
        }],
      });

      expect(result.success).toBe(true);
      expect(result.created).toHaveLength(1);
    });

    it('should skip errors when requested', async () => {
      mocks.batchCreateAccounts.mockResolvedValue({
        success: true,
        created: [sampleAccount],
        failed: [{ index: 1, code: '010', error: 'Duplicate code' }],
        message: 'Utworzono 1 kont, 1 błędów',
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.batchCreate({
        accounts: [
          { code: '010', name: 'Fixed Assets', namePl: 'Środki trwałe', type: 'asset', nature: 'debit' },
          { code: '020', name: 'Intangible Assets', namePl: 'Wartości niematerialne', type: 'asset', nature: 'debit' },
        ],
        skipErrors: true,
      });

      expect(result.created).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
    });
  });

  // =========================================================================
  // IMPORT ACCOUNTS
  // =========================================================================

  describe('import', () => {
    it('should import accounts from template', async () => {
      mocks.importAccounts.mockResolvedValue({
        success: true,
        imported: 50,
        updated: 0,
        skipped: 0,
        errors: [],
        message: 'Import zakończony',
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.import({ templateId: 'polish_standard' });

      expect(result.success).toBe(true);
      expect(result.imported).toBe(50);
    });
  });

  // =========================================================================
  // EXPORT ACCOUNTS
  // =========================================================================

  describe('export', () => {
    it('should export accounts as JSON', async () => {
      mocks.exportAccounts.mockResolvedValue({
        data: JSON.stringify([sampleAccount]),
        format: 'json',
        filename: 'accounts.json',
        accountsCount: 1,
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.export({ format: 'json' });

      expect(result.format).toBe('json');
      expect(result.accountsCount).toBe(1);
    });

    it('should export accounts as CSV', async () => {
      mocks.exportAccounts.mockResolvedValue({
        data: 'code,name\n010,Fixed Assets',
        format: 'csv',
        filename: 'accounts.csv',
        accountsCount: 1,
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.export({ format: 'csv' });

      expect(result.format).toBe('csv');
    });
  });

  // =========================================================================
  // GET STATISTICS
  // =========================================================================

  describe('getStatistics', () => {
    it('should get account statistics', async () => {
      mocks.getAccountStatistics.mockResolvedValue({
        totalAccounts: 100,
        activeAccounts: 90,
        inactiveAccounts: 10,
        syntheticAccounts: 20,
        analyticAccounts: 80,
        byType: { asset: 50, liability: 20, equity: 10, revenue: 10, expense: 10 },
        byCategory: { '0': 20, '1': 10, '2': 15, '3': 10, '4': 15, '5': 10, '6': 5, '7': 10, '8': 3, '9': 2 },
        accountsWithEntries: 60,
        accountsWithoutEntries: 40,
      });
      const ctx = createAuthenticatedContext();

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(ctx);

      const result = await caller.getStatistics({});

      expect(result.totalAccounts).toBe(100);
      expect(result.activeAccounts).toBe(90);
    });
  });

  // =========================================================================
  // AUTHENTICATION
  // =========================================================================

  describe('authentication', () => {
    it('should require authentication for all endpoints', async () => {
      const unauthenticatedContext = {
        session: null,
        prisma: {} as any,
        redis: {} as any,
        auditLogger: { log: vi.fn() } as any,
      };

      const { accountRouter } = await import('../../routers/ace/account.router');
      const caller = accountRouter.createCaller(unauthenticatedContext);

      await expect(caller.list({ limit: 10, offset: 0 })).rejects.toThrow();
    });
  });
});
