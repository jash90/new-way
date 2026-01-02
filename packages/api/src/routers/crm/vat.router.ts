import { router, protectedProcedure } from '../../trpc';
import {
  validateVatSchema,
  validateClientVatSchema,
  getVatStatusSchema,
  refreshVatStatusSchema,
  batchValidateVatSchema,
} from '@ksiegowacrm/shared';
import { VatService } from '../../services/crm/vat.service';
import { AuditLogger } from '../../utils/audit-logger';

/**
 * VAT Router (CRM-003)
 * Handles VAT/VIES validation operations for EU VAT numbers
 */
export const vatRouter = router({
  // =========================================================================
  // VALIDATE VAT NUMBER
  // =========================================================================

  /**
   * Validate any EU VAT number via VIES API
   * Standalone validation without associating to a client
   */
  validateVat: protectedProcedure
    .input(validateVatSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const vatService = new VatService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return vatService.validateVat(input);
    }),

  // =========================================================================
  // VALIDATE CLIENT VAT
  // =========================================================================

  /**
   * Validate VAT number for a specific client
   * Uses client's NIP if no VAT number provided
   * Updates client record with validation results
   */
  validateClientVat: protectedProcedure
    .input(validateClientVatSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const vatService = new VatService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return vatService.validateClientVat(input);
    }),

  // =========================================================================
  // GET VAT STATUS
  // =========================================================================

  /**
   * Get VAT validation status for a client
   * Returns cached status without re-validating
   */
  getVatStatus: protectedProcedure
    .input(getVatStatusSchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const vatService = new VatService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return vatService.getVatStatus(input);
    }),

  // =========================================================================
  // REFRESH VAT STATUS
  // =========================================================================

  /**
   * Force refresh VAT validation for a client
   * Invalidates cache and re-validates via VIES
   */
  refreshVatStatus: protectedProcedure
    .input(refreshVatStatusSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const vatService = new VatService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return vatService.refreshVatStatus(input);
    }),

  // =========================================================================
  // BATCH VALIDATE VAT
  // =========================================================================

  /**
   * Validate VAT for multiple clients in batch
   * Maximum 50 clients per request
   */
  batchValidateVat: protectedProcedure
    .input(batchValidateVatSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const vatService = new VatService(
        prisma,
        redis,
        auditLogger,
        session!.userId,
        session!.organizationId || null
      );

      return vatService.batchValidateVat(input);
    }),
});

export type VatRouter = typeof vatRouter;
