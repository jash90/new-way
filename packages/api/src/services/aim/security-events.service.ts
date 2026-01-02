import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';
import type {
  ListSecurityAlertsInput,
  SecurityAlertOutput,
  PaginatedSecurityAlerts,
  GetAlertStatsInput,
  AlertStatsResponse,
  AcknowledgeAlertInput,
  ResolveAlertInput,
  DismissAlertInput,
  AlertUpdateResult,
  CreateNotificationSubscriptionInput,
  UpdateNotificationSubscriptionInput,
  ListNotificationSubscriptionsInput,
  NotificationSubscriptionOutput,
  SecurityDashboardSummary,
  AlertSeverity,
  SecurityAlertType,
  SecurityAlertPagination,
} from '@ksiegowacrm/shared';

// Type for where clause
type WhereClause = Record<string, unknown>;

// Cache TTL for dashboard summary (1 minute)
const DASHBOARD_CACHE_TTL_SECONDS = 60;
const DASHBOARD_CACHE_KEY = 'security:dashboard:summary';

// Interface for creating alerts (internal use)
interface CreateAlertInput {
  userId?: string;
  type: SecurityAlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export class SecurityEventsService {
  private readonly prisma: PrismaClient;
  private readonly redis: Redis;
  private readonly auditLogger: AuditLogger;

  constructor(prisma: PrismaClient, redis: Redis, auditLogger: AuditLogger) {
    this.prisma = prisma;
    this.redis = redis;
    this.auditLogger = auditLogger;
  }

  // ===========================================================================
  // LIST SECURITY ALERTS
  // ===========================================================================

  /**
   * List security alerts with filtering and pagination
   */
  async listAlerts(input: ListSecurityAlertsInput): Promise<PaginatedSecurityAlerts> {
    try {
      const { filter = {}, pagination = {} as Partial<SecurityAlertPagination> } = input;
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = pagination;

      // Build where clause
      const where: WhereClause = this.buildAlertsWhereClause(filter);

      // Execute count and find in parallel
      const [total, items] = await Promise.all([
        this.prisma.securityAlert.count({ where }),
        this.prisma.securityAlert.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            user: {
              select: { id: true, email: true },
            },
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
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        items: items.map((item) => this.mapToSecurityAlertOutput(item)),
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Wystąpił błąd podczas pobierania alertów bezpieczeństwa',
        cause: error,
      });
    }
  }

  // ===========================================================================
  // GET SINGLE ALERT
  // ===========================================================================

  /**
   * Get single security alert by ID
   */
  async getAlert(id: string): Promise<SecurityAlertOutput> {
    const alert = await this.prisma.securityAlert.findUnique({
      where: { id },
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

    if (!alert) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Alert bezpieczeństwa nie został znaleziony',
      });
    }

    return this.mapToSecurityAlertOutput(alert);
  }

  // ===========================================================================
  // ACKNOWLEDGE ALERT
  // ===========================================================================

