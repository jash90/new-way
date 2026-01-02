import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';
import type {
  GetStatisticsOverviewInput,
  StatisticsOverview,
  GetClientGrowthInput,
  ClientGrowthResult,
  GrowthDataPoint,
  GetTagStatisticsInput,
  TagStatisticsResult,
  GetRiskDistributionInput,
  RiskDistributionResult,
  GetActivityStatisticsInput,
  ActivityStatisticsResult,
  GetVatStatisticsInput,
  VatStatisticsResult,
  VatStatusDistribution,
  GetTopClientsInput,
  TopClientsResult,
  GetDashboardSummaryInput,
  DashboardSummary,
  StatisticsPeriod,
} from '@ksiegowacrm/shared';

/**
 * StatisticsService (CRM-009)
 * Handles client and CRM statistics
 *
 * TODO: This service requires the following Prisma schema additions:
 * - RiskAssessment model for risk distribution statistics
 * - TimelineEvent model for activity statistics
 * - Contact model for contact-related statistics
 *
 * Methods that require these models throw NotImplementedError.
 */

class NotImplementedError extends Error {
  constructor(feature: string, missingModel: string) {
    super(`${feature} requires the ${missingModel} Prisma model which is not yet implemented`);
    this.name = 'NotImplementedError';
  }
}

// Cache TTL in seconds
const CACHE_TTL = 300; // 5 minutes

