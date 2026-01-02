import { router, protectedProcedure, adminProcedure } from '../../trpc';
import { TaggingService } from '../../services/crm/tagging.service';
import {
  createTagCategorySchema,
  updateTagCategorySchema,
  getTagCategoriesSchema,
  deleteTagCategorySchema,
  createTagSchema,
  updateTagSchema,
  getTagsSchema,
  getTagByIdSchema,
  deleteTagSchema,
  archiveTagSchema,
  restoreTagSchema,
  assignTagsSchema,
  removeTagsSchema,
  getClientTagsSchema,
  replaceClientTagsSchema,
  taggingBulkTagOperationSchema,
  getTaggingStatisticsSchema,
} from '@ksiegowacrm/shared';

/**
 * Tagging Router (CRM-007)
 * Handles client tagging and categorization
 */
export const taggingRouter = router({
  // ===========================================
  // TAG CATEGORY OPERATIONS
  // ===========================================

  /**
   * Get all tag categories with optional tags
   */
  getCategories: protectedProcedure
    .input(getTagCategoriesSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaggingService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.getCategories(input);
    }),

  /**
   * Create a new tag category (admin only)
   */
  createCategory: adminProcedure
    .input(createTagCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaggingService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.createCategory(input);
    }),

  /**
   * Update a tag category (admin only)
   */
  updateCategory: adminProcedure
    .input(updateTagCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaggingService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.updateCategory(input);
    }),

  /**
   * Delete a tag category (admin only)
   */
  deleteCategory: adminProcedure
    .input(deleteTagCategorySchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaggingService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.deleteCategory(input);
    }),

  // ===========================================
  // TAG OPERATIONS
  // ===========================================

  /**
   * Get all tags with filtering
   */
  getTags: protectedProcedure
    .input(getTagsSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaggingService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.getTags(input);
    }),

  /**
   * Get a single tag by ID
   */
  getTagById: protectedProcedure
    .input(getTagByIdSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaggingService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.getTagById(input);
    }),

  /**
   * Create a new tag
   */
  createTag: protectedProcedure
    .input(createTagSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaggingService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.createTag(input);
    }),

  /**
   * Update an existing tag
   */
  updateTag: protectedProcedure
    .input(updateTagSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaggingService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.updateTag(input);
    }),

  /**
   * Archive a tag (soft delete)
   */
  archiveTag: protectedProcedure
    .input(archiveTagSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaggingService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.archiveTag(input);
    }),

  /**
   * Restore an archived tag
   */
  restoreTag: protectedProcedure
    .input(restoreTagSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaggingService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.restoreTag(input);
    }),

  /**
   * Delete a tag (hard or soft delete)
   */
  deleteTag: protectedProcedure
    .input(deleteTagSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaggingService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.deleteTag(input);
    }),

  // ===========================================
  // CLIENT TAG OPERATIONS
  // ===========================================

  /**
   * Get tags assigned to a client
   */
  getClientTags: protectedProcedure
    .input(getClientTagsSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaggingService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.getClientTags(input);
    }),

  /**
   * Assign tags to a client
   */
  assignTags: protectedProcedure
    .input(assignTagsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaggingService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.assignTags(input);
    }),

  /**
   * Remove tags from a client
   */
  removeTags: protectedProcedure
    .input(removeTagsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaggingService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.removeTags(input);
    }),

  /**
   * Replace all client tags (remove existing, add new)
   */
  replaceClientTags: protectedProcedure
    .input(replaceClientTagsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaggingService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.replaceClientTags(input);
    }),

  // ===========================================
  // BULK OPERATIONS
  // ===========================================

  /**
   * Perform bulk tag operations on multiple clients
   */
  bulkTagOperation: protectedProcedure
    .input(taggingBulkTagOperationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TaggingService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.bulkTagOperation(input);
    }),

  // ===========================================
  // STATISTICS
  // ===========================================

  /**
   * Get tag statistics
   */
  getTagStatistics: protectedProcedure
    .input(getTaggingStatisticsSchema)
    .query(async ({ ctx, input }) => {
      const service = new TaggingService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.getTagStatistics(input);
    }),
});
