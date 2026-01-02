import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '../../index';

// Test constants
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = '22222222-2222-2222-2222-222222222222';
const CLIENT_ID_1 = '33333333-3333-3333-3333-333333333333';

// Mock results
const mockOverview = {
  totalClients: 100,
  activeClients: 80,
  archivedClients: 5,
  byType: { company: 60, individual: 40 },
  byStatus: { active: 80, inactive: 15, suspended: 3, pending: 2 },
  newClientsThisPeriod: 10,
  newClientsChange: 25,
  period: 'month' as const,
  periodStart: new Date('2024-01-01'),
  periodEnd: new Date('2024-01-31'),
};

const mockGrowth = {
  dataPoints: [
    {
      date: new Date('2024-01-01'),
      totalClients: 90,
      newClients: 5,
      archivedClients: 1,
      netGrowth: 4,
    },
    {
      date: new Date('2024-02-01'),
      totalClients: 95,
      newClients: 6,
      archivedClients: 1,
      netGrowth: 5,
    },
  ],
  totalGrowth: 10,
  averageGrowthRate: 5.5,
  period: 'month' as const,
};

const mockTagStats = {
  tags: [
    { tag: 'vip', count: 20, percentage: 20 },
    { tag: 'priority', count: 15, percentage: 15 },
  ],
  totalTaggedClients: 35,
  totalUntaggedClients: 65,
  averageTagsPerClient: 1.5,
};

const mockRiskDistribution = {
  distribution: [
    { level: 'low' as const, count: 40, percentage: 40 },
    { level: 'medium' as const, count: 30, percentage: 30 },
    { level: 'high' as const, count: 15, percentage: 15 },
    { level: 'critical' as const, count: 5, percentage: 5 },
    { level: 'not_assessed' as const, count: 10, percentage: 10 },
  ],
  totalAssessed: 90,
  totalNotAssessed: 10,
  averageRiskScore: 35,
};

const mockActivityStats = {
  totalEvents: 150,
  byType: [
    { type: 'note', count: 50 },
    { type: 'call', count: 30 },
    { type: 'email', count: 40 },
  ],
  mostActiveClients: [
    { clientId: CLIENT_ID_1, clientName: 'Client 1', eventCount: 50 },
  ],
  averageEventsPerClient: 7.5,
  period: 'month' as const,
};

const mockVatStats = {
  distribution: [
    { status: 'active' as const, count: 40, percentage: 40 },
    { status: 'not_registered' as const, count: 20, percentage: 20 },
    { status: 'invalid' as const, count: 5, percentage: 5 },
    { status: 'exempt' as const, count: 5, percentage: 5 },
    { status: 'not_validated' as const, count: 30, percentage: 30 },
  ],
  totalValidated: 70,
  totalNotValidated: 30,
  validationRate: 70,
};

const mockTopClients = {
  clients: [
    {
      clientId: CLIENT_ID_1,
      clientName: 'Top Client 1',
      clientType: 'company' as const,
      metricValue: 100,
      metricLabel: 'Zdarzenia',
    },
  ],
  metric: 'events',
  total: 1,
};

const mockDashboardSummary = {
  overview: mockOverview,
  growth: {
    last7Days: 3,
    last30Days: 12,
    trend: 'up' as const,
  },
  alerts: {
    highRiskClients: 5,
    expiredVatValidations: 10,
    incompleteProfiles: 15,
  },
  quickStats: {
    avgEventsPerClient: 7.5,
    avgContactsPerClient: 2.5,
    topTag: 'vip',
  },
};

// Hoisted mocks
const mocks = vi.hoisted(() => ({
  getStatisticsOverview: vi.fn(),
  getClientGrowth: vi.fn(),
  getTagStatistics: vi.fn(),
  getRiskDistribution: vi.fn(),
  getActivityStatistics: vi.fn(),
  getVatStatistics: vi.fn(),
  getTopClients: vi.fn(),
  getDashboardSummary: vi.fn(),
}));

