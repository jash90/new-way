// TAX-013: White List Verification Router
// Manages Polish White List (Biała Lista) verification for VAT payer status and bank accounts

import { router, protectedProcedure } from '../../trpc';
import { WhiteListService } from '../../services/tax/white-list.service';
import {
  verifyNIPRequestSchema,
  verifyIBANRequestSchema,
  batchVerifyRequestSchema,
  paymentVerificationRequestSchema,
  verificationHistoryFilterSchema,
  getVerificationByIdSchema,
  getWhiteListAlertsSchema,
  createWhiteListAlertSchema,
  resolveWhiteListAlertSchema,
  acknowledgeWhiteListAlertSchema,
  escalateWhiteListAlertSchema,
  updateWhiteListConfigSchema,
  exportHistorySchema,
} from '@ksiegowacrm/shared';

/**
 * White List Verification Router
 * Provides endpoints for Polish White List (Biała Lista) verification
 */
export const whiteListRouter = router({
  // =========================================================================
  // VERIFICATION ENDPOINTS
  // =========================================================================

  /**
   * Verify NIP against White List
   * AC-1: Basic NIP verification with active VAT payer status
   */
  verifyNIP: protectedProcedure
    .input(verifyNIPRequestSchema)
    .query(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.verifyNIP(input);
    }),

  /**
   * Verify NIP and IBAN combination against White List
   * AC-2: Bank account verification for payment safety
   */
  verifyIBAN: protectedProcedure
    .input(verifyIBANRequestSchema)
    .query(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.verifyIBAN(input);
    }),

  /**
   * Batch verify multiple NIPs
   * AC-3: Bulk verification for client portfolio
   */
  batchVerify: protectedProcedure
    .input(batchVerifyRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.batchVerify(input);
    }),

  /**
   * Verify payment before execution
   * AC-4: Payment authorization with risk assessment
   */
  verifyPayment: protectedProcedure
    .input(paymentVerificationRequestSchema)
    .query(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.verifyPayment(input);
    }),

  // =========================================================================
  // HISTORY ENDPOINTS
  // =========================================================================

  /**
   * Get verification history
   */
  getHistory: protectedProcedure
    .input(verificationHistoryFilterSchema)
    .query(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.getVerificationHistory(input);
    }),

  /**
   * Get verification by ID
   */
  getById: protectedProcedure
    .input(getVerificationByIdSchema)
    .query(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.getVerificationById(input);
    }),

  // =========================================================================
  // ALERT ENDPOINTS
  // =========================================================================

  /**
   * Get alerts
   */
  getAlerts: protectedProcedure
    .input(getWhiteListAlertsSchema)
    .query(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.getAlerts(input);
    }),

  /**
   * Create alert
   */
  createAlert: protectedProcedure
    .input(createWhiteListAlertSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.createAlert(input);
    }),

  /**
   * Acknowledge alert
   */
  acknowledgeAlert: protectedProcedure
    .input(acknowledgeWhiteListAlertSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.acknowledgeAlert(input);
    }),

  /**
   * Resolve alert
   */
  resolveAlert: protectedProcedure
    .input(resolveWhiteListAlertSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.resolveAlert(input);
    }),

  /**
   * Escalate alert
   */
  escalateAlert: protectedProcedure
    .input(escalateWhiteListAlertSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.escalateAlert(input);
    }),

  // =========================================================================
  // CONFIGURATION ENDPOINTS
  // =========================================================================

  /**
   * Get White List configuration
   */
  getConfig: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new WhiteListService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.getConfig();
    }),

  /**
   * Update White List configuration
   */
  updateConfig: protectedProcedure
    .input(updateWhiteListConfigSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.updateConfig(input);
    }),

  // =========================================================================
  // EXPORT ENDPOINTS
  // =========================================================================

  /**
   * Export verification history
   */
  exportHistory: protectedProcedure
    .input(exportHistorySchema)
    .query(async ({ ctx, input }) => {
      const service = new WhiteListService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.exportHistory(input);
    }),
});

export type WhiteListRouter = typeof whiteListRouter;
