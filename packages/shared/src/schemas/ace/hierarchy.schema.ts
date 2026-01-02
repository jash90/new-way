/**
 * ACC-003: Account Hierarchy and Grouping Schemas
 *
 * Zod schemas for account hierarchy operations, tree views, and account groups
 */

import { z } from 'zod';

// ===========================================================================
// ENUMS
// ===========================================================================

/**
 * Report sections for account groups
 * Maps to Polish financial statements (Bilans, RZiS)
 */
export const reportSectionSchema = z.enum([
  'BALANCE_SHEET_ASSETS',
  'BALANCE_SHEET_LIABILITIES',
  'BALANCE_SHEET_EQUITY',
  'INCOME_STATEMENT_REVENUE',
  'INCOME_STATEMENT_EXPENSES',
  'CASH_FLOW',
]);

export type ReportSection = z.infer<typeof reportSectionSchema>;

// ===========================================================================
// ENTITY TYPES
// ===========================================================================

/**
 * Account Group entity
 * Used for report groupings separate from account hierarchy
 */
export const accountGroupSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  groupCode: z.string().min(1).max(50),
  groupName: z.string().min(1).max(255),
  groupNameEn: z.string().max(255).nullable(),
  parentGroupId: z.string().uuid().nullable(),
  level: z.number().int().min(0),
  path: z.string(),
  reportSection: reportSectionSchema.nullable(),
  reportPosition: z.string().max(50).nullable(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.date(),
  createdBy: z.string().uuid().nullable(),
  updatedAt: z.date(),
  updatedBy: z.string().uuid().nullable(),
});

export type AccountGroup = z.infer<typeof accountGroupSchema>;

/**
 * Account Group Member entity
 * Links accounts to groups
 */
export const accountGroupMemberSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  accountId: z.string().uuid(),
  sortOrder: z.number().int(),
  createdAt: z.date(),
});

export type AccountGroupMember = z.infer<typeof accountGroupMemberSchema>;

/**
 * Account tree node for hierarchical display
 * Recursive type for tree structure
 */
export interface AccountTreeNode {
  id: string;
  accountCode: string;
  accountName: string;
  accountNameEn: string | null;
  accountType: string;
  accountClass: number;
  normalBalance: 'debit' | 'credit';
  level: number;
  path: string | null;
  allowsPosting: boolean;
  isSynthetic: boolean;
  hasChildren: boolean;
  balance?: string; // Using string for Decimal representation
  debitBalance?: string;
  creditBalance?: string;
  children?: AccountTreeNode[];
}

export const accountTreeNodeSchema: z.ZodType<AccountTreeNode> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    accountCode: z.string(),
    accountName: z.string(),
    accountNameEn: z.string().nullable(),
    accountType: z.string(),
    accountClass: z.number().int().min(0).max(9),
    normalBalance: z.enum(['debit', 'credit']),
    level: z.number().int().min(0),
    path: z.string().nullable(),
    allowsPosting: z.boolean(),
    isSynthetic: z.boolean(),
    hasChildren: z.boolean(),
    balance: z.string().optional(),
    debitBalance: z.string().optional(),
    creditBalance: z.string().optional(),
    children: z.array(accountTreeNodeSchema).optional(),
  })
);

/**
 * Group tree node with children
 */
export interface GroupTreeNode {
  id: string;
  groupCode: string;
  groupName: string;
  groupNameEn: string | null;
  level: number;
  path: string;
  reportSection: ReportSection | null;
  reportPosition: string | null;
  hasChildren: boolean;
  accountCount: number;
  totalBalance?: string;
  children?: GroupTreeNode[];
}

export const groupTreeNodeSchema: z.ZodType<GroupTreeNode> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    groupCode: z.string(),
    groupName: z.string(),
    groupNameEn: z.string().nullable(),
    level: z.number().int().min(0),
    path: z.string(),
    reportSection: reportSectionSchema.nullable(),
    reportPosition: z.string().nullable(),
    hasChildren: z.boolean(),
    accountCount: z.number().int().min(0),
    totalBalance: z.string().optional(),
    children: z.array(groupTreeNodeSchema).optional(),
  })
);

// ===========================================================================
// INPUT SCHEMAS - ACCOUNT TREE
// ===========================================================================

/**
 * Get account tree
 */
