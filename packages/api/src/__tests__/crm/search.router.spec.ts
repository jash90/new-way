import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '../../index';
import { createContext } from '../../context';

// ===========================================
// HOISTED MOCKS
// ===========================================

const mocks = vi.hoisted(() => ({
  advancedSearch: vi.fn(),
  getSearchSuggestions: vi.fn(),
  createSavedSearch: vi.fn(),
  updateSavedSearch: vi.fn(),
  deleteSavedSearch: vi.fn(),
  listSavedSearches: vi.fn(),
  executeSavedSearch: vi.fn(),
}));

vi.mock('../../services/crm/search.service', () => ({
  SearchService: vi.fn().mockImplementation(() => mocks),
}));

vi.mock('@ksiegowacrm/auth', () => ({
  Argon2Service: vi.fn().mockImplementation(() => ({
    hash: vi.fn().mockResolvedValue('hashedPassword'),
    verify: vi.fn().mockResolvedValue(true),
  })),
  TotpService: vi.fn().mockImplementation(() => ({
    generateSecret: vi.fn().mockReturnValue('secret'),
    verify: vi.fn().mockReturnValue(true),
  })),
}));

// ===========================================
// MOCK SETUP
// ===========================================

const mockPrisma = {
  user: { findUnique: vi.fn() },
  session: { findUnique: vi.fn() },
  client: { findMany: vi.fn(), count: vi.fn() },
  savedSearch: { findMany: vi.fn(), count: vi.fn() },
  $transaction: vi.fn((callback: any) => callback(mockPrisma)),
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

// ===========================================
// TEST DATA
// ===========================================

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = '22222222-2222-2222-2222-222222222222';
const CLIENT_ID = '33333333-3333-3333-3333-333333333333';
const SAVED_SEARCH_ID = '55555555-5555-5555-5555-555555555555';
const SESSION_ID = '66666666-6666-6666-6666-666666666666';

// ===========================================
// CONTEXT HELPERS
// ===========================================

function createUserContext() {
  const ctx = createContext({
    prisma: mockPrisma as any,
    redis: mockRedis as any,
    req: {
      headers: { 'user-agent': 'test' },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
    } as any,
    res: {} as any,
  });
  return {
    ...ctx,
    session: {
      sessionId: SESSION_ID,
      userId: TEST_USER_ID,
      email: 'test@example.com',
      roles: ['USER'],
      organizationId: ORG_ID,
    },
  };
}

function createUnauthenticatedContext() {
  return createContext({
    prisma: mockPrisma as any,
    redis: mockRedis as any,
    req: {
      headers: { 'user-agent': 'test' },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
    } as any,
    res: {} as any,
  });
}

// ===========================================
// TEST SUITE
// ===========================================

describe('Search Router (CRM-008)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================
  // AUTHENTICATION
  // ===========================================

  describe('authentication', () => {
    it('should reject unauthenticated requests to advancedSearch', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.crm.search.advancedSearch({
          entityType: 'client',
          page: 1,
          limit: 20,
        })
      ).rejects.toThrow();
    });

    it('should reject unauthenticated requests to getSuggestions', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.crm.search.getSuggestions({
          query: 'test',
          entityType: 'client',
          limit: 5,
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================
  // ADVANCED SEARCH
  // ===========================================

  describe('advancedSearch', () => {
    const mockSearchResult = {
      results: [
        {
          id: CLIENT_ID,
          entityType: 'client' as const,
          displayName: 'Test Company',
          email: 'test@example.com',
          type: 'company',
          status: 'active',
          tags: ['important'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasMore: false,
      queryTime: 15,
    };

    it('should perform advanced search with query', async () => {
      mocks.advancedSearch.mockResolvedValue(mockSearchResult);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.search.advancedSearch({
        query: 'Test',
        entityType: 'client',
        page: 1,
        limit: 20,
      });

      expect(result.results).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mocks.advancedSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'Test',
          entityType: 'client',
        })
      );
    });

    it('should search with filters', async () => {
      mocks.advancedSearch.mockResolvedValue(mockSearchResult);
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.search.advancedSearch({
        entityType: 'client',
        filters: {
          clientTypes: ['company'],
          statuses: ['active'],
          tags: ['important'],
        },
        page: 1,
        limit: 20,
      });

      expect(mocks.advancedSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            clientTypes: ['company'],
            statuses: ['active'],
            tags: ['important'],
          }),
        })
      );
    });

    it('should search with date range filters', async () => {
      mocks.advancedSearch.mockResolvedValue(mockSearchResult);
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.search.advancedSearch({
        entityType: 'client',
        filters: {
          createdDateRange: {
            preset: 'last30days',
          },
        },
        page: 1,
        limit: 20,
      });

      expect(mocks.advancedSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            createdDateRange: expect.objectContaining({
              preset: 'last30days',
            }),
          }),
        })
      );
    });

    it('should include facets when requested', async () => {
      const resultWithFacets = {
        ...mockSearchResult,
        facets: {
          clientTypes: [{ value: 'company', count: 10 }],
          statuses: [{ value: 'active', count: 8 }],
          tags: [],
          vatStatuses: [],
          createdByMonth: [],
        },
      };
      mocks.advancedSearch.mockResolvedValue(resultWithFacets);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.search.advancedSearch({
        entityType: 'client',
        includeFacets: true,
        page: 1,
        limit: 20,
      });

      expect(result.facets).toBeDefined();
      expect(result.facets?.clientTypes).toHaveLength(1);
    });

    it('should search contacts', async () => {
      const contactResult = {
        results: [
          {
            id: '44444444-4444-4444-4444-444444444444',
            entityType: 'contact' as const,
            displayName: 'John Doe',
            email: 'john@example.com',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasMore: false,
        queryTime: 10,
      };
      mocks.advancedSearch.mockResolvedValue(contactResult);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.search.advancedSearch({
        query: 'John',
        entityType: 'contact',
        page: 1,
        limit: 20,
      });

      expect(result.results[0].entityType).toBe('contact');
    });

    it('should support sorting', async () => {
      mocks.advancedSearch.mockResolvedValue(mockSearchResult);
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.search.advancedSearch({
        entityType: 'client',
        sortBy: 'displayName',
        sortOrder: 'asc',
        page: 1,
        limit: 20,
      });

      expect(mocks.advancedSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'displayName',
          sortOrder: 'asc',
        })
      );
    });
  });

  // ===========================================
  // SEARCH SUGGESTIONS
  // ===========================================

  describe('getSuggestions', () => {
    it('should return search suggestions', async () => {
      mocks.getSearchSuggestions.mockResolvedValue({
        suggestions: [
          {
            id: CLIENT_ID,
            text: 'Test Company',
            entityType: 'client',
            category: 'Firma',
          },
        ],
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.search.getSuggestions({
        query: 'Test',
        entityType: 'client',
        limit: 5,
      });

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].text).toBe('Test Company');
    });

    it('should return suggestions for all entity types', async () => {
      mocks.getSearchSuggestions.mockResolvedValue({
        suggestions: [
          { id: '1', text: 'Client', entityType: 'client', category: 'Firma' },
          { id: '2', text: 'Contact', entityType: 'contact', category: 'Manager' },
        ],
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.search.getSuggestions({
        query: 'Test',
        entityType: 'all',
        limit: 10,
      });

      expect(result.suggestions.length).toBe(2);
    });
  });

  // ===========================================
  // SAVED SEARCHES - CREATE
  // ===========================================

  describe('createSavedSearch', () => {
    const mockSavedSearch = {
      id: SAVED_SEARCH_ID,
      name: 'Active Clients',
      description: 'All active clients',
      searchCriteria: { entityType: 'client', filters: { statuses: ['active'] } },
      isDefault: false,
      usageCount: 0,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create a saved search', async () => {
      mocks.createSavedSearch.mockResolvedValue({
        success: true,
        savedSearch: mockSavedSearch,
        message: 'Wyszukiwanie zapisane pomyślnie',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.search.createSavedSearch({
        name: 'Active Clients',
        description: 'All active clients',
        searchCriteria: {
          entityType: 'client',
          filters: { statuses: ['active'] },
        },
      });

      expect(result.success).toBe(true);
      expect(result.savedSearch.name).toBe('Active Clients');
    });

    it('should create a default saved search', async () => {
      mocks.createSavedSearch.mockResolvedValue({
        success: true,
        savedSearch: { ...mockSavedSearch, isDefault: true },
        message: 'Wyszukiwanie zapisane pomyślnie',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.search.createSavedSearch({
        name: 'Default Search',
        searchCriteria: { entityType: 'client' },
        isDefault: true,
      });

      expect(result.savedSearch.isDefault).toBe(true);
    });
  });

  // ===========================================
  // SAVED SEARCHES - UPDATE
  // ===========================================

  describe('updateSavedSearch', () => {
    it('should update a saved search', async () => {
      mocks.updateSavedSearch.mockResolvedValue({
        success: true,
        savedSearch: {
          id: SAVED_SEARCH_ID,
          name: 'Updated Name',
          description: null,
          searchCriteria: {},
          isDefault: false,
          usageCount: 5,
          lastUsedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        message: 'Wyszukiwanie zaktualizowane pomyślnie',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.search.updateSavedSearch({
        searchId: SAVED_SEARCH_ID,
        name: 'Updated Name',
      });

      expect(result.success).toBe(true);
      expect(result.savedSearch.name).toBe('Updated Name');
    });
  });

  // ===========================================
  // SAVED SEARCHES - DELETE
  // ===========================================

  describe('deleteSavedSearch', () => {
    it('should delete a saved search', async () => {
      mocks.deleteSavedSearch.mockResolvedValue({
        success: true,
        message: 'Wyszukiwanie usunięte',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.search.deleteSavedSearch({
        searchId: SAVED_SEARCH_ID,
      });

      expect(result.success).toBe(true);
      expect(mocks.deleteSavedSearch).toHaveBeenCalledWith({
        searchId: SAVED_SEARCH_ID,
      });
    });
  });

  // ===========================================
  // SAVED SEARCHES - LIST
  // ===========================================

  describe('listSavedSearches', () => {
    it('should list saved searches', async () => {
      mocks.listSavedSearches.mockResolvedValue({
        savedSearches: [
          {
            id: SAVED_SEARCH_ID,
            name: 'Active Clients',
            description: null,
            searchCriteria: { entityType: 'client' },
            isDefault: true,
            usageCount: 10,
            lastUsedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.search.listSavedSearches({});

      expect(result.savedSearches).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by entity type', async () => {
      mocks.listSavedSearches.mockResolvedValue({
        savedSearches: [],
        total: 0,
      });
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.search.listSavedSearches({
        entityType: 'contact',
      });

      expect(mocks.listSavedSearches).toHaveBeenCalledWith({
        entityType: 'contact',
      });
    });
  });

  // ===========================================
  // SAVED SEARCHES - EXECUTE
  // ===========================================

  describe('executeSavedSearch', () => {
    it('should execute a saved search', async () => {
      const searchResult = {
        results: [
          {
            id: CLIENT_ID,
            entityType: 'client' as const,
            displayName: 'Test',
            email: 'test@test.com',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasMore: false,
        queryTime: 10,
      };
      mocks.executeSavedSearch.mockResolvedValue(searchResult);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.search.executeSavedSearch({
        searchId: SAVED_SEARCH_ID,
        page: 1,
        limit: 20,
      });

      expect(result.results).toHaveLength(1);
      expect(mocks.executeSavedSearch).toHaveBeenCalledWith(
        SAVED_SEARCH_ID,
        { page: 1, limit: 20 }
      );
    });
  });
});
