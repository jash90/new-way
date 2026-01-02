import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from '../../services/crm/search.service';
import { TRPCError } from '@trpc/server';

// ===========================================
// MOCKS
// ===========================================

const mockPrisma = {
  client: {
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  contact: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  savedSearch: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  pipeline: vi.fn(() => ({
    get: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
};

const mockAuditLogger = {
  log: vi.fn(),
};

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_ORG_ID = '22222222-2222-2222-2222-222222222222';
const CLIENT_ID = '33333333-3333-3333-3333-333333333333';
const CONTACT_ID = '44444444-4444-4444-4444-444444444444';
const SAVED_SEARCH_ID = '55555555-5555-5555-5555-555555555555';

// ===========================================
// TEST SUITE
// ===========================================

describe('SearchService (CRM-008)', () => {
  let service: SearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SearchService(
      mockPrisma as any,
      mockRedis as any,
      mockAuditLogger as any,
      TEST_USER_ID,
      TEST_ORG_ID
    );
  });

  // ===========================================
  // ADVANCED SEARCH
  // ===========================================

  describe('advancedSearch', () => {
    const mockClients = [
      {
        id: CLIENT_ID,
        displayName: 'Test Company',
        email: 'test@example.com',
        type: 'company',
        status: 'active',
        tags: ['important'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15'),
        ownerId: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
      },
    ];

    it('should perform basic search with query string', async () => {
      mockPrisma.client.findMany.mockResolvedValue(mockClients);
      mockPrisma.client.count.mockResolvedValue(1);

      const result = await service.advancedSearch({
        query: 'Test',
        entityType: 'client',
        page: 1,
        limit: 20,
      });

      expect(result.results).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.results[0].displayName).toBe('Test Company');
      expect(mockPrisma.client.findMany).toHaveBeenCalled();
    });

    it('should filter by client types', async () => {
      mockPrisma.client.findMany.mockResolvedValue(mockClients);
      mockPrisma.client.count.mockResolvedValue(1);

      await service.advancedSearch({
        entityType: 'client',
        filters: {
          clientTypes: ['company'],
        },
        page: 1,
        limit: 20,
      });

      const findManyCall = mockPrisma.client.findMany.mock.calls[0][0];
      expect(findManyCall.where.type).toEqual({ in: ['company'] });
    });

    it('should filter by statuses', async () => {
      mockPrisma.client.findMany.mockResolvedValue(mockClients);
      mockPrisma.client.count.mockResolvedValue(1);

      await service.advancedSearch({
        entityType: 'client',
        filters: {
          statuses: ['active', 'potential'],
        },
        page: 1,
        limit: 20,
      });

      const findManyCall = mockPrisma.client.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toEqual({ in: ['active', 'potential'] });
    });

    it('should filter by tags with matchAll=false (OR)', async () => {
      mockPrisma.client.findMany.mockResolvedValue(mockClients);
      mockPrisma.client.count.mockResolvedValue(1);

      await service.advancedSearch({
        entityType: 'client',
        filters: {
          tags: ['important', 'vip'],
          tagsMatchAll: false,
        },
        page: 1,
        limit: 20,
      });

      const findManyCall = mockPrisma.client.findMany.mock.calls[0][0];
      expect(findManyCall.where.tags).toEqual({ hasSome: ['important', 'vip'] });
    });

    it('should filter by tags with matchAll=true (AND)', async () => {
      mockPrisma.client.findMany.mockResolvedValue(mockClients);
      mockPrisma.client.count.mockResolvedValue(1);

      await service.advancedSearch({
        entityType: 'client',
        filters: {
          tags: ['important', 'vip'],
          tagsMatchAll: true,
        },
        page: 1,
        limit: 20,
      });

      const findManyCall = mockPrisma.client.findMany.mock.calls[0][0];
      expect(findManyCall.where.tags).toEqual({ hasEvery: ['important', 'vip'] });
    });

    it('should filter by VAT statuses', async () => {
      mockPrisma.client.findMany.mockResolvedValue(mockClients);
      mockPrisma.client.count.mockResolvedValue(1);

      await service.advancedSearch({
        entityType: 'client',
        filters: {
          vatStatuses: ['ACTIVE'],
        },
        page: 1,
        limit: 20,
      });

      const findManyCall = mockPrisma.client.findMany.mock.calls[0][0];
      expect(findManyCall.where.vatStatus).toEqual({ in: ['ACTIVE'] });
    });

    it('should filter by created date range with preset', async () => {
      mockPrisma.client.findMany.mockResolvedValue(mockClients);
      mockPrisma.client.count.mockResolvedValue(1);

      await service.advancedSearch({
        entityType: 'client',
        filters: {
          createdDateRange: {
            preset: 'last30days',
          },
        },
        page: 1,
        limit: 20,
      });

      const findManyCall = mockPrisma.client.findMany.mock.calls[0][0];
      expect(findManyCall.where.createdAt).toBeDefined();
      expect(findManyCall.where.createdAt.gte).toBeDefined();
    });

    it('should filter by created date range with custom dates', async () => {
      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-31');

      mockPrisma.client.findMany.mockResolvedValue(mockClients);
      mockPrisma.client.count.mockResolvedValue(1);

      await service.advancedSearch({
        entityType: 'client',
        filters: {
          createdDateRange: {
            preset: 'custom',
            from: fromDate,
            to: toDate,
          },
        },
        page: 1,
        limit: 20,
      });

      const findManyCall = mockPrisma.client.findMany.mock.calls[0][0];
      expect(findManyCall.where.createdAt.gte).toEqual(fromDate);
      expect(findManyCall.where.createdAt.lte).toEqual(toDate);
    });

    it('should filter by hasContact', async () => {
      mockPrisma.client.findMany.mockResolvedValue(mockClients);
      mockPrisma.client.count.mockResolvedValue(1);

      await service.advancedSearch({
        entityType: 'client',
        filters: {
          hasContact: true,
        },
        page: 1,
        limit: 20,
      });

      const findManyCall = mockPrisma.client.findMany.mock.calls[0][0];
      expect(findManyCall.where.contacts).toEqual({ some: {} });
    });

    it('should filter by hasTimelineEvents', async () => {
      mockPrisma.client.findMany.mockResolvedValue(mockClients);
      mockPrisma.client.count.mockResolvedValue(1);

      await service.advancedSearch({
        entityType: 'client',
        filters: {
          hasTimelineEvents: true,
        },
        page: 1,
        limit: 20,
      });

      const findManyCall = mockPrisma.client.findMany.mock.calls[0][0];
      expect(findManyCall.where.timelineEvents).toEqual({ some: {} });
    });

    it('should sort by displayName', async () => {
      mockPrisma.client.findMany.mockResolvedValue(mockClients);
      mockPrisma.client.count.mockResolvedValue(1);

      await service.advancedSearch({
        entityType: 'client',
        sortBy: 'displayName',
        sortOrder: 'asc',
        page: 1,
        limit: 20,
      });

      const findManyCall = mockPrisma.client.findMany.mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual({ displayName: 'asc' });
    });

    it('should return facets when requested', async () => {
      mockPrisma.client.findMany.mockResolvedValue(mockClients);
      mockPrisma.client.count.mockResolvedValue(1);
      mockPrisma.client.groupBy.mockResolvedValue([{ type: 'company', _count: 5 }]);

      const result = await service.advancedSearch({
        entityType: 'client',
        includeFacets: true,
        page: 1,
        limit: 20,
      });

      expect(result.facets).toBeDefined();
      expect(mockPrisma.client.groupBy).toHaveBeenCalled();
    });

    it('should handle pagination correctly', async () => {
      mockPrisma.client.findMany.mockResolvedValue(mockClients);
      mockPrisma.client.count.mockResolvedValue(100);

      const result = await service.advancedSearch({
        entityType: 'client',
        page: 2,
        limit: 10,
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(10);
      expect(result.hasMore).toBe(true);

      const findManyCall = mockPrisma.client.findMany.mock.calls[0][0];
      expect(findManyCall.skip).toBe(10); // (page-1) * limit
      expect(findManyCall.take).toBe(10);
    });

    it('should search contacts when entityType is contact', async () => {
      const mockContacts = [
        {
          id: CONTACT_ID,
          fullName: 'John Doe',
          email: 'john@example.com',
          position: 'Manager',
          clientId: CLIENT_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.contact.findMany.mockResolvedValue(mockContacts);
      mockPrisma.contact.count.mockResolvedValue(1);

      const result = await service.advancedSearch({
        query: 'John',
        entityType: 'contact',
        page: 1,
        limit: 20,
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].entityType).toBe('contact');
      expect(mockPrisma.contact.findMany).toHaveBeenCalled();
    });

    it('should search both clients and contacts when entityType is all', async () => {
      mockPrisma.client.findMany.mockResolvedValue(mockClients);
      mockPrisma.client.count.mockResolvedValue(1);
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.contact.count.mockResolvedValue(0);

      const result = await service.advancedSearch({
        query: 'Test',
        entityType: 'all',
        page: 1,
        limit: 20,
      });

      expect(result.total).toBe(1);
      expect(mockPrisma.client.findMany).toHaveBeenCalled();
      expect(mockPrisma.contact.findMany).toHaveBeenCalled();
    });

    it('should include query time in result', async () => {
      mockPrisma.client.findMany.mockResolvedValue(mockClients);
      mockPrisma.client.count.mockResolvedValue(1);

      const result = await service.advancedSearch({
        entityType: 'client',
        page: 1,
        limit: 20,
      });

      expect(result.queryTime).toBeGreaterThanOrEqual(0);
    });
  });

  // ===========================================
  // SEARCH SUGGESTIONS
  // ===========================================

  describe('getSearchSuggestions', () => {
    it('should return client suggestions', async () => {
      mockPrisma.client.findMany.mockResolvedValue([
        { id: CLIENT_ID, displayName: 'Test Company', type: 'company' },
      ]);
      mockPrisma.contact.findMany.mockResolvedValue([]);

      const result = await service.getSearchSuggestions({
        query: 'Test',
        entityType: 'client',
        limit: 5,
      });

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].text).toBe('Test Company');
      expect(result.suggestions[0].entityType).toBe('client');
    });

    it('should return contact suggestions', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([
        { id: CONTACT_ID, fullName: 'John Doe', position: 'Manager' },
      ]);

      const result = await service.getSearchSuggestions({
        query: 'John',
        entityType: 'contact',
        limit: 5,
      });

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].text).toBe('John Doe');
      expect(result.suggestions[0].entityType).toBe('contact');
    });

    it('should return both client and contact suggestions when entityType is all', async () => {
      mockPrisma.client.findMany.mockResolvedValue([
        { id: CLIENT_ID, displayName: 'Test Company', type: 'company' },
      ]);
      mockPrisma.contact.findMany.mockResolvedValue([
        { id: CONTACT_ID, fullName: 'John Test', position: 'CEO' },
      ]);

      const result = await service.getSearchSuggestions({
        query: 'Test',
        entityType: 'all',
        limit: 10,
      });

      expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect limit parameter', async () => {
      const manyClients = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: `client-${i}`,
          displayName: `Test Company ${i}`,
          type: 'company',
        }));

      mockPrisma.client.findMany.mockResolvedValue(manyClients.slice(0, 3));

      const result = await service.getSearchSuggestions({
        query: 'Test',
        entityType: 'client',
        limit: 3,
      });

      expect(result.suggestions).toHaveLength(3);
    });
  });

  // ===========================================
  // SAVED SEARCHES
  // ===========================================

  describe('createSavedSearch', () => {
    const mockSavedSearch = {
      id: SAVED_SEARCH_ID,
      name: 'Active Clients',
      description: 'All active clients',
      searchCriteria: { filters: { statuses: ['active'] } },
      isDefault: false,
      usageCount: 0,
      lastUsedAt: null,
      userId: TEST_USER_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create a saved search', async () => {
      mockPrisma.savedSearch.create.mockResolvedValue(mockSavedSearch);

      const result = await service.createSavedSearch({
        name: 'Active Clients',
        description: 'All active clients',
        searchCriteria: {
          entityType: 'client',
          filters: { statuses: ['active'] },
        },
      });

      expect(result.success).toBe(true);
      expect(result.savedSearch.name).toBe('Active Clients');
      expect(mockPrisma.savedSearch.create).toHaveBeenCalled();
    });

    it('should set isDefault and clear other defaults', async () => {
      mockPrisma.savedSearch.create.mockResolvedValue({
        ...mockSavedSearch,
        isDefault: true,
      });

      await service.createSavedSearch({
        name: 'Default Search',
        searchCriteria: { entityType: 'client' },
        isDefault: true,
      });

      // Should clear existing defaults first
      expect(mockPrisma.savedSearch.create).toHaveBeenCalled();
    });

    it('should log audit event on creation', async () => {
      mockPrisma.savedSearch.create.mockResolvedValue(mockSavedSearch);

      await service.createSavedSearch({
        name: 'Active Clients',
        searchCriteria: { entityType: 'client' },
      });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'SAVED_SEARCH_CREATED',
          resourceType: 'SavedSearch',
        })
      );
    });
  });

  describe('updateSavedSearch', () => {
    const mockSavedSearch = {
      id: SAVED_SEARCH_ID,
      name: 'Active Clients',
      description: null,
      searchCriteria: { filters: { statuses: ['active'] } },
      isDefault: false,
      usageCount: 5,
      lastUsedAt: new Date(),
      userId: TEST_USER_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should update a saved search', async () => {
      mockPrisma.savedSearch.findUnique.mockResolvedValue(mockSavedSearch);
      mockPrisma.savedSearch.update.mockResolvedValue({
        ...mockSavedSearch,
        name: 'Updated Name',
      });

      const result = await service.updateSavedSearch({
        searchId: SAVED_SEARCH_ID,
        name: 'Updated Name',
      });

      expect(result.success).toBe(true);
      expect(result.savedSearch.name).toBe('Updated Name');
    });

    it('should throw NOT_FOUND if saved search does not exist', async () => {
      mockPrisma.savedSearch.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSavedSearch({
          searchId: SAVED_SEARCH_ID,
          name: 'Updated',
        })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw FORBIDDEN if not owner', async () => {
      mockPrisma.savedSearch.findUnique.mockResolvedValue({
        ...mockSavedSearch,
        userId: 'other-user-id',
      });

      await expect(
        service.updateSavedSearch({
          searchId: SAVED_SEARCH_ID,
          name: 'Updated',
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('deleteSavedSearch', () => {
    const mockSavedSearch = {
      id: SAVED_SEARCH_ID,
      name: 'Active Clients',
      userId: TEST_USER_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should delete a saved search', async () => {
      mockPrisma.savedSearch.findUnique.mockResolvedValue(mockSavedSearch);
      mockPrisma.savedSearch.delete.mockResolvedValue(mockSavedSearch);

      const result = await service.deleteSavedSearch({
        searchId: SAVED_SEARCH_ID,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.savedSearch.delete).toHaveBeenCalledWith({
        where: { id: SAVED_SEARCH_ID },
      });
    });

    it('should throw NOT_FOUND if saved search does not exist', async () => {
      mockPrisma.savedSearch.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteSavedSearch({ searchId: SAVED_SEARCH_ID })
      ).rejects.toThrow(TRPCError);
    });

    it('should throw FORBIDDEN if not owner', async () => {
      mockPrisma.savedSearch.findUnique.mockResolvedValue({
        ...mockSavedSearch,
        userId: 'other-user-id',
      });

      await expect(
        service.deleteSavedSearch({ searchId: SAVED_SEARCH_ID })
      ).rejects.toThrow(TRPCError);
    });

    it('should log audit event on deletion', async () => {
      mockPrisma.savedSearch.findUnique.mockResolvedValue(mockSavedSearch);
      mockPrisma.savedSearch.delete.mockResolvedValue(mockSavedSearch);

      await service.deleteSavedSearch({ searchId: SAVED_SEARCH_ID });

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'SAVED_SEARCH_DELETED',
          resourceType: 'SavedSearch',
        })
      );
    });
  });

  describe('listSavedSearches', () => {
    const mockSavedSearches = [
      {
        id: SAVED_SEARCH_ID,
        name: 'Active Clients',
        description: null,
        searchCriteria: { entityType: 'client' },
        isDefault: true,
        usageCount: 10,
        lastUsedAt: new Date(),
        userId: TEST_USER_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should list saved searches for user', async () => {
      mockPrisma.savedSearch.findMany.mockResolvedValue(mockSavedSearches);
      mockPrisma.savedSearch.count.mockResolvedValue(1);

      const result = await service.listSavedSearches({});

      expect(result.savedSearches).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by entity type', async () => {
      mockPrisma.savedSearch.findMany.mockResolvedValue(mockSavedSearches);
      mockPrisma.savedSearch.count.mockResolvedValue(1);

      await service.listSavedSearches({ entityType: 'client' });

      const findManyCall = mockPrisma.savedSearch.findMany.mock.calls[0][0];
      expect(findManyCall.where.searchCriteria.path).toContain('entityType');
    });

    it('should order by isDefault and lastUsedAt', async () => {
      mockPrisma.savedSearch.findMany.mockResolvedValue(mockSavedSearches);
      mockPrisma.savedSearch.count.mockResolvedValue(1);

      await service.listSavedSearches({});

      const findManyCall = mockPrisma.savedSearch.findMany.mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual([
        { isDefault: 'desc' },
        { lastUsedAt: 'desc' },
        { name: 'asc' },
      ]);
    });
  });

  describe('executeSavedSearch', () => {
    const mockSavedSearch = {
      id: SAVED_SEARCH_ID,
      name: 'Active Clients',
      searchCriteria: {
        entityType: 'client',
        filters: { statuses: ['active'] },
      },
      userId: TEST_USER_ID,
      usageCount: 5,
    };

    const mockClients = [
      {
        id: CLIENT_ID,
        displayName: 'Test Company',
        email: 'test@example.com',
        type: 'company',
        status: 'active',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        ownerId: TEST_USER_ID,
      },
    ];

    it('should execute a saved search', async () => {
      mockPrisma.savedSearch.findUnique.mockResolvedValue(mockSavedSearch);
      mockPrisma.savedSearch.update.mockResolvedValue({
        ...mockSavedSearch,
        usageCount: 6,
        lastUsedAt: new Date(),
      });
      mockPrisma.client.findMany.mockResolvedValue(mockClients);
      mockPrisma.client.count.mockResolvedValue(1);

      const result = await service.executeSavedSearch(SAVED_SEARCH_ID, {
        page: 1,
        limit: 20,
      });

      expect(result.results).toHaveLength(1);
      expect(mockPrisma.savedSearch.update).toHaveBeenCalled(); // Usage count updated
    });

    it('should throw NOT_FOUND if saved search does not exist', async () => {
      mockPrisma.savedSearch.findUnique.mockResolvedValue(null);

      await expect(
        service.executeSavedSearch(SAVED_SEARCH_ID, { page: 1, limit: 20 })
      ).rejects.toThrow(TRPCError);
    });

    it('should increment usage count', async () => {
      mockPrisma.savedSearch.findUnique.mockResolvedValue(mockSavedSearch);
      mockPrisma.savedSearch.update.mockResolvedValue(mockSavedSearch);
      mockPrisma.client.findMany.mockResolvedValue(mockClients);
      mockPrisma.client.count.mockResolvedValue(1);

      await service.executeSavedSearch(SAVED_SEARCH_ID, { page: 1, limit: 20 });

      expect(mockPrisma.savedSearch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SAVED_SEARCH_ID },
          data: expect.objectContaining({
            usageCount: { increment: 1 },
          }),
        })
      );
    });
  });

  // ===========================================
  // DATE RANGE HELPERS
  // ===========================================

  describe('date range presets', () => {
    it('should calculate last7days correctly', async () => {
      mockPrisma.client.findMany.mockResolvedValue([]);
      mockPrisma.client.count.mockResolvedValue(0);

      await service.advancedSearch({
        entityType: 'client',
        filters: {
          createdDateRange: { preset: 'last7days' },
        },
        page: 1,
        limit: 20,
      });

      const findManyCall = mockPrisma.client.findMany.mock.calls[0][0];
      const dateFilter = findManyCall.where.createdAt;

      expect(dateFilter.gte).toBeDefined();
      const daysDiff = Math.floor(
        (Date.now() - dateFilter.gte.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBeLessThanOrEqual(7);
    });

    it('should calculate thisMonth correctly', async () => {
      mockPrisma.client.findMany.mockResolvedValue([]);
      mockPrisma.client.count.mockResolvedValue(0);

      await service.advancedSearch({
        entityType: 'client',
        filters: {
          createdDateRange: { preset: 'thisMonth' },
        },
        page: 1,
        limit: 20,
      });

      const findManyCall = mockPrisma.client.findMany.mock.calls[0][0];
      const dateFilter = findManyCall.where.createdAt;

      expect(dateFilter.gte).toBeDefined();
      expect(dateFilter.gte.getDate()).toBe(1); // First day of month
    });
  });
});
