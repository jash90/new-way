import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatisticsService } from '../../services/crm/statistics.service';

// Mock data
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = '22222222-2222-2222-2222-222222222222';
const CLIENT_ID_1 = '33333333-3333-3333-3333-333333333333';
const CLIENT_ID_2 = '44444444-4444-4444-4444-444444444444';

// Create mocks
const mocks = vi.hoisted(() => ({
  clientCount: vi.fn(),
  clientFindMany: vi.fn(),
  clientGroupBy: vi.fn(),
  timelineEventCount: vi.fn(),
  timelineEventGroupBy: vi.fn(),
  riskAssessmentFindMany: vi.fn(),
  riskAssessmentAggregate: vi.fn(),
  contactCount: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  auditLog: vi.fn(),
}));

// Mock Prisma
const mockPrisma = {
  client: {
    count: mocks.clientCount,
    findMany: mocks.clientFindMany,
    groupBy: mocks.clientGroupBy,
  },
  timelineEvent: {
    count: mocks.timelineEventCount,
    groupBy: mocks.timelineEventGroupBy,
  },
  riskAssessment: {
    findMany: mocks.riskAssessmentFindMany,
    aggregate: mocks.riskAssessmentAggregate,
  },
  contact: {
    count: mocks.contactCount,
  },
} as any;

// Mock Redis
const mockRedis = {
  get: mocks.redisGet,
  set: mocks.redisSet,
} as any;

// Mock Audit Logger
const mockAuditLogger = {
  log: mocks.auditLog,
} as any;

