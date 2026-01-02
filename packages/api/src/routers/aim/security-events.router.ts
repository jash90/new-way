import { router, protectedProcedure } from '../../trpc';
import {
  listSecurityAlertsSchema,
  getSecurityAlertSchema,
  acknowledgeAlertSchema,
  resolveAlertSchema,
  dismissAlertSchema,
  getAlertStatsSchema,
  createNotificationSubscriptionSchema,
  updateNotificationSubscriptionSchema,
  deleteNotificationSubscriptionSchema,
  listNotificationSubscriptionsSchema,
} from '@ksiegowacrm/shared';
import { SecurityEventsService } from '../../services/aim/security-events.service';
import { AuditLogger } from '../../utils/audit-logger';

/**
 * Security Events Router (AIM-012)
 * Handles security alerts, notifications, and event management
 */
export const securityAlertsRouter = router({
  // =========================================================================
  // LIST SECURITY ALERTS
  // =========================================================================

  /**
   * List security alerts with filtering and pagination
   * Available to authenticated users (admins see all, users see their own)
   */
  listAlerts: protectedProcedure.input(listSecurityAlertsSchema).query(async ({ input, ctx }) => {
    const { prisma, redis } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const securityEventsService = new SecurityEventsService(prisma, redis, auditLogger);

    return securityEventsService.listAlerts(input);
  }),

  // =========================================================================
  // GET SINGLE ALERT
  // =========================================================================

  /**
   * Get a single security alert by ID
   */
  getAlert: protectedProcedure.input(getSecurityAlertSchema).query(async ({ input, ctx }) => {
    const { prisma, redis } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const securityEventsService = new SecurityEventsService(prisma, redis, auditLogger);

    return securityEventsService.getAlert(input.id);
  }),

  // =========================================================================
  // ACKNOWLEDGE ALERT
  // =========================================================================

  /**
   * Acknowledge a security alert
   * Changes status from 'active' to 'acknowledged'
   */
  acknowledgeAlert: protectedProcedure
    .input(acknowledgeAlertSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const securityEventsService = new SecurityEventsService(prisma, redis, auditLogger);

      return securityEventsService.acknowledgeAlert(input.id, session!.userId, {
        notes: input.notes,
      });
    }),

  // =========================================================================
  // RESOLVE ALERT
  // =========================================================================

  /**
   * Resolve a security alert with resolution details
   * Changes status from 'active' or 'acknowledged' to 'resolved'
   */
  resolveAlert: protectedProcedure.input(resolveAlertSchema).mutation(async ({ input, ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const securityEventsService = new SecurityEventsService(prisma, redis, auditLogger);

    return securityEventsService.resolveAlert(input.id, session!.userId, {
      resolution: input.resolution,
      preventionActions: input.preventionActions,
    });
  }),

  // =========================================================================
  // DISMISS ALERT
  // =========================================================================

  /**
   * Dismiss a security alert
   * Changes status from 'active' or 'acknowledged' to 'dismissed'
   */
  dismissAlert: protectedProcedure.input(dismissAlertSchema).mutation(async ({ input, ctx }) => {
    const { prisma, redis, session } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const securityEventsService = new SecurityEventsService(prisma, redis, auditLogger);

    return securityEventsService.dismissAlert(input.id, session!.userId, {
      reason: input.reason,
      falsePositive: input.falsePositive,
    });
  }),

  // =========================================================================
  // ALERT STATISTICS
  // =========================================================================

  /**
   * Get alert statistics with optional grouping
   */
  getStats: protectedProcedure.input(getAlertStatsSchema).query(async ({ input, ctx }) => {
    const { prisma, redis } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const securityEventsService = new SecurityEventsService(prisma, redis, auditLogger);

    return securityEventsService.getAlertStats(input);
  }),

  // =========================================================================
  // DASHBOARD SUMMARY
  // =========================================================================

  /**
   * Get security dashboard summary with key metrics
   * Cached for 60 seconds
   */
  getDashboardSummary: protectedProcedure.query(async ({ ctx }) => {
    const { prisma, redis } = ctx;

    const auditLogger = new AuditLogger(prisma);
    const securityEventsService = new SecurityEventsService(prisma, redis, auditLogger);

    return securityEventsService.getDashboardSummary();
  }),

  // =========================================================================
  // CREATE NOTIFICATION SUBSCRIPTION
  // =========================================================================

  /**
   * Create a new notification subscription for the authenticated user
   */
  createNotificationSubscription: protectedProcedure
    .input(createNotificationSubscriptionSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const securityEventsService = new SecurityEventsService(prisma, redis, auditLogger);

      return securityEventsService.createNotificationSubscription(session!.userId, input);
    }),

  // =========================================================================
  // UPDATE NOTIFICATION SUBSCRIPTION
  // =========================================================================

  /**
   * Update an existing notification subscription
   * User must own the subscription
   */
  updateNotificationSubscription: protectedProcedure
    .input(updateNotificationSubscriptionSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const securityEventsService = new SecurityEventsService(prisma, redis, auditLogger);

      return securityEventsService.updateNotificationSubscription(session!.userId, input);
    }),

  // =========================================================================
  // DELETE NOTIFICATION SUBSCRIPTION
  // =========================================================================

  /**
   * Delete a notification subscription
   * User must own the subscription
   */
  deleteNotificationSubscription: protectedProcedure
    .input(deleteNotificationSubscriptionSchema)
    .mutation(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const securityEventsService = new SecurityEventsService(prisma, redis, auditLogger);

      return securityEventsService.deleteNotificationSubscription(session!.userId, input.id);
    }),

  // =========================================================================
  // LIST NOTIFICATION SUBSCRIPTIONS
  // =========================================================================

  /**
   * List notification subscriptions for the authenticated user
   */
  listNotificationSubscriptions: protectedProcedure
    .input(listNotificationSubscriptionsSchema)
    .query(async ({ input, ctx }) => {
      const { prisma, redis, session } = ctx;

      const auditLogger = new AuditLogger(prisma);
      const securityEventsService = new SecurityEventsService(prisma, redis, auditLogger);

      return securityEventsService.listNotificationSubscriptions(session!.userId, input);
    }),
});

export type SecurityAlertsRouter = typeof securityAlertsRouter;
