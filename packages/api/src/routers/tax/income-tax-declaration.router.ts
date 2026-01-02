// TAX-005: Income Tax Declaration Router
// Manages CIT (Corporate Income Tax) and PIT (Personal Income Tax) declarations for Polish tax compliance

import { router, protectedProcedure } from '../../trpc';
import { IncomeTaxDeclarationService } from '../../services/tax/income-tax-declaration.service';
import {
  calculateCITSchema,
  calculatePITDeclarationSchema,
  createDeclarationSchema,
  updateDeclarationSchema,
  calculateDeclarationSchema,
  submitDeclarationSchema,
  createDeclarationCorrectionSchema,
  getDeclarationSchema,
  listDeclarationsSchema,
  deleteDeclarationSchema,
  calculateAdvanceSchema,
  recordAdvancePaymentSchema,
  getAdvanceScheduleSchema,
  getLossCarryForwardSchema,
  applyLossSchema,
} from '@ksiegowacrm/shared';

/**
 * Income Tax Declaration Router
 * Provides endpoints for Polish CIT and PIT declarations, advance payments, and loss management
 */
export const incomeTaxDeclarationRouter = router({
  // =========================================================================
  // CALCULATION ENDPOINTS
  // =========================================================================

  /**
   * Calculate CIT (Corporate Income Tax)
   * AC-1: CIT calculation with standard/small taxpayer rates
   */
  calculateCIT: protectedProcedure
    .input(calculateCITSchema)
    .query(async ({ ctx, input }) => {
      const service = new IncomeTaxDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.calculateCIT(input);
    }),

  /**
   * Calculate PIT (Personal Income Tax)
   * AC-2: PIT calculation with progressive/flat/lump sum options
   */
  calculatePIT: protectedProcedure
    .input(calculatePITDeclarationSchema)
    .query(async ({ ctx, input }) => {
      const service = new IncomeTaxDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.calculatePIT(input);
    }),

  // =========================================================================
  // DECLARATION MANAGEMENT ENDPOINTS
  // =========================================================================

  /**
   * Create new tax declaration
   * AC-3: Create CIT-8, PIT-36, PIT-36L, etc.
   */
  createDeclaration: protectedProcedure
    .input(createDeclarationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new IncomeTaxDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.createDeclaration(input);
    }),

  /**
   * Update declaration
   * AC-4: Update revenue, costs, deductions
   */
  updateDeclaration: protectedProcedure
    .input(updateDeclarationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new IncomeTaxDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.updateDeclaration(input);
    }),

  /**
   * Calculate declaration taxes
   * AC-5: Run tax calculation and update declaration
   */
  calculateDeclaration: protectedProcedure
    .input(calculateDeclarationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new IncomeTaxDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.calculateDeclaration(input);
    }),

  /**
   * Submit declaration to tax authority
   * AC-6: Submit via e-Deklaracje
   */
  submitDeclaration: protectedProcedure
    .input(submitDeclarationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new IncomeTaxDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.submitDeclaration(input);
    }),

  /**
   * Create correction for existing declaration
   * AC-7: Create correction (korekta) for previously submitted declaration
   */
  createCorrection: protectedProcedure
    .input(createDeclarationCorrectionSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new IncomeTaxDeclarationService(
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
    .input(getDeclarationSchema)
    .query(async ({ ctx, input }) => {
      const service = new IncomeTaxDeclarationService(
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
    .input(listDeclarationsSchema)
    .query(async ({ ctx, input }) => {
      const service = new IncomeTaxDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.listDeclarations(input);
    }),

  /**
   * Delete declaration
   */
  deleteDeclaration: protectedProcedure
    .input(deleteDeclarationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new IncomeTaxDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.deleteDeclaration(input);
    }),

  // =========================================================================
  // ADVANCE PAYMENT ENDPOINTS
  // =========================================================================

  /**
   * Calculate advance payment
   * AC-8: Monthly/quarterly advance calculation
   */
  calculateAdvance: protectedProcedure
    .input(calculateAdvanceSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new IncomeTaxDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.calculateAdvance(input);
    }),

  /**
   * Record advance payment
   * AC-9: Record payment of advance
   */
  recordAdvancePayment: protectedProcedure
    .input(recordAdvancePaymentSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new IncomeTaxDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.recordAdvancePayment(input);
    }),

  /**
   * Get advance payment schedule
   * AC-10: Full year advance schedule
   */
  getAdvanceSchedule: protectedProcedure
    .input(getAdvanceScheduleSchema)
    .query(async ({ ctx, input }) => {
      const service = new IncomeTaxDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.getAdvanceSchedule(input);
    }),

  // =========================================================================
  // LOSS CARRY FORWARD ENDPOINTS
  // =========================================================================

  /**
   * Get available loss carry forward
   * AC-11: View available losses from previous years
   */
  getLossCarryForward: protectedProcedure
    .input(getLossCarryForwardSchema)
    .query(async ({ ctx, input }) => {
      const service = new IncomeTaxDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.getLossCarryForward(input);
    }),

  /**
   * Apply loss carry forward to declaration
   * AC-12: Apply loss deduction (max 50% of income per year)
   */
  applyLoss: protectedProcedure
    .input(applyLossSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new IncomeTaxDeclarationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.applyLoss(input);
    }),
});

export type IncomeTaxDeclarationRouter = typeof incomeTaxDeclarationRouter;