  /**
   * Acknowledge an active security alert
   */
  async acknowledgeAlert(
    alertId: string,
    actorId: string,
    input?: Pick<AcknowledgeAlertInput, 'notes'>,
  ): Promise<AlertUpdateResult> {
    const alert = await this.prisma.securityAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Alert bezpieczeństwa nie został znaleziony',
      });
    }

    if (alert.status === 'resolved' || alert.status === 'dismissed') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Alert o statusie "${alert.status}" nie można zaakceptować`,
      });
    }

    const now = new Date();
    const existingMetadata = (alert.metadata as Record<string, unknown>) || {};

    const updatedAlert = await this.prisma.securityAlert.update({
      where: { id: alertId },
      data: {
        status: 'acknowledged',
        metadata: {
          ...existingMetadata,
          acknowledgedBy: actorId,
          acknowledgedAt: now.toISOString(),
          notes: input?.notes,
        },
      },
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

    // Log audit event
    await this.auditLogger.log({
      eventType: 'SECURITY_ALERT_ACKNOWLEDGED',
      actorId,
      targetId: alert.userId ?? undefined,
      targetType: 'security_alert',
      metadata: {
        alertId,
        alertType: alert.type,
        notes: input?.notes,
      },
    });

    // Invalidate dashboard cache
    await this.redis.del(DASHBOARD_CACHE_KEY);

    return {
      success: true,
      alert: this.mapToSecurityAlertOutput(updatedAlert),
      message: 'Alert został zaakceptowany',
    };
  }

  // ===========================================================================
  // RESOLVE ALERT
  // ===========================================================================

  /**
   * Resolve a security alert with resolution details
   */
  async resolveAlert(
    alertId: string,
    actorId: string,
    input: Pick<ResolveAlertInput, 'resolution' | 'preventionActions'>,
  ): Promise<AlertUpdateResult> {
    const alert = await this.prisma.securityAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Alert bezpieczeństwa nie został znaleziony',
      });
    }

    if (alert.status === 'resolved' || alert.status === 'dismissed') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Alert o statusie "${alert.status}" nie można rozwiązać`,
      });
    }

    const now = new Date();
    const existingMetadata = (alert.metadata as Record<string, unknown>) || {};

    const updatedAlert = await this.prisma.securityAlert.update({
      where: { id: alertId },
      data: {
        status: 'resolved',
        resolvedAt: now,
        resolvedBy: actorId,
        metadata: {
          ...existingMetadata,
          resolution: input.resolution,
          preventionActions: input.preventionActions,
          resolvedAt: now.toISOString(),
        },
      },
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

    // Log audit event
    await this.auditLogger.log({
      eventType: 'SECURITY_ALERT_RESOLVED',
      actorId,
      targetId: alert.userId ?? undefined,
      targetType: 'security_alert',
      metadata: {
        alertId,
        alertType: alert.type,
        resolution: input.resolution,
        preventionActions: input.preventionActions,
      },
    });

    // Invalidate dashboard cache
    await this.redis.del(DASHBOARD_CACHE_KEY);

    return {
      success: true,
      alert: this.mapToSecurityAlertOutput(updatedAlert),
      message: 'Alert został rozwiązany',
    };
  }

  // ===========================================================================
  // DISMISS ALERT
  // ===========================================================================

  /**
   * Dismiss a security alert with reason
   */
  async dismissAlert(
    alertId: string,
    actorId: string,
    input: Pick<DismissAlertInput, 'reason' | 'falsePositive'>,
  ): Promise<AlertUpdateResult> {
    const alert = await this.prisma.securityAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Alert bezpieczeństwa nie został znaleziony',
      });
    }

    if (alert.status === 'resolved' || alert.status === 'dismissed') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Alert o statusie "${alert.status}" nie można odrzucić`,
      });
    }

    const now = new Date();
    const existingMetadata = (alert.metadata as Record<string, unknown>) || {};

    const updatedAlert = await this.prisma.securityAlert.update({
      where: { id: alertId },
      data: {
        status: 'dismissed',
        metadata: {
          ...existingMetadata,
          dismissedBy: actorId,
          dismissedAt: now.toISOString(),
          dismissReason: input.reason,
          falsePositive: input.falsePositive ?? false,
        },
      },
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

    // Log audit event
    await this.auditLogger.log({
      eventType: 'SECURITY_ALERT_DISMISSED',
      actorId,
      targetId: alert.userId ?? undefined,
      targetType: 'security_alert',
      metadata: {
        alertId,
        alertType: alert.type,
        reason: input.reason,
        falsePositive: input.falsePositive ?? false,
      },
    });

    // Invalidate dashboard cache
    await this.redis.del(DASHBOARD_CACHE_KEY);

    return {
      success: true,
      alert: this.mapToSecurityAlertOutput(updatedAlert),
      message: 'Alert został odrzucony',
    };
  }

  // ===========================================================================
  // GET ALERT STATISTICS
  // ===========================================================================

  /**
   * Get alert statistics with optional filtering and grouping
   */
  async getAlertStats(input: GetAlertStatsInput): Promise<AlertStatsResponse> {
    const { startDate, endDate, userId, groupBy = 'type' } = input;

    // Build base where clause
    const baseWhere: WhereClause = {};
    if (userId) baseWhere.userId = userId;
    if (startDate || endDate) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (startDate) createdAt.gte = new Date(startDate);
      if (endDate) createdAt.lte = new Date(endDate);
      baseWhere.createdAt = createdAt;
    }

    // Get counts for different statuses
    const [
      totalCount,
      activeCount,
      acknowledgedCount,
      resolvedCount,
      dismissedCount,
      criticalActiveCount,
      highActiveCount,
    ] = await Promise.all([
      this.prisma.securityAlert.count({ where: baseWhere }),
      this.prisma.securityAlert.count({ where: { ...baseWhere, status: 'active' } }),
      this.prisma.securityAlert.count({ where: { ...baseWhere, status: 'acknowledged' } }),
      this.prisma.securityAlert.count({ where: { ...baseWhere, status: 'resolved' } }),
      this.prisma.securityAlert.count({ where: { ...baseWhere, status: 'dismissed' } }),
      this.prisma.securityAlert.count({
        where: { ...baseWhere, status: 'active', severity: 'critical' },
      }),
      this.prisma.securityAlert.count({
        where: { ...baseWhere, status: 'active', severity: 'high' },
      }),
    ]);

    const result: AlertStatsResponse = {
      totalCount,
      activeCount,
      acknowledgedCount,
      resolvedCount,
      dismissedCount,
      criticalActiveCount,
      highActiveCount,
      startDate,
      endDate,
    };

    // Group by type or severity
    if (groupBy === 'type') {
      const byType = await this.prisma.securityAlert.groupBy({
        by: ['type'],
        where: baseWhere,
        _count: { id: true },
      });

      result.byType = await Promise.all(
        byType.map(async (item) => {
          const activeTypeCount = await this.prisma.securityAlert.count({
            where: { ...baseWhere, type: item.type, status: 'active' },
          });
          const resolvedTypeCount = await this.prisma.securityAlert.count({
            where: { ...baseWhere, type: item.type, status: 'resolved' },
          });

          return {
            type: item.type as SecurityAlertType,
            count: item._count.id,
            activeCount: activeTypeCount,
            resolvedCount: resolvedTypeCount,
          };
        }),
      );
    } else if (groupBy === 'severity') {
      const bySeverity = await this.prisma.securityAlert.groupBy({
        by: ['severity'],
        where: baseWhere,
        _count: { id: true },
      });

      result.bySeverity = await Promise.all(
        bySeverity.map(async (item) => {
          const activeSeverityCount = await this.prisma.securityAlert.count({
            where: { ...baseWhere, severity: item.severity, status: 'active' },
          });

          return {
            severity: item.severity as AlertSeverity,
            count: item._count.id,
            activeCount: activeSeverityCount,
          };
        }),
      );
    }

    return result;
  }

  // ===========================================================================
  // NOTIFICATION SUBSCRIPTIONS - CRUD
  // ===========================================================================

  /**
   * Create a new notification subscription
   */
  async createNotificationSubscription(
    userId: string,
    input: CreateNotificationSubscriptionInput,
  ): Promise<NotificationSubscriptionOutput> {
    // Check if subscription already exists for this channel/endpoint
    const existing = await this.prisma.notificationSubscription.findFirst({
      where: {
        userId,
        channel: input.channel,
        endpoint: input.endpoint,
      },
    });

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Subskrypcja dla tego kanału i punktu końcowego już istnieje',
      });
    }

    const subscription = await this.prisma.notificationSubscription.create({
      data: {
        userId,
        channel: input.channel,
        endpoint: input.endpoint,
        eventTypes: input.eventTypes,
        metadata: input.severities ? { severities: input.severities } : {},
      },
    });

    // Log audit event
    await this.auditLogger.log({
      eventType: 'NOTIFICATION_SUBSCRIPTION_CREATED',
      actorId: userId,
      targetType: 'notification_subscription',
      metadata: {
        subscriptionId: subscription.id,
        channel: input.channel,
        eventTypes: input.eventTypes,
      },
    });

    return this.mapToNotificationSubscriptionOutput(subscription);
  }

  /**
   * Update an existing notification subscription
   */
  async updateNotificationSubscription(
    userId: string,
    input: UpdateNotificationSubscriptionInput,
  ): Promise<NotificationSubscriptionOutput> {
    const subscription = await this.prisma.notificationSubscription.findUnique({
      where: { id: input.id },
    });

    if (!subscription) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Subskrypcja nie została znaleziona',
      });
    }

    if (subscription.userId !== userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Brak uprawnień do modyfikacji tej subskrypcji',
      });
    }

    const updateData: Record<string, unknown> = {};
    if (input.eventTypes !== undefined) updateData.eventTypes = input.eventTypes;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.severities !== undefined) {
      const existingMetadata = (subscription.metadata as Record<string, unknown>) || {};
      updateData.metadata = { ...existingMetadata, severities: input.severities };
    }

    const updated = await this.prisma.notificationSubscription.update({
      where: { id: input.id },
      data: updateData,
    });

    // Log audit event
    await this.auditLogger.log({
      eventType: 'NOTIFICATION_SUBSCRIPTION_UPDATED',
      actorId: userId,
      targetType: 'notification_subscription',
      metadata: {
        subscriptionId: input.id,
        changes: Object.keys(updateData),
      },
    });

    return this.mapToNotificationSubscriptionOutput(updated);
  }

  /**
   * Delete a notification subscription
   */
  async deleteNotificationSubscription(
    userId: string,
    subscriptionId: string,
  ): Promise<{ success: boolean }> {
    const subscription = await this.prisma.notificationSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Subskrypcja nie została znaleziona',
      });
    }

    if (subscription.userId !== userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Brak uprawnień do usunięcia tej subskrypcji',
      });
    }

    await this.prisma.notificationSubscription.delete({
      where: { id: subscriptionId },
    });

    // Log audit event
    await this.auditLogger.log({
      eventType: 'NOTIFICATION_SUBSCRIPTION_DELETED',
      actorId: userId,
      targetType: 'notification_subscription',
      metadata: {
        subscriptionId,
        channel: subscription.channel,
      },
    });

    return { success: true };
  }

  /**
   * List notification subscriptions for a user
   */
  async listNotificationSubscriptions(
    userId: string,
    input: ListNotificationSubscriptionsInput,
  ): Promise<NotificationSubscriptionOutput[]> {
    const where: WhereClause = { userId };
    if (input.channel) where.channel = input.channel;
    if (input.isActive !== undefined) where.isActive = input.isActive;

    const subscriptions = await this.prisma.notificationSubscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return subscriptions.map((s) => this.mapToNotificationSubscriptionOutput(s));
  }

  // ===========================================================================
  // DASHBOARD SUMMARY
  // ===========================================================================

  /**
   * Get security dashboard summary with key metrics
   */
  async getDashboardSummary(): Promise<SecurityDashboardSummary> {
    // Check cache first
    const cached = await this.redis.get(DASHBOARD_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get counts
    const [activeAlerts, criticalAlerts, highAlerts, alertsLast24h, alertsLast7d] =
      await Promise.all([
        this.prisma.securityAlert.count({ where: { status: 'active' } }),
        this.prisma.securityAlert.count({ where: { status: 'active', severity: 'critical' } }),
        this.prisma.securityAlert.count({ where: { status: 'active', severity: 'high' } }),
        this.prisma.securityAlert.count({ where: { createdAt: { gte: last24h } } }),
        this.prisma.securityAlert.count({ where: { createdAt: { gte: last7d } } }),
      ]);

    // Get top alert types
    const topTypes = await this.prisma.securityAlert.groupBy({
      by: ['type'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    // Get recent alerts
    const recentAlerts = await this.prisma.securityAlert.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 5,
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

    const summary: SecurityDashboardSummary = {
      activeAlerts,
      criticalAlerts,
      highAlerts,
      alertsLast24h,
      alertsLast7d,
      topAlertTypes: topTypes.map((t) => ({
        type: t.type as SecurityAlertType,
        count: t._count.id,
      })),
      recentAlerts: recentAlerts.map((a) => this.mapToSecurityAlertOutput(a)),
      generatedAt: now.toISOString(),
    };

    // Cache the result
    await this.redis.setex(DASHBOARD_CACHE_KEY, DASHBOARD_CACHE_TTL_SECONDS, JSON.stringify(summary));

    return summary;
  }

  // ===========================================================================
  // CREATE ALERT (Internal use)
  // ===========================================================================

  /**
   * Create a new security alert (for internal use by other services)
   */
  async createAlert(input: CreateAlertInput): Promise<SecurityAlertOutput> {
    const alert = await this.prisma.securityAlert.create({
      data: {
        userId: input.userId,
        type: input.type,
        severity: input.severity,
        status: 'active',
        title: input.title,
        description: input.description,
        metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
        ipAddress: input.ipAddress,
      },
    });

    // Log audit event
    await this.auditLogger.log({
      eventType: 'SECURITY_ALERT_CREATED',
      actorId: input.userId,
      targetType: 'security_alert',
      metadata: {
        alertId: alert.id,
        alertType: input.type,
        severity: input.severity,
      },
    });

    // Invalidate dashboard cache
    await this.redis.del(DASHBOARD_CACHE_KEY);

    return this.mapToSecurityAlertOutput(alert);
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Build where clause for security alerts filtering
   */
  private buildAlertsWhereClause(filter: ListSecurityAlertsInput['filter']): WhereClause {
    if (!filter) return {};

    const where: WhereClause = {};

    if (filter.userId) where.userId = filter.userId;
    if (filter.types?.length) where.type = { in: filter.types };
    if (filter.severities?.length) where.severity = { in: filter.severities };
    if (filter.statuses?.length) where.status = { in: filter.statuses };
    if (filter.ipAddress) where.ipAddress = filter.ipAddress;

    if (filter.startDate || filter.endDate) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (filter.startDate) createdAt.gte = new Date(filter.startDate);
      if (filter.endDate) createdAt.lte = new Date(filter.endDate);
      where.createdAt = createdAt;
    }

    if (filter.searchTerm) {
      where.OR = [
        { title: { contains: filter.searchTerm, mode: 'insensitive' } },
        { description: { contains: filter.searchTerm, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  /**
   * Map Prisma security alert to output type
   */
  private mapToSecurityAlertOutput(alert: any): SecurityAlertOutput {
    return {
      id: alert.id,
      userId: alert.userId,
      type: alert.type,
      severity: alert.severity,
      status: alert.status,
      title: alert.title,
      description: alert.description,
      metadata: alert.metadata || {},
      ipAddress: alert.ipAddress,
      resolvedAt: alert.resolvedAt?.toISOString() ?? null,
      resolvedBy: alert.resolvedBy,
      createdAt: alert.createdAt.toISOString(),
      user: alert.user
        ? {
            id: alert.user.id,
            email: alert.user.email,
          }
        : null,
      escalations: alert.escalations?.map((e: any) => ({
        id: e.id,
        level: e.level,
        escalatedAt: e.escalatedAt.toISOString(),
        acknowledgedAt: e.acknowledgedAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Map Prisma notification subscription to output type
   */
  private mapToNotificationSubscriptionOutput(subscription: any): NotificationSubscriptionOutput {
    const metadata = (subscription.metadata as Record<string, unknown>) || {};

    return {
      id: subscription.id,
      channel: subscription.channel,
      endpoint: subscription.endpoint,
      eventTypes: subscription.eventTypes,
      severities: metadata.severities ? (metadata.severities as ('low' | 'medium' | 'high' | 'critical')[]) : null,
      isActive: subscription.isActive,
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
    };
  }
}
