import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createContext } from '../../context';
import { appRouter } from '../../index';

// ==========================================================================
// MOCKS - Use vi.hoisted() to ensure mocks are available when vi.mock runs
// ==========================================================================

const mockSecurityEventsServiceMethods = vi.hoisted(() => ({
  listAlerts: vi.fn(),
  getAlert: vi.fn(),
  acknowledgeAlert: vi.fn(),
  resolveAlert: vi.fn(),
  dismissAlert: vi.fn(),
  getAlertStats: vi.fn(),
  createNotificationSubscription: vi.fn(),
  updateNotificationSubscription: vi.fn(),
  deleteNotificationSubscription: vi.fn(),
  listNotificationSubscriptions: vi.fn(),
  getDashboardSummary: vi.fn(),
  createAlert: vi.fn(),
}));

// Mock SecurityEventsService module
vi.mock('../../services/aim/security-events.service', () => ({
  SecurityEventsService: vi.fn(() => mockSecurityEventsServiceMethods),
}));

// Mock @ksiegowacrm/auth
vi.mock('@ksiegowacrm/auth', () => ({
  Argon2Service: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockResolvedValue(true),
  })),
  argon2Service: {
    verify: vi.fn().mockResolvedValue(true),
  },
  TotpService: vi.fn().mockImplementation(() => ({
    verifyToken: vi.fn(),
    verifyBackupCode: vi.fn(),
    generateBackupCodes: vi.fn(),
    hashBackupCode: vi.fn(),
  })),
  totpService: {
    verifyToken: vi.fn(),
    verifyBackupCode: vi.fn(),
    generateBackupCodes: vi.fn(),
    hashBackupCode: vi.fn(),
  },
}));

