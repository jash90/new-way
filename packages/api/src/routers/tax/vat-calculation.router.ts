// TAX-004: VAT Calculation Engine Router
// Manages Polish VAT calculations, EU transactions, corrections, and settlements

import { router, protectedProcedure } from '../../trpc';
import { VatCalculationService } from '../../services/tax/vat-calculation.service';
import {
  calculateVatInputSchema,
  recordVatTransactionSchema,
  processWntSchema,
  processWdtSchema,
  processImportServicesSchema,
  createVatCorrectionSchema,
  getVatSettlementSchema,
  finalizeVatSettlementSchema,
  applyCarryForwardSchema,
  getVatTransactionsSchema,
  getVatTransactionByIdSchema,
  verifyEuVatIdSchema,
  getCarryForwardsSchema,
  getPeriodSummariesSchema,
} from '@ksiegowacrm/shared';

/**
 * VAT Calculation Router
 * Provides endpoints for Polish VAT calculations, EU transactions, and settlements
 */
export const vatCalculationRouter = router({
  // =========================================================================
  // CALCULATION ENDPOINTS
  // =========================================================================

  /**
   * Calculate VAT from net or gross amount
   */
  calculateVat: protectedProcedure
    .input(calculateVatInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new VatCalculationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.calculateVat(input);
    }),

  /**
   * Record a VAT transaction
   */
  recordTransaction: protectedProcedure
    .input(recordVatTransactionSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new VatCalculationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.recordTransaction(input);
    }),

  /**
   * Process WNT (Intra-Community Acquisition)
   */
  processWnt: protectedProcedure
    .input(processWntSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new VatCalculationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.processWnt(input);
    }),

  /**
   * Process WDT (Intra-Community Supply)
   */
  processWdt: protectedProcedure
    .input(processWdtSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new VatCalculationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.processWdt(input);
    }),

  /**
   * Process import of services (reverse charge)
   */
  processImportServices: protectedProcedure
    .input(processImportServicesSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new VatCalculationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.processImportServices(input);
    }),

  /**
   * Create VAT correction
   */
  createCorrection: protectedProcedure
    .input(createVatCorrectionSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new VatCalculationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.createCorrection(input);
    }),

  // =========================================================================
  // SETTLEMENT ENDPOINTS
  // =========================================================================

  /**
   * Get VAT settlement for a period
   */
  getSettlement: protectedProcedure
    .input(getVatSettlementSchema)
    .query(async ({ ctx, input }) => {
      const service = new VatCalculationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.getSettlement(input);
    }),

  /**
   * Finalize VAT settlement for a period
   */
  finalizeSettlement: protectedProcedure
    .input(finalizeVatSettlementSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new VatCalculationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.finalizeSettlement(input);
    }),

  /**
   * Apply carry forward to a period
   */
  applyCarryForward: protectedProcedure
    .input(applyCarryForwardSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new VatCalculationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.applyCarryForward(input);
    }),

  // =========================================================================
  // RETRIEVAL ENDPOINTS
  // =========================================================================

  /**
   * Get VAT transactions for a period
   */
  getTransactions: protectedProcedure
    .input(getVatTransactionsSchema)
    .query(async ({ ctx, input }) => {
      const service = new VatCalculationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.getTransactions(input);
    }),

  /**
   * Get VAT transaction by ID
   */
  getTransactionById: protectedProcedure
    .input(getVatTransactionByIdSchema)
    .query(async ({ ctx, input }) => {
      const service = new VatCalculationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.getTransactionById(input);
    }),

  /**
   * Verify EU VAT ID via VIES
   */
  verifyEuVatId: protectedProcedure
    .input(verifyEuVatIdSchema)
    .query(async ({ ctx, input }) => {
      const service = new VatCalculationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.verifyEuVatId(input);
    }),

  /**
   * Get carry forwards for a client
   */
  getCarryForwards: protectedProcedure
    .input(getCarryForwardsSchema)
    .query(async ({ ctx, input }) => {
      const service = new VatCalculationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.getCarryForwards(input);
    }),

  /**
   * Get period summaries
   */
  getPeriodSummaries: protectedProcedure
    .input(getPeriodSummariesSchema)
    .query(async ({ ctx, input }) => {
      const service = new VatCalculationService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.getPeriodSummaries(input);
    }),
});

export type VatCalculationRouter = typeof vatCalculationRouter;
