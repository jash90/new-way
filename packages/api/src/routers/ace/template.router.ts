import { router, protectedProcedure } from '../../trpc';
import { TemplateService } from '../../services/ace/template.service';
import {
  listTemplatesSchema,
  getTemplateSchema,
  previewTemplateSchema,
  applyTemplateSchema,
  getTemplateApplicationsSchema,
} from '@ksiegowacrm/shared';

/**
 * ACC-002: Polish Chart of Accounts Templates Router
 * Manages account template operations for Polish CoA standards
 */
export const templateRouter = router({
  /**
   * List available templates
   * Returns all active templates with optional filtering by business type, company size, or search
   */
  list: protectedProcedure
    .input(listTemplatesSchema)
    .query(async ({ ctx, input }) => {
      const service = new TemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.listTemplates(input);
    }),

  /**
   * Get template by ID
   * Returns template details without accounts
   */
  get: protectedProcedure
    .input(getTemplateSchema)
    .query(async ({ ctx, input }) => {
      const service = new TemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getTemplate(input);
    }),

  /**
   * Preview template application
   * Shows all accounts that would be created and detects conflicts with existing accounts
   */
  preview: protectedProcedure
    .input(previewTemplateSchema)
    .query(async ({ ctx, input }) => {
      const service = new TemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.previewTemplate(input);
    }),

  /**
   * Apply template to organization
   * Creates accounts from template with optional exclusions and modifications
   */
  applyTemplate: protectedProcedure
    .input(applyTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new TemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.applyTemplate(input);
    }),

  /**
   * Get template application history
   * Returns all times templates have been applied to the organization
   */
  applications: protectedProcedure
    .input(getTemplateApplicationsSchema)
    .query(async ({ ctx, input }) => {
      const service = new TemplateService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getTemplateApplications(input);
    }),
});
