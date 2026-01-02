import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import {
  type BulkArchiveClientsInput,
  type BulkArchiveResult,
  type BulkRestoreClientsInput,
  type BulkRestoreResult,
  type BulkDeleteClientsInput,
  type BulkDeleteResult,
  type BulkUpdateStatusInput,
  type BulkUpdateStatusResult,
  type BulkUpdateTagsInput,
  type BulkUpdateTagsResult,
  type BulkAssignOwnerInput,
  type BulkAssignOwnerResult,
  type BulkExportClientsInput,
  type BulkExportResult,
  type GetBulkOperationStatusInput,
  type BulkOperationProgress,
  type ListBulkOperationsInput,
  type BulkOperationsListResult,
  type CancelBulkOperationInput,
  type CancelBulkOperationResult,
} from '@ksiegowacrm/shared';
import { AuditLogger } from '../../utils/audit-logger';

/**
 * Bulk Operations Service (CRM)
 *
 * TODO: This service requires the following Prisma schema addition:
 * - BulkOperation model for tracking async bulk operations
 *
 * The following methods require the BulkOperation model:
 * - bulkExportClients
 * - getBulkOperationStatus
 * - listBulkOperations
 * - cancelBulkOperation
 */

class NotImplementedError extends Error {
  constructor(feature: string, missingModel: string) {
    super(`${feature} requires the ${missingModel} Prisma model which is not yet implemented`);
    this.name = 'NotImplementedError';
  }
}

// Cache key prefix
const CLIENT_CACHE_PREFIX = 'client:';

