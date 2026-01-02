import { router, protectedProcedure } from '../../trpc';
import { AccountService } from '../../services/ace/account.service';
import {
  createAccountSchema,
  getAccountSchema,
  getAccountByCodeSchema,
  listAccountsSchema,
  updateAccountSchema,
  deleteAccountSchema,
  activateAccountSchema,
  deactivateAccountSchema,
  moveAccountSchema,
  getAccountTreeSchema,
  searchAccountsSchema,
  validateAccountCodeSchema,
  getAccountBalanceSchema,
  batchCreateAccountsSchema,
  importAccountsSchema,
  exportAccountsSchema,
  getAccountStatisticsSchema,
} from '@ksiegowacrm/shared';

/**
 * ACE-001: Chart of Accounts Router
 * Manages account structure for Polish accounting (Plan Kont)
 */
export const accountRouter = router({
  /**
   * Create a new account
   * Validates account code format and uniqueness
   */
  create: protectedProcedure
    .input(createAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new AccountService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.createAccount(input);
    }),

  /**
   * Get account by ID
   * Includes related accounts and balances if requested
   */
  get: protectedProcedure
    .input(getAccountSchema)
    .query(async ({ ctx, input }) => {
      const service = new AccountService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getAccount(input);
    }),

  /**
   * Get account by code
   * Useful for lookups during journal entry creation
   */
  getByCode: protectedProcedure
    .input(getAccountByCodeSchema)
    .query(async ({ ctx, input }) => {
      const service = new AccountService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getAccountByCode(input);
    }),

  /**
   * List accounts with filtering and pagination
   * Supports filtering by type, category, status, parent
   */
  list: protectedProcedure
    .input(listAccountsSchema)
    .query(async ({ ctx, input }) => {
      const service = new AccountService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.listAccounts(input);
    }),

  /**
   * Update account details
   * Cannot change code or type of accounts with journal entries
   */
  update: protectedProcedure
    .input(updateAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new AccountService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.updateAccount(input);
    }),

  /**
   * Delete account
   * Cannot delete accounts with journal entries or children (unless forced)
   */
  delete: protectedProcedure
    .input(deleteAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new AccountService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.deleteAccount(input);
    }),

  /**
   * Activate account (inactive → active)
   * Allows posting journal entries to the account
   */
  activate: protectedProcedure
    .input(activateAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new AccountService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.activateAccount(input);
    }),

  /**
   * Deactivate account (active → inactive)
   * Prevents new journal entries, existing remain
   */
  deactivate: protectedProcedure
    .input(deactivateAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new AccountService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.deactivateAccount(input);
    }),

  /**
   * Move account to new parent
   * Maintains hierarchy integrity and updates levels
   */
  move: protectedProcedure
    .input(moveAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new AccountService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.moveAccount(input);
    }),

  /**
   * Get account tree (hierarchical structure)
   * Optionally starting from a specific root account
   */
  getTree: protectedProcedure
    .input(getAccountTreeSchema)
    .query(async ({ ctx, input }) => {
      const service = new AccountService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getAccountTree(input);
    }),

  /**
   * Search accounts by query
   * Searches code, name (Polish and English), and description
   */
  search: protectedProcedure
    .input(searchAccountsSchema)
    .query(async ({ ctx, input }) => {
      const service = new AccountService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.searchAccounts(input);
    }),

  /**
   * Validate account code
   * Checks format, uniqueness, and suggests category/type
   */
  validateCode: protectedProcedure
    .input(validateAccountCodeSchema)
    .query(async ({ ctx, input }) => {
      const service = new AccountService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.validateAccountCode(input);
    }),

  /**
   * Get account balance
   * Calculates opening, debit, credit, and closing balances
   */
  getBalance: protectedProcedure
    .input(getAccountBalanceSchema)
    .query(async ({ ctx, input }) => {
      const service = new AccountService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getAccountBalance(input);
    }),

  /**
   * Batch create accounts
   * Creates multiple accounts in a transaction
   */
  batchCreate: protectedProcedure
    .input(batchCreateAccountsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new AccountService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.batchCreateAccounts(input);
    }),

  /**
   * Import accounts from template or custom data
   * Supports Polish standard chart of accounts
   */
  import: protectedProcedure
    .input(importAccountsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new AccountService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.importAccounts(input);
    }),

  /**
   * Export accounts to various formats
   * Supports JSON, CSV, XLSX with optional balance data
   */
  export: protectedProcedure
    .input(exportAccountsSchema)
    .query(async ({ ctx, input }) => {
      const service = new AccountService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.exportAccounts(input);
    }),

  /**
   * Get account statistics
   * Aggregate counts by type, category, and status
   */
  getStatistics: protectedProcedure
    .input(getAccountStatisticsSchema)
    .query(async ({ ctx, input }) => {
      const service = new AccountService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getAccountStatistics(input);
    }),
});

export type AccountRouter = typeof accountRouter;
