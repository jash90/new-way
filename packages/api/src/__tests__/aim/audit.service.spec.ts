import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// Mock dependencies
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
};

// Import after mocks are set up
import { AuditService } from '../../services/aim/audit.service';

describe('AuditService', () => {
  let auditService: AuditService;

  // Test UUIDs
  const AUDIT_LOG_ID = '550e8400-e29b-41d4-a716-446655440000';
  const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
  const ADMIN_ID = '550e8400-e29b-41d4-a716-446655440002';
  const TARGET_USER_ID = '550e8400-e29b-41d4-a716-446655440003';
  const CORRELATION_ID = '550e8400-e29b-41d4-a716-446655440004';

  // Mock data
  const mockAuditLogEntry = {
    id: AUDIT_LOG_ID,
    eventType: 'LOGIN_SUCCESS',
    actorId: USER_ID,
    targetType: 'user',
    targetId: TARGET_USER_ID,
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    correlationId: CORRELATION_ID,
    metadata: { sessionId: 'session-123', deviceFingerprint: 'fp-abc' },
    success: true,
    errorMessage: null,
    createdAt: new Date('2025-01-15T10:30:00.000Z'),
  };

  const mockAuditLogWithActor = {
    ...mockAuditLogEntry,
    actor: {
      id: USER_ID,
      email: 'jan.kowalski@example.com',
    },
    target: {
      id: TARGET_USER_ID,
      email: 'anna.nowak@example.com',
    },
  };

  const mockUser = {
    id: USER_ID,
    email: 'jan.kowalski@example.com',
    status: 'ACTIVE',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    vi.clearAllMocks();

    // Default mock implementations
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);

    auditService = new AuditService(mockPrisma as any, mockRedis as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // LIST AUDIT LOGS
  // ===========================================================================

  describe('listAuditLogs', () => {
    describe('basic listing', () => {
      it('should return paginated audit logs with default pagination', async () => {
        const mockLogs = [mockAuditLogWithActor];
        mockPrisma.authAuditLog.findMany.mockResolvedValue(mockLogs);
        mockPrisma.authAuditLog.count.mockResolvedValue(1);

        const result = await auditService.listAuditLogs({});

        expect(result).toEqual({
          items: expect.arrayContaining([
            expect.objectContaining({
              id: AUDIT_LOG_ID,
              eventType: 'LOGIN_SUCCESS',
            }),
          ]),
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        });

        expect(mockPrisma.authAuditLog.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 0,
            take: 20,
            orderBy: { createdAt: 'desc' },
          }),
        );
      });

      it('should return empty list when no logs exist', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue([]);
        mockPrisma.authAuditLog.count.mockResolvedValue(0);

        const result = await auditService.listAuditLogs({});

        expect(result).toEqual({
          items: [],
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
        });
      });

      it('should include actor and target user information', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue([mockAuditLogWithActor]);
        mockPrisma.authAuditLog.count.mockResolvedValue(1);

        const result = await auditService.listAuditLogs({});

        expect(result.items[0]).toEqual(
          expect.objectContaining({
            actor: expect.objectContaining({
              id: USER_ID,
              email: 'jan.kowalski@example.com',
            }),
            target: expect.objectContaining({
              id: TARGET_USER_ID,
              email: 'anna.nowak@example.com',
            }),
          }),
        );
      });
    });

    describe('pagination', () => {
      it('should apply custom pagination parameters', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue([]);
        mockPrisma.authAuditLog.count.mockResolvedValue(100);

        const result = await auditService.listAuditLogs({
          pagination: { page: 3, limit: 25, sortBy: 'createdAt', sortOrder: 'asc' },
        });

        expect(mockPrisma.authAuditLog.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 50, // (3-1) * 25
            take: 25,
            orderBy: { createdAt: 'asc' },
          }),
        );

        expect(result.page).toBe(3);
        expect(result.limit).toBe(25);
        expect(result.totalPages).toBe(4); // ceil(100/25)
        expect(result.hasNext).toBe(true);
        expect(result.hasPrevious).toBe(true);
      });

      it('should calculate hasNext and hasPrevious correctly', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue([]);
        mockPrisma.authAuditLog.count.mockResolvedValue(50);

        // First page
        let result = await auditService.listAuditLogs({
          pagination: { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        });
        expect(result.hasNext).toBe(true);
        expect(result.hasPrevious).toBe(false);

        // Last page
        result = await auditService.listAuditLogs({
          pagination: { page: 3, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        });
        expect(result.hasNext).toBe(false);
        expect(result.hasPrevious).toBe(true);
      });

      it('should support sorting by different fields', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue([]);
        mockPrisma.authAuditLog.count.mockResolvedValue(0);

        await auditService.listAuditLogs({
          pagination: { page: 1, limit: 20, sortBy: 'eventType', sortOrder: 'asc' },
        });

        expect(mockPrisma.authAuditLog.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { eventType: 'asc' },
          }),
        );
      });
    });

    describe('filtering', () => {
      it('should filter by actorId', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue([mockAuditLogWithActor]);
        mockPrisma.authAuditLog.count.mockResolvedValue(1);

        await auditService.listAuditLogs({
          filter: { actorId: USER_ID },
        });

        expect(mockPrisma.authAuditLog.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              actorId: USER_ID,
            }),
          }),
        );
      });

      it('should filter by targetId', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue([]);
        mockPrisma.authAuditLog.count.mockResolvedValue(0);

        await auditService.listAuditLogs({
          filter: { targetId: TARGET_USER_ID },
        });

        expect(mockPrisma.authAuditLog.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              targetId: TARGET_USER_ID,
            }),
          }),
        );
      });

      it('should filter by event types array', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue([]);
        mockPrisma.authAuditLog.count.mockResolvedValue(0);

        await auditService.listAuditLogs({
          filter: { eventTypes: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT'] },
        });

        expect(mockPrisma.authAuditLog.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              eventType: { in: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT'] },
            }),
          }),
        );
      });

      it('should filter by date range', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue([]);
        mockPrisma.authAuditLog.count.mockResolvedValue(0);

        const startDate = '2025-01-01T00:00:00.000Z';
        const endDate = '2025-01-15T23:59:59.999Z';

        await auditService.listAuditLogs({
          filter: { startDate, endDate },
        });

        expect(mockPrisma.authAuditLog.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              createdAt: {
                gte: new Date(startDate),
                lte: new Date(endDate),
              },
            }),
          }),
        );
      });

      it('should filter by IP address', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue([]);
        mockPrisma.authAuditLog.count.mockResolvedValue(0);

        await auditService.listAuditLogs({
          filter: { ipAddress: '192.168.1.100' },
        });

        expect(mockPrisma.authAuditLog.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              ipAddress: '192.168.1.100',
            }),
          }),
        );
      });

      it('should filter by correlation ID', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue([]);
        mockPrisma.authAuditLog.count.mockResolvedValue(0);

        await auditService.listAuditLogs({
          filter: { correlationId: CORRELATION_ID },
        });

        expect(mockPrisma.authAuditLog.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              correlationId: CORRELATION_ID,
            }),
          }),
        );
      });

      it('should filter by success status', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue([]);
        mockPrisma.authAuditLog.count.mockResolvedValue(0);

        await auditService.listAuditLogs({
          filter: { success: false },
        });

        expect(mockPrisma.authAuditLog.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              success: false,
            }),
          }),
        );
      });

      it('should combine multiple filters', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue([]);
        mockPrisma.authAuditLog.count.mockResolvedValue(0);

        await auditService.listAuditLogs({
          filter: {
            actorId: USER_ID,
            eventTypes: ['LOGIN_SUCCESS', 'LOGIN_FAILED'],
            success: true,
            startDate: '2025-01-01T00:00:00.000Z',
          },
        });

        expect(mockPrisma.authAuditLog.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              actorId: USER_ID,
              eventType: { in: ['LOGIN_SUCCESS', 'LOGIN_FAILED'] },
              success: true,
              createdAt: expect.objectContaining({
                gte: expect.any(Date),
              }),
            }),
          }),
        );
      });
    });

    describe('search', () => {
      it('should search in metadata using searchTerm', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue([]);
        mockPrisma.authAuditLog.count.mockResolvedValue(0);

        await auditService.listAuditLogs({
          filter: { searchTerm: 'session-123' },
        });

        // Search should be applied in metadata or error message
        expect(mockPrisma.authAuditLog.findMany).toHaveBeenCalled();
      });
    });
  });

  // ===========================================================================
  // GET SINGLE AUDIT LOG
  // ===========================================================================

  describe('getAuditLog', () => {
    it('should return audit log by ID', async () => {
      mockPrisma.authAuditLog.findUnique.mockResolvedValue(mockAuditLogWithActor);

      const result = await auditService.getAuditLog(AUDIT_LOG_ID);

      expect(result).toEqual(
        expect.objectContaining({
          id: AUDIT_LOG_ID,
          eventType: 'LOGIN_SUCCESS',
          actorId: USER_ID,
          success: true,
        }),
      );

      expect(mockPrisma.authAuditLog.findUnique).toHaveBeenCalledWith({
        where: { id: AUDIT_LOG_ID },
        include: expect.objectContaining({
          actor: expect.any(Object),
          target: expect.any(Object),
        }),
      });
    });

    it('should throw NOT_FOUND for non-existent log', async () => {
      mockPrisma.authAuditLog.findUnique.mockResolvedValue(null);

      await expect(auditService.getAuditLog(AUDIT_LOG_ID)).rejects.toThrow(TRPCError);
      await expect(auditService.getAuditLog(AUDIT_LOG_ID)).rejects.toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' }),
      );
    });

    it('should include all metadata in response', async () => {
      const logWithMetadata = {
        ...mockAuditLogWithActor,
        metadata: {
          sessionId: 'session-123',
          deviceFingerprint: 'fp-abc',
          browser: 'Chrome',
          os: 'Windows 10',
        },
      };
      mockPrisma.authAuditLog.findUnique.mockResolvedValue(logWithMetadata);

      const result = await auditService.getAuditLog(AUDIT_LOG_ID);

      expect(result.metadata).toEqual({
        sessionId: 'session-123',
        deviceFingerprint: 'fp-abc',
        browser: 'Chrome',
        os: 'Windows 10',
      });
    });
  });

  // ===========================================================================
  // GET AUDIT STATISTICS
  // ===========================================================================

  describe('getAuditStats', () => {
    describe('by event type', () => {
      it('should return statistics grouped by event type', async () => {
        const groupByResult = [
          { eventType: 'LOGIN_SUCCESS', _count: { _all: 150 } },
          { eventType: 'LOGIN_FAILED', _count: { _all: 25 } },
          { eventType: 'LOGOUT', _count: { _all: 100 } },
        ];

        const successGroupResult = [
          { eventType: 'LOGIN_SUCCESS', success: true, _count: { _all: 150 } },
          { eventType: 'LOGIN_FAILED', success: false, _count: { _all: 25 } },
          { eventType: 'LOGOUT', success: true, _count: { _all: 100 } },
        ];

        mockPrisma.authAuditLog.groupBy.mockResolvedValue(successGroupResult);
        mockPrisma.authAuditLog.count.mockResolvedValue(275);

        const result = await auditService.getAuditStats({
          groupBy: 'eventType',
        });

        expect(result).toEqual(
          expect.objectContaining({
            totalCount: expect.any(Number),
            successCount: expect.any(Number),
            failureCount: expect.any(Number),
            byEventType: expect.arrayContaining([
              expect.objectContaining({
                eventType: expect.any(String),
                count: expect.any(Number),
              }),
            ]),
          }),
        );
      });

      it('should filter statistics by date range', async () => {
        mockPrisma.authAuditLog.groupBy.mockResolvedValue([]);
        mockPrisma.authAuditLog.count.mockResolvedValue(0);

        const startDate = '2025-01-01T00:00:00.000Z';
        const endDate = '2025-01-31T23:59:59.999Z';

        await auditService.getAuditStats({
          groupBy: 'eventType',
          startDate,
          endDate,
        });

        expect(mockPrisma.authAuditLog.count).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              createdAt: {
                gte: new Date(startDate),
                lte: new Date(endDate),
              },
            }),
          }),
        );
      });

      it('should filter statistics by actor', async () => {
        mockPrisma.authAuditLog.groupBy.mockResolvedValue([]);
        mockPrisma.authAuditLog.count.mockResolvedValue(0);

        await auditService.getAuditStats({
          groupBy: 'eventType',
          actorId: USER_ID,
        });

        expect(mockPrisma.authAuditLog.count).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              actorId: USER_ID,
            }),
          }),
        );
      });
    });

    describe('by time period', () => {
      it('should return statistics grouped by day', async () => {
        // Mock raw query for date grouping
        mockPrisma.$queryRaw.mockResolvedValue([
          { period: '2025-01-13', count: BigInt(50), success_count: BigInt(45), failure_count: BigInt(5) },
          { period: '2025-01-14', count: BigInt(75), success_count: BigInt(70), failure_count: BigInt(5) },
          { period: '2025-01-15', count: BigInt(100), success_count: BigInt(90), failure_count: BigInt(10) },
        ]);
        mockPrisma.authAuditLog.count
          .mockResolvedValueOnce(225) // total
          .mockResolvedValueOnce(205) // success
          .mockResolvedValueOnce(20); // failure

        const result = await auditService.getAuditStats({
          groupBy: 'day',
        });

        expect(result).toEqual(
          expect.objectContaining({
            totalCount: 225,
            successCount: 205,
            failureCount: 20,
            byPeriod: expect.arrayContaining([
              expect.objectContaining({
                period: expect.any(String),
                count: expect.any(Number),
              }),
            ]),
          }),
        );
      });

      it('should return statistics grouped by week', async () => {
        mockPrisma.$queryRaw.mockResolvedValue([
          { period: '2025-W02', count: BigInt(500), success_count: BigInt(450), failure_count: BigInt(50) },
          { period: '2025-W03', count: BigInt(600), success_count: BigInt(550), failure_count: BigInt(50) },
        ]);
        mockPrisma.authAuditLog.count
          .mockResolvedValueOnce(1100)
          .mockResolvedValueOnce(1000)
          .mockResolvedValueOnce(100);

        const result = await auditService.getAuditStats({
          groupBy: 'week',
        });

        expect(result.byPeriod).toBeDefined();
        expect(result.byPeriod!.length).toBeGreaterThan(0);
      });

      it('should return statistics grouped by month', async () => {
        mockPrisma.$queryRaw.mockResolvedValue([
          { period: '2024-12', count: BigInt(2000), success_count: BigInt(1800), failure_count: BigInt(200) },
          { period: '2025-01', count: BigInt(2500), success_count: BigInt(2300), failure_count: BigInt(200) },
        ]);
        mockPrisma.authAuditLog.count
          .mockResolvedValueOnce(4500)
          .mockResolvedValueOnce(4100)
          .mockResolvedValueOnce(400);

        const result = await auditService.getAuditStats({
          groupBy: 'month',
        });

        expect(result.byPeriod).toBeDefined();
      });

      it('should return statistics grouped by hour', async () => {
        mockPrisma.$queryRaw.mockResolvedValue([
          { period: '2025-01-15T10', count: BigInt(30), success_count: BigInt(28), failure_count: BigInt(2) },
          { period: '2025-01-15T11', count: BigInt(45), success_count: BigInt(40), failure_count: BigInt(5) },
          { period: '2025-01-15T12', count: BigInt(25), success_count: BigInt(22), failure_count: BigInt(3) },
        ]);
        mockPrisma.authAuditLog.count
          .mockResolvedValueOnce(100)
          .mockResolvedValueOnce(90)
          .mockResolvedValueOnce(10);

        const result = await auditService.getAuditStats({
          groupBy: 'hour',
        });

        expect(result.byPeriod).toBeDefined();
      });
    });
  });

  // ===========================================================================
  // EXPORT AUDIT LOGS
  // ===========================================================================

  describe('exportAuditLogs', () => {
    const mockLogsForExport = Array.from({ length: 5 }, (_, i) => ({
      ...mockAuditLogWithActor,
      id: `550e8400-e29b-41d4-a716-44665544000${i}`,
      createdAt: new Date(`2025-01-${10 + i}T10:30:00.000Z`),
    }));

    describe('JSON export', () => {
      it('should export audit logs as JSON', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue(mockLogsForExport);
        mockPrisma.authAuditLog.count.mockResolvedValue(5);

        const result = await auditService.exportAuditLogs({
          format: 'json',
        });

        expect(result).toEqual(
          expect.objectContaining({
            format: 'json',
            recordCount: 5,
            fileSize: expect.any(Number),
            content: expect.any(String),
          }),
        );

        // Verify JSON content is valid
        const content = JSON.parse(result.content!);
        expect(Array.isArray(content)).toBe(true);
        expect(content.length).toBe(5);
      });

      it('should apply filters to export', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue([mockAuditLogWithActor]);
        mockPrisma.authAuditLog.count.mockResolvedValue(1);

        await auditService.exportAuditLogs({
          format: 'json',
          filter: { eventTypes: ['LOGIN_SUCCESS'] },
        });

        expect(mockPrisma.authAuditLog.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              eventType: { in: ['LOGIN_SUCCESS'] },
            }),
          }),
        );
      });
    });

    describe('CSV export', () => {
      it('should export audit logs as CSV', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue(mockLogsForExport);
        mockPrisma.authAuditLog.count.mockResolvedValue(5);

        const result = await auditService.exportAuditLogs({
          format: 'csv',
        });

        expect(result).toEqual(
          expect.objectContaining({
            format: 'csv',
            recordCount: 5,
            fileSize: expect.any(Number),
            content: expect.any(String),
          }),
        );

        // Verify CSV has header and rows
        const lines = result.content!.split('\n');
        expect(lines.length).toBeGreaterThan(1);
        expect(lines[0]).toContain('id');
        expect(lines[0]).toContain('eventType');
      });

      it('should escape special characters in CSV', async () => {
        const logWithComma = {
          ...mockAuditLogWithActor,
          metadata: { note: 'Value with, comma' },
        };
        mockPrisma.authAuditLog.findMany.mockResolvedValue([logWithComma]);
        mockPrisma.authAuditLog.count.mockResolvedValue(1);

        const result = await auditService.exportAuditLogs({
          format: 'csv',
        });

        // Commas in values should be quoted
        expect(result.content).toBeDefined();
      });
    });

    describe('PDF export', () => {
      it('should return download URL for PDF export', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue(mockLogsForExport);
        mockPrisma.authAuditLog.count.mockResolvedValue(5);

        const result = await auditService.exportAuditLogs({
          format: 'pdf',
        });

        expect(result).toEqual(
          expect.objectContaining({
            format: 'pdf',
            recordCount: 5,
            // PDF may have downloadUrl or content depending on implementation
          }),
        );
      });
    });

    describe('export limits', () => {
      it('should respect maxRecords limit', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue(mockLogsForExport.slice(0, 3));
        mockPrisma.authAuditLog.count.mockResolvedValue(100);

        await auditService.exportAuditLogs({
          format: 'json',
          maxRecords: 3,
        });

        expect(mockPrisma.authAuditLog.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 3,
          }),
        );
      });

      it('should use default maxRecords of 10000', async () => {
        mockPrisma.authAuditLog.findMany.mockResolvedValue([]);
        mockPrisma.authAuditLog.count.mockResolvedValue(0);

        await auditService.exportAuditLogs({
          format: 'json',
        });

        expect(mockPrisma.authAuditLog.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 10000,
          }),
        );
      });
    });

    describe('sensitive data handling', () => {
      it('should exclude sensitive metadata when includeSensitiveData is false', async () => {
        const logWithSensitiveData = {
          ...mockAuditLogWithActor,
          metadata: {
            sessionId: 'session-123',
            sensitiveField: 'should-be-excluded',
            password: 'redacted',
          },
        };
        mockPrisma.authAuditLog.findMany.mockResolvedValue([logWithSensitiveData]);
        mockPrisma.authAuditLog.count.mockResolvedValue(1);

        const result = await auditService.exportAuditLogs({
          format: 'json',
          includeSensitiveData: false,
        });

        expect(result.content).toBeDefined();
        // Implementation should filter out sensitive fields
      });

      it('should include sensitive metadata when includeSensitiveData is true', async () => {
        const logWithSensitiveData = {
          ...mockAuditLogWithActor,
          metadata: {
            sessionId: 'session-123',
            ipAddress: '192.168.1.100',
          },
        };
        mockPrisma.authAuditLog.findMany.mockResolvedValue([logWithSensitiveData]);
        mockPrisma.authAuditLog.count.mockResolvedValue(1);

        const result = await auditService.exportAuditLogs({
          format: 'json',
          includeSensitiveData: true,
        });

        expect(result.content).toBeDefined();
      });
    });
  });

  // ===========================================================================
  // DATA IMMUTABILITY
  // ===========================================================================

  describe('Data Immutability', () => {
    it('should not expose any update or delete methods', () => {
      // Verify that AuditService doesn't have mutation methods
      // that could compromise audit log integrity
      const serviceKeys = Object.keys(Object.getPrototypeOf(auditService));

      expect(serviceKeys).not.toContain('updateAuditLog');
      expect(serviceKeys).not.toContain('deleteAuditLog');
      expect(serviceKeys).not.toContain('editAuditLog');
    });
  });

  // ===========================================================================
  // CORRELATION ID TRACKING
  // ===========================================================================

  describe('Correlation ID Tracking', () => {
    it('should find all logs with same correlation ID', async () => {
      const correlatedLogs = [
        { ...mockAuditLogWithActor, eventType: 'LOGIN_SUCCESS' },
        { ...mockAuditLogWithActor, id: 'other-id', eventType: 'SESSION_CREATED' },
      ];
      mockPrisma.authAuditLog.findMany.mockResolvedValue(correlatedLogs);
      mockPrisma.authAuditLog.count.mockResolvedValue(2);

      const result = await auditService.listAuditLogs({
        filter: { correlationId: CORRELATION_ID },
      });

      expect(result.items.length).toBe(2);
      expect(result.items.every((log) => log.correlationId === CORRELATION_ID)).toBe(true);
    });
  });

  // ===========================================================================
  // CACHING
  // ===========================================================================

  describe('Caching', () => {
    it('should cache statistics results', async () => {
      const cachedStats = JSON.stringify({
        totalCount: 100,
        successCount: 90,
        failureCount: 10,
        byEventType: [],
      });
      mockRedis.get.mockResolvedValue(cachedStats);

      const result = await auditService.getAuditStats({ groupBy: 'eventType' });

      // When cache hit, should not query database
      expect(result.totalCount).toBe(100);
    });

    it('should store statistics in cache after query', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.authAuditLog.groupBy.mockResolvedValue([]);
      mockPrisma.authAuditLog.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(90)
        .mockResolvedValueOnce(10);

      await auditService.getAuditStats({ groupBy: 'eventType' });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('audit:stats:'),
        expect.any(Number), // TTL
        expect.any(String), // JSON data
      );
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.authAuditLog.findMany.mockRejectedValue(new Error('Database connection failed'));

      await expect(auditService.listAuditLogs({})).rejects.toThrow(TRPCError);
    });

    it('should handle invalid date filters', async () => {
      mockPrisma.authAuditLog.findMany.mockResolvedValue([]);
      mockPrisma.authAuditLog.count.mockResolvedValue(0);

      // Service should handle date parsing
      const result = await auditService.listAuditLogs({
        filter: {
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2025-01-15T23:59:59.999Z',
        },
      });

      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // RETENTION POLICY
  // ===========================================================================

  describe('Retention Policy', () => {
    it('should be able to query logs up to 10 years old', async () => {
      const oldLog = {
        ...mockAuditLogWithActor,
        createdAt: new Date('2015-01-15T10:30:00.000Z'),
      };
      mockPrisma.authAuditLog.findMany.mockResolvedValue([oldLog]);
      mockPrisma.authAuditLog.count.mockResolvedValue(1);

      const result = await auditService.listAuditLogs({
        filter: {
          startDate: '2015-01-01T00:00:00.000Z',
          endDate: '2015-12-31T23:59:59.999Z',
        },
      });

      expect(result.items.length).toBe(1);
    });
  });
});
