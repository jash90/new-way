import { z } from 'zod';

// ===========================================================================
// TIME PERIOD
// ===========================================================================

export const statisticsPeriodSchema = z.enum([
  'day',
  'week',
  'month',
  'quarter',
  'year',
  'all_time',
]);

export type StatisticsPeriod = z.infer<typeof statisticsPeriodSchema>;

// ===========================================================================
// GET CLIENT STATISTICS OVERVIEW
// ===========================================================================

export const getStatisticsOverviewSchema = z.object({
  period: statisticsPeriodSchema.default('month'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type GetStatisticsOverviewInput = z.infer<typeof getStatisticsOverviewSchema>;

export interface ClientCountByType {
  company: number;
  individual: number;
}

export interface ClientCountByStatus {
  active: number;
  inactive: number;
  suspended: number;
  pending: number;
}

export interface StatisticsOverview {
  totalClients: number;
  activeClients: number;
  archivedClients: number;
  byType: ClientCountByType;
  byStatus: ClientCountByStatus;
  newClientsThisPeriod: number;
  newClientsChange: number; // percentage change from previous period
  period: StatisticsPeriod;
  periodStart: Date;
  periodEnd: Date;
}

// ===========================================================================
// GET CLIENT GROWTH STATISTICS
// ===========================================================================

export const getClientGrowthSchema = z.object({
  period: statisticsPeriodSchema.default('month'),
  intervals: z.number().int().min(1).max(52).default(12),
});

export type GetClientGrowthInput = z.infer<typeof getClientGrowthSchema>;

export interface GrowthDataPoint {
  date: Date;
  totalClients: number;
  newClients: number;
  archivedClients: number;
  netGrowth: number;
}

export interface ClientGrowthResult {
  dataPoints: GrowthDataPoint[];
  totalGrowth: number;
  averageGrowthRate: number;
  period: StatisticsPeriod;
}

// ===========================================================================
// GET TAG STATISTICS
// ===========================================================================

export const getTagStatisticsSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  includeArchived: z.boolean().default(false),
});

export type GetTagStatisticsInput = z.infer<typeof getTagStatisticsSchema>;

export interface TagStatistic {
  tag: string;
  count: number;
  percentage: number;
}

export interface TagStatisticsResult {
  tags: TagStatistic[];
  totalTaggedClients: number;
  totalUntaggedClients: number;
  averageTagsPerClient: number;
}

// ===========================================================================
// GET RISK DISTRIBUTION
// ===========================================================================

export const getRiskDistributionSchema = z.object({
  includeArchived: z.boolean().default(false),
});

export type GetRiskDistributionInput = z.infer<typeof getRiskDistributionSchema>;

export interface RiskDistributionItem {
  level: 'low' | 'medium' | 'high' | 'critical' | 'not_assessed';
  count: number;
  percentage: number;
}

export interface RiskDistributionResult {
  distribution: RiskDistributionItem[];
  totalAssessed: number;
  totalNotAssessed: number;
  averageRiskScore: number;
}

// ===========================================================================
// GET ACTIVITY STATISTICS
// ===========================================================================

export const getActivityStatisticsSchema = z.object({
  period: statisticsPeriodSchema.default('month'),
  clientId: z.string().uuid().optional(),
});

export type GetActivityStatisticsInput = z.infer<typeof getActivityStatisticsSchema>;

export interface ActivityByType {
  type: string;
  count: number;
}

export interface ActivityStatisticsResult {
  totalEvents: number;
  byType: ActivityByType[];
  mostActiveClients: Array<{
    clientId: string;
    clientName: string;
    eventCount: number;
  }>;
  averageEventsPerClient: number;
  period: StatisticsPeriod;
}

// ===========================================================================
// GET VAT STATUS STATISTICS
// ===========================================================================

export const getVatStatisticsSchema = z.object({
  includeArchived: z.boolean().default(false),
});

export type GetVatStatisticsInput = z.infer<typeof getVatStatisticsSchema>;

export interface VatStatusDistribution {
  status: 'active' | 'not_registered' | 'invalid' | 'exempt' | 'not_validated';
  count: number;
  percentage: number;
}

export interface VatStatisticsResult {
  distribution: VatStatusDistribution[];
  totalValidated: number;
  totalNotValidated: number;
  validationRate: number;
}

// ===========================================================================
// GET TOP CLIENTS
// ===========================================================================

export const getTopClientsSchema = z.object({
  metric: z.enum(['events', 'contacts', 'documents', 'risk_score']).default('events'),
  limit: z.number().int().min(1).max(100).default(10),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type GetTopClientsInput = z.infer<typeof getTopClientsSchema>;

export interface TopClientItem {
  clientId: string;
  clientName: string;
  clientType: 'company' | 'individual';
  metricValue: number;
  metricLabel: string;
}

export interface TopClientsResult {
  clients: TopClientItem[];
  metric: string;
  total: number;
}

// ===========================================================================
// DASHBOARD SUMMARY
// ===========================================================================

export const getDashboardSummarySchema = z.object({
  period: statisticsPeriodSchema.default('month'),
});

export type GetDashboardSummaryInput = z.infer<typeof getDashboardSummarySchema>;

export interface DashboardSummary {
  overview: StatisticsOverview;
  growth: {
    last7Days: number;
    last30Days: number;
    trend: 'up' | 'down' | 'stable';
  };
  alerts: {
    highRiskClients: number;
    expiredVatValidations: number;
    incompleteProfiles: number;
  };
  quickStats: {
    avgEventsPerClient: number;
    avgContactsPerClient: number;
    topTag: string | null;
  };
}

// ===========================================================================
// EXPORT STATISTICS
// ===========================================================================

export const exportStatisticsSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'json', 'pdf']).default('csv'),
  sections: z
    .array(z.enum(['overview', 'growth', 'tags', 'risk', 'activity', 'vat']))
    .default(['overview', 'growth']),
  period: statisticsPeriodSchema.default('month'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type ExportStatisticsInput = z.infer<typeof exportStatisticsSchema>;

export interface ExportStatisticsResult {
  exportId: string;
  format: string;
  sections: string[];
  downloadUrl?: string;
  expiresAt?: Date;
}
