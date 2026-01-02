import { router, protectedProcedure } from '../../trpc';
import { TaxConfigurationService } from '../../services/tax/tax-configuration.service';
import {
  createTaxConfigurationSchema,
  getTaxConfigurationSchema,
  getTaxConfigurationByClientSchema,
  listTaxConfigurationsSchema,
  updateTaxConfigurationSchema,
  deleteTaxConfigurationSchema,
  addTaxRepresentativeSchema,
  updateTaxRepresentativeSchema,
  removeTaxRepresentativeSchema,
  listTaxRepresentativesSchema,
  getConfigurationHistorySchema,
  restoreConfigurationSchema,
  validateConfigurationSchema,
  checkSmallTaxpayerStatusSchema,
  checkEstonianCitEligibilitySchema,
} from '@ksiegowacrm/shared';

/**
 * TAX-001: Client Tax Configuration Router
 * Manages tax settings for clients including VAT, income tax, ZUS, and e-declaration preferences
 */
export const taxConfigurationRouter = router({
  // ===========================================================================
  // CONFIGURATION CRUD
  // ===========================================================================

  /**
   * Create a new tax configuration for a client
   * Validates business rules (quarterly VAT, Estonian CIT eligibility, etc.)
   */
  create: protectedProcedure
    .input(createTaxConfigurationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaxConfigurationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.createConfiguration(input);
    }),

  /**
   * Get tax configuration by ID
   * Optionally includes tax representatives
   */
  get: protectedProcedure
    .input(getTaxConfigurationSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxConfigurationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getConfiguration(input);
    }),

  /**
   * Get tax configuration by client ID
   * Returns the active configuration for a specific client
   */
  getByClient: protectedProcedure
    .input(getTaxConfigurationByClientSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxConfigurationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getConfigurationByClient(input);
    }),

  /**
   * List tax configurations with filtering and pagination
   * Supports filtering by VAT status, income tax form, ZUS type, etc.
   */
  list: protectedProcedure
    .input(listTaxConfigurationsSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxConfigurationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.listConfigurations(input);
    }),

  /**
   * Update tax configuration
   * Creates audit entries for each changed field
   */
  update: protectedProcedure
    .input(updateTaxConfigurationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaxConfigurationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.updateConfiguration(input);
    }),

  /**
   * Delete (deactivate) tax configuration
   * Supports soft delete (default) or hard delete
   */
  delete: protectedProcedure
    .input(deleteTaxConfigurationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaxConfigurationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.deleteConfiguration(input);
    }),

  // ===========================================================================
  // TAX REPRESENTATIVES
  // ===========================================================================

  /**
   * Add tax representative (pełnomocnik)
   * Validates NIP using Polish checksum algorithm
   */
  addRepresentative: protectedProcedure
    .input(addTaxRepresentativeSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaxConfigurationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.addRepresentative(input);
    }),

  /**
   * Update tax representative details
   */
  updateRepresentative: protectedProcedure
    .input(updateTaxRepresentativeSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaxConfigurationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.updateRepresentative(input);
    }),

  /**
   * Remove (deactivate) tax representative
   */
  removeRepresentative: protectedProcedure
    .input(removeTaxRepresentativeSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaxConfigurationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.removeRepresentative(input);
    }),

  /**
   * List tax representatives for a client
   * Optionally includes inactive representatives
   */
  listRepresentatives: protectedProcedure
    .input(listTaxRepresentativesSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxConfigurationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.listRepresentatives(input);
    }),

  // ===========================================================================
  // CONFIGURATION HISTORY & RESTORE
  // ===========================================================================

  /**
   * Get configuration change history
   * Supports filtering by date range, field name, and action type
   */
  getHistory: protectedProcedure
    .input(getConfigurationHistorySchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxConfigurationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getConfigurationHistory(input);
    }),

  /**
   * Restore previous configuration value from audit history
   */
  restore: protectedProcedure
    .input(restoreConfigurationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaxConfigurationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.restoreConfiguration(input);
    }),

  // ===========================================================================
  // VALIDATION & ELIGIBILITY CHECKS
  // ===========================================================================

  /**
   * Validate configuration before saving
   * Returns validation issues with severity levels
   */
  validate: protectedProcedure
    .input(validateConfigurationSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxConfigurationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.validateConfiguration(input);
    }),

  /**
   * Check if client qualifies as small taxpayer (mały podatnik)
   * Based on previous year revenue (< 2M EUR)
   */
  checkSmallTaxpayerStatus: protectedProcedure
    .input(checkSmallTaxpayerStatusSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxConfigurationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.checkSmallTaxpayerStatus(input);
    }),

  /**
   * Check Estonian CIT eligibility
   * Verifies legal form, employment level, and other requirements
   */
  checkEstonianCitEligibility: protectedProcedure
    .input(checkEstonianCitEligibilitySchema)
    .query(async ({ ctx, input }) => {
      const service = new TaxConfigurationService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.checkEstonianCitEligibility(input);
    }),
});
