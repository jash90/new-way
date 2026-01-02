import { router, protectedProcedure } from '../../trpc';
import { EntryTemplateService } from '../../services/ace/entry-template.service';
import {
  createEntryTemplateSchema,
  createTemplateFromEntrySchema,
  updateEntryTemplateSchema,
  getEntryTemplateSchema,
  archiveEntryTemplateSchema,
  restoreEntryTemplateSchema,
  deleteEntryTemplateSchema,
  generateEntryFromTemplateSchema,
  batchGenerateEntriesSchema,
  listEntryTemplatesSchema,
  toggleTemplateFavoriteSchema,
  getTemplateVersionsSchema,
  createTemplateCategorySchema,
  updateTemplateCategorySchema,
  deleteTemplateCategorySchema,
} from '@ksiegowacrm/shared';

/**
 * ACC-009: Journal Entry Templates Router
 * Provides template CRUD, entry generation, and category management operations
 */
export const entryTemplateRouter = router({
  // =========================================================================
  // TEMPLATE CRUD
  // =========================================================================

  /**
   * Create a new journal entry template
   * Supports fixed amounts, variables, and formulas
   */
  createTemplate: protectedProcedure
    .input(createEntryTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EntryTemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.createTemplate(input);
    }),

  /**
   * Get template with full details (lines, variables, category)
   */
  getTemplate: protectedProcedure
    .input(getEntryTemplateSchema)
    .query(async ({ ctx, input }) => {
      const service = new EntryTemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getTemplate(input);
    }),

  /**
   * Update template with version tracking
   * Creates version snapshot before changes
   */
  updateTemplate: protectedProcedure
    .input(updateEntryTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EntryTemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.updateTemplate(input);
    }),

  /**
   * Archive a template (soft delete)
   * Archived templates cannot be used for entry generation
   */
  archiveTemplate: protectedProcedure
    .input(archiveEntryTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EntryTemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.archiveTemplate(input);
    }),

  /**
   * Restore an archived template
   */
  restoreTemplate: protectedProcedure
    .input(restoreEntryTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EntryTemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.restoreTemplate(input);
    }),

  /**
   * Delete a template permanently
   * Only allowed for templates that have never been used
   */
  deleteTemplate: protectedProcedure
    .input(deleteEntryTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EntryTemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.deleteTemplate(input);
    }),

  // =========================================================================
  // LIST AND SEARCH
  // =========================================================================

  /**
   * List templates with filtering and pagination
   * Supports filtering by status, category, entry type, favorites
   */
  listTemplates: protectedProcedure
    .input(listEntryTemplatesSchema)
    .query(async ({ ctx, input }) => {
      const service = new EntryTemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.listTemplates(input);
    }),

  // =========================================================================
  // FAVORITES
  // =========================================================================

  /**
   * Toggle favorite status for a template
   */
  toggleFavorite: protectedProcedure
    .input(toggleTemplateFavoriteSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EntryTemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.toggleFavorite(input);
    }),

  // =========================================================================
  // VERSIONS
  // =========================================================================

  /**
   * Get version history for a template
   */
  getTemplateVersions: protectedProcedure
    .input(getTemplateVersionsSchema)
    .query(async ({ ctx, input }) => {
      const service = new EntryTemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getTemplateVersions(input);
    }),

  // =========================================================================
  // ENTRY GENERATION
  // =========================================================================

  /**
   * Generate a journal entry from a template
   * Supports variable substitution, formula evaluation, and amount overrides
   */
  generateEntryFromTemplate: protectedProcedure
    .input(generateEntryFromTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EntryTemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.generateEntryFromTemplate(input);
    }),

  /**
   * Batch generate multiple entries from a template
   * Useful for recurring entries across multiple periods
   */
  batchGenerateEntries: protectedProcedure
    .input(batchGenerateEntriesSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EntryTemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.batchGenerateEntries(input);
    }),

  /**
   * Create a template from an existing journal entry
   * Extracts line structure for reuse
   */
  createTemplateFromEntry: protectedProcedure
    .input(createTemplateFromEntrySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EntryTemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.createTemplateFromEntry(input);
    }),

  // =========================================================================
  // CATEGORIES
  // =========================================================================

  /**
   * Create a template category
   */
  createCategory: protectedProcedure
    .input(createTemplateCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EntryTemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.createCategory(input);
    }),

  /**
   * Update a template category
   */
  updateCategory: protectedProcedure
    .input(updateTemplateCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EntryTemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.updateCategory(input);
    }),

  /**
   * Delete a template category
   * Only allowed if no templates are using it
   */
  deleteCategory: protectedProcedure
    .input(deleteTemplateCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new EntryTemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.deleteCategory(input);
    }),

  /**
   * List all template categories
   */
  listCategories: protectedProcedure
    .query(async ({ ctx }) => {
      const service = new EntryTemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.listCategories();
    }),
});

export type EntryTemplateRouter = typeof entryTemplateRouter;
