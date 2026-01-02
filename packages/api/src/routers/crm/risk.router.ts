import { router, protectedProcedure } from '../../trpc';
import { RiskService } from '../../services/crm/risk.service';
import {
  assessClientRiskSchema,
  getClientRiskHistorySchema,
  updateRiskConfigSchema,
  bulkAssessRiskSchema,
  getHighRiskClientsSchema,
} from '@ksiegowacrm/shared';

/**
 * Risk Router (CRM-009)
 * Handles AI-powered risk assessment for clients
 */
export const riskRouter = router({
  /**
   * Assess risk for a single client
   */
  assessClientRisk: protectedProcedure
    .input(assessClientRiskSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new RiskService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.assessClientRisk(input);
    }),

  /**
   * Get risk assessment history for a client
   */
  getClientRiskHistory: protectedProcedure
    .input(getClientRiskHistorySchema)
    .query(async ({ ctx, input }) => {
      const service = new RiskService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.getClientRiskHistory(input);
    }),

  /**
   * Update risk assessment configuration
   */
  updateRiskConfig: protectedProcedure
    .input(updateRiskConfigSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new RiskService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.updateRiskConfig(input);
    }),

  /**
   * Get current risk assessment configuration
   */
  getRiskConfig: protectedProcedure.query(async ({ ctx }) => {
    const service = new RiskService(
      ctx.prisma,
      ctx.redis,
      ctx.auditLogger,
      ctx.session.userId,
      ctx.session.organizationId || null
    );
    return service.getRiskConfig();
  }),

  /**
   * Bulk assess risk for multiple clients
   */
  bulkAssessRisk: protectedProcedure
    .input(bulkAssessRiskSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new RiskService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.bulkAssessRisk(input);
    }),

  /**
   * Get list of high-risk clients
   */
  getHighRiskClients: protectedProcedure
    .input(getHighRiskClientsSchema)
    .query(async ({ ctx, input }) => {
      const service = new RiskService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.getHighRiskClients(input);
    }),
});

export type RiskRouter = typeof riskRouter;
