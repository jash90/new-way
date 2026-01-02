import { router, protectedProcedure } from '../../trpc';
import { StatisticsService } from '../../services/crm/statistics.service';
import {
  getStatisticsOverviewSchema,
  getClientGrowthSchema,
  getTagStatisticsSchema,
  getRiskDistributionSchema,
  getActivityStatisticsSchema,
  getVatStatisticsSchema,
  getTopClientsSchema,
  getDashboardSummarySchema,
} from '@ksiegowacrm/shared';

/**
 * CRM-011: Client Statistics Router
 * Provides analytics and statistics endpoints for CRM dashboard
 */
export const statisticsRouter = router({
  /**
   * Get statistics overview
   * Returns high-level client statistics including counts, distribution by type/status
   */
  getOverview: protectedProcedure
    .input(getStatisticsOverviewSchema)
    .query(async ({ ctx, input }) => {
      const service = new StatisticsService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getStatisticsOverview(input);
    }),

  /**
   * Get client growth data
   * Returns growth data points over time with trend analysis
   */
  getGrowth: protectedProcedure
    .input(getClientGrowthSchema)
    .query(async ({ ctx, input }) => {
      const service = new StatisticsService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getClientGrowth(input);
    }),

  /**
   * Get tag statistics
   * Returns tag distribution and usage analytics
   */
  getTagStatistics: protectedProcedure
    .input(getTagStatisticsSchema)
    .query(async ({ ctx, input }) => {
      const service = new StatisticsService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getTagStatistics(input);
    }),

  /**
   * Get risk distribution
   * Returns client distribution by risk assessment level
   */
  getRiskDistribution: protectedProcedure
    .input(getRiskDistributionSchema)
    .query(async ({ ctx, input }) => {
      const service = new StatisticsService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getRiskDistribution(input);
    }),

  /**
   * Get activity statistics
   * Returns event activity breakdown and most active clients
   */
  getActivityStatistics: protectedProcedure
    .input(getActivityStatisticsSchema)
    .query(async ({ ctx, input }) => {
      const service = new StatisticsService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getActivityStatistics(input);
    }),

  /**
   * Get VAT statistics
   * Returns VAT validation status distribution
   */
  getVatStatistics: protectedProcedure
    .input(getVatStatisticsSchema)
    .query(async ({ ctx, input }) => {
      const service = new StatisticsService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getVatStatistics(input);
    }),

  /**
   * Get top clients
   * Returns clients ranked by specified metric
   */
  getTopClients: protectedProcedure
    .input(getTopClientsSchema)
    .query(async ({ ctx, input }) => {
      const service = new StatisticsService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getTopClients(input);
    }),

  /**
   * Get dashboard summary
   * Returns comprehensive dashboard data with overview, growth, alerts, and quick stats
   */
  getDashboard: protectedProcedure
    .input(getDashboardSummarySchema)
    .query(async ({ ctx, input }) => {
      const service = new StatisticsService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId
      );
      return service.getDashboardSummary(input);
    }),
});
