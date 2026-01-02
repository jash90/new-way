import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountService } from '../../services/ace/account.service';
import type { Account, ChartAccountType, AccountCategory, AccountNature, AccountStatus } from '@ksiegowacrm/shared';

// ===========================================================================
// MOCKS
// ===========================================================================

const mockPrisma = {
  account: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    createMany: vi.fn(),
    groupBy: vi.fn(),
  },
  journalLine: {
    count: vi.fn(),
    aggregate: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn((fn) => fn(mockPrisma)),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn().mockResolvedValue([]),
};

const mockAuditLogger = {
  log: vi.fn(),
};

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_USER_ID = 'user-123';
const TEST_ORG_ID = 'org-456';

const sampleAccount: Account = {
  id: 'acc-001',
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

const sampleChildAccount: Account = {
  ...sampleAccount,
  id: 'acc-002',
  code: '010-01',
  name: 'Machinery',
  namePl: 'Maszyny i urządzenia',
  parentId: 'acc-001',
  level: 2,
  isSynthetic: false,
  isAnalytic: true,
};

const sampleCashAccount: Account = {
  ...sampleAccount,
  id: 'acc-003',
  code: '100',
  name: 'Cash',
  namePl: 'Kasa',
  category: '1',
  level: 1,
  isSynthetic: true,
};

// ===========================================================================
// TESTS
// ===========================================================================

describe('AccountService', () => {
  let service: AccountService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccountService(
      mockPrisma as any,
      mockRedis as any,
      mockAuditLogger as any,
      TEST_USER_ID,
      TEST_ORG_ID
    );
  });

  // =========================================================================
  // CREATE ACCOUNT
  // =========================================================================

  describe('createAccount', () => {
    it('should create a synthetic account successfully', async () => {
      const input = {
        code: '010',
        name: 'Fixed Assets',
        namePl: 'Środki trwałe',
        type: 'asset' as ChartAccountType,
        nature: 'debit' as AccountNature,
        isSynthetic: true,
      };

      mockPrisma.account.findFirst.mockResolvedValue(null); // No existing account
      mockPrisma.account.create.mockResolvedValue(sampleAccount);

      const result = await service.createAccount(input);

      expect(result).toEqual(sampleAccount);
      expect(mockPrisma.account.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: '010',
          name: 'Fixed Assets',
          namePl: 'Środki trwałe',
          type: 'asset',
          nature: 'debit',
          organizationId: TEST_ORG_ID,
          createdBy: TEST_USER_ID,
        }),
      });
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'account.create',
          entityType: 'Account',
        })
      );
    });

    it('should create an analytic account with parent', async () => {
      const input = {
        code: '010-01',
        name: 'Machinery',
        namePl: 'Maszyny i urządzenia',
        type: 'asset' as ChartAccountType,
        nature: 'debit' as AccountNature,
        parentId: 'acc-001',
        isSynthetic: false,
      };

      mockPrisma.account.findFirst
        .mockResolvedValueOnce(null) // No existing account with code
        .mockResolvedValueOnce(sampleAccount); // Parent exists
      mockPrisma.account.create.mockResolvedValue(sampleChildAccount);

      const result = await service.createAccount(input);

      expect(result).toEqual(sampleChildAccount);
      expect(mockPrisma.account.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: '010-01',
          parentId: 'acc-001',
          level: 2,
          isAnalytic: true,
        }),
      });
    });

    it('should reject duplicate account code', async () => {
      const input = {
        code: '010',
        name: 'Fixed Assets',
        namePl: 'Środki trwałe',
        type: 'asset' as ChartAccountType,
        nature: 'debit' as AccountNature,
      };

      mockPrisma.account.findFirst.mockResolvedValue(sampleAccount);

      await expect(service.createAccount(input)).rejects.toThrow(
        'Konto o numerze 010 już istnieje'
      );
    });

    it('should reject invalid account code format', async () => {
      const input = {
        code: 'ABC', // Invalid - must start with digit
        name: 'Invalid Account',
        namePl: 'Nieprawidłowe konto',
        type: 'asset' as ChartAccountType,
        nature: 'debit' as AccountNature,
      };

      await expect(service.createAccount(input)).rejects.toThrow(
        'Nieprawidłowy format numeru konta'
      );
    });

    it('should reject if parent account does not exist', async () => {
      const input = {
        code: '010-01',
        name: 'Machinery',
        namePl: 'Maszyny i urządzenia',
        type: 'asset' as ChartAccountType,
        nature: 'debit' as AccountNature,
        parentId: 'non-existent',
      };

      mockPrisma.account.findFirst
        .mockResolvedValueOnce(null) // No existing account with code
        .mockResolvedValueOnce(null); // Parent doesn't exist

      await expect(service.createAccount(input)).rejects.toThrow(
        'Konto nadrzędne nie istnieje'
      );
    });

    it('should auto-detect category from account code', async () => {
      const input = {
        code: '401',
        name: 'Costs',
        namePl: 'Koszty',
        type: 'expense' as ChartAccountType,
        nature: 'debit' as AccountNature,
      };

      mockPrisma.account.findFirst.mockResolvedValue(null);
      mockPrisma.account.create.mockResolvedValue({
        ...sampleAccount,
        code: '401',
        category: '4',
        type: 'expense',
      });

      await service.createAccount(input);

      expect(mockPrisma.account.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          category: '4',
        }),
      });
    });

    it('should invalidate cache after creation', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);
      mockPrisma.account.create.mockResolvedValue(sampleAccount);
      mockRedis.keys.mockResolvedValue([`account:${TEST_ORG_ID}:list`]);

      await service.createAccount({
        code: '010',
        name: 'Fixed Assets',
        namePl: 'Środki trwałe',
        type: 'asset' as ChartAccountType,
        nature: 'debit' as AccountNature,
      });

      expect(mockRedis.keys).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // GET ACCOUNT
  // =========================================================================

  describe('getAccount', () => {
    it('should return account by ID', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(sampleAccount);

      const result = await service.getAccount({ id: 'acc-001' });

      expect(result).toEqual(sampleAccount);
      expect(mockPrisma.account.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'acc-001',
          organizationId: TEST_ORG_ID,
        },
        include: expect.any(Object),
      });
    });

    it('should return account with children when requested', async () => {
      const accountWithChildren = {
        ...sampleAccount,
        children: [sampleChildAccount],
      };
      mockPrisma.account.findFirst.mockResolvedValue(accountWithChildren);

      const result = await service.getAccount({
        id: 'acc-001',
        includeChildren: true,
      });

      expect(result).toEqual(accountWithChildren);
      expect(mockPrisma.account.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object),
        include: expect.objectContaining({
          children: true,
        }),
      });
    });

    it('should return account with parent when requested', async () => {
      const accountWithParent = {
        ...sampleChildAccount,
        parent: sampleAccount,
      };
      mockPrisma.account.findFirst.mockResolvedValue(accountWithParent);

      const result = await service.getAccount({
        id: 'acc-002',
        includeParent: true,
      });

      expect(result).toEqual(accountWithParent);
    });

    it('should throw error when account not found', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);

      await expect(
        service.getAccount({ id: 'non-existent' })
      ).rejects.toThrow('Konto nie zostało znalezione');
    });

    it('should use cache when available', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(sampleAccount));

      const result = await service.getAccount({ id: 'acc-001' });

      // Note: JSON.parse returns dates as strings, so we compare with parsed version
      expect(result).toEqual(JSON.parse(JSON.stringify(sampleAccount)));
      expect(mockPrisma.account.findFirst).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // GET ACCOUNT BY CODE
  // =========================================================================

  describe('getAccountByCode', () => {
    it('should return account by code', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(sampleAccount);

      const result = await service.getAccountByCode({ code: '010' });

      expect(result).toEqual(sampleAccount);
      expect(mockPrisma.account.findFirst).toHaveBeenCalledWith({
        where: {
          code: '010',
          organizationId: TEST_ORG_ID,
        },
        include: expect.any(Object),
      });
    });

    it('should throw error when account not found', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);

      await expect(
        service.getAccountByCode({ code: '999' })
      ).rejects.toThrow('Konto o numerze 999 nie istnieje');
    });
  });

  // =========================================================================
  // LIST ACCOUNTS
  // =========================================================================

  describe('listAccounts', () => {
    it('should return paginated list of accounts', async () => {
      mockPrisma.account.findMany.mockResolvedValue([sampleAccount, sampleCashAccount]);
      mockPrisma.account.count.mockResolvedValue(2);

      const result = await service.listAccounts({ limit: 10, offset: 0 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });

    it('should filter by account type', async () => {
      mockPrisma.account.findMany.mockResolvedValue([sampleAccount]);
      mockPrisma.account.count.mockResolvedValue(1);

      await service.listAccounts({ type: 'asset', limit: 10, offset: 0 });

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'asset',
          }),
        })
      );
    });

    it('should filter by category', async () => {
      mockPrisma.account.findMany.mockResolvedValue([sampleAccount]);
      mockPrisma.account.count.mockResolvedValue(1);

      await service.listAccounts({ category: '0', limit: 10, offset: 0 });

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: '0',
          }),
        })
      );
    });

    it('should filter by status', async () => {
      mockPrisma.account.findMany.mockResolvedValue([sampleAccount]);
      mockPrisma.account.count.mockResolvedValue(1);

      await service.listAccounts({ status: 'active', limit: 10, offset: 0 });

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'active',
          }),
        })
      );
    });

    it('should filter by synthetic accounts only', async () => {
      mockPrisma.account.findMany.mockResolvedValue([sampleAccount]);
      mockPrisma.account.count.mockResolvedValue(1);

      await service.listAccounts({ isSynthetic: true, limit: 10, offset: 0 });

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isSynthetic: true,
          }),
        })
      );
    });

    it('should search accounts by text', async () => {
      mockPrisma.account.findMany.mockResolvedValue([sampleAccount]);
      mockPrisma.account.count.mockResolvedValue(1);

      await service.listAccounts({ search: 'środki', limit: 10, offset: 0 });

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                namePl: expect.objectContaining({
                  contains: 'środki',
                }),
              }),
            ]),
          }),
        })
      );
    });

    it('should sort accounts by code ascending', async () => {
      mockPrisma.account.findMany.mockResolvedValue([sampleAccount, sampleCashAccount]);
      mockPrisma.account.count.mockResolvedValue(2);

      await service.listAccounts({
        limit: 10,
        offset: 0,
        sortBy: 'code',
        sortOrder: 'asc',
      });

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { code: 'asc' },
        })
      );
    });

    it('should filter by parent ID (root accounts)', async () => {
      mockPrisma.account.findMany.mockResolvedValue([sampleAccount, sampleCashAccount]);
      mockPrisma.account.count.mockResolvedValue(2);

      await service.listAccounts({ parentId: null, limit: 10, offset: 0 });

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId: null,
          }),
        })
      );
    });
  });

  // =========================================================================
  // UPDATE ACCOUNT
  // =========================================================================

  describe('updateAccount', () => {
    it('should update account name', async () => {
      const updatedAccount = {
        ...sampleAccount,
        name: 'Updated Name',
      };
      mockPrisma.account.findFirst.mockResolvedValue(sampleAccount);
      mockPrisma.account.update.mockResolvedValue(updatedAccount);

      const result = await service.updateAccount({
        id: 'acc-001',
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'account.update',
        })
      );
    });

    it('should update account status', async () => {
      const updatedAccount = {
        ...sampleAccount,
        status: 'inactive' as AccountStatus,
      };
      mockPrisma.account.findFirst.mockResolvedValue(sampleAccount);
      mockPrisma.account.update.mockResolvedValue(updatedAccount);

      const result = await service.updateAccount({
        id: 'acc-001',
        status: 'inactive',
      });

      expect(result.status).toBe('inactive');
    });

    it('should reject update for non-existent account', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);

      await expect(
        service.updateAccount({ id: 'non-existent', name: 'New Name' })
      ).rejects.toThrow('Konto nie zostało znalezione');
    });

    it('should invalidate cache after update', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(sampleAccount);
      mockPrisma.account.update.mockResolvedValue(sampleAccount);
      mockRedis.keys.mockResolvedValue([`account:${TEST_ORG_ID}:acc-001`]);

      await service.updateAccount({ id: 'acc-001', name: 'Updated' });

      expect(mockRedis.keys).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // DELETE ACCOUNT
  // =========================================================================

  describe('deleteAccount', () => {
    it('should delete account without children', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(sampleAccount);
      mockPrisma.account.count.mockResolvedValue(0); // No children
      mockPrisma.journalLine.count.mockResolvedValue(0); // No journal entries
      mockPrisma.account.delete.mockResolvedValue(sampleAccount);

      const result = await service.deleteAccount({ id: 'acc-001' });

      expect(result.success).toBe(true);
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'account.delete',
        })
      );
    });

    it('should reject delete if account has children', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(sampleAccount);
      mockPrisma.account.count.mockResolvedValue(3); // Has children
      mockPrisma.journalLine.count.mockResolvedValue(0);

      await expect(
        service.deleteAccount({ id: 'acc-001' })
      ).rejects.toThrow('Nie można usunąć konta posiadającego konta podrzędne');
    });

    it('should force delete account with children', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(sampleAccount);
      mockPrisma.account.count.mockResolvedValue(3);
      mockPrisma.journalLine.count.mockResolvedValue(0);
      mockPrisma.account.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.account.delete.mockResolvedValue(sampleAccount);

      const result = await service.deleteAccount({
        id: 'acc-001',
        force: true,
      });

      expect(result.success).toBe(true);
      expect(result.deletedChildrenCount).toBe(3);
    });

    it('should reject delete if account has journal entries', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(sampleAccount);
      mockPrisma.account.count.mockResolvedValue(0);
      mockPrisma.journalLine.count.mockResolvedValue(5);

      await expect(
        service.deleteAccount({ id: 'acc-001' })
      ).rejects.toThrow('Nie można usunąć konta z zapisami księgowymi');
    });
  });

  // =========================================================================
  // ACTIVATE/DEACTIVATE ACCOUNT
  // =========================================================================

  describe('activateAccount', () => {
    it('should activate inactive account', async () => {
      const inactiveAccount = { ...sampleAccount, status: 'inactive' as AccountStatus };
      mockPrisma.account.findFirst.mockResolvedValue(inactiveAccount);
      mockPrisma.account.update.mockResolvedValue({ ...sampleAccount, status: 'active' });

      const result = await service.activateAccount({ id: 'acc-001' });

      expect(result.success).toBe(true);
      expect(result.account.status).toBe('active');
    });

    it('should reject if account is already active', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(sampleAccount);

      await expect(
        service.activateAccount({ id: 'acc-001' })
      ).rejects.toThrow('Konto jest już aktywne');
    });
  });

  describe('deactivateAccount', () => {
    it('should deactivate active account', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(sampleAccount);
      mockPrisma.account.update.mockResolvedValue({ ...sampleAccount, status: 'inactive' });

      const result = await service.deactivateAccount({ id: 'acc-001' });

      expect(result.success).toBe(true);
      expect(result.account.status).toBe('inactive');
    });

    it('should reject if account is already inactive', async () => {
      const inactiveAccount = { ...sampleAccount, status: 'inactive' as AccountStatus };
      mockPrisma.account.findFirst.mockResolvedValue(inactiveAccount);

      await expect(
        service.deactivateAccount({ id: 'acc-001' })
      ).rejects.toThrow('Konto jest już nieaktywne');
    });
  });

  // =========================================================================
  // MOVE ACCOUNT
  // =========================================================================

  describe('moveAccount', () => {
    it('should move account to new parent', async () => {
      mockPrisma.account.findFirst
        .mockResolvedValueOnce(sampleChildAccount) // Account to move
        .mockResolvedValueOnce(sampleCashAccount); // New parent
      mockPrisma.account.update.mockResolvedValue({
        ...sampleChildAccount,
        parentId: 'acc-003',
      });

      const result = await service.moveAccount({
        id: 'acc-002',
        newParentId: 'acc-003',
      });

      expect(result.success).toBe(true);
      expect(result.previousParentId).toBe('acc-001');
    });

    it('should move account to root level', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(sampleChildAccount);
      mockPrisma.account.update.mockResolvedValue({
        ...sampleChildAccount,
        parentId: null,
        level: 1,
      });

      const result = await service.moveAccount({
        id: 'acc-002',
        newParentId: null,
      });

      expect(result.success).toBe(true);
      expect(result.account.parentId).toBeNull();
    });

    it('should reject moving account to itself', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(sampleAccount);

      await expect(
        service.moveAccount({ id: 'acc-001', newParentId: 'acc-001' })
      ).rejects.toThrow('Konto nie może być swoim własnym rodzicem');
    });

    it('should reject if new parent does not exist', async () => {
      mockPrisma.account.findFirst
        .mockResolvedValueOnce(sampleChildAccount)
        .mockResolvedValueOnce(null);

      await expect(
        service.moveAccount({ id: 'acc-002', newParentId: 'non-existent' })
      ).rejects.toThrow('Nowe konto nadrzędne nie istnieje');
    });
  });

  // =========================================================================
  // GET ACCOUNT TREE
  // =========================================================================

  describe('getAccountTree', () => {
    it('should return account tree structure', async () => {
      const accounts = [
        sampleAccount,
        sampleChildAccount,
        sampleCashAccount,
      ];
      mockPrisma.account.findMany.mockResolvedValue(accounts);

      const result = await service.getAccountTree({});

      expect(result.nodes).toBeDefined();
      expect(result.totalAccounts).toBe(3);
    });

    it('should filter tree by category', async () => {
      mockPrisma.account.findMany.mockResolvedValue([sampleAccount, sampleChildAccount]);

      await service.getAccountTree({ category: '0' });

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: '0',
          }),
        })
      );
    });

    it('should exclude inactive accounts by default', async () => {
      mockPrisma.account.findMany.mockResolvedValue([sampleAccount]);

      await service.getAccountTree({});

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'active',
          }),
        })
      );
    });

    it('should include inactive accounts when requested', async () => {
      mockPrisma.account.findMany.mockResolvedValue([sampleAccount]);

      await service.getAccountTree({ includeInactive: true });

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            status: 'active',
          }),
        })
      );
    });
  });

  // =========================================================================
  // SEARCH ACCOUNTS
  // =========================================================================

  describe('searchAccounts', () => {
    it('should search accounts by query', async () => {
      mockPrisma.account.findMany.mockResolvedValue([sampleAccount]);
      mockPrisma.account.count.mockResolvedValue(1);

      const result = await service.searchAccounts({
        query: 'środki',
      });

      expect(result.items).toHaveLength(1);
      expect(result.query).toBe('środki');
    });

    it('should search in specified fields', async () => {
      mockPrisma.account.findMany.mockResolvedValue([sampleAccount]);
      mockPrisma.account.count.mockResolvedValue(1);

      await service.searchAccounts({
        query: '010',
        searchIn: ['code'],
      });

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                code: expect.objectContaining({ contains: '010' }),
              }),
            ]),
          }),
        })
      );
    });

    it('should limit search results', async () => {
      mockPrisma.account.findMany.mockResolvedValue([sampleAccount]);
      mockPrisma.account.count.mockResolvedValue(1);

      await service.searchAccounts({ query: 'test', limit: 5 });

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        })
      );
    });
  });

  // =========================================================================
  // VALIDATE ACCOUNT CODE
  // =========================================================================

  describe('validateAccountCode', () => {
    it('should validate unique account code', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);

      const result = await service.validateAccountCode({ code: '010' });

      expect(result.isValid).toBe(true);
      expect(result.isUnique).toBe(true);
      expect(result.suggestedCategory).toBe('0');
      expect(result.suggestedType).toBe('asset');
      expect(result.suggestedNature).toBe('debit');
    });

    it('should detect duplicate account code', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(sampleAccount);

      const result = await service.validateAccountCode({ code: '010' });

      expect(result.isValid).toBe(true);
      expect(result.isUnique).toBe(false);
      expect(result.errors).toContain('Konto o tym numerze już istnieje');
    });

    it('should exclude specific ID when validating', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);

      await service.validateAccountCode({
        code: '010',
        excludeId: 'acc-001',
      });

      expect(mockPrisma.account.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: { not: 'acc-001' },
        }),
      });
    });

    it('should reject invalid account code format', async () => {
      const result = await service.validateAccountCode({ code: 'ABC' });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Numer konta musi zaczynać się od cyfry');
    });
  });

  // =========================================================================
  // GET ACCOUNT BALANCE
  // =========================================================================

  describe('getAccountBalance', () => {
    it('should return account balance', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(sampleAccount);
      mockPrisma.journalLine.aggregate.mockResolvedValue({
        _sum: { debit: 1000, credit: 500 },
        _count: { id: 10 },
      });

      const result = await service.getAccountBalance({
        accountId: 'acc-001',
      });

      expect(result.accountId).toBe('acc-001');
      expect(result.periodDebit).toBe(1000);
      expect(result.periodCredit).toBe(500);
      expect(result.closingBalance).toBe(500); // debit - credit for debit nature
    });

    it('should filter by fiscal year', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(sampleAccount);
      mockPrisma.journalLine.aggregate.mockResolvedValue({
        _sum: { debit: 1000, credit: 500 },
        _count: { id: 5 },
      });

      await service.getAccountBalance({
        accountId: 'acc-001',
        fiscalYearId: 'fy-001',
      });

      expect(mockPrisma.journalLine.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            journalEntry: expect.objectContaining({
              fiscalYearId: 'fy-001',
            }),
          }),
        })
      );
    });

    it('should filter by date', async () => {
      const asOfDate = new Date('2024-06-30');
      mockPrisma.account.findFirst.mockResolvedValue(sampleAccount);
      mockPrisma.journalLine.aggregate.mockResolvedValue({
        _sum: { debit: 500, credit: 200 },
        _count: { id: 3 },
      });

      await service.getAccountBalance({
        accountId: 'acc-001',
        asOfDate,
      });

      expect(mockPrisma.journalLine.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            journalEntry: expect.objectContaining({
              entryDate: expect.objectContaining({
                lte: asOfDate,
              }),
            }),
          }),
        })
      );
    });
  });

  // =========================================================================
  // BATCH CREATE ACCOUNTS
  // =========================================================================

  describe('batchCreateAccounts', () => {
    it('should create multiple accounts', async () => {
      const accountsInput = [
        {
          code: '010',
          name: 'Fixed Assets',
          namePl: 'Środki trwałe',
          type: 'asset' as ChartAccountType,
          nature: 'debit' as AccountNature,
        },
        {
          code: '100',
          name: 'Cash',
          namePl: 'Kasa',
          type: 'asset' as ChartAccountType,
          nature: 'debit' as AccountNature,
        },
      ];

      mockPrisma.account.findFirst.mockResolvedValue(null);
      mockPrisma.account.create
        .mockResolvedValueOnce(sampleAccount)
        .mockResolvedValueOnce(sampleCashAccount);

      const result = await service.batchCreateAccounts({
        accounts: accountsInput,
      });

      expect(result.success).toBe(true);
      expect(result.created).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });

    it('should skip errors when requested', async () => {
      const accountsInput = [
        {
          code: '010',
          name: 'Fixed Assets',
          namePl: 'Środki trwałe',
          type: 'asset' as ChartAccountType,
          nature: 'debit' as AccountNature,
        },
        {
          code: 'ABC', // Invalid
          name: 'Invalid',
          namePl: 'Nieprawidłowy',
          type: 'asset' as ChartAccountType,
          nature: 'debit' as AccountNature,
        },
      ];

      mockPrisma.account.findFirst.mockResolvedValue(null);
      mockPrisma.account.create.mockResolvedValue(sampleAccount);

      const result = await service.batchCreateAccounts({
        accounts: accountsInput,
        skipErrors: true,
      });

      expect(result.created).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].code).toBe('ABC');
    });

    it('should fail all on error without skipErrors', async () => {
      const accountsInput = [
        {
          code: 'ABC', // Invalid
          name: 'Invalid',
          namePl: 'Nieprawidłowy',
          type: 'asset' as ChartAccountType,
          nature: 'debit' as AccountNature,
        },
      ];

      await expect(
        service.batchCreateAccounts({ accounts: accountsInput })
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // GET ACCOUNT STATISTICS
  // =========================================================================

  describe('getAccountStatistics', () => {
    it('should return account statistics', async () => {
      mockPrisma.account.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(90) // active
        .mockResolvedValueOnce(10) // inactive
        .mockResolvedValueOnce(20) // synthetic
        .mockResolvedValueOnce(80); // analytic
      mockPrisma.account.groupBy
        .mockResolvedValueOnce([
          { type: 'asset', _count: { id: 50 } },
          { type: 'expense', _count: { id: 30 } },
          { type: 'revenue', _count: { id: 20 } },
        ])
        .mockResolvedValueOnce([
          { category: '0', _count: { id: 20 } },
          { category: '4', _count: { id: 30 } },
          { category: '7', _count: { id: 20 } },
        ]);
      mockPrisma.journalLine.findMany.mockResolvedValue([
        { accountId: 'acc-001' },
        { accountId: 'acc-002' },
      ]);

      const result = await service.getAccountStatistics({});

      expect(result.totalAccounts).toBe(100);
      expect(result.activeAccounts).toBe(90);
      expect(result.inactiveAccounts).toBe(10);
      expect(result.syntheticAccounts).toBe(20);
      expect(result.analyticAccounts).toBe(80);
    });
  });

  // =========================================================================
  // IMPORT/EXPORT ACCOUNTS
  // =========================================================================

  describe('importAccounts', () => {
    it('should import accounts from template', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);
      mockPrisma.account.create.mockResolvedValue(sampleAccount);

      const result = await service.importAccounts({
        templateId: 'polish_standard',
      });

      expect(result.success).toBe(true);
      expect(result.imported).toBeGreaterThan(0);
    });

    it('should import custom accounts', async () => {
      const customAccounts = [
        {
          code: '010',
          name: 'Fixed Assets',
          namePl: 'Środki trwałe',
          type: 'asset' as ChartAccountType,
          nature: 'debit' as AccountNature,
        },
      ];

      mockPrisma.account.findFirst.mockResolvedValue(null);
      mockPrisma.account.create.mockResolvedValue(sampleAccount);

      const result = await service.importAccounts({
        accounts: customAccounts,
      });

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
    });
  });

  describe('exportAccounts', () => {
    it('should export accounts as JSON', async () => {
      mockPrisma.account.findMany.mockResolvedValue([sampleAccount, sampleCashAccount]);

      const result = await service.exportAccounts({ format: 'json' });

      expect(result.format).toBe('json');
      expect(result.accountsCount).toBe(2);
      const data = JSON.parse(result.data);
      expect(data).toHaveLength(2);
    });

    it('should export accounts as CSV', async () => {
      mockPrisma.account.findMany.mockResolvedValue([sampleAccount]);

      const result = await service.exportAccounts({ format: 'csv' });

      expect(result.format).toBe('csv');
      expect(result.data).toContain('code');
      expect(result.data).toContain('010');
    });

    it('should filter export by category', async () => {
      mockPrisma.account.findMany.mockResolvedValue([sampleAccount]);

      await service.exportAccounts({ format: 'json', category: '0' });

      expect(mockPrisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: '0',
          }),
        })
      );
    });
  });
});
