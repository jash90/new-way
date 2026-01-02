import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BulkService } from '../../services/crm/bulk.service';
import { TRPCError } from '@trpc/server';

// Mock data
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = '22222222-2222-2222-2222-222222222222';
const CLIENT_ID_1 = '33333333-3333-3333-3333-333333333333';
const CLIENT_ID_2 = '44444444-4444-4444-4444-444444444444';
const CLIENT_ID_3 = '55555555-5555-5555-5555-555555555555';
const NEW_OWNER_ID = '66666666-6666-6666-6666-666666666666';
const OPERATION_ID = '77777777-7777-7777-7777-777777777777';

const mockClient1 = {
  id: CLIENT_ID_1,
  displayName: 'Firma ABC Sp. z o.o.',
  type: 'company',
  status: 'active',
  tags: ['vip', 'priority'],
  ownerId: TEST_USER_ID,
  archivedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockClient2 = {
  id: CLIENT_ID_2,
  displayName: 'Jan Kowalski',
  type: 'individual',
  status: 'active',
  tags: ['regular'],
  ownerId: TEST_USER_ID,
  archivedAt: null,
  createdAt: new Date('2024-01-02'),
  updatedAt: new Date('2024-01-02'),
};

const mockArchivedClient = {
  ...mockClient1,
  id: CLIENT_ID_3,
  displayName: 'Archived Company',
  archivedAt: new Date('2024-06-01'),
};

const mockBulkOperation = {
  id: OPERATION_ID,
  type: 'archive',
  status: 'completed',
  totalItems: 2,
  processedItems: 2,
  successCount: 2,
  failureCount: 0,
  errors: JSON.stringify([]),
  createdAt: new Date('2024-01-01'),
  completedAt: new Date('2024-01-01'),
  createdById: TEST_USER_ID,
  organizationId: ORG_ID,
};

// Create mocks
const mocks = vi.hoisted(() => ({
  clientFindMany: vi.fn(),
  clientFindFirst: vi.fn(),
  clientUpdate: vi.fn(),
  clientUpdateMany: vi.fn(),
  clientDelete: vi.fn(),
  clientDeleteMany: vi.fn(),
  bulkOperationCreate: vi.fn(),
  bulkOperationFindUnique: vi.fn(),
  bulkOperationFindMany: vi.fn(),
  bulkOperationUpdate: vi.fn(),
  bulkOperationCount: vi.fn(),
  userFindUnique: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  redisDel: vi.fn(),
  auditLog: vi.fn(),
  transaction: vi.fn(),
}));

// Mock Prisma
const mockPrisma = {
  client: {
    findMany: mocks.clientFindMany,
    findFirst: mocks.clientFindFirst,
    update: mocks.clientUpdate,
    updateMany: mocks.clientUpdateMany,
    delete: mocks.clientDelete,
    deleteMany: mocks.clientDeleteMany,
  },
  bulkOperation: {
    create: mocks.bulkOperationCreate,
    findUnique: mocks.bulkOperationFindUnique,
    findMany: mocks.bulkOperationFindMany,
    update: mocks.bulkOperationUpdate,
    count: mocks.bulkOperationCount,
  },
  user: {
    findUnique: mocks.userFindUnique,
  },
  $transaction: mocks.transaction,
} as any;

// Mock Redis
const mockRedis = {
  get: mocks.redisGet,
  set: mocks.redisSet,
  del: mocks.redisDel,
} as any;

// Mock Audit Logger
const mockAuditLogger = {
  log: mocks.auditLog,
} as any;

describe('BulkService', () => {
  let service: BulkService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BulkService(
      mockPrisma,
      mockRedis,
      mockAuditLogger,
      TEST_USER_ID,
      ORG_ID
    );

    // Default mock implementations
    mocks.transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mocks.redisSet.mockResolvedValue('OK');
    mocks.redisDel.mockResolvedValue(1);
    mocks.auditLog.mockResolvedValue(undefined);
  });

  // ===========================================================================
  // BULK ARCHIVE CLIENTS
  // ===========================================================================

  describe('bulkArchiveClients', () => {
    it('should archive multiple clients successfully', async () => {
      mocks.clientFindMany.mockResolvedValue([mockClient1, mockClient2]);
      mocks.clientUpdateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkArchiveClients({
        clientIds: [CLIENT_ID_1, CLIENT_ID_2],
        reason: 'Klienci nieaktywni',
      });

      expect(result.archived).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mocks.auditLog).toHaveBeenCalled();
    });

    it('should handle partial failures when some clients not found', async () => {
      mocks.clientFindMany.mockResolvedValue([mockClient1]); // Only one client found
      mocks.clientUpdateMany.mockResolvedValue({ count: 1 });

      const result = await service.bulkArchiveClients({
        clientIds: [CLIENT_ID_1, CLIENT_ID_2],
      });

      expect(result.archived).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ clientId: CLIENT_ID_2 })
      );
    });

    it('should skip already archived clients', async () => {
      mocks.clientFindMany.mockResolvedValue([mockArchivedClient]);
      mocks.clientUpdateMany.mockResolvedValue({ count: 0 });

      const result = await service.bulkArchiveClients({
        clientIds: [CLIENT_ID_3],
      });

      expect(result.archived).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toContain('już zarchiwizowany');
    });

    it('should invalidate cache for archived clients', async () => {
      mocks.clientFindMany.mockResolvedValue([mockClient1, mockClient2]);
      mocks.clientUpdateMany.mockResolvedValue({ count: 2 });

      await service.bulkArchiveClients({
        clientIds: [CLIENT_ID_1, CLIENT_ID_2],
      });

      expect(mocks.redisDel).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // BULK RESTORE CLIENTS
  // ===========================================================================

  describe('bulkRestoreClients', () => {
    it('should restore multiple archived clients successfully', async () => {
      mocks.clientFindMany.mockResolvedValue([
        mockArchivedClient,
        { ...mockClient2, archivedAt: new Date() },
      ]);
      mocks.clientUpdateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkRestoreClients({
        clientIds: [CLIENT_ID_3, CLIENT_ID_2],
      });

      expect(result.restored).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should skip non-archived clients', async () => {
      mocks.clientFindMany.mockResolvedValue([mockClient1]); // Not archived

      const result = await service.bulkRestoreClients({
        clientIds: [CLIENT_ID_1],
      });

      expect(result.restored).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toContain('nie jest zarchiwizowany');
    });
  });

  // ===========================================================================
  // BULK DELETE CLIENTS (PERMANENT)
  // ===========================================================================

  describe('bulkDeleteClients', () => {
    it('should permanently delete clients with confirmation', async () => {
      mocks.clientFindMany.mockResolvedValue([
        mockArchivedClient,
        { ...mockClient2, archivedAt: new Date() },
      ]);
      mocks.clientDeleteMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkDeleteClients({
        clientIds: [CLIENT_ID_3, CLIENT_ID_2],
        confirmDeletion: true,
      });

      expect(result.deleted).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should only delete archived clients for safety', async () => {
      mocks.clientFindMany.mockResolvedValue([mockClient1]); // Not archived

      const result = await service.bulkDeleteClients({
        clientIds: [CLIENT_ID_1],
        confirmDeletion: true,
      });

      expect(result.deleted).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toContain('archiwizowany');
    });
  });

  // ===========================================================================
  // BULK UPDATE STATUS
  // ===========================================================================

  describe('bulkUpdateStatus', () => {
    it('should update status for multiple clients', async () => {
      mocks.clientFindMany.mockResolvedValue([mockClient1, mockClient2]);
      mocks.clientUpdateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkUpdateStatus({
        clientIds: [CLIENT_ID_1, CLIENT_ID_2],
        status: 'inactive',
        reason: 'Okresowa dezaktywacja',
      });

      expect(result.updated).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should skip clients with same status', async () => {
      mocks.clientFindMany.mockResolvedValue([
        { ...mockClient1, status: 'inactive' },
      ]);
      mocks.clientUpdateMany.mockResolvedValue({ count: 0 });

      const result = await service.bulkUpdateStatus({
        clientIds: [CLIENT_ID_1],
        status: 'inactive',
      });

      expect(result.updated).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toContain('już ma status');
    });
  });

  // ===========================================================================
  // BULK UPDATE TAGS
  // ===========================================================================

  describe('bulkUpdateTags', () => {
    it('should add tags to multiple clients', async () => {
      mocks.clientFindMany.mockResolvedValue([mockClient1, mockClient2]);
      mocks.clientUpdate.mockResolvedValue({ ...mockClient1, tags: ['vip', 'priority', 'new-tag'] });

      const result = await service.bulkUpdateTags({
        clientIds: [CLIENT_ID_1, CLIENT_ID_2],
        operation: 'add',
        tags: ['new-tag'],
      });

      expect(result.updated).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should remove tags from multiple clients', async () => {
      mocks.clientFindMany.mockResolvedValue([mockClient1, mockClient2]);
      mocks.clientUpdate.mockResolvedValue({ ...mockClient1, tags: ['priority'] });

      const result = await service.bulkUpdateTags({
        clientIds: [CLIENT_ID_1, CLIENT_ID_2],
        operation: 'remove',
        tags: ['vip'],
      });

      expect(result.updated).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should replace all tags', async () => {
      mocks.clientFindMany.mockResolvedValue([mockClient1, mockClient2]);
      mocks.clientUpdate.mockResolvedValue({ ...mockClient1, tags: ['replaced'] });

      const result = await service.bulkUpdateTags({
        clientIds: [CLIENT_ID_1, CLIENT_ID_2],
        operation: 'replace',
        tags: ['replaced'],
      });

      expect(result.updated).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  // ===========================================================================
  // BULK ASSIGN OWNER
  // ===========================================================================

  describe('bulkAssignOwner', () => {
    it('should assign new owner to multiple clients', async () => {
      mocks.userFindUnique.mockResolvedValue({ id: NEW_OWNER_ID, email: 'new@owner.pl' });
      mocks.clientFindMany.mockResolvedValue([mockClient1, mockClient2]);
      mocks.clientUpdateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkAssignOwner({
        clientIds: [CLIENT_ID_1, CLIENT_ID_2],
        newOwnerId: NEW_OWNER_ID,
        transferNotes: true,
        transferDocuments: true,
      });

      expect(result.assigned).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should fail if new owner does not exist', async () => {
      mocks.userFindUnique.mockResolvedValue(null);

      await expect(
        service.bulkAssignOwner({
          clientIds: [CLIENT_ID_1],
          newOwnerId: NEW_OWNER_ID,
          transferNotes: true,
          transferDocuments: true,
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should skip clients already owned by new owner', async () => {
      mocks.userFindUnique.mockResolvedValue({ id: TEST_USER_ID, email: 'owner@test.pl' });
      mocks.clientFindMany.mockResolvedValue([mockClient1]); // Already owned by TEST_USER_ID

      const result = await service.bulkAssignOwner({
        clientIds: [CLIENT_ID_1],
        newOwnerId: TEST_USER_ID,
        transferNotes: true,
        transferDocuments: true,
      });

      expect(result.assigned).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toContain('już jest właścicielem');
    });
  });

  // ===========================================================================
  // BULK EXPORT
  // ===========================================================================

  describe('bulkExportClients', () => {
    it('should create export job for clients', async () => {
      mocks.clientFindMany.mockResolvedValue([mockClient1, mockClient2]);
      mocks.bulkOperationCreate.mockResolvedValue({
        id: OPERATION_ID,
        type: 'export',
        status: 'pending',
        totalItems: 2,
        processedItems: 0,
        successCount: 0,
        failureCount: 0,
        errors: '[]',
        createdAt: new Date(),
        completedAt: null,
      });

      const result = await service.bulkExportClients({
        clientIds: [CLIENT_ID_1, CLIENT_ID_2],
        format: 'csv',
        includeContacts: true,
        includeTimeline: false,
        includeDocuments: false,
      });

      expect(result.exportId).toBe(OPERATION_ID);
      expect(result.status).toBe('pending');
      expect(result.clientCount).toBe(2);
      expect(result.format).toBe('csv');
    });

    it('should handle different export formats', async () => {
      mocks.clientFindMany.mockResolvedValue([mockClient1]);
      mocks.bulkOperationCreate.mockResolvedValue({
        id: OPERATION_ID,
        type: 'export',
        status: 'pending',
        totalItems: 1,
        processedItems: 0,
        successCount: 0,
        failureCount: 0,
        errors: '[]',
        createdAt: new Date(),
      });

      const formats = ['csv', 'xlsx', 'json', 'pdf'] as const;
      for (const format of formats) {
        const result = await service.bulkExportClients({
          clientIds: [CLIENT_ID_1],
          format,
        });

        expect(result.format).toBe(format);
      }
    });
  });

  // ===========================================================================
  // GET BULK OPERATION STATUS
  // ===========================================================================

  describe('getBulkOperationStatus', () => {
    it('should return operation progress', async () => {
      mocks.bulkOperationFindUnique.mockResolvedValue(mockBulkOperation);

      const result = await service.getBulkOperationStatus({
        operationId: OPERATION_ID,
      });

      expect(result.operationId).toBe(OPERATION_ID);
      expect(result.type).toBe('archive');
      expect(result.status).toBe('completed');
      expect(result.totalItems).toBe(2);
      expect(result.processedItems).toBe(2);
    });

    it('should throw error for non-existent operation', async () => {
      mocks.bulkOperationFindUnique.mockResolvedValue(null);

      await expect(
        service.getBulkOperationStatus({ operationId: OPERATION_ID })
      ).rejects.toThrow(TRPCError);
    });
  });

  // ===========================================================================
  // LIST BULK OPERATIONS
  // ===========================================================================

  describe('listBulkOperations', () => {
    it('should list all operations with pagination', async () => {
      mocks.bulkOperationFindMany.mockResolvedValue([mockBulkOperation]);
      mocks.bulkOperationCount.mockResolvedValue(1);

      const result = await service.listBulkOperations({
        limit: 20,
        offset: 0,
      });

      expect(result.operations).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should filter operations by type', async () => {
      mocks.bulkOperationFindMany.mockResolvedValue([mockBulkOperation]);
      mocks.bulkOperationCount.mockResolvedValue(1);

      await service.listBulkOperations({
        type: 'archive',
        limit: 20,
        offset: 0,
      });

      expect(mocks.bulkOperationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'archive' }),
        })
      );
    });

    it('should filter operations by status', async () => {
      mocks.bulkOperationFindMany.mockResolvedValue([mockBulkOperation]);
      mocks.bulkOperationCount.mockResolvedValue(1);

      await service.listBulkOperations({
        status: 'completed',
        limit: 20,
        offset: 0,
      });

      expect(mocks.bulkOperationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'completed' }),
        })
      );
    });
  });

  // ===========================================================================
  // CANCEL BULK OPERATION
  // ===========================================================================

  describe('cancelBulkOperation', () => {
    it('should cancel a pending operation', async () => {
      mocks.bulkOperationFindUnique.mockResolvedValue({
        ...mockBulkOperation,
        status: 'pending',
      });
      mocks.bulkOperationUpdate.mockResolvedValue({
        ...mockBulkOperation,
        status: 'cancelled',
      });

      const result = await service.cancelBulkOperation({
        operationId: OPERATION_ID,
      });

      expect(result.cancelled).toBe(true);
      expect(result.message).toContain('anulowana');
    });

    it('should cancel a processing operation', async () => {
      mocks.bulkOperationFindUnique.mockResolvedValue({
        ...mockBulkOperation,
        status: 'processing',
      });
      mocks.bulkOperationUpdate.mockResolvedValue({
        ...mockBulkOperation,
        status: 'cancelled',
      });

      const result = await service.cancelBulkOperation({
        operationId: OPERATION_ID,
      });

      expect(result.cancelled).toBe(true);
    });

    it('should not cancel completed operation', async () => {
      mocks.bulkOperationFindUnique.mockResolvedValue(mockBulkOperation); // status: 'completed'

      const result = await service.cancelBulkOperation({
        operationId: OPERATION_ID,
      });

      expect(result.cancelled).toBe(false);
      expect(result.message).toContain('zakończona');
    });

    it('should not cancel already cancelled operation', async () => {
      mocks.bulkOperationFindUnique.mockResolvedValue({
        ...mockBulkOperation,
        status: 'cancelled',
      });

      const result = await service.cancelBulkOperation({
        operationId: OPERATION_ID,
      });

      expect(result.cancelled).toBe(false);
      expect(result.message).toContain('już anulowana');
    });
  });

  // ===========================================================================
  // AUDIT LOGGING
  // ===========================================================================

  describe('audit logging', () => {
    it('should log bulk archive operation', async () => {
      mocks.clientFindMany.mockResolvedValue([mockClient1, mockClient2]);
      mocks.clientUpdateMany.mockResolvedValue({ count: 2 });

      await service.bulkArchiveClients({
        clientIds: [CLIENT_ID_1, CLIENT_ID_2],
      });

      expect(mocks.auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.stringContaining('BULK_ARCHIVE'),
        })
      );
    });

    it('should log bulk delete operation', async () => {
      mocks.clientFindMany.mockResolvedValue([mockArchivedClient]);
      mocks.clientDeleteMany.mockResolvedValue({ count: 1 });

      await service.bulkDeleteClients({
        clientIds: [CLIENT_ID_3],
        confirmDeletion: true,
      });

      expect(mocks.auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.stringContaining('BULK_DELETE'),
        })
      );
    });

    it('should log bulk owner assignment', async () => {
      mocks.userFindUnique.mockResolvedValue({ id: NEW_OWNER_ID });
      mocks.clientFindMany.mockResolvedValue([mockClient1]);
      mocks.clientUpdateMany.mockResolvedValue({ count: 1 });

      await service.bulkAssignOwner({
        clientIds: [CLIENT_ID_1],
        newOwnerId: NEW_OWNER_ID,
        transferNotes: true,
        transferDocuments: true,
      });

      expect(mocks.auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: expect.stringContaining('BULK_ASSIGN_OWNER'),
        })
      );
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mocks.clientFindMany.mockRejectedValue(new Error('Database connection error'));

      await expect(
        service.bulkArchiveClients({ clientIds: [CLIENT_ID_1] })
      ).rejects.toThrow();
    });

    it('should handle empty client list for operations', async () => {
      mocks.clientFindMany.mockResolvedValue([]);

      const result = await service.bulkArchiveClients({
        clientIds: [CLIENT_ID_1, CLIENT_ID_2],
      });

      expect(result.archived).toBe(0);
      expect(result.failed).toBe(2);
    });
  });
});