// Mock the StatisticsService
vi.mock('../../services/crm/statistics.service', () => ({
  StatisticsService: vi.fn().mockImplementation(() => ({
    getStatisticsOverview: mocks.getStatisticsOverview,
    getClientGrowth: mocks.getClientGrowth,
    getTagStatistics: mocks.getTagStatistics,
    getRiskDistribution: mocks.getRiskDistribution,
    getActivityStatistics: mocks.getActivityStatistics,
    getVatStatistics: mocks.getVatStatistics,
    getTopClients: mocks.getTopClients,
    getDashboardSummary: mocks.getDashboardSummary,
  })),
}));

// Context helpers
const createAuthenticatedContext = () => ({
  session: {
    userId: TEST_USER_ID,
    organizationId: ORG_ID,
    email: 'test@example.com',
    role: 'user',
  },
  prisma: {} as any,
  redis: {} as any,
  auditLogger: { log: vi.fn() } as any,
});

const createUnauthenticatedContext = () => ({
  session: null,
  prisma: {} as any,
  redis: {} as any,
  auditLogger: { log: vi.fn() } as any,
});

describe('StatisticsRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStatisticsOverview.mockResolvedValue(mockOverview);
    mocks.getClientGrowth.mockResolvedValue(mockGrowth);
    mocks.getTagStatistics.mockResolvedValue(mockTagStats);
    mocks.getRiskDistribution.mockResolvedValue(mockRiskDistribution);
    mocks.getActivityStatistics.mockResolvedValue(mockActivityStats);
    mocks.getVatStatistics.mockResolvedValue(mockVatStats);
    mocks.getTopClients.mockResolvedValue(mockTopClients);
    mocks.getDashboardSummary.mockResolvedValue(mockDashboardSummary);
  });

  // ===========================================================================
  // AUTHENTICATION
  // ===========================================================================

  describe('authentication', () => {
    it('should reject unauthenticated access to getOverview', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(caller.crm.statistics.getOverview({})).rejects.toThrow();
    });

    it('should reject unauthenticated access to getDashboard', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(caller.crm.statistics.getDashboard({})).rejects.toThrow();
    });
  });

  // ===========================================================================
  // GET OVERVIEW
  // ===========================================================================

  describe('getOverview', () => {
    it('should return statistics overview', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.crm.statistics.getOverview({ period: 'month' });

      expect(result.totalClients).toBe(100);
      expect(result.activeClients).toBe(80);
      expect(result.byType.company).toBe(60);
      expect(mocks.getStatisticsOverview).toHaveBeenCalledWith({ period: 'month' });
    });

    it('should use default period if not provided', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.crm.statistics.getOverview({});

      expect(mocks.getStatisticsOverview).toHaveBeenCalled();
    });

    it('should accept different periods', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      for (const period of ['day', 'week', 'month', 'quarter', 'year', 'all_time'] as const) {
        await caller.crm.statistics.getOverview({ period });
        expect(mocks.getStatisticsOverview).toHaveBeenCalledWith({ period });
      }
    });
  });

  // ===========================================================================
  // GET GROWTH
  // ===========================================================================

  describe('getGrowth', () => {
    it('should return growth data points', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.crm.statistics.getGrowth({
        period: 'month',
        intervals: 12,
      });

      expect(result.dataPoints).toBeInstanceOf(Array);
      expect(result.totalGrowth).toBe(10);
      expect(result.averageGrowthRate).toBe(5.5);
    });

    it('should validate intervals parameter', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.crm.statistics.getGrowth({
          period: 'month',
          intervals: 100, // exceeds max of 52
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // GET TAG STATISTICS
  // ===========================================================================

  describe('getTagStatistics', () => {
    it('should return tag distribution', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.crm.statistics.getTagStatistics({ limit: 20 });

      expect(result.tags).toBeInstanceOf(Array);
      expect(result.totalTaggedClients).toBe(35);
      expect(result.averageTagsPerClient).toBe(1.5);
    });

    it('should respect limit parameter', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.crm.statistics.getTagStatistics({ limit: 10 });

      expect(mocks.getTagStatistics).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 })
      );
    });
  });

  // ===========================================================================
  // GET RISK DISTRIBUTION
  // ===========================================================================

  describe('getRiskDistribution', () => {
    it('should return risk level distribution', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.crm.statistics.getRiskDistribution({});

      expect(result.distribution).toBeInstanceOf(Array);
      expect(result.totalAssessed).toBe(90);
      expect(result.averageRiskScore).toBe(35);
    });

    it('should include all risk levels', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.crm.statistics.getRiskDistribution({});

      const levels = result.distribution.map((d) => d.level);
      expect(levels).toContain('low');
      expect(levels).toContain('high');
      expect(levels).toContain('not_assessed');
    });
  });

  // ===========================================================================
  // GET ACTIVITY STATISTICS
  // ===========================================================================

  describe('getActivityStatistics', () => {
    it('should return activity statistics', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.crm.statistics.getActivityStatistics({
        period: 'month',
      });

      expect(result.totalEvents).toBe(150);
      expect(result.byType).toBeInstanceOf(Array);
      expect(result.mostActiveClients).toBeInstanceOf(Array);
    });

    it('should filter by client if provided', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.crm.statistics.getActivityStatistics({
        period: 'month',
        clientId: CLIENT_ID_1,
      });

      expect(mocks.getActivityStatistics).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: CLIENT_ID_1 })
      );
    });
  });

  // ===========================================================================
  // GET VAT STATISTICS
  // ===========================================================================

  describe('getVatStatistics', () => {
    it('should return VAT status distribution', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.crm.statistics.getVatStatistics({});

      expect(result.distribution).toBeInstanceOf(Array);
      expect(result.totalValidated).toBe(70);
      expect(result.validationRate).toBe(70);
    });

    it('should support including archived clients', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await caller.crm.statistics.getVatStatistics({ includeArchived: true });

      expect(mocks.getVatStatistics).toHaveBeenCalledWith({ includeArchived: true });
    });
  });

  // ===========================================================================
  // GET TOP CLIENTS
  // ===========================================================================

  describe('getTopClients', () => {
    it('should return top clients by events', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.crm.statistics.getTopClients({
        metric: 'events',
        limit: 10,
        order: 'desc',
      });

      expect(result.clients).toBeInstanceOf(Array);
      expect(result.metric).toBe('events');
    });

    it('should support different metrics', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      for (const metric of ['events', 'contacts', 'documents', 'risk_score'] as const) {
        await caller.crm.statistics.getTopClients({
          metric,
          limit: 10,
          order: 'desc',
        });
        expect(mocks.getTopClients).toHaveBeenCalledWith(
          expect.objectContaining({ metric })
        );
      }
    });

    it('should validate limit parameter', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.crm.statistics.getTopClients({
          metric: 'events',
          limit: 150, // exceeds max of 100
          order: 'desc',
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // GET DASHBOARD SUMMARY
  // ===========================================================================

  describe('getDashboard', () => {
    it('should return complete dashboard summary', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.crm.statistics.getDashboard({ period: 'month' });

      expect(result).toHaveProperty('overview');
      expect(result).toHaveProperty('growth');
      expect(result).toHaveProperty('alerts');
      expect(result).toHaveProperty('quickStats');
    });

    it('should include growth trends', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.crm.statistics.getDashboard({ period: 'month' });

      expect(result.growth).toHaveProperty('last7Days');
      expect(result.growth).toHaveProperty('last30Days');
      expect(result.growth).toHaveProperty('trend');
    });

    it('should include alerts', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      const result = await caller.crm.statistics.getDashboard({ period: 'month' });

      expect(typeof result.alerts.highRiskClients).toBe('number');
      expect(typeof result.alerts.expiredVatValidations).toBe('number');
      expect(typeof result.alerts.incompleteProfiles).toBe('number');
    });
  });

  // ===========================================================================
  // INPUT VALIDATION
  // ===========================================================================

  describe('input validation', () => {
    it('should reject invalid period', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.crm.statistics.getOverview({ period: 'invalid' as any })
      ).rejects.toThrow();
    });

    it('should reject invalid client UUID in activity', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.crm.statistics.getActivityStatistics({
          period: 'month',
          clientId: 'invalid-uuid',
        })
      ).rejects.toThrow();
    });

    it('should reject invalid metric in top clients', async () => {
      const caller = appRouter.createCaller(createAuthenticatedContext());

      await expect(
        caller.crm.statistics.getTopClients({
          metric: 'invalid' as any,
          limit: 10,
          order: 'desc',
        })
      ).rejects.toThrow();
    });
  });
});
