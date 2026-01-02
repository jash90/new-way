// TAX-007: JPK Reporting Router
// Manages JPK (Jednolity Plik Kontrolny - Standard Audit File) for Polish tax compliance

import { router, protectedProcedure } from '../../trpc';
import { JPKReportingService } from '../../services/tax/jpk-reporting.service';
import {
  createJPKReportSchema,
  generateJPKXMLSchema,
  addJPKSaleRecordSchema,
  addJPKPurchaseRecordSchema,
  importFromVATTransactionsSchema,
  validateJPKReportSchema,
  signJPKReportSchema,
  submitJPKReportSchema,
  checkJPKStatusSchema,
  downloadUPOSchema,
  createJPKCorrectionSchema,
  getJPKReportSchema,
  listJPKReportsSchema,
  deleteJPKReportSchema,
  downloadJPKXMLSchema,
  updateJPKDeclarationSchema,
} from '@ksiegowacrm/shared';

/**
 * JPK Reporting Router
 * Provides endpoints for Polish JPK (Standard Audit File) generation and submission
 */
export const jpkReportingRouter = router({
  // =========================================================================
  // REPORT MANAGEMENT ENDPOINTS
  // =========================================================================

  /**
   * Create new JPK report
   * AC-1: Initialize report for specific period
   */
  createReport: protectedProcedure
    .input(createJPKReportSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JPKReportingService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.createReport(input);
    }),

  /**
   * Add sale record to JPK_V7 report
   * AC-2: Add VAT output transaction
   */
  addSaleRecord: protectedProcedure
    .input(addJPKSaleRecordSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JPKReportingService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.addSaleRecord(input);
    }),

  /**
   * Add purchase record to JPK_V7 report
   * AC-3: Add VAT input transaction
   */
  addPurchaseRecord: protectedProcedure
    .input(addJPKPurchaseRecordSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JPKReportingService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.addPurchaseRecord(input);
    }),

  /**
   * Import records from VAT transactions
   * AC-4: Bulk import from existing VAT records
   */
  importFromVATTransactions: protectedProcedure
    .input(importFromVATTransactionsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JPKReportingService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.importFromVATTransactions(input);
    }),

  /**
   * Update JPK_V7 declaration section
   * AC-5: Set P_10 through P_70 values
   */
  updateDeclaration: protectedProcedure
    .input(updateJPKDeclarationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JPKReportingService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.updateDeclaration(input);
    }),

  // =========================================================================
  // XML GENERATION ENDPOINTS
  // =========================================================================

  /**
   * Generate JPK XML file
   * AC-6: Create XML according to Ministry schema
   */
  generateXML: protectedProcedure
    .input(generateJPKXMLSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JPKReportingService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.generateXML(input);
    }),

  /**
   * Validate JPK report
   * AC-7: Validate against XSD and business rules
   */
  validateReport: protectedProcedure
    .input(validateJPKReportSchema)
    .query(async ({ ctx, input }) => {
      const service = new JPKReportingService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.validateReport(input);
    }),

  // =========================================================================
  // SIGNING AND SUBMISSION ENDPOINTS
  // =========================================================================

  /**
   * Sign JPK report with digital signature
   * AC-8: Apply qualified signature or Trusted Profile
   */
  signReport: protectedProcedure
    .input(signJPKReportSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JPKReportingService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.signReport(input);
    }),

  /**
   * Submit JPK report to tax authority
   * AC-9: Send to Ministry of Finance gateway
   */
  submitReport: protectedProcedure
    .input(submitJPKReportSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JPKReportingService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.submitReport(input);
    }),

  /**
   * Check submission status
   * AC-10: Query Ministry for UPO status
   */
  checkStatus: protectedProcedure
    .input(checkJPKStatusSchema)
    .query(async ({ ctx, input }) => {
      const service = new JPKReportingService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.checkStatus(input);
    }),

  /**
   * Download UPO (official receipt)
   * AC-11: Get Urzędowe Poświadczenie Odbioru
   */
  downloadUPO: protectedProcedure
    .input(downloadUPOSchema)
    .query(async ({ ctx, input }) => {
      const service = new JPKReportingService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.downloadUPO(input);
    }),

  // =========================================================================
  // CORRECTION AND RETRIEVAL ENDPOINTS
  // =========================================================================

  /**
   * Create correction report
   * AC-12: Create korekta for previously submitted report
   */
  createCorrection: protectedProcedure
    .input(createJPKCorrectionSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JPKReportingService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.createCorrection(input);
    }),

  /**
   * Get report by ID with optional records
   * AC-13: Retrieve full report details
   */
  getReport: protectedProcedure
    .input(getJPKReportSchema)
    .query(async ({ ctx, input }) => {
      const service = new JPKReportingService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.getReport(input);
    }),

  /**
   * List reports with filters
   * AC-14: Query reports with pagination
   */
  listReports: protectedProcedure
    .input(listJPKReportsSchema)
    .query(async ({ ctx, input }) => {
      const service = new JPKReportingService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.listReports(input);
    }),

  /**
   * Delete report (only draft/error status)
   * AC-15: Remove incomplete reports
   */
  deleteReport: protectedProcedure
    .input(deleteJPKReportSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JPKReportingService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.deleteReport(input);
    }),

  /**
   * Download XML file
   * AC-16: Get generated or signed XML content
   */
  downloadXML: protectedProcedure
    .input(downloadJPKXMLSchema)
    .query(async ({ ctx, input }) => {
      const service = new JPKReportingService(
        ctx.prisma,
        ctx.session.organizationId,
        ctx.session.userId,
      );
      return service.downloadXML(input);
    }),
});

export type JPKReportingRouter = typeof jpkReportingRouter;
