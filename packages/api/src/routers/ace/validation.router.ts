import { router, protectedProcedure } from '../../trpc';
import { ValidationService } from '../../services/ace/validation.service';
import {
  createValidationRuleSchema,
  updateValidationRuleSchema,
  getValidationRuleSchema,
  listValidationRulesSchema,
  deleteValidationRuleSchema,
  toggleValidationRuleSchema,
  validateEntryInputSchema,
  checkBalanceInputSchema,
  getValidationHistorySchema,
} from '@ksiegowacrm/shared';

/**
 * ACC-007: Entry Validation Router
 * Manages validation rules and entry validation
 */
export const validationRouter = router({
  // =========================================================================
  // VALIDATION RULE CRUD
  // =========================================================================

  /**
   * Create a new validation rule
   */
  createRule: protectedProcedure
    .input(createValidationRuleSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ValidationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.createRule(input);
    }),

  /**
   * Get validation rule by ID
   */
  getRule: protectedProcedure
    .input(getValidationRuleSchema)
    .query(async ({ ctx, input }) => {
      const service = new ValidationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getRule(input);
    }),

  /**
   * List validation rules with filters
   */
  listRules: protectedProcedure
    .input(listValidationRulesSchema)
    .query(async ({ ctx, input }) => {
      const service = new ValidationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.listRules(input);
    }),

  /**
   * Update validation rule
   */
  updateRule: protectedProcedure
    .input(updateValidationRuleSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ValidationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.updateRule(input);
    }),

  /**
   * Delete validation rule
   */
  deleteRule: protectedProcedure
    .input(deleteValidationRuleSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ValidationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.deleteRule(input);
    }),

  /**
   * Toggle rule active status
   */
  toggleRule: protectedProcedure
    .input(toggleValidationRuleSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ValidationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.toggleRule(input);
    }),

  // =========================================================================
  // ENTRY VALIDATION
  // =========================================================================

  /**
   * Validate journal entry
   * Can validate by entry ID or inline entry data
   */
  validateEntry: protectedProcedure
    .input(validateEntryInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ValidationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.validateEntry(input);
    }),

  /**
   * Quick balance check for entry lines
   * Synchronous calculation without DB access
   */
  checkBalance: protectedProcedure
    .input(checkBalanceInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new ValidationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.checkBalance(input);
    }),

  // =========================================================================
  // VALIDATION HISTORY
  // =========================================================================

  /**
   * Get validation history for an entry
   */
  getValidationHistory: protectedProcedure
    .input(getValidationHistorySchema)
    .query(async ({ ctx, input }) => {
      const service = new ValidationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getValidationHistory(input);
    }),
});

export type ValidationRouter = typeof validationRouter;