// Alias for cleaner access in tests
const mocks = {
  listAlerts: mockSecurityEventsServiceMethods.listAlerts,
  getAlert: mockSecurityEventsServiceMethods.getAlert,
  acknowledgeAlert: mockSecurityEventsServiceMethods.acknowledgeAlert,
  resolveAlert: mockSecurityEventsServiceMethods.resolveAlert,
  dismissAlert: mockSecurityEventsServiceMethods.dismissAlert,
  getAlertStats: mockSecurityEventsServiceMethods.getAlertStats,
  createNotificationSubscription: mockSecurityEventsServiceMethods.createNotificationSubscription,
  updateNotificationSubscription: mockSecurityEventsServiceMethods.updateNotificationSubscription,
  deleteNotificationSubscription: mockSecurityEventsServiceMethods.deleteNotificationSubscription,
  listNotificationSubscriptions: mockSecurityEventsServiceMethods.listNotificationSubscriptions,
  getDashboardSummary: mockSecurityEventsServiceMethods.getDashboardSummary,
  createAlert: mockSecurityEventsServiceMethods.createAlert,
};

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  securityAlert: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    groupBy: vi.fn(),
  },
  notificationSubscription: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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
  exists: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  keys: vi.fn(),
  pipeline: vi.fn(() => ({
    del: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
};

// ==========================================================================
// TEST SUITE
// ==========================================================================

describe('SecurityEventsRouter', () => {
  let userCaller: ReturnType<typeof appRouter.createCaller>;
  let adminCaller: ReturnType<typeof appRouter.createCaller>;

  // UUIDs
  const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const ADMIN_ID = '550e8400-e29b-41d4-a716-446655440001';
  const ALERT_ID = '550e8400-e29b-41d4-a716-446655440010';
  const SUBSCRIPTION_ID = '550e8400-e29b-41d4-a716-446655440020';
  const NON_EXISTENT_ID = '550e8400-e29b-41d4-a716-446655449999';
  const SESSION_ID = '550e8400-e29b-41d4-a716-446655440030';
  const ORG_ID = '550e8400-e29b-41d4-a716-446655440040';

  const mockUser = {
    id: USER_ID,
    email: 'jan.kowalski@example.com',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$hashedpassword',
    status: 'ACTIVE',
    isEmailVerified: true,
  };

  const mockSecurityAlert = {
    id: ALERT_ID,
    userId: USER_ID,
    type: 'BRUTE_FORCE_DETECTED',
    severity: 'high',
    status: 'active',
    title: 'Wykryto atak brute-force',
    description: 'Wykryto 10 nieudanych prób logowania z adresu IP 192.168.1.100',
    metadata: { failedAttempts: 10, ipAddress: '192.168.1.100' },
    ipAddress: '192.168.1.100',
    resolvedAt: null,
    resolvedBy: null,
    createdAt: '2025-01-15T10:00:00.000Z',
    user: { id: USER_ID, email: 'jan.kowalski@example.com' },
    escalations: [],
  };

  const mockPaginatedAlerts = {
    items: [mockSecurityAlert],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  };

  const mockAlertUpdateResult = {
    success: true,
    alert: { ...mockSecurityAlert, status: 'acknowledged' },
    message: 'Alert został potwierdzony',
  };

  const mockAlertStats = {
    totalCount: 50,
    activeCount: 20,
    acknowledgedCount: 10,
    resolvedCount: 15,
    dismissedCount: 5,
    criticalActiveCount: 8,
    highActiveCount: 12,
    byType: [
      { type: 'BRUTE_FORCE_DETECTED', count: 15, activeCount: 5, resolvedCount: 10 },
      { type: 'ACCOUNT_LOCKED', count: 10, activeCount: 5, resolvedCount: 5 },
    ],
    bySeverity: [
      { severity: 'critical', count: 8, activeCount: 8 },
      { severity: 'high', count: 12, activeCount: 12 },
    ],
  };

  const mockNotificationSubscription = {
    id: SUBSCRIPTION_ID,
    userId: USER_ID,
    channel: 'email',
    endpoint: 'jan.kowalski@example.com',
    eventTypes: ['BRUTE_FORCE_DETECTED', 'ACCOUNT_LOCKED'],
    severities: ['high', 'critical'],
    isActive: true,
    createdAt: '2025-01-15T10:00:00.000Z',
    updatedAt: '2025-01-15T10:00:00.000Z',
  };

  const mockDashboardSummary = {
    activeAlerts: 15,
    criticalAlerts: 5,
    highAlerts: 8,
    alertsLast24h: 25,
    alertsLast7d: 100,
    topAlertTypes: [
      { type: 'BRUTE_FORCE_DETECTED', count: 30 },
      { type: 'ACCOUNT_LOCKED', count: 20 },
      { type: 'SUSPICIOUS_LOGIN_LOCATION', count: 15 },
    ],
    recentAlerts: [mockSecurityAlert],
    generatedAt: '2025-01-15T12:00:00.000Z',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    vi.clearAllMocks();

    // Default mocks for Redis
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.keys.mockResolvedValue([]);

    // Default mocks for Prisma
    mockPrisma.authAuditLog.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    // Default mocks for SecurityEventsService methods
    mocks.listAlerts.mockResolvedValue(mockPaginatedAlerts);
    mocks.getAlert.mockResolvedValue(mockSecurityAlert);
    mocks.acknowledgeAlert.mockResolvedValue(mockAlertUpdateResult);
    mocks.resolveAlert.mockResolvedValue({
      ...mockAlertUpdateResult,
      alert: { ...mockSecurityAlert, status: 'resolved' },
      message: 'Alert został rozwiązany',
    });
    mocks.dismissAlert.mockResolvedValue({
      ...mockAlertUpdateResult,
      alert: { ...mockSecurityAlert, status: 'dismissed' },
      message: 'Alert został odrzucony',
    });
    mocks.getAlertStats.mockResolvedValue(mockAlertStats);
    mocks.createNotificationSubscription.mockResolvedValue(mockNotificationSubscription);
    mocks.updateNotificationSubscription.mockResolvedValue(mockNotificationSubscription);
    mocks.deleteNotificationSubscription.mockResolvedValue({ success: true });
    mocks.listNotificationSubscriptions.mockResolvedValue([mockNotificationSubscription]);
    mocks.getDashboardSummary.mockResolvedValue(mockDashboardSummary);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // CONTEXT HELPERS
  // ==========================================================================

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
        url: '/api/trpc/aim.securityAlerts',
        method: 'POST',
      } as any,
      res: {} as any,
    });

    return {
      ...ctx,
      session: {
        sessionId: SESSION_ID,
        userId: USER_ID,
        email: 'jan.kowalski@example.com',
        roles: ['USER'],
        organizationId: ORG_ID,
      },
    };
  }

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
        url: '/api/trpc/aim.securityAlerts',
        method: 'POST',
      } as any,
      res: {} as any,
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

  function createUnauthenticatedContext() {
    return createContext({
      prisma: mockPrisma as any,
      redis: mockRedis as any,
      req: {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Agent',
        },
        url: '/api/trpc/aim.securityAlerts',
        method: 'POST',
      } as any,
      res: {} as any,
    });
  }

  // ==========================================================================
  // AUTHENTICATION TESTS
  // ==========================================================================

  describe('Authentication', () => {
    it('should require authentication for listAlerts', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(unauthCaller.aim.securityAlerts.listAlerts({})).rejects.toThrow();
    });

    it('should require authentication for getAlert', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(unauthCaller.aim.securityAlerts.getAlert({ id: ALERT_ID })).rejects.toThrow();
    });

    it('should require authentication for acknowledgeAlert', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(unauthCaller.aim.securityAlerts.acknowledgeAlert({ id: ALERT_ID })).rejects.toThrow();
    });

    it('should require authentication for resolveAlert', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.aim.securityAlerts.resolveAlert({
          id: ALERT_ID,
          resolution: 'Problem rozwiązany',
        }),
      ).rejects.toThrow();
    });

    it('should require authentication for dismissAlert', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.aim.securityAlerts.dismissAlert({
          id: ALERT_ID,
          reason: 'Fałszywy alarm',
        }),
      ).rejects.toThrow();
    });

    it('should require authentication for getStats', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(unauthCaller.aim.securityAlerts.getStats({})).rejects.toThrow();
    });

    it('should require authentication for getDashboardSummary', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(unauthCaller.aim.securityAlerts.getDashboardSummary()).rejects.toThrow();
    });

    it('should require authentication for createNotificationSubscription', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.aim.securityAlerts.createNotificationSubscription({
          channel: 'email',
          endpoint: 'test@example.com',
          eventTypes: ['BRUTE_FORCE_DETECTED'],
        }),
      ).rejects.toThrow();
    });

    it('should require authentication for updateNotificationSubscription', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.aim.securityAlerts.updateNotificationSubscription({
          id: SUBSCRIPTION_ID,
          isActive: false,
        }),
      ).rejects.toThrow();
    });

    it('should require authentication for deleteNotificationSubscription', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        unauthCaller.aim.securityAlerts.deleteNotificationSubscription({ id: SUBSCRIPTION_ID }),
      ).rejects.toThrow();
    });

    it('should require authentication for listNotificationSubscriptions', async () => {
      const unauthCaller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(unauthCaller.aim.securityAlerts.listNotificationSubscriptions({})).rejects.toThrow();
    });
  });

  // ==========================================================================
  // LIST ALERTS TESTS
  // ==========================================================================

  describe('listAlerts', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should list security alerts with default pagination', async () => {
      const result = await adminCaller.aim.securityAlerts.listAlerts({});

      expect(result).toEqual(mockPaginatedAlerts);
      expect(mocks.listAlerts).toHaveBeenCalled();
    });

    it('should list alerts with custom pagination', async () => {
      await adminCaller.aim.securityAlerts.listAlerts({
        pagination: { page: 2, limit: 10 },
      });

      expect(mocks.listAlerts).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({ page: 2, limit: 10 }),
        }),
      );
    });

    it('should filter alerts by type', async () => {
      await adminCaller.aim.securityAlerts.listAlerts({
        filter: { types: ['BRUTE_FORCE_DETECTED', 'ACCOUNT_LOCKED'] },
      });

      expect(mocks.listAlerts).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            types: ['BRUTE_FORCE_DETECTED', 'ACCOUNT_LOCKED'],
          }),
        }),
      );
    });

    it('should filter alerts by severity', async () => {
      await adminCaller.aim.securityAlerts.listAlerts({
        filter: { severities: ['high', 'critical'] },
      });

      expect(mocks.listAlerts).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            severities: ['high', 'critical'],
          }),
        }),
      );
    });

    it('should filter alerts by status', async () => {
      await adminCaller.aim.securityAlerts.listAlerts({
        filter: { statuses: ['active', 'acknowledged'] },
      });

      expect(mocks.listAlerts).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            statuses: ['active', 'acknowledged'],
          }),
        }),
      );
    });

    it('should filter alerts by date range', async () => {
      const startDate = '2025-01-01T00:00:00.000Z';
      const endDate = '2025-01-31T23:59:59.999Z';

      await adminCaller.aim.securityAlerts.listAlerts({
        filter: { startDate, endDate },
      });

      expect(mocks.listAlerts).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({ startDate, endDate }),
        }),
      );
    });

    it('should filter alerts by userId', async () => {
      await adminCaller.aim.securityAlerts.listAlerts({
        filter: { userId: USER_ID },
      });

      expect(mocks.listAlerts).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({ userId: USER_ID }),
        }),
      );
    });

    it('should search alerts by searchTerm', async () => {
      await adminCaller.aim.securityAlerts.listAlerts({
        filter: { searchTerm: 'brute force' },
      });

      expect(mocks.listAlerts).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({ searchTerm: 'brute force' }),
        }),
      );
    });

    it('should return empty list when no alerts exist', async () => {
      mocks.listAlerts.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      });

      const result = await adminCaller.aim.securityAlerts.listAlerts({});

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ==========================================================================
  // GET ALERT TESTS
  // ==========================================================================

  describe('getAlert', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should get a single alert by ID', async () => {
      const result = await adminCaller.aim.securityAlerts.getAlert({ id: ALERT_ID });

      expect(result).toEqual(mockSecurityAlert);
      expect(mocks.getAlert).toHaveBeenCalledWith(ALERT_ID);
    });

    it('should throw error when alert not found', async () => {
      mocks.getAlert.mockRejectedValue(
        new TRPCError({
          code: 'NOT_FOUND',
          message: 'Alert nie został znaleziony',
        }),
      );

      await expect(
        adminCaller.aim.securityAlerts.getAlert({ id: 'non-existent-id' }),
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // ACKNOWLEDGE ALERT TESTS
  // ==========================================================================

  describe('acknowledgeAlert', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should acknowledge an alert', async () => {
      const result = await adminCaller.aim.securityAlerts.acknowledgeAlert({ id: ALERT_ID });

      expect(result.success).toBe(true);
      expect(result.alert.status).toBe('acknowledged');
      expect(mocks.acknowledgeAlert).toHaveBeenCalledWith(ALERT_ID, ADMIN_ID, expect.any(Object));
    });

    it('should acknowledge alert with notes', async () => {
      await adminCaller.aim.securityAlerts.acknowledgeAlert({
        id: ALERT_ID,
        notes: 'Sprawdzam ten alert',
      });

      expect(mocks.acknowledgeAlert).toHaveBeenCalledWith(
        ALERT_ID,
        ADMIN_ID,
        expect.objectContaining({ notes: 'Sprawdzam ten alert' }),
      );
    });

    it('should throw error when alert is already acknowledged', async () => {
      mocks.acknowledgeAlert.mockRejectedValue(
        new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Alert jest już potwierdzony',
        }),
      );

      await expect(
        adminCaller.aim.securityAlerts.acknowledgeAlert({ id: ALERT_ID }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });
  });

  // ==========================================================================
  // RESOLVE ALERT TESTS
  // ==========================================================================

  describe('resolveAlert', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should resolve an alert with resolution details', async () => {
      const result = await adminCaller.aim.securityAlerts.resolveAlert({
        id: ALERT_ID,
        resolution: 'Problem rozwiązany poprzez blokadę IP',
      });

      expect(result.success).toBe(true);
      expect(result.alert.status).toBe('resolved');
      expect(mocks.resolveAlert).toHaveBeenCalledWith(
        ALERT_ID,
        ADMIN_ID,
        expect.objectContaining({
          resolution: 'Problem rozwiązany poprzez blokadę IP',
        }),
      );
    });

    it('should resolve alert with prevention actions', async () => {
      await adminCaller.aim.securityAlerts.resolveAlert({
        id: ALERT_ID,
        resolution: 'Problem rozwiązany',
        preventionActions: ['Dodano IP do listy blokowanych', 'Włączono MFA dla użytkownika'],
      });

      expect(mocks.resolveAlert).toHaveBeenCalledWith(
        ALERT_ID,
        ADMIN_ID,
        expect.objectContaining({
          resolution: 'Problem rozwiązany',
          preventionActions: ['Dodano IP do listy blokowanych', 'Włączono MFA dla użytkownika'],
        }),
      );
    });

    it('should throw error when alert is already resolved', async () => {
      mocks.resolveAlert.mockRejectedValue(
        new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Alertu nie można rozwiązać',
        }),
      );

      await expect(
        adminCaller.aim.securityAlerts.resolveAlert({
          id: ALERT_ID,
          resolution: 'Problem rozwiązany',
        }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });
  });

  // ==========================================================================
  // DISMISS ALERT TESTS
  // ==========================================================================

  describe('dismissAlert', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should dismiss an alert with reason', async () => {
      const result = await adminCaller.aim.securityAlerts.dismissAlert({
        id: ALERT_ID,
        reason: 'Fałszywy alarm - test bezpieczeństwa',
      });

      expect(result.success).toBe(true);
      expect(result.alert.status).toBe('dismissed');
      expect(mocks.dismissAlert).toHaveBeenCalledWith(
        ALERT_ID,
        ADMIN_ID,
        expect.objectContaining({
          reason: 'Fałszywy alarm - test bezpieczeństwa',
        }),
      );
    });

    it('should dismiss alert marking as false positive', async () => {
      await adminCaller.aim.securityAlerts.dismissAlert({
        id: ALERT_ID,
        reason: 'Fałszywy alarm',
        falsePositive: true,
      });

      expect(mocks.dismissAlert).toHaveBeenCalledWith(
        ALERT_ID,
        ADMIN_ID,
        expect.objectContaining({
          reason: 'Fałszywy alarm',
          falsePositive: true,
        }),
      );
    });

    it('should throw error when alert is already dismissed', async () => {
      mocks.dismissAlert.mockRejectedValue(
        new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Alert jest już odrzucony',
        }),
      );

      await expect(
        adminCaller.aim.securityAlerts.dismissAlert({
          id: ALERT_ID,
          reason: 'Fałszywy alarm',
        }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });
  });

  // ==========================================================================
  // GET STATS TESTS
  // ==========================================================================

  describe('getStats', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should return alert statistics', async () => {
      const result = await adminCaller.aim.securityAlerts.getStats({});

      expect(result).toEqual(mockAlertStats);
      expect(mocks.getAlertStats).toHaveBeenCalled();
    });

    it('should filter stats by date range', async () => {
      const startDate = '2025-01-01T00:00:00.000Z';
      const endDate = '2025-01-31T23:59:59.999Z';

      await adminCaller.aim.securityAlerts.getStats({ startDate, endDate });

      expect(mocks.getAlertStats).toHaveBeenCalledWith(
        expect.objectContaining({ startDate, endDate }),
      );
    });

    it('should group stats by type', async () => {
      await adminCaller.aim.securityAlerts.getStats({ groupBy: 'type' });

      expect(mocks.getAlertStats).toHaveBeenCalledWith(
        expect.objectContaining({ groupBy: 'type' }),
      );
    });

    it('should group stats by severity', async () => {
      await adminCaller.aim.securityAlerts.getStats({ groupBy: 'severity' });

      expect(mocks.getAlertStats).toHaveBeenCalledWith(
        expect.objectContaining({ groupBy: 'severity' }),
      );
    });

    it('should filter stats by userId', async () => {
      await adminCaller.aim.securityAlerts.getStats({ userId: USER_ID });

      expect(mocks.getAlertStats).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID }),
      );
    });
  });

  // ==========================================================================
  // GET DASHBOARD SUMMARY TESTS
  // ==========================================================================

  describe('getDashboardSummary', () => {
    beforeEach(() => {
      adminCaller = appRouter.createCaller(createAdminContext());
    });

    it('should return dashboard summary', async () => {
      const result = await adminCaller.aim.securityAlerts.getDashboardSummary();

      expect(result).toEqual(mockDashboardSummary);
      expect(mocks.getDashboardSummary).toHaveBeenCalled();
    });

    it('should return dashboard with key metrics', async () => {
      const result = await adminCaller.aim.securityAlerts.getDashboardSummary();

      expect(result.activeAlerts).toBeDefined();
      expect(result.criticalAlerts).toBeDefined();
      expect(result.highAlerts).toBeDefined();
      expect(result.alertsLast24h).toBeDefined();
      expect(result.alertsLast7d).toBeDefined();
      expect(result.topAlertTypes).toBeDefined();
      expect(result.recentAlerts).toBeDefined();
    });
  });

  // ==========================================================================
  // CREATE NOTIFICATION SUBSCRIPTION TESTS
  // ==========================================================================

  describe('createNotificationSubscription', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should create a new notification subscription', async () => {
      const result = await userCaller.aim.securityAlerts.createNotificationSubscription({
        channel: 'email',
        endpoint: 'jan.kowalski@example.com',
        eventTypes: ['BRUTE_FORCE_DETECTED', 'ACCOUNT_LOCKED'],
        severities: ['high', 'critical'],
      });

      expect(result).toEqual(mockNotificationSubscription);
      expect(mocks.createNotificationSubscription).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({
          channel: 'email',
          endpoint: 'jan.kowalski@example.com',
          eventTypes: ['BRUTE_FORCE_DETECTED', 'ACCOUNT_LOCKED'],
          severities: ['high', 'critical'],
        }),
      );
    });

    it('should create subscription without severity filter', async () => {
      await userCaller.aim.securityAlerts.createNotificationSubscription({
        channel: 'slack',
        endpoint: 'https://hooks.slack.com/services/xxx',
        eventTypes: ['BRUTE_FORCE_DETECTED'],
      });

      expect(mocks.createNotificationSubscription).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({
          channel: 'slack',
          endpoint: 'https://hooks.slack.com/services/xxx',
          eventTypes: ['BRUTE_FORCE_DETECTED'],
        }),
      );
    });

    it('should throw error when subscription already exists', async () => {
      mocks.createNotificationSubscription.mockRejectedValue(
        new TRPCError({
          code: 'CONFLICT',
          message: 'Subskrypcja dla tego kanału i endpointu już istnieje',
        }),
      );

      await expect(
        userCaller.aim.securityAlerts.createNotificationSubscription({
          channel: 'email',
          endpoint: 'jan.kowalski@example.com',
          eventTypes: ['BRUTE_FORCE_DETECTED'],
        }),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });
  });

  // ==========================================================================
  // UPDATE NOTIFICATION SUBSCRIPTION TESTS
  // ==========================================================================

  describe('updateNotificationSubscription', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should update notification subscription event types', async () => {
      const result = await userCaller.aim.securityAlerts.updateNotificationSubscription({
        id: SUBSCRIPTION_ID,
        eventTypes: ['BRUTE_FORCE_DETECTED', 'ACCOUNT_LOCKED', 'MFA_DISABLED'],
      });

      expect(result).toEqual(mockNotificationSubscription);
      expect(mocks.updateNotificationSubscription).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({
          id: SUBSCRIPTION_ID,
          eventTypes: ['BRUTE_FORCE_DETECTED', 'ACCOUNT_LOCKED', 'MFA_DISABLED'],
        }),
      );
    });

    it('should update notification subscription active status', async () => {
      await userCaller.aim.securityAlerts.updateNotificationSubscription({
        id: SUBSCRIPTION_ID,
        isActive: false,
      });

      expect(mocks.updateNotificationSubscription).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({
          id: SUBSCRIPTION_ID,
          isActive: false,
        }),
      );
    });

    it('should update notification subscription severities', async () => {
      await userCaller.aim.securityAlerts.updateNotificationSubscription({
        id: SUBSCRIPTION_ID,
        severities: ['critical'],
      });

      expect(mocks.updateNotificationSubscription).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({
          id: SUBSCRIPTION_ID,
          severities: ['critical'],
        }),
      );
    });

    it('should throw error when subscription not found', async () => {
      mocks.updateNotificationSubscription.mockRejectedValue(
        new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subskrypcja nie została znaleziona',
        }),
      );

      await expect(
        userCaller.aim.securityAlerts.updateNotificationSubscription({
          id: NON_EXISTENT_ID,
          isActive: false,
        }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should throw error when user does not own subscription', async () => {
      mocks.updateNotificationSubscription.mockRejectedValue(
        new TRPCError({
          code: 'FORBIDDEN',
          message: 'Brak uprawnień do modyfikacji tej subskrypcji',
        }),
      );

      await expect(
        userCaller.aim.securityAlerts.updateNotificationSubscription({
          id: SUBSCRIPTION_ID,
          isActive: false,
        }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });
  });

  // ==========================================================================
  // DELETE NOTIFICATION SUBSCRIPTION TESTS
  // ==========================================================================

  describe('deleteNotificationSubscription', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should delete a notification subscription', async () => {
      const result = await userCaller.aim.securityAlerts.deleteNotificationSubscription({
        id: SUBSCRIPTION_ID,
      });

      expect(result).toEqual({ success: true });
      expect(mocks.deleteNotificationSubscription).toHaveBeenCalledWith(USER_ID, SUBSCRIPTION_ID);
    });

    it('should throw error when subscription not found', async () => {
      mocks.deleteNotificationSubscription.mockRejectedValue(
        new TRPCError({
          code: 'NOT_FOUND',
          message: 'Subskrypcja nie została znaleziona',
        }),
      );

      await expect(
        userCaller.aim.securityAlerts.deleteNotificationSubscription({ id: NON_EXISTENT_ID }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should throw error when user does not own subscription', async () => {
      mocks.deleteNotificationSubscription.mockRejectedValue(
        new TRPCError({
          code: 'FORBIDDEN',
          message: 'Brak uprawnień do usunięcia tej subskrypcji',
        }),
      );

      await expect(
        userCaller.aim.securityAlerts.deleteNotificationSubscription({ id: SUBSCRIPTION_ID }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });
  });

  // ==========================================================================
  // LIST NOTIFICATION SUBSCRIPTIONS TESTS
  // ==========================================================================

  describe('listNotificationSubscriptions', () => {
    beforeEach(() => {
      userCaller = appRouter.createCaller(createUserContext());
    });

    it('should list all user notification subscriptions', async () => {
      const result = await userCaller.aim.securityAlerts.listNotificationSubscriptions({});

      expect(result).toEqual([mockNotificationSubscription]);
      expect(mocks.listNotificationSubscriptions).toHaveBeenCalledWith(USER_ID, expect.any(Object));
    });

    it('should filter subscriptions by channel', async () => {
      await userCaller.aim.securityAlerts.listNotificationSubscriptions({
        channel: 'email',
      });

      expect(mocks.listNotificationSubscriptions).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ channel: 'email' }),
      );
    });

    it('should filter subscriptions by active status', async () => {
      await userCaller.aim.securityAlerts.listNotificationSubscriptions({
        isActive: true,
      });

      expect(mocks.listNotificationSubscriptions).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ isActive: true }),
      );
    });

    it('should return empty list when no subscriptions exist', async () => {
      mocks.listNotificationSubscriptions.mockResolvedValue([]);

      const result = await userCaller.aim.securityAlerts.listNotificationSubscriptions({});

      expect(result).toEqual([]);
    });
  });
});
