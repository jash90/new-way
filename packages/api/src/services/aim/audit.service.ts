import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type {
  ListAuditLogsInput,
  AuditLogEntry,
  PaginatedAuditLogs,
  GetAuditStatsInput,
  AuditStatsResponse,
  ExportAuditLogsInput,
  AuditExportResult,
  AuditStatsByEventType,
  AuditStatsByPeriod,
  AuditLogPagination,
} from '@ksiegowacrm/shared';

// Type for where clause - using record since we don't import Prisma namespace
type WhereClause = Record<string, unknown>;

// Cache TTL for statistics (5 minutes)
const STATS_CACHE_TTL_SECONDS = 5 * 60;

// Sensitive metadata fields to exclude when includeSensitiveData is false
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'key', 'credential', 'hash'];

export class AuditService {
  private readonly prisma: PrismaClient;
  private readonly redis: Redis;

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
  }

  /**
   * List audit logs with filtering and pagination
   */
  async listAuditLogs(input: ListAuditLogsInput): Promise<PaginatedAuditLogs> {
    try {
      const { filter = {}, pagination = {} as Partial<AuditLogPagination> } = input;
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = pagination;

      // Build where clause
      const where: WhereClause = this.buildWhereClause(filter);

      // Execute count and find in parallel
      const [total, items] = await Promise.all([
        this.prisma.authAuditLog.count({ where }),
        this.prisma.authAuditLog.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            actor: {
              select: { id: true, email: true },
            },
            target: {
              select: { id: true, email: true },
            },
          },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        items: items.map((item) => this.mapToAuditLogEntry(item)),
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
        message: 'Wystąpił błąd podczas pobierania logów audytu',
        cause: error,
      });
    }
  }

  /**
   * Get single audit log by ID
   */
  async getAuditLog(id: string): Promise<AuditLogEntry> {
    const log = await this.prisma.authAuditLog.findUnique({
      where: { id },
      include: {
        actor: {
          select: { id: true, email: true },
        },
        target: {
          select: { id: true, email: true },
        },
      },
    });

    if (!log) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Wpis logu audytu nie został znaleziony',
      });
    }

    return this.mapToAuditLogEntry(log);
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(input: GetAuditStatsInput): Promise<AuditStatsResponse> {
    const { groupBy = 'eventType', startDate, endDate, actorId } = input;

    // Check cache first
    const cacheKey = this.buildStatsCacheKey(input);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Build base where clause
    const where: WhereClause = {};
    if (actorId) where.actorId = actorId;
    if (startDate || endDate) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (startDate) createdAt.gte = new Date(startDate);
      if (endDate) createdAt.lte = new Date(endDate);
      where.createdAt = createdAt;
    }

    // Get total counts
    const [totalCount, successCount, failureCount] = await Promise.all([
      this.prisma.authAuditLog.count({ where }),
      this.prisma.authAuditLog.count({ where: { ...where, success: true } }),
      this.prisma.authAuditLog.count({ where: { ...where, success: false } }),
    ]);

    let result: AuditStatsResponse = {
      totalCount,
      successCount,
      failureCount,
      startDate,
      endDate,
    };

    if (groupBy === 'eventType') {
      result.byEventType = await this.getStatsByEventType(where);
    } else {
      result.byPeriod = await this.getStatsByPeriod(groupBy, where, startDate, endDate);
    }

    // Cache results
    await this.redis.setex(cacheKey, STATS_CACHE_TTL_SECONDS, JSON.stringify(result));

    return result;
  }

  /**
   * Export audit logs in specified format
   */
  async exportAuditLogs(input: ExportAuditLogsInput): Promise<AuditExportResult> {
    const { format, filter = {}, maxRecords = 10000, includeSensitiveData = false } = input;

    // Build where clause
    const where: WhereClause = this.buildWhereClause(filter);

    // Fetch logs with limit
    const logs = await this.prisma.authAuditLog.findMany({
      where,
      take: maxRecords,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: { id: true, email: true },
        },
        target: {
          select: { id: true, email: true },
        },
      },
    });

    // Map and optionally filter sensitive data
    const mappedLogs = logs.map((log) => {
      const entry = this.mapToAuditLogEntry(log);
      if (!includeSensitiveData) {
        entry.metadata = this.filterSensitiveMetadata(entry.metadata);
      }
      return entry;
    });

    // Generate content based on format
    let content: string | undefined;
    let fileSize: number;

    switch (format) {
      case 'json':
        content = JSON.stringify(mappedLogs, null, 2);
        fileSize = Buffer.byteLength(content, 'utf-8');
        break;
      case 'csv':
        content = this.convertToCSV(mappedLogs);
        fileSize = Buffer.byteLength(content, 'utf-8');
        break;
      case 'pdf':
        // For PDF, we would typically generate and store the file,
        // returning a download URL. For now, return placeholder.
        fileSize = mappedLogs.length * 500; // Estimate
        break;
      default:
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nieobsługiwany format eksportu',
        });
    }

    return {
      format,
      recordCount: mappedLogs.length,
      fileSize,
      content: format !== 'pdf' ? content : undefined,
      expiresAt: format === 'pdf' ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : undefined,
    };
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  private buildWhereClause(filter: ListAuditLogsInput['filter'] = {}): WhereClause {
    const where: WhereClause = {};

    if (filter.actorId) where.actorId = filter.actorId;
    if (filter.targetId) where.targetId = filter.targetId;
    if (filter.ipAddress) where.ipAddress = filter.ipAddress;
    if (filter.correlationId) where.correlationId = filter.correlationId;
    if (filter.success !== undefined) where.success = filter.success;

    if (filter.eventTypes && filter.eventTypes.length > 0) {
      where.eventType = { in: filter.eventTypes };
    }

    if (filter.startDate || filter.endDate) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (filter.startDate) createdAt.gte = new Date(filter.startDate);
      if (filter.endDate) createdAt.lte = new Date(filter.endDate);
      where.createdAt = createdAt;
    }

    // Search term - search in metadata JSON or error message
    if (filter.searchTerm) {
      where.OR = [
        { errorMessage: { contains: filter.searchTerm, mode: 'insensitive' } },
        // For metadata search, we'd need raw query or full-text search
        // This is a simplified version
      ];
    }

    return where;
  }

  private mapToAuditLogEntry(log: any): AuditLogEntry {
    return {
      id: log.id,
      eventType: log.eventType,
      actorId: log.actorId,
      targetType: log.targetType,
      targetId: log.targetId,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      correlationId: log.correlationId,
      metadata: log.metadata as Record<string, unknown>,
      success: log.success,
      errorMessage: log.errorMessage,
      createdAt: log.createdAt.toISOString(),
      actor: log.actor
        ? { id: log.actor.id, email: log.actor.email }
        : null,
      target: log.target
        ? { id: log.target.id, email: log.target.email }
        : null,
    };
  }

  private async getStatsByEventType(
    where: WhereClause,
  ): Promise<AuditStatsByEventType[]> {
    const grouped = await this.prisma.authAuditLog.groupBy({
      by: ['eventType', 'success'],
      where,
      _count: { _all: true },
    });

    // Aggregate by event type
    const aggregated = new Map<
      string,
      { count: number; successCount: number; failureCount: number }
    >();

    for (const item of grouped) {
      const eventType = item.eventType;
      if (!aggregated.has(eventType)) {
        aggregated.set(eventType, { count: 0, successCount: 0, failureCount: 0 });
      }
      const agg = aggregated.get(eventType)!;
      agg.count += item._count._all;
      if (item.success) {
        agg.successCount += item._count._all;
      } else {
        agg.failureCount += item._count._all;
      }
    }

    return Array.from(aggregated.entries()).map(([eventType, stats]) => ({
      eventType: eventType as AuditStatsByEventType['eventType'],
      count: stats.count,
      successCount: stats.successCount,
      failureCount: stats.failureCount,
    }));
  }

  private async getStatsByPeriod(
    groupBy: 'day' | 'week' | 'month' | 'hour',
    where: WhereClause,
    startDate?: string,
    endDate?: string,
  ): Promise<AuditStatsByPeriod[]> {
    // Build date format based on groupBy
    let dateFormat: string;
    switch (groupBy) {
      case 'hour':
        dateFormat = 'YYYY-MM-DD"T"HH24';
        break;
      case 'day':
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'week':
        dateFormat = 'IYYY-"W"IW';
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        break;
    }

    // Build where conditions for raw query
    const conditions: string[] = [];
    if (where.actorId) {
      conditions.push(`"actorId" = '${where.actorId}'`);
    }
    if (startDate) {
      conditions.push(`"createdAt" >= '${startDate}'`);
    }
    if (endDate) {
      conditions.push(`"createdAt" <= '${endDate}'`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Execute raw query
    const result = await this.prisma.$queryRaw<
      Array<{
        period: string;
        count: bigint;
        success_count: bigint;
        failure_count: bigint;
      }>
    >([
      `SELECT
        TO_CHAR("createdAt", '${dateFormat}') as period,
        COUNT(*) as count,
        SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failure_count
      FROM "AuthAuditLog"
      ${whereClause}
      GROUP BY period
      ORDER BY period DESC`,
    ] as unknown as TemplateStringsArray);

    return result.map((row) => ({
      period: row.period,
      count: Number(row.count),
      successCount: Number(row.success_count),
      failureCount: Number(row.failure_count),
    }));
  }

  private buildStatsCacheKey(input: GetAuditStatsInput): string {
    const parts = ['audit:stats', input.groupBy];
    if (input.startDate) parts.push(input.startDate);
    if (input.endDate) parts.push(input.endDate);
    if (input.actorId) parts.push(input.actorId);
    return parts.join(':');
  }

  private filterSensitiveMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (!SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field))) {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  private convertToCSV(logs: AuditLogEntry[]): string {
    const headers = [
      'id',
      'eventType',
      'actorId',
      'actorEmail',
      'targetId',
      'targetEmail',
      'ipAddress',
      'userAgent',
      'correlationId',
      'success',
      'errorMessage',
      'createdAt',
      'metadata',
    ];

    const escapeCSV = (value: string | null | undefined): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = logs.map((log) => [
      escapeCSV(log.id),
      escapeCSV(log.eventType),
      escapeCSV(log.actorId),
      escapeCSV(log.actor?.email),
      escapeCSV(log.targetId),
      escapeCSV(log.target?.email),
      escapeCSV(log.ipAddress),
      escapeCSV(log.userAgent),
      escapeCSV(log.correlationId),
      escapeCSV(String(log.success)),
      escapeCSV(log.errorMessage),
      escapeCSV(log.createdAt),
      escapeCSV(JSON.stringify(log.metadata)),
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }
}
