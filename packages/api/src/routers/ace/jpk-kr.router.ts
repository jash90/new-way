import { router, protectedProcedure } from '../../trpc';
import { JpkKrService } from '../../services/ace/jpk-kr.service';
import {
  preValidateJpkKrSchema,
  generateJpkKrSchema,
  validateJpkSchema,
  downloadJpkSchema,
  getJpkLogSchema,
  listJpkLogsSchema,
  updateAccountMappingSchema,
  markJpkSubmittedSchema,
} from '@ksiegowacrm/shared';
import { z } from 'zod';

/**
 * ACC-015: JPK-KR Export (Jednolity Plik Kontrolny - Księgi Rachunkowe) Router
 * Provides Polish tax authority electronic reporting operations
 * Compliant with Ministry of Finance JPK_KR specification
 */
export const jpkKrRouter = router({
  // ===========================================================================
  // PRE-VALIDATION
  // ===========================================================================

  /**
   * Pre-validate data before JPK_KR generation
   * Checks organization data, account mappings, entry numbering, draft entries, trial balance
   */
  preValidate: protectedProcedure
    .input(preValidateJpkKrSchema)
    .query(async ({ ctx, input }) => {
      const service = new JpkKrService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.preValidate(input);
    }),

  // ===========================================================================
  // JPK GENERATION
  // ===========================================================================

  /**
   * Generate JPK_KR file for a specified period
   * Creates XML file following Ministry of Finance XSD schema
   * Supports original and correction submissions
   */
  generate: protectedProcedure
    .input(generateJpkKrSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JpkKrService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.generate(input);
    }),

  // ===========================================================================
  // SCHEMA VALIDATION
  // ===========================================================================

  /**
   * Validate generated JPK file against Ministry of Finance XSD schema
   * Returns validation result with detailed error messages
   */
  validateSchema: protectedProcedure
    .input(validateJpkSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JpkKrService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.validateSchema(input);
    }),

  // ===========================================================================
  // FILE DOWNLOAD
  // ===========================================================================

  /**
   * Download generated JPK file
   * Returns base64 encoded content with file metadata
   */
  download: protectedProcedure
    .input(downloadJpkSchema)
    .query(async ({ ctx, input }) => {
      const service = new JpkKrService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.download(input);
    }),

  // ===========================================================================
  // LOG MANAGEMENT
  // ===========================================================================

  /**
   * Get details of a specific JPK generation log
   * Includes user information and statistics
   */
  getLog: protectedProcedure
    .input(getJpkLogSchema)
    .query(async ({ ctx, input }) => {
      const service = new JpkKrService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getLog(input);
    }),

  /**
   * List JPK generation logs with filtering and pagination
   * Supports filtering by fiscal year, status, and JPK type
   */
  listLogs: protectedProcedure
    .input(listJpkLogsSchema)
    .query(async ({ ctx, input }) => {
      const service = new JpkKrService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.listLogs(input);
    }),

  // ===========================================================================
  // ACCOUNT MAPPINGS
  // ===========================================================================

  /**
   * Get all account mappings for JPK export
   * Returns mapping status and configuration for each account
   */
  getAccountMappings: protectedProcedure
    .input(z.object({}))
    .query(async ({ ctx }) => {
      const service = new JpkKrService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getAccountMappings();
    }),

  /**
   * Update account mapping for JPK export
   * Configure JPK account type, category code, and team code
   */
  updateAccountMapping: protectedProcedure
    .input(updateAccountMappingSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JpkKrService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.updateAccountMapping(input);
    }),

  // ===========================================================================
  // SUBMISSION TRACKING
  // ===========================================================================

  /**
   * Mark JPK file as submitted to tax authority
   * Records submission timestamp and optional reference number
   * Only VALID files can be marked as submitted
   */
  markSubmitted: protectedProcedure
    .input(markJpkSubmittedSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new JpkKrService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.markSubmitted(input);
    }),
});

export type JpkKrRouter = typeof jpkKrRouter;
