import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { AuditLogger } from '../../utils/audit-logger';
import type {
  AdvancedSearchInput,
  SearchSuggestionInput,
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
  DeleteSavedSearchInput,
  ListSavedSearchesInput,
  AdvancedSearchResult,
  SearchResultItem,
  SearchFacets,
  SearchSuggestionsResult,
  SavedSearchCreateResult,
  SavedSearchUpdateResult,
  SavedSearchDeleteResult,
  SavedSearchListResult,
} from '@ksiegowacrm/shared';
// import { TRPCError } from '@trpc/server'; // Reserved for future use

/**
 * SearchService (CRM-008)
 * Handles advanced search functionality
 *
 * TODO: This service requires the following Prisma schema additions:
 * - Contact model for contact search functionality
 * - SavedSearch model for saved searches feature
 *
 * Methods that don't require these models work normally.
 * Methods that require these models throw NotImplementedError.
 */

class NotImplementedError extends Error {
  constructor(feature: string, missingModel: string) {
    super(`${feature} requires the ${missingModel} Prisma model which is not yet implemented`);
    this.name = 'NotImplementedError';
  }
}

export class SearchService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private auditLogger: AuditLogger,
    private userId: string,
    private organizationId: string | null
  ) {
    // Suppress unused warnings - reserved for future implementation
    void this.redis;
    void this.auditLogger;
  }

  // ===========================================
  // PRIVATE HELPERS
  // ===========================================

  private getDateRangeFromPreset(preset: string): { gte?: Date; lte?: Date } {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
      case 'today':
        return { gte: startOfDay };
      case 'yesterday': {
        const yesterday = new Date(startOfDay);
        yesterday.setDate(yesterday.getDate() - 1);
        return { gte: yesterday, lte: startOfDay };
      }
      case 'last7days': {
        const last7 = new Date(startOfDay);
        last7.setDate(last7.getDate() - 7);
        return { gte: last7 };
      }
      case 'last30days': {
        const last30 = new Date(startOfDay);
        last30.setDate(last30.getDate() - 30);
        return { gte: last30 };
      }
      case 'last90days': {
        const last90 = new Date(startOfDay);
        last90.setDate(last90.getDate() - 90);
        return { gte: last90 };
      }
      case 'thisMonth': {
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return { gte: thisMonth };
      }
      case 'lastMonth': {
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return { gte: lastMonthStart, lte: lastMonthEnd };
      }
      case 'thisYear': {
        const thisYear = new Date(now.getFullYear(), 0, 1);
        return { gte: thisYear };
      }
      default:
        return {};
    }
  }

  private buildOwnershipFilter(): Record<string, unknown> {
    if (this.organizationId) {
      return {
        OR: [{ ownerId: this.userId }, { organizationId: this.organizationId }],
      };
    }
    return { ownerId: this.userId };
  }

  private formatClientAsSearchResult(client: {
    id: string;
    displayName: string | null;
    email: string | null;
    type: string;
    status: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
  }): SearchResultItem {
    // Map Prisma client type to SearchResultItem type ('individual' | 'company' | undefined)
    const mappedType: 'individual' | 'company' | undefined =
      client.type === 'individual' || client.type === 'company' ? client.type : undefined;

    return {
      id: client.id,
      entityType: 'client',
      displayName: client.displayName || '', // Convert null to empty string
      email: client.email,
      type: mappedType,
      status: client.status,
      tags: client.tags || [],
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }

  // ===========================================
  // ADVANCED SEARCH
  // ===========================================

  async advancedSearch(input: AdvancedSearchInput): Promise<AdvancedSearchResult> {
    const startTime = Date.now();
    const { entityType, query, filters, sortBy, sortOrder, page, limit, includeFacets } =
      input;

    const skip = (page - 1) * limit;
    let results: SearchResultItem[] = [];
    let total = 0;
    let facets: SearchFacets | undefined;

    if (entityType === 'client' || entityType === 'all') {
      const clientResults = await this.searchClients(query, filters, sortBy, sortOrder, skip, limit);
      results = results.concat(clientResults.results);
      total += clientResults.total;

      if (includeFacets && entityType === 'client') {
        facets = await this.getClientFacets();
      }
    }

    // Contact search is not available - requires Contact Prisma model
    if (entityType === 'contact') {
      throw new NotImplementedError('searchContacts', 'Contact');
    }

    // If searching all, just return client results for now (contact search unavailable)
    if (entityType === 'all' && sortBy !== 'relevance') {
      results.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sortBy] || '';
        const bVal = (b as unknown as Record<string, unknown>)[sortBy] || '';
        return sortOrder === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
      results = results.slice(0, limit);
    }

    const totalPages = Math.ceil(total / limit);
    const queryTime = Date.now() - startTime;

    return {
      results,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
      facets,
      queryTime,
    };
  }

  private async searchClients(
    query: string | undefined,
    filters: AdvancedSearchInput['filters'],
    sortBy: string,
    sortOrder: string,
    skip: number,
    take: number
  ): Promise<{ results: SearchResultItem[]; total: number }> {
    const where: Record<string, unknown> = {
      ...this.buildOwnershipFilter(),
      archivedAt: null,
    };

    // Query search
    if (query) {
      where.OR = [
        { displayName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { companyName: { contains: query, mode: 'insensitive' } },
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { nip: { contains: query } },
        { regon: { contains: query } },
      ];
    }

    // Apply filters
    if (filters) {
      if (filters.clientTypes?.length) {
        where.type = { in: filters.clientTypes };
      }
      if (filters.statuses?.length) {
        where.status = { in: filters.statuses };
      }
      if (filters.tags?.length) {
        where.tags = filters.tagsMatchAll
          ? { hasEvery: filters.tags }
          : { hasSome: filters.tags };
      }
      if (filters.vatStatuses?.length) {
        where.vatStatus = { in: filters.vatStatuses };
      }
      if (filters.createdDateRange) {
        const dateRange = filters.createdDateRange;
        if (dateRange.preset && dateRange.preset !== 'custom') {
          where.createdAt = this.getDateRangeFromPreset(dateRange.preset);
        } else if (dateRange.from || dateRange.to) {
          const createdAtFilter: Record<string, Date> = {};
          if (dateRange.from) createdAtFilter.gte = dateRange.from;
          if (dateRange.to) createdAtFilter.lte = dateRange.to;
          where.createdAt = createdAtFilter;
        }
      }
      if (filters.updatedDateRange) {
        const dateRange = filters.updatedDateRange;
        if (dateRange.preset && dateRange.preset !== 'custom') {
          where.updatedAt = this.getDateRangeFromPreset(dateRange.preset);
        } else if (dateRange.from || dateRange.to) {
          const updatedAtFilter: Record<string, Date> = {};
          if (dateRange.from) updatedAtFilter.gte = dateRange.from;
          if (dateRange.to) updatedAtFilter.lte = dateRange.to;
          where.updatedAt = updatedAtFilter;
        }
      }
      // Note: hasContact and hasTimelineEvents filters require Contact and TimelineEvent models
      if (filters.ownerIds?.length) {
        where.ownerId = { in: filters.ownerIds };
      }
    }

    // Build order by
    const orderBy: Record<string, string> =
      sortBy === 'relevance' ? { updatedAt: 'desc' } : { [sortBy]: sortOrder };

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({ where, orderBy, skip, take }),
      this.prisma.client.count({ where }),
    ]);

    return {
      results: clients.map((c) => this.formatClientAsSearchResult(c)),
      total,
    };
  }

  private async getClientFacets(): Promise<SearchFacets> {
    const baseWhere: Record<string, unknown> = {
      ...this.buildOwnershipFilter(),
      archivedAt: null,
    };

    const [typeGroups, statusGroups] = await Promise.all([
      this.prisma.client.groupBy({
        by: ['type'],
        where: baseWhere,
        _count: true,
      }),
      this.prisma.client.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: true,
      }),
    ]);

    return {
      clientTypes: typeGroups.map((g) => ({ value: g.type, count: g._count })),
      statuses: statusGroups.map((g) => ({ value: g.status, count: g._count })),
      vatStatuses: [], // vatStatus groupBy not available in current schema
      tags: [], // Tags aggregation would require raw query
      createdByMonth: [], // Would require raw query for grouping by month
    };
  }

  // ===========================================
  // SEARCH SUGGESTIONS
  // ===========================================

  async getSearchSuggestions(
    input: SearchSuggestionInput
  ): Promise<SearchSuggestionsResult> {
    const { query, entityType, limit } = input;
    const suggestions: Array<{
      id: string;
      text: string;
      entityType: 'client' | 'contact';
      category: string;
    }> = [];

    if (entityType === 'client' || entityType === 'all') {
      const clientLimit = entityType === 'all' ? Math.ceil(limit / 2) : limit;
      const clients = await this.prisma.client.findMany({
        where: {
          ...this.buildOwnershipFilter(),
          archivedAt: null,
          OR: [
            { displayName: { contains: query, mode: 'insensitive' } },
            { companyName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, displayName: true, type: true },
        take: clientLimit,
      });

      suggestions.push(
        ...clients.map((c) => ({
          id: c.id,
          text: c.displayName || '',
          entityType: 'client' as const,
          category: c.type === 'company' ? 'Firma' : 'Osoba',
        }))
      );
    }

    // Contact suggestions require Contact model
    if (entityType === 'contact') {
      throw new NotImplementedError('getSearchSuggestions for contacts', 'Contact');
    }

    return { suggestions: suggestions.slice(0, limit) };
  }

  // ===========================================
  // SAVED SEARCHES - Require SavedSearch Prisma Model
  // ===========================================

  async createSavedSearch(
    _input: CreateSavedSearchInput
  ): Promise<SavedSearchCreateResult> {
    void _input;
    throw new NotImplementedError('createSavedSearch', 'SavedSearch');
  }

  async updateSavedSearch(
    _input: UpdateSavedSearchInput
  ): Promise<SavedSearchUpdateResult> {
    void _input;
    throw new NotImplementedError('updateSavedSearch', 'SavedSearch');
  }

  async deleteSavedSearch(
    _input: DeleteSavedSearchInput
  ): Promise<SavedSearchDeleteResult> {
    void _input;
    throw new NotImplementedError('deleteSavedSearch', 'SavedSearch');
  }

  async listSavedSearches(
    _input: ListSavedSearchesInput
  ): Promise<SavedSearchListResult> {
    void _input;
    throw new NotImplementedError('listSavedSearches', 'SavedSearch');
  }

  async executeSavedSearch(
    _searchId: string,
    _pagination: { page: number; limit: number }
  ): Promise<AdvancedSearchResult> {
    void _searchId;
    void _pagination;
    throw new NotImplementedError('executeSavedSearch', 'SavedSearch');
  }
}
