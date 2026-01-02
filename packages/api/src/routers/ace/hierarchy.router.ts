import { router, protectedProcedure } from '../../trpc';
import { HierarchyService } from '../../services/ace/hierarchy.service';
import {
  getHierarchyAccountTreeSchema as getAccountTreeSchema,
  getAccountChildrenSchema,
  getAccountAncestorsSchema,
  getAccountDescendantsSchema,
  getAggregatedBalanceSchema,
  createAccountGroupSchema,
  getAccountGroupSchema,
  listAccountGroupsSchema,
  updateAccountGroupSchema,
  deleteAccountGroupSchema,
  moveAccountGroupSchema,
  getGroupTreeSchema,
  addAccountsToGroupSchema,
  removeAccountsFromGroupSchema,
  getGroupAccountsSchema,
  setGroupAccountsSchema,
  reorderGroupAccountsSchema,
  getGroupBalanceSchema,
} from '@ksiegowacrm/shared';

/**
 * ACC-003: Account Hierarchy and Grouping Router
 * Manages account tree operations and account groups
 */
export const hierarchyRouter = router({
  // =========================================================================
  // ACCOUNT TREE OPERATIONS
  // =========================================================================

  /**
   * Get account tree structure
   * Returns hierarchical view of accounts with optional balances
   */
  getAccountTree: protectedProcedure
    .input(getAccountTreeSchema)
    .query(async ({ ctx, input }) => {
      const service = new HierarchyService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getAccountTree(input);
    }),

  /**
   * Get children of specific account
   */
  getAccountChildren: protectedProcedure
    .input(getAccountChildrenSchema)
    .query(async ({ ctx, input }) => {
      const service = new HierarchyService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getAccountChildren(input);
    }),

  /**
   * Get ancestors of account (path to root)
   */
  getAccountAncestors: protectedProcedure
    .input(getAccountAncestorsSchema)
    .query(async ({ ctx, input }) => {
      const service = new HierarchyService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getAccountAncestors(input);
    }),

  /**
   * Get all descendants of an account
   */
  getAccountDescendants: protectedProcedure
    .input(getAccountDescendantsSchema)
    .query(async ({ ctx, input }) => {
      const service = new HierarchyService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getAccountDescendants(input);
    }),

  /**
   * Calculate aggregated balance for a parent account
   */
  getAggregatedBalance: protectedProcedure
    .input(getAggregatedBalanceSchema)
    .query(async ({ ctx, input }) => {
      const service = new HierarchyService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getAggregatedBalance(input);
    }),

  // =========================================================================
  // ACCOUNT GROUP CRUD OPERATIONS
  // =========================================================================

  /**
   * Create account group
   */
  createGroup: protectedProcedure
    .input(createAccountGroupSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new HierarchyService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.createGroup(input);
    }),

  /**
   * Get account group by ID
   */
  getGroup: protectedProcedure
    .input(getAccountGroupSchema)
    .query(async ({ ctx, input }) => {
      const service = new HierarchyService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getGroup(input);
    }),

  /**
   * List account groups with filtering
   */
  listGroups: protectedProcedure
    .input(listAccountGroupsSchema)
    .query(async ({ ctx, input }) => {
      const service = new HierarchyService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.listGroups(input);
    }),

  /**
   * Update account group
   */
  updateGroup: protectedProcedure
    .input(updateAccountGroupSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new HierarchyService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.updateGroup(input);
    }),

  /**
   * Delete account group
   */
  deleteGroup: protectedProcedure
    .input(deleteAccountGroupSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new HierarchyService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.deleteGroup(input);
    }),

  /**
   * Move group to new parent
   */
  moveGroup: protectedProcedure
    .input(moveAccountGroupSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new HierarchyService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.moveGroup(input);
    }),

  /**
   * Get group tree structure
   */
  getGroupTree: protectedProcedure
    .input(getGroupTreeSchema)
    .query(async ({ ctx, input }) => {
      const service = new HierarchyService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getGroupTree(input);
    }),

  // =========================================================================
  // GROUP MEMBERS OPERATIONS
  // =========================================================================

  /**
   * Add accounts to group
   */
  addAccountsToGroup: protectedProcedure
    .input(addAccountsToGroupSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new HierarchyService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.addAccountsToGroup(input);
    }),

  /**
   * Remove accounts from group
   */
  removeAccountsFromGroup: protectedProcedure
    .input(removeAccountsFromGroupSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new HierarchyService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.removeAccountsFromGroup(input);
    }),

  /**
   * Get accounts in group
   */
  getGroupAccounts: protectedProcedure
    .input(getGroupAccountsSchema)
    .query(async ({ ctx, input }) => {
      const service = new HierarchyService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getGroupAccounts(input);
    }),

  /**
   * Set accounts in group (replace all)
   */
  setGroupAccounts: protectedProcedure
    .input(setGroupAccountsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new HierarchyService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.setGroupAccounts(input);
    }),

  /**
   * Reorder accounts within group
   */
  reorderGroupAccounts: protectedProcedure
    .input(reorderGroupAccountsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new HierarchyService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.reorderGroupAccounts(input);
    }),

  // =========================================================================
  // GROUP BALANCE OPERATIONS
  // =========================================================================

  /**
   * Get aggregated balance for a group
   */
  getGroupBalance: protectedProcedure
    .input(getGroupBalanceSchema)
    .query(async ({ ctx, input }) => {
      const service = new HierarchyService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getGroupBalance(input);
    }),
});
