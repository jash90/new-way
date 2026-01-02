import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '../../index';
import { createContext } from '../../context';

// ===========================================
// HOISTED MOCKS
// ===========================================

const mocks = vi.hoisted(() => ({
  getCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  getTags: vi.fn(),
  getTagById: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  archiveTag: vi.fn(),
  restoreTag: vi.fn(),
  deleteTag: vi.fn(),
  getClientTags: vi.fn(),
  assignTags: vi.fn(),
  removeTags: vi.fn(),
  replaceClientTags: vi.fn(),
  bulkTagOperation: vi.fn(),
  getTagStatistics: vi.fn(),
}));

vi.mock('../../services/crm/tagging.service', () => ({
  TaggingService: vi.fn().mockImplementation(() => mocks),
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
  tagCategory: { findMany: vi.fn(), findUnique: vi.fn() },
  tag: { findMany: vi.fn(), findUnique: vi.fn() },
  clientTag: { findMany: vi.fn() },
  client: { findUnique: vi.fn() },
  $transaction: vi.fn((callback: any) => callback(mockPrisma)),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn().mockResolvedValue([]),
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
const TAG_ID = '44444444-4444-4444-4444-444444444444';
const TAG_ID_2 = '55555555-5555-5555-5555-555555555555';
const CATEGORY_ID = '66666666-6666-6666-6666-666666666666';
const SESSION_ID = '77777777-7777-7777-7777-777777777777';

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

function createAdminContext() {
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

describe('Tagging Router (CRM-007)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================
  // AUTHENTICATION
  // ===========================================

  describe('authentication', () => {
    it('should reject unauthenticated requests to getCategories', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.crm.tagging.getCategories({
          includeInactive: false,
          includeTags: true,
        })
      ).rejects.toThrow();
    });

    it('should reject unauthenticated requests to getTags', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.crm.tagging.getTags({
          includeInactive: false,
          includeArchived: false,
          page: 1,
          limit: 50,
        })
      ).rejects.toThrow();
    });

    it('should reject unauthenticated requests to assignTags', async () => {
      const caller = appRouter.createCaller(createUnauthenticatedContext());

      await expect(
        caller.crm.tagging.assignTags({
          clientId: CLIENT_ID,
          tagIds: [TAG_ID],
        })
      ).rejects.toThrow();
    });

    it('should reject non-admin requests to createCategory', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.tagging.createCategory({
          name: 'New Category',
          selectionMode: 'MULTIPLE',
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================
  // TAG CATEGORY OPERATIONS
  // ===========================================

  describe('getCategories', () => {
    const mockCategoriesResponse = {
      categories: [
        {
          id: CATEGORY_ID,
          name: 'Status klienta',
          description: 'Kategoria statusu',
          selectionMode: 'SINGLE',
          displayOrder: 0,
          isActive: true,
          tags: [],
          tagCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 1,
    };

    it('should return categories', async () => {
      mocks.getCategories.mockResolvedValue(mockCategoriesResponse);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.getCategories({
        includeInactive: false,
        includeTags: true,
      });

      expect(result.categories).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mocks.getCategories).toHaveBeenCalledWith({
        includeInactive: false,
        includeTags: true,
      });
    });

    it('should include inactive categories when requested', async () => {
      mocks.getCategories.mockResolvedValue(mockCategoriesResponse);
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.tagging.getCategories({
        includeInactive: true,
        includeTags: false,
      });

      expect(mocks.getCategories).toHaveBeenCalledWith({
        includeInactive: true,
        includeTags: false,
      });
    });
  });

  describe('createCategory', () => {
    const mockCreateResult = {
      success: true,
      category: {
        id: CATEGORY_ID,
        name: 'New Category',
        description: null,
        selectionMode: 'MULTIPLE',
        displayOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      message: 'Kategoria utworzona',
    };

    it('should create a category (admin only)', async () => {
      mocks.createCategory.mockResolvedValue(mockCreateResult);
      const caller = appRouter.createCaller(createAdminContext());

      const result = await caller.crm.tagging.createCategory({
        name: 'New Category',
        selectionMode: 'MULTIPLE',
      });

      expect(result.success).toBe(true);
      expect(result.category.name).toBe('New Category');
      expect(mocks.createCategory).toHaveBeenCalled();
    });

    it('should create category with all options', async () => {
      mocks.createCategory.mockResolvedValue(mockCreateResult);
      const caller = appRouter.createCaller(createAdminContext());

      await caller.crm.tagging.createCategory({
        name: 'New Category',
        description: 'Test description',
        selectionMode: 'SINGLE',
        displayOrder: 5,
      });

      expect(mocks.createCategory).toHaveBeenCalledWith({
        name: 'New Category',
        description: 'Test description',
        selectionMode: 'SINGLE',
        displayOrder: 5,
      });
    });
  });

  describe('updateCategory', () => {
    const mockUpdateResult = {
      success: true,
      category: {
        id: CATEGORY_ID,
        name: 'Updated Category',
        description: 'Updated description',
        selectionMode: 'SINGLE',
        displayOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      message: 'Kategoria zaktualizowana',
    };

    it('should update a category (admin only)', async () => {
      mocks.updateCategory.mockResolvedValue(mockUpdateResult);
      const caller = appRouter.createCaller(createAdminContext());

      const result = await caller.crm.tagging.updateCategory({
        id: CATEGORY_ID,
        name: 'Updated Category',
      });

      expect(result.success).toBe(true);
      expect(result.category.name).toBe('Updated Category');
    });
  });

  describe('deleteCategory', () => {
    const mockDeleteResult = {
      success: true,
      deletedId: CATEGORY_ID,
      reassignedTags: 0,
      message: 'Kategoria usunięta',
    };

    it('should delete a category (admin only)', async () => {
      mocks.deleteCategory.mockResolvedValue(mockDeleteResult);
      const caller = appRouter.createCaller(createAdminContext());

      const result = await caller.crm.tagging.deleteCategory({
        id: CATEGORY_ID,
      });

      expect(result.success).toBe(true);
      expect(result.deletedId).toBe(CATEGORY_ID);
    });

    it('should delete with reassignment', async () => {
      const newCategoryId = '88888888-8888-8888-8888-888888888888';
      mocks.deleteCategory.mockResolvedValue({
        ...mockDeleteResult,
        reassignedTags: 5,
      });
      const caller = appRouter.createCaller(createAdminContext());

      const result = await caller.crm.tagging.deleteCategory({
        id: CATEGORY_ID,
        reassignToCategory: newCategoryId,
      });

      expect(result.success).toBe(true);
      expect(result.reassignedTags).toBe(5);
    });
  });

  // ===========================================
  // TAG OPERATIONS
  // ===========================================

  describe('getTags', () => {
    const mockTagsResponse = {
      tags: [
        {
          id: TAG_ID,
          name: 'VIP',
          slug: 'vip',
          color: '#FFD700',
          description: 'Klient VIP',
          icon: 'star',
          categoryId: CATEGORY_ID,
          categoryName: 'Status klienta',
          displayOrder: 0,
          isSystem: false,
          isActive: true,
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
    };

    it('should return tags', async () => {
      mocks.getTags.mockResolvedValue(mockTagsResponse);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.getTags({
        includeInactive: false,
        includeArchived: false,
        page: 1,
        limit: 50,
      });

      expect(result.tags).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by category', async () => {
      mocks.getTags.mockResolvedValue(mockTagsResponse);
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.tagging.getTags({
        categoryId: CATEGORY_ID,
        includeInactive: false,
        includeArchived: false,
        page: 1,
        limit: 50,
      });

      expect(mocks.getTags).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: CATEGORY_ID })
      );
    });

    it('should search tags', async () => {
      mocks.getTags.mockResolvedValue(mockTagsResponse);
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.tagging.getTags({
        search: 'VIP',
        includeInactive: false,
        includeArchived: false,
        page: 1,
        limit: 50,
      });

      expect(mocks.getTags).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'VIP' })
      );
    });
  });

  describe('getTagById', () => {
    const mockTagResponse = {
      tag: {
        id: TAG_ID,
        name: 'VIP',
        slug: 'vip',
        color: '#FFD700',
        description: 'Klient VIP',
        icon: 'star',
        categoryId: CATEGORY_ID,
        categoryName: 'Status klienta',
        displayOrder: 0,
        isSystem: false,
        isActive: true,
        isArchived: false,
        clientCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    it('should return a tag by ID', async () => {
      mocks.getTagById.mockResolvedValue(mockTagResponse);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.getTagById({
        id: TAG_ID,
        includeClientCount: true,
      });

      expect(result.tag.id).toBe(TAG_ID);
      expect(result.tag.clientCount).toBe(5);
    });
  });

  describe('createTag', () => {
    const mockCreateTagResult = {
      success: true,
      tag: {
        id: TAG_ID,
        name: 'New Tag',
        slug: 'new-tag',
        color: '#FF0000',
        description: 'Test tag',
        icon: null,
        categoryId: CATEGORY_ID,
        categoryName: 'Status klienta',
        displayOrder: 0,
        isSystem: false,
        isActive: true,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      message: 'Tag utworzony',
    };

    it('should create a tag', async () => {
      mocks.createTag.mockResolvedValue(mockCreateTagResult);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.createTag({
        name: 'New Tag',
        categoryId: CATEGORY_ID,
        color: '#FF0000',
        description: 'Test tag',
      });

      expect(result.success).toBe(true);
      expect(result.tag.name).toBe('New Tag');
    });

    it('should create tag with minimal options', async () => {
      mocks.createTag.mockResolvedValue(mockCreateTagResult);
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.tagging.createTag({
        name: 'New Tag',
        color: '#FF0000',
      });

      expect(mocks.createTag).toHaveBeenCalled();
    });
  });

  describe('updateTag', () => {
    const mockUpdateTagResult = {
      success: true,
      tag: {
        id: TAG_ID,
        name: 'Updated Tag',
        slug: 'updated-tag',
        color: '#00FF00',
        description: null,
        icon: null,
        categoryId: CATEGORY_ID,
        categoryName: 'Status klienta',
        displayOrder: 0,
        isSystem: false,
        isActive: true,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      message: 'Tag zaktualizowany',
    };

    it('should update a tag', async () => {
      mocks.updateTag.mockResolvedValue(mockUpdateTagResult);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.updateTag({
        id: TAG_ID,
        name: 'Updated Tag',
        color: '#00FF00',
      });

      expect(result.success).toBe(true);
      expect(result.tag.name).toBe('Updated Tag');
    });
  });

  describe('archiveTag', () => {
    const mockArchiveResult = {
      success: true,
      tag: {
        id: TAG_ID,
        name: 'VIP',
        slug: 'vip',
        color: '#FFD700',
        isArchived: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      message: 'Tag zarchiwizowany',
    };

    it('should archive a tag', async () => {
      mocks.archiveTag.mockResolvedValue(mockArchiveResult);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.archiveTag({
        id: TAG_ID,
      });

      expect(result.success).toBe(true);
      expect(result.tag.isArchived).toBe(true);
    });
  });

  describe('restoreTag', () => {
    const mockRestoreResult = {
      success: true,
      tag: {
        id: TAG_ID,
        name: 'VIP',
        slug: 'vip',
        color: '#FFD700',
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      message: 'Tag przywrócony',
    };

    it('should restore an archived tag', async () => {
      mocks.restoreTag.mockResolvedValue(mockRestoreResult);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.restoreTag({
        id: TAG_ID,
      });

      expect(result.success).toBe(true);
      expect(result.tag.isArchived).toBe(false);
    });
  });

  describe('deleteTag', () => {
    const mockDeleteResult = {
      success: true,
      deletedId: TAG_ID,
      hardDeleted: false,
      message: 'Tag usunięty',
    };

    it('should soft delete a tag', async () => {
      mocks.deleteTag.mockResolvedValue(mockDeleteResult);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.deleteTag({
        id: TAG_ID,
        hardDelete: false,
      });

      expect(result.success).toBe(true);
      expect(result.hardDeleted).toBe(false);
    });

    it('should hard delete a tag', async () => {
      mocks.deleteTag.mockResolvedValue({
        ...mockDeleteResult,
        hardDeleted: true,
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.deleteTag({
        id: TAG_ID,
        hardDelete: true,
      });

      expect(result.success).toBe(true);
      expect(result.hardDeleted).toBe(true);
    });
  });

  // ===========================================
  // CLIENT TAG OPERATIONS
  // ===========================================

  describe('getClientTags', () => {
    const mockClientTagsResponse = {
      clientId: CLIENT_ID,
      tags: [
        {
          tagId: TAG_ID,
          tagName: 'VIP',
          tagColor: '#FFD700',
          tagSlug: 'vip',
          categoryId: CATEGORY_ID,
          categoryName: 'Status klienta',
          assignedAt: new Date(),
          assignedBy: { id: TEST_USER_ID, name: 'Test User' },
        },
      ],
    };

    it('should return client tags', async () => {
      mocks.getClientTags.mockResolvedValue(mockClientTagsResponse);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.getClientTags({
        clientId: CLIENT_ID,
      });

      expect(result.clientId).toBe(CLIENT_ID);
      expect(result.tags).toHaveLength(1);
    });
  });

  describe('assignTags', () => {
    const mockAssignResult = {
      success: true,
      clientId: CLIENT_ID,
      assignedTags: [TAG_ID, TAG_ID_2],
      skippedTags: [],
      message: 'Tagi przypisane',
    };

    it('should assign tags to client', async () => {
      mocks.assignTags.mockResolvedValue(mockAssignResult);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.assignTags({
        clientId: CLIENT_ID,
        tagIds: [TAG_ID, TAG_ID_2],
      });

      expect(result.success).toBe(true);
      expect(result.assignedTags).toHaveLength(2);
    });

    it('should handle skipped tags', async () => {
      mocks.assignTags.mockResolvedValue({
        ...mockAssignResult,
        assignedTags: [TAG_ID_2],
        skippedTags: [TAG_ID],
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.assignTags({
        clientId: CLIENT_ID,
        tagIds: [TAG_ID, TAG_ID_2],
      });

      expect(result.assignedTags).toContain(TAG_ID_2);
      expect(result.skippedTags).toContain(TAG_ID);
    });
  });

  describe('removeTags', () => {
    const mockRemoveResult = {
      success: true,
      clientId: CLIENT_ID,
      removedCount: 1,
      message: 'Tagi usunięte',
    };

    it('should remove tags from client', async () => {
      mocks.removeTags.mockResolvedValue(mockRemoveResult);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.removeTags({
        clientId: CLIENT_ID,
        tagIds: [TAG_ID],
      });

      expect(result.success).toBe(true);
      expect(result.removedCount).toBe(1);
    });
  });

  describe('replaceClientTags', () => {
    const mockReplaceResult = {
      success: true,
      clientId: CLIENT_ID,
      removedCount: 3,
      addedCount: 2,
      message: 'Tagi zastąpione',
    };

    it('should replace client tags', async () => {
      mocks.replaceClientTags.mockResolvedValue(mockReplaceResult);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.replaceClientTags({
        clientId: CLIENT_ID,
        tagIds: [TAG_ID, TAG_ID_2],
      });

      expect(result.success).toBe(true);
      expect(result.removedCount).toBe(3);
      expect(result.addedCount).toBe(2);
    });

    it('should clear all tags when empty array', async () => {
      mocks.replaceClientTags.mockResolvedValue({
        ...mockReplaceResult,
        addedCount: 0,
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.replaceClientTags({
        clientId: CLIENT_ID,
        tagIds: [],
      });

      expect(result.addedCount).toBe(0);
    });
  });

  // ===========================================
  // BULK OPERATIONS
  // ===========================================

  describe('bulkTagOperation', () => {
    const mockBulkResult = {
      success: true,
      operation: 'ADD',
      processed: 2,
      failed: 0,
      results: [
        { clientId: CLIENT_ID, success: true },
        { clientId: '88888888-8888-8888-8888-888888888888', success: true },
      ],
      message: 'Operacja wykonana',
    };

    it('should add tags to multiple clients', async () => {
      mocks.bulkTagOperation.mockResolvedValue(mockBulkResult);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.bulkTagOperation({
        clientIds: [CLIENT_ID, '88888888-8888-8888-8888-888888888888'],
        operation: 'ADD',
        tagIds: [TAG_ID],
      });

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should remove tags from multiple clients', async () => {
      mocks.bulkTagOperation.mockResolvedValue({
        ...mockBulkResult,
        operation: 'REMOVE',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.bulkTagOperation({
        clientIds: [CLIENT_ID],
        operation: 'REMOVE',
        tagIds: [TAG_ID],
      });

      expect(result.operation).toBe('REMOVE');
    });

    it('should replace tags for multiple clients', async () => {
      mocks.bulkTagOperation.mockResolvedValue({
        ...mockBulkResult,
        operation: 'REPLACE',
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.bulkTagOperation({
        clientIds: [CLIENT_ID],
        operation: 'REPLACE',
        tagIds: [TAG_ID, TAG_ID_2],
      });

      expect(result.operation).toBe('REPLACE');
    });

    it('should handle partial failures', async () => {
      mocks.bulkTagOperation.mockResolvedValue({
        ...mockBulkResult,
        processed: 1,
        failed: 1,
        results: [
          { clientId: CLIENT_ID, success: true },
          { clientId: '99999999-9999-9999-9999-999999999999', success: false, error: 'Klient nie znaleziony' },
        ],
      });
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.bulkTagOperation({
        clientIds: [CLIENT_ID, '99999999-9999-9999-9999-999999999999'],
        operation: 'ADD',
        tagIds: [TAG_ID],
      });

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  // ===========================================
  // STATISTICS
  // ===========================================

  describe('getTagStatistics', () => {
    const mockStatisticsResponse = {
      totalTags: 10,
      activeTags: 8,
      archivedTags: 2,
      totalCategories: 3,
      totalAssignments: 150,
      topTags: [
        { tagId: TAG_ID, tagName: 'VIP', clientCount: 50 },
        { tagId: TAG_ID_2, tagName: 'Nowy', clientCount: 30 },
      ],
      recentActivity: [
        { date: '2024-01-15', assignments: 10, removals: 2 },
        { date: '2024-01-14', assignments: 8, removals: 1 },
      ],
      statistics: [],
    };

    it('should return tag statistics', async () => {
      mocks.getTagStatistics.mockResolvedValue(mockStatisticsResponse);
      const caller = appRouter.createCaller(createUserContext());

      const result = await caller.crm.tagging.getTagStatistics({});

      expect(result.totalTags).toBe(10);
      expect(result.topTags).toHaveLength(2);
    });

    it('should filter by tag', async () => {
      mocks.getTagStatistics.mockResolvedValue(mockStatisticsResponse);
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.tagging.getTagStatistics({
        tagId: TAG_ID,
      });

      expect(mocks.getTagStatistics).toHaveBeenCalledWith(
        expect.objectContaining({ tagId: TAG_ID })
      );
    });

    it('should filter by category', async () => {
      mocks.getTagStatistics.mockResolvedValue(mockStatisticsResponse);
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.tagging.getTagStatistics({
        categoryId: CATEGORY_ID,
      });

      expect(mocks.getTagStatistics).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: CATEGORY_ID })
      );
    });

    it('should filter by date range', async () => {
      mocks.getTagStatistics.mockResolvedValue(mockStatisticsResponse);
      const caller = appRouter.createCaller(createUserContext());

      await caller.crm.tagging.getTagStatistics({
        dateFrom: '2024-01-01T00:00:00.000Z',
        dateTo: '2024-01-31T23:59:59.999Z',
      });

      expect(mocks.getTagStatistics).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom: '2024-01-01T00:00:00.000Z',
          dateTo: '2024-01-31T23:59:59.999Z',
        })
      );
    });
  });

  // ===========================================
  // INPUT VALIDATION
  // ===========================================

  describe('input validation', () => {
    it('should reject invalid clientId format', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.tagging.getClientTags({
          clientId: 'invalid-uuid',
        })
      ).rejects.toThrow();
    });

    it('should reject invalid tagId format', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.tagging.getTagById({
          id: 'invalid-uuid',
          includeClientCount: false,
        })
      ).rejects.toThrow();
    });

    it('should reject empty tagIds array in assignTags', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.tagging.assignTags({
          clientId: CLIENT_ID,
          tagIds: [],
        })
      ).rejects.toThrow();
    });

    it('should reject too many tagIds in assignTags', async () => {
      const caller = appRouter.createCaller(createUserContext());
      const tooManyTags = Array.from({ length: 51 }, (_, i) =>
        `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000`
      );

      await expect(
        caller.crm.tagging.assignTags({
          clientId: CLIENT_ID,
          tagIds: tooManyTags,
        })
      ).rejects.toThrow();
    });

    it('should reject too many clientIds in bulkTagOperation', async () => {
      const caller = appRouter.createCaller(createUserContext());
      const tooManyClients = Array.from({ length: 1001 }, (_, i) =>
        `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000`
      );

      await expect(
        caller.crm.tagging.bulkTagOperation({
          clientIds: tooManyClients,
          operation: 'ADD',
          tagIds: [TAG_ID],
        })
      ).rejects.toThrow();
    });

    it('should reject invalid color format', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.tagging.createTag({
          name: 'Test Tag',
          color: 'not-a-hex-color',
        })
      ).rejects.toThrow();
    });

    it('should reject category name too long', async () => {
      const caller = appRouter.createCaller(createAdminContext());

      await expect(
        caller.crm.tagging.createCategory({
          name: 'a'.repeat(101),
          selectionMode: 'MULTIPLE',
        })
      ).rejects.toThrow();
    });

    it('should reject empty category name', async () => {
      const caller = appRouter.createCaller(createAdminContext());

      await expect(
        caller.crm.tagging.createCategory({
          name: '',
          selectionMode: 'MULTIPLE',
        })
      ).rejects.toThrow();
    });

    it('should reject invalid pagination', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.tagging.getTags({
          includeInactive: false,
          includeArchived: false,
          page: 0,
          limit: 50,
        })
      ).rejects.toThrow();
    });

    it('should reject limit exceeding max', async () => {
      const caller = appRouter.createCaller(createUserContext());

      await expect(
        caller.crm.tagging.getTags({
          includeInactive: false,
          includeArchived: false,
          page: 1,
          limit: 101,
        })
      ).rejects.toThrow();
    });
  });
});
