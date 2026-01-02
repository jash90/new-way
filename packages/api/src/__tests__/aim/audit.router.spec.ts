import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createContext } from '../../context';
import { appRouter } from '../../index';

// Create hoisted mocks
const mockAuditServiceMethods = vi.hoisted(() => ({
  listAuditLogs: vi.fn(),
  getAuditLog: vi.fn(),
  getAuditStats: vi.fn(),
  exportAuditLogs: vi.fn(),
}));

// Mock AuditService
vi.mock('../../services/aim/audit.service', () => ({
  AuditService: vi.fn(() => mockAuditServiceMethods),
}));

// Mocks alias
const mocks = {
  auditListAuditLogs: mockAuditServiceMethods.listAuditLogs,
  auditGetAuditLog: mockAuditServiceMethods.getAuditLog,
  auditGetAuditStats: mockAuditServiceMethods.getAuditStats,
  auditExportAuditLogs: mockAuditServiceMethods.exportAuditLogs,
};

const mockPrisma = {
  authAuditLog: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  $queryRaw: vi.fn(),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  keys: vi.fn(),
  pipeline: vi.fn(() => ({
    del: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
};

describe('AuditRouter', () => {
  // Test UUIDs
  const AUDIT_LOG_ID = '550e8400-e29b-41d4-a716-446655440000';
  const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
  const ADMIN_ID = '550e8400-e29b-41d4-a716-446655440002';
  const TARGET_USER_ID = '550e8400-e29b-41d4-a716-446655440003';
  const CORRELATION_ID = '550e8400-e29b-41d4-a716-446655440004';
  const ORG_ID = '550e8400-e29b-41d4-a716-446655440010';
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440020';

  // Mock audit log entry
  const mockAuditLogEntry = {
    id: AUDIT_LOG_ID,
    eventType: 'LOGIN_SUCCESS',
    actorId: USER_ID,
    targetType: 'user',
    targetId: TARGET_USER_ID,
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    correlationId: CORRELATION_ID,
    metadata: { sessionId: 'session-123' },
    success: true,
    errorMessage: null,
    createdAt: '2025-01-15T10:30:00.000Z',
    actor: { id: USER_ID, email: 'jan.kowalski@example.com' },
    target: { id: TARGET_USER_ID, email: 'anna.nowak@example.com' },
  };

  // Mock paginated response
  const mockPaginatedResponse = {
    items: [mockAuditLogEntry],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  };

  // Mock stats response
  const mockStatsResponse = {
    totalCount: 100,
    successCount: 90,
    failureCount: 10,
    byEventType: [
      { eventType: 'LOGIN_SUCCESS', count: 50, successCount: 50, failureCount: 0 },
      { eventType: 'LOGIN_FAILED', count: 10, successCount: 0, failureCount: 10 },
    ],
  };

  // Mock export response
  const mockExportResponse = {
    format: 'json',
    recordCount: 10,
    fileSize: 5000,
    content: '[...]',
  };

  // Context helpers
  function createAdminContext() {
    const ctx = createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
          authorization: 'Bearer admin-token',
        },
      } as any,
      res: { setHeader: vi.fn() } as any,
      session: null,
    });

    return {
      ...ctx,
      session: {
        sessionId: SESSION_ID,
        userId: ADMIN_ID,
        email: 'admin@example.com',
        roles: ['ADMIN'],
        organizationId: ORG_ID,
      },
    };
  }

  function createUserContext() {
    const ctx = createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
          authorization: 'Bearer user-token',
        },
      } as any,
      res: { setHeader: vi.fn() } as any,
      session: null,
    });

    return {
      ...ctx,
      session: {
        sessionId: SESSION_ID,
        userId: USER_ID,
        email: 'user@example.com',
        roles: ['USER'],
        organizationId: ORG_ID,
      },
    };
  }

  function createUnauthenticatedContext() {
    return createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
        },
      } as any,
      res: { setHeader: vi.fn() } as any,
      session: null,
    });
  }

  let adminCaller: ReturnType<typeof appRouter.createCaller>;
  let userCaller: ReturnType<typeof appRouter.createCaller>;
  let unauthenticatedCaller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    vi.clearAllMocks();

    // Create callers
    adminCaller = appRouter.createCaller(createAdminContext());
    userCaller = appRouter.createCaller(createUserContext());
    unauthenticatedCaller = appRouter.createCaller(createUnauthenticatedContext());

    // Default mock implementations
    mocks.auditListAuditLogs.mockResolvedValue(mockPaginatedResponse);
    mocks.auditGetAuditLog.mockResolvedValue(mockAuditLogEntry);
    mocks.auditGetAuditStats.mockResolvedValue(mockStatsResponse);
    mocks.auditExportAuditLogs.mockResolvedValue(mockExportResponse);

    // Default Redis mocks
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // LIST AUDIT LOGS
  // ===========================================================================

  describe('list', () => {
    it('should return paginated audit logs', async () => {
      const result = await adminCaller.aim.audit.list({});

      expect(result).toEqual(mockPaginatedResponse);
      expect(mocks.auditListAuditLogs).toHaveBeenCalledWith({});
    });

    it('should apply filters and pagination', async () => {
      const input = {
        filter: {
          actorId: USER_ID,
          eventTypes: ['LOGIN_SUCCESS', 'LOGIN_FAILED'] as const,
          success: true,
        },
        pagination: {
          page: 2,
          limit: 50,
          sortBy: 'eventType' as const,
          sortOrder: 'asc' as const,
        },
      };

      await adminCaller.aim.audit.list(input);

      expect(mocks.auditListAuditLogs).toHaveBeenCalledWith(input);
    });

    it('should require authentication', async () => {
      await expect(unauthenticatedCaller.aim.audit.list({})).rejects.toThrow(TRPCError);
    });

    it('should handle date range filters', async () => {
      const input = {
        filter: {
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2025-01-31T23:59:59.999Z',
        },
      };

      await adminCaller.aim.audit.list(input);

      expect(mocks.auditListAuditLogs).toHaveBeenCalledWith(input);
    });

    it('should handle correlation ID filter', async () => {
      const input = {
        filter: { correlationId: CORRELATION_ID },
      };

      await adminCaller.aim.audit.list(input);

      expect(mocks.auditListAuditLogs).toHaveBeenCalledWith(input);
    });

    it('should handle service errors gracefully', async () => {
      mocks.auditListAuditLogs.mockRejectedValue(
        new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database error',
        }),
      );

      await expect(adminCaller.aim.audit.list({})).rejects.toThrow(TRPCError);
    });
  });

  // ===========================================================================
  // GET SINGLE AUDIT LOG
  // ===========================================================================

  describe('get', () => {
    it('should return audit log by ID', async () => {
      const result = await adminCaller.aim.audit.get({ id: AUDIT_LOG_ID });

      expect(result).toEqual(mockAuditLogEntry);
      expect(mocks.auditGetAuditLog).toHaveBeenCalledWith(AUDIT_LOG_ID);
    });

    it('should require authentication', async () => {
      await expect(unauthenticatedCaller.aim.audit.get({ id: AUDIT_LOG_ID })).rejects.toThrow(TRPCError);
    });

    it('should throw NOT_FOUND for non-existent log', async () => {
      mocks.auditGetAuditLog.mockRejectedValue(
        new TRPCError({
          code: 'NOT_FOUND',
          message: 'Audit log not found',
        }),
      );

      await expect(adminCaller.aim.audit.get({ id: AUDIT_LOG_ID })).rejects.toThrow(TRPCError);
      await expect(adminCaller.aim.audit.get({ id: AUDIT_LOG_ID })).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' }),
      );
    });

    it('should validate UUID format', async () => {
      await expect(adminCaller.aim.audit.get({ id: 'invalid-uuid' })).rejects.toThrow();
    });
  });

  // ===========================================================================
  // GET AUDIT STATISTICS
  // ===========================================================================

  describe('getStats', () => {
    it('should return statistics grouped by event type', async () => {
      const result = await adminCaller.aim.audit.getStats({ groupBy: 'eventType' });

      expect(result).toEqual(mockStatsResponse);
      expect(mocks.auditGetAuditStats).toHaveBeenCalledWith({ groupBy: 'eventType' });
    });

    it('should return statistics grouped by day', async () => {
      const mockDayStats = {
        totalCount: 100,
        successCount: 90,
        failureCount: 10,
        byPeriod: [
          { period: '2025-01-15', count: 50, successCount: 45, failureCount: 5 },
          { period: '2025-01-14', count: 50, successCount: 45, failureCount: 5 },
        ],
      };
      mocks.auditGetAuditStats.mockResolvedValue(mockDayStats);

      const result = await adminCaller.aim.audit.getStats({ groupBy: 'day' });

      expect(result.byPeriod).toBeDefined();
      expect(mocks.auditGetAuditStats).toHaveBeenCalledWith({ groupBy: 'day' });
    });

    it('should apply date range filters', async () => {
      const input = {
        groupBy: 'eventType' as const,
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-01-31T23:59:59.999Z',
      };

      await adminCaller.aim.audit.getStats(input);

      expect(mocks.auditGetAuditStats).toHaveBeenCalledWith(input);
    });

    it('should filter by actor', async () => {
      const input = {
        groupBy: 'eventType' as const,
        actorId: USER_ID,
      };

      await adminCaller.aim.audit.getStats(input);

      expect(mocks.auditGetAuditStats).toHaveBeenCalledWith(input);
    });

    it('should require authentication', async () => {
      await expect(unauthenticatedCaller.aim.audit.getStats({ groupBy: 'eventType' })).rejects.toThrow(TRPCError);
    });

    it('should support all groupBy options', async () => {
      for (const groupBy of ['eventType', 'day', 'week', 'month', 'hour'] as const) {
        await adminCaller.aim.audit.getStats({ groupBy });
        expect(mocks.auditGetAuditStats).toHaveBeenCalledWith({ groupBy });
      }
    });
  });

  // ===========================================================================
  // EXPORT AUDIT LOGS
  // ===========================================================================

  describe('export', () => {
    it('should export audit logs as JSON', async () => {
      const result = await adminCaller.aim.audit.export({ format: 'json' });

      expect(result).toEqual(mockExportResponse);
      // Zod schema adds defaults: maxRecords: 10000, includeSensitiveData: false
      expect(mocks.auditExportAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'json' }),
      );
    });

    it('should export audit logs as CSV', async () => {
      const mockCsvExport = {
        format: 'csv',
        recordCount: 10,
        fileSize: 3000,
        content: 'id,eventType,...',
      };
      mocks.auditExportAuditLogs.mockResolvedValue(mockCsvExport);

      const result = await adminCaller.aim.audit.export({ format: 'csv' });

      expect(result.format).toBe('csv');
      expect(result.content).toBeDefined();
    });

    it('should export audit logs as PDF', async () => {
      const mockPdfExport = {
        format: 'pdf',
        recordCount: 10,
        fileSize: 15000,
        downloadUrl: 'https://example.com/export.pdf',
        expiresAt: '2025-01-16T12:00:00.000Z',
      };
      mocks.auditExportAuditLogs.mockResolvedValue(mockPdfExport);

      const result = await adminCaller.aim.audit.export({ format: 'pdf' });

      expect(result.format).toBe('pdf');
    });

    it('should apply filters to export', async () => {
      const input = {
        format: 'json' as const,
        filter: {
          eventTypes: ['LOGIN_SUCCESS'] as const,
          startDate: '2025-01-01T00:00:00.000Z',
        },
      };

      await adminCaller.aim.audit.export(input);

      // Zod schema adds defaults: maxRecords: 10000, includeSensitiveData: false
      expect(mocks.auditExportAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining(input),
      );
    });

    it('should respect maxRecords limit', async () => {
      const input = {
        format: 'json' as const,
        maxRecords: 1000,
      };

      await adminCaller.aim.audit.export(input);

      // Zod schema adds default: includeSensitiveData: false
      expect(mocks.auditExportAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining(input),
      );
    });

    it('should handle includeSensitiveData flag', async () => {
      const input = {
        format: 'json' as const,
        includeSensitiveData: true,
      };

      await adminCaller.aim.audit.export(input);

      // Zod schema adds default: maxRecords: 10000
      expect(mocks.auditExportAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining(input),
      );
    });

    it('should require authentication', async () => {
      await expect(unauthenticatedCaller.aim.audit.export({ format: 'json' })).rejects.toThrow(TRPCError);
    });

    it('should validate format parameter', async () => {
      // Invalid format should be rejected by schema
      await expect(
        adminCaller.aim.audit.export({ format: 'invalid' as any }),
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // AUTHORIZATION
  // ===========================================================================

  describe('Authorization', () => {
    it('should allow admin users to access all audit endpoints', async () => {
      // All operations should succeed
      await expect(adminCaller.aim.audit.list({})).resolves.toBeDefined();
      await expect(adminCaller.aim.audit.get({ id: AUDIT_LOG_ID })).resolves.toBeDefined();
      await expect(adminCaller.aim.audit.getStats({ groupBy: 'eventType' })).resolves.toBeDefined();
      await expect(adminCaller.aim.audit.export({ format: 'json' })).resolves.toBeDefined();
    });

    it('should allow regular users to view their own audit logs', async () => {
      // User filtering their own logs should work
      const input = { filter: { actorId: USER_ID } };
      await userCaller.aim.audit.list(input);

      expect(mocks.auditListAuditLogs).toHaveBeenCalledWith(input);
    });
  });

  // ===========================================================================
  // INPUT VALIDATION
  // ===========================================================================

  describe('Input Validation', () => {
    it('should validate pagination parameters', async () => {
      // Invalid page number
      await expect(
        adminCaller.aim.audit.list({ pagination: { page: 0, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' } }),
      ).rejects.toThrow();

      // Invalid limit
      await expect(
        adminCaller.aim.audit.list({ pagination: { page: 1, limit: 200, sortBy: 'createdAt', sortOrder: 'desc' } }),
      ).rejects.toThrow();
    });

    it('should validate UUID parameters', async () => {
      // Invalid actorId
      await expect(adminCaller.aim.audit.list({ filter: { actorId: 'not-a-uuid' } })).rejects.toThrow();
    });

    it('should validate date format', async () => {
      // Invalid date format
      await expect(
        adminCaller.aim.audit.list({ filter: { startDate: 'invalid-date' } }),
      ).rejects.toThrow();
    });

    it('should validate event type values', async () => {
      // Invalid event type
      await expect(
        adminCaller.aim.audit.list({ filter: { eventTypes: ['INVALID_EVENT' as any] } }),
      ).rejects.toThrow();
    });

    it('should validate export format', async () => {
      // Invalid format
      await expect(adminCaller.aim.audit.export({ format: 'xml' as any })).rejects.toThrow();
    });

    it('should validate maxRecords range', async () => {
      // Exceeds max
      await expect(
        adminCaller.aim.audit.export({ format: 'json', maxRecords: 200000 }),
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // SERVICE INTEGRATION
  // ===========================================================================

  describe('Service Integration', () => {
    it('should call AuditService.listAuditLogs with correct parameters', async () => {
      const input = {
        filter: { success: true },
        pagination: { page: 1, limit: 20, sortBy: 'createdAt' as const, sortOrder: 'desc' as const },
      };

      await adminCaller.aim.audit.list(input);

      expect(mocks.auditListAuditLogs).toHaveBeenCalledTimes(1);
      expect(mocks.auditListAuditLogs).toHaveBeenCalledWith(input);
    });

    it('should call AuditService.getAuditLog with correct ID', async () => {
      await adminCaller.aim.audit.get({ id: AUDIT_LOG_ID });

      expect(mocks.auditGetAuditLog).toHaveBeenCalledTimes(1);
      expect(mocks.auditGetAuditLog).toHaveBeenCalledWith(AUDIT_LOG_ID);
    });

    it('should call AuditService.getAuditStats with correct parameters', async () => {
      const input = { groupBy: 'month' as const, actorId: USER_ID };

      await adminCaller.aim.audit.getStats(input);

      expect(mocks.auditGetAuditStats).toHaveBeenCalledTimes(1);
      expect(mocks.auditGetAuditStats).toHaveBeenCalledWith(input);
    });

    it('should call AuditService.exportAuditLogs with correct parameters', async () => {
      const input = {
        format: 'csv' as const,
        filter: { success: true },
        maxRecords: 5000,
        includeSensitiveData: false,
      };

      await adminCaller.aim.audit.export(input);

      expect(mocks.auditExportAuditLogs).toHaveBeenCalledTimes(1);
      expect(mocks.auditExportAuditLogs).toHaveBeenCalledWith(input);
    });
  });
});