export class BulkService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private auditLogger: AuditLogger,
    private userId: string,
    private organizationId: string | null
  ) {}

  // ===========================================================================
  // BULK ARCHIVE CLIENTS
  // ===========================================================================

  async bulkArchiveClients(input: BulkArchiveClientsInput): Promise<BulkArchiveResult> {
    const { clientIds, reason } = input;
    const errors: Array<{ clientId: string; error: string }> = [];

    // Fetch existing clients
    const existingClients = await this.prisma.client.findMany({
      where: {
        id: { in: clientIds },
        ownerId: this.userId,
      },
      select: { id: true, displayName: true, archivedAt: true },
    });

    const foundIds = new Set(existingClients.map((c) => c.id));
    const clientsToArchive: string[] = [];

    // Check each client
    for (const clientId of clientIds) {
      if (!foundIds.has(clientId)) {
        errors.push({ clientId, error: 'Klient nie znaleziony' });
        continue;
      }

      const client = existingClients.find((c) => c.id === clientId);
      if (client?.archivedAt) {
        errors.push({ clientId, error: 'Klient jest już zarchiwizowany' });
        continue;
      }

      clientsToArchive.push(clientId);
    }

    // Archive clients
    let archivedCount = 0;
    if (clientsToArchive.length > 0) {
      const result = await this.prisma.client.updateMany({
        where: { id: { in: clientsToArchive } },
        data: { archivedAt: new Date() },
      });
      archivedCount = result.count;

      // Invalidate cache
      await this.invalidateClientCache(clientsToArchive);

      // Audit log
      await this.auditLogger.log({
        action: 'BULK_ARCHIVE_CLIENTS',
        userId: this.userId,
        organizationId: this.organizationId,
        details: {
          clientIds: clientsToArchive,
          reason,
          archivedCount,
        },
      });
    }

    return {
      archived: archivedCount,
      failed: errors.length,
      errors,
    };
  }

  // ===========================================================================
  // BULK RESTORE CLIENTS
  // ===========================================================================

  async bulkRestoreClients(input: BulkRestoreClientsInput): Promise<BulkRestoreResult> {
    const { clientIds } = input;
    const errors: Array<{ clientId: string; error: string }> = [];

    // Fetch existing clients
    const existingClients = await this.prisma.client.findMany({
      where: {
        id: { in: clientIds },
        ownerId: this.userId,
      },
      select: { id: true, displayName: true, archivedAt: true },
    });

    const foundIds = new Set(existingClients.map((c) => c.id));
    const clientsToRestore: string[] = [];

    // Check each client
    for (const clientId of clientIds) {
      if (!foundIds.has(clientId)) {
        errors.push({ clientId, error: 'Klient nie znaleziony' });
        continue;
      }

      const client = existingClients.find((c) => c.id === clientId);
      if (!client?.archivedAt) {
        errors.push({ clientId, error: 'Klient nie jest zarchiwizowany' });
        continue;
      }

      clientsToRestore.push(clientId);
    }

    // Restore clients
    let restoredCount = 0;
    if (clientsToRestore.length > 0) {
      const result = await this.prisma.client.updateMany({
        where: { id: { in: clientsToRestore } },
        data: { archivedAt: null },
      });
      restoredCount = result.count;

      // Invalidate cache
      await this.invalidateClientCache(clientsToRestore);

      // Audit log
      await this.auditLogger.log({
        action: 'BULK_RESTORE_CLIENTS',
        userId: this.userId,
        organizationId: this.organizationId,
        details: {
          clientIds: clientsToRestore,
          restoredCount,
        },
      });
    }

    return {
      restored: restoredCount,
      failed: errors.length,
      errors,
    };
  }

  // ===========================================================================
  // BULK DELETE CLIENTS (PERMANENT)
  // ===========================================================================

  async bulkDeleteClients(input: BulkDeleteClientsInput): Promise<BulkDeleteResult> {
    const { clientIds } = input;
    const errors: Array<{ clientId: string; error: string }> = [];

    // Fetch existing clients - only archived ones can be permanently deleted
    const existingClients = await this.prisma.client.findMany({
      where: {
        id: { in: clientIds },
        ownerId: this.userId,
      },
      select: { id: true, displayName: true, archivedAt: true },
    });

    const foundIds = new Set(existingClients.map((c) => c.id));
    const clientsToDelete: string[] = [];

    // Check each client
    for (const clientId of clientIds) {
      if (!foundIds.has(clientId)) {
        errors.push({ clientId, error: 'Klient nie znaleziony' });
        continue;
      }

      const client = existingClients.find((c) => c.id === clientId);
      if (!client?.archivedAt) {
        errors.push({
          clientId,
          error: 'Klient musi być najpierw zarchiwizowany przed usunięciem',
        });
        continue;
      }

      clientsToDelete.push(clientId);
    }

    // Delete clients
    let deletedCount = 0;
    if (clientsToDelete.length > 0) {
      const result = await this.prisma.client.deleteMany({
        where: { id: { in: clientsToDelete } },
      });
      deletedCount = result.count;

      // Invalidate cache
      await this.invalidateClientCache(clientsToDelete);

      // Audit log
      await this.auditLogger.log({
        action: 'BULK_DELETE_CLIENTS',
        userId: this.userId,
        organizationId: this.organizationId,
        details: {
          clientIds: clientsToDelete,
          deletedCount,
          permanent: true,
        },
      });
    }

    return {
      deleted: deletedCount,
      failed: errors.length,
      errors,
    };
  }

  // ===========================================================================
  // BULK UPDATE STATUS
  // ===========================================================================

  async bulkUpdateStatus(input: BulkUpdateStatusInput): Promise<BulkUpdateStatusResult> {
    const { clientIds, status, reason } = input;
    const errors: Array<{ clientId: string; error: string }> = [];

    // Fetch existing clients
    const existingClients = await this.prisma.client.findMany({
      where: {
        id: { in: clientIds },
        ownerId: this.userId,
        archivedAt: null,
      },
      select: { id: true, displayName: true, status: true },
    });

    const foundIds = new Set(existingClients.map((c) => c.id));
    const clientsToUpdate: string[] = [];

    // Check each client
    for (const clientId of clientIds) {
      if (!foundIds.has(clientId)) {
        errors.push({ clientId, error: 'Klient nie znaleziony lub zarchiwizowany' });
        continue;
      }

      const client = existingClients.find((c) => c.id === clientId);
      if (client?.status === status) {
        errors.push({ clientId, error: `Klient już ma status: ${status}` });
        continue;
      }

      clientsToUpdate.push(clientId);
    }

    // Update status
    let updatedCount = 0;
    if (clientsToUpdate.length > 0) {
      const result = await this.prisma.client.updateMany({
        where: { id: { in: clientsToUpdate } },
        data: { status, updatedAt: new Date() },
      });
      updatedCount = result.count;

      // Invalidate cache
      await this.invalidateClientCache(clientsToUpdate);

      // Audit log
      await this.auditLogger.log({
        action: 'BULK_UPDATE_STATUS',
        userId: this.userId,
        organizationId: this.organizationId,
        details: {
          clientIds: clientsToUpdate,
          newStatus: status,
          reason,
          updatedCount,
        },
      });
    }

    return {
      updated: updatedCount,
      failed: errors.length,
      errors,
    };
  }

  // ===========================================================================
  // BULK UPDATE TAGS
  // ===========================================================================

  async bulkUpdateTags(input: BulkUpdateTagsInput): Promise<BulkUpdateTagsResult> {
    const { clientIds, operation, tags } = input;
    const errors: Array<{ clientId: string; error: string }> = [];

    // Fetch existing clients
    const existingClients = await this.prisma.client.findMany({
      where: {
        id: { in: clientIds },
        ownerId: this.userId,
        archivedAt: null,
      },
      select: { id: true, displayName: true, tags: true },
    });

    const foundIds = new Set(existingClients.map((c) => c.id));
    let updatedCount = 0;

    // Check and update each client
    for (const clientId of clientIds) {
      if (!foundIds.has(clientId)) {
        errors.push({ clientId, error: 'Klient nie znaleziony lub zarchiwizowany' });
        continue;
      }

      const client = existingClients.find((c) => c.id === clientId);
      if (!client) continue;

      let newTags: string[];
      const currentTags = (client.tags as string[]) || [];

      switch (operation) {
        case 'add':
          newTags = [...new Set([...currentTags, ...tags])];
          break;
        case 'remove':
          newTags = currentTags.filter((t) => !tags.includes(t));
          break;
        case 'replace':
          newTags = [...tags];
          break;
        default:
          newTags = currentTags;
      }

      await this.prisma.client.update({
        where: { id: clientId },
        data: { tags: newTags, updatedAt: new Date() },
      });
      updatedCount++;
    }

    // Invalidate cache
    if (updatedCount > 0) {
      await this.invalidateClientCache(clientIds.filter((id) => foundIds.has(id)));

      // Audit log
      await this.auditLogger.log({
        action: 'BULK_UPDATE_TAGS',
        userId: this.userId,
        organizationId: this.organizationId,
        details: {
          clientIds: clientIds.filter((id) => foundIds.has(id)),
          operation,
          tags,
          updatedCount,
        },
      });
    }

    return {
      updated: updatedCount,
      failed: errors.length,
      errors,
    };
  }

  // ===========================================================================
  // BULK ASSIGN OWNER
  // ===========================================================================

  async bulkAssignOwner(input: BulkAssignOwnerInput): Promise<BulkAssignOwnerResult> {
    const { clientIds, newOwnerId, transferNotes, transferDocuments } = input;
    const errors: Array<{ clientId: string; error: string }> = [];

    // Verify new owner exists
    const newOwner = await this.prisma.user.findUnique({
      where: { id: newOwnerId },
      select: { id: true, email: true },
    });

    if (!newOwner) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Nowy właściciel nie znaleziony',
      });
    }

    // Fetch existing clients
    const existingClients = await this.prisma.client.findMany({
      where: {
        id: { in: clientIds },
        ownerId: this.userId,
        archivedAt: null,
      },
      select: { id: true, displayName: true, ownerId: true },
    });

    const foundIds = new Set(existingClients.map((c) => c.id));
    const clientsToAssign: string[] = [];

    // Check each client
    for (const clientId of clientIds) {
      if (!foundIds.has(clientId)) {
        errors.push({ clientId, error: 'Klient nie znaleziony lub zarchiwizowany' });
        continue;
      }

      const client = existingClients.find((c) => c.id === clientId);
      if (client?.ownerId === newOwnerId) {
        errors.push({ clientId, error: 'Użytkownik już jest właścicielem tego klienta' });
        continue;
      }

      clientsToAssign.push(clientId);
    }

    // Assign new owner
    let assignedCount = 0;
    if (clientsToAssign.length > 0) {
      const result = await this.prisma.client.updateMany({
        where: { id: { in: clientsToAssign } },
        data: { ownerId: newOwnerId, updatedAt: new Date() },
      });
      assignedCount = result.count;

      // Invalidate cache
      await this.invalidateClientCache(clientsToAssign);

      // Audit log
      await this.auditLogger.log({
        action: 'BULK_ASSIGN_OWNER',
        userId: this.userId,
        organizationId: this.organizationId,
        details: {
          clientIds: clientsToAssign,
          newOwnerId,
          newOwnerEmail: newOwner.email,
          transferNotes,
          transferDocuments,
          assignedCount,
        },
      });
    }

    return {
      assigned: assignedCount,
      failed: errors.length,
      errors,
    };
  }

  // ===========================================================================
  // BULK EXPORT
  // ===========================================================================

  async bulkExportClients(_input: BulkExportClientsInput): Promise<BulkExportResult> {
    // TODO: Requires BulkOperation Prisma model for async export tracking
    throw new NotImplementedError('bulkExportClients', 'BulkOperation');
  }

  // ===========================================================================
  // GET BULK OPERATION STATUS
  // ===========================================================================

  async getBulkOperationStatus(_input: GetBulkOperationStatusInput): Promise<BulkOperationProgress> {
    // TODO: Requires BulkOperation Prisma model
    throw new NotImplementedError('getBulkOperationStatus', 'BulkOperation');
  }

  // ===========================================================================
  // LIST BULK OPERATIONS
  // ===========================================================================

  async listBulkOperations(_input: ListBulkOperationsInput): Promise<BulkOperationsListResult> {
    // TODO: Requires BulkOperation Prisma model
    throw new NotImplementedError('listBulkOperations', 'BulkOperation');
  }

  // ===========================================================================
  // CANCEL BULK OPERATION
  // ===========================================================================

  async cancelBulkOperation(_input: CancelBulkOperationInput): Promise<CancelBulkOperationResult> {
    // TODO: Requires BulkOperation Prisma model
    throw new NotImplementedError('cancelBulkOperation', 'BulkOperation');
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private async invalidateClientCache(clientIds: string[]): Promise<void> {
    const keys = clientIds.map((id) => `${CLIENT_CACHE_PREFIX}${id}`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