export const getAccountTreeSchema = z.object({
  rootAccountId: z.string().uuid().optional(),
  accountClass: z.number().int().min(0).max(9).optional(),
  includeBalances: z.boolean().default(false),
  periodId: z.string().uuid().optional(),
  maxDepth: z.number().int().min(1).max(10).default(10),
  includeInactive: z.boolean().default(false),
});

export type GetAccountTreeInput = z.infer<typeof getAccountTreeSchema>;

/**
 * Get children of specific account
 */
export const getAccountChildrenSchema = z.object({
  parentAccountId: z.string().uuid(),
  includeBalances: z.boolean().default(false),
  periodId: z.string().uuid().optional(),
});

export type GetAccountChildrenInput = z.infer<typeof getAccountChildrenSchema>;

/**
 * Get account ancestors (path to root)
 */
export const getAccountAncestorsSchema = z.object({
  accountId: z.string().uuid(),
});

export type GetAccountAncestorsInput = z.infer<typeof getAccountAncestorsSchema>;

/**
 * Get account descendants (all children recursively)
 */
export const getAccountDescendantsSchema = z.object({
  accountId: z.string().uuid(),
  includeBalances: z.boolean().default(false),
  periodId: z.string().uuid().optional(),
});

export type GetAccountDescendantsInput = z.infer<typeof getAccountDescendantsSchema>;

/**
 * Calculate aggregated balance for a parent account
 */
export const getAggregatedBalanceSchema = z.object({
  accountId: z.string().uuid(),
  periodId: z.string().uuid(),
  includeChildren: z.boolean().default(true),
});

export type GetAggregatedBalanceInput = z.infer<typeof getAggregatedBalanceSchema>;

// ===========================================================================
// INPUT SCHEMAS - ACCOUNT GROUPS
// ===========================================================================

/**
 * Create account group
 */
