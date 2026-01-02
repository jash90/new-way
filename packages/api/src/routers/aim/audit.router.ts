import { router, protectedProcedure } from '../../trpc';
import {
  listAuditLogsSchema,
  getAuditLogSchema,
  getAuditStatsSchema,
  exportAuditLogsSchema,
} from '@ksiegowacrm/shared';
import { AuditService } from '../../services/aim/audit.service';

/**
 * Audit Router (AIM-011)
 * Handles audit log operations
 */
export const auditRouter = router({
  // =========================================================================
  // LIST AUDIT LOGS
  // =========================================================================

  /**
   * List audit logs with filtering and pagination
   */
  list: protectedProcedure.input(listAuditLogsSchema).query(async ({ input, ctx }) => {
    const { prisma, redis } = ctx;

    const auditService = new AuditService(prisma, redis);
    return auditService.listAuditLogs(input);
  }),

  // =========================================================================
  // GET SINGLE AUDIT LOG
  // =========================================================================

  /**
   * Get single audit log by ID
   */
  get: protectedProcedure.input(getAuditLogSchema).query(async ({ input, ctx }) => {
    const { prisma, redis } = ctx;

    const auditService = new AuditService(prisma, redis);
    return auditService.getAuditLog(input.id);
  }),

  // =========================================================================
  // AUDIT STATISTICS
  // =========================================================================

  /**
   * Get audit statistics
   */
  getStats: protectedProcedure.input(getAuditStatsSchema).query(async ({ input, ctx }) => {
    const { prisma, redis } = ctx;

    const auditService = new AuditService(prisma, redis);
    return auditService.getAuditStats(input);
  }),

  // =========================================================================
  // EXPORT AUDIT LOGS
  // =========================================================================

  /**
   * Export audit logs in specified format
   */
  export: protectedProcedure.input(exportAuditLogsSchema).query(async ({ input, ctx }) => {
    const { prisma, redis } = ctx;

    const auditService = new AuditService(prisma, redis);
    return auditService.exportAuditLogs(input);
  }),
});

export type AuditRouter = typeof auditRouter;
