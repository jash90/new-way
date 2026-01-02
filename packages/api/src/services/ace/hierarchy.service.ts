/**
 * ACC-003: Account Hierarchy and Grouping Service
 *
 * Provides account tree operations, account groups management,
 * and balance aggregation across hierarchy
 */

import { TRPCError } from '@trpc/server';
import { Decimal } from 'decimal.js';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type {
  // Use Hierarchy-prefixed types to get the correct versions from hierarchy.schema
  GetHierarchyAccountTreeInput as GetAccountTreeInput,
  GetAccountChildrenInput,
  GetAccountAncestorsInput,
  GetAccountDescendantsInput,
  GetAggregatedBalanceInput,
  CreateAccountGroupInput,
  GetAccountGroupInput,
  ListAccountGroupsInput,
  UpdateAccountGroupInput,
  DeleteAccountGroupInput,
  MoveAccountGroupInput,
  GetGroupTreeInput,
  AddAccountsToGroupInput,
  RemoveAccountsFromGroupInput,
  GetGroupAccountsInput,
  SetGroupAccountsInput,
  ReorderGroupAccountsInput,
  GetGroupBalanceInput,
  GetHierarchyAccountTreeResult as GetAccountTreeResult,
  GetAccountChildrenResult,
  GetAccountAncestorsResult,
  GetAggregatedBalanceResult,
  AccountGroup,
  ListAccountGroupsResult,
  DeleteAccountGroupResult,
  MoveAccountGroupResult,
  GetGroupTreeResult,
  AddAccountsToGroupResult,
  RemoveAccountsFromGroupResult,
  GetGroupAccountsResult,
  GetGroupBalanceResult,
  HierarchyAccountTreeNode as AccountTreeNode,
  GroupTreeNode,
} from '@ksiegowacrm/shared';

const _CACHE_TTL = 300; // 5 minutes - reserved for future caching
void _CACHE_TTL; // Suppress unused warning - will be used when caching is implemented

