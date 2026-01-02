import { router, protectedProcedure, publicProcedure } from '../../trpc';
import { PortalService } from '../../services/crm/portal.service';
import {
  createPortalAccessSchema,
  getPortalAccessSchema,
  listPortalAccessSchema,
  updatePortalAccessSchema,
  revokePortalAccessSchema,
  resendInvitationSchema,
  getClientPortalAccessSchema,
  bulkRevokePortalAccessSchema,
  bulkUpdatePermissionsSchema,
  getPortalStatisticsSchema,
  getPortalActivitySchema,
  validatePortalTokenSchema,
  activatePortalAccessSchema,
} from '@ksiegowacrm/shared';

/**
 * Simple email service stub for portal invitations
 * TODO: Replace with actual email service implementation (e.g., SendGrid, SES)
 */
const emailService = {
  sendEmail: async (params: { to: string; subject: string; body: string }) => {
    // Log email for development, actual implementation should send email
    console.log(`[EMAIL] To: ${params.to}, Subject: ${params.subject}`);
    return { success: true };
  },
};

/**
 * Helper to create PortalService instances with proper context
 */
function createPortalServiceFromContext(ctx: {
  prisma: any;
  redis: any;
  auditLogger: any;
  session?: { userId: string; organizationId: string } | null;
}) {
  const userId = ctx.session?.userId || '';
  const organizationId = ctx.session?.organizationId || '';

  return new PortalService(
    ctx.prisma,
    ctx.redis,
    ctx.auditLogger,
    emailService,
    userId,
    organizationId
  );
}

/**
 * CRM-012: Portal Access Management Router
 * Manages client portal access, invitations, and permissions
 */
export const portalRouter = router({
  /**
   * Create new portal access for a client
   * Creates access record and optionally sends invitation email
   */
  create: protectedProcedure
    .input(createPortalAccessSchema)
    .mutation(async ({ ctx, input }) => {
      const service = createPortalServiceFromContext(ctx);
      return service.createPortalAccess(input);
    }),

  /**
   * Get portal access by ID
   */
  get: protectedProcedure
    .input(getPortalAccessSchema)
    .query(async ({ ctx, input }) => {
      const service = createPortalServiceFromContext(ctx);
      return service.getPortalAccess(input);
    }),

  /**
   * List portal accesses with filtering
   */
  list: protectedProcedure
    .input(listPortalAccessSchema)
    .query(async ({ ctx, input }) => {
      const service = createPortalServiceFromContext(ctx);
      return service.listPortalAccess(input);
    }),

  /**
   * Update portal access (permissions, status, expiry)
   */
  update: protectedProcedure
    .input(updatePortalAccessSchema)
    .mutation(async ({ ctx, input }) => {
      const service = createPortalServiceFromContext(ctx);
      return service.updatePortalAccess(input);
    }),

  /**
   * Revoke portal access
   */
  revoke: protectedProcedure
    .input(revokePortalAccessSchema)
    .mutation(async ({ ctx, input }) => {
      const service = createPortalServiceFromContext(ctx);
      return service.revokePortalAccess(input);
    }),

  /**
   * Resend invitation email for pending access
   */
  resendInvitation: protectedProcedure
    .input(resendInvitationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = createPortalServiceFromContext(ctx);
      return service.resendInvitation(input);
    }),

  /**
   * Get all portal accesses for a specific client
   * Uses listPortalAccess with clientId filter
   */
  getByClient: protectedProcedure
    .input(getClientPortalAccessSchema)
    .query(async ({ ctx, input }) => {
      const service = createPortalServiceFromContext(ctx);
      return service.listPortalAccess({ clientId: input.clientId, limit: 100, offset: 0 });
    }),

  /**
   * Bulk revoke multiple portal accesses
   */
  bulkRevoke: protectedProcedure
    .input(bulkRevokePortalAccessSchema)
    .mutation(async ({ ctx, input }) => {
      const service = createPortalServiceFromContext(ctx);
      return service.bulkRevokePortalAccess(input);
    }),

  /**
   * Bulk update permissions for multiple accesses
   */
  bulkUpdatePermissions: protectedProcedure
    .input(bulkUpdatePermissionsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = createPortalServiceFromContext(ctx);
      return service.bulkUpdatePermissions(input);
    }),

  /**
   * Get portal access statistics
   */
  getStatistics: protectedProcedure
    .input(getPortalStatisticsSchema)
    .query(async ({ ctx, input }) => {
      const service = createPortalServiceFromContext(ctx);
      return service.getPortalStatistics(input);
    }),

  /**
   * Get portal activity log
   */
  getActivity: protectedProcedure
    .input(getPortalActivitySchema)
    .query(async ({ ctx, input }) => {
      const service = createPortalServiceFromContext(ctx);
      return service.getPortalActivity(input);
    }),

  /**
   * Validate portal invitation token (public endpoint)
   * Used when user clicks the invitation link
   */
  validateToken: publicProcedure
    .input(validatePortalTokenSchema)
    .query(async ({ ctx, input }) => {
      const service = createPortalServiceFromContext(ctx);
      return service.validatePortalToken(input);
    }),

  /**
   * Activate portal access with token and password (public endpoint)
   * Called when user completes registration via invitation link
   */
  activate: publicProcedure
    .input(activatePortalAccessSchema)
    .mutation(async ({ ctx, input }) => {
      const service = createPortalServiceFromContext(ctx);
      return service.activatePortalAccess(input);
    }),
});

export type PortalRouter = typeof portalRouter;
