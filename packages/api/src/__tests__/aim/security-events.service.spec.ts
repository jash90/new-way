import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// Mock dependencies
const mockPrisma = {
  securityAlert: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    groupBy: vi.fn(),
  },
  notificationSubscription: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  authAuditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
};

// Import after mocks are set up
import { SecurityEventsService } from '../../services/aim/security-events.service';
import { AuditLogger } from '../../utils/audit-logger';

describe('SecurityEventsService', () => {
  let securityEventsService: SecurityEventsService;
  let auditLogger: AuditLogger;

  // Test UUIDs
  const ALERT_ID = '550e8400-e29b-41d4-a716-446655440000';
  const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
  const ADMIN_ID = '550e8400-e29b-41d4-a716-446655440002';
  const SUBSCRIPTION_ID = '550e8400-e29b-41d4-a716-446655440003';

  // Mock data
  const mockSecurityAlert = {
    id: ALERT_ID,
    userId: USER_ID,
    type: 'BRUTE_FORCE_DETECTED',
    severity: 'high',
    status: 'active',
    title: 'Wykryto atak brute force',
    description: 'Zarejestrowano 10 nieudanych prób logowania z IP 192.168.1.100',
    metadata: { failedAttempts: 10, ipAddress: '192.168.1.100' },
    ipAddress: '192.168.1.100',
    resolvedAt: null,
    resolvedBy: null,
    createdAt: new Date('2025-01-15T10:30:00.000Z'),
  };

  const mockSecurityAlertWithUser = {
    ...mockSecurityAlert,
    user: {
      id: USER_ID,
      email: 'jan.kowalski@example.com',
    },
    escalations: [],
  };

  const mockNotificationSubscription = {
    id: SUBSCRIPTION_ID,
    userId: USER_ID,
    channel: 'email',
    endpoint: 'jan.kowalski@example.com',
    eventTypes: ['BRUTE_FORCE_DETECTED', 'ACCOUNT_LOCKED'],
    severities: ['high', 'critical'],
    isActive: true,
    createdAt: new Date('2025-01-15T10:00:00.000Z'),
    updatedAt: new Date('2025-01-15T10:00:00.000Z'),
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

    auditLogger = new AuditLogger(mockPrisma as any);
    securityEventsService = new SecurityEventsService(
      mockPrisma as any,
      mockRedis as any,
      auditLogger,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // LIST SECURITY ALERTS
  // ===========================================================================

  describe('listAlerts', () => {
    describe('basic listing', () => {
      it('should return paginated security alerts with default pagination', async () => {
        const mockAlerts = [mockSecurityAlertWithUser];
        mockPrisma.securityAlert.findMany.mockResolvedValue(mockAlerts);
        mockPrisma.securityAlert.count.mockResolvedValue(1);

        const result = await securityEventsService.listAlerts({});

        expect(result).toEqual({
          items: expect.arrayContaining([
            expect.objectContaining({
              id: ALERT_ID,
              type: 'BRUTE_FORCE_DETECTED',
              severity: 'high',
              status: 'active',
            }),
          ]),
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        });

        expect(mockPrisma.securityAlert.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 0,
            take: 20,
            orderBy: { createdAt: 'desc' },
          }),
        );
      });

      it('should return empty list when no alerts exist', async () => {
        mockPrisma.securityAlert.findMany.mockResolvedValue([]);
        mockPrisma.securityAlert.count.mockResolvedValue(0);

        const result = await securityEventsService.listAlerts({});

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

      it('should include user and escalations information', async () => {
        mockPrisma.securityAlert.findMany.mockResolvedValue([mockSecurityAlertWithUser]);
        mockPrisma.securityAlert.count.mockResolvedValue(1);

        const result = await securityEventsService.listAlerts({});

        expect(result.items[0]).toEqual(
          expect.objectContaining({
            user: expect.objectContaining({
              id: USER_ID,
              email: 'jan.kowalski@example.com',
            }),
          }),
        );
      });
    });

    describe('pagination', () => {
      it('should apply custom pagination parameters', async () => {
        mockPrisma.securityAlert.findMany.mockResolvedValue([]);
        mockPrisma.securityAlert.count.mockResolvedValue(100);

        const result = await securityEventsService.listAlerts({
          pagination: { page: 3, limit: 25, sortBy: 'severity', sortOrder: 'asc' },
        });

        expect(mockPrisma.securityAlert.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 50, // (3-1) * 25
            take: 25,
            orderBy: { severity: 'asc' },
          }),
        );

        expect(result.page).toBe(3);
        expect(result.limit).toBe(25);
        expect(result.totalPages).toBe(4); // ceil(100/25)
        expect(result.hasNext).toBe(true);
        expect(result.hasPrevious).toBe(true);
      });

      it('should calculate hasNext and hasPrevious correctly', async () => {
        mockPrisma.securityAlert.findMany.mockResolvedValue([]);
        mockPrisma.securityAlert.count.mockResolvedValue(50);

        // First page
        let result = await securityEventsService.listAlerts({
          pagination: { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        });
        expect(result.hasNext).toBe(true);
        expect(result.hasPrevious).toBe(false);

        // Last page
        result = await securityEventsService.listAlerts({
          pagination: { page: 3, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
        });
        expect(result.hasNext).toBe(false);
        expect(result.hasPrevious).toBe(true);
      });
    });

    describe('filtering', () => {
      it('should filter by userId', async () => {
        mockPrisma.securityAlert.findMany.mockResolvedValue([mockSecurityAlertWithUser]);
        mockPrisma.securityAlert.count.mockResolvedValue(1);

        await securityEventsService.listAlerts({
          filter: { userId: USER_ID },
        });

        expect(mockPrisma.securityAlert.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              userId: USER_ID,
            }),
          }),
        );
      });

      it('should filter by alert types', async () => {
        mockPrisma.securityAlert.findMany.mockResolvedValue([mockSecurityAlertWithUser]);
        mockPrisma.securityAlert.count.mockResolvedValue(1);

        await securityEventsService.listAlerts({
          filter: { types: ['BRUTE_FORCE_DETECTED', 'ACCOUNT_LOCKED'] },
        });

        expect(mockPrisma.securityAlert.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              type: { in: ['BRUTE_FORCE_DETECTED', 'ACCOUNT_LOCKED'] },
            }),
          }),
        );
      });

      it('should filter by severity levels', async () => {
        mockPrisma.securityAlert.findMany.mockResolvedValue([mockSecurityAlertWithUser]);
        mockPrisma.securityAlert.count.mockResolvedValue(1);

        await securityEventsService.listAlerts({
          filter: { severities: ['high', 'critical'] },
        });

        expect(mockPrisma.securityAlert.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              severity: { in: ['high', 'critical'] },
            }),
          }),
        );
      });

      it('should filter by status', async () => {
        mockPrisma.securityAlert.findMany.mockResolvedValue([mockSecurityAlertWithUser]);
        mockPrisma.securityAlert.count.mockResolvedValue(1);

        await securityEventsService.listAlerts({
          filter: { statuses: ['active', 'acknowledged'] },
        });

        expect(mockPrisma.securityAlert.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              status: { in: ['active', 'acknowledged'] },
            }),
          }),
        );
      });

      it('should filter by date range', async () => {
        mockPrisma.securityAlert.findMany.mockResolvedValue([mockSecurityAlertWithUser]);
        mockPrisma.securityAlert.count.mockResolvedValue(1);

        const startDate = '2025-01-01T00:00:00.000Z';
        const endDate = '2025-01-31T23:59:59.999Z';

        await securityEventsService.listAlerts({
          filter: { startDate, endDate },
        });

        expect(mockPrisma.securityAlert.findMany).toHaveBeenCalledWith(
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
        mockPrisma.securityAlert.findMany.mockResolvedValue([mockSecurityAlertWithUser]);
        mockPrisma.securityAlert.count.mockResolvedValue(1);

        await securityEventsService.listAlerts({
          filter: { ipAddress: '192.168.1.100' },
        });

        expect(mockPrisma.securityAlert.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              ipAddress: '192.168.1.100',
            }),
          }),
        );
      });

      it('should filter by search term in title/description', async () => {
        mockPrisma.securityAlert.findMany.mockResolvedValue([mockSecurityAlertWithUser]);
        mockPrisma.securityAlert.count.mockResolvedValue(1);

        await securityEventsService.listAlerts({
          filter: { searchTerm: 'brute force' },
        });

        expect(mockPrisma.securityAlert.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: [
                { title: { contains: 'brute force', mode: 'insensitive' } },
                { description: { contains: 'brute force', mode: 'insensitive' } },
              ],
            }),
          }),
        );
      });

      it('should combine multiple filters', async () => {
        mockPrisma.securityAlert.findMany.mockResolvedValue([mockSecurityAlertWithUser]);
        mockPrisma.securityAlert.count.mockResolvedValue(1);

        await securityEventsService.listAlerts({
          filter: {
            userId: USER_ID,
            types: ['BRUTE_FORCE_DETECTED'],
            severities: ['high'],
            statuses: ['active'],
          },
        });

        expect(mockPrisma.securityAlert.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              userId: USER_ID,
              type: { in: ['BRUTE_FORCE_DETECTED'] },
              severity: { in: ['high'] },
              status: { in: ['active'] },
            }),
          }),
        );
      });
    });
  });

  // ===========================================================================
  // GET SINGLE ALERT
  // ===========================================================================

  describe('getAlert', () => {
    it('should return alert by ID with related data', async () => {
      mockPrisma.securityAlert.findUnique.mockResolvedValue(mockSecurityAlertWithUser);

      const result = await securityEventsService.getAlert(ALERT_ID);

      expect(result).toEqual(
        expect.objectContaining({
          id: ALERT_ID,
          type: 'BRUTE_FORCE_DETECTED',
          severity: 'high',
          status: 'active',
          user: expect.objectContaining({
            id: USER_ID,
            email: 'jan.kowalski@example.com',
          }),
        }),
      );

      expect(mockPrisma.securityAlert.findUnique).toHaveBeenCalledWith({
        where: { id: ALERT_ID },
        include: {
          user: { select: { id: true, email: true } },
          escalations: {
            select: {
              id: true,
              level: true,
              escalatedAt: true,
              acknowledgedAt: true,
            },
            orderBy: { escalatedAt: 'desc' },
          },
        },
      });
    });

    it('should throw NOT_FOUND when alert does not exist', async () => {
      mockPrisma.securityAlert.findUnique.mockResolvedValue(null);

      await expect(securityEventsService.getAlert(ALERT_ID)).rejects.toThrow(TRPCError);
      await expect(securityEventsService.getAlert(ALERT_ID)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Alert bezpieczeństwa nie został znaleziony',
      });
    });
  });

  // ===========================================================================
  // ACKNOWLEDGE ALERT
  // ===========================================================================

  describe('acknowledgeAlert', () => {
    it('should acknowledge an active alert', async () => {
      const activeAlert = { ...mockSecurityAlert, status: 'active' };
      const acknowledgedAlert = { ...activeAlert, status: 'acknowledged' };

      mockPrisma.securityAlert.findUnique.mockResolvedValue(activeAlert);
      mockPrisma.securityAlert.update.mockResolvedValue({
        ...acknowledgedAlert,
        user: { id: USER_ID, email: 'jan.kowalski@example.com' },
        escalations: [],
      });

      const result = await securityEventsService.acknowledgeAlert(ALERT_ID, ADMIN_ID, {
        notes: 'Rozpoznano alert, analizuję sytuację',
      });

      expect(result.success).toBe(true);
      expect(result.alert.status).toBe('acknowledged');
      expect(result.message).toContain('zaakceptowany');

      expect(mockPrisma.securityAlert.update).toHaveBeenCalledWith({
        where: { id: ALERT_ID },
        data: expect.objectContaining({
          status: 'acknowledged',
          metadata: expect.objectContaining({
            acknowledgedBy: ADMIN_ID,
            acknowledgedAt: expect.any(String),
            notes: 'Rozpoznano alert, analizuję sytuację',
          }),
        }),
        include: expect.any(Object),
      });
    });

    it('should throw error when alert is already resolved', async () => {
      const resolvedAlert = { ...mockSecurityAlert, status: 'resolved' };
      mockPrisma.securityAlert.findUnique.mockResolvedValue(resolvedAlert);

      await expect(
        securityEventsService.acknowledgeAlert(ALERT_ID, ADMIN_ID),
      ).rejects.toThrow(TRPCError);
      await expect(
        securityEventsService.acknowledgeAlert(ALERT_ID, ADMIN_ID),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: expect.stringContaining('nie można zaakceptować'),
      });
    });

    it('should throw error when alert is already dismissed', async () => {
      const dismissedAlert = { ...mockSecurityAlert, status: 'dismissed' };
      mockPrisma.securityAlert.findUnique.mockResolvedValue(dismissedAlert);

      await expect(
        securityEventsService.acknowledgeAlert(ALERT_ID, ADMIN_ID),
      ).rejects.toThrow(TRPCError);
    });

    it('should throw NOT_FOUND when alert does not exist', async () => {
      mockPrisma.securityAlert.findUnique.mockResolvedValue(null);

      await expect(
        securityEventsService.acknowledgeAlert(ALERT_ID, ADMIN_ID),
      ).rejects.toThrow(TRPCError);
      await expect(
        securityEventsService.acknowledgeAlert(ALERT_ID, ADMIN_ID),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should log audit event when acknowledging alert', async () => {
      const activeAlert = { ...mockSecurityAlert, status: 'active' };
      mockPrisma.securityAlert.findUnique.mockResolvedValue(activeAlert);
      mockPrisma.securityAlert.update.mockResolvedValue({
        ...activeAlert,
        status: 'acknowledged',
        user: { id: USER_ID, email: 'jan.kowalski@example.com' },
        escalations: [],
      });

      await securityEventsService.acknowledgeAlert(ALERT_ID, ADMIN_ID);

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'SECURITY_ALERT_ACKNOWLEDGED',
          metadata: expect.objectContaining({
            alertId: ALERT_ID,
            alertType: 'BRUTE_FORCE_DETECTED',
          }),
        }),
      });
    });
  });

  // ===========================================================================
  // RESOLVE ALERT
  // ===========================================================================

  describe('resolveAlert', () => {
    it('should resolve an active alert with resolution details', async () => {
      const activeAlert = { ...mockSecurityAlert, status: 'active' };
      const now = new Date('2025-01-15T12:00:00.000Z');

      mockPrisma.securityAlert.findUnique.mockResolvedValue(activeAlert);
      mockPrisma.securityAlert.update.mockResolvedValue({
        ...activeAlert,
        status: 'resolved',
        resolvedAt: now,
        resolvedBy: ADMIN_ID,
        user: { id: USER_ID, email: 'jan.kowalski@example.com' },
        escalations: [],
      });

      const result = await securityEventsService.resolveAlert(ALERT_ID, ADMIN_ID, {
        resolution: 'Zablokowano IP atakującego i zresetowano hasło użytkownika',
        preventionActions: ['Dodano IP do blacklisty', 'Włączono MFA dla użytkownika'],
      });

      expect(result.success).toBe(true);
      expect(result.alert.status).toBe('resolved');
      expect(result.alert.resolvedBy).toBe(ADMIN_ID);
      expect(result.message).toContain('rozwiązany');

      expect(mockPrisma.securityAlert.update).toHaveBeenCalledWith({
        where: { id: ALERT_ID },
        data: expect.objectContaining({
          status: 'resolved',
          resolvedAt: expect.any(Date),
          resolvedBy: ADMIN_ID,
          metadata: expect.objectContaining({
            resolution: 'Zablokowano IP atakującego i zresetowano hasło użytkownika',
            preventionActions: ['Dodano IP do blacklisty', 'Włączono MFA dla użytkownika'],
          }),
        }),
        include: expect.any(Object),
      });
    });

    it('should resolve an acknowledged alert', async () => {
      const acknowledgedAlert = { ...mockSecurityAlert, status: 'acknowledged' };

      mockPrisma.securityAlert.findUnique.mockResolvedValue(acknowledgedAlert);
      mockPrisma.securityAlert.update.mockResolvedValue({
        ...acknowledgedAlert,
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: ADMIN_ID,
        user: { id: USER_ID, email: 'jan.kowalski@example.com' },
        escalations: [],
      });

      const result = await securityEventsService.resolveAlert(ALERT_ID, ADMIN_ID, {
        resolution: 'Problem rozwiązany',
      });

      expect(result.success).toBe(true);
      expect(result.alert.status).toBe('resolved');
    });

    it('should throw error when alert is already resolved', async () => {
      const resolvedAlert = { ...mockSecurityAlert, status: 'resolved' };
      mockPrisma.securityAlert.findUnique.mockResolvedValue(resolvedAlert);

      await expect(
        securityEventsService.resolveAlert(ALERT_ID, ADMIN_ID, {
          resolution: 'Problem rozwiązany',
        }),
      ).rejects.toThrow(TRPCError);
      await expect(
        securityEventsService.resolveAlert(ALERT_ID, ADMIN_ID, {
          resolution: 'Problem rozwiązany',
        }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: expect.stringContaining('nie można rozwiązać'),
      });
    });

    it('should throw error when alert is dismissed', async () => {
      const dismissedAlert = { ...mockSecurityAlert, status: 'dismissed' };
      mockPrisma.securityAlert.findUnique.mockResolvedValue(dismissedAlert);

      await expect(
        securityEventsService.resolveAlert(ALERT_ID, ADMIN_ID, {
          resolution: 'Problem rozwiązany',
        }),
      ).rejects.toThrow(TRPCError);
    });

    it('should log audit event when resolving alert', async () => {
      const activeAlert = { ...mockSecurityAlert, status: 'active' };
      mockPrisma.securityAlert.findUnique.mockResolvedValue(activeAlert);
      mockPrisma.securityAlert.update.mockResolvedValue({
        ...activeAlert,
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: ADMIN_ID,
        user: { id: USER_ID, email: 'jan.kowalski@example.com' },
        escalations: [],
      });

      await securityEventsService.resolveAlert(ALERT_ID, ADMIN_ID, {
        resolution: 'Problem rozwiązany',
      });

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'SECURITY_ALERT_RESOLVED',
          metadata: expect.objectContaining({
            alertId: ALERT_ID,
            alertType: 'BRUTE_FORCE_DETECTED',
            resolution: 'Problem rozwiązany',
          }),
        }),
      });
    });
  });

  // ===========================================================================
  // DISMISS ALERT
  // ===========================================================================

  describe('dismissAlert', () => {
    it('should dismiss an active alert with reason', async () => {
      const activeAlert = { ...mockSecurityAlert, status: 'active' };

      mockPrisma.securityAlert.findUnique.mockResolvedValue(activeAlert);
      mockPrisma.securityAlert.update.mockResolvedValue({
        ...activeAlert,
        status: 'dismissed',
        user: { id: USER_ID, email: 'jan.kowalski@example.com' },
        escalations: [],
      });

      const result = await securityEventsService.dismissAlert(ALERT_ID, ADMIN_ID, {
        reason: 'Alert wygenerowany przez test bezpieczeństwa',
        falsePositive: true,
      });

      expect(result.success).toBe(true);
      expect(result.alert.status).toBe('dismissed');
      expect(result.message).toContain('odrzucony');

      expect(mockPrisma.securityAlert.update).toHaveBeenCalledWith({
        where: { id: ALERT_ID },
        data: expect.objectContaining({
          status: 'dismissed',
          metadata: expect.objectContaining({
            dismissedBy: ADMIN_ID,
            dismissedAt: expect.any(String),
            dismissReason: 'Alert wygenerowany przez test bezpieczeństwa',
            falsePositive: true,
          }),
        }),
        include: expect.any(Object),
      });
    });

    it('should dismiss an acknowledged alert', async () => {
      const acknowledgedAlert = { ...mockSecurityAlert, status: 'acknowledged' };

      mockPrisma.securityAlert.findUnique.mockResolvedValue(acknowledgedAlert);
      mockPrisma.securityAlert.update.mockResolvedValue({
        ...acknowledgedAlert,
        status: 'dismissed',
        user: { id: USER_ID, email: 'jan.kowalski@example.com' },
        escalations: [],
      });

      const result = await securityEventsService.dismissAlert(ALERT_ID, ADMIN_ID, {
        reason: 'Fałszywy alarm',
        falsePositive: true,
      });

      expect(result.success).toBe(true);
      expect(result.alert.status).toBe('dismissed');
    });

    it('should throw error when alert is already resolved', async () => {
      const resolvedAlert = { ...mockSecurityAlert, status: 'resolved' };
      mockPrisma.securityAlert.findUnique.mockResolvedValue(resolvedAlert);

      await expect(
        securityEventsService.dismissAlert(ALERT_ID, ADMIN_ID, {
          reason: 'Fałszywy alarm',
        }),
      ).rejects.toThrow(TRPCError);
    });

    it('should throw error when alert is already dismissed', async () => {
      const dismissedAlert = { ...mockSecurityAlert, status: 'dismissed' };
      mockPrisma.securityAlert.findUnique.mockResolvedValue(dismissedAlert);

      await expect(
        securityEventsService.dismissAlert(ALERT_ID, ADMIN_ID, {
          reason: 'Fałszywy alarm',
        }),
      ).rejects.toThrow(TRPCError);
    });

    it('should log audit event when dismissing alert', async () => {
      const activeAlert = { ...mockSecurityAlert, status: 'active' };
      mockPrisma.securityAlert.findUnique.mockResolvedValue(activeAlert);
      mockPrisma.securityAlert.update.mockResolvedValue({
        ...activeAlert,
        status: 'dismissed',
        user: { id: USER_ID, email: 'jan.kowalski@example.com' },
        escalations: [],
      });

      await securityEventsService.dismissAlert(ALERT_ID, ADMIN_ID, {
        reason: 'Fałszywy alarm',
        falsePositive: true,
      });

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'SECURITY_ALERT_DISMISSED',
          metadata: expect.objectContaining({
            alertId: ALERT_ID,
            alertType: 'BRUTE_FORCE_DETECTED',
            reason: 'Fałszywy alarm',
            falsePositive: true,
          }),
        }),
      });
    });
  });

  // ===========================================================================
  // GET ALERT STATISTICS
  // ===========================================================================

  describe('getAlertStats', () => {
    it('should return comprehensive alert statistics', async () => {
      // Mock counts for different statuses
      mockPrisma.securityAlert.count
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(20) // active
        .mockResolvedValueOnce(10) // acknowledged
        .mockResolvedValueOnce(15) // resolved
        .mockResolvedValueOnce(5) // dismissed
        .mockResolvedValueOnce(8) // critical active
        .mockResolvedValueOnce(12); // high active

      // Mock groupBy for type statistics
      mockPrisma.securityAlert.groupBy.mockResolvedValue([
        { type: 'BRUTE_FORCE_DETECTED', _count: { id: 15 } },
        { type: 'ACCOUNT_LOCKED', _count: { id: 10 } },
        { type: 'SUSPICIOUS_LOGIN_LOCATION', _count: { id: 8 } },
      ]);

      const result = await securityEventsService.getAlertStats({});

      expect(result).toEqual(
        expect.objectContaining({
          totalCount: 50,
          activeCount: 20,
          acknowledgedCount: 10,
          resolvedCount: 15,
          dismissedCount: 5,
          criticalActiveCount: 8,
          highActiveCount: 12,
        }),
      );
    });

    it('should filter statistics by date range', async () => {
      const startDate = '2025-01-01T00:00:00.000Z';
      const endDate = '2025-01-31T23:59:59.999Z';

      mockPrisma.securityAlert.count.mockResolvedValue(10);
      mockPrisma.securityAlert.groupBy.mockResolvedValue([]);

      await securityEventsService.getAlertStats({ startDate, endDate });

      expect(mockPrisma.securityAlert.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
      });
    });

    it('should filter statistics by userId', async () => {
      mockPrisma.securityAlert.count.mockResolvedValue(5);
      mockPrisma.securityAlert.groupBy.mockResolvedValue([]);

      await securityEventsService.getAlertStats({ userId: USER_ID });

      expect(mockPrisma.securityAlert.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: USER_ID,
        }),
      });
    });

    it('should group statistics by type', async () => {
      mockPrisma.securityAlert.count.mockResolvedValue(30);
      mockPrisma.securityAlert.groupBy.mockResolvedValue([
        { type: 'BRUTE_FORCE_DETECTED', _count: { id: 15 } },
        { type: 'ACCOUNT_LOCKED', _count: { id: 10 } },
        { type: 'MFA_DISABLED', _count: { id: 5 } },
      ]);

      const result = await securityEventsService.getAlertStats({ groupBy: 'type' });

      expect(result.byType).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'BRUTE_FORCE_DETECTED', count: 15 }),
          expect.objectContaining({ type: 'ACCOUNT_LOCKED', count: 10 }),
          expect.objectContaining({ type: 'MFA_DISABLED', count: 5 }),
        ]),
      );
    });

    it('should group statistics by severity', async () => {
      mockPrisma.securityAlert.count.mockResolvedValue(30);
      mockPrisma.securityAlert.groupBy.mockResolvedValue([
        { severity: 'critical', _count: { id: 5 } },
        { severity: 'high', _count: { id: 10 } },
        { severity: 'medium', _count: { id: 10 } },
        { severity: 'low', _count: { id: 5 } },
      ]);

      const result = await securityEventsService.getAlertStats({ groupBy: 'severity' });

      expect(result.bySeverity).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ severity: 'critical', count: 5 }),
          expect.objectContaining({ severity: 'high', count: 10 }),
        ]),
      );
    });
  });

  // ===========================================================================
  // NOTIFICATION SUBSCRIPTIONS - CREATE
  // ===========================================================================

  describe('createNotificationSubscription', () => {
    it('should create a new notification subscription', async () => {
      mockPrisma.notificationSubscription.findFirst.mockResolvedValue(null);
      mockPrisma.notificationSubscription.create.mockResolvedValue(mockNotificationSubscription);

      const result = await securityEventsService.createNotificationSubscription(USER_ID, {
        channel: 'email',
        endpoint: 'jan.kowalski@example.com',
        eventTypes: ['BRUTE_FORCE_DETECTED', 'ACCOUNT_LOCKED'],
        severities: ['high', 'critical'],
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: SUBSCRIPTION_ID,
          channel: 'email',
          endpoint: 'jan.kowalski@example.com',
          eventTypes: ['BRUTE_FORCE_DETECTED', 'ACCOUNT_LOCKED'],
          isActive: true,
        }),
      );

      expect(mockPrisma.notificationSubscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: USER_ID,
          channel: 'email',
          endpoint: 'jan.kowalski@example.com',
          eventTypes: ['BRUTE_FORCE_DETECTED', 'ACCOUNT_LOCKED'],
        }),
      });
    });

    it('should throw error if subscription already exists for channel/endpoint', async () => {
      mockPrisma.notificationSubscription.findFirst.mockResolvedValue(mockNotificationSubscription);

      await expect(
        securityEventsService.createNotificationSubscription(USER_ID, {
          channel: 'email',
          endpoint: 'jan.kowalski@example.com',
          eventTypes: ['BRUTE_FORCE_DETECTED'],
        }),
      ).rejects.toThrow(TRPCError);
      await expect(
        securityEventsService.createNotificationSubscription(USER_ID, {
          channel: 'email',
          endpoint: 'jan.kowalski@example.com',
          eventTypes: ['BRUTE_FORCE_DETECTED'],
        }),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        message: expect.stringContaining('już istnieje'),
      });
    });

    it('should log audit event when creating subscription', async () => {
      mockPrisma.notificationSubscription.findFirst.mockResolvedValue(null);
      mockPrisma.notificationSubscription.create.mockResolvedValue(mockNotificationSubscription);

      await securityEventsService.createNotificationSubscription(USER_ID, {
        channel: 'email',
        endpoint: 'jan.kowalski@example.com',
        eventTypes: ['BRUTE_FORCE_DETECTED'],
      });

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'NOTIFICATION_SUBSCRIPTION_CREATED',
        }),
      });
    });
  });

  // ===========================================================================
  // NOTIFICATION SUBSCRIPTIONS - UPDATE
  // ===========================================================================

  describe('updateNotificationSubscription', () => {
    it('should update an existing notification subscription', async () => {
      const updatedSubscription = {
        ...mockNotificationSubscription,
        eventTypes: ['BRUTE_FORCE_DETECTED', 'ACCOUNT_LOCKED', 'MFA_DISABLED'],
        isActive: false,
      };

      mockPrisma.notificationSubscription.findUnique.mockResolvedValue(mockNotificationSubscription);
      mockPrisma.notificationSubscription.update.mockResolvedValue(updatedSubscription);

      const result = await securityEventsService.updateNotificationSubscription(USER_ID, {
        id: SUBSCRIPTION_ID,
        eventTypes: ['BRUTE_FORCE_DETECTED', 'ACCOUNT_LOCKED', 'MFA_DISABLED'],
        isActive: false,
      });

      expect(result.eventTypes).toContain('MFA_DISABLED');
      expect(result.isActive).toBe(false);

      expect(mockPrisma.notificationSubscription.update).toHaveBeenCalledWith({
        where: { id: SUBSCRIPTION_ID },
        data: expect.objectContaining({
          eventTypes: ['BRUTE_FORCE_DETECTED', 'ACCOUNT_LOCKED', 'MFA_DISABLED'],
          isActive: false,
        }),
      });
    });

    it('should throw NOT_FOUND when subscription does not exist', async () => {
      mockPrisma.notificationSubscription.findUnique.mockResolvedValue(null);

      await expect(
        securityEventsService.updateNotificationSubscription(USER_ID, {
          id: SUBSCRIPTION_ID,
          isActive: false,
        }),
      ).rejects.toThrow(TRPCError);
      await expect(
        securityEventsService.updateNotificationSubscription(USER_ID, {
          id: SUBSCRIPTION_ID,
          isActive: false,
        }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should throw FORBIDDEN when user does not own subscription', async () => {
      const otherUserSubscription = {
        ...mockNotificationSubscription,
        userId: 'other-user-id',
      };
      mockPrisma.notificationSubscription.findUnique.mockResolvedValue(otherUserSubscription);

      await expect(
        securityEventsService.updateNotificationSubscription(USER_ID, {
          id: SUBSCRIPTION_ID,
          isActive: false,
        }),
      ).rejects.toThrow(TRPCError);
      await expect(
        securityEventsService.updateNotificationSubscription(USER_ID, {
          id: SUBSCRIPTION_ID,
          isActive: false,
        }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });
  });

  // ===========================================================================
  // NOTIFICATION SUBSCRIPTIONS - DELETE
  // ===========================================================================

  describe('deleteNotificationSubscription', () => {
    it('should delete a notification subscription', async () => {
      mockPrisma.notificationSubscription.findUnique.mockResolvedValue(mockNotificationSubscription);
      mockPrisma.notificationSubscription.delete.mockResolvedValue(mockNotificationSubscription);

      const result = await securityEventsService.deleteNotificationSubscription(
        USER_ID,
        SUBSCRIPTION_ID,
      );

      expect(result).toEqual({ success: true });

      expect(mockPrisma.notificationSubscription.delete).toHaveBeenCalledWith({
        where: { id: SUBSCRIPTION_ID },
      });
    });

    it('should throw NOT_FOUND when subscription does not exist', async () => {
      mockPrisma.notificationSubscription.findUnique.mockResolvedValue(null);

      await expect(
        securityEventsService.deleteNotificationSubscription(USER_ID, SUBSCRIPTION_ID),
      ).rejects.toThrow(TRPCError);
      await expect(
        securityEventsService.deleteNotificationSubscription(USER_ID, SUBSCRIPTION_ID),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should throw FORBIDDEN when user does not own subscription', async () => {
      const otherUserSubscription = {
        ...mockNotificationSubscription,
        userId: 'other-user-id',
      };
      mockPrisma.notificationSubscription.findUnique.mockResolvedValue(otherUserSubscription);

      await expect(
        securityEventsService.deleteNotificationSubscription(USER_ID, SUBSCRIPTION_ID),
      ).rejects.toThrow(TRPCError);
      await expect(
        securityEventsService.deleteNotificationSubscription(USER_ID, SUBSCRIPTION_ID),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('should log audit event when deleting subscription', async () => {
      mockPrisma.notificationSubscription.findUnique.mockResolvedValue(mockNotificationSubscription);
      mockPrisma.notificationSubscription.delete.mockResolvedValue(mockNotificationSubscription);

      await securityEventsService.deleteNotificationSubscription(USER_ID, SUBSCRIPTION_ID);

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'NOTIFICATION_SUBSCRIPTION_DELETED',
        }),
      });
    });
  });

  // ===========================================================================
  // NOTIFICATION SUBSCRIPTIONS - LIST
  // ===========================================================================

  describe('listNotificationSubscriptions', () => {
    it('should list all user notification subscriptions', async () => {
      mockPrisma.notificationSubscription.findMany.mockResolvedValue([mockNotificationSubscription]);

      const result = await securityEventsService.listNotificationSubscriptions(USER_ID, {});

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: SUBSCRIPTION_ID,
          channel: 'email',
          isActive: true,
        }),
      );

      expect(mockPrisma.notificationSubscription.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter subscriptions by channel', async () => {
      mockPrisma.notificationSubscription.findMany.mockResolvedValue([mockNotificationSubscription]);

      await securityEventsService.listNotificationSubscriptions(USER_ID, {
        channel: 'email',
      });

      expect(mockPrisma.notificationSubscription.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, channel: 'email' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter subscriptions by active status', async () => {
      mockPrisma.notificationSubscription.findMany.mockResolvedValue([mockNotificationSubscription]);

      await securityEventsService.listNotificationSubscriptions(USER_ID, {
        isActive: true,
      });

      expect(mockPrisma.notificationSubscription.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no subscriptions exist', async () => {
      mockPrisma.notificationSubscription.findMany.mockResolvedValue([]);

      const result = await securityEventsService.listNotificationSubscriptions(USER_ID, {});

      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // DASHBOARD SUMMARY
  // ===========================================================================

  describe('getDashboardSummary', () => {
    it('should return dashboard summary with key metrics', async () => {
      const now = new Date('2025-01-15T12:00:00.000Z');
      const last24h = new Date('2025-01-14T12:00:00.000Z');
      const last7d = new Date('2025-01-08T12:00:00.000Z');

      // Mock active alerts count
      mockPrisma.securityAlert.count
        .mockResolvedValueOnce(15) // active
        .mockResolvedValueOnce(5) // critical
        .mockResolvedValueOnce(8) // high
        .mockResolvedValueOnce(25) // last 24h
        .mockResolvedValueOnce(100); // last 7d

      // Mock top alert types
      mockPrisma.securityAlert.groupBy.mockResolvedValue([
        { type: 'BRUTE_FORCE_DETECTED', _count: { id: 30 } },
        { type: 'ACCOUNT_LOCKED', _count: { id: 20 } },
        { type: 'SUSPICIOUS_LOGIN_LOCATION', _count: { id: 15 } },
      ]);

      // Mock recent alerts
      mockPrisma.securityAlert.findMany.mockResolvedValue([
        {
          ...mockSecurityAlertWithUser,
          createdAt: new Date('2025-01-15T11:30:00.000Z'),
        },
      ]);

      const result = await securityEventsService.getDashboardSummary();

      expect(result).toEqual(
        expect.objectContaining({
          activeAlerts: 15,
          criticalAlerts: 5,
          highAlerts: 8,
          alertsLast24h: 25,
          alertsLast7d: 100,
          topAlertTypes: expect.arrayContaining([
            expect.objectContaining({ type: 'BRUTE_FORCE_DETECTED', count: 30 }),
          ]),
          recentAlerts: expect.arrayContaining([
            expect.objectContaining({ id: ALERT_ID }),
          ]),
          generatedAt: expect.any(String),
        }),
      );
    });

    it('should use cached dashboard summary when available', async () => {
      const cachedSummary = {
        activeAlerts: 10,
        criticalAlerts: 2,
        highAlerts: 5,
        alertsLast24h: 20,
        alertsLast7d: 80,
        topAlertTypes: [{ type: 'BRUTE_FORCE_DETECTED', count: 25 }],
        recentAlerts: [],
        generatedAt: '2025-01-15T11:55:00.000Z',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedSummary));

      const result = await securityEventsService.getDashboardSummary();

      expect(result).toEqual(cachedSummary);
      expect(mockPrisma.securityAlert.count).not.toHaveBeenCalled();
    });

    it('should cache dashboard summary after generation', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.securityAlert.count.mockResolvedValue(10);
      mockPrisma.securityAlert.groupBy.mockResolvedValue([]);
      mockPrisma.securityAlert.findMany.mockResolvedValue([]);

      await securityEventsService.getDashboardSummary();

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'security:dashboard:summary',
        60, // 1 minute cache
        expect.any(String),
      );
    });
  });

  // ===========================================================================
  // CREATE ALERT (Internal use)
  // ===========================================================================

  describe('createAlert', () => {
    it('should create a new security alert', async () => {
      mockPrisma.securityAlert.create.mockResolvedValue(mockSecurityAlert);

      const result = await securityEventsService.createAlert({
        userId: USER_ID,
        type: 'BRUTE_FORCE_DETECTED',
        severity: 'high',
        title: 'Wykryto atak brute force',
        description: 'Zarejestrowano 10 nieudanych prób logowania',
        metadata: { failedAttempts: 10 },
        ipAddress: '192.168.1.100',
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: ALERT_ID,
          type: 'BRUTE_FORCE_DETECTED',
          severity: 'high',
        }),
      );

      expect(mockPrisma.securityAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: USER_ID,
          type: 'BRUTE_FORCE_DETECTED',
          severity: 'high',
          title: 'Wykryto atak brute force',
          description: 'Zarejestrowano 10 nieudanych prób logowania',
          status: 'active',
        }),
      });
    });

    it('should invalidate dashboard cache when creating alert', async () => {
      mockPrisma.securityAlert.create.mockResolvedValue(mockSecurityAlert);

      await securityEventsService.createAlert({
        userId: USER_ID,
        type: 'BRUTE_FORCE_DETECTED',
        severity: 'high',
        title: 'Wykryto atak brute force',
        description: 'Test',
      });

      expect(mockRedis.del).toHaveBeenCalledWith('security:dashboard:summary');
    });

    it('should log audit event when creating alert', async () => {
      mockPrisma.securityAlert.create.mockResolvedValue(mockSecurityAlert);

      await securityEventsService.createAlert({
        userId: USER_ID,
        type: 'BRUTE_FORCE_DETECTED',
        severity: 'high',
        title: 'Wykryto atak brute force',
        description: 'Test',
      });

      expect(mockPrisma.authAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'SECURITY_ALERT_CREATED',
          metadata: expect.objectContaining({
            alertType: 'BRUTE_FORCE_DETECTED',
            severity: 'high',
          }),
        }),
      });
    });
  });
});
