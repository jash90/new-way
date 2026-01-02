import { router, protectedProcedure } from '../../trpc';
import { BulkService } from '../../services/crm/bulk.service';
import {
  bulkArchiveClientsSchema,
  bulkRestoreClientsSchema,
  bulkDeleteClientsSchema,
  bulkUpdateStatusSchema,
  bulkUpdateTagsSchema,
  bulkAssignOwnerSchema,
  bulkExportClientsSchema,
  getBulkOperationStatusSchema,
  listBulkOperationsSchema,
  cancelBulkOperationSchema,
} from '@ksiegowacrm/shared';

/**
 * Bulk Operations Router (CRM-010)
 * Handles batch operations on multiple clients
 */
export const bulkRouter = router({
  /**
   * Archive multiple clients
   */
  archiveClients: protectedProcedure
    .input(bulkArchiveClientsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new BulkService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.bulkArchiveClients(input);
    }),

  /**
   * Restore multiple archived clients
   */
  restoreClients: protectedProcedure
    .input(bulkRestoreClientsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new BulkService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.bulkRestoreClients(input);
    }),

  /**
   * Permanently delete multiple clients (requires prior archival)
   */
  deleteClients: protectedProcedure
    .input(bulkDeleteClientsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new BulkService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.bulkDeleteClients(input);
    }),

  /**
   * Update status for multiple clients
   */
  updateStatus: protectedProcedure
    .input(bulkUpdateStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new BulkService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.bulkUpdateStatus(input);
    }),

  /**
   * Update tags for multiple clients (add, remove, or replace)
   */
  updateTags: protectedProcedure
    .input(bulkUpdateTagsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new BulkService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.bulkUpdateTags(input);
    }),

  /**
   * Assign new owner to multiple clients
   */
  assignOwner: protectedProcedure
    .input(bulkAssignOwnerSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new BulkService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.bulkAssignOwner(input);
    }),

  /**
   * Export multiple clients to file
   */
  exportClients: protectedProcedure
    .input(bulkExportClientsSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new BulkService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.bulkExportClients(input);
    }),

  /**
   * Get status of a bulk operation
   */
  getOperationStatus: protectedProcedure
    .input(getBulkOperationStatusSchema)
    .query(async ({ ctx, input }) => {
      const service = new BulkService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.getBulkOperationStatus(input);
    }),

  /**
   * List bulk operations history
   */
  listOperations: protectedProcedure
    .input(listBulkOperationsSchema)
    .query(async ({ ctx, input }) => {
      const service = new BulkService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.listBulkOperations(input);
    }),

  /**
   * Cancel a pending or processing bulk operation
   */
  cancelOperation: protectedProcedure
    .input(cancelBulkOperationSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new BulkService(
        ctx.prisma,
        ctx.redis,
        ctx.auditLogger,
        ctx.session.userId,
        ctx.session.organizationId || null
      );
      return service.cancelBulkOperation(input);
    }),
});

export type BulkRouter = typeof bulkRouter;