describe('StatisticsService', () => {
  let service: StatisticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StatisticsService(
      mockPrisma,
      mockRedis,
      mockAuditLogger,
      TEST_USER_ID,
      ORG_ID
    );

    // Default mock implementations
    mocks.redisGet.mockResolvedValue(null);
    mocks.redisSet.mockResolvedValue('OK');
    mocks.auditLog.mockResolvedValue(undefined);
  });

  // ===========================================================================
  // GET STATISTICS OVERVIEW
  // ===========================================================================

  describe('getStatisticsOverview', () => {
    beforeEach(() => {
      mocks.clientCount
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80) // active
        .mockResolvedValueOnce(5); // archived

      mocks.clientGroupBy
        .mockResolvedValueOnce([
          { type: 'company', _count: { id: 60 } },
          { type: 'individual', _count: { id: 40 } },
        ])
        .mockResolvedValueOnce([
          { status: 'active', _count: { id: 80 } },
          { status: 'inactive', _count: { id: 15 } },
          { status: 'suspended', _count: { id: 3 } },
          { status: 'pending', _count: { id: 2 } },
        ]);
    });

    it('should return statistics overview', async () => {
      const result = await service.getStatisticsOverview({ period: 'month' });

      expect(result.totalClients).toBe(100);
      expect(result.activeClients).toBe(80);
      expect(result.archivedClients).toBe(5);
      expect(result.byType.company).toBe(60);
      expect(result.byType.individual).toBe(40);
      expect(result.period).toBe('month');
    });

    it('should calculate new clients for period', async () => {
      mocks.clientCount.mockResolvedValueOnce(10); // new this period
      mocks.clientCount.mockResolvedValueOnce(8); // new previous period

      const result = await service.getStatisticsOverview({ period: 'month' });

      expect(result.newClientsThisPeriod).toBeGreaterThanOrEqual(0);
    });

    it('should use cached data if available', async () => {
      const cachedData = {
        totalClients: 50,
        activeClients: 40,
        archivedClients: 2,
        byType: { company: 30, individual: 20 },
        byStatus: { active: 40, inactive: 8, suspended: 1, pending: 1 },
        newClientsThisPeriod: 5,
        newClientsChange: 10,
        period: 'month',
        periodStart: new Date().toISOString(),
        periodEnd: new Date().toISOString(),
      };
      mocks.redisGet.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.getStatisticsOverview({ period: 'month' });

      expect(result.totalClients).toBe(50);
      expect(mocks.clientCount).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // GET CLIENT GROWTH
  // ===========================================================================

  describe('getClientGrowth', () => {
    beforeEach(() => {
      mocks.clientGroupBy.mockResolvedValue([
        { createdAt: new Date('2024-01-01'), _count: { id: 10 } },
        { createdAt: new Date('2024-02-01'), _count: { id: 15 } },
        { createdAt: new Date('2024-03-01'), _count: { id: 12 } },
      ]);
    });

    it('should return growth data points', async () => {
      const result = await service.getClientGrowth({
        period: 'month',
        intervals: 12,
      });

      expect(result.dataPoints).toBeInstanceOf(Array);
      expect(result.period).toBe('month');
    });

    it('should calculate total growth', async () => {
      const result = await service.getClientGrowth({
        period: 'month',
        intervals: 12,
      });

      expect(typeof result.totalGrowth).toBe('number');
      expect(typeof result.averageGrowthRate).toBe('number');
    });
  });

  // ===========================================================================
  // GET TAG STATISTICS
  // ===========================================================================

  describe('getTagStatistics', () => {
    beforeEach(() => {
      mocks.clientFindMany.mockResolvedValue([
        { id: CLIENT_ID_1, tags: ['vip', 'priority'] },
        { id: CLIENT_ID_2, tags: ['vip'] },
      ]);
      mocks.clientCount
        .mockResolvedValueOnce(2) // tagged
        .mockResolvedValueOnce(5); // untagged
    });

    it('should return tag distribution', async () => {
      const result = await service.getTagStatistics({ limit: 20 });

      expect(result.tags).toBeInstanceOf(Array);
      expect(result.totalTaggedClients).toBeGreaterThanOrEqual(0);
      expect(result.totalUntaggedClients).toBeGreaterThanOrEqual(0);
    });

    it('should calculate percentage for each tag', async () => {
      const result = await service.getTagStatistics({ limit: 20 });

      if (result.tags.length > 0) {
        expect(result.tags[0]).toHaveProperty('percentage');
      }
    });

    it('should respect limit parameter', async () => {
      mocks.clientFindMany.mockResolvedValue(
        Array.from({ length: 30 }, (_, i) => ({
          id: `id-${i}`,
          tags: [`tag-${i}`],
        }))
      );

      const result = await service.getTagStatistics({ limit: 10 });

      expect(result.tags.length).toBeLessThanOrEqual(10);
    });
  });

  // ===========================================================================
  // GET RISK DISTRIBUTION
  // ===========================================================================

  describe('getRiskDistribution', () => {
    beforeEach(() => {
      mocks.riskAssessmentFindMany.mockResolvedValue([
        { clientId: CLIENT_ID_1, riskLevel: 'low', overallScore: 20 },
        { clientId: CLIENT_ID_2, riskLevel: 'medium', overallScore: 45 },
      ]);
      mocks.clientCount.mockResolvedValue(10); // total clients
    });

    it('should return risk level distribution', async () => {
      const result = await service.getRiskDistribution({});

      expect(result.distribution).toBeInstanceOf(Array);
      expect(result.totalAssessed).toBeGreaterThanOrEqual(0);
      expect(result.totalNotAssessed).toBeGreaterThanOrEqual(0);
    });

    it('should calculate average risk score', async () => {
      const result = await service.getRiskDistribution({});

      expect(typeof result.averageRiskScore).toBe('number');
    });

    it('should include all risk levels', async () => {
      const result = await service.getRiskDistribution({});

      const levels = result.distribution.map((d) => d.level);
      expect(levels).toContain('low');
      expect(levels).toContain('medium');
      expect(levels).toContain('high');
      expect(levels).toContain('critical');
      expect(levels).toContain('not_assessed');
    });
  });

  // ===========================================================================
  // GET ACTIVITY STATISTICS
  // ===========================================================================

  describe('getActivityStatistics', () => {
    beforeEach(() => {
      mocks.timelineEventCount.mockResolvedValue(150);
      mocks.timelineEventGroupBy.mockResolvedValue([
        { eventType: 'note', _count: { id: 50 } },
        { eventType: 'call', _count: { id: 30 } },
        { eventType: 'email', _count: { id: 40 } },
        { eventType: 'meeting', _count: { id: 30 } },
      ]);
      mocks.clientFindMany.mockResolvedValue([
        {
          id: CLIENT_ID_1,
          displayName: 'Client 1',
          _count: { timelineEvents: 50 },
        },
        {
          id: CLIENT_ID_2,
          displayName: 'Client 2',
          _count: { timelineEvents: 30 },
        },
      ]);
      mocks.clientCount.mockResolvedValue(20);
    });

    it('should return activity statistics', async () => {
      const result = await service.getActivityStatistics({ period: 'month' });

      expect(result.totalEvents).toBeGreaterThanOrEqual(0);
      expect(result.byType).toBeInstanceOf(Array);
      expect(result.period).toBe('month');
    });

    it('should return most active clients', async () => {
      const result = await service.getActivityStatistics({ period: 'month' });

      expect(result.mostActiveClients).toBeInstanceOf(Array);
    });

    it('should calculate average events per client', async () => {
      const result = await service.getActivityStatistics({ period: 'month' });

      expect(typeof result.averageEventsPerClient).toBe('number');
    });
  });

  // ===========================================================================
  // GET VAT STATISTICS
  // ===========================================================================

  describe('getVatStatistics', () => {
    beforeEach(() => {
      mocks.clientGroupBy.mockResolvedValue([
        { vatStatus: 'active', _count: { id: 40 } },
        { vatStatus: 'not_registered', _count: { id: 20 } },
        { vatStatus: null, _count: { id: 30 } },
      ]);
      mocks.clientCount.mockResolvedValue(100);
    });

    it('should return VAT status distribution', async () => {
      const result = await service.getVatStatistics({});

      expect(result.distribution).toBeInstanceOf(Array);
      expect(result.totalValidated).toBeGreaterThanOrEqual(0);
    });

    it('should calculate validation rate', async () => {
      const result = await service.getVatStatistics({});

      expect(typeof result.validationRate).toBe('number');
      expect(result.validationRate).toBeGreaterThanOrEqual(0);
      expect(result.validationRate).toBeLessThanOrEqual(100);
    });
  });

  // ===========================================================================
  // GET TOP CLIENTS
  // ===========================================================================

  describe('getTopClients', () => {
    beforeEach(() => {
      mocks.clientFindMany.mockResolvedValue([
        {
          id: CLIENT_ID_1,
          displayName: 'Top Client 1',
          type: 'company',
          _count: { timelineEvents: 100 },
        },
        {
          id: CLIENT_ID_2,
          displayName: 'Top Client 2',
          type: 'individual',
          _count: { timelineEvents: 80 },
        },
      ]);
    });

    it('should return top clients by events', async () => {
      const result = await service.getTopClients({
        metric: 'events',
        limit: 10,
        order: 'desc',
      });

      expect(result.clients).toBeInstanceOf(Array);
      expect(result.metric).toBe('events');
    });

    it('should return top clients by contacts', async () => {
      mocks.clientFindMany.mockResolvedValue([
        {
          id: CLIENT_ID_1,
          displayName: 'Top Client 1',
          type: 'company',
          _count: { contacts: 15 },
        },
      ]);

      const result = await service.getTopClients({
        metric: 'contacts',
        limit: 10,
        order: 'desc',
      });

      expect(result.metric).toBe('contacts');
    });

    it('should respect limit parameter', async () => {
      const result = await service.getTopClients({
        metric: 'events',
        limit: 5,
        order: 'desc',
      });

      expect(result.clients.length).toBeLessThanOrEqual(5);
    });

    it('should support ascending order', async () => {
      const result = await service.getTopClients({
        metric: 'events',
        limit: 10,
        order: 'asc',
      });

      expect(result.clients).toBeInstanceOf(Array);
    });
  });

  // ===========================================================================
  // GET DASHBOARD SUMMARY
  // ===========================================================================

  describe('getDashboardSummary', () => {
    beforeEach(() => {
      // Setup for overview
      mocks.clientCount
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80) // active
        .mockResolvedValueOnce(5) // archived
        .mockResolvedValueOnce(10) // new this period
        .mockResolvedValueOnce(8) // new previous period
        .mockResolvedValueOnce(3) // last 7 days
        .mockResolvedValueOnce(12) // last 30 days
        .mockResolvedValueOnce(5); // high risk

      mocks.clientGroupBy
        .mockResolvedValueOnce([
          { type: 'company', _count: { id: 60 } },
          { type: 'individual', _count: { id: 40 } },
        ])
        .mockResolvedValueOnce([
          { status: 'active', _count: { id: 80 } },
          { status: 'inactive', _count: { id: 15 } },
        ]);

      mocks.clientFindMany.mockResolvedValue([
        { id: CLIENT_ID_1, tags: ['vip'] },
      ]);
    });

    it('should return complete dashboard summary', async () => {
      const result = await service.getDashboardSummary({ period: 'month' });

      expect(result).toHaveProperty('overview');
      expect(result).toHaveProperty('growth');
      expect(result).toHaveProperty('alerts');
      expect(result).toHaveProperty('quickStats');
    });

    it('should include growth trends', async () => {
      const result = await service.getDashboardSummary({ period: 'month' });

      expect(result.growth).toHaveProperty('last7Days');
      expect(result.growth).toHaveProperty('last30Days');
      expect(result.growth).toHaveProperty('trend');
      expect(['up', 'down', 'stable']).toContain(result.growth.trend);
    });

    it('should include alerts', async () => {
      const result = await service.getDashboardSummary({ period: 'month' });

      expect(typeof result.alerts.highRiskClients).toBe('number');
      expect(typeof result.alerts.expiredVatValidations).toBe('number');
      expect(typeof result.alerts.incompleteProfiles).toBe('number');
    });
  });

  // ===========================================================================
  // CACHING
  // ===========================================================================

  describe('caching', () => {
    it('should cache statistics overview', async () => {
      mocks.clientCount.mockResolvedValue(100);
      mocks.clientGroupBy.mockResolvedValue([]);

      await service.getStatisticsOverview({ period: 'month' });

      expect(mocks.redisSet).toHaveBeenCalled();
    });

    it('should use cached data when available', async () => {
      const cachedData = {
        totalClients: 50,
        activeClients: 40,
        archivedClients: 2,
        byType: { company: 30, individual: 20 },
        byStatus: { active: 40, inactive: 8, suspended: 1, pending: 1 },
        newClientsThisPeriod: 5,
        newClientsChange: 10,
        period: 'month',
        periodStart: new Date().toISOString(),
        periodEnd: new Date().toISOString(),
      };
      mocks.redisGet.mockResolvedValue(JSON.stringify(cachedData));

      await service.getStatisticsOverview({ period: 'month' });

      expect(mocks.clientCount).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mocks.clientCount.mockRejectedValue(new Error('Database error'));

      await expect(
        service.getStatisticsOverview({ period: 'month' })
      ).rejects.toThrow();
    });

    it('should handle empty data', async () => {
      mocks.clientCount.mockResolvedValue(0);
      mocks.clientGroupBy.mockResolvedValue([]);

      const result = await service.getStatisticsOverview({ period: 'month' });

      expect(result.totalClients).toBe(0);
    });
  });
});