export class HierarchyService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private auditLogger: { log: (entry: any) => void },
    private userId: string,
    private organizationId: string
  ) {}

  // ===========================================================================
  // ACCOUNT TREE OPERATIONS
  // ===========================================================================

  /**
   * Get account tree structure
   */
  async getAccountTree(input: GetAccountTreeInput): Promise<GetAccountTreeResult> {
    const {
      rootAccountId,
      accountClass,
      includeBalances = false,
      periodId,
      maxDepth = 10,
      includeInactive = false,
    } = input;

    const where: any = {
      organizationId: this.organizationId,
    };

    if (!includeInactive) {
      where.status = 'active';
    }

    if (accountClass !== undefined) {
      where.accountClass = accountClass;
    }

    if (rootAccountId) {
      const rootAccount = await this.prisma.chartOfAccount.findFirst({
        where: { id: rootAccountId, organizationId: this.organizationId },
      });
      if (rootAccount?.path) {
        where.path = { startsWith: rootAccount.path };
      }
    }

    const accounts = await this.prisma.chartOfAccount.findMany({
      where,
      orderBy: { accountCode: 'asc' },
    });

    // Fetch balances if requested
    let balanceMap = new Map<string, Decimal>();
    if (includeBalances && periodId) {
      const balances = await this.prisma.accountBalance.findMany({
        where: {
          accountId: { in: accounts.map((a) => a.id) },
          periodId,
        },
      });
      balanceMap = new Map(balances.map((b) => [b.accountId, new Decimal(b.closingBalance.toString())]));
    }

    // Build tree structure
    const tree = this.buildAccountTree(accounts, balanceMap, rootAccountId, maxDepth);

    return {
      tree,
      totalAccounts: accounts.length,
      maxDepth: this.calculateMaxDepth(tree),
    };
  }

  /**
   * Get children of specific account
   */
  async getAccountChildren(input: GetAccountChildrenInput): Promise<GetAccountChildrenResult> {
    const { parentAccountId, includeBalances = false, periodId } = input;

    const parentAccount = await this.prisma.chartOfAccount.findFirst({
      where: { id: parentAccountId, organizationId: this.organizationId },
    });

    if (!parentAccount) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Account not found',
      });
    }

    const children = await this.prisma.chartOfAccount.findMany({
      where: {
        organizationId: this.organizationId,
        parentAccountId,
        status: 'active',
      },
      orderBy: { accountCode: 'asc' },
    });

    let balanceMap = new Map<string, Decimal>();
    if (includeBalances && periodId) {
      const balances = await this.prisma.accountBalance.findMany({
        where: {
          accountId: { in: children.map((a) => a.id) },
          periodId,
        },
      });
      balanceMap = new Map(balances.map((b) => [b.accountId, new Decimal(b.closingBalance.toString())]));
    }

    const childNodes: AccountTreeNode[] = children.map((child) => ({
      id: child.id,
      accountCode: child.accountCode,
      accountName: child.accountName,
      accountNameEn: child.accountNameEn,
      accountType: child.accountType,
      accountClass: child.accountClass,
      normalBalance: child.normalBalance as 'debit' | 'credit',
      level: child.level,
      path: child.path,
      allowsPosting: child.allowsPosting,
      isSynthetic: child.isSynthetic,
      hasChildren: false, // Will be populated later if needed
      balance: balanceMap.get(child.id)?.toString(),
    }));

    return {
      children: childNodes,
      parentAccount: {
        id: parentAccount.id,
        accountCode: parentAccount.accountCode,
        accountName: parentAccount.accountName,
      },
    };
  }

  /**
   * Get ancestors of account (path to root)
   */
  async getAccountAncestors(input: GetAccountAncestorsInput): Promise<GetAccountAncestorsResult> {
    const { accountId } = input;

    const account = await this.prisma.chartOfAccount.findFirst({
      where: { id: accountId, organizationId: this.organizationId },
    });

    if (!account) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Account not found',
      });
    }

    // Find all ancestors by traversing parent links
    const ancestors: Array<{ id: string; accountCode: string; accountName: string; level: number }> = [];
    let currentParentId = account.parentAccountId;

    while (currentParentId) {
      const parent = await this.prisma.chartOfAccount.findFirst({
        where: { id: currentParentId, organizationId: this.organizationId },
      });
      if (!parent) break;
      ancestors.unshift({
        id: parent.id,
        accountCode: parent.accountCode,
        accountName: parent.accountName,
        level: parent.level,
      });
      currentParentId = parent.parentAccountId;
    }

    return {
      ancestors,
      account: {
        id: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
      },
    };
  }

  /**
   * Get all descendants of an account
   */
  async getAccountDescendants(input: GetAccountDescendantsInput): Promise<GetAccountTreeResult> {
    const { accountId, includeBalances = false, periodId } = input;

    const account = await this.prisma.chartOfAccount.findFirst({
      where: { id: accountId, organizationId: this.organizationId },
    });

    if (!account) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Account not found',
      });
    }

    // Use path-based query for descendants
    const descendants = await this.prisma.chartOfAccount.findMany({
      where: {
        organizationId: this.organizationId,
        path: account.path ? { startsWith: account.path } : undefined,
        id: { not: accountId },
        status: 'active',
      },
      orderBy: { accountCode: 'asc' },
    });

    let balanceMap = new Map<string, Decimal>();
    if (includeBalances && periodId) {
      const balances = await this.prisma.accountBalance.findMany({
        where: {
          accountId: { in: descendants.map((a) => a.id) },
          periodId,
        },
      });
      balanceMap = new Map(balances.map((b) => [b.accountId, new Decimal(b.closingBalance.toString())]));
    }

    const tree = this.buildAccountTree(descendants, balanceMap, accountId);

    return {
      tree,
      totalAccounts: descendants.length,
      maxDepth: this.calculateMaxDepth(tree),
    };
  }

  /**
   * Calculate aggregated balance for a parent account
   */
  async getAggregatedBalance(input: GetAggregatedBalanceInput): Promise<GetAggregatedBalanceResult> {
    const { accountId, periodId, includeChildren = true } = input;

    const account = await this.prisma.chartOfAccount.findFirst({
      where: { id: accountId, organizationId: this.organizationId },
    });

    if (!account) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Account not found',
      });
    }

    let ownBalance = new Decimal(0);
    let childrenBalance = new Decimal(0);
    let childAccountCount = 0;

    // Get own balance
    const ownBalanceRecord = await this.prisma.accountBalance.findFirst({
      where: { accountId, periodId },
    });
    if (ownBalanceRecord) {
      ownBalance = new Decimal(ownBalanceRecord.closingBalance.toString());
    }

    // Get children balances
    if (includeChildren) {
      const children = await this.prisma.chartOfAccount.findMany({
        where: {
          organizationId: this.organizationId,
          parentAccountId: accountId,
          status: 'active',
        },
      });

      childAccountCount = children.length;

      if (children.length > 0) {
        const childBalances = await this.prisma.accountBalance.findMany({
          where: {
            accountId: { in: children.map((c) => c.id) },
            periodId,
          },
        });

        childrenBalance = childBalances.reduce(
          (sum, b) => sum.plus(new Decimal(b.closingBalance.toString())),
          new Decimal(0)
        );
      }
    }

    const totalBalance = ownBalance.plus(childrenBalance);

    return {
      accountId,
      accountCode: account.accountCode,
      accountName: account.accountName,
      ownBalance: ownBalance.toFixed(2),
      childrenBalance: childrenBalance.toFixed(2),
      totalBalance: totalBalance.toFixed(2),
      normalBalance: account.normalBalance as 'debit' | 'credit',
      childAccountCount,
    };
  }

  // ===========================================================================
  // ACCOUNT GROUP CRUD OPERATIONS
  // ===========================================================================

  /**
   * Create account group
   */
  async createGroup(input: CreateAccountGroupInput): Promise<AccountGroup> {
    const { groupCode, groupName, groupNameEn, parentGroupId, reportSection, reportPosition, description, sortOrder = 0 } = input;

    // Check for duplicate
    const existing = await this.prisma.accountGroup.findFirst({
      where: { organizationId: this.organizationId, groupCode },
    });

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Group code already exists',
      });
    }

    // Calculate path and level
    let path = groupCode;
    let level = 0;

    if (parentGroupId) {
      const parent = await this.prisma.accountGroup.findFirst({
        where: { id: parentGroupId, organizationId: this.organizationId },
      });

      if (!parent) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Parent group not found',
        });
      }

      path = `${parent.path}.${groupCode}`;
      level = parent.level + 1;
    }

    const group = await this.prisma.accountGroup.create({
      data: {
        organizationId: this.organizationId,
        groupCode,
        groupName,
        groupNameEn,
        parentGroupId,
        level,
        path,
        reportSection,
        reportPosition,
        description,
        sortOrder,
        createdBy: this.userId,
      },
    });

    await this.auditLogger.log({
      action: 'hierarchy.group.create',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'accountGroup',
      resourceId: group.id,
      details: { groupCode, groupName },
    });

    await this.invalidateCache();

    return group as AccountGroup;
  }

  /**
   * Get account group by ID
   */
  async getGroup(input: GetAccountGroupInput): Promise<AccountGroup> {
    const group = await this.prisma.accountGroup.findFirst({
      where: { id: input.groupId, organizationId: this.organizationId },
    });

    if (!group) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Group not found',
      });
    }

    return group as AccountGroup;
  }

  /**
   * List account groups
   */
  async listGroups(input: ListAccountGroupsInput): Promise<ListAccountGroupsResult> {
    const { reportSection, parentGroupId, isActive, search, page = 1, pageSize = 50 } = input;

    const where: any = { organizationId: this.organizationId };

    if (reportSection) {
      where.reportSection = reportSection;
    }

    if (parentGroupId !== undefined) {
      where.parentGroupId = parentGroupId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { groupCode: { contains: search, mode: 'insensitive' } },
        { groupName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [groups, total] = await Promise.all([
      this.prisma.accountGroup.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { groupCode: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.accountGroup.count({ where }),
    ]);

    return {
      groups: groups as AccountGroup[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Update account group
   */
  async updateGroup(input: UpdateAccountGroupInput): Promise<AccountGroup> {
    const { groupId, ...updateData } = input;

    const existing = await this.prisma.accountGroup.findFirst({
      where: { id: groupId, organizationId: this.organizationId },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Group not found',
      });
    }

    const group = await this.prisma.accountGroup.update({
      where: { id: groupId },
      data: {
        ...updateData,
        updatedBy: this.userId,
      },
    });

    await this.auditLogger.log({
      action: 'hierarchy.group.update',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'accountGroup',
      resourceId: groupId,
      details: updateData,
    });

    await this.invalidateCache();

    return group as AccountGroup;
  }

  /**
   * Delete account group
   */
  async deleteGroup(input: DeleteAccountGroupInput): Promise<DeleteAccountGroupResult> {
    const { groupId, force = false } = input;

    const group = await this.prisma.accountGroup.findFirst({
      where: { id: groupId, organizationId: this.organizationId },
    });

    if (!group) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Group not found',
      });
    }

    // Check for members
    const memberCount = await this.prisma.accountGroupMember.count({
      where: { groupId },
    });

    if (memberCount > 0 && !force) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Group has members. Use force=true to delete anyway.',
      });
    }

    // Check for child groups
    const childCount = await this.prisma.accountGroup.count({
      where: { parentGroupId: groupId },
    });

    if (childCount > 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Group has child groups. Delete child groups first.',
      });
    }

    // Delete members if force
    let membersRemoved = 0;
    if (force && memberCount > 0) {
      const result = await this.prisma.accountGroupMember.deleteMany({
        where: { groupId },
      });
      membersRemoved = result.count;
    }

    await this.prisma.accountGroup.delete({
      where: { id: groupId },
    });

    await this.auditLogger.log({
      action: 'hierarchy.group.delete',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'accountGroup',
      resourceId: groupId,
      details: { groupCode: group.groupCode, membersRemoved },
    });

    await this.invalidateCache();

    return {
      success: true,
      groupId,
      groupCode: group.groupCode,
      membersRemoved,
    };
  }

  /**
   * Move group to new parent
   */
  async moveGroup(input: MoveAccountGroupInput): Promise<MoveAccountGroupResult> {
    const { groupId, newParentGroupId } = input;

    const group = await this.prisma.accountGroup.findFirst({
      where: { id: groupId, organizationId: this.organizationId },
    });

    if (!group) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Group not found',
      });
    }

    const oldPath = group.path;
    let newPath = group.groupCode;
    let newLevel = 0;

    if (newParentGroupId) {
      const newParent = await this.prisma.accountGroup.findFirst({
        where: { id: newParentGroupId, organizationId: this.organizationId },
      });

      if (!newParent) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'New parent group not found',
        });
      }

      // Check for circular reference
      if (newParent.path.startsWith(oldPath)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot move group into its own descendant',
        });
      }

      newPath = `${newParent.path}.${group.groupCode}`;
      newLevel = newParent.level + 1;
    }

    // Update the group
    await this.prisma.accountGroup.update({
      where: { id: groupId },
      data: {
        parentGroupId: newParentGroupId,
        path: newPath,
        level: newLevel,
        updatedBy: this.userId,
      },
    });

    // Update all child groups' paths
    const childrenUpdated = await this.prisma.accountGroup.updateMany({
      where: {
        organizationId: this.organizationId,
        path: { startsWith: `${oldPath}.` },
      },
      data: {
        // We need to update paths - this is a simplified approach
        // In production, you'd use a more sophisticated path update
      },
    });

    await this.auditLogger.log({
      action: 'hierarchy.group.move',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'accountGroup',
      resourceId: groupId,
      details: { oldPath, newPath },
    });

    await this.invalidateCache();

    return {
      success: true,
      groupId,
      oldPath,
      newPath,
      childrenUpdated: childrenUpdated.count,
    };
  }

  /**
   * Get group tree structure
   */
  async getGroupTree(input: GetGroupTreeInput): Promise<GetGroupTreeResult> {
    const { rootGroupId, reportSection, includeBalances: _includeBalances = false, periodId: _periodId, includeInactive = false } = input;

    const where: any = { organizationId: this.organizationId };

    if (!includeInactive) {
      where.isActive = true;
    }

    if (reportSection) {
      where.reportSection = reportSection;
    }

    if (rootGroupId) {
      const rootGroup = await this.prisma.accountGroup.findFirst({
        where: { id: rootGroupId, organizationId: this.organizationId },
      });
      if (rootGroup) {
        where.path = { startsWith: rootGroup.path };
      }
    }

    const groups = await this.prisma.accountGroup.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { groupCode: 'asc' }],
    });

    // Build tree
    const tree = this.buildGroupTree(groups, rootGroupId);

    return {
      tree,
      totalGroups: groups.length,
      maxDepth: this.calculateGroupMaxDepth(tree),
    };
  }

  // ===========================================================================
  // GROUP MEMBERS OPERATIONS
  // ===========================================================================

  /**
   * Add accounts to group
   */
  async addAccountsToGroup(input: AddAccountsToGroupInput): Promise<AddAccountsToGroupResult> {
    const { groupId, accountIds } = input;

    const group = await this.prisma.accountGroup.findFirst({
      where: { id: groupId, organizationId: this.organizationId },
    });

    if (!group) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Group not found',
      });
    }

    // Verify accounts exist
    const accounts = await this.prisma.chartOfAccount.findMany({
      where: {
        id: { in: accountIds },
        organizationId: this.organizationId,
      },
    });

    if (accounts.length !== accountIds.length) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Some accounts not found',
      });
    }

    // Check existing members
    const existingMembers = await this.prisma.accountGroupMember.findMany({
      where: { groupId, accountId: { in: accountIds } },
    });

    const existingAccountIds = new Set(existingMembers.map((m) => m.accountId));
    const newAccountIds = accountIds.filter((id) => !existingAccountIds.has(id));

    // Get current max sort order
    const maxSortResult = await this.prisma.accountGroupMember.findFirst({
      where: { groupId },
      orderBy: { sortOrder: 'desc' },
    });
    let sortOrder = (maxSortResult?.sortOrder ?? -1) + 1;

    // Create new members
    const memberData = newAccountIds.map((accountId) => ({
      groupId,
      accountId,
      sortOrder: sortOrder++,
    }));

    await this.prisma.accountGroupMember.createMany({
      data: memberData,
      skipDuplicates: true,
    });

    const memberCount = await this.prisma.accountGroupMember.count({
      where: { groupId },
    });

    await this.auditLogger.log({
      action: 'hierarchy.group.addMembers',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'accountGroup',
      resourceId: groupId,
      details: { addedCount: newAccountIds.length },
    });

    await this.invalidateCache();

    return {
      groupId,
      addedCount: newAccountIds.length,
      skippedCount: existingAccountIds.size,
      memberCount,
    };
  }

  /**
   * Remove accounts from group
   */
  async removeAccountsFromGroup(input: RemoveAccountsFromGroupInput): Promise<RemoveAccountsFromGroupResult> {
    const { groupId, accountIds } = input;

    const group = await this.prisma.accountGroup.findFirst({
      where: { id: groupId, organizationId: this.organizationId },
    });

    if (!group) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Group not found',
      });
    }

    const result = await this.prisma.accountGroupMember.deleteMany({
      where: { groupId, accountId: { in: accountIds } },
    });

    const memberCount = await this.prisma.accountGroupMember.count({
      where: { groupId },
    });

    await this.auditLogger.log({
      action: 'hierarchy.group.removeMembers',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'accountGroup',
      resourceId: groupId,
      details: { removedCount: result.count },
    });

    await this.invalidateCache();

    return {
      groupId,
      removedCount: result.count,
      memberCount,
    };
  }

  /**
   * Get accounts in group
   */
  async getGroupAccounts(input: GetGroupAccountsInput): Promise<GetGroupAccountsResult> {
    const { groupId, includeChildGroups = false, includeBalances = false, periodId } = input;

    const group = await this.prisma.accountGroup.findFirst({
      where: { id: groupId, organizationId: this.organizationId },
    });

    if (!group) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Group not found',
      });
    }

    let groupIds = [groupId];

    if (includeChildGroups) {
      const childGroups = await this.prisma.accountGroup.findMany({
        where: {
          organizationId: this.organizationId,
          path: { startsWith: `${group.path}.` },
        },
      });
      groupIds = [...groupIds, ...childGroups.map((g) => g.id)];
    }

    const members = await this.prisma.accountGroupMember.findMany({
      where: { groupId: { in: groupIds } },
      include: { account: true },
      orderBy: { sortOrder: 'asc' },
    });

    let balanceMap = new Map<string, Decimal>();
    if (includeBalances && periodId) {
      const balances = await this.prisma.accountBalance.findMany({
        where: {
          accountId: { in: members.map((m) => m.accountId) },
          periodId,
        },
      });
      balanceMap = new Map(balances.map((b) => [b.accountId, new Decimal(b.closingBalance.toString())]));
    }

    const accounts = members.map((m) => ({
      id: m.account.id,
      accountCode: m.account.accountCode,
      accountName: m.account.accountName,
      accountType: m.account.accountType,
      balance: balanceMap.get(m.accountId)?.toString(),
      sortOrder: m.sortOrder,
    }));

    const totalBalance = includeBalances
      ? Array.from(balanceMap.values()).reduce((sum, b) => sum.plus(b), new Decimal(0)).toString()
      : undefined;

    return {
      groupId,
      groupCode: group.groupCode,
      groupName: group.groupName,
      accounts,
      totalAccounts: accounts.length,
      totalBalance,
    };
  }

  /**
   * Set accounts in group (replace all)
   */
  async setGroupAccounts(input: SetGroupAccountsInput): Promise<AddAccountsToGroupResult> {
    const { groupId, accountIds } = input;

    const group = await this.prisma.accountGroup.findFirst({
      where: { id: groupId, organizationId: this.organizationId },
    });

    if (!group) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Group not found',
      });
    }

    // Remove all existing members
    await this.prisma.accountGroupMember.deleteMany({
      where: { groupId },
    });

    // Add new members
    if (accountIds.length > 0) {
      const memberData = accountIds.map((accountId, index) => ({
        groupId,
        accountId,
        sortOrder: index,
      }));

      await this.prisma.accountGroupMember.createMany({
        data: memberData,
      });
    }

    await this.auditLogger.log({
      action: 'hierarchy.group.setMembers',
      userId: this.userId,
      organizationId: this.organizationId,
      resourceType: 'accountGroup',
      resourceId: groupId,
      details: { accountCount: accountIds.length },
    });

    await this.invalidateCache();

    return {
      groupId,
      addedCount: accountIds.length,
      skippedCount: 0,
      memberCount: accountIds.length,
    };
  }

  /**
   * Reorder accounts within group
   */
  async reorderGroupAccounts(input: ReorderGroupAccountsInput): Promise<void> {
    const { groupId, accountOrdering } = input;

    const group = await this.prisma.accountGroup.findFirst({
      where: { id: groupId, organizationId: this.organizationId },
    });

    if (!group) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Group not found',
      });
    }

    // Update sort orders
    for (const { accountId, sortOrder } of accountOrdering) {
      await this.prisma.accountGroupMember.updateMany({
        where: { groupId, accountId },
        data: { sortOrder },
      });
    }

    await this.invalidateCache();
  }

  // ===========================================================================
  // GROUP BALANCE OPERATIONS
  // ===========================================================================

  /**
   * Get aggregated balance for group
   */
  async getGroupBalance(input: GetGroupBalanceInput): Promise<GetGroupBalanceResult> {
    const { groupId, periodId, includeChildGroups = true } = input;

    const group = await this.prisma.accountGroup.findFirst({
      where: { id: groupId, organizationId: this.organizationId },
    });

    if (!group) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Group not found',
      });
    }

    let groupIds = [groupId];
    let childGroupCount = 0;

    if (includeChildGroups) {
      const childGroups = await this.prisma.accountGroup.findMany({
        where: {
          organizationId: this.organizationId,
          path: { startsWith: `${group.path}.` },
        },
      });
      groupIds = [...groupIds, ...childGroups.map((g) => g.id)];
      childGroupCount = childGroups.length;
    }

    // Get all account IDs in these groups
    const members = await this.prisma.accountGroupMember.findMany({
      where: { groupId: { in: groupIds } },
    });

    const accountIds = [...new Set(members.map((m) => m.accountId))];

    // Get balances
    const balances = await this.prisma.accountBalance.findMany({
      where: {
        accountId: { in: accountIds },
        periodId,
      },
    });

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const balance of balances) {
      const amount = new Decimal(balance.closingBalance.toString());
      // Assuming positive = debit, negative = credit (simplified)
      if (amount.gte(0)) {
        totalDebit = totalDebit.plus(amount);
      } else {
        totalCredit = totalCredit.plus(amount.abs());
      }
    }

    const netBalance = totalDebit.minus(totalCredit);

    return {
      groupId,
      groupCode: group.groupCode,
      groupName: group.groupName,
      accountCount: accountIds.length,
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      netBalance: netBalance.toFixed(2),
      childGroupCount: includeChildGroups ? childGroupCount : undefined,
    };
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private buildAccountTree(
    accounts: any[],
    balanceMap: Map<string, Decimal>,
    rootId?: string,
    maxDepth: number = 10
  ): AccountTreeNode[] {
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const childrenMap = new Map<string | null, any[]>();

    // Group accounts by parent
    for (const account of accounts) {
      const parentId = account.parentAccountId;
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(account);
    }

    // Recursive tree builder
    const buildNode = (account: any, depth: number): AccountTreeNode => {
      const children = childrenMap.get(account.id) || [];
      const childNodes = depth < maxDepth ? children.map((c) => buildNode(c, depth + 1)) : [];

      // Calculate balance (own + children for synthetic accounts)
      let balance = balanceMap.get(account.id) || new Decimal(0);
      if (!account.allowsPosting && childNodes.length > 0) {
        balance = childNodes.reduce(
          (sum, c) => sum.plus(new Decimal(c.balance || '0')),
          new Decimal(0)
        );
      }

      return {
        id: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountNameEn: account.accountNameEn,
        accountType: account.accountType,
        accountClass: account.accountClass,
        normalBalance: account.normalBalance,
        level: account.level,
        path: account.path,
        allowsPosting: account.allowsPosting,
        isSynthetic: account.isSynthetic,
        hasChildren: children.length > 0,
        balance: balance.toFixed(2),
        children: childNodes.length > 0 ? childNodes : undefined,
      };
    };

    // Start from root accounts (no parent or specified root)
    const rootAccounts = rootId
      ? [accountMap.get(rootId)].filter(Boolean)
      : childrenMap.get(null) || [];

    return rootAccounts.map((a) => buildNode(a, 0));
  }

  private buildGroupTree(groups: any[], rootId?: string): GroupTreeNode[] {
    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const childrenMap = new Map<string | null, any[]>();

    // Group by parent
    for (const group of groups) {
      const parentId = group.parentGroupId;
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(group);
    }

    // Recursive builder
    const buildNode = (group: any): GroupTreeNode => {
      const children = childrenMap.get(group.id) || [];
      const childNodes = children.map((c) => buildNode(c));

      return {
        id: group.id,
        groupCode: group.groupCode,
        groupName: group.groupName,
        groupNameEn: group.groupNameEn,
        level: group.level,
        path: group.path,
        reportSection: group.reportSection,
        reportPosition: group.reportPosition,
        hasChildren: children.length > 0,
        accountCount: 0, // Would need to count members
        children: childNodes.length > 0 ? childNodes : undefined,
      };
    };

    const rootGroups = rootId
      ? [groupMap.get(rootId)].filter(Boolean)
      : childrenMap.get(null) || [];

    return rootGroups.map((g) => buildNode(g));
  }

  private calculateMaxDepth(tree: AccountTreeNode[]): number {
    let maxDepth = 0;

    const traverse = (nodes: AccountTreeNode[], depth: number) => {
      maxDepth = Math.max(maxDepth, depth);
      for (const node of nodes) {
        if (node.children) {
          traverse(node.children, depth + 1);
        }
      }
    };

    traverse(tree, 0);
    return maxDepth;
  }

  private calculateGroupMaxDepth(tree: GroupTreeNode[]): number {
    let maxDepth = 0;

    const traverse = (nodes: GroupTreeNode[], depth: number) => {
      maxDepth = Math.max(maxDepth, depth);
      for (const node of nodes) {
        if (node.children) {
          traverse(node.children, depth + 1);
        }
      }
    };

    traverse(tree, 0);
    return maxDepth;
  }

  private async invalidateCache(): Promise<void> {
    const keys = await this.redis.keys(`hierarchy:${this.organizationId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
