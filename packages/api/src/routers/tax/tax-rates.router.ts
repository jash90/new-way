// TAX-002: Tax Rates and Rules Management Router
// Manages Polish tax rates for VAT, CIT, PIT, ZUS, FP, FGSP

import { router, protectedProcedure } from '../../trpc';
import { TaxRatesService } from '../../services/tax';
import {
  getRatesSchema,
  getRateByCodeSchema,
  getThresholdsSchema,
  getZUSBasesSchema,
  calculateVATSchema,
  calculatePITSchema,
  calculateZUSSchema,
  updateTaxRateSchema,
  createTaxRateSchema,
  getRateHistorySchema,
  analyzeRateChangeImpactSchema,
  getLumpSumRateSchema,
  getCurrentRatesSummarySchema,
} from '@ksiegowacrm/shared';

/**
 * Tax Rates Router
 * Provides endpoints for retrieving and calculating Polish tax rates
 */
export const taxRatesRouter = router({
  // =========================================================================
  // RATE RETRIEVAL ENDPOINTS
  // =========================================================================

  /**
   * Get all rates for a specific tax type
   */
  getRates: protectedProcedure
    .input(getRatesSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxRatesService(ctx.prisma);
      return service.getRates(input);
    }),

  /**
   * Get a specific rate by type and code
   */
  getRateByCode: protectedProcedure
    .input(getRateByCodeSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxRatesService(ctx.prisma);
      return service.getRateByCode(input);
    }),

  /**
   * Get tax thresholds for progressive scales
   */
  getThresholds: protectedProcedure
    .input(getThresholdsSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxRatesService(ctx.prisma);
      return service.getThresholds(input);
    }),

  /**
   * Get ZUS contribution bases for a period
   */
  getZUSBases: protectedProcedure
    .input(getZUSBasesSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxRatesService(ctx.prisma);
      return service.getZUSBases(input);
    }),

  /**
   * Get current rates summary for dashboard
   */
  getCurrentRatesSummary: protectedProcedure
    .input(getCurrentRatesSummarySchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxRatesService(ctx.prisma);
      return service.getCurrentRatesSummary(input);
    }),

  /**
   * Get lump sum rate for activity type
   */
  getLumpSumRate: protectedProcedure
    .input(getLumpSumRateSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxRatesService(ctx.prisma);
      return service.getLumpSumRate(input);
    }),

  // =========================================================================
  // CALCULATION ENDPOINTS
  // =========================================================================

  /**
   * Calculate VAT amount for a transaction
   */
  calculateVAT: protectedProcedure
    .input(calculateVATSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaxRatesService(ctx.prisma);
      return service.calculateVAT(input);
    }),

  /**
   * Calculate PIT (Personal Income Tax)
   */
  calculatePIT: protectedProcedure
    .input(calculatePITSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaxRatesService(ctx.prisma);
      return service.calculatePIT(input);
    }),

  /**
   * Calculate ZUS contributions
   */
  calculateZUS: protectedProcedure
    .input(calculateZUSSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaxRatesService(ctx.prisma);
      return service.calculateZUS(input);
    }),

  // =========================================================================
  // ADMIN ENDPOINTS
  // =========================================================================

  /**
   * Create a new tax rate (admin only)
   */
  createRate: protectedProcedure
    .input(createTaxRateSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaxRatesService(ctx.prisma);
      return service.createRate(input, ctx.session!.userId);
    }),

  /**
   * Update an existing tax rate (admin only)
   */
  updateRate: protectedProcedure
    .input(updateTaxRateSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaxRatesService(ctx.prisma);
      return service.updateRate(input, ctx.session!.userId);
    }),

  /**
   * Get audit history for a tax rate
   */
  getRateHistory: protectedProcedure
    .input(getRateHistorySchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxRatesService(ctx.prisma);
      return service.getRateHistory(input);
    }),

  /**
   * Analyze impact of a rate change
   */
  analyzeRateChangeImpact: protectedProcedure
    .input(analyzeRateChangeImpactSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxRatesService(ctx.prisma);
      return service.analyzeRateChangeImpact(input);
    }),
});

export type TaxRatesRouter = typeof taxRatesRouter;