export const createAccountGroupSchema = z.object({
  groupCode: z.string().min(1).max(50),
  groupName: z.string().min(1).max(255),
  groupNameEn: z.string().max(255).optional(),
  parentGroupId: z.string().uuid().optional(),
  reportSection: reportSectionSchema.optional(),
  reportPosition: z.string().max(50).optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

export type CreateAccountGroupInput = z.infer<typeof createAccountGroupSchema>;

/**
 * Get account group
 */
export const getAccountGroupSchema = z.object({
  groupId: z.string().uuid(),
});

export type GetAccountGroupInput = z.infer<typeof getAccountGroupSchema>;

/**
 * List account groups
 */
export const listAccountGroupsSchema = z.object({
  reportSection: reportSectionSchema.optional(),
  parentGroupId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export type ListAccountGroupsInput = z.infer<typeof listAccountGroupsSchema>;

/**
 * Update account group
 */
export const updateAccountGroupSchema = z.object({
  groupId: z.string().uuid(),
  groupName: z.string().min(1).max(255).optional(),
  groupNameEn: z.string().max(255).optional().nullable(),
  reportSection: reportSectionSchema.optional().nullable(),
  reportPosition: z.string().max(50).optional().nullable(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateAccountGroupInput = z.infer<typeof updateAccountGroupSchema>;

/**
 * Delete account group
 */
export const deleteAccountGroupSchema = z.object({
  groupId: z.string().uuid(),
  force: z.boolean().default(false), // Delete even if has members
});

export type DeleteAccountGroupInput = z.infer<typeof deleteAccountGroupSchema>;

/**
 * Move group to new parent
 */
export const moveAccountGroupSchema = z.object({
  groupId: z.string().uuid(),
  newParentGroupId: z.string().uuid().optional().nullable(),
});

export type MoveAccountGroupInput = z.infer<typeof moveAccountGroupSchema>;

/**
 * Get group tree
 */
export const getGroupTreeSchema = z.object({
  rootGroupId: z.string().uuid().optional(),
  reportSection: reportSectionSchema.optional(),
  includeBalances: z.boolean().default(false),
  periodId: z.string().uuid().optional(),
  includeInactive: z.boolean().default(false),
});

export type GetGroupTreeInput = z.infer<typeof getGroupTreeSchema>;

// ===========================================================================
// INPUT SCHEMAS - GROUP MEMBERS
// ===========================================================================

/**
 * Add accounts to group
 */
export const addAccountsToGroupSchema = z.object({
  groupId: z.string().uuid(),
  accountIds: z.array(z.string().uuid()).min(1),
});

export type AddAccountsToGroupInput = z.infer<typeof addAccountsToGroupSchema>;

/**
 * Remove accounts from group
 */
export const removeAccountsFromGroupSchema = z.object({
  groupId: z.string().uuid(),
  accountIds: z.array(z.string().uuid()).min(1),
});

export type RemoveAccountsFromGroupInput = z.infer<typeof removeAccountsFromGroupSchema>;

/**
 * Get accounts in group
 */
export const getGroupAccountsSchema = z.object({
  groupId: z.string().uuid(),
  includeChildGroups: z.boolean().default(false),
  includeBalances: z.boolean().default(false),
  periodId: z.string().uuid().optional(),
});

export type GetGroupAccountsInput = z.infer<typeof getGroupAccountsSchema>;

/**
 * Set accounts in group (replace all)
 */
export const setGroupAccountsSchema = z.object({
  groupId: z.string().uuid(),
  accountIds: z.array(z.string().uuid()),
});

export type SetGroupAccountsInput = z.infer<typeof setGroupAccountsSchema>;

/**
 * Reorder accounts within group
 */
export const reorderGroupAccountsSchema = z.object({
  groupId: z.string().uuid(),
  accountOrdering: z.array(
    z.object({
      accountId: z.string().uuid(),
      sortOrder: z.number().int(),
    })
  ),
});

export type ReorderGroupAccountsInput = z.infer<typeof reorderGroupAccountsSchema>;

// ===========================================================================
// INPUT SCHEMAS - GROUP BALANCES
// ===========================================================================

/**
 * Get aggregated balance for a group
 */
export const getGroupBalanceSchema = z.object({
  groupId: z.string().uuid(),
  periodId: z.string().uuid(),
  includeChildGroups: z.boolean().default(true),
});

export type GetGroupBalanceInput = z.infer<typeof getGroupBalanceSchema>;

// ===========================================================================
// RESULT TYPES
// ===========================================================================

/**
 * Account tree result
 */
export interface GetAccountTreeResult {
  tree: AccountTreeNode[];
  totalAccounts: number;
  maxDepth: number;
}

/**
 * Account children result
 */
export interface GetAccountChildrenResult {
  children: AccountTreeNode[];
  parentAccount: {
    id: string;
    accountCode: string;
    accountName: string;
  };
}

/**
 * Account ancestors result
 */
export interface GetAccountAncestorsResult {
  ancestors: Array<{
    id: string;
    accountCode: string;
    accountName: string;
    level: number;
  }>;
  account: {
    id: string;
    accountCode: string;
    accountName: string;
  };
}

/**
 * Aggregated balance result
 */
export interface GetAggregatedBalanceResult {
  accountId: string;
  accountCode: string;
  accountName: string;
  ownBalance: string;
  childrenBalance: string;
  totalBalance: string;
  normalBalance: 'debit' | 'credit';
  childAccountCount: number;
}

/**
 * List groups result
 */
export interface ListAccountGroupsResult {
  groups: AccountGroup[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Group tree result
 */
export interface GetGroupTreeResult {
  tree: GroupTreeNode[];
  totalGroups: number;
  maxDepth: number;
}

/**
 * Add accounts to group result
 */
export interface AddAccountsToGroupResult {
  groupId: string;
  addedCount: number;
  skippedCount: number;
  memberCount: number;
}

/**
 * Remove accounts from group result
 */
export interface RemoveAccountsFromGroupResult {
  groupId: string;
  removedCount: number;
  memberCount: number;
}

/**
 * Get group accounts result
 */
export interface GetGroupAccountsResult {
  groupId: string;
  groupCode: string;
  groupName: string;
  accounts: Array<{
    id: string;
    accountCode: string;
    accountName: string;
    accountType: string;
    balance?: string;
    sortOrder: number;
  }>;
  totalAccounts: number;
  totalBalance?: string;
}

/**
 * Group balance result
 */
export interface GetGroupBalanceResult {
  groupId: string;
  groupCode: string;
  groupName: string;
  accountCount: number;
  totalDebit: string;
  totalCredit: string;
  netBalance: string;
  childGroupCount?: number;
}

/**
 * Delete group result
 */
export interface DeleteAccountGroupResult {
  success: boolean;
  groupId: string;
  groupCode: string;
  membersRemoved: number;
}

/**
 * Move group result
 */
export interface MoveAccountGroupResult {
  success: boolean;
  groupId: string;
  oldPath: string;
  newPath: string;
  childrenUpdated: number;
}
