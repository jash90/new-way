// TAX-006: ZUS Declaration Router
// Manages ZUS (Social Security) declarations for Polish tax compliance

import { router, protectedProcedure } from '../../trpc';
import { ZUSDeclarationService } from '../../services/tax/zus-declaration.service';
import {
  calculateEmployeeZUSSchema,
  calculateSelfEmployedZUSSchema,
  createZUSDeclarationSchema,
  addInsuredPersonSchema,
  updateInsuredPersonSchema,
  removeInsuredPersonSchema,
  calculateDeclarationTotalsSchema,
  validateZUSDeclarationSchema,
  submitZUSDeclarationSchema,
  createZUSCorrectionSchema,
  getZUSDeclarationSchema,
  listZUSDeclarationsSchema,
  deleteZUSDeclarationSchema,
  calculateZUSPaymentSchema,
  recordZUSPaymentSchema,
  getZUSPaymentScheduleSchema,
  getContributionHistorySchema,
  generateAnnualReportSchema,
} from '@ksiegowacrm/shared';

/**
 * ZUS Declaration Router
 * Provides endpoints for Polish ZUS (Social Security) declarations and contribution management
 */
export const zusDeclarationRouter = router({
  // =========================================================================
  // CALCULATION ENDPOINTS
  // =========================================================================

  /**
   * Calculate ZUS contributions for an employee
   * AC-1: Calculate pension, disability, sickness, accident, health contributions
   */
  calculateEmployeeZUS: protectedProcedure
    .input(calculateEmployeeZUSSchema)
    .query(async ({ ctx, input }) => {
      const service = new ZUSDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.calculateEmployeeZUS(input);
    }),

  /**
   * Calculate ZUS contributions for self-employed
   * AC-2: Support for standard, preferential, ulga na start, mały ZUS Plus
   */
  calculateSelfEmployedZUS: protectedProcedure
    .input(calculateSelfEmployedZUSSchema)
    .query(async ({ ctx, input }) => {
      const service = new ZUSDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.calculateSelfEmployedZUS(input);
    }),

  // =========================================================================
  // DECLARATION MANAGEMENT ENDPOINTS
  // =========================================================================

  /**
   * Create new ZUS declaration (DRA form)
   * AC-3: Create monthly declaration
   */
  createDeclaration: protectedProcedure
    .input(createZUSDeclarationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.createDeclaration(input);
    }),

  /**
   * Add insured person to declaration
   * AC-4: Add employee/contributor with contribution calculation
   */
  addInsuredPerson: protectedProcedure
    .input(addInsuredPersonSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.addInsuredPerson(input);
    }),

  /**
   * Update insured person data
   * AC-5: Update salary, benefits, or status
   */
  updateInsuredPerson: protectedProcedure
    .input(updateInsuredPersonSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.updateInsuredPerson(input);
    }),

  /**
   * Remove insured person from declaration
   * AC-6: Remove person and recalculate totals
   */
  removeInsuredPerson: protectedProcedure
    .input(removeInsuredPersonSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.removeInsuredPerson(input);
    }),

  /**
   * Calculate/recalculate declaration totals
   * AC-7: Aggregate all contributions
   */
  calculateDeclarationTotals: protectedProcedure
    .input(calculateDeclarationTotalsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.calculateDeclarationTotals(input);
    }),

  /**
   * Validate declaration before submission
   * AC-8: Check NIP, PESEL, contribution calculations
   */
  validateDeclaration: protectedProcedure
    .input(validateZUSDeclarationSchema)
    .query(async ({ ctx, input }) => {
      const service = new ZUSDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.validateDeclaration(input);
    }),

  /**
   * Submit declaration to ZUS
   * AC-9: Submit via PUE ZUS or Płatnik
   */
  submitDeclaration: protectedProcedure
    .input(submitZUSDeclarationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.submitDeclaration(input);
    }),

  /**
   * Create correction declaration
   * AC-10: Create correction for previously submitted declaration
   */
  createCorrection: protectedProcedure
    .input(createZUSCorrectionSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.createCorrection(input);
    }),

  /**
   * Get declaration by ID with full summary
   */
  getDeclaration: protectedProcedure
    .input(getZUSDeclarationSchema)
    .query(async ({ ctx, input }) => {
      const service = new ZUSDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.getDeclaration(input);
    }),

  /**
   * List declarations with filters
   */
  listDeclarations: protectedProcedure
    .input(listZUSDeclarationsSchema)
    .query(async ({ ctx, input }) => {
      const service = new ZUSDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.listDeclarations(input);
    }),

  /**
   * Delete declaration (only draft status)
   */
  deleteDeclaration: protectedProcedure
    .input(deleteZUSDeclarationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.deleteDeclaration(input);
    }),

  // =========================================================================
  // PAYMENT ENDPOINTS
  // =========================================================================

  /**
   * Calculate payment amounts by fund
   * AC-11: Break down payments for each ZUS fund
   */
  calculatePayment: protectedProcedure
    .input(calculateZUSPaymentSchema)
    .query(async ({ ctx, input }) => {
      const service = new ZUSDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.calculatePayment(input);
    }),

  /**
   * Record payment
   * AC-12: Record payment with reference
   */
  recordPayment: protectedProcedure
    .input(recordZUSPaymentSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new ZUSDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.recordPayment(input);
    }),

  /**
   * Get annual payment schedule
   * AC-13: View full year payment calendar
   */
  getPaymentSchedule: protectedProcedure
    .input(getZUSPaymentScheduleSchema)
    .query(async ({ ctx, input }) => {
      const service = new ZUSDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.getPaymentSchedule(input);
    }),

  // =========================================================================
  // HISTORY AND REPORTING ENDPOINTS
  // =========================================================================

  /**
   * Get contribution history for a person
   * AC-14: View historical contributions by PESEL or personId
   */
  getContributionHistory: protectedProcedure
    .input(getContributionHistorySchema)
    .query(async ({ ctx, input }) => {
      const service = new ZUSDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.getContributionHistory(input);
    }),

  /**
   * Generate annual ZUS report
   * AC-15: Full year contribution summary
   */
  generateAnnualReport: protectedProcedure
    .input(generateAnnualReportSchema)
    .query(async ({ ctx, input }) => {
      const service = new ZUSDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.generateAnnualReport(input);
    }),
});

export type ZUSDeclarationRouter = typeof zusDeclarationRouter;
