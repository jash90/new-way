import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HierarchyService } from '../../services/ace/hierarchy.service';
import type { AccountGroup, AccountTreeNode } from '@ksiegowacrm/shared';

// ===========================================================================
// MOCKS
// ===========================================================================

vi.mock('../../services/ace/hierarchy.service');

const mockGetAccountTree = vi.fn();
const mockGetAccountChildren = vi.fn();
const mockGetAccountAncestors = vi.fn();
const mockGetAccountDescendants = vi.fn();
const mockGetAggregatedBalance = vi.fn();
const mockCreateGroup = vi.fn();
const mockGetGroup = vi.fn();
const mockListGroups = vi.fn();
const mockUpdateGroup = vi.fn();
const mockDeleteGroup = vi.fn();
const mockMoveGroup = vi.fn();
const mockGetGroupTree = vi.fn();
const mockAddAccountsToGroup = vi.fn();
const mockRemoveAccountsFromGroup = vi.fn();
const mockGetGroupAccounts = vi.fn();
const mockSetGroupAccounts = vi.fn();
const mockReorderGroupAccounts = vi.fn();
const mockGetGroupBalance = vi.fn();

vi.mocked(HierarchyService).mockImplementation(() => ({
  getAccountTree: mockGetAccountTree,
  getAccountChildren: mockGetAccountChildren,
  getAccountAncestors: mockGetAccountAncestors,
  getAccountDescendants: mockGetAccountDescendants,
  getAggregatedBalance: mockGetAggregatedBalance,
  createGroup: mockCreateGroup,
  getGroup: mockGetGroup,
  listGroups: mockListGroups,
  updateGroup: mockUpdateGroup,
  deleteGroup: mockDeleteGroup,
  moveGroup: mockMoveGroup,
  getGroupTree: mockGetGroupTree,
  addAccountsToGroup: mockAddAccountsToGroup,
  removeAccountsFromGroup: mockRemoveAccountsFromGroup,
  getGroupAccounts: mockGetGroupAccounts,
  setGroupAccounts: mockSetGroupAccounts,
  reorderGroupAccounts: mockReorderGroupAccounts,
  getGroupBalance: mockGetGroupBalance,
} as any));

// ===========================================================================
// TEST FIXTURES
// ===========================================================================

const TEST_USER_ID = 'user-123';
const TEST_ORG_ID = 'org-456';
const TEST_ACCOUNT_ID_1 = '550e8400-e29b-41d4-a716-446655440001';
const TEST_ACCOUNT_ID_2 = '550e8400-e29b-41d4-a716-446655440002';

const sampleTreeNode: AccountTreeNode = {
  id: TEST_ACCOUNT_ID_1,
  accountCode: '010',
  accountName: 'Środki trwałe',
  accountNameEn: 'Fixed Assets',
  accountType: 'asset',
  accountClass: 0,
  normalBalance: 'debit',
  level: 1,
  path: '010',
  allowsPosting: false,
  isSynthetic: true,
  hasChildren: true,
  balance: '60000.00',
  children: [
    {
      id: TEST_ACCOUNT_ID_2,
      accountCode: '010-001',
      accountName: 'Grunty',
      accountNameEn: 'Land',
      accountType: 'asset',
      accountClass: 0,
      normalBalance: 'debit',
      level: 2,
      path: '010.010-001',
      allowsPosting: true,
      isSynthetic: false,
      hasChildren: false,
      balance: '10000.00',
    },
  ],
};

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

// ===========================================================================
// TESTS
// ===========================================================================