export class StatisticsService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private auditLogger: AuditLogger,
    private userId: string,
    private organizationId: string
  ) {
    // Suppress unused warnings - reserved for future use
    void this.auditLogger;
    void this.userId;
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private getCacheKey(operation: string, params: Record<string, unknown>): string {
    const paramString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(':');
    return `statistics:${this.organizationId}:${operation}:${paramString}`;
  }

  private async getCachedData<T>(cacheKey: string): Promise<T | null> {
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }
    return null;
  }

  private async setCachedData<T>(cacheKey: string, data: T): Promise<void> {
    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', CACHE_TTL);
  }

  private getPeriodDates(period: StatisticsPeriod): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);
    let start: Date;

    switch (period) {
      case 'day':
        start = new Date(now);
        start.setDate(start.getDate() - 1);
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarter':
        start = new Date(now);
        start.setMonth(start.getMonth() - 3);
        break;
      case 'year':
        start = new Date(now);
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'all_time':
      default:
        start = new Date(0);
        break;
    }

    return { start, end };
  }

  private getPreviousPeriodDates(period: StatisticsPeriod): { start: Date; end: Date } {
    const current = this.getPeriodDates(period);
    const duration = current.end.getTime() - current.start.getTime();

    return {
      start: new Date(current.start.getTime() - duration),
      end: new Date(current.start.getTime()),
    };
  }

  // ===========================================================================
  // GET STATISTICS OVERVIEW
  // ===========================================================================

  async getStatisticsOverview(
    input: GetStatisticsOverviewInput
  ): Promise<StatisticsOverview> {
    const { period } = input;
    const cacheKey = this.getCacheKey('overview', { period });

    // Check cache
    const cached = await this.getCachedData<StatisticsOverview>(cacheKey);
    if (cached) {
      return {
        ...cached,
        periodStart: new Date(cached.periodStart),
        periodEnd: new Date(cached.periodEnd),
      };
    }

    const { start: periodStart, end: periodEnd } = this.getPeriodDates(period);
    const previousPeriod = this.getPreviousPeriodDates(period);

    // Get total clients
    const totalClients = await this.prisma.client.count({
      where: { organizationId: this.organizationId },
    });

    // Get active clients
    const activeClients = await this.prisma.client.count({
      where: {
        organizationId: this.organizationId,
        status: 'active',
      },
    });

    // Get archived clients
    const archivedClients = await this.prisma.client.count({
      where: {
        organizationId: this.organizationId,
        archivedAt: { not: null },
      },
    });

    // Get clients by type
    const byTypeData = await this.prisma.client.groupBy({
      by: ['type'],
      where: { organizationId: this.organizationId },
      _count: { id: true },
    });

    const byType = {
      company: byTypeData.find((t) => t.type === 'company')?._count?.id ?? 0,
      individual: byTypeData.find((t) => t.type === 'individual')?._count?.id ?? 0,
    };

    // Get clients by status
    const byStatusData = await this.prisma.client.groupBy({
      by: ['status'],
      where: { organizationId: this.organizationId },
      _count: { id: true },
    });

    const byStatus = {
      active: byStatusData.find((s) => s.status === 'active')?._count?.id ?? 0,
      inactive: byStatusData.find((s) => s.status === 'inactive')?._count?.id ?? 0,
      suspended: byStatusData.find((s) => s.status === 'suspended')?._count?.id ?? 0,
      pending: 0, // 'pending' status is required by ClientCountByStatus but not in Prisma ClientStatus enum
    };

    // Get new clients this period
    const newClientsThisPeriod = await this.prisma.client.count({
      where: {
        organizationId: this.organizationId,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    // Get new clients previous period
    const newClientsPreviousPeriod = await this.prisma.client.count({
      where: {
        organizationId: this.organizationId,
        createdAt: {
          gte: previousPeriod.start,
          lte: previousPeriod.end,
        },
      },
    });

    // Calculate change percentage
    const newClientsChange =
      newClientsPreviousPeriod > 0
        ? ((newClientsThisPeriod - newClientsPreviousPeriod) / newClientsPreviousPeriod) * 100
        : newClientsThisPeriod > 0
          ? 100
          : 0;

    const result: StatisticsOverview = {
      totalClients,
      activeClients,
      archivedClients,
      byType,
      byStatus,
      newClientsThisPeriod,
      newClientsChange: Math.round(newClientsChange * 10) / 10,
      period,
      periodStart,
      periodEnd,
    };

    // Cache result
    await this.setCachedData(cacheKey, result);

    return result;
  }

  // ===========================================================================
  // GET CLIENT GROWTH
  // ===========================================================================

  async getClientGrowth(input: GetClientGrowthInput): Promise<ClientGrowthResult> {
    const { period, intervals } = input;
    const cacheKey = this.getCacheKey('growth', { period, intervals });

    // Check cache
    const cached = await this.getCachedData<ClientGrowthResult>(cacheKey);
    if (cached) {
      return {
        ...cached,
        dataPoints: cached.dataPoints.map((dp) => ({
          ...dp,
          date: new Date(dp.date),
        })),
      };
    }

    const { start, end } = this.getPeriodDates(period);
    const intervalMs = (end.getTime() - start.getTime()) / intervals;

    const dataPoints: GrowthDataPoint[] = [];
    let totalNewClients = 0;

    for (let i = 0; i < intervals; i++) {
      const intervalStart = new Date(start.getTime() + i * intervalMs);
      const intervalEnd = new Date(start.getTime() + (i + 1) * intervalMs);

      // Get total clients up to this point
      const totalClients = await this.prisma.client.count({
        where: {
          organizationId: this.organizationId,
          createdAt: { lte: intervalEnd },
        },
      });

      // Get new clients in this interval
      const newClients = await this.prisma.client.count({
        where: {
          organizationId: this.organizationId,
          createdAt: {
            gte: intervalStart,
            lt: intervalEnd,
          },
        },
      });

      // Get archived clients in this interval
      const archivedClients = await this.prisma.client.count({
        where: {
          organizationId: this.organizationId,
          archivedAt: { not: null },
          updatedAt: {
            gte: intervalStart,
            lt: intervalEnd,
          },
        },
      });

      const netGrowth = newClients - archivedClients;
      totalNewClients += newClients;

      dataPoints.push({
        date: intervalStart,
        totalClients,
        newClients,
        archivedClients,
        netGrowth,
      });
    }

    // Calculate total growth
    const firstTotal = dataPoints[0]?.totalClients ?? 0;
    const lastTotal = dataPoints[dataPoints.length - 1]?.totalClients ?? 0;
    const totalGrowth = lastTotal - firstTotal;

    // Calculate average growth rate
    const averageGrowthRate =
      firstTotal > 0
        ? ((lastTotal - firstTotal) / firstTotal) * 100 / intervals
        : 0;

    // Suppress unused variable warning
    void totalNewClients;

    const result: ClientGrowthResult = {
      dataPoints,
      totalGrowth,
      averageGrowthRate: Math.round(averageGrowthRate * 100) / 100,
      period,
    };

    // Cache result
    await this.setCachedData(cacheKey, result);

    return result;
  }

  // ===========================================================================
  // GET TAG STATISTICS
  // ===========================================================================

  async getTagStatistics(input: GetTagStatisticsInput): Promise<TagStatisticsResult> {
    const { limit, includeArchived } = input;
    const cacheKey = this.getCacheKey('tags', { limit, includeArchived });

    // Check cache
    const cached = await this.getCachedData<TagStatisticsResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const whereClause: Record<string, unknown> = {
      organizationId: this.organizationId,
      ...(includeArchived ? {} : { archivedAt: null }),
    };

    // Get all clients with tags
    const clientsWithTags = await this.prisma.client.findMany({
      where: {
        ...whereClause,
        tags: { isEmpty: false },
      },
      select: { id: true, tags: true },
    });

    // Count tag occurrences
    const tagCounts = new Map<string, number>();
    for (const client of clientsWithTags) {
      for (const tag of client.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    // Sort and limit
    const sortedTags = Array.from(tagCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit);

    const totalTaggedClients = clientsWithTags.length;
    const totalUntaggedClients = await this.prisma.client.count({
      where: {
        ...whereClause,
        tags: { isEmpty: true },
      },
    });

    const totalClients = totalTaggedClients + totalUntaggedClients;

    const tags = sortedTags.map(([tag, count]) => ({
      tag,
      count,
      percentage: totalClients > 0 ? Math.round((count / totalClients) * 1000) / 10 : 0,
    }));

    // Calculate average tags per client
    const totalTags = clientsWithTags.reduce((sum, c) => sum + c.tags.length, 0);
    const averageTagsPerClient =
      totalTaggedClients > 0
        ? Math.round((totalTags / totalTaggedClients) * 10) / 10
        : 0;

    const result: TagStatisticsResult = {
      tags,
      totalTaggedClients,
      totalUntaggedClients,
      averageTagsPerClient,
    };

    // Cache result
    await this.setCachedData(cacheKey, result);

    return result;
  }

  // ===========================================================================
  // GET RISK DISTRIBUTION - Requires RiskAssessment Model
  // ===========================================================================

  async getRiskDistribution(
    _input: GetRiskDistributionInput
  ): Promise<RiskDistributionResult> {
    void _input;
    throw new NotImplementedError('getRiskDistribution', 'RiskAssessment');
  }

  // ===========================================================================
  // GET ACTIVITY STATISTICS - Requires TimelineEvent Model
  // ===========================================================================

  async getActivityStatistics(
    _input: GetActivityStatisticsInput
  ): Promise<ActivityStatisticsResult> {
    void _input;
    throw new NotImplementedError('getActivityStatistics', 'TimelineEvent');
  }

  // ===========================================================================
  // GET VAT STATISTICS - Requires vatStatus field in Client model
  // ===========================================================================

  async getVatStatistics(_input: GetVatStatisticsInput): Promise<VatStatisticsResult> {
    // Note: vatStatus field is not currently in the Client Prisma model
    // This method returns placeholder data until the schema is updated
    void _input;

    // Return placeholder statistics since vatStatus doesn't exist in schema
    const distribution: VatStatusDistribution[] = [
      { status: 'active', count: 0, percentage: 0 },
      { status: 'not_registered', count: 0, percentage: 0 },
      { status: 'invalid', count: 0, percentage: 0 },
      { status: 'exempt', count: 0, percentage: 0 },
      { status: 'not_validated', count: 0, percentage: 0 },
    ];

    return {
      distribution,
      totalValidated: 0,
      totalNotValidated: 0,
      validationRate: 0,
    };
  }

  // ===========================================================================
  // GET TOP CLIENTS - Requires TimelineEvent, Contact Models
  // ===========================================================================

  async getTopClients(_input: GetTopClientsInput): Promise<TopClientsResult> {
    void _input;
    throw new NotImplementedError('getTopClients', 'TimelineEvent/Contact');
  }

  // ===========================================================================
  // GET DASHBOARD SUMMARY - Partial Implementation
  // ===========================================================================

  async getDashboardSummary(input: GetDashboardSummaryInput): Promise<DashboardSummary> {
    const { period } = input;
    const cacheKey = this.getCacheKey('dashboard', { period });

    // Check cache
    const cached = await this.getCachedData<DashboardSummary>(cacheKey);
    if (cached) {
      return {
        ...cached,
        overview: {
          ...cached.overview,
          periodStart: new Date(cached.overview.periodStart),
          periodEnd: new Date(cached.overview.periodEnd),
        },
      };
    }

    // Get overview
    const overview = await this.getStatisticsOverview({ period });

    // Get growth data
    const last7Days = await this.prisma.client.count({
      where: {
        organizationId: this.organizationId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const last30Days = await this.prisma.client.count({
      where: {
        organizationId: this.organizationId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });

    // Determine trend
    let trend: 'up' | 'down' | 'stable';
    if (last7Days > last30Days / 4) {
      trend = 'up';
    } else if (last7Days < last30Days / 5) {
      trend = 'down';
    } else {
      trend = 'stable';
    }

    // Note: Risk-based alerts require RiskAssessment model
    // Setting to 0 as placeholder

    // Get top tag
    const clientsWithTags = await this.prisma.client.findMany({
      where: {
        organizationId: this.organizationId,
        tags: { isEmpty: false },
      },
      select: { tags: true },
    });

    const tagCounts = new Map<string, number>();
    for (const client of clientsWithTags) {
      for (const tag of client.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    let topTag: string | null = null;
    let maxCount = 0;
    for (const [tag, count] of tagCounts) {
      if (count > maxCount) {
        maxCount = count;
        topTag = tag;
      }
    }

    // Note: avgEventsPerClient and avgContactsPerClient require TimelineEvent and Contact models
    const result: DashboardSummary = {
      overview,
      growth: {
        last7Days,
        last30Days,
        trend,
      },
      alerts: {
        highRiskClients: 0, // Requires RiskAssessment model
        expiredVatValidations: 0, // Requires VAT validation tracking
        incompleteProfiles: 0, // Simplified - would need proper field checks
      },
      quickStats: {
        avgEventsPerClient: 0, // Requires TimelineEvent model
        avgContactsPerClient: 0, // Requires Contact model
        topTag,
      },
    };

    // Cache result
    await this.setCachedData(cacheKey, result);

    return result;
  }
}
