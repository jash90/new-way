import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HierarchyService } from '../../services/ace/hierarchy.service';
import type {
  AccountGroup,
  AccountTreeNode,
  ReportSection,
} from '@ksiegowacrm/shared';
import { Decimal } from 'decimal.js';

// ===========================================================================
// MOCKS
// ===========================================================================

const mockPrisma = {
  chartOfAccount: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  accountGroup: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  accountGroupMember: {
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  accountBalance: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
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

const sampleAccounts = [
  {
    id: 'acc-001',
    organizationId: TEST_ORG_ID,
    accountCode: '010',
    accountName: 'Środki trwałe',
    accountNameEn: 'Fixed Assets',
    accountType: 'asset',
    accountClass: 0,
    normalBalance: 'debit',
    parentAccountId: null,
    level: 1,
    path: '010',
    allowsPosting: false,
    isSynthetic: true,
    status: 'active',
  },
  {
    id: 'acc-002',
    organizationId: TEST_ORG_ID,
    accountCode: '010-001',
    accountName: 'Grunty',
    accountNameEn: 'Land',
    accountType: 'asset',
    accountClass: 0,
    normalBalance: 'debit',
    parentAccountId: 'acc-001',
    level: 2,
    path: '010.010-001',
    allowsPosting: true,
    isSynthetic: false,
    status: 'active',
  },
  {
    id: 'acc-003',
    organizationId: TEST_ORG_ID,
    accountCode: '010-002',
    accountName: 'Budynki',
    accountNameEn: 'Buildings',
    accountType: 'asset',
    accountClass: 0,
    normalBalance: 'debit',
    parentAccountId: 'acc-001',
    level: 2,
    path: '010.010-002',
    allowsPosting: true,
    isSynthetic: false,
    status: 'active',
  },
  {
    id: 'acc-100',
    organizationId: TEST_ORG_ID,
    accountCode: '100',
    accountName: 'Kasa',
    accountNameEn: 'Cash',
    accountType: 'asset',
    accountClass: 1,
    normalBalance: 'debit',
    parentAccountId: null,
    level: 1,
    path: '100',
    allowsPosting: true,
    isSynthetic: false,
    status: 'active',
  },
];

const sampleAccountBalances = [
  { accountId: 'acc-002', periodId: 'period-1', closingBalance: new Decimal('10000.00') },
  { accountId: 'acc-003', periodId: 'period-1', closingBalance: new Decimal('50000.00') },
  { accountId: 'acc-100', periodId: 'period-1', closingBalance: new Decimal('5000.00') },
];

const sampleGroup: AccountGroup = {
  id: 'grp-001',
  organizationId: TEST_ORG_ID,
  groupCode: 'AKTYWA_TRWALE',
  groupName: 'Aktywa trwałe',
  groupNameEn: 'Fixed Assets',
  parentGroupId: null,
  level: 0,
  path: 'AKTYWA_TRWALE',
  reportSection: 'BALANCE_SHEET_ASSETS',
  reportPosition: 'A',
  description: 'Wszystkie aktywa trwałe',
  sortOrder: 1,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  createdBy: TEST_USER_ID,
  updatedAt: new Date('2024-01-01'),
  updatedBy: null,
};

const sampleChildGroup: AccountGroup = {
  ...sampleGroup,
  id: 'grp-002',
  groupCode: 'SRODKI_TRWALE',
  groupName: 'Środki trwałe',
  groupNameEn: 'Tangible Assets',
  parentGroupId: 'grp-001',
  level: 1,
  path: 'AKTYWA_TRWALE.SRODKI_TRWALE',
  reportPosition: 'A.II',
  sortOrder: 2,
};

// ===========================================================================
// TESTS
// ===========================================================================

describe('HierarchyService', () => {
  let service: HierarchyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new HierarchyService(
      mockPrisma as any,
      mockRedis as any,
      mockAuditLogger as any,
      TEST_USER_ID,
      TEST_ORG_ID
    );
  });

  // =========================================================================
  // ACCOUNT TREE OPERATIONS
  // =========================================================================

  describe('getAccountTree', () => {
    it('should return full account tree', async () => {
      mockPrisma.chartOfAccount.findMany.mockResolvedValue(sampleAccounts);

      const result = await service.getAccountTree({});

      expect(result.tree).toBeDefined();
      expect(result.totalAccounts).toBe(4);
      expect(mockPrisma.chartOfAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: TEST_ORG_ID,
          }),
        })
      );
    });

    it('should filter by account class', async () => {
      mockPrisma.chartOfAccount.findMany.mockResolvedValue(
        sampleAccounts.filter((a) => a.accountClass === 0)
      );

      await service.getAccountTree({ accountClass: 0 });

      expect(mockPrisma.chartOfAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountClass: 0,
          }),
        })
      );
    });

    it('should include balances when requested', async () => {
      mockPrisma.chartOfAccount.findMany.mockResolvedValue(sampleAccounts);
      mockPrisma.accountBalance.findMany.mockResolvedValue(sampleAccountBalances);

      const result = await service.getAccountTree({
        includeBalances: true,
        periodId: 'period-1',
      });

      expect(mockPrisma.accountBalance.findMany).toHaveBeenCalled();
    });

    it('should build correct tree structure with parent-child relationships', async () => {
      mockPrisma.chartOfAccount.findMany.mockResolvedValue(sampleAccounts);

      const result = await service.getAccountTree({});

      // Root level should have 2 accounts (010 and 100)
      const rootAccounts = result.tree.filter((n) => !n.children || n.hasChildren);
      expect(rootAccounts.length).toBeGreaterThanOrEqual(2);

      // Find account 010 and check its children
      const account010 = result.tree.find((n) => n.accountCode === '010');
      expect(account010).toBeDefined();
      expect(account010?.hasChildren).toBe(true);
      expect(account010?.children?.length).toBe(2);
    });

    it('should exclude inactive accounts by default', async () => {
      mockPrisma.chartOfAccount.findMany.mockResolvedValue(sampleAccounts);

      await service.getAccountTree({ includeInactive: false });

      expect(mockPrisma.chartOfAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'active',
          }),
        })
      );
    });
  });

  describe('getAccountChildren', () => {
    it('should return children of specified account', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValue(sampleAccounts[0]);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([
        sampleAccounts[1],
        sampleAccounts[2],
      ]);

      const result = await service.getAccountChildren({
        parentAccountId: 'acc-001',
      });

      expect(result.children).toHaveLength(2);
      expect(result.parentAccount.accountCode).toBe('010');
    });

    it('should throw error if parent not found', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.getAccountChildren({ parentAccountId: 'nonexistent' })
      ).rejects.toThrow('Account not found');
    });
  });

  describe('getAccountAncestors', () => {
    it('should return ancestors of account', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValueOnce(sampleAccounts[1]); // Child account
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([sampleAccounts[0]]); // Parent

      const result = await service.getAccountAncestors({
        accountId: 'acc-002',
      });

      expect(result.ancestors).toBeDefined();
      expect(result.account.accountCode).toBe('010-001');
    });

    it('should throw error if account not found', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.getAccountAncestors({ accountId: 'nonexistent' })
      ).rejects.toThrow('Account not found');
    });
  });

  describe('getAggregatedBalance', () => {
    it('should calculate aggregated balance including children', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValue(sampleAccounts[0]);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue([
        sampleAccounts[1],
        sampleAccounts[2],
      ]);
      // Mock own balance
      mockPrisma.accountBalance.findFirst.mockResolvedValue({
        accountId: 'acc-001',
        closingBalance: new Decimal('0.00'),
      });
      mockPrisma.accountBalance.findMany.mockResolvedValue([
        { accountId: 'acc-002', closingBalance: new Decimal('10000.00') },
        { accountId: 'acc-003', closingBalance: new Decimal('50000.00') },
      ]);

      const result = await service.getAggregatedBalance({
        accountId: 'acc-001',
        periodId: 'period-1',
        includeChildren: true,
      });

      expect(result.totalBalance).toBe('60000.00');
      expect(result.childAccountCount).toBe(2);
    });
  });

  // =========================================================================
  // ACCOUNT GROUP CRUD OPERATIONS
  // =========================================================================

  describe('createGroup', () => {
    it('should create account group', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(null);
      mockPrisma.accountGroup.create.mockResolvedValue(sampleGroup);

      const result = await service.createGroup({
        groupCode: 'AKTYWA_TRWALE',
        groupName: 'Aktywa trwałe',
        groupNameEn: 'Fixed Assets',
        reportSection: 'BALANCE_SHEET_ASSETS',
        reportPosition: 'A',
        sortOrder: 1,
      });

      expect(result.groupCode).toBe('AKTYWA_TRWALE');
      expect(mockPrisma.accountGroup.create).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'hierarchy.group.create',
        })
      );
    });

    it('should create nested group with correct path', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValueOnce(null); // No duplicate
      mockPrisma.accountGroup.findFirst.mockResolvedValueOnce(sampleGroup); // Parent
      mockPrisma.accountGroup.create.mockResolvedValue(sampleChildGroup);

      const result = await service.createGroup({
        groupCode: 'SRODKI_TRWALE',
        groupName: 'Środki trwałe',
        parentGroupId: 'grp-001',
        reportSection: 'BALANCE_SHEET_ASSETS',
        reportPosition: 'A.II',
      });

      expect(result.level).toBe(1);
      expect(result.path).toContain('AKTYWA_TRWALE');
    });

    it('should throw error if group code already exists', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(sampleGroup);

      await expect(
        service.createGroup({
          groupCode: 'AKTYWA_TRWALE',
          groupName: 'Duplicate Group',
        })
      ).rejects.toThrow('Group code already exists');
    });
  });

  describe('getGroup', () => {
    it('should return group by ID', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(sampleGroup);

      const result = await service.getGroup({ groupId: 'grp-001' });

      expect(result.groupCode).toBe('AKTYWA_TRWALE');
    });

    it('should throw error if group not found', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(null);

      await expect(service.getGroup({ groupId: 'nonexistent' })).rejects.toThrow(
        'Group not found'
      );
    });
  });

  describe('listGroups', () => {
    it('should return paginated groups', async () => {
      mockPrisma.accountGroup.findMany.mockResolvedValue([sampleGroup, sampleChildGroup]);
      mockPrisma.accountGroup.count.mockResolvedValue(2);

      const result = await service.listGroups({});

      expect(result.groups).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by report section', async () => {
      mockPrisma.accountGroup.findMany.mockResolvedValue([sampleGroup]);
      mockPrisma.accountGroup.count.mockResolvedValue(1);

      await service.listGroups({ reportSection: 'BALANCE_SHEET_ASSETS' });

      expect(mockPrisma.accountGroup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reportSection: 'BALANCE_SHEET_ASSETS',
          }),
        })
      );
    });

    it('should filter by parent group', async () => {
      mockPrisma.accountGroup.findMany.mockResolvedValue([sampleChildGroup]);
      mockPrisma.accountGroup.count.mockResolvedValue(1);

      await service.listGroups({ parentGroupId: 'grp-001' });

      expect(mockPrisma.accountGroup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentGroupId: 'grp-001',
          }),
        })
      );
    });
  });

  describe('updateGroup', () => {
    it('should update group', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(sampleGroup);
      mockPrisma.accountGroup.update.mockResolvedValue({
        ...sampleGroup,
        groupName: 'Updated Name',
      });

      const result = await service.updateGroup({
        groupId: 'grp-001',
        groupName: 'Updated Name',
      });

      expect(result.groupName).toBe('Updated Name');
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'hierarchy.group.update',
        })
      );
    });
  });

  describe('deleteGroup', () => {
    it('should delete group with no members', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(sampleGroup);
      mockPrisma.accountGroupMember.count.mockResolvedValue(0);
      mockPrisma.accountGroup.count.mockResolvedValue(0); // No child groups
      mockPrisma.accountGroup.delete.mockResolvedValue(sampleGroup);

      const result = await service.deleteGroup({ groupId: 'grp-001' });

      expect(result.success).toBe(true);
      expect(result.groupCode).toBe('AKTYWA_TRWALE');
    });

    it('should throw error if group has members without force', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(sampleGroup);
      mockPrisma.accountGroupMember.count.mockResolvedValue(5);

      await expect(
        service.deleteGroup({ groupId: 'grp-001', force: false })
      ).rejects.toThrow('Group has members');
    });

    it('should delete group with members when force is true', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(sampleGroup);
      mockPrisma.accountGroupMember.count.mockResolvedValue(5);
      mockPrisma.accountGroup.count.mockResolvedValue(0);
      mockPrisma.accountGroupMember.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.accountGroup.delete.mockResolvedValue(sampleGroup);

      const result = await service.deleteGroup({ groupId: 'grp-001', force: true });

      expect(result.success).toBe(true);
      expect(result.membersRemoved).toBe(5);
    });
  });

  describe('moveGroup', () => {
    it('should move group to new parent', async () => {
      const newParent = { ...sampleGroup, id: 'grp-003', path: 'NEW_PARENT' };
      mockPrisma.accountGroup.findFirst.mockResolvedValueOnce(sampleChildGroup);
      mockPrisma.accountGroup.findFirst.mockResolvedValueOnce(newParent);
      mockPrisma.accountGroup.update.mockResolvedValue({
        ...sampleChildGroup,
        parentGroupId: 'grp-003',
        path: 'NEW_PARENT.SRODKI_TRWALE',
      });
      mockPrisma.accountGroup.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.moveGroup({
        groupId: 'grp-002',
        newParentGroupId: 'grp-003',
      });

      expect(result.success).toBe(true);
      expect(result.newPath).toContain('NEW_PARENT');
    });

    it('should move group to root level', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(sampleChildGroup);
      mockPrisma.accountGroup.update.mockResolvedValue({
        ...sampleChildGroup,
        parentGroupId: null,
        path: 'SRODKI_TRWALE',
        level: 0,
      });
      mockPrisma.accountGroup.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.moveGroup({
        groupId: 'grp-002',
        newParentGroupId: null,
      });

      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // GROUP MEMBERS OPERATIONS
  // =========================================================================

  describe('addAccountsToGroup', () => {
    it('should add accounts to group', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(sampleGroup);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue(sampleAccounts.slice(0, 2));
      mockPrisma.accountGroupMember.findMany.mockResolvedValue([]);
      mockPrisma.accountGroupMember.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.accountGroupMember.count.mockResolvedValue(2);

      const result = await service.addAccountsToGroup({
        groupId: 'grp-001',
        accountIds: ['acc-001', 'acc-002'],
      });

      expect(result.addedCount).toBe(2);
      expect(result.memberCount).toBe(2);
    });

    it('should skip accounts already in group', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(sampleGroup);
      mockPrisma.chartOfAccount.findMany.mockResolvedValue(sampleAccounts.slice(0, 2));
      mockPrisma.accountGroupMember.findMany.mockResolvedValue([
        { accountId: 'acc-001', groupId: 'grp-001' },
      ]);
      mockPrisma.accountGroupMember.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.accountGroupMember.count.mockResolvedValue(2);

      const result = await service.addAccountsToGroup({
        groupId: 'grp-001',
        accountIds: ['acc-001', 'acc-002'],
      });

      expect(result.addedCount).toBe(1);
      expect(result.skippedCount).toBe(1);
    });
  });

  describe('removeAccountsFromGroup', () => {
    it('should remove accounts from group', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(sampleGroup);
      mockPrisma.accountGroupMember.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.accountGroupMember.count.mockResolvedValue(0);

      const result = await service.removeAccountsFromGroup({
        groupId: 'grp-001',
        accountIds: ['acc-001', 'acc-002'],
      });

      expect(result.removedCount).toBe(2);
      expect(result.memberCount).toBe(0);
    });
  });

  describe('getGroupAccounts', () => {
    it('should return accounts in group', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(sampleGroup);
      mockPrisma.accountGroupMember.findMany.mockResolvedValue([
        { accountId: 'acc-001', sortOrder: 0, account: sampleAccounts[0] },
        { accountId: 'acc-002', sortOrder: 1, account: sampleAccounts[1] },
      ]);

      const result = await service.getGroupAccounts({ groupId: 'grp-001' });

      expect(result.accounts).toHaveLength(2);
      expect(result.totalAccounts).toBe(2);
    });

    it('should include accounts from child groups when requested', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(sampleGroup);
      mockPrisma.accountGroup.findMany.mockResolvedValue([sampleGroup, sampleChildGroup]);
      mockPrisma.accountGroupMember.findMany.mockResolvedValue([
        { accountId: 'acc-001', sortOrder: 0, account: sampleAccounts[0] },
        { accountId: 'acc-002', sortOrder: 1, account: sampleAccounts[1] },
        { accountId: 'acc-003', sortOrder: 0, account: sampleAccounts[2] },
      ]);

      const result = await service.getGroupAccounts({
        groupId: 'grp-001',
        includeChildGroups: true,
      });

      expect(result.accounts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('reorderGroupAccounts', () => {
    it('should reorder accounts within group', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(sampleGroup);
      mockPrisma.accountGroupMember.updateMany.mockResolvedValue({ count: 2 });

      await service.reorderGroupAccounts({
        groupId: 'grp-001',
        accountOrdering: [
          { accountId: 'acc-002', sortOrder: 0 },
          { accountId: 'acc-001', sortOrder: 1 },
        ],
      });

      expect(mockPrisma.accountGroupMember.updateMany).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // GROUP BALANCE OPERATIONS
  // =========================================================================

  describe('getGroupBalance', () => {
    it('should return aggregated balance for group', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(sampleGroup);
      mockPrisma.accountGroupMember.findMany.mockResolvedValue([
        { accountId: 'acc-001' },
        { accountId: 'acc-002' },
      ]);
      mockPrisma.accountBalance.findMany.mockResolvedValue([
        { accountId: 'acc-001', closingBalance: new Decimal('10000.00') },
        { accountId: 'acc-002', closingBalance: new Decimal('20000.00') },
      ]);

      const result = await service.getGroupBalance({
        groupId: 'grp-001',
        periodId: 'period-1',
      });

      expect(result.accountCount).toBe(2);
      expect(result.netBalance).toBe('30000.00');
    });

    it('should include child group balances when requested', async () => {
      mockPrisma.accountGroup.findFirst.mockResolvedValue(sampleGroup);
      // Only return child groups (groups with parentGroupId matching the queried group)
      mockPrisma.accountGroup.findMany.mockResolvedValue([sampleChildGroup]);
      mockPrisma.accountGroupMember.findMany.mockResolvedValue([
        { accountId: 'acc-001' },
        { accountId: 'acc-002' },
        { accountId: 'acc-003' },
      ]);
      mockPrisma.accountBalance.findMany.mockResolvedValue([
        { accountId: 'acc-001', closingBalance: new Decimal('10000.00') },
        { accountId: 'acc-002', closingBalance: new Decimal('20000.00') },
        { accountId: 'acc-003', closingBalance: new Decimal('30000.00') },
      ]);

      const result = await service.getGroupBalance({
        groupId: 'grp-001',
        periodId: 'period-1',
        includeChildGroups: true,
      });

      expect(result.accountCount).toBe(3);
      expect(result.netBalance).toBe('60000.00');
      expect(result.childGroupCount).toBe(1);
    });
  });

  // =========================================================================
  // GROUP TREE OPERATIONS
  // =========================================================================

  describe('getGroupTree', () => {
    it('should return group tree structure', async () => {
      mockPrisma.accountGroup.findMany.mockResolvedValue([sampleGroup, sampleChildGroup]);
      mockPrisma.accountGroupMember.count.mockResolvedValue(2);

      const result = await service.getGroupTree({});

      expect(result.tree).toBeDefined();
      expect(result.totalGroups).toBe(2);
    });

    it('should filter by report section', async () => {
      mockPrisma.accountGroup.findMany.mockResolvedValue([sampleGroup, sampleChildGroup]);
      mockPrisma.accountGroupMember.count.mockResolvedValue(2);

      await service.getGroupTree({ reportSection: 'BALANCE_SHEET_ASSETS' });

      expect(mockPrisma.accountGroup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reportSection: 'BALANCE_SHEET_ASSETS',
          }),
        })
      );
    });

    it('should build correct hierarchy', async () => {
      mockPrisma.accountGroup.findMany.mockResolvedValue([sampleGroup, sampleChildGroup]);
      mockPrisma.accountGroupMember.count.mockResolvedValue(2);

      const result = await service.getGroupTree({});

      // Root level should have 1 group
      const rootGroups = result.tree.filter((g) => g.level === 0);
      expect(rootGroups.length).toBe(1);
      expect(rootGroups[0].hasChildren).toBe(true);
    });
  });
});