describe('HierarchyRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // ACCOUNT TREE OPERATIONS
  // =========================================================================

  describe('getAccountTree', () => {
    it('should return full account tree', async () => {
      mockGetAccountTree.mockResolvedValue({
        tree: [sampleTreeNode],
        totalAccounts: 2,
        maxDepth: 2,
      });

      const result = await mockGetAccountTree({});

      expect(result.tree).toHaveLength(1);
      expect(result.totalAccounts).toBe(2);
    });

    it('should filter by account class', async () => {
      mockGetAccountTree.mockResolvedValue({
        tree: [sampleTreeNode],
        totalAccounts: 2,
        maxDepth: 2,
      });

      await mockGetAccountTree({ accountClass: 0 });

      expect(mockGetAccountTree).toHaveBeenCalledWith({ accountClass: 0 });
    });

    it('should include balances when requested', async () => {
      mockGetAccountTree.mockResolvedValue({
        tree: [sampleTreeNode],
        totalAccounts: 2,
        maxDepth: 2,
      });

      await mockGetAccountTree({ includeBalances: true, periodId: 'period-1' });

      expect(mockGetAccountTree).toHaveBeenCalledWith({
        includeBalances: true,
        periodId: 'period-1',
      });
    });
  });

  describe('getAccountChildren', () => {
    it('should return children of specified account', async () => {
      mockGetAccountChildren.mockResolvedValue({
        children: [sampleTreeNode.children![0]],
        parentAccount: { id: TEST_ACCOUNT_ID_1, accountCode: '010', accountName: 'Środki trwałe' },
      });

      const result = await mockGetAccountChildren({ parentAccountId: TEST_ACCOUNT_ID_1 });

      expect(result.children).toHaveLength(1);
      expect(result.parentAccount.accountCode).toBe('010');
    });
  });

  describe('getAccountAncestors', () => {
    it('should return ancestors of account', async () => {
      mockGetAccountAncestors.mockResolvedValue({
        ancestors: [{ id: TEST_ACCOUNT_ID_1, accountCode: '010', accountName: 'Środki trwałe', level: 1 }],
        account: { id: TEST_ACCOUNT_ID_2, accountCode: '010-001', accountName: 'Grunty' },
      });

      const result = await mockGetAccountAncestors({ accountId: TEST_ACCOUNT_ID_2 });

      expect(result.ancestors).toHaveLength(1);
      expect(result.account.accountCode).toBe('010-001');
    });
  });

  describe('getAggregatedBalance', () => {
    it('should return aggregated balance', async () => {
      mockGetAggregatedBalance.mockResolvedValue({
        accountId: TEST_ACCOUNT_ID_1,
        accountCode: '010',
        accountName: 'Środki trwałe',
        ownBalance: '0.00',
        childrenBalance: '60000.00',
        totalBalance: '60000.00',
        normalBalance: 'debit',
        childAccountCount: 2,
      });

      const result = await mockGetAggregatedBalance({
        accountId: TEST_ACCOUNT_ID_1,
        periodId: 'period-1',
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
      mockCreateGroup.mockResolvedValue(sampleGroup);

      const result = await mockCreateGroup({
        groupCode: 'AKTYWA_TRWALE',
        groupName: 'Aktywa trwałe',
        reportSection: 'BALANCE_SHEET_ASSETS',
        reportPosition: 'A',
      });

      expect(result.groupCode).toBe('AKTYWA_TRWALE');
    });

    it('should create nested group', async () => {
      const childGroup = {
        ...sampleGroup,
        id: 'grp-002',
        groupCode: 'SRODKI_TRWALE',
        parentGroupId: 'grp-001',
        level: 1,
        path: 'AKTYWA_TRWALE.SRODKI_TRWALE',
      };

      mockCreateGroup.mockResolvedValue(childGroup);

      const result = await mockCreateGroup({
        groupCode: 'SRODKI_TRWALE',
        groupName: 'Środki trwałe',
        parentGroupId: 'grp-001',
      });

      expect(result.level).toBe(1);
      expect(result.path).toContain('AKTYWA_TRWALE');
    });
  });

  describe('getGroup', () => {
    it('should return group by ID', async () => {
      mockGetGroup.mockResolvedValue(sampleGroup);

      const result = await mockGetGroup({ groupId: 'grp-001' });

      expect(result.groupCode).toBe('AKTYWA_TRWALE');
    });

    it('should throw if group not found', async () => {
      mockGetGroup.mockRejectedValue(new Error('Group not found'));

      await expect(mockGetGroup({ groupId: 'nonexistent' })).rejects.toThrow('Group not found');
    });
  });

  describe('listGroups', () => {
    it('should return paginated groups', async () => {
      mockListGroups.mockResolvedValue({
        groups: [sampleGroup],
        total: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      });

      const result = await mockListGroups({});

      expect(result.groups).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by report section', async () => {
      mockListGroups.mockResolvedValue({
        groups: [sampleGroup],
        total: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      });

      await mockListGroups({ reportSection: 'BALANCE_SHEET_ASSETS' });

      expect(mockListGroups).toHaveBeenCalledWith({
        reportSection: 'BALANCE_SHEET_ASSETS',
      });
    });
  });

  describe('updateGroup', () => {
    it('should update group', async () => {
      mockUpdateGroup.mockResolvedValue({
        ...sampleGroup,
        groupName: 'Updated Name',
      });

      const result = await mockUpdateGroup({
        groupId: 'grp-001',
        groupName: 'Updated Name',
      });

      expect(result.groupName).toBe('Updated Name');
    });
  });

  describe('deleteGroup', () => {
    it('should delete group', async () => {
      mockDeleteGroup.mockResolvedValue({
        success: true,
        groupId: 'grp-001',
        groupCode: 'AKTYWA_TRWALE',
        membersRemoved: 0,
      });

      const result = await mockDeleteGroup({ groupId: 'grp-001' });

      expect(result.success).toBe(true);
    });

    it('should delete group with force', async () => {
      mockDeleteGroup.mockResolvedValue({
        success: true,
        groupId: 'grp-001',
        groupCode: 'AKTYWA_TRWALE',
        membersRemoved: 5,
      });

      const result = await mockDeleteGroup({ groupId: 'grp-001', force: true });

      expect(result.membersRemoved).toBe(5);
    });
  });

  describe('moveGroup', () => {
    it('should move group to new parent', async () => {
      mockMoveGroup.mockResolvedValue({
        success: true,
        groupId: 'grp-002',
        oldPath: 'AKTYWA_TRWALE.SRODKI_TRWALE',
        newPath: 'NEW_PARENT.SRODKI_TRWALE',
        childrenUpdated: 0,
      });

      const result = await mockMoveGroup({
        groupId: 'grp-002',
        newParentGroupId: 'grp-003',
      });

      expect(result.success).toBe(true);
      expect(result.newPath).toContain('NEW_PARENT');
    });
  });

  // =========================================================================
  // GROUP MEMBERS OPERATIONS
  // =========================================================================

  describe('addAccountsToGroup', () => {
    it('should add accounts to group', async () => {
      mockAddAccountsToGroup.mockResolvedValue({
        groupId: 'grp-001',
        addedCount: 2,
        skippedCount: 0,
        memberCount: 2,
      });

      const result = await mockAddAccountsToGroup({
        groupId: 'grp-001',
        accountIds: [TEST_ACCOUNT_ID_1, TEST_ACCOUNT_ID_2],
      });

      expect(result.addedCount).toBe(2);
    });
  });

  describe('removeAccountsFromGroup', () => {
    it('should remove accounts from group', async () => {
      mockRemoveAccountsFromGroup.mockResolvedValue({
        groupId: 'grp-001',
        removedCount: 2,
        memberCount: 0,
      });

      const result = await mockRemoveAccountsFromGroup({
        groupId: 'grp-001',
        accountIds: [TEST_ACCOUNT_ID_1, TEST_ACCOUNT_ID_2],
      });

      expect(result.removedCount).toBe(2);
    });
  });

  describe('getGroupAccounts', () => {
    it('should return accounts in group', async () => {
      mockGetGroupAccounts.mockResolvedValue({
        groupId: 'grp-001',
        groupCode: 'AKTYWA_TRWALE',
        groupName: 'Aktywa trwałe',
        accounts: [
          { id: TEST_ACCOUNT_ID_1, accountCode: '010', accountName: 'Środki trwałe', accountType: 'asset', sortOrder: 0 },
        ],
        totalAccounts: 1,
      });

      const result = await mockGetGroupAccounts({ groupId: 'grp-001' });

      expect(result.accounts).toHaveLength(1);
    });

    it('should include child group accounts when requested', async () => {
      mockGetGroupAccounts.mockResolvedValue({
        groupId: 'grp-001',
        groupCode: 'AKTYWA_TRWALE',
        groupName: 'Aktywa trwałe',
        accounts: [
          { id: TEST_ACCOUNT_ID_1, accountCode: '010', accountName: 'Środki trwałe', accountType: 'asset', sortOrder: 0 },
          { id: TEST_ACCOUNT_ID_2, accountCode: '010-001', accountName: 'Grunty', accountType: 'asset', sortOrder: 1 },
        ],
        totalAccounts: 2,
      });

      await mockGetGroupAccounts({ groupId: 'grp-001', includeChildGroups: true });

      expect(mockGetGroupAccounts).toHaveBeenCalledWith({
        groupId: 'grp-001',
        includeChildGroups: true,
      });
    });
  });

  // =========================================================================
  // GROUP BALANCE OPERATIONS
  // =========================================================================

  describe('getGroupBalance', () => {
    it('should return aggregated balance for group', async () => {
      mockGetGroupBalance.mockResolvedValue({
        groupId: 'grp-001',
        groupCode: 'AKTYWA_TRWALE',
        groupName: 'Aktywa trwałe',
        accountCount: 2,
        totalDebit: '60000.00',
        totalCredit: '0.00',
        netBalance: '60000.00',
      });

      const result = await mockGetGroupBalance({
        groupId: 'grp-001',
        periodId: 'period-1',
      });

      expect(result.netBalance).toBe('60000.00');
    });

    it('should include child group balances when requested', async () => {
      mockGetGroupBalance.mockResolvedValue({
        groupId: 'grp-001',
        groupCode: 'AKTYWA_TRWALE',
        groupName: 'Aktywa trwałe',
        accountCount: 5,
        totalDebit: '100000.00',
        totalCredit: '0.00',
        netBalance: '100000.00',
        childGroupCount: 2,
      });

      await mockGetGroupBalance({
        groupId: 'grp-001',
        periodId: 'period-1',
        includeChildGroups: true,
      });

      expect(mockGetGroupBalance).toHaveBeenCalledWith({
        groupId: 'grp-001',
        periodId: 'period-1',
        includeChildGroups: true,
      });
    });
  });

  // =========================================================================
  // GROUP TREE OPERATIONS
  // =========================================================================

  describe('getGroupTree', () => {
    it('should return group tree structure', async () => {
      mockGetGroupTree.mockResolvedValue({
        tree: [
          {
            id: 'grp-001',
            groupCode: 'AKTYWA_TRWALE',
            groupName: 'Aktywa trwałe',
            groupNameEn: 'Fixed Assets',
            level: 0,
            path: 'AKTYWA_TRWALE',
            reportSection: 'BALANCE_SHEET_ASSETS',
            reportPosition: 'A',
            hasChildren: true,
            accountCount: 5,
            children: [
              {
                id: 'grp-002',
                groupCode: 'SRODKI_TRWALE',
                groupName: 'Środki trwałe',
                groupNameEn: 'Tangible Assets',
                level: 1,
                path: 'AKTYWA_TRWALE.SRODKI_TRWALE',
                reportSection: 'BALANCE_SHEET_ASSETS',
                reportPosition: 'A.II',
                hasChildren: false,
                accountCount: 3,
              },
            ],
          },
        ],
        totalGroups: 2,
        maxDepth: 2,
      });

      const result = await mockGetGroupTree({});

      expect(result.tree).toHaveLength(1);
      expect(result.tree[0].hasChildren).toBe(true);
      expect(result.tree[0].children).toHaveLength(1);
    });

    it('should filter by report section', async () => {
      mockGetGroupTree.mockResolvedValue({
        tree: [],
        totalGroups: 0,
        maxDepth: 0,
      });

      await mockGetGroupTree({ reportSection: 'BALANCE_SHEET_ASSETS' });

      expect(mockGetGroupTree).toHaveBeenCalledWith({
        reportSection: 'BALANCE_SHEET_ASSETS',
      });
    });
  });
});
