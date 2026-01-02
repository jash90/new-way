import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PortalService } from '../../services/crm/portal.service';

// Test constants
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = '22222222-2222-2222-2222-222222222222';
const CLIENT_ID_1 = '33333333-3333-3333-3333-333333333333';
const PORTAL_ACCESS_ID = '44444444-4444-4444-4444-444444444444';

// Create mocks
const mocks = vi.hoisted(() => ({
  portalAccessCreate: vi.fn(),
  portalAccessFindUnique: vi.fn(),
  portalAccessFindMany: vi.fn(),
  portalAccessCount: vi.fn(),
  portalAccessUpdate: vi.fn(),
  portalAccessUpdateMany: vi.fn(),
  portalActivityCreate: vi.fn(),
  portalActivityFindMany: vi.fn(),
  portalActivityCount: vi.fn(),
  clientFindUnique: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  redisDel: vi.fn(),
  auditLog: vi.fn(),
  sendEmail: vi.fn(),
}));

// Mock Prisma
const mockPrisma = {
  portalAccess: {
    create: mocks.portalAccessCreate,
    findUnique: mocks.portalAccessFindUnique,
    findMany: mocks.portalAccessFindMany,
    count: mocks.portalAccessCount,
    update: mocks.portalAccessUpdate,
    updateMany: mocks.portalAccessUpdateMany,
  },
  portalActivity: {
    create: mocks.portalActivityCreate,
    findMany: mocks.portalActivityFindMany,
    count: mocks.portalActivityCount,
  },
  client: {
    findUnique: mocks.clientFindUnique,
  },
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

// Mock Email Service
const mockEmailService = {
  sendEmail: mocks.sendEmail,
} as any;

// Sample portal access data
const samplePortalAccess = {
  id: PORTAL_ACCESS_ID,
  clientId: CLIENT_ID_1,
  email: 'portal@example.com',
  status: 'active',
  permissions: ['view_profile', 'view_documents'],
  invitedAt: new Date('2024-01-01'),
  activatedAt: new Date('2024-01-02'),
  lastAccessAt: new Date('2024-01-15'),
  expiresAt: null,
  createdBy: TEST_USER_ID,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15'),
};

describe('PortalService', () => {
  let service: PortalService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PortalService(
      mockPrisma,
      mockRedis,
      mockAuditLogger,
      mockEmailService,
      TEST_USER_ID,
      ORG_ID
    );

    // Default mock implementations
    mocks.redisGet.mockResolvedValue(null);
    mocks.redisSet.mockResolvedValue('OK');
    mocks.redisDel.mockResolvedValue(1);
    mocks.auditLog.mockResolvedValue(undefined);
    mocks.sendEmail.mockResolvedValue({ success: true });
    mocks.clientFindUnique.mockResolvedValue({
      id: CLIENT_ID_1,
      displayName: 'Test Client',
      organizationId: ORG_ID,
    });
  });

  // ===========================================================================
  // CREATE PORTAL ACCESS
  // ===========================================================================

  describe('createPortalAccess', () => {
    beforeEach(() => {
      mocks.portalAccessCreate.mockResolvedValue(samplePortalAccess);
      mocks.portalAccessFindUnique.mockResolvedValue(null);
    });

    it('should create new portal access', async () => {
      const result = await service.createPortalAccess({
        clientId: CLIENT_ID_1,
        email: 'portal@example.com',
        permissions: ['view_profile', 'view_documents'],
        sendInvitation: true,
      });

      expect(result.id).toBe(PORTAL_ACCESS_ID);
      expect(result.status).toBe('active');
      expect(mocks.portalAccessCreate).toHaveBeenCalled();
    });

    it('should send invitation email when requested', async () => {
      await service.createPortalAccess({
        clientId: CLIENT_ID_1,
        email: 'portal@example.com',
        permissions: ['view_profile'],
        sendInvitation: true,
      });

      expect(mocks.sendEmail).toHaveBeenCalled();
    });

    it('should not send invitation when not requested', async () => {
      await service.createPortalAccess({
        clientId: CLIENT_ID_1,
        email: 'portal@example.com',
        permissions: ['view_profile'],
        sendInvitation: false,
      });

      expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it('should log audit event on creation', async () => {
      await service.createPortalAccess({
        clientId: CLIENT_ID_1,
        email: 'portal@example.com',
        permissions: ['view_profile'],
        sendInvitation: false,
      });

      expect(mocks.auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'portal_access_created',
        })
      );
    });

    it('should reject if client not found', async () => {
      mocks.clientFindUnique.mockResolvedValue(null);

      await expect(
        service.createPortalAccess({
          clientId: CLIENT_ID_1,
          email: 'portal@example.com',
          permissions: ['view_profile'],
          sendInvitation: false,
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // GET PORTAL ACCESS
  // ===========================================================================

  describe('getPortalAccess', () => {
    it('should return portal access by ID', async () => {
      mocks.portalAccessFindUnique.mockResolvedValue(samplePortalAccess);

      const result = await service.getPortalAccess({ id: PORTAL_ACCESS_ID });

      expect(result).toEqual(samplePortalAccess);
    });

    it('should return null if not found', async () => {
      mocks.portalAccessFindUnique.mockResolvedValue(null);

      const result = await service.getPortalAccess({ id: PORTAL_ACCESS_ID });

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // LIST PORTAL ACCESS
  // ===========================================================================

  describe('listPortalAccess', () => {
    beforeEach(() => {
      mocks.portalAccessFindMany.mockResolvedValue([samplePortalAccess]);
      mocks.portalAccessCount.mockResolvedValue(1);
    });

    it('should return list with pagination', async () => {
      const result = await service.listPortalAccess({
        limit: 20,
        offset: 0,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by client ID', async () => {
      await service.listPortalAccess({
        clientId: CLIENT_ID_1,
        limit: 20,
        offset: 0,
      });

      expect(mocks.portalAccessFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId: CLIENT_ID_1,
          }),
        })
      );
    });

    it('should filter by status', async () => {
      await service.listPortalAccess({
        status: 'active',
        limit: 20,
        offset: 0,
      });

      expect(mocks.portalAccessFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'active',
          }),
        })
      );
    });
  });

  // ===========================================================================
  // UPDATE PORTAL ACCESS
  // ===========================================================================

  describe('updatePortalAccess', () => {
    beforeEach(() => {
      mocks.portalAccessFindUnique.mockResolvedValue(samplePortalAccess);
      mocks.portalAccessUpdate.mockResolvedValue({
        ...samplePortalAccess,
        permissions: ['view_profile', 'view_documents', 'view_invoices'],
      });
    });

    it('should update permissions', async () => {
      const result = await service.updatePortalAccess({
        id: PORTAL_ACCESS_ID,
        permissions: ['view_profile', 'view_documents', 'view_invoices'],
      });

      expect(result.permissions).toContain('view_invoices');
    });

    it('should update status', async () => {
      mocks.portalAccessUpdate.mockResolvedValue({
        ...samplePortalAccess,
        status: 'suspended',
      });

      const result = await service.updatePortalAccess({
        id: PORTAL_ACCESS_ID,
        status: 'suspended',
      });

      expect(result.status).toBe('suspended');
    });

    it('should log audit event', async () => {
      await service.updatePortalAccess({
        id: PORTAL_ACCESS_ID,
        permissions: ['view_profile'],
      });

      expect(mocks.auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'portal_access_updated',
        })
      );
    });
  });

  // ===========================================================================
  // REVOKE PORTAL ACCESS
  // ===========================================================================

  describe('revokePortalAccess', () => {
    beforeEach(() => {
      mocks.portalAccessFindUnique.mockResolvedValue(samplePortalAccess);
      mocks.portalAccessUpdate.mockResolvedValue({
        ...samplePortalAccess,
        status: 'revoked',
      });
    });

    it('should revoke access', async () => {
      const result = await service.revokePortalAccess({
        id: PORTAL_ACCESS_ID,
        reason: 'Klient zrezygnował',
        notifyUser: true,
      });

      expect(result.revoked).toBe(true);
    });

    it('should send notification when requested', async () => {
      await service.revokePortalAccess({
        id: PORTAL_ACCESS_ID,
        notifyUser: true,
      });

      expect(mocks.sendEmail).toHaveBeenCalled();
    });

    it('should not notify when not requested', async () => {
      await service.revokePortalAccess({
        id: PORTAL_ACCESS_ID,
        notifyUser: false,
      });

      expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it('should log audit event', async () => {
      await service.revokePortalAccess({
        id: PORTAL_ACCESS_ID,
        reason: 'Test reason',
        notifyUser: false,
      });

      expect(mocks.auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'portal_access_revoked',
        })
      );
    });
  });

  // ===========================================================================
  // RESEND INVITATION
  // ===========================================================================

  describe('resendInvitation', () => {
    beforeEach(() => {
      mocks.portalAccessFindUnique.mockResolvedValue({
        ...samplePortalAccess,
        status: 'pending',
        activatedAt: null,
        client: {
          id: CLIENT_ID_1,
          displayName: 'Test Client',
        },
      });
    });

    it('should resend invitation email', async () => {
      const result = await service.resendInvitation({
        id: PORTAL_ACCESS_ID,
      });

      expect(result.sent).toBe(true);
      expect(mocks.sendEmail).toHaveBeenCalled();
    });

    it('should reject if already activated', async () => {
      mocks.portalAccessFindUnique.mockResolvedValue(samplePortalAccess);

      await expect(
        service.resendInvitation({ id: PORTAL_ACCESS_ID })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // BULK REVOKE
  // ===========================================================================

  describe('bulkRevokePortalAccess', () => {
    beforeEach(() => {
      mocks.portalAccessUpdateMany.mockResolvedValue({ count: 2 });
      mocks.portalAccessFindMany.mockResolvedValue([
        samplePortalAccess,
        { ...samplePortalAccess, id: '55555555-5555-5555-5555-555555555555' },
      ]);
    });

    it('should revoke multiple accesses', async () => {
      const result = await service.bulkRevokePortalAccess({
        ids: [PORTAL_ACCESS_ID, '55555555-5555-5555-5555-555555555555'],
        notifyUsers: false,
      });

      expect(result.revoked).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should notify users when requested', async () => {
      await service.bulkRevokePortalAccess({
        ids: [PORTAL_ACCESS_ID],
        notifyUsers: true,
      });

      expect(mocks.sendEmail).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // BULK UPDATE PERMISSIONS
  // ===========================================================================

  describe('bulkUpdatePermissions', () => {
    beforeEach(() => {
      mocks.portalAccessFindMany.mockResolvedValue([samplePortalAccess]);
      mocks.portalAccessUpdate.mockResolvedValue(samplePortalAccess);
    });

    it('should add permissions', async () => {
      const result = await service.bulkUpdatePermissions({
        ids: [PORTAL_ACCESS_ID],
        permissions: ['view_invoices'],
        operation: 'add',
      });

      expect(result.updated).toBe(1);
    });

    it('should remove permissions', async () => {
      const result = await service.bulkUpdatePermissions({
        ids: [PORTAL_ACCESS_ID],
        permissions: ['view_documents'],
        operation: 'remove',
      });

      expect(result.updated).toBe(1);
    });

    it('should replace permissions', async () => {
      const result = await service.bulkUpdatePermissions({
        ids: [PORTAL_ACCESS_ID],
        permissions: ['view_profile'],
        operation: 'replace',
      });

      expect(result.updated).toBe(1);
    });
  });

  // ===========================================================================
  // GET PORTAL STATISTICS
  // ===========================================================================

  describe('getPortalStatistics', () => {
    beforeEach(() => {
      mocks.portalAccessCount.mockResolvedValue(100);
      mocks.portalAccessFindMany.mockResolvedValue([]);
    });

    it('should return statistics', async () => {
      mocks.portalAccessCount
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(70) // active
        .mockResolvedValueOnce(15) // pending
        .mockResolvedValueOnce(10) // suspended
        .mockResolvedValueOnce(5) // revoked
        .mockResolvedValueOnce(25) // recent activity
        .mockResolvedValueOnce(3); // expiring

      const result = await service.getPortalStatistics({});

      expect(result.totalAccess).toBe(100);
      expect(result.byStatus.active).toBe(70);
    });

    it('should filter by client ID', async () => {
      await service.getPortalStatistics({ clientId: CLIENT_ID_1 });

      expect(mocks.portalAccessCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId: CLIENT_ID_1,
          }),
        })
      );
    });
  });

  // ===========================================================================
  // GET PORTAL ACTIVITY
  // ===========================================================================

  describe('getPortalActivity', () => {
    const sampleActivity = {
      id: '66666666-6666-6666-6666-666666666666',
      portalAccessId: PORTAL_ACCESS_ID,
      action: 'login',
      details: {},
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      timestamp: new Date('2024-01-15'),
    };

    beforeEach(() => {
      mocks.portalActivityFindMany.mockResolvedValue([sampleActivity]);
      mocks.portalActivityCount.mockResolvedValue(1);
    });

    it('should return activity list', async () => {
      const result = await service.getPortalActivity({
        limit: 50,
        offset: 0,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by portal access ID', async () => {
      await service.getPortalActivity({
        portalAccessId: PORTAL_ACCESS_ID,
        limit: 50,
        offset: 0,
      });

      expect(mocks.portalActivityFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            portalAccessId: PORTAL_ACCESS_ID,
          }),
        })
      );
    });
  });

  // ===========================================================================
  // VALIDATE PORTAL TOKEN
  // ===========================================================================

  describe('validatePortalToken', () => {
    it('should validate valid token', async () => {
      mocks.redisGet.mockResolvedValue(JSON.stringify({
        portalAccessId: PORTAL_ACCESS_ID,
        email: 'portal@example.com',
      }));
      mocks.portalAccessFindUnique.mockResolvedValue({
        ...samplePortalAccess,
        status: 'pending',
      });

      const result = await service.validatePortalToken({ token: 'valid-token' });

      expect(result.valid).toBe(true);
      expect(result.portalAccess).toBeTruthy();
    });

    it('should reject invalid token', async () => {
      mocks.redisGet.mockResolvedValue(null);

      const result = await service.validatePortalToken({ token: 'invalid-token' });

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ===========================================================================
  // ACTIVATE PORTAL ACCESS
  // ===========================================================================

  describe('activatePortalAccess', () => {
    beforeEach(() => {
      mocks.redisGet.mockResolvedValue(JSON.stringify({
        portalAccessId: PORTAL_ACCESS_ID,
        email: 'portal@example.com',
      }));
      mocks.portalAccessFindUnique.mockResolvedValue({
        ...samplePortalAccess,
        status: 'pending',
        activatedAt: null,
      });
      mocks.portalAccessUpdate.mockResolvedValue({
        ...samplePortalAccess,
        status: 'active',
        activatedAt: new Date(),
      });
    });

    it('should activate with valid token', async () => {
      const result = await service.activatePortalAccess({
        token: 'valid-token',
        password: 'SecurePass123!',
      });

      expect(result.activated).toBe(true);
      expect(result.portalAccessId).toBe(PORTAL_ACCESS_ID);
    });

    it('should reject with invalid token', async () => {
      mocks.redisGet.mockResolvedValue(null);

      await expect(
        service.activatePortalAccess({
          token: 'invalid-token',
          password: 'SecurePass123!',
        })
      ).rejects.toThrow();
    });

    it('should delete token after activation', async () => {
      await service.activatePortalAccess({
        token: 'valid-token',
        password: 'SecurePass123!',
      });

      expect(mocks.redisDel).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mocks.portalAccessCreate.mockRejectedValue(new Error('Database error'));

      await expect(
        service.createPortalAccess({
          clientId: CLIENT_ID_1,
          email: 'portal@example.com',
          permissions: ['view_profile'],
          sendInvitation: false,
        })
      ).rejects.toThrow();
    });

    it('should handle email service errors', async () => {
      mocks.portalAccessCreate.mockResolvedValue(samplePortalAccess);
      mocks.sendEmail.mockRejectedValue(new Error('Email service error'));

      // Should not throw, but log the error
      const result = await service.createPortalAccess({
        clientId: CLIENT_ID_1,
        email: 'portal@example.com',
        permissions: ['view_profile'],
        sendInvitation: true,
      });

      // Should still return the created access
      expect(result.id).toBe(PORTAL_ACCESS_ID);
    });
  });
});
